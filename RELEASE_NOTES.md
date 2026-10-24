Folder Node Size 1.0.2

Reliability and performance improvements:
- Validate saved settings, ignore invalid entries and preserve valid legacy rules.
- Pause loading if settings cannot be read, preventing accidental replacement of unreadable data.
- Serialize settings writes using independent snapshots; report save failures and allow retry.
- Index folder and note rules; avoid scanning and sorting every rule for every node.
- Avoid constructing rule indexes during unchanged graph checks and remove link-key sorting.
- Isolate renderer getter failures; restore and release nodes removed from graphs.

Synthetic benchmark: 5,000 rules applied to 5,000 paths took 1,999 ms with the previous rule lookup and 3.6 ms with the index, including construction, on the cloud runner. Results match. This measures rule lookup only, not complete graph rendering or iPhone battery use.

Build, lint and automated regression tests pass. Graph topology scanning and optional full link-tree calculation still have costs on large graphs. Obsidian's graph API is internal; real-device compatibility cannot be guaranteed by these tests.

Update via BRAT and restart Obsidian. No settings migration is required.
