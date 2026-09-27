#!/usr/bin/env node
/* Regenerates the default PWA icons in frontend/public/pwa from the HM Panel logo. */
const path = require('path');
const fs = require('fs');
const sharp = require(path.join(__dirname, '..', 'frontend', 'node_modules', 'sharp'));

const root = path.join(__dirname, '..', 'frontend', 'public');
const logo = path.join(root, 'brand', 'hmpanel-logo.png');
const out = path.join(root, 'pwa');
fs.mkdirSync(out, { recursive: true });

function tile(size, { radius, transparentCorners }) {
  const r = Math.round(size * radius);
  const rect = transparentCorners
    ? `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#g)"/>`
    : `<rect width="${size}" height="${size}" fill="url(#g)"/>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#1e1b4b"/>
          <stop offset="1" stop-color="#09090b"/>
        </linearGradient>
        <radialGradient id="h" cx="0.3" cy="0.2" r="0.8">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.12"/>
          <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      ${rect}
      ${transparentCorners ? `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#h)"/>` : `<rect width="${size}" height="${size}" fill="url(#h)"/>`}
    </svg>`,
  );
}

async function render(file, size, { scale, radius = 0.225, transparentCorners = true }) {
  const inner = Math.round(size * scale);
  const mark = await sharp(logo).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const offset = Math.round((size - inner) / 2);
  await sharp(tile(size, { radius, transparentCorners }))
    .composite([{ input: mark, left: offset, top: offset }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, file));
  console.log('wrote', file);
}

(async () => {
  await render('icon-192.png', 192, { scale: 0.62 });
  await render('icon-512.png', 512, { scale: 0.62 });
  await render('maskable-512.png', 512, { scale: 0.5, transparentCorners: false });
  await render('apple-touch-180.png', 180, { scale: 0.64, transparentCorners: false });
})();
