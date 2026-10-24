export interface ObsidianNode {
	id: string;
	weight: number;
	forward: Record<string, { target: ObsidianNode }>;
	reverse: object;
}

export interface NodeFactorSettings {
	fwdMultiplier: number;
	fwdTree: boolean;

	bwdMultiplier: number;

	lettersPerWt: number;

	manual: Array<FileData>;
 folders: FolderRule[];
 exclusions: string[];
}

export interface FileData {
	id: string;
	weight: number;
}

export const DEFAULT_SETTINGS: NodeFactorSettings = {
	fwdMultiplier: 1,
	fwdTree: false,

	bwdMultiplier: 1,

	lettersPerWt: 0,

	manual: new Array<FileData>(),
 folders: [],
 exclusions: [],
};

export interface FolderRule { path: string; weight: number; recursive: boolean; }
