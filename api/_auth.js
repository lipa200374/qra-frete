const { createClient } = require('@supabase/supabase-js');

// Confere se a requisição trouxe um token de sessão válido do Supabase.
// Retorna o usuário autenticado, ou lança um erro que o handler deve
// transformar em resposta 401.
async function exigirUsuarioLogado(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    const err = new Error('Faça login no app para usar este recurso. [sem token enviado]');
    err.status = 401;
    throw err;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const err = new Error('Configuração do servidor incompleta: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.');
    err.status = 500;
    throw err;
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data || !data.user) {
    const detalhe = error ? (error.message || String(error)) : 'usuário não retornado';
    const err = new Error(`Sessão inválida ou expirada. Faça login novamente. [detalhe: ${detalhe}]`);
    err.status = 401;
    throw err;
  }

  return data.user;
}

module.exports = { exigirUsuarioLogado };
