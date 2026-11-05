# Lovable prompt 7 — the daily quest on the map

Sent 2026-11-05 via MCP. Context for the agent: `main` is at b3b7be1 (daily
quest part 1: `src/near/useDailyQuests.ts`, `GET /quests`, quests on chain).

---

A new feature landed in `src/near/` and needs its UI. Read `src/near/useDailyQuests.ts` and the `DailyQuest` / `GeneratedBy` types in `src/near/types.ts` first. Do not edit anything under `src/near/`.

**What it is.** Once a day an AI agent on NEAR AI Cloud writes one bonus quest. The relayer validates it, hashes the answer and stores the quest on the Bloqvia contract like any lesson, together with the model's cryptographic signature. `useDailyQuests()` returns `{ quests, loading, error }` read straight from the chain, newest first. Each quest has `lesson_id` (`daily-YYYY-MM-DD`), `title`, `topic`, `concept`, `question`, `options` (3), `success`, `near_reveal`, `explanation`, `reward_gold`, `reward_item`, `reward_item_amount` and `generated_by` (`model`, `chat_id`, `request_sha256`, `response_sha256`, `signature` with `signature_kind`, `generated_at`). There is no `answer` field: the chain verifies the answer when the player completes the quest through the normal `game.completeLesson(lesson_id, option)`. Completing a daily quest gives gold + 1 item but does **not** raise the Passport level; `learner.completed` will contain the daily id, `learner.level` will not change.

Build three things.

**1. MapPage (`src/pages/MapPage.tsx`) — fix availability, add the card.**
- `learner.completed` can now contain ids that start with `daily-`. Derive `const foundingDone = completed.filter((id) => !id.startsWith("daily-"))` and use `foundingDone.length` everywhere the code currently uses `completed.length` (the `available` rule `i === completed.length` and the "Three quests. One merchant…" hint). Without this, finishing a daily quest would lock the next founding quest.
- Add a `DailyQuestCard` (new file `src/components/lab/DailyQuestCard.tsx`) rendered directly under `<StreakCard />` in the top stack, same card language as StreakCard (navy card, lavender labels, lime accents). It uses `useDailyQuests()` and `useGame()`.
  - Hidden entirely in mock mode: export `export const IS_MOCK = useMock;` from `src/game/useGame.ts` and return `null` when `IS_MOCK` is true (the mock cannot verify an AI-written answer). Also render nothing when `quests.length === 0` and not loading.
  - While `loading`: a one-line skeleton, no spinner.
  - Otherwise show the newest quest `q = quests[0]`. Label: "Today's quest" when `q.lesson_id.slice(6)` equals today's UTC date (`new Date().toISOString().slice(0, 10)`), else "Latest quest" with the date formatted like "5 Nov" (`new Date(date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })`). Then `q.title`, `q.topic` as a small chip, and the reward (`RewardChip` for gold `q.reward_gold` and for `q.reward_item` × `q.reward_item_amount`, from `./GameBits`).
  - If `learner.completed.includes(q.lesson_id)`: a lime check and "Done — a new one arrives tomorrow"; the Play button becomes disabled text.
  - Else a lime `Press` button "Play" that calls the same `openQuest(q.lesson_id)` the map nodes use (pass it in as a prop `onPlay`). It must work even before the founding quests are done — daily quests are never locked.
  - A footer line in small lavender text: "Written by an AI agent on NEAR AI Cloud" + (when `q.generated_by.signature?.signature_kind === "provider_tee"`) " · signed in a TEE", followed by a link "Verify" (`https://cloud.near.ai/verify`, new tab, `rel="noreferrer"`, `ExternalLink` icon 3.5). Keep this one line on a 360px-wide phone (wrap allowed, no overflow).
  - If `error` is set, render nothing (the map must never break because the quest feed did).

**2. QuizSheet (`src/components/QuizSheet.tsx`) — play daily quests.**
- Resolve the content from both sources: `const daily = useDailyQuests().quests.find((q) => q.lesson_id === lessonId);` and `const founding = LESSON_CONTENT.find(...)`; `const lesson = daily ?? founding`. Widen the local type so `answer` is optional (the sheet never reads it) and `explanation` / `generated_by` are optional. If neither exists, render nothing and call `onClose()` in an effect.
- Header: for a daily quest replace "Chapter N" with "Daily quest · 5 Nov" (same date formatting as above). The lime path / level ring must not react to a daily completion (it keys off `learner.level`, which does not change — do not add anything that assumes a level bump).
- Success state: keep "What just happened on NEAR" with `lesson.near_reveal`. For a daily quest add, under it inside the same navy box, a provenance block: a lavender label "Who wrote this quest", one sentence "An AI agent (`{generated_by.model}`) on NEAR AI Cloud wrote it; the relayer hashed the answer and stored the quest on the Bloqvia contract, so your answer was checked by the chain, not by the AI." then a monospace line `chat {chat_id}` (full id, `break-all`) and a "Verify the signature" link to `https://cloud.near.ai/verify` (new tab). When `signature_kind === "provider_tee"` append "Signed inside a TEE (hardware enclave) by the model's provider." in `text-ivory/70`. The existing explorer link stays.
- Wrong answers for daily quests show `lesson.explanation` exactly like founding ones (already supported).

**3. Keep the rules.** No new dependencies. SSR-safe (TanStack Start renders on the server: no `window`/`document` at render time; the date check runs in render but uses only `Date`, which is fine). Honour `useReducedMotion` like the rest of the lab. Use `Press` for buttons, `cn` for classes, existing tokens (`bg-navy`, `text-lavender`, `bg-lime`, `shadow-lift`). Do not change `src/near/*`, `src/game/mockGame.ts`, the relayer or the contracts. Do not touch StreakCard, PassportCard or the shop.

When you are done, tell me which files you changed and confirm: (a) `foundingDone` is used for availability and the hint, (b) the card is hidden in mock mode, (c) the QuizSheet resolves daily content before founding content.
