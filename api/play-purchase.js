const crypto=require('crypto');
const {createClient}=require('@supabase/supabase-js');
const {exigirUsuarioLogado}=require('./_auth');
const PACKAGE_NAME=process.env.GOOGLE_PLAY_PACKAGE_NAME||'com.qrafrete.app';
const PRODUCT_ID='qra_acesso_anual_12m';
function b64url(v){return Buffer.from(v).toString('base64url')}
async function googleAccessToken(){
  const raw=process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if(!raw)throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON não configurada.');
  const sa=JSON.parse(raw);
  const now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claim=b64url(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/androidpublisher',aud:sa.token_uri||'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const input=`${header}.${claim}`;
  const sign=crypto.createSign('RSA-SHA256');sign.update(input);sign.end();
  const assertion=`${input}.${sign.sign(sa.private_key).toString('base64url')}`;
  const r=await fetch(sa.token_uri||'https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  const d=await r.json();if(!r.ok||!d.access_token)throw new Error(d.error_description||'Falha ao autenticar na Google Play API.');return d.access_token;
}
module.exports=async function handler(req,res){
  if(req.method!=='POST'){res.status(405).json({error:'Método não permitido.'});return;}
  try{
    const user=await exigirUsuarioLogado(req);
    const productId=String(req.body?.productId||'');const purchaseToken=String(req.body?.purchaseToken||'');
    if(productId!==PRODUCT_ID||!purchaseToken)throw Object.assign(new Error('Compra inválida.'),{status:400});
    const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
    const {data:existing}=await supabase.from('acessos_qra').select('user_id,acesso_ate,purchase_token').eq('purchase_token',purchaseToken).maybeSingle();
    if(existing){if(existing.user_id!==user.id)throw Object.assign(new Error('Compra já vinculada a outra conta.'),{status:409});return res.status(200).json({ok:true,acesso_ate:existing.acesso_ate,idempotent:true});}
    const at=await googleAccessToken();
    const base=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PACKAGE_NAME)}/purchases/products/${encodeURIComponent(PRODUCT_ID)}/tokens/${encodeURIComponent(purchaseToken)}`;
    const vr=await fetch(base,{headers:{Authorization:`Bearer ${at}`}});const vd=await vr.json();
    if(!vr.ok||Number(vd.purchaseState)!==0)throw Object.assign(new Error('Compra não confirmada pela Google Play.'),{status:402});
    const {data:cur}=await supabase.from('acessos_qra').select('acesso_ate').eq('user_id',user.id).maybeSingle();
    const now=new Date();const atual=cur?.acesso_ate?new Date(cur.acesso_ate):null;const baseDate=atual&&atual>now?atual:now;const until=new Date(baseDate);until.setFullYear(until.getFullYear()+1);
    const {error:ue}=await supabase.from('acessos_qra').upsert({user_id:user.id,status:'ativo',acesso_ate:until.toISOString(),origem:'google_play',produto_id:PRODUCT_ID,purchase_token:purchaseToken,order_id:vd.orderId||null,observacao:'Acesso anual QRA FRETE — R$ 119,90',atualizado_em:new Date().toISOString()},{onConflict:'user_id'});if(ue)throw ue;
    const consumeUrl=base+':consume';const cr=await fetch(consumeUrl,{method:'POST',headers:{Authorization:`Bearer ${at}`,'Content-Type':'application/json'},body:'{}'});if(!cr.ok&&cr.status!==409){console.warn('Consume Google Play retornou',cr.status);throw Object.assign(new Error('Acesso concedido, mas a compra ainda precisa ser reconciliada com a Google Play.'),{status:502});}
    res.status(200).json({ok:true,acesso_ate:until.toISOString()});
  }catch(e){console.error(e);res.status(e.status||500).json({error:e.message||'Falha ao validar compra.'});}
};
