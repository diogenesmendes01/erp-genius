# Continuidade mensal — Q161 e Q162

Decisões aprovadas em 16/09/2026. Este documento orienta a implementação; não declara o emissor pronto.

## Q161 — oferta comprovada

Conferir agenda e vínculo da matrícula. Quando não comprovarem a continuidade do período, exigir confirmação específica da Gestão Pedagógica, com período e justificativa. Não confundir matrícula ativa ou ausência de relato de indisponibilidade com oferta comprovada. Recessos e feriados institucionais não são falta de oferta por si sós.

A aplicação deve preservar a matrícula e as fontes usadas na decisão, revalidá-las antes da emissão e manter os bloqueios por indisponibilidade pendente/confirmada. A confirmação positiva não pode apagar um relato nem resolver unilateralmente o encerramento de indisponibilidade já sujeito a Q156. Não usar os registros de falta de oferta como confirmação positiva.

## Q162 — novo ciclo após recomposição

A próxima cobertura começa no dia seguinte ao fim da cobertura deslocada e estabelece a referência dos próximos ciclos mensais. Exemplo: 03/out–02/nov seguido de 03/nov–02/dez. O cálculo deve partir de recomposição efetivamente aplicada e do contrato correspondente. Uma proposta aprovada, porém não aplicada, não altera a referência. Preservar cobranças já emitidas e aplicar Q160 apenas aos novos vencimentos.

Critérios de verificação: vínculo entre aplicação e cobertura; isolamento entre matrículas; recusa de fonte inválida ou insuficiente; nenhum dia sobreposto à compensação; meses curtos sem perda da data de referência; continuidade subsequente preserva o novo ciclo; memória identifica origem e referência aplicada. O executor deverá persistir a origem nos novos períodos, impedir duplicidade em reprocessamento e revalidar as fontes dentro da transação.

## Pendências de execução

A consulta continua somente leitura (`podeEmitir: false`). O incremento 606 acrescenta executor transacional, memória persistida e rota de rotina agendada, desligada por padrão. Falta homologação operacional e ativação do agendamento externo; combinações de origens Q66/Q159/Q70 sem precedência definida permanecem em conferência. Consulte [evidências e limites](validacao-incremento-606.md).

O incremento 607 corrigiu a inconsistência entre condições e emissão: consulta, ações e guard do banco exigem preparação mensal estruturada, sem inventar condições para legado. Também verificou Q162 em emissão integrada de dois ciclos posteriores. Consulte [evidências e limites](validacao-incremento-607.md).
