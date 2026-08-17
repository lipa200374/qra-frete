const { createClient } = require('@supabase/supabase-js');
module.exports = async function handler(req,res){
  if(req.method!=='POST'){res.status(405).json({error:'Método não permitido.'});return;}
  try{
    const nome=String(req.body?.nome||'').trim().slice(0,120);
    const telefone=String(req.body?.telefone||'').replace(/\D/g,'').slice(0,20);
    if(!telefone||telefone.length<10){res.status(400).json({error:'Informe o telefone cadastrado.'});return;}
    const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
    const {error}=await supabase.from('solicitacoes_exclusao').insert({nome:nome||null,telefone,status:'pendente'});
    if(error)throw error;
    res.status(200).json({ok:true,message:'Solicitação registrada.'});
  }catch(e){console.error(e);res.status(500).json({error:'Não foi possível registrar sua solicitação.'});}
};
