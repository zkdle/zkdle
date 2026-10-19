# Mainnet launch checklist

Measured on 2026-10-19 against mainnet-beta rent (`getMinimumBalanceForRentExemption`). The program binary `program/target/deploy/zkdle.so` is 154,584 bytes (includes `close_round`).

## 0. Public wallets
| Role | Address |
|---|---|
| Treasury (5% fees; key never on the server) | `FuRUWehSQyB8EaMy5t8SRmYhKZEc8cBpYWBXripikXW6` |
| Host (server signer: opens/settles rounds, pays fees + reclaimable rent) | `FYY8DXRz2ZvirwQxJqgkfrjftDH3Bsfpn9AyQwm5evvU` |
| Deployer (deploys; upgrade authority until a multisig takes over) | `A79M6eVude5szKrAX1M9ppRkti7Bx6P1evyYeFKWJe4Z` |
| Program ID (mainnet) | [`4fCcuHmPEfyVu8AtEWE1CtFoLyUrh8S58SS471JDGLtu`](https://solscan.io/account/4fCcuHmPEfyVu8AtEWE1CtFoLyUrh8S58SS471JDGLtu) · config [`J2sBh74Fma5NBEeqwdsJKLcSswqsVM36DjFfLpnSbgd6`](https://solscan.io/account/J2sBh74Fma5NBEeqwdsJKLcSswqsVM36DjFfLpnSbgd6) |
| $PROOF mint | added at launch |

## 1. Program deploy cost (lean plan: exact size)
| Item | Size | SOL |
|---|---|---|
| ProgramData, exact size (`solana program deploy`, no `--max-len`) | 154,629 B | **0.7862** |
| Program account | 36 B | 0.0008 |
| Deploy buffer (temporary, refunded when the deploy finishes) | ≈ ProgramData | 0.786, returned |
| Write transactions (~155 × 5,000 lamports, plus priority fees) | – | ~0.002–0.02 |
| `setup` config PDA | 68 B | 0.0010 |

**Deployer: fund ~1.6 SOL.** After the deploy, ≈ 0.79 SOL stays locked as program rent and the buffer's ≈ 0.79 SOL comes back. A later upgrade to a bigger binary runs `solana program extend` automatically (the CLI auto-extends, costing ≈ 0.0051 SOL per extra KB) and needs a temporary buffer of the new size.

## 2. Upgrade authority plan
- `A79M…` deploys and holds the upgrade authority during early access. Keep it offline or on a hardware wallet, never on Render.
- Later: move it to a Squads multisig with `solana program set-upgrade-authority <PROGRAM_ID> --new-upgrade-authority <SQUADS_VAULT>`, and announce it.
- Upgrades: deploy to a buffer, compare the verifiable build hash, then switch over.
- When the rules are final, consider `--final` (immutable).
- The host key is separate and rotatable with `set_admin` (both keys sign).

## 3. Running costs (paid by the host key)
| Account | When | Rent (SOL) | Comes back? |
|---|---|---|---|
| Day account (75 B) | 1 / day | 0.00103 | no (kept as the public record of the day) |
| Bounty round account (179 B) | 24 / day (1 h rounds) | 0.00156 | **yes**, by `close_round` right after settle |
| Round escrow token account (165 B) | 24 / day | 0.00149 | **yes**, closed by `close_round` (must be empty) |
| Seat cards (175 B) | per seat, paid by the player | 0.00154 | yes, to the player (`close_card`) |
| Tx fees (open, reveal, settle, close cards, close round) | ~6 tx / round | ~0.00003 | – |

After every settle the server closes each card (rent to its player) and then the round (escrow and round rent back to whoever opened it: the host for bounties, the creator for duels). Each bounty round has about **0.003 SOL** in flight for an hour, so the host's real cost is **≈ 0.002 SOL/day** (day accounts plus fees, ≈ 0.06 SOL/month). If a card can't be closed, `close_round` still works 24 h after the end, and leftover cards stay closable by anyone, rent to their player.

**Fund the host (`FYY8…`) with 1 SOL.** With `close_round` reclaiming rent, that covers rounds in flight (≈ 0.003 SOL each), months of day accounts and fees, and priority fees, with plenty of margin.

## 4. Treasury
- `ZK_TREASURY=FuRUWehSQyB8EaMy5t8SRmYhKZEc8cBpYWBXripikXW6` (fresh, no history).
- It needs ~0.002 SOL so it isn't an empty system account (recommended, not strictly required).
- Its $PROOF associated token account must exist before the first entry. The server creates it idempotently when it opens the first bounty (host pays 0.00149 SOL). You can also pre-create it right after the mint exists: `spl-token create-account <MINT> --owner FuRUWehSQyB8EaMy5t8SRmYhKZEc8cBpYWBXripikXW6 --fee-payer <host>`.
- The treasury private key never goes on the server.

## 5. Render environment
| Var | Value |
|---|---|
| `ZK_PREVIEW` | `1` until launch; set to `0` to open the games |
| `ZK_CLUSTER` | `mainnet` |
| `ZK_RPC` | Helius mainnet URL (with key; stays server-side, browsers use `/api/rpc`) |
| `ZK_PROGRAM_ID` | from the deploy |
| `ZK_HOST_KEY` | secret key of host `FYY8DXRz2ZvirwQxJqgkfrjftDH3Bsfpn9AyQwm5evvU` (JSON array or base58), funded as above |
| `ZK_TREASURY` | `FuRUWehSQyB8EaMy5t8SRmYhKZEc8cBpYWBXripikXW6` |
| `ZK_SECRET_KEY` | `openssl rand -hex 32`; back it up, because losing it makes the state file unreadable |
| `ZK_DB` | `/var/data/zkdle.db` (Render persistent disk mounted at `/var/data`, 1 GB; the server creates the directory and file if missing) |
| `ZK_BASE_URL` | `https://zkdle.fun` |
| `ZK_TOKEN_MINT` | empty until $PROOF launches. While empty, bounty shows "opens at token launch" |
| `ZK_PRICE_POOL_VAULTS` | normally leave empty: the pump.fun curve is read before graduation and the canonical PumpSwap pool is found automatically after it. Set it only to force a specific pool (`<token vault>,<wSOL vault>`) |
| `ZK_FEE_BPS` | `500` (already in the on-chain config; must match what `setup` used) |
| optional | `ZK_ROUND_ENTRY_SOL=0.01`, `ZK_ROUND_CAP=12`, `ZK_MAX_POT_SOL_EQUIV=5`, `ZK_X_URL=https://x.com/zkdlefun` |

## 6. Launch order
1. Done 2026-10-19: program `4fCcuHmPEfyVu8AtEWE1CtFoLyUrh8S58SS471JDGLtu` verified build by `A79M…` ([deploy tx](https://solscan.io/tx/5do9F5EGfDhnD1qKm3r14Ad3C3UUjm5EFf93Y1gN2c4FxZZS8uSZyAgoSw76xBK8T5uSTys5Xws1gDrrbk4VLv6Y), [config setup tx](https://solscan.io/tx/41LFWwy9DdDDqaFVRbA9PiAtFEQ9K7mznjy5whneapSkZwP2dkCTvs3vkxRzKyb55WLiRHNFmGLWDnLT7Jb1FHhD)); on-chain bytes match the build.
2. Run `setup(host=FYY8…, treasury=FuRU…, fee 500)` once. Check the config PDA.
3. Fund the host with 1 SOL and send the treasury ~0.002 SOL. Set the Render env (`ZK_PREVIEW=1` still) and check `/api/config` in full mode on a staging service.
4. Flip `ZK_PREVIEW=0`. The Daily and duels go live; bounty waits for the mint.
5. After the $PROOF launch, run `node scripts/set-mint-check.js <MINT>` (see "When the CA arrives" below), set `ZK_TOKEN_MINT` and redeploy. The first bounty round opens once the price TWAP has 3 fresh samples (≈ 3 minutes after boot); the server never opens a round on the fallback entry.
6. Add the Program ID and mint to the site, docs and README wallet tables.
7. Later: move the upgrade authority to Squads.

## What the user provides or funds
- Deployer `A79M6eVude5szKrAX1M9ppRkti7Bx6P1evyYeFKWJe4Z`: **~1.6 SOL** (≈ 0.79 SOL comes back after the deploy).
- Host `FYY8DXRz2ZvirwQxJqgkfrjftDH3Bsfpn9AyQwm5evvU`: **1 SOL**, plus its secret key in the Render env only.
- Treasury `FuRUWehSQyB8EaMy5t8SRmYhKZEc8cBpYWBXripikXW6`: ~0.002 SOL rent top-up.
- A Helius mainnet API key (Render env only), a Render persistent disk, and a generated and backed-up `ZK_SECRET_KEY`.
- The $PROOF mint address after the launch. A Squads multisig later.

## When the CA arrives
pump.fun coins are created as **Token-2022** mints (6 decimals, MetadataPointer + TokenMetadata extensions). The program, server and site handle both Token-2022 and legacy SPL Token; the full e2e suite passes against the exact verified build with both (`ZK_E2E_TOKEN22=1 ZK_E2E_SO=<verified .so> node scripts/e2e.js`).

1. `ZK_RPC=<helius url> node scripts/set-mint-check.js <MINT>`. It must show: token program, `decimals 6`, mint/freeze authority `none`, no BLOCKER line, a price source (`pump.fun bonding curve`) and a sane "0.01 SOL entry" token count.
2. Render env: set `ZK_TOKEN_MINT=<MINT>`. Nothing else is required (`ZK_TOKEN_DECIMALS` only if the script says decimals isn't 6; the token program is read from the mint).
3. Redeploy. In the log: `token program Tokenz… decimals 6`, then `bounty: waiting for a $PROOF price` for a few minutes, then the first round opens (the server creates the treasury's token account in that transaction).
4. Check `/api/config` shows the mint and `/api/rounds` shows a round whose entry ≈ 0.01 SOL of $PROOF (`priceSource` starts with `twap:pump-curve`).
5. Post the CA on @zkdlefun and add it to the site/README wallet tables.

At graduation nothing needs doing: the curve reports `complete` and the pricer switches to the PumpSwap pool's reserves. The TWAP smooths the switch.
