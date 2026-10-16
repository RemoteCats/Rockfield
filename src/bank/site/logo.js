'use strict';

/**
 * The Rockfield logo, as type and line work.
 *
 * ROCKFIELD in a roman serif, GLOBAL BANK spaced wide beneath it in a light
 * geometric sans, and a drawn key under both: white on the bank's navy
 * (#12477f), or navy on paper. The monogram - for the sidebar, the favicon
 * and the app icon - is the R from the wordmark on its own.
 *
 * scripts/build-brand.js renders every logo file from these functions in
 * Chromium, with the site's own self-hosted Playfair Display and Jost, so
 * changing the logo is an edit here and `npm run build:brand`.
 */

const NAVY = '#12477f';
const SILVER = '#a9b9cf';
/** The key is gold on both grounds: a little deeper on paper, so it holds against white. */
const GOLD_ON_NAVY = '#d6b25e';
const GOLD_ON_PAPER = '#b38a35';

/**
 * The key under the wordmark, drawn in fine lines to sit with GLOBAL BANK.
 * A ring holding a four-petal flower with a three-leaf finial, a collar with
 * scrolls either side, a sprig of leaves on the shaft, and a plain notched
 * bit. On a 300 x 60 grid.
 */
const keySvg = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 60" overflow="visible" fill="none" stroke="${c}" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="30" cy="30" r="21" stroke-width="2"/>
  <circle cx="30" cy="30" r="17.5" stroke-width="0.9" opacity=".75"/>
  <g stroke-width="1.5">
    <path d="M30 30 C25 24, 25 17, 30 13.5 C35 17, 35 24, 30 30 Z"/>
    <path d="M30 30 C25 36, 25 43, 30 46.5 C35 43, 35 36, 30 30 Z"/>
    <path d="M30 30 C24 25, 17 25, 13.5 30 C17 35, 24 35, 30 30 Z"/>
    <path d="M30 30 C36 25, 43 25, 46.5 30 C43 35, 36 35, 30 30 Z"/>
  </g>
  <g stroke-width="1" opacity=".85">
    <path d="M30 30 L21 21 M30 30 L39 21 M30 30 L21 39 M30 30 L39 39"/>
  </g>
  <circle cx="30" cy="30" r="2.6" fill="${c}" stroke="none"/>
  <circle cx="21.2" cy="21.2" r="1.3" fill="${c}" stroke="none"/><circle cx="38.8" cy="21.2" r="1.3" fill="${c}" stroke="none"/>
  <circle cx="21.2" cy="38.8" r="1.3" fill="${c}" stroke="none"/><circle cx="38.8" cy="38.8" r="1.3" fill="${c}" stroke="none"/>
  <g stroke-width="1.1" fill="${c}" fill-opacity=".9">
    <path d="M9 30 C5 27, 2.5 27.5, 1.5 30 C2.5 32.5, 5 33, 9 30 Z"/>
    <path d="M10.5 24.5 C7.5 20.5, 5 19.5, 3.5 21 C4 24, 6.5 25.5, 10.5 24.5 Z"/>
    <path d="M10.5 35.5 C7.5 39.5, 5 40.5, 3.5 39 C4 36, 6.5 34.5, 10.5 35.5 Z"/>
  </g>
  <path d="M51 30 H58" stroke-width="2"/>
  <path d="M58 23.5 V36.5 M63 25.5 V34.5" stroke-width="1.6"/>
  <path d="M60.5 30 L63 27.5 L65.5 30 L63 32.5 Z" stroke-width="1" fill="${c}"/>
  <g stroke-width="1.1">
    <path d="M66 30 C68 23, 74 22, 75 25.5 C75.6 27.6, 73 28.6, 71.8 27"/>
    <path d="M66 30 C68 37, 74 38, 75 34.5 C75.6 32.4, 73 31.4, 71.8 33"/>
  </g>
  <path d="M63 30 H284" stroke-width="2"/>
  <g stroke-width="1.2">
    <path d="M84 30 C90 22, 99 20, 104 22 C99 25, 92 27, 84 30 Z" fill="${c}" fill-opacity=".9"/>
    <path d="M96 30 C102 38, 111 40, 116 38 C111 35, 104 33, 96 30 Z" fill="${c}" fill-opacity=".9"/>
    <path d="M108 30 C113 24, 120 23, 124 24.5 C120 27, 114 28.5, 108 30 Z" fill="${c}" fill-opacity=".9"/>
  </g>
  <path d="M244 30 V44 H252 V38 H260 V46 H268 V38 H276 V44 H284 V30" stroke-width="2"/>
  <circle cx="287" cy="30" r="2.4" stroke-width="1.6"/>
</svg>`;

/**
 * The full lockup as an HTML fragment: ROCKFIELD, GLOBAL BANK, the key.
 *
 * `size` is the cap height of ROCKFIELD in pixels; everything else is in
 * proportion to it, as the supplied artwork has it: the second line about a
 * third of the first, tracked out to two thirds of its width, and
 * the key a little under half the width of the wordmark.
 */
function lockupHtml({ colour = '#ffffff', size = 100, keyColour } = {}) {
  const key = keyColour || (colour.toLowerCase() === '#ffffff' ? GOLD_ON_NAVY : GOLD_ON_PAPER);
  const word = Math.round(size / 0.708);      // Playfair's caps are 0.708 em tall
  const sub = Math.round(size * 0.47);
  return `<div class="lockup" style="display:inline-flex;flex-direction:column;align-items:center;padding:${Math.round(size * 0.05)}px ${Math.round(size * 0.1)}px ${Math.round(size * 0.1)}px;color:${colour}">
  <span data-word style="display:block;font:600 ${word}px/1 'Playfair Display',Georgia,serif;letter-spacing:.115em;margin-right:-.115em;white-space:nowrap">ROCKFIELD</span>
  <span data-sub style="display:block;font:400 ${sub}px/1 'Jost',sans-serif;letter-spacing:.43em;margin:${Math.round(size * 0.34)}px -.43em 0 0;white-space:nowrap">GLOBAL BANK</span>
  <span data-key style="display:block;margin-top:${Math.round(size * 0.26)}px">${keySvg(key)}</span>
</div>`;
}

/** The monogram: the R from the wordmark, alone. */
function markHtml({ colour = NAVY, size = 100 } = {}) {
  return `<div class="mark" style="display:inline-block;padding:0 ${Math.round(size * 0.04)}px;font:600 ${Math.round(size / 0.708)}px/0.78 'Playfair Display',Georgia,serif;color:${colour}">R</div>`;
}

/** The icon: a white R on the navy, as the app icon and favicon. */
function iconHtml(size) {
  return `<div style="width:${size}px;height:${size}px;background:${NAVY};border-radius:${Math.round(size * 0.2)}px;
    display:flex;align-items:center;justify-content:center;color:#fff;box-sizing:border-box;padding-bottom:${Math.round(size * 0.05)}px;
    font:600 ${Math.round(size * 0.72)}px/1 'Playfair Display',Georgia,serif">R</div>`;
}

module.exports = { NAVY, SILVER, GOLD_ON_NAVY, GOLD_ON_PAPER, keySvg, lockupHtml, markHtml, iconHtml };
