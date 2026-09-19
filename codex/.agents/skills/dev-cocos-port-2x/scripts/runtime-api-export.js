/*
 * runtime-api-export.js — CHỈ ĐỌC. Dán vào DevTools console của bản game 2.x
 * đang chạy (mirror local), khi game ĐANG Ở TRẠNG THÁI muốn chụp (menu / đang
 * chơi / màn thắng — mỗi trạng thái nạp một tập class khác nhau, nên chạy
 * nhiều lần rồi hợp nhất).
 *
 * Xuất ra:
 *   - classes[Name].methods   : danh sách method
 *   - classes[Name].sources   : SOURCE THẬT của từng method (Function.toString())
 *                               → đây là nguồn chính xác nhất, hơn cả decode tĩnh
 *   - sceneComponents[]       : mọi component trong scene + giá trị property THẬT
 *                               → ground truth khi dựng lại prefab ở GĐ4
 *   - engineVersion, designResolution, bundles
 *
 * Kết quả nằm ở `window.__RUNTIME_API__`, đồng thời tự POST về
 * http://127.0.0.1:8125/analysis-api nếu có server nhận (chạy một server nhỏ
 * ghi body ra file). Không có server thì dùng:
 *     copy(JSON.stringify(window.__RUNTIME_API__))
 * hoặc lấy qua CDP:  python3 cdp.py eval --expr "return window.__RUNTIME_API__"
 *
 * Script KHÔNG sửa gì trong game.
 */
(function () {
  'use strict';
  if (typeof cc === 'undefined') { console.error('không thấy `cc` — game chưa boot?'); return; }

  var MAX_SOURCE = 20000;      // cắt method quá dài cho khỏi vỡ JSON
  var INCLUDE_ENGINE = false;  // true = xuất cả class cc.* của engine (rất to)

  function safeName(cls) {
    try { return cc.js.getClassName(cls) || cls.name || '?'; } catch (e) { return '?'; }
  }

  /* ---------- 1. inventory class đã đăng ký ---------- */
  var registry = {};
  try {
    // 2.4: cc.js._registeredClassNames là map name -> class
    var reg = cc.js._registeredClassNames || {};
    Object.keys(reg).forEach(function (name) { registry[name] = reg[name]; });
  } catch (e) { console.warn('không đọc được _registeredClassNames', e); }

  // bổ sung: class của mọi component đang có trong scene (bắt cả class không đăng ký tên)
  var sceneClasses = [];
  var sceneComponents = [];
  function nodePath(node) {
    var parts = [];
    for (var n = node; n; n = n.parent) parts.unshift(n.name);
    return parts.join('/');
  }

  function snapshotValue(v, depth) {
    if (v === null || v === undefined) return v === null ? null : undefined;
    var t = typeof v;
    if (t === 'number' || t === 'boolean') return v;
    if (t === 'string') return v.length > 500 ? v.slice(0, 500) + '…' : v;
    if (t === 'function') return '[fn]';
    if (depth > 2) return '[depth]';
    if (Array.isArray(v)) {
      return v.slice(0, 40).map(function (x) { return snapshotValue(x, depth + 1); });
    }
    // kiểu của engine: giữ dạng gọn, đọc được
    try {
      if (v instanceof cc.Vec2) return { __t: 'Vec2', x: v.x, y: v.y };
      if (cc.Vec3 && v instanceof cc.Vec3) return { __t: 'Vec3', x: v.x, y: v.y, z: v.z };
      if (v instanceof cc.Color) return { __t: 'Color', hex: v.toHEX('#rrggbbaa') };
      if (v instanceof cc.Size) return { __t: 'Size', w: v.width, h: v.height };
      if (v instanceof cc.Rect) return { __t: 'Rect', x: v.x, y: v.y, w: v.width, h: v.height };
      if (v instanceof cc.Node) return { __t: 'Node', path: nodePath(v) };
      if (v instanceof cc.Component) return { __t: 'Comp', type: safeName(v.constructor), path: nodePath(v.node) };
      if (v instanceof cc.Asset) {
        return { __t: 'Asset', type: safeName(v.constructor), name: v.name, uuid: v._uuid };
      }
    } catch (e) { /* engine khác version — bỏ qua */ }
    if (t === 'object') {
      var out = {}; var keys = Object.keys(v).slice(0, 30);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].charAt(0) === '_') continue;
        out[keys[i]] = snapshotValue(v[keys[i]], depth + 1);
      }
      return out;
    }
    return String(v);
  }

  function walk(node, fn) {
    fn(node);
    for (var i = 0; i < node.children.length; i++) walk(node.children[i], fn);
  }

  try {
    var scene = cc.director.getScene();
    if (scene) {
      walk(scene, function (node) {
        var comps = node._components || [];
        for (var i = 0; i < comps.length; i++) {
          var c = comps[i];
          var type = safeName(c.constructor);
          if (sceneClasses.indexOf(type) === -1) {
            sceneClasses.push(type);
            if (!registry[type]) registry[type] = c.constructor;
          }
          var state = {};
          for (var k in c) {
            if (k.charAt(0) === '_') continue;
            if (k === 'node' || k === 'uuid' || k === '__scriptAsset') continue;
            var val;
            try { val = c[k]; } catch (e) { continue; }   // getter ném lỗi → bỏ
            if (typeof val === 'function') continue;
            state[k] = snapshotValue(val, 0);
          }
          sceneComponents.push({
            node: nodePath(node),
            type: type,
            active: node.activeInHierarchy,
            nodeState: {
              pos: [node.x, node.y], scale: [node.scaleX, node.scaleY],
              size: [node.width, node.height], anchor: [node.anchorX, node.anchorY],
              angle: node.angle, opacity: node.opacity, group: node.group,
              color: node.color && node.color.toHEX ? node.color.toHEX('#rrggbb') : null,
            },
            state: state,
          });
        }
      });
    }
  } catch (e) { console.warn('quét scene lỗi', e); }

  /* ---------- 2. method + source của từng class ---------- */
  var classes = {};
  Object.keys(registry).forEach(function (name) {
    var cls = registry[name];
    if (!cls || !cls.prototype) return;
    if (!INCLUDE_ENGINE && name.indexOf('cc.') === 0) return;

    var methods = {}; var sources = {};
    var proto = cls.prototype;
    Object.getOwnPropertyNames(proto).forEach(function (key) {
      if (key === 'constructor') return;
      var desc;
      try { desc = Object.getOwnPropertyDescriptor(proto, key); } catch (e) { return; }
      if (!desc || typeof desc.value !== 'function') return;
      methods[key] = true;
      try {
        var src = Function.prototype.toString.call(desc.value);
        if (src.indexOf('[native code]') === -1) {
          sources[key] = src.length > MAX_SOURCE ? src.slice(0, MAX_SOURCE) + '\n/*…cắt…*/' : src;
        }
      } catch (e) { /* bỏ qua */ }
    });

    // property đã khai báo (2.x lưu ở __props__)
    var props = [];
    try { props = (cls.__props__ || []).slice(); } catch (e) {}

    classes[name] = {
      resolvedName: safeName(cls),
      inScene: sceneClasses.indexOf(name) > -1,
      superName: cls.$super ? safeName(cls.$super) : null,
      props: props,
      methods: methods,
      sources: sources,
    };
  });

  /* ---------- 3. môi trường ---------- */
  var env = {};
  try {
    env.engineVersion = cc.ENGINE_VERSION;
    var dr = cc.view.getDesignResolutionSize();
    env.designResolution = [dr.width, dr.height];
    env.frameSize = [cc.view.getFrameSize().width, cc.view.getFrameSize().height];
    env.visibleSize = [cc.view.getVisibleSize().width, cc.view.getVisibleSize().height];
    env.sceneName = cc.director.getScene() ? cc.director.getScene().name : null;
    env.bundles = Object.keys(cc.assetManager.bundles._map || {});
  } catch (e) { env.err = String(e); }

  var result = {
    engineVersion: env.engineVersion,
    designResolution: env.designResolution,
    env: env,
    classes: classes,
    sceneComponents: sceneComponents,
  };

  window.__RUNTIME_API__ = result;
  console.log('[runtime-api] class=%d  cóSource=%d  component=%d',
    Object.keys(classes).length,
    Object.keys(classes).filter(function (k) { return Object.keys(classes[k].sources).length; }).length,
    sceneComponents.length);

  try {
    fetch('http://127.0.0.1:8125/analysis-api', { method: 'POST', body: JSON.stringify(result) })
      .then(function () { console.log('[runtime-api] đã POST về 127.0.0.1:8125'); })
      .catch(function () { console.log('[runtime-api] không có server nhận — dùng copy(JSON.stringify(__RUNTIME_API__))'); });
  } catch (e) {}

  return result;
})();
