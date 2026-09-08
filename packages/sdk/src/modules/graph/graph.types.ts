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
	/** When true, engine buffers sparse session diagnostics onto each step. */
	verbose?: boolean;
}

/**
 * Sparse session diagnostics for `--verbose` proof (not full transcript / thinking).
 * Text fields are truncated by the engine.
 */
export type GraphSessionDiagEvent =
	| { type: "user"; text: string }
	| { type: "assistant"; text: string }
	| { type: "tool"; name: string; ok: boolean };

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
	/** Present when the run requested verbose diagnostics. */
	events?: GraphSessionDiagEvent[];
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
