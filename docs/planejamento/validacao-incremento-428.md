# Incremento 428 — fechamento exigido na progressão

Data: 14/09/2026. Meta integral ativa; validação local em andamento.

## Implementação

A aprovação da mudança de nível exige matrícula identificada, fechamento suficiente e atual e ausência de pendências. A solicitação guarda a versão e o hash do fechamento aprovado. A execução confere novamente as fontes e a mesma versão; correção ou fechamento posterior exige nova conferência, sem mover o aluno automaticamente. Parecer, dispensa justificada e separação de papéis permanecem obrigatórios.

A mudança administrativa do vínculo de origem para encerrado não invalida, por si só, a frequência histórica inalterada. Os intervalos continuam determinando quais aulas entram na apuração; mudanças que alteram as fontes ou as pendências alteram o hash.

## Evidências disponíveis

- Migração `20260915021000_progressao_fechamento` aplicada somente ao banco local descartável; comparação Prisma banco/schema vazia.
- 13/13 integrações direcionadas de progressão, fechamento, frequência e exceção: `docs/validacao-progressao-integrada-428-2026-09-14.json`.
- Build completo aprovado, incluindo TypeScript e geração de 62 páginas estáticas. `git diff --check` aprovado.
- Primeira regressão do fluxo: 59/63; primeira regressão de visibilidade: 4/6. Relatórios `docs/validacao-fluxo-progressao-428-2026-09-14.json` e `docs/validacao-visibilidade-progressao-428-2026-09-14.json`. Fixtures estão em adaptação para exigir fechamento real; esses resultados ainda não comprovam regressão integral aprovada.

## Pendências identificadas

Atualização: a regressão de fluxo e visibilidade foi corrigida e aprovada no [incremento 429](validacao-incremento-429.md). Os relatórios de falha acima permanecem como histórico.

O portal ainda precisa apresentar o fechamento validado. A fila de impactos de correções de notas não possui resolução persistida completa e precisa conferir efeitos transitivos de aproveitamentos. A revisão após progressão executada continua incompleta.

Auditoria do diário: `salvarAulaDiario` exige encontro PREVISTO e bloqueia alteração de encontro MINISTRADO. Portanto, não foi confirmado bypass pelo fluxo normal. Falta o fluxo independente Q23 para corrigir uma chamada concluída, com preservação do original, aprovação e efeitos sobre frequência/fechamento e revisões posteriores. Proteções contra escrita direta das fontes também exigem complemento.

Não houve homologação no navegador, implantação em produção ou envios externos. Este incremento não conclui a SPEC integral.
