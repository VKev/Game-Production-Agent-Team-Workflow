# Primary Sources and Research Summary

This skill synthesizes the following primary sources. Treat the project's Unity version and installed packages as the final compatibility authority.

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

### Unity 2022.3 ScriptableObject API

URL: https://docs.unity3d.com/2022.3/Documentation/ScriptReference/ScriptableObject.html

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

Use only for architecture-level awareness; delegate implementation details to `unity-object-pooling`.

## Modules and testing

### Unity 2022.3 Assembly Definitions

URL: https://docs.unity3d.com/2022.3/Documentation/Manual/ScriptCompilationAssemblyDefinitionFiles.html

Use for:

- Organizing scripts into assemblies.
- Explicit assembly dependency references.
- Runtime/Editor/test boundaries.
- Compile-time modularity.

### Unity 2022.3 Test Framework

URL: https://docs.unity3d.com/2022.3/Documentation/Manual/com.unity.test-framework.html

Use for Edit Mode and Play Mode testing in Unity 2022.3.

## C# language boundaries

### C# interfaces

URL: https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces

Use for contracts across implementations and narrow capability boundaries. Do not infer that every dependency requires an interface.

### C# events overview

URL: https://learn.microsoft.com/en-us/dotnet/csharp/events-overview

### C# events programming guide

URL: https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/events/

Use for publisher/subscriber semantics, multiple listeners, and event-driven communication. Retain explicit lifecycle management in Unity.

## Synthesis notes

The sources consistently support these conclusions:

- Separate responsibilities as projects grow, but do not add structure before it earns its cost.
- Keep Unity engine integration at a clear boundary and extract plain C# logic when it improves testability or reuse.
- Use ScriptableObjects primarily for shared project data and intentional asset-based architecture, not as a universal runtime-state solution.
- Use design patterns as problem-specific tools.
- Make module dependencies, ownership, lifecycle, testing, and debugging explicit.
- Verify version-sensitive examples against the actual project because several Unity Learn pattern pages target newer Unity versions than Unity 2022.3.

## Folder-structure synthesis

The layouts in `folder-structures.md` are practical syntheses of the ownership, modularity, ScriptableObject, assembly-definition, Editor/runtime, and testing boundaries described by the sources above. They are not official mandatory Unity folder templates. Preserve the project's established convention and create only the boundaries the current feature needs.
