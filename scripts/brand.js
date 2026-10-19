// Avatar (400x400), banner (1500x500), OG image and favicon, drawn as SVG and rasterised.
const fs = require('fs');
const path = require('path');
const { toPng, waxSeal, palette: c } = require('../lib/card');
const out = (f) => path.join(__dirname, '..', 'public', 'brand', f);
const grain = `<filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3"/><feColorMatrix values="0 0 0 0 .35 0 0 0 0 .28 0 0 0 0 .18 0 0 0 .08 0"/></filter>`;
const tile = (x, y, s, fill, ch, rot = 0, fg = '#fff') => `<g transform="rotate(${rot} ${x + s / 2} ${y + s / 2})"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.19}" fill="${fill}"/><text x="${x + s / 2}" y="${y + s * 0.7}" text-anchor="middle" font-family="Gloock" font-size="${s * 0.58}" fill="${fg}">${ch}</text></g>`;

// avatar.png / banner.png are the hand-pressed seal artwork (brand/ + public/brand/), not generated here.
const sealPng = 'data:image/png;base64,' + fs.readFileSync(out('seal-512.png')).toString('base64');

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs>${grain}</defs>
<rect width="1200" height="630" fill="${c.paper}"/><rect width="1200" height="630" filter="url(#g)"/>
<text x="90" y="250" font-family="Gloock" font-size="92" fill="${c.ink}">The word was sealed</text>
<text x="90" y="350" font-family="Gloock" font-size="92" fill="${c.wax}">before you guessed.</text>
<text x="94" y="430" font-family="Figtree" font-size="32" fill="${c.ink}">A five-letter word game. Every clue is a ZK proof checked on Solana.</text>
<image href="${sealPng}" x="950" y="30" width="210" height="210"/><text x="94" y="540" font-family="Kalam" font-size="36" fill="${c.wax}">zkdle · verify, don’t trust</text></svg>`;


fs.mkdirSync(out(''), { recursive: true });
fs.writeFileSync(out('og.png'), toPng(og));
// favicon.svg is the hand-built wax seal in public/brand (same as seal.svg)
console.log('brand assets written');
