export interface Link {
	id: string;
	from: string;
	to: string;
	label?: string;
}

export interface CreateLinkInput {
	from: string;
	to: string;
	label?: string;
}
