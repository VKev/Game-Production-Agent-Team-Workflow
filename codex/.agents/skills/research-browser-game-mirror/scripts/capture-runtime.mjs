#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";

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

const targetUrl = required("--url");
const outputDirectory = path.resolve(required("--out"));
const label = valueAfter("--label", "capture").replace(/[^a-zA-Z0-9_-]+/g, "-");
const waitMs = Math.max(1000, Number(valueAfter("--wait-ms", "30000")) || 30000);
const width = Math.max(320, Number(valueAfter("--width", "430")) || 430);
const height = Math.max(320, Number(valueAfter("--height", "932")) || 932);
const evalFile = valueAfter("--eval-file");
const evalAfterMs = Math.max(
  0,
  Math.min(waitMs, Number(valueAfter("--eval-after-ms", String(Math.floor(waitMs / 2)))) || 0),
);
const hostRules = valuesAfter("--host-rule");
const captureApi = argv.includes("--capture-api");
// Chỉ những loại request này mới là "API" — asset (Image/Media/Font/Script) bị loại ra.
const API_TYPES = new Set(["XHR", "Fetch", "EventSource", "WebSocket"]);

function findBrowser() {
  const explicit = valueAfter("--browser-path");
  const candidates = [
    explicit,
    process.env.EDGE_PATH,
    process.env.CHROME_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe")
      : null,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ].filter(Boolean);
  const found = candidates.find(existsSync);
  if (!found) throw new Error("Chrome/Edge not found. Pass --browser-path <executable>.");
  return found;
}

function getFreePort() {
  return new Promise((resolvePromise, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePromise(address.port));
    });
  });
}

async function getJson(port, pathname) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
      if (response.ok) return await response.json();
    } catch {
      // Browser is still starting.
    }
    await wait(150);
  }
  throw new Error(`DevTools endpoint not ready: ${pathname}`);
}

function connect(webSocketUrl) {
  if (typeof WebSocket !== "function") {
    throw new Error("This script requires a Node runtime with global WebSocket support.");
  }
  const socket = new WebSocket(webSocketUrl);
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve: resolvePromise, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolvePromise(message.result);
      return;
    }
    for (const listener of listeners) listener(message);
  });

  return new Promise((resolvePromise, reject) => {
    socket.addEventListener("open", () => resolvePromise({
      send(method, params = {}) {
        nextId += 1;
        socket.send(JSON.stringify({ id: nextId, method, params }));
        return new Promise((resolveCommand, rejectCommand) => {
          pending.set(nextId, { resolve: resolveCommand, reject: rejectCommand });
        });
      },
      onMessage(listener) {
        listeners.add(listener);
      },
      close() {
        socket.close();
      },
    }), { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    wait(timeoutMs).then(() => {
      throw new Error(`${message} timed out after ${timeoutMs} ms`);
    }),
  ]);
}

mkdirSync(outputDirectory, { recursive: true });
const browserPath = findBrowser();
const debugPort = await getFreePort();
const profile = mkdtempSync(path.join(os.tmpdir(), "codex-game-capture-"));
const browserArguments = [
  "--headless=new",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  `--window-size=${width},${height}`,
  ...(hostRules.length ? [`--host-resolver-rules=${hostRules.join(",")}`] : []),
  ...(argv.includes("--ignore-certificate-errors") ? ["--ignore-certificate-errors"] : []),
  "about:blank",
];
const browser = spawn(browserPath, browserArguments, {
  stdio: "ignore",
  windowsHide: true,
});

const requests = new Map();
const consoleEntries = [];
const apiCalls = new Map();
const apiJobs = [];
let cdp;

try {
  const pages = await getJson(debugPort, "/json");
  const page = pages.find((candidate) => candidate.type === "page") || pages[0];
  cdp = await connect(page.webSocketDebuggerUrl);
  cdp.onMessage((message) => {
    if (message.method === "Network.requestWillBeSent") {
      requests.set(message.params.requestId, {
        url: message.params.request.url,
        method: message.params.request.method,
        type: message.params.type,
        initiator: message.params.initiator?.type,
      });
      if (captureApi && API_TYPES.has(message.params.type)) {
        apiCalls.set(message.params.requestId, {
          url: message.params.request.url,
          method: message.params.request.method,
          type: message.params.type,
          requestHeaders: message.params.request.headers,
          postData: message.params.request.postData ?? null,
          hasPostData: Boolean(message.params.request.hasPostData),
        });
      }
    } else if (message.method === "Network.responseReceived") {
      const request = requests.get(message.params.requestId) || {};
      Object.assign(request, {
        status: message.params.response.status,
        mimeType: message.params.response.mimeType,
        protocol: message.params.response.protocol,
        fromDiskCache: message.params.response.fromDiskCache,
        fromServiceWorker: message.params.response.fromServiceWorker,
      });
      requests.set(message.params.requestId, request);
      const call = apiCalls.get(message.params.requestId);
      if (call) {
        call.status = message.params.response.status;
        call.mimeType = message.params.response.mimeType;
        call.responseHeaders = message.params.response.headers;
      }
    } else if (message.method === "Network.loadingFinished") {
      const request = requests.get(message.params.requestId) || {};
      request.encodedDataLength = message.params.encodedDataLength;
      requests.set(message.params.requestId, request);
      const call = apiCalls.get(message.params.requestId);
      if (call) {
        // Body phải lấy NGAY khi request xong — Chrome evict buffer sau đó.
        apiJobs.push((async () => {
          try {
            const body = await cdp.send("Network.getResponseBody", {
              requestId: message.params.requestId,
            });
            call.body = body.base64Encoded
              ? Buffer.from(body.body, "base64").toString("utf8")
              : body.body;
            call.base64Encoded = Boolean(body.base64Encoded);
          } catch (error) {
            call.bodyError = String(error.message || error);
          }
          if (call.hasPostData && !call.postData) {
            try {
              const post = await cdp.send("Network.getRequestPostData", {
                requestId: message.params.requestId,
              });
              call.postData = post.postData ?? null;
            } catch {
              // POST body đã bị evict — không chặn capture.
            }
          }
        })());
      }
    } else if (message.method === "Network.loadingFailed") {
      const request = requests.get(message.params.requestId) || {};
      Object.assign(request, {
        failed: true,
        errorText: message.params.errorText,
        blockedReason: message.params.blockedReason,
      });
      requests.set(message.params.requestId, request);
    } else if (message.method === "Runtime.consoleAPICalled") {
      consoleEntries.push({
        level: message.params.type,
        text: message.params.args
          .map((argument) => argument.value ?? argument.description ?? "")
          .join(" "),
        timestamp: message.params.timestamp,
      });
    } else if (message.method === "Runtime.exceptionThrown") {
      consoleEntries.push({
        level: "exception",
        text: message.params.exceptionDetails.exception?.description
          ?? message.params.exceptionDetails.text,
        timestamp: message.params.timestamp,
      });
    }
  });

  await cdp.send("Page.enable");
  await cdp.send("Network.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: targetUrl });

  if (evalFile) {
    await wait(evalAfterMs);
    const expression = readFileSync(path.resolve(evalFile), "utf8");
    const evaluation = await cdp.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (evaluation.exceptionDetails) {
      throw new Error(evaluation.exceptionDetails.exception?.description || "eval-file failed");
    }
    await wait(waitMs - evalAfterMs);
  } else {
    await wait(waitMs);
  }

  const network = [...requests.values()]
    .filter((request) => request.url)
    .sort((a, b) => a.url.localeCompare(b.url));
  const stateResult = await withTimeout(cdp.send("Runtime.evaluate", {
    expression: `JSON.stringify({
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      bodyText: document.body?.innerText?.slice(0, 5000),
      canvasCount: document.querySelectorAll?.("canvas")?.length,
      iframeCount: document.querySelectorAll?.("iframe")?.length
    })`,
    returnByValue: true,
  }), 5000, "state capture");
  let screenshotError = null;
  try {
    const screenshot = await withTimeout(
      cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true }),
      10000,
      "screenshot",
    );
    writeFileSync(
      path.join(outputDirectory, `${label}-screenshot.png`),
      Buffer.from(screenshot.data, "base64"),
    );
  } catch (error) {
    screenshotError = String(error.message || error);
  }

  const targetOrigin = new URL(targetUrl).origin;
  const failed = network.filter((request) => request.failed || Number(request.status) >= 400);
  const hosts = [...new Set(network.map((request) => {
    try {
      return new URL(request.url).host;
    } catch {
      return null;
    }
  }).filter(Boolean))].sort();
  const summary = {
    generatedAt: new Date().toISOString(),
    targetUrl,
    targetOrigin,
    browserPath,
    waitMs,
    requestCount: network.length,
    failedCount: failed.length,
    exceptionCount: consoleEntries.filter((entry) => entry.level === "exception").length,
    errorCount: consoleEntries.filter((entry) => entry.level === "error").length,
    hosts,
    screenshotError,
  };

  writeFileSync(
    path.join(outputDirectory, `${label}-network.json`),
    `${JSON.stringify(network, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    path.join(outputDirectory, `${label}-console.json`),
    `${JSON.stringify(consoleEntries, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    path.join(outputDirectory, `${label}-state.json`),
    `${stateResult.result.value ?? "{}"}\n`,
    "utf8",
  );
  if (captureApi) {
    await Promise.allSettled(apiJobs);
    const calls = [...apiCalls.values()].filter((call) => call.status !== undefined);
    writeFileSync(
      path.join(outputDirectory, `${label}-api.json`),
      `${JSON.stringify(calls, null, 2)}\n`,
      "utf8",
    );
    summary.apiCalls = calls.length;
    summary.apiHosts = [...new Set(calls.map((call) => {
      try {
        return new URL(call.url).host;
      } catch {
        return null;
      }
    }).filter(Boolean))].sort();
  }

  writeFileSync(
    path.join(outputDirectory, `${label}-summary.json`),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(summary, null, 2));
} finally {
  try {
    cdp?.close();
  } catch {
    // Ignore cleanup errors.
  }
  browser.kill();
  await wait(500);
  rmSync(profile, { recursive: true, force: true });
}
