# Sources

- [Official VContainer repository](https://github.com/hadashiA/VContainer): package source, releases, installation options, examples, and current implementation.
- [VContainer Hello World](https://vcontainer.hadashikick.jp/getting-started/hello-world): `LifetimeScope` as composition root and the basic registration/resolution model.
- [Plain C# entry points](https://vcontainer.hadashikick.jp/integrations/entrypoint): entry-point registration, PlayerLoop integration, supported lifecycle interfaces, disposal, and exception handling.
- [Lifetime overview](https://vcontainer.hadashikick.jp/scoping/lifetime-overview): `Singleton`, `Scoped`, and `Transient` behavior, parent-child lookup, scope disposal, and the `MonoBehaviour` destruction caveat.
- [Generate child scope via scene or prefab](https://vcontainer.hadashikick.jp/scoping/generate-child-via-scene): parenting additive-scene scopes and supplying additional registrations during scene load.
- [Project root LifetimeScope](https://vcontainer.hadashikick.jp/scoping/project-root-lifetimescope): configuring a root scope that parents project scopes.
- [Registering MonoBehaviour](https://vcontainer.hadashikick.jp/registering/register-monobehaviour): scene, hierarchy, prefab, and existing-component registration behavior.
- [Unity State pattern tutorial](https://learn.unity.com/course/design-patterns/tutorial/develop-a-modular-flexible-codebase-with-the-state-programming-pattern): state-based separation for main menu, gameplay, game over, and growing transition behavior.
- [Unity `SceneManager.LoadSceneAsync`](https://docs.unity3d.com/ScriptReference/SceneManagement.SceneManager.LoadSceneAsync.html): asynchronous scene-loading contract and `AsyncOperation` completion.

Use the installed VContainer package source and the project's Unity-version documentation for exact signatures. Online documentation can describe a newer release than the project has pinned.
