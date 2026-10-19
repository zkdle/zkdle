#!/usr/bin/env node
// Launch-day helper: given the $PROOF mint, detect token program, decimals, risky Token-2022 extensions,
// pump.fun bonding curve / PumpSwap pool, and print the (non-secret) env values plus a sanity price.
// Usage: node scripts/set-mint-check.js <MINT> [rpc-url]     (defaults to ZK_RPC, then mainnet-beta)
const { Connection, PublicKey } = require('@solana/web3.js');
const { curveOf, poolOf, readPool } = require('../lib/price');

const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', TOKEN22 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
// Token-2022 mint extensions that would break the program's plain BurnChecked/TransferChecked CPIs or the game
const BAD = { 1: 'TransferFeeConfig', 6: 'DefaultAccountState', 9: 'NonTransferable', 12: 'PermanentDelegate', 14: 'TransferHook', 24: 'Pausable' };
const NAMES = { 1: 'TransferFeeConfig', 3: 'MintCloseAuthority', 6: 'DefaultAccountState', 9: 'NonTransferable', 10: 'InterestBearing', 12: 'PermanentDelegate', 14: 'TransferHook', 18: 'MetadataPointer', 19: 'TokenMetadata', 20: 'GroupPointer', 22: 'GroupMemberPointer', 24: 'Pausable', 25: 'ScaledUiAmount' };

function extensions(d) {
  const out = [];
  if (d.length <= 165) return out;
  for (let o = 166; o + 4 <= d.length;) { // 165 = account-type byte offset, TLV starts at 166
    const t = d.readUInt16LE(o), l = d.readUInt16LE(o + 2);
    if (t === 0) break;
    out.push(t); o += 4 + l;
  }
  return out;
}

(async () => {
  const mintArg = process.argv[2];
  if (!mintArg) { console.error('usage: node scripts/set-mint-check.js <MINT> [rpc]'); process.exit(2); }
  const mint = new PublicKey(mintArg);
  const conn = new Connection(process.argv[3] || process.env.ZK_RPC || 'https://api.mainnet-beta.solana.com', 'confirmed');
  const m = await conn.getAccountInfo(mint);
  if (!m) throw new Error('mint not found');
  const owner = m.owner.toBase58();
  if (owner !== TOKEN && owner !== TOKEN22) throw new Error('not a token mint, owner ' + owner);
  const decimals = m.data[44], supply = m.data.readBigUInt64LE(36);
  const mintAuth = m.data.readUInt32LE(0) ? new PublicKey(m.data.subarray(4, 36)).toBase58() : null;
  const freezeAuth = m.data.readUInt32LE(46) ? new PublicKey(m.data.subarray(50, 82)).toBase58() : null;
  const exts = owner === TOKEN22 ? extensions(m.data) : [];
  const bad = exts.filter((t) => BAD[t]);
  console.log('mint            ', mint.toBase58());
  console.log('token program   ', owner === TOKEN ? 'SPL Token (legacy)' : 'Token-2022', owner);
  console.log('decimals        ', decimals);
  console.log('supply (ui)     ', (Number(supply) / 10 ** decimals).toLocaleString('en-US'));
  console.log('mint authority  ', mintAuth || 'none (good)');
  console.log('freeze authority', freezeAuth || 'none (good)');
  if (exts.length) console.log('extensions      ', exts.map((t) => NAMES[t] || `#${t}`).join(', '));
  if (bad.length) console.log('!! BLOCKER: extension(s) not supported by the program:', bad.map((t) => BAD[t]).join(', '));
  if (decimals !== 6) console.log('!! decimals is not 6 — set ZK_TOKEN_DECIMALS=' + decimals);

  let price = null, vaults = null, src;
  const curve = await conn.getAccountInfo(curveOf(mint));
  if (curve) {
    const vTok = Number(curve.data.readBigUInt64LE(8)), vSol = Number(curve.data.readBigUInt64LE(16)), complete = curve.data[48] === 1;
    console.log('pump.fun curve  ', curveOf(mint).toBase58(), complete ? '(graduated)' : '(bonding)');
    if (!complete && vTok) { price = vSol / vTok; src = 'pump.fun bonding curve'; }
  } else console.log('pump.fun curve   none');
  if (price == null) {
    const pool = poolOf(mint), pa = await conn.getAccountInfo(pool);
    if (pa) {
      const p = readPool(pa.data);
      vaults = `${p.baseVault},${p.quoteVault}`;
      const [a, b] = await conn.getMultipleAccountsInfo([new PublicKey(p.baseVault), new PublicKey(p.quoteVault)]);
      price = Number(b.data.readBigUInt64LE(64)) / Number(a.data.readBigUInt64LE(64)); src = 'PumpSwap pool ' + pool.toBase58();
    }
  }
  const lamportsPerToken = price == null ? null : price * 10 ** decimals;
  console.log('price source    ', src || 'NONE FOUND — bounty would not open');
  if (price != null) {
    console.log('price           ', (lamportsPerToken / 1e9).toExponential(4), 'SOL per token');
    const entry = 0.01e9 / price / 10 ** decimals;
    console.log('0.01 SOL entry  ', Math.round(entry).toLocaleString('en-US'), 'tokens');
    console.log('mend 10,000 tokens ≈', (1e4 * lamportsPerToken / 1e9).toFixed(6), 'SOL; holder 1M ≈', (1e6 * lamportsPerToken / 1e9).toFixed(4), 'SOL');
  }
  console.log('\n# Render env to set (non-secret):');
  console.log('ZK_TOKEN_MINT=' + mint.toBase58());
  if (decimals !== 6) console.log('ZK_TOKEN_DECIMALS=' + decimals);
  if (vaults) console.log('ZK_PRICE_POOL_VAULTS=' + vaults + '   # optional: the server also auto-finds the PumpSwap pool after graduation');
  process.exit(bad.length || owner === undefined ? 1 : 0);
})().catch((e) => { console.error('error:', e.message); process.exit(1); });
