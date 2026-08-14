const { exigirUsuarioLogado } = require('./_auth');
module.exports = async function handler(req, res) {
  try {
    await exigirUsuarioLogado(req);
  } catch (e) {
    res.status(e.status || 401).json({ error: e.message });
    return;
  }
  const { placa } = req.query;
  if (!placa) {
    res.status(400).json({ error: 'Parâmetro placa é obrigatório.' });
    return;
  }
  const token = process.env.PUXAPLACA_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'PUXAPLACA_TOKEN não configurado no servidor.' });
    return;
  }
  const url = `https://api.puxaplaca.app/v2/consulta/${encodeURIComponent(placa)}`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json', token } });
    const d = await r.json().catch(() => null);
    res.status(r.status).json(d);
  } catch (e) {
    res.status(502).json({ error: 'Falha ao consultar a Puxar Placa.' });
  }
}
