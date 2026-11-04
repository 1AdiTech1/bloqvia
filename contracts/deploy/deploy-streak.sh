#!/usr/bin/env bash
# Module A: deploy bloqvia-streak to testnet and point core at it.
#
#   ./contracts/deploy/deploy-streak.sh
#
# Reads relayer/.env for the parent account and key (same as deploy-testnet.sh).
# Idempotent: creates streak.<parent> if missing, redeploys without init when
# the contract already has code, then calls core.set_streak_contract.
# Run deploy-testnet.sh first if core changed (it redeploys core, keeping state).
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ -f relayer/.env ]; then set -a; . ./relayer/.env; set +a; fi
PARENT="${PARENT:-${RELAYER_ACCOUNT_ID:-bloqvia.testnet}}"
CORE="${CORE:-core.$PARENT}"
STREAK="${STREAK:-streak.$PARENT}"
ARGS=contracts/deploy/init-args.testnet.json

exists() { near account view-account-summary "$1" network-config testnet now >/dev/null 2>&1; }
has_code() {
  local out
  out=$(near account view-account-summary "$1" network-config testnet now 2>/dev/null) || return 1
  ! grep -q "No contract code" <<<"$out"
}

echo "== account"
if exists "$STREAK"; then echo "exists  $STREAK"; else
  near account create-account fund-myself "$STREAK" '2 NEAR' autogenerate-new-keypair --signature-scheme ed25519 save-to-keychain sign-as "$PARENT" network-config testnet sign-with-keychain send
fi

echo "== build"
(cd contracts/bloqvia-streak && cargo near build non-reproducible-wasm)
WASM=$(ls contracts/bloqvia-streak/target/near/*.wasm | head -1)

echo "== deploy streak"
INIT=$(node -e "const a=require('./$ARGS').streak; a.core_id='$CORE'; console.log(JSON.stringify(a))")
if has_code "$STREAK"; then
  echo "redeploy $STREAK (already initialised, keeping state)"
  near contract deploy "$STREAK" use-file "$WASM" without-init-call network-config testnet sign-with-keychain send
else
  near contract deploy "$STREAK" use-file "$WASM" with-init-call new json-args "$INIT" prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send
fi

echo "== point core at it"
near contract call-function as-transaction "$CORE" set_streak_contract json-args "{\"account_id\":\"$STREAK\"}" prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as "$PARENT" network-config testnet sign-with-keychain send

echo "== verify"
near contract call-function as-read-only "$CORE" get_streak_contract json-args '{}' network-config testnet now
near contract call-function as-read-only "$STREAK" get_streak json-args '{}' network-config testnet now
echo "done: streak=$STREAK core=$CORE"
