# Lovable prompt 30 — the Passport as a vote (Nov 10)

Graduate and you vote; finish Season 2 and you govern. A sealed Passport gives a seat in the cohort DAO's `graduates`
role (votes on who gets paid for medium bounties); the Season 2 stamp gives a seat in `founders` (also votes on what
the cohort pays for, and can propose a bounty). Seats are on the DAO's own policy; the vote is cast by the learner's
account with its own key and relayed; a proposal is filed on the DAO by the relayer in the founder's name and the
founders vote on it. Everything is in `useBounties()` from `@/near` already:

```ts
b.seat            // { graduate, founder, canVote } | null   (canVote: this session's account can sign a vote)
b.canVoteOn(p)    // null = may vote on proposal p now, else the reason ("You voted", "Graduate to get a vote", …)
await b.vote(p.id, true | false)   // relayed; throws with the chain's message
await b.propose({ title, description, tier, requirement, reward_near, max_claims })  // founders; returns { proposalId, url }
proposalKind(p)   // "transfer" | "call" | "add_member_to_role" | …   (from "@/near")
```

**Most important rule (as in prompts 21 to 29): don't remove or change anything this prompt doesn't name.** Only
`src/pages/CohortPage.tsx` changes. Don't touch `src/bloq/*`, `src/near/*`, `src/content/*` or `public/`. Strict
TypeScript as before. Phone and desktop.

## 1. "Your seat" card, between the DAO card (`Treasury`) and the bounties

A new `Seat` section in `CohortInner`, right after `<Treasury />`, same shape as the `Note` card (`rounded-[1.6rem]
bg-ivory p-5 text-navy shadow-lift`), with a `SectionLabel` "Your seat". Content by `b.seat` and the learner:

- `b.seat` null (no account yet or the relayer is unreachable): "Sign in to see your seat." (plain, no button)
- neither seat: **No seat yet.** "Graduate to get a vote: a sealed Passport is a seat in the cohort DAO."
- graduate only: a lime chip **Graduate seat** and "You vote on who gets paid for a medium bounty. Finish Season 2 to
  vote on what the cohort pays for, and to propose a bounty."
- founder: a lime chip **Founder seat** and "You vote on who gets paid and on what the cohort pays for. You can propose
  a bounty." plus the **Propose a bounty** button (section 3).
- in every seated case, when `!b.seat.canVote`, one more line in `text-navy/60`: "This account was created before votes
  existed, so it cannot sign one; a new account can." (no button changes).

Under the text, in `font-mono text-xs text-navy/60`: "Seats are roles on the DAO's policy ·" with a link "see the
policy" to `daoUrl(b.dao.id)` (the existing helper) when `b.dao` is set.

## 2. Votes on the proposals list (`Proposals`)

`Proposals` gets the store: `const b = useBounties();` at its top. For each proposal `p` in the list, after the
"N approve" line:

- `const why = b.canVoteOn(p);`
- `why === null`: two `Press` buttons side by side — **Approve** (`bg-lime text-navy`) and **Reject** (border
  `border-navy/20`, `text-ivory`), both `min-h-11 rounded-full px-4 text-sm font-semibold`, disabled while `b.busy`;
  on click `void b.vote(p.id, true)` / `false`. While that proposal's vote is in flight (keep a `votingId` state in
  `Proposals`), show `<LabLoader size={24} label="Voting on chain…" />` instead of the buttons.
- `why !== null` and the proposal is `InProgress`: the reason in `text-xs text-lavender` (e.g. "Graduate to get a
  vote", "Founders decide this one", "You voted").
- closed proposals: nothing new.
- A vote that throws: the store sets `b.error`; show it under the list the way `BountyCard` does (same coral box with
  the dismiss X calling `b.clearError()`), once, not per row.

Also label each proposal's kind next to its id: `proposalKind(p)` as a small chip (`bg-ivory/10 text-ivory`), with
these words: `transfer` → "Payment", `call` → "Board", `add_member_to_role` → "Seat", `policy` / `change_policy` → "Policy", anything
else → the raw label.

Replace the footer line "Council members vote with near-cli…" with: "Seat holders vote here with their own key; the
council keeps its vote; the board files medium claims by itself."

## 3. Propose a bounty (founders)

The **Propose a bounty** button on the seat card opens a bottom sheet (phones) / centred card (desktop) built like the
`AskBloqSheet` (same `motion.div` entry, same backdrop, close X top right, `role="dialog"`), title **Propose a bounty**,
with this form (controlled state, all required):

- Title (text, max 40)
- Description (textarea, max 300)
- Tier: three radio pills Small / Medium / Large, with the cap under each: "up to 0.5 NEAR · the board pays",
  "up to 2 NEAR · one founder vote", "up to 10 NEAR · DAO proposal"
- Reward in NEAR (number input, step 0.01, min 0.01)
- Requirement: a select — "Graduated" / "Passport level 3" / "Passport level 2" / "Today's quest completed" (the last
  one sends `{ QuestCompleted: { lesson_id: "daily-YYYY-MM-DD" } }` for today's UTC date; the levels send
  `{ PassportLevel: { min } }`; the first sends `"Graduated"`)
- Max claims (number, 1–100, default 10)
- **File the proposal** (`Press`, lime, disabled while `b.busy` or while a field is empty). On success: close the sheet
  and show, where the button was, "Proposal #N filed · founders vote on it" with a link to `url`. On error: the
  store's `b.error` in the coral box inside the sheet.

Under the form, `text-xs text-navy/60`: "The relayer files it on the DAO in your name and pays the bond; founders vote
with their own keys. If it passes, the DAO adds it to the board and the reward comes from the board's allowance."

## Confirm when done

- Fresh account, not graduated: the seat card says "No seat yet"; proposals show "Graduate to get a vote".
- Graduated account (made today): "Graduate seat"; an in-progress Payment proposal shows Approve / Reject; pressing
  Approve shows "Voting on chain…" then "You voted" and the approve count goes up.
- Stamped account: "Founder seat", the Propose button, the sheet, a filed proposal appears in the list as "Board ·
  InProgress" with Approve / Reject.
- An account created before today, graduated: "Graduate seat" plus the "created before votes existed" line; no buttons.
- Phone and desktop, Motion off: nothing moves, everything shows.
- List every file you changed (it should be only `src/pages/CohortPage.tsx`).
