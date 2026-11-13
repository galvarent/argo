// POST /api/chat  { text, history?, source? }  ->  { reply }
const { rispondi, cronologia, salvaScambio, controllaAccesso } = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
  if (!(await controllaAccesso(req, res))) return;
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Manca ANTHROPIC_API_KEY su Vercel.', reply: 'Non ho ancora il cervello collegato: manca la chiave API su Vercel.' });
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const text = String(body.text || body.testo || '').trim().slice(0, 4000);
  if (!text) return res.status(400).json({ error: 'Testo vuoto', reply: 'Non ho sentito nulla.' });
  const source = body.source === 'siri' ? 'siri' : 'app';

  let storia = await cronologia();
  if (!storia) {
    storia = (Array.isArray(body.history) ? body.history : [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content)
      .slice(-12);
  }
  while (storia.length && storia[0].role !== 'user') storia.shift();
  const messages = [...storia, { role: 'user', content: text }];

  try {
    const reply = await rispondi(messages, source);
    await salvaScambio(text, reply);
    res.status(200).json({ reply });
  } catch (e) {
    console.error('ARGO chat', e);
    const msg = e.status === 401 ? 'La chiave API non è valida.' : e.status === 429 ? 'Limite di richieste raggiunto, riprova tra poco.' : 'Ho avuto un problema tecnico. Riprova.';
    res.status(500).json({ error: String(e.message || e), reply: msg });
  }
};
