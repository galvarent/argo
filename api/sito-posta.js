// POST /api/sito-posta – chiamato solo dalla pagina pubblica (galvarent-social), mai dal browser.
// Manda le mail del sito con le chiavi Google di ARGO.
// { op: 'mail1', id } → conferma subito dopo la richiesta; { op: 'promemoria' } → mail 2 dopo 3 giorni.

const { sito } = require('../lib/archivio');
const posta = require('../lib/posta');

const SEGRETO = process.env.ARGO_SITO_SEGRETO || '';
const uuid = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('{}'); }
  if (!SEGRETO || req.headers['x-argo-sito'] !== SEGRETO) { res.statusCode = 401; return res.end('{}'); }
  if (!posta.attiva()) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'posta non configurata' })); }
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    if (b.op === 'mail1' && uuid(b.id)) {
      const r = await sito('leggi', b.id);
      if (!r || !r.email || r.mail1) return res.end(JSON.stringify({ inviata: false }));
      await posta.invia(r.email, posta.mail1(r));
      await sito('mail1', b.id);
      return res.end(JSON.stringify({ inviata: true }));
    }
    if (b.op === 'promemoria') {
      let inviate = 0;
      for (const r of (await sito('promemoria')) || []) {
        try { await posta.invia(r.email, posta.mail2(r)); await sito('mail2', r.id); inviate++; } catch (e) { console.error('mail2', r.id, e && e.message); }
      }
      return res.end(JSON.stringify({ inviate }));
    }
    res.statusCode = 400; return res.end('{}');
  } catch (e) {
    console.error('sito-posta', e && e.message);
    res.statusCode = 500; return res.end(JSON.stringify({ error: 'invio non riuscito' }));
  }
};
