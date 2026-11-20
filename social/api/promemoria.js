// Cron giornaliero: promemoria (mail 2) a chi ha chiesto il preventivo 3+ giorni fa
// ed è ancora "nuova" o "contattata" nella Plancia. Una sola volta per richiesta.

const { sito } = require('../lib/archivio');
const posta = require('../lib/posta');

module.exports = async (req, res) => {
  const cron = process.env.CRON_SECRET || '';
  if (!cron || req.headers.authorization !== `Bearer ${cron}`) { res.statusCode = 401; return res.end(); }
  if (!posta.attiva()) { res.statusCode = 200; return res.end('posta non configurata'); }
  let inviate = 0;
  const lista = (await sito('promemoria')) || [];
  for (const r of lista) {
    try { await posta.invia(r.email, posta.mail2(r)); await sito('mail2', r.id); inviate++; } catch (e) { console.error('mail2', r.id, e && e.message); }
  }
  res.statusCode = 200;
  res.end(`promemoria inviati: ${inviate}`);
};
