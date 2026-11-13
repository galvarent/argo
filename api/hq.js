// GET /api/hq -> stato degli agenti, messaggio di ARGO e registro (letti da Supabase)
module.exports = async (req, res) => {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_ANON_KEY, segreto = process.env.ARGO_HQ_SECRET;
  if (!url || !key || !segreto) return res.status(503).json({ error: 'ARGO HQ non configurato' });
  try {
    const r = await fetch(`${url}/rest/v1/rpc/argo_leggi`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_segreto: segreto }),
    });
    const j = await r.json();
    if (!r.ok || !j) return res.status(502).json({ error: 'Archivio non raggiungibile' });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(j);
  } catch (e) {
    res.status(502).json({ error: 'Archivio non raggiungibile' });
  }
};
