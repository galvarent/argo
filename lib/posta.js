// Invio delle mail del sito dalla casella Gmail di GalvaRent (Gmail API, permesso gmail.send).
// Se le chiavi Google non sono configurate, non manda niente e lo dice.

const G_ID = process.env.GOOGLE_CLIENT_ID || '';
const G_SEGRETO = process.env.GOOGLE_CLIENT_SECRET || '';
const G_REFRESH = process.env.GOOGLE_REFRESH_TOKEN || '';
const WA = 'https://wa.me/393421682857';

const attiva = () => !!(G_ID && G_SEGRETO && G_REFRESH);

async function token() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: G_ID, client_secret: G_SEGRETO, refresh_token: G_REFRESH, grant_type: 'refresh_token' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Google: accesso non valido');
  return j.access_token;
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const intestazione = (s) => `=?UTF-8?B?${b64(s)}?=`;
const pulisci = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();

function pagina(corpoHtml) {
  return `<!doctype html><html lang="it"><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#0A0A0A;border-radius:14px 14px 0 0;padding:18px 24px;color:#fff;font-weight:700;font-size:18px">Galva<span style="color:#E83F31">Rent</span></div>
<div style="background:#fff;border-radius:0 0 14px 14px;padding:24px;font-size:16px;line-height:1.55">${corpoHtml}
<p style="margin:24px 0 0;font-size:14px;color:#52525b">Andrea Galvano – GalvaRent<br>Consulenza noleggio a lungo termine · Como, Varese, Monza Brianza<br><a href="https://galvarent.com" style="color:#E83F31">galvarent.com</a></p>
</div>
<p style="font-size:12px;color:#71717a;margin:14px 4px 0">Ricevi questa mail perché hai chiesto un preventivo su galvarent.com. Se non sei stato tu, rispondi e cancello i tuoi dati.</p>
</div></body></html>`;
}

function mail1(r) {
  const voci = [r.cliente, r.veicolo, r.km && `${r.km} km all'anno`, r.durata, r.anticipo].filter(Boolean).map((v) => `<li>${esc(v)}</li>`).join('');
  return {
    oggetto: 'Il tuo preventivo di noleggio è in preparazione',
    html: pagina(`<p style="margin:0 0 14px">Ciao ${esc(r.nome.split(' ')[0])},</p>
<p style="margin:0 0 14px">grazie per la richiesta. Ecco cosa mi hai indicato:</p>
${voci ? `<ul style="margin:0 0 14px;padding-left:20px">${voci}</ul>` : ''}
<p style="margin:0 0 14px">Entro 24 ore ti mando le proposte più adatte, con canone e coperture a confronto, così vedi subito cosa è incluso e cosa no.</p>
<p style="margin:0 0 18px">Se nel frattempo ti viene in mente qualcosa (un modello preciso, una data entro cui ti serve l'auto), rispondi a questa mail o scrivimi su WhatsApp.</p>
<a href="${WA}" style="display:inline-block;background:#E83F31;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Scrivimi su WhatsApp</a>`),
  };
}

function mail2(r) {
  return {
    oggetto: 'Hai avuto modo di guardare le proposte?',
    html: pagina(`<p style="margin:0 0 14px">Ciao ${esc(r.nome.split(' ')[0])},</p>
<p style="margin:0 0 14px">ti scrivo per sapere se hai visto le proposte che ti ho mandato.</p>
<p style="margin:0 0 14px">Se qualcosa non torna, come il canone, i km o la durata, dimmelo: si può rifare il calcolo con parametri diversi senza nessun impegno.</p>
<p style="margin:0 0 18px">Se preferisci parlarne di persona, passo io da te, a casa o in sede.</p>
<a href="${WA}" style="display:inline-block;background:#E83F31;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Rispondimi su WhatsApp</a>`),
  };
}

async function invia(a, { oggetto, html }) {
  const msg = [
    `To: ${pulisci(a)}`,
    `Subject: ${intestazione(pulisci(oggetto))}`,
    `From: ${intestazione('Andrea Galvano – GalvaRent')} <me>`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(html),
  ].join('\r\n').replace('<me>', '<andrea.galvarent@gmail.com>');
  const raw = Buffer.from(msg, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!r.ok) throw new Error(`Gmail ${r.status}`);
}

module.exports = { attiva, invia, mail1, mail2 };
