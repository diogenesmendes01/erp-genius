# ERP Genius

Sistema de gestão escolar (ERP) para a Escola Genius.

## Visão geral

Plataforma web para gerenciar a operação da escola de ponta a ponta:
alunos e matrículas, financeiro, vida acadêmica, equipe e um módulo de
vendas/CRM com automação de atendimento via WhatsApp.

## Módulos

| Módulo | O que faz | Fase |
|---|---|---|
| Alunos e Matrículas | Cadastro de alunos, responsáveis, turmas e matrículas | 1 (MVP) |
| Financeiro | Mensalidades, pagamentos, inadimplência, relatórios | 2 |
| Acadêmico | Notas, frequência, boletins, calendário | 3 |
| Professores e Funcionários | Cadastro de equipe, horários | 3 |
| Vendas / CRM | Funil de leads, follow-up, conversão em matrícula | 4 |
| Automação WhatsApp | Atendimento e follow-up automatizados | 4 |

## Documentação

Comece pelo índice mestre: [`docs/00-indice.md`](docs/00-indice.md) — ordem de leitura
recomendada e mapa de toda a documentação.

Atalhos:
- [`docs/01-escopo-requisitos.md`](docs/01-escopo-requisitos.md) — o que o sistema precisa fazer
- [`docs/02-arquitetura.md`](docs/02-arquitetura.md) — tecnologias e estrutura técnica
- [`docs/03-roadmap.md`](docs/03-roadmap.md) — plano de construção em fases
- [`docs/11-modelo-de-dados.md`](docs/11-modelo-de-dados.md) — referência do `schema.prisma`
- [`docs/16-plano-execucao.md`](docs/16-plano-execucao.md) — plano de documentação + implementação

Para rodar localmente, ver [`SETUP.md`](SETUP.md).

## Status

🟢 **Fase 0 implementada** — operação manual ponta a ponta: Configuração (países, catálogo,
turmas, usuários), CRM (pipeline, ficha do lead), matrícula manual, Homes (vendedor/gerente/
professor), área de alunos e financeiro manual. Tudo backed pelo banco (eventos + estado) com
permissões por papel. Próximo: Fase 1 (automações). Ver [`docs/16-plano-execucao.md`](docs/16-plano-execucao.md).
