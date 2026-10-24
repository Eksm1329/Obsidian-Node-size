import { isNode } from "./graph";
import { RuleIndex } from "./rules";
import { App } from "obsidian";

import { NodeFactorSettings, ObsidianNode } from "types";

export default class Calculations {
	private app: App;
	private settings: NodeFactorSettings;
 private rules: RuleIndex;

	constructor(app: App, settings: NodeFactorSettings) {
		this.app = app;
		this.settings = settings;
 this.rules = new RuleIndex(settings);
	}

	calcNodeWeight(node: ObsidianNode): number {
		const settings = this.settings;
		let weight = 0;

		const override = this.rules.weight(node.id);
		if (override !== undefined) return override;

		weight += Object.keys(node.reverse).length * settings.bwdMultiplier;
		if (settings.fwdTree && settings.fwdMultiplier !== 0) {
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
        const stack: ObsidianNode[] = [node];
        antiLoopSet.add(node.id);
        while (stack.length) {
            const current = stack.pop()!;
            for (const edge of Object.values(current.forward)) {
                const child: unknown = edge?.target;
                if (!isNode(child)) throw new Error("Unsupported graph link target");
                if (antiLoopSet.has(child.id)) continue;
                antiLoopSet.add(child.id);
                stack.push(child);
            }
        }
        return antiLoopSet.size - 1;
    }
}
