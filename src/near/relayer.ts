/** HTTP client for the Bloqvia relayer. The relayer pays every fee. */
import { NEAR_CONFIG } from "./config";
import type { AskResult, RegisterResult, RelayResult, SeatResult, ProposeInput, ProposeResult } from "./types";

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
  /** Path B: the learner's key for core and, since Nov 10, the second key for the cohort DAO (the Passport's vote). */
  registerKey: (publicKey: string, daoPublicKey?: string) => post<RegisterResult>("/register", { publicKey, ...(daoPublicKey ? { daoPublicKey } : {}) }),
  /** The account's seats on the cohort DAO and whether this session's second key is on the account. */
  seat: async (accountId: string, daoPublicKey: string | null): Promise<SeatResult> => {
    const q = new URLSearchParams({ accountId, ...(daoPublicKey ? { daoPublicKey } : {}) });
    const res = await fetch(`${NEAR_CONFIG.relayerUrl}/seat?${q}`);
    if (!res.ok) throw new Error(`Relayer /seat failed with ${res.status}`);
    return (await res.json()) as SeatResult;
  },
  /** Path A: an account that already exists (NEAR Auth) only needs registering. */
  registerAccount: (accountId: string) => post<RegisterResult>("/register", { accountId }),
  /** Founders: propose a bounty; the relayer files it on the DAO (relayer/src/propose.ts) and founders vote. */
  propose: (accountId: string, input: ProposeInput, signed: { message: string; signature: string; publicKey: string }) => post<ProposeResult>("/propose", { accountId, ...input, signed }),
  /** Relays one allow-listed signed delegate. */
  relay: (payload: string) => post<RelayResult>("/relay", { payload }),
  /** Ask Bloq: a grounded, signed answer from the model on NEAR AI Cloud. Text only. */
  ask: (question: string, lessonId?: string, accountId?: string | null) =>
    post<AskResult>("/ask", { question, lessonId, accountId: accountId ?? undefined }),
  health: async () => {
    const res = await fetch(`${NEAR_CONFIG.relayerUrl}/health`);
    return (await res.json()) as { ok: boolean; core: string; passport: string; network: string };
  },
};
