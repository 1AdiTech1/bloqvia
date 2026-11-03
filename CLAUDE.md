# CLAUDE.md — Bloqvia (NEAR Hackathon, Nov 1–14 2026)

You are the hands on this machine. The design, the spec and the roadmap were
decided elsewhere and live in `docs/` and in the two Claude docs the team
keeps ("Bloqvia — Roadmap & Flows", "Bloqvia — Technical Spec"). Do not
redesign; implement, run, verify, report.

## What this is

A mobile-first web app that teaches Web3 by playing it on NEAR testnet.
Tracks: games (primary), nfts, open. Read `README.md` first, then
`docs/INTEGRATION.md`, `docs/FLOWS.md`, `contracts/README.md`.

## First run on a fresh clone (once)

1. `npx skills add near/agent-skills` — the official NEAR agent skills; read
   `near-smart-contracts`, `near-api-js`, `near-cli-rs` before touching those areas.
2. `cd contracts/bloqvia-core && cargo test` → expect 19 passed.
   `cd ../bloqvia-passport && cargo test` → expect 6 passed.
3. `cd relayer && npm i && npm test` → expect 3 passed.
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
  `src/content/`, `docs/`, `README.md`, `LICENSE`.
- Modules A (`contracts/bloqvia-streak/`) and B (`contracts/bloqvia-bounties/`)
  live on branches `module-a` / `module-b` and merge to `main` only through
  their gate (see the roadmap). Never mention an unmerged module in `README.md`.

## Rules that protect the submission

- Testnet only. Never deploy to mainnet, never spend real NEAR.
- Never commit secrets. Keys live in `relayer/.env` and the near-cli keychain.
  `.env.example` is the only env file in git. Before every commit run
  `git diff --cached | grep -E "ed25519:[1-9A-HJ-NP-Za-km-z]{60,}"` — it must
  print nothing (placeholders like `ed25519:REPLACE_ME` are fine; a real key is
  80+ base58 characters).
- Never make the repo public, push to `main` with failing tests, or run
  `deploy-testnet.sh` without Adi saying so in the conversation.
- Rewards and prices are decided by the contract. Do not add owner methods
  that mint, move balances or change prices; the judges read for exactly that.
- The README is written for an AI judge: "do X, see Y" steps, no marketing.
  Every step in it must be true on a clean clone the day it is written.
- Pre-hackathon code is baseline; everything we write is new in this window.

## Commands you will use

| Task | Command | Expect |
| --- | --- | --- |
| Contract tests | `cargo test` in each crate | 19 / 6 passed |
| Build wasm | `cargo near build non-reproducible-wasm` in each crate | `target/near/*.wasm` |
| Deploy + seed (Adi's go-ahead) | `./contracts/deploy/deploy-testnet.sh` (reads `relayer/.env`) | `get_bloq`, `get_lessons` print |
| Relayer | `cd relayer && npm run dev` (loads `.env` via `--env-file`) | `GET /health` → `{ok:true}` |
| Lessons changed | `cd scripts && npm run hash-lessons` then `npm run seed-lessons` | public JSON rewritten; new lessons added |
| Tune economy | `cd scripts && npm run simulate:offline` | `docs/simulation-latest.md` |
| Live proof | `cd scripts && npm run simulate -- --players 4 --rounds 3` | prices move in `get_bloq` |
| View on chain | `near contract call-function as-read-only core.bloqvia.testnet get_bloq empty-args network-config testnet now` | JSON |

## How to report

After each task: the command you ran, the last 20 lines of its output, and
the nearblocks link for anything on chain. Errors verbatim, never summarised.
If a step is ambiguous, ask Adi; do not guess account names, keys or amounts.
