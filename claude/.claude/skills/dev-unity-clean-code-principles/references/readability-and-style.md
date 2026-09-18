# Readability and Style

## Contents

1. Project conventions
2. Naming
3. Visibility and APIs
4. Methods
5. Conditions and control flow
6. Comments and documentation
7. Formatting and analyzers
8. Error handling

## 1. Project Conventions

Read the repository style before imposing a new one. Consistency reduces cognitive overhead. Preserve established conventions for braces, field prefixes, namespaces, file layout, and member ordering unless the task explicitly changes the style guide.

Do not perform formatting-only churn across unrelated files during a focused feature or fix.

## 2. Naming

Choose names that reveal intent, domain meaning, and units.

### Types

- Name classes and structs as nouns or noun phrases: `WeaponInventory`, `ReloadTimer`, `DamageResult`.
- Name interfaces as capabilities or roles: `IDamageable`, `IReceiptValidator`, `IClock`.
- Avoid vague names such as `Data`, `Info`, `Thing`, `Handler`, `Helper`, `Utils`, or `Manager` unless the surrounding domain makes the exact role clear.
- Use `Manager` only when the type truly coordinates or owns a collection of related objects and no more precise domain name exists.

### Methods

- Start action methods with verbs: `CalculateDamage`, `TryPurchase`, `ResetProjectile`.
- Name Boolean queries as questions: `IsReady`, `HasTarget`, `CanReload`.
- Use `Try` for operations that can fail normally and return success without throwing.
- Distinguish commands from notifications. For example, `OpenDoor` requests behavior; `OnDoorOpened` commonly raises or handles a notification according to project convention.

### Values

- Include units where ambiguity matters: `reloadDurationSeconds`, `moveSpeedMetersPerSecond`, `timeoutMilliseconds`.
- Avoid abbreviations unless they are standard in the project's domain.
- Avoid single-letter names outside tight loops, mathematical formulas, or well-known coordinates.
- Avoid repeating the containing type in member names when context already supplies it: prefer `Gun.Damage` over `Gun.GunDamage`.

### Booleans

Prefer positive names that make conditions easy to read. Replace ambiguous combinations such as `isNotDisabled` with a direct concept such as `isEnabled` when possible.

## 3. Visibility and APIs

Use the narrowest visibility that meets the requirement.

- Prefer private fields for internal state.
- Use `[SerializeField] private` when the Inspector needs access but callers do not.
- Expose properties or methods when callers need a stable contract.
- Avoid public writable fields for convenience.
- Keep implementation types `internal` or private when they are not part of a meaningful module API and the project setup supports it.
- Avoid adding public members for hypothetical future use.

Do not mechanically wrap every field in a property. Add a property when it represents an API, validation point, observable value, or controlled write boundary.

## 4. Methods

Make a method express one coherent operation at one useful level of abstraction.

### Extract a method when

- The extracted name explains an important idea better than comments.
- A block is reused as the same knowledge.
- A conditional branch forms a distinct decision.
- The block requires focused testing.
- The caller becomes easier to scan without hiding essential context.

### Keep code together when

- The operation is short, linear, and only understandable with nearby context.
- Extraction would create trivial forwarding methods.
- Readers would need to jump between many files or methods to follow one simple action.
- The proposed helper cannot be named precisely.

Do not use arbitrary line limits. Judge cognitive load, cohesion, nesting, side effects, and change risk.

### Parameters

- Pass only what the method needs.
- Group parameters into a value object only when they form one stable concept, travel together, or require shared validation.
- Avoid boolean parameters that make call sites cryptic. Prefer separate named methods, an enum, or an options type when modes are genuinely distinct.
- Do not introduce an options object for two obvious, stable parameters merely to reduce a count.

### Side effects

Make side effects visible in the method name or owning type. Separate calculation from mutation when doing so improves testing or prevents hidden behavior.

Prefer returning a result for pure calculations. Keep Unity object mutations near the owner responsible for applying them.

## 5. Conditions and Control Flow

- Use guard clauses to remove unnecessary nesting when invalid or terminal cases can be handled early.
- Keep the main successful path visible.
- Extract a complex Boolean expression into a well-named query when the name adds domain meaning.
- Use a `switch` when it clearly expresses a closed set of cases.
- Move to polymorphism or a strategy only when case-specific behavior is substantial, recurring, and expected to vary.
- Keep braces for clarity, especially around nested or multiline control flow.
- Avoid clever operator chains or compressed expressions that require readers to mentally simulate precedence.

A long flat sequence can be easier to understand than many tiny helpers; a short deeply nested method can still be difficult. Optimize for comprehension, not visual size alone.

## 6. Comments and Documentation

Write comments for:

- Why a non-obvious decision exists.
- Which invariant or external constraint must be preserved.
- Why a seemingly simpler solution was rejected.
- Why an optimization is necessary and how it was measured.
- Which Unity, platform, SDK, serialization, or lifecycle behavior creates a trap.

Do not write comments that merely restate the code. Prefer better names and structure.

Remove stale comments during refactoring. Preserve license, generated-code, and externally required comments.

Use XML documentation for public APIs when the repository uses it or when consumers need contract, unit, exception, ownership, or lifetime information.

## 7. Formatting and Analyzers

- Follow the repository's `.editorconfig` and formatter.
- Use one consistent brace and indentation style.
- Keep one statement and declaration per line when that improves scanning.
- Break long expressions at meaningful boundaries.
- Use whitespace to reveal structure without creating large visual gaps.
- Configure analyzers as team conventions, not as universal truth.
- Do not introduce new analyzer packages or mass-fix warnings outside the task without approval.

Treat metrics such as cyclomatic complexity, maintainability index, coupling, line count, and inheritance depth as signals for review, not automatic proof of bad design.

## 8. Error Handling

- Validate data at meaningful boundaries.
- Distinguish programmer errors, invalid authoring data, expected gameplay failure, and recoverable external failure.
- Avoid catch-all exception handling that hides defects.
- Do not use exceptions for normal per-frame gameplay branching.
- Include actionable context in logs without spamming hot paths.
- Avoid logging the same failure at every layer.
- Keep fallback behavior explicit and test it.

For Unity-authored data, fail early in development through validation, assertions, or clear Console errors where appropriate. Avoid silently repairing invalid configuration in ways that hide asset problems.
