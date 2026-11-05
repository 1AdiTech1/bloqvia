import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Info, Minus, Plus, TriangleAlert } from "lucide-react";
import { useGame } from "@/game/useGame";
import { ITEM_IDS, itemAmount } from "@/game/content";
import { PhoneShell } from "@/components/PhoneShell";
import { RequireAccount } from "@/components/RequireAccount";
import { BloqCharacter, bloqLine } from "@/components/Bloq";
import { GoldSeal, ItemIcon, itemLabel } from "@/components/GameBits";
import { InventoryBar } from "@/components/lab/InventoryBar";
import { AnimatedNumber, Press, buzz, labEase } from "@/components/lab/motion";
import type { ItemPrice } from "@/game/types";
import { cn } from "@/lib/utils";
import { AskBloqButton, AskBloqSheet } from "@/components/lab/AskBloqSheet";

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
  const reduce = useReducedMotion();
  const bloq = game.bloq!;
  const learner = game.learner!;
  const [lastItem, setLastItem] = useState<string | null>(null);
  const [trades, setTrades] = useState(0);
  const [ceremony, setCeremony] = useState(false);

  const lowest = [...bloq.prices].sort((a, b) => Number(a.bloq_stock) - Number(b.bloq_stock))[0];
  const focus = bloq.prices.find((p) => p.token_id === lastItem) ?? lowest;
  const line = bloqLine(Number(focus?.bloq_stock ?? 0), bloq.shop_open);

  const fee = Number(bloq.graduation_fee);
  const checks = [
    { ok: learner.level === 3, label: "Three quests complete" },
    { ok: ITEM_IDS.every((id) => itemAmount(learner.items, id) >= 1), label: "One of each item" },
    { ok: Number(learner.gold) >= fee, label: `Fee: ${fee} BloqGold` },
  ];

  const [asking, setAsking] = useState(false);
  const onTraded = (id: string) => { setLastItem(id); setTrades((t) => t + 1); buzz(); };

  const doGraduate = async () => {
    try {
      await game.graduate();
      buzz();
      setCeremony(true);
      setTimeout(() => navigate({ to: "/reveal" }), reduce ? 400 : 1500);
    } catch { /* coral toast shows the error */ }
  };

  return (
    <>
      <InventoryBar />

      <div className="mt-6 flex items-end gap-3">
        <BloqCharacter size={112} pose={trades} />
        <div className="relative mb-8 flex-1 rounded-3xl rounded-bl-md bg-ivory p-4 text-navy shadow-lift">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bloq</p>
          <AnimatePresence mode="wait">
            <motion.p key={line} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="mt-1 font-display text-lg font-medium leading-snug">
              “{line}”
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {!bloq.shop_open && (
        <div className="mt-2 flex items-start gap-3 rounded-2xl bg-coral p-4 text-sm font-medium text-navy">
          <TriangleAlert className="h-5 w-5 shrink-0" />
          Bloq's treasury is below 500 gold — shop closed until it refills.
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {bloq.prices.map((p) => (
          <TradeCard key={p.token_id} price={p} have={itemAmount(learner.items, p.token_id)} gold={Number(learner.gold)} shopOpen={bloq.shop_open} onTraded={onTraded} />
        ))}
      </div>
      <div className="mt-3 flex justify-center">
        <AskBloqButton label="Ask Bloq why prices move" onClick={() => setAsking(true)} className="text-lavender" />
      </div>
      <AskBloqSheet open={asking} onClose={() => setAsking(false)} context="shop" />

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
            <div className="relative flex h-72 w-52 flex-col items-center justify-center rounded-3xl border-l-4 border-lime bg-navy-soft shadow-lift">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lavender">Passport</p>
              <motion.div className="mt-6" initial={reduce ? false : { scale: 2.2, opacity: 0, rotate: -25 }} animate={{ scale: 1, opacity: 1, rotate: -6 }} transition={{ duration: 0.7, delay: 0.25, ease: labEase }}>
                <GoldSeal size={110} />
              </motion.div>
              <p className="mt-6 font-display text-xl font-medium uppercase tracking-[-0.02em] text-ivory">Graduate</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function TradeCard({ price, have, gold, shopOpen, onTraded }: { price: ItemPrice; have: number; gold: number; shopOpen: boolean; onTraded: (id: string) => void }) {
  const game = useGame();
  const [qty, setQty] = useState(1);
  const [tip, setTip] = useState(false);
  const id = price.token_id;
  const stock = Number(price.bloq_stock);

  const act = async (fn: typeof game.sellToBloq) => {
    try {
      await fn(id, qty);
      onTraded(id);
      setQty(1);
    } catch { /* coral toast shows the error */ }
  };

  const canSell = shopOpen && have > 0 && !game.busy;
  const canBuy = shopOpen && stock > 0 && gold >= Number(price.sell_price) * qty && !game.busy;

  return (
    <article className="rounded-3xl bg-ivory p-4 text-navy shadow-lift">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy text-lime">
          <ItemIcon id={id} className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-lg font-medium leading-tight">{itemLabel(id)}</h3>
          <p className="text-xs text-muted-foreground">
            You <strong className="text-navy">{have}</strong> · Bloq's stock <AnimatedNumber value={stock} className="font-semibold text-navy" />
          </p>
        </div>
        <button aria-label="How prices work" aria-expanded={tip} onClick={() => setTip((t) => !t)} onBlur={() => setTip(false)} className="tap -mr-2 flex items-center justify-center rounded-full text-navy/60">
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

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-lavender-soft px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-navy/60">He pays</p>
          <p className="font-display text-2xl font-medium"><AnimatedNumber value={Number(price.buy_price)} className="-ml-1" /></p>
        </div>
        <div className="rounded-2xl bg-navy px-3 py-2 text-ivory">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lavender">He charges</p>
          <p className="font-display text-2xl font-medium"><AnimatedNumber value={Number(price.sell_price)} className="-ml-1" /></p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex items-center rounded-full bg-muted">
          <Press aria-label="Less" disabled={qty <= 1} className="flex items-center justify-center disabled:opacity-30" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Press>
          <span className="w-5 text-center font-display font-semibold tabular-nums" aria-live="polite">{qty}</span>
          <Press aria-label="More" disabled={qty >= 9} className="flex items-center justify-center disabled:opacity-30" onClick={() => setQty((q) => Math.min(9, q + 1))}><Plus className="h-4 w-4" /></Press>
        </div>
        <Press disabled={!canSell} onClick={() => act(game.sellToBloq)} className="flex-1 rounded-full border-2 border-navy font-semibold disabled:opacity-30">Sell</Press>
        <Press disabled={!canBuy} onClick={() => act(game.buyFromBloq)} className="flex-1 rounded-full bg-navy font-semibold text-ivory disabled:opacity-30">Buy</Press>
      </div>
    </article>
  );
}
