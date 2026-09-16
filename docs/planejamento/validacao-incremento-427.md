# Incremento 427 — exceção independente de frequência

Data: 14/09/2026. Meta integral ativa, implementação e verificação locais.

## Implementação

Proposta versionada de exceção por matrícula e nível, com vínculo de referência, regra, frequência real, hash, motivo e evidências. Gestão Pedagógica/Administração prepara; outra pessoa autorizada decide. Proposta e decisão são imutáveis. Frequência incompleta ou não apurada não pode ser tratada como frequência insuficiente para obter exceção.

O fechamento passa a considerar somente a decisão aplicável ao contexto e à fonte atual. Proposta pendente impede o fechamento. Aprovação não altera faltas, presenças, reposições ou notas. Fonte alterada impede aprovação da proposta antiga e torna uma autorização anterior inaplicável ao novo fechamento; nova proposta mantém o histórico.

A tela de fechamento permite preparar e decidir, apresenta motivo/evidências e distingue autorização histórica de autorização atual. Autoaprovação fica bloqueada no serviço e no banco. Proposta obsoleta pode ser rejeitada; a interface permite preparar nova versão.

## Evidências

- Migração `20260915020000_excecao_frequencia` aplicada somente ao banco local descartável; comparação Prisma banco/schema vazia.
- **6/6 integrações**: exceção e regressão do fechamento. `docs/validacao-excecao-frequencia-427-2026-09-14.json`.
- Suíte de exceção ampliada: **2/2**, confirmando persistência de fechamento suficiente com frequência real de 0%, histórico protegido e perda de atualidade após nova falta. `docs/validacao-excecao-fechamento-427-2026-09-14.json`.
- **7/7 unitários** do motor de elegibilidade; ESLint direcionado, TypeScript e build completo aprovados (62 páginas estáticas).

## Limites

O fluxo operacional de progressão ainda precisa exigir esse fechamento nas etapas de aprovação e execução, com revisão após correções posteriores. O portal ainda precisa apresentar o fechamento validado. Não houve verificação visual no navegador, produção ou envios externos. Esta entrega não prova conclusão integral da SPEC.
