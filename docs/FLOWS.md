# Bloqvia — flows

User flow, system architecture, sequences, Passport states and Bloq's economy loop. All diagrams are Mermaid and render on GitHub. Source of truth for the plan: the "Bloqvia — Roadmap & Flows" doc.

## Build plan

Gate 1 (Nov 10, 18:00) opens Module A, the streak token. Gate 2 (Nov 11, 18:00) opens Module B, the cohort treasury on Sputnik DAO. Module B has a hard stop at Nov 13, 13:00. Each module lives on its own branch and merges only through its gate.

```mermaid
gantt
    title Bloqvia build plan, Nov 3 to Nov 14 2026 (deadline 23:59 UTC)
    dateFormat YYYY-MM-DD HH:mm
    axisFormat %b %d
    section Decide
    P0 Decisions, repo, testnet accounts       :p0, 2026-11-03 09:00, 10h
    section Chain (Adi)
    P1 Auth spike + contracts                  :p1, 2026-11-04 09:00, 2d
    P2 Onboarding + relayer                    :p2, 2026-11-06 09:00, 2d
    P4 Simulation + judge mode                 :p4, 2026-11-10 09:00, 9h
    section Product (Maria)
    Lovable screens v1, Solarpunk theme        :m1, 2026-11-04 09:00, 4d
    Lesson content final                       :m2, 2026-11-08 09:00, 2d
    Streak card + cohort board UI, mock data   :m3, 2026-11-10 09:00, 2d
    section Together
    P3 Game loop wiring, Golden Path e2e       :p3, 2026-11-08 09:00, 2d
    Gate 1, core green                         :milestone, g1, 2026-11-10 18:00, 0h
    section Stretch (gated)
    Module A, streak token NEP-141             :a1, 2026-11-11 09:00, 9h
    Gate 2, Module A merged                    :milestone, g2, 2026-11-11 18:00, 0h
    Module B, cohort treasury on Sputnik DAO   :b1, 2026-11-12 09:00, 28h
    Module B hard stop                         :milestone, crit, g3, 2026-11-13 13:00, 0h
    section Ship
    P6 Hardening + judge README                :p6, 2026-11-12 09:00, 9h
    P7 Demo video + X post draft               :p7, 2026-11-13 09:00, 9h
    P8 Submit, target 18h Bucharest            :crit, p8, 2026-11-14 09:00, 9h
    Deadline 23h59 UTC                         :milestone, crit, d1, 2026-11-14 23:59, 0h
    section After
    Keep demo up                               :k1, 2026-11-15 00:00, 11d
    Judging                                    :j1, 2026-11-16 00:00, 3d
```

## User flow: the Golden Path

```mermaid
flowchart TD
    A([Lands on bloqvia.com]) --> B[Taps Start Learning]
    B --> C[Signs in: email, Google or Apple<br/>no seed phrase, no wallet popup]
    C --> D[Account provisioned invisibly<br/>learner-xxxx.bloqvia.testnet]
    D --> E[Passport minted at level 0]
    E --> F[Map: 3 quests open, Bloq's shop locked]

    subgraph Q[Quest loop, 3 times]
        direction TB
        G[Reads the bite-sized concept] --> H[Answers the quiz]
        H --> I{Correct?}
        I -- no --> G
        I -- yes --> J[Taps Claim]
        J --> K[Contract verifies the answer<br/>mints item + gold, Passport levels up]
        K --> L[Explorer link shown:<br/>'our relayer paid that gas for you']
    end

    F --> G
    L --> M{Passport at level 3?}
    M -- no --> F
    M -- yes --> N[Bloq's shop unlocks]
    N --> O[Sells and buys items with Bloq<br/>his prices move with his stock]
    O --> P{Holds all 3 items + Bloq's current price?}
    P -- no --> O
    P -- yes --> R[Graduation swap at Bloq]
    R --> S[Passport becomes Graduate]
    S --> T[The reveal: it was on-chain the whole time<br/>full history on Explorer, keys handed over]
    T --> U([Optional: export to own wallet])
```

## System architecture

```mermaid
flowchart LR
    subgraph APP[Web app, mobile-first: React + Vite + Tailwind from Lovable]
        UI[Screens: Landing, Map, Quiz, Shop, Passport, Reveal]
        NEAR[src/near: session key, DelegateAction signing, view calls]
        UI --> NEAR
    end

    subgraph AUTH[Sign-in, decided Nov 4]
        A1[Path A: NEAR Auth<br/>Google, Apple, email, passkey<br/>one key per identity]
        A2[Path B fallback: keypair generated in the browser]
    end

    subgraph RLY[Relayer, serverless, pays all gas]
        R1[create sub-account +<br/>function-call key scoped to bloqvia-core]
        R2[wrap SignedDelegate and submit<br/>allowlist: our two contracts only]
    end

    subgraph CHAIN[NEAR testnet]
        CORE[bloqvia-core, NEP-245<br/>gold + items, lesson registry with answer hashes,<br/>once per account, Bloq's inventory and price rule]
        PASS[bloqvia-passport, NEP-171<br/>dynamic level, non-transferable,<br/>level_up callable only by core]
        BLOQ[(bloq.bloqvia.testnet<br/>merchant wallet)]
        CORE -- level_up --> PASS
        CORE --- BLOQ
    end

    SIM[Simulation: scripted players, no LLM] --> R2
    NEAR --> AUTH
    AUTH -- public key --> R1
    NEAR -- signed DelegateAction --> R2
    R1 --> CHAIN
    R2 --> CORE
    NEAR -. view calls .-> CHAIN
    CHAIN --> EXP[NEAR Explorer links in the UI]
```

## Sequence: onboarding

```mermaid
sequenceDiagram
    actor U as Learner
    participant W as Web app
    participant S as Sign-in (NEAR Auth or local key)
    participant R as Relayer
    participant N as NEAR testnet
    participant C as bloqvia-core
    participant P as bloqvia-passport

    U->>W: Taps Start Learning
    W->>S: Sign in with email, Google or Apple
    S-->>W: Public key for this identity
    W->>R: register(public key)
    R->>N: create learner-xxxx.bloqvia.testnet<br/>add function-call key scoped to bloqvia-core<br/>(signed by bloqvia.testnet, relayer pays)
    R->>C: mint_passport(learner)
    C->>P: nft_mint(level 0)
    P-->>C: token id
    R-->>W: account id, passport token id
    W-->>U: Map dashboard, no wallet seen
```

## Sequence: lesson completion

```mermaid
sequenceDiagram
    actor U as Learner
    participant W as Web app
    participant R as Relayer
    participant C as bloqvia-core
    participant P as bloqvia-passport
    participant E as Explorer

    U->>W: Answers the quiz, taps Claim
    W->>W: Signs DelegateAction<br/>complete_lesson(lesson_id, answer_hash)<br/>with the session key
    W->>R: Signed delegate
    R->>R: Allowlist check: receiver bloqvia-core,<br/>method complete_lesson
    R->>C: SignedDelegate transaction, relayer pays gas
    C->>C: answer_hash equals stored hash?<br/>first completion for this account?
    C->>C: mt_mint item + gold to learner
    C->>P: level_up(passport)
    P-->>C: new level
    C-->>R: receipt
    R-->>W: transaction hash
    W->>E: Link to the transaction
    W-->>U: Item + gold earned, Passport levelled, explorer link
```

## Passport states

```mermaid
stateDiagram-v2
    [*] --> L0: sign-in mints the Passport
    L0 --> L1: The Vault passed (keys)
    L1 --> L2: The Fuel System passed (gas)
    L2 --> L3: Smart Agreements passed (contracts), shop unlocks
    L3 --> Graduate: graduation swap at Bloq
    Graduate --> [*]
    note right of Graduate
        Non-transferable.
        Level and metadata updated on-chain at every step.
    end note
```

## Bloq's economy loop

```mermaid
flowchart LR
    Q[Players finish quests] -- mints --> I[Items in player wallets]
    I -- players sell --> S[Bloq's stock of that item rises]
    S -- price rule --> D[Bloq's buy price for it falls]
    D --> M[Players stop selling it and move to harder quests]
    M --> Q
    I -- players buy --> S2[Bloq's stock falls]
    S2 -- price rule --> U[Bloq's price rises]
    G[Graduation: 3 items + gold at Bloq's current price] --> T[Bloq's treasury]
    T -- treasury below floor --> X[Shop closes until restocked]
```
