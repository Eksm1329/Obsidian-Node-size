import type { App } from "obsidian";
import type { NodeFactorSettings, ObsidianNode } from "./types";
import Calculator from "./calculator";
import { isNode } from "./graph";
import { RuleIndex } from "./rules";

type Entry = { weight: number; fixed: number | undefined; content: number; forward: number; reverse: number; automatic: string; force: number };

/** One cache per renderer: local and global graphs can have different link sets. */
export class GraphWeights {
 private entries = new Map<string, Entry>();
 private rules: RuleIndex | undefined;
 private ruleRevision = -1;
 private edges = new Map<string, string[]>();

 update(nodes: ObsidianNode[], settings: NodeFactorSettings, ruleRevision: number,
  contentVersion: (id: string) => number, force: number, app: App): Map<string, Entry> {
  const rulesChanged = !this.rules || this.ruleRevision !== ruleRevision;
  if (rulesChanged) { this.rules = new RuleIndex(settings); this.ruleRevision = ruleRevision; }
  const rules = this.rules!;
  const tree = settings.fwdTree && settings.fwdMultiplier !== 0;
  let fixed: Map<string, number | undefined> | undefined;
  let affected: Set<string> | undefined;
  if (tree) {
   fixed = new Map();
   const automaticNodes: ObsidianNode[] = [];
   for (const node of nodes) {
    const previous = this.entries.get(node.id);
    const override = rulesChanged || !previous ? rules.weight(node.id) : previous.fixed;
    fixed.set(node.id, override);
    if (override === undefined) automaticNodes.push(node);
   }
   if (automaticNodes.length) affected = this.changedAncestors(automaticNodes);
   else this.edges.clear();
  } else this.edges.clear();
  const automatic = `${settings.fwdMultiplier}/${settings.bwdMultiplier}/${settings.lettersPerWt}/${settings.fwdTree}`;
  let calculator: Calculator | undefined;
  for (const node of nodes) {
   const previous = this.entries.get(node.id);
   const override = fixed ? fixed.get(node.id) : rulesChanged || !previous ? rules.weight(node.id) : previous.fixed;
   if (override !== undefined) {
    if (!previous || previous.fixed !== override) this.entries.set(node.id,
     { weight: override, fixed: override, content: 0, forward: 0, reverse: 0, automatic: "", force });
    continue;
   }
   const content = settings.lettersPerWt !== 0 ? contentVersion(node.id) : 0;
   // Fixed-size nodes never enumerate their link maps (unless reachable from an automatic tree root).
   const forward = !tree && settings.fwdMultiplier !== 0 ? Object.keys(node.forward).length : 0;
   const reverse = settings.bwdMultiplier !== 0 ? Object.keys(node.reverse).length : 0;
   if (!previous || previous.fixed !== undefined || previous.content !== content || previous.force !== force ||
    previous.forward !== forward || previous.reverse !== reverse || previous.automatic !== automatic || affected?.has(node.id)) {
    calculator ??= new Calculator(app, settings);
    const weight = calculator.calcAutomaticWeight(node);
    if (!Number.isFinite(weight) || weight < 0) throw new Error("Invalid graph weight");
    this.entries.set(node.id, { weight, fixed: undefined, content, forward, reverse, automatic, force });
   }
  }
  // An entry is added for every current ID. Only excess entries can be stale.
  if (this.entries.size > nodes.length) {
   const live = new Set(nodes.map(node => node.id));
   for (const id of this.entries.keys()) if (!live.has(id)) this.entries.delete(id);
  }
  return this.entries;
 }

 /** Exact adjacency comparison, including off-screen descendants. No lossy hashes.
  * Propagate through both old and new edges so deletions and cycles invalidate all ancestors.
  */
 private changedAncestors(roots: ObsidianNode[]): Set<string> {
  const next = new Map<string, string[]>();
  const changed = new Set<string>();
  const stack = [...roots];
  const queued = new Set(roots);
  while (stack.length) {
   const node = stack.pop()!;
   if (!isNode(node)) throw new Error("Unsupported graph link target");
   if (next.has(node.id)) continue;
   const targets: string[] = [];
   for (const edge of Object.values(node.forward)) {
    const child = edge?.target;
    if (!child) throw new Error("Unsupported graph link target");
    targets.push(child.id);
    if (!queued.has(child)) { queued.add(child); stack.push(child); }
   }
   next.set(node.id, targets);
   const old = this.edges.get(node.id);
   if (!old || old.length !== targets.length || old.some((id, i) => id !== targets[i])) changed.add(node.id);
  }
  for (const id of this.edges.keys()) {
   if (!next.has(id)) changed.add(id);
  }
  if (!changed.size) { this.edges = next; return changed; }
  const parents = new Map<string, Set<string>>();
  const parent = (child: string, id: string) => {
   let set = parents.get(child);
   if (!set) { set = new Set(); parents.set(child, set); }
   set.add(id);
  };
  for (const [id, targets] of next) for (const child of targets) parent(child, id);
  for (const [id, targets] of this.edges) for (const child of targets) parent(child, id);
  const queue = [...changed];
  for (let i = 0; i < queue.length; i++) {
   for (const id of parents.get(queue[i]!) ?? []) {
    if (!changed.has(id)) { changed.add(id); queue.push(id); }
   }
  }
  this.edges = next;
  return changed;
 }
}
