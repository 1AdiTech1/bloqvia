# bloqvia-streak (Module A — `memecoins` track)

A community streak token, NEP-141, with the whole mechanic in the contract and no admin key.

- `check_in()` on **core** → forwarded as `check_in_for(learner)` here. Only core may call it; a learner's existing scoped key works, nobody can check in for someone else.
- Each day has a community target (`daily_target` check-ins).
- The first call of a new day settles the previous one: target met → `reward_per_checkin` minted to **everyone** who checked in, community streak +1; target missed → `burn_per_miss` burned from the contract's own treasury, streak reset to 0.
- `settle()` is public: anyone may settle finished days; the result is deterministic.
- Parameters are fixed at `new()` and readable through `get_streak()`. There is no method that mints, burns or moves tokens by hand.

Testnet parameters (`contracts/deploy/init-args.testnet.json`): a "day" is **10 minutes** so the mechanic can be watched during judging; target 2 check-ins; reward 10 STREAK each; burn 100 per missed day; treasury seeded with 500,000. A real deployment would use `day_length_seconds: 86400`.

Sybil limit, stated plainly: one account = one check-in per day. Accounts are created and funded by the relayer, which rate-limits per sender; the contract cannot tell two accounts of one person apart.

```
cargo test                                   # 9 tests
./contracts/deploy/deploy-streak.sh          # after deploy-testnet.sh has redeployed core
near contract call-function as-read-only streak.bloqvia.testnet get_streak json-args '{}' network-config testnet now
```
