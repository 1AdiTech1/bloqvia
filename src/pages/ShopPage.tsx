import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Info, Minus, Plus, TriangleAlert } from "lucide-react";
import { useGame } from "@/game/useGame";
import { ITEM_IDS, itemAmount } from "@/game/content";
import { PhoneShell } from "@/components/PhoneShell";
import { RequireAccount } from "@/components/RequireAccount";
import { bloqLine } from "@/components/Bloq";
import { ItemIcon, itemLabel } from "@/components/GameBits";
import { Bloq, SpeechBubble, talkMs, type BloqHandle, type BloqPose, type BloqProp, useMotionOff } from "@/bloq";
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
  useEffect(() => { merchant.current?.talk(talkMs(line)); }, [line]);
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
  const tapMerchant = () => { merchant.current?.jump(); react("tap", ""); };

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
      </div>

      {!bloq.shop_open && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-coral p-4 text-sm font-medium text-navy">
          <TriangleAlert className="h-5 w-5 shrink-0" />
          Bloq's treasury is below 500 gold — shop closed until it refills.
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 dk:grid dk:grid-cols-3">
        {bloq.prices.map((p) => (
          <TradeCard key={p.token_id} price={p} have={itemAmount(learner.items, p.token_id)} gold={Number(learner.gold)} shopOpen={bloq.shop_open} onTraded={onTraded} />
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

const ITEM_PROP: Record<string, BloqProp> = { "key-fragment": "key", "fuel-cell": "fuel", "contract-seal": "scroll" };

function TradeCard({ price, have, gold, shopOpen, onTraded }: { price: ItemPrice; have: number; gold: number; shopOpen: boolean; onTraded: (id: string, kind: "sell" | "buy") => void }) {
  const game = useGame();
  const [qty, setQty] = useState(1);
  const [tip, setTip] = useState(false);
  const id = price.token_id;
  const stock = Number(price.bloq_stock);

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
