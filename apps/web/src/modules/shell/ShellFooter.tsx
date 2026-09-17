import type { RuneScope } from "@rune/sdk";

import { HealthStatus } from "@/modules/health";

export interface ShellFooterProps {
	profileCount: number | null;
	pipelineCount: number | null;
	scope: RuneScope;
	onToggleScope: () => void;
	enginesOk: boolean;
}

export function ShellFooter({
	profileCount,
	pipelineCount,
	scope,
	onToggleScope,
	enginesOk,
}: ShellFooterProps) {
	return (
		<footer className="shell-footer">
			<div className="shell-stat shell-stat-start">
				<span className="shell-stat-label">Profiles</span>
				<span className="shell-stat-value">
					{profileCount === null ? "—" : String(profileCount)}
				</span>
			</div>
			<div className="shell-stat shell-stat-mid">
				<span className="shell-stat-label">Pipelines on disk</span>
				<span className="shell-stat-value">
					{pipelineCount === null ? "—" : String(pipelineCount)}
				</span>
			</div>
			<div className="shell-stat shell-stat-mid">
				<span className="shell-stat-label">Last check</span>
				<span className="shell-stat-value">—</span>
			</div>
			<div className="shell-stat shell-stat-end">
				<span className="shell-stat-label">Scope</span>
				<button
					type="button"
					className="shell-stat-value shell-scope-btn"
					aria-label={`Scope ${scope}, click to switch`}
					onClick={onToggleScope}
				>
					{scope}
				</button>
			</div>
			<div className="shell-engines">
				<HealthStatus
					ok={enginesOk}
					label={enginesOk ? "All engines nominal" : "API offline"}
				/>
			</div>
		</footer>
	);
}
