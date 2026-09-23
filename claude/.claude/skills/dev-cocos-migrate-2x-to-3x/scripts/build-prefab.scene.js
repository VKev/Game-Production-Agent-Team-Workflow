// Runs INSIDE the Cocos 3.8 editor scene context. Builds a node tree from a
// dump-2x-tree.js JSON and leaves it in the open scene; the orchestrator then calls
// create_prefab_from_node on the returned root uuid.
//
// Why a script and not one MCP call per node: the 15 source files hold 506 nodes.
//
// Contract: this file's body is evaluated with (cc, Editor, args) in scope and must
// return a report object. args = { dumpFile, rootIndex?, parentPath? }.

const fs = require('fs');

const dump = JSON.parse(fs.readFileSync(args.dumpFile, 'utf8'));
const report = { file: dump.file, built: [], warnings: [], assetsLoaded: 0, assetsFailed: [], scaleZClamped: 0, colorMoved: 0 };

// --- 1. collect every asset uuid the tree needs, and load them up front ------
const needed = new Set();
(function collect(o) {
    if (Array.isArray(o)) return o.forEach(collect);
    if (o && typeof o === 'object') {
        if (o.$asset && o.$asset.uuid3x) needed.add(o.$asset.uuid3x);
        Object.values(o).forEach(collect);
    }
})(dump.roots);

const assets = new Map();
await Promise.all([...needed].map((uuid) => new Promise((resolve) => {
    cc.assetManager.loadAny({ uuid }, (err, asset) => {
        if (err || !asset) report.assetsFailed.push(uuid + ' :: ' + (err ? String(err.message || err).slice(0, 80) : 'null'));
        else { assets.set(uuid, asset); report.assetsLoaded++; }
        resolve();
    });
})));

const assetOf = (v) => (v && v.$asset && v.$asset.uuid3x ? assets.get(v.$asset.uuid3x) || null : null);

// --- 2. component construction -----------------------------------------------
// Only the types the inventory actually found are handled; an unknown type is
// reported instead of guessed at.
const num = (v) => (typeof v === 'number' ? v : undefined);
const colorOf = (v) => (v && v.$color ? new cc.Color(v.$color.r, v.$color.g, v.$color.b, v.$color.a) : null);
const sizeOf = (v) => (v && v.$size ? v.$size : null);
const vec2Of = (v) => (v && v.$vec2 ? new cc.Vec2(v.$vec2.x, v.$vec2.y) : null);

function setIf(target, key, value) {
    if (value === undefined || value === null) return;
    try { target[key] = value; } catch (e) { report.warnings.push('set ' + key + ' failed: ' + String(e).slice(0, 80)); }
}

// Deferred work that can only run once every node exists (node/component refs).
const deferred = [];

function addComponents(node, nodeSpec, ctx) {
    for (const c of nodeSpec.components) {
        const p = c.props || {};
        try {
            if (c.kind === 'script') {
                const name = c.scriptClassName;
                const Ctor = cc.js.getClassByName(name);
                if (!Ctor) { report.warnings.push('script class not registered: ' + name + ' on ' + nodeSpec.path); continue; }
                const comp = node.addComponent(Ctor);
                for (const [k, v] of Object.entries(p)) {
                    if (v && (v.$nodePath || v.$componentRef)) { deferred.push({ comp, key: k, ref: v, where: nodeSpec.path }); continue; }
                    if (v && v.$vec2) { setIf(comp, k, vec2Of(v)); continue; }
                    if (v && v.$color) { setIf(comp, k, colorOf(v)); continue; }
                    if (v && v.$asset) { setIf(comp, k, assetOf(v)); continue; }
                    if (v && typeof v === 'object') continue; // structured value this component does not need
                    setIf(comp, k, v);
                }
                continue;
            }

            switch (c.type) {
                case 'cc.Sprite': {
                    const s = node.addComponent(cc.Sprite);
                    // Order matters. A fresh Sprite defaults to sizeMode TRIMMED, and
                    // assigning spriteFrame in that state OVERWRITES the UITransform
                    // with the frame's own size. Setting sizeMode to CUSTOM afterwards
                    // does not restore it, so the authored contentSize is lost — that
                    // is how Progress became 152 wide instead of 252.
                    setIf(s, 'sizeMode', num(p._sizeMode));
                    setIf(s, 'type', num(p._type));
                    const sf = assetOf(p._spriteFrame);
                    if (sf) s.spriteFrame = sf;
                    ctx.renderable = ctx.renderable || s;
                    break;
                }
                case 'cc.Label': {
                    const l = node.addComponent(cc.Label);
                    // 2.x wrote both _string and _N$string; they always agree, _string wins.
                    // When NEITHER is present the 2.x value was the default: an empty
                    // string. It must be written explicitly, because a fresh 3.8 Label
                    // defaults to the literal "label" — which then renders on screen.
                    l.string = typeof p._string === 'string' ? p._string
                        : (typeof p._N$string === 'string' ? p._N$string : '');
                    setIf(l, 'fontSize', num(p._fontSize));
                    setIf(l, 'lineHeight', num(p._lineHeight));
                    setIf(l, 'horizontalAlign', num(p._N$horizontalAlign));
                    setIf(l, 'verticalAlign', num(p._N$verticalAlign));
                    setIf(l, 'overflow', num(p._N$overflow));
                    if (typeof p._isSystemFontUsed === 'boolean') l.useSystemFont = p._isSystemFontUsed;
                    const f = assetOf(p._N$file);
                    if (f) l.font = f;
                    ctx.renderable = ctx.renderable || l;
                    ctx.label = ctx.label || l;
                    break;
                }
                case 'cc.LabelOutline': {
                    // 3.8 deprecated LabelOutline.color/.width in favour of the Label's
                    // own outlineColor/outlineWidth. 2.x always serialised the Label
                    // before its outline, so the Label already exists here.
                    if (ctx.label) {
                        ctx.label.enableOutline = true;
                        setIf(ctx.label, 'outlineWidth', num(p._width));
                        setIf(ctx.label, 'outlineColor', colorOf(p._color));
                    } else {
                        report.warnings.push('cc.LabelOutline on ' + nodeSpec.path + ' has no Label to carry it');
                    }
                    break;
                }
                case 'cc.Widget': {
                    const w = node.addComponent(cc.Widget);
                    setIf(w, 'alignFlags', num(p._alignFlags));
                    setIf(w, 'top', num(p._top));
                    setIf(w, 'bottom', num(p._bottom));
                    setIf(w, 'left', num(p._left));
                    setIf(w, 'right', num(p._right));
                    setIf(w, 'alignMode', num(p.alignMode));
                    break;
                }
                case 'cc.Button': {
                    const b = node.addComponent(cc.Button);
                    setIf(b, 'zoomScale', num(p.zoomScale));
                    setIf(b, 'transition', num(p.transition !== undefined ? p.transition : p._N$transition));
                    const t = p._N$target || p.target;
                    if (t && t.$nodePath) deferred.push({ comp: b, key: 'target', ref: t, where: nodeSpec.path });
                    break;
                }
                case 'cc.Layout': {
                    const L = node.addComponent(cc.Layout);
                    setIf(L, 'type', num(p._N$layoutType));
                    setIf(L, 'resizeMode', num(p._resize));
                    setIf(L, 'spacingX', num(p._N$spacingX));
                    setIf(L, 'spacingY', num(p._N$spacingY));
                    setIf(L, 'paddingLeft', num(p._N$paddingLeft));
                    setIf(L, 'paddingRight', num(p._N$paddingRight));
                    setIf(L, 'paddingTop', num(p._N$paddingTop));
                    setIf(L, 'paddingBottom', num(p._N$paddingBottom));
                    if (p._enabled === false) L.enabled = false;
                    break;
                }
                case 'cc.Mask': node.addComponent(cc.Mask); break;
                case 'cc.BlockInputEvents': node.addComponent(cc.BlockInputEvents); break;
                case 'cc.ScrollView': {
                    const sv = node.addComponent(cc.ScrollView);
                    if (typeof p.horizontal === 'boolean') sv.horizontal = p.horizontal;
                    if (typeof p.vertical === 'boolean') sv.vertical = p.vertical;
                    setIf(sv, 'brake', num(p.brake));
                    setIf(sv, 'bounceDuration', num(p.bounceDuration));
                    const cnt = p._N$content || p.content;
                    if (cnt && cnt.$nodePath) deferred.push({ comp: sv, key: 'content', ref: cnt, where: nodeSpec.path });
                    break;
                }
                case 'sp.Skeleton': {
                    const sk = node.addComponent(cc.sp ? cc.sp.Skeleton : sp.Skeleton);
                    const data = assetOf(p._N$skeletonData);
                    if (data) sk.skeletonData = data;
                    setIf(sk, 'defaultSkin', p.defaultSkin);
                    setIf(sk, 'defaultAnimation', p.defaultAnimation !== undefined ? p.defaultAnimation : p._animationName);
                    if (typeof p.premultipliedAlpha === 'boolean') sk.premultipliedAlpha = p.premultipliedAlpha;
                    break;
                }
                case 'cc.MotionStreak': {
                    const ms = node.addComponent(cc.MotionStreak);
                    setIf(ms, 'fadeTime', num(p._fadeTime));
                    setIf(ms, 'stroke', num(p._stroke));
                    const tex = assetOf(p._texture);
                    if (tex) ms.texture = tex;
                    break;
                }
                case 'cc.ParticleSystem': {
                    // 3.x renamed the 2D particle component.
                    const PS = cc.ParticleSystem2D || cc.ParticleSystem;
                    const ps = node.addComponent(PS);
                    for (const [k, v] of Object.entries(p)) {
                        if (k === '_materials') continue;
                        const key = k.replace(/^_/, '');
                        if (v && v.$color) { setIf(ps, key, colorOf(v)); continue; }
                        if (v && v.$vec2) { setIf(ps, key, vec2Of(v)); continue; }
                        if (v && v.$asset) { setIf(ps, key === 'spriteFrame' ? 'spriteFrame' : key, assetOf(v)); continue; }
                        if (v && typeof v === 'object') continue;
                        setIf(ps, key, v);
                    }
                    break;
                }
                case 'cc.Canvas':
                case 'cc.Camera':
                    // Scene-level infrastructure; the scene builder creates these itself
                    // with 3.x semantics instead of copying 2.x fields that no longer exist.
                    report.warnings.push('skipped scene-infrastructure component ' + c.type + ' on ' + nodeSpec.path + ' (created separately)');
                    break;
                default:
                    report.warnings.push('UNHANDLED component type ' + c.type + ' on ' + nodeSpec.path);
            }
        } catch (e) {
            report.warnings.push('component ' + (c.scriptClassName || c.type) + ' on ' + nodeSpec.path + ' threw: ' + String(e).slice(0, 140));
        }
    }
}

// --- 3. node construction -----------------------------------------------------
const pathIndex = new Map();

function buildNode(spec, parent) {
    const node = new cc.Node(spec.name);
    // new cc.Node() defaults to Layers.Enum.DEFAULT (1 << 30). Every node built here
    // is UI living under a Canvas, and the Canvas camera only renders UI_2D, so a
    // DEFAULT-layer node is culled silently: no error, no warning, nothing drawn.
    // validate_prefab_references does not catch it either — it only checks references.
    node.layer = cc.Layers.Enum.UI_2D;
    parent.addChild(node);

    node.setPosition(spec.position[0], spec.position[1], spec.position[2]);
    if (spec.rotation && (spec.rotation[0] || spec.rotation[1] || spec.rotation[2] || spec.rotation[3] !== 1)) {
        node.setRotation(spec.rotation[0], spec.rotation[1], spec.rotation[2], spec.rotation[3]);
    }
    // 2.4 left scale.z at 0 on many 2D nodes. A zero z degenerates the world matrix,
    // which makes hitTest always fail — buttons stop responding with no error at all.
    let sz = spec.scale[2];
    if (sz === 0) { sz = 1; report.scaleZClamped++; }
    node.setScale(spec.scale[0], spec.scale[1], sz);

    const ui = node.addComponent(cc.UITransform);
    if (spec.contentSize) ui.setContentSize(spec.contentSize[0], spec.contentSize[1]);
    if (spec.anchorPoint) ui.setAnchorPoint(spec.anchorPoint[0], spec.anchorPoint[1]);

    const ctx = { renderable: null, label: null };
    addComponents(node, spec, ctx);

    // Components resize their own node: Sprite does it on spriteFrame assignment,
    // Label on string/overflow. The 2.x file is the authority on contentSize, so
    // re-assert it once every component exists and report anything that fought back.
    if (spec.contentSize) {
        const w = spec.contentSize[0], h = spec.contentSize[1];
        if (Math.abs(ui.width - w) > 0.01 || Math.abs(ui.height - h) > 0.01) {
            report.sizeReasserted = (report.sizeReasserted || 0) + 1;
            ui.setContentSize(w, h);
        }
    }

    // 2.x node.color tinted the node's renderable; 3.x puts color on the component.
    if (spec.color && !(spec.color[0] === 255 && spec.color[1] === 255 && spec.color[2] === 255 && spec.color[3] === 255)) {
        if (ctx.renderable) { ctx.renderable.color = new cc.Color(spec.color[0], spec.color[1], spec.color[2], spec.color[3]); report.colorMoved++; }
        else report.warnings.push('node ' + spec.path + ' has a non-white color but no Sprite/Label to carry it');
    }
    // 2.x node.opacity is a separate component in 3.x.
    if (spec.opacityWasExplicit && spec.opacity !== 255) {
        node.addComponent(cc.UIOpacity).opacity = spec.opacity;
    }

    node.active = spec.active;
    pathIndex.set(spec.path, node);
    for (const ch of spec.children) buildNode(ch, node);

    // 2.x zIndex had no 3.x counterpart: order siblings by it once they all exist.
    return node;
}

function applyZOrder(spec, node) {
    const kids = spec.children;
    if (kids.some((k) => k.zIndex !== 0)) {
        const ordered = kids.slice().sort((a, b) => a.zIndex - b.zIndex);
        ordered.forEach((k, i) => { const n = pathIndex.get(k.path); if (n) n.setSiblingIndex(i); });
    }
    for (const k of kids) { const n = pathIndex.get(k.path); if (n) applyZOrder(k, n); }
}

// --- 4. build --------------------------------------------------------------
// Two modes. Prefab mode builds the dump's prefab root at the scene root.
// Scene mode builds named subtrees under an existing parent, so the caller can
// create the Canvas/Camera with 3.x semantics instead of copying 2.x fields
// (_designResolution / _fitWidth / _clearFlags) that no longer exist.
const scene = cc.director.getScene();

function findSpec(paths) {
    const wanted = new Set(paths);
    const hits = [];
    const visit = (s) => { if (wanted.has(s.path)) hits.push(s); s.children.forEach(visit); };
    for (const r of dump.roots) {
        if (r.tree) visit(r.tree);
        if (r.scene) r.scene.children.forEach(visit);
    }
    return hits;
}

let built;
if (args.subtreePaths) {
    const parent = args.parentUuid
        ? (function find(n) { if (n.uuid === args.parentUuid) return n; for (const c of n.children) { const f = find(c); if (f) return f; } return null; })(scene)
        : scene;
    if (!parent) throw new Error('parentUuid ' + args.parentUuid + ' not found in the open scene');
    const specs = findSpec(args.subtreePaths);
    const missing = args.subtreePaths.filter((p) => !specs.some((s) => s.path === p));
    if (missing.length) throw new Error('subtreePaths not found in dump: ' + missing.join(', '));
    for (const s of specs) { const n = buildNode(s, parent); applyZOrder(s, n); report.built.push({ name: n.name, uuid: n.uuid, nodes: pathIndex.size }); }
    built = null;
} else {
    const roots = dump.roots.filter((r) => r.tree);
    const idx = args.rootIndex === undefined ? 0 : args.rootIndex;
    if (!roots[idx]) throw new Error('dump has no prefab root at index ' + idx + ' (roots: ' + dump.roots.length + ')');
    built = buildNode(roots[idx].tree, scene);
    applyZOrder(roots[idx].tree, built);
}

// --- 4b. assign Prefab-typed @property fields -------------------------------
// UI the 2.x code built with new cc.Node() is authored as a prefab asset now, so the
// component needs a reference to it. args.prefabRefs maps
//   { "<@ccclass name>": { "<property>": "db://.../X.prefab" } }
// Loaded here rather than hard-coded so the mapping stays next to the build call.
if (args.prefabRefs) {
    const urls = new Set();
    for (const props of Object.values(args.prefabRefs)) for (const u of Object.values(props)) urls.add(u);
    const loaded = new Map();
    await Promise.all([...urls].map((url) => new Promise((resolve) => {
        const uuid = Editor.Utils.UUID.getUuidFromURL ? Editor.Utils.UUID.getUuidFromURL(url) : null;
        const done = (err, asset) => {
            if (err || !asset) report.warnings.push('prefabRef load failed: ' + url + ' :: ' + (err ? String(err.message || err).slice(0, 80) : 'null'));
            else loaded.set(url, asset);
            resolve();
        };
        if (uuid) cc.assetManager.loadAny({ uuid }, done);
        else Editor.Message.request('asset-db', 'query-uuid', url).then((u) => (u ? cc.assetManager.loadAny({ uuid: u }, done) : done(new Error('no uuid'), null))).catch((e) => done(e, null));
    })));

    report.prefabRefsAssigned = 0;
    for (const [cls, props] of Object.entries(args.prefabRefs)) {
        const Ctor = cc.js.getClassByName(cls);
        if (!Ctor) { report.warnings.push('prefabRef: class not registered ' + cls); continue; }
        for (const node of pathIndex.values()) {
            const comp = node.getComponent(Ctor);
            if (!comp) continue;
            for (const [prop, url] of Object.entries(props)) {
                const asset = loaded.get(url);
                if (!asset) { report.warnings.push('prefabRef: no asset for ' + url); continue; }
                comp[prop] = asset;
                report.prefabRefsAssigned++;
            }
        }
    }
}

// --- 5. resolve node/component references now that every node exists ---------
for (const d of deferred) {
    try {
        if (d.ref.$nodePath) {
            const target = pathIndex.get(d.ref.$nodePath);
            if (target) d.comp[d.key] = target;
            else report.warnings.push('node ref ' + d.ref.$nodePath + ' not found for ' + d.where + '.' + d.key);
        } else if (d.ref.$componentRef) {
            const owner = d.ref.$ownerPath ? pathIndex.get(d.ref.$ownerPath) : null;
            if (!owner) { report.warnings.push('component ref owner ' + d.ref.$ownerPath + ' not found for ' + d.where + '.' + d.key); continue; }
            const short = String(d.ref.$componentRef).replace(/^cc\./, '');
            const comp = owner.getComponent(cc[short] || short);
            if (comp) d.comp[d.key] = comp;
            else report.warnings.push('component ' + d.ref.$componentRef + ' not on ' + d.ref.$ownerPath + ' for ' + d.where + '.' + d.key);
        }
    } catch (e) {
        report.warnings.push('ref wiring ' + d.where + '.' + d.key + ' threw: ' + String(e).slice(0, 120));
    }
}

if (built) report.built.push({ name: built.name, uuid: built.uuid, nodes: pathIndex.size });
report.deferredRefs = deferred.length;
return report;
