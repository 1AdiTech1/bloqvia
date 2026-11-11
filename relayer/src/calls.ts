/**
 * The price call (Nov 11): the relayer settles each finished round, a minute after it ends, so a learner sees the
 * result without waiting for someone to press a button. Anyone may call `settle_calls`; the relayer only pays the
 * gas. It reads the round first and sends nothing when there were no calls or it is already settled.
 */
import { teraToGas } from "near-api-js";
import { view, withRetry, type NearContext } from "./near.js";

export const ITEMS = ["key-fragment", "fuel-cell", "contract-seal"] as const;
export const ROUND_SECONDS = 600;

interface RoundView { round: number; settled: boolean; calls: unknown[] }

/** How many finished rounds a tick looks at: the last two every minute, the last twelve (two hours) at start. */
export const LOOKBACK = { tick: 2, start: 12 } as const;

/**
 * Settle every item's finished rounds that have calls and are not settled, from the newest back `lookback` rounds.
 * The usual case is one round; the lookback is for a relayer restart (a deploy takes a minute or two) so no stake
 * waits on it. Returns what it settled.
 */
export async function settleFinishedRounds(ctx: NearContext, log: (s: string) => void = console.log, lookback: number = LOOKBACK.tick): Promise<string[]> {
  const [current] = await withRetry(() => view<[number, number, boolean]>(ctx, ctx.config.coreContractId, "get_call_round"));
  const done: string[] = [];
  for (let back = 1; back <= lookback; back += 1) {
    const round = current - back;
    if (round < 0) break;
    for (const item of ITEMS) {
      const r = await withRetry(() => view<RoundView>(ctx, ctx.config.coreContractId, "get_price_calls", { token_id: item, round }));
      if (r.settled || r.calls.length === 0) continue;
      const close = await withRetry(() => ctx.relayer.callFunction<string>({ contractId: ctx.config.coreContractId, methodName: "settle_calls", args: { token_id: item, round }, gas: teraToGas("250"), deposit: 0n }));
      log(`[calls] ${item} round ${round}: ${r.calls.length} call(s) settled at ${close}`);
      done.push(`${item}@${round}`);
    }
  }
  return done;
}

/** Every minute. Cheap: six views; a transaction only when a round had calls. The first tick looks two hours back. */
export function startCallSettler(ctx: NearContext, everyMs = 60_000): () => void {
  const tick = (lookback: number) => settleFinishedRounds(ctx, console.log, lookback).catch((e) => {
    const m = (e as Error).message ?? "";
    if (!/MethodNotFound|get_call_round/.test(m)) console.error(`[calls] ${m}`);
  });
  void tick(LOOKBACK.start);
  const id = setInterval(() => void tick(LOOKBACK.tick), everyMs);
  return () => clearInterval(id);
}
