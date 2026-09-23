// Compare every rebuilt prefab's UITransform.contentSize / anchor against the 2.x
// dump that produced it.
//
// Sibling names repeat all over this project ("Background", "1", "Text"), so both
// sides must disambiguate identically or the comparison silently pairs the wrong
// nodes — that is what made an earlier run look like 21 mismatches.
const fs = require('fs');

// Authored sizes that legitimately differ, with the evidence for each. Anything not
// listed here is a real mismatch.
//
// LoadingOverlay/Label Text — 2.x authors 720x100, the 3.x prefab stores 0x37.8.
//   The Label has overflow NONE and no string, so BOTH engines resize it to fit the
//   empty text as soon as it runs. Measured live on 2.4.14 and 3.8.8 at the same
//   moment: both report contentSize [0, 63] with str "". The authored number never
//   reaches the screen in either engine.
const BENIGN = new Set([
    'LoadingOverlay/Label Text',
]);
let benign = 0;

const NAMES = ['Tips', 'LoadingOverlay', 'Gift', 'GrowUp', 'Rank', 'Setting', 'Revive', 'GetCoin', 'GetItem', 'CoinPig', 'Success', 'Main', 'Level'];

function wantMap(dumpFile, rootRename) {
    const dump = JSON.parse(fs.readFileSync(dumpFile, 'utf8'));
    const root = (dump.roots.find((r) => r.tree) || {}).tree;
    const m = new Map();
    if (!root) return m;
    (function walk(n, path) {
        m.set(path, { size: n.contentSize, anc: n.anchorPoint, name: n.name });
        const seen = {};
        for (const c of n.children) {
            seen[c.name] = (seen[c.name] || 0) + 1;
            walk(c, path + '/' + c.name + (seen[c.name] > 1 ? '#' + seen[c.name] : ''));
        }
    })(root, rootRename);
    return m;
}

function gotMap(prefabFile, rootRename) {
    const j = JSON.parse(fs.readFileSync(prefabFile, 'utf8'));
    const nodes = j.map((o, i) => ({ i, o })).filter((x) => x.o.__type__ === 'cc.Node');
    const byId = new Map(nodes.map((x) => [x.i, x.o]));
    const root = nodes.find((x) => !x.o._parent || !byId.has(x.o._parent.__id__));
    const m = new Map();
    if (!root) return m;
    const kidsOf = (o) => (o._children || []).map((r) => byId.get(r.__id__)).filter(Boolean);
    (function walk(o, path) {
        const comps = (o._components || []).map((c) => j[c.__id__]);
        const ui = comps.find((c) => c && c.__type__ === 'cc.UITransform');
        m.set(path, {
            size: ui && ui._contentSize ? [ui._contentSize.width, ui._contentSize.height] : null,
            anc: ui && ui._anchorPoint ? [ui._anchorPoint.x, ui._anchorPoint.y] : [0.5, 0.5],
            comps: comps.filter(Boolean).map((c) => c.__type__),
        });
        const seen = {};
        for (const c of kidsOf(o)) {
            seen[c._name] = (seen[c._name] || 0) + 1;
            walk(c, path + '/' + c._name + (seen[c._name] > 1 ? '#' + seen[c._name] : ''));
        }
    })(root.o, rootRename);
    return m;
}

let checked = 0, bad = 0, missing = 0;
const rows = [];
for (const name of NAMES) {
    // createPrefabAssetFromNode renames the root after the file, so both sides use
    // the file name as the root segment.
    const want = wantMap('.migration/dump/' + name + '.json', name);
    const got = gotMap('assets/local/prefab/' + name + '.prefab', name);
    for (const [p, w] of want) {
        if (BENIGN.has(p)) { benign++; continue; }
        const g = got.get(p);
        if (!g) { missing++; if (rows.length < 40) rows.push(['NO-NODE', p, JSON.stringify(w.size), '-']); continue; }
        if (!w.size || !g.size) continue;
        checked++;
        if (Math.abs(g.size[0] - w.size[0]) > 0.02 || Math.abs(g.size[1] - w.size[1]) > 0.02) {
            bad++;
            if (rows.length < 40) rows.push(['SIZE', p, JSON.stringify(w.size), JSON.stringify(g.size) + '  comps=' + g.comps.join(',')]);
        }
    }
}
console.log('benign (documented): ' + benign);

// --- authored root transform ------------------------------------------------
// A prefab root carrying the wrong position is invisible to the size check and to
// validate_prefab_references, and 3.8 does NOT re-align a Widget when the node is
// instantiated at runtime the way 2.4 did. LoadingOverlay sat at (375,667) — the
// Canvas position — so the loading screen appeared off in a corner.
//
// The invariant is NOT "match the 2.x authored number". 2.4 authored most of these
// roots at the Canvas offset and relied on its Widget to pull them back to the
// origin; 3.8 may never do that. For a root whose Widget stretches to fill the parent
// (all four edges, zero insets) the only position that is correct WITHOUT a runtime
// re-align is the origin, so that is what we require. Roots without such a Widget are
// still compared against the 2.x authored value.
const fs2 = require('fs');
const STRETCH = 45; // TOP | BOT | LEFT | RIGHT
let rootsChecked = 0, rootsBad = 0;
for (const name of NAMES) {
    const dumpFile = '.migration/dump/' + name + '.json';
    const prefabFile = 'assets/local/prefab/' + name + '.prefab';
    if (!fs2.existsSync(dumpFile) || !fs2.existsSync(prefabFile)) continue;
    const d = JSON.parse(fs2.readFileSync(dumpFile, 'utf8'));
    const tree = (d.roots || []).find((r) => r.tree);
    if (!tree) continue;
    const a = JSON.parse(fs2.readFileSync(prefabFile, 'utf8'));
    const nodes = a.filter((o) => o && o.__type__ === 'cc.Node');
    const root = nodes.find((n) => !n._parent || (a[n._parent.__id__] || {}).__type__ !== 'cc.Node');
    if (!root) continue;
    rootsChecked++;

    const widget = (root._components || [])
        .map((c) => a[c.__id__])
        .find((c) => c && c.__type__ === 'cc.Widget');
    const stretches = !!widget
        && widget._alignFlags === STRETCH
        && !widget._left && !widget._right && !widget._top && !widget._bottom;

    const want = stretches ? [0, 0, 0] : tree.tree.position;
    const got = [root._lpos.x, root._lpos.y, root._lpos.z];
    if (want.some((v, i) => Math.abs(v - got[i]) > 0.01)) {
        rootsBad++;
        console.log('  [ROOT-POS] ' + name + '   expected=' + JSON.stringify(want)
            + (stretches ? ' (stretch widget -> origin)' : ' (2.x authored)')
            + '   got=' + JSON.stringify(got));
    }
}
console.log('prefab root positions checked: ' + rootsChecked + '   mismatched: ' + rootsBad);

console.log('contentSize checked: ' + checked + '   mismatched: ' + bad + '   node-not-found: ' + missing);
for (const r of rows) console.log('  [' + r[0] + '] ' + r[1] + '\n        2.x=' + r[2] + '   3.x=' + r[3]);
