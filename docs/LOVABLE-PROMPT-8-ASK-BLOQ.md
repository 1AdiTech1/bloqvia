# Lovable prompt 8 — Ask Bloq

Sent 2026-11-05 via MCP, after the commit "Ask Bloq: grounded, signed answers
from NEAR AI Cloud (relayer + hook)" reached `main` (`src/near/useAskBloq.ts`,
`relayerApi.ask`, `AskResult`).

---

A second NEAR AI feature landed in `src/near/` and needs its UI: **Ask Bloq**. Read `src/near/useAskBloq.ts` first. Do not edit anything under `src/near/`.

**What it is.** The player can ask Bloq the merchant a question in plain words. The relayer sends it to a model on NEAR AI Cloud that answers only from Bloqvia's own rules and the lesson texts (it cannot see balances, never gives quest answers, never talks about money) and returns plain text with the model's chat id and signature kind. `useAskBloq()` returns `{ question, answer, provenance, loading, error, ask(question, lessonId?), reset() }`; `provenance` is `{ model, chat_id, signature_kind }` or null. State is local to the component that calls the hook — every sheet is its own conversation.

Build:

**1. `AskBloqSheet` (new, `src/components/lab/AskBloqSheet.tsx`).** A bottom sheet in the same language as `QuizSheet` (ivory, rounded top, drag handle, close button, `role="dialog"`, Escape closes), stacked **above** the quiz sheet (`z-[55]`), max width 480, `max-h-[85vh]`, scrollable. Props: `{ open: boolean; onClose: () => void; lessonId?: string; context: "quiz" | "shop" | "map" }`.
- Header: Bloq's avatar from `src/components/Bloq.tsx` (small), title "Ask Bloq", a one-line subtitle "Plain-words answers from Bloq. He explains; he never hands out quest answers."
- Three suggestion chips (tap = send at once) chosen by `context`:
  - quiz: "Explain this another way", "Why does this matter on NEAR?", "What should I pay attention to?"
  - shop: "Why did the price change?", "What is the 2.5% spread?", "Why does the shop close?"
  - map: "What is the Passport?", "How does the streak work?", "Who pays my gas?"
- A text input (`maxLength={300}`, `enterKeyHint="send"`, Enter submits, placeholder "Ask about keys, gas, contracts, prices, the Passport, the streak…") with a lime `Press` send button (disabled while `loading` or when empty).
- While `loading`: `LabLoader` with label "Bloq is thinking…".
- Answer state: the player's question in muted small text, then Bloq's answer in a navy speech card (`bg-navy text-ivory`, 15px, relaxed leading), then a footer line in small lavender: "Answered by an AI on NEAR AI Cloud" + (when `provenance.signature_kind === "provider_tee"`) " · signed in a TEE" + a "Verify" link to `https://cloud.near.ai/verify` (new tab, `rel="noreferrer"`) and, under it, `chat {chat_id}` in monospace `break-all` `text-navy/50`. A ghost `Press` "Ask another" calls `reset()` and focuses the input.
- Error state: the `error` text in a coral-left-bordered box (same style as the wrong-answer box in QuizSheet), e.g. "Too many requests, slow down" or "Ask Bloq is off: …". No retry loop; the input stays usable.
- On `onClose` call `reset()`.

**2. Entry points.**
- `QuizSheet`: under the concept paragraph (above the question), a small ghost button with a `MessageCircle` icon: "Ask Bloq about this". It opens `AskBloqSheet` with `context="quiz"` and `lessonId={lessonId}`. Do not show it in the success state.
- The shop page (where Bloq's prices and the ⓘ price-rule tooltip live): next to the tooltip or under the price list, the same button labelled "Ask Bloq why prices move", `context="shop"`.
- MapPage: under the shop-door copy at the foot of the map ("Finish the three quests to meet Bloq" / "Enter Bloq's shop"), a text button "Ask Bloq a question", `context="map"`. Leave StreakCard and DailyQuestCard as they are.
- Hidden entirely in mock mode (`IS_MOCK` from `src/game/useGame.ts`): the mock has no relayer.

**3. Keep the rules.** No new dependencies. SSR-safe (no `window`/`document` at render). `useReducedMotion` for the sheet motion. `Press` for buttons, `cn`, existing tokens. Do not change `src/near/*`, `src/game/mockGame.ts`, the relayer or the contracts. Do not touch StreakCard, PassportCard or DailyQuestCard.

When done, list the files you changed and confirm: (a) the sheet is above the quiz sheet and closes with Escape, (b) chips send immediately, (c) the Verify link and chat id show only when `provenance` is present, (d) nothing renders in mock mode.
