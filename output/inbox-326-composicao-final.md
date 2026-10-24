# #326 — composição para publicação direta em main

Composição8b91bab362416ba3dd42a99831d5898356e99479 sobre mainae56c00f053e864a3efea35d2f640afe48716cc4 (#325 já mergeada). Portes652c133f(feature2b43),d60380d2(guarda08852),8b91bab3(metadataR1; os quatro SRC já coincidem com main). O único conflito foi o quadro: preservado todo o conteúdo main e acrescentado somente o adendo de duas linhas da feature. Nenhum código325 pendurado em branch-base de outra issue.

ROOT42004/48d232 e TESTER74031/dade9b:21 blobs SRC exatos do freeze6f92673dfb526e11ad1e349bea484d135819e849; diff direto main18 SRC+3MD, sem schema, dependências, workflows ou harness. Backend da edição continua2b43; cache/telefone R1 e aquisição única Detalhes/editor foram compostos preservando foco/Retry. Guardas distinguem HTMLinput.type técnico sem mudar rótulos ou ampliar permissões.

Gates ROOT, todos terminal0: global4382/ccacc3,928 arquivos/7.346 testes,247,36s,maxWorkers2,sem filtro de nome/skips, configuração unitária exclui INT; TSC64248/ae29c1,heap8192/incrementalfalse; lint global96352/cdae87,zero erros/40 avisos herdados,teto40. [Três pareceres independentes](inbox-326-qa/indice.json): código inicial22/504 UNIT e4/44 INT; guarda138 e5/166; conjunto atual24/656 UNIT,TSC/lint21. São fontes/recortes sobrepostos; não somar ou reatribuir uma INT nova.

A gaveta edita seis básicos e cinco tipos personalizados, envia somente o diff e preserva o snapshot de edição sob SSE. Pessoa é resolvida no atendimento; pessoaIdEsperada é precondição CAS, nunca alvoWHERE. Pessoa/campos/eventos/aviso usam a mesma transação, com ator/ACL/contexto relidos após locks. Convite de leitura não concede escrita. API/contratos CRM anteriores preservados.

Rascunho de PR enquanto falta a prova funcional pela interface.2588/2bca76 continua EXIT1 histórico por dois GETabortados sem cronologia; as duas persistências antigas não demonstram falha de Save, mas também não tornam aquela execução aprovada.39 imagens antigas permanecem nominais às fontes históricas, sem recaptura atual.

Preparação nova: plano18 registros/10 modelos, IDs fictícios suplementares; não inclui País/Empresa/Mensagem/Evento pré-fabricado. Helper/README/blueprint lidos integralmente pelo ROOT. Inspect4967db saída0:424 hashes,498 originais,34 chaves naturais/zero colisões,sequências preservadas. Applyf14779 saída0:commit confirmado,18 novos/516 total,498 originais/424 hashes/sequências intactos. Preview B61851/3111 com provedores externos vazios e número MOTOR desconectado. O setup não é o Save planejado.

Observador privado24/24 é prova offline com EventEmitter. Bridge concreto, preflight restrito, uma Save real sem retry, prova DOM/ACK/SSE, fechamento/restauro e QA visual continuam pendentes de coordenação ROOT. Nenhum Save/HTTP/browser foi executado pelo DEV nesta retomada; o preview foi preparado pelo integrador. Não encerrar a issue, presumir homologação, mensagem externa ou deploy.
