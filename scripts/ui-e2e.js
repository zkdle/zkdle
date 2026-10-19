// Browser run on a throwaway validator: Daily, Bounty and Duel through the real /play UI with a mock wallet.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const web3 = require('@solana/web3.js');
const splt = require('@solana/spl-token');
const crypto = require('crypto');
const edKey = (kp) => crypto.createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(kp.secretKey.slice(0, 32))]), format: 'der', type: 'pkcs8' });
const puppeteer = require('puppeteer-core');
const { client, readCard } = require('../lib/sdk');

const ROOT = path.join(__dirname, '..');
const RPC_PORT = 8959, PORT = 5397, RPC = `http://127.0.0.1:${RPC_PORT}`, API = `http://127.0.0.1:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zkdle-ui-'));
const kids = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const step = async (name, fn) => {
  const t = Date.now();
  try { await fn(); results.push(['PASS', name, Date.now() - t]); console.log('  ✓', name); }
  catch (e) { results.push(['FAIL', name, Date.now() - t]); console.log('  ✗', name, '\n   ', e.message); throw e; }
};

async function main() {
  const programKp = web3.Keypair.generate(), host = web3.Keypair.generate(), treasury = web3.Keypair.generate();
  const pid = programKp.publicKey.toBase58();
  kids.push(spawn('solana-test-validator', ['--reset', '--quiet', '--ledger', path.join(tmp, 'ledger'), '--rpc-port', String(RPC_PORT), '--faucet-port', String(RPC_PORT + 2), '--gossip-port', String(RPC_PORT + 3), '--dynamic-port-range', `${RPC_PORT + 100}-${RPC_PORT + 160}`, '--bpf-program', pid, path.join(ROOT, 'program/target/deploy/zkdle.so')], { stdio: 'ignore' }));
  const conn = new web3.Connection(RPC, 'confirmed');
  for (let i = 0; i < 60; i++) { try { await conn.getSlot(); break; } catch { await sleep(500); } }
  const A = web3.Keypair.generate(), B = web3.Keypair.generate();
  for (const k of [host, A, B]) await conn.confirmTransaction(await conn.requestAirdrop(k.publicKey, 20e9), 'confirmed');
  const prog = client(pid);
  await web3.sendAndConfirmTransaction(conn, new web3.Transaction().add(prog.setup(host.publicKey, treasury.publicKey, 500)), [host]);
  const mint = await splt.createMint(conn, host, host.publicKey, null, 6);
  for (const k of [A, B]) { const a = await splt.getOrCreateAssociatedTokenAccount(conn, host, mint, k.publicKey); await splt.mintTo(conn, host, mint, a.address, host, 100_000e6); }
  const wsol = await splt.createMint(conn, host, host.publicKey, null, 9), pool = web3.Keypair.generate();
  const pt = await splt.createAccount(conn, host, mint, pool.publicKey, web3.Keypair.generate()), ps = await splt.createAccount(conn, host, wsol, pool.publicKey, web3.Keypair.generate());
  await splt.mintTo(conn, host, mint, pt, host, 1_000_000e6); await splt.mintTo(conn, host, wsol, ps, host, 5e9);
  const env = { ...process.env, ZK_PREVIEW: '0', ZK_TEST: '1', ZK_CLUSTER: 'localnet', ZK_RPC: RPC, ZK_PROGRAM_ID: pid, PORT: String(PORT), ZK_TOKEN_MINT: mint.toBase58(), ZK_PRICE_POOL_VAULTS: `${pt.toBase58()},${ps.toBase58()}`, ZK_PRICE_MIN_SAMPLES: '1',
    ZK_HOST_KEY: JSON.stringify([...host.secretKey]), ZK_TREASURY: treasury.publicKey.toBase58(), ZK_DB: path.join(tmp, 'db.json'), ZK_SECRET_KEY: crypto.randomBytes(32).toString('hex') };
  kids.push(spawn('node', [path.join(ROOT, 'server.js')], { env, stdio: ['ignore', 'ignore', 'inherit'] }));
  for (let i = 0; i < 40; i++) { try { await fetch(API + '/api/config'); break; } catch { await sleep(250); } }
  const api = async (p, body) => { const r = await fetch(API + p, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; };
  await api('/api/test/tick', {});

  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  // Mock wallet: the page sees a Phantom-like provider; signing happens in node with the test keypair.
  const pageFor = async (kp) => {
    const p = await br.newPage();
    await p.setViewport({ width: 1280, height: 900 });
    p.on('dialog', (d) => d.accept());
    if (process.env.UI_DEBUG) p.on('console', (m) => console.log('    console:', m.text()));
    p.on('requestfailed', (r) => process.env.UI_DEBUG && console.log('    reqfail', r.url()));
    p.on('pageerror', (e) => console.log('    page error:', e.message));
    await p.exposeFunction('__zkSign', (b64) => crypto.sign(null, Buffer.from(b64, 'base64'), edKey(kp)).toString('base64'));
    await p.evaluateOnNewDocument((pk) => {
      const signOne = async (tx) => {
        console.log('mock sign', tx.signatures.map((x) => x.publicKey.toBase58()).join(','));
        const msg = tx.serializeMessage();
        const sig = await window.__zkSign(btoa(String.fromCharCode(...msg)));
        const slot = tx.signatures.find((s) => s.publicKey.toBase58() === pk);
        tx.addSignature(slot.publicKey, Uint8Array.from(atob(sig), (c) => c.charCodeAt(0)));
        return tx;
      };
      const publicKey = { toBase58: () => pk, toString: () => pk };
      window.solana = window.phantom = undefined;
      window.phantom = { solana: { isPhantom: true, publicKey, connect: async () => ({ publicKey }), signTransaction: signOne, signAllTransactions: async (txs) => { for (const t of txs) await signOne(t); return txs; } } };
    }, kp.publicKey.toBase58());
    return p;
  };
  const typeWord = async (p, w) => { for (const ch of w) await p.keyboard.press(ch); await p.keyboard.press('Enter'); };
  const waitRows = async (p, n, sel = '.pi.ok') => p.waitForFunction((s, n) => document.querySelectorAll(s).length >= n, { timeout: 120000 }, sel, n);
  const card = async (board, k) => readCard((await conn.getAccountInfo(prog.at.card(new web3.PublicKey(board), k.publicKey))).data);

  await step('ui · Daily: type a miss + the word, both rows show "ZK verified", then seal the run on-chain', async () => {
    const p = await pageFor(A);
    await p.goto(API + '/play', { waitUntil: 'networkidle0' });
    const word = await api('/api/test/today');
    await typeWord(p, word === 'crane' ? 'pious' : 'crane'); await waitRows(p, 1);
    await typeWord(p, word); await waitRows(p, 2);
    assert.equal(await p.$eval('.pi.ok', (e) => e.textContent), 'ZK verified');
    await p.waitForSelector('#sealrun', { timeout: 20000 });
    await sleep(800);
    await p.$eval('#sealrun', (b) => b.click());
    await p.waitForFunction(() => document.querySelector('#toast')?.textContent, { timeout: 60000 });
    const msg = await p.$eval('#toast', (e) => e.textContent);
    assert.ok(msg.startsWith('✓'), 'seal run: ' + msg);
    const d = await api('/api/daily');
    for (let i = 0; i < 180; i++) { const c = await conn.getAccountInfo(prog.at.card(new web3.PublicKey(d.board), A.publicKey)); if (c && readCard(c.data).rows === 2) break; await sleep(500); }
    await sleep(1500);
    const c = await card(d.board, A);
    assert.equal(c.rows, 2); assert.equal(c.solved, true);
    await p.screenshot({ path: path.join(ROOT, 'docs/ui-run-daily.png') });
    await p.close();
  });

  await step('ui · Bounty: join through the page (burn/fee/escrow), solve in two, card on-chain', async () => {
    const { id } = await api('/api/test/round', { secs: 600, cap: 4, entry: String(1000e6) });
    const p = await pageFor(A);
    await p.goto(API + `/round/${id}`, { waitUntil: 'networkidle0' });
    await p.waitForSelector('#join', { timeout: 20000 });
    await p.$eval('#join', (b) => b.click());
    await p.waitForFunction(() => /sealed|in\./i.test(document.querySelector('#status')?.textContent || ''), { timeout: 60000 });
    const w = await api(`/api/test/seat/${id}/${A.publicKey.toBase58()}`);
    await typeWord(p, w === 'crane' ? 'pious' : 'crane'); await waitRows(p, 1, '.pi.ok, .pi.wait');
    await sleep(3000);
    await typeWord(p, w);
    const board = prog.at.round(id);
    for (let i = 0; i < 120; i++) { const c = await card(board, A).catch(() => null); if (c?.solved) break; await sleep(500); }
    const c = await card(board, A);
    assert.equal(c.rows, 2); assert.equal(c.solved, true);
    await p.screenshot({ path: path.join(ROOT, 'docs/ui-run-bounty.png') });
    await p.close();
  });

  await step('ui · Duel: A creates a 0.05 SOL duel in the page, B takes it from the link, both play, winner paid', async () => {
    const pa = await pageFor(A);
    await pa.goto(API + '/duel', { waitUntil: 'networkidle0' });
    await pa.waitForSelector('#mk');
    await pa.$eval('#mk', (b) => b.click());
    await pa.waitForFunction(() => /^\/duel\/\d+/.test(location.pathname), { timeout: 60000 });
    const id = Number((await pa.evaluate(() => location.pathname)).split('/')[2]);
    const pb = await pageFor(B);
    await pb.goto(API + `/duel/${id}`, { waitUntil: 'networkidle0' });
    await pb.waitForSelector('#join', { timeout: 20000 });
    await pb.$eval('#join', (b) => b.click());
    await pb.waitForFunction(() => /sealed|in\./i.test(document.querySelector('#status')?.textContent || ''), { timeout: 60000 });
    await pa.reload({ waitUntil: 'networkidle0' });
    await pa.waitForFunction(() => /sealed|in\./i.test(document.querySelector('#status')?.textContent || ''), { timeout: 30000 });
    const wa = await api(`/api/test/seat/${id}/${A.publicKey.toBase58()}`), wb = await api(`/api/test/seat/${id}/${B.publicKey.toBase58()}`);
    await typeWord(pb, wb);
    await typeWord(pa, wa === 'crane' ? 'pious' : 'crane'); await sleep(4000); await typeWord(pa, wa);
    const board = prog.at.round(id);
    for (let i = 0; i < 120; i++) { const [x, y] = await Promise.all([card(board, A).catch(() => null), card(board, B).catch(() => null)]); if (x?.solved && y?.solved) break; await sleep(500); }
    const cs = await Promise.all([card(board, A).catch(() => null), card(board, B).catch(() => null)]);
    assert.ok(cs[0]?.solved && cs[1]?.solved, 'boards: ' + JSON.stringify(cs.map((c) => c && { rows: c.rows, solved: c.solved })) + ' toastA=' + await pa.$eval('#toast', (e) => e.textContent) + ' toastB=' + await pb.$eval('#toast', (e) => e.textContent));
    const b0 = await conn.getBalance(B.publicKey);
    const res = await api(`/api/test/settle/${id}`, {});
    assert.ok(res.settled);
    await sleep(1500);
    assert.ok((await conn.getBalance(B.publicKey)) - b0 >= 0.095e9, 'B (1 guess) wins both stakes minus 5%');
    await pb.reload({ waitUntil: 'networkidle0' });
    await pb.screenshot({ path: path.join(ROOT, 'docs/ui-run-duel.png') });
  });
  await step('ui · Bounty info: seats left, pot ≈ SOL, and a full round says "Round full · next round opens in …"', async () => {
    const { id } = await api('/api/test/round', { secs: 600, cap: 2 });
    const C = web3.Keypair.generate();
    const p = await pageFor(C);
    for (const k of [A]) { const { tx } = await api(`/api/rounds/${id}/join`, { wallet: k.publicKey.toBase58() }); const t = web3.Transaction.from(Buffer.from(tx, 'base64')); t.partialSign(k); await conn.confirmTransaction(await conn.sendRawTransaction(t.serialize()), 'confirmed'); await api(`/api/rounds/${id}/seated`, { wallet: k.publicKey.toBase58() }); }
    await p.goto(API + `/round/${id}`, { waitUntil: 'networkidle0' });
    const info = await p.$eval('#info', (e) => e.textContent);
    assert.match(info, /1 seat left/); assert.match(info, /≈ 0\.\d{3} SOL/);
    for (const k of [B]) { const { tx } = await api(`/api/rounds/${id}/join`, { wallet: k.publicKey.toBase58() }); const t = web3.Transaction.from(Buffer.from(tx, 'base64')); t.partialSign(k); await conn.confirmTransaction(await conn.sendRawTransaction(t.serialize()), 'confirmed'); await api(`/api/rounds/${id}/seated`, { wallet: k.publicKey.toBase58() }); }
    await p.reload({ waitUntil: 'networkidle0' });
    await sleep(1200);
    const status = await p.$eval('#status', (e) => e.textContent);
    assert.match(status, /Round full · next round opens in \d\d:\d\d:\d\d/, status);
    assert.match(await p.$eval('#info', (e) => e.textContent), /0 seats left/);
    await p.screenshot({ path: path.join(ROOT, 'docs/ui-run-bounty-full.png') });
  });
  await step('ui · No $PROOF mint: bounty + streak repair show "Opens when $PROOF launches", no join button; switches on with the mint', async () => {
    const P2 = PORT + 7, A2 = `http://127.0.0.1:${P2}`;
    const env2 = { ...env, PORT: String(P2), ZK_DB: path.join(tmp, 'db-nomint.json') }; delete env2.ZK_TOKEN_MINT; delete env2.ZK_PRICE_POOL_VAULTS;
    const k2 = spawn('node', [path.join(ROOT, 'server.js')], { env: env2, stdio: ['ignore', 'ignore', 'inherit'] }); kids.push(k2);
    for (let i = 0; i < 40; i++) { try { await fetch(A2 + '/api/config'); break; } catch { await sleep(250); } }
    const p = await pageFor(web3.Keypair.generate());
    const vis = (sel) => p.$$eval(sel, (es) => es.filter((e) => e.offsetParent !== null).map((e) => e.textContent.trim()));
    await p.goto(A2 + '/', { waitUntil: 'networkidle0' });
    assert.deepStrictEqual(await vis('.mode [data-pending="bounty"]'), ['Opens when $PROOF launches']);
    assert.strictEqual((await vis('[data-t="modes.bounty.tag"]')).length, 0);
    await p.goto(A2 + '/round', { waitUntil: 'networkidle0' });
    const info = await p.$eval('#info', (e) => e.textContent);
    assert.match(info, /Opens when \$PROOF launches/); assert.match(info, /Bounty rounds open once \$PROOF is live/);
    assert.strictEqual(await p.$('#join'), null); assert.strictEqual(await p.$('#mend'), null);
    await p.goto(A2 + '/docs', { waitUntil: 'networkidle0' });
    assert.ok((await vis('#bounty [data-pending="bounty"]')).length === 1);
    assert.ok((await vis('.when-no-token')).some((t) => /Available after \$PROOF launches/.test(t)));
    k2.kill('SIGINT');
    // with the mint set (main server) the gate is gone
    await p.goto(API + '/', { waitUntil: 'networkidle0' });
    assert.strictEqual((await vis('.mode [data-pending="bounty"]')).length, 0);
    assert.strictEqual((await vis('[data-t="modes.bounty.tag"]')).length, 1);
    await p.goto(API + '/docs', { waitUntil: 'networkidle0' });
    assert.strictEqual((await vis('.when-no-token')).length, 0);
  });
  await br.close();
  fs.writeFileSync(path.join(ROOT, 'docs', 'ui-e2e-results.txt'), results.map((r) => `${r[0]}  ${r[1]}  (${r[2]} ms)`).join('\n') + '\n');
  console.log(`\n${results.filter((r) => r[0] === 'PASS').length}/${results.length} passed`);
}
main().then(() => (process.exitCode = 0), (e) => { console.error(e); process.exitCode = 1; }).finally(() => { kids.forEach((k) => k.kill('SIGINT')); setTimeout(() => { fs.rmSync(tmp, { recursive: true, force: true }); process.exit(); }, 800); });
