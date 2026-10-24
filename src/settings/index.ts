import { folderSettings } from "./folders";
import { App, PluginSettingTab } from "obsidian";

import NodeFactor from "main";

import ManualSetting from "./manual";
import ProgrameticalSetting from "./programetical";

export default class NodeFactorSettingTab extends PluginSettingTab {
	private plugin: NodeFactor;

	constructor(app: App, plugin: NodeFactor) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { plugin, containerEl, app } = this;
		containerEl.empty();
 containerEl.addClass("node-size-settings");
 folderSettings(plugin, containerEl, () => this.display());

		new ProgrameticalSetting(plugin, containerEl).display();

		new ManualSetting(app, plugin, containerEl, () =>
			this.display(),
		).display();
	}
}
