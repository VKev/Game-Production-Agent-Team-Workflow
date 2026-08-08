---
name: unity-project-context
description: Maintain hierarchical project context for Unity repositories through root and folder-local AGENTS.md files. Use when navigating or implementing project code, structurally creating, moving, renaming, or deleting project-owned content, explicitly initializing context maps, or following existing folder maps instead of searching blindly.
---

# Unity Project Context

Use `AGENTS.md` files as a hierarchical map of the Unity project. Read project context before implementation, navigate through the maps, and keep the maps synchronized with structural changes.

## Trigger Boundary

Do not trigger this skill solely for Git initialization, `.gitignore` repair, external-tool installation, or agent bootstrap. Setup workflows may create or merge their own managed root `AGENTS.md` blocks through their dedicated setup skills without initializing the hierarchical Unity context map. Load this skill when subsequent project navigation or implementation actually needs that map, or when the user explicitly requests context initialization.

## Start at the Repository Root

1. Locate the repository root.
2. Read `<repository-root>/AGENTS.md` before exploring implementation folders.
3. Inspect whether the root file contains a recognizable table-of-contents section that lists project folders and briefly explains each folder's purpose.

Classify the project as follows:

- **Existing project:** The root `AGENTS.md` contains that folder table of contents.
- **New project:** The root `AGENTS.md` is missing, or it exists but does not contain that folder table of contents.

Do not classify a project from its age, number of files, or Unity version. Use the root `AGENTS.md` rule above.

## Navigate an Existing Project

Treat the root table of contents as the primary navigation index.

1. Find the top-level folder that best matches the task from the root table.
2. Open that folder's `AGENTS.md`.
3. Use its local table of contents to choose the next folder or file.
4. Repeat this process until reaching the implementation location.
5. Read every `AGENTS.md` from the root to the target folder before editing files there.

Use targeted filesystem inspection only to verify or supplement the documented route. Do not begin with an unrestricted repository-wide search when the maps already identify where the relevant code belongs.

If a documented path no longer exists, treat the map as stale and repair the affected table of contents as part of the task.

## Initialize a New Project

Proactively create `<repository-root>/AGENTS.md` before or alongside the first implementation change.

The root file must contain:

- A short factual description of the project, when it can be determined from project evidence.
- A `## Table of Contents` section.
- One entry for each project-owned top-level folder that exists or is created.
- A short description of what each listed folder contains or is responsible for.
- A link to the folder's local `AGENTS.md` whenever that local file exists.

Do not invent project goals or folder responsibilities. Derive descriptions from the task, the GDD, existing files, and actual implementation.

## Maintain One Local Map per Folder

Create an `AGENTS.md` in every project-owned folder that the agent creates or uses as an implementation location.

Each folder-local `AGENTS.md` must describe only that folder and contain:

- A short `## Purpose` section.
- A `## Table of Contents` section.
- Each immediate child folder, with a short description and a link to its own `AGENTS.md`.
- Each important script or project file created in the current folder, with a short description of its responsibility.

Keep the hierarchy local:

- The root map lists top-level folders.
- A folder map lists only its immediate child folders and important direct files.
- A nested folder's details belong in that nested folder's own `AGENTS.md`.

Do not duplicate the entire repository tree into every `AGENTS.md`.

## Update Maps During Implementation

Whenever implementation creates, moves, renames, or deletes project content, update the context maps in the same task.

Apply these rules:

- When creating a folder, add it to its parent's table of contents and create the folder's own `AGENTS.md`.
- When creating an important script or project file, add it to the table of contents of the folder that directly contains it.
- When creating a nested folder, add it to the current folder's table and create a new local `AGENTS.md` inside the nested folder.
- When moving or renaming content, update the old and new parent maps and repair links.
- When deleting content, remove its stale entries from the affected maps.
- When a file's responsibility changes materially, update its description.
- When only implementation details change and the documented responsibility remains accurate, do not rewrite the map unnecessarily.

Complete all required map updates before considering the implementation task finished.

## Preserve Existing AGENTS.md Content

Do not replace an existing `AGENTS.md` wholesale merely to add or update the map.

- Preserve existing instructions, conventions, and human-authored notes.
- Add the missing table of contents when the project is classified as new.
- Update only the context sections affected by the task.
- Keep descriptions concise, factual, and current.
- Do not list planned folders or files that do not exist.

## Scope the Managed Tree

Maintain maps for repository-owned source, configuration, tests, tools, and documentation folders.

Do not create or maintain `AGENTS.md` files inside generated, cached, imported, or third-party trees unless the task explicitly owns and modifies those files. In a Unity repository, this normally excludes folders such as:

- `Library/`
- `Temp/`
- `Logs/`
- `obj/`
- build output folders
- package caches
- vendored third-party asset folders that the project does not maintain

A project-owned parent map may still list an excluded folder when doing so is useful for navigation, but do not recursively manage that folder.

## Canonical Format

Use this compact structure when creating a new root map:

```markdown
# Project Context

<Short factual project description.>

## Table of Contents

| Path | Purpose |
| --- | --- |
| [`Assets/`](Assets/AGENTS.md) | Project-owned Unity assets and gameplay code. |
| [`Packages/`](Packages/AGENTS.md) | Project package declarations and project-owned package content. |
| [`ProjectSettings/`](ProjectSettings/AGENTS.md) | Unity project configuration. |
```

Use this compact structure for a folder-local map:

```markdown
# Scripts Context

## Purpose

<Short description of this folder's responsibility.>

## Table of Contents

| Path | Type | Purpose |
| --- | --- | --- |
| [`Gameplay/`](Gameplay/AGENTS.md) | Folder | Gameplay feature implementations. |
| `PlayerController.cs` | Script | Handles player movement input and movement commands. |
```

Adapt names and descriptions to the actual project. Omit rows that do not exist.

## Reference Loading Guide

Read [sources.md](references/sources.md) when classifying Unity-owned folders, package configuration, assembly boundaries, or `.meta` files. These sources explain Unity project semantics; they do not replace repository-specific `AGENTS.md` instructions.

## Completion Check

Before finishing a task, verify that:

1. The root `AGENTS.md` contains a current folder table of contents.
2. Every created or used implementation folder has a local `AGENTS.md`.
3. Parent maps list newly created immediate child folders.
4. Local maps list important newly created direct scripts or files.
5. Renamed, moved, or deleted paths have no stale entries.
6. Links and descriptions match the actual repository structure.
