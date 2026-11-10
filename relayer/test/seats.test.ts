import assert from "node:assert/strict";
import { test } from "node:test";
import { DelegateAction, KeyPair, KeyType, Signature, actions, teraToGas } from "near-api-js";
import type { SignedDelegate } from "near-api-js";
import { PolicyError, assertAllowed, isVote } from "../src/policy.js";
import { SEAT_ROLES, members, seatsOf, withSeatRoles, type DaoPolicy } from "../src/seats.js";

const DAO = "bloqvia-dao.sputnik-v2.testnet", CORE = "core.bloqvia.testnet";
function delegate(receiverId: string, method: string, args: Record<string, unknown>, n = 1): SignedDelegate {
  const key = KeyPair.fromRandom("ed25519");
  const delegateAction = new DelegateAction({ senderId: "learner-abc.bloqvia.testnet", receiverId, actions: Array.from({ length: n }, () => actions.functionCall(method, args, teraToGas("30"), 0n)), nonce: 1n, maxBlockHeight: 10n, publicKey: key.getPublicKey() });
  return { delegateAction, signature: new Signature({ keyType: KeyType.ED25519, data: new Uint8Array(64) }) } as SignedDelegate;
}
const ctx = { coreContractId: CORE, daoId: DAO, isRegistered: async () => true };

test("a seat holder's vote is relayed to the DAO: act_proposal with VoteApprove or VoteReject, one per call", async () => {
  await assertAllowed(delegate(DAO, "act_proposal", { id: 7, action: "VoteApprove" }), ctx);
  await assertAllowed(delegate(DAO, "act_proposal", { id: 7, action: "VoteReject" }), ctx);
  await assert.rejects(() => assertAllowed(delegate(DAO, "act_proposal", { id: 7, action: "Finalize" }), ctx), /Only VoteApprove and VoteReject/);
  await assert.rejects(() => assertAllowed(delegate(DAO, "act_proposal", { id: 7, action: "RemoveProposal" }), ctx), PolicyError);
  await assert.rejects(() => assertAllowed(delegate(DAO, "add_proposal", { proposal: {} }), ctx), /not allowed on the DAO/);
  await assert.rejects(() => assertAllowed(delegate(DAO, "act_proposal", { id: 7, action: "VoteApprove" }, 2), ctx), /One vote per relayed call/);
  // without a DAO in the context, the DAO is a foreign receiver as before
  await assert.rejects(() => assertAllowed(delegate(DAO, "act_proposal", { id: 7, action: "VoteApprove" }), { coreContractId: CORE, isRegistered: async () => true }), /is not core/);
  assert.equal(isVote('{"id":1,"action":"VoteApprove"}'), true);
  assert.equal(isVote('{"id":"1","action":"VoteApprove"}'), false);
  assert.equal(isVote("not json"), false);
});

const policy: DaoPolicy = {
  roles: [
    { name: "all", kind: "Everyone", permissions: ["*:AddProposal"], vote_policy: {} },
    { name: "council", kind: { Group: ["bloqvia.testnet"] }, permissions: ["*:AddProposal", "*:VoteApprove", "*:VoteReject", "*:VoteRemove", "*:Finalize"], vote_policy: {} },
  ],
  default_vote_policy: { weight_kind: "RoleWeight", quorum: "0", threshold: [1, 2] },
  proposal_bond: "100000000000000000000000", proposal_period: "604800000000000", bounty_bond: "100000000000000000000000", bounty_forgiveness_period: "86400000000000",
};

test("the two seat roles are added to the policy without touching the council, and members survive an update", () => {
  const p1 = withSeatRoles(policy);
  assert.deepEqual(p1.roles.map((r) => r.name), ["all", "council", "graduates", "founders"]);
  assert.deepEqual(p1.roles[1], policy.roles[1]);
  assert.deepEqual(members(p1, "graduates"), []);
  assert.deepEqual(p1.roles[2]!.permissions, ["transfer:VoteApprove", "transfer:VoteReject"]);
  assert.ok(p1.roles[3]!.permissions.includes("call:VoteApprove"));
  assert.equal(p1.proposal_bond, policy.proposal_bond);
  // an update keeps the members already seated
  const seated: DaoPolicy = { ...p1, roles: p1.roles.map((r) => (r.name === "graduates" ? { ...r, kind: { Group: ["learner-1.bloqvia.testnet"] } } : r)) };
  const p2 = withSeatRoles(seated);
  assert.deepEqual(members(p2, "graduates"), ["learner-1.bloqvia.testnet"]);
  assert.deepEqual(seatsOf(p2, "learner-1.bloqvia.testnet"), { graduate: true, founder: false });
  assert.deepEqual(seatsOf(p2, "nobody.testnet"), { graduate: false, founder: false });
  assert.equal(SEAT_ROLES.graduates.vote_policy["transfer"]!.threshold, "1");
});
