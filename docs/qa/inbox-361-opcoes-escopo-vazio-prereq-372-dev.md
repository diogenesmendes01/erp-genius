# Pré-requisito 361 → 372: opções com escopo comercial irrestrito

Em 26/10/2026, a contraprova R18 mostrou três cenários ADMIN falhando no gate listarOpcoesAtendimento antes de chegar ao core EXISTENTE. O escopo canônico retornava {}, mas Prisma descartava esse operando em OR:[{}, experimental], restringindo indevidamente o resultado ao ramo experimental. O probe ROOT READONLY 5ea987 confirmou a SQL gerada; não foi falha de fixture.

A alteração em operacoes-atendimento.ts limita-se à construção de where: escopo comercial vazio produz where {}, preservando OR(TRUE,x)=TRUE. Para demais atores, os ramos comercial/acadêmico continuam no OR anterior. Nenhuma mudança em escopoComercialAtual, papéis, DTO, Grant/370 ou consumidores globais.

Fonte SHA256 3ba72c9b5fbb0a876c188d8adbed53b5aa105e80a193e5938be8604826da0ad9. Lint 7b2e16 EXIT0; TSC original --noEmit --incremental false/heap8192 sessão88552 → 223206 EXIT0. A repetição R18 após o pré-requisito (sessão30510 → 64ae6c EXIT1) passou os três gates ADMIN e chegou, junto ao cenário de cobertura, às quatro recusas causais do core EX. Controle fora de escopo passou. Isso separa o defeito das opções do defeito de política de owner EX.

Após a correção EX separada, o mesmo arquivo nativo inteiro passou 5/5 (sessão38796 → ce9665 EXIT0). Sem filtro/skips/retry; originalintegration, UTC, Hermes, sete providers vazios, fetch bloqueado. Esse resultado é do recorte conjunto e não transforma o pré-requisito em uma feature nova ou validação global. ROOT destina este delta à PR453 e composição455. QA independente pública/CI/integração continuam sob ROOT. Sem push ou fechamento de issue pelo DEV.

## Regressão reutilizável na PR453 — autoria test-only

Novo arquivo operacoes-atendimento-opcoes-escopo-vazio.int.test.ts contém três casos completos independentes dos módulos #372: ADMIN com escopo canônico {} inclui oportunidade NOVO não experimental; VEN inclui carteira própria e exclui outro owner; PROFESSOR inclui apenas experimental próprio EXPERIMENTAL_AGENDADA, excluindo outro professor e outra etapa. Canários reais conferem ator ativo/papéis exatos, owner/etapa e scope comercial; sessão usa carregarUsuarioFresco real. Somente sessão/Next mockados, Prisma e listarOpcoesAtendimento reais. Foto completa de dez entidades do fluxo antes/depois exige ausência de inserts/updates/deletes; fetch inesperado lança e deve ter zero chamadas. Não há criação de Grant/370, dependência de core/consultas #372 ou mudança de fixtures globais.

Autoria ainda NÃO EXECUTADA em SQL: exige seleção ROOT sobre PR453 exata e lease de banco. RED OR já tem prova causal histórica R18/probe5ea987; produção não foi revertida para criar RED artificial. Lint focal 365e66 EXIT0; TSC original8192 em acompanhamento, resultado não antecipado. Nenhuma aprovação nativa é presumida por lint/tipagem.

TSC final: e7b4f3 sessão19654 acompanhada até ede32c terminal EXIT0, --noEmit --incremental false/config original/heap8192/UTC/sete providers vazios/localhost:1 mock. Sem SQL; três casos nativos continuam não executados.

### Execução nativa local do arquivo reutilizável

Arquivo completo operacoes-atendimento-opcoes-escopo-vazio.int.test.ts SHA24373417340ab0206d0f13b44a16eb28ca4e30041c60aba4009dc877b65dc89c executado uma vez após lease ROOT/B500 baseline580473: executor44abbe sessão8744 acompanhada até9cb7f9 terminal EXIT0,3/3,13,03s (testes11,17s), início14:43:09. Config integration original/ci-integracao, Hermes explícito, UTC, heap1024, um worker/no-file-parallelism, sete providers vazios; sem filtros/skips/retry ou edições durante lease. Canários de papéis/ator ativo, scope{}, owner/etapa e filtros VEN/PROF passaram; foto de rows completas das dez entidades permaneceu igual e fetch bloqueado teve zero chamadas. afterAll encerra Prisma. Não importa core/consultas #372.

Resultado atribuído à fonte OR3ba72c9b e ao checkout local4b58034d com novo teste, não à PR453 exata ainda. Seleção/execução pública independente, integração e CI permanecem sob ROOT; não declarar QA independente ou regressão global aprovada. Banco liberado imediatamente após terminal; restauração final será atribuída ao recibo ROOT próprio. Nenhuma SQL adicional ou commit/push pelo DEV nesta etapa.
