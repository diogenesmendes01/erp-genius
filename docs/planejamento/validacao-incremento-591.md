# Incremento 591 — Rejeição e consulta administrativa de propostas obsoletas

Data: 16/09/2026. Objetivo integral em andamento.

## Lacuna confirmada

A migration 132 permite rejeição SQL de propostas desatualizadas sem exigir condições de aplicação. As ações e consultas do servidor ainda validavam o vínculo atual antes de distinguir aprovação, rejeição ou leitura histórica. Assim, um vínculo que mudasse de contrato podia bloquear a rejeição e ocultar o histórico da equipe autorizada.

## Comportamento requerido

Separar a validação necessária para aplicar uma mudança da leitura/rejeição da proposta original. Aprovação conserva as verificações atuais; rejeição exige papel ativo, outra pessoa, hash e motivo, preservando auditoria e idempotência. Identificar a matrícula/turma originais. Quando o contexto não for vigente, a tela deve sinalizar a situação, impedir preparação/aprovação e oferecer a rejeição somente a quem pode decidir.

## Evidências

As três ações distinguem rejeição/replay histórico da aprovação com contexto estrito. As consultas identificam a matrícula e turma de origem; comparação explícita de alocação/matrícula/turma/regra determina `contextoVigente`. O histórico permanece consultável e a rejeição independente disponível quando o vínculo mudou. As três telas retiram a opção de aprovação nesse caso.

- Integração direcionada: três casos aprovados (inicial, remarcação e substituição), incluindo contexto alterado, histórico original, bloqueio de aprovação, autor/Secretaria/administrador inativo/hash incorreto recusados e rejeição idempotente. Evidência: `docs/validacao-integrada-obsoleta-final-591-2026-09-16.json`.
- A primeira execução falhou nos três casos por fixture sem código da nova matrícula: a asserção procurava `null`. A fixture agora identifica explicitamente a matrícula nova e verifica que seu código não aparece no histórico original. Evidência inicial preservada: `docs/validacao-integrada-obsoleta-591-2026-09-16.json`.
- Dez testes de renderização aprovados: `docs/validacao-interface-591-2026-09-16.json`.
- Tipos, lint e build aprovados: `docs/validacao-tipos-591-2026-09-16.log`, `docs/validacao-lint-591-2026-09-16.log`, `docs/validacao-build-591-2026-09-16.log`.
- Regressão integrada conjunta: **101 testes aprovados**, sem falhas ou ignorados, em oito arquivos de segunda chamada. Inclui novamente os três novos casos; não somar as duas execuções como testes distintos. Evidência: `docs/validacao-integrada-final-591-2026-09-16.json`. Banco exclusivo de teste `localhost:54329/erp_genius_test`, migrations até 132; nenhuma migration nova neste incremento.

Revisão independente não identificou bypass de replay ou inversão de bloqueios. O flag `podeAprovar` desta consulta verifica permissão e contexto estrutural; não certifica antecipadamente todos os requisitos de aplicação. Prazo, saldo, calendário, disponibilidade e cobertura contratual continuam revalidados pelo servidor/banco na decisão. Uma mudança nessas condições pode exigir nova proposta mesmo com o botão disponível.

## Limites

Sem homologação interativa, produção, envios externos ou importação real. Este incremento não encerra o objetivo integral nem presume resposta para Q164.
