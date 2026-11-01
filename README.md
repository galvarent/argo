# ARGO

Interfaccia vocale personale di Andrea (Assistente Remoto Galvano Operativo).

- Tocca il nucleo e parla: il browser trascrive la voce (Web Speech API, gratuita).
- "Invia ad ARGO" copia la frase e apre il progetto ARGO su Claude; "Chat rapida" apre una nuova chat Claude con la frase già scritta.
- Sito statico su Vercel (piano Hobby), nessuna API a pagamento, nessun dato salvato.

Struttura: `public/` (index.html, manifest, icone), `vercel.json`.

## Cervello (Claude API)
- `api/chat.js` inoltra la conversazione alla Claude API (modello predefinito `claude-haiku-5-5`, cambiabile con la variabile `ARGO_MODEL`).
- `api/context.js` contiene personalità e manuale di Andrea: aggiornalo quando cambiano orari, partite o obiettivi.
- Variabile d'ambiente richiesta su Vercel: `ANTHROPIC_API_KEY`.
- Le attività delle tab vengono inviate a ogni richiesta; ARGO può aggiungerle o completarle.
