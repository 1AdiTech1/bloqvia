/**
 * Warn before a Bloqvia account runs out of testnet NEAR.
 *
 *   cd scripts && npm run balances            # exit 1 if any account is low
 *   npm run balances -- --parent bloqvia.testnet --rpc https://rpc.testnet.near.org
 *
 * Contracts must keep 1 NEAR locked per 100 KB they store (storage staking).
 * "Free" is what's left after that. When a contract's free balance reaches 0
 * every call that stores data fails with LackBalanceForState, as the streak
 * contract did on Nov 7. The relayer (the parent account) pays every player's
 * gas and 0.01 NEAR per new learner, so it needs a bigger cushion.
 * Read-only: no keys, no transactions.
 */
const YOCTO_PER_BYTE = 10n ** 19n; // 1 NEAR = 1e24 yocto per 100 KB (1e5 bytes)
const YOCTO = 10n ** 24n;

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
};
const parent = arg("parent", process.env["RELAYER_ACCOUNT_ID"] ?? "bloqvia.testnet");
const rpc = arg("rpc", process.env["NEAR_RPC_URL"] ?? "https://test.rpc.fastnear.com");

const accounts: Array<{ id: string; role: string; minFree: number }> = [
  { id: parent, role: "relayer (pays gas, funds learners)", minFree: 3 },
  { id: `core.${parent}`, role: "game contract", minFree: 0.5 },
  { id: `passport.${parent}`, role: "Passport NFT", minFree: 0.5 },
  { id: `streak.${parent}`, role: "community streak", minFree: 0.5 },
  { id: `bounties.${parent}`, role: "Missions board", minFree: 0.5 },
];

const near = (y: bigint) => Number(y / 10n ** 20n) / 10_000; // 4 decimals

async function view(id: string): Promise<{ amount: bigint; storage: bigint } | null> {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "b", method: "query", params: { request_type: "view_account", finality: "final", account_id: id } }),
  });
  const json = (await res.json()) as { result?: { amount: string; storage_usage: number }; error?: unknown };
  if (!json.result) return null;
  return { amount: BigInt(json.result.amount), storage: BigInt(json.result.storage_usage) };
}

let low = 0;
console.log(`RPC ${rpc}\n`);
console.log("account".padEnd(30), "balance".padStart(10), "locked".padStart(9), "free".padStart(9), "  status");
for (const a of accounts) {
  const v = await view(a.id);
  if (!v) { console.log(a.id.padEnd(30), "  (not found; skipped)"); continue; }
  const locked = v.storage * YOCTO_PER_BYTE;
  const free = v.amount - locked;
  const ok = free >= BigInt(Math.round(a.minFree * 10_000)) * (YOCTO / 10_000n);
  if (!ok) low += 1;
  console.log(a.id.padEnd(30), near(v.amount).toFixed(4).padStart(10), near(locked).toFixed(4).padStart(9), near(free).toFixed(4).padStart(9),
    ok ? "  ok" : `  LOW: keep at least ${a.minFree} NEAR free (${a.role})`);
}
if (low) {
  console.log(`\n${low} account(s) low. Top up from ${parent}, e.g.:`);
  console.log(`  near tokens ${parent} send-near streak.${parent} '1 NEAR' network-config testnet sign-with-keychain send`);
  console.log("Refill the relayer itself from the testnet faucet: https://docs.near.org/getting-started/faucet");
  process.exitCode = 1;
} else console.log("\nAll accounts have room.");
