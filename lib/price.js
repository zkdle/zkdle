// $PROOF price in lamports per raw token unit, read from on-chain reserves and smoothed into a short TWAP.
//  - pump.fun bonding curve (pre-graduation): virtual SOL / virtual token reserves of the curve PDA.
//  - after graduation (PumpSwap, Raydium, ...): set ZK_PRICE_POOL_VAULTS="<token vault>,<wSOL vault>" — the pool's
//    two reserve token accounts. Price = wSOL reserve / token reserve.
// Each round fixes its entry once, from the median of the last few samples, clamped to [min, max] tokens.
const { PublicKey } = require('@solana/web3.js');

const PUMP = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMPSWAP = new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
const WSOL = new PublicKey('So11111111111111111111111111111111111111112');
const curveOf = (mint) => PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), new PublicKey(mint).toBuffer()], PUMP)[0];
// Canonical PumpSwap pool a pump.fun coin migrates into: creator = pump's pool-authority PDA, index 0, quote = wSOL.
const poolOf = (mint) => {
  const m = new PublicKey(mint);
  const auth = PublicKey.findProgramAddressSync([Buffer.from('pool-authority'), m.toBuffer()], PUMP)[0];
  return PublicKey.findProgramAddressSync([Buffer.from('pool'), Buffer.from([0, 0]), auth.toBuffer(), m.toBuffer(), WSOL.toBuffer()], PUMPSWAP)[0];
};
// Pool layout: 8 disc | 1 bump | 2 index | 32 creator | 32 base_mint @43 | 32 quote_mint @75 | 32 lp @107 | base vault @139 | quote vault @171
const readPool = (d) => ({ baseMint: new PublicKey(d.subarray(43, 75)).toBase58(), quoteMint: new PublicKey(d.subarray(75, 107)).toBase58(), baseVault: new PublicKey(d.subarray(139, 171)).toBase58(), quoteVault: new PublicKey(d.subarray(171, 203)).toBase58() });

function makePricer(conn, opts) {
  const { mint, vaults, windowSecs = 300, minSamples = 3, maxSamples = 10 } = opts;
  const samples = []; // { t, p } with p = lamports per raw token unit (float)

  let autoVaults = null; // found from the PumpSwap pool once the curve has graduated
  async function spot() {
    const vs = vaults || autoVaults;
    if (vs) {
      const [tv, sv] = vs.split(',').map((s) => new PublicKey(s.trim()));
      const [a, b] = await conn.getMultipleAccountsInfo([tv, sv]);
      if (!a || !b) return null;
      const tok = Number(a.data.readBigUInt64LE(64)), sol = Number(b.data.readBigUInt64LE(64));
      return tok > 0 && sol > 0 ? { p: sol / tok, src: 'pool' } : null;
    }
    const acc = await conn.getAccountInfo(curveOf(mint));
    if (!acc || acc.data.length < 49) return null;
    const vTok = Number(acc.data.readBigUInt64LE(8)), vSol = Number(acc.data.readBigUInt64LE(16)), complete = acc.data[48] === 1;
    if (complete || !vTok) { // graduated: switch to the PumpSwap pool reserves
      const pa = await conn.getAccountInfo(poolOf(mint));
      if (!pa || !pa.owner.equals(PUMPSWAP)) return null;
      const p = readPool(pa.data);
      if (p.baseMint !== new PublicKey(mint).toBase58() || p.quoteMint !== WSOL.toBase58()) return null;
      autoVaults = `${p.baseVault},${p.quoteVault}`;
      return spot();
    }
    return { p: vSol / vTok, src: 'pump-curve' };
  }
  async function sample() {
    try {
      const s = await spot();
      if (!s) return null;
      samples.push({ t: Date.now(), p: s.p, src: s.src });
      while (samples.length > maxSamples) samples.shift();
      return s;
    } catch { return null; }
  }
  function twap() {
    const fresh = samples.filter((s) => Date.now() - s.t <= windowSecs * 1000);
    if (fresh.length < minSamples) return null;
    const ps = fresh.map((s) => s.p).sort((x, y) => x - y);
    const m = ps.length >> 1;
    return { p: ps.length % 2 ? ps[m] : (ps[m - 1] + ps[m]) / 2, n: fresh.length, src: fresh.at(-1).src };
  }
  return { sample, twap, samples };
}

// entryLamports / price -> raw token amount, clamped; fallbackRaw when no TWAP is available.
function entryFor({ twap, entryLamports, minRaw, maxRaw, fallbackRaw }) {
  if (!twap || !(twap.p > 0)) return { raw: BigInt(fallbackRaw), source: 'fallback' };
  let raw = BigInt(Math.round(entryLamports / twap.p));
  let source = `twap:${twap.src}:${twap.n}`;
  if (minRaw && raw < BigInt(minRaw)) { raw = BigInt(minRaw); source += ':min'; }
  if (maxRaw && raw > BigInt(maxRaw)) { raw = BigInt(maxRaw); source += ':max'; }
  return { raw, source };
}

module.exports = { makePricer, entryFor, curveOf, poolOf, readPool };
