import { Plugin } from "obsidian";
import { ObsidianNode, NodeFactorSettings, DEFAULT_SETTINGS } from "types";
import NodeFactorSettingTab from "settings";
import Calculator from "calculator";
import { movedPath } from "./rules";

type GraphRenderer = { nodes?: ObsidianNode[]; changed?: () => void };
export default class NodeFactor extends Plugin {
 settings: NodeFactorSettings;
 private originals = new Map<ObsidianNode, { original: number; applied: number }>();
 private stopped = false;
 async onload() {
  await this.loadSettings();
  this.addSettingTab(new NodeFactorSettingTab(this.app, this));
  this.app.workspace.onLayoutReady(() => {
   if (this.stopped) return;
   this.recalculateSize();
   this.registerInterval(window.setInterval(() => this.recalculateSize(), 1000));
  });
  this.registerEvent(this.app.workspace.on("layout-change", () => this.recalculateSize()));
  this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
   for (const rule of this.settings.folders) rule.path = movedPath(rule.path, oldPath, file.path);
   for (const entry of this.settings.manual) entry.id = movedPath(entry.id, oldPath, file.path);
   this.settings.exclusions = this.settings.exclusions.map(path => movedPath(path, oldPath, file.path));
   void this.saveSettings();
  }));
 }
 private renderers(): GraphRenderer[] {
  return ["graph", "localgraph"].flatMap(type => this.app.workspace.getLeavesOfType(type))
   .map(leaf => (leaf.view as unknown as { renderer?: GraphRenderer }).renderer)
   .filter((r): r is GraphRenderer => !!r && Array.isArray(r.nodes));
 }
 recalculateSize() {
  if (this.stopped) return;
  const calculator = new Calculator(this.app, this.settings);
  const live = new Set<ObsidianNode>();
  for (const renderer of this.renderers()) {
   let changed = false;
   for (const node of renderer.nodes ?? []) {
    if (!node || typeof node.id !== "string" || !node.forward || !node.reverse) continue;
    live.add(node);
    const previous = this.originals.get(node);
    const original = previous && node.weight === previous.applied ? previous.original : node.weight;
    const weight = calculator.calcNodeWeight(node);
    if (!Number.isFinite(weight)) continue;
    this.originals.set(node, { original, applied: weight });
    if (node.weight !== weight) { node.weight = weight; changed = true; }
   }
   if (changed && typeof renderer.changed === "function") renderer.changed();
  }
  for (const node of this.originals.keys()) if (!live.has(node)) this.originals.delete(node);
 }
 onunload() {
  this.stopped = true;
  for (const [node, value] of this.originals) if (node.weight === value.applied) node.weight = value.original;
  for (const renderer of this.renderers()) if (typeof renderer.changed === "function") renderer.changed();
  this.originals.clear();
 }
 async loadSettings() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<NodeFactorSettings> | null);
  this.settings.manual = [...(this.settings.manual ?? [])];
  this.settings.folders = [...(this.settings.folders ?? [])];
  this.settings.exclusions = [...(this.settings.exclusions ?? [])];
 }
 async saveSettings() { await this.saveData(this.settings); this.recalculateSize(); }
}
