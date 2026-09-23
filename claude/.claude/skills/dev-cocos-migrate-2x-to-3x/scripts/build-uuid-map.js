// Map every 2.x asset uuid to its 3.8 counterpart by matching project-relative paths.
// The 2.x .prefab/.fire files reference assets by uuid; those uuids mean nothing in the
// 3.x project, so every reference has to be translated before a prefab can be rebuilt.
//
// Sub-assets matter most: a 2.x cc.Sprite points at the *sprite-frame* sub-asset uuid,
// which in 3.8 is spelled "<imageUuid>@<subId>".
//
// Builtin engine assets (default UI material, builtin sprite frames) are deliberately
// NOT mapped — 3.8 assigns its own, and forcing a 2.x builtin uuid across would break.

const fs = require('fs');
const path = require('path');

const SRC = process.argv[2]; // 2.x assets dir
const DST = process.argv[3]; // 3.x assets dir
const OUT = process.argv[4];

function walkMeta(dir, base, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkMeta(p, base, out);
    else if (e.name.endsWith('.meta')) out.push(p);
  }
  return out;
}

// relative asset path (no .meta), forward slashes, used as the join key
function keyOf(metaPath, base) {
  return path.relative(base, metaPath).replace(/\\/g, '/').replace(/\.meta$/, '');
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

// --- 2.x side: uuid + subMetas keyed by basename -----------------------------
const src = new Map(); // key -> { uuid, subs: {name: uuid} }
for (const m of walkMeta(SRC, SRC)) {
  const j = readJson(m);
  if (!j || !j.uuid) continue;
  const subs = {};
  for (const [k, v] of Object.entries(j.subMetas || {})) {
    if (v && v.uuid) subs[k] = { uuid: v.uuid, importer: v.importer };
  }
  src.set(keyOf(m, SRC), { uuid: j.uuid, type: j.type, importer: j.importer, subs });
}

// --- 3.x side: uuid + subMetas keyed by generated id, carrying `name` --------
const dst = new Map(); // key -> { uuid, subs: [{id, name, importer, uuid}] }
for (const m of walkMeta(DST, DST)) {
  const j = readJson(m);
  if (!j || !j.uuid) continue;
  const subs = [];
  for (const [id, v] of Object.entries(j.subMetas || {})) {
    if (v && v.uuid) subs.push({ id, name: v.name, importer: v.importer, uuid: v.uuid });
  }
  dst.set(keyOf(m, DST), { uuid: j.uuid, type: (j.userData || {}).type, importer: j.importer, subs });
}

// --- engine builtins --------------------------------------------------------
// Three 2.x uuids in the prefabs point at engine builtins, not project assets.
// Identified by reading the 2.x project's own library/imports cache, not guessed:
//
//   a23235d1-... = cc.SpriteFrame "default_sprite_splash" (a 2x2 white quad).
//       14 Sprites use it as a solid tinted rectangle, so it MUST be mapped or
//       those 14 backdrops render blank.
//   eca5d2f2-... = cc.Material "builtin-2d-sprite"  (397 uses)
//   7afd064b-... = cc.Material "builtin-2d-spine"   (8 uses, the spine skeletons)
//       Both are left unmapped ON PURPOSE: 3.8 assigns its own default material
//       when the component is created, and forcing a 2.x material uuid across
//       would break rendering.
const BUILTIN_OVERRIDES = {
  'a23235d1-15db-4b95-8439-a2e005bfff91': '7d8f9b89-4fd1-4c9f-a3ab-38ec7cded7ca@f9941',
};
const BUILTIN_IGNORED = {
  'eca5d2f2-8ef6-41c2-bbe6-f9c79d09c432': 'cc.Material builtin-2d-sprite (3.8 assigns its own)',
  '7afd064b-113f-480e-b793-8817d19f63c3': 'cc.Material builtin-2d-spine (3.8 assigns its own)',
};

// --- join -------------------------------------------------------------------
const map = {};            // 2.x uuid -> 3.x uuid
const detail = [];         // human-readable audit rows
const unmatched2x = [];    // 2.x assets with no 3.x counterpart

for (const [key, s] of src) {
  // Scripts changed extension in the port (.js -> .ts), so the path key needs the swap.
  const d = dst.get(key) || (key.endsWith('.js') ? dst.get(key.replace(/\.js$/, '.ts')) : undefined);
  if (!d) { unmatched2x.push(key); continue; }

  map[s.uuid] = d.uuid;
  detail.push({ key, kind: 'main', from: s.uuid, to: d.uuid, importer2x: s.importer, importer3x: d.importer });

  // sub-assets: a 2.x sprite-frame sub-asset maps to the 3.x sub-asset named "spriteFrame"
  for (const [subKey, sub] of Object.entries(s.subs)) {
    let target = null;
    if (sub.importer === 'sprite-frame') {
      target = d.subs.find((x) => x.importer === 'sprite-frame' || x.name === 'spriteFrame');
    } else if (sub.importer === 'texture') {
      target = d.subs.find((x) => x.importer === 'texture' || x.name === 'texture');
    } else {
      target = d.subs.find((x) => x.name === subKey) || d.subs.find((x) => x.importer === sub.importer);
    }
    if (target) {
      map[sub.uuid] = target.uuid;
      detail.push({ key: key + ' :: ' + subKey, kind: 'sub', from: sub.uuid, to: target.uuid, importer2x: sub.importer, importer3x: target.importer });
    } else {
      unmatched2x.push(key + ' :: ' + subKey + ' (sub, importer=' + sub.importer + ')');
    }
  }
}

for (const [from, to] of Object.entries(BUILTIN_OVERRIDES)) {
  map[from] = to;
  detail.push({ key: 'ENGINE BUILTIN', kind: 'builtin', from, to });
}

fs.writeFileSync(OUT, JSON.stringify({ map, detail, unmatched2x, builtinIgnored: BUILTIN_IGNORED }, null, 2));
console.log('builtin overrides   : ' + Object.keys(BUILTIN_OVERRIDES).length);
console.log('builtin ignored     : ' + Object.keys(BUILTIN_IGNORED).length + ' (materials — 3.8 assigns its own)');

console.log('2.x assets with meta : ' + src.size);
console.log('3.x assets with meta : ' + dst.size);
console.log('uuid pairs mapped    : ' + Object.keys(map).length);
console.log('  main               : ' + detail.filter((d) => d.kind === 'main').length);
console.log('  sub                : ' + detail.filter((d) => d.kind === 'sub').length);
console.log('unmatched 2.x        : ' + unmatched2x.length);
if (unmatched2x.length) {
  console.log('\n-- unmatched (expected: scripts/scenes/prefabs not yet rebuilt) --');
  for (const u of unmatched2x.slice(0, 40)) console.log('  ' + u);
  if (unmatched2x.length > 40) console.log('  ... +' + (unmatched2x.length - 40) + ' more');
}
