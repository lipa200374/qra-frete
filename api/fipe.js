// Busca o valor de um veículo na tabela FIPE (caminhões), fazendo correspondência
// aproximada entre o texto de marca/modelo (vindo da consulta de placa) e o
// catálogo oficial da FIPE, que nem sempre usa a mesma grafia.

const FIPE_BASE = 'https://fipe.parallelum.com.br/api/v2';

function normalizar(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function melhorCorrespondencia(alvo, lista, campoNome) {
  const nAlvo = normalizar(alvo);
  if (!nAlvo) return null;
  // 1) começa com o texto
  let achou = lista.find((item) => normalizar(item[campoNome]).startsWith(nAlvo));
  if (achou) return achou;
  // 2) contém como palavra
  achou = lista.find((item) => normalizar(item[campoNome]).split(' ').includes(nAlvo.split(' ')[0]));
  if (achou) return achou;
  // 3) contém como substring
  achou = lista.find((item) => normalizar(item[campoNome]).includes(nAlvo));
  if (achou) return achou;
  // 4) alvo contém o nome do item (para nomes curtos tipo "F-4000")
  achou = lista.find((item) => nAlvo.includes(normalizar(item[campoNome])));
  return achou || null;
}

async function fipeGet(path) {
  const r = await fetch(`${FIPE_BASE}${path}`);
  if (!r.ok) throw new Error(`FIPE respondeu ${r.status} em ${path}`);
  return r.json();
}

const { exigirUsuarioLogado } = require('./_auth');

module.exports = async function handler(req, res) {
  try {
    await exigirUsuarioLogado(req);
  } catch (e) {
    res.status(e.status || 401).json({ error: e.message });
    return;
  }
  const { marca, modelo, ano } = req.query;
  if (!marca || !modelo) {
    res.status(400).json({ error: 'Informe marca e modelo.' });
    return;
  }

  try {
    const marcas = await fipeGet('/trucks/brands');
    const marcaAchada = melhorCorrespondencia(marca, marcas, 'name');
    if (!marcaAchada) {
      res.status(404).json({ error: `Marca "${marca}" não encontrada na FIPE.` });
      return;
    }

    const modelos = await fipeGet(`/trucks/brands/${marcaAchada.code}/models`);
    const modeloAchado = melhorCorrespondencia(modelo, modelos, 'name');
    if (!modeloAchado) {
      res.status(404).json({ error: `Modelo "${modelo}" não encontrado para a marca ${marcaAchada.name}.` });
      return;
    }

    const anos = await fipeGet(`/trucks/brands/${marcaAchada.code}/models/${modeloAchado.code}/years`);
    if (!anos.length) {
      res.status(404).json({ error: 'Nenhum ano disponível para esse modelo na FIPE.' });
      return;
    }
    let anoAchado = null;
    if (ano) {
      anoAchado = anos.find((a) => String(a.name).includes(String(ano))) || null;
    }
    if (!anoAchado) anoAchado = anos[0]; // usa o mais recente disponível como aproximação

    const preco = await fipeGet(
      `/trucks/brands/${marcaAchada.code}/models/${modeloAchado.code}/years/${anoAchado.code}`
    );

    res.status(200).json({
      valor: preco.price,
      marcaFipe: preco.brand,
      modeloFipe: preco.model,
      anoFipe: preco.modelYear,
      codigoFipe: preco.codeFipe,
      referencia: preco.referenceMonth,
      aproximado: !ano || !String(anoAchado.name).includes(String(ano)),
    });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'Não foi possível consultar a FIPE agora. Preencha o valor manualmente.' });
  }
};
