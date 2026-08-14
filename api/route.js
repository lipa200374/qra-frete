const { exigirUsuarioLogado } = require('./_auth');
module.exports = async function handler(req, res) {
  try {
    await exigirUsuarioLogado(req);
  } catch (e) {
    res.status(e.status || 401).json({ error: e.message });
    return;
  }
  const { waypoints, mode } = req.query;
  if (!waypoints || !mode) {
    res.status(400).json({ error: 'Parâmetros waypoints e mode são obrigatórios.' });
    return;
  }
  const key = process.env.GEOAPIFY_KEY;
  if (!key) {
    res.status(500).json({ error: 'GEOAPIFY_KEY não configurada no servidor.' });
    return;
  }
  const url = `https://api.geoapify.com/v1/routing?waypoints=${encodeURIComponent(waypoints)}&mode=${encodeURIComponent(mode)}&format=json&units=metric&lang=pt-BR&type=balanced&apiKey=${key}`;
  try {
    const r = await fetch(url);
    const d = await r.json();
    res.status(r.status).json(d);
  } catch (e) {
    res.status(502).json({ error: 'Falha ao consultar a rota na Geoapify.' });
  }
}
