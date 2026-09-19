#!/usr/bin/env node
/**
 * split-runtime-api.mjs — tách kết quả của runtime-api-export.js thành file
 * tiện tra cứu cho giai đoạn tái dựng.
 *
 *   node split-runtime-api.mjs --input runtime-api.json --out analysis-output
 *
 * Sinh ra:
 *   <out>/runtime-methods/<Class>.json        thân method thô, mỗi class 1 file
 *                                             (đầu vào cho decode-methods.mjs)
 *   <out>/runtime-class-summary.json          class → danh sách method + số method bắt được
 *   <out>/runtime-scene-component-state.json  MỌI component trong scene + giá trị
 *                                             property THẬT lúc chạy (ground truth
 *                                             khi dựng lại prefab ở GĐ4)
 */
import fs from 'node:fs';
import path from 'node:path';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const inputPath = arg('input');
const outRoot = arg('out', '.');
if (!inputPath) {
  console.error('cần --input <runtime-api.json> [--out <dir>]');
  process.exit(2);
}

const api = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const methodsRoot = path.join(outRoot, 'runtime-methods');
fs.mkdirSync(methodsRoot, { recursive: true });

const classSummary = {};
for (const [name, record] of Object.entries(api.classes || {})) {
  const sources = record.sources || {};
  classSummary[name] = {
    resolvedName: record.resolvedName,
    methodCount: Object.keys(record.methods || {}).length,
    methods: Object.keys(record.methods || {}),
    capturedSourceCount: Object.keys(sources).length,
    capturedSources: Object.keys(sources),
  };
  if (Object.keys(sources).length) {
    fs.writeFileSync(path.join(methodsRoot, `${name}.json`), `${JSON.stringify(sources, null, 2)}\n`);
  }
}

const sceneComponents = (api.sceneComponents || []).map((entry) => ({
  node: entry.node,
  type: entry.type,
  state: entry.state || {},
}));

fs.writeFileSync(path.join(outRoot, 'runtime-class-summary.json'),
  `${JSON.stringify(classSummary, null, 2)}\n`);
fs.writeFileSync(path.join(outRoot, 'runtime-scene-component-state.json'),
  `${JSON.stringify(sceneComponents, null, 2)}\n`);

const withSource = Object.values(classSummary).filter((e) => e.capturedSourceCount).length;
console.log(JSON.stringify({
  engineVersion: api.engineVersion,
  designResolution: api.designResolution,
  classes: Object.keys(api.classes || {}).length,
  classesWithSource: withSource,
  sceneComponents: sceneComponents.length,
}, null, 2));

if (!withSource) {
  console.error('\nKhông bắt được thân method nào. Kiểm tra: export có chạy khi game ĐANG chạy '
    + 'không (không phải lúc màn hình loading), và class có nằm trong danh sách quét không.');
}
