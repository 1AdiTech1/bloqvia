/**
 * Reopen the bounties that testing used up (Nov 10).
 *
 *   set -a; source ../relayer/.env; set +a; npm run bounty:reopen            # dry run: prints what it would do
 *   set -a; source ../relayer/.env; set +a; npm run bounty:reopen -- --apply # closes and re-adds
 *
 * For every open bounty whose claims reached max_claims, the board (the owner, bloqvia.testnet) closes it and adds a
 * fresh copy with room: Small 100 claims, Medium 25, Large 10 (or --max N for all). Nothing else on the board changes;
 * the old claims stay in the history. Uses the contract's own add_bounty / close_bounty, the same calls the deploy
 * script makes. The daily "Today's quest, done" bounty is the relayer's (relayer/src/bounties.ts) and is skipped here.
 */
import { Account, JsonRpcProvider, nearToYocto, teraToGas } from "near-api-js";
import type { KeyPairString } from "near-api-js";

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const flagMax = (() => { const i = argv.indexOf("--max"); return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : null; })();
const rpcUrl = process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com";
const ownerId = process.env.OWNER_ACCOUNT_ID ?? process.env.RELAYER_ACCOUNT_ID;
const ownerKey = (process.env.OWNER_PRIVATE_KEY ?? process.env.RELAYER_PRIVATE_KEY) as KeyPairString | undefined;
const coreId = process.env.CORE_CONTRACT_ID ?? "core.bloqvia.testnet";
if (!ownerId || !ownerKey) {
  console.error("Set OWNER_ACCOUNT_ID and OWNER_PRIVATE_KEY (or source relayer/.env)");
  process.exit(1);
}

interface Bounty { id: number; title: string; description: string; tier: "Small" | "Medium" | "Large"; reward: string; requirement: unknown; claims: number; max_claims: number; open: boolean }
const ROOM: Record<Bounty["tier"], number> = { Small: 100, Medium: 25, Large: 10 };
const DAILY_TITLE = "Today's quest, done";

const provider = new JsonRpcProvider({ url: rpcUrl });
const owner = new Account(ownerId, provider, ownerKey);
const view = <T,>(contractId: string, method: string, args: Record<string, unknown> = {}) => provider.callFunction({ contractId, method, args }) as Promise<T>;
const near = (yocto: string) => (Number(BigInt(yocto) / 10n ** 20n) / 10_000).toFixed(2);

const boardId = await view<string | null>(coreId, "get_bounties_contract");
if (!boardId) throw new Error(`${coreId} has no bounty board set`);
const bounties = await view<Bounty[]>(boardId, "get_bounties");
console.log(`board ${boardId} · ${bounties.length} bounties${apply ? "" : " · DRY RUN (add --apply to do it)"}`);
for (const b of bounties) console.log(`  #${b.id} ${b.open ? "open  " : "closed"} ${b.tier.padEnd(6)} ${near(b.reward)} NEAR  ${b.claims}/${b.max_claims}  ${b.title}`);

const full = bounties.filter((b) => b.open && b.claims >= b.max_claims && b.title !== DAILY_TITLE);
if (!full.length) { console.log("nothing is fully claimed; nothing to do"); process.exit(0); }

for (const b of full) {
  const max_claims = flagMax ?? ROOM[b.tier];
  const fresh = { title: b.title, description: b.description, tier: b.tier, reward: b.reward, requirement: b.requirement, max_claims };
  console.log(`\n#${b.id} "${b.title}" is ${b.claims}/${b.max_claims}: close it, add a copy with ${max_claims} claims`);
  if (!apply) continue;
  await owner.callFunction({ contractId: boardId, methodName: "close_bounty", args: { bounty_id: b.id }, gas: teraToGas("30"), deposit: nearToYocto("0") });
  const id = await owner.callFunction({ contractId: boardId, methodName: "add_bounty", args: { bounty: fresh }, gas: teraToGas("30"), deposit: nearToYocto("0") });
  console.log(`  closed #${b.id}, added #${String(id)} → https://testnet.nearblocks.io/address/${boardId}`);
}
if (apply) {
  const after = await view<Bounty[]>(boardId, "get_bounties");
  console.log("\nnow:");
  for (const b of after.filter((x) => x.open)) console.log(`  #${b.id} ${b.tier.padEnd(6)} ${b.claims}/${b.max_claims}  ${b.title}`);
}
