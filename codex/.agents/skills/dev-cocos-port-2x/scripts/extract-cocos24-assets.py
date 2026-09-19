#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Trích xuất toàn bộ asset tái sử dụng từ build Cocos Creator 2.4.x (WeChat/Douyin
mini-game hoặc web).
- audio (mp3), texture standalone: copy theo tên/đường dẫn gốc
- SpriteFrame: crop từng sprite từ texture đóng gói (xử lý rotated/offset)
- Spine (sp.SkeletonData): gom json + atlas + png (đổi <n>.skeleton.json -> <n>.json)
- ParticleSystem (.plist) + texture: copy nguyên
Ghi ra: <out>/  (kèm manifest.json)

  python3 extract-cocos24-assets.py --root <thư-mục-build> --out extracted-assets \
          --bundle assets/internal:internal --bundle subpackages/MainBdl:MainBdl

Không truyền --bundle thì tự dò mọi thư mục có config.*.json.
Kiểm chéo sau khi chạy: số asset bóc được phải khớp số entry trong config.*.json
của từng bundle; thiếu nghĩa là bản mirror còn thiếu file (quay lại GĐ1 bước 1).

Cần: pip install pillow
"""
import argparse, json, os, re, glob, shutil, sys, unicodedata
from collections import defaultdict
from PIL import Image

ROOT = None    # gán trong main() từ --root
OUT = None     # gán trong main() từ --out
BUNDLES = []   # [(đường dẫn bundle tương đối ROOT, tên hiển thị)]

manifest = {"bundles": [], "warnings": []}
stats = defaultdict(int)

# ── Chỉ mục TOÀN CỤC uuid -> đường dẫn logic ─────────────────────────────────
# Vì sao phải toàn cục: file `native/` của một asset có thể nằm trong bundle A
# trong khi đường dẫn logic của nó chỉ được khai báo ở `config.json` của bundle B
# (đo trên game tank: 51 file ở `editor`, 226 ở `scene`, 257 ở `resources` nhưng
# path do bundle `res` khai báo). Bản cũ chỉ tra trong config của CHÍNH bundle
# đang xử lý nên những asset đó mất tên và rơi vào `_by_name/` — rồi mã port nạp
# theo đường dẫn thì không thấy gì, sprite im lặng không hiện.
U2P = {}          # uuid giải nén -> (path, typeName, bundle khai báo)
STEM2UUID = {}    # mọi dạng tên có thể xuất hiện trong tên file -> uuid giải nén
_STEM_DUP = set()

# --- Cocos UUID decompress (nén base64 22 ký tự -> uuid chuẩn có gạch nối) ---
_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
_VAL = {c: i for i, c in enumerate(_B64)}
_HEX = "0123456789abcdef"


def decode_uuid(u):
    if not isinstance(u, str) or len(u) != 22:
        return u
    try:
        out = [u[0], u[1]]
        for i in range(2, 22, 2):
            l = _VAL[u[i]]; r = _VAL[u[i + 1]]
            out.append(_HEX[l >> 2])
            out.append(_HEX[((l & 3) << 2) | (r >> 4)])
            out.append(_HEX[r & 0xF])
        s = "".join(out)
        return f"{s[0:8]}-{s[8:12]}-{s[12:16]}-{s[16:20]}-{s[20:32]}"
    except Exception:
        return u


def safe(name):
    """Chuẩn hoá tên file, giữ Unicode (tiếng Trung) nhưng bỏ ký tự cấm."""
    name = name.replace("\\", "/")
    parts = []
    for seg in name.split("/"):
        seg = re.sub(r'[<>:"|?*\x00-\x1f]', "_", seg).strip()
        if seg in ("", ".", ".."):
            seg = "_"
        parts.append(seg)
    return "/".join(parts)


def find_native(bundle_dir, uuid):
    """Tìm file native theo uuid: thử dạng gốc (short/numeric) và dạng đã giải mã."""
    for cand in (uuid, decode_uuid(uuid)):
        hits = glob.glob(os.path.join(bundle_dir, "native", "**", cand + ".*"),
                         recursive=True)
        exact = [h for h in hits if os.path.basename(h).split(".")[0] == cand]
        if exact:
            return exact[0]
        if hits:
            return hits[0]
    return None


def walk_frames(node, acc):
    """Thu mọi object có 'rect' (một SpriteFrame) trong cây JSON, giữ thứ tự."""
    if isinstance(node, dict):
        if "rect" in node and "originalSize" in node:
            acc.append(node)
        else:
            for v in node.values():
                walk_frames(v, acc)
    elif isinstance(node, list):
        for v in node:
            walk_frames(v, acc)


# =====================================================================
#  Giải file import 2.x theo SECTION
#
#  ⚠⚠ ĐÂY LÀ CHỖ TỪNG CÓ BUG IM LẶNG — ĐỌC TRƯỚC KHI SỬA ⚠⚠
#
#  Bản cũ chọn texture cho mỗi SpriteFrame bằng CHỈ SỐ:
#
#      tex_uuids = [d for d in data[1] if isinstance(d, str)]   # deps cả file
#      frames    = walk_frames(data[5:])                        # frame cả file
#      tu        = tex_uuids[fi]                                # ghép theo fi
#
#  Với file ĐƠN (1 asset) thì đúng vì chỉ có một frame và một dep. Với file GÓI
#  (pack — một .json chứa hàng chục asset) thì `data[1]` là danh sách uuid DÙNG
#  CHUNG của cả gói, thứ tự KHÔNG liên quan gì tới thứ tự frame. Kết quả:
#
#      rect ĐÚNG  +  texture SAI  →  ảnh bóc ra ĐÚNG KÍCH THƯỚC nhưng nội dung
#      là một mảnh của texture khác. Không exception, không warning, không log.
#
#  Đo trên một game thật (tank): 165/368 ảnh nhóm `_by_name` là crop sai texture.
#  Không ai phát hiện cho tới khi so hash pixel với bản dựng lại theo uuid.
#
#  CÁCH ĐÚNG (bản này): mỗi asset là MỘT SECTION riêng, và section mang sẵn
#  tham chiếu tường minh `_textureSetter` trong bộ ba
#  (DependObjs, DependKeys, DependUuidIndices). Đọc từ đó, KHÔNG BAO GIỜ ghép
#  theo chỉ số. ĐỪNG quay về lối cũ dù trông gọn hơn.
#
#  Bố cục IFileData của Cocos Creator 2.4 (11 ô):
#      0 Version         1 SharedUuids   2 SharedStrings  3 SharedClasses
#      4 SharedMasks     5 Instances     6 InstanceTypes  7 Refs
#      8 DependObjs      9 DependKeys   10 DependUuidIndices
#  File gói: 6 ô, trong đó ô 5 là danh sách section, mỗi section 6 ô
#  (Instances, InstanceTypes, Refs, DependObjs, DependKeys, DependUuidIndices).
#  Bốn ô shared đầu dùng chung cho mọi section.
#
#  ⚠ BỆNH "TRA TRONG BUNDLE ĐANG XỬ LÝ" CÓ MẶT Ở **BA** CHỖ, KHÔNG PHẢI MỘT.
#    Đã có người sửa chỗ (3) rồi tưởng xong; chỗ (1) vẫn làm mất 2 file.
#      (1) bước 1, `path_of()`      — đường dẫn của audio/texture standalone
#      (2) bước 2, spine            — texture của SkeletonData + file import
#      (3) bước 3, `_textureSetter` — texture của SpriteFrame
#    Cả ba phải tra chỉ mục TOÀN CỤC (`U2P` / `find_native_any`). Trước khi kết
#    luận "đã sửa xong", grep `paths.get(` và `find_native(bdir` trong file này.
# =====================================================================

FD_UUIDS, FD_STRINGS, FD_CLASSES = 1, 2, 3
FD_INSTANCES, FD_DEPOBJS, FD_DEPKEYS, FD_DEPUUIDS = 5, 8, 9, 10


def build_global_index():
    """Nạp `config.*.json` của MỌI bundle vào U2P + STEM2UUID (xem ghi chú trên)."""
    for rel, disp in BUNDLES:
        cfgs = glob.glob(os.path.join(ROOT, rel, "config.*.json"))
        if not cfgs:
            continue
        try:
            cfg = json.load(open(cfgs[0], encoding="utf-8"))
        except (OSError, ValueError) as e:
            manifest["warnings"].append("đọc config lỗi %s: %s" % (cfgs[0], e))
            continue
        uuids, types = cfg.get("uuids", []), cfg.get("types", [])
        for k, v in cfg.get("paths", {}).items():
            try:
                i = int(k)
            except ValueError:
                continue
            if i >= len(uuids):
                continue
            ti = v[1] if len(v) > 1 else -1
            t = types[ti] if isinstance(ti, int) and 0 <= ti < len(types) else "?"
            U2P.setdefault(decode_uuid(uuids[i]), (v[0], t, disp))
        for u in uuids:
            d = decode_uuid(u)
            # tên file import/native có thể là uuid nén, uuid giải nén, hoặc 9 ký
            # tự đầu của một trong hai. Dạng 9 ký tự có thể trùng nhau -> loại bỏ
            # thay vì đoán (đoán sai ở đây là gán ảnh cho asset khác).
            for form in (u, d):
                if STEM2UUID.get(form, d) != d:
                    _STEM_DUP.add(form)
                STEM2UUID[form] = d
            for form in (u[:9], d[:9]):
                if STEM2UUID.get(form, d) != d:
                    _STEM_DUP.add(form)
                STEM2UUID.setdefault(form, d)
    for f in _STEM_DUP:
        STEM2UUID.pop(f, None)


def uuid_of_stem(stem):
    return STEM2UUID.get(stem)


def unpack_sections(data):
    """File gói -> danh sách IFileData 11 ô. File đơn -> chính nó. Khác -> []."""
    if (isinstance(data, list) and len(data) == 6 and isinstance(data[5], list)
            and data[5] and isinstance(data[5][0], list) and len(data[5][0]) == 6):
        shared = data[0:5]
        return [list(shared) + list(sec) for sec in data[5]]
    if isinstance(data, list) and len(data) == 11:
        return [data]
    return []


def section_classes(sec):
    return [c if isinstance(c, str) else c[0] for c in (sec[FD_CLASSES] or [])]


def section_dep_uuid(sec, want_key):
    """uuid mà section này gán vào thuộc tính `want_key` (vd `_textureSetter`).

    Đây là THAM CHIẾU TƯỜNG MINH của chính section — không phải suy từ thứ tự
    `deps` của cả file. Xem khối cảnh báo phía trên để biết vì sao bắt buộc.
    """
    uuids = sec[FD_UUIDS] or []
    strings = sec[FD_STRINGS] or []
    keys = sec[FD_DEPKEYS] or []
    uidx = sec[FD_DEPUUIDS] or []
    for i, k in enumerate(keys):
        if isinstance(k, bool):
            continue
        if isinstance(k, int):
            key = strings[k] if 0 <= k < len(strings) else (~k if k < 0 else None)
        else:
            key = k
        if key != want_key or i >= len(uidx):
            continue
        u = uidx[i]
        return uuids[u] if isinstance(u, int) and 0 <= u < len(uuids) else u
    return None


def find_native_any(uuid):
    """Tìm file native theo uuid trong MỌI bundle.

    Cần vì texture của một SpriteFrame có thể được ship ở bundle khác (xem ghi
    chú U2P). Bản cũ chỉ tìm trong bundle đang xử lý nên bỏ qua pixel thật.
    """
    for rel, _disp in BUNDLES:
        f = find_native(os.path.join(ROOT, rel), uuid)
        if f:
            return f
    return None


def crop_frame(tex_img, fr):
    """Crop 1 SpriteFrame từ texture, trả ảnh upright."""
    x, y, w, h = fr["rect"]
    rotated = bool(fr.get("rotated", 0))
    if rotated:
        # vùng trong atlas bị xoay 90° CW: kích thước thực (h x w)
        box = (x, y, x + h, y + w)
        crop = tex_img.crop(box)
        crop = crop.transpose(Image.ROTATE_270)  # đưa về upright (CW pack -> xoay ngược)
    else:
        crop = tex_img.crop((x, y, x + w, y + h))
    return crop


def process_bundle(rel_dir, disp):
    bdir = os.path.join(ROOT, rel_dir)
    cfgs = glob.glob(os.path.join(bdir, "config.*.json"))
    if not cfgs:
        return
    cfg = json.load(open(cfgs[0], encoding="utf-8"))
    types = cfg.get("types", [])
    paths = cfg.get("paths", {})
    uuids = cfg.get("uuids", [])
    vimport = cfg.get("versions", {}).get("import", [])
    vnative = cfg.get("versions", {}).get("native", [])
    # pack-id -> danh sách uuid THEO ĐÚNG THỨ TỰ SECTION trong file .json gói.
    # Đây là thứ cho phép biết section thứ i là asset nào; tên file gói là pack-id
    # nên KHÔNG tra được qua `versions.import` (lý do bản cũ mất tên hàng loạt).
    packs = {pid: [uuids[i] if isinstance(i, int) else i for i in lst]
             for pid, lst in cfg.get("packs", {}).items()}

    # hash -> idx (import & native)
    imp_hash2idx = {vimport[i + 1]: vimport[i] for i in range(0, len(vimport), 2)}
    nat_hash2idx = {vnative[i + 1]: vnative[i] for i in range(0, len(vnative), 2)}

    # idx -> (path, type)
    def path_of(idx):
        """(đường dẫn logic, type) của asset thứ `idx` trong bundle này.

        ⚠⚠ NHÁNH DỰ PHÒNG TOÀN CỤC LÀ BẮT BUỘC — ĐỌC TRƯỚC KHI BỎ ⚠⚠

        Bản cũ chỉ tra `paths` của CHÍNH bundle đang xử lý. Đó là **CÙNG MỘT BUG**
        với lỗi đã sửa ở bước 3, chỉ ở một bước khác — sửa bước 3 rồi tưởng xong
        là sai:

            xử lý bundle A: CÓ file native, nhưng `paths` của A không khai báo
                            đường dẫn này   →  p = None            →  continue
            xử lý bundle B: CÓ khai báo đường dẫn, nhưng không có file native
                            trong B/native  →  pick_file() = None  →  continue

        Không bundle nào ghi được file ⇒ asset rơi vào `_raw_unnamed/` mang tên
        uuid ⇒ mã port nạp theo đường dẫn KHÔNG THẤY GÌ. Không lỗi, không warning.

        Đo trên game tank: 2 đường dẫn (`cc.SpriteAtlas` + `cc.Texture2D`) có file
        native ở `assets/resources/native/` nhưng đường dẫn do bundle `res` khai
        báo — mất tên ở cả hai lượt.

        `U2P` được dựng TRƯỚC mọi bundle chính vì việc này (xem `build_global_index`).
        ĐỪNG quay về chỉ tra `paths` cục bộ dù trông gọn hơn.
        """
        e = paths.get(str(idx))
        if e:
            ti = e[1] if len(e) > 1 else -1
            t = types[ti] if isinstance(ti, int) and 0 <= ti < len(types) else "?"
            return e[0], t
        if isinstance(idx, int) and 0 <= idx < len(uuids):
            rec = U2P.get(decode_uuid(uuids[idx]))
            if rec:
                return rec[0], rec[1]        # (path, typeName) từ chỉ mục TOÀN CỤC
        return None, None

    binfo = {"name": disp, "audio": 0, "textures": 0, "sprites": 0,
             "spine": 0, "particles": 0, "fonts": 0, "raw_copied": 0}

    # ---------- 1. Audio + texture standalone (native có path trực tiếp) ----------
    # `isfile` là BẮT BUỘC, không phải phòng xa: Cocos 2.4 lưu `cc.TTFFont` dưới
    # dạng THƯ MỤC `native/<xx>/<uuid>.<hash>/<tên thật>.ttf`, và tên thư mục có
    # dấu chấm nên khớp luôn glob `*.*`. Không lọc thì `shutil.copy2` chết với
    # IsADirectoryError giữa lúc chạy (đo thật trên girl-rescue-dragon).
    native_files = [f for f in glob.glob(os.path.join(bdir, "native", "**", "*.*"),
                                         recursive=True) if os.path.isfile(f)]
    # Lọc file rồi thì thư mục font BIẾN MẤT khỏi danh sách -> phải bắt riêng,
    # nếu không font mất IM LẶNG (không lỗi, chỉ là Label rơi về font hệ thống ở
    # GĐ sau, và sai kiểu đó rất khó truy).
    dirs_by_hash = {}
    for d in glob.glob(os.path.join(bdir, "native", "**", "*.*"), recursive=True):
        if os.path.isdir(d):
            m = re.match(r"^(.+)\.([0-9a-fA-F]+)$", os.path.basename(d))
            if m:
                dirs_by_hash.setdefault(m.group(2), []).append(d)
    # hash -> [file] (nhiều file có thể trùng hash -> phân giải bằng uuid stem)
    files_by_hash = {}
    for f in native_files:
        m = re.match(r"^(.+)\.([0-9a-fA-F]+)\.(\w+)$", os.path.basename(f))
        if m:
            files_by_hash.setdefault(m.group(2), []).append(f)

    def pick_file(idx, h):
        cands = files_by_hash.get(h, [])
        if len(cands) <= 1:
            return cands[0] if cands else None
        # trùng hash: chọn file có stem khớp uuid (dạng nén, giải mã, hoặc short-9)
        u = uuids[idx]
        forms = {u, decode_uuid(u), u[:9], decode_uuid(u)[:9]}
        for f in cands:
            if os.path.basename(f).split(".")[0] in forms:
                return f
        return cands[0]

    used_native = set()
    # duyệt trực tiếp các cặp (idx, hash) để KHÔNG mất mục do trùng hash
    for i in range(0, len(vnative), 2):
        idx, h = vnative[i], vnative[i + 1]
        p, t = path_of(idx)
        # Asset lưu dạng thư mục (cc.TTFFont). Font thường KHÔNG có đường dẫn
        # logic trong bất kỳ config nào — nó chỉ được Label tham chiếu bằng uuid —
        # nên tên thật của file bên trong (vd `white.ttf`) chính là tên
        # authoritative, dùng nó khi `p` rỗng thay vì bỏ qua.
        if h in dirs_by_hash:
            for d in dirs_by_hash[h]:
                for inner in sorted(os.listdir(d)):
                    ip = os.path.join(d, inner)
                    if not os.path.isfile(ip):
                        continue
                    iext = inner.rsplit(".", 1)[-1].lower()
                    name = safe(p) + "." + iext if p else inner
                    _copy(ip, os.path.join(OUT, disp, "font", name))
                    binfo["fonts"] += 1
                    # glob `native/**/*.*` khớp cả file BÊN TRONG thư mục font,
                    # nên phải đánh dấu đã dùng, không thì nó rơi tiếp vào
                    # `_raw_unnamed/` và font bị ghi hai nơi.
                    used_native.add(ip)
            continue
        f = pick_file(idx, h)
        if not f or not p:
            continue
        ext = f.rsplit(".", 1)[-1].lower()
        if t == "cc.AudioClip" or ext in ("mp3", "wav", "ogg"):
            dst = os.path.join(OUT, disp, "audio", safe(p) + "." + ext)
            _copy(f, dst); binfo["audio"] += 1; used_native.add(f)
        elif t == "cc.Texture2D" or ext in ("png", "jpg", "jpeg"):
            dst = os.path.join(OUT, disp, "textures", safe(p) + "." + ext)
            _copy(f, dst); binfo["textures"] += 1; used_native.add(f)
        elif t == "sp.SkeletonData":
            pass  # xử lý ở bước spine

    # ---------- 2. Spine (skeleton json + atlas + png), gom theo deps ----------
    i2h_import = {v: k for k, v in imp_hash2idx.items()}
    for k, v in paths.items():
        if types[v[1]] != "sp.SkeletonData":
            continue
        idx = int(k)
        p = v[0]
        sdir = os.path.join(OUT, disp, "spine", safe(p))
        os.makedirs(sdir, exist_ok=True)
        base = os.path.basename(p)
        # skeleton json = file import của chính SkeletonData (định dạng serialize Cocos)
        h = i2h_import.get(idx)
        jf = file_by_hash_import(bdir, h) if h else None
        if jf:
            skel, atlas_text = _extract_spine(jf)
            if skel is not None:
                json.dump(skel, open(os.path.join(sdir, base + ".json"), "w",
                          encoding="utf-8"), ensure_ascii=False)
            else:
                manifest["warnings"].append(
                    "%s: spine %s — không đọc được `_skeletonJson`" % (disp, p))
            if not atlas_text:
                manifest["warnings"].append(
                    "%s: spine %s — không có `_atlasText`, sẽ thử native .atlas"
                    % (disp, p))
            else:
                open(os.path.join(sdir, base + ".atlas"), "w",
                     encoding="utf-8").write(atlas_text)
        else:
            # CÙNG GỐC với bug ở bước 1/bước 3: đường dẫn do bundle này khai báo
            # nhưng file `import/` của SkeletonData được ship ở bundle KHÁC, nên
            # `versions.import` của bundle này không có `idx`. Bản cũ im lặng tạo
            # thư mục spine RỖNG rồi vẫn `binfo["spine"] += 1` — đếm ra đủ mà
            # không có dữ liệu. Ở đây BÁO TO thay vì im lặng.
            # (Chưa vá hẳn được bằng cách tra chéo bundle: `versions.import` là
            #  của riêng từng bundle. Build tank có 0 asset spine nên KHÔNG có
            #  cách nào chạy thử một bản vá như vậy — đừng viết vá mò.)
            manifest["warnings"].append(
                "%s: spine %s — KHÔNG thấy file import (idx=%d). Thư mục spine sẽ "
                "thiếu .json/.atlas. Xem §16 pitfalls." % (disp, p, idx))
        # deps -> texture png (atlas KHÔNG nằm trong deps)
        deps = data_deps_of(jf)
        for du in deps:
            # tra TOÀN CỤC: texture của spine có thể ở bundle khác, đúng như
            # `_textureSetter` ở bước 3 (dòng ~408). Cùng một lý do.
            nf = find_native(bdir, du) or find_native_any(du)
            if not nf:
                continue
            ext = nf.rsplit(".", 1)[-1].lower()
            if ext in ("png", "jpg", "jpeg"):
                shutil.copy2(nf, os.path.join(sdir, base + "." + ext))
                used_native.add(nf)
        # đánh dấu native .atlas tương ứng là đã dùng (đã có atlas từ _atlasText);
        # fallback: nếu chưa có .atlas thì copy từ native
        for af in [f for f in native_files if f.endswith(".atlas")]:
            txt = open(af, encoding="utf-8", errors="ignore").read()
            m = re.search(r"^(\S+)\.png\s*$", txt, re.M)
            if m and m.group(1) == base:
                used_native.add(af)
                dst_atlas = os.path.join(sdir, base + ".atlas")
                if not os.path.exists(dst_atlas):
                    shutil.copy2(af, dst_atlas)
                break
        # đảm bảo png trùng tên khai báo trong atlas
        png = os.path.join(sdir, base + ".png")
        if not os.path.exists(png):
            for x in os.listdir(sdir):
                if x.lower().endswith(".png"):
                    os.rename(os.path.join(sdir, x), png)
                    break
        binfo["spine"] += 1

    # ---------- 3. SpriteFrame: bóc theo SECTION (KHÔNG ghép theo chỉ số) ------
    #
    # ⚠ Đọc khối cảnh báo ở `section_dep_uuid` trước khi sửa vòng lặp này. Hai
    #   quy tắc không được vi phạm:
    #     · texture LẤY TỪ `_textureSetter` CỦA CHÍNH SECTION;
    #     · đường dẫn logic tra bằng uuid của section (qua `packs`), tra ở chỉ
    #       mục TOÀN CỤC — không chỉ config của bundle đang xử lý.
    import_files = glob.glob(os.path.join(bdir, "import", "**", "*.json"), recursive=True)
    tex_cache = {}
    for jf in import_files:
        try:
            data = json.load(open(jf, encoding="utf-8"))
        except Exception:
            continue
        sections = unpack_sections(data)
        if not sections:
            continue
        stem = os.path.basename(jf).split(".")[0]
        # file GÓI: `packs[stem]` là danh sách uuid THEO ĐÚNG THỨ TỰ SECTION.
        # file ĐƠN: tên file chính là uuid (đầy đủ hoặc 9 ký tự đầu).
        pack_uuids = packs.get(stem)

        for si, sec in enumerate(sections):
            if "cc.SpriteFrame" not in section_classes(sec):
                continue
            frames = []
            walk_frames(sec[FD_INSTANCES], frames)
            if not frames:
                continue
            fr = frames[0]           # một section = một asset = một SpriteFrame

            tu = section_dep_uuid(sec, "_textureSetter")
            if not tu:
                manifest["warnings"].append(
                    f"{disp}: {os.path.basename(jf)} sec{si} không có _textureSetter")
                continue
            texf = find_native(bdir, tu) or find_native_any(tu)
            if not texf:
                # dep trỏ tới asset không có file rời (ref chéo) -> bỏ qua,
                # KHÔNG phải thiếu pixel thật
                continue

            # uuid + đường dẫn logic của CHÍNH SpriteFrame này
            if pack_uuids is not None and si < len(pack_uuids):
                au = decode_uuid(pack_uuids[si])
            else:
                au = uuid_of_stem(stem)
            rec = U2P.get(au) if au else None
            base_path = rec[0] if rec else None

            fname = fr.get("name") or f"frame{si}"
            rel = base_path or ("_by_name/" + fname)

            # ── ẢNH RỜI: ghi ẢNH GỐC, KHÔNG ghi bản crop ──────────────────────
            # Với ảnh rời, 2.x đã auto-trim lúc import nên `rect` là vùng ĐÃ CẮT
            # viền trong suốt, `originalSize` mới là kích thước thật. Nếu ghi bản
            # crop thì Cocos 3.8 auto-trim LẦN NỮA trên ảnh không còn viền =>
            # `rawWidth/rawHeight` và `offsetX/offsetY` sai => sprite dùng
            # SizeMode.RAW lệch vài pixel, im lặng. Nhận biết bằng DỮ LIỆU:
            # texture của frame và frame CÙNG một đường dẫn logic => texture
            # chính là ImageAsset của đường dẫn đó => chép nguyên byte.
            trec = U2P.get(decode_uuid(tu))
            if base_path and trec and trec[0] == base_path:
                ext = os.path.splitext(texf)[1].lower() or ".png"
                dst = os.path.join(OUT, disp, "sprites", safe(rel) + ext)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(texf, _dedup(dst))   # nguyên byte, không encode lại
                used_native.add(texf)
                binfo["sprites"] += 1
                continue

            # ── FRAME TRONG ATLAS: crop là đúng ──────────────────────────────
            if texf not in tex_cache:
                try:
                    tex_cache[texf] = Image.open(texf).convert("RGBA")
                except Exception as e:
                    manifest["warnings"].append(f"{disp}: mở texture lỗi {texf}: {e}")
                    tex_cache[texf] = None
            tex = tex_cache[texf]
            if tex is None:
                continue
            used_native.add(texf)
            dst = os.path.join(OUT, disp, "sprites", safe(rel) + ".png")
            try:
                crop = crop_frame(tex, fr)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                dst = _dedup(dst)     # tránh ghi đè trùng tên
                crop.save(dst)
                binfo["sprites"] += 1
            except Exception as e:
                manifest["warnings"].append(f"{disp}: crop lỗi {rel}: {e}")

    # ---------- 4. ParticleSystem .plist + native còn lại chưa dùng ----------
    for f in native_files:
        if f in used_native:
            continue
        ext = f.rsplit(".", 1)[-1].lower()
        if ext == "plist":
            dst = os.path.join(OUT, disp, "particles", os.path.basename(f))
            _copy(f, dst); binfo["particles"] += 1; used_native.add(f)
    # bất kỳ native nào còn sót -> _raw (đảm bảo KHÔNG mất pixel nào)
    for f in native_files:
        if f in used_native:
            continue
        ext = f.rsplit(".", 1)[-1].lower()
        dst = os.path.join(OUT, disp, "_raw_unnamed", os.path.basename(f))
        _copy(f, dst); binfo["raw_copied"] += 1

    manifest["bundles"].append(binfo)
    print(f"[{disp}] audio={binfo['audio']} textures={binfo['textures']} "
          f"sprites={binfo['sprites']} spine={binfo['spine']} "
          f"particles={binfo['particles']} fonts={binfo['fonts']} "
          f"raw={binfo['raw_copied']}")


def file_by_hash_import(bdir, h):
    hits = glob.glob(os.path.join(bdir, "import", "**", f"*.{h}.json"), recursive=True)
    return hits[0] if hits else None


def _extract_spine(jf):
    """Bóc _skeletonJson (spine thô) + _atlasText từ file serialize sp.SkeletonData."""
    try:
        d = json.load(open(jf, encoding="utf-8"))
    except Exception:
        return None, None
    try:
        classes = d[3]
        # tìm class sp.SkeletonData và thứ tự field
        cls_idx = None
        fields = None
        for i, c in enumerate(classes):
            if isinstance(c, list) and c and c[0] == "sp.SkeletonData":
                cls_idx = i
                fields = c[1]
                break
        if fields is None:
            return None, None
        insts = d[5]
        inst = insts[0] if isinstance(insts[0], list) else insts
        vals = {fields[i]: inst[i + 1] for i in range(len(fields)) if i + 1 < len(inst)}
        return vals.get("_skeletonJson"), vals.get("_atlasText")
    except Exception:
        return None, None


def data_deps_of(jf):
    """Lấy danh sách dep uuid (string) từ file import."""
    if not jf:
        return []
    try:
        d = json.load(open(jf, encoding="utf-8"))
    except Exception:
        return []
    if isinstance(d, list) and len(d) > 1 and isinstance(d[1], list):
        return [x for x in d[1] if isinstance(x, str)]
    return []


def _fix_spine_png_names(sdir, base):
    """Đổi tên png trong thư mục spine cho khớp tên khai báo trong .atlas."""
    atlas = os.path.join(sdir, base + ".atlas")
    if not os.path.exists(atlas):
        return
    txt = open(atlas, encoding="utf-8", errors="ignore").read()
    wanted = re.findall(r"^(\S+\.png)\s*$", txt, re.M)
    pngs = [f for f in os.listdir(sdir) if f.lower().endswith(".png")]
    if len(wanted) == 1 and len(pngs) == 1 and pngs[0] != wanted[0]:
        os.rename(os.path.join(sdir, pngs[0]), os.path.join(sdir, wanted[0]))


def _copy(src, dst):
    # Nổ rõ ràng thay vì IsADirectoryError trần: nếu một asset-thư-mục lọt tới
    # đây thì đó là lỗi phân loại ở trên, không phải lỗi copy.
    if os.path.isdir(src):
        raise IsADirectoryError(
            "asset lưu dạng thư mục chưa được phân loại: %s — xử lý ở nhánh "
            "dirs_by_hash, đừng đưa vào _copy" % src)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, _dedup(dst))


def _dedup(dst):
    if not os.path.exists(dst):
        return dst
    base, ext = os.path.splitext(dst)
    i = 2
    while os.path.exists(f"{base}__{i}{ext}"):
        i += 1
    return f"{base}__{i}{ext}"


def discover_bundles():
    """Tự dò: mọi thư mục chứa config.*.json là một bundle."""
    found = []
    for path in glob.glob(os.path.join(ROOT, "**", "config.*.json"), recursive=True):
        rel = os.path.relpath(os.path.dirname(path), ROOT)
        found.append((rel, os.path.basename(os.path.dirname(path))))
    return sorted(set(found))


def main():
    global ROOT, OUT, BUNDLES
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, help="thư mục build gốc (chứa các bundle)")
    ap.add_argument("--out", default="extracted-assets")
    ap.add_argument("--bundle", action="append", metavar="REL_DIR:TÊN",
                    help="chỉ định bundle; lặp được. Bỏ trống = tự dò config.*.json")
    args = ap.parse_args()

    ROOT = os.path.abspath(args.root)
    OUT = os.path.abspath(args.out)
    if not os.path.isdir(ROOT):
        sys.exit("không thấy --root: %s" % ROOT)

    if args.bundle:
        for item in args.bundle:
            rel, _, disp = item.partition(":")
            BUNDLES.append((rel, disp or os.path.basename(rel.rstrip("/"))))
    else:
        BUNDLES = discover_bundles()
        print("tự dò được %d bundle: %s" % (len(BUNDLES), [b[1] for b in BUNDLES]))
    if not BUNDLES:
        sys.exit("không tìm thấy bundle nào (config.*.json)")

    # PHẢI dựng chỉ mục toàn cục TRƯỚC khi xử lý bundle nào: asset của bundle A
    # có thể được bundle B khai báo đường dẫn (xem ghi chú U2P ở đầu file).
    build_global_index()
    print("chỉ mục toàn cục: %d uuid có đường dẫn logic" % len(U2P))

    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT, exist_ok=True)
    for rel, disp in BUNDLES:
        if os.path.isdir(os.path.join(ROOT, rel)):
            process_bundle(rel, disp)
        else:
            manifest["warnings"].append("bỏ qua bundle không tồn tại: %s" % rel)
    json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w",
              encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\nWarnings: {len(manifest['warnings'])}")
    print(f"Output: {OUT}")


if __name__ == "__main__":
    main()
