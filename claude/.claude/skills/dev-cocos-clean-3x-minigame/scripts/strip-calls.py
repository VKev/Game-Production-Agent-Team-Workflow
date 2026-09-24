#!/usr/bin/env python3
"""Remove whole calls (analytics, banners, recorders...) from minified-style game code.

    python3 strip-calls.py --pattern 'report\\.reportTree\\(' [--pattern ...] FILE... [--write]

Ported / recovered game code chains statements with the comma operator:

    0 == e ? (report.reportTree("reward_btn", {id: "009"}), t.grant()) : ...
    }).start(), bms.checkKey("isbanner") && platform.showBanner(), sound.play(x);

Deleting such a call by hand or with a line-based sed breaks the expression. This
script finds each match, walks to its MATCHING close paren (skipping strings), and
removes the call together with exactly one neighbouring comma:

    X, CALL, Y   -> X, Y        CALL, Y  -> Y        X, CALL  -> X
    CALL;        -> the whole statement line is removed

Each pattern must be a regex that ends at the call's opening "(" (include any
`cond && ` prefix in the pattern so the guard goes too). A match in any other shape
aborts with the surrounding text instead of guessing.

Dry run by default: prints what would change. Add --write to rewrite files (line endings kept
as found). Always review `git diff` afterwards and remove now-unused imports.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


def match_paren(s: str, i: int) -> int:
    depth = 0
    j = i
    quote = None
    while j < len(s):
        c = s[j]
        if quote:
            if c == "\\":
                j += 2
                continue
            if c == quote:
                quote = None
        elif c in "\"'`":
            quote = c
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return j + 1
        j += 1
    raise ValueError("unbalanced parentheses")


def strip(s: str, patterns: list[re.Pattern], fname: str) -> tuple[str, int]:
    n = 0
    while True:
        hit = None
        for p in patterns:
            m = p.search(s)
            if m and (hit is None or m.start() < hit[0]):
                hit = (m.start(), m.end())
        if not hit:
            return s, n
        start = hit[0]
        if s[hit[1] - 1] != "(":
            raise SystemExit(f"{fname}: pattern must end at the call's '(' — got {s[start:hit[1]]!r}")
        end = match_paren(s, hit[1] - 1)
        before, after = s[:start], s[end:]
        if after.startswith(", "):
            s = before + after[2:]
        elif re.search(r",\s*$", before):
            s = re.sub(r",\s*$", "", before) + after
        elif after.startswith(";"):
            ls = before.rfind("\n") + 1
            le = s.find("\n", end)
            s = s[:ls] + s[le + 1:]
        else:
            raise SystemExit(f"{fname}: unhandled shape, fix by hand:\n    ...{s[max(0, start - 80):end + 40]}...")
        n += 1


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pattern", action="append", required=True, help="regex ending at the call's '('")
    ap.add_argument("--write", action="store_true", help="rewrite files (default: dry run)")
    ap.add_argument("files", nargs="+")
    args = ap.parse_args()

    patterns = [re.compile(p) for p in args.pattern]
    total = 0
    for f in args.files:
        path = Path(f)
        src = path.read_bytes().decode("utf-8")  # keep CRLF/LF exactly as found
        out, n = strip(src, patterns, f)
        if not n:
            continue
        total += n
        print(f"{f}: {n} call(s) removed")
        if args.write:
            path.write_bytes(out.encode("utf-8"))
    print(f"{'removed' if args.write else 'would remove'} {total} call(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
