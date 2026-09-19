#!/usr/bin/env node
/**
 * split-bundle-modules.mjs — tách bundle browserify của Cocos 2.x thành từng
 * file module riêng, đọc được, kèm map phụ thuộc.
 *
 * Đây là bước mở khoá cho GĐ2/GĐ3: `cocos-port-class` chỉ fan-out song song được khi
 * mỗi class đã nằm trong MỘT file riêng. Với bundle mức L1 (chỉ minify, tên
 * module còn nguyên) thì bước này gần như là toàn bộ GĐ1 — không cần
 * decode-bundle.mjs, không cần bắt method từ runtime.
 *
 * Bundle Cocos 2.x có dạng:
 *   window.__require = function e(t,i,a){...}({
 *     TênModule: [function(require, module, exports){ ...thân... }, {"./Dep":"Dep"}],
 *     ...
 *   }, {}, ["bootstrap"]);
 *
 *   node split-bundle-modules.mjs --input <bundle.js> --out <thư-mục> [--pretty]
 *
 * Đầu ra:
 *   <out>/modules/<Tên>.js   — thân module, có header ghi dep + uuid script
 *   <out>/module-index.json  — index: tên, kích thước, dep, dependents, uuid, cờ
 *   <out>/dep-graph.json     — đồ thị phụ thuộc thuần (cho việc xếp thứ tự port)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { parse } = require(path.join(here, "node_modules/@babel/parser"));
const generatorMod = require(path.join(here, "node_modules/@babel/generator"));
const generate = generatorMod.default?.default ?? generatorMod.default ?? generatorMod;

// ------------------------------------------------------------------- args ---
const args = process.argv.slice(2);
const getArg = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const input = getArg("--input");
const outDir = getArg("--out");
const pretty = args.includes("--pretty");
if (!input || !outDir) {
  console.error("cần --input <bundle.js> --out <thư-mục>");
  process.exit(2);
}

const src = fs.readFileSync(input, "utf8");
console.log(`đọc ${input} — ${(src.length / 1024 / 1024).toFixed(2)} MB`);

const ast = parse(src, {
  sourceType: "script",
  errorRecovery: true,
  plugins: [],
});

// -------------------------------------------------- tìm object map module ---
// Tìm ObjectExpression lớn nhất mà mọi property đều có value là
// ArrayExpression [FunctionExpression, ObjectExpression] — chữ ký browserify.
let best = null;
function isModuleMap(node) {
  if (node.type !== "ObjectExpression" || node.properties.length < 3) return false;
  let ok = 0;
  for (const p of node.properties) {
    if (p.type !== "ObjectProperty") return false;
    const v = p.value;
    if (
      v?.type === "ArrayExpression" &&
      v.elements.length >= 1 &&
      (v.elements[0]?.type === "FunctionExpression" ||
        v.elements[0]?.type === "ArrowFunctionExpression")
    )
      ok++;
    else return false;
  }
  return ok === node.properties.length;
}
(function walk(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach(walk);
  if (isModuleMap(node)) {
    if (!best || node.properties.length > best.properties.length) best = node;
  }
  for (const k of Object.keys(node)) {
    if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
    walk(node[k]);
  }
})(ast.program);

if (!best) {
  console.error(
    "KHÔNG tìm thấy object map module dạng browserify.\n" +
      "Bundle này có thể dùng webpack hoặc định dạng khác — đừng đoán, xem lại thủ công."
  );
  process.exit(1);
}
console.log(`tìm thấy module map: ${best.properties.length} module`);

// --------------------------------------------------------------- tách file ---
const modulesDir = path.join(outDir, "modules");
fs.mkdirSync(modulesDir, { recursive: true });

const keyName = (p) =>
  p.key.type === "Identifier" ? p.key.name : String(p.key.value);

const index = [];
const graph = {};
let written = 0;

/* macOS/Windows dùng filesystem KHÔNG phân biệt hoa-thường, trong khi Cocos cho
   phép tồn tại song song `Rope` và `rope` như hai module khác nhau. Ghi thẳng
   theo tên module sẽ khiến file sau đè file trước — mất module mà không báo
   lỗi. Phải tự phát hiện và đổi tên. */
const usedLower = new Map(); // tên viết thường → tên module đầu tiên chiếm chỗ
const collisions = [];
function uniqueFileName(name) {
  const safe = name.replace(/[^\w.$-]/g, "_");
  const key = safe.toLowerCase();
  if (!usedLower.has(key)) {
    usedLower.set(key, [name]);
    return { safe, collided: false };
  }
  const group = usedLower.get(key);
  group.push(name);
  const alt = `${safe}-${group.length}`;
  collisions.push({ name, file: `${alt}.js`, clashesWith: group[0] });
  return { safe: alt, collided: true };
}

for (const prop of best.properties) {
  const name = keyName(prop);
  const [fnNode, depNode] = prop.value.elements;

  // thân hàm, không kèm dấu ngoặc của FunctionExpression
  const bodyNodes = fnNode.body.body;
  let body;
  if (bodyNodes.length === 0) {
    body = "";
  } else {
    const start = bodyNodes[0].start;
    const end = bodyNodes[bodyNodes.length - 1].end;
    body = src.slice(start, end);
  }

  if (pretty) {
    try {
      body = generate(fnNode, { comments: true, compact: false }).code;
      body = body.replace(/^function\s*\([^)]*\)\s*\{/, "").replace(/\}\s*$/, "").trim();
    } catch {
      /* giữ bản cắt thô nếu generate lỗi */
    }
  }

  // map phụ thuộc: {"./AIProto": "AIProto", ...}
  const deps = {};
  if (depNode?.type === "ObjectExpression") {
    for (const dp of depNode.properties) {
      if (dp.type !== "ObjectProperty") continue;
      const k = dp.key.type === "Identifier" ? dp.key.name : String(dp.key.value);
      const v = dp.value.type === "StringLiteral" ? dp.value.value : String(dp.value.value ?? "");
      deps[k] = v;
    }
  }

  // uuid script Cocos: cc._RF.push(module, "<uuid>", "<TênFile>")
  const rf = body.match(/_RF\.push\([^,]+,\s*"([^"]+)"\s*,\s*"([^"]+)"/);
  const uuid = rf ? rf[1] : null;
  const scriptName = rf ? rf[2] : null;

  const params = fnNode.params.map((p) => (p.type === "Identifier" ? p.name : "_")).join(", ");
  const depList = Object.entries(deps);

  const header = [
    `/* ==== module: ${name} ====`,
    scriptName && scriptName !== name ? ` * tên file gốc: ${scriptName}` : null,
    uuid ? ` * uuid script : ${uuid}` : null,
    ` * tham số hàm : (${params || "—"})`,
    depList.length
      ? ` * phụ thuộc   : ${depList.map(([k, v]) => `${k} → ${v}`).join(", ")}`
      : " * phụ thuộc   : (không)",
    " * ",
    " * Tách tự động bởi split-bundle-modules.mjs. Thân giữ NGUYÊN VĂN từ bundle,",
    " * không chỉnh sửa — đây là ground truth cho GĐ2/GĐ3.",
    " */",
  ]
    .filter(Boolean)
    .join("\n") + "\n\n"; // hai xuống dòng — filter(Boolean) sẽ nuốt mất "" nếu để trong mảng

  const { safe, collided } = uniqueFileName(name);
  fs.writeFileSync(path.join(modulesDir, `${safe}.js`), header + body + "\n", "utf8");
  written++;

  const depNames = [...new Set(Object.values(deps))];
  graph[name] = depNames;
  index.push({
    name,
    file: `modules/${safe}.js`,
    nameCollision: collided || undefined,
    bytes: body.length,
    uuid,
    scriptName,
    deps: depNames,
    isCocosClass: /cc\.Class\s*\(/.test(body),
    extendsExpr: (body.match(/extends\s*:\s*([^,\n]{1,60})/) || [, null])[1]?.trim() ?? null,
    hasProperties: /properties\s*:/.test(body),
    usesNet: /\bpomelo\b|WebSocket|\bnet\./.test(body),
    usesJsb: /\bjsb\./.test(body),
  });
}

// dependents (ai phụ thuộc vào mình) — dùng để xếp thứ tự port từ lá lên
const dependents = {};
for (const [n, ds] of Object.entries(graph))
  for (const d of ds) (dependents[d] ??= []).push(n);
for (const it of index) it.dependents = dependents[it.name] ?? [];

index.sort((a, b) => b.bytes - a.bytes);
fs.writeFileSync(
  path.join(outDir, "module-index.json"),
  JSON.stringify({ source: input, total: index.length, modules: index }, null, 2)
);
fs.writeFileSync(path.join(outDir, "dep-graph.json"), JSON.stringify(graph, null, 2));

// ------------------------------------------------------------------ tóm tắt ---
const leaves = index.filter((m) => m.deps.length === 0);
const classes = index.filter((m) => m.isCocosClass);
console.log(`\n  đã ghi     : ${written} file → ${modulesDir}`);
if (collisions.length) {
  console.log(
    `\n  ⚠  ${collisions.length} module trùng tên khi bỏ qua hoa/thường — đã đổi tên file để KHÔNG mất module:`
  );
  for (const c of collisions)
    console.log(`     ${c.name}  →  ${c.file}   (đụng với "${c.clashesWith}")`);
  console.log(
    `     Cocos cho phép ${collisions[0].clashesWith} và ${collisions[0].name} cùng tồn tại;`
  );
  console.log(`     filesystem macOS/Windows thì không. Nhớ điều này khi đặt tên file ở GĐ2/GĐ3.`);
}
console.log(`  cc.Class   : ${classes.length}`);
console.log(`  module lá  : ${leaves.length} (không phụ thuộc gì — port trước)`);
console.log(`  chạm net   : ${index.filter((m) => m.usesNet).length}`);
console.log(`  chạm jsb   : ${index.filter((m) => m.usesJsb).length}`);
console.log(`\n  10 module lớn nhất:`);
for (const m of index.slice(0, 10))
  console.log(`    ${String(m.bytes).padStart(7)}  ${m.name}${m.deps.length ? "  ← " + m.deps.length + " dep" : ""}`);
console.log(`\n  → ${path.join(outDir, "module-index.json")}`);
console.log(`  → ${path.join(outDir, "dep-graph.json")}\n`);
