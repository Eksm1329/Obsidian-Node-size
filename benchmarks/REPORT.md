# Graph performance comparison

Baseline: commit `289f73730eeb153cb2c27584bbea673ab450939c` (1.0.3 code). Candidate bundle SHA-256: `6592116ff1ecfabbb7223429ea7a544b1538983baa79398b472de8be685b2b79`.

Host: linux x64, Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz; Node v24.19.0. 3 independent repetitions for each size, mode, profile and version, with alternating version order. All resulting node weights matched the baseline after every scenario, and unload restored the original weights.

## Method and limits

Run `node scripts/benchmark-graphs.cjs`, then `node scripts/report-graphs.cjs`. Baseline sources are extracted from Git; both versions are built with the same installed toolchain. The baseline commit must exist locally (use a full clone). Each run uses a fresh Node process with explicit GC before scenarios. No production vault or user content is read.

Graphs contain 1,000, 5,000 or 10,000 notes, topic folders of up to 64 notes, cycles, local links, hub notes, and sparse cross-topic links joining pairs of topics. These are deterministic synthetic graphs modeled on note vaults, **not captured real vaults**. They do not cover all graph shapes. Cycles share cached component counts, but a long acyclic graph can still approach quadratic reachability cost.

Profiles: **folders** assigns every folder a fixed weight; **mixed** assigns 80% of topic folders fixed weights; **automatic** starts without fixed rules. Both modes include content-size and incoming-link weights; **tree** additionally traverses reachable descendants. A note edit changes file size; folder edit changes or adds a rule for the first topic; link edit adds a cross-topic edge. The idle scenario runs ten sequential checks while advancing the plugin audit clock by two seconds each time. This includes periodic deep audits across 20 simulated seconds, without actually waiting 20 seconds between calls.

The harness loads the actual bundled plugin with mocked Obsidian host APIs. File metadata access is in memory, saving and redraw notifications are stubs. **No Obsidian UI, renderer physics, GPU rendering, disk I/O, iPhone or macOS measurements are included.** Total elapsed time includes the scenario's callbacks/microtasks. Maximum synchronous time measures the longest scheduler slice in the new version and the whole synchronous update in 1.0.3. Cooperative yields use real Node timers. CPU time is the sum of measured synchronous calls (not OS process CPU accounting); total elapsed time also includes waiting between slices. These are proxies for JS event-loop blocking, **not measured UI freezes**. The 150 ms event debounce is deliberately flushed, not included in timings.

Heap growth is the change in V8 heap usage across the scenario before forced GC (can include garbage, and is not total allocations or a peak). Retained heap is the post-GC difference from the pre-first-update baseline, which already includes the graph and harness. Process peak RSS is the OS high-water mark for the entire worker process, including the fixture and runtime; it cannot be attributed solely to the plugin or one scenario. Raw measurements, content-read counts and equality digests are in [graphs.json](graphs.json).

## Median total processing time (milliseconds)

Each cell is **before → after**. Idle is the total of ten checks.

| Nodes | Mode | Profile | First | Idle ×10 | Note edit | Folder edit | Link edit |
|---:|---|---|---:|---:|---:|---:|---:|
| 1000 | normal | folders | 3.57 → 7.30 | 20.08 → 28.61 | 2.39 → 3.80 | 2.90 → 3.53 | 1.98 → 3.43 |
| 1000 | normal | mixed | 4.22 → 7.79 | 20.94 → 44.91 | 2.29 → 3.43 | 2.81 → 3.78 | 2.44 → 2.90 |
| 1000 | normal | automatic | 10.30 → 13.86 | 41.53 → 43.38 | 4.17 → 6.10 | 6.45 → 6.50 | 4.46 → 3.46 |
| 1000 | tree | folders | 5.56 → 7.94 | 35.43 → 35.70 | 2.31 → 5.32 | 2.96 → 8.39 | 2.30 → 7.10 |
| 1000 | tree | mixed | 144.86 → 33.37 | 46.17 → 93.76 | 4.79 → 11.46 | 5.45 → 12.31 | 4.53 → 5.97 |
| 1000 | tree | automatic | 586.64 → 69.12 | 109.70 → 126.85 | 8.55 → 8.89 | 9.04 → 17.65 | 7.01 → 19.97 |
| 5000 | normal | folders | 16.39 → 23.41 | 100.46 → 275.74 | 11.75 → 19.96 | 9.22 → 21.50 | 8.16 → 14.56 |
| 5000 | normal | mixed | 17.62 → 39.81 | 88.62 → 183.26 | 9.35 → 22.27 | 11.06 → 20.80 | 8.47 → 17.08 |
| 5000 | normal | automatic | 26.09 → 43.26 | 116.12 → 175.24 | 14.04 → 21.55 | 17.63 → 21.70 | 11.37 → 18.16 |
| 5000 | tree | folders | 14.08 → 28.51 | 93.47 → 160.26 | 9.25 → 18.94 | 13.05 → 20.33 | 8.52 → 13.61 |
| 5000 | tree | mixed | 441.51 → 74.81 | 131.72 → 195.87 | 15.06 → 24.01 | 19.04 → 39.38 | 15.34 → 17.34 |
| 5000 | tree | automatic | 2413.45 → 150.32 | 254.84 → 332.77 | 24.97 → 29.32 | 35.58 → 78.59 | 26.37 → 70.58 |
| 10000 | normal | folders | 22.05 → 38.52 | 154.35 → 240.15 | 16.77 → 30.23 | 21.13 → 30.12 | 16.58 → 23.53 |
| 10000 | normal | mixed | 28.15 → 46.18 | 169.53 → 265.25 | 19.28 → 33.60 | 22.73 → 34.33 | 15.67 → 29.21 |
| 10000 | normal | automatic | 50.41 → 71.93 | 221.25 → 347.57 | 24.34 → 40.58 | 28.27 → 42.66 | 22.18 → 38.20 |
| 10000 | tree | folders | 25.68 → 45.16 | 194.72 → 303.33 | 20.25 → 35.75 | 21.87 → 38.41 | 18.69 → 28.93 |
| 10000 | tree | mixed | 854.66 → 128.33 | 295.17 → 439.35 | 32.04 → 44.71 | 38.91 → 75.89 | 25.57 → 42.49 |
| 10000 | tree | automatic | 3983.01 → 299.85 | 530.73 → 617.77 | 48.37 → 60.14 | 65.56 → 167.41 | 59.36 → 120.11 |

## Longest synchronous update and retained cache memory

Maximum synchronous update is the **maximum across all repetitions and all five scenarios**, not a median. Memory is the median retained heap difference after the first update.

| Nodes | Mode | Profile | Max synchronous ms, before → after | Retained MiB, before → after |
|---:|---|---|---:|---:|
| 1000 | normal | folders | 4.80 → 5.51 | 0.22 → 0.25 |
| 1000 | normal | mixed | 7.39 → 10.89 | 0.28 → 0.30 |
| 1000 | normal | automatic | 12.97 → 6.32 | 0.44 → 0.46 |
| 1000 | tree | folders | 11.45 → 5.50 | 0.22 → 0.24 |
| 1000 | tree | mixed | 196.42 → 19.22 | 0.36 → 0.46 |
| 1000 | tree | automatic | 913.31 → 9.52 | 0.57 → 0.78 |
| 5000 | normal | folders | 19.48 → 110.05 | 1.09 → 1.12 |
| 5000 | normal | mixed | 24.57 → 14.54 | 1.32 → 1.34 |
| 5000 | normal | automatic | 28.89 → 4.83 | 2.12 → 2.32 |
| 5000 | tree | folders | 24.33 → 5.38 | 1.10 → 1.12 |
| 5000 | tree | mixed | 480.38 → 17.00 | 1.56 → 1.86 |
| 5000 | tree | automatic | 3225.75 → 213.23 | 2.74 → 3.65 |
| 10000 | normal | folders | 23.25 → 5.67 | 2.15 → 2.18 |
| 10000 | normal | mixed | 31.71 → 4.81 | 2.57 → 2.61 |
| 10000 | normal | automatic | 52.89 → 4.62 | 4.17 → 4.23 |
| 10000 | tree | folders | 30.66 → 7.40 | 2.15 → 2.19 |
| 10000 | tree | mixed | 915.10 → 4.82 | 3.04 → 3.61 |
| 10000 | tree | automatic | 4280.45 → 7.80 | 5.39 → 7.10 |

## Per-scenario timing and memory

Median of each metric across independent repetitions, before → after. These are separate metric medians, not necessarily the same run. Peak RSS is cumulative within each worker.

| Nodes | Mode | Profile | Scenario | Max sync ms | CPU ms | Slices | Heap growth MiB | Retained MiB | Process peak RSS MiB |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|
| 1000 | normal | folders | first | 3.49 → 4.19 | 3.49 → 5.60 | 1.00 → 2.00 | 0.68 → 0.93 | 0.22 → 0.25 | 34.00 → 35.25 |
| 1000 | normal | folders | idle | 2.97 → 3.61 | 19.96 → 28.35 | 10.00 → 10.00 | 1.54 → 1.65 | 0.27 → 0.35 | 37.86 → 42.25 |
| 1000 | normal | folders | note-edit | 2.13 → 3.38 | 2.13 → 3.38 | 1.00 → 1.00 | 0.35 → 0.56 | 0.25 → 0.31 | 39.36 → 42.38 |
| 1000 | normal | folders | folder-edit | 2.11 → 2.88 | 2.11 → 2.88 | 1.00 → 1.00 | 0.42 → 0.62 | 0.26 → 0.30 | 41.11 → 42.38 |
| 1000 | normal | folders | link-edit | 1.91 → 3.35 | 1.91 → 3.35 | 1.00 → 1.00 | 0.34 → 0.55 | 0.26 → 0.32 | 41.11 → 42.39 |
| 1000 | normal | mixed | first | 4.15 → 4.23 | 4.15 → 7.19 | 1.00 → 2.00 | 0.84 → 1.08 | 0.28 → 0.30 | 34.13 → 34.75 |
| 1000 | normal | mixed | idle | 3.52 → 5.21 | 20.83 → 39.45 | 10.00 → 15.00 | 1.88 → 0.36 | 0.33 → 0.42 | 38.28 → 42.01 |
| 1000 | normal | mixed | note-edit | 2.05 → 3.04 | 2.05 → 3.04 | 1.00 → 1.00 | 0.38 → 0.59 | 0.30 → 0.34 | 40.38 → 42.01 |
| 1000 | normal | mixed | folder-edit | 2.02 → 3.04 | 2.02 → 3.04 | 1.00 → 1.00 | 0.44 → 0.64 | 0.32 → 0.36 | 41.50 → 42.19 |
| 1000 | normal | mixed | link-edit | 2.36 → 2.62 | 2.36 → 2.62 | 1.00 → 1.00 | 0.39 → 0.61 | 0.34 → 0.40 | 41.50 → 42.57 |
| 1000 | normal | automatic | first | 10.22 → 5.08 | 10.22 → 11.05 | 1.00 → 3.00 | 1.29 → 1.53 | 0.44 → 0.46 | 34.88 → 36.00 |
| 1000 | normal | automatic | idle | 6.50 → 5.23 | 41.35 → 40.44 | 10.00 → 13.00 | 0.92 → 1.27 | 0.49 → 0.57 | 38.87 → 41.99 |
| 1000 | normal | automatic | note-edit | 3.91 → 4.07 | 3.91 → 4.24 | 1.00 → 2.00 | 0.49 → 0.71 | 0.46 → 0.50 | 39.90 → 41.99 |
| 1000 | normal | automatic | folder-edit | 5.56 → 4.15 | 5.56 → 4.58 | 1.00 → 2.00 | 0.57 → 0.76 | 0.47 → 0.51 | 40.90 → 42.09 |
| 1000 | normal | automatic | link-edit | 4.39 → 3.33 | 4.39 → 3.33 | 1.00 → 1.00 | 0.51 → 0.71 | 0.49 → 0.55 | 41.90 → 42.13 |
| 1000 | tree | folders | first | 5.44 → 4.31 | 5.44 → 5.96 | 1.00 → 2.00 | 0.80 → 1.06 | 0.22 → 0.24 | 34.13 → 34.38 |
| 1000 | tree | folders | idle | 7.55 → 4.34 | 35.30 → 34.02 | 10.00 → 12.00 | 0.49 → 1.19 | 0.27 → 0.36 | 42.64 → 41.93 |
| 1000 | tree | folders | note-edit | 2.13 → 4.03 | 2.13 → 4.03 | 1.00 → 1.00 | 0.44 → 0.69 | 0.26 → 0.32 | 42.64 → 42.18 |
| 1000 | tree | folders | folder-edit | 2.26 → 4.12 | 2.26 → 5.45 | 1.00 → 2.00 | 0.52 → 0.76 | 0.26 → 0.29 | 42.64 → 42.18 |
| 1000 | tree | folders | link-edit | 2.23 → 4.29 | 2.23 → 5.77 | 1.00 → 2.00 | 0.43 → 0.72 | 0.26 → 0.37 | 42.64 → 42.93 |
| 1000 | tree | mixed | first | 144.78 → 4.74 | 144.78 → 25.54 | 1.00 → 6.00 | 2.28 → 1.47 | 0.36 → 0.46 | 40.20 → 39.97 |
| 1000 | tree | mixed | idle | 6.84 → 6.27 | 46.03 → 65.00 | 10.00 → 20.00 | 1.80 → 2.18 | 0.44 → 0.76 | 44.34 → 43.29 |
| 1000 | tree | mixed | note-edit | 4.55 → 4.99 | 4.55 → 9.84 | 1.00 → 2.00 | 0.79 → 0.84 | 0.42 → 0.64 | 44.46 → 43.29 |
| 1000 | tree | mixed | folder-edit | 4.37 → 4.10 | 4.37 → 8.83 | 1.00 → 3.00 | 1.06 → 1.66 | 0.37 → 0.58 | 44.46 → 43.29 |
| 1000 | tree | mixed | link-edit | 4.39 → 4.07 | 4.39 → 4.68 | 1.00 → 2.00 | 0.65 → 0.87 | 0.39 → 0.65 | 44.46 → 43.33 |
| 1000 | tree | automatic | first | 586.43 → 8.10 | 586.43 → 53.49 | 1.00 → 12.00 | 2.71 → 2.31 | 0.57 → 0.78 | 40.91 → 42.00 |
| 1000 | tree | automatic | idle | 19.35 → 6.49 | 109.30 → 103.44 | 10.00 → 28.00 | 3.86 → 2.55 | 0.64 → 1.22 | 47.00 → 47.46 |
| 1000 | tree | automatic | note-edit | 8.10 → 4.10 | 8.10 → 7.51 | 1.00 → 2.00 | 1.31 → 1.02 | 0.63 → 1.18 | 47.61 → 47.59 |
| 1000 | tree | automatic | folder-edit | 8.37 → 4.11 | 8.37 → 14.19 | 1.00 → 4.00 | 2.32 → 3.41 | 0.59 → 0.92 | 47.61 → 47.96 |
| 1000 | tree | automatic | link-edit | 6.86 → 4.14 | 6.86 → 15.99 | 1.00 → 4.00 | 1.29 → 3.22 | 0.63 → 1.04 | 47.61 → 48.95 |
| 5000 | normal | folders | first | 16.25 → 4.74 | 16.25 → 19.39 | 1.00 → 5.00 | 3.68 → 4.72 | 1.09 → 1.12 | 50.27 → 52.45 |
| 5000 | normal | folders | idle | 13.41 → 60.12 | 100.26 → 221.52 | 10.00 → 43.00 | 8.88 → 7.16 | 1.15 → 1.25 | 61.05 → 62.87 |
| 5000 | normal | folders | note-edit | 11.44 → 4.16 | 11.44 → 15.83 | 1.00 → 4.00 | 1.83 → 2.88 | 1.13 → 1.26 | 61.28 → 62.87 |
| 5000 | normal | folders | folder-edit | 8.44 → 4.25 | 8.44 → 15.69 | 1.00 → 4.00 | 2.09 → 3.13 | 1.17 → 1.25 | 61.46 → 62.87 |
| 5000 | normal | folders | link-edit | 8.06 → 4.30 | 8.06 → 12.06 | 1.00 → 3.00 | 1.83 → 2.83 | 1.17 → 1.29 | 61.46 → 62.87 |
| 5000 | normal | mixed | first | 17.51 → 5.34 | 17.51 → 34.30 | 1.00 → 6.00 | 4.40 → 5.36 | 1.32 → 1.34 | 52.05 → 52.50 |
| 5000 | normal | mixed | idle | 11.63 → 5.56 | 88.49 → 136.28 | 10.00 → 39.00 | 1.88 → 6.33 | 1.37 → 1.47 | 61.85 → 64.65 |
| 5000 | normal | mixed | note-edit | 9.17 → 4.15 | 9.17 → 17.32 | 1.00 → 5.00 | 1.98 → 3.09 | 1.34 → 1.45 | 62.73 → 64.65 |
| 5000 | normal | mixed | folder-edit | 10.16 → 4.22 | 10.16 → 16.33 | 1.00 → 4.00 | 2.28 → 3.24 | 1.40 → 1.48 | 62.76 → 64.65 |
| 5000 | normal | mixed | link-edit | 8.39 → 4.10 | 8.39 → 14.62 | 1.00 → 4.00 | 1.96 → 2.94 | 1.39 → 1.48 | 62.76 → 64.65 |
| 5000 | normal | automatic | first | 26.02 → 4.33 | 26.02 → 33.70 | 1.00 → 9.00 | 6.55 → 7.69 | 2.12 → 2.32 | 52.76 → 54.27 |
| 5000 | normal | automatic | idle | 14.29 → 4.17 | 115.95 → 141.23 | 10.00 → 41.00 | 7.65 → 6.70 | 2.17 → 2.26 | 62.18 → 63.39 |
| 5000 | normal | automatic | note-edit | 13.66 → 4.12 | 13.66 → 16.74 | 1.00 → 5.00 | 2.58 → 3.63 | 2.16 → 2.29 | 64.25 → 63.39 |
| 5000 | normal | automatic | folder-edit | 16.79 → 4.09 | 16.79 → 16.23 | 1.00 → 5.00 | 2.83 → 3.84 | 2.18 → 2.27 | 64.25 → 63.39 |
| 5000 | normal | automatic | link-edit | 11.30 → 4.10 | 11.30 → 15.73 | 1.00 → 4.00 | 2.51 → 3.51 | 2.18 → 2.27 | 64.25 → 63.39 |
| 5000 | tree | folders | first | 14.01 → 4.25 | 14.01 → 22.27 | 1.00 → 6.00 | 4.33 → 5.75 | 1.10 → 1.12 | 50.78 → 53.11 |
| 5000 | tree | folders | idle | 12.96 → 4.42 | 93.34 → 130.15 | 10.00 → 36.00 | 5.87 → 7.10 | 1.15 → 1.25 | 62.21 → 63.23 |
| 5000 | tree | folders | note-edit | 9.00 → 4.19 | 9.00 → 15.15 | 1.00 → 4.00 | 2.51 → 3.71 | 1.13 → 1.22 | 62.21 → 63.23 |
| 5000 | tree | folders | folder-edit | 12.03 → 4.13 | 12.03 → 15.92 | 1.00 → 4.00 | 2.73 → 3.99 | 1.17 → 1.26 | 62.21 → 63.23 |
| 5000 | tree | folders | link-edit | 8.44 → 4.11 | 8.44 → 11.84 | 1.00 → 3.00 | 2.51 → 3.66 | 1.18 → 1.30 | 62.21 → 63.23 |
| 5000 | tree | mixed | first | 441.41 → 4.56 | 441.41 → 59.51 | 1.00 → 15.00 | 6.26 → 8.62 | 1.56 → 1.86 | 60.53 → 58.54 |
| 5000 | tree | mixed | idle | 17.50 → 4.27 | 131.58 → 157.10 | 10.00 → 45.00 | 4.02 → 8.60 | 1.66 → 2.47 | 63.32 → 65.77 |
| 5000 | tree | mixed | note-edit | 14.79 → 4.16 | 14.79 → 19.04 | 1.00 → 5.00 | 3.83 → 4.57 | 1.63 → 2.46 | 63.32 → 67.84 |
| 5000 | tree | mixed | folder-edit | 17.23 → 4.13 | 17.23 → 30.32 | 1.00 → 8.00 | 5.48 → 8.42 | 1.62 → 2.11 | 63.32 → 67.84 |
| 5000 | tree | mixed | link-edit | 15.22 → 4.27 | 15.22 → 13.92 | 1.00 → 4.00 | 3.73 → 4.42 | 1.61 → 2.10 | 63.51 → 67.84 |
| 5000 | tree | automatic | first | 2413.35 → 4.71 | 2413.35 → 118.23 | 1.00 → 29.00 | 11.83 → 9.67 | 2.74 → 3.65 | 63.75 → 63.98 |
| 5000 | tree | automatic | idle | 33.47 → 5.95 | 254.66 → 260.90 | 10.00 → 70.00 | 20.26 → 11.83 | 2.82 → 5.45 | 88.20 → 83.00 |
| 5000 | tree | automatic | note-edit | 24.79 → 4.21 | 24.79 → 24.11 | 1.00 → 6.00 | 5.68 → 5.57 | 2.78 → 5.42 | 88.20 → 83.24 |
| 5000 | tree | automatic | folder-edit | 34.84 → 4.77 | 34.84 → 62.00 | 1.00 → 16.00 | 11.51 → 6.75 | 2.78 → 4.00 | 88.20 → 83.24 |
| 5000 | tree | automatic | link-edit | 26.29 → 4.11 | 26.29 → 55.43 | 1.00 → 14.00 | 6.90 → 3.18 | 2.84 → 4.37 | 88.20 → 83.26 |
| 10000 | normal | folders | first | 21.97 → 4.50 | 21.97 → 30.09 | 1.00 → 8.00 | 7.11 → 9.23 | 2.15 → 2.18 | 62.46 → 62.48 |
| 10000 | normal | folders | idle | 17.99 → 4.29 | 154.20 → 192.99 | 10.00 → 54.00 | 3.49 → 9.07 | 2.20 → 2.30 | 71.61 → 72.00 |
| 10000 | normal | folders | note-edit | 16.53 → 4.17 | 16.53 → 24.24 | 1.00 → 6.00 | 3.65 → 5.63 | 2.18 → 2.31 | 71.61 → 72.00 |
| 10000 | normal | folders | folder-edit | 19.91 → 4.12 | 19.91 → 23.43 | 1.00 → 6.00 | 4.10 → 6.12 | 2.20 → 2.35 | 71.61 → 72.00 |
| 10000 | normal | folders | link-edit | 16.47 → 4.14 | 16.47 → 18.91 | 1.00 → 5.00 | 3.66 → 5.51 | 2.21 → 2.35 | 71.61 → 72.00 |
| 10000 | normal | mixed | first | 28.06 → 4.43 | 28.06 → 36.79 | 1.00 → 9.00 | 8.40 → 10.32 | 2.57 → 2.61 | 62.01 → 62.77 |
| 10000 | normal | mixed | idle | 20.89 → 4.19 | 169.38 → 215.14 | 10.00 → 57.00 | 6.07 → 4.37 | 2.61 → 2.73 | 71.85 → 71.14 |
| 10000 | normal | mixed | note-edit | 19.05 → 4.17 | 19.05 → 26.57 | 1.00 → 7.00 | 3.96 → 5.98 | 2.60 → 2.71 | 71.85 → 71.14 |
| 10000 | normal | mixed | folder-edit | 21.87 → 4.15 | 21.87 → 26.85 | 1.00 → 7.00 | 4.40 → 6.31 | 2.66 → 2.73 | 71.85 → 71.14 |
| 10000 | normal | mixed | link-edit | 15.58 → 4.11 | 15.58 → 23.37 | 1.00 → 6.00 | 3.89 → 5.85 | 2.66 → 2.77 | 71.85 → 71.14 |
| 10000 | normal | automatic | first | 50.32 → 4.34 | 50.32 → 56.84 | 1.00 → 14.00 | 5.73 → 8.92 | 4.17 → 4.23 | 63.02 → 63.49 |
| 10000 | normal | automatic | idle | 27.87 → 4.61 | 221.09 → 277.32 | 10.00 → 73.00 | 8.79 → 3.86 | 4.20 → 4.32 | 72.21 → 71.46 |
| 10000 | normal | automatic | note-edit | 24.11 → 4.16 | 24.11 → 32.52 | 1.00 → 9.00 | 5.11 → 7.12 | 4.20 → 4.34 | 72.21 → 71.46 |
| 10000 | normal | automatic | folder-edit | 27.55 → 4.12 | 27.55 → 33.11 | 1.00 → 9.00 | 5.62 → 7.55 | 4.24 → 4.32 | 72.73 → 71.46 |
| 10000 | normal | automatic | link-edit | 22.05 → 4.09 | 22.05 → 30.11 | 1.00 → 8.00 | 5.08 → 6.91 | 4.23 → 4.32 | 72.73 → 71.46 |
| 10000 | tree | folders | first | 25.60 → 4.30 | 25.60 → 36.62 | 1.00 → 9.00 | 8.48 → 3.25 | 2.15 → 2.19 | 62.09 → 63.05 |
| 10000 | tree | folders | idle | 26.28 → 4.36 | 194.41 → 242.07 | 10.00 → 65.00 | 11.58 → 15.86 | 2.19 → 2.30 | 72.73 → 82.97 |
| 10000 | tree | folders | note-edit | 20.05 → 4.16 | 20.05 → 28.82 | 1.00 → 7.00 | 4.98 → 7.32 | 2.19 → 2.27 | 72.73 → 82.97 |
| 10000 | tree | folders | folder-edit | 20.98 → 4.12 | 20.98 → 29.56 | 1.00 → 8.00 | 5.35 → 7.79 | 2.21 → 2.35 | 72.73 → 82.97 |
| 10000 | tree | folders | link-edit | 18.57 → 4.11 | 18.57 → 23.19 | 1.00 → 6.00 | 4.99 → 7.22 | 2.21 → 2.35 | 72.73 → 82.97 |
| 10000 | tree | mixed | first | 854.56 → 4.29 | 854.56 → 100.42 | 1.00 → 25.00 | 10.32 → 10.80 | 3.04 → 3.61 | 68.27 → 67.75 |
| 10000 | tree | mixed | idle | 35.53 → 4.52 | 294.98 → 347.18 | 10.00 → 91.00 | 12.03 → 13.92 | 3.12 → 4.75 | 90.82 → 91.98 |
| 10000 | tree | mixed | note-edit | 31.78 → 4.16 | 31.78 → 35.78 | 1.00 → 9.00 | 7.59 → 8.69 | 3.11 → 4.74 | 90.82 → 91.98 |
| 10000 | tree | mixed | folder-edit | 37.80 → 4.14 | 37.80 → 59.04 | 1.00 → 15.00 | 11.29 → 16.30 | 3.14 → 3.88 | 90.82 → 91.98 |
| 10000 | tree | mixed | link-edit | 25.44 → 4.13 | 25.44 → 33.20 | 1.00 → 9.00 | 6.56 → 8.55 | 3.12 → 3.96 | 90.82 → 91.98 |
| 10000 | tree | automatic | first | 3982.91 → 5.37 | 3982.91 → 232.56 | 1.00 → 57.00 | 17.79 → 21.47 | 5.39 → 7.10 | 88.91 → 88.63 |
| 10000 | tree | automatic | idle | 67.93 → 4.49 | 530.42 → 489.28 | 10.00 → 125.00 | 40.45 → 39.03 | 5.43 → 10.49 | 129.58 → 125.64 |
| 10000 | tree | automatic | note-edit | 48.14 → 4.32 | 48.14 → 48.07 | 1.00 → 12.00 | 11.00 → 10.54 | 5.43 → 10.47 | 129.58 → 125.64 |
| 10000 | tree | automatic | folder-edit | 64.73 → 4.61 | 64.73 → 128.63 | 1.00 → 32.00 | 22.35 → 11.18 | 5.43 → 7.79 | 129.58 → 125.64 |
| 10000 | tree | automatic | link-edit | 59.23 → 4.20 | 59.23 → 95.01 | 1.00 → 24.00 | 13.46 → 4.96 | 5.49 → 8.32 | 129.58 → 125.64 |

## Observed tradeoffs

At 10,000 nodes with fully automatic tree sizing, first completion was 3983.01 → 299.85 ms; the median longest synchronous slice was 3982.91 → 5.37 ms. Ten idle checks (including periodic audits) cost 530.42 → 489.28 ms of synchronous processing. Retained heap after first completion was 5.39 → 7.10 MiB.

The 4 ms scheduling budget is soft: GC, native operations and host contention can exceed it. Exact topology audits occur on metadata/layout changes, detected degree/reference changes, and at the next active poll after 10 seconds have elapsed since the previous audit (normally about 10–12 seconds, plus scheduling delays). Silent same-degree changes without metadata events can therefore take until the next audit to update. Normal Obsidian metadata events request an update immediately through the existing debounce. Some non-tree and subsequent updates take longer overall because scheduling and generator bookkeeping add overhead. The largest observed candidate slice across the full matrix was 213.23 ms; the budget does not eliminate every long task. Three repetitions are not enough for statistical significance or device-specific guarantees.

## Device follow-up

On a separate test vault in desktop Obsidian, record a Performance trace for opening the graph, 20 seconds idle, editing a note and changing one folder rule. Compare the longest main-thread tasks, JS heap after GC and frame responsiveness with the baseline. Use identical graph filters, node counts and link-tree settings, and disable unrelated plugins. This is still required to measure actual UI stalls. iPhone battery and responsiveness testing remains separate.
