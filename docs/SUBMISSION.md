# Submission — nearhackathon.com, section 06 ("Your Project. Lands Here")

Deadline 14 Nov 2026 · 23:59 UTC. One entry. Both links are required and the repo must be public
when you press Submit. Corrections afterwards: nearhackathon.com/request-changes.

## The form, field by field

| Field | Put |
| --- | --- |
| Project name | `Bloqvia` |
| Team lead | `Adrian Chivu` |
| Email address | the address you read hackathon mail on |
| Team size | `2-4 people` (Adi, Maria) |
| Tracks | `games`, `memecoins`, `social`, `nfts`, `open` |
| NEAR wallet address | your **mainnet** account (prizes are paid on mainnet; not `bloqvia.testnet`) |
| Repository link | `https://github.com/1AdiTech1/bloqvia` — public, tagged `v1.0-hackathon` |
| Website | `https://bloqvia.app` |
| Demo post link | the X post below, once it is up |
| What did you build? | the text under "What did you build?" (1934 characters, limit 2 000) |

## What did you build? (paste as is)

Bloqvia is a game that teaches Web3 by playing it, for real, on NEAR testnet, with no wallet, no seed phrase and no gas for the player.

Tap Create my account: a NEAR sub-account is created for you and a soulbound Passport NFT (NEP-171) minted to it. Every quest answer is a complete_lesson transaction signed by your own account, relayed as a NEP-366 meta-transaction; the contract checks the answer (lessons are stored as hashes) and writes the reward. The app shows each transaction with its explorer link, the block height and "Gas you paid: 0 NEAR".

What's in the window (Nov 1–14):
- Four Rust contracts: core (quests, shop, graduation, Season 2 stamps), passport (stamps), streak (a community token that mints on kept days, burns on missed ones), bounties (a board that pays what the chain can verify). 72 tests.
- A market that never sleeps: prices are a contract rule (the more Bloq holds, the less he pays); bots, an NPC trader with its own account and a fast-forward mode keep trading while nobody is online; the shop shows 24-hour curves of real trades.
- An AI agent on NEAR AI Cloud (TEE, signed) writes a daily quest and answers "Ask Bloq". The model only writes text: no model output can reach a reward, a price or a balance.
- A cohort DAO (Sputnik v2): the board pays small bounties itself, files medium claims as DAO proposals, leaves large ones to the DAO. The Passport is a vote: graduating seats you in the graduates role (you approve payments with your own key); the Season 2 stamp seats you in founders, who propose bounties the DAO itself adds to the board.
- A relayer (Node, no framework) that creates accounts, relays, seats, and runs the market and the agent. 37 tests.

The README is written for a judge: numbered "do X, see Y" steps for the hosted app and for a clean clone (cargo test, npm test, an offline economy simulation, a live run through the relayer), all true on submission day. Testnet only.

## The X post (demo post link)

Attach the demo video (the MP4, under 2 min 20 s for X without Premium; otherwise a 30 s cut plus
the YouTube link in a reply) or four screenshots: the map with the On NEAR panel, the shop with
the curves, Missions with the DAO card, the Passport with the Season 2 stamp.

Text (273 characters):

> I built Bloqvia at the NEAR HACKATHON: learn Web3 by playing it on NEAR testnet. No wallet, no gas. Every quest is a real transaction, prices are a contract rule, an AI agent writes the daily quest, your Passport is a vote in a DAO. bloqvia.app @NEARProtocol #NEARHackathon

Reply to your own post with the repo link and the YouTube link, so the post itself stays short.

## Before pressing Submit (in this order)

1. Keys rotated (NEAR_AI_API_KEY, ADMIN_TOKEN) and Railway redeployed; `/health` ok.
2. `git log -p --all | grep -E "ed25519:[1-9A-HJ-NP-Za-km-z]{60,}" | grep -vc "ed25519:5KqX9vTn"` prints 0.
3. Video uploaded; its link in README.md under the first paragraph; committed.
4. `git tag v1.0-hackathon && git push origin v1.0-hackathon`.
5. Repo public: GitHub → Settings → General → Danger Zone → Change visibility → Public.
6. Open https://github.com/1AdiTech1/bloqvia in a private window: README renders, no 404.
7. X post up; copy its link.
8. `cd scripts && npm run balances` → `All accounts have room.`
9. Fill the form, press Submit, keep the confirmation.
