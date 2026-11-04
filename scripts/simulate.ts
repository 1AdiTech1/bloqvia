/**
 * Fast-forward the economy and write a judge-readable report.
 *
 *   npm run simulate:offline            # pure replica, instant, for tuning (100 players, 12 rounds) -> docs/simulation-offline.md
 *   npm run simulate -- --players 20    # LIVE on testnet through the relayer: real accounts, real txs
 *
 * Options: --players N  --rounds N  --relayer URL  --offline  --out docs/simulation-latest.md
 *
 * Live mode exercises exactly the path a human takes: /register, then signed
 * delegates for complete_lesson / sell_to_bloq / buy_from_bloq / graduate.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Account, JsonRpcProvider, KeyPair, actions, encodeSignedDelegate, teraToGas } from "near-api-js";
import type { Action } from "near-api-js";
import { ITEMS, buyPrice, newPlayer, newWorld, snapshot, step, type Item, type LessonReward, type Pricing, type Snapshot, type Strategy } from "./economy.js";
import { ROOT, loadLessons } from "./lessons.js";

// ---------- args ----------
const argv = process.argv.slice(2);
const flag = (name: string, dflt: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const offline = argv.includes("--offline");
const players = Number(flag("players", offline ? "100" : "12"));
const rounds = Number(flag("rounds", offline ? "12" : "5"));
const relayerUrl = flag("relayer", process.env.RELAYER_URL ?? "http://localhost:8787").replace(/\/$/, "");
const out = resolve(ROOT, flag("out", "docs/simulation-latest.md"));

const init = JSON.parse(readFileSync(resolve(ROOT, "contracts/deploy/init-args.testnet.json"), "utf8")) as {
  core: { pricing: { base_price: string; stock_halving: string; spread_bps: number; treasury_floor: string }; bloq_gold_seed: string; bloq_item_seed: string };
};
const pricing: Pricing = {
  base_price: BigInt(init.core.pricing.base_price),
  stock_halving: BigInt(init.core.pricing.stock_halving),
  spread_bps: BigInt(init.core.pricing.spread_bps),
  treasury_floor: BigInt(init.core.pricing.treasury_floor),
};
const lessons: LessonReward[] = loadLessons().map((l) => ({
  lesson_id: l.lesson_id,
  reward_gold: BigInt(l.reward_gold),
  reward_item: l.reward_item as Item,
  reward_item_amount: BigInt(l.reward_item_amount),
}));
const answers = new Map(loadLessons().map((l) => [l.lesson_id, l.answer]));

const STRATEGIES: Strategy[] = ["seller", "seller", "trader", "hoarder"]; // 50% sellers, 25% traders, 25% hoarders
const strategyFor = (i: number) => STRATEGIES[i % STRATEGIES.length];
const joinsAt = (i: number, n: number) => Math.floor((i / n) * Math.max(1, rounds - 3)); // staggered arrivals

// ---------- report ----------
function report(mode: string, snaps: Snapshot[]): string {
  const head = `# Economy simulation (${mode})\n\n` +
    `Players: ${players} (strategies: 50% sellers, 25% traders, 25% hoarders, staggered arrivals). Rounds: ${rounds}.\n` +
    `Pricing: base ${pricing.base_price}, halving at stock ${pricing.stock_halving}, spread ${pricing.spread_bps} bps, treasury floor ${pricing.treasury_floor}. ` +
    `Bloq seed: ${init.core.bloq_gold_seed} gold, ${init.core.bloq_item_seed} of each item.\n\n` +
    `Rule: buy_price = base * halving / (halving + stock). Read the table top to bottom: Bloq pays less for what players dump.\n\n`;
  const table = ["| round | active | graduates | shop | Bloq gold | " + ITEMS.map((i) => `${i} price (stock)`).join(" | ") + " |",
    "|---|---|---|---|---|" + ITEMS.map(() => "---").join("|") + "|",
    ...snaps.map((s) => `| ${s.round} | ${s.active} | ${s.graduates} | ${s.shopOpen ? "open" : "CLOSED"} | ${s.bloqGold} | ` + ITEMS.map((i) => `${s.prices[i]} (${s.stock[i]})`).join(" | ") + " |")].join("\n");
  const last = snaps.at(-1)!;
  const verdict = `\n\nAfter ${rounds} rounds: ${last.graduates}/${players} graduated, Bloq holds ${last.bloqGold} gold, shop ${last.shopOpen ? "open" : "closed"}.` +
    (last.shopOpen ? "" : " Treasury floor reached: raise bloq_gold_seed or lower rewards before deploying.");
  return head + table + verdict + "\n";
}

// ---------- offline ----------
if (offline) {
  const world = newWorld(pricing, lessons, BigInt(init.core.bloq_gold_seed), BigInt(init.core.bloq_item_seed),
    [...Array(players)].map((_, i) => newPlayer(`p${i}`, strategyFor(i), joinsAt(i, players))));
  const snaps: Snapshot[] = [snapshot(world, 0)];
  for (let r = 1; r <= rounds; r += 1) {
    step(world, r);
    snaps.push(snapshot(world, r));
  }
  const md = report("offline replica", snaps);
  writeFileSync(out, md);
  console.log(md);
  console.log(`wrote ${out}`);
  process.exit(0);
}

// ---------- live (testnet via relayer) ----------
const rpcUrl = process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com";
const coreId = process.env.CORE_CONTRACT_ID ?? "core.bloqvia.testnet";
const provider = new JsonRpcProvider({ url: rpcUrl });

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${relayerUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(`${path}: ${json.error ?? res.status}`);
  return json;
}

interface LivePlayer { id: string; strategy: Strategy; joinsAt: number; account: Account | null; accountId: string | null; key: KeyPair; completed: number; graduated: boolean }

async function relayCall(p: LivePlayer, method: string, args: Record<string, unknown>): Promise<string> {
  if (!p.account) throw new Error("not registered");
  const acts: Action[] = [actions.functionCall(method, args, teraToGas("40"), 0n)];
  const { signedDelegate } = await p.account.createSignedMetaTransaction({ receiverId: coreId, actions: acts, blockHeightTtl: 100 });
  const payload = Buffer.from(encodeSignedDelegate(signedDelegate)).toString("base64");
  const r = await post<{ txHash: string }>("/relay", { payload });
  return r.txHash;
}

async function livePrices(): Promise<Snapshot["prices"] & { stock: Snapshot["stock"]; gold: bigint; open: boolean }> {
  const bloq = (await provider.callFunction({ contractId: coreId, method: "get_bloq", args: {} })) as { gold: string; shop_open: boolean; prices: { token_id: Item; bloq_stock: string; buy_price: string }[] };
  const prices = Object.fromEntries(bloq.prices.map((p) => [p.token_id, BigInt(p.buy_price)])) as Snapshot["prices"];
  const stock = Object.fromEntries(bloq.prices.map((p) => [p.token_id, BigInt(p.bloq_stock)])) as Snapshot["stock"];
  return { ...prices, stock, gold: BigInt(bloq.gold), open: bloq.shop_open };
}

async function learnerItems(accountId: string): Promise<Record<Item, bigint>> {
  const l = (await provider.callFunction({ contractId: coreId, method: "get_learner", args: { account_id: accountId } })) as { items: [Item, string][] };
  return Object.fromEntries(l.items.map(([i, n]) => [i, BigInt(n)])) as Record<Item, bigint>;
}

const live: LivePlayer[] = [...Array(players)].map((_, i) => ({ id: `p${i}`, strategy: strategyFor(i), joinsAt: joinsAt(i, players), account: null, accountId: null, key: KeyPair.fromRandom("ed25519"), completed: 0, graduated: false }));
const snaps: Snapshot[] = [];
let graduates = 0;

async function liveSnapshot(round: number): Promise<Snapshot> {
  const lp = await livePrices();
  const { stock, gold, open, ...prices } = lp;
  return { round, prices: prices as Snapshot["prices"], stock, bloqGold: gold, shopOpen: open, graduates, active: live.filter((p) => p.joinsAt <= round && !p.graduated).length };
}

snaps.push(await liveSnapshot(0));
for (let r = 1; r <= rounds; r += 1) {
  const batch = live.filter((p) => p.joinsAt <= r && !p.graduated);
  for (let i = 0; i < batch.length; i += 4) {
    await Promise.all(batch.slice(i, i + 4).map(async (p) => {
      try {
        if (!p.account) {
          const reg = await post<{ accountId: string }>("/register", { publicKey: p.key.getPublicKey().toString() });
          p.accountId = reg.accountId;
          p.account = new Account(reg.accountId, provider, p.key.toString());
        }
        const lesson = lessons[p.completed];
        if (lesson) {
          await relayCall(p, "complete_lesson", { lesson_id: lesson.lesson_id, answer: answers.get(lesson.lesson_id) });
          p.completed += 1;
        }
        const items = await learnerItems(p.accountId!);
        if (p.strategy === "seller") {
          for (const it of ITEMS) if (items[it] > 1n) await relayCall(p, "sell_to_bloq", { token_id: it, amount: String(items[it] - 1n) });
        } else if (p.strategy === "trader") {
          const lp = await livePrices();
          const best = [...ITEMS].sort((a, b) => Number(lp[b] - lp[a]))[0];
          if (items[best] > 1n) await relayCall(p, "sell_to_bloq", { token_id: best, amount: String(items[best] - 1n) });
        }
        if (p.completed >= lessons.length && ITEMS.every((it) => items[it] >= 1n)) {
          try { await relayCall(p, "graduate", {}); p.graduated = true; graduates += 1; } catch { /* fee not yet affordable */ }
        }
      } catch (e) {
        console.error(`[${p.id}] round ${r}:`, (e as Error).message);
      }
    }));
  }
  snaps.push(await liveSnapshot(r));
  console.log(`round ${r}: ` + ITEMS.map((i) => `${i}=${snaps.at(-1)!.prices[i]}`).join(" "));
}
const md = report(`live testnet via ${relayerUrl}`, snaps);
writeFileSync(out, md);
console.log(md);
console.log(`wrote ${out}`);
void buyPrice;
