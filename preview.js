// ZKdle preview server (ZK_PREVIEW unset or 1): landing page and /docs only. No RPC, no keys, no wallet, no transactions.
const express = require('express');
const path = require('path');
const pub = path.join(__dirname, 'public');
const links = { x: process.env.ZK_X_URL || 'https://x.com/zkdlefun', github: process.env.ZK_GITHUB_URL || 'https://github.com/zkdle/zkdle' };
const app = express();
app.disable('x-powered-by');
app.use(require('compression')());
app.use((req, res, next) => { res.set({ 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' }); next(); });
app.get('/api/config', (req, res) => res.json({ preview: true, links, token: { mint: null, symbol: 'PROOF', name: 'ZKdle Proof' } }));
const soon = (req, res) => res.status(503).json({ error: 'ZKdle is in preview. Games open soon.' });
app.use(['/api', '/og', '/actions.json'], soon);
app.get(['/play', '/duel', '/round', '/duel/:id', '/round/:id', '/s/:id', '/play.html'], (req, res) => res.sendFile(path.join(pub, 'soon.html')));
app.get('/docs', (req, res) => res.sendFile(path.join(pub, 'docs.html')));
app.get('/healthz', (req, res) => res.send('ok'));
app.use(express.static(pub, { extensions: ['html'], maxAge: 0, setHeaders: (res) => res.set('cache-control', 'no-cache') }));
app.listen(Number(process.env.PORT || 5290), () => console.log(`zkdle preview on :${process.env.PORT || 5290}`));
