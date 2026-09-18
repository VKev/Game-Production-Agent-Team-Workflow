---
name: dev-unity-state-pattern
description: Design, implement, review, refactor, debug, and test State pattern systems in Unity C#. Use for explicit state objects, finite-state machines, `Enter`/`Tick`/`Exit`, character/enemy/UI/game-flow modes, state-specific transitions, Animator StateMachineBehaviour integration, shared or per-context state assets, and decisions among enum/switch logic, State, Strategy, Animator controllers, hierarchical FSMs, or behavior trees.
---

# Unity State Pattern

Use State when an object’s behavior changes by one active mode and state-specific behavior should evolve independently.

## Compare Before Selecting

State benefit, drawback, prerequisite, rejection condition, and combinations for every relevant candidate. Use any justified combination or none; do not assign ranks.

Compare an enum/switch, State objects, Strategy, Animator state machines, hierarchical FSMs, and behavior trees.

## Model the Machine Explicitly

1. List states, initial state, allowed transitions, guards, triggers, and interruption rules.
2. Define who requests and who authorizes transitions.
3. Define `Enter`, update/tick, and `Exit` ordering.
4. Decide whether state instances are shared/stateless or owned per context.

Benefit: isolate state behavior and extend states without one monolithic switch. Drawbacks: class/asset count, transition explosion, hidden graph, reentrancy, shared-state bugs, and difficult debugging.

Reject object-based State when there are few stable states and a readable switch fully expresses the behavior.

## Unity Guardrails

- Never store one actor’s mutable context in a shared ScriptableObject state asset.
- Separate transition evaluation from applying a transition to avoid reentrant `Enter`/`Exit` chains.
- Queue or reject transition requests made during a transition.
- Call `Exit` and `Enter` exactly once for committed transitions.
- Keep ticking ownership explicit: MonoBehaviour Update, PlayerLoop system, or another scheduler.
- Distinguish gameplay State from Animator presentation state and synchronize intentionally.
- Log current state, previous state, trigger, guard result, and transition time.

Strategy swaps algorithms for the same task; State changes allowable behavior and transitions according to context history.

## Verify

- Test every allowed and forbidden transition.
- Test interruption, self-transition, repeated trigger, and transition during `Enter`/`Exit`.
- Test shared state instances across multiple actors.
- Test disable/destroy/scene unload while a transition is pending.
- Visualize or log the graph and inspect unreachable states.
- Profile transition/tick allocation at expected actor counts.

Read [references/state-guide.md](references/state-guide.md) for state ownership and sources.
