import { useOrderFlowStore } from "../../stores/orderFlowStore";

export function WhaleFeed() {
  const trades = useOrderFlowStore((s) => s.trades);
  const feedStates = useOrderFlowStore((s) => s.feedStates);

  const whales = [...trades]
    .filter((t) => t.quoteQty >= 5000)
    .sort((a, b) => b.timestamp - a.timestamp);

  const allLive = Object.values(feedStates).length > 0 && Object.values(feedStates).every((v) => v === "LIVE");

  const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour12: false });
  const fmtUsd = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sideColor = (side: "buy" | "sell") => (side === "buy" ? "var(--ot-profit)" : "var(--ot-loss)");

  return (
    <div style={{ background: "var(--ot-bg-panel)", border: "1px solid var(--ot-border)", borderRadius: 8, color: "var(--ot-text-primary)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 12, borderBottom: "1px solid var(--ot-border)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>WHALE FEED</div>
        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: allLive ? "var(--ot-profit)" : "var(--ot-loss)", color: "var(--ot-bg-panel)" }}>
          {allLive ? "FEED LIVE" : "FEED DEGRADED"}
        </span>
      </div>
      <div style={{ padding: 12 }}>
        {whales.length === 0 ? (
          <div style={{ color: "var(--ot-text-muted)", fontSize: 12, padding: 24, textAlign: "center" }}>No whales detected</div>
        ) : (
          whales.map((t) => (
            <div key={t.tradeId} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderBottom: "1px solid var(--ot-border)", fontSize: 12 }}>
              <span style={{ color: "var(--ot-text-muted)", minWidth: 52 }}>{fmtTime(t.timestamp)}</span>
              <span style={{ minWidth: 70, color: "var(--ot-text-secondary)" }}>{t.price.toFixed(2)}</span>
              <span style={{ minWidth: 60 }}>{t.qty.toFixed(4)}</span>
              <span style={{ minWidth: 80, color: "var(--ot-text-primary)" }}>${fmtUsd(t.quoteQty)}</span>
              <span style={{ color: sideColor(t.side), fontWeight: 600, minWidth: 44, textTransform: "uppercase" }}>{t.side}</span>
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "var(--ot-bg-hover)", border: "1px solid var(--ot-border)", color: "var(--ot-text-secondary)" }}>WHALE</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
