#!/usr/bin/env python3
"""
extract-cocos3x-assets.py — bóc asset khỏi một bản BUILD Cocos Creator 3.x và
trả chúng về ĐÚNG đường dẫn logic (db://assets/...) để import lại vào project 3.8.

Bản build 3.x lưu asset theo uuid:

    assets/<bundle>/config.<hash>.json   bảng uuid ↔ đường dẫn logic ↔ kiểu
    assets/<bundle>/import/<2 ký tự>/<uuid>.json[.ccon]   asset đã serialize
    assets/<bundle>/native/<2 ký tự>/<uuid>.<ext>         file gốc (png/mp3/bin)

Script này đọc config, giải nén uuid (dạng nén 22 ký tự → uuid đầy đủ), rồi copy
từng file về `<out>/<bundle>/<đường-dẫn-logic>.<ext>`.

KHÔNG ĐOÁN: file nào không tra được đường dẫn thì để trong `_unmapped/` và đếm
riêng. Tỉ lệ map được in ra cuối — thấp bất thường nghĩa là bản build dùng cấu
trúc khác, đừng dùng kết quả.

    python3 extract-cocos3x-assets.py --root <BUILD> --out <THƯ-MỤC-RA>
    python3 extract-cocos3x-assets.py --root <BUILD> --out <OUT> --dry-run

Chỉ cần python3, không cần node.
"""

import argparse
import json
import os
import re
import shutil
import sys

BASE64_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
BASE64_VALUES = {c: i for i, c in enumerate(BASE64_KEYS)}
HEX = "0123456789abcdef"


def decode_uuid(compressed):
    """uuid nén 22 ký tự của Cocos → uuid đầy đủ 36 ký tự.

    Giữ 2 ký tự đầu, mỗi cặp base64 còn lại sinh 3 ký tự hex. Chuỗi không đúng
    22 ký tự thì trả nguyên — nó vốn đã là uuid đầy đủ.
    """
    if len(compressed) != 22:
        return compressed
    try:
        out = [compressed[0], compressed[1]]
        for i in range(2, 22, 2):
            lhs = BASE64_VALUES[compressed[i]]
            rhs = BASE64_VALUES[compressed[i + 1]]
            out.append(HEX[lhs >> 2])
            out.append(HEX[((lhs & 3) << 2) | (rhs >> 4)])
            out.append(HEX[rhs & 0xF])
    except (KeyError, IndexError):
        return compressed
    s = "".join(out)
    return f"{s[0:8]}-{s[8:12]}-{s[12:16]}-{s[16:20]}-{s[20:32]}"


def encode_uuid(full):
    """Nghịch đảo của decode_uuid — dùng để tự kiểm, không dùng trong pipeline."""
    hexs = full.replace("-", "")
    if len(hexs) != 32:
        return full
    out = hexs[:2]
    rest = hexs[2:]
    for i in range(0, 30, 3):
        h1, h2, h3 = (int(rest[i], 16), int(rest[i + 1], 16), int(rest[i + 2], 16))
        out += BASE64_KEYS[(h1 << 2) | (h2 >> 2)]
        out += BASE64_KEYS[((h2 & 3) << 4) | h3]
    return out


def find_configs(root):
    """Mọi assets/<bundle>/config*.json trong build."""
    found = []
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules")]
        for name in files:
            if re.fullmatch(r"config(\.[0-9a-z]+)?\.json", name):
                found.append(os.path.join(base, name))
    return sorted(found)


def load_config(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def build_uuid_map(config):
    """uuid đầy đủ → (đường dẫn logic, tên kiểu).

    `paths` là { "<chỉ số trong uuids>": ["path", <chỉ số trong types>] }.
    Bản build cũ dùng key là uuid thẳng — xử lý cả hai.
    """
    uuids = [decode_uuid(u) for u in config.get("uuids", [])]
    types = config.get("types", [])
    mapping = {}
    for key, value in (config.get("paths") or {}).items():
        if isinstance(value, list) and value:
            logical = value[0]
            type_name = types[value[1]] if len(value) > 1 and value[1] < len(types) else ""
        else:
            logical, type_name = str(value), ""
        if key.isdigit() and int(key) < len(uuids):
            uuid = uuids[int(key)]
        else:
            uuid = decode_uuid(key)
        mapping[uuid] = (logical, type_name)
    return mapping, uuids


def uuid_of_file(name):
    """<uuid>.<ext> hoặc <uuid>.<ver>.<ext> → uuid (bỏ hậu tố version/ext)."""
    stem = name.split(".")[0]
    return stem


def collect_files(bundle_dir, sub):
    target = os.path.join(bundle_dir, sub)
    if not os.path.isdir(target):
        return []
    found = []
    for base, _dirs, files in os.walk(target):
        for name in files:
            found.append(os.path.join(base, name))
    return sorted(found)


def extension_of(name):
    parts = name.split(".")
    return parts[-1] if len(parts) > 1 else "bin"


def main():
    parser = argparse.ArgumentParser(description="Bóc asset khỏi build Cocos 3.x")
    parser.add_argument("--root", required=True, help="thư mục build (chứa assets/)")
    parser.add_argument("--out", required=True, help="thư mục xuất ra (ngoài build)")
    parser.add_argument("--dry-run", action="store_true", help="chỉ đếm, không ghi file")
    args = parser.parse_args()

    root = os.path.abspath(args.root)
    out_root = os.path.abspath(args.out)
    if not os.path.isdir(root):
        sys.exit(f"không thấy thư mục: {root}")
    if out_root.startswith(root + os.sep):
        sys.exit("--out không được nằm trong --root: giữ bản build nguyên trạng")

    configs = find_configs(root)
    if not configs:
        sys.exit("không thấy config*.json nào — đây có phải build Cocos 3.x không?")

    report = {"root": root, "out": out_root, "bundles": [], "totals": {
        "mapped": 0, "unmapped": 0, "missing": 0, "bundles": len(configs)}}

    for config_path in configs:
        bundle_dir = os.path.dirname(config_path)
        bundle_name = os.path.basename(bundle_dir)
        config = load_config(config_path)
        mapping, uuids = build_uuid_map(config)

        native_files = collect_files(bundle_dir, config.get("nativeBase", "native"))
        import_files = collect_files(bundle_dir, config.get("importBase", "import"))

        mapped, unmapped = [], []
        seen_uuids = set()

        for kind, files in (("native", native_files), ("import", import_files)):
            for source in files:
                name = os.path.basename(source)
                uuid = uuid_of_file(name)
                seen_uuids.add(uuid)
                hit = mapping.get(uuid)
                if hit:
                    logical, type_name = hit
                    extension = extension_of(name)
                    if kind == "import":
                        destination = os.path.join(
                            out_root, bundle_name, "_import", f"{logical}.{extension}")
                    else:
                        destination = os.path.join(
                            out_root, bundle_name, f"{logical}.{extension}")
                    mapped.append({"uuid": uuid, "path": logical, "type": type_name,
                                   "kind": kind, "source": source, "dest": destination})
                else:
                    destination = os.path.join(out_root, bundle_name, "_unmapped", kind, name)
                    unmapped.append({"uuid": uuid, "kind": kind,
                                     "source": source, "dest": destination})

        # uuid có trong config nhưng không có file nào trên đĩa: asset thiếu thật
        missing = [{"uuid": uuid, "path": info[0], "type": info[1]}
                   for uuid, info in mapping.items() if uuid not in seen_uuids]

        if not args.dry_run:
            for row in mapped + unmapped:
                os.makedirs(os.path.dirname(row["dest"]), exist_ok=True)
                shutil.copy2(row["source"], row["dest"])

        total = len(mapped) + len(unmapped)
        rate = (len(mapped) / total * 100) if total else 0.0
        report["bundles"].append({
            "bundle": bundle_name,
            "config": config_path,
            "uuidsInConfig": len(uuids),
            "pathsInConfig": len(mapping),
            "mapped": len(mapped),
            "unmapped": len(unmapped),
            "missing": len(missing),
            "mapRate": round(rate, 1),
            "missingSample": [row["path"] for row in missing[:10]],
        })
        report["totals"]["mapped"] += len(mapped)
        report["totals"]["unmapped"] += len(unmapped)
        report["totals"]["missing"] += len(missing)

    total_files = report["totals"]["mapped"] + report["totals"]["unmapped"]
    report["totals"]["mapRate"] = round(
        report["totals"]["mapped"] / total_files * 100, 1) if total_files else 0.0

    if not args.dry_run:
        os.makedirs(out_root, exist_ok=True)
        with open(os.path.join(out_root, "extract-report.json"), "w", encoding="utf-8") as handle:
            json.dump(report, handle, ensure_ascii=False, indent=2)

    print(json.dumps(report["totals"], ensure_ascii=False, indent=2))
    for bundle in report["bundles"]:
        print(f"  {bundle['bundle']:<16} map {bundle['mapRate']:>5}%  "
              f"mapped {bundle['mapped']:<5} unmapped {bundle['unmapped']:<5} "
              f"missing {bundle['missing']}")

    # Map dưới 50% = gần như chắc chắn đọc sai cấu trúc. Fail để không ai dùng
    # nhầm kết quả như thể nó đúng.
    if report["totals"]["mapRate"] < 50.0:
        print("\n⚠ map rate thấp — cấu trúc build không khớp giả định. "
              "Kiểm lại config*.json trước khi dùng kết quả.", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
