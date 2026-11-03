#!/usr/bin/env bash
# Deploys bloqvia-core and bloqvia-passport to NEAR testnet.
# Prereqs: near-cli-rs >= 0.30 (`near`), cargo-near >= 0.22, rustup target wasm32-unknown-unknown.
# One-time: create the parent account with the faucet, then run this script.
#
#   near account create-account sponsor-by-faucet-service bloqvia.testnet autogenerate-new-keypair save-to-keychain network-config testnet create
#   ./contracts/deploy/deploy-testnet.sh
#
# Idempotent where it can be: re-running redeploys code but skips account creation if the account exists.
set -euo pipefail
cd "$(dirname "$0")/../.."

PARENT="${PARENT:-bloqvia.testnet}"          # relayer + owner
CORE="${CORE:-core.$PARENT}"
PASSPORT="${PASSPORT:-passport.$PARENT}"
BLOQ="${BLOQ:-bloq.$PARENT}"
ARGS=contracts/deploy/init-args.testnet.json

exists() { near account view-account-summary "$1" network-config testnet now >/dev/null 2>&1; }

create_sub() { # name, balance
  if exists "$1"; then echo "exists  $1"; else
    near account create-account fund-myself "$1" "$2" autogenerate-new-keypair save-to-keychain sign-as "$PARENT" network-config testnet sign-with-keychain send
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
near contract deploy "$PASSPORT" use-file "$PASS_WASM" with-init-call new json-args "$PASS_ARGS" prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send

echo "== deploy core"
CORE_ARGS=$(node -e "const a=require('./$ARGS').core; a.owner_id='$PARENT'; a.passport_id='$PASSPORT'; a.bloq_id='$BLOQ'; console.log(JSON.stringify(a))")
near contract deploy "$CORE" use-file "$CORE_WASM" with-init-call new json-args "$CORE_ARGS" prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send

echo "== seed lessons"
(cd scripts && OWNER_ACCOUNT_ID="$PARENT" CORE_CONTRACT_ID="$CORE" OWNER_PRIVATE_KEY="${OWNER_PRIVATE_KEY:?export OWNER_PRIVATE_KEY=ed25519:... (parent full-access key)}" npm run seed-lessons --silent)

echo "== verify"
near contract call-function as-read-only "$CORE" get_bloq empty-args network-config testnet now
near contract call-function as-read-only "$CORE" get_lessons empty-args network-config testnet now
echo "done: core=$CORE passport=$PASSPORT bloq=$BLOQ"
