/**
 * A purse (Nov 13): the money an AI agent may spend, and the rules it cannot change.
 *
 * The NPC traders buy their information per request over x402 (HTTP 402 Payment Required): the market desk answers a
 * request with a price in wrapped NEAR, the purse pays with a NEP-366 delegate action that the facilitator settles on
 * chain, and the answer comes back. Every payment is a transaction on testnet with an explorer link.
 *
 * The cage, same shape as the trader's `allowedMoves`: the model may decide *whether* a signal is worth buying; the
 * purse decides whether the payment is *allowed* — only hosts on its list, at most `maxPerCall` per request, at most
 * `dailyBudget` per UTC day, only the one token, and never a price the 402 did not state. The purse is a sub-account
 * whose balance is the hard ceiling; its key is a full-access key (x402 needs one), so it holds a day's budget and
 * nothing else. No payment ever reaches a reward, a price or another player's balance: a purse only buys answers.
 */
import { wrapFetchWithPayment } from "@x402/fetch";
import { createNearX402Client } from "@fastnear/x402";
import { createLocalNearSigner } from "@fastnear/x402/node";

/** The key strings x402's signer takes (near-api-js also knows post-quantum keys; the purse uses the classic two). */
export type KeyPairString = `ed25519:${string}` | `secp256k1:${string}`;

/** 1 wNEAR in yocto (24 decimals, like NEAR). */
export const WNEAR = 10n ** 24n;
/** The token the desk is paid in: wrapped NEAR on the relayer's network. */
export const WNEAR_CONTRACT: Record<"testnet" | "mainnet", string> = { testnet: "wrap.testnet", mainnet: "wrap.near" };

export interface PursePolicy {
  /** Hosts the purse may pay (host[:port]); anything else is refused before a signature exists. */
  allowedHosts: string[];
  /** The most it pays for one request, in yocto of the token. */
  maxPerCall: bigint;
  /** The most it pays in one UTC day, in yocto. */
  dailyBudget: bigint;
  /** The only token it pays with (a NEP-141 account id). */
  asset: string;
  /** The x402 network the purse signs for. */
  network: "near:testnet" | "near:mainnet";
}

export interface Purchase { at: number; url: string; amount: string; asset: string; payTo: string; txHash: string | null; ok: boolean; note?: string }

export class PurseError extends Error {
  constructor(message: string, readonly reason: "host" | "price" | "budget" | "asset" | "network" | "unpaid" | "transport") { super(message); }
}

/** The day's spend ledger: pure, so the rules are tested without a chain. */
export class Ledger {
  private day = "";
  private spent = 0n;
  constructor(private readonly policy: PursePolicy, private readonly now: () => number = Date.now) {}
  private roll(): void {
    const d = new Date(this.now()).toISOString().slice(0, 10);
    if (d !== this.day) { this.day = d; this.spent = 0n; }
  }
  get spentToday(): bigint { this.roll(); return this.spent; }
  get left(): bigint { this.roll(); const l = this.policy.dailyBudget - this.spent; return l > 0n ? l : 0n; }
  /** Throws a PurseError when the policy refuses; otherwise says nothing. Nothing is spent until `commit`. */
  check(req: { url: string; amount: string; asset: string; network: string }): void {
    this.roll();
    let host: string;
    try { host = new URL(req.url).host; } catch { throw new PurseError(`Not a URL: ${req.url}`, "host"); }
    if (!this.policy.allowedHosts.includes(host)) throw new PurseError(`${host} is not on the purse's list (${this.policy.allowedHosts.join(", ")})`, "host");
    if (req.network !== this.policy.network) throw new PurseError(`The purse pays on ${this.policy.network}, not ${req.network}`, "network");
    if (req.asset !== this.policy.asset) throw new PurseError(`The purse pays in ${this.policy.asset}, not ${req.asset}`, "asset");
    let amount: bigint;
    try { amount = BigInt(req.amount); } catch { throw new PurseError(`Not an amount: ${req.amount}`, "price"); }
    if (amount <= 0n) throw new PurseError("A payment of nothing is not a payment", "price");
    if (amount > this.policy.maxPerCall) throw new PurseError(`${fmt(amount)} asked, the purse pays at most ${fmt(this.policy.maxPerCall)} a call`, "price");
    if (this.spent + amount > this.policy.dailyBudget) throw new PurseError(`${fmt(amount)} asked, ${fmt(this.left)} of today's ${fmt(this.policy.dailyBudget)} left`, "budget");
  }
  commit(amount: string): void { this.roll(); this.spent += BigInt(amount); }
}

/** 10000000000000000000000 -> "0.01 wNEAR" */
export function fmt(yocto: bigint, unit = "wNEAR"): string {
  const neg = yocto < 0n, a = neg ? -yocto : yocto;
  const whole = a / WNEAR, frac = (a % WNEAR).toString().padStart(24, "0").slice(0, 4).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""} ${unit}`;
}

export interface PurseConfig { accountId: string; secretKey: KeyPairString; rpcUrl: string; policy: PursePolicy }

/** A purse that pays: the policy in front of the signer, every outcome in the log. */
export class Purse {
  readonly accountId: string;
  readonly policy: PursePolicy;
  readonly ledger: Ledger;
  readonly log: Purchase[] = [];
  private readonly paidFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

  constructor(cfg: PurseConfig, fetchImpl: typeof globalThis.fetch = globalThis.fetch, now: () => number = Date.now) {
    this.accountId = cfg.accountId;
    this.policy = cfg.policy;
    this.ledger = new Ledger(cfg.policy, now);
    const signer = createLocalNearSigner({ accountId: cfg.accountId, secretKey: cfg.secretKey, rpcUrls: { [cfg.policy.network]: cfg.rpcUrl } });
    const client = createNearX402Client({ signer, network: cfg.policy.network });
    let pending: { url: string; amount: string; asset: string; payTo: string } | null = null;
    // the cage: the 402's own numbers are checked before any signature exists; a refusal aborts the payment
    client.onBeforePaymentCreation(async ({ paymentRequired, selectedRequirements: r }) => {
      const url = paymentRequired.resource?.url ?? "";
      try { this.ledger.check({ url, amount: r.amount, asset: r.asset, network: r.network }); }
      catch (e) { this.log.push({ at: now(), url, amount: r.amount, asset: r.asset, payTo: r.payTo, txHash: null, ok: false, note: (e as Error).message }); return { abort: true, reason: (e as Error).message }; }
      pending = { url, amount: r.amount, asset: r.asset, payTo: r.payTo };
    });
    client.onPaymentResponse(async ({ settleResponse, requirements: r, error, paymentRequired }) => {
      const p = pending ?? { url: "", amount: r.amount, asset: r.asset, payTo: r.payTo };
      pending = null;
      if (settleResponse?.success) { this.ledger.commit(p.amount); this.log.push({ at: now(), ...p, txHash: settleResponse.transaction, ok: true }); }
      else {
        // a second 402 after paying carries the facilitator's reason (an empty purse, a stale nonce); keep it readable
        const why = settleResponse?.errorReason ?? settleResponse?.errorMessage ?? paymentRequired?.error ?? error?.message ?? "not settled";
        this.log.push({ at: now(), ...p, txHash: null, ok: false, note: /balance|insufficient/i.test(why) ? `the purse is empty on chain (${why})` : why });
      }
      if (this.log.length > 50) this.log.shift();
    });
    this.paidFetch = wrapFetchWithPayment(fetchImpl, client);
  }

  /** Pay for one request. Resolves to the paid response's JSON; throws a PurseError when the purse refused or the seller did not deliver. */
  async buy<T>(url: string, init?: RequestInit): Promise<{ body: T; purchase: Purchase }> {
    // the host is checked before the first request too, so an unknown host never even sees the purse
    this.ledger.check({ url, amount: "1", asset: this.policy.asset, network: this.policy.network });
    const before = this.log.length;
    let res: Response;
    try { res = await this.paidFetch(url, init); }
    catch (e) {
      const last = this.log[this.log.length - 1];
      if (this.log.length > before && last && !last.ok) throw new PurseError(last.note ?? (e as Error).message, "price");
      throw new PurseError((e as Error).message, "transport");
    }
    const purchase = this.log[this.log.length - 1];
    if (res.status === 402) throw new PurseError(`Still 402 after paying: ${purchase?.note ?? "the seller did not accept the payment"}`, "unpaid");
    if (!res.ok) throw new PurseError(`${res.status} from ${url}`, "transport");
    if (!purchase || this.log.length === before) throw new PurseError("The seller answered without asking for a payment", "unpaid");
    return { body: (await res.json()) as T, purchase };
  }

  /** What /market shows: never the key. */
  view() {
    return { accountId: this.accountId, asset: this.policy.asset, maxPerCall: fmt(this.policy.maxPerCall), dailyBudget: fmt(this.policy.dailyBudget), spentToday: fmt(this.ledger.spentToday), left: fmt(this.ledger.left), purchases: this.log.filter((p) => p.ok).length, refused: this.log.filter((p) => !p.ok).length, last: this.log[this.log.length - 1] ?? null };
  }
}

/** The house purse (Nov 14): PURSE_HOUSE_ACCOUNT_ID / PURSE_HOUSE_PRIVATE_KEY, which buys the day's sponsored slot when nobody else did. One slot a day: 0.5 wNEAR a call, 0.5 a day. */
export function housePurseFromEnv(env: NodeJS.ProcessEnv, base: { rpcUrl: string; network: "testnet" | "mainnet"; allowedHosts: string[] }, slotPrice: bigint): Purse | null {
  const accountId = env.PURSE_HOUSE_ACCOUNT_ID, secretKey = env.PURSE_HOUSE_PRIVATE_KEY as KeyPairString | undefined;
  if (!accountId || !secretKey) return null;
  return new Purse({ accountId, secretKey, rpcUrl: base.rpcUrl, policy: { allowedHosts: base.allowedHosts, maxPerCall: slotPrice, dailyBudget: slotPrice, asset: env.WNEAR_CONTRACT_ID ?? WNEAR_CONTRACT[base.network], network: `near:${base.network}` } });
}

/** The three purses from the environment: PURSE_ACCOUNT_ID / PURSE_PRIVATE_KEY for the patient trader, PURSE2_* the bull, PURSE3_* the bear. */
export function pursesFromEnv(env: NodeJS.ProcessEnv, base: { rpcUrl: string; network: "testnet" | "mainnet"; allowedHosts: string[] }): (Purse | null)[] {
  const policy: PursePolicy = {
    allowedHosts: base.allowedHosts,
    maxPerCall: BigInt(env.PURSE_MAX_PER_CALL_YOCTO ?? (WNEAR / 100n).toString()), // 0.01 wNEAR
    dailyBudget: BigInt(env.PURSE_DAILY_BUDGET_YOCTO ?? (WNEAR / 5n).toString()), // 0.2 wNEAR a day
    asset: env.WNEAR_CONTRACT_ID ?? WNEAR_CONTRACT[base.network],
    network: `near:${base.network}`,
  };
  return [0, 1, 2].map((i) => {
    const prefix = i === 0 ? "PURSE" : `PURSE${i + 1}`;
    const accountId = env[`${prefix}_ACCOUNT_ID`], secretKey = env[`${prefix}_PRIVATE_KEY`] as KeyPairString | undefined;
    if (!accountId || !secretKey) return null;
    return new Purse({ accountId, secretKey, rpcUrl: base.rpcUrl, policy });
  });
}
