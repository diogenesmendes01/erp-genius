# Inbox — Insights D12 (#377)

Estado: kernel privado e integração API/UI implementados; nativos do kernel e dos wrappers passaram nas fontes qualificadas abaixo. QA independente, visual e gates originais integrados continuam pendentes. Não homologada.

## Produto e audiência

A análise completa é gerada somente pelo clique explícito em Atualizar. Mostra data de geração e quantidade de novas mensagens não analisadas. Usar como rascunho e Escrever com Aria consomem exatamente o mesmo texto sugerido persistido. Nenhum desses controles assume, envia, agenda ou gera uma segunda variante automaticamente.

A audiência é COMERCIAL + veLead contextual, como #334. Não há nova permissão global nem requisito extra de Assumir/status para gerar Insights. A row do ator é relida na conexão recebida após locks; ativo=false ou apenasPortal canônico negam acesso mesmo com convite/veLead remanescentes. Papéis vazios não são rejeitados por uma regra nova genérica. Compatibilidade de Pessoa recusa somente quando ambas referências explícitas divergem; null não inventa Pessoa, fallback por telefone ou overwrite. O hash inclui todos os ponteiros crus relevantes, inclusive null.

Gerar/publicar exige compatibilidade; resolver metadata de uma tentativa INCERTO usa a audiência operacional atual, inclusive após retarget. Capacidade operacional de descarte é separada da capacidade de geração, mantendo os dois sinalizadores do DTO coerentes sem liberar análise antiga.

## Saída e contexto

A saída fechada contém temperatura estimada, chance de fechar, sentimento, melhor horário, intenção, sinais de compra, objeções/riscos, próximo melhor passo e texto sugerido. Ausência de evidência produz null/listas vazias; não altera campos manuais do CRM, etapa, carteira, régua ou tarefas. Rejeita extras, enums desconhecidos, chance fora de 0 a 100, JSON com markdown/prefixos, mais de 8 itens, textos curtos acima de 500 e sugestão acima de 4.000.

O contexto usa somente mensagens do atendimento autorizado: até 30 recentes, por criadoEm/id, excluindo apagadas/sem texto e saídas ainda não enviadas. Mascaramento obrigatório limita cada fala a 2.000 e o conjunto a 24.000 caracteres; não equivale anonimização perfeita. IDs/hash não entram no pedido do modelo. Prompt trata mensagens/configuração/referências como dados, projeta sete campos CRM por lista fechada e usa maxTokens 2048.

SnapshotJSON v1 guarda configuração validada, nomes de campos autorizados e base com data/hash de referências, sem texto das mensagens/prompt/chaves. START relê e congela a base efetivamente enviada no mesmo CAS da marca de início. Watermark(data,id) é independente de JOIN à última mensagem, que pode ser removida; exclusão isolada não conta como mensagem nova.

## Claim, início e recuperação

Claim: ConfigIA SHARE → AgenteIA SHARE → Atendimento NO KEY UPDATE → geração. START: ConfigIA SHARE → Atendimento → geração. Finalização/operações: Atendimento → geração. ACL/binding/ator são revalidados após esperas. Config ausente é indisponível; não há upsert do orçamento sob SHARE. Não se afirma ausência geral de deadlock.

GeracaoInsightInbox tem seis estados, versão CAS e índice parcial único por atendimento em PROCESSANDO/INCERTO. Configuração publicada é soberana; ausência usa configPadrao canônico, nunca rascunho ou fallback silencioso para publicada inválida. Modelo, configuração e preços do claim são imutáveis. O orçamento global atual é rechecado em UTC antes START, sem alterar o snapshot.

Config ausente ou orçamento esgotado comprovadamente antes da marca termina FALHOU, sem provider/ChamadaIA de custo zero fictícia. O recibo mantém id/estado/versão CONFIRMADA e mensagem humana fechada, após commit. Corrigir o orçamento não dispara retry: novo clique explícito usa chave nova. Replay da chave FALHOU não chama provider.

NOVO recebe chaveTentativa; RETOMAR recebe geração/versão/hash atual, somente autor original e contexto original válido, com inícioNULL. A chave original permanece interna. CAS elege um executor; outro autor não se apropria. Pré-start original realmente inválido pode terminar RECUSADA antes de uma nova intenção, sem reatribuir autor/contexto. Tentativas iniciadas e INCERTO nunca sofrem limpeza/TTL-reclaim automático.

Provider fica fora da TX e é chamado uma vez. Orquestrador tenta apenas persistência até duas vezes com o mesmo envelope/recebidoEm. Duas falhas retornam statusPersistencia NAO_CONFIRMADA e estado conhecido ANTES da finalização, sem afirmar estado atual, resultado ou custo salvo. GET posterior autorizado resolve o terminal real sem novo POST. Nenhum endpoint aceita envelope, custo, autor, modelo, provider ou demo do browser.

Reconciliação é explícita, com confirmação canônica: o pedido pode ainda estar em andamento e a operação não cancela gasto. Usa ator operacional atual autorizado, hash atual esperado, versão CAS e nova chave no Evento; não exige expor chave/autor/contexto antigo, não retargeta nem publica resultado. PROCESSANDO iniciado vira INCERTO; descarte explícito vira DESCARTADA e informa que outra tentativa pode gerar novo custo. Replays exatos após ACL/binding frescos não duplicam Evento/aviso.

## Custo e transporte

Conhecimento de uso exige quatro contagens explícitas válidas e modelo observado canônico compatível com o snapshot. Usage parcial/ausente ou modelo ausente/desconhecido/divergente não são completados com zeros/modelo pedido. JSON inválido/recusa preservam uso conhecido. Preços históricos incluem faixa longa/fator de escrita de cache; finalização não consulta configuração/preços atuais.

ChamadaIA INSIGHT, FK da geração, terminal/Evento/aviso são atômicos. Custo conhecido persiste mesmo com ACL/binding revogados impedindo publicação; negativa de publicação não lança rollback do custo. Somente PROCESSANDO viva publica. Resposta tardia em INCERTO/DESCARTADA contabiliza uma vez, sem publicar/reviver. Incerteza não significa custo0; falha definitiva de persistência pode perder o envelope em memória, sem outbox ou recuperação automática inventados.

Provider existente Anthropic/simulado; nenhum SDK OpenAI novo. Controle é opt-in: deadline total de 30 segundos incluindo body, nenhum retry, abort classificado antes/depois do envio e limpeza de timer/listener. Defaults/argumentos/bytes e retry legados preservados. Demo é explicitamente simulada e somente server/teste, nunca input público; produção sem provider fica indisponível e conserva histórico autorizado. Fechar UI não promete cancelar gasto iniciado. Nenhuma API real/chave foi usada nestas provas.

## API e interface

GET /api/inbox/atendimentos/[id]/insights aceita somente geracaoId opcional validado, intersecta a geração ao atendimento atual e usa leitura RepeatableRead sem mutação/provider. Sessão/PAPEIS_INBOX e apenas-portal canônicos: 401/403; fora do escopo, 404 sem revelar existência; falha transitória, 503/no-store. Provider indisponível retorna200 com DTO indisponível/histórico autorizado. Metadata operacional contém somente id/estado/versão/iniciada e hash atual opaco. Resultado somente PRONTA/contexto atual compatível, sem payload/autor/chaves/pointers antigos.

ServerActions nominais atualizarInsightNoInbox, reconciliarInsightNoInbox e descartarInsightNoInbox usam apenas identidade da sessão e núcleos específicos. API global Resultado, DTO334 e permissões globais permanecem intactos.

A aba é oferecida no COMERCIAL individual com veLead contextual. Atualizar/retomar são explícitos; geração ativa bloqueia nova geração. Sequência de GET posterior ao ACK impede usar SSE/GET antigo como confirmação. NAO_CONFIRMADA não repete provider; só leitura fresca da geração selecionada libera resolução explícita. A→B→A, fechamento, revogação e versões obsoletas invalidam intenções. ConfirmarAcao real protege reconciliação/descarte e sobrescrita.

A ponte opt-in publica somente Responder vigente, disponível, podeEnviar=true e sem bloqueio externo. Compositor é o único writer, confere montagem/contexto/revisão e mantém o mesmo campo físico, anexo, Nota e modo. Não seleciona aba, foca, assume ou envia. Digitação humana invalida a confirmação antiga.

DialogoAgendar faz GET somente enquanto aberto, mesmo sem visitar Insights. Usa os mesmos bytes persistidos, sem provider/auto-preenchimento/foco. Texto existente exige confirmação real; refresh/SSE por versaoInsights, mudança de geração/contexto/revisão, reabertura e GET tardio invalidam confirmação antiga.404/503/sem sugestão não apagam texto nem impedem agendamento manual. Payload/validação/permissão de agendar nativos preservados; D11 completo continua dependente das frentes próprias.

## Infraestrutura, provas e pendências

A493 foi validada/gerada/aplicada exclusivamente pelo ROOT; client 72b4825a,425 tabelas e baseline de 559 linhas. FKs históricas Restrict e retenção são escolhas deliberadas, sem alegação de purga equivalente. Schema SHA 257b91c e SQL SHA 241ee9 congelados. Restaurador A é exclusivamente 493, nunca 492.

Kernel anterior338899e8:4 INT/25 casos reais passaram, incluindo LISTEN/KEYSHARE/pool1/ACKlost; qualificação e negativo de instrumentação na QA. Após essa fonte, o controlador ganhou somente mensagem de pré-envio e o contexto a barreira apenasPortal na rowfresh. Os nove casos nativos dos wrappers passaram na fonte e3590209, sessão56492/03fe13 EXIT0, incluindo os dois deltas posteriores. UI/API/consumidores: 41 arquivos/566 testes e 12 guardas/462 casos passaram em recortes; não suíte global. QA independente, TypeScript/global/lint/build integrados, visual e CI continuam pendentes. [Evidências](../qa/inbox-377-insights-d12.md).
