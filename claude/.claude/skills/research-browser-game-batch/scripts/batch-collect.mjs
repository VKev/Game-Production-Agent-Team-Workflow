#!/usr/bin/env node
// Gộp trạng thái batch từ ARTIFACT THẬT do script của research-browser-game-mirror
// sinh ra. Không tự suy diễn từ văn bản, và không bao giờ tự set "complete".
import fs from "node:fs";
import path from "node:path";

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

// "slug=giá trị có thể chứa dấu =" — cắt ở dấu = đầu tiên.
function pairsAfter(name) {
  const map = new Map();
  for (const raw of valuesAfter(name)) {
    const separator = raw.indexOf("=");
    if (separator <= 0) throw new Error(`${name} phải dạng slug=value, nhận "${raw}"`);
    map.set(raw.slice(0, separator).trim(), raw.slice(separator + 1).trim());
  }
  return map;
}

// Claim gate-status (lazyRoutes) chỉ có thể được THÊM, không có artifact nào phủ
// định được nó — nên mảng rỗng KHÔNG được che claim đã ghi trước đó. Muốn xoá
// claim thì truyền tường minh `--lazy <slug>=`.
function firstNonEmpty(...candidates) {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    if (Array.isArray(candidate) ? candidate.length > 0 : String(candidate).trim() !== "") {
      return candidate;
    }
  }
  return null;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function lastRecords(jsonlPath) {
  const states = new Map();
  if (!fs.existsSync(jsonlPath)) return states;
  for (const line of fs.readFileSync(jsonlPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const record = JSON.parse(trimmed);
      if (record.slug) states.set(record.slug, record);
    } catch {
      // dòng hỏng không được làm chết việc chấm
    }
  }
  return states;
}

const outRoot = path.resolve(required("--out"));
const reportOnly = argv.includes("--report-only");
const lazyOverrides = pairsAfter("--lazy");
const blockedOverrides = pairsAfter("--blocked");
const reportPath = path.resolve(valueAfter("--report", path.join(outRoot, "BATCH-REPORT.md")));

const planPath = path.join(outRoot, "plan.json");
const plan = readJson(planPath);
if (!plan || !Array.isArray(plan.games)) {
  throw new Error(`Không đọc được ${planPath} — chạy batch-plan.mjs trước`);
}

const jsonlPath = path.join(outRoot, "batch.jsonl");
const previous = lastRecords(jsonlPath);
const recordedAt = new Date().toISOString();

const rows = [];
for (const game of plan.games) {
  const { slug } = game;
  const result = readJson(game.resultPath) || {};
  const prior = previous.get(slug) || {};
  const cocos = readJson(path.join(game.mirrorDir, "mirror-audit", "cocos-assets.json"));
  const mirrored = readJson(path.join(game.mirrorDir, "mirror-audit", "runtime-assets.json"));
  const verify = readJson(path.join(game.evidenceDir, "runtime-verification.json"));
  const apiMock = readJson(path.join(game.mirrorDir, "api-mock", "index.json"));
  const engineReport = readJson(game.enginePath || path.join(game.evidenceDir, "engine.json"));

  const lazyRaw = lazyOverrides.has(slug)
    ? lazyOverrides.get(slug)
    : firstNonEmpty(result.lazyRoutes, prior.lazyRoutes) ?? [];
  const lazyRoutes = (Array.isArray(lazyRaw) ? lazyRaw : String(lazyRaw).split(","))
    .map((route) => String(route).trim())
    .filter(Boolean);
  const blocked = blockedOverrides.get(slug) || result.blocked || game.skipReason || null;
  const engine = engineReport?.engine ?? result.engine ?? prior.engine ?? null;

  const counts = {
    manifestMissing: cocos ? Number(cocos.totals?.remaining ?? 0) : null,
    manifestUnresolved: cocos ? Number(cocos.totals?.unresolved ?? 0) : null,
    manifestInvalid: cocos ? Number(cocos.totals?.invalid ?? 0) : null,
    mirroredAssets: mirrored ? Number(mirrored.totals?.downloaded ?? mirrored.downloaded?.length ?? 0) : null,
    failedRequests: verify ? Number(verify.counts?.failedRequests ?? 0) : null,
    externalRequests: verify ? Number(verify.counts?.externalRequests ?? 0) : null,
    blockingConsole: verify ? Number(verify.counts?.blockingConsole ?? 0) : null,
    apiFixtures: apiMock ? Number(apiMock.counts?.entries ?? 0) : null,
  };

  const reasons = [];
  let status;
  const declaredNotCocos = engineReport
    ? engineReport.isCocos === false
    : result.status === "not-cocos";

  if (blocked) {
    status = "blocked";
    reasons.push(String(blocked));
  } else if (declaredNotCocos) {
    // Cổng Cocos-only: dừng ở đây là kết quả hợp lệ, không phải lỗi.
    status = "not-cocos";
    reasons.push(engineReport?.reason
      || (engine ? `engine ${engine} — batch này chỉ xử lý Cocos Creator` : "không nhận ra engine"));
    reasons.push("muốn mirror game này thì dùng /browser-game-fetcher <url> — skill đơn xử lý được engine khác");
  } else if (!verify) {
    status = "pending";
    reasons.push("chưa có evidence/runtime-verification.json — chưa capture local lần nào");
  } else {
    if (verify.passed !== true) {
      if (counts.failedRequests) reasons.push(`${counts.failedRequests} failed request`);
      if (counts.externalRequests) reasons.push(`${counts.externalRequests} external request ngoài allowlist`);
      if (counts.blockingConsole) reasons.push(`${counts.blockingConsole} blocking console error`);
      if (reasons.length === 0) reasons.push("verify-runtime báo không pass");
    }
    if (cocos) {
      if (counts.manifestMissing) reasons.push(`${counts.manifestMissing} manifest entry còn thiếu`);
      if (counts.manifestUnresolved) reasons.push(`${counts.manifestUnresolved} asset không resolve được`);
      if (counts.manifestInvalid) reasons.push(`${counts.manifestInvalid} asset local không hợp lệ`);
    }

    if (reasons.length > 0) {
      status = "failed";
    } else if (!cocos) {
      // Đã qua cổng Cocos mà không có audit manifest thì chỉ có một cách hiểu:
      // sync-cocos-assets.mjs chưa từng chạy. Không được tính là đủ.
      status = "failed";
      reasons.push("chưa có mirror-audit/cocos-assets.json — sync-cocos-assets.mjs chưa chạy");
    } else if (lazyRoutes.length === 0) {
      status = "boot-only";
      reasons.push("lazy routes chưa exercise — level selector, level giữa/cuối, reward, gallery, audio");
    } else {
      status = "complete";
    }
  }

  const origin404 = result.origin404 ?? prior.origin404 ?? [];
  rows.push({
    slug,
    url: game.url,
    status,
    reasons,
    counts,
    lazyRoutes,
    engine,
    engineFamily: engineReport?.family ?? null,
    localUrl: result.localUrl ?? prior.localUrl ?? null,
    patches: result.patches ?? prior.patches ?? [],
    origin404: Array.isArray(origin404) ? origin404 : [origin404],
    confidence: result.confidence ?? prior.confidence ?? null,
    todos: result.todos ?? prior.todos ?? [],
    mirrorDir: game.mirrorDir,
    recordedAt,
    source: reportOnly ? "report-only" : "batch-collect",
  });
}

const byStatus = (status) => rows.filter((row) => row.status === status);
const summary = {
  complete: byStatus("complete").length,
  bootOnly: byStatus("boot-only").length,
  failed: byStatus("failed").length,
  notCocos: byStatus("not-cocos").length,
  blocked: byStatus("blocked").length,
  pending: byStatus("pending").length,
  listed: rows.length,
};

const num = (value) => (value === null || value === undefined ? "—" : String(value));
const lines = [];
lines.push(`# Batch report — ${path.basename(outRoot)}`);
lines.push("");
lines.push(`Chấm lúc: ${recordedAt}`);
lines.push(`Folder: ${outRoot}`);
lines.push("");
lines.push(`**${summary.listed} game trong danh sách** — `
  + `complete ${summary.complete} · boot-only ${summary.bootOnly} · `
  + `failed ${summary.failed} · not-cocos ${summary.notCocos} · `
  + `blocked ${summary.blocked} · pending ${summary.pending}`);
lines.push("");
lines.push("Các con số rời nhau có chủ ý. Chỉ `complete` mới là mirror đủ.");
lines.push("");
lines.push("| game | status | manifest missing | failed req | external req | console err | lazy routes | api fixture | engine |");
lines.push("|---|---|---|---|---|---|---|---|---|");
for (const row of rows) {
  lines.push(`| \`${row.slug}\` | ${row.status} | ${num(row.counts.manifestMissing)} `
    + `| ${num(row.counts.failedRequests)} | ${num(row.counts.externalRequests)} `
    + `| ${num(row.counts.blockingConsole)} | ${row.lazyRoutes.length || "0"} `
    + `| ${num(row.counts.apiFixtures)} `
    + `| ${row.engine || "—"} |`);
}
lines.push("");

function detailBlock(row) {
  lines.push(`### \`${row.slug}\` — ${row.status}`);
  lines.push("");
  lines.push(`- URL: ${row.url}`);
  for (const reason of row.reasons) lines.push(`- ${reason}`);
  for (const orphan of row.origin404) {
    if (orphan) lines.push(`- origin unavailable: ${orphan}`);
  }
  if (row.todos.length) lines.push(`- todo: ${row.todos.join("; ")}`);
  lines.push("");
}

const needsWork = rows.filter((row) => ["pending", "failed", "boot-only"].includes(row.status));
if (needsWork.length) {
  lines.push("## Việc còn lại");
  lines.push("");
  for (const row of needsWork) detailBlock(row);
}

// Không phải "việc còn lại" — đây là quyết định đã xong, chỉ cần hiện ra.
const notCocos = byStatus("not-cocos");
if (notCocos.length) {
  lines.push("## Bỏ qua — không phải Cocos Creator");
  lines.push("");
  lines.push("Dừng ngay sau capture live, chưa mirror gì. Muốn mirror thì dùng skill đơn:");
  lines.push("");
  for (const row of notCocos) {
    lines.push(`- \`${row.slug}\` — engine: ${row.engine || "không nhận ra"} `
      + `→ \`/browser-game-fetcher ${row.url}\``);
    // Todo ở đây thường là "cổng có thể chấm sai" — mất nó là mất tín hiệu cần đọc.
    if (row.todos.length) lines.push(`  - todo: ${row.todos.join("; ")}`);
  }
  lines.push("");
}

const blockedRows = byStatus("blocked");
if (blockedRows.length) {
  lines.push("## Cần người");
  lines.push("");
  for (const row of blockedRows) detailBlock(row);
}

const done = byStatus("complete");
if (done.length) {
  lines.push("## Đã đủ — bước tiếp");
  lines.push("");
  for (const row of done) {
    const patchNote = row.patches.length ? ` (patch: ${row.patches.length})` : "";
    lines.push(`- \`${row.slug}\`${patchNote} — \`/cocos-port-triage ${row.mirrorDir}\``);
  }
  lines.push("");
}

fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");

if (!reportOnly) {
  const records = rows.map((row) => JSON.stringify(row)).join("\n");
  fs.appendFileSync(jsonlPath, `${records}\n`, "utf8");
}

console.log(JSON.stringify({
  report: reportPath,
  appendedTo: reportOnly ? null : jsonlPath,
  summary,
  games: rows.map((row) => ({
    slug: row.slug,
    status: row.status,
    reasons: row.reasons,
  })),
}, null, 2));

// Cổng batch: fail khi còn việc phải làm. `blocked` và `not-cocos` không tính —
// cả hai đã được nêu tên kèm lý do trong report nên không phải thành công im lặng;
// `boot-only` thì tính, vì đó chính là kiểu tự lừa mà skill này tồn tại để chặn.
if (summary.pending || summary.failed || summary.bootOnly) process.exitCode = 2;
