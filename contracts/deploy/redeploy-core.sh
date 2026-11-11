#!/usr/bin/env bash
# Redeploys bloqvia-core's code on testnet, keeping its state (Nov 11: the price call).
# The new code adds methods and storage under new keys only; the contract struct is unchanged, so no migration runs.
#
#   ./contracts/deploy/redeploy-core.sh            # build, show three learners' balances, deploy, show them again, verify
#
# Safety: it prints gold and item balances of three accounts before and after, and refuses to continue if the build
# fails. Rolling back = redeploying the previous wasm (kept in contracts/bloqvia-core/target/near/previous.wasm).
set -euo pipefail
cd "$(dirname "$0")/../.."
if [ -f relayer/.env ]; then set -a; . ./relayer/.env; set +a; fi

CORE="${CORE_CONTRACT_ID:-core.bloqvia.testnet}"
BLOQ="${BLOQ:-bloq.bloqvia.testnet}"
# three accounts whose balances must not move: the merchant, the NPC trader, and a learner (override with WATCH=a,b,c)
WATCH="${WATCH:-$BLOQ,${TRADER_ACCOUNT_ID:-learner-a43be056a428.bloqvia.testnet},learner-f8cdd4ad158f.bloqvia.testnet}"

show() {
  for acc in ${WATCH//,/ }; do
    printf '  %-45s ' "$acc"
    near contract call-function as-read-only "$CORE" get_learner json-args "{\"account_id\":\"$acc\"}" network-config testnet now 2>/dev/null \
      | python3 -c "import json,sys; t=sys.stdin.read(); i=t.find('{'); d=json.loads(t[i:t.rfind('}')+1]); print('gold', d['gold'], ' '.join(f'{n} {k}' for k,n in d['items']))" || echo "(no view)"
  done
}

echo "== build"
(cd contracts/bloqvia-core && cargo near build non-reproducible-wasm)
WASM=$(ls contracts/bloqvia-core/target/near/*.wasm | head -1)
echo "   $WASM ($(stat -c %s "$WASM") bytes)"

echo "== keep the code that is on chain now, for a rollback"
mkdir -p contracts/bloqvia-core/target/near
near contract download-wasm "$CORE" save-to-file contracts/bloqvia-core/target/near/previous.wasm network-config testnet now >/dev/null 2>&1 \
  && echo "   contracts/bloqvia-core/target/near/previous.wasm" || echo "   (could not download the current code; continuing)"

echo "== balances before"
show

echo "== deploy $CORE (code only, state kept)"
near contract deploy "$CORE" use-file "$WASM" without-init-call network-config testnet sign-with-keychain send

echo "== balances after (must be identical)"
show

echo "== verify"
near contract call-function as-read-only "$CORE" get_call_round json-args '{}' network-config testnet now
near contract call-function as-read-only "$CORE" get_price_calls json-args '{"token_id":"key-fragment"}' network-config testnet now | tail -12
near contract call-function as-read-only "$CORE" get_bloq json-args '{}' network-config testnet now | grep -E '"gold"|"shop_open"'
echo "done: $CORE redeployed; the price call is live. Restart the relayer (it settles rounds every minute)."
