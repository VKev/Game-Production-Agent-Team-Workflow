#!/usr/bin/env node
/**
 * decode-bundle.mjs — giải obfuscation kiểu string-table / number-table trong
 * bundle Cocos 2.x đã build, trả về JS đọc được.
 *
 * Cách hoạt động: dùng Babel đánh giá TĨNH mọi MemberExpression computed
 * (`ft[123]`, `fw[7]`, hoặc alias trỏ tới bảng) mà cả object lẫn property đều
 * truy được về hằng, rồi thay bằng literal. Chỉ thay khi biết CHẮC giá trị nên
 * không làm sai logic.
 *
 *   node decode-bundle.mjs --input game.js --strings string-table.json \
 *        [--numbers number-table.json] [--string-ident ft] [--number-ident fw] \
 *        --output game.readable.js
 *
 * Cần: npm i @babel/parser @babel/traverse @babel/generator @babel/types
 *
 * Cách lấy bảng: tìm mảng chuỗi lớn nhất trong bundle (thường là khai báo đầu
 * file, `var ft=["...","..."]`), cắt ra rồi JSON.stringify về file riêng.
 */
import fs from 'node:fs';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const inputPath = arg('input');
const outputPath = arg('output');
const stringsPath = arg('strings');
const numbersPath = arg('numbers');
const stringIdent = arg('string-ident', 'ft');
const numberIdent = arg('number-ident', 'fw');

if (!inputPath || !outputPath) {
  console.error('cần --input <bundle.js> --output <readable.js> [--strings t.json] [--numbers n.json]');
  process.exit(2);
}

const tables = new Map();
if (stringsPath) tables.set(stringIdent, JSON.parse(fs.readFileSync(stringsPath, 'utf8')));
if (numbersPath) tables.set(numberIdent, JSON.parse(fs.readFileSync(numbersPath, 'utf8')));
if (!tables.size) console.error('cảnh báo: không có bảng nào — script sẽ chỉ gấp hằng số đơn giản');

/** Truy một node về giá trị hằng, đi xuyên qua binding const nếu cần. */
function evaluate(nodePath, seen = new Set()) {
  if (!nodePath?.node) return { known: false };
  if (nodePath.isStringLiteral() || nodePath.isNumericLiteral() || nodePath.isBooleanLiteral()) {
    return { known: true, value: nodePath.node.value };
  }
  if (nodePath.isNullLiteral()) return { known: true, value: null };

  if (nodePath.isIdentifier()) {
    const name = nodePath.node.name;
    if (tables.has(name)) return { known: true, value: tables.get(name) };
    // alias: var a = ft;  → đi theo binding const
    const binding = nodePath.scope.getBinding(name);
    if (!binding || !binding.constant || seen.has(binding) || !binding.path.isVariableDeclarator()) {
      return { known: false };
    }
    seen.add(binding);
    const value = evaluate(binding.path.get('init'), seen);
    seen.delete(binding);
    return value;
  }

  if (nodePath.isMemberExpression() && nodePath.node.computed) {
    const object = evaluate(nodePath.get('object'), seen);
    const property = evaluate(nodePath.get('property'), seen);
    if (!object.known || !property.known || object.value == null) return { known: false };
    const value = object.value[property.value];
    const ok = typeof value === 'string' || typeof value === 'number'
      || typeof value === 'boolean' || value === null || Array.isArray(value);
    if (ok) return { known: true, value };
  }
  return { known: false };
}

function literal(value) {
  if (typeof value === 'string') return t.stringLiteral(value);
  if (typeof value === 'number' && Number.isFinite(value)) return t.numericLiteral(value);
  if (typeof value === 'boolean') return t.booleanLiteral(value);
  if (value === null) return t.nullLiteral();
  return null; // mảng/object: không inline, để nguyên
}

const ast = parse(fs.readFileSync(inputPath, 'utf8'), {
  sourceType: 'script',
  allowReturnOutsideFunction: true,
});

let replacements = 0;
traverse(ast, {
  MemberExpression: {
    exit(nodePath) {
      const result = evaluate(nodePath);
      if (!result.known) return;
      const replacement = literal(result.value);
      if (!replacement) return;
      nodePath.replaceWith(replacement);
      replacements += 1;
    },
  },
});

fs.writeFileSync(outputPath, `${generate(ast, { comments: false, compact: false }).code}\n`);
console.log(JSON.stringify({ output: outputPath, replacements }, null, 2));

if (replacements === 0) {
  console.error('\n0 thay thế — nhiều khả năng bundle dùng obfuscator KHÁC '
    + '(control-flow flattening / string encryption có key runtime).\n'
    + 'Chuyển sang nguồn runtime: xem phase-1-recon.md §4.');
  process.exit(1);
}
