# Lovable prompt 20 — site icon + Ask Bloq card in the rail (Nov 7)

Approved preview: `docs/design/fixes-20/index.html` (sections 1 and 2; section 3 is in `src/bloq/` and ships separately).

**Rules (as before).** Do not edit `src/bloq/*` or `src/near/*`, and don't add, remove or replace anything in `public/`. No logic, contract, reward, price or balance changes. Strict TypeScript and reduced motion as before.

## 1. The Bloqvia icon instead of the Lovable one

The new icon files are pushed to `public/` from GitHub: `favicon.ico` (replaces the old one), `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` and `site.webmanifest`. Don't create or overwrite them. If they aren't in your copy yet, pull first; until they arrive the links below just 404, which is harmless.

In `src/routes/__root.tsx`, replace the one `{ rel: "icon", href: "/favicon.ico", type: "image/x-icon" }` entry in `head().links` with these four, in this order:

```ts
{ rel: "icon", href: "/favicon.ico?v=2", sizes: "32x32" },
{ rel: "icon", href: "/favicon.svg?v=2", type: "image/svg+xml" },
{ rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=2" },
{ rel: "manifest", href: "/site.webmanifest?v=2" },
```

`?v=2` makes browsers drop the cached Lovable icon. Keep every other `meta` and `link` as it is; `theme-color` `#16243A` stays.

## 2. The rail's Ask Bloq card: two rows, like the website dock

On desktop (`dk`), `RailAgent` in `src/components/PhoneShell.tsx` has three rows because "AI agent · online" wraps in the 220px rail. Give the subline the website dock's text style (`.lv-dock-txt small`) so it stays on one line:

- Button: `gap-3` → `gap-2.5`, and `p-3 pt-5` → `px-2.5 pb-3 pt-5`. Everything else stays (background, radius, hover, aria).
- `AgentPod size={44}` → `size={42}`.
- Text column: `flex flex-col leading-tight` → `grid gap-1 leading-none`.
- Title: keep `font-display text-[15px] font-semibold text-ivory` and add `leading-none`.
- Subline: `mt-0.5 flex items-center gap-1.5 text-xs text-lavender` → `flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium leading-none text-ivory/70`. The dot: `h-2 w-2` → `h-[7px] w-[7px]` (keep `rounded-full bg-lime motion-safe:animate-pulse`).

Phones and tablets (the round dock beside the tab pill) don't change.

Confirm when done, and say what you did and didn't check in the browser:
- At 1100px and 1440px the rail card shows exactly two rows ("Ask Bloq", then "● AI agent · online" on one line), with nothing clipped.
- The page head contains the four icon links above and no other `rel="icon"`.
- Nothing in `src/bloq/`, `src/near/` or `public/` changed.
