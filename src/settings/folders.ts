import { App, AbstractInputSuggest, Notice, Setting, TFolder, TFile } from "obsidian";
import FileSuggest from "./file-suggest";
import type NodeFactor from "../main";
class FolderSuggest extends AbstractInputSuggest<string> {
 constructor(app: App, private input: HTMLInputElement) { super(app, input); }
 getSuggestions(query: string): string[] {
  return this.app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder)
   .map(f => f.path).filter(p => p.toLowerCase().includes(query.toLowerCase()));
 }
 renderSuggestion(path: string, el: HTMLElement) { el.setText(path); }
 selectSuggestion(path: string) { this.input.value = path; this.input.dispatchEvent(new Event("input")); this.close(); }
}
export function folderSettings(plugin: NodeFactor, el: HTMLElement, refresh: () => void) {
 new Setting(el).setName("Folder sizes").setHeading();
 new Setting(el).setDesc("One weight for all notes in a folder, including future notes. Deeper folder rules take priority. Weight controls graph size, not pixels; the graph's node-size slider still applies.");
 let path = "", weight = 20, recursive = true;
 new Setting(el).setName("Folder").addSearch(s => {
  s.setPlaceholder("Choose folder ( / for vault root)").onChange(v => { path = v.trim(); });
  new FolderSuggest(plugin.app, s.inputEl);
 });
 new Setting(el).setName("Size weight").addSlider(s => s.setLimits(0,100,1).setValue(weight).setDynamicTooltip().onChange(v => { weight = v; }));
 new Setting(el).setName("Include subfolders").addToggle(t => t.setValue(true).onChange(v => { recursive = v; }));
 new Setting(el).addButton(b => b.setButtonText("Save folder rule").setCta().onClick(async () => {
  if (!(plugin.app.vault.getAbstractFileByPath(path) instanceof TFolder)) { new Notice("Choose an existing folder."); return; }
  plugin.settings.folders = plugin.settings.folders.filter(r => r.path !== path);
  plugin.settings.folders.push({path, weight, recursive});
  await plugin.saveSettings(); refresh();
 }));
 for (const rule of plugin.settings.folders) {
  new Setting(el).setName(rule.path).setDesc(rule.recursive ? "Includes subfolders" : "Direct children only")
   .addSlider(s => s.setLimits(0,100,1).setValue(rule.weight).setDynamicTooltip().onChange(async v => {rule.weight=v; await plugin.saveSettings();}))
   .addToggle(t => t.setTooltip("Include subfolders").setValue(rule.recursive).onChange(async v => {rule.recursive=v; await plugin.saveSettings(); refresh();}))
   .addButton(b => b.setButtonText("Remove").onClick(async () => {plugin.settings.folders=plugin.settings.folders.filter(r => r!==rule); await plugin.saveSettings(); refresh();}));
 }
 new Setting(el).setName("Folder rule exceptions").setHeading();
 let excluded = "";
 new Setting(el).setName("Use automatic size for a note").setDesc("Enter its full vault path, including .md. A manual size still takes priority.")
  .addSearch(t => { new FileSuggest(plugin.app, t.inputEl); t.setPlaceholder("Folder/Note.md").onChange(v => {excluded=v.trim();}); })
  .addButton(b => b.setButtonText("Exclude").onClick(async () => {
   if (!(plugin.app.vault.getAbstractFileByPath(excluded) instanceof TFile)) {new Notice("Choose an existing note."); return;}
   if (!plugin.settings.exclusions.includes(excluded)) plugin.settings.exclusions.push(excluded);
   await plugin.saveSettings(); refresh();
  }));
 for (const path of plugin.settings.exclusions) new Setting(el).setName(path).addButton(b => b.setButtonText("Remove").onClick(async () => {
  plugin.settings.exclusions=plugin.settings.exclusions.filter(p => p!==path); await plugin.saveSettings(); refresh();
 }));
}
