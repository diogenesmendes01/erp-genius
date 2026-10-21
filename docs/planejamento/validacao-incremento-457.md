# Incremento 457 — revisão de progressão por correção de aula

Data: 15/09/2026. Meta integral ativa.

## Implementação

- A correção de aula torna-se a quarta fonte de um caso de revisão de progressão, ao lado de notas regulares, recuperação e conclusão de reposição.
- A publicação deve materializar seus casos na mesma transação. Mudanças apenas de conteúdo/observação não criam revisão de frequência. A validação recompõe a mudança de participação a partir dos snapshots e confere as solicitações realmente afetadas; omitir impactos não pode evitar a revisão.
- Consulta e fila institucional identificam aula, versão e matrícula, preservando permissões. Colegas sem participação alterada ficam fora dos itens afetados. A nova coluna nula não muda hashes de casos históricos das outras três fontes.
- Execução de uma mudança aprovada fica bloqueada enquanto houver caso pendente. Restaurar uma presença não elimina o histórico da revisão nem permite reutilizar silenciosamente a aprovação antiga. Mudanças já executadas permanecem preservadas.

## Verificação

- 34 integrações aprovadas em Q23 e impactos de progressão/reposição: `docs/validacao-progressao-aula-457-2026-09-15.json`.
- A progressão real passa por fechamento, aprovação e execução. A correção cria os casos automaticamente; duas alterações de participação geram duas revisões, e a resolução independente exige novo fechamento. Aluno sem alteração na mesma turma não derruba a fila nem recebe caso indevido. Originais e movimentações permanecem intactos.
- O banco recusa omissão de impactos e indicação falsa de participação não alterada. Sem progressão anterior, a correção continua válida sem inventar casos. Na solicitação apenas aprovada, a ação e o SQL recusam execução enquanto houver revisão pendente, mesmo depois de restaurar a presença.
- Migrations 208 e 209 aplicadas somente ao PostgreSQL descartável. Prisma Client gerado; TypeScript e lint direcionado conferidos. Build aprovado, com ajuste posterior de chave da lista e filtragem de contextos novamente conferido pelo TypeScript e integrações.
- Regressão adicional concluída: 152 testes aprovados (89 de lançamentos e 63 do fluxo acadêmico), em `docs/validacao-regressao-progressao-457-2026-09-15.json`. `git diff --check` também aprovado.

## Limites

O comando público de publicação Q23 continua pendente da integração dos efeitos financeiros e das reposições existentes. Os testes exercitam a persistência interna da aprovação; não comprovam o fluxo público completo. Nenhum deploy, envio externo ou alteração em produção. Sem validação visual nova em navegador.
