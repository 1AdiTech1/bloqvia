/**
 * The market desk (Nov 13): two things the relayer sells per request over x402 (HTTP 402 Payment Required).
 *
 *   GET /desk/signal                 0.01 wNEAR   what a trader wants to know before a move: Bloq's prices now, the day's
 *                                                 average per item, the price-call round, the other traders' last moves
 *   GET /passport/proof?accountId=   0.05 wNEAR   a signed statement of what the chain says about one Passport: sealed or
 *                                                 not, level, stamps; the signature is the relayer's key, which is on
 *                                                 chain, so anyone can check it without trusting the relayer
 *   POST /sponsor/quest              0.5 wNEAR    the day's sponsored slot on the map (sponsor.ts): a quest that passes the
 *                                                 validator is seeded on chain with the payment's transaction
 *
 * The handshake is the x402 v2 "exact" scheme on NEAR: an unpaid request gets a 402 with the price in the
 * PAYMENT-REQUIRED header; the payer signs a NEP-366 delegate action for the token transfer and retries with
 * PAYMENT-SIGNATURE; the facilitator verifies it, the handler runs, the facilitator settles the transfer on chain
 * (paying the gas, as our relayer does for every learner), and the answer carries PAYMENT-RESPONSE with the
 * transaction hash. The facilitator runs in this process, with the relayer's own account: there is no third party.
 *
 * What the desk sells is information the chain already holds. The desk never sets a price in the game, never pays
 * a reward: it reads the contract and signs what it read.
 */
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { KeyPair, PublicKey } from "near-api-js";
import { x402HTTPResourceServer, type HTTPAdapter, type HTTPRequestContext, type HTTPResponseInstructions, type RoutesConfig } from "@x402/core/http";
import { createNearFacilitator } from "@fastnear/x402/facilitator";
import { createNearResourceServer } from "@fastnear/x402/server";
import { fairPrices, latest } from "./market.js";
import { tradersState } from "./trader.js";
import { view, withRetry, type NearContext } from "./near.js";
import { WNEAR, WNEAR_CONTRACT, fmt } from "./purse.js";
import { paywallHtml } from "./paywall.js";
import { SPONSOR_PRICE, attachSponsoredText, seedSponsored, sponsoredLessonId, sponsoredText, todaysSlot, validateSponsor } from "./sponsor.js";

export interface DeskPrices { signal: bigint; proof: bigint; sponsor: bigint }
export const DESK_PRICES: DeskPrices = { signal: WNEAR / 100n, proof: WNEAR / 20n, sponsor: SPONSOR_PRICE }; // 0.01, 0.05 and 0.5 wNEAR

export interface DeskConfig {
  network: "testnet" | "mainnet";
  rpcUrl: string;
  /** The account the desk is paid to (must be registered for storage on the token). */
  payTo: string;
  /** The facilitator's relayer: pays the gas of the settlement. The relayer's own account. */
  relayerAccountId: string;
  relayerPrivateKey: `ed25519:${string}` | `secp256k1:${string}`;
  asset?: string;
  prices?: DeskPrices;
}

export interface Signal { at: number; prices: ReturnType<typeof latest>; average: Record<string, string> | null; round: [number, number, boolean] | null; traders: { temper: string; last: unknown }[] }
export interface Proof {
  statement: { account_id: string; passport: { token_id: string; level: number; graduated: boolean; stamps: string[] } | null; quests_completed: string[]; read_at: number; network: string; core: string; passport_contract: string };
  issuer: string;
  public_key: string;
  signature: string;
  how_to_verify: string;
}

/** The exact bytes that are signed: sha256 of the statement's JSON with sorted keys. Pure, tested. */
export function digest(statement: unknown): Buffer {
  const sorted = (v: unknown): unknown => Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sorted((v as Record<string, unknown>)[k])])) : v;
  return createHash("sha256").update(JSON.stringify(sorted(statement))).digest();
}

/** Sign a statement with the relayer's key; `verifyProof` checks it with the public key alone. Pure, tested. */
export function signProof(statement: Proof["statement"], key: KeyPair, issuer: string): Proof {
  const { signature, publicKey } = key.sign(digest(statement));
  return { statement, issuer, public_key: publicKey.toString(), signature: Buffer.from(signature).toString("base64"), how_to_verify: `ed25519 over sha256 of the statement's JSON with keys sorted; the public key is an access key of ${issuer} on ${statement.network} (near account view-access-key-list ${issuer})` };
}
export function verifyProof(p: Proof): boolean {
  try { return PublicKey.fromString(p.public_key).verify(digest(p.statement), Buffer.from(p.signature, "base64")); } catch { return false; }
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (Number(req.headers["content-length"] ?? 0) > 64 * 1024) throw new Error("Body too large");
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.length > 64 * 1024) throw new Error("Body too large");
  try { return text ? (JSON.parse(text) as Record<string, unknown>) : {}; } catch { return {}; }
}

/** node:http as the x402 adapter. */
function adapt(req: IncomingMessage, url: URL, body: unknown = undefined): HTTPAdapter {
  const h = (name: string) => { const v = req.headers[name.toLowerCase()]; return Array.isArray(v) ? v[0] : v; };
  return {
    getHeader: h,
    getMethod: () => req.method ?? "GET",
    getPath: () => url.pathname,
    getUrl: () => url.toString(),
    getAcceptHeader: () => h("accept") ?? "",
    getUserAgent: () => h("user-agent") ?? "",
    getQueryParams: () => Object.fromEntries(url.searchParams.entries()),
    getQueryParam: (name) => url.searchParams.get(name) ?? undefined,
    getBody: () => body,
  };
}

function write(res: ServerResponse, r: HTTPResponseInstructions): void {
  res.writeHead(r.status, { "Content-Type": r.isHtml ? "text/html" : "application/json", ...r.headers });
  res.end(r.body === undefined ? "" : typeof r.body === "string" ? r.body : JSON.stringify(r.body));
}

export class Desk {
  readonly asset: string;
  readonly prices: DeskPrices;
  readonly payTo: string;
  readonly network: "near:testnet" | "near:mainnet";
  readonly http: x402HTTPResourceServer;
  /** The desk's own ledger: what it sold, to whom, with the settlement's transaction. */
  readonly sales: { at: number; route: string; payer: string | null; amount: string; txHash: string }[] = [];
  private ready: Promise<void> | null = null;
  private readonly key: KeyPair;

  constructor(private readonly cfg: DeskConfig, private readonly publicUrl: string) {
    this.asset = cfg.asset ?? WNEAR_CONTRACT[cfg.network];
    this.prices = cfg.prices ?? DESK_PRICES;
    this.payTo = cfg.payTo;
    this.network = `near:${cfg.network}`;
    this.key = KeyPair.fromString(cfg.relayerPrivateKey);
    const facilitator = createNearFacilitator({ registrations: [{ network: this.network, signer: { relayers: [{ accountId: cfg.relayerAccountId, secretKey: cfg.relayerPrivateKey }], rpcUrls: { [this.network]: cfg.rpcUrl } } }] });
    const server = createNearResourceServer({ facilitators: facilitator });
    const price = (yocto: bigint) => ({ amount: yocto.toString(), asset: this.asset });
    const unpaid = (yocto: bigint) => () => ({ contentType: "application/json", body: { error: `Payment required: ${fmt(yocto)} to ${this.payTo} on ${this.network} (x402, PAYMENT-REQUIRED header)` } });
    const routes: RoutesConfig = {
      "GET /desk/signal": { accepts: [{ scheme: "exact", network: this.network, price: price(this.prices.signal), payTo: this.payTo }], description: "Bloqvia market desk: prices now, the day's average, the price-call round, the traders' last moves", mimeType: "application/json", resource: `${publicUrl}/desk/signal`, unpaidResponseBody: unpaid(this.prices.signal) },
      "GET /passport/proof": { accepts: [{ scheme: "exact", network: this.network, price: price(this.prices.proof), payTo: this.payTo }], description: "A signed statement of one Passport as the chain holds it", mimeType: "application/json", resource: `${publicUrl}/passport/proof`, unpaidResponseBody: unpaid(this.prices.proof) },
      "POST /sponsor/quest": { accepts: [{ scheme: "exact", network: this.network, price: price(this.prices.sponsor), payTo: this.payTo }], description: "Today's sponsored slot on Bloqvia's map: a quest that passes the validator, seeded on chain with the payment", mimeType: "application/json", resource: `${publicUrl}/sponsor/quest`, unpaidResponseBody: unpaid(this.prices.sponsor) },
    };
    this.http = new x402HTTPResourceServer(server, routes);
    // a browser on a desk route gets Bloqvia's page (paywall.ts), not x402's generic one; programs get the JSON above
    this.http.registerPaywallProvider({ generateHtml: (pr) => paywallHtml(pr) });
    // the slot is one a day: a taken slot is refused before any payment is asked for
    this.http.onProtectedRequest(async (context) => {
      if (context.path !== "/sponsor/quest" || !this.near) return;
      const slot = await todaysSlot(this.near);
      if (slot.taken) return { abort: true, reason: `Today's slot is taken (${slot.lessonId}); tomorrow's opens at 00:00 UTC` };
    });
  }
  private near: NearContext | null = null;

  /** Facilitator support is read once (in-process, no network). */
  init(): Promise<void> { return (this.ready ??= this.http.initialize()); }

  /** What the desk sells. */
  async signal(ctx: NearContext): Promise<Signal> {
    const round = await withRetry(() => view<[number, number, boolean]>(ctx, ctx.config.coreContractId, "get_call_round")).catch(() => null);
    const avg = fairPrices();
    return { at: Date.now(), prices: latest(), average: avg ? Object.fromEntries(Object.entries(avg).map(([k, v]) => [k, v.toString()])) : null, round, traders: tradersState().filter((t) => t.on).map((t) => ({ temper: t.temper, last: t.last })) };
  }
  async proof(ctx: NearContext, accountId: string): Promise<Proof> {
    if (!/^[a-z0-9._-]{2,64}$/.test(accountId)) throw new Error("accountId must be a NEAR account");
    const [passport, learner] = await Promise.all([
      withRetry(() => view<{ token_id: string; level: number; graduated: boolean; stamps: string[] } | null>(ctx, ctx.config.passportContractId, "get_passport", { account_id: accountId })).catch(() => null),
      withRetry(() => view<{ completed: string[] }>(ctx, ctx.config.coreContractId, "get_learner", { account_id: accountId })).catch(() => ({ completed: [] as string[] })),
    ]);
    const statement: Proof["statement"] = { account_id: accountId, passport: passport ? { token_id: passport.token_id, level: passport.level, graduated: passport.graduated, stamps: passport.stamps } : null, quests_completed: learner.completed, read_at: Date.now(), network: this.cfg.network, core: ctx.config.coreContractId, passport_contract: ctx.config.passportContractId };
    return signProof(statement, this.key, this.cfg.relayerAccountId);
  }

  /** Handle a desk route; false when the request is not one. The x402 handshake, then the handler, then settlement. */
  async handle(ctx: NearContext, req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    const route = `${req.method} ${url.pathname}`;
    if (!(route in this.http.routes)) return false;
    this.near = ctx;
    await this.init();
    const json = req.method === "POST" ? await readJson(req) : {};
    const context: HTTPRequestContext = { adapter: adapt(req, url, json), path: url.pathname, method: req.method ?? "GET", paymentHeader: (req.headers["payment-signature"] as string | undefined) ?? (req.headers["x-payment"] as string | undefined) };
    const r = await this.http.processHTTPRequest(context);
    if (r.type === "payment-error") { write(res, r.response); return true; }
    if (r.type === "no-payment-required") { write(res, { status: 500, headers: {}, body: { error: "desk route without a price" } }); return true; }
    // paid: produce the answer first, settle second, so a failed read never costs the payer
    let body: unknown, after: ((s: { payer: string | null; txHash: string }) => Promise<unknown>) | null = null;
    try {
      if (url.pathname === "/desk/signal") body = await this.signal(ctx);
      else if (url.pathname === "/passport/proof") body = await this.proof(ctx, url.searchParams.get("accountId") ?? "");
      else {
        // the sponsored slot: validate and seed the lesson now (the hash and the reward rule); its text, which names the
        // payment, lands after settlement
        const sponsor = validateSponsor(json);
        const date = new Date(), lessonId = sponsoredLessonId(date);
        const slot = await todaysSlot(ctx, date);
        if (slot.taken) throw new Error(`Today's slot is taken (${lessonId})`);
        if (!slot.exists) await seedSponsored(ctx, lessonId, sponsor, date);
        body = { lessonId, sponsor: sponsor.name, house: sponsor.house ?? false };
        after = async (s) => {
          const text = sponsoredText(sponsor.quest, { name: sponsor.name, url: sponsor.url, house: sponsor.house ?? false }, { paid_by: s.payer, amount: this.prices.sponsor.toString(), asset: this.asset, tx_hash: s.txHash, bought_at: new Date().toISOString() });
          await attachSponsoredText(ctx, lessonId, text);
          console.log(`[sponsor] ${lessonId} seeded for ${sponsor.name}${sponsor.house ? " (house)" : ""}, paid by ${s.payer ?? "?"} tx=${s.txHash}`);
        };
      }
    } catch (e) {
      await r.cancellationDispatcher.cancel({ reason: "handler_threw", error: e }).catch(() => undefined);
      write(res, { status: 400, headers: {}, body: { error: (e as Error).message } });
      return true;
    }
    const s = await this.http.processSettlement(r.paymentPayload, r.paymentRequirements, r.declaredExtensions, { request: context });
    if (!s.success) { write(res, s.response); return true; }
    this.sales.push({ at: Date.now(), route, payer: s.payer ?? null, amount: r.paymentRequirements.amount, txHash: s.transaction });
    if (this.sales.length > 50) this.sales.shift();
    console.log(`[desk] sold ${route} to ${s.payer ?? "?"} for ${fmt(BigInt(r.paymentRequirements.amount))} tx=${s.transaction}`);
    if (after) { try { await after({ payer: s.payer ?? null, txHash: s.transaction }); } catch (e) { write(res, { status: 500, headers: s.headers, body: { ...(body as object), error: `paid, seeded, but the text did not land: ${(e as Error).message}` } }); return true; } }
    write(res, { status: 200, headers: s.headers, body: { ...(body as object), txHash: s.transaction } });
    return true;
  }

  view() {
    return { asset: this.asset, payTo: this.payTo, network: this.network, prices: { signal: fmt(this.prices.signal), proof: fmt(this.prices.proof), sponsor: fmt(this.prices.sponsor) }, routes: Object.keys(this.http.routes), sales: this.sales.slice(-20) };
  }
}
