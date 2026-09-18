# Interpreter Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) describes Interpreter as a pattern for languages/compilers, sees it as rarely relevant to games unless building a language, and places it in D tier. Games still use small languages for dialogue conditions, quests, formulas, console commands, and moddable rules; scope and safety decide whether the pattern is justified.

## Minimal Architecture

```text
source text
  -> tokenizer
  -> parser
  -> validated AST or bytecode
  -> bounded evaluator with explicit context
  -> typed result or diagnostic
```

Keep parsing and evaluation independent so validated programs can be cached and diagnostics remain precise.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [C# expression trees](https://learn.microsoft.com/en-us/dotnet/csharp/advanced-topics/expression-trees/)
- [.NET regular expressions](https://learn.microsoft.com/en-us/dotnet/standard/base-types/regular-expression-language-quick-reference)
- [Unity scripting restrictions](https://docs.unity3d.com/6000.3/Documentation/Manual/ScriptingRestrictions.html)
- [Unity managed code stripping](https://docs.unity3d.com/6000.3/Documentation/Manual/ManagedCodeStripping.html)
- [Unity ScriptableObject manual](https://docs.unity3d.com/6000.3/Documentation/Manual/class-ScriptableObject.html)
