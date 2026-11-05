#!/usr/bin/env bash
# Module B: deploy bloqvia-bounties to testnet, point core at it, seed bounties.
#
#   ./contracts/deploy/deploy-bounties.sh
#
# Reads relayer/.env for the parent account and key (same as deploy-testnet.sh).
# Idempotent: creates bounties.<parent> if missing, redeploys without init when
# the contract already has code, then calls core.set_bounties_contract, then adds the seed bounties that are not on the board yet.
# Run deploy-testnet.sh first if core changed (it redeploys core, keeping state).
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ -f relayer/.env ]; then set -a; . ./relayer/.env; set +a; fi
PARENT="${PARENT:-${RELAYER_ACCOUNT_ID:-bloqvia.testnet}}"
CORE="${CORE:-core.$PARENT}"
BOUNTIES="${BOUNTIES:-bounties.$PARENT}"
ARGS=contracts/deploy/init-args.testnet.json

exists() { near account view-account-summary "$1" network-config testnet now >/dev/null 2>&1; }
has_code() {
  local out
  out=$(near account view-account-summary "$1" network-config testnet now 2>/dev/null) || return 1
  ! grep -q "No contract code" <<<"$out"
}

DAO="${DAO:-$(node -e "console.log(require('./$ARGS').bounties.dao_id)")}"

echo "== account"
if exists "$BOUNTIES"; then echo "exists  $BOUNTIES"; else
  # 3 NEAR: ~0.5 storage reserve + 0.1 bond kept back, the rest is the first allowance.
  near account create-account fund-myself "$BOUNTIES" '3 NEAR' autogenerate-new-keypair --signature-scheme ed25519 save-to-keychain sign-as "$PARENT" network-config testnet sign-with-keychain send
fi

echo "== build"
(cd contracts/bloqvia-bounties && cargo near build non-reproducible-wasm)
WASM=$(ls contracts/bloqvia-bounties/target/near/*.wasm | head -1)

echo "== deploy bounties"
INIT=$(node -e "const a=require('./$ARGS').bounties; console.log(JSON.stringify({owner_id:'$PARENT', dao_id:'$DAO', core_id:'$CORE', small_cap:a.small_cap, proposal_bond:a.proposal_bond}))")
if has_code "$BOUNTIES"; then
  echo "redeploy $BOUNTIES (already initialised, keeping state)"
  near contract deploy "$BOUNTIES" use-file "$WASM" without-init-call network-config testnet sign-with-keychain send
else
  near contract deploy "$BOUNTIES" use-file "$WASM" with-init-call new json-args "$INIT" prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send
fi

echo "== point core at it"
near contract call-function as-transaction "$CORE" set_bounties_contract json-args "{\"account_id\":\"$BOUNTIES\"}" prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as "$PARENT" network-config testnet sign-with-keychain send

echo "== seed bounties (titles not on the board yet)"
EXISTING=$(near contract call-function as-read-only "$BOUNTIES" get_bounties json-args '{}' network-config testnet now 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=s.match(/\[[\s\S]*\]/);const a=m?JSON.parse(m[0]):[];console.log(a.map(b=>b.title).join("\n"))})')
node -e "for (const b of require('./$ARGS').bounties.seed) console.log(JSON.stringify(b))" | while IFS= read -r B; do
  TITLE=$(node -e "console.log(JSON.parse(process.argv[1]).title)" "$B")
  if grep -qxF "$TITLE" <<<"$EXISTING"; then echo "exists  $TITLE"; continue; fi
  near contract call-function as-transaction "$BOUNTIES" add_bounty json-args "{\"bounty\":$B}" prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as "$PARENT" network-config testnet sign-with-keychain send
done

echo "== verify"
near contract call-function as-read-only "$CORE" get_bounties_contract json-args '{}' network-config testnet now
near contract call-function as-read-only "$BOUNTIES" get_config json-args '{}' network-config testnet now
near contract call-function as-read-only "$BOUNTIES" get_bounties json-args '{}' network-config testnet now | head -60
echo "done: bounties=$BOUNTIES dao=$DAO core=$CORE"
