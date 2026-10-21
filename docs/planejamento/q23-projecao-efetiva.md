# Q23 — mapa de integração para publicação da correção

Leitura do código em 15/09/2026, atualizada no incremento 458. A persistência, os leitores acadêmicos e a revisão de progressão estão integrados. A ação pública de publicação reutiliza a coleta transacional e confere o hash dentro da operação. Casos com dependências financeiras ou reposições afetadas permanecem pendentes de integração; o bloqueio atual não encerra esse escopo.

## Fonte e cadeia de versões

`correcao-aula-tx.ts` e o guard atualizado pela migration 206 usam a última correção aprovada como fonte vigente. Originais e decisões são preservados. A rejeição (205) é incompatível com a aprovação (206), inclusive em concorrência SQL. O comando público está disponível para casos sem as dependências ainda não resolvidas, com revalidação, decisão independente, evento e repetição idempotente.

## Leituras afetadas

| Área | Pontos atuais | Integração necessária |
| --- | --- | --- |
| Frequência | `avaliacoes/frequencia-nivel-tx.ts`, `apurarFontesFrequenciaNivelTx` | Projeção por registro/aluno/matrícula integrada. A persistência da aprovação agora cria os casos de progressão na mesma transação (208). |
| Fechamento | `avaliacoes/fechamento-estado-tx.ts` | Consumir a frequência efetiva e manter hashes consistentes entre revisão e confirmação. A simulação não é fechamento persistido. |
| Pedido/decisão de reposição | `diario/reposicao-individual.ts`; guards da migration 207 | Fonte efetiva integrada. Presença corrigida impede novo atendimento; rejeição resolve pedido antigo sem apagar histórico. Ainda tratar dependências já autorizadas/concluídas na publicação. |
| Agenda da reposição | `diario/reposicao-agenda-tx.ts`, `conferirOrigemAtiva` | Origem efetiva integrada à conferência e à nova associação SQL. Agendas existentes precisam de tratamento explícito dos impactos. |
| Filas de reposição | `diario/reposicao-consulta.ts` | Classificação vigente e presença corrigida integradas às consultas e telas; nenhuma conclusão automática. |
| Horas pagas | `matricula/consumo-horas.ts`, `diario/estado.ts`; guards de integridade/contexto de consumo | Um consumo é fato financeiro existente. Correção não pode desfazer, repetir ou alterar sua prova silenciosamente; vincular à conferência financeira aplicável. |
| Diário | `diario/consultas.ts`, `listarAulasDiario` | Conteúdo/participação/observação efetivos integrados, com marcador de versão publicada e escopo docente preservado. |

## Fontes que não devem receber a projeção indiscriminadamente

- `chamada-encontro.ts`, `acoes.ts`, `particular.ts` e `conclusao-contexto.ts` preparam ou concluem encontros PREVISTO. Q23 corrige AULA já MINISTRADA; não transformar edição inicial em correção.
- `frequencia-reposicoes-tx.ts` e o guard de integridade da conclusão particular de reposição leem o diário do encontro de finalidade REPOSICAO. Esse diário não é a AULA original de Q23.
- Verificações de existência de diário para congelar regras institucionais continuam tendo valor histórico; a correção não remove essa existência.

## Publicação ainda necessária

No incremento 464, pedidos autorizados sem conclusão podem continuar com confirmação explícita quando a mudança é entre FALTA e IMPEDIDO_POR_RESTRICAO. Ambas mantêm a ausência e não criam regularização. Os pedidos continuados ficam separados das conclusões preservadas no snapshot e no evento. A passagem da origem para PRESENTE ainda exige resolução específica dos atendimentos não concluídos.

No incremento 462, a gestão pode confirmar explicitamente a preservação de reposições concluídas reconhecidas pelo leitor efetivo de frequência, sem correção Q54 vigente aguardando decisão. A aprovação guarda os pedidos preservados e mantém as provas originais. Ainda faltam resolver reposições autorizadas sem conclusão e integrar os efeitos financeiros.

No incremento 460, o hash passou a incorporar o inventário operacional de agenda/benefício, material, disponibilização inicial, designações e entregas. O incremento 461 acrescenta correções de entrega, prorrogações, liberações específicas e intervalos confirmados de indisponibilidade. O helper `correcao-aula-reposicoes-tx.ts` mantém o escopo da chamada e não retorna conteúdo privado ou identificador externo de vídeo. Ainda é necessária a resolução completa das dependências.

No incremento 459, a decisão da reposição passou a integrar o hash da conferência. Pedido rejeitado sem conclusão deixa de bloquear e sua decisão permanece no snapshot da publicação. Decisão nova exige outra conferência; não há rejeição automática nem reversão de autorização. Pedidos autorizados ou concluídos afetados ainda exigem tratamento próprio.

A persistência impede aprovação pelo autor e cria os casos de revisão de progressão atomicamente, com conferência dos impactos reais (208). A execução de mudança acadêmica com casos pendentes fica bloqueada (209). A ação pública e a interface usam a conferência atual e registram a aprovação com seu evento (458). Ainda precisam integrar o tratamento completo de dependências financeiras e reposições existentes. Os testes públicos não comprovam esses fluxos ainda bloqueados nem substituem validação visual.

## Reserva antecipada já consumida — revisão sem alteração de valores

O incremento 261/262 permite a revisão financeira Q23 somente quando a reserva de aula particular já foi consumida e a fonte histórica é verificável. A foto financeira fixa reserva, consumo, compra antecipada, cobrança, informes, recebimentos, destinações e condições contratuais. A decisão financeira é independente e a gestão ainda publica a correção pedagógica.

Há dois percursos sem delta: realização diária original de PRESENTE para FALTA, desde que as condições históricas aprovadas comprovem a falta cobrável; e ocorrência Q92 conferida como FALTA_COBRAVEL, de FALTA para PRESENTE.

A revisão preserva compra, reserva, consumo, cobrança, recebimentos, crédito, permuta e conferência. Não libera reserva, não cria crédito, não altera valores e não reclassifica IMPEDIDO, cancelamentos ou reserva pendente. Uma mudança de informe, recebimento, destinação, cobrança, condições aplicáveis, diário, ocorrência ou alçada invalida a fotografia e exige nova revisão; nenhuma decisão antiga volta a valer.

A migration 263 ancora a matrícula durante a materialização da foto. Isso serializa novas condições contratuais com a foto Q23: uma condição aplicável posterior torna a decisão anterior obsoleta antes da publicação. A mensagem de ação para uma recusa que venha diretamente de trigger ainda é genérica; o guard SQL mantém a recusa e a ausência de efeitos.
