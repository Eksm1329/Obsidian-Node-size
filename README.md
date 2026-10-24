# Folder Node Size

An MIT-licensed fork of [Node Factor by CalfMoon](https://github.com/calfmoon/node-factor), based on upstream commit `b04d2e77c9d4434f6971778f0ff5a28b6c4f00cd`.

Set one graph size weight for every note in a folder. Rules apply to new notes too. Supports desktop and mobile Obsidian (minimum 1.8.0), with no Node.js or Electron runtime dependency. The plugin uses Obsidian's **internal graph renderer**, which can change between Obsidian versions. Automated tests use a simulated renderer. See the user-reported device check below; other platform/version combinations still need device testing.

## Install

Download `main.js`, `manifest.json`, and `styles.css` from this repository's release. Put all three in `<vault>/.obsidian/plugins/folder-node-size/`. Restart Obsidian and enable **Folder Node Size** under Settings → Community plugins. Disable the original Node Factor to avoid competing graph updates.

On iPhone/iPad, copy that same plugin folder into the vault using a computer and a sync method that includes hidden `.obsidian/plugins` files. If using Obsidian Sync, enable installed community plugin and plugin settings sync on the relevant devices, then restart Obsidian and enable the plugin on the phone. Sync settings and enablement may need configuring on each device. Ordinary note-only sync may not transfer plugins.

Alternatively, with BRAT already installed, add `Eksm1329/Obsidian-Node-size` as a beta plugin once a release is available. This does not require this fork to be listed in Obsidian's community catalog.

## Rules

In Settings → Folder Node Size:

1. Choose a folder (use `/` for the whole vault).
2. Set **Size weight** and **Include subfolders**, then select **Save folder rule**. Saving the same folder replaces its rule; existing rules can be adjusted directly.
3. Under **Folder rule exceptions**, choose a note to use automatic sizing instead of a folder rule.
4. Under **Manually set size**, give a note an individual override, including zero. Existing manual weights can be adjusted with the slider.

Priority: **manual note size → exception (automatic size) → deepest matching folder → automatic size**. The automatic calculation retains the original plugin's link and file-size controls. Size is a graph weight, not a pixel radius; Obsidian's graph node-size slider also affects appearance. Exceptions are individual notes; a separate nested-folder rule can give a whole subfolder another size.

Both global and local graphs update when settings or vault metadata change. Events are grouped over 150 ms. A fallback checks graph topology every two seconds to discover new or replaced nodes, reusing cached weights when nothing changed. Checks pause while the document is hidden. The fallback still scans nodes and links, so large graphs have a cost; battery improvements have not been measured on a device. Rules follow file/folder renames made through Obsidian. Removing a rule restores inherited or automatic sizing. Notes are never edited; settings live in the plugin's `data.json`. This fork has a separate plugin ID and does not automatically import the original plugin's settings.

If a graph renderer or node shape is incompatible, the affected renderer is skipped and one notice is shown. If updating it throws, the plugin attempts to restore its original weights and stops touching that renderer until it is recreated or the plugin is restarted. Rules are retained. These checks cannot detect every visual or semantic API change.

## Reported device compatibility

The user reports that the plugin works well on an iPhone running **iOS 27.0.1** and **Obsidian 1.14.5**, following the 1.0.2 release. Versions are recorded as supplied by the user. The exact test scenarios and installed plugin version were not separately confirmed; this is a user-reported check, not an exhaustive compatibility or battery benchmark.

## Verify on your devices

Create `Test/A.md`, `Test/B.md`, and `Test/Sub/C.md`. Give `Test` weight 30 with subfolders enabled. Open global and local graphs: all three should use the same weight. Give `Test/Sub` weight 60, exclude `Test/B.md`, and manually set `Test/A.md` to 10. Check each change, create a new note in `Test`, rename the folder, then restart Obsidian to verify persistence. Repeat on iPhone and check that controls fit the screen. Disable the plugin to check restoration of graph weights.

If a graph does not resize, record the Obsidian version, platform and whether it is a global or local graph; internal renderer compatibility needs checking for that version.

## Development

Node.js 24 was used for validation.

```sh
npm ci
npm test
npm run lint
npm run build
```

`npm run dev` watches and rebuilds `main.js`. Copy the three plugin files into a test vault to run inside Obsidian. Automated tests cover rule priority, path boundaries, root folders, new notes, exceptions, renames, multiple graph views and unload restoration. They do not replace device testing.

Pushing a version tag such as `1.0.1` triggers the release workflow after tests, lint and build succeed. Version tags must match `manifest.json`.

## License

MIT. Original Node Factor copyright retained in [LICENSE](LICENSE).

## Reliability and performance

Saved data is read through an explicit schema: invalid numbers and entries are ignored, and unknown fields are not merged into settings. If the settings file cannot be read, plugin startup pauses rather than overwriting it with defaults. Saves are serialized with independent snapshots. A storage failure displays a notice; after resolving it, editing a setting retries saving. This cannot make filesystem writes atomic or prevent cross-device sync conflicts.

Folder and manual rules are indexed once per calculation batch; lookup scales with folder depth. Unchanged graph checks do not construct a new rule index or sort link keys. Detached graph nodes are restored where possible and released.

Run `node scripts/benchmark.cjs` for a reproducible synthetic comparison of the previous rule lookup with the index (5,000 rules and 5,000 notes). On the cloud runner one measured run took 1,999 ms versus 3.6 ms including index construction, with matching results. This is not an end-to-end rendering or mobile battery benchmark. Graph structure scans and full link-tree traversal remain potentially expensive on very large graphs.
