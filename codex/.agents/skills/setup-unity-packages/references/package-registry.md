# Registered Unity packages

This registry is an allowlist and a snapshot of user-provided archives. A mirror link is an authorized candidate source, not proof of publisher authenticity or currentness.

## Bundled archives

| Product | Asset | Bundled version evidence | Archive SHA-256 | Archive product root | Canonical installed root |
|---|---|---|---|---|---|
| Odin Inspector and Serializer | `ZodinInspector.unitypackage` | Internal `Version.txt`: `4.0.2.3` | `8B2B6F42DA157C9410B4FA13DDDB17FF6D82F14FBA706005DF767FE62E387A5D` | `Assets/Plugins/Sirenix/` | `Assets/Plugins/Sirenix/` |
| DOTween Pro | `DOTweenPro.unitypackage` | Source label and official changelog: `1.0.430` | `2244448ACB4B8CBB2EF97794D1C22D7E4225E1A506FEC79C357DAFCDA6D4882F` | `Assets/Plugins/Demigiant/` | `Assets/Plugins/Demigiant/` |
| Feel | `Feel.unitypackage` | Internal readme: `6.0` | `B422040ECBA5EFD0B6B54F2667D7BA2BBBA30E7511E2F10B6BFD8FCEB7DD4438` | `Assets/Feel/` | `Assets/Plugins/Feel/` |
| Final IK | `FinalIK.unitypackage` | Internal readme: `2.5` | `D764EA0FF2A7C379731EF0FF8CDE62F7AADABEDD321E86F0B97EEBD11FD8A8C0` | `Assets/Plugins/RootMotion/FinalIK/` | `Assets/Plugins/RootMotion/FinalIK/` |
| Legs Animator | `LegsAnimator.unitypackage` | Internal readme: `1.0.4.6.1`; source label `1.0.4.6 (19 Jun 2026)` | `B92B608C4B1D5703E5626AAA252D12F507D537A08C324D2937DB552D706E282A` | `Assets/FImpossible Creations/Plugins - Animating/Legs Animator/` | `Assets/Plugins/FImpossible Creations/Plugins - Animating/Legs Animator/` |
| Optimizers | `Optimizers.unitypackage` | Internal readme: `2.2.3.1`; source label `2.2.3 (19 Jun 2026)` | `AD6340BB9E3FDCCA9F266B05BFC6DEBFC6ADA6C1283A05A3584FCC310FC1715C` | `Assets/FImpossible Creations/Plugins - Other/Optimizers 2/` | `Assets/Plugins/FImpossible Creations/Plugins - Other/Optimizers 2/` |
| Retarget Pro | `RetargetPro.unitypackage` | Unversioned registered fingerprint | `70BA664EE8D7B6F0CB16111D1ECC8800F66BA87AB821EFF369A889C3DE98104F` | `Assets/KINEMATION/` | `Assets/Plugins/KINEMATION/` |
| Spine Animator | `SpinalAnimator.unitypackage` | Source label `2.0.2.3 (19 Jun 2026)`; archive has no comparable text marker | `AF95839622B5D2FB477982138699D32E35E190577C3D00EEB4E55B3AED614E88` | `Assets/FImpossible Creations/Plugins - Animating/Spine Animator/` | `Assets/Plugins/FImpossible Creations/Plugins - Animating/Spine Animator/` |
| Tail Animator V2 | `TailAnimator.unitypackage` | Internal readme: `2.0.7.4.1`; source label `2.0.7.4 (19 Jun 2026)` | `A14EF1C7121DC7D79A01C474DFA55F237F7AC44D5FAE7A4145339731154C3A92` | `Assets/FImpossible Creations/Plugins - Animating/Tail Animator/` | `Assets/Plugins/FImpossible Creations/Plugins - Animating/Tail Animator/` |
| Technie Collider Creator 2 | `TechnieColliderCreator.unitypackage` | Source label `1.3.1`; archive has no comparable text marker | `AE68A99BA0E06328291A0E1BE12EF504249F7DBB23328553F4B9873A2A5DBD84` | `Assets/Technie/PhysicsCreator/` | `Assets/Plugins/Technie/PhysicsCreator/` |

## Official UPM packages

| Product | Package ID | Approved source | Version policy |
|---|---|---|---|
| VContainer | `jp.hadashikick.vcontainer` | `https://github.com/hadashiA/VContainer.git?path=VContainer/Assets/VContainer#<stable-tag>` | Resolve the latest non-draft, non-prerelease GitHub release and verify its tag plus tagged `package.json` before install. The verified snapshot on 2026-08-09 was `1.19.0`; do not hard-code that snapshot as permanently latest. |
| Cinemachine | `com.unity.cinemachine` | Official Unity Registry metadata plus the exact matching Editor package catalog | If missing, resolve the highest released stable version whose `unity` and `unityRelease` floor is compatible with the exact Editor patch. If already installed from the Unity Registry, preserve the installed major and update only within that major. Never auto-migrate Cinemachine 2.x to 3.x. |

Recognize the official OpenUPM VContainer package as an acceptable existing source when it resolves the same verified stable version. Do not automatically replace an embedded package, local path, fork, dirty Git source, or newer installed version. Cinemachine's approved source is the Unity Registry; a Git, local, embedded, or forked Cinemachine package is ambiguous.

## Identity markers

### Odin Inspector

- Primary: `Assets/Plugins/Sirenix/Odin Inspector/Version.txt`, content `4.0.2.3`.
- Required: `Assets/Plugins/Sirenix/Assemblies/Sirenix.OdinInspector.Attributes.dll`, `Sirenix.OdinInspector.Editor.dll`, and `Assets/Plugins/Sirenix/Readme.txt`.

### DOTween Pro

- Primary: `Assets/Plugins/Demigiant/DOTweenPro/DOTweenPro.dll`, SHA-256 `3E7F6E002364316A3653400CD0779C56894660857E15CB4254594935FE70499E`.
- Required fingerprints:
  - `Assets/Plugins/Demigiant/DOTween/DOTween.dll`: `5CEE7F2B16FD3BA509ECAC8BFC95EFC9347682956FC4C1EFDE14618176E34491`
  - `Assets/Plugins/Demigiant/DOTween/Editor/DOTweenEditor.dll`: `3AD165BA35862D087DD85C7B15B5D9FD9EC29014574774A38228FC09F415F10B`
  - `Assets/Plugins/Demigiant/DOTweenPro/Editor/DOTweenProEditor.dll`: `D9811B2B2A967209F60B3F5325FE4EC88B099EB238AD522C21BB20770D20B6F7`
- Required: `Assets/Plugins/Demigiant/DOTweenPro/readme.txt`; setup-required state must be false.
- Required module profile after setup:

  | DOTween module field | Requested state | Effective rule |
  |---|---:|---|
  | `audioEnabled` | on | Always on. |
  | `physicsEnabled` | on | Always on. |
  | `physics2DEnabled` | on | Always on. |
  | `spriteEnabled` | on | Always on. |
  | `uiEnabled` | on | Always on. |
  | `uiToolkitEnabled` | off | Keep off unless the user separately requests UI Toolkit tween support. |
  | `epoOutlineEnabled` | off | Keep off unless a compatible Easy Performant Outline installation is independently verified. |
  | `deAudioEnabled` | on | For the registered `1.0.430` fingerprint, the bundled integration script is an empty marker and this state is safe. For a newer verified build, enable only after its integration source and dependency are compatible. |
  | `deUnityExtendedEnabled` | on | For the registered `1.0.430` fingerprint, the bundled integration script is an empty marker and this state is safe. For a newer verified build, enable only after its integration source and dependency are compatible. |
  | `textMeshProEnabled` | on | Enable only when `TMPro.TMP_Text` is loadable after package resolution; otherwise keep off and report the optional module pending. |
  | `tk2DEnabled` | off | Legacy 2D Toolkit remains off. |

  This profile matches the requested DOTween Add/Remove Modules selection while preventing an unavailable external integration from breaking compilation. `modules.showPanel` must be true after the initial setup action.

### Feel

- Primary: `Assets/Plugins/Feel/readme.txt`, SHA-256 `C7404D79E7EB35902C468DCAFD3B7CBC4BEEE7C3F3874019463F353A7B561EC6`, declaring `Feel v6.0`.
- Required:
  - `Assets/Plugins/Feel/MMFeedbacks/MMFeedbacks/Core/MMF_Player/MMF_Player.cs`, SHA-256 `C8B0F3C0BB9A7F15A1433B57C6F6B1384B25B62D274B5C66844691D88AD83829`
  - `Assets/Plugins/Feel/MMFeedbacks/MMFeedbacks/Core/MMF_Player/MMF_Feedback.cs`, SHA-256 `E5D1B9BD3454BD34EB2CDEF68E5ED00C70CC0DB96AE39E0766082D974CACC87F`

### Final IK

- Primary: `Assets/Plugins/RootMotion/FinalIK/FinalIK ReadMe.rtf`, SHA-256 `3BDC7FC234AB90D2E7971B23D1EDB0F8A2379CDB87914B2F75A310D1A0C0D810`, declaring version `2.5`.
- Required:
  - `Assets/Plugins/RootMotion/FinalIK/IK Components/IK.cs`, SHA-256 `76C14EC694E72E886293B2D33AE9219CBC78F59B439FEA28B8803F0C77FEA634`
  - `Assets/Plugins/RootMotion/FinalIK/IK Components/VRIK.cs`, SHA-256 `6EB4FD1F2B381F37A859DE372D04C4EF095469FBE130039D995A6A51CD03A27E`
  - `Assets/Plugins/RootMotion/FinalIK/IK Solvers/IKSolver.cs`, SHA-256 `C7E7ADB4BC3969C08425CC9FAD13B18198FE8D226688674DDC07F9602AFCEC9F`

### FImpossible packages

- Legs primary readme: `Assets/Plugins/FImpossible Creations/Plugins - Animating/Legs Animator/Legs Animator - Readme.txt`, SHA-256 `2CFAC90BA6B86DEE5265E8C0171CE9AC735B75DE8099855BDD1993AA1573EF6F`; required `LegsAnimator.cs`, SHA-256 `9D4D53FD35431DF45A70A7799749DBDB62A438CD601B7CF8DA3343F35D8D4D84`.
- Optimizers primary readme: `Assets/Plugins/FImpossible Creations/Plugins - Other/Optimizers 2/ReadMe - Optimizers.txt`, post-remap SHA-256 `3AD6E0D0144A08EC97CCE8300BC4AAF61D9BD5943156798A9A445E7CE7E4A9C6`; required `EssentialOptimizer.cs`, SHA-256 `11FF917CE176ECBF7A6FE648B2B8214169CE896559FC784159177B98F0762876`.
- Spine primary: `Assets/Plugins/FImpossible Creations/Plugins - Animating/Spine Animator/FSpineAnimator.cs`, SHA-256 `52406A2A6A78872FA2E35D0C61639509E2CEF81499F5AE269D4F141EA7AEDEBA`; required `Spine Animator User Manual.pdf`, SHA-256 `B5077BECBDABE22E18F7FB2ADE3670899D2DE78FF7437EE4EC75BE7228E44D66`.
- Tail primary readme: `Assets/Plugins/FImpossible Creations/Plugins - Animating/Tail Animator/ReadMe - Tail Animator.txt`, SHA-256 `065EA0569EC714EF156189AE040C84BEBF93DA0689D856AA19B15A01D6323F5D`; required `TailAnimator2.cs`, SHA-256 `7E49C3077080265BC55DBA96BD4E47929676A7CC91270A134D012C10BA129FD2`.

These four archives contain 172 overlapping shared paths and 11 differing payloads. After the registered import order, require the Legs-owned shared baseline:

- `Assets/Plugins/FImpossible Creations/Editor/Editor Tools/Files and Components Support/FEditor_ScriptMenuAddOptions.Prefabs.cs`: `B4AF69E6F21051CC6DFD14C15A1ABB8A57BEBBDD85AD95A044C9A6DB982D0106`
- `Assets/Plugins/FImpossible Creations/Plugins - Shared/Math Helpers/Math/FLogicMethods.cs`: `23A5AEB76DE345B75022006D5051C468379278F1493DAF51B267B494075EC920`
- `Assets/Plugins/FImpossible Creations/Shared Tools/GUI Helpers/FGUI_Inspector.cs`: `E8E59F394457D2C637ED52A910CA82EB653A8BD3D9566ACD0DE2C92FAD5B9A15`
- `Assets/Plugins/FImpossible Creations/Shared Tools/GUI Helpers/FGUI_Resources.cs`: `BBFAE538C49F6CAE3D12B403532728BE033652BD6AAA63379116807932E7844C`

### Retarget Pro

- Primary: `Assets/Plugins/KINEMATION/RetargetPro/Runtime/RetargetProfile.cs`, SHA-256 `1DEEF19075DB410F49FDCC498A485386201E3F0FD111A68B0F82F1B75434AAFB`.
- Required: `DynamicRetargeter.cs` SHA-256 `F65B2841658FED04D47906EC7D5A7A2703E6C198BE5B6F281EF30094812EAD64`, `RetargetPro.Runtime.asmdef` SHA-256 `533DC6D00254097C5CD1121D30EB7317963907FD3A7CE74E9D5F50DD9F608163`, and `Online Documentation.url` SHA-256 `16AEE70801C3ED628F313346D7CF8F07A62C7BDE2CE44BB416C019A20823171C`.

### Technie Collider Creator 2

- Primary: `Assets/Plugins/Technie/PhysicsCreator/Scripts/PhysicsCreatorInstallRoot.cs`, SHA-256 `CBFAA6D8C21CCD836A9B3833E20FFEA32F0447224F6C4D7CAE4800111FFEA3F9`.
- Required: `RigidColliderCreator.cs` SHA-256 `3E39F95120529DACC78E0C1525CDD8ED99E263A12A8DD5CA9CC9DC2E9FE8981B`, `DynamicSkinnedCollider.cs` SHA-256 `DF5E28F00CB830B96A559D24DE37E16021D7F81BE47E5E196D295D97ADC29F0B`, and `Technie Collider Creator Readme.pdf` SHA-256 `EE735842912A176DC35367F42E75805B7D343B93F5E6EFE10F5F267D14C21045`.

## Canonical layout and compatibility profiles

- Import only the prepared archive emitted by `scripts/prepare_unitypackage.py` when an archive product root differs from its canonical installed root or a compatibility profile applies. The original bundled archive remains the source identity; the generated sidecar records the derived archive SHA-256 and every transformation.
- All registered third-party assets must live below `Assets/Plugins/`. The preparation script preserves Unity GUIDs, rewrites package pathnames, and rewrites only known textual literals that still name the old product root. A newer or modified archive hash has no automatic transform authority and remains pending review.
- The exact registered Feel `6.0` and Final IK `2.5` archives have hash-gated Unity `2022.x` compatibility profiles in `scripts/unity_compatibility_patches.json`. Those profiles are the changes that compiled cleanly in Unity `2022.3.62f2`; every source and result file hash must match. Do not apply them to Unity 6 or an unknown archive.
- Render-pipeline pruning is allowlisted and reference-safe. For a non-HDRP project, Feel's `FeelDemosHDRP` subtree may be omitted only when no kept asset references one of its GUIDs. If a reference exists, retain the subtree and record why stripping was skipped; never create a broken archive merely to reduce import size.
- An existing exact registered install under an old root is `repairable layout`. Move the entire product root through `AssetDatabase.MoveAsset`, rewrite only registered old-root text literals, then verify GUID/meta preservation and canonical markers. If old and canonical roots both exist, or ownership/fingerprints disagree, classify the package as `ambiguous` and stop.

For an in-place layout repair, the only registered text-literal rewrite targets are:

| Installed file after the root move | Exact replacement and count | Source SHA-256 | Result SHA-256 |
|---|---|---|---|
| `Assets/Plugins/FImpossible Creations/Plugins - Other/Optimizers 2/ReadMe - Optimizers.txt` | `Assets\FImpossible Creations` → `Assets\Plugins\FImpossible Creations` × 1 | `B91C5990B03CA82C60FCE40F1D65DED22CF84AE3CFBCC9946707BBBE363FA4FF` | `3AD6E0D0144A08EC97CCE8300BC4AAF61D9BD5943156798A9A445E7CE7E4A9C6` |
| `Assets/Plugins/FImpossible Creations/Editor/Plugins - Editor - Other/Optimizers 2/Optimizers.EditorUtilities.MenuItems.cs` | `Assets/FImpossible Creations` → `Assets/Plugins/FImpossible Creations` × 3 | `F8E49A1E31023F9021964E4011132F0C3D13ED9A2E3BA754A231B68E4B5BF1C2` | `6A45840A3B8D35B8F4A919EB8AB36EB47A7F47D58C14E3631EABDAD5CA2B65FE` |
| `Assets/Plugins/KINEMATION/RetargetPro/Editor/Scripts/Window/RetargetPreviewEnvironment.cs` | `Assets/KINEMATION` → `Assets/Plugins/KINEMATION` × 1 | `B70D8506CB36D58712F94233B20BA91E0D63D8331733E2FA8CFA337EEA7D3B0C` | `272CBECB3625774918914041ADB56A20F8479537407D79BDD4CE5273BEB472F5` |
| `Assets/Plugins/Technie/PhysicsCreator/Editor/CommonUi.cs` | `Assets/Technie` → `Assets/Plugins/Technie` × 1 | `4B95CF15A10E3387762E9FCB39AB4C617693080AA3A17A5479F752707A3E6D69` | `88A7E30CA7246593768A3B554FCF68878226B34D5B8426FBDDC7EB93203D685E` |

Require the registered pre-rewrite file hash, the exact expected occurrence count from the prepared archive, and the prepared post-rewrite hash before editing. Feel and the other FImpossible archives have no registered source-literal rewrite beyond pathname remapping. Unknown occurrences are `ambiguous`.

## Registered public candidate sources

| Product | Public folder | Current known selected candidate |
|---|---|---|
| Technie Collider Creator 2 | `https://disk.yandex.ru/d/vgTiyPjpeU9ivA` | `Technie Collider Creator 2 v1.3.1.unitypackage`, SHA-256 `AE68A99BA0E06328291A0E1BE12EF504249F7DBB23328553F4B9873A2A5DBD84` |
| Tail Animator V2 | `https://disk.yandex.ru/d/Lu5pq-y6i2xWhw` | `Tail Animator v2.0.7.4 (19 Jun 2026).unitypackage`, SHA-256 `A14EF1C7121DC7D79A01C474DFA55F237F7AC44D5FAE7A4145339731154C3A92` |
| Spine Animator | `https://disk.yandex.ru/d/TZD5hUOn8KhEPQ` | `Spinal Animator v2.0.2.3 (19 Jun 2026).unitypackage`, SHA-256 `AF95839622B5D2FB477982138699D32E35E190577C3D00EEB4E55B3AED614E88` |
| DOTween Pro | `https://disk.yandex.ru/d/D7VU7f7hH1Kp5A` | `DOTween Pro v1.0.430 (23 Jun 2026).unitypackage`, SHA-256 `2244448ACB4B8CBB2EF97794D1C22D7E4225E1A506FEC79C357DAFCDA6D4882F` |
| Legs Animator | `https://disk.yandex.ru/d/g2lyklAotbhAEA` | `Legs Animator v1.0.4.6 (19 Jun 2026).unitypackage`, SHA-256 `B92B608C4B1D5703E5626AAA252D12F507D537A08C324D2937DB552D706E282A` |
| Final IK | `https://disk.yandex.ru/d/MNvC4vVGCvx-8w` | `Final IK v2.5.unitypackage`, SHA-256 `D764EA0FF2A7C379731EF0FF8CDE62F7AADABEDD321E86F0B97EEBD11FD8A8C0` |
| Optimizers | `https://disk.yandex.ru/d/_x1CJN95BsIy2Q` | `Optimizers v2.2.3 (19 Jun 2026).unitypackage`, SHA-256 `AD6340BB9E3FDCCA9F266B05BFC6DEBFC6ADA6C1283A05A3584FCC310FC1715C` |
| Odin Inspector | `https://disk.yandex.ru/d/PY1QPXihoEUNQw` | `Odin Inspector and Serializer v4.0.2.3 (21 Jul 2026).unitypackage`, SHA-256 `8B2B6F42DA157C9410B4FA13DDDB17FF6D82F14FBA706005DF767FE62E387A5D` |
| Feel | `https://disk.yandex.ru/d/W8r5evT7G4SD_w` | `Feel v6.0.unitypackage`, SHA-256 `B422040ECBA5EFD0B6B54F2667D7BA2BBBA30E7511E2F10B6BFD8FCEB7DD4438` |

Do not select videos or subdirectories from these folders. Do not infer a Retarget Pro source from an unrelated link.
