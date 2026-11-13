# CLAUDE.md — Bloqvia (NEAR Hackathon, Nov 1–14 2026)

You are the hands on this machine. The design, the spec and the roadmap were
decided elsewhere and live in `docs/` and in the two Claude docs the team
keeps ("Bloqvia — Roadmap & Flows", "Bloqvia — Technical Spec"). Do not
redesign; implement, run, verify, report.

## What this is

A mobile-first web app that teaches Web3 by playing it on NEAR testnet.
Tracks: games (primary), nfts, memecoins, social, open. Read `README.md` first, then
`docs/INTEGRATION.md`, `docs/FLOWS.md`, `contracts/README.md`.

## First run on a fresh clone (once)

1. `npx skills add near/agent-skills` — the official NEAR agent skills; read
   `near-smart-contracts`, `near-api-js`, `near-cli-rs` before touching those areas.
2. `cd contracts/bloqvia-core && cargo test` → expect 55 passed.
   `cd ../bloqvia-passport && cargo test` → expect 11 passed.
   `cd ../bloqvia-streak && cargo test` → expect 9 passed (Module A, merged).
   `cd ../bloqvia-bounties && cargo test` → expect 14 passed (Module B, merged Nov 5 after its on-chain proof).
3. `cd relayer && npm i && npm test` → expect 55 passed.
   `cd ../scripts && npm i && npm test` → expect 2 passed.
If any of these fail on a clean clone, stop and report the full output; do not
"fix" by changing tests.

## Ownership — never cross these lines

- Maria owns the Lovable app: `src/components/`, `src/pages/`, `src/styles/`,
  `index.html`, `vite.config.ts`, `tailwind.config.*`, the root `package.json`
  except the three lines `docs/INTEGRATION.md` names. Do not edit her files.
  When a screen needs chain data, add a hook or helper in `src/near/` and tell
  Adi which prop the screen should call.
- Adi (with you) owns `contracts/`, `relayer/`, `scripts/`, `src/near/`,
  `src/bloq/` (the animated Bloq character; screens import `@/bloq`),
  `src/content/`, `docs/`, `README.md`, `LICENSE`.
- Modules A (`contracts/bloqvia-streak/`) and B (`contracts/bloqvia-bounties/`)
  were built on branches `module-a` / `module-b` and merged to `main` through
  their gates (Nov 4 and Nov 5). New work goes on `main` or a short-lived branch.
  Never mention unmerged work in `README.md`.

## Rules that protect the submission

- Testnet only. Never deploy to mainnet, never spend real NEAR.
- Never commit secrets. Keys live in `relayer/.env` and the near-cli keychain.
  `.env.example` is the only env file in git. Before every commit run
  `git diff --cached | grep -E "ed25519:[1-9A-HJ-NP-Za-km-z]{60,}"` — it must
  print nothing (placeholders like `ed25519:REPLACE_ME` are fine; a real key is
  80+ base58 characters).
- Before the repo goes public, scan the whole history, not just the index:
  `git log -p --all | grep -E "ed25519:[1-9A-HJ-NP-Za-km-z]{60,}" | grep -vc "ed25519:5KqX9vTn"`
  must print 0. (`5KqX9vTn…` is the mock's old fake key from `src/game/mockGame.ts`,
  verified Nov 4; the current fake contains a `0`, which no real key can.)
- Never make the repo public, push to `main` with failing tests, or run
  `deploy-testnet.sh` without Adi saying so in the conversation.
- Rewards and prices are decided by the contract. Do not add owner methods
  that mint, move balances or change prices; the judges read for exactly that.
- The AI (NEAR AI Cloud) only writes text: daily quests (hashed and seeded
  like any lesson) and Ask Bloq answers. No model output may ever reach a
  reward, a price or another player's balance. Keep it that way. The one
  deliberate exception (Nov 11): the NPC trader's agent chooses the trader's
  own move, only among the moves `allowedMoves` in `relayer/src/trader.ts`
  permits; it never sets a price and only the trader's own account moves.
  The second (Nov 13, x402): a trader buys the market desk's signal from its
  purse, a sub-account with a day's budget in wNEAR; the model decides whether
  a signal is worth buying, `relayer/src/purse.ts` decides whether the payment
  is allowed (one host, 0.01 wNEAR a call, 0.2 a day, one token) and the
  balance is the ceiling. The desk sells only what the chain already holds.
  The sponsored slot (Nov 14) sells a day's quest slot, never a reward: the
  quest passes the same validator as the daily quest and the contract pays
  the daily quest's reward; the house purse buys the slot when nobody did.
- The README is written for an AI judge: "do X, see Y" steps, no marketing.
  Every step in it must be true on a clean clone the day it is written.
- Pre-hackathon code is baseline; everything we write is new in this window.

## Commands you will use

| Task | Command | Expect |
| --- | --- | --- |
| Contract tests | `cargo test` in each crate | 55 / 11 / 9 / 14 passed |
| Build wasm | `cargo near build non-reproducible-wasm` in each crate | `target/near/*.wasm` |
| Deploy + seed (Adi's go-ahead) | `./contracts/deploy/deploy-testnet.sh` (reads `relayer/.env`) | `get_bloq`, `get_lessons` print |
| Redeploy core keeping state (Adi's go-ahead; Nov 11 the price call, Nov 12 the shipping rule) | `./contracts/deploy/redeploy-core.sh` | balances before = after; `get_call_round` prints |
| Deploy Module A (Adi's go-ahead) | `./contracts/deploy/deploy-streak.sh` (after the line above) | `get_streak_contract`, `get_streak` print |
| Create the DAO (Adi's go-ahead, once) | `COUNCIL=a.testnet,b.testnet ./contracts/deploy/create-dao.sh` | `get_policy` prints; `bloqvia-dao.sputnik-v2.testnet` exists |
| Deploy Module B (Adi's go-ahead) | `./contracts/deploy/deploy-bounties.sh` (after deploy-testnet.sh) | `get_bounties_contract`, `get_config`, `get_bounties` print |
| Relayer | `cd relayer && npm run dev` (loads `.env` via `--env-file`) | `GET /health` → `{ok:true}`; with `NEAR_AI_API_KEY` set, the daily quest agent seeds today's quest at start |
| Daily quest now (Adi's go-ahead) | `curl -s -X POST localhost:8787/admin/quest -H "x-admin-token: $ADMIN_TOKEN"` | `{ seeded: true, lessonId: "daily-…" }`; `GET /quests` lists it |
| Ask Bloq | `curl -s -X POST localhost:8787/ask -H "Content-Type: application/json" -d '{"question":"Who pays my gas?"}'` | `{ answer, generated_by }`; `[ask] …` log line; 503 without `NEAR_AI_API_KEY` |
| Lessons changed | `cd scripts && npm run hash-lessons` then `npm run seed-lessons` | public JSON rewritten; new lessons added |
| Tune economy | `cd scripts && npm run simulate:offline` | `docs/simulation-offline.md` |
| Live proof | `cd scripts && npm run simulate -- --players 4 --rounds 3` | prices move in `get_bloq` |
| Module B proof | `cd scripts && npm run bounty:claim -- --relayer http://localhost:8787 --bounty 1` | a fresh learner graduates and claims; `claim: Paid`, balance up by the reward |
| Reopen used-up bounties (Adi's go-ahead) | `cd scripts && set -a && source ../relayer/.env && set +a && npm run bounty:reopen -- --apply` (without `--apply`: dry run) | fully claimed bounties closed and re-added with room; the open list printed |
| Make an NPC trader's account (three times, Adi's go-ahead; rename the lines TRADER2_*/TRADER3_* for the bull and the bear) | `cd scripts && npm run trader:create -- --relayer http://localhost:8787` | the account, its three quests done, two lines for `relayer/.env` and Railway |
| DAO seat roles (once, Adi's go-ahead) | `cd scripts && set -a && source ../relayer/.env && set +a && npm run dao:roles -- --apply` (without `--apply`: dry run; `--seat <account> <graduates\|founders>` seats one by hand) | the ChangePolicy proposal approved; `get_policy` lists graduates and founders |
| Fast-forward now | `curl -s -X POST localhost:8787/fastforward` then `curl -s localhost:8787/market` | `{ started: true }`; `/market` shows round, log and snapshots |
| Try to break it (twelve refusals) | `cd scripts && npm run attack -- --relayer https://relay.bloqvia.app` | ✓ on all twelve, exit 0; a ✗ is a bug |
| Make the three purses (once, Adi's go-ahead; x402, Nov 13) | `cd scripts && set -a && source ../relayer/.env && set +a && npm run x402:setup -- --apply` (without `--apply`: dry run) | three `purse-*.bloqvia.testnet` with wNEAR; six `PURSE*` lines for `relayer/.env` and Railway, plus `DESK_PUBLIC_URL` |
| The house purse (once, Adi's go-ahead; sponsored slot, Nov 14) | `cd scripts && set -a && source ../relayer/.env && set +a && npm run x402:setup -- --apply --house` | `purse-house.bloqvia.testnet` with 2.5 wNEAR; two `PURSE_HOUSE_*` lines for `relayer/.env` and Railway |
| Buy the sponsored slot (x402) | `cd scripts && set -a && source ../relayer/.env && set +a && npm run sponsor:buy -- --relayer https://relay.bloqvia.app --name "…" --url https://… --quest q.json` | `slot bought for 0.5 wNEAR tx=…`, the lesson `daily-<date>-sponsored` on chain; 403 when the day's slot is taken |
| Buy from the desk (x402) | `cd scripts && set -a && source ../relayer/.env && set +a && npm run desk:buy -- --relayer https://relay.bloqvia.app` | the 402, then `signal bought for 0.01 wNEAR tx=…`; `/market` lists the sale |
| Account balances (read-only) | `cd scripts && npm run balances` | table of balance / locked / free per account; exit 1 and a top-up hint if one is low |
| View on chain | `near contract call-function as-read-only core.bloqvia.testnet get_bloq json-args '{}' network-config testnet now` | JSON |

## How to report

After each task: the command you ran, the last 20 lines of its output, and
the nearblocks link for anything on chain. Errors verbatim, never summarised.
If a step is ambiguous, ask Adi; do not guess account names, keys or amounts.
