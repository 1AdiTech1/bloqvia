# Demo video — script (3 min 05 s)

One screen recording of https://bloqvia.app on a desktop browser, you narrating. No slides, no logo
intro: the first frame is the app. Everything shown is a real testnet transaction, and the script
says so once, early, then lets the explorer links prove it.

## Before you press record (10 min)

- Browser window 1280 px wide or more (the three-column layout with the **On NEAR** panel on the
  right; that panel is the proof, keep it in frame the whole time). Private window, so the app
  starts with no account. Zoom 100 %.
- Second private window, or a second browser, signed in as a **founder** account (one that has the
  Season 2 stamp, e.g. `learner-f8cdd4ad158f`) parked on its **Missions** tab. Season 2 is ten
  minutes of play; the video cuts to this window for the proposal instead.
- Check, from a terminal: `cd scripts && npm run balances` → `All accounts have room.`;
  `curl -s https://relay.bloqvia.app/quests` lists `daily-<today>`; on Missions, "Today's quest,
  done" and "First graduate of the week" have room ("n of 50 claimed", not full).
- Recorder: OBS or the browser's own (Chrome: `chrome://` → nothing special needed; on Windows
  `Win+G`). 1080p, 30 fps, microphone on, system sound off. Cursor visible.
- Read the narration aloud twice. It is about 400 words; at a calm pace, with the clicks between them, that is 3 min. Do not
  speed up to fit: cut a sentence instead.

Mistakes are fine: every take makes a new account and costs nothing. Record the whole thing in
one go, trim the start and the end, and the one cut to the founder window.

## The shots

Times are where you should be, not deadlines. **Bold** = what you click. *Italic* = what the
viewer sees. Plain = what you say.

### 0:00 — Landing (10 s)

*The landing page.*

> Most people quit Web3 at the wallet: a seed phrase, gas, a first transaction they don't
> understand. Bloqvia is a game that teaches it by playing it, for real, on NEAR testnet, with none
> of that in the way. Every move you'll see is a real transaction, and I'll show the chain each time.

### 0:10 — The account (20 s)

**Start exploring** → **Create my account**.

*"Creating your NEAR account… about five seconds", then the map; on the right the On NEAR panel
with `learner-….bloqvia.testnet`, block height, Gas you paid: 0 NEAR.*

> That was a NEAR account being created and a Passport NFT minted to it. NEAR lets a relayer pay
> the gas for a transaction my account signs, so the key stays in this browser and I never buy
> anything. Here's the account, here's the block.

### 0:30 — First quest, first transaction (30 s)

**The Vault** → read the question → **Your public key**.

*"Quest complete", +100 BloqGold and 3 Key Fragments land in the bar, "Saved on NEAR ✓"; the
On NEAR panel gets "Quest: The Vault · complete_lesson · just now".*

**explorer ↗** on that row (new tab). *nearblocks: `complete_lesson` on `core.bloqvia.testnet`,
signed by the learner account, gas paid by `bloqvia.testnet`.* Back to the app.

> The answer is checked by the contract, not by the app: pick a wrong one and the chain refuses
> it. The reward is written by the contract too. Here's the transaction: my account signed it, the
> relayer paid the gas.

### 1:00 — The AI quest (25 s)

Scroll to **Today's quest** → **Play** → answer it.

*The quest text, the "Written by an AI agent on NEAR AI Cloud · signed in a TEE" line; after
the answer, "Who wrote this quest" with the model and **Verify the signature**.*

> Today's quest was written this morning by an AI agent on NEAR AI Cloud, running in a trusted
> enclave: it's signed, and anyone can verify the signature. The model writes text. It never
> touches a reward, a price or a balance; the contract does that.

### 1:25 — The living market (45 s)

**Shop** tab. *Bloq's prices, and under each a 24-hour curve; the "MARKET · LIVE" block with the
three NPC traders, each with its sentence.*

**Sell** two Key Fragments. *Bloq's buy price for Key Fragments drops; the gold counter climbs.*

> This is a market, and it never sleeps. Prices come from a rule in the contract: the more Bloq
> holds, the less he pays, and every hour he ships part of his surplus so prices come back. Bots and
> three NPC traders keep trading while you're away, so the curve is a day of real trades, all on
> chain. I just sold two, and his price fell.

Point at the **Market · live** block (the three traders, each with its sentence and "signed in a TEE · Verify").

> And the traders are AI agents: patient, bull, bear. Each reads the prices, picks a move and says
> why, signed. But it can only pick from the moves its rules allow; anything else is overruled.
> Agents with wallets, inside a cage they can't open.

The **→ same** key on the **Price call** card under the Key Fragment card (stake left at 20).
*The card flips to "Your call: → same, from 44 · settles in m:ss"; the gold in the bag drops by 20.*

> And every price is a question. I'm staking twenty gold that in ten minutes Bloq pays the same.
> The contract remembers today's price, and when the round ends it reads its own rule and pays the
> side that was right from the stakes of the sides that weren't. No house, no odds: a market on the
> market.

### 2:10 — Graduate, claim, vote (35 s)

Finish the other two quests fast (you know the answers: **The Fuel System** → *False*,
**Smart Agreements** → *A smart contract*; about 15 s, no narration, or say the line below over it).

> Two more quests and the Passport is ready.

**Enter Bloq's shop** → **Graduate**. *The sealed Passport reveal.* → **Continue your journey →**
→ **Missions** tab.

*The Bloqvia DAO card (balance, council); "Your seat: Graduate seat"; the bounties.*

**Claim** on **First graduate of the week**. *"Checking on chain…" → "Paid" with an explorer
link; "Recent on the board" lists the account.*

> Graduating sealed the Passport, and the Passport is a seat: this account now votes in the cohort
> DAO, a Sputnik DAO on NEAR. And a bounty board pays for what the chain can verify. I claim "first graduate"; the board
> reads my record from the game contract and pays. No one approved it; no model was asked.

### 2:45 — Founders propose (15 s)

Cut to the **founder window** (Missions tab). *"Founder seat" and **Propose a bounty**; in the
list, a "Board · Approved" proposal, and on the board the bounty it created.*

> Finish Season 2 and you're a founder: you propose what the cohort pays for, founders vote with
> their own keys, and the DAO itself adds the bounty to the board. Learn, earn a seat, govern.

### 3:00 — Close (5 s)

Back to the first window, the On NEAR panel in frame.

> Bloqvia. Open source, on NEAR testnet, every step in the README. Thanks.

Stop recording.

## After

- Trim: start on the landing page, end on the last word. Keep the one cut.
- Export 1080p MP4. Upload unlisted to YouTube (title: "Bloqvia — NEAR Hackathon demo"), copy
  the link into the submission form and into `README.md` under the first paragraph:
  `Demo video (3 min 05 s): <link>`.
- Watch it once at 1× on a phone: the explorer link and the On NEAR panel must be readable.

## If something fails on camera

- The relayer answers slowly ("Creating your NEAR account…" over 15 s): FastNear is rate-limited;
  wait, it comes. Cut the wait in the edit.
- A claim says "Quest not completed" / "Not graduated yet": you skipped a step; the board is
  right. Do the step.
- Today's quest missing: `curl -s -X POST https://relay.bloqvia.app/admin/quest -H "x-admin-token: $ADMIN_TOKEN"` seeds it (ADMIN_TOKEN from `relayer/.env`), then reload.
