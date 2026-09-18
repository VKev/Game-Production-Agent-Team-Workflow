---
name: setup-unity-project-preflight
description: Inspect and classify the exact Unity 6000.3.21f1 repository, installed Editor, Git/index state, resumable setup checkpoint, live Editor identity, and official MCP discovery without mutation or UI automation. Use at the start of setup-agents and every resume to select Phase A, the Unity-open checkpoint, the Codex-restart checkpoint, Phase B, or completed verification without repeating finished work.
---

# Unity setup preflight

Run one deterministic read-only inspection before loading or mutating any other setup component.

## Workflow

1. Resolve the intended project root. Let the inspector use `UNITY_6000_3_21F1_EDITOR`, the registered `D:\Apps\Unity\6000.3.21f1\Editor\Unity.exe`, or Unity Hub's exact-version path. Pass `-UnityEditorPath` only to disambiguate multiple exact installations. Do not probe an older Editor first and do not search process command lines.
2. Run:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/inspect_setup_state.ps1 `
     -ProjectRoot <project-root>
   ```

3. Parse the JSON. `clients` reports which agent bundles this repository carries (`codex` from `.codex/agents/setup_agents.toml`, `claude` from `.claude/agents/setup-agents.md`); every setup skill uses it as the client scope and configures each detected client.
   A nonzero exit means the inspector itself could not establish valid input. A zero-exit JSON result with `recommended_phase=ambiguous` is an expected classified blocker: report `blockers` and stop mutation without calling it a script failure.
4. Route exactly once:
   - `phase-a`: run editor-closed setup. `parallel_lanes` lists the only safe initial lanes.
   - `await-unity-open`: preserve Phase A and ask the user to open the exact project.
   - `pending-codex-restart`: preserve Unity and Phase A/B state; ask for the one client restart. The phase name is historical: it means "restart the MCP client you are configuring", so a Claude-only run asks for a Claude Code restart and a dual-client run asks for both.
   - `phase-b`: resume from the first pending live operation.
   - `verify-complete`: verify the completed checkpoint without replaying setup.
5. Save the report or its SHA-256 in the setup checkpoint. Re-run it after a restart, domain-reload disconnect, or user `continue setup`; do not reconstruct state with many ad-hoc commands.

## Safety and speed contract

- The script is read-only. It never starts or closes Unity, deletes a lock, changes Git, edits TOML, or reads process command lines.
- Treat a target lock without exact `EditorInstance.json` process/path/version evidence as ambiguous.
- Treat an Editor path/version mismatch, nested Git root, dirty staged index, malformed checkpoint, or stale checkpoint identity as ambiguous.
- Reuse only a checkpoint whose project, Unity version, and saved manifest hash still match.
- Start parallel Phase-A lanes only when `parallel_safe=true`. Each lane owns a unique `.agent-temp/setup-reports/<lane>.json`; serialize shared configuration and manifest writes.
- Never use Computer Use, Windows UI automation, mouse/keyboard simulation, or screen-coordinate clicking. Use scripts and supported CLI/MCP operations. If Unity requires approval, Enable All, or another UI-only action, ask the user to perform the exact action and resume from the checkpoint.

## Boundaries

- Support only Unity `6000.3.21f1`.
- Do not treat a missing Git repository as an error; report it as setup work for Phase A.
- Do not expose other projects, process arguments, credentials, or Codex configuration values.
- Do not infer live MCP readiness from a discovery JSON alone; live client calls and catalog equality remain Phase-B gates.
