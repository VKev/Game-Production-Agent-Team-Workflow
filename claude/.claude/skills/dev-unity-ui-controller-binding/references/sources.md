# Official Unity Sources

Confirm `ProjectSettings/ProjectVersion.txt` and the installed uGUI package before relying on version-sensitive behavior. These links target Unity 6.3.

## uGUI and screen lifecycle

- [Unity UI package](https://docs.unity3d.com/6000.3/Documentation/Manual/com.unity.ugui.html): uGUI package scope and version information.
- [Button](https://docs.unity3d.com/6000.3/Documentation/Manual/script-Button.html): `Interactable`, transitions, navigation, and `On Click` behavior.
- [GameObject.SetActive](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/GameObject.SetActive.html): activation, component callbacks, and hierarchy effects used by `Show` and `Hide`.
- [Component.GetComponentsInChildren](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Component.GetComponentsInChildren.html): descendant component discovery, including inactive children.

## Dynamic rows and profiling

- [Object.Instantiate](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Object.Instantiate.html): runtime row creation and parenting.
- [Object.Destroy](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Object.Destroy.html): deferred destruction behavior relevant to list rebuilds.
- [UI and UI Details Profiler](https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerUI.html): layout, rendering, batching, and UI performance evidence.
