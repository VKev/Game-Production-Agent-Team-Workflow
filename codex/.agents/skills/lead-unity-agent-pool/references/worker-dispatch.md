# Worker Dispatch and Reuse

## Pool record

Track at least:

```text
worker_id | profile | status | bead_id | owned_resources | reuse_health
```

Use `idle`, `running`, and `unhealthy` as pool states. Bead state remains authoritative for durable recovery.

## New worker brief

Use a self-contained brief similar to:

```markdown
Act as the worker for Bead <id>.

Before acting:

1. Resolve the repository root.
2. Read `.codex/agents/<worker-profile>.toml` completely and follow it.
3. Read the project instructions, the assigned Bead, and only the skills required by that profile and task.
4. Work only inside the Bead's owned scope and resource locks.
5. Do not create, assign, close, or reprioritize Beads.
6. Do not spawn additional agents.
7. Do not stage, commit, push, install, or reconfigure anything unless the Bead and selected profile explicitly authorize it.

Return a worker result containing outcome, changed paths, verification evidence, blockers, durable decisions to record, and recommended Bead state.
```

Provide the exact Bead id and any runtime fact the worker cannot safely discover. Do not paste the entire parent conversation.

## Reuse brief

Use `followup_task` on an idle compatible worker:

```markdown
The previous assignment is closed. Start a new, separate assignment for Bead <id>.

Drop the prior file scope and do not continue unfinished ideas from it. Read the new Bead and re-evaluate the required skills. Follow `.codex/agents/<worker-profile>.toml`, do not spawn agents, and return the standard worker result.
```

Reuse only after the previous Bead is closed or precisely blocked and the worker has returned control.

## Result contract

Require:

```markdown
## Outcome

## Changed paths

## Acceptance evidence

## Verification performed

## Verification pending

## Blockers or risks

## Durable decisions

## Recommended Bead state
```

Do not accept “done” without path and evidence details. A worker must label unobserved Unity, test, build, visual, or human QA state as pending.

## Retirement rules

Replace rather than reuse a worker when:

- It has unresolved mutations or an ambiguous prior scope.
- It repeatedly failed the same instruction or tool boundary.
- Its context is saturated enough to threaten task separation.
- The next assignment requires an independent review of that worker's output.
- Its profile differs materially from the next assignment.
