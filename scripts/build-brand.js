'use strict';

/**
 * Build every brand asset from src/bank/site/logo.js.
 *
 *   npm run build:brand
 *
 * Writes:
 *
 *   assets/bank/logo-light.png      ROCKFIELD / GLOBAL BANK / the key, in white, for navy grounds
 *   assets/bank/logo-dark.png       the same in navy, for paper
 *   assets/bank/logomark-light.png  the R alone, white
 *   assets/bank/logomark-dark.png   the R alone, navy
 *   assets/bank/icon-512.png        a white R on the navy
 *   favicon.png, apple-touch-icon.png, favicon.ico (16, 32, 48)
 *   assets/bank/og-image.png        the link card: the lockup on its navy
 *
 * Rendered in Chromium through playwright-core - already a dev dependency for
 * the browser tests - with the site's own self-hosted Playfair Display and
 * Jost, so the logo is set in exactly the type the pages use. Not part of
 * `npm run build`: the outputs are committed.
 */

const fs = require('fs');
const path = require('path');
const { NAVY, lockupHtml, markHtml, iconHtml } = require('../src/bank/site/logo');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const BRAND = path.join(PUBLIC, 'assets', 'bank');
const FONTS = path.join(PUBLIC, 'assets', 'fonts');

let chromium;
try {
  ({ chromium } = require('playwright-core'));
} catch (err) {
  console.error('[brand] needs playwright-core: npm i -D playwright-core');
  process.exit(1);
}

function browserPath() {
  return [
    process.env.CHROME_PATH,
    '/opt/pw-browsers/chromium',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ].filter(Boolean).find((candidate) => {
    try { return fs.existsSync(candidate); } catch (err) { return false; }
  });
}

/** The faces the artwork uses, inlined so the page needs no server. */
const face = (family, weight, file) =>
  `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(FONTS, file)).toString('base64')}) format('woff2')}`;
const FACES = [
  face('Playfair Display', '400 900', 'playfair-display-500-latin.woff2'),
  face('Jost', '100 900', 'jost-300-latin.woff2'),
].join('\n');

const doc = (body, background = 'transparent') => `<!doctype html><html><head><meta charset="utf-8"><style>
${FACES}
html,body{margin:0;padding:0;background:${background}}
#art{display:inline-flex;vertical-align:top}
</style></head><body><div id="art">${body}</div></body></html>`;

/**
 * Render a fragment and screenshot it, transparent unless it paints a ground.
 * Any key in it is sized to 46% of the wordmark's width first, the proportion
 * the supplied artwork has.
 */
async function render(page, body, { background } = {}) {
  await page.setContent(doc(body, background), { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelectorAll('.lockup').forEach((lockup) => {
      const word = lockup.querySelector('[data-word]');
      const key = lockup.querySelector('[data-key] svg');
      if (word && key) key.style.width = `${Math.round(word.getBoundingClientRect().width * 0.46)}px`;
    });
  });
  const art = await page.$('#art');
  return art.screenshot({ omitBackground: !background });
}

function write(file, buffer) {
  fs.writeFileSync(file, buffer);
  console.log(`  wrote ${path.relative(PUBLIC, file)} (${(buffer.length / 1024).toFixed(1)}kB)`);
}

/** An .ico holding PNG images: a six-byte header, a 16-byte entry per image, the images. */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

(async () => {
  const executablePath = browserPath();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 }, deviceScaleFactor: 1 });
  console.log('[brand] rendering from src/bank/site/logo.js');

  // Lockups at about the resolution of the largest place they appear, twice over.
  write(path.join(BRAND, 'logo-light.png'), await render(page, lockupHtml({ colour: '#ffffff', size: 78 })));
  write(path.join(BRAND, 'logo-dark.png'), await render(page, lockupHtml({ colour: NAVY, size: 78 })));
  write(path.join(BRAND, 'logomark-light.png'), await render(page, markHtml({ colour: '#ffffff', size: 80 })));
  write(path.join(BRAND, 'logomark-dark.png'), await render(page, markHtml({ colour: NAVY, size: 80 })));

  const icon = async (size) => render(page, iconHtml(size));
  const icon512 = await icon(512);
  write(path.join(BRAND, 'icon-512.png'), icon512);
  write(path.join(PUBLIC, 'favicon.png'), icon512);
  write(path.join(PUBLIC, 'apple-touch-icon.png'), await icon(180));
  const pngs = [];
  for (const size of [16, 32, 48]) pngs.push({ size, data: await icon(size) });
  write(path.join(PUBLIC, 'favicon.ico'), ico(pngs));

  // The link card: the lockup on its navy.
  await page.setViewportSize({ width: 1200, height: 630 });
  const card = `<div style="width:1200px;height:630px;background:${NAVY};display:flex;align-items:center;justify-content:center">${lockupHtml({ colour: '#ffffff', size: 92 })}</div>`;
  write(path.join(BRAND, 'og-image.png'), await render(page, card, { background: NAVY }));

  await browser.close();
  console.log('[brand] done');
})().catch((err) => {
  console.error('[brand] failed:', err);
  process.exit(1);
});
