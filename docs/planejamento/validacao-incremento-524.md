# Incremento 524 — compensações na continuidade mensal

15/09/2026. Continuação de FIN-01/FIN-02/Q70. Agente Terra implementou a conferência transacional; o orquestrador integrou à prévia e validou com dados do banco descartável.

## Comportamento implementado

Antes de apresentar a próxima cobertura mensal, o carregador verifica se ela alcança algum dia já programado por uma aplicação aprovada de recomposição daquela matrícula. Havendo sobreposição, exige revisão da cobertura, identificando a primeira data compensada; não apresenta esse período como uma nova mensalidade normal. Os limites inicial e final são inclusivos. A consulta não altera recebimentos, cobranças, direitos ou sua execução.

O vínculo é conferido pela aplicação, decisão e proposta de recomposição da matrícula correspondente. Compensações de outro contrato do mesmo aluno não bloqueiam esta matrícula. Não se usa presença ou preenchimento do diário para decidir se um dia compensado pode ser cobrado novamente.

## Evidência

- Integração com Postgres: cenário de proposta, aprovação independente e aplicação real de recomposição ampliado com sobreposição nos dois limites, período posterior sem sobreposição e outro contrato preservado. Regressão adicional da prévia mensal com contrato/aditivo. Dois cenários selecionados aprovados; 36 não selecionados nesta execução. Arquivo: `docs/validacao-integracao-524-2026-09-15.json`.
- 25 unitários de continuidade, seleção da condição e conferência da recomposição aprovados: `docs/validacao-unitarios-524-2026-09-15.json`.
- ESLint focado e compilação aprovados: `docs/validacao-build-524-2026-09-15.log`.

## Lacunas identificadas e próximas etapas

Q161 foi enviada e permanece pendente: definir como comprovar a oferta futura por matrícula para autorizar a emissão automática. Vínculo ativo, agenda publicada e ausência de relato de indisponibilidade não comprovam, isoladamente, continuidade assegurada depois do término de um nível. Feriados/recessos normais não devem ser confundidos com indisponibilidade. A pergunta oferece comprovação pela agenda com exceção aprovada, intervalo de oferta sempre registrado ou comprovação exclusivamente pela agenda; nenhuma alternativa foi presumida.

A seleção atual da última cobertura ainda precisa tratar cobranças canceladas e coberturas deslocadas por pausa/recomposição. Excluir uma cobrança cancelada indiscriminadamente também pode reabrir período que não deve ser cobrado; a correção deverá considerar a origem e a decisão de retorno, sem usar o cancelamento como autorização de nova emissão. O planejamento ainda exige período completo da referência contratual e, portanto, recusa cobertura deslocada que não coincida com essa referência.

O executor recorrente não foi concluído nem habilitado. O helper de compensação deve ser reutilizado e reconferido na transação de emissão, junto aos bloqueios de matrícula, contrato, oferta e duplicidade. A interface continua sem ensaio interativo. Nenhuma alteração de produção ou operação externa. O objetivo integral permanece em implementação.
