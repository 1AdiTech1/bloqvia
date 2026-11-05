# Contracts

Two Rust contracts built with `cargo near` (near-sdk 5.30, near-sdk-contract-tools 4.0).

| Crate | Standard | Account (testnet) | What it holds |
|---|---|---|---|
| `bloqvia-core` | NEP-245 multi-token + metadata, NEP-297 events | `core.bloqvia.testnet` | gold + 3 items, lesson registry, Bloq's shop, graduation |
| `bloqvia-passport` | NEP-171 + NEP-177, non-transferable | `passport.bloqvia.testnet` | one Passport per learner, level in on-chain metadata |

```sh
# unit tests (no wasm target needed)
cd contracts/bloqvia-core && cargo test
cd contracts/bloqvia-passport && cargo test

# build wasm
cargo near build non-reproducible-wasm

# deploy everything to testnet (creates sub-accounts, deploys, seeds lessons)
# the parent account id and its full-access key are read from relayer/.env
# (RELAYER_ACCOUNT_ID / RELAYER_PRIVATE_KEY); PARENT=... overrides the id
./contracts/deploy/deploy-testnet.sh
```

Init parameters live in `deploy/init-args.testnet.json`. The pricing block is fixed at init; tune it first with `cd scripts && npm run simulate:offline`.

## Reading guide for judges

- `bloqvia-core/src/pricing.rs` — the whole price rule, with tests.
- `bloqvia-core/src/lib.rs` — `complete_lesson` (hash check, once per account, fixed mint), `sell_to_bloq` / `buy_from_bloq`, `graduate`, and what the owner can and cannot do.
- `bloqvia-core/src/lib.rs`, daily quests — `is_bonus` (`daily-` ids pay gold + item but never touch the Passport level or graduation), `set_lesson_text` / `get_lesson_text` / `get_lessons_with_text` (the public quest text with the AI signature, ≤ 4096 bytes, stored under the lesson's own key). The answer hash goes in through the same `add_lesson` as every founding lesson and is immutable; the text can be rewritten by the owner, the answer cannot. Tests `bonus_quest_pays_but_does_not_level`, `bonus_quest_is_once_per_account_too`, `lesson_text_*`.
- `bloqvia-passport/src/lib.rs` — `Soulbound` transfer hook, `set_level` only from core, the transfer threat model in the header comment.
