# Graph performance comparison

Baseline: commit `a956f01463837cc1897f169c99085fcf5779f273` (1.0.2 code). Candidate bundle SHA-256: `0a887110c20f56594153cb9c0fd2ec1a37fcd4f147554e690b24418168138c71`.

Host: linux x64, Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz; Node v24.19.0. 3 independent repetitions for each size, mode, profile and version, with alternating version order. All resulting node weights matched the baseline after every scenario, and unload restored the original weights.

## Method and limits

Run `node scripts/benchmark-graphs.cjs`, then `node scripts/report-graphs.cjs`. Baseline sources are extracted from Git; both versions are built with the same installed toolchain. The baseline commit must exist locally (use a full clone). Each run uses a fresh Node process with explicit GC before scenarios. No production vault or user content is read.

Graphs contain 1,000, 5,000 or 10,000 notes, topic folders of up to 64 notes, cycles, local links, hub notes, and sparse cross-topic links joining pairs of topics. These are deterministic synthetic graphs modeled on note vaults, **not captured real vaults**. They do not represent the worst case of one giant strongly connected graph. Full tree calculation on such a graph can still approach quadratic cost.

Profiles: **folders** assigns every folder a fixed weight; **mixed** assigns 80% of topic folders fixed weights; **automatic** starts without fixed rules. Both modes include content-size and incoming-link weights; **tree** additionally traverses reachable descendants. A note edit changes file size; folder edit changes or adds a rule for the first topic; link edit adds a cross-topic edge. The idle scenario runs ten consecutive checks to sample the calculation cost, not a timed 20-second idle session.

The harness loads the actual bundled plugin with mocked Obsidian host APIs. File metadata access is in memory, saving and redraw notifications are stubs. **No Obsidian UI, renderer physics, GPU rendering, disk I/O, iPhone or macOS measurements are included.** Total elapsed time includes the scenario's callbacks/microtasks. Maximum synchronous time measures the longest call to the plugin's graph-update method; it is a proxy for JS event-loop blocking, **not a measured UI freeze**. The 150 ms event debounce is deliberately flushed, not included in timings.

Heap growth is the change in V8 heap usage across the scenario before forced GC (can include garbage, and is not total allocations or a peak). Retained heap is the post-GC difference from the pre-first-update baseline, which already includes the graph and harness. Process peak RSS is the OS high-water mark for the entire worker process, including the fixture and runtime; it cannot be attributed solely to the plugin or one scenario. Raw measurements, content-read counts and equality digests are in [graphs.json](graphs.json).

## Median total processing time (milliseconds)

Each cell is **before → after**. Idle is the total of ten checks.

| Nodes | Mode | Profile | First | Idle ×10 | Note edit | Folder edit | Link edit |
|---:|---|---|---:|---:|---:|---:|---:|
| 1000 | normal | folders | 5.03 → 3.34 | 31.81 → 19.28 | 4.19 → 2.71 | 3.83 → 2.76 | 3.48 → 2.03 |
| 1000 | normal | mixed | 5.26 → 4.34 | 28.30 → 21.33 | 3.97 → 2.25 | 4.34 → 2.67 | 3.50 → 2.29 |
| 1000 | normal | automatic | 6.21 → 6.28 | 28.66 → 22.57 | 4.71 → 2.98 | 5.18 → 3.40 | 4.26 → 2.38 |
| 1000 | tree | folders | 5.24 → 3.35 | 28.84 → 21.51 | 3.53 → 2.16 | 3.92 → 2.71 | 3.50 → 1.91 |
| 1000 | tree | mixed | 98.81 → 118.97 | 27.02 → 29.23 | 102.86 → 3.79 | 61.12 → 3.79 | 58.93 → 2.62 |
| 1000 | tree | automatic | 381.92 → 410.45 | 29.37 → 53.25 | 386.72 → 6.37 | 353.35 → 7.11 | 343.93 → 6.22 |
| 5000 | normal | folders | 20.29 → 13.10 | 125.40 → 76.44 | 16.69 → 7.67 | 17.02 → 9.36 | 16.49 → 7.35 |
| 5000 | normal | mixed | 22.79 → 15.38 | 132.59 → 88.98 | 18.62 → 10.15 | 20.03 → 11.86 | 18.54 → 8.42 |
| 5000 | normal | automatic | 27.46 → 24.75 | 132.36 → 113.13 | 23.62 → 12.56 | 22.14 → 14.28 | 23.91 → 11.26 |
| 5000 | tree | folders | 21.12 → 12.96 | 129.46 → 89.62 | 16.79 → 8.99 | 18.74 → 11.56 | 18.51 → 8.65 |
| 5000 | tree | mixed | 412.95 → 454.51 | 124.68 → 129.36 | 413.25 → 15.07 | 371.79 → 17.47 | 368.88 → 12.58 |
| 5000 | tree | automatic | 2054.09 → 2622.86 | 135.57 → 243.42 | 2001.91 → 31.91 | 1959.91 → 32.36 | 2055.27 → 27.14 |
| 10000 | normal | folders | 38.20 → 22.28 | 256.08 → 147.78 | 32.21 → 17.10 | 33.22 → 21.23 | 34.51 → 18.54 |
| 10000 | normal | mixed | 43.52 → 30.65 | 292.48 → 195.92 | 38.64 → 19.98 | 38.95 → 24.89 | 37.73 → 16.73 |
| 10000 | normal | automatic | 62.56 → 48.63 | 284.78 → 230.09 | 47.86 → 24.38 | 45.06 → 29.64 | 48.44 → 23.82 |
| 10000 | tree | folders | 39.64 → 24.83 | 258.71 → 178.76 | 32.74 → 18.97 | 33.46 → 24.12 | 33.08 → 17.40 |
| 10000 | tree | mixed | 864.71 → 864.04 | 341.13 → 278.16 | 845.58 → 28.52 | 815.41 → 37.78 | 892.85 → 24.40 |
| 10000 | tree | automatic | 3943.47 → 3914.46 | 266.30 → 471.03 | 3899.29 → 50.76 | 3959.53 → 66.87 | 3863.95 → 55.38 |

## Longest synchronous update and retained cache memory

Maximum synchronous update is the **maximum across all repetitions and all five scenarios**, not a median. Memory is the median retained heap difference after the first update.

| Nodes | Mode | Profile | Max synchronous ms, before → after | Retained MiB, before → after |
|---:|---|---|---:|---:|
| 1000 | normal | folders | 5.79 → 16.02 | 0.50 → 0.22 |
| 1000 | normal | mixed | 5.51 → 4.40 | 0.51 → 0.28 |
| 1000 | normal | automatic | 6.79 → 6.62 | 0.51 → 0.44 |
| 1000 | tree | folders | 7.95 → 3.35 | 0.50 → 0.22 |
| 1000 | tree | mixed | 119.36 → 125.15 | 0.51 → 0.36 |
| 1000 | tree | automatic | 397.95 → 420.09 | 0.52 → 0.56 |
| 5000 | normal | folders | 21.21 → 13.48 | 2.57 → 1.09 |
| 5000 | normal | mixed | 23.38 → 15.70 | 2.60 → 1.32 |
| 5000 | normal | automatic | 28.38 → 24.68 | 2.60 → 2.12 |
| 5000 | tree | folders | 22.37 → 13.46 | 2.59 → 1.09 |
| 5000 | tree | mixed | 475.18 → 454.91 | 2.61 → 1.56 |
| 5000 | tree | automatic | 2341.04 → 3088.89 | 2.60 → 2.74 |
| 10000 | normal | folders | 38.53 → 22.27 | 5.18 → 2.15 |
| 10000 | normal | mixed | 52.79 → 30.80 | 5.19 → 2.57 |
| 10000 | normal | automatic | 69.84 → 48.73 | 5.19 → 4.17 |
| 10000 | tree | folders | 42.28 → 27.26 | 5.18 → 2.15 |
| 10000 | tree | mixed | 1077.04 → 864.85 | 5.20 → 3.04 |
| 10000 | tree | automatic | 4353.76 → 4001.42 | 5.19 → 5.38 |

## Per-scenario timing and memory

Median of each metric across independent repetitions, before → after. These are separate metric medians, not necessarily the same run. Peak RSS is cumulative within each worker.

| Nodes | Mode | Profile | Scenario | Max sync ms | Heap growth MiB | Retained MiB | Process peak RSS MiB |
|---:|---|---|---|---:|---:|---:|---:|
| 1000 | normal | folders | first | 4.98 → 3.28 | 1.18 → 0.68 | 0.50 → 0.22 | 34.50 → 34.00 |
| 1000 | normal | folders | idle | 5.24 → 2.63 | 0.84 → 1.54 | 0.52 → 0.27 | 41.47 → 37.89 |
| 1000 | normal | folders | note-edit | 3.96 → 2.48 | 0.90 → 0.35 | 0.52 → 0.25 | 43.30 → 39.04 |
| 1000 | normal | folders | folder-edit | 3.11 → 2.02 | 0.91 → 0.42 | 0.53 → 0.26 | 43.30 → 40.67 |
| 1000 | normal | folders | link-edit | 3.39 → 1.97 | 0.89 → 0.34 | 0.53 → 0.25 | 43.30 → 40.89 |
| 1000 | normal | mixed | first | 5.20 → 4.27 | 1.26 → 0.84 | 0.51 → 0.28 | 34.50 → 34.13 |
| 1000 | normal | mixed | idle | 3.60 → 2.96 | 0.86 → 1.88 | 0.52 → 0.33 | 40.86 → 38.23 |
| 1000 | normal | mixed | note-edit | 3.84 → 2.06 | 0.98 → 0.38 | 0.52 → 0.30 | 43.65 → 40.87 |
| 1000 | normal | mixed | folder-edit | 3.80 → 2.03 | 0.97 → 0.44 | 0.54 → 0.32 | 43.76 → 41.14 |
| 1000 | normal | mixed | link-edit | 3.45 → 2.24 | 0.93 → 0.40 | 0.53 → 0.33 | 43.76 → 41.48 |
| 1000 | normal | automatic | first | 6.15 → 6.23 | 1.44 → 1.29 | 0.51 → 0.44 | 35.25 → 34.75 |
| 1000 | normal | automatic | idle | 3.52 → 2.68 | 0.87 → 0.91 | 0.52 → 0.49 | 41.00 → 38.65 |
| 1000 | normal | automatic | note-edit | 4.59 → 2.74 | 1.14 → 0.49 | 0.53 → 0.46 | 43.70 → 41.21 |
| 1000 | normal | automatic | folder-edit | 4.54 → 2.89 | 1.12 → 0.56 | 0.54 → 0.47 | 43.70 → 41.38 |
| 1000 | normal | automatic | link-edit | 4.17 → 2.32 | 1.10 → 0.51 | 0.53 → 0.49 | 43.70 → 41.88 |
| 1000 | tree | folders | first | 5.15 → 3.30 | 1.18 → 0.80 | 0.50 → 0.22 | 34.63 → 34.00 |
| 1000 | tree | folders | idle | 3.72 → 2.42 | 0.87 → 0.48 | 0.52 → 0.26 | 41.11 → 40.64 |
| 1000 | tree | folders | note-edit | 3.37 → 2.02 | 0.90 → 0.45 | 0.52 → 0.26 | 43.37 → 42.14 |
| 1000 | tree | folders | folder-edit | 3.40 → 2.04 | 0.91 → 0.52 | 0.53 → 0.26 | 43.49 → 42.14 |
| 1000 | tree | folders | link-edit | 3.45 → 1.86 | 0.89 → 0.44 | 0.53 → 0.26 | 43.49 → 42.14 |
| 1000 | tree | mixed | first | 98.75 → 118.90 | 1.49 → 2.25 | 0.51 → 0.36 | 40.68 → 40.31 |
| 1000 | tree | mixed | idle | 3.10 → 3.46 | 0.84 → 1.81 | 0.53 → 0.44 | 42.50 → 43.22 |
| 1000 | tree | mixed | note-edit | 102.70 → 3.64 | 1.13 → 0.79 | 0.54 → 0.42 | 43.45 → 44.35 |
| 1000 | tree | mixed | folder-edit | 60.37 → 3.18 | 0.64 → 1.06 | 0.55 → 0.37 | 43.45 → 44.60 |
| 1000 | tree | mixed | link-edit | 58.87 → 2.54 | 2.57 → 0.65 | 0.55 → 0.39 | 43.45 → 44.60 |
| 1000 | tree | automatic | first | 381.85 → 410.37 | 2.17 → 2.61 | 0.52 → 0.56 | 40.93 → 41.09 |
| 1000 | tree | automatic | idle | 4.67 → 7.12 | 0.86 → 3.95 | 0.53 → 0.66 | 43.52 → 47.94 |
| 1000 | tree | automatic | note-edit | 386.53 → 6.17 | 1.80 → 1.31 | 0.54 → 0.62 | 43.59 → 47.94 |
| 1000 | tree | automatic | folder-edit | 352.72 → 6.50 | 1.28 → 2.32 | 0.55 → 0.59 | 46.49 → 47.94 |
| 1000 | tree | automatic | link-edit | 343.81 → 6.08 | 3.22 → 1.31 | 0.55 → 0.62 | 46.62 → 47.94 |
| 5000 | normal | folders | first | 20.22 → 13.03 | 6.23 → 3.69 | 2.57 → 1.09 | 52.56 → 50.75 |
| 5000 | normal | folders | idle | 13.87 → 9.80 | 6.31 → 0.99 | 2.60 → 1.14 | 65.51 → 61.28 |
| 5000 | normal | folders | note-edit | 16.48 → 7.51 | 4.84 → 1.83 | 2.58 → 1.13 | 65.51 → 61.30 |
| 5000 | normal | folders | folder-edit | 15.84 → 8.63 | 4.87 → 2.09 | 2.63 → 1.17 | 65.51 → 61.58 |
| 5000 | normal | folders | link-edit | 16.37 → 7.29 | 4.73 → 1.82 | 2.61 → 1.17 | 65.51 → 61.58 |
| 5000 | normal | mixed | first | 22.69 → 15.31 | 6.49 → 4.37 | 2.60 → 1.32 | 51.75 → 52.33 |
| 5000 | normal | mixed | idle | 14.63 → 11.40 | 6.28 → 1.87 | 2.63 → 1.37 | 65.85 → 61.28 |
| 5000 | normal | mixed | note-edit | 18.40 → 9.83 | 4.99 → 1.98 | 2.61 → 1.34 | 65.85 → 62.04 |
| 5000 | normal | mixed | folder-edit | 19.34 → 10.87 | 5.07 → 2.28 | 2.67 → 1.39 | 65.85 → 63.66 |
| 5000 | normal | mixed | link-edit | 18.43 → 8.32 | 4.98 → 1.99 | 2.64 → 1.40 | 65.85 → 63.66 |
| 5000 | normal | automatic | first | 27.34 → 24.68 | 7.38 → 6.55 | 2.60 → 2.12 | 52.93 → 52.89 |
| 5000 | normal | automatic | idle | 15.25 → 13.34 | 6.35 → 7.50 | 2.63 → 2.17 | 65.85 → 62.10 |
| 5000 | normal | automatic | note-edit | 23.35 → 12.09 | 5.91 → 2.56 | 2.62 → 2.15 | 65.85 → 63.42 |
| 5000 | normal | automatic | folder-edit | 21.47 → 13.69 | 5.93 → 2.85 | 2.66 → 2.18 | 65.85 → 64.08 |
| 5000 | normal | automatic | link-edit | 23.82 → 11.09 | 5.87 → 2.51 | 2.63 → 2.18 | 65.85 → 64.08 |
| 5000 | tree | folders | first | 21.05 → 12.89 | 6.23 → 4.32 | 2.59 → 1.09 | 51.82 → 50.55 |
| 5000 | tree | folders | idle | 14.72 → 11.34 | 8.28 → 5.87 | 2.63 → 1.15 | 65.56 → 61.60 |
| 5000 | tree | folders | note-edit | 16.57 → 8.73 | 4.84 → 2.51 | 2.62 → 1.13 | 65.56 → 61.60 |
| 5000 | tree | folders | folder-edit | 17.62 → 10.67 | 4.87 → 2.73 | 2.66 → 1.17 | 65.56 → 61.60 |
| 5000 | tree | folders | link-edit | 18.41 → 8.57 | 4.73 → 2.51 | 2.64 → 1.17 | 65.56 → 61.60 |
| 5000 | tree | mixed | first | 412.86 → 454.30 | 3.84 → 6.13 | 2.61 → 1.56 | 60.96 → 60.88 |
| 5000 | tree | mixed | idle | 14.92 → 16.49 | 8.29 → 3.96 | 2.64 → 1.66 | 66.75 → 63.97 |
| 5000 | tree | mixed | note-edit | 413.10 → 14.83 | 2.26 → 3.83 | 2.63 → 1.63 | 66.75 → 63.97 |
| 5000 | tree | mixed | folder-edit | 369.15 → 16.52 | 7.64 → 5.48 | 2.68 → 1.62 | 66.75 → 63.97 |
| 5000 | tree | mixed | link-edit | 368.74 → 12.50 | 7.51 → 3.73 | 2.65 → 1.61 | 66.75 → 64.19 |
| 5000 | tree | automatic | first | 2054.02 → 2622.76 | 8.63 → 11.65 | 2.60 → 2.74 | 61.42 → 63.28 |
| 5000 | tree | automatic | idle | 15.50 → 31.19 | 8.28 → 23.29 | 2.63 → 2.81 | 66.43 → 87.47 |
| 5000 | tree | automatic | note-edit | 2001.66 → 31.66 | 7.16 → 5.68 | 2.63 → 2.78 | 66.43 → 87.47 |
| 5000 | tree | automatic | folder-edit | 1959.17 → 31.80 | 4.88 → 11.51 | 2.67 → 2.76 | 66.43 → 87.47 |
| 5000 | tree | automatic | link-edit | 2055.18 → 27.04 | 4.75 → 6.89 | 2.64 → 2.82 | 66.43 → 87.47 |
| 10000 | normal | folders | first | 38.13 → 22.16 | 12.39 → 7.12 | 5.18 → 2.15 | 63.91 → 61.95 |
| 10000 | normal | folders | idle | 27.82 → 20.18 | 18.17 → 3.01 | 5.20 → 2.18 | 93.31 → 71.36 |
| 10000 | normal | folders | note-edit | 32.00 → 16.89 | 9.57 → 3.65 | 5.20 → 2.18 | 93.31 → 71.36 |
| 10000 | normal | folders | folder-edit | 32.36 → 19.96 | 9.53 → 4.14 | 5.23 → 2.22 | 93.31 → 71.55 |
| 10000 | normal | folders | link-edit | 34.39 → 18.44 | 9.53 → 3.65 | 5.25 → 2.23 | 93.31 → 71.55 |
| 10000 | normal | mixed | first | 43.44 → 30.56 | 12.79 → 8.40 | 5.19 → 2.57 | 64.12 → 61.93 |
| 10000 | normal | mixed | idle | 34.29 → 25.53 | 18.17 → 6.07 | 5.20 → 2.61 | 93.83 → 72.14 |
| 10000 | normal | mixed | note-edit | 38.25 → 19.72 | 10.07 → 3.96 | 5.21 → 2.60 | 93.83 → 72.14 |
| 10000 | normal | mixed | folder-edit | 37.65 → 22.90 | 9.94 → 4.40 | 5.24 → 2.66 | 93.83 → 72.14 |
| 10000 | normal | mixed | link-edit | 37.60 → 16.61 | 9.92 → 3.89 | 5.26 → 2.65 | 93.83 → 72.14 |
| 10000 | normal | automatic | first | 62.48 → 48.56 | 6.74 → 5.72 | 5.19 → 4.17 | 64.51 → 62.81 |
| 10000 | normal | automatic | idle | 34.78 → 29.56 | 8.00 → 8.40 | 5.20 → 4.19 | 98.09 → 71.66 |
| 10000 | normal | automatic | note-edit | 47.69 → 24.05 | 11.83 → 5.11 | 5.21 → 4.20 | 98.09 → 71.66 |
| 10000 | normal | automatic | folder-edit | 44.02 → 28.61 | 11.79 → 5.63 | 5.22 → 4.24 | 98.09 → 71.68 |
| 10000 | normal | automatic | link-edit | 48.35 → 23.68 | 11.81 → 5.10 | 5.24 → 4.23 | 98.09 → 71.68 |
| 10000 | tree | folders | first | 39.56 → 24.76 | 12.40 → 8.49 | 5.18 → 2.15 | 65.59 → 62.09 |
| 10000 | tree | folders | idle | 30.82 → 21.51 | 18.17 → 11.56 | 5.20 → 2.18 | 93.85 → 73.76 |
| 10000 | tree | folders | note-edit | 32.58 → 18.54 | 9.57 → 4.98 | 5.20 → 2.19 | 93.85 → 73.76 |
| 10000 | tree | folders | folder-edit | 32.23 → 23.21 | 9.53 → 5.39 | 5.23 → 2.22 | 93.85 → 73.76 |
| 10000 | tree | folders | link-edit | 32.67 → 17.29 | 9.53 → 4.98 | 5.25 → 2.24 | 93.85 → 73.76 |
| 10000 | tree | mixed | first | 864.64 → 863.91 | 13.25 → 10.39 | 5.20 → 3.04 | 69.57 → 69.35 |
| 10000 | tree | mixed | idle | 40.71 → 33.34 | 18.17 → 12.26 | 5.21 → 3.12 | 92.89 → 89.96 |
| 10000 | tree | mixed | note-edit | 845.42 → 28.28 | 18.31 → 7.59 | 5.22 → 3.11 | 93.43 → 89.96 |
| 10000 | tree | mixed | folder-edit | 814.19 → 36.58 | 15.80 → 11.29 | 5.25 → 3.14 | 94.33 → 89.96 |
| 10000 | tree | mixed | link-edit | 892.73 → 24.29 | 15.78 → 6.56 | 5.28 → 3.12 | 94.45 → 89.96 |
| 10000 | tree | automatic | first | 3943.39 → 3914.37 | 7.92 → 17.72 | 5.19 → 5.38 | 69.86 → 90.05 |
| 10000 | tree | automatic | idle | 28.77 → 59.22 | 22.85 → 40.54 | 5.21 → 5.45 | 99.14 → 130.82 |
| 10000 | tree | automatic | note-edit | 3899.05 → 50.51 | 12.74 → 10.96 | 5.23 → 5.43 | 99.14 → 130.82 |
| 10000 | tree | automatic | folder-edit | 3958.50 → 66.15 | 10.18 → 22.38 | 5.24 → 5.43 | 99.14 → 130.82 |
| 10000 | tree | automatic | link-edit | 3863.82 → 55.26 | 10.17 → 13.46 | 5.26 → 5.49 | 99.14 → 130.82 |

## Observed tradeoffs

At 10,000 nodes with folder sizes in normal mode, median first calculation was 38.20 → 22.28 ms and retained cache heap was 5.18 → 2.15 MiB.

With fully automatic tree sizing, median note-edit processing was 3899.29 → 50.76 ms, but ten idle checks cost 266.30 → 471.03 ms. First calculation remained 3943.47 → 3914.46 ms. The incremental cache trades additional tree scanning/bookkeeping for avoiding repeated full traversals after edits; it is not a universal speedup. Some cold-start and maximum-block measurements regress, especially tree mode at 1,000/5,000 nodes. They are retained in the tables rather than excluded. Three repetitions are not enough to establish statistical significance or device-specific guarantees.

## Device follow-up

On a separate test vault in desktop Obsidian, record a Performance trace for opening the graph, 20 seconds idle, editing a note and changing one folder rule. Compare the longest main-thread tasks, JS heap after GC and frame responsiveness with the baseline. Use identical graph filters, node counts and link-tree settings, and disable unrelated plugins. This is still required to measure actual UI stalls. iPhone battery and responsiveness testing remains separate.
