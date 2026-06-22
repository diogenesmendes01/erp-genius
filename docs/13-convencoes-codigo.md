# Convenções de Código e Arquitetura de Aplicação

> Como o código é organizado e escrito. Vale a partir da Fase 0. Baseado nas decisões de
> [`02-arquitetura.md`](02-arquitetura.md) e no que já existe na fundação V0.

## Stack (já travada)
Next.js 16 (App Router) · TypeScript · Tailwind · Prisma + PostgreSQL · Auth.js (NextAuth v5
beta) · Zod · React Hook Form. Ícones: `@tabler/icons-react` (outline).

## Monólito modular por domínio
Um código só, **organizado por domínio** com fronteiras claras:
`comercial · financeiro · alunos · catalogo · acesso`. Sem microserviços (time pequeno,
produto novo). As fronteiras permitem extrair um módulo em serviço **se** um dia precisar.

### Estrutura de pastas — atual vs. alvo
```
src/
├── app/
│   ├── (app)/              # área autenticada (layout protege via auth())
│   │   ├── home/ pipeline/ leads/ alunos/ financeiro/ configuracao/
│   │   └── layout.tsx      # redirect p/ /login se sem sessão
│   ├── api/auth/[...nextauth]/
│   ├── api/upload/         # POST multipart → public/uploads (comprovantes/documentos)
│   └── login/
├── components/             # UI reutilizável (Sidebar, Placeholder, UploadArquivo, ...)
├── lib/                    # infra transversal: prisma, auth, roles, nav, codigo, labels
└── server/                 # lógica de negócio por domínio (Server Actions)
    ├── _shared/            # helpers transversais: sessao · evento · validacao · resultado
    ├── paises/             # país/mercado + ProdutoPais (habilitação)
    ├── catalogo/           # idiomas · modalidades · níveis · produtos · preços
    ├── turmas/             # turmas + consultas de níveis/professores
    ├── comercial/          # leads, kanban, ficha, documentos, check-in
    ├── matricula/          # criar/ativar matrícula (aluno + cobranças + comissão)
    ├── alunos/             # movimentações (pausar/reativar/encerrar/trocar turma)
    ├── financeiro/         # baixa manual · WhatsApp · comissões · KPIs
    ├── ajustes/            # renegociação + aprovações (AjusteFinanceiro/Aprovacao)
    ├── home/               # consultas das Homes (vendedor/gerente/professor)
    └── acesso/             # usuários & papéis
```

> **Padrão por domínio:** `schema.ts` (Zod compartilhado) · `consultas.ts` (leituras, sem
> `"use server"`, chamadas por Server Components) · `acoes.ts` (`"use server"`, mutações que
> usam `executarAcao` + guards + `registrarEvento`).
> **Regra de fronteira:** uma tela (`app/`) chama uma **Server Action** do domínio (`server/`);
> as ações é que falam com o Prisma. Telas não montam queries de negócio diretamente.

## Padrão de Server Action
Toda mutação segue o mesmo esqueleto (envolto em `executarAcao` → retorna `Resultado`):
```ts
"use server";
// 1. executarAcao padroniza retorno {ok} + tratamento de erro
// 2. autenticar + autorizar (guard server-side — NUNCA confiar só no menu)
// 3. validar entrada com Zod
// 4. mudar estado + gravar Evento na MESMA transação
// 5. revalidatePath
export async function moverEtapa(id: string, etapa: EtapaLead): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL); // Admin passa sempre
    // ...validação Zod conforme a ação...
    await prisma.$transaction(async (tx) => {
      const antes = await tx.lead.findUniqueOrThrow({ where: { id } });
      await tx.lead.update({ where: { id }, data: { etapa } });
      await registrarEvento(tx, {
        tipo: "EtapaAlterada", agregadoTipo: "Lead", agregadoId: id,
        autorId: autor.id, payload: { de: antes.etapa, para: etapa },
      });
    });
    revalidatePath("/pipeline");
  });
}
```
> `exigirSessao()` retorna o **usuário** direto (`{ id, nome, papeis }`), não `{ user }`.
> Leituras para Server Components ficam em `consultas.ts` (sem `"use server"`).

> **Next 16:** `params` e `searchParams` das páginas/layouts são **assíncronos** —
> tipe como `Promise<{...}>` e use `const { id } = await params;`. (Build usa **Turbopack**.)

## Regras inegociáveis
1. **Toda mutação relevante grava um `Evento`** na mesma transação (ver
   [`12-catalogo-de-eventos.md`](12-catalogo-de-eventos.md) e doc 10 §9).
2. **Permissão é verificada no servidor**, em cada ação — o menu role-aware
   ([`nav.ts`](../src/lib/nav.ts)) é só UX, não segurança.
3. **Ninguém apaga nada** — soft-delete via status (doc 10 §6). Nada de `delete` físico.
4. **Códigos legíveis** via `gerarCodigo()` ([`codigo.ts`](../src/lib/codigo.ts)) — nunca
   construir `L-000001` à mão.
5. **Multi-moeda:** cada cobrança na sua moeda; consolidação em USD só em relatório (doc 09).
6. **Máquinas de estado** (doc 10 §1) são a fonte das transições válidas — validar antes de mudar.

## Validação com Zod (esquema compartilhado)
Um schema por entidade de entrada, reusado no formulário (React Hook Form +
`@hookform/resolvers`) e na Server Action. Telefone/e-mail **bloqueiam** se inválidos;
documento **avisa mas salva** marcado como não validado (doc 04 §3).

## Infra transversal já existente (`src/lib`)
| Arquivo | Papel |
|---|---|
| [`prisma.ts`](../src/lib/prisma.ts) | Singleton do PrismaClient (evita múltiplas conexões em dev) |
| [`auth.ts`](../src/lib/auth.ts) | Auth.js: Credentials + bcrypt; injeta `papeis` no JWT/session |
| [`roles.ts`](../src/lib/roles.ts) | `PAPEL_LABEL`, `temPapel()`, `isAdmin()` |
| [`nav.ts`](../src/lib/nav.ts) | Navegação role-aware (`navParaPapeis`) |
| [`codigo.ts`](../src/lib/codigo.ts) | `gerarCodigo()` transacional (L-/A-/M-/C-/T-) |

## Helpers de domínio (`src/server/_shared`) — criados na B0
| Arquivo | Exporta |
|---|---|
| `sessao.ts` | `exigirSessao()` · `exigirPapel(u, ...)` · `temPapel()` · `exigirSessaoComPapel()` · erros `ErroAutenticacao`/`ErroPermissao`/`ErroRegra` |
| `evento.ts` | `registrarEvento(tx, { tipo, agregadoTipo, agregadoId, autorId, payload })` |
| `validacao.ts` | `telefoneE164` · `emailSchema` (bloqueiam) · `validarDocumento(validador, valor)` (avisa-não-bloqueia) |
| `resultado.ts` | `Resultado<T>` (`{ok}`) · `executarAcao(fn)` — padroniza retorno + tratamento de erro das ações |
| `index.ts` | barrel dos quatro acima |

> `exigirSessao` lê `auth()` e exige `user.id` (propagado no callback de
> [`auth.ts`](../src/lib/auth.ts)); Administrador passa em qualquer `exigirPapel`.

## Estilo (UI)
> Padrão visual completo em [`18-design-system.md`](18-design-system.md): flat/minimalista,
> **tokens via CSS variables** (tema claro/escuro troca sozinho), **Anthropic Sans** (pesos 400/500),
> ícones **Tabler outline**, cantos 8–12px, **sem sombras/gradientes**, texto sempre **sentence case**.

- **Idioma do domínio em pt-BR** no código (nomes de modelo/campo/ação), alinhado ao schema.
- TypeScript estrito; preferir tipos do `@prisma/client` (enums `Papel`, `EtapaLead`…).
- Componentes pequenos e server-first; `"use client"` só quando há interação/estado.
- Tailwind para estilo; sem CSS solto fora de `globals.css`.
