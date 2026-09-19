"""Build the copy-and-go Claude Code bundle from the Codex bundle.

Single source of truth:

    codex/.codex/agents/*.toml      -> claude/.claude/agents/*.md
    codex/.agents/skills/**         -> claude/.claude/skills/**   (text only)
    codex/.codex/prompts/*.md       -> claude/.claude/commands/*.md

The static files in `claude/` (`.mcp.json`, `.claude/settings.json`, `CLAUDE.md`,
`README.md`) are hand-maintained and never touched by this script.

Run it with the shared uv-provided Python, from the repository root:

    uv run --no-project python tools/build_claude_bundle.py

Add `--check` to fail instead of writing when the bundle is out of date (useful
before committing).
"""

from __future__ import annotations

import argparse
import filecmp
import shutil
import sys
import tomllib
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CODEX_AGENTS = REPO / "codex" / ".codex" / "agents"
CODEX_SKILLS = REPO / "codex" / ".agents" / "skills"
CODEX_PROMPTS = REPO / "codex" / ".codex" / "prompts"
CLAUDE_AGENTS = REPO / "claude" / ".claude" / "agents"
CLAUDE_SKILLS = REPO / "claude" / ".claude" / "skills"
CLAUDE_COMMANDS = REPO / "claude" / ".claude" / "commands"
PREAMBLES = REPO / "tools" / "claude-preambles"

# Codex profile -> (Claude file name, Task-tool allowlist, suggested model).
# `None` tools means "all tools"; `None` model leaves the client default.
PROFILES = {
    "setup_agents.toml": ("setup-agents.md", "Read, Grep, Glob, Bash, WebFetch, Task", None),
    "tech_lead.toml": ("tech-lead.md", "Read, Grep, Glob, Bash, Task", None),
    "unity_developer.toml": ("unity-developer.md", None, None),  # None => all tools
    "cocos_developer.toml": ("cocos-developer.md", None, None),
    "browser_game_fetcher.toml": (
        "browser-game-fetcher.md",
        "Read, Write, Edit, Grep, Glob, Bash",
        "sonnet",
    ),
    "cocos_port_triage.toml": (
        "cocos-port-triage.md",
        "Read, Write, Edit, Grep, Glob, Bash",
        "opus",
    ),
    "cocos_port_class.toml": (
        "cocos-port-class.md",
        "Read, Write, Edit, Grep, Glob, Bash",
        "opus",
    ),
}

# Ordered, purely mechanical rewrites applied to the generated body. Anything
# that needs judgement belongs in tools/claude-preambles/<name>.md instead.
REWRITES: list[tuple[str, str]] = [
    ("<repository-root>/.agents/skills/", "<repository-root>/.claude/skills/"),
    ("`<project-root>/.agents/skills/", "`<project-root>/.claude/skills/"),
    (".agents/skills/dev-unity-mcp/SKILL.md", ".claude/skills/dev-unity-mcp/SKILL.md"),
    ("`.agents/skills/<skill>/SKILL.md`", "`.claude/skills/<skill>/SKILL.md`"),
    ("the copied Codex package", "the copied agent package"),
    ("the portable `codex/` package", "the portable `claude/` package"),
]

EXCLUDED_NAMES = ("__pycache__", ".pytest_cache", ".ruff_cache", ".mypy_cache", ".DS_Store")
EXCLUDED_SUFFIXES = (".unitypackage", ".pyc")
SKILL_EXCLUDES = shutil.ignore_patterns(*EXCLUDED_NAMES, *(f"*{s}" for s in EXCLUDED_SUFFIXES))


def is_excluded(name: str) -> bool:
    return name in EXCLUDED_NAMES or name.endswith(EXCLUDED_SUFFIXES)

ASSET_NOTE = """\
The vendored Unity asset packages (`*.unitypackage`, about 450 MB in total) are
deliberately NOT duplicated into the Claude bundle. They live in exactly one
place:

    .agents/skills/setup-unity-packages/assets/

`setup-unity-packages` resolves that path first and falls back to
`.claude/skills/setup-unity-packages/assets/`. If you copied only the `claude/`
bundle into a project and need the asset-package step, copy
`codex/.agents/skills/setup-unity-packages/assets/` next to it (or copy the
`codex/` bundle as well, which is the normal dual-client setup).
"""


def build_agent(source: Path, target: Path, tools: str | None, model: str | None = None) -> str:
    data = tomllib.loads(source.read_text(encoding="utf-8"))
    body = data["developer_instructions"].strip("\n")
    for old, new in REWRITES:
        body = body.replace(old, new)

    preamble_path = PREAMBLES / target.name
    preamble = preamble_path.read_text(encoding="utf-8").strip("\n")

    frontmatter = [
        "---",
        f"name: {data['name']}",
        f"description: {data['description']}",
    ]
    if tools:
        frontmatter.append(f"tools: {tools}")
    if model:
        frontmatter.append(f"model: {model}")
    frontmatter.append("---")

    generated_note = (
        f"<!-- Generated from codex/.codex/agents/{source.name} by "
        "tools/build_claude_bundle.py. Do not edit by hand. -->"
    )
    return "\n".join(frontmatter) + "\n\n" + generated_note + "\n\n" + preamble + "\n\n" + body + "\n"


# Codex prompts describe the invocation neutrally; Claude Code names the tools.
COMMAND_REWRITES: list[tuple[str, str]] = [
    ("Dùng skill `", 'Dùng Skill tool với `skill: "'),
    ("Dùng agent `", 'Dùng Agent tool với `subagent_type: "'),
]


def build_command(text: str) -> str:
    """Render a Codex prompt as a Claude Code slash command."""
    for old, new in COMMAND_REWRITES:
        index = 0
        while True:
            index = text.find(old, index)
            if index == -1:
                break
            closing = text.find("`", index + len(old))
            if closing == -1:
                break
            name = text[index + len(old) : closing]
            replacement = f'{new}{name}"`'
            text = text[:index] + replacement + text[closing + 1 :]
            index += len(replacement)
    return text


def sync_commands(check: bool) -> list[str]:
    """Mirror Codex prompts into the Claude bundle as project slash commands."""
    problems: list[str] = []
    if not CODEX_PROMPTS.is_dir():
        return problems
    CLAUDE_COMMANDS.mkdir(parents=True, exist_ok=True)
    expected = set()
    for source in sorted(CODEX_PROMPTS.glob("*.md")):
        rendered = build_command(source.read_text(encoding="utf-8"))
        target = CLAUDE_COMMANDS / source.name
        expected.add(target.name)
        current = target.read_text(encoding="utf-8") if target.exists() else None
        if current == rendered:
            continue
        if check:
            problems.append(f"out of date: {target.relative_to(REPO)}")
            continue
        target.write_text(rendered, encoding="utf-8")
        print(f"[commands] wrote {target.relative_to(REPO)}")
    for stale in sorted(CLAUDE_COMMANDS.glob("*.md")):
        if stale.name in expected:
            continue
        if check:
            problems.append(f"stale command: {stale.relative_to(REPO)}")
        else:
            stale.unlink()
            print(f"[commands] removed stale {stale.relative_to(REPO)}")
    return problems


def sync_skills(check: bool) -> list[str]:
    """Mirror the shared skill library, minus the large vendored archives."""
    differences: list[str] = []
    if check:
        if not CLAUDE_SKILLS.is_dir():
            return ["claude/.claude/skills is missing"]
        comparison = filecmp.dircmp(str(CODEX_SKILLS), str(CLAUDE_SKILLS))
        stack = [comparison]
        while stack:
            current = stack.pop()
            for name in current.left_only:
                if is_excluded(name):
                    continue
                differences.append(f"missing in claude bundle: {Path(current.left, name)}")
            for name in current.diff_files:
                if is_excluded(name):
                    continue
                differences.append(f"differs: {Path(current.left, name)}")
            stack.extend(
                subdir for name, subdir in current.subdirs.items() if not is_excluded(name)
            )
        return differences

    if CLAUDE_SKILLS.exists():
        shutil.rmtree(CLAUDE_SKILLS)
    shutil.copytree(CODEX_SKILLS, CLAUDE_SKILLS, ignore=SKILL_EXCLUDES)
    assets = CLAUDE_SKILLS / "setup-unity-packages" / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    (assets / "NOTE_LARGE_ASSETS_NOT_DUPLICATED.md").write_text(ASSET_NOTE, encoding="utf-8")
    return differences


def check_shared_assets() -> list[str]:
    """Assets duplicated across engine skills must stay byte-identical."""
    problems: list[str] = []
    shared = [
        (
            CODEX_SKILLS / "setup-unity-gitignore" / "assets" / "AI.gitignore",
            CODEX_SKILLS / "setup-cocos-gitignore" / "assets" / "AI.gitignore",
        )
    ]
    for left, right in shared:
        if not left.exists() or not right.exists():
            problems.append(f"missing shared asset: {left} / {right}")
        elif left.read_bytes() != right.read_bytes():
            problems.append(
                f"shared asset differs: {left.relative_to(REPO)} vs {right.relative_to(REPO)}"
            )
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="report an out-of-date bundle instead of rewriting it",
    )
    args = parser.parse_args()

    problems: list[str] = []
    CLAUDE_AGENTS.mkdir(parents=True, exist_ok=True)
    for toml_name, (md_name, tools, model) in PROFILES.items():
        source = CODEX_AGENTS / toml_name
        target = CLAUDE_AGENTS / md_name
        rendered = build_agent(source, target, tools, model)
        current = target.read_text(encoding="utf-8") if target.exists() else None
        if current == rendered:
            print(f"[agents] up to date: {target.relative_to(REPO)}")
            continue
        if args.check:
            problems.append(f"out of date: {target.relative_to(REPO)}")
            continue
        target.write_text(rendered, encoding="utf-8")
        print(f"[agents] wrote {target.relative_to(REPO)} ({len(rendered)} chars)")

    problems.extend(check_shared_assets())
    problems.extend(sync_commands(args.check))
    skill_problems = sync_skills(args.check)
    problems.extend(skill_problems)
    if not args.check:
        count = sum(1 for _ in CLAUDE_SKILLS.rglob("*") if _.is_file())
        print(f"[skills] mirrored {count} files into {CLAUDE_SKILLS.relative_to(REPO)}")

    if problems:
        print("\nBundle is out of date:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
