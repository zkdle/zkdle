# ZKdle devnet run

Run at 2026-10-19T06:27:56.492Z (UTC). Program: [28yAvstxQRBHbd6rFCD1x5HFwJWgrVobSkDbVLKq1uVD](https://explorer.solana.com/address/28yAvstxQRBHbd6rFCD1x5HFwJWgrVobSkDbVLKq1uVD?cluster=devnet)

- test $PROOF mint: [GGaJ7Mb2Qq3BC6394pUpXjEGzWpcBtSFqmPSy9aukSfG](https://explorer.solana.com/address/GGaJ7Mb2Qq3BC6394pUpXjEGzWpcBtSFqmPSy9aukSfG?cluster=devnet) · mock pool vaults 6GJSH7… / H89AZM… (0.000005 SOL per PROOF)

## Daily #1
- day board [HPRmdu7vdfWArCAiMP3BCyZVWK3u8BM5rftcTd8mLNrv](https://explorer.solana.com/address/HPRmdu7vdfWArCAiMP3BCyZVWK3u8BM5rftcTd8mLNrv?cluster=devnet); player sealed 2 rows on-chain, solved=true: [miss](https://explorer.solana.com/tx/21kV2qLSfDo5BnWc8WBaBDAp43Jt8Ek9mRhj8Y2wzUfkknfwzsFp5yHL9fQ66egkMKrcTyTcgnhbKzVGkqHYDfiF?cluster=devnet) · [solve](https://explorer.solana.com/tx/5SA7fNbBEXnBU4Dnf4fjyfyViBcJL2vs8HwqNoaWLTLeRunZo4rdDUj7LjUc31hRFG6oU2BiWEBdXpWWWqzJdiip?cluster=devnet)
- streak PDA [ESH7xzgjNj2pPQuLNHTmNCnxqJBY8SABL7PV3eWAArp8](https://explorer.solana.com/address/ESH7xzgjNj2pPQuLNHTmNCnxqJBY8SABL7PV3eWAArp8?cluster=devnet)

## Bounty round 1003
- entry **2,000 PROOF** ≈ 0.010 SOL (TWAP, fixed at open), cap 2 · round [4K1KrKiaMuZnKBuwj5VhapERvtw9MhCCugkbp2Xb5EaN](https://explorer.solana.com/address/4K1KrKiaMuZnKBuwj5VhapERvtw9MhCCugkbp2Xb5EaN?cluster=devnet)
- joins: [A](https://explorer.solana.com/tx/FZSijUdbFvg35B2jWRQWxzBgBqjU719EAEMMVWPQhCbQ4BnW6p978JXCK6oTo4KDo6aD4kwmFQrdzoVBJzVqHWF?cluster=devnet) · [B](https://explorer.solana.com/tx/4tFWchAqpfCPxyuPuhXRWwQAhhzAhuVx3xCb1G1igvkBGLfq1Upja7c8wrrWtUgMyNU7jsRhQXNmKgzMe4sP5hDn?cluster=devnet) (each: BurnChecked + 2× TransferChecked in one tx)
- after 2 joins: supply 1,200,000 → 1,199,600 (**−400** = 2 × 10%), treasury 0 → 200 (**+200** = 2 × 5%), escrow **3,400** (= 2 × 85%)
- play: A solved in 1 ([tx](https://explorer.solana.com/tx/PWifd3wdFMJtfX6dhDdpbyhrBEJY2k8vHFvdMrVY2Z8i3aW8EgwPfXpskt96Z66j3cR9nnYGXAXoWJPjXHG4395?cluster=devnet)), B in 2 ([tx](https://explorer.solana.com/tx/2NgzxT65CbR7uEwg7VEfWgiQrF1eJcTfw9kxiaZkpLiFkfdRrEJ88rMuVheGo1cSrMYQNwAm1hkuX44fjgRsSrFq?cluster=devnet)). Settle (full + all done → early): [tx](https://explorer.solana.com/tx/2oZtXXS5a6ofRswcPKWLpfuZ1LS1nr8DoVSwubxLKr4zGMkrN8f9XkxHeCG6mNNgQB6MkMiFEXBBUKQLjDwEWimw?cluster=devnet)
- payout: k = ceil(30% × 2) = 1 → A gets the whole escrow: A 98,000 → 101,400 (**+3,400**), B unchanged 98,000, escrow → 0
- net per wallet: A 1,400 PROOF, B -2,000 PROOF; cards closed + round & escrow closed (rent back): **true**

## Duel 1004 (0.05 SOL each)
- create: [tx](https://explorer.solana.com/tx/4r1awCeGHZ85jroFPwxi5J4vVZAKL8kXHS8mDqhecELUNGhKpctfoYNLbqydBfde1ZGgL41G9VN9j4GJuAkYA6uT?cluster=devnet) · accept: [tx](https://explorer.solana.com/tx/31ESTFDQdh7QUZPYzbfKuXqaupHQHPbjKTVGAaJtsNYd5g7BqRK4fgR6uQSuooHSBv3Wd6g8hEbgemSiyJzhXEPZ?cluster=devnet) · settle/payout: [tx](https://explorer.solana.com/tx/ShWTLqtBBbanGu31muXFEN7VAwgR3EyaHxumzegq69QBqfshVYz9VEFGvJW89TM5TfLMVcGUZ1trozuWVRzFFDU?cluster=devnet)
- B solved in 1, A in 3 → B wins. Treasury +0.0050 SOL (5% of 0.1). B net 0.04498 SOL, A net -0.05003 SOL (incl. tx fees, card rent refunded, duel round rent back to A); duel round closed: **true**

## Program and round lifecycle transactions
- deploy: [tx](https://explorer.solana.com/tx/fkwFwgUsgHoRA19w6vprCrALceXHc3wigKhJ4DxkXhimFn1vhzXuugFd1tJVBEiZAC1Kmr5UZG5cypPZGxRrZdT?cluster=devnet) · upgrade with `close_round`: [tx](https://explorer.solana.com/tx/4WJJHoCjHBuNmDn6ccG86wji1XFkNZkMd47DoDxZj224cE1iLZhpnotVuj2ZhAqBx2ag3ytSeVhFFuEmPKMMpxWV?cluster=devnet)
- bounty 1003: reveal [tx](https://explorer.solana.com/tx/iV5Y8NtFXtSmPFoiFX3Q6QC1k2NfVhYkboTqJNzsSVG6TeHAiCshYrbpA2FfFMYhm3DnrCp8ZZgXPwC93UD7Li8?cluster=devnet) → settle (pays the escrow) [tx](https://explorer.solana.com/tx/2oZtXXS5a6ofRswcPKWLpfuZ1LS1nr8DoVSwubxLKr4zGMkrN8f9XkxHeCG6mNNgQB6MkMiFEXBBUKQLjDwEWimw?cluster=devnet) → close_card ×2 [tx](https://explorer.solana.com/tx/3p1g9kNLSQM88LLNnMptu8YLazV5Tbk87QEwqrCU4kfCWjyo8pRcW6RjnXXNu7WgpQD2YHXtTtMKH3Buh2kpAXiC?cluster=devnet) → close_round (escrow ATA + round rent to host) [tx](https://explorer.solana.com/tx/2cP6Gbz3ahq8Hju4w4cc6mrxDivvpAZbYKdHiEr7TKUwU72EoZ3ysv5LEzdMSr1sqgNJRE5J1jXArhaXPqwfDQpa?cluster=devnet)
- duel 1004: reveal [tx](https://explorer.solana.com/tx/2kn7ZFHnagX6xexWYkcUraYpWNhue7qtLyejJisxnMK1zZDeiReQtTRoZZqh7sSUJLvb9kCNL4p6zHf4HJCok7Vb?cluster=devnet) → settle / payout [tx](https://explorer.solana.com/tx/ShWTLqtBBbanGu31muXFEN7VAwgR3EyaHxumzegq69QBqfshVYz9VEFGvJW89TM5TfLMVcGUZ1trozuWVRzFFDU?cluster=devnet) → close_card ×2 [tx](https://explorer.solana.com/tx/JBnGBPheRGyZwdjLAEFpB7pozU6W7eL3Bt6JBBKiyRkWxZQMkQsh475cFUNNZT3gtmmHn5bVjzCzn4gvSUiePuo?cluster=devnet) → close_round (rent to the creator) [tx](https://explorer.solana.com/tx/4V6qR2MXBngcekoNMzYqQLoqv26cVigmkT4tSwTkescsUD7LYECz3mG8aFw6P9LLpUsJBTJR2FiXVLkUjcpjztPy?cluster=devnet)

Test wallets are throwaway devnet keys. The 10/5/85 split shows in the token supply (burn), the treasury token account (fee) and the round escrow (pot) after the two joins.
