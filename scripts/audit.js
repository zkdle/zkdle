// Site audit: every page, desktop + mobile, preview or full. Console errors, failed requests, broken images, dead links.
// usage: BASE=http://127.0.0.1:5290 TAG=full node scripts/audit.js
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:5290', TAG = process.env.TAG || 'full';
const OUT = path.join(__dirname, '..', 'docs', 'audit');
const pages = ['/', '/docs', '/play', '/round', '/duel'];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const issues = [], links = new Set();
  for (const [vw, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    for (const u of pages) {
      const p = await br.newPage();
      await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: vw === 'mobile', hasTouch: vw === 'mobile' });
      p.on('console', (m) => m.type() === 'error' && issues.push(`${vw} ${u} console: ${m.text()}`));
      p.on('pageerror', (e) => issues.push(`${vw} ${u} pageerror: ${e.message}`));
      p.on('response', (r) => r.status() >= 400 && !r.url().includes('/api/') && issues.push(`${vw} ${u} ${r.status()} ${r.url()}`));
      await p.goto(BASE + u, { waitUntil: 'networkidle0', timeout: 60000 });
      // walk the page so scroll-triggered images load
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
      await new Promise((r) => setTimeout(r, 1200));
      const bad = await p.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
      bad.forEach((b) => issues.push(`${vw} ${u} broken image ${b}`));
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (overflow > 2) issues.push(`${vw} ${u} horizontal overflow ${overflow}px`);
      (await p.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href))).forEach((l) => links.add(l));
      await p.screenshot({ path: path.join(OUT, `${TAG}-${vw}${u === '/' ? '-home' : u.replace(/\//g, '-')}.png`), fullPage: u !== '/' });
      await p.close();
    }
  }
  for (const l of links) {
    if (!l.startsWith(BASE) || l.includes('#')) continue;
    const r = await fetch(l).catch(() => ({ status: 0 }));
    if (r.status >= 400 || r.status === 0) issues.push(`dead link ${l} ${r.status}`);
  }
  const ext = [...links].filter((l) => !l.startsWith(BASE));
  await br.close();
  fs.writeFileSync(path.join(OUT, `${TAG}-issues.txt`), [...new Set(issues)].join('\n') + '\n\nexternal links:\n' + [...new Set(ext)].join('\n') + '\n');
  console.log([...new Set(issues)].join('\n') || 'no issues'); console.log('external:', [...new Set(ext)].join(' '));
})();
