# Estratégia de Testes

> O que testar e como, a partir da Fase 0. Pragmático: cobrir o que **quebra dinheiro,
> auditoria ou permissão** — não perseguir 100% de cobertura.

## Status atual (julho/2026)
| Camada | Status | Detalhe |
|---|---|---|
| **Unitário (Vitest)** | ✅ existe | 273 testes em `src/**/*.test.ts` (regras puras, schemas, réguas). Roda com `npm test`. |
| **Integração (Server Actions × DB)** | ✅ **implementada** | Postgres de teste DESCARTÁVEL sem docker/admin (`npm run test:db` — binários do `embedded-postgres`, porta 54329, dados em `.testdb/`). Suites `src/**/*.int.test.ts` rodam com `npm run test:int`. A URL do banco de teste é FIXADA em `vitest.integration.config.ts` (nunca lê `.env`) — impossível apontar para produção por engano. |
| **e2e (Playwright)** | ⏳ futuro | Opcional na Fase 0; só após as telas estabilizarem. |

> As leituras (`consultas.ts`) têm escopo **row-level testado por integração** (vendedor não
> abre lead/ficha de terceiro), e sessões usam **papéis frescos do banco** (revogação vale na
> hora — ver `_shared/sessao.ts`); há teste de integração cobrindo a revogação. O rate-limit do
> login (`lib/rate-limit-login.ts`) tem teste unitário próprio.

### Fluxos prioritários para a integração (ordem) — estado
1. ✅ **Permissão por papel + row-level** — `comercial/leads.int.test.ts` (vendedor só vê os
   próprios; gerente vê tudo; papel revogado no banco derruba a ação) e
   `ajustes/ficha.int.test.ts` (ficha financeira fora do escopo → `null`).
2. ✅ **Mutação grava `Evento`** na mesma transação — `leads.int.test.ts` (`LeadCriado` +
   `LeadAtribuido` com autor; ação barrada não grava nada).
3. ⏳ **Ativação de matrícula** — `matricula/ativacao.int.test.ts` PRONTA (cronograma, comissão
   aprovada, lead Matriculado, eventos, atomicidade do criar+ativar), aguardando a resolução dos
   marcadores de merge em `matricula/schema.ts` para rodar.
4. ✅ **`gerarCodigo()`** sob concorrência — `lib/codigo.int.test.ts` (30 gerações concorrentes,
   zero duplicatas/buracos: o `upsert` com `increment` é atômico no Postgres).

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
- **Banco de teste** isolado: `npm run test:db` sobe um Postgres embutido (binários npm do
  `embedded-postgres`, sem docker/WSL/admin) na porta **54329**, dados em `.testdb/` (gitignored);
  `npm run test:db:stop` derruba. `npm run test:int` aplica as migrations (globalSetup) e roda as
  suites `*.int.test.ts` em série (`fileParallelism: false` — as suites truncam o banco entre si).
  A URL fica hardcoded em [`vitest.integration.config.ts`](../vitest.integration.config.ts): os
  testes **nunca** enxergam o `DATABASE_URL` do `.env` (produção).
- **Sessão nos testes de integração:** mock de `@/lib/auth` devolve só `{ user: { id } }` — os
  papéis vêm do próprio banco de teste (papéis frescos), então a autorização real é exercitada.
  Helpers em [`src/test/integracao.ts`](../src/test/integracao.ts) (truncar, usuários, catálogo mínimo).
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
