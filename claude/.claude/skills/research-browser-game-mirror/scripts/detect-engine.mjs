#!/usr/bin/env node
// Nhận dạng engine từ live-network.json (đã capture, không tải thêm gì).
// Cổng vào của batch: chỉ game NHẬN DIỆN ĐƯỢC LÀ COCOS mới được đi tiếp.
// Exit 0 = cocos (đi tiếp) · 3 = engine khác · 4 = không nhận ra · 1 = lỗi input.
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);

function valueAfter(name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
}

function required(name) {
  const value = valueAfter(name);
  if (!value) throw new Error(`Missing required argument: ${name}`);
  return value;
}

// Cùng schema mà verify-runtime.mjs của skill đơn chấp nhận: array thô, {requests},
// {entries}, hoặc HAR.
function networkUrls(parsed) {
  if (Array.isArray(parsed)) return parsed.map((entry) => entry.url).filter(Boolean);
  if (Array.isArray(parsed.requests)) return parsed.requests.map((entry) => entry.url).filter(Boolean);
  if (Array.isArray(parsed.entries)) return parsed.entries.map((entry) => entry.url).filter(Boolean);
  if (Array.isArray(parsed.log?.entries)) {
    return parsed.log.entries.map((entry) => entry.request?.url).filter(Boolean);
  }
  throw new Error("Unsupported network JSON schema.");
}

const SIGNATURES = [
  // ---- Cocos Creator 3.x ----
  { engine: "cocos-3.x", family: "cocos", weight: 3, label: "cocos-js/cc.js", re: /\/cocos-js\/[^/]*\.(js|wasm)/i },
  { engine: "cocos-3.x", family: "cocos", weight: 3, label: "assets/*/config.<hash>.json", re: /\/assets\/[^/]+\/config\.[0-9a-z]+\.json/i },
  { engine: "cocos-3.x", family: "cocos", weight: 2, label: "src/import-map.json", re: /\/src\/import-map\.json/i },
  { engine: "cocos-3.x", family: "cocos", weight: 2, label: "system.bundle/application.js", re: /\/(system(\.bundle)?|application)\.js(\?|$)/i },
  { engine: "cocos-3.x", family: "cocos", weight: 2, label: "chunks/*bundle*", re: /\/chunks\/[^/]*bundle/i },
  // ---- Cocos Creator 2.x ----
  { engine: "cocos-2.x", family: "cocos", weight: 3, label: "cocos2d-js.js", re: /cocos2d-js(-min)?\.[0-9a-z]*\.?js/i },
  { engine: "cocos-2.x", family: "cocos", weight: 3, label: "res/import|res/raw-assets", re: /\/res\/(import|raw-assets)\//i },
  { engine: "cocos-2.x", family: "cocos", weight: 2, label: "src/settings|src/project", re: /\/src\/(settings|project)\.[0-9a-z]*\.?js/i },
  // ---- Cocos, không rõ version ----
  { engine: "cocos", family: "cocos", weight: 2, label: "assets/*/import|native", re: /\/assets\/[^/]+\/(import|native)\//i },
  { engine: "cocos", family: "cocos", weight: 2, label: "assets/internal", re: /\/assets\/internal\//i },
  // ---- engine khác ----
  { engine: "unity-webgl", family: "other", weight: 3, label: "Unity Build/*", re: /\.unityweb(\?|$)|UnityLoader\.js|\/Build\/[^/]+\.(data|wasm|framework\.js)/i },
  { engine: "laya", family: "other", weight: 3, label: "laya.core", re: /laya\.(core|min|ui)[^/]*\.js/i },
  { engine: "egret", family: "other", weight: 3, label: "egret.js", re: /egret\.(min|web)[^/]*\.js/i },
  { engine: "phaser", family: "other", weight: 3, label: "phaser.js", re: /\/phaser(\.min)?\.js/i },
  { engine: "construct", family: "other", weight: 3, label: "c2/c3runtime.js", re: /c[23]runtime\.js/i },
  { engine: "godot", family: "other", weight: 3, label: "*.pck", re: /\.pck(\?|$)|godot[^/]*\.wasm/i },
  { engine: "defold", family: "other", weight: 3, label: "dmloader.js", re: /dmloader\.js/i },
  { engine: "playcanvas", family: "other", weight: 3, label: "playcanvas.js", re: /playcanvas(-stable|\.min)?\.js/i },
  { engine: "pixi", family: "other", weight: 2, label: "pixi.js", re: /\/pixi(\.min)?\.js/i },
  { engine: "three", family: "other", weight: 2, label: "three.js", re: /\/three(\.min|\.module)?\.js/i },
];

const networkPath = path.resolve(required("--network"));
const outPath = path.resolve(valueAfter("--out", path.join(path.dirname(networkPath), "engine.json")));

if (!fs.existsSync(networkPath)) {
  throw new Error(`Không thấy network capture: ${networkPath} — chạy capture-runtime.mjs trước`);
}

const urls = networkUrls(JSON.parse(fs.readFileSync(networkPath, "utf8")));

const signals = [];
const engineScores = new Map();
const familyScores = { cocos: 0, other: 0 };

for (const signature of SIGNATURES) {
  const hit = urls.find((url) => signature.re.test(url));
  if (!hit) continue;
  signals.push({ engine: signature.engine, signal: signature.label, url: hit });
  engineScores.set(signature.engine, (engineScores.get(signature.engine) || 0) + signature.weight);
  familyScores[signature.family] += signature.weight;
}

function bestOf(family) {
  let best = null;
  for (const [engine, score] of engineScores) {
    const isFamily = SIGNATURES.some((s) => s.engine === engine && s.family === family);
    if (!isFamily) continue;
    if (!best || score > best.score) best = { engine, score };
  }
  return best;
}

// Chỉ đi tiếp khi nhận diện ĐƯỢC là Cocos. "Không nhận ra" cũng là không-Cocos:
// batch này không đoán, và mirror một game đoán sai thì tốn cả băng thông lẫn thời gian.
const cocosBest = bestOf("cocos");
const otherBest = bestOf("other");
let family = "unknown";
let engine = null;

if (cocosBest && cocosBest.score >= 3 && cocosBest.score >= familyScores.other) {
  family = "cocos";
  // Có tín hiệu version cụ thể thì ưu tiên nó thay vì "cocos" chung.
  const versioned = [...engineScores.keys()].filter((name) => name.startsWith("cocos-"));
  engine = versioned.length
    ? versioned.reduce((a, b) => (engineScores.get(a) >= engineScores.get(b) ? a : b))
    : "cocos";
} else if (otherBest && otherBest.score >= 3) {
  family = "other";
  engine = otherBest.engine;
} else if (otherBest || cocosBest) {
  family = "unknown";
  engine = null;
}

const isCocos = family === "cocos";
const report = {
  generatedAt: new Date().toISOString(),
  network: networkPath,
  requests: urls.length,
  family,
  engine,
  isCocos,
  verdict: isCocos ? "proceed" : "skip",
  reason: isCocos
    ? `nhận diện ${engine} từ ${signals.filter((s) => s.engine.startsWith("cocos")).length} tín hiệu`
    : family === "other"
      ? `engine ${engine} — batch này chỉ xử lý Cocos Creator`
      : `không nhận ra engine từ ${urls.length} request — không đủ căn cứ để coi là Cocos`,
  scores: { cocos: familyScores.cocos, other: familyScores.other },
  signals,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  family: report.family,
  engine: report.engine,
  isCocos,
  verdict: report.verdict,
  reason: report.reason,
  requests: report.requests,
  scores: report.scores,
  report: outPath,
}, null, 2));

if (!isCocos) process.exitCode = family === "other" ? 3 : 4;
