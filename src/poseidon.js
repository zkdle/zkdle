// Loaded only when someone checks a reveal: recompute poseidon(packed word, salt) in the browser.
import { poseidon2 } from 'poseidon-lite/poseidon2';
window.sealOf = async (word, salt) => {
  const packed = [...word].reduce((acc, ch, i) => acc + BigInt(ch.charCodeAt(0) - 97) * 32n ** BigInt(i), 0n);
  return poseidon2([packed, BigInt(salt)]).toString();
};
