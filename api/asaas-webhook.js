const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const PRECO_ANUAL = 119.90;

function normalizarToken(v) {
  if (Array.isArray(v)) v = v[0];
  return String(v || '').trim();
}

function seguroIgual(a, b) {
  const aa = Buffer.from(normalizarToken(a));
  const bb = Buffer.from(normalizarToken(b));

  return (
    aa.length === bb.length &&
    aa.length > 0 &&
    crypto.timingSafeEqual(aa, bb)
  );
}

function fingerprint(v) {
  const t = normalizarToken(v);
  if (!t) return 'vazio';

  return crypto
    .createHash('sha256')
    .update(t)
    .digest('hex')
    .slice(0, 10);
}

function obterBody(req) {
  if (!req.body) return {};

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

module.exports = async function handler(req, res) {
  const logId =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : crypto.randomBytes(8).toString('hex');

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido.'
    });
  }

  try {

    const esperado = normalizarToken(
      process.env.ASAAS_WEBHOOK_TOKEN
    );

    if (!esperado) {
      console.error('asaas-webhook-config', {
        logId,
        erro: 'ASAAS_WEBHOOK_TOKEN ausente no ambiente da Vercel.'
      });

      return res.status(500).json({
        error: 'Webhook temporariamente indisponível.',
        logId
      });
    }

    if (!process.env.SUPABASE_URL) {
      console.error('asaas-webhook-config', {
        logId,
        erro: 'SUPABASE_URL ausente no ambiente da Vercel.'
      });

      return res.status(500).json({
        error: 'Webhook temporariamente indisponível.',
        logId
      });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('asaas-webhook-config', {
        logId,
        erro: 'SUPABASE_SERVICE_ROLE_KEY ausente no ambiente da Vercel.'
      });

      return res.status(500).json({
        error: 'Webhook temporariamente indisponível.',
        logId
      });
    }

    const recebido = normalizarToken(
      req.headers['asaas-access-token']
    );

    if (!seguroIgual(recebido, esperado)) {
      console.error('asaas-webhook-auth', {
        logId,
        headerPresente: Boolean(recebido),
        recebidoLen: recebido.length,
        esperadoLen: esperado.length,
        recebidoFp: fingerprint(recebido),
        esperadoFp: fingerprint(esperado)
      });

      return res.status(401).json({
        error: 'Webhook não autorizado.',
        logId
      });
    }

    const body = obterBody(req);

    if (body.event !== 'CHECKOUT_PAID') {
      return res.status(200).json({
        ok: true,
        ignored: true,
        event: body.event || null
      });
    }

    const eventId = String(body.id || '').trim();
    const checkout = body.checkout || {};
    const checkoutId = String(checkout.id || '').trim();
    const checkoutStatus = String(
      checkout.status || ''
    ).trim().toUpperCase();

    if (!eventId) {
      console.error('asaas-webhook-payload', {
        logId,
        erro: 'Evento CHECKOUT_PAID sem id.'
      });

      return res.status(400).json({
        error: 'Evento sem identificador.',
        logId
      });
    }

    if (!checkoutId || checkoutStatus !== 'PAID') {
      console.error('asaas-webhook-payload', {
        logId,
        eventId,
        checkoutId: checkoutId || null,
        checkoutStatus: checkoutStatus || null,
        erro: 'Checkout inválido ou ainda não pago.'
      });

      return res.status(400).json({
        error: 'Checkout inválido.',
        logId
      });
    }

    if (
      !Array.isArray(checkout.chargeTypes) ||
      !checkout.chargeTypes.includes('DETACHED')
    ) {
      console.error('asaas-webhook-payload', {
        logId,
        eventId,
        checkoutId,
        chargeTypes: checkout.chargeTypes || null,
        erro: 'Tipo de cobrança diferente de DETACHED.'
      });

      return res.status(400).json({
        error: 'Tipo de cobrança inesperado.',
        logId
      });
    }

    const itens = Array.isArray(checkout.items)
      ? checkout.items
      : [];

    const total = itens.reduce((soma, item) => {
      const valor = Number(item?.value || 0);
      const quantidade = Number(item?.quantity || 0);

      return soma + valor * quantidade;
    }, 0);

    const valorFinal = Number(total.toFixed(2));

    if (Math.abs(valorFinal - PRECO_ANUAL) > 0.009) {
      console.error('asaas-webhook-valor', {
        logId,
        eventId,
        checkoutId,
        recebido: valorFinal,
        esperado: PRECO_ANUAL
      });

      return res.status(400).json({
        error: 'Valor do checkout não confere.',
        logId
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    console.log('asaas-webhook-rpc-inicio', {
      logId,
      eventId,
      checkoutId,
      valor: valorFinal
    });

    const { data, error } = await supabase.rpc(
      'processar_checkout_asaas_qra',
      {
        p_checkout_id: checkoutId,
        p_event_id: eventId,
        p_valor: valorFinal
      }
    );

    if (error) {
      console.error('asaas-webhook-rpc-erro', {
        logId,
        eventId,
        checkoutId,
        code: error.code || null,
        message: error.message || null,
        details: error.details || null,
        hint: error.hint || null
      });

      throw new Error(
        `Falha Supabase RPC${error.code ? ` (${error.code})` : ''}`
      );
    }

    console.log('asaas-webhook-sucesso', {
      logId,
      eventId,
      checkoutId,
      result: data
    });

    return res.status(200).json({
      ok: true,
      logId,
      result: data
    });

  } catch (e) {

    console.error('asaas-webhook-fatal', {
      logId,
      message: e?.message || String(e),
      stack: e?.stack || null
    });

    return res.status(500).json({
      error: 'Falha ao processar webhook.',
      logId
    });
  }
};
