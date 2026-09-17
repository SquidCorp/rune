export interface HealthStatusProps {
	ok: boolean;
	label: string;
}

export function HealthStatus({ ok, label }: HealthStatusProps) {
	return (
		<div className="health-status">
			<span
				className={
					ok ? "health-dot health-dot-ok" : "health-dot health-dot-error"
				}
			/>
			<span className="health-label">{label}</span>
		</div>
	);
}
