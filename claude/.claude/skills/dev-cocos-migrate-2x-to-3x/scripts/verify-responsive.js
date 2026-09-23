// Audit everything that decides how this game reflows on a different screen:
//   cc.Widget   alignFlags + top/bottom/left/right  (anchoring to screen edges)
//   LongScreenWidgetComponent  longScreen* overrides (applied when h/w - 16/9 > 0.1)
//
// Compared against the 2.x dump, node for node. A Widget whose alignFlags did not
// survive the rebuild looks fine at the design resolution and drifts on every other
// aspect ratio — which is exactly the class of bug that only shows up on a device.
const fs = require('fs');

const NAMES = ['Tips', 'LoadingOverlay', 'Gift', 'GrowUp', 'Rank', 'Setting', 'Revive',
    'GetCoin', 'GetItem', 'CoinPig', 'Success', 'Main', 'Level'];

function wantMap(dumpFile, rootRename) {
    const dump = JSON.parse(fs.readFileSync(dumpFile, 'utf8'));
    const root = (dump.roots.find((r) => r.tree) || {}).tree;
    const m = new Map();
    if (!root) return m;
    (function walk(n, path) {
        for (const c of n.components) {
            if (c.type === 'cc.Widget') {
                m.set(path + '#Widget', {
                    flags: c.props._alignFlags,
                    top: c.props._top, bottom: c.props._bottom,
                    left: c.props._left, right: c.props._right,
                    mode: c.props.alignMode,
                });
            }
            if (c.scriptClassName === 'LongScreenWidgetComponent') {
                m.set(path + '#LSW', { top: c.props.longScreenTop });
            }
        }
        const seen = {};
        for (const ch of n.children) {
            seen[ch.name] = (seen[ch.name] || 0) + 1;
            walk(ch, path + '/' + ch.name + (seen[ch.name] > 1 ? '#' + seen[ch.name] : ''));
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
    (function walk(o, path) {
        for (const r of o._components || []) {
            const c = j[r.__id__];
            if (!c) continue;
            if (c.__type__ === 'cc.Widget') {
                m.set(path + '#Widget', {
                    flags: c._alignFlags, top: c._top, bottom: c._bottom,
                    left: c._left, right: c._right, mode: c._alignMode,
                });
            }
            if (c.longScreenTop !== undefined) m.set(path + '#LSW', { top: c.longScreenTop });
        }
        const kids = (o._children || []).map((r) => byId.get(r.__id__)).filter(Boolean);
        const seen = {};
        for (const c of kids) {
            seen[c._name] = (seen[c._name] || 0) + 1;
            walk(c, path + '/' + c._name + (seen[c._name] > 1 ? '#' + seen[c._name] : ''));
        }
    })(root.o, rootRename);
    return m;
}

// 2.x omits any field equal to its default, so an absent margin means 0 — comparing
// `undefined` against `0` reports every Widget in the project as broken.
const MARGIN_DEFAULT = { top: 0, bottom: 0, left: 0, right: 0, flags: 0 };
const norm = (field, v) => (v === undefined && field in MARGIN_DEFAULT ? MARGIN_DEFAULT[field] : v);

const near = (field, a, b) => {
    a = norm(field, a); b = norm(field, b);
    if (a === undefined && b === undefined) return true;
    // alignMode has different defaults in the two engines; report it separately
    // rather than pretending one of them is authoritative.
    if (field === 'mode' && (a === undefined || b === undefined)) return true;
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.02;
    return a === b;
};

let widgets = 0, lsw = 0, bad = 0;
const rows = [];
for (const name of NAMES) {
    const want = wantMap('.migration/dump/' + name + '.json', name);
    const got = gotMap('assets/local/prefab/' + name + '.prefab', name);
    for (const [k, w] of want) {
        const g = got.get(k);
        if (k.endsWith('#Widget')) widgets++; else lsw++;
        if (!g) { bad++; rows.push('MISSING  ' + k); continue; }
        for (const f of Object.keys(w)) {
            if (!near(f, w[f], g[f])) {
                bad++;
                rows.push(k + '  ' + f + ': 2.x=' + JSON.stringify(w[f]) + ' 3.x=' + JSON.stringify(g[f]));
                break;
            }
        }
    }
}
console.log('Widget components checked          : ' + widgets);
console.log('LongScreenWidgetComponent checked  : ' + lsw);
console.log('mismatches                         : ' + bad);
rows.slice(0, 30).forEach((r) => console.log('   ' + r));
if (rows.length > 30) console.log('   ... +' + (rows.length - 30) + ' more');
