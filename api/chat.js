// ARGO – cervello: inoltra la conversazione alla Claude API con la personalità e il contesto di Andrea.
import { SYSTEM } from "./context.js";

const MODEL = process.env.ARGO_MODEL || "claude-haiku-5-5";
const PNAME = { 1: "Critico", 2: "Oggi", 3: "Settimana", 4: "In sospeso" };

const TOOLS = [
  {
    name: "add_task",
    description: "Aggiunge un'attività alla lista di Andrea nella priorità indicata.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Testo breve dell'attività, con eventuale data" },
        priority: { type: "integer", enum: [1, 2, 3, 4], description: "1 Critico, 2 Oggi, 3 Settimana, 4 In sospeso" }
      },
      required: ["text", "priority"]
    }
  },
  {
    name: "complete_task",
    description: "Segna come completata un'attività già presente nella lista, indicandone il testo il più fedelmente possibile.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"]
    }
  }
];

function clean(messages) {
  if (!Array.isArray(messages)) return [];
  const out = messages
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-12);
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: "missing_key", message: "Manca la chiave API: aggiungi ANTHROPIC_API_KEY nelle variabili d'ambiente di Vercel." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const messages = clean(body.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user")
    return res.status(400).json({ error: "bad_request" });

  const now = new Date().toLocaleString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
  const tasks = Array.isArray(body.tasks) ? body.tasks.slice(0, 60) : [];
  const taskText = tasks.length
    ? tasks.map(t => `- [${PNAME[t.p] || "?"}] ${String(t.t).slice(0, 200)}`).join("\n")
    : "(nessuna attività aperta)";
  const system = `${SYSTEM}\n\nADESSO: ${now} (ora di Roma).\n\nATTIVITÀ APERTE DI ANDREA:\n${taskText}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 500, system, tools: TOOLS, messages })
    });
    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message || "Errore della Claude API";
      return res.status(502).json({ error: "upstream", message: msg });
    }
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join(" ").trim();
    const actions = (data.content || []).filter(b => b.type === "tool_use").map(b => ({ name: b.name, input: b.input }));
    return res.status(200).json({ text, actions, usage: data.usage });
  } catch (e) {
    return res.status(500).json({ error: "network", message: "Non riesco a raggiungere la Claude API." });
  }
}
