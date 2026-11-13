/**
 * The market desk (Nov 13): two things the relayer sells per request over x402 (HTTP 402 Payment Required).
 *
 *   GET /desk/signal                 0.01 wNEAR   what a trader wants to know before a move: Bloq's prices now, the day's
 *                                                 average per item, the price-call round, the other traders' last moves
 *   GET /passport/proof?accountId=   0.05 wNEAR   a signed statement of what the chain says about one Passport: sealed or
 *                                                 not, level, stamps; the signature is the relayer's key, which is on
 *                                                 chain, so anyone can check it without trusting the relayer
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

export interface DeskPrices { signal: bigint; proof: bigint }
export const DESK_PRICES: DeskPrices = { signal: WNEAR / 100n, proof: WNEAR / 20n }; // 0.01 and 0.05 wNEAR

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

/** node:http as the x402 adapter. */
function adapt(req: IncomingMessage, url: URL): HTTPAdapter {
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
    const routes: RoutesConfig = {
      "GET /desk/signal": { accepts: [{ scheme: "exact", network: this.network, price: price(this.prices.signal), payTo: this.payTo }], description: "Bloqvia market desk: prices now, the day's average, the price-call round, the traders' last moves", mimeType: "application/json", resource: `${publicUrl}/desk/signal`, unpaidResponseBody: () => ({ contentType: "application/json", body: { error: `Payment required: ${fmt(this.prices.signal)} to ${this.payTo} on ${this.network} (x402, PAYMENT-REQUIRED header)` } }) },
      "GET /passport/proof": { accepts: [{ scheme: "exact", network: this.network, price: price(this.prices.proof), payTo: this.payTo }], description: "A signed statement of one Passport as the chain holds it", mimeType: "application/json", resource: `${publicUrl}/passport/proof`, unpaidResponseBody: () => ({ contentType: "application/json", body: { error: `Payment required: ${fmt(this.prices.proof)} to ${this.payTo} on ${this.network} (x402, PAYMENT-REQUIRED header)` } }) },
    };
    this.http = new x402HTTPResourceServer(server, routes);
  }

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
    await this.init();
    const context: HTTPRequestContext = { adapter: adapt(req, url), path: url.pathname, method: req.method ?? "GET", paymentHeader: (req.headers["payment-signature"] as string | undefined) ?? (req.headers["x-payment"] as string | undefined) };
    const r = await this.http.processHTTPRequest(context);
    if (r.type === "payment-error") { write(res, r.response); return true; }
    if (r.type === "no-payment-required") { write(res, { status: 500, headers: {}, body: { error: "desk route without a price" } }); return true; }
    // paid: produce the answer first, settle second, so a failed read never costs the payer
    let body: unknown;
    try {
      body = url.pathname === "/desk/signal" ? await this.signal(ctx) : await this.proof(ctx, url.searchParams.get("accountId") ?? "");
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
    write(res, { status: 200, headers: s.headers, body });
    return true;
  }

  view() {
    return { asset: this.asset, payTo: this.payTo, network: this.network, prices: { signal: fmt(this.prices.signal), proof: fmt(this.prices.proof) }, routes: Object.keys(this.http.routes), sales: this.sales.slice(-20) };
  }
}
