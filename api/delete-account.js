const { createClient } = require('@supabase/supabase-js');
const { exigirUsuarioLogado } = require('./_auth');
module.exports = async function handler(req,res){
  if(req.method!=='DELETE'){res.status(405).json({error:'Método não permitido.'});return;}
  try{
    const user=await exigirUsuarioLogado(req);
    const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
    const {error}=await supabase.auth.admin.deleteUser(user.id);
    if(error)throw error;
    res.status(200).json({ok:true});
  }catch(e){console.error(e);res.status(e.status||500).json({error:e.message||'Falha ao excluir conta.'});}
};
