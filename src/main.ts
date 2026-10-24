import { Notice, Plugin } from "obsidian";
import { ObsidianNode, NodeFactorSettings, DEFAULT_SETTINGS } from "types";
import NodeFactorSettingTab from "settings";
import Calculator from "calculator";
import { movedPath } from "./rules";
import { GraphRenderer, isNode, isRenderer, topology } from "./graph";

type Original = { original: number; applied: number; renderer: GraphRenderer };
type CachedGraph = { revision: number; topology: string; weights: Map<string, number> };

export default class NodeFactor extends Plugin {
 settings: NodeFactorSettings;
 private originals = new Map<ObsidianNode, Original>();
 private cache = new WeakMap<GraphRenderer, CachedGraph>();
 private failed = new WeakSet<object>();
 private revision = 0;
 private stopped = false;
 private warned = false;
 private pending: number | undefined;

 async onload() {
  await this.loadSettings();
  this.addSettingTab(new NodeFactorSettingTab(this.app, this));
  this.app.workspace.onLayoutReady(() => {
   if (this.stopped) return;
   this.recalculateSize();
   // Obsidian exposes no public event for renderer node replacement.
   // The fallback discovers new nodes; cached weights avoid repeated calculations.
   this.registerInterval(window.setInterval(() => this.recalculateSize(), 2000));
  });
  this.registerEvent(this.app.workspace.on("layout-change", () => this.schedule()));
  this.registerEvent(this.app.metadataCache.on("resolved", () => this.invalidate()));
  this.registerEvent(this.app.vault.on("create", () => this.invalidate()));
  this.registerEvent(this.app.vault.on("modify", () => this.invalidate()));
  this.registerEvent(this.app.vault.on("delete", () => this.invalidate()));
  this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
   for (const rule of this.settings.folders) rule.path = movedPath(rule.path, oldPath, file.path);
   for (const entry of this.settings.manual) entry.id = movedPath(entry.id, oldPath, file.path);
   this.settings.exclusions = this.settings.exclusions.map(path => movedPath(path, oldPath, file.path));
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

 private invalidate() {
  this.revision++;
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
    const renderer: unknown = (leaf.view as unknown as { renderer?: unknown }).renderer;
    // An absent renderer is normal while a view is opening.
    if (renderer == null) continue;
    if (!isRenderer(renderer)) { this.warn(); continue; }
    if (!this.failed.has(renderer)) result.push(renderer);
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
  const calculator = new Calculator(this.app, this.settings);
  const live = new Set<ObsidianNode>();
  for (const renderer of this.renderers()) {
   try {
    if (!renderer.nodes.every(isNode)) throw new Error("Unsupported graph node shape");
    const nodes = renderer.nodes;
    const signature = topology(nodes);
    let cached = this.cache.get(renderer);
    if (!cached || cached.revision !== this.revision || cached.topology !== signature) {
     const weights = new Map<string, number>();
     for (const node of nodes) {
      const weight = calculator.calcNodeWeight(node);
      if (!Number.isFinite(weight) || weight < 0) throw new Error("Invalid graph weight");
      weights.set(node.id, weight);
     }
     cached = { revision: this.revision, topology: signature, weights };
     this.cache.set(renderer, cached);
    }
    let changed = false;
    for (const node of nodes) {
     live.add(node);
     const weight = cached.weights.get(node.id);
     if (weight === undefined) continue;
     const previous = this.originals.get(node);
     const original = previous && node.weight === previous.applied ? previous.original : node.weight;
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
  for (const node of this.originals.keys()) if (!live.has(node)) this.originals.delete(node);
 }

 onunload() {
  this.stopped = true;
  if (this.pending !== undefined) window.clearTimeout(this.pending);
  const renderers = this.renderers();
  this.restore();
  for (const renderer of renderers) {
   try { renderer.changed(); } catch { /* Host may already be closing the view. */ }
  }
 }
 async loadSettings() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<NodeFactorSettings> | null);
  this.settings.manual = [...(this.settings.manual ?? [])];
  this.settings.folders = [...(this.settings.folders ?? [])];
  this.settings.exclusions = [...(this.settings.exclusions ?? [])];
 }
 async saveSettings() {
  await this.saveData(this.settings);
  this.revision++;
  this.recalculateSize();
 }
}
