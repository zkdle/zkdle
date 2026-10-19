// Minimal SPL Token helpers (burn, transfer, associated account lookup).
const { PublicKey, TransactionInstruction } = require('@solana/web3.js');
const { Buffer } = require('buffer');

const TOKEN = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN22 = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const ATA = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

const ataOf = (owner, mint, program = TOKEN) =>
  PublicKey.findProgramAddressSync([new PublicKey(owner).toBuffer(), program.toBuffer(), new PublicKey(mint).toBuffer()], ATA)[0];

const amountData = (op, amount, decimals) => {
  const b = Buffer.alloc(10);
  b[0] = op; b.writeBigUInt64LE(BigInt(amount), 1); b[9] = decimals;
  return b;
};
// BurnChecked = 15, TransferChecked = 12
const burn = (account, mint, owner, amount, decimals, program = TOKEN) => new TransactionInstruction({
  programId: program, data: amountData(15, amount, decimals),
  keys: [{ pubkey: account, isSigner: false, isWritable: true }, { pubkey: new PublicKey(mint), isSigner: false, isWritable: true }, { pubkey: new PublicKey(owner), isSigner: true, isWritable: false }],
});
const transfer = (from, mint, to, owner, amount, decimals, program = TOKEN) => new TransactionInstruction({
  programId: program, data: amountData(12, amount, decimals),
  keys: [{ pubkey: from, isSigner: false, isWritable: true }, { pubkey: new PublicKey(mint), isSigner: false, isWritable: false }, { pubkey: to, isSigner: false, isWritable: true }, { pubkey: new PublicKey(owner), isSigner: true, isWritable: false }],
});

// CreateIdempotent (1): creates the associated account if it doesn't exist; owner may be a PDA.
const createAta = (payer, owner, mint, program = TOKEN) => new TransactionInstruction({
  programId: ATA, data: Buffer.from([1]),
  keys: [
    { pubkey: new PublicKey(payer), isSigner: true, isWritable: true }, { pubkey: ataOf(owner, mint, program), isSigner: false, isWritable: true },
    { pubkey: new PublicKey(owner), isSigner: false, isWritable: false }, { pubkey: new PublicKey(mint), isSigner: false, isWritable: false },
    { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }, { pubkey: program, isSigner: false, isWritable: false },
  ],
});
const ataOfOffCurve = (owner, mint, program = TOKEN) => ataOf(owner, mint, program);

module.exports = { TOKEN, TOKEN22, ATA, ataOf, ataOfOffCurve, burn, transfer, createAta };
