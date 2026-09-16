# Incremento 487 — intenção e evidências de cancelamento Q116

Data: 15/09/2026. Turno anterior foi progresso em ações, consultas e telas, com integração e build aprovados. Meta integral ativa.

## Persistência e serviço

Aplicada no banco descartável a migração `20260915051000_intencao_cancelamento_assinatura` e regenerado o Prisma Client. Schema validado antes da aplicação. Nenhum banco de produção foi alterado.

`IntencaoCancelamentoAssinatura` registra processo, proposta, decisão aprovada, executor, hash da proposta e referência externa. Há uma intenção por processo, vinculada à decisão independente exata; o registro é imutável. `ObservacaoCancelamentoAssinatura` preserva resultados INCERTO/CONFIRMADO, referência, hash da evidência e chave por intenção. O SQL recusa vínculo divergente, evidência sem hash válido e alteração/remoção desses fatos.

`iniciarCancelamentoAssinaturaTx` exige Secretaria/Administração ativa, proposta aprovada por outra pessoa, versão atual, hash íntegro e nova conferência completa das condições do substituto. Serializa calendário, matrícula e processo. O retorno `nova: true` identifica intenção criada nesta chamada; o chamador futuro deve concluir a transação antes do HTTP. Repetição da mesma intenção retorna `nova: false`, indicando conciliação, não autorização para repetir a solicitação remota. Intenção de outro contexto/executor não é reutilizada silenciosamente.

`registrarObservacaoCancelamentoTx` é primitiva interna para o futuro adaptador autenticado. Confere intenção, processo, proposta e referência; repetição exige o mesmo resultado e evidência. INCERTO e confirmação posterior são fatos separados. Se as assinaturas forem concluídas entre intenção e resposta, preserva a observação e sinaliza a conclusão concorrente. Nenhum desses serviços altera o processo para CANCELADO, transfere assinaturas, cria processo substituto ou modifica cobranças.

O formato atual admite INCERTO/CONFIRMADO e uma intenção durável por processo. Resultado negativo comprovado que permita nova solicitação precisará de encerramento/versionamento explícito no protocolo, sem criar segunda intenção silenciosa. A integração externa ainda não está habilitada.

## Evidências

`docs/validacao-cancelamento-assinatura-487-2026-09-15.json`: **13 testes de integração aprovados** — oito casos anteriores de proposta/decisão/acesso e cinco novos:

- intenção recusada sem aprovação e duas chamadas concorrentes persistindo uma só intenção;
- observação incerta conciliada na mesma intenção, reenvio idempotente e chave divergente recusada;
- intenção/processo/proposta/referência trocados recusados, inclusive referência inválida por escrita direta no banco;
- assinatura concluída durante a operação preservada junto à confirmação externa, sem liberar substituto;
- dados alterados depois da aprovação ou assinatura concluída antes da intenção impedindo solicitação.

Imutabilidade de intenção/observação e manutenção do processo ENVIADO também foram verificadas. TypeScript e ESLint direcionado passaram. A fixture de contratação continua usando os fluxos de reserva, emissão, PDF e assinatura; a conclusão assinada e a resposta externa são evidências simuladas exclusivamente no banco de teste. Não comprovam operação de um fornecedor real.

Revisão Terra somente leitura conferiu alinhamento com Q116: decisão explícita vinculada, uma intenção conciliável, repetição exata das observações e preservação da conclusão concorrente.

## Próxima dependência

Ainda faltam o consumo verificado da confirmação, a mudança controlada do processo e a criação do substituto, além do adaptador HTTP autenticado, configuração/seleção operacional do fornecedor, conciliação e homologação. As telas continuam corretamente avisando que cancelamento externo e novo envio não estão disponíveis. A meta integral não foi concluída; não houve deploy ou chamada externa.
