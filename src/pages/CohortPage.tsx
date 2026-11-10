import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ExternalLink, X } from "lucide-react";
import { useBounties, claimStatusLabel, views, markMissionsSeen, proposalKind } from "@/near";
import type { Bounty, Claim, DaoProposal, ProposeInput, ProposeResult, Requirement, Tier } from "@/near";
import { IS_MOCK, useGame } from "@/game/useGame";
import { useIsDesktop } from "@/components/lab/useDesktop";
import { Bloq, SpeechBubble, talkMs, useSay, type BloqHandle, useMotionOff } from "@/bloq";
import { PhoneShell } from "@/components/PhoneShell";
import { RequireAccount } from "@/components/RequireAccount";
import { LabLoader } from "@/components/LabLoader";
import { Press, labEase } from "@/components/lab/motion";
import { SheetGrab, useSheetDrag } from "@/components/lab/SheetGrab";
import { formatQuestDate } from "@/components/lab/DailyQuestCard";
import { cn } from "@/lib/utils";

export function CohortPage() {
  const game = useGame();
  useEffect(() => { markMissionsSeen(game.accountId); }, [game.accountId]);
  return (
    <RequireAccount>
      <PhoneShell nav>
        <MissionsHeader />
        <div className="mt-6">{IS_MOCK ? <Note text="The missions board plays on chain. Switch off mock mode to see it." /> : <CohortInner />}</div>
      </PhoneShell>
    </RequireAccount>
  );
}

function MissionsHeader() {
  const graduated = !!useGame().learner?.graduated;
  const bloq = useRef<BloqHandle>(null);
  const desktop = useIsDesktop();
  const [line, sayLine] = useSay();
  const say = (t: string) => { sayLine(t); bloq.current?.talk(talkMs(t), t); };
  useEffect(() => {
    const t = window.setTimeout(() => say(graduated ? "You graduated. The board checks you qualified, then pays." : "These open up once you graduate. The chain checks, not me."), 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex items-end justify-between gap-3 pt-20 dk:items-start dk:pt-6">
      <div className="min-w-0 dk:pt-[96px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">Graduates' board</p>
        <h1 className="mt-2 font-display text-4xl font-medium uppercase leading-none tracking-[-0.04em]">Missions</h1>
        <p className="mt-2 text-sm text-lavender">Graduates take on small tasks. The chain checks who qualified.</p>
      </div>
      <button type="button" aria-label="Bloq" onClick={() => { bloq.current?.jump("small"); say("Small bounties are paid by the board. Big ones need a DAO vote."); }} className="relative w-[112px] shrink-0">
        <Bloq ref={bloq} hat="beanie" prop="badge" pose="hold" label="Bloq in a beanie" />
        <SpeechBubble text={line} tone="light" side={desktop ? "left" : "above"} />
      </button>
    </div>
  );
}

/** yoctoNEAR → "1.25" (4 decimals below 0.01). Never throws. */
export function near(yocto: string | undefined | null): string {
  try {
    const n = Number(BigInt(yocto ?? "0") / 10n ** 20n) / 10_000;
    return n.toFixed(n > 0 && n < 0.01 ? 4 : 2);
  } catch {
    return "—";
  }
}

const daoUrl = (id: string) => `https://testnet.nearblocks.io/address/${id}`;

function Note({ text }: { text: string }) {
  return <div className="rounded-[1.6rem] bg-ivory p-5 text-[15px] leading-relaxed text-navy shadow-lift">{text}</div>;
}

const SEAT_CHIP = "inline-flex rounded-full bg-lime px-2.5 py-1 text-[11px] font-semibold text-navy";

/**
 * The Passport as a vote (prompt 30): a sealed Passport is a seat in the DAO's
 * `graduates` role, the Season 2 stamp a seat in `founders`. Seats come from the
 * DAO's own policy through the relayer; votes are signed by the learner's key.
 */
function Seat() {
  const b = useBounties();
  const [proposing, setProposing] = useState(false);
  const [filed, setFiled] = useState<ProposeResult | null>(null);
  const seat = b.seat;
  const seated = !!seat && (seat.graduate || seat.founder);

  return (
    <section>
      <SectionLabel>Your seat</SectionLabel>
      <div className="rounded-[1.6rem] bg-ivory p-5 text-navy shadow-lift">
        {!seat ? (
          <p className="text-[15px] leading-relaxed">Sign in to see your seat.</p>
        ) : !seat.graduate && !seat.founder ? (
          <>
            <p className="font-display text-xl font-medium leading-none tracking-[-0.02em]">No seat yet.</p>
            <p className="mt-2 text-[15px] leading-relaxed text-navy/80">Graduate to get a vote: a sealed Passport is a seat in the cohort DAO.</p>
          </>
        ) : seat.founder ? (
          <>
            <span className={SEAT_CHIP}>Founder seat</span>
            <p className="mt-2 text-[15px] leading-relaxed text-navy/80">You vote on who gets paid and on what the cohort pays for. You can propose a bounty.</p>
            {filed ? (
              <div className="mt-3">
                <p className="text-sm font-semibold">Proposal #{filed.proposalId} filed · founders vote on it</p>
                <a href={filed.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline">
                  See it on the explorer <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              </div>
            ) : (
              <Press onClick={() => setProposing(true)} disabled={b.busy} className="mt-3 min-h-11 rounded-full bg-lime px-4 text-sm font-semibold text-navy disabled:opacity-50">
                Propose a bounty
              </Press>
            )}
          </>
        ) : (
          <>
            <span className={SEAT_CHIP}>Graduate seat</span>
            <p className="mt-2 text-[15px] leading-relaxed text-navy/80">You vote on who gets paid for a medium bounty. Finish Season 2 to vote on what the cohort pays for, and to propose a bounty.</p>
          </>
        )}
        {seat && seated && !seat.canVote && (
          <p className="mt-2 text-sm leading-relaxed text-navy/60">This account was created before votes existed, so it cannot sign one; a new account can.</p>
        )}
        <p className="mt-3 font-mono text-xs text-navy/60">
          Seats are roles on the DAO's policy
          {b.dao && (
            <> · <a href={daoUrl(b.dao.id)} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-navy">see the policy</a></>
          )}
        </p>
      </div>
      <AnimatePresence>{proposing && <ProposeSheet key="propose" onClose={() => setProposing(false)} onFiled={setFiled} />}</AnimatePresence>
    </section>
  );
}

const TIERS: Tier[] = ["Small", "Medium", "Large"];
const TIER_CAP: Record<Tier, string> = {
  Small: "up to 0.5 NEAR · the board pays",
  Medium: "up to 2 NEAR · one founder vote",
  Large: "up to 10 NEAR · DAO proposal",
};

type ReqValue = "graduated" | "level-3" | "level-2" | "daily";
const REQ_OPTIONS: { value: ReqValue; label: string }[] = [
  { value: "graduated", label: "Graduated" },
  { value: "level-3", label: "Passport level 3" },
  { value: "level-2", label: "Passport level 2" },
  { value: "daily", label: "Today's quest completed" },
];

/** The select's choice as the board's requirement; today's quest is today's UTC date. */
function requirementOf(v: ReqValue): ProposeInput["requirement"] {
  if (v === "level-3") return { PassportLevel: { min: 3 } };
  if (v === "level-2") return { PassportLevel: { min: 2 } };
  if (v === "daily") return { QuestCompleted: { lesson_id: `daily-${new Date().toISOString().slice(0, 10)}` } };
  return "Graduated";
}

const FIELD = "min-h-[48px] w-full rounded-full border-2 border-navy/10 bg-card px-4 text-[15px] outline-none focus:border-navy";
const FIELD_LABEL = "block text-sm font-semibold";

/** Founders only: a new bounty for the board, filed on the DAO as a proposal (prompt 30). */
function ProposeSheet({ onClose, onFiled }: { onClose: () => void; onFiled: (r: ProposeResult) => void }) {
  const b = useBounties();
  const reduce = useMotionOff();
  const desktop = useIsDesktop();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tier, setTier] = useState<Tier | "">("");
  const [reward, setReward] = useState("");
  const [req, setReq] = useState<ReqValue>("graduated");
  const [maxClaims, setMaxClaims] = useState("10");
  const sheet = useSheetDrag(onClose, !desktop);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empty = !title.trim() || !description.trim() || !reward.trim() || !maxClaims.trim() || tier === "";

  const file = async () => {
    if (tier === "") return;
    try {
      const r = await b.propose({ title: title.trim(), description: description.trim(), tier, requirement: requirementOf(req), reward_near: reward.trim(), max_claims: Number(maxClaims) });
      onFiled(r);
      onClose();
    } catch {
      /* the store's error shows in the sheet */
    }
  };

  return (
    <motion.div className="fixed inset-0 z-[55] flex items-end justify-center dk:items-center dk:py-12 dk:pl-[calc(max(0px,(100vw-1440px)/2)+220px)] dk:pr-[calc(max(0px,(100vw-1440px)/2)+330px)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Propose a bounty">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-navy/50" />
      <motion.div
        initial={reduce ? { opacity: 0 } : desktop ? { scale: 0.96, opacity: 0 } : { y: 80, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={reduce ? { opacity: 0 } : desktop ? { scale: 0.96, opacity: 0 } : { y: 80, opacity: 0 }}
        transition={desktop ? { duration: 0.22, ease: labEase } : { duration: 0.5, ease: labEase }}
        className="relative flex max-h-[85vh] w-full max-w-[480px] flex-col rounded-t-[2rem] bg-ivory pb-[14px] pr-2 text-navy shadow-lift dk:max-w-[560px] dk:max-h-[calc(100vh-96px)] dk:rounded-[28px] dk:pt-[14px]"
        ref={sheet.ref}
        {...sheet.dragProps}
      >
        <SheetGrab controls={sheet.controls} onClose={onClose} />
        <Press onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full text-navy/60">
          <X className="h-5 w-5" />
        </Press>
        <div className="bq-scroll min-h-0 flex-1 overflow-y-auto pb-5 pl-6 pr-4 dk:pt-3">
          <h2 className="pr-10 pt-2 font-display text-2xl font-medium leading-none tracking-[-0.02em] dk:pt-[18px]">Propose a bounty</h2>

          <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); void file(); }}>
            <label className="block space-y-1.5">
              <span className={FIELD_LABEL}>Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} required placeholder="What should the board pay for?" aria-label="Title" className={FIELD} />
            </label>

            <label className="block space-y-1.5">
              <span className={FIELD_LABEL}>Description</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} required rows={3} placeholder="What the learner does, and how the board checks it." aria-label="Description" className="w-full rounded-3xl border-2 border-navy/10 bg-card p-4 text-[15px] outline-none focus:border-navy" />
            </label>

            <fieldset>
              <legend className={cn(FIELD_LABEL, "mb-1.5")}>Tier</legend>
              <div className="grid grid-cols-3 gap-2">
                {TIERS.map((t) => (
                  <label key={t} className={cn("cursor-pointer rounded-2xl border-2 p-2.5 text-center transition-colors", tier === t ? "border-navy bg-lime/20" : "border-navy/10 bg-card")}>
                    <input type="radio" name="tier" value={t} checked={tier === t} onChange={() => setTier(t)} className="sr-only" />
                    <span className="block text-sm font-semibold">{t}</span>
                    <span className="mt-1 block text-[11px] leading-snug text-navy/60">{TIER_CAP[t]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block space-y-1.5">
              <span className={FIELD_LABEL}>Reward in NEAR</span>
              <input type="number" value={reward} onChange={(e) => setReward(e.target.value)} step="0.01" min="0.01" required placeholder="0.5" aria-label="Reward in NEAR" className={FIELD} />
            </label>

            <label className="block space-y-1.5">
              <span className={FIELD_LABEL}>Requirement</span>
              <select value={req} onChange={(e) => setReq(e.target.value as ReqValue)} aria-label="Requirement" className={FIELD}>
                {REQ_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className={FIELD_LABEL}>Max claims</span>
              <input type="number" value={maxClaims} onChange={(e) => setMaxClaims(e.target.value)} min="1" max="100" step="1" required aria-label="Max claims" className={FIELD} />
            </label>

            <Press type="submit" disabled={b.busy || empty} className="min-h-11 w-full rounded-full bg-lime py-3 text-base font-semibold text-navy disabled:opacity-50">
              File the proposal
            </Press>
          </form>

          {b.error && (
            <div className="mt-4 rounded-2xl border-l-4 border-coral bg-coral/15 p-4 text-[15px] leading-relaxed">{b.error}</div>
          )}

          <p className="mt-3 text-xs leading-relaxed text-navy/60">
            The relayer files it on the DAO in your name and pays the bond; founders vote with their own keys. If it passes, the DAO adds it to the board and the reward comes from the board's allowance.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CohortInner() {
  const b = useBounties();
  if (b.loading) return <div className="flex justify-center py-16"><LabLoader label="Reading the board…" /></div>;
  if (!b.enabled) return <Note text="The board is not deployed on this network yet." />;
  const titleOf = (id: number) => b.bounties.find((x) => x.id === id)?.title ?? `Bounty #${id}`;

  return (
    <div className="space-y-8">
      <Treasury />
      <Seat />
      <section>
        <SectionLabel>Bounties</SectionLabel>
        {b.bounties.length === 0 ? (
          <p className="text-sm text-lavender">No bounties yet.</p>
        ) : (
          <div className="space-y-4 dk:grid dk:grid-cols-2 dk:gap-4 dk:space-y-0">{b.bounties.map((x, i) => <BountyCard key={x.id} bounty={x} index={i} />)}</div>
        )}
      </section>
      <section>
        <SectionLabel>Recent on the board</SectionLabel>
        {b.recent.length === 0 ? (
          <p className="text-sm text-lavender">No claims yet — be the first.</p>
        ) : (
          <ul className="divide-y divide-ivory/10 rounded-[1.6rem] bg-navy-soft px-4">
            {[...b.recent].sort((a, z) => z.at_ns - a.at_ns).slice(0, 10).map((c) => (
              <li key={`${c.bounty_id}-${c.account_id}`} className="py-3 text-sm">
                <span className="font-mono text-xs text-lavender">{c.account_id.length > 14 ? c.account_id.slice(0, 14) + "…" : c.account_id}</span>
                <span className="block font-medium">{titleOf(c.bounty_id)}</span>
                <span className="text-xs text-lime">{claimStatusLabel(c.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {b.dao && <Proposals proposals={b.dao.proposals} />}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-lavender">{children}</h2>;
}

function Treasury() {
  const { dao, config } = useBounties();
  const threshold = dao ? (Array.isArray(dao.threshold) ? `${dao.threshold[0]} of ${dao.threshold[1]}` : String(dao.threshold)) : "";
  return (
    <section className="rounded-[1.6rem] border border-lavender/30 bg-navy p-5 text-ivory shadow-lift">
      <p className="text-[11px] font-semibold tracking-[0.04em] text-lavender">Bloqvia DAO</p>
      {dao && (
        <>
          <a href={daoUrl(dao.id)} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-1 break-all font-mono text-sm text-lime underline-offset-4 hover:underline">
            {dao.id} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
          <p className="font-display text-4xl font-medium tracking-[-0.03em]">{near(dao.balance)} <span className="text-xl text-lavender">NEAR</span></p>
          <p className="mt-3 break-words text-sm">Council: {dao.council.join(", ") || "—"} · {threshold} vote(s) approve</p>
        </>
      )}
      {config && <p className="mt-1 text-sm">Board allowance {near(config.allowance)} NEAR · paid so far {near(config.paid_total)} NEAR</p>}
      <p className="mt-3 text-xs leading-relaxed text-lavender">
        The DAO funds the board and approves bigger rewards. The board checks who qualified against the game contract; nobody moves money by hand.
      </p>
    </section>
  );
}

const TIER: Record<Tier, { label: string; cls: string }> = {
  Small: { label: "Small · paid by the board", cls: "bg-lime text-navy" },
  Medium: { label: "Medium · one council vote", cls: "bg-lavender text-navy" },
  Large: { label: "Large · DAO proposal", cls: "bg-coral/30 text-navy" },
};

function requirementText(r: Requirement): string {
  if (r === "Graduated") return "Requires: graduated";
  if ("PassportLevel" in r) return `Requires: Passport level ${r.PassportLevel.min}`;
  const id = r.QuestCompleted.lesson_id;
  return id.startsWith("daily-") ? `Requires: today's quest (${formatQuestDate(id.slice(6))}) completed` : `Requires: quest ${id} completed`;
}

function BountyCard({ bounty, index }: { bounty: Bounty; index: number }) {
  const b = useBounties();
  const reduce = useMotionOff();
  const [mine, setMine] = useState(false);
  const [txUrl, setTxUrl] = useState<string | null>(null);
  const claim = b.claimFor(bounty.id);
  const why = b.eligibility(bounty);
  const tier = TIER[bounty.tier] ?? TIER.Small;

  const onClaim = async () => {
    setMine(true);
    setTxUrl(null);
    try {
      const r = await b.claim(bounty.id);
      setTxUrl(b.lastTx?.url ?? `https://testnet.nearblocks.io/txns/${r.txHash}`);
    } catch {
      /* error is shown from the store */
    }
  };
  const working = mine && b.busy;

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: labEase, delay: Math.min(index, 4) * 0.05 }}
      className="rounded-[1.6rem] bg-ivory p-5 text-navy shadow-lift"
    >
      <div className="flex items-center justify-between gap-3">
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", tier.cls)}>{tier.label}</span>
        <span className="shrink-0 font-display text-lg font-bold">{near(bounty.reward)} NEAR</span>
      </div>
      <h3 className="mt-3 font-display text-2xl font-medium leading-tight tracking-[-0.02em]">{bounty.title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-navy/80">{bounty.description}</p>
      <p className="mt-3 text-sm font-medium">{requirementText(bounty.requirement)}</p>
      <p className="mt-1 text-xs text-navy/60">
        {bounty.claims} of {bounty.max_claims} claimed{!bounty.open && " · Closed"}
      </p>

      <div className="mt-4">
        {working ? (
          <div className="flex min-h-11 items-center"><LabLoader tone="navy" size={28} label="Checking on chain…" /></div>
        ) : claim ? (
          <ClaimStatus claim={claim} bountyId={bounty.id} />
        ) : why === null ? (
          <Press onClick={onClaim} disabled={b.busy} className="min-h-11 w-full rounded-full bg-lime py-3 text-base font-semibold text-navy disabled:opacity-50">
            Claim
          </Press>
        ) : (
          <button type="button" disabled className="min-h-11 w-full cursor-not-allowed rounded-full border border-navy/20 py-3 text-sm font-semibold text-navy/50">
            {why}
          </button>
        )}
        {txUrl && claim && (
          <a href={txUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline">
            See it on the explorer <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {mine && !b.busy && b.error && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border-l-4 border-coral bg-coral/15 p-4 text-[15px] leading-relaxed">
            <span className="flex-1">{b.error}</span>
            <button type="button" aria-label="Dismiss" onClick={() => { b.clearError(); setMine(false); }} className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </motion.article>
  );
}

function ClaimStatus({ claim, bountyId }: { claim: Claim; bountyId: number }) {
  const { dao, boardId, learner } = useBounties();
  const [copied, setCopied] = useState(false);
  const s = claim.status;
  const label = claimStatusLabel(s);

  if (s === "Paid") {
    return <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-lime px-4 font-semibold"><Check className="h-4 w-4" strokeWidth={3} /> {label}</span>;
  }
  if (typeof s === "object") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex min-h-11 items-center rounded-full bg-lavender px-4 text-sm font-semibold">{label}</span>
        {dao && (
          <a href={daoUrl(dao.id)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline">
            See the proposal <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    );
  }
  if (s === "Eligible") {
    const copy = async () => {
      try {
        if (!boardId || !learner) return;
        const text = await views.proposalText(boardId, bountyId, learner.account_id);
        await navigator.clipboard.writeText(typeof text === "string" ? text : JSON.stringify(text));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* clipboard or read failed; leave the button as is */
      }
    };
    return (
      <div className="rounded-2xl bg-coral/20 p-4">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 text-sm">File a proposal in the DAO to be paid</p>
        <Press onClick={copy} className="mt-3 min-h-11 rounded-full border border-navy/30 px-4 text-sm font-semibold">
          {copied ? "Copied" : "Copy proposal text"}
        </Press>
      </div>
    );
  }
  return <span className="inline-flex min-h-11 items-center rounded-full bg-navy/10 px-4 text-sm font-semibold">{label}</span>;
}

const KIND_WORD: Record<string, string> = {
  transfer: "Payment",
  call: "Board",
  add_member_to_role: "Seat",
  policy: "Policy",
  change_policy: "Policy",
};

function Proposals({ proposals }: { proposals: DaoProposal[] }) {
  const b = useBounties();
  const [votingId, setVotingId] = useState<number | null>(null);
  const chip = (st: DaoProposal["status"]) =>
    st === "Approved" ? "bg-lime text-navy" : st === "InProgress" ? "bg-lavender text-navy" : "bg-coral/80 text-navy";

  const cast = async (id: number, approve: boolean) => {
    setVotingId(id);
    try {
      await b.vote(id, approve);
    } catch {
      /* the store's error shows under the list */
    } finally {
      setVotingId(null);
    }
  };

  return (
    <section>
      <SectionLabel>DAO proposals</SectionLabel>
      {proposals.length === 0 ? (
        <p className="text-sm text-lavender">No proposals yet.</p>
      ) : (
        <ul className="divide-y divide-ivory/10 rounded-[1.6rem] bg-navy-soft px-4">
          {proposals.slice(0, 10).map((p) => {
            const approves = Object.values(p.vote_counts ?? {}).reduce((n, v) => n + (Array.isArray(v) ? Number(v[0]) || 0 : 0), 0);
            const desc = p.description.length > 90 ? p.description.slice(0, 90) + "…" : p.description;
            const kind = proposalKind(p);
            const why = b.canVoteOn(p);
            return (
              <li key={p.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-lavender">#{p.id}</span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-ivory/10 px-2.5 py-0.5 text-[11px] font-semibold text-ivory">{KIND_WORD[kind] ?? kind}</span>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", chip(p.status))}>{p.status}</span>
                  </span>
                </div>
                <p className="mt-1 break-words">{desc}</p>
                <p className="mt-0.5 text-xs text-lavender">{approves} approve</p>
                {why === null ? (
                  votingId === p.id ? (
                    <div className="mt-2"><LabLoader size={24} label="Voting on chain…" /></div>
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <Press onClick={() => void cast(p.id, true)} disabled={b.busy} className="min-h-11 rounded-full bg-lime px-4 text-sm font-semibold text-navy disabled:opacity-50">
                        Approve
                      </Press>
                      <Press onClick={() => void cast(p.id, false)} disabled={b.busy} className="min-h-11 rounded-full border border-navy/20 px-4 text-sm font-semibold text-ivory disabled:opacity-50">
                        Reject
                      </Press>
                    </div>
                  )
                ) : p.status === "InProgress" ? (
                  <p className="mt-1 text-xs text-lavender">{why}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {b.error && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border-l-4 border-coral bg-coral/15 p-4 text-[15px] leading-relaxed">
          <span className="flex-1">{b.error}</span>
          <button type="button" aria-label="Dismiss" onClick={() => b.clearError()} className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-lavender">
        Seat holders vote here with their own key; the council keeps its vote; the board files medium claims by itself.
      </p>
    </section>
  );
}
