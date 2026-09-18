# VFX Graph guidance

- Treat graph-exposed properties/events as an API. Document units, coordinate spaces, defaults, and ownership.
- Keep spawn rate, capacity, lifetime, and overdraw budgets explicit. Profile GPU time, memory, bounds, sorting, and transparency.
- Use fixed/manual bounds for predictable effects; overly small bounds cull effects and overly large bounds waste rendering.
- Choose Local/World space deliberately. Verify behavior under scaled/rotated parents and camera-relative rendering.
- Gate collisions, lighting, mesh sampling, strips, and Shader Graph features by pipeline/platform support.
- Pool frequently reused VisualEffect components and reset events/properties on reuse.
- For gameplay-critical feedback, provide a fallback when VFX Graph or compute shaders are unsupported.
- Validate edit mode and play mode, camera stacking/XR where relevant, quality tiers, pause/time scale, scene unload, and domain reload.
