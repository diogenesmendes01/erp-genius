# Índice da Documentação — ERP Genius

> Ponto de entrada de toda a documentação. Leia nesta ordem para entender o projeto
> do "porquê" ao "como".

## Ordem de leitura recomendada

### 1. Entender o produto
| Doc | Conteúdo |
|---|---|
| [`01-escopo-requisitos.md`](01-escopo-requisitos.md) | O que o sistema precisa fazer · perfis · módulos |
| [`03-roadmap.md`](03-roadmap.md) | Plano de construção em fases (Fase 0 → 3) |
| [`17-glossario.md`](17-glossario.md) | Linguagem ubíqua (termos do domínio) |

### 2. Entender o domínio (regras de negócio)
| Doc | Conteúdo |
|---|---|
| [`04-fase1-dominio.md`](04-fase1-dominio.md) | País como espinha dorsal · validação · preços · moeda |
| [`05-fase1-fluxo-matricula.md`](05-fase1-fluxo-matricula.md) | Matrícula como máquina de estados |
| [`06-fase1-catalogo-cursos.md`](06-fase1-catalogo-cursos.md) | Modalidades · níveis (CEFR) · turmas · Pré A1 |
| [`08-comercial-crm-whatsapp.md`](08-comercial-crm-whatsapp.md) | CRM · funis PF/B2B · origem · comissão · automação (Fase 1+) |
| [`07-papeis-permissoes.md`](07-papeis-permissoes.md) | Os 7 papéis · função + propriedade (row-level) |
| [`10-regras-sistema.md`](10-regras-sistema.md) | Regras cross-cutting · máquinas de estado · permissões · jobs |

### 3. Entender a técnica
| Doc | Conteúdo |
|---|---|
| [`02-arquitetura.md`](02-arquitetura.md) | Stack · monólito modular · modelagem por eventos |
| [`11-modelo-de-dados.md`](11-modelo-de-dados.md) | **Referência fiel** do `schema.prisma` (entidades, enums, relações) |
| [`12-catalogo-de-eventos.md`](12-catalogo-de-eventos.md) | Todo evento de domínio (tipo · gatilho · payload · autor) |
| [`13-convencoes-codigo.md`](13-convencoes-codigo.md) | Fronteiras de módulo · Server Actions · Zod · padrão de Evento |
| [`18-design-system.md`](18-design-system.md) | Tokens · dark mode · tipografia · ícones · estilo flat |
| [`14-estrategia-de-testes.md`](14-estrategia-de-testes.md) | O que testar e como |

### 4. Construir
| Doc | Conteúdo |
|---|---|
| [`09-fase0-telas.md`](09-fase0-telas.md) | Especificação tela por tela da Fase 0 (UX) |
| [`24-cobrancas-regua-fluxo.md`](24-cobrancas-regua-fluxo.md) | Redesenho de Cobranças: régua + cérebro/braço + dash/lista/detalhe |
| [`25-motor-de-risco-cobranca.md`](25-motor-de-risco-cobranca.md) | **Spec V2 (não implementado)**: motor de risco do aluno — score explicável + faseamento |
| [`16-plano-execucao.md`](16-plano-execucao.md) | **Plano mestre** de documentação + implementação (checklist) |
| [`15-decisoes-adr.md`](15-decisoes-adr.md) | Log de decisões e pendências em aberto |

## Convenções da documentação
- **Idioma:** pt-BR.
- **Numeração:** os arquivos `04`–`06` mantêm a numeração legada ("Fase 1") no nome; o
  conteúdo segue válido — a **sequência de construção** autoritativa é o [`03-roadmap.md`](03-roadmap.md).
- **Fonte da verdade do dado:** o [`schema.prisma`](../prisma/schema.prisma) é a fonte canônica;
  o doc [`11`](11-modelo-de-dados.md) o descreve. Em divergência, vale o schema (e atualiza-se o doc 11).
