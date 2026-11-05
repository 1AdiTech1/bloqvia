# Lovable prompt 9 — the cohort board

Sent 2026-11-05 via MCP after Module B merged to `main` (`627554d`): `src/near/useBounties.ts`, `views.*` for the board and the DAO, `scripts/bounty-claim.ts`.

---

Module B landed in `src/near/` and needs its page: **the cohort board**. Read `src/near/useBounties.ts` first (the header comment is the contract between us) and `docs/MODULE-B.md` for the idea. Do not edit anything under `src/near/`.

**What it is.** Graduates are a cohort. A Sputnik DAO on testnet (`bloqvia-dao.sputnik-v2.testnet`) owns a bounty board. A bounty is a small task with a reward in NEAR and a requirement the chain checks (Passport level, a quest completed, graduated). Rewards by tier: **Small** — the board pays at once from an allowance the DAO funded; **Medium** — the board files a DAO proposal, one council vote pays; **Large** — the board only certifies you qualified, the DAO's normal proposal pays. `useBounties()` returns `{ enabled, config, bounties, myClaims, recent, dao, learner, loading, busy, error, lastTx, refresh, claim(id), eligibility(bounty), claimFor(id), clearError }`; `bountyUnmet` and `claimStatusLabel` are exported from `@/near` too. Amounts are yoctoNEAR strings: show NEAR with `Number(BigInt(x) / 10n ** 20n) / 10_000` and 2 decimals (4 when below 0.01).

Build:

**1. Route + nav.** A new page `/cohort` (`src/pages/CohortPage.tsx`, same wrapping as MapPage: `RequireAccount` + `PhoneShell nav`) and a fourth tab in `PhoneShell`'s bottom nav: `{ to: "/cohort", label: "Cohort", icon: Users }` between Shop and Passport. Keep the labels at 11px; four tabs fit in 440px.

**2. The page, top to bottom.**
- When `IS_MOCK` (from `src/game/useGame.ts`): only a short ivory card "The cohort board plays on chain. Switch off mock mode to see it." Nothing else.
- While `loading`: the `LabLoader`. When `!enabled` after loading: a short card "The board is not deployed on this network yet." (Never crash.)
- **Treasury card** (navy card like DailyQuestCard): label "Cohort DAO", the DAO id as a link to `https://testnet.nearblocks.io/address/{dao.id}` (new tab), the balance in NEAR large, then one line "Council: {dao.council.join(", ")} · {threshold} vote(s) approve" where threshold text is `dao.threshold[0]` of `dao.threshold[1]` when it is a pair, and one line "Board allowance {config.allowance} NEAR · paid so far {config.paid_total} NEAR". Under it in small lavender text: "The DAO funds the board and approves bigger rewards. The board checks who qualified against the game contract; nobody moves money by hand."
- **Bounties** (`bounties`, already newest first): one ivory card per bounty. Top row: a tier chip — "Small · paid by the board" (lime), "Medium · one council vote" (lavender), "Large · DAO proposal" (coral/soft) — and the reward "{reward} NEAR" bold on the right. Then title (display font), description (15px), and the requirement in words: `"Graduated"` → "Requires: graduated"; `{ PassportLevel: { min } }` → "Requires: Passport level {min}"; `{ QuestCompleted: { lesson_id } }` → "Requires: quest {lesson_id} completed" (for `daily-…` ids say "today's quest ({date})"). A small line "{claims} of {max_claims} claimed" and "Closed" when `!open`.
  - The action row depends on `eligibility(bounty)` and `claimFor(bounty.id)`:
    - a claim exists → a status pill from `claimStatusLabel(claim.status)`: Paid (lime check), Proposed to the DAO (#id) (lavender, with a link "See the proposal" to `https://testnet.nearblocks.io/address/{dao.id}`), Eligible (coral-soft) with the text "File a proposal in the DAO to be paid" and a "Copy proposal text" button that reads `await views.proposalText(boardId, bounty.id, learner.account_id)` (`views` from `@/near`; `boardId` from the store) and copies it to the clipboard, showing "Copied" for two seconds.
    - no claim and `eligibility(bounty) === null` → a lime `Press` "Claim" that calls `await claim(bounty.id)`; while `busy` for that card show `LabLoader` "Checking on chain…"; on success show the new status pill plus a "See it on the explorer" link (`lastTx.url`); on error show the message in the coral left-border box (same as QuizSheet) with a dismiss that calls `clearError()`.
    - no claim and `eligibility(bounty)` is a string → a disabled ghost button with that string ("Not graduated yet", "Passport level 3 needed", "Quest not completed", "Already claimed", "Fully claimed", "Closed").
- **Recent on the board** (`recent`, newest first, max 10): one line each: the account id shortened (`learner-50ef…` → first 14 chars + "…"), the bounty title (look it up in `bounties` by `bounty_id`), the status label. Empty state "No claims yet — be the first."
- **DAO proposals** (`dao.proposals`, newest first, max 10): one line each: `#{id}`, description truncated to 90 chars, a status chip (InProgress lavender, Approved lime, Rejected/Expired/Failed coral), and the approve count from `vote_counts` (sum of the first number across roles) e.g. "1 approve". Under the list in small text: "Council members vote with near-cli (`act_proposal`); the board files medium claims here by itself." Empty state "No proposals yet."

**3. Keep the rules.** No new dependencies; `navigator.clipboard` only inside the click handler with try/catch. SSR-safe. `useReducedMotion`, `Press`, `cn`, existing tokens. Do not touch `src/near/*`, the mock, StreakCard, DailyQuestCard, AskBloqSheet, the shop or the quiz. Do not add the cohort page to the landing page.

When done, list the files you changed and confirm: (a) the four-tab nav fits at 360px wide, (b) `Claim` is only enabled when `eligibility` returns null, (c) nothing on the page can throw when the DAO read fails (`dao` is null then: hide the treasury card's DAO lines and the proposals list, keep the bounties).
