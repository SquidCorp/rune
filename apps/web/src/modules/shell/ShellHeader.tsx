import type { RuneScope } from "@rune/sdk";

import { HealthStatus } from "@/modules/health";

import { NewProfileButton } from "./NewProfileButton.tsx";
import { RuneMark } from "./RuneMark.tsx";

export interface ShellHeaderProps {
	scope: RuneScope;
	healthOk: boolean;
	healthLabel: string;
	profileCount: number | null;
}

export function ShellHeader({
	scope,
	healthOk,
	healthLabel,
	profileCount,
}: ShellHeaderProps) {
	const countLabel = profileCount === null ? "—" : String(profileCount);
	const pathLabel =
		scope === "project"
			? `${countLabel} in .rune/profiles`
			: `${countLabel} in ~/.rune/profiles`;

	return (
		<>
			<nav className="shell-nav">
				<div className="shell-brand">
					<RuneMark />
					<div className="shell-wordmark">
						<p className="shell-logo">RUNE</p>
						<span className="shell-rule" />
						<span className="shell-subtitle">Control plane</span>
					</div>
				</div>
				<div className="shell-tabs">
					<span className="shell-tab shell-tab-active">Profiles</span>
					<span className="shell-tab shell-tab-idle">Pipelines</span>
				</div>
				<HealthStatus ok={healthOk} label={healthLabel} />
			</nav>
			<header className="shell-page-header">
				<div className="shell-page-copy">
					<p className="shell-eyebrow">01 — Registry</p>
					<h1 className="shell-title">Profiles</h1>
				</div>
				<div className="shell-page-actions">
					<span className="shell-count">{pathLabel}</span>
					<NewProfileButton />
				</div>
			</header>
		</>
	);
}
