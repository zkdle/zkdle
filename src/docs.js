import { loadConfig, setupCopy, setupSound } from './shared.js';
setupCopy();
setupSound();
loadConfig();
const top = document.querySelector('.top');
addEventListener('scroll', () => top.classList.toggle('scrolled', scrollY > 40), { passive: true });
