# Situação de verificação — 16/09/2026

> Medição em 16/09/2026: o percentual global de entrega ainda não foi auditado. [Critérios da medição](planejamento/percentual-entrega-spec.md). Evidências mais recentes: [607](planejamento/validacao-incremento-607.md) e [608](planejamento/validacao-incremento-608.md); registros históricos abaixo não são porcentagem atual.

O objetivo integral está em andamento. Este índice aponta as evidências recentes; os registros abaixo dele são históricos e suas pendências descrevem o estado de cada incremento.

| Assunto | Fonte verificável | Limite atual |
|---|---|---|
| Comportamento requerido | [SPEC principal](specs/erp-educacional.md) | Requisito escrito não comprova implementação |
| Verificação abrangente | [Incremento 574](planejamento/validacao-incremento-574.md) | 1.111 unitários e 1.114 integrações passaram; não cobre mudanças posteriores |
| Q160/Q162: vencimento e ciclo pela cobertura | [Incrementos 606](planejamento/validacao-incremento-606.md) e [607](planejamento/validacao-incremento-607.md) | Emissor e dois ciclos após recomposição testados; operação externa desligada e homologação pendente |
| Entrada da agenda de segunda chamada | [Incremento 586](planejamento/validacao-incremento-586.md) | Origem aprovada, imutabilidade e aplicação atômica protegidas no banco; 72 integrações na rodada conjunta; validação interativa pendente |
| Proposta inicial de agenda e exceção Q19 | [Incremento 586](planejamento/validacao-incremento-586.md) | Fluxo, fila administrativa e fechamento da transição SQL implementados e testados; validação interativa pendente |
| Substituição docente de segunda chamada | [Incrementos 589](planejamento/validacao-incremento-589.md) e [590](planejamento/validacao-incremento-590.md) | Cobertura temporal e bloqueios SQL de contexto implementados; concorrência com pausa e rejeição de propostas obsoletas testadas; homologação interativa pendente |
| Remarcação de segunda chamada | [Incremento 588](planejamento/validacao-incremento-588.md) | Q151 conferida ao longo do intervalo no servidor e no aplicador SQL; evidências e limites no relatório; homologação interativa pendente |
| Renderização do histórico | [Incremento 575](planejamento/validacao-incremento-575.md) | Dois testes de renderização; não substituem navegador |
| Histórico administrativo de reservas | [Incremento 573](planejamento/validacao-incremento-573.md) | Duas integrações e build; sem ensaio interativo |
| Concorrência da segunda chamada | [Incremento 590](planejamento/validacao-incremento-590.md) | Agenda inicial, remarcação e substituição aguardam/revalidam pausa; oito cenários específicos aprovados após ajuste de rejeições; não comprova todos os fluxos do ERP |
| Rejeição e histórico de propostas obsoletas | [Incremento 591](planejamento/validacao-incremento-591.md) | Três fluxos preservam histórico original e rejeição independente; 101 integrações, 10 testes de renderização, tipos, lint e build aprovados; sem homologação interativa |
| Avisos internos de diário — Q22 | [Incremento 592](planejamento/validacao-incremento-592.md) | Configuração, ciclos e painel implementados; 75 integrações, três testes de renderização, tipos, lint e build aprovados; atualização por consulta, sem job ou homologação interativa |
| Desistência antes da ativação — Q121 | [Incremento 595](planejamento/validacao-incremento-595.md) e [SPEC](specs/desistencia-preparacao.md) | Pedido, efetivação simples e cancelamento aprovado de cobranças não pagas implementados; validações e correções discriminadas no relatório; casos com recebimentos/documentos e homologação ainda pendentes |
| Conferência documental da desistência | [Incremento 596](planejamento/validacao-incremento-596.md) | Consulta Secretaria/Administração e interface implementadas; 22 integrações, nove testes de renderização, tipos, lint e build aprovados; decisão documental persistida, cancelamento próprio e integração externa ainda pendentes |
| Decisão administrativa da desistência | [Incremento 597](planejamento/validacao-incremento-597.md) | Decisão independente imutável e interface implementadas; 29 integrações após correção do fuso e nove cenários administrativos na reexecução, dez de renderização; aplicação dos casos com avanço formal ainda pendente |
| Resolução do impedimento escolar | [Q164 no incremento 571](planejamento/validacao-incremento-571.md) | Resposta pendente, comportamento não presumido |
| Ciclo de agenda da segunda chamada | [Pendência acompanhada](planejamento/pendencia-agenda-segunda-chamada-565.md) | Proteção e remarcação implementadas; resolução Q164 e validação interativa pendentes |

## Histórico de implementação — leitura por data

Atualização 573: histórico administrativo de todas as reservas de segunda chamada, preservando ocorrências anteriores, motivos/evidências e autoria, com consulta por cursor. Duas integrações direcionadas, lint e build aprovados; sem ensaio interativo. Q164 e proteção/alteração de encontros previstos permanecem pendentes. [Evidências e limites](planejamento/validacao-incremento-573.md).

Atualização 572: corrigida inversão de bloqueios em cinco fluxos de segunda chamada, com revalidação após espera. 41 integrações, tipos e lint aprovados; cenários de concorrência confirmam espera real no PostgreSQL. Q164 e proteção/alteração de encontros previstos permanecem pendentes. [Evidências e limites](planejamento/validacao-incremento-572.md).

Atualização 571: concorrência entre realização e falta/impedimento verificada com um único fato terminal. 54 integrações em rodada conjunta, lint e tipos aprovados. Q164 aguarda definição sobre resolução do impedimento; proteção de encontros previstos permanece pendente. [Evidências e limites](planejamento/validacao-incremento-571.md).

Atualização 570: impedimento escolar encerra e protege seu encontro sem consumir oportunidade; seleção de agenda respeita contrato e vínculo disponível. 52 cenários de integração aprovados entre execuções, 7 testes de replanejamento, lint e build. Resolução da pendência escolar e alterações de encontros previstos continuam pendentes. [Evidências e limites](planejamento/validacao-incremento-570.md).

Atualização 569: falta de segunda chamada encerra o encontro como não realizado, com histórico protegido e sem nota/presença/cobrança automáticas. 50 integrações, 6 testes de replanejamento, lint e build aprovados. Impedimento e proteção de encontros previstos seguem pendentes. [Evidências e limites](planejamento/validacao-incremento-569.md).

Atualização 568: cancelamento do aluno exige aprovação independente e aplica liberação/consumo pela antecedência do pedido original. Interface conserva revisão e decisão. 31 integrações, lint e build aprovados. Falta e impedimento na agenda seguem pendentes. [Evidências e limites](planejamento/validacao-incremento-568.md).

Atualização 567: cancelamento escolar de segunda chamada exige proposta e aprovação independente, aplicando agenda e oportunidade na mesma transação, com tela e histórico. 30 integrações, lint, tipos e build aprovados. Demais ocorrências de agenda seguem pendentes. [Evidências e limites](planejamento/validacao-incremento-567.md).

Atualização 566: realização de segunda chamada conclui e preserva seu encontro; início e conclusão de turma consideram apenas aulas regulares. 46 integrações, lint e tipos aprovados. Cancelamento aprovado da agenda segue pendente. [Evidências e limites](planejamento/validacao-incremento-566.md).

Atualização 565: painel exige justificativas reais e disponibilização admite reenvio idêntico sem duplicação. 26 integrações, lint e build aprovados. Ciclo terminal da agenda de segunda chamada permanece pendente. [Evidências e limites](planejamento/validacao-incremento-565.md).

Atualização 564: realização de segunda chamada protegida no banco por atribuição, agenda, data e evidência; novas autorizações especiais gravam criação em UTC. 25 integrações, lint e tipos aprovados. Legado temporal exige conferência. [Evidências e limites](planejamento/validacao-incremento-564.md).

Atualização 563: reservas e ocorrências de segunda chamada protegidas por invariantes SQL e histórico imutável; consumo/liberação exige fato correspondente no commit. 24 integrações, lint e tipos aprovados. [Evidências e limites](planejamento/validacao-incremento-563.md).

Atualização 562: ocorrências de segunda chamada recebem dados reais da gestão, com validação temporal e reenvio sem duplicação. 20 integrações, lint e build aprovados; proteções SQL e homologação ainda pendentes. [Evidências e limites](planejamento/validacao-incremento-562.md).

Atualização 561: gestão de designações de segunda chamada disponível pela interface, com vigência, busca, histórico paginado e proteção SQL do histórico. 14 integrações, lint e build aprovados; ensaio interativo pendente. [Evidências e limites](planejamento/validacao-incremento-561.md).

Atualização 560: designação de segunda chamada expirada não restaura autorização anterior; novas datas de criação gravadas em UTC. 13 integrações, lint e tipos aprovados. Histórico legado exige conferência. [Evidências e limites](planejamento/validacao-incremento-560.md).

Atualização 559: professor designado pode regularizar a nota de segunda chamada aplicada por outra pessoa, com evidências e autoria preservadas. 108 integrações, lint e build aprovados; homologação interativa e demais fluxos pendentes. [Evidências e limites](planejamento/validacao-incremento-559.md).

Atualização 558: nota de segunda chamada devolvida aceita nova versão, preservando realização e histórico; banco exige rejeição prévia. 14 integrações, lint e build aprovados. [Evidências e limites](planejamento/validacao-incremento-558.md).

Atualização 550: disponibilização de plano aprovado antes da pausa aceita autorização específica sem recriar proposta ou decisão. 14 integrações, lint e tipos aprovados; conexão à interface ainda pendente. [Evidências e limites](planejamento/validacao-incremento-550.md).

Atualização 557: fila e detalhe docente de segunda chamada conectados à realização e nota original, com acesso limitado e reenvio seguro. Onze integrações, lint e build aprovados; ensaio interativo e demais cenários pendentes. [Evidências e limites](planejamento/validacao-incremento-557.md).

Atualização 556: professor designado pode registrar a nota da própria segunda chamada, com conferência da atribuição atual e histórica. Onze integrações de segunda chamada aprovadas; fila e detalhe docente continuam pendentes. [Evidências e limites](planejamento/validacao-incremento-556.md).

Atualização 555: nota original de segunda chamada autorizada após encerramento corrigida no servidor e nos guards do banco, preservando outro contrato ativo. 106 integrações aprovadas; asserção negativa refinada e reconferida. [Evidências e limites](planejamento/validacao-incremento-555.md).

Atualização 554: autorização especial de segunda chamada conectada à gestão, com identificação, prazo/fuso, reenvio e histórico paginado. Nove integrações, lint e build aprovados; ensaio interativo e demais fluxos pendentes. [Evidências e limites](planejamento/validacao-incremento-554.md).

Atualização 553: segunda chamada exige autorização já vigente na data, fonte correta e gestor habilitado; oito integrações, lint e tipos aprovados. Interface de autorização e demais cenários ainda pendentes. [Evidências e limites](planejamento/validacao-incremento-553.md).

Atualização 552: histórico de autorizações de realização paginado e restrito à tentativa; testes direcionados, lint e build aprovados. Q163 aguarda decisão sobre a passagem de pausa para encerramento. [Evidências e limites](planejamento/validacao-incremento-552.md).

Atualização 551: interface de disponibilização conectada à autorização especial, inclusive para plano aprovado antes da pausa. Quatro integrações, lint e build aprovados; validação interativa e demais casos Q151 pendentes. [Evidências e limites](planejamento/validacao-incremento-551.md).

Atualização 549: projeção do portal validada para recuperação oficial após encerramento. Dois testes, lint e tipos aprovados. Auditoria identificou continuação de plano aprovado antes da pausa ainda pendente. [Evidências e próximos ajustes](planejamento/validacao-incremento-549.md).

Atualização 548: recuperação após encerramento validada até nota oficial e consolidado, sem autoaprovação ou reativação. Dois cenários integrados, lint e tipos aprovados. Ensaio interativo e auditoria integral permanecem pendentes. [Evidências e limites](planejamento/validacao-incremento-548.md).

Atualização 547: recuperação preparada após encerramento efetivo validada até realização autorizada, preservando matrícula/alocação encerradas. 94 integrações acadêmicas, lint e tipos aprovados. Validação interativa e auditoria integral pendentes. [Evidências e limites](planejamento/validacao-incremento-547.md).

Atualização 546: histórico de autorizações de preparação conectado à gestão com paginação e isolamento por vínculo. Integração direcionada, lint e build aprovados; ensaio interativo e cenários adicionais Q151 pendentes. [Evidências e limites](planejamento/validacao-incremento-546.md).

Atualização 545: interface de autorização de preparação conectada à proposta; revisão de planos reflete vigência e permissões atuais. Dois cenários integrados, lint e build aprovados. Histórico completo e validações adicionais Q151 pendentes. [Evidências e limites](planejamento/validacao-incremento-545.md).

Atualização 544: aprovação e disponibilização de plano com autorização de preparação conectadas ao servidor e banco, sem liberar reserva ou realização. 12 integrações de planos e cenário SQL direcionado aprovados; lint e tipos aprovados. Interface de preparação e verificações adicionais pendentes. [Evidências e limites](planejamento/validacao-incremento-544.md).

Atualização 543: autorização específica permite preparar proposta de recuperação após pausa/encerramento, com referência preservada e sem executar as etapas seguintes. 12 integrações de planos, lint e tipos aprovados. Aprovação/disponibilização e interface desse caminho pendentes. [Evidências e limites](planejamento/validacao-incremento-543.md).

Atualização 542: interface da autorização pré-reserva conectada à gestão, com histórico paginado, prazo/fuso e reserva vinculada. Integração direcionada, lint e build aprovados. Ensaio interativo e demais caminhos Q151 pendentes. [Evidências e limites](planejamento/validacao-incremento-542.md).

Atualização 541: autorização pré-reserva por plano/habilidade implementada no servidor e banco, sem ampliar prazo geral ou tentativas. Regressão executada e mensagem de cancelamento corrigida; testes afetados, lint e tipos aprovados. Interface e demais caminhos Q151 pendentes. [Evidências e limites](planejamento/validacao-incremento-541.md).

Atualização 540: operação do plano mostra autorização vigente por tentativa, preservando conferência de fatos históricos. Integração direcionada, lint e tipos aprovados. Auditoria confirma pendência Q151 antes da reserva. [Evidências e próximos caminhos](planejamento/validacao-incremento-540.md).

Atualização 539: proteção temporal no banco e recuperação autorizada após encerramento efetivado, preservando matrícula encerrada. 92 integrações acadêmicas, lint e tipos aprovados; Q151 permanece parcial. [Evidências e limites](planejamento/validacao-incremento-539.md).

Atualização 538: interface de autorização específica de recuperação conectada à gestão, com identificação da matrícula, prazo/fuso e histórico. Integração direcionada, lint, build e tipos aprovados; ensaio interativo e demais casos Q151 pendentes. [Evidências e limites](planejamento/validacao-incremento-538.md).

Atualização 537: realização de recuperação consulta autorização específica e preserva referência aplicada. Cenário com pausa contratual, lint e build aprovados; 91 integrações acadêmicas aprovadas. Interface e demais casos Q151 permanecem pendentes. [Evidências e limites](planejamento/validacao-incremento-537.md).

Atualização 536: registro de autorização especial de recuperação implementado com persistência e validação de escopo; quatro unitários, um cenário integrado, lint e build aprovados. Consumo da autorização e interface ainda pendentes. [Evidências e limites](planejamento/validacao-incremento-536.md).

Atualização 534: suíte unitária completa com 1.105 aprovações, sem falhas; mensagem de calendário financeiro fora da vigência corrigida. Lint e TypeScript aprovados. [Evidências e limites](planejamento/validacao-incremento-534.md).

Atualização 533: Q99 integrada às condições contratuais, validação do banco, formulário e prévia mensal, preservando versões antigas e retomada. 31 unitários, 12 integrações de condições, um cenário completo de prévia, lint e build aprovados. Emissão recorrente e Q161/Q162 continuam pendentes. [Evidências e limites](planejamento/validacao-incremento-533.md).

Atualização 532: composição de vencimento financeiro implementada e validada com cinco testes e lint; integração contratual, banco e formulário ainda pendentes. [Evidências e próximos pontos](planejamento/validacao-incremento-532.md).

Atualização 531: conferência da cadeia integrada à prévia mensal, considerando cancelamentos, suspensões e regularizações efetivamente aplicadas. 18 integrações financeiras, um cenário mensal completo, 11 testes unitários, lint e build aprovados. Emissão recorrente, Q161/Q162 e integração dos dias úteis continuam pendentes. [Evidências e limites](planejamento/validacao-incremento-531.md). Validação geral anterior: 1.073 integrações aprovadas no incremento 528.

Atualização 527: retomada exige histórico correspondente e confere a restrição antes de retornar sucesso. Suíte unitária completa com 1.078 aprovações após correção de mocks; 27 integrações, lint e build aprovados. Q161 e emissão recorrente continuam pendentes. [Evidências e limites](planejamento/validacao-incremento-527.md).

Atualização 526: banco preserva fonte, seleção e eventos da retomada; valida transições e papéis da decisão. 27 integrações de pausa/retomada, uma regressão mensal e lint aprovados. Migrações somente no banco de teste; emissão recorrente e Q161 continuam pendentes. [Evidências e limites](planejamento/validacao-incremento-526.md).

Atualização 525: planejamento mensal reconhece cobertura parcial de retomada efetivamente aplicada, conferindo a origem persistida e preservando o próximo ciclo integral. Dezoito unitários, 26 integrações e três revalidações/cenário mensal aprovados; lint e build aprovados. Q161 e emissão recorrente seguem pendentes. [Evidências e limites](planejamento/validacao-incremento-525.md).

Atualização 524: a prévia mensal impede cobertura sobre dias programados de compensação da mesma matrícula. 25 unitários, dois cenários de integração, lint e build aprovados. Q161 aguarda decisão sobre comprovação da oferta; emissão recorrente segue pendente. [Evidências e limites](planejamento/validacao-incremento-524.md).

Atualização 523: Q160 implementada na configuração e no cálculo de vencimentos pela cobertura, sem presumir regra legada nem alterar cobranças existentes. 22 unitários, 11 integrações, lint e build aprovados. Emissão recorrente permanece pendente. [Evidências e limites](planejamento/validacao-incremento-523.md).

Atualização 522: reconferência de aprovação obsoleta e regularizações sucessivas de cobertura reprogramada implementadas com versões, aprovação independente e histórico. 32 integrações, lint e build aprovados. Emissão recorrente e ensaio interativo seguem pendentes; SPEC integral em implementação. [Evidências e limites](planejamento/validacao-incremento-522.md).

Atualização 518: seleção de condição mensal compartilhada e regressão de indisponibilidades sobrepostas. Dezesseis unitários, seis integrações de término e cenário mensal aprovados; lint e build aprovados. Ensaio de interface pendente por bloqueio automático da inicialização local; emissão recorrente ainda em implementação. [Evidências e limites](planejamento/validacao-incremento-518.md).

Atualização 517: Q156 com proposta e aprovação independente de término, histórico preservado e intervalo efetivo integrado. Quinze integrações e cenário mensal adicional aprovados; lint e build aprovados. Interface sem ensaio interativo; Q157 e emissão recorrente seguem pendentes. [Evidências e limites](planejamento/validacao-incremento-517.md).

Atualização 516: consulta de indisponibilidade com escopo e projeção limitada, confirmação concorrente validada e datas de eventos no fuso institucional. Dez integrações, lint e build aprovados. Q156 incorporada à SPEC, ainda sem fluxo implementado; Q157 e emissão recorrente seguem pendentes. [Evidências e limites](planejamento/validacao-incremento-516.md).

Atualização 515: confirmação independente da falta de oferta integrada à prévia, com correção de vigência de condições futuras. 41 integrações aprovadas; cenário mensal revalidado após a correção, lint e build aprovados. Encerramento/retificação de intervalos e emissão recorrente permanecem pendentes. [Evidências e limites](planejamento/validacao-incremento-515.md).

Atualização 514: prévia na interface e cenário positivo após ativação; registro imutável de relatos de falta de oferta. 45 integrações em duas rodadas e build aprovados. Confirmação da indisponibilidade e emissão recorrente permanecem pendentes. [Evidências e limites](planejamento/validacao-incremento-514.md).

Atualização 513: conferência do preço de continuidade ligada à preparação histórica, aceite e aditivos; 42 integrações e build aprovados. Consulta preparatória não emite cobrança; oferta por período e emissão recorrente seguem pendentes. [Evidências e limites](planejamento/validacao-incremento-513.md).

Atualização 512: interface de continuidade mensal integrada e regras completas protegidas no banco; seis integrações, onze unitários e build aprovados. Sem ensaio interativo; emissão recorrente e validação de oferta/preço permanecem pendentes. [Evidências e limites](planejamento/validacao-incremento-512.md).

Atualização 511: condições de continuidade mensal versionadas, vinculadas ao contrato confirmado e com aprovação independente; planejador separa cobertura, vencimento e antecedência. Cinco integrações e sete unitários aprovados. Emissão recorrente, disponibilidade da escola por período e interface seguem pendentes. [Evidências e limites](planejamento/validacao-incremento-511.md).

Atualização 510: resolvedor mensal formalizado e integração na geração legada de parcelas. 40 integrações, dez unitários e build aprovados. A contratação preparada ainda exige implementação de emissão recorrente; este incremento não comprova esse fluxo completo. [Evidências e limites](planejamento/validacao-incremento-510.md).

Atualização 509: aditivo de preço validado até conferência, fechamento e emissão por hora; 57 integrações, sete testes do resolvedor e build aprovados. Assinatura externa simulada; mensalidades e agenda seguem pendentes. [Evidências e limites](planejamento/validacao-incremento-509.md).

> Histórico até 414 (2026-09-14): painel, relatos/descarte e versão validada integrados; regressão do portal passou em 24 testes. Reprodução Drive conectada no código e build aprovado, ainda sem ensaio real. [Evidências do portal](planejamento/validacao-incremento-413.md), [limites da reprodução](planejamento/validacao-incremento-412.md). Publicação com verificação do vídeo e resultados do aluno estavam em implementação; esta entrada não comprova conclusão integral.

> Atualização 397 (2026-09-14): entrega autenticada integrada no banco de testes; três testes específicos passaram. Regressão ampla e serviços externos ainda pendentes. Ver [evidências do incremento](planejamento/validacao-incremento-397.md).

# Situação consolidada do ERP Genius — 08/09/2026

**Integração 394:** 129 testes aprovados em nove arquivos de avaliações, diário, reposições, agenda e identidade. Build aprovado no incremento 393. Segunda chamada, entregas no portal, fechamento/progressão e demais requisitos seguem em implementação. [Evidências e limites](planejamento/validacao-incremento-394.md).


**Incremento 393 — estado atual:** identidade e rotas do portal integradas; build aprovado com 61 páginas estáticas. Agenda de reposições e frequência integradas com correções de vínculo, cotas e períodos. Entrega pelo portal, segunda chamada e demais frentes da SPEC permanecem em desenvolvimento. Evidência de testes e limites: [validação 393](planejamento/validacao-incremento-393.md). Os incrementos abaixo são histórico, não comprovação da entrega integral.


**Integração 381:** 113 testes acadêmicos, de diário e reposição aprovados em cinco arquivos. Correção de UTC e isolamento de contratos conferidos; agenda por pedido, benefícios e portal do aluno continuam em implementação. [Evidências e limites](planejamento/validacao-integracao-terra-381.md).

**Integração 378 em andamento:** substituição aprovada e aplicada passou nos testes focados; a rodada completa encontrou duas falhas na frequência em integração. Migração de reposições e nova validação de fontes ainda exigem conclusão e nova rodada. [Estado e evidências](planejamento/validacao-integracao-terra-378.md).

**Incremento 377:** propostas versionadas de substituição com conferência atual, histórico e isolamento de acesso; 81 integrações acadêmicas aprovadas. Aprovação/aplicação seguem em implementação paralela com subagentes Terra. [Evidências e limites](planejamento/validacao-incremento-377.md).

## Incremento 376 — Conferência de substituição, 14/09/2026

A gestão confere disponibilidade de substituto para recuperação agendada, mantendo o horário e a atribuição atuais. A tela deixa de oferecer troca direta quando o encontro está publicado. 79 integrações acadêmicas, TypeScript, lint e build aprovados. [Evidências e dependências](planejamento/validacao-incremento-376.md). A substituição efetiva ainda depende de proposta preservada, decisão independente e aplicação atômica; sem migration ou produção nesta etapa.

## Incremento 375 — Consulta docente da agenda de recuperação, 14/09/2026

O professor consulta o horário publicado no alcance de suas tentativas/plano autorizados, com avaliador, estado e fuso de visualização. Cancelamento retira pendências sem ampliar acesso histórico, e a realização exige o avaliador/horário aprovados. 77 integrações acadêmicas, TypeScript, lint e build aprovados. [Evidências e limites](planejamento/validacao-incremento-375.md). Sem migration ou produção; agenda semanal unificada, portal do aluno e demais fluxos pendentes continuam em implementação.

## Incremento 374 — Cancelamento da recuperação agendada, 14/09/2026

A escola pode propor cancelamento da reserva com agenda publicada; outra pessoa da gestão aprova e aplica o cancelamento dos encontros pendentes e a liberação das habilidades não realizadas. Realizações e consumos anteriores permanecem. 80 integrações aprovadas e três cenários finais repetidos, além de lint/build; schema conferido após migrations 168–169 somente no banco descartável. [Evidências e limites](planejamento/validacao-incremento-374.md). Remarcação, troca de avaliador na agenda publicada, cancelamento pelo aluno e notificações permanecem em implementação.

## Incremento 373 — Publicação da recuperação, 14/09/2026

Implementada decisão independente que publica atomicamente o horário da tentativa, com revalidação e exceção explícita para dia não letivo. A realização docente confere a agenda e conclui o encontro sem criar diário ou cobrança. 101 integrações direcionadas aprovadas, quatro casos repetidos após ajustes finais, dois unitários, lint e build. [Evidências e limites](planejamento/validacao-incremento-373.md). Migrations 165–167 somente no banco descartável. Remarcação, cancelamento, substituição na agenda publicada e notificações permanecem pendentes; não há homologação operacional ou entrega integral.

## Incremento 372 — Impactos de recuperações, 14/09/2026

Calendário e encerramento distinguem recuperações das particulares contratadas, mantendo pendências acadêmicas próprias e memórias antigas preservadas. 28 integrações direcionadas, dois unitários, lint, TypeScript e build aprovados. [Evidências e limites](planejamento/validacao-incremento-372.md). A regressão integral abaixo é anterior a esta rodada. A publicação de recuperações e os demais fluxos pendentes continuam em implementação.

## Incremento 371 — Finalidade dos encontros, 14/09/2026

**Regressão automatizada completa mais recente:** 839 unitários em 91 arquivos e 738 integrações em 55 arquivos aprovados, sem falhas ou pendências. Build com TypeScript, lint e schema também aprovados. Essa evidência cobre o código exercitado e não comprova requisitos ainda sem implementação nem homologação interativa.

Encontros distinguem aula e recuperação; diário, ocorrência particular, fila financeira e horas contratadas conferem a finalidade no servidor e nas proteções de origem do banco. Migration 164 somente no banco descartável. [Evidências e limites](planejamento/validacao-incremento-371.md). Publicação de recuperação segue pendente de aprovação própria e revisão dos impactos globais.

## Incremento 370 — Propostas da agenda de recuperação, 14/09/2026

Gestão prepara e revisa propostas versionadas de horário, preservando autoria, conferência original e mudanças posteriores. Migration 163 aplicada apenas ao banco descartável. [Evidências e limites](planejamento/validacao-incremento-370.md). Decisão/aprovação, publicação e integração dos encontros com seus consumidores permanecem pendentes.

## Incremento 369 — Prévia da agenda de recuperação, 14/09/2026

Gestão pode conferir um intervalo para a tentativa na tela do plano. O servidor verifica o prazo, avaliador, calendário, encontros do aluno e professor, indisponibilidades e reservas comerciais. Não há publicação ou reserva de horário nessa operação. [Evidências e pendências](planejamento/validacao-incremento-369.md). Aprovação da agenda e ocorrências do aluno ainda estão abertas.

## Incremento 368 — Atribuição docente, 14/09/2026

Três divergências entre servidor e banco reproduzidas e corrigidas nas propostas de extras de recuperação: vínculo futuro, professor fora da titularidade e turma concluída. Migration 162 aplicada somente ao banco descartável; 65 integrações de avaliações, TypeScript, lint e schema aprovados. [Evidências e próximos requisitos](planejamento/validacao-incremento-368.md). Agenda das tentativas e cancelamento do aluno continuam pendentes.

## Incremento 367 — Concorrência e saldo de recuperação, 14/09/2026

62 integrações de avaliações aprovadas, incluindo aprovação/reserva concorrentes de extras e plano com limite institucional zero. Tela diferencia regra, extras aprovadas e total. [Evidências e limites](planejamento/validacao-incremento-367.md). Implementação integral e homologação continuam pendentes.

## Incremento 366 — Oportunidades extras de recuperação, 14/09/2026

Implementadas proposta motivada com evidências, revisão/decisão independente, histórico e tela de oportunidades extras de recuperação. A aprovação acrescenta saldo somente à matrícula/nível/habilidade autorizados. Servidor e banco impedem ultrapassar o limite; uma base alterada exige nova proposta, preservando rejeição e histórico.

Migration 161 aplicada apenas ao banco descartável, Prisma regenerado e schema conferido. Validação: 60 integrações de avaliações, 839 unitários, build/TypeScript, lint e diff check aprovados. [Evidências e limites](planejamento/validacao-incremento-366.md).

Oportunidades extras de segunda chamada e homologação interativa ainda pendentes. Fechamento acadêmico e integração da progressão também permanecem abertos; não declarar Q150/Q154 integralmente concluídas.

## Incremento 365 — Plano aprovado sem tentativa, 14/09/2026

Acompanhamento e tela identificam habilidades de planos aprovados sem tentativa reservada ou realizada. Disponibilizar o plano não elimina essa pendência; cancelamento parcial preserva a realização e devolve a habilidade não realizada à necessidade de providência. Não encerra planos automaticamente nem confirma resultado final.

Validação: 58 integrações de avaliações, 839 unitários, build/TypeScript, lint e diff check aprovados. [Evidências e limites](planejamento/validacao-incremento-365.md). Fechamento acadêmico e integração da progressão continuam pendentes.

## Incremento 364 — Pendências operacionais no acompanhamento, 14/09/2026

Implementadas contagens de correções regulares/de recuperação aguardando decisão, planos pendentes de aprovação ou disponibilização e tentativas reservadas ainda não realizadas. Consulta e tela respeitam o vínculo/contrato autorizado. Cancelamento parcial não apaga realização nem sua pendência de nota.

Validação: 57 integrações na suíte e quatro cenários complementares aprovados; 839 unitários, build/TypeScript e lint aprovados. Total atual de 58 integrações no arquivo, sem repetição integral depois do complemento de testes. [Evidências e limites](planejamento/validacao-incremento-364.md). Fechamento versionado, resolução dos impactos e integração da progressão continuam pendentes; a ausência de contagens não significa resultado final.

## Incremento 363 — Recuperações realizadas sem nota, 14/09/2026

Corrigida omissão de recuperações realizadas ainda sem nota no consolidado. O acompanhamento conserva a realização como pendência, sem zero ou alteração da média oficial; outra tentativa oficializada não oculta a que continua pendente. A base comparada do plano aprovado fica separada para permitir sua execução por etapas. Essa base não pode ser usada como comprovação de fechamento.

Validação final: 55 integrações de avaliações, 839 unitários, build/TypeScript, lint e diff check aprovados. A primeira rodada identificou duas falhas de continuidade do plano, corrigidas pela separação explícita das finalidades. [Evidências e limites](planejamento/validacao-incremento-363.md). Fechamento versionado e integração da progressão continuam pendentes.

## Incremento 362 — Chamada histórica e regressão, 14/09/2026

Implementada conferência obrigatória diante de vínculos históricos sobrepostos na chamada. O servidor não escolhe uma matrícula arbitrariamente, não cria novos registros e não conclui a aula enquanto a origem exigir conferência; o histórico existente permanece preservado.

Regressão inicial: 713 de 718 integrações aprovadas. Corrigidas cinco falhas nas fixtures (ordem temporal da assinatura simulada e campo novo do histórico); repetição das duas suítes: 73 aprovadas. Após a proteção nova: 25 integrações de diário/visibilidade e 839 unitários aprovados; TypeScript e build aprovados. Não houve nova rodada integral após as alterações. [Detalhes, evidências e limites](planejamento/validacao-incremento-362.md).

Correções de aulas concluídas, regularização formal do legado, reposições, fechamento e integração da progressão permanecem pendentes. Não há comprovação de entrega integral nem homologação visual.

## Incremento 361 — Participação contratual na chamada, 14/09/2026

Migration 160 (20260914150000) adiciona matrícula e participação opcional ao registro da aula: PRESENTE, FALTA e IMPEDIDO_POR_RESTRICAO. A FK composta exige o mesmo aluno do contrato; check SQL impede classificação incompatível com o booleano; identidade contratual já preenchida não pode ser removida/trocada. Registros antigos permanecem nulos, sem backfill presumido. Aplicada somente ao PostgreSQL descartável; Prisma regenerado e schema diff vazio.

Chamada coletiva e particular capturam o contrato conferido no servidor para registros novos. Classificação explícita requer matrícula identificada, presença coerente e, para impedimento, observação da ocorrência sem dados financeiros. Entrada antiga sem classificação preserva a anterior se a presença não mudar; edição legada não atribui contrato silenciosamente. Reclassificação explícita de registro pendente utiliza o vínculo histórico validado. Registros de quem saiu continuam em leitura; encontro ministrado conserva os bloqueios de edição existentes.

A tela do encontro oferece classificação quando a matrícula histórica foi identificada. Histórico e revisão da exceção de gravação distinguem impedimento de falta. Matrícula/classificação entram na comparação do estado do diário, preservando a forma anterior para registros sem identidade; consultas de revisão carregam os mesmos campos. A frequência usa a classificação confirmada e recusa usar registro tipado de outro contrato; impedimento permanece na base sem crédito.

Validação: 839 unitários em 91 arquivos aprovados; 55 integrações de avaliações aprovadas e 17 de diário aprovadas na execução final. A rodada combinada anterior teve duas falhas de fixtures: objeto esperado sem o novo campo nulo e sessão da gestão não restaurada após nova consulta. Ambas corrigidas sem flexibilizar regra e repetida a suíte de diário. Evidências docs/validacao-participacao-361-2026-09-14.json (rodada intermediária) e docs/validacao-diario-361-final-2026-09-14.json (17 aprovados). TypeScript, lint, build/52 páginas e diff check aprovados. Após build, apenas fixtures e nome de mapeamento da FK no schema foram alinhados; cliente regenerado.

Sem homologação visual, produção ou envios. Registrar impedimento não cria/revoga restrição nem executa cobrança. Correções aprovadas de chamadas concluídas, regularização formal do legado, reposições com evidências, frequência entre vínculos, fechamento e integração da progressão continuam pendentes. A classificação não comprova conclusão integral de Q59/Q131/Q154.

## Incremento 360 — Frequência consultada nos registros do vínculo, 14/09/2026

A consulta autorizada do consolidado carrega encontros publicados do vínculo, chamadas do próprio aluno e situação contratual histórica no início da aula. Usa a regra de frequência vinculada à turma, sem padrão presumido. Datas fora da alocação e contratos não ativos na aula não fornecem presença. Diários sem encontro associado, situação contratual não conferida e outros vínculos do mesmo nível geram pendências; múltiplos vínculos exigirão o aproveitamento aprovado.

O booleano legado de presença não distingue impedimento e regularização. Ausência registrada gera conferência específica e não permite concluir atendimento do mínimo automaticamente. A tela mostra presenças/base e pendências como acompanhamento parcial deste vínculo. Não apresenta essa consulta como fechamento final. A apuração temporal fica fora da memória interna estável dos planos de recuperação, preservando sua revisão/idempotência.

Validação: suíte de lançamentos com 54 integrações aprovada; acrescentado cenário de presença ministrada e ausência não classificada, seguido de execução direcionada dos dois testes de frequência (dois aprovados, 53 não selecionados). Total atual do arquivo: 55 testes, sem nova execução integral após a adição do segundo cenário. TypeScript, lint e build/52 páginas aprovados; somente teste foi alterado após o build. Evidência da suíte: docs/validacao-frequencia-360-2026-09-14.json. Diff check aprovado. Nenhuma migration, produção, envio externo ou homologação visual.

Ainda faltam classificação persistida da ausência/impedimento, reposições com decisões verificáveis, agregação e equivalência entre vínculos, fechamento versionado, exceção de frequência e integração na aprovação/execução da progressão. Não afirmar conclusão de Q131/Q154 a partir desta consulta parcial.

## Incremento 359 — Apuração de frequência por encontros, 14/09/2026

Implementado src/server/avaliacoes/frequencia.ts como cálculo interno determinístico por matrícula/nível e instante de apuração. Entradas explicitam aula original, estado da conclusão, participação e reposições validadas. Recusa mistura de contratos/níveis, aula duplicada, reposição de outra origem, validação futura e realização futura. Não consulta dados externos nem concede autorização à existência de um identificador: o carregador ainda deverá verificar fontes, vínculo histórico e equivalência.

Presenças e regularizações compõem o numerador; uma aula original entra uma única vez, mesmo com mais de uma reposição validada. Memória conserva falta/impedimento original e apresenta a data de validação da regularização. Impedimento sem reposição permanece na base sem crédito. Canceladas e previstas futuras ficam fora da base; prevista passada gera pendência de conclusão; chamada ausente deixa resultado inconclusivo. Sem aulas não há frequência suficiente presumida. O percentual é preservado como fração e o mínimo é comparado sem arredondamento; 2/3 não satisfaz 66,67%.

Validação: oito testes unitários aprovados, TypeScript e lint direcionado aprovados; diff check aprovado. Não houve integração com banco, migration, build novo, exposição em tela, produção ou envio. Os tipos da função não representam novos estados persistidos no schema. Carregamento histórico, vínculo das reposições aprovadas, frequência consolidada do nível após transferências, fechamento, exceção de frequência e validação da progressão seguem pendentes conforme plano 358. Este incremento é uma base de cálculo, não a entrega integral de Q131/Q154.

## Incremento 358 — Lacuna entre avaliações e progressão, 14/09/2026

Revisão direta confirmou que decidirMudancaAcademica/executarMudancaAcademica ainda não consultam notas, frequência ou fechamento acadêmico. O consolidado calcula os mínimos, mas permanece acompanhamento; a fila de impactos de correções não resolve nem bloqueia operacionalmente a progressão. Portanto, aprovação manual e testes do fluxo atual não comprovam Q130/Q131/Q138/Q154.

Plano vinculante à implementação em docs/planejamento/integracao-progressao-academica-358.md: frequência histórica por contrato, fechamento versionado, exceção independente somente de frequência, integração da decisão/execução às fontes atuais e resolução das correções/equivalências. Inclui os caminhos válidos de regularização, segunda chamada e oportunidades, sem reduzir o escopo a um bloqueio. Critérios exigem preservar notas reais, financeiro e outros contratos.

Nesta rodada houve revisão de código e atualização documental; não houve mudança executável nem novos testes. A lacuna permanece aberta e impede declarar conformidade integral da progressão. O objetivo completo segue ativo.

## Incremento 357 — Retomada financeira respeita limite contratual, 14/09/2026

O contexto da retomada global consulta a mesma regra de impedimento das ações. Contratos estruturados ou múltiplos bloqueiam a preparação global e não recebem uma grade de parcelas para esse fluxo. Na lista individual e global, propostas pendentes informam impedimento de aprovação; a interface omite a aprovação incompatível, conserva consulta/rejeição independente e oferece acesso ao fluxo por matrícula. A ficha financeira passa a oferecer esse acesso diretamente. A consulta compartilha o resultado por aluno para não repeti-la em cada proposta da mesma pessoa.

Rejeitar continua sendo uma decisão distinta de retomar: não altera situação, parcelas ou recebimentos. O teste cria uma proposta antiga, adiciona outro contrato, verifica impedimento no contexto/lista, recusa aprovação direta e permite rejeição independente, preservando o aluno, calendário, recebimentos e outro contrato.

Validação: 37 integrações de retomada aprovadas, lint e build com TypeScript/52 páginas aprovados. Relatório docs/validacao-retomada-357-2026-09-14.json. Após o build, somente o texto do aviso de rejeição foi ajustado para não afirmar que o aluno necessariamente continua pausado. Sem migration, produção, envio externo ou homologação visual. Última regressão integral permanece 354; demais funcionalidades da SPEC seguem incompletas.

## Incremento 356 — Identidade histórica das consultas e ações da ficha, 14/09/2026

Lista acadêmica, paginação e consulta de pedido aberto por matrícula agora filtram SolicitacaoMudancaAcademica.matriculaId. Regularização posterior da referência de uma alocação não transfere seu pedido histórico a outro contrato. Pedidos legados sem identidade contratual preservada permanecem na consulta consolidada autorizada, sem atribuição automática à matrícula posteriormente identificada. Escopo docente e validação dos cursores continuam aplicáveis.

A proteção das ações globais e a ficha passam a compartilhar impedimentoFluxoGlobal. A página consulta a elegibilidade após autorizar a ficha e somente para quem pode movimentar. Contratos estruturados/múltiplos não recebem botões globais de pausa/encerramento/retomada nessa ficha; o link identifica o fluxo por matrícula, incluindo encerramento. O estado global foi rotulado como Cadastro. A leitura de elegibilidade não substitui a revalidação sob locks nas ações; edição cadastral e ações acadêmicas preservam suas capacidades anteriores.

Validação: 63 integrações acadêmicas aprovadas, incluindo histórico realocado, pedido legado e cursor fora do contrato; três integrações de proteção legada aprovadas, com consulta antes/depois do vínculo e recusa de chamadas diretas preservando os dados. Lint, TypeScript pelo build e build de produção com 52 páginas aprovados. Diff check aprovado. Relatório acadêmico em docs/validacao-integracao-academica-356-2026-09-14.json. Sem nova migration ou homologação visual. A revisão de outros caminhos legados, inclusive apresentação da retomada na ficha financeira, e as demais funcionalidades incompletas seguem pendentes. A última regressão integral continua sendo 354; esta rodada verificou os escopos alterados.

## Incremento 355 — Escopo contratual nas novas preparações acadêmicas, 14/09/2026

A ação de solicitar mudança acadêmica agora resolve a matrícula da única origem válida sob os locks existentes e recarrega somente esse contrato antes de capturar a memória. Isso também vale quando o chamador omite matriculaId; múltiplas origens continuam exigindo seleção. A busca de pedido aberto nessa ação usa a identidade tipada da solicitação. Repetir uma proposta existente revalida o escopo preservado em sua própria memória, sem convertê-la silenciosamente para outro regime.

Integração comprova solicitação com e sem matrícula explícita, seguida de outra alocação ativa e pausa de outro contrato, preservando parecer/aprovação/execução do contrato original. Recusa solicitação ambígua sem criar pedido adicional. Memórias anteriores v1/v2 sem escopo conservam seus requisitos e conteúdo; alterar outro contrato ainda invalida essas propostas antigas. Nova contratação posterior à solicitação já vinculada não impede sua execução e permanece integralmente preservada.

Validação: 828 unitários, 62 integrações acadêmicas, TypeScript, lint e build de produção com 52 páginas aprovados. A primeira integração teve 61 aprovações e uma falha em expectativa antiga que exigia invalidar proposta por nova contratação independente; o teste foi substituído por aprovação/execução com preservação do novo contrato, conforme INV-01/INV-04, e a suíte completa acadêmica passou. Relatório: docs/validacao-integracao-academica-355-2026-09-14.json. Sem migration, produção ou envios. A regressão integral de todas as integrações permanece a do incremento 354, anterior a esta correção; homologação visual e os demais consumidores identificados em 354 ainda pendentes.

## Incremento 354 — Regressão completa após contratos independentes, 14/09/2026

Regressão integral concluída após as migrations 158/159 e as alterações dos incrementos 348–353: 828 testes unitários em 89 arquivos e 710 integrações em 54 arquivos aprovados, sem falhas ou testes pendentes. A integração executou sequencialmente no PostgreSQL descartável e levou aproximadamente 680 segundos. Evidências em docs/validacao-regressao-unitarios-354-2026-09-14.json e docs/validacao-regressao-integracao-354-2026-09-14.json.

A revisão estática dos consumidores encontrou pendências concretas: ação acadêmica pública aceita preparação sem escopo de matrícula mesmo com origem contratual; ficha oferece ações globais que o servidor já recusa para contratos estruturados; consultas de solicitações ainda usam a matrícula da alocação em vez da identidade tipada do pedido. O formulário acadêmico já envia a matrícula quando identificada; a primeira lacuna não foi atribuída a esse formulário. Evidências, limites e critérios de correção em docs/planejamento/revisao-consumidores-contratuais-354.md.

Nenhum código de produção ou teste foi alterado durante a regressão. Este incremento acrescenta evidência e revisão documental; não corrige ainda os consumidores identificados. Diff check aprovado. Sem novo build, migration, homologação visual, produção ou envios externos. Testes aprovados não comprovam funcionalidades ainda ausentes da SPEC, migração real ou operação integral.

## Incremento 353 — Pausa e encerramento preservam outra turma ativa, 14/09/2026

Ampliada a integração dos fluxos contratuais com duas alocações ativas reais em turmas distintas. Na pausa, o vínculo é preservado, a chamada da turma pausada exclui o aluno durante a pausa e a chamada do outro contrato continua incluindo-o. O contrato excluído permanece idêntico; o período financeiro iniciado e os recebimentos conservam as verificações anteriores.

No encerramento, os cenários INCLUIR/EXCLUIR o dia efetivo agora mantêm outro contrato alocado em turma própria: a execução encerra somente o vínculo selecionado e preserva integralmente o outro vínculo e contrato. A chamada posterior ao encerramento exclui o vínculo encerrado e mantém o aluno na outra turma. Continuam os testes de crédito, preservação de recebimento e rollback após falha financeira.

As fixtures identificam explicitamente a ativação necessária à elegibilidade histórica; a aplicação não presume essa data. Foi atualizada uma asserção da mensagem do bloqueio global para o texto contratual introduzido em 348. Sem mudança nas regras de produção neste incremento.

Validação: 36 integrações em dois arquivos aprovadas, TypeScript e lint aprovados. Sem migration ou novo build, pois as alterações são de testes/documentação. Homologação visual, regressão completa posterior às migrations e revisão dos demais consumidores seguem pendentes.

## Incremento 352 — Solicitações acadêmicas simultâneas por contrato, 14/09/2026

A solicitação acadêmica agora possui matrícula de origem tipada com FK composta ao aluno. A migration 20260914143000 preenche os registros antigos somente pela identidade já preservada na memória da proposta; memória sem vínculo permanece legada. Substitui o índice global de pedido aberto por uma unicidade por matrícula e outra para pedidos legados por aluno. O banco confere correspondência entre alocação, matrícula e memória e impede trocar a identidade da solicitação. Aplicação realizada apenas no banco descartável: 159 migrations; schema diff vazio.

O serviço registra a matrícula exata ao criar o pedido. Teste integrado cria simultaneamente pedidos de dois contratos do mesmo aluno, conserva os dois abertos, repete o mesmo pedido sem duplicar, recusa outra proposta no mesmo contrato e cancelamento de um mantém o outro intacto. Inserção duplicada e alteração de identidade também são recusadas pelo banco.

Validação: 828 unitários aprovados; 59 integrações acadêmicas aprovadas; 53 integrações de avaliações aprovadas após estabilizar os instantes das fixtures. As primeiras execuções de avaliações falharam em limites temporais imediatamente posteriores a aprovação/reserva/designação. Os testes agora conferem o instante do banco antes de registrar eventos seguintes, sem flexibilizar validações de produção. Fixtures de mudanças preexistentes nas avaliações também passaram a identificar a matrícula na coluna e memória. TypeScript, lint e build/52 páginas aprovados. Mudanças posteriores ao build limitaram-se às fixtures, novamente verificadas por TypeScript/lint/integração.

Não houve homologação visual, produção ou envios reais. Permanecem a revisão integral dos consumidores de múltiplos contratos, concorrência entre fluxos distintos, regressão integral posterior às migrations e demais requisitos ainda incompletos.

## Incremento 351 — Alocações ativas em contratos independentes, 14/09/2026

A migration 20260914140000 substitui a unicidade global por aluno. Mantém uma alocação ativa por matrícula, uma alocação legada ativa sem matrícula por aluno e impede duplicação ativa do mesmo aluno na mesma turma. O banco serializa a conferência pelo aluno e recusa coexistência de vínculo legado sem matrícula com outro vínculo ativo até a conciliação. Nenhum vínculo histórico é inferido ou apagado. Migration aplicada exclusivamente ao PostgreSQL descartável: 158 migrations aplicadas; comparação com o schema sem divergência representável pelo Prisma.

A ativação da preparação passa a conferir o vínculo da matrícula alvo e a pendência de vínculo legado, sem bloquear apenas pela existência de outro contrato ou pela situação global legada. Os requisitos de aceite, pagamentos, reserva, ingresso e comissão permanecem. Consulta acadêmica sem seleção diante de múltiplos vínculos retorna origem ausente, em vez de escolher a primeira alocação.

Validação: 828 unitários aprovados; 150 integrações de reserva/ativação, acadêmico, diário e alocação aprovadas. Após ampliar as asserções de contratos simultâneos, 67 integrações acadêmicas/alocação novamente aprovadas. Os testes comprovam ativação concorrente/repetida preservando contrato e alocação anteriores, mudança acadêmica com outra alocação ativa preservada, recusa sem seleção, unicidade por matrícula em turma livre e bloqueio da mistura com legado nas duas ordens. Build com TypeScript/52 páginas e lint aprovados. Sem homologação visual ou produção.

Pendências: o índice global de solicitação acadêmica aberta ainda impede pedidos simultâneos de contratos diferentes. A revisão completa de consumidores, cenários de concorrência entre fluxos distintos e homologação operacional continua necessária. A liberação estrutural e os testes deste incremento não significam conclusão do objetivo integral.

## Incremento 350 — Elegibilidade acadêmica pela matrícula vinculada, 14/09/2026

Mudanças acadêmicas de uma alocação vinculada passam a exigir a situação ativa e a compatibilidade do contrato correspondente, sem depender do status global legado do aluno. O vínculo sem matrícula continua exigindo aluno globalmente ativo. A tela usa as permissões e impedimentos calculados no servidor para oferecer a ação, removendo a condição global redundante.

Novas propostas usam memória versão 2: statusAluno fica nulo para alocação contratual, porque a situação vinculante está na matrícula preservada na memória. Isso não altera o cadastro do aluno. A versão 1 continua sendo lida e comparada segundo sua condição global original; uma mudança global não amplia uma aprovação antiga automaticamente. Alterações de matrícula, vínculo, currículo e demais condições continuam sujeitas à revalidação.

Validação: 828 unitários aprovados, incluindo conservação da versão antiga, independência de status global e recusa de matrícula pausada; 58 integrações acadêmicas aprovadas. Novos cenários solicitam, emitem parecer, aprovam e executam mudança de contrato ativo com cadastro global PAUSADO/ENCERRADO, preservando cadastro e dados financeiros. Build com TypeScript e 52 páginas e lint aprovados. Sem migration, homologação visual ou alteração de produção.

Pendências: ativação e índices ainda limitam múltiplas alocações; migração completa e homologação operacional permanecem incompletas. A regressão integral 347 é histórica; somente os escopos acima foram novamente executados.

## Incremento 349 — Fila acadêmica filtrada pela matrícula, 14/09/2026

A consulta de solicitações acadêmicas aceita matrícula e aplica esse filtro pela alocação de origem, conjuntamente com aluno, estado e escopo docente. A página acadêmica passa a matrícula selecionada à listagem e preserva o filtro nos links de paginação. O cursor precisa pertencer ao mesmo escopo; cursor de outro contrato é recusado. A consulta sem matrícula continua sendo a visão consolidada autorizada do aluno/equipe.

Teste integrado com dois contratos e solicitações históricas distintas comprova separação do histórico, filtro de abertas, cursor válido e cursor de outro contrato, combinação de aluno divergente e matrícula, rejeição de matrícula vazia e restrição docente. O professor atual só recebe o pedido de seu vínculo vigente; conhecer a matrícula ou o cursor não amplia a autorização. O cenário usa vínculos sequenciais porque a liberação de múltiplas alocações simultâneas permanece pendente.

Validação: 56 integrações acadêmicas aprovadas; lint e build Next.js com TypeScript e 52 páginas aprovados. Sem migration. Não houve homologação visual interativa nem nova regressão completa. Permanecem os índices globais de alocação e de solicitação aberta e as demais pendências de migração por contrato.

## Incremento 348 — Proteção contra movimentação global de contratos independentes, 14/09/2026

O limite do fluxo legado agora recusa pausa, encerramento e solicitação/decisão de retomada globais quando o aluno tem mais de uma matrícula, mesmo sem movimentação contratual anterior. Também recusa um contrato único já estruturado por preparação comercial, vínculo acadêmico (inclusive histórico), condições por hora ou compra de horas. Mantém as proteções anteriores para pausa e movimentações contratuais. A conferência ocorre sob os bloqueios já usados pelos serviços; a resposta orienta selecionar contratos no fluxo contratual.

Três novos testes de integração exercitam as ações públicas com Secretaria e Administração, dois contratos ativos sem movimentação anterior e contrato único com alocação vinculada. Cada recusa preserva integralmente cadastro, matrículas, cobranças, vínculos, movimentos, propostas e eventos. Um teste acadêmico antigo passou a representar explicitamente alocação legada sem matrícula: continua provando que pausa/retomada reais invalidam aprovação anterior, sem exigir que o caminho global alcance vínculo já migrado.

Validação: 825 unitários aprovados; 36 integrações de retomada aprovadas na primeira execução; após adequação do cenário, 58 integrações (55 acadêmicas e 3 novas) aprovadas. TypeScript, lint e diff aprovados. Não houve migration nem novo build. A regressão completa 347 é anterior a esta alteração; não afirmar que todos os arquivos foram novamente executados.

Esta proteção não libera múltiplas alocações. Permanecem a migração do índice global, do limite de solicitações acadêmicas abertas e dos demais consumidores de situação global, além da homologação e do restante do escopo. O legado não estruturado ainda precisa ser migrado; não é autorização para operar produção pelo caminho antigo.

## Incremento 347 — Regressão completa e pendências estruturais, 14/09/2026

Concluída a regressão completa do estado atual: 825 testes unitários em 89 arquivos e 701 integrações em 53 arquivos, todos aprovados. A integração levou 812,07 segundos no PostgreSQL descartável localhost:54329, com execução sequencial. Relatórios por teste: validacao-regressao-unitarios-347-2026-09-14.json e validacao-regressao-integracao-347-2026-09-14.json. O build/TypeScript/lint mais recente é o incremento 346, sem alteração de código desde então.

Esta regressão comprova os cenários existentes, não os requisitos ainda sem implementação. A revisão confirmou que contratos simultâneos em turmas continuam limitados pelo índice global de alocação e pela ativação. O fluxo global antigo e o índice de solicitações acadêmicas abertas por aluno também exigem revisão antes de liberar múltiplos vínculos. A tela já seleciona matrícula e alguns serviços já restringem pelo contrato; isso não conclui a migração estrutural. Detalhes em validacao-regressao-347-em-andamento.md, agora encerrado como registro histórico.

Não houve alteração de produção, execução de migration nova nem envio externo. Os drivers externos de WhatsApp são simulados nos testes, inclusive nos cenários denominados live. Homologação visual e operação de serviços reais continuam pendentes. O objetivo integral permanece incompleto.

## Incremento 346 — Memória financeira visível na revisão do acerto, 14/09/2026

O resumo das demais cobranças na prévia e no rascunho do encerramento agora apresenta separadamente valor negociado anterior, recebimentos, crédito já utilizado, valor devido proposto, saldo e crédito apurado. O aprovador pode expandir a origem das particulares por hora e conferir os valores dos itens faturados preservados, os recebimentos individuais e as utilizações anteriores de crédito com suas referências de aprovação. Os dados vêm da memória da proposta, sem consultar ou misturar outros contratos.

A apresentação esclarece que crédito apurado acompanha a efetivação aprovada e que uso/devolução seguem os fluxos próprios. Os campos adicionais são opcionais para leitura de versões anteriores. Não houve alteração dos cálculos, permissões ou movimentações financeiras.

Validação: lint aprovado; build Next.js com TypeScript e geração de 52 páginas aprovado; diff sem erros. Sem novo teste de integração porque a alteração se limita à apresentação de dados já produzidos e verificados no incremento 345. Homologação visual interativa permanece pendente. Sem migration, produção ou envio externo.

## Incremento 345 — Crédito de horas já pagas no encerramento, 14/09/2026

Validação integrada adicional: cobrança por hora de 156,25 CRC recebe pagamento pelo serviço financeiro; acerto com aprovação independente reduz o devido para 100,00 CRC e encerra somente a matrícula selecionada. O recebimento completo permanece idêntico, o valor original da cobrança e do item faturado é preservado, o saldo devido fica zerado e um crédito de 56,25 CRC é criado na matrícula, com origem no acerto. Repetir a efetivação mantém um único crédito e um único recebimento. O segundo contrato continua ativo.

Esta entrega amplia a verificação do comportamento existente; não altera regras de produção nem implementa execução de devolução. Crédito apurado permanece distinto de devolução efetiva. Permanecem pendentes a homologação visual, os cenários combinados com antecipações e a conclusão integral do escopo.

Validação: 23 testes de integração no arquivo de condições por hora aprovados; TypeScript e lint aprovados. Sem migration, sem novo build por se tratar de teste e documentação, sem envios externos ou alteração de produção.

## Incremento 344 — Ajuste aprovado de horas faturadas no encerramento, 14/09/2026

O cenário de encerramento agora cobre manutenção do saldo de 156,25 CRC e redução aprovada para 100,00 CRC. Em ambos, o valor original da cobrança e do item faturado permanece em 156,25 CRC. O registro de ajuste identifica decisão do acerto, valor anterior e novo valor. A efetivação atualiza valor negociado/saldo conforme a aprovação, sem gerar pagamento ou crédito inexistente, e conserva o outro contrato ativo.

A preparação do acerto identifica particulares por hora e informa a origem em fechamento aprovado com quantidade de encontros. Cobertura mensal pendente é apresentada apenas nas mensalidades; cobranças por hora não exigem período de serviço fictício para serem revisadas. A redução continua proposta sujeita à aprovação independente.

Validação: 22 integrações de condições por hora aprovadas, com a execução completa nos dois valores finais; TypeScript e lint aprovados. Build com 52 páginas aprovado após ajuste de apresentação. Sem migration. Sem homologação visual interativa.

Pendentes: combinação com recebimentos/antecipações/compensações, crédito por valor já pago, apresentação detalhada na decisão e homologação visual. Não generalizar o cenário sem recebimentos para todos os acertos financeiros. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 343 — Execução do encerramento com horas faturadas, 14/09/2026

O cenário integrado de faturamento foi estendido até a efetivação do encerramento: condições contratuais preparadas e aprovadas, pedido da Secretaria, acerto preparado pelo Financeiro/Administração, aprovação independente e executor de encerramento. Uma cobrança por hora de 156,25 CRC é preservada integralmente, sem proporcional mensal, recebimento, crédito ou apagamento do item faturado. A repetição da efetivação retorna o mesmo resultado.

O mesmo aluno tem um segundo contrato ativo fora do pedido. A execução encerra somente a matrícula selecionada e preserva situação e versão de acesso do contrato excluído. As datas futuras usadas no teste são fornecidas ao executor interno de validação; nenhuma data ou operação real foi alterada.

Validação: 21 integrações de condições por hora aprovadas com o cenário ampliado; TypeScript e lint aprovados. Sem alteração de código de produção ou migration neste incremento. Último build e suíte unitária integral no incremento 342. Esta evidência cobre encerramento sem desconto/ajuste do saldo faturado; não generalizar para todos os tipos de acerto.

Pendentes: ajustes autorizados sobre cobranças por hora, coexistência com antecipações e compensações, apresentação das origens na revisão, contratos históricos/aditivos e homologação visual. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 342 — Origem do faturamento por hora na memória do acerto, 14/09/2026

O contexto de encerramento passa a carregar emissão, decisão, memória e itens das cobranças originadas de fechamento por hora. A conferência de outras cobranças preserva essa origem na proposta do acerto. O valor permanece separado das mensalidades: não recebe cobertura fictícia nem proporcional mensal. Alteração proposta continua explícita e sujeita à aprovação do acerto, sem modificar o valor original de emissão.

O teste integrado confirma que a cobrança HORA_PARTICULAR de 156,25 CRC não tem cobertura mensal, conserva os itens e entra na conferência como saldo integral, crédito zero e sem alteração proposta quando a equipe mantém o valor. As origens passam a participar da memória revalidada do acerto.

Validação: 31 integrações de condições por hora e solicitação de encerramento aprovadas; suíte unitária integral com 825 testes em 89 arquivos aprovada. Build com TypeScript e 52 páginas aprovado; lint aprovado. Sem migration/interface alterada. Última regressão integral de integração permanece 298.

Pendentes: execução integral do encerramento com fechamento por hora, ajustes posteriores e suas autorizações, apresentação da origem na revisão do acerto, reservas antecipadas e homologação visual. Este incremento confirma a conferência das cobranças; não comprova todos os casos de encerramento. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 341 — Destinação financeira por hora na conferência de encerramento, 14/09/2026

A conferência da agenda de encerramento reconhece conferências faturadas e preserva cobrança/item como origem. Encontros por hora sem destinação continuam pendentes até emitir ou comprovar não cobrança. Cancelamentos deixam de ser ignorados: sem conferência continuam pendentes; cancelamento da escola ou do aluno no prazo, conferido sem valor, é identificado como SEM_COBRANCA. Cancelamento tardio cobrável permanece pendente até destinação. Matrículas legadas sem preparação comercial são reconhecidas como por hora quando têm condições aprovadas.

O acerto conserva destinacoesHoras na memória; alterações futuras dessa origem invalidam propostas anteriores pela revalidação existente. Não cria quitação, não cancela dívidas e não dispensa a consolidação das cobranças no acerto. Encontros com reservas antecipadas continuam sujeitos ao fluxo próprio de liquidação, ainda a revisar em conjunto.

Validação: 29 integrações de condições por hora e solicitação de encerramento aprovadas inicialmente; após acrescentar os cenários de cancelamento, 21 testes do arquivo de condições por hora aprovados (incluindo os 19 anteriores). TypeScript e lint aprovados. Cenários cobrem bloqueio antes de faturar, liberação após emissão com origem preservada, cancelamento sem conferência, no prazo sem cobrança e tardio ainda pendente. Sem migration/interface alterada; último build 340.

Pendentes: consolidação financeira completa das cobranças por hora no acerto, reservas antecipadas e cancelamentos pela escola no encerramento, execução integral do encerramento com esses casos, ajustes e homologação visual. Esta integração trata a conferência da agenda, não comprova encerramento completo de todas as ofertas. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 340 — Contrato do fechamento e autorização financeira do arquivo, 14/09/2026

A tela oferece abertura do contrato de origem quando ele é o documento atual confirmado da matrícula, não arquivado e usa a rota privada de uploads. Links externos ou referências indisponíveis não são publicados. A abertura passa novamente pela autorização da rota privada, com sessão e papéis atuais.

Foi corrigida a divergência que permitia ao Financeiro conferir condições mas negava o próprio contrato: podeLerArquivo permite CONTRATO somente quando o documento exato está registrado como contrato confirmado de uma matrícula coerente com seu vínculo direto ou lead. Os demais documentos administrativos continuam restritos. Arquivado, finalidade de upload incompatível e contrato não confirmado não recebem essa concessão. A mudança concede leitura, não edição ou upload administrativo.

Validação: 19 integrações de condições por hora e 23 unitários de autorização aprovados. O mock unitário foi ampliado para a nova consulta de vínculo; o teste anterior de contrato sem confirmação continua negando Financeiro. Build com TypeScript e 52 páginas aprovado; após ajuste final de visibilidade conforme confirmação, TypeScript aprovado. Lint aprovado antes desse ajuste simples. Sem migration. Sem homologação visual interativa ou comprovação de existência física dos arquivos legados.

Pendentes: versões contratuais substituídas/aditivos e sua leitura histórica, detalhes de antecipações, integração ao encerramento/ajustes e homologação visual. Acesso permitido não comprova que o arquivo legado exista no armazenamento. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 339 — Identificação dos encontros e cobranças anteriores, 14/09/2026

O detalhe identifica pendências e destinações preservadas pelo horário guardado na origem, no fuso da apuração. Memórias antigas sem horário permanecem identificadas como incompletas; não são reconstruídas pela agenda atual. Encontros sem cobrança exibem data e motivo de classificação. Para encontros já faturados, a consulta resolve o fechamento anterior dentro da mesma matrícula e oferece navegação até a cobrança de origem, permitindo acompanhar a complementar sem repetir seus itens.

A resolução usa somente as referências preservadas no snapshot individual e filtra tanto cobrança quanto rascunho pela matrícula autorizada. A lista paginada não carrega essas origens. Destinações de antecipações continuam indicadas como conferidas, sem afirmar recebimento novo.

Validação: 18 integrações aprovadas, ampliadas para vínculo da cobrança complementar com a versão parcial e horários preservados das origens. Build com TypeScript e 52 páginas aprovado após correção de estreitamento de tipo no componente; lint aprovado. Sem migration. Última suíte unitária integral 338 (824 testes). Sem homologação visual interativa.

Pendentes: acesso ao documento contratual nesta tela, detalhes próprios das destinações de antecipação, integração ao encerramento/ajustes e homologação visual. A navegação não substitui a conferência contratual nem autoriza correções financeiras. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 338 — Concorrência de períodos sobrepostos e regressão unitária, 14/09/2026

Foi exercitado o cenário de dois rascunhos aprovados com referências distintas (mês civil e ciclo da matrícula) que incluem a mesma conferência. As emissões públicas são disparadas simultaneamente. A trava serializa a revalidação: uma cria a cobrança/item e a outra identifica mudança das origens, exigindo nova versão. Repetir a vencedora retorna sua emissão; repetir a outra continua sem emitir. A existência de duas propostas não autoriza cobrar o mesmo encontro duas vezes nem decide qual referência contratual deveria ter sido escolhida pela equipe.

Validação: 18 integrações de condições por hora aprovadas; uma única cobrança, emissão e item no cenário de sobreposição, sem recebimentos. Suíte unitária integral executada: 824 testes em 89 arquivos, zero falhas. TypeScript e lint aprovados. Sem alteração de produção ou migration neste incremento. Último build 337, último schema diff vazio 335. A última regressão integral de integração permanece 298; os testes atuais são direcionados.

Pendentes: revisão da usabilidade das referências concorrentes, vínculo visível entre cobranças complementares, detalhes de origens, integração ao encerramento/ajustes e homologação visual. Não inferir conclusão geral a partir destas verificações. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 337 — Emissão pela interface e consulta da cobrança, 14/09/2026

O detalhe da versão aprovada com itens e estado apto oferece Emitir cobrança aprovada, exibindo o valor antes da ação. O servidor continua revalidando as origens e a decisão. Após registro, a tela apresenta emissão, executor/data, identificação da cobrança, valor original, valor atual e saldo, com acesso à ficha financeira. Emissão existente retira a ação de emitir. Estado histórico da apuração permanece separado do registro da emissão.

A consulta serializa valores e datas da cobrança, mantendo emissão nula para decisões ainda não executadas. O histórico mostra separadamente a cobrança parcial e a complementar vinculadas às respectivas versões. Não transforma emissão em pagamento; recebimentos continuam na ficha financeira. O botão é uma possibilidade de execução, não uma garantia de que origens ainda estejam válidas.

Validação: 17 integrações aprovadas, ampliadas para ambas as cobranças no histórico, valores/saldos e versão sem emissão. Build com TypeScript e 52 páginas aprovado após correção de sintaxe na consulta; lint aprovado. Sem migration. Sem homologação visual interativa.

Pendentes: apresentação explícita do vínculo entre cobranças complementares, acesso ao contrato de origem, identificação dos encontros pendentes/destinações, concorrência entre períodos sobrepostos e integração ao encerramento/ajustes. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 336 — Emissão parcial, complementar e ação autenticada, 14/09/2026

emitirFechamentoHoras recebe apenas aluno, matrícula e decisão; obtém o executor da sessão Financeiro/Administração e delega à transação protegida. Após sucesso, invalida as páginas do fechamento e Financeiro. O cliente não escolhe a identidade executora. Esta ação ainda não possui botão na interface.

O novo cenário integrado cobre dois encontros, um conferido e outro pendente: a decisão de aguardar impede emissão; uma nova versão parcial aprovada gera 156,25 CRC; após conferência do segundo encontro, uma versão complementar gera somente 125,00 CRC. A primeira origem fica preservada fora da nova cobrança. Repetir ambas as decisões retorna suas emissões anteriores. Não há recebimento criado. A ação pública foi exercitada com repetição autorizada, aluno incorreto e professor sem permissão.

Validação: 17 integrações aprovadas, TypeScript e lint aprovados, build com 52 páginas aprovado. Sem migration; último schema diff vazio 335. Nenhuma homologação visual interativa.

Pendentes: navegação/identificação explícita das cobranças parcial e complementar, botão de emissão e memória no Financeiro, testes de decisões concorrentes sobre períodos sobrepostos, integração ao encerramento e ajustes posteriores. Não considerar o fluxo inteiro concluído por este cenário. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 335 — Integridade do conjunto de emissão por hora, 14/09/2026

A nova migration confere executor vigente, decisão independente, memória igual à versão aprovada e compatibilidade inicial de matrícula, tipo, moeda, valores e vencimento da cobrança. Uma constraint diferida exige que a transação termine com a quantidade, soma e encontros dos itens correspondentes à apuração. Origem da cobrança (matrícula, tipo, moeda e valor original) passa a ser preservada após emissão. Pagamentos e ajustes não são inferidos desta origem.

O executor força a verificação da constraint antes de retornar sucesso. O teste inicial expôs rejeição no commit sem propagação esperada pelo Prisma; a verificação explícita na transação corrigiu o caminho de erro observável. Transação sem itens reverte também a cobrança. Não foi removida ou afrouxada a constraint.

Validação final: 16 integrações aprovadas, incluindo transação incompleta, rollback, origem alterada, emissão concorrente e apuração posterior. TypeScript e lint aprovados. Base descartável com 157 migrations; schema diff vazio. Último build 333. Sem interface alterada.

Pendentes: cenários adicionais de emissão parcial e concorrência entre períodos/decisões, ajustes autorizados de valor/vencimento e efeitos em outros fluxos, ação pública/interface e encerramento. Banco confere consistência do conjunto; revalidação completa da agenda/contrato permanece no serviço antes de emitir. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 334 — Emissão interna do fechamento e origens faturadas, 14/09/2026

EmissaoFechamentoHoras vincula decisão, cobrança, executor e memória; ItemFechamentoHoras vincula cada conferência faturada uma única vez. emitirFechamentoHorasTx exige executor Financeiro/Administração vigente, decisão aprovada da matrícula/aluno e revalidação das origens. Apuração completa ou proposta parcial com itens pode emitir; aguardar pendências e ausência de itens não geram cobrança. A cobrança HORA_PARTICULAR conserva valor apurado, moeda e vencimento no fuso proposto, sem criar recebimento. Registro, itens e evento são gravados na mesma transação. Repetir a decisão retorna a emissão existente.

O leitor da apuração reconhece itens faturados e os preserva fora do novo valor, inclusive em nova versão do período. A migration impede repetir a conferência em outro item, protege a imutabilidade da origem e confere o vínculo/valor do item com a decisão aprovada. Esta primeira proteção não substitui as verificações integrais de emissão no serviço; ainda faltam restrições de fechamento do conjunto e proteção contra alterações incompatíveis da cobrança por outros fluxos.

Validação: 16 integrações aprovadas. O novo cenário cobre conferência, preparação, decisão independente, duas emissões simultâneas, uma cobrança de 156,25 CRC, um item, imutabilidade, apuração posterior zerada com origem faturada e ausência de recebimento. TypeScript e lint aprovados. Base descartável com 156 migrations e schema diff vazio. Último build 333. Sem interface de emissão ou homologação visual.

Pendentes: endurecer integridade do conjunto cobrança/emissão/itens, testar emissão parcial e mudanças concorrentes entre decisões/períodos, proteger alterações da cobrança, expor ação autenticada/interface e integrar o encerramento. Executor é interno; o chamador deve fornecer identidade autenticada. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 333 — Decisão do fechamento pela interface, 14/09/2026

A consulta expõe elegibilidade de decisão calculada com permissões vigentes, autoria e ausência de decisão. O detalhe apresenta a cláusula/período transcritos e a escolha de aguardar ou propor parcial sem expor chave/hash da entrada. O formulário exige decisão e justificativa; aprovação também exige confirmação explícita da referência contratual. Ao salvar, o serviço revalida independência, permissões e origens. A rejeição continua disponível para uma versão desatualizada, sem alterá-la. A elegibilidade da tela não certifica validade atual para aprovação.

Validação: 15 integrações aprovadas, ampliadas para visibilidade do decisor, cláusula apresentada, bloqueio após nova conferência financeira e documento arquivado, rejeição preservada e retirada do formulário após decisão. Build com TypeScript e 52 páginas aprovado; TypeScript final e lint aprovados. Sem migration. Sem homologação visual interativa.

Pendentes: acesso direto ao documento contratual de origem nesta tela, detalhamento das destinações e encontros pendentes, emissão transacional, proteção contra faturamento duplicado e integração ao encerramento. Aprovação não comprova emissão. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 332 — Decisão independente do fechamento por hora, 14/09/2026

DecisaoFechamentoHoras preserva decisão única por versão, responsável, motivo, data e confirmação explícita da referência contratual. decidirFechamentoHoras exige Administração ou Financeiro com financeiro.aprovar_acertos vigente e pessoa distinta do preparador. Aprovação revalida contrato, período, versão e todas as origens na mesma transação. Rejeição preserva o histórico sem exigir que a apuração continue atual. Repetição exata retorna a decisão; tentativa divergente não a substitui. A escolha de aguardar também pode receber decisão, sem autorizar emissão dos encontros pendentes.

A migration protege autoria autorizada, independência, versão/documento na aprovação e imutabilidade. A recomposição integral das origens é responsabilidade do serviço e deve ocorrer novamente na emissão; uma linha de decisão isolada não certifica faturamento. A consulta e a tela mostram a decisão separada do estado histórico da apuração.

Validação: 14 integrações aprovadas, incluindo autoaprovação, Financeiro sem permissão, referência não confirmada, concorrência/repetição, histórico da decisão, tentativa de alteração/exclusão e revogação de permissão. Build com TypeScript e 52 páginas aprovado; lint aprovado. Migration aplicada somente na base descartável: 155 migrations, schema diff vazio. Sem homologação visual interativa.

Pendentes: formulário para decidir pela interface, cenários adicionais de aprovação/rejeição após mudanças de origem, emissão transacional com revalidação e itens faturados, tratamento de períodos sobrepostos e integração ao encerramento. A decisão não emite cobrança. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 331 — Revalidação transacional do fechamento por hora, 14/09/2026

revalidarFechamentoHorasTx confere matrícula/aluno, entrada preservada, contrato atual confirmado, documento disponível, limites do período e versão mais recente. Recompõe a apuração sob as travas de agenda/matrícula e confronta integralmente com o snapshot, sem atualizar o rascunho. É um componente interno para integração à decisão/execução na mesma transação; o chamador deve autenticar e autorizar o responsável. Não existe ainda aprovação ou emissão por este componente.

As origens passaram a preservar início, fim e estado dos encontros, além de identificadores do informe/conferência. Isso detecta remarcação dentro do próprio período mesmo quando o total permanece igual. Versões antigas sem essas informações continuam no histórico, mas exigem nova preparação antes de aprovação; nenhum histórico foi preenchido artificialmente.

Validação: 13 integrações aprovadas. O novo cenário verifica versão atual, aluno incorreto, remarcação de encontro pendente com rollback, conferência financeira posterior, versão superada e documento arquivado, sem emissão. TypeScript e lint aprovados. Sem migration/interface alterada; último build 330. A validação é técnica das origens e não substitui a conferência humana da referência contratual.

Pendentes: integrar aprovação independente e emissão transacional, resolver sobreposição entre períodos propostos e persistir os itens faturados. Revalidação isolada não certifica a operação completa. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 330 — Preparação do fechamento por hora pela interface, 14/09/2026

O histórico de fechamentos agora inclui formulário de preparação. Financeiro/Administração informa referência civil/ciclo, âncora quando aplicável, data no período, fuso, vencimento, cláusula, motivo e escolha de aguardar/propor parcial. A consulta calcula os limites e busca a última versão do período exato, sem depender da página do histórico. A tela apresenta período e versão antes de salvar; alteração de campo invalida a conferência. O servidor continua revalidando contrato, escopo, permissões, versão e apuração na transação de gravação.

A entrada conserva a mesma chave de repetição enquanto for idêntica. Resultado de transporte incerto orienta consultar o histórico; erro explícito permite conferir novamente. Salvar abre a versão persistida, sem emitir cobrança. Não foram presumidos fuso, prazo ou condições contratuais. O documento utilizado é o atual da matrícula, sujeito à conferência do serviço no momento da gravação.

Validação: 12 integrações aprovadas, ampliadas para versão corrente do período e ausência de versões em outro mês. Lint aprovado nos quatro arquivos. Build com TypeScript e 52 páginas aprovado; após ajuste final de recuperação do formulário e ampliação dos testes, TypeScript independente aprovado. Sem migration e sem homologação visual interativa.

Pendências: detalhamento identificável dos encontros pendentes e destinações, aprovação independente, revalidação contratual e emissão transacional com origens faturadas. O formulário prepara rascunho; não conclui o fechamento financeiro. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 329 — Interface de consulta dos fechamentos por hora, 14/09/2026

A conferência das particulares oferece acesso ao histórico em /matriculas/[id]/fechamentos-horas. A página exige sessão financeira e utiliza a consulta autorizada do incremento 328. Lista versões com autor, motivo e intervalo, navega por cursor e abre a apuração preservada individualmente. O detalhe apresenta período civil/fuso, vencimento, estado, total, minutos, encontros incluídos com data e preço, pendências e quantidades preservadas/sem cobrança. Memória incompatível apresenta erro de conferência, sem inventar valores. Rascunho não é apresentado como aprovação, emissão ou recebimento.

Validação: build Next.js aprovado após a última alteração, incluindo TypeScript e geração de 52 páginas estáticas; a nova rota dinâmica consta no resultado. Lint e TypeScript independente aprovados. Testes de autorização/histórico continuam os 12 aprovados no incremento 328; não foram repetidos para esta alteração de apresentação. Sem migration; último schema diff vazio 327. Sem homologação visual interativa.

Ainda completar preparação pela interface, detalhes de destinações/pendências identificáveis por encontro, aprovação independente, revalidação contratual e emissão transacional. Esta tela consulta rascunhos já persistidos; não conclui o fluxo operacional. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 328 — Consulta autorizada das versões de fechamento por hora, 14/09/2026

consultarFechamentosHoras oferece listagem paginada e leitura individual das versões preservadas. Exige Financeiro/Administração vigente e matrícula pertencente ao aluno informado; cursor e identificador da versão são validados na mesma matrícula. A leitura usa transação RepeatableRead. A listagem traz até 30 versões, autor, motivo, documento e intervalos, sem carregar a memória completa dos encontros. A consulta individual retorna o snapshot preservado, sem recalcular a apuração pelo estado atual. Chave de repetição e hash da entrada não são expostos. Toda versão é identificada como rascunho e não comprova emissão.

Validação: 12 integrações de condições por hora aprovadas, incluindo resumo/detalhe, navegação por cursor, consulta de versão anterior, isolamento aluno/matrícula, Financeiro autorizado, professor/Secretaria sem acesso e usuário desativado. TypeScript e lint aprovados. Nenhuma migration ou interface alterada. Último build 325, schema diff vazio 327, suíte unitária integral 326 e regressão integral de integração 298.

Ainda faltam interface, aprovação independente, revalidação da referência contratual e emissão com itens faturados persistidos. A consulta histórica não atesta validade atual da proposta nem autoriza cobrança. Sem produção, importação real ou envios externos. Objetivo geral incompleto.

## Incremento 327 — Rascunho persistido do fechamento mensal por hora, 14/09/2026

O Financeiro/Administração pode preparar uma versão imutável da apuração por matrícula, vinculada ao contrato confirmado. O registro conserva a referência civil ou ciclo mensal proposto, fuso, limites do período, vencimento, cláusula informada, escolha de aguardar/propor parcial, motivo e origens da apuração. A referência transcrita ainda precisa de conferência contratual antes da emissão; salvar o rascunho não aprova suas condições nem gera cobrança.

A ação verifica permissões vigentes e vínculo do aluno, trava agenda/matrícula e preserva a chave de repetição. Solicitações concorrentes iguais retornam a mesma versão; entrada divergente com a mesma chave e versão anterior desatualizada são rejeitadas. A migration protege autoria autorizada, documento disponível, sequência de versões, coerência de matrícula/período e imutabilidade. O banco não certifica sozinho toda a memória financeira: a futura aprovação deve revalidar as origens e a apuração.

Validação: 11 testes de integração de condições por hora aprovados; 17 unitários de período/apuração aprovados, incluindo fevereiro bissexto, ciclo no dia 31 e mudança de horário de verão. TypeScript e lint aprovados. As 154 migrations estão aplicadas somente na base descartável; schema diff vazio. Último build: incremento 325; última suíte unitária integral: 326 (821 testes); última regressão integral de integração: 298. Nenhuma homologação de interface realizada neste incremento.

Pendências: consulta/interface do fechamento, aprovação independente da proposta parcial, conferência da referência contratual, itens faturados e emissão transacional sem duplicação. Sobreposição de propostas não é autorização de faturamento. Não habilitar produção usando apenas este rascunho. Sem produção, importação real ou envios externos. Objetivo geral incompleto.

## Incremento 326 — Leitura da apuração por período com conferências persistidas, 13/09/2026

carregarApuracaoHorasTx lê os encontros particulares publicados do período informado, incluindo cancelados e encontros sem informe/conferência. Somente a conferência financeira preservada fornece preço, condições e ocorrência ao cálculo. Informe docente isolado permanece pendência; condições/preço ausentes são representados por null, sem fabricar valor zero ou versão fictícia. A apuração conserva identificadores do encontro, informe e conferência.

O leitor confronta memória, condições imutáveis, minutos, moeda, valor, desfecho e vínculo com a conferência gravada. Reserva de horas antecipadas com consumo/liberação conferidos é preservada fora da nova obrigação; reserva sem destinação continua pendente. Não reprecifica encontros conferidos pelo catálogo atual. Rascunho não integra a apuração. O chamador deve fornecer período/vencimento contratuais e manter travas de agenda/matrícula; este leitor é interno, sem nova ação pública.

Dez integrações de condições por hora aprovadas, incluindo novo cenário com informe ainda não conferido, conferência completa, encontro adicional pendente, proposta parcial e isolamento do aluno. Quatorze unitários do cálculo aprovados; suíte unitária integral também executada: 821 testes em 88 arquivos, zero falhas. TypeScript e lint aprovados. Sem schema/migration/UI alterados; último build 325, último schema diff vazio 324, última regressão integral de integração 298.

Ainda persistir período contratual/fechamento, aprovar emissão parcial, registrar itens faturados e impedir repetição sob concorrência na emissão. O estado de apuração completa não comprova faturamento; o leitor ainda não consome origem persistida de item faturado porque esse registro não existe. Integrar antecipações liberadas e revisão financeira aos cenários completos antes de habilitar produção. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 325 — Interface financeira da ocorrência e memória registrada, 13/09/2026

A ficha financeira oferece navegação por matrícula para /matriculas/[id]/ocorrencias-financeiras, incluindo acesso às condições por hora de contratos legados. A consulta exige Financeiro/Administração vigente, pagina encontros particulares em grupos de 30 e valida o cursor dentro da matrícula. Apresenta informe vigente, versões contratuais aprovadas e conferência persistida com valores serializados, autor, motivo e memória histórica.

A tela separa prévia de conferência registrada. Selecionar outra versão invalida a prévia; registrar exige justificativa e usa o hash revalidado no servidor. Repetição mantém a chave para a mesma entrada. Condições, vigência, desfecho, preço, minutos, comunicação/limite e pendências de antecipação são apresentados. Conferência salva mostra a memória preservada com cláusulas e versões, sem recalcular o histórico pela configuração atual. Emissão da cobrança continua uma etapa separada.

Nove integrações de condições por hora aprovadas, ampliadas para consulta histórica do valor/origens, cursor fora da matrícula, professor sem acesso e usuário revogado. Lint aprovado nos cinco arquivos alterados; build com TypeScript e 52 páginas aprovado; diff sem erros. Sem migration. Último schema diff vazio no incremento 324; última suíte unitária integral 317 e última regressão integral de integração 298.

Sem homologação interativa desta interface. Ainda implementar fechamento mensal, proposta/decisão parcial, emissão transacional, destinação de antecipações e revisão dos efeitos da conferência. A navegação não comprova operação integral desses fluxos nem a migração de dados reais. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 324 — Conferência financeira persistida da ocorrência, 13/09/2026

ConferenciaOcorrenciaHoras preserva encontro, informe, condições aprovadas, conferente, minutos, valor, moeda, desfecho e memória da prévia. A ação exige Financeiro/Administração vigente, correspondência aluno/matrícula e hash da prévia revalidada. Chave de repetição e unicidade por encontro/informe impedem duplicação; repetição continua exigindo acesso atual. A gravação e o evento são atômicos, sem emissão de cobrança ou recebimento.

O banco confere autoria financeira, origem, contrato, moeda, vigência, cancelamento e cálculo de minutos/valor. Conferência de encontro com reserva antecipada é recusada neste fluxo, exigindo destinação própria. Conferências são imutáveis; novos informes e novas reservas de horas sobre encontro conferido são bloqueados, assim como alterações financeiras relevantes da agenda. A passagem PREVISTO para MINISTRADO permanece permitida para conclusão acadêmica. A interface docente identifica a conferência e orienta revisão dos efeitos antes de alterar.

Quinze integrações aprovadas nos arquivos de condições e ocorrências, incluindo novo cenário de gravação concorrente, repetição, hash divergente, cálculo SQL divergente, revogação, preservação e bloqueio da agenda/informe. O ensaio de concorrência precisou do adaptador de sessão já usado em outras suítes para evitar importação concorrente do NextAuth no Vitest; a ação e o banco continuam revalidando usuário/papéis. TypeScript, lint e build com 52 páginas aprovados; schema diff vazio; migration 20260914104000_conferencia_ocorrencia_horas aplicada somente ao banco descartável, total de 153 migrations.

Ainda criar interface financeira e consulta específica da conferência registrada; a prévia continua sendo cálculo, não histórico de conferência. Implementar revisão aprovada dos efeitos antes de permitir alteração de registro conferido, além de emissão parcial/fechamento e integração com antecipações/encerramento. O bloqueio preserva os dados enquanto essa revisão não está disponível; não equivale ao fluxo de correção concluído. Última suíte unitária integral 317; última regressão integral de integração 298. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 323 — Prévia financeira com ocorrência e condições persistidas, 13/09/2026

preverConferenciaOcorrenciaHoras exige Financeiro/Administração vigente, aluno/matrícula correspondentes e versões explícitas do informe e das condições. O leitor interno mantém as travas de agenda/matrícula do chamador e confere contrato confirmado, documento disponível, moeda, regime preparado, horários e último informe. Condições ainda não vigentes, versão mais nova aplicável, transcrição pendente aplicável ou mudança dentro do encontro exigem conferência. Versão futura posterior ao encontro não reprecifica a aula antiga.

A classificação usa a antecedência transcrita do contrato e a origem aprovada do cancelamento, sem preço/prazo fornecidos pelo cliente. Calcula minutos contratados e valor decimal por hora de 60 minutos. Devolve referências, condições, classificação e memória, sem registrar conferência ou emitir cobrança. Reservas antecipadas são identificadas como pendência de destinação; não constituem automaticamente nova dívida.

Oito integrações aprovadas nas condições por hora (três cenários novos): preço aplicável em 75 minutos, condição futura, documento arquivado, isolamento por aluno, professor sem acesso financeiro, informe superado, cancelamento tardio com limite contratual e vigência conflitante. TypeScript, lint e build com 52 páginas aprovados; diff sem erros. Sem migration; último schema diff vazio no 321. Última suíte unitária integral 317; última regressão integral de integração 298.

Ainda persistir a conferência financeira com suas origens e proteger alterações posteriores; criar interface, fechamento parcial aprovado e emissão sem duplicidade. Histórico com aditivos/documentos anteriores necessita sua cadeia contratual, não está comprovado pelo leitor do contrato atualmente confirmado. A prévia não conclui Q93/Q101 nem remove a pendência de encerramento. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 322 — Interface e consulta das condições por hora, 13/09/2026

A rota /matriculas/[id]/condicoes-horas apresenta preparação, cláusulas, vigência, histórico de versões e decisão independente. A página de condições de entrada das ofertas por hora oferece o acesso. Secretaria/Administração prepara após contrato confirmado e sem versão pendente; Administração distinta do preparador decide. Financeiro consulta em leitura. Professor não consulta condições financeiras.

A consulta revalida usuário e projeta as condições da matrícula em leitura consistente. O formulário não preenche antecedência ou preço automaticamente; mantém unidade 60 e moeda da matrícula. Vigência é informada como data/hora no fuso institucional identificado e convertida sem escolha silenciosa em horário ambíguo/inexistente. O servidor permanece responsável pela validação final, incluindo documento vigente/disponível e regime compatível.

Cinco integrações aprovadas, incluindo consulta das versões, permissão independente, leitura financeira, recusa ao professor e usuário revogado. TypeScript, lint e build com 52 páginas aprovados; diff sem erros. Sem migration; último schema diff vazio 321, última suíte unitária integral 317 e última regressão integral de integração 298.

Sem homologação interativa. Ainda falta conectar a versão aplicável à ocorrência e à conferência financeira, resolver vigências conflitantes e emitir/aprovar parciais com proteção transacional. A interface transcreve contrato confirmado; não altera documento nem emite cobrança. Matrículas legadas ainda precisam de entrada de navegação e conferência na migração. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 321 — Condições contratuais estruturadas de cobrança por hora, 13/09/2026

CondicoesHorasMatricula preserva matrícula, documento confirmado, versão, regras, preparador e decisão. As regras identificam preço/hora, moeda, unidade fixa de 60 minutos, início de vigência com fuso explícito, antecedência de cancelamento e referências das cláusulas de preço/cancelamento. Não há prazo numérico padrão. A transcrição não altera o contrato original nem autoriza mudança comercial sem formalização.

Secretaria/Administração prepara; outra pessoa da Administração aprova ou rejeita. Só uma versão pendente é permitida por matrícula, com sequência serializada. O banco revalida autor, decisão independente, fonte confirmada/vinculada, moeda e dados obrigatórios; não aceita criação diretamente aprovada ou alteração/apagamento de versões decididas. Fonte arquivada impede aprovação, mas permite rejeitar a proposta pendente. Oferta preparada em regime mensal não aceita condições de hora. Matrículas legadas ainda exigem transcrição e conferência explícitas do documento.

Quatro integrações aprovadas: preparação/decisão, autoaprovação recusada por serviço e SQL, preservação, parâmetros incompletos, moeda incompatível, contrato não confirmado, concorrência, fonte arquivada e usuário revogado. Lint e build com TypeScript/52 páginas aprovados; schema diff vazio; migration 20260914103000_condicoes_horas aplicada apenas no banco descartável, total de 152 migrations. Última suíte unitária integral: 317; última regressão integral de integração: 298.

Ainda falta interface e seleção explícita/revalidação da versão aplicável na conferência da ocorrência, incluindo vigência e conflitos entre transcrições. Não usar simplesmente a última configuração para faturar aulas antigas. Este incremento não emite cobrança, não registra recebimento e não modifica PDF/assinaturas; geração dessas condições em novos documentos e aditivos permanece pendente. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 320 — Origem aprovada do cancelamento particular, 13/09/2026

A integração dos informes expôs incompatibilidade: a liberação de horas tratava qualquer cancelamento aprovado como cancelamento da escola. PropostaCancelamentoParticular passa a registrar origem ESCOLA/ALUNO, preservada com a proposta imutável e apresentada ao aprovador. A interface exige escolha explícita. Chamadores anteriores sem origem mantêm ESCOLA, que era o alcance declarado da tela/fluxo anterior, sem alterar sua chave/hash de repetição. Migração de base real requer conferir se o histórico foi usado fora desse alcance.

O informe docente só aceita a mesma origem do cancelamento aprovado, validada na ação e no banco. A consulta fornece a origem e o formulário oferece apenas a opção correspondente. O fluxo de liberação/remarcação ou crédito próprio de Q95 exige origem ESCOLA; proposta financeira com cancelamento do aluno é recusada no serviço e no banco. Cancelamento do aluno não consome nem devolve horas automaticamente: sua conferência contratual de antecedência continua pendente.

Validação: 36 integrações aprovadas em compra de horas, ocorrências e cancelamento, incluindo novo caso de recusa de liberação/crédito para origem ALUNO e divergência do informe por serviço/SQL. Build final com TypeScript e 52 páginas aprovado; lint e diff sem erros; schema diff vazio. Migration 20260914102000_origem_cancelamento_particular aplicada somente ao banco descartável; 151 migrations. Última suíte unitária integral: 317; última regressão integral de integração: 298.

Ainda implementar condições de antecedência versionadas/aceitas, conferência financeira, emissão parcial e integração ao encerramento. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 319 — Interface docente e histórico dos informes, 13/09/2026

A página do encontro particular apresenta formulário de ocorrência e histórico por versão, com autor, instante do registro, comunicação e evidência. Realização/falta são oferecidas depois do término; cancelamentos são oferecidos quando há decisão pedagógica aprovada. A navegação de encontros próprios inclui particulares futuras, ministradas e canceladas, mantendo as condições de registro no servidor. A chamada permanece uma operação distinta.

consultarOcorrenciasParticular revalida professor ativo e atribuição em leitura consistente. Projeta apenas dados necessários do encontro e informes, sem valores ou dados pessoais/financeiros do aluno. Turmas não recebem este formulário. A comunicação usa data/hora no fuso identificado do encontro; o conversor recusa horários inexistentes ou ambíguos. Repetição de envio conserva a chave enquanto a entrada não mudar, e nova versão preserva os informes anteriores.

Validação: seis integrações de ocorrência aprovadas, ampliadas para histórico ordenado, formato temporal, acesso indevido/revogado, permissões de registro e projeção dos campos. Lint aprovado nos cinco arquivos alterados; build com TypeScript e 52 páginas aprovado; diff sem erros. Sem migration; último schema diff vazio no incremento 318. Última suíte unitária integral: 317; última regressão integral de integração: 298.

Sem homologação interativa desta interface. Conferência financeira vinculada à versão e às condições contratuais, emissão parcial, apuração persistida e integração ao encerramento permanecem pendentes. Informes ainda não confirmam cobrança nem alteram diário/presença. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 318 — Informe docente persistido por encontro particular, 13/09/2026

OcorrenciaParticular registra matrícula, encontro, professor autor, versão, tipo, horários, comunicação de cancelamento, evidência e chave de repetição. O registro é imutável; nova informação gera versão sequencial preservando a anterior. registrarOcorrenciaParticular exige professor ativo atribuído ao encontro, revalida a atribuição dentro da transação e devolve apenas identificação/versão, sem preços ou dados financeiros.

Realização/falta só podem ser informadas após o término em encontro previsto/ministrado. Cancelamento exige encontro cancelado com decisão pedagógica aprovada, sem transformar o informe em decisão financeira. Não cria diário, presença, cobrança, recebimento ou consumo de horas. O banco verifica vínculos, autoria, horários e sequência; a operação registra evento na mesma transação. Agenda e matrícula são bloqueadas na ordem compartilhada pelos fluxos existentes.

A primeira validação encontrou incompatibilidade entre timestamp sem fuso e o fuso da sessão PostgreSQL. Migration adicional fixa criadoEm pelo relógio do banco convertido explicitamente a UTC; o cliente não escolhe o instante do registro. Comunicação futura é recusada. As migrations aplicadas anteriormente não foram reescritas.

Validação final: 13 integrações aprovadas em informe docente (6 novas) e cancelamento particular (7 existentes), incluindo concorrência/repetição, versões, imutabilidade, acesso revogado, atribuição, origem divergente, rollback, cancelamento aprovado e ausência de efeitos financeiros/acadêmicos. TypeScript, lint e build com 52 páginas aprovados; schema diff vazio. Migrations 20260914100000_ocorrencia_particular e 20260914101000_relogio_ocorrencia_particular aplicadas somente no banco descartável; 150 migrations. Última suíte unitária integral: 317 (821 testes); última regressão integral de integração: 298.

Ainda falta interface docente, conferência financeira vinculada à versão informada e às condições contratuais, aprovação parcial, emissão persistida e integração à apuração/encerramento. Informar ocorrência não satisfaz Q93/Q101 por si só. Quando a conferência financeira for adicionada, alteração posterior do informe deverá exigir revisão dos efeitos, sem substituir silenciosamente a versão faturada. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 317 — Apuração detalhada do fechamento por hora, 13/09/2026

apurarFechamentoHoras reúne ocorrências conferidas por matrícula, período e moeda. Usa os minutos contratados divididos por 60, preço da versão aplicável a cada encontro e dinheiro decimal: arredondar uma vez por item e somar os itens. Preserva evidência, horários, comunicação, antecedência contratada e classificação financeira. Falta/cancelamento tardio cobra integral; cancelamento no prazo ou pela escola não compõe valor. Não altera presença nem conclusão do diário.

O período possui referência e limites explícitos, separados do vencimento. A inclusão técnica usa início do encontro no intervalo inclusivo/exclusivo informado; a montagem dos limites pela condição contratual ainda deve ser integrada ao serviço. Não presume mês/fuso ou calendário financeiro. Duplicação de encontro, mistura de matrícula/moeda, ocorrência de outra versão/horário, duração não inteira em minutos e total acima da precisão monetária são recusados.

Destinação faturada ou antecipação conferida fica preservada, fora dos novos itens. Reserva antecipada pendente exige conferência, sem ser tratada como quitação ou nova obrigação. Ocorrência ausente permanece pendente. O Financeiro pode apurar com a escolha de aguardar ou propor parcial: parcial identifica aprovação independente obrigatória, mas não emite. Uma complementar inclui apenas itens sem destinação anterior; a proteção transacional contra concorrência depende da persistência ainda por implementar.

Validação: 14 novos unitários; 18 aprovados junto ao classificador existente. Suíte unitária integral: 821 testes em 88 arquivos, zero falhas. TypeScript e lint dos dois arquivos aprovados. Sem schema, migration ou interface alterados; último build e integração direcionada no incremento 316, última regressão integral de integração no 298.

Limite: núcleo interno de cálculo, ainda sem ação pública, leitor de origens persistidas, registro/conferência de ocorrências posteriores, proposta/aprovação parcial ou emissão transacional. Não remover a pendência provisória do encerramento de Q93/Q101 antes dessa integração. Não há nova cobrança, recebimento ou produção. O objetivo integral permanece incompleto.

## Incremento 316 — Ação autenticada e interface de efetivação, 13/09/2026

A ação efetivarAcertoEncerramento recebe somente aluno e decisão, obtém executor da sessão e usa o relógio do servidor. Exige Financeiro/Administração vigente e delega ao executor transacional, preservando revalidação, isolamento por matrícula e repetição sem duplicidade. Revalida as páginas do aluno e do Financeiro após a operação.

A conferência mostra a ação de efetivação para uma decisão aprovada ainda não aplicada. Após a conclusão, apresenta executor, data e resumo dos valores aprovados, mantendo o histórico acessível em pedidos concluídos e retirando as ações de decisão/efetivação. O crédito exibido não comprova devolução de dinheiro. A consulta de um encerramento concluído não depende de recarregar o contexto de uma matrícula ativa.

A origem acadêmica inclui o regime de cobrança da preparação comercial. Para HORA_PARTICULAR, encontro não cancelado/não rascunho até o limite contratual e sem reserva de horas gera pendência de destinação financeira. É uma proteção provisória: o fechamento posterior por hora ainda não tem destinação persistida integrada. Regime legado ausente, cancelamentos cobráveis e conferência completa das ocorrências permanecem pendentes; esta proteção não comprova a apuração integral.

Validação desta versão: 32 testes de integração em encerramento-solicitacao e compra-horas aprovados, incluindo chamadas públicas concorrentes, rejeição de executor fornecido pelo cliente, data efetiva futura, consulta concluída e a pendência por hora. Lint aprovado nos nove arquivos alterados; build aprovado com TypeScript e 52 páginas. Sem migration; 148 migrations até o incremento 315. Última suíte unitária integral: 311; última regressão integral de integração: 298. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 315 — Executor transacional e conclusão única do acerto, 13/09/2026

EfetivacaoAcertoEncerramento preserva pedido, decisão, executor, data e identificadores dos efeitos em registro único por pedido/decisão. A inserção confere aprovação, executor vigente, matrículas encerradas com registros temporais, ajustes, créditos, horas, multa e dias de compensação previstos; conclui o pedido na mesma transação. Registro de efetivação é imutável.

efetivarAcertoEncerramentoTx serializa agenda/pedido, confere o aluno e a permissão atual, aplica financeiro e estado/vínculos e registra a conclusão. A repetição da mesma decisão retorna o resultado preservado; outra decisão ou outro aluno é recusado. Repetição não dispensa a permissão atual do executor. As constraints são conferidas antes de retornar. O transporte público autenticado e a interface ainda não foram adicionados; o relógio não poderá vir do cliente.

32 integrações de encerramento e compra de horas aprovadas, agora com executor completo nos cenários de horas/crédito e compensação/proporcional, concorrência/repetição sem duplicidade, pedido CONCLUIDA, matrícula ENCERRADA, histórico imutável, revogação de acesso e rollback posterior à conclusão. TypeScript, lint, build com 52 páginas e schema diff vazio aprovados. Migrations 20260914093000_efetivacao_acerto_encerramento e 20260914094000_conferencia_dias_efetivacao aplicadas apenas no banco descartável; 148 migrations. Última suíte unitária integral 311; última regressão integral de integração 298.

Ainda verificar a exposição pública, consumidores acadêmicos/acesso e composição com apurações por hora e reservas. Este executor não comprova a implementação integral dos demais fluxos. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 314 — Conferência da agenda no limite contratual, 13/09/2026

A prévia apura o limite exclusivo no fuso institucional conforme inclusão/exclusão do dia. Encontros particulares PREVISTOS ou MINISTRADOS cujo fim ultrapasse esse limite são identificados em agendaEncerramento. A aprovação e a guarda de efetivação exigem regularização. Encontro que termina exatamente no limite não ultrapassa a cobertura; encontro que atravessa o limite exige conferência.

O acerto não substitui aprovação pedagógica de cancelamento. Usar o fluxo existente para os encontros canceláveis; diário/consumo e aula já ministrada exigem conferência da data efetiva ou correção aplicável, preservando evidências. Cancelados e rascunhos não ocupam esta pendência; rascunho não é aula publicada. A interface apresenta as pendências da versão revisada. Regularização muda a origem e requer nova versão do acerto.

32 integrações de encerramento/compra de horas aprovadas, incluindo os dois critérios de dia, término exato, cruzamento do limite, aula ministrada, cancelada e rascunho. TypeScript, lint, build com 52 páginas e diff sem erros aprovados. Sem migration; última suíte unitária integral 311 e última regressão integral de integração 298.

Ainda concluir a operação pública repetível e verificar sua composição com reservas, apurações por hora e demais consumidores. Este incremento não comprova todo o encerramento nem gera cancelamento/ajuste automático. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 313 — Estado e vínculos das matrículas encerradas, 13/09/2026

aplicarEstadoEncerramentoTx registra os limites contratuais, muda somente as matrículas selecionadas para ENCERRADA e incrementa acessoVersao. Fecha os vínculos ativos capturados na conferência, preservando criadoEm, turma e matrícula. Vínculo cadastrado após o limite fica com intervalo vazio, sem fabricar uma data anterior à criação. Vínculos históricos e outros contratos permanecem preservados; vínculo ativo com data de encerramento contraditória exige conciliação.

A etapa registra uma MovimentacaoAluno de ENCERRAMENTO vinculada à matrícula e evento MatriculaEncerrada com decisão, registro temporal e vínculos fechados. Não altera o status global do aluno. O executor é o mesmo usuário validado pela guarda, agora incluído no resultado interno da revalidação.

Oito integrações de encerramento aprovadas, cobrindo inclusão/exclusão do último dia, fechamento do vínculo, preservação do histórico de outro contrato, incremento de acesso apenas na matrícula selecionada, movimentação e rollback conjunto de cadastro/vínculo/registro/financeiro. TypeScript, lint e diff sem erros aprovados. Sem migration ou UI neste incremento; último build 312, última suíte unitária integral 311, última regressão integral de integração 298.

Ainda integrar a conferência/destinação da agenda futura e a conclusão repetível do pedido antes de oferecer uma ação pública completa. Não há homologação interativa ou comprovação de todos os consumidores de acesso. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 312 — Fuso institucional na versão aprovada do acerto, 13/09/2026

A prévia carrega e registra o fuso institucional com carregarFusoInstitucionalTx, mantendo a linha de configuração protegida por FOR SHARE durante a transação. Fuso ausente/inválido impede a conferência. A guarda de efetivação usa o mesmo leitor, e a comparação integral do snapshot detecta mudança de fuso após aprovação. Versões antigas sem a referência temporal precisam de nova conferência.

A interface apresenta o fuso da versão revisada, sem confundi-lo com a preferência de visualização ou com o fuso originalmente registrado no pedido. A data civil do pedido permanece preservada. O cálculo do limite temporal usa a referência revalidada e estável na transação.

30 integrações aprovadas em encerramento e compra de horas; novos casos verificam fuso capturado, mudança após aprovação recusada e ausência de configuração bloqueada. TypeScript, lint, build com 52 páginas e diff sem erros aprovados. Sem migration. Última suíte unitária integral: 311; última regressão integral de integração: 298. Efeitos acadêmicos e ação completa de encerramento ainda pendentes. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 311 — Registro temporal do encerramento e histórico contratual, 13/09/2026

RegistroEncerramentoMatricula preserva matrícula, decisão, situação anterior, data efetiva, fuso, inclusão/exclusão do dia, limite exclusivo do vínculo e data da aplicação. O banco confere as condições aprovadas e a conversão temporal e impede alteração/apagamento. registrarLimitesEncerramentoTx prepara esses registros na transação recebida, sem alterar sozinho o estado da matrícula ou os vínculos.

O leitor do histórico contratual passa a carregar esse registro. situacaoMatriculaNaAula reconhece ENCERRADA a partir do limite e reconstrói ATIVA/PAUSADA para aulas anteriores, quando há ativação e movimentos consistentes. Encerramento sem evidência temporal continua A_CONFERIR; o registro não inventa ativação nem libera uma matrícula encerrada para novas aulas.

807 unitários em 87 arquivos aprovados, incluindo 5 de histórico temporal. Integração: 8 testes de encerramento na execução final e 16 de diário na execução anterior. As duas regras de último dia foram testadas no banco em America/Sao_Paulo; o registro pertence apenas à matrícula escolhida, preserva os demais contratos e é desfeito com a transação. TypeScript, lint, build com 52 páginas e schema diff vazio aprovados. Migration 20260914090000_registro_temporal_encerramento aplicada apenas no banco descartável; 146 migrations.

Ainda integrar à efetivação final: fixar o fuso revisado na prévia, aplicar situação/vínculos/acesso, conferir agenda futura e concluir o pedido com controle de repetição. O núcleo de histórico não comprova todos os consumidores acadêmicos e filtros de listagem. Última regressão integral de integração: 298. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 310 — Núcleo financeiro integrado do encerramento, 13/09/2026

aplicarFinanceiroEncerramentoTx reúne revalidação da decisão/origens, ajustes de cobranças, liquidação de horas, créditos, multas e destinação de compensações na transação recebida. A ordem respeita as dependências entre ajustes e crédito e entre liquidação de horas e crédito. SET CONSTRAINTS ALL IMMEDIATE confere ainda dentro da função as restrições diferidas, antes de retornar os identificadores dos componentes aplicados.

Não há ação pública para aplicar somente este núcleo. O chamador da efetivação completa deverá aplicar os efeitos acadêmicos, registrar o encerramento e concluir o pedido na mesma transação, incluindo controle de repetição. Não tratar o retorno financeiro como matrícula encerrada. Esta integração não executa devoluções, consome créditos disponíveis nem cria recebimentos.

29 integrações aprovadas nos arquivos de compra de horas e encerramento; após ajuste adicional do cenário de crédito de cobrança, as 7 integrações de encerramento foram repetidas e aprovadas. Os cenários de horas/crédito, multa, dispensa, compensação/proporcional e crédito de cobrança agora exercitam o núcleo integrado, com rollback simulado após a aplicação e preservação dos recebimentos. TypeScript, lint sem avisos e diff sem erros aprovados. Sem schema ou UI alterados; último build 309, última suíte unitária integral 307 e última regressão integral de integração 298.

Permanecem pendentes os efeitos acadêmicos e temporais do encerramento e a ação completa com controle de repetição. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 309 — Origens acadêmicas na conferência do acerto, 13/09/2026

A prévia agora registra situação/ativação/versão de acesso da matrícula, vínculos de turma com datas e situação, encontros particulares com horário, professor, fuso e reservas de horas. Apenas a matrícula correspondente é consultada; o cadastro de outro aluno não pode ser usado para obter esses dados. A aprovação adquire a trava da agenda antes das demais travas, compatível com a execução e operações de particulares.

A comparação da versão aprovada passa a detectar alteração dos vínculos e encontros, além das origens financeiras. Versões antigas sem essas informações exigem nova conferência. A interface mostra os vínculos e a agenda revisados e informa que não houve cancelamento de aulas ou encerramento de vínculo. Essa conferência não equivale a autorizar alterações pedagógicas isoladas.

29 integrações de encerramento e compra de horas aprovadas, com casos novos: encontro em contrato excluído preserva a validade da aprovação; novo encontro ou alocação no contrato selecionado invalida a efetivação; consulta de outro aluno é recusada. TypeScript, lint, build com 52 páginas e diff sem erros aprovados. Sem migration. Última suíte unitária integral: 307; última regressão integral de integração: 298.

Ainda faltam o registro temporal do encerramento, a aplicação dos efeitos nos vínculos/acessos/agenda e a ação completa e repetível que reúna os componentes. O índice global legado de alocação e os consumidores que dele dependem também seguem pendentes de migração coordenada; este incremento não removeu essa proteção. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 308 — Destinação dos dias de compensação no acerto, 13/09/2026

DestinacaoDiaAcerto registra a decisão e o tratamento de cada dia: COMPENSACAO para o ajuste pelos dias ainda devidos, PROPORCIONAL para os já descontados pelo encerramento. O vínculo é único e imutável. A inserção exige dia pendente, compensação aprovada, correspondência ao plano da decisão e ajuste da cobrança aplicado; atualiza o estado para LIQUIDADO_FINANCEIRAMENTE com referência ao registro, data e incremento de versão.

aplicarCompensacoesAcertoTx é etapa interna da transação de efetivação. Não emite crédito adicional: o efeito monetário já pertence ao ajuste de cobrança. Dias anteriormente recompostos ou liquidados não são selecionados. O fluxo completo de encerramento e o tratamento dos vínculos/agenda ainda precisam ser integrados antes da disponibilização pública.

Sete integrações aprovadas, incluindo distinção entre dia anterior e posterior ao último dia coberto, recusa de tratamento divergente, exigência de ajuste, recusa de repetição/apagamento e rollback de dias e cobrança após falha. No cenário de mensalidade de 400 e encerramento no dia 15 de um período de 30 dias, um dia de compensação reduz os 200 para 186,67; o dia 20 já descontado pelo proporcional não gera novo abatimento. Quatro unitários de compensação aprovados. TypeScript, lint e schema diff vazio aprovados. Migration 20260914083000_destinacao_compensacao_acerto aplicada somente no banco descartável, 145 migrations. Último build e suíte unitária integral: 307; última regressão integral de integração: 298. Sem alteração de interface neste incremento, homologação interativa, produção ou envios externos. Objetivo geral ainda incompleto.

## Incremento 307 — Emissão interna da multa do acerto, 13/09/2026

MULTA_ENCERRAMENTO identifica a cobrança gerada pelo acerto, vinculada à decisão e à matrícula. Uma decisão admite uma multa por matrícula. O banco confere moeda, valor contratual original, valor proposto positivo e vencimento contra o plano aprovado; a emissão não registra dinheiro ou crédito recebido. Origem e vínculo são preservados, e a cobrança não pode ser apagada. Dispensa integral não gera cobrança.

aplicarMultasAcertoTx recebe a transação revalidada do acerto. Não fornece ação pública de emissão isolada; integrar todos os efeitos do encerramento continua obrigatório. Valor/vencimento posteriores seguem os fluxos financeiros aplicáveis. O novo tipo tem rótulo financeiro, mas não é ofertado nem aceito como preço de catálogo: sua origem é o contrato e o acerto aprovado.

Validação: 806 testes unitários em 87 arquivos; 10 integrações de encerramento e catálogo; TypeScript, lint sem avisos, build com 52 páginas e schema diff vazio aprovados. Casos adicionais cobrem multa de 80 com vencimento aprovado, dispensa sem cobrança, falha posterior desfazendo emissão, recusa de repetição, valor divergente, falta de origem e alteração/remoção da origem. Migration 20260914080000_multa_acerto aplicada somente no banco descartável; 144 migrations. Última regressão integral de integrações: 298. Sem homologação interativa, produção ou envios externos. Objetivo geral ainda incompleto.

## Incremento 306 — Liquidação de horas no acerto, 13/09/2026

LiquidacaoHorasAcerto registra uma única destinação final por compra, com decisão aprovada, minutos e valor preservados. A conferência SQL compara o plano aprovado com consumos, créditos anteriores e reservas reais; reservas pendentes impedem a liquidação. Valor zero é permitido para registrar minutos cujo direito monetário já tenha sido absorvido pelo arredondamento acumulado.

Crédito positivo de compra exige liquidação correspondente na mesma transação, e liquidação positiva exige crédito. A consulta de compras desconta os minutos liquidados; a apuração posterior de encerramento considera essa destinação anterior. Novas reservas são recusadas no serviço e no banco, inclusive quando a matrícula ainda consta ativa. Não se criam recebimentos e não se alteram compras originais.

aplicarLiquidacaoHorasAcertoTx é etapa interna, sem ação pública isolada. A execução final ainda precisa integrar os demais efeitos e verificar SET CONSTRAINTS ALL IMMEDIATE antes de retornar sucesso: no ensaio, uma falha de constraint diferida no commit foi registrada pelo Prisma sem rejeitar a Promise; a conferência explícita dentro da transação detectou o erro corretamente. O banco reverte a operação inválida. Esse comportamento exige atenção na futura ação de efetivação.

Validação: 22 integrações de compra de horas aprovadas na execução final; outras 7 de encerramento aprovadas na execução anterior deste incremento. Sete unitários de apuração de horas aprovados. Casos novos: dependência bidirecional entre crédito e liquidação, rollback após falha, preservação do recebimento, histórico imutável, recusa de repetição, saldo zerado e bloqueio de reserva por serviço/SQL. O caso monetário zero ainda não teve novo cenário integrado específico neste incremento. TypeScript, lint, build com 52 páginas e diff sem erros aprovados; migration 20260914073000_liquidacao_horas_acerto aplicada apenas no banco descartável, 143 migrations e schema diff vazio.

Última regressão integral: 298. Efetivação completa, homologação interativa e objetivo geral continuam pendentes. Sem produção ou envios externos.

## Incremento 305 — Créditos na transação dos ajustes, 13/09/2026

aplicarCreditosAcertoTx grava a origem aprovada e o crédito da matrícula usando a transação recebida. Crédito de cobrança exige que o ajuste da mesma decisão já tenha sido aplicado e que seu valor corresponda ao crédito apurado. Não cria recebimento nem modifica dinheiro recebido. Não oferece ação pública isolada.

Sete testes de integração aprovados no banco descartável, incluindo recusa de crédito antes do ajuste e falha simulada após a emissão: ajuste, origem e crédito são revertidos juntos, preservando a cobrança e o recebimento originais. TypeScript e lint direcionado aprovados. Sem alteração de schema ou UI. Última regressão integral: 298; último build: 302.

A execução completa do encerramento permanece pendente: integrar liquidação de horas e compensações, multa, encerramento dos vínculos selecionados e controle de repetição na mesma operação antes da exposição pública. O helper de créditos, por si só, não comprova esses efeitos. Sem homologação interativa, produção ou envios externos.

## Incremento 304 — Aplicação interna dos ajustes por cobrança, 13/09/2026

AjusteCobrancaAcerto preserva decisão, executor, cobrança, versão e valor anteriores, novo valor, crédito apurado, moeda e snapshot da origem. A cobrança admite um registro de acerto; o histórico é imutável. SQL exige decisão aprovada, executor financeiro ativo, correspondência do valor ao plano e conferência do crédito apurado. A inserção atualiza valor negociado, saldo, versão e situação na mesma transação, mantendo recebimentos, valorRecebido, crédito já liquidado e vencimento.

aplicarAjustesCobrancaAcertoTx é uma etapa interna que recebe a mesma transação da guarda de efetivação e dos demais efeitos. Não abre transação própria nem constitui ação pública de encerramento. Não emite crédito ou multa e não encerra matrícula isoladamente. Essas etapas ainda devem ser integradas antes da disponibilização pública.

Migration 20260914070000_ajuste_cobranca_acerto aplicada no banco descartável: 142 migrations, schema diff vazio. Sete integrações de encerramento-solicitacao aprovadas, incluindo ajuste de valor/saldo com origem preservada e falha posterior simulada que desfaz integralmente o histórico e a alteração. TypeScript e lint aprovados. Sem alteração de UI; último build 302. Última regressão integral 298. Sem homologação interativa, produção ou envios externos; objetivo geral não concluído.

## Incremento 303 — Revalidação transacional da efetivação, 13/09/2026

carregarAcertoAprovadoParaEfetivacaoTx fornece a guarda interna de aplicação. Confere decisão e aluno, trava agenda/pedido/matrículas/cobranças/documentos, verifica executor financeiro vigente e aprovador ativo/autorizado, versão mais recente, igualdade das origens com o snapshot aprovado, autorizações de exceção e plano sem pendências. Data efetiva precisa ter chegado no fuso institucional. Vínculo legado ativo sem matrícula exige conciliação.

A guarda recebe a transação do chamador: futura gravação dos efeitos deve ocorrer nela, antes de liberar os locks. Não é uma autorização reutilizável fora da transação e não aplica lançamentos isoladamente. Também não existe nova ação pública que alegue efetivação concluída.

Sete integrações de encerramento-solicitacao aprovadas, com casos adicionais: execução antecipada recusada, seleção contratual preservada, aprovador desativado recusado, mudança no pedido invalidando aprovação e nova versão impedindo aplicação da anterior. TypeScript e lint aprovados. Sem alteração de schema ou UI; último build 302. Última regressão integral 298. Persistência dos efeitos e encerramento efetivo ainda pendentes; sem produção ou envios externos.

## Incremento 302 — Vencimento da multa no acerto, 13/09/2026

Conferência da multa permite informar vencimento civil explícito. Se o valor proposto for positivo, a consolidação permanece pendente até registrar data válida. Dispensa integral/valor zero não exige vencimento nem implica emitir cobrança. Não se presume prazo ou vencimento a partir da data de execução.

O vencimento integra entrada, snapshot e plano de lançamentos, sendo mostrado ao revisor. Alterá-lo exige nova conferência da versão e aprovação correspondente, seguindo a revalidação existente. A futura aplicação usará a data aprovada, mantendo a multa separada dos recebimentos e dos ajustes originais.

12 unitários e 7 integrações aprovados; lint, TypeScript e build com 52 páginas aprovados. Casos novos: multa positiva sem data bloqueada, data conferida preservada, data civil inexistente recusada e dispensa sem cobrança programada. Sem migration. Última regressão integral: 298. Efetivação financeira ainda pendente; sem homologação interativa, produção ou envios externos.

## Incremento 301 — Origem persistente dos créditos de encerramento, 13/09/2026

OrigemCreditoAcerto identifica decisão aprovada, matrícula, moeda, tipo de origem (cobrança ou compra de horas), identificador e valor. SQL exige correspondência com o plano de lançamentos preservado na decisão e impede duplicar a mesma origem. Registro imutável. CreditoMatricula passa a exigir exatamente uma origem: liberação de horas canceladas ou origem de acerto. O crédito deve corresponder ao valor, matrícula e moeda da origem. Créditos antigos conservam sua cadeia de cancelamento.

A memória de utilização inclui origemAcertoId quando aplicável. O cálculo de créditos por cancelamento continua restrito às origens de cancelamento, com conferência explícita da relação. Migration 20260914063000_origem_credito_acerto aplicada somente ao banco descartável: 141 migrations, schema diff vazio.

28 integrações em encerramento-solicitacao e compra-horas aprovadas. Casos novos exercitam a persistência diretamente no banco de teste: origem com valor/matrícula divergentes recusada, crédito sem origem ou duplicado recusado, correspondência do crédito com o plano aprovado e preservação de origens anteriores. TypeScript/build e lint aprovados.

Este incremento fornece a estrutura de persistência; não oferece uma ação pública para emitir crédito de encerramento isoladamente. A aplicação final deverá revalidar decisão/versão/origens e gravar créditos, ajustes, liquidação de horas e encerramento na mesma transação. Os testes de estrutura não comprovam essa execução completa. Última regressão integral: 298; sem homologação interativa, produção ou envios externos.

## Incremento 300 — Plano de lançamentos do acerto, 13/09/2026

A prévia/snapshot passa a conter lançamentos previstos por origem: ajustes das cobranças, valor devido após acerto, saldo restante, crédito apurado, valor recebido preservado, crédito anteriormente liquidado e vencimento preservado. Multa mantém condição original e valor proposto. Compras de horas são preservadas como origem; horas restantes e compensações mantêm as referências necessárias para posterior liquidação.

O plano confere a soma dos saldos e créditos contra a consolidação, rejeita cobrança repetida/origem incompatível e fica indisponível com componentes pendentes. Crédito por cobrança e crédito por compra de horas têm tipos de origem diferentes. A tela apresenta detalhamento dos lançamentos do rascunho sem expor o snapshot bruto nem somar os detalhes novamente ao total.

Onze unitários e sete integrações aprovados; lint e build aprovados. Testes adicionais conferem quitação mista preservada, vencimento original, crédito por origem, ausência de mutação, bloqueio com reserva pendente e divergência entre lançamentos e total. A inclusão no snapshot exige nova conferência de rascunhos anteriores antes de nova aprovação. Não houve migration. Última regressão integral: 298. Persistência/aplicação dos lançamentos e encerramento efetivo continuam pendentes; nenhum movimento financeiro foi executado neste incremento. Sem homologação interativa, produção ou envio externo.

## Incremento 299 — Decisão independente do acerto, 13/09/2026

DecisaoAcertoEncerramento registra decisão imutável por versão do rascunho, decisor, motivo e autorizações explícitas de retroatividade/exceção de multa. Outro Financeiro com financeiro.aprovar_acertos ou Administração decide; o preparador não aprova mesmo acumulando papéis. A ação serializa pelo pedido e revalida a versão mais recente, origens atuais e consolidação sem pendências antes de aprovar. Mudança de origens exige nova conferência. Rejeição pode resolver uma versão desatualizada sem aplicar valores. Repetição idêntica é idempotente.

A interface oferece decisão aos usuários elegíveis e exibe o resultado registrado. Aprovação não encerra matrícula, altera cobrança, emite crédito ou devolve dinheiro. Efetivação permanece pendente e deverá revalidar novamente versão, origens e decisão. Uma aprovação anterior não torna válida uma nova versão nem autoriza executar origens modificadas.

Migration 20260914060000_decisao_acerto_encerramento: 140 migrations no banco descartável, schema diff vazio. SQL reforça imutabilidade, independência, papel/permissão, versão e autorizações explícitas; conferência integral das origens e consolidação está no serviço. Integração cobre decisão concorrente idempotente, autoaprovação recusada, escopo de aluno, decisão imutável, cobrança/matrícula preservadas, origem modificada recusada e rejeição. As cinco integrações do arquivo encerramento-solicitacao passaram; TypeScript, lint e build aprovados. Última regressão completa permanece 298. Sem homologação interativa, produção ou envios externos. Efetivação financeira integral ainda não implementada.

## Incremento 298 — Regressão completa após créditos e encerramento, 13/09/2026

Suítes completas executadas: 804 testes unitários em 87 arquivos e 665 testes de integração em 51 arquivos, todos aprovados. A integração rodou uma única vez, serialmente, em localhost:54329/erp_genius_test, terminou com exit code 0 e levou 640,60 segundos. TypeScript, lint direcionado e comparação schema/banco aprovados (diff vazio). Último build aprovado: incremento 297, sem mudança posterior no código de produção.

A primeira execução unitária encontrou quatro falhas em duas fixtures que não continham valorLiquidadoCredito, campo obrigatório com default zero no schema. Fixtures atualizadas sem enfraquecer as expectativas. Dois casos adicionais cobrem ajuste abaixo da quitação mista recusado e ajuste válido que preserva dinheiro/crédito separados. A suíte unitária completa foi repetida após as alterações e passou.

Esta é a nova referência de regressão integral, substituindo 283. Evidência: docs/validacao-regressao-298-2026-09-13.json. Os resultados comprovam somente a cobertura automatizada existente; não declaram todas as funcionalidades implementadas. Permanecem as pendências de aprovação/efetivação do acerto, devoluções, destinação entre contratos e demais itens do plano. Sem homologação interativa, produção ou envios externos.

## Incremento 297 — Consolidação da prévia de encerramento, 13/09/2026

A prévia agrega mensalidades após compensações, multa proposta, outras cobranças independentes e saldo de horas antecipadas por matrícula/moeda. Mantém saldo devido e crédito apurado separados, sem compensação automática. A multa proposta substitui a contratual no total apresentado, sem autorizar a exceção; ambas ficam identificadas.

Cobranças que originaram compras de horas são identificadas e excluídas da soma de outras cobranças. Sua conferência deve preservar a quitação original, sem propor ajuste duplicado; o direito restante é apurado pelo componente de horas. Reservas pendentes, componentes incompletos e sobreposição de ajustes impedem apresentar um total consolidado disponível para revisão. A tela mostra os totais e pendências, que também integram o snapshot do rascunho. Rascunhos anteriores sem consolidação precisam de nova conferência.

Validação: 10 unitários e 5 integrações, lint e build com 52 páginas estáticas aprovados. Cobertura inclui multa proposta uma única vez, separação entre crédito e dívida, compra de horas excluída do subtotal independente e bloqueio de ajuste duplicado/reserva pendente. Sem nova migration. Última regressão integral permanece 283. Ainda faltam aprovação e efetivação financeira integral; prévia não emite crédito, utiliza saldo ou devolve dinheiro. Sem homologação interativa, produção ou envios externos.

## Incremento 296 — Horas antecipadas na prévia de encerramento, 13/09/2026

A prévia e o rascunho de encerramento carregam automaticamente as compras de horas da matrícula, seus consumos registrados, reservas ainda não resolvidas e créditos anteriormente emitidos. A apuração usa preço/desconto originais; a referência financeira é a cobrança de origem, que pode estar liquidada por dinheiro, crédito ou ambos. Reservas liberadas para remarcação deixam de comprometer horas; reservas convertidas em crédito são liquidações anteriores e não geram novo crédito pela mesma quantidade.

Reservas não resolvidas geram pendência e impedem o cálculo de horas. O componente aparece na tela e no snapshot quando há compras; alterações posteriores nas origens invalidam a conferência por comparação do snapshot. Sem compras, a forma anterior é preservada. O componente não é somado automaticamente ao subtotal das demais cobranças: a consolidação deve evitar apurar novamente a cobrança que originou uma compra.

26 integrações aprovadas em compra-horas e encerramento-solicitacao, incluindo leitura de liquidações reais, reserva pendente, saldo remanescente sem repetir crédito e recusa de outro aluno. Sem nova migration, produção ou envio externo. Ainda pendentes: consolidação sem sobreposição de componentes, aprovação e efetivação financeira integral, devoluções e homologação interativa. Este incremento integra uma dependência real da efetivação, mas não declara o encerramento concluído. Última regressão integral: 283.

## Incremento 295 — Crédito utilizado na apuração de encerramento, 13/09/2026

O contexto de encerramento confere as utilizações de crédito aprovadas contra o saldo liquidado da cobrança, com referências de proposta, decisão e origem. Confere moeda e matrícula; dinheiro continua conciliado somente contra Recebimentos. Quitação integral por crédito com valorRecebido nulo não gera pendência fictícia de recebimento.

Proporcional mensal, demais cobranças e compensações de cobertura passam a deduzir do valor devido a soma de dinheiro e crédito já aplicado. O excedente compõe apenas a apuração do acerto. As origens permanecem separadas: recebido/valorRecebido conserva dinheiro, creditoLiquidado/valorLiquidadoCredito identifica crédito anterior. Crédito disponível ainda não utilizado não é automaticamente abatido. Campos novos são opcionais para preservar leitura de memórias anteriores sem crédito.

A tela do acerto distingue recebido em dinheiro e liquidado por crédito. Nenhum crédito de origem é reaberto; a apuração não cria um novo saldo utilizável, não altera cobranças, não cria Recebimento nem executa devolução. A efetivação financeira do acerto e a proteção contra destinação duplicada ainda precisam ser concluídas antes de declarar o encerramento integralmente funcional.

Validação: 24 testes unitários em quatro arquivos e 28 integrações em três arquivos. Incluem proporcional com crédito parcial/integral, combinação com compensações sem duplicar dias, demais cobranças com quitação mista, e contexto carregado de utilizações reais aprovadas no banco. Evidência: docs/validacao-encerramento-credito-295-2026-09-13.json. Sem nova migration. Última regressão integral permanece 283; sem homologação interativa, produção ou envios externos.

## Incremento 294 — Compra de horas com quitação por crédito, 13/09/2026

RegistrarCompraHorasAntecipadas aceita cobrança integralmente liquidada com dinheiro, crédito aprovado ou ambos. Confere os Recebimentos detalhados contra valorRecebido e as utilizações aprovadas contra valorLiquidadoCredito; a soma precisa corresponder ao valor negociado. Moeda e matrícula das origens são conferidas. Crédito apenas proposto não compõe quitação. Versão da cobrança, contrato, autor financeiro, impedimentos e idempotência permanecem exigidos.

ValorPagoAlocado representa o valor total liquidado alocado à compra, não uma nova entrada de caixa. Snapshot imutável discrimina valorEmDinheiro, valorEmCredito, valorTotal e cada proposta/decisão/crédito utilizado. Preserva preço original e desconto. Nenhum Recebimento é criado ou alterado ao identificar a compra. Isso permite converter novamente horas canceladas em crédito pela regra já existente, conservando a cadeia de origem e sem devolver disponibilidade ao crédito anteriormente utilizado.

O painel de compras mostra a composição da quitação. Compras antigas sem essa memória não recebem uma composição inventada; a tela orienta consultar os registros de origem. A consulta fornece somente o resumo necessário, sem expor o snapshot integral.

Validação direcionada: 19 integrações de compra/horas/crédito; casos novos cobrem quitação integral por crédito com valorRecebido nulo e quitação mista, desconto, idempotência, fontes preservadas e resumo da consulta. Evidência: docs/validacao-compra-credito-294-2026-09-13.json. Sem nova migration (139 existentes); sem produção ou envios externos. Última regressão integral permanece 283.

Pendências: encerramento com crédito aplicado ainda necessita adaptação conjunta do contexto, cálculo proporcional, outras cobranças e compensações. A integração de devoluções e utilização entre contratos continua pendente. Este incremento não declara esses fluxos concluídos nem altera suas regras aprovadas. Falta homologação interativa.

## Incremento 293 — Aprovação e aplicação de crédito, 13/09/2026

DecisaoUsoCredito registra aprovação ou rejeição imutável. Outro Financeiro com financeiro.aprovar_acertos ou Administração decide; acúmulo de papéis não permite autoaprovação. A aprovação revalida versão, concordância registrada, cobrança, moeda e saldo disponível dentro da transação. Repetição da mesma decisão é idempotente. Alterações na cobrança invalidam a proposta anterior para aplicação e exigem nova conferência.

A utilização aprovada liquida a cobrança por valorLiquidadoCredito, separado de valorRecebido e de Recebimento. Não cria entrada de caixa. O saldo disponível do crédito é o valor inicial menos utilizações aprovadas. Bloqueios transacionais e validação SQL impedem utilização excedente e alteração incoerente do saldo derivado. A interface permite aprovar/rejeitar e consultar decisões; a preparação continua sem reservar saldo.

Cálculo de saldo, confirmação de quitação, recebimento posterior em dinheiro, indicadores financeiros, ajustes e retomada passam a considerar a liquidação por crédito. A conferência aritmética de pausa/retomada reconhece crédito integral mesmo com valorRecebido nulo. Pagamento misto preserva apenas o dinheiro efetivamente recebido no caixa. Alterar valor negociado para menos que o total já liquidado exige revisão.

Este recorte atende utilização na mesma matrícula e moeda. Destinação explícita entre contratos do mesmo aluno, devolução de dinheiro e concorrência com devoluções permanecem pendentes. Compras antecipadas ainda exigem conciliação integral dos recebimentos; encerramento com crédito aplicado ainda pode exigir conferência por seus validadores anteriores. Esses caminhos não estão declarados concluídos. Falta ampliar a validação integrada de todos os consumidores financeiros e homologar a interface. Q68 e o objetivo geral permanecem incompletos.

Migration 20260914053000_liquidacao_credito aplicada somente no banco descartável, totalizando 139 migrations e schema diff vazio. Evidência detalhada em docs/validacao-liquidacao-credito-293-2026-09-13.json. A última regressão integral permanece no incremento 283. Sem produção ou envios externos. As descrições dos incrementos anteriores são registros históricos; este incremento substitui a indicação de que aprovação/aplicação de crédito não estavam disponíveis.

## Incremento 292 — Proposta de utilização de crédito, 13/09/2026

PropostaUsoCredito identifica crédito, cobrança, valor, concordância do aluno, motivo, preparador, versão e snapshot de conferência. Financeiro/Administração com papel ativo prepara. Versões e valores anteriores são imutáveis; repetir a chave com os mesmos dados normalizados não duplica a proposta. Guardar a proposta não reserva crédito, não aprova uso, não altera cobrança, não aumenta valorRecebido e não cria Recebimento.

O recorte disponível prepara destinação a cobrança da mesma matrícula e moeda, pendente/atrasada, sem suspensão por pausa, cancelamento ou comprovante em conferência. Confere recebimentos tipados e saldo armazenado contra o valor devido. Valor proposto precisa ser positivo, com até duas casas e dentro do crédito e saldo devedor. SQL reforça autor ativo/financeiro, matrícula, moeda, estado e limites de valor. A conferência completa dos recebimentos/informes permanece no serviço. Propostas não comprometem o saldo; seu somatório não representa utilização aprovada.

Tela /alunos/[id]/creditos/[creditoId] acessível pelo crédito no painel de compras. Mostra crédito apurado, cobranças candidatas e versões não aplicadas. A interface explicita que aprovação/aplicação ainda não estão disponíveis. Consulta restringe aluno e papel financeiro; professor não acessa os dados.

Este incremento NÃO conclui Q68: faltam aprovação independente, movimento de utilização, disputa de saldo com devolução, revalidação do destino e contabilização efetiva. Destinação explícita entre contratos do mesmo aluno também permanece pendente; limitar esta preparação à mesma matrícula não define proibição definitiva nem autoriza redistribuição automática. Outros alunos não podem receber esse crédito.

### Dependência encontrada para aplicação correta

O código atual ainda usa valorNegociado menos valorRecebido em financeiro/regras.ts (saldoAtual/pagamentoConfirmado), financeiro/recebimentos.ts (saldo/excedente da nova baixa), financeiro/consultas.ts (indicadores), ajustes/acoes.ts e ajustes/consultas.ts, retomada/regras.ts e matricula/recebimento-preservavel.ts. Há também cálculos numéricos compartilhados em _shared/regras.ts. Aplicar crédito como se fosse Recebimento criaria dinheiro fictício; alterar apenas Cobranca.saldo deixaria esses consumidores contraditórios.

Antes de habilitar aprovação/aplicação, implementar movimento de liquidação por crédito separado de caixa, adaptar leituras/recalculos e critérios de quitação, preservar valor negociado/recebido original, conferir efeitos em ativação, retomada, ajustes, emissão/encerramento e cobrança automática. Esta lista é uma dependência técnica apurada, não uma alegação de implementação concluída. A proposta guarda a base para revalidação, sem liberar uma aplicação incompleta.

Migration 20260914050000_proposta_uso_credito aplicada somente no banco descartável: 138 migrations, schema diff vazio. 14 integrações de compras/horas/crédito aprovadas; novos casos verificam proposta idempotente/versionada sem efeitos financeiros, valores e estados inválidos, vínculo/moeda, imutabilidade e escopo de acesso. TypeScript/lint direcionado aprovados. Evidência: docs/validacao-proposta-uso-credito-292-2026-09-13.json. Última regressão integral permanece 283. Sem homologação interativa, produção ou envios externos.

## Incremento 291 — Crédito por horas canceladas pela escola, 13/09/2026

O destino da reserva cancelada passa a ser REMARCACAO ou CREDITO, com escolha documentada do aluno, proposta do Financeiro e aprovação de outra pessoa do Financeiro com financeiro.aprovar_acertos ou Administração. A decisão aprovada é única por reserva, tornando os destinos mutuamente exclusivos. Propostas antigas preservam destino REMARCACAO e a idempotência dos pedidos sem destino explícito. O campo interno evidenciaEscolhaRemarcacao é conservado por compatibilidade, mas representa a evidência da escolha em ambos os destinos.

Para crédito, calcular pela proporção dos minutos sobre o valor efetivamente pago na compra original, já com o desconto original, sem reprecificar pela tabela atual. A memória guarda compra, moeda, minutos, valor pago, descontos, conversões anteriores e valor proposto. Arredondar o valor acumulado proporcional em duas casas, HALF_UP, e subtrair créditos anteriores, evitando criação/perda de centavos por fragmentação. Valor zero após arredondamento é preservado com seus minutos; não representa dinheiro disponível adicional. Mudança nas conversões anteriores exige rejeitar/repreparar a proposta antes de aprovar.

A aprovação cria CreditoMatricula na mesma transação da decisão. SQL confere origem, matrícula, moeda, decisão aprovada de crédito, valor original/arredondamento acumulado e exige o registro monetário antes do commit. Crédito é imutável; recebimento/cobrança originais não são alterados. Minutos convertidos saem da disponibilidade, mas não aparecem como aula realizada/consumo. Consulta, reserva, SQL de saldo e remarcação distinguem a conversão de uma liberação para novo encontro. Consumo e nova liberação das mesmas horas permanecem bloqueados.

O painel financeiro oferece as duas escolhas e apresenta memória de cálculo e crédito apurado. Não aplica o crédito automaticamente a cobranças e não afirma que houve devolução. Uso do crédito e devolução com concordância, aprovação e execução continuam pendentes (Q68/Q69). A origem implementada exige compra paga e reserva identificadas; outros tipos de crédito precisam de origem própria, sem reutilizar este registro indevidamente. Q95 avança na alternativa monetária, mas os fluxos de destinação/devolução e notificações externas ainda não estão completos.

Migration 20260914043000_credito_horas_canceladas aplicada apenas no banco descartável: 137 migrations, schema diff vazio. 35 integrações de compras, cancelamento/remarcação e diário aprovadas. Validado bloqueio de dupla destinação, cálculo original, saldo indisponível para nova reserva inclusive por SQL, decisão monetária atômica, crédito imutável, revisão de proposta desatualizada e soma exata de créditos parciais. Corrigida durante os testes a comparação da memória JSON para independência da ordem das propriedades após persistência em JSONB. TypeScript/lint direcionado/build aprovados; evidência em docs/validacao-credito-horas-291-2026-09-13.json. Última regressão integral: 283. Sem homologação interativa, produção ou envios externos.

## Incremento 290 — Remarcação vinculada à particular cancelada, 13/09/2026

Secretaria/Gerência Pedagógica/Administração preparam novo horário e professor para particular cancelada pela escola, com escolha do aluno documentada. Outra pessoa da Gerência Pedagógica/Administração aprova e publica o novo encontro na mesma transação. O original permanece cancelado e vinculado ao sucessor pela decisão. Proposta/decisão imutáveis, idempotência por operação e unicidade da remarcação aprovada impedem publicar duas aulas para a mesma origem.

Preservar a matrícula e a duração do encontro original. Data/hora são resolvidas no fuso informado, sem escolher silenciosamente horário ambíguo/inexistente. Conferir todo o intervalo no calendário/fuso institucional, encontros do professor ou matrícula, indisponibilidades aprovadas e reservas comerciais ativas/mantidas. Professor precisa estar ativo; matrícula, ativa. Calendário ou contexto diferente daquele conferido exige nova proposta. A consulta mostra a conferência atual e pendências; a aprovação reconfere dentro dos bloqueios de calendário/matrícula/autor/configuração/professor. Rejeição continua possível para proposta inviável.

Exceção em dia não letivo exige justificativa específica na proposta, apresentada na tela e incluída na aprovação independente. Não dispensa conflitos ou indisponibilidade. Atravessar meia-noite é permitido preservando duração. Este fluxo não altera duração/preço contratados; mudanças desses termos seguem ajuste próprio.

Quando o original tem reserva de horas compradas, exigir liberação financeira aprovada conforme incremento 289 antes de submeter a remarcação. Publicar não cria cobrança/recebimento nem reserva horas automaticamente: o painel financeiro permite vincular o saldo liberado ao novo encontro da mesma contratação. O teste de ciclo pago cobre cancelamento, liberação independente, remarcação aprovada e reutilização de horas sem novo recebimento/cobrança.

Interface: /diario/encontros/[id]/remarcacao, acessível à equipe organizadora pelo cancelamento. Professor não recebe autorização para preparar remarcações por esta entrega. Propostas e decisões preservam evidência da escolha, exceção, origem e novo encontro. SQL reforça origem correspondente, aprovador independente/ativo/autorizado, matrícula/duração/estado do par de encontros e unicidade; a conferência completa de conflitos/calendário permanece no serviço.

Migration 20260914040000_remarcacao_particular aplicada somente no banco descartável: 136 migrations, schema diff vazio. Evidência: docs/validacao-remarcacao-particular-290-2026-09-13.json. Última regressão integral permanece 283. Q95 continua parcial pela alternativa de crédito financeiro; notificações Q38 ainda não integradas ao fluxo. Não há promessa de conclusão de validade/encerramento/correções financeiras das horas. Sem homologação interativa, produção ou envios externos.

## Incremento 289 — Liberação de horas para remarcação escolhida pelo aluno, 13/09/2026

Após o cancelamento da particular pela escola aprovado no incremento 288, o Financeiro pode propor a liberação da reserva de horas compradas. A proposta identifica a reserva, a decisão acadêmica, motivo e evidência da escolha do aluno por remarcação. Outra pessoa do Financeiro com financeiro.aprovar_acertos, ou Administração, aprova/rejeita. Autoaprovação é recusada mesmo com vários papéis.

A aprovação devolve os minutos à disponibilidade da compra por um registro de decisão imutável. A reserva original permanece no histórico. Consulta, nova reserva e trigger de saldo desconsideram somente reservas com liberação aprovada; propostas pendentes ou rejeitadas não liberam saldo. Aprovação repetida não amplia saldo. O banco impede duas liberações aprovadas para a mesma reserva, consumo de reserva liberada e alteração/remoção das propostas/decisões. Confere também papel, permissão, outro aprovador, correspondência da reserva, cancelamento acadêmico aprovado e ausência de consumo.

Serviços usam bloqueio de calendário, matrícula e autor vigente. Uma nova reserva continua exigindo matrícula ativa, encontro futuro da mesma contratação e saldo suficiente. A liberação é possível sem reativar uma matrícula pausada; não agenda aula nem muda validade por si só. Nenhuma cobrança ou recebimento é criado/alterado. O painel de compras apresenta a reserva liberada, histórico das propostas, evidência e decisão; esconde conferência de consumo de encontros cancelados/liberados. A consulta financeira reconfere o papel ativo.

Q95 continua parcial: a alternativa de crédito financeiro e a criação/remarcação do encontro com aprovação de agenda ainda precisam ser integradas. O ciclo aqui permite reservar o saldo liberado para outro encontro já autorizado/publicado da mesma matrícula; não publica uma nova aula implicitamente. Falta/cancelamento pelo aluno, correção de consumo, validade e acerto de encerramento continuam pendentes no ciclo persistente das horas.

Migration 20260914033000_liberacao_horas_remarcacao aplicada somente no banco descartável: 135 migrations, schema diff vazio. 29 integrações de compras, cancelamento acadêmico e diário aprovadas, incluindo liberação independente, idempotência, uso concorrente do saldo liberado, preservação dos recebimentos, rejeição, falta de cancelamento aprovado e revogação de acesso. TypeScript e lint direcionado aprovados. Evidência completa: docs/validacao-liberacao-horas-289-2026-09-13.json. Última regressão integral permanece 283; sem homologação interativa, produção ou envios externos.

## Incremento 288 — Cancelamento acadêmico de particular pela escola, 13/09/2026

Professor atribuído ao encontro, Secretaria, Gerência Pedagógica ou Administração podem propor o cancelamento de uma particular contratada. Outra pessoa da Gerência Pedagógica/Administração decide; acúmulo de papéis não permite autoaprovação. Até aprovar, o encontro permanece previsto. A decisão válida aplica CANCELADO na mesma transação, com motivo e eventos vinculados à matrícula correspondente.

O serviço serializa com agenda e matrícula, confere papel ativo, autoria, estado do encontro e reservas atuais. Mudança de horário/professor/reserva exige rejeitar a proposta desatualizada e preparar outra. Solicitação e decisão repetidas não duplicam efeitos. Encontro com diário ou consumo registrado é bloqueado e exige correção própria, ainda incompleta. Proposta e decisão são imutáveis no banco; o banco também exige decisor ativo, autorizado e diferente do preparador. A comparação completa do estado e aplicação da agenda são garantias do serviço, não de um trigger universal de agenda.

Interface disponível em /diario/encontros/[id]/cancelamento, com entrada pela lista de encontros e pela página acadêmica. Secretaria consulta somente a projeção operacional da lista, sem ampliar acesso ao diário, cadastro ou financeiro. Professor continua limitado aos encontros atribuídos. A projeção acrescenta somente o indicador booleano de particular.

Este incremento entrega a decisão acadêmica, não Q95 inteiro: escolha do aluno entre remarcação/crédito, proposta financeira, liberação/reassociação de horas reservadas e acerto ainda precisam ser integrados. Cancelar não apaga recebimentos, não cria presença, não consome horas, não libera saldo nem devolve dinheiro. A interface avisa explicitamente que o acerto continua pendente. Avisos externos de Q38 ainda não são disparados por este fluxo.

Migration 20260914030000_cancelamento_particular aplicada somente no banco descartável. Total de 134 migrations, schema diff vazio. Evidências e resultados: docs/validacao-cancelamento-particular-288-2026-09-13.json. Última regressão integral permanece 283. Sem homologação interativa, produção ou envios externos.

## Incremento 287 — Integridade do consumo no banco, 13/09/2026

A inserção de ConsumoHorasCompradas agora também confere no PostgreSQL o autor ativo com papel financeiro/administrativo, reserva e compra, matrícula do encontro, intervalo preservado, diário com autoria compatível, conteúdo e presença única do aluno contratado. A correspondência exata do hash e a exigência de horário terminado permanecem verificadas pelo serviço; o trigger acrescenta integridade estrutural, sem substituir essas verificações.

Diário, presença e encontro vinculados a consumo ficam protegidos contra alterações diretas que mudem sua base. A conclusão acadêmica posterior de PREVISTO para MINISTRADO permanece permitida quando nenhum outro dado do encontro muda, preservando a separação entre conferência financeira e pendência de gravação. Correções que afetem a base financeira precisam do fluxo próprio ainda pendente. O guard de registros verifica também mudança para uma aula de destino já consumida.

Foram aplicadas, somente no banco descartável, as migrations 20260914023000_integridade_consumo_horas e 20260914024000_contexto_trigger_consumo. A segunda refina o acesso aos campos do trigger compartilhado entre tabelas e a verificação do destino; a primeira migration aplicada foi preservada. Total: 133 migrations; schema diff vazio.

Validação: 23 integrações de compras/diário aprovadas, com tentativas diretas no banco de consumo sem presença/papel, alteração de conteúdo/presença e cancelamento do encontro, além da conclusão acadêmica posterior permitida. TypeScript e lint direcionado aprovados. O código executável da aplicação não mudou; o build aprovado no incremento 286 permanece correspondente. Evidência: docs/validacao-integridade-consumo-287-2026-09-13.json. Última regressão integral: 283.

Continuam pendentes correção aprovada com ajuste financeiro, cancelamentos, liberação de horas, validade e acerto do saldo. Esta proteção impede reescrita silenciosa, mas não implementa essas operações. Sem homologação interativa, produção ou envios externos.

## Incremento 286 — Consumo por realização conferida, 13/09/2026

ConsumoHorasCompradas registra uma conferência imutável por reserva, com autor, motivo, estado do diário e data. Pelo painel financeiro, a equipe consulta a realização e confirma o consumo da quantidade reservada. O servidor confere matrícula/encontro da compra, intervalo preservado, horário terminado, autoria docente, conteúdo e presença do aluno. Uma revisão anterior perde validade quando o diário muda. Concorrência e repetição preservam um único consumo.

A realização pode estar registrada enquanto EncontroAgenda ainda está PREVISTO por pendência de gravação; essa pendência não bloqueia a conferência financeira. A operação não altera o status acadêmico, registra presença, cria cobrança ou recebimento. Falta/cancelamento não são classificados como realização. Reservados, consumidos e saldo ainda não reservado aparecem separados; consumir não devolve disponibilidade. O diário com horas consumidas deixa de aceitar edição direta pelo professor e exige correção com revisão dos efeitos financeiros.

Validação: 23 integrações aprovadas (compras e diário); os sete testes de compras foram repetidos após acrescentar a verificação da edição bloqueada. TypeScript, lint direcionado e build com 52 páginas estáticas aprovados. Migration 20260914020000_consumo_horas_realizadas aplicada somente no banco descartável; 131 migrations e schema diff vazio. Evidência: docs/validacao-consumo-horas-286-2026-09-13.json. Última regressão integral: 283.

Continuam pendentes os desfechos de falta/cancelamento cobrável, liberação de reserva, correção aprovada do consumo, validade, pausa e acerto de saldo. A conferência de realização não substitui esses fluxos e não conclui o ciclo completo de horas. Sem homologação interativa, produção ou envios externos.

## Incremento 285 — Reserva persistente de horas compradas, 13/09/2026

ReservaHorasCompradas vincula compra, encontro, autor, minutos e intervalo preservado. O Financeiro pode reservar pelo painel de compras horas para encontro particular futuro já publicado da mesma matrícula ativa. O servidor deriva a duração do encontro; não aceita quantidade livre nesse passo. Travas da agenda, matrícula, compra e encontro serializam a operação. O banco impede ultrapassar a quantidade comprada, duplicar o encontro e alterar/apagar a reserva diretamente. Repetição idempotente não cria outra reserva nem recebimento.

O painel mostra minutos reservados e ainda não reservados, além dos vínculos por encontro, e oferece seleção de até 100 encontros futuros. A operação não cria agenda, não transfere saldo entre matrículas, não conclui aula nem registra consumo. Reserva não equivale a serviço prestado. No estado atual, a quantidade permanece comprometida até a implementação do fluxo de desfecho.

Validação: seis integrações aprovadas de compras/reservas, incluindo concorrência por saldo, idempotência, tentativa SQL acima do limite, outro contrato, pausa e recebimentos preservados. TypeScript, lint direcionado e build com 52 páginas estáticas aprovados. Migration 20260914013000_reserva_horas_compradas aplicada ao banco descartável; 130 migrations e schema diff vazio. Evidência: docs/validacao-reserva-horas-285-2026-09-13.json. Última regressão integral: 283.

Pendências: consumo por ocorrência conferida, devolução de disponibilidade por cancelamento, revisão de reservas afetadas por alteração de agenda, validade e pausa. A imutabilidade atual exige implementar eventos/decisões de desfecho, sem substituir o histórico. Ainda não se declara o ciclo completo de horas nem a SPEC concluídos. Sem homologação interativa, produção ou envios externos.

## Incremento 284 — Compra de horas da preparação aceita, 13/09/2026

registrarCompraHorasAntecipadas agora distingue preparação comercial de compra legada. Nas preparações exige aceite integrado vigente, regime HORA_PARTICULAR e cobrança vinculada à emissão inicial conferida da mesma versão das condições. Minutos, valor e moeda devem corresponder ao adiantamento contratado. Uma quantidade informada diferente não cria compra. Registra na memória preparação, condições, versão e emissão; conserva os recebimentos existentes e a idempotência da compra.

Quando o preço negociado aceito excede a referência da cobrança, a base da compra é o valor negociado, com desconto zero; o valor de referência permanece na memória. Quando existe desconto, preserva a diferença entre base original e valor pago. Isso evita desconto negativo sem alterar cobrança, preço contratado ou recebimento. Compras legadas mantêm seu fluxo de conferência próprio.

Validação: 71 integrações aprovadas em compra-horas e reserva/preparação, incluindo adiantamento aceito e pago, recusa de quantidade indevida, repetição e preservação de recebimentos. TypeScript, lint direcionado e build com 52 páginas estáticas aprovados. Sem migration adicional. Evidência: docs/validacao-compra-preparada-284-2026-09-13.json. Última regressão integral: 283.

Ainda faltam a persistência do ciclo de reservas/consumos, validade, pausa e acerto de saldo. Compra posterior fora do adiantamento inicial precisa de condições próprias; não pode reutilizar sua emissão ou inventar quantidade. O formulário existente continua exigindo conferência da quantidade; a validação autoritativa é do servidor. Sem homologação interativa, produção ou envios externos.

## Incremento 283 — Regressão integral após diário particular, 13/09/2026

A regressão completa aprovou 791 testes unitários em 86 arquivos e 641 integrações em 50 arquivos, sem falhas ou pendências. As integrações rodaram em um único processo no banco descartável local. Lint completo: zero erros e três avisos preexistentes em FinanceiroPainel.tsx e Sidebar.tsx. O código executável permanece o do incremento 282, cujo TypeScript, build com 52 páginas estáticas e schema diff vazio foram aprovados após 129 migrations. Este incremento alterou documentação e evidências, sem mudanças de código de produção. Relatório por arquivo: docs/validacao-regressao-283-2026-09-13.json.

O resumo da SPEC central foi atualizado para refletir ativação em turma/particular e diário individual, retirando descrições antigas dessas entregas. A auditoria da próxima etapa preservou as pendências de gravação integrada, correção/regularização de autoria, ocorrências cobráveis, histórico de encerramento e ciclo persistente de horas. CompraHorasAntecipadas já existe e registra compra quitada com seus recebimentos; deve ser aproveitada, integrando condições/minutos do adiantamento preparado e o ciclo de reservas, consumo e validade. Não recriar esse cadastro nem confundir cálculo puro com saldo operacional completo.

A regressão comprova somente os cenários cobertos pelas suítes. Ainda não há comprovação integral de todos os requisitos da SPEC, homologação interativa das últimas telas ou operação real dos fornecedores. Sem produção, importação ou envios externos.

## Incremento 282 — Diário de encontros particulares, 13/09/2026

AulaDiario admite turma nula somente quando identifica um encontro. A migration 20260914010000_diario_particular preserva contexto, autoria e data depois do registro e confere a correspondência entre diário e encontro. Não cria turma fictícia nem altera os diários existentes. A aplicação ocorreu somente no banco descartável local.

O professor atribuído acessa a chamada existente em /diario/encontros/[id] e salva por salvarDiarioParticular. O servidor deriva a matrícula do encontro, revalida o docente, o horário já terminado, o estado PREVISTO e o histórico daquele contrato. Aceita somente o aluno correspondente, sem dados financeiros ou contatos pessoais. Histórico insuficiente exige conferência. Conteúdo e presença podem ficar pendentes; salvar não conclui o encontro nem emite cobrança. Edição exige o estado atual do diário; autoria diferente exige regularização. O histórico geral apresenta Particular e encaminha edição pendente ao encontro, preservando o nome capturado na chamada.

A conclusão por exceção de gravação usa o fluxo independente existente, agora com matrícula no contexto revisado. Exige conteúdo, presença confirmada e outra pessoa da gestão para aprovação. Falta na particular não comprova aula ministrada: permanece ocorrência a conferir no fluxo próprio, sem gerar nota, presença ou cobrança automaticamente. Depois da conclusão, a edição direta fica bloqueada.

Validação: 83 integrações aprovadas (16 diário e 67 reserva/preparação), 12 testes unitários, TypeScript, lint direcionado sem avisos e build Next.js com 52 páginas estáticas. Schema diff vazio após 129 migrations. Uma fixture antiga passou a cadastrar o encontro antes de criar o diário, respeitando a preservação do vínculo. Evidência: docs/validacao-diario-particular-282-2026-09-13.json. Última regressão integral: 279.

Limites: conclusão regular com gravação integrada, responsável designado para regularização de autoria, correção aprovada da particular e apuração financeira de ocorrências/horas permanecem pendentes. O reconstrutor de situação contratual ainda exige conferência para encerramento sem histórico suficiente. Não houve homologação interativa, produção, importação ou envios externos; este incremento não conclui toda a operação particular nem toda a SPEC.

## Incremento 281 — Ativação de particulares mensais e por hora, 13/09/2026

ativarPreparacaoTx agora atende turma e particular no caminho público concluirMatricula. Para particulares, resolve a cadeia atual da reserva e revalida horários preservados, professor ativo, calendário e conflitos sob bloqueio da agenda. Depois de conferir aceite integrado, condições, pagamentos e comissão, utiliza a reserva e cria EncontroAgenda com matriculaId, sem turma ou alocação fictícia. Preserva professor, instantes e fuso; o evento da ativação relaciona cada horarioReservaId ao encontroId criado. Conversão, emissão aplicável, ativação e eventos pertencem à mesma transação.

Mensalidade particular respeita a exigência registrada: pagamento inicial obrigatório precisa estar confirmado; quando dispensado antes da entrada, a primeira mensalidade é emitida na ativação. Por hora confere a taxa e eventual adiantamento obrigatório; sem adiantamento não cria mensalidade ou cobrança de horas fictícia. Recebimentos existentes permanecem preservados. O novo ingresso particular não altera outro contrato ou sua alocação ativa. Professor inativo, encontros já registrados nesta preparação ou alocação de turma na própria preparação exigem regularização.

Validação: 83 integrações aprovadas em reserva/preparação, ativação e Secretaria, com quatro novos cenários de particulares. Cobrem grade fixa/flexível, mensal/hora, pagamento inicial exigido/dispensado, reversão após criação dos encontros, concorrência real, repetição pública e preservação de outro contrato. Trinta testes unitários direcionados, TypeScript, lint direcionado sem avisos e build Next.js com 52 páginas estáticas aprovados. Evidência: docs/validacao-ativacao-particular-281-2026-09-13.json. Sem migration adicional; última regressão integral 279.

Limites atuais: src/server/diario/chamada-encontro.ts ainda recusa encontro sem turma e exige o fluxo individual. A entrega de ativação não conclui diário particular, apuração de ocorrências cobráveis, saldo persistente de horas antecipadas, próximos agendamentos flexíveis nem todo Q111. A exceção em dia não letivo ainda precisa alcançar a reserva particular. Permanecem a migração da situação global do aluno e das múltiplas alocações em turmas, além de fornecedor real de assinatura e demais requisitos da SPEC. Os processos de assinatura dos testes usam protocolo simulado, sem envio externo. Sem homologação interativa, produção ou importação.

## Incremento 280 — Ativação da preparação em turma, 13/09/2026

O caminho público de conclusão agora encaminha preparações comerciais em turma para ativarPreparacaoTurmaTx. Na mesma transação, revalida o usuário, aceite integrado de produção, condições aceitas, emissão inicial e pagamentos confirmados; confere reserva, capacidade, professor, calendário, produto e janela de entrada ou exceção aprovada. Converte a reserva em UTILIZADA, cria a alocação vinculada à matrícula e registra ativação, movimentação, comissão e eventos. Recebimentos exigidos são confirmados pelo Financeiro antes da conclusão.

A emissão da etapa ATIVACAO utiliza a versão contratada: cria a primeira mensalidade quando dispensada como pagamento prévio; não duplica a mensalidade já emitida nem os recebimentos. A comissão utiliza o responsável capturado na preparação e a política com vigência na data da contratação; ausência de política exige conferência. Repetição retorna o resultado existente. Falha após os efeitos reverte todo o ingresso e duas ativações concorrentes não duplicam reserva, alocação, cobrança, comissão ou evento.

Validação: 791 testes unitários e 79 integrações direcionadas aprovados, incluindo os dois regimes de exigência da primeira mensalidade, reversão e concorrência reais. TypeScript, lint direcionado e build Next.js com 52 páginas estáticas passaram. As duas expectativas antigas de mensagem foram ajustadas para os bloqueios anteriores do novo fluxo, preservando a verificação direta da política de entrada. Evidência: docs/validacao-ativacao-preparacao-280-2026-09-13.json. Última regressão integral de integração: 279; nenhuma migration adicional.

Limites: particulares mensais/por hora continuam exigindo ativação própria e conversão de horários reservados. O índice legado de uma alocação ativa por aluno e a conferência da situação global do cadastro permanecem; esta entrega não libera contratos simultâneos nem conclui Q102/B01. A ativação não presume doze mensalidades futuras; continuidade contratada mantém seu escopo próprio. Assinatura real com fornecedor, homologação interativa e demais requisitos da SPEC permanecem pendentes. Sem produção, importação ou envios externos.


## Incremento 279 — Regressão integral e auditoria da ativação, 13/09/2026

Regressão completa aprovada: 791 testes unitários em 86 arquivos e 635 integrações em 50 arquivos, sem falhas ou pendências. A integração rodou em um único processo contra o banco descartável local. TypeScript passou, lint completo teve zero erros e três avisos preexistentes (FinanceiroPainel.tsx e Sidebar.tsx), schema diff vazio e 128 migrations. O build do incremento 278 permanece correspondente ao código executável; este incremento alterou testes e documentação. Evidência por arquivo: docs/validacao-regressao-279-2026-09-13.json.

A primeira execução unitária identificou 11 falhas em conclusao.test.ts: o mock não incluía a consulta ao novo aceite integrado. As fixtures passaram a distinguir contratos legados de preparação comercial com conclusão/aceite válidos, preservando a validação real do guard. Acrescentado caso explícito que recusa a ativação de preparação com flags antigas e sem aceite integrado. A execução unitária integral foi repetida e passou; nenhuma regra de assinatura foi relaxada para fazer os testes passarem.

A auditoria do caminho público de ativação identificou pendências registradas na SPEC da matrícula: emissão da primeira mensalidade na própria ativação quando dispensada na entrada; uso da reserva e criação da alocação por matrícula; conversão de horários particulares em encontros; entrada por hora com adiantamento conforme contrato; preservação dos demais contratos do aluno e remoção coordenada da restrição global de alocação. O registro integrado de aceite entregue no incremento 278 não completa esses efeitos acadêmicos e financeiros.

Esta regressão comprova os comportamentos cobertos pela suíte, não a conclusão integral da SPEC. Permanecem pendentes funcionalidades e validações operacionais descritas nos documentos. Não houve homologação interativa, importação de produção, assinatura real nem envio externo.



## Incremento 278 — Aceite integrado do original pela Secretaria, 13/09/2026

AceiteOriginalContratual registra a conferência final com matrícula, conclusão de assinaturas, documento protegido, autor/data, motivo, revisão e memória das condições. É único por matrícula, conclusão e documento; registros são imutáveis. A migration 128 exige conclusão de produção pertencente à matrícula, Secretaria/Administração ativa, preparação ainda disponível para aceite e documento correspondente à conclusão. Também impede alterar vínculo, URL, categoria ou arquivamento do documento aceito.

A consulta e o formulário na página do original mostram pendências ou oferecem a confirmação explícita de original, PDF assinado, auditoria, assinaturas exigidas e condições. carregarRevisaoAceite revalida integridade dos arquivos, identidades/papéis, ordem e datas das assinaturas, vínculo ao envio confirmado, original e participantes atuais, condições/pagador, emissão inicial e consistência das cobranças. Reaplica as regras de reserva, admissão e taxa prévia. Pagamentos exigidos apenas para ativar não se tornam exigência adicional de aceite. Mudança entre consulta e confirmação exige nova revisão.

confirmarAceiteOriginal delega à primitiva interna confirmarAceiteOriginalTx. A transação revalida o autor e serializa confirmações, cria um único Documento apontando à rota privada de PDF já preservado, registra o aceite, atualiza a referência contratual da matrícula e emite ContratoConfirmado com aceiteOriginalId/conclusaoId/artefatoId e condições mensais. Repetição idêntica retorna o registro; reutilização divergente da chave é recusada. Aceite não ativa a matrícula, não confirma recebimento e não emite nova cobrança.

O guard de ativação agora reconhece esse aceite integrado: exige vínculo/autor/data/documento corretos, integridade da conclusão de produção e condições/pagador ainda correspondentes. A preparação comercial continua recusando o caminho manual e flags legadas sem aceite integrado. Matrículas sem preparação conservam a conferência manual existente. O histórico permanece consultável depois do aceite; alterações posteriores do contrato dependem dos fluxos próprios.

Validação: 79 integrações aprovadas (63 de reserva/preparação; 16 de Secretaria/ativação), TypeScript, lint direcionado, build Next.js com 52 páginas estáticas e schema diff vazio; 128 migrations no banco descartável. Cobertura inclui sandbox recusado, conferência positiva com taxa prévia exigida/dispensada, revisão desatualizada, versão financeira alterada, matrícula incorreta, papel comercial recusado, duas transações concorrentes idempotentes, repetição pela ação, imutabilidade e guard de documento divergente. Na primeira execução, a simulação de autenticação do runner falhou ao carregar NextAuth em duas ações concorrentes. A concorrência passou a ser testada na primitiva transacional real, mantendo testes de sessão/permissão e repetição pela ação; a extração não removeu a revalidação do autor. Evidência: docs/validacao-aceite-integrado-278-2026-09-13.json.

Limites: as evidências classificadas como PRODUCAO nos testes são fixtures locais, não assinaturas reais. Adaptador/proveniência autenticada do fornecedor, envios operacionais, substituição, aditivos e ativação particular com consumo de horários continuam pendentes. Reconhecer o requisito contratual não comprova a ativação completa de todos os regimes nem habilita operar a integração externa. Não houve homologação interativa, produção ou envios externos. Última regressão integral: incremento 273.



## Incremento 277 — Impedir aceite manual na preparação comercial, 13/09/2026

A conferência manual de Documento ainda podia marcar contratoOk em contratações da nova preparação comercial sem exigir conclusão de assinatura integrada do original. exigirAceiteManualPermitido agora restringe esse caminho às matrículas sem PreparacaoComercialMatricula. confirmarContratoMatricula aplica a restrição antes de vincular o anexo; exigirContratoAceito também a aplica antes de aceitar flags/documento legados para ativação. A aprovação do preço continua sendo exigida separadamente.

No painel da Secretaria, contratações preparadas exibem orientação e acesso aos documentos/assinaturas em lugar do formulário de aceite por anexo. Contratos sem preparação comercial conservam o caminho manual existente. Nenhum registro, recebimento ou contrato histórico foi apagado ou alterado retroativamente.

Validação: 77 integrações aprovadas nos arquivos reserva-vaga (61), politica da Secretaria e ativacao (16 em conjunto). O cenário novo mantém conclusão sandbox e um anexo explicitamente criado no teste, verifica rejeição da confirmação manual e de flags legadas de aceite na ativação, e preserva contratoOk falso. A primeira execução exigiu corrigir a contagem esperada de documentos para incluir esse anexo de teste; a nova execução dos 61 casos passou. Os 16 casos dos outros dois arquivos já haviam passado, sem alteração posterior do código executável. TypeScript, lint direcionado e build Next.js aprovados, com 52 páginas estáticas; sem nova migration. Evidência: docs/validacao-aceite-manual-277-2026-09-13.json.

Limite explícito: este incremento fecha uma forma de contornar Q104/Q106/Q115; não implementa a conferência final integrada. A nova preparação permanece impedida de usar o aceite legado, inclusive se já houver evidência preservada. O próximo fluxo deve registrar a conferência vinculada ao original e às condições corretas, exigir evidência de produção autenticada e integrar sua validação à ativação. Adaptador externo, aceite integrado, substituição e aditivos continuam pendentes. Última regressão integral 273; sem homologação interativa, produção ou envios externos.



## Incremento 276 — Consulta protegida das evidências de assinatura, 13/09/2026

Secretaria/Administração pode consultar o processo de assinatura vinculado ao original da matrícula, com identificação do serviço, ambiente de teste/produção, participantes e datas de conclusão. A projeção de metadados não entrega bytes, documentos pessoais, e-mails, hashes de identidade ou referências externas das assinaturas. O ambiente de teste aparece explicitamente; consultar evidências não confirma aceite nem ativa matrícula.

A rota privada /api/matriculas/[id]/assinaturas/[conclusaoId]/[tipo] entrega o PDF assinado ou a auditoria preservada. Revalida sessão, papel e usuário ativo, exige vínculo exato entre conclusão e matrícula e confere o hash dos bytes antes da resposta. PDF assinado pode ser aberto no navegador; auditoria é entregue como anexo. Respostas usam Cache-Control private, no-store e nosniff. A consulta mantém acesso ao histórico sem exigir que a reserva continue vigente.

Validação: 61 integrações de reserva/preparação aprovadas, incluindo conteúdo dos dois arquivos, ausência de campos privados na projeção, tipo inválido, vínculo de outra matrícula, ausência de sessão, papel comercial e usuário desativado. A primeira execução apontou expectativa incorreta de 403 para usuário desativado; o guard invalida a sessão com 401, e a expectativa foi corrigida. TypeScript, lint direcionado e build Next.js aprovados, com 52 páginas estáticas. Sem nova migration. Evidência: docs/validacao-consulta-assinatura-276-2026-09-13.json.

Limites: adaptador do fornecedor, retorno operacional autenticado, conferência final do aceite, substituição e aditivos continuam pendentes. Os testes utilizam evidências locais de teste; não houve assinatura ou envio externo, homologação interativa ou produção. Última regressão integral: incremento 273.


## Incremento 275 — Preservação da conclusão das assinaturas, 13/09/2026

ConclusaoAssinaturaContratual separa o envio confirmado da conclusão das assinaturas exigidas. Vincula processo, referência externa e hash do original; preserva PDF assinado, auditoria, hashes, participantes, datas e hash do conteúdo normalizado. Registro é único por processo e imutável. Repetição idêntica retorna o mesmo registro; conteúdo divergente exige conferência. Original e registros do envio não são substituídos.

A primitiva interna preservarConclusaoAssinaturaTx exige envio confirmado e original íntegro, confere todos os papéis/identidades do snapshot institucional, recusa papéis repetidos ou assinatura parcial, valida o intervalo temporal e a ordem clientes antes da escola. Arquivos possuem limite técnico de 20 MiB cada; PDF exige cabeçalho e auditoria não vazia. Migration 127 acrescenta o registro e proteções de vínculo, hashes dos arquivos, papéis, datas, ordem e imutabilidade no banco.

Essa primitiva não é Server Action nem endpoint público. Somente o futuro adaptador autenticado, após conferir o documento e a auditoria no fornecedor, deve chamá-la. Hash de arquivo não autentica por si só a assinatura de uma pessoa; a validação da proveniência e da resposta do serviço continua responsabilidade dessa integração. Ambiente sandbox permanece identificado no processo e no evento; os testes não simulam autorização de uso em produção.

Validação: 9 unitários e 61 integrações de reserva/preparação aprovados. Cobertura de conclusão parcial, identidade divergente, ordem incorreta, datas incompatíveis, arquivos inválidos, envio/original incorretos, repetição, divergência de evidência, imutabilidade e preservação sem contratoOk automático. TypeScript, lint direcionado, build Next.js e schema diff aprovados; 127 migrations no banco descartável. Evidência: docs/validacao-conclusao-assinatura-275-2026-09-13.json.

Limites: não houve assinatura externa, consulta/download do documento assinado pela equipe, conferência final da Secretaria ou ativação. Continuam pendentes adaptador/configuração do fornecedor, tratamento de retornos tardios/divergentes, aceite do original aplicável, substituição, aditivos e ativação particular com consumo dos horários. Nenhuma matrícula foi ativada por registrar esta evidência. Última regressão integral 273; sem homologação interativa, produção ou envio externo.

## Incremento 274 — Conferência dos pagamentos de entrada das particulares, 13/09/2026

Consulta e tela /matriculas/[id]/entrada-particular conferem os pagamentos da preparação particular, com acesso de Secretaria/Financeiro/Administração e papel ativo revalidado. A tela de emissão inicial oferece o acesso para particulares. Projeta identificação mínima da matrícula/aluno, versão das condições, cobranças de entrada e recebimentos confirmados; não retorna contatos, documentos ou snapshots.

A conferência exige preparação particular assumida, condições/pagador atuais e emissão inicial conferida vinculada à mesma versão. Compara o plano de cobrança das condições à memória de emissão, vínculos ItemEmissaoEntrada e cobranças existentes. Divergências de valor, moeda, vencimento, cobertura, minutos ou vínculo exigem regularização. Usa o fuso da emissão preservada para conferir o vencimento, sem substituí-lo pela configuração atual da escola.

Por hora sem adiantamento contratado confere somente a taxa; não cria nem exige mensalidade. Adiantamento obrigatório precisa estar integralmente recebido com confirmação/data; antecipação opcional não se transforma em requisito de ativação. Particular mensal respeita a exigência da primeira mensalidade: se dispensada antes da ativação, apresenta a emissão prevista nessa etapa. Cobrança cancelada é pendência. A consulta não registra recebimento, ativa matrícula, libera contrato ou consome a reserva; horários e aceite ainda precisam de validação própria.

Validação: 10 testes unitários do conferidor e 61 integrações de reserva/preparação aprovados. As quatro combinações particulares existentes agora conferem emissão, acesso comercial negado, ausência de campos privados, leitura pelo Financeiro, quitação real via ledger e usuário inativo recusado. Pagamentos preservados não são repetidos e a matrícula continua sem ativação por efeito da consulta. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-entrada-particular-274-2026-09-13.json.

Sem migration adicional. Última regressão integral: 273. Permanecem pendentes a ativação transacional particular, aceites/assinaturas aplicáveis, conversão dos horários reservados em encontros e consumo da reserva, além dos demais requisitos da SPEC. Esta conferência financeira é uma etapa preparatória; não declara Q100/Q111 ou a ativação concluídas. Sem homologação interativa, produção, importação ou envio externo.

## Incremento 273 — Regressão integral e conferência das pendências, 13/09/2026

Regressão executada após os incrementos 266–272: 771 testes unitários e 633 integrações aprovados, sem falhas ou casos pendentes. Integração em processo único, somente no banco descartável local. Lint completo sem erros e com três avisos preexistentes react-hooks/set-state-in-effect (FinanceiroPainel.tsx:116/402 e Sidebar.tsx:38). TypeScript aprovado, schema diff vazio com 126 migrations. Build do mesmo código executável foi aprovado no incremento 272 (52 páginas estáticas). Evidência por arquivo: docs/validacao-regressao-273-2026-09-13.json.

A regressão confirma os comportamentos cobertos pelos testes existentes, não a conclusão do escopo. A conferência direta do código mantém pendências importantes: entrada-ativacao.ts bloqueia corretamente o caminho mensal legado para particulares; acoes.ts ainda exige taxa e primeira mensalidade nesse caminho; a conversão dos horários reservados em encontros da contratação não está integrada à ativação. Contratos por hora precisam conferir adiantamento exigido/dispensado conforme contrato, sem inventar mensalidade. O rascunho de acerto em encerramento-rascunho.ts não equivale a aprovação ou efetivação final.

Próxima implementação da ativação particular deve integrar, na mesma operação, condições aceitas e pagamentos exigidos, disponibilidade/reserva atual, encontros vinculados à matrícula, consumo da reserva e mudança de estado. Assinatura externa e a comprovação de todas as assinaturas exigidas continuam com dependências próprias. Não remover as recusas existentes antes de implementar esses efeitos e seus testes.

Sem mudanças de produto nesta rodada, homologação interativa, produção, importação ou envio externo. O objetivo integral permanece ativo; a lista de pendências das SPECs continua válida.

## Incremento 272 — Fila conjunta de impactos das correções, 13/09/2026

A fila /academico/correcoes passa a consultar correções regulares e de recuperação que foram aprovadas com mudanças acadêmicas afetadas. A paginação é aplicada ao conjunto das duas fontes antes de carregar os detalhes, em ordem de decisão e identificador; cada página contém no máximo 20 casos, com indicação da próxima. Isso evita que uma fonte esconda ou duplique a outra na navegação.

Cada item informa matrícula/aluno, origem da correção, avaliação ou habilidade, responsável/data da aplicação e as mudanças acadêmicas afetadas. Preserva a situação registrada na correção e confere a situação atual pelo vínculo de origem. Links levam às correções correspondentes e às movimentações da matrícula. Acesso exige Gestão Pedagógica/Administração ativa, revalidada no servidor; não projeta contatos, credenciais ou chaves de operação.

Validação: 53 integrações de lançamentos aprovadas. O cenário de recuperação agora cria uma mudança aprovada depois da revisão, confirma que a aprovação fica desatualizada e exige nova conferência. Após aplicação, o caso aparece na fila sem desfazer a mudança. Cobertura adicional verifica fila mista com 21 correções em duas páginas, sem repetição/perda, acesso negado a professor e ausência de campos privados. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-fila-correcoes-272-2026-09-13.json.

Não há nova migration. A fila torna as pendências encontráveis; não afirma que foram resolvidas. Resolução operacional da revisão de progressão continua pendente, assim como correções da realização/consumo, oportunidades extras, ocorrências do aluno, segunda chamada, frequência, equivalências, fechamento final e portal. Sem homologação interativa, produção ou envio externo. Última regressão integral: incremento 265; entrega completa permanece em implementação.

## Incremento 271 — Correções de notas de recuperação, 13/09/2026

Notas de recuperação oficializadas agora possuem propostas de correção versionadas, preparadas pelo professor atualmente responsável pela turma ou pela Gestão Pedagógica/Administração. Cada proposta identifica a nota original, a origem vigente, o novo valor/comentário e o motivo. Outra pessoa da gestão revisa e decide. Acúmulo de papéis não permite autoaprovação. A proposta mantém o resultado anterior até aprovação válida; rejeição não altera o consolidado. Reenvio do mesmo conteúdo é idempotente e origem/versão superadas são recusadas.

Modelos PropostaCorrecaoRecuperacao e DecisaoCorrecaoRecuperacao preservam histórico, autoria e impactos. Migration 126 protege imutabilidade, nota oficial de origem, papel/vínculo docente, versão sequencial, escala e decisão independente no banco. O servidor também confere hash da proposta e da revisão de impactos antes de aplicar. Inclui mudanças acadêmicas aprovadas/executadas e planos de recuperação aprovados do vínculo; registra evento de revisão necessária para progressões afetadas, sem transferir o aluno nem desfazer decisões automaticamente.

O consolidado usa a última correção aprovada de cada nota de recuperação e conserva a nota original no histórico. Corrigir uma recuperação indevidamente alta pode reduzir o resultado vigente: o melhor resultado é recalculado com as notas válidas, sem tratar a correção como nova tentativa e sem consumir oportunidade. As fontes da consolidação incluem a correção aprovada, invalidando propostas dependentes cuja base tenha mudado.

A tela /academico/recuperacoes/correcoes/[notaId], acessível pela nota oficial aos perfis autorizados, identifica matrícula e habilidade, mostra original/vigente, permite propor, conferir impactos e decidir, com histórico paginado. Não expõe chaves ou hashes no histórico docente; a revisão para decisão exige gestão. A consulta da recuperação mostra o valor corrigido e preserva a nota anterior. Não devolve escrita a professor desligado ou sem atribuição vigente.

Validação: 53 integrações de lançamentos aprovadas, incluindo redução de recuperação 8 para 4 restaurando resultado original 5, preservação da nota 8 no histórico, rejeição, replay, escala, origem superada, acesso indevido, autoaprovação no servidor/banco, imutabilidade, histórico e paginação. TypeScript, lint direcionado, build Next.js e comparação do schema aprovados. Evidência: docs/validacao-correcao-recuperacao-271-2026-09-13.json. Migration aplicada somente ao banco descartável local.

Limites: esta entrega corrige nota/comentário, não a realização, habilidade ou consumo da tentativa. A resolução operacional das revisões de progressão, fila consolidada dessas pendências de recuperação, oportunidades extras, ocorrências do aluno, segunda chamada, frequência, equivalências, fechamento final e integração com portal continuam pendentes. Sem homologação interativa, produção ou envio externo. O escopo integral permanece em implementação.

## Incremento 270 — Regularização da realização de recuperação, 13/09/2026

O professor com designação vigente para a tentativa pode registrar uma avaliação realizada por outro professor, informando realizador, data efetiva, motivo e evidência. A consulta oferece somente nomes de professores com vínculo histórico na turma ou designação no item; o servidor confere a atribuição na data exata. O realizador pode estar atualmente inativo. O registrador precisa continuar ativo, com papel docente e designação específica; ser titular da turma não basta para registrar em nome de terceiro.

RealizacaoRecuperacao preserva separadamente professorId (realizador), registradaPorId e motivoRegularizacao. A migration 125 acrescenta campos sem reescrever históricos anteriores e reforça a proteção de inserção/imutabilidade no banco. Reenvio idêntico conserva o registro; alteração exige fluxo próprio. Mantêm-se prazo autorizado na data, reserva, vínculo histórico do aluno e situação contratual aplicável. Não cria nota, presença, progressão ou novo saldo.

A tela da tentativa designada permite escolher o realizador e exige motivo quando for outra pessoa. A consulta de notas exibe as duas autorias. Após revogação, o registrador encontra sua realização em Meu histórico, em leitura; isso não abre notas de outros autores nem o plano inteiro. Oficialização da nota continua independente do autor da nota e do realizador.

Validação: 52 integrações de lançamentos aprovadas, incluindo ausência de designação/motivo, realizador sem vínculo, item não atribuído, realizador atualmente inativo, replay, imutabilidade SQL e leitura própria após revogação. TypeScript, lint direcionado, build Next.js e comparação do schema aprovados. Evidência: docs/validacao-regularizacao-recuperacao-270-2026-09-13.json. Migration aplicada somente ao banco descartável local.

Pendências: correções de recuperações, oportunidades extras, ocorrências do aluno, exceções contratuais, segunda chamada, frequência, equivalências, fechamento final e integração com agenda/portal. Sem homologação interativa, produção ou envio externo. A entrega integral permanece em implementação.

## Incremento 269 — Descoberta do histórico próprio de recuperação, 13/09/2026

A área Minhas recuperações distingue atribuições pendentes e Meu histórico. O histórico encontra realizações do professor ou registros de nota de sua autoria, mesmo após revogação/oficialização, com link direto à consulta de notas. Designação sem realização/lançamento não concede histórico por si só. Consulta continua exigindo professor ativo e conserva projeção mínima e paginação por cursor; uma realização aparece uma vez mesmo que possua várias versões de nota. Não abre o histórico de outras habilidades/alunos por associação ao plano.

Links históricos seguem as permissões da consulta de notas existente: autoria preservada, acesso em leitura sem atribuição vigente e sem reabrir o plano. A navegação resolve a descoberta de recuperações que deixaram a fila de pendências, sem conceder escrita por escolher o filtro histórico.

Validação: 51 integrações de lançamentos aprovadas; cenários de designação ampliados para histórico vazio antes do trabalho, presença por autoria da nota ou realização, persistência após revogação, cursor sem repetição, campos privados ausentes e inativo negado. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-historico-recuperacao-269-2026-09-13.json. Sem migration adicional; última regressão integral 265.

Pendências: regularização de realização antiga por terceiro, correções, oportunidades extras, ocorrências do aluno, exceções, integração com agenda/portal e preferência global de fuso. Sem homologação interativa, produção ou envio externo. O objetivo completo permanece em implementação.

## Incremento 268 — Fila e detalhe da tentativa designada, 13/09/2026

Fila /academico/recuperacoes/designadas, ligada ao painel de avaliações para professores, lista até 20 tentativas pendentes com atribuição vigente, identificação mínima e continuidade por cursor. Consulta exige professor ativo mesmo quando há papel administrativo. Usa o estado atual da designação, exclui itens cancelados sem realização e itens com nota oficializada. Não inclui outras habilidades do mesmo plano por consequência de uma atribuição.

Detalhe /academico/recuperacoes/tentativas/[itemReservaId] revalida a atribuição sob bloqueio do vínculo e apresenta somente a estratégia/avaliação da habilidade selecionada, datas da reserva/disponibilização, prazo vigente e eventual realização. Antes de realizada, permite registrar o fato usando as ações com autorização histórica já implementadas; depois, abre a nota/conferência com autoria preservada. Não abre o consolidado nem o plano inteiro. Revogação ou oficialização retiram a tarefa da fila e encerram o acesso por designação; histórico próprio continua na consulta de notas.

Validação: 51 integrações de lançamentos aprovadas. Cenários de designação agora verificam fila antes/depois da realização, detalhe da habilidade atribuída, negação de outra habilidade, ausência de campos privados, remoção após revogação e oficialização e bloqueio de gestão sem papel docente/usuário inativo. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-fila-recuperacao-268-2026-09-13.json. Sem migration adicional; última regressão integral 265.

Pendências: regularização de realização antiga por terceiro, correções, oportunidades extras, faltas/cancelamentos do aluno, exceções contratuais, integração com agenda e comunicação/portal. Preferência global de fuso ainda não integrada às novas telas. Sem homologação interativa, produção ou envio externo. Escopo completo permanece em implementação.

## Incremento 267 — Gestão da designação de recuperação pela interface, 13/09/2026

Rota /academico/recuperacoes/tentativas/[itemReservaId]/designacao permite à Gestão Pedagógica/Administração consultar e alterar o avaliador de um item, a partir da operação do plano. Consulta transacional revalida o papel antes de projetar identificação mínima, professor realizador, designação atual e histórico paginado em 20. Busca de professores ativos por nome, limitada a 50 com indicação para refinar; sem contatos ou credenciais. Atual professor inativo/sem papel docente é sinalizado, preservando o histórico.

Formulário exige escolha explícita e motivo; permite revogação, usa versão esperada e conserva a chave em reenvio incerto do mesmo conteúdo. Ação e trigger existentes continuam conferindo pendência/versão/alvo. Item sem pendência fica em leitura, inclusive depois de oficialização; não oferece busca/alteração. Link administrativo aparece somente para gestão na operação do plano. Não altera autoria, turma, prazo ou saldo.

Validação: 51 integrações de lançamentos aprovadas; cenário de designação ampliado para consultar candidatos, busca sem resultado, leitura negada ao professor, versão atual/revogação/histórico anterior e bloqueio de edição após oficialização, sem campos privados. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-tela-designacao-recuperacao-267-2026-09-13.json. Sem migration adicional; última regressão integral 265.

Pendências: fila própria e acesso da tentativa para o professor designado antes da realização; regularização de realização antiga por terceiro, correções, extras, ocorrências do aluno, exceções e agenda. Sem homologação interativa, produção ou envio externo. Objetivo completo permanece em implementação.

## Incremento 266 — Designação docente limitada à tentativa de recuperação, 13/09/2026

Gestão designa/revoga professor ativo para item/habilidade de uma reserva, com motivo, versão e idempotência. Designações são imutáveis; troca e revogação preservam o histórico. Item cancelado sem realização ou com nota já oficializada não recebe nova designação. Não reinicia prazo, reserva ou cota e não transfere titularidade da turma. Migration 124 (20260913220000_designacao_recuperacao), aplicada ao banco local descartável, acrescenta DesignacaoRecuperacao e guardas equivalentes no banco.

Professor designado registra realização somente com autorização vigente e válida no instante informado, mantendo a elegibilidade histórica/contratual e o prazo. Também pode registrar nota de realização feita por outro professor, preservando o professor realizador e o autor de cada versão da nota. Oficialização exige pessoa distinta de ambos. Consulta e lista de notas incluem apenas realizações designadas ou histórico próprio, sem abrir consolidado, plano inteiro ou outra habilidade. Revogação retira escrita; realizações/notas próprias permanecem em leitura. A tela da nota identifica separadamente o professor realizador. Designação deixa de conceder acesso a pendência ao oficializar, preservando apenas os demais acessos legítimos.

Validação: 51 integrações de lançamentos aprovadas, incluindo professor sem poder de designação, idempotência, nota por substituto com autoria preservada, negação de acesso ao plano/consolidado e habilidade não atribuída, revogação, impedimento de ambos os autores na oficialização, bloqueio após oficialização, imutabilidade, realização antes da designação negada, realização após designação aceita e usuário inativo bloqueado. TypeScript, lint direcionado e schema diff vazio aprovados; build Next.js aprovado. Evidência: docs/validacao-designacao-recuperacao-266-2026-09-13.json. Última regressão integral 265.

Limites: ainda faltam consulta/tela administrativa de designação e fila de tentativas designadas para permitir descobrir e operar a atribuição antes da realização. Acesso direto à nota já realizada está integrado. Regularização de realização antiga atribuída a terceiro, correções, oportunidades extras, ocorrências do aluno, exceções e agenda permanecem pendentes. Sem homologação interativa, produção ou envio externo. Objetivo total permanece aberto.

## Incremento 265 — Regressão completa após os fluxos de recuperação, 13/09/2026

Executada regressão integral do código atual: 771 testes unitários e 629 integrações aprovados, sem falhas ou testes pendentes. A integração foi executada em processo único no PostgreSQL local descartável. Tipos aprovados e schema diff vazio, com 123 migrations aplicadas. Lint completo sem erros e três avisos preexistentes de react-hooks/set-state-in-effect em FinanceiroPainel/Sidebar. Build do mesmo código validado no incremento 264, Next.js 16.3.5, 51 páginas estáticas. Evidência por arquivo: docs/validacao-regressao-265-2026-09-13.json.

Esta regressão substitui 245 como referência integral mais recente. A suíte abrange somente o comportamento coberto pelos testes existentes; não demonstra conclusão dos requisitos ainda pendentes, homologação interativa, operação dos provedores externos ou migração real. A leitura atual de src/server/matricula/entrada-ativacao.ts confirma bloqueio explícito da ativação de particulares no fluxo legado; src/server/matricula/encerramento-rascunho.ts preserva uma versão de trabalho, sem constituir execução final do encerramento. Essas pendências continuam abertas. Nenhum código de produto foi alterado neste incremento e nenhum envio externo foi realizado. A execução do objetivo completo continua aberta.

## Incremento 264 — Prorrogação pela interface, 13/09/2026

Rota /academico/recuperacoes/planos/[propostaId]/prorrogacoes conecta proposta e decisão de extensão do prazo, com navegação pela operação do plano. Exibe prazo original, vigente e histórico paginado em 20 propostas, autoria, justificativa e decisão. Professor atual/gestão propõe; outra pessoa da gestão decide. Autoaprovação não aparece mesmo com papéis acumulados. Aprovação exige versão mais recente, base igual ao prazo vigente, novo prazo posterior e futuro e matrícula ativa; ação revalida sob bloqueio.

Novo prazo é informado em data/hora e fuso explícito, convertido no servidor. A interface conserva chave em reenvios incertos e registra uma nova proposta somente conforme a versão esperada. Prazo original não é sobrescrito, rejeição conserva o vigente e proposta sozinha não muda o prazo nem concede tentativas. Matrícula não ativa não recebe nova proposta por esta tela; autorização específica permanece fluxo próprio. Consulta autoriza o vínculo antes de projetar os dados; hash só aparece para decisão permitida e dados de contato/financeiro não são consultados.

Validação: 49 integrações de lançamentos aprovadas. Cenários de prorrogação agora verificam a consulta sem disponibilização, proposta pela conversão de America/Costa_Rica, reenvio coerente com a ação original, visibilidade de autoaprovação, versão superada/paginação, hash de decisão, prazo vigente após aprovação, preservação do original e professor não atribuído negado. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-interface-prorrogacao-264-2026-09-13.json. Sem migration adicional. Última regressão integral 245.

Limites: comunicação da nova data ao aluno ainda não automatizada; exibição usa UTC explícito, sem preferência global integrada. Designação, correções, oportunidades extras, faltas/cancelamentos do aluno, exceções e integração com agenda permanecem pendentes. Sem homologação interativa, produção ou envios externos. Objetivo completo ainda em implementação.

## Incremento 263 — Operação do plano aprovado pela interface, 13/09/2026

Rota /academico/recuperacoes/planos/[propostaId] conecta o plano aprovado às ações existentes de disponibilização, reserva de tentativas, realização por habilidade e cancelamento pela escola. Exibe identificação mínima, aprovação, condições/evidência de comunicação, prazo original e vigente, limite/consumo/reserva/disponibilidade por habilidade e reservas paginadas em 20. Realização possui link para nota/conferência. A reserva de oportunidade não agenda um encontro; a ligação à agenda permanece pendente.

Gestão registra disponibilização e reserva; professor atual registra realização; gestão cancela pendências da escola. Autorizações e requisitos são novamente conferidos pelas ações. As notas/fontes e o vínculo são conferidos antes de apresentar avanço. O saldo inclui todas as versões do plano na matrícula/nível, preserva consumo realizado após cancelamento parcial e libera apenas itens pendentes. Nenhum valor de cota ou prazo foi presumido. Realização e disponibilização aceitam data/hora e fuso informado, convertidos no servidor com rejeição de horário inválido/ambíguo. Leitura de datas segue UTC explicitamente nesta tela; preferência global ainda não integrada. Comunicação é evidência registrada pela equipe, sem envio automático.

Validação: 49 integrações de lançamentos aprovadas, incluindo plano ainda não aprovado, disponibilidade e flags por papel, conversão de America/Sao_Paulo para o instante persistido, fuso inválido, reserva/realização/cancelamento parcial e saldo exato por habilidade, dados privados ausentes e professor não atribuído negado. TypeScript, lint direcionado e build Next.js aprovados. Sem migration adicional. Evidência: docs/validacao-operacao-recuperacao-263-2026-09-13.json.

Pendências: telas de prorrogação, designação de substituto, correções, oportunidades extras, faltas/cancelamentos do aluno e exceções de matrícula; integração com agenda e comunicação/portal. Sem homologação interativa, produção ou envio externo. Última regressão integral 245. O fluxo implementado não prova entrega integral do módulo nem do projeto.

## Incremento 262 — Preparação e revisão de planos pela equipe, 13/09/2026

Rota /academico/recuperacoes/planos?alocacaoId=... permite consultar o consolidado, preparar estratégia/avaliação proposta por habilidade e decidir planos. Navegação a partir da matrícula acadêmica. As habilidades insuficientes são obrigatórias; quando só falta a média geral, a equipe escolhe quais trabalhar. Quantidades, pesos, mínimos e prazos não recebem valores presumidos. Proposta usa a ação e idempotência existentes, com versão esperada e chave conservada em reenvio de resultado incerto.

Consulta autoriza primeiro o consolidado, depois projeta identificação mínima e planos do vínculo. Não concede leitura dos planos ao professor sem atribuição atual; histórico próprio de notas continua nas telas específicas. Lista 20 propostas por página, preservando base numérica e atividades de cada versão. Gestão independente recebe hash apenas para decisão; preparador não recebe ação para autoaprovar. Tela sinaliza mudança das fontes, limita aprovação à versão atual com vínculo/regra válidos, notas insuficientes e limite configurado positivo. A ação de decisão revalida essas condições. Aprovação de plano não reserva tentativa nem disponibiliza prazo automaticamente.

Validação: 48 integrações de lançamentos aprovadas. Novo cenário verifica ausência de nota impedindo proposta, insuficiência permitindo, base preservada, autoaprovação indisponível com papéis acumulados, versão antiga sem aprovação, paginação por versão, decisão pelo hash consultado, professor não atribuído/inativo negados e ausência de contato/financeiro/chave de idempotência. TypeScript, lint direcionado e build Next.js aprovados. Sem migration adicional. Evidência: docs/validacao-planos-recuperacao-262-2026-09-13.json.

Pendências: telas de disponibilização, reserva e realização ainda precisam ser conectadas ao plano aprovado; também permanecem designação específica, correção, oportunidades extras, faltas/cancelamentos do aluno e autorização de exceções. Sem homologação interativa, produção ou envio externo. Última regressão integral 245. Escopo completo ainda em implementação.

## Incremento 261 — Consulta e telas de notas de recuperação, 13/09/2026

Entrega consultas autorizadas e duas rotas: /academico/recuperacoes?alocacaoId=... lista realizações do vínculo, inclusive sem nota; /academico/recuperacoes/[realizacaoId] apresenta identificação mínima da matrícula, habilidade, evidência, escala, histórico e formulários de lançamento/conferência. Navegação a partir das avaliações da matrícula. Listagem paginada em 50 e histórico em 20, com continuação explícita. Datas identificadas em UTC nesta tela; preferência de visualização ainda não integrada.

Servidor revalida usuário ativo e papéis sob bloqueio do vínculo. Gestão e professor atual consultam o vínculo; ex-professor ativo consulta somente realizações próprias e suas versões, sem escrita. Professor não atribuído e usuário inativo não consultam. Campos de contato e financeiro não são projetados. Hash da versão só é entregue quando há permissão de decisão; chave de idempotência não é exposta. Formulários usam as ações do incremento 260, com nova conferência no servidor. Aprovação exige seleção explícita e motivo; versão antiga não oferece aprovação. Rascunhos aceitam nota ausente; submissão exige nota na escala. Reenvio após resultado incerto conserva chave enquanto o conteúdo não muda.

Validação: 47 integrações de lançamentos aprovadas; cenário de saída repetido após remover o papel de gestão do professor. Cobertura inclui realização sem nota na lista, autoria, gestão sem lançamento docente, visibilidade das ações/hash, campos privados ausentes, ex-professor em leitura e bloqueio de inativo. TypeScript e lint direcionado aprovados; build Next.js aprovado. Evidência: docs/validacao-telas-recuperacao-261-2026-09-13.json.

Limites: não houve homologação interativa em navegador. A criação/decisão de planos, reserva e realização ainda precisam das próprias telas; este incremento permite trabalhar nas realizações já registradas. Designação de substituto, correções e exceções continuam pendentes. Descoberta de vínculos exclusivamente por histórico de recuperação ainda deve ser integrada ao painel geral. Nenhuma migration adicional, produção, envio externo ou conclusão do objetivo total.

## Incremento 260 — Notas de recuperação e consolidação, 13/09/2026

Cada realização por habilidade recebe versões imutáveis de nota e comentário destinado ao aluno: rascunho pode não ter nota; submissão exige valor na escala da regra vinculada ao plano. Professor que realizou, com atribuição vigente, registra. Outra pessoa da Gestão Pedagógica/Administração confere a versão e seu hash; acúmulo de papéis não autoriza autoaprovação. Reenvio exato confirma o registro anterior. Nota já oficializada não recebe edição comum; correção própria permanece pendente.

A habilidade realizada recebe nota mesmo quando a escola cancelou os demais itens da reserva. O consolidado carrega notas do vínculo, matrícula, nível e regra corretos, vinculadas a planos aprovados. Notas não oficializadas não melhoram resultado; após conferência, aplica o maior entre resultado vigente e nota de recuperação. Preserva notas regulares, todas as tentativas e fontes das versões/decisões. Novas propostas de recuperação passam a considerar o consolidado com recuperações; mudanças nas fontes invalidam a revisão anterior. A tela de acompanhamento apresenta resultado regular, notas de recuperação, pendências e resultado vigente. Continua sem fechamento, frequência ou progressão automática.

Migration 123 (20260913210000_notas_recuperacao), aplicada somente ao banco local descartável: NotaRecuperacao e DecisaoNotaRecuperacao, autoria, versões, idempotência, imutabilidade, escala e aprovação independente também protegidas por triggers.

Validação: 47 integrações de lançamentos e 27 testes do cálculo aprovados; TypeScript, lint direcionado e schema diff vazio. Build Next.js 16.3.5 aprovado com 49 páginas estáticas; verificação final de tipos cobre o acréscimo posterior dos identificadores das fontes. Casos novos incluem cancelamento parcial, rascunho/submissão, escala inválida na ação e SQL, professor não atribuído, gestão sem lançamento docente, autoaprovação negada também em SQL, hash incorreto, idempotência, nota inferior preservada sem redução, proibição de edição da oficial e imutabilidade. Evidência: docs/validacao-notas-recuperacao-260-2026-09-13.json. Última regressão integral: 245.

Limites: ainda faltam consultas/telas próprias para preparar e conferir notas de recuperação, designação do substituto para esse fluxo, correções de nota de recuperação, autorização específica após pausa/encerramento, faltas/cancelamentos do aluno, oportunidades extras e ligação com agenda. Realização sem versão de nota ainda deve entrar na futura conferência de pendências de fechamento; não é prova de resultado final. Sem homologação interativa, produção ou envios externos. O objetivo completo permanece em implementação.

## Incremento 259 — Realização e consumo por habilidade, 13/09/2026

Professor titular com atribuição vigente registra a realização de cada habilidade reservada, com data e evidência. Confere reserva não cancelada, período após reserva/disponibilização e antes do prazo autorizado na data da realização, vínculo histórico do aluno/docente e situação contratual nessa data. Prorrogação aprovada depois do fato não é usada para autorizar retroativamente a realização. Repetição exata confirma o mesmo registro; alteração exige futuro fluxo de correção.

Realização imutável consome apenas o item/habilidade correspondente. Itens realizados continuam ocupando a cota mesmo quando a escola cancela o restante da reserva; cancelamento libera somente habilidades pendentes. Reserva inteiramente realizada não pode ser liberada, inclusive por SQL. A mesma reserva pode agrupar habilidades realizadas em momentos distintos, sem antecipar consumo das demais.

Migration 122 (20260913200000_realizacao_recuperacao), aplicada somente ao banco local descartável, cria o registro de realização e adapta limite/cancelamento. Função de prazo na data considera somente extensões aprovadas até o instante da avaliação. Servidor mantém a conferência contratual histórica; matrícula encerrada sem histórico suficiente continua exigindo conferência própria.

Validação: 46 integrações de lançamentos aprovadas. Casos novos verificam professor/gestão, datas anterior à reserva e futura, realização idempotente, evidência preservada, consumo individual, cancelamento parcial sem devolução de consumo, limites separados, bloqueio da realização de item cancelado, ausência de alteração automática da nota, evento e imutabilidade. Caso de realização integral confirma negativa de cancelamento na ação e no SQL. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-realizacao-recuperacao-259-2026-09-13.json.

Limite: ainda não registra nota de recuperação nem sua conferência independente. Ao implementar notas, a habilidade já realizada deve continuar recebendo seu resultado mesmo se outras habilidades da reserva foram canceladas; não usar o cancelamento do agrupamento para apagar a realização. Substituição/designação do avaliador de recuperação, correção da ocorrência, falta/cancelamento do aluno, extras, agenda e telas permanecem pendentes. Não altera frequência, mensalidade ou progressão. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 258 — Prorrogação independente do prazo, 13/09/2026

Professor com atribuição vigente ou Gestão Pedagógica/Administração propõe extensão do prazo de uma disponibilização, identificando prazo anterior, novo limite futuro, versão esperada e motivo. Outra pessoa da gestão aprova ou rejeita. Aprovação exige proposta mais recente e base ainda igual ao prazo vigente; preserva proposta/decisão e não edita a disponibilização original. Repetições idempotentes não criam outra extensão.

Prazo efetivo é a última extensão aprovada, com fallback para o limite original. Consulta transacional e função SQL usam essa referência ao conferir novas reservas. Rejeição, proposta pendente ou superada não altera prazo. Extensão não reinicia cota, consome tentativa, concede oportunidade extra ou libera matrícula pausada/encerrada.

Migration 121 (20260913190000_prorrogacao_recuperacao), aplicada somente ao PostgreSQL local descartável, protege propostas/decisões e confere papel, atribuição, independência, versão e datas em UTC. Eventos ProrrogacaoRecuperacaoProposta/Aprovada/Rejeitada preservam referências e motivo no alcance da matrícula.

Validação: 44 integrações de lançamentos aprovadas. Casos novos cobrem repetição, autoaprovação na ação e no SQL, aprovação independente, prazo efetivo igual na aplicação e no banco, original preservado, reserva dentro do intervalo estendido com relógio da aplicação controlado, imutabilidade, proposta superada e rejeição sem mudança do limite. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-prorrogacao-recuperacao-258-2026-09-13.json.

Limite: ainda não comunica automaticamente o novo prazo ao aluno, não resolve indisponibilidade posterior por conta própria e não oferece tela. Agendamento/aplicação, resultados, consumo, faltas/cancelamentos do aluno, oportunidades extras e demais fluxos seguem pendentes. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 257 — Disponibilização e prazo do plano, 13/09/2026

Gestão registra quando o plano aprovado foi disponibilizado ao aluno, as condições oferecidas e a evidência da comunicação. A data não pode anteceder a aprovação nem ser futura. A ação reconfere vínculo, matrícula e fontes de notas; prazo em minutos vem da regra vinculada e gera data-limite explícita. Registro único/imutável impede reiniciar a contagem por edição; repetição exata confirma o mesmo registro.

Nova reserva exige disponibilização registrada e instante atual anterior ao limite, na ação e no banco. No instante limite, novas reservas ficam bloqueadas. Isso não consome uma reserva anterior nem cria falta, nota zero ou conclusão. Migração 120 (20260913180000_disponibilizacao_recuperacao), aplicada somente ao PostgreSQL local descartável, valida papel, aprovação, datas, cálculo do prazo e os textos de condições/comunicação. Comparações SQL usam UTC explicitamente.

Validação: 42 integrações de lançamentos aprovadas. Caso novo confere reserva bloqueada antes da disponibilização, datas anterior à aprovação/futura rejeitadas, cálculo pelo parâmetro fictício da regra de teste, idempotência, negativa à edição, bloqueio no instante limite com relógio da aplicação controlado, evento único e imutabilidade. Fixtures dos fluxos de reserva agora registram a disponibilização explicitamente. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-disponibilizacao-recuperacao-257-2026-09-13.json.

Limite: registra comunicação realizada pela escola e sua evidência; não envia mensagem ou disponibiliza portal automaticamente. Ainda faltam prorrogação independente, tratamento de indisponibilidade posterior, agendamento/aplicação, consumo e resultado, cancelamento do aluno/falta e telas. Reservas anteriores ao vencimento permanecem no histórico/cota até movimento próprio. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 256 — Cancelamento da tentativa pela escola, 13/09/2026

Gestão Pedagógica/Administração pode cancelar a tentativa reservada por iniciativa da escola, com motivo e evidência. Cancelamento é único e imutável, separado da reserva e de seus itens; libera todas as habilidades daquele agrupamento na contagem da cota, sem apagar histórico ou criar consumo. Repetição exata confirma a decisão existente; conteúdo diferente não a substitui. Repetir a criação original da reserva também não reabre a reserva cancelada.

Migration 119 (20260913170000_cancelamento_reserva_recuperacao), aplicada somente ao banco local descartável, registra o cancelamento e altera a contagem de itens ocupados no trigger de limite. Nova reserva usa apenas itens não cancelados; a reserva cancelada não recebe outros itens, inclusive por gravação direta. Liberação e nova reserva são serializadas pela matrícula. Evento TentativaRecuperacaoCanceladaPelaEscola preserva reserva, proposta, cancelamento, habilidades, motivo e autoria.

Validação: 41 integrações de lançamentos aprovadas. Caso novo esgota fala/escrita, cancela uma reserva, confere devolução única e aceita uma substituta, voltando a impedir excesso. Verifica negativa ao professor, idempotência, preservação dos itens, evento único, imutabilidade e bloqueio de novos itens na reserva cancelada. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-cancelamento-recuperacao-256-2026-09-13.json.

Limite: cancelamento institucional da tentativa reservada ainda não altera agenda externa ou encontros da turma; quando houver agendamento vinculado, integrar suas aprovações e efeitos. Não trata cancelamento do aluno, falta ou realização, que ainda precisam de consumo/liberação e conferência temporal próprios. Antes de adicionar consumo/resultado, impedir este cancelamento em tentativa já realizada/consumida; esses registros ainda não existem nesta etapa. Prazos, extras, resultados e telas continuam pendentes. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 255 — Reserva de tentativas por habilidade, 13/09/2026

Gestão Pedagógica/Administração pode reservar uma tentativa para habilidades identificadas de um plano aprovado. A ação reconfere hash, aprovação, vínculo ativo, matrícula, regra e notas/fontes atuais; restringe a reserva às habilidades do plano. Reserva agrupa itens por habilidade, com autoria, motivo e idempotência. Contagem pertence à matrícula e ao nível e atravessa versões do plano, sem reiniciar a cota ao editar uma proposta.

Migration 118 (20260913160000_reserva_tentativa_recuperacao), aplicada somente ao banco local descartável, preserva reservas/itens contra edição ou exclusão, exige plano aprovado e gestão ativa na reserva e confere habilidade/limite também no banco. Trava da matrícula serializa concorrência para a cota. Evento TentativaRecuperacaoReservada identifica reserva, proposta, nível e habilidades na matrícula.

Validação: 40 integrações de lançamentos aprovadas. Casos novos verificam papel, aprovação, habilidade fora do plano, idempotência, evento e imutabilidade, além de duas reservas concorrentes disputando a última oportunidade: apenas uma é aceita. Nova versão do plano não libera outra tentativa de fala esgotada, enquanto escrita mantém sua própria disponibilidade; tentativa direta no SQL também é rejeitada ao exceder o limite. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-reserva-recuperacao-255-2026-09-13.json.

Limite: reservas ainda não têm realização, consumo definitivo, liberação por cancelamento, falta, extras aprovados ou prazo de disponibilização. Neste estágio, todos os itens reservados permanecem ocupando a cota; implementar movimentos de consumo/liberação preservando esse registro antes de operar o ciclo completo. Reserva não cria nota, presença, cobrança ou agendamento. Telas e integração de resultados de recuperação permanecem pendentes. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 254 — Decisão independente do plano de recuperação, 13/09/2026

Ação de decisão permite a outra pessoa da Gestão Pedagógica/Administração aprovar ou rejeitar a proposta identificada por versão/hash. Aprovação reconfere vínculo ativo, matrícula, regra, versão mais recente e snapshot de notas/fontes dentro da transação coordenada com os lançamentos. Correção de nota posterior à proposta exige nova preparação. Confere também que a regra prevê tentativas positivas nas habilidades propostas; oportunidades extras continuam exigindo fluxo próprio.

Migration 117 (20260913150000_decisao_plano_recuperacao), aplicada somente ao banco local descartável, cria decisão única e imutável por proposta. Banco confere gestão ativa, independência em relação ao preparador, versão e vínculo. Repetir a mesma decisão confirmada retorna o resultado anterior; tentar outra decisão não o substitui. Eventos PlanoRecuperacaoAprovado/PlanoRecuperacaoRejeitado ficam vinculados à matrícula, com proposta, decisão, versão e motivo.

Validação: 38 integrações de lançamentos aprovadas. Casos novos cobrem autoaprovação na ação e no SQL, hash incorreto, aprovação independente, idempotência, imutabilidade, versão superada e invalidação por correção oficial de nota, com rejeição ainda possível. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-decisao-recuperacao-254-2026-09-13.json.

Limite explícito: decisão aprova o plano pedagógico, mas não libera nem reserva uma tentativa, inicia prazo ou publica resultado. Saldo disponível, reservas/consumos, oportunidades extras, disponibilização, aplicação, notas e telas ainda precisam ser implementados. Antes da liberação, reconferir condições e saldo; limite positivo configurado não comprova saldo disponível. Aprovação com base no consolidado regular também não substitui futura integração de recuperações anteriores. Q135 e o fluxo completo permanecem parciais. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 253 — Proposta de plano de recuperação no servidor, 13/09/2026

Professor titular com atribuição vigente ou Gestão Pedagógica/Administração pode preparar proposta para matrícula/alocação ativa. O consolidado regular foi extraído para uma função transacional compartilhada, conservando autorização e cálculo; a proposta obtém esse resultado dentro da mesma transação bloqueada. Registra matrícula, nível, regra, preparador, versão, estratégias e avaliações propostas por habilidade, motivo e snapshot das notas oficiais e fontes usadas.

Recusa notas obrigatórias pendentes (segunda chamada não é recuperação), resultados suficientes, habilidades repetidas e omissão de habilidade abaixo do mínimo. Se faltar somente atingir a média geral, a proposta identifica quais habilidades serão trabalhadas. Com média geral suficiente, limita o plano às habilidades individualmente insuficientes. Chave idempotente e versão esperada impedem repetição acidental e gravação sobre versão mais recente.

Migration 116 (20260913140000_proposta_recuperacao) aplicada somente ao banco local descartável. Preserva propostas contra alteração/exclusão, confere papel/atribuição e vínculo de matrícula, nível e regra, com sequência de versões por matrícula/nível. Evento PlanoRecuperacaoProposto pertence à matrícula e identifica proposta, regra, nível, versão e habilidades.

Validação: 36 integrações de lançamentos aprovadas. Três casos novos verificam cobertura das habilidades insuficientes, snapshot/autoria, idempotência, versão, imutabilidade, negativa a professor sem atribuição, pendência de nota, notas suficientes e recuperação direcionada quando só a média geral é insuficiente. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-proposta-recuperacao-253-2026-09-13.json.

Limite: proposta ainda não tem decisão independente, reserva/consumo de tentativas, prazo de disponibilização, realização/resultado ou tela. Não autoriza recuperação, altera notas ou inicia prazo. O snapshot atual cobre resultados regulares; integrar recuperações oficiais e revalidar fontes antes da futura aprovação. Q132/Q135 e demais regras de recuperação permanecem parciais. Segunda chamada, autorizações Q151, equivalência, frequência, fechamento, portal e demais frentes seguem pendentes. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 252 — Histórico do realizador anterior, 13/09/2026

Consulta e painel histórico reconhecem tanto autoria do lançamento quanto autoria da realização. Professor sem atribuição atual pode ler as versões que registrou ou efetivamente realizou, inclusive quando outro avaliador designado regularizou as notas. O filtro é aplicado em cada versão: uma versão posterior realizada e registrada pelo substituto não entra nesse histórico apenas por compartilhar a avaliação.

O acesso continua exigindo professor ativo e não concede edição, conferência, consolidado do nível, outras avaliações ou versões de terceiros. Gestão/titular/designado vigente conservam seus escopos próprios. Histórico anterior sem realizadaPorId segue reconhecendo autorId.

Validação: 33 integrações de lançamentos aprovadas. Novo caso encerra o vínculo do titular, registra sua avaliação por substituto e depois cria uma versão própria do substituto; confere leitura apenas da primeira, autoria de ambos, descoberta na lista/painel e negativas de edição, consolidado e outro código. TypeScript e lint direcionado aprovados; ajustada a tipagem do helper de teste para aceitar a entrada completa da ação. Evidência: docs/validacao-historico-realizador-252-2026-09-13.json. Sem alteração de tela ou migration; último build 251, última regressão integral 245.

Dependência verificada: encerramento contratual ainda tem solicitação e rascunho de acerto, sem registro final aplicado que comprove a data efetiva. Por isso, o leitor de situação contratual continua exigindo conferência para matrículas encerradas; esta etapa não presume uma data a partir do pedido. Q151 completo depende desse fluxo e das autorizações específicas. Recuperação, segunda chamada, equivalência, frequência, fechamento, portal e demais frentes continuam pendentes. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 251 — Lançamento pelo substituto e autoria histórica, 13/09/2026

Avaliador com designação vigente pode lançar a avaliação atribuída. Servidor e banco conferem a atribuição atual do registrador e a atribuição do realizador na data informada (vínculo docente ou designação histórica válida). Regularizar trabalho de outro professor exige designação vigente, identificação do realizador, motivo e evidências textuais. Autoria da realização e do lançamento ficam separadas na versão imutável e no hash do conteúdo conferido. Registros antigos e seus hashes permanecem intactos, com campos novos opcionais para o histórico anterior.

Tela permite escolher o realizador entre os docentes vinculados/designados à avaliação e informar motivo/evidências quando outra pessoa a realizou. Histórico apresenta ambas as autorias e os dados da regularização. Revogação bloqueia novos lançamentos do substituto sem outro vínculo vigente; nota oficial continua exigindo correção independente. Conferência não pode ser feita nem pelo registrador nem pelo realizador, mesmo acumulando papel de gestão. Eventos de rascunho/submissão acrescentam realizadaPorId e indicador regularizacao, mantendo os textos na versão protegida.

Migrations 114/115 (20260913120000_autoria_avaliacao e 20260913130000_utc_autoria_avaliacao) aplicadas somente ao PostgreSQL local descartável. O teste com realização atual encontrou comparação incorreta entre timestamp UTC e clock_timestamp no fuso da sessão America/Sao_Paulo; migration 115 torna explícita a referência UTC nessas funções. Não houve alteração global de fuso do banco.

Validação final: 62 integrações acadêmicas aprovadas em execução única dos quatro arquivos (32 lançamentos, 14 migração de regra, 6 vínculo e 10 regras). Novos casos cobrem realização pelo designado, regularização de titular anterior, exigência de motivo/evidência, repetição idempotente, autoria preservada, bloqueio de conferência pelos dois participantes e rejeição de gravação direta após revogação. Primeiro ensaio de lançamentos teve 31 aprovações e uma falha de fuso, depois corrigida. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-autoria-avaliacao-251-2026-09-13.json.

Q152 avançou para avaliações regulares identificadas; ainda não comprova os fluxos completos de recuperação/segunda chamada ou autorização específica de Q151. Regularização histórica com matrícula encerrada ainda depende da situação contratual conferida; não há liberação automática. Equivalência, frequência, oportunidades, fechamento, portal e demais frentes da SPEC seguem pendentes. Última regressão integral permanece 245. Homologação interativa ainda não realizada. Sem produção, dados reais ou envio externo.

## Incremento 250 — Gestão de designações pela interface, 13/09/2026

Detalhe da avaliação oferece à Gestão Pedagógica/Administração a tela de designações, identificando matrícula, aluno, oferta, turma e avaliação. A consulta própria exige papel de gestão atualizado e valida a regra/vínculo. Exibe última designação e histórico paginado com professor, gestor, motivo e data; não retorna chaves de idempotência, hashes, contatos ou credenciais.

Equipe busca professores ativos por nome (até 50 resultados, com indicação para refinar a busca), seleciona novo responsável ou revogação explícita e informa motivo. A ação existente revalida papel, versão esperada e estado da avaliação. Formulário conserva chave de idempotência ao repetir tentativa de resultado incerto; mudar os dados gera nova tentativa. Oficialização deixa a tela somente para histórico e retira opções de alteração.

Validação: 30 integrações de lançamentos aprovadas. Novo caso verifica negativa ao professor, seleção apenas de docentes ativos, contexto da matrícula, histórico/autoria, paginação, ausência de campos internos e bloqueio após oficialização. TypeScript, lint direcionado e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-tela-designacoes-250-2026-09-13.json.

Sem migration nova; última regressão integral permanece 245. Q152 continua parcial: falta lançamento pelo substituto com autoria da realização separada da autoria da regularização histórica; a tela e consulta não habilitam escrita por consequência. Demais fluxos acadêmicos e frentes da SPEC seguem pendentes. Build não substitui homologação interativa, ainda não realizada. Sem produção, dados reais ou envio externo.

## Incremento 249 — Consulta limitada do avaliador designado, 13/09/2026

Q152 avança da persistência para a consulta: professor ativo com a designação mais recente consulta as versões da avaliação pendente atribuída, com autoria original e contexto mínimo da matrícula. A lista do vínculo mostra somente códigos designados ou histórico próprio, salvo acesso já concedido por outro papel/vínculo. Troca ou revogação posterior invalida a designação anterior; conclusão por oficialização encerra esse acesso delegado à pendência. Histórico próprio continua seguindo sua regra de leitura.

Painel de avaliações oferece “Avaliações designadas a mim”, com paginação no banco e conferência da última designação. A consulta não abre avaliações não designadas, outro contrato do mesmo aluno, consolidado do nível ou permissões de gestão. Conferência do usuário/papel atual e das designações ocorre na transação coordenada com as alterações do vínculo.

Validação final: 29 integrações de lançamentos aprovadas, incluindo consulta, identidade/autoria, isolamento de código e matrícula, negativa do consolidado, painel/paginação, troca/revogação, retirada de papel, inativação e encerramento do acesso delegado após oficialização. Primeiro ensaio encontrou enum incorreto no fixture do teste (SECRETARIA); corrigido para SECRETARIA_ACADEMICA antes das reexecuções. TypeScript, lint direcionado e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-acesso-avaliador-249-2026-09-13.json.

Não há migration nova. Última regressão integral permanece 245. Falta liberar escrita pelo substituto com distinção entre quem realizou a avaliação e quem registra a regularização histórica, bem como a interface de gestão das designações. Q152 segue parcial. Demais fluxos acadêmicos e frentes da SPEC permanecem em implementação; não houve homologação interativa, produção, dados reais ou envio externo.

## Incremento 248 — Registro da designação de avaliador, 13/09/2026

Primeira parte de Q152: Gestão Pedagógica/Administração pode registrar um professor ativo para uma avaliação pendente identificada por matrícula, alocação e código da avaliação. A designação é versionada, com motivo, autoria, chave de idempotência e controle de versão esperada. Revogar cria uma nova versão com destinatário vazio; não apaga a designação anterior. Não troca o professor titular da turma nem a autoria dos lançamentos anteriores.

Migration 113 (20260913110000_designacao_avaliacao) protege registros contra atualização/exclusão e confere gestão ativa, professor ativo, sequência de versões e ausência de nota oficial. A ação também confere regra, avaliação e vínculo correspondente. Registro criado somente para designação já impede a migração da regra da turma pelo bloqueio conservador existente; revisar esse caso antes de oferecer migração de regra com designações pendentes.

Validação: 27 integrações de lançamentos aprovadas, incluindo designação/revogação, repetição idempotente, preservação de titular/autoria, imutabilidade e rejeição de solicitante sem papel, destinatário sem papel docente, avaliação inexistente e avaliação oficializada. TypeScript, lint direcionado e schema diff vazio aprovados. Evidência: docs/validacao-designacao-avaliacao-248-2026-09-13.json. Migration aplicada somente ao banco local descartável; último build permanece 247 e última regressão integral 245.

Limite explícito: a designação ainda NÃO concede acesso nas consultas, lançamentos ou telas. Falta conectar o avaliador vigente às permissões limitadas da avaliação, preservar a distinção entre responsável pela realização e pelo lançamento histórico e oferecer operação pela interface. Q152 permanece parcialmente implementada. Também permanecem pendentes oportunidades, frequência, equivalência, fechamento, portal e homologação interativa. Sem produção, importação de dados reais ou envio externo.

## Incremento 247 — Identificação da matrícula nas avaliações, 13/09/2026

Detalhe da avaliação, proposta/histórico e revisão da correção exibem identificação consistente de aluno, matrícula, oferta, turma e nível antes da operação. Consulta mínima é executada somente após autorização do vínculo; não inclui contatos ou financeiro. Quando falta código de matrícula, a tela conserva referência única pelo identificador do registro, evitando identificação apenas pelo nome do aluno.

Validação: 25 integrações de lançamentos aprovadas, com asserções adicionais da matrícula correta no histórico de correção e ausência do identificador de outro contrato do mesmo aluno. TypeScript, lint direcionado, diff check e build Next.js 16.3.5 (49 páginas estáticas) aprovados. Após o build, o fallback para matrícula sem código recebeu somente ajuste de apresentação/tipagem, verificado novamente por TypeScript e lint. Evidência: docs/validacao-identificacao-avaliacao-247-2026-09-13.json.

Sem migration nova; banco permanece com 112 migrations. Última regressão integral: 245. Não altera autorização, regras de nota ou situação dos contratos. Pendem resolução das revisões, oportunidades, frequência, equivalência, fechamento, portal e homologação interativa. Sem produção, dados reais ou envio externo.


## Incremento 246 — Integridade do conteúdo de notas no banco, 13/09/2026

Migrations 111/112 (20260913090000_integridade_notas e 20260913100000_corrigir_integridade_notas), aplicadas somente ao banco local descartável, conferem notas contra a regra do registro acadêmico também em gravações diretas. Validam conjunto e unicidade de habilidades, estrutura dos campos, comentário textual limitado, formato decimal e limites da escala. Rascunho permite nota ausente; submissão, correção e aprovação exigem conteúdo completo.

Triggers executam a conferência em lançamento/proposta e novamente na aprovação. A regra é carregada da versão vinculada ao registro, não da publicação mais recente do nível. Histórico existente não é reescrito. As restrições de papel, autoria, independência e imutabilidade anteriores permanecem.

Validação: primeira execução acadêmica teve 35 aprovações/20 falhas devido a alias SQL ambíguo na função nova, corrigido pela migration 112. Reexecução dos quatro arquivos acadêmicos passou 55 testes (25 lançamentos, 14 migração de regra, 6 vínculo e 10 regras). Cinco casos novos tentam inserir diretamente nota fora da escala, habilidade diferente, número JSON em vez de decimal textual, comentário em objeto e campo extra; cada caso verifica lançamento e correção, além de confirmar que os registros válidos continuam funcionando. TypeScript, lint direcionado, schema diff vazio e diff check aprovados.

Evidência: docs/validacao-integridade-notas-246-2026-09-13.json. Sem build novo por ser alteração SQL/testes; último build e regressão integral permanecem 245. Banco local agora tem 112 migrations. Não houve produção, dados reais ou envio externo. A integridade adicional não conclui resolução das revisões acadêmicas, oportunidades, frequência, equivalência, fechamento, portal ou homologação interativa.


## Incremento 245 — Regressão integral após avaliações e correções, 13/09/2026

Executadas as suítes completas contra o estado atual do código: 771 testes unitários e 600 integrações aprovados, sem falhas ou testes pendentes. Integrações rodaram em um único processo sequencial contra PostgreSQL local descartável; não se trata de soma de reexecuções parciais. Evidência por arquivo: docs/validacao-regressao-245-2026-09-13.json.

Lint completo terminou sem erros, com os três avisos preexistentes de react-hooks/set-state-in-effect: FinanceiroPainel.tsx linhas 116/402 e Sidebar.tsx linha 38. Build Next.js 16.3.5 aprovado com 49 páginas estáticas; TypeScript passou no build. Schema diff vazio em relação às 110 migrations aplicadas. Nenhuma alteração funcional neste incremento; relatórios temporários foram consolidados no artefato versionável.

Esta regressão substitui 235 como referência mais recente de verificação integral. Não prova requisitos ainda não implementados, homologação interativa das telas, integrações externas em operação ou migração de dados reais. Resolução das revisões por correção, oportunidades de avaliação, frequência, equivalência, fechamento, portal e demais frentes da SPEC continuam incompletos. Objetivo integral permanece ativo. Sem produção, dados reais ou envio externo.


## Incremento 244 — Fila de revisões após correção, 13/09/2026

Rota /academico/correcoes, ligada à área acadêmica, lista correções aplicadas com impactos em solicitações aprovadas/executadas. Consulta paginada revalida gestão ativa em transação e apresenta aluno/matrícula, correção, autoria/motivo, turma de destino e situação da solicitação no momento da correção e atualmente. Links conduzem ao histórico de correções e às mudanças acadêmicas da matrícula.

Fila deriva das decisões imutáveis com impactos, sem depender de localizar eventos. Não desfaz movimentações e não registra resolução automaticamente. Fonte atual da solicitação é conferida pelo vínculo de origem; referência ausente/incompatível aparece como pendência de conferência. Professor e Secretaria não recebem acesso à fila de gestão.

Validação: 20 integrações do arquivo de lançamentos aprovadas. Caso novo simula estado preexistente de mudança aprovada, identifica aprovação posterior à prévia, bloqueia hash antigo, aplica após nova revisão e verifica fila, evento e preservação da solicitação. O caso não valida o fluxo de aprovação da transferência. Primeira execução falhou por fixture sem motivo de decisão obrigatório; corrigida e reexecutada com sucesso. TypeScript, lint direcionado, diff check e build Next.js 16.3.5 (49 páginas estáticas e nova rota dinâmica) aprovados. Após o build, houve somente ajuste textual de orientação na página. Evidência: docs/validacao-fila-correcao-244-2026-09-13.json.

Limites: identificação e acompanhamento dos casos entregues; resolução/versionamento da revisão pedagógica e bloqueios correspondentes ainda pendentes. Fila ainda não diferencia casos resolvidos porque essa resolução não foi implementada. Integrações com recuperação, equivalência e fechamento permanecem pendentes, assim como ensaio interativo e preferência global de fuso. Q144 continua incompleto. Sem produção, dados reais ou envio externo. Regressão integral/consolidada de referência: 235.


## Incremento 243 — Telas e histórico de correções, 12/09/2026

Rotas /academico/correcoes/[lancamentoId] e /academico/correcoes/[lancamentoId]/[propostaId] permitem preparar proposta, consultar histórico paginado e revisar notas/impactos antes de decidir. Acesso pelo detalhe da avaliação oficial; professor atual/gestão prepara e outra pessoa da gestão decide. Formulários mantêm chave de reenvio incerto, bloqueiam edição durante envio e atualizam consultas após confirmação.

Consulta do histórico recupera os valores da origem específica de cada proposta. Duas correções sucessivas mostram, por exemplo, 7 para 5 e depois 5 para 6, preservando a referência histórica. Notas vigentes alimentam a nova proposta. Proposta antiga não oferece aprovação na revisão, mas pode ser rejeitada quando ainda pendente e com outro decisor. Motivos, comentários e autoria ficam visíveis no contexto autorizado; chaves de processamento e dados financeiros/contatos são omitidos.

Validação: 19 integrações do arquivo de lançamentos aprovadas, ampliadas com comparação histórica em cadeia, paginação, ausência de campos privados e revogação do acesso de correção após saída docente. TypeScript, lint direcionado, diff check e build Next.js 16.3.5 com 48 páginas estáticas e duas rotas dinâmicas novas aprovados. Evidência: docs/validacao-telas-correcao-243-2026-09-12.json. Sem migration nova.

Limites: telas compiladas e consultas/ações testadas; ensaio interativo ainda pendente. Fila e resolução da revisão de impactos acadêmicos continuam pendentes; referências técnicas de solicitações nessa revisão ainda precisam de apresentação operacional. Datas das correções usam UTC explícito, sem preferência global integrada. Recuperação, equivalência, frequência, fechamento e portal permanecem incompletos. Q144 ainda não está integralmente concluído. Sem produção, dados reais ou envio externo. Regressão integral/consolidada de referência: 235.


## Incremento 242 — Decisão da correção e notas vigentes, 12/09/2026

Migration 110 (20260913080000_decisao_correcao_nota), aplicada ao banco local descartável, cria decisão imutável com aprovador, motivo e impactos. Outra pessoa da Gestão Pedagógica/Administração aprova ou rejeita. Aprovação exige proposta mais recente e origem vigente; chave de origem acompanha a última correção aprovada, permitindo correções sucessivas sem sobrescrever o lançamento original.

Revisão no servidor apresenta notas vigentes/propostas e solicitações acadêmicas aprovadas/executadas do vínculo. Hash dos impactos precisa continuar válido ao aprovar. Decisão e evento são atômicos; repetição da mesma decisão é idempotente, decisões conflitantes concorrentes não produzem dois resultados. Banco protege independência, papel ativo, sequência/origem e imutabilidade.

Consolidado regular passa a usar a última correção aprovada, inclusive quando reduz uma nota incorreta. Fontes identificam a correção utilizada. Detalhe apresenta valores originais e, separadamente, valores vigentes corrigidos para gestão/professor atual. Professor anterior conserva sua leitura histórica sem receber os valores lançados por outros em correções posteriores. Propostas rejeitadas não alteram resultado.

Validação: 19 integrações de lançamentos aprovadas, com nova cobertura de duas correções sucessivas, origem desatualizada, recalculação, autoaprovação no servidor/banco, versão antiga e decisões concorrentes. Reexecução após ampliar a cadeia também passou os 19 casos. TypeScript, lint direcionado, schema diff vazio, build Next.js 16.3.5 (48 páginas estáticas) e diff check aprovados. Evidência: docs/validacao-decisao-correcao-242-2026-09-12.json.

Limites: consulta/decisão de servidor e apresentação do valor vigente prontas, mas formulários de proposta/decisão e histórico completo de correções ainda pendentes. Impactos em mudanças acadêmicas são preservados na decisão e sinalizados por evento; fila operacional e resolução da revisão ainda não implementadas/testadas. Recuperação, equivalência e fechamento precisam participar da revisão ao serem implementados. Não declarar Q144 integralmente concluído. Sem ensaio interativo, produção, dados reais ou envio externo. Regressão integral/consolidada de referência: 235.


## Incremento 241 — Propostas de correção de notas oficiais, 12/09/2026

Migration 109 (20260913070000_proposta_correcao_nota), aplicada somente ao banco local descartável, cria proposta imutável vinculada ao lançamento oficial. Registra versão, autoria, novos valores/comentários, hash da origem e motivo. Professor com atribuição vigente ou gestão pode preparar; professor que saiu conserva somente leitura. Proposta admite reduzir nota incorreta, distinguindo correção de recuperação.

Ação e transação validam origem oficial, hash, escala e conjunto completo das habilidades, rejeitando proposta sem mudança. Chave idempotente e versão esperada impedem duplicação ou reescrita de tentativa com outro conteúdo. Banco protege imutabilidade, sequência, origem oficial e papel/atribuição. Evento CorrecaoNotaProposta acompanha a gravação na mesma transação. Notas oficiais e consolidado permanecem preservados; nenhuma decisão/aplicação é criada por este incremento.

Validação: 17 integrações de lançamentos aprovadas, incluindo duas novas de correção. Concorrência diretamente entre transações cria uma proposta; ação autenticada também confere reenvio. Duas execuções iniciais falharam no carregamento concorrente da autenticação simulada (next/server importado pelo next-auth); teste foi separado entre transação concorrente e ação autenticada, sem remover verificação de concorrência ou permissões. TypeScript, lint direcionado, schema diff vazio, build Next.js 16.3.5 (48 páginas estáticas) e diff check aprovados. Evidência: docs/validacao-proposta-correcao-241-2026-09-12.json.

Limites: somente preparação no servidor. Consulta/tela da proposta, decisão independente, aplicação dos valores, revisão dos efeitos em recuperação/equivalência/progressão e fechamento ainda precisam ser implementadas. Não declarar Q144 completo. Também pendem demais fluxos acadêmicos e ensaio interativo. Sem produção, dados reais ou envio externo. Última regressão integral/consolidada: 235.


## Incremento 240 — Fuso no lançamento e histórico da avaliação, 12/09/2026

Detalhe da avaliação permite escolher um fuso regional válido, com sugestões Brasil, Costa Rica e UTC. Escolha afeta entrada e apresentação de horários, conservada nos links de paginação da tela. Datas registradas são convertidas para preencher o formulário e mostrar autoria/decisões; trocar visualização não grava alterações. A tela orienta salvar rascunho antes da troca.

Ação salvarLancamentoAvaliacaoLocal valida data local e fuso no servidor, converte para instante UTC e chama a mesma transação autorizada de lançamento. Preserva segundos e milissegundos. Não escolhe silenciosamente horários inexistentes/ambíguos em mudanças de horário de verão; exige revisão ou equivalente conferido em UTC. Não altera a regra do calendário institucional ou o fuso da turma.

Validação: 10 unitários de conversão aprovados, incluindo Brasil, Costa Rica, Nepal, virada de data, milissegundos, datas inválidas e horário de verão; 15 integrações de lançamentos aprovadas, com novo caso de conversão no servidor, reenvio idempotente e negação a outro professor. TypeScript, lint direcionado, build Next.js 16.3.5 com 48 páginas estáticas e diff check aprovados. Evidência: docs/validacao-fuso-avaliacoes-240-2026-09-12.json. Sem migration nova.

Limites: escolha nesta tela é parâmetro da navegação, não preferência global persistida do usuário. Painel de vínculos e outras telas ainda têm referências UTC explícitas. Integração global da preferência e ensaio interativo permanecem pendentes. Não conclui correções, recuperação, frequência, fechamento ou portal. Sem produção, dados reais ou envio externo. Última regressão integral/consolidada: 235.


## Incremento 239 — Navegação de vínculos e histórico docente, 12/09/2026

Painel /academico/avaliacoes, ligado ao Diário e à área acadêmica, lista vínculos atuais e histórico com lançamentos. A seleção identifica aluno, matrícula, nível e turma; não inclui telefone, e-mail, financeiro ou notas na listagem. Consulta paginada de 20 itens revalida usuário ativo e papéis em transação. Gestão consulta os vínculos permitidos ao papel; professor consulta atuais sob sua atribuição ou históricos que contenham versões de sua autoria.

Histórico inclui alocações encerradas sem depender de abrir a ficha atual do aluno. Abrir o vínculo continua sujeito às consultas de avaliações e versões: professor anterior somente lê suas próprias versões. O painel não concede escrita, consolidado de outras pessoas, nova atribuição ou reativação da matrícula. A aba histórica pode incluir vínculo ainda ativo quando já possui registros; seu significado é histórico com lançamentos, não apenas vínculos encerrados.

Validação: 14 integrações do arquivo lancamentos.int.test.ts aprovadas. Caso novo cobre histórico vazio antes de lançar, saída do professor, encerramento da alocação, leitura própria, negação de consolidado amplo, ausência de histórico para outro docente, acesso da gestão e usuário desativado. TypeScript, lint direcionado, diff check e build Next.js 16.3.5 com 48 páginas estáticas aprovados; nova rota do painel é dinâmica. Sem migration nova.

Limites: acesso navegável ao histórico implementado; ensaio interativo ainda pendente. Não resolve atribuição específica a substitutos, correção, oportunidades, frequência, fechamento ou portal do aluno. Preferência de fuso das telas permanece pendente. Evidência: docs/validacao-painel-avaliacoes-239-2026-09-12.json. Regressão integral/consolidada de referência: 235. Sem produção, dados reais ou envio externo.


## Incremento 238 — Consolidação das avaliações regulares, 12/09/2026

Consulta consultarConsolidadoAvaliacoes carrega regra publicada vinculada à turma e lançamentos da matrícula correspondente, sob os bloqueios de matrícula/turma e conferência do papel ativo. Professor titular atual e gestão acessam o conjunto; autoria histórica isolada não concede leitura do consolidado completo. Registros de outra alocação/regra impedem cálculo até conferência de aproveitamento.

Notas oficiais alimentam o cálculo exato por habilidade e a média geral, com os pesos da regra preservada. Notas ausentes ou aguardando conferência produzem pendências e não recebem zero. A consulta retorna referências das fontes e memória do cálculo, sem comentários privados ou dados financeiros. A regra atual impede novas versões normais após oficialização; a futura correção deverá atualizar a seleção de fontes de forma explícita.

Tela de avaliações do vínculo mostra resultados regulares, mínimos individuais/geral e composição por avaliação. Valores são apresentados com duas casas decimais; comparação de mínimos permanece exata, sem usar o arredondamento da tela. O título e os avisos distinguem acompanhamento regular de fechamento, recuperação, frequência e decisão de progressão.

Validação: 13 integrações do arquivo de lançamentos passaram após corrigir uma asserção do teste que comparava uma lista de quatro habilidades com lista de tamanho um. Teste de consolidação confere pendência antes da oficialização, pesos publicados, média exata e bloqueio de professor sem vínculo. TypeScript, lint direcionado e build Next.js 16.3.5 com 47 páginas estáticas aprovados. Sem migration nova. Evidência: docs/validacao-consolidado-238-2026-09-12.json.

Limites: acompanhamento consultado em tempo real, sem fechamento/versionamento do resultado final. Recuperações persistidas, correções, equivalências, frequência e oportunidades ainda precisam integrar o consolidado; nenhuma aprovação automática foi acrescentada. Portal do aluno e ensaio interativo permanecem pendentes. Sem produção ou dados reais. Regressão integral/consolidada de referência continua 235.


## Incremento 237 — Telas de lançamento e conferência, 12/09/2026

Rotas /academico/avaliacoes/[alocacaoId] e /academico/avaliacoes/[alocacaoId]/[codigo] oferecem seleção da avaliação, lançamento de notas por habilidade e comentário destinado ao aluno, rascunho/submissão, histórico paginado e conferência independente. A ficha acadêmica fornece acesso por vínculo de matrícula aos papéis professor e gestão; Secretaria não recebe esse acesso de notas.

Consulta prepara configuração, escala, versão esperada e ações disponíveis. Apenas a versão submetida mais recente permite aprovação; versões anteriores ainda podem ser devolvidas. Autoaprovação não é oferecida, inclusive com papéis acumulados. Resultado oficial impede lançamento normal e informa a necessidade de correção aprovada. Todas as operações mantêm as validações transacionais do incremento 236. Formulários bloqueiam campos durante envio, preservam chave de reenvio incerto e atualizam o histórico após confirmação.

Professor anterior consulta somente avaliações em que possui lançamento e somente suas próprias versões; essa leitura não permite novos lançamentos. A projeção não contém telefone, e-mail, responsável financeiro ou chaves de processamento. A avaliação em outra turma/contrato continua sujeita à autorização da consulta; links não concedem acesso.

Validação: 12 integrações do arquivo lancamentos.int.test.ts aprovadas, incluindo seleção restrita do ex-professor, bloqueio da Secretaria, ações por autoria/versão e omissão de campos privados. TypeScript, lint direcionado, build Next.js 16.3.5 (47 páginas estáticas e duas novas rotas dinâmicas) e diff check aprovados. Sem migration nova. Evidência: docs/validacao-telas-avaliacoes-237-2026-09-12.json. Última regressão ampliada acadêmica: 236; integral/consolidada: 235.

Limites: telas compiladas, ainda sem ensaio interativo. Data de realização e histórico usam UTC explicitamente identificado; preferência de fuso nessa tela ainda precisa ser integrada. Navegação pela ficha lista vínculos ativos; acesso navegável ao histórico de vínculos encerrados ainda precisa ser completado. Consolidação de notas oficiais, correção, designação limitada, recuperação/segunda chamada, equivalência, frequência, fechamento e portal do aluno permanecem incompletos. Não houve produção, dados reais ou envio externo.


## Incremento 236 — Lançamento e oficialização de avaliações, 12/09/2026

Migration 108 (20260913060000_lancamento_avaliacao), aplicada somente ao banco local descartável, cria registro por matrícula/turma/avaliação, versões imutáveis do lançamento e decisão independente. O professor titular com atribuição vigente registra notas e comentário destinado ao aluno; rascunho permite nota ausente, submissão exige todas as habilidades previstas e notas na escala da regra vinculada. A data deve corresponder ao vínculo histórico conferido do aluno e do professor e à situação contratual elegível. Ausência não vira zero.

Outra pessoa ativa da Gerência Pedagógica/Administração oficializa ou devolve a submissão. Aprovação exige a versão mais recente e o conteúdo conferido. Reenvio idêntico não duplica o lançamento; versão nova invalida aprovação da anterior. Nota já oficializada não pode ser sobrescrita pelo lançamento normal: exige o futuro fluxo de correção. Banco protege imutabilidade, contexto matrícula/alocação/turma, sequência e independência das decisões. Bloqueios coordenam gravação com matrícula e turma; permissões são revalidadas dentro da transação.

Consulta paginada limita o professor atual à turma atribuída; professor anterior pode consultar somente versões de sua autoria, sem recuperar edição. Gestão autorizada consulta os registros. A projeção omite dados financeiros, contatos e chaves de processamento. Registro segue a matrícula da alocação, sem alcançar outro contrato do mesmo aluno. Migração de regra passa a bloquear turmas com registros de avaliação, preservando o histórico até existir revisão específica desse impacto.

Validação: 11 integrações novas passaram isoladamente; execução conjunta de quatro arquivos acadêmicos passou 41 testes (11 lançamentos, 14 migração, 6 vínculo inicial, 10 regras). TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 (47 páginas estáticas) aprovados. Evidência: docs/validacao-lancamentos-236-2026-09-12.json. Última regressão integral/consolidada permanece a do incremento 235.

Limitações explícitas: esta entrega implementa persistência, ações e consulta de servidor, sem tela de lançamento ou portal de notas. Falta conectar notas oficiais ao consolidado, implementar correções, responsáveis designados, avaliações históricas de matrícula encerrada, autorizações específicas durante pausa/encerramento, oportunidades, equivalência, frequência e fechamento. Registros com histórico insuficiente ficam bloqueados para conferência; esse bloqueio não implementa os fluxos faltantes. Não houve homologação interativa, produção, importação real ou envio externo.


## Incremento 235 — Tela de migração e regressão consolidada, 12/09/2026

Rota /academico/regras/turmas/[turmaId], acessível pela indicação de regra no painel de turmas, permite revisar origem/destino, campos alterados, quantidades de encontros e alocações registradas, enviar proposta com motivo e decidir de forma independente. Histórico mostra conteúdos completos das duas regras, autoria/data/motivo e decisões. Proposta desatualizada não oferece aprovação; rejeição permanece disponível para outro gestor autorizado. Formulários bloqueiam campos durante operações e conservam a chave de tentativa quando o resultado da gravação é incerto.

Consulta de preparação seleciona a última publicação do nível e explica ausência de publicação, regra já atual ou impedimento pelo início/histórico. Consulta de histórico extrai contagens do snapshot original e omite o snapshot bruto, IDs das alocações e chaves de processamento. Assim, alocação posterior invalida a proposta sem reescrever o que foi revisado. Regras, papéis e contexto continuam revalidados no servidor ao confirmar.

Validação: 20 integrações direcionadas (14 migração, 6 vínculo), 761 unitários na execução integral, TypeScript e build Next.js 16.3.5 aprovados (47 páginas estáticas, nova rota dinâmica). Lint completo sem erros e com três avisos preexistentes: FinanceiroPainel.tsx 116/402 e Sidebar.tsx 38; lint direcionado aprovado. Banco local tem 107 migrations e schema diff vazio; nenhuma migration nova neste incremento.

Regressão de integração integral executou 579 testes: 578 passaram e um falhou por fixture dependente do horário em whatsapp/cron.int.test.ts. O teste fixava a mensagem às 23h01, podendo preceder a criação real da intenção. Corrigido para usar criação +/- 60 segundos e conferir inbound anterior e posterior; regra de produção do WhatsApp permaneceu preservada. Reexecução completa desse arquivo passou os 12 casos. A cobertura consolidada da última execução de cada arquivo é de 580 integrações aprovadas, sem falhas ou pendências; isso não representa uma segunda execução integral. Evidência detalhada por execução/arquivo: docs/validacao-regressao-235-2026-09-12.json.

Tela compilada e consultas/ações testadas; ensaio interativo ainda pendente. Registro/oficialização de notas, gestão de oportunidades, frequência, equivalências, fechamento e portal continuam incompletos. As contagens de teste não comprovam atendimento integral de Q124–Q154 ou do objetivo geral. SPEC central atualizada para discriminar o avanço acadêmico. Sem produção, dados reais ou envio externo.


## Incremento 234 — Migração aprovada de regra antes do início, 12/09/2026

Migration 107 (20260913050000_migracao_regra_turma) cria proposta e decisão imutáveis da migração da regra de avaliação da turma. Gestão Pedagógica/Administração revisa e propõe; outra pessoa autorizada decide. Aprovação aplica a nova referência na mesma transação da decisão, com evento. Rejeição preserva a regra anterior. Chave idempotente, versão de proposta e hash da revisão impedem repetição com outro conteúdo ou aprovação de impacto desatualizado.

Revisão conserva regra de origem/destino, dados da turma, agenda e alocações. Consulta oferece conteúdos anterior/novo, campos alterados, quantidades afetadas e versão/hash da revisão. Mudança de agenda/alocação/contexto ou nova publicação exige nova revisão/proposta. Destino deve ser a última publicação do mesmo nível, posterior à regra atual. Primeira vinculação de turma futura sem regra também exige aprovação. Histórico paginado preserva decisões e indica quando uma proposta pendente já não pode ser aplicada, sem expor chave idempotente ou snapshot de alocações.

Bloqueios do calendário, nível e turma coordenam proposta/decisão com a agenda; papel ativo é conferido após a espera. Início é verificado pelo estado, encontro previsto passado, qualquer encontro ministrado, diário legado ou evento de início. Sem agenda publicada, exige data inicial futura conhecida. Data inicial de referência passada pode ser aceita somente com agenda publicada que ainda não iniciou, conforme diferença entre data de referência e primeiro encontro. SQL protege imutabilidade, independência, destino, regra de origem e impedimento de início; atualização direta da referência continua proibida fora da decisão aprovada.

Validação: 28 integrações aprovadas em três arquivos (12 migração, 6 vínculo inicial, 10 regras), TypeScript, lint direcionado, schema diff vazio e diff check. Houve duas correções de fixtures durante o teste: professor obrigatório no encontro publicado e chave idempotente distinta por nível; a execução final passou integralmente. Evidência: docs/validacao-migracao-regra-234-2026-09-12.json. Sem build ou regressão integral neste incremento; últimos permanecem 233 e 221. Migration aplicada somente ao banco local descartável.

Limitações: ações/consultas de servidor prontas, tela específica de migração e ensaio interativo pendentes. Não regulariza histórico de turmas já iniciadas sem regra. Futuro registro de avaliações deverá participar da conferência de impactos e dos bloqueios; persistência de notas ainda não existe neste módulo. Frequência, oportunidades, equivalências, fechamento e portal permanecem incompletos. Não houve produção, importação de dados reais ou envio externo.


## Incremento 233 — Versão de avaliação na criação da turma, 12/09/2026

Migration 106 (20260913040000_regra_inicial_turma) acrescenta referência à versão de avaliação na turma. Na criação de turma planejada/aberta com início futuro, banco seleciona a última versão publicada do respectivo nível, serializando com a publicação. Propostas pendentes/rejeitadas não substituem a publicada. A seleção comum cobre formulário e importação XLSX. Eventos TurmaCriada/TurmaImportada incluem a referência escolhida; painel de turmas mostra a versão ou pendência de vinculação.

Turmas existentes não são preenchidas retrospectivamente. Datas históricas/desconhecidas e turmas criadas em estado iniciado/concluído permanecem pendentes de conferência, sem presumir que usaram a regra atual. Ausência de publicação conserva referência nula; não cria regra padrão. Publicar nova versão não altera turmas anteriores, estejam planejadas, em andamento ou concluídas. Edição direta não pode substituir/remover vínculo nem trocar o nível de turma vinculada. Fluxo de revisão e aprovação para turma não iniciada continua pendente; bloqueio atual não é sua implementação.

Cadastro e cada linha importada conferem papel ativo após bloqueio de publicação e conservam leitura compartilhada do usuário durante a transação. Trigger rejeita seleção livre da regra inicial, troca direta e incompatibilidade de nível. Consulta de turmas retorna somente id/versão da regra para apresentação resumida.

Validação: 36 integrações aprovadas em três arquivos (6 vínculo, 10 regras, 20 integridade acadêmica); depois do reforço transacional de permissões, as 6 de vínculo foram repetidas e passaram. Casos cobrem formulário, importação real de XLSX fictício em memória, histórico, rascunho sem regra, outro nível, imutabilidade do vínculo e publicação concorrente. Schema diff vazio; TypeScript, lint direcionado e build Next.js 16.3.5 (47 páginas estáticas) aprovados. Evidência: docs/validacao-regra-turma-233-2026-09-12.json. Sem regressão integral; última permanece 221. Não houve produção ou uso de planilhas reais.

Pendente: migração aprovada das turmas não iniciadas, conferência do legado, bloqueios dos fluxos de avaliação quando falta regra, lançamento/oficialização, oportunidades, frequência, fechamento, portal e ensaio interativo. Atribuir uma regra não oficializa notas nem autoriza progressão.


## Incremento 232 — Regras de avaliação versionadas e conferência, 12/09/2026

Migration 105 (20260913030000_regras_avaliacao) cria VersaoRegraAvaliacao por nível/idioma e DecisaoRegraAvaliacao, com propostas e decisões imutáveis, relações restritas e autor/data/motivo. Gestão Pedagógica/Administração prepara; outra pessoa da Gestão Pedagógica/Administração decide. Autoaprovação, inclusive por acúmulo de papéis, é recusada no servidor e no banco. Bloqueio por nível serializa versões/publicações; chaves idempotentes impedem duplicação de proposta. Decisão exige hash da versão normalizada e publicação só aceita proposta mais recente. Rejeitar versão posterior mantém a última aprovada.

Conteúdo inclui escala, pesos e mínimos por habilidade/geral, frequência mínima, instrumentos intermediários/finais, habilidades por instrumento, limite de recuperações por habilidade e segundas chamadas por avaliação, prazos e antecedências independentes. Todos os valores pedagógicos são obrigatórios, sem padrões ocultos. Validação exige pesos positivos, quatro habilidades, escala coerente e cobertura final completa; permite instrumentos finais distribuídos. Durações armazenadas em minutos inteiros explícitos; limites podem ser zero, prazos de realização devem ser positivos. Limites técnicos de tamanho não constituem parâmetros pedagógicos.

Rotas /academico/regras e /academico/regras/[nivelId] oferecem busca paginada por idioma/nível, formulário com campos próprios, histórico e revisão integral antes da decisão. Formulário novo deixa valores pedagógicos em branco; nova versão pode partir do conteúdo anterior sem sobrescrevê-lo. Link aparece para gestão/Administração no acadêmico; ações e consultas revalidam papéis ativos. Histórico não expõe chave idempotente ou hash de entrada. Consulta serializa com mutações para apresentar versão publicada e histórico coerentes.

Validação local: 40 unitários (27 do cálculo e 13 da configuração), 10 integrações, TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 47 páginas estáticas e duas novas rotas dinâmicas. Integrações conferem persistência, imutabilidade, autorizações, autoaprovação direta no banco, reenvios concorrentes, decisões opostas concorrentes, hash divergente, versões superadas, revogação, paginação e separação por nível. Evidência: docs/validacao-regras-avaliacao-232-2026-09-12.json. Sem regressão integral neste incremento; última integral permanece 221.

Limitações abertas: publicação ainda não atribui versão às turmas novas ou migra turmas não iniciadas (Q141); não altera turmas existentes. Persistência de notas, oficialização, oportunidades, frequência, equivalência, fechamento e portal continuam pendentes. Sugestões docentes não possuem fluxo próprio nesta tela. Ensaio interativo não executado; build e testes de servidor não equivalem a homologação da interface. Migration aplicada somente ao banco local descartável de teste; nenhuma operação em produção ou envio externo.


## Incremento 231 — Efeito da recuperação no cálculo, 12/09/2026

Núcleo de cálculo recebe resultados de recuperações vinculadas ao contexto de matrícula/nível/versão e ao plano aprovado. Aplica máximo entre resultado vigente e nota oficial da tentativa (Q133), em ordem histórica explícita, preservando resultado original e memória de cada tentativa com antes/depois. Recalcula média geral e mínimos sem introduzir peso adicional de recuperação na média regular. Habilidades fora do plano são recusadas.

Notas de recuperação ausentes ou não oficializadas não alteram o resultado vigente e aparecem como pendências. Recuperação não substitui avaliação original ausente: mantém a habilidade pendente para regularização própria. Identificadores/ordens duplicados, colisão com avaliação regular, nota fora da escala e contexto diferente são recusados. Recalcular a mesma fonte produz o mesmo resultado; uma fonte corrigida pode diminuir o resultado antes calculado, sem perpetuar uma nota errada como melhor resultado histórico.

Vinte e sete testes unitários passaram (12 anteriores e 15 novos), além de TypeScript, lint direcionado e diff check. Evidência: docs/validacao-recuperacao-calculo-231-2026-09-12.json. Sem migration, build ou regressão integral neste incremento.

Limite: função interna não comprova aprovação pela existência de um ID. Integração futura deverá carregar planos, notas e ordem do histórico autorizado; nenhuma ação pública permite fornecer esses dados. Persistência, aprovação/oficialização, consumo de oportunidades, correções versionadas, frequência, fechamento e portal permanecem pendentes. O indicador completa descreve as notas regulares disponíveis; recuperacoesPendentes é separado e nenhum dos dois autoriza fechamento/progressão por conta própria.


## Incremento 230 — Núcleo de cálculo das avaliações, 12/09/2026

Implementado src/server/avaliacoes/calculo.ts como função interna pura, com contexto explícito de matrícula, nível e versão. Calcula média ponderada direta por avaliação/habilidade (Q128), média geral com pesos próprios (Q129) e mínimos geral/individuais (Q130). Notas ausentes ou não oficializadas mantêm resultado dependente pendente; habilidades não avaliadas em um instrumento não recebem zero. Final pode distribuir as quatro habilidades entre instrumentos.

Cálculo usa frações exatas de decimais textuais e retorna numerador/denominador serializáveis, evitando aprovação por arredondamento. Validação técnica exige pesos positivos, escala crescente, mínimos/notas na escala, identificadores únicos e cobertura final completa. Limite técnico de 100 caracteres por decimal não define escala pedagógica. Memória conserva avaliação, etapa e peso; rascunhos não são apresentados como notas oficiais.

Doze testes unitários direcionados passaram; TypeScript, lint dos arquivos e diff check aprovados. Evidência: docs/validacao-calculo-avaliacoes-230-2026-09-12.json. Sem migration. Não houve regressão integral ou build neste incremento (últimos: 221 e 228).

Implementação parcial: ainda não integrada à persistência, autorização por matrícula, publicação de regras, lançamento/oficialização, recuperação, equivalência, frequência, fechamento ou portal. O chamador futuro deverá carregar somente a versão e notas autorizadas do contexto. A função não constitui fechamento final nem autorização de progressão. Não houve produção ou envio externo.


## Incremento 229 — Concorrência e repetição da retomada, 12/09/2026

Teste de integração executa duas transações concorrentes com chaves diferentes para retomar a mesma reserva de origem. Uma vence, a outra é recusada; banco conserva somente origem e nova reserva, um vínculo e um evento de confirmação. A ação pública repete a tentativa vencedora e retorna o mesmo resultado.

Depois de expirar a nova reserva, repetição conserva seu estado expirado e retorna o resultado histórico sem reativar horários. Desativar o executor impede nova consulta idempotente pela ação. Quatro integrações direcionadas passaram; demais 57 casos não selecionados. TypeScript, lint e diff check aprovados. Evidência: docs/validacao-concorrencia-retomada-229-2026-09-12.json. Não houve alteração de código de produção ou migration; build mais recente permanece 228 e regressão integral 221.

Validação de servidor não substitui ensaio interativo ou os fluxos contratuais pendentes. Sem produção ou envio externo.


## Incremento 228 — Tela de retomada com nova reserva, 12/09/2026

Preparação particular expirada/liberada oferece à Secretaria/Administração a rota /matriculas/[id]/nova-reserva. Tela permite busca paginada de professores, fuso e encontros explícitos; fixa orienta informar todos os encontros acordados e flexível ao menos o primeiro. Revisão mostra cadastro, pagador, condições, cobranças existentes e agenda; exige conferência e motivo antes da confirmação. Mudança na agenda remove revisão/consentimento. Campos ficam bloqueados durante operações; confirmação bem-sucedida retorna à preparação.

Consulta de formulário revalida papel, matrícula, reserva atual e forma de oferta; devolve professores ativos somente com id/nome, em páginas de 30. Ações de confirmação mantêm validação transacional e idempotência já implementadas. Pagador possui projeção tipada de identificação/contato/endereço para a revisão.

Quatro integrações direcionadas aprovadas, incluindo consulta comercial negada, oferta/versão atual, busca docente e página inválida. Demais 57 casos não selecionados. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas, nova rota dinâmica) aprovados. Evidência: docs/validacao-tela-retomada-228-2026-09-12.json. Sem migration; última regressão integral permanece 221.

Ensaio interativo ainda pendente. Conciliação de documentos/processos de assinatura e alteração contratual/oferta continuam bloqueadas até integrar seus fluxos próprios; a tela não declara esses casos resolvidos. Sem produção ou envio externo.


## Incremento 227 — Ações autenticadas de nova reserva, 12/09/2026

Ações de revisão e confirmação de retomada exigem sessão da Secretaria/Administração e revalidação do papel no executor. Autor vem da sessão; entrada estrita não aceita autor fornecido pelo cliente. Consulta projeta cadastro, pagador, versão de condições, plano financeiro, cobranças existentes e novos horários. Valores monetários são serializados como texto; não retorna snapshot interno da disponibilidade.

Cadastro do aluno e estados/versões das cobranças, informes e recebimentos passam a integrar o hash da revisão. Cadastro é relido sob bloqueio compartilhado antes da confirmação. Alteração posterior exige nova consulta. A ação usa o executor atômico/idempotente existente e não emite cobranças.

Quatro integrações direcionadas aprovadas; cenário de retomada agora usa ações públicas, testa vendedor recusado, projeção da revisão, alteração cadastral invalidando confirmação, nova revisão e confirmação bem-sucedida. Demais 57 casos não selecionados. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-retomada-publica-227-2026-09-12.json. Sem migration; última regressão integral permanece 221.

Interface ainda pendente. Conciliação de documentos/processos de assinatura e alteração de condições/oferta não são liberadas por estas ações; dependem dos fluxos correspondentes ainda incompletos. Sem produção ou envio externo.


## Incremento 226 — Revisão e executor interno de nova reserva, 12/09/2026

Revisão de retomada exige Secretaria/Administração, matrícula em preparação assumida, reserva atual expirada/liberada, pagador/condições vigentes e preço autorizado. Oferta precisa conservar produto, país, moeda e forma de agenda; alteração contratual não é presumida. Disponibilidade nova integra o hash junto às condições e ao pagador.

Executor confere o hash e cria nova reserva/vínculo na mesma transação. Registra confirmação com hash de entrada; repetição exata retorna o resultado anterior, enquanto conteúdo diferente com a mesma chave é recusado. Não emite cobrança, assina ou ativa matrícula. Documentos contratuais, aceite ou processos de assinatura exigem conciliação própria e permanecem bloqueados até integrar esse fluxo.

Quatro integrações direcionadas aprovadas, incluindo autorização, revisão divergente sem criar reserva, criação/vínculo conjunto, repetição e conflito de chave. Demais 57 casos não selecionados. TypeScript, lint e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-nova-reserva-226-2026-09-12.json. Sem migration; última regressão integral permanece 221.

Entrega ainda interna: ações públicas, interface, conferência completa de condições financeiras/documentais e conciliação de assinatura não estão concluídas. Sem produção ou envio externo.


## Incremento 225 — Consumidores da reserva particular atual, 12/09/2026

Fonte da agenda contratual resolve a cadeia de reservas antes de conferir disponibilidade. Prévia, revisão de emissão e conferência para assinatura passam a receber os horários da reserva atual pelos consumidores existentes dessa fonte. Consulta da preparação mostra reserva atual e identifica a original preservada. Controle de vencimento também resolve a ponta da cadeia, evitando manter a nova reserva apenas por divergir da referência histórica inicial.

Quatro integrações direcionadas aprovadas. Cenário de nova reserva confirma consulta atual, snapshot documental com novo identificador, original anterior preservado mas conferência de assinatura desatualizada, e expiração normal da nova reserva sem avanço formal. Sem duplicação de cobrança. Demais 57 casos não selecionados. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-reserva-atual-225-2026-09-12.json. Sem migration; última regressão integral permanece 221.

Não há ação pública ou interface completa de retomada nesta rodada: a criação/vinculação usada no teste continua interna. Revalidação contratual, encerramento das solicitações externas quando necessário e demais requisitos da retomada ainda precisam ser conectados. Sem homologação interativa, produção ou envio externo.


## Incremento 224 — Cadeia histórica de reservas particulares, 12/09/2026

Novo vínculo imutável RetomadaReservaParticular identifica reserva anterior, nova, autor, motivo e data. Origem/destino únicos impedem dois sucessores ou reutilização do destino. Banco exige mesma matrícula, origem expirada/liberada e destino ativo; preparação comercial mantém sua referência original. Resolver interno percorre a cadeia para encontrar a reserva atual, com detecção de ciclo.

Vinculação interna exige Secretaria/Administração ativa, matrícula em preparação e origem correspondente à ponta atual da cadeia. Repete somente o mesmo autor/conteúdo; outra proposta para a mesma origem é recusada. Não é Server Action e deve integrar a transação da criação da nova reserva após as conferências aplicáveis.

Quatro integrações direcionadas aprovadas; cenário flexível por hora cobre nova reserva, vinculação, repetição, papel comercial recusado, histórico original preservado e alteração do vínculo impedida. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Migration 104 aplicada somente no banco local de testes, schema diff vazio. Evidência: docs/validacao-cadeia-particular-224-2026-09-12.json. Demais 57 casos não selecionados; última regressão integral permanece 221.

A ação operacional de retomada, sua revisão de condições/documentos, interface e adaptação dos consumidores para a reserva atual ainda precisam ser implementadas. Esta base não habilita contratação, assinatura ou ativação por si só. Sem produção ou envio externo.


## Incremento 223 — Interface de resolução particular, 12/09/2026

Painel de particulares abre /secretaria/reservas/particulares/[id], com horários, prazo, estado e histórico paginado de propostas. Formulários reutilizam a estrutura existente com ações particulares: Secretaria/Administração prepara; outra pessoa da Administração decide. Consulta revalida papel e projeta permissões de decisão/aprovação conforme autoria, versão, estado, prazo e hash. Uma indisponibilidade da agenda bloqueia prorrogação e aparece como pendência, sem impedir a consulta de histórico ou o tratamento de liberação.

Proposta/decisão exibem motivos e tratamento previsto; reavaliação transacional do servidor continua obrigatória. Histórico preserva também proposta superada, sem apresentá-la como aplicada. Não são expostos snapshots ou documentos internos na projeção de propostas.

Quatro integrações direcionadas passaram, incluindo consulta comercial negada, autoria independente, revisão desatualizada e histórico das duas versões após aprovação. Demais 57 casos não selecionados. TypeScript, lint e build Next.js 16.3.5 (46 páginas estáticas e nova rota dinâmica) aprovados. Evidência: docs/validacao-tela-resolucao-particular-223-2026-09-12.json. Sem migration; última regressão integral permanece 221. Ensaio interativo pendente, portanto não declarar homologação operacional. Retomada com nova reserva, assinatura externa e ativação continuam incompletas. Sem produção ou envio externo.


## Incremento 222 — Resolução particular com aprovação independente, 12/09/2026

Servidor permite propor prorrogação/liberação de reserva particular mantida por pendência. Secretaria/Administração prepara com motivo, tratamento previsto da contratação e novo prazo quando aplicável. Outra pessoa da Administração decide; acúmulo de papéis não permite autoaprovação. Proposta e decisão permanecem imutáveis, com versões, idempotência e auditoria. Liberação da reserva não cancela contrato/cobrança nem devolve recebimentos.

Decisão revalida a versão mais recente e o contexto da reserva, matrícula, cobranças/informes/recebimentos, documentos e processos de assinatura. Mudança exige nova proposta. Prorrogação exige prazo futuro/posterior e disponibilidade da agenda particular; calendário, docente e horários compõem a revisão preservada. A transição válida muda somente estado/prazo da reserva.

Quatro integrações direcionadas aprovadas: liberação/prorrogação, autoaprovação recusada, Secretaria impedida de decidir, nova evidência invalidando proposta, nova versão aprovada, repetição e imutabilidade. Demais 57 casos não selecionados. TypeScript, lint e build Next.js 16.3.5 (46 páginas estáticas) aprovados; migration 103 somente no banco local de teste, schema diff vazio. Evidência: docs/validacao-resolucao-particular-222-2026-09-12.json. Última regressão integral permanece 221.

Esta rodada entrega ações de servidor e persistência. Consulta detalhada e interface de preparação/decisão particulares ainda pendentes; não declarar Q118 concluída na experiência operacional. Retomada com nova reserva, assinatura externa e ativação continuam incompletas. Sem produção ou envio externo.


## Incremento 221 — Regressão integral após reservas particulares, 12/09/2026

721 testes unitários e 549 integrações aprovados, zero falhas e zero pendentes. Integração executada uma única vez, em série, no Postgres descartável localhost:54329/erp_genius_test. Evidência por arquivo em docs/validacao-regressao-221-2026-09-12.json. Esta é a nova referência de regressão integral, substituindo a 201; registros anteriores permanecem históricos.

TypeScript aprovado; schema local sem diferenças e 102 migrations aplicadas. Lint completo de src: zero erros, três avisos preexistentes em FinanceiroPainel.tsx (116/402) e Sidebar.tsx (38), relacionados a atualização de estado em efeitos. Sem alterações de código necessárias nesta rodada. Último build validado continua o 220. SPEC central atualizada para apontar explicitamente o estado comercial/documental até 220.

Resultado verde comprova os cenários existentes, não a conclusão das funcionalidades ausentes. Assinatura externa, resolução aprovada de particulares, retomada da mesma preparação, ativação e demais frentes aprovadas continuam pendentes. Sem nova homologação interativa, produção, importação ou envio externo.


## Incremento 220 — Painel de reservas particulares da Secretaria, 12/09/2026

Painel /secretaria/reservas distingue turmas e particulares. Consulta particular exige Secretaria/Administração com papel ativo revalidado no banco, pagina 30 registros, permite matrícula específica e inclusão do histórico. Apresenta estado, prazo/fuso, docente e quantidade de horários, com link à preparação. Não retorna snapshot, documentos financeiros ou contatos pessoais na projeção da lista. Vencidas ativas oferecem a conferência existente; mantidas ocupam horários e expiradas só aparecem ao incluir histórico.

Quatro integrações direcionadas passaram: consulta comercial negada, filtro por matrícula, projeção limitada, ocupantes e histórico após expiração/manutenção. Demais 57 casos do arquivo não selecionados. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-painel-particular-220-2026-09-12.json. Última regressão integral permanece 201. Sem migration, produção ou envio externo; ensaio interativo pendente. Resolução aprovada e retomada da preparação com nova reserva ainda não concluídas.


## Incremento 219 — Continuidade dos lotes de vencimento, 12/09/2026

Cursor persistente no banco guarda a última reserva selecionada por vencimento/id. Seleção e avanço são serializados em transação própria. A posição avança antes do processamento, portanto falha ou queda não prende as reservas posteriores. Ao terminar a passagem, o cursor é zerado para revisitar as pendentes na chamada seguinte. Reserva permanece ocupante até a própria conferência transacional autorizar sua transição; cursor não libera horários.

A rotina inicia no máximo 50 conferências e para de selecionar ao atingir 15 segundos de trabalho. Transações individuais usam timeout de 5 segundos e espera de conexão de 1 segundo; uma operação em curso pode ultrapassar o orçamento do lote. Retorno identifica limite de tempo. São limites técnicos de processamento, sem alterar prazo de reserva ou condições contratuais.

Migration 102 aplicada somente no banco local de testes, com schema diff vazio. Cinco integrações direcionadas e cinco unitários passaram; teste de cursor confirma avanço por duas reservas ainda ativas e retorno à primeira em nova passagem. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-cursor-particular-219-2026-09-12.json. Demais 56 integrações do arquivo não foram selecionadas. Última regressão integral permanece 201.

Sem agendador externo configurado nesta rodada; capacidade, tempo limite total da rota e alertas operacionais ainda precisam ser homologados no ambiente de execução. Sem produção, importação ou envio externo. Resolução aprovada e retomada com nova reserva continuam pendentes.


## Incremento 218 — Rotina periódica de reservas particulares, 12/09/2026

A rota operacional existente POST /api/whatsapp/cron, protegida por CRON_SECRET no cabeçalho x-cron-secret, inclui agora a conferência de reservas particulares antes das rotinas de mensagens. Seleciona até 50 reservas ativas vencidas e revalida cada uma na própria transação. Retorna contagens de expiração, manutenção, ausência de transição e falhas; lote cheio sinaliza continuação em novas chamadas. Falha individual não libera a reserva nem impede as seguintes. A rotina de reservas não depende de WhatsApp habilitado e não envia mensagens.

Quatro integrações direcionadas passaram (56 casos não selecionados): os cenários particulares agora exercitam o lote e sua repetição. Quatro unitários passaram para falha isolada e autenticação da rota (sem segredo, segredo incorreto e chamada válida). TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-cron-particular-218-2026-09-12.json. A rodada de 74 integrações continua sendo a 217; última regressão integral é 201.

Sem agendador externo configurado ou validado nesta rodada; o código atende chamadas periódicas autenticadas, mas não comprova operação periódica em produção. Antes de operar, dimensionar lote/tempo limite do ambiente e tratamento de falhas persistentes que possam ocupar o começo dos lotes. Sem migration, produção, importação ou envio externo. Resolução aprovada e retomada com nova reserva permanecem pendentes.


## Atualização atual — incremento 217, 12/09/2026

Conferência manual de vencimento das reservas particulares disponível para Secretaria/Administração. Sem avanço formal, expira preservando registros; indícios de pagamento, documento ou processo de assinatura mantêm a reserva pendente. Ainda faltam execução periódica, resolução aprovada e retomada da mesma preparação com nova reserva. Assinatura externa e ativação também permanecem incompletas.


Validação 217: 74 integrações aprovadas; cenários incluem prazo vigente, papel comercial recusado, expiração sem avanço, manutenção por indício financeiro/documento/processo de assinatura, repetição sem transição e preservação de horários/cobranças. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-vencimento-particular-217-2026-09-12.json. Sem migration; última regressão integral permanece 201. Ensaio interativo pendente.


## Atualização atual — incremento 216, 12/09/2026

Particulares agora integram a conferência interna anterior à assinatura: original e participantes atuais, emissão inicial, regra de pagamento da taxa e disponibilidade dos horários reservados. A tela mostra a agenda particular. Envio/assinatura externa, ciclo de liberação da reserva e ativação ainda incompletos; Q155 aguarda fornecedor. As seções seguintes preservam os marcos anteriores.


Validação do incremento 216: 74 integrações de reservas/agenda aprovadas, incluindo particulares fixa/flexível e mensal/hora até participantes, original preservado e conferência para assinatura. Docente inativo impede registro; repetição não duplica; nenhuma assinatura externa ou ativação é criada. TypeScript, lint do trecho e build Next.js 16.3.5 com 46 páginas estáticas aprovados. Evidência em docs/validacao-assinatura-particular-216-2026-09-12.json. Sem migration; última regressão integral permanece 201. Ensaio interativo pendente.


## Incremento 215 — Emissão inicial das particulares, 12/09/2026

Conferência da Secretaria e emissão inicial agora usam a reserva particular vinculada à preparação. A revisão mostra os horários e inclui sua configuração histórica e o calendário no hash. O executor revalida reserva, prazo, docente, conflitos e períodos não letivos na transação antes de emitir. Memória da emissão conserva a agenda conferida. Alterar a oferta depois da preparação não substitui suas condições históricas.

Mantido o planejador das cobranças: taxa após conferência; primeira mensalidade conforme exigência de entrada; por hora sem adiantamento não recebe mensalidade fictícia. Emissão não ativa matrícula nem consome a reserva. Repetição da confirmação retorna a emissão existente sem duplicar.

74 integrações de reservas/agenda aprovadas, incluindo quatro combinações particulares e bloqueios por docente inativo e revisão desatualizada. TypeScript, lint do trecho, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-emissao-particular-215-2026-09-12.json. Sem migration, produção, importação ou envio externo. Última regressão integral permanece 201. Conferência para assinatura, ciclo de reserva e ativação particulares continuam pendentes; ensaio interativo também pendente.


**Atualização de implementação em 12/09/2026 — incremento 214:** a última regressão integral foi a 201: 715 unitários e 536 integrações aprovados. A rodada 214 validou visualmente as duas páginas do PDF demonstrativo de agenda particular, com extração do texto, 3 unitários do PDF, 4 integrações direcionadas, lint e build/TypeScript aprovados. A rodada 213 executou 74 integrações de reservas/agenda. Reservas particulares já possuem persistência interna e proteção contra conflito com outras reservas, publicação de grade e mudança de professor. Ausências aprovadas capturam reservas afetadas e a tela acompanha pendências atuais. A aprovação agora exige correspondência com o impacto revisado, impedindo decisão com aulas/reservas alteradas desde a consulta. Não cancela horários automaticamente. A preparação comercial no servidor agora vincula reserva particular, com escopo por negociação e sem vaga fictícia. O formulário particular agora permite professor, fuso, encontros explícitos, revisão e confirmação; busca/revisão/preparação pública têm testes de escopo e privacidade. A prévia contratual particular já inclui os horários históricos, exigindo campo no corpo do modelo aprovado. Ensaio interativo, emissão, assinatura, ciclo de liberação e ativação/consumo ainda estão pendentes. Dados antigos sem classificação exigem conferência antes de produção. A contratação possui preparação/reserva de turma, emissão inicial, originais preservados, conferência para assinatura e exceção Q110; processos/tentativas têm controle interno, ainda sem adaptador ou envio externo. Q155 aguarda escolha do fornecedor. Assinaturas, aceite/ativação completa, aditivos e demais frentes da SPEC continuam pendentes. Consulte o [registro B01](planejamento/implementacao-b01.md). Os registros abaixo preservam o histórico de cada rodada.

### Atualização de implementação — incremento 177 (12/09/2026)

Confirmação do contrato e validação de aceite na ativação passaram a exigir preço permitido pela análise histórica ou exceção aprovada. Proposta rejeitada, pendente de aprovação ou sem análise conferível não avança. Aprovação de preço não substitui aceite/pagamentos. Passaram 38 testes de integração de reservas/preparação e ativação, TypeScript e ESLint do trecho. Sem migration; build mais recente: incremento 176. Conferência integral da Secretaria e emissão financeira inicial ainda estão pendentes; não há conclusão integral do escopo.

### Atualização de implementação — incremento 178 (12/09/2026)

Catálogo administrativo configura taxa prévia à assinatura e exigência de adiantamento por hora, com versão e auditoria. Preparação captura a regra histórica; revisão a apresenta sem alteração retroativa. Regras indefinidas permanecem pendentes. Passaram 34 testes de integração de reservas/preparação, TypeScript e ESLint; schema local conferido (85 migrations). Conferência contratual completa, valor/horas do adiantamento, emissão e liberação integrada da assinatura ainda não concluídos.

Build mais recente: incremento 178, aprovado com 43 páginas estáticas. Sem ensaio interativo deste incremento.

### Atualização de implementação — incremento 179 (12/09/2026)

A ativação mensal de preparações novas usa a exigência de primeira mensalidade preservada na origem. Configuração posterior não altera silenciosamente essa regra; preparação incompleta exige revisão. Fluxo mensal legado recusa preparações por hora, cuja ativação própria ainda precisa ser implementada. Passaram 43 testes de integração, TypeScript e ESLint do trecho. Sem migration; último build: incremento 178. Escopo integral permanece incompleto.

### Atualização de implementação — incremento 180 (12/09/2026)

Preparação por hora registra quantidade explícita de minutos antecipados e valor calculado pela hora de 60 minutos, sem arredondar tempo. Oferta que exige adiantamento requer essa informação. Formulário e revisão apresentam a proposta; cobrança/saldo pago não são gerados. Passaram dois testes unitários, 39 de integração, TypeScript e ESLint. Emissão e ativação por hora permanecem pendentes.

Último build validado: incremento 180, com 43 páginas estáticas.

### Atualização de validação — incremento 181 (12/09/2026)

699 testes unitários passaram após atualizar a simulação do banco e acrescentar casos de ativação histórica. Integração completa terminou com 519/520: um teste confundiu dígitos do ID com valor financeiro. Corrigido para verificar valores reais, conservando verificações de privacidade; reteste do arquivo passou 7/7. Sem segunda execução integral. TypeScript aprovado; lint completo sem erros e três avisos existentes. Evidência: docs/validacao-regressao-181-2026-09-12.json. Escopo completo permanece em implementação; último build aprovado: 180.

### Atualização de implementação — incremento 182 (12/09/2026)

Registro de pagador passou a ter identidade e versões por matrícula, com ação da Secretaria/Administração e consulta administrativa/financeira. Não altera pagadores de outros contratos nem concede acesso acadêmico. Passaram 40 testes de integração, TypeScript e ESLint; banco local com 86 migrations e schema conferido. Interface e consumo na conferência/emissão/documento continuam pendentes. Último build: 180.

### Atualização de implementação — incremento 183 (12/09/2026)

Interface de pagador por matrícula disponível no painel da Secretaria. Registro atual e formulário respeitam acesso e estado; Financeiro somente consulta. Passaram 40 testes de integração e ESLint. Não realizado ensaio interativo. Conferência completa e integração financeira/documental seguem pendentes.

Último build validado: incremento 183, com TypeScript aprovado e 43 páginas estáticas.

### Atualização de implementação — incremento 184 (12/09/2026)

Histórico de pagador por matrícula agora navegável na interface com versões, autoria e motivo, restrito às equipes administrativas/financeiras. Passaram 41 testes de integração, TypeScript, lint e build com 43 páginas estáticas. Ensaio interativo pendente. Conferência/emissão/documentação contratual ainda não concluídas. Último build: 184.

### Atualização de implementação — incremento 185 (12/09/2026)

Revisão apresenta pendências consolidadas da preparação para Secretaria/Administração: preço, regra de entrada, pagador, reserva e agenda. A própria reserva não é contada como vaga de outro aluno. Diagnóstico não libera emissão nem substitui conferência integral. Passaram 42 testes de integração e lint; sem migration. Fluxos financeiros/documentais completos continuam pendentes.

Último build validado: incremento 185, com TypeScript e geração de 43 páginas estáticas aprovados.

### Atualização de implementação — incremento 186 (12/09/2026)

Condições financeiras de entrada registradas por matrícula, preservando proposta/pagador, valores, política, vencimentos e cobertura. Distingue mensalidade de antecipação por hora; não emite cobrança nesta etapa. Passaram 44 testes de integração, TypeScript e lint. Banco local com 87 migrations e schema conferido. Interface, conferência conjunta, emissão/ativação ainda pendentes; último build: 185.

### Atualização de implementação — incremento 187 (12/09/2026)

Interface de condições de entrada disponível na Secretaria, com vencimentos/cobertura explícitos e alerta de pagador alterado. Financeiro somente consulta. Passaram 44 testes de integração e lint. Sem emissão automática nesta etapa; conferência conjunta, emissão e ativação integradas seguem pendentes.

Último build validado: incremento 187, com TypeScript e 43 páginas estáticas aprovados.

### Atualização de implementação — incremento 188 (12/09/2026)

Prévia das cobranças iniciais calcula os itens e o momento de emissão conforme Q112/Q119, preservando regime e condições registradas. Hora sem antecipação não cria mensalidade. Passaram cinco unitários, 44 testes de integração e lint. Emissão transacional, conferência completa e ativação integrada continuam pendentes.

Último build validado: incremento 188, incluindo TypeScript e 43 páginas estáticas.

### Atualização de implementação — incremento 189 (12/09/2026)

Executor interno cria cobranças iniciais e memória em transação única, com revalidação e proteção contra duplicação. Passaram 46 testes de integração, TypeScript e lint; schema local conferido, 88 migrations. Ainda não é ação pública: faltam conferência documental final e ligação ao fluxo operacional de emissão/ativação. Último build: 188.

### Atualização de implementação — incremento 190 (12/09/2026)

Ação pública autenticada registra conferência explícita e emite as cobranças iniciais na mesma transação, com snapshot, revisão desatualizada bloqueada e idempotência. Passaram 47 testes de integração, TypeScript e lint; banco local com 89 migrations, schema conferido. Interface da revisão/confirmar ainda não conectada. Assinatura e ativação completa seguem pendentes; último build: 188.

### Atualização de implementação — incremento 191 (12/09/2026)

Interface de conferência final conectada à emissão transacional: revisão de dados/documentos/plano, confirmações explícitas, motivo e resultado após emissão. Passaram 47 testes de integração e lint. Sem ensaio interativo; assinatura, ativação completa e demais frentes continuam pendentes.

Último build validado: incremento 191, com TypeScript e 43 páginas estáticas aprovados.


### Atualização de implementação — incremento 192 (12/09/2026)

Cobranças iniciais agora têm vínculos relacionais imutáveis com sua emissão e matrícula. Banco impede exclusão da cobrança e transferência para outra matrícula. Passaram 47 testes de integração, TypeScript, lint do trecho e diff --check; schema local sem diferenças, 90 migrations. Migration corrigida após tentativa inicial falha no banco descartável, sem operação em produção. Último build: 191. Assinatura, ativação completa, ensaio interativo desta frente e demais funcionalidades aprovadas continuam pendentes.


### Atualização de implementação — incremento 193 (12/09/2026)

Base de governança dos modelos contratuais implementada: preparação versionada pela Secretaria/Administração, publicação/rejeição por outro administrador, hash de revisão, histórico imutável e consulta paginada. Seis testes de integração passaram. Banco descartável com 91 migrations. Interface, seleção/aplicação do modelo, PDF, assinatura e ativação nova permanecem pendentes; não há contrato real gerado por esta entrega.

Validação complementar do incremento 193: TypeScript e ESLint aprovados; comparação Prisma sem diferenças no banco descartável; diff --check sem erros.


### Atualização de implementação — incremento 194 (12/09/2026)

Interface de modelos conectada à preparação, consulta e decisão independente: famílias/histórico paginados, conteúdo por seção, campos e signatários, cópia para nova versão. Navegação autorizada para Secretaria/Administração; guard próprio da configuração de turmas preserva seu recorte. Sete testes de integração, lint e build com TypeScript/45 páginas passaram. Sem ensaio interativo ou nova migration. PDF, assinatura, aplicação à matrícula e ativação completa permanecem pendentes.


### Atualização de implementação — incremento 195 (12/09/2026)

Preenchimento por origens explícitas e registro imutável da prévia contratual implementados no servidor. Modelo publicado, condições/pagador atuais e revisão por hash são exigidos; alteração posterior no cadastro não muda o texto preservado. Três unitários e 55 testes de integração aprovados, TypeScript/lint/schema conferidos; 92 migrations no banco descartável. Interface de prévias, PDF, signatários, assinatura e ativação continuam pendentes. Prévia não comprova contrato assinado.

Build do incremento 195 aprovado com TypeScript e geração de 45 páginas estáticas. Ensaio interativo não realizado.


### Atualização de implementação — incremento 196 (12/09/2026)

Interface de prévias conectada à matrícula: seleção de modelo publicado, revisão, registro e consulta histórica com texto preservado. Listagens paginadas e restritas à Secretaria/Administração; links administrativos ocultos do Comercial. Passaram 48 testes de integração e build/TypeScript, além de lint. Sem migration ou ensaio interativo. PDF, identificação dos signatários, assinatura e ativação completa continuam pendentes.


### Atualização de implementação — incremento 197 (12/09/2026)

Prévia mostra exigências condicionais de assinatura e pendências, com cliente antes da escola quando exigida. Plano fica preservado no snapshot, sem inventar maioridade ou representação legal. Oito unitários, lint e build aprovados. Ainda não identifica pessoas nem envia documentos; conferência de participantes, PDF, assinatura e ativação seguem pendentes. Sem migration ou ensaio interativo.

Integração do incremento 197: 48 testes de reservas/preparação aprovados, incluindo preservação do plano de signatários no snapshot e consulta histórica. diff --check sem erros.


### Atualização de implementação — incremento 198 (12/09/2026)

Servidor registra conferência versionada dos participantes da prévia, comparando identidade do aluno/pagador e exigindo evidência para representantes. Históricos imutáveis e permissões preservados. 48 testes de integração aprovados, com reteste do caso afetado pelo ajuste final, TypeScript/lint/schema sem erros. Banco descartável com 93 migrations. Interface, liberação documental, PDF, assinatura e ativação permanecem pendentes; último build 197.


### Atualização de implementação — incremento 199 (12/09/2026)

Interface de participantes conectada à prévia: identificação, representação documentada, maioridade fundamentada, anexos e histórico. Listas limitam-se à contratação e permitem consulta de versões preservadas. Build/TypeScript, lint e diff --check aprovados; sem migration ou ensaio interativo. Liberação, PDF, assinatura, aditivos e ativação completa continuam pendentes.

Integração do incremento 199: 48 testes aprovados, incluindo dados do formulário, versão atual após confirmação, ausência de URLs desnecessárias, exclusão de documento de outro contrato e vendedor negado.


### Atualização de implementação — incremento 200 (12/09/2026)

PDF da prévia disponível por rota autenticada e sem cache público, usando snapshot e fontes incorporadas. Dois unitários, 48 testes de integração, lint/build passaram; fontes conferidas no standalone. Demonstração fictícia de três páginas inspecionada visualmente e por extração de texto. Arquivo definitivo persistido para assinatura, liberação, aditivos e ativação continuam pendentes. Auditoria npm aponta 14 ocorrências gerais a tratar, nenhuma atribuída aos novos pdfkit/fontkit. Não há validação interativa do endpoint ou operação em produção.

## Atualização 201 — 12/09/2026

Dependências atualizadas: Next.js 16.3.5, Auth.js beta.32 e correções transitivas, incluindo uuid do ExcelJS. Auditoria npm reduziu 14 ocorrências conhecidas para zero. Passaram 715 testes unitários e 536 de integração, sem falhas ou pendentes, além de build/TypeScript; lint sem erros e com três avisos existentes. Evidências: [regressão 201](validacao-regressao-201-2026-09-12.json) e [dependências 201](validacao-dependencias-201-2026-09-12.json).

A contratação já dispõe de preparação/reserva, conferência do pagador/condições, emissão inicial, modelos aprovados, prévias e conferência de participantes, com PDF protegido da prévia. Isso ainda não completa a contratação: PDF definitivo persistido, liberação/assinatura integrada, aditivos e ativação completa mensal/por hora seguem pendentes. Outros módulos da SPEC também permanecem incompletos. Não houve publicação, produção ou importação de dados reais.

## Atualização 202 — 12/09/2026

Original contratual agora é gerado e preservado com bytes imutáveis, fontes/renderizador identificados e vínculo à prévia e aos participantes conferidos. Tela permite geração e abertura; acesso confere papel, matrícula e integridade. Três unitários do PDF e 48 integrações aprovados, com reteste documental após ajustes finais; build/TypeScript/lint aprovados. A última regressão integral permanece a 201; esta rodada foi direcionada à contratação. Evidência: [validação 202](validacao-original-202-2026-09-12.json).

Original ainda não representa assinatura, aceite ou ativação. Liberação/integração externa, substituição, aditivos e ativação completa continuam pendentes; interface ainda sem ensaio interativo de navegador. Sem produção ou importação real.

## Atualização 203 — 12/09/2026

Conferência interna para assinatura implementada com original, participantes, taxa conforme política contratada e reserva/agenda revalidados. Tela exibe pendências e histórico imutável; mudança desde a revisão exige atualização. Passaram 49 integrações, build/TypeScript e lint dos arquivos alterados. [Evidência 203](validacao-assinatura-203-2026-09-12.json). Envio ao fornecedor, assinatura/aceite, exceção Q110, agenda própria de particulares e ativação completa ainda pendentes. Não houve envio externo ou produção; ensaio interativo da tela ainda não realizado.

## Atualização 204 — 12/09/2026

Exceção pedagógica de ingresso após o limite (Q110) implementada com aprovação independente, cenário versionado e interface. Emissão e conferência contratual consomem a autorização específica da reserva, sem abrir novas vagas/contratações ou dispensar professor apto e turma não concluída. Passaram 49 integrações, com reteste de dois casos, build/TypeScript/lint. [Evidência 204](validacao-excecao-admissao-204-2026-09-12.json). Ativação final ainda deve integrar essa revalidação; assinatura externa, particulares, aditivos e demais funcionalidades permanecem pendentes. Interface sem ensaio interativo; sem produção.

## Atualização 205 — 12/09/2026

Controle interno de processos e tentativas de envio implementado, com revalidação, disputa por tentativa, incerteza e conciliação. Ainda não há adaptador HTTP, worker operacional ou assinatura integrada. Q155 aguarda escolha do fornecedor. Passaram 49 integrações, reteste de dois casos, build/TypeScript/lint; [evidência 205](validacao-envio-205-2026-09-12.json). Nenhum fornecedor foi configurado/contratado ou acionado.

### Complemento de validação do incremento 299

Sete integrações de encerramento-solicitacao aprovadas após acrescentar cenários independentes de retroatividade e dispensa de multa. O Financeiro sem financeiro.aprovar_acertos é recusado; com permissão, continua impedido de aprovar sem a autorização específica. Inserção direta da decisão no banco também recusa cada exceção não autorizada. Com a autorização explícita, registra a decisão e preserva matrícula ativa. TypeScript e lint do teste aprovados; nenhum código de produção alterado neste complemento. Efetivação financeira continua pendente.
