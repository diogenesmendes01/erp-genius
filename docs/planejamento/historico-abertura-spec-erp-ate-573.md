# Histórico de atualizações da abertura da SPEC — até 573

Estes registros foram preservados integralmente na reorganização 574. Descrevem o estado nas respectivas datas; não são comprovação do estado atual nem substituem requisitos.

Atualização 573: histórico administrativo de todas as reservas de segunda chamada, preservando ocorrências anteriores, motivos/evidências e autoria, com consulta por cursor. Duas integrações direcionadas, lint e build aprovados; sem ensaio interativo. Q164 e proteção/alteração de encontros previstos permanecem pendentes. [Evidências e limites](../planejamento/validacao-incremento-573.md).

Atualização 572: corrigida inversão de bloqueios em cinco fluxos de segunda chamada, com revalidação após espera. 41 integrações, tipos e lint aprovados; cenários de concorrência confirmam espera real no PostgreSQL. Q164 e proteção/alteração de encontros previstos permanecem pendentes. [Evidências e limites](../planejamento/validacao-incremento-572.md).

Atualização 571: concorrência entre realização e falta/impedimento verificada com um único fato terminal. 54 integrações em rodada conjunta, lint e tipos aprovados. Q164 aguarda definição sobre resolução do impedimento; proteção de encontros previstos permanece pendente. [Evidências e limites](../planejamento/validacao-incremento-571.md).

Atualização 570: impedimento escolar encerra e protege seu encontro sem consumir oportunidade; seleção de agenda respeita contrato e vínculo disponível. 52 cenários de integração aprovados entre execuções, 7 testes de replanejamento, lint e build. Resolução da pendência escolar e alterações de encontros previstos continuam pendentes. [Evidências e limites](../planejamento/validacao-incremento-570.md).

Atualização 569: falta de segunda chamada encerra o encontro como não realizado, com histórico protegido e sem nota/presença/cobrança automáticas. 50 integrações, 6 testes de replanejamento, lint e build aprovados. Impedimento e proteção de encontros previstos seguem pendentes. [Evidências e limites](../planejamento/validacao-incremento-569.md).

Atualização 568: cancelamento do aluno exige aprovação independente e aplica liberação/consumo pela antecedência do pedido original. Interface conserva revisão e decisão. 31 integrações, lint e build aprovados. Falta e impedimento na agenda seguem pendentes. [Evidências e limites](../planejamento/validacao-incremento-568.md).

Atualização 567: cancelamento escolar de segunda chamada exige proposta e aprovação independente, aplicando agenda e oportunidade na mesma transação, com tela e histórico. 30 integrações, lint, tipos e build aprovados. Demais ocorrências de agenda seguem pendentes. [Evidências e limites](../planejamento/validacao-incremento-567.md).

Atualização 566: realização de segunda chamada conclui e preserva seu encontro; início e conclusão de turma consideram apenas aulas regulares. 46 integrações, lint e tipos aprovados. Cancelamento aprovado da agenda segue pendente. [Evidências e limites](../planejamento/validacao-incremento-566.md).

Atualização 565: painel exige justificativas reais e disponibilização admite reenvio idêntico sem duplicação. 26 integrações, lint e build aprovados. Ciclo terminal da agenda de segunda chamada permanece pendente. [Evidências e limites](../planejamento/validacao-incremento-565.md).

Atualização 564: realização de segunda chamada protegida no banco por atribuição, agenda, data e evidência; novas autorizações especiais gravam criação em UTC. 25 integrações, lint e tipos aprovados. Legado temporal exige conferência. [Evidências e limites](../planejamento/validacao-incremento-564.md).

Atualização 563: reservas e ocorrências de segunda chamada protegidas por invariantes SQL e histórico imutável; consumo/liberação exige fato correspondente no commit. 24 integrações, lint e tipos aprovados. [Evidências e limites](../planejamento/validacao-incremento-563.md).

Atualização 562: ocorrências de segunda chamada recebem dados reais da gestão, com validação temporal e reenvio sem duplicação. 20 integrações, lint e build aprovados; proteções SQL e homologação ainda pendentes. [Evidências e limites](../planejamento/validacao-incremento-562.md).

Atualização 561: gestão de designações de segunda chamada disponível pela interface, com vigência, busca, histórico paginado e proteção SQL do histórico. 14 integrações, lint e build aprovados; ensaio interativo pendente. [Evidências e limites](../planejamento/validacao-incremento-561.md).

Atualização 560: designação de segunda chamada expirada não restaura autorização anterior; novas datas de criação gravadas em UTC. 13 integrações, lint e tipos aprovados. Histórico legado exige conferência. [Evidências e limites](../planejamento/validacao-incremento-560.md).

Atualização 559: professor designado pode regularizar a nota de segunda chamada aplicada por outra pessoa, com evidências e autoria preservadas. 108 integrações, lint e build aprovados; homologação interativa e demais fluxos pendentes. [Evidências e limites](../planejamento/validacao-incremento-559.md).

Atualização 558: nota de segunda chamada devolvida aceita nova versão, preservando realização e histórico; banco exige rejeição prévia. 14 integrações, lint e build aprovados. [Evidências e limites](../planejamento/validacao-incremento-558.md).

Atualização 550: disponibilização de plano aprovado antes da pausa aceita autorização específica sem recriar proposta ou decisão. 14 integrações, lint e tipos aprovados; conexão à interface ainda pendente. [Evidências e limites](../planejamento/validacao-incremento-550.md).

Atualização 557: fila e detalhe docente de segunda chamada conectados à realização e nota original, com acesso limitado e reenvio seguro. Onze integrações, lint e build aprovados; ensaio interativo e demais cenários pendentes. [Evidências e limites](../planejamento/validacao-incremento-557.md).

Atualização 556: professor designado pode registrar a nota da própria segunda chamada, com conferência da atribuição atual e histórica. Onze integrações de segunda chamada aprovadas; fila e detalhe docente continuam pendentes. [Evidências e limites](../planejamento/validacao-incremento-556.md).

Atualização 555: nota original de segunda chamada autorizada após encerramento corrigida no servidor e nos guards do banco, preservando outro contrato ativo. 106 integrações aprovadas; asserção negativa refinada e reconferida. [Evidências e limites](../planejamento/validacao-incremento-555.md).

Atualização 554: autorização especial de segunda chamada conectada à gestão, com identificação, prazo/fuso, reenvio e histórico paginado. Nove integrações, lint e build aprovados; ensaio interativo e demais fluxos pendentes. [Evidências e limites](../planejamento/validacao-incremento-554.md).

Atualização 553: segunda chamada exige autorização já vigente na data, fonte correta e gestor habilitado; oito integrações, lint e tipos aprovados. Interface de autorização e demais cenários ainda pendentes. [Evidências e limites](../planejamento/validacao-incremento-553.md).

Atualização 552: histórico de autorizações de realização paginado e restrito à tentativa; testes direcionados, lint e build aprovados. Q163 aguarda decisão sobre a passagem de pausa para encerramento. [Evidências e limites](../planejamento/validacao-incremento-552.md).

Atualização 551: interface de disponibilização conectada à autorização especial, inclusive para plano aprovado antes da pausa. Quatro integrações, lint e build aprovados; validação interativa e demais casos Q151 pendentes. [Evidências e limites](../planejamento/validacao-incremento-551.md).

Atualização 549: projeção do portal validada para recuperação oficial após encerramento. Dois testes, lint e tipos aprovados. Auditoria identificou continuação de plano aprovado antes da pausa ainda pendente. [Evidências e próximos ajustes](../planejamento/validacao-incremento-549.md).

Atualização 548: recuperação após encerramento validada até nota oficial e consolidado, sem autoaprovação ou reativação. Dois cenários integrados, lint e tipos aprovados. Ensaio interativo e auditoria integral permanecem pendentes. [Evidências e limites](../planejamento/validacao-incremento-548.md).

Atualização 547: recuperação preparada após encerramento efetivo validada até realização autorizada, preservando matrícula/alocação encerradas. 94 integrações acadêmicas, lint e tipos aprovados. Validação interativa e auditoria integral pendentes. [Evidências e limites](../planejamento/validacao-incremento-547.md).

Atualização 546: histórico de autorizações de preparação conectado à gestão com paginação e isolamento por vínculo. Integração direcionada, lint e build aprovados; ensaio interativo e cenários adicionais Q151 pendentes. [Evidências e limites](../planejamento/validacao-incremento-546.md).

Atualização 545: interface de autorização de preparação conectada à proposta; revisão de planos reflete vigência e permissões atuais. Dois cenários integrados, lint e build aprovados. Histórico completo e validações adicionais Q151 pendentes. [Evidências e limites](../planejamento/validacao-incremento-545.md).

Atualização 544: aprovação e disponibilização de plano com autorização de preparação conectadas ao servidor e banco, sem liberar reserva ou realização. 12 integrações de planos e cenário SQL direcionado aprovados; lint e tipos aprovados. Interface de preparação e verificações adicionais pendentes. [Evidências e limites](../planejamento/validacao-incremento-544.md).

Atualização 543: autorização específica permite preparar proposta de recuperação após pausa/encerramento, com referência preservada e sem executar as etapas seguintes. 12 integrações de planos, lint e tipos aprovados. Aprovação/disponibilização e interface desse caminho pendentes. [Evidências e limites](../planejamento/validacao-incremento-543.md).

Atualização 542: interface da autorização pré-reserva conectada à gestão, com histórico paginado, prazo/fuso e reserva vinculada. Integração direcionada, lint e build aprovados. Ensaio interativo e demais caminhos Q151 pendentes. [Evidências e limites](../planejamento/validacao-incremento-542.md).

Atualização 541: autorização pré-reserva por plano/habilidade implementada no servidor e banco, sem ampliar prazo geral ou tentativas. Regressão executada e mensagem de cancelamento corrigida; testes afetados, lint e tipos aprovados. Interface e demais caminhos Q151 pendentes. [Evidências e limites](../planejamento/validacao-incremento-541.md).

Atualização 540: operação do plano mostra autorização vigente por tentativa, preservando conferência de fatos históricos. Integração direcionada, lint e tipos aprovados. Auditoria confirma pendência Q151 antes da reserva. [Evidências e próximos caminhos](../planejamento/validacao-incremento-540.md).

Atualização 539: proteção temporal no banco e recuperação autorizada após encerramento efetivado, preservando matrícula encerrada. 92 integrações acadêmicas, lint e tipos aprovados; Q151 permanece parcial. [Evidências e limites](../planejamento/validacao-incremento-539.md).

Atualização 538: interface de autorização específica de recuperação conectada à gestão, com identificação da matrícula, prazo/fuso e histórico. Integração direcionada, lint, build e tipos aprovados; ensaio interativo e demais casos Q151 pendentes. [Evidências e limites](../planejamento/validacao-incremento-538.md).

Atualização 537: realização de recuperação consulta autorização específica e preserva referência aplicada. Cenário com pausa contratual, lint e build aprovados; 91 integrações acadêmicas aprovadas. Interface e demais casos Q151 permanecem pendentes. [Evidências e limites](../planejamento/validacao-incremento-537.md).

Atualização 536: registro de autorização especial de recuperação implementado com persistência e validação de escopo; quatro unitários, um cenário integrado, lint e build aprovados. Consumo da autorização e interface ainda pendentes. [Evidências e limites](../planejamento/validacao-incremento-536.md).

Atualização 534: suíte unitária completa com 1.105 aprovações, sem falhas; mensagem de calendário financeiro fora da vigência corrigida. Lint e TypeScript aprovados. [Evidências e limites](../planejamento/validacao-incremento-534.md).

Atualização 533: Q99 integrada às condições contratuais, validação do banco, formulário e prévia mensal, preservando versões antigas e retomada. 31 unitários, 12 integrações de condições, um cenário completo de prévia, lint e build aprovados. Emissão recorrente e Q161/Q162 continuam pendentes. [Evidências e limites](../planejamento/validacao-incremento-533.md).

Atualização 532: composição de vencimento financeiro implementada e validada com cinco testes e lint; integração contratual, banco e formulário ainda pendentes. [Evidências e próximos pontos](../planejamento/validacao-incremento-532.md).

Atualização 531: conferência da cadeia integrada à prévia mensal, considerando cancelamentos, suspensões e regularizações efetivamente aplicadas. 18 integrações financeiras, um cenário mensal completo, 11 testes unitários, lint e build aprovados. Emissão recorrente, Q161/Q162 e integração dos dias úteis continuam pendentes. [Evidências e limites](../planejamento/validacao-incremento-531.md). Validação geral anterior: 1.073 integrações aprovadas no incremento 528.

Atualização 527: retomada exige histórico correspondente e confere a restrição antes de retornar sucesso. Suíte unitária completa com 1.078 aprovações após correção de mocks; 27 integrações, lint e build aprovados. Q161 e emissão recorrente continuam pendentes. [Evidências e limites](../planejamento/validacao-incremento-527.md).

Atualização 526: banco preserva fonte, seleção e eventos da retomada; valida transições e papéis da decisão. 27 integrações de pausa/retomada, uma regressão mensal e lint aprovados. Migrações somente no banco de teste; emissão recorrente e Q161 continuam pendentes. [Evidências e limites](../planejamento/validacao-incremento-526.md).

Atualização 525: planejamento mensal reconhece cobertura parcial de retomada efetivamente aplicada, conferindo a origem persistida e preservando o próximo ciclo integral. Dezoito unitários, 26 integrações e três revalidações/cenário mensal aprovados; lint e build aprovados. Q161 e emissão recorrente seguem pendentes. [Evidências e limites](../planejamento/validacao-incremento-525.md).

Atualização 524: a prévia mensal impede cobertura sobre dias programados de compensação da mesma matrícula. 25 unitários, dois cenários de integração, lint e build aprovados. Q161 aguarda decisão sobre comprovação da oferta; emissão recorrente segue pendente. [Evidências e limites](../planejamento/validacao-incremento-524.md).

Atualização 523: Q160 implementada na configuração e no cálculo de vencimentos pela cobertura, sem presumir regra legada nem alterar cobranças existentes. 22 unitários, 11 integrações, lint e build aprovados. Emissão recorrente permanece pendente. [Evidências e limites](../planejamento/validacao-incremento-523.md).

Atualização 522: reconferência de aprovação obsoleta e regularizações sucessivas de cobertura reprogramada implementadas com versões, aprovação independente e histórico. 32 integrações, lint e build aprovados. Emissão recorrente e ensaio interativo seguem pendentes; SPEC integral em implementação. [Evidências e limites](../planejamento/validacao-incremento-522.md).

Atualização 518: seleção de condição mensal compartilhada e regressão de indisponibilidades sobrepostas. Dezesseis unitários, seis integrações de término e cenário mensal aprovados; lint e build aprovados. Ensaio de interface pendente por bloqueio automático da inicialização local; emissão recorrente ainda em implementação. [Evidências e limites](../planejamento/validacao-incremento-518.md).

Atualização 517: Q156 com proposta e aprovação independente de término, histórico preservado e intervalo efetivo integrado. Quinze integrações e cenário mensal adicional aprovados; lint e build aprovados. Interface sem ensaio interativo; Q157 e emissão recorrente seguem pendentes. [Evidências e limites](../planejamento/validacao-incremento-517.md).

Atualização 516: consulta de indisponibilidade com escopo e projeção limitada, confirmação concorrente validada e datas de eventos no fuso institucional. Dez integrações, lint e build aprovados. Q156 incorporada à SPEC, ainda sem fluxo implementado; Q157 e emissão recorrente seguem pendentes. [Evidências e limites](../planejamento/validacao-incremento-516.md).

Atualização 515: confirmação independente da falta de oferta integrada à prévia, com correção de vigência de condições futuras. 41 integrações aprovadas; cenário mensal revalidado após a correção, lint e build aprovados. Encerramento/retificação de intervalos e emissão recorrente permanecem pendentes. [Evidências e limites](../planejamento/validacao-incremento-515.md).

Atualização 514: prévia na interface e cenário positivo após ativação; registro imutável de relatos de falta de oferta. 45 integrações em duas rodadas e build aprovados. Confirmação da indisponibilidade e emissão recorrente permanecem pendentes. [Evidências e limites](../planejamento/validacao-incremento-514.md).

Atualização 513: conferência do preço de continuidade ligada à preparação histórica, aceite e aditivos; 42 integrações e build aprovados. Consulta preparatória não emite cobrança; oferta por período e emissão recorrente seguem pendentes. [Evidências e limites](../planejamento/validacao-incremento-513.md).

Atualização 512: interface de continuidade mensal integrada e regras completas protegidas no banco; seis integrações, onze unitários e build aprovados. Sem ensaio interativo; emissão recorrente e validação de oferta/preço permanecem pendentes. [Evidências e limites](../planejamento/validacao-incremento-512.md).

Atualização 511: condições de continuidade mensal versionadas, vinculadas ao contrato confirmado e com aprovação independente; planejador separa cobertura, vencimento e antecedência. Cinco integrações e sete unitários aprovados. Emissão recorrente, disponibilidade da escola por período e interface seguem pendentes. [Evidências e limites](../planejamento/validacao-incremento-511.md).

Atualização 510: resolvedor mensal formalizado e integração na geração legada de parcelas. 40 integrações, dez unitários e build aprovados. A contratação preparada ainda exige implementação de emissão recorrente; este incremento não comprova esse fluxo completo. [Evidências e limites](../planejamento/validacao-incremento-510.md).

Atualização 509: aditivo de preço validado até conferência, fechamento e emissão por hora; 57 integrações, sete testes do resolvedor e build aprovados. Assinatura externa simulada; mensalidades e agenda seguem pendentes. [Evidências e limites](../planejamento/validacao-incremento-509.md).



**Integração 394:** 129 testes aprovados em nove arquivos de avaliações, diário, reposições, agenda e identidade. Build aprovado no incremento 393. Segunda chamada, entregas no portal, fechamento/progressão e demais requisitos seguem em implementação. [Evidências e limites](../planejamento/validacao-incremento-394.md).


**Incremento 393 — estado atual:** identidade e rotas do portal integradas; build aprovado com 61 páginas estáticas. Agenda de reposições e frequência integradas com correções de vínculo, cotas e períodos. Entrega pelo portal, segunda chamada e demais frentes da SPEC permanecem em desenvolvimento. Evidência de testes e limites: [validação 393](../planejamento/validacao-incremento-393.md). Os incrementos abaixo são histórico, não comprovação da entrega integral.


**Integração 381:** 113 testes acadêmicos, de diário e reposição aprovados em cinco arquivos. Correção de UTC e isolamento de contratos conferidos; agenda por pedido, benefícios e portal do aluno continuam em implementação. [Evidências e limites](../planejamento/validacao-integracao-terra-381.md).

**Integração 378 em andamento:** substituição aprovada e aplicada passou nos testes focados; a rodada completa encontrou duas falhas na frequência em integração. Migração de reposições e nova validação de fontes ainda exigem conclusão e nova rodada. [Estado e evidências](../planejamento/validacao-integracao-terra-378.md).

**Incremento 377:** propostas versionadas de substituição com conferência atual, histórico e isolamento de acesso; 81 integrações acadêmicas aprovadas. Aprovação/aplicação seguem em implementação paralela com subagentes Terra. [Evidências e limites](../planejamento/validacao-incremento-377.md).

**Incremento 376:** conferência preparatória de substituição do avaliador da recuperação agendada, preservando o encontro e verificando conflitos, prazo, calendário, ausências e reservas. 79 integrações acadêmicas, lint e build aprovados. [Evidências e próxima integração](../planejamento/validacao-incremento-376.md). Ainda não persiste proposta nem aplica substituição.

**Incremento 375:** horário aprovado da recuperação no plano e nas consultas docentes autorizadas, com início/fim, avaliador, estado e escolha local do fuso de exibição. 77 integrações acadêmicas, lint e build aprovados. [Evidências e limites](../planejamento/validacao-incremento-375.md). Não representa agenda semanal unificada ou portal do aluno.

**Incremento 374:** cancelamento de recuperação agendada por iniciativa da escola, com proposta, conferência independente e aplicação atômica. Libera somente tentativas pendentes, preservando realizações e consumos. 80 integrações aprovadas, três cenários finais repetidos, lint e build aprovados. [Evidências e limites](../planejamento/validacao-incremento-374.md). Cancelamento/falta do aluno, remarcação e notificações continuam pendentes.

**Incremento 373:** aprovação independente e publicação atômica do horário de recuperação, exceção explícita de calendário e realização vinculada ao encontro. 101 integrações direcionadas aprovadas, com repetição dos quatro casos finais, dois unitários, lint e build. [Evidências e limites](../planejamento/validacao-incremento-373.md). Remarcação/cancelamento e notificações ainda não estão entregues.

**Incremento 372:** recuperações separadas das particulares nos impactos de calendário e encerramento, preservando memórias antigas. 28 integrações direcionadas, dois unitários, lint, TypeScript e build aprovados. [Evidências e limites](../planejamento/validacao-incremento-372.md). Publicação de recuperação ainda depende da aprovação específica.

**Incremento 371:** classificação de encontros e segregação de recuperações nos fluxos de diário e particular cobrável. Migration 164 aplicada somente ao banco descartável. [Evidências e dependências](../planejamento/validacao-incremento-371.md). Não libera publicação de recuperação sem aprovação específica.

**Incremento 370:** preparação e revisão de propostas de agenda de recuperação, com histórico imutável e conferência atual. [Evidências e pendências](../planejamento/validacao-incremento-370.md). Publicação depende da classificação dos encontros nos consumidores acadêmicos e financeiros; nenhuma proposta gera cobrança.

**Incremento 369:** conferência e tela de prévia da agenda de recuperação; calendário, prazo, avaliador, encontros entre contratos, indisponibilidades e reservas comerciais. [Evidências e limites](../planejamento/validacao-incremento-369.md). O horário não é reservado/publicado por essa consulta.

**Incremento 368:** proteção SQL de autoria de extras alinhada ao servidor, com bloqueio de vínculo futuro, professor fora da titularidade e turma concluída. 65 integrações de avaliações aprovadas; [evidências e pendências](../planejamento/validacao-incremento-368.md). Escopo integral permanece em implementação.

**Incremento 367:** validação concorrente de oportunidades extras de recuperação e fluxo com limite original zero; 62 integrações de avaliações aprovadas. Tela apresenta a composição do limite. [Evidências e pendências](../planejamento/validacao-incremento-367.md). Não conclui Q150/Q154 nem substitui a regressão integral histórica.

**Regressão completa mais recente: incremento 371.** 839 unitários em 91 arquivos e 738 integrações em 55 arquivos aprovados em 14/09/2026, sem falhas ou testes pendentes, após a migration 164 de finalidade dos encontros. Evidências: [unitários](../validacao-finalidade-unitarios-371-2026-09-14.json) e [integração](../validacao-finalidade-integracao-371-2026-09-14.json). Isso não comprova os requisitos ainda sem implementação, a migração integral para matrícula nem homologação operacional. Consulte os [limites da entrega](../planejamento/validacao-incremento-371.md) e a [revisão dos consumidores contratuais](../planejamento/revisao-consumidores-contratuais-354.md).

**Ampliação acadêmica 266–272:** designação por tentativa de recuperação, fila docente e histórico próprio, regularização com realizador/registrador separados, correção aprovada de nota/comentário e fila conjunta dos impactos foram implementadas com testes. A resolução das revisões de progressão e os demais fluxos pendentes continuam descritos na SPEC acadêmica.

**Versão:** 1.19 — 13/09/2026. **Estado:** especificação consolidada para revisão técnica. Regras aprovadas e novas frentes ainda em refinamento são identificadas separadamente; estruturas, nomes de operações e sequência técnica são propostas de implementação. Especificar não significa implementar, testar ou homologar.

**Execução (atualizada em 13/09/2026):** [B01 em implementação — evidências e limites](../planejamento/implementacao-b01.md) reúne os incrementos de matrícula, financeiro, acesso, agenda e diário. A publicação inicial da grade possui preparação/revisão na interface e aprovação transacional; início de turma está integrado ao cron e conclusão exige meta/pendências conferidas. Calendário/grade inicial e preparação de revisão ajustada têm ensaios interativos documentados. A revisão do calendário permite conferir datas/conflitos, guardar versões e consultar seu conteúdo histórico, mas a decisão/aplicação conjunta permanece indisponível. Remanejamento global, conclusão normal com gravação, partes das avaliações e demais requisitos continuam incompletos. Reservas e ativação comercial possuem os avanços específicos descritos abaixo. O [relatório consolidado](../41-situacao-consolidada-do-projeto.md) identifica a regressão mais recente. REQ-01 também permanece incompleto, incluindo encerramento contratual e múltiplos vínculos simultâneos. Nenhuma contagem de testes substitui a comprovação de cada requisito aprovado.

**Comercial, contrato e diário até 282:** a preparação mantém condições e reserva; emissão inicial, PDF institucional, participantes, protocolo de envio, preservação de assinaturas e aceite integrado possuem implementações e testes. O caminho de ativação converte reserva em alocação de turma ou encontros particulares, respeitando a exigência contratada de pagamento inicial. O diário particular registra conteúdo/presença e permite conclusão por exceção de gravação com decisão independente. Resolução e nova reserva possuem fluxos registrados em B01. A integração real de assinatura continua pendente; as fixtures de protocolo não comprovam operação externa. Permanecem sem conclusão a gravação integrada, correção/regularização do diário, apuração e saldo de horas, múltiplas alocações de turma e os demais requisitos discriminados nas SPECs. A execução periódica depende de homologação do agendador externo.
**Avaliações — incrementos 230–246:** cálculo exato de notas e efeito da recuperação, regras versionadas com publicação independente, seleção inicial para turmas futuras e migração aprovada antes do início possuem código e evidências próprias. As telas permitem configurar regras e revisar a migração com comparação, histórico e impedimentos atuais. A [SPEC de avaliações](../specs/avaliacao-por-habilidades.md) discrimina os critérios atendidos e as limitações. Registro versionado e oficialização independente de notas possuem ações e consulta de servidor (236) e telas de lançamento/conferência (237), com acompanhamento das notas regulares oficializadas e memória do cálculo (238), além de painel por vínculo e navegação do histórico próprio docente (239) e escolha de fuso no detalhe da avaliação (240). Proposta de correção de nota oficial possui persistência e ação no servidor (241), com decisão independente e aplicação no consolidado (242), com formulários e histórico (243); fila de acompanhamento dos impactos entregue (244), com resolução ainda pendente. Conteúdo das notas também é validado no banco contra a regra vinculada (246). Gestão de oportunidades, frequência, equivalências, fechamento e portal continuam pendentes; as telas novas não têm ensaio interativo documentado. O cálculo puro e os parâmetros publicados não substituem esses fluxos.

**Ampliação acadêmica até 264:** designação limitada e autoria das avaliações, planos aprovados de recuperação, disponibilização/prazos e prorrogações, reservas/realizações por habilidade, notas e conferência independente foram acrescentados no alcance da [SPEC acadêmica](../specs/avaliacao-por-habilidades.md). As telas de preparação, operação, notas e prorrogação estão conectadas. Os incrementos 266–272 acrescentaram designação e correção específicas da recuperação. Ainda faltam ocorrências do aluno, oportunidades extras, resolução dos impactos e integração com agenda/portal, além dos demais requisitos. Não houve homologação interativa dessas telas.

**Regressão histórica 265:** 771 unitários e 629 integrações aprovados; tipos, lint e schema conferidos. Build do mesmo código aprovado no incremento 264. [Evidência por arquivo](../validacao-regressao-265-2026-09-13.json). Essa validação não comprova requisitos ainda pendentes nem homologação interativa.

**Atualização 362:** chamada histórica exige conferência quando há alocações sobrepostas; não escolhe contrato implicitamente. Regressão inicial com 713/718 integrações, cinco fixtures corrigidas e 73 testes aprovados na repetição das suítes afetadas; após a proteção, 25 integrações direcionadas e 839 unitários aprovados. [Evidências e limites](../planejamento/validacao-incremento-362.md). A implementação continua parcial.

