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
    case 'azienda_stato':
      if (!['nuova', 'contattata', 'scartata'].includes(b.stato)) throw new Error('Stato non valido');
      return rpc('argo_crm_scrivi', { p_op: 'azienda_stato', p_dati: { id: String(Number(b.id)), stato: b.stato } });
    default:
      throw new Error('Operazione sconosciuta');
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!SB_URL || !SB_KEY || !SEGRETO) return res.status(503).json({ error: 'ARGO non configurato' });

  try {
    if (req.method === 'GET') {
      const [base, gr] = await Promise.allSettled([rpc('argo_crm_leggi', {}), leggiPortale()]);
      if (base.status !== 'fulfilled') throw base.reason;
      return res.status(200).json({
        ...base.value,
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
