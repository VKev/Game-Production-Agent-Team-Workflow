# glTFast guidance

- Prefer GLB when a single atomic payload simplifies distribution; use glTF with external resources only when URI ownership/cache policy is explicit.
- Separate download, parse/load, instantiate, and lifetime ownership. Report errors at the failing stage.
- Reuse a configured material generator/import settings appropriate to Built-in, URP, or HDRP; do not silently switch pipelines.
- Preserve asynchronous scheduling and cancellation. Avoid synchronous network/file waits on the main thread.
- Bound payload size and concurrency. Account for compressed source, decoded mesh, GPU buffers, texture decode, and duplicate material/texture memory.
- Dispose loader-owned resources according to the exact API and only after instantiated objects no longer depend on them.
- Validate extensions used by the asset. Unsupported extensions, Draco/KTX dependencies, animation features, or platform graphics limitations require an explicit fallback or rejection.
- Treat remote glTF as untrusted data: allowlist schemes/hosts when appropriate and prevent local/project traversal.
