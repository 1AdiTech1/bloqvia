/**
 * Module B — the cohort board. Everything here is read from chain: the board
 * (`bounties.bloqvia.testnet`), core (who the learner is) and the Sputnik DAO
 * (who decides, what is pending). `claim(id)` signs `claim_bounty` with the
 * learner's key; core forwards it; the board pays, proposes or certifies.
 *
 *   const b = useBounties();
 *   b.enabled           // false until core reports a board (module not deployed) → render nothing
 *   b.bounties          // newest first
 *   b.myClaims          // this learner's claims
 *   b.eligibility(bounty)   // null = can claim now, else the reason (same rule as the contract)
 *   await b.claim(bounty.id) // throws with the contract's message on refusal
 *   b.dao               // { id, balance, council, threshold, proposals }
 *   b.seat              // { graduate, founder, canVote }: the Passport as a vote (Nov 10)
 *   b.canVoteOn(p)      // null = this learner can vote on proposal p now, else the reason
 *   await b.vote(p.id, true)  // VoteApprove / VoteReject, signed with the account's second key, relayed
 *   await b.propose(input)    // founders: a new bounty for the board, filed as a DAO proposal
 *
 * Hidden in mock mode by the screens (IS_MOCK), like the streak card.
 */
import { useEffect, useSyncExternalStore } from "react";
import { game, views } from "./contracts";
import { relayerApi } from "./relayer";
import { NEAR_CONFIG } from "./config";
import { explorer } from "./explorer";
import { createSigner, type LearnerSigner } from "./signer";
import type { BountiesConfig, Bounty, Claim, ClaimStatus, DaoProposal, LearnerView, RelayResult, SeatResult, ProposeInput, ProposeResult } from "./types";
import { humanError } from "./errors";

export interface DaoView {
  id: string;
  /** yoctoNEAR as a string. */
  balance: string;
  council: string[];
  threshold: [number, number] | string;
  proposals: DaoProposal[];
}

/** The learner's seats on the cohort DAO. `canVote`: this session holds the account's second key (new accounts). */
export interface Seat { graduate: boolean; founder: boolean; canVote: boolean }

export interface BountiesState {
  enabled: boolean;
  seat: Seat | null;
  boardId: string | null;
  config: BountiesConfig | null;
  bounties: Bounty[];
  myClaims: Claim[];
  recent: Claim[];
  dao: DaoView | null;
  learner: LearnerView | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  lastTx: (RelayResult & { url: string }) | null;
}

export interface BountiesStore extends BountiesState {
  refresh: () => Promise<void>;
  claim: (bountyId: number) => Promise<RelayResult>;
  eligibility: (bounty: Bounty) => string | null;
  claimFor: (bountyId: number) => Claim | null;
  clearError: () => void;
  /** null = this learner can vote on the proposal now; else why not (no seat, already voted, closed, old account). */
  canVoteOn: (proposal: DaoProposal) => string | null;
  /** Casts the vote with the account's own key (the DAO records the voter), relayed by the relayer. */
  vote: (proposalId: number, approve: boolean) => Promise<RelayResult>;
  /** Founders only: the relayer files `add_bounty` on the board as a DAO proposal; founders vote. */
  propose: (input: ProposeInput) => Promise<ProposeResult>;
}

const INITIAL: BountiesState = {
  enabled: false, seat: null, boardId: null, config: null, bounties: [], myClaims: [], recent: [], dao: null, learner: null,
  loading: true, busy: false, error: null, lastTx: null,
};
let state: BountiesState = INITIAL;
let initialised = false;
let signer: LearnerSigner | null = null;
const listeners = new Set<() => void>();
const SIGNER_KIND = (import.meta.env.VITE_SIGNER_KIND ?? "local-key") as LearnerSigner["kind"];

function set(patch: Partial<BountiesState>): void {
  state = { ...state, ...patch };
  snapshot = build();
  listeners.forEach((l) => l());
}

function getSigner(): LearnerSigner {
  if (!signer) signer = createSigner(SIGNER_KIND);
  return signer;
}

/** The contract's `unmet` rule, mirrored so the button can say why before any transaction. */
export function unmet(bounty: Bounty, learner: LearnerView | null): string | null {
  if (!learner || !learner.registered) return "Not a registered learner";
  const r = bounty.requirement;
  if (r === "Graduated") return learner.graduated ? null : "Not graduated yet";
  if ("PassportLevel" in r) return learner.level >= r.PassportLevel.min ? null : `Passport level ${r.PassportLevel.min} needed`;
  if ("QuestCompleted" in r) return learner.completed.includes(r.QuestCompleted.lesson_id) ? null : "Quest not completed";
  return null;
}

export function statusLabel(s: ClaimStatus): string {
  if (s === "Pending") return "Checking…";
  if (s === "Paid") return "Paid";
  if (s === "Eligible") return "Eligible — propose in the DAO";
  return `Proposed to the DAO (#${s.Proposed.proposal_id})`;
}

async function loadDao(daoId: string): Promise<DaoView> {
  const [balance, policy, last] = await Promise.all([views.accountBalance(daoId), views.daoPolicy(daoId), views.daoLastProposalId(daoId)]);
  const from = Math.max(0, last - 50);
  const proposals = last > 0 ? await views.daoProposals(daoId, from, 50) : [];
  const council = policy.roles.filter((r) => typeof r.kind === "object" && "Group" in r.kind).flatMap((r) => (r.kind as { Group: string[] }).Group);
  return { id: daoId, balance, council, threshold: policy.default_vote_policy.threshold, proposals: proposals.sort((a, b) => b.id - a.id) };
}

async function refresh(): Promise<void> {
  try {
    const boardId = await views.bountiesContract();
    if (!boardId) {
      set({ enabled: false, boardId: null, loading: false });
      return;
    }
    const accountId = getSigner().accountId();
    const [config, bounties, recent, myClaims, learner] = await Promise.all([
      views.bountiesConfig(boardId),
      views.bounties(boardId),
      views.recentClaims(boardId),
      accountId ? views.claimsFor(boardId, accountId) : Promise.resolve([]),
      accountId ? views.learner(accountId) : Promise.resolve(null),
    ]);
    let dao: DaoView | null = state.dao;
    try {
      dao = await loadDao(config.dao_id);
    } catch {
      /* the DAO read is informational; the board still works without it */
    }
    let seat: Seat | null = state.seat;
    if (accountId) {
      try {
        const r: SeatResult = await relayerApi.seat(accountId, getSigner().daoPublicKey());
        seat = { graduate: r.graduate, founder: r.founder, canVote: r.canVote };
      } catch {
        /* the relayer read is informational: no seat shown rather than a broken card */
      }
    }
    // Closed bounties stay on chain (the board closes each day's "Today's quest, done" when it posts the next, and
    // the ones testing used up were closed and re-posted on Nov 10); the Missions page shows the open ones.
    set({ enabled: true, boardId, config, bounties: bounties.filter((b) => b.open), recent, myClaims, learner, dao, seat, loading: false, error: null });
  } catch (e) {
    set({ loading: false, error: humanError(e) });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const actions = {
  refresh,
  claim: async (bountyId: number): Promise<RelayResult> => {
    set({ busy: true, error: null });
    try {
      const result = await game.claimBounty(getSigner(), bountyId);
      set({ lastTx: { ...result, url: explorer.tx(result.txHash) } });
      // Read-your-writes: the claim settles in the board's callbacks a block or two later.
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await refresh();
        const c = state.myClaims.find((x) => x.bounty_id === bountyId);
        if (c && c.status !== "Pending") return result;
        if (!c && attempt > 2) break; // removed = rejected by the board (reason in the explorer log)
        await sleep(700);
      }
      const c = state.myClaims.find((x) => x.bounty_id === bountyId);
      if (!c) {
        const b = state.bounties.find((x) => x.id === bountyId);
        throw new Error(b ? (unmet(b, state.learner) ?? "The board did not accept the claim; see the transaction") : "The board did not accept the claim");
      }
      return result;
    } catch (e) {
      set({ error: humanError(e) });
      throw e;
    } finally {
      set({ busy: false });
    }
  },
  eligibility: (bounty: Bounty): string | null => {
    if (!bounty.open) return "Closed";
    if (bounty.claims >= bounty.max_claims) return "Fully claimed";
    if (state.myClaims.some((c) => c.bounty_id === bounty.id)) return "Already claimed";
    return unmet(bounty, state.learner);
  },
  claimFor: (bountyId: number): Claim | null => state.myClaims.find((c) => c.bounty_id === bountyId) ?? null,
  clearError: (): void => set({ error: null }),
  canVoteOn: (p: DaoProposal): string | null => canVoteOn(state, p, getSigner().accountId()),
  vote: async (proposalId: number, approve: boolean): Promise<RelayResult> => {
    set({ busy: true, error: null });
    try {
      const result = await game.voteDao(getSigner(), proposalId, approve);
      set({ lastTx: { ...result, url: explorer.tx(result.txHash) } });
      await sleep(600);
      await refresh();
      return result;
    } catch (e) {
      set({ error: humanError(e) });
      throw e;
    } finally {
      set({ busy: false });
    }
  },
  propose: async (input: ProposeInput): Promise<ProposeResult> => {
    set({ busy: true, error: null });
    try {
      const accountId = getSigner().accountId();
      if (!accountId) throw new Error("Sign in first");
      const signed = getSigner().signWithDaoKey(`bloqvia:propose:${accountId}:${Date.now()}`);
      if (!signed) throw new Error("This account was made before proposals existed; a new account can propose");
      const result = await relayerApi.propose(accountId, input, signed);
      await sleep(600);
      await refresh();
      return result;
    } catch (e) {
      set({ error: humanError(e) });
      throw e;
    } finally {
      set({ busy: false });
    }
  },
};

/** The kind label Sputnik uses for a proposal ("transfer", "call", …), from its kind object. */
export function proposalKind(p: DaoProposal): string {
  if (typeof p.kind === "string") return p.kind.toLowerCase();
  const k = Object.keys(p.kind)[0] ?? "";
  return k === "FunctionCall" ? "call" : k.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

/** The seat rule, mirrored from the DAO's policy (relayer/src/seats.ts): graduates vote on transfers, founders on calls too. */
export function canVoteOn(s: Pick<BountiesState, "seat">, p: DaoProposal, accountId: string | null): string | null {
  if (!accountId) return "Sign in first";
  if (!s.seat) return "No seat yet";
  if (p.status !== "InProgress") return "Closed";
  if (p.votes[accountId]) return "You voted";
  const kind = proposalKind(p);
  const may = kind === "transfer" ? s.seat.graduate || s.seat.founder : kind === "call" ? s.seat.founder : false;
  if (!may) return s.seat.graduate || s.seat.founder ? (kind === "call" ? "Founders decide this one" : "Not for seat holders") : "Graduate to get a vote";
  if (!s.seat.canVote) return "This account was made before votes existed; a new account can vote";
  return null;
}

function build(): BountiesStore {
  return { ...state, ...actions };
}
let snapshot: BountiesStore = build();
const SERVER_SNAPSHOT: BountiesStore = snapshot;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useBounties(): BountiesStore {
  const value = useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
  useEffect(() => {
    if (initialised) return;
    initialised = true;
    void refresh();
  }, []);
  return value;
}
