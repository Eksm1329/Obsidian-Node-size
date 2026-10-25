Folder Node Size 1.0.4

- Split graph updates into scheduled portions with a soft 4 ms budget, so other event-loop work can run between portions.
- Reuse exact descendant counts for nodes in the same strongly connected component; preserve unique descendant counting across overlapping paths.
- Audit tree topology on metadata/layout events, detected degree/reference changes, and periodically after 10 seconds have elapsed. Silent same-degree changes without events can wait until the next audit.
- Cancel stale calculations on edits, hiding the app, or unloading; restore partially applied sizes and retry replaced renderers safely.
- Add cancellation, cyclic-graph correctness and audit regression tests (47 total).

On the synthetic 10,000-node automatic-tree fixture, median first completion improved from 3,983 ms to 300 ms. Median longest first-calculation slice improved from 3,983 ms to 5.37 ms. Ten idle checks used 530 ms versus 489 ms of synchronous processing; elapsed idle-check time increased from 531 ms to 618 ms. Retained heap after the first calculation increased from 5.39 MiB to 7.10 MiB.

These are Node host simulation results, not real Obsidian or iPhone UI measurements. Scheduling adds overhead, some subsequent updates are slower, and the 4 ms budget is not a hard limit: the largest observed candidate slice across the complete matrix was 213 ms. Long acyclic graphs can still be expensive. See benchmarks/REPORT.md for all timings, memory figures and limitations; all 540 before/after scenario samples preserved matching weights.

Update through BRAT and restart Obsidian. Existing settings remain compatible. Submission to the official community catalog remains pending MacBook testing.
