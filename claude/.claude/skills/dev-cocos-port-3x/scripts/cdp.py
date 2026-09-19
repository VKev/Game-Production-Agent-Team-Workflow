#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cdp.py — chạy game Cocos THẬT trong Chrome headless và lấy bằng chứng ra.

Dùng cho GĐ5 (verify) và GĐ1 (chụp bản live). Hoạt động với cả game 2.x (biến
toàn cục `cc`) lẫn 3.x web build.

    # chẩn đoán render/layout của một bản build (bug hay gặp nhất sau khi port)
    python3 cdp.py diag --serve build/web-mobile --out diag1 --w 1600 --h 757

    # chạy preview của Cocos Editor, bấm thật vào 2 điểm rồi chụp
    python3 cdp.py play --url http://localhost:7456 --tap 375,900 --tap 375,700 --out run1

    # chạy một biểu thức JS trong game đang chạy (thân hàm — dùng `return`)
    python3 cdp.py eval --url http://localhost:7456 --expr "return cc.director.getScene().name"

    # chụp bản live + network + console (GĐ1, để mirror)
    python3 cdp.py capture --url https://game.example.com/ --out live --wait 25

    # nhảy màn bằng cách set localStorage trước khi reload
    python3 cdp.py play --serve build/web-mobile --storage KEY='{"level":5}' --out lv5

Mọi lệnh ghi ra <out>.png / <out>.json / <out>.console.log trong --out-dir.

Cần: pip install websocket-client
     Chrome/Chromium (mặc định đường dẫn macOS, đổi bằng --chrome).
"""
import argparse
import base64
import http.server
import json
import mimetypes
import os
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request

try:
    import websocket  # websocket-client
except ImportError:
    sys.exit('thiếu dependency: pip install websocket-client')

DEFAULT_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'


# ---------------------------------------------------------------- CDP client
class CDP:
    """Client CDP tối giản: gửi lệnh, gom event, không cần thư viện nặng."""

    def __init__(self, port):
        self.port = port
        self.id = 0
        self.ws = None
        self.events = []          # mọi event nhận được, theo thứ tự

    def attach(self, timeout=60):
        deadline = time.time() + timeout
        last = None
        while time.time() < deadline:
            try:
                pages = json.load(urllib.request.urlopen(
                    'http://127.0.0.1:%d/json' % self.port))
                for p in pages:
                    if p.get('type') == 'page':
                        self.ws = websocket.create_connection(
                            p['webSocketDebuggerUrl'], max_size=64 * 1024 * 1024)
                        self.ws.settimeout(60)
                        return p
            except Exception as exc:                      # chrome chưa sẵn sàng
                last = exc
                time.sleep(0.3)
        raise RuntimeError('không attach được CDP (%s)' % last)

    def send(self, method, **params):
        self.id += 1
        self.ws.send(json.dumps({'id': self.id, 'method': method, 'params': params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get('id') == self.id:
                if 'error' in msg:
                    raise RuntimeError('%s: %s' % (method, msg['error']))
                return msg.get('result', {})
            if 'method' in msg:
                self.events.append(msg)

    def pump(self, seconds):
        """Chờ và gom event (console, network) trong `seconds` giây."""
        end = time.time() + seconds
        self.ws.settimeout(0.4)
        while time.time() < end:
            try:
                msg = json.loads(self.ws.recv())
                if 'method' in msg:
                    self.events.append(msg)
            except Exception:
                pass
        self.ws.settimeout(60)

    def eval(self, body, await_promise=False, is_async=False):
        """`body` là THÂN HÀM — dùng `return ...` để trả giá trị.

        `is_async=True` bọc trong `async function` để dùng được `await` — cần khi
        phải nạp asset qua `cc.assetManager` (load prefab, bundle) rồi mới dump.
        """
        expr = '(%sfunction(){%s})()' % ('async ' if is_async else '', body)
        r = self.send('Runtime.evaluate', expression=expr, returnByValue=True,
                      awaitPromise=await_promise, userGesture=True)
        if r.get('exceptionDetails'):
            desc = r['exceptionDetails'].get('exception', {}).get('description', '')
            raise RuntimeError((desc or json.dumps(r['exceptionDetails']))[:800])
        return r.get('result', {}).get('value')

    def shot(self, path):
        data = self.send('Page.captureScreenshot', format='png')['data']
        with open(path, 'wb') as fh:
            fh.write(base64.b64decode(data))

    def tap(self, x, y):
        self.send('Input.dispatchTouchEvent', type='touchStart',
                  touchPoints=[{'x': x, 'y': y}])
        time.sleep(0.05)
        self.send('Input.dispatchTouchEvent', type='touchEnd', touchPoints=[])

    def console_lines(self):
        out = []
        for ev in self.events:
            m = ev.get('method')
            p = ev.get('params', {})
            if m == 'Runtime.consoleAPICalled':
                args = []
                for a in p.get('args', []):
                    args.append(str(a.get('value', a.get('description', ''))))
                out.append('[%s] %s' % (p.get('type'), ' '.join(args)))
            elif m == 'Log.entryAdded':
                e = p.get('entry', {})
                out.append('[%s] %s' % (e.get('level'), e.get('text')))
            elif m == 'Runtime.exceptionThrown':
                d = p.get('exceptionDetails', {})
                out.append('[EXCEPTION] %s' % (d.get('exception', {}).get('description')
                                               or d.get('text')))
        return out

    def network(self):
        reqs = []
        for ev in self.events:
            if ev.get('method') == 'Network.requestWillBeSent':
                reqs.append(ev['params']['request']['url'])
        return reqs


# --------------------------------------------------------------- JS snippets
# Chẩn đoán render — KHÔNG phụ thuộc tên class của game nào.
DIAG_JS = r'''
if (typeof cc === 'undefined') return {err: 'không thấy cc'};
var v = cc.view, dr = v.getDesignResolutionSize(), vs = v.getVisibleSize();
var vp = v.getViewportRect ? v.getViewportRect() : null;
var cams = [];
function pathOf(n){var q=[];while(n){q.unshift(n.name);n=n.parent;}return q.join('/');}
function walk(n, f){ f(n); for (var i=0;i<n.children.length;i++) walk(n.children[i], f); }
var scene = cc.director.getScene();
if (scene) walk(scene, function (n) {
  var comps = n.getComponents ? n.getComponents(cc.Camera) : [];
  for (var i = 0; i < comps.length; i++) {
    var c = comps[i];
    cams.push({path: pathOf(n), on: c.enabledInHierarchy, prio: c.priority,
               clearFlags: c.clearFlags, clearsColor: !!(c.clearFlags & 1),
               ortho: c.orthoHeight !== undefined ? +c.orthoHeight.toFixed(1) : null,
               rect: c.rect ? [+c.rect.x.toFixed(4), +c.rect.y.toFixed(4),
                               +c.rect.width.toFixed(4), +c.rect.height.toFixed(4)] : null,
               vis: c.visibility});
  }
});
var nodes = 0; if (scene) walk(scene, function(){ nodes++; });
var badScaleZ = [];
if (scene) walk(scene, function (n) {
  if (n.scale && n.scale.z === 0) badScaleZ.push(pathOf(n));      // BẪY §1
});
return {
  engine: cc.ENGINE_VERSION,
  scene: scene ? scene.name : null,
  nodes: nodes,
  frame: [v.getFrameSize().width, v.getFrameSize().height],
  design: [dr.width, dr.height],
  visible: [+vs.width.toFixed(1), +vs.height.toFixed(1)],
  scale: [+v.getScaleX().toFixed(4), +v.getScaleY().toFixed(4)],
  viewportRect: vp ? [vp.x, vp.y, vp.width, vp.height] : null,
  canvasPx: [cc.game.canvas.width, cc.game.canvas.height],
  policyHint: (Math.abs(dr.width - vs.width) > 1 || Math.abs(dr.height - vs.height) > 1)
              ? 'visible KHÁC design — kiểm resolution policy (pitfalls §2)' : 'ok',
  camsClearColorMissing: cams.filter(function (c) { return c.on && !c.clearsColor; })
                             .map(function (c) { return c.path; }),
  badScaleZ: badScaleZ.slice(0, 40),
  badScaleZCount: badScaleZ.length,
  cams: cams
};
'''

# Dump cây node để A/B giữa hai bản (gốc 2.x vs bản port 3.x).
TREE_JS = r'''
if (typeof cc === 'undefined') return {err: 'không thấy cc'};
var DEPTH = %d;
function pos(n){ return n.position ? [Math.round(n.position.x), Math.round(n.position.y)]
                                   : [Math.round(n.x), Math.round(n.y)]; }
function dump(n, d) {
  var o = {name: n.name, active: n.activeInHierarchy, pos: pos(n),
           comps: (n._components || []).map(function (c) {
             return cc.js.getClassName(c.constructor); }).sort()};
  if (d > 0 && n.children.length) o.kids = n.children.map(function (c) { return dump(c, d - 1); });
  else o.nKids = n.children.length;
  return o;
}
var s = cc.director.getScene();
return s ? dump(s, DEPTH) : {err: 'chưa có scene'};
'''


# ------------------------------------------------------------------- runtime
_EXTRA_MIME = {".wasm": "application/wasm", ".js": "text/javascript",
               ".mjs": "text/javascript", ".json": "application/json"}


def _type_and_encoding(path):
    """Trả (Content-Type, Content-Encoding), bóc đuôi nén sẵn để đoán type gốc."""
    enc, base, low = None, path, path.lower()
    for suffix, e in ((".br", "br"), (".gz", "gzip"), (".zst", "zstd")):
        if low.endswith(suffix):
            enc, base = e, path[: -len(suffix)]
            break
    ext = os.path.splitext(base)[1].lower()
    ctype = _EXTRA_MIME.get(ext) or mimetypes.guess_type(base)[0]
    return (ctype or "application/octet-stream"), enc


def serve_dir(directory, port):
    """HTTP server cục bộ — bản web Cocos KHÔNG chạy được bằng file://.

    KHÔNG hỗ trợ HTTP Range (SimpleHTTPRequestHandler bỏ qua header `Range:`).
    Đủ cho `diag`/`play`; nếu cần Range đầy đủ (audio seek, asset lớn) thì chạy
    `serve-local.py` rồi trỏ `cdp.py --url` vào đó.
    """
    directory = os.path.abspath(directory)

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=directory, **kw)

        def log_message(self, *a):
            pass

        # Build Cocos có `.wasm` và file nén sẵn `.br`/`.gz`.
        # SimpleHTTPRequestHandler đoán sai cả hai: `.wasm` ra octet-stream
        # (WebAssembly.instantiateStreaming fail) và `x.js.br` ra
        # "application/brotli" thay vì text/javascript + Content-Encoding: br
        # (browser không giải nén). Cả hai hiện ra y như "asset hỏng" — bẫy im
        # lặng rất tốn công truy. Cùng semantics với serve-local.py.
        def guess_type(self, path):
            ctype, enc = _type_and_encoding(str(path))
            self._pending_enc = enc
            return ctype

        def end_headers(self):
            enc = getattr(self, "_pending_enc", None)
            if enc:
                self.send_header("Content-Encoding", enc)
                self._pending_enc = None
            super().end_headers()

    class Server(socketserver.TCPServer):
        allow_reuse_address = True

    try:
        httpd = Server(('127.0.0.1', port), Handler)
    except OSError:                       # cổng bận -> lấy cổng trống bất kỳ
        httpd = Server(('127.0.0.1', 0), Handler)
        print('cổng %d bận, chuyển sang cổng trống' % port)
    # Luôn đọc lại cổng THẬT từ socket: với `--serve-port 0` thì bind thành công
    # nhưng biến `port` vẫn là 0, và URL trả về sẽ là `:0` — không nối được.
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, 'http://127.0.0.1:%d/' % port


def free_port():
    import socket
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port


def port_busy(port):
    import socket
    s = socket.socket()
    try:
        s.bind(('127.0.0.1', port))
        return False
    except OSError:
        return True
    finally:
        s.close()


def launch_chrome(chrome, port, width, height, log_path):
    profile = tempfile.mkdtemp(prefix='cdp-')
    log = open(log_path, 'w')
    proc = subprocess.Popen([
        chrome, '--headless=new', '--no-first-run', '--no-default-browser-check',
        '--mute-audio', '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
        '--remote-debugging-port=%d' % port,
        '--remote-allow-origins=*',        # Chrome mới chặn WS từ origin lạ nếu thiếu cờ này
        '--user-data-dir=%s' % profile,
        '--window-size=%d,%d' % (width, height),
        'about:blank',
    ], stdout=log, stderr=subprocess.STDOUT)
    return proc, profile, log


def run(args, body):
    """Khởi động server (nếu cần) + chrome + attach, rồi gọi body(cdp, url)."""
    os.makedirs(args.out_dir, exist_ok=True)
    httpd = None
    url = args.url
    if args.serve:
        httpd, url = serve_dir(args.serve, args.serve_port)
        print('serve %s → %s' % (args.serve, url))
    if not url:
        sys.exit('cần --url hoặc --serve')

    chrome = args.chrome or DEFAULT_CHROME
    if not os.path.exists(chrome):
        sys.exit('không thấy Chrome ở %s — truyền --chrome' % chrome)

    # BẪY: nếu cổng debug đã có Chrome khác chiếm, ta sẽ ÂM THẦM attach vào
    # browser của người khác (và điều khiển tab của họ). Phải bắt trường hợp này.
    port = args.port
    if port:
        if port_busy(port):
            sys.exit('cổng debug %d đang bận — đã có Chrome khác nghe ở đó.\n'
                     'Bỏ --port để tự chọn cổng trống, hoặc tắt tiến trình kia.' % port)
    else:
        port = free_port()

    log_path = os.path.join(args.out_dir, args.out + '.chrome.log')
    proc, profile, log = launch_chrome(chrome, port, args.w, args.h, log_path)
    cdp = CDP(port)
    try:
        cdp.attach()
        cdp.send('Runtime.enable')
        cdp.send('Log.enable')
        cdp.send('Page.enable')
        if args.network:
            cdp.send('Network.enable')
        return body(cdp, url)
    finally:
        try:
            lines = cdp.console_lines()
            with open(os.path.join(args.out_dir, args.out + '.console.log'), 'w') as fh:
                fh.write('\n'.join(lines))
        except Exception:
            pass
        proc.terminate()
        log.close()
        if httpd:
            httpd.shutdown()
        shutil.rmtree(profile, ignore_errors=True)


def boot(cdp, url, args):
    """Nạp trang; nếu có --storage thì set rồi reload để game đọc được."""
    del cdp.events[:]          # bỏ log replay của trang trước (nếu có)
    cdp.send('Page.navigate', url=url)
    cdp.pump(3)
    if args.storage:
        for item in args.storage:
            key, _, value = item.partition('=')
            cdp.eval('localStorage.setItem(%s, %s); return 1;'
                     % (json.dumps(key), json.dumps(value)))
        cdp.send('Page.navigate', url=url)
    cdp.pump(args.wait)


def write_json(args, payload, suffix=''):
    path = os.path.join(args.out_dir, args.out + suffix + '.json')
    with open(path, 'w') as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    return path


# ------------------------------------------------------------------ commands
def cmd_eval(args):
    def body(cdp, url):
        boot(cdp, url, args)
        value = cdp.eval(args.expr, await_promise=args.await_, is_async=args.await_)
        write_json(args, value)
        if args.quiet:
            n = len(json.dumps(value, ensure_ascii=False))
            print('đã ghi %s.json — %d ký tự JSON' % (args.out, n))
        else:
            print(json.dumps(value, ensure_ascii=False, indent=2))
        return value
    return run(args, body)


def cmd_diag(args):
    def body(cdp, url):
        boot(cdp, url, args)
        data = cdp.eval(DIAG_JS)
        cdp.shot(os.path.join(args.out_dir, args.out + '.png'))
        write_json(args, data)
        print(json.dumps(data, ensure_ascii=False, indent=2)[:4000])
        if isinstance(data, dict):
            if data.get('badScaleZCount'):
                print('\n⚠️  %d node có scale.z=0 → hitTest luôn false, nút không bấm được '
                      '(pitfalls §1)' % data['badScaleZCount'])
            if data.get('camsClearColorMissing'):
                print('⚠️  camera thiếu bit COLOR trong clearFlags → vệt smear (pitfalls §4a): %s'
                      % data['camsClearColorMissing'])
            if data.get('policyHint') and data['policyHint'] != 'ok':
                print('⚠️  %s' % data['policyHint'])
            if data.get('err'):
                print('\n⚠️  %s — trang chưa boot xong? tăng --wait' % data['err'])
        return data
    return run(args, body)


def cmd_play(args):
    def body(cdp, url):
        boot(cdp, url, args)
        for point in args.tap or []:
            x, _, y = point.partition(',')
            cdp.tap(float(x), float(y))
            cdp.pump(args.tap_wait)
        tree = cdp.eval(TREE_JS % args.depth)
        cdp.shot(os.path.join(args.out_dir, args.out + '.png'))
        write_json(args, tree)
        print(json.dumps(tree, ensure_ascii=False)[:2000])
        return tree
    return run(args, body)


def cmd_coverage(args):
    """Đo JS coverage để chốt CODE CHẾT bằng bằng chứng [R], không bằng suy đoán.

    Vì sao cần lệnh riêng: registry class của engine (`cc.js._registeredClassIds`)
    CHỈ chứa subclass `cc.Component`/`cc.Asset`. Manager singleton, module const,
    util, SDK nền tảng không bao giờ vào registry dù chạy suốt — nên lấy
    `class tĩnh − class registry` mà gọi là "code chết" là SAI, và sai theo hướng
    đắt (bỏ port class đang sống). Coverage đo trực tiếp *byte nào đã chạy*.

    Bắt buộc: `startPreciseCoverage` phải gọi TRƯỚC `Page.navigate`, nếu không
    phần chạy lúc boot không được tính và mọi thứ trông như code chết.
    """
    def body(cdp, url):
        cdp.send('Profiler.enable')
        cdp.send('Profiler.startPreciseCoverage', callCount=False, detailed=True)
        boot(cdp, url, args)
        for point in args.tap or []:
            x, _, y = point.partition(',')
            cdp.tap(float(x), float(y))
            cdp.pump(args.tap_wait)
        res = cdp.send('Profiler.takePreciseCoverage')
        cdp.shot(os.path.join(args.out_dir, args.out + '.png'))
        keep = [e for e in res.get('result', [])
                if not args.filter or args.filter in e.get('url', '')]
        write_json(args, keep)
        total_ranges = sum(len(f.get('ranges', []))
                           for e in keep for f in e.get('functions', []))
        print('%d script khớp filter %r, %d function, %d range'
              % (len(keep), args.filter,
                 sum(len(e.get('functions', [])) for e in keep), total_ranges))
        for e in keep:
            print('  %s — %d function' % (e.get('url'), len(e.get('functions', []))))
        return keep
    return run(args, body)


def cmd_capture(args):
    args.network = True

    def body(cdp, url):
        boot(cdp, url, args)
        cdp.shot(os.path.join(args.out_dir, args.out + '.png'))
        urls = sorted(set(cdp.network()))
        write_json(args, urls, '.network')
        print('%d URL, ảnh + console đã ghi vào %s' % (len(urls), args.out_dir))
        return urls
    return run(args, body)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)

    def common(p):
        p.add_argument('--url', help='URL game (vd http://localhost:7456 cho preview Editor)')
        p.add_argument('--serve', help='thư mục build để tự mở HTTP server (thay cho --url)')
        p.add_argument('--serve-port', type=int, default=8124)
        p.add_argument('--out', required=True, help='tên file kết quả (không đuôi)')
        p.add_argument('--out-dir', default='cdp-out')
        p.add_argument('--port', type=int, default=0,
                       help='cổng debug Chrome (mặc định 0 = tự chọn cổng trống)')
        p.add_argument('--chrome', help='đường dẫn Chrome')
        p.add_argument('--w', type=int, default=750)
        p.add_argument('--h', type=int, default=1334)
        p.add_argument('--wait', type=float, default=8.0, help='giây chờ game boot')
        p.add_argument('--storage', action='append',
                       help='KEY=VALUE set vào localStorage rồi reload (nhảy màn/đặt state)')
        p.add_argument('--network', action='store_true', help='bật Network.enable')

    p = sub.add_parser('eval', help='chạy JS trong game (thân hàm, dùng return)')
    common(p); p.add_argument('--expr', required=True)
    p.add_argument('--await', dest='await_', action='store_true',
                   help='bọc trong async function để dùng await (nạp prefab/bundle)')
    p.add_argument('--quiet', action='store_true',
                   help='chỉ in kích thước, không dội cả JSON ra stdout (dump lớn)')
    p.set_defaults(fn=cmd_eval)

    p = sub.add_parser('diag', help='chẩn đoán render/layout/camera + soát bẫy đã biết')
    common(p); p.set_defaults(fn=cmd_diag)

    p = sub.add_parser('coverage', help='đo JS coverage → chốt code chết bằng [R]')
    common(p)
    p.add_argument('--tap', action='append', help='X,Y bấm sau khi boot (lặp được)')
    p.add_argument('--tap-wait', type=float, default=2.0)
    p.add_argument('--filter', default='', help='chỉ giữ script có URL chứa chuỗi này')
    p.set_defaults(fn=cmd_coverage)

    p = sub.add_parser('play', help='boot + bấm thật + dump cây node + chụp')
    common(p)
    p.add_argument('--tap', action='append', metavar='X,Y', help='toạ độ CSS px, lặp được')
    p.add_argument('--tap-wait', type=float, default=1.5)
    p.add_argument('--depth', type=int, default=4)
    p.set_defaults(fn=cmd_play)

    p = sub.add_parser('capture', help='chụp bản live + gom URL network (GĐ1 mirror)')
    common(p); p.set_defaults(fn=cmd_capture)

    args = ap.parse_args()
    if not hasattr(args, 'network'):
        args.network = False
    args.fn(args)


if __name__ == '__main__':
    main()
