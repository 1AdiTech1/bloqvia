# Economy simulation (offline replica)

Players: 100 (strategies: 50% sellers, 25% traders, 25% hoarders, staggered arrivals). Rounds: 12.
Pricing: base 100, halving at stock 40, spread 250 bps, treasury floor 500. Bloq seed: 10000 gold, 5 of each item.

Rule: buy_price = base * halving / (halving + stock). Read the table top to bottom: Bloq pays less for what players dump.

| round | active | graduates | shop | Bloq gold | key-fragment price (stock) | fuel-cell price (stock) | contract-seal price (stock) |
|---|---|---|---|---|---|---|---|
| 0 | 12 | 0 | open | 10000 | 88 (5) | 88 (5) | 88 (5) |
| 1 | 23 | 0 | open | 8288 | 57 (29) | 88 (5) | 88 (5) |
| 2 | 34 | 0 | open | 5936 | 49 (41) | 57 (29) | 88 (5) |
| 3 | 22 | 23 | open | 6855 | 37 (68) | 38 (65) | 40 (60) |
| 4 | 22 | 34 | open | 7328 | 30 (90) | 32 (82) | 34 (75) |
| 5 | 22 | 45 | open | 7778 | 27 (107) | 28 (102) | 30 (90) |
| 6 | 22 | 56 | open | 8010 | 24 (125) | 24 (125) | 27 (107) |
| 7 | 22 | 67 | open | 8201 | 21 (145) | 22 (140) | 23 (130) |
| 8 | 22 | 78 | open | 8383 | 19 (167) | 20 (157) | 21 (149) |
| 9 | 11 | 89 | open | 8688 | 18 (175) | 18 (180) | 19 (168) |
| 10 | 0 | 100 | open | 9088 | 17 (192) | 17 (188) | 17 (186) |
| 11 | 0 | 100 | open | 9088 | 17 (192) | 17 (188) | 17 (186) |
| 12 | 0 | 100 | open | 9088 | 17 (192) | 17 (188) | 17 (186) |

After 12 rounds: 100/100 graduated, Bloq holds 9088 gold, shop open.
