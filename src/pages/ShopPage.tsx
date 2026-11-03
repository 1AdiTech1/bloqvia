import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Circle, Info, Minus, Plus, TriangleAlert } from "lucide-react";
import { useGame } from "@/game/useGame";
import { ITEM_IDS, ITEM_NAMES, itemAmount } from "@/game/content";
import { PhoneShell } from "@/components/PhoneShell";
import { RequireAccount } from "@/components/RequireAccount";
import { BloqCharacter, bloqMood } from "@/components/Bloq";
import { ItemIcon } from "@/components/GameBits";
import { LeafDivider } from "@/components/VineLoader";
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
  const bloq = game.bloq!;
  const learner = game.learner!;
  const stocks = bloq.prices.map((p) => Number(p.bloq_stock));
  const fee = Number(bloq.graduation_fee);
  const hasAll = ITEM_IDS.every((id) => itemAmount(learner.items, id) >= 1);
  const checks = [
    { ok: learner.level >= 3, label: "Finish all three quests" },
    { ok: hasAll, label: "One of each item" },
    { ok: Number(learner.gold) >= fee, label: `Fee of ${fee} gold` },
  ];

  const doGraduate = async () => {
    try {
      await game.graduate();
      navigate({ to: "/reveal" });
    } catch {
      /* toast */
    }
  };

  return (
    <>
      <div className="flex items-end gap-3">
        <BloqCharacter size={104} />
        <div className="relative mb-6 flex-1 rounded-3xl rounded-bl-md bg-card p-4 text-sm font-medium shadow-soft">
          <p className="mb-1 font-display text-base font-bold text-moss">Bloq</p>
          {bloqMood(stocks)}
        </div>
      </div>

      {!bloq.shop_open && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-terracotta/15 p-4 text-sm font-medium text-terracotta">
          <TriangleAlert className="h-5 w-5 shrink-0" />
          Bloq's treasury is below 500 gold — shop closed until it refills.
        </div>
      )}

      <p className="mt-5 text-sm text-muted-foreground">
        You have <strong className="text-moss">{Number(learner.gold)} gold</strong>
      </p>

      <div className="mt-3 flex flex-col gap-4">
        {bloq.prices.map((p) => (
          <ItemRow key={p.token_id} price={p} have={itemAmount(learner.items, p.token_id)} disabled={!bloq.shop_open || game.busy} />
        ))}
      </div>

      <div className="my-8"><LeafDivider /></div>

      <section className="card-organic p-5">
        <h2 className="text-xl font-bold text-moss">Graduate</h2>
        <p className="text-sm text-muted-foreground">Hand Bloq one of each item and the fee to seal your Passport.</p>
        <ul className="mt-4 flex flex-col gap-2">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-3 font-medium">
              {c.ok ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-leaf text-primary-foreground"><Check className="h-4 w-4" /></span>
              ) : (
                <Circle className="h-6 w-6 text-border" />
              )}
              <span className={c.ok ? "text-moss" : "text-muted-foreground"}>{c.label}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={doGraduate}
          disabled={game.busy || learner.graduated}
          className="tap mt-5 w-full rounded-full bg-sun-gradient py-3 text-lg font-bold text-accent-foreground shadow-soft disabled:opacity-50"
        >
          {learner.graduated ? "Graduated" : "Graduate"}
        </button>
      </section>
    </>
  );
}

function ItemRow({ price, have, disabled }: { price: ItemPrice; have: number; disabled: boolean }) {
  const game = useGame();
  const [qty, setQty] = useState(1);
  const [tip, setTip] = useState(false);
  const id = price.token_id;

  const act = async (fn: typeof game.sellToBloq) => {
    try {
      await fn(id, qty);
      setQty(1);
    } catch {
      /* toast */
    }
  };

  return (
    <article className="card-organic p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-[1rem_0.6rem] bg-secondary text-moss">
          <ItemIcon id={id} className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h3 className="font-bold">{ITEM_NAMES[id]}</h3>
          <p className="text-xs text-muted-foreground">You: {have} · Bloq's stock: {price.bloq_stock}</p>
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-muted p-2">
          <p className="text-xs text-muted-foreground">He pays</p>
          <p className="font-display text-lg font-bold text-moss">{price.buy_price}</p>
        </div>
        <div className="rounded-xl bg-sun-soft p-2">
          <p className="text-xs text-accent-foreground/70">He charges</p>
          <p className="font-display text-lg font-bold text-accent-foreground">{price.sell_price}</p>
        </div>
        <button
          aria-label="How prices work"
          onClick={() => setTip((t) => !t)}
          onBlur={() => setTip(false)}
          className="tap absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card text-moss shadow-soft"><Info className="h-4 w-4" /></span>
        </button>
        {tip && (
          <div role="tooltip" className="absolute inset-x-0 top-full z-10 mt-2 rounded-2xl bg-moss p-3 text-left text-sm text-primary-foreground shadow-lift">
            Bloq pays less for what he already has a lot of: price = 100 × 40 ÷ (40 + his stock). Nobody can change this rule by hand.
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex items-center rounded-full bg-muted">
          <button aria-label="Less" className="tap flex items-center justify-center" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></button>
          <span className="w-6 text-center font-bold">{qty}</span>
          <button aria-label="More" className="tap flex items-center justify-center" onClick={() => setQty((q) => Math.min(20, q + 1))}><Plus className="h-4 w-4" /></button>
        </div>
        <button disabled={disabled} onClick={() => act(game.sellToBloq)} className={cn("tap flex-1 rounded-full border-2 border-moss font-semibold text-moss disabled:opacity-40")}>Sell</button>
        <button disabled={disabled} onClick={() => act(game.buyFromBloq)} className="tap flex-1 rounded-full bg-moss font-semibold text-primary-foreground disabled:opacity-40">Buy</button>
      </div>
    </article>
  );
}
