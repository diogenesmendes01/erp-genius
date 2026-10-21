# Incremento 452 — interface Q23 e proteção dos originais

Data: 15/09/2026. Meta integral ativa. Trabalho integrado do orquestrador e de três agentes Terra.

## Entrega

- O histórico do diário oferece acesso à preparação de correção para gestão e professor ainda vinculado. Professor desvinculado conserva o diário em leitura, sem link de proposta; a ação também revalida seu acesso.
- A rota `/diario/encontros/[id]/correcao` prepara uma proposta real com motivo, evidência, participação e observações. Preserva a identidade dos alunos/matrículas, controla versão e idempotência e apresenta erros reais do servidor.
- A gestão consulta propostas existentes e seus impactos sem precisar ter criado a proposta na mesma aba. O histórico mostra as vinte propostas mais recentes, autor, instante, motivo, evidência e diferenças persistidas. Não há paginação para propostas anteriores nesta entrega.
- A conferência mostra frequência e elegibilidade antes/depois, pendências, reposições e existência de dependências financeiras. Não expõe valores financeiros nem publica a correção.
- Migration 204 (`20260915034000_proteger_originais_aula`) protege AULA/MINISTRADO: encontro, diário e chamada não podem ser alterados, removidos, reassociados ou receber inclusões tardias. PREVISTO pode ser preenchido e concluído; REPOSICAO conserva seu fluxo próprio.
- A ação de diário legado agora obtém o lock institucional antes de matrícula/turma, eliminando a inversão introduzida pela proteção do banco. Um teste observa a espera real e confere que a turma continua livre enquanto o diário espera o calendário.

## Evidência

1. `docs/validacao-originais-aula-452-2026-09-14.json`: 29 testes aprovados de diário/correção na primeira rodada.
2. `docs/validacao-regressao-q23-452-2026-09-15.json`: regressão de 402 testes em 40 arquivos, inicialmente 396 aprovados e seis falhas. Este relatório preserva as falhas, não é uma execução integral verde.
3. As cinco falhas do portal vieram da fixture sem transição final para MINISTRADO. A falha de reposição tentava concluir, no relógio real do banco, um encontro ainda futuro. Corrigidas as fixtures sem desativar ou relaxar os guards.
4. `docs/validacao-revisao-final-q23-452-2026-09-15.json`: 45 testes aprovados nos quatro arquivos reexecutados, incluindo os dois arquivos anteriormente falhos, diário, Q23, histórico/navegação e o novo teste de concorrência. Os outros 36 arquivos não foram repetidos nesta última rodada.
5. Build final aprovado com a nova rota, TypeScript, lint direcionado e `git diff --check` aprovados. Sem validação visual em navegador nesta entrega.

## Limites e próxima implementação

Q23 ainda não está integralmente implementado. Faltam a decisão independente e sua publicação efetiva, a projeção compartilhada entre leitores, a fonte normal de gravação, o tratamento/aprovação dos efeitos financeiros e de reposição, e a nova origem de casos de revisão de progressão. A interface comunica que registrar/conferir proposta não altera o diário; não oferece aprovação fictícia.

A proteção também impede remendar diretamente diários legados incompletos de encontros já marcados MINISTRADO. Esses casos precisam de regularização explícita, incluindo Q24, ainda pendente. O histórico amplo de propostas para professor desvinculado e a paginação completa também precisam de implementação própria.

Migration aplicada apenas no PostgreSQL descartável de testes. Nenhum deploy, alteração de produção ou envio externo.
