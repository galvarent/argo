// galvarent-social – /api/reel?p=<id post>
// Monta le slide del post in un video verticale 1080x1920 (9:16) per i reel di Instagram:
// una scena per slide, tempo di lettura in base alla lunghezza del testo, transizioni morbide.
// Il video è muto: Andrea lo scarica e lo pubblica dall'app con un audio di tendenza.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { disegna, leggi } = require('./slide.js');

const FPS = 25;
const DISSOLVENZA = 0.4;
const TRANSIZIONI = ['slideup', 'fade', 'slideleft', 'fade', 'slideup', 'fade', 'slideleft', 'fade', 'slideup'];

// Secondi per leggere una scena: base più un tempo per parola, entro limiti ragionevoli.
function durata(s) {
  const parole = [s.etichetta, s.titolo, s.testo, s.numero, s.verdetto, ...(s.punti || [])].filter(Boolean).join(' ').split(/\s+/).length;
  return Math.min(5, Math.max(2.2, 1 + parole * 0.24));
}

function esegui(bin, args) {
  return new Promise((ok, ko) => execFile(bin, args, { maxBuffer: 1 << 24 }, (err, _o, stderr) => (err ? ko(new Error(String(stderr).slice(-800))) : ok())));
}

async function monta(dati) {
  const ffmpeg = require('ffmpeg-static');
  const slides = (dati.slides || []).slice(0, 8);
  if (!slides.length) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
  try {
    const sharp = require('sharp');
    // JPEG invece di PNG: ffmpeg lo decodifica molto più in fretta a ogni fotogramma.
    const png = await Promise.all(slides.map(async (_, i) => sharp(await disegna(dati, i + 1, 'reel')).resize(1080, 1920, { fit: 'fill' }).jpeg({ quality: 92 }).toBuffer()));
    const tempi = slides.map(durata);
    tempi[tempi.length - 1] += 1; // l'ultima scena (cta) resta un po' di più
    const args = ['-y'];
    png.forEach((buf, i) => {
      const f = path.join(dir, `s${i}.jpg`);
      fs.writeFileSync(f, buf);
      args.push('-loop', '1', '-framerate', String(FPS), '-t', (tempi[i] + DISSOLVENZA).toFixed(2), '-i', f);
    });
    // Catena di xfade: ogni scena entra mentre la precedente esce.
    const filtri = png.map((_, i) => `[${i}:v]format=yuv420p,settb=AVTB[i${i}]`);
    let prec = '[i0]';
    let fine = tempi[0];
    for (let i = 1; i < png.length; i++) {
      const out = `[v${i}]`;
      filtri.push(`${prec}[i${i}]xfade=transition=${TRANSIZIONI[(i - 1) % TRANSIZIONI.length]}:duration=${DISSOLVENZA}:offset=${fine.toFixed(2)}${out}`);
      prec = out;
      fine += tempi[i];
    }
    filtri.push(`${prec}format=yuv420p[v]`);
    const out = path.join(dir, 'reel.mp4');
    args.push('-filter_complex', filtri.join(';'), '-map', '[v]', '-r', String(FPS),
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-t', (fine + DISSOLVENZA).toFixed(2), out);
    await esegui(ffmpeg, args);
    return fs.readFileSync(out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const id = url.searchParams.get('p') || '';
    const dati = /^[0-9a-f-]{36}$/i.test(id) ? await leggi(id) : null;
    if (!dati) { res.statusCode = 404; return res.end('Post non trovato'); }
    const mp4 = await monta(dati);
    if (!mp4) { res.statusCode = 404; return res.end('Nessuna scena'); }
    res.setHeader('Content-Type', 'video/mp4');
    if (url.searchParams.get('scarica')) res.setHeader('Content-Disposition', `attachment; filename="galvarent-reel-${id.slice(0, 8)}.mp4"`);
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
    res.end(mp4);
  } catch (e) {
    console.error('reel', e && e.stack || e);
    res.statusCode = 500;
    res.end('Errore nel montare il reel');
  }
};

module.exports.monta = monta;
