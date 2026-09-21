# Incremento 527 — eventos obrigatórios e regressão unitária

15/09/2026. Agente Terra implementou a migração 870 e outro agente corrigiu as simulações de conclusão de matrícula. O orquestrador revisou, integrou e verificou os fluxos.

## Retomada e histórico

A migração 870 exige os eventos correspondentes para a solicitação, decisão e aplicação de retomada. A decisão relaciona proposta, aluno, autor, estado anterior e novo estado; uma aprovação anterior não comprova uma rejeição posterior. A aplicação exige evento por matrícula selecionada. A conferência é diferida para permitir que a ação grave todos os componentes na mesma transação.

O primeiro teste identificou que a promessa da transação interativa podia resolver sem propagar a falha da restrição diferida no encerramento. Solicitação, decisão e aplicação agora executam explicitamente `SET CONSTRAINTS exigir_evento_transicao_retomada_matriculas IMMEDIATE` após gravar os componentes e antes de retornar sucesso. Os testes negativos fazem a mesma conferência ainda dentro da transação e verificam a preservação do estado após a recusa.

O teste ampliado recusa aprovação sem evento, evento com autor divergente, rejeição sem novo histórico e aplicação sem eventos. A aprovação e posterior rejeição legítimas continuam produzindo dois eventos preservados.

## Suíte unitária

A execução geral encontrou 1.070 testes aprovados e oito falhas, todas em `conclusao.test.ts`. As simulações estavam desatualizadas: faltava a consulta de condições de aditivo, e a resposta simulada da consulta de substituição contratual não representava ausência de substituição. Os mocks foram corrigidos; nenhuma regra de produção foi reduzida.

A repetição aprovou os 1.078 testes unitários. Evidências: `docs/validacao-unitarios-527-2026-09-15.json` conserva a primeira execução; `docs/validacao-unitarios-final-527-2026-09-15.json` registra a execução corrigida.

## Validação e limites

- Migração 870 aplicada somente ao banco descartável local.
- 27 integrações de pausa/retomada aprovadas após a conferência explícita: `docs/validacao-integracao-final-527-2026-09-15.json`. A tentativa anterior está em `docs/validacao-integracao-527-2026-09-15.json`.
- ESLint focado e compilação aprovados: `docs/validacao-build-527-2026-09-15.log`.

A restrição de eventos verifica a correspondência dos campos identificadores; não replica integralmente a reconferência dos impactos feita pelas ações. A aplicação exige eventos dos itens persistidos; a validação completa da seleção e da prévia continua necessária na aplicação. Não houve alteração de produção nem comunicação externa. Q161, emissão recorrente e demais pendências da SPEC continuam abertas; testes unitários aprovados não comprovam todos os fluxos integrados ou a interface.
