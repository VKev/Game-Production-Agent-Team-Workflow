using System;
using System.Linq;
using UnityEditor;

internal class CommandScript : IRunCommand
{
    public void Execute(ExecutionResult result)
    {
        var editor = AppDomain.CurrentDomain.GetAssemblies().Single(assembly => assembly.GetName().Name == "DOTweenEditor");
        var core = AppDomain.CurrentDomain.GetAssemblies().Single(assembly => assembly.GetName().Name == "DOTween");
        var utilityWindow = editor.GetType("DG.DOTweenEditor.UI.DOTweenUtilityWindow", true);
        var editorUtils = editor.GetType("DG.DOTweenEditor.EditorUtils", true);
        var settings = utilityWindow.GetMethods().Single(method => method.Name == "GetDOTweenSettings" &&
            method.IsPublic && method.IsStatic && method.GetParameters().Length == 0).Invoke(null, null);
        if (settings == null)
        {
            result.LogError("DOTween settings are missing.");
            return;
        }
        var settingsType = core.GetType("DG.Tweening.Core.DOTweenSettings", true);
        var modules = settingsType.GetField("modules").GetValue(settings);
        if (modules == null)
        {
            result.LogError("DOTween module settings are missing.");
            return;
        }
        var modulesType = modules.GetType();
        foreach (var name in new[] { "showPanel", "audioEnabled", "physicsEnabled", "physics2DEnabled",
            "spriteEnabled", "uiEnabled", "uiToolkitEnabled", "textMeshProEnabled", "tk2DEnabled",
            "deAudioEnabled", "deUnityExtendedEnabled", "epoOutlineEnabled" })
            result.Log("{0}={1}", name, modulesType.GetField(name).GetValue(modules));

        var required = (bool)editorUtils.GetMethods().Single(method => method.Name == "DOTweenSetupRequired" &&
            method.IsPublic && method.IsStatic && method.GetParameters().Length == 0).Invoke(null, null);
        var all = AssetDatabase.FindAssets("t:DG.Tweening.Core.DOTweenSettings")
            .Select(AssetDatabase.GUIDToAssetPath).ToArray();
        result.Log("settings_count={0}; path={1}; setup_required={2}", all.Length,
            AssetDatabase.GetAssetPath((UnityEngine.Object)settings), required);
    }
}
