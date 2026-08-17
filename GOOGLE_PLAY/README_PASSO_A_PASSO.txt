QRA FRETE — PREPARAÇÃO GOOGLE PLAY / TWA
Data: 17/08/2026

PACOTE FINAL ESCOLHIDO
- Package name: com.qrafrete.app
- Produto Google Play: qra_acesso_anual_12m
- Preço pretendido: R$ 119,90
- Direito concedido: 12 meses de uso do QRA FRETE
- Experimentação: 3 cálculos gratuitos antes da compra

1) NÃO EXISTE AAB FINAL AINDA
Correto. Não gere o AAB antes de concluir os passos abaixo.

2) PACKAGE NAME
Usar no Bubblewrap: com.qrafrete.app
Não publicar um AAB com o package antigo app.vercel.qrafretevercel_25.twa.

3) BUBBLEWRAP / API 36
Instalar Bubblewrap 1.25.0 ou superior:
  npm install -g @bubblewrap/cli@1.25.0

Depois que esta versão web estiver publicada em https://www.qrafrete.com:
  bubblewrap init --manifest=https://www.qrafrete.com/manifest.json

Durante o init, informar package/application ID:
  com.qrafrete.app

No twa-manifest.json, habilitar Play Billing:
  "features": { "playBilling": { "enabled": true } },
  "alphaDependencies": { "enabled": true }

Executar:
  bubblewrap update

Antes do build, conferir app/build.gradle e confirmar:
  targetSdkVersion 36
  compileSdkVersion 36

4) CHAVE DE ASSINATURA / ASSETLINKS
O Bubblewrap pedirá/criará uma chave Android. GUARDE essa chave e a senha em local seguro.
Depois do primeiro AAB ser enviado ao Play Console com Play App Signing habilitado, abra Setup/Configuração → App integrity/Integridade do app e copie o SHA-256 do certificado da APP SIGNING KEY (chave de assinatura do app). Esse é o fingerprint obrigatório para a versão instalada pela Google Play.

Se quiser testar também uma build instalada fora da Play Store, é possível acrescentar outro fingerprint no mesmo assetlinks para a chave local/upload, mas o fingerprint da App Signing Key deve estar presente no arquivo final.

Substitua FINGERPRINT_SHA256_AQUI no arquivo assetlinks.com.qrafrete.app.template.json e publique o JSON final em:
  https://www.qrafrete.com/.well-known/assetlinks.json

Não trate o assetlinks atual como final: ele ainda representa o package antigo. O assetlinks definitivo só pode ser fechado após conhecer o SHA-256 da App Signing Key da Google Play.

5) PRODUTO NO PLAY CONSOLE
Criar um produto no app com ID EXATO:
  qra_acesso_anual_12m

Preço Brasil:
  R$ 119,90

Modelo desta implementação: produto único/consumível que concede 12 meses no backend QRA. Após validação server-side, o QRA registra a validade e consome o SKU no backend para permitir nova compra/renovação futura.

6) PLAY BILLING — CONFIGURAÇÃO DO BACKEND
Criar credencial de Service Account com acesso apropriado à Google Play Developer API e cadastrar na Vercel:
  GOOGLE_PLAY_PACKAGE_NAME=com.qrafrete.app
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=<JSON COMPLETO DA SERVICE ACCOUNT>

A variável deve ficar somente na Vercel; nunca no GitHub/index.html.

O endpoint já preparado é:
  /api/play-purchase

Ele:
- exige login QRA;
- valida productId e purchaseToken na Google Play Developer API;
- impede reutilização do mesmo token em outra conta;
- concede 12 meses no Supabase;
- reconhece a compra no Google Play.

7) TESTE
Depois do primeiro AAB de teste:
- criar faixa de teste interno/fechado;
- instalar pela Google Play (não apenas abrir URL web);
- testar compra com testador/licença de teste;
- confirmar no painel QRA que o acesso passou a ATIVO e ganhou 12 meses.

8) AAB
Somente depois:
  bubblewrap build

O AAB gerado deve usar package com.qrafrete.app e target API 36.
