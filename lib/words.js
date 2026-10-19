// Word lists and the deterministic seat-word derivation used by bounty rounds and duels.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const read = (f) => fs.readFileSync(path.join(__dirname, '../words', f), 'utf8').split('\n').map((w) => w.trim()).filter((w) => /^[a-z]{5}$/.test(w));
const answers = read('answers.txt');
const allowed = new Set(read('allowed.txt'));

const R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const h = (...parts) => crypto.createHash('sha256').update(Buffer.concat(parts.map((p) => Buffer.from(p)))).digest();

// Anyone holding the revealed seed can recompute every seat's word and salt.
function seatWord(seedHex, roundId, player) {
  const seed = Buffer.from(seedHex, 'hex');
  const pick = h(seed, `word:${roundId}:${player}`);
  const word = answers[Number(BigInt('0x' + pick.toString('hex')) % BigInt(answers.length))];
  const salt = BigInt('0x' + h(seed, `salt:${roundId}:${player}`).toString('hex')) % R;
  return { word, salt };
}

module.exports = { answers, allowed, seatWord, sha256: h };
