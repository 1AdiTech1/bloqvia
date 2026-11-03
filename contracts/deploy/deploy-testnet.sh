#!/usr/bin/env bash
# Deploys bloqvia-core and bloqvia-passport to NEAR testnet.
# Prereqs: near-cli-rs >= 0.30 (`near`), cargo-near >= 0.22, rustup target wasm32-unknown-unknown.
# One-time: create the parent account with the faucet, then run this script.
#
#   near account create-account sponsor-by-faucet-service bloqvia.testnet autogenerate-new-keypair save-to-legacy-keychain network-config testnet create
#   (put that key into relayer/.env as RELAYER_PRIVATE_KEY)
#   ./contracts/deploy/deploy-testnet.sh
#
# Keys: on a headless Linux (WSL) near-cli-rs has no system keychain and falls
# back to the legacy keychain, i.e. plain files under ~/.near-credentials/testnet/.
#
# Idempotent where it can be: re-running redeploys code but skips account creation if the account exists.
set -euo pipefail
cd "$(dirname "$0")/../.."

# The one place secrets live: relayer/.env (git-ignored). It provides
# RELAYER_ACCOUNT_ID (= the parent/owner) and RELAYER_PRIVATE_KEY.
if [ -f relayer/.env ]; then set -a; . ./relayer/.env; set +a; fi

PARENT="${PARENT:-${RELAYER_ACCOUNT_ID:-bloqvia.testnet}}"   # relayer + owner
CORE="${CORE:-core.$PARENT}"
PASSPORT="${PASSPORT:-passport.$PARENT}"
BLOQ="${BLOQ:-bloq.$PARENT}"
ARGS=contracts/deploy/init-args.testnet.json

exists() { near account view-account-summary "$1" network-config testnet now >/dev/null 2>&1; }
# true when the account already holds contract code (then redeploy without init)
has_code() {
  local out
  out=$(near account view-account-summary "$1" network-config testnet now 2>/dev/null) || return 1
  ! grep -q "No contract code" <<<"$out"
}

create_sub() { # name, balance
  if exists "$1"; then echo "exists  $1"; else
    near account create-account fund-myself "$1" "$2" autogenerate-new-keypair --signature-scheme ed25519 save-to-keychain sign-as "$PARENT" network-config testnet sign-with-keychain send
  fi
}

deploy() { # account, wasm, init-args-json
  if has_code "$1"; then
    echo "redeploy $1 (already initialised, keeping state)"
    near contract deploy "$1" use-file "$2" without-init-call network-config testnet sign-with-keychain send
  else
    near contract deploy "$1" use-file "$2" with-init-call new json-args "$3" prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send
  fi
}

echo "== accounts"
create_sub "$CORE" '5 NEAR'       # contract storage for balances + lessons
create_sub "$PASSPORT" '3 NEAR'   # one NFT per learner
create_sub "$BLOQ" '0.1 NEAR'     # the merchant; his balances live inside core

echo "== build"
(cd contracts/bloqvia-core && cargo near build non-reproducible-wasm)
(cd contracts/bloqvia-passport && cargo near build non-reproducible-wasm)
CORE_WASM=$(ls contracts/bloqvia-core/target/near/*.wasm | head -1)
PASS_WASM=$(ls contracts/bloqvia-passport/target/near/*.wasm | head -1)

echo "== deploy passport"
PASS_ARGS=$(node -e "const a=require('./$ARGS').passport; a.owner_id='$PARENT'; a.core_id='$CORE'; console.log(JSON.stringify(a))")
deploy "$PASSPORT" "$PASS_WASM" "$PASS_ARGS"

echo "== deploy core"
CORE_ARGS=$(node -e "const a=require('./$ARGS').core; a.owner_id='$PARENT'; a.passport_id='$PASSPORT'; a.bloq_id='$BLOQ'; console.log(JSON.stringify(a))")
deploy "$CORE" "$CORE_WASM" "$CORE_ARGS"

echo "== seed lessons"
[ -d scripts/node_modules ] || (cd scripts && npm i --silent)
OWNER_PRIVATE_KEY="${OWNER_PRIVATE_KEY:-${RELAYER_PRIVATE_KEY:?set RELAYER_PRIVATE_KEY in relayer/.env (parent full-access key)}}"
(cd scripts && OWNER_ACCOUNT_ID="$PARENT" CORE_CONTRACT_ID="$CORE" OWNER_PRIVATE_KEY="$OWNER_PRIVATE_KEY" npm run seed-lessons --silent)

echo "== verify"
near contract call-function as-read-only "$CORE" get_bloq json-args '{}' network-config testnet now
near contract call-function as-read-only "$CORE" get_lessons json-args '{}' network-config testnet now
echo "done: core=$CORE passport=$PASSPORT bloq=$BLOQ"
