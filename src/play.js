import './buffer-shim.js';
import { Connection, Transaction, PublicKey } from '@solana/web3.js';
import { gsap } from 'gsap';
import { client } from '../lib/sdk.js';
import { t } from './i18n.js';
import { loadConfig, setupCopy, setupSound, short, solscan } from './shared.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const api = async (p, body, tries = 0) => {
  const r = await fetch(p, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (r.status === 429 && tries < 6) { await new Promise((ok) => setTimeout(ok, 800 * 2 ** tries + Math.random() * 400)); return api(p, body, tries + 1); }
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'request failed');
  return j;
};
const toast = (msg, ms = 2500) => { const el = $('#toast'), b = $('#board')?.getBoundingClientRect(); el.textContent = msg; el.classList.toggle('near', !!(b && b.height)); if (b && b.height) el.style.top = Math.max(8, b.top - 10) + 'px'; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), ms); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let cfg, prog, conn, wallet = null;

// ------------------------------------------------------------ wallet
const provider = () => window.phantom?.solana || window.solflare || window.backpack || window.solana || null;
async function connect() {
  const p = provider();
  if (!p) { toast('Install a Solana wallet (Phantom, Solflare, Backpack)'); return null; }
  const r = await p.connect();
  wallet = (r?.publicKey || p.publicKey).toBase58();
  $('.wallet').textContent = short(wallet);
  $('.wallet').classList.add('on');
  refreshSide();
  return wallet;
}
async function confirm(sig) {
  for (let i = 0; i < 60; i++) {
    const s = (await conn.getSignatureStatuses([sig])).value[0];
    if (s?.err) throw new Error('transaction failed');
    if (s && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized')) return sig;
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error('not confirmed in time');
}
async function signSend(txs) {
  const p = provider();
  const signed = txs.length > 1 && p.signAllTransactions ? await p.signAllTransactions(txs) : [await p.signTransaction(txs[0])];
  const sigs = [];
  for (const tx of signed) sigs.push(await confirm(await conn.sendRawTransaction(tx.serialize())));
  return sigs;
}
const fromServer = (b64) => Transaction.from(Buffer.from(b64, 'base64'));
async function freshTx(...ixs) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = new PublicKey(wallet);
  tx.recentBlockhash = (await conn.getLatestBlockhash('confirmed')).blockhash;
  return tx;
}

// ------------------------------------------------------------ proofs in the browser
let snark = null, vk = null;
async function verifyInBrowser(proof, publicSignals) {
  if (!snark) {
    await new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/vendor/snarkjs.min.js'; s.onload = ok; s.onerror = no; document.head.append(s); });
    snark = window.snarkjs; vk = await (await fetch('/zk/vk.json')).json();
  }
  return snark.groth16.verify(vk, publicSignals, proof);
}
async function poseidonCheck(word, salt) {
  if (!window.sealOf) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/poseidon.js'; s.onload = ok; s.onerror = no; document.head.append(s); });
  return window.sealOf(word, salt);
}

// ------------------------------------------------------------ board + keyboard
const KEYS = ['qwertyuiop', 'asdfghjkl', '↵zxcvbnm⌫'];
let game = null; // { mode, rows:[{guess, clue, proof, publicSignals, payload, ok}], typed, done, busy, submit }

function drawBoard() {
  $('#board').innerHTML = Array.from({ length: 6 }, (_, r) => `<div class="row" data-r="${r}">${Array.from({ length: 5 }, () => '<div class="tile"><div class="card"><div class="f"></div><div class="k"></div></div></div>').join('')}<span class="pi"></span></div>`).join('');
  $('#keys').innerHTML = KEYS.map((row) => `<div class="krow">${[...row].map((k) => `<button class="key${k === '↵' || k === '⌫' ? ' wide' : ''}" data-k="${k}">${k === '↵' ? 'enter' : k}</button>`).join('')}</div>`).join('');
}
function paintRow(r, word, clue, instant) {
  const row = $(`.row[data-r="${r}"]`);
  const tiles = $$('.tile', row);
  tiles.forEach((tile, i) => {
    $('.f', tile).textContent = word[i] || '';
    const k = $('.k', tile);
    k.textContent = word[i] || '';
    if (clue) k.className = `k c${clue[i]}`;
  });
  if (clue) {
    const cards = $$('.card', row);
    if (instant) cards.forEach((c) => gsap.set(c, { rotateX: 180 }));
    else gsap.to(cards, { rotateX: 180, duration: 0.55, stagger: 0.16, ease: 'power2.inOut' });
    clue.forEach((c, i) => {
      const key = $(`.key[data-k="${word[i]}"]`);
      const rank = { 1: 3, 2: 2, 0: 1 }[c];
      if (key && rank > Number(key.dataset.rank || 0)) { key.dataset.rank = rank; key.className = `key c${c}`; }
    });
  }
}
function paintTyped() {
  if (!game || game.done) return;
  const r = game.rows.length;
  paintRow(r, game.typed.padEnd(5, ' ').slice(0, 5).replace(/ /g, ''), null);
  $$(`.row[data-r="${r}"] .f`).forEach((f, i) => f.classList.toggle('filled', i < game.typed.length));
}
function markProof(r, ok, text) {
  const pi = $(`.row[data-r="${r}"] .pi`);
  pi.className = `pi ${ok === true ? 'ok' : ok === false ? 'bad' : 'wait'}`;
  pi.title = text;
  pi.textContent = ok === true ? 'ZK verified' : ok === false ? 'ZK ✗' : '···';
}
function shake() { gsap.fromTo(`.row[data-r="${game.rows.length}"]`, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.3)' }); }
async function press(k) {
  if (!game || game.done || game.busy) return;
  if (k === '⌫' || k === 'backspace') game.typed = game.typed.slice(0, -1);
  else if (k === '↵' || k === 'enter') {
    if (game.typed.length !== 5) { shake(); return toast(t('g.short')); }
    game.busy = true;
    const r = game.rows.length, guess = game.typed;
    markProof(r, null, t('g.proving'));
    $('#status').textContent = t('g.proving');
    try {
      const res = await game.submit(guess);
      game.rows.push(res); game.typed = '';
      paintRow(r, guess, res.clue);
      verifyInBrowser(res.proof, res.publicSignals).then((ok) => { res.ok = ok; markProof(r, ok, t('g.verified')); game.save?.(); });
      const won = res.clue.every((c) => c === 1);
      if (won || game.rows.length === 6) { game.done = true; game.finish?.(won); }
      game.save?.();
      $('#status').textContent = won ? t('g.win') : game.rows.length === 6 ? t('g.lose') : '';
      if (won) setTimeout(() => gsap.fromTo(`.row[data-r="${r}"] .tile`, { y: 0 }, { y: -14, duration: 0.25, yoyo: true, repeat: 1, stagger: 0.08, ease: 'power2.out' }), 900);
    } catch (e) {
      markProof(r, undefined, ''); $(`.row[data-r="${r}"] .pi`).textContent = '';
      $('#status').textContent = '';
      shake(); toast(e.message === 'not in the word list' ? t('g.notword') : e.message);
    } finally { game.busy = false; }
  } else if (/^[a-z]$/.test(k) && game.typed.length < 5) {
    game.typed += k;
    const tile = $$(`.row[data-r="${game.rows.length}"] .tile`)[game.typed.length - 1];
    gsap.fromTo(tile, { scale: 0.88 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' });
  }
  paintTyped();
}
document.addEventListener('keydown', (e) => { if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input')) return; press(e.key.toLowerCase()); });
document.addEventListener('click', (e) => { const k = e.target.closest('.key'); if (k) press(k.dataset.k); });

const emoji = (rows) => rows.map((r) => r.clue.map((c) => ['⬜', '🟩', '🟨'][c]).join('')).join('\n');
const countdown = (el, at) => { const tick = () => { const s = Math.max(0, Math.floor((at - Date.now()) / 1000)); el.textContent = `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }; tick(); clearInterval(el._t); el._t = setInterval(tick, 1000); };

// ------------------------------------------------------------ DAILY
async function daily() {
  const d = await api('/api/daily');
  const key = `zk.day.${d.day}`, saved = JSON.parse(localStorage.getItem(key) || 'null');
  drawBoard();
  game = { mode: 'daily', rows: [], typed: '', done: false, day: d.day,
    submit: (guess) => api('/api/daily/guess', { guess }),
    save() { localStorage.setItem(key, JSON.stringify({ rows: this.rows, done: this.done })); },
    finish(won) {
      const s = JSON.parse(localStorage.getItem('zk.streak') || '{"cur":0,"best":0,"solves":0,"last":-1}');
      if (s.last !== d.day) { s.cur = won ? (s.last === d.day - 1 ? s.cur + 1 : 1) : 0; s.best = Math.max(s.best, s.cur); s.solves += won ? 1 : 0; s.last = d.day; }
      localStorage.setItem('zk.streak', JSON.stringify(s));
      setTimeout(() => { refreshSide(); showDone(won); }, 1400);
    } };
  if (saved) { game.rows = saved.rows; game.done = saved.done; saved.rows.forEach((r, i) => { paintRow(i, r.guess, r.clue, true); markProof(i, r.ok ?? null, t('g.verified')); }); }
  if (game.done) $('#status').textContent = game.rows.at(-1).clue.every((c) => c === 1) ? t('g.win') : t('g.lose');

  $('#info').innerHTML = `<p class="eyebrow">${t('g.day')} · #${d.day + 1}</p>
    <h2 class="sealed">${t('g.sealed')}</h2>
    <code class="seal-hash" title="${d.seal}">${d.seal.slice(0, 18)}…${d.seal.slice(-6)}</code>
    <p class="small">${t('g.next')} <b class="cd"></b></p>
    ${d.board ? `<a class="small link" href="${solscan(d.board, cfg.cluster)}" target="_blank" rel="noopener">${short(d.board)} ↗</a>` : ''}
    <p class="trust-note">${t('g.trust')}</p>
    ${d.yesterday ? `<details class="reveal"><summary>${t('g.yesterday')}: <b>${d.yesterday.word.toUpperCase()}</b></summary>
      <p class="small">salt <code>${d.yesterday.salt.slice(0, 16)}…</code></p><button class="mini-btn" data-check='${JSON.stringify(d.yesterday)}'>${t('g.check')}</button><span class="check-out small"></span></details>` : ''}`;
  countdown($('.cd'), d.nextAt);
  $('[data-check]')?.addEventListener('click', async (e) => {
    const y = JSON.parse(e.target.dataset.check), h = await poseidonCheck(y.word, y.salt);
    $('.check-out').textContent = h === y.seal ? ' ✓ ' + t('s.match') : ' ✗ mismatch';
  });
  game.board = d.board;
  refreshSide();
}

async function refreshSide() {
  if (!game) return;
  const panel = $('#panel');
  if (game.mode === 'daily') {
    const s = JSON.parse(localStorage.getItem('zk.streak') || '{"cur":0,"best":0,"solves":0}');
    let chain = '';
    if (wallet && prog) {
      try {
        const p = await api(`/api/player/${wallet}`);
        if (p.streak) chain = `<p class="eyebrow">${t('g.onchain')}</p><div class="stats"><div><b>${p.streak.current}</b><span>${t('g.streak')}</span></div><div><b>${p.streak.best}</b><span>${t('g.best')}</span></div><div><b>${p.streak.solves}</b><span>${t('g.solves')}</span></div></div>
          <a class="small link" href="${solscan(p.pda, cfg.cluster)}" target="_blank" rel="noopener">PDA ${short(p.pda)} ↗</a>`;
      } catch {}
    }
    panel.innerHTML = `<p class="eyebrow">${t('g.local')}</p>
      <div class="stats"><div><b>${s.cur}</b><span>${t('g.streak')}</span></div><div><b>${s.best}</b><span>${t('g.best')}</span></div><div><b>${s.solves}</b><span>${t('g.solves')}</span></div></div>
      ${chain}
      ${game.done ? `<div class="actions"><button class="btn wax" id="share">${t('g.share')}</button>${game.board ? `<button class="btn ghost" id="sealrun">${t('g.sealrun')}</button>` : ''}</div>` : ''}
      ${cfg.token?.mint ? `<button class="mini-btn" id="mend">${t('g.mend')} · ${Number(cfg.token.mend ?? 10000).toLocaleString('en-US')} $${cfg.token.symbol}</button>` : `<p class="small muted" data-pending="mend">${t('g.mend')} (burn ${Number(cfg.token?.mend ?? 10000).toLocaleString('en-US')} $${cfg.token?.symbol || 'PROOF'}) · available after $PROOF launches</p>`}`;
    $('#share')?.addEventListener('click', share);
    $('#sealrun')?.addEventListener('click', sealRun);
    $('#mend')?.addEventListener('click', mend);
  }
}

async function share() {
  try {
    const s = await api('/api/share', { day: game.day, rows: game.rows.map(({ guess, proof, publicSignals }) => ({ guess, proof, publicSignals })), wallet });
    const won = game.rows.at(-1).clue.every((c) => c === 1);
    const text = `ZKdle #${game.day + 1} ${won ? game.rows.length : 'X'}/6 · every clue proven\n\n${emoji(game.rows)}\n\n${location.origin}${s.url}`;
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text }).catch(() => {});
    else { await navigator.clipboard.writeText(text).catch(() => {}); toast(t('g.copied')); }
  } catch (e) { toast(e.message); }
}
async function sealRun() {
  try {
    if (!wallet && !(await connect())) return;
    const txs = [];
    for (const r of game.rows) {
      const raw = Buffer.from(r.payload, 'base64');
      txs.push(await freshTx(prog.guess(wallet, game.board, { letters: raw.subarray(0, 5), clue: raw.subarray(5, 10), proof: raw.subarray(10) })));
    }
    await signSend(txs);
    toast('✓ ' + t('g.onchain'));
    refreshSide();
  } catch (e) { toast(e.message); }
}
async function mend() {
  try {
    if (!wallet && !(await connect())) return;
    const { tx } = await api('/api/streak/mend', { wallet });
    await signSend([fromServer(tx)]);
    refreshSide();
  } catch (e) { toast(e.message); }
}
function showDone(won) {
  const sh = $('#sheet');
  $('.sheet-in', sh).innerHTML = `<img class="big-seal" src="/brand/seal.svg" alt=""><h2>${won ? `${game.rows.length}/6` : 'X/6'}</h2><pre class="grid">${emoji(game.rows)}</pre>
    <p>${won ? t('g.win') : t('g.lose')}</p><div class="actions"><button class="btn wax" data-act="share">${t('g.share')}</button><button class="btn ghost" data-act="close">OK</button></div>`;
  sh.hidden = false;
  gsap.fromTo('.sheet-in', { y: 60, opacity: 0, rotation: -2 }, { y: 0, opacity: 1, rotation: 0, duration: 0.5, ease: 'back.out(1.6)' });
  gsap.fromTo('.big-seal', { scale: 2.4, opacity: 0, rotation: -50 }, { scale: 1, opacity: 1, rotation: -10, duration: 0.45, delay: 0.25, ease: 'expo.in' });
  sh.onclick = (e) => { const a = e.target.closest('[data-act]')?.dataset.act; if (a === 'share') share(); if (a === 'close' || e.target === sh) sh.hidden = true; };
}

// ------------------------------------------------------------ BOUNTY + DUEL seats
async function seatGame(round) {
  drawBoard();
  const key = `${round.id}:${wallet}`;
  const mine = round.seats?.find((s) => s.player === wallet);
  game = { mode: 'seat', rows: [], typed: '', done: false, round,
    async submit(guess) {
      const res = await api(`/api/rounds/${round.id}/guess`, { wallet, guess });
      const raw = Buffer.from(res.payload, 'base64');
      await signSend([await freshTx(prog.guess(wallet, res.board, { letters: raw.subarray(0, 5), clue: raw.subarray(5, 10), proof: raw.subarray(10) }))]);
      return res;
    },
    finish() { setTimeout(() => loadRound(round.id), 1500); } };
  if (mine?.grid) {
    mine.grid.forEach((g, i) => { const w = g.letters.map((n) => String.fromCharCode(97 + n)).join(''); game.rows.push({ guess: w, clue: g.clue }); paintRow(i, w, g.clue, true); markProof(i, true, 'verified on-chain'); });
    game.done = mine.solved || mine.rows >= 6;
  }
  $('#status').textContent = t('b.seated');
}
const tok = (raw, r) => (Number(raw) / 10 ** (r.decimals ?? 6)).toLocaleString('en-US', { maximumFractionDigits: 2 });
function roundInfo(r) {
  const isDuel = r.kind === 1;
  const head = isDuel
    ? `<h2 class="sealed">${(r.entry / 1e9).toFixed(3).replace(/\.?0+$/, '')} SOL <small>${t('b.entry')}</small></h2>
    <div class="stats"><div><b>${r.players}</b><span>${t('b.players')}</span></div><div><b>${((r.entry * r.players * (1 - cfg.feeBps / 1e4)) / 1e9).toFixed(3)}</b><span>pot (SOL)</span></div><div><b class="cd"></b><span>${t('b.ends')}</span></div></div>`
    : `<h2 class="sealed">${tok(r.entry, r)} <small>$${r.symbol}<span class="gap">${t('b.entry')}</span></small></h2>
    ${r.refLamports ? `<p class="small">≈ ${(r.refLamports / 1e9).toFixed(3)} SOL at open (TWAP), fixed for this round</p>` : ''}
    <div class="stats"><div><b>${r.players}/${r.cap}</b><span>${t('b.players')}<br>${Math.max(0, r.cap - r.players)} ${t(r.cap - r.players === 1 ? 'b.left1' : 'b.left')}</span></div><div><b>${tok(BigInt(r.split.pot) * BigInt(r.players), r)}</b><span>pot ($${r.symbol})${r.refLamports && r.players ? `<br>≈ ${((r.refLamports * r.players * (1 - (r.split.burnBps + r.split.feeBps) / 1e4)) / 1e9).toFixed(3)} SOL` : ''}</span></div><div><b class="cd"></b><span>${t('b.ends')}</span></div></div>
    <p class="small">Per entry: ${r.split.burnBps / 100}% burned · ${r.split.feeBps / 100}% treasury · ${100 - (r.split.burnBps + r.split.feeBps) / 100}% to the pot</p>`;
  return `<p class="eyebrow">${isDuel ? t('d.title') : t('b.title')} · ${r.id}</p>
    ${head}
    <p class="small">${isDuel ? t('d.rule') : t('b.rule')}</p>
    <p class="small">${t('b.commit')} <code title="${r.commit}">${r.commit.slice(0, 14)}…</code>${r.seed ? ` · seed <code>${r.seed.slice(0, 10)}…</code>` : ''}</p>
    <a class="small link" href="${solscan(r.pda, cfg.cluster)}" target="_blank" rel="noopener">${short(r.pda)} ↗</a>`;
}
function standings(r) {
  const rows = (r.seats || []).filter((s) => s.rows != null).map((s) => ({ ...s, secs: s.solved ? s.solvedAt - s.startedAt : Infinity }))
    .sort((a, b) => (b.solved - a.solved) || (a.rows - b.rows) || (a.secs - b.secs));
  const paid = Math.max(1, Math.ceil((r.players * 3) / 10));
  return `<p class="eyebrow">${t('b.board')}</p><ol class="standings">${rows.map((s, i) => `<li class="${s.solved && i < paid ? 'paid' : ''}${s.player === wallet ? ' me' : ''}"><span>${short(s.player)}</span><span>${s.solved ? `${s.rows}/6 · ${s.secs}s` : `${s.rows}/6`}</span></li>`).join('') || '<li>—</li>'}</ol>
    ${r.settleSig ? `<a class="small link" href="https://solscan.io/tx/${r.settleSig}" target="_blank" rel="noopener">settled ↗</a>` : ''}`;
}
async function loadRound(id) {
  const r = await api(`/api/rounds/${id}`);
  if (r.kind === 0 && !cfg.token?.mint) return bounty(); // bounty is $PROOF-only: waiting state until the mint is set
  $('#info').innerHTML = roundInfo(r);
  countdown($('.cd'), r.endsAt);
  $('#panel').innerHTML = standings(r);
  const seated = wallet && r.seats.some((s) => s.player === wallet);
  if (seated) return seatGame(r);
  drawBoard(); game = null;
  const over = r.settled || Date.now() > r.endsAt || r.players >= r.cap;
  const full = !r.settled && Date.now() <= r.endsAt && r.players >= r.cap;
  $('#status').innerHTML = full ? `${t('b.full')} <b class="cd2"></b>` : over ? t('b.over') : `<button class="btn wax" id="join">${r.kind === 1 ? t('d.join') : t('b.join')}</button>${wallet ? '' : `<span class="small"> ${t('b.need')}</span>`}`;
  if (full) countdown($('.cd2'), r.endsAt);
  $('#join')?.addEventListener('click', async () => {
    try {
      if (!wallet && !(await connect())) return;
      const left = Math.round((r.endsAt - Date.now()) / 60000);
      if (r.kind === 0 && left < 10 && !confirm(`Only ${left} min left in this round. Your clock starts when you sit down, but the round still closes on time — unfinished boards don't place. Take the seat anyway?`)) return;
      const { tx } = await api(r.kind === 1 ? `/api/duels/${r.id}/join` : `/api/rounds/${r.id}/join`, { wallet });
      await signSend([fromServer(tx)]);
      await api(`/api/rounds/${r.id}/seated`, { wallet });
      loadRound(r.id);
    } catch (e) { toast(e.message); }
  });
}
async function bounty() {
  const list = await api('/api/rounds');
  const open = list.find((r) => !r.settled && r.endsAt > Date.now() && r.kind === 0) || list[0];
  if (!open || !cfg.token?.mint) { drawBoard(); game = null; $('#info').innerHTML = cfg.token?.mint ? `<p>${t('b.none')}</p>` : `<p class="eyebrow">${t('b.title')}</p><h2 class="sealed" data-pending="bounty">Opens when $PROOF launches</h2><p class="small">Bounty rounds open once $PROOF is live.</p><p class="small">Bounty rounds are paid in $${cfg.token?.symbol || 'PROOF'}: 0.01 SOL worth per seat, 10% burned, 5% treasury, 85% to the pot. Up to 12 players per round during early access.</p><a class="small link" href="/docs#bounty">How bounty rounds work →</a>`; $('#panel').innerHTML = ''; $('#status').textContent = ''; return; }
  history.replaceState(null, '', `/round/${open.id}`);
  loadRound(open.id);
}
async function duel(id) {
  if (id) return loadRound(id);
  drawBoard(); game = null;
  $('#status').textContent = '';
  $('#info').innerHTML = `<p class="eyebrow">${t('d.title')}</p><h2 class="sealed">1 v 1</h2><p class="small">${t('d.rule')}</p>
    <label class="field"><span>${t('d.stake')}</span><input id="stake" type="number" min="0.005" step="0.005" value="0.05" inputmode="decimal"></label>
    <button class="btn wax" id="mk">${t('d.create')}</button><div id="duel-link"></div>`;
  $('#panel').innerHTML = `<p class="small">${t('d.link')}</p>`;
  $('#mk').addEventListener('click', async () => {
    try {
      if (!wallet && !(await connect())) return;
      const d = await api('/api/duels', { wallet, stake: Number($('#stake').value) });
      await signSend([fromServer(d.tx)]);
      await api(`/api/duels/${d.id}/opened`, {});
      const url = `${location.origin}/duel/${d.id}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      history.pushState(null, '', `/duel/${d.id}`);
      toast(t('g.copied'));
      loadRound(d.id);
    } catch (e) { toast(e.message); }
  });
}

// ------------------------------------------------------------ SHARE VIEW
async function shareView(id) {
  const s = await api(`/api/share/${id}`);
  drawBoard();
  $('#keys').innerHTML = '';
  s.rows.forEach((r, i) => { paintRow(i, '     ', r.clue, true); markProof(i, null, ''); });
  $('#status').innerHTML = `<button class="btn wax" id="vfy">${t('s.verify')}</button>`;
  $('#info').innerHTML = `<p class="eyebrow">${t('s.title')} · #${s.day + 1}</p><h2 class="sealed">${s.rows.at(-1).clue.every((c) => c === 1) ? s.rows.length : 'X'}/6</h2>
    <code class="seal-hash">${s.seal.slice(0, 18)}…</code>${s.holder ? `<p class="holder">$${cfg.token.symbol} holder</p>` : ''}
    ${s.word ? `<details class="reveal" open><summary>${t('s.reveal')}: <b>${s.word.toUpperCase()}</b></summary><button class="mini-btn" id="hchk">${t('g.check')}</button><span class="check-out small"></span></details>` : ''}`;
  $('#panel').innerHTML = `<a class="btn ghost" href="/play">${t('s.play')}</a>`;
  $('#vfy').addEventListener('click', async () => {
    let all = true;
    for (const [i, r] of s.rows.entries()) {
      const ok = (await verifyInBrowser(r.proof, r.publicSignals)) && r.publicSignals[10] === s.seal;
      markProof(i, ok, ''); all &&= ok;
    }
    $('#status').textContent = all ? `${t('s.ok')} ${s.seal.slice(0, 10)}…` : t('s.bad');
  });
  $('#hchk')?.addEventListener('click', async () => { $('.check-out').textContent = (await poseidonCheck(s.word, s.salt)) === s.seal ? ' ' + t('s.match') : ' ✗'; });
}

// ------------------------------------------------------------ boot
function route() {
  const p = location.pathname;
  const tab = p.startsWith('/round') ? 'bounty' : p.startsWith('/duel') ? 'duel' : 'daily';
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  document.body.dataset.mode = tab;
  if (p.startsWith('/s/')) return shareView(p.split('/')[2]);
  if (tab === 'bounty') return p.split('/')[2] ? loadRound(p.split('/')[2]) : bounty();
  if (tab === 'duel') return duel(p.split('/')[2]);
  return daily();
}
$$('.tabs button').forEach((b) => b.addEventListener('click', () => {
  history.pushState(null, '', { daily: '/play', bounty: '/round', duel: '/duel' }[b.dataset.tab]);
  route().catch((e) => toast(e.message));
}));
addEventListener('popstate', () => route());
$('.wallet').addEventListener('click', () => connect().then(() => route()).catch((e) => toast(e.message)));

(async () => {
  cfg = await loadConfig();
  conn = new Connection(new URL(cfg.rpc || '/api/rpc', location.origin).toString(), { commitment: 'confirmed', disableRetryOnRateLimit: true });
  prog = cfg.programId ? client(cfg.programId) : null;
  $('.net').textContent = cfg.network ? `network: ${cfg.network}` : '';
  setupCopy();
  // a wallet that already trusted the site reconnects silently, so a seated player who reloads lands back on their board
  try { const p = provider(); if (p) { const r = await p.connect({ onlyIfTrusted: true }); if (r?.publicKey || p.publicKey) { wallet = (r?.publicKey || p.publicKey).toBase58(); $('.wallet').textContent = short(wallet); $('.wallet').classList.add('on'); } } } catch {}
  route().catch((e) => toast(e.message));
  setupSound();
})();
