// One real round of each mode on devnet against the deployed program. Keys come from DEVNET_KEYS (outside the repo);
// nothing secret is printed. Writes docs/devnet-run.md with explorer links and balances.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const web3 = require('@solana/web3.js');
const splt = require('@solana/spl-token');
const { client, readCard, readRound } = require('../lib/sdk');

const ROOT = path.join(__dirname, '..');
const K = process.env.DEVNET_KEYS; // directory with payer/host/treasury/program keypairs (never in the repo)
if (!K || !process.env.DEVNET_RPC) { console.error('set DEVNET_KEYS and DEVNET_RPC'); process.exit(1); }
const RPC = process.env.DEVNET_RPC;
const PORT = 5403, API = `http://127.0.0.1:${PORT}`;
const kp = (n) => web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(K, n + '.json')))));
const loadOrMake = (n) => { const f = path.join(K, n + '.json'); if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify([...web3.Keypair.generate().secretKey]), { mode: 0o600 }); return kp(n); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tx = (s) => `https://explorer.solana.com/tx/${s}?cluster=devnet`, acct = (a) => `https://explorer.solana.com/address/${a}?cluster=devnet`;
const out = [];
const log = (s) => { out.push(s); console.log(s); };

(async () => {
  const conn = new web3.Connection(RPC, 'confirmed');
  const payer = kp('payer'), host = kp('host'), treasury = kp('treasury'), program = kp('program');
  const A = loadOrMake('player-a'), B = loadOrMake('player-b');
  const pid = program.publicKey.toBase58(), prog = client(pid);
  const send = async (ixs, signers) => web3.sendAndConfirmTransaction(conn, new web3.Transaction().add(web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 600000 }), web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 2000 }), ...ixs), signers, { commitment: 'confirmed' });
  const fund = async (to, sol) => { const b = await conn.getBalance(to); if (b < sol * 1e9 * 0.8) await send([web3.SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: to, lamports: Math.round(sol * 1e9 - b) })], [payer]); };
  log(`# ZKdle devnet run\n\nRun at ${new Date().toISOString()} (UTC). Program: [${pid}](${acct(pid)})\n`);
  await fund(host.publicKey, 0.6); await fund(A.publicKey, 0.3); await fund(B.publicKey, 0.3); await fund(treasury.publicKey, 0.003);

  if (!(await conn.getAccountInfo(prog.at.config()))) log(`- config setup (treasury ${treasury.publicKey.toBase58().slice(0, 6)}…, fee 5%): [tx](${tx(await send([prog.setup(host.publicKey, treasury.publicKey, 500)], [host]))})`);
  // test $PROOF (6 decimals) + a mock pool so the TWAP prices the entry: 1,000,000 PROOF vs 5 "SOL" -> 0.000005 SOL/PROOF
  // DEVNET_TOKEN22=1: the $PROOF stand-in is a pump.fun-style Token-2022 mint (MetadataPointer + TokenMetadata)
  const T22 = process.env.DEVNET_TOKEN22 === '1', TP = T22 ? splt.TOKEN_2022_PROGRAM_ID : splt.TOKEN_PROGRAM_ID;
  const st = path.join(K, T22 ? 'devnet-state-t22.json' : 'devnet-state.json');
  let S = fs.existsSync(st) ? JSON.parse(fs.readFileSync(st)) : null;
  if (!S) {
    let mint;
    if (T22) {
      const meta = require('@solana/spl-token-metadata'), kpM = web3.Keypair.generate();
      const len = splt.getMintLen([splt.ExtensionType.MetadataPointer]);
      const full = len + splt.TYPE_SIZE + splt.LENGTH_SIZE + meta.pack({ mint: kpM.publicKey, name: 'ZKdle Proof', symbol: 'PROOF', uri: 'https://zkdle.fun/token.json', additionalMetadata: [] }).length;
      await send([web3.SystemProgram.createAccount({ fromPubkey: host.publicKey, newAccountPubkey: kpM.publicKey, space: len, lamports: await conn.getMinimumBalanceForRentExemption(full), programId: TP }),
        splt.createInitializeMetadataPointerInstruction(kpM.publicKey, host.publicKey, kpM.publicKey, TP), splt.createInitializeMintInstruction(kpM.publicKey, 6, host.publicKey, null, TP),
        meta.createInitializeInstruction({ programId: TP, metadata: kpM.publicKey, updateAuthority: host.publicKey, mint: kpM.publicKey, mintAuthority: host.publicKey, name: 'ZKdle Proof', symbol: 'PROOF', uri: 'https://zkdle.fun/token.json' })], [host, kpM]);
      mint = kpM.publicKey;
    } else mint = await splt.createMint(conn, host, host.publicKey, null, 6);
    const wsol = await splt.createMint(conn, host, host.publicKey, null, 9);
    const pool = web3.Keypair.generate();
    const pt = await splt.createAccount(conn, host, mint, pool.publicKey, web3.Keypair.generate(), undefined, TP);
    const ps = await splt.createAccount(conn, host, wsol, pool.publicKey, web3.Keypair.generate());
    await splt.mintTo(conn, host, mint, pt, host, 1_000_000e6, [], undefined, TP); await splt.mintTo(conn, host, wsol, ps, host, 5e9);
    for (const k of [A, B]) { const a = await splt.getOrCreateAssociatedTokenAccount(conn, host, mint, k.publicKey, false, undefined, undefined, TP); await splt.mintTo(conn, host, mint, a.address, host, 100_000e6, [], undefined, TP); }
    S = { mint: mint.toBase58(), pt: pt.toBase58(), ps: ps.toBase58() };
    fs.writeFileSync(st, JSON.stringify(S));
  }
  const mint = new web3.PublicKey(S.mint);
  log(`- test $PROOF mint (${T22 ? 'Token-2022 + metadata extensions, like pump.fun' : 'SPL Token'}): [${S.mint}](${acct(S.mint)}) · mock pool vaults ${S.pt.slice(0, 6)}… / ${S.ps.slice(0, 6)}… (0.000005 SOL per PROOF)\n`);

  const env = { ...process.env, ZK_PREVIEW: '0', ZK_TEST: '1', ZK_CLUSTER: 'devnet', ZK_RPC: RPC, ZK_PROGRAM_ID: pid, PORT: String(PORT), ZK_TOKEN_MINT: S.mint, ZK_PRICE_POOL_VAULTS: `${S.pt},${S.ps}`,
    ZK_PRICE_SAMPLE_SECS: '3600', ZK_PRICE_MIN_SAMPLES: '1', ZK_HOST_KEY: JSON.stringify([...host.secretKey]), ZK_TREASURY: treasury.publicKey.toBase58(), ZK_DB: path.join(K, 'devnet-db.json'),
    ZK_SECRET_KEY: (fs.existsSync(path.join(K, 'db.key')) ? fs.readFileSync(path.join(K, 'db.key'), 'utf8') : (fs.writeFileSync(path.join(K, 'db.key'), crypto.randomBytes(32).toString('hex'), { mode: 0o600 }), fs.readFileSync(path.join(K, 'db.key'), 'utf8'))), ZK_JOIN_CUTOFF_SECS: '10' };
  const srv = spawn('node', [path.join(ROOT, 'server.js')], { env, stdio: ['ignore', 'ignore', 'pipe'] });
  srv.stderr.on('data', (d) => process.stderr.write(String(d).replaceAll(RPC, '[rpc]')));
  try {
    for (let i = 0; i < 60; i++) { try { await fetch(API + '/api/config'); break; } catch { await sleep(500); } }
    const api = async (p, body) => { const r = await fetch(API + p, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(`${p}: ${j.error}`); return j; };
    const signSend = async (b64, k) => { const t = web3.Transaction.from(Buffer.from(b64, 'base64')); t.partialSign(k); const s = await conn.sendRawTransaction(t.serialize()); await conn.confirmTransaction(s, 'confirmed'); return s; };
    const play = async (round, k, misses, word) => {
      const sigs = [];
      for (const g of [...['crane', 'pious', 'lymph'].filter((x) => x !== word).slice(0, misses), word]) {
        const r = await api(round ? `/api/rounds/${round}/guess` : '/api/daily/guess', round ? { wallet: k.publicKey.toBase58(), guess: g } : { guess: g });
        const raw = Buffer.from(r.payload, 'base64');
        sigs.push(await send([prog.guess(k.publicKey, round ? r.board : (await api('/api/daily')).board, { letters: raw.subarray(0, 5), clue: raw.subarray(5, 10), proof: raw.subarray(10) })], [k]));
      }
      return sigs;
    };
    await api('/api/test/tick', {});

    // ---------------- Daily
    const daily = await api('/api/daily');
    const C = web3.Keypair.generate(); await fund(C.publicKey, 0.02);       // a fresh player for today's word
    const dsig = await play(0, C, 1, await api('/api/test/today'));
    const dc = readCard((await conn.getAccountInfo(prog.at.card(new web3.PublicKey(daily.board), C.publicKey))).data);
    log(`## Daily #${daily.day + 1}\n- day board [${daily.board}](${acct(daily.board)}); player sealed ${dc.rows} rows on-chain, solved=${dc.solved}: [miss](${tx(dsig[0])}) · [solve](${tx(dsig[1])})\n- streak PDA [${prog.at.streak(C.publicKey).toBase58()}](${acct(prog.at.streak(C.publicKey).toBase58())})\n`);

    // ---------------- Bounty
    await api('/api/test/price', {});
    const { id } = await api('/api/test/round', { secs: 600, cap: 2 });
    const pub = await api(`/api/rounds/${id}`);
    const ta = (k) => splt.getAssociatedTokenAddressSync(mint, k, true, TP);
    const bal = async (a) => { try { return Number((await splt.getAccount(conn, a, undefined, TP)).amount) / 1e6; } catch { return 0; } };
    const supply = async () => Number((await splt.getMint(conn, mint, undefined, TP)).supply) / 1e6;
    const vault = ta(prog.at.round(id)), tTa = ta(treasury.publicKey);
    const before = { A: await bal(ta(A.publicKey)), B: await bal(ta(B.publicKey)), T: await bal(tTa), supply: await supply() };
    const joins = [];
    for (const k of [A, B]) { const { tx: t } = await api(`/api/rounds/${id}/join`, { wallet: k.publicKey.toBase58() }); joins.push(await signSend(t, k)); await api(`/api/rounds/${id}/seated`, { wallet: k.publicKey.toBase58() }); }
    const mid = { A: await bal(ta(A.publicKey)), B: await bal(ta(B.publicKey)), T: await bal(tTa), V: await bal(vault), supply: await supply() };
    const e = Number(pub.entry) / 1e6;
    log(`## Bounty round ${id}\n- entry **${e.toLocaleString()} PROOF** ≈ ${(pub.refLamports / 1e9).toFixed(3)} SOL (TWAP, fixed at open), cap 2 · round [${pub.pda}](${acct(pub.pda)})`);
    log(`- joins: [A](${tx(joins[0])}) · [B](${tx(joins[1])}) (each: BurnChecked + 2× TransferChecked in one tx)`);
    log(`- after 2 joins: supply ${before.supply.toLocaleString()} → ${mid.supply.toLocaleString()} (**−${(before.supply - mid.supply).toLocaleString()}** = 2 × 10%), treasury ${before.T} → ${mid.T} (**+${mid.T - before.T}** = 2 × 5%), escrow **${mid.V.toLocaleString()}** (= 2 × 85%)`);
    const wa = await api(`/api/test/seat/${id}/${A.publicKey.toBase58()}`), wb = await api(`/api/test/seat/${id}/${B.publicKey.toBase58()}`);
    const pa = await play(id, A, 0, wa), pb = await play(id, B, 1, wb);
    const res = await api(`/api/test/settle/${id}`, {});
    await sleep(2000);
    const after = { A: await bal(ta(A.publicKey)), B: await bal(ta(B.publicKey)), T: await bal(tTa), V: await bal(vault) };
    const closed = !(await conn.getAccountInfo(prog.at.round(id))) && !(await conn.getAccountInfo(vault));
    log(`- play: A solved in 1 ([tx](${tx(pa[0])})), B in 2 ([tx](${tx(pb[1])})). Settle (full + all done → early): [tx](${tx(res.settleSig)})`);
    log(`- payout: k = ceil(30% × 2) = 1 → A gets the whole escrow: A ${mid.A.toLocaleString()} → ${after.A.toLocaleString()} (**+${(after.A - mid.A).toLocaleString()}**), B unchanged ${after.B.toLocaleString()}, escrow → ${after.V}`);
    log(`- net per wallet: A ${(after.A - before.A).toLocaleString()} PROOF, B ${(after.B - before.B).toLocaleString()} PROOF; cards closed + round & escrow closed (rent back): **${closed}**\n`);

    // ---------------- Duel
    const ab0 = await conn.getBalance(A.publicKey), bb0 = await conn.getBalance(B.publicKey), tb0 = await conn.getBalance(treasury.publicKey);
    const d = await api('/api/duels', { wallet: A.publicKey.toBase58(), stake: 0.05 });
    const dOpen = await signSend(d.tx, A); await api(`/api/duels/${d.id}/opened`, {});
    const { tx: jt } = await api(`/api/duels/${d.id}/join`, { wallet: B.publicKey.toBase58() });
    const dJoin = await signSend(jt, B); await api(`/api/rounds/${d.id}/seated`, { wallet: B.publicKey.toBase58() });
    await play(d.id, A, 2, await api(`/api/test/seat/${d.id}/${A.publicKey.toBase58()}`));
    await play(d.id, B, 0, await api(`/api/test/seat/${d.id}/${B.publicKey.toBase58()}`));
    const dr = await api(`/api/test/settle/${d.id}`, {});
    await sleep(2000);
    const ab1 = await conn.getBalance(A.publicKey), bb1 = await conn.getBalance(B.publicKey), tb1 = await conn.getBalance(treasury.publicKey);
    log(`## Duel ${d.id} (0.05 SOL each)\n- create: [tx](${tx(dOpen)}) · accept: [tx](${tx(dJoin)}) · settle/payout: [tx](${tx(dr.settleSig)})`);
    log(`- B solved in 1, A in 3 → B wins. Treasury +${((tb1 - tb0) / 1e9).toFixed(4)} SOL (5% of 0.1). B net ${((bb1 - bb0) / 1e9).toFixed(5)} SOL, A net ${((ab1 - ab0) / 1e9).toFixed(5)} SOL (incl. tx fees, card rent refunded, duel round rent back to A); duel round closed: **${!(await conn.getAccountInfo(prog.at.round(d.id)))}**`);
    fs.writeFileSync(path.join(ROOT, 'docs', T22 ? 'devnet-run-token2022.md' : 'devnet-run.md'), out.join('\n') + '\n');
  } finally { srv.kill(); }
})().catch((e) => { console.error(String(e.message || e).replaceAll(RPC, '[rpc]')); process.exitCode = 1; });
