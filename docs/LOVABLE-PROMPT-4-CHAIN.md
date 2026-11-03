# Lovable — prompt 4: connect the Lab to NEAR testnet

Wires `useGame()` to the chain layer in `src/near/` behind an env switch. The Lovable preview keeps the mock; a local run with `VITE_GAME_MODE=near` plays on testnet through the relayer. No screen changes except `RequireAccount`.

---

Connect the game to the NEAR chain layer that now lives in this repo under `src/near/` (it came in through the GitHub sync; do not modify anything inside it). Keep the mock as the default so this preview keeps working; the chain mode is switched on by an environment variable in local and hosted builds.

## Scope guard

- Touch only: the root `package.json` (one dependency), `src/game/useGame.ts`, `src/components/RequireAccount.tsx`.
- Do not change `src/game/types.ts`, `src/game/mockGame.ts`, `src/game/content.ts`, `src/game/lessons.json`, any page or component other than `RequireAccount`, or anything under `src/near/`, `contracts/`, `relayer/`, `scripts/`, `docs/`.
- `src/near/useBloqvia.ts` exports `useBloqvia(): Bloqvia`; `Bloqvia` is a superset of the `Game` interface in `src/game/types.ts` (same fields and functions, plus `clearError`). Nothing in the screens needs to change for it.

## 1. Dependency

Add `near-api-js` version `^7.4.0` to `dependencies` in the root `package.json` and install it with the project's package manager (bun; update `bun.lock`). It is only imported by `src/near/`.

## 2. `src/game/useGame.ts` — replace the file with exactly this

```ts
import type { Game } from "./types";
import { useMockGame } from "./mockGame";
import { useBloqvia } from "../near";

/**
 * VITE_GAME_MODE=near plays on NEAR testnet through src/near (needs the
 * relayer at VITE_RELAYER_URL). Anything else, including this preview, keeps
 * the in-memory mock. Decided once per build, so no conditional hooks.
 */
const useNear = import.meta.env.VITE_GAME_MODE === "near";

export const useGame: () => Game = useNear ? useBloqvia : useMockGame;
```

## 3. `src/components/RequireAccount.tsx` — wait before deciding

In chain mode the session is restored after mount and the learner data arrives from RPC a moment later, so the guard must not redirect while that is happening. Replace the component body with this logic, keeping the file's imports style:

- Read `accountId`, `learner` and `busy` from `useGame()`.
- If there is no `accountId` **and** `busy` is false → navigate to `/` (as today). If there is no `accountId` but `busy` is true → render nothing yet (session restoring).
- If there is an `accountId` but `learner` is still `null` → render the `LabLoader` centered on the navy background (the one used on the sign-in sheet), not the children, and do not redirect.
- Otherwise render the children.

With the mock nothing changes: `busy` starts false and `learner` is set the instant `start()` resolves.

## Verify

1. Run the production build (`bun run build`) — it must pass with `src/near` now bundled; report any error verbatim.
2. In this preview (mock mode) walk the loop once at mobile width: start → one quest → shop → passport. Confirm nothing regressed.
3. List the files you changed and confirm the scope guard held.
