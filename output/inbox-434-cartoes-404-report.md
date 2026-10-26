# Correção cliente da composição #434 — cartões após404

Base386d42f78fb0f170dc5bfdce698836658c1a4df5, filho da #353 e da correção separada #431 R3; este commit contém somente o delta cliente de revogação dos cartões. P2 confirmado pelo TESTER em9664289: histórico SUGERIDA preservado após404 ainda permitia chamar a action fake pelo handler real. Não se afirma bypass servidor/vazamento. Oráculo/relatório original do TESTER lidos; cópia literal preservada no output próprio.

## Contrato e execução

acessoRevogado é um marcador SOMENTE no estado cliente do painel atual, fora de DadosPainelSetor/AriaDoAtendimento.404 ativa o marcador;503 preserva o último valor, inclusive após retry inicial sem DTO; somente200 fresco aceito pela guarda da aquisição existente limpa. GET antigo não limpa depois de revisão mais nova. Histórico/cartões/status permanecem intactos. Nenhum fetch, polling, endpoint, DTO ou política servidor foi acrescentado.

Props opcionais bloqueiam a decisão por ConversaAberta→CartaoSugestaoAria, defaultfalse para consumidores existentes. Não usa simplesmente aria.podeDecidir: produtor autoriza cada cartão por lead, e um cartão pode continuar autorizado com o lead geral não decidível.503 sem404 prévio mantém as decisões conhecidas.200 fresco recupera os controles autorizados sem inventar permissão do snapshot.

O cartão mantém texto/histórico e controles visíveis desabilitados no DOM; o handler também falha fechado. Token próprio por geração/identidade é invalidado no layout ao bloquear/desmontar. Resolver ACK/erro/transporte antigo depois de404 ou depois de404→200 não chama callback, não publica erro antigo nem rouba foco. Retorno de capacidade cria outra geração e decide normalmente. Referências de foco antigas são limpas na mudança de bloqueio; demais regras de foco dos cartões foram mantidas.

## TDD e evidências

- Oráculo original copiado:408cc1 EXIT1,13 casos/12 controles/uma falha, action fake foi chamada após404.
- RED próprioe37cf0 EXIT1:3 arquivos/63 casos,sete falhas/56 controles, marcador/projeção/DOM/ACK ainda não protegidos.
- GREEN931ff1 EXIT0:3 arquivos/63 casos. Acrescentados controle de200 antigo e recuperação mantendo podeDecidir=false.
- O oráculo TESTER substitui ConversaAberta por sua projeção literal antiga, que não podia conhecer a prop opcional nova. Original bytes permanece intacto; cópia separada adaptou SOMENTE a passagem bloqueado:p.bloquearDecisoesAria nessa projeção, sem modificar asserções. Essa cópia passou13/13,20b080 EXIT0. Não alegar green do arquivo literal antigo; o consumidor real ConversaAberta.test também verifica a prop no item da VirtualList.
- Recorte amplo sessão15699/2b130f EXIT0:86 arquivos/1.044 testes, pasta Inbox completa + Compositor.rascunho + guardas botões85/estados-vazios/paginação/paleta/contraste/tipografia. Sem filtros de caso/skips novos, w1/heap1024, não global.
- RED adicional3377ba EXIT1:106 casos/uma falha, retry inicial zerava estado e perdia marcador antes de503. Correção preserva snapshot revogado no retry até200; GREENaa9d2e EXIT0:4 arquivos/170 testes.
- Lint7 2b5b6a EXIT0 --max-warnings=0. Primeiro replay final9/305 sessão99403/ca8edc EXIT0. Controle adicional cobre ACK de rejeição em404→503, ainda bloqueado, e nova tentativa após200. Resultado final registrado abaixo após terminal.

Backend/ACL/produtor/DTO/actions e componentes/hook do handoff352 permanecem literais à base. Sem SQL/DB/INT/lease/TSC/global/build/Next/browser/HTTP/install/config/deps/env/PR/push nesta correção; banco está sob o integrador. QA exata e gates originais/visuais da composição continuam pendentes. Negativos não foram convertidos em aprovação; logs e originais preservados.

GREEN final sessão85294/fd3621 EXIT0:9 arquivos/306 testes completos, w1/heap1024/sem filtro de caso/skip novo, consumidores Inbox/Conversa, cartão/handlers/geração/foco reais, guarda botões85/paleta/contraste. Recheck lint do teste adicionaldb24cf EXIT0 --max-warnings=0; sete fontes/testes tinham lint2b5b6a EXIT0. Prova Git818093 EXIT0:backend/DTO/ACL/produtor/componentes compartilhados/handoff352 literais à base. Nada da #353 ou #431R3 foi reescrito neste delta.

## Composição ROOT na PR #434, antes de #352/#353

O patch foi aplicado sobre a base com filtros R3 e vínculo legado corrigidos. Os conflitos continham contexto do recibo de handoff #352 e da retirada do painel #353, que ainda não pertencem a esta PR. Foram preservados os consumidores, os testes e o PainelAria existentes; acrescentados apenas o marcador cliente, sua propagação ao cartão e os novos controles404. O recibo352 e a remoção353 não foram importados.

As fixtures novas conservam `sugestoes: []` porque esse campo ainda é obrigatório no DTO desta base; não é nova consulta nem alteração de contrato no servidor. O teste de propagação usa a VirtualList real com o observador já existente. A seção documental de353 e seus testes exclusivos permanecem na própria feature. Os resultados DEV acima continuam nominais à sua fonte; TypeScript/recortes/QA da composição ROOT são gates separados, ainda pendentes neste ponto.
