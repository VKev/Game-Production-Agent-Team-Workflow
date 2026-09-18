using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Unity.AI.Assistant.Agent.Dynamic.Extension.Editor;
using Unity.AI.MCP.Editor.ToolRegistry;
using UnityEngine;

internal class CommandScript : IRunCommand
{
    static string Quote(string value)
    {
        if (value == null) return "null";
        var builder = new StringBuilder(value.Length + 8).Append('"');
        foreach (var character in value)
        {
            switch (character)
            {
                case '"': builder.Append("\\\""); break;
                case '\\': builder.Append("\\\\"); break;
                case '\b': builder.Append("\\b"); break;
                case '\f': builder.Append("\\f"); break;
                case '\n': builder.Append("\\n"); break;
                case '\r': builder.Append("\\r"); break;
                case '\t': builder.Append("\\t"); break;
                default:
                    if (character < 0x20) builder.Append("\\u").Append(((int)character).ToString("x4"));
                    else builder.Append(character);
                    break;
            }
        }
        return builder.Append('"').ToString();
    }

    static string RawJson(object value)
    {
        if (value == null) return "null";
        var text = value.ToString().Trim();
        if ((text.StartsWith("{") && text.EndsWith("}")) ||
            (text.StartsWith("[") && text.EndsWith("]")) ||
            text == "null" || text == "true" || text == "false") return text;
        return Quote(text);
    }

    static void AppendNames<T>(StringBuilder builder, T[] tools, Func<T, string> selectName)
    {
        builder.Append('[');
        for (var index = 0; index < tools.Length; index++)
        {
            if (index > 0) builder.Append(',');
            builder.Append(Quote(selectName(tools[index])));
        }
        builder.Append(']');
    }

    public void Execute(ExecutionResult result)
    {
        var registered = McpToolRegistry.GetAllToolsForSettings()
            .OrderBy(tool => tool.Info.name, StringComparer.Ordinal).ToArray();
        var ignoring = McpToolRegistry.GetAvailableTools(true)
            .OrderBy(tool => tool.name, StringComparer.Ordinal).ToArray();
        var advertised = McpToolRegistry.GetAvailableTools()
            .OrderBy(tool => tool.name, StringComparer.Ordinal).ToArray();

        var json = new StringBuilder(256 * 1024).Append("{\"registered\":[");
        for (var index = 0; index < registered.Length; index++)
        {
            if (index > 0) json.Append(',');
            var tool = registered[index];
            var info = tool.Info;
            json.Append("{\"Info\":{")
                .Append("\"name\":").Append(Quote(info.name)).Append(',')
                .Append("\"title\":").Append(Quote(info.title)).Append(',')
                .Append("\"description\":").Append(Quote(info.description)).Append(',')
                .Append("\"inputSchema\":").Append(RawJson(info.inputSchema)).Append(',')
                .Append("\"outputSchema\":").Append(RawJson(info.outputSchema)).Append(',')
                .Append("\"annotations\":").Append(RawJson(info.annotations))
                .Append('}');
            json.Append(",\"IsEnabled\":").Append(tool.IsEnabled ? "true" : "false")
                .Append(",\"IsDefault\":").Append(tool.IsDefault ? "true" : "false")
                .Append(",\"Groups\":[")
                .Append(string.Join(",", (tool.Groups ?? Array.Empty<string>()).Select(Quote)))
                .Append("]}");
        }
        json.Append("],\"filteredIgnoringEnableState\":");
        AppendNames(json, ignoring, tool => tool.name);
        json.Append(",\"advertisedEnabled\":");
        AppendNames(json, advertised, tool => tool.name);
        json.Append('}');

        var projectRoot = Directory.GetParent(Application.dataPath).FullName;
        var outputDirectory = Path.Combine(projectRoot, ".agent-temp", "setup-checkpoints", "unity-mcp");
        Directory.CreateDirectory(outputDirectory);
        var outputPath = Path.Combine(outputDirectory, "unity-registry.json");
        var bytes = Encoding.UTF8.GetBytes(json.ToString());
        File.WriteAllBytes(outputPath, bytes);
        string hash;
        using (var sha = SHA256.Create())
            hash = BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();

        result.Log("Unity MCP registry exported: registered={0}, ignoring={1}, advertised={2}, path={3}, sha256={4}",
            registered.Length, ignoring.Length, advertised.Length, outputPath, hash);
    }
}
