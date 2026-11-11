/**
 * The living market (Nov 10): what the shop page shows beyond today's numbers.
 *
 *  - Price snapshots: `get_bloq` read every SNAPSHOT_MIN minutes and after every relayed trade, kept in memory
 *    (the last 48 h), served by GET /market so each trade card can draw "He pays · 24 h".
 *  - The NPC trader (trader.ts) and the fast-forward (fastforward.ts) report their state through the same endpoint.
 *
 * Everything here reads the chain; prices and rewards are still decided only by bloqvia-core.
 */
import { view, withRetry, type NearContext } from "./near.js";

export interface PricePoint { token_id: string; bloq_stock: string; buy_price: string; sell_price: string }
export interface Snapshot { t: number; gold: string; shop_open: boolean; prices: PricePoint[] }
interface BloqView { gold: string; shop_open: boolean; prices: PricePoint[] }

export const SNAPSHOT_MIN = 10;
/** 48 h at one every 10 min, plus one per trade: enough for the curve, small enough to keep in memory. */
export const KEEP_MS = 48 * 60 * 60 * 1000;
export const MAX_POINTS = 1200;

const snapshots: Snapshot[] = [];

/** Prune to the window, keep at most MAX_POINTS (drop the oldest). */
export function prune(list: Snapshot[], now = Date.now()): Snapshot[] {
  const cut = now - KEEP_MS;
  let out = list.filter((s) => s.t >= cut);
  if (out.length > MAX_POINTS) out = out.slice(out.length - MAX_POINTS);
  return out;
}

/** Downsample to at most n points for the wire, always keeping the newest. */
export function thin(list: Snapshot[], n = 200): Snapshot[] {
  if (list.length <= n) return list;
  const step = (list.length - 1) / (n - 1), out: Snapshot[] = [];
  for (let i = 0; i < n; i++) out.push(list[Math.round(i * step)]!);
  return out;
}

export async function takeSnapshot(ctx: NearContext): Promise<Snapshot> {
  const b = await withRetry(() => view<BloqView>(ctx, ctx.config.coreContractId, "get_bloq"));
  const s: Snapshot = { t: Date.now(), gold: b.gold, shop_open: b.shop_open, prices: b.prices.map((p) => ({ token_id: p.token_id, bloq_stock: p.bloq_stock, buy_price: p.buy_price, sell_price: p.sell_price })) };
  snapshots.push(s);
  const kept = prune(snapshots);
  snapshots.splice(0, snapshots.length, ...kept);
  return s;
}

export function getSnapshots(): Snapshot[] { return thin(prune(snapshots)); }
export function latest(): Snapshot | null { return snapshots[snapshots.length - 1] ?? null; }

/**
 * The day's average of Bloq's buy price, per item: the last 24 h of snapshots, or the newest point alone when the
 * relayer is young. It is what the bots call a fair price (Nov 11): they sell a little under it and buy a little
 * over it, each with its own idea of "a little", so the market moves around its own average instead of waiting
 * for a line nobody crosses. Pure, tested. Null with no snapshot at all.
 */
export function dayAverage(list: Snapshot[], now = Date.now()): Record<string, bigint> | null {
  const day = list.filter((s) => s.t >= now - 24 * 60 * 60 * 1000);
  const use = day.length ? day : list.slice(-1);
  if (!use.length) return null;
  const sum = new Map<string, bigint>(), n = new Map<string, bigint>();
  for (const s of use) for (const p of s.prices) { sum.set(p.token_id, (sum.get(p.token_id) ?? 0n) + BigInt(p.buy_price)); n.set(p.token_id, (n.get(p.token_id) ?? 0n) + 1n); }
  return Object.fromEntries([...sum].map(([k, v]) => [k, v / n.get(k)!]));
}
export function fairPrices(): Record<string, bigint> | null { return dayAverage(snapshots); }

/** One snapshot now, then one every SNAPSHOT_MIN minutes. */
export function startSnapshots(ctx: NearContext, everyMs = SNAPSHOT_MIN * 60 * 1000): () => void {
  const tick = () => takeSnapshot(ctx).catch((e) => console.error(`[market] snapshot: ${(e as Error).message}`));
  void tick();
  const id = setInterval(tick, everyMs);
  return () => clearInterval(id);
}

/** Called by the relay after a trade went through, so the curve has the trade's point. Never throws. */
export function afterTrade(ctx: NearContext): void {
  takeSnapshot(ctx).catch(() => undefined);
}
