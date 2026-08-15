const { exigirUsuarioLogado } = require('./_auth');

module.exports = async function handler(req, res) {
  try {
    await exigirUsuarioLogado(req);
  } catch (e) {
    res.status(e.status || 401).json({ error: e.message });
    return;
  }
  const { nome, uf, cep } = req.query;
  const key = process.env.GEOAPIFY_KEY;
  if (!key) {
    res.status(500).json({ error: 'GEOAPIFY_KEY não configurada no servidor.' });
    return;
  }

  let url;
  if (cep) {
    // Busca por CEP: manda o CEP como texto livre pra Geoapify, restrito ao Brasil.
    url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(cep)}&filter=countrycode:br&format=json&limit=1&apiKey=${key}`;
  } else if (nome && uf) {
    url = `https://api.geoapify.com/v1/geocode/search?city=${encodeURIComponent(nome)}&state=${encodeURIComponent(uf)}&country=Brazil&format=json&limit=1&apiKey=${key}`;
  } else {
    res.status(400).json({ error: 'Informe cep, ou nome e uf.' });
    return;
  }

  try {
    const r = await fetch(url);
    const d = await r.json();
    res.status(r.status).json(d);
  } catch (e) {
    res.status(502).json({ error: 'Falha ao consultar a Geoapify.' });
  }
}
