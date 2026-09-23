// Dump a 2.4 .prefab / .fire into a normalized node tree that GĐ3 can rebuild from.
//
// Three things make the raw 2.x JSON unusable as-is:
//   1. It is an object *array* cross-referenced by `__id__`, not a tree.
//   2. Node transforms live in `_trs` (a Float64Array of
//      [px,py,pz, qx,qy,qz,qw, sx,sy,sz]) — not in `_position`/`_scale`.
//   3. Custom components appear as a 2.x *compressed* script uuid in `__type__`,
//      and asset references are 2.x uuids that mean nothing in the 3.x project.
//
// Serialization is sparse: anything equal to the 2.x default is omitted, so the
// defaults below are part of the ground truth, not a guess.

const fs = require('fs');
const path = require('path');

// --- 2.x compressed-uuid decoder --------------------------------------------
// compressUuid keeps the first 5 hex chars, then packs each 3 hex chars into
// 2 base64 chars (27 hex -> 18 base64), giving a 23-char class-id.
const HEX = '0123456789abcdef';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64V = new Array(128).fill(-1);
for (let i = 0; i < 64; i++) B64V[B64.charCodeAt(i)] = i;

function decodeClassId(id) {
  if (typeof id !== 'string' || id.length !== 23) return null;
  let hex = id.slice(0, 5);
  for (let i = 5; i < 23; i += 2) {
    const lhs = B64V[id.charCodeAt(i)];
    const rhs = B64V[id.charCodeAt(i + 1)];
    if (lhs < 0 || rhs < 0) return null;
    hex += HEX[lhs >> 2] + HEX[((lhs & 3) << 2) | (rhs >> 4)] + HEX[rhs & 0xf];
  }
  if (hex.length !== 32) return null;
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

// --- inputs -----------------------------------------------------------------
const FILE = process.argv[2];
const SRC_ASSETS = process.argv[3];
const UUID_MAP = process.argv[4] ? JSON.parse(fs.readFileSync(process.argv[4], 'utf8')).map : {};

// 2.x script uuid -> script file path, so a class-id becomes a readable name
const scriptByUuid = new Map();
(function collectScripts(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collectScripts(p);
    else if (e.name.endsWith('.js.meta')) {
      try {
        const j = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (j.uuid) scriptByUuid.set(j.uuid, path.relative(SRC_ASSETS, p).replace(/\\/g, '/').replace(/\.js\.meta$/, ''));
      } catch (e) { /* unreadable meta is reported by the caller's probe, not here */ }
    }
  }
})(SRC_ASSETS);

const objs = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const deref = (v) => (v && typeof v === 'object' && typeof v.__id__ === 'number' ? objs[v.__id__] : v);

// --- value normalization ----------------------------------------------------
const warnings = [];

function mapUuid(u) {
  if (UUID_MAP[u]) return { uuid2x: u, uuid3x: UUID_MAP[u] };
  return { uuid2x: u, uuid3x: null, unmapped: true };
}

function norm(v, depth = 0) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => norm(x, depth + 1));

  if (typeof v.__uuid__ === 'string') return { $asset: mapUuid(v.__uuid__) };
  if (typeof v.__id__ === 'number') {
    // a reference to another serialized object; keep it symbolic, the tree walk resolves nodes
    return { $ref: v.__id__ };
  }

  const t = v.__type__;
  if (t === 'cc.Size') return { $size: { w: v.width, h: v.height } };
  if (t === 'cc.Vec2') return { $vec2: { x: v.x, y: v.y } };
  if (t === 'cc.Vec3') return { $vec3: { x: v.x, y: v.y, z: v.z } };
  if (t === 'cc.Color') return { $color: { r: v.r, g: v.g, b: v.b, a: v.a === undefined ? 255 : v.a } };
  if (t === 'TypedArray') return { $typed: v.array, ctor: v.ctor };

  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (k === '__type__') continue;
    out[k] = norm(val, depth + 1);
  }
  if (t) out.$type = t;
  return out;
}

// --- component extraction ---------------------------------------------------
function readComponent(raw) {
  const c = deref(raw);
  if (!c) return null;
  const type = c.__type__;
  const decoded = type && !type.startsWith('cc.') && !type.startsWith('sp.') ? decodeClassId(type) : null;
  const scriptPath = decoded ? scriptByUuid.get(decoded) : undefined;

  if (decoded && !scriptPath) warnings.push('class-id ' + type + ' decoded to ' + decoded + ' but no 2.x script meta matches');

  const props = {};
  for (const [k, v] of Object.entries(c)) {
    if (k === '__type__' || k === 'node' || k === '_id' || k === '_name' || k === '_objFlags') continue;
    props[k] = norm(v);
  }
  return {
    type,
    kind: type && (type.startsWith('cc.') || type.startsWith('sp.')) ? 'builtin' : 'script',
    script: scriptPath || null,
    scriptUuid2x: decoded,
    scriptClassName: scriptPath ? scriptPath.split('/').pop() : null,
    props,
  };
}

// --- node tree --------------------------------------------------------------
// 2.4 defaults, applied where the serializer omitted the field.
const DEF = { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1], anchor: [0.5, 0.5], opacity: 255, color: [255, 255, 255, 255], active: true };

function readNode(raw, idPath) {
  const n = deref(raw);
  if (!n || n.__type__ !== 'cc.Node') return null;

  const trs = n._trs && n._trs.array ? n._trs.array : null;
  const node = {
    name: n._name,
    path: idPath,
    active: n._active === undefined ? DEF.active : n._active,
    position: trs ? trs.slice(0, 3) : DEF.position.slice(),
    rotation: trs ? trs.slice(3, 7) : DEF.rotation.slice(),
    scale: trs ? trs.slice(7, 10) : DEF.scale.slice(),
    contentSize: n._contentSize ? [n._contentSize.width, n._contentSize.height] : null,
    anchorPoint: n._anchorPoint ? [n._anchorPoint.x, n._anchorPoint.y] : DEF.anchor.slice(),
    opacity: n._opacity === undefined ? DEF.opacity : n._opacity,
    color: n._color ? [n._color.r, n._color.g, n._color.b, n._color.a === undefined ? 255 : n._color.a] : DEF.color.slice(),
    zIndex: n._zIndex === undefined ? 0 : n._zIndex,
    groupIndex: n.groupIndex === undefined ? 0 : n.groupIndex,
    trsWasExplicit: !!trs,
    contentSizeWasExplicit: !!n._contentSize,
    anchorWasExplicit: !!n._anchorPoint,
    opacityWasExplicit: n._opacity !== undefined,
    components: (n._components || []).map(readComponent).filter(Boolean),
    children: [],
  };
  // 2.4 left scale.z at 0 on many 2D nodes because it was meaningless there. In 3.x a
  // zero z degenerates the world matrix and hitTest silently always returns false, so
  // the builder must clamp it. Flag it here rather than quietly rewriting ground truth.
  if (node.scale[2] === 0) node.scaleZWasZero = true;
  Object.defineProperty(node, '$raw', { value: n, enumerable: false });

  for (const ch of n._children || []) {
    const c = readNode(ch, idPath + '/' + (deref(ch) || {})._name);
    if (c) node.children.push(c);
  }
  return node;
}

// --- reference resolution ---------------------------------------------------
// Components point at nodes with {__id__: n}. Rebuilding needs a *path*, so index
// every serialized cc.Node id to the path the tree walk gave it, then rewrite the
// symbolic {$ref} placeholders. Unresolvable ids are reported, never silently kept.
function indexNodePaths(node, byId) {
  const idx = objs.indexOf(node.$raw);
  if (idx >= 0) byId.set(idx, node.path);
  for (const ch of node.children) indexNodePaths(ch, byId);
}

function resolveRefs(o, byId, stats) {
  if (Array.isArray(o)) return o.forEach((v) => resolveRefs(v, byId, stats));
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object' && typeof v.$ref === 'number') {
      const target = objs[v.$ref];
      if (byId.has(v.$ref)) {
        o[k] = { $nodePath: byId.get(v.$ref) };
        stats.node++;
      } else if (target && typeof target.__type__ === 'string') {
        // a component reference: name the owning node so the builder can find it
        const ownerId = target.node && typeof target.node.__id__ === 'number' ? target.node.__id__ : null;
        o[k] = { $componentRef: target.__type__, $ownerPath: ownerId !== null && byId.has(ownerId) ? byId.get(ownerId) : null, $rawId: v.$ref };
        if (o[k].$ownerPath) stats.component++;
        else { stats.unresolved++; warnings.push('component ref ' + target.__type__ + ' (id ' + v.$ref + ') has no resolvable owner node'); }
      } else {
        stats.unresolved++;
        warnings.push('ref id ' + v.$ref + ' resolves to nothing');
      }
    } else resolveRefs(v, byId, stats);
  }
}

// --- roots ------------------------------------------------------------------
const result = { file: path.basename(FILE), roots: [], warnings };
for (const o of objs) {
  if (o && o.__type__ === 'cc.Prefab' && o.data) {
    const r = readNode(o.data, o._name || 'root');
    if (r) result.roots.push({ prefabName: o._name, tree: r });
  }
  if (o && o.__type__ === 'cc.Scene') {
    const r = readNode({ __id__: objs.indexOf(o) }, o._name || 'Scene');
    // a cc.Scene is itself node-like; fall back to walking its _children directly
    const scene = { sceneName: o._name, children: [] };
    for (const ch of o._children || []) {
      const c = readNode(ch, (o._name || 'Scene') + '/' + (deref(ch) || {})._name);
      if (c) scene.children.push(c);
    }
    result.roots.push({ scene });
  }
}

// resolve node/component references now that every node has a path
const byId = new Map();
for (const r of result.roots) {
  if (r.tree) indexNodePaths(r.tree, byId);
  if (r.scene) for (const ch of r.scene.children) indexNodePaths(ch, byId);
}
const refStats = { node: 0, component: 0, unresolved: 0 };
resolveRefs(result.roots, byId, refStats);
result.refStats = refStats;

// count nodes whose 2.4 scale.z was 0 and will be clamped to 1 at build time
let scaleZFixes = 0;
(function countZ(o) {
  if (Array.isArray(o)) return o.forEach(countZ);
  if (o && typeof o === 'object') {
    if (o.scaleZWasZero) scaleZFixes++;
    Object.values(o).forEach(countZ);
  }
})(result.roots);
result.scaleZFixes = scaleZFixes;

// count unmapped asset refs, the single most likely cause of a broken rebuild
let unmapped = 0;
(function count(o) {
  if (Array.isArray(o)) return o.forEach(count);
  if (o && typeof o === 'object') {
    if (o.$asset && o.$asset.unmapped) unmapped++;
    Object.values(o).forEach(count);
  }
})(result);
result.unmappedAssetRefs = unmapped;

console.log(JSON.stringify(result, null, 2));
