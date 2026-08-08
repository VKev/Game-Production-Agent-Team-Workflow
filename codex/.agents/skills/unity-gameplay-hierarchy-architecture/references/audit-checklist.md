# Gameplay Hierarchy Audit Checklist

## Contents

- Evidence to gather
- Audit passes
- Refactor priorities
- Migration workflow
- Validation checklist
- Recommended report format

## Evidence to gather

Use the available evidence without requiring all of it:

- Hierarchy screenshot or text export.
- Scene list and loading flow.
- Prefab screenshots or YAML snippets.
- Description of managers and persistent objects.
- `DontDestroyOnLoad` usage.
- Runtime Hierarchy during gameplay.
- Profiler markers, frame debugger evidence, or object counts.
- Pool ownership and cleanup behavior.
- Networking model when applicable.
- Team size and common merge-conflict areas.

State which evidence is missing and avoid pretending to have inspected it.

## Audit pass: lifetime

For every root and major system, check:

- Is the lifetime application, session, scene, entity, or transient?
- Does its parent have the same or longer valid lifetime?
- Can it survive a scene change accidentally?
- Can it be destroyed while another service still references it?
- Is a scene-local feature global only for convenience?
- Is session state incorrectly stored as application state?

High-priority warning signs:

- Multiple persistent roots.
- Persistent services created independently in several scenes.
- Scene actors below a `DontDestroyOnLoad` root.
- Global service fields referencing current scene components without cleanup.

## Audit pass: ownership

Check:

- Does each object have one clear owner?
- Does the parent initialize, enable, disable, and clean up the child?
- Are player or enemy parts located with the entity prefab?
- Are runtime objects mixed with authored level content?
- Are systems grouped only by name rather than responsibility?
- Does a root contain objects from unrelated teams or features?

## Audit pass: transform and activation

Check:

- Does each child need to inherit its parent's transform?
- Does a moving parent contain unrelated descendants?
- Are objects compensating for unexpected parent scale or rotation?
- Is a large parent toggled frequently?
- Are there pass-through transforms with no semantic purpose?
- Are imported rigs being altered unnecessarily?

## Audit pass: dependencies

Check:

- Can dependencies be seen in fields, constructors, or initialization methods?
- Does gameplay code routinely call singleton instances or service locator lookups?
- Are scene-wide `Find` calls used as normal wiring?
- Are event publishers and subscribers owned and unsubscribed correctly?
- Does one manager know every major system?
- Are circular dependencies present?
- Are ScriptableObjects carrying uncontrolled mutable runtime state?

## Audit pass: scene loading

Check:

- Is there one clear bootstrap path?
- Is startup order deterministic?
- Are additive scene ownership boundaries documented?
- Are cross-scene references established after load and cleared before unload?
- Is there a clear active-scene policy for newly instantiated objects?
- Are addressable or pooled resources released by the correct owner?
- Can a gameplay scene run independently for testing, or is its dependency setup documented?

## Audit pass: runtime objects and pooling

Check:

- Can developers see projectiles, effects, pickups, and spawned actors in predictable roots?
- Does the number of runtime objects grow without returning to a baseline?
- Are pooled objects reset completely?
- Is the pool lifetime compatible with the prefab assets it retains?
- Are inactive pool objects overwhelming the Hierarchy or editor performance?
- Are transient objects parented under persistent roots accidentally?

## Audit pass: performance claims

Challenge each claim:

- Does a hierarchy change actually alter rendering conditions?
- Is draw-call advice supported by profiler or frame debugger evidence?
- Are static flags, material sharing, instancing, SRP batching, LOD, and culling considered separately?
- Does a frequently moving root have many descendants?
- Are large activation spikes measured?
- Is pooling proposed for measured churn rather than every object?
- Is an update manager proposed only after per-frame callback cost is measured?

## Refactor priorities

Apply changes in this order:

1. Fix incorrect lifetime and accidental persistence.
2. Remove stale cross-scene references and duplicate bootstrap paths.
3. Move entity-owned behavior back to entity prefabs.
4. Separate scene-authored and runtime-spawned objects.
5. Split god managers by responsibility and lifetime.
6. Make dependencies explicit.
7. Simplify transform and activation hierarchies.
8. Improve naming and editor readability.
9. Optimize measured runtime bottlenecks.

This order protects correctness before aesthetics.

## Migration workflow

### Step 1: Snapshot behavior

Record:

- Scene transition sequence.
- Existing persistent objects.
- Object counts in a representative play session.
- Key profiler measurements.
- Automated or manual smoke tests.

### Step 2: Introduce roots without changing behavior

Add meaningful roots such as `SceneContext`, `World`, `Actors`, and `RuntimeObjects`. Reparent only objects whose transform behavior is safe. Preserve world transforms.

### Step 3: Correct lifetimes

Create one bootstrap path. Move application services there. Add a session boundary only when needed. Return scene-local systems to their scenes.

### Step 4: Extract entity behavior

Move player, enemy, NPC, and interactable behavior to self-contained prefabs. Leave orchestration in scene or session coordinators.

### Step 5: Replace hidden lookup

Replace routine searches and global access with serialized references, initialization, registries, runtime sets, or events as appropriate.

### Step 6: Separate runtime objects

Route spawned objects to clear runtime roots and define pool cleanup rules.

### Step 7: Validate transitions

Test:

- New game.
- Reload current scene.
- Move to next scene.
- Return to menu.
- Restart match or run.
- Disconnect and reconnect when networked.
- Enter and exit play mode repeatedly in the editor.

### Step 8: Profile again

Compare object counts, memory, frame time, scene load spikes, transform work, activation spikes, and rendering data. Do not claim performance improvement without evidence.

## Validation checklist

A proposed architecture is ready when:

- Every major root has a stated responsibility and lifetime.
- No scene-owned object is accidentally persistent.
- Every persistent service has one creation path and duplicate policy.
- Entity prefabs own their local behavior and presentation.
- Scene coordinators orchestrate rather than absorb all entity logic.
- Authored content and runtime-spawned objects are distinguishable.
- Cross-scene references have setup and cleanup rules.
- Dependencies are visible enough to test and debug.
- The hierarchy avoids meaningless numeric prefixes and pass-through groups.
- Rendering claims are separated from hierarchy readability claims.
- Migration can be performed incrementally.

## Recommended report format

```text
# Architecture summary

A concise statement of the main issue and design direction.

## Scope and assumptions

State Unity version, scene model, game scale, and missing evidence.

## Findings

For each finding:
- Observation
- Why it is risky
- Severity
- Recommended correction

## Recommended hierarchy

Show application, session, scene, and important prefab trees.

## Placement rules

Explain where new systems and objects should go.

## Why this helps

Explain maintainability, lifecycle safety, teamwork, debugging, and measured performance benefits.

## Migration plan

Provide ordered steps that preserve behavior.

## Validation

Provide play-mode, scene-transition, and profiler checks.
```
