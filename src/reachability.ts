/** Exact descendant counts. Nodes in one strongly connected component share a result.
 * All graph walks yield bounded units of work to the caller's scheduler.
 */
export class Reachability {
 private component = new Map<string, number>();
 private sizes: number[] = [];
 private dag: Set<number>[] = [];
 private counts = new Map<number, number>();
 private ready = false;
 constructor(private edges: Map<string, string[]>) {}

 private *prepare(): Generator<void, void, void> {
  const reverse = new Map<string, string[]>();
  for (const [id, targets] of this.edges) {
   for (const target of targets) {
    let incoming = reverse.get(target);
    if (!incoming) { incoming = []; reverse.set(target, incoming); }
    incoming.push(id);
    yield;
   }
  }
  const visited = new Set<string>();
  const order: string[] = [];
  for (const id of this.edges.keys()) {
   if (visited.has(id)) { yield; continue; }
   visited.add(id);
   const stack = [{id, next: 0}];
   while (stack.length) {
    const frame = stack[stack.length - 1]!;
    const targets = this.edges.get(frame.id) ?? [];
    if (frame.next < targets.length) {
     const child = targets[frame.next++]!;
     if (!visited.has(child)) { visited.add(child); stack.push({id: child, next: 0}); }
    } else { order.push(frame.id); stack.pop(); }
    yield;
   }
  }
  for (let i = order.length - 1; i >= 0; i--) {
   const id = order[i]!;
   if (this.component.has(id)) { yield; continue; }
   const component = this.sizes.length;
   this.sizes.push(0); this.dag.push(new Set());
   const stack = [id]; this.component.set(id, component);
   while (stack.length) {
    const current = stack.pop()!;
    this.sizes[component] = this.sizes[component]! + 1;
    for (const parent of reverse.get(current) ?? []) {
     if (!this.component.has(parent)) { this.component.set(parent, component); stack.push(parent); }
     yield;
    }
    yield;
   }
  }
  for (const [id, targets] of this.edges) {
   const from = this.component.get(id)!;
   for (const target of targets) {
    const to = this.component.get(target)!;
    if (from !== to) this.dag[from]!.add(to);
    yield;
   }
  }
  this.ready = true;
 }

 *count(id: string): Generator<void, number, void> {
  if (!this.ready) yield* this.prepare();
  const root = this.component.get(id);
  if (root === undefined) throw new Error("Missing tree root");
  const cached = this.counts.get(root);
  if (cached !== undefined) return cached;
  const seen = new Set<number>([root]);
  const stack = [root];
  let size = 0;
  while (stack.length) {
   const component = stack.pop()!;
   size += this.sizes[component]!;
   for (const child of this.dag[component]!) {
    if (!seen.has(child)) { seen.add(child); stack.push(child); }
    yield;
   }
   yield;
  }
  const result = size - 1;
  this.counts.set(root, result);
  return result;
 }
}
