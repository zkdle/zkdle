// Local playground: fresh validator + program + configured server on :5290 (test network only).
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const web3 = require('@solana/web3.js');
const { client } = require('../lib/sdk');
const splt = require('@solana/spl-token');

const ROOT = path.join(__dirname, '..');
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zkdle-local-'));
  const programKp = web3.Keypair.generate(), host = web3.Keypair.generate(), treasury = web3.Keypair.generate();
  const pid = programKp.publicKey.toBase58();
  const v = spawn('solana-test-validator', ['--reset', '--quiet', '--ledger', path.join(tmp, 'ledger'), '--bpf-program', pid, path.join(ROOT, 'program/target/deploy/zkdle.so')], { stdio: 'ignore' });
  const conn = new web3.Connection('http://127.0.0.1:8899', 'confirmed');
  for (let i = 0; i < 60; i++) { try { await conn.getSlot(); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }
  await conn.confirmTransaction(await conn.requestAirdrop(host.publicKey, 50e9), 'confirmed');
  await web3.sendAndConfirmTransaction(conn, new web3.Transaction().add(client(pid).setup(host.publicKey, treasury.publicKey, 500)), [host]);
  // mock $PROOF (6 decimals) and a mock pool priced at 0.000005 SOL per token, so bounty rounds run locally
  const mint = await splt.createMint(conn, host, host.publicKey, null, 6);
  const wsol = await splt.createMint(conn, host, host.publicKey, null, 9);
  const pool = web3.Keypair.generate();
  const pt = await splt.createAccount(conn, host, mint, pool.publicKey, web3.Keypair.generate());
  const ps = await splt.createAccount(conn, host, wsol, pool.publicKey, web3.Keypair.generate());
  await splt.mintTo(conn, host, mint, pt, host, 1_000_000e6); await splt.mintTo(conn, host, wsol, ps, host, 5e9);
  const env = { ...process.env, ZK_PREVIEW: '0', ZK_TOKEN_MINT: mint.toBase58(), ZK_PRICE_POOL_VAULTS: `${pt.toBase58()},${ps.toBase58()}`, ZK_PRICE_SAMPLE_SECS: '2', ZK_PRICE_MIN_SAMPLES: '1', ZK_TEST: '1', ZK_CLUSTER: 'localnet', ZK_PROGRAM_ID: pid, ZK_HOST_KEY: JSON.stringify([...host.secretKey]), ZK_TREASURY: treasury.publicKey.toBase58(), ZK_DB: path.join(tmp, 'db.json'), ZK_NETWORK_LABEL: 'Local test network' };
  const s = spawn('node', [path.join(ROOT, 'server.js')], { env, stdio: 'inherit' });
  const stop = () => { s.kill(); v.kill(); process.exit(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})();
