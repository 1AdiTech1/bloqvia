# bloqvia

Build **Bloqvia**, a mobile-first web app that teaches Web3 by playing it. A newcomer signs in with just an email, plays three short quests, trades with a merchant whose prices move with what players do, and graduates — and only at the end learns that everything was a real transaction on the NEAR blockchain in an account that is theirs. The blockchain must be invisible until the final "reveal" screen: **no wallet-connect button, no seed phrase, no "gas", no "transaction pending" wording anywhere before the reveal.**

Stack: Vite + React + TypeScript + Tailwind (your defaults). One web app that works on phones and laptops: the **Landing page is fully responsive** and uses the full width on desktop (grid layout, generous spacing); **every other screen** (map, quiz, shop, passport, reveal) is designed at 390px phone width and rendered as a centered column, max 480px, with the Solarpunk background filling the rest of a wide screen. Touch targets at least 44px. All text in English.

## Visual direction: Solarpunk

Optimistic, sunlit, organic. Warm greens (moss, sage, leaf), sunlight gold as the accent, cream backgrounds, terracotta for warnings; rounded organic shapes, soft shadows, subtle leaf/vine motifs in dividers and empty states. Friendly geometric display font for headings (e.g. Outfit or Sora from Google Fonts) and a highly readable body font (e.g. Inter). **Not** the usual crypto look: no dark mode by default, no neon, no gradients-on-black, no hexagons.

## Architecture rule (important)

All screens read and write game state through ONE hook: `useGame()` in `src/game/useGame.ts`, which returns the `Game` interface below. For now `useGame()` wraps a **mock** in `src/game/mockGame.ts` that holds state in React and simulates the whole loop, including the merchant's prices with the exact formula given below. Later we will replace the mock with the real chain layer that lives in `src/near/` (do not create that folder); the screens must not need any change for that swap. Put the types in `src/game/types.ts` exactly as given. Do not add any other data layer, context or store; the hook is the only source of truth. Keep all your work inside `src/components/`, `src/pages/`, `src/styles/`, `src/game/`.

```ts
// src/game/types.ts — copy exactly
export interface LessonPublic {
  lesson_id: string; title: string; answer_hash: string;
  reward_gold: string; reward_item: string; reward_item_amount: string;
}
export interface ItemPrice { token_id: string; bloq_stock: string; buy_price: string; sell_price: string; }
export interface BloqView {
  account_id: string; gold: string; shop_open: boolean; treasury_floor: string;
  prices: ItemPrice[]; graduation_fee: string;
}
export interface LearnerView {
  account_id: string; registered: boolean; completed: string[]; level: number;
  graduated: boolean; gold: string; items: [string, string][];
}
export interface PassportView { token_id: string; owner_id: string; level: number; graduated: boolean; }
export interface RelayResult { txHash: string; senderId: string; methods: string[]; }

export interface Game {
  accountId: string | null;
  learner: LearnerView | null;
  passport: PassportView | null;
  bloq: BloqView | null;
  lessons: LessonPublic[];
  lastTx: (RelayResult & { url: string }) | null;
  busy: boolean;
  error: string | null;
  start: () => Promise<string>;                                   // sign-in; returns accountId
  refresh: () => Promise<void>;
  completeLesson: (lessonId: string, answer: string) => Promise<RelayResult>;
  sellToBloq: (tokenId: string, amount?: number) => Promise<RelayResult>;
  buyFromBloq: (tokenId: string, amount?: number) => Promise<RelayResult>;
  graduate: () => Promise<RelayResult>;
  signOut: () => void;
  exportSecretKey: () => string | null;
  explorer: { tx: (hash: string) => string; account: (id: string) => string; passport: (id: string) => string; };
}
```

Amounts are decimal strings with 0 decimals (`"100"` = 100 gold); `Number(x)` is fine for display. Item ids are exactly `key-fragment`, `fuel-cell`, `contract-seal`; the currency is `gold`. Display names: Key Fragment, Fuel Cell, Contract Seal, Gold.

### Mock behaviour (so the whole loop is playable before the chain is connected)

- `start()` waits 1.2 s, sets `accountId` to `learner-7f3a9c2b1d4e.bloqvia.testnet`, `passport` level 0, `learner` with 0 gold and no items, `bloq` with 10,000 gold and stock 5 of each item.
- `completeLesson(id, answer)`: if `answer` (trimmed, lower-cased) equals the lesson's correct answer, waits 1.5 s, adds the lesson's rewards (100 gold + 3 of its item), increments `passport.level` and `learner.level`, appends the id to `learner.completed`, sets `lastTx` to a fake hash with url `https://testnet.nearblocks.io/txns/<hash>`. Otherwise reject with the Error message exactly `"Wrong answer"`.
- Merchant prices, computed from Bloq's stock `s` of that item with `base = 100`, `halving = 40`, `spread = 250` bps:
  `buy_price = floor(base * halving / (halving + s))` (what Bloq pays you per unit) and `sell_price = floor(buy_price * (10000 + spread) / 10000)` (what Bloq charges you). Multi-unit trades are priced one unit at a time as the stock changes. `sellToBloq` moves items to Bloq and gold to the learner; `buyFromBloq` the reverse; reject with `"Not enough gold"` / `"Bloq does not have enough stock"` when appropriate. `shop_open` is `bloq.gold >= treasury_floor` (500). `graduation_fee` = sum of the three current `sell_price`s.
- `graduate()`: requires `level === 3`, at least one of each item and `gold >= graduation_fee`; otherwise reject with `"Finish all three quests first"` / `"You need one of each item to graduate"` / `"Not enough gold for the fee"`. On success moves one of each item and the fee to Bloq and sets `graduated = true` on learner and passport.
- Every change sets `busy` true while "waiting" and false after; errors set `error` to the message verbatim.
- `exportSecretKey()` returns a fake `ed25519:5K…` string. `explorer.*` return nearblocks testnet URLs.

### Lesson content (ship as `src/game/lessons.json` and use it in the mock; the real build reads the same shape from the chain)

```json
[
  { "lesson_id": "the-vault", "title": "The Vault", "topic": "Cryptographic keys",
    "concept": "Your public key is like your home mailbox: anyone can see it and drop a letter inside. Your private key is like your actual mailbox key: only you hold it, and if you lose it, you can never unlock your mail again.",
    "question": "If someone wants to safely send you digital gold, which one do you share with them?",
    "options": ["Your private key", "Your public key", "Your seed phrase"], "answer": "Your public key",
    "reward_gold": "100", "reward_item": "key-fragment", "reward_item_amount": "3",
    "success": "You unlocked the vault. +100 gold and 3 Key Fragments minted to your account.",
    "near_reveal": "The account that just received them is yours on NEAR. You never typed a seed phrase: the app created the account and holds a key that can only play this game." },
  { "lesson_id": "the-fuel-system", "title": "The Fuel System", "topic": "Network gas",
    "concept": "Every action on a decentralized network needs computer power. Gas is the small fee paid to the computers that keep the system running. No fuel, no movement: a transaction without gas stalls.",
    "question": "True or false: when a network is busy, gas fees generally go down.",
    "options": ["True", "False"], "answer": "False",
    "reward_gold": "100", "reward_item": "fuel-cell", "reward_item_amount": "3",
    "success": "You fueled the engine. +100 gold and 3 Fuel Cells minted to your account.",
    "near_reveal": "Look at the transaction link: the gas for it was paid by Bloqvia's relayer, not by you. That is a NEAR meta-transaction: you signed, we paid." },
  { "lesson_id": "smart-agreements", "title": "Smart Agreements", "topic": "Smart contracts",
    "concept": "A smart contract is a vending machine made of code. Put in exactly what it asks for and it hands out the product by itself. No shopkeeper, no one to argue with, and the rules are printed on the machine for everyone to read.",
    "question": "You sell an item to Bloq the merchant. What decides the price and moves the gold?",
    "options": ["A Bloqvia employee", "A smart contract", "Bloq's mood"], "answer": "A smart contract",
    "reward_gold": "100", "reward_item": "contract-seal", "reward_item_amount": "3",
    "success": "Pipeline cleared. +100 gold and 3 Contract Seals. Bloq's shop is open to you.",
    "near_reveal": "Bloq's prices come from one rule in the contract. Nobody at Bloqvia can change a price by hand; only what players sell and buy moves it." }
]
```

## Screens (React Router, one route each)

1. **Landing `/`** — a real website front door, responsive:
   - Sticky top bar: a custom "B" logo badge in the Solarpunk palette (a leaf-shaped B), the name Bloqvia, and a prominent **Start Learning** button; after sign-in the bar shows a small profile marker with the account's first letter instead.
   - Large centered hero: headline "Learn Web3 by playing it." and sub-line "No wallet, no jargon, real rewards. Three short quests, one merchant, a Passport that's yours." An email field and the **Start Learning** button that calls `start()`; while busy show "Setting up your account…" with a gentle growing-vine animation. On success go to `/map`.
   - A 3-column feature section (stacked on phones) with simple vector icons (lucide-react): **Start with just an email** — "No seed phrase, no app to install." / **Play three quests, earn real items** — "Every reward is really yours, not points in a database." / **Graduate with a Passport nobody can buy** — "Your progress becomes a credential that can't be sold or faked."
   - Footer: "Built on NEAR · NEAR Hackathon 2026" with a link to the public repository (placeholder href). This footer line is the only place before the reveal where the blockchain is named.
2. **Map `/map`** — a winding path with three quest nodes (The Vault, The Fuel System, Smart Agreements): done / available / locked states, in order. A compact Passport card at the top (ring with level 0–3, "Graduate" state) and a gold + items counter. At the bottom, **Bloq's shop** card: locked until level 3 ("Finish the three quests to meet Bloq"), then a button to `/shop`. Tapping an available node opens the Quiz.
3. **Quiz (modal/sheet over the map)** — topic chip, `concept` text, `question`, option buttons; tapping an option calls `completeLesson(lesson_id, optionText)`. On error show `error` verbatim in a terracotta toast and let them try again. On success: confetti-light celebration, `success` text, the reward chips, a small card titled "What just happened on NEAR" with `near_reveal` and an external link "See it on the explorer" → `lastTx.url`. Button "Back to the map".
4. **Shop `/shop`** — Bloq, a friendly merchant character (illustrated with simple shapes, Solarpunk palette), a speech bubble with his current mood line based on stock. Three item rows: name, your amount, Bloq's stock, **he pays** `buy_price`, **he charges** `sell_price`, with a Sell and a Buy button and a quantity stepper. An info icon on the price opens a tooltip: "Bloq pays less for what he already has a lot of: price = 100 × 40 ÷ (40 + his stock). Nobody can change this rule by hand." A banner when `!shop_open`: "Bloq's treasury is below 500 gold — shop closed until it refills." A **Graduate** card at the bottom: checklist (3 quests, one of each item, fee of `graduation_fee` gold) with ticks, and a button that calls `graduate()`; on success go to `/reveal`.
5. **Passport `/passport`** — the credential full-screen: level ring, three quest stamps, "Non-transferable" badge, Graduate state with a gold seal; link "View on the explorer" → `explorer.passport(accountId)`.
6. **Reveal `/reveal`** — the aha moment. Headline: "It was on NEAR the whole time." Three cards: *Your account* (`accountId`, link `explorer.account`), *Your Passport* (link), *Your key* (masked, Copy button, warning that whoever holds it controls the account, "Import it into any NEAR wallet"). Below, a timeline of what happened (sign-in, three quests, trades, graduation) each with "View transaction". A final line: "Thanks for playing. Everything you earned is yours."

Persistent bottom nav (Map, Shop, Passport) on `/map`, `/shop`, `/passport`. A small `busy` indicator and a toast for `error`. Use `lastTx` to show a short "Saved on NEAR ✓" confirmation after each successful action — but on screens before the reveal, keep that wording and nothing more technical.

Start with the Landing and Map screens, then the Quiz, then the Shop, Passport and Reveal. Ask me before adding anything outside the list.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1ace3ff8-eade-482b-9466-adce66b51217).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
