// End-to-end run on a throwaway solana-test-validator.
// Boots the validator with the program preloaded, starts the server in test mode,
// then plays a daily, a bounty round and a duel with real proofs.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const web3 = require('@solana/web3.js');
const splt0 = require('@solana/spl-token');
// ZK_E2E_TOKEN22=1 runs the whole suite with a pump.fun-style $PROOF: Token-2022 mint carrying MetadataPointer +
// TokenMetadata extensions (what pump.fun's create_v2 mints look like). The mock wSOL side stays legacy SPL Token.
const T22 = process.env.ZK_E2E_TOKEN22 === '1';
const t22 = new Set();
const pidOf = (m) => (t22.has(new web3.PublicKey(m).toBase58()) ? splt0.TOKEN_2022_PROGRAM_ID : splt0.TOKEN_PROGRAM_ID);
const splt = {
  async createMint(conn, payer, auth, freeze, dec, opts = {}) {
    if (!(T22 && opts.proof)) return splt0.createMint(conn, payer, auth, freeze, dec);
    const kp = web3.Keypair.generate(), P = splt0.TOKEN_2022_PROGRAM_ID;
    const meta = { mint: kp.publicKey, name: 'ZKdle Proof', symbol: 'PROOF', uri: 'https://zkdle.fun/token.json', additionalMetadata: [] };
    const len = splt0.getMintLen([splt0.ExtensionType.MetadataPointer]);
    const full = len + splt0.TYPE_SIZE + splt0.LENGTH_SIZE + require('@solana/spl-token-metadata').pack(meta).length;
    const tx = new web3.Transaction().add(
      web3.SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: kp.publicKey, space: len, lamports: await conn.getMinimumBalanceForRentExemption(full), programId: P }),
      splt0.createInitializeMetadataPointerInstruction(kp.publicKey, auth, kp.publicKey, P),
      splt0.createInitializeMintInstruction(kp.publicKey, dec, auth, freeze, P),
      require('@solana/spl-token-metadata').createInitializeInstruction({ programId: P, metadata: kp.publicKey, updateAuthority: auth, mint: kp.publicKey, mintAuthority: auth, name: meta.name, symbol: meta.symbol, uri: meta.uri }));
    await web3.sendAndConfirmTransaction(conn, tx, [payer, kp]);
    t22.add(kp.publicKey.toBase58());
    return kp.publicKey;
  },
  createAccount: (conn, payer, mint, owner, kp) => splt0.createAccount(conn, payer, mint, owner, kp, undefined, pidOf(mint)),
  mintTo: (conn, payer, mint, dest, auth, amt) => splt0.mintTo(conn, payer, mint, dest, auth, amt, [], undefined, pidOf(mint)),
  getAssociatedTokenAddressSync: (mint, owner, off = false) => splt0.getAssociatedTokenAddressSync(mint, owner, off, pidOf(mint)),
  getOrCreateAssociatedTokenAccount: (conn, payer, mint, owner, off = false) => splt0.getOrCreateAssociatedTokenAccount(conn, payer, mint, owner, off, undefined, undefined, pidOf(mint)),
  getMint: (conn, mint) => splt0.getMint(conn, mint, undefined, pidOf(mint)),
  async getAccount(conn, addr) { const i = await conn.getAccountInfo(addr); return splt0.getAccount(conn, addr, undefined, i ? i.owner : splt0.TOKEN_PROGRAM_ID); },
  async transfer(conn, payer, from, to, owner, amt) { const a = await splt.getAccount(conn, from); const m = await splt.getMint(conn, a.mint); return splt0.transferChecked(conn, payer, from, a.mint, to, owner, amt, m.decimals, [], undefined, pidOf(a.mint)); },
};
const { client, readCard, readStreak, readRound } = require('../lib/sdk');
const spl = require('../lib/spl');

const ROOT = path.join(__dirname, '..');
const SO = process.env.ZK_E2E_SO || path.join(ROOT, 'program/target/deploy/zkdle.so'); // ZK_E2E_SO=/path/verified.so to test the exact on-chain build
const RPC_PORT = 8939, PORT = 5391, RPC = `http://127.0.0.1:${RPC_PORT}`, API = `http://127.0.0.1:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zkdle-e2e-'));
const kids = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const step = async (name, fn) => {
  const t = Date.now();
  try { await fn(); results.push(['PASS', name, Date.now() - t]); console.log('  ✓', name); }
  catch (e) { results.push(['FAIL', name, Date.now() - t]); console.log('  ✗', name, '\n   ', e.message); throw e; }
};
const rejects = async (p, label) => {
  try { await p; } catch { return; }
  throw new Error(`expected rejection: ${label}`);
};

async function main() {
  const programKp = web3.Keypair.generate();
  const host = web3.Keypair.generate(), treasury = web3.Keypair.generate();
  const players = Array.from({ length: 5 }, () => web3.Keypair.generate());
  const pid = programKp.publicKey.toBase58();

  const v = spawn('solana-test-validator', ['--reset', '--quiet', '--ledger', path.join(tmp, 'ledger'), '--rpc-port', String(RPC_PORT), '--faucet-port', String(RPC_PORT + 2), '--gossip-port', String(RPC_PORT + 3), '--dynamic-port-range', `${RPC_PORT + 100}-${RPC_PORT + 160}`, '--bpf-program', pid, SO], { stdio: 'ignore' });
  kids.push(v);
  const conn = new web3.Connection(RPC, 'confirmed');
  for (let i = 0; i < 60; i++) { try { await conn.getSlot(); break; } catch { await sleep(500); } }
  for (const k of [host, treasury, ...players]) await conn.confirmTransaction(await conn.requestAirdrop(k.publicKey, 20e9), 'confirmed');

  const prog = client(pid);
  const send = async (ixs, signers) => {
    const tx = new web3.Transaction().add(web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 600000 }), ...ixs);
    return web3.sendAndConfirmTransaction(conn, tx, signers, { commitment: 'confirmed' });
  };
  const signAndSend = async (b64, kp) => {
    const tx = web3.Transaction.from(Buffer.from(b64, 'base64'));
    tx.partialSign(kp);
    const sig = await conn.sendRawTransaction(tx.serialize());
    await conn.confirmTransaction(sig, 'confirmed');
    return sig;
  };

  console.log('\nzkdle e2e · program', pid);

  await step('config refuses a platform fee above 20%', async () => {
    await rejects(send([prog.setup(host.publicKey, treasury.publicKey, 3000)], [host]), 'fee 30%');
  });
  await step('config: treasury + 5% fee recorded on-chain', async () => {
    await send([prog.setup(host.publicKey, treasury.publicKey, 500)], [host]);
    const d = (await conn.getAccountInfo(prog.at.config())).data;
    assert.equal(new web3.PublicKey(d.subarray(33, 65)).toBase58(), treasury.publicKey.toBase58());
    assert.equal(d.readUInt16LE(65), 500);
  });

  // $PROOF stand-in (6 decimals) + a mock AMM pool whose two reserve accounts the server prices from.
  const mint = await splt.createMint(conn, host, host.publicKey, null, 6, { proof: true });
  const TPX = pidOf(mint); // the $PROOF token program (Token or Token-2022)
  console.log('  $PROOF test mint on', TPX.toBase58());
  const solMint = await splt.createMint(conn, host, host.publicKey, null, 9);
  const poolOwner = web3.Keypair.generate();
  const poolTok = await splt.createAccount(conn, host, mint, poolOwner.publicKey, web3.Keypair.generate());
  const poolSol = await splt.createAccount(conn, host, solMint, poolOwner.publicKey, web3.Keypair.generate());
  await splt.mintTo(conn, host, mint, poolTok, host, 1_000_000e6);   // 1,000,000 PROOF
  await splt.mintTo(conn, host, solMint, poolSol, host, 5e9);        // 5 SOL  -> 0.000005 SOL per PROOF
  const ataOf = (k) => splt.getAssociatedTokenAddressSync(mint, k.publicKey);
  for (const k of players) { const a = await splt.getOrCreateAssociatedTokenAccount(conn, host, mint, k.publicKey); await splt.mintTo(conn, host, mint, a.address, host, 100_000e6); }
  const tokBal = async (addr) => { try { return Number((await splt.getAccount(conn, addr)).amount); } catch { return 0; } };   // a closed escrow counts as empty
  const supply = async () => Number((await splt.getMint(conn, mint)).supply);

  const env = { ...process.env, ZK_PREVIEW: '0', ZK_TEST: '1', ZK_TOKEN_MINT: mint.toBase58(), ZK_TOKEN_DECIMALS: '6', ZK_ROUND_ENTRY_SOL: '0.01', ZK_ROUND_BURN_BPS: '1000',
    ZK_PRICE_POOL_VAULTS: `${poolTok.toBase58()},${poolSol.toBase58()}`, ZK_PRICE_SAMPLE_SECS: '3600', ZK_PRICE_MIN_SAMPLES: '3', ZK_JOIN_CUTOFF_SECS: '6', PORT: String(PORT), ZK_CLUSTER: 'localnet', ZK_RPC: RPC, ZK_PROGRAM_ID: pid,
    ZK_HOST_KEY: JSON.stringify([...host.secretKey]), ZK_TREASURY: treasury.publicKey.toBase58(), ZK_FEE_BPS: '500', ZK_DB: path.join(tmp, 'db.json'), ZK_SECRET_KEY: require('crypto').randomBytes(32).toString('hex') };
  let srv;
  const boot = async () => {
    srv = spawn('node', [path.join(ROOT, 'server.js')], { env, stdio: ['ignore', 'pipe', 'inherit'] });
    kids.push(srv);
    for (let i = 0; i < 40; i++) { try { await fetch(API + '/api/config'); break; } catch { await sleep(250); } }
  };
  await boot();
  const api = async (p, body) => {
    const r = await fetch(API + p, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(`${p}: ${j.error || j.message}`);
    return j;
  };
  await api('/api/test/tick', {});

  await step('rpc proxy allows reads and blocks other methods', async () => {
    const ok = await fetch(API + '/api/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSlot' }) });
    assert.equal(ok.status, 200);
    const no = await fetch(API + '/api/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'requestAirdrop', params: [] }) });
    assert.equal(no.status, 403);
    const cfg = await api('/api/config');
    assert.ok(!JSON.stringify(cfg).includes(String(RPC_PORT)), 'server rpc must not leak');
  });

  // ---------------- daily
  const A = players[0];
  const daily = await api('/api/daily');
  const word = await api('/api/test/today');
  const decoys = ['crane', 'pious', 'lymph', 'dough', 'fjord'].filter((w) => w !== word);
  await step('daily: two misses + a solve, each clue proven and verified on-chain', async () => {
    for (const g of [decoys[0], decoys[1], word]) {
      const r = await api('/api/daily/guess', { guess: g });
      const raw = Buffer.from(r.payload, 'base64');
      await send([prog.guess(A.publicKey, daily.board, { letters: raw.subarray(0, 5), clue: raw.subarray(5, 10), proof: raw.subarray(10) })], [A]);
    }
    const c = readCard((await conn.getAccountInfo(prog.at.card(daily.board, A.publicKey))).data);
    assert.equal(c.rows, 3); assert.equal(c.solved, true);
    assert.deepEqual(c.grid[2].clue, [1, 1, 1, 1, 1]);
  });
  await step('daily: a forged clue (gray→green) is rejected by the verifier', async () => {
    const B = players[1];
    const r = await api('/api/daily/guess', { guess: decoys[2] });
    const raw = Buffer.from(r.payload, 'base64');
    const clue = Buffer.from(raw.subarray(5, 10));
    const i = clue.findIndex((x) => x !== 1); clue[i] = 1;
    await rejects(send([prog.guess(B.publicKey, daily.board, { letters: raw.subarray(0, 5), clue, proof: raw.subarray(10) })], [B]), 'forged clue');
  });
  await step('streak PDA: current 1, best 1, solves 1', async () => {
    const s = readStreak((await conn.getAccountInfo(prog.at.streak(A.publicKey))).data);
    assert.deepEqual([s.current, s.best, s.solves, s.lastDay], [1, 1, 1, daily.day]);
  });
  await step('share card: server re-verifies proofs and renders the OG image', async () => {
    const rows = [];
    for (const g of [decoys[3], word]) rows.push(await api('/api/daily/guess', { guess: g }));
    const s = await api('/api/share', { day: daily.day, rows });
    const png = await fetch(API + `/og/${s.id}.png`);
    assert.equal(png.headers.get('content-type'), 'image/png');
    rows[0].publicSignals[0] = String((Number(rows[0].publicSignals[0]) + 1) % 3);
    await rejects(api('/api/share', { day: daily.day, rows }), 'tampered share');
  });

  // ---------------- bounty round, paid in $PROOF
  await step('price: TWAP of pool reserves fixes the entry at 0.01 SOL worth of $PROOF (one spike is ignored)', async () => {
    for (let i = 0; i < 3; i++) await api('/api/test/price', {});
    await splt.mintTo(conn, host, solMint, poolSol, host, 45e9);     // someone pumps the pool 10x for one sample
    const { spot, twap } = await api('/api/test/price', {});
    assert.ok(spot.p > twap.p * 5, 'spike seen in spot');
    assert.equal(twap.p, 0.005, 'median ignores the spike');
  });
  const { id: rid, entry: entryStr, refLamports } = await api('/api/test/round', { secs: 40, cap: 10 });
  const entry = Number(entryStr), burnPer = entry * 0.10, feePer = entry * 0.05, potPer = entry - burnPer - feePer;
  const vault = splt.getAssociatedTokenAddressSync(mint, prog.at.round(rid), true);
  const tTa = splt.getAssociatedTokenAddressSync(mint, treasury.publicKey);
  const bounty = players.slice(0, 4);
  await step('bounty: entry stored on-chain = 2,000 $PROOF (≈ 0.01 SOL), round owns its escrow account', async () => {
    assert.equal(entry, 2000e6); assert.equal(refLamports, 0.01e9);
    const r = readRound((await conn.getAccountInfo(prog.at.round(rid))).data);
    assert.equal(r.entry, entry); assert.equal(r.mint, mint.toBase58()); assert.equal(r.burnBps, 1000); assert.equal(r.refLamports, 0.01e9);
    assert.equal((await splt.getAccount(conn, vault)).owner.toBase58(), prog.at.round(rid).toBase58());
  });
  await step('bounty: four seats — 10% burned (supply drops), 5% to treasury, 85% escrowed in the round', async () => {
    const s0 = await supply();
    for (const p of bounty) {
      const { tx } = await api(`/api/rounds/${rid}/join`, { wallet: p.publicKey.toBase58() });
      await signAndSend(tx, p);
      await api(`/api/rounds/${rid}/seated`, { wallet: p.publicKey.toBase58() });
    }
    assert.equal(readRound((await conn.getAccountInfo(prog.at.round(rid))).data).entrants, 4);
    assert.equal(s0 - (await supply()), burnPer * 4, 'burned');
    assert.equal(await tokBal(tTa), feePer * 4, 'treasury fee');
    assert.equal(await tokBal(vault), potPer * 4, 'escrow');
    assert.equal(await tokBal(ataOf(bounty[0])), 100_000e6 - entry);
  });
  await step('bounty: a seat without the host co-signature is refused', async () => {
    const X = players[4];
    const tok = { playerTa: ataOf(X), mint, vault, treasuryTa: tTa, program: TPX };
    await rejects(send([prog.join(X.publicKey, host.publicKey, rid, Buffer.alloc(32, 7), tok)], [X]), 'missing host sig');
  });
  const playSeat = async (round, p, misses) => {
    const w = await api(`/api/test/seat/${round}/${p.publicKey.toBase58()}`);
    const tries = [...['crane', 'pious', 'lymph', 'dough', 'fjord', 'swamp'].filter((x) => x !== w).slice(0, misses), ...(misses < 6 ? [w] : [])];
    for (const g of tries) {
      const r = await api(`/api/rounds/${round}/guess`, { wallet: p.publicKey.toBase58(), guess: g });
      const raw = Buffer.from(r.payload, 'base64');
      await send([prog.guess(p.publicKey, r.board, { letters: raw.subarray(0, 5), clue: raw.subarray(5, 10), proof: raw.subarray(10) })], [p]);
      await sleep(misses === 0 ? 0 : 400);
    }
  };
  await step('bounty: players solve in 1, 2, 3 guesses and one runs out of rows', async () => {
    await playSeat(rid, bounty[0], 0);
    await playSeat(rid, bounty[1], 1);
    await playSeat(rid, bounty[2], 2);
    await playSeat(rid, bounty[3], 6);
  });
  await step('bounty: the server rations proofs (no 7th guess)', async () => {
    await rejects(api(`/api/rounds/${rid}/guess`, { wallet: bounty[3].publicKey.toBase58(), guess: 'crane' }), '7th guess');
  });
  const tokFor = { vault, mint, program: TPX, dest: (k) => splt.getAssociatedTokenAddressSync(mint, new web3.PublicKey(k)) };
  await step('security: nothing public leaks a live answer, salt or seed before reveal', async () => {
    const sec = await api('/api/test/secrets');
    const live = sec.rounds.find((r) => r.id === rid);
    assert.ok(live && live.seed && live.words.length === 4);
    const bodies = [];
    for (const p of ['/api/config', '/api/daily', '/api/rounds', `/api/rounds/${rid}`, `/api/days/${daily.day}`]) bodies.push(await (await fetch(API + p)).text());
    for (const [p, b] of [[`/api/rounds/${rid}/guess`, { wallet: 'nope', guess: 'crane' }], [`/api/rounds/${rid}/join`, { wallet: bounty[0].publicKey.toBase58() }], ['/api/daily/guess', { guess: 'zzzzz' }], ['/api/share', { day: daily.day, rows: [{}] }]]) {
      bodies.push(await (await fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).text());
    }
    const all = bodies.join('\n');
    const needles = [...sec.days.flatMap((d) => [d.salt, `"${d.word}"`]), ...sec.rounds.flatMap((r) => [r.seed, ...r.words.map((w) => w.salt)])];
    for (const n of needles) assert.ok(!all.includes(n), 'leaked a live secret');
  });
  await step('security: state file is AES-256-GCM encrypted at rest', async () => {
    const text = fs.readFileSync(env.ZK_DB, 'utf8');
    assert.ok(text.startsWith('zkv1:'));
    const sec = await api('/api/test/secrets');
    for (const r of sec.rounds) assert.ok(!text.includes(r.seed));
    for (const d of sec.days) assert.ok(!text.includes(d.salt) && !text.includes(`"${d.word}"`));
  });
  await step('security: per-wallet rate limit returns 429', async () => {
    const w = web3.Keypair.generate().publicKey.toBase58();
    let last;
    for (let i = 0; i < 21; i++) last = await fetch(API + `/api/rounds/${rid}/guess`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-limits': '1' }, body: JSON.stringify({ wallet: w, guess: 'crane' }) });
    assert.equal(last.status, 429);
  });
  await step('security: a repeated guess is refused (no replays)', async () => {
    await rejects(api(`/api/rounds/${rid}/guess`, { wallet: bounty[1].publicKey.toBase58(), guess: 'crane' }), 'repeat');
  });
  await step('bounty: settle refused with the wrong treasury, a missing seat, or a payout to someone else', async () => {
    await api(`/api/test/reveal/${rid}`, {});
    await rejects(api(`/api/rounds/${rid}/guess`, { wallet: bounty[0].publicKey.toBase58(), guess: 'pious' }), 'guess after reveal');
    const r = readRound((await conn.getAccountInfo(prog.at.round(rid))).data);
    while (Date.now() / 1000 < r.endsAt + 1) await sleep(1000);
    const keys = bounty.map((k) => k.publicKey);
    await rejects(send([prog.settle(rid, players[4].publicKey, keys, tokFor)], [players[4]]), 'wrong treasury');
    await rejects(send([prog.settle(rid, treasury.publicKey, keys.slice(0, 3), tokFor)], [players[4]]), 'missing a seat');
    const thief = { ...tokFor, dest: () => ataOf(players[4]) };
    await rejects(send([prog.settle(rid, treasury.publicKey, keys, thief)], [players[4]]), 'payout to a stranger');
  });
  await step('bounty: top 30% split the escrowed pot 2:1 in $PROOF (fee already taken at entry)', async () => {
    const before = await Promise.all(bounty.map((k) => tokBal(ataOf(k))));
    const res = await api(`/api/test/settle/${rid}`, {});
    assert.ok(res.settled);
    const d = (await Promise.all(bounty.map((k) => tokBal(ataOf(k))))).map((x, i) => x - before[i]);
    const pot = potPer * 4;
    assert.equal(d[1], Math.floor(pot / 3), '2nd place');
    assert.equal(d[0], pot - Math.floor(pot / 3), '1st place');
    assert.equal(d[2], 0); assert.equal(d[3], 0);
    assert.equal(await tokBal(vault), 0, 'escrow emptied');
    console.log(`    entry ${entry / 1e6} PROOF ≈ 0.01 SOL · pot ${pot / 1e6} → 1st +${d[0] / 1e6}, 2nd +${d[1] / 1e6} PROOF`);
    assert.ok((await api(`/api/rounds/${rid}`)).seed, 'seed revealed for public re-check');
  });
  await step('bounty: no solver → each seat gets its escrowed 85% back; late seats refused near the close', async () => {
    const { id: r2 } = await api('/api/test/round', { secs: 20, cap: 10 });
    const v2 = splt.getAssociatedTokenAddressSync(mint, prog.at.round(r2), true);
    const two = [players[3], players[4]];
    const start = await Promise.all(two.map((k) => tokBal(ataOf(k))));
    for (const p of two) { const { tx } = await api(`/api/rounds/${r2}/join`, { wallet: p.publicKey.toBase58() }); await signAndSend(tx, p); await api(`/api/rounds/${r2}/seated`, { wallet: p.publicKey.toBase58() }); }
    assert.equal(await tokBal(v2), potPer * 2);
    await playSeat(r2, players[3], 6);                                         // misses every row
    const r = readRound((await conn.getAccountInfo(prog.at.round(r2))).data);
    const srvEnds = (await api(`/api/rounds/${r2}`)).endsAt;                  // server's clock for the seat cutoff (6 s)
    while (Date.now() < srvEnds - 3000) await sleep(300);
    await rejects(api(`/api/rounds/${r2}/join`, { wallet: players[0].publicKey.toBase58() }), 'join inside the cutoff');
    while (Date.now() / 1000 < r.endsAt + 1) await sleep(1000);
    const res = await api(`/api/test/settle/${r2}`, {});
    assert.ok(res.settled);
    const end = await Promise.all(two.map((k) => tokBal(ataOf(k))));
    end.forEach((x, i) => assert.equal(start[i] - x, entry - potPer, 'only burn + fee are lost'));
    assert.equal(await tokBal(v2), 0);
  });

  await step('bounty: the program refuses a 13-seat round (early-access cap 12)', async () => {
    const commit = Buffer.alloc(32, 1);
    await rejects(send([prog.openRound(host.publicKey, host.publicKey, { id: 990001, entry: 1e6, cap: 13, secs: 60, commit, kind: 0, tok: { mint, burnBps: 1000, refLamports: 0 } })], [host]), 'cap 13');
  });
  await step('bounty: a full 12-player $PROOF round settles in one legacy transaction, cards closed for rent', async () => {
    const twelve = Array.from({ length: 12 }, () => web3.Keypair.generate());
    for (const k of twelve) await conn.confirmTransaction(await conn.requestAirdrop(k.publicKey, 2e9), 'confirmed');
    for (const k of twelve) { const a = await splt.getOrCreateAssociatedTokenAccount(conn, host, mint, k.publicKey); await splt.mintTo(conn, host, mint, a.address, host, 10_000e6); }
    const { id: r3 } = await api('/api/test/round', { secs: 300, cap: 12 });
    for (const p of twelve) { const { tx } = await api(`/api/rounds/${r3}/join`, { wallet: p.publicKey.toBase58() }); await signAndSend(tx, p); await api(`/api/rounds/${r3}/seated`, { wallet: p.publicKey.toBase58() }); }
    const v3 = splt.getAssociatedTokenAddressSync(mint, prog.at.round(r3), true);
    const tok3 = { vault: v3, mint, program: TPX, dest: (k) => splt.getAssociatedTokenAddressSync(mint, new web3.PublicKey(k)) };
    const probe = new web3.Transaction().add(web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }), prog.settle(r3, treasury.publicKey, twelve.map((k) => k.publicKey), tok3));
    probe.feePayer = host.publicKey; probe.recentBlockhash = (await conn.getLatestBlockhash()).blockhash; probe.sign(host);
    const size = probe.serialize().length;
    assert.ok(size <= 1232, `settle tx ${size} bytes`);
    // burst: all 12 ask for a proof at the same moment; the prove queue serialises them, nobody is dropped
    const t0 = Date.now();
    const first = await Promise.all(twelve.map(async (p) => {
      const w = await api(`/api/test/seat/${r3}/${p.publicKey.toBase58()}`);
      return { p, w, r: await api(`/api/rounds/${r3}/guess`, { wallet: p.publicKey.toBase58(), guess: w === 'crane' ? 'pious' : 'crane' }) };
    }));
    console.log(`    burst: 12 concurrent proofs in ${Date.now() - t0} ms`);
    await Promise.all(first.map(({ p, r }) => { const raw = Buffer.from(r.payload, 'base64'); return send([prog.guess(p.publicKey, r.board, { letters: raw.subarray(0, 5), clue: raw.subarray(5, 10), proof: raw.subarray(10) })], [p]); }));
    for (const { p, w } of first) {
      const r = await api(`/api/rounds/${r3}/guess`, { wallet: p.publicKey.toBase58(), guess: w });
      const raw = Buffer.from(r.payload, 'base64');
      await send([prog.guess(p.publicKey, r.board, { letters: raw.subarray(0, 5), clue: raw.subarray(5, 10), proof: raw.subarray(10) })], [p]);
    }
    const pot = await tokBal(v3);
    assert.ok(pot > 0);
    const res = await api(`/api/test/settle/${r3}`, {});   // full + everyone finished: settles without waiting for the clock
    assert.ok(res.settled);
    const t = await conn.getTransaction(res.settleSig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    assert.ok(!t.meta.err);
    const cu = t.meta.computeUnitsConsumed;
    assert.equal(await tokBal(v3), 0, 'escrow paid out');
    await sleep(1500);
    const cards = await conn.getMultipleAccountsInfo(twelve.map((k) => prog.at.card(prog.at.round(r3), k.publicKey)));
    assert.ok(cards.every((c) => c === null), 'cards closed, rent back to players');
    console.log(`    12 seats · settle tx ${size}/1232 bytes · ${cu} CU · ${t.transaction.message.accountKeys.length} accounts`);
    fs.writeFileSync(path.join(ROOT, 'docs', 'capacity.txt'), `12-seat $PROOF settle: ${size}/1232 bytes, ${cu} compute units, ${t.transaction.message.accountKeys.length} accounts (local validator)\n`);
  });

  // ---------------- duel
  const [P, Q] = [players[1], players[2]];
  let duelId;
  await step('duel: creator opens a 0.05 SOL duel, opponent takes it through the Blink action', async () => {
    const d = await api('/api/duels', { wallet: P.publicKey.toBase58(), stake: 0.05 });
    duelId = d.id;
    await signAndSend(d.tx, P);
    await api(`/api/duels/${duelId}/opened`, {});
    const meta = await api(`/api/actions/duel/${duelId}`);
    assert.equal(meta.type, 'action');
    const act = await api(`/api/actions/duel/${duelId}`, { account: Q.publicKey.toBase58() });
    await signAndSend(act.transaction, Q);
    await api(`/api/rounds/${duelId}/seated`, { wallet: Q.publicKey.toBase58() });
  });
  await step('duel: fewer guesses wins the stakes (minus fee) without waiting for the deadline', async () => {
    await playSeat(duelId, P, 2);
    await playSeat(duelId, Q, 1);
    const b = await conn.getBalance(Q.publicKey);
    const res = await api(`/api/test/settle/${duelId}`, {});
    assert.ok(res.settled);
    await sleep(1000);
    const won = (await conn.getBalance(Q.publicKey)) - b;
    const cardRent = await conn.getMinimumBalanceForRentExemption(175);       // close_card hands the seat's rent back too
    assert.equal(won, 0.1e9 * 0.95 + cardRent);
  });

  // ---------------- token: streak repair burns $TOKEN in the same tx
  await step('streak repair: burn + host co-sign bridges one missed day', async () => {
    const ata = { address: ataOf(A) };
    const t0 = await tokBal(ata.address);
    const s0 = readStreak((await conn.getAccountInfo(prog.at.streak(A.publicKey))).data);
    await send([spl.burn(ata.address, mint, A.publicKey, 10_000e6, 6, TPX), prog.mend(A.publicKey, host.publicKey)], [A, host]);
    const s1 = readStreak((await conn.getAccountInfo(prog.at.streak(A.publicKey))).data);
    assert.equal(s1.lastDay, s0.lastDay + 1); assert.equal(s1.mends, 1);
    assert.equal(t0 - (await tokBal(ata.address)), 10_000e6);
    await rejects(send([prog.mend(A.publicKey, players[3].publicKey)], [A, players[3]]), 'mend without host');
  });

  await step('holder badge: 1,000,000 $PROOF threshold read from the chain (works for Token and Token-2022)', async () => {
    const rich = web3.Keypair.generate(), poor = web3.Keypair.generate();
    for (const [k, amt] of [[rich, 1_000_000e6], [poor, 999_999e6]]) { const a = await splt.getOrCreateAssociatedTokenAccount(conn, host, mint, k.publicKey); await splt.mintTo(conn, host, mint, a.address, host, amt); }
    assert.equal((await api(`/api/player/${rich.publicKey.toBase58()}`)).holder, true);
    assert.equal((await api(`/api/player/${poor.publicKey.toBase58()}`)).holder, false);
  });


  // ---------------- adversarial, straight against the program
  const zk = require('../zk/lib');
  const wordsLib = require('../lib/words');
  const crypto = require('crypto');
  let nextRid = 880000;
  const direct = async ({ kind = 0, entryRaw = 1000e6, cap = 4, secs = 60 }) => {
    const id = nextRid++, seed = crypto.randomBytes(32);
    const tokO = kind === 0 ? { mint, burnBps: 1000, refLamports: 0 } : undefined;
    await send([prog.openRound(host.publicKey, host.publicKey, { id, entry: entryRaw, cap, secs, commit: wordsLib.sha256(seed), kind, tok: tokO }),
      ...(kind === 0 ? [spl.createAta(host.publicKey, prog.at.round(id), mint, TPX)] : [])], [host]);
    return { id, seed, vault: splt.getAssociatedTokenAddressSync(mint, prog.at.round(id), true) };
  };
  const seatOf = async (R, p) => { const { word, salt } = wordsLib.seatWord(R.seed.toString('hex'), R.id, p.publicKey.toBase58()); return { word, salt, seal: await zk.seal(word, salt) }; };
  const joinIx = (R, p, seal, kind = 0) => prog.join(p.publicKey, host.publicKey, R.id, zk.be32(seal), kind === 0 ? { playerTa: ataOf(p), mint, vault: R.vault, treasuryTa: tTa, program: TPX } : undefined);
  const guessIx = async (R, p, s, g, sealOverride) => {
    const { proof, clue } = await zk.prove(s.word, s.salt, g, sealOverride || s.seal);
    return prog.guess(p.publicKey, prog.at.round(R.id), { letters: Buffer.from(zk.letters(g)), clue: Buffer.from(clue), proof: zk.chainProof(proof) });
  };
  const fresh = async (n, tokens = 10_000e6) => {
    const ks = Array.from({ length: n }, () => web3.Keypair.generate());
    for (const k of ks) await conn.confirmTransaction(await conn.requestAirdrop(k.publicKey, 2e9), 'confirmed');
    for (const k of ks) { const a = await splt.getOrCreateAssociatedTokenAccount(conn, host, mint, k.publicKey); if (tokens) await splt.mintTo(conn, host, mint, a.address, host, tokens); }
    return ks;
  };
  const tokB = (R) => ({ vault: R.vault, mint, program: TPX, dest: (k) => splt.getAssociatedTokenAddressSync(mint, new web3.PublicKey(k)) });

  const [E1, E2] = await fresh(2);
  const RA = await direct({ cap: 4, secs: 25 });
  const s1 = await seatOf(RA, E1), s2 = await seatOf(RA, E2);
  await step('adversarial: double join, replayed join tx and unknown signer are refused', async () => {
    const tx = new web3.Transaction().add(joinIx(RA, E1, s1.seal));
    tx.feePayer = E1.publicKey; tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash; tx.sign(E1, host);
    const raw = tx.serialize();
    await conn.confirmTransaction(await conn.sendRawTransaction(raw), 'confirmed');
    await rejects(conn.sendRawTransaction(raw).then((sig) => conn.confirmTransaction(sig, 'confirmed').then((c) => { if (c.value.err) throw new Error('err'); })), 'replayed tx');
    await rejects(send([joinIx(RA, E1, s1.seal)], [E1, host]), 'second seat for the same wallet');
    await send([joinIx(RA, E2, s2.seal)], [E2, host]);
    assert.equal(readRound((await conn.getAccountInfo(prog.at.round(RA.id))).data).entrants, 2);
  });
  await step('adversarial: a valid proof for another salt/seal is rejected on this card', async () => {
    const other = { ...s1, salt: s1.salt + 1n }; other.seal = await zk.seal(other.word, other.salt);
    await rejects(send([await guessIx(RA, E1, other, 'crane')], [E1]), 'proof for a different seal');
    // E2's genuine proof replayed onto E1's card
    const ix = await guessIx(RA, E2, s2, 'crane');
    ix.keys[0].pubkey = E1.publicKey; ix.keys[1].pubkey = prog.at.card(prog.at.round(RA.id), E1.publicKey);
    await rejects(send([ix], [E1]), 'another seat\u2019s proof');
  });
  await step('adversarial: settle before reveal / before the end is refused; close_card before settle too', async () => {
    await rejects(send([prog.settle(RA.id, treasury.publicKey, [E1.publicKey, E2.publicKey], tokB(RA))], [E1]), 'settle before reveal');
    await send([prog.revealRound(host.publicKey, RA.id, RA.seed)], [host]);
    await rejects(send([prog.settle(RA.id, treasury.publicKey, [E1.publicKey, E2.publicKey], tokB(RA))], [E1]), 'settle before end');
    await rejects(send([prog.closeCard(RA.id, E1.publicKey)], [E1]), 'close before settle');
    await rejects(send([prog.revealRound(host.publicKey, RA.id, crypto.randomBytes(32))], [host]), 'seed not matching the commitment');
  });
  await step('adversarial: join and guess after the end are refused on-chain', async () => {
    const r = readRound((await conn.getAccountInfo(prog.at.round(RA.id))).data);
    while (Date.now() / 1000 < r.endsAt + 2) await sleep(1000);
    const [E3] = await fresh(1);
    await rejects(send([joinIx(RA, E3, (await seatOf(RA, E3)).seal)], [E3, host]), 'join after end');
    await rejects(send([await guessIx(RA, E1, s1, s1.word)], [E1]), 'guess after end');
  });
  await step('adversarial: settle with a wrong mint or a token account of another mint is refused; second settle refused', async () => {
    const other = await splt.createMint(conn, host, host.publicKey, null, 6, { proof: true });
    await rejects(send([prog.settle(RA.id, treasury.publicKey, [E1.publicKey, E2.publicKey], { ...tokB(RA), mint: other })], [E1]), 'wrong mint');
    const oa = await splt.getOrCreateAssociatedTokenAccount(conn, host, other, E1.publicKey);
    await rejects(send([prog.settle(RA.id, treasury.publicKey, [E1.publicKey, E2.publicKey], { ...tokB(RA), dest: (k) => (k.toBase58?.() || String(k)) === E1.publicKey.toBase58() ? oa.address : ataOf(E2) })], [E1]), 'wrong token account');
    const b0 = await tokBal(ataOf(E1));
    await send([prog.settle(RA.id, treasury.publicKey, [E1.publicKey, E2.publicKey], tokB(RA))], [E1]);    // no solver -> refunds
    assert.equal((await tokBal(ataOf(E1))) - b0, 850e6, 'refund = 85% of entry');
    await rejects(send([prog.settle(RA.id, treasury.publicKey, [E1.publicKey, E2.publicKey], tokB(RA))], [E1]), 'settle twice');
    await rejects(send([prog.closeCard(RA.id, E2.publicKey)].map((ix) => { ix.keys[0].pubkey = E1.publicKey; return ix; }), [E1]), 'close card to the wrong player');
    const before = await conn.getBalance(E2.publicKey);
    await send([prog.closeCard(RA.id, E2.publicKey)], [E1]);
    assert.equal((await conn.getBalance(E2.publicKey)) - before, await conn.getMinimumBalanceForRentExemption(175), 'card rent back');
  });
  await step('adversarial: not enough $PROOF — server explains, program refuses', async () => {
    const [poor] = await fresh(1, 0);
    const { id } = await api('/api/test/round', { secs: 120, cap: 4 });
    await assert.rejects(api(`/api/rounds/${id}/join`, { wallet: poor.publicKey.toBase58() }), /you need/);
    const R = await direct({ cap: 4, secs: 60 });
    await rejects(send([joinIx(R, poor, (await seatOf(R, poor)).seal)], [poor, host]), 'join with 0 tokens');
  });
  let tieR, tieP;
  await step('ties: same guesses and same own time — the earlier seat takes first place', async () => {
    const [T1, T2] = await fresh(2);
    const R = tieR = await direct({ cap: 2, secs: 120 }); tieP = [T1, T2];
    const a = await seatOf(R, T1), b = await seatOf(R, T2);
    await send([joinIx(R, T1, a.seal), joinIx(R, T2, b.seal)], [T1, T2, host]);
    await send([await guessIx(R, T1, a, a.word), await guessIx(R, T2, b, b.word)], [T1, T2]);
    const cs = (await conn.getMultipleAccountsInfo([T1, T2].map((k) => prog.at.card(prog.at.round(R.id), k.publicKey)))).map((x) => readCard(x.data));
    assert.equal(cs[0].rows, cs[1].rows);
    await send([prog.revealRound(host.publicKey, R.id, R.seed)], [host]);
    const b0 = await Promise.all([T1, T2].map((k) => tokBal(ataOf(k))));
    await send([prog.settle(R.id, treasury.publicKey, [T1.publicKey, T2.publicKey], tokB(R))], [T1]);   // full + done: early settle
    const d = (await Promise.all([T1, T2].map((k) => tokBal(ataOf(k))))).map((x, i) => x - b0[i]);
    assert.deepEqual(d, [1700e6, 0], 'k = ceil(30% of 2) = 1 winner, earlier seat');
  });
  await step('duel timeout: nobody accepted → creator refunded in full, no fee (even after solving)', async () => {
    const [C] = await fresh(1, 0);
    const R = await direct({ kind: 1, entryRaw: 0.05e9, cap: 2, secs: 6 });
    const c = await seatOf(R, C);
    await send([joinIx(R, C, c.seal, 1)], [C, host]);
    await send([await guessIx(R, C, c, c.word)], [C]);
    const r = readRound((await conn.getAccountInfo(prog.at.round(R.id))).data);
    while (Date.now() / 1000 < r.endsAt + 2) await sleep(1000);
    await send([prog.revealRound(host.publicKey, R.id, R.seed)], [host]);
    const t0 = await conn.getBalance(treasury.publicKey), b0 = await conn.getBalance(C.publicKey);
    await send([prog.settle(R.id, treasury.publicKey, [C.publicKey])], [host]);
    assert.equal((await conn.getBalance(C.publicKey)) - b0, 0.05e9, 'full stake back');
    assert.equal(await conn.getBalance(treasury.publicKey), t0, 'no fee on a refund');
  });
  await step('duel: both sides fail → both stakes refunded, no fee', async () => {
    const [C, D] = await fresh(2, 0);
    const R = await direct({ kind: 1, entryRaw: 0.02e9, cap: 2, secs: 120 });
    const c = await seatOf(R, C), d = await seatOf(R, D);
    await send([joinIx(R, C, c.seal, 1), joinIx(R, D, d.seal, 1)], [C, D, host]);
    const misses = ['crane', 'pious', 'lymph', 'dough', 'fjord', 'swamp', 'blitz'];
    for (const [k, s] of [[C, c], [D, d]]) for (const g of misses.filter((x) => x !== s.word).slice(0, 6)) await send([await guessIx(R, k, s, g)], [k]);
    await send([prog.revealRound(host.publicKey, R.id, R.seed)], [host]);
    const b0 = await Promise.all([C, D].map((k) => conn.getBalance(k.publicKey)));
    await send([prog.settle(R.id, treasury.publicKey, [C.publicKey, D.publicKey])], [host]);
    const d1 = (await Promise.all([C, D].map((k) => conn.getBalance(k.publicKey)))).map((x, i) => x - b0[i]);
    assert.deepEqual(d1, [0.02e9, 0.02e9]);
  });

  await step('close_round: refused before settle, with an open card, to the wrong recipient, or with a non-empty escrow', async () => {
    const R = await direct({ cap: 4, secs: 60 });
    await rejects(send([prog.closeRound(R.id, host.publicKey, { vault: R.vault, program: TPX })], [E1]), 'close before settle');
    // RA is settled; E1's card is still open
    await rejects(send([prog.closeRound(RA.id, host.publicKey, { vault: RA.vault, program: TPX })], [E1]), 'card still open');
    // tie round: settled, close both cards, then someone drops a token in the escrow
    for (const k of tieP) await send([prog.closeCard(tieR.id, k.publicKey)], [E1]);
    await splt.transfer(conn, host, ataOf(tieP[1]), tieR.vault, tieP[1], 1);
    await rejects(send([prog.closeRound(tieR.id, host.publicKey, { vault: tieR.vault, program: TPX })], [E1]), 'escrow not empty');
  });
  await step('close_round: after settle + all cards closed, escrow and round rent go back to the host', async () => {
    await send([prog.closeCard(RA.id, E1.publicKey)], [E2]);
    assert.equal(readRound((await conn.getAccountInfo(prog.at.round(RA.id))).data).closedCards, 2);
    await rejects(send([prog.closeRound(RA.id, E1.publicKey, { vault: RA.vault, program: TPX })], [E1]), 'wrong recipient');
    const rent = (await conn.getAccountInfo(prog.at.round(RA.id))).lamports + (await conn.getAccountInfo(RA.vault)).lamports;
    const h0 = await conn.getBalance(host.publicKey);
    await send([prog.closeRound(RA.id, host.publicKey, { vault: RA.vault, program: TPX })], [E1]);   // anyone may call
    assert.equal((await conn.getBalance(host.publicKey)) - h0, rent, 'host gets round + escrow rent back');
    assert.equal(await conn.getAccountInfo(prog.at.round(RA.id)), null); assert.equal(await conn.getAccountInfo(RA.vault), null);
    console.log(`    reclaimed ${rent / 1e9} SOL per bounty round`);
  });
  await step('close_round: the server closes cards and the round by itself after settle (bounty + duel)', async () => {
    const r = await api(`/api/rounds/${rid}`);
    assert.equal(await conn.getAccountInfo(prog.at.round(rid)), null, 'bounty round closed');
    assert.equal(await conn.getAccountInfo(vault), null, 'bounty escrow closed');
    assert.equal(await conn.getAccountInfo(prog.at.round(duelId)), null, 'duel round closed, rent to its creator');
    assert.ok(r.seed && r.settled);
  });
  await step('server restart mid-round: encrypted state survives, the seat keeps playing', async () => {
    const [W] = await fresh(1);
    const { id } = await api('/api/test/round', { secs: 300, cap: 4 });
    const { tx } = await api(`/api/rounds/${id}/join`, { wallet: W.publicKey.toBase58() }); await signAndSend(tx, W);
    await api(`/api/rounds/${id}/seated`, { wallet: W.publicKey.toBase58() });
    const w1 = await api(`/api/test/seat/${id}/${W.publicKey.toBase58()}`);
    await new Promise((res) => { srv.once('exit', res); srv.kill('SIGTERM'); });
    assert.ok(fs.readFileSync(env.ZK_DB, 'utf8').startsWith('zkv1:'));
    await boot();
    assert.equal((await api(`/api/rounds/${id}`)).players, 1);
    assert.equal(await api(`/api/test/seat/${id}/${W.publicKey.toBase58()}`), w1, 'same sealed word after restart');
    const r = await api(`/api/rounds/${id}/guess`, { wallet: W.publicKey.toBase58(), guess: w1 });
    const raw = Buffer.from(r.payload, 'base64');
    await send([prog.guess(W.publicKey, r.board, { letters: raw.subarray(0, 5), clue: raw.subarray(5, 10), proof: raw.subarray(10) })], [W]);
    // the wrong key must not open it
    const bad = spawn('node', [path.join(ROOT, 'server.js')], { env: { ...env, PORT: String(PORT + 7), ZK_SECRET_KEY: crypto.randomBytes(32).toString('hex') }, stdio: 'ignore' });
    const code = await new Promise((res) => { bad.once('exit', res); setTimeout(() => { bad.kill(); res('alive'); }, 8000); });
    assert.notEqual(code, 'alive', 'server must refuse a state file it cannot decrypt');
  });
  await step('security: pot cap refuses seats past ZK_MAX_POT_SOL_EQUIV', async () => {
    const r = await api('/api/test/round', { secs: 120, cap: 4, maxPotSol: 0.005 });
    await rejects(api(`/api/rounds/${r.id}/join`, { wallet: players[2].publicKey.toBase58() }), 'over the pot cap');
  });
  await step('host rotation: set_admin needs both keys, then the config points at the new host', async () => {
    const H2 = web3.Keypair.generate();
    await conn.confirmTransaction(await conn.requestAirdrop(H2.publicKey, 1e9), 'confirmed');
    const admin = async () => new web3.PublicKey((await conn.getAccountInfo(prog.at.config())).data.subarray(1, 33)).toBase58();
    await rejects(send([prog.setAdmin(players[4].publicKey, H2.publicKey)], [players[4], H2]), 'rotate by a stranger');
    const half = prog.setAdmin(host.publicKey, H2.publicKey); half.keys[1].isSigner = false;
    await rejects(send([half], [host]), 'new key did not sign');
    await send([prog.setAdmin(host.publicKey, H2.publicKey)], [host, H2]);
    assert.equal(await admin(), H2.publicKey.toBase58());
    await rejects(send([prog.openDay(host.publicKey, 99999, Buffer.alloc(32, 1))], [host]), 'old host refused');
    await send([prog.setAdmin(H2.publicKey, host.publicKey)], [H2, host]);
    assert.equal(await admin(), host.publicKey.toBase58());
  });

  fs.writeFileSync(path.join(ROOT, 'docs', 'e2e-results.txt'), results.map((r) => `${r[0]}  ${r[1]}  (${r[2]} ms)`).join('\n') + '\n');
  console.log(`\n${results.filter((r) => r[0] === 'PASS').length}/${results.length} passed`);
}

main().then(() => process.exitCode = 0, (e) => { console.error(e); process.exitCode = 1; }).finally(() => {
  kids.forEach((k) => k.kill('SIGINT'));
  setTimeout(() => { fs.rmSync(tmp, { recursive: true, force: true }); process.exit(); }, 800);
});
