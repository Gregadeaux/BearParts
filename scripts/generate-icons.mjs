/* Generates PWA icons from an inline SVG. Run: node scripts/generate-icons.mjs */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const bearIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1c1917"/>
  <!-- gear ring -->
  <g fill="none" stroke="#f59e0b" stroke-width="26">
    <circle cx="256" cy="256" r="168"/>
  </g>
  <g fill="#f59e0b">
    ${Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      const x = 256 + 168 * Math.cos(a);
      const y = 256 + 168 * Math.sin(a);
      return `<rect x="${x - 22}" y="${y - 22}" width="44" height="44" rx="10" transform="rotate(${(a * 180) / Math.PI} ${x} ${y})"/>`;
    }).join("")}
  </g>
  <!-- bear head -->
  <g fill="#a16207">
    <circle cx="184" cy="196" r="44"/>
    <circle cx="328" cy="196" r="44"/>
    <circle cx="256" cy="268" r="104"/>
  </g>
  <g fill="#78350f">
    <circle cx="184" cy="196" r="22"/>
    <circle cx="328" cy="196" r="22"/>
  </g>
  <!-- muzzle -->
  <ellipse cx="256" cy="304" rx="56" ry="44" fill="#fbbf24"/>
  <ellipse cx="256" cy="292" rx="20" ry="14" fill="#1c1917"/>
  <path d="M256 306 v18 M256 324 q-16 16 -34 6 M256 324 q16 16 34 6" stroke="#1c1917" stroke-width="8" fill="none" stroke-linecap="round"/>
  <!-- eyes -->
  <circle cx="216" cy="248" r="12" fill="#1c1917"/>
  <circle cx="296" cy="248" r="12" fill="#1c1917"/>
</svg>`;

const badge = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">
  <g fill="#ffffff">
    <circle cx="24" cy="24" r="10"/>
    <circle cx="48" cy="24" r="10"/>
    <circle cx="36" cy="40" r="22"/>
  </g>
</svg>`;

await mkdir("public/icons", { recursive: true });
const src = Buffer.from(bearIcon);
await sharp(src).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(src).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(src).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");
await sharp(Buffer.from(badge)).resize(72, 72).png().toFile("public/icons/badge-72.png");
console.log("icons written to public/icons/");
