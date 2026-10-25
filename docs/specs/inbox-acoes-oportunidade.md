# Inbox #328 — experimental e ações da oportunidade

Status: produto DEV implementado e congelado para QA; integração backend, fixture/preview e aceite visual ainda aguardam admissão específica. Não é conclusão/homologação da issue. Base668abe65 da PR427, com a fundação327/328 preservada.

## Escopo entregue

CartaoExperimental é projeção do DTO autorizado da #327. Sem dataExperimental não renderiza; com data, apresenta título/ícone, instante no fuso efetivo com fallback institucional, professor ou Sem professor e status. Prioridade: NO_SHOW → Não compareceu; EXPERIMENTAL_REALIZADA → Realizada; depois confirmação → Confirmada; demais → Agendada. Horário passado não inventa realização. Não há formulário, agendamento, confirmação ou check-in novo no Inbox.

Editar é navegação para o ID já autorizado da oportunidade, codificado no href, somente com podeAbrirFunil. Essa capacidade é distinta de moverEtapa. Convidado contextual sem CRM global continua vendo o cartão sem ganhar o link. Page propaga fusoEscola já consultado, separado do fuso pessoal efetivo, sem nova query. Não depende do timezone do navegador/Node; não há hardcode de cidade.

A seção de ações usa Botao fantasma/md, alvo mínimo44px e ícones17px. Perda só aparece com moverEtapa e o destino D8 PERDIDO retornando marcarPerdido. Botão e barra chamam o mesmo aoAbrirPerda. Encerradas/readonly não ganham perda. Modal, snapshot de sessão/identidade, drafts/ACKs e exclusão mútua com editor permanecem literais da #327.

Assumir conversa usa a ação canônica assumirAtendimento(atendimentoId), com um argumento capturado no callback, fora de qualquer transação CRM. O cliente usa podeExecutar com setor/responsável/linha comercial/dono da linha e guards de aberto/não grupo. Não copia papéis, altera carteira ou adiciona autorização. Callback Promise<Resultado> é tratado pelo executor idempotente, com busy/erro/sucesso. Reconciliação ocorre por aoMudar existente e somente se a instância keyed por atendimento/oportunidade continuar viva. Não há promessa de SSE: a ação existente faz Evento/revalidatePath e não chama avisarAtendimento explicitamente.

Não implementa D3/#357: nenhuma pausa MANUAL, cancelamento de sugestões da Aria, transferência de carteira ou envio. #354 é D1, não D3. O backend de perda, CAS obrigatório3args, núcleoTx, APIs/permissões/helpers, schema/deps, Compositor/ConversaAberta e harness visual não foram alterados.

## Guardas e evidências

Uma entrada exata aprovada em MAPAS_DE_TELA: CartaoExperimental.tsx / if o.etapa. A função deriva o estado da ocorrência de etapa+confirmação; não substitui ETAPA_LABEL. Classificador literal à base após retirar essa única entrada; negativos e exceções anteriores preservados. Finding71152/11c102 permanece negativo. Classes de perigo inicialmente inexistentes foram corrigidas para aliases reais bg-red-50/text-red-700, sem exceção de paleta.

UNIT global76840/115414 EXIT 0:948 arquivos/7.799 testes,303,68s, maxWorkers2, sem filtro/skips, configUNIT excluiINT. TSC original19172/614085 EXIT 0, Node22heap8192,--noEmit--incrementalfalse, semconfigaux/exclusões extras. Lint11arquivos965991 EXIT 0, com lint do teste de foco refeito em fc19c1 após ajuste apenas de tipo. Oráculos incluem20 combinações de status/render, fuso/DST/SSR, alçadas independentes, contexto completo de assumir, clique duplo, erro/ACK antigo, owner/modal/foco.

O teste novo de foco inicialmente exigia o botão da seção; o diagnóstico mediu Fechar painel do contato visível/nãoinert no painel que retoma a propriedade modal. Só o oráculo mudou, sem Modal/Drawer/useDialogo. O DOM mínimo não comprova CSS/foco nativo. TS2339 anterior foi só no tipo do método getClientRects realmente instalado no fixture; preservado e corrigido localmente, sem mascarar produto.

Report output/inbox-328-produto-report.md e manifesto output/inbox-328-produto-fontes.json registram fontes, logs/negativos/gates/proteções. Servidor/helpers/schema/deps/scriptsvisual intactos, owner327/OR420/defaults343 preservados. Nenhuma INT, DB, fixture, preview, browser, Assumir/perda real, envio, captura ou upload nesta entrega. Corpus18 da #327 continua nominal e não comprova o novo cartão. QA independente, backend se admitido, visual e publicação continuam pendentes.
