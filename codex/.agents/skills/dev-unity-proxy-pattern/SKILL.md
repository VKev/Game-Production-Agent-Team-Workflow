---
name: dev-unity-proxy-pattern
description: Design, implement, review, refactor, debug, and test Proxy pattern solutions in Unity C#. Use for a same-contract stand-in that controls access to a remote, expensive, protected, lazy, cached, rate-limited, offline, or test service; for virtual/remote/protection/caching proxies and explicit service doubles; and when comparing Proxy with Decorator, Adapter, Facade, direct access, Addressables loading, or VContainer composition.
---

# Unity Proxy Pattern

Use Proxy when a stand-in should preserve a subject contract while controlling how or when the real subject is accessed.

## Compare Before Selecting

State benefit, drawback, prerequisite, rejection condition, and valid combinations for all candidates. Use any justified set or none; do not assign ranks.

Compare direct access, explicit Proxy, Decorator, Adapter, Facade, a test double, lazy asset loading, and VContainer composition.

## Define the Access Policy

1. Identify the subject contract and real implementation.
2. Name the policy: lazy load, cache, retry, rate limit, authorization, remote transport, batching, or diagnostics.
3. Define transparency limits, timing, error, cancellation, concurrency, and teardown.
4. Decide whether callers must know that the proxy is remote or deferred.

Benefit: centralize access policy while preserving client code. Drawbacks: hidden latency/cost, stale caches, altered failure timing, concurrency races, behavioral mismatch, and debugging indirection.

Reject Proxy when direct access is cheap and safe, when the interface must change, or when hiding remote/asynchronous behavior would mislead callers.

## Implement Explicitly for Unity

- Prefer explicit proxy classes over reflection-generated proxies in IL2CPP/AOT-sensitive builds.
- Preserve cancellation and error details.
- Define cache key, freshness, invalidation, memory bound, and offline behavior.
- Retry only idempotent operations or use request identity/deduplication.
- Serialize main-thread Unity object access deliberately.
- Release lazy-loaded assets and subscriptions at the owning scope boundary.
- Keep mocks/fakes named as test doubles when they do not forward to a real subject.

Proxy controls access; Decorator adds behavior, Adapter changes interface, and Facade simplifies a subsystem.

## Verify

- Run shared contract tests against real and proxy implementations.
- Test cache hit/miss/stale/invalidation and bounded retention.
- Test timeout, cancellation, retry, duplicate request, offline, and shutdown.
- Confirm remote cost and latency are visible enough to schedule correctly.
- Build and run an IL2CPP player when reflection or code generation is involved.

Read [references/proxy-guide.md](references/proxy-guide.md) for policy matrices and sources.
