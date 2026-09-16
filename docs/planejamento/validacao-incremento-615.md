# Incremento 615 — convites e recuperação via Resend

## Implementação

`envio-resend.ts` liga a solicitação durável do portal ao transporte Resend. Confere configuração antes de criar token/claim, deriva link exclusivamente de origem HTTPS institucional configurada e fornece ao transporte destinatário individual e chave de idempotência derivada da solicitação. O token continua no fragmento do link e não é retornado pela função.

`identidade.ts` aceita recibo estrito Resend. Confirmação ENVIADO e evento de aceitação com provedorId usam a mesma transação. Evento não contém token, link ou destinatário. Falha/recibo inválido conserva INCERTO; o caminho interno legado callbackvoid continua compatível. ENVIADO não prova entrega ao destinatário.

## Configuração e limites

A função interna exige EMAIL_PORTAL_ENVIO_ENABLED=true, RESEND_API_KEY, EMAIL_INSTITUCIONAL_REMETENTE e PORTAL_ALUNO_URL_PUBLICA (origem HTTPS sem caminho, query, credencial ou fragmento). Nenhuma configuração real foi alterada nem houve envio real. Ainda faltam worker/acionamento, interface operacional, conciliação e homologação do domínio/remetente/recebimento. N01 não está concluído.

## Validação

22 testes focados passaram, zero falhas: docs/validacao-unitaria-final-615-2026-09-16.json. TypeScript e lint focado passaram. Integração real do fluxo está sendo preparada para execução após a regressão global20856; não rodar duas suítes DB em paralelo.
