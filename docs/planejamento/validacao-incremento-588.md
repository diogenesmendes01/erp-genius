# Incremento 588 — Autorização contratual na remarcação de segunda chamada

Data: 16/09/2026. Escopo: Q151 no novo intervalo da remarcação. O objetivo integral continua em andamento.

## Problema e comportamento

O servidor conferia a autorização especial somente no início do novo encontro, e o aplicador SQL de remarcação não fazia essa conferência contratual. Uma matrícula pausada ou encerrada poderia receber agenda cujo fim excedesse a autorização.

A remarcação agora confere início e fim exclusivo, mantendo mensagens específicas por limite, e usa uma verificação contínua compartilhada pelo servidor e pelo aplicador SQL. Além dos extremos, essa verificação considera ativação, encerramento, pausas/retomadas pelo dia civil e fuso registrados e início/fim de validade das autorizações. Assim, uma pausa inteiramente entre duas bordas ativas também exige autorização. Dados inválidos ou situação não reconhecida impedem a aplicação.

Autorização suficiente permite remarcar sem reativar matrícula, criar cobrança, alterar notas ou consumir outra oportunidade. Reserva, aprovação independente, calendário, professor e conflitos mantêm suas verificações. Rejeitar proposta continua possível sem aplicar o novo horário.

## Implementação

- `src/server/avaliacoes/segunda-chamada-remarcacao.ts`: revalidação contratual na proposta e na decisão.
- Migration `20260915129000_autorizacao_intervalo_remarcacao_segunda_chamada`: helper de cobertura temporal e proteção do aplicador, antes dos efeitos.
- `docs/specs/remarcacao-segunda-chamada.md`: requisito e critério de aceitação Q151 explicitados.

A migration foi aplicada somente em `localhost:54329/erp_genius_test`; migrations anteriores não foram reescritas.

## Verificações

- Três integrações direcionadas aprovadas: ausência/autorização parcial, autorização integral, invalidação posterior e tentativa direta SQL sem cobertura do fim. Evidência: `docs/validacao-integrada-remarcacao-588-2026-09-16.json`.
- Oito testes de schema e renderização aprovados: `docs/validacao-unitaria-588-2026-09-16.json`.
- Build e tipos aprovados: `docs/validacao-build-588-2026-09-16.log`.
- Lint direcionado aprovado: `docs/validacao-lint-588-2026-09-16.log`.
- Rodada conjunta: 86 de 88 integrações aprovadas; as duas falhas ocorreram na preparação dos novos testes de intervalo, antes de verificar o comportamento. Evidência preservada: `docs/validacao-integrada-final-588-2026-09-16.json`.
- Depois de corrigir somente as fixtures desses dois casos (regra selecionada da publicação vigente e argumentos SQL normalizados em UTC), ambos passaram: `docs/validacao-integrada-intervalo-588-2026-09-16.json`. Cobrem bordas ativas com pausa interna, sem autorização e com autorização concedida durante a pausa. Assim, os 88 casos têm resultado aprovado entre as execuções; não houve uma nova rodada conjunta de 88 após o ajuste das fixtures.

A primeira execução dos testes novos falhou na preparação da regra acadêmica da turma, antes do fluxo testado. A fixture foi corrigida para usar a regra publicada e a preparação válida da turma; a execução direcionada passou em seguida.

## Limites

A checagem contínua adicionada nesta rodada é utilizada pela remarcação. Agenda inicial e substituição docente possuem suas verificações próprias de bordas; aplicar a checagem contínua também nesses caminhos e testar transições internas permanece uma conferência adicional necessária.

Não houve homologação interativa, implantação, envios externos ou importação de dados reais. Q164 e as demais pendências do objetivo integral permanecem abertas; estes testes não comprovam todo o ERP.
