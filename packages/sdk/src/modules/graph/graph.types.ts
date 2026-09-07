export interface GraphNode {
	id: string;
	profile: string;
	insert?: string;
	append?: string;
}

export interface GraphEdge {
	from: string;
	to: string;
}

export interface Graph {
	/** Filename stem under `.rune/graphs/`. */
	id: string;
	name?: string;
	description?: string;
	nodes: GraphNode[];
	edges: GraphEdge[];
	/** Absolute or cwd-resolved file path. */
	path: string;
}

export interface GraphValidationIssue {
	code: string;
	message: string;
	nodeId?: string;
	edge?: { from: string; to: string };
	profile?: string;
}

export interface GraphCheckResult {
	graphId: string;
	ok: boolean;
	issues: GraphValidationIssue[];
	/** Present when ok: ordered node ids source→sink */
	path?: string[];
}
