# Incremento 602 — Preparação e confirmação do envio manual

16/09/2026. Objetivo integral em andamento.

## Correção

O botão manual da fila financeira usava `destino.telefone ?? aluno.telefone` e registrava `CobrancaEnviadaWhatsApp` ao abrir o WhatsApp. Assim, uma pendência de pagador podia direcionar a cobrança ao aluno, e a mera abertura do link avançava o histórico da régua.

Agora a preparação do link é uma ação de leitura no servidor (`prepararCobrancaManual`). Confere acesso atual de Financeiro/Secretaria/Administração, cobrança pendente com saldo, ciclo atual, suspensão por comprovante e o pagador específico da matrícula. Valida o texto e produz URL para o telefone E.164 dessa fonte. Não cria contato, intenção, mensagem ou evento e não chama driver. Destinatário ausente/incompleto/ambíguo impede a preparação; não existe fallback para o telefone global do aluno.

A interface separa abrir WhatsApp de confirmar envio realizado. Somente a declaração humana posterior chama o registro existente. Se o navegador bloquear a janela, o link permanece disponível, sem registrar envio. Alterar o texto exige nova preparação. O servidor continua aceitando o histórico de ciclo já enviado conforme o registrador existente, preservando que confirmação manual é uma declaração da equipe, não uma confirmação automática do provedor.

## Validação

- **16 integrações aprovadas**: seis da preparação manual e dez do ciclo de cobrança (`docs/validacao-integrada-602-2026-09-16.json`).
- Casos novos: pagador empresarial correto e codificação de texto; ausência de qualquer mutação ao preparar; pagador sem telefone sem fallback; ciclo antigo/cancelamento/texto inválido; campo de telefone injetado recusado; perda de papel/inativação; legado com múltiplos contratos; suspensão de lembretes até o fim da conferência.
- Tipos e lint aprovados: `docs/validacao-tipos-602-2026-09-16.log` e `docs/validacao-lint-602-2026-09-16.log`.
- Build aprovado: `docs/validacao-build-602-2026-09-16.log`.

Somente banco de testes. Nenhum WhatsApp real foi aberto pelos testes, nenhuma mensagem real foi enviada e não houve produção ou migração nova. Não houve teste interativo dos botões ou do comportamento de bloqueio de pop-up; os testes de servidor não substituem essa homologação.
