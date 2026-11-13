// GET /api/data -> partite, promemoria, stato | POST { azione:'fatto', id }
const { controllaAccesso, prossimePartite, dbAttivo, sb } = require('../lib/core');

module.exports = async (req, res) => {
  if (!(await controllaAccesso(req, res))) return;
  try {
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      if (b.azione === 'fatto' && dbAttivo()) {
        await sb(`argo_tasks?id=eq.${Number(b.id)}`, { method: 'PATCH', body: { fatto: Boolean(b.valore !== false) } });
      }
      return res.status(200).json({ ok: true });
    }
    let promemoria = [];
    let dbOk = dbAttivo();
    if (dbOk) {
      try { promemoria = await sb('argo_tasks?fatto=eq.false&order=scadenza.asc.nullslast&limit=40'); } catch { dbOk = false; }
    }
    res.status(200).json({
      partite: prossimePartite().slice(0, 6),
      promemoria,
      stato: { cervello: Boolean(process.env.ANTHROPIC_API_KEY), database: dbOk },
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
