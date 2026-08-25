const crypto=require('crypto');
const {createClient}=require('@supabase/supabase-js');
const {exigirUsuarioLogado}=require('./_auth');

const ASAAS_API='https://api.asaas.com/v3';
const PRECO_ANUAL=119.90;

function criarReferencia(userId){
  return `qra12m:${userId}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
}

module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
  try{
    const user=await exigirUsuarioLogado(req);
    if(!process.env.ASAAS_API_KEY)throw new Error('ASAAS_API_KEY não configurada.');
    const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
    const ref=criarReferencia(user.id);
    const baseUrl='https://www.qrafrete.com';
    const payload={
      billingTypes:['PIX','CREDIT_CARD'],
      chargeTypes:['DETACHED'],
      minutesToExpire:60,
      externalReference:ref,
      callback:{
        successUrl:`${baseUrl}/?pagamento=sucesso`,
        cancelUrl:`${baseUrl}/?pagamento=cancelado`,
        expiredUrl:`${baseUrl}/?pagamento=expirado`
      },
      items:[{
        externalReference:'qra-frete-12-meses',
        name:'QRA FRETE - 12 meses de acesso',
        description:'Acesso ao QRA FRETE por 12 meses.',
        quantity:1,
        value:PRECO_ANUAL
      }]
    };
    const r=await fetch(`${ASAAS_API}/checkouts`,{
      method:'POST',
      headers:{accept:'application/json','content-type':'application/json',access_token:process.env.ASAAS_API_KEY},
      body:JSON.stringify(payload)
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.id){
      const msg=d?.errors?.map(x=>x.description).filter(Boolean).join(' | ')||'Não foi possível criar o checkout Asaas.';
      throw Object.assign(new Error(msg),{status:r.status||502});
    }
    const link=d.link||`https://asaas.com/checkoutSession/show?id=${encodeURIComponent(d.id)}`;
    const {error:ie}=await supabase.from('pagamentos_asaas_qra').insert({
      checkout_id:d.id,
      user_id:user.id,
      external_reference:ref,
      valor:PRECO_ANUAL,
      status:'ACTIVE',
      checkout_url:link,
      criado_em:new Date().toISOString(),
      atualizado_em:new Date().toISOString()
    });
    if(ie)throw new Error(`Checkout criado, mas não foi possível registrar o pedido no QRA: ${ie.message}`);
    return res.status(200).json({ok:true,url:link,checkout_id:d.id});
  }catch(e){
    console.error('asaas-checkout',e);
    return res.status(e.status||500).json({error:e.message||'Falha ao iniciar pagamento.'});
  }
};
