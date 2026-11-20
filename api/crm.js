// ARGO CRM – un'unica funzione per tutta la dashboard (Vercel Hobby limita il numero di funzioni).
//
//   GET  /api/crm   → tutto quello che serve alla pagina: ufficio, agenda, voci, aziende di Orione,
//                     lead e coda chiamate del portale clienti (galvarent.com)
//   POST /api/crm   → { op, ... } una modifica alla volta
//
// Il sito è protetto dall'accesso Vercel; i segreti restano qui sul server.

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_ANON_KEY || '';
const SEGRETO = process.env.ARGO_HQ_SECRET || '';
const GR_URL = (process.env.GALVARENT_URL || 'https://www.galvarent.com').replace(/\/+$/, '');
const GR_TOKEN = process.env.GALVARENT_TOKEN || '';

const QUEUE_SIZE = 10;
const MAX_ATTEMPTS = 3;

async function rpc(nome, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_segreto: SEGRETO, ...args }),
  });
  const txt = await r.text();
  let j = null;
  try { j = JSON.parse(txt); } catch { /* risposta non JSON */ }
  if (!r.ok) throw new Error((j && j.message) || `Archivio ${r.status}`);
  if (j === null) throw new Error('Archivio: accesso negato');
  return j;
}

async function portale(path, { method = 'GET', body } = {}) {
  if (!GR_TOKEN) throw new Error('Portale clienti non collegato');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(`${GR_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${GR_TOKEN}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const txt = await r.text();
    let j = null;
    try { j = JSON.parse(txt); } catch { /* risposta non JSON */ }
    if (!r.ok) throw new Error((j && j.error) || `Portale clienti: errore ${r.status}`);
    return j;
  } finally {
    clearTimeout(timer);
  }
}

// ----- Google Calendar (lettura e scrittura diretta) -----
// Variabili: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN (si ottiene da /api/google).
// I calendari si trovano per nome: "GalvaRent" → lavoro, "Calcio" → calcio, "Personale" → personale.
const G_ID = process.env.GOOGLE_CLIENT_ID || '';
const G_SEGRETO = process.env.GOOGLE_CLIENT_SECRET || '';
const G_REFRESH = process.env.GOOGLE_REFRESH_TOKEN || '';
const googleAttivo = () => Boolean(G_ID && G_SEGRETO && G_REFRESH);
const CAL_NOMI = { lavoro: 'galvarent', calcio: 'calcio', personale: 'personale' };
const TZ = 'Europe/Rome';
let gToken = null, gScade = 0, gCalendari = null, gCalendariQuando = 0;

async function googleToken() {
  if (gToken && Date.now() < gScade - 60000) return gToken;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: G_ID, client_secret: G_SEGRETO, refresh_token: G_REFRESH, grant_type: 'refresh_token' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    throw new Error(j.error === 'invalid_grant' ? 'Accesso a Google scaduto: ricollega il calendario da /api/google' : 'Google non risponde');
  }
  gToken = j.access_token; gScade = Date.now() + (j.expires_in || 3600) * 1000;
  return gToken;
}

async function google(path, { method = 'GET', body } = {}) {
  const t = await googleToken();
  const r = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    method,
    headers: { Authorization: `Bearer ${t}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204) return {};
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) ? `Google: ${j.error.message}` : `Google: errore ${r.status}`);
  return j;
}

const normNome = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
async function calendariGoogle() {
  if (gCalendari && Date.now() - gCalendariQuando < 30 * 60000) return gCalendari;
  const j = await google('/users/me/calendarList?minAccessRole=writer&maxResults=250');
  const mappa = {};
  (j.items || []).forEach((c) => {
    const n = normNome(c.summaryOverride || c.summary);
    Object.entries(CAL_NOMI).forEach(([k, nome]) => { if (n === nome && !mappa[k]) mappa[k] = c.id; });
  });
  // Senza un calendario chiamato "GalvaRent", il lavoro va sul calendario principale dell'account.
  if (!mappa.lavoro) { const p = (j.items || []).find((c) => c.primary); if (p) mappa.lavoro = p.id; }
  gCalendari = mappa; gCalendariQuando = Date.now();
  return mappa;
}

function eventoDaGoogle(chiaveCal, ev) {
  const tutto = Boolean(ev.start && ev.start.date);
  return {
    id: `g:${chiaveCal}:${ev.id}`,
    calendario: chiaveCal,
    titolo: ev.summary || '(senza titolo)',
    inizio: tutto ? `${ev.start.date}T12:00:00Z` : ev.start.dateTime,
    fine: tutto ? null : (ev.end && ev.end.dateTime) || null,
    tutto_giorno: tutto,
    luogo: ev.location || null,
  };
}

async function agendaGoogle() {
  const cal = await calendariGoogle();
  const da = new Date(Date.now() - 36 * 3600000).toISOString();
  const a = new Date(Date.now() + 120 * 86400000).toISOString();
  const liste = await Promise.all(Object.entries(cal).map(async ([k, id]) => {
    const q = new URLSearchParams({ timeMin: da, timeMax: a, singleEvents: 'true', orderBy: 'startTime', maxResults: '500' });
    const j = await google(`/calendars/${encodeURIComponent(id)}/events?${q}`);
    return (j.items || []).filter((e) => e.status !== 'cancelled').map((e) => eventoDaGoogle(k, e));
  }));
  return { eventi: liste.flat().sort((x, y) => x.inizio.localeCompare(y.inizio)), calendari: Object.keys(cal) };
}

const oraOk = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '');
const dataSecca = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
function giornoDopo(k) { const d = new Date(`${k}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
function tempiGoogle(data, ora, oraFine) {
  if (!dataSecca(data)) throw new Error('Data non valida');
  if (!ora) return { start: { date: data }, end: { date: giornoDopo(data) } };
  if (!oraOk(ora)) throw new Error('Orario non valido');
  let fine = oraOk(oraFine) && oraFine > ora ? oraFine : null;
  if (!fine) { const [h, m] = ora.split(':').map(Number); const t = Math.min(23 * 60 + 59, h * 60 + m + 60); fine = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }
  return { start: { dateTime: `${data}T${ora}:00`, timeZone: TZ }, end: { dateTime: `${data}T${fine}:00`, timeZone: TZ } };
}
function idGoogle(id) {
  const m = /^g:(lavoro|calcio|personale):([A-Za-z0-9_-]{4,200})$/.exec(String(id || ''));
  if (!m) throw new Error('Questo evento non viene da Google Calendar: modificalo lì');
  return { chiave: m[1], evento: m[2] };
}
async function calendarioId(chiave) {
  const cal = await calendariGoogle();
  if (!cal[chiave]) throw new Error(`Non trovo il calendario "${CAL_NOMI[chiave]}" in Google`);
  return cal[chiave];
}

// ----- Coda chiamate: stessa logica del portale, ma senza far partire lo scoring a pagamento -----
function oggiRoma() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}
function giorniTra(iso, oggi) {
  return Math.floor((new Date(`${oggi}T12:00:00Z`) - new Date(`${String(iso).slice(0, 10)}T12:00:00Z`)) / 86400000);
}
function codaDiOggi(tutti, oggi) {
  const all = tutti.filter((p) => p.financial !== 'negativo');
  const fin = (p) => (p.financial === 'positivo' ? 1 : 0);
  const due = all.filter((p) => p.status === 'richiamare' && p.nextCallDate && p.nextCallDate <= oggi)
    .sort((a, b) => a.nextCallDate.localeCompare(b.nextCallDate));
  const retry = all.filter((p) => p.status === 'non_risponde' && (p.attempts || 0) < MAX_ATTEMPTS && p.lastCallAt && giorniTra(p.lastCallAt, oggi) >= 2)
    .sort((a, b) => fin(b) - fin(a) || b.score - a.score || a.lastCallAt.localeCompare(b.lastCallAt));
  const fresh = all.filter((p) => p.status === 'da_chiamare')
    .sort((a, b) => fin(b) - fin(a) || b.score - a.score || (a.createdAt || '').localeCompare(b.createdAt || ''));
  const coda = [];
  const usati = new Set();
  const positivi = [...retry, ...fresh].filter((p) => p.financial === 'positivo');
  [due, positivi, retry, fresh].forEach((gruppo) => gruppo.forEach((p) => {
    if (coda.length < QUEUE_SIZE && !usati.has(p.id)) { usati.add(p.id); coda.push(p); }
  }));
  return coda;
}
function statistiche(all, oggi) {
  const settimana = new Date(Date.now() - 7 * 86400000).toISOString();
  return {
    totale: all.length,
    daChiamare: all.filter((p) => p.status === 'da_chiamare' && p.financial !== 'negativo').length,
    richiamiScaduti: all.filter((p) => p.status === 'richiamare' && p.nextCallDate && p.nextCallDate <= oggi).length,
    interessati: all.filter((p) => p.status === 'interessato').length,
    chiamateSettimana: all.filter((p) => p.lastCallAt && p.lastCallAt >= settimana).length,
  };
}
function prospectLeggero(p) {
  return {
    id: p.id, name: p.name, phone: p.phone, mobile: p.mobile, address: p.address, website: p.website,
    category: p.category, zone: p.zone, score: p.score, reason: p.reason, hook: p.hook, status: p.status,
    attempts: p.attempts || 0, nextCallDate: p.nextCallDate, lastCallAt: p.lastCallAt, financial: p.financial || '',
    contactName: p.contactName || '', contactRole: p.contactRole || '', contactPhone: p.contactPhone || '',
    pinnedNote: p.pinnedNote || '', notes: (p.notes || []).slice(-4),
  };
}

async function leggiPortale() {
  const oggi = oggiRoma();
  const [leads, pr] = await Promise.all([portale('/api/leads'), portale('/api/prospects')]);
  const tutti = (pr && pr.prospects) || [];
  const richiami = tutti
    .filter((p) => p.status === 'richiamare' && p.nextCallDate && p.nextCallDate > oggi)
    .sort((a, b) => a.nextCallDate.localeCompare(b.nextCallDate))
    .slice(0, 30);
  return {
    leads: Array.isArray(leads) ? leads : [],
    chiamate: {
      coda: codaDiOggi(tutti, oggi).map(prospectLeggero),
      richiami: richiami.map(prospectLeggero),
      stat: statistiche(tutti, oggi),
    },
  };
}

// ----- Scritture -----
const STATI_LEAD = ['nuovo', 'contattato', 'preventivo_inviato', 'trattativa', 'chiuso_vinto', 'chiuso_perso'];
const TIPI_ATTIVITA = ['chiamata', 'whatsapp', 'email', 'preventivo', 'appuntamento', 'nota'];
const ESITI = ['non_risponde', 'richiamare', 'non_interessato', 'interessato'];
const AREE = ['marga', 'calcio', 'todo'];
const CAMPI_LEAD = ['name', 'email', 'phone', 'message', 'vehicleInterest', 'partner', 'lostReason', 'estimatedFee',
  'duration', 'advance', 'annualKm', 'estimatedCommission', 'clientType', 'status', 'nextFollowUpDate'];
const idOk = (v) => typeof v === 'string' && /^[A-Za-z0-9-]{6,64}$/.test(v);
const dataOk = (v) => v === '' || v === null || /^\d{4}-\d{2}-\d{2}$/.test(v || '');

function soloCampi(src, campi) {
  const out = {};
  campi.forEach((k) => { if (src && src[k] !== undefined) out[k] = src[k]; });
  return out;
}

async function scrivi(b) {
  switch (b.op) {
    case 'lead_aggiorna': {
      if (!idOk(b.id)) throw new Error('Lead non valido');
      const campi = soloCampi(b.campi, CAMPI_LEAD);
      if (campi.status !== undefined && !STATI_LEAD.includes(campi.status)) throw new Error('Stato non valido');
      if (campi.nextFollowUpDate !== undefined && !dataOk(campi.nextFollowUpDate)) throw new Error('Data non valida');
      return portale(`/api/leads/${encodeURIComponent(b.id)}`, { method: 'PUT', body: campi });
    }
    case 'lead_attivita': {
      if (!idOk(b.id)) throw new Error('Lead non valido');
      if (!TIPI_ATTIVITA.includes(b.tipo)) throw new Error('Tipo attività non valido');
      return portale(`/api/leads/${encodeURIComponent(b.id)}`, { method: 'POST', body: { type: b.tipo, note: String(b.nota || '').slice(0, 2000) } });
    }
    case 'lead_nuovo': {
      const campi = soloCampi(b.campi, CAMPI_LEAD);
      if (!campi.name || !campi.phone) throw new Error('Nome e telefono sono obbligatori');
      return portale('/api/leads', { method: 'POST', body: campi });
    }
    case 'chiamata_esito': {
      if (!idOk(b.id)) throw new Error('Azienda non valida');
      if (!ESITI.includes(b.esito)) throw new Error('Esito non valido');
      if (b.data && !dataOk(b.data)) throw new Error('Data non valida');
      const p = await portale(`/api/prospects?action=outcome&id=${encodeURIComponent(b.id)}`, {
        method: 'PUT', body: { outcome: b.esito, note: String(b.nota || '').slice(0, 1000), date: b.data || undefined },
      });
      return prospectLeggero(p);
    }
    case 'voce_salva': {
      const d = soloCampi(b.dati, ['id', 'area', 'tipo', 'titolo', 'dettaglio', 'stato', 'data', 'importo', 'valuta']);
      if (!d.id && !AREE.includes(d.area)) throw new Error('Area non valida');
      if (!d.id && !String(d.titolo || '').trim()) throw new Error('Manca il titolo');
      if (d.data !== undefined && !dataOk(d.data)) throw new Error('Data non valida');
      if (d.importo !== undefined && d.importo !== '' && d.importo !== null) {
        const n = Number(String(d.importo).replace(',', '.'));
        if (!Number.isFinite(n) || n < 0 || n > 9999999) throw new Error('Importo non valido');
        d.importo = String(n);
      }
      return rpc('argo_crm_scrivi', { p_op: 'voce_salva', p_dati: d });
    }
    case 'voce_elimina':
      if (!idOk(b.id)) throw new Error('Voce non valida');
      return rpc('argo_crm_scrivi', { p_op: 'voce_elimina', p_dati: { id: b.id } });
    case 'azienda_stato': {
      if (!['nuova', 'pronta', 'contattata', 'interessata', 'preventivo', 'ordine', 'scartata'].includes(b.stato)) throw new Error('Stato non valido');
      const d = { id: String(Number(b.id)), stato: b.stato };
      if (typeof b.note === 'string') d.note = b.note.slice(0, 1000);
      return rpc('argo_crm_scrivi', { p_op: 'azienda_stato', p_dati: d });
    }
    case 'post_stato': {
      if (!idOk(b.id)) throw new Error('Post non valido');
      if (!['bozza', 'approvato', 'scartato'].includes(b.stato)) throw new Error('Stato non valido');
      const d = { id: b.id, stato: b.stato };
      if (typeof b.nota === 'string') d.nota = b.nota.slice(0, 1000);
      if (typeof b.didascalia === 'string') d.didascalia = b.didascalia.slice(0, 2200);
      return rpc('argo_crm_scrivi', { p_op: 'post_stato', p_dati: d });
    }
    case 'sponsor_stato':
      if (!['nuovo', 'contattato', 'interessato', 'no', 'chiuso'].includes(b.stato)) throw new Error('Stato non valido');
      return rpc('argo_crm_scrivi', { p_op: 'sponsor_stato', p_dati: { id: String(Number(b.id)), stato: b.stato } });
    case 'cal_crea': {
      if (!googleAttivo()) throw new Error('Google Calendar non collegato: apri /api/google');
      if (!CAL_NOMI[b.calendario]) throw new Error('Calendario non valido');
      const titolo = String(b.titolo || '').trim().slice(0, 200);
      if (!titolo) throw new Error('Manca il titolo');
      const corpo = {
        summary: titolo,
        location: String(b.luogo || '').trim().slice(0, 200) || undefined,
        description: b.promemoria ? 'Promemoria creato da ARGO' : 'Creato da ARGO',
        ...tempiGoogle(b.data, b.ora, b.oraFine),
        reminders: b.promemoria ? { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] } : { useDefault: true },
      };
      const id = await calendarioId(b.calendario);
      const ev = await google(`/calendars/${encodeURIComponent(id)}/events`, { method: 'POST', body: corpo });
      return eventoDaGoogle(b.calendario, ev);
    }
    case 'cal_sposta': {
      if (!googleAttivo()) throw new Error('Google Calendar non collegato: apri /api/google');
      const g = idGoogle(b.id);
      const id = await calendarioId(g.chiave);
      const corpo = tempiGoogle(b.data, b.ora, b.oraFine);
      if (b.titolo) corpo.summary = String(b.titolo).trim().slice(0, 200);
      const ev = await google(`/calendars/${encodeURIComponent(id)}/events/${encodeURIComponent(g.evento)}`, { method: 'PATCH', body: corpo });
      return eventoDaGoogle(g.chiave, ev);
    }
    case 'cal_annulla': {
      if (!googleAttivo()) throw new Error('Google Calendar non collegato: apri /api/google');
      const g = idGoogle(b.id);
      const id = await calendarioId(g.chiave);
      await google(`/calendars/${encodeURIComponent(id)}/events/${encodeURIComponent(g.evento)}`, { method: 'DELETE' });
      return { id: b.id };
    }
    default:
      throw new Error('Operazione sconosciuta');
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!SB_URL || !SB_KEY || !SEGRETO) return res.status(503).json({ error: 'ARGO non configurato' });

  try {
    if (req.method === 'GET') {
      const [base, gr, gc] = await Promise.allSettled([
        rpc('argo_crm_leggi', {}), leggiPortale(), googleAttivo() ? agendaGoogle() : Promise.reject(new Error('non collegato')),
      ]);
      if (base.status !== 'fulfilled') throw base.reason;
      const gOk = gc.status === 'fulfilled';
      return res.status(200).json({
        ...base.value,
        // Con Google collegato l'agenda è quella vera; senza, resta la copia salvata nel database.
        agenda: gOk ? gc.value.eventi : base.value.agenda,
        agenda_aggiornata: gOk ? new Date().toISOString() : base.value.agenda_aggiornata,
        google: gOk ? { ok: true, calendari: gc.value.calendari }
          : { ok: false, collegato: googleAttivo(), errore: String((gc.reason && gc.reason.message) || 'non collegato') },
        leads: gr.status === 'fulfilled' ? gr.value.leads : [],
        chiamate: gr.status === 'fulfilled' ? gr.value.chiamate : null,
        portale: gr.status === 'fulfilled' ? { ok: true } : { ok: false, errore: String((gr.reason && gr.reason.message) || 'non raggiungibile') },
        oggi: oggiRoma(),
      });
    }

    if (req.method === 'POST') {
      // Solo richieste fatte dalla pagina stessa.
      const origin = req.headers.origin || '';
      if (origin && origin.replace(/^https?:\/\//, '') !== req.headers.host) return res.status(403).json({ error: 'Origine non consentita' });
      if (req.headers['x-argo'] !== '1') return res.status(403).json({ error: 'Richiesta non valida' });
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const esito = await scrivi(body);
      return res.status(200).json({ ok: true, dato: esito });
    }

    return res.status(405).json({ error: 'Metodo non consentito' });
  } catch (e) {
    return res.status(400).json({ error: String((e && e.message) || 'Errore').slice(0, 200) });
  }
};
