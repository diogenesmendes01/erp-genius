# Incremento 592 — Avisos de pendências do diário (Q22)

Data: 16/09/2026. Objetivo integral em andamento.

## Lacuna confirmada

Q22 exige pendências e lembretes no ERP, prazo e intervalo configuráveis e alerta à gestão após vencimento. A leitura inicial confirmou ausência desses parâmetros em ConfiguracaoOperacional e ausência de ciclo de avisos/consulta/painel correspondente. A lista de encontros e o diário existentes permitem operação manual, mas não cumprem esse acompanhamento.

## Escopo

Implementação da [SPEC Q22](../specs/avisos-pendencias-diario.md): configuração administrativa, ciclo de aviso interno reconciliado no acesso ao painel, acompanhamento docente/gestão e critérios de acesso/intervalo/resolução. Sem valores numéricos presumidos nem canais externos. Separar o estado do aviso da conclusão da aula.

## Evidência

- Migration 133 aplicada somente em `localhost:54329/erp_genius_test`. Dois parâmetros opcionais, sem defaults, com restrição de par completo/positivo; modelo de ciclo único por encontro/destinatário/tipo. A revisão anterior à aplicação corrigiu a validação SQL para não aceitar um valor NULL isolado. Evidência: `docs/validacao-migration-592-2026-09-16.log`.
- Serviço e painel de Q22 implementados. Calendário, usuário e encontro são revalidados na ordem de bloqueio usada pelo diário. Vínculo docente vigente, substituição aprovada ou designação Q24 delimitam a responsabilidade; gestão acompanha sem herdar escrita. Usuário com papéis acumulados recebe o aviso docente nas aulas sob sua responsabilidade.
- Os ciclos inválidos são filtrados antes do lote de limpeza: vinte avisos ainda válidos não impedem encerrar outro obsoleto. Nova designação pode reabrir o mesmo ciclo sem duplicar aviso no intervalo; eventos preservam o encerramento e a reabertura. Encerrar aviso não altera a aula.
- A consulta administrativa de parâmetros não gera avisos. A configuração é auditada e invalida as páginas relacionadas; alteração de prazo/intervalo recalcula vencimento e próximo lembrete.
- Primeira integração: **6 de 7 casos aprovados**; o caso de mudança do intervalo confirmou que o próximo aviso mantinha o valor antigo. Corrigido antes da rodada final. Evidência preservada: `docs/validacao-integrada-inicial-592-2026-09-16.json`. Após a correção, os sete passaram em `docs/validacao-integrada-ciclos-592-2026-09-16.json`.
- Rodada final ampliada: **75 integrações aprovadas**, sem falhas ou ignoradas: 11 de Q22, 20 de diário, 15 de regularização, 15 de operação e 14 de agenda. Inclui concorrência, mudança de configuração, designação revogada/renovada, saída docente, paginação e encerramento de ciclo além de vinte fontes válidas. Evidência: `docs/validacao-integrada-final-592-2026-09-16.json`. Os sete iniciais fazem parte dos onze; não somar as execuções.
- **Três testes de renderização aprovados**, cobrindo configuração ausente, professor/cursor e gestão atrasada sem escrita: `docs/validacao-interface-592-2026-09-16.json`.
- Tipos, lint e build aprovados: `docs/validacao-tipos-592-2026-09-16.log`, `docs/validacao-lint-592-2026-09-16.log`, `docs/validacao-build-592-2026-09-16.log`.

A auditoria paralela também confirmou a [lacuna Q121](pendencia-desistencia-preparacao-592.md), registrada para a sequência e não implementada nesta entrega.

## Limites

Não há homologação interativa, produção ou envios externos. O painel é o canal interno de acompanhamento; não se declara serviço de avisos em segundo plano ou integração com WhatsApp/e-mail. O objetivo integral e as decisões pendentes de outras frentes permanecem abertos.
