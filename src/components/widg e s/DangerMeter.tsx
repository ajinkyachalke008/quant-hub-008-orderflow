import { useOrderFlowStore } from "../../stores/orderFlowStore";
import {
  computeDangerLevel,
  isLiquidationBurst,
  VPIN_ELEVATED,
  VPIN_TOXIC,
  LIQ_BURST_ABS_USD,
  LIQ_BURST_LARGE_USD,
  LIQ_BURST_MULTIPLIER,
} from "../../lib/orderflow/dangerMeter";

const levelColor = (level: "CALM" | "ELEVATED" | "HIGH") =>
  level === "CALM" ? "var(--ot-profit)" : level === "ELEVATED" ? "var(--ot-amber)" : "var(--ot-loss)";

const vpinColor = (v: number | null) =>
  v === null ? "var(--ot-text-muted)" : v >= VPIN_TOXIC ? "var(--ot-loss)" : v >= VPIN_ELEVATED ? "var(--ot-amber)" : "var(--ot-profit)";

export function DangerMeter() {
  const danger = useOrderFlowStore((s) => s.danger);
  const liquidations = useOrderFlowStore((s) => s.liquidations);
  const decision = useOrderFlowStore((s) => s.decision);
  const feedStates = useOrderFlowStore((s) => s.feedStates);
  const regime = decision?.regime ?? "range";

  if (!danger) {
    return (
      <div style={{ background: "var(--ot-bg-panel)", border: "1px solid var(--ot-border)", padding: 16, borderRadius: 8, color: "var(--ot-text-primary)" }}>
        <div style={{ color: "var(--ot-text-muted)", fontSize: 12, marginBottom: 8 }}>DANGER METER</div>
        <div style={{ height: 110, background: "var(--ot-bg-surface)", borderRadius: 4 }} />
      </div>
    );
  }

  const { inputs } = danger;
  const vpinPct: number | null = inputs.vpinPct < 0 ? null : inputs.vpinPct;
  const now = Date.now();
  const liq60s = liquidations.filter((l) => now - l.t <= 60000).reduce((a, l) => a + l.usd, 0);
  const liqHourlyAvg = liquidations.filter((l) => now - l.t <= 3600000).reduce((a, l) => a + l.usd, 0) / 60;
  const burst = isLiquidationBurst(liq60s, liqHourlyAvg);
  const computed = computeDangerLevel({ vpinPct, liq60sUsd: liq60s, liqHourlyAvgUsd: liqHourlyAvg, futuresSpotDiffBps: inputs.futuresSpotDiffBps, regime });
  const level = computed.level;
  const feedOk = Object.values(feedStates).every((v) => v === "CONNECTING" || v === "LIVE");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes dangerPulse{0%,100%{opacity:1}50%{opacity:0.55}}" }} />
      <div role="status" aria-live="polite" aria-atomic="true" style={{ background: "var(--ot-bg-panel)", border: "1px solid var(--ot-border)", padding: 16, borderRadius: 8, color: "var(--ot-text-primary)" }}>
        <div style={{ color: "var(--ot-text-muted)", fontSize: 12, marginBottom: 10, letterSpacing: 0.5 }}>DANGER METER</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "var(--ot-bg-hover)", color: levelColor(level), border: `1px solid ${levelColor(level)}`, fontWeight: 700, textTransform: "uppercase", animation: level === "HIGH" ? "dangerPulse 1.2s infinite" : "none" }}>{level}</span>
          <span style={{ fontSize: 11, color: "var(--ot-text-secondary)", marginLeft: 8 }}>overall {level}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, color: "var(--ot-text-secondary)" }}>
          <div>VPIN <span style={{ float: "right", color: vpinColor(vpinPct) }}>{vpinPct === null ? "CALIBRATING" : vpinPct.toFixed(2)}</span></div>
          <div>Liq burst <span style={{ float: "right", color: burst ? "var(--ot-loss)" : "var(--ot-text-secondary)" }}>{burst ? "BURST" : "ok"} — ${liq60s.toLocaleString()} vs ${liqHourlyAvg.toLocaleString()} avg (large ${LIQ_BURST_LARGE_USD.toLocaleString()}, ×${LIQ_BURST_MULTIPLIER}, abs ${LIQ_BURST_ABS_USD.toLocaleString()})</span></div>
          <div>Futures-spot <span style={{ float: "right", color: Math.abs(inputs.futuresSpotDiffBps) >= 6 ? "var(--ot-loss)" : "var(--ot-text-secondary)" }}>{inputs.futuresSpotDiffBps.toFixed(1)} bps</span></div>
          <div>Regime <span style={{ float: "right" }}>{regime}</span></div>
          <div>Overall <span style={{ float: "right", color: levelColor(level), fontWeight: 700 }}>{level}</span></div>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: feedOk ? "var(--ot-profit)" : "var(--ot-loss)" }}>{feedOk ? "FEED OK" : "FEED DEGRADED"}</div>
      </div>
    </>
  );
}
