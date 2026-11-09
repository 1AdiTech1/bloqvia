# Lovable prompt 27d — on desktop, "Working on it…" sits over the quiz card (Nov 9)

Approved mock-up: `docs/design/bag-desktop/index.html`, section 2 (Fix). On the desktop game pages the quiz card is centred between the left menu (220 px) and the chain panel (330 px), but the top messages from `AppChrome` ("Working on it…", "Saved on NEAR ✓", errors) are centred on the whole window, so "Working on it…" sits right of the card, over Bloq's hat. Now, on desktop game pages, they are centred over the middle column, the same way the quiz card is. Phones and the landing don't change. Same look, same animation.

**Most important rule (as in prompts 21 to 27c): don't remove or change anything this prompt doesn't name.** Only `src/components/PhoneShell.tsx`, `src/components/AppChrome.tsx` and `src/styles.css` change.

**`PhoneShell.tsx`**: in the effect that adds `bq-game` to `<html>`, also say which layout the page uses, and clear it on the way out:

```tsx
useEffect(() => {
  const html = document.documentElement;
  html.classList.add("bq-game");
  html.dataset["shell"] = nav ? "nav" : chain ? "chain" : "plain"; // for AppChrome's top messages (prompt 27d)
  return () => { html.classList.remove("bq-game"); delete html.dataset["shell"]; };
}, [nav, chain]);
```

**`AppChrome.tsx`**: add the class `bq-toasts` to the fixed container of the top messages (the `pointer-events-none fixed inset-x-0 top-3 z-50 …` div). Nothing else on it changes.

**`styles.css`**: at the desktop breakpoint (the one `dk:` uses, 1100 px), the same side paddings as the quiz sheet's desktop layer:

```css
/* Desktop game pages: the top messages centre over the middle column, like the quiz card (prompt 27d). */
@media (min-width: 1100px) {
  html[data-shell="nav"] .bq-toasts { padding-left: calc(max(0px, (100vw - 1440px) / 2) + 220px); padding-right: calc(max(0px, (100vw - 1440px) / 2) + 330px); }
  html[data-shell="chain"] .bq-toasts { padding-left: max(0px, (100vw - 1440px) / 2); padding-right: calc(max(0px, (100vw - 1440px) / 2) + 330px); }
}
```

## Confirm when done

- Tests and build pass.
- Desktop, map: answer a quest. "Working on it…" sits centred over the quiz card, clear of Bloq. On the landing and on a phone the messages sit where they do today.
- List anything you removed or changed that this prompt doesn't name (it should be nothing).
