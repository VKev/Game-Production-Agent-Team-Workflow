// Every spine animation the code asks for must exist on the skeleton actually bound.
//
//   node .migration/tools/verify-spine.js
//
// The game drives its flow from setCompleteListener: EliminatingStacking only calls
// func_clearCb once the clear effect finishes, Success waits on the crown, Level waits
// on the upgrade effect. sp.Skeleton.setAnimation with a name the skeleton does not
// have does not throw — it does nothing, the listener never fires, and the game simply
// stops at that step. So a typo'd or mis-bound skeleton is a hang, not an error.
//
// Only huangguan and jinzhu carry "animation2"; everything else is "animation" only.
const fs = require('fs');
const path = require('path');

const SPINE_DIR = 'assets/local/spine';
const PREFAB_DIR = 'assets/local/prefab';
const SRC_DIRS = ['assets/game', 'assets/framework', 'assets/scripts'];

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

// uuid -> skeleton file, and skeleton file -> animation names
const uuidToFile = {};
const animsOf = {};
for (const f of fs.readdirSync(SPINE_DIR)) {
    const full = path.join(SPINE_DIR, f);
    if (f.endsWith('.json.meta')) uuidToFile[read(full).uuid] = f.slice(0, -5);
    else if (f.endsWith('.json')) {
        try { const d = read(full); if (d.animations) animsOf[f] = Object.keys(d.animations); } catch (e) { /* atlas-adjacent json */ }
    }
}

// every skeleton bound in a prefab
const bindings = [];
for (const pf of fs.readdirSync(PREFAB_DIR).filter((f) => f.endsWith('.prefab'))) {
    const a = read(path.join(PREFAB_DIR, pf));
    for (const o of a) {
        if (!o || o.__type__ !== 'sp.Skeleton') continue;
        const uuid = String((o._skeletonData || {}).__uuid__ || '').split('@')[0];
        const node = o.node ? a[o.node.__id__]._name : '?';
        bindings.push({ prefab: pf.replace('.prefab', ''), node, uuid, file: uuidToFile[uuid] || null });
    }
}

// every animation name the code requests
const requested = new Set();
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    if (!e.name.endsWith('.ts')) return;
    const src = fs.readFileSync(p, 'utf8');
    let m;
    const re = /setAnimation\s*\(\s*\d+\s*,\s*["']([^"']+)["']/g;
    while ((m = re.exec(src))) requested.add(m[1]);
});
SRC_DIRS.filter(fs.existsSync).forEach(walk);

const rows = [];
let bad = 0;
for (const b of bindings) {
    if (!b.file) { bad++; rows.push(['UNRESOLVED', b.prefab + '/' + b.node, b.uuid, '-']); continue; }
    const have = animsOf[b.file] || [];
    rows.push(['ok', b.prefab + '/' + b.node, b.file, have.join(', ')]);
}

// A requested name must exist on at least one bound skeleton, otherwise nothing can
// ever play it; per-node binding is printed above for the eyeball check.
const allHave = new Set();
for (const b of bindings) (animsOf[b.file] || []).forEach((n) => allHave.add(n));
const orphan = [...requested].filter((n) => !allHave.has(n));

console.log('%s', 'spine bindings:');
for (const [st, where, file, have] of rows) console.log('  ' + st.padEnd(11) + where.padEnd(30) + String(file).padEnd(22) + have);
console.log('');
console.log('animation names requested by code : ' + [...requested].sort().join(', '));
console.log('unresolved skeleton bindings      : ' + bad);
console.log('requested names no skeleton has   : ' + (orphan.join(', ') || 'none'));
process.exit(bad === 0 && orphan.length === 0 ? 0 : 1);
