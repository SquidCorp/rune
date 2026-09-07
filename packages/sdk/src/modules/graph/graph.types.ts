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
