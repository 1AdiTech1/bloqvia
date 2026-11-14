import assert from "node:assert/strict";
import { test } from "node:test";
import { KeyPair } from "near-api-js";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import { DESK_PRICES, Desk } from "../src/desk.js";
import { paywallHtml } from "../src/paywall.js";

const pr = (url: string, amount: bigint): PaymentRequired => ({ x402Version: 2, resource: { url }, accepts: [{ scheme: "exact", network: "near:testnet", asset: "wrap.testnet", amount: amount.toString(), payTo: "bloqvia.testnet", maxTimeoutSeconds: 60, extra: {} }] });

test("the browser page says Bloqvia, the price, the payee, the token and the network, and never asks the reader to pay", () => {
  const html = paywallHtml(pr("https://relay.bloqvia.app/desk/signal", DESK_PRICES.signal));
  assert.match(html, /<title>402 Payment Required · Bloqvia market desk<\/title>/);
  assert.match(html, /0\.01 wNEAR/);
  assert.match(html, /bloqvia\.testnet/);
  assert.match(html, /wrap\.testnet/);
  assert.match(html, /near:testnet/);
  assert.match(html, /curl -i https:\/\/relay\.bloqvia\.app\/desk\/signal/);
  assert.match(html, /asks nothing of you/);
  // the name is never in capitals (the app's rule), and nothing is fetched: no script, no wallet, no font
  assert.doesNotMatch(html, /BLOQVIA/);
  assert.doesNotMatch(html, /<script|@x402\/paywall|fonts\.googleapis|wallet/i);
  // each route in its own words, with the relayer's own host in the commands
  const proof = paywallHtml(pr("http://localhost:8787/passport/proof?accountId=x.testnet", DESK_PRICES.proof));
  assert.match(proof, /Bloqvia passport proof/);
  assert.match(proof, /0\.05 wNEAR/);
  assert.match(proof, /desk:buy -- --relayer http:\/\/localhost:8787 --proof/);
  const sponsor = paywallHtml(pr("https://relay.bloqvia.app/sponsor/quest", DESK_PRICES.sponsor));
  assert.match(sponsor, /Bloqvia sponsored slot/);
  assert.match(sponsor, /0\.5 wNEAR/);
  assert.match(sponsor, /sponsor\/today/);
  assert.match(sponsor, /sponsor:buy/);
});

test("the page escapes what the 402 carries", () => {
  const html = paywallHtml({ ...pr("https://relay.bloqvia.app/desk/signal", DESK_PRICES.signal), accepts: [{ scheme: "exact", network: "near:testnet", asset: "wrap.testnet", amount: "1", payTo: "<img src=x onerror=alert(1)>", maxTimeoutSeconds: 60, extra: {} }] });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("a browser on a desk route gets Bloqvia's page with the same 402 header; a program still gets the JSON", async () => {
  const key = KeyPair.fromRandom("ed25519").toString() as `ed25519:${string}`;
  const d = new Desk({ network: "testnet", rpcUrl: "http://rpc.test", payTo: "bloqvia.testnet", relayerAccountId: "bloqvia.testnet", relayerPrivateKey: key }, "http://relay.test:8787");
  await d.init();
  const url = new URL("/desk/signal", "http://relay.test:8787");
  const ctx = (accept: string, ua: string) => ({ adapter: { getHeader: () => undefined, getMethod: () => "GET", getPath: () => url.pathname, getUrl: () => url.toString(), getAcceptHeader: () => accept, getUserAgent: () => ua, getQueryParams: () => ({}), getQueryParam: () => undefined }, path: url.pathname, method: "GET", paymentHeader: undefined });
  const browser = await d.http.processHTTPRequest(ctx("text/html,application/xhtml+xml,*/*;q=0.8", "Mozilla/5.0 (Windows NT 10.0) Edge/131"));
  const program = await d.http.processHTTPRequest(ctx("application/json", "curl/8.5"));
  assert.equal(browser.type, "payment-error");
  assert.equal(program.type, "payment-error");
  if (browser.type !== "payment-error" || program.type !== "payment-error") return;
  assert.equal(browser.response.status, 402);
  assert.equal(browser.response.isHtml, true);
  assert.match(String(browser.response.body), /<b>Bloqvia<\/b>/);
  assert.doesNotMatch(String(browser.response.body), /@x402\/paywall/);
  // the header a purse reads is the same whoever asks
  assert.equal(browser.response.headers["PAYMENT-REQUIRED"], program.response.headers["PAYMENT-REQUIRED"]);
  assert.equal(decodePaymentRequiredHeader(browser.response.headers["PAYMENT-REQUIRED"]!).accepts[0]!.amount, DESK_PRICES.signal.toString());
  assert.equal(program.response.isHtml ?? false, false);
  assert.match(String((program.response.body as { error: string }).error), /Payment required: 0\.01 wNEAR/);
});
