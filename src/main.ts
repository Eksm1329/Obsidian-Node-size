import { readSettings } from "./settings-data";
import { Notice, Plugin } from "obsidian";
import { ObsidianNode, NodeFactorSettings } from "types";
import NodeFactorSettingTab from "settings";
import { GraphWeights } from "./weights";
import { movedPath, RuleIndex } from "./rules";
import { GraphRenderer, isNode, isRenderer, observeGraphData } from "./graph";

class StaleGraph extends Error {}
const clock = () => typeof performance === "undefined" ? Date.now() : performance.now();

type Original = { original: number; applied: number; renderer: GraphRenderer };


export default class NodeFactor extends Plugin {
 settings: NodeFactorSettings;
 private originals = new Map<ObsidianNode, Original>();
 private cache = new WeakMap<GraphRenderer, GraphWeights>();
 private failed = new WeakSet<object>();
 private graphHooks = new Map<GraphRenderer, () => void>();
 private frameRules: RuleIndex | undefined;
 private frameRuleRevision = -1;
 private revision = 0;
 private topologyRevision = 0;
 private job: { iterator: Generator<void, void, void>; promise: Promise<void>; resolve: () => void; applied: boolean } | undefined;
 private pumpTimer: ReturnType<typeof setTimeout> | undefined;
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
   void this.recalculateSize();
   // Obsidian exposes no public event for renderer node replacement.
   // The fallback discovers new nodes; cached weights avoid repeated calculations.
   this.registerInterval(window.setInterval(() => { void this.recalculateSize(); }, 2000));
  });
  this.registerEvent(this.app.workspace.on("layout-change", () => this.invalidateTopology()));
  this.registerEvent(this.app.metadataCache.on("resolved", () => this.invalidateTopology()));
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
   if (document.hidden) this.cancelJob();
   else this.invalidateTopology();
  });
 }

 private schedule() {
  if (this.stopped || this.pending !== undefined) return;
  this.pending = window.setTimeout(() => {
   this.pending = undefined;
   void this.recalculateSize();
  }, 150);
 }

 private invalidate(path?: string) {
  this.cancelJob();
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
     if (!this.failed.has(renderer)) {
      if (!this.stopped && !this.graphHooks.has(renderer))
       this.graphHooks.set(renderer, observeGraphData(renderer, () => this.onGraphData(renderer)));
      result.push(renderer);
     }
    } catch {
     this.warn();
    }
   }
  }
  return result;
 }

 private releaseGraphHook(renderer: GraphRenderer) {
  const release = this.graphHooks.get(renderer);
  this.graphHooks.delete(renderer);
  try { release?.(); } catch { /* A closing host may freeze its renderer. */ }
 }

 private onGraphData(renderer: GraphRenderer) {
  if (this.stopped || this.failed.has(renderer)) return;
  // setData resets weights on every timelapse step. Keep known sizes in the
  // same task, rather than allowing a native-size frame until the next poll.
  this.topologyRevision++;
  if (typeof document !== "undefined" && document.hidden) return;
  try {
   if (!this.frameRules || this.frameRuleRevision !== this.revision) {
    this.frameRules = new RuleIndex(this.settings);
    this.frameRuleRevision = this.revision;
   }
   let changed = false;
   for (const node of renderer.nodes) {
    if (!isNode(node)) throw new Error("Unsupported graph node shape");
    const previous = this.originals.get(node);
    // Newly revealed fixed nodes get their rule immediately. Automatic tree
    // calculations remain in the cooperative scheduler, never in this hook.
    const weight = previous?.applied ?? this.frameRules.weight(node.id);
    if (weight === undefined) continue;
    if (previous) previous.original = node.weight;
    else this.originals.set(node, { original: node.weight, applied: weight, renderer });
    if (node.weight !== weight) { node.weight = weight; changed = true; }
   }
   if (changed) renderer.changed();
  } catch {
   this.failed.add(renderer);
   this.releaseGraphHook(renderer);
   this.restore(renderer);
   this.warn();
  }
 }

 private restore(renderer?: GraphRenderer) {
  for (const [node, value] of this.originals) {
   if (renderer && value.renderer !== renderer) continue;
   try { if (node.weight === value.applied) node.weight = value.original; } catch { /* Host may freeze nodes during teardown. */ }
   this.originals.delete(node);
  }
 }

 private invalidateTopology() {
  this.cancelJob();
  this.topologyRevision++;
  this.schedule();
 }

 whenIdle(): Promise<void> { return this.job?.promise ?? Promise.resolve(); }

 private cancelJob() {
  if (this.pumpTimer !== undefined) { clearTimeout(this.pumpTimer); this.pumpTimer = undefined; }
  const job = this.job;
  if (!job) return;
  this.job = undefined;
  job.iterator.return();
  // A cancelled generator may have staged only part of a cache revision.
  this.cache = new WeakMap();
  if (job.applied) this.restore();
  job.resolve();
 }

 recalculateSize(): Promise<void> {
  if (this.stopped || (typeof document !== "undefined" && document.hidden)) return Promise.resolve();
  if (this.job) return this.job.promise;
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  this.job = { iterator: this.updateGraphs(), promise, resolve, applied: false };
  this.pump();
  return promise;
 }

 private pump() {
  this.pumpTimer = undefined;
  const job = this.job;
  if (!job) return;
  if (this.stopped || (typeof document !== "undefined" && document.hidden)) { this.cancelJob(); return; }
  const started = clock();
  try {
   let steps = 0;
   while (true) {
    if (job.iterator.next().done) { this.job = undefined; job.resolve(); return; }
    // A soft 4 ms budget; native calls and GC can exceed it. Check every 64 work units.
    if (++steps % 64 === 0 && clock() - started >= 4) break;
   }
   this.pumpTimer = setTimeout(() => this.pump(), 0);
  } catch {
   this.cancelJob();
   this.warn();
  }
 }

 private *updateGraphs(): Generator<void, void, void> {
  const live = new Set<ObsidianNode>();
  const stale = new Set<GraphRenderer>();
  const renderers = this.renderers();
  const topologyAtStart = this.topologyRevision;
  for (const renderer of this.graphHooks.keys()) if (!renderers.includes(renderer)) this.releaseGraphHook(renderer);
  for (const renderer of renderers) {
   try {
    const topologyRevision = this.topologyRevision;
    const snapshot = renderer.nodes.slice();
    const nodes: ObsidianNode[] = [];
    for (const node of snapshot) {
     if (!isNode(node)) throw new Error("Unsupported graph node shape");
     nodes.push(node);
     yield;
    }
    if (this.topologyRevision !== topologyRevision) throw new StaleGraph();
    let cached = this.cache.get(renderer);
    if (!cached) { cached = new GraphWeights(); this.cache.set(renderer, cached); }
    const weights = yield* cached.update(nodes, this.settings, this.revision,
     id => this.contentVersions.get(id) ?? 0, this.forceRevision, this.app, this.topologyRevision, clock());
    let changed = false;
    if (this.failed.has(renderer)) throw new Error("Incompatible graph update");
    if (this.topologyRevision !== topologyRevision || renderer.nodes.length !== nodes.length) throw new StaleGraph();
    for (let i = 0; i < nodes.length; i++) {
     const node = nodes[i]!;
     if (this.topologyRevision !== topologyRevision || renderer.nodes[i] !== node) throw new StaleGraph();
     live.add(node);
     const weight = weights.get(node.id)?.weight;
     if (weight === undefined) continue;
     const previous = this.originals.get(node);
     const original = previous && node.weight === previous.applied ? previous.original : node.weight;
     if (!previous || previous.original !== original || previous.applied !== weight || previous.renderer !== renderer)
      this.originals.set(node, { original, applied: weight, renderer });
     if (node.weight !== weight) { if (this.job) this.job.applied = true; node.weight = weight; changed = true; }
     yield;
    }
    if (changed) renderer.changed();
   } catch (error) {
    this.cache.delete(renderer);
    if (error instanceof StaleGraph) {
     // Preserve displayed sizes while the animation changes membership; a
     // rollback to native weights on every interrupted job causes flicker.
     stale.add(renderer);
     this.schedule();
    } else {
     this.restore(renderer); this.releaseGraphHook(renderer);
     this.failed.add(renderer); this.warn();
    }
   }
  }
  for (const [node, value] of this.originals) {
   // A frame can reveal new nodes during the cleanup's own yields, after
   // the snapshot was processed. Do not mistake those new nodes for detached ones.
   const changedDuringJob = this.topologyRevision !== topologyAtStart && renderers.includes(value.renderer);
   if (!live.has(node) && !stale.has(value.renderer) && !changedDuringJob) {
    try { if (node.weight === value.applied) node.weight = value.original; } catch { /* Detached host node. */ }
    this.originals.delete(node);
   }
   yield;
  }
 }

 onunload() {
  this.stopped = true;
  this.cancelJob();
  if (this.pending !== undefined) window.clearTimeout(this.pending);
  const renderers = this.renderers();
  for (const renderer of this.graphHooks.keys()) this.releaseGraphHook(renderer);
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
  this.cancelJob();
  this.revision++;
  const rendering = this.recalculateSize();
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
  await rendering;
 }
}
