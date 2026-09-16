# Incremento 553 — vigência temporal da autorização de segunda chamada

A auditoria confirmou que a consulta de autorização especial verificava apenas o prazo final, podendo aceitar autorização emitida depois da data informada para a avaliação. Também não conferia o autorizador vigente nem a regra atual do vínculo. O helper SQL compartilhado por servidor e reserva agora confere matrícula, alocação, regra, avaliação, instante dentro do intervalo de autorização e gestor ativo com papel autorizado. A consulta bloqueia datas inválidas.

O registro de realização usa o histórico contratual na data: ATIVA permite o caminho normal; PAUSADA/ENCERRADA exige autorização válida naquele instante; histórico incompleto não é suprido por autorização. Um novo trigger de INSERT aplica essa condição também no banco. Isso não constitui auditoria completa das demais mutações diretas da segunda chamada. A criação de autorização pelo servidor foi limitada aos estados PAUSADA/ENCERRADA.

Migration `20260915099000_segunda_autorizacao_vigencia` preparada pelo agente Terra, revisada e aplicada somente ao banco local de testes. A regra de sobrevivência da autorização na transição pausa→encerramento não foi alterada: Q163 segue pendente.

O cenário de pausa da suíte passou a efetivar a pausa por solicitação, aprovação independente e execução. Confere ausência de autorização, rejeição de instante anterior à emissão, prazo vencido, outra avaliação, gestor inativo, tentativa de INSERT retroativo com consumo na mesma transação e realização válida posterior, preservando matrícula pausada. Suíte de segunda chamada: oito testes aprovados, zero falhas e zero não selecionados. Evidência: `docs/validacao-segunda-chamada-553-2026-09-15.json`. ESLint focado e TypeScript aprovados.

## Próximas lacunas confirmadas

A auditoria Terra da interface constatou que `segunda-chamada-autorizacao-especial.ts` não tem formulário correspondente no app. A tela de segunda chamada informa a necessidade da autorização, mas não permite registrá-la nem consultar seu histórico. É necessário conectar consulta limitada à gestão, prazo/fuso, formulário idempotente e histórico ao painel de segunda chamada. Nenhuma interface foi declarada funcional neste incremento. Também faltam auditoria completa dos guards e cenário integrado de encerramento/histórico ativo com lançamento posterior.

A SPEC geral permanece em implementação. Nenhuma alteração em produção ou serviço externo.
