#!/usr/bin/env python3
"""Inventory third-party and non-English leftovers in a Cocos Creator 3.x project.

    python3 scan-third-party.py --root <project> [--keep tiktok] [--json out.json]

Scans assets/**/*.ts plus prefab/scene/json data and project extensions (third-party
editor extensions such as funplay-cocos-mcp are skipped) and reports, per file:

  platform   names of mini-game platforms / publishers / analytics SDKs
  host       host globals read off window/globalThis (tt, wx, qq, ks, qg, swan, my...)
  url        hard-coded http(s) endpoints
  han        Chinese characters (code, tooltips, logs, prefab labels)
  vi-comment Vietnamese comments (with or without diacritics)
  header     "Recovered from the shipped ... bundle" port headers

Nothing is modified. Use the report to decide what to delete, what to replace and
what to translate; rerun it at the end: every remaining hit must be a deliberate keep.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

PLATFORMS = [
    "wechat", "weixin", "douyin", "bytedance", "toutiao", "zjtd", "kuaishou", "kwai",
    "qq", "oppo", "vivo", "huawei", "xiaomi", "meizu", "baidu", "alipay", "taptap",
    "thinking", "thinkingdata", "umeng", "uma", "adjust", "appsflyer", "firebase",
    "vng", "choingay", "zuiqiang", "zing", "gamebox",
    "tiktok", "ttminis",
]
HOST_RE = re.compile(r"\b(?:w|window|globalThis|W|G)\.(tt|wx|qq|ks|qg|swan|my|kwaigame|wxapi|g_ta|uma|VNGGamesSDK)\b")
URL_RE = re.compile(r"https?://[A-Za-z0-9.\-]+[^\s\"'`)]*")
HAN_RE = re.compile("[\u4e00-\u9fff]")  # CJK Unified Ideographs
VI_DIACRITIC_RE = re.compile(r"[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹĂÂĐÊÔƠƯ]")
VI_ASCII_WORDS = re.compile(
    r"\b(khong|duoc|cua|nhung|trong|nguoi|dung|chua|cac|mot|voi|thi|neu|lai|roi|vao|bang|nen|tao|chi)\b",
    re.I,
)
COMMENT_RE = re.compile(r"^\s*(//|\*|/\*)")
HEADER_RE = re.compile(r"Recovered from the shipped \w+ bundle")

SKIP_DIRS = {"node_modules", "library", "temp", "build", "profiles", ".git", "funplay-cocos-mcp"}
TEXT_EXT = {".ts", ".js", ".json", ".prefab", ".scene", ".md", ".txt"}


def iter_files(root: Path):
    for base in ("assets", "extensions"):
        d = root / base
        if not d.exists():
            continue
        for p in d.rglob("*"):
            if not p.is_file() or p.suffix not in TEXT_EXT or p.name.endswith(".meta"):
                continue
            if any(part in SKIP_DIRS for part in p.relative_to(root).parts):
                continue
            yield p


def scan_file(path: Path, keep: set[str]):
    hits: dict[str, list[str]] = {}
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (UnicodeDecodeError, OSError):
        return hits
    is_code = path.suffix in (".ts", ".js")
    plat_re = re.compile(r"\b(" + "|".join(sorted(set(PLATFORMS) - keep, key=len, reverse=True)) + r")\b", re.I)

    def add(kind, n, text):
        hits.setdefault(kind, []).append(f"{n}: {text.strip()[:140]}")

    for n, line in enumerate(lines, 1):
        if HEADER_RE.search(line):
            add("header", n, line)
        m = plat_re.search(line)
        # prefab/scene fileIds are random base64 and match short names by chance
        if m and not ('"fileId"' in line or '"__id__"' in line or '"_id"' in line):
            add("platform", n, line)
        if is_code and HOST_RE.search(line):
            add("host", n, line)
        if is_code and URL_RE.search(line) and "localhost" not in line and "developers.tiktok.com" not in line:
            add("url", n, line)
        if HAN_RE.search(line):
            add("han", n, line)
        if is_code and COMMENT_RE.match(line):
            if VI_DIACRITIC_RE.search(line) or len(VI_ASCII_WORDS.findall(line)) >= 2:
                add("vi-comment", n, line)
    return hits


def main() -> int:
    # Windows consoles default to a legacy code page that cannot print CJK/Vietnamese.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", required=True, help="Cocos project root (contains assets/)")
    ap.add_argument("--keep", action="append", default=[], help="platform name to keep (repeatable), e.g. tiktok")
    ap.add_argument("--json", help="also write the full report as JSON")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    if not (root / "assets").is_dir():
        print(f"not a Cocos project (no assets/): {root}", file=sys.stderr)
        return 2
    keep = {k.lower() for k in args.keep}

    report = {}
    totals: dict[str, int] = {}
    for p in iter_files(root):
        hits = scan_file(p, keep)
        if hits:
            rel = p.relative_to(root).as_posix()
            report[rel] = hits
            for k, v in hits.items():
                totals[k] = totals.get(k, 0) + len(v)

    for rel in sorted(report):
        kinds = ", ".join(f"{k}={len(v)}" for k, v in sorted(report[rel].items()))
        print(f"{rel}  [{kinds}]")
        for k, v in sorted(report[rel].items()):
            for line in v[:4]:
                print(f"    {k:<10} {line}")
            if len(v) > 4:
                print(f"    {k:<10} ... {len(v) - 4} more")
    print("\nTOTAL " + (", ".join(f"{k}={v}" for k, v in sorted(totals.items())) or "clean"))
    if args.json:
        Path(args.json).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
