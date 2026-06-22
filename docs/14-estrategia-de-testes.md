# Estratégia de Testes

> O que testar e como, a partir da Fase 0. Pragmático: cobrir o que **quebra dinheiro,
> auditoria ou permissão** — não perseguir 100% de cobertura.

## Status atual (junho/2026)
| Camada | Status | Detalhe |
|---|---|---|
| **Unitário (Vitest)** | ✅ existe | 19 testes em `src/server/_shared/*.test.ts` (regras puras). Roda com `npm test`. |
| **Integração (Server Actions × DB)** | ⛔ **pendente** | Falta o Postgres de teste isolado; sem ele, os riscos de **permissão**, **gravação de `Evento`** e **`gerarCodigo()` sob concorrência** ainda não têm cobertura automatizada. |
| **e2e (Playwright)** | ⏳ futuro | Opcional na Fase 0; só após as telas estabilizarem. |

> **Risco aberto principal:** os guards de permissão das **leituras** (`consultas.ts`) não são
> exercitados por teste (e hoje sequer existem como guard — ver
> [`16-plano-execucao.md`](16-plano-execucao.md) §Limitações). A suíte de integração é o que
> fecha esse e os demais riscos de auditoria/financeiro listados abaixo.

### Fluxos prioritários para a integração (ordem)
1. **Permissão por papel** numa mutação representativa de cada domínio (vazamento = vendedor vê lead de outro).
2. **Mutação grava `Evento`** na mesma transação (auditoria/timeline confiáveis).
3. **Ativação de matrícula** → gera cronograma + comissão Aprovada + lead Matriculado (distorce receita se errar).
4. **`gerarCodigo()`** sob concorrência (códigos duplicados).

## Prioridades (o que mais importa testar)
A regra: teste pesado onde o erro é caro e silencioso.

| Área | Por que crítico | Tipo de teste |
|---|---|---|
| **Máquinas de estado** (Lead, Matrícula, Cobrança, Comissão, Aluno) | Transição inválida corrompe o funil/financeiro | Unitário |
| **Comissão** (geração, valor = % da taxa, estorno <30d) | É dinheiro do vendedor — gera briga | Unitário |
| **Geração de cronograma** na ativação da matrícula | Erro distorce receita prevista e inadimplência | Unitário/Integração |
| **Permissões** (guards server-side por papel) | Vazamento = vendedor vê lead de outro, etc. | Integração |
| **Gravação de `Evento`** em toda mutação | Sem isso, auditoria/timeline mentem | Integração |
| **`gerarCodigo()`** sob concorrência | Códigos duplicados | Integração |
| **Validadores de documento/telefone** (cpf, curp, e164…) | Bloqueio/aviso errado trava cadastro | Unitário |

## Pirâmide
- **Base — unitário:** funções puras (validadores, cálculo de comissão, regras de transição,
  priorização da fila da Home). Rápidos, sem banco.
- **Meio — integração:** Server Actions contra um Postgres de teste (transação + Evento +
  permissão). É onde mora a maior parte do valor neste projeto.
- **Topo — e2e (opcional na Fase 0):** fluxos críticos ponta-a-ponta (login → criar lead →
  converter em matrícula → ativar). Adicionar quando as telas estabilizarem.

## Ferramentas
- **Vitest** instalado e configurado ([`vitest.config.ts`](../vitest.config.ts), resolve `@/`
  via tsconfig paths). Scripts: `npm test` (run) e `npm run test:watch`.
- **Banco de teste** isolado (`DATABASE_URL` de teste) com `prisma migrate reset` por suíte,
  ou Postgres em container — **pendente** (testes de integração das Server Actions). Nunca
  rodar testes contra o banco de dev/prod.
- **e2e (futuro):** Playwright.

## Cobertura atual (unitária — regras puras)
Em `src/server/_shared/*.test.ts` (19 testes):
- **`regras.test.ts`** — `calcularComissao` (% da taxa), `vencimentoMensalidade` (cronograma,
  vira o ano), `ehEtapaManual` (Perdido/Matriculado fora).
- **`validacao.test.ts`** — `validarDocumento` (CPF válido/ inválido / validador desconhecido),
  `telefoneE164` (bloqueia formato inválido).
- **`sessao.test.ts`** — `temPapel` (Admin passa sempre) e `exigirPapel` (lança `ErroPermissao`).
- **`resultado.test.ts`** — `executarAcao` mapeia sucesso e os erros (Regra/Permissão/Zod/inesperado).

> As regras de negócio foram extraídas para `_shared/regras.ts` (puras) e reusadas nas ações —
> testar a regra uma vez cobre todas as telas que a usam.

## Dados de teste
- Reaproveitar/estender o [`prisma/seed.ts`](../prisma/seed.ts) (já cria os 7 papéis/usuários).
- Factories mínimas por entidade para montar cenários (lead em cada etapa, matrícula
  aguardando, cobrança vencida…).

## Convenções
- Um arquivo de teste ao lado do código (`*.test.ts`) ou em `__tests__/` por domínio.
- Nome do teste descreve a regra de negócio em pt-BR ("estorna comissão se cancelar antes de 30 dias").
- Todo bug corrigido ganha um teste de regressão.

## Definição de pronto (Fase 0)
Uma tela/ação está "pronta" quando: respeita permissões (testado), grava `Evento` (testado),
e a regra de negócio central tem teste unitário. Lint e build passam.
