# Economy simulation (live testnet via https://relay.bloqvia.app)

Players: 8 (strategies: 50% sellers, 25% traders, 25% hoarders, staggered arrivals). Rounds: 5.
Pricing: base 100, halving at stock 40, spread 250 bps, treasury floor 500. Bloq seed: 10000 gold, 5 of each item.

Rule: buy_price = base * halving / (halving + stock). Read the table top to bottom: Bloq pays less for what players dump.

| round | active | graduates | shop | Bloq gold | key-fragment price (stock) | fuel-cell price (stock) | contract-seal price (stock) |
|---|---|---|---|---|---|---|---|
| 0 | 4 | 0 | open | 9139 | 74 (14) | 78 (11) | 76 (12) |
| 1 | 8 | 0 | open | 8586 | 64 (22) | 78 (11) | 76 (12) |
| 2 | 8 | 0 | open | 7869 | 64 (22) | 65 (21) | 76 (12) |
| 3 | 0 | 8 | open | 8562 | 57 (30) | 57 (29) | 55 (32) |
| 4 | 0 | 8 | open | 8562 | 57 (30) | 57 (29) | 55 (32) |
| 5 | 0 | 8 | open | 8562 | 57 (30) | 57 (29) | 55 (32) |

After 5 rounds: 8/8 graduated, Bloq holds 8562 gold, shop open.
