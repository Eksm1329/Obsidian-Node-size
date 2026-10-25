import { readSettings } from "./settings-data";
import { Notice, Plugin } from "obsidian";
import { ObsidianNode, NodeFactorSettings } from "types";
import NodeFactorSettingTab from "settings";
import { GraphWeights } from "./weights";
import { movedPath } from "./rules";
import { GraphRenderer, isNode, isRenderer } from "./graph";

type Original = { original: number; applied: number; renderer: GraphRenderer };


export default class NodeFactor extends Plugin {
 settings: NodeFactorSettings;
 private originals = new Map<ObsidianNode, Original>();
 private cache = new WeakMap<GraphRenderer, GraphWeights>();
 private failed = new WeakSet<object>();
 private revision = 0;
 private forceRevision = 0;
 private contentSequence = 0;
 private contentVersions = new Map<string, number>();
 private stopped = false;
 private warned = false;
 private pending: number | undefined;
 private writes: Promise<void> = Promise.resolve();
 private writeFailed = false;

 async onload() {
  await this.loadSettings();
  if (this.stopped) return;
  this.addSettingTab(new NodeFactorSettingTab(this.app, this));
  this.app.workspace.onLayoutReady(() => {
   if (this.stopped) return;
   this.recalculateSize();
   // Obsidian exposes no public event for renderer node replacement.
   // The fallback discovers new nodes; cached weights avoid repeated calculations.
   this.registerInterval(window.setInterval(() => this.recalculateSize(), 2000));
  });
  this.registerEvent(this.app.workspace.on("layout-change", () => this.schedule()));
  this.registerEvent(this.app.metadataCache.on("resolved", () => this.schedule()));
  this.registerEvent(this.app.vault.on("create", file => this.invalidate(file.path)));
  this.registerEvent(this.app.vault.on("modify", file => this.invalidate(file.path)));
  this.registerEvent(this.app.vault.on("delete", file => this.invalidate(file.path)));
  this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
   for (const rule of this.settings.folders) rule.path = movedPath(rule.path, oldPath, file.path);
   for (const entry of this.settings.manual) entry.id = movedPath(entry.id, oldPath, file.path);
   this.settings.exclusions = this.settings.exclusions.map(path => movedPath(path, oldPath, file.path));
   this.contentVersions.set(file.path, ++this.contentSequence);
   void this.saveSettings();
  }));
  this.registerDomEvent(document, "visibilitychange", () => {
   if (!document.hidden) this.schedule();
  });
 }

 private schedule() {
  if (this.stopped || this.pending !== undefined) return;
  this.pending = window.setTimeout(() => {
   this.pending = undefined;
   this.recalculateSize();
  }, 150);
 }

 private invalidate(path?: string) {
  if (path === undefined) this.forceRevision++;
  else this.contentVersions.set(path, ++this.contentSequence);
  this.schedule();
 }

 private warn() {
  if (this.warned || this.stopped) return;
  this.warned = true;
  new Notice("A graph is incompatible and was skipped. Your rules are saved. Update this plugin or report your Obsidian version.", 10000);
 }

 private renderers(): GraphRenderer[] {
  const result: GraphRenderer[] = [];
  for (const type of ["graph", "localgraph"]) {
   for (const leaf of this.app.workspace.getLeavesOfType(type)) {
    try {
     const renderer: unknown = (leaf.view as unknown as { renderer?: unknown }).renderer;
     // An absent renderer is normal while a view is opening.
     if (renderer == null) continue;
     if (!isRenderer(renderer)) { this.warn(); continue; }
     if (!this.failed.has(renderer)) result.push(renderer);
    } catch {
     this.warn();
    }
   }
  }
  return result;
 }

 private restore(renderer?: GraphRenderer) {
  for (const [node, value] of this.originals) {
   if (renderer && value.renderer !== renderer) continue;
   try { if (node.weight === value.applied) node.weight = value.original; } catch { /* Host may freeze nodes during teardown. */ }
   this.originals.delete(node);
  }
 }

 recalculateSize() {
  if (this.stopped || (typeof document !== "undefined" && document.hidden)) return;
  const live = new Set<ObsidianNode>();
  for (const renderer of this.renderers()) {
   try {
    if (!renderer.nodes.every(isNode)) throw new Error("Unsupported graph node shape");
    const nodes = renderer.nodes;
    let cached = this.cache.get(renderer);
    if (!cached) { cached = new GraphWeights(); this.cache.set(renderer, cached); }
    const weights = cached.update(nodes, this.settings, this.revision,
     id => this.contentVersions.get(id) ?? 0, this.forceRevision, this.app);
    let changed = false;
    for (const node of nodes) {
     live.add(node);
     const weight = weights.get(node.id)?.weight;
     if (weight === undefined) continue;
     const previous = this.originals.get(node);
     const original = previous && node.weight === previous.applied ? previous.original : node.weight;
     if (!previous || previous.original !== original || previous.applied !== weight || previous.renderer !== renderer)
      this.originals.set(node, { original, applied: weight, renderer });
     if (node.weight !== weight) { node.weight = weight; changed = true; }
    }
    if (changed) renderer.changed();
   } catch {
    this.restore(renderer);
    this.cache.delete(renderer);
    this.failed.add(renderer);
    this.warn();
   }
  }
  for (const [node, value] of this.originals) if (!live.has(node)) {
   try { if (node.weight === value.applied) node.weight = value.original; } catch { /* Detached host node. */ }
   this.originals.delete(node);
  }
 }

 onunload() {
  this.stopped = true;
  if (this.pending !== undefined) window.clearTimeout(this.pending);
  const renderers = this.renderers();
  this.restore();
  this.contentVersions.clear();
  for (const renderer of renderers) {
   try { renderer.changed(); } catch { /* Host may already be closing the view. */ }
  }
 }
 async loadSettings() {
  try {
   this.settings = readSettings(await this.loadData());
  } catch {
   // Do not replace an unreadable settings file with defaults on the next UI edit.
   this.stopped = true;
   new Notice("Could not read plugin settings. Changes are paused to protect the saved file. Restart after resolving the storage or sync error.", 10000);
  }
 }
 async saveSettings() {
  if (this.stopped) return;
  const snapshot = readSettings(this.settings);
  this.revision++;
  this.recalculateSize();
  // Each edit has an independent snapshot; writes finish in the order requested.
  this.writes = this.writes.then(async () => {
   try {
    await this.saveData(snapshot);
    this.writeFailed = false;
   } catch {
    if (!this.writeFailed) new Notice("Could not save plugin settings. Changes work for this session only. Check storage and sync, then change a setting to retry.", 10000);
    this.writeFailed = true;
   }
  });
  await this.writes;
 }
}
