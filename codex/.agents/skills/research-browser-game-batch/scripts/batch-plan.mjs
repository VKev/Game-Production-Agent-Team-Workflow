#!/usr/bin/env node
// Chuẩn hoá danh sách game -> layout folder + plan.json + seed batch.jsonl.
// Không tải gì, không chạy browser. Chỉ dựng chỗ và resolve path/lệnh.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const selfScripts = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);

function valueAfter(name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
}

function valuesAfter(name) {
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === name && argv[index + 1] !== undefined) values.push(argv[index + 1]);
  }
  return values;
}

function required(name) {
  const value = valueAfter(name);
  if (!value) throw new Error(`Missing required argument: ${name}`);
  return value;
}

const GENERIC_SEGMENTS = new Set(["", "game", "games", "play", "h5", "web", "en", "vi", "index.html"]);
const VALID_KEYS = new Set(["slug", "build", "map", "referer", "wait", "allow", "eval", "skip"]);

function slugify(raw) {
  return String(raw)
    .toLowerCase()
    .replace(/\.(html?|php|aspx)$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function deriveSlug(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return slugify(url) || "game";
  }
  const segments = parsed.pathname.split("/").map((part) => decodeURIComponent(part));
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const candidate = segments[index];
    if (GENERIC_SEGMENTS.has(candidate.toLowerCase())) continue;
    const slug = slugify(candidate);
    if (slug) return slug;
  }
  return slugify(parsed.hostname.split(".")[0]) || "game";
}

// "<url> key=value key=value" — dấu # là comment, dòng trống bị bỏ.
function parseLine(line, lineNumber) {
  const withoutComment = line.replace(/\s+#.*$/, "").trim();
  if (!withoutComment || withoutComment.startsWith("#")) return null;

  // skip= là hint duy nhất được phép chứa dấu cách (lý do bỏ qua, viết cho người
  // đọc), nên nó phải nằm cuối dòng và được cắt ra trước khi tokenize.
  let head = withoutComment;
  let skipReason = null;
  const skipMatch = withoutComment.match(/\bskip=(.*)$/);
  if (skipMatch) {
    head = withoutComment.slice(0, skipMatch.index).trim();
    skipReason = skipMatch[1].trim() || "được đánh dấu skip trong danh sách";
  }

  const tokens = head.split(/\s+/).filter(Boolean);
  const url = tokens.shift();
  try {
    new URL(url);
  } catch {
    throw new Error(`Dòng ${lineNumber}: "${url}" không phải URL hợp lệ`);
  }
  const hints = { map: [], allow: [] };
  for (const token of tokens) {
    const separator = token.indexOf("=");
    if (separator <= 0) throw new Error(`Dòng ${lineNumber}: hint "${token}" phải dạng key=value`);
    const key = token.slice(0, separator);
    const value = token.slice(separator + 1);
    if (!VALID_KEYS.has(key)) {
      throw new Error(`Dòng ${lineNumber}: key "${key}" không hợp lệ (${[...VALID_KEYS].join(", ")})`);
    }
    if (key === "map" || key === "allow") hints[key].push(value);
    else hints[key] = value;
  }
  if (skipReason) hints.skip = skipReason;
  return { url, hints, lineNumber, skipReason };
}

function q(value) {
  return /[^A-Za-z0-9_@%+=:,./-]/.test(value) ? `'${String(value).replace(/'/g, "'\\''")}'` : value;
}

function lastStateBySlug(jsonlPath) {
  const states = new Map();
  if (!fs.existsSync(jsonlPath)) return states;
  const lines = fs.readFileSync(jsonlPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const record = JSON.parse(trimmed);
      if (record.slug) states.set(record.slug, record);
    } catch {
      // Dòng hỏng không được làm chết resume — bỏ qua, giữ lịch sử nguyên vẹn.
    }
  }
  return states;
}

const listPath = valueAfter("--list");
const inlineUrls = valuesAfter("--url");
if (!listPath && inlineUrls.length === 0) {
  throw new Error("Cần --list <file> hoặc ít nhất một --url <url>");
}
const outRoot = path.resolve(required("--out"));
const resume = argv.includes("--resume");
const acceptStatuses = new Set(["complete", ...valuesAfter("--accept")]);
const concurrency = Math.max(1, Math.min(8, Number(valueAfter("--concurrency", "3")) || 3));
const skillScripts = path.resolve(valueAfter(
  "--skill-dir",
  path.join(os.homedir(), ".claude", "skills", "research-browser-game-mirror", "scripts"),
));

if (!fs.existsSync(path.join(skillScripts, "capture-runtime.mjs"))) {
  throw new Error(`Không thấy script của skill research-browser-game-mirror tại ${skillScripts} — truyền --skill-dir`);
}

const sourceLines = [];
if (listPath) {
  const resolvedList = path.resolve(listPath);
  if (!fs.existsSync(resolvedList)) throw new Error(`Không thấy danh sách: ${resolvedList}`);
  sourceLines.push(...fs.readFileSync(resolvedList, "utf8").split("\n"));
}
sourceLines.push(...inlineUrls);

const parsed = [];
const usedSlugs = new Set();
sourceLines.forEach((line, index) => {
  const entry = parseLine(line, index + 1);
  if (!entry) return;
  let slug = entry.hints.slug ? slugify(entry.hints.slug) : deriveSlug(entry.url);
  if (!slug) slug = `game-${parsed.length + 1}`;
  if (usedSlugs.has(slug)) {
    let suffix = 2;
    while (usedSlugs.has(`${slug}-${suffix}`)) suffix += 1;
    slug = `${slug}-${suffix}`;
  }
  usedSlugs.add(slug);
  parsed.push({ ...entry, slug });
});

if (parsed.length === 0) throw new Error("Danh sách không có dòng game nào dùng được");

fs.mkdirSync(outRoot, { recursive: true });
const jsonlPath = path.join(outRoot, "batch.jsonl");
const previous = lastStateBySlug(jsonlPath);

const games = [];
const seeds = [];
for (const entry of parsed) {
  const gameDir = path.join(outRoot, entry.slug);
  const mirrorDir = path.join(gameDir, "mirror");
  const evidenceDir = path.join(gameDir, "evidence");
  const previousStatus = previous.get(entry.slug)?.status ?? null;
  const skipped = resume && previousStatus !== null && acceptStatuses.has(previousStatus);

  // Game bị skip= hoặc đã complete thì không dựng folder rỗng cho nó.
  if (!skipped && !entry.hints.skip) {
    fs.mkdirSync(mirrorDir, { recursive: true });
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  const buildRoot = entry.hints.build || "<BUILD_ROOT>";
  const referer = entry.hints.referer || entry.url;
  const waitMs = String(Math.max(1000, Number(entry.hints.wait) || 45000));
  const maps = [`${buildRoot}=`, ...entry.hints.map];
  const node = "node";
  const capture = path.join(skillScripts, "capture-runtime.mjs");

  const commands = {
    captureLive: [
      node, q(capture), "--url", q(entry.url), "--out", q(evidenceDir),
      "--label", "live", "--wait-ms", waitMs, "--capture-api",
      ...(entry.hints.eval ? ["--eval-file", q(path.resolve(entry.hints.eval))] : []),
    ].join(" "),
    // Cổng Cocos-only: exit 0 mới được chạy các lệnh dưới. exit 3 = engine khác,
    // exit 4 = không nhận ra — cả hai đều dừng, không mirror.
    detectEngine: [
      node, q(path.join(skillScripts, "detect-engine.mjs")),
      "--network", q(path.join(evidenceDir, "live-network.json")),
    ].join(" "),
    mirror: [
      node, q(path.join(skillScripts, "mirror-network-assets.mjs")),
      "--network", q(path.join(evidenceDir, "live-network.json")),
      "--out", q(mirrorDir),
      ...maps.flatMap((mapping) => ["--map", q(mapping)]),
      "--referer", q(referer),
    ].join(" "),
    syncCocos: [
      node, q(path.join(skillScripts, "sync-cocos-assets.mjs")),
      "--root", q(mirrorDir), "--remote", q(buildRoot), "--referer", q(referer),
    ].join(" "),
    buildApiMock: [
      node, q(path.join(skillScripts, "build-api-mock.mjs")),
      "--api", q(path.join(evidenceDir, "live-api.json")),
      "--out", q(path.join(mirrorDir, "api-mock")),
    ].join(" "),
    // Server local là python — cùng một bộ chạy thử cho fetch lẫn port.
    serve: [
      "python3", q(path.join(skillScripts, "serve-local.py")),
      "--root", q(mirrorDir),
      "--api-mock", q(path.join(mirrorDir, "api-mock")),
      "--fake-ads", "--port", "0",
    ].join(" "),
    captureLocal: [
      node, q(capture), "--url", "<LOCAL_URL>", "--out", q(evidenceDir),
      "--label", "local", "--wait-ms", waitMs, "--capture-api",
      ...(entry.hints.eval ? ["--eval-file", q(path.resolve(entry.hints.eval))] : []),
    ].join(" "),
    verify: [
      node, q(path.join(skillScripts, "verify-runtime.mjs")),
      "--network", q(path.join(evidenceDir, "local-network.json")),
      "--console", q(path.join(evidenceDir, "local-console.json")),
      "--local-origin", "<LOCAL_ORIGIN>",
      ...entry.hints.allow.flatMap((host) => ["--allow-host", q(host)]),
    ].join(" "),
  };

  games.push({
    slug: entry.slug,
    url: entry.url,
    line: entry.lineNumber,
    gameDir,
    mirrorDir,
    evidenceDir,
    resultPath: path.join(gameDir, "result.json"),
    enginePath: path.join(evidenceDir, "engine.json"),
    buildRootKnown: Boolean(entry.hints.build),
    buildRoot: entry.hints.build || null,
    referer,
    waitMs: Number(waitMs),
    extraMaps: entry.hints.map,
    allowHosts: entry.hints.allow,
    evalFile: entry.hints.eval ? path.resolve(entry.hints.eval) : null,
    skipReason: entry.skipReason || null,
    previousStatus,
    skipped,
    commands,
  });

  if (!previous.has(entry.slug)) {
    seeds.push({
      slug: entry.slug,
      url: entry.url,
      status: entry.skipReason ? "blocked" : "pending",
      reasons: entry.skipReason ? [`skip= trong danh sách: ${entry.skipReason}`] : [],
      recordedAt: new Date().toISOString(),
      source: "batch-plan",
    });
  }
}

if (listPath) {
  const resolvedList = path.resolve(listPath);
  const canonicalList = path.join(outRoot, "games.txt");
  if (resolvedList !== canonicalList) {
    fs.copyFileSync(resolvedList, canonicalList);
  }
}

if (seeds.length) {
  fs.appendFileSync(jsonlPath, `${seeds.map((seed) => JSON.stringify(seed)).join("\n")}\n`, "utf8");
}

const plan = {
  generatedAt: new Date().toISOString(),
  outRoot,
  skillScripts,
  concurrency,
  resume,
  gate: "Cocos-only: chỉ chạy commands.mirror trở đi khi commands.detectEngine exit 0. "
    + "Engine khác (exit 3) hoặc không nhận ra (exit 4) → ghi result.json status not-cocos rồi dừng.",
  acceptStatuses: [...acceptStatuses].sort(),
  totals: {
    listed: games.length,
    todo: games.filter((game) => !game.skipped && !game.skipReason).length,
    skippedByList: games.filter((game) => game.skipReason).length,
    skippedByResume: games.filter((game) => game.skipped).length,
    unknownBuildRoot: games.filter((game) => !game.buildRootKnown && !game.skipReason).length,
  },
  games,
};

const planPath = path.join(outRoot, "plan.json");
fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  plan: planPath,
  outRoot,
  concurrency,
  totals: plan.totals,
  todo: games.filter((game) => !game.skipped && !game.skipReason).map((game) => ({
    slug: game.slug,
    url: game.url,
    buildRootKnown: game.buildRootKnown,
  })),
  skipped: games.filter((game) => game.skipped || game.skipReason).map((game) => ({
    slug: game.slug,
    why: game.skipReason ? `skip= ${game.skipReason}` : `resume: đã ${game.previousStatus}`,
  })),
}, null, 2));
