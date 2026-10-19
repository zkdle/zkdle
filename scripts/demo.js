// Scroll-through recording of the landing page -> docs/scroll-demo.mp4 (needs npm run localnet on :5290).
const puppeteer = require('puppeteer-core');
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:5290';
const W = 1440, H = 900, FPS = 25, PX_PER_FRAME = +(process.env.PX || 34);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zkdemo-'));
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await br.newPage();
  await p.setViewport({ width: W, height: H });
  await p.goto(BASE + '/', { waitUntil: 'networkidle0' });
  let n = 0;
  const snap = async () => { await p.screenshot({ path: path.join(dir, `f${String(n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 82 }); };
  for (let i = 0; i < FPS * 2.5; i++) { await snap(); await wait(1000 / FPS); }     // intro
  const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let y = 0; y <= max; y += PX_PER_FRAME) {
    await p.evaluate((y) => window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y), y);
    await wait(30); await snap();
  }
  for (let i = 0; i < FPS * 1.5; i++) { await snap(); await wait(1000 / FPS); }
  await br.close();
  const out = path.join(__dirname, '..', 'docs', 'scroll-demo.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg'), '-vf', 'scale=1440:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  fs.rmSync(dir, { recursive: true });
  console.log(out, n, 'frames', (n / FPS).toFixed(1) + 's');
})();
