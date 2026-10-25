# Inbox: faixa e resumo de handoff na conversa (#352)

## Contrato

A faixa usa exclusivamente `aria.handoff` do painel autorizado da seleção atual. O estado de lista HANDOFF sozinho não cria a faixa. Mostra o motivo público, `haQuanto(pedidoEm, agora)` usando o relógio SSR já existente e o CTA Ver resumo e assumir quando `podeAssumir`; os demais leitores recebem Ver resumo. Grupos e atendimentos encerrados não recebem a faixa.

O Modal canônico, com folha no mobile, mostra Resumo de handoff, Preparado pela Aria · contato, O que o contato quer, O que a Aria já fez e Próxima ação sugerida quando existe. Resumo ausente usa A Aria não deixou resumo.; lista vazia usa Nenhuma ação registrada. A ordem das ações é a ordem cronológica entregue pelo backend #351. Horas usam o fuso operacional existente, com fallback UTC. Não há inferência de ACL nem aquisição paralela.

`podeAssumir` oferece Assumir e responder; `ehResponsavel` oferece Responder sem chamar assumir; somente leitura oferece Fechar. Quando existe CTA, o único controle de saída do rodapé é Cancelar. Erros usam FeedbackAcao e a tentativa de negócio pode ser repetida com segurança pelo useAcaoCliente idempotente. O Modal real preserva isolamento, Escape, foco inicial e retorno de foco. A nova prop opcional focoAoFechar apenas encaminha a opção existente de useDialogo, mantendo o padrão de todos os outros consumidores.

## ACK, leitura fresca e foco local

A sessão é local ao coordenador com key do atendimento e tem geração própria por abertura/acaoId. ACK, erro ou transporte de A não afetam B nem uma nova instância de A, outra abertura ou outro handoff. Perda de capacidade invalida a tentativa anterior, mesmo se a capacidade voltar.

Após o ACK da action existente assumirAtendimento, `aoMudar` reutiliza o refresh coordenado do InboxNovo. O recibo de leitura contém revisão solicitada, revisão finalizada e resultado do GET de painel já existente. Apenas o recibo OK da revisão atual, posterior ao ACK, com envio vigente e responsável atual, libera a intenção de responder. Um GET antigo ou 503 não libera foco. Retry de confirmação pede outra leitura pelo mesmo refresh; não cria fetch, polling ou SSE.

O handoff pode desaparecer legitimamente do DTO depois de assumir; o snapshot do resumo permanece enquanto se confirma o resultado, sem servir como autorização. O 404 limpa somente as capacidades copiadas de handoff, preservando resumo/histórico e as demais regras existentes. Uma revogação de envio confirmada depois do ACK invalida definitivamente a intenção de foco.

A ponte ConversaAberta → RodapeConversa escolhe Responder por controle local; Compositor publica apenas a ref local do campo Responder. Modal devolve foco a essa ref depois da troca de aba. `data-compositor-campo` identifica o textarea, sem consulta global. Não há remount para obter foco, envio automático ou perda dos rascunhos de resposta/nota.

## Limite explícito de #357

#352 usa a action assumirAtendimento já existente. Ela não implanta modo MANUAL, bloqueio do compositor por política de handoff ou cancelamento de sugestões. D3 já foi aprovado pelo produto; a extensão backend e sua integração são responsabilidade explícita de #357, dependente desta feature. Não declarar D3 concluído a partir desta entrega frontend.

## Testes e aceite

FaixaHandoff.test cobre título/relógio, motivo e capacidades. ModalResumoHandoff.test cobre seções, fallback, responsável e somente leitura. HandoffConversa.interacao.test monta React, Modal/useDialogo, useAcaoCliente, Rodape e Compositor reais; somente a action é substituída na fronteira. Cobre isolamento/Escape/retorno, ACK com GET antigo/503/retry/200, troca e A→B→A, nova sessão, 404, erro de negócio/transporte, revogação antes/depois do ACK, clique duplo e preservação dos dois rascunhos. InboxNovo.aria-eventos.test verifica o recibo real do consumidor e sanitização no 404. ConversaAberta.test verifica o DTO real no consumidor e ausência sem handoff.

A regressão inclui pasta Inbox inteira, consumidores Modal e Compositor, Botao, mapa de botões completo, paleta, contraste e tipografia. Resultados terminais e negativos estão no report. QA independente, build, CI e visual são gates separados do integrador. Matriz visual prevista: dois atores (pode assumir / somente leitura), faixa e modal, 390/1280/1440 e light/dark (24 APP); somente ações falsas em ambiente autorizado, sem captura executada pelo DEV.

### R1: abertura invalidada

Após revogação e retorno da capacidade com o mesmo acaoId, a abertura continua sem CTA de ação e orienta Feche e abra o resumo novamente. Somente fechar e reabrir deliberadamente cria uma geração viva; não há reativação automática. O ciclo do Modal também respeita a invalidação. Resumo e Fechar permanecem disponíveis. O teste real resolve ACK antigo depois de abrir e iniciar a nova tentativa: o antigo não atualiza nem foca; o novo atualiza e só foca após leitura fresca. Cobertura SSR garante ausência de Assumir/Responder/retry mesmo com ambas capacidades devolvidas. Backend #357 continua pendente e literal.

### R2: retenção do resumo após ACK

A espera de confirmação é separada do busy de leitura. Se painel200 já vier sem handoff, a lista ainda não reconciliar o responsável e a leitura seguinte falhar503, o resumo permanece montado com Cancelar e retry de leitura. Não oferece nova action assumir nem Responder a partir do snapshot. Somente o DTO atual participa da autorização; nova leitura fresca com responsável/envio vigentes pode concluir o foco. Cancelamento impede qualquer reconciliação tardia; nova abertura começa outra geração. Nenhuma query, polling ou política backend foi acrescentada.

### R3: vazio e sequência limitada

Feito vazio usa EstadoVazio compacto com o texto Nenhuma ação registrada. O título Próxima ação sugerida é texto de domínio, sem link/cursor de página: classificação nominal coordenada na guarda, preservando parser e asserções. A sequência feito contém no máximo dez últimas ações autorizadas entregues cronologicamente por handoffDoAtendimento (lotes internos100 não são paginação de interface). Teste de mutação no próprio path do Modal exige detectar um link avançar injetado, evitando que a classificação nominal mascare paginação real futura. Backend e hook permanecem inalterados na R3.

### Verificação final da fonte d0e

ROOT verificou d0e987752d045ab8835e12838cc329bb33b6ec12 com TypeScript original67703/7dc488 EXIT0 (sem novas exclusões/config), unitária global UTC51740/ca1ea0 EXIT0 (978 arquivos/8.382 testes, sem filtros/skips) e eslint .7431/c1440c EXIT0 (zero erros/94 avisos). Históricos/cópias privadas causais foram arquivados fisicamente com hashes antes do replay, preservando negativos e fonte.

TESTER revisou o delta exato e executou15 arquivos/222 testes62927/9a962f EXIT0; parecer favorável sem novo achado acionável, relatório SHA25662ce1ca0e1d7589dc6e522b6da98a0a3b0a81e1d09a99d74058eecd3f373a872. Evidências completas no report. Build/CI de publicação e aceite visual permanecem separados; backend #357/D3 segue explicitamente pendente. Este adendo é documental e preserva runtime d0e literal.

### Revisão da PR #437: responder quando já é responsável

O responsável recebe feedback quando a leitura do painel falha ou não confirma a permissão de envio. “Tentar de novo” solicita somente a atualização existente do painel, sem chamar Assumir. Uma intenção aceita durante a leitura pendente só chega ao compositor depois de um recibo atual, bem-sucedido, com responsável e envio válidos. O recibo anterior ao retry não libera foco.

Perder a responsabilidade ou o acesso invalida a abertura. Recuperar a permissão de envio não retoma uma intenção já recusada; é necessário novo pedido explícito. Resumo, rascunhos, identidade da conversa e protocolos de ACK continuam preservados. A chegada de um 200 sem intenção não muda o modo do compositor.

Os testes de assumir e depois responder já estão em `HandoffConversa.interacao.test.ts`, nos casos de ACK atual e de preservação dos dois rascunhos; o nome do plano é uma referência de comportamento. O relatório versionado registra evidências exigidas pelo quadro do repositório; capturas, credenciais e logs privados ficam fora do diff. Build, visual e CI continuam gates separados.
