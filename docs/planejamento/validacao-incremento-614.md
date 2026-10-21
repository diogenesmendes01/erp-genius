# Incremento 614 — revisão de integridade e transporte Resend

## Revisão da migração de vídeo

[revisao-migracao146-614.md](revisao-migracao146-614.md) identifica incompatibilidade entre imutabilidade e chaves únicas do rascunho146: novas fontes aprovadas para regularização não caberiam no modelo proposto. A aplicação está impedida até revisar a cadeia de fontes e seus vínculos de aprovação. Preservar publicação/material originais e prazos/entregas. Nenhum SQL foi aplicado.

## Transporte de e-mail implementado

src/server/email/resend.ts implementa POST /emails com remetente configurado, destinatário individual, Idempotency-Key e prazo efetivo. ACEITO significa somente aceitação pelo fornecedor; resposta ambígua, timeout e erros de rede ficam INCERTO sem retry. Configuração/entrada inválida não inicia envio. Nenhum e-mail real foi enviado; testes injetam fetch. Requer RESEND_API_KEY e EMAIL_INSTITUCIONAL_REMETENTE na futura integração.

13 testes focados passaram, zero falhas, em docs/validacao-unitaria-614-2026-09-16.json. TypeScript e lint focado passaram.

O transporte ainda não foi ligado à fila/convites/avisos. Será necessário preservar a tentativa durável, autorização de destinatário, status externo e conciliação. O provedor conserva chaves por 24 horas, portanto não substitui a idempotência do ERP. Homologação de domínio/remetente e recebimento ainda pendente.

Fontes oficiais: [Send Email](https://resend.com/docs/api-reference/emails/send-email), [Idempotency Keys](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Rastreabilidade

[rastreabilidade-mat-doc-614.json](rastreabilidade-mat-doc-614.json) mapeia 48 itens MAT/DOC para o inventário; 14 correspondências incompletas permanecem explícitas. Isso identifica lacunas do acompanhamento e não prova ausência de implementação. Percentual global continua sem denominador reconciliado.

## Validação de banco

Regressão611 confirmada ativa na sessão20856 e banco teste apresentou conexões ativas sem espera de lock na consulta de monitoramento. Nenhuma segunda suíte ou migration foi executada em paralelo.
