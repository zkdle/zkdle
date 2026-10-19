// Instruction builders and account readers for the ZKdle program.
// Used by the server, the browser bundle and the test suite alike.
const { PublicKey, TransactionInstruction, SystemProgram } = require('@solana/web3.js');
const { Buffer } = require('buffer');

const enc = new TextEncoder();
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };

function client(programId) {
  const pid = new PublicKey(programId);
  const pda = (...seeds) => PublicKey.findProgramAddressSync(seeds.map((s) => (typeof s === 'string' ? enc.encode(s) : s instanceof PublicKey ? s.toBuffer() : s)), pid)[0];
  const at = {
    config: () => pda('cfg'),
    day: (n) => pda('day', u32(n)),
    round: (id) => pda('round', u64(id)),
    card: (board, player) => pda('card', new PublicKey(board), new PublicKey(player)),
    streak: (player) => pda('streak', new PublicKey(player)),
  };
  const ix = (op, keys, data = Buffer.alloc(0)) => new TransactionInstruction({
    programId: pid,
    keys: keys.map(([pubkey, isSigner, isWritable]) => ({ pubkey: new PublicKey(pubkey), isSigner, isWritable })),
    data: Buffer.concat([Buffer.from([op]), Buffer.from(data)]),
  });
  const sys = SystemProgram.programId;

  return {
    pid, at,
    setup: (admin, treasury, feeBps) => ix(0, [[admin, true, true], [at.config(), false, true], [sys, false, false]],
      Buffer.concat([new PublicKey(treasury).toBuffer(), Buffer.from(new Uint16Array([feeBps]).buffer)])),
    openDay: (admin, n, seal32) => ix(1, [[admin, true, true], [at.config(), false, false], [at.day(n), false, true], [sys, false, false]], Buffer.concat([u32(n), seal32])),
    revealDay: (admin, n, letters, salt32) => ix(7, [[admin, true, false], [at.config(), false, false], [at.day(n), false, true]], Buffer.concat([Buffer.from(letters), salt32])),
    guess: (player, board, { letters, clue, proof }) => ix(2, [
      [player, true, true], [at.card(board, player), false, true], [board, false, false], [at.streak(player), false, true], [sys, false, false],
    ], Buffer.concat([Buffer.from(letters), Buffer.from(clue), proof])),
    // kind 0 = bounty paid in the SPL token (needs tok = { mint, burnBps, refLamports }), kind 1 = SOL duel
    openRound: (payer, admin, { id, entry, cap, secs, commit, kind = 0, tok }) => ix(3, [
      [payer, true, true], [admin, true, false], [at.config(), false, false], [at.round(id), false, true], [sys, false, false],
      ...(kind === 0 ? [[tok.mint, false, false]] : []),
    ], Buffer.concat([u64(id), u64(entry), u32(cap), i64(secs), commit, Buffer.from([kind]),
      ...(kind === 0 ? [Buffer.from(new Uint16Array([tok.burnBps]).buffer), u64(tok.refLamports || 0)] : [])])),
    // tok = { playerTa, mint, vault, treasuryTa, program } for bounty rounds
    join: (player, admin, id, seal32, tok) => ix(4, [
      [player, true, true], [admin, true, false], [at.config(), false, false], [at.round(id), false, true], [at.card(at.round(id), player), false, true], [sys, false, false],
      ...(tok ? [[tok.playerTa, false, true], [tok.mint, false, true], [tok.vault, false, true], [tok.treasuryTa, false, true], [tok.program, false, false]] : []),
    ], seal32),
    revealRound: (admin, id, seed) => ix(5, [[admin, true, false], [at.config(), false, false], [at.round(id), false, true]], seed),
    // tok = { vault, mint, program, dest: (player) => token account } for bounty rounds
    settle: (id, treasury, players, tok) => ix(6, [
      [at.round(id), false, true], [at.config(), false, false], [treasury, false, true],
      ...(tok ? [[tok.vault, false, true], [tok.mint, false, false], [tok.program, false, false]] : []),
      ...players.flatMap((p) => [[at.card(at.round(id), p), false, false], [tok ? tok.dest(p) : p, false, true]]),
    ]),
    closeCard: (id, player) => ix(9, [[player, false, true], [at.card(at.round(id), player), false, true], [at.round(id), false, true]]),
    closeRound: (id, payer, tok) => ix(11, [[at.round(id), false, true], [payer, false, true], ...(tok ? [[tok.vault, false, true], [tok.program, false, false]] : [])]),
    setAdmin: (admin, next) => ix(10, [[admin, true, false], [next, true, false], [at.config(), false, true]], Buffer.alloc(0)),
    mend: (player, admin) => ix(8, [[player, true, false], [admin, true, false], [at.config(), false, false], [at.streak(player), false, true]]),
  };
}

// ---- readers ----
const key = (d, o) => new PublicKey(d.subarray(o, o + 32)).toBase58();
const readCard = (d) => ({
  board: key(d, 1), player: key(d, 33), rows: d[65], solved: d[66] === 1,
  solvedAt: Number(d.readBigInt64LE(67)), startedAt: Number(d.readBigInt64LE(75)),
  seal: d.subarray(83, 115).toString('hex'),
  grid: Array.from({ length: d[65] }, (_, r) => ({ letters: [...d.subarray(115 + r * 10, 120 + r * 10)], clue: [...d.subarray(120 + r * 10, 125 + r * 10)] })),
});
const readStreak = (d) => ({ player: key(d, 1), current: d.readUInt32LE(33), best: d.readUInt32LE(37), solves: d.readUInt32LE(41), lastDay: d.readUInt32LE(45) - 1, mends: d.readUInt32LE(49) });
const readRound = (d) => ({
  id: Number(d.readBigUInt64LE(1)), entry: Number(d.readBigUInt64LE(9)), cap: d.readUInt32LE(17), entrants: d.readUInt32LE(21),
  endsAt: Number(d.readBigInt64LE(25)), commit: d.subarray(33, 65).toString('hex'), seed: d[97] ? d.subarray(65, 97).toString('hex') : null,
  revealed: d[97] === 1, settled: d[98] === 1, kind: d[99],
  ...(d.length >= 179 ? { payer: key(d, 143), closedCards: d.readUInt32LE(175) } : {}),
  ...(d.length >= 143 && d[99] === 0 ? { mint: key(d, 100), burnBps: d.readUInt16LE(132), decimals: d[134], refLamports: Number(d.readBigUInt64LE(135)) } : {}),
});
const readDay = (d) => ({ day: d.readUInt32LE(1), seal: d.subarray(5, 37).toString('hex'), revealed: d[37] === 1, letters: [...d.subarray(38, 43)], salt: d.subarray(43, 75).toString('hex') });

module.exports = { client, readCard, readStreak, readRound, readDay, u64 };
