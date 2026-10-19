// At-rest encryption for the server's state file (live answers, salts and round seeds live there until reveal).
// AES-256-GCM with ZK_SECRET_KEY (32 bytes, hex or base64). Production refuses to start without it.
const crypto = require('crypto');
const MAGIC = 'zkv1:';

function keyFrom(raw) {
  if (!raw) return null;
  const s = raw.trim();
  const k = /^[0-9a-f]{64}$/i.test(s) ? Buffer.from(s, 'hex') : Buffer.from(s, 'base64');
  if (k.length !== 32) throw new Error('ZK_SECRET_KEY must be 32 bytes (64 hex chars or base64)');
  return k;
}
function seal(key, obj) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return MAGIC + Buffer.concat([iv, c.getAuthTag(), body]).toString('base64');
}
function open(key, text) {
  if (!text.startsWith(MAGIC)) throw new Error('state file is not encrypted');
  const b = Buffer.from(text.slice(MAGIC.length), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'));
}
module.exports = { keyFrom, seal, open, MAGIC };
