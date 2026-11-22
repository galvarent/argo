// galvarent-social – /api/slide?p=<id post>&n=<numero slide da 1>
// Disegna una slide 1080x1350 (4:5) nello stile GalvaRent e la restituisce in JPEG,
// il formato che Instagram accetta. Legge le slide da Supabase con la chiave pubblica:
// la funzione argo_slide restituisce solo il testo delle slide, mai didascalie o note.

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';

const W = 1080, H = 1350;
// Il reel si disegna su una tela logica più stretta (880x1564, 9:16) e poi si ingrandisce a 1080x1920:
// così testi e titoli risultano più grandi, come serve su uno schermo verticale.
const W_REEL = 880, H_REEL = 1564;
const NERO = '#0A0A0A', CARD = '#151515', LINEA = '#262626', ROSSO = '#E83F31', BIANCO = '#F5F5F5', GRIGIO = '#B4BAC2', TENUE = '#8A9099';

let risorse = null;
function carica() {
  if (risorse) return risorse;
  const font = (peso) => fs.readFileSync(path.join(__dirname, '..', 'assets', `inter-latin-${peso}-normal.woff`));
  const logo = fs.readFileSync(path.join(__dirname, '..', 'assets', 'galvarent.svg'));
  risorse = {
    fonts: [400, 600, 700, 800].map((w) => ({ name: 'Inter', data: font(w), weight: w, style: 'normal' })),
    logo: `data:image/svg+xml;base64,${logo.toString('base64')}`,
  };
  return risorse;
}

// Piccolo costruttore di nodi per satori (niente JSX).
const h = (type, style, children, props) => ({ type, props: { style, children, ...(props || {}) } });
const testo = (t, style) => h('div', { display: 'flex', ...style }, String(t || ''));

function testata(n, tot, rubrica) {
  return h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }, [
    h('div', { display: 'flex', alignItems: 'center', gap: 16 }, [
      h('div', { width: 44, height: 8, background: ROSSO, borderRadius: 4 }),
      testo(String(rubrica || 'Noleggio a lungo termine').toUpperCase(), { fontSize: 24, fontWeight: 700, letterSpacing: 3, color: TENUE }),
    ]),
    tot > 1 ? testo(`${n}/${tot}`, { fontSize: 26, fontWeight: 600, color: TENUE }) : h('div', {}, ''),
  ]);
}

function piede(logo, mostraSito) {
  return h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }, [
    h('img', { width: 150, height: 109 }, undefined, { src: logo, width: 150, height: 109 }),
    mostraSito ? testo('galvarent.com', { fontSize: 30, fontWeight: 600, color: GRIGIO }) : h('div', {}, ''),
  ]);
}

function immagine(url, w, hgt) {
  if (!url) return null;
  return h('div', { display: 'flex', width: w, height: hgt, alignItems: 'center', justifyContent: 'center' }, [
    h('img', { width: w, height: hgt, objectFit: 'contain' }, undefined, { src: url, width: w, height: hgt }),
  ]);
}

function corpo(s) {
  const tipo = s.tipo || 'testo';
  if (tipo === 'copertina') {
    // Con due foto: la principale grande in alto, la seconda più piccola sotto il testo, a destra.
    if (s.immagine && s.immagine2) {
      return h('div', { display: 'flex', flexDirection: 'column', gap: 24, flexGrow: 1, justifyContent: 'center' }, [
        s.etichetta ? testo(s.etichetta.toUpperCase(), { fontSize: 30, fontWeight: 800, color: ROSSO, letterSpacing: 2 }) : null,
        immagine(s.immagine, 960, 400),
        testo(s.titolo, { fontSize: s.titolo && s.titolo.length > 30 ? 76 : 92, fontWeight: 800, color: BIANCO, lineHeight: 1.05, letterSpacing: -2 }),
        h('div', { display: 'flex', alignItems: 'center', gap: 28, width: '100%' }, [
          s.testo ? testo(s.testo, { fontSize: 34, color: GRIGIO, lineHeight: 1.35, flex: 1 }) : h('div', { display: 'flex', flex: 1 }, ''),
          immagine(s.immagine2, 400, 240),
        ]),
      ].filter(Boolean));
    }
    return h('div', { display: 'flex', flexDirection: 'column', gap: 28, flexGrow: 1, justifyContent: 'center' }, [
      s.etichetta ? testo(s.etichetta.toUpperCase(), { fontSize: 30, fontWeight: 800, color: ROSSO, letterSpacing: 2 }) : null,
      testo(s.titolo, { fontSize: s.titolo && s.titolo.length > 40 ? 84 : 104, fontWeight: 800, color: BIANCO, lineHeight: 1.05, letterSpacing: -2 }),
      s.testo ? testo(s.testo, { fontSize: 40, color: GRIGIO, lineHeight: 1.35 }) : null,
      immagine(s.immagine, 960, 420),
    ].filter(Boolean));
  }
  if (tipo === 'offerta') {
    const chips = (s.punti || []).slice(0, 4);
    return h('div', { display: 'flex', flexDirection: 'column', gap: 26, flexGrow: 1, justifyContent: 'center' }, [
      s.etichetta ? testo(s.etichetta.toUpperCase(), { fontSize: 28, fontWeight: 800, color: ROSSO, letterSpacing: 2 }) : null,
      immagine(s.immagine, 960, 440),
      testo(s.titolo, { fontSize: 64, fontWeight: 800, color: BIANCO, lineHeight: 1.1, letterSpacing: -1 }),
      s.prezzo ? h('div', { display: 'flex', alignItems: 'flex-end', gap: 16 }, [
        testo(s.prezzo, { fontSize: 120, fontWeight: 800, color: ROSSO, lineHeight: 1, letterSpacing: -3 }),
        testo(s.unita || '/mese + IVA', { fontSize: 36, fontWeight: 600, color: GRIGIO, paddingBottom: 14 }),
      ]) : null,
      chips.length ? h('div', { display: 'flex', flexWrap: 'wrap', gap: 14 }, chips.map((c) =>
        testo(c, { fontSize: 28, fontWeight: 600, color: BIANCO, background: CARD, border: `2px solid ${LINEA}`, borderRadius: 999, padding: '12px 24px' }))) : null,
      s.note ? testo(s.note, { fontSize: 22, color: TENUE, lineHeight: 1.35 }) : null,
    ].filter(Boolean));
  }
  if (tipo === 'dato') {
    // Post singolo "Il dato": un numero enorme che ferma lo scroll.
    return h('div', { display: 'flex', flexDirection: 'column', gap: 30, flexGrow: 1, justifyContent: 'center' }, [
      s.etichetta ? testo(s.etichetta.toUpperCase(), { fontSize: 30, fontWeight: 800, color: ROSSO, letterSpacing: 2 }) : null,
      testo(s.numero, { fontSize: String(s.numero || '').length > 6 ? 190 : 260, fontWeight: 800, color: ROSSO, lineHeight: 0.95, letterSpacing: -8 }),
      testo(s.titolo, { fontSize: 72, fontWeight: 800, color: BIANCO, lineHeight: 1.08, letterSpacing: -1.5 }),
      s.testo ? testo(s.testo, { fontSize: 38, color: GRIGIO, lineHeight: 1.4 }) : null,
      s.note ? testo(s.note, { fontSize: 24, color: TENUE, lineHeight: 1.35 }) : null,
    ].filter(Boolean));
  }
  if (tipo === 'mito') {
    // Post singolo "Vero o falso": l'affermazione, il verdetto e la spiegazione.
    const vero = /^vero/i.test(s.verdetto || '');
    return h('div', { display: 'flex', flexDirection: 'column', gap: 34, flexGrow: 1, justifyContent: 'center' }, [
      testo((s.etichetta || 'Vero o falso?').toUpperCase(), { fontSize: 30, fontWeight: 800, color: ROSSO, letterSpacing: 2 }),
      testo(`«${s.titolo || ''}»`, { fontSize: 76, fontWeight: 800, color: BIANCO, lineHeight: 1.08, letterSpacing: -1.5 }),
      h('div', { display: 'flex', alignSelf: 'flex-start', background: vero ? '#1F8A4C' : ROSSO, borderRadius: 18, padding: '16px 34px' }, [
        testo((s.verdetto || 'Falso').toUpperCase(), { fontSize: 46, fontWeight: 800, color: '#FFFFFF', letterSpacing: 4 }),
      ]),
      s.testo ? testo(s.testo, { fontSize: 38, color: GRIGIO, lineHeight: 1.4 }) : null,
    ].filter(Boolean));
  }
  if (tipo === 'cta') {
    return h('div', { display: 'flex', flexDirection: 'column', gap: 36, flexGrow: 1, justifyContent: 'center' }, [
      testo(s.titolo, { fontSize: 88, fontWeight: 800, color: BIANCO, lineHeight: 1.08, letterSpacing: -2 }),
      s.testo ? testo(s.testo, { fontSize: 40, color: GRIGIO, lineHeight: 1.35 }) : null,
      h('div', { display: 'flex', background: ROSSO, borderRadius: 28, padding: '34px 44px', alignSelf: 'flex-start' }, [
        testo(s.bottone || 'Calcola il tuo canone su galvarent.com', { fontSize: 40, fontWeight: 800, color: '#FFFFFF' }),
      ]),
      s.note ? testo(s.note, { fontSize: 30, color: GRIGIO }) : null,
    ].filter(Boolean));
  }
  // testo / elenco
  const punti = (s.punti || []).slice(0, 6);
  return h('div', { display: 'flex', flexDirection: 'column', gap: 34, flexGrow: 1, justifyContent: 'center' }, [
    s.etichetta ? testo(s.etichetta.toUpperCase(), { fontSize: 28, fontWeight: 800, color: ROSSO, letterSpacing: 2 }) : null,
    testo(s.titolo, { fontSize: 72, fontWeight: 800, color: BIANCO, lineHeight: 1.1, letterSpacing: -1.5 }),
    s.testo ? testo(s.testo, { fontSize: 38, color: GRIGIO, lineHeight: 1.4 }) : null,
    punti.length ? h('div', { display: 'flex', flexDirection: 'column', gap: 24 }, punti.map((p) =>
      h('div', { display: 'flex', alignItems: 'flex-start', gap: 22 }, [
        h('div', { width: 16, height: 16, borderRadius: 8, background: ROSSO, marginTop: 18, flexShrink: 0 }),
        testo(p, { fontSize: 38, color: BIANCO, lineHeight: 1.35, flex: 1 }),
      ]))) : null,
    immagine(s.immagine, 960, 380),
  ].filter(Boolean));
}

function slide(s, n, tot, logo, rubrica, alto) {
  const reel = alto === H_REEL;
  return h('div', {
    display: 'flex', flexDirection: 'column', width: reel ? W_REEL : W, height: alto || H, background: NERO,
    // Nel reel lascio libere le fasce in alto e in basso coperte dall'interfaccia di Instagram.
    padding: reel ? '170px 48px 250px' : '64px 64px 56px', fontFamily: 'Inter', color: BIANCO, gap: 40,
  }, [testata(n, tot, s.rubrica || rubrica), corpo(s), piede(logo, (s.tipo || 'testo') !== 'cta')]);
}

async function disegna(dati, n, formato) {
  const satori = (await import('satori')).default;
  const { Resvg } = require('@resvg/resvg-js');
  const sharp = require('sharp');
  const { fonts, logo } = carica();
  const slides = dati.slides || [];
  const s = slides[n - 1] ? { ...slides[n - 1] } : null;
  if (!s) return null;
  [s.immagine, s.immagine2] = await Promise.all([incorpora(s.immagine), incorpora(s.immagine2)]);
  const alto = formato === 'reel' ? H_REEL : H;
  // Nel reel niente numerazione "1/5": scorre da solo.
  const svg = await satori(slide(s, n, formato === 'reel' ? 1 : slides.length, logo, slides[0] && slides[0].rubrica, alto), { width: formato === 'reel' ? W_REEL : W, height: alto, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  if (formato === 'png') return png;
  if (formato === 'reel') return png;
  return sharp(png).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

// Scarica la foto e la passa a satori come PNG incorporato (converte anche webp).
// Se la foto non è raggiungibile la slide viene disegnata senza, invece di fallire.
async function incorpora(url) {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const sharp = require('sharp');
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(t);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return null;
    const png = await sharp(buf).resize({ width: 1400, withoutEnlargement: true }).png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch { return null; }
}

async function leggi(id) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/argo_slide`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_id: id }),
  });
  if (!r.ok) return null;
  return r.json();
}

const DEMO = {
  slides: [
    { tipo: 'copertina', etichetta: 'Per artigiani e P.IVA', titolo: 'Il furgone senza anticipo e senza pensieri', testo: 'Canone fisso con assicurazione, manutenzione e gomme inclusi.' },
    { tipo: 'testo', etichetta: 'Cosa è incluso', titolo: 'Un canone, tutto dentro', punti: ['RCA, furto e incendio', 'Manutenzione ordinaria e straordinaria', 'Cambio gomme', 'Soccorso stradale 24h'] },
    { tipo: 'cta', titolo: 'Quanto pagheresti tu?', testo: 'Ti preparo un preventivo su misura in 24 ore.', note: 'Scrivimi su WhatsApp dal link in bio' },
  ],
};

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const id = url.searchParams.get('p') || '';
    const n = Math.max(1, Math.min(10, Number(url.searchParams.get('n')) || 1));
    let dati;
    if (id === 'demo') dati = DEMO;
    else if (/^[0-9a-f-]{36}$/i.test(id)) dati = await leggi(id);
    if (!dati) { res.statusCode = 404; return res.end('Post non trovato'); }
    const reel = url.searchParams.get('f') === 'reel';
    const jpg = reel ? await require('sharp')(await disegna(dati, n, 'reel')).resize(1080, 1920, { fit: 'fill' }).jpeg({ quality: 88, mozjpeg: true }).toBuffer() : await disegna(dati, n);
    if (!jpg) { res.statusCode = 404; return res.end('Slide non trovata'); }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.end(jpg);
  } catch (e) {
    console.error('slide', e && e.stack || e);
    res.statusCode = 500;
    res.end('Errore nel disegnare la slide');
  }
};

module.exports.disegna = disegna;
module.exports.leggi = leggi;
