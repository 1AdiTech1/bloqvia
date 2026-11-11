import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Info, Minus, Plus, TriangleAlert, X } from "lucide-react";
import { useGame } from "@/game/useGame";
import { ITEM_IDS, itemAmount } from "@/game/content";
import { PhoneShell } from "@/components/PhoneShell";
import { RequireAccount } from "@/components/RequireAccount";
import { bloqLine } from "@/components/Bloq";
import { ItemIcon, itemLabel } from "@/components/GameBits";
import { Bloq, SpeechBubble, talkMs, type BloqHandle, type BloqPose, type BloqProp, useMotionOff, PriceHistory } from "@/bloq";
import { useMarket, useCalls, crowd, crowdLeans, CALL_STAKE, explorer, type Market, type ItemId, type CallSide, type MyCall } from "@/near";
import { LabLoader } from "@/components/LabLoader";
import { Web3Passport } from "@/components/lab/Web3Passport";
import { CubeBurst } from "@/components/lab/CubeBurst";
import { InventoryBar } from "@/components/lab/InventoryBar";
import { AnimatedNumber, Press, buzz, labEase } from "@/components/lab/motion";
import type { ItemPrice } from "@/game/types";
import { cn } from "@/lib/utils";

export function ShopPage() {
  return (
    <RequireAccount>
      <PhoneShell nav>
        <ShopInner />
      </PhoneShell>
    </RequireAccount>
  );
}

function ShopInner() {
  const game = useGame();
  const navigate = useNavigate();
  const reduce = useMotionOff();
  const bloq = game.bloq!;
  const learner = game.learner!;
  const [lastItem, setLastItem] = useState<string | null>(null);
  const [ceremony, setCeremony] = useState(false);
  const [stampBurst, setStampBurst] = useState(false);
  const merchant = useRef<BloqHandle>(null);
  const [prop, setProp] = useState<BloqProp>("cube");
  const [pose, setPose] = useState<BloqPose>("hold");
  const [reaction, setReaction] = useState<{ kind: "sell" | "buy" | "tap"; id: string; n: number } | null>(null);
  const timers = useRef<number[]>([]);
  const market = useMarket();
  const ff = market.fastForward, trader = market.trader;
  const [ffNote, setFfNote] = useState<string>("six learners sign up and trade for a couple of minutes");
  const fastForward = async () => {
    const why = await market.startFastForward();
    setFfNote(why ?? "starting: six learners are signing up…");
  };
  const last = ff?.log.length ? ff.log[ff.log.length - 1] : null;
  useEffect(() => {
    if (!ff) return;
    if (ff.error) setFfNote(ff.error);
    else if (ff.running && last) setFfNote(`round ${ff.round} of ${ff.rounds} · ${last.who} ${last.text}`);
    else if (ff.finishedAt) setFfNote(`done · a day of trading · next run in ${ff.everyMin} min`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ff?.round, ff?.running, ff?.finishedAt, ff?.error]);
  const live = market.data !== null;
  const t = trader?.lastThought ?? null; // the agent's last look at the prices (prompt 31)
  const traderLine = !live
    ? <>Bloq trades with whoever comes by. Prices follow one rule, in the contract.</>
    : ff?.running && last
    ? <><b>{last.who}</b> {last.text}.</>
    : t && trader
      ? <>The trader {t.move === "sell" ? "sold" : t.move === "buy" ? "bought" : t.overruled ? "was overruled and held" : "held"}: "{t.reason}"{t.move !== "hold" && trader.last && t.token_id ? <> — {trader.last.amount} {itemLabel(t.token_id)} at {trader.last.price} gold</> : null}</>
      : trader?.last
      ? <>The trader {trader.last.kind === "sell" ? "sold" : "bought"} <b>{trader.last.amount} {itemLabel(trader.last.token_id)}</b> {trader.last.kind === "sell" ? "to" : "from"} Bloq for {trader.last.price} gold.</>
      : trader?.on ? <>The trader is watching the prices: it sells above {trader.rules.sellAbove} gold and buys below {trader.rules.buyBelow}.</> : <>Bloq trades with whoever comes by. Prices follow one rule, in the contract.</>;
  const traderAcct = trader?.accountId ? <a href={explorer.account(trader.accountId)} target="_blank" rel="noopener noreferrer">{trader.accountId}</a> : null;
  const traderMeta = !live ? null
    : ff?.running
    ? <>{`fast-forward · round ${ff.round} of ${ff.rounds} · live on testnet`}{last?.txHash && <> · <a href={explorer.tx(last.txHash)} target="_blank" rel="noopener noreferrer">explorer</a></>}</>
    : t && trader
      ? <>{traderAcct}{` · thought on NEAR AI Cloud`}{t.generated_by.signature_kind === "provider_tee" ? " · signed in a TEE" : ""}{` · `}<a href={`https://cloud.near.ai/verify?model=${encodeURIComponent(t.generated_by.model)}`} target="_blank" rel="noreferrer">Verify</a>{trader.last?.txHash && t.move !== "hold" ? <> · <a href={explorer.tx(trader.last.txHash)} target="_blank" rel="noopener noreferrer">explorer</a></> : null}{` · next look in ${trader.rules.intervalMin} min`}</>
      : trader?.last
      ? <>{traderAcct}{` · ${ago(trader.last.at)} · every trade on the `}{trader.last.txHash ? <a href={explorer.tx(trader.last.txHash)} target="_blank" rel="noopener noreferrer">explorer</a> : "explorer"}</>
      : trader?.on ? <>{traderAcct}{` · next look in ${trader.rules.intervalMin} min`}</> : null;
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const lowest = [...bloq.prices].sort((a, b) => Number(a.bloq_stock) - Number(b.bloq_stock))[0];
  const focus = bloq.prices.find((p) => p.token_id === lastItem) ?? lowest;
  const baseLine = bloqLine(Number(focus?.bloq_stock ?? 0), bloq.shop_open);
  // Reaction lines read the values the contract returned (the state after the trade).
  const reacted = reaction ? bloq.prices.find((p) => p.token_id === reaction.id) : undefined;
  const line =
    reaction?.kind === "tap" ? "Sell me what I'm short on and I pay more. That's the whole rule."
    : reaction?.kind === "sell" && reacted ? `Thanks! My stock is ${reacted.bloq_stock} now, so next time I pay ${reacted.buy_price}.`
    : reaction?.kind === "buy" && reacted ? `Pleasure! I've got ${reacted.bloq_stock} left, so the price goes up a little.`
    : baseLine;
  useEffect(() => { merchant.current?.talk(talkMs(line), line); }, [line]);
  useEffect(() => { if (!bloq.shop_open) merchant.current?.setMood("o"); }, [bloq.shop_open]);

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const react = (kind: "sell" | "buy" | "tap", id: string) => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    const n = Date.now();
    setReaction({ kind, id, n });
    later(() => setReaction((r) => (r?.n === n ? null : r)), 6000);
  };

  const fee = Number(bloq.graduation_fee);
  const checks = [
    { ok: learner.level === 3, label: "Three quests complete" },
    { ok: ITEM_IDS.every((id) => itemAmount(learner.items, id) >= 1), label: "One of each item" },
    { ok: Number(learner.gold) >= fee, label: `Fee: ${fee} BloqGold` },
  ];

  const onTraded = (id: string, kind: "sell" | "buy") => {
    setLastItem(id);
    buzz();
    react(kind, id);
    if (kind === "sell") {
      setProp(ITEM_PROP[id] ?? "cube");
      setPose("hold");
      merchant.current?.jump();
      merchant.current?.setMood("laugh", 1100);
    } else {
      setProp("coin");
      setPose("thumbs");
      later(() => { setProp("cube"); setPose("hold"); }, 2600);
    }
  };
  const tapMerchant = () => { merchant.current?.jump("small"); react("tap", ""); };

  const doGraduate = async () => {
    try {
      await game.graduate();
      buzz();
      setCeremony(true);
      setTimeout(() => setStampBurst(true), reduce ? 0 : 700);
      setTimeout(() => navigate({ to: "/reveal" }), reduce ? 900 : 2600);
    } catch { /* coral toast shows the error */ }
  };

  return (
    <>
      <InventoryBar />

      <div className="lab-stall mt-6">
        <div className="awn" aria-hidden="true" />
        <div className="row">
          <button type="button" onClick={tapMerchant} aria-label="Bloq the merchant, in his top hat" className="relative w-full self-end">
            <Bloq ref={merchant} hat="tophat" prop={prop} pose={pose} label="Bloq the merchant" />
          </button>
          <div className="mb-[26px] min-w-0 self-center justify-self-start">
            <SpeechBubble side="right" tone="light" text={line} />
          </div>
        </div>
        <div className="counter" aria-hidden="true" />
        <div className="treasury">
          <span>Treasury <b>{bloq.gold}</b> gold</span>
          <span>Shop <b>{bloq.shop_open ? "open" : "closed"}</b></span>
        </div>
        <div className="market">
          <div className="k"><i aria-hidden="true" />Market · live</div>
          <div className="line">{traderLine}<small>{traderMeta}</small>{live && !(ff?.running && last) && t ? <small className="font-mono" style={{ fontSize: "10.5px" }}>allowed then: {t.allowed.join(" · ")}</small> : null}{market.data?.traders && market.data.traders.length > 1 ? <small className="font-mono" style={{ fontSize: "10.5px" }}>{market.data.traders.length} traders · {market.data.traders.map((tr) => `${tr.temper ?? "trader"} (${tr.last ? `${tr.last.kind === "buy" ? "bought" : "sold"} ${tr.last.amount} ${itemLabel(tr.last.token_id)}` : "holds"})`).join(" · ")}</small> : null}</div>
          <div className="ff">
            <Press onClick={() => void fastForward()} disabled={!live || !!ff?.running} className="ffbtn">{ff?.running ? "Trading…" : ff?.finishedAt && !ffNote ? "✓ Watched" : "▶ Watch a day of trading"}</Press>
            <div className="prog" aria-hidden="true"><i style={{ width: `${ff ? (ff.round / ff.rounds) * 100 : 0}%` }} /></div>
            <span className="ffnote">{ffNote}</span>
          </div>
        </div>
      </div>

      {!bloq.shop_open && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-coral p-4 text-sm font-medium text-navy">
          <TriangleAlert className="h-5 w-5 shrink-0" />
          Bloq's treasury is below 500 gold — shop closed until it refills.
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 dk:grid dk:grid-cols-3">
        {bloq.prices.map((p) => (
          <TradeCard key={p.token_id} price={p} have={itemAmount(learner.items, p.token_id)} gold={Number(learner.gold)} shopOpen={bloq.shop_open} onTraded={onTraded} market={market} />
        ))}
      </div>

      <section className="mt-8 rounded-3xl bg-ivory p-6 text-navy shadow-lift">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Final step</p>
        <h2 className="mt-1 font-display text-3xl font-medium uppercase leading-none tracking-[-0.04em]">Graduate</h2>
        <ul className="mt-5 flex flex-col gap-3">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-3 font-medium">
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-colors duration-500", c.ok ? "border-navy bg-navy text-lime" : "border-navy/20")}>
                <AnimatePresence>
                  {c.ok && (
                    <motion.span initial={reduce ? false : { scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ duration: 0.4, ease: labEase }}>
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
            </li>
          ))}
        </ul>
        <Press onClick={doGraduate} disabled={game.busy || learner.graduated} className="mt-6 w-full rounded-full bg-navy py-3.5 text-base font-semibold text-lime disabled:opacity-50">
          {learner.graduated ? "Graduated" : "Graduate"}
        </Press>
      </section>

      <AnimatePresence>
        {ceremony && (
          <motion.div className="fixed inset-0 z-[55] flex items-center justify-center bg-navy/90 backdrop-blur" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="relative w-[min(88vw,400px)]" initial={reduce ? false : { scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ duration: 0.5, ease: labEase }}>
              <p className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">Sealing your Passport</p>
              <Web3Passport holder={game.passport?.owner_id ?? game.accountId ?? ""} level={game.passport?.level ?? 3} graduated sealed={stampBurst} stampDelay={reduce ? undefined : 0} />
              {stampBurst && !reduce && <CubeBurst className="left-[80%] top-[52%]" />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ago(at: number, now: number = Date.now()) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

const ITEM_PROP: Record<string, BloqProp> = { "key-fragment": "key", "fuel-cell": "fuel", "contract-seal": "scroll" };

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function resultLine(r: MyCall): string {
  const paid = Number(r.paid ?? 0), stake = Number(r.stake);
  if (paid > stake) return `You called it: +${paid - stake} gold`;
  if (r.paid === "0") return `Not this time: −${r.stake} gold`;
  return `Nobody was right: ${r.stake} gold back`;
}

function resultSub(r: MyCall): string {
  const paid = Number(r.paid ?? 0), stake = Number(r.stake);
  if (paid > stake) return `your ${r.stake} back plus ${paid - stake} of the wrong sides' stakes`;
  if (r.paid === "0") return `the stake went to the right side`;
  return `everyone got the stake back`;
}

function CrowdLine({ k }: { k: ReturnType<typeof crowd> }) {
  if (!k) return <p className="font-mono text-[10.5px] text-muted-foreground">No calls yet this round. Be the first.</p>;
  const lean = crowdLeans(k);
  return (
    <div className="grid gap-1">
      <div className="flex h-[6px] overflow-hidden rounded-full bg-navy/10" aria-hidden="true">
        <i className="bg-purple" style={{ width: `${k.more}%` }} />
        <i className="bg-lavender" style={{ width: `${k.same}%` }} />
        <i className="bg-navy/40" style={{ width: `${k.less}%` }} />
      </div>
      <p className="font-mono text-[10.5px] text-muted-foreground">
        {lean ? `${lean.pct} % of the gold says ${lean.side.toLowerCase()} · ` : ""}{k.calls} call{k.calls === 1 ? "" : "s"} · {k.gold} gold in play
      </p>
    </div>
  );
}

function TradeCard({ price, have, gold, shopOpen, onTraded, market }: { price: ItemPrice; have: number; gold: number; shopOpen: boolean; onTraded: (id: string, kind: "sell" | "buy") => void; market: Market }) {
  const game = useGame();
  const c = useCalls();
  const [qty, setQty] = useState(1);
  const [tip, setTip] = useState(false);
  const id = price.token_id;
  const stock = Number(price.bloq_stock);

  const [stake, setStake] = useState<number>(CALL_STAKE.default);
  const [seenRound, setSeenRound] = useState(0);
  const [tried, setTried] = useState(false);
  const round = c.round;
  const [left, setLeft] = useState(round?.secondsLeft ?? 0);
  useEffect(() => { setLeft(round?.secondsLeft ?? 0); }, [round?.round, round?.secondsLeft]);
  useEffect(() => {
    const iv = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(iv);
  }, []);
  const mine = c.enabled ? c.mineFor(id as ItemId) : null;
  const result = c.enabled ? c.lastResultFor(id as ItemId) : null;
  const showResult = result !== null && result.round > seenRound;
  const k = c.enabled ? crowd(c.rounds[id as ItemId]) : null;
  const closed = !!round && !round.open;
  const clock = showResult ? "settled" : round ? (round.open ? `${fmtClock(left)} left` : `${fmtClock(left)} to go`) : null;
  const place = (side: CallSide) => { setTried(true); void c.place(id as ItemId, side, stake).catch(() => { /* c.error shows the chain's message */ }); };

  const act = async (fn: typeof game.sellToBloq, kind: "sell" | "buy") => {
    try {
      await fn(id, qty);
      onTraded(id, kind);
      setQty(1);
    } catch { /* coral toast shows the error */ }
  };

  const canSell = shopOpen && have > 0 && !game.busy;
  const canBuy = shopOpen && stock > 0 && gold >= Number(price.sell_price) * qty && !game.busy;

  return (
    <article className="lab-trade rounded-3xl bg-ivory p-4 text-navy shadow-lift">
      <div className="lab-trade-head flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy text-lime">
          <ItemIcon id={id} className="h-5 w-5" />
        </span>
        <div className="lab-trade-name min-w-0 flex-1">
          <h3 className="font-display text-lg font-medium leading-tight">{itemLabel(id)}</h3>
          <p className="text-xs text-muted-foreground">
            You <strong className="text-navy">{have}</strong> · Bloq's stock <AnimatedNumber value={stock} className="font-semibold text-navy" />
          </p>
        </div>
        <button aria-label="How prices work" aria-expanded={tip} onClick={() => setTip((t) => !t)} onBlur={() => setTip(false)} className="tap -mr-2 ml-auto flex shrink-0 items-center justify-center rounded-full text-navy/60">
          <Info className="h-5 w-5" />
        </button>
      </div>

      <AnimatePresence>
        {tip && (
          <motion.div role="tooltip" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <p className="mt-3 rounded-2xl bg-navy p-3 text-sm leading-relaxed text-ivory">
              Bloq pays less for what he already has a lot of: price = 100 × 40 ÷ (40 + his stock). Nobody can change this rule by hand.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lab-trade-prices mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-lavender-soft px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-navy/60">He pays</p>
          <p className="font-display text-2xl font-medium"><AnimatedNumber value={Number(price.buy_price)} className="-ml-1" /></p>
        </div>
        <div className="rounded-2xl bg-navy px-3 py-2 text-ivory">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lavender">He charges</p>
          <p className="font-display text-2xl font-medium"><AnimatedNumber value={Number(price.sell_price)} className="-ml-1" /></p>
        </div>
      </div>
      <PriceHistory points={market.history(id as ItemId)} change={market.change(id as ItemId)} className="mt-3" />

      {c.enabled && (
        <div className="mt-3 grid gap-2 rounded-2xl border border-purple/20 bg-purple/5 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-purple-d">Price call</span>
            {clock && <span className="font-mono text-[10.5px] text-muted-foreground">{clock}</span>}
          </div>

          {showResult && result ? (
            <div className="grid gap-1">
              <p className="font-display text-[15px] font-semibold">{resultLine(result)}</p>
              <p className="font-mono text-[10.5px] text-muted-foreground">{result.open_price} → {result.close_price} · {resultSub(result)}</p>
              <div>
                <Press onClick={() => setSeenRound(result.round)} className="text-xs">OK</Press>
              </div>
            </div>
          ) : mine ? (
            <>
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span>Your call: <b className="font-display font-semibold">{mine.side.toLowerCase()}</b>, from {mine.open_price}</span>
                <span className="rounded-full bg-lavender-soft px-3 py-1 text-xs font-semibold">settles in {fmtClock(left)}</span>
              </div>
              <CrowdLine k={k} />
            </>
          ) : (
            <>
              {closed ? (
                <p className="text-[13px] text-muted-foreground">Calls open again in {fmtClock(left)}.</p>
              ) : (
                <p className="font-display text-[14px] font-medium">In 10 min, will Bloq pay more, the same or less for {itemLabel(id)}s?</p>
              )}
              <div className={closed ? "opacity-45" : undefined}>
                {c.busy ? (
                  <LabLoader size={22} label="Calling on chain…" />
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <Press disabled={closed || c.busy || game.busy} onClick={() => place("More")} className="min-h-[38px] rounded-full bg-navy text-[13px] font-semibold text-lime disabled:opacity-50">▲ More</Press>
                    <Press disabled={closed || c.busy || game.busy} onClick={() => place("Same")} className="min-h-[38px] rounded-full border-2 border-navy/40 text-[13px] font-semibold text-navy disabled:opacity-50">= Same</Press>
                    <Press disabled={closed || c.busy || game.busy} onClick={() => place("Less")} className="min-h-[38px] rounded-full border-2 border-navy text-[13px] font-semibold text-navy disabled:opacity-50">▼ Less</Press>
                  </div>
                )}
                <div className="mt-2 flex h-[38px] items-center justify-center gap-1 rounded-full bg-muted">
                  <Press aria-label="Less stake" disabled={closed || stake <= CALL_STAKE.min} onClick={() => setStake((s) => Math.max(CALL_STAKE.min, s - 5))} className="flex items-center justify-center disabled:opacity-30"><Minus className="h-4 w-4" /></Press>
                  <span className="min-w-[22px] text-center font-display font-semibold tabular-nums" aria-live="polite">{stake}</span>
                  <Press aria-label="More stake" disabled={closed || stake >= CALL_STAKE.max} onClick={() => setStake((s) => Math.min(CALL_STAKE.max, s + 5))} className="flex items-center justify-center disabled:opacity-30"><Plus className="h-4 w-4" /></Press>
                  <span className="text-xs">gold</span>
                </div>
              </div>
              <CrowdLine k={k} />
            </>
          )}

          {tried && c.error && (
            <div className="flex items-start gap-2 rounded-2xl border-l-4 border-coral bg-coral/15 p-3 text-[13px] leading-relaxed">
              <span className="flex-1">{c.error}</span>
              <button type="button" aria-label="Dismiss" onClick={() => { c.clearError(); setTried(false); }} className="-m-2 flex h-8 w-8 shrink-0 items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 dk:flex-col dk:items-stretch">
        <div className="flex items-center rounded-full bg-muted dk:justify-between">
          <Press aria-label="Less" disabled={qty <= 1} className="flex items-center justify-center disabled:opacity-30" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Press>
          <span className="w-5 text-center font-display font-semibold tabular-nums" aria-live="polite">{qty}</span>
          <Press aria-label="More" disabled={qty >= 9} className="flex items-center justify-center disabled:opacity-30" onClick={() => setQty((q) => Math.min(9, q + 1))}><Plus className="h-4 w-4" /></Press>
        </div>
        <div className="flex flex-1 gap-2 dk:flex-none">
        <Press disabled={!canSell} onClick={() => act(game.sellToBloq, "sell")} className="flex-1 rounded-full border-2 border-navy font-semibold disabled:opacity-30">Sell</Press>
        <Press disabled={!canBuy} onClick={() => act(game.buyFromBloq, "buy")} className="flex-1 rounded-full bg-navy font-semibold text-ivory disabled:opacity-30">Buy</Press>
        </div>
      </div>
    </article>
  );
}
