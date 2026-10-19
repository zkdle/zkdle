// ZKdle server: hands out proven clues, co-signs seats, opens and settles rounds.
// Preview mode (ZK_PREVIEW unset or 1): landing + /docs only, games show "Opening soon", no keys or RPC are loaded.
// Set ZK_PREVIEW=0 to run the full game.
if (require.main === module && process.env.ZK_PREVIEW !== '0') { require('./preview'); return; }
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Connection, PublicKey, Transaction, ComputeBudgetProgram } = require('@solana/web3.js');

const cfg = require('./lib/env');
const zk = require('./zk/lib');
const words = require('./lib/words');
const spl = require('./lib/spl');
const { client, readCard, readStreak, readRound, readDay } = require('./lib/sdk');
const { shareSvg, toPng } = require('./lib/card');
const { makePricer, entryFor } = require('./lib/price');

const conn = new Connection(cfg.rpc, 'confirmed');
const prog = cfg.programId ? client(cfg.programId) : null;
const host = cfg.host;
const EPOCH = Date.UTC(2026, 9, 19);
const pricer = cfg.token.mint ? makePricer(conn, { mint: cfg.token.mint, vaults: cfg.price.vaults, windowSecs: cfg.price.windowSecs, minSamples: cfg.price.minSamples }) : null;
if (pricer) { pricer.sample(); setInterval(() => pricer.sample(), cfg.price.sampleSecs * 1000).unref(); }
let tokenProgram = null; // Token or Token-2022, read from the mint's owner
async function tokProgram() {
  if (!tokenProgram) {
    const m = await conn.getAccountInfo(new PublicKey(cfg.token.mint));
    if (!m) throw new Nope('token mint not found');
    tokenProgram = m.owner;
  }
  return tokenProgram;
}
const rawUnits = (ui) => BigInt(Math.round(ui * 10 ** cfg.token.decimals));
const dayNow = () => Math.floor((Date.now() - EPOCH) / 864e5);

// ---------------------------------------------------------------- storage
// The state file holds live answers, salts and seeds until they are revealed, so it is encrypted at rest.
// Fail closed: outside the test network the server will not start without ZK_SECRET_KEY.
const vault = require('./lib/vault');
const dbKey = vault.keyFrom(cfg.secretKey);
if (!dbKey && !cfg.test && cfg.cluster !== 'localnet') { console.error('ZK_SECRET_KEY is required (32 bytes, hex or base64); refusing to start'); process.exit(1); }
let db = { days: {}, rounds: {}, shares: {}, seats: {}, nextId: 1000 };
if (fs.existsSync(cfg.db)) {
  const text = fs.readFileSync(cfg.db, 'utf8');
  if (text.startsWith(vault.MAGIC) && !dbKey) { console.error('state file is encrypted but ZK_SECRET_KEY is not set'); process.exit(1); }
  db = { ...db, ...(dbKey ? vault.open(dbKey, text.startsWith(vault.MAGIC) ? text : vault.seal(dbKey, JSON.parse(text))) : JSON.parse(text)) };
}
fs.mkdirSync(path.dirname(cfg.db), { recursive: true }); // e.g. a fresh Render disk at /var/data
function save() {
  const tmp = cfg.db + '.tmp';
  fs.writeFileSync(tmp, dbKey ? vault.seal(dbKey, db) : JSON.stringify(db), { mode: 0o600 });
  fs.renameSync(tmp, cfg.db);
}

// ---------------------------------------------------------------- helpers
class Nope extends Error { constructor(msg, status = 400) { super(msg); this.status = status; this.safe = true; } }
// Only our own messages reach clients or logs verbatim; anything else (prover, RPC, crypto) may carry
// private inputs, so it is reduced to a generic line and a short id that matches the server log.
function publicError(e) {
  if (e?.safe) return e.message;
  const id = crypto.randomBytes(4).toString('hex');
  console.warn(`error ${id}:`, scrub(e));
  return `server error (${id})`;
}
function scrub(e) {
  let m = String(e?.message || e).slice(0, 300);
  for (const v of liveSecrets()) if (v && m.includes(v)) m = m.split(v).join('[redacted]');
  return m.replace(/\b[a-z]{5}\b/g, (w) => (liveWords().has(w) ? '[redacted]' : w));
}
function liveSecrets() {
  const out = [];
  for (const d of Object.values(db.days)) if (!d.revealed) out.push(d.salt);
  for (const r of Object.values(db.rounds)) if (!r.revealed) out.push(r.seed);
  return out;
}
function liveWords() {
  const out = new Set(Object.values(db.days).filter((d) => !d.revealed).map((d) => d.word));
  for (const r of Object.values(db.rounds)) if (!r.revealed) for (const p of r.players) out.add(words.seatWord(r.seed, r.id, p).word);
  return out;
}
const isKey = (s) => { try { return !!new PublicKey(s); } catch { return false; } };
const hex32 = (big) => zk.be32(big);
const freshSalt = () => BigInt('0x' + crypto.randomBytes(31).toString('hex'));
const letters = (w) => zk.letters(w);
const fetchAcct = async (k) => (await conn.getAccountInfo(new PublicKey(k)))?.data || null;
// Batched reads: getMultipleAccounts takes up to 100 keys per call.
async function fetchMany(keys) {
  const out = [];
  for (let i = 0; i < keys.length; i += 100) {
    const got = await conn.getMultipleAccountsInfo(keys.slice(i, i + 100).map((k) => new PublicKey(k)));
    out.push(...got.map((a) => a?.data || null));
  }
  return out;
}
const cardsOf = (r) => fetchMany(r.players.map((p) => prog.at.card(prog.at.round(r.id), p)));

async function holding(owner) {
  if (!cfg.token.mint) return 0;
  try {
    const r = await conn.getParsedTokenAccountsByOwner(new PublicKey(owner), { mint: new PublicKey(cfg.token.mint) });
    return r.value.reduce((s, a) => s + Number(a.account.data.parsed.info.tokenAmount.uiAmountString || 0), 0);
  } catch { return 0; }
}
const isHolder = async (w) => !!cfg.token.mint && (await holding(w)) >= cfg.token.holderMin;

async function sendHost(...ixs) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = host.publicKey;
  return conn.sendTransaction(tx, [host], { preflightCommitment: 'confirmed' }).then(async (sig) => {
    await conn.confirmTransaction(sig, 'confirmed');
    return sig;
  });
}

// Partially signed by the host; the player adds their signature and broadcasts.
async function forPlayer(player, ixs) {
  const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }), ...ixs);
  tx.feePayer = new PublicKey(player);
  tx.recentBlockhash = (await conn.getLatestBlockhash('confirmed')).blockhash;
  tx.partialSign(host);
  return tx.serialize({ requireAllSignatures: false }).toString('base64');
}

// ---------------------------------------------------------------- daily
function today() {
  const n = dayNow();
  if (!db.days[n]) {
    const word = words.answers[crypto.randomInt(words.answers.length)];
    db.days[n] = { word, salt: freshSalt().toString(), opened: false, revealed: false };
    save();
  }
  return [n, db.days[n]];
}
async function sealOf(d) { return d.seal || (d.seal = (await zk.seal(d.word, d.salt)).toString()); }

function hardModeOk(history, guess) {
  for (const row of history) {
    for (let i = 0; i < 5; i++) {
      if (row.clue[i] === 1 && guess[i] !== row.guess[i]) return false;
      if (row.clue[i] === 2 && !guess.includes(row.guess[i])) return false;
    }
  }
  return true;
}

async function proven(word, salt, seal, guess) {
  const { proof, publicSignals, clue } = await zk.prove(word, salt, guess, seal);
  if (!(await zk.check(proof, publicSignals))) throw new Nope('prover produced an invalid proof', 500);
  const payload = Buffer.concat([Buffer.from(letters(guess)), Buffer.from(clue), zk.chainProof(proof)]);
  return { guess, clue, proof, publicSignals, payload: payload.toString('base64') };
}

// ---------------------------------------------------------------- rounds
function newRoundRecord(kind, entry, secs, cap, extra = {}) {
  const id = db.nextId++;
  const seed = crypto.randomBytes(32);
  const r = { ...extra, id, kind, entry, cap, secs, seed: seed.toString('hex'), commit: words.sha256(seed).toString('hex'), createdAt: Date.now(), endsAt: Date.now() + secs * 1000, players: [] };
  db.rounds[id] = r;
  save();
  return r;
}
const roundIx = (payer, r) => prog.openRound(payer, host.publicKey, { id: r.id, entry: r.entry, cap: r.cap, secs: r.secs, commit: Buffer.from(r.commit, 'hex'), kind: r.kind,
  tok: r.kind === 0 ? { mint: cfg.token.mint, burnBps: r.burnBps, refLamports: r.refLamports } : undefined });

// Bounty: the entry is the $PROOF worth ZK_ROUND_ENTRY_SOL, fixed once when the round opens.
function bountyEntry() {
  const { raw, source } = entryFor({
    twap: pricer?.twap(), entryLamports: cfg.roundEntry, fallbackRaw: rawUnits(cfg.roundEntryTokens),
    minRaw: cfg.roundEntryMinTokens ? rawUnits(cfg.roundEntryMinTokens) : 0, maxRaw: cfg.roundEntryMaxTokens ? rawUnits(cfg.roundEntryMaxTokens) : 0,
  });
  const p = pricer?.twap()?.p;
  return { entry: raw.toString(), refLamports: source === 'fallback' ? (p ? Math.round(Number(raw) * p) : 0) : Math.round(Number(raw) * p), priceSource: source };
}
async function openBounty(secs = cfg.roundSecs, cap = cfg.roundCap, entryOverride, maxPotSol) {
  const e = entryOverride ? { entry: String(entryOverride), refLamports: 0, priceSource: 'test' } : bountyEntry();
  const r = newRoundRecord(0, e.entry, secs, cap, { refLamports: e.refLamports, priceSource: e.priceSource, burnBps: cfg.roundBurnBps, ...(maxPotSol ? { maxPotSol } : {}) });
  const tp = await tokProgram(), round = prog.at.round(r.id);
  await sendHost(roundIx(host.publicKey, r), spl.createAta(host.publicKey, round, cfg.token.mint, tp), spl.createAta(host.publicKey, cfg.treasury, cfg.token.mint, tp));
  r.opened = true; save();
  return r;
}
async function tokAccts(r) {
  const tp = await tokProgram(), round = prog.at.round(r.id);
  return { program: tp, mint: new PublicKey(cfg.token.mint), vault: spl.ataOf(round, cfg.token.mint, tp), treasuryTa: spl.ataOf(cfg.treasury, cfg.token.mint, tp) };
}
async function seatSeal(r, player) {
  const { word, salt } = words.seatWord(r.seed, r.id, player);
  return { word, salt, seal: await zk.seal(word, salt) };
}
async function joinIxs(r, player) {
  if (r.players.includes(player)) throw new Nope('already seated');
  if (r.players.length >= r.cap) throw new Nope('round is full');
  // Late joiners must leave themselves time to play: no seats in the last ZK_JOIN_CUTOFF_SECS (duels excepted).
  const cutoff = r.kind === 0 ? cfg.joinCutoffSecs * 1000 : 5000;
  if (Date.now() > r.endsAt - cutoff) throw new Nope('round closes too soon to take a seat');
  // Beta safety valve: cap what any single round can hold, so a server compromise has a bounded blast radius.
  const potShare = r.kind === 0 ? 1 - (Number(r.burnBps) + cfg.feeBps) / 10000 : 1;
  const seatSol = (r.kind === 0 ? (r.refLamports || cfg.roundEntry) : Number(r.entry)) / 1e9;
  if ((r.players.length + 1) * seatSol * potShare > (r.maxPotSol ?? cfg.maxPotSol) + 1e-9) throw new Nope('this round has reached its beta pot cap');
  const { seal } = await seatSeal(r, player);
  if (r.kind !== 0) return [prog.join(player, host.publicKey, r.id, hex32(seal))];
  const t = await tokAccts(r);
  const playerTa = spl.ataOf(player, cfg.token.mint, t.program);
  const acct = await conn.getAccountInfo(playerTa);
  if (!acct || acct.data.readBigUInt64LE(64) < BigInt(r.entry)) throw new Nope(`you need ${fmtTok(r.entry)} $${cfg.token.symbol} to take a seat`);
  return [prog.join(player, host.publicKey, r.id, hex32(seal), { ...t, playerTa })];
}
const fmtTok = (raw) => (Number(raw) / 10 ** cfg.token.decimals).toLocaleString('en-US', { maximumFractionDigits: 2 });
const splitOf = (r) => {
  if (r.kind !== 0) return null;
  const e = BigInt(r.entry), burn = (e * BigInt(r.burnBps)) / 10000n, fee = (e * BigInt(cfg.feeBps)) / 10000n;
  return { burn: burn.toString(), fee: fee.toString(), pot: (e - burn - fee).toString(), burnBps: r.burnBps, feeBps: cfg.feeBps };
};
const publicRound = (r, chain) => ({
  id: r.id, kind: r.kind, entry: r.entry, refLamports: r.refLamports || 0, priceSource: r.priceSource || null, split: splitOf(r), decimals: cfg.token.decimals, symbol: cfg.token.symbol, cap: r.cap, endsAt: r.endsAt, commit: r.commit, players: r.players.length,
  seed: r.revealed ? r.seed : null, settled: !!r.settled, settleSig: r.settleSig || null, pda: prog.at.round(r.id).toBase58(), chain,
});

// ---------------------------------------------------------------- housekeeping
let ticking = false;
async function tick() {
  if (!host || !prog || ticking) return;
  ticking = true;
  try {
    const [n, d] = today();
    if (!d.opened) {
      await sendHost(prog.openDay(host.publicKey, n, hex32(await sealOf(d))));
      d.opened = true; save();
    }
    for (const [k, past] of Object.entries(db.days)) {
      if (Number(k) < n && past.opened && !past.revealed) {
        await sendHost(prog.revealDay(host.publicKey, Number(k), letters(past.word), hex32(BigInt(past.salt))));
        past.revealed = true; save();
      }
    }
    // Bounty rounds are paid in $PROOF, so they only run once the token is live.
    if (cfg.token.mint && cfg.treasury && !Object.values(db.rounds).some((r) => r.kind === 0 && !r.settled && r.endsAt > Date.now() + 60e3)) {
      await openBounty();
    }
    for (const r of Object.values(db.rounds)) await maybeSettle(r).catch((e) => console.warn('settle', r.id, scrub(e)));
    for (const r of Object.values(db.rounds)) if (r.settled && !r.closed && Date.now() > r.endsAt + 86_400e3 + 60e3) await closeRound(r).catch(() => {});
  } catch (e) {
    console.warn('tick:', scrub(e));
  } finally { ticking = false; }
}

async function closeRound(r) {
  const data = await fetchAcct(prog.at.round(r.id));
  if (!data) { r.closed = true; save(); return; }
  const chain = readRound(data);
  const tok = r.kind === 0 ? await tokAccts(r) : null;
  await sendHost(prog.closeRound(r.id, new PublicKey(chain.payer), tok && { vault: tok.vault, program: tok.program }));
  r.closed = true; save();
}
const settling = new Map(); // one settle at a time per round (the timer and the test hook can overlap)
function maybeSettle(r) {
  if (!settling.has(r.id)) settling.set(r.id, settleOnce(r).finally(() => settling.delete(r.id)));
  return settling.get(r.id);
}
async function settleOnce(r) {
  if (r.settled || !r.opened) return;
  const data = await fetchAcct(prog.at.round(r.id));
  if (!data) return;
  const chain = readRound(data);
  if (chain.settled) { r.settled = true; save(); return; }
  let finished = Date.now() / 1000 >= chain.endsAt;
  if (!finished && chain.entrants === chain.cap) {
    const cards = await cardsOf(r);
    finished = cards.every((c) => c && (readCard(c).solved || readCard(c).rows >= 6));
  }
  if (!finished) return;
  if (!chain.revealed) await sendHost(prog.revealRound(host.publicKey, r.id, Buffer.from(r.seed, 'hex')));
  r.revealed = true;
  if (chain.entrants !== r.players.length) throw new Error('seat list out of sync');
  let tok, pre = [];
  if (r.kind === 0) {
    const t = await tokAccts(r);
    tok = { ...t, dest: (p) => spl.ataOf(p, cfg.token.mint, t.program) };
    // in case someone closed theirs; sent separately so the settle itself stays small
    const missing = (await fetchMany(r.players.map((p) => tok.dest(p)))).map((d, i) => (d ? null : r.players[i])).filter(Boolean);
    for (let i = 0; i < missing.length; i += 6) await sendHost(...missing.slice(i, i + 6).map((p) => spl.createAta(host.publicKey, p, cfg.token.mint, t.program)));
  }
  // keep a copy of the final boards: the cards are closed (rent refunded) right after settlement
  r.final = (await cardsOf(r)).map((c, i) => (c ? { player: r.players[i], ...readCard(c) } : { player: r.players[i] }));
  const settleTx = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }), prog.settle(r.id, cfg.treasury, r.players, tok));
  r.settleSig = await sendHost(...settleTx.instructions);
  r.settled = true; save();
  // give every seat its card rent back
  for (let i = 0; i < r.players.length; i += 8) {
    await sendHost(...r.players.slice(i, i + 8).map((p) => prog.closeCard(r.id, p))).catch((e) => console.warn('close cards', r.id, scrub(e)));
  }
  // then the round itself: escrow token account + round account rent go back to whoever opened it
  await closeRound(r).catch((e) => console.warn('close round', r.id, scrub(e)));
}

// ---------------------------------------------------------------- app
const app = express();
app.disable('x-powered-by');
app.use(require('compression')());
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => { res.set({ 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' }); next(); });
const route = (fn) => async (req, res) => {
  // prover queue full -> 429 so clients back off and retry
  try { await fn(req, res); } catch (e) { res.status(e.status || 400).json({ error: publicError(e) }); }
};
const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
function bucket(perMinute) {
  const seen = new Map();
  setInterval(() => seen.clear(), 60e3).unref();
  return (req, res, next) => {
    const n = (seen.get(clientIp(req)) || 0) + 1;
    seen.set(clientIp(req), n);
    if (n > perMinute && !cfg.test) return res.status(429).json({ error: 'slow down' });
    next();
  };
}

// Per-wallet limiter on top of the per-IP one, so many IPs can't hammer one seat (and one IP can't rotate wallets fast).
const walletSeen = new Map();
setInterval(() => walletSeen.clear(), 60e3).unref();
function walletBucket(req, res, next) {
  const w = String(req.body?.wallet || req.body?.account || '');
  if (!w) return next();
  const k = req.path + '|' + w, n = (walletSeen.get(k) || 0) + 1;
  walletSeen.set(k, n);
  if (n > cfg.walletPerMinute && !(cfg.test && !req.headers['x-test-limits'])) return res.status(429).json({ error: 'slow down' });
  next();
}

// The server RPC (which may carry an API key) stays here; browsers get a narrow proxy.
const RPC_METHODS = new Set(['getLatestBlockhash', 'sendTransaction', 'getSignatureStatuses', 'getBalance', 'getAccountInfo', 'getMultipleAccounts', 'getMinimumBalanceForRentExemption', 'isBlockhashValid', 'getSlot', 'getFeeForMessage', 'getBlockHeight', 'simulateTransaction']);
app.post('/api/rpc', bucket(150), async (req, res) => {
  const b = req.body;
  if (!b || Array.isArray(b) || !RPC_METHODS.has(b.method)) return res.status(403).json({ jsonrpc: '2.0', id: b?.id ?? null, error: { code: -32601, message: 'method not allowed' } });
  try {
    const up = await fetch(cfg.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: b.id, method: b.method, params: b.params }) });
    res.status(up.status).type('json').send(await up.text());
  } catch { res.status(502).json({ jsonrpc: '2.0', id: b.id, error: { code: -32000, message: 'upstream error' } }); }
});

app.get('/api/config', (req, res) => res.json({
  cluster: cfg.cluster, network: cfg.network, rpc: cfg.publicRpc, programId: cfg.programId, host: host?.publicKey.toBase58() || null,
  treasury: cfg.treasury, feeBps: cfg.feeBps, roundEntrySol: cfg.roundEntry / 1e9, roundBurnBps: cfg.roundBurnBps, roundSecs: cfg.roundSecs, roundCap: cfg.roundCap, joinCutoffSecs: cfg.joinCutoffSecs, links: cfg.links,
  token: { mint: cfg.token.mint, symbol: cfg.token.symbol, name: cfg.token.name, decimals: cfg.token.decimals, holderMin: cfg.token.holderMin, mend: cfg.token.mend },
}));

app.get('/api/daily', route(async (req, res) => {
  const [n, d] = today();
  const prev = db.days[n - 1];
  res.json({
    day: n, seal: await sealOf(d), board: prog && d.opened ? prog.at.day(n).toBase58() : null, nextAt: EPOCH + (n + 1) * 864e5,
    yesterday: prev ? { day: n - 1, word: prev.word, salt: prev.salt, seal: await sealOf(prev) } : null,
  });
}));

app.post('/api/daily/guess', bucket(60), route(async (req, res) => {
  const guess = String(req.body?.guess || '').toLowerCase();
  if (!words.allowed.has(guess)) throw new Nope('not in the word list');
  const [, d] = today();
  res.json(await proven(d.word, d.salt, await sealOf(d), guess));
}));

app.get('/api/days/:n', route(async (req, res) => {
  const n = Number(req.params.n), d = db.days[n];
  if (!d) throw new Nope('no such day', 404);
  res.json({ day: n, seal: await sealOf(d), ...(n < dayNow() ? { word: d.word, salt: d.salt } : {}) });
}));

app.get('/api/player/:wallet', route(async (req, res) => {
  if (!isKey(req.params.wallet) || !prog) throw new Nope('bad wallet');
  const s = await fetchAcct(prog.at.streak(req.params.wallet));
  res.json({ streak: s ? readStreak(s) : null, holder: await isHolder(req.params.wallet), pda: prog.at.streak(req.params.wallet).toBase58() });
}));

app.post('/api/streak/mend', bucket(10), walletBucket, route(async (req, res) => {
  const wallet = req.body?.wallet;
  if (!isKey(wallet)) throw new Nope('bad wallet');
  if (!cfg.token.mint) throw new Nope('streak repair opens once the token is live');
  const s = await fetchAcct(prog.at.streak(wallet));
  if (!s) throw new Nope('no streak yet');
  const st = readStreak(s);
  if (st.lastDay !== dayNow() - 2) throw new Nope('repair bridges exactly one missed day');
  const program = cfg.token.program === 'token2022' ? spl.TOKEN22 : spl.TOKEN;
  const raw = BigInt(Math.round(cfg.token.mend * 10 ** cfg.token.decimals));
  const burnIx = spl.burn(spl.ataOf(wallet, cfg.token.mint, program), cfg.token.mint, wallet, raw, cfg.token.decimals, program);
  res.json({ tx: await forPlayer(wallet, [burnIx, prog.mend(wallet, host.publicKey)]) });
}));

// rounds + duels
app.get('/api/rounds', route(async (req, res) => {
  const live = Object.values(db.rounds).filter((r) => r.kind !== 1).sort((a, b) => b.id - a.id).slice(0, 10);
  res.json(live.map((r) => publicRound(r)));
}));
app.get('/api/rounds/:id', route(async (req, res) => {
  const r = db.rounds[req.params.id];
  if (!r) throw new Nope('no such round', 404);
  const data = await fetchAcct(prog.at.round(r.id));
  const cards = r.final ? [] : await cardsOf(r);
  const seats = r.final || r.players.map((p, i) => (cards[i] && cards[i][0] === 3 ? { player: p, ...readCard(cards[i]) } : { player: p }));
  res.json({ ...publicRound(r, data ? readRound(data) : null), seats });
}));
app.post('/api/rounds/:id/join', bucket(20), walletBucket, route(async (req, res) => {
  const r = db.rounds[req.params.id], wallet = req.body?.wallet;
  if (!r || r.kind === 1) throw new Nope('no such round', 404);
  if (!isKey(wallet)) throw new Nope('bad wallet');
  res.json({ tx: await forPlayer(wallet, await joinIxs(r, wallet)) });
}));
// Called after the join lands; we check the chain rather than trusting the caller.
app.post('/api/rounds/:id/seated', route(async (req, res) => {
  const r = db.rounds[req.params.id], wallet = req.body?.wallet;
  if (!r || !isKey(wallet)) throw new Nope('bad request');
  const c = await fetchAcct(prog.at.card(prog.at.round(r.id), wallet));
  if (!c) throw new Nope('seat not found on chain');
  if (!r.players.includes(wallet)) { r.players.push(wallet); save(); }
  res.json({ ok: true, card: prog.at.card(prog.at.round(r.id), wallet).toBase58() });
}));
app.post('/api/rounds/:id/guess', bucket(40), walletBucket, route(async (req, res) => {
  const r = db.rounds[req.params.id], wallet = req.body?.wallet, guess = String(req.body?.guess || '').toLowerCase();
  if (!r || !r.players.includes(wallet)) throw new Nope('not seated');
  if (!words.allowed.has(guess)) throw new Nope('not in the word list');
  if (Date.now() > r.endsAt) throw new Nope('round over');
  // The server is the only one who can make proofs, so it rations them: six per seat, ever.
  const key = `${r.id}:${wallet}`, hist = (db.seats[key] ||= []);
  if (hist.length >= 6) throw new Nope('no guesses left');
  if (hist.some((h) => h.guess === guess)) throw new Nope('already guessed');
  if (r.settled || r.revealed) throw new Nope('round over');
  const { word, salt, seal } = await seatSeal(r, wallet);
  const out = await proven(word, salt, seal, guess);
  hist.push({ guess, clue: out.clue }); save();
  res.json({ ...out, board: prog.at.round(r.id).toBase58(), left: 6 - hist.length });
}));

app.post('/api/duels', bucket(10), route(async (req, res) => {
  const wallet = req.body?.wallet, stake = Math.round(Number(req.body?.stake) * 1e9);
  if (!isKey(wallet)) throw new Nope('bad wallet');
  if (!(stake >= 0.005e9 && stake <= 100e9)) throw new Nope('stake between 0.005 and 100 SOL');
  const r = newRoundRecord(1, stake, cfg.duelSecs, 2);
  r.creator = wallet; save();
  res.json({ id: r.id, link: `/duel/${r.id}`, tx: await forPlayer(wallet, [roundIx(wallet, r), ...(await joinIxs(r, wallet))]) });
}));
app.post('/api/duels/:id/opened', route(async (req, res) => {
  const r = db.rounds[req.params.id];
  if (!r || r.kind !== 1) throw new Nope('no such duel', 404);
  if (!(await fetchAcct(prog.at.round(r.id)))) throw new Nope('duel not on chain yet');
  r.opened = true;
  if (!r.players.includes(r.creator)) r.players.push(r.creator);
  save(); res.json({ ok: true });
}));
app.post('/api/duels/:id/join', bucket(20), walletBucket, route(async (req, res) => {
  const r = db.rounds[req.params.id], wallet = req.body?.wallet;
  if (!r || r.kind !== 1 || !r.opened) throw new Nope('no such duel', 404);
  if (!isKey(wallet)) throw new Nope('bad wallet');
  res.json({ tx: await forPlayer(wallet, await joinIxs(r, wallet)) });
}));

// share cards
app.post('/api/share', bucket(20), route(async (req, res) => {
  const { day, rows, wallet } = req.body || {};
  const d = db.days[day];
  if (!d || !Array.isArray(rows) || !rows.length || rows.length > 6) throw new Nope('bad share');
  const seal = await sealOf(d);
  for (const row of rows) {
    if (row.publicSignals?.[10] !== seal) throw new Nope('proof is for a different seal');
    if (!(await zk.check(row.proof, row.publicSignals))) throw new Nope('a proof did not verify');
  }
  const id = crypto.randomBytes(6).toString('base64url');
  db.shares[id] = { day, wallet: isKey(wallet) ? wallet : null, holder: isKey(wallet) ? await isHolder(wallet) : false, seal, rows: rows.map((r) => ({ clue: r.publicSignals.slice(0, 5).map(Number), proof: r.proof, publicSignals: r.publicSignals })), at: Date.now() };
  save(); res.json({ id, url: `/s/${id}` });
}));
app.get('/api/share/:id', route(async (req, res) => {
  const s = db.shares[req.params.id];
  if (!s) throw new Nope('no such card', 404);
  const d = db.days[s.day];
  res.json({ ...s, word: s.day < dayNow() ? d.word : null, salt: s.day < dayNow() ? d.salt : null });
}));
app.get('/og/:id.png', route(async (req, res) => {
  const s = db.shares[req.params.id];
  if (!s) throw new Nope('no such card', 404);
  const st = s.wallet && prog ? await fetchAcct(prog.at.streak(s.wallet)).catch(() => null) : null;   // live on-chain streak
  res.set('cache-control', 'public, max-age=600').type('png').send(toPng(shareSvg({ title: `ZKdle #${s.day + 1}`, rows: s.rows.map((r) => r.clue), holder: s.holder, symbol: cfg.token.symbol, streak: st ? readStreak(st) : null })));
}));
app.get('/og/seat/:round/:wallet.png', route(async (req, res) => {
  const data = await fetchAcct(prog.at.card(prog.at.round(Number(req.params.round)), req.params.wallet));
  if (!data) throw new Nope('no such seat', 404);
  const c = readCard(data), r = db.rounds[req.params.round];
  res.type('png').send(toPng(shareSvg({ title: r?.kind === 1 ? `Duel ${r.id}` : `Round ${req.params.round}`, rows: c.grid.map((g) => g.clue), holder: await isHolder(req.params.wallet), symbol: cfg.token.symbol, onchain: true })));
}));

// Solana Actions: a duel link unfurls into a "take the duel" button.
const ACTION_HEADERS = {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Accept-Action-Version, X-Accept-Blockchain-Ids',
  'Access-Control-Expose-Headers': 'X-Action-Version, X-Blockchain-Ids', 'X-Action-Version': '2.4',
  'X-Blockchain-Ids': { mainnet: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', devnet: 'solana:EtWTRABZaYq6iMfeYKgaTFbZ3yjSwB1j' }[cfg.cluster] || 'solana:localnet',
};
app.use(['/actions.json', '/api/actions'], (req, res, next) => { res.set(ACTION_HEADERS); req.method === 'OPTIONS' ? res.sendStatus(204) : next(); });
app.get('/actions.json', (req, res) => res.json({ rules: [{ pathPattern: '/duel/*', apiPath: '/api/actions/duel/*' }] }));
const origin = (req) => cfg.base || `${req.protocol}://${req.get('host')}`;
app.get('/api/actions/duel/:id', (req, res) => {
  const r = db.rounds[req.params.id];
  if (!r || r.kind !== 1) return res.status(404).json({ message: 'duel not found' });
  const sol = (r.entry / 1e9).toString();
  res.json({
    type: 'action', icon: `${origin(req)}/brand/avatar.png`, title: `Word duel · ${sol} SOL each`, label: 'Take the duel',
    description: 'Each side gets its own sealed five-letter word. Every clue is a zero-knowledge proof checked on Solana. Fewer guesses wins; ties go to the faster solver.',
    disabled: r.players.length >= 2 || Date.now() > r.endsAt,
    links: { actions: [{ type: 'transaction', label: `Stake ${sol} SOL`, href: `/api/actions/duel/${r.id}` }] },
  });
});
app.post('/api/actions/duel/:id', async (req, res) => {
  try {
    const r = db.rounds[req.params.id], acct = req.body?.account;
    if (!r || r.kind !== 1 || !r.opened) return res.status(404).json({ message: 'duel not found' });
    if (!isKey(acct)) return res.status(400).json({ message: 'invalid account' });
    res.json({ type: 'transaction', transaction: await forPlayer(acct, await joinIxs(r, acct)), message: 'Seat taken. Open the link to play.' });
  } catch (e) { res.status(400).json({ message: publicError(e) }); }
});

if (cfg.test) {
  app.post('/api/test/tick', route(async (req, res) => { await tick(); res.json({ ok: true }); }));
  app.post('/api/test/end/:id', route(async (req, res) => { db.rounds[req.params.id].endsAt = 0; save(); res.json({ ok: true }); }));
  app.get('/api/test/seat/:id/:wallet', route(async (req, res) => res.json(words.seatWord(db.rounds[req.params.id].seed, Number(req.params.id), req.params.wallet).word)));
  app.post('/api/test/reveal/:id', route(async (req, res) => { const r = db.rounds[req.params.id]; await sendHost(prog.revealRound(host.publicKey, r.id, Buffer.from(r.seed, 'hex'))); r.revealed = true; save(); res.json({ ok: true }); }));
  // everything still secret, so the leak test can grep public responses for it
  app.get('/api/test/secrets', route(async (req, res) => res.json({
    days: Object.values(db.days).filter((d) => !d.revealed).map((d) => ({ word: d.word, salt: d.salt })),
    rounds: Object.values(db.rounds).filter((r) => !r.revealed).map((r) => ({ id: r.id, seed: r.seed, words: r.players.map((p) => { const w = words.seatWord(r.seed, r.id, p); return { word: w.word, salt: w.salt.toString() }; }) })),
  })));
  app.get('/api/test/today', route(async (req, res) => res.json(today()[1].word)));
  app.post('/api/test/price', route(async (req, res) => { const s = await pricer.sample(); res.json({ spot: s, twap: pricer.twap() }); }));
  app.post('/api/test/round', route(async (req, res) => {
    const r = await openBounty(Number(req.body.secs), Number(req.body.cap), req.body.entry, req.body.maxPotSol ? Number(req.body.maxPotSol) : undefined);
    res.json({ id: r.id, entry: r.entry, refLamports: r.refLamports, priceSource: r.priceSource });
  }));
  app.post('/api/test/settle/:id', route(async (req, res) => { await maybeSettle(db.rounds[req.params.id]); res.json(publicRound(db.rounds[req.params.id])); }));
}

// pages
const pub = path.join(__dirname, 'public');
const page = (f) => (req, res) => res.sendFile(path.join(pub, f));
app.get(['/play', '/duel', '/round', '/duel/:id', '/round/:id'], page('play.html'));
app.get('/s/:id', (req, res) => {
  const s = db.shares[req.params.id];
  let html = fs.readFileSync(path.join(pub, 'play.html'), 'utf8');
  if (s) {
    const img = `${origin(req)}/og/${req.params.id}.png`;
    html = html.replace('<!--og-->', `<meta property="og:image" content="${img}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${img}">`);
  }
  res.type('html').send(html);
});
app.use(express.static(pub, { extensions: ['html'], maxAge: 0, setHeaders: (res) => res.set('cache-control', 'no-cache') }));

if (require.main === module) {
  app.listen(cfg.port, () => console.log(`zkdle on :${cfg.port} · ${cfg.network}`));
  if (host && prog) { setTimeout(tick, 1500); setInterval(tick, 20e3).unref(); }
}
module.exports = { app, tick };
