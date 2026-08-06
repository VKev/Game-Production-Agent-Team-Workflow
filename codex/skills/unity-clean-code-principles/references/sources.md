# Research Sources

These sources inform the skill's principles. Use project evidence and version-specific documentation as the final authority.

## Unity Sources

1. **How to architect code as your project scales**  
   https://unity.com/how-to/how-architect-code-your-project-scales  
   Used for responsibility separation, MonoBehaviour/plain C# boundaries, explicit ownership, decoupling, and testability.

2. **Level up your code with game programming patterns**  
   https://unity.com/blog/games/level-up-your-code-with-game-programming-patterns  
   Used for KISS, contextual SOLID, composition, pattern tradeoffs, and the warning not to force patterns into scripts.

3. **Naming and code style tips for C# scripting in Unity**  
   https://unity.com/how-to/naming-and-code-style-tips-c-scripting-unity  
   Used for intent-revealing names, consistent team style, method and event naming, and identifier guidance.

4. **Formatting best practices for C# scripting in Unity**  
   https://unity.com/how-to/formatting-best-practices-c-scripting-unity  
   Used for braces, indentation, class/method/comment formatting, and clarity-oriented layout.

5. **Clean up your code: How to create your own C# code style**  
   https://unity.com/blog/engine-platform/clean-up-your-code-how-to-create-your-own-c-code-style  
   Used for readability-first guidance, clear naming, minimizing confusing side effects, and adapting rules to the team.

6. **Unity 2022.3 C# compiler**  
   https://docs.unity3d.com/2022.3/Documentation/Manual/CSharpCompiler.html  
   Used for the Unity 2022.3/C# 9 compatibility baseline and unsupported feature warnings.

7. **Unity 2022.3 script serialization**  
   https://docs.unity3d.com/2022.3/Documentation/Manual/script-Serialization.html  
   Used for field serialization rules, Inspector behavior, data compatibility, and serialized-structure boundaries.

8. **Unity 2022.3 Test Framework**  
   https://docs.unity3d.com/2022.3/Documentation/Manual/com.unity.test-framework.html  
   Used for Edit Mode and Play Mode verification guidance.

9. **Unity 2022.3 garbage collection best practices**  
   https://docs.unity3d.com/2022.3/Documentation/Manual/performance-garbage-collection-best-practices.html  
   Used for the requirement to consider allocation frequency and hot paths without turning optimization into a universal style rule.

## Microsoft Sources

10. **Common C# code conventions**  
    https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions  
    Used for clarity, simplicity, consistency, naming, layout, comments, and analyzer/editorconfig guidance.

11. **Architectural principles**  
    https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/architectural-principles  
    Used for separation of concerns, dependency inversion, explicit dependencies, and single responsibility concepts. The web-application examples are not copied as Unity architecture rules; only the general principles are distilled.

12. **Maintainability rules**  
    https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/quality-rules/maintainability-warnings  
    Used for complexity, coupling, inheritance-depth, and maintainability metrics as diagnostic signals rather than absolute rules.

## Refactoring and Evolutionary Design Sources

13. **Martin Fowler: Yagni**  
    https://martinfowler.com/bliki/Yagni.html  
    Used for avoiding capabilities built solely for presumed future need and favoring incremental design.

14. **Awesome GitHub Copilot: Refactor skill**  
    https://awesome-copilot.github.com/skill/refactor/  
    Used as a public Skill reference for behavior-preserving refactoring, small steps, tests, code-smell investigation, and avoiding refactoring without a clear purpose. Arbitrary size thresholds from that public skill are intentionally not adopted.

## Distillation Decisions

The skill intentionally rejects several common overcorrections:

- SOLID does not require an interface for every class.
- DRY does not require sharing all similar syntax.
- Small methods and classes are not goals by themselves.
- Design patterns are optional tools with setup and maintenance costs.
- YAGNI permits a small justified seam while rejecting implementation of unused future behavior.
- Performance guidance remains subordinate to correctness and evidence; hot-path exceptions must be localized and verified.
