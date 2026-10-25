# Inbox #359 — apresentação da faixa global na composição R4

O smoke tablet da composição `b437e13c`, build `z1ivcGA6NikkKmXZP6V_S`, mostrou que switch e Gerenciar na mesma linha comprimiam o texto da faixa para cerca de 68px. Título quebrava em duas linhas e resumo em seis. O TESTER confirmou o problema no parecer SHA256 `a7edd5abfc5c410724d4ebb35ed07c097fcc04e538e99e1217d28fb26bb8e5d2`.

A faixa passa a usar uma grade com ícone/texto na primeira linha e um grupo nomeado de controles autorizados na segunda. Feedback fora do Modal ocupa a largura do grupo; não divide o espaço com o título. A presença dos controles continua dependendo somente de `podeGerenciar`; DESLIGADA permanece ausente, SHADOW preserva seu modo e checked continua sendo o inverso de pausada. Modal, motivo, handlers, tokens de ACK, idempotência e foco mantêm seus contratos.

RED causal `f262c4`, EXIT1, um teste de grupo ausente e 16 controles aprovados. GREEN `a080c2`, EXIT0: três arquivos completos/41 testes, incluindo cabeçalho, faixa e interações reais de Modal/foco/revogação/retry. Sem filtro de caso/skips novos, um worker/1024 MiB, UTC e provedores externos vazios. Tentativa administrativa `dc7717` falhou no cache Vite sem executar testes. Não há novo teste espelhando classes CSS.

Os gates globais da composição anterior não certificam esta revisão. TSC, lint, global e build da revisão, inspeção nos três tamanhos/dois temas e visual de feedback/Modal permanecem pendentes. Nenhum aceite, merge ou fechamento de issue é presumido.
