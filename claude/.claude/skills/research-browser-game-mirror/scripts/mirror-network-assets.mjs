#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const argv = process.argv.slice(2);

function valueAfter(name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
}

function valuesAfter(name) {
  const output = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === name && argv[index + 1] !== undefined) output.push(argv[index + 1]);
  }
  return output;
}

function required(name) {
  const value = valueAfter(name);
  if (!value) throw new Error(`Missing required argument: ${name}`);
  return value;
}

function slash(value) {
  return value.split(path.sep).join("/");
}

const networkPath = path.resolve(required("--network"));
const outputRoot = path.resolve(required("--out"));
const referer = valueAfter("--referer");
const overwrite = argv.includes("--overwrite");
const auditOnly = argv.includes("--audit-only");
const concurrency = Math.max(1, Math.min(32, Number(valueAfter("--concurrency", "10")) || 10));
const reportPath = path.resolve(
  valueAfter("--report", path.join(outputRoot, "mirror-audit", "runtime-assets.json")),
);
const customHeaders = Object.fromEntries(valuesAfter("--header").map((header) => {
  const separator = header.indexOf(":");
  if (separator < 1) throw new Error(`Invalid --header: ${header}`);
  return [header.slice(0, separator).trim(), header.slice(separator + 1).trim()];
}));
const mappings = valuesAfter("--map").map((mapping) => {
  const separator = mapping.indexOf("=");
  if (separator < 0) throw new Error(`Invalid --map: ${mapping}`);
  const remotePrefix = mapping.slice(0, separator);
  const localPrefix = mapping.slice(separator + 1).replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (!/^https?:\/\//i.test(remotePrefix)) throw new Error(`Map must start with HTTP(S): ${mapping}`);
  return {
    remotePrefix,
    localPrefix: localPrefix ? `${localPrefix}/` : "",
  };
}).sort((a, b) => b.remotePrefix.length - a.remotePrefix.length);
if (!mappings.length) throw new Error("Provide at least one --map <remote-prefix>=<local-prefix>");

function requestsFromJson(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.requests)) return parsed.requests;
  if (Array.isArray(parsed.entries)) return parsed.entries;
  if (Array.isArray(parsed.log?.entries)) {
    return parsed.log.entries.map((entry) => ({
      url: entry.request?.url,
      method: entry.request?.method,
      status: entry.response?.status,
      mimeType: entry.response?.content?.mimeType,
    }));
  }
  throw new Error("Unsupported Network JSON. Expected array, {requests}, {entries}, or HAR {log.entries}.");
}

function decodePathname(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function mapRequest(request) {
  const url = request.url || request.request?.url;
  if (!url || !/^https?:\/\//i.test(url)) return { skip: "not-http", url };
  const method = (request.method || request.request?.method || "GET").toUpperCase();
  if (method !== "GET") return { skip: `method-${method}`, url };
  const status = Number(request.status ?? request.response?.status);
  if (Number.isFinite(status) && status >= 400) return { skip: `source-http-${status}`, url, status };
  const mapping = mappings.find((candidate) => url.startsWith(candidate.remotePrefix));
  if (!mapping) return { skip: "unmapped-origin", url };
  const parsed = new URL(url);
  let remainder = url.slice(mapping.remotePrefix.length).split(/[?#]/, 1)[0];
  if (!remainder || remainder.endsWith("/")) remainder += "index.html";
  remainder = decodePathname(remainder).replace(/^\/+/, "");
  const relative = `${mapping.localPrefix}${remainder}`.replace(/\/+/g, "/");
  const destination = path.resolve(outputRoot, ...relative.split("/"));
  if (destination !== outputRoot && !destination.startsWith(`${outputRoot}${path.sep}`)) {
    return { skip: "unsafe-path", url, relative };
  }
  return {
    url,
    method,
    status,
    mimeType: request.mimeType || request.response?.mimeType,
    relative,
    destination,
  };
}

function looksLikeHtml(buffer) {
  const prefix = buffer.subarray(0, 512).toString("utf8").trimStart().toLowerCase();
  return prefix.startsWith("<!doctype html") || prefix.startsWith("<html") || prefix.includes("<title>404");
}

function validatePayload(buffer, destination, contentType) {
  if (!buffer.length) throw new Error("zero-byte response");
  const extension = path.extname(destination).toLowerCase();
  if (extension !== ".html" && looksLikeHtml(buffer)) {
    throw new Error(`HTML response saved as ${extension || "asset"} (${contentType || "unknown type"})`);
  }
  if (extension === ".json") JSON.parse(buffer.toString("utf8"));
  if (
    extension === ".png"
    && !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    throw new Error("invalid PNG signature");
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fetchOne(asset, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(asset.url, {
        headers: {
          ...(referer ? { Referer: referer } : {}),
          "User-Agent": "Mozilla/5.0 Codex authorized local game mirror",
          ...customHeaders,
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      validatePayload(bytes, asset.destination, response.headers.get("content-type"));
      await fs.mkdir(path.dirname(asset.destination), { recursive: true });
      const temporary = `${asset.destination}.download`;
      await fs.writeFile(temporary, bytes);
      if (await exists(asset.destination)) await fs.rm(asset.destination, { force: true });
      await fs.rename(temporary, asset.destination);
      return {
        ok: true,
        url: asset.url,
        relative: asset.relative,
        bytes: bytes.length,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        contentType: response.headers.get("content-type"),
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 250));
      }
    }
  }
  return {
    ok: false,
    url: asset.url,
    relative: asset.relative,
    error: String(lastError?.message || lastError),
  };
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

const parsed = JSON.parse(await fs.readFile(networkPath, "utf8"));
const requests = requestsFromJson(parsed);
const mapped = requests.map(mapRequest);
const skipped = mapped.filter((asset) => asset.skip);
const candidates = mapped.filter((asset) => !asset.skip);
const byDestination = new Map();
const conflicts = [];

for (const asset of candidates) {
  const existing = byDestination.get(asset.relative);
  if (!existing) {
    byDestination.set(asset.relative, asset);
  } else if (existing.url !== asset.url) {
    const existingWithoutQuery = existing.url.split(/[?#]/, 1)[0];
    const currentWithoutQuery = asset.url.split(/[?#]/, 1)[0];
    if (existingWithoutQuery !== currentWithoutQuery) {
      conflicts.push({ relative: asset.relative, urls: [existing.url, asset.url] });
    }
  }
}

const uniqueAssets = [...byDestination.values()];
const existing = [];
const invalidExisting = [];
const toDownload = [];
for (const asset of uniqueAssets) {
  if (!overwrite && await exists(asset.destination)) {
    try {
      validatePayload(await fs.readFile(asset.destination), asset.destination, asset.mimeType || "local");
      existing.push(asset);
    } catch (error) {
      invalidExisting.push({
        url: asset.url,
        relative: asset.relative,
        error: String(error.message || error),
      });
      if (!auditOnly) toDownload.push(asset);
    }
  } else {
    toDownload.push(asset);
  }
}

const downloaded = [];
const failures = [];
if (!auditOnly) {
  await mapLimit(toDownload, concurrency, async (asset) => {
    const result = await fetchOne(asset);
    if (result.ok) downloaded.push(result);
    else failures.push(result);
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  networkPath,
  outputRoot,
  mappings,
  auditOnly,
  overwrite,
  customHeaderNames: Object.keys(customHeaders),
  counts: {
    capturedRequests: requests.length,
    mappedCandidates: candidates.length,
    uniqueAssets: uniqueAssets.length,
    alreadyPresent: existing.length,
    toDownload: toDownload.length,
    downloaded: downloaded.length,
    failed: failures.length,
    conflicts: conflicts.length,
    invalidExisting: invalidExisting.length,
    skipped: skipped.length,
  },
  downloaded,
  failures,
  conflicts,
  invalidExisting,
  skipped,
};

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  counts: report.counts,
  downloadedBytes: downloaded.reduce((sum, asset) => sum + asset.bytes, 0),
  skippedByReason: Object.fromEntries(
    Object.entries(
      skipped.reduce((groups, asset) => {
        groups[asset.skip] = (groups[asset.skip] || 0) + 1;
        return groups;
      }, {}),
    ).sort(([a], [b]) => a.localeCompare(b)),
  ),
  report: reportPath,
}, null, 2));

if (
  failures.length
  || conflicts.length
  || (auditOnly && (toDownload.length || invalidExisting.length))
) {
  process.exitCode = 2;
}
