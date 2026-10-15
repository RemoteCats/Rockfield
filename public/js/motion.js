/* ==========================================================================
   Motion for the public site.

   Everything here is decoration on top of pages that already work without it:
   with JavaScript off, or with reduced motion asked for, every element is
   simply where it belongs and every figure reads its real value.

   - Section content rises into place as it scrolls into view (the reveal
     machinery itself is ROCKFIELD.observeReveals in main.js; this file only
     decides what takes part).
   - Figures count up from zero the first time they are seen.
   - The nav takes a shadow once the page moves under it, and slims down.
   - The hero photograph drifts a little slower than the page.
   - A thin bar along the top fills as the page is read.
   - The phone and card on the home page lean towards the pointer.
   ========================================================================== */
(function () {
  'use strict';

  const RF = window.ROCKFIELD;
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- the nav: glass once scrolled; the reading bar ---- */
  const nav = document.querySelector('.rf-marketing-nav');
  let progress = null;
  if (!reduceMotion) {
    progress = document.createElement('div');
    progress.className = 'rf-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progress);
  }
  const hero = document.querySelector('.rf-hero');
  const heroPhoto = hero && hero.querySelector('.rf-hero-photo');
  let ticking = false;
  function frame() {
    ticking = false;
    const y = window.scrollY || 0;
    if (nav) nav.classList.toggle('is-scrolled', y > 8);
    if (progress) {
      const room = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.setProperty('--rf-progress', room > 0 ? Math.min(1, y / room).toFixed(4) : '0');
    }
    if (heroPhoto && !reduceMotion && y < window.innerHeight * 1.2) {
      heroPhoto.style.translate = `0 ${(y * 0.18).toFixed(1)}px`;
    }
  }
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(frame);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  frame();

  if (reduceMotion) return;
  document.documentElement.classList.add('rf-motion');

  /* ---- reveals ---- */
  const TARGETS = [
    '.rf-section .rf-eyebrow', '.rf-section h2', '.rf-section .section-lede',
    '.rf-section .rf-grid > *', '.rf-section blockquote', '.rf-section .rf-card',
    '.rf-section table', '.rf-section form', '.rf-cta .wrap > *', '.rf-trust-row > *',
  ].join(',');
  $$(TARGETS).forEach((el) => {
    // One reveal per branch: a card inside a revealing grid cell rides along
    // with its cell rather than arriving a second time.
    if (el.parentElement && el.parentElement.closest('[data-reveal]')) return;
    el.setAttribute('data-reveal', '');
  });
  if (RF && RF.observeReveals) RF.observeReveals();

  /* ---- count-up figures ----
     Only the first text node holding a number moves, so "4.35% APY" keeps
     its <small> and "$25.00" keeps its dollar sign. Values with a slash
     ("24 / 7") are left alone: they are not quantities. */
  const FIGURES = '.rf-hero-stats .v, .rf-trust .v, .rf-phone-balance, .rf-stat .v, .rf-product .rate, .rf-amt';
  const NUMBER = /^(\D*?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(.*)$/;

  function firstNumberNode(el) {
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walk.nextNode())) if (/\d/.test(node.nodeValue)) return node;
    return null;
  }

  function countUp(node) {
    const text = node.nodeValue;
    if (text.includes('/')) return;
    const m = text.trim().match(NUMBER);
    if (!m) return;
    const [, prefix, whole, frac = '', suffix] = m;
    const lead = text.slice(0, text.indexOf(text.trim()));
    const decimals = frac ? frac.length - 1 : 0;
    const target = parseFloat(whole.replace(/,/g, '') + frac);
    const commas = whole.includes(',');
    const fmt = (v) => {
      const s = v.toFixed(decimals);
      if (!commas) return s;
      const [w, f] = s.split('.');
      return w.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : '');
    };
    const start = performance.now();
    const DURATION = 1400;
    const step = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 4);
      node.nodeValue = lead + prefix + fmt(target * eased) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else node.nodeValue = text;
    };
    requestAnimationFrame(step);
  }

  /* ---- the phone stage leans towards the pointer ----
     Only for a real pointer: on a touch screen there is nothing to follow. */
  const stage = document.querySelector('.rf-device-stage');
  if (stage && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let raf = 0;
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        stage.style.setProperty('--tx', tx.toFixed(3));
        stage.style.setProperty('--ty', ty.toFixed(3));
        stage.classList.add('is-tilting');
      });
    });
    stage.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      stage.style.setProperty('--tx', '0');
      stage.style.setProperty('--ty', '0');
    });
  }

  if ('IntersectionObserver' in window) {
    const seen = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        seen.unobserve(e.target);
        const node = firstNumberNode(e.target);
        if (node) countUp(node);
      });
    }, { threshold: 0.4 });
    $$(FIGURES).forEach((el) => seen.observe(el));
  }

})();
