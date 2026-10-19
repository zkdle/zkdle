// Editorial diagrams for /docs and the README: SVG drawn here, rendered by Chrome with the site fonts -> PNG.
// Output: docs/img/*.png (README) and public/img/docs/*.png (served on /docs).
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const C = { paper: '#f4ecdc', card: '#fbf6ea', ink: '#22304a', soft: '#4a5570', faint: '#8a8f9c', wax: '#9b2f2b', waxLo: '#6e1f1d', moss: '#5f8052', ochre: '#d6a339', stone: '#cfc4b1', night: '#1d2a42' };
const F = 'Fraunces, Georgia, serif', S = "'Instrument Sans', system-ui, sans-serif";
const font = (f) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'public/fonts', f)).toString('base64');

const frame = (w, h, kicker, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="${C.ink}" stroke-opacity=".05"/></pattern>
<filter id="sh" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#3c2814" flood-opacity=".16"/></filter>
<radialGradient id="wax" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#c24a41"/><stop offset=".55" stop-color="${C.wax}"/><stop offset="1" stop-color="#561716"/></radialGradient>
<linearGradient id="au" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1bf"/><stop offset=".35" stop-color="#e2b54f"/><stop offset=".6" stop-color="#a87422"/><stop offset="1" stop-color="#f4d27a"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="${C.paper}"/><rect width="${w}" height="${h}" fill="url(#grid)"/>
<circle cx="${w - 80}" cy="40" r="260" fill="${C.ochre}" opacity=".10"/><circle cx="60" cy="${h}" r="220" fill="${C.moss}" opacity=".08"/>
<line x1="56" y1="58" x2="88" y2="58" stroke="${C.wax}"/><text x="98" y="62" font-family="${S}" font-size="13" letter-spacing="3" fill="${C.wax}">${kicker.toUpperCase()}</text>
<text x="56" y="112" font-family="${F}" font-size="42" fill="${C.ink}" letter-spacing="-1.2">${title}</text>
${body}</svg>`;
const tile = (x, y, s, fill, ch, fg = '#fff') => `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * .2}" fill="${fill}"/></g><text x="${x + s / 2}" y="${y + s * .68}" text-anchor="middle" font-family="${F}" font-size="${s * .55}" fill="${fg}">${ch}</text>`;
const seal = (x, y, r, label = 'zk') => `<g filter="url(#sh)"><circle cx="${x}" cy="${y}" r="${r}" fill="url(#wax)"/></g><circle cx="${x}" cy="${y}" r="${r * .78}" fill="none" stroke="url(#au)" stroke-width="1.5"/><text x="${x}" y="${y + r * .3}" text-anchor="middle" font-family="${F}" font-style="italic" font-size="${r * .85}" fill="url(#au)">${label}</text>`;
const card = (x, y, w, h, fill = C.card) => `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${fill}"/></g>`;
const txt = (x, y, s, size = 16, o = {}) => `<text x="${x}" y="${y}" font-family="${o.f || S}" font-size="${size}" fill="${o.c || C.soft}" ${o.a ? `text-anchor="${o.a}"` : ''} ${o.i ? 'font-style="italic"' : ''} ${o.w ? `font-weight="${o.w}"` : ''}>${s}</text>`;
const arrow = (x1, y, x2) => `<path d="M${x1} ${y}H${x2 - 8}" stroke="${C.ink}" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="4 5"/><path d="M${x2 - 10} ${y - 6}L${x2} ${y}L${x2 - 10} ${y + 6}" fill="none" stroke="${C.ink}" stroke-opacity=".5" stroke-width="1.5"/>`;

const D = {};
// 1. seal -> prove -> reveal
D['seal-flow'] = frame(1200, 520, 'How it works', 'Seal, prove, reveal', `
${card(56, 160, 330, 300)}${seal(140, 240, 46)}${txt(210, 232, 'Seal', 30, { f: F, c: C.ink })}${txt(210, 258, 'before anyone plays', 15)}
${txt(84, 330, 'word + random salt', 16, { c: C.ink })}${txt(84, 356, '→ Poseidon hash', 16)}${txt(84, 382, '→ only the hash goes on-chain', 16)}
<rect x="84" y="404" width="272" height="34" rx="17" fill="${C.paper}"/>${txt(100, 427, 'seal = 0x1d4f…a07c', 14, { c: C.ink })}
${arrow(392, 310, 432)}
${card(436, 160, 330, 300)}${tile(466, 196, 46, C.stone, 'C', C.ink)}${tile(518, 196, 46, C.moss, 'R')}${tile(570, 196, 46, C.stone, 'A', C.ink)}${tile(622, 196, 46, C.ochre, 'N')}${tile(674, 196, 46, C.stone, 'E', C.ink)}
${txt(466, 290, 'Prove', 30, { f: F, c: C.ink })}${txt(466, 322, 'each guess gets its colours + a', 16)}${txt(466, 346, 'Groth16 proof against the seal', 16)}${txt(466, 380, 'the Solana program verifies it', 16, { c: C.ink })}${txt(466, 404, 'before the row is recorded', 16)}
<rect x="466" y="416" width="200" height="30" rx="15" fill="${C.moss}" opacity=".15"/>${txt(482, 436, '✓ proof verified · 256 bytes', 13, { c: C.moss })}
${arrow(772, 310, 812)}
${card(816, 160, 330, 300, '#efe3cc')}${seal(890, 240, 46)}<path d="M890 196l-10 40 14 10-8 38" stroke="${C.paper}" stroke-width="5" fill="none"/>
${txt(960, 232, 'Reveal', 30, { f: F, c: C.ink })}${txt(960, 258, 'when the day / round ends', 15)}
${txt(846, 330, 'word + salt are published', 16, { c: C.ink })}${txt(846, 356, 'anyone re-hashes them', 16)}${txt(846, 382, 'and checks: same seal ✓', 16)}
${txt(846, 430, 'the answer could never move', 16, { f: F, i: 1, c: C.wax })}`);

// 2. round timeline: own clocks
const tl = () => {
  const x0 = 120, x1 = 1110, y0 = 190, W = x1 - x0, at = (m) => x0 + (W * m) / 60;
  const rows = [['Ana', 2, 4.5, 3, C.moss], ['Ben', 18, 6, 2, C.moss], ['Cy', 41, 9, 4, C.ochre], ['Dee', 53, 0, 0, C.stone]];
  let s = `<rect x="${x0}" y="${y0}" width="${W}" height="4" rx="2" fill="${C.ink}" opacity=".2"/>`;
  for (const m of [0, 10, 20, 30, 40, 50, 60]) s += `<line x1="${at(m)}" y1="${y0 - 6}" x2="${at(m)}" y2="${y0 + 10}" stroke="${C.ink}" stroke-opacity=".3"/>${txt(at(m), y0 - 14, m === 60 ? 'round closes · 60 min' : m + ' min', 13, { a: 'middle' })}`;
  s += `<rect x="${at(58)}" y="${y0 + 20}" width="${at(60) - at(58)}" height="${rows.length * 70}" fill="${C.wax}" opacity=".10"/>${txt(at(59), y0 + 40 + rows.length * 70, 'no new seats', 12, { a: 'middle', c: C.wax })}`;
  rows.forEach(([n, join, dur, g, col], i) => {
    const y = y0 + 50 + i * 70;
    s += txt(56, y + 6, n, 18, { f: F, c: C.ink });
    s += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${C.ink}" stroke-opacity=".08"/>`;
    if (!dur) { s += `<circle cx="${at(join)}" cy="${y}" r="7" fill="${C.wax}"/>${txt(at(join) - 16, y + 5, 'joins with 7 min left → sees a countdown warning first', 14, { c: C.wax, a: 'end' })}`; return; }
    s += `<circle cx="${at(join)}" cy="${y}" r="7" fill="${C.ink}"/><rect x="${at(join)}" y="${y - 9}" width="${at(join + dur) - at(join)}" height="18" rx="9" fill="${col}"/>`;
    s += txt(at(join + dur) + 14, y + 5, `${g} guesses · own time ${Math.floor(dur)}m${dur % 1 ? '30' : '00'}s`, 14, { c: C.ink });
  });
  s += txt(56, 500, 'Each clock starts when that player sits down and stops at their last guess. Every seat has its own word from the sealed seed,', 15);
  s += txt(56, 524, 'so finishing early leaks nothing. Ranking: fewer guesses, then shorter own time. The round only ends early if it is full and everyone is done.', 15);
  return s;
};
D['round-timeline'] = frame(1200, 560, 'Bounty rounds', 'Your clock, not the round’s', tl());

// 3. entry split donut
const donut = () => {
  const cx = 300, cy = 330, r = 150, sw = 64, parts = [[0.85, C.moss, '85%', 'pot (escrow)'], [0.10, C.wax, '10%', 'burned'], [0.05, C.ochre, '5%', 'treasury']];
  let a = -Math.PI / 2, s = '';
  const L = 2 * Math.PI * r;
  for (const [f, col] of parts) { s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-dasharray="${f * L - 3} ${L}" stroke-dashoffset="${-((a + Math.PI / 2) / (2 * Math.PI)) * L}" transform="rotate(-90 ${cx} ${cy})"/>`; a += f * 2 * Math.PI; }
  s += txt(cx, cy - 6, '2,000', 44, { f: F, c: C.ink, a: 'middle' }) + txt(cx, cy + 24, '$PROOF per seat', 15, { a: 'middle' }) + txt(cx, cy + 46, '≈ 0.01 SOL, fixed at open', 13, { a: 'middle', c: C.faint });
  const rows = [['85%', C.moss, '1,700 $PROOF', 'escrowed in the round’s own token account — the pot'], ['10%', C.wax, '200 $PROOF', 'burned on the spot (SPL BurnChecked, supply goes down)'], ['5%', C.ochre, '100 $PROOF', 'to the public treasury token account']];
  rows.forEach(([p, col, amt, d], i) => { const y = 220 + i * 92; s += `<rect x="560" y="${y - 30}" width="8" height="64" rx="4" fill="${col}"/>` + txt(590, y, p, 34, { f: F, c: C.ink }) + txt(690, y - 4, amt, 18, { c: C.ink, w: 600 }) + txt(690, y + 22, d, 15); });
  s += txt(560, 500, 'No solver? Every seat gets its 1,700 back. Only the burn and the fee are spent.', 15, { f: F, i: 1, c: C.wax });
  return s;
};
D['entry-split'] = frame(1200, 560, 'Bounty entry', 'Where an entry goes', donut());

// 4. payout curve
const curve = () => {
  let s = '';
  const panel = (x, k, pot, label) => {
    const tot = (k * (k + 1)) / 2, bw = Math.min(56, 440 / k - 10), base = 470, H = 250;
    s += txt(x, 170, label, 20, { f: F, c: C.ink });
    s += `<line x1="${x}" y1="${base}" x2="${x + 500}" y2="${base}" stroke="${C.ink}" stroke-opacity=".25"/>`;
    for (let i = 0; i < k; i++) {
      const share = (k - i) / tot, h = (H * share) / (k === 3 ? 0.5 : 0.5);
      const bx = x + 10 + i * (bw + 10);
      s += `<g filter="url(#sh)"><rect x="${bx}" y="${base - h}" width="${bw}" height="${h}" rx="8" fill="${i === 0 ? C.wax : i < 3 ? C.ochre : C.moss}"/></g>`;
      s += txt(bx + bw / 2, base - h - 10, Math.round(pot * share).toLocaleString('en-US'), k > 6 ? 12 : 15, { a: 'middle', c: C.ink });
      s += txt(bx + bw / 2, base + 22, `${i + 1}`, 13, { a: 'middle' });
    }
  };
  panel(56, 3, 17000, '10 seats → 3 winners · pot 17,000');
  panel(640, 10, 56100, '33 seats (later phase) → 10 winners · pot 56,100');
  s += txt(56, 524, 'Winners = top 30% of seats (rounded up). Weights fall linearly: k, k−1, … 1 — with 3 winners that is 3 : 2 : 1. Amounts in $PROOF.', 15);
  return s;
};
D['payout-curve'] = frame(1200, 560, 'Payouts', 'The top 30% split the pot', curve());

// 5. duel flow
D['duel-flow'] = frame(1200, 460, 'Duels', 'One link, two players, one winner', `
${card(56, 160, 250, 220)}${txt(80, 210, '1 · Open', 26, { f: F, c: C.ink })}${txt(80, 244, 'pick a SOL stake,', 15)}${txt(80, 266, 'sign once', 15)}<rect x="80" y="300" width="190" height="40" rx="20" fill="${C.wax}"/>${txt(175, 326, 'Open a duel', 15, { a: 'middle', c: '#fbeee6', w: 600 })}
${arrow(312, 270, 348)}
${card(352, 160, 250, 220)}${txt(376, 210, '2 · Post', 26, { f: F, c: C.ink })}${txt(376, 244, 'share the link on X —', 15)}${txt(376, 266, 'it unfolds into a Blink', 15)}<rect x="376" y="300" width="200" height="40" rx="10" fill="${C.night}"/>${txt(476, 326, 'Take the duel', 15, { a: 'middle', c: C.paper, w: 600 })}
${arrow(608, 270, 644)}
${card(648, 160, 250, 220)}${txt(672, 210, '3 · Play', 26, { f: F, c: C.ink })}${txt(672, 244, 'a different sealed word', 15)}${txt(672, 266, 'each, own clock each', 15)}${tile(672, 296, 40, C.moss, 'P')}${tile(718, 296, 40, C.moss, 'R')}${tile(764, 296, 40, C.ochre, 'O')}
${arrow(904, 270, 940)}
${card(944, 160, 200, 220, '#efe3cc')}${seal(1044, 236, 40)}${txt(968, 316, '4 · Settle', 26, { f: F, c: C.ink })}${txt(968, 346, 'fewer guesses wins', 15)}${txt(968, 368, 'both stakes − 5%', 15)}
${txt(56, 424, 'Tie on guesses → shorter own time wins. Settles as soon as both boards are done — no waiting for the deadline. Duels stay in SOL.', 15)}`);

// 6. roadmap
D['roadmap'] = frame(1200, 460, 'Early access', 'Room at the table grows in phases', `
<path d="M120 300 C 400 300, 500 250, 640 250 S 900 200, 1080 200" fill="none" stroke="${C.ink}" stroke-opacity=".2" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round"/>
${[[160, 300, 'Phase 1 · now', '12', 'players per round', 'settle pays everyone in one transaction', C.wax],
   [620, 252, 'Phase 2', '~100', 'players per round', 'incremental on-chain leaderboard settle · prover workers', C.ochre],
   [1020, 200, 'Phase 3', '200+', 'per round', 'parallel rounds · more prover capacity', C.moss]].map(([x, y, ph, n, u, d, col]) =>
  `<circle cx="${x}" cy="${y}" r="12" fill="${col}"/>${txt(x, y - 36, ph.toUpperCase(), 12, { a: 'middle', c: col, w: 600 })}${txt(x, y + 66, n, 52, { f: F, a: 'middle', c: C.ink })}${txt(x, y + 92, u, 14, { a: 'middle' })}${txt(x, y + 116, d, 13, { a: 'middle', c: C.faint })}`).join('')}
${txt(56, 440, 'No dates promised — each step ships when it is tested on devnet. Capacity goes up, the rules stay the same.', 15, { f: F, i: 1, c: C.wax })}`);

// 7. security & trust
D['security'] = frame(1200, 560, 'Security & trust', 'What the proofs guarantee, and what they don’t', `
${card(40, 150, 360, 330, '#e7eedf')}${txt(64, 192, 'ENFORCED ON SOLANA', 12, { c: C.moss, w: 600 })}
${['Every clue matches the seal (Groth16)', 'Seed must hash to its commitment', 'Burn · fee · escrow · payouts on-chain', 'Fee ≤ 20%, only to the treasury', '12 seats max per round', 'Host key read from config, rotatable'].map((t, i) => txt(64, 232 + i * 38, '✓  ' + t, 16, { c: C.ink })).join('')}
${card(420, 150, 360, 330, '#f3e6c9')}${txt(444, 192, 'SERVER HARDENING', 12, { c: C.ochre, w: 600 })}
${['Fresh salt / seed every round and day', 'State file AES-256-GCM, fails closed', 'Errors scrubbed, secrets never logged', 'Per-IP + per-wallet limits, no replays', 'Pot cap (ZK_MAX_POT_SOL_EQUIV)', 'Treasury key never on the server'].map((t, i) => txt(444, 232 + i * 38, '•  ' + t, 16, { c: C.ink })).join('')}
${card(800, 150, 360, 330, '#f1dcd6')}${txt(824, 192, 'RESIDUAL RISK', 12, { c: C.wax, w: 600 })}
${['The operator sees live answers', 'ZK stops swapped answers + forged hints,', '   not operator knowledge', 'A server breach could leak live words', 'Bounded by the pot cap + 12-seat beta', 'Next: TEE / threshold sealing'].map((t, i) => txt(824, 232 + i * 38, t, 16, { c: C.ink })).join('')}
${arrow(400, 315, 420)}${arrow(780, 315, 800)}
${txt(56, 530, 'Phase-2 setup: 3 team contributions + a Solana-blockhash beacon on top of Perpetual Powers of Tau (80 contributions). Public contributions welcome.', 15, { f: F, i: 1, c: C.wax })}`);

(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await br.newPage();
  fs.mkdirSync(path.join(ROOT, 'docs/img'), { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'public/img/docs'), { recursive: true });
  for (const [name, svg] of Object.entries(D)) {
    const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/);
    await p.setViewport({ width: +w, height: +h, deviceScaleFactor: 2 });
    await p.setContent(`<style>@font-face{font-family:Fraunces;src:url(${font('fraunces.woff2')})}@font-face{font-family:Fraunces;font-style:italic;src:url(${font('fraunces-italic.woff2')})}@font-face{font-family:'Instrument Sans';src:url(${font('instrument-sans.woff2')})}body{margin:0}</style>${svg}`, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    const out = path.join(ROOT, 'docs/img', name + '.png');
    await p.screenshot({ path: out });
    fs.copyFileSync(out, path.join(ROOT, 'public/img/docs', name + '.png'));
    console.log(name);
  }
  await br.close();
})();
