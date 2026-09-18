---
name: dev-unity-interpreter-pattern
description: Design, implement, review, secure, optimize, and test Interpreter pattern solutions in Unity C#. Use for small domain-specific languages, gameplay rule expressions, dialogue/quest conditions, ability formulas, console commands, tokenization, parsing, AST or bytecode evaluation, sandboxing and diagnostics, IL2CPP/AOT constraints, and decisions among Interpreter, direct conditions, data tables, ScriptableObject rules, Strategy, Command, or an external parser/compiler.
---

# Unity Interpreter Pattern

Use Interpreter for a small, bounded language whose grammar and evaluation rules are part of the game’s domain.

## Compare Before Selecting

State benefit, drawback, prerequisite, rejection condition, and combinations for every candidate. Use any justified combination or none; do not assign ranks.

Compare direct conditions, a table/rule asset, Strategy, Command parsing, Interpreter, a parser generator, and an external compiler/runtime.

## Prove a Language Exists

1. Write representative expressions and a grammar.
2. Identify authors: developers, designers, modders, or players.
3. Define parse-time versus evaluation-time validation.
4. Define determinism, sandbox, quotas, versioning, and diagnostics.

Benefit: data-driven expressive rules with reusable syntax. Drawbacks: grammar complexity, security risk, poor diagnostics, runtime cost, version migration, recursion limits, and AOT/code-generation restrictions.

Reject Interpreter when a few fields, conditions, ScriptableObject rules, or strategies express the domain more safely.

## Build a Safe Pipeline

- Separate tokenize, parse, validate, and evaluate stages.
- Prefer an explicit AST or compact bytecode over runtime C# compilation.
- Never evaluate untrusted input through reflection or arbitrary code execution.
- Bound input length, parse depth, instruction count, memory, and wall time.
- Define numeric precision, overflow, random seeds, locale, and time semantics.
- Produce source-span diagnostics and stable error codes.
- Version the grammar and serialized programs.
- Avoid expression compilation assumptions on IL2CPP/AOT; test the player backend.

Use Command for action requests, Strategy for selectable algorithms, and State for behavior modes. These may be evaluation outputs but do not replace grammar ownership.

## Verify

- Test the grammar with valid, invalid, ambiguous, nested, and boundary inputs.
- Fuzz parser and evaluator limits.
- Test determinism across editor/player and target platforms.
- Test malicious or excessive input and verify quotas.
- Build IL2CPP and test stripping when reflection/generics are involved.
- Profile parse and evaluation separately; cache only immutable validated programs.

Read [references/interpreter-guide.md](references/interpreter-guide.md) for architecture and sources.
