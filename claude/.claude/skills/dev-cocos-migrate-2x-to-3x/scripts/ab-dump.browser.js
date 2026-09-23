// A/B harness — injected into BOTH the 2.4 original and the 3.8 port.
//
// Screenshots miss what actually breaks a port: content size, anchor, alignment,
// colour, sprite frame identity, label overflow. So this dumps the live scene graph
// in ONE normalized shape from both engines, and a node script diffs the two.
//
// It reads through `node.components` and duck-types each component instead of using
// cc.Label / cc.Sprite constructors. That matters: the preview page's `cc` global is a
// DIFFERENT surface from the module instances the game actually runs (cc.UIOpacity and
// cc.TweenSystem are undefined there), so constructor-based lookups silently return
// null and every probe comes back empty.
//
// Defines window.__abDump so the big paste happens once per tab; after that a call is
// just `__abDump()`.
(function () {
    var IS3 = !!(window.cc && cc.ENGINE_VERSION && String(cc.ENGINE_VERSION).charAt(0) === '3');

    function compName(c) {
        // 2.4 names its component constructors cc_Sprite / cc_Label / cc_Mask, while 3.8
        // uses Sprite / Label / Mask. Normalise or every comparison is a false positive.
        try { return (((c && c.constructor && c.constructor.name) || '?')).replace(/^cc_/, ''); } catch (e) { return '?'; }
    }

    function col(c) {
        if (!c) return null;
        return [c.r, c.g, c.b, c.a];
    }

    function frameName(sf) {
        if (!sf) return null;
        // 2.x SpriteFrame has .name; 3.x sub-asset frames are named "spriteFrame", so
        // fall back to the parent texture/image name to keep the two comparable.
        var n = sf.name || (sf._name) || null;
        if (n && n !== 'spriteFrame') return n;
        try {
            var tex = sf.texture || sf._texture;
            var img = tex && (tex.image || tex._image);
            var src = (img && (img.nativeUrl || img._nativeUrl || img.url)) || (tex && tex.nativeUrl);
            if (src) return String(src).split('/').pop().split('?')[0];
        } catch (e) { /* fall through to the raw name */ }
        return n;
    }

    // Per-component fields worth comparing. Anything not listed is identity-only.
    function dumpComp(c) {
        var t = compName(c);
        var o = { t: t };
        if (c.enabled === false) o.off = true;
        try {
            if (t === 'Label') {
                o.str = c.string;
                o.fs = c.fontSize;
                o.lh = c.lineHeight;
                o.hA = c.horizontalAlign;
                o.vA = c.verticalAlign;
                o.ovf = c.overflow;
                o.col = col(c.color);
                if (c.enableOutline || c.outlineWidth) { o.olW = c.outlineWidth; o.olC = col(c.outlineColor); }
            } else if (t === 'LabelOutline') {           // 2.x only
                o.olW = c.width; o.olC = col(c.color);
            } else if (t === 'Sprite') {
                o.frame = frameName(c.spriteFrame);
                o.sizeMode = c.sizeMode;
                o.type = c.type;
                o.col = col(c.color);
            } else if (t === 'Widget') {
                o.flags = c.alignFlags;
                o.t = undefined;
                o.top = c.top; o.bottom = c.bottom; o.left = c.left; o.right = c.right;
                o.t = 'Widget';
            } else if (t === 'Button') {
                o.trans = c.transition; o.zoom = c.zoomScale; o.inter = c.interactable;
            } else if (t === 'Layout') {
                o.lt = c.type; o.rm = c.resizeMode;
                o.sx = c.spacingX; o.sy = c.spacingY;
                o.pL = c.paddingLeft; o.pR = c.paddingRight; o.pT = c.paddingTop; o.pB = c.paddingBottom;
            } else if (t === 'Skeleton') {
                o.anim = c.animation || c._animationName; o.skin = c.defaultSkin; o.loop = c.loop;
            } else if (t === 'UIOpacity') {
                o.op = c.opacity;
            } else if (t === 'ScrollView') {
                o.h = c.horizontal; o.v = c.vertical;
            }
        } catch (e) { o.err = String(e).slice(0, 60); }
        return o;
    }

    function dumpNode(n, path) {
        var comps = [];
        var list = (n.components && n.components.length ? n.components : n._components) || [];
        for (var i = 0; i < list.length; i++) comps.push(dumpComp(list[i]));

        var size = null, anchor = null, opacity = 255, color = null;

        if (IS3) {
            var ui = null, uo = null, render = null;
            for (var j = 0; j < list.length; j++) {
                var cn = compName(list[j]);
                if (cn === 'UITransform') ui = list[j];
                else if (cn === 'UIOpacity') uo = list[j];
                else if ((cn === 'Sprite' || cn === 'Label') && !render) render = list[j];
            }
            if (ui) { size = [ui.width, ui.height]; anchor = [ui.anchorX, ui.anchorY]; }
            if (uo) opacity = uo.opacity;
            // 2.x tinted the NODE; 3.x puts colour on the renderable, so read it back
            // from there to make the two directly comparable.
            if (render) color = col(render.color);
        } else {
            size = [n.width, n.height];
            anchor = [n.anchorX, n.anchorY];
            opacity = n.opacity;
            color = col(n.color);
        }

        var pos = IS3 ? [n.position.x, n.position.y] : [n.x, n.y];
        var scale = IS3 ? [n.scale.x, n.scale.y] : [n.scaleX, n.scaleY];

        var r = {
            p: path,
            n: n.name,
            a: n.active,
            ah: n.activeInHierarchy,
            pos: pos.map(round2),
            size: size ? size.map(round2) : null,
            anc: anchor ? anchor.map(round3) : null,
            sc: scale.map(round3),
            op: opacity,
            col: color,
            c: comps,
            kids: [],
        };

        // Disambiguate duplicate sibling names so paths are unique and diffable.
        var seen = {};
        for (var k = 0; k < n.children.length; k++) {
            var ch = n.children[k];
            var nm = ch.name;
            seen[nm] = (seen[nm] || 0) + 1;
            var suffix = seen[nm] > 1 ? '#' + seen[nm] : '';
            r.kids.push(dumpNode(ch, path + '/' + nm + suffix));
        }
        return r;
    }

    function round2(v) { return typeof v === 'number' ? Math.round(v * 100) / 100 : v; }
    function round3(v) { return typeof v === 'number' ? Math.round(v * 1000) / 1000 : v; }

    window.__abDump = function () {
        var scene = cc.director.getScene();
        var roots = [];
        var skip = { PROFILER_NODE: 1, __SoundRoot__: 1, 'Editor Scene Foreground': 1, 'Editor Scene Background': 1 };
        var seen = {};
        for (var i = 0; i < scene.children.length; i++) {
            var c = scene.children[i];
            if (skip[c.name]) continue;
            seen[c.name] = (seen[c.name] || 0) + 1;
            roots.push(dumpNode(c, c.name + (seen[c.name] > 1 ? '#' + seen[c.name] : '')));
        }
        return { engine: cc.ENGINE_VERSION, is3: IS3, scene: scene.name, roots: roots };
    };

    // Flat label list — the skill's 1-1 string diff, kept separate for a fast check.
    window.__abLabels = function () {
        var out = [];
        (function walk(node, path) {
            var list = (node.components && node.components.length ? node.components : node._components) || [];
            for (var i = 0; i < list.length; i++) {
                if (compName(list[i]) === 'Label') out.push({ p: path, s: list[i].string });
            }
            var seen = {};
            for (var k = 0; k < node.children.length; k++) {
                var ch = node.children[k];
                seen[ch.name] = (seen[ch.name] || 0) + 1;
                walk(ch, path + '/' + ch.name + (seen[ch.name] > 1 ? '#' + seen[ch.name] : ''));
            }
        })(cc.director.getScene(), '');
        return out;
    };

    return 'ab harness installed, engine ' + cc.ENGINE_VERSION + ', is3=' + IS3;
})();
