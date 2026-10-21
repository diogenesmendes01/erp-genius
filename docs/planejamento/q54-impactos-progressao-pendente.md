# Q54 — integração pendente de impactos em progressão

Auditoria de código em 14/09/2026. Desenho técnico para implementação; não representa funcionalidade entregue.

`CasoRevisaoProgressao` aceita somente decisões de correção de nota regular ou recuperação. A decisão de correção de reposição ainda não guarda impactos nem cria casos. Estender a origem preservando as duas existentes, com FK específica, unicidade por solicitação/decisão e exatamente uma origem. Novo array de impactos deve ser produzido no servidor; registros históricos sem array continuam identificados como legados.

Ao aprovar retirada de regularização, derivar a alocação histórica da mesma matrícula e turma da aula original. Usar a fronteira efetivamente adotada por `frequencia-nivel-tx.ts`: `criadoEm <= aula.inicio` e `encerradaEm IS NULL OR aula.inicio < encerradaEm`. Ausência ou ambiguidade precisa de tratamento explícito, sem inventar vínculo. Não exigir cobertura até o fim da aula, pois diverge da apuração existente.

**Não reutilizar exclusivamente o coletor de equivalências de notas.** A frequência do fechamento agrega todos os vínculos da matrícula no mesmo nível, inclusive transferências de turma sem equivalência aplicada. O coletor de impactos de frequência deve alcançar solicitações aprovadas/executadas da mesma matrícula cuja alocação de origem pertença ao nível afetado. O guard SQL da nova origem deve aplicar o mesmo escopo; manter intactos os predicados das origens de nota.

Apresentar impactos antes de aprovação, vinculá-los por hash e revalidá-los ao decidir. Persistir decisão, impactos e casos na mesma transação. Rejeição não cria casos; nova conclusão posterior não os resolve automaticamente. Não movimentar aluno, alterar cobrança ou consumir/devolver cota por consequência da correção.

Expandir consulta/fila e resolução de casos para a terceira origem, preservando aprovação independente e fechamento atualizado. Testar especialmente: mesma matrícula/nível com transferência sem equivalência, outra matrícula do mesmo aluno excluída, outro nível excluído, limites temporais, origem ambígua, hash obsoleto, fonte forjada por SQL, repetição sem duplicação e preservação de movimentos/benefícios. Verificar se correção que conserva regularização modifica hashes de fechamento sem alterar percentual; a revisão desse efeito ainda precisa ser implementada e validada.
