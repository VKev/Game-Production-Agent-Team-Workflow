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

const root = path.resolve(required("--root"));
const defaultRemote = new URL(required("--remote"));
const referer = valueAfter("--referer", defaultRemote.href);
const auditOnly = argv.includes("--audit-only");
const concurrency = Math.max(1, Math.min(32, Number(valueAfter("--concurrency", "8")) || 8));
const reportPath = path.resolve(
  valueAfter("--report", path.join(root, "mirror-audit", "cocos-assets.json")),
);
const base64Keys = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const hex = "0123456789abcdef";

function slash(value) {
  return value.split(path.sep).join("/");
}

function normalizeLocalPrefix(value) {
  const normalized = value.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  return normalized ? `${normalized}/` : "";
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

const remoteMaps = [
  { localPrefix: "", remotePrefix: ensureTrailingSlash(defaultRemote.href) },
  ...valuesAfter("--remote-map").map((mapping) => {
    const separator = mapping.indexOf("=");
    if (separator < 0) throw new Error(`Invalid --remote-map: ${mapping}`);
    return {
      localPrefix: normalizeLocalPrefix(mapping.slice(0, separator)),
      remotePrefix: ensureTrailingSlash(mapping.slice(separator + 1)),
    };
  }),
].sort((a, b) => b.localPrefix.length - a.localPrefix.length);

function remoteUrlFor(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
  const mapping = remoteMaps.find((candidate) => normalized.startsWith(candidate.localPrefix));
  if (!mapping) throw new Error(`No remote mapping for: ${normalized}`);
  return new URL(normalized.slice(mapping.localPrefix.length), mapping.remotePrefix).href;
}

function decodeUuid(value) {
  const input = String(value);
  if (input.length !== 22) return input;
  let compact = input.slice(0, 2);
  for (let index = 2; index < 22; index += 2) {
    const left = base64Keys.indexOf(input[index]);
    const right = base64Keys.indexOf(input[index + 1]);
    if (left < 0 || right < 0) return input;
    compact += hex[left >> 2];
    compact += hex[((left & 3) << 2) | (right >> 4)];
    compact += hex[right & 15];
  }
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join("-");
}

function resolveId(config, key) {
  const raw = typeof key === "number" ? config.uuids?.[key] : key;
  if (raw === undefined || raw === null) {
    throw new Error(`Cannot resolve manifest key: ${String(key)}`);
  }
  return decodeUuid(raw);
}

function pairs(values = []) {
  const output = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    output.push({ key: values[index], hash: values[index + 1] });
  }
  return output;
}

function typeForKey(config, key) {
  if (typeof key !== "number") return undefined;
  const metadata = config.paths?.[String(key)];
  if (!Array.isArray(metadata)) return undefined;
  return config.types?.[metadata[1]];
}

function extensionCandidates(typeName) {
  const generic = [
    ".png", ".mp3", ".jpg", ".jpeg", ".plist", ".json", ".atlas", ".bin",
    ".txt", ".ttf", ".otf", ".wav", ".ogg", ".m4a", ".webp", "",
  ];
  if (typeName === "cc.Texture2D" || typeName === "cc.SpriteFrame") {
    return [".png", ".jpg", ".jpeg", ".webp", ...generic];
  }
  if (typeName === "cc.AudioClip") {
    return [".mp3", ".ogg", ".wav", ".m4a", ...generic];
  }
  if (typeName === "cc.Font") return [".ttf", ".otf", ...generic];
  return [...new Set(generic)];
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory, output = []) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return output;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && [".git", "node_modules", ".edge-profile", "mirror-audit"].includes(entry.name)) {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath, output);
    else if (entry.isFile()) output.push(fullPath);
  }
  return output;
}

async function findNativeFile(bundleDirectory, nativeBase, id, hash) {
  const directory = path.join(bundleDirectory, nativeBase, id.slice(0, 2));
  let names;
  try {
    names = await fs.readdir(directory);
  } catch {
    return null;
  }
  const stem = `${id}.${hash}`;
  const name = names.find((candidate) => candidate === stem || candidate.startsWith(`${stem}.`));
  return name ? path.join(directory, name) : null;
}

function looksLikeHtml(buffer) {
  const prefix = buffer.subarray(0, 512).toString("utf8").trimStart().toLowerCase();
  return prefix.startsWith("<!doctype html") || prefix.startsWith("<html") || prefix.includes("<title>404");
}

function validateBuffer(buffer, destination, contentType) {
  if (!buffer.length) throw new Error("zero-byte payload");
  if (looksLikeHtml(buffer) && path.extname(destination).toLowerCase() !== ".html") {
    throw new Error(`HTML error body for asset (${contentType || "unknown type"})`);
  }
  const extension = path.extname(destination).toLowerCase();
  if (extension === ".json") JSON.parse(buffer.toString("utf8"));
  if (
    extension === ".png"
    && !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    throw new Error("invalid PNG signature");
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error("invalid JPEG signature");
  }
}

async function validateLocalPath(destination) {
  const stat = await fs.stat(destination);
  if (stat.isDirectory()) {
    const files = await walk(destination);
    if (!files.length) throw new Error("empty native asset directory");
    for (const filePath of files) {
      validateBuffer(await fs.readFile(filePath), filePath, "local");
    }
    return;
  }
  validateBuffer(await fs.readFile(destination), destination, "local");
}

async function fetchAsset(url, destination, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Referer: referer,
          "User-Agent": "Mozilla/5.0 Codex authorized local game mirror",
        },
      });
      if (!response.ok) {
        if (response.status < 500 || attempt === attempts) {
          return { ok: false, status: response.status, url };
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      validateBuffer(bytes, destination, response.headers.get("content-type"));
      await fs.mkdir(path.dirname(destination), { recursive: true });
      const temporary = `${destination}.download`;
      await fs.writeFile(temporary, bytes);
      await fs.rename(temporary, destination);
      return {
        ok: true,
        url,
        relative: slash(path.relative(root, destination)),
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
  return { ok: false, status: null, url, error: String(lastError?.message || lastError) };
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

async function inspectManifest(manifestPath) {
  const config = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const bundleDirectory = path.dirname(manifestPath);
  const bundleRelative = slash(path.relative(root, bundleDirectory));
  const imports = [];
  const natives = [];

  for (const pair of pairs(config.versions?.import)) {
    const id = resolveId(config, pair.key);
    const importBase = config.importBase || "import";
    const relativeWithinBundle = `${importBase}/${id.slice(0, 2)}/${id}.${pair.hash}.json`;
    const destination = path.join(bundleDirectory, ...relativeWithinBundle.split("/"));
    const localRelative = slash(path.relative(root, destination));
    imports.push({
      kind: "import",
      bundle: config.name || bundleRelative,
      key: pair.key,
      id,
      hash: pair.hash,
      type: typeForKey(config, pair.key),
      destination,
      relative: localRelative,
      url: remoteUrlFor(localRelative),
      present: await exists(destination),
    });
  }

  for (const pair of pairs(config.versions?.native)) {
    const id = resolveId(config, pair.key);
    const nativeBase = config.nativeBase || "native";
    const existing = await findNativeFile(bundleDirectory, nativeBase, id, pair.hash);
    natives.push({
      kind: "native",
      bundle: config.name || bundleRelative,
      key: pair.key,
      id,
      hash: pair.hash,
      type: typeForKey(config, pair.key),
      bundleDirectory,
      nativeBase,
      present: Boolean(existing),
      destination: existing,
    });
  }

  return {
    name: config.name || bundleRelative,
    manifest: slash(path.relative(root, manifestPath)),
    imports,
    natives,
  };
}

function summarize(bundles) {
  return bundles.map((bundle) => ({
    name: bundle.name,
    manifest: bundle.manifest,
    import: {
      expected: bundle.imports.length,
      present: bundle.imports.filter((asset) => asset.present).length,
      missing: bundle.imports.filter((asset) => !asset.present).length,
    },
    native: {
      expected: bundle.natives.length,
      present: bundle.natives.filter((asset) => asset.present).length,
      missing: bundle.natives.filter((asset) => !asset.present).length,
    },
  }));
}

const allFiles = await walk(root);
const manifestPaths = allFiles
  .filter((filePath) => /^config(\.[^.]+)?\.json$/i.test(path.basename(filePath)))
  .sort();
if (!manifestPaths.length) {
  throw new Error(`No Cocos config.json or config.<hash>.json found under ${root}`);
}

const before = [];
for (const manifestPath of manifestPaths) before.push(await inspectManifest(manifestPath));
const missingImports = before.flatMap((bundle) => bundle.imports).filter((asset) => !asset.present);
const missingNatives = before.flatMap((bundle) => bundle.natives).filter((asset) => !asset.present);
const downloaded = [];
const unresolved = [];

if (!auditOnly) {
  await mapLimit(missingImports, concurrency, async (asset) => {
    const result = await fetchAsset(asset.url, asset.destination);
    if (result.ok) downloaded.push({ kind: asset.kind, bundle: asset.bundle, ...result });
    else unresolved.push({
      kind: asset.kind,
      bundle: asset.bundle,
      id: asset.id,
      hash: asset.hash,
      url: asset.url,
      status: result.status,
      error: result.error,
    });
  });

  await mapLimit(missingNatives, concurrency, async (asset) => {
    const attempts = [];
    for (const extension of extensionCandidates(asset.type)) {
      const withinBundle = `${asset.nativeBase}/${asset.id.slice(0, 2)}/${asset.id}.${asset.hash}${extension}`;
      const destination = path.join(asset.bundleDirectory, ...withinBundle.split("/"));
      const localRelative = slash(path.relative(root, destination));
      const url = remoteUrlFor(localRelative);
      const result = await fetchAsset(url, destination, 2);
      attempts.push({ extension, status: result.status, error: result.error });
      if (result.ok) {
        downloaded.push({ kind: asset.kind, bundle: asset.bundle, ...result });
        return;
      }
    }
    unresolved.push({
      kind: asset.kind,
      bundle: asset.bundle,
      id: asset.id,
      hash: asset.hash,
      type: asset.type,
      attempts,
    });
  });
}

const after = [];
for (const manifestPath of manifestPaths) after.push(await inspectManifest(manifestPath));
const invalid = [];
for (const bundle of after) {
  for (const asset of bundle.imports.filter((candidate) => candidate.present)) {
    try {
      await validateLocalPath(asset.destination);
    } catch (error) {
      invalid.push({ kind: asset.kind, relative: asset.relative, error: String(error.message || error) });
    }
  }
  for (const asset of bundle.natives.filter((candidate) => candidate.present)) {
    try {
      await validateLocalPath(asset.destination);
    } catch (error) {
      invalid.push({
        kind: asset.kind,
        relative: slash(path.relative(root, asset.destination)),
        error: String(error.message || error),
      });
    }
  }
}

const afterSummary = summarize(after);
const remaining = afterSummary.reduce(
  (sum, bundle) => sum + bundle.import.missing + bundle.native.missing,
  0,
);
const report = {
  generatedAt: new Date().toISOString(),
  root,
  defaultRemote: defaultRemote.href,
  remoteMaps,
  referer,
  auditOnly,
  manifests: manifestPaths.map((filePath) => slash(path.relative(root, filePath))),
  before: summarize(before),
  downloaded,
  unresolved,
  invalid,
  after: afterSummary,
  totals: {
    expectedImports: afterSummary.reduce((sum, bundle) => sum + bundle.import.expected, 0),
    expectedNatives: afterSummary.reduce((sum, bundle) => sum + bundle.native.expected, 0),
    downloaded: downloaded.length,
    downloadedBytes: downloaded.reduce((sum, item) => sum + item.bytes, 0),
    unresolved: unresolved.length,
    invalid: invalid.length,
    remaining,
  },
};

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  manifests: report.manifests.length,
  before: report.before,
  after: report.after,
  totals: report.totals,
  report: reportPath,
}, null, 2));

if (remaining || unresolved.length || invalid.length) process.exitCode = 2;
