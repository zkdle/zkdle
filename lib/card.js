// Share card: ruled paper, the colour grid, the streak and the $PROOF wax seal. Rendered to PNG for link previews.
// Holders get a carved gold frame: bevelled metal band, engraved guilloche, acanthus corners and an engraved ribbon.
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const G = path.join(__dirname, '..', 'assets', 'fonts');
const FONT_FILES = ['Fraunces.ttf', 'Fraunces-Italic.ttf', 'InstrumentSans.ttf', 'Gloock-Regular.ttf', 'Figtree-VariableFont_wght.ttf', 'Kalam-Regular.ttf'].map((f) => `${G}/${f}`);
const ink = '#22304a', paper = '#f4ecdc', moss = '#5f8052', ochre = '#d6a339', stone = '#cfc4b1', wax = '#9b2f2b', soft = '#5b6478';
const tint = [stone, moss, ochre];
const uri = (f, t) => `data:${t};base64,` + fs.readFileSync(path.join(__dirname, '..', 'public', 'brand', f)).toString('base64');
const SEAL_SVG = uri('seal.svg', 'image/svg+xml');     // hand-pressed ZK seal (site logo)
const PF_SVG = uri('token-pf.svg', 'image/svg+xml');   // $PROOF Pf wax seal
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function waxSeal(cx, cy, r) {
  return `<image href="${SEAL_SVG}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}"/>`;
}
const pfSeal = (cx, cy, r) => `<image href="${PF_SVG}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}"/>`;

// ---- carved gold
const W = 1200, H = 630, O = 14, B = 40;          // outer inset, band width
const goldDefs = `
  <linearGradient id="au" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f6dc8e"/><stop offset=".18" stop-color="#c8952e"/><stop offset=".36" stop-color="#f3d27a"/>
    <stop offset=".55" stop-color="#a87420"/><stop offset=".74" stop-color="#e9c262"/><stop offset="1" stop-color="#8a5c16"/>
  </linearGradient>
  <linearGradient id="auV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fbe7a6"/><stop offset=".45" stop-color="#d4a23e"/><stop offset=".55" stop-color="#b9862a"/><stop offset="1" stop-color="#f0cf74"/>
  </linearGradient>
  <linearGradient id="lit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6d2"/><stop offset=".5" stop-color="#fff6d2" stop-opacity="0"/><stop offset=".5" stop-color="#5a3a0c" stop-opacity="0"/><stop offset="1" stop-color="#5a3a0c"/></linearGradient>
  <linearGradient id="litIn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a3a0c"/><stop offset=".5" stop-color="#5a3a0c" stop-opacity="0"/><stop offset=".5" stop-color="#fff6d2" stop-opacity="0"/><stop offset="1" stop-color="#fff6d2"/></linearGradient>
  <filter id="emboss" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="b"/>
    <feSpecularLighting in="b" surfaceScale="5" specularConstant=".9" specularExponent="22" lighting-color="#fff4d0" result="s"><feDistantLight azimuth="225" elevation="42"/></feSpecularLighting>
    <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
    <feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k1="0" k2="1" k3=".75" k4="0" result="lit"/>
    <feDropShadow in="lit" dx="2" dy="3" stdDeviation="2.5" flood-color="#4a3210" flood-opacity=".45"/>
  </filter>
  <filter id="cast" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#3d2a0c" flood-opacity=".35"/></filter>
  <path id="bandp" fill-rule="evenodd" d="M${O} ${O + 26}q0-26 26-26H${W - O - 26}q26 0 26 26V${H - O - 26}q0 26-26 26H${O + 26}q-26 0-26-26Z M${O + B} ${O + B + 8}q0-8 8-8H${W - O - B - 8}q8 0 8 8V${H - O - B - 8}q0 8-8 8H${O + B + 8}q-8 0-8-8Z"/>`;

// guilloche: two phase-shifted sine ropes, cut as dark grooves with a light lower lip
function rope(len, amp, per, ph) {
  let d = `M0 ${amp * Math.sin(ph)}`;
  for (let x = 2; x <= len; x += 2) d += `L${x} ${(amp * Math.sin((x / per) * 2 * Math.PI + ph)).toFixed(2)}`;
  return d;
}
function engraveRun(x, y, len, rot) {
  const lines = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((ph) => rope(len, 7.5, 34, ph)).join('');
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <path d="${lines}" fill="none" stroke="#fff1c4" stroke-width="1.1" opacity=".75" transform="translate(0 .9)"/>
    <path d="${lines}" fill="none" stroke="#6b4512" stroke-width="1.1" opacity=".85"/></g>`;
}
// acanthus scroll corner: spiral volutes + leaf, engraved veins
// corner: bevelled square plate with an engraved rosette, C-scroll volutes running along both edges
function spiral(cx, cy, r0, turns, dir) {
  let d = '';
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, a = dir * t * turns * 2 * Math.PI, r = r0 * (1 - 0.82 * t);
    d += `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return d;
}
const petals = Array.from({ length: 8 }, (_, i) => `<ellipse cx="37" cy="22" rx="5.5" ry="13" transform="rotate(${i * 45} 37 37)" fill="url(#auV)" stroke="#5e3d0e" stroke-width="1.3"/>
  <line x1="37" y1="12" x2="37" y2="31" transform="rotate(${i * 45} 37 37)" stroke="#5e3d0e" stroke-width=".9"/>`).join('');
const scroll = (rot) => `<g transform="${rot}">
  <path d="M70 26 C92 26 104 14 118 14 C132 14 138 26 130 32 C124 36 118 30 122 26" fill="none" stroke="#5e3d0e" stroke-width="7" stroke-linecap="round"/>
  <path d="M70 26 C92 26 104 14 118 14 C132 14 138 26 130 32 C124 36 118 30 122 26" fill="none" stroke="url(#auV)" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M72 25 C92 24 104 13 118 13" fill="none" stroke="#fff1c4" stroke-width="1" opacity=".8"/>
  <path d="M70 34 C84 36 92 44 104 44" fill="none" stroke="#5e3d0e" stroke-width="5" stroke-linecap="round"/>
  <path d="M70 34 C84 36 92 44 104 44" fill="none" stroke="url(#auV)" stroke-width="3" stroke-linecap="round"/>
  <circle cx="106" cy="44" r="3.5" fill="url(#au)" stroke="#5e3d0e" stroke-width="1.2"/></g>`;
const corner = `<g id="cn">
  ${scroll('')}${scroll('matrix(0 1 1 0 0 0)')}
  <rect x="0" y="0" width="74" height="74" rx="10" fill="url(#au)" stroke="#5e3d0e" stroke-width="2"/>
  <rect x="6" y="6" width="62" height="62" rx="7" fill="none" stroke="#5e3d0e" stroke-width="1.3"/>
  <rect x="7" y="7" width="60" height="60" rx="6" fill="none" stroke="#fff1c4" stroke-width=".8" opacity=".7"/>
  <circle cx="37" cy="37" r="27" fill="#a87420" stroke="#5e3d0e" stroke-width="1.3"/>
  ${petals}
  <circle cx="37" cy="37" r="9" fill="url(#au)" stroke="#5e3d0e" stroke-width="1.5"/>
  <circle cx="37" cy="37" r="4.5" fill="${'#9b2f2b'}" stroke="#5e3d0e" stroke-width="1"/><circle cx="35.5" cy="35.5" r="1.5" fill="#f2b9a8"/>
</g>`;

function goldFrame() {
  const ox = O, oy = O, iw = W - 2 * O, ih = H - 2 * O;
  const mid = O + B / 2;
  const runs = [engraveRun(O + 30, mid, iw - 60, 0), engraveRun(O + 30, H - mid, iw - 60, 0), engraveRun(mid, O + 30, ih - 60, 90), engraveRun(W - mid, O + 30, ih - 60, 90)].join('');
  return `<g filter="url(#cast)">
  <g filter="url(#emboss)"><use href="#bandp" fill="url(#au)"/></g>
  <g>${runs}
    <rect x="${O + 9}" y="${O + 9}" width="${iw - 18}" height="${ih - 18}" rx="18" fill="none" stroke="#6b4512" stroke-width="1.4"/>
    <rect x="${O + 10}" y="${O + 10}" width="${iw - 20}" height="${ih - 20}" rx="17" fill="none" stroke="#fff1c4" stroke-width=".9" opacity=".7"/>
    <rect x="${O + B - 9}" y="${O + B - 9}" width="${iw - 2 * B + 18}" height="${ih - 2 * B + 18}" rx="12" fill="none" stroke="#6b4512" stroke-width="1.4"/>
    <rect x="${O + B - 8}" y="${O + B - 8}" width="${iw - 2 * B + 16}" height="${ih - 2 * B + 16}" rx="11" fill="none" stroke="#fff1c4" stroke-width=".9" opacity=".7"/>
  </g>
  <rect x="${ox + 1.5}" y="${oy + 1.5}" width="${iw - 3}" height="${ih - 3}" rx="25" fill="none" stroke="url(#lit)" stroke-width="3"/>
  <rect x="${O + B - 1}" y="${O + B - 1}" width="${iw - 2 * B + 2}" height="${ih - 2 * B + 2}" rx="9" fill="none" stroke="url(#litIn)" stroke-width="3"/>
  <rect x="${O + B + 3}" y="${O + B + 3}" width="${iw - 2 * B - 6}" height="${ih - 2 * B - 6}" rx="7" fill="none" stroke="#b98a33" stroke-width="1.2" opacity=".6"/>
  </g>
  <defs>${corner}</defs>
  <g filter="url(#emboss)">
    <use href="#cn" transform="translate(${O - 4} ${O - 4})"/>
    <use href="#cn" transform="translate(${W - O + 4} ${O - 4}) scale(-1 1)"/>
    <use href="#cn" transform="translate(${O - 4} ${H - O + 4}) scale(1 -1)"/>
    <use href="#cn" transform="translate(${W - O + 4} ${H - O + 4}) scale(-1 -1)"/>
  </g>`;
}

// engraved ribbon plaque on the top band
function ribbon(cx, cy, label) {
  const w = 300, h = 46;
  const x0 = cx - w / 2, y0 = cy - h / 2;
  return `<g filter="url(#emboss)">
    <path d="M${x0 - 34} ${y0 + 8}h40v${h}h-40l14-${h / 2}Z M${x0 + w + 34} ${y0 + 8}h-40v${h}h40l-14-${h / 2}Z" fill="#9a6a1e" stroke="#5e3d0e" stroke-width="1.5"/>
    <path d="M${x0} ${y0}H${x0 + w}l8 ${h / 2}-8 ${h / 2}H${x0}l-8-${h / 2}Z" fill="url(#auV)" stroke="#6b4512" stroke-width="2"/>
  </g>
  <path d="M${x0 + 6} ${y0 + 6}H${x0 + w - 6} M${x0 + 6} ${y0 + h - 6}H${x0 + w - 6}" stroke="#6b4512" stroke-width="1" opacity=".7"/>
  <text x="${cx}" y="${cy + 9.5}" text-anchor="middle" font-family="Fraunces" font-weight="700" font-size="24" letter-spacing="5" fill="#fff3cf" opacity=".85">${label}</text>
  <text x="${cx}" y="${cy + 8}" text-anchor="middle" font-family="Fraunces" font-weight="700" font-size="24" letter-spacing="5" fill="#4a2f0a">${label}</text>`;
}

const flame = (x, y, s, fill) => `<path transform="translate(${x} ${y}) scale(${s})" d="M12 0C14 7 21 10 21 19C21 26 16 31 10.5 31C5 31 0 27 0 20C0 14 4 11 6 7C7 11 9 13 11 13C10 8 10 4 12 0Z" fill="${fill}"/><path transform="translate(${x} ${y}) scale(${s})" d="M10.5 30C7.5 30 5.5 27.5 5.5 24.5C5.5 21 8 19.5 9.5 17C10.5 20 13 20.5 13 18C15 20 15.5 22.5 15.5 24.5C15.5 27.5 13.5 30 10.5 30Z" fill="#f4c35a"/>`;

/** streak: { current, best, solves } read from the on-chain streak PDA; rank: { place, of } for rounds. */
function shareSvg({ title, rows, holder, symbol, onchain, streak, rank, subtitle }) {
  const size = 62, gap = 10, gx = 96, gy = 158;
  const tiles = rows.map((clue, r) => clue.map((c, i) =>
    `<rect x="${gx + i * (size + gap)}" y="${gy + r * (size + gap)}" width="${size}" height="${size}" rx="10" fill="${tint[c]}"/>`).join('')).join('');
  const score = rows.length && rows[rows.length - 1].every((c) => c === 1) ? `${rows.length}/6` : 'X/6';
  const gold = holder ? '#8a5c16' : wax;
  let stat = '';
  if (streak && streak.current > 0) {
    stat = `${flame(692, 330, 1.45, holder ? '#c8862a' : '#c4552c')}
    <text x="732" y="372" font-family="Fraunces" font-weight="600" font-size="46" fill="${ink}">${streak.current}-day streak</text>
    <text x="734" y="408" font-family="Instrument Sans" font-size="22" fill="${soft}">best ${streak.best} · ${streak.solves} solve${streak.solves === 1 ? '' : 's'} · kept on-chain</text>`;
  } else if (rank) {
    stat = `<text x="694" y="372" font-family="Fraunces" font-weight="600" font-size="46" fill="${ink}">#${rank.place} <tspan font-size="26" font-weight="400" fill="${soft}">of ${rank.of}</tspan></text>
    <text x="696" y="408" font-family="Instrument Sans" font-size="22" fill="${soft}">${esc(rank.note || 'final standing, settled on-chain')}</text>`;
  }
  const lines = Array.from({ length: 21 }, (_, i) => `<line x1="0" x2="${W}" y1="${44 + i * 28}" y2="${44 + i * 28}" stroke="#ddd2bd" stroke-width="1"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${goldDefs}
    <radialGradient id="vig" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#f4ecdc" stop-opacity="0"/><stop offset="1" stop-color="#d9c8a6" stop-opacity=".55"/></radialGradient>
    <radialGradient id="halo" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#e9c262" stop-opacity=".0"/><stop offset=".8" stop-color="#e9c262" stop-opacity=".35"/><stop offset="1" stop-color="#e9c262" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${paper}"/>
  ${lines}
  <line x1="648" x2="648" y1="0" y2="${H}" stroke="#e2a59b" stroke-width="2"/>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  ${holder ? goldFrame() : ''}
  <text x="${gx}" y="118" font-family="Fraunces" font-weight="600" font-size="56" fill="${ink}">${esc(title)}</text>
  ${subtitle ? `<text x="${gx + 2}" y="146" font-family="Instrument Sans" font-size="20" fill="${soft}">${esc(subtitle)}</text>` : ''}
  ${tiles}
  <text x="688" y="214" font-family="Fraunces" font-weight="700" font-size="124" fill="${ink}">${score}</text>
  <text x="694" y="264" font-family="Instrument Sans" font-weight="600" font-size="25" fill="${ink}">${onchain ? 'every clue verified on Solana' : 'every clue carries a ZK proof'}</text>
  <text x="694" y="296" font-family="Instrument Sans" font-size="21" fill="${soft}">open the link to check it yourself</text>
  ${stat}
  ${holder ? `<circle cx="1046" cy="488" r="96" fill="url(#halo)"/>${pfSeal(1046, 488, 80)}${ribbon(W / 2, O + B / 2 + 2, `$${esc(symbol || 'PROOF')} HOLDER`)}`
           : pfSeal(1050, 512, 80)}
  <text x="${gx}" y="${holder ? 560 : 586}" dx="${holder ? 6 : 0}" font-family="Fraunces" font-style="italic" font-size="28" fill="${gold}">zkdle — verify, don’t trust</text>
</svg>`;
}

const toPng = (svg) => new Resvg(svg, { font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Instrument Sans' } }).render().asPng();

module.exports = { shareSvg, toPng, waxSeal, palette: { ink, paper, moss, ochre, stone, wax } };
