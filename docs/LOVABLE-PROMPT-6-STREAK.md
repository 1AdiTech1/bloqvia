# Lovable — prompt 6: the streak card (Module A)

Sent Nov 4, after `module-a` merged. One new component on the map, fed by `useStreak()` from `src/near`; hides itself when the module is not deployed or the app runs the mock.

---

Add the **streak card** — Module A of the game, a community streak token on NEAR testnet. The chain layer is already in the repo: `useStreak()` from `@/near` (see `src/near/useStreak.ts` for the fields). Same identity and register as the rest of the Lab; this is one card, not a new screen.

## Scope guard

- Create `src/components/lab/StreakCard.tsx`; edit `src/pages/MapPage.tsx` only to place it. Nothing else changes.
- Do not change `src/game/*`, `src/near/*`, `RequireAccount`, `AppChrome`, the quiz sheet, the shop, the passport or the homepage.
- The card reads and writes only through `useStreak()`. No other data path.

## Data (from `useStreak()`)

- `enabled` — false when core has no streak contract. **Render nothing when false**, and also render nothing when `import.meta.env.VITE_GAME_MODE === "mock"`.
- `streak` — `{ day, seconds_left_in_day, today_count, today_target, streak, best_streak, treasury, total_supply, params: { daily_target, reward_per_checkin, burn_per_miss, day_length_seconds }, last, history }`
- `member` — `{ checked_in_today, last_checkin_day, total_checkins, balance }` or null before sign-in.
- `busy`, `error`, `lastTx` (`{ txHash, url }`), `checkIn()`, `refresh()`, `clearError()`.

## The card — on `/map`, directly under the inventory bar

Ivory surface like the other cards, navy type, lime for "met", coral for "missed".

1. **Header row:** eyebrow "Community streak", then the big number `streak.streak` with the word "days" (the unit is a *Bloqvia day*; see 5), and a small lavender chip "best {best_streak}".
2. **Today:** a thin progress bar `today_count / today_target` with the copy "{today_count} of {today_target} check-ins today" and, below it, a countdown "next day in mm:ss" derived from `seconds_left_in_day` (count it down locally with `setInterval`, call `refresh()` when it reaches zero).
3. **The button:** **Check in** (lime, full width, 44 px). While `busy`: the small LabLoader and "Saving your check-in…". When `member.checked_in_today`: disabled, reads "Checked in today ✓" with a lime tick. After a successful `checkIn()` the count ticks up with the same number tween the shop uses, and `lastTx.url` appears as a quiet "See it on the explorer" link under the button. If `error` is set, show it verbatim in a coral line under the button (the contract's own words, e.g. "Already checked in today") with a small × that calls `clearError()`.
4. **Your standing:** one line — "You hold {member.balance} STREAK · {member.total_checkins} check-ins" (hide when `member` is null).
5. **Rule and demo note** behind an ⓘ: "Each day the community needs {daily_target} check-ins. A day that makes it mints {reward_per_checkin} STREAK to everyone who checked in; a day that misses burns {burn_per_miss} from the treasury and resets the streak. The rule lives in the contract; nobody can change it. On testnet a Bloqvia day is {day_length_seconds / 60} minutes so you can watch it happen." Fill the numbers from `params`.
6. **Log:** a "Last days" disclosure, collapsed by default, listing `history` newest first (at most 7): "Day {day} · {checkins} check-ins · met · +{minted} minted" in lime, or "… · missed · −{burned} burned" in coral. Below the list, one muted line: "Treasury {treasury} · supply {total_supply}".

Respect `prefers-reduced-motion` as everywhere else: static end states.

## Verify

1. `bun run build` passes.
2. In the preview (testnet; allow 10 s per step): sign in, see the card under the inventory bar with "0 of 2 check-ins today" (or whatever the chain says), press **Check in** → "Checked in today ✓" and the count +1; press nothing else and confirm a second click is impossible. Reload `/map` → still checked in.
3. At 390 px and 1440 px: the card fits the column, nothing overflows.
4. List the files you changed and confirm the scope guard held.
