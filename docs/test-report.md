# ZKdle test report

Generated 2026-10-19, pre-launch audit against the verified build (`05321b14…7316`, commit 5a45285). Every suite runs from the repo: `npm run e2e`, `npm run e2e:ui`, `node scripts/audit.js`, `DEVNET_KEYS=<dir> DEVNET_RPC=<url> node scripts/devnet-run.js`.

## Summary
| Suite | Result |
|---|---|
| End-to-end on a local validator (`scripts/e2e.js`): real Groth16 proofs, program, server | **41/41 passed** with a legacy SPL Token mint ([list](e2e-results.txt)) and **41/41 passed** with a pump.fun-style Token-2022 mint ([list](e2e-results-token2022.txt)), both on the exact verified `.so` (`ZK_E2E_SO`, `ZK_E2E_TOKEN22=1`) |
| Browser UI with a mock wallet (`scripts/ui-e2e.js`): Daily, Bounty (incl. seats left, pot ≈ SOL, "Round full" countdown), Duel through `/play` | **5/5 passed** ([list](ui-e2e-results.txt)) |
| 12-seat settle capacity | 12-seat $PROOF settle: 1200/1232 bytes, 33 accounts; 47,044 compute units with Token-2022 (limit set to 400,000) ([capacity.txt](capacity.txt)) |
| Prover burst | 12 concurrent proof requests served by the prove queue in ≈ 4.5 s |
| Rent reclaim | `close_round` returned 0.004176 SOL (SPL Token) / 0.004211 SOL (Token-2022) per bounty round on the local validator (≈ 0.003 SOL at mainnet rent) |
| Site audit (`scripts/audit.js`): `/`, `/docs`, `/play`, `/round`, `/duel` × desktop 1440 + mobile 390 × preview and full mode | **20 page loads, 0 issues**: no console errors, failed requests, broken images, dead internal links or horizontal overflow |
| Live site audit, https://zkdle.fun mainnet mode (2026-10-19) | 5 pages × desktop 1440 + mobile 390: **0 issues** ([live-issues.txt](audit/live-issues.txt)); all 43 linked assets/links 200; `/api/test/*` 404; `/api/rpc` refuses non-allowlisted methods and batches |
| Trusted setup | `snarkjs zkey verify` OK ([ceremony transcript](ceremony/transcript.md)) |
| Devnet (real cluster) | one round of each mode, with links below |

## Security and adversarial tests (all passing)
- daily: a forged clue (gray→green) is rejected by the verifier
- bounty: a seat without the host co-signature is refused
- bounty: the server rations proofs (no 7th guess)
- security: nothing public leaks a live answer, salt or seed before reveal
- security: state file is AES-256-GCM encrypted at rest
- security: per-wallet rate limit returns 429
- security: a repeated guess is refused (no replays)
- adversarial: double join, replayed join tx and unknown signer are refused
- adversarial: a valid proof for another salt/seal is rejected on this card
- adversarial: settle before reveal / before the end is refused; close_card before settle too
- adversarial: join and guess after the end are refused on-chain
- adversarial: settle with a wrong mint or a token account of another mint is refused; second settle refused
- adversarial: not enough $PROOF — server explains, program refuses
- ties: same guesses and same own time — the earlier seat takes first place
- duel timeout: nobody accepted → creator refunded in full, no fee (even after solving)
- duel: both sides fail → both stakes refunded, no fee
- close_round: refused before settle, with an open card, to the wrong recipient, or with a non-empty escrow
- close_round: after settle + all cards closed, escrow and round rent go back to the host
- close_round: the server closes cards and the round by itself after settle (bounty + duel)
- server restart mid-round: encrypted state survives, the seat keeps playing
- security: pot cap refuses seats past ZK_MAX_POT_SOL_EQUIV
- holder badge: 100,000 $PROOF threshold read from the chain (Token and Token-2022)
- host rotation: set_admin needs both keys, then the config points at the new host

## Devnet run (exact verified build)

The devnet program `28yAvstx…` was upgraded on 2026-10-19 to the same bytes as mainnet (sha256 of the stripped ELF `05321b14…7316`, the OtterSec-verified hash), then one real round of each mode was played twice: with a legacy SPL Token $PROOF and with a pump.fun-style Token-2022 $PROOF.

### Legacy SPL Token

Run at 2026-10-19T08:12:29.987Z (UTC). Program: [28yAvstxQRBHbd6rFCD1x5HFwJWgrVobSkDbVLKq1uVD](https://explorer.solana.com/address/28yAvstxQRBHbd6rFCD1x5HFwJWgrVobSkDbVLKq1uVD?cluster=devnet)

- test $PROOF mint (SPL Token): [GGaJ7Mb2Qq3BC6394pUpXjEGzWpcBtSFqmPSy9aukSfG](https://explorer.solana.com/address/GGaJ7Mb2Qq3BC6394pUpXjEGzWpcBtSFqmPSy9aukSfG?cluster=devnet) · mock pool vaults 6GJSH7… / H89AZM… (0.000005 SOL per PROOF)

### Daily #1
- day board [HPRmdu7vdfWArCAiMP3BCyZVWK3u8BM5rftcTd8mLNrv](https://explorer.solana.com/address/HPRmdu7vdfWArCAiMP3BCyZVWK3u8BM5rftcTd8mLNrv?cluster=devnet); player sealed 2 rows on-chain, solved=true: [miss](https://explorer.solana.com/tx/5aVwd6E6WM8ZjwNuh3xRNo2dVLVQ32pyLZGHbJpGXQrdmAYjwt2EA9VsSCsUcqesTTQYBjQRBwbZ4p5JXd8WUQ7B?cluster=devnet) · [solve](https://explorer.solana.com/tx/5dBTTQPmqycpEbcpNm6V5aJotC5kZ7M1EUGSTLG9BYguSTGrtvkhoXZGsdaw4eJBkuGF1sRSsfDGcVURyW7mtU3P?cluster=devnet)
- streak PDA [FeN1o1akM2ARfDmbBoBh4xnkp9cK6ddi3CC3w2GzRH1w](https://explorer.solana.com/address/FeN1o1akM2ARfDmbBoBh4xnkp9cK6ddi3CC3w2GzRH1w?cluster=devnet)

### Bounty round 1006
- entry **2,000 PROOF** ≈ 0.010 SOL (TWAP, fixed at open), cap 2 · round [DXwpchhqgv28TmEdT3voPbo2gQsywCZwWn2nSsmwDfUN](https://explorer.solana.com/address/DXwpchhqgv28TmEdT3voPbo2gQsywCZwWn2nSsmwDfUN?cluster=devnet)
- joins: [A](https://explorer.solana.com/tx/3kzwyNF2Kx2t5ZrrRQJzVFDrnYEzhs4dtCaR6884XWeYz5t1jVuJNESrgaHz84VADKDCJEcnW1iMZ8yBhHXprF8g?cluster=devnet) · [B](https://explorer.solana.com/tx/44RFvw2GjhLoUiD9uhR3Y4BPceKWCMxLY1vRtCZS5KHiBocuJwgawZRDCRdLUxE4qMBnEtyjJ9ewnUbwwSyuCaU9?cluster=devnet) (each: BurnChecked + 2× TransferChecked in one tx)
- after 2 joins: supply 1,199,600 → 1,199,200 (**−400** = 2 × 10%), treasury 200 → 400 (**+200** = 2 × 5%), escrow **3,400** (= 2 × 85%)
- play: A solved in 1 ([tx](https://explorer.solana.com/tx/3UeDSXqXCXt2keYW2jAJg4oqoNhdriy8JjzWfWyUUxwVWLtBZMWRgC2KnDKrfkLJesjqekALg9r9zMYd5WfMzv7G?cluster=devnet)), B in 2 ([tx](https://explorer.solana.com/tx/HZd2B2o8u8vuGemAAdK7rHJEQUv5Yp47kKA8CpqQpNJZUbZdHJWhE2uiqs2KMHhfLJhD1UiyuMJEYvspYj9cNWG?cluster=devnet)). Settle (full + all done → early): [tx](https://explorer.solana.com/tx/2VPjWN5avPKc9zdCBt4kTmbn8b37He3sRoTyNMQM1BpUB9fjeNzL252P3Bj21Pr49VcJvKeVmqyvFfakFbMumAh?cluster=devnet)
- payout: k = ceil(30% × 2) = 1 → A gets the whole escrow: A 99,400 → 102,800 (**+3,400**), B unchanged 96,000, escrow → 0
- net per wallet: A 1,400 PROOF, B -2,000 PROOF; cards closed + round & escrow closed (rent back): **true**

### Duel 1007 (0.05 SOL each)
- create: [tx](https://explorer.solana.com/tx/3XizhApSWmxaNTDqwdC8MHzxkpaGKnRKgcq2KxFtB11pAaA3K5WdVaPNE4Byon3fSRJC7KQtmYTkM91bxYEWdXqW?cluster=devnet) · accept: [tx](https://explorer.solana.com/tx/34TBQGjyuW5dQEHTcxYYgUWvBZK77eptzQACZzGMk9yKmqBuWwAGhxDqTvYL9mvTZ8nSeRMFKvoztuD35Hc5uGWL?cluster=devnet) · settle/payout: [tx](https://explorer.solana.com/tx/2vv9oMTvhARFd6crX5XNgswWF8LcBLNbKtyanvZb1U8v8qNCktanMU5eFUM6stYoB4BDrAQSkuqKgitA1hT7QLvV?cluster=devnet)
- B solved in 1, A in 3 → B wins. Treasury +0.0050 SOL (5% of 0.1). B net 0.04498 SOL, A net -0.05003 SOL (incl. tx fees, card rent refunded, duel round rent back to A); duel round closed: **true**

### Token-2022 with MetadataPointer + TokenMetadata (what pump.fun creates)

Run at 2026-10-19T08:24:10.056Z (UTC). Program: [28yAvstxQRBHbd6rFCD1x5HFwJWgrVobSkDbVLKq1uVD](https://explorer.solana.com/address/28yAvstxQRBHbd6rFCD1x5HFwJWgrVobSkDbVLKq1uVD?cluster=devnet)

- test $PROOF mint (Token-2022 + metadata extensions, like pump.fun): [4t7FuEcYeGgyNZL14Cwj77LJeyg8uV62SVjvbCSpXFLU](https://explorer.solana.com/address/4t7FuEcYeGgyNZL14Cwj77LJeyg8uV62SVjvbCSpXFLU?cluster=devnet) · mock pool vaults FNfdht… / 8wHFKR… (0.000005 SOL per PROOF)

### Daily #1
- day board [HPRmdu7vdfWArCAiMP3BCyZVWK3u8BM5rftcTd8mLNrv](https://explorer.solana.com/address/HPRmdu7vdfWArCAiMP3BCyZVWK3u8BM5rftcTd8mLNrv?cluster=devnet); player sealed 2 rows on-chain, solved=true: [miss](https://explorer.solana.com/tx/2YVBPNBX6QB3M1JcY2QQNSixGzzyz8Vvkv9GruaisaPkmBB3peRJUghDiH248vdfnDqYx4C86fPddfPdqwjYkBUQ?cluster=devnet) · [solve](https://explorer.solana.com/tx/4NwsSfBQfXtFHmdZboZFeHyEb9EDMa5iUBgATfzAd4eN9yTPgEBfF2TprmBNnZqmDukZwxwxRprMDqt8RnPRqfp3?cluster=devnet)
- streak PDA [GESUmqyvqpqt1LSEYMUNbcLYGT6WBRpCR4WSttzvHQ6C](https://explorer.solana.com/address/GESUmqyvqpqt1LSEYMUNbcLYGT6WBRpCR4WSttzvHQ6C?cluster=devnet)

### Bounty round 1008
- entry **2,000 PROOF** ≈ 0.010 SOL (TWAP, fixed at open), cap 2 · round [DBomikV79dL2XnkFibrZhneagvetMM5P2cZjC3thMQ8k](https://explorer.solana.com/address/DBomikV79dL2XnkFibrZhneagvetMM5P2cZjC3thMQ8k?cluster=devnet)
- joins: [A](https://explorer.solana.com/tx/5Pd43rHwGyx3jAiDuGJdAqFADNRmEWSU4qzRKrXYmPPU9khc5gsru6yHD1dPrFibzbL4SQX1SjK8GNz1JFpq8C5b?cluster=devnet) · [B](https://explorer.solana.com/tx/kZEXxByYFnaR5o9nLzvATBZg3jLNotWa5zF5xsL9YnzRgVktMGdmwbWC99nwdZN5cC4zLdPaXtvFa8gC9njiHPV?cluster=devnet) (each: BurnChecked + 2× TransferChecked in one tx)
- after 2 joins: supply 1,200,000 → 1,199,600 (**−400** = 2 × 10%), treasury 0 → 200 (**+200** = 2 × 5%), escrow **3,400** (= 2 × 85%)
- play: A solved in 1 ([tx](https://explorer.solana.com/tx/2fiL7r2zqfoWaQcyjfnWQUALftqgnH7FT2rnVtG3zK3BgoQyiwjmfR1SfmP9s3VAw76srJpqAXJZoqtkqwMYaqPv?cluster=devnet)), B in 2 ([tx](https://explorer.solana.com/tx/662hwUvLRUQVuMxzrMq8QY6F2dczgMmSaXXTSLfaFgkjBURXcdN7DuqGK8zB2ShoAxVu3EmRE3TsVpEFQrUD2BK5?cluster=devnet)). Settle (full + all done → early): [tx](https://explorer.solana.com/tx/53oBfZscV8dLik1cqVmZLYDS3kdTfwxeDZ14pLgF8FrKjCUtzpLBcDiNWoTeqGpLmNzPzADswRodurd6hbGPHRT3?cluster=devnet)
- payout: k = ceil(30% × 2) = 1 → A gets the whole escrow: A 98,000 → 101,400 (**+3,400**), B unchanged 98,000, escrow → 0
- net per wallet: A 1,400 PROOF, B -2,000 PROOF; cards closed + round & escrow closed (rent back): **true**

### Duel 1009 (0.05 SOL each)
- create: [tx](https://explorer.solana.com/tx/LyB2zVEJDdi7UgYQ3E7htaoPazcBwUe5cr6rQXgkk6wA9GNHyATP9VutEsGojCwtTsiH1ebH72YE7kBtZsRDepB?cluster=devnet) · accept: [tx](https://explorer.solana.com/tx/4uayfzz9wiTEMkUCnH1eaAySp4m9zRWfVmkEaeHjP3RjKVy3DiWwcW3B3R8PcUgrc26JCnvR7F8ayWFF7cZofc7t?cluster=devnet) · settle/payout: [tx](https://explorer.solana.com/tx/58drt9tATcYHi4gMdG8x3SUBrzwdhz6REonnv6SgoN5yaScT57H1Q2FsUzJheJVt4rbV3ncxF7jpm2Fnh2qtYLhA?cluster=devnet)
- B solved in 1, A in 3 → B wins. Treasury +0.0050 SOL (5% of 0.1). B net 0.04498 SOL, A net -0.05003 SOL (incl. tx fees, card rent refunded, duel round rent back to A); duel round closed: **true**

## Program and round lifecycle transactions
- deploy: [tx](https://explorer.solana.com/tx/fkwFwgUsgHoRA19w6vprCrALceXHc3wigKhJ4DxkXhimFn1vhzXuugFd1tJVBEiZAC1Kmr5UZG5cypPZGxRrZdT?cluster=devnet) · upgrade with `close_round`: [tx](https://explorer.solana.com/tx/4WJJHoCjHBuNmDn6ccG86wji1XFkNZkMd47DoDxZj224cE1iLZhpnotVuj2ZhAqBx2ag3ytSeVhFFuEmPKMMpxWV?cluster=devnet)
- bounty 1003: reveal [tx](https://explorer.solana.com/tx/iV5Y8NtFXtSmPFoiFX3Q6QC1k2NfVhYkboTqJNzsSVG6TeHAiCshYrbpA2FfFMYhm3DnrCp8ZZgXPwC93UD7Li8?cluster=devnet) → settle (pays the escrow) [tx](https://explorer.solana.com/tx/2oZtXXS5a6ofRswcPKWLpfuZ1LS1nr8DoVSwubxLKr4zGMkrN8f9XkxHeCG6mNNgQB6MkMiFEXBBUKQLjDwEWimw?cluster=devnet) → close_card ×2 [tx](https://explorer.solana.com/tx/3p1g9kNLSQM88LLNnMptu8YLazV5Tbk87QEwqrCU4kfCWjyo8pRcW6RjnXXNu7WgpQD2YHXtTtMKH3Buh2kpAXiC?cluster=devnet) → close_round (escrow ATA + round rent to host) [tx](https://explorer.solana.com/tx/2cP6Gbz3ahq8Hju4w4cc6mrxDivvpAZbYKdHiEr7TKUwU72EoZ3ysv5LEzdMSr1sqgNJRE5J1jXArhaXPqwfDQpa?cluster=devnet)
- duel 1004: reveal [tx](https://explorer.solana.com/tx/2kn7ZFHnagX6xexWYkcUraYpWNhue7qtLyejJisxnMK1zZDeiReQtTRoZZqh7sSUJLvb9kCNL4p6zHf4HJCok7Vb?cluster=devnet) → settle / payout [tx](https://explorer.solana.com/tx/ShWTLqtBBbanGu31muXFEN7VAwgR3EyaHxumzegq69QBqfshVYz9VEFGvJW89TM5TfLMVcGUZ1trozuWVRzFFDU?cluster=devnet) → close_card ×2 [tx](https://explorer.solana.com/tx/JBnGBPheRGyZwdjLAEFpB7pozU6W7eL3Bt6JBBKiyRkWxZQMkQsh475cFUNNZT3gtmmHn5bVjzCzn4gvSUiePuo?cluster=devnet) → close_round (rent to the creator) [tx](https://explorer.solana.com/tx/4V6qR2MXBngcekoNMzYqQLoqv26cVigmkT4tSwTkescsUD7LYECz3mG8aFw6P9LLpUsJBTJR2FiXVLkUjcpjztPy?cluster=devnet)

Test wallets are throwaway devnet keys. The 10/5/85 split shows in the token supply (burn), the treasury token account (fee) and the round escrow (pot) after the two joins.
