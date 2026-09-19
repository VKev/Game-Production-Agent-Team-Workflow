#!/usr/bin/env python3
"""
serve-local.py — dựng bản build HTML5 chạy được trên máy để NGƯỜI chơi thử.

Đây là cổng kiểm quan trọng nhất của GĐ0: không chơi được bản gốc thì không có
ground truth, và mọi so sánh ở các giai đoạn sau đều vô nghĩa.

Chỉ dùng thư viện chuẩn Python 3 — KHÔNG cần node, không cần pip install.
KHÔNG ghi đè bất kỳ file nào trong thư mục build: mọi thứ vá đều tiêm on-the-fly
khi trả response, nên bản mirror luôn giữ nguyên trạng làm nguồn đối chiếu.

    python3 serve-local.py --root <thư-mục-build>
    python3 serve-local.py --root <build> --stub --watchdog --portrait 9:16

Cờ:
    --stub            tiêm shim SDK (wx/tt/swan/qq + global tuỳ ý) trả Promise
                      ĐÃ resolve, và GHI LOG mọi lời gọi SDK. Chữa bệnh "màn
                      đen không báo lỗi" do SDK nhà phát hành không có offline.
    --sdk-global NAME thêm một global SDK nữa để shim (lặp lại được).
                      VD: --sdk-global VNGGamesSDK --sdk-global FBInstant
    --watchdog        báo ra console + overlay nếu sau N giây engine chưa vẽ frame nào.
    --portrait W:H    mở thêm /play.html bọc game trong khung dọc. Dùng khi build
                      là portrait mobile mà bạn mở trên desktop ngang — nếu không
                      resizeWithBrowserSize sẽ thổi UI to gấp mấy lần.
    --api-mock DIR    tiêm lớp chặn fetch/XHR, trả fixture đã ghi trong DIR
                      (api-mock/ do build-api-mock.mjs sinh). Game gọi API thật
                      sẽ nhận lại đúng response đã capture, không cần mạng.
    --fake-ads        tiêm lớp quảng cáo giả: mọi rewarded/interstitial đều
                      "xem xong" ngay, phần thưởng luôn được trao.
    --port N          cổng (mặc định 8124). --port 0 = để OS chọn cổng trống,
                      cổng thật được in ra stdout (dùng khi chạy song song).
"""

import argparse
import http.server
import json
import mimetypes
import os
import re
import socketserver
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))


def _read_sibling(name):
    """Đọc file JS nằm cạnh script này. Thiếu file thì báo rõ, đừng tiêm rỗng."""
    path = os.path.join(HERE, name)
    if not os.path.isfile(path):
        sys.exit(f"thiếu {path} — file này đi kèm skill, đừng tách rời")
    with open(path, encoding="utf-8") as handle:
        return handle.read()

EXTRA_MIME = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".json": "application/json",
    ".wasm": "application/wasm",
    ".bin": "application/octet-stream",
    ".dbbin": "application/octet-stream",
    ".fire": "application/json",
    ".plist": "application/xml",
    ".atlas": "text/plain",
    ".skel": "application/octet-stream",
}

# --------------------------------------------------------------- SDK stub ---

STUB_JS = r"""
/* triage SDK stub — tiêm bởi serve-local.py, KHÔNG có trong build gốc.
   Mục tiêu: mọi lời gọi SDK nền tảng đều trả về ngay một payload hợp lệ,
   và được ghi lại để chẩn đoán. Game gốc thường .then() thẳng vào kết quả,
   nên trả undefined là treo. */
(function () {
  var LOG = (window.__triageSdkLog = []);
  var t0 = Date.now();
  function rec(path, args) {
    var e = { t: Date.now() - t0, call: path, args: Array.prototype.slice.call(args, 0, 3) };
    LOG.push(e);
    console.log('[triage-sdk]', e.t + 'ms', path, e.args);
  }
  /* isEnded/rewarded: SDK minigame dùng chúng để biết người chơi đã xem hết
     quảng cáo. Thiếu là luồng "xem quảng cáo nhận thưởng" đứng im. */
  var OK = function () {
    return { code: 0, errCode: 0, errMsg: 'ok', data: {}, isLogin: true,
             isEnded: true, rewarded: true };
  };

  /* Proxy bắt mọi thuộc tính chưa biết → luôn là hàm gọi được, trả Promise đã resolve
     và đồng thời gọi success/complete callback nếu có (kiểu minigame API). */
  function makeSdk(name) {
    var target = function () {};
    return new Proxy(target, {
      get: function (_t, prop) {
        if (prop === 'then') return undefined;          // đừng để bị coi là thenable
        if (typeof prop === 'symbol') return undefined;
        if (prop === 'env') return { USER_DATA_PATH: '/tmp' };
        return makeSdk(name + '.' + String(prop));
      },
      apply: function (_t, _this, args) {
        rec(name, args);
        var opt = args && args[0];
        var res = OK();
        if (opt && typeof opt === 'object') {
          if (typeof opt.success === 'function') setTimeout(function () { opt.success(res); }, 0);
          if (typeof opt.complete === 'function') setTimeout(function () { opt.complete(res); }, 0);
        }
        if (args) for (var i = 0; i < args.length; i++)
          if (typeof args[i] === 'function') { var cb = args[i]; setTimeout(function () { cb(res); }, 0); }
        var p = Promise.resolve(res);
        /* nhiều SDK trả object có .then + phương thức riêng (ad, banner…) */
        p.show = p.hide = p.load = p.destroy = p.offLoad = p.offError = p.offClose =
          function () { return p; };
        p.onLoad = p.onError = p.onClose = function (f) { if (typeof f === 'function') setTimeout(function () { f(res); }, 0); return p; };
        return p;
      },
      construct: function (_t, args) { rec('new ' + name, args); return makeSdk(name); },
    });
  }

  __SDK_GLOBALS__.forEach(function (g) {
    if (!window[g]) { window[g] = makeSdk(g); console.log('[triage-sdk] shim global:', g); }
    else console.log('[triage-sdk] bỏ qua (đã tồn tại):', g);
  });

  window.__triageSdkReport = function () {
    console.table(LOG);
    return LOG;
  };
})();
"""

WATCHDOG_JS = r"""
/* triage watchdog — báo khi engine không vẽ được frame nào. */
(function () {
  var SECS = __WD_SECS__, frames = 0, started = Date.now();
  (function tick() { frames++; requestAnimationFrame(tick); })();
  function overlay(msg) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;background:#b00;color:#fff;' +
      'font:13px/1.5 monospace;padding:10px;white-space:pre-wrap';
    d.textContent = msg;
    document.body.appendChild(d);
  }
  setTimeout(function () {
    var cc = window.cc;
    var booted = !!(cc && cc.director && cc.director.getScene && cc.director.getScene());
    var lines = [
      '[triage-watchdog] ' + SECS + 's: rAF frames=' + frames,
      'cc = ' + (cc ? ('có, ENGINE_VERSION=' + cc.ENGINE_VERSION) : 'CHƯA NẠP'),
      'scene đang chạy = ' + (booted ? cc.director.getScene().name : 'KHÔNG CÓ'),
      'lời gọi SDK đã bắt = ' + ((window.__triageSdkLog || []).length) +
        ' (gõ __triageSdkReport() để xem bảng)',
    ];
    if (!booted) {
      lines.push('', 'CHẨN ĐOÁN: engine chưa chạy scene nào.');
      lines.push('- SDK log rỗng  → boot chết TRƯỚC khi gọi SDK: xem lỗi mạng/404 ở tab Network.');
      lines.push('- SDK log có mục → xem lời gọi CUỐI cùng: nhiều khả năng game đang chờ nó.');
      overlay(lines.join('\n'));
    }
    console.log(lines.join('\n'));
  }, SECS * 1000);
})();
"""

PLAY_HTML = r"""<!doctype html><html><head><meta charset="utf-8">
<title>triage — khung dọc</title>
<style>
 html,body{margin:0;height:100%;background:#111;display:flex;align-items:center;
   justify-content:center;font:13px monospace;color:#888}
 #wrap{height:100vh;aspect-ratio:__RATIO__;max-width:100vw;box-shadow:0 0 40px #000}
 iframe{width:100%;height:100%;border:0;display:block}
 #hint{position:fixed;left:8px;bottom:8px}
</style></head><body>
<div id="wrap"><iframe id="g" src="__SRC__" allow="autoplay; fullscreen"></iframe></div>
<div id="hint">khung dọc __RATIO__ — build portrait mở trên desktop ngang sẽ vỡ layout nếu không bọc</div>
</body></html>
"""


def build_stub(globals_):
    return STUB_JS.replace("__SDK_GLOBALS__", repr(list(globals_)).replace("'", '"'))


# ------------------------------------------------------------------ server ---


class Handler(http.server.SimpleHTTPRequestHandler):
    cfg = None  # gán ở main()

    def log_message(self, fmt, *args):
        # chỉ log lỗi — 200 quá ồn khi game nạp 200+ asset
        if args and str(args[1]).startswith(("4", "5")):
            sys.stderr.write("  %s %s\n" % (args[1], args[0]))

    def guess_type(self, path):
        return self._type_and_encoding(path)[0]

    @staticmethod
    def _type_and_encoding(path):
        """Trả (Content-Type, Content-Encoding) — xử lý cả file nén sẵn.

        `.wasm.br` phải là `application/wasm` + `Content-Encoding: br`, KHÔNG
        phải `application/brotli`. Sai chỗ này browser không giải nén được và
        triệu chứng hiện ra y hệt "asset hỏng" — bẫy im lặng, rất tốn công truy.
        """
        enc = None
        base = path
        low = path.lower()
        for suffix, e in ((".br", "br"), (".gz", "gzip"), (".zst", "zstd")):
            if low.endswith(suffix):
                enc, base = e, path[: -len(suffix)]
                break
        ext = os.path.splitext(base)[1].lower()
        ctype = EXTRA_MIME.get(ext)
        if not ctype:
            ctype = mimetypes.guess_type(base)[0]
        return (ctype or "application/octet-stream"), enc

    def _serve_static(self, fs):
        """Gửi file tĩnh, có hỗ trợ HTTP Range (206) và Content-Encoding.

        SimpleHTTPRequestHandler bỏ qua header `Range:` và luôn trả 200 kèm
        full body — Unity WebGL `.data` lớn, audio/video seek và asset stream
        đều hỏng vì thế. Nên phải tự gửi.
        """
        ctype, enc = self._type_and_encoding(fs)
        try:
            st = os.stat(fs)
        except OSError:
            return self.send_error(404, "File not found")
        size = st.st_size
        start, end, status = 0, size - 1, 200

        rng = self.headers.get("Range")
        if rng:
            m = re.match(r"bytes=(\d*)-(\d*)\s*$", rng.strip(), re.I)
            if m:
                s, e = m.group(1), m.group(2)
                if s == "":
                    if e == "":
                        return self.send_error(400, "Bad Range")
                    start, end = max(0, size - int(e)), size - 1
                else:
                    start = int(s)
                    end = int(e) if e else size - 1
                if start >= size or start > end:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                end = min(end, size - 1)
                status = 206

        length = end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        if enc:
            # Content-Length luôn là số byte TRÊN ĐĨA (đã nén), không phải sau giải nén
            self.send_header("Content-Encoding", enc)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Last-Modified", self.date_time_string(st.st_mtime))
        self.end_headers()

        if self.command == "HEAD":
            return
        with open(fs, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return  # trình duyệt huỷ range request giữa chừng — bình thường
                remaining -= len(chunk)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        # COOP/COEP chỉ cần cho build dùng wasm-threads/SharedArrayBuffer, và nó
        # CHẶN mọi subresource cross-origin — bật mặc định là tự tạo lỗi. Opt-in.
        if self.cfg.coep:
            self.send_header("Cross-Origin-Opener-Policy", "same-origin")
            self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()

    def _send_bytes(self, body, ctype):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        cfg = self.cfg
        path = urllib.parse.urlparse(self.path).path

        if path == "/__triage/stub.js":
            return self._send_bytes(build_stub(cfg.sdk_globals).encode(), "text/javascript")
        if path == "/__triage/apimock-config.js":
            payload = "window.__API_MOCK__=%s;" % json.dumps(
                {"base": "/__mock", "index": cfg.api_index}, ensure_ascii=False
            )
            return self._send_bytes(payload.encode("utf-8"), "text/javascript")
        if path == "/__triage/apimock.js":
            return self._send_bytes(_read_sibling("api-mock-client.js").encode("utf-8"),
                                    "text/javascript")
        if path == "/__triage/fakeads.js":
            return self._send_bytes(_read_sibling("fake-ads-client.js").encode("utf-8"),
                                    "text/javascript")
        if path.startswith("/__mock/"):
            target = os.path.join(cfg.api_mock, path[len("/__mock/"):])
            if not os.path.isfile(target):
                return self.send_error(404, "fixture not found")
            return self._serve_static(target)
        if path == "/__triage/watchdog.js":
            js = WATCHDOG_JS.replace("__WD_SECS__", str(cfg.watchdog_secs))
            return self._send_bytes(js.encode(), "text/javascript")
        if path == "/play.html":
            html = PLAY_HTML.replace("__RATIO__", cfg.portrait or "9/16").replace(
                "__SRC__", cfg.entry
            )
            return self._send_bytes(html.encode(), "text/html; charset=utf-8")

        # tiêm vào mọi trang HTML, không ghi ra đĩa
        fs = self.translate_path(path)
        if os.path.isdir(fs):
            fs = os.path.join(fs, "index.html")
        inject_any = cfg.stub or cfg.watchdog or cfg.api_mock or cfg.fake_ads
        if fs.lower().endswith(".html") and os.path.isfile(fs) and inject_any:
            with open(fs, "rb") as f:
                html = f.read().decode("utf-8", "replace")
            tags = []
            # api-mock phải đứng TRƯỚC code game: patch fetch/XHR sau khi game
            # đã gọi API lần đầu là quá muộn.
            if cfg.api_mock:
                tags.append('<script src="/__triage/apimock-config.js"></script>')
                tags.append('<script src="/__triage/apimock.js"></script>')
            if cfg.stub:
                tags.append('<script src="/__triage/stub.js"></script>')
            # fake-ads đứng SAU stub: nó vá đè createRewardedVideoAd của stub.
            if cfg.fake_ads:
                tags.append('<script src="/__triage/fakeads.js"></script>')
            if cfg.watchdog:
                tags.append('<script src="/__triage/watchdog.js"></script>')
            inject = "\n" + "\n".join(tags) + "\n"
            m = re.search(r"<head[^>]*>", html, re.I)
            if m:
                html = html[: m.end()] + inject + html[m.end() :]
            else:
                html = inject + html
            return self._send_bytes(html.encode("utf-8"), "text/html; charset=utf-8")

        if not os.path.isfile(fs):
            return self.send_error(404, "File not found")
        return self._serve_static(fs)

    # HEAD đi qua đúng đường của GET để Range/Content-Encoding nhất quán
    do_HEAD = do_GET

    def do_POST(self):
        """POST thẳng tới server (sendBeacon, form) — lớp chặn phía client không
        bắt được. Có api-mock thì trả fixture khớp path, không thì 204 để game
        không kẹt ở callback lỗi."""
        path = urllib.parse.urlparse(self.path).path
        length = int(self.headers.get("Content-Length") or 0)
        if length:
            self.rfile.read(length)
        cfg = self.cfg
        if cfg.api_mock:
            for entry in cfg.api_index.get("entries", []):
                if entry.get("method", "").upper() == "POST" and entry.get("path") == path:
                    target = os.path.join(cfg.api_mock, entry["bodyFile"])
                    if os.path.isfile(target):
                        with open(target, "rb") as handle:
                            body = handle.read()
                        return self._send_bytes(body, entry.get("contentType", "application/json"))
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()


def main():
    ap = argparse.ArgumentParser(description="Chạy thử bản build HTML5 ở local")
    ap.add_argument("--root", required=True)
    ap.add_argument("--port", type=int, default=8124)
    ap.add_argument("--entry", default="/index.html", help="trang vào (mặc định /index.html)")
    ap.add_argument("--stub", action="store_true", help="tiêm shim SDK nền tảng")
    ap.add_argument(
        "--sdk-global", action="append", default=[], dest="extra_globals",
        help="tên global SDK cần shim thêm, lặp lại được",
    )
    ap.add_argument("--watchdog", action="store_true")
    ap.add_argument("--watchdog-secs", type=int, default=20)
    ap.add_argument("--portrait", default=None, metavar="W:H",
                    help="mở thêm /play.html bọc game trong khung dọc, vd 9:16")
    ap.add_argument("--coep", action="store_true",
                    help="bật COOP/COEP — chỉ cần cho build wasm-threads/SharedArrayBuffer")
    ap.add_argument("--api-mock", default=None, metavar="DIR", dest="api_mock",
                    help="thư mục api-mock/ (có index.json) để trả fixture API")
    ap.add_argument("--fake-ads", action="store_true", dest="fake_ads",
                    help="mọi quảng cáo rewarded/interstitial đều xem-xong-ngay")
    a = ap.parse_args()

    root = os.path.abspath(a.root)
    if not os.path.isdir(root):
        sys.exit(f"không thấy thư mục: {root}")
    a.sdk_globals = ["wx", "tt", "swan", "qq"] + a.extra_globals
    if a.portrait:
        a.portrait = a.portrait.replace(":", "/")

    a.api_index = {"entries": []}
    if a.api_mock:
        a.api_mock = os.path.abspath(a.api_mock)
        index_path = os.path.join(a.api_mock, "index.json")
        if not os.path.isfile(index_path):
            sys.exit(f"không thấy {index_path} — chạy build-api-mock.mjs trước")
        with open(index_path, encoding="utf-8") as handle:
            a.api_index = json.load(handle)

    Handler.cfg = a
    handler = lambda *args, **kw: Handler(*args, directory=root, **kw)  # noqa: E731

    class Srv(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
        daemon_threads = True

    with Srv(("127.0.0.1", a.port), handler) as httpd:
        # --port 0 → OS cấp cổng trống; phải in cổng THẬT ra, không phải số 0.
        actual_port = httpd.server_address[1]
        base = f"http://127.0.0.1:{actual_port}"
        print(f"\n  phục vụ : {root}")
        print(f"  game    : {base}{a.entry}")
        if a.portrait:
            print(f"  khung dọc: {base}/play.html   ← dùng cái này nếu build là portrait")
        print(f"  stub SDK: {'BẬT — ' + ', '.join(a.sdk_globals) if a.stub else 'tắt'}")
        print(f"  watchdog: {'BẬT (' + str(a.watchdog_secs) + 's)' if a.watchdog else 'tắt'}")
        print(f"  api-mock: {'BẬT — ' + str(len(a.api_index.get('entries', []))) + ' fixture' if a.api_mock else 'tắt'}")
        print(f"  fake-ads: {'BẬT — mọi quảng cáo trao thưởng ngay' if a.fake_ads else 'tắt'}")
        print(json.dumps({"url": base + a.entry, "port": actual_port,
                          "apiFixtures": len(a.api_index.get("entries", [])),
                          "fakeAds": bool(a.fake_ads)}, ensure_ascii=False))
        print("\n  Trong console trình duyệt:")
        print("    cc.ENGINE_VERSION            — xác nhận version engine")
        print("    cc.director.getScene().name  — scene đang chạy")
        print("    __triageSdkReport()          — bảng mọi lời gọi SDK đã bắt")
        print("    __apiMockReport()            — API nào đã được trả bằng fixture")
        print("    __fakeAdsReport()            — quảng cáo nào đã bị fake")
        print("\n  Ctrl+C để dừng. Chỉ 4xx/5xx được log.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  đã dừng.\n")


if __name__ == "__main__":
    main()
