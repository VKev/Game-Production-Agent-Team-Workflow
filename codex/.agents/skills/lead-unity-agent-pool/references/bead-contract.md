# Bead Contract

Use the smallest self-contained contract that lets a fresh worker act without hidden chat context.

Before creating durable Beads, present the proposed graph as a draft plan and obtain explicit user approval. Provisional entries should show their outcome, dependency, worker profile, ownership, parallel wave, acceptance, and verification so the user can verify the split before execution.

## Required fields

```markdown
## Routing

worker_profile: unity-developer
work_type: implementation
priority: critical-path | high | normal | low

## Outcome

Describe the observable result, not the implementation steps.

## Context

List relevant parent Beads, GDD sections, known symbols, existing patterns, prior decisions, and the project/skill evidence used to establish technical constraints.

## Owned scope

List exact files, folders, scenes, prefabs, assets, or configuration surfaces owned by this Bead.

## Resource locks

List shared assets or Editor facilities that require exclusive access.

## Dependencies and contracts

List predecessor Beads and stable inputs/outputs consumed from them.

## Hard constraints

Record compatibility, architecture, serialization, lifecycle, package-version, and user constraints that must not be inferred away.

## Acceptance criteria

Use observable, pass/fail statements.

## Verification

Name the compilation, tests, Editor inspection, Console audit, screenshots, or human QA required.

## Out of scope

Prevent attractive but unrelated expansion.

## Escalation

State when the worker must stop and return to TechLead.
```

## Decomposition rules

- A Bead should produce one coherent result with one ownership boundary.
- Split work when components can be implemented independently behind a stable contract.
- Keep work together when it must edit the same scene, prefab, serialized asset, package graph, assembly definition, or unstable interface.
- Create a planning or discovery Bead when the implementation boundary cannot yet be stated safely.
- Do not make every technical choice a prerequisite. Record only decisions that constrain interoperability, compatibility, safety, or acceptance.
- Do not mark work parallel merely because it has no declared dependency; verify resource ownership too.

## State ownership

- TechLead owns task creation, dependencies, assignment, priority changes, and closure.
- The assigned worker owns implementation and its evidence report.
- Blockers must name the missing decision, resource, person, or prerequisite.
- A completed worker report is not enough to close the Bead until the TechLead checks the result against acceptance criteria.
