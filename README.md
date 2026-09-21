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

## Status

A consolidação da SPEC está em desenvolvimento local. Consulte o [quadro de entregas](docs/planejamento/quadro-entregas.md) para evidências e pendências. Integrações externas continuam desligadas até homologação; este merge não autoriza produção.
