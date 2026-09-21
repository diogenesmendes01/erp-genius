# Incremento 597 — Decisão administrativa da desistência

16/09/2026. Objetivo integral em andamento. [Regra detalhada](../specs/desistencia-preparacao.md).

## Implementação

Decisão administrativa própria de Q121, vinculada ao pedido de desistência. Outra pessoa da Administração ativa aprova ou rejeita com justificativa, preservando a versão e o estado conferido. Autoaprovação é proibida mesmo com acúmulo de papéis. Uma decisão existente não pode ser alterada/excluída; reenvio idêntico retorna o mesmo registro, conteúdo diferente é recusado.

A aprovação depende do último pedido, matrícula ainda preparatória, avanço formal que exige Administração e fontes atuais. A rejeição pode documentar pedido antigo, sem autorizar efeitos. Não registrar nova decisão para uma desistência já efetivada. A consulta revalida acesso e devolve os vinte pedidos mais recentes, com histórico e elegibilidade; Secretaria acompanha sem formulário decisório, Administração independente decide.

A página `/matriculas/[id]/desistencia/administracao` distingue decisão de efetivação. Nenhuma decisão desta entrega altera cobrança, recebimento, assinatura, matrícula ou reserva. Os aplicadores restritos existentes continuam recusando casos com avanço formal.

## Limites

O futuro aplicador de desistências com pagamento/assinatura precisa consumir a decisão administrativa e as aprovações financeiras/documentais pertinentes, revalidando fontes e alçadas. A decisão administrativa não substitui acerto financeiro nem encerramento externo confirmado. O adaptador autenticado de assinatura e Q155 continuam pendentes; nenhuma chamada externa ou migração de dados reais integra esta rodada.

## Validação e correções em andamento

A pré-validação identificou problemas de sintaxe PL/pgSQL (CASE sem agrupamento e fechamentos de subconsultas). Foram corrigidos antes de aplicar a migração 139, e o ensaio com BEGIN/ROLLBACK passou. A migração 139 foi depois aplicada somente em `localhost:54329/erp_genius_test`; `docs/validacao-migration-597-2026-09-16.log` conserva a evidência. Seu conteúdo aplicado permanece preservado.

A primeira integração executou seis cenários: três passaram e três reprovaram aprovações válidas por divergência financeira. A evidência `docs/validacao-integrada-inicial-597-2026-09-16.json` permanece preservada; não comprova conclusão. A correção será feita em nova migração, sem reescrever a aplicada.

A interface passou em dez testes de renderização e tipos/lint/build passaram antes da correção SQL: `docs/validacao-unitaria-597-2026-09-16.json`, `docs/validacao-tipos-597-2026-09-16.log`, `docs/validacao-lint-ui-597-2026-09-16.log`, `docs/validacao-lint-server-597-2026-09-16.log` e `docs/validacao-build-597-2026-09-16.log`. Esses resultados não substituem a integração financeira pendente nesta primeira execução.

## Correção do fuso da conferência

A sessão do banco de testes usa `America/Sao_Paulo`. A expressão SQL de formatação convertia o timestamp UTC sem fuso para timestamptz e o exibia no fuso da sessão: por exemplo, `12:00` virava `09:00Z`, divergindo da fotografia JavaScript. O mesmo problema afetava vencimentos e data do comprovante, causando as recusas indevidas.

A migração corretiva 140 fixa `TimeZone = UTC` na função de revalidação das fontes. O ajuste alcança as comparações de datas financeiras, documentos, assinaturas e alocações. A migração 139 permanece inalterada. A função foi conferida com a fotografia real da fixture sob BEGIN/ROLLBACK antes da aplicação de 140. Aplicação somente no banco de testes: `docs/validacao-migration-correcao-597-2026-09-16.log`.

## Resultado após a correção

- **29 integrações aprovadas** após a migração 140: sete da decisão administrativa, quatro da conferência documental, sete do pedido e onze da efetivação. Evidência: `docs/validacao-integrada-final-597-2026-09-16.json`.
- Acrescentados dois casos que fixam explicitamente sessões em `America/Sao_Paulo` e `Asia/Tokyo`, inserem uma aprovação válida pelo banco e verificam que a função restaura o fuso da sessão ao retornar. A suíte administrativa completa, agora com **nove cenários**, passou: `docs/validacao-integrada-fuso-597-2026-09-16.json`. Os sete anteriores foram reexecutados, não são nove cenários adicionais.
- Os casos administrativos cobrem autorização independente, consulta da Secretaria sem valores, perda de papel, recusa de autoaprovação, fonte alterada, rejeição histórica, reenvio, ausência de avanço formal, documento com caracteres especiais/troca posterior de URL, imutabilidade e escrita direta.
- Os **dez testes de renderização**, tipos, lint e build citados acima passaram. A revalidação final de tipos/lint passou em `docs/validacao-tipos-final-597-2026-09-16.log` e `docs/validacao-lint-final-597-2026-09-16.log`. A validação Prisma também passou: `docs/validacao-schema-597-2026-09-16.log`.

Não houve homologação interativa, envio ao fornecedor ou produção. Esta validação cobre as fontes exercitadas; não demonstra todas as combinações de compensações, créditos e concorrência. A aplicação integral dos casos formais continua pendente conforme os limites deste relatório.
