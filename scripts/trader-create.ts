/**
 * Make the NPC trader's account (Nov 10), once:
 *
 *   npm run trader:create -- --relayer http://localhost:8787
 *
 * A learner account like any player's: /register with a fresh key (function-call key limited to core), then the three
 * founding quests through the relayer, so it starts with 300 gold and three of each item. Prints the two lines for
 * relayer/.env (and Railway's variables). The key can only call core's six learner methods; it holds no NEAR to speak of.
 */
import { Account, JsonRpcProvider, KeyPair, actions, encodeSignedDelegate, teraToGas } from "near-api-js";
import type { Action } from "near-api-js";
import { loadLessons } from "./lessons.js";

const argv = process.argv.slice(2);
const flag = (name: string, dflt: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const relayerUrl = flag("relayer", process.env.RELAYER_URL ?? "http://localhost:8787").replace(/\/$/, "");
const rpcUrl = process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com";
const coreId = process.env.CORE_CONTRACT_ID ?? "core.bloqvia.testnet";
const provider = new JsonRpcProvider({ url: rpcUrl });

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${relayerUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(`${path}: ${json.error ?? res.status}`);
  return json;
}

const key = KeyPair.fromRandom("ed25519");
const reg = await post<{ accountId: string }>("/register", { publicKey: key.getPublicKey().toString() });
const account = new Account(reg.accountId, provider, key.toString());
console.log(`trader account ${reg.accountId} (registered, key limited to ${coreId})`);

async function relay(method: string, args: Record<string, unknown>): Promise<string> {
  const acts: Action[] = [actions.functionCall(method, args, teraToGas("40"), 0n)];
  const { signedDelegate } = await account.createSignedMetaTransaction({ receiverId: coreId, actions: acts, blockHeightTtl: 100 });
  const r = await post<{ txHash: string }>("/relay", { payload: Buffer.from(encodeSignedDelegate(signedDelegate)).toString("base64") });
  return r.txHash;
}

for (const l of loadLessons()) {
  const tx = await relay("complete_lesson", { lesson_id: l.lesson_id, answer: l.answer });
  console.log(`  quest ${l.lesson_id} done  tx=${tx}`);
}
const learner = (await provider.callFunction({ contractId: coreId, method: "get_learner", args: { account_id: reg.accountId } })) as { gold: string; items: [string, string][] };
console.log(`  holds ${learner.gold} gold and ${learner.items.map(([i, n]) => `${n} ${i}`).join(", ")}`);
console.log(`\nAdd to relayer/.env and to the hosted relayer's variables (never commit them):\nTRADER_ACCOUNT_ID=${reg.accountId}\nTRADER_PRIVATE_KEY=${key.toString()}\n\nexplorer: https://testnet.nearblocks.io/address/${reg.accountId}`);
