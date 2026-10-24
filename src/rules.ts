import type { NodeFactorSettings } from "./types";

export function matchesFolder(file: string, folder: string, recursive: boolean): boolean {
 const prefix = folder === "/" ? "" : folder.replace(/\/$/, "") + "/";
 if (!file.startsWith(prefix)) return false;
 const rest = file.slice(prefix.length);
 return rest.length > 0 && (recursive || !rest.includes("/"));
}

/** Index rules once per settings revision. Lookup cost depends on path depth, not rule count. */
export class RuleIndex {
 private manual: Map<string, number>;
 private exclusions: Set<string>;
 private folders: Map<string, NodeFactorSettings["folders"][number]>;
 constructor(settings: NodeFactorSettings) {
  this.manual = new Map(settings.manual.map(entry => [entry.id, entry.weight]));
  this.exclusions = new Set(settings.exclusions);
  this.folders = new Map(settings.folders.map(rule => [rule.path, rule]));
 }
 weight(file: string): number | undefined {
  if (this.manual.has(file)) return this.manual.get(file);
  if (this.exclusions.has(file)) return undefined;
  let end = file.lastIndexOf("/");
  let direct = true;
  while (true) {
   const folder = end < 0 ? "/" : file.slice(0, end);
   const rule = this.folders.get(folder);
   if (rule && (direct || rule.recursive)) return rule.weight;
   if (end < 0) return undefined;
   end = end > 0 ? file.lastIndexOf("/", end - 1) : -1;
   direct = false;
  }
 }
}

export function ruleWeight(file: string, settings: NodeFactorSettings): number | undefined {
 return new RuleIndex(settings).weight(file);
}

export function movedPath(path: string, oldPath: string, newPath: string): string {
 return path === oldPath ? newPath : path.startsWith(oldPath + "/") ? newPath + path.slice(oldPath.length) : path;
}
