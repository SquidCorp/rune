export const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
export const TYPESAFE_MODEL = "jev-latest";
export const WHICH_PROFILE_INSTRUCTIONS =
	"Which profile is the best to handle this task?";
export const DEFAULT_PROFILE_CRITERION =
	"Default Rune profile. Use when no specialized project profile fits.";
export const CLASSIFY_TIMEOUT_MS = 10_000;

export function readTypesafeApiKey(authJson: unknown): string | undefined {
	if (!authJson || typeof authJson !== "object" || Array.isArray(authJson)) {
		return undefined;
	}
	const typesafe = (authJson as Record<string, unknown>).typesafe;
	if (!typesafe || typeof typesafe !== "object" || Array.isArray(typesafe)) {
		return undefined;
	}
	const entry = typesafe as Record<string, unknown>;
	if (entry.type !== "api_key" || typeof entry.key !== "string") {
		return undefined;
	}
	const key = entry.key.trim();
	return key.length > 0 ? key : undefined;
}

export function criterionText(profile: {
	id: string;
	description?: string;
	name?: string;
}): string {
	const description = profile.description?.trim();
	if (description) return description;
	const name = profile.name?.trim();
	if (name) return name;
	return profile.id;
}

export function buildWhichProfileCriteria(
	profiles: Array<{ id: string; description?: string; name?: string }>,
): Record<string, string> {
	const criteria: Record<string, string> = {};
	for (const profile of profiles) {
		criteria[profile.id] = criterionText(profile);
	}
	criteria.default = DEFAULT_PROFILE_CRITERION;
	return criteria;
}

function classifyTimeoutSignal(): AbortSignal {
	if (typeof AbortSignal.timeout === "function") {
		return AbortSignal.timeout(CLASSIFY_TIMEOUT_MS);
	}
	const controller = new AbortController();
	setTimeout(() => {
		controller.abort();
	}, CLASSIFY_TIMEOUT_MS);
	return controller.signal;
}

export async function classifyWhichProfile(options: {
	userMessage: string;
	criteria: Record<string, string>;
	apiKey: string;
}): Promise<{ ok: true; choice: string } | { ok: false }> {
	try {
		const response = await fetch(TYPESAFE_URL, {
			method: "POST",
			headers: {
				authorization: `Bearer ${options.apiKey}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				state: options.userMessage,
				model: TYPESAFE_MODEL,
				questions: {
					which_profile: {
						type: "choice",
						instructions: WHICH_PROFILE_INSTRUCTIONS,
						criteria: options.criteria,
					},
				},
			}),
			signal: classifyTimeoutSignal(),
		});
		if (response.status !== 200) return { ok: false };
		const parsed: unknown = await response.json();
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return { ok: false };
		}
		const answers = (parsed as Record<string, unknown>).answers;
		if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
			return { ok: false };
		}
		const which = (answers as Record<string, unknown>).which_profile;
		if (!which || typeof which !== "object" || Array.isArray(which)) {
			return { ok: false };
		}
		const choice = (which as Record<string, unknown>).choice;
		if (typeof choice !== "string") return { ok: false };
		return { ok: true, choice };
	} catch {
		return { ok: false };
	}
}
