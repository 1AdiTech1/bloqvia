# Streak simulation (Module A, offline replica of bloqvia-streak)

60 days per run, seeded PRNG (reproducible), no LLM. The replica follows contracts/bloqvia-streak/src/lib.rs: one check-in per member per day; target met -> reward minted to every check-in and streak +1; target missed -> fixed burn from the treasury and streak reset; burns stop at an empty treasury.

Read the two parameter sets together: the testnet demo set (a 10-minute "day", target 2) exists so the mechanic can be watched during judging; the community set shows the same rule at a realistic target.

## testnet demo (init-args.testnet.json)

Members: 8. Target: 2 check-ins/day. Reward: 10 per check-in. Burn: 100 per missed day. Treasury seed: 500000.

### steady — every member checks in with p = 0.75 each day

| day | check-ins | result | streak | best | treasury | total supply |
|---|---|---|---|---|---|---|
| 1 | 8 | met | 1 | 1 | 500000 | 500080 |
| 10 | 8 | met | 10 | 10 | 500000 | 500590 |
| 20 | 4 | met | 20 | 20 | 500000 | 501170 |
| 30 | 4 | met | 30 | 30 | 500000 | 501790 |
| 40 | 7 | met | 40 | 40 | 500000 | 502340 |
| 50 | 8 | met | 50 | 50 | 500000 | 502920 |
| 60 | 6 | met | 60 | 60 | 500000 | 503510 |

After 60 days: 60 days met, 0 missed, best streak 60, minted 3510, burned 0, treasury 500000 of 500000, total supply 503510.

### decaying — enthusiasm fades: p from 0.90 on day 0 to 0.10 on day 59

| day | check-ins | result | streak | best | treasury | total supply |
|---|---|---|---|---|---|---|
| 1 | 8 | met | 1 | 1 | 500000 | 500080 |
| 10 | 8 | met | 10 | 10 | 500000 | 500680 |
| 20 | 2 | met | 20 | 20 | 500000 | 501200 |
| 30 | 3 | met | 30 | 30 | 500000 | 501660 |
| 40 | 2 | met | 40 | 40 | 500000 | 502000 |
| 50 | 4 | met | 1 | 44 | 499600 | 501780 |
| 60 | 1 | missed | 0 | 44 | 499100 | 501390 |

After 60 days: 51 days met, 9 missed, best streak 44, minted 2290, burned 900, treasury 499100 of 500000, total supply 501390.

### bursty — weekdays p = 0.80, weekends p = 0.15

| day | check-ins | result | streak | best | treasury | total supply |
|---|---|---|---|---|---|---|
| 1 | 8 | met | 1 | 1 | 500000 | 500080 |
| 10 | 8 | met | 3 | 6 | 499900 | 500390 |
| 20 | 1 | missed | 0 | 6 | 499600 | 500520 |
| 30 | 5 | met | 3 | 6 | 499500 | 500920 |
| 40 | 7 | met | 5 | 7 | 499400 | 501340 |
| 50 | 8 | met | 1 | 7 | 499100 | 501470 |
| 60 | 6 | met | 5 | 7 | 499000 | 501920 |

After 60 days: 50 days met, 10 missed, best streak 7, minted 2920, burned 1000, treasury 499000 of 500000, total supply 501920.

## community (target 10 of 20)

Members: 20. Target: 10 check-ins/day. Reward: 10 per check-in. Burn: 100 per missed day. Treasury seed: 100000.

### steady — every member checks in with p = 0.75 each day

| day | check-ins | result | streak | best | treasury | total supply |
|---|---|---|---|---|---|---|
| 1 | 13 | met | 1 | 1 | 100000 | 100130 |
| 10 | 17 | met | 10 | 10 | 100000 | 101520 |
| 20 | 15 | met | 20 | 20 | 100000 | 102920 |
| 30 | 17 | met | 30 | 30 | 100000 | 104390 |
| 40 | 14 | met | 40 | 40 | 100000 | 105910 |
| 50 | 11 | met | 50 | 50 | 100000 | 107420 |
| 60 | 16 | met | 60 | 60 | 100000 | 108970 |

After 60 days: 60 days met, 0 missed, best streak 60, minted 8970, burned 0, treasury 100000 of 100000, total supply 108970.

### decaying — enthusiasm fades: p from 0.90 on day 0 to 0.10 on day 59

| day | check-ins | result | streak | best | treasury | total supply |
|---|---|---|---|---|---|---|
| 1 | 17 | met | 1 | 1 | 100000 | 100170 |
| 10 | 17 | met | 10 | 10 | 100000 | 101710 |
| 20 | 11 | met | 20 | 20 | 100000 | 103040 |
| 30 | 11 | met | 1 | 27 | 99800 | 103760 |
| 40 | 10 | met | 2 | 27 | 99300 | 103790 |
| 50 | 5 | missed | 0 | 27 | 98300 | 102790 |
| 60 | 1 | missed | 0 | 27 | 97300 | 101790 |

After 60 days: 33 days met, 27 missed, best streak 27, minted 4490, burned 2700, treasury 97300 of 100000, total supply 101790.

### bursty — weekdays p = 0.80, weekends p = 0.15

| day | check-ins | result | streak | best | treasury | total supply |
|---|---|---|---|---|---|---|
| 1 | 13 | met | 1 | 1 | 100000 | 100130 |
| 10 | 17 | met | 3 | 5 | 99800 | 101050 |
| 20 | 3 | missed | 0 | 5 | 99500 | 101850 |
| 30 | 18 | met | 2 | 5 | 99200 | 102700 |
| 40 | 15 | met | 5 | 5 | 99000 | 103800 |
| 50 | 13 | met | 1 | 5 | 98600 | 104340 |
| 60 | 18 | met | 4 | 5 | 98400 | 105470 |

After 60 days: 44 days met, 16 missed, best streak 5, minted 7070, burned 1600, treasury 98400 of 100000, total supply 105470.

## What the numbers say

- Supply grows only while the community keeps showing up (minted = reward x check-ins on met days) and every missed day burns a fixed slice. Net growth is minted minus burned: strong in "steady", roughly halved in "decaying", and in "bursty" the streak never passes a weekend (best streak 5-7). The token records collective consistency, not any one wallet.
- The treasury is a reserve of missed days: at 100 per miss, 100,000 covers 1,000 misses and the demo's 500,000 covers 5,000. With 10-minute demo days that is about 35 days of total silence, longer than the judging window. When it reaches zero, burns stop and the token simply stops shrinking. Nothing can refill it: no admin method exists.
- Under the demo parameters the target (2) is easy on purpose, so a judge who checks in alone still sees both outcomes within an hour: a solo 10-minute day is a miss, a pair is a met day with a mint.
- Sybil limit: one account = one check-in; the relayer funds and rate-limits accounts but cannot tell two accounts of one person apart. Stated in the README.
