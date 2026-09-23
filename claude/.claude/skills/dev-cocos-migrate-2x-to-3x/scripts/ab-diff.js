// Diff two __abDump() captures (2.4 original vs 3.8 port) and report every real
// difference, ranked so the ones that change what a player sees come first.
//
// Tolerances exist because the two engines round differently; they are deliberately
// tight enough that a genuine layout shift still shows up.
const fs = require('fs');

const A = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); // 2.x original
const B = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')); // 3.x port

const POS_EPS = 0.5;
const SIZE_EPS = 0.5;
const SCALE_EPS = 0.005;

const findings = [];
function add(sev, path, what, a, b) {
    findings.push({ sev, path, what, a, b });
}

function flatten(dump) {
    const map = new Map();
    const walk = (n) => { map.set(n.p, n); n.kids.forEach(walk); };
    (dump.roots || []).forEach(walk);
    return map;
}

const ma = flatten(A);
const mb = flatten(B);

// --- structure ---------------------------------------------------------------
for (const p of ma.keys()) if (!mb.has(p)) add('MISSING', p, 'node exists in 2.x, absent in 3.x', 'present', 'absent');
for (const p of mb.keys()) if (!ma.has(p)) add('EXTRA', p, 'node exists in 3.x, absent in 2.x', 'absent', 'present');

const near = (x, y, eps) => typeof x === 'number' && typeof y === 'number' && Math.abs(x - y) <= eps;
const pairEq = (x, y, eps) => (!x && !y) || (x && y && near(x[0], y[0], eps) && near(x[1], y[1], eps));
const colEq = (x, y) => (!x && !y) || (x && y && x[0] === y[0] && x[1] === y[1] && x[2] === y[2] && x[3] === y[3]);

// --- per-node ----------------------------------------------------------------
for (const [p, a] of ma) {
    const b = mb.get(p);
    if (!b) continue;

    if (a.ah !== b.ah) add('VISIBLE', p, 'activeInHierarchy', a.ah, b.ah);
    else if (a.a !== b.a) add('STATE', p, 'active', a.a, b.a);

    if (!pairEq(a.pos, b.pos, POS_EPS)) add('LAYOUT', p, 'position', a.pos, b.pos);
    if (!pairEq(a.size, b.size, SIZE_EPS)) add('LAYOUT', p, 'contentSize', a.size, b.size);
    if (!pairEq(a.anc, b.anc, 0.001)) add('LAYOUT', p, 'anchor', a.anc, b.anc);
    if (!pairEq(a.sc, b.sc, SCALE_EPS)) add('LAYOUT', p, 'scale', a.sc, b.sc);
    if (a.op !== b.op) add('VISUAL', p, 'opacity', a.op, b.op);
    // 2.x tints through node.color; 3.x removed it and the tint lives on the
    // renderable component. Comparing the raw fields reports every single node twice
    // — once as "2.x has a colour, 3.x null" and once as the mirror image. Only a
    // node-level colour present on BOTH sides is a real difference.
    if (a.col && b.col && !colEq(a.col, b.col)) add('VISUAL', p, 'color', a.col, b.col);

    // components, matched by type in order of appearance
    const ta = a.c.map((c) => c.t);
    const tb = b.c.map((c) => c.t);
    // 2.x LabelOutline became Label.outlineWidth/outlineColor in 3.8 — expected.
    // The 2.x build is minified, so every project script reports as "e"/"t" while 3.x
    // reports the real class name. Comparing those verbatim flags every scripted node.
    // Engine types are still compared by name; project scripts only by "a script is
    // here", which is all the 2.x side can tell us.
    const ENGINE = new Set(['Sprite', 'Label', 'Widget', 'Button', 'Layout', 'Mask', 'BlockInputEvents',
        'ScrollView', 'Skeleton', 'MotionStreak', 'ParticleSystem2D', 'Camera', 'Canvas', 'Graphics',
        'RichText', 'EditBox', 'ProgressBar', 'Animation', 'AudioSource', 'PageView', 'Toggle', 'Slider']);
    const norm = (list) => list
        .filter((t) => t !== 'UITransform' && t !== 'UIOpacity' && t !== 'LabelOutline')
        .map((t) => (ENGINE.has(t) ? t : 'script'));
    const na = norm(ta), nb = norm(tb);
    if (na.join(',') !== nb.join(',')) add('COMPONENT', p, 'component set', na.join(','), nb.join(','));

    for (const ca of a.c) {
        const cb = b.c.find((x) => x.t === ca.t);
        if (!cb) continue;
        for (const k of Object.keys(ca)) {
            if (k === 't') continue;
            const va = ca[k], vb = cb[k];
            if (k === 'col' || k === 'olC') {
                // Same shape change as above, seen from the component side: resolve
                // each side to the tint that actually reaches the screen.
                const ea = k === 'col' ? (va || a.col) : va;
                const eb = k === 'col' ? (vb || b.col) : vb;
                if (!colEq(ea, eb)) add('VISUAL', p, ca.t + '.' + k, ea, eb);
                continue;
            }
            if (typeof va === 'number' && typeof vb === 'number') {
                if (!near(va, vb, 0.5)) add(k === 'str' ? 'TEXT' : 'COMPONENT', p, ca.t + '.' + k, va, vb);
                continue;
            }
            if (JSON.stringify(va) !== JSON.stringify(vb)) {
                add(k === 'str' ? 'TEXT' : (k === 'frame' ? 'VISUAL' : 'COMPONENT'), p, ca.t + '.' + k, va, vb);
            }
        }
    }

    // 2.x LabelOutline -> 3.8 Label outline: compare across the shape change
    const oa = a.c.find((c) => c.t === 'LabelOutline');
    const lb = b.c.find((c) => c.t === 'Label');
    if (oa && lb) {
        if (!near(oa.olW, lb.olW, 0.01)) add('VISUAL', p, 'outline width (2.x LabelOutline -> 3.x Label)', oa.olW, lb.olW);
        if (!colEq(oa.olC, lb.olC)) add('VISUAL', p, 'outline color (2.x LabelOutline -> 3.x Label)', oa.olC, lb.olC);
    }
}

// --- report ------------------------------------------------------------------
const ORDER = ['MISSING', 'EXTRA', 'VISIBLE', 'TEXT', 'VISUAL', 'LAYOUT', 'COMPONENT', 'STATE'];
findings.sort((x, y) => ORDER.indexOf(x.sev) - ORDER.indexOf(y.sev) || x.path.localeCompare(y.path));

const bySev = {};
for (const f of findings) bySev[f.sev] = (bySev[f.sev] || 0) + 1;

console.log('2.x engine ' + A.engine + '  nodes ' + ma.size);
console.log('3.x engine ' + B.engine + '  nodes ' + mb.size);
console.log('\nfindings by severity:');
for (const s of ORDER) if (bySev[s]) console.log('  ' + String(bySev[s]).padStart(4) + '  ' + s);
console.log('  ' + String(findings.length).padStart(4) + '  TOTAL');

const limit = Number(process.argv[4] || 60);
console.log('\n--- first ' + limit + ' ---');
for (const f of findings.slice(0, limit)) {
    console.log('[' + f.sev + '] ' + f.path);
    console.log('        ' + f.what + ':  2.x=' + JSON.stringify(f.a) + '   3.x=' + JSON.stringify(f.b));
}
if (findings.length > limit) console.log('... +' + (findings.length - limit) + ' more');

fs.writeFileSync(process.argv[5] || '.migration/ab-findings.json', JSON.stringify(findings, null, 1));
