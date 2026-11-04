# Bloqvia

Learn Web3 by playing it. A newcomer taps Start, plays three short quests, trades with a merchant whose prices move with what players do, and graduates — and only then learns that every step was a real transaction on NEAR, in an account that is theirs.

Built at **NEAR HACKATHON** (Nov 1–14, 2026). Tracks: `games` (primary), `nfts`, `open`.

**Live on testnet:** app https://bloqvia.app (alternate: https://bloqvia.lovable.app) · relayer https://relay.bloqvia.app (alternate: https://bloqvia-production.up.railway.app) · contracts [`core.bloqvia.testnet`](https://testnet.nearblocks.io/address/core.bloqvia.testnet), [`passport.bloqvia.testnet`](https://testnet.nearblocks.io/address/passport.bloqvia.testnet), merchant [`bloq.bloqvia.testnet`](https://testnet.nearblocks.io/address/bloq.bloqvia.testnet).

## The problem

Onboarding to Web3 starts with a seed phrase, a wallet popup and a gas error. Most people stop there. Bloqvia removes all three from the first session: the chain is invisible until the player has already used it.

## What it is

- **A game loop with a real economy.** Quests mint items (NEP-245 multi-tokens) and gold. Bloq the merchant has a wallet, an inventory and one readable price rule: the more of an item he holds, the less he pays for it. Players selling an item lower its price for everyone. Graduation costs the three items plus Bloq's *current* price, so the cost of finishing follows the market.
- **A credential that does something.** Every learner gets a Passport (NEP-171) at sign-in. Its level is updated on-chain per quest and it is non-transferable: a transfer hook panics, so it cannot be bought.
- **Zero plumbing for the player.** Start creates a NEAR account with a function-call key scoped to one contract; a relayer pays every fee (NEP-366 meta-transactions). The player never sees a seed phrase, a popup or a gas prompt. The key is generated in the browser and handed to the player at the end, with the explorer links that prove what happened.
- **Honest failure.** A wrong answer is rejected by the contract, not by the app: the relayer reads every receipt of the meta-transaction and shows the contract's own panic message ("Wrong answer") — a meta-transaction's top-level status would otherwise report success.

## How NEAR fits in

| What the player feels | What NEAR does |
|---|---|
| "Start" needs no wallet, no seed phrase | Sub-account `learner-xxxx.bloqvia.testnet` created and funded by the relayer; the browser's key is added as a function-call key limited to `core.bloqvia.testnet` and four methods |
| Nothing ever asks for gas | The learner signs a NEP-366 `DelegateAction`; the relayer wraps and pays |
| Items, gold, prices | One NEP-245 contract (`bloqvia-core`); prices from `contracts/bloqvia-core/src/pricing.rs` |
| "Your Passport levelled up" | `bloqvia-core` calls `bloqvia-passport.set_level` cross-contract; metadata is updated on-chain |
| The reveal | Explorer links to the account, the transactions and the Passport; the key is handed over |

## Try it — "do X, see Y"

Testnet. No funds needed. Each step says what you should see.

### A. The hosted demo (fastest)

1. Open https://bloqvia.app (or https://bloqvia.lovable.app) on a phone or a desktop browser.
2. Tap **Start exploring**, then **Continue**. **See:** the map with three quests, no wallet UI at any point. About five seconds: the relayer is creating your `learner-….bloqvia.testnet` account and minting your Passport.
3. Open **The Vault**, tap *Your public key*. **See:** "Quest complete", +100 BloqGold and 3 Key Fragments landing in the bar, "Saved on NEAR ✓", and **See it on the explorer**. Open it: a `complete_lesson` call on `core.bloqvia.testnet` signed by your learner account, gas paid by `bloqvia.testnet`. (Pick a wrong option first if you like: the contract rejects it and the app says so.)
4. Finish the other two quests. **See:** the Passport card reads Level 3 and Bloq's door at the foot of the map opens.
5. In the shop, sell two Key Fragments. **See:** Bloq's price for Key Fragments falls after the sale (the rule is in the ⓘ tooltip); your gold counts up.
6. Tap **Graduate**. **See:** the Passport is sealed; the reveal screen shows your account, your Passport and your key, with explorer links.

### B. From a clean clone (what the AI judges run)

Prereqs: Node 22+, Rust via `rustup` (the repo pins 1.96 and the wasm target in `rust-toolchain.toml`), `cargo-near` 0.22+, `near-cli-rs` 0.30+, `bun` for the web app.

1. `git clone <this repo> && cd bloqvia`
2. Contracts: `cd contracts/bloqvia-core && cargo test && cd ../bloqvia-passport && cargo test`
   **See:** 19 and 6 tests pass. Read `src/pricing.rs` (the price rule) and the test names in `src/lib.rs` (once-per-account, wrong answer, shop closes below the floor, Passport non-transferable).
3. Offline economy fast-forward: `cd scripts && npm i && npm run simulate:offline`
   **See:** a table of 12 rounds with 100 scripted players (no LLM). Bloq's buy price for Key Fragments falls from 88 to ~17 as sellers dump them; 100/100 graduate; the treasury stays above the floor. Output also lands in `docs/simulation-latest.md`.
4. Relayer: `cd relayer && npm i && npm test` **See:** 8 tests pass (byte-exact NEP-366 payload round trip; a contract panic inside a delegated receipt is surfaced as the error; CORS wildcard rules).
5. Deploy your own copy (optional, ~5 min): create `yourname.testnet` with the faucet, put its id and key in `relayer/.env` (copy `relayer/.env.example`), run `./contracts/deploy/deploy-testnet.sh`. **See:** `get_bloq` returns the seeded merchant and `get_lessons` the three lessons.
6. Run the relayer against it: `cp relayer/.env.example relayer/.env`, fill it, `npm --prefix relayer run dev`. **See:** `GET http://localhost:8787/health` → `{ ok: true, core: …, passport: … }`.
7. Live simulation through the relayer: `cd scripts && npm run simulate -- --players 8 --rounds 4`. **See:** real accounts created, real transactions relayed, prices moving in `get_bloq` between rounds.
8. Web app: `bun install && bun run dev`, open http://localhost:8080 and follow A. It plays on testnet through the hosted relayer by default; `VITE_RELAYER_URL=http://localhost:8787` in `.env.local` points it at your own, `VITE_GAME_MODE=mock` runs the in-memory mock.

## Repository layout

```
contracts/bloqvia-core/      NEP-245 economy: gold, items, lessons, Bloq's shop, graduation   (Rust, cargo-near)
contracts/bloqvia-passport/  NEP-171 non-transferable credential with on-chain level           (Rust, cargo-near)
contracts/deploy/            init-args.testnet.json, deploy-testnet.sh
relayer/                     node:http relayer: /register, /relay, allow-list, receipt check, NEP-366 (TypeScript, hosted on Railway)
src/near/                    the client chain layer and the single React hook `useBloqvia`      (TypeScript)
src/game/useGame.ts          the one-line switch between the chain store and the design mock
src/content/lessons.json     the three lessons; answers hashed into the contract
scripts/                     hash-lessons, seed-lessons, simulate (offline replica + live)
docs/                        FLOWS.md (Mermaid), SPIKE-AUTH.md, INTEGRATION.md, simulation-latest.md
```

## What is baseline and what was built in the window

- Baseline (not judged): the TanStack Start + React + Tailwind scaffold Lovable generates for every project; `cargo near new` templates; the libraries listed below.
- Built Nov 1–14, 2026: everything in `contracts/`, `relayer/`, `src/near/`, `src/game/`, `scripts/`, `docs/`, the lesson content, the screens and their wiring.
- Libraries: near-sdk 5.30, near-sdk-contract-tools 4.0 (NEP-245 / NEP-171 derives), near-api-js 7.4, React 19, TanStack Start, Framer Motion. No AI-generated code is hidden: the contracts, the relayer and the scripts were written with Claude as a pair and the screens with Lovable, as the hackathon encourages; every line was read, tested and run by us.

## Known limits (stated plainly)

- Testnet only. Mainnet needs a funded relayer and a sign-in with recovery; both are post-hackathon.
- Sign-in is an app-held key (`docs/SPIKE-AUTH.md`): the key lives in the browser that created it. Clear the site's data or change device without exporting it on the reveal screen and the account is orphaned. NEAR Auth (email login with recovery) is the planned replacement; it swaps one class behind the `LearnerSigner` interface.
- Quiz answers travel in transaction arguments and the contract stores only their hash; the lesson text (including the answers, as any quiz) ships in the app bundle. The on-chain record is the completion, once per account, enforced by the contract.
- Sybil: one tap = one account = one set of rewards. The relayer rate-limits per sender and funds each account with 0.01 NEAR; it does not stop someone tapping Start many times. The streak token (if present under `contracts/bloqvia-streak/`) states its own limits.
- The simulation's "players" are scripted strategies, not LLM agents, so the economy's behaviour is reproducible.

## Licence

MIT — see `LICENSE`.
