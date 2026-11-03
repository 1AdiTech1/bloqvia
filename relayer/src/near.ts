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
