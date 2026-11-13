import assert from "node:assert/strict";
import { test } from "node:test";
import { KeyPair } from "near-api-js";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { DESK_PRICES, Desk, digest, signProof, verifyProof, type Proof } from "../src/desk.js";
import { Purse, PurseError, WNEAR } from "../src/purse.js";

const key = KeyPair.fromRandom("ed25519").toString() as `ed25519:${string}`;
/** The fetch wrapper hands over a Request, not a string. */
const urlOf = (input: RequestInfo | URL) => new URL(input instanceof Request ? input.url : String(input));
const desk = () => new Desk({ network: "testnet", rpcUrl: "http://rpc.test", payTo: "bloqvia.testnet", relayerAccountId: "bloqvia.testnet", relayerPrivateKey: key }, "http://relay.test:8787");

/** A request as node:http would hand it to the desk, without a server. */
function ctxFor(d: Desk, path: string, headers: Record<string, string> = {}) {
  const url = new URL(path, "http://relay.test:8787");
  const h = (n: string) => headers[n.toLowerCase()];
  return { adapter: { getHeader: h, getMethod: () => "GET", getPath: () => url.pathname, getUrl: () => url.toString(), getAcceptHeader: () => "application/json", getUserAgent: () => "test", getQueryParams: () => Object.fromEntries(url.searchParams.entries()), getQueryParam: (n: string) => url.searchParams.get(n) ?? undefined }, path: url.pathname, method: "GET", paymentHeader: h("payment-signature") };
}

test("an unpaid request to the desk gets a 402 that names the price, the token, the payee and the network", async () => {
  const d = desk();
  await d.init();
  const r = await d.http.processHTTPRequest(ctxFor(d, "/desk/signal"));
  assert.equal(r.type, "payment-error");
  if (r.type !== "payment-error") return;
  assert.equal(r.response.status, 402);
  const pr = decodePaymentRequiredHeader(r.response.headers["PAYMENT-REQUIRED"]!);
  assert.equal(pr.x402Version, 2);
  assert.equal(pr.resource.url, "http://relay.test:8787/desk/signal");
  assert.deepEqual(pr.accepts.map((a) => [a.scheme, a.network, a.asset, a.amount, a.payTo]), [["exact", "near:testnet", "wrap.testnet", DESK_PRICES.signal.toString(), "bloqvia.testnet"]]);
  assert.match(String((r.response.body as { error: string }).error), /0\.01 wNEAR to bloqvia\.testnet/);
  const p = await d.http.processHTTPRequest(ctxFor(d, "/passport/proof?accountId=x.testnet"));
  assert.equal(p.type, "payment-error");
  if (p.type === "payment-error") assert.equal(decodePaymentRequiredHeader(p.response.headers["PAYMENT-REQUIRED"]!).accepts[0]!.amount, DESK_PRICES.proof.toString());
  assert.deepEqual(d.view().routes, ["GET /desk/signal", "GET /passport/proof", "POST /sponsor/quest"]);
  assert.equal(d.view().prices.proof, "0.05 wNEAR");
});

test("a garbage payment header is refused with a 402, not served", async () => {
  const d = desk();
  await d.init();
  const r = await d.http.processHTTPRequest(ctxFor(d, "/desk/signal", { "payment-signature": Buffer.from("not a payment").toString("base64") }));
  assert.equal(r.type, "payment-error");
  if (r.type === "payment-error") assert.equal(r.response.status, 402);
});

test("the purse accepts the desk's own price and only then reaches for the chain", async () => {
  const d = desk();
  await d.init();
  // a fetch that is the desk: the 402 comes from the real route table
  const f = (async (input: RequestInfo | URL) => {
    const r = await d.http.processHTTPRequest(ctxFor(d, urlOf(input).pathname));
    if (r.type !== "payment-error") throw new Error("expected 402");
    return new Response(JSON.stringify(r.response.body), { status: r.response.status, headers: r.response.headers });
  }) as typeof globalThis.fetch;
  const p = new Purse({ accountId: "purse-test.bloqvia.testnet", secretKey: KeyPair.fromRandom("ed25519").toString() as `ed25519:${string}`, rpcUrl: "http://127.0.0.1:9", policy: { allowedHosts: ["relay.test:8787"], maxPerCall: WNEAR / 100n, dailyBudget: WNEAR / 10n, asset: "wrap.testnet", network: "near:testnet" } }, f);
  // no RPC here: the signature cannot be made, so the purchase fails as transport, never as a refusal
  await assert.rejects(p.buy("http://relay.test:8787/desk/signal"), (e: PurseError) => e.reason === "transport");
  assert.equal(p.log.filter((l) => !l.ok && /asked|not on the purse|pays in/.test(l.note ?? "")).length, 0);
  // the same purse against a price over its cap is refused on the spot
  const dear = new Desk({ network: "testnet", rpcUrl: "http://rpc.test", payTo: "bloqvia.testnet", relayerAccountId: "bloqvia.testnet", relayerPrivateKey: key, prices: { signal: WNEAR, proof: WNEAR, sponsor: WNEAR } }, "http://relay.test:8787");
  await dear.init();
  const g = (async (input: RequestInfo | URL) => {
    const r = await dear.http.processHTTPRequest(ctxFor(dear, urlOf(input).pathname));
    if (r.type !== "payment-error") throw new Error("expected 402");
    return new Response(JSON.stringify(r.response.body), { status: r.response.status, headers: r.response.headers });
  }) as typeof globalThis.fetch;
  const q = new Purse({ accountId: "purse-test.bloqvia.testnet", secretKey: KeyPair.fromRandom("ed25519").toString() as `ed25519:${string}`, rpcUrl: "http://127.0.0.1:9", policy: { allowedHosts: ["relay.test:8787"], maxPerCall: WNEAR / 100n, dailyBudget: WNEAR / 10n, asset: "wrap.testnet", network: "near:testnet" } }, g);
  await assert.rejects(q.buy("http://relay.test:8787/desk/signal"), (e: PurseError) => e.reason === "price" && /1 wNEAR asked/.test(e.message));
});

test("a Passport proof verifies with the public key alone, and not after a change to one field", () => {
  const k = KeyPair.fromRandom("ed25519");
  const statement: Proof["statement"] = { account_id: "learner-1.bloqvia.testnet", passport: { token_id: "learner-1.bloqvia.testnet", level: 3, graduated: true, stamps: ["season-2"] }, quests_completed: ["the-vault", "the-fuel-system", "smart-agreements"], read_at: 1700000000000, network: "testnet", core: "core.bloqvia.testnet", passport_contract: "passport.bloqvia.testnet" };
  const proof = signProof(statement, k, "bloqvia.testnet");
  assert.equal(proof.public_key, k.getPublicKey().toString());
  assert.ok(verifyProof(proof));
  const forged: Proof = { ...proof, statement: { ...statement, passport: { ...statement.passport!, graduated: false } } };
  assert.equal(verifyProof(forged), false);
  const otherKey: Proof = { ...proof, public_key: KeyPair.fromRandom("ed25519").getPublicKey().toString() };
  assert.equal(verifyProof(otherKey), false);
  // the digest does not depend on key order, so a verifier may re-serialise the statement
  assert.deepEqual(digest({ b: 1, a: [{ d: 2, c: 3 }] }), digest({ a: [{ c: 3, d: 2 }], b: 1 }));
});
