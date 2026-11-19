import { useOrderFlowStore } from '../../stores/orderFlowStore';
import { REGIME_THRESHOLDS } from '../../lib/orderflow/decisionEngine';

const REGIME_COLORS: Record<string, string> = {
  range: 'var(--ot-profit)',
  unclear: 'var(--ot-amber)',
  trend: 'var(--ot-cyan)',
  volatile: 'var(--ot-loss)',
};

const REGIME_LABELS: Record<string, string> = {
  range: 'RANGE',
  unclear: 'UNCLEAR',
  trend: 'TREND',
  volatile: 'VOLATILE',
};

export function RegimeBadge() {
  const decision = useOrderFlowStore((s) => s.decision);

  if (!decision || decision.sampleCount < 50) {
    return (
      <div className="ot-regime-badge ot-regime--collecting">
        <span className="ot-regime-title">REGIME</span>
        <span className="ot-regime-value">Collecting data...</span>
      </div>
    );
  }

  const { regime, score, sampleCount } = decision;
  const color = REGIME_COLORS[regime] || 'var(--ot-text-secondary)';
  const label = REGIME_LABELS[regime] || regime.toUpperCase();
  const threshold = REGIME_THRESHOLDS[regime] ?? 0;

  return (
    <div className="ot-regime-badge" style={{ borderColor: color }}>
      <span className="ot-regime-title">REGIME</span>
      <span
        className="ot-regime-value"
        style={{ color }}
      >
        {label}
      </span>
      <span className="ot-regime-details">
        Score: {score.toFixed(1)} | Threshold: {threshold} | Samples: {sampleCount}
      </span>
    </div>
  );
}

export default RegimeBadge;
