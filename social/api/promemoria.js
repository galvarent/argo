// Cron giornaliero (9:13): chiede ad ARGO di mandare i promemoria (mail 2).
const argo = require('../lib/argo');

module.exports = async (req, res) => {
  const cron = process.env.CRON_SECRET || '';
  if (!cron || req.headers.authorization !== `Bearer ${cron}`) { res.statusCode = 401; return res.end(); }
  try { res.statusCode = 200; res.end(await argo({ op: 'promemoria' })); }
  catch (e) { console.error('promemoria', e && e.message); res.statusCode = 500; res.end('errore'); }
};
