---
name: dev-unity-mcp
description: Use, inspect, extend, troubleshoot, and verify the official Unity MCP supplied by com.unity.ai.assistant for Unity 6000.3.21f1. Read this skill before any Unity MCP call involving Editor state, scenes, hierarchy, GameObjects, prefabs, assets, packages, Console, play mode, screenshots, scripts, custom tools, connection approval, targeting, resource URIs, schemas, or registry coverage.
---

# Official Unity MCP

Use server id `unity_mcp`. This skill targets Unity `6000.3.21f1` only and the exact `com.unity.ai.assistant` version pinned in the current project.

## Load the right reference

- Read [references/connection-and-addressing.md](references/connection-and-addressing.md) before connecting, selecting an Editor, or constructing an object/resource address.
- Read [references/tool-workflows.md](references/tool-workflows.md) before choosing or calling a tool.
- Read [references/custom-tools-and-coverage.md](references/custom-tools-and-coverage.md) when registering custom tools. Read [references/live-registry-export.md](references/live-registry-export.md) whenever setup or a package update must enable tools and prove complete source/Editor/client equality.
- Read the setup skill's [Project Settings > AI policy](../setup-unity-mcp/references/project-settings-ai.md) before diagnosing settings, connection approval, disabled tools, or the similarly named **Assistant MCP Extensions** page.
- Read [references/sources.md](references/sources.md) when package behavior or an API needs source verification.
- Treat [references/generated/official-surface.json](references/generated/official-surface.json) as a portable source-derived inventory, not a substitute for the current live registry.

## Routing

1. Confirm the intended project and Editor instance. If multiple instances are available and targeting is ambiguous, stop and ask.
2. Use Unity MCP first for Editor-owned state: scenes, hierarchy, GameObjects, components, prefabs, assets, package state, Console, compilation, play mode, captures, and Unity-aware mutation.
3. Use Better Context before source-code location. Use CodeGraph only after that map yields a relevant region or symbol. CocoIndex may search semantically across the project when the identifier/location is unknown. Use Serena for ordinary source edits.
4. Use MCP script read/edit/validate only when Editor synchronization, a SHA precondition, Unity-aware validation, or an Editor-owned workflow makes it safer than Serena.
5. Do not repeat the same investigation across MCP, CodeGraph, CocoIndex, Serena, and grep without a concrete evidence gap.

## Mutation contract

- Read current state first; include exact target identity and expected precondition.
- Ask before destructive, broad, or intent-ambiguous changes.
- Prefer the narrowest tool and action. Preserve SHA requirements for scripts and save/apply only at the documented boundary.
- After a Unity mutation, wait for refresh/compile as required, then inspect Console delta and verify the changed object or asset.
- Use temporary, snapshotted targets for smoke mutations; roll them back without leaving assets or `.meta` files.
- Never claim standard MCP resources/templates/prompts unless `initialize` advertises them. `Unity.ListResources` and `Unity.ReadResource` are tools when exposed through `tools/list`.

## Completeness gate

Setup is complete only when the source-generated official catalog, live Assistant-adapted/custom registry, and Codex `tools/list` have exact exposed-name equality and matching canonical input/output schema hashes. Groups, enabled state, and URI patterns must also agree where the live surface supplies them. Any mismatch is `skill-surface-drift`; regenerate, refresh the registry and client list, then compare again.
