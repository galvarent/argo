const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';
const SEGRETO_SITO = process.env.ARGO_SITO_SEGRETO || '';

async function rpc(nome, args) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const txt = await r.text();
  let j = null;
  try { j = JSON.parse(txt); } catch { /* non JSON */ }
  if (!r.ok) { const e = new Error((j && j.message) || `Archivio ${r.status}`); e.status = r.status; throw e; }
  return j;
}

const sito = (op, id) => rpc('argo_sito_mail', { p_segreto: SEGRETO_SITO, p_op: op, p_id: id || null });

module.exports = { rpc, sito };
