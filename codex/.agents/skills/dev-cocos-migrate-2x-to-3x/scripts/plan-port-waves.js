#!/usr/bin/env node
/**
 * plan-port-waves.js — order the 2.x scripts into dependency waves.
 *
 * The port runs through ONE agent per wave, not one agent per class. To batch
 * safely the caller needs the dependency order: a class must be ported after
 * the classes it requires, otherwise its export style (`default` vs named) is a
 * guess and a wrong guess breaks every importer.
 *
 *   node plan-port-waves.js <project-root|layout.json> [options]
 *
 *     --root <dir>        limit to one script root (repeatable)
 *     --max-files <n>     files per wave           (default 20, 0 = no limit)
 *     --max-lines <n>     source lines per wave    (default 2500, 0 = no limit)
 *     --include-vendor    put lib/vendor files in the waves too
 *     --json              machine-readable output
 *
 * Reads only `.js` files. Requires are resolved by relative path first, then by
 * basename — 2.x projects commonly flatten and require by file name.
 *
 * Exit 0 = a plan was produced (cycles are reported, not fatal).
 * Exit 1 = no script files found.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set([
  'library', 'temp', 'build', 'node_modules', '.git', 'profiles',
  '.better-context', '.serena', '.codegraph', '.beads', '.agent-temp',
]);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function listJs(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) listJs(full, out);
    } else if (entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

const REQUIRE_RE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * What kind of module this is — it decides how it must be ported.
 * `vendor` is the important one: a third-party library is COPIED, never ported.
 */
function classify(id, text) {
  if (/(^|\/)(lib|libs|vendor|third[-_]?party|node_modules)\//i.test(id)) return 'vendor';
  if (/cc\.Class\s*\(/.test(text)) return 'component';
  if (/cc\.Component|_decorator|ccclass/.test(text)) return 'component';
  if (/cc\.Enum\s*\(/.test(text)) return 'enum';
  if (/module\.exports\s*=|exports\.[A-Za-z_$][\w$]*\s*=/.test(text)) return 'module';
  return 'script';
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const includeVendor = argv.includes('--include-vendor');
  const num = (flag, dflt) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? Number(argv[i + 1]) : dflt;
  };
  const maxFiles = num('--max-files', 20);
  const maxLines = num('--max-lines', 2500);
  const rootFlags = argv.reduce((acc, a, i) => (a === '--root' ? [...acc, argv[i + 1]] : acc), []);
  const positional = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--root'
    && argv[i - 1] !== '--max-files' && argv[i - 1] !== '--max-lines');
  const target = path.resolve(positional || '.');

  // A layout.json from probe-cocos-layout.js carries the script roots already.
  let projectRoot = target;
  let roots = rootFlags;
  if (target.endsWith('.json')) {
    const layout = readJson(target);
    if (!layout) {
      console.error(`plan-port-waves: cannot read ${target}`);
      process.exit(1);
    }
    projectRoot = path.resolve(layout.root);
    if (!roots.length) roots = (layout.scriptRoots || []).map((r) => r.dir);
  }
  if (!roots.length) roots = ['assets'];

  const files = [];
  for (const r of roots) {
    for (const f of listJs(path.resolve(projectRoot, r))) {
      if (!files.includes(f)) files.push(f);
    }
  }
  if (!files.length) {
    console.error(`plan-port-waves: no .js files under ${roots.join(', ')}`);
    process.exit(1);
  }

  const byPath = new Map();
  const byBase = new Map();
  const nodes = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const id = path.relative(projectRoot, file).split(path.sep).join('/');
    const base = path.basename(file, '.js');
    const node = {
      id,
      base,
      lines: text.split('\n').length,
      kind: classify(id, text),
      requires: [],
      rawRequires: [...text.matchAll(REQUIRE_RE)].map((m) => m[1]),
      dir: path.dirname(file),
    };
    nodes.push(node);
    byPath.set(id, node);
    if (!byBase.has(base)) byBase.set(base, node);
  }

  const external = new Set();
  for (const node of nodes) {
    for (const spec of node.rawRequires) {
      let dep = null;
      if (spec.startsWith('.')) {
        const resolved = path.resolve(node.dir, spec);
        const id = path.relative(projectRoot, resolved).split(path.sep).join('/');
        dep = byPath.get(id) || byPath.get(id + '.js') || byBase.get(path.basename(spec, '.js'));
      } else {
        dep = byBase.get(path.basename(spec, '.js'));
      }
      if (dep && dep !== node) node.requires.push(dep.id);
      else if (!dep) external.add(spec);
    }
    node.requires = [...new Set(node.requires)];
    delete node.rawRequires;
  }

  // Kahn layering; whatever is left when nothing is ready is a cycle.
  const remaining = new Map(nodes.map((n) => [n.id, new Set(n.requires)]));
  const done = new Set();
  const layers = [];
  const cycles = [];
  while (remaining.size) {
    let ready = [...remaining.keys()].filter((id) => [...remaining.get(id)].every((d) => done.has(d)));
    if (!ready.length) {
      ready = [...remaining.keys()];
      cycles.push(ready.slice());
    }
    ready.sort((a, b) => byPath.get(a).lines - byPath.get(b).lines);
    layers.push(ready);
    for (const id of ready) {
      remaining.delete(id);
      done.add(id);
    }
  }

  // One flat list in dependency order, then chunked into agent-sized waves.
  // A wave may span several layers: one agent ports its files IN THE LISTED
  // ORDER, so crossing a layer boundary inside a wave is safe.
  const ordered = layers.flat().filter((id) => includeVendor || byPath.get(id).kind !== 'vendor');
  const vendor = layers.flat().filter((id) => !includeVendor && byPath.get(id).kind === 'vendor');
  const waves = [];
  let wave = [];
  let lines = 0;
  for (const id of ordered) {
    const node = byPath.get(id);
    const full = (maxFiles > 0 && wave.length >= maxFiles) || (maxLines > 0 && lines + node.lines > maxLines);
    if (wave.length && full) {
      waves.push(wave);
      wave = [];
      lines = 0;
    }
    wave.push(id);
    lines += node.lines;
  }
  if (wave.length) waves.push(wave);

  const plan = waves.map((ids, i) => ({
    wave: i + 1,
    lines: ids.reduce((s, id) => s + byPath.get(id).lines, 0),
    files: ids.map((id) => ({ id, kind: byPath.get(id).kind, lines: byPath.get(id).lines, requires: byPath.get(id).requires })),
  }));

  if (asJson) {
    console.log(JSON.stringify({ root: projectRoot.split(path.sep).join('/'), roots, waves: plan, vendor, cycles, external: [...external] }, null, 2));
    return;
  }

  console.log(`# Port waves — ${files.length} files in ${roots.length} root(s), ${plan.length} wave(s)\n`);
  console.log('Dispatch ONE agent per wave, in this order. Files inside a wave have no');
  console.log('dependency on each other, so one agent can port them in any order.\n');
  for (const w of plan) {
    console.log(`## Wave ${w.wave} — ${w.files.length} files, ${w.lines} lines`);
    for (const f of w.files) console.log(`   ${f.kind.padEnd(9)} ${f.id}${f.requires.length ? `  ← ${f.requires.length} dep` : ''}`);
    console.log('');
  }
  if (vendor.length) {
    console.log(`Vendor / library files (${vendor.length}) — COPY these, do not port:`);
    for (const id of vendor) console.log(`   ${id}  (${byPath.get(id).lines} lines)`);
    console.log('');
  }
  if (cycles.length) {
    console.log('CYCLES (ported together in one wave, expect to fix imports by hand):');
    for (const c of cycles) console.log(`   ${c.join(', ')}`);
    console.log('');
  }
  if (external.size) {
    console.log(`External / unresolved requires (${external.size}): ${[...external].slice(0, 20).join(', ')}`);
  }
}

main();
