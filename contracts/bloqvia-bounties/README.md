# bloqvia-bounties

A bounty board owned by a DAO, paid by tier. Module B of Bloqvia (`social` track). The design and the flow diagram are in `docs/MODULE-B.md`.

```
cargo test                                   # 14 tests, no wasm target needed
cargo near build non-reproducible-wasm       # target/near/bloqvia_bounties.wasm
COUNCIL=a.testnet,b.testnet ../deploy/create-dao.sh   # once: the DAO from the Sputnik v2 testnet factory
../deploy/deploy-bounties.sh                 # account, deploy, core.set_bounties_contract, seed bounties
```

## Reading guide

- `claim_for` — accepted only from `bloqvia-core`; records `Pending` **before** the cross-contract read, so two claims in flight cannot pay twice.
- `on_learner` — the one place the requirement is checked (`unmet`), then by tier: `Small` transfers from the allowance, `Medium` files `add_proposal(Transfer)` on the DAO with the bond, `Large` records `Eligible`.
- `on_paid` / `on_proposed` — settle or remove the claim; a failed transfer or a refused proposal never leaves a claim behind.
- `allowance()` — balance minus storage, a reserve and one bond: what the board can pay by itself.
- What the owner and the DAO can do: `add_bounty`, `close_bounty`. Nothing changes a posted reward; nothing pays by hand; the board holds no key to the DAO.

## The DAO's side (near-cli, council member)

```
# fund the board (Transfer proposal → bounties.bloqvia.testnet), then approve it
near contract call-function as-transaction bloqvia-dao.sputnik-v2.testnet add_proposal \
  json-args '{"proposal":{"description":"Fund the bounty board","kind":{"Transfer":{"token_id":"","receiver_id":"bounties.bloqvia.testnet","amount":"3000000000000000000000000"}}}}' \
  prepaid-gas '50 Tgas' attached-deposit '0.1 NEAR' sign-as bloqvia.testnet network-config testnet sign-with-keychain send
near contract call-function as-transaction bloqvia-dao.sputnik-v2.testnet act_proposal \
  json-args '{"id":0,"action":"VoteApprove"}' prepaid-gas '100 Tgas' attached-deposit '0 NEAR' sign-as bloqvia.testnet network-config testnet sign-with-keychain send

# a medium claim shows up as a proposal the board filed; one vote pays the learner
near contract call-function as-read-only bloqvia-dao.sputnik-v2.testnet get_proposals json-args '{"from_index":0,"limit":20}' network-config testnet now

# post a bounty through the DAO instead of the owner (FunctionCall proposal)
ARGS=$(printf '{"bounty":{"title":"…","description":"…","tier":"Small","reward":"100000000000000000000000","requirement":"Graduated","max_claims":10}}' | base64 -w0)
near contract call-function as-transaction bloqvia-dao.sputnik-v2.testnet add_proposal \
  json-args "{\"proposal\":{\"description\":\"New bounty\",\"kind\":{\"FunctionCall\":{\"receiver_id\":\"bounties.bloqvia.testnet\",\"actions\":[{\"method_name\":\"add_bounty\",\"args\":\"$ARGS\",\"deposit\":\"0\",\"gas\":\"30000000000000\"}]}}}}" \
  prepaid-gas '50 Tgas' attached-deposit '0.1 NEAR' sign-as bloqvia.testnet network-config testnet sign-with-keychain send
```
