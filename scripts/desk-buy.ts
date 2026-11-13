/**
 * Buy from the market desk over x402 (Nov 13): the whole handshake once, in the open.
 *
 *   cd scripts && set -a && source ../relayer/.env && set +a && npm run desk:buy -- --relayer https://relay.bloqvia.app
 *   ... --proof learner-a5c72adf2f00.bloqvia.testnet      # also buy a signed Passport proof of that account (0.05 wNEAR)
 *
 * Pays from the patient trader's purse (PURSE_ACCOUNT_ID / PURSE_PRIVATE_KEY in relayer/.env). Prints the unpaid
 * answer first (402 and the price the desk asks), then pays, prints the answer and the settlement's transaction, and
 * the purse's ledger after. Without a purse it still shows the 402 and stops: that part needs no money.
 */
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { Purse, PurseError, WNEAR, fmt } from "../relayer/src/purse.js";
import { verifyProof, type Proof } from "../relayer/src/desk.js";

const argv = process.argv.slice(2);
const flag = (name: string, dflt: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const relayerUrl = flag("relayer", process.env.RELAYER_URL ?? "http://localhost:8787").replace(/\/$/, "");
const proofOf = flag("proof", "");
const rpcUrl = process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com";
const explorer = (tx: string) => `https://testnet.nearblocks.io/txns/${tx}`;

async function unpaid(path: string): Promise<void> {
  const res = await fetch(`${relayerUrl}${path}`);
  const body = await res.text();
  console.log(`GET ${path} without paying -> ${res.status}\n    ${body.slice(0, 160)}`);
  const h = res.headers.get("PAYMENT-REQUIRED");
  if (h) { const pr = decodePaymentRequiredHeader(h); for (const a of pr.accepts) console.log(`    PAYMENT-REQUIRED: ${a.scheme} on ${a.network}, ${fmt(BigInt(a.amount))} of ${a.asset} to ${a.payTo}`); }
}

await unpaid("/desk/signal");
const accountId = process.env.PURSE_ACCOUNT_ID, key = process.env.PURSE_PRIVATE_KEY as `ed25519:${string}` | undefined;
if (!accountId || !key) { console.log("\nNo PURSE_ACCOUNT_ID / PURSE_PRIVATE_KEY in the environment: that is the 402; paying needs a purse (npm run x402:setup)."); process.exit(0); }

const purse = new Purse({ accountId, secretKey: key, rpcUrl, policy: { allowedHosts: [new URL(relayerUrl).host], maxPerCall: WNEAR / 20n, dailyBudget: WNEAR / 5n, asset: process.env.WNEAR_CONTRACT_ID ?? "wrap.testnet", network: "near:testnet" } });
console.log(`\npaying from ${accountId} (at most ${fmt(purse.policy.maxPerCall)} a call, ${fmt(purse.policy.dailyBudget)} today)`);
try {
  const { body, purchase } = await purse.buy<{ at: number; average: Record<string, string> | null; round: unknown; traders: unknown[] }>(`${relayerUrl}/desk/signal`);
  console.log(`\nsignal bought for ${fmt(BigInt(purchase.amount))}  tx ${purchase.txHash}\n    ${explorer(purchase.txHash ?? "")}\n    day average: ${JSON.stringify(body.average)}\n    round: ${JSON.stringify(body.round)}\n    traders: ${JSON.stringify(body.traders).slice(0, 300)}`);
  if (proofOf) {
    const p = await purse.buy<Proof>(`${relayerUrl}/passport/proof?accountId=${encodeURIComponent(proofOf)}`);
    console.log(`\nproof of ${proofOf} bought for ${fmt(BigInt(p.purchase.amount))}  tx ${p.purchase.txHash}\n    ${explorer(p.purchase.txHash ?? "")}\n    statement: ${JSON.stringify(p.body.statement)}\n    signed by ${p.body.issuer} (${p.body.public_key}); verifies here with the public key alone: ${verifyProof(p.body)}`);
  }
} catch (e) {
  console.log(`\nnot bought: ${e instanceof PurseError ? `${e.reason}: ` : ""}${(e as Error).message}`);
  process.exit(1);
}
console.log(`\npurse after: ${JSON.stringify(purse.view())}`);
