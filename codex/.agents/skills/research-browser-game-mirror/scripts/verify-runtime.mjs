#!/usr/bin/env node
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

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(path.resolve(filePath), "utf8"));
}

function networkEntries(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.requests)) return parsed.requests;
  if (Array.isArray(parsed.entries)) return parsed.entries;
  if (Array.isArray(parsed.log?.entries)) {
    return parsed.log.entries.map((entry) => ({
      url: entry.request?.url,
      method: entry.request?.method,
      status: entry.response?.status,
      mimeType: entry.response?.content?.mimeType,
      failed: entry.response?.status === 0,
      errorText: entry.response?._error,
    }));
  }
  throw new Error("Unsupported network JSON schema.");
}

function consoleEntries(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.entries)) return parsed.entries;
  if (Array.isArray(parsed.console)) return parsed.console;
  throw new Error("Unsupported console JSON schema.");
}

function compilePatterns(values, optionName) {
  return values.map((value) => {
    try {
      return new RegExp(value, "i");
    } catch (error) {
      throw new Error(`Invalid ${optionName} regex "${value}": ${error.message}`);
    }
  });
}

function normalizedOrigin(raw) {
  const parsed = new URL(raw);
  return parsed.origin;
}

function isIgnored(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

const networkPath = required("--network");
const consolePath = required("--console");
const localOrigin = normalizedOrigin(required("--local-origin"));
const allowHosts = new Set(valuesAfter("--allow-host").map((host) => host.toLowerCase()));
const ignoreConsolePatterns = compilePatterns(
  valuesAfter("--ignore-console-pattern"),
  "--ignore-console-pattern",
);
// Trình duyệt tự xin /favicon.ico ở mọi trang; 404 của nó không liên quan tới
// mirror. Để nó vào failedRequests thì contract fail ở CẢ bản mirror đủ — và cái
// gate nào cũng đỏ thì người ta thôi đọc gate.
const DEFAULT_IGNORE_URL_PATTERNS = ["/favicon\\.ico(\\?|$)"];

const ignoreUrlPatterns = compilePatterns(
  [...DEFAULT_IGNORE_URL_PATTERNS, ...valuesAfter("--ignore-url-pattern")],
  "--ignore-url-pattern",
);
const reportPath = path.resolve(valueAfter(
  "--report",
  path.join(path.dirname(path.resolve(networkPath)), "runtime-verification.json"),
));

const network = networkEntries(await readJson(networkPath));
const consoleLog = consoleEntries(await readJson(consolePath));

const failedRequests = network.filter((request) => {
  const url = String(request.url || "");
  if (isIgnored(url, ignoreUrlPatterns)) return false;
  return Boolean(request.failed)
    || Number(request.status) >= 400
    || (request.status !== undefined && Number(request.status) === 0);
});

const blockingConsole = consoleLog.filter((entry) => {
  const level = String(entry.level || entry.type || "").toLowerCase();
  const text = String(entry.text || entry.message || entry.description || "");
  if (!["error", "exception", "assert"].includes(level)) return false;
  return !isIgnored(text, ignoreConsolePatterns);
});

const externalRequests = [];
for (const request of network) {
  const rawUrl = String(request.url || "");
  if (!rawUrl || isIgnored(rawUrl, ignoreUrlPatterns)) continue;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    continue;
  }
  if (!["http:", "https:", "ws:", "wss:"].includes(parsed.protocol)) continue;
  if (parsed.origin === localOrigin) continue;
  if (allowHosts.has(parsed.hostname.toLowerCase()) || allowHosts.has(parsed.host.toLowerCase())) {
    continue;
  }
  externalRequests.push({
    url: rawUrl,
    method: request.method,
    status: request.status,
    type: request.type,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  inputs: {
    networkPath: path.resolve(networkPath),
    consolePath: path.resolve(consolePath),
    localOrigin,
  },
  policy: {
    allowHosts: [...allowHosts].sort(),
    ignoreConsolePatterns: ignoreConsolePatterns.map((pattern) => pattern.source),
    ignoreUrlPatterns: ignoreUrlPatterns.map((pattern) => pattern.source),
    defaultIgnoredUrlPatterns: DEFAULT_IGNORE_URL_PATTERNS,
  },
  counts: {
    requests: network.length,
    failedRequests: failedRequests.length,
    consoleEntries: consoleLog.length,
    blockingConsole: blockingConsole.length,
    externalRequests: externalRequests.length,
  },
  passed: failedRequests.length === 0
    && blockingConsole.length === 0
    && externalRequests.length === 0,
  failedRequests,
  blockingConsole,
  externalRequests,
};

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  passed: report.passed,
  counts: report.counts,
  report: reportPath,
}, null, 2));

if (!report.passed) process.exitCode = 2;
