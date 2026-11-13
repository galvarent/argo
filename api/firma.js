// GET /api/firma -> impronte SHA-1 dei file pubblicati (controllo di integrità del deploy)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
module.exports = (req, res) => {
  const out = {};
  for (const f of ['public/index.html', 'public/icon-180.png', 'public/manifest.webmanifest', 'lib/core.js', 'api/chat.js', 'api/data.js']) {
    try { out[f] = crypto.createHash('sha1').update(fs.readFileSync(path.join(process.cwd(), f))).digest('hex'); } catch { out[f] = null; }
  }
  res.status(200).json(out);
};
