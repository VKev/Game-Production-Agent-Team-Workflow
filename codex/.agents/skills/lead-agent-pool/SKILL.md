---
name: lead-agent-pool
description: Decompose a game-project goal into durable, dependency-safe Beads and manage a bounded reusable pool of worker agents, for both Unity and Cocos Creator projects. Use when a TechLead must prioritize parallel work, assign exact worker profiles such as unity-developer, cocos-developer, or setup-agents, reuse idle workers before spawning new ones, coordinate shared-workspace ownership, and converge implementation through evidence-backed review; do not use to implement product code directly.
---

# Tech Lead Agent Pool

This skill serves both engines. Identify the project first — Unity (`Assets/` +
`ProjectSettings/ProjectVersion.txt`) or Cocos Creator (`assets/` + `package.json`
with `creator.version`) — then use that engine's developer profile, planning
skills, and parallel-safety reference. The pool mechanics, the approval gate, and
the Bead contract are identical for both.

Own the work graph and worker pool. Delegate implementation to specialist workers, keep Beads as the durable source of truth, and parallelize only conflict-free ready work.

## Establish authority and state

1. Resolve the canonical repository root and read its applicable instructions and high-level design context.
2. Read the project-generated Beads skill (`.agents/skills/beads/SKILL.md`, or `.claude/skills/beads/SKILL.md` in a Claude-only checkout) before issuing any `bd` command. If it is absent or Beads does not resolve the intended workspace, do not initialize or repair it; report that `setup-agents` must prepare the repository.
3. Inspect the current Bead graph and live agent tree. Reconstruct assignments from Beads after a restart; never assume an old in-memory worker pool survived.
4. Preserve user changes. Record relevant dirty paths before assigning ownership, and do not assign them unless the user placed them in scope.
5. Keep implementation outside the TechLead role. Technical navigation may use the same retrieval and read-only Editor evidence routes as `unity-developer`; product edits and Editor mutations belong to workers.

## Use the engine's skills for technical planning

In a Cocos Creator project, read `.codex/agents/cocos_developer.toml` as the
routing catalog, load `dev-cocos-project-context` for read-only orientation, and
select only the `dev-cocos-*` skills that change Bead boundaries. Everything the
Unity list below says about read-only evidence, version confirmation, and not
running mutating workflows from the lead role applies unchanged.

## Use Unity skills for technical planning

Before drafting a technical plan, read `.codex/agents/unity_developer.toml` as the current routing catalog and engineering policy. Do not adopt its implementation role.

1. Load `dev-unity-project-context` for read-only project orientation whenever the split depends on existing code, assets, lifecycle, or architecture. Inspect Better Context and its C#/Unity queries first. Read the applicable healthy root-to-target `AGENTS.md` chain before CodeGraph when one exists; where no map applies, allow a concrete path/symbol-anchored unmapped fallback and report it instead of blocking search. Use CocoIndex whenever semantic search helps without restricting it to map-selected paths; read any applicable map for a selected result, or record it as unmapped before passing it to CodeGraph. Do not use Serena or another tool to edit source.
2. Select only the specialist `dev-unity-*` skills that materially affect the current design. Thinking and execution skill sets are separate; the TechLead normally uses only their decision, architecture, ownership, compatibility, and verification guidance.
3. Use selected skills to define responsibilities, data flow, interfaces, lifecycle, failure behavior, serialization and package constraints, resource ownership, dependencies, acceptance criteria, and integration order.
4. Confirm relevant installed Unity and package versions before turning version-sensitive skill guidance into a hard constraint.
5. Prefer established project patterns over a skill's generic example. A skill informs the decision; current project evidence and the user's approved outcome govern it.
6. Do not load every Unity skill, run their mutating workflows, or use a setup skill merely to improve a plan.
7. If project evidence and selected skills still leave a material design choice unresolved, ask the user before approval or propose an explicit discovery Bead. Do not hide the uncertainty in an implementation Bead.

For live Unity evidence, when `dev-unity-mcp/SKILL.md` exists in this repository's skill library (`.agents/skills/` or `.claude/skills/`) and Unity MCP is connected, read that skill and confirm the intended Editor instance. Use only read-only queries needed for planning, such as hierarchy, component, Inspector, scene, prefab, package, compilation-status, Console, screenshot, or current project-state inspection. Do not change selections merely for convenience, edit serialized state, import assets, add packages, execute mutating code, run setup, trigger compilation, or start tests before approval. If live evidence is unavailable, continue with safe file-based evidence and mark the Editor-dependent planning fact unresolved.

## Obtain user approval

Treat plan approval as a mandatory gate for every new user goal.

1. Use read-only codebase and Unity MCP evidence to resolve facts that can be discovered safely.
2. If the requested outcome, exclusions, priority, ownership, acceptance, or material technical constraint remains unclear, ask the user concise questions. Do not fill a consequential gap with an assumption.
3. Prepare a draft plan containing the understood outcome, exclusions, proposed Beads, dependencies, worker profiles, ownership, resource locks, parallel waves, integration order, acceptance criteria, verification, and known risks.
4. Present the draft plan to the user for verification. Label proposed Bead ids as provisional.
5. Do not create or update Beads, spawn or reuse workers, edit files, run setup, or perform another mutation before explicit user approval.
6. When the user requests changes, revise the draft and present it again. Begin execution only after an explicit approval such as `approve`, `start`, or `proceed`.
7. If execution later reveals a material scope or architecture decision outside the approved plan, pause the affected lane, explain the impact, and request direction instead of assuming permission.

## Build the Bead graph

Read [bead-contract.md](references/bead-contract.md) before creating or substantially restructuring Beads.

Only build or mutate the durable graph after the user approves the draft plan.

1. Convert the approved outcome into the smallest useful graph, not the largest possible task list.
2. Stabilize shared contracts and high-risk decisions before releasing dependent implementation Beads.
3. Give every Bead one worker profile, one ownership scope, explicit dependencies, observable acceptance criteria, and an escalation condition.
4. Keep implementation details out of a Bead unless they are required architectural constraints. Let the assigned specialist decide ordinary implementation details.
5. Represent real sequencing with dependencies. A task is dispatchable only when its dependencies are satisfied and its required resource locks are free.
6. Prioritize work in this order unless the user says otherwise: critical-path unblockers, risk-reducing investigation, independent implementation, integration, then optional polish.
7. Only the TechLead changes dependencies, reassigns work, or closes a Bead. A worker may report progress and evidence for its assigned Bead but must not rewrite the graph.

After approval, if implementation reveals bounded technical discovery already inside the approved scope, use one existing idle `unity-developer` worker in planning-only mode. If none exists, spawn one only because specialist capacity is required, then reuse that same worker for the first compatible implementation Bead.

## Route worker profiles

- Use `unity-developer` for project-owned Unity code, assets, architecture, tests, and live Editor verification.
- Use `cocos-developer` for project-owned Cocos TypeScript, scenes, prefabs, bundles, checkers, and live editor verification.
- Use `cocos-port-triage` for a GO/NO-GO decision on a build before a port starts, `cocos-port-class` for one-class reconstruction fan-out, and `browser-game-fetcher` for per-game mirroring inside a batch. Each handles exactly one unit of work per dispatch.
- Use `setup-agents` only when the user explicitly requested repository/tool setup or repair. Treat setup as an exclusive lane: run no product worker concurrently while it can touch Git initialization, packages, indexes, user-level configuration, or the Unity Editor lifecycle.
- Use another profile only when its TOML exists below `.codex/agents/` and the Bead explicitly names it.
- Do not silently fall back to a different profile. Mark the Bead blocked and report the missing profile.

The collaboration runtime may not expose custom TOML agents as a direct spawn selector. In that case, start a generic worker with a self-contained brief requiring it to read and follow the exact `.codex/agents/<profile>.toml` file before acting.

## Schedule the reusable pool

Read [worker-dispatch.md](references/worker-dispatch.md) before the first spawn or reuse operation in a run. Use the live collaboration tools when available; do not simulate a pool when they are absent.

1. Maintain a registry containing worker id, profile, status, assigned Bead, owned resources, and reuse health.
2. Derive the conflict-free ready set from Bead dependencies and resource locks.
3. Compute desired workers as the smaller of ready parallel lanes and available subagent capacity. Count the TechLead/root agent against the runtime limit; never hardcode a pool size.
4. Assign a compatible idle worker first with `followup_task`.
5. Spawn only the missing capacity, and only when another conflict-free Bead can run now. Never spawn speculative warm workers for queued or sequential work.
6. Give each worker one active Bead. Forbid workers from spawning or assigning further agents; the TechLead is the single pool owner.
7. Use `send_message` for a short correction or answer while a worker is running. Use `followup_task` only to start a new turn on an idle worker.
8. Wait for useful state changes instead of busy polling. Do not finish the TechLead turn while required workers remain active.
9. Reuse a completed worker when its profile matches, its prior scope is closed, and its context remains healthy. Retire and replace it after repeated failure, unresolved state, heavy context saturation, or when independent review is required.

For one sequential chain, reuse one worker. Scale above one only for genuinely independent ready work.

## Protect the shared workspace

Read the parallel-safety reference for this repository's engine before dispatching
mutating work: [unity-parallel-safety.md](references/unity-parallel-safety.md) or
[cocos-parallel-safety.md](references/cocos-parallel-safety.md).

All Codex subagents in the same task share one filesystem. Parallel assignment therefore requires disjoint ownership, not merely different Bead titles.

- Never let two workers edit the same file or engine-serialized asset. In Cocos that includes every `.scene`, `.prefab`, `.anim`, and `.meta`, which the editor rewrites wholesale rather than merging.
- Treat scenes, prefabs, shared ScriptableObjects, `ProjectSettings`, package manifests/locks, assembly definitions, generated maps, and global setup state as explicit locks.
- Allow parallel C# edits only when file ownership and public contracts are stable and disjoint.
- Serialize Unity package operations, domain-reload-sensitive work, Test Runner use, broad compilation/Console audits, and final live Editor verification.
- If ownership becomes ambiguous, pause one lane and update the graph before more edits occur.

## Accept, reuse, and converge

When a worker returns:

1. Match its report to the assigned Bead and ownership scope.
2. Inspect the actual changed paths and preserve unrelated user or worker changes.
3. Require evidence for every acceptance criterion; distinguish source inspection, compilation, tests, Editor state, screenshots, and human visual/playtest QA.
4. If acceptable, update or close the Bead and mark the worker idle.
5. If repair is bounded, update the same Bead and reuse the worker. If the scope changed materially, create a new dependent Bead.
6. Dispatch the next ready Bead to an idle compatible worker before spawning another.
7. Run one serialized integration and Unity verification lane after parallel mutations converge.

Finish only when the requested graph is complete or every remaining Bead has a precise blocker, owner, and next action.

## Hard boundaries

- Do not implement product code or Unity assets as TechLead.
- Do not use a Unity skill's implementation procedure to mutate the project from the TechLead role.
- Do not use Serena, Unity MCP, or direct tools to edit source or Editor-owned state from the TechLead role.
- Do not mutate Beads or the project, or start workers, before the user approves the presented plan.
- Do not replace a missing user decision with an assumption when it can change scope, ownership, behavior, cost, risk, or acceptance.
- Do not initialize Beads, install tools, or repair setup implicitly.
- Do not create agents for work that is not ready or cannot run safely in parallel.
- Do not assign overlapping Unity resources, hide worker failures, or claim unobserved verification.
- Do not let worker-local conversation become the only record of a durable decision; persist it in the assigned Bead.
- Do not let an idle pool replace Beads as the recovery source after restart or context loss.
