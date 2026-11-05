#!/usr/bin/env bash
# Module B: create the cohort DAO from the Sputnik v2 testnet factory.
#
#   COUNCIL=bloqvia.testnet,maria.testnet ./contracts/deploy/create-dao.sh
#
# Reads relayer/.env for the parent account (pays the 6 NEAR the factory asks
# for) and contracts/deploy/init-args.testnet.json for name, purpose and bond.
# The DAO lives at <name>.<factory> (bloqvia-dao.sputnik-v2.testnet). Policy:
# anyone may add a proposal; the council votes, threshold 1 of 2 so one council
# vote approves; proposal bond 0.1 NEAR so the bounty board can file them.
# Idempotent: exits early if the DAO account already exists.
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ -f relayer/.env ]; then set -a; . ./relayer/.env; set +a; fi
PARENT="${PARENT:-${RELAYER_ACCOUNT_ID:-bloqvia.testnet}}"
FACTORY="${FACTORY:-sputnik-v2.testnet}"
COUNCIL="${COUNCIL:-$PARENT}"
ARGS=contracts/deploy/init-args.testnet.json
NAME=$(node -e "console.log(require('./$ARGS').dao.name)")
DAO="$NAME.$FACTORY"

exists() { near account view-account-summary "$1" network-config testnet now >/dev/null 2>&1; }

echo "== factory"
near contract call-function as-read-only "$FACTORY" get_dao_list json-args '{}' network-config testnet now | tail -3

if exists "$DAO"; then echo "exists  $DAO"; else
  echo "== create $DAO (council: $COUNCIL)"
  B64=$(node -e "
    const d = require('./$ARGS').dao;
    const council = '$COUNCIL'.split(',').map((s) => s.trim()).filter(Boolean);
    const policy = {
      roles: [
        { name: 'all', kind: 'Everyone', permissions: ['*:AddProposal'], vote_policy: {} },
        { name: 'council', kind: { Group: council }, permissions: ['*:AddProposal', '*:VoteApprove', '*:VoteReject', '*:VoteRemove', '*:Finalize'], vote_policy: {} },
      ],
      default_vote_policy: { weight_kind: 'RoleWeight', quorum: '0', threshold: d.threshold },
      proposal_bond: d.proposal_bond,
      proposal_period: d.proposal_period,
      bounty_bond: d.proposal_bond,
      bounty_forgiveness_period: '86400000000000',
    };
    const args = { config: { name: d.name, purpose: d.purpose, metadata: '' }, policy };
    console.log(Buffer.from(JSON.stringify(args)).toString('base64'));
  ")
  near contract call-function as-transaction "$FACTORY" create json-args "{\"name\":\"$NAME\",\"args\":\"$B64\"}" prepaid-gas '150 Tgas' attached-deposit '6 NEAR' sign-as "$PARENT" network-config testnet sign-with-keychain send
fi

echo "== verify"
near contract call-function as-read-only "$DAO" get_policy json-args '{}' network-config testnet now | head -40
near contract call-function as-read-only "$DAO" get_last_proposal_id json-args '{}' network-config testnet now
echo "done: dao=$DAO"
