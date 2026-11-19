import { useOrderFlowStore } from "../../stores/orderFlowStore";
import type { FeedState } from "../../types/orderFlow";

const LIVE_STATES: FeedState[] = ["LIVE"];
const WARN_STATES: FeedState[] = ["DELAYED", "STALE", "CONNECTING", "RECONNECTING"];

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour12: false });
const fmtPrice = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUsd = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function badgeTone(states: FeedState[]): string {
  if (states.length === 0) return "var(--ot-text-muted)";
  if (states.every((s) => LIVE_STATES.includes(s))) return "var(--ot-profit)";
  if (states.some((s) => s === "DISCONNECTED" || s === "ERROR" || s === "UNSUPPORTED")) return "var(--ot-loss)";
  if (states.some((s) => WARN_STATES.includes(s))) return "var(--ot-amber)";
  return "var(--ot-cyan)";
}

export function LiquidationFeed() {
  const liquidations = useOrderFlowStore((s) => s.liquidations);
  const feedStates = useOrderFlowStore((s) => s.feedStates);

  const rows = [...liquidations].sort((a, b) => b.t - a.t).slice(0, 100);
  const states = Object.values(feedStates);
  const tone = badgeTone(states);
  const badgeText = states.length === 0 ? "NO FEEDS" : states.every((s) => LIVE_STATES.includes(s)) ? "FEED LIVE" : "FEED DEGRADED";

  return (
    <div style={{ background: "var(--ot-bg-panel)", border: "1px solid var(--ot-border)", borderRadius: 8, color: "var(--ot-text-primary)", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 12, borderBottom: "1px solid var(--ot-border)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>LIQUIDATION FEED</div>
        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: tone, color: "var(--ot-bg-panel)", whiteSpace: "nowrap" }}>{badgeText}</span>
      </div>
      <div style={{ padding: 12, overflowY: "auto", flex: 1 }}>
        {rows.length === 0 ? (
          <div style={{ color: "var(--ot-text-muted)", fontSize: 12, padding: 24, textAlign: "center" }}>No liquidations</div>
        ) : (
          rows.map((liq, i) => (
            <div key={`${liq.exchange}-${liq.t}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderBottom: "1px solid var(--ot-border)", fontSize: 12 }}>
              <span style={{ color: "var(--ot-text-muted)", minWidth: 52 }}>{fmtTime(liq.t)}</span>
              <span style={{ minWidth: 80, color: "var(--ot-text-secondary)" }}>{fmtPrice(liq.price)}</span>
              <span style={{ minWidth: 100, color: "var(--ot-text-primary)" }}>${fmtUsd(liq.usd)}</span>
              <span style={{ color: liq.long ? "var(--ot-loss)" : "var(--ot-profit)", fontWeight: 600, letterSpacing: 0.5, marginLeft: "auto" }}>{liq.long ? "LONG LIQ" : "SHORT LIQ"}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
