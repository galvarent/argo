# ARGO

Assistente personale vocale di Andrea (Assistente Remoto Galvano Operativo). PWA su Vercel con cervello Claude API.

## Struttura
- `public/index.html` – interfaccia (nucleo di particelle, voce in/out, mani libere, schede partite e promemoria, PIN).
- `api/chat.js` – conversazione con Claude e strumenti. Usato anche dal Comando Rapido "Ehi Siri, ARGO" (`source: "siri"`).
- `api/data.js` – dati per le schede (partite, promemoria, stato dei collegamenti).
- `api/firma.js` – impronte dei file pubblicati, per verificare il deploy.
- `lib/core.js` – contesto di Andrea, partite Tavernola, strumenti (promemoria, note, database clienti, meteo, ricerca web).
- `supabase-argo.sql` – tabelle di ARGO da creare nel database del portale clienti.

## Variabili d'ambiente (Vercel)
| Nome | Uso |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API (obbligatoria) |
| `ARGO_PIN` | PIN di accesso, almeno 10 caratteri (obbligatoria) |
| `SUPABASE_URL` | database del portale clienti |
| `SUPABASE_SERVICE_ROLE_KEY` | chiave server Supabase (solo lato server) |
| `ARGO_MODEL` | opzionale, default `claude-haiku-5-5` |
| `ARGO_WEB_SEARCH` | opzionale, `0` per disattivare la ricerca web |

## Da aggiornare a mano
Partite e settimana tipo stanno in `lib/core.js`: aggiornali quando esce il calendario della fase primaverile.
