// Rasterise the hand-pressed seal SVG (public/brand/seal.svg) into favicon / icon PNGs with Chrome.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const pub = (f) => path.join(__dirname, '..', 'public', 'brand', f);
(async () => {
  const svg = fs.readFileSync(pub('seal.svg'), 'utf8');
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await br.newPage();
  for (const [name, size] of [['favicon-16.png', 16], ['favicon-32.png', 32], ['favicon-48.png', 48], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['seal-512.png', 512]]) {
    await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await p.setContent(`<style>html,body{margin:0;background:transparent}img{width:${size}px;height:${size}px;display:block}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`, { waitUntil: 'load' });
    await p.screenshot({ path: pub(name), omitBackground: true });
  }
  const tok = fs.readFileSync(pub('token-pf.svg'), 'utf8');
  await p.setViewport({ width: 256, height: 256 });
  await p.setContent(`<style>html,body{margin:0;background:transparent}img{width:256px;height:256px;display:block}</style><img src="data:image/svg+xml;base64,${Buffer.from(tok).toString('base64')}">`, { waitUntil: 'load' });
  await p.screenshot({ path: pub('token-pf-badge.png'), omitBackground: true });
  await br.close();
  console.log('seal PNGs written');
})();
