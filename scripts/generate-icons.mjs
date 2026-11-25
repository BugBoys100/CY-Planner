// Génère les icônes PWA (PNG) à partir d'un SVG, via sharp.
import sharp from "sharp";
import fs from "node:fs";

const svg = (pad = 0, rounded = true) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#4338ca"/></linearGradient></defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#g)"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})">
    <path d="M256 128 76 206l180 78 180-78z" fill="#fff"/>
    <path d="M150 248v74c0 34 48 62 106 62s106-28 106-62v-74l-106 46z" fill="#fff" opacity=".92"/>
    <path d="M420 214v96" stroke="#fff" stroke-width="16" stroke-linecap="round"/>
    <circle cx="420" cy="322" r="16" fill="#fbbf24"/>
  </g>
</svg>`;

const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path d="M256 108 46 200l210 92 210-92z" fill="#fff"/>
  <path d="M136 256v86c0 40 54 72 120 72s120-32 120-72v-86l-120 54z" fill="#fff"/></svg>`;

fs.mkdirSync("public/icons", { recursive: true });
const out = [
  ["icon-192.png", svg(0), 192],
  ["icon-512.png", svg(0), 512],
  ["maskable-512.png", svg(70, false), 512],
  ["apple-touch-icon.png", svg(30, false), 180],
  ["badge-72.png", badge, 72],
];
for (const [name, src, size] of out) {
  await sharp(Buffer.from(src)).resize(size, size).png().toFile(`public/icons/${name}`);
  console.log("✔", name);
}
await sharp(Buffer.from(svg(0))).resize(48, 48).png().toFile("app/icon.png");
console.log("✔ app/icon.png (favicon)");
