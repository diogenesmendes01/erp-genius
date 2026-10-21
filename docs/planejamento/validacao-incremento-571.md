# Incremento 571 — concorrência e resolução do impedimento

## Concorrência verificada

Foram adicionados cenários concorrentes de realização contra FALTA e contra IMPEDIMENTO_ESCOLA. Cada cenário usa duas transações reais no PostgreSQL: uma registra realização e outra usa o núcleo transacional da ocorrência. Exige exatamente um sucesso e uma rejeição, um único fato terminal, estado coerente do encontro, vínculo preservado e ausência de nota/cobrança automáticas. Não simula duas sessões HTTP: autorização das actions continua coberta pelos testes específicos existentes.

Os dois cenários direcionados passaram em `docs/validacao-concorrencia-571-2026-09-15.json`; lint do arquivo e TypeScript passaram. A rodada conjunta confirmou 54 integrações aprovadas, sem falhas ou pendentes, em `docs/validacao-integrada-571-2026-09-15.json`. Ela inclui a fixture corrigida no incremento 570.

## Resolução ainda em definição — Q164

A coleta de fechamento conta toda PENDENCIA_ESCOLA, mesmo após outra aplicação bem-sucedida. Foi enviada Q164 para definir se a resolução decorre da realização posterior com nota oficial, se exige confirmação da gestão ou aprovação independente adicional. Nenhuma opção foi presumida enquanto aguarda resposta; o histórico original permanece imutável.

A revisão identificou os vínculos necessários para qualquer caminho: mesma matrícula, alocação, turma, regra e código de avaliação, outra realização vinculada à nota oficial, com cronologia posterior ao impedimento. Rascunho, rejeição, nota de outro contrato ou avaliação não podem resolver a pendência. A prorrogação permanece um fluxo próprio aprovado quando necessária.

## Proteção da agenda

Revisão somente leitura dos agentes Terra não encontrou alteração por ações genéricas: substituição, cancelamento particular, diário e gravação exigem finalidade AULA. Continua pendente a proteção completa contra mutação SQL direta de encontros PREVISTO e a implementação dos fluxos próprios de alteração. Não declarar essa proteção concluída com base apenas nas negativas das actions.

Sem alteração de política de negócio, implantação, ensaio interativo ou dados reais neste incremento. A SPEC geral continua incompleta.

## Achado adicional para correção

A revisão da ordem dos bloqueios encontrou inversão concreta: `segunda-chamada-encontro.ts` e `segunda-chamada-agenda.ts` bloqueiam PropostaSegundaChamada antes do calendário; o guard de realização 111000 bloqueia reserva e calendário antes de solicitar SHARE da proposta. Uma criação/novo agendamento concorrente com realização pode formar ciclo proposta→calendário e calendário→proposta. Os testes deste incremento disputam apenas fatos terminais e não cobrem esse ciclo. Próximo passo: uniformizar ordem, revalidar o estado após espera e adicionar teste específico, sem alterar migrations já aplicadas.
