/**
 * The Passport as a vote (Nov 10): put the two seat roles on the cohort DAO, once.
 *
 *   set -a; source ../relayer/.env; set +a
 *   npm run dao:roles                       # dry run: shows the policy as it is and as it would be
 *   npm run dao:roles -- --apply            # files the ChangePolicy proposal (bond 0.1 NEAR, returned) and approves it
 *   npm run dao:roles -- --seat <account> <graduates|founders>   # seat one account by hand (e.g. an older graduate)
 *
 *   graduates: vote on Transfer proposals (who gets paid for a medium bounty)
 *   founders:  that, plus FunctionCall proposals (what the cohort pays for: a new bounty, funding the board)
 * Threshold: one vote of a seat holder decides (testnet parameters). The council keeps everything it has.
 * From then on the relayer seats every graduation and every stamp by itself (relayer/src/seats.ts).
 */
import { Account, JsonRpcProvider, teraToGas } from "near-api-js";
import type { KeyPairString } from "near-api-js";

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const seatAt = argv.indexOf("--seat");
const rpcUrl = process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com";
const ownerId = process.env.OWNER_ACCOUNT_ID ?? process.env.RELAYER_ACCOUNT_ID;
const ownerKey = (process.env.OWNER_PRIVATE_KEY ?? process.env.RELAYER_PRIVATE_KEY) as KeyPairString | undefined;
const daoId = process.env.DAO_ID ?? "bloqvia-dao.sputnik-v2.testnet";
if (!ownerId || !ownerKey) { console.error("Set OWNER_ACCOUNT_ID and OWNER_PRIVATE_KEY (or source relayer/.env)"); process.exit(1); }

type VotePolicy = { weight_kind: string; quorum: string; threshold: string | [number, number] };
type Role = { name: string; kind: "Everyone" | { Group: string[] }; permissions: string[]; vote_policy: Record<string, VotePolicy> };
type Policy = { roles: Role[]; default_vote_policy: VotePolicy; proposal_bond: string; proposal_period: string; bounty_bond: string; bounty_forgiveness_period: string };

const ONE_VOTE: VotePolicy = { weight_kind: "RoleWeight", quorum: "0", threshold: "1" };
const SEATS: Record<string, Omit<Role, "kind">> = {
  graduates: { name: "graduates", permissions: ["transfer:VoteApprove", "transfer:VoteReject"], vote_policy: { transfer: ONE_VOTE } },
  founders: { name: "founders", permissions: ["transfer:VoteApprove", "transfer:VoteReject", "call:VoteApprove", "call:VoteReject"], vote_policy: { transfer: ONE_VOTE, call: ONE_VOTE } },
};
const groupOf = (p: Policy, name: string) => { const r = p.roles.find((x) => x.name === name); return r && typeof r.kind === "object" ? r.kind.Group : []; };

const provider = new JsonRpcProvider({ url: rpcUrl });
const owner = new Account(ownerId, provider, ownerKey);
const policy = (await provider.callFunction({ contractId: daoId, method: "get_policy", args: {} })) as Policy;
const show = (p: Policy) => p.roles.map((r) => `  ${r.name.padEnd(10)} ${typeof r.kind === "string" ? r.kind : `[${r.kind.Group.join(", ")}]`}  ${r.permissions.join(" ")}`).join("\n");
console.log(`DAO ${daoId} · bond ${Number(BigInt(policy.proposal_bond) / 10n ** 21n) / 1000} NEAR\nroles now:\n${show(policy)}`);

const propose = async (description: string, kind: Record<string, unknown>) => {
  const id = await owner.callFunction<number>({ contractId: daoId, methodName: "add_proposal", args: { proposal: { description, kind } }, gas: teraToGas("50"), deposit: BigInt(policy.proposal_bond) });
  await owner.callFunction({ contractId: daoId, methodName: "act_proposal", args: { id, action: "VoteApprove" }, gas: teraToGas("100"), deposit: 0n });
  const p = (await provider.callFunction({ contractId: daoId, method: "get_proposal", args: { id } })) as { status: string };
  console.log(`proposal #${id}: ${p.status} → https://testnet.nearblocks.io/address/${daoId}`);
  return id;
};

if (seatAt >= 0) {
  const account = argv[seatAt + 1], role = argv[seatAt + 2];
  if (!account || !(role === "graduates" || role === "founders")) { console.error("Usage: --seat <account> <graduates|founders>"); process.exit(1); }
  if (!policy.roles.some((r) => r.name === role)) { console.error(`the DAO has no "${role}" role yet: run --apply first`); process.exit(1); }
  if (groupOf(policy, role).includes(account)) { console.log(`${account} already holds a ${role} seat`); process.exit(0); }
  await propose(`Bloqvia: ${account} seated in ${role} by the council`, { AddMemberToRole: { member_id: account, role } });
  process.exit(0);
}

const next: Policy = { ...policy, roles: [...policy.roles.filter((r) => !(r.name in SEATS)), ...Object.values(SEATS).map((s) => ({ ...s, kind: { Group: groupOf(policy, s.name) } }))] };
console.log(`\nroles after:\n${show(next)}`);
if (!apply) { console.log("\nDRY RUN: add --apply to file the ChangePolicy proposal and approve it"); process.exit(0); }
await propose("Bloqvia: seats for the Passport. graduates vote on medium claims; founders (Season 2 stamp) also on what the cohort pays for.", { ChangePolicy: { policy: next } });
const after = (await provider.callFunction({ contractId: daoId, method: "get_policy", args: {} })) as Policy;
console.log(`\nroles on chain:\n${show(after)}`);
