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

/** Settle every item's previous round if it has calls and is not settled. Returns what it settled. */
export async function settleFinishedRounds(ctx: NearContext, log: (s: string) => void = console.log): Promise<string[]> {
  const [current] = await withRetry(() => view<[number, number, boolean]>(ctx, ctx.config.coreContractId, "get_call_round"));
  const prev = current - 1;
  const done: string[] = [];
  for (const item of ITEMS) {
    const r = await withRetry(() => view<RoundView>(ctx, ctx.config.coreContractId, "get_price_calls", { token_id: item, round: prev }));
    if (r.settled || r.calls.length === 0) continue;
    const close = await withRetry(() => ctx.relayer.callFunction<string>({ contractId: ctx.config.coreContractId, methodName: "settle_calls", args: { token_id: item, round: prev }, gas: teraToGas("250"), deposit: 0n }));
    log(`[calls] ${item} round ${prev}: ${r.calls.length} call(s) settled at ${close}`);
    done.push(`${item}@${prev}`);
  }
  return done;
}

/** Every minute. Cheap: three views; a transaction only when a round had calls. */
export function startCallSettler(ctx: NearContext, everyMs = 60_000): () => void {
  const tick = () => settleFinishedRounds(ctx).catch((e) => {
    const m = (e as Error).message ?? "";
    if (!/MethodNotFound|get_call_round/.test(m)) console.error(`[calls] ${m}`);
  });
  void tick();
  const id = setInterval(tick, everyMs);
  return () => clearInterval(id);
}
