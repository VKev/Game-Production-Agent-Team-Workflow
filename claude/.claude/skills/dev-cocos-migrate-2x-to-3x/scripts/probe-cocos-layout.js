#!/usr/bin/env node
/**
 * probe-cocos-layout.js — print the folder contract of ONE Cocos project.
 *
 * Every Cocos project puts its scripts, resources and bundles somewhere
 * different (`assets/Script`, `assets/scripts`, `assets/src`, a bundle folder,
 * …). Nothing downstream may hardcode those paths: run this first, then use the
 * values it reports.
 *
 *   node probe-cocos-layout.js <project-root> [--json] [--out <file>]
 *
 * Works on both lines: a 2.x source project (root `project.json`, `.fire`
 * scenes) and a 3.x target project (root `package.json` with
 * `creator.version`, `.scene` scenes). Read-only, no dependencies.
 *
 * Exit 0 = a layout was resolved (warnings may still be present).
 * Exit 1 = not a Cocos project root, or `assets/` is missing.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set([
  'library', 'temp', 'build', 'node_modules', '.git', 'profiles', '.creator',
  '.better-context', '.serena', '.codegraph', '.beads', '.agent-temp',
]);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function rel(root, p) {
  return path.relative(root, p).split(path.sep).join('/');
}

/** Creator line + version, from whichever manifest the project actually has. */
function detectEngine(root) {
  const pkg = readJson(path.join(root, 'package.json'));
  const version = pkg && pkg.creator && pkg.creator.version;
  if (version) {
    return { line: version.startsWith('2.') ? '2.x' : '3.x', version, detectedFrom: 'package.json' };
  }
  const proj = readJson(path.join(root, 'project.json'));
  if (proj) {
    const v = proj.version || (proj.engine && proj.engine.version) || null;
    return {
      line: v && !v.startsWith('2.') ? '3.x' : '2.x',
      version: v,
      detectedFrom: 'project.json',
    };
  }
  return null;
}

/** One pass over assets/: per-directory file counts, scenes, prefabs. */
function walkAssets(assetsRoot) {
  const dirs = new Map();
  const scenes = [];
  const prefabs = [];
  const stack = [assetsRoot];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    const counts = { ts: 0, js: 0, json: 0, png: 0, other: 0 };
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) stack.push(full);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.meta') continue;
      if (ext === '.ts' && !entry.name.endsWith('.d.ts')) counts.ts++;
      else if (ext === '.js') counts.js++;
      else if (ext === '.json') counts.json++;
      else if (ext === '.png' || ext === '.jpg' || ext === '.webp') counts.png++;
      else counts.other++;
      if (ext === '.fire' || ext === '.scene') scenes.push(full);
      if (ext === '.prefab') prefabs.push(full);
    }
    dirs.set(dir, counts);
  }
  return { dirs, scenes, prefabs };
}

/**
 * Script roots, ranked. A "root" is the shallowest directory whose subtree
 * holds code; subdirectories of a reported root are not reported again.
 */
function scriptRoots(root, dirs) {
  const totals = new Map();
  for (const [dir, counts] of dirs) {
    const code = counts.ts + counts.js;
    if (!code) continue;
    for (let cur = dir; ; cur = path.dirname(cur)) {
      const acc = totals.get(cur) || { ts: 0, js: 0 };
      acc.ts += counts.ts;
      acc.js += counts.js;
      totals.set(cur, acc);
      if (rel(root, cur) === 'assets' || cur === path.dirname(cur)) break;
    }
  }
  const candidates = [];
  for (const [dir, acc] of totals) {
    const r = rel(root, dir);
    if (r === 'assets' || r === '') continue;
    candidates.push({ dir: r, ts: acc.ts, js: acc.js, code: acc.ts + acc.js });
  }
  candidates.sort((a, b) => b.code - a.code || a.dir.length - b.dir.length);
  const kept = [];
  for (const c of candidates) {
    if (kept.some((k) => c.dir.startsWith(k.dir + '/'))) continue;
    kept.push(c);
  }
  return kept;
}

/** Bundle / subpackage folders, read from the folder's own `.meta`. */
function bundleDirs(root, dirs) {
  const out = [];
  for (const dir of dirs.keys()) {
    const meta = readJson(dir + '.meta');
    const info = meta && (meta.userData || meta);
    if (!info) continue;
    const kind = info.isBundle ? 'bundle' : info.isSubpackage ? 'subpackage' : null;
    if (!kind) continue;
    out.push({
      dir: rel(root, dir),
      kind,
      name: info.bundleName || info.subpackageName || path.basename(dir),
      priority: info.priority,
      compressionType: info.compressionType,
    });
  }
  return out.sort((a, b) => a.dir.localeCompare(b.dir));
}

/** Design resolution + start scene, from whichever settings file exists. */
function projectSettings(root, line) {
  if (line === '2.x') {
    const file = path.join(root, 'settings', 'project.json');
    const s = readJson(file);
    if (!s) return null;
    return {
      source: 'settings/project.json',
      width: s['design-resolution-width'],
      height: s['design-resolution-height'],
      fitWidth: s['fit-width'],
      fitHeight: s['fit-height'],
      startScene: s['start-scene'],
    };
  }
  const file = path.join(root, 'settings', 'v2', 'packages', 'project.json');
  const s = readJson(file);
  const dr = s && s.general && s.general.designResolution;
  const builder = readJson(path.join(root, 'settings', 'v2', 'packages', 'builder.json'));
  const configs = (builder && builder.configs) || {};
  const startScene = Object.values(configs)
    .map((c) => c && c.startScene)
    .find(Boolean);
  if (!dr && !startScene) return null;
  return {
    source: 'settings/v2/packages/project.json',
    width: dr && dr.width,
    height: dr && dr.height,
    fitWidth: dr && dr.fitWidth,
    fitHeight: dr && dr.fitHeight,
    startScene: startScene || null,
  };
}

/** Where the mandatory runtime layer already lives, if it does. */
function runtimeLayer(root, dirs) {
  const wanted = ['ApiMock', 'FakeAds', 'MobileAdapter'];
  const found = {};
  for (const dir of dirs.keys()) {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const base = path.basename(name, path.extname(name));
      if (wanted.includes(base) && /\.(ts|js)$/.test(name)) {
        found[base] = rel(root, path.join(dir, name));
      }
    }
  }
  return found;
}

function probe(root) {
  const warnings = [];
  const engine = detectEngine(root);
  if (!engine) {
    return { error: `no package.json with creator.version and no project.json in ${root}` };
  }
  const assetsRoot = ['assets', 'Assets'].map((d) => path.join(root, d)).find(isDir);
  if (!assetsRoot) return { error: `no assets/ directory under ${root}` };

  const { dirs, scenes, prefabs } = walkAssets(assetsRoot);
  const roots = scriptRoots(root, dirs);
  const bundles = bundleDirs(root, dirs);
  const settings = projectSettings(root, engine.line);
  const resources = [...dirs.keys()]
    .filter((d) => path.basename(d).toLowerCase() === 'resources')
    .map((d) => rel(root, d));

  const sceneExt = engine.line === '2.x' ? '.fire' : '.scene';
  const sceneFiles = scenes.filter((s) => s.toLowerCase().endsWith(sceneExt));
  const foreignScenes = scenes.length - sceneFiles.length;

  if (!roots.length) warnings.push('no script directory found under assets/ — nothing to port');
  if (roots.length > 1) {
    warnings.push(
      `code lives in ${roots.length} roots: ${roots.map((r) => r.dir).join(', ')} — mirror that split in the 3.x project instead of collapsing it, and check which roots are bundles`,
    );
  }
  if (!resources.length) {
    warnings.push('no resources/ directory — a runtime `resources.load(path)` will fail until one exists');
  }
  if (!settings) warnings.push('design resolution not found in settings/ — read it from the running 2.x build instead');
  else if (engine.line === '2.x' && settings.fitWidth && settings.fitHeight) {
    warnings.push('2.x project has BOTH fit-width and fit-height — classic letterbox bug, decide one policy for 3.x');
  }
  if (engine.line === '3.x' && !settings?.startScene) {
    warnings.push('no startScene in builder config — the builder will fall back to scene index 0 (pitfalls.md §6)');
  }
  if (foreignScenes) {
    warnings.push(`${foreignScenes} scene file(s) of the other Creator line are present under assets/`);
  }

  const buildRoot = path.join(root, 'build');
  const buildOutputs = isDir(buildRoot)
    ? fs.readdirSync(buildRoot).filter((d) => isDir(path.join(buildRoot, d))).map((d) => `build/${d}`)
    : [];
  const templatesRoot = path.join(root, 'build-templates');
  const buildTemplates = isDir(templatesRoot)
    ? fs.readdirSync(templatesRoot).filter((d) => isDir(path.join(templatesRoot, d))).map((d) => `build-templates/${d}`)
    : [];
  const extensionsDir = ['extensions', 'packages'].find((d) => isDir(path.join(root, d))) || null;

  return {
    root: root.split(path.sep).join('/'),
    engine,
    assetsRoot: rel(root, assetsRoot),
    scriptRoots: roots,
    resourcesDirs: resources,
    bundleDirs: bundles,
    sceneExt,
    scenes: sceneFiles.map((s) => rel(root, s)),
    prefabCount: prefabs.length,
    settings,
    runtimeLayer: runtimeLayer(root, dirs),
    extensionsDir,
    buildTemplates,
    buildOutputs,
    warnings,
  };
}

function printHuman(layout) {
  const rows = [
    ['engine', `Creator ${layout.engine.line}${layout.engine.version ? ` (${layout.engine.version})` : ''} via ${layout.engine.detectedFrom}`],
    ['<assets-root>', layout.assetsRoot],
    ['<script-root>', layout.scriptRoots.length ? layout.scriptRoots[0].dir : '(none)'],
    ['<resources-root>', layout.resourcesDirs[0] || '(none)'],
    ['<extensions-dir>', layout.extensionsDir || '(none)'],
    ['<build-dir>', layout.buildOutputs[0] || '(no build yet)'],
    ['scene ext', layout.sceneExt],
    ['scenes', String(layout.scenes.length)],
    ['prefabs', String(layout.prefabCount)],
  ];
  const width = Math.max(...rows.map((r) => r[0].length));
  console.log(`# Cocos project layout — ${layout.root}\n`);
  for (const [k, v] of rows) console.log(`  ${k.padEnd(width)}  ${v}`);

  if (layout.scriptRoots.length > 1) {
    console.log('\n  script roots (ranked by file count):');
    for (const r of layout.scriptRoots) console.log(`    ${r.dir}  (${r.ts} ts, ${r.js} js)`);
  }
  if (layout.bundleDirs.length) {
    console.log('\n  bundles / subpackages:');
    for (const b of layout.bundleDirs) {
      const compression =
        b.compressionType && typeof b.compressionType === 'object'
          ? Object.entries(b.compressionType).map(([k, v]) => `${k}=${v}`).join(' ')
          : b.compressionType;
      const extra = [b.priority != null ? `priority ${b.priority}` : '', compression ? `compression ${compression}` : '']
        .filter(Boolean)
        .join(', ');
      console.log(`    ${b.dir}  [${b.kind}] ${b.name}${extra ? ` (${extra})` : ''}`);
    }
  }
  if (layout.settings) {
    const s = layout.settings;
    console.log(
      `\n  design resolution: ${s.width}x${s.height}` +
        ` (fitWidth=${s.fitWidth}, fitHeight=${s.fitHeight}) from ${s.source}`,
    );
    if (s.startScene) console.log(`  start scene: ${s.startScene}`);
  }
  const layer = Object.entries(layout.runtimeLayer);
  console.log('\n  runtime layer:');
  if (layer.length) for (const [k, v] of layer) console.log(`    ${k}: ${v}`);
  else console.log('    (none yet — copy the templates into <script-root>)');

  if (layout.warnings.length) {
    console.log('\n  WARNINGS:');
    for (const w of layout.warnings) console.log(`    ! ${w}`);
  }
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const outIndex = argv.indexOf('--out');
  const outFile = outIndex >= 0 ? argv[outIndex + 1] : null;
  const skip = outIndex >= 0 ? outIndex + 1 : -1;
  const positional = argv.filter((a, i) => !a.startsWith('--') && i !== skip);
  const root = path.resolve(positional[0] || '.');

  const layout = probe(root);
  if (layout.error) {
    console.error(`probe-cocos-layout: ${layout.error}`);
    process.exit(1);
  }
  if (outFile) {
    fs.writeFileSync(outFile, JSON.stringify(layout, null, 2) + '\n');
    console.error(`probe-cocos-layout: wrote ${outFile}`);
  }
  if (asJson) console.log(JSON.stringify(layout, null, 2));
  else printHuman(layout);
}

main();
