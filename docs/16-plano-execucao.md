# Plano de Execução — ERP Genius

> Plano mestre para (A) **fechar a documentação** e (B) **implementar a Fase 0** em código,
> nessa ordem. Documento vivo: marque os itens conforme avançarem.

## Decisões deste plano
- **Estratégia:** ambos, em sequência — primeiro completar/padronizar a documentação, depois
  usá-la como blueprint para codar.
- **Ponto de partida do código:** seguir o **roadmap** ([`03-roadmap.md`](03-roadmap.md)) — **Fase 0**
  (operar a escola inteira **manualmente** dentro do sistema, sem automações/integrações/IA).
- **Decisões de schema aplicadas (D17–D19, ver [`15`](15-decisoes-adr.md)):** preço tipado
  (`PrecoReferencia`), `MovimentacaoAluno` tipada e ativação por 3 flags
  (`contratoOk + pagamentoTaxaOk + primeiraMensalidadeOk`). Falta só a **matriz de valores** (P5).

## Estado atual (junho/2026)
- **Documentação:** docs `01`–`23` cobrem escopo, arquitetura, roadmap, domínio, fluxo de
  matrícula, catálogo, papéis, CRM/WhatsApp, telas da Fase 0, regras cross-cutting, modelo de
  dados, eventos, convenções, testes, ADRs, design system e cargas Q10.
- **Código (Fase 0 implementada):**
  - ✅ Login (Auth.js) com os 7 papéis · rotas protegidas · app shell com sidebar role-aware.
  - ✅ `schema.prisma` completo (modelo **eventos + estado**) · migrations · seed.
  - ✅ **Telas da Fase 0 implementadas** (home, pipeline, leads, alunos, financeiro,
    configuração, matrícula) — ver os itens **B0–B7** marcados na Etapa B abaixo. O
    `<Placeholder/>` segue como componente reutilizável, não como app inteira.

### Lacunas / inconsistências encontradas no diagnóstico
| # | Problema | Ação na Etapa A |
|---|---|---|
| 1 | "Modelo de dados inicial" do doc 02 está **stale** (cita `Mensalidade/Professor/Disciplina/Nota/Frequencia`, que não existem no schema). O doc 04 também lista entidades antigas (`LinhaCobranca/NegociacaoLog/DocumentoAluno`). | Criar `11-modelo-de-dados.md` (fiel ao schema) e apontar 02/04 para ele |
| 2 | Eventos de domínio espalhados entre 02 e 10, sem catálogo canônico | Criar `12-catalogo-de-eventos.md` |
| 3 | Sem glossário / linguagem ubíqua | Criar `17-glossario.md` |
| 4 | "Monólito modular por domínio" não refletido em `src/` (sem camada `server/`) | Criar `13-convencoes-codigo.md` |
| 5 | Sem doc de contratos / Server Actions / Zod | Coberto em `13-convencoes-codigo.md` |
| 6 | Sem estratégia de testes | Criar `14-estrategia-de-testes.md` |
| 7 | README "Status: Planejamento" desatualizado | Housekeeping |
| 8 | Decisões em aberto (gateway, conta WhatsApp, volume) sem log | Criar `15-decisoes-adr.md` |
| 9 | Arquivo lixo `_teste_unlink` na raiz | Housekeeping |

---

## Etapa A — Fechar a documentação

> Objetivo: documentação consistente e fiel ao schema, pronta para guiar o código.

- [x] **A1.** `00-indice.md` — índice mestre + ordem de leitura recomendada.
- [x] **A2.** `11-modelo-de-dados.md` — referência fiel do `schema.prisma` (entidades, enums,
      relações, índices, contadores). Seções "Modelo de dados" dos docs 02 e 04 redirecionadas.
- [x] **A3.** `12-catalogo-de-eventos.md` — cada evento: `tipo · agregado · gatilho · payload
      (de→para) · quem dispara · versão`. Consolida 02 §Eventos + 10 §9.
- [x] **A4.** `13-convencoes-codigo.md` — fronteiras de módulo (`comercial · financeiro · alunos ·
      catalogo · acesso`), estrutura-alvo de `src/` (camada `src/server/<dominio>`), padrão de
      Server Actions, validação Zod compartilhada, regra "toda mutação grava `Evento`",
      guards de permissão server-side.
- [x] **A5.** `14-estrategia-de-testes.md` — o que testar (máquinas de estado, comissão,
      permissões, geração de cronograma), ferramentas e dados de teste.
- [x] **A6.** `15-decisoes-adr.md` — log de decisões + pendências (gateway de pagamento,
      conta WhatsApp Business, volume de alunos/usuários, cadência de estudos de preço).
- [x] **A7.** `17-glossario.md` — linguagem ubíqua (Pré A1, rolling, dono, SLA, segmento×
      modalidade, criar×alocar, etc.).
- [x] **A8.** Housekeeping — README atualizado (status real + link p/ `00-indice`); SETUP.md
      expandido (tabela de env vars + scripts + troubleshooting); `_teste_unlink` removido;
      `.gitignore` conferido (`.next` já ignorado).

---

## Etapa B — Implementar a Fase 0

> Cada item substitui um `<Placeholder/>` por tela usável, backed pelo schema. Ordem por
> dependência (a Home **consome** o que a Ficha do Lead **captura** — ver [`09`](09-fase0-telas.md) §Dependências).

- [x] **B0. Fundação de domínio** — camada `src/server/_shared` (`sessao` · `evento` ·
      `validacao`), guards de permissão server-side, `registrarEvento(tx)`, primitivos Zod;
      `Contador`/`gerarCodigo` já existiam. `auth.ts` agora propaga `user.id`.
- [x] **B1. Configuração (backstage)** — Países · Catálogo · Turmas · Usuários & papéis.
      *Primeiro: abastece todas as demais telas.* (docs 04, 06, 07, 09)
  - [x] Shell com sub-abas role-aware (`/configuracao`, aba ativa preenchida).
  - [x] **Países** — lista, criar/editar (com tipos de documento), ciclo de status
        (Rascunho→Ativo→Pausado→Encerrado) com checklist de prontidão + Evento.
  - [x] **Catálogo** — idiomas (add/ativar) · modalidades (add/editar, mínimo) · níveis ·
        produtos (idioma × modalidade) · **preços** (PrecoReferencia, com supersede/histórico).
  - [x] **Turmas** — criar/editar · ciclo (Planejada→Aberta→Em andamento→Concluída) ·
        capacidade real · professor · rolling · código T-.
  - [x] **Usuários & papéis** — criar/editar · multi-papel · ativo/inativo · limite de desconto · último acesso.
- [x] **B2. Pipeline / Kanban + Ficha do Lead** — domínio comercial (criar/editar lead,
      mover etapa, interação, experimental, proposta, perdido, atribuir dono); lista de leads
      com filtros; **Ficha do Lead** (trilha, resumo, datas, timeline, ações); **Kanban**
      (colunas PF + Perdido, toggle B2B, mover por seletor). Visibilidade row-level do vendedor.
      *Polish deferido: drag-and-drop real (hoje seletor) e etapas B2B dedicadas.*
- [x] **B3. Matrícula manual** — `/matriculas/nova?lead=` pré-preenchido (aluno, responsável
      financeiro, nível inicial+origem, contrato com certificado); cria aluno + matrícula
      (AGUARDANDO) + taxa + 1ª mensalidade + comissão. "Receber pagamento e ativar" (P7) → ATIVA,
      **gera o cronograma restante na ativação**, comissão Aprovada, lead Matriculado. (docs 05, 09, 10)
- [x] **B4. Home do Vendedor + Home do Gerente** — fila por regras determinísticas
      (novo/SLA · follow-up vencido · experimental hoje · proposta parada); cards (incl. comissão);
      agenda; funil resumido; meta. Gerente: KPIs, ranking, funil. Home genérica p/ demais papéis. (doc 09)
- [x] **B5. Área Alunos** — Lista (busca + status + situação financeira) · Ficha do Aluno
      (turma atual, dados, financeiro, histórico de movimentações, ações) · Ficha da Turma
      (ocupação + alunos) · movimentações via `MovimentacaoAluno` + Evento; cancela
      mensalidades futuras em pausa/encerramento. (doc 09)
- [x] **B6. Financeiro manual** — sub-abas Cobranças · Inadimplência · Comissões · Visão geral;
      baixa manual (parcial → saldo); cobrança via `wa.me` (5 modelos, sem Cloud API, registra
      tentativa); fechar mês de comissões; KPIs. (docs 09, 10)
- [x] **B7. Visão do Professor** — Home enxuta (minhas turmas + check-in da experimental
      Compareceu/Faltou → devolve o lead à fila comercial). (doc 09)

### Aderência ao doc 09 (fidelidade)
Após revisão campo-a-campo, foram fechadas as telas/itens que faltavam: **Ficha Financeira do
Aluno** e **Renegociação/Aprovações** (telas que estavam ausentes); **uploads** (documentos do
lead + comprovante), **nível inicial/origem** e **responsável financeiro** na matrícula,
**Valor da oportunidade** + **Histórico de dono** + **Documentos** na Ficha do Lead, **Kanban
drag-and-drop** (dnd-kit) + valor por coluna, **SLA/Oportunidades/Próximo lead** e
**Alertas SLA/Equipe** nas Homes, **idiomas/modalidades por país**, filtros de Alunos, hero do
Professor, **a-vencer agrupado** no Financeiro. Residual fino em [`15`](15-decisoes-adr.md) §P17.

### Qualidade
- [x] **Design system** (tokens + dark mode + Tabler + Anthropic Sans + sentence case) — ver [`18`](18-design-system.md).
- [x] **Testes unitários** (Vitest) das regras puras — ver [`14`](14-estrategia-de-testes.md). `npm test`.
- [x] **Typecheck** como verificação estática: `npx tsc --noEmit` (tsconfig com `noEmit`).
- [ ] Testes de **integração** das Server Actions contra DB de teste (próximo).
- [ ] **ESLint (gap aberto):** o script `npm run lint` aponta para `next lint`, que **foi
      removido no Next.js 16** e **não há ESLint configurado** no projeto (sem dependência nem
      config). Até resolver, a checagem estática é `npx tsc --noEmit`. Pendência: (re)adicionar
      ESLint flat config compatível com Next 16 e ajustar o script — ver [`SETUP.md`](../SETUP.md)
      §Verificação estática.

### Fora da Fase 0 (não fazer agora)
Automações, WhatsApp Cloud API, IA (scoring/resumo), DocuSign, gateways de pagamento,
faturamento corporativo B2B, portal do aluno, notas/frequência completas — tudo Fase 1+.

---

## Como acompanhar
Marque os checkboxes acima conforme cada item é concluído. Cada entrega da Etapa B deve:
1. respeitar as máquinas de estado e permissões dos docs 07/10;
2. gravar `Evento` em toda mutação relevante (doc 12);
3. seguir as convenções do doc 13.
