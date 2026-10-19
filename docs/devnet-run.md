# ZKdle devnet run

Run at 2026-10-19T08:12:29.987Z (UTC). Program: [28yAvstxQRBHbd6rFCD1x5HFwJWgrVobSkDbVLKq1uVD](https://explorer.solana.com/address/28yAvstxQRBHbd6rFCD1x5HFwJWgrVobSkDbVLKq1uVD?cluster=devnet)

- test $PROOF mint (SPL Token): [GGaJ7Mb2Qq3BC6394pUpXjEGzWpcBtSFqmPSy9aukSfG](https://explorer.solana.com/address/GGaJ7Mb2Qq3BC6394pUpXjEGzWpcBtSFqmPSy9aukSfG?cluster=devnet) · mock pool vaults 6GJSH7… / H89AZM… (0.000005 SOL per PROOF)

## Daily #1
- day board [HPRmdu7vdfWArCAiMP3BCyZVWK3u8BM5rftcTd8mLNrv](https://explorer.solana.com/address/HPRmdu7vdfWArCAiMP3BCyZVWK3u8BM5rftcTd8mLNrv?cluster=devnet); player sealed 2 rows on-chain, solved=true: [miss](https://explorer.solana.com/tx/5aVwd6E6WM8ZjwNuh3xRNo2dVLVQ32pyLZGHbJpGXQrdmAYjwt2EA9VsSCsUcqesTTQYBjQRBwbZ4p5JXd8WUQ7B?cluster=devnet) · [solve](https://explorer.solana.com/tx/5dBTTQPmqycpEbcpNm6V5aJotC5kZ7M1EUGSTLG9BYguSTGrtvkhoXZGsdaw4eJBkuGF1sRSsfDGcVURyW7mtU3P?cluster=devnet)
- streak PDA [FeN1o1akM2ARfDmbBoBh4xnkp9cK6ddi3CC3w2GzRH1w](https://explorer.solana.com/address/FeN1o1akM2ARfDmbBoBh4xnkp9cK6ddi3CC3w2GzRH1w?cluster=devnet)

## Bounty round 1006
- entry **2,000 PROOF** ≈ 0.010 SOL (TWAP, fixed at open), cap 2 · round [DXwpchhqgv28TmEdT3voPbo2gQsywCZwWn2nSsmwDfUN](https://explorer.solana.com/address/DXwpchhqgv28TmEdT3voPbo2gQsywCZwWn2nSsmwDfUN?cluster=devnet)
- joins: [A](https://explorer.solana.com/tx/3kzwyNF2Kx2t5ZrrRQJzVFDrnYEzhs4dtCaR6884XWeYz5t1jVuJNESrgaHz84VADKDCJEcnW1iMZ8yBhHXprF8g?cluster=devnet) · [B](https://explorer.solana.com/tx/44RFvw2GjhLoUiD9uhR3Y4BPceKWCMxLY1vRtCZS5KHiBocuJwgawZRDCRdLUxE4qMBnEtyjJ9ewnUbwwSyuCaU9?cluster=devnet) (each: BurnChecked + 2× TransferChecked in one tx)
- after 2 joins: supply 1,199,600 → 1,199,200 (**−400** = 2 × 10%), treasury 200 → 400 (**+200** = 2 × 5%), escrow **3,400** (= 2 × 85%)
- play: A solved in 1 ([tx](https://explorer.solana.com/tx/3UeDSXqXCXt2keYW2jAJg4oqoNhdriy8JjzWfWyUUxwVWLtBZMWRgC2KnDKrfkLJesjqekALg9r9zMYd5WfMzv7G?cluster=devnet)), B in 2 ([tx](https://explorer.solana.com/tx/HZd2B2o8u8vuGemAAdK7rHJEQUv5Yp47kKA8CpqQpNJZUbZdHJWhE2uiqs2KMHhfLJhD1UiyuMJEYvspYj9cNWG?cluster=devnet)). Settle (full + all done → early): [tx](https://explorer.solana.com/tx/2VPjWN5avPKc9zdCBt4kTmbn8b37He3sRoTyNMQM1BpUB9fjeNzL252P3Bj21Pr49VcJvKeVmqyvFfakFbMumAh?cluster=devnet)
- payout: k = ceil(30% × 2) = 1 → A gets the whole escrow: A 99,400 → 102,800 (**+3,400**), B unchanged 96,000, escrow → 0
- net per wallet: A 1,400 PROOF, B -2,000 PROOF; cards closed + round & escrow closed (rent back): **true**

## Duel 1007 (0.05 SOL each)
- create: [tx](https://explorer.solana.com/tx/3XizhApSWmxaNTDqwdC8MHzxkpaGKnRKgcq2KxFtB11pAaA3K5WdVaPNE4Byon3fSRJC7KQtmYTkM91bxYEWdXqW?cluster=devnet) · accept: [tx](https://explorer.solana.com/tx/34TBQGjyuW5dQEHTcxYYgUWvBZK77eptzQACZzGMk9yKmqBuWwAGhxDqTvYL9mvTZ8nSeRMFKvoztuD35Hc5uGWL?cluster=devnet) · settle/payout: [tx](https://explorer.solana.com/tx/2vv9oMTvhARFd6crX5XNgswWF8LcBLNbKtyanvZb1U8v8qNCktanMU5eFUM6stYoB4BDrAQSkuqKgitA1hT7QLvV?cluster=devnet)
- B solved in 1, A in 3 → B wins. Treasury +0.0050 SOL (5% of 0.1). B net 0.04498 SOL, A net -0.05003 SOL (incl. tx fees, card rent refunded, duel round rent back to A); duel round closed: **true**
