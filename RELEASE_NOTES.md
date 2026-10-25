Folder Node Size 1.0.5

- Fix recurring node-size flashes during the built-in graph animation: native graph data updates reset weights at each step, so known plugin sizes are now restored in the same task before the next frame.
- Give newly revealed nodes their folder/manual sizes immediately. New automatic nodes still use the scheduled calculation.
- Preserve visible sizes when animation invalidates an in-progress calculation, instead of repeatedly rolling them back to native sizes.
- Restore the latest native weights and remove the renderer observer on unload or graph closure; preserve wrappers installed afterward by other plugins.
- Keep the existing polling interval. No full automatic tree calculation runs inside the animation observer.

Validation: 56 automated tests, including a regression that fails on 1.0.4 and verifies 120 consecutive simulated animation steps after the fix. Build and lint pass. The reset behavior was checked against the official Obsidian 1.14.5 desktop distribution; the actual UI and mobile runtime were not available in the test environment. Please retest the built-in animation on MacBook and iPhone.

Update through BRAT and restart Obsidian. Existing rules remain compatible. Community directory publication remains deferred at the maintainer's request. The full graph performance report in benchmarks/REPORT.md describes 1.0.4, not this animation fix.
