// Minimal static server so the web-mobile build can be verified in a real browser.
const http = require('http'), fs = require('fs'), path = require('path');
const root = process.argv[2], port = Number(process.argv[3] || 8099);
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.mp3':'audio/mpeg', '.wasm':'application/wasm', '.bin':'application/octet-stream', '.ttf':'font/ttf' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('404'); }
    // No-store on purpose. Without it the browser keeps assets/main/index.js from the
    // previous build and a fixed bug still looks broken — that cost a whole diagnosis
    // once already.
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    res.end(d);
  });
}).listen(port, () => console.log('serving ' + root + ' on http://localhost:' + port));
