# Incremento 550 — disponibilização de plano aprovado antes da pausa

A disponibilização agora pode registrar uma autorização de preparação válida para o mesmo vínculo, mesmo quando a proposta original foi aprovada durante matrícula ativa e não contém autorização especial. A proposta e sua decisão permanecem imutáveis. Se a proposta já contém uma autorização, uma referência diferente é recusada.

Servidor e banco conferem fonte acadêmica, status, autorização, autorizador ativo, prazo atual e data efetiva da disponibilização. O registro conserva a autorização usada. Reenvio exige a mesma fonte de autorização; registros anteriores que herdavam autorização da proposta mantêm sua interpretação, sem inventar uma autorização para planos sem referência.

Migration 980 preparada pelo agente Terra, revisada e aplicada somente no banco de testes. No ramo especial, o trigger grava a referência efetiva também quando herdada da proposta. Não altera prazos gerais, não reativa matrícula e não libera reserva/realização automaticamente.

Validação: 14 integrações selecionadas aprovadas, zero falhas, 81 não selecionadas (`docs/validacao-disponibilizacao-especial-550-2026-09-15.json`). Inclui novo cenário com aprovação anterior à pausa, recusa sem autorização, disponibilização autorizada idempotente e comparação integral da proposta/decisão originais, além de regressão de planos e encerramento. ESLint e TypeScript aprovados.

Pendências: conectar o novo parâmetro à projeção e formulário da disponibilização; harmonizar o alcance das autorizações na transição pausa→encerramento e completar a validação interativa. A lacuna está corrigida no servidor/banco, ainda não na experiência completa da equipe. A SPEC geral permanece em implementação.
