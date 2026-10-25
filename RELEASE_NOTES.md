Folder Node Size 1.0.3

- Fast path for manual and folder sizes: skip content reads and link enumeration when not needed by an automatic tree ancestor.
- Text edits invalidate only the changed note; metadata resolution no longer clears every cached weight.
- Rule edits update only effective size changes; automatic parameter changes refresh automatic nodes.
- Detect link-count changes selectively in normal mode and propagate tree changes through old/new ancestors, including off-screen descendants.
- Preserve weights across renderer node replacement; maintain separate caches for global/local graphs.
- Include reproducible before/after graph benchmarks for 1,000, 5,000 and 10,000 nodes, covering timing, longest synchronous updates, memory and result equality.

See benchmarks/REPORT.md in the repository for measurements and tradeoffs. Fully automatic tree-mode idle checks are more expensive in the measured workload, while note/rule updates are much faster; first tree calculations remain costly. Benchmarks use a Node host simulation, not a real Obsidian UI. Full automatic tree traversal remains costly on first load; strongly connected graphs may be much more expensive than the topic-cluster fixtures.

Update through BRAT and restart Obsidian. Existing settings remain compatible. Submission to the official community catalog remains pending device testing.
