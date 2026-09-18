# Primary Sources and Research Summary

This skill synthesizes the following primary sources. Treat the project's Unity version and installed packages as the final compatibility authority.

## Contents

- [Unity architecture and separation](#unity-architecture-and-separation)
- [Unity design patterns](#unity-design-patterns)
- [Modules and testing](#modules-and-testing)
- [C# language boundaries](#c-language-boundaries)
- [Event-bus runtime and discovery safeguards](#event-bus-runtime-and-discovery-safeguards)
- [Video-derived event-bus case study](#video-derived-event-bus-case-study)
- [Synthesis notes](#synthesis-notes)
- [Folder-structure synthesis](#folder-structure-synthesis)

## Unity architecture and separation

### How to architect code as your project scales

URL: https://unity.com/how-to/how-architect-code-your-project-scales

Use for:

- Splitting large MonoBehaviours by responsibility.
- Moving suitable logic into regular C# classes.
- Keeping engine callbacks and GameObject lifetime in MonoBehaviours.
- Using interfaces to expose narrow capabilities.
- Separating logic from presentation.
- Explicit ownership, scene loading, shutdown, and testing.

### Architect your code for efficient changes and debugging with ScriptableObjects

URL: https://unity.com/how-to/architect-game-code-scriptable-objects

Use for:

- Modular, component-based, data-driven design.
- Shared designer-authored data.
- ScriptableObject events and runtime sets as optional architectures.
- Debuggability and Inspector-visible state.

### Unity 6.3 ScriptableObject API

URL: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/ScriptableObject.html

Use for:

- Confirming ScriptableObjects live independently of GameObjects.
- Centralizing data accessible from scenes/assets.
- Asset creation and serialization behavior.

## Unity design patterns

### Unity Design Patterns course

URL: https://learn.unity.com/course/design-patterns

Use for:

- Observer.
- State.
- Object Pool.
- MVC/MVP.
- Factory.
- Command.
- The principle that patterns are selectable tools rather than copy-paste solutions.

### Observer pattern

URL: https://learn.unity.com/learn/tutorial/65de086fedbc2a06ac2aca58

Use for one-to-many notification and loose coupling, while retaining explicit subscription lifetimes.

### State pattern

URL: https://learn.unity.com/course/design-patterns/tutorial/develop-a-modular-flexible-codebase-with-the-state-programming-pattern

Use for choosing between a simple FSM and state objects, encapsulating state behavior, and recognizing when the added structure is overkill.

### MVC and MVP

URL: https://learn.unity.com/tutorial/65e0cfacedbc2a2351773054

Use for separating nontrivial Unity UI presentation from state and coordination logic, while recognizing boilerplate costs.

### Command pattern

URL: https://learn.unity.com/course/design-patterns/tutorial/use-the-command-pattern-for-flexible-and-extensible-game-systems

Use for delayed, queued, planned, replayable, undoable, or redoable actions.

### Object pooling

URL: https://learn.unity.com/learn/tutorial/65df850fedbc2a082fb11029

Use only for architecture-level awareness; delegate implementation details to `dev-unity-object-pooling`.

## Modules and testing

### Unity 6.3 Assembly Definitions

URL: https://docs.unity3d.com/6000.3/Documentation/Manual/ScriptCompilationAssemblyDefinitionFiles.html

Use for:

- Organizing scripts into assemblies.
- Explicit assembly dependency references.
- Runtime/Editor/test boundaries.
- Compile-time modularity.

### Unity 6.3 Test Framework

URL: https://docs.unity3d.com/6000.3/Documentation/Manual/com.unity.test-framework.html

Use for Edit Mode and Play Mode testing in Unity 6.3.

## C# language boundaries

### C# interfaces

URL: https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces

Use for contracts across implementations and narrow capability boundaries. Do not infer that every dependency requires an interface.

### C# events overview

URL: https://learn.microsoft.com/en-us/dotnet/csharp/events-overview

### C# events programming guide

URL: https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/events/

Use for publisher/subscriber semantics, multiple listeners, and event-driven communication. Retain explicit lifecycle management in Unity.

## Event-bus runtime and discovery safeguards

### ScriptableObject event channels

URL: https://unity.com/how-to/scriptableobjects-event-channels-game-code

Use for comparing Inspector-visible event-channel assets with static C# events and code-owned buses. Treat the pattern as optional and keep asset lifetime, reset, and debugging behavior explicit.

### Domain Reload

URL: https://docs.unity3d.com/Manual/domain-reloading.html

Use for static-field and static-event reset requirements when Domain Reload is disabled.

### Managed code stripping

URL: https://docs.unity3d.com/Manual/ManagedCodeStripping.html

Use for reflection-only event types and methods, `Preserve`, and `link.xml` decisions. Verify the target scripting backend and stripping level.

### Runtime initialization

URL: https://docs.unity3d.com/ScriptReference/RuntimeInitializeOnLoadMethodAttribute.html

Use for startup phase ordering, nondeterministic ordering within one phase, and `AlwaysLinkAssembly` guidance for package or precompiled assemblies.

### Assembly definitions

URL: https://docs.unity3d.com/Manual/assembly-definitions-intro.html

Use to avoid discovery code that recognizes only predefined `Assembly-CSharp` assemblies.

### Assembly.GetTypes

URL: https://learn.microsoft.com/en-us/dotnet/api/system.reflection.assembly.gettypes

Use for `ReflectionTypeLoadException`, partial type results, and loader-exception handling.

### HashSet enumeration

URL: https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.hashset-1.enumerator.system-collections-ienumerator-reset

Use for the rule that adding or removing elements invalidates an active enumerator.

### C# structs and boxing

URLs:

- https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/structs
- https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/conversions

Use to reject the claim that struct event payloads are universally stack allocated or allocation free. Boxing to `object` or an implemented interface allocates.

## Video-derived event-bus case study

- Video, “Learn to Build an Advanced Event Bus | Unity Architecture”: https://www.youtube.com/watch?v=4_DTAnigmaQ
- Upload-era source revision: https://github.com/adammyhre/Unity-Event-Bus/commit/c7d2748ea6a2e18c114f86aa18ccba4ab8d046ff
- Later mutation-safety snapshot fix: https://github.com/adammyhre/Unity-Event-Bus/commit/024ff8429b128788be50beee2b07c85caab52748

Use the tutorial as a compact case study for typed generic buses, binding identity, lifecycle registration, and Domain Reload cleanup. The later creator fix confirms that live-collection mutation during dispatch was a real defect. Retain the broader safeguards in `event-bus-and-message-routing.md` rather than copying the tutorial implementation verbatim.

## Synthesis notes

The sources consistently support these conclusions:

- Separate responsibilities as projects grow, but do not add structure before it earns its cost.
- Keep Unity engine integration at a clear boundary and extract plain C# logic when it improves testability or reuse.
- Use ScriptableObjects primarily for shared project data and intentional asset-based architecture, not as a universal runtime-state solution.
- Use design patterns as problem-specific tools.
- Make module dependencies, ownership, lifecycle, testing, and debugging explicit.
- Verify version-sensitive examples against the actual project because several Unity Learn pattern pages target newer Unity versions than Unity 6.3.

## Folder-structure synthesis

The layouts in `folder-structures.md` are practical syntheses of the ownership, modularity, ScriptableObject, assembly-definition, Editor/runtime, and testing boundaries described by the sources above. They are not official mandatory Unity folder templates. Preserve the project's established convention and create only the boundaries the current feature needs.
