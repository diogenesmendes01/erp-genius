# Incremento 404 — avaliação histórica após pausa/encerramento

2026-09-14. A fila docente excluía todas as matrículas não ativas, embora a ação de validação já admitisse entrega gravada histórica. Consulta agora mantém PAUSADA/ENCERRADA apenas com entrega pendente, autorização da reposição e designação docente vigente. Não libera novas entregas nem outros contratos.

Suitepermissões10 passou: docs/validacao-fila-historica-404-final-2026-09-14.json. Acrescentada verificação real de concluir/persistir e preservar status da matrícula:2 casos PAUSADA/ENCERRADA passaram (8nãoexecutados pelo filtro), docs/validacao-fila-historica-404-conclusao-2026-09-14.json. Testes também conferem ausência para outro docente e designação expirada. Fixture inicialmente tentou UPDATE de designação imutável e foi corrigida para registro histórico separado, sem afrouxar guard.

Agente reportou7/7agenda incluindo pedido no prazo com decisão tardia e replay do cancelamento; relatório docs/planejamento/validacao-reposicao-ciclo-agenda.json. Segunda chamada179 recebe banco exclusivamente para validação da nota no INSERT. Remarcação ainda requer testes adicionais. Meta global incompleta.
