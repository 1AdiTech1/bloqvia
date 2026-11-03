# Economy simulation (live testnet via http://localhost:8787)

Players: 2 (strategies: 50% sellers, 25% traders, 25% hoarders, staggered arrivals). Rounds: 5.
Pricing: base 100, halving at stock 40, spread 250 bps, treasury floor 500. Bloq seed: 10000 gold, 5 of each item.

Rule: buy_price = base * halving / (halving + stock). Read the table top to bottom: Bloq pays less for what players dump.

| round | active | graduates | shop | Bloq gold | key-fragment price (stock) | fuel-cell price (stock) | contract-seal price (stock) |
|---|---|---|---|---|---|---|---|
| 0 | 1 | 0 | open | 10000 | 88 (5) | 88 (5) | 88 (5) |
| 1 | 2 | 0 | open | 9826 | 85 (7) | 88 (5) | 88 (5) |
| 2 | 2 | 0 | open | 9316 | 81 (9) | 81 (9) | 88 (5) |
| 3 | 0 | 2 | open | 8974 | 81 (9) | 81 (9) | 81 (9) |
| 4 | 0 | 2 | open | 8974 | 81 (9) | 81 (9) | 81 (9) |
| 5 | 0 | 2 | open | 8974 | 81 (9) | 81 (9) | 81 (9) |

After 5 rounds: 2/2 graduated, Bloq holds 8974 gold, shop open.
