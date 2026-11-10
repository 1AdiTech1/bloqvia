/**
 * "He pays · 24 h": the small curve under the prices on a trade card (the living market, Nov 10).
 *
 *   <PriceHistory points={market.history("fuel-cell")} change={market.change("fuel-cell")} />
 *
 * Draws what it is given (the relayer's snapshots of Bloq's buy price), nothing else: no fetching, no numbers of its
 * own. With fewer than two points it shows "collecting…" so a fresh relayer never shows an empty box. Colours are
 * the app's (navy, purple, lime); the change reads green up, coral down, like the Passport's stamps.
 */
/** One point of the relayer's history (the shape `useMarket().history()` returns). */
export interface PricePoint { t: number; buy: number; sell: number; stock: number }

export interface PriceHistoryProps {
  points: PricePoint[];
  /** "He pays" now minus a day ago; null until there is a day of points. */
  change: number | null;
  label?: string;
  className?: string;
}

export function PriceHistory({ points, change, label = "He pays · 24 h", className }: PriceHistoryProps) {
  const W = 160, H = 44;
  const vals = points.map((p) => p.buy);
  let path = "", area = "", last: [number, number] | null = null;
  if (vals.length >= 2) {
    const mn = Math.min(...vals), mx = Math.max(...vals), r = Math.max(1, mx - mn);
    const pts = vals.map((v, i) => [(i / (vals.length - 1)) * W, H - 4 - ((v - mn) / r) * (H - 10)] as [number, number]);
    path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    area = `${path} L${W} ${H} L0 ${H} Z`;
    last = pts[pts.length - 1]!;
  }
  const delta = change === null ? null : change >= 0 ? `▲ +${change} since yesterday` : `▼ ${change} since yesterday`;
  return (
    <div className={className} data-price-history="" style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <b style={{ font: "600 12px/1.4 var(--font-display, 'Space Grotesk', sans-serif)" }}>{label}</b>
        <span style={{ font: "500 10.5px/1.4 var(--font-mono, 'JetBrains Mono', monospace)", color: change === null ? "var(--muted-foreground, #4f5b6e)" : change >= 0 ? "#5a8a00" : "#b4471f" }}>
          {delta ?? (vals.length < 2 ? "collecting…" : "")}
        </span>
      </div>
      {vals.length >= 2 ? (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H, display: "block" }} role="img" aria-label={`${label}: ${vals[0]} to ${vals[vals.length - 1]} gold`}>
          <path d={area} fill="rgb(139 69 217 / .12)" />
          <path d={path} fill="none" stroke="#6630b3" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {last && <circle cx={last[0]} cy={last[1]} r={3} fill="#d4f033" stroke="#16243a" strokeWidth={1.5} />}
        </svg>
      ) : (
        <div style={{ height: H, borderRadius: 10, background: "rgb(139 69 217 / .08)" }} aria-hidden="true" />
      )}
    </div>
  );
}
