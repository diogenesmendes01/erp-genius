# Q121 — Desistência antes da ativação: lacuna confirmada

Inspeção em 16/09/2026, incremento 592. Não implementada nesta rodada.

## Requisito vigente

Q121, respondida em `entrada-comercial-e-contrato.md`: pedido e motivo por matrícula. Sem comprovante em conferência, pagamento confirmado ou assinatura, Secretaria efetiva com os demais requisitos atendidos. Havendo avanço formal, Secretaria/Administração propõe e outra pessoa da Administração aprova. Conferência financeira/acerto aprovado quando necessário, preservação de documentos/recebimentos e confirmação do encerramento da solicitação externa de assinatura. Não presumir devolução, retenção, extinção contratual ou alteração de outros contratos. Liberar a reserva uma única vez, com revalidação concorrente do avanço formal.

## Evidência atual

`src/server/matricula/encerramento-solicitacao.ts` admite somente ATIVA/PAUSADA e encaminha expressamente preparações para o fluxo de desistência. A busca atual por `desist` no schema e nos módulos matrícula/contratos encontrou somente essa referência; não foi localizado o fluxo correspondente. Portanto o encerramento comum não comprova Q121, e ativar artificialmente uma preparação para encerrá-la seria incompatível com a decisão aprovada.

## Entrega necessária

Pedido/proposta/decisão/aplicação vinculados à matrícula, integração das evidências financeiras e da assinatura, execução atômica com liberação da reserva, preservação dos demais contratos, tela operacional e testes de concorrência/idempotência/autoria independente. Examinar os aplicadores existentes antes de escolher o modelo persistido; não copiar o encerramento pós-ativação presumindo os mesmos cálculos.

Esta lacuna permanece no objetivo integral. Ela não depende das decisões sobre referência de oferta para emissão recorrente (Q161/Q162).
