const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const secret = req.headers['x-qra-secret'];
  if (!secret || secret !== process.env.QRA_WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  const record = req.body && req.body.record;
  if (!record) {
    res.status(400).json({ error: 'Payload sem "record".' });
    return;
  }

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: cfg } = await supabaseAdmin
      .from('bank_config')
      .select('notify_emails')
      .eq('id', 1)
      .maybeSingle();

    const emails = (cfg?.notify_emails || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (!emails.length) {
      res.status(200).json({ skipped: 'Nenhum e-mail configurado no Admin.' });
      return;
    }

    const html = `
      <h2>Novo interesse na oferta do banco parceiro</h2>
      <p><b>Nome:</b> ${record.nome || '-'}</p>
      <p><b>Telefone:</b> ${record.telefone || '-'}</p>
      <p><b>CPF:</b> ${record.cpf || '-'}</p>
      <p><b>Cidade base:</b> ${record.cidade_base || '-'}</p>
      <p><b>Veículo:</b> ${record.veiculo_tipo || '-'} • ${record.total_eixos || '-'} eixos</p>
      <p><b>Placa:</b> ${record.placa_mascarada || '-'} — ${record.marca || ''} ${record.modelo || ''} ${record.ano || ''}</p>
      <p><b>Última rota calculada:</b> ${record.ultima_rota || '-'} (${record.ultimo_km || '-'} km)</p>
      <p><b>Oferta:</b> ${record.banco || '-'} — ${record.tipo_oferta || '-'}</p>
      <p><b>Data:</b> ${record.criado_em || new Date().toISOString()}</p>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'QRA FRETE <notificacoes@ragagiglobal.com>',
        to: emails,
        subject: `Novo interesse no banco: ${record.nome || 'motorista'}`,
        html,
      }),
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao processar notificação.' });
  }
};
