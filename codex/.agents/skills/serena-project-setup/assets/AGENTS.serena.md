<!-- serena-project-setup:start -->
## Serena

Use Serena only for semantic source edits and refactors after the exact targets are known. When Serena MCP tools are available for an edit, resolve the canonical repository root, activate that absolute path unless already active, and read Serena's instructions before modifying code. Use CodeGraph first for known symbols and structural relationships. For vague behavior or unknown identifiers, use CocoIndex Code semantic search to find candidate symbols, then inspect their real connections with CodeGraph. Fall back to built-in read/search tools when those indexes are unavailable. Do not use Serena as the ordinary code reader. If Serena is unavailable, continue with built-in editing tools and do not install or reconfigure it unless the current task is agent setup.
<!-- serena-project-setup:end -->
