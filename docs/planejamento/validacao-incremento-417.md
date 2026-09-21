# Incremento 417 — fontes oficiais para aproveitamento

2026-09-14. Implementado `src/server/avaliacoes/fontes-equivalencia-tx.ts`: leitura interna por matrícula, alocação, turma, nível e regra, com conferência do vínculo. Retorna somente fontes com decisão de oficialização aprovada; correções pendentes não substituem a fonte vigente. A referência conserva lançamento, versão, autor, decisão e correção, com hash que muda quando a fonte aprovada muda. Não expõe comentários no DTO do mapeamento.

Integração: **4/4** testes passaram em `resultados.int.test.ts`, incluindo novo caso de leitura antes/depois da oficialização, correção pendente/aprovada e rejeição de contrato incompatível. Relatório final: `docs/validacao-fontes-equivalencia-417-corrigido-2026-09-14.json`. A primeira rodada teve erro da fixture, que omitia `origemHash` ao propor correção; foi corrigida sem flexibilizar o serviço.

TypeScript e ESLint direcionado passaram. Não há nova migração aplicada. A persistência da proposta/decisão/aplicação está sendo preparada separadamente. O coletor atual cobre avaliações regulares e suas correções; recuperação oficial e aproveitamento de transferências anteriores ainda precisam integrar a memória completa. Transferência e progressão não estão concluídas por este incremento.
