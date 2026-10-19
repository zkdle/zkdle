//! ZKdle — sealed five-letter words with proven feedback.
//!
//! Every clue a player receives is a Groth16 proof that the colours were
//! computed against the committed Poseidon seal. The chain checks it.

use groth16_solana::groth16::Groth16Verifier;
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint,
    entrypoint::ProgramResult,
    hash::hashv,
    msg,
    instruction::{AccountMeta, Instruction},
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction, system_program,
    sysvar::Sysvar,
};

mod vk;

#[cfg(not(feature = "no-entrypoint"))]
entrypoint!(run);

#[cfg(not(feature = "no-entrypoint"))]
solana_security_txt::security_txt! {
    name: "ZKdle",
    project_url: "https://zkdle.fun",
    contacts: "link:https://github.com/zkdle/zkdle/security,link:https://x.com/zkdlefun",
    policy: "https://github.com/zkdle/zkdle/blob/main/SECURITY.md",
    source_code: "https://github.com/zkdle/zkdle",
    preferred_languages: "en"
}

const CONFIG: u8 = 1;
const DAY: u8 = 2;
const CARD: u8 = 3;
const STREAK: u8 = 4;
const ROUND: u8 = 5;

const CONFIG_LEN: usize = 68;
const DAY_LEN: usize = 75;
const CARD_LEN: usize = 175;
const STREAK_LEN: usize = 53;
const ROUND_LEN: usize = 179; // .. 143 payer[32] (gets the rent back) | 175 closed_cards[4]
const GRACE_SECS: i64 = 86_400;
const BOUNTY: u8 = 0; // entry in the SPL token, burn + fee at join, pot escrowed in the round's token account
const MAX_BURN_BPS: u16 = 5000;
const TOKEN_ID: Pubkey = solana_program::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN22_ID: Pubkey = solana_program::pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const MAX_ROWS: u8 = 6;
/// Early-access cap: settle pays everyone in one transaction, and 12 seats is what fits comfortably.
const MAX_SEATS: u32 = 12;

#[derive(Debug)]
enum Oops {
    BadSigner = 1,
    BadAccount,
    BadProof,
    Finished,
    Closed,
    Full,
    NotYet,
    SeedMismatch,
    BadClue,
    Missing,
}
impl From<Oops> for ProgramError {
    fn from(e: Oops) -> Self {
        msg!("zkdle: {:?}", e);
        ProgramError::Custom(e as u32)
    }
}

// ---------- tiny byte helpers ----------
fn rd<const N: usize>(d: &[u8], at: usize) -> [u8; N] {
    d[at..at + N].try_into().unwrap()
}
fn u32_at(d: &[u8], at: usize) -> u32 { u32::from_le_bytes(rd(d, at)) }
fn u64_at(d: &[u8], at: usize) -> u64 { u64::from_le_bytes(rd(d, at)) }
fn i64_at(d: &[u8], at: usize) -> i64 { i64::from_le_bytes(rd(d, at)) }
fn put(d: &mut [u8], at: usize, v: &[u8]) { d[at..at + v.len()].copy_from_slice(v); }

fn need_signer(a: &AccountInfo) -> ProgramResult {
    if a.is_signer { Ok(()) } else { Err(Oops::BadSigner.into()) }
}

fn make_pda<'a>(
    pid: &Pubkey,
    payer: &AccountInfo<'a>,
    target: &AccountInfo<'a>,
    sys: &AccountInfo<'a>,
    seeds: &[&[u8]],
    len: usize,
) -> ProgramResult {
    let (key, bump) = Pubkey::find_program_address(seeds, pid);
    if key != *target.key || *sys.key != system_program::id() {
        return Err(Oops::BadAccount.into());
    }
    let lamports = Rent::get()?.minimum_balance(len);
    let mut full: Vec<&[u8]> = seeds.to_vec();
    let b = [bump];
    full.push(&b);
    invoke_signed(
        &system_instruction::create_account(payer.key, target.key, lamports, len as u64, pid),
        &[payer.clone(), target.clone(), sys.clone()],
        &[&full],
    )
}

fn owned(pid: &Pubkey, a: &AccountInfo, tag: u8) -> ProgramResult {
    if a.owner != pid || a.data_is_empty() || a.data.borrow()[0] != tag {
        return Err(Oops::BadAccount.into());
    }
    Ok(())
}

fn config_admin(pid: &Pubkey, cfg: &AccountInfo) -> Result<(Pubkey, Pubkey, u16), ProgramError> {
    owned(pid, cfg, CONFIG)?;
    let (key, _) = Pubkey::find_program_address(&[b"cfg"], pid);
    if key != *cfg.key { return Err(Oops::BadAccount.into()); }
    let d = cfg.data.borrow();
    Ok((Pubkey::new_from_array(rd(&d, 1)), Pubkey::new_from_array(rd(&d, 33)), u16::from_le_bytes(rd(&d, 65))))
}

pub fn run(pid: &Pubkey, accts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let (op, rest) = data.split_first().ok_or(ProgramError::InvalidInstructionData)?;
    match op {
        0 => setup(pid, accts, rest),
        1 => open_day(pid, accts, rest),
        2 => guess(pid, accts, rest),
        3 => open_round(pid, accts, rest),
        4 => join(pid, accts, rest),
        5 => reveal_round(pid, accts, rest),
        6 => settle(pid, accts),
        7 => reveal_day(pid, accts, rest),
        8 => mend_streak(pid, accts),
        9 => close_card(pid, accts),
        10 => set_admin(pid, accts),
        11 => close_round(pid, accts),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

/// 0: admin, cfg, sys | treasury[32] fee_bps[2]
fn setup(pid: &Pubkey, a: &[AccountInfo], d: &[u8]) -> ProgramResult {
    let it = &mut a.iter();
    let (admin, cfg, sys) = (next_account_info(it)?, next_account_info(it)?, next_account_info(it)?);
    need_signer(admin)?;
    if d.len() < 34 { return Err(ProgramError::InvalidInstructionData); }
    let fee = u16::from_le_bytes(rd(d, 32));
    if fee > 2000 { return Err(ProgramError::InvalidArgument); }
    make_pda(pid, admin, cfg, sys, &[b"cfg"], CONFIG_LEN)?;
    let mut c = cfg.data.borrow_mut();
    c[0] = CONFIG;
    put(&mut c, 1, admin.key.as_ref());
    put(&mut c, 33, &d[..32]);
    put(&mut c, 65, &fee.to_le_bytes());
    Ok(())
}

/// 10: admin, new_admin, cfg — rotate the host key. Both keys sign, so a typo can't brick the config.
fn set_admin(pid: &Pubkey, a: &[AccountInfo]) -> ProgramResult {
    let it = &mut a.iter();
    let (admin, new_admin, cfg) = (next_account_info(it)?, next_account_info(it)?, next_account_info(it)?);
    need_signer(admin)?;
    need_signer(new_admin)?;
    if config_admin(pid, cfg)?.0 != *admin.key { return Err(Oops::BadSigner.into()); }
    put(&mut cfg.data.borrow_mut(), 1, new_admin.key.as_ref());
    msg!("zkdle: host rotated to {}", new_admin.key);
    Ok(())
}

/// 1: admin, cfg, day, sys | day[4] seal[32]
fn open_day(pid: &Pubkey, a: &[AccountInfo], d: &[u8]) -> ProgramResult {
    let it = &mut a.iter();
    let (admin, cfg, day, sys) = (next_account_info(it)?, next_account_info(it)?, next_account_info(it)?, next_account_info(it)?);
    need_signer(admin)?;
    if config_admin(pid, cfg)?.0 != *admin.key { return Err(Oops::BadSigner.into()); }
    let n: [u8; 4] = rd(d, 0);
    make_pda(pid, admin, day, sys, &[b"day", &n], DAY_LEN)?;
    let mut x = day.data.borrow_mut();
    x[0] = DAY;
    put(&mut x, 1, &n);
    put(&mut x, 5, &d[4..36]);
    Ok(())
}

/// 7: admin, cfg, day | word[5] salt[32]  (published for anyone to re-hash)
fn reveal_day(pid: &Pubkey, a: &[AccountInfo], d: &[u8]) -> ProgramResult {
    let it = &mut a.iter();
    let (admin, cfg, day) = (next_account_info(it)?, next_account_info(it)?, next_account_info(it)?);
    need_signer(admin)?;
    if config_admin(pid, cfg)?.0 != *admin.key { return Err(Oops::BadSigner.into()); }
    owned(pid, day, DAY)?;
    let mut x = day.data.borrow_mut();
    x[37] = 1;
    put(&mut x, 38, &d[..37]);
    Ok(())
}

fn check_proof(seal: &[u8; 32], g: &[u8], clue: &[u8], proof: &[u8]) -> ProgramResult {
    let mut inputs = [[0u8; 32]; 11];
    for i in 0..5 {
        if g[i] > 25 || clue[i] > 2 { return Err(Oops::BadClue.into()); }
        inputs[i][31] = clue[i];
        inputs[5 + i][31] = g[i];
    }
    inputs[10] = *seal;
    let pa: [u8; 64] = rd(proof, 0);
    let pb: [u8; 128] = rd(proof, 64);
    let pc: [u8; 64] = rd(proof, 192);
    let mut v = Groth16Verifier::new(&pa, &pb, &pc, &inputs, &vk::VK).map_err(|_| Oops::BadProof)?;
    v.verify().map_err(|_| Oops::BadProof)?;
    Ok(())
}

// Card layout: 0 tag | 1 board | 33 player | 65 rows | 66 solved | 67 solved_at | 75 start | 83 seal | 115 rows[6][10]
/// 2: player, card, board(day|round), streak, sys | guess[5] clue[5] proof[256]
fn guess(pid: &Pubkey, a: &[AccountInfo], d: &[u8]) -> ProgramResult {
    let it = &mut a.iter();
    let player = next_account_info(it)?;
    let card = next_account_info(it)?;
    let board = next_account_info(it)?;
    let streak = next_account_info(it)?;
    let sys = next_account_info(it)?;
    need_signer(player)?;
    if d.len() < 266 { return Err(ProgramError::InvalidInstructionData); }
    let (g, clue, proof) = (&d[0..5], &d[5..10], &d[10..266]);
    let now = Clock::get()?.unix_timestamp;

    if board.owner != pid { return Err(Oops::BadAccount.into()); }
    let kind = board.data.borrow()[0];
    let mut day_no = None;
    match kind {
        DAY => {
            let bd = board.data.borrow();
            if bd[37] == 1 { return Err(Oops::Closed.into()); }
            day_no = Some(u32_at(&bd, 1));
            let seal: [u8; 32] = rd(&bd, 5);
            drop(bd);
            if card.data_is_empty() {
                make_pda(pid, player, card, sys, &[b"card", board.key.as_ref(), player.key.as_ref()], CARD_LEN)?;
                let mut c = card.data.borrow_mut();
                c[0] = CARD;
                put(&mut c, 1, board.key.as_ref());
                put(&mut c, 33, player.key.as_ref());
                put(&mut c, 75, &now.to_le_bytes());
                put(&mut c, 83, &seal);
            }
        }
        ROUND => {
            let bd = board.data.borrow();
            if now >= i64_at(&bd, 25) || bd[98] == 1 { return Err(Oops::Closed.into()); }
        }
        _ => return Err(Oops::BadAccount.into()),
    }
    owned(pid, card, CARD)?;
    let mut c = card.data.borrow_mut();
    if c[1..33] != board.key.as_ref()[..] || c[33..65] != player.key.as_ref()[..] { return Err(Oops::BadAccount.into()); }
    if c[66] == 1 || c[65] >= MAX_ROWS { return Err(Oops::Finished.into()); }
    let seal: [u8; 32] = rd(&c, 83);
    check_proof(&seal, g, clue, proof)?;

    let row = c[65] as usize;
    put(&mut c, 115 + row * 10, g);
    put(&mut c, 120 + row * 10, clue);
    c[65] += 1;
    let won = clue.iter().all(|&x| x == 1);
    if won {
        c[66] = 1;
        put(&mut c, 67, &now.to_le_bytes());
    }
    let done = won || c[65] == MAX_ROWS;
    drop(c);

    if let (Some(n), true) = (day_no, done) {
        bump_streak(pid, player, streak, sys, n, won)?;
    }
    Ok(())
}

// Streak: 0 tag | 1 player | 33 current | 37 best | 41 solves | 45 last_day+1 | 49 mends
fn bump_streak<'a>(pid: &Pubkey, player: &AccountInfo<'a>, s: &AccountInfo<'a>, sys: &AccountInfo<'a>, day: u32, won: bool) -> ProgramResult {
    if s.data_is_empty() {
        make_pda(pid, player, s, sys, &[b"streak", player.key.as_ref()], STREAK_LEN)?;
        let mut x = s.data.borrow_mut();
        x[0] = STREAK;
        put(&mut x, 1, player.key.as_ref());
    }
    owned(pid, s, STREAK)?;
    let mut x = s.data.borrow_mut();
    if x[1..33] != player.key.as_ref()[..] { return Err(Oops::BadAccount.into()); }
    let last = u32_at(&x, 45);
    if last >= day + 1 { return Ok(()); }
    let mut cur = u32_at(&x, 33);
    if won {
        cur = if last == day { cur + 1 } else { 1 };
        let solves = u32_at(&x, 41) + 1;
        put(&mut x, 41, &solves.to_le_bytes());
    } else {
        cur = 0;
    }
    let best = u32_at(&x, 37).max(cur);
    put(&mut x, 33, &cur.to_le_bytes());
    put(&mut x, 37, &best.to_le_bytes());
    put(&mut x, 45, &(day + 1).to_le_bytes());
    Ok(())
}

/// 8: player, admin, cfg, streak — admin co-signs after the server has seen
/// the token burn; bridges exactly one missed day.
fn mend_streak(pid: &Pubkey, a: &[AccountInfo]) -> ProgramResult {
    let it = &mut a.iter();
    let (player, admin, cfg, s) = (next_account_info(it)?, next_account_info(it)?, next_account_info(it)?, next_account_info(it)?);
    need_signer(player)?;
    need_signer(admin)?;
    if config_admin(pid, cfg)?.0 != *admin.key { return Err(Oops::BadSigner.into()); }
    owned(pid, s, STREAK)?;
    let mut x = s.data.borrow_mut();
    if x[1..33] != player.key.as_ref()[..] { return Err(Oops::BadAccount.into()); }
    let last = u32_at(&x, 45) + 1;
    put(&mut x, 45, &last.to_le_bytes());
    let m = u32_at(&x, 49) + 1;
    put(&mut x, 49, &m.to_le_bytes());
    Ok(())
}

// ---------- SPL token CPI (works for Token and Token-2022 without extensions) ----------
fn is_token_program(k: &Pubkey) -> bool { *k == TOKEN_ID || *k == TOKEN22_ID }
fn amount_ix(prog: &Pubkey, op: u8, amount: u64, decimals: u8, keys: Vec<AccountMeta>) -> Instruction {
    let mut data = vec![op];
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(decimals);
    Instruction { program_id: *prog, accounts: keys, data }
}
fn mint_decimals(mint: &AccountInfo) -> Result<u8, ProgramError> {
    let d = mint.data.borrow();
    if d.len() < 82 { return Err(Oops::BadAccount.into()); }
    Ok(d[44])
}
/// Token account sanity: owned by the token program, right mint, right owner. Returns the balance.
fn token_acct(ta: &AccountInfo, tp: &Pubkey, mint: &Pubkey, owner: &Pubkey) -> Result<u64, ProgramError> {
    if ta.owner != tp { return Err(Oops::BadAccount.into()); }
    let d = ta.data.borrow();
    if d.len() < 165 || d[0..32] != mint.as_ref()[..] || d[32..64] != owner.as_ref()[..] { return Err(Oops::BadAccount.into()); }
    Ok(u64_at(&d, 64))
}

// Round: 0 tag | 1 id | 9 entry | 17 cap | 21 entrants | 25 ends_at | 33 commit | 65 seed | 97 revealed | 98 settled | 99 kind
//        100 mint | 132 burn_bps | 134 decimals | 135 entry_ref_lamports (what the entry was worth in SOL at open; display only)
/// 3: payer, admin, cfg, round, sys, [mint] | id[8] entry[8] cap[4] secs[8] commit[32] kind[1] [burn_bps[2] ref_lamports[8]]
fn open_round(pid: &Pubkey, a: &[AccountInfo], d: &[u8]) -> ProgramResult {
    let it = &mut a.iter();
    let (payer, admin, cfg, round, sys) =
        (next_account_info(it)?, next_account_info(it)?, next_account_info(it)?, next_account_info(it)?, next_account_info(it)?);
    need_signer(payer)?;
    need_signer(admin)?;
    if config_admin(pid, cfg)?.0 != *admin.key { return Err(Oops::BadSigner.into()); }
    if d.len() < 61 { return Err(ProgramError::InvalidInstructionData); }
    let cap = u32_at(d, 16);
    if !(2..=MAX_SEATS).contains(&cap) { return Err(ProgramError::InvalidArgument); }
    let ends = Clock::get()?.unix_timestamp + i64_at(d, 20);
    make_pda(pid, payer, round, sys, &[b"round", &d[0..8]], ROUND_LEN)?;
    let mut r = round.data.borrow_mut();
    r[0] = ROUND;
    put(&mut r, 1, &d[0..16]);
    put(&mut r, 17, &cap.to_le_bytes());
    put(&mut r, 25, &ends.to_le_bytes());
    put(&mut r, 33, &d[28..60]);
    r[99] = d[60];
    put(&mut r, 143, payer.key.as_ref());
    if d[60] == BOUNTY {
        let mint = next_account_info(it)?;
        if d.len() < 71 || !is_token_program(mint.owner) { return Err(Oops::BadAccount.into()); }
        let burn = u16::from_le_bytes(rd(d, 61));
        if burn > MAX_BURN_BPS { return Err(ProgramError::InvalidArgument); }
        if u64_at(d, 8) == 0 { return Err(ProgramError::InvalidArgument); }
        r[134] = mint_decimals(mint)?;
        put(&mut r, 100, mint.key.as_ref());
        put(&mut r, 132, &burn.to_le_bytes());
        put(&mut r, 135, &d[63..71]);
    }
    Ok(())
}

/// 4: player, admin, cfg, round, card, sys, [player_ta, mint, vault, treasury_ta, token_program] | seal[32]
/// Bounty: burn_bps of the entry is burned, fee_bps goes to the treasury's token account, the rest is escrowed
/// in the round's own token account (owner = round PDA). Duel: the SOL stake moves into the round PDA.
fn join<'a>(pid: &Pubkey, a: &[AccountInfo<'a>], d: &[u8]) -> ProgramResult {
    let it = &mut a.iter();
    let (player, admin, cfg, round, card, sys) = (
        next_account_info(it)?, next_account_info(it)?, next_account_info(it)?,
        next_account_info(it)?, next_account_info(it)?, next_account_info(it)?,
    );
    need_signer(player)?;
    need_signer(admin)?;
    if config_admin(pid, cfg)?.0 != *admin.key { return Err(Oops::BadSigner.into()); }
    owned(pid, round, ROUND)?;
    let now = Clock::get()?.unix_timestamp;
    let (entry, n, kind, mint_key, burn_bps, dec) = {
        let r = round.data.borrow();
        if now >= i64_at(&r, 25) { return Err(Oops::Closed.into()); }
        if u32_at(&r, 21) >= u32_at(&r, 17) { return Err(Oops::Full.into()); }
        (u64_at(&r, 9), u32_at(&r, 21), r[99], Pubkey::new_from_array(rd(&r, 100)), u16::from_le_bytes(rd(&r, 132)), r[134])
    };
    let (_, tre, fee_bps) = config_admin(pid, cfg)?;
    make_pda(pid, player, card, sys, &[b"card", round.key.as_ref(), player.key.as_ref()], CARD_LEN)?;
    {
        let mut c = card.data.borrow_mut();
        c[0] = CARD;
        put(&mut c, 1, round.key.as_ref());
        put(&mut c, 33, player.key.as_ref());
        put(&mut c, 75, &now.to_le_bytes());
        put(&mut c, 83, &d[..32]);
    }
    if kind == BOUNTY {
        let (pta, mint, vault, tta, tp) = (next_account_info(it)?, next_account_info(it)?, next_account_info(it)?, next_account_info(it)?, next_account_info(it)?);
        if *mint.key != mint_key || !is_token_program(tp.key) || mint.owner != tp.key { return Err(Oops::BadAccount.into()); }
        token_acct(pta, tp.key, &mint_key, player.key)?;
        token_acct(vault, tp.key, &mint_key, round.key)?;
        token_acct(tta, tp.key, &mint_key, &tre)?;
        let burn = entry * burn_bps as u64 / 10_000;
        let fee = entry * fee_bps as u64 / 10_000;
        let pot = entry - burn - fee;
        if burn > 0 {
            invoke(&amount_ix(tp.key, 15, burn, dec, vec![AccountMeta::new(*pta.key, false), AccountMeta::new(*mint.key, false), AccountMeta::new_readonly(*player.key, true)]),
                &[pta.clone(), mint.clone(), player.clone(), tp.clone()])?;
        }
        let xfer = |to: &AccountInfo<'a>, amt: u64| -> ProgramResult {
            if amt == 0 { return Ok(()); }
            invoke(&amount_ix(tp.key, 12, amt, dec, vec![AccountMeta::new(*pta.key, false), AccountMeta::new_readonly(*mint.key, false), AccountMeta::new(*to.key, false), AccountMeta::new_readonly(*player.key, true)]),
                &[pta.clone(), mint.clone(), to.clone(), player.clone(), tp.clone()])
        };
        xfer(tta, fee)?;
        xfer(vault, pot)?;
    } else if entry > 0 {
        invoke(&system_instruction::transfer(player.key, round.key, entry), &[player.clone(), round.clone(), sys.clone()])?;
    }
    put(&mut round.data.borrow_mut(), 21, &(n + 1).to_le_bytes());
    Ok(())
}

/// 5: admin, cfg, round | seed[32] — must hash to the commitment made at open.
fn reveal_round(pid: &Pubkey, a: &[AccountInfo], d: &[u8]) -> ProgramResult {
    let it = &mut a.iter();
    let (admin, cfg, round) = (next_account_info(it)?, next_account_info(it)?, next_account_info(it)?);
    need_signer(admin)?;
    if config_admin(pid, cfg)?.0 != *admin.key { return Err(Oops::BadSigner.into()); }
    owned(pid, round, ROUND)?;
    let mut r = round.data.borrow_mut();
    if hashv(&[&d[..32]]).to_bytes() != r[33..65] { return Err(Oops::SeedMismatch.into()); }
    put(&mut r, 65, &d[..32]);
    r[97] = 1;
    Ok(())
}

/// 6: round, cfg, treasury, [vault, mint, token_program], then (card, wallet | wallet token account) for every entrant.
/// Anyone may call. Bounty pays out of the escrow (fee and burn were taken at join); no solver -> each seat's
/// escrowed share comes back. Duel pays SOL from the round PDA after the fee.
fn settle<'a>(pid: &Pubkey, a: &[AccountInfo<'a>]) -> ProgramResult {
    let it = &mut a.iter();
    let (round, cfg, treasury) = (next_account_info(it)?, next_account_info(it)?, next_account_info(it)?);
    let (_, tre, fee_bps) = config_admin(pid, cfg)?;
    if *treasury.key != tre { return Err(Oops::BadAccount.into()); }
    owned(pid, round, ROUND)?;
    let (entry, cap, entrants, ends, kind, id, mint_key, burn_bps, dec) = {
        let r = round.data.borrow();
        if r[97] != 1 { return Err(Oops::NotYet.into()); }
        if r[98] == 1 { return Err(Oops::Closed.into()); }
        (u64_at(&r, 9), u32_at(&r, 17), u32_at(&r, 21), i64_at(&r, 25), r[99], rd::<8>(&r, 1), Pubkey::new_from_array(rd(&r, 100)), u16::from_le_bytes(rd(&r, 132)), r[134])
    };
    let tok = if kind == BOUNTY {
        let (vault, mint, tp) = (next_account_info(it)?, next_account_info(it)?, next_account_info(it)?);
        if *mint.key != mint_key || !is_token_program(tp.key) || mint.owner != tp.key { return Err(Oops::BadAccount.into()); }
        let bal = token_acct(vault, tp.key, &mint_key, round.key)?;
        Some((vault, mint, tp, bal))
    } else { None };
    let rest: Vec<&AccountInfo> = it.collect();
    if rest.len() != entrants as usize * 2 { return Err(Oops::Missing.into()); }

    // (guesses, seconds, index) for solvers; also check every seat is real and distinct.
    let mut rank: Vec<(u8, i64, usize)> = Vec::new();
    let mut all_done = true;
    let mut seen: Vec<Pubkey> = Vec::new();
    for i in 0..entrants as usize {
        let (card, wallet) = (rest[2 * i], rest[2 * i + 1]);
        owned(pid, card, CARD)?;
        let c = card.data.borrow();
        if c[1..33] != round.key.as_ref()[..] { return Err(Oops::BadAccount.into()); }
        match tok {
            Some((_, _, tp, _)) => { token_acct(wallet, tp.key, &mint_key, &Pubkey::new_from_array(rd(&c, 33)))?; }
            None => if c[33..65] != wallet.key.as_ref()[..] { return Err(Oops::BadAccount.into()); },
        }
        if seen.contains(card.key) { return Err(Oops::BadAccount.into()); }
        seen.push(*card.key);
        if c[66] == 1 {
            rank.push((c[65], i64_at(&c, 67) - i64_at(&c, 75), i));
        } else if c[65] < MAX_ROWS {
            all_done = false;
        }
    }
    let now = Clock::get()?.unix_timestamp;
    if now < ends && !(all_done && entrants == cap) { return Err(Oops::NotYet.into()); }

    let (_, bump) = Pubkey::find_program_address(&[b"round", &id], pid);
    let bump_b = [bump];
    let signer: &[&[u8]] = &[b"round", &id, &bump_b];
    let pay = |to: &AccountInfo<'a>, amt: u64| -> ProgramResult {
        if amt == 0 { return Ok(()); }
        match tok {
            Some((vault, mint, tp, _)) => invoke_signed(
                &amount_ix(tp.key, 12, amt, dec, vec![AccountMeta::new(*vault.key, false), AccountMeta::new_readonly(*mint.key, false), AccountMeta::new(*to.key, false), AccountMeta::new_readonly(*round.key, true)]),
                &[vault.clone(), mint.clone(), to.clone(), round.clone(), tp.clone()], &[signer]),
            None => {
                **round.try_borrow_mut_lamports()? -= amt;
                **to.try_borrow_mut_lamports()? += amt;
                Ok(())
            }
        }
    };
    // per-seat escrow for bounty = entry - burn - fee (what join moved into the vault)
    let seat_net = |fee_bps: u16| entry - entry * burn_bps as u64 / 10_000 - entry * fee_bps as u64 / 10_000;
    let (pot, refund) = match tok {
        Some((_, _, _, bal)) => (bal, seat_net(fee_bps)),
        None => (entry * entrants as u64, entry),
    };
    // duel with no opponent: full refund, no fee
    if tok.is_none() && entrants < 2 { rank.clear(); }
    if rank.is_empty() {
        let mut left = pot;
        for i in 0..entrants as usize { let amt = refund.min(left); left -= amt; pay(rest[2 * i + 1], amt)?; }
    } else {
        rank.sort_by(|x, y| (x.0, x.1).cmp(&(y.0, y.1)));
        let k = ((entrants as usize * 3 + 9) / 10).max(1).min(rank.len());
        let fee = if tok.is_some() { 0 } else { pot * fee_bps as u64 / 10_000 };
        if fee > 0 { pay(treasury, fee)?; }
        let share = pot - fee;
        let total: u64 = (1..=k as u64).sum();
        let mut paid = 0u64;
        for (r, w) in rank.iter().take(k).enumerate().rev() {
            let amt = if r == 0 { share - paid } else { share * (k - r) as u64 / total };
            paid += amt;
            pay(rest[2 * w.2 + 1], amt)?;
        }
    }
    round.data.borrow_mut()[98] = 1;
    Ok(())
}

/// 9: player (receives the rent), card, round. Anyone may call once the round is settled.
fn close_card(pid: &Pubkey, a: &[AccountInfo]) -> ProgramResult {
    let it = &mut a.iter();
    let (player, card, round) = (next_account_info(it)?, next_account_info(it)?, next_account_info(it)?);
    owned(pid, card, CARD)?;
    // a round that was already closed (after the grace period) leaves an empty system account behind
    let gone = round.data_is_empty() && round.lamports() == 0;
    if !gone {
        owned(pid, round, ROUND)?;
        if round.data.borrow()[98] != 1 { return Err(Oops::NotYet.into()); }
    }
    {
        let c = card.data.borrow();
        if c[1..33] != round.key.as_ref()[..] || c[33..65] != player.key.as_ref()[..] { return Err(Oops::BadAccount.into()); }
    }
    let lamports = card.lamports();
    **card.try_borrow_mut_lamports()? = 0;
    **player.try_borrow_mut_lamports()? += lamports;
    card.data.borrow_mut().fill(0);
    if !gone {
        let mut r = round.data.borrow_mut();
        let n = u32_at(&r, 175) + 1;
        put(&mut r, 175, &n.to_le_bytes());
    }
    Ok(())
}

/// 11: round, payer (rent back), [vault, token_program]. Anyone may call once the round is settled and every
/// card is closed, or 24 h after the end; leftover cards can still be closed afterwards, rent to their player.
fn close_round<'a>(pid: &Pubkey, a: &[AccountInfo<'a>]) -> ProgramResult {
    let it = &mut a.iter();
    let (round, payer) = (next_account_info(it)?, next_account_info(it)?);
    owned(pid, round, ROUND)?;
    let (id, kind, entrants, closed, ends, rec) = {
        let r = round.data.borrow();
        if r[98] != 1 { return Err(Oops::NotYet.into()); }
        (rd::<8>(&r, 1), r[99], u32_at(&r, 21), u32_at(&r, 175), i64_at(&r, 25), Pubkey::new_from_array(rd(&r, 143)))
    };
    if *payer.key != rec { return Err(Oops::BadAccount.into()); }
    if closed < entrants && Clock::get()?.unix_timestamp < ends + GRACE_SECS { return Err(Oops::NotYet.into()); }
    if kind == BOUNTY {
        let (vault, tp) = (next_account_info(it)?, next_account_info(it)?);
        if !is_token_program(tp.key) { return Err(Oops::BadAccount.into()); }
        let mint = Pubkey::new_from_array(rd(&round.data.borrow(), 100));
        if token_acct(vault, tp.key, &mint, round.key)? != 0 { return Err(Oops::BadAccount.into()); }
        let (_, bump) = Pubkey::find_program_address(&[b"round", &id], pid);
        let b = [bump];
        let signer: &[&[u8]] = &[b"round", &id, &b];
        invoke_signed(
            &Instruction { program_id: *tp.key, accounts: vec![AccountMeta::new(*vault.key, false), AccountMeta::new(*payer.key, false), AccountMeta::new_readonly(*round.key, true)], data: vec![9] },
            &[vault.clone(), payer.clone(), round.clone(), tp.clone()], &[signer])?;
    }
    // anything still in the round (rent, plus any SOL dust) goes back to whoever paid for it
    let lamports = round.lamports();
    **round.try_borrow_mut_lamports()? = 0;
    **payer.try_borrow_mut_lamports()? += lamports;
    round.data.borrow_mut().fill(0);
    Ok(())
}
