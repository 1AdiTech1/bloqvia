# Lovable prompt 27b — the bag never shows after a quiz (Nov 9)

Found reading commit `6e3bf8f` (prompt 27). No design change.

**Most important rule (as in prompts 21 to 27): don't remove or change anything this prompt doesn't name.** Only `src/pages/MapPage.tsx` changes.

In `MapPage.tsx` the bag's portal (`createPortal(<div data-bag="" …>…</div>, document.body)`) sits inside `<AnimatePresence>`. `AnimatePresence` keeps only React elements among its children and drops a portal, so the bag is never rendered. The quiz then finds no `[data-bag]` to fly to, and the rewards land unseen in the bar off screen. (Checked with framer-motion 14.9.0: the same portal renders outside `AnimatePresence` and not inside it.)

Fix: move the whole `{typeof document !== "undefined" && createPortal(…)}` block out of `<AnimatePresence>`, to right after `</AnimatePresence>` (still inside `<PhoneShell>`). The `<QuizSheet …>` line stays where it is. Nothing else changes.

## Confirm when done

- Tests and build pass.
- With the map open, `document.querySelector("[data-bag]")` finds the bag (hidden above the top of the screen).
- List anything you removed or changed that this prompt doesn't name (it should be nothing).
