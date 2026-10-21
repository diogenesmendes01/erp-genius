# Incremento 603 — Validação da confirmação manual e recuperação da interface

16/09/2026. Implementação integral do projeto continua em andamento.

## Correções implementadas

A confirmação manual `registrarCobrancaWhatsApp` dependia dos tipos TypeScript para restringir modelo e passo. Uma chamada direta com valores inválidos podia gravar um evento de domínio incorreto. Agora o servidor valida identificador, modelo, passo e ciclo em tempo de execução. Na transação, protege a cobrança e o usuário com locks compartilhados, relê estado/papéis e confere o ciclo antes de registrar o evento. O guard inicial já consultava permissões atuais; esta mudança protege também a etapa de gravação.

A confirmação continua declaratória: aceita um ciclo histórico válido, inclusive quando a cobrança foi reprogramada depois do envio. Não comprova entrega pelo provedor, não envia mensagem, não confirma pagamento e não exige novamente as condições de preparação para registrar um fato passado. Ciclo futuro é recusado.

Na fila financeira, falhas de transporte das ações passam a produzir mensagens de erro; preparação e confirmação manuais liberam o estado ocupado com `finally`. Durante a operação manual, o texto não pode ser editado. O painel de detalhe tem identidade por cobrança e ciclo, evitando reaproveitar o estado local de outra cobrança. Resultado incerto de operação que grava dados orienta conferir o histórico antes de repetir; não afirma que uma falha de resposta significa ausência de gravação. Não foi introduzida idempotência nova para declarações manuais.

O índice deixou de descrever o projeto como apenas o primeiro incremento: aponta às evidências atuais e distingue múltiplas matrículas de conclusão de todos os fluxos por contrato.

## Evidências executadas

- **19/19 testes de integração**: três da confirmação manual, seis da preparação manual e dez de ciclo de cobrança. Arquivo: `docs/validacao-integrada-603-2026-09-16.json`.
- Os três novos cenários verificam modelos/passos forjados sem evento, revogação de papel entre guard e transação sem evento e ciclo futuro sem evento. O conjunto de regressão preserva o registro no ciclo original após reprogramação.
- Tipos: `docs/validacao-tipos-603-2026-09-16.log`, aprovado.
- Lint dos arquivos alterados: `docs/validacao-lint-603-2026-09-16.log`, aprovado.
- Build: `docs/validacao-build-603-2026-09-16.log`, aprovado.

Somente banco local de testes, sem migração nova, sem operação em produção e sem envio externo. A revogação é intercalada deterministicamente antes da transação no teste; não se afirma teste de estresse concorrente. A recuperação visual de botões, o bloqueio de pop-up e a troca interativa de cobrança não foram homologados em navegador nesta etapa. Build e testes de servidor não substituem essa homologação.
