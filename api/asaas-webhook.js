const {createClient}=require('@supabase/supabase-js');

function seguroIgual(a,b){
  const aa=Buffer.from(String(a||''));const bb=Buffer.from(String(b||''));
  return aa.length===bb.length && aa.length>0 && require('crypto').timingSafeEqual(aa,bb);
}

module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
  try{
    const recebido=req.headers['asaas-access-token'];
    if(!process.env.ASAAS_WEBHOOK_TOKEN||!seguroIgual(recebido,process.env.ASAAS_WEBHOOK_TOKEN)){
      return res.status(401).json({error:'Webhook não autorizado.'});
    }
    const body=req.body||{};
    if(body.event!=='CHECKOUT_PAID')return res.status(200).json({ok:true,ignored:true});
    const checkout=body.checkout||{};
    if(!checkout.id||String(checkout.status||'').toUpperCase()!=='PAID'){
      return res.status(200).json({ok:true,ignored:true});
    }
    if(!Array.isArray(checkout.chargeTypes)||!checkout.chargeTypes.includes('DETACHED')){
      return res.status(400).json({error:'Tipo de cobrança inesperado.'});
    }
    const total=(Array.isArray(checkout.items)?checkout.items:[]).reduce((s,i)=>s+(Number(i.value||0)*Number(i.quantity||0)),0);
    if(Math.abs(total-119.90)>0.009)return res.status(400).json({error:'Valor do checkout não confere.'});

    const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
    const {data,error}=await supabase.rpc('processar_checkout_asaas_qra',{
      p_checkout_id:String(checkout.id),
      p_event_id:String(body.id||''),
      p_valor:Number(total.toFixed(2))
    });
    if(error)throw error;
    return res.status(200).json({ok:true,result:data});
  }catch(e){
    console.error('asaas-webhook',e);
    return res.status(500).json({error:e.message||'Falha ao processar webhook.'});
  }
};
