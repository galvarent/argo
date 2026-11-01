// Genera le icone PNG di ARGO dal nucleo di particelle (eseguito in build su Vercel).
import sharp from "sharp";
import { mkdirSync } from "node:fs";

function svg(size, pad = 0) {
  const c = size / 2, R = size * 0.30 * (1 - pad);
  const n = 420, ga = Math.PI * (3 - Math.sqrt(5));
  let dots = "";
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), th = ga * i;
    const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
    const x1 = x * Math.cos(0.6) - z * Math.sin(0.6), z1 = x * Math.sin(0.6) + z * Math.cos(0.6);
    const y1 = y * Math.cos(0.35) - z1 * Math.sin(0.35), z2 = y * Math.sin(0.35) + z1 * Math.cos(0.35);
    const ps = 1.9 / (2.6 - z2), d = (z2 + 1) / 2;
    const r = size * 0.004 * (0.6 + d * 1.5), a = (0.15 + d * 0.8).toFixed(2);
    dots += `<circle cx="${(c + x1 * R * ps).toFixed(1)}" cy="${(c + y1 * R * ps).toFixed(1)}" r="${r.toFixed(2)}" fill="#8cecff" fill-opacity="${a}"/>`;
  }
  const arc = (k, w, op) => {
    const r = R * k, a0 = (200 * Math.PI) / 180, a1 = (470 * Math.PI) / 180;
    const p = (a) => `${(c + r * Math.cos(a)).toFixed(1)} ${(c + r * Math.sin(a)).toFixed(1)}`;
    return `<path d="M ${p(a0)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${p(a1)}" fill="none" stroke="#5fe3ff" stroke-opacity="${op}" stroke-width="${(size * w).toFixed(1)}"/>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs><radialGradient id="g"><stop offset="0" stop-color="#5fe3ff" stop-opacity=".28"/><stop offset="1" stop-color="#5fe3ff" stop-opacity="0"/></radialGradient></defs>
<rect width="100%" height="100%" fill="#03070c"/><circle cx="${c}" cy="${c}" r="${R * 1.35}" fill="url(#g)"/>
${arc(1.45, 0.010, 0.75)}${arc(1.25, 0.006, 0.7)}${dots}</svg>`;
}

mkdirSync("public", { recursive: true });
const out = [["public/icon-192.png", 192, 0], ["public/icon-512.png", 512, 0.15], ["public/apple-touch-icon.png", 180, 0]];
for (const [file, size, pad] of out) await sharp(Buffer.from(svg(size, pad))).png().toFile(file);
console.log("Icone ARGO generate");
