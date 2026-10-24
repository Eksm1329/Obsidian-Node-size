import type { ObsidianNode } from "./types";

export interface GraphRenderer {
 nodes: unknown[];
 changed: () => void;
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
 return JSON.stringify(nodes.map(node => [node.id, Object.keys(node.forward).sort(), Object.keys(node.reverse).sort()]));
}
