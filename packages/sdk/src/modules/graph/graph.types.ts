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

export interface GraphRunRequest {
	prompt: string;
}

export interface GraphRunStep {
	nodeId: string;
	profile: string;
	input: string;
	/** Final assistant text only (not tool traces). Present when status is ok. */
	output?: string;
	status: "ok" | "error";
	error?: string;
	startedAt: string;
	finishedAt: string;
}

export interface GraphRunResult {
	graphId: string;
	startedAt: string;
	finishedAt: string;
	status: "ok" | "error";
	initialPrompt: string;
	steps: GraphRunStep[];
	/** Sink node final assistant text when status is ok. */
	final?: string;
	error?: string;
}
