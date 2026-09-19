# Proven Case Patterns

## Screw puzzle / WeChat Cocos export

Observed pattern:

- playable origin differed from the portal URL;
- a WeChat adapter and portal SDK required browser shims;
- a toast queue used recursive microtasks before the scene existed, starving the event loop and producing a black screen;
- the partial mirror booted level 1 but contained only a subset of native assets;
- painting frames/icons and many level imports were absent because runtime-only downloading never traversed the full manifest.

Reliable fix:

- replace scene-wait microtask recursion with timer polling;
- use a minimal local portal SDK stub;
- resolve all Cocos import/native pairs from every manifest;
- verify painting/reward UI directly;
- use the game’s existing debug level hook to test early/mid/late levels;
- require zero local failures and zero unintended external requests.

General lesson: “first gameplay renders” is a boot milestone, not a completeness milestone.

## Girl Rescue / GameDistribution Cocos export

Observed pattern:

- portal page resolved to a GameDistribution build root;
- Cocos bundles lived under `assets/*`, not `subpackages/*`;
- level art also came from a separate external asset repository;
- a known-file baseline could seed fetching, but manifest closure was still required to prove completeness.

Reliable fix:

- map build origin and external asset repository to separate local prefixes;
- re-fetch payloads from live origins and record SHA-256;
- scan every `config.<hash>.json` below the mirror;
- resolve import/native assets with type-aware extension probing;
- verify representative levels and dynamic level-art requests.

General lesson: preserve origin mapping. Flattening external repositories hides collisions and makes later URL rewriting unreliable.

## Shared completion signals

- manifest missing count is zero;
- no saved asset is an HTML error page;
- clean local run reaches gameplay;
- reward/lazy screen renders;
- early, mid, and late levels load;
- Console has no blocking exception;
- Network has zero failed request;
- external requests are zero or explicitly allowed and justified.

