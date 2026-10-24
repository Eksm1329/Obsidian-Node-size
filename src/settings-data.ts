import { DEFAULT_SETTINGS, NodeFactorSettings } from "./types";
import { isRecord } from "./graph";

/** Read only known fields; never merge arbitrary JSON into a settings object. */
export function readSettings(raw: unknown): NodeFactorSettings {
 const data = isRecord(raw) ? raw : {};
 const number = (value: unknown, fallback: number, max: number): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? value : fallback;
 const path = (value: unknown): value is string => typeof value === "string" && value.length > 0 &&
  !value.includes("\\") && !value.split("/").some(part => part === "." || part === "..");
 const result: NodeFactorSettings = {
  fwdMultiplier: number(data.fwdMultiplier, DEFAULT_SETTINGS.fwdMultiplier, 20),
  bwdMultiplier: number(data.bwdMultiplier, DEFAULT_SETTINGS.bwdMultiplier, 20),
  lettersPerWt: number(data.lettersPerWt, 0, 5000),
  fwdTree: data.fwdTree === true,
  manual: [], folders: [], exclusions: []
 };
 const manual = new Map<string, number>();
 for (const entry of Array.isArray(data.manual) ? data.manual : []) {
  if (!isRecord(entry) || !path(entry.id)) continue;
  const weight = number(entry.weight, -1, 100);
  if (weight >= 0) manual.set(entry.id, weight);
 }
 result.manual = Array.from(manual, ([id, weight]) => ({ id, weight }));
 const folders = new Map<string, {path: string; weight: number; recursive: boolean}>();
 for (const entry of Array.isArray(data.folders) ? data.folders : []) {
  if (!isRecord(entry) || !path(entry.path)) continue;
  const weight = number(entry.weight, -1, 100);
  if (weight < 0) continue;
  const folder = entry.path === "/" ? "/" : entry.path.replace(/^\/+|\/+$/g, "");
  if (!folder) continue;
  folders.set(folder, {path: folder, weight, recursive: entry.recursive !== false});
 }
 result.folders = [...folders.values()];
 result.exclusions = [...new Set((Array.isArray(data.exclusions) ? data.exclusions : []).filter(path))];
 return result;
}
