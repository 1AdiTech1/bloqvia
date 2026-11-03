# Bloqvia

Learn Web3 by playing it. A newcomer signs in with an email, plays three short quests, trades with a merchant whose prices move with what players do, and graduates — and only then learns that every step was a real transaction on NEAR, in an account that is theirs.

Built at **NEAR HACKATHON** (Nov 1–14, 2026). Tracks: `games` (primary), `nfts`, `open`.

## The problem

Onboarding to Web3 starts with a seed phrase, a wallet popup and a gas error. Most people stop there. Bloqvia removes all three from the first session: the chain is invisible until the player has already used it.

## What it is

- **A game loop with a real economy.** Quests mint items (NEP-245 multi-tokens) and gold. Bloq the merchant has a wallet, an inventory and one readable price rule: the more of an item he holds, the less he pays for it. Players selling an item lower its price for everyone. Graduation costs the three items plus Bloq's *current* price, so the cost of finishing follows the market.
- **A credential that does something.** Every learner gets a Passport (NEP-171) at sign-in. Its level is updated on-chain per quest and it is non-transferable: a transfer hook panics, so it cannot be bought.
- **Zero plumbing for the player.** Sign-in creates a NEAR account with a function-call key scoped to one contract; a relayer pays every fee (NEP-366 meta-transactions). The player never sees a seed phrase, a popup or a gas prompt.

## How NEAR fits in

| What the player feels | What NEAR does |
|---|---|
| "Start Learning" works with just an email | Sub-account `learner-xxxx.bloqvia.testnet` created by the relayer; the browser's key is added as a function-call key limited to `core.bloqvia.testnet` and four methods |
| Nothing ever asks for gas | The learner signs a NEP-366 `DelegateAction`; the relayer wraps and pays |
| Items, gold, prices | One NEP-245 contract (`bloqvia-core`); prices from `contracts/bloqvia-core/src/pricing.rs` |
| "Your Passport levelled up" | `bloqvia-core` calls `bloqvia-passport.set_level` cross-contract; metadata is updated on-chain |
| The reveal | Explorer links to the account, the transactions and the Passport; the key is handed over |

## Try it — "do X, see Y"

Testnet. No funds needed. Each step says what you should see.

### A. The hosted demo (fastest)

1. Open https://bloqvia.com on a phone or a narrow browser window.
2. Tap **Start Learning**, enter an email. **See:** the map with three quests; no wallet UI at any point.
3. Open **The Vault**, answer *Your public key*, tap **Claim**. **See:** "+100 gold, 3 Key Fragments", an Explorer link. Open it: a `complete_lesson` call on `core.bloqvia.testnet`, signed by your `learner-….bloqvia.testnet`, gas paid by `bloqvia.testnet`.
4. Finish the other two quests. **See:** the Passport card reads Level 3; Bloq's shop unlocks.
5. In the shop, sell two Key Fragments. **See:** Bloq's buy price for Key Fragments drops after the sale (the rule is in the tooltip).
6. Tap **Graduate**. **See:** the Passport reads Graduate; the reveal screen lists every transaction and shows your key.

### B. From a clean clone (what the AI judges run)

Prereqs: Node 22+, Rust 1.95+ with `wasm32-unknown-unknown`, `cargo-near` 0.22+, `near-cli-rs` 0.30+.

1. `git clone <this repo> && cd bloqvia`
2. Contracts: `cd contracts/bloqvia-core && cargo test && cd ../bloqvia-passport && cargo test`
   **See:** 19 and 6 tests pass. Read `src/pricing.rs` (the price rule) and the test names in `src/lib.rs` (once-per-account, wrong answer, shop closes below the floor, Passport non-transferable).
3. Offline economy fast-forward: `cd scripts && npm i && npm run simulate:offline`
   **See:** a table of 12 rounds with 100 scripted players (no LLM). Bloq's buy price for Key Fragments falls from 88 to ~17 as sellers dump them; 100/100 graduate; the treasury stays above the floor. Output also lands in `docs/simulation-latest.md`.
4. Relayer: `cd relayer && npm i && npm test` **See:** 3 tests pass (byte-exact NEP-366 payload round trip; allow-list rejects a foreign receiver, a foreign method and an unregistered sender).
5. Deploy your own copy (optional, ~5 min): create `yourname.testnet` with the faucet, `export OWNER_PRIVATE_KEY=…`, `PARENT=yourname.testnet ./contracts/deploy/deploy-testnet.sh`. **See:** `get_bloq` returns the seeded merchant and `get_lessons` the three lessons.
6. Run the relayer against it: `cp relayer/.env.example relayer/.env`, fill it, `npm --prefix relayer run dev`. **See:** `GET http://localhost:8787/health` → `{ ok: true, core: …, passport: … }`.
7. Live simulation through the relayer: `cd scripts && npm run simulate -- --players 8 --rounds 4`. **See:** real accounts created, real transactions relayed, prices moving in `get_bloq` between rounds.
8. Web app: `npm i && npm run dev`, open http://localhost:5173 and follow A.

## Repository layout

```
contracts/bloqvia-core/      NEP-245 economy: gold, items, lessons, Bloq's shop, graduation   (Rust, cargo-near)
contracts/bloqvia-passport/  NEP-171 non-transferable credential with on-chain level           (Rust, cargo-near)
contracts/deploy/            init-args.testnet.json, deploy-testnet.sh
relayer/                     node:http relayer: /register, /relay, allow-list, NEP-366            (TypeScript)
src/near/                    the client chain layer and the single React hook `useBloqvia`      (TypeScript)
src/content/lessons.json     the three lessons; answers hashed into the contract
scripts/                     hash-lessons, seed-lessons, simulate (offline replica + live)
docs/                        FLOWS.md (Mermaid), SPIKE-AUTH.md, INTEGRATION.md, simulation-latest.md
```

## What is baseline and what was built in the window

- Baseline (not judged): the Vite + React + Tailwind scaffold generated by Lovable for the screens; `cargo near new` templates; the libraries listed below.
- Built Oct 19 – Nov 14, 2026: everything in `contracts/`, `relayer/`, `src/near/`, `scripts/`, `docs/`, the lesson content, and the screens' wiring.
- Libraries: near-sdk 5.30, near-sdk-contract-tools 4.0 (NEP-245 / NEP-171 derives), near-api-js 7.4, React 18, Vite. No AI-generated code is hidden: this README, the contracts and the scripts were written with Claude Code as a pair, as the hackathon encourages.

## Known limits (stated plainly)

- Testnet only. Mainnet needs NEAR Auth approved credentials and a funded relayer; both are post-hackathon.
- Quiz answers are public (they are three-option quizzes) and travel in transaction arguments. The on-chain record is the completion, not the secret. Once-per-account is enforced by the contract.
- Sybil: one email = one account = one set of rewards. The relayer rate-limits per sender; it does not stop someone creating many emails. The streak token (if present under `contracts/bloqvia-streak/`) states its own limits.
- The simulation's "players" are scripted strategies, not LLM agents, so the economy's behaviour is reproducible.

## Licence

MIT — see `LICENSE`.
