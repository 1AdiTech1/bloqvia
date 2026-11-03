# Auth spike — Nov 4, time-boxed to one day

Decides sign-in path A (NEAR Auth) or path B (app-held key). Path B is already
implemented (`src/near/signer.ts` → `LocalKeySigner`) and is the default. The
spike only decides whether A replaces it. Any blocker below = B, no debate.

## What path A must prove, on testnet, in this order

1. **Install and configure.** `npm i @fast-auth-near/react-sdk @fast-auth-near/javascript-provider`
   (versions on npm as of Nov 3: 1.3.1 / 1.4.1). Follow
   https://docs.near.org/web3-apps/tutorials/near-auth.md for the Auth0 app,
   testnet network config and the provider setup. Budget: 2 h.
2. **Sign in with Google and get a NEAR account id.** Record what kind of
   account it is (named, implicit, under which parent). Budget: 1 h.
3. **Register it with our relayer.** `POST /register { accountId }` → core
   `register_learner` → Passport minted. This path already exists in
   `relayer/src/accounts.ts::registerExistingAccount`. Budget: 30 min.
4. **The decisive test — sign a DelegateAction without a popup.** Build
   `complete_lesson` as a NEP-366 delegate action with the SDK's signer and
   relay it. Count the Auth0 context switches:
   - 0 after the first sign-in → **A passes**: implement `NearAuthSigner` in
     `src/near/signer.ts` with the SDK, keep B as a fallback setting.
   - 1 per transaction → **A fails** the games track's "no wallet popups in the
     normal game loop". Path B stays. Note the finding in the README.
   Budget: 3 h.
5. **Key permissions.** If the SDK's key is full-access, the relayer's
   allow-list is the only guard on what gets relayed; confirm the contract
   rejects anything else anyway (it does: `complete_lesson` checks the hash and
   once-per-account; `mt_transfer` needs 1 yocto the learner never has). Budget: 30 min.

## Stop conditions

- Any step over budget by 2× → B.
- Mainnet credentials are **not** needed: testnet is the development option.
  Apply for mainnet credentials during judging week for v2.
- Whatever the result, by 18:00 on Nov 4 `docs/SPIKE-AUTH.md` gets a one-line
  verdict at the top and the roadmap doc's open decision is ticked.

## Why B is a legitimate answer, not a consolation

The browser generates an ed25519 key, the relayer creates
`learner-<hash>.bloqvia.testnet` under our parent and adds that key as a
**function-call key scoped to `core.bloqvia.testnet`** with four methods.
The learner never sees a seed phrase or a popup; the key cannot move NEAR or
touch any other contract; at the reveal the app hands the secret over so the
account can be imported into a real wallet. Social login is the only thing B
lacks, and it is the one thing the track does not score.
