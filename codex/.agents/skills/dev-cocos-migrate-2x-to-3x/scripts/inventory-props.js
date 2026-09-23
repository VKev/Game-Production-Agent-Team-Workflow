// Inventory every component type and every property name that actually appears in
// the 2.x dumps. This is the complete mapping surface the prefab builder must handle;
// anything not listed here cannot show up at build time.
const fs = require('fs');

const DUMP = process.argv[2];
const byType = new Map(); // type -> Map(prop -> {count, sampleValues:Set})

function note(type, prop, value) {
  if (!byType.has(type)) byType.set(type, new Map());
  const m = byType.get(type);
  if (!m.has(prop)) m.set(prop, { count: 0, samples: new Set() });
  const e = m.get(prop);
  e.count++;
  if (e.samples.size < 4) {
    let s = JSON.stringify(value);
    if (s && s.length > 90) s = s.slice(0, 90) + '…';
    e.samples.add(s);
  }
}

function walkNode(n, file) {
  note('@node', 'name', n.name);
  for (const k of ['active', 'contentSize', 'anchorPoint', 'opacity', 'color', 'zIndex', 'groupIndex']) {
    // only record what the 2.x serializer actually wrote, so defaults are not mistaken for data
    const explicit = { contentSize: n.contentSizeWasExplicit, anchorPoint: n.anchorWasExplicit, opacity: n.opacityWasExplicit }[k];
    if (explicit === false) continue;
    if (k === 'active' && n.active === true) continue;
    if (k === 'zIndex' && n.zIndex === 0) continue;
    if (k === 'groupIndex' && n.groupIndex === 0) continue;
    if (k === 'color' && JSON.stringify(n.color) === '[255,255,255,255]') continue;
    note('@node', k, n[k]);
  }
  if (n.trsWasExplicit) {
    note('@node', 'position', n.position);
    if (JSON.stringify(n.rotation) !== '[0,0,0,1]') note('@node', 'rotation', n.rotation);
    if (JSON.stringify(n.scale) !== '[1,1,1]') note('@node', 'scale', n.scale);
  }
  for (const c of n.components || []) {
    const t = c.kind === 'script' ? 'SCRIPT:' + (c.scriptClassName || c.type) : c.type;
    note(t, '@instances', file);
    for (const [k, v] of Object.entries(c.props || {})) note(t, k, v);
  }
  for (const ch of n.children || []) walkNode(ch, file);
}

for (const f of fs.readdirSync(DUMP).filter((x) => x.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(DUMP + '/' + f, 'utf8'));
  for (const r of d.roots || []) {
    if (r.tree) walkNode(r.tree, f);
    if (r.scene) for (const ch of r.scene.children) walkNode(ch, f);
  }
}

const order = [...byType.entries()].sort((a, b) => (b[1].get('@instances') ? b[1].get('@instances').count : 0) - (a[1].get('@instances') ? a[1].get('@instances').count : 0));
for (const [type, props] of order) {
  const inst = props.get('@instances');
  console.log('\n### ' + type + (inst ? '   (' + inst.count + ' instances)' : ''));
  for (const [p, e] of [...props.entries()].sort((a, b) => b[1].count - a[1].count)) {
    if (p === '@instances') continue;
    console.log('   ' + String(e.count).padStart(4) + '  ' + p.padEnd(26) + ' ' + [...e.samples].join(' | '));
  }
}
