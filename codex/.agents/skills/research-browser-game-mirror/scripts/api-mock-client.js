/* api-mock-client.js — intercepts fetch/XHR and replays recorded fixtures.
 *
 * Used in two places with the SAME matching logic. Do not write a second copy:
 *   1. serve-local.py --api-mock  — injects this file plus a <script> that sets
 *      window.__API_MOCK__ = { base: "/__mock", index: <api-mock/index.json> }.
 *   2. A ported project — load index.inline.json as a JsonAsset, then call
 *      window.__installApiMock({ index }) BEFORE the game scene starts. Inline
 *      bodies need no base URL, so it also works on native/mini-game builds.
 *
 * ES5, no dependencies. Runs in old Android/iOS WebViews.
 */
(function (global) {
  var entries = [];
  var BASE = "";
  var cursor = {};
  var LOG = (global.__apiMockLog = []);
  var installed = false;

  function pathOf(url) {
    try {
      return new URL(url, global.location ? global.location.href : "http://localhost/").pathname;
    } catch (e) {
      return String(url).split("?")[0];
    }
  }

  /* Match on method + path. On a miss, fall back to a suffix match: a local
     build often changes the prefix (/api/v1/x -> /x) but keeps the tail. */
  function candidatesFor(method, url) {
    var p = pathOf(url);
    var m = String(method || "GET").toUpperCase();
    var exact = [];
    var suffix = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (String(e.method).toUpperCase() !== m) continue;
      if (e.path === p) exact.push(e);
      else if (p.length > 1 && (e.path.slice(-p.length) === p || p.slice(-e.path.length) === e.path)) {
        suffix.push(e);
      }
    }
    return exact.length ? exact : suffix;
  }

  /* Same endpoint called repeatedly: replay recordings in order, then keep
     returning the last one. A polling game sees the same sequence as capture. */
  function pick(method, url) {
    var list = candidatesFor(method, url);
    if (!list.length) return null;
    var key = String(method).toUpperCase() + " " + pathOf(url);
    var n = cursor[key] || 0;
    cursor[key] = n + 1;
    return list[Math.min(n, list.length - 1)];
  }

  function bodyUrl(entry) {
    return BASE + "/" + entry.bodyFile;
  }

  function record(hit, method, url) {
    var row = { t: Date.now(), method: method, url: url, hit: hit ? hit.id : null };
    LOG.push(row);
    if (!hit) console.warn("[api-mock] no fixture for:", method, url);
    return row;
  }

  function installFetch() {
    var realFetch = global.fetch;
    if (typeof realFetch !== "function") return;
    global.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var method = (init && init.method) || (input && input.method) || "GET";
      var hit = pick(method, url);
      record(hit, method, url);
      if (!hit) return realFetch.apply(this, arguments);
      var respond = function (text) {
        return new Response(text, {
          status: hit.status || 200,
          headers: { "Content-Type": hit.contentType || "application/json" },
        });
      };
      if (typeof hit.bodyText === "string") return Promise.resolve(respond(hit.bodyText));
      return realFetch(bodyUrl(hit))
        .then(function (res) { return res.text(); })
        .then(respond);
    };
  }

  function installXhr() {
    var RealXHR = global.XMLHttpRequest;
    if (typeof RealXHR !== "function") return;

    function MockXHR() {
      this._real = new RealXHR();
      this._hit = null;
      this.readyState = 0;
      this.status = 0;
      this.responseText = "";
      this.response = "";
      this.responseType = "";
      this.onreadystatechange = null;
      this.onload = null;
      this.onerror = null;
      this.ontimeout = null;
    }

    MockXHR.prototype.open = function (method, url) {
      this._method = method;
      this._url = url;
      this._hit = pick(method, url);
      record(this._hit, method, url);
      if (this._hit) {
        this.readyState = 1;
        if (this.onreadystatechange) this.onreadystatechange();
        return undefined;
      }
      return this._real.open.apply(this._real, arguments);
    };

    MockXHR.prototype.send = function () {
      var self = this;
      if (!this._hit) {
        // No fixture: go to the real network and forward every callback back.
        var real = this._real;
        ["onreadystatechange", "onload", "onerror", "ontimeout", "onprogress"].forEach(function (k) {
          if (self[k]) {
            real[k] = function () {
              self.readyState = real.readyState;
              self.status = real.status;
              self.responseText = real.responseText;
              self.response = real.response;
              self[k].apply(self, arguments);
            };
          }
        });
        return real.send.apply(real, arguments);
      }
      var deliver = function (text) {
        self.readyState = 4;
        self.status = self._hit.status || 200;
        self.responseText = text;
        self.response = self.responseType === "json" ? JSON.parse(text || "null") : text;
        if (self.onreadystatechange) self.onreadystatechange();
        if (self.onload) self.onload();
      };
      if (typeof this._hit.bodyText === "string") {
        var text = this._hit.bodyText;
        setTimeout(function () { deliver(text); }, 0);
        return undefined;
      }
      var request = new RealXHR();
      request.open("GET", bodyUrl(this._hit), true);
      request.onload = function () { deliver(request.responseText); };
      request.onerror = function () { if (self.onerror) self.onerror(); };
      request.send();
      return undefined;
    };

    MockXHR.prototype.setRequestHeader = function () {
      if (!this._hit) return this._real.setRequestHeader.apply(this._real, arguments);
      return undefined;
    };
    MockXHR.prototype.getAllResponseHeaders = function () {
      if (!this._hit) return this._real.getAllResponseHeaders();
      return "content-type: " + (this._hit.contentType || "application/json") + "\r\n";
    };
    MockXHR.prototype.getResponseHeader = function (name) {
      if (!this._hit) return this._real.getResponseHeader(name);
      return /content-type/i.test(name) ? (this._hit.contentType || "application/json") : null;
    };
    MockXHR.prototype.abort = function () {
      if (!this._hit) return this._real.abort();
      return undefined;
    };
    MockXHR.prototype.addEventListener = function (type, fn) {
      if (!this._hit) return this._real.addEventListener(type, fn);
      if (type === "load") this.onload = fn;
      if (type === "error") this.onerror = fn;
      return undefined;
    };
    MockXHR.UNSENT = 0;
    MockXHR.OPENED = 1;
    MockXHR.HEADERS_RECEIVED = 2;
    MockXHR.LOADING = 3;
    MockXHR.DONE = 4;

    global.XMLHttpRequest = MockXHR;
  }

  function install(config) {
    if (installed) return global.__apiMockReport;
    installed = true;
    var index = (config && config.index) || {};
    entries = index.entries || [];
    BASE = (config && config.base) || "";

    installFetch();
    installXhr();

    global.__apiMockReport = function () {
      console.table(LOG);
      return { entries: entries.length, calls: LOG.length, log: LOG };
    };
    console.log("[api-mock] ready —", entries.length, "fixtures. Call __apiMockReport().");
    return global.__apiMockReport;
  }

  global.__installApiMock = install;
  if (global.__API_MOCK__) install(global.__API_MOCK__);
})(typeof window !== "undefined" ? window : globalThis);
