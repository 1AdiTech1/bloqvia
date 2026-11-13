# Prompt 40 — the sponsored quest band, Bloq's extra stop, the checklist row, and the traders' signal line

Read first: `src/near/useSponsoredQuest.ts`, `src/near/useAfterSeasons.ts` (it now has a `sponsored` step),
`src/near/useMarket.ts` (TraderView has `signal` and `purse`), `src/components/lab/DailyQuestCard.tsx`,
`src/components/lab/AfterSeasonsCard.tsx`, `src/components/QuizSheet.tsx`, `src/pages/MapPage.tsx`,
`src/pages/ShopPage.tsx`. Four changes, all additive. Keep every existing behaviour, class, animation and
copy exactly as it is; add, never remove. The name is always written "Bloqvia" and "Bloq", never in capitals
(labels that are uppercase by CSS are fine).

## 1. `SponsoredQuestCard` (new file `src/components/lab/SponsoredQuestCard.tsx`)

The day's sponsored quest: one slot a day on the map, sold over x402; `useSponsoredQuest(completed)` gives
`{ quest, done, loading, error }`. `quest` is null on a day nobody bought the slot: then render **nothing**
(no placeholder). In mock mode (`IS_MOCK`) render nothing, like `DailyQuestCard`.

Props: `{ onPlay: (lessonId: string) => void; highlight?: boolean }`, same as `DailyQuestCard`.

It is a **wide band**, not a square card: the same `<section>` classes as `DailyQuestCard`
(`rounded-[1.6rem] border border-ivory/10 bg-navy-soft p-5 text-ivory shadow-lift`), and inside it a grid
`grid-cols-1 dk:grid-cols-[minmax(0,1fr)_250px] dk:gap-x-5 dk:items-start`:

Left column (the quest, in this order, same classes as the daily card's elements):
- the label row: `<p class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-lavender">` with a dot `h-2 w-2 rounded-full` **purple** (`bg-purple`, with `shadow-[0_0_8px_rgb(180_127_240/.9)]`) and the text `Sponsored quest`; on the right the topic chip exactly as the daily card's (`truncate rounded-full bg-lavender/20 px-2.5 py-1 text-[11px] font-medium text-lavender`).
- `<h3>` with the daily card's classes: `quest.title`.
- `<p class="mt-2 line-clamp-2 text-[14px] leading-snug text-ivory/80">` `quest.concept`.
- the two reward chips **on one line** with `mt-3 flex flex-wrap gap-2.5`: `<RewardChip id="gold" amount={quest.reward_gold} />` and `<RewardChip id={quest.reward_item} amount={quest.reward_item_amount} />`.
- then, **18px below the chips** (`mt-[18px]`): when `done` the daily card's done line (`✓ Done — thanks for playing` with the same Check icon and classes, min-h 44px); otherwise the Play button with the daily card's classes but **not full width**: `w-[200px]` on desktop (`w-full dk:w-[200px]`), and the same `highlight` pulse class as the daily card's Play.

Right column (the sponsor; on phones it comes under the left column with `mt-4`):
- a box `rounded-xl bg-navy/80 px-3 py-2 text-[11.5px]`: a row `flex items-center gap-2` with a square `h-[18px] w-[18px] rounded-md bg-gradient-to-br from-purple to-purple-d` and `Brought to you by <b>{quest.sponsor.name}</b>` (when `quest.sponsor.url` is set, the name is a link to it, `target="_blank" rel="noopener noreferrer"`); under it a mono line `font-mono text-[10px] text-lavender mt-1`:
  - when `quest.sponsor.house` is true: `nobody bought today's slot, so Bloqvia's own purse did: {quest.slot.price} · x402 · explorer ↗`
  - otherwise: `paid {quest.slot.price} for today's slot · x402 · explorer ↗`
  where `explorer ↗` links to `explorer.tx(quest.slot.tx_hash)` (from `@/near`) when `tx_hash` is set.
- under the box, `mt-2.5 text-xs leading-relaxed text-lavender`: `Written by the sponsor · checked by Bloqvia's validator · answer hashed on chain · ` then in lime semibold `the reward is the contract's, not the sponsor's`. When `quest.sponsor.house` is true the first words are `Written by Bloqvia · ` instead of `Written by the sponsor · `.

The glow (rule: like the sealed Passport): the section gets, always, `ring-1 ring-purple/45 shadow-[0_0_28px_rgb(180_127_240/.35),0_18px_40px_rgb(0_0_0/.35)]`, and a slow sheen: an absolutely positioned `<i aria-hidden>` inside (`pointer-events-none absolute inset-[-40%_-60%]`, `background: linear-gradient(115deg, transparent 42%, rgb(255 255 255 / .10) 50%, transparent 58%)`), animated `translateX(-12%) → translateX(12%)` over 7 s, ease-in-out, alternate, infinite; the section gets `relative overflow-hidden`; `motion-reduce:animate-none`. When `highlight` is true, add the daily card's highlight ring too (`ring-2 ring-lime shadow-[0_0_26px_rgb(212_240_51/.22)]`) — lime wins over purple while Bloq sits on it.

## 2. The map (`src/pages/MapPage.tsx`)

In the after-seasons block (`after.active`), the grid `#keep-going` keeps its two columns. Between the
`dailyBox` div and the `listBox` div add:

```tsx
<div ref={sponsoredBox} className="min-w-0 empty:hidden dk:col-span-2 dk:mt-[16px]"><SponsoredQuestCard onPlay={openQuest} highlight={tourOn && after.next === "sponsored"} /></div>
```

(`const sponsoredBox = useRef<HTMLDivElement>(null);` next to `dailyBox`). The band spans both columns; the
`listBox` keeps `dk:col-span-2` and its `dk:mt-[84px]` becomes `dk:mt-[16px]` **only when the band is present**
(`after.sponsored.available`), otherwise unchanged. On phones the band sits in the same column flow with the
existing `gap-[100px]`.

In the non-after-seasons block (the plain two cards) add `<SponsoredQuestCard onPlay={openQuest} />` after
`<DailyQuestCard …/>`, with the wrapper `className="min-w-0 empty:hidden dk:col-span-2"`.

Bloq's tour: `AfterStep` now includes `"sponsored"` (between `daily` and `missions`; `after.next` already
returns it). Add to `LINE`:

```ts
sponsored: "One more quest today, and somebody paid for its slot: a sponsored quest. Read who, on the card. The chain checks your answer like any quest, and the reward is mine, not theirs.",
```

`boxFor("sponsored")` returns `sponsoredBox.current`. `spotFor` works unchanged (he sits at the band's top
right edge). The hop from the daily card to the band is a **leap** (the rows differ, so the existing branch
handles it: `Math.abs(from.y - spot.y) >= 8`). The hop from the band to the list is a leap too. Nothing else
in the tour code changes. In `PhoneShell`'s `glow` nothing changes.

## 3. The checklist (`src/components/lab/AfterSeasonsCard.tsx`)

After the `Play today's quest` row add:

```tsx
{after.sponsored.available && <Row done={after.sponsored.done} label="Play the sponsored quest" action={<button type="button" onClick={onPlaySponsored} className={ACT}>Play ↑</button>} />}
```

New prop `onPlaySponsored: () => void` (MapPage passes `() => scrollTo(sponsoredBox.current)`). `allDone`
also requires `(!after.sponsored.available || after.sponsored.done)`.

## 4. The quiz sheet (`src/components/QuizSheet.tsx`)

Resolve the lesson from one more source: `const sponsored = useSponsoredQuest().quests.find((q) => q.lesson_id === lessonId);` and `const lesson = daily ?? sponsored ?? chapter ?? founding;`. For a sponsored lesson:
- the look is `{ hat: "tophat", prop: "coin", hello: "A sponsored quest: somebody paid for this slot. The chain still checks your answer, and the reward is mine." }`;
- the small uppercase label next to the topic chip reads `Sponsored quest · {formatQuestDate(date)}` where `date` is `lessonId.slice(6, 16)`;
- in the success panel ("What just happened on NEAR"), instead of the `gen` block, a block with the same classes titled `Who paid for this quest`: `{quest.sponsor.name} paid {quest.slot.price} for today's slot over x402 (HTTP 402); the payment is a token transfer on NEAR testnet.` then, when `tx_hash` is set, a lime link `See the payment on the explorer` to `explorer.tx(tx_hash)`; then `Bloqvia's validator checked the quest and the contract paid the reward: the sponsor never touches rewards.` When `quest.sponsor.house` is true the first sentence reads `Nobody bought today's slot, so Bloqvia's own purse paid {price} for it over x402; the payment is a token transfer on NEAR testnet.`

## 5. Market · live (`src/pages/ShopPage.tsx`, `TraderVoice` and `TraderChip`)

`TraderView` now has `signal: { at, ok, cost, txHash, note } | null` and `purse: string | null`. In
`TraderVoice`, after the existing proof line (`<small>` with the account, the TEE line, Verify, allowed), add a
second line in the same `<small>` style (`mt-1 block font-mono text-lavender`, 10.5px) when `tr.signal` is set:
- `ok`: in lime (`text-lime`): `bought the desk's signal for {signal.cost} · x402 · ` + a link `explorer` to `explorer.tx(signal.txHash)`;
- not ok: in coral (`text-coral`): `the purse refused the signal: {signal.note without the leading "the purse refused the signal (" and the trailing ")"}` — if the note does not have that shape, show it as is.

The footer sentence under the three voices becomes: `three NPC traders, each an agent on NEAR AI Cloud that may only pick from the moves its rules allow · each buys its information from the market desk over x402, from a purse with a daily budget · next look in {n} min`. `TraderChip` is unchanged.

## Checks

- A day with a sponsored quest on chain (there is one today, bought by the house purse): the band shows under the two cards on desktop and under the daily card on phones, the purple glow and the sheen move slowly, "Brought to you by Bloqvia" with the house line and the explorer link; Play opens the quiz sheet with Bloq in the top hat; after the answer the success panel shows "Who paid for this quest" with the explorer link; the Keep going list has "Play the sponsored quest"; Bloq, on his tour, leaps from the daily card to the band and says the new line, then to the list.
- With no sponsored quest for today (`useSponsoredQuest().quest === null`): the map is exactly as before this prompt.
- The shop's Market · live shows the lime signal line under the bull and the bear (they buy every look), a coral refusal when a purse is empty or over budget.
- `npm run build` passes; no change to `src/near/`, `relayer/`, `src/bloq/`.
