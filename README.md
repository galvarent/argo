# ARGO

L'app personale di Andrea: home "Oggi", plancia CRM e ufficio degli agenti.

- `public/index.html` – home "Oggi": messaggio di ARGO, barra "Aggiungi o cambia", priorità, agenda di oggi e domani, follow-up, agenti.
- `public/js/parser.js` – legge le frasi della barra (date, orari, calendario, luogo, spostamenti e annullamenti) con regole semplici, senza AI. Andrea controlla la proposta prima di confermare.
- `public/crm.html` – la plancia: clienti, chiamate, agenda, calcio, Marga TV, team.
- `public/ufficio.html` – l'ufficio in pixel art degli agenti (Penelope, Ermes, Orione, Chirone).
- `api/crm.js` – dati della home e della plancia; con Google collegato legge e scrive direttamente su Google Calendar (`cal_crea`, `cal_sposta`, `cal_annulla`).
- `api/google.js` – collegamento una tantum di Google Calendar: restituisce il `GOOGLE_REFRESH_TOKEN`.
- `api/hq.js` – stato degli agenti per l'ufficio.

Variabili su Vercel: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ARGO_HQ_SECRET`, `GALVARENT_URL`, `GALVARENT_TOKEN`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`. I calendari Google si trovano per nome: GalvaRent, Calcio, Personale.
Senza le variabili Google l'agenda resta la copia salvata nel database e la barra non può salvare.

Il sito è protetto dall'accesso con account Vercel.
