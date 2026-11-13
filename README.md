# ARGO HQ

L'ufficio in pixel art dove Andrea vede il team di ARGO al lavoro.

- `public/index.html` – la scena (canvas) con Penelope, Ermes, Orione, Chirone e le postazioni in arrivo; sotto, il messaggio di ARGO e il registro.
- `api/hq.js` – legge stato, rapporti e registro dal database Supabase `argo-hq` tramite la funzione `argo_leggi`.
- Gli agenti sono attività programmate di Claude: scrivono nel database con `argo_inizio`, `argo_fine` e `argo_capo_scrivi`.

Variabili su Vercel: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ARGO_HQ_SECRET`. Il sito è protetto dall'accesso con account Vercel.

La versione precedente (app vocale con Claude API) resta nello storico del repository.
