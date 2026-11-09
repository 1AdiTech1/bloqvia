# Lovable prompt 27e — no "Wrong answer" pill while the quiz is open (Nov 9)

Approved mock-up: `docs/design/tail-rule/index.html`, section 2, option **B**. When a quiz answer is wrong, the quiz already says so three ways: Bloq's line ("Oops, the contract said no. Read the hint below."), the crossed-out option, and the hint. The red "Wrong answer" pill at the top of the screen adds nothing there, and on desktop it sits on Bloq's line. Now, while a quiz is open, a wrong answer shows no top pill. Everything else stays: other errors (network, relayer, contract) still show at the top, and so do "Working on it…" and "Saved on NEAR ✓".

**Most important rule (as in prompts 21 to 27d): don't remove or change anything this prompt doesn't name.** Only `src/components/QuizSheet.tsx` and `src/components/AppChrome.tsx` change. Don't touch `src/bloq/*`, `src/near/*`, `src/content/*` or `public/`.

Already on `main` for this: `isWrongAnswer(message)` from `@/near` (`src/near/errors.ts`): true for the contract's refusal of a wrong option ("Wrong answer").

**`QuizSheet.tsx`**: give the sheet's outer layer (the `motion.div` with `role="dialog"`) the attribute `data-quiz=""`. Nothing else changes.

**`AppChrome.tsx`**: import `isWrongAnswer` from `@/near`, and the effect that copies `game.error` into the pill becomes:

```tsx
useEffect(() => {
  if (!game.error) return;
  // A wrong quiz answer is shown by the quiz itself (Bloq's line, the crossed-out option, the hint): no top pill then (prompt 27e).
  if (isWrongAnswer(game.error) && document.querySelector("[data-quiz]")) return;
  setErr(game.error);
}, [game.error]);
```

## Confirm when done

- Tests and build pass.
- In a quiz, pick a wrong option: Bloq says his line, the option is crossed out, the hint opens, and no "Wrong answer" pill appears at the top. "Working on it…" still shows while the answer is checked.
- An error outside a wrong answer (for example with the network off) still shows its pill.
- List anything you removed or changed that this prompt doesn't name (it should be nothing).
