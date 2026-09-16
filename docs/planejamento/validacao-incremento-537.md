# Incremento 537 — consumo da autorização na realização

`registrarRealizacaoRecuperacao` agora resolve a autorização persistida para a tentativa quando o histórico contratual comprova PAUSADA ou ENCERRADA na data da avaliação. Histórico incompleto continua bloqueado. O resolvedor confere plano, aprovação, disponibilização, habilidade, matrícula, alocação, regra, prazo e gestão autorizadora vigente. Não aceita autorização enviada pelo cliente.

A realização guarda `autorizacaoEspecialId`. A migração 900 valida a referência, fonte e janela no banco, mantendo a imutabilidade, o prazo geral, a atribuição docente e as demais proteções anteriores. Permite ultrapassar o fim da alocação somente com autorização válida; nunca permite realização anterior ao início do vínculo.

O cenário direcionado com pausa aplicada pelo fluxo contratual passou: bloqueio antes da autorização, liberação somente de fala, escrita ainda bloqueada e matrícula preservada como pausada. A regressão completa do arquivo acadêmico passou com 91 testes, zero falhas e zero ignorados: `docs/validacao-academica-537-2026-09-15.json`. ESLint e build também passaram (`docs/validacao-build-537-2026-09-15.log`).

Limites restantes: interface e projeção das ações, caso completo de encerramento aplicado, liberação de pendências ainda sem reserva, conferência da reprodução da situação contratual em gravações diretas no banco. O histórico contratual continua sendo validado pela ação; a migração desta etapa valida autorizações fornecidas, mas não acrescenta uma reconstrução SQL de pausa/retomada para toda inserção sem autorização. Não declarar Q151 integralmente entregue por este incremento.

Sem implantação, cobrança, alteração de limites ou envio externo. Migração somente no banco de teste local.
