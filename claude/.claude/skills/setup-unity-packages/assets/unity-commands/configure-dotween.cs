using System;
using System.Linq;
using UnityEditor;
using UnityEngine;

internal class CommandScript : IRunCommand
{
    static object GetPublicStatic(Type type, string name)
    {
        var method = type.GetMethods().Single(candidate => candidate.Name == name &&
            candidate.IsPublic && candidate.IsStatic && candidate.GetParameters().Length == 0);
        return method.Invoke(null, null);
    }

    static void InvokeExactPublicStatic(Type type, string name)
    {
        var method = type.GetMethods().Single(candidate => candidate.Name == name &&
            candidate.IsPublic && candidate.IsStatic && candidate.GetParameters().Length == 0);
        method.Invoke(null, null);
    }

    public void Execute(ExecutionResult result)
    {
        var editor = AppDomain.CurrentDomain.GetAssemblies().Single(assembly => assembly.GetName().Name == "DOTweenEditor");
        var core = AppDomain.CurrentDomain.GetAssemblies().Single(assembly => assembly.GetName().Name == "DOTween");
        var utilityWindow = editor.GetType("DG.DOTweenEditor.UI.DOTweenUtilityWindow", true);
        var editorUtils = editor.GetType("DG.DOTweenEditor.EditorUtils", true);
        var modulesWindow = editor.GetType("DG.DOTweenEditor.UI.DOTweenUtilityWindowModules", true);
        var asmdefManager = editor.GetType("DG.DOTweenEditor.ASMDEFManager", true);
        var defines = editor.GetType("DG.DOTweenEditor.DOTweenDefines", true);
        var settingsType = core.GetType("DG.Tweening.Core.DOTweenSettings", true);
        var modulesType = settingsType.GetNestedType("ModulesSetup");

        var settings = GetPublicStatic(utilityWindow, "GetDOTweenSettings");
        if (settings == null)
        {
            if (!AssetDatabase.IsValidFolder("Assets/Resources")) AssetDatabase.CreateFolder("Assets", "Resources");
            var connect = editorUtils.GetMethods().Single(method => method.Name == "ConnectToSourceAsset" &&
                method.IsPublic && method.IsStatic && method.IsGenericMethodDefinition && method.GetParameters().Length == 2);
            settings = connect.MakeGenericMethod(settingsType)
                .Invoke(null, new object[] { "Assets/Resources/DOTweenSettings.asset", true });
        }
        if (settings == null)
        {
            result.LogError("Unable to create or load DOTween settings.");
            return;
        }

        var modulesField = settingsType.GetField("modules");
        var modules = modulesField.GetValue(settings);
        if (modules == null)
        {
            modules = Activator.CreateInstance(modulesType);
            modulesField.SetValue(settings, modules);
        }
        Action<string, bool> set = (name, value) => modulesType.GetField(name).SetValue(modules, value);
        set("audioEnabled", true);
        set("physicsEnabled", true);
        set("physics2DEnabled", true);
        set("spriteEnabled", true);
        set("uiEnabled", true);
        set("uiToolkitEnabled", false);
        set("epoOutlineEnabled", false);
        set("deAudioEnabled", true);
        set("deUnityExtendedEnabled", true);
        set("textMeshProEnabled", AppDomain.CurrentDomain.GetAssemblies()
            .Select(assembly => assembly.GetType("TMPro.TMP_Text", false)).Any(type => type != null));
        set("tk2DEnabled", false);

        InvokeExactPublicStatic(modulesWindow, "ApplyModulesSettings");
        InvokeExactPublicStatic(asmdefManager, "ApplyASMDEFSettings");
        set("showPanel", true);
        EditorUtility.SetDirty((UnityEngine.Object)settings);
        InvokeExactPublicStatic(editorUtils, "DeleteLegacyNoModulesDOTweenFiles");
        InvokeExactPublicStatic(defines, "RemoveAllLegacy");
        InvokeExactPublicStatic(editorUtils, "DeleteDOTweenUpgradeManagerFiles");
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
        result.Log("Configured DOTween modules and setup state at {0}", AssetDatabase.GetAssetPath((UnityEngine.Object)settings));
    }
}
