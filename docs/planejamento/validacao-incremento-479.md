# Incremento 479 — regressão ampla e pendências contratuais

Data: 15/09/2026. Turno anterior classificado como progresso por alteração funcional e testes. Meta integral ativa.

## Unitários

Rodada completa inicial: 943 aprovações e três falhas, relatório preservado em `docs/validacao-unitarios-ampla-479-2026-09-15.json`. Duas expectativas de transferência direta eram incompatíveis com Q153 e o fluxo atual de equivalência com aprovação independente. Foram substituídas por verificações da recusa da rota antiga, sem criar ou atualizar alocação. O mock do diário não representava `$executeRaw`, usado pela trava do calendário; essa capacidade foi adicionada à fixture.

Nenhuma regra de produção foi relaxada para satisfazer testes. Reexecução completa: **946 testes aprovados em 113 arquivos**, relatório `docs/validacao-unitarios-ampla-479-final-2026-09-15.json`. Lint dos dois testes alterados aprovado.

## Integração ainda em execução

Iniciada a suíte completa de 87 arquivos com `vitest.integration.config.ts`, que fixa o banco descartável e desativa paralelismo entre arquivos. Processo conferido vivo pela sessão de execução `29713`; não reiniciar apenas porque o relatório final ainda não existe.

Saída incremental: `docs/validacao-integracao-ampla-479-2026-09-15.log`. Relatório final previsto: `docs/validacao-integracao-ampla-479-2026-09-15.json`. Este registro **não afirma aprovação** dessa suíte. Mensagens `prisma:error` podem ser geradas por testes de rejeição; avaliar o resultado terminal e cada falha antes de concluir.

## Lacunas funcionais confirmadas na revisão Terra

1. Q106/Q122: `src/server/contratos/envio-tx.ts` oferece primitivas internas de intenção/tentativa, mas não o transporte autenticado, worker e processamento completo das assinaturas. A página contratual ainda informa indisponibilidade do encaminhamento.
2. Q116: preparação de processo distinto é bloqueada; falta o fluxo de proposta, aprovação independente, cancelamento confirmado no fornecedor e substituição com tratamento de retornos tardios.
3. Q117: falta o fluxo de aditivos vinculados ao original, com proposta, aprovação, documento, assinaturas e vigência. A recusa de alterar um documento assinado não implementa o aditivo.

Os requisitos permanecem no escopo. A escolha de fornecedor está registrada como pendente em `docs/specs/documento-contratual.md` (Q155); não presumir fornecedor contratado. Essa dependência não impede o desenvolvimento dos fluxos internos ainda ausentes.

## Limites

Sem novo build ou validação visual nesta rodada. Unitários aprovados não comprovam toda a SPEC, integrações reais ou migração. Acompanhar o processo de integração existente antes de iniciar outro teste de banco; manter todas as falhas e corrigir pela regra aprovada, sem enfraquecer os requisitos.
