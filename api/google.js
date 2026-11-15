// /api/google – collegamento una tantum di Google Calendar.
// 1. Apri /api/google: ti manda al consenso Google.
// 2. Google torna qui con un codice: la pagina mostra il GOOGLE_REFRESH_TOKEN da incollare su Vercel.
// Il sito è protetto dall'accesso Vercel; il token non viene salvato da nessuna parte.

const crypto = require('crypto');

const SCOPE = 'https://www.googleapis.com/auth/calendar';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function pagina(titolo, corpo) {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(titolo)}</title>
<style>body{margin:0;background:#0A0A0A;color:#F5F5F5;font:16px/1.5 Inter,system-ui,sans-serif;padding:24px}
main{max-width:640px;margin:0 auto}h1{font-size:24px;margin:0 0 16px}ol{padding-left:20px}li{margin:8px 0}
code,textarea{font:14px ui-monospace,Menlo,monospace;background:#151515;border:1px solid #262626;border-radius:8px;padding:2px 6px;color:#F5F5F5}
textarea{width:100%;box-sizing:border-box;min-height:90px;padding:10px}a{color:#FF6A5C}.nota{color:#9CA3AF;font-size:14px}
.btn{display:inline-block;background:#DC3427;color:#fff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:12px;margin-top:8px}</style>
</head><body><main>${corpo}</main></body></html>`;
}

function invia(res, stato, html, extra = {}) {
  res.statusCode = stato;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  Object.entries(extra).forEach(([k, v]) => res.setHeader(k, v));
  res.end(html);
}

module.exports = async (req, res) => {
  const id = process.env.GOOGLE_CLIENT_ID || '';
  const segreto = process.env.GOOGLE_CLIENT_SECRET || '';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const ritorno = `https://${host}/api/google`;
  const url = new URL(req.url, ritorno);

  if (!id || !segreto) {
    return invia(res, 200, pagina('Collega Google Calendar', `<h1>Collega Google Calendar</h1>
      <p>Mancano le variabili <code>GOOGLE_CLIENT_ID</code> e <code>GOOGLE_CLIENT_SECRET</code> su Vercel.</p>
      <p>Quando crei il client OAuth su Google Cloud, come URI di reindirizzamento autorizzato usa esattamente:</p>
      <textarea readonly>${esc(ritorno)}</textarea>`));
  }

  const errore = url.searchParams.get('error');
  if (errore) return invia(res, 400, pagina('Collegamento non riuscito', `<h1>Collegamento non riuscito</h1><p>Google ha risposto: <code>${esc(errore)}</code>.</p><a class="btn" href="/api/google">Riprova</a>`));

  const codice = url.searchParams.get('code');
  if (!codice) {
    const stato = crypto.randomBytes(16).toString('hex');
    const q = new URLSearchParams({
      client_id: id, redirect_uri: ritorno, response_type: 'code', scope: SCOPE,
      access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: stato,
    });
    return invia(res, 302, '', {
      Location: `https://accounts.google.com/o/oauth2/v2/auth?${q}`,
      'Set-Cookie': `argo_g=${stato}; Path=/api/google; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    });
  }

  const biscotto = /(?:^|;\s*)argo_g=([a-f0-9]{32})/.exec(req.headers.cookie || '');
  if (!biscotto || biscotto[1] !== url.searchParams.get('state')) {
    return invia(res, 400, pagina('Collegamento non riuscito', '<h1>Collegamento non riuscito</h1><p>La richiesta è scaduta o non viene da qui.</p><a class="btn" href="/api/google">Riprova</a>'));
  }

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: codice, client_id: id, client_secret: segreto, redirect_uri: ritorno, grant_type: 'authorization_code' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.refresh_token) {
    return invia(res, 400, pagina('Collegamento non riuscito', `<h1>Collegamento non riuscito</h1>
      <p>${j.refresh_token === undefined && r.ok ? 'Google non ha restituito il token permanente.' : `Google ha risposto: <code>${esc(j.error_description || j.error || r.status)}</code>.`}</p>
      <a class="btn" href="/api/google">Riprova</a>`, { 'Set-Cookie': 'argo_g=; Path=/api/google; Max-Age=0' }));
  }

  return invia(res, 200, pagina('Quasi fatto', `<h1>Quasi fatto, Andrea</h1>
    <ol>
      <li>Copia questo valore:<br><textarea readonly onclick="this.select()">${esc(j.refresh_token)}</textarea></li>
      <li>Su Vercel, progetto <b>argo</b> → Settings → Environment Variables, crea <code>GOOGLE_REFRESH_TOKEN</code> con questo valore (ambiente Production).</li>
      <li>Rifai il deploy (Deployments → ultimo → Redeploy).</li>
    </ol>
    <p class="nota">Non condividere questo valore: dà accesso al tuo calendario. Puoi revocarlo quando vuoi da myaccount.google.com → Sicurezza → App di terze parti.</p>
    <a class="btn" href="/">Torna ad ARGO</a>`, { 'Set-Cookie': 'argo_g=; Path=/api/google; Max-Age=0' }));
};
