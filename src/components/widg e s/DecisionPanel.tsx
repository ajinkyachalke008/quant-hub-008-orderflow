import { useOrderFlowStore } from "../../stores/orderFlowStore";
import {
  DECISION_WEIGHTS,
  TOTAL_WEIGHT,
  THRESHOLD_NORMAL,
  THRESHOLD_VOLATILE,
  LEAN_THRESHOLD,
  REGIME_THRESHOLDS,
  MIN_TRADES_FOR_SCORE,
} from "../../lib/orderflow/decisionEngine";

const dirColor = (d: string) =>
  d === "BUY" || d === "LEAN_BUY" ? "var(--ot-profit)" : d === "SELL" || d === "LEAN_SELL" ? "var(--ot-loss)" : "var(--ot-amber)";

export function DecisionPanel() {
  const decision = useOrderFlowStore((s) => s.decision);
  const feedStates = useOrderFlowStore((s) => s.feedStates);

  if (!decision) {
    return (
      <div style={{ background: "var(--ot-bg-panel)", border: "1px solid var(--ot-border)", padding: 16, borderRadius: 8 }}>
        <div style={{ color: "var(--ot-text-muted)", fontSize: 12 }}>DECISION PANEL</div>
        <div style={{ height: 120, background: "var(--ot-bg-surface)", marginTop: 12, borderRadius: 4 }} />
      </div>
    );
  }

  const feedOk = Object.values(feedStates).every((v) => v === "CONNECTED" || v === "LIVE");

  return (
    <div style={{ background: "var(--ot-bg-panel)", border: "1px solid var(--ot-border)", padding: 16, borderRadius: 8, color: "var(--ot-text-primary)" }}>
      <div style={{ color: "var(--ot-text-muted)", fontSize: 12, marginBottom: 8 }}>DECISION PANEL</div>
      <div style={{ fontSize: 48, fontWeight: 700, color: dirColor(decision.direction) }}>{decision.score.toFixed(1)}</div>
      <div style={{ color: dirColor(decision.direction), fontWeight: 600, marginBottom: 8 }}>{decision.direction}</div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ height: 6, background: "var(--ot-bg-surface)", borderRadius: 3 }}>
          <div style={{ width: `${decision.confidence}%`, height: 6, background: "var(--ot-accent)", borderRadius: 3 }} />
        </div>
        <div style={{ fontSize: 11, color: "var(--ot-text-secondary)" }}>confidence {decision.confidence.toFixed(0)}</div>
      </div>
      {decision.signals.map((sig) => (
        <div key={sig.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 4 }}>
          <span style={{ width: 90, color: "var(--ot-text-secondary)" }}>{sig.name}</span>
          <span style={{ width: 24, color: "var(--ot-text-muted)" }}>{sig.weight}</span>
          <div style={{ display: "flex", gap: 2 }}>
            {[0, 1, 2, 3, 4].map((i) => {
              const filled = Math.round(((sig.value + 1) / 2) * 5);
              return <span key={i} style={{ width: 8, height: 8, borderRadius: 2, background: i < filled ? "var(--ot-cyan)" : "var(--ot-bg-hover)" }} />;
            })}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 8, fontSize: 12, color: "var(--ot-text-secondary)" }}>
        {["strength", "activity", "flow", "targetCost", "rr", "trend"].map((g) => (
          <span key={g} style={{ marginRight: 8 }}>{(decision.gates as any)[g] ? "?" : "?"} {g}</span>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "var(--ot-text-muted)" }}>total weight {TOTAL_WEIGHT}</div>
      <div style={{ fontSize: 11, color: "var(--ot-text-muted)" }}>regime {decision.regime}</div>
      <div style={{ fontSize: 11, color: "var(--ot-text-muted)" }}>
        {decision.sampleCount < MIN_TRADES_FOR_SCORE ? `Collecting data... (${decision.sampleCount}/${MIN_TRADES_FOR_SCORE})` : `${decision.sampleCount} trades`}
      </div>
      <div style={{ fontSize: 11, color: "var(--ot-text-muted)" }}>book signal: formula validation pending</div>
      <div style={{ marginTop: 8, fontSize: 11, color: feedOk ? "var(--ot-profit)" : "var(--ot-loss)" }}>{feedOk ? "FEED OK" : "FEED DEGRADED"}</div>
    </div>
  );
}
