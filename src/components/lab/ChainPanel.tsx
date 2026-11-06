import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { NEAR_CONFIG, explorer, useBloqvia, useDailyQuests, useFinalBlock, type TxEntry } from "@/near";
import { useGame, IS_MOCK } from "@/game/useGame";
import { LESSON_CONTENT } from "@/game/content";
import { itemLabel } from "@/components/GameBits";

/** Shorten "learner-7c4f3a….bloqvia.testnet" to "learner-7c4f…testnet". */
export function shortAccount(id: string) {
  if (id.length <= 22) return id;
  const head = id.split(".")[0] ?? id;
  return `${head.slice(0, 12)}…${id.slice(id.lastIndexOf(".") + 1)}`;
}

function ago(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** "On NEAR · live": the read-only desktop panel listing what the chain saw. */
export function ChainPanel({ limit = 8, seeAll = false }: { limit?: number; seeAll?: boolean }) {
  const game = useGame();
  const height = useFinalBlock();
  const id = game.accountId;
  return (
    <aside aria-label="On NEAR" className="flex flex-col gap-4 text-ivory">
      <div>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">
          <span className="h-2 w-2 rounded-full bg-lime motion-safe:animate-pulse" aria-hidden="true" />On NEAR · live
        </p>
        <h3 className="mt-2 font-display text-xl font-medium tracking-[-0.02em]">What the chain saw</h3>
      </div>
      <span className="bloq-ticker self-start" aria-label="NEAR testnet block height">
        <i key={height ?? 0} aria-hidden="true" />NEAR testnet{height !== null ? <> · block <b>{height.toLocaleString("en-US")}</b></> : null}
      </span>
      <dl className="rounded-2xl bg-navy-soft p-4 font-mono text-[12px] leading-relaxed">
        <Row k="Your account">
          {id ? <a href={explorer.account(id)} target="_blank" rel="noopener noreferrer" className="text-ivory underline-offset-4 hover:underline">{shortAccount(id)}</a> : "—"}
        </Row>
        <Row k="Game contract">{NEAR_CONFIG.coreContractId}</Row>
        <Row k="Gas you paid"><span className="text-lime">0 NEAR</span></Row>
        <Row k="Paid by">the relayer</Row>
      </dl>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-lavender">Your transactions</p>
        {IS_MOCK ? (
          <p className="rounded-2xl bg-navy-soft p-4 text-sm text-lavender">Mock mode: these actions aren't on chain.</p>
        ) : (
          <TxList limit={limit} seeAll={seeAll} />
        )}
      </div>
      <p className="text-xs leading-relaxed text-lavender/80">Every action here is a real NEAR testnet transaction. Open any of them on the explorer.</p>
    </aside>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-lavender">{k}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}

function TxList({ limit, seeAll }: { limit: number; seeAll: boolean }) {
  const { txLog } = useBloqvia();
  const { quests } = useDailyQuests();
  const reduce = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(t); }, []);

  const title = (e: TxEntry) => {
    const n = e.amount ?? 1;
    switch (e.kind) {
      case "quest": {
        const t = LESSON_CONTENT.find((l) => l.lesson_id === e.ref)?.title ?? quests.find((q) => q.lesson_id === e.ref)?.title ?? e.ref ?? "";
        return `Quest: ${t}`;
      }
      case "sell": return `Sold ${n} ${itemLabel(e.ref ?? "")} to Bloq`;
      case "buy": return `Bought ${n} ${itemLabel(e.ref ?? "")} from Bloq`;
      default: return "Graduated: Passport sealed";
    }
  };

  const accountId = useGame().accountId; // hooks before any early return
  const list = txLog.slice(0, limit);
  if (!list.length) return <p className="rounded-2xl bg-navy-soft p-4 text-sm text-lavender">Nothing yet. Your first quest will show up here.</p>;
  return (
    <div>
    <ul className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {list.map((e) => (
          <motion.li
            key={e.txHash}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl bg-navy-soft px-4 py-3"
          >
            <p className="text-sm font-semibold">{title(e)}</p>
            <p className="mt-1 flex items-center justify-between gap-2 font-mono text-[11px] text-lavender">
              <span className="min-w-0 truncate">{e.methods[0] ?? ""} · {ago(e.at, now)}</span>
              <a href={e.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-lime hover:underline">explorer ↗</a>
            </p>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
    {seeAll && accountId && txLog.length > limit && (
      <a
        href={explorer.account(accountId)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block font-display text-sm font-semibold text-lime underline-offset-4 hover:underline focus-visible:underline"
      >
        See all {txLog.length} on the explorer ↗
      </a>
    )}
    </div>
  );
}
