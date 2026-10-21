# Incremento 616 — fila de envios e contato vigente

16/09/2026.

## Implementado e verificado

- Consulta paginada das solicitações de acesso ao portal para Secretaria Acadêmica/Administração. Relê usuário ativo e papéis na transação. O resultado contém nome, identificador, finalidade, situação e datas; não inclui destinatário, token ou link.
- Convite preparado exige que o endereço atual do cadastro ainda corresponda ao destinatário antes de criar token e iniciar envio. Contato removido ou alterado impede o despacho e exige nova conferência/preparação.
- Corrigida variável indefinida no teste de integração do Resend e reforçada a extração obrigatória do token para evitar asserção sem evidência.

## Evidência

- 14 testes unitários passaram: identidade/recibo, fila e envio Resend. Relatório: `docs/validacao-unitaria-616-2026-09-16.json`.
- ESLint dos cinco arquivos revisados: exit 0.
- TypeScript após correção do teste: exit 0, executado pelo agente responsável.
- Novo caso de integração cobre alteração de endereço antes do despacho, mas ainda não foi executado. A regressão 611 permanece ativa na sessão 20856; nenhum segundo processo de integração foi iniciado.

## Limites e continuidade

A consulta ainda não tem tela operacional. O processamento em lote está em desenvolvimento separado e não foi exposto como endpoint. Nenhum envio externo foi realizado. Resultado aceito pelo provedor não comprova entrega na caixa postal. A revalidação cobre o contato no momento da preparação transacional do despacho; não promete cancelar uma mensagem externa já iniciada.

Este incremento não fecha o módulo de comunicação nem altera por si só a contagem consolidada de aceite das SPECs.
