#!/usr/bin/env node
// Biến *-api.json (do capture-runtime.mjs --capture-api ghi) thành bộ fixture
// api-mock/ dùng lại được ở MỌI bước sau: serve-local.py --api-mock, và lớp
// ApiMock trong project đã port.
//
// Hợp đồng (3 skill port đều dựa vào đúng file này, đừng đổi hình dạng):
//   api-mock/index.json          { generatedAt, entries: [...] }
//   api-mock/bodies/<id>.<ext>   body thật đã ghi lại
//   api-mock/index.inline.json   như trên nhưng NHÚNG body vào từng entry —
//                                bản dùng cho project đã port (không cần URL,
//                                chạy được cả trên native/minigame)
//   api-mock/client/*.js         lớp chặn fetch/XHR + fake ads, copy sẵn vào đây
//
// client/ được copy vào OUTPUT có chủ ý: bước port sau này lấy code từ MIRROR,
// không phải từ thư mục skill — mirror tự mang đủ thứ nó cần.
//
// entry: { id, method, host, path, query, status, contentType, bodyFile,
//          bytes, postData, calls }
// Khớp theo method + path. Cùng path gọi nhiều lần → nhiều entry, phát theo thứ
// tự rồi lặp lại entry cuối (xem references/api-mock.md).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_FILES = ["api-mock-client.js", "fake-ads-client.js"];

const argv = process.argv.slice(2);

function valuesAfter(name) {
  const output = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === name && argv[index + 1] !== undefined) output.push(argv[index + 1]);
  }
  return output;
}

function valueAfter(name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
}

const inputs = valuesAfter("--api");
const outRoot = valueAfter("--out");
if (!inputs.length || !outRoot) {
  console.error("cần --api <label-api.json> (lặp được) --out <thư-mục api-mock>");
  process.exit(1);
}

const EXT_BY_TYPE = [
  [/json/i, "json"],
  [/xml/i, "xml"],
  [/html/i, "html"],
  [/javascript/i, "js"],
  [/text/i, "txt"],
];

function extensionFor(contentType) {
  const hit = EXT_BY_TYPE.find(([re]) => re.test(contentType || ""));
  return hit ? hit[1] : "bin";
}

function slugify(value) {
  return String(value).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60)
    || "root";
}

const calls = [];
for (const input of inputs) {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) throw new Error(`Không thấy ${resolved}`);
  const parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${resolved} không phải mảng api call`);
  calls.push(...parsed);
}

const outDir = path.resolve(outRoot);
const bodiesDir = path.join(outDir, "bodies");
const clientDir = path.join(outDir, "client");
fs.mkdirSync(bodiesDir, { recursive: true });
fs.mkdirSync(clientDir, { recursive: true });
for (const file of CLIENT_FILES) {
  const source = path.join(here, file);
  if (!fs.existsSync(source)) throw new Error(`Thiếu ${source} — file này đi kèm skill`);
  fs.copyFileSync(source, path.join(clientDir, file));
}

const seen = new Map();
const entries = [];
const skipped = [];

for (const call of calls) {
  if (call.type === "WebSocket") {
    // WebSocket không replay được bằng fixture tĩnh — nêu tên để người làm biết
    // phải viết mock riêng, đừng im lặng bỏ qua.
    skipped.push({ url: call.url, why: "WebSocket — cần mock riêng, fixture tĩnh không đủ" });
    continue;
  }
  if (call.body === undefined) {
    skipped.push({ url: call.url, why: call.bodyError || "không lấy được body" });
    continue;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(call.url);
  } catch {
    skipped.push({ url: call.url, why: "URL không parse được" });
    continue;
  }

  const key = `${call.method} ${parsedUrl.pathname}`;
  const order = (seen.get(key) || 0) + 1;
  seen.set(key, order);

  const id = `${call.method.toLowerCase()}_${slugify(parsedUrl.pathname)}_${order}`;
  const extension = extensionFor(call.mimeType || call.contentType);
  const bodyFile = `bodies/${id}.${extension}`;
  fs.writeFileSync(path.join(outDir, bodyFile), call.body, "utf8");

  entries.push({
    id,
    method: call.method,
    host: parsedUrl.host,
    path: parsedUrl.pathname,
    query: parsedUrl.search ? parsedUrl.search.slice(1) : "",
    status: call.status ?? 200,
    contentType: call.mimeType || "application/json",
    bodyFile,
    bytes: Buffer.byteLength(call.body, "utf8"),
    postData: call.postData ?? null,
    order,
  });
}

const index = {
  generatedAt: new Date().toISOString(),
  sources: inputs.map((input) => path.resolve(input)),
  counts: {
    captured: calls.length,
    entries: entries.length,
    skipped: skipped.length,
    hosts: [...new Set(entries.map((entry) => entry.host))].length,
  },
  hosts: [...new Set(entries.map((entry) => entry.host))].sort(),
  client: CLIENT_FILES.map((file) => `client/${file}`),
  entries,
  skipped,
};

fs.writeFileSync(path.join(outDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");

// Bản inline: cùng schema, mỗi entry thêm bodyText. Project đã port nạp file này
// như một JsonAsset rồi gọi __installApiMock({ index }) — không cần base URL.
const inline = {
  ...index,
  inline: true,
  entries: index.entries.map((entry) => ({
    ...entry,
    bodyText: fs.readFileSync(path.join(outDir, entry.bodyFile), "utf8"),
  })),
};
fs.writeFileSync(
  path.join(outDir, "index.inline.json"),
  `${JSON.stringify(inline, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify({
  out: outDir,
  counts: index.counts,
  hosts: index.hosts,
  skipped,
}, null, 2));

// Không có entry nào = chưa mock được gì. Fail để người gọi không tưởng là xong.
if (!entries.length) process.exitCode = 2;
