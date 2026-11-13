// ARGO – nucleo condiviso: contesto, strumenti, Claude API, Supabase
const crypto = require('crypto');

const TZ = 'Europe/Rome';
const MODEL = process.env.ARGO_MODEL || 'claude-haiku-5-5';

// ---------- Partite US Tavernola (fase autunnale 2026/27, girone A) ----------
const CASA = 'C.S. Comunale Campo 1, Via Adamello, Tavernola (Como)';
const PC = 'Primi Calci 2018';
const PU = 'Pulcini misti 2016/17';
const PARTITE = [
  { data: '2026-11-07', squadra: PC, partita: 'Cittadella 1945 – Tavernola', ora: '11:00', luogo: 'Via Frigerio 2, Como' },
  { data: '2026-11-07', squadra: PU, partita: "Sant'Agata – Tavernola", ora: '14:30', luogo: 'Via Cetti 2, Como' },
  { data: '2026-11-14', squadra: PC, partita: 'Tavernola – Serenza Carroccio', ora: '10:00', luogo: CASA },
  { data: '2026-11-14', squadra: PU, partita: 'Tavernola – Albavilla', ora: '14:00', luogo: CASA, nota: 'orario variato (standard 14:45)' },
  { data: '2026-11-21', squadra: PC, partita: 'Pol. Aurora – Tavernola', ora: '15:00', luogo: 'Via Scimè, Montano Lucino' },
  { data: '2026-11-21', squadra: PU, partita: 'Arcellasco – Tavernola', ora: '16:30', luogo: 'Via Galvani, Erba', nota: 'due trasferte ravvicinate: Montano Lucino 15:00 poi Erba 16:30' },
  { data: '2026-11-28', squadra: PC, partita: 'Tavernola – HF Città di Como', ora: '10:00', luogo: CASA },
  { data: '2026-11-28', squadra: PU, partita: 'Tavernola – CDG Erba', ora: '14:45', luogo: CASA },
  { data: '2026-12-05', squadra: PC, partita: 'Libertas S. Bartolomeo – Tavernola', ora: '09:30', luogo: 'Prestino, Via Mantegna, Como' },
  { data: '2026-12-12', squadra: PC, partita: 'Tavernola – B.C.F.', ora: '10:00', luogo: CASA },
];

function oggiISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}
function adessoTesto() {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date());
}
function prossimePartite(da) {
  const d = da || oggiISO();
  return PARTITE.filter((p) => p.data >= d);
}

// ---------- Contesto ----------
function systemPrompt(sorgente) {
  return `Sei ARGO (Assistente Remoto Galvano Operativo), l'assistente personale di Andrea Galvano. Riferimento: JARVIS. Preciso, rapido, ironia asciutta e misurata. Chiami Andrea per nome, mai "signore". Rispondi sempre in italiano.

ADESSO: ${adessoTesto()} (fuso Europe/Rome). Data ISO di oggi: ${oggiISO()}.

LE TUE RISPOSTE VENGONO LETTE AD ALTA VOCE. Quindi:
- Niente markdown, elenchi puntati, asterischi, emoji o link. Solo frasi parlate.
- Breve: di norma 1-3 frasi. Vai oltre solo se Andrea chiede un riepilogo o un protocollo (max 8 frasi).
- Orari e date detti in modo naturale ("sabato alle 10", non "2026-11-14").
- Niente complimenti né preamboli. Vai al punto.${sorgente === 'siri' ? '\n- Questa richiesta arriva da Siri a mani libere: ancora più sintetico.' : ''}

CHI È ANDREA
- Agente di commercio in partita IVA forfettaria, brand GalvaRent (galvarent.com): consulenza NLT, broker 478 Rent con mandati Ayvens e Leasys. Zone: Como, Varese, Monza Brianza. È esperto del settore: niente basi. Trattative quasi tutte al telefono o online.
- Allenatore dal 2009. US Tavernola: Primi Calci 2018 e Pulcini misti 2016/17. Secondo allenatore all'FC Chiasso. Gestisce i social di US Tavernola.
- Video, foto e drone con il brand AG Films (DJI Mini 4 Pro, Insta360 X3, Sony A6400).
- Vive a Cassina Rizzardi (Como).

SETTIMANA TIPO
- Lun-Ven: 7:20 accompagnamento a scuola (Camerlata), 8:30-12:15 blocco lavoro, 12:25 ritiro a scuola.
- Lun e Mer: 16:30-18:00 Primi Calci, 18:00-19:30 Pulcini (Tavernola).
- Mar 18:15-19:45, Gio e Ven 18:00-19:30: allenamento FC Chiasso.
- Lun sera 21:00-23:30: serata Nexus.
- Sabato: partite Tavernola.
- Finestre libere tipiche: martedì, giovedì e venerdì pomeriggio fino alle 17.

CALCIO: segui solo le partite del Tavernola (Primi Calci 2018 e Pulcini misti 2016/17), mai quelle del Chiasso. Usa lo strumento partite_tavernola, non andare a memoria.

COME LAVORI
- Proattivo: se emerge una scadenza, un follow-up o un conflitto di orari, segnalalo in una frase e proponi un promemoria.
- Nota veloce dettata (es. "cliente Rossi, SUV ibrido, decide venerdì"): crea subito il promemoria con data e conferma in una frase cosa hai salvato.
- Rischio concreto (fiscale, contrattuale, di agenda): dillo in una riga.
- Prima di modificare o sovrascrivere dati esistenti di un cliente chiedi conferma. Creare promemoria e note non richiede conferma.
- Lead e clienti stanno nel database del portale clienti GalvaRent: usa db_schema per scoprire le tabelle la prima volta, poi db_select, db_insert, db_update. Le tabelle argo_* sono tue (promemoria, note).
- Per cercare nuovi potenziali clienti (aziende in provincia di Como, Varese, Monza Brianza con flotte o veicoli aziendali) usa la ricerca web e riporta nome, attività, comune e perché è un buon contatto.
- Se uno strumento risponde che un servizio non è collegato (database, agenda, mail), dillo chiaramente in una frase e non inventare dati.

PROTOCOLLI
- "Protocollo mattina": impegni di oggi dalla settimana tipo, promemoria in scadenza, eventuale partita vicina, meteo, 3 priorità.
- "Modalità cliente [nome]": cerca il cliente nel database, riepiloga stato, punti da toccare, obiezioni probabili.
- "Modalità campo": squadre di oggi, prossima partita, eventuale messaggio ai genitori.
- "Check volo": usa lo strumento meteo; vento e raffiche, pioggia, golden hour; ricorda la verifica delle zone su D-Flight.
- "Debrief": ascolta, estrai le azioni, crea i promemoria, proponi il piano di domani.
- "Revisione settimanale": chiuso, aperto, scadenze della settimana prossima, una cosa da migliorare.`;
}

// ---------- Supabase (REST) ----------
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const dbAttivo = () => Boolean(SB_URL && SB_KEY);
const NO_DB = { errore: 'Database non collegato: mancano SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY su Vercel.' };

async function sb(path, opt = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: opt.method || 'GET',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: opt.prefer || 'return=representation',
    },
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  const txt = await r.text();
  let j;
  try { j = txt ? JSON.parse(txt) : null; } catch { j = txt; }
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${typeof j === 'string' ? j : (j && j.message) || txt}`.slice(0, 300));
  return j;
}
const okNome = (s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(s || ''));
const OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'ilike', 'is'];
function filtriQS(filtri) {
  const out = [];
  for (const f of filtri || []) {
    if (!okNome(f.colonna) || !OPS.includes(f.op)) throw new Error('Filtro non valido');
    out.push(`${f.colonna}=${f.op}.${encodeURIComponent(String(f.valore))}`);
  }
  return out;
}

// ---------- Strumenti ----------
const TOOLS = [
  {
    name: 'partite_tavernola',
    description: 'Calendario partite US Tavernola (Primi Calci 2018 e Pulcini misti 2016/17). Restituisce le partite da una data in poi.',
    input_schema: { type: 'object', properties: { da: { type: 'string', description: 'Data ISO AAAA-MM-GG, default oggi' }, tutte: { type: 'boolean', description: 'true per includere anche quelle passate' } } },
  },
  {
    name: 'promemoria_crea',
    description: 'Crea un promemoria o una cosa da fare per Andrea.',
    input_schema: {
      type: 'object',
      properties: {
        testo: { type: 'string' },
        scadenza: { type: 'string', description: 'Data e ora ISO 8601 con fuso (es. 2026-11-20T10:00:00+01:00), se nota' },
        area: { type: 'string', enum: ['clienti', 'calcio', 'video', 'admin', 'personale'] },
        priorita: { type: 'string', enum: ['critico', 'normale', 'bassa'] },
      },
      required: ['testo'],
    },
  },
  {
    name: 'promemoria_lista',
    description: 'Elenca i promemoria aperti, in ordine di scadenza.',
    input_schema: { type: 'object', properties: { area: { type: 'string' }, entro: { type: 'string', description: 'Solo quelli con scadenza entro questa data ISO' } } },
  },
  {
    name: 'promemoria_completa',
    description: 'Segna un promemoria come fatto, per id.',
    input_schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
  },
  {
    name: 'nota_salva',
    description: 'Salva una nota o un fatto da ricordare (non un compito).',
    input_schema: { type: 'object', properties: { testo: { type: 'string' }, area: { type: 'string' } }, required: ['testo'] },
  },
  {
    name: 'note_cerca',
    description: 'Cerca tra le note salvate per parola chiave.',
    input_schema: { type: 'object', properties: { parola: { type: 'string' } }, required: ['parola'] },
  },
  {
    name: 'db_schema',
    description: 'Elenca tabelle e colonne del database del portale clienti GalvaRent. Da usare prima di db_select se non conosci la struttura.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'db_select',
    description: 'Legge righe da una tabella del database (clienti, lead, trattative).',
    input_schema: {
      type: 'object',
      properties: {
        tabella: { type: 'string' },
        colonne: { type: 'string', description: 'Elenco separato da virgole, default *' },
        filtri: {
          type: 'array',
          items: {
            type: 'object',
            properties: { colonna: { type: 'string' }, op: { type: 'string', enum: OPS }, valore: { type: 'string', description: 'Per ilike usa * come jolly, es. *rossi*' } },
            required: ['colonna', 'op', 'valore'],
          },
        },
        ordina: { type: 'string', description: 'es. created_at.desc' },
        limite: { type: 'number' },
      },
      required: ['tabella'],
    },
  },
  {
    name: 'db_insert',
    description: 'Inserisce una nuova riga (es. nuovo lead) in una tabella del database.',
    input_schema: { type: 'object', properties: { tabella: { type: 'string' }, riga: { type: 'object' } }, required: ['tabella', 'riga'] },
  },
  {
    name: 'db_update',
    description: 'Aggiorna una riga esistente identificata da id. Chiedi conferma ad Andrea prima di usarlo.',
    input_schema: { type: 'object', properties: { tabella: { type: 'string' }, id: { type: 'string' }, valori: { type: 'object' } }, required: ['tabella', 'id', 'valori'] },
  },
  {
    name: 'meteo',
    description: 'Meteo dei prossimi 3 giorni con vento, raffiche, pioggia, alba e tramonto. Default Como.',
    input_schema: { type: 'object', properties: { luogo: { type: 'string', description: 'Comune, es. Erba' } } },
  },
];

async function esegui(nome, a) {
  a = a || {};
  switch (nome) {
    case 'partite_tavernola':
      return { oggi: oggiISO(), partite: a.tutte ? PARTITE : prossimePartite(a.da) };
    case 'promemoria_crea': {
      if (!dbAttivo()) return NO_DB;
      const [r] = await sb('argo_tasks', { method: 'POST', body: { testo: a.testo, scadenza: a.scadenza || null, area: a.area || 'personale', priorita: a.priorita || 'normale' } });
      return { salvato: r };
    }
    case 'promemoria_lista': {
      if (!dbAttivo()) return NO_DB;
      const q = ['fatto=eq.false', 'order=scadenza.asc.nullslast', 'limit=30'];
      if (a.area) q.push(`area=eq.${encodeURIComponent(a.area)}`);
      if (a.entro) q.push(`scadenza=lte.${encodeURIComponent(a.entro)}`);
      return { promemoria: await sb(`argo_tasks?${q.join('&')}`) };
    }
    case 'promemoria_completa': {
      if (!dbAttivo()) return NO_DB;
      return { completato: await sb(`argo_tasks?id=eq.${Number(a.id)}`, { method: 'PATCH', body: { fatto: true } }) };
    }
    case 'nota_salva': {
      if (!dbAttivo()) return NO_DB;
      const [r] = await sb('argo_notes', { method: 'POST', body: { testo: a.testo, area: a.area || 'generale' } });
      return { salvata: r };
    }
    case 'note_cerca': {
      if (!dbAttivo()) return NO_DB;
      return { note: await sb(`argo_notes?testo=ilike.${encodeURIComponent('*' + a.parola + '*')}&order=creato.desc&limit=10`) };
    }
    case 'db_schema': {
      if (!dbAttivo()) return NO_DB;
      const spec = await sb('');
      const out = {};
      for (const [t, d] of Object.entries((spec && spec.definitions) || {})) {
        if (t.startsWith('argo_')) continue;
        out[t] = Object.entries(d.properties || {}).map(([c, p]) => `${c}:${p.format || p.type}`);
      }
      return { tabelle: out };
    }
    case 'db_select': {
      if (!dbAttivo()) return NO_DB;
      if (!okNome(a.tabella)) return { errore: 'Nome tabella non valido' };
      const q = filtriQS(a.filtri);
      q.push(`select=${encodeURIComponent(a.colonne || '*')}`);
      if (a.ordina) q.push(`order=${encodeURIComponent(a.ordina)}`);
      q.push(`limit=${Math.min(Number(a.limite) || 10, 25)}`);
      return { righe: await sb(`${a.tabella}?${q.join('&')}`) };
    }
    case 'db_insert': {
      if (!dbAttivo()) return NO_DB;
      if (!okNome(a.tabella)) return { errore: 'Nome tabella non valido' };
      return { inserita: await sb(a.tabella, { method: 'POST', body: a.riga }) };
    }
    case 'db_update': {
      if (!dbAttivo()) return NO_DB;
      if (!okNome(a.tabella)) return { errore: 'Nome tabella non valido' };
      return { aggiornata: await sb(`${a.tabella}?id=eq.${encodeURIComponent(a.id)}`, { method: 'PATCH', body: a.valori }) };
    }
    case 'meteo':
      return meteo(a.luogo);
    default:
      return { errore: `Strumento sconosciuto: ${nome}` };
  }
}

async function meteo(luogo) {
  let lat = 45.81, lon = 9.08, nome = 'Como';
  if (luogo && !/^como$/i.test(luogo.trim())) {
    const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(luogo)}&count=1&language=it&countryCode=IT`)).json();
    if (g.results && g.results[0]) ({ latitude: lat, longitude: lon, name: nome } = g.results[0]);
  }
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,wind_speed_10m,wind_gusts_10m&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max&timezone=${encodeURIComponent(TZ)}&forecast_days=3`;
  const m = await (await fetch(u)).json();
  if (!m.daily) return { errore: 'Meteo non disponibile' };
  const giorni = m.daily.time.map((d, i) => ({
    data: d, alba: m.daily.sunrise[i].slice(11), tramonto: m.daily.sunset[i].slice(11),
    min: m.daily.temperature_2m_min[i], max: m.daily.temperature_2m_max[i],
    pioggia_prob_max: m.daily.precipitation_probability_max[i], raffica_max_kmh: m.daily.wind_gusts_10m_max[i],
  }));
  const ore = [];
  m.hourly.time.forEach((t, i) => {
    const h = Number(t.slice(11, 13));
    if (h >= 7 && h <= 19 && h % 3 === 1) ore.push({ ora: t.replace('T', ' '), temp: m.hourly.temperature_2m[i], pioggia_prob: m.hourly.precipitation_probability[i], vento_kmh: m.hourly.wind_speed_10m[i], raffiche_kmh: m.hourly.wind_gusts_10m[i] });
  });
  return { luogo: nome, giorni, ore, nota: 'Golden hour: circa un\'ora dopo l\'alba e un\'ora prima del tramonto. DJI Mini 4 Pro: prudenza oltre 30 km/h di raffica.' };
}

// ---------- Claude ----------
async function chiamaClaude(body) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error((j.error && j.error.message) || `Claude API ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return j;
}

const WEB = { type: 'web_search_20250305', name: 'web_search', max_uses: 3 };

async function rispondi(messages, sorgente) {
  let tools = process.env.ARGO_WEB_SEARCH === '0' ? TOOLS : [...TOOLS, WEB];
  const msgs = messages.slice();
  for (let giro = 0; giro < 7; giro++) {
    const body = { model: MODEL, max_tokens: 900, system: systemPrompt(sorgente), tools, messages: msgs };
    let out;
    try {
      out = await chiamaClaude(body);
    } catch (e) {
      // se la ricerca web non è disponibile sull'account, riprova senza
      if (e.status === 400 && tools.includes(WEB) && /web_search|tool/i.test(e.message)) {
        tools = TOOLS;
        giro--;
        continue;
      }
      throw e;
    }
    if (out.stop_reason === 'tool_use') {
      msgs.push({ role: 'assistant', content: out.content });
      const risultati = [];
      for (const b of out.content) {
        if (b.type !== 'tool_use') continue;
        let res;
        try { res = await esegui(b.name, b.input); } catch (e) { res = { errore: String(e.message || e) }; }
        risultati.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(res).slice(0, 12000) });
      }
      msgs.push({ role: 'user', content: risultati });
      continue;
    }
    if (out.stop_reason === 'pause_turn') {
      msgs.push({ role: 'assistant', content: out.content });
      continue;
    }
    return pulisci(out.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
  }
  return 'Mi sono incartato su troppi passaggi. Riformula la richiesta in modo più diretto.';
}

function pulisci(t) {
  return String(t || '')
    .replace(/\*\*|__|`|^#+\s*/gm, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

// ---------- Cronologia ----------
async function cronologia() {
  if (!dbAttivo()) return null;
  try {
    const da = new Date(Date.now() - 45 * 60000).toISOString();
    const r = await sb(`argo_messages?creato=gte.${encodeURIComponent(da)}&order=creato.desc&limit=12`);
    return r.reverse().map((m) => ({ role: m.role, content: m.content }));
  } catch { return null; }
}
async function salvaScambio(utente, argo) {
  if (!dbAttivo()) return;
  try {
    const t = Date.now();
    await sb('argo_messages', {
      method: 'POST', prefer: 'return=minimal',
      body: [
        { role: 'user', content: utente, creato: new Date(t).toISOString() },
        { role: 'assistant', content: argo, creato: new Date(t + 1).toISOString() },
      ],
    });
  } catch { /* la cronologia è un di più */ }
}

// ---------- Accesso ----------
function accesso(req) {
  const pin = process.env.ARGO_PIN;
  if (!pin) return 'nopin';
  const dato = String(req.headers['x-argo-pin'] || '');
  const a = crypto.createHash('sha256').update(dato).digest();
  const b = crypto.createHash('sha256').update(pin).digest();
  return crypto.timingSafeEqual(a, b) ? 'ok' : 'no';
}
async function controllaAccesso(req, res) {
  const s = accesso(req);
  if (s === 'ok') return true;
  if (s === 'nopin') {
    res.status(503).json({ error: 'ARGO non è ancora configurato: manca ARGO_PIN su Vercel.' });
    return false;
  }
  await new Promise((r) => setTimeout(r, 1200)); // rallenta i tentativi a caso
  res.status(401).json({ error: 'PIN errato.' });
  return false;
}

module.exports = { rispondi, cronologia, salvaScambio, controllaAccesso, prossimePartite, dbAttivo, sb, esegui, pulisci, PARTITE, TOOLS, systemPrompt };
