/**
 * Buy tomorrow's — or today's, if free — sponsored slot over x402 (Nov 14): what an outside sponsor does.
 *
 *   cd scripts && set -a && source ../relayer/.env && set +a && npm run sponsor:buy -- --relayer https://relay.bloqvia.app --name "Beacon Bridge" --url https://beacon.example --quest my-quest.json
 *
 * `my-quest.json` has the daily quest's shape: title, topic, concept, question, options (3), answer (one of them),
 * success, near_reveal, explanation (relayer/src/quests.ts LIMITS). Pays 0.5 wNEAR from PURSE_ACCOUNT_ID's purse.
 * Without --quest the house quest of the day is used, so the round trip can be seen without writing one.
 * The slot is one a day: when it is taken the desk answers 403 before asking for any payment.
 */
import { readFileSync } from "node:fs";
import { Purse, PurseError, WNEAR, fmt } from "../relayer/src/purse.js";
import { houseQuestFor } from "../relayer/src/sponsor.js";

const argv = process.argv.slice(2);
const flag = (name: string, dflt: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const relayerUrl = flag("relayer", process.env.RELAYER_URL ?? "http://localhost:8787").replace(/\/$/, "");
const name = flag("name", "Beacon Bridge"), url = flag("url", "https://beacon.example"), questFile = flag("quest", "");
const rpcUrl = process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com";
const quest = questFile ? JSON.parse(readFileSync(questFile, "utf8")) : houseQuestFor(new Date());

const today = await fetch(`${relayerUrl}/sponsor/today`).then((r) => r.json()) as { lessonId: string; taken: boolean; price: string | null };
console.log(`today's slot ${today.lessonId}: ${today.taken ? "taken" : "free"} · price ${today.price}`);
if (today.taken) { console.log("Nothing to buy today; the desk would answer 403 before asking for a payment. Try again after 00:00 UTC."); process.exit(0); }

const accountId = process.env.PURSE_ACCOUNT_ID, key = process.env.PURSE_PRIVATE_KEY as `ed25519:${string}` | undefined;
if (!accountId || !key) { console.log("No PURSE_ACCOUNT_ID / PURSE_PRIVATE_KEY in the environment: paying needs a purse (npm run x402:setup)."); process.exit(0); }
const purse = new Purse({ accountId, secretKey: key, rpcUrl, policy: { allowedHosts: [new URL(relayerUrl).host], maxPerCall: WNEAR / 2n, dailyBudget: WNEAR / 2n, asset: process.env.WNEAR_CONTRACT_ID ?? "wrap.testnet", network: "near:testnet" } });
console.log(`paying from ${accountId}: "${quest.title}" for ${name}`);
try {
  const { body, purchase } = await purse.buy<{ lessonId: string; txHash: string }>(`${relayerUrl}/sponsor/quest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, url, quest }) });
  console.log(`\nslot bought for ${fmt(BigInt(purchase.amount))}  tx ${purchase.txHash}\n    https://testnet.nearblocks.io/txns/${purchase.txHash}\n    seeded as ${body.lessonId}; it is on the map now (GET /quests lists it with the sponsor and the payment)`);
} catch (e) {
  console.log(`\nnot bought: ${e instanceof PurseError ? `${e.reason}: ` : ""}${(e as Error).message}`);
  process.exit(1);
}
