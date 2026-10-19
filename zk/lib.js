// Shared helpers for sealing words and shaping proofs for the chain.
const path = require('path');
const crypto = require('crypto');
const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');


let poseidon;
async function hasher() { return poseidon || (poseidon = await buildPoseidon()); }

const letters = (w) => [...w.toLowerCase()].map((c) => c.charCodeAt(0) - 97);
const pack = (w) => letters(w).reduce((acc, v, i) => acc + BigInt(v) * 32n ** BigInt(i), 0n);
const freshSalt = () => BigInt('0x' + crypto.randomBytes(30).toString('hex'));

async function seal(word, salt) {
  const h = await hasher();
  return h.F.toObject(h([pack(word), BigInt(salt)]));
}

function clueOf(word, guess) {
  const w = letters(word), g = letters(guess), out = [0, 0, 0, 0, 0], used = w.map((v, i) => v === g[i]);
  g.forEach((v, i) => { if (v === w[i]) out[i] = 1; });
  g.forEach((v, i) => {
    if (out[i]) return;
    const j = w.findIndex((x, k) => x === v && !used[k]);
    if (j >= 0) { used[j] = true; out[i] = 2; }
  });
  return out;
}

const ZK = path.join(__dirname);
// One proof costs ~1 CPU-second and a few hundred MB, and snarkjs worker threads stall on a single core,
// so proofs run single-threaded through a global queue (ZK_PROVE_CONCURRENCY, default 1). When more than
// ZK_PROVE_QUEUE_MAX (default 30) are waiting, new requests are turned away with BUSY (HTTP 429) and the client retries.
const CONC = Math.max(1, Number(process.env.ZK_PROVE_CONCURRENCY || 1));
const QMAX = Number(process.env.ZK_PROVE_QUEUE_MAX || 30);
let running = 0;
const waiting = [];
class Busy extends Error { constructor() { super('prover busy, retry shortly'); this.code = 'BUSY'; this.status = 429; } }
function slot() {
  if (running < CONC) { running++; return Promise.resolve(); }
  if (waiting.length >= QMAX) return Promise.reject(new Busy());
  return new Promise((res) => waiting.push(res));
}
function release() { const next = waiting.shift(); if (next) next(); else running--; }
const queueStats = () => ({ running, waiting: waiting.length, concurrency: CONC, max: QMAX });

async function prove(word, salt, guess, sealValue) {
  const input = { word: letters(word), salt: BigInt(salt).toString(), guess: letters(guess), seal: BigInt(sealValue).toString() };
  await slot();
  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, path.join(ZK, 'clue_js/clue.wasm'), path.join(ZK, 'clue.zkey'), undefined, undefined, { singleThread: true });
    return { proof, publicSignals, clue: publicSignals.slice(0, 5).map(Number) };
  } finally { release(); }
}

let vk;
async function check(proof, publicSignals) {
  vk = vk || require('./vk.json');
  return snarkjs.groth16.verify(vk, publicSignals, proof);
}

const be32 = (x) => Buffer.from(BigInt(x).toString(16).padStart(64, '0'), 'hex');
const Q = 21888242871839275222246405745257275088696311157297823662689037894645226208583n;

function chainProof(proof) {
  const a = Buffer.concat([be32(proof.pi_a[0]), be32((Q - BigInt(proof.pi_a[1])) % Q)]);
  const b = Buffer.concat([be32(proof.pi_b[0][1]), be32(proof.pi_b[0][0]), be32(proof.pi_b[1][1]), be32(proof.pi_b[1][0])]);
  const c = Buffer.concat([be32(proof.pi_c[0]), be32(proof.pi_c[1])]);
  return Buffer.concat([a, b, c]);
}

module.exports = { queueStats, Busy, letters, pack, freshSalt, seal, clueOf, prove, check, chainProof, be32 };
