# Lovable — prompt 2: the homepage, new creative direction

Maria's direction (Nov 3), merged with the project's guards. Replaces the Solarpunk landing. The game screens are restyled in prompt 3.

---

Act as an award-winning digital creative director and senior frontend designer. We are redesigning the **homepage** of BLOQVIA, a Web3 learning platform for everyone, and we are replacing its visual identity.

## Scope guard — read first

- Replace the Landing page (`/`, `src/pages/Landing.tsx`, `src/components/Logo.tsx`, `src/components/AppChrome.tsx`) and the global theme tokens in `src/styles.css`.
- **Keep every other route, page and component exactly as it is** (`/map`, `/shop`, `/passport`, `/reveal`, `QuizSheet`, `Bloq`, `PassportCard`, `PhoneShell`) and do not touch anything in `src/game/`. They will be restyled in the next prompt with the identity you define now, so put the colours, type scale, spacing and motion primitives into reusable tokens and components they can use.
- Framer Motion is approved for animation. No other new dependencies without asking.
- The Landing's two primary calls to action must still work: they open the email sign-in (an inline field or a bottom sheet) and call `useGame().start()`, then navigate to `/map`. Nothing else on the homepage reads game state.

## Creative references

MetaMask Learn is the primary creative reference for visual sophistication, educational storytelling, original illustration, colourful-but-mature design and engaging interactive elements. Take inspiration from premium editorial websites and award-winning digital experiences. Do not copy MetaMask branding, assets, layouts or illustrations.

## The creative direction

Premium. Modern. Intelligent. Energetic. Creative. Approachable. Interactive.

This is NOT a children's game: no toy-like interfaces, no cartoon-heavy layouts, no childish characters. It must appeal to adults, students, professionals and complete Web3 beginners. But Bloqvia *is* a game you play — a path you move along, rewards that land, a merchant who reacts — so "gamified" and "mature" are not opposites here. Think Monument Valley, Alto's Odyssey, Duolingo for adults: tactile, rewarding, grown-up. The homepage is editorial and calm; the Experience Lab (the game, reached after sign-in) will carry the play.

## Visual identity

- Midnight navy `#16243A` · Warm ivory `#F7F4EB` · Electric lime `#C7F36B` · Soft coral `#F5A58B` · Lavender `#B9B2EF`.
- Space Grotesk for headlines, Inter for body. Oversized typography, generous whitespace, sophisticated colour pairings (navy on ivory, lime on navy, lavender tints for secondary surfaces, coral only for emphasis and warnings).
- **Logo:** a wordmark "BLOQVIA" in Space Grotesk (tight tracking, medium weight) plus a compact mark: three offset rounded blocks that read as a "B" when stacked — "bloq" means block. Lime mark on navy; navy mark on ivory. Build it as an SVG component with a 24px and a 40px size, and show two alternate marks on a hidden `/brand` route so we can choose.
- Art direction: sculptural geometric objects, floating digital elements, connected structures, atmospheric lighting, rich depth; wallet- and blockchain-inspired visual metaphors are welcome on the homepage. Bloq can appear as a distinctive brand companion in one section, but must not dominate.
- **Illustrations:** you write code, so do not attempt 3D renders in CSS. Build each illustrated area as a clearly bounded slot with a fixed aspect ratio (hero 4:3 on mobile, 16:10 on desktop; sections 1:1 or 3:2) that renders a tasteful abstract composition from a few layered SVG shapes, lime/lavender/coral on navy, with slow parallax. We will drop in produced artwork into those slots afterwards; make the slot a single `Illustration` component with a `src` prop that falls back to the SVG composition when `src` is empty.

## Homepage sections

1. **Hero.** Headline, two lines: "THE INTERNET IS EVOLVING." / "UNDERSTAND WHAT'S NEXT." Supporting copy: "Discover blockchain, digital ownership and the technology changing how we interact with the world. No technical knowledge required." Primary CTA **START EXPLORING** (opens the email sign-in → `start()` → `/map`). Secondary CTA **DISCOVER BLOQVIA** (scrolls to section 2). A striking, memorable composition in the hero illustration slot with a sense of movement; strong typography.
2. **Introducing Web3.** "A NEW INTERNET." / "A NEW WAY TO THINK." Explain Web3 in plain, accessible language in three or four short paragraphs with interactive visual storytelling (a diagram that changes as you scroll or hover). An original illustration slot.
3. **Discover the fundamentals.** Varied editorial layout, not repeating cards. Season 1, the three chapters you can play today: **Keys** (The Vault), **Gas** (The Fuel System), **Smart contracts** (Smart Agreements) — each with a one-line hook and "Chapter 1 / 2 / 3". Then a quieter strip, "Next season": Digital ownership, Transactions, Decentralised finance, marked as coming.
4. **The Experience Lab.** "DON'T JUST LEARN IT." / "EXPERIENCE IT." Introduce the Experience Lab: the part of Bloqvia you play — quests that mint real items, a merchant whose prices move with what players do, a Passport that records what you've done. An immersive laboratory illustration slot. CTA **ENTER THE EXPERIENCE LAB** (same sign-in → `/map`).
5. **Rewards.** Introduce BloqGold, the items you earn, achievements and graduation with the Passport. Sophisticated, not a children's reward chart: a restrained composition of the three item icons and the Passport, with a line each.
6. **Final CTA.** "YOUR JOURNEY INTO WEB3 STARTS HERE." CTA **START LEARNING** (same sign-in). Footer: "Built on NEAR · NEAR Hackathon 2026 · Source code" (placeholder link).

## Motion and interaction

Purposeful only: scroll-triggered reveals, subtle parallax on the illustration slots, slow drift on floating elements, smooth section transitions, hover and tap feedback on every control. Respect `prefers-reduced-motion`. No bouncing, no cartoon easing, no effects that don't carry meaning.

## Responsive

Mobile-first with a fully designed desktop experience. Recompose illustrations and typography for mobile; do not just shrink the desktop layout. Touch targets at least 44px.

## Technical

React, TypeScript, Tailwind, reusable components, clean responsive code. Put the identity into theme tokens (CSS variables + Tailwind theme) and a small set of primitives (`Section`, `Eyebrow`, `Display`, `Illustration`, `CTA`) the game screens can reuse. Keep future NEAR integration in mind; the data layer (`src/game`) is already in place and must not change.

## Quality bar

The homepage must feel like a premium, award-winning Web3 educational brand: visually exciting without feeling childish, interactive without being overwhelming, and it must make people curious about Web3. Prioritise the hero and the overall art direction over the number of features.

When done, list the files you changed and confirm that `/map`, `/shop`, `/passport`, `/reveal` and `src/game/*` are unchanged.
