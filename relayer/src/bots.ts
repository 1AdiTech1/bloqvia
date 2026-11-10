/**
 * Scripted learners run by the relayer itself (the NPC trader and the fast-forward's players). They go through
 * exactly the path a human takes: a learner account with a function-call key limited to core, every call a NEP-366
 * delegate relayed by the relayer, every trade priced by the contract. Nothing here can mint, move balances or
 * change a price: it only answers quests and buys and sells like a player.
 */
import { Account, KeyPair, actions, encodeSignedDelegate, teraToGas, type KeyPairString } from "near-api-js";
import type { Action } from "near-api-js";
import { registerLearner } from "./accounts.js";
import { relay, type RelayResult } from "./relay.js";
import { view, withRetry, type NearContext } from "./near.js";

export const ITEMS = ["key-fragment", "fuel-cell", "contract-seal"] as const;
export type Item = (typeof ITEMS)[number];

/** The three founding quests and their answers, as in the app bundle (the chain stores only the hashes). */
export const FOUNDING: { lesson_id: string; answer: string }[] = [
  { lesson_id: "the-vault", answer: "Your public key" },
  { lesson_id: "the-fuel-system", answer: "False" },
  { lesson_id: "smart-agreements", answer: "A smart contract" },
];

export interface Bot { accountId: string; account: Account }


export interface LearnerState { completed: string[]; graduated: boolean; gold: bigint; items: Record<Item, bigint> }
export interface Prices { gold: bigint; shop_open: boolean; stock: Record<Item, bigint>; buy: Record<Item, bigint>; sell: Record<Item, bigint> }

/** A bot from a key the relayer holds (the trader), or a brand-new one (fast-forward players). */
export async function newBot(ctx: NearContext, key: KeyPair = KeyPair.fromRandom("ed25519")): Promise<Bot> {
  const reg = await withRetry(() => registerLearner(ctx, key.getPublicKey().toString()));
  return { accountId: reg.accountId, account: new Account(reg.accountId, ctx.provider, key.toString()) };
}

export function botFromKey(ctx: NearContext, accountId: string, key: KeyPairString): Bot {
  return { accountId, account: new Account(accountId, ctx.provider, key) };
}

/** One call on core through the relayer, signed by the bot: the same bytes a browser sends to POST /relay. */
export async function call(ctx: NearContext, bot: Bot, method: string, args: Record<string, unknown>, gas: `${number}` = "40"): Promise<RelayResult> {
  const acts: Action[] = [actions.functionCall(method, args, teraToGas(gas), 0n)];
  return withRetry(async () => {
    const { signedDelegate } = await bot.account.createSignedMetaTransaction({ receiverId: ctx.config.coreContractId, actions: acts, blockHeightTtl: 100 });
    return relay(ctx, Buffer.from(encodeSignedDelegate(signedDelegate)).toString("base64"));
  });
}

export async function learner(ctx: NearContext, accountId: string): Promise<LearnerState> {
  const l = await withRetry(() => view<{ completed: string[]; graduated: boolean; gold: string; items: [string, string][] }>(ctx, ctx.config.coreContractId, "get_learner", { account_id: accountId }));
  const items = { "key-fragment": 0n, "fuel-cell": 0n, "contract-seal": 0n } as Record<Item, bigint>;
  for (const [id, n] of l.items) if (id in items) items[id as Item] = BigInt(n);
  return { completed: l.completed, graduated: l.graduated, gold: BigInt(l.gold), items };
}

export async function prices(ctx: NearContext): Promise<Prices> {
  const b = await withRetry(() => view<{ gold: string; shop_open: boolean; prices: { token_id: string; bloq_stock: string; buy_price: string; sell_price: string }[] }>(ctx, ctx.config.coreContractId, "get_bloq"));
  const z = () => ({ "key-fragment": 0n, "fuel-cell": 0n, "contract-seal": 0n }) as Record<Item, bigint>;
  const out: Prices = { gold: BigInt(b.gold), shop_open: b.shop_open, stock: z(), buy: z(), sell: z() };
  for (const p of b.prices) if ((ITEMS as readonly string[]).includes(p.token_id)) { const id = p.token_id as Item; out.stock[id] = BigInt(p.bloq_stock); out.buy[id] = BigInt(p.buy_price); out.sell[id] = BigInt(p.sell_price); }
  return out;
}

/** Play the founding quests the bot has not done yet (each mints gold and three of an item). */
export async function playQuests(ctx: NearContext, bot: Bot, upTo = FOUNDING.length): Promise<number> {
  const st = await learner(ctx, bot.accountId);
  let n = 0;
  for (const q of FOUNDING.slice(0, upTo)) {
    if (st.completed.includes(q.lesson_id)) continue;
    await call(ctx, bot, "complete_lesson", { lesson_id: q.lesson_id, answer: q.answer });
    n += 1;
  }
  return n;
}
