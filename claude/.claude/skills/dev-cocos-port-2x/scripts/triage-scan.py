#!/usr/bin/env python3
"""
triage-scan.py — cổng thẩm định khả thi của pipeline dev-cocos-port-2x / dev-cocos-port-3x.

Quét MỘT thư mục build HTML5 và trả về BẰNG CHỨNG để quyết định có port được
hay không. Script này KHÔNG ra quyết định GO/NO-GO — nó chỉ đo. Việc chấm điểm
và quyết định là của agent `cocos-port-triage` (nó có thêm ngữ cảnh: quyền sở hữu,
ngân sách, nền tảng đích).

Chỉ dùng thư viện chuẩn của Python 3 — KHÔNG cần node, không cần pip install.

    python3 triage-scan.py --root <thư-mục-build> [--out <thư-mục-kết-quả>] [--json]

Đầu ra:
    <out>/triage.json   — toàn bộ số đo, dạng máy đọc
    stdout              — tóm tắt cho người đọc (hoặc JSON nếu có --json)
"""

import argparse
import collections
import json
import os
import re
import sys

# ---------------------------------------------------------------- uuid 2.x ---

_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
_BV = {c: i for i, c in enumerate(_B64)}
_HEX = "0123456789abcdef"
_TPL = list("xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx")
_IDX = [i for i, c in enumerate(_TPL) if c != "-"]


def decode_uuid(u):
    """Giải uuid nén 22 ký tự của Cocos 2.x về uuid đầy đủ 36 ký tự."""
    u = u.split("@")[0]
    if len(u) != 22:
        return u
    t = list(_TPL)
    t[0], t[1] = u[0], u[1]
    j = 2
    try:
        for i in range(2, 22, 2):
            lhs, rhs = _BV[u[i]], _BV[u[i + 1]]
            t[_IDX[j]] = _HEX[lhs >> 2]
            j += 1
            t[_IDX[j]] = _HEX[((lhs & 3) << 2) | (rhs >> 4)]
            j += 1
            t[_IDX[j]] = _HEX[rhs & 0xF]
            j += 1
    except (KeyError, IndexError):
        return u
    return "".join(t)


# ------------------------------------------------------------------ helpers --

ENGINE_FILE_RE = re.compile(
    r"(cocos2d-js|cocos2d-jsb|cocos-js|physics-min|cc\.js|chunks?)", re.I
)


def walk_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules")]
        for fn in filenames:
            yield os.path.join(dirpath, fn)


def read_text(path, limit=None):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read(limit) if limit else f.read()
    except OSError:
        return ""


def human(n):
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024.0


# ------------------------------------------------------------ engine detect --


def detect_engine(root, files):
    """Nhận dạng engine + version + major. Trả về dict có evidence."""
    ev = []
    rel = {os.path.relpath(p, root).replace("\\", "/"): p for p in files}
    names = set(rel)
    basenames = collections.Counter(os.path.basename(p) for p in files)

    def has(pattern):
        rx = re.compile(pattern, re.I)
        return [n for n in names if rx.search(n)]

    # --- engine khác Cocos: chặn sớm, tránh phân tích nhầm ---------------
    foreign = [
        ("unity-webgl", r"UnityLoader\.js|Build/.*\.(wasm|unityweb)$"),
        ("laya", r"laya\.core\.js|laya\.min\.js"),
        ("egret", r"\begret(\.min)?\.js|egretProperties\.json"),
        ("phaser", r"phaser(\.min)?\.js"),
        ("pixi", r"pixi(\.min)?\.js"),
        ("construct", r"c[23]runtime\.js"),
    ]
    for fam, pat in foreign:
        hit = has(pat)
        if hit:
            return {
                "family": fam,
                "version": None,
                "major": None,
                "confidence": "high",
                "isCocos": False,
                "evidence": [f"tìm thấy {hit[0]}"],
            }

    version = None
    for cand in has(r"\.js$"):
        if not ENGINE_FILE_RE.search(cand):
            continue
        head = read_text(rel[cand], 400_000) + read_text(rel[cand], 200)
        m = re.search(r'ENGINE_VERSION\s*=\s*["\']([0-9][^"\']*)["\']', head)
        if not m:
            blob = read_text(rel[cand])
            m = re.search(r'ENGINE_VERSION\s*=\s*["\']([0-9][^"\']*)["\']', blob)
        if m:
            version = m.group(1)
            ev.append(f"{cand}: ENGINE_VERSION={version}")
            break

    # --- Cocos Creator 2.x: settings.js chứa window._CCSettings ----------
    settings_js = [n for n in names if re.search(r"src/settings.*\.js$", n)]
    for n in settings_js:
        txt = read_text(rel[n], 4000)
        if "_CCSettings" in txt:
            ev.append(f"{n}: window._CCSettings (chữ ký 2.x)")
            major = 2
            break
    else:
        major = None

    # --- Cocos Creator 3.x ----------------------------------------------
    if major is None:
        sig3 = (
            has(r"src/settings\.json$")
            + has(r"(^|/)application\.js$")
            + has(r"src/chunks?/")
            + has(r"(^|/)cc\.js$")
        )
        if sig3:
            major = 3
            ev.append(f"chữ ký 3.x: {', '.join(sorted(set(sig3))[:3])}")

    if major is None and version:
        major = int(version.split(".")[0])

    # --- native / bytecode ----------------------------------------------
    jsc = has(r"\.jsc$")
    wasm = has(r"\.wasm$")
    if jsc:
        ev.append(f"{len(jsc)} file .jsc (bytecode/XXTEA) — code có thể không đọc được")
    if wasm:
        ev.append(f"{len(wasm)} file .wasm")

    family = "cocos-creator" if major in (2, 3) else ("cocos2d-x" if jsc else "unknown")
    conf = "high" if (version and major) else ("med" if major else "low")

    return {
        "family": family,
        "version": version,
        "major": major,
        "confidence": conf,
        "isCocos": family.startswith("cocos"),
        "hasJsc": bool(jsc),
        "hasWasm": bool(wasm),
        "evidence": ev or ["không tìm thấy chữ ký engine rõ ràng"],
        "_basenames": basenames,
    }


# --------------------------------------------------- source project detect ---


def detect_source_project(root, files):
    """Phân biệt BUILD (đã đóng gói) với SOURCE PROJECT (còn .meta + project file)."""
    rel = [os.path.relpath(p, root).replace("\\", "/") for p in files]
    metas = [n for n in rel if n.endswith(".meta")]
    proj = [
        n
        for n in rel
        if os.path.basename(n)
        in ("project.json", "package.json", "tsconfig.json", "creator.d.ts")
        and n.count("/") <= 1
    ]
    srcs = [n for n in rel if re.match(r"^assets/.*\.(ts|js)$", n)]
    is_source = len(metas) > 20 and len(srcs) > 5
    return {
        "isSourceProject": is_source,
        "metaFiles": len(metas),
        "assetScripts": len(srcs),
        "projectFiles": sorted(set(proj))[:5],
    }


# ------------------------------------------------------ bundles & manifests --


def scan_bundles(root):
    """Đọc mọi config.*.json của Cocos 2.x/3.x, đếm asset + kiểm closure."""
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules")]
        for fn in filenames:
            if not re.fullmatch(r"config(\.\w+)?\.json", fn):
                continue
            cf = os.path.join(dirpath, fn)
            try:
                d = json.load(open(cf, encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if "uuids" not in d or "paths" not in d:
                continue

            uu = d.get("uuids", [])
            types = d.get("types", [])
            counts = collections.Counter()
            for _k, v in d.get("paths", {}).items():
                ti = v[1] if len(v) > 1 else -1
                t = types[ti] if isinstance(ti, int) and 0 <= ti < len(types) else "?"
                counts[t] += 1

            ver = d.get("versions", {}) or {}
            imp, nat = ver.get("import", []) or [], ver.get("native", []) or []
            miss_i, miss_n = [], []
            for k in range(0, len(imp) - 1, 2):
                i, h = imp[k], imp[k + 1]
                uid = decode_uuid(uu[i]) if isinstance(i, int) and i < len(uu) else str(i)
                if not os.path.exists(
                    os.path.join(dirpath, "import", uid[:2], f"{uid}.{h}.json")
                ):
                    miss_i.append(uid)
            for k in range(0, len(nat) - 1, 2):
                i, h = nat[k], nat[k + 1]
                uid = decode_uuid(uu[i]) if isinstance(i, int) and i < len(uu) else str(i)
                nd = os.path.join(dirpath, "native", uid[:2])
                pre = f"{uid}.{h}."
                if not (
                    os.path.isdir(nd)
                    and any(x.startswith(pre) for x in os.listdir(nd))
                ):
                    miss_n.append(uid)

            out.append(
                {
                    "name": d.get("name") or os.path.basename(dirpath),
                    "dir": os.path.relpath(dirpath, root).replace("\\", "/"),
                    "assets": len(d.get("paths", {})),
                    "types": dict(counts.most_common()),
                    "scenes": sorted(d.get("scenes", {}).keys()),
                    "importTotal": len(imp) // 2,
                    "importMissing": len(miss_i),
                    "nativeTotal": len(nat) // 2,
                    "nativeMissing": len(miss_n),
                    "encrypted": bool(d.get("encrypted")),
                    "isZip": bool(d.get("isZip")),
                    "missingSample": (miss_i + miss_n)[:5],
                }
            )
    out.sort(key=lambda b: -b["assets"])
    return out


# --------------------------------------------------------- code + obfuscate --

MODULE_KEY_RE = re.compile(r"([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*\[\s*function\s*\(")
HEX_NAME_RE = re.compile(r"_0x[0-9a-fA-F]{4,}")
COMPUTED_RE = re.compile(r'\["[A-Za-z_$][A-Za-z0-9_$]*"\]')
BIG_ARRAY_RE = re.compile(r'=\s*\[\s*(?:"[^"\\]{0,80}"\s*,\s*){150,}')
TABLE_REF_RE = re.compile(r"\b[A-Za-z_$]{1,3}\[\d{2,4}\]")


VENDOR_RE = re.compile(
    r"(^|/)(external-assets|node_modules|vendor|libs?)/"
    r"|sdk|polyfill|jweixin|weapp-adapter|vconsole|analytics|gtag",
    re.I,
)
# bản sao lưu / bản gốc trước khi vá — cùng nội dung với bản chính, đừng chấm 2 lần
DUP_RE = re.compile(r"(^|/)(mirror-audit|originals?|backup|_bak|\.bak)(/|$)", re.I)


def pick_code_bundles(root, files):
    """Chọn file JS chứa CODE GAME, tách khỏi engine / SDK bên thứ ba / bản sao lưu.

    Trả về list (kind, size, relpath, abspath) đã sắp xếp: game trước, rồi vendor.
    `kind` ∈ {"game", "vendor", "duplicate"} — chỉ "game" được dùng để chấm
    obfuscation tổng, vì SDK nhà phát hành gần như luôn bị obfuscate nặng và
    KHÔNG phải thứ ta port.
    """
    cands = []
    for p in files:
        if not p.endswith(".js"):
            continue
        rel = os.path.relpath(p, root).replace("\\", "/")
        if ENGINE_FILE_RE.search(os.path.basename(rel)):
            continue
        sz = os.path.getsize(p)
        if sz < 20_000:
            continue
        if DUP_RE.search(rel):
            kind = "duplicate"
        elif VENDOR_RE.search(rel):
            kind = "vendor"
        else:
            kind = "game"
        cands.append((kind, sz, rel, p))
    order = {"game": 0, "vendor": 1, "duplicate": 2}
    cands.sort(key=lambda c: (order[c[0]], -c[1]))
    return cands[:8]


def grade_obfuscation(path, size):
    """Chấm mức obfuscation L0..L4 trên MỘT file code. Xem bảng trong agent."""
    txt = read_text(path)
    kb = max(1, len(txt) / 1024)

    keys = MODULE_KEY_RE.findall(txt)
    readable = [k for k in keys if len(k) >= 4]
    read_frac = (len(readable) / len(keys)) if keys else 0.0

    hexnames = len(HEX_NAME_RE.findall(txt))
    computed = len(COMPUTED_RE.findall(txt))
    table_ref = len(TABLE_REF_RE.findall(txt))
    big_array = bool(BIG_ARRAY_RE.search(txt))
    evals = len(re.findall(r"\beval\s*\(", txt))

    sig = {
        "modules": len(keys),
        "readableModuleNames": len(readable),
        "readableFraction": round(read_frac, 3),
        "hexIdentifiers": hexnames,
        "computedMemberPerKB": round(computed / kb, 2),
        "tableRefPerKB": round(table_ref / kb, 2),
        "hasBigStringArray": big_array,
        "evalCalls": evals,
    }

    if hexnames > 200 or (read_frac < 0.35 and keys and sig["computedMemberPerKB"] > 12):
        grade, why = "L3", "định danh bị băm (_0x…) hoặc tên module không đọc được + truy cập chuỗi dày đặc"
    elif big_array and sig["tableRefPerKB"] > 1.0:
        grade, why = "L2", "có string-table + tham chiếu dạng tbl[123] — giải được bằng phân tích tĩnh"
    elif keys and read_frac >= 0.6:
        grade, why = "L1", "chỉ minify: tên module/class/method còn nguyên"
    elif keys:
        grade, why = "L2", "tên module một phần bị rút gọn"
    else:
        grade, why = "L3", "không tách được ranh giới module — bundle không theo dạng browserify/webpack quen thuộc"

    sample = [k for k in readable[:25]]
    return {"grade": grade, "why": why, "signals": sig, "sampleModules": sample}


# ------------------------------------------------------------------- risks ---

RISK_GREPS = {
    "websocket": r"\bWebSocket\b|\bpomelo\b|socket\.io",
    "protobuf": r"\bprotobuf\b|protoc",
    "http": r"https?://[a-z0-9.\-]+",
    "nativeJsb": r"\bjsb\.[A-Za-z]|jsb\.AssetsManager",
    "hotUpdate": r"AssetsManager|hotUpdate|manifest",
    "platformSdk": r"\bwx\.[a-z]|\btt\.[a-z]|\bswan\.[a-z]|\bqq\.[a-z]",
    "payment": r"payment|purchase|requestMidasPayment|thanhToan",
    "physics2d": r"cc\.RigidBody|cc\.Physics|PhysicsManager|b2Body",
    "dragonBones": r"dragonBones\.",
    "spine": r"\bsp\.Skeleton|spine\.",
    "camera": r"cc\.Camera",
    "webview": r"cc\.WebView|cc\.VideoPlayer",
    "eval": r"\beval\s*\(|new\s+Function\s*\(",
}


def scan_risks(code_paths):
    found = collections.Counter()
    hosts = collections.Counter()
    for p in code_paths:
        txt = read_text(p)
        for k, pat in RISK_GREPS.items():
            found[k] += len(re.findall(pat, txt))
        for h in re.findall(r"(?:wss?|https?)://([a-z0-9.\-]{4,})", txt, re.I):
            if not h.startswith("www.w3.org"):
                hosts[h.lower()] += 1
    return dict(found), hosts.most_common(12)


def count_custom_effects(bundles):
    builtin = custom = 0
    for b in bundles:
        n = b["types"].get("cc.EffectAsset", 0)
        if b["name"] == "internal":
            builtin += n
        else:
            custom += n
    return {"builtin": builtin, "custom": custom}


# ------------------------------------------------------------ entry / html ---


def scan_entries(root, files):
    out = []
    for p in files:
        if os.path.basename(p).lower().endswith(".html"):
            rel = os.path.relpath(p, root).replace("\\", "/")
            txt = read_text(p, 40_000)
            out.append(
                {
                    "file": rel,
                    "bytes": os.path.getsize(p),
                    "scripts": re.findall(r'<script[^>]+src=["\']([^"\']+)', txt)[:12],
                    "hasCanvas": "GameCanvas" in txt or "<canvas" in txt.lower(),
                }
            )
    out.sort(key=lambda e: (e["file"].count("/"), e["file"]))
    return out


def size_breakdown(root, files):
    by_ext = collections.Counter()
    by_dir = collections.Counter()
    total = 0
    for p in files:
        try:
            sz = os.path.getsize(p)
        except OSError:
            continue
        total += sz
        ext = (os.path.splitext(p)[1] or "<none>").lower()
        by_ext[ext] += sz
        rel = os.path.relpath(p, root).replace("\\", "/")
        by_dir[rel.split("/")[0] if "/" in rel else "<root>"] += sz
    return {
        "totalBytes": total,
        "byExt": dict(by_ext.most_common(12)),
        "byTopDir": dict(by_dir.most_common(12)),
        "fileCount": len(files),
    }


# -------------------------------------------------------------------- main ---


def main():
    ap = argparse.ArgumentParser(description="Quét nhanh một bản build HTML5 trước khi port sang Cocos 3.x")
    ap.add_argument("--root", required=True, help="thư mục build cần quét")
    ap.add_argument("--out", default="cocos-port-triage", help="thư mục ghi kết quả (mặc định ./cocos-port-triage)")
    ap.add_argument("--json", action="store_true", help="in JSON ra stdout thay vì bản tóm tắt")
    a = ap.parse_args()

    root = os.path.abspath(a.root)
    if not os.path.isdir(root):
        sys.exit(f"không thấy thư mục: {root}")

    files = list(walk_files(root))
    engine = detect_engine(root, files)
    engine.pop("_basenames", None)
    srcproj = detect_source_project(root, files)
    bundles = scan_bundles(root)
    entries = scan_entries(root, files)
    sizes = size_breakdown(root, files)

    code_cands = pick_code_bundles(root, files)
    code = []
    for kind, sz, rel, p in code_cands:
        g = grade_obfuscation(p, sz)
        code.append({"file": rel, "kind": kind, "bytes": sz, **g})
    # chỉ grep rủi ro trên code GAME — host/SDK của vendor gây nhiễu kết luận
    risks, hosts = scan_risks([p for k, _s, _r, p in code_cands if k == "game"])

    game_code = [c for c in code if c["kind"] == "game"]
    worst = "L0"
    for c in game_code:
        if c["grade"] > worst:
            worst = c["grade"]
    if not game_code:
        if engine.get("hasJsc") or engine.get("hasWasm"):
            worst = "L4"  # code nằm ở bytecode/wasm — không lấy được
        elif code:
            worst = "L3"  # có JS nhưng toàn vendor/bản sao: chưa tìm ra code game
        else:
            worst = "unknown"  # không có file code nào để chấm — đừng đoán
    if srcproj["isSourceProject"]:
        worst = "L0"

    total_missing = sum(b["importMissing"] + b["nativeMissing"] for b in bundles)
    all_scenes = sorted({s for b in bundles for s in b["scenes"]})

    result = {
        "root": root,
        "engine": engine,
        "sourceProject": srcproj,
        "obfuscationGrade": worst,
        "codeBundles": code,
        "bundles": bundles,
        "manifestClosure": {
            "importTotal": sum(b["importTotal"] for b in bundles),
            "importMissing": sum(b["importMissing"] for b in bundles),
            "nativeTotal": sum(b["nativeTotal"] for b in bundles),
            "nativeMissing": sum(b["nativeMissing"] for b in bundles),
            "clean": total_missing == 0,
        },
        "scenes": all_scenes,
        "effects": count_custom_effects(bundles),
        "risks": risks,
        "networkHosts": hosts,
        "entries": entries,
        "size": sizes,
    }

    os.makedirs(a.out, exist_ok=True)
    outp = os.path.join(a.out, "triage.json")
    with open(outp, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    if a.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    e = engine
    print(f"\n=== TRIAGE: {root}")
    print(f"  engine      : {e['family']} {e['version'] or '?'} (major {e['major']}, tin cậy {e['confidence']})")
    for x in e["evidence"][:4]:
        print(f"                - {x}")
    if srcproj["isSourceProject"]:
        print(f"  !! ĐÂY LÀ SOURCE PROJECT ({srcproj['metaFiles']} .meta, {srcproj['assetScripts']} script) — không cần recon")
    print(f"  dung lượng  : {human(sizes['totalBytes'])} / {sizes['fileCount']} file")
    print(f"  obfuscation : {worst}   (chấm trên code GAME, bỏ qua SDK/bản sao)")
    for c in code[:5]:
        s = c["signals"]
        tag = {"game": "GAME  ", "vendor": "vendor", "duplicate": "b.sao "}[c["kind"]]
        print(f"                [{tag}] {c['file']}  {human(c['bytes'])}  {c['grade']}  "
              f"{s['modules']} module, đọc được {int(s['readableFraction']*100)}%")
    mc = result["manifestClosure"]
    flag = "OK" if mc["clean"] else "THIẾU FILE"
    print(f"  asset       : import {mc['importTotal']-mc['importMissing']}/{mc['importTotal']}, "
          f"native {mc['nativeTotal']-mc['nativeMissing']}/{mc['nativeTotal']}  → {flag}")
    print(f"  bundle      : {', '.join(b['name'] for b in bundles) or '(không thấy)'}")
    # Cắt danh sách thì PHẢI nói là đã cắt: người đọc dùng output này để chọn
    # startScene, mà scene boot hay nằm cuối danh sách (startup/, main) — ẩn nó đi
    # là đẩy người ta vào đúng bẫy "builder rơi về scene index 0" (pitfalls §6).
    SCENE_CAP = 25
    print(f"  scene       : {len(all_scenes)}")
    for s in all_scenes[:SCENE_CAP]:
        print(f"                {s}")
    if len(all_scenes) > SCENE_CAP:
        print(f"                … và {len(all_scenes) - SCENE_CAP} scene nữa "
              f"— đủ danh sách trong triage.json")
    print(f"  shader riêng: {result['effects']['custom']} (builtin {result['effects']['builtin']})")
    ent = [x["file"] for x in entries]
    print(f"  entry html  : {', '.join(ent[:5]) or '(không thấy)'}"
          + (f"  (+{len(ent) - 5} nữa)" if len(ent) > 5 else ""))
    hot = {k: v for k, v in risks.items() if v}
    top = sorted(hot.items(), key=lambda x: -x[1])[:10]
    print(f"  tín hiệu    : " + ", ".join(f"{k}={v}" for k, v in top)
          + (f"  (+{len(hot) - 10} loại nữa)" if len(hot) > 10 else ""))
    if hosts:
        print(f"  host mạng   : " + ", ".join(h for h, _ in hosts[:6]))
    print(f"\n  → {outp}\n")


if __name__ == "__main__":
    main()
