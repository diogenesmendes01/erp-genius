# ERP Genius

Sistema de gestão escolar (ERP) para a Escola Genius.

## Visão geral

Plataforma web para gerenciar a operação da escola de ponta a ponta:
alunos e matrículas, financeiro, vida acadêmica, equipe e um módulo de
vendas/CRM com automação de atendimento via WhatsApp.

## Módulos

| Módulo | O que existe no código local | O que falta completar |
|---|---|---|
| Alunos e Matrículas | Cadastro, documentos, ativação e retomada mediante aprovação | Renovação reutilizando aluno existente e múltiplos cursos |
| Financeiro | Contas a receber, conferência, recebimentos parciais, ajustes e comissões | Pagamentos integrados, conciliação e contas a pagar |
| Acadêmico | Turmas, diário/presença e mudanças de nível aprovadas | Agenda por encontro, avaliações, progressão e certificados |
| Professores e Funcionários | Cadastro, papéis e vínculos docentes | Disponibilidade, substituições e remuneração por aula/hora |
| Vendas / CRM | Funil, experimental, propostas, carteira/equipe e cobertura | Tarefas completas, SLA, métricas por coorte e retenção |
| WhatsApp | Inbox, atendimento institucional, fila e cadências com revalidação | Homologação real, histórico paginado e recuperação de webhooks |

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

**08/09/2026 — D01–D14 implementadas e validadas localmente no escopo documentado.**
A última rodada passou com 571 testes unitários, 390 de integração, TypeScript, build e
32 verificações HTTP; ESLint teve 0 erros e 9 avisos preexistentes. Há cadências de
WhatsApp no código. ERP completo, integrações externas e homologação/implantação em
produção continuam pendentes. Consultar o [relatório consolidado](docs/41-situacao-consolidada-do-projeto.md)
para distinguir entregas, validação local e próximos passos; os docs 33/34 são históricos.
