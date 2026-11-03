/**
 * Round-trip test for the wire format: a SignedDelegate built in memory,
 * encoded to base64 the way the browser does it, decoded the way the relayer
 * does it, and re-encoded byte-for-byte. Runs with: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { DelegateAction, KeyPair, KeyType, Signature, actions, encodeSignedDelegate, teraToGas } from "near-api-js";
import type { SignedDelegate } from "near-api-js";
import { decodeSignedDelegateBase64, encodeSignedDelegateBase64 } from "../src/codec.js";
import { PolicyError, assertAllowed } from "../src/policy.js";

function sample(methodName = "complete_lesson", receiverId = "core.bloqvia.testnet"): SignedDelegate {
  const key = KeyPair.fromRandom("ed25519");
  const delegateAction = new DelegateAction({
    senderId: "learner-abc.bloqvia.testnet",
    receiverId,
    actions: [actions.functionCall(methodName, { lesson_id: "the-vault", answer: "public key" }, teraToGas("20"), 0n)],
    nonce: 42n,
    maxBlockHeight: 1_000n,
    publicKey: key.getPublicKey(),
  });
  const signature = new Signature({ keyType: KeyType.ED25519, data: new Uint8Array(64) });
  // SignedDelegate is a type-only export in near-api-js v7; the shape is what matters.
  return { delegateAction, signature } as SignedDelegate;
}

test("base64 round trip is byte-exact", () => {
  const sd = sample();
  const encoded = encodeSignedDelegateBase64(sd);
  const decoded = decodeSignedDelegateBase64(encoded);
  assert.deepEqual(Buffer.from(encodeSignedDelegate(decoded)), Buffer.from(encodeSignedDelegate(sd)));
  assert.equal(decoded.delegateAction.senderId, "learner-abc.bloqvia.testnet");
});

test("policy allows a registered learner calling an allowed method", async () => {
  await assertAllowed(decodeSignedDelegateBase64(encodeSignedDelegateBase64(sample())), {
    coreContractId: "core.bloqvia.testnet",
    isRegistered: async () => true,
  });
});

test("policy rejects a foreign receiver, a foreign method and an unregistered sender", async () => {
  const ctx = { coreContractId: "core.bloqvia.testnet", isRegistered: async () => true };
  await assert.rejects(() => assertAllowed(sample("complete_lesson", "evil.testnet"), ctx), PolicyError);
  await assert.rejects(() => assertAllowed(sample("mt_transfer"), ctx), PolicyError);
  await assert.rejects(
    () => assertAllowed(sample(), { ...ctx, isRegistered: async () => false }),
    (e: unknown) => e instanceof PolicyError && e.status === 403,
  );
});
