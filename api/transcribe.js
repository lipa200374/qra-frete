module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }
  const { audio, mime } = req.body || {};
  if (!audio) {
    res.status(400).json({ error: 'Áudio ausente.' });
    return;
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'OPENAI_API_KEY não configurada no servidor.' });
    return;
  }
  try {
    const buffer = Buffer.from(audio, 'base64');
    const blob = new Blob([buffer], { type: mime || 'audio/webm' });
    const form = new FormData();
    form.append('file', blob, 'audio.webm');
    form.append('model', 'whisper-1');
    form.append('language', 'pt');
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d) {
      res.status(r.status || 502).json({ error: (d && d.error && d.error.message) || 'Falha na transcrição.' });
      return;
    }
    res.status(200).json({ text: d.text || '' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao processar áudio.' });
  }
};
