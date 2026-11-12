# Demo video v2 — direction, script and shot list (target 2 min 15 s)

Supersedes `DEMO-SCRIPT.md` for the recording of Nov 12. Picture: Claude drives bloqvia.app in Chrome
with scripted clicks (no cursor labels), Adi records the window; voice: ElevenLabs "Adam" from
`DEMO-NARRATION-v2-ELEVENLABS.txt`; burnt-in captions for muted autoplay on X.

## What the rules reward (nearhackathon.com/HACKATHON.md) and how the cut answers them

| Rule | In the video |
| --- | --- |
| "Show one complete moment": a real user action to a visible result; skip intros, slides, setup | One arc, first tap to NEAR in the wallet: tap → account → quest → market → graduate → the DAO pays. First frame is the app. |
| Games track: "judged on the game loop, not the token"; "bonus if players never notice the chain"; "NPCs with wallets, player-owned markets, economies that evolve without a dev patch" | The chain is only a panel at the edge until the reveal says it out loud ("It was on NEAR the whole time"). The merchant's price rule, the hourly shipping ("no dev patch"), three NPC traders with accounts, the price call. |
| X post: lead with the user problem, explain NEAR's role concretely, give a next step, ask a question | Opens on the problem; names what NEAR does (account, relayer pays, contract checks, NEP-245 items, Sputnik DAO); ends on the next step (the app's address). The question stays in the post text. |
| X without Premium caps a video at 2 min 20 s | 2:06, so the whole video sits in the post; the post is the demo link in the form and the README (no YouTube). |
| AI screening checks features for real | Every claim in the voice-over is a thing on screen with an explorer link or a panel row. |

Cut from v1: the long landing hold, "I'll show the chain each time" (the chain shows itself), the
founder window (one sentence over the DAO proposals list instead), the second explorer visit.
Added: the reveal as the climax, "no dev patch", captions.

## The strengths the voice-over carries, in order of weight

1. Onboarding with nothing in the way (tap, no wallet, no seed phrase, no gas) and the chain
   revealed only after it has been used.
2. A real economy from one readable contract rule, kept alive without patches (shipping), with
   NPC traders that have wallets and think, inside rules they cannot change.
3. AI with provable limits: TEE-signed text, never a reward, a price or a balance.
4. A credential that does something: the Passport seats you in a DAO whose board pays NEAR for
   what the chain can verify.
5. Everything checkable: explorer links on screen, README "do X, see Y", 112 tests, nine refusals.

## Shot list (what the picture does under each narration block)

| # | Narration block | Picture (hold ≈ 3 s on each state) |
| --- | --- | --- |
| 01 | Most people quit… one tap, and you're playing | Landing (2 s) → Start exploring → Create my account → "Creating your NEAR account…" |
| 02 | That tap made me a NEAR account… live block | Map with the On NEAR panel: account, "Gas you paid 0 NEAR", block height ticking |
| 03 | A quest is a question… paid by the relayer | The Vault → Your public key → Quest complete (+100, +3 Key Fragments, Saved on NEAR ✓) → explorer tab: Delegate action, signed by learner, gas by bloqvia.testnet |
| 04 | Today's quest was written this morning… | Today's quest card ("Written by an AI agent on NEAR AI Cloud · signed in a TEE") → Play → answer → "Who wrote this quest" with Verify the signature |
| 05 | Block is a merchant with a wallet… no dev patch | Shop: the three cards → + → Sell 2 Key Fragments → "Sold 2 Key Fragment to Bloq" in the panel, price 39→38, the curve dips |
| 06 | Three NPC traders… cage they can't open | Market · live: patient, bull, bear with their accounts and lines |
| 07 | And every price is a question… No house | Price call under Key Fragment → "→ same" → "Your call: → same, from 38 · settles in m:ss" |
| 08 | Three quests, one graduation… your key | Fuel System and Smart Agreements answered fast → Graduate → sealed Passport → "IT WAS ON NEAR THE WHOLE TIME" (hold 5 s) → Your account / Your Passport / Your key cards |
| 09 | And the Passport is a seat… what the cohort pays for | Missions: Bloqvia DAO card, "Graduate seat" → First graduate of the week → Claim → "Checking on chain…" → Paid · See it on the explorer → DAO proposals list (your seat proposal, Approved) |
| 10 | Blockvia. Learn Web three by playing it… Web three is worth understanding. Let's make sense of it. | Map, Passport pill "Graduate", the On NEAR panel with six transactions; Bloq whole in frame |

## Recording notes

- Chrome window 1920×1080, Game Bar (Win+Alt+R). Fresh session (no account) at the start; the
  price-call cards must not be in their closed last three minutes when the shop is reached.
- Never hold on a frame where Bloq is cut by the window edge or by the edit's crop: scroll so the whole figure sits 40 px inside the recorded area, or keep him out of the frame entirely.
- Clicks are dispatched to the page directly, so no extension cursor labels appear; the mouse is
  parked off the page. The debug bar, the outline and the "working here" pill are cropped or
  wiped in the edit (`crop`, `delogo`).
- Edit: one encoded file per block, each trimmed to its narration plus one second, joined with the
  concat demuxer; captions burnt in from the aligned narration; 1080p30, loudness −16 LUFS.
