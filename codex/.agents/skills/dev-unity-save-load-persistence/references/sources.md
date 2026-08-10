# Primary Sources

Consult the version matching the target Unity project and installed packages.

## Unity serialization and lifecycle

- [JsonUtility.ToJson](https://docs.unity3d.com/ja/current/ScriptReference/JsonUtility.ToJson.html) — supported roots, Unity serialization rules, runtime object-reference limitation, and background-thread mutation warning.
- [JsonUtility.FromJson](https://docs.unity3d.com/cn/current/ScriptReference/JsonUtility.FromJson.html) — supported deserialization targets and field behavior.
- [Unity script serialization](https://docs.unity3d.com/es/current/Manual/script-Serialization.html) — serializable fields, containers, custom classes, and unsupported multilevel types.
- [ISerializationCallbackReceiver](https://docs.unity3d.com/ja/current/ScriptReference/ISerializationCallbackReceiver.html) — conversion callbacks for types Unity cannot serialize directly.
- [Application.persistentDataPath](https://docs.unity3d.com/kr/current/ScriptReference/Application-persistentDataPath.html) — per-platform persistent storage locations and limitations.
- [SceneManager.sceneLoaded](https://docs.unity3d.com/ja/current/ScriptReference/SceneManagement.SceneManager-sceneLoaded.html) — subscription pattern and callback order relative to `OnEnable` and `Start`.
- [Object.FindObjectsByType](https://docs.unity3d.com/ja/6000.0/ScriptReference/Object.FindObjectsByType.html) — loaded-object scope, inactive-object behavior, and sorting choice.
- [SceneManager.LoadScene](https://docs.unity3d.com/ja/current/ScriptReference/SceneManagement.SceneManager.LoadScene.html) — scene-name behavior and asynchronous-loading recommendation.

## .NET file and path behavior

- [Path.Combine](https://learn.microsoft.com/en-us/dotnet/api/system.io.path.combine) — rooted later components can discard the earlier base path.
- [Path.GetFullPath](https://learn.microsoft.com/en-us/dotnet/api/system.io.path.getfullpath) — deterministic canonicalization with an explicit base-path overload where available.
- [Path.GetExtension](https://learn.microsoft.com/en-us/dotnet/api/system.io.path.getextension) — returned extensions include the period.
- [File.Replace](https://learn.microsoft.com/en-us/dotnet/api/system.io.file.replace) — replace-with-backup semantics and platform exceptions.
- [FileStream.Flush](https://learn.microsoft.com/en-us/dotnet/api/system.io.filestream.flush) — managed and intermediate buffer flushing behavior.

## Unity Cloud Save

- [Cloud Save write locks](https://docs.unity.com/en-us/cloud-save/concepts/write-locks) — optimistic concurrency and conflict handling.
- [Cloud Save Unity SDK sample](https://docs.unity.com/ugs/manual/cloud-save/manual/tutorials/unity-sdk-sample) — SDK initialization, exceptions, data, files, and write-lock examples.
- [Cloud Save files](https://docs.unity.com/cloud-save/concepts/files) — intended player-file use and current service limits.
- [Cloud Code with Cloud Save](https://docs.unity.com/en-us/cloud-save/tutorials/cloud-code) — server-authoritative access, retries, and conflict behavior.

## Analyzed case study

- [Better Save/Load using Data Binding in Unity](https://www.youtube.com/watch?v=z1sMhGIgfoo) — live save-state binding tutorial by git-amend, published February 25, 2024.
- [Video 3 source commit](https://github.com/adammyhre/Unity-Inventory-System/commit/b839715e6fb79d83a0fe76f08a1d1a7745f417d9) — exact tutorial implementation used to verify the architecture and identify sample limitations.

