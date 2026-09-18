# Scene Management Verification

## Contents

- [Validate authored data](#validate-authored-data)
- [Verify successful transitions](#verify-successful-transitions)
- [Stress lifecycle and concurrency](#stress-lifecycle-and-concurrency)
- [Verify failure and recovery](#verify-failure-and-recovery)
- [Verify player and platform behavior](#verify-player-and-platform-behavior)
- [Profile only after correctness](#profile-only-after-correctness)
- [Report evidence precisely](#report-evidence-precisely)

## Validate authored data

Create Edit Mode validation or an Editor validator for the project's actual group/reference format. Check:

- Null, empty, unsafe, or unresolved references.
- Native scene presence and enabled state in the intended scene list.
- Unity 6 active Build Profile overrides when applicable.
- Addressables key/location resolution under the intended profile.
- Duplicate paths, names, keys, roles, or group IDs.
- Zero or multiple active-scene declarations.
- Exclusive owner conflicts for cameras, AudioListeners, EventSystems, input, lighting, and persistent roots.
- Invalid runtime/Editor assembly references.

Do not mutate Build Settings, Build Profiles, Addressables groups, or scenes merely to make a validation test pass unless those changes are explicitly in scope.

## Verify successful transitions

For every supported path, observe the live hierarchy, active scene, events, and game behavior:

- Cold boot to initial content.
- Direct Editor entry into supported development scenes.
- Menu to gameplay.
- Gameplay to next level.
- Gameplay to results and back.
- Restart current level/session.
- Return to menu.
- Any streamed-cell entry/exit path.

Assert:

- Exactly the intended scene set is loaded.
- Exactly one intended active scene is active.
- Retained scenes were retained by policy.
- Removed scenes completed unload before their handles/registrations were discarded.
- Group readiness occurs after required initialization.
- The loading overlay appears and disappears at the correct boundaries.
- Numeric progress is monotonic and reaches completion only when its defined work completes.
- Started, completed, failed, and canceled events fire once and at the documented phase.

## Stress lifecycle and concurrency

Exercise:

- Double-clicks and rapid repeated requests.
- Same-target requests under the selected join/reject/coalesce policy.
- Different-target requests during each transition phase.
- Disable or destroy the requester during load.
- Scene unload while listeners, tasks, coroutines, or callbacks are active.
- Application exit or Play Mode stop during load.
- Paused `Time.timeScale` when presentation or waits depend on scaled time.
- Domain Reload and Scene Reload enabled and disabled when the team uses configurable Enter Play Mode.
- Ten or more repeated round trips to expose duplicate roots, stale events, retained handles, and memory drift.

After every stress case, verify that a late continuation cannot change the active scene, flow state, UI, or scene registry owned by a newer transition.

## Verify failure and recovery

Where practical, inject or simulate:

- Invalid native scene path or disabled scene entry.
- Missing Addressables key, catalog, bundle, or network connection.
- Load operation failure.
- Deferred activation never released or released late.
- Scene-context initialization exception.
- `SetActiveScene` failure.
- Unload failure or a null unload operation.
- Recovery-scene failure.

Confirm:

- Validation failures occur before destructive mutation.
- Partial loads are unloaded or retained only by explicit recovery policy.
- Partial registrations and event subscriptions are removed.
- Addressables handles have exactly one release path.
- The loading overlay cannot remain permanently stuck without an error/retry path.
- Flow state reports the actual stable state rather than the requested target.
- Gate and temporary resources are released in `finally`.
- One owned root observes each non-cancellation exception.

## Verify player and platform behavior

Build the actual target configuration:

- Use the intended Unity 6 Build Profile or older Build Settings list.
- Build Addressables content in the mode intended for the player.
- Test direct and remote content, offline startup, retry, and cache behavior when relevant.
- Verify case-sensitive scene/address behavior on the target filesystem/provider.
- Test IL2CPP/AOT and WebGL restrictions when they affect the chosen async stack.
- Inspect a development player rather than relying only on Editor Play Mode.

Editor success does not establish that a scene was included in the player, a remote catalog is compatible, or transition memory fits the device.

## Profile only after correctness

When performance matters, measure representative device builds with the Unity Profiler, Memory Profiler, and Addressables diagnostics as applicable. Record:

- Total transition duration and each phase duration.
- Main-thread stalls during scene activation, `Awake`, `OnEnable`, `Start`, and initialization.
- Peak memory for load-before-unload versus unload-before-load.
- Bundle/download size and dependency work.
- `Resources.UnloadUnusedAssets` duration when used.
- Light-probe tetrahedralization cost.
- GC allocations from polling, progress, events, and async wrappers.
- Streaming churn and concurrency.

Do not claim that multiple started operations are parallel or faster without profiler evidence.

## Report evidence precisely

Report:

- Unity and relevant package versions.
- Scene strategy and lifetime roots.
- Transition owner and repeated-request policy.
- Native versus Addressable ownership.
- Build scene-list/profile verified.
- Successful paths tested.
- Failure and repetition paths tested.
- Live hierarchy, active-scene, Console, test, player, and profiler evidence.
- Anything not run or not observable.

Do not equate compilation with runtime transition correctness, Edit Mode validation with player inclusion, or proxy automation with visual loading-screen quality.
