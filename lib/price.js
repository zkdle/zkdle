// $PROOF price in lamports per raw token unit, read from on-chain reserves and smoothed into a short TWAP.
//  - pump.fun bonding curve (pre-graduation): virtual SOL / virtual token reserves of the curve PDA.
//  - after graduation (PumpSwap, Raydium, ...): set ZK_PRICE_POOL_VAULTS="<token vault>,<wSOL vault>" — the pool's
//    two reserve token accounts. Price = wSOL reserve / token reserve.
// Each round fixes its entry once, from the median of the last few samples, clamped to [min, max] tokens.
const { PublicKey } = require('@solana/web3.js');

const PUMP = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const curveOf = (mint) => PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), new PublicKey(mint).toBuffer()], PUMP)[0];

function makePricer(conn, opts) {
  const { mint, vaults, windowSecs = 300, minSamples = 3, maxSamples = 10 } = opts;
  const samples = []; // { t, p } with p = lamports per raw token unit (float)

  async function spot() {
    if (vaults) {
      const [tv, sv] = vaults.split(',').map((s) => new PublicKey(s.trim()));
      const [a, b] = await conn.getMultipleAccountsInfo([tv, sv]);
      if (!a || !b) return null;
      const tok = Number(a.data.readBigUInt64LE(64)), sol = Number(b.data.readBigUInt64LE(64));
      return tok > 0 && sol > 0 ? { p: sol / tok, src: 'pool' } : null;
    }
    const acc = await conn.getAccountInfo(curveOf(mint));
    if (!acc || acc.data.length < 49) return null;
    const vTok = Number(acc.data.readBigUInt64LE(8)), vSol = Number(acc.data.readBigUInt64LE(16)), complete = acc.data[48] === 1;
    if (complete || !vTok) return null; // graduated: needs ZK_PRICE_POOL_VAULTS
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

module.exports = { makePricer, entryFor, curveOf };
