# Incremento 607 — coerência das fontes da continuidade

16/09/2026. Objetivo integral permanece em andamento.

## Mudanças

Condições de continuidade mensal agora exigem preparação comercial mensal da própria matrícula na consulta, na preparação, na aprovação e no banco. Ausência de preparação deixa um impedimento visível, sem presumir contrato ou preço legado. Uma proposta inválida ainda pode ser rejeitada pelo fluxo autorizado. A função auxiliar de impedimento fica em módulo interno separado das ações do servidor.

A confirmação positiva de oferta passa a conferir também um hash do contexto consultado pelo detector: vínculos, turma, grades, encontros, situação docente, indisponibilidades aprovadas e calendário vigente. Isso ocorre mesmo quando a agenda continua insuficiente. Alterar horários sem mudar essa classificação já invalida a fonte anterior. Datas são serializadas explicitamente antes do hash. O contexto considera as fontes selecionadas do detector; não é uma cópia de todos os dados da escola.

A migração 144 exige preparação mensal nas condições. A 145 reforça o registro de emissão: matrícula ativa, contrato/documento atual, preparação mensal, condição aprovada correspondente e cobrança inicialmente pendente, com saldo integral e sem recebimento/crédito/baixa. Mantém as verificações anteriores de memória, cobertura consecutiva, unicidade e imutabilidade. Não replica integralmente o planejador e a prova de oferta no SQL.

As duas migrações passaram por preflight com rollback e foram aplicadas exclusivamente no banco descartável. Estão congeladas; próxima migração 146. A emissão operacional permanece desligada.

## Validação

**72 cenários integrados distintos aprovados**, considerando a execução inicial e as repetições corrigidas: 37 aditivos/continuidade, 13 condições mensais, dois registros de emissão SQL, seis confirmações de oferta e 14 agendas. Evidências: `docs/validacao-integrada-607-2026-09-16.json`, `docs/validacao-q162-final-607-2026-09-16.json`, `docs/validacao-fontes-sql-final-607-2026-09-16.json` e `docs/validacao-ledger-final-607-2026-09-16.json`. Não contar testes pulados pelo filtro nem repetições como novos cenários.

O cenário Q162 passa por contratação, condições, ativação, emissão, direitos de compensação e recomposição pelas ações correspondentes, com aprovação independente. A cobertura emitida de 01/11–30/11 é deslocada para 03/11–02/12; as emissões seguintes cobrem 03/12–02/01 e 03/01–02/02. Conferimos a ausência de sobreposição, manutenção do vencimento antigo e memória de ambas as emissões com a origem aplicada e referência 03/12. A identidade de matrícula e o preço vêm da contratação estruturada; não há mock dos carregadores de continuidade. O transporte de assinatura é simulado, como nas demais fixtures contratuais.

Os testes SQL específicos montam dados sintéticos coerentes e tentam inserir registros de emissão para matrícula pausada ou cobrança já quitada; ambos são recusados. A integração contratual positiva demonstra que o guard também aceita a emissão regular.

**13 testes unitários aprovados**, em `docs/validacao-unitaria-607-2026-09-16.json`. Incluem mudança de horário mantendo classificação insuficiente e recusa de consumir confirmação cujo contexto mudou. TypeScript, lint dos arquivos alterados e build passaram: `docs/validacao-tipos-final-607-2026-09-16.log`, `docs/validacao-lint-final-607-2026-09-16.log`, `docs/validacao-build-final-607-2026-09-16.log`.

As falhas iniciais foram preservadas nos relatórios: helper síncrono exportado em arquivo de ações do servidor (separado em módulo interno); fixture sem prazo de reserva ou preparação/reserva válida; confirmação contratual ausente; sessão que tentava autoaprovação; e preço de origem deliberadamente inconciliável do teste antigo de aditivo. A fixture Q162 recebeu preço inicial coerente, mantendo o comportamento anterior dos outros cenários. Também foi corrigida a queda no trecho de teste que esperava ausência de oferta depois de já emiti-la. Nenhuma barreira de domínio foi removida para corrigir essas fixtures.

## Pendências

Combinações de recomposição com retomada e regularização integral sem precedência definida continuam exigindo conferência. A contratação externa do serviço de assinatura, homologação com dados reais, agendamento operacional e demais funcionalidades do projeto permanecem fora da comprovação deste incremento. Não houve envio real, produção ou homologação interativa.
