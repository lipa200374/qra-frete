const { createClient } = require('@supabase/supabase-js');

const VEIC_LABELS = {
  toco: 'Caminhão toco — 2 eixos',
  truck: 'Caminhão truck — 3 eixos',
  bitruck: 'Caminhão bitruck — 4 eixos',
  c4x2: 'Cavalo mecânico 4x2 — 2 eixos',
  c6x2: 'Cavalo mecânico 6x2 — 3 eixos',
  c6x4: 'Cavalo mecânico 6x4 — 3 eixos',
  c8x4: 'Cavalo mecânico 8x4 — 4 eixos',
};

function formatarTelefone(tel) {
  const d = String(tel || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel || '-';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  // Confere se quem chamou é mesmo o Supabase (e não alguém tentando abusar do endpoint)
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

    const tipoVeiculo = VEIC_LABELS[record.veiculo] || record.veiculo || '-';

    const html = `
      <h2>Cadastro no QRA FRETE</h2>
      <p><b>Nome/QRA:</b> ${record.qra || '-'}</p>
      <p><b>Telefone:</b> ${formatarTelefone(record.telefone)}</p>
      <p><b>CPF:</b> ${record.cpf || '-'}</p>
      <p><b>CEP:</b> ${record.cep || '-'}</p>
      <p><b>Placa do veículo:</b> ${record.placa || '-'}</p>
      <p><b>Tipo de veículo:</b> ${tipoVeiculo}</p>
      <p><b>Data:</b> ${record.updated_at || record.created_at || new Date().toISOString()}</p>
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
        subject: `Cadastro: ${record.qra || 'motorista'}`,
        html,
      }),
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao processar notificação.' });
  }
};
