# Incremento 593 — Pedido de desistência durante a preparação

Data: 16/09/2026. Objetivo integral em andamento; Q121 parcialmente implementada.

## Entrega

[Detalhamento da SPEC](../specs/desistencia-preparacao.md). Pedido imutável por matrícula, consulta de conferência, fotografia interna das fontes, reenvio idempotente, versão sequencial, evento e tela acessível pela preparação. Secretaria/Administração ativa; usuários de outros papéis não herdam acesso. Matrícula fora da preparação não admite novos pedidos. Outros contratos do aluno permanecem preservados.

O resumo identifica pendências financeiras/documentais e avanço formal conhecido. Créditos existentes, mesmo sem utilização em cobrança, entram na fotografia e exigem conferência financeira; não são convertidos em pagamento confirmado. URLs e identificação dos signatários não são expostas no resumo. A consulta apresenta os vinte pedidos mais recentes; paginação completa permanece pendente.

Migration 134 aplicada somente no banco de teste `localhost:54329/erp_genius_test`: tabela, chaves, restrições e trigger de preservação/estado/papel/versão. Evidência em `docs/validacao-migration-593-2026-09-16.log`. Sem alteração das migrations anteriormente aplicadas.

## Correção identificada durante a implementação

Uma substituição global indevida no schema renomeou 49 campos antigos `snapshot` para `snapshotJson`. A primeira checagem de tipos detectou a regressão; não era falha preexistente. Os campos anteriores foram restaurados conforme as colunas do banco, mantendo `snapshotJson` somente no novo PedidoDesistenciaPreparacao. Cliente Prisma regenerado; tipos e regressões reconferidos. Nenhuma coluna antiga foi renomeada no banco. Logs iniciais foram preservados.

## Validação

- Primeira rodada específica: 7 integrações aprovadas em `docs/validacao-integrada-inicial-593-2026-09-16.json`.
- Rodada ampliada: **83 integrações aprovadas**: 7 do pedido, 67 de reserva comercial, 4 de fechamento acadêmico e 5 de impactos de reposição. Evidência: `docs/validacao-integrada-final-593-2026-09-16.json`.
- Após incluir créditos ainda sem utilização na conferência: os **7 testes do pedido passaram novamente**, em `docs/validacao-integrada-creditos-593-2026-09-16.json`. Não somar reexecuções como novos cenários.
- **4 unitários aprovados**: três de renderização/permissões/contexto/formulário e um do helper de crédito isolado, em `docs/validacao-unitaria-final-593-2026-09-16.json`. O cenário de crédito isolado usa dependência simulada; não comprova emissão/uso de crédito real no PostgreSQL.
- Tipos, lint e build: logs `docs/validacao-tipos-final-593-2026-09-16.log`, `docs/validacao-lint-593-2026-09-16.log` e `docs/validacao-build-593-2026-09-16.log`.

Testes específicos verificam ausência de efeitos acadêmicos/financeiros, informe a conferir e recebimento, conferência desatualizada, concorrência/reenvio, papéis/usuário inativo, isolamento de contratos e preservação SQL contra alteração/exclusão. A fixture não desativa guards nem fabrica liquidação por crédito: esta exige sua origem/aprovação real.

## Ainda pendente

O pedido não é uma decisão ou desistência efetivada. Faltam conferência/cancelamento documental específico, acerto financeiro da preparação, aprovação conforme avanço formal e aplicação atômica com tratamento da reserva. Não há homologação interativa, produção ou envios externos. Fotografia preparatória não substitui revalidação de fontes durante futura aprovação/aplicação. Ausência de assinatura no banco não comprova ausência de assinatura externa.

Q160 segue registrada: vencimentos novos usam referência contratual explícita ao mês de início da cobertura (anterior, mesmo mês ou seguinte), mantendo o dia contratado e exigindo conferência se incompleta. Os cálculos anteriores estão documentados no incremento 577; emissão recorrente integral continua pendente.
