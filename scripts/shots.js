// Screenshots for README/docs. Needs a running server (npm run localnet) on :5290.
const puppeteer = require('puppeteer-core');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:5290';
const out = (f) => path.join(__dirname, '..', 'docs', f);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const errors = [];
  const page = async (w, h, mobile = false) => {
    const p = await br.newPage();
    await p.setViewport({ width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    p.on('pageerror', (e) => errors.push(e.message));
    return p;
  };
  const answer = await (await fetch(BASE + '/api/test/today')).json();

  // landing: hero, mid-flip, the stamps, token + trust
  let p = await page(1440, 900);
  await p.goto(BASE + '/', { waitUntil: 'networkidle0' }); await wait(2800);
  await p.screenshot({ path: out('landing-hero.png') });
  const scrollTo = (y) => p.evaluate((y) => { (window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y)); }, y);
  const at = (sel, frac, off = 0) => p.evaluate((sel, frac, off) => { const s = document.querySelector(sel); const r = s.getBoundingClientRect().top + scrollY; return frac == null ? r + off : r + (s.offsetHeight - innerHeight) * frac; }, sel, frac, off);
  const shoot = async (y, name, ms = 1600) => { await scrollTo(y); await wait(ms); await p.screenshot({ path: out(name) }); };
  await shoot(await at('.hero', 0.45), 'scroll-1.png');
  await shoot(await at('.flip-stage', 0.62), 'landing-flip.png');
  await shoot(await at('.flip-stage', 0.25), 'scroll-2.png');
  const howTop = await at('.how', null);
  await shoot(howTop + 40, 'landing-how.png');
  await shoot(howTop + 900, 'scroll-3.png');
  for (const name of ['modes', 'token', 'trust']) await shoot(await at('#' + name, null, name === 'token' ? 60 : -20), `landing-${name}.png`);
  await p.close();

  // game: three guesses on today's word
  p = await page(1440, 900);
  await p.goto(BASE + '/play', { waitUntil: 'networkidle0' }); await wait(1200);
  for (const g of ['crane', 'moist', answer]) { await p.keyboard.type(g, { delay: 40 }); await p.keyboard.press('Enter'); await wait(4500); }
  await wait(2500);
  await p.screenshot({ path: out('game-solved.png') });
  await p.keyboard.press('Escape');
  await p.evaluate(() => { document.getElementById('sheet').hidden = true; });
  await wait(300);
  await p.screenshot({ path: out('game-board.png') });
  await p.close();

  // mobile
  p = await page(390, 844, true);
  await p.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await wait(2600);
  await p.screenshot({ path: out('mobile.png') });
  await p.goto(BASE + '/play', { waitUntil: 'networkidle0' }); await wait(1500);
  await p.keyboard.type('crane', { delay: 40 }); await p.keyboard.press('Enter'); await wait(4500);
  await p.screenshot({ path: out('mobile-game.png') });
  await p.close();

  p = await page(1440, 900);
  await p.goto(BASE + '/round', { waitUntil: 'networkidle0' }); await wait(1800);
  await p.screenshot({ path: out('bounty.png') });
  await p.close();

  // per-mode UI shots for /docs + README
  const fs = require('fs');
  const both = (name) => fs.copyFileSync(out(name), path.join(__dirname, '..', 'public', 'img', 'docs', path.basename(name)));
  fs.copyFileSync(out('game-board.png'), out('img/ui-daily.png')); both('img/ui-daily.png');
  p = await page(1440, 900);
  await p.goto(BASE + '/play', { waitUntil: 'networkidle0' }); await wait(800);
  await p.evaluate(() => document.querySelector('[data-tab="bounty"]').click()); await wait(2200);
  await p.screenshot({ path: out('img/ui-bounty.png') }); both('img/ui-bounty.png');
  await p.screenshot({ path: out('bounty.png') });
  await p.evaluate(() => document.querySelector('[data-tab="duel"]').click()); await wait(1500);
  await p.screenshot({ path: out('img/ui-duel.png') }); both('img/ui-duel.png');
  await p.goto(BASE + '/docs', { waitUntil: 'networkidle0' }); await wait(1200);
  await p.screenshot({ path: out('docs-page.png') });
  await p.evaluate(() => window.scrollTo(0, document.getElementById('money').offsetTop - 80)); await wait(900);
  await p.screenshot({ path: out('docs-page-2.png') });
  await p.close();
  // nav logo close-up + the hero stamp landing
  p = await br.newPage(); await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 3 });
  await p.goto(BASE + '/', { waitUntil: 'networkidle0' }); await wait(2600);
  await p.screenshot({ path: out('logo-nav.png'), clip: { x: 30, y: 8, width: 200, height: 60 } });
  await p.close();
  p = await page(1440, 900);
  await p.goto(BASE + '/', { waitUntil: 'networkidle0' }); await wait(2600);
  for (const [frac, name] of [[0.62, 'hero-stamp-1.png'], [0.85, 'hero-stamp-2.png']]) {
    await p.evaluate((f) => { const s = document.querySelector('.hero'); const y = s.offsetTop + (s.offsetHeight - innerHeight) * f; window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y); }, frac);
    await wait(1600); await p.screenshot({ path: out(name) });
  }
  await p.close();

  if (errors.length) console.log('page errors:', errors);
  await br.close();
})();
