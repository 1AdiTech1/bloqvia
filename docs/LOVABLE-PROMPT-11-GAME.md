# Lovable prompt 11 — the game screens, redesigned around the animated Bloq

Approved design: `docs/design/game-v2/index.html` (open it; it is a clickable phone app with a demo state).
Send the three parts one at a time; review each before the next.

**Rules for every part.**
- **Don't touch the logic or the Bloq and chain code.** Do not edit `src/bloq/*` or `src/near/*`. Do not change any game logic, contract call, reward, price or balance: this is looks only. Every button keeps calling what it calls today.
- **Use the ready-made pieces.** Bloq and the new pieces come from `@/bloq` (`Bloq`, `SpeechBubble`, `useSay`, `talkMs`, `AgentPod`, `ChainTrail`). The block height comes from `useFinalBlock()` in `@/near`. Read `src/bloq/README.md` first.
- **Hats:**
  - One Bloq per screen, plus the AI agent in his window.
  - Never the same hat twice on a screen.
  - The AI agent always wears `agent` and only appears through `AgentPod`.
- **Fuel / gas is always a battery,** lucide `BatteryCharging`, everywhere: in the game and on the landing. Never a flame or a pump.
- **Strict TypeScript and reduced motion.** Keep the strict config passing. With reduced motion, every Bloq stays visible and still.

---

## Part A — the game shell, the AI agent dock (game and landing), icons, names

1. **Icons** (`src/components/GameBits.tsx`):
   - In `ITEM_ICONS`, use `"key-fragment": KeyRound`, `"fuel-cell": BatteryCharging` and `"contract-seal": FileCheck2` (all from lucide).
   - On the landing (`src/pages/Landing.tsx`), the Fuel System chapter tile uses `BatteryCharging` instead of `Fuel`.
   - In "Your progress", the Fuel Cell item uses `BatteryCharging`.
   - Anywhere else a fuel icon is drawn (the daily quest card's reward chips, for example), use `ItemIcon`, so it's the battery.
2. **Rename "Cohort" to "Missions" everywhere a player reads it:**
   - the bottom tab
   - the page title (`<h1>Missions</h1>`)
   - the route's `head()` title, which becomes "Missions — Bloqvia"
   - the DAO card label, which becomes "Bloqvia DAO"
   - any button or link that says Cohort

   **Keep the route path `/cohort`** and all file and component names as they are. The shop stays "Shop".
3. **Header on the game screens** (in `PhoneShell` when `nav` is true):
   - On the left, `<BloqviaLogo />` with the name in ivory, at 30px.
   - On the right, a small ivory pill that links to `/passport`. It holds the passport `LevelRing` at 34px, a tiny "PASSPORT" label, and the level text: "Level n", or "Ready to graduate", or "Graduate".
   - Keep the existing `data-inv="ring"` on the ring so the reward flights still land on it.
   - On the Map, remove the old big `PassportCard` at the top (the header pill replaces it).
4. **Bottom bar with the AI agent docked bottom-right** (in `PhoneShell`):
   - The four-tab pill keeps its look and shrinks to `flex: 1`.
   - To its right, a 62px round button (`aria-label="Ask Bloq, the AI agent"`, `aria-haspopup="dialog"`) holds `<AgentPod size={58} ref={pod} />`.
   - The button also has a 13px lime "online" dot at its bottom-right, ringed in navy and pulsing.
   - On desktop, hovering shows a small ivory tip above it: "Ask Bloq · AI agent".
   - Tapping it opens the existing `AskBloqSheet`, with the context set by the route:
     - `/map` → "map"
     - `/shop` → "shop"
     - `/cohort` → "missions"
     - `/passport` → "passport"
   - Every 14s, while the sheet is closed and the tab is visible, call `pod.peek()`.
   - Hide the agent button wherever the nav is hidden (the Reveal).
   - Add `"missions"` and `"passport"` to `AskBloqSheet`'s contexts, with these chips:
     - missions: "How do mission rewards get paid?", "What is a DAO vote?", "Who checks that I qualified?"
     - passport: "What does soulbound mean?", "How does my Passport level up?", "Can I sell my Passport?"
5. **The agent's face is always the window:**
   - In `AskBloqSheet`, replace `BloqCharacter` in the header with `<AgentPod size={52} />`. Give the header row about 18px of top padding, so his head has room to lean out.
   - In `AskBloqButton`, replace the `MessageCircle` icon with `<AgentPod size={32} />`.
   - While an answer shows, call the header pod's `talk(talkMs(answer))`.
   - The old `BloqCharacter` stays only where nothing else uses it yet; parts B and C remove it from the Shop.
6. **Restyle the inventory bar** to match the design: a navy-2 strip with a 20px radius.
   - Gold sits in a navy chip with the gold disc.
   - Each item sits in a lavender-card chip with its icon and count, using `font-display` numbers.
   - When a value changes, the chip does a small spring bump (`scale 1.18`, .5s).

7. **The landing's Ask Bloq dock and chat** (`src/components/brand/AskDock.tsx`) get the same window:
   - In the dock button, replace the cropped `lv-ask-face` circle with `<AgentPod size={48} ref={dockPod} />`.
   - In the chat header, replace it with `<AgentPod size={40} ref={chatPod} />`.
   - Remove the `.lv-ask-face` crop styles from `src/styles.css` (the `overflow: hidden` circle and the offset inner box). `AgentPod` draws its own ring.
   - Give the dock pill about 6px more top room, so his head can lean out over the edge on hover.
   - Every 14s while the chat is closed, call `dockPod.peek()` instead of the face's `jump()`.
   - While an answer types, call `chatPod.talk(talkMs(answer))`.
   - Keep everything else in the dock and chat exactly as it is: the real `useAskBloq` answers, the provenance line, Esc, and focus.

Confirm when done:
- The battery icon shows in the inventory, the shop, the landing chapter tile and the landing's "Your progress" Fuel Cell.
- The AI agent leans out of his window on the landing dock, the landing chat, the game dock and the Ask Bloq sheet.
- The tab reads Missions and `/cohort` still works.
- The dock opens the sheet with the right chips on each tab, and Esc closes it.
- There's no sideways scroll at 360px.
- Nothing in `src/bloq/` or `src/near/` changed.

---

## Part B — the Map as a NEAR world, and Bloq in the quest sheet

1. **Map** (`src/pages/MapPage.tsx`):
   - Keep `InventoryBar`, `StreakCard` and `DailyQuestCard` and what they do. Restyle the daily quest card as the navy-2 card in the design. Its eyebrow is "Today's quest", with a lime dot.
   - Then add the eyebrow "Your journey" and the h2 "Three quests. One merchant. A Passport that's yours."
   - **Replace** everything from the winding SVG path to the end of the trail with `<ChainTrail />`. That means the stops, the "You are here" marker and `ShopDoor`.

   ```tsx
   const height = useFinalBlock();
   const [trailLevel, setTrailLevel] = useState(foundingDone.length); // what the trail shows
   <ChainTrail
     ref={trail}
     level={trailLevel}
     blockHeight={height}
     onPlay={(i) => { const l = LESSON_CONTENT[i]; if (l) openQuest(l.lesson_id); }}
     doorAccount="bloq.bloqvia.testnet"
     stops={[
       { id: "the-vault",        title: "The Vault",        kind: "vault",    post: "keys · ed25519",         reward: <ItemIcon id="key-fragment" /> },
       { id: "the-fuel-system",  title: "The Fuel System",  kind: "battery",  post: "gas · the relayer pays", reward: <ItemIcon id="fuel-cell" /> },
       { id: "smart-agreements", title: "Smart Agreements", kind: "contract", post: "core.bloqvia.testnet",   reward: <ItemIcon id="contract-seal" /> },
     ]}
     door={<>
       <p className="text-sm text-lavender">{trailLevel >= 3 ? "Bloq's shop is open to you." : "Finish the three quests to meet Bloq the merchant"}</p>
       {trailLevel >= 3 && <Link to="/shop" className="…lime button…">Enter Bloq's shop</Link>}
       <AskBloqButton label="Ask Bloq a question" onClick={() => setAsking(true)} />
     </>}
   />
   ```

   - Take the stop ids from `LESSON_CONTENT`, in order. The three `kind`s and `post`s are exactly as above.
   - **Walking.** In `close()` (when the quest sheet closes), call `setTrailLevel(foundingDone.length)` after the sheet's exit, about 450ms. Bloq then walks the road to the next block in view. Don't raise `trailLevel` while the sheet is open.
   - The daily quest doesn't move the trail.
   - The shop door opens when `trailLevel >= 3`. Use the same condition the old `shopOpen` used.
   - **Header ring timing.** Give `PhoneShell` an optional `headerLevel?: number` prop that the header pill shows instead of `passport.level` when it's set. The Map passes its held `level` (the `heldLevel ?? learner.level` it already computes), so the ring ticks up only after the reward flight lands, as the old map card did.
2. **Bloq in the quest sheet** (`src/components/QuizSheet.tsx`):
   - A `<Bloq />` stands on the sheet's top edge, at the right: 104px wide, `position: absolute; right: 22px; top: 0; transform: translateY(-74%)`.
   - **Mount him outside the scrolling box.** The sheet panel scrolls (`overflow-y-auto`), and that would clip him. Wrap the panel in a `relative` div with no overflow, put Bloq in that wrapper, and keep the scrolling on the inner panel.
   - Give him a `SpeechBubble` (light tone) on his left, with `side="left"` on wide screens and above him on phones; the component handles that.
   - He wears the chapter's hat and holds its prop, the same as on the landing:
     - The Vault → `captain` + `key`
     - The Fuel System → `hardhat` + `fuel`
     - Smart Agreements → `beret` + `scroll`
     - A daily quest → `bucket` + `bulb`
   - Pose `hold`.
   - **On open,** after about 520ms: `jump()`, then say the chapter's hello:
     - The Vault: "Chapter one: keys. Read the idea, then pick one."
     - The Fuel System: "Hard hat on. This one's about gas, the fuel of the network."
     - Smart Agreements: "Last one: smart contracts. The rules are printed on the machine."
     - A daily quest: "Today's quest was written by an AI agent. The chain still checks your answer."
   - **While checking** (`game.busy && picked`): `setMood("o")` and `look(0, -0.8)`. Keep the `LabLoader` line, reading "Checking your answer on NEAR…".
   - **Wrong answer:** keep the shake and the explanation. Add `setMood("o", 1400)`, a small sideways shake of his wrapper (.5s), and the bubble "Oops, the contract said no. Read the hint below."
   - **Right answer:**
     - Pose `cheer`, `jump()` and `setMood("laugh", 2200)`.
     - A burst of 12 small spinning cubes (lime, `#b47ff0` and white, 10px, 1.5px ink border) from his hands.
     - The bubble "Yes! The contract checked it. Here come your rewards!"
     - The existing reward flights now **start from Bloq**: use his wrapper's rect (45% across, 35% down) as `from`, instead of the chips. They still land on `data-inv` targets.
     - After they land, pose `thumbs`.
   - Tapping him: `jump()` and `setMood("laugh", 800)`.
   - The "Ask Bloq about this" link uses the 32px `AgentPod` from part A.

Confirm when done:
- A quest plays end to end with real transactions.
- A wrong answer shows Bloq's "oh" face and the hint.
- A right answer flies the rewards from Bloq into the inventory.
- After closing the sheet, Bloq walks to the next block and the road lights up.
- After the third quest, the door opens and the merchant waves.
- The ticker shows a real block height.
- There's no sideways scroll at 360px, and reduced motion shows everything still.
- Nothing in `src/bloq/` or `src/near/` changed.

---

## Part C — Shop, Passport, Reveal, Missions

0. **Two fixes from part B** (`src/components/QuizSheet.tsx`):
   - Remove `key={`bloq-${oops}`}` from Bloq's wrapper. It re-creates Bloq on every wrong answer, so his "oh" face and talking mouth are lost the moment they're set. Shake the wrapper with `useAnimationControls()` instead (`controls.start({ x: [0, -7, 6, -4, 2, 0] })`), so the same Bloq stays mounted.
   - In `CUBE_COLORS`, use the brand lime `#d4f033` instead of `#C7F36B`.

1. **Shop** (`src/pages/ShopPage.tsx`):
   - **Replace** `BloqCharacter` and its speech card with **the stall**:
     - A navy-2 card (26px radius) with a scalloped awning across its top, in lime and `#8b45d9` stripes, as in the design.
     - Inside, a two-column row. On the left, `<Bloq hat="tophat" prop="cube" pose="hold" />` at 132px wide. On the right, an ivory speech card ("Bloq" label, display font, 1.02rem) showing `bloqLine(...)` exactly as today.
     - Under the row, a purple counter bar.
     - Then a mono line: "Treasury **{bloq.gold}** gold" on the left, "Shop **open**" or "**closed**" on the right (bold in lime).
   - **The merchant reacts to each trade**, after `onTraded(id)`:
     - **Sell:** `prop` = the item's prop (key / fuel / scroll), pose `hold`, `jump()`, `setMood("laugh", 1100)`. The speech card says "Thanks! My stock is {stock} now, so next time I pay {buy_price}."
     - **Buy:** `prop="coin"`, pose `thumbs`. The speech card says "Pleasure! I've got {stock} left, so the price goes up a little." After 2.6s, go back to `cube` and `hold`.
     - The stock and price are the values the contract now returns. After about 6s, the card goes back to `bloqLine`.
     - When the shop is closed: `setMood("o")` and the closed line.
     - Tapping him: `jump()`, and the card says "Sell me what I'm short on and I pay more. That's the whole rule."
   - Keep the trade cards, the price tip, the Ask link and the Graduate panel as they are, restyled with the tokens.
   - **The graduation ceremony overlay** now shows the **Web3 Passport card**, the same markup and styles as the landing's `lv-pass`, filled with this player's fields (see 2). It starts unsealed; after about 0.7s the seal stamps in (scale 1.8 → 1, rotate −30° → 0, spring) with a cube burst, then it goes to `/reveal` as today.
2. **Passport** (`src/pages/PassportPage.tsx`):
   - Replace the flat card with the **Web3 Passport card** from the landing (`lv-pass`), full width, aspect 1.5, filled from `game.passport`:
     - **Holder:** `owner_id`
     - **Level:** `n / 3`
     - **Status:** "In progress", "Ready to graduate" or "Graduate"
     - **Chain · standard:** "NEAR testnet · NEP-171 · soulbound"
     - **The rotating seal:** its centre (the three blocks) shows only when graduated. Before that, only the faint text ring.
     - **The MRZ strip:** two lines built from the account id and the level, ending in SEALED when graduated.
   - The card tilts toward the pointer as on the landing.
   - Under it, **three stamps** for the founding quests: dashed rings with a lock until done. When a quest is done, its stamp is a lime ink stamp with its `ItemIcon`, rotated −6°, 4° and −3°, with a spring-in.
   - Under the stamps, Bloq (120px) next to an ivory speech card:
     - **Before graduating:** `hat="aviator" prop="passport"`. Lines: "Empty for now. Your first quest adds a stamp." at level 0, "Level n! k more to go." at levels 1–2, and "Level 3! Now graduate in the shop." at level 3.
     - **After graduating:** `hat="grad" prop="badge"`, with the line "Sealed for good. This one can't be bought, sold or moved."
   - Tapping the card: Bloq `jump()`, and he says "It's an NFT that only levels up. The contract refuses transfers."
   - Keep "View on the explorer".
3. **Reveal** (`src/pages/RevealPage.tsx`):
   - Add Bloq the detective at the top right of the title: `hat="detective" prop="magnifier" pose="hold"`, 126px wide, with a light `SpeechBubble`.
   - The sequence:
     - At 0.6s: `setMood("o")`, `look(-0.6, 0.6)`, and he says "Hmm… every step left a trace on chain."
     - At 3.4s: `look(0, 0)`, pose `cheer`, `jump()`, `setMood("laugh", 1600)` and a cube burst.
     - At 4.6s: pose `thumbs`, and he says "Case closed: it was yours the whole time."
   - Everything else on the page stays.
4. **Missions** (`src/pages/CohortPage.tsx`):
   - Put the title in a two-column header: eyebrow "Graduates' board", h1 "Missions" and the subtitle on the left; on the right, `<Bloq hat="beanie" prop="badge" pose="hold" />` at 112px with a light `SpeechBubble`.
   - After 0.5s he says "You graduated. The board checks you qualified, then pays." if the player has graduated, otherwise "These open up once you graduate. The chain checks, not me."
   - Tapping him: "Small bounties are paid by the board. Big ones need a DAO vote."
   - Keep the DAO card (now "Bloqvia DAO") and the bounty cards exactly as they work today.

Confirm when done:
- Each screen has one Bloq with its own hat:
  - Map: cap and top hat (the guide and the merchant)
  - Quest sheet: captain, hard hat, beret or bucket
  - Shop: top hat (the merchant)
  - Passport: aviator, or grad after graduating
  - Reveal: detective
  - Missions: beanie
  - The agent everywhere: `agent`
- A sell and a buy make the merchant react with the real new stock and price.
- Graduating shows the sealing card, then the Reveal.
- The Passport page shows the real holder, level and stamps.
- Bubbles never leave the screen or cover text at 360, 820 and 1366px.
- There's no sideways scroll.
- Reduced motion shows everything still.
- Nothing in `src/bloq/` or `src/near/` changed.
