/**
 * Module B proof: one learner plays through the game and claims a bounty.
 *
 *   npm run bounty:claim -- --relayer http://localhost:8787 --bounty 1
 *
 * Exactly the path a human takes: /register, complete the three founding
 * quests, sell the spare items, graduate, then `claim_bounty` through core.
 * Prints the claim's status as the board settles it and, for a Small bounty,
 * the learner's NEAR balance before and after (the board paid the reward).
 *
 * Options: --relayer URL  --bounty N (default 1)  --skip-game (claim only, for a
 *          bounty whose requirement the fresh learner already meets)
 */
import { Account, JsonRpcProvider, KeyPair, actions, encodeSignedDelegate, teraToGas } from "near-api-js";
import type { Action } from "near-api-js";
import { ITEMS, type Item } from "./economy.js";
import { loadLessons } from "./lessons.js";

const argv = process.argv.slice(2);
const flag = (name: string, dflt: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const relayerUrl = flag("relayer", process.env.RELAYER_URL ?? "http://localhost:8787").replace(/\/$/, "");
const bountyId = Number(flag("bounty", "1"));
const skipGame = argv.includes("--skip-game");
const rpcUrl = process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com";
const coreId = process.env.CORE_CONTRACT_ID ?? "core.bloqvia.testnet";
const provider = new JsonRpcProvider({ url: rpcUrl });

type Status = "Pending" | "Paid" | "Eligible" | { Proposed: { proposal_id: number } };
interface Claim { bounty_id: number; account_id: string; status: Status }
interface Bounty { id: number; title: string; tier: string; reward: string; requirement: unknown; claims: number; max_claims: number; open: boolean }

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${relayerUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(`${path}: ${json.error ?? res.status}`);
  return json;
}
const view = <T,>(contractId: string, method: string, args: Record<string, unknown> = {}) =>
  provider.callFunction({ contractId, method, args }) as Promise<T>;
const near = (yocto: string | bigint) => (Number(BigInt(yocto) / 10n ** 20n) / 10_000).toFixed(4);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const boardId = await view<string | null>(coreId, "get_bounties_contract");
if (!boardId) throw new Error(`${coreId} has no bounty board set (run deploy-bounties.sh)`);
const bounty = await view<Bounty | null>(boardId, "get_bounty", { bounty_id: bountyId });
if (!bounty) throw new Error(`No bounty #${bountyId} on ${boardId}`);
console.log(`board ${boardId} · bounty #${bounty.id} "${bounty.title}" (${bounty.tier}, ${near(bounty.reward)} NEAR, ${bounty.claims}/${bounty.max_claims} claimed) · requirement ${JSON.stringify(bounty.requirement)}`);

const key = KeyPair.fromRandom("ed25519");
const reg = await post<{ accountId: string }>("/register", { publicKey: key.getPublicKey().toString() });
const account = new Account(reg.accountId, provider, key.toString());
console.log(`learner ${reg.accountId} (fresh, key limited to core)`);

async function relay(method: string, args: Record<string, unknown>, gas: `${number}` = "40"): Promise<string> {
  const acts: Action[] = [actions.functionCall(method, args, teraToGas(gas), 0n)];
  const { signedDelegate } = await account.createSignedMetaTransaction({ receiverId: coreId, actions: acts, blockHeightTtl: 100 });
  const payload = Buffer.from(encodeSignedDelegate(signedDelegate)).toString("base64");
  return (await post<{ txHash: string }>("/relay", { payload })).txHash;
}

if (!skipGame) {
  for (const l of loadLessons()) {
    await relay("complete_lesson", { lesson_id: l.lesson_id, answer: l.answer });
    console.log(`  quest ${l.lesson_id} ✓`);
  }
  const learner = await view<{ items: [Item, string][] }>(coreId, "get_learner", { account_id: reg.accountId });
  for (const [item, n] of learner.items) {
    if (ITEMS.includes(item) && BigInt(n) > 1n) await relay("sell_to_bloq", { token_id: item, amount: String(BigInt(n) - 1n) });
  }
  await relay("graduate", {});
  console.log("  graduated ✓");
}

const before = (await provider.viewAccount({ accountId: reg.accountId })).amount;
const tx = await relay("claim_bounty", { bounty_id: bountyId }, "140");
console.log(`claim_bounty sent: https://testnet.nearblocks.io/txns/${tx}`);

let claim: Claim | null = null;
for (let i = 0; i < 15; i += 1) {
  claim = await view<Claim | null>(boardId, "get_claim", { bounty_id: bountyId, account_id: reg.accountId });
  if (claim && claim.status !== "Pending") break;
  if (!claim && i > 3) break;
  await sleep(700);
}
const after = (await provider.viewAccount({ accountId: reg.accountId })).amount;
if (!claim) {
  console.log("claim: rejected by the board (the reason is in the transaction's logs: 'claim rejected: …')");
  process.exit(1);
}
console.log(`claim: ${typeof claim.status === "string" ? claim.status : `Proposed to the DAO, proposal #${claim.status.Proposed.proposal_id}`}`);
console.log(`learner balance: ${near(before)} → ${near(after)} NEAR`);
if (typeof claim.status === "object") {
  const cfg = await view<{ dao_id: string }>(boardId, "get_config");
  console.log(`council: near contract call-function as-transaction ${cfg.dao_id} act_proposal json-args '{"id":${claim.status.Proposed.proposal_id},"action":"VoteApprove"}' prepaid-gas '100 Tgas' attached-deposit '0 NEAR' sign-as <council> network-config testnet sign-with-keychain send`);
}
