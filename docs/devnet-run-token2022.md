# ZKdle devnet run

Run at 2026-10-19T08:24:10.056Z (UTC). Program: [28yAvstxQRBHbd6rFCD1x5HFwJWgrVobSkDbVLKq1uVD](https://explorer.solana.com/address/28yAvstxQRBHbd6rFCD1x5HFwJWgrVobSkDbVLKq1uVD?cluster=devnet)

- test $PROOF mint (Token-2022 + metadata extensions, like pump.fun): [4t7FuEcYeGgyNZL14Cwj77LJeyg8uV62SVjvbCSpXFLU](https://explorer.solana.com/address/4t7FuEcYeGgyNZL14Cwj77LJeyg8uV62SVjvbCSpXFLU?cluster=devnet) · mock pool vaults FNfdht… / 8wHFKR… (0.000005 SOL per PROOF)

## Daily #1
- day board [HPRmdu7vdfWArCAiMP3BCyZVWK3u8BM5rftcTd8mLNrv](https://explorer.solana.com/address/HPRmdu7vdfWArCAiMP3BCyZVWK3u8BM5rftcTd8mLNrv?cluster=devnet); player sealed 2 rows on-chain, solved=true: [miss](https://explorer.solana.com/tx/2YVBPNBX6QB3M1JcY2QQNSixGzzyz8Vvkv9GruaisaPkmBB3peRJUghDiH248vdfnDqYx4C86fPddfPdqwjYkBUQ?cluster=devnet) · [solve](https://explorer.solana.com/tx/4NwsSfBQfXtFHmdZboZFeHyEb9EDMa5iUBgATfzAd4eN9yTPgEBfF2TprmBNnZqmDukZwxwxRprMDqt8RnPRqfp3?cluster=devnet)
- streak PDA [GESUmqyvqpqt1LSEYMUNbcLYGT6WBRpCR4WSttzvHQ6C](https://explorer.solana.com/address/GESUmqyvqpqt1LSEYMUNbcLYGT6WBRpCR4WSttzvHQ6C?cluster=devnet)

## Bounty round 1008
- entry **2,000 PROOF** ≈ 0.010 SOL (TWAP, fixed at open), cap 2 · round [DBomikV79dL2XnkFibrZhneagvetMM5P2cZjC3thMQ8k](https://explorer.solana.com/address/DBomikV79dL2XnkFibrZhneagvetMM5P2cZjC3thMQ8k?cluster=devnet)
- joins: [A](https://explorer.solana.com/tx/5Pd43rHwGyx3jAiDuGJdAqFADNRmEWSU4qzRKrXYmPPU9khc5gsru6yHD1dPrFibzbL4SQX1SjK8GNz1JFpq8C5b?cluster=devnet) · [B](https://explorer.solana.com/tx/kZEXxByYFnaR5o9nLzvATBZg3jLNotWa5zF5xsL9YnzRgVktMGdmwbWC99nwdZN5cC4zLdPaXtvFa8gC9njiHPV?cluster=devnet) (each: BurnChecked + 2× TransferChecked in one tx)
- after 2 joins: supply 1,200,000 → 1,199,600 (**−400** = 2 × 10%), treasury 0 → 200 (**+200** = 2 × 5%), escrow **3,400** (= 2 × 85%)
- play: A solved in 1 ([tx](https://explorer.solana.com/tx/2fiL7r2zqfoWaQcyjfnWQUALftqgnH7FT2rnVtG3zK3BgoQyiwjmfR1SfmP9s3VAw76srJpqAXJZoqtkqwMYaqPv?cluster=devnet)), B in 2 ([tx](https://explorer.solana.com/tx/662hwUvLRUQVuMxzrMq8QY6F2dczgMmSaXXTSLfaFgkjBURXcdN7DuqGK8zB2ShoAxVu3EmRE3TsVpEFQrUD2BK5?cluster=devnet)). Settle (full + all done → early): [tx](https://explorer.solana.com/tx/53oBfZscV8dLik1cqVmZLYDS3kdTfwxeDZ14pLgF8FrKjCUtzpLBcDiNWoTeqGpLmNzPzADswRodurd6hbGPHRT3?cluster=devnet)
- payout: k = ceil(30% × 2) = 1 → A gets the whole escrow: A 98,000 → 101,400 (**+3,400**), B unchanged 98,000, escrow → 0
- net per wallet: A 1,400 PROOF, B -2,000 PROOF; cards closed + round & escrow closed (rent back): **true**

## Duel 1009 (0.05 SOL each)
- create: [tx](https://explorer.solana.com/tx/LyB2zVEJDdi7UgYQ3E7htaoPazcBwUe5cr6rQXgkk6wA9GNHyATP9VutEsGojCwtTsiH1ebH72YE7kBtZsRDepB?cluster=devnet) · accept: [tx](https://explorer.solana.com/tx/4uayfzz9wiTEMkUCnH1eaAySp4m9zRWfVmkEaeHjP3RjKVy3DiWwcW3B3R8PcUgrc26JCnvR7F8ayWFF7cZofc7t?cluster=devnet) · settle/payout: [tx](https://explorer.solana.com/tx/58drt9tATcYHi4gMdG8x3SUBrzwdhz6REonnv6SgoN5yaScT57H1Q2FsUzJheJVt4rbV3ncxF7jpm2Fnh2qtYLhA?cluster=devnet)
- B solved in 1, A in 3 → B wins. Treasury +0.0050 SOL (5% of 0.1). B net 0.04498 SOL, A net -0.05003 SOL (incl. tx fees, card rent refunded, duel round rent back to A); duel round closed: **true**
