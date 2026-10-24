import { ruleWeight } from "./rules";
import { App } from "obsidian";

import { NodeFactorSettings, ObsidianNode } from "types";

export default class Calculations {
	private app: App;
	private settings: NodeFactorSettings;

	constructor(app: App, settings: NodeFactorSettings) {
		this.app = app;
		this.settings = settings;
	}

	calcNodeWeight(node: ObsidianNode): number {
		const settings = this.settings;
		let weight = 0;

		const override = ruleWeight(node.id, settings);
		if (override !== undefined) return override;

		weight += Object.keys(node.reverse).length * settings.bwdMultiplier;
		if (settings.fwdTree) {
			weight +=
				this.fwdNodeTreeSize(node, new Set()) * settings.fwdMultiplier;
		} else {
			weight += Object.keys(node.forward).length * settings.fwdMultiplier;
		}

		if (settings.lettersPerWt != 0) {
			weight += this.letterCount(node) / settings.lettersPerWt;
		}

		return Math.round(weight);
	}

	private letterCount(node: ObsidianNode): number {
		const file = this.app.vault.getFileByPath(node.id);
		if (file == null || file.extension != "md") return 0;

		return file.stat.size;
	}

	private fwdNodeTreeSize(
		node: ObsidianNode,
		antiLoopSet: Set<string>,
	): number {
		let size = 0;
		antiLoopSet.add(node.id);

		Object.entries(node.forward).forEach(([key, value]) => {
			const childNode: ObsidianNode = value.target;

			// Prevents looping if A -> B -> C -> D -> B
			if (!antiLoopSet.has(key)) {
				size++;
				const childSize = this.fwdNodeTreeSize(childNode, antiLoopSet);
				size += childSize;
			}
		});
		return size;
	}
}
