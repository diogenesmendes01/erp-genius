# Incremento 376 — Conferência da substituição de avaliador, 14/09/2026

## Alteração

A tela de designação distingue uma recuperação com horário publicado de uma tentativa sem agenda. Com encontro previsto, não apresenta mais o formulário direto de designação/revogação que o servidor já recusava. Para encontro futuro pendente, oferece consulta da disponibilidade de outro professor ativo, mantendo a atribuição atual.

A prévia identifica a tentativa e o encontro pelo banco, conserva seu intervalo e confere matrícula/vínculo, fontes do plano, prazo vigente, professor ativo e calendário/fuso institucionais. Mudança do calendário em relação à origem aprovada exige revisão; a conferência não concede outra exceção. Mostra o avaliador atual, substituto consultado, horário e pendências.

A verificação de disponibilidade é compartilhada com a preparação inicial da agenda. Abrange compromissos do professor e do mesmo aluno em outros contratos, alocações históricas, ausências aprovadas e reservas comerciais. Na substituição, exclui somente o encontro de origem recuperado e conferido pelo servidor; o cliente não informa uma exclusão arbitrária. Intervalos consecutivos não conflitam.

Consultar um substituto não grava designação, altera encontro ou concede acesso à tentativa. A substituição efetiva permanece pendente de proposta persistida, aprovação independente e aplicação conjunta; a nova tela identifica o resultado como conferência.

## Evidências

79 integrações acadêmicas aprovadas, sem testes omitidos na execução final, incluindo a preparação inicial da agenda que passou a usar a conferência compartilhada. [Relatório](../validacao-previa-substituicao-recuperacao-376-2026-09-14.json). Esta rodada é direcionada; a regressão integral do projeto permanece a do incremento 371, anterior às mudanças seguintes.

Dois cenários direcionados aprovados: preservação do encontro/atribuição e isolamento de acesso, com conflito de outro contrato do aluno e intervalo consecutivo; ausência solicitada versus aprovada, reserva comercial e recusa de professor inativo. Conferem que a designação permanece inexistente e o professor do encontro continua o original.

Lint dos arquivos alterados, TypeScript e build com 52 páginas estáticas aprovados. Sem migration, produção, envios externos ou homologação interativa.

## Próxima integração necessária

1. Persistir proposta com origem do encontro, versão da designação, substituto, motivo, estado conferido e idempotência. A prévia atual precisa ser repetida no momento da preparação e da aprovação.
2. Outra pessoa da gestão deve decidir. Aprovação obsoleta ou de encontro iniciado, cancelado ou realizado deve falhar; rejeição pode preservar uma proposta superada como histórico.
3. Aplicar nova atribuição e mudança do avaliador do encontro na mesma transação, com origem aprovada verificável. As proteções SQL atuais não devem ser simplesmente retiradas. Manter imutáveis horário, matrícula, finalidade e origem da publicação; guardar a cadeia das substituições e impedir reuso de decisão anterior.
4. Revalidar conflitos do novo avaliador e do aluno, ausências, reservas, prazo e calendário. A substituição não remarca o encontro nem reinicia prazos/cotas. A autorização de dia não letivo continua identificada na origem e precisa de revisão se o calendário aplicável mudar.
5. Conferir a retirada da atribuição pendente do substituído, acesso limitado do novo avaliador, realização histórica, consulta docente e invalidação de cancelamento preparado antes da troca. O titular continua somente com o alcance já permitido pelo vínculo; não pode registrar realização atribuída a outro professor na agenda.
6. Testar troca A→B→C, tentativas concorrentes e decisões repetidas, troca após nova ausência/reserva e impossibilidade de usar uma decisão antiga para restaurar um avaliador. Preservar notas/autoria anteriores e ausência de efeitos financeiros.

Estas dependências são trabalho de implementação, não novas decisões comerciais solicitadas ao usuário. O objetivo integral permanece ativo; remarcação, cancelamento/falta do aluno, notificações e demais pendências da SPEC também continuam necessários.
