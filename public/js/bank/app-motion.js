/* Rockfield Global - motion for online banking and the sign-in pages.

   Decoration only, on top of screens that work without it. With reduced
   motion asked for, nothing here runs and every figure is simply its value.

   - Sign-in: the panel and the form rise in (rf-motion-auth on <html>).
   - Online banking: the page's blocks rise in once the session is confirmed
     (rf-app-motion on <html>; the CSS waits for rf-booting to go).
   - The dashboard's total counts up the first time it is filled in. Only that
     one: it has room to change width, where a tile's figure would make
     core.js refit its type on every frame. */
(function () {
  'use strict';

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var root = document.documentElement;
  var body = document.body;
  if (body.classList.contains('rf-auth')) root.classList.add('rf-motion-auth');
  if (!body.classList.contains('rf-app')) return;
  root.classList.add('rf-app-motion');

  var NUMBER = /^(\D*?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(.*)$/;

  function firstNumberNode(el) {
    var walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walk.nextNode())) if (/\d/.test(node.nodeValue)) return node;
    return null;
  }

  function countUp(node) {
    var text = node.nodeValue;
    var m = text.trim().match(NUMBER);
    if (!m) return;
    var prefix = m[1];
    var whole = m[2];
    var frac = m[3] || '';
    var suffix = m[4];
    var lead = text.slice(0, text.indexOf(text.trim()));
    var decimals = frac ? frac.length - 1 : 0;
    var target = parseFloat(whole.replace(/,/g, '') + frac);
    if (!(target > 0)) return;
    var fmt = function (v) {
      return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };
    var start = performance.now();
    var DURATION = 1100;
    var step = function (now) {
      // Somebody else rewrote it (a refresh): stop, theirs is the truth.
      if (node.nodeValue !== text && node.__rfLast !== node.nodeValue) return;
      var t = Math.min(1, (now - start) / DURATION);
      var eased = 1 - Math.pow(1 - t, 4);
      node.nodeValue = t < 1 ? lead + prefix + fmt(target * eased) + suffix : text;
      node.__rfLast = node.nodeValue;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  var total = document.querySelector('.hs-dash-hero .v');
  if (!total || !('MutationObserver' in window)) return;
  var watch = new MutationObserver(function () {
    var node = firstNumberNode(total);
    if (!node) return;
    watch.disconnect();
    countUp(node);
  });
  watch.observe(total, { childList: true, subtree: true, characterData: true });
  // Only the first fill counts; after that a changed figure is news, not
  // an entrance.
  setTimeout(function () { watch.disconnect(); }, 8000);
}());
