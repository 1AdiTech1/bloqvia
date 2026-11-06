import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ExternalLink, X } from "lucide-react";
import { useBounties, claimStatusLabel, views } from "@/near";
import type { Bounty, Claim, DaoProposal, Requirement, Tier } from "@/near";
import { IS_MOCK } from "@/game/useGame";
import { PhoneShell } from "@/components/PhoneShell";
import { RequireAccount } from "@/components/RequireAccount";
import { LabLoader } from "@/components/LabLoader";
import { Press, labEase } from "@/components/lab/motion";
import { formatQuestDate } from "@/components/lab/DailyQuestCard";
import { cn } from "@/lib/utils";

export function CohortPage() {
  return (
    <RequireAccount>
      <PhoneShell nav>
        <h1 className="font-display text-4xl font-medium uppercase leading-none tracking-[-0.04em]">Missions</h1>
        <p className="mt-2 text-sm text-lavender">Graduates take on small tasks. The chain checks who qualified.</p>
        <div className="mt-6">{IS_MOCK ? <Note text="The missions board plays on chain. Switch off mock mode to see it." /> : <CohortInner />}</div>
      </PhoneShell>
    </RequireAccount>
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

function CohortInner() {
  const b = useBounties();
  if (b.loading) return <div className="flex justify-center py-16"><LabLoader label="Reading the board…" /></div>;
  if (!b.enabled) return <Note text="The board is not deployed on this network yet." />;
  const titleOf = (id: number) => b.bounties.find((x) => x.id === id)?.title ?? `Bounty #${id}`;

  return (
    <div className="space-y-8">
      <Treasury />
      <section>
        <SectionLabel>Bounties</SectionLabel>
        {b.bounties.length === 0 ? (
          <p className="text-sm text-lavender">No bounties yet.</p>
        ) : (
          <div className="space-y-4">{b.bounties.map((x, i) => <BountyCard key={x.id} bounty={x} index={i} />)}</div>
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lavender">Bloqvia DAO</p>
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
  const reduce = useReducedMotion();
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

function Proposals({ proposals }: { proposals: DaoProposal[] }) {
  const chip = (st: DaoProposal["status"]) =>
    st === "Approved" ? "bg-lime text-navy" : st === "InProgress" ? "bg-lavender text-navy" : "bg-coral/80 text-navy";
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
            return (
              <li key={p.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-lavender">#{p.id}</span>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", chip(p.status))}>{p.status}</span>
                </div>
                <p className="mt-1 break-words">{desc}</p>
                <p className="mt-0.5 text-xs text-lavender">{approves} approve</p>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs leading-relaxed text-lavender">
        Council members vote with near-cli (<code className="font-mono">act_proposal</code>); the board files medium claims here by itself.
      </p>
    </section>
  );
}
