// ARGO – lettore di frasi per la barra "Aggiungi o cambia".
// Niente intelligenza artificiale: regole semplici su date, orari e parole chiave.
// Restituisce una proposta che Andrea controlla (e può correggere) prima di confermare.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ArgoParser = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const GIORNI = ['domenica', 'luned[iì]', 'marted[iì]', 'mercoled[iì]', 'gioved[iì]', 'venerd[iì]', 'sabato'];
  const NOMI_GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

  const RE_CALCIO = /allenament|partit|amichevol|torne|primi calci|pulcini|chiasso|tavernola|convocat|genitori|ritrovo|raduno|\bgara\b|\bcampo\b/i;
  const RE_LAVORO = /client|visita|preventiv|trattativ|contratt|firma|consegna|ayvens|leasys|\b478\b|noleggio|\bnlt\b|chiamat|telefonat|\bcall\b|riunion|marga|sponsor|diretta|ripres|drone|galvarent|appuntamento con|\bsrl\b|\bspa\b/i;
  const RE_SPOSTA = /\b(spost\w*|anticip\w*|posticip\w*|rimand\w*|slitt\w*|cambi\w*\s+(?:orario|ora|data|giorno)|non\s+pi[uù])\b/i;
  const RE_ANNULLA = /\b(annull\w*|cancell\w*|salt\w*|disdett\w*|disdic\w*)\b/i;
  const RE_PROMEMORIA = /\b(promemoria|ricordami(?:\s+di)?|ricorda(?:mi)?\s+di|ricordarmi\s+di|non\s+dimenticare(?:\s+di)?)\b/i;
  const PAROLE_VUOTE = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'del', 'della', 'dello', 'dei', 'delle', 'a', 'ad', 'al', 'alla', 'alle', 'allo', 'da', 'dal', 'dalla', 'dalle', 'in', 'con', 'su', 'per', 'tra', 'fra', 'e', 'ed', 'che', 'mi', 'ci', 'si', 'oggi', 'domani', 'ore', 'evento', 'mio', 'mia', 'nostro', 'nostra', 'questo', 'questa', 'prossimo', 'prossima', 'stasera', 'stamattina', 'invece', 'sono', 'è', 'stato', 'stata']);

  const pad = (n) => String(n).padStart(2, '0');
  const giornoUTC = (k) => new Date(k + 'T12:00:00Z');
  const chiaveDa = (d) => d.toISOString().slice(0, 10);
  const piuGiorni = (k, n) => { const d = giornoUTC(k); d.setUTCDate(d.getUTCDate() + n); return chiaveDa(d); };
  const togliAccenti = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const norm = (s) => togliAccenti(String(s || '').toLowerCase());

  function oggiRoma() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
  }

  // ---------- Date ----------
  function trovaDate(testo, oggi) {
    const trovate = [];
    const metti = (m, data, precisa) => trovate.push({ inizio: m.index, fine: m.index + m[0].length, testo: m[0], data, precisa });
    let m;

    const reRel = /\b(?:(di|del|per|da)\s+)?(oggi|stasera|stamattina|stamani|stanotte|dopodomani|domani)\b/gi;
    while ((m = reRel.exec(testo))) {
      const p = m[2].toLowerCase();
      const n = p === 'dopodomani' ? 2 : p === 'domani' ? 1 : 0;
      metti(m, piuGiorni(oggi, n), true);
      trovate[trovate.length - 1].prep = (m[1] || '').toLowerCase();
      trovate[trovate.length - 1].sera = p === 'stasera';
    }

    const reTra = /\b(tra|fra)\s+(\d{1,2}|un|una|due|tre|quattro|cinque|sei|sette)\s+(giorn[oi]|settiman[ae])\b/gi;
    const numeri = { un: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7 };
    while ((m = reTra.exec(testo))) {
      const n = numeri[m[2].toLowerCase()] || Number(m[2]);
      metti(m, piuGiorni(oggi, /settiman/i.test(m[3]) ? n * 7 : n), true);
    }

    const reGiorno = new RegExp(`\\b(?:(di|del|per|da)\\s+)?(?:(?:il|la)\\s+)?(${GIORNI.join('|')})(\\s+prossim[oa]|\\s+che\\s+viene)?(?![\\wÀ-ÿ])`, 'gi');
    while ((m = reGiorno.exec(testo))) {
      const nome = norm(m[2]);
      const idx = NOMI_GIORNI.findIndex((g) => norm(g) === nome);
      const oggiIdx = giornoUTC(oggi).getUTCDay();
      let diff = (idx - oggiIdx + 7) % 7;
      if (m[3] && diff === 0) diff = 7;
      metti(m, piuGiorni(oggi, diff), true);
      trovate[trovate.length - 1].prep = (m[1] || '').toLowerCase();
    }

    const reMese = new RegExp(`\\b(?:(di|del|per|da)\\s+)?(?:(?:il|l')\\s*)?(\\d{1,2})\\s+(${MESI.join('|')})(?:\\s+(\\d{4}))?\\b`, 'gi');
    while ((m = reMese.exec(testo))) {
      const g = Number(m[2]), me = MESI.indexOf(m[3].toLowerCase()) + 1;
      metti(m, dataCompleta(oggi, g, me, m[4]), true);
      trovate[trovate.length - 1].prep = (m[1] || '').toLowerCase();
    }

    const reNum = /\b(?:(di|del|per|da)\s+)?(?:(?:il|l')\s*)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/gi;
    while ((m = reNum.exec(testo))) {
      metti(m, dataCompleta(oggi, Number(m[2]), Number(m[3]), m[4]), true);
      trovate[trovate.length - 1].prep = (m[1] || '').toLowerCase();
    }

    const reIl = /\b(?:(di|del|per|da)\s+)?(?:il|l')\s*(\d{1,2})\b(?!\s*[:.]\d)(?!\s*\/)/gi;
    while ((m = reIl.exec(testo))) {
      const g = Number(m[2]);
      if (g < 1 || g > 31) continue;
      if (trovate.some((t) => m.index < t.fine && m.index + m[0].length > t.inizio)) continue;
      const [a, me] = oggi.split('-').map(Number);
      let k = `${a}-${pad(me)}-${pad(g)}`;
      if (k < oggi) k = me === 12 ? `${a + 1}-01-${pad(g)}` : `${a}-${pad(me + 1)}-${pad(g)}`;
      metti(m, k, true);
      trovate[trovate.length - 1].prep = (m[1] || '').toLowerCase();
    }

    // Tieni solo le corrispondenze che non si sovrappongono (la prima vince).
    trovate.sort((x, y) => x.inizio - y.inizio || (y.fine - y.inizio) - (x.fine - x.inizio));
    const pulite = [];
    trovate.forEach((t) => { if (!pulite.some((p) => t.inizio < p.fine && t.fine > p.inizio)) pulite.push(t); });
    return pulite;
  }

  function dataCompleta(oggi, g, me, anno) {
    let a = Number(oggi.slice(0, 4));
    if (anno) a = anno.length === 2 ? 2000 + Number(anno) : Number(anno);
    let k = `${a}-${pad(me)}-${pad(g)}`;
    if (!anno && k < oggi) k = `${a + 1}-${pad(me)}-${pad(g)}`;
    return k;
  }

  // ---------- Orari ----------
  function trovaOrari(testo) {
    const trovati = [];
    let m;
    const reRange = /\b(?:dalle|dall'|dalle\s+ore)\s*(\d{1,2})(?:[:.](\d{2}))?\s+(?:alle|fino\s+alle)\s+(\d{1,2})(?:[:.](\d{2}))?\b/gi;
    while ((m = reRange.exec(testo))) {
      trovati.push({ inizio: m.index, fine: m.index + m[0].length, ora: [Number(m[1]), Number(m[2] || 0)], oraFine: [Number(m[3]), Number(m[4] || 0)] });
    }
    const reOra = /\b(?:alle\s+ore|alle|all'|ore|h|per\s+le|verso\s+le|dalle|dall')\s*(\d{1,2})(?:[:.](\d{2}))?(?:\s*(di\s+mattina|del\s+mattino|di\s+sera|del\s+pomeriggio|di\s+pomeriggio))?\b/gi;
    while ((m = reOra.exec(testo))) {
      if (trovati.some((t) => m.index < t.fine && m.index + m[0].length > t.inizio)) continue;
      trovati.push({ inizio: m.index, fine: m.index + m[0].length, ora: [Number(m[1]), Number(m[2] || 0)], qualifica: (m[3] || '').toLowerCase() });
    }
    const reNudo = /\b(\d{1,2})[:.](\d{2})\b/g;
    while ((m = reNudo.exec(testo))) {
      if (trovati.some((t) => m.index < t.fine && m.index + m[0].length > t.inizio)) continue;
      trovati.push({ inizio: m.index, fine: m.index + m[0].length, ora: [Number(m[1]), Number(m[2])] });
    }
    const reMezzo = /\b(?:a\s+)?(mezzogiorno|mezzanotte)\b/gi;
    while ((m = reMezzo.exec(testo))) {
      trovati.push({ inizio: m.index, fine: m.index + m[0].length, ora: [m[1].toLowerCase() === 'mezzogiorno' ? 12 : 0, 0], qualifica: 'esatto' });
    }
    return trovati.filter((t) => t.ora[0] <= 23 && t.ora[1] <= 59).sort((a, b) => a.inizio - b.inizio);
  }

  function sistemaOra(t, dubbi, sera) {
    let [h, mi] = t.ora;
    const q = t.qualifica || '';
    if (/sera|pomeriggio/.test(q) && h < 12) h += 12;
    else if (!q && h >= 1 && h <= 7 && !t.oraFine) {
      h += 12;
      dubbi.push(`Ho letto le ${pad(h)}:${pad(mi)}: se intendevi di mattina correggi l'orario.`);
    } else if (sera && h < 12) h += 12;
    return `${pad(h)}:${pad(mi)}`;
  }

  // ---------- Luogo ----------
  function trovaLuogo(testo, occupati) {
    const re = /\b(?:a|ad|al|allo|alla|presso|in\s+via|via)\s+((?:[A-ZÀ-Ý][\wÀ-ÿ'’.-]*)(?:\s+(?:di|del|della|de|d')?\s*[A-ZÀ-Ý][\wÀ-ÿ'’.-]*)*)/g;
    let m;
    const esclusi = new RegExp(`^(${MESI.join('|')}|${NOMI_GIORNI.join('|')}|ARGO)$`, 'i');
    while ((m = re.exec(testo))) {
      const inizio = m.index, fine = m.index + m[0].length;
      if (occupati.some((o) => inizio < o.fine && fine > o.inizio)) continue;
      if (esclusi.test(m[1])) continue;
      const parola = m[0].split(/\s+/)[0].toLowerCase();
      const luogo = (parola === 'via' || /^in$/.test(parola)) ? m[0].replace(/^in\s+/i, '') : m[1];
      return { inizio, fine, luogo: luogo.replace(/[.,;:]+$/, '') };
    }
    return null;
  }

  // ---------- Calendario ----------
  function calendarioDa(testo, evento) {
    if (evento && evento.calendario) return evento.calendario;
    if (RE_CALCIO.test(testo)) return 'calcio';
    if (RE_LAVORO.test(testo)) return 'lavoro';
    return 'personale';
  }

  // ---------- Evento da spostare ----------
  function paroleChiave(testo) {
    return norm(testo).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter((p) => p.length >= 3 && !PAROLE_VUOTE.has(p) && !/^\d+$/.test(p));
  }
  function radice(p) { return p.length > 5 ? p.slice(0, p.length - 2) : p; }

  function trovaBersaglio(parole, eventi, oggi, dataOrigine, tutti) {
    const daOra = Date.now() - 3 * 3600000;
    let candidati = (eventi || []).filter((e) => e && e.inizio && new Date(e.fine || e.inizio).getTime() >= daOra);
    if (dataOrigine) candidati = candidati.filter((e) => chiaveRoma(e.inizio) === dataOrigine);
    else candidati = candidati.filter((e) => chiaveRoma(e.inizio) <= piuGiorni(oggi, 30));
    const radici = parole.map(radice);
    const allenamento = radici.some((r) => r.startsWith('allenam'));
    const gara = radici.some((r) => r.startsWith('parti') || r === 'gara' || r.startsWith('amichev') || r.startsWith('torne'));
    const eAllenamento = (e) => /^Tavernola –|allenament/i.test(e.titolo || '');
    const punteggi = candidati.map((e) => {
      const t = norm(`${e.titolo} ${e.luogo || ''}`);
      let p = radici.reduce((s, r) => s + (t.includes(r) ? 2 : 0), 0);
      if (e.calendario === 'calcio') {
        if (allenamento && eAllenamento(e)) p += 2;
        if (gara && !eAllenamento(e)) p += 2;
      }
      return { e, p };
    }).filter((x) => x.p > 0);
    punteggi.sort((a, b) => b.p - a.p || new Date(a.e.inizio) - new Date(b.e.inizio));
    if (!punteggi.length) return tutti ? [] : null;
    if (!tutti) return punteggi[0].e;
    // Tutti gli eventi dello stesso giorno con il punteggio migliore (es. andata e ritorno).
    const giorno = chiaveRoma(punteggi[0].e.inizio);
    return punteggi.filter((x) => x.p === punteggi[0].p && chiaveRoma(x.e.inizio) === giorno).map((x) => x.e);
  }

  const fChiave = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' });
  const fOra = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false });
  function chiaveRoma(iso) { return fChiave.format(new Date(iso)); }
  function oraRoma(iso) { return fOra.format(new Date(iso)); }
  function durataMinuti(e) {
    if (!e.fine) return 60;
    return Math.max(15, Math.round((new Date(e.fine) - new Date(e.inizio)) / 60000));
  }
  function aggiungiMinuti(ora, min) {
    const [h, m] = ora.split(':').map(Number);
    const tot = Math.min(23 * 60 + 59, h * 60 + m + min);
    return `${pad(Math.floor(tot / 60))}:${pad(tot % 60)}`;
  }

  // ---------- Titolo ----------
  function pulisciTitolo(testo, tagli) {
    let s = testo;
    tagli.filter(Boolean).sort((a, b) => b.inizio - a.inizio).forEach((t) => { s = s.slice(0, t.inizio) + ' ' + s.slice(t.fine); });
    s = s.replace(RE_PROMEMORIA, ' ')
      .replace(/\b(aggiungi|metti|inserisci|segna|crea|fissa|programma)\b(\s+(un|una|in\s+calendario|in\s+agenda))?/gi, ' ')
      .replace(/\b(in\s+calendario|in\s+agenda|nel\s+calendario)\b/gi, ' ')
      .replace(/^\s*(sono|sar[oò]|siamo|saremo|vado|andr[oò])\s+/i, ' ')
      .replace(/\s+/g, ' ').trim()
      .replace(/^(che|di|il|lo|la|alle|al|a|e|per)\s+/i, '')
      .replace(/\s+(di|del|il|lo|la|alle|al|a|e|per|ore|da)$/i, '')
      .replace(/^[,.;:\s-]+|[,.;:\s-]+$/g, '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  // ---------- Analisi ----------
  function analizza(frase, opzioni) {
    const o = opzioni || {};
    const oggi = o.oggi || oggiRoma();
    const testo = String(frase || '').replace(/\s+/g, ' ').trim();
    const dubbi = [];
    if (!testo) return { vuota: true };

    const annulla = RE_ANNULLA.test(testo);
    const sposta = !annulla && RE_SPOSTA.test(testo);
    const promemoria = RE_PROMEMORIA.test(testo);
    const date = trovaDate(testo, oggi);
    const orari = trovaOrari(testo);
    const occupati = [...date, ...orari];
    const luogo = trovaLuogo(testo, occupati);

    if (sposta || annulla) {
      // "di oggi", "del 21": giorno dell'evento da cercare; le altre date sono la destinazione.
      const origine = date.find((d) => d.prep === 'di' || d.prep === 'del' || d.prep === 'da');
      const destinazione = date.find((d) => d !== origine);
      const segnaRe = new RegExp(`${RE_SPOSTA.source}|${RE_ANNULLA.source}`, 'gi');
      const resto = testo.replace(segnaRe, ' ');
      const tagliati = pulisciTitolo(resto, occupati.map((t) => shift(t, testo, resto)).filter(Boolean));
      const parole = paroleChiave(tagliati);
      const dataOrigine = origine ? origine.data : (annulla && destinazione ? destinazione.data : null);
      const bersaglio = trovaBersaglio(parole, o.eventi, oggi, dataOrigine);
      if (!bersaglio) {
        dubbi.push(parole.length ? `Non trovo in agenda un evento che corrisponda a «${parole.join(' ')}». Scegli l'evento o scrivilo con il nome che ha in calendario.` : 'Non ho capito quale evento cambiare.');
      }
      if (annulla) {
        const bersagli = trovaBersaglio(parole, o.eventi, oggi, dataOrigine, true);
        return { azione: 'annulla', bersaglio, bersagli, dubbi, frase: testo };
      }
      const base = bersaglio || {};
      const data = destinazione ? destinazione.data : (bersaglio ? chiaveRoma(bersaglio.inizio) : (origine ? origine.data : oggi));
      const t = orari[0];
      const sera = date.some((d) => d.sera);
      const ora = t ? sistemaOra(t, dubbi, sera) : (bersaglio && !bersaglio.tutto_giorno ? oraRoma(bersaglio.inizio) : '');
      const oraFine = t && t.oraFine ? sistemaOra({ ora: t.oraFine }, [], sera) : (ora && bersaglio ? aggiungiMinuti(ora, durataMinuti(bersaglio)) : '');
      if (!t && !destinazione) dubbi.push('Non ho trovato la nuova data o il nuovo orario.');
      return {
        azione: 'sposta', bersaglio, dubbi, frase: testo,
        titolo: base.titolo || '', calendario: base.calendario || calendarioDa(testo), luogo: base.luogo || '',
        data, ora, oraFine,
      };
    }

    const d = date[0];
    const t = orari[0];
    const sera = date.some((x) => x.sera);
    const ora = t ? sistemaOra(t, dubbi, sera) : (sera ? '' : '');
    let titolo = pulisciTitolo(testo, [...date, ...orari, luogo]);
    if (!titolo) { titolo = promemoria ? 'Promemoria' : ''; dubbi.push('Manca il titolo: scrivilo qui sotto.'); }
    const calendario = calendarioDa(testo);
    const durata = promemoria ? 15 : (calendario === 'calcio' && /partit|amichevol|torne/i.test(testo) ? 90 : 60);
    const oraFine = t && t.oraFine ? sistemaOra({ ora: t.oraFine }, [], sera) : (ora ? aggiungiMinuti(ora, durata) : '');
    if (!d) dubbi.push(`Non ho trovato il giorno: ho messo ${t ? 'oggi' : 'oggi, tutto il giorno'}.`);
    else if (!t && !promemoria) dubbi.push('Non ho trovato l\'orario: lo metto come evento di tutto il giorno, se non lo aggiungi.');
    return {
      azione: 'crea', promemoria, dubbi, frase: testo,
      titolo, calendario, luogo: luogo ? luogo.luogo : '',
      data: d ? d.data : oggi, ora, oraFine,
    };
  }

  // Le posizioni sono calcolate sul testo originale; "resto" ha la stessa lunghezza solo se le sostituzioni lo mantengono,
  // quindi ricalcoliamo cercando lo stesso pezzo di testo.
  function shift(t, testo, resto) {
    const pezzo = testo.slice(t.inizio, t.fine);
    const i = resto.indexOf(pezzo);
    return i >= 0 ? { inizio: i, fine: i + pezzo.length } : null;
  }

  return { analizza, oggiRoma, chiaveRoma, oraRoma, piuGiorni };
}));
