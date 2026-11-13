/**
 * Make the three purses (Nov 13), once, with the relayer's key:
 *
 *   cd scripts && set -a && source ../relayer/.env && set +a && npm run x402:setup            # dry run: the plan
 *   cd scripts && set -a && source ../relayer/.env && set +a && npm run x402:setup -- --apply
 *
 * A purse is the money an NPC trader may spend on the market desk's signal over x402 (relayer/src/purse.ts). Each is a
 * sub-account of the relayer with a fresh full-access key (x402 pays with a NEP-366 delegate, which a function-call
 * key cannot sign), funded with --fund NEAR, registered on the wNEAR token and holding --wrap NEAR wrapped: that
 * balance is the hard ceiling of what the agent can ever spend. The relayer itself (the desk's payee) is registered
 * on the token too, so the desk can be paid. Prints the six lines for relayer/.env and Railway's variables; never
 * commit them. An existing purse is left alone (its key is the one you kept).
 */
import { Account, JsonRpcProvider, KeyPair, actions, nearToYocto, teraToGas } from "near-api-js";

const argv = process.argv.slice(2);
const flag = (name: string, dflt: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const apply = argv.includes("--apply");
const fund = Number(flag("fund", "0.3")), wrap = Number(flag("wrap", "0.2"));
const rpcUrl = process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com";
const relayerId = process.env.RELAYER_ACCOUNT_ID, relayerKey = process.env.RELAYER_PRIVATE_KEY as `ed25519:${string}` | undefined;
const wnear = process.env.WNEAR_CONTRACT_ID ?? "wrap.testnet";
if (!relayerId || !relayerKey) { console.error("RELAYER_ACCOUNT_ID and RELAYER_PRIVATE_KEY are needed (source relayer/.env)"); process.exit(2); }
if (!(wrap < fund)) { console.error("--wrap must be under --fund (the rest pays storage and gas)"); process.exit(2); }

const provider = new JsonRpcProvider({ url: rpcUrl });
const relayer = new Account(relayerId, provider, relayerKey);
const PURSES = [["patient", "PURSE"], ["bull", "PURSE2"], ["bear", "PURSE3"]] as const;
const STORAGE = nearToYocto(0.00125);

async function exists(id: string): Promise<boolean> {
  try { await provider.viewAccount({ accountId: id }); return true; } catch (e) { if (/does not exist|UNKNOWN_ACCOUNT/i.test((e as Error).message)) return false; throw e; }
}
async function registered(id: string): Promise<boolean> {
  const b = (await provider.callFunction({ contractId: wnear, method: "storage_balance_of", args: { account_id: id } })) as { total: string } | null;
  return !!b;
}

console.log(`relayer ${relayerId} on ${rpcUrl}; token ${wnear}; ${apply ? "APPLYING" : "dry run (add --apply)"}\n`);
const lines: string[] = [];
if (!(await registered(relayerId))) {
  console.log(`- register ${relayerId} on ${wnear} (storage_deposit, 0.00125 NEAR): the desk's payee`);
  if (apply) await relayer.signAndSendTransaction({ receiverId: wnear, actions: [actions.functionCall("storage_deposit", { account_id: relayerId, registration_only: true }, teraToGas("30"), STORAGE)] });
} else console.log(`- ${relayerId} already registered on ${wnear}`);

for (const [temper, prefix] of PURSES) {
  const id = `purse-${temper}.${relayerId}`;
  if (await exists(id)) { console.log(`- ${id} exists: left alone (its key is the one in your .env)`); continue; }
  const key = KeyPair.fromRandom("ed25519");
  console.log(`- create ${id}: ${fund} NEAR, one full-access key; register on ${wnear}; wrap ${wrap} NEAR`);
  if (!apply) { lines.push(`${prefix}_ACCOUNT_ID=${id}`, `${prefix}_PRIVATE_KEY=<made on --apply>`); continue; }
  const made = await relayer.signAndSendTransaction({ receiverId: id, actions: [actions.createAccount(), actions.transfer(nearToYocto(fund)), actions.addFullAccessKey(key.getPublicKey())] });
  console.log(`    created tx=${made.transaction.hash}`);
  const purse = new Account(id, provider, key.toString());
  const reg = await purse.signAndSendTransaction({ receiverId: wnear, actions: [actions.functionCall("storage_deposit", { account_id: id, registration_only: true }, teraToGas("30"), STORAGE), actions.functionCall("near_deposit", {}, teraToGas("30"), nearToYocto(wrap))] });
  console.log(`    registered and wrapped tx=${reg.transaction.hash}`);
  const bal = (await provider.callFunction({ contractId: wnear, method: "ft_balance_of", args: { account_id: id } })) as string;
  console.log(`    holds ${(Number(BigInt(bal) / 10n ** 20n) / 10000).toFixed(4)} wNEAR  explorer: https://testnet.nearblocks.io/address/${id}`);
  lines.push(`${prefix}_ACCOUNT_ID=${id}`, `${prefix}_PRIVATE_KEY=${key.toString()}`);
}

if (lines.length) console.log(`\nAdd to relayer/.env and to the hosted relayer's variables (never commit them):\n${lines.join("\n")}`);
console.log(`\nAlso set on the hosted relayer: DESK_PUBLIC_URL=https://relay.bloqvia.app (the host the purses may pay; locally it defaults to http://localhost:8787).`);
