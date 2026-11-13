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
| Tracks | `games` (primary), `security`, `social`, `nfts`, `memecoins`, `agents`, `open` — in that order (security and agents added 13 Nov) |
| NEAR wallet address | your **mainnet** account (prizes are paid on mainnet; not `bloqvia.testnet`) |
| Repository link | `https://github.com/1AdiTech1/bloqvia` — public, tagged `v1.0-hackathon` |
| Website | `https://bloqvia.app` |
| Demo post link | `https://x.com/Bloqvia/status/2121195350769946838` (up since 13 Nov 12:55; the reply with the repo link is under it) |
| What did you build? | the text under "What did you build?" (under 2 000 characters; count it before pasting) |

## What did you build? (paste as is)

Bloqvia is a game that teaches Web3 by playing it for real on NEAR testnet: no wallet, no seed phrase, no gas. The chain stays invisible until the player has already used it, then the game says so: "It was on NEAR the whole time."

Tap Create my account: a NEAR sub-account and a soulbound Passport NFT (NEP-171). Every quest answer is a complete_lesson transaction signed by your account, relayed as a NEP-366 meta-transaction; the contract checks the hash and writes the reward. Each one is shown with its explorer link and "Gas you paid: 0 NEAR".

Built in the window (Nov 1–14):
- Four Rust contracts: core (quests, shop, graduation, stamps), passport, streak (a token that mints on kept days, burns on missed ones), bounties (a board that pays what the chain can verify). 89 tests.
- A market whose rules you can read: prices are a contract rule (the more Bloq holds, the less he pays; each hour he ships part of his surplus, so prices come back); bots trade while nobody is on. Three NPC traders (patient, bull, bear) are NEAR AI agents that pick a move, with a signed reason, only among moves their rules allow. Every price is a question: stake gold on more/same/less in ten minutes; the contract settles it from its own rule.
- An AI agent on NEAR AI Cloud (TEE, signed) writes a daily quest and answers "Ask Bloq"; no model output reaches a reward, a price or a balance.
- A cohort DAO (Sputnik v2) with a bounty board that pays NEAR for what the chain can verify: small bounties itself, medium ones as proposals. The Passport is a seat: graduating seats you in the graduates role (you vote on payments with your own key); the Season 2 stamp seats you in founders, who propose bounties the DAO adds to the board.
- A relayer (Node): accounts, relaying, seats, market, agents, the x402 market desk, the traders' purses and the sponsored slot; 55 tests.

The README is written for a judge: "do X, see Y" steps for the hosted app and a clean clone (cargo test, npm test, simulations, `npm run attack`: twelve refusals). All true on submission day. Testnet only.

## The X post (demo post link)

Attach the demo video, `C:\Users\A\Videos\bloqvia-demo\bloqvia-demo-adam3.mp4` (1080p, 2 min 06 s, with captions, so it plays muted).

Text (the guide asks to lead with the user problem and to ask a question):

> Web3 tutorials don't teach Web3. Bloqvia makes you use it first: one tap, a real NEAR account; quests, a live market, a graduation. Then the reveal: it was on NEAR the whole time. Your Passport is a seat in a DAO. Built at NEAR HACKATHON. bloqvia.app @NEARProtocol #NEARHackathon

(279 characters, under X's 280: count again after any edit.) Attach `bloqvia-demo-adam3.mp4` to the post itself (2 min 06 s, under X's 2 min 20 s). Reply to your own post with the repo link; that reply is also where the question and the extra tags go:

> Open source, every step in the README: github.com/1AdiTech1/bloqvia — what should quest one teach? @NearLegion @NearBuilders

No YouTube: the X post is the demo link everywhere (the form, the README).

## Before pressing Submit (in this order)

1. Keys rotated (NEAR_AI_API_KEY, ADMIN_TOKEN) and Railway redeployed; `/health` ok.
2. `git log -p --all | grep -E "ed25519:[1-9A-HJ-NP-Za-km-z]{60,}" | grep -vc "ed25519:5KqX9vTn"` prints 0.
3. ~~X post up; its link replaces `<X-POST-LINK>` in README.md; the MP4 committed as `docs/demo/bloqvia-demo.mp4`.~~ Done 13 Nov.
4. `git tag -f v1.0-hackathon && git tag hackathon-submission && git push -f origin v1.0-hackathon hackathon-submission` (`v1.0-hackathon` already exists from Nov 11 and moves to the final commit; `hackathon-submission` is the name the hackathon guide suggests).
5. Repo public: GitHub → Settings → General → Danger Zone → Change visibility → Public.
6. Open https://github.com/1AdiTech1/bloqvia in a private window: README renders, no 404, the video line links to the post.
8. `cd scripts && npm run balances` → `All accounts have room.`
9. Fill the form, press Submit, keep the confirmation.
