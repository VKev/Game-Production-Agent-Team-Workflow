// Census every __type__ used across the 2.x .prefab / .fire files.
// A `cc.*` value is a built-in component; anything else is a compressed script
// class-id and needs a 2.x-script-uuid -> 3.x-script-uuid translation.
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
const counts = new Map();
const perFile = new Map();

function walkDir(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walkDir(p, out);
    else if (/\.(prefab|fire|scene)$/.test(e.name)) out.push(p);
  }
  return out;
}

function walk(o, bag) {
  if (Array.isArray(o)) { for (const v of o) walk(v, bag); return; }
  if (o && typeof o === 'object') {
    if (typeof o.__type__ === 'string') {
      counts.set(o.__type__, (counts.get(o.__type__) || 0) + 1);
      bag.add(o.__type__);
    }
    for (const v of Object.values(o)) walk(v, bag);
  }
}

for (const f of walkDir(ROOT)) {
  const bag = new Set();
  walk(JSON.parse(fs.readFileSync(f, 'utf8')), bag);
  perFile.set(path.relative(ROOT, f).replace(/\\/g, '/'), bag);
}

const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
console.log('--- built-in (cc.*) ---');
for (const [t, n] of rows) if (t.startsWith('cc.')) console.log(String(n).padStart(5) + '  ' + t);
console.log('\n--- NON cc.* (script class-ids -> need uuid translation) ---');
const custom = rows.filter(([t]) => !t.startsWith('cc.'));
if (!custom.length) console.log('  (none)');
for (const [t, n] of custom) {
  console.log(String(n).padStart(5) + '  ' + t);
  for (const [f, bag] of perFile) if (bag.has(t)) console.log('         in ' + f);
}
