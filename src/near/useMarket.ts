/**
 * The living market (Nov 10): what the relayer records about Bloq's shop beyond the numbers on chain right now.
 *
 *   const m = useMarket();
 *   m.history("fuel-cell")        // [{ t, buy, sell, stock }] over the last 48 h, oldest first
 *   m.change("fuel-cell")         // "He pays" now minus 24 h ago (null until there is a day of points)
 *   m.trader                      // the NPC trader: account, last move, the rules it follows
 *   m.fastForward                 // the "watch a day of trading" run: running, round, log, nextAt
 *   await m.startFastForward()    // starts one; returns the relayer's reason when it is gated
 *
 * Read-only against the relayer (GET /market); the only write is POST /fastforward, which the relayer caps.
 * Polls every 15 s, every 2 s while a run is on, only while the tab is visible.
 */
import { useEffect, useState } from "react";
import { NEAR_CONFIG } from "./config";
import type { ItemId } from "./config";

export interface PricePoint { t: number; buy: number; sell: number; stock: number }
export interface MarketSnapshot { t: number; gold: string; shop_open: boolean; prices: { token_id: string; bloq_stock: string; buy_price: string; sell_price: string }[] }
export interface TraderMove { kind: "sell" | "buy"; token_id: ItemId; amount: number; price: string; at: number; txHash: string; reason?: string }
/** The trader's last look (Nov 11): what the agent on NEAR AI Cloud chose, why, and whether the rules let it. */
export interface TraderThought { at: number; move: "sell" | "buy" | "hold"; token_id: ItemId | null; reason: string; allowed: string[]; overruled: boolean; generated_by: { provider: string; model: string; chat_id: string; signature_kind: string | null } }
export interface TraderView { accountId: string | null; on: boolean; mind?: "ai" | "rules"; last: TraderMove | null; lastThought?: TraderThought | null; lastTick: number | null; note: string; rules: { sellAbove: string; buyBelow: string; band?: string; keepGold: string; keepItems: string; intervalMin: number } }
export interface FFLine { at: number; who: string; text: string; txHash?: string }
export interface FastForwardView { running: boolean; round: number; rounds: number; startedAt: number | null; finishedAt: number | null; nextAt: number; runsToday: number; dailyCap: number; log: FFLine[]; error: string | null; players: number; everyMin: number }
export interface MarketData { now: number; snapshots: MarketSnapshot[]; latest: MarketSnapshot | null; trader: TraderView; fastForward: FastForwardView }

export interface Market {
  data: MarketData | null;
  loading: boolean;
  error: string | null;
  history(item: ItemId): PricePoint[];
  change(item: ItemId): number | null;
  trader: TraderView | null;
  fastForward: FastForwardView | null;
  startFastForward(): Promise<string | null>;
  refresh(): Promise<void>;
}

const DAY = 24 * 60 * 60 * 1000;

export function historyOf(data: MarketData | null, item: ItemId): PricePoint[] {
  if (!data) return [];
  const out: PricePoint[] = [];
  for (const s of data.snapshots) {
    const p = s.prices.find((x) => x.token_id === item);
    if (p) out.push({ t: s.t, buy: Number(p.buy_price), sell: Number(p.sell_price), stock: Number(p.bloq_stock) });
  }
  return out;
}

/** "He pays" now minus the oldest point at least a day old (or the oldest we have once there are 2+ points). */
export function changeOf(data: MarketData | null, item: ItemId): number | null {
  const h = historyOf(data, item);
  if (h.length < 2) return null;
  const now = h[h.length - 1]!;
  const ref = [...h].reverse().find((p) => now.t - p.t >= DAY) ?? h[0]!;
  return now.buy - ref.buy;
}

async function fetchMarket(signal?: AbortSignal): Promise<MarketData> {
  const res = await fetch(`${NEAR_CONFIG.relayerUrl}/market`, signal ? { signal } : {});
  if (!res.ok) throw new Error(`market: ${res.status}`);
  return (await res.json()) as MarketData;
}

export function useMarket(): Market {
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const running = data?.fastForward.running ?? false;

  useEffect(() => {
    let alive = true, timer: ReturnType<typeof setTimeout> | undefined;
    const ctrl = new AbortController();
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try { const d = await fetchMarket(ctrl.signal); if (alive) { setData(d); setError(null); } }
        catch (e) { if (alive && !(e instanceof DOMException && e.name === "AbortError")) setError((e as Error).message); }
        finally { if (alive) setLoading(false); }
      }
      if (alive) timer = setTimeout(tick, running ? 2000 : 15000);
    };
    void tick();
    const onVisible = () => { if (document.visibilityState === "visible") { clearTimeout(timer); void tick(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; clearTimeout(timer); ctrl.abort(); document.removeEventListener("visibilitychange", onVisible); };
  }, [running]);

  return {
    data, loading, error,
    history: (item) => historyOf(data, item),
    change: (item) => changeOf(data, item),
    trader: data?.trader ?? null,
    fastForward: data?.fastForward ?? null,
    startFastForward: async () => {
      try {
        const res = await fetch(`${NEAR_CONFIG.relayerUrl}/fastforward`, { method: "POST" });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) return json.error ?? `fastforward: ${res.status}`;
        setData((d) => (d ? { ...d, fastForward: { ...d.fastForward, running: true, round: 0, log: [], startedAt: Date.now(), finishedAt: null, error: null } } : d));
        return null;
      } catch (e) { return (e as Error).message; }
    },
    refresh: async () => { try { setData(await fetchMarket()); setError(null); } catch (e) { setError((e as Error).message); } },
  };
}
