/** One provider and one signing account for the whole relayer process. */
import { Account, JsonRpcProvider, nearToYocto, teraToGas } from "near-api-js";
import type { RelayerConfig } from "./config.js";

export interface NearContext {
  provider: JsonRpcProvider;
  relayer: Account;
  config: RelayerConfig;
}

export function createNearContext(config: RelayerConfig): NearContext {
  const provider = new JsonRpcProvider({ url: config.rpcUrl });
  const relayer = new Account(config.relayerAccountId, provider, config.relayerPrivateKey);
  return { provider, relayer, config };
}

/** Read-only call to a contract view method. */
export async function view<T>(ctx: NearContext, contractId: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  const result = await ctx.provider.callFunction({ contractId, method, args });
  return result as T;
}

export const GAS_30 = teraToGas("30");
export const ZERO = nearToYocto("0");

/** The public RPC rate-limits bursts (-429). Retry with a short backoff; anything else is thrown at once. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let wait = 1000;
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) {
      const m = (e as Error).message ?? "";
      if (i >= attempts || !/429|Rate limit|Too Many/i.test(m)) throw e;
      await new Promise((r) => setTimeout(r, wait)); wait *= 2;
    }
  }
}
export const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
