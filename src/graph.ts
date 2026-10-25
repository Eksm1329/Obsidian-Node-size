import type { ObsidianNode } from "./types";

export interface GraphRenderer {
 nodes: unknown[];
 changed: () => void;
 setData?: (...args: unknown[]) => unknown;
}

/** Observe native graph updates before the browser can draw their reset weights.
 * Instance-only, reversible, and inert if another plugin retains our wrapper.
 */
export function observeGraphData(renderer: GraphRenderer, after: () => void): () => void {
 const original = renderer.setData;
 if (typeof original !== "function") return () => {};
 const descriptor = Object.getOwnPropertyDescriptor(renderer, "setData");
 let active = true;
 const wrapped = function(this: GraphRenderer, ...args: unknown[]) {
  const result = original.apply(this, args);
  if (active && this === renderer) after();
  return result;
 };
 renderer.setData = wrapped;
 return () => {
  active = false;
  if (renderer.setData !== wrapped) return;
  if (descriptor) Object.defineProperty(renderer, "setData", descriptor);
  else delete renderer.setData;
 };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
 return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNode(value: unknown): value is ObsidianNode {
 return isRecord(value) && typeof value.id === "string" &&
  typeof value.weight === "number" && Number.isFinite(value.weight) &&
  isRecord(value.forward) && isRecord(value.reverse);
}

export function isRenderer(value: unknown): value is GraphRenderer {
 return isRecord(value) && Array.isArray(value.nodes) && typeof value.changed === "function";
}

// The renderer mutates link maps in place. Compare contents, not just references.
export function topology(nodes: ObsidianNode[]): string {
 return JSON.stringify(nodes.map(node => [node.id, Object.keys(node.forward), Object.keys(node.reverse)]));
}
