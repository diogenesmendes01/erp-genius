# ERP Genius

Sistema de gestão escolar (ERP) para a Escola Genius.

## Visão geral

Plataforma web para gerenciar a operação da escola de ponta a ponta:
alunos e matrículas, financeiro, vida acadêmica, equipe e um módulo de
vendas/CRM com automação de atendimento via WhatsApp.

## Módulos

| Módulo | O que faz | Status |
|---|---|---|
| Alunos e Matrículas | Cadastro de alunos, responsáveis, turmas e matrículas | ✅ |
| Vendas / CRM | Funil de leads, follow-up, conversão em matrícula, cockpit na inbox | ✅ |
| Automação WhatsApp | Saudação, réguas C1/C2 (piloto), cobrança, fechamento C4, gestão C5 | ✅ |
| IA copiloto (C3) | Resumo/temperatura/segmento/etapa sugeridos — só-leitura, humano decide | ✅ |
| Financeiro | Base manual + gateway por driver, conciliação, comissões automáticas | ✅ |
| B2B | Empresas, matrículas em lote, fatura única, relatório por colaborador | ✅ |
| Acadêmico | Frequência, notas, teste de nível, progressão, certificados | ✅ |
| Portal do aluno | Turma, frequência, boletim, financeiro (com pagamento), certificados | ✅ |

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

🟢 **Fases 0–3 implementadas** (ago/2026) — operação ponta a ponta: Fase 0 (operação
manual completa), Fase 1 (canal WhatsApp + automações comerciais C1–C5, com os
bloqueadores B1–B9 do piloto fechados — doc 32), Fase 2 (gateway de pagamento por driver
com conciliação automática, comissões, B2B com fatura única) e Fase 3 (acadêmico +
portal do aluno). **Toda automação nasce DESLIGADA** (regra de ouro do doc 27) — ligar é
decisão explícita na configuração. Integrações externas reais (WABA/Meta, DocuSign,
GreenPay) permanecem por trás de drivers — o driver simulado roda tudo localmente.
Ver [`docs/16-plano-execucao.md`](docs/16-plano-execucao.md).
