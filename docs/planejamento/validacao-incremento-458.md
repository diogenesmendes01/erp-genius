# Incremento 458 — publicação de correções de aula

Data: 15/09/2026. Meta integral ativa; este incremento não encerra Q23.

## Implementação

- A gestão pode publicar uma proposta de correção pela ação `aprovarCorrecaoAula` e pela interface de conferência. Exige decisão de outra pessoa, justificativa e revalidação da proposta e dos impactos dentro da transação.
- A identidade e os papéis são relidos sob lock; reenvio só repete a mesma decisão, com o mesmo decisor, hashes e motivo. Aprovação e evento são persistidos juntos. O diário original permanece preservado; os leitores usam a correção publicada.
- A interface exige a conferência atual antes de oferecer publicação, recarrega o histórico após sucesso e preserva o fluxo de rejeição.
- Correções de participação que afetem reposições existentes e aulas com dependências financeiras permanecem bloqueadas nesta etapa, com indicação da pendência. Isso é uma limitação transitória da implementação, não uma decisão de produto que exclui esses casos da meta. Nenhum estorno, crédito, refaturamento ou liberação de benefício é presumido.
- Casos de revisão de progressão continuam sendo criados atomicamente pelo banco. A existência desses impactos não impede publicar; impede reutilizar uma aprovação acadêmica sem a resolução aplicável.

## Verificação

- 34 testes de integração aprovados em `docs/validacao-publicacao-q23-458-2026-09-15.json`: publicação concorrente e repetição, permissões, hashes obsoletos, proposta superada, dependência nova de reposição, correção textual com reposição preservada e ocorrência financeira real mantida pendente, além das regressões dos dois arquivos.
- TypeScript e lint dos arquivos alterados aprovados.
- Mais 6 integrações aprovadas em `docs/validacao-publicacao-progressao-458-2026-09-15.json`. Os cenários Q23 agora publicam pela ação pública antes de conferir os casos automáticos, o bloqueio da execução pendente e a reconfirmação com novo fechamento. Escrita interna permanece somente para testar adulteração de impactos no banco e outros fluxos específicos.
- Build aprovado (62 páginas geradas), incluindo TypeScript. Total desta etapa: 40 integrações aprovadas nos três arquivos; isso não é uma execução da suíte completa.

## Pendências

Integrar a decisão e os efeitos financeiros, a resolução das reposições afetadas e o material oficial de gravação. A publicação desses casos não está concluída. Sem validação visual nova em navegador, deploy ou alteração em produção. Migrations 208/209 permanecem inalteradas; nenhuma nova migration nesta etapa.
