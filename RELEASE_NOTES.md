Folder Node Size 1.0.1

- Cache weights per graph and refresh on settings, file and metadata changes.
- Coalesce events and pause graph work while the app document is hidden.
- Check for new/replaced nodes every two seconds without recalculating unchanged weights.
- Validate renderer/node shapes; skip incompatible graphs with a single notice.
- Restore original weights when a renderer update fails and avoid repeated failures.
- Replace recursive link-tree traversal with an iterative cycle-safe traversal.
- Existing folder rules and exceptions remain in data.json; no migration is required.

Validated with build, lint and automated tests, including a 12,000-node chain. Actual battery use and behavior on iPhone/Android/desktop still need device testing. The plugin continues to depend on Obsidian's internal graph API.

Update through BRAT, then reload the plugin or restart Obsidian.
