import type { NodeFactorSettings } from "./types";

export function matchesFolder(file: string, folder: string, recursive: boolean): boolean {
 const prefix = folder === "/" ? "" : folder.replace(/\/$/, "") + "/";
 if (!file.startsWith(prefix)) return false;
 const rest = file.slice(prefix.length);
 return rest.length > 0 && (recursive || !rest.includes("/"));
}

/** Manual sizes win; excluded files use automatic calculation. Deepest folder wins. */
export function ruleWeight(file: string, settings: NodeFactorSettings): number | undefined {
 const manual = settings.manual.find(entry => entry.id === file);
 if (manual) return manual.weight;
 if (settings.exclusions.includes(file)) return undefined;
 const rule = settings.folders.filter(r => matchesFolder(file, r.path, r.recursive))
  .sort((a, b) => b.path.split("/").filter(Boolean).length - a.path.split("/").filter(Boolean).length)[0];
 return rule?.weight;
}

export function movedPath(path: string, oldPath: string, newPath: string): string {
 return path === oldPath ? newPath : path.startsWith(oldPath + "/") ? newPath + path.slice(oldPath.length) : path;
}
