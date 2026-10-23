# ERP Genius

Sistema de gestão escolar (ERP) para a Escola Genius.

## Visão geral

Plataforma web para gerenciar a operação da escola de ponta a ponta:
alunos e matrículas, financeiro, vida acadêmica, equipe e um módulo de
vendas/CRM com automação de atendimento via WhatsApp.

## Módulos

O escopo e a situação de cada entrega são mantidos no [quadro único](docs/planejamento/quadro-entregas.md). O repositório inclui matrícula/contratos, financeiro, agenda, avaliações, portal, CRM e WhatsApp, além dos módulos de IA assistiva, gateway simulado e empresas incorporados da main. A existência do módulo não comprova conclusão integral da SPEC.

## Documentação

Comece pelo índice mestre: [`docs/00-indice.md`](docs/00-indice.md) — ordem de leitura
recomendada e mapa de toda a documentação.

Atalhos:
- [`docs/41-situacao-consolidada-do-projeto.md`](docs/41-situacao-consolidada-do-projeto.md) — situação atual, entregas, pendências e evidências
- [`docs/01-escopo-requisitos.md`](docs/01-escopo-requisitos.md) — o que o sistema precisa fazer
- [`docs/02-arquitetura.md`](docs/02-arquitetura.md) — tecnologias e estrutura técnica
- [`docs/03-roadmap.md`](docs/03-roadmap.md) — plano de construção em fases
- [`docs/11-modelo-de-dados.md`](docs/11-modelo-de-dados.md) — referência do `schema.prisma`
- [`docs/16-plano-execucao.md`](docs/16-plano-execucao.md) — plano de documentação + implementação

Para rodar localmente, ver [`SETUP.md`](SETUP.md).

## Massa de dados de QA

Ambiente de QA apenas. Nunca rode em produção real.

1. `QA_SEED_PASSWORD=... npm run seed:qa`: contas de todos os perfis (a senha vem só do ambiente, nunca do repositório).
2. `QA_SEED_PASSWORD=... QA_DADOS_JSON=/caminho/fora/do/repo.json npm run seed:qa-dados`: configuração (réguas e automações em `SHADOW`, preços oficiais CR/PA, câmbio), professores, turmas, alunos, matrículas e histórico, cobranças e baixas, calendário, aulas, presenças e notas, CRM, B2B, WhatsApp e a conta do portal do aluno. O JSON com os dados reais **não** é versionado. Sem ele, só a massa inventada é gravada. `QA_HOJE=AAAA-MM-DD` fixa a data de referência.
3. `QA_CLEANUP_CONFIRMAR=sim npm run cleanup:qa`: remove todos os registros com id `qa_*`.

Convenções:
- Ids determinísticos `qa_<entidade>_<chave>`, gravados com upsert ou `createMany({ skipDuplicates })`, então o seed é idempotente e pode ser reexecutado.
- Registros inventados usam o prefixo `QA-`, e-mails `@qa.geniusidiomas.test` e telefones `+5060000xxxx`.
- Baixas passam por `Recebimento` + `DestinacaoRecebimento`, como no app. Não há mensagens `NA_FILA` nem solicitações de envio do portal.
- Recebimentos e versões de calendário são imutáveis no app. Por isso a limpeza roda numa transação com `session_replication_role = replica`, e exige um papel com permissão para isso.
- A limpeza não reverte os valores das linhas de `PrecoReferencia` preexistentes que o seed atualizou para a tabela oficial.

## Status

A consolidação da SPEC está em desenvolvimento local. Consulte o [quadro de entregas](docs/planejamento/quadro-entregas.md) para evidências e pendências. Integrações externas continuam desligadas até homologação; este merge não autoriza produção.
