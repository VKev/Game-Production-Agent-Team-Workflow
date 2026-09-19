#!/usr/bin/env node
/**
 * decode-methods.mjs — giải string-table trong THÂN METHOD bắt được từ runtime
 * (`Function.prototype.toString()`), xuất ra file .js đọc được theo từng class.
 *
 *   node decode-methods.mjs --in runtime-methods --out runtime-methods-decoded \
 *        --strings string-table.json [--numbers number-table.json] \
 *        [--globals globals.json]
 *
 * --in   : thư mục chứa <Class>.json dạng { "tênMethod": "function(...){...}" }
 *          (sinh bởi split-runtime-api.mjs)
 * --out  : thư mục ra, mỗi class một .json (đã giải) + một .js đọc được
 * --globals: map alias 2 ký tự → chuỗi thật, vd {"QE":"x","IR":"y"}.
 *          Đây là các hằng string-table đã bị hoist ra biến toàn cục nên không
 *          truy ngược tĩnh được; phải tra bằng ngữ cảnh rồi khai báo ở đây.
 *          Bổ sung dần trong quá trình làm — mỗi alias giải được là hàng chục
 *          chỗ trong output sạch thêm.
 *
 * Cần: npm i @babel/parser @babel/traverse @babel/generator @babel/types
 */
import fs from 'node:fs';
import path from 'node:path';
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

const inputDir = arg('in');
const outputDir = arg('out');
const stringsPath = arg('strings');
const numbersPath = arg('numbers');
const globalsPath = arg('globals');
const stringIdent = arg('string-ident', 'ft');
const numberIdent = arg('number-ident', 'fw');

if (!inputDir || !outputDir) {
  console.error('cần --in <dir> --out <dir> [--strings t.json] [--numbers n.json] [--globals g.json]');
  process.exit(2);
}

const tables = new Map();
if (stringsPath) tables.set(stringIdent, JSON.parse(fs.readFileSync(stringsPath, 'utf8')));
if (numbersPath) tables.set(numberIdent, JSON.parse(fs.readFileSync(numbersPath, 'utf8')));
const knownGlobals = new Map(Object.entries(
  globalsPath ? JSON.parse(fs.readFileSync(globalsPath, 'utf8')) : {},
));

fs.mkdirSync(outputDir, { recursive: true });

function evaluateStatic(nodePath, seen = new Set()) {
  if (!nodePath?.node) return { known: false };
  if (nodePath.isStringLiteral() || nodePath.isNumericLiteral() || nodePath.isBooleanLiteral()) {
    return { known: true, value: nodePath.node.value };
  }
  if (nodePath.isNullLiteral()) return { known: true, value: null };

  if (nodePath.isIdentifier()) {
    const name = nodePath.node.name;
    if (tables.has(name)) return { known: true, value: tables.get(name) };
    if (knownGlobals.has(name)) return { known: true, value: knownGlobals.get(name) };
    const binding = nodePath.scope.getBinding(name);
    if (!binding || !binding.constant || seen.has(binding) || !binding.path.isVariableDeclarator()) {
      return { known: false };
    }
    seen.add(binding);
    const value = evaluateStatic(binding.path.get('init'), seen);
    seen.delete(binding);
    return value;
  }

  if (nodePath.isMemberExpression() && nodePath.node.computed) {
    const object = evaluateStatic(nodePath.get('object'), seen);
    const property = evaluateStatic(nodePath.get('property'), seen);
    if (!object.known || !property.known || object.value == null) return { known: false };
    const value = object.value[property.value];
    const ok = typeof value === 'string' || typeof value === 'number'
      || typeof value === 'boolean' || value === null || Array.isArray(value);
    if (ok) return { known: true, value };
  }
  return { known: false };
}

function literalFor(value) {
  if (typeof value === 'string') return t.stringLiteral(value);
  if (typeof value === 'number' && Number.isFinite(value)) return t.numericLiteral(value);
  if (typeof value === 'boolean') return t.booleanLiteral(value);
  if (value === null) return t.nullLiteral();
  return null;
}

function decodeFunction(source) {
  const ast = parse(`(${source})`, { sourceType: 'script', allowReturnOutsideFunction: true });
  let replacements = 0;
  traverse(ast, {
    MemberExpression: {
      exit(nodePath) {
        const evaluated = evaluateStatic(nodePath);
        if (!evaluated.known) return;
        const lit = literalFor(evaluated.value);
        if (!lit) return;
        nodePath.replaceWith(lit);
        replacements += 1;
      },
    },
    // alias toàn cục đứng một mình (không nằm trong member expression)
    Identifier: {
      exit(nodePath) {
        if (!nodePath.isReferencedIdentifier()) return;
        if (!knownGlobals.has(nodePath.node.name)) return;
        if (nodePath.scope.getBinding(nodePath.node.name)) return; // có binding cục bộ → không đụng
        nodePath.replaceWith(literalFor(knownGlobals.get(nodePath.node.name)));
        replacements += 1;
      },
    },
  });
  return {
    code: generate(ast.program.body[0].expression, { comments: false, compact: false }).code,
    replacements,
  };
}

const manifest = {};
const files = fs.readdirSync(inputDir).filter((n) => n.endsWith('.json')).sort();
for (const file of files) {
  const className = path.basename(file, '.json');
  const methods = JSON.parse(fs.readFileSync(path.join(inputDir, file), 'utf8'));
  const decoded = {};
  let replacementCount = 0;
  for (const [method, source] of Object.entries(methods)) {
    try {
      const result = decodeFunction(source);
      decoded[method] = result.code;
      replacementCount += result.replacements;
    } catch (err) {
      decoded[method] = `// PARSE FAILED: ${err.message}\n${source}`;
    }
  }
  fs.writeFileSync(path.join(outputDir, `${className}.json`), `${JSON.stringify(decoded, null, 2)}\n`);
  fs.writeFileSync(
    path.join(outputDir, `${className}.js`),
    Object.entries(decoded).map(([m, code]) => `// ${className}.${m}\n${code}\n`).join('\n'),
  );
  manifest[className] = { methods: Object.keys(decoded).length, replacements: replacementCount };
}
fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
