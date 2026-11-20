// POST /api/richiesta – il modulo "Calcola il tuo canone".
// Salva la richiesta (solo con il consenso privacy) e manda subito la mail di conferma.

const { rpc } = require('../lib/archivio');
const argo = require('../lib/argo');

const testo = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  if (b.sito_web) { res.statusCode = 200; return res.end('{"ok":true}'); } // campo trappola per i bot

  const dati = {
    nome: testo(b.nome, 120), telefono: testo(b.telefono, 40), email: testo(b.email, 200),
    comune: testo(b.comune, 80), auto: testo(b.auto, 200),
    cliente: testo(b.cliente, 40), veicolo: testo(b.veicolo, 40), km: testo(b.km, 40), durata: testo(b.durata, 40), anticipo: testo(b.anticipo, 60),
    consenso_privacy: b.consenso_privacy === true, consenso_marketing: b.consenso_marketing === true,
  };
  res.setHeader('Content-Type', 'application/json');
  if (!dati.consenso_privacy) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Serve il consenso per ricontattarti.' })); }

  let id;
  try {
    id = await rpc('argo_richiesta_nuova', { p: dati });
  } catch (e) {
    const m = String(e.message || '');
    const err = /email non valida/.test(m) ? 'L’email non sembra corretta.'
      : /contatto mancante/.test(m) ? 'Lascia almeno un telefono o un’email.'
      : /nome mancante/.test(m) ? 'Scrivi il tuo nome.'
      : /troppe richieste/.test(m) ? 'Troppe richieste in questo momento: riprova tra poco o scrivimi su WhatsApp.'
      : 'Non sono riuscito a salvare la richiesta: scrivimi su WhatsApp.';
    console.error('richiesta', m);
    res.statusCode = 400; return res.end(JSON.stringify({ error: err }));
  }

  if (dati.email) {
    try { await argo({ op: 'mail1', id }); } catch (e) { console.error('mail1', e && e.message); }
  }
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true }));
};
