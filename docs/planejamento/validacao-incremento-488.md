# Incremento 488 — aplicação atômica da substituição Q116

Data: 15/09/2026. Turno anterior foi progresso na intenção e observações do cancelamento, com testes de integração. Meta integral ativa.

## Implementação

`AplicacaoSubstituicaoContratual` vincula intenção, observação confirmada, executor, hash aprovado e processo substituto. A FK do destino e a conferência final são diferidas até o commit: a aplicação só pode ser confirmada com a fonte CANCELADA e o substituto PREPARADO, na mesma matrícula, com original/conferência aprovados, mesmo fornecedor/ambiente, sem referência externa e sem tentativas herdadas.

`aplicarSubstituicaoContratualTx` revalida autorização, decisão independente, hash, versão, identidade, confirmação e condições atuais. Persiste aplicação, altera a fonte, cria o substituto e registra evento na mesma transação. `prepararProcessoEnvioTx` aceita o consumo explícito da substituição e mantém a recusa nos demais casos. Repetição idêntica retorna o processo já preparado. Não há HTTP nesta operação.

O banco impede cancelamento isolado, reabertura de processo cancelado, novo processo sem aplicação vinculada e aplicação incompleta no commit. Fonte e destino conservam originais e conferências próprios; cobranças e evidências anteriores permanecem preservadas.

Conclusão tardia da fonte cancelada pode ser preservada somente quando existe aplicação Q116 vinculada. Continuam exigidos original, integridade, tentativa de envio, identidades, papéis, datas e evidências compatíveis. Essa preservação não reabre a fonte. A cadeia de predecessores é consultada para bloquear início de envio e aceite do substituto se existir conclusão anterior que exige conferência Q117.

Um resultado de envio já iniciado não deve ser descartado quando a assinatura antiga chega durante a chamada externa. A migração final limita o bloqueio a preparação/início; o retorno pode ser preservado como evidência, mantendo o conflito para impedir novo envio/aceite. O teste final reproduz essa ordem temporal.

## Banco e testes

Aplicadas somente no PostgreSQL descartável:

- `20260915052000_aplicacao_substituicao_contratual`;
- `20260915053000_conclusao_tardia_substituicao`;
- `20260915054000_preservar_resposta_substituto`.

Prisma Client regenerado após o modelo novo. As duas últimas migrações alteram funções/guards, sem modelos adicionais. A função de conclusão anterior foi preservada com a exceção restrita Q116 e ordem de locks calendário → matrícula → processo; as demais validações foram mantidas.

Evidências:

- `docs/validacao-substituicao-tardia-488-2026-09-15.json`: **19/19 testes de integração** na versão final, incluindo seis casos novos de aplicação, concorrência, rollback, commit incompleto, cancelamento direto recusado, evidência incerta/trocada, assinatura entre confirmação/aplicação e assinatura tardia antes/depois de iniciar o envio substituto.
- `docs/validacao-regressao-contratos-488-2026-09-15.json`: **67/67 testes** de reserva, preparação, documentos, envio e aceite anteriores. Essa execução terminou antes da migração final de preservação do retorno; o comportamento final com predecessor assinado foi coberto nos 19 testes direcionados.
- `docs/validacao-substituicao-aplicada-final-488-2026-09-15.json`: 18/18 antes do caso adicional de retorno tardio. A primeira execução `validacao-substituicao-aplicada-488` não iniciou os testes por um `await` em callback sem `async`; corrigido no teste, relatório preservado.
- TypeScript e ESLint dos arquivos alterados passaram na versão final.

## Limites

O serviço prepara um novo processo local a partir de uma confirmação já preservada; não realiza cancelamento ou envio real. Adaptador/autenticação/worker do fornecedor, apresentação operacional da aplicação e dos conflitos, conciliação e homologação visual permanecem pendentes. As telas continuam avisando que cancelamento e envio externos não estão disponíveis. Assinaturas e respostas dos testes são simulações, sem chamada externa. Não houve deploy nem conclusão da meta integral.
