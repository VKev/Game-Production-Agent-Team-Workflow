#!/usr/bin/env python3
"""Who uses each script: importers, and the scenes/prefabs that attach it as a component.

    python3 script-usage.py --root <project> [--only <substring>]

Before deleting a .ts file you need two answers that grep on the file name cannot give:

  1. which modules import it (static `import ... from './X'`), and
  2. which .scene / .prefab files attach it as a component. Those reference the
     script by its COMPRESSED uuid (the class id: first 5 hex chars + base64 of the
     rest, e.g. dfec1vvxihJSaB6n3hZVJws), never by name. Scripts that add it by
     class name at runtime (addComponent("Game")) are listed too.

A script attached to a scene/prefab must be removed from that node through the
editor (MCP remove_component + save) BEFORE the file is deleted, otherwise the
asset keeps a MissingScript entry.

Also lists scripts nobody imports and nobody attaches (candidates for deletion; a
bundle loads every script in it, so check for import-time side effects first).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
CCCLASS_RE = re.compile(r"""@ccclass\(\s*['"]([^'"]+)['"]""")
IMPORT_RE = re.compile(r"""^\s*import\s+(?:[^'"]*?\s+from\s+)?['"](\.[^'"]+)['"]""", re.M)


def compress_uuid(uuid: str) -> str:
    h = uuid.replace("-", "")
    out = h[:5]
    rest = h[5:]
    for i in range(0, len(rest), 3):
        v = int(rest[i:i + 3], 16)
        out += B64[v >> 6] + B64[v & 63]
    return out


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", required=True)
    ap.add_argument("--only", help="only report scripts whose path contains this substring")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    assets = root / "assets"
    if not assets.is_dir():
        print(f"no assets/ under {root}", file=sys.stderr)
        return 2

    scripts = sorted(p for p in assets.rglob("*.ts") if not p.name.endswith(".d.ts"))
    data_files = list(assets.rglob("*.prefab")) + list(assets.rglob("*.scene"))
    data = {p: p.read_text(encoding="utf-8", errors="replace") for p in data_files}

    importers: dict[Path, list[str]] = {s: [] for s in scripts}
    for s in scripts:
        for m in IMPORT_RE.finditer(s.read_text(encoding="utf-8", errors="replace")):
            target = (s.parent / m.group(1)).resolve()
            for cand in (target.with_suffix(".ts"), target / "index.ts"):
                if cand in importers:
                    importers[cand].append(s.relative_to(assets).as_posix())
                    break

    # Components added by class NAME at runtime: addComponent("Game") / getComponent("Game").
    sources = {s: s.read_text(encoding="utf-8", errors="replace") for s in scripts}
    by_name: dict[Path, list[str]] = {s: [] for s in scripts}
    for s, text in sources.items():
        for m in CCCLASS_RE.finditer(text):
            use = re.compile(r"""(?:add|get)Components?(?:InChildren)?\(\s*['"]""" + re.escape(m.group(1)) + r"""['"]""")
            by_name[s] += [o.relative_to(assets).as_posix() for o, t in sources.items() if o != s and use.search(t)]

    orphans = []
    for s in scripts:
        rel = s.relative_to(assets).as_posix()
        if args.only and args.only not in rel:
            continue
        meta = s.with_name(s.name + ".meta")
        attached = []
        if meta.exists():
            try:
                cid = compress_uuid(json.loads(meta.read_text(encoding="utf-8"))["uuid"])
                attached = sorted(p.relative_to(assets).as_posix() for p, t in data.items() if cid in t)
            except (KeyError, ValueError):
                pass
        imp = sorted(importers[s])
        named = sorted(set(by_name[s]))
        if not imp and not attached and not named:
            orphans.append(rel)
        print(rel)
        print(f"    imported by : {', '.join(imp) or '-'}")
        print(f"    attached in : {', '.join(attached) or '-'}")
        if named:
            print(f"    by name in  : {', '.join(named)}")

    if orphans and not args.only:
        print("\nNot imported and not attached (check import-time side effects before deleting):")
        for o in orphans:
            print(f"    {o}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
