// Chiede ad ARGO (progetto protetto) di mandare le mail del sito.
const ARGO_URL = (process.env.ARGO_URL || 'https://argo-xi-nine.vercel.app').replace(/\/+$/, '');

module.exports = async function argo(dati) {
  const r = await fetch(`${ARGO_URL}/api/sito-posta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vercel-protection-bypass': process.env.ARGO_BYPASS || '',
      'x-argo-sito': process.env.ARGO_SITO_SEGRETO || '',
    },
    body: JSON.stringify(dati),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`ARGO ${r.status} ${t.slice(0, 120)}`);
  return t;
};
