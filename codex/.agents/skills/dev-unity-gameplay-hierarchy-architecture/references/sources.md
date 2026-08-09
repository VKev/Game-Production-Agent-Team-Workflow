# Unity Source Guide

Use current official Unity sources for version-sensitive claims. Prefer the documentation matching the user's exact Unity version and render pipeline. The links below are starting points, not substitutes for current verification.

## Hierarchy and scene management

- Unity Manual: Hierarchy window and parent-child transform behavior
  - https://docs.unity3d.com/Manual/Hierarchy.html
- Unity Scripting API: `Object.DontDestroyOnLoad`
  - https://docs.unity3d.com/ScriptReference/Object.DontDestroyOnLoad.html
- Unity Scripting API: `LoadSceneMode.Additive`
  - https://docs.unity3d.com/ScriptReference/SceneManagement.LoadSceneMode.Additive.html
- Unity Manual: Multi-Scene editing
  - https://docs.unity3d.com/Manual/MultiSceneEditing.html

## Rendering and draw calls

- Unity Manual: Choose a method for reducing draw calls
  - https://docs.unity3d.com/Manual/optimizing-draw-calls-choose-method.html
- Unity Manual: Static batching
  - https://docs.unity3d.com/Manual/static-batching.html
- Unity Manual: GPU instancing
  - https://docs.unity3d.com/Manual/GPUInstancing.html
- Unity Manual: SRP Batcher
  - https://docs.unity3d.com/Manual/SRPBatcher.html

Verify pipeline support and limitations before making recommendations.

## Runtime performance

- Unity Manual: Optimization of events per frame
  - https://docs.unity3d.com/Manual/events-per-frame-optimization.html
- Unity Learn: Object pooling
  - https://learn.unity.com/tutorial/use-object-pooling-to-boost-performance-of-c-scripts-in-unity
- Unity Scripting API: `UnityEngine.Pool.ObjectPool<T>`
  - https://docs.unity3d.com/ScriptReference/Pool.ObjectPool_1.html

## Architecture and teamwork

- Unity technical article: Architect game code with ScriptableObjects
  - https://unity.com/how-to/architect-game-code-scriptable-objects
- Unity technical article: Author scenes and prefabs for collaborative workflows
  - https://unity.com/how-to/organizing-your-project

## Source-use rules

- Cite official Unity documentation for behavior that may vary by version.
- Cite render-pipeline documentation for SRP Batcher, instancing, and batching claims.
- Treat community posts as implementation examples, not authoritative guarantees.
- State when a recommendation is an architectural judgment rather than a Unity engine requirement.
- Do not repeat an exact performance number from a talk or case study unless the hardware, Unity version, project context, and measurement method are available.
