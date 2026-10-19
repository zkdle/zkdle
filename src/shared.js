// Bits both pages need: config, language toggle, links, the music hook.
import { applyCopy } from './i18n.js';

export const palette = ['c0', 'c1', 'c2'];

export function clueOf(answer, guess) {
  const out = [0, 0, 0, 0, 0], used = [...answer].map((ch, i) => ch === guess[i]);
  [...guess].forEach((ch, i) => { if (ch === answer[i]) out[i] = 1; });
  [...guess].forEach((ch, i) => {
    if (out[i]) return;
    const j = [...answer].findIndex((x, k) => x === ch && !used[k]);
    if (j >= 0) { used[j] = true; out[i] = 2; }
  });
  return out;
}

let config = null;
export async function loadConfig() {
  if (config) return config;
  try { config = await (await fetch('/api/config')).json(); } catch { config = { links: {}, token: {} }; }
  // $PROOF-gated features (bounty, streak repair) show a waiting state until ZK_TOKEN_MINT is set; flips on automatically.
  document.documentElement.classList.toggle('has-token', !!config.token?.mint);
  document.documentElement.classList.toggle('no-token', !config.token?.mint);
  document.querySelectorAll('[data-link]').forEach((a) => { const url = config.links?.[a.dataset.link]; if (url) a.href = url; });
  return config;
}

export function setupCopy() { applyCopy(); }

// Music: a track can be dropped into /audio/theme.mp3 later. Browsers block autoplay,
// so it starts on the first tap/keypress if the visitor hasn't muted it before.
export function setupSound() {
  const btn = document.querySelector('.sound');
  const audio = new Audio();
  audio.loop = true; audio.volume = 0.35; audio.preload = 'none';
  audio.src = audio.canPlayType('audio/webm; codecs="opus"') ? '/audio/theme.webm' : '/audio/theme.mp3';
  let wanted = localStorage.getItem('zk.sound') !== 'off';
  const label = () => { if (btn) { btn.querySelector('i').textContent = audio.paused ? 'off' : 'on'; btn.classList.toggle('playing', !audio.paused); } };
  const start = (e) => {
    if (e?.target?.closest?.('.sound')) return;
    if (wanted && audio.paused) audio.play().then(label).catch(() => {});
  };
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, start, { once: true, passive: true }));
  btn?.addEventListener('click', () => {
    if (audio.paused) { wanted = true; audio.play().then(label).catch(() => {}); } else { wanted = false; audio.pause(); label(); }
    localStorage.setItem('zk.sound', wanted ? 'on' : 'off');
  });
  label();
}

export const short = (s) => (s ? `${s.slice(0, 4)}…${s.slice(-4)}` : '');
export const solscan = (addr, cluster) => `https://solscan.io/account/${addr}${cluster && cluster !== 'mainnet' ? `?cluster=${cluster === 'localnet' ? 'custom' : cluster}` : ''}`;
