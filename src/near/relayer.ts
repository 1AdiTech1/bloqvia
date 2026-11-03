/** HTTP client for the Bloqvia relayer. The relayer pays every fee. */
import { NEAR_CONFIG } from "./config";
import type { RegisterResult, RelayResult } from "./types";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${NEAR_CONFIG.relayerUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(json.error ?? `Relayer ${path} failed with ${res.status}`);
  return json;
}

export const relayerApi = {
  /** Path B: the relayer creates learner-<hash>.bloqvia.testnet for this key. */
  registerKey: (publicKey: string) => post<RegisterResult>("/register", { publicKey }),
  /** Path A: an account that already exists (NEAR Auth) only needs registering. */
  registerAccount: (accountId: string) => post<RegisterResult>("/register", { accountId }),
  /** Relays one allow-listed signed delegate. */
  relay: (payload: string) => post<RelayResult>("/relay", { payload }),
  health: async () => {
    const res = await fetch(`${NEAR_CONFIG.relayerUrl}/health`);
    return (await res.json()) as { ok: boolean; core: string; passport: string; network: string };
  },
};
