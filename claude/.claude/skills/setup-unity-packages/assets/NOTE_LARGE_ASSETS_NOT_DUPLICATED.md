The vendored Unity asset packages (`*.unitypackage`, about 450 MB in total) are
deliberately NOT duplicated into the Claude bundle. They live in exactly one
place:

    .agents/skills/setup-unity-packages/assets/

`setup-unity-packages` resolves that path first and falls back to
`.claude/skills/setup-unity-packages/assets/`. If you copied only the `claude/`
bundle into a project and need the asset-package step, copy
`codex/.agents/skills/setup-unity-packages/assets/` next to it (or copy the
`codex/` bundle as well, which is the normal dual-client setup).
