import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { clueOf, loadConfig, setupCopy, setupSound, short, solscan } from './shared.js';

gsap.registerPlugin(ScrollTrigger);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

setupCopy();
setupSound();

// ------------------------------------------------ split headings into masked words
function splitWords(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          const wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = part;
          w.append(wi); frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName === 'EM') {
        const w = document.createElement('span'); w.className = 'w';
        const wi = document.createElement('span'); wi.className = 'wi';
        n.replaceWith(w); wi.append(n); w.append(wi);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el);
  return $$('.wi', el);
}
const splits = $$('.split').map((el) => [el, splitWords(el)]);

// ------------------------------------------------ smooth scroll + header
let lenis;
if (!calm) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;
}
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const target = $(a.getAttribute('href')); if (!target) return;
  e.preventDefault(); lenis ? lenis.scrollTo(target, { offset: 0, duration: 1.6 }) : target.scrollIntoView();
}));
const top = $('.top');
let lastY = 0;
addEventListener('scroll', () => {
  const y = scrollY;
  top.classList.toggle('scrolled', y > 40);
  top.classList.toggle('hide', y > 600 && y > lastY + 4);
  if (y < lastY - 4) top.classList.remove('hide');
  lastY = y;
}, { passive: true });

if (!calm) {
  // ---------------------------------------------- background parallax
  gsap.to('.bg-seal.s-a', { yPercent: -60, rotation: 140, ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1 } });
  gsap.to('.bg-seal.s-b', { yPercent: -260, rotation: -120, ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1 } });
  gsap.to('.bg-grid', { yPercent: -8, ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: true } });
  gsap.to('.bg-mesh', { yPercent: -12, ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: true } });

  // ---------------------------------------------- hero intro
  const heroWords = splits.find(([el]) => el.classList.contains('hero-title'))[1];
  const intro = gsap.timeline({ delay: 0.15 });
  intro.from(heroWords, { yPercent: 115, rotate: 4, duration: 1.15, stagger: 0.07, ease: 'expo.out' })
    .from('.hero-meta > *', { opacity: 0, y: 10, stagger: 0.05, duration: 0.6 }, 0.2)
    .from('.ht', { y: 120, opacity: 0, rotation: () => gsap.utils.random(-25, 25), stagger: 0.07, duration: 1, ease: 'expo.out' }, 0.35)
    .from('.hero-foot > *, .hero-proof', { y: 30, opacity: 0, stagger: 0.1, duration: 0.9, ease: 'power3.out' }, 0.6);

  // ---------------------------------------------- hero pinned scrub: tiles flip, hash scrambles, seal stamps
  const hashEl = $('.hash-run'), hex = '0123456789abcdef';
  const htl = gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: 0.7,
    onUpdate: (st) => { if (st.progress < 0.62) hashEl.textContent = '0x' + Array.from({ length: 4 }, () => hex[(Math.random() * 16) | 0]).join('') + '…' + Array.from({ length: 4 }, () => hex[(Math.random() * 16) | 0]).join(''); else hashEl.textContent = '0x1d4f…a07c'; } } });
  htl.to('.hero-title', { yPercent: -10, ease: 'none', duration: 1 }, 0)
    .to('.ht .card', { rotateX: 180, stagger: 0.12, duration: 0.35, ease: 'power2.inOut' }, 0.1)
    .to('.ht', { y: (i) => [-10, 6, -4, 10, -6][i], duration: 0.3 }, 0.1)
    .fromTo('.hero-seal', { opacity: 0, scale: 3.4, rotation: -70 }, { opacity: 1, scale: 1, rotation: -12, duration: 0.25, ease: 'expo.in' }, 0.75)
    .to('.hero-tiles', { x: 4, yoyo: true, repeat: 3, duration: 0.02 }, 1.0)
    .to('.hero-foot', { opacity: 0.25, y: -20, duration: 0.3 }, 0.95)
    .to('.scroll-hint', { opacity: 0, duration: 0.1 }, 0);

  // ---------------------------------------------- marquee, velocity aware
  const mq = $('.mq-track');
  const loop = gsap.to(mq, { xPercent: -50, ease: 'none', duration: 28, repeat: -1 });
  ScrollTrigger.create({ trigger: '.marquee', start: 'top bottom', end: 'bottom top', onUpdate: (st) => {
    const v = gsap.utils.clamp(-6, 6, st.getVelocity() / 300);
    gsap.to(loop, { timeScale: 1 + Math.abs(v), duration: 0.2, overwrite: true });
    gsap.to(loop, { timeScale: 1, duration: 1.2, delay: 0.2 });
  } });
  gsap.fromTo('.marquee', { rotate: -5 }, { rotate: 2, ease: 'none', scrollTrigger: { trigger: '.marquee', start: 'top bottom', end: 'bottom top', scrub: true } });
}

// ------------------------------------------------ the pinned board: letters fly in and flip
const ANSWER = 'proof';
const GUESSES = ['crane', 'moist', 'proud', 'proof'];
const board = $('#demo-board'), proofs = $('#proof-col');
board.innerHTML = Array.from({ length: 6 }, (_, r) => `<div class="row">${Array.from({ length: 5 }, (_, i) => {
  const g = GUESSES[r], cl = g ? clueOf(ANSWER, g)[i] : 0;
  return `<div class="tile"><div class="card"><div class="f">${g ? g[i] : ''}</div><div class="k c${cl}">${g ? g[i] : ''}</div></div></div>`;
}).join('')}</div>`).join('');
proofs.innerHTML = Array.from({ length: 6 }, (_, r) => `<span>${r < GUESSES.length ? 'ZK verified' : ''}</span>`).join('');
const rows = $$('.row', board);
if (calm) {
  rows.slice(0, GUESSES.length).forEach((row, r) => { $$('.card', row).forEach((c) => (c.style.transform = 'rotateX(180deg)')); proofs.children[r].style.opacity = 1; });
} else {
  gsap.set($$('.tile', board), { opacity: 0, y: () => gsap.utils.random(-300, 300), x: () => gsap.utils.random(-260, 260), rotation: () => gsap.utils.random(-80, 80), scale: 0.6 });
  gsap.set($$('.f', board), { color: 'transparent' });
  const tl = gsap.timeline({ scrollTrigger: { trigger: '.flip-stage', start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
  tl.to($$('.tile', board), { opacity: 1, x: 0, y: 0, rotation: 0, scale: 1, stagger: { each: 0.012, from: 'random' }, duration: 0.5, ease: 'power3.out' });
  GUESSES.forEach((g, r) => {
    const fronts = $$('.f', rows[r]), cards = $$('.card', rows[r]);
    tl.to(fronts, { color: '#22304a', stagger: 0.05, duration: 0.05 }, '+=0.15')
      .to(fronts, { scale: 1.08, yoyo: true, repeat: 1, stagger: 0.05, duration: 0.06 }, '<')
      .to(cards, { rotateX: 180, stagger: 0.08, duration: 0.3, ease: 'power2.inOut' }, '+=0.05')
      .fromTo(proofs.children[r], { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.15 });
    if (r === 1) tl.to('.flip-lines .a', { opacity: 0, y: -30, duration: 0.2 }, '<').fromTo('.flip-lines .b', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.2 }, '<0.1');
  });
  tl.fromTo('.seal-drop', { opacity: 0, scale: 3.2, rotation: -60 }, { opacity: 1, scale: 1, rotation: -12, duration: 0.35, ease: 'expo.in' }, '+=0.2')
    .to('.board-wrap', { x: 3, yoyo: true, repeat: 3, duration: 0.03 })
    .to(rows[3], { y: -6, duration: 0.15, yoyo: true, repeat: 1 })
    .to('.meter span', { width: '100%', duration: tl.duration(), ease: 'none' }, 0);
}

if (!calm) {
  // ---------------------------------------------- word reveals for section headings
  splits.forEach(([el, words]) => {
    if (el.classList.contains('hero-title')) return;
    gsap.from(words, { yPercent: 115, rotate: 3, duration: 1.1, stagger: 0.05, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
  });
  $$('.eyebrow-l').forEach((e) => gsap.from(e, { opacity: 0, x: -20, duration: 0.8, scrollTrigger: { trigger: e, start: 'top 90%' } }));

  // ---------------------------------------------- HOW: pinned horizontal sequence
  const track = $('.how-track');
  const dist = () => Math.max(0, track.scrollWidth - innerWidth);
  const htrack = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '.how', start: 'top top', end: () => '+=' + (dist() + innerHeight * 0.4), pin: '.how-pin', scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1 } });
  gsap.to('.how-progress span', { width: '100%', ease: 'none', scrollTrigger: { trigger: '.how', start: 'top top', end: () => '+=' + (dist() + innerHeight * 0.4), scrub: true, invalidateOnRefresh: true } });
  $$('.panel').forEach((p) => {
    gsap.from($('.big-num', p), { yPercent: 60, opacity: 0, ease: 'none', scrollTrigger: { trigger: p, containerAnimation: htrack, start: 'left 95%', end: 'left 45%', scrub: true } });
    gsap.from($('.panel-body', p), { y: 50, opacity: 0, ease: 'none', scrollTrigger: { trigger: p, containerAnimation: htrack, start: 'left 85%', end: 'left 40%', scrub: true } });
    gsap.fromTo($('.panel-art', p), { rotation: -40, scale: 0.7 }, { rotation: 20, scale: 1, ease: 'none', scrollTrigger: { trigger: p, containerAnimation: htrack, start: 'left right', end: 'right left', scrub: true } });
  });
  gsap.from('.tiles-art i', { rotateX: -180, opacity: 0, stagger: 0.1, scrollTrigger: { trigger: '.panel:nth-child(2)', containerAnimation: htrack, start: 'left 70%', end: 'left 30%', scrub: true } });
  gsap.fromTo('.broken img + img', { x: 0, rotation: 0 }, { x: 34, y: 12, rotation: 18, scrollTrigger: { trigger: '.panel:nth-child(3)', containerAnimation: htrack, start: 'left 60%', end: 'left 20%', scrub: true } });

  // ---------------------------------------------- counters
  $$('[data-count]').forEach((b) => {
    const n = +b.dataset.count, suf = b.dataset.suffix || '', o = { v: 0 };
    gsap.to(o, { v: n, duration: 1.8, ease: 'expo.out', onUpdate: () => (b.textContent = Math.round(o.v) + suf), scrollTrigger: { trigger: b, start: 'top 88%' } });
  });
  gsap.from('.num', { y: 40, opacity: 0, stagger: 0.1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.numbers', start: 'top 80%' } });

  // ---------------------------------------------- modes list
  $$('.mode').forEach((m) => {
    gsap.from(m, { y: 70, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: m, start: 'top 90%' } });
    gsap.from($$('.m-tiles i', m), { rotateY: 180, scale: 0.4, opacity: 0, stagger: 0.08, duration: 0.7, ease: 'back.out(2)', scrollTrigger: { trigger: m, start: 'top 75%' } });
  });

  // ---------------------------------------------- split ribbons
  $$('.ribbon').forEach((r, i) => gsap.from(r, { scaleX: 0, ease: 'power3.out', scrollTrigger: { trigger: '.ribbons', start: `top ${85 - i * 6}%`, end: `top ${50 - i * 6}%`, scrub: true } }));

  // ---------------------------------------------- token
  gsap.from('.token-inner', { y: 120, scale: 0.94, opacity: 0.4, ease: 'none', scrollTrigger: { trigger: '.token', start: 'top bottom', end: 'top 30%', scrub: true } });
  const mt = gsap.timeline({ scrollTrigger: { trigger: '.token', start: 'top bottom', end: 'center 45%', scrub: 1.2 } });
  mt.fromTo('.medal', { rotateX: 28, rotateY: -32, rotateZ: -10, scale: 1.12 }, { rotateX: 0, rotateY: 0, rotateZ: -4, scale: 1, ease: 'power2.out', duration: 1 }, 0)
    .to('.medal', { scale: 0.97, duration: 0.12, ease: 'power2.in' }).to('.medal', { scale: 1, duration: 0.2, ease: 'power2.out' });
  gsap.to('.coin', { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '.token', start: 'top bottom', end: 'bottom top', scrub: true } });
  $$('.utility li').forEach((li) => gsap.from(li, { x: 40, opacity: 0, scrollTrigger: { trigger: li, start: 'top 94%', end: 'top 74%', scrub: true } }));

  // ---------------------------------------------- trust + final
  $$('.col li').forEach((li) => gsap.from(li, { opacity: 0, y: 18, scrollTrigger: { trigger: li, start: 'top 95%', end: 'top 80%', scrub: true } }));
  gsap.fromTo('.final-seal', { rotation: -90, scale: 0.6 }, { rotation: 30, scale: 1.1, ease: 'none', scrollTrigger: { trigger: '.final', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.final .btn', { y: 30, opacity: 0, duration: 0.9, scrollTrigger: { trigger: '.final .btn', start: 'top 92%' } });
  gsap.from('.foot-big', { yPercent: 40, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

// ------------------------------------------------ config-driven bits
loadConfig().then((c) => {
  const t = c.token || {};
  if (t.name) $('.tk-name').textContent = t.name;
  if (t.symbol) $('.tk-sym').textContent = '$' + t.symbol;
  if (t.mint) $('.ca').innerHTML = `<a href="${solscan(t.mint, c.cluster).replace('/account/', '/token/')}" target="_blank" rel="noopener">${t.mint}</a>`;
  if (c.treasury) $('.treasury').innerHTML = `<a href="${solscan(c.treasury, c.cluster)}" target="_blank" rel="noopener">${short(c.treasury)}</a> · Solscan ↗`;
  $('.net').textContent = c.network ? `network: ${c.network}` : '';
  if (c.preview) {
    const bar = document.createElement('div');
    bar.className = 'preview-bar';
    bar.innerHTML = `<b>Preview</b> · games and $PROOF open soon · follow <a href="${c.links?.x || 'https://x.com/zkdlefun'}" target="_blank" rel="noopener">@zkdlefun</a>`;
    document.body.append(bar);
  }
});
