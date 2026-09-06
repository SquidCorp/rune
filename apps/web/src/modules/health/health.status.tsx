export interface HealthStatusProps {
	status: string;
}

export function HealthStatus({ status }: HealthStatusProps) {
	return <p className="muted">{status}</p>;
}
