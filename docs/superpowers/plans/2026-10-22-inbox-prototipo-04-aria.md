# Inbox, Etapa 3: Aria na conversa (plano de implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o estado da Aria em cada atendimento chega à lista, aos filtros, ao cabeçalho e à thread do Inbox: cartão "Aria sugere", faixa e modal de handoff e faixa "Aria ativa", sempre dentro das regras atuais do ERP enquanto as decisões D1–D4 estiverem abertas.

**Architecture:** o servidor deriva um estado único por atendimento (`EstadoAria`) a partir da pausa da Aria no atendimento, das sugestões `SUGERIDA` vigentes, do handoff ainda não atendido, do estado global da Aria e do responsável. A mesma regra existe em duas formas, com um teste que obriga as duas a concordar: uma função pura, que marca cada linha da lista, e condições Prisma, que filtram e contam. A thread recebe cartões de sugestão e o resumo do handoff pela consulta do painel que já existe (`carregarAriaDoAtendimento`). Dois gatilhos novos no Postgres (`AcaoAgenteIA` e `AgenteIA`) publicam `AvisoInbox` no canal que já existe, e assim a lista, as contagens e a thread se atualizam pelo SSE atual. O que depende de D1–D4 fica em tasks separadas e bloqueadas, já com testes e interfaces.

**Tech Stack:** Next.js (App Router, Server Actions), Prisma/Postgres (LISTEN/NOTIFY), Zod, React 19, Tailwind com tokens, Vitest (unit: `node_modules/.bin/vitest run <arquivo>`; integração: `node_modules/.bin/vitest run -c vitest.integration.config.ts <arquivo>`).

**Spec:**
- `docs/planejamento/inbox-prototipo/analise-parte2-botoes-funcionalidades.md`: §1 (L17, L18, L20–L26, L31–L33), §2 (C2, C6, C9, C10, C23, C24), §4 (A1–A7), §5 (F1), §11.1, §11.2, §12 (perguntas 4–7, 16, 17) e §13;
- `docs/planejamento/inbox-prototipo/analise-parte3-telas-atalhos.md`: bloco B8 e perguntas 1, 2, 17 e 18;
- `docs/planejamento/inbox-prototipo/analise-parte1-design.md`: §3.2 (selo e badges), §3.3 (faixa de handoff), §3.5 (cartão) e §3.6 (rodapé travado);
- protótipo `docs/planejamento/inbox-prototipo/prototipo/Inbox.dc.html`: L114–L121 (faixa "Aria ativa"), L139 e L148–L152 (selo, prévia e badge), L165–L180 (cabeçalho), L253–L262 (faixa de handoff), L298–L326 (cartão), L408–L415 (rodapé travado), L435–L468 (modal), L752 (`META`), L893–L912 (`approve`, `reject`, `takeOver`, `giveBack`), L983–L999 (contagens, prévia e `locked`), L1014–L1022 (cartão) e L1026–L1034 (faixa);
- contrato comum: `docs/superpowers/plans/2026-10-22-inbox-prototipo-00-indice.md`.

Linhas do ERP citadas como `arquivo:linha` valem para o main `7e4810e5`.

---

## Acréscimos ao contrato (E3)

Tudo aqui é aditivo: nenhum nome do índice muda. Quando a task correspondente da E1 já tiver sido mergeada, o executor estende o que existe; não cria um segundo.

| Onde | Acréscimo | Task |
|---|---|---|
| `src/server/inbox/estado-aria.ts` (novo) | `ESTADOS_ARIA = ["ia", "aprovacao", "handoff", "humano"] as const`; `type EstadoAria = (typeof ESTADOS_ARIA)[number]`. Os quatro valores coincidem com os `TomEstado` de mesmo nome (`estado-visual.ts`, E1). | 1 |
| `ItemListaInbox` (`src/server/inbox/consultas-pagina.ts:18`) | `estadoAria: EstadoAria \| null`; `atendidoPorVoce: boolean`; `previaAutor: AutorPrevia \| null`; `previaRotulo: string \| null`. `type AutorPrevia = "aria" \| "voce" \| "pessoa" \| "sugestao"` mora em `src/server/inbox/previa.ts`. | 2 |
| `FiltrosInbox` (`src/server/inbox/filtros.ts:5`) | `aria?: EstadoAria`, lido de `?aria=` e escrito por `paramsDosFiltros` (`InboxNovo.tsx:43`). | 3 |
| `src/server/inbox/contagens.ts` (novo) | `ContagemChipsInbox`, `SituacaoAriaInbox`, `ResumoListaInbox` e `resumoDaListaInbox(u, f)`. É a única contagem dos chips. Se a E1 tiver criado outra, esta a substitui (a E1 mantém só a renderização). | 3 |
| `GET /api/inbox/atendimentos` | Sem `cursor` e com `contagens=1`, a resposta ganha `resumo: ResumoListaInbox`. | 3 |
| `AvisoInbox["tipo"]` (`src/server/inbox/barramento.ts:9`) | `"aria.global"`: o estado global da Aria mudou. Não tem atendimento, passa no filtro do SSE para todos (como `resync`) e não carrega conteúdo. | 4 |
| `ChipFiltroInbox` (`ChipsFiltro.tsx`, E1) | `href?: string`. Com ele, o chip navega para o `href`. Os chips do Inbox passam a vir de `chipsDoInbox(contagens, filtros)` (`src/app/(app)/inbox/chips-inbox.ts`, novo), com os ids `todas`, `ia`, `aprovacao`, `handoff`, `humano`, `sem-resposta` e `fila`. | 5 |
| `estadoVisualItem` (`estado-visual.ts`, E1) | **A assinatura não muda.** A função passa a ler os campos novos de `ItemListaInbox`, e o retorno ganha `seloIA: boolean`. O corpo muda em dois pontos: o badge de estado da Aria vem primeiro e a prévia ganha o prefixo de autor. | 5 |
| `ColunaConversas` (E1) | `resumo?: ResumoListaInbox` (contagens dos chips). O slot `faixaAria` recebe `<FaixaAriaAtiva>`. | 5, 6 |
| `CabecalhoConversa` (E1) | `linhaAria?: { tom: TomEstado; texto: string; dica: string \| null } \| null`, que substitui a linha de estado do subtítulo quando presente, e o slot `acoesAria?: React.ReactNode`, posto antes do botão do painel. | 7 |
| `InboxNovo` / `PropsInboxNovo` | `resumoInicial?: ResumoListaInbox`. | 5 |
| `AriaDoAtendimento` (`src/server/whatsapp/consultas-inbox.ts:258`) | `podeDecidir: boolean`, `cartoes: SugestaoAriaThread[]` e `handoff: HandoffDoAtendimento \| null`. O campo `sugestoes` sai na Task 12, junto com `PainelAria`. | 8, 10, 12 |
| Thread (`ItemFio` da E2) | Variante nova `{ tipo: "sugestao-aria"; s: SugestaoAriaThread }`, intercalada por `intercalarSugestoes` (`aria/intercalar.ts`) sobre a saída de `intercalarFio`. | 9 |
| Compositor (E1) | O `<textarea>` do compositor ganha o atributo `data-compositor-campo`, que o modal de handoff usa para levar o foco ao campo. | 11 |
| `src/lib/labels.ts` | `MOTIVO_HANDOFF_LABEL: Readonly<Record<MotivoHandoff, string>>`. Ele sai do mapa local de `aria/_componentes/Playground.tsx:19-33`. | 10 |
| Componentes novos fora da tabela do índice | `aria/ModalResumoHandoff.tsx`, `aria/BotaoDevolverAria.tsx`, `aria/textos-aria.ts`, `aria/sugestao-visual.ts` e `aria/intercalar.ts`. | 7, 9, 11 |

## Dependências de outras etapas

**E0** (`2026-10-22-inbox-prototipo-01-correcoes.md`). O plano ainda não existe no main deste worktree, então as dependências ficam explícitas. Quem executar a E3 confere cada uma no plano da E0 quando ele existir:

1. As notas internas **do atendimento** (`Evento` `NotaInterna` com `agregadoTipo: "AtendimentoWhatsApp"`, gravado em `src/server/whatsapp/acoes-conversa.ts:24-46`) aparecem na thread. Isso inclui as gravadas pela Aria com `autorId: null` e `payload.ator = "ARIA"` (`src/server/aria/turno/handoff.ts:135-143`), com o autor "Aria". O resumo do handoff é essa nota. Se a E0 só exibir as notas do lead (`notasDoLead`, `consultas-inbox.ts:204`), a nota do handoff continua invisível na thread, e a Task 11 abre uma issue na E0.
2. Existe um `agora` vivo (o "prazo vivo" da E0, o mesmo que `ItemConversa` recebe pela prop `agora`) sem `setInterval` (`sem-polling.test.ts`). A faixa de handoff usa esse `agora` para "há N min".
3. Se a E0 publicar aviso para `Evento`, a E3 não depende disso. O handoff já atualiza o `AtendimentoWhatsApp` na mesma transação (`handoff.ts:129-134`), e isso dispara `notificar_inbox`.

**E2** (`2026-10-22-inbox-prototipo-03-painel-crm.md`, já no worktree) e **E4** (`2026-10-22-inbox-prototipo-05-fluxos.md`). Pontos de contato:
- a E2 torna `desfazerAcaoAria` idempotente por natureza em `src/server/aria/historico.ts:163-176`, e a Task 8 desta etapa faz o mesmo com aprovar e rejeitar no mesmo arquivo: quem mergear depois rebaseia sem conflito de regra;
- a E2 cria o fio (`ItemFio`, `intercalarFio`), e a Task 9 só acrescenta a variante `sugestao-aria`;
- a E2 deixa o `PainelAria` abaixo da aba Detalhes até a Task 12 retirá-lo;
- a E4 (resumo da Aria na transferência, D5) reaproveita `lerNotaResumo` e `handoffDoAtendimento` da Task 10 no lugar de `resumoDaAriaParaNota`.

**E1** (`2026-10-22-inbox-prototipo-02-design.md`). Do contrato: `ColunaConversas` (slot `faixaAria`), `ChipsFiltro`, `ItemConversa`, `estado-visual.ts` (`TomEstado`, `estadoVisualItem`), `BadgeEstado`, `CabecalhoConversa`, `RodapeConversa` (modo `"travado"`), `Avatar` com `selo?: "ia"`, o balão com `autor: "aria"`, a thread com eventos e o harness `scripts/visual/demo-inbox.ts` com `scripts/visual/capturar-inbox.mjs`. As tasks de servidor (1–4, 8 e 10) não dependem da E1.

---

## Global Constraints

Valem todas as do índice (`00-indice.md`, seções "Global Constraints" e "Aceite visual"). Para esta etapa:

- Migrations só na faixa `20261023200000`–`20261023290000`. Esta etapa usa duas: `20261023200000_inbox_aria_indice_handoff` (índice parcial, `CREATE INDEX CONCURRENTLY`, sozinho) e `20261023210000_inbox_aria_tempo_real` (funções e gatilhos novos). Nenhuma função SQL existente é redefinida, porque `notificar_inbox` (`prisma/migrations/20261017100000_inbox_tempo_real/migration.sql`) fica intacta, e por isso não há `diff -w`.
- Enquanto as decisões estiverem abertas valem os padrões: **D1**, só Admin e Gerente Comercial decidem sugestões (`capacidadesAria` em `src/server/aria/permissoes-tela.ts:27-31`, filtro do Inbox em `consultas-inbox.ts:280`, escopo do gerente em `src/server/aria/escopo-decisao.ts:35`); **D2**, uma sugestão por vez e sem edição (`aprovarAcaoAria(id)` em `src/server/aria/historico.ts:44`); **D3**, compositor livre, a Aria pausa no primeiro envio humano (`aoGravarSaidaHumana`, `src/server/aria/pausa.ts:62-69`) e "Assumir" só tira da fila (`assumirAtendimento`, `src/server/whatsapp/acoes-atendimento.ts:89`); **D4**, sem interruptor no Inbox (a pausa global fica em `/aria`, com motivo, `src/server/aria/estado.ts:72-96`).
- O estado "humano", "Sem resposta" e "Não atribuída" não criam regra de papel. A faixa, os chips e o badge mostram estado, nunca o conteúdo da sugestão, para quem não decide. O conteúdo só sai para quem passa em `leadsDecidiveis` (`escopo-decisao.ts:24`).
- O nome da Aria aparece literal ("Aria"), como em `src/lib/labels.ts:158` e no `PainelAria` atual. O `config.nome` da versão publicada fica para depois (ver Suposições).
- Toda ação nova com efeito colateral segue o #166. As ações existentes que esta etapa chama passam a ser idempotentes por natureza (Task 8).
- Sem polling: nada de `setInterval(` nem `router.refresh()` em `src/app/(app)/inbox/**` (`sem-polling.test.ts`). O tempo real vem de `AvisoInbox`.
- Rótulos de enum só em `src/lib/labels.ts` (`src/app/enums-rotulos.test.ts`). Rótulo novo de mapa entra na lista da trava.
- Os rótulos de seção do modal ficam em sentence case ("O que o contato quer"), sem o `text-transform: uppercase` do protótipo (análise parte 1 §5).
- O cartão e a faixa de handoff ficam sem sombra se a E1 não tiver liberado `shadow-card` em `paleta.test.ts`. Não ampliar a trava nesta etapa.

## Review Focus

1. **A Aria é pausada globalmente com a lista aberta.** Nenhuma linha continua "IA atendendo", a contagem `ia` vai a 0 e a faixa mostra "Pausada". Testes: `pausa_global_tira_todas_de_ia` (Task 1) e `pausa_global_avisa_aria_global` (Task 4).
2. **Uma pessoa responde pelo celular depois do handoff.** A conversa sai de "Handoff pendente" sem ninguém clicar em nada. Teste: `resposta_pelo_celular_encerra_handoff_pendente` (Task 1).
3. **Aprovação repetida (duplo clique ou reenvio após falha de rede).** Sai uma mensagem só, e o segundo clique devolve ok. Teste: `aprovar_repetido_pelo_mesmo_decisor_nao_duplica_intencao` (Task 8).
4. **A sugestão expira com o cartão aberto.** Aprovar mostra "Esta sugestão expirou.", e o cartão vira "Expirou" no próximo aviso. Testes: `aprovar_sugestao_expirada_mostra_erro` (Task 9) e `expirar_avisa_e_cartao_vira_expirada` (Task 8).
5. **O gerente de outra equipe vê o atendimento (escopo do setor), mas não decide.** Vê o badge "Aguardando aprovação" e a linha "Aria aguarda aprovação", sem cartão e sem o conteúdo da sugestão na prévia. Testes: `gerente_de_outra_equipe_ve_estado_sem_cartao` (Task 8) e `previa_de_sugestao_mostra_so_o_rotulo` (Task 2).

---

## Mapa de arquivos

**Servidor**

| Arquivo | Novo/muda | Responsabilidade |
|---|---|---|
| `src/server/inbox/estado-aria.ts` | novo | `EstadoAria`, contexto global, derivação pura e condições Prisma (Task 1) |
| `src/server/inbox/previa.ts` | novo | Autor da prévia (Task 2) |
| `src/server/inbox/consultas-pagina.ts` | muda | Campos novos do item; exporta `condicoesDosFiltros`, `CONDICAO_FILA` e `condicaoPrazoEstourado` (Tasks 2 e 3) |
| `src/server/inbox/filtros.ts` | muda | `aria` na URL (Task 3) |
| `src/server/inbox/contagens.ts` | novo | Contagens dos chips e situação da Aria para a faixa (Task 3) |
| `src/app/api/inbox/atendimentos/route.ts` | muda | `contagens=1` (Task 3) |
| `prisma/migrations/20261023200000_inbox_aria_indice_handoff/migration.sql` | novo | Índice parcial do handoff (Task 1) |
| `prisma/migrations/20261023210000_inbox_aria_tempo_real/migration.sql` | novo | Gatilhos de `AcaoAgenteIA` e `AgenteIA` (Task 4) |
| `src/server/inbox/barramento.ts`, `src/server/inbox/eventos-sse.ts` | muda | `aria.global` (Task 4) |
| `src/server/aria/historico.ts` | muda | Aprovar e rejeitar idempotentes por natureza (Task 8) |
| `src/server/aria/sugestoes-thread.ts` | novo | Cartões da thread (Task 8) |
| `src/server/aria/turno/handoff.ts` | muda | `lerNotaResumo` (Task 10) |
| `src/server/aria/handoff-inbox.ts` | novo | Resumo do handoff para o Inbox (Task 10) |
| `src/server/whatsapp/consultas-inbox.ts` | muda | `AriaDoAtendimento` estendido (Tasks 8, 10 e 12) |
| `src/lib/labels.ts` | muda | `MOTIVO_HANDOFF_LABEL` (Task 10) |

**Tela** (relativo a `src/app/(app)/inbox/`)

| Arquivo | Novo/muda | Responsabilidade |
|---|---|---|
| `chips-inbox.ts` | novo | Chips, `href` e chip ativo (Task 5) |
| `estado-visual.ts` | muda (E1) | Badge de estado, prévia e selo (Task 5) |
| `ItemConversa.tsx`, `ColunaConversas.tsx`, `InboxNovo.tsx`, `page.tsx`, `useEventosInbox.ts` | muda | Ligações (Tasks 4–7, 9 e 11) |
| `aria/FaixaAriaAtiva.tsx` | novo | Faixa da coluna (Task 6) |
| `aria/textos-aria.ts` | novo | Textos do estado, da pausa e do "há N min" (Task 7) |
| `aria/BotaoDevolverAria.tsx` | novo | "Devolver para Aria" no cabeçalho (Task 7) |
| `aria/sugestao-visual.ts`, `aria/intercalar.ts`, `aria/CartaoSugestaoAria.tsx` | novo | Cartão na thread (Task 9) |
| `aria/FaixaHandoff.tsx`, `aria/ModalResumoHandoff.tsx` | novo | Handoff (Task 11) |
| `PainelAria.tsx` | sai | Conteúdo redistribuído (Task 12) |

---

<a id="task-1"></a>
### Task 1: Estado da Aria derivado no servidor

Define o que cada estado significa, numa função pura e em condições Prisma equivalentes.

| Estado | Regra (na ordem; a primeira que vale decide) | Dados |
|---|---|---|
| — (`null`) | Atendimento encerrado ou conversa de grupo | `encerradoEm`, `conversa.grupoId` |
| `handoff` ("Handoff pendente") | `iaPausaMotivo = HANDOFF` e, depois de `iaPausadaEm`, nenhuma `MensagemWhatsApp` SAIDA com origem `HUMANO`/`CELULAR` e nenhum `Evento` `AtendimentoAssumido` | pausa, último envio humano, `Evento` |
| `humano` (Aria pausada) | `iaPausadaEm` preenchido por outro motivo, ou handoff já atendido | pausa |
| `aprovacao` ("Aguardando aprovação") | Existe `AcaoAgenteIA` `SUGERIDA` com `expiraEm` nulo ou futuro | sugestões |
| `ia` ("IA atendendo") | A Aria está ativa globalmente (`ATIVA`, com versão publicada, sem pausa global e sem orçamento estourado com `PAUSAR`) e o atendimento passa nas guardas da Aria (`motivoParaNaoAtuar` sem bloqueio: COMERCIAL, sem pausa, sem opt-out, número sem dono) | `situacaoAria`, `estadoOrcamento`, atendimento |
| `humano` ("Com você"/"Com X") | `responsavelId` preenchido | responsável |
| — (`null`) | Nenhuma das anteriores: a fila sem Aria | — |

"Sem resposta" e "Não atribuída" não são estados exclusivos: são marcações sobrepostas que já existem (`consultas-pagina.ts:64`, prazo estourado; `:61`, fila) e vivem em qualquer estado. A Task 3 só as conta.

**Files:**
- Create: `src/server/inbox/estado-aria.ts`
- Create: `prisma/migrations/20261023200000_inbox_aria_indice_handoff/migration.sql`
- Test: `src/server/inbox/estado-aria.test.ts`
- Test: `src/server/inbox/estado-aria.int.test.ts`

**Interfaces:**
- Consumes (servidor existente):
  - `situacaoAria(agora?, tx?)`: `src/server/aria/estado.ts:30-47` (estado, pausa global, versão);
  - `estadoOrcamento(agora?)`: `src/server/aria/uso.ts:51` (`situacao`, `acao`);
  - `motivoParaNaoAtuar(s: SituacaoGuarda)`: `src/server/aria/turno/guardas.ts:42-55` (as mesmas guardas do turno, `orquestrador.ts:141-155`).
- Produces:
  - `export const ESTADOS_ARIA = ["ia", "aprovacao", "handoff", "humano"] as const; export type EstadoAria = (typeof ESTADOS_ARIA)[number];`
  - `export interface ContextoEstadoAria { ariaAtiva: boolean; handoffPendentes: ReadonlySet<string>; agora: Date }`
  - `export interface LinhaEstadoAria { id: string; finalidade: FinalidadeAtendimentoWhatsApp; encerradoEm: Date | null; iaPausadaEm: Date | null; responsavelId: string | null; grupo: boolean; numeroComDono: boolean; contatoOptOut: boolean }`
  - `export function ariaAtivaGlobal(s: { estado: EstadoPolitica; pausada: boolean; temVersao: boolean }, o: { situacao: "OK" | "ALERTA" | "ESTOURADO"; acao: AcaoOrcamentoIA }): boolean`
  - `export function derivarEstadoAria(a: LinhaEstadoAria, ctx: ContextoEstadoAria, sugestaoPendente: boolean): EstadoAria | null`
  - `export function linhaEstadoDe(a: { id; finalidade; encerradoEm; iaPausadaEm; responsavelId; conversa: { grupoId: string | null; numero: { donoId: string | null }; contato: { optOutEm: Date | null } | null } }): LinhaEstadoAria`
  - `export const sugestaoVigente = (agora: Date): Prisma.AcaoAgenteIAWhereInput => ({ status: "SUGERIDA", OR: [{ expiraEm: null }, { expiraEm: { gt: agora } }] })`
  - `export async function idsHandoffPendente(db: Db, ids?: readonly string[]): Promise<string[]>`
  - `export async function carregarContextoAria(db: Db, o?: { atendimentoIds?: readonly string[]; agora?: Date }): Promise<ContextoEstadoAria>`
  - `export async function sugestoesPendentesPorAtendimento(db: Db, ids: readonly string[], agora: Date): Promise<Map<string, { acao: AcaoAgenteIATipo; criadoEm: Date }>>` (a mais recente de cada atendimento)
  - `export function condicaoEstadoAria(estado: EstadoAria, ctx: ContextoEstadoAria): Prisma.AtendimentoWhatsAppWhereInput`
  - `type Db = Prisma.TransactionClient | typeof prisma`

- [ ] **Step 1: Escrever o teste unitário que falha** (`estado-aria.test.ts`)

```ts
const base: LinhaEstadoAria = { id: "a1", finalidade: "COMERCIAL", encerradoEm: null, iaPausadaEm: null, responsavelId: null, grupo: false, numeroComDono: false, contatoOptOut: false };
const ctx = (o: Partial<ContextoEstadoAria> = {}): ContextoEstadoAria => ({ ariaAtiva: true, handoffPendentes: new Set(), agora: new Date("2026-10-23T12:00:00Z"), ...o });
const pausada = { ...base, iaPausadaEm: new Date("2026-10-23T11:00:00Z") };

describe("derivarEstadoAria", () => {
  it("ordem_handoff_pausa_aprovacao_ia_responsavel", () => {
    expect(derivarEstadoAria(pausada, ctx({ handoffPendentes: new Set(["a1"]) }), true)).toBe("handoff");
    expect(derivarEstadoAria(pausada, ctx(), true)).toBe("humano");
    expect(derivarEstadoAria(base, ctx(), true)).toBe("aprovacao");
    expect(derivarEstadoAria(base, ctx(), false)).toBe("ia");
    expect(derivarEstadoAria({ ...base, responsavelId: "u1" }, ctx(), false)).toBe("ia");
    expect(derivarEstadoAria({ ...base, responsavelId: "u1" }, ctx({ ariaAtiva: false }), false)).toBe("humano");
    expect(derivarEstadoAria(base, ctx({ ariaAtiva: false }), false)).toBeNull();
    expect(derivarEstadoAria(base, ctx({ ariaAtiva: false }), true)).toBe("aprovacao");
  });
  it("fora_do_alcance_da_aria_nunca_e_ia", () => {
    for (const extra of [{ finalidade: "FINANCEIRO" as const }, { numeroComDono: true }, { contatoOptOut: true }])
      expect(derivarEstadoAria({ ...base, ...extra }, ctx(), false)).toBeNull();
  });
  it("encerrado_e_grupo_sao_nulos_mesmo_com_sugestao_ou_handoff", () => {
    expect(derivarEstadoAria({ ...pausada, encerradoEm: new Date() }, ctx({ handoffPendentes: new Set(["a1"]) }), true)).toBeNull();
    expect(derivarEstadoAria({ ...base, grupo: true }, ctx(), true)).toBeNull();
  });
});

describe("ariaAtivaGlobal", () => {
  const ok = { situacao: "OK" as const, acao: "PAUSAR" as const };
  it("so_ativa_com_versao_sem_pausa_e_sem_orcamento_pausado", () => {
    expect(ariaAtivaGlobal({ estado: "ATIVA", pausada: false, temVersao: true }, ok)).toBe(true);
    expect(ariaAtivaGlobal({ estado: "SHADOW", pausada: false, temVersao: true }, ok)).toBe(false);
    expect(ariaAtivaGlobal({ estado: "DESLIGADA", pausada: false, temVersao: true }, ok)).toBe(false);
    expect(ariaAtivaGlobal({ estado: "ATIVA", pausada: true, temVersao: true }, ok)).toBe(false);
    expect(ariaAtivaGlobal({ estado: "ATIVA", pausada: false, temVersao: false }, ok)).toBe(false);
    expect(ariaAtivaGlobal({ estado: "ATIVA", pausada: false, temVersao: true }, { situacao: "ESTOURADO", acao: "PAUSAR" })).toBe(false);
    expect(ariaAtivaGlobal({ estado: "ATIVA", pausada: false, temVersao: true }, { situacao: "ESTOURADO", acao: "SO_SUGERIR" })).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/server/inbox/estado-aria.test.ts`
Expected: FAIL com "Cannot find module './estado-aria'".

- [ ] **Step 3: Implementar a parte pura em `src/server/inbox/estado-aria.ts`**

`derivarEstadoAria` segue a tabela acima, na ordem. A elegibilidade é `motivoParaNaoAtuar({ estado: "ATIVA", pausadaGlobal: false, orcamento: "OK", acaoOrcamento: "PAUSAR", conversaDeGrupo: a.grupo, finalidade: a.finalidade, iaPausadaEm: a.iaPausadaEm, atendimentoEncerrado: !!a.encerradoEm, contatoOptOut: a.contatoOptOut, numeroComDono: a.numeroComDono, mensagemTipo: "TEXTO" }) === null`. A parte global fica em `ctx.ariaAtiva`. Assim a regra do turno não é copiada.

- [ ] **Step 4: Rodar e ver passar**

Run: `node_modules/.bin/vitest run src/server/inbox/estado-aria.test.ts`
Expected: PASS.

- [ ] **Step 5: Escrever o teste de integração que falha** (`estado-aria.int.test.ts`)

Cenário: copie `publicar(...)` de `src/server/aria/expiracao.int.test.ts:16-25` (`agenteIA` com `estado` e uma `versaoAgenteIA` PUBLICADA). `vendedor = await criarUsuario([Papel.VENDEDOR])` no `beforeEach`. `atendimento(o?: { responsavel?: boolean; numeroDonoId?: string; finalidade?: "COMERCIAL" | "FINANCEIRO" })` cria um número próprio (`numeroWhatsApp.create`, `donoId: o.numeroDonoId ?? null`), um contato com telefone único e o atendimento por `garantirAtendimento` (`responsavelId: vendedor.id` quando `o.responsavel`), mais a âncora de ENTRADA e o `turnoAgenteIA`, como em `consultas-inbox.aria.int.test.ts:14-30`. Devolve `{ id, conversaId, contatoId, turnoId }`. `sugerir(a, { expiraEm })` cria uma `AcaoAgenteIA` RESPONDER `SUGERIDA` (o mesmo `create` de `consultas-inbox.aria.int.test.ts:27-29`). Helper `estadoDe(id)`, que monta `ContextoEstadoAria` por `carregarContextoAria(prisma, { atendimentoIds: [id] })`, lê a linha com o `include` de `linhaEstadoDe` e chama `derivarEstadoAria`. Helper `idsPor(estado)`: `prisma.atendimentoWhatsApp.findMany({ where: condicaoEstadoAria(estado, ctx) })`.

```ts
it("ia_quando_aria_ativa_e_atendimento_elegivel", async () => {
  await publicar("ATIVA"); const a = await atendimento();
  expect(await estadoDe(a.id)).toBe("ia");
});
it("desligada_ou_shadow_nao_e_ia", async () => {
  await publicar("SHADOW"); const a = await atendimento();
  expect(await estadoDe(a.id)).toBeNull();
});
it("pausa_global_tira_todas_de_ia", async () => {
  await publicar("ATIVA"); const a = await atendimento(); const b = await atendimento({ responsavel: true });
  await prisma.agenteIA.update({ where: { id: "aria" }, data: { pausadoEm: new Date(), motivoPausa: "teste" } });
  expect(await estadoDe(a.id)).toBeNull();
  expect(await estadoDe(b.id)).toBe("humano");
  expect(await idsPor("ia")).toEqual([]);
});
it("sugestao_vigente_vira_aprovacao_e_vencida_nao", async () => {
  await publicar("ATIVA"); const a = await atendimento();
  await sugerir(a, { expiraEm: new Date(Date.now() - 1000) });
  expect(await estadoDe(a.id)).toBe("ia");
  await sugerir(a, { expiraEm: new Date(Date.now() + 3_600_000) });
  expect(await estadoDe(a.id)).toBe("aprovacao");
});
it("handoff_pendente_ate_humano_responder", async () => {
  await publicar("ATIVA"); const a = await atendimento();
  await prisma.$transaction((tx) => pausarAriaNoAtendimento(tx, a.id, "HANDOFF", null));
  expect(await estadoDe(a.id)).toBe("handoff");
  await saida(a, "HUMANO");
  expect(await estadoDe(a.id)).toBe("humano");
});
it("resposta_pelo_celular_encerra_handoff_pendente", async () => {
  await publicar("ATIVA"); const a = await atendimento();
  await prisma.$transaction((tx) => pausarAriaNoAtendimento(tx, a.id, "HANDOFF", null));
  await saida(a, "CELULAR");
  expect(await estadoDe(a.id)).toBe("humano");
});
it("saida_da_propria_aria_nao_encerra_handoff", async () => {
  await publicar("ATIVA"); const a = await atendimento();
  await prisma.$transaction((tx) => pausarAriaNoAtendimento(tx, a.id, "HANDOFF", null));
  await saida(a, "IA");
  expect(await estadoDe(a.id)).toBe("handoff");
});
it("assumir_da_fila_encerra_handoff_pendente", async () => {
  await publicar("ATIVA"); const a = await atendimento();
  await prisma.$transaction((tx) => pausarAriaNoAtendimento(tx, a.id, "HANDOFF", null));
  await prisma.evento.create({ data: { tipo: "AtendimentoAssumido", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: vendedor.id, payload: { de: null, para: vendedor.id } } });
  expect(await estadoDe(a.id)).toBe("humano");
});
it("encerrado_grupo_linha_com_dono_e_outro_setor_nao_sao_ia", async () => {
  await publicar("ATIVA");
  const encerrado = await atendimento(); await prisma.atendimentoWhatsApp.update({ where: { id: encerrado.id }, data: { encerradoEm: new Date(), status: "ENCERRADO" } });
  const comDono = await atendimento({ numeroDonoId: vendedor.id });
  const financeiro = await atendimento({ finalidade: "FINANCEIRO" });
  const optOut = await atendimento(); await prisma.contatoWhatsApp.update({ where: { id: optOut.contatoId }, data: { optOutEm: new Date() } });
  for (const x of [encerrado, comDono, financeiro, optOut]) expect(await estadoDe(x.id)).toBeNull();
  expect(await idsPor("ia")).toEqual([]);
});
it("condicao_e_derivacao_concordam", async () => {
  // Um atendimento por linha da tabela da Task 1, incluindo os nulos. Para cada estado:
  for (const e of ESTADOS_ARIA) {
    const pelaCondicao = (await idsPor(e)).sort();
    const pelaDerivacao = (await Promise.all(todos.map(async (x) => [x.id, await estadoDe(x.id)] as const))).filter(([, s]) => s === e).map(([id]) => id).sort();
    expect(pelaCondicao, e).toEqual(pelaDerivacao);
  }
});
```

`saida(a, origem)` cria uma `MensagemWhatsApp` com `direcao: "SAIDA"`, `origem`, `driver: "MOTOR"`, `status: "ENVIADA"` e `providerMessageId` único.

- [ ] **Step 6: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/estado-aria.int.test.ts`
Expected: FAIL (`carregarContextoAria`, `idsHandoffPendente` e `condicaoEstadoAria` não existem).

- [ ] **Step 7: Implementar a parte com banco e a migration**

`idsHandoffPendente`, com `db.$queryRaw` no padrão de `condicaoNaoLidaPessoal` (`consultas-pagina.ts:40-53`). O filtro por `ids` é opcional (`AND a."id" = ANY(${ids})`):

```sql
SELECT a."id" FROM "AtendimentoWhatsApp" a
WHERE a."iaPausaMotivo" = 'HANDOFF' AND a."encerradoEm" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "MensagemWhatsApp" m WHERE m."atendimentoId" = a."id" AND m."direcao" = 'SAIDA'
                  AND m."origem" IN ('HUMANO', 'CELULAR') AND m."criadoEm" > a."iaPausadaEm")
  AND NOT EXISTS (SELECT 1 FROM "Evento" e WHERE e."agregadoTipo" = 'AtendimentoWhatsApp' AND e."agregadoId" = a."id"
                  AND e."tipo" = 'AtendimentoAssumido' AND e."criadoEm" > a."iaPausadaEm")
```

`carregarContextoAria` monta `ariaAtiva = ariaAtivaGlobal({ estado, pausada, temVersao: !!versao }, await estadoOrcamento(agora))` com `situacaoAria(agora)` e `handoffPendentes = new Set(await idsHandoffPendente(db, o.atendimentoIds))`.

`condicaoEstadoAria`. Com `B = { encerradoEm: null, conversa: { grupoId: null } }`, `H = { id: { in: [...ctx.handoffPendentes] } }`, `S = { acoesAgenteIA: { some: sugestaoVigente(ctx.agora) } }`, `ELEG = { finalidade: "COMERCIAL", iaPausadaEm: null, conversa: { numero: { donoId: null }, contato: { is: { optOutEm: null } } } }` e `NADA = { id: { in: [] } }`:
- `handoff`: `{ AND: [B, H] }`;
- `aprovacao`: `{ AND: [B, { NOT: H }, { iaPausadaEm: null }, S] }`;
- `ia`: se `ctx.ariaAtiva`, `{ AND: [B, { NOT: H }, { NOT: S }, ELEG] }`; senão `NADA`;
- `humano`: `{ AND: [B, { NOT: H }, { OR: [{ iaPausadaEm: { not: null } }, { AND: [{ responsavelId: { not: null } }, { NOT: S }, ...(ctx.ariaAtiva ? [{ NOT: ELEG }] : [])] }] }] }`.

Migration `20261023200000_inbox_aria_indice_handoff/migration.sql`, com um comando só (ver `prisma/migrations/20261020410000_remover_indice_evento_redundante/migration.sql`):

```sql
-- E3 (Inbox): "Handoff pendente" lê só os atendimentos abertos pausados por HANDOFF (estado-aria.ts).
-- CONCURRENTLY não trava escrita; é o único comando porque não roda em transação.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AtendimentoWhatsApp_handoff_aberto_idx" ON "AtendimentoWhatsApp"("iaPausadaEm")
  WHERE "iaPausaMotivo" = 'HANDOFF' AND "encerradoEm" IS NULL;
```

- [ ] **Step 8: Rodar e ver passar**

Run: `node_modules/.bin/vitest run src/server/inbox/estado-aria.test.ts && node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/estado-aria.int.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/server/inbox/estado-aria.ts src/server/inbox/estado-aria.test.ts src/server/inbox/estado-aria.int.test.ts prisma/migrations/20261023200000_inbox_aria_indice_handoff
git commit -m "feat(inbox): estado da Aria por atendimento (ia, aprovação, handoff, humano)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

<a id="task-2"></a>
### Task 2: Estado da Aria e prévia com autor no item da lista

**Files:**
- Create: `src/server/inbox/previa.ts`
- Modify: `src/server/inbox/consultas-pagina.ts:18-25` (interface), `:112-128` (`includeLista` e `montarItens`), `:131-136` (`obterItemListaInbox`)
- Modify (fixtures): todo literal `ItemListaInbox` dos testes (`grep -rln "ItemListaInbox = {" src`: hoje `ListaAtendimentos.test.ts:14`, mais os da E1)
- Test: `src/server/inbox/previa.test.ts`
- Test: `src/server/inbox/consultas-pagina.int.test.ts` (novo `describe`)

**Interfaces:**
- Consumes: Task 1 (`carregarContextoAria`, `sugestoesPendentesPorAtendimento`, `derivarEstadoAria`, `linhaEstadoDe`); `ACAO_AGENTE_IA_LABEL` (`src/lib/labels.ts:536`).
- Produces:
  - `export type AutorPrevia = "aria" | "voce" | "pessoa" | "sugestao";`
  - `export function autorDaPrevia(m: { direcao: "ENTRADA" | "SAIDA"; origem: OrigemEnvio | null; autorId: string | null; autorNome: string | null; criadoEm: Date } | null, sugestao: { acao: AcaoAgenteIATipo; criadoEm: Date } | null, usuarioId: string): { autor: AutorPrevia | null; rotulo: string | null }`
  - `ItemListaInbox` ganha `estadoAria: EstadoAria | null; atendidoPorVoce: boolean; previaAutor: AutorPrevia | null; previaRotulo: string | null`.

Regras de `autorDaPrevia`:
- sugestão vigente mais nova que a última mensagem (ou sem mensagem): `{ "sugestao", ACAO_AGENTE_IA_LABEL[acao] }`, só o rótulo e nunca o texto (Review Focus 5);
- ENTRADA ou sem mensagem: `{ null, null }`;
- SAIDA com origem `IA`: `{ "aria", null }`;
- SAIDA com `autorId === usuarioId`: `{ "voce", null }`;
- SAIDA com origem `HUMANO`/`CELULAR` e autor com nome: `{ "pessoa", primeiro nome }`;
- demais (`CRON`, `LOTE`, `GESTAO`, celular sem autor): `{ null, null }`.

- [ ] **Step 1: Escrever os testes que falham**

`previa.test.ts`:

```ts
const t = (iso: string) => new Date(iso);
const msg = (o: Partial<Parameters<typeof autorDaPrevia>[0] & object> = {}) => ({ direcao: "SAIDA" as const, origem: "HUMANO" as const, autorId: "u2", autorNome: "Camila Souza", criadoEm: t("2026-10-23T10:00:00Z"), ...o });
it("aria_voce_pessoa_e_entrada", () => {
  expect(autorDaPrevia(msg({ origem: "IA", autorId: null, autorNome: null }), null, "u1")).toEqual({ autor: "aria", rotulo: null });
  expect(autorDaPrevia(msg({ autorId: "u1" }), null, "u1")).toEqual({ autor: "voce", rotulo: null });
  expect(autorDaPrevia(msg(), null, "u1")).toEqual({ autor: "pessoa", rotulo: "Camila" });
  expect(autorDaPrevia(msg({ direcao: "ENTRADA", origem: null }), null, "u1")).toEqual({ autor: null, rotulo: null });
  expect(autorDaPrevia(msg({ origem: "CRON", autorId: null, autorNome: null }), null, "u1")).toEqual({ autor: null, rotulo: null });
});
it("previa_de_sugestao_mostra_so_o_rotulo", () => {
  const s = { acao: "RESPONDER" as const, criadoEm: t("2026-10-23T10:05:00Z") };
  expect(autorDaPrevia(msg({ direcao: "ENTRADA", origem: null }), s, "u1")).toEqual({ autor: "sugestao", rotulo: "Responder" });
  expect(autorDaPrevia(msg({ criadoEm: t("2026-10-23T10:06:00Z") }), s, "u1").autor).toBe("pessoa");
  expect(autorDaPrevia(null, s, "u1")).toEqual({ autor: "sugestao", rotulo: "Responder" });
});
```

Em `consultas-pagina.int.test.ts`, um `describe("estado da Aria no item")` com o cenário COMERCIAL e Aria ATIVA da Task 1. `publicar`, `sugerir` e `saida` são os mesmos helpers de `estado-aria.int.test.ts`, extraídos para `src/test/integracao-aria.ts`. `atendimentoComercial(o?: { responsavelId?: string })` é o `atendimento()` da Task 1 com `responsavelId` livre. `saida(a, origem, corpo?)` aceita um corpo opcional.

```ts
it("item_traz_estado_e_previa_da_aria", async () => {
  const a = await atendimentoComercial();
  const [item] = (await listarAtendimentosPagina(sess(admin), {}, null)).itens;
  expect(item).toMatchObject({ id: a.id, estadoAria: "ia", atendidoPorVoce: false, previaAutor: null });
  await saida(a, "IA", "Olá, sou a Aria");
  expect((await obterItemListaInbox(sess(admin), a.id))).toMatchObject({ previaAutor: "aria", preview: "Olá, sou a Aria" });
});
it("atendido_por_voce_so_para_o_responsavel", async () => {
  const a = await atendimentoComercial({ responsavelId: admin.id });
  expect((await obterItemListaInbox(sess(admin), a.id))?.atendidoPorVoce).toBe(true);
});
it("sugestao_pendente_vira_aprovacao_e_previa_de_sugestao", async () => {
  const a = await atendimentoComercial(); await sugerir(a, { expiraEm: new Date(Date.now() + 3_600_000) });
  expect(await obterItemListaInbox(sess(admin), a.id)).toMatchObject({ estadoAria: "aprovacao", previaAutor: "sugestao", previaRotulo: "Responder" });
});
it("grupo_e_secretaria_sem_estado", async () => {
  const a = await criarAtendimento(new Date());
  expect((await obterItemListaInbox(sess(admin), a.id))?.estadoAria).toBeNull();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/server/inbox/previa.test.ts && node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/consultas-pagina.int.test.ts`
Expected: FAIL (`./previa` inexistente; propriedades `estadoAria` e `previaAutor` ausentes).

- [ ] **Step 3: Implementar**

- `includeLista.mensagens.select` (`consultas-pagina.ts:114`) passa a `{ corpo: true, tipo: true, direcao: true, origem: true, autorId: true, criadoEm: true, autor: { select: { nome: true } } }`. `resumirConversa` continua lendo só `corpo` e `tipo`.
- `montarItens(usuarioId, todas)` passa a carregar, numa vez por página, `carregarContextoAria(prisma, { atendimentoIds: ids })` e `sugestoesPendentesPorAtendimento(prisma, ids, ctx.agora)`, e preenche os quatro campos com `derivarEstadoAria(linhaEstadoDe(a), ctx, pendentes.has(a.id))`, `a.responsavelId === usuarioId` e `autorDaPrevia(...)`.
- Atualizar os literais `ItemListaInbox` dos testes com `estadoAria: null, atendidoPorVoce: false, previaAutor: null, previaRotulo: null`.

- [ ] **Step 4: Rodar e ver passar**

Run: os dois comandos do Step 2, e depois `node_modules/.bin/tsc --noEmit`.
Expected: PASS; tsc com saída 0.

- [ ] **Step 5: Commit**

```bash
git add src/server/inbox/previa.ts src/server/inbox/previa.test.ts src/server/inbox/consultas-pagina.ts src/server/inbox/consultas-pagina.int.test.ts src/app/\(app\)/inbox
git commit -m "feat(inbox): item da lista com estado da Aria e autor da prévia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

<a id="task-3"></a>
### Task 3: Filtro `aria` na URL e contagens dos chips

**Files:**
- Modify: `src/server/inbox/filtros.ts:5-8` (tipo), `:15-30` (`lerFiltrosInbox`)
- Modify: `src/server/inbox/consultas-pagina.ts:56-68` (exportar `condicoesDosFiltros` e aplicar `f.aria`; extrair `CONDICAO_FILA` de `:61` e `condicaoPrazoEstourado(agora)` de `:64`)
- Modify: `src/app/(app)/inbox/InboxNovo.tsx:43-54` (`paramsDosFiltros` escreve `aria`)
- Create: `src/server/inbox/contagens.ts`
- Modify: `src/app/api/inbox/atendimentos/route.ts:22-29`
- Test: `src/server/inbox/filtros.test.ts`, `src/app/(app)/inbox/InboxNovo.test.ts`, `src/server/inbox/contagens.int.test.ts`, `src/server/inbox/consultas-pagina.int.test.ts`

**Interfaces:**
- Consumes: Task 1 (`condicaoEstadoAria`, `carregarContextoAria`, `ESTADOS_ARIA`); `escopoAtendimentos` (`src/server/whatsapp/escopo.ts:47`); `capacidadesAria` (`permissoes-tela.ts:27`); `situacaoAria` (`estado.ts:30`).
- Produces:
  - `FiltrosInbox.aria?: EstadoAria`;
  - `export async function condicoesDosFiltros(u: UsuarioSessao, f: FiltrosInbox, ctx?: ContextoEstadoAria): Promise<Prisma.AtendimentoWhatsAppWhereInput[]>`, que carrega o contexto só quando `f.aria` vier e `ctx` não;
  - `export const CONDICAO_FILA: Prisma.AtendimentoWhatsAppWhereInput` e `export const condicaoPrazoEstourado = (agora: Date): Prisma.AtendimentoWhatsAppWhereInput`;
  - em `contagens.ts`:
    - `export interface ContagemChipsInbox { todas: number; ia: number; aprovacao: number; handoff: number; humano: number; semResposta: number; naoAtribuidas: number }`
    - `export interface SituacaoAriaInbox { estado: EstadoPolitica; pausada: boolean; podeGerenciar: boolean }` (`podeGerenciar` = `capacidadesAria(u).has("pausar")`)
    - `export interface ResumoListaInbox { contagens: ContagemChipsInbox; aria: SituacaoAriaInbox }`
    - `export async function resumoDaListaInbox(u: UsuarioSessao, f: FiltrosInbox, agora?: Date): Promise<ResumoListaInbox>`
  - Rota: `GET /api/inbox/atendimentos?…&contagens=1` (sem `cursor`) responde `{ itens, proximo, resumo }`.

A base das contagens é o escopo mais os filtros da URL, **menos** os três filtros que os chips trocam entre si (`aria`, `responsavel === "fila"` e `prazoEstourado`). Assim cada chip mostra quantas conversas ele traria.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// filtros.test.ts
it("aria_na_url", () => {
  expect(lerFiltrosInbox({ aria: "handoff" })).toEqual({ aria: "handoff" });
  expect(lerFiltrosInbox({ aria: "IA" })).toEqual({});
  expect(lerFiltrosInbox({ aria: ["aprovacao", "ia"] })).toEqual({ aria: "aprovacao" });
});
// InboxNovo.test.ts
it("paramsDosFiltros_escreve_aria", () => {
  expect(paramsDosFiltros({ aria: "humano", setor: "COMERCIAL" })).toBe("setor=COMERCIAL&aria=humano");
});
```

`contagens.int.test.ts`. O cenário tem Aria ATIVA (helpers da Task 1), `admin`, `vendedor` (carteira dele) e `outroVendedor`, e sete atendimentos:
- A, COMERCIAL elegível, sem responsável, lead de `outroVendedor` → `ia` e fila;
- B, COMERCIAL elegível, responsável `vendedor`, lead de `vendedor` → `ia`;
- C, COMERCIAL com sugestão vigente, sem responsável, lead de `outroVendedor` → `aprovacao` e fila;
- D, COMERCIAL pausado por `HANDOFF`, responsável `vendedor`, lead de `vendedor` → `handoff`;
- E, COMERCIAL pausado por `HUMANO_RESPONDEU`, responsável `admin`, lead de `outroVendedor` → `humano`;
- F, SECRETARIA sem responsável, com `prazoRespostaEm` vencido e `primeiraRespostaEm` nulo → sem estado, fila e sem resposta;
- G, FINANCEIRO com responsável `admin` → `humano`.

O vendedor enxerga B e D (carteira).

```ts
it("conta_cada_chip_no_escopo", async () => {
  const r = await resumoDaListaInbox(sess(admin), {});
  expect(r.contagens).toEqual({ todas: 7, ia: 2, aprovacao: 1, handoff: 1, humano: 2, semResposta: 1, naoAtribuidas: 3 });
  expect(r.aria).toEqual({ estado: "ATIVA", pausada: false, podeGerenciar: true });
});
it("base_ignora_os_filtros_dos_chips_e_respeita_os_outros", async () => {
  const sem = await resumoDaListaInbox(sess(admin), {});
  expect(await resumoDaListaInbox(sess(admin), { aria: "handoff", responsavel: "fila", prazoEstourado: true })).toEqual(sem);
  expect((await resumoDaListaInbox(sess(admin), { setor: "FINANCEIRO" })).contagens.todas).toBe(0);
});
it("vendedor_conta_so_o_proprio_escopo_e_nao_gerencia", async () => {
  const r = await resumoDaListaInbox(sess(vendedor), {});
  expect(r.contagens).toMatchObject({ todas: 2, ia: 1, handoff: 1, aprovacao: 0, humano: 0 });
  expect(r.aria.podeGerenciar).toBe(false);
});
```

Em `consultas-pagina.int.test.ts`:

```ts
it("filtro_e_item_concordam_em_cada_estado", async () => {
  for (const e of ESTADOS_ARIA) {
    const { itens } = await listarAtendimentosPagina(sess(admin), { aria: e }, null);
    expect(itens.length, e).toBe((await resumoDaListaInbox(sess(admin), {})).contagens[e]);
    expect(itens.every((i) => i.estadoAria === e), e).toBe(true);
  }
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/server/inbox/filtros.test.ts src/app/\(app\)/inbox/InboxNovo.test.ts && node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/contagens.int.test.ts src/server/inbox/consultas-pagina.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `lerFiltrosInbox`: `const aria = um(p.aria); if ((ESTADOS_ARIA as readonly string[]).includes(aria)) f.aria = aria as EstadoAria;`.
- `condicoesDosFiltros`: `if (f.aria) c.push(condicaoEstadoAria(f.aria, ctx ?? await carregarContextoAria(prisma)))`.
- `resumoDaListaInbox`: um `carregarContextoAria(prisma, { agora })` e sete `prisma.atendimentoWhatsApp.count` em `Promise.all` sobre `{ AND: [escopo, ...condicoesDosFiltros(u, { ...f, aria: undefined, prazoEstourado: undefined, responsavel: f.responsavel === "fila" ? undefined : f.responsavel }, ctx), X] }`, onde `X` é a condição de cada chip (`{}`, os quatro estados, `condicaoPrazoEstourado(agora)` e `CONDICAO_FILA`). `aria` sai de `situacaoAria(agora)`.
- Rota: depois da página, `if (!cursor && params.get("contagens") === "1") resposta.resumo = await resumoDaListaInbox(usuario, filtros)`.

- [ ] **Step 4: Rodar e ver passar**

Run: os comandos do Step 2.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/inbox src/app/api/inbox/atendimentos/route.ts src/app/\(app\)/inbox/InboxNovo.tsx src/app/\(app\)/inbox/InboxNovo.test.ts
git commit -m "feat(inbox): filtro por estado da Aria e contagens dos chips

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

<a id="task-4"></a>
### Task 4: Tempo real das sugestões, dos handoffs e do estado global da Aria

**O que já avisa hoje** (gatilho `notificar_inbox`, migration `20261017100000_inbox_tempo_real`): toda escrita em `MensagemWhatsApp` e todo `UPDATE` em `AtendimentoWhatsApp`. Isso cobre a pausa por atendimento (`pausa.ts:46-49`), o devolver (`pausa.ts:85-88`) e o handoff (`handoff.ts:129-134`).

**O que não avisa** (análise parte 2 §13): sugestão nova (`INSERT` em `AcaoAgenteIA` com `SUGERIDA`, `executor.ts:122-137`), aprovar e rejeitar (`historico.ts:52`, `:67`), expirar (`expiracao.ts:25`) e pausar ou ligar a Aria globalmente (`estado.ts:60`, `:83-86`, `:106-109`).

**Files:**
- Create: `prisma/migrations/20261023210000_inbox_aria_tempo_real/migration.sql`
- Modify: `src/server/inbox/barramento.ts:9` (tipo `"aria.global"`)
- Modify: `src/server/inbox/eventos-sse.ts:46-47` (deixa passar `aria.global`)
- Modify: `src/app/(app)/inbox/useEventosInbox.ts:5` (`TIPOS`)
- Modify: `src/components/conversa/historico-conversa.ts:173-176` (`aria.global` não busca nada)
- Modify: `src/app/(app)/inbox/InboxNovo.tsx:152-156` (`aoAviso` usa `avisoRecarregaPainel`)
- Test: `src/server/inbox/barramento.int.test.ts`, `src/server/inbox/eventos-sse.test.ts`, `src/app/(app)/inbox/useEventosInbox.test.ts`, `src/components/conversa/historico-conversa.test.ts`, `src/app/(app)/inbox/InboxNovo.test.ts`

**Interfaces:**
- Consumes: `CANAL_INBOX` (`barramento.ts:5`), `criarFiltroDeAvisos` (`eventos-sse.ts:27`).
- Produces:
  - `AvisoInbox["tipo"]` inclui `"aria.global"`, com payload `{ tipo: "aria.global", atendimentoId: null, mensagemId: null, conversaId: "" }`;
  - `export function avisoRecarregaPainel(a: AvisoInbox, selecionado: string | null): boolean` em `InboxNovo.tsx`: `true` para `resync`, para `aria.global` e para `atendimento.atualizado` do selecionado.

- [ ] **Step 1: Escrever os testes que falham**

`barramento.int.test.ts`, com o mesmo `escutar()` e o mesmo `vi.waitFor` dos testes atuais (`:22-35`):

```ts
it("sugestao_nova_avisa_atendimento_atualizado", async () => {
  const { r, sair } = escutar();
  await criarAcao({ status: "SUGERIDA" });
  await vi.waitFor(() => expect(r).toContainEqual({ tipo: "atendimento.atualizado", atendimentoId: a.id, mensagemId: null, conversaId: a.conversaId }), { timeout: 2000 });
  sair();
});
it("mudanca_de_status_da_acao_avisa_e_update_sem_mudanca_nao", async () => {
  const acao = await criarAcao({ status: "SUGERIDA" }); await pausa(300);
  const { r, sair } = escutar();
  await prisma.acaoAgenteIA.update({ where: { id: acao.id }, data: { confianca: 71 } });
  await pausa(500); expect(r).toEqual([]);
  await prisma.acaoAgenteIA.update({ where: { id: acao.id }, data: { status: "REJEITADA" } });
  await vi.waitFor(() => expect(r).toHaveLength(1), { timeout: 2000 });
  sair();
});
it("acao_sem_atendimento_nao_avisa", async () => { /* AcaoAgenteIA com atendimentoId null (CLASSIFICAR_SETOR SIMULADA): r continua [] */ });
it("pausa_global_avisa_aria_global", async () => {
  await prisma.agenteIA.upsert({ where: { id: "aria" }, create: { id: "aria" }, update: {} }); await pausa(300);
  const { r, sair } = escutar();
  // UPDATE sem efeito em estado/pausadoEm (como o travarAgente, estado.ts:25-28): não avisa.
  await prisma.agenteIA.update({ where: { id: "aria" }, data: { motivoPausa: null } });
  await pausa(500); expect(r).toEqual([]);
  await prisma.agenteIA.update({ where: { id: "aria" }, data: { pausadoEm: new Date(), motivoPausa: "teste" } });
  await vi.waitFor(() => expect(r).toContainEqual({ tipo: "aria.global", atendimentoId: null, mensagemId: null, conversaId: "" }), { timeout: 2000 });
  expect(r.filter((x) => x.tipo === "aria.global")).toHaveLength(1);
  sair();
});
it("aviso_da_acao_nao_carrega_conteudo", async () => {
  const { r, sair } = escutar(); await criarAcao({ status: "SUGERIDA", payload: { texto: "segredo" } });
  await vi.waitFor(() => expect(r.length).toBeGreaterThan(0), { timeout: 2000 });
  expect(JSON.stringify(r)).not.toContain("segredo"); sair();
});
```

`eventos-sse.test.ts`:

```ts
it("aria_global_passa_para_todos_sem_consultar_escopo", async () => {
  const passa = criarFiltroDeAvisos(outro);
  expect(await passa({ tipo: "aria.global", atendimentoId: null, mensagemId: null, conversaId: "" })).toBe(true);
  expect(m.atendimento).not.toHaveBeenCalled(); expect(m.conversa).not.toHaveBeenCalled();
});
```

`useEventosInbox.test.ts`: a fonte falsa recebe `addEventListener("aria.global", …)`, e o aviso chega a `aoAviso`.

`historico-conversa.test.ts`: `reagirAoAviso(h, "a1", { tipo: "aria.global", … })` não chama `maisNovas` nem `recarregar`.

`InboxNovo.test.ts`:

```ts
it("avisoRecarregaPainel", () => {
  const av = (tipo: AvisoInbox["tipo"], atendimentoId: string | null = null) => ({ tipo, atendimentoId, mensagemId: null, conversaId: "" });
  expect(avisoRecarregaPainel(av("aria.global"), "a1")).toBe(true);
  expect(avisoRecarregaPainel(av("resync"), null)).toBe(true);
  expect(avisoRecarregaPainel(av("atendimento.atualizado", "a1"), "a1")).toBe(true);
  expect(avisoRecarregaPainel(av("atendimento.atualizado", "a2"), "a1")).toBe(false);
  expect(avisoRecarregaPainel(av("mensagem.nova", "a1"), "a1")).toBe(false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/server/inbox/eventos-sse.test.ts src/app/\(app\)/inbox/useEventosInbox.test.ts src/components/conversa/historico-conversa.test.ts src/app/\(app\)/inbox/InboxNovo.test.ts && node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/barramento.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar a migration `20261023210000_inbox_aria_tempo_real/migration.sql`**

```sql
-- E3 (Inbox): sugestão, decisão e expiração da Aria e o estado global avisam o inbox (só ids, como notificar_inbox).
CREATE FUNCTION notificar_inbox_acao_ia() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_conversa text;
BEGIN
  IF NEW."atendimentoId" IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND NEW."status" IS NOT DISTINCT FROM OLD."status" THEN RETURN NULL; END IF;
  SELECT "conversaId" INTO v_conversa FROM "AtendimentoWhatsApp" WHERE "id" = NEW."atendimentoId";
  PERFORM pg_notify('inbox_eventos', json_build_object('tipo', 'atendimento.atualizado', 'atendimentoId', NEW."atendimentoId", 'mensagemId', NULL, 'conversaId', v_conversa)::text);
  RETURN NULL;
END $$;
CREATE TRIGGER notificar_inbox_acao_ia AFTER INSERT OR UPDATE OF "status" ON "AcaoAgenteIA"
  FOR EACH ROW EXECUTE FUNCTION notificar_inbox_acao_ia();

CREATE FUNCTION notificar_inbox_agente_ia() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."estado" IS NOT DISTINCT FROM OLD."estado" AND NEW."pausadoEm" IS NOT DISTINCT FROM OLD."pausadoEm" THEN RETURN NULL; END IF;
  PERFORM pg_notify('inbox_eventos', json_build_object('tipo', 'aria.global', 'atendimentoId', NULL, 'mensagemId', NULL, 'conversaId', '')::text);
  RETURN NULL;
END $$;
CREATE TRIGGER notificar_inbox_agente_ia AFTER UPDATE ON "AgenteIA"
  FOR EACH ROW EXECUTE FUNCTION notificar_inbox_agente_ia();
```

O Postgres junta NOTIFYs idênticos da mesma transação. Um turno que grava várias ações no mesmo atendimento gera um aviso só.

- [ ] **Step 4: Implementar o resto**

- `eventos-sse.ts:47`: `if (a.tipo === "resync" || a.tipo === "aria.global") return true;`.
- `useEventosInbox.ts:5`: acrescentar `"aria.global"` a `TIPOS`.
- `historico-conversa.ts:173`: `if (aviso.tipo === "aria.global") return Promise.resolve();`.
- `InboxNovo.tsx:154`: trocar a condição por `avisoRecarregaPainel(a, selecionadoRef.current)`. A recarga da lista continua para todo aviso e agora pede `contagens=1` (Task 5).

- [ ] **Step 5: Rodar e ver passar**

Run: os comandos do Step 2.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/migrations/20261023210000_inbox_aria_tempo_real src/server/inbox src/app/\(app\)/inbox/useEventosInbox.ts src/app/\(app\)/inbox/useEventosInbox.test.ts src/app/\(app\)/inbox/InboxNovo.tsx src/app/\(app\)/inbox/InboxNovo.test.ts src/components/conversa/historico-conversa.ts src/components/conversa/historico-conversa.test.ts
git commit -m "feat(inbox): avisos de tempo real para sugestões e estado global da Aria

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

<a id="task-5"></a>
### Task 5: Badge, selo e prévia no item; chips da Aria com contagem

**Files:**
- Create: `src/app/(app)/inbox/chips-inbox.ts`
- Modify: `src/app/(app)/inbox/estado-visual.ts` (E1)
- Modify: `src/app/(app)/inbox/ItemConversa.tsx` (E1): o `selo` do `Avatar` vem de `seloIA`
- Modify: `src/app/(app)/inbox/ChipsFiltro.tsx` (E1): `href` opcional
- Modify: `src/app/(app)/inbox/ColunaConversas.tsx` (E1): prop `resumo`; chips de `chipsDoInbox`
- Modify: `src/app/(app)/inbox/InboxNovo.tsx`: estado `resumo` (inicial de `resumoInicial`); `buscarPagina(filtros, null)` com `contagens=1` atualiza itens e resumo
- Modify: `src/app/(app)/inbox/page.tsx`: `resumoDaListaInbox(usuario, filtros)` no `Promise.all` (`page.tsx:42-52`) e `resumoInicial`
- Modify: `scripts/visual/demo-inbox.ts` (E1): cenários `aria-ia`, `aria-aprovacao`, `aria-handoff`, `aria-humano-voce` e `aria-humano-outro`
- Test: `src/app/(app)/inbox/estado-visual.test.ts`, `src/app/(app)/inbox/chips-inbox.test.ts` e `src/app/(app)/inbox/ItemConversa.test.ts`

**Interfaces:**
- Consumes: Tasks 2 e 3; `TomEstado`, `ChipFiltroInbox` e `estadoVisualItem` (E1); `paramsDosFiltros` (`InboxNovo.tsx:43`).
- Produces:
  - `estadoVisualItem(item, agora)` devolve também `seloIA: boolean` (`estadoAria` em `ia`, `aprovacao` ou `handoff`, como `isAI` no protótipo L993);
  - `export const ID_CHIPS = ["todas", "ia", "aprovacao", "handoff", "humano", "sem-resposta", "fila"] as const; export type IdChip = (typeof ID_CHIPS)[number];`
  - `export function filtrosDoChip(id: IdChip, f: FiltrosInbox): FiltrosInbox`: limpa `aria`, `prazoEstourado` e `responsavel === "fila"` e aplica só o do chip; `"todas"` só limpa;
  - `export function chipAtivo(f: FiltrosInbox): IdChip`: `aria`, senão `sem-resposta` se `prazoEstourado`, senão `fila` se `responsavel === "fila"`, senão `todas`;
  - `export function chipsDoInbox(c: ContagemChipsInbox, f: FiltrosInbox): ChipFiltroInbox[]`: na ordem do protótipo (L984), com `href = "/inbox?" + paramsDosFiltros(filtrosDoChip(id, f))`.

Textos e tons (protótipo L752 e L984; `TomEstado` da E1):

| Estado/chip | Badge no item | Chip | Tom |
|---|---|---|---|
| `ia` | "IA atendendo" | "IA atendendo" | `ia` |
| `aprovacao` | "Aguardando aprovação" | "Aprovação" | `aprovacao` |
| `handoff` | "Handoff pendente" | "Handoff" | `handoff` |
| `humano` | "Com você" (`atendidoPorVoce`); "Com <primeiro nome>" (`responsavelNome`); senão "Humano" | "Humanos" | `humano` |
| — | — | "Todas" / "Sem resposta" / "Não atribuídas" | `neutro` / `sem-resposta` / `neutro` |

Prefixo da prévia: `aria` → "Aria: ", `voce` → "Você: ", `pessoa` → "<rótulo>: ", `sugestao` → a prévia inteira vira "Aria sugere: <rótulo>".

- [ ] **Step 1: Escrever os testes que falham**

```ts
// estado-visual.test.ts (o literal `base` é o fixture de ItemListaInbox da E1)
const agora = new Date("2026-10-23T12:00:00Z");
it("badge_de_estado_da_aria_vem_primeiro_e_e_unico", () => {
  for (const [estadoAria, tom, texto] of [["ia", "ia", "IA atendendo"], ["aprovacao", "aprovacao", "Aguardando aprovação"], ["handoff", "handoff", "Handoff pendente"]] as const) {
    const v = estadoVisualItem({ ...base, estadoAria, responsavelId: "u2", responsavelNome: "Camila Souza" }, agora);
    expect(v.badges[0]).toEqual({ tom, texto });
    expect(v.badges.filter((b) => b.tom === "humano" || b.tom === "ia")).toHaveLength(tom === "ia" ? 1 : 0);
    expect(v.seloIA).toBe(true);
  }
});
it("humano_com_voce_com_nome_ou_humano", () => {
  expect(estadoVisualItem({ ...base, estadoAria: "humano", atendidoPorVoce: true }, agora).badges[0]).toEqual({ tom: "humano", texto: "Com você" });
  expect(estadoVisualItem({ ...base, estadoAria: "humano", responsavelNome: "Camila Souza" }, agora).badges[0]).toEqual({ tom: "humano", texto: "Com Camila" });
  expect(estadoVisualItem({ ...base, estadoAria: "humano", responsavelNome: null }, agora).badges[0]).toEqual({ tom: "humano", texto: "Humano" });
  expect(estadoVisualItem({ ...base, estadoAria: "humano" }, agora).seloIA).toBe(false);
});
it("sem_estado_nao_ganha_badge_da_aria_nem_selo", () => {
  const v = estadoVisualItem({ ...base, estadoAria: null }, agora);
  expect(v.badges.some((b) => b.tom === "ia" || b.tom === "aprovacao" || b.tom === "handoff")).toBe(false);
  expect(v.seloIA).toBe(false);
  // Os casos da E1 neste arquivo (estadoAria: null) continuam passando sem mudança de valor esperado.
});
it("sobreposicoes_continuam: sem resposta e na fila junto com o estado", () => {
  const v = estadoVisualItem({ ...base, estadoAria: "ia", responsavelId: null, status: "ABERTO_SEM_RESPONSAVEL", prazoRespostaEm: "2026-10-23T11:30:00Z" }, agora);
  expect(v.badges.map((b) => b.tom)).toEqual(expect.arrayContaining(["ia", "sem-resposta"]));
  expect(v.badges.some((b) => b.texto === "Na fila")).toBe(true);
});
it("prefixo_da_previa", () => {
  expect(estadoVisualItem({ ...base, preview: "Oi", previaAutor: "aria" }, agora).previa).toBe("Aria: Oi");
  expect(estadoVisualItem({ ...base, preview: "Oi", previaAutor: "voce" }, agora).previa).toBe("Você: Oi");
  expect(estadoVisualItem({ ...base, preview: "Oi", previaAutor: "pessoa", previaRotulo: "Camila" }, agora).previa).toBe("Camila: Oi");
  expect(estadoVisualItem({ ...base, preview: "Oi", previaAutor: "sugestao", previaRotulo: "Responder" }, agora).previa).toBe("Aria sugere: Responder");
  expect(estadoVisualItem({ ...base, preview: "Oi", previaAutor: null }, agora).previa).toBe("Oi");
});

// chips-inbox.test.ts
const c: ContagemChipsInbox = { todas: 9, ia: 3, aprovacao: 2, handoff: 1, humano: 2, semResposta: 4, naoAtribuidas: 5 };
it("ordem_rotulos_tons_e_totais", () => {
  expect(chipsDoInbox(c, {}).map((x) => [x.id, x.rotulo, x.tom, x.total])).toEqual([
    ["todas", "Todas", "neutro", 9], ["ia", "IA atendendo", "ia", 3], ["aprovacao", "Aprovação", "aprovacao", 2],
    ["handoff", "Handoff", "handoff", 1], ["humano", "Humanos", "humano", 2], ["sem-resposta", "Sem resposta", "sem-resposta", 4], ["fila", "Não atribuídas", "neutro", 5],
  ]);
});
it("chips_sao_exclusivos_e_preservam_os_outros_filtros", () => {
  const f: FiltrosInbox = { setor: "COMERCIAL", aria: "ia", prazoEstourado: true, responsavel: "fila" };
  expect(filtrosDoChip("handoff", f)).toEqual({ setor: "COMERCIAL", aria: "handoff" });
  expect(filtrosDoChip("fila", f)).toEqual({ setor: "COMERCIAL", responsavel: "fila" });
  expect(filtrosDoChip("todas", { ...f, responsavel: "u9" })).toEqual({ setor: "COMERCIAL", responsavel: "u9" });
  expect(chipsDoInbox(c, { setor: "COMERCIAL" }).find((x) => x.id === "handoff")?.href).toBe("/inbox?setor=COMERCIAL&aria=handoff");
});
it("chip_ativo", () => {
  expect(chipAtivo({})).toBe("todas"); expect(chipAtivo({ aria: "humano" })).toBe("humano");
  expect(chipAtivo({ prazoEstourado: true })).toBe("sem-resposta"); expect(chipAtivo({ responsavel: "fila" })).toBe("fila");
});

// ItemConversa.test.ts
it("selo_ia_no_avatar_quando_a_aria_conduz", () => {
  expect(html({ estadoAria: "aprovacao" })).toContain('data-selo="ia"');
  expect(html({ estadoAria: "humano" })).not.toContain('data-selo="ia"');
});
```

O atributo `data-selo` é o que o `Avatar` da E1 renderiza para `selo="ia"`. Se a E1 usou outro marcador, use o dela.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/app/\(app\)/inbox/estado-visual.test.ts src/app/\(app\)/inbox/chips-inbox.test.ts src/app/\(app\)/inbox/ItemConversa.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`estadoVisualItem`: com `estadoAria`, o badge de estado entra em `badges[0]` e nenhum outro badge de tom `ia` ou `humano` sai da E1. O de "Em atendimento/Com X" da E1, se existir, é suprimido. Sem `estadoAria`, o resultado é o da E1. O resto vai na tabela acima.

Ligações: `ColunaConversas` passa `chipsDoInbox(resumo.contagens, filtros)` e `chipAtivo(filtros)` ao `ChipsFiltro`. `ChipsFiltro` usa `router.push(chip.href)` quando há `href`. `InboxNovo` guarda `resumo` e o substitui a cada recarga da primeira página.

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2, mais `node_modules/.bin/vitest run src/app/paleta.test.ts src/app/botoes.test.ts src/app/sem-polling.test.ts` e `node_modules/.bin/tsc --noEmit`.
Expected: PASS; tsc com saída 0.

- [ ] **Step 5: Aceite visual**

Cenários `aria-ia`, `aria-aprovacao`, `aria-handoff`, `aria-humano-voce` e `aria-humano-outro` da lista, mais os chips com "Handoff" ativo. Capturas em 1440×900, 1024×768 e 390×844, claro e escuro, comparadas com o protótipo (lista em `telas/`; o chip ativo renderizado do HTML com `filter='handoff'`). Pontos a conferir: o selo de 19 px com borda `--surface`, o badge com ponto e a ordem e a contagem mono dos chips.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/inbox scripts/visual/demo-inbox.ts
git commit -m "feat(inbox): estado da Aria no item, selo IA e chips com contagem

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

<a id="task-6"></a>
### Task 6: Faixa "Aria ativa" (padrão de D4: sem interruptor)

**Files:**
- Create: `src/app/(app)/inbox/aria/FaixaAriaAtiva.tsx`
- Modify: `src/app/(app)/inbox/InboxNovo.tsx`: `faixaAria={<FaixaAriaAtiva situacao={resumo.aria} contagens={resumo.contagens} />}` em `ColunaConversas`
- Test: `src/app/(app)/inbox/aria/FaixaAriaAtiva.test.ts`

**Interfaces:**
- Consumes: Task 3 (`SituacaoAriaInbox`, `ContagemChipsInbox`).
- Produces: `export function FaixaAriaAtiva(props: { situacao: SituacaoAriaInbox; contagens: Pick<ContagemChipsInbox, "ia" | "aprovacao" | "handoff"> }): JSX.Element | null`.

Textos (protótipo L117–L118 e L1033):

| Situação | Título | Linha 2 |
|---|---|---|
| `ATIVA`, sem pausa | "Aria ativa" | "`{ia}` em atendimento · `{aprovacao + handoff}` aguardando você" |
| `ATIVA`, com pausa | "Aria pausada" | "Pausada · novas conversas vão para a equipe" |
| `SHADOW` | "Aria em ensaio" | "Simula respostas sem falar com os contatos" |
| `DESLIGADA` | (não renderiza) | — |

Com `podeGerenciar`, um link "Gerenciar" leva a `/aria` (fantasma, `text-ai-text`). Não há interruptor nem `role="switch"`: isso fica para a Task 18 (D4). Os números usam `--font-mono` com `tabular-nums`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
const montar = (s: Partial<SituacaoAriaInbox>, c = { ia: 3, aprovacao: 1, handoff: 1 }) =>
  renderToStaticMarkup(createElement(FaixaAriaAtiva, { situacao: { estado: "ATIVA", pausada: false, podeGerenciar: false, ...s }, contagens: c }));
it("ativa_com_contagens", () => { const h = texto(montar({})); expect(h).toContain("Aria ativa"); expect(h).toContain("3 em atendimento · 2 aguardando você"); });
it("pausada_e_shadow", () => {
  expect(texto(montar({ pausada: true }))).toContain("Pausada · novas conversas vão para a equipe");
  expect(texto(montar({ estado: "SHADOW" }))).toContain("Aria em ensaio");
});
it("desligada_nao_renderiza", () => expect(montar({ estado: "DESLIGADA" })).toBe(""));
it("sem_interruptor_no_padrao_d4", () => { expect(montar({ podeGerenciar: true })).not.toContain('role="switch"'); });
it("gerenciar_so_para_quem_pode_pausar", () => {
  expect(montar({ podeGerenciar: true })).toMatch(/<a[^>]*href="\/aria"[^>]*>Gerenciar<\/a>/);
  expect(montar({ podeGerenciar: false })).not.toContain('href="/aria"');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/app/\(app\)/inbox/aria/FaixaAriaAtiva.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `FaixaAriaAtiva`**

Bloco `bg-ai-bg`, raio 10 e margem `0 18px 12px`. Ícone `IconSparkles` em quadrado 28 px, raio 8, `bg-ai-solid` (ou o token sólido de IA que a E1 definir). Título 13/600 e linha 12 `text-secondary` (protótipo L114–L119).

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2, mais `node_modules/.bin/vitest run src/app/paleta.test.ts src/app/contraste.test.ts`.
Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estados "ativa" (cenário `aria-ia`), "pausada" e "shadow" (AgenteIA no seed do harness) nas três larguras e nos dois temas, comparados com o protótipo L114–L121 (com `aiOn` verdadeiro e falso).

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/inbox/aria/FaixaAriaAtiva.tsx src/app/\(app\)/inbox/aria/FaixaAriaAtiva.test.ts src/app/\(app\)/inbox/InboxNovo.tsx
git commit -m "feat(inbox): faixa Aria ativa na coluna de conversas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

<a id="task-7"></a>
### Task 7: Estado da Aria no cabeçalho e "Devolver para Aria"

**Files:**
- Create: `src/app/(app)/inbox/aria/textos-aria.ts` (recebe `textoPausaAria` de `PainelAria.tsx:12-14`)
- Create: `src/app/(app)/inbox/aria/BotaoDevolverAria.tsx`
- Modify: `src/app/(app)/inbox/CabecalhoConversa.tsx` (E1): props `linhaAria` e `acoesAria`
- Modify: `src/app/(app)/inbox/ConversaAberta.tsx`: recebe `aria?: AriaDoAtendimento | null` do `InboxNovo` (painel do aberto) e monta `linhaAria` e `BotaoDevolverAria`
- Test: `src/app/(app)/inbox/aria/textos-aria.test.ts`, `src/app/(app)/inbox/aria/BotaoDevolverAria.test.ts`

**Interfaces:**
- Consumes: `item.estadoAria`, `item.atendidoPorVoce` e `item.responsavelNome` (Task 2); `AriaDoAtendimento.pausada`, `.motivo`, `.podeDevolver` (`consultas-inbox.ts:258-264`) e `.podeDecidir` (Task 8: até lá, `false`); `devolverParaAria` (`src/server/aria/acoes.ts:70`, domínio em `pausa.ts:80-99`, que já é idempotente: sem pausa, não grava nada).
- Produces:
  - `export function linhaEstadoAria(estado: EstadoAria | null, o: { atendidoPorVoce: boolean; responsavelNome: string | null; podeDecidir: boolean; pausada: boolean; motivo: MotivoPausaAtendimentoIA | null }): { tom: TomEstado; texto: string; dica: string | null } | null`
  - `export function textoPausaAria(motivo: MotivoPausaAtendimentoIA | null): string` (o mesmo texto de hoje)
  - `export function haQuanto(iso: string, agora: Date): string`: "agora" (< 1 min), "há N min" (< 60), "há N h" (< 24 h), "há N dias"
  - `export function BotaoDevolverAria(props: { atendimentoId: string; dica: string | null; aoMudar(): void }): JSX.Element`

Textos de `linhaEstadoAria` (protótipo L998):
- `ia`: "Aria está atendendo";
- `aprovacao`: "Aria aguarda sua aprovação" (`podeDecidir`) ou "Aria aguarda aprovação";
- `handoff`: "Aria pediu um humano";
- `humano`: "Você está atendendo" / "<primeiro nome> está atendendo" / "Uma pessoa está atendendo";
- `null`: `null`.

`dica` = `textoPausaAria(motivo)` quando `pausada`; senão `null`. Ela vira o `title` da linha e do botão.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// textos-aria.test.ts
const o = { atendidoPorVoce: false, responsavelNome: null, podeDecidir: false, pausada: false, motivo: null };
it("linha_por_estado", () => {
  expect(linhaEstadoAria("ia", o)).toEqual({ tom: "ia", texto: "Aria está atendendo", dica: null });
  expect(linhaEstadoAria("aprovacao", { ...o, podeDecidir: true })?.texto).toBe("Aria aguarda sua aprovação");
  expect(linhaEstadoAria("aprovacao", o)?.texto).toBe("Aria aguarda aprovação");
  expect(linhaEstadoAria("handoff", { ...o, pausada: true, motivo: "HANDOFF" })).toEqual({ tom: "handoff", texto: "Aria pediu um humano", dica: "Aria pausada · Transferido para humano" });
  expect(linhaEstadoAria("humano", { ...o, atendidoPorVoce: true })?.texto).toBe("Você está atendendo");
  expect(linhaEstadoAria("humano", { ...o, responsavelNome: "Camila Souza" })?.texto).toBe("Camila está atendendo");
  expect(linhaEstadoAria("humano", o)?.texto).toBe("Uma pessoa está atendendo");
  expect(linhaEstadoAria(null, o)).toBeNull();
});
it("textoPausaAria_mantem_o_texto_atual", () => {
  expect(textoPausaAria("CELULAR")).toBe("Aria pausada · Resposta pelo celular");
  expect(textoPausaAria(null)).toBe("Aria pausada");
});
it("haQuanto", () => {
  const agora = new Date("2026-10-23T12:00:00Z");
  expect(haQuanto("2026-10-23T11:59:40Z", agora)).toBe("agora");
  expect(haQuanto("2026-10-23T11:56:00Z", agora)).toBe("há 4 min");
  expect(haQuanto("2026-10-23T09:00:00Z", agora)).toBe("há 3 h");
  expect(haQuanto("2026-10-21T12:00:00Z", agora)).toBe("há 2 dias");
});
// BotaoDevolverAria.test.ts
it("botao_com_rotulo_e_dica", () => {
  const h = renderToStaticMarkup(createElement(BotaoDevolverAria, { atendimentoId: "a1", dica: "Aria pausada · Resposta pelo celular", aoMudar: () => {} }));
  expect(h).toMatch(/<button[^>]*title="Aria pausada · Resposta pelo celular"[^>]*>[\s\S]*Devolver para Aria/);
});
```

Confira o texto exato de `MOTIVO_PAUSA_IA_LABEL.HANDOFF` em `src/lib/labels.ts:563-569` e use-o no teste.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/app/\(app\)/inbox/aria/textos-aria.test.ts src/app/\(app\)/inbox/aria/BotaoDevolverAria.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`BotaoDevolverAria` usa `useAcaoCliente({ idempotente: true })`, porque `devolverParaAria` não grava nada se a Aria já voltou. Fundo `--ai-bg` e texto `--ai-text` (protótipo L179). Abaixo de 1200 px o texto encurta para "Devolver", como `giveLabel` (L1030). No `ok`, chama `aoMudar()`. `ConversaAberta` só o monta com `aria?.podeDevolver`.

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2, mais `node_modules/.bin/vitest run src/app/\(app\)/inbox`.
Expected: PASS.

- [ ] **Step 5: Aceite visual**

Cabeçalho de 68 px nos cenários `aria-ia`, `aria-aprovacao` (gerente e vendedor), `aria-handoff` e `aria-humano-voce` (com "Devolver para Aria"), comparados com o protótipo L165–L180.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/inbox/aria src/app/\(app\)/inbox/CabecalhoConversa.tsx src/app/\(app\)/inbox/ConversaAberta.tsx src/app/\(app\)/inbox/InboxNovo.tsx
git commit -m "feat(inbox): estado da Aria e Devolver para Aria no cabeçalho

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

<a id="task-8"></a>
### Task 8: Dados do cartão de sugestão e decisão idempotente

**Files:**
- Create: `src/server/aria/sugestoes-thread.ts`
- Modify: `src/server/whatsapp/consultas-inbox.ts:257-299` (`AriaDoAtendimento`, `carregarAriaDoAtendimento`)
- Modify: `src/server/aria/historico.ts:44-71` (aprovar e rejeitar idempotentes por natureza)
- Test: `src/server/aria/sugestoes-thread.test.ts`, `src/server/whatsapp/consultas-inbox.aria.int.test.ts`, `src/server/aria/historico.int.test.ts`

**Interfaces:**
- Consumes:
  - `capacidadesAria` (`permissoes-tela.ts:27`) e `leadsDecidiveis` (`escopo-decisao.ts:24-33`): mesma regra de hoje (`consultas-inbox.ts:280-291`);
  - `aprovarAcaoAria` / `rejeitarAcaoAria` (`historico.ts:44`, `:59`; fronteira `src/server/aria/acoes.ts:57-63`). Por dentro, `efetivarRespostaSugerida` (`turno/executor.ts:173`) e `aplicarAcao` (`:351`);
  - `ultimoEventoDoAutor` (`src/server/_shared/idempotencia.ts:62-73`).
- Produces:
  - `export type DetalheSugestao = { tipo: "enviar"; documento: boolean } | { tipo: "agendar"; agendadaPara: string } | { tipo: "etapa"; para: EtapaLead } | { tipo: "tarefa"; titulo: string; venceEm: string } | { tipo: "tag"; nome: string } | { tipo: "campo"; nome: string; valor: string } | { tipo: "perdido"; motivo: string } | { tipo: "nota" } | { tipo: "condicao"; descontoPct: number; parcelas: number } | { tipo: "outro" };`
  - `export interface SugestaoAriaThread { id: string; turnoId: string; acao: AcaoAgenteIATipo; status: "SUGERIDA" | "APROVADA" | "REJEITADA" | "EXPIRADA"; criadoEm: string; expiraEm: string | null; justificativa: string | null; texto: string | null; detalhe: DetalheSugestao; decididaPorId: string | null; decididaPorNome: string | null; decididaEm: string | null }`
  - `export function detalheDaSugestao(acao: AcaoAgenteIATipo, payload: unknown): DetalheSugestao`. Os payloads vêm de `executor.ts:122-137` (`texto`, `documentoId`) e `:263-336` (`agendadaPara`; `titulo`, `venceEmISO`; `para`; `nome`; `nomeCampo`, `para`; `motivoPerda`; `descontoPct`, `parcelas`);
  - `export async function cartoesDaThread(db: Db, u: UsuarioSessao, a: { id: string; leadId: string | null }, agora: Date): Promise<SugestaoAriaThread[]>`: pendentes vigentes e decididas (APROVADA, REJEITADA, EXPIRADA) com `decididaEm >= agora - 24 h`, em ordem `criadoEm`, até 20, só as decidíveis por `u` (vazio sem `decidirHistorico`);
  - `AriaDoAtendimento` ganha `podeDecidir: boolean` (`decidirHistorico` e o lead do atendimento decidível) e `cartoes: SugestaoAriaThread[]`. `sugestoes` fica igual até a Task 12.

Mudança em `historico.ts` (#166, idempotente por natureza, no padrão do 5º lote em `docs/planejamento/quadro-entregas.md:4299`). Depois de `travarAcao` e `exigirEscopo`:
- em `aprovarAcaoAria`, se `acao.status === "APROVADA"`, `acao.decididaPorId === u.id` e `ultimoEventoDoAutor(tx, { tipo: "AcaoAriaAprovada", agregadoTipo: "AcaoAgenteIA", agregadoId: id, autorId: u.id })` não é nulo, a função devolve sem gravar nada;
- em `rejeitarAcaoAria`, o mesmo com `REJEITADA`/`AcaoAriaRejeitada`, desde que o `motivo` do Evento seja igual ao normalizado (`m`);
- decidida por outra pessoa, ou com outro status: segue "Esta sugestão já foi decidida." (`historico.ts:16`).

- [ ] **Step 1: Escrever os testes que falham**

```ts
// sugestoes-thread.test.ts
it("detalhe_por_acao", () => {
  expect(detalheDaSugestao("RESPONDER", { texto: "Oi", documentoId: null })).toEqual({ tipo: "enviar", documento: false });
  expect(detalheDaSugestao("ENVIAR_DOCUMENTO", { texto: "", documentoId: "d1" })).toEqual({ tipo: "enviar", documento: true });
  expect(detalheDaSugestao("AGENDAR_MENSAGEM", { texto: "Oi", agendadaPara: "2026-10-24T12:00:00.000Z" })).toEqual({ tipo: "agendar", agendadaPara: "2026-10-24T12:00:00.000Z" });
  expect(detalheDaSugestao("MOVER_ETAPA", { de: "NOVO", para: "QUALIFICADO" })).toEqual({ tipo: "etapa", para: "QUALIFICADO" });
  expect(detalheDaSugestao("CRIAR_TAREFA", { titulo: "Ligar", venceEmISO: "2026-10-24T12:00:00.000Z" })).toEqual({ tipo: "tarefa", titulo: "Ligar", venceEm: "2026-10-24T12:00:00.000Z" });
  expect(detalheDaSugestao("TAG", { nome: "Quente" })).toEqual({ tipo: "tag", nome: "Quente" });
  expect(detalheDaSugestao("ATUALIZAR_CAMPO", { nomeCampo: "objetivo", para: "viajar" })).toEqual({ tipo: "campo", nome: "objetivo", valor: "viajar" });
  expect(detalheDaSugestao("MOVER_ETAPA", null)).toEqual({ tipo: "outro" });
});
```

`consultas-inbox.aria.int.test.ts`. Os `toEqual` exatos de `:38`, `:55` e `:77` viram `toMatchObject`, e entram estes casos:

```ts
it("cartoes_pendentes_e_decididas_recentes_para_quem_decide", async () => {
  const c = await cenario();
  const viva = await c.sugerir({ expiraEm: new Date(Date.now() + 3_600_000), texto: "Posso ajudar?" });
  const velha = await c.sugerir({ status: "APROVADA", expiraEm: null });
  await prisma.acaoAgenteIA.update({ where: { id: velha.id }, data: { decididaEm: new Date(Date.now() - 25 * 3_600_000), decididaPorId: c.gerente.id } });
  const recente = await c.sugerir({ status: "APROVADA", expiraEm: null });
  await prisma.acaoAgenteIA.update({ where: { id: recente.id }, data: { decididaEm: new Date(), decididaPorId: c.gerente.id } });
  const r = await carregarAriaDoAtendimento(c.gerente, c.a.id);
  expect(r?.podeDecidir).toBe(true);
  expect(r?.cartoes.map((x) => [x.id, x.status])).toEqual([[viva.id, "SUGERIDA"], [recente.id, "APROVADA"]]);
  expect(r?.cartoes[0]).toMatchObject({ texto: "Posso ajudar?", detalhe: { tipo: "enviar", documento: false } });
  expect(r?.cartoes[1]).toMatchObject({ decididaPorId: c.gerente.id, decididaPorNome: expect.any(String) });
});
it("gerente_de_outra_equipe_ve_estado_sem_cartao", async () => {
  const c = await cenario(); await c.sugerir({ expiraEm: new Date(Date.now() + 3_600_000) });
  const outro = await criarUsuario([Papel.GERENTE_COMERCIAL], "Outra equipe");
  const r = await carregarAriaDoAtendimento(outro, c.a.id);
  expect(r).toMatchObject({ podeDecidir: false, cartoes: [] });
});
it("vendedor_dono_nao_recebe_cartoes_no_padrao_d1", async () => {
  const c = await cenario(); await c.sugerir({ expiraEm: new Date(Date.now() + 3_600_000) });
  expect(await carregarAriaDoAtendimento(c.vendedor, c.a.id)).toMatchObject({ podeDecidir: false, cartoes: [] });
});
it("expirar_avisa_e_cartao_vira_expirada", async () => {
  const c = await cenario(); const s = await c.sugerir({ expiraEm: new Date(Date.now() - 1000) });
  await expirarSugestoesAria(new Date());
  expect((await carregarAriaDoAtendimento(c.gerente, c.a.id))?.cartoes.find((x) => x.id === s.id)?.status).toBe("EXPIRADA");
});
```

`historico.int.test.ts`. O teste `aprovar_duas_vezes_falha` (`:68-72`) é substituído por:

```ts
it("aprovar_repetido_pelo_mesmo_decisor_e_ok_sem_novo_evento", async () => {
  const s = await sugTag();
  expect((await aprovarAcaoAria(s.id)).ok).toBe(true);
  expect((await aprovarAcaoAria(s.id)).ok).toBe(true);
  expect(await prisma.evento.count({ where: { tipo: "AcaoAriaAprovada", agregadoId: s.id } })).toBe(1);
  expect(await tags()).toHaveLength(1);
});
it("aprovar_ja_decidida_por_outro_falha", async () => {
  const s = await sugTag(); await aprovarAcaoAria(s.id);
  const admin = await criarUsuario([Papel.ADMINISTRADOR]); logado(admin);
  expect(await aprovarAcaoAria(s.id)).toEqual({ ok: false, erro: "Esta sugestão já foi decidida." });
});
it("aprovar_repetido_pelo_mesmo_decisor_nao_duplica_intencao", async () => {
  const s = await prisma.$transaction(async (tx) => (await executarResposta(tx, { turnoId: c.turno.id, ctx: await montarContextoTurno(c.at.id, tx), texto: "Olá", documentoId: null, destino: "SUGERIR", simulado: false, confianca: 70, fontes: [], nomeAria: "Aria" }) as { acao: { id: string } }).acao);
  await Promise.all([aprovarAcaoAria(s.id), aprovarAcaoAria(s.id)]);
  expect(await prisma.intencaoMensagem.count({ where: { acaoAgenteIAId: s.id } })).toBe(1);
});
it("rejeitar_repetido_com_mesmo_motivo_e_ok_e_com_outro_falha", async () => {
  const s = await sugTag();
  expect((await rejeitarAcaoAria(s.id, "não")).ok).toBe(true);
  expect((await rejeitarAcaoAria(s.id, "não")).ok).toBe(true);
  expect((await rejeitarAcaoAria(s.id, "outro")).ok).toBe(false);
  expect(await prisma.evento.count({ where: { tipo: "AcaoAriaRejeitada", agregadoId: s.id } })).toBe(1);
});
```

Confira os campos de `EntradaResposta` em `executor.ts:22-34` e complete o objeto se o tipo pedir mais algum.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/server/aria/sugestoes-thread.test.ts && node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/consultas-inbox.aria.int.test.ts src/server/aria/historico.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`carregarAriaDoAtendimento` passa a chamar `cartoesDaThread(prisma, usuario, a, agora)` e a calcular `podeDecidir`. `cartoesDaThread` reaproveita `leadDe` e `leadsDecidiveis` como em `consultas-inbox.ts:289-291`. Os nomes de quem decidiu saem de uma consulta `usuario.findMany` por ids, como em `consultas.ts:224-231`. Na mudança de `historico.ts`, a checagem de repetição vem antes de `if (acao.status !== "SUGERIDA")`.

- [ ] **Step 4: Rodar e ver passar**

Run: os comandos do Step 2, mais `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/aria`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/aria/sugestoes-thread.ts src/server/aria/sugestoes-thread.test.ts src/server/aria/historico.ts src/server/aria/historico.int.test.ts src/server/whatsapp/consultas-inbox.ts src/server/whatsapp/consultas-inbox.aria.int.test.ts
git commit -m "feat(aria): cartões de sugestão para a thread e decisão idempotente (#166)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

<a id="task-9"></a>
### Task 9: Cartão "Aria sugere" na thread (padrão D1/D2)

**Files:**
- Create: `src/app/(app)/inbox/aria/sugestao-visual.ts`
- Create: `src/app/(app)/inbox/aria/intercalar.ts`
- Create: `src/app/(app)/inbox/aria/CartaoSugestaoAria.tsx`
- Modify: a thread (`ConversaAberta.tsx`, ou o arquivo da thread da E1/E2): a lista passa por `intercalarSugestoes(itensFio, instanteDoItemFio, aria?.cartoes ?? [], { inicioJanela })` e renderiza o cartão para `tipo: "sugestao-aria"`. Sem a E2 mergeada, `itensFio` são as mensagens e `instante = (m) => m.criadoEm`. O slot `cartoesNoFio` da E4 (`05-fluxos.md`) não é usado pelo cartão, que fica na posição do tempo; a E4 já aceita o nome da E3.
- Test: `src/app/(app)/inbox/aria/sugestao-visual.test.ts`, `src/app/(app)/inbox/aria/intercalar.test.ts`, `src/app/(app)/inbox/aria/CartaoSugestaoAria.test.ts`

**Interfaces:**
- Consumes: Task 8 (`SugestaoAriaThread`); `aprovarAcaoAria(id)` e `rejeitarAcaoAria(id)` (`src/server/aria/acoes.ts:57-63`); `ETAPA_LABEL` (`src/lib/labels.ts:107`); `formatarInstanteExibicao` (`src/server/operacao/fuso-exibicao.ts:42`); `useAcaoCliente` (`src/lib/acao-cliente.ts`).
- Produces:
  - `export interface VisualSugestao { cabecalho: string; titulo: string; linhas: { icone: "enviar" | "agendar" | "etapa" | "tarefa" | "tag" | "campo" | "perdido" | "nota" | "condicao"; texto: string }[]; textoProposto: string | null; avisoEnvio: boolean; rotuloAprovar: string; rotuloRejeitar: string; pendente: boolean; decidido: { tom: "brand" | "neutro"; texto: string } | null; expira: string | null }`
  - `export function visualSugestao(s: SugestaoAriaThread, o: { usuarioId: string; fuso: string | null }): VisualSugestao`
  - `export type ItemSugestaoThread = { tipo: "sugestao-aria"; s: SugestaoAriaThread }`, que vira mais uma variante do `ItemFio` da E2 (`03-painel-crm.md`, Task do fio: `ItemFio = { tipo: "mensagem"; m } | { tipo: "nota"; n } | { tipo: "tarefa"; t } | { tipo: "agendada"; a }`);
  - `export function intercalarSugestoes<I>(itens: readonly I[], instante: (i: I) => string | null, sugestoes: readonly SugestaoAriaThread[], o: { inicioJanela: string | null }): (I | ItemSugestaoThread)[]`. Recebe a saída de `intercalarFio` (E2) e a função `instante`, que para o `ItemFio` devolve o `criadoEm` de `m`, `n` ou `t` e `null` para `agendada`. Os itens com instante nulo ficam no fim, depois das sugestões (as agendadas da E2 continuam por último). A ordem é estável por instante, com a sugestão depois do item de mesmo instante. Uma sugestão anterior a `inicioJanela` entra no topo se pendente e sai se decidida. Com `inicioJanela` nulo (sem mais mensagens antigas), tudo entra. O `getKey` da lista vira `sugestao-aria:${s.id}`, como `${tipo}:${id}` na E2.
  - `export function CartaoSugestaoAria(props: { s: SugestaoAriaThread; usuarioId: string; fuso: string | null; aoDecidir(): void }): JSX.Element`

Textos (protótipo L298–L326 e L1014–L1022; padrão D2: **sem "Editar" e sem "Editar tarefa"**):

| Campo | Regra |
|---|---|
| `cabecalho` | pendente: "Aria sugere · aguardando aprovação"; decidida: "Aria sugeriu" |
| `titulo` | `enviar`: "Responder ao contato" (documento: "Enviar documento ao contato"); `agendar`: "Agendar mensagem"; `etapa`: "Mover para <ETAPA_LABEL>"; `tarefa`: "Criar tarefa"; `tag`: "Aplicar a tag <nome>"; `campo`: "Preencher <nome>"; `perdido`: "Marcar como perdido"; `nota`: "Nota interna"; `condicao`: "Condição comercial"; `outro`: `ACAO_AGENTE_IA_LABEL[acao]` |
| `linhas` | `enviar`: "Enviar a mensagem acima"; `agendar`: "Agendar a mensagem acima · <data e hora no fuso>"; `etapa`: "Mover para <etapa>"; `tarefa`: "Criar tarefa: <título> · <data e hora>"; `tag`: "Adicionar a tag <nome>"; `campo`: "<nome>: <valor>"; `perdido`: "Motivo: <motivo>"; `condicao`: "<descontoPct>% de desconto em <parcelas>x" |
| `textoProposto` | `s.texto` para `enviar`, `agendar` e `nota`; senão `null` |
| `avisoEnvio` | pendente e `enviar` → "Isso será enviado agora no WhatsApp e não poderá ser desfeito." |
| `rotuloAprovar` | `enviar`: "Aprovar e enviar"; `agendar`: "Agendar"; senão "Aprovar" |
| `rotuloRejeitar` | `agendar`: "Ignorar"; senão "Rejeitar" |
| `decidido` | APROVADA: `brand`, "Aprovado por você · hh:mm" ou "Aprovado por <primeiro nome> · hh:mm"; REJEITADA: `neutro`, "Rejeitado · hh:mm"; EXPIRADA: `neutro`, "Expirou · hh:mm" |
| `expira` | pendente com `expiraEm`: "Expira às hh:mm" (função que o ERP tem e o protótipo não, análise parte 2 §10) |

Visual (análise parte 1 §3.5): alinhado à direita, `width: min(520px, 80%)`, raio 14, `bg-surface`. A borda é `border-warning` quando pendente e `border-border` quando decidida. A faixa do topo é `bg-ai-bg text-ai-text` com `IconSparkles` e a hora em mono. O texto proposto vai numa caixa `bg-ai-entry` (balão da IA da E1) com raio 10. Os botões são "Aprovar e enviar" `primario` (flex-1, altura 36) e "Rejeitar" em contorno com texto de perigo (a variante de contorno de perigo da E1, `perigoContorno` na análise parte 1 §5; se ela não existir, crie-a em `src/components/Botao.tsx` e em `botoes-mapa.ts` nesta task).

- [ ] **Step 1: Escrever os testes que falham**

```ts
// sugestao-visual.test.ts
const s = (o: Partial<SugestaoAriaThread> = {}): SugestaoAriaThread => ({ id: "s1", turnoId: "t1", acao: "RESPONDER", status: "SUGERIDA", criadoEm: "2026-10-23T13:42:00.000Z", expiraEm: "2026-10-23T14:42:00.000Z", justificativa: "A aluna pediu o valor.", texto: "Olá! O semestral sai por R$ 720.", detalhe: { tipo: "enviar", documento: false }, decididaPorId: null, decididaPorNome: null, decididaEm: null, ...o });
const v = (x: SugestaoAriaThread) => visualSugestao(x, { usuarioId: "u1", fuso: "America/Sao_Paulo" });
it("pendente_de_resposta", () => {
  expect(v(s())).toMatchObject({ cabecalho: "Aria sugere · aguardando aprovação", titulo: "Responder ao contato", textoProposto: "Olá! O semestral sai por R$ 720.", avisoEnvio: true, rotuloAprovar: "Aprovar e enviar", rotuloRejeitar: "Rejeitar", pendente: true, decidido: null, expira: "Expira às 11:42" });
  expect(v(s()).linhas).toEqual([{ icone: "enviar", texto: "Enviar a mensagem acima" }]);
});
it("agendar_tarefa_e_etapa", () => {
  expect(v(s({ acao: "AGENDAR_MENSAGEM", detalhe: { tipo: "agendar", agendadaPara: "2026-10-24T12:00:00.000Z" } }))).toMatchObject({ rotuloAprovar: "Agendar", rotuloRejeitar: "Ignorar", avisoEnvio: false });
  expect(v(s({ acao: "CRIAR_TAREFA", texto: null, detalhe: { tipo: "tarefa", titulo: "Ligar", venceEm: "2026-10-24T12:00:00.000Z" } })).linhas[0].texto).toBe("Criar tarefa: Ligar · 24/10/2026 09:00");
  expect(v(s({ acao: "MOVER_ETAPA", texto: null, detalhe: { tipo: "etapa", para: "QUALIFICADO" } })).titulo).toBe(`Mover para ${ETAPA_LABEL.QUALIFICADO}`);
});
it("decididas", () => {
  expect(v(s({ status: "APROVADA", decididaPorId: "u1", decididaEm: "2026-10-23T13:50:00.000Z" })).decidido).toEqual({ tom: "brand", texto: "Aprovado por você · 10:50" });
  expect(v(s({ status: "APROVADA", decididaPorId: "u2", decididaPorNome: "Camila Souza", decididaEm: "2026-10-23T13:50:00.000Z" })).decidido?.texto).toBe("Aprovado por Camila · 10:50");
  expect(v(s({ status: "REJEITADA", decididaEm: "2026-10-23T13:50:00.000Z" })).decidido).toEqual({ tom: "neutro", texto: "Rejeitado · 10:50" });
  expect(v(s({ status: "EXPIRADA", decididaEm: "2026-10-23T13:50:00.000Z" })).decidido?.texto).toBe("Expirou · 10:50");
  expect(v(s({ status: "REJEITADA" })).cabecalho).toBe("Aria sugeriu");
});
```

Use no teste o formato de data e hora que `formatarInstanteExibicao` devolve com estilo `"dataHora"` e ajuste o literal "24/10/2026 09:00" se ele for outro.

```ts
// intercalar.test.ts
type I = { id: string; em: string | null };
const m = (id: string, em: string | null): I => ({ id, em });
const ids = (r: (I | ItemSugestaoThread)[]) => r.map((x) => ("s" in x ? x.s.id : x.id));
it("ordena_por_instante_e_coloca_a_sugestao_depois_do_empate", () => {
  const r = intercalarSugestoes([m("m1", "2026-10-23T10:00:00Z"), m("m2", "2026-10-23T10:05:00Z")], (x) => x.em, [s({ id: "s1", criadoEm: "2026-10-23T10:05:00Z" })], { inicioJanela: null });
  expect(ids(r)).toEqual(["m1", "m2", "s1"]);
});
it("itens_sem_instante_ficam_no_fim_depois_das_sugestoes", () => {
  const r = intercalarSugestoes([m("m1", "2026-10-23T10:00:00Z"), m("agendada", null)], (x) => x.em, [s({ id: "s1", criadoEm: "2026-10-23T10:05:00Z" })], { inicioJanela: null });
  expect(ids(r)).toEqual(["m1", "s1", "agendada"]);
});
it("fora_da_janela_pendente_vai_ao_topo_e_decidida_sai", () => {
  const r = intercalarSugestoes([m("m1", "2026-10-23T10:00:00Z")], (x) => x.em, [s({ id: "p", criadoEm: "2026-10-22T10:00:00Z" }), s({ id: "d", status: "APROVADA", criadoEm: "2026-10-22T10:00:00Z" })], { inicioJanela: "2026-10-23T10:00:00Z" });
  expect(ids(r)).toEqual(["p", "m1"]);
});
```

```ts
// CartaoSugestaoAria.test.ts (render estático + interação com executor, no estilo de PainelAtendimento.aria.test.ts)
vi.mock("@/server/aria/acoes", () => ({ aprovarAcaoAria: vi.fn(), rejeitarAcaoAria: vi.fn() }));
it("pendente_tem_aprovar_rejeitar_e_nao_tem_editar", () => {
  const h = montar(s());
  expect(botao(h, "Aprovar e enviar")).toBe(true); expect(botao(h, "Rejeitar")).toBe(true);
  expect(h).not.toMatch(/>Editar</); expect(h).not.toContain("Editar tarefa");
  expect(texto(h)).toContain("Isso será enviado agora no WhatsApp e não poderá ser desfeito.");
});
it("decidida_nao_tem_botoes", () => {
  const h = montar(s({ status: "REJEITADA", decididaEm: "2026-10-23T13:50:00.000Z" }));
  expect(h).not.toContain("<button"); expect(texto(h)).toContain("Rejeitado · 10:50");
});
it("aprovar_chama_a_acao_e_aoDecidir", async () => { /* clique → aprovarAcaoAria("s1"); com { ok: true }, aoDecidir chamado uma vez */ });
it("aprovar_sugestao_expirada_mostra_erro", async () => { /* aprovarAcaoAria → { ok: false, erro: "Esta sugestão expirou." }: a mensagem aparece no FeedbackAcao e aoDecidir não é chamado */ });
```

Para a interação, siga o padrão dos testes `*.interacao.test.ts` do Inbox (ex.: `InboxNovo.interacao.test.ts`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/app/\(app\)/inbox/aria`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`CartaoSugestaoAria` usa `useAcaoCliente({ idempotente: true })`: depois da Task 8, aprovar e rejeitar são idempotentes por natureza. No `ok`, chama `aoDecidir()`, que na `ConversaAberta` é o `aoMudar` (recarrega o painel e, com ele, os cartões). `ConversaAberta` define `inicioJanela = conversa.temMaisAntes ? conversa.mensagens[0]?.criadoEm ?? null : null`.

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2, mais `node_modules/.bin/vitest run src/app/paleta.test.ts src/app/botoes.test.ts src/app/contraste.test.ts` e `node_modules/.bin/tsc --noEmit`.
Expected: PASS.

- [ ] **Step 5: Aceite visual**

Cenário `aria-aprovacao` (gerente) com o cartão pendente de RESPONDER, o de CRIAR_TAREFA e um aprovado, nas três larguras e nos dois temas, comparado com o protótipo L298–L326 (conversa c1 "Mariana Costa"). As diferenças aceitas, justificadas: sem "Editar" (D2), com "Expira às" (ERP) e sem sombra se a trava não tiver mudado.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/inbox/aria src/app/\(app\)/inbox/ConversaAberta.tsx src/components/Botao.tsx
git commit -m "feat(inbox): cartão Aria sugere na thread (aprovar e rejeitar)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

<a id="task-10"></a>
### Task 10: Resumo do handoff no servidor

**Files:**
- Modify: `src/server/aria/turno/handoff.ts:38-45` (acrescentar `lerNotaResumo` ao lado de `montarNotaResumo`)
- Create: `src/server/aria/handoff-inbox.ts`
- Modify: `src/server/whatsapp/consultas-inbox.ts` (`AriaDoAtendimento.handoff`)
- Modify: `src/lib/labels.ts` (`MOTIVO_HANDOFF_LABEL`) e `src/app/(app)/aria/_componentes/Playground.tsx:19-33` (passa a importar)
- Modify: `src/app/enums-rotulos.test.ts:2111` (entrar o mapa novo na lista)
- Test: `src/server/aria/turno/handoff.test.ts` (novo ou existente), `src/server/aria/handoff-inbox.int.test.ts`

**Interfaces:**
- Consumes:
  - `montarNotaResumo` e `ResumoHandoff` (`handoff.ts:13-17`, `:30-45`). A nota fica em `Evento` `NotaInterna` com `payload.nota` (`handoff.ts:135-143`), e o payload da ação `HANDOFF` tem `motivo`, `destino`, `responsavelId` e `nota` (`handoff.ts:121`);
  - `idsHandoffPendente` (Task 1); `podeVerLeadNaThread` (`consultas-inbox.ts:181`); `podeExecutar(u, "assumir", ctx)` (`src/server/inbox/permissoes.ts:43-56`); `MOTIVOS_HANDOFF` e `MotivoHandoff` (`turno/tipos.ts:3-20`).
- Produces:
  - `export function lerNotaResumo(nota: string): Partial<ResumoHandoff>`: o inverso de `montarNotaResumo`, pelos rótulos de `ROTULOS_RESUMO`;
  - `export const MOTIVO_HANDOFF_LABEL: Readonly<Record<MotivoHandoff, string>>`: os textos de `Playground.tsx:19-33`, mais `TURNO_INTERROMPIDO: "Turno interrompido"`;
  - `export function descreverAcaoExecutada(acao: AcaoAgenteIATipo, payload: unknown): string` em `handoff-inbox.ts`: RESPONDER → "Respondeu ao contato"; ENVIAR_DOCUMENTO → "Enviou um documento"; ATUALIZAR_CAMPO → "Preencheu <nomeCampo>: <para>"; TAG → "Adicionou a tag <nome>"; MOVER_ETAPA → "Moveu para <ETAPA_LABEL>"; MARCAR_PERDIDO → "Marcou como perdido"; CRIAR_TAREFA → "Criou tarefa: <titulo>"; AGENDAR_MENSAGEM → "Agendou mensagem"; NOTA_INTERNA → "Escreveu uma nota interna"; CONDICAO_COMERCIAL → "Ofereceu condição comercial"; CLASSIFICAR_SETOR → "Classificou o setor"; HANDOFF → "Pediu um humano";
  - `export interface HandoffDoAtendimento { acaoId: string; pedidoEm: string; motivo: MotivoHandoff | null; motivoTexto: string; destino: "RESPONSAVEL" | "USUARIO" | "FILA_SETOR"; responsavelNome: string | null; resumo: { quer: string | null; proximoPasso: string | null } | null; feito: { texto: string; quando: string }[]; podeAssumir: boolean; ehResponsavel: boolean }`
  - `export async function handoffDoAtendimento(db: Db, u: UsuarioSessao, a: { id; finalidade; leadId; responsavelId; conversa: { numero: { donoId; finalidade } } }, agora: Date): Promise<HandoffDoAtendimento | null>`: `null` quando o atendimento não está em `idsHandoffPendente`;
  - `AriaDoAtendimento.handoff: HandoffDoAtendimento | null`.

Regras:
- a fonte é a última `AcaoAgenteIA` `HANDOFF` `EXECUTADA` do atendimento;
- `motivoTexto` = `MOTIVO_HANDOFF_LABEL[motivo]`, ou "Motivo não informado" quando o motivo for desconhecido;
- `resumo`: `lerNotaResumo(payload.nota)`, com `quer` vindo do `resumo` e `proximoPasso` do `proximoPasso`. Ele só sai para quem vê as notas do atendimento: a regra que a E0 definir e, até lá, a de `consultas-pagina.ts:181-182` (`podeVerLeadNaThread` quando há lead). Sem acesso, `resumo: null`;
- `feito`: ações `EXECUTADA`/`APROVADA` do atendimento com `criadoEm <= pedidoEm`, exceto `HANDOFF`, as 10 mais recentes em ordem cronológica;
- `podeAssumir` = `responsavelId === null && podeExecutar(u, "assumir", { setor: a.finalidade, responsavelId: null, linhaComercial, donoLinhaId })`;
- `ehResponsavel` = `responsavelId === u.id`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// handoff.test.ts
it("lerNotaResumo_inverte_montarNotaResumo", () => {
  const r = { motivo: "Desconto acima de 10%", resumo: "Quer 15% para 12 matrículas", proximoPasso: "Ligar hoje" };
  expect(lerNotaResumo(montarNotaResumo(r, ["motivo", "resumo", "proximoPasso"])!)).toEqual(r);
  expect(lerNotaResumo(montarNotaResumo(r, ["resumo"])!)).toEqual({ resumo: "Quer 15% para 12 matrículas" });
  expect(lerNotaResumo("texto livre")).toEqual({});
});
```

`handoff-inbox.int.test.ts`. O cenário publica a Aria `ATIVA` e roda `executarHandoff` (`handoff.ts:54`) com `config = configPadrao()` e `handoff.camposResumo = ["motivo", "resumo", "proximoPasso"]`. Antes disso, uma ação TAG `EXECUTADA` e uma MOVER_ETAPA `EXECUTADA`.

```ts
it("handoff_pendente_traz_motivo_resumo_e_o_que_a_aria_fez", async () => {
  const r = await handoffDoAtendimento(prisma, gerente, at, new Date());
  expect(r).toMatchObject({ motivo: "VALOR", motivoTexto: "Valor alto", destino: "RESPONSAVEL", responsavelNome: "Vendedor", resumo: { quer: "Quer 15% para 12 matrículas", proximoPasso: "Ligar hoje" } });
  expect(r?.feito.map((f) => f.texto)).toEqual(["Adicionou a tag Quente", `Moveu para ${ETAPA_LABEL.QUALIFICADO}`]);
});
it("depois_da_resposta_humana_nao_ha_handoff", async () => { await saida(at, "HUMANO"); expect(await handoffDoAtendimento(prisma, gerente, at, new Date())).toBeNull(); });
it("pode_assumir_so_da_fila_e_dono_e_responsavel", async () => {
  expect((await handoffDoAtendimento(prisma, vendedorDono, at, new Date()))).toMatchObject({ podeAssumir: false, ehResponsavel: true });
  // destino FILA_SETOR (vendedorDonoId nulo): outro vendedor do setor pode assumir
  expect((await handoffDoAtendimento(prisma, outroVendedor, atFila, new Date()))).toMatchObject({ podeAssumir: true, ehResponsavel: false });
});
it("quem_nao_ve_as_notas_recebe_resumo_nulo", async () => { /* participante convidado sem acesso ao lead: resumo null, feito e motivo presentes */ });
it("carregarAriaDoAtendimento_inclui_o_handoff", async () => { expect((await carregarAriaDoAtendimento(gerente, at.id))?.handoff?.acaoId).toBeDefined(); });
```

Entre também na lista de `enums-rotulos.test.ts` a linha `["MOTIVO_HANDOFF_LABEL", L.MOTIVO_HANDOFF_LABEL, [...MOTIVOS_HANDOFF, "TURNO_INTERROMPIDO"]]`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/server/aria/turno/handoff.test.ts src/app/enums-rotulos.test.ts && node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/aria/handoff-inbox.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Siga as regras acima. `Playground.tsx` troca o mapa local por `MOTIVO_HANDOFF_LABEL`.

- [ ] **Step 4: Rodar e ver passar**

Run: os comandos do Step 2, mais `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/aria/turno/handoff.int.test.ts src/server/whatsapp/consultas-inbox.aria.int.test.ts`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/aria src/server/whatsapp/consultas-inbox.ts src/lib/labels.ts src/app/enums-rotulos.test.ts src/app/\(app\)/aria/_componentes/Playground.tsx
git commit -m "feat(aria): resumo do handoff para o Inbox

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

<a id="task-11"></a>
### Task 11: Faixa e modal de handoff na conversa (padrão D3)

**Files:**
- Create: `src/app/(app)/inbox/aria/FaixaHandoff.tsx`
- Create: `src/app/(app)/inbox/aria/ModalResumoHandoff.tsx`
- Modify: `src/app/(app)/inbox/ConversaAberta.tsx`: a faixa entre o cabeçalho e a thread e o modal controlado
- Modify: o compositor (E1, `RodapeConversa`/`Compositor`): `data-compositor-campo` no `<textarea>`
- Test: `src/app/(app)/inbox/aria/FaixaHandoff.test.ts`, `src/app/(app)/inbox/aria/ModalResumoHandoff.test.ts`

**Interfaces:**
- Consumes: Task 10 (`HandoffDoAtendimento`); `haQuanto` (Task 7); `assumirAtendimento(atendimentoId)` (`src/server/whatsapp/acoes-atendimento.ts:89-115`, já idempotente por natureza: o reenvio de quem assumiu devolve ok); `Modal` (`src/components/Modal.tsx:22`); o `agora` vivo da E0.
- Produces:
  - `export function FaixaHandoff(props: { handoff: HandoffDoAtendimento; agora: Date; aoVerResumo(): void }): JSX.Element`
  - `export function ModalResumoHandoff(props: { atendimentoId: string; contatoNome: string; handoff: HandoffDoAtendimento; fuso: string | null; aoFechar(): void; aoAssumido(): void; aoResponder(): void }): JSX.Element`

Textos (protótipo L253–L262, L435–L468 e L1112):
- Faixa: "Aria pediu ajuda `haQuanto(pedidoEm)`" (13.5/600), `motivoTexto` (12.5 `text-secondary`) e o botão `podeAssumir ? "Ver resumo e assumir" : "Ver resumo"`, em `perigo` sólido (`--danger-solid`, análise parte 1 §3.3). Moldura `border-danger`, raio 12, ícone `IconLifebuoy` 16 em quadrado 32 `bg-danger-bg`.
- Modal: título "Resumo de handoff", subtítulo "Preparado pela Aria · <contato>".
- Seções do modal: "O que o contato quer" (`resumo.quer`, ou "A Aria não deixou resumo."), "O que a Aria já fez" (`feito`, com check `text-ai-text` e hora mono; vazia: "Nenhuma ação registrada.") e "Próxima ação sugerida" (`bg-brand-bg`, só com `proximoPasso`).
- Botões do modal:
  - "Cancelar", sempre;
  - "Assumir e responder" (`podeAssumir`): `assumirAtendimento` → `aoAssumido()` → `aoResponder()`;
  - "Responder" (`ehResponsavel`): `aoResponder()`;
  - nenhum dos dois: só "Fechar".
- `aoResponder` fecha o modal e foca `[data-compositor-campo]` na aba Responder.

- [ ] **Step 1: Escrever os testes que falham**

```ts
const h0: HandoffDoAtendimento = { acaoId: "h1", pedidoEm: "2026-10-23T11:56:00.000Z", motivo: "VALOR", motivoTexto: "Valor alto", destino: "FILA_SETOR", responsavelNome: null, resumo: { quer: "Quer 15% para 12 matrículas", proximoPasso: "Ligar hoje" }, feito: [{ texto: "Adicionou a tag Quente", quando: "2026-10-23T11:50:00.000Z" }], podeAssumir: true, ehResponsavel: false };
const agora = new Date("2026-10-23T12:00:00Z");
// FaixaHandoff.test.ts
it("faixa_com_tempo_motivo_e_botao", () => {
  const h = texto(renderToStaticMarkup(createElement(FaixaHandoff, { handoff: h0, agora, aoVerResumo: () => {} })));
  expect(h).toContain("Aria pediu ajuda há 4 min"); expect(h).toContain("Valor alto"); expect(h).toContain("Ver resumo e assumir");
});
it("sem_alcada_so_ver_resumo", () => {
  expect(texto(renderToStaticMarkup(createElement(FaixaHandoff, { handoff: { ...h0, podeAssumir: false }, agora, aoVerResumo: () => {} })))).toContain("Ver resumo");
});
// ModalResumoHandoff.test.ts
it("secoes_em_sentence_case", () => {
  const h = montarModal(h0);
  for (const t of ["Resumo de handoff", "Preparado pela Aria · Grupo Ventura", "O que o contato quer", "O que a Aria já fez", "Próxima ação sugerida", "Quer 15% para 12 matrículas", "Adicionou a tag Quente", "Ligar hoje"]) expect(texto(h)).toContain(t);
  expect(h).not.toContain("uppercase");
});
it("botoes_por_alcada", () => {
  expect(botao(montarModal(h0), "Assumir e responder")).toBe(true);
  expect(botao(montarModal({ ...h0, podeAssumir: false, ehResponsavel: true }), "Responder")).toBe(true);
  const sem = montarModal({ ...h0, podeAssumir: false });
  expect(botao(sem, "Assumir e responder")).toBe(false); expect(botao(sem, "Fechar")).toBe(true);
});
it("resumo_nulo_e_feito_vazio", () => {
  const h = texto(montarModal({ ...h0, resumo: null, feito: [] }));
  expect(h).toContain("A Aria não deixou resumo."); expect(h).toContain("Nenhuma ação registrada."); expect(h).not.toContain("Próxima ação sugerida");
});
it("assumir_chama_assumirAtendimento_e_depois_aoResponder", async () => { /* mock de "@/server/whatsapp/acoes-atendimento"; ok → aoAssumido e aoResponder, nesta ordem */ });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/app/\(app\)/inbox/aria/FaixaHandoff.test.ts src/app/\(app\)/inbox/aria/ModalResumoHandoff.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`ConversaAberta` renderiza `<FaixaHandoff>` quando `aria?.handoff` existe, e o modal com estado local. O "Assumir" do cabeçalho (E1, só da fila) segue como está: no padrão D3 ele não pausa a Aria nem abre o modal.

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2, mais `node_modules/.bin/vitest run src/app/\(app\)/inbox src/app/paleta.test.ts src/app/contraste.test.ts src/app/tipografia.test.ts`.
Expected: PASS.

- [ ] **Step 5: Aceite visual**

Cenário `aria-handoff` com a faixa e com o modal aberto, como gerente (com "Assumir e responder" quando na fila) e como vendedor dono (com "Responder"), nas três larguras (o modal vira folha no celular, `data-m="fullsheet"`) e nos dois temas. Compare com o protótipo L253–L262 e L435–L468 (conversa c2 "Grupo Ventura").

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/inbox
git commit -m "feat(inbox): faixa e resumo do handoff da Aria na conversa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

<a id="task-12"></a>
### Task 12: Retirar o `PainelAria` e registrar a entrega

O conteúdo do `PainelAria` (`PainelAria.tsx:17-56`) já tem lugar novo. A pausa e o "Devolver para Aria" estão no cabeçalho (Task 7) e as sugestões, no cartão (Task 9).

**Files:**
- Delete: `src/app/(app)/inbox/PainelAria.tsx`
- Modify: `src/app/(app)/inbox/InboxNovo.tsx:19` e `:200-202`, ou o lugar equivalente depois da E1
- Modify: `src/app/(app)/inbox/PainelAtendimento.aria.test.ts`: os casos passam a testar `textoPausaAria` (Task 7), o `CartaoSugestaoAria` e o `BotaoDevolverAria`, e a trava de fonte (`:53-56`) passa a exigir `<CartaoSugestaoAria` em `ConversaAberta.tsx` e `<BotaoDevolverAria` no cabeçalho
- Modify: `src/server/whatsapp/consultas-inbox.ts:258-299`: tirar `sugestoes` (e `resumoDaSugestao`, `:266-271`), porque `cartoes` substitui
- Modify: `src/server/whatsapp/consultas-inbox.aria.int.test.ts`: casos de `sugestoes` reescritos sobre `cartoes`, com as mesmas regras (só SUGERIDA vigente para pendentes; gerente só da equipe; sem lead, só o Admin)
- Modify: `docs/planejamento/quadro-entregas.md`: entrada "Inbox E3: Aria na conversa", com as decisões D1–D4 ainda abertas e os padrões aplicados
- Modify: `docs/superpowers/plans/2026-10-22-inbox-prototipo-00-indice.md`: a linha `PainelAria (E3)` passa a citar onde cada função foi parar

**Interfaces:**
- Consumes: Tasks 7, 8 e 9.
- Produces: `AriaDoAtendimento = { pausada; motivo; podeDevolver; podeDecidir; cartoes; handoff }`.

- [ ] **Step 1: Reescrever os testes para o desenho novo (falham com o `PainelAria` ainda montado)**

```ts
it("o_inbox_nao_monta_mais_o_painel_da_aria (fonte)", () => {
  expect(existsSync("src/app/(app)/inbox/PainelAria.tsx")).toBe(false);
  expect(readFileSync("src/app/(app)/inbox/ConversaAberta.tsx", "utf8")).toMatch(/<CartaoSugestaoAria[\s\S]*?s=\{/);
  expect(readFileSync("src/app/(app)/inbox/ConversaAberta.tsx", "utf8")).toContain("<BotaoDevolverAria");
});
it("consulta_sem_sugestoes_legadas", async () => { expect(await carregarAriaDoAtendimento(c.gerente, c.a.id)).not.toHaveProperty("sugestoes"); });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/app/\(app\)/inbox/PainelAtendimento.aria.test.ts && node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/consultas-inbox.aria.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Remover e ajustar** os arquivos listados.

- [ ] **Step 4: Rodar a verificação completa**

Run: `node_modules/.bin/tsc --noEmit && npm test && npm run lint && node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox src/server/aria src/server/whatsapp/consultas-inbox.aria.int.test.ts`
Expected: tudo com saída 0; lint com até 40 avisos.

- [ ] **Step 5: Commit**

```bash
git add -A src/app/\(app\)/inbox src/server/whatsapp docs/planejamento/quadro-entregas.md docs/superpowers/plans/2026-10-22-inbox-prototipo-00-indice.md
git commit -m "refactor(inbox): PainelAria sai; Aria passa a viver na thread e no cabeçalho

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Tasks bloqueadas por decisão

Cada uma tem issue com a label `bloqueado-por-decisao`. Quando a decisão chegar, o executor atualiza a tabela de decisões do índice no mesmo PR (`00-indice.md`, "Decisões do dono"). Se a resposta for "manter o padrão", a issue é fechada sem código, com o link da decisão.

<a id="task-13"></a>
### Task 13 (D1): Vendedor dono da conversa decide as sugestões no Inbox

**Bloqueada por D1.** Implementar só se a resposta for "sim, o vendedor dono decide". A tela `/aria` continua só para Admin e GC (DF5-13). A mudança vale só para o Inbox.

**Files:**
- Modify: `src/server/aria/escopo-decisao.ts`: `podeDecidirNoInbox`
- Modify: `src/server/aria/historico.ts`: extrair os núcleos `aprovarNaTransacao(tx, u, id)` e `rejeitarNaTransacao(tx, u, id, motivo)` de `:44-71`, sem mudar o comportamento das ações atuais
- Create: `src/server/aria/decisao-inbox.ts` (`"use server"` fica na fronteira `acoes.ts`): `aprovarSugestaoNoInbox(id)` e `rejeitarSugestaoNoInbox(id, motivo?)`
- Modify: `src/server/aria/acoes.ts` (fronteira), `src/server/aria/sugestoes-thread.ts` (`cartoesDaThread` usa o critério novo), `src/app/(app)/inbox/aria/CartaoSugestaoAria.tsx` (chama as ações do Inbox)
- Test: `src/server/aria/decisao-inbox.int.test.ts`, `src/server/whatsapp/consultas-inbox.aria.int.test.ts`

**Interfaces:**
- Produces:
  - `export async function podeDecidirNoInbox(db: Db, u: UsuarioSessao, alvo: AlvoDecisaoAria): Promise<boolean>`: `capacidadesAria(u).has("decidirHistorico") && podeDecidirAcaoAria(db, u, alvo)`, **ou** `u` com papel `VENDEDOR` e `oportunidade.vendedorDonoId === u.id` (o lead de `leadDaAcaoAria`, `escopo-decisao.ts:17`);
  - `aprovarSugestaoNoInbox(id: string): Promise<Resultado>` e `rejeitarSugestaoNoInbox(id: string, motivo?: string): Promise<Resultado>`, com a mesma idempotência por natureza da Task 8 e o mesmo `AvisoInbox` (o gatilho da Task 4).

- [ ] **Step 1: Testes que falham**: `vendedor_dono_aprova_no_inbox`, `vendedor_de_outra_carteira_nao_aprova`, `vendedor_continua_sem_decidir_na_tela_aria` (`aprovarAcaoAria` recusa o vendedor), `cartoes_aparecem_para_o_vendedor_dono` (`carregarAriaDoAtendimento(vendedor)` → `podeDecidir: true`, `cartoes.length === 1`) e `repetido_pelo_vendedor_e_ok_sem_novo_evento`.
- [ ] **Step 2: Rodar e ver falhar** (`node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/aria/decisao-inbox.int.test.ts src/server/whatsapp/consultas-inbox.aria.int.test.ts`).
- [ ] **Step 3: Implementar** a extração dos núcleos, `podeDecidirNoInbox` e as duas ações.
- [ ] **Step 4: Rodar e ver passar**, incluindo `src/server/aria/historico.int.test.ts` sem mudança.
- [ ] **Step 5: Aceite visual** do cenário `aria-aprovacao` como vendedor dono: o cartão com botões e a linha "Aria aguarda sua aprovação".
- [ ] **Step 6: Commit** `feat(inbox): vendedor dono decide sugestões da Aria no Inbox (D1)`.

<a id="task-14"></a>
### Task 14 (D2): Aprovar a sugestão com edição (texto, tarefa e agendamento)

**Bloqueada por D2**, que também responde à pergunta 17: o texto editado sai como Aria ou como humano, e a edição pausa ou não a Aria. Depende também do modal de tarefa da E2 (para "Editar tarefa") e do agendador (E4, ou `DialogoAgendar` de `AcoesAtendimento.tsx:291-321`) para editar um agendamento.

**Files:**
- Modify: `src/server/aria/historico.ts`: `aprovarAcaoAriaEditada`
- Modify: `src/server/aria/acoes.ts` (fronteira)
- Modify: `src/app/(app)/inbox/aria/CartaoSugestaoAria.tsx` e `aria/sugestao-visual.ts`: "Editar" e "Cancelar edição", "Aprovar e enviar editado" (protótipo L1018), `<textarea>` com `border-ai` (L310) e "Editar tarefa" na linha `tarefa` (L312, L1019)
- Test: `src/server/aria/historico-edicao.int.test.ts`, `src/app/(app)/inbox/aria/sugestao-visual.test.ts`, `src/app/(app)/inbox/aria/CartaoSugestaoAria.test.ts`

**Interfaces:**
- Produces: `export async function aprovarAcaoAriaEditada(input: { acaoId: string; texto?: string; tarefa?: { titulo: string; venceEmISO: string }; agendadaPara?: string; chaveIdempotencia: string }): Promise<Resultado>`
  - Zod: `texto` só em RESPONDER/AGENDAR_MENSAGEM/NOTA_INTERNA (1–4096 caracteres, `trim`); `tarefa` só em CRIAR_TAREFA (título 1–200, data válida); `agendadaPara` só em AGENDAR_MENSAGEM (futuro e dentro da janela, a mesma `recusaForaDaJanela` de `executor.ts:271-273`); `chaveIdempotencia` com `ChaveIdempotenciaSchema` (`src/server/_shared/validacao.ts:277`);
  - #166: `marcaIdempotencia(chave, entradaSemChave)` e `repeticaoIdempotente(tx, { tipo: "AcaoAriaAprovada", agregadoTipo: "AcaoAgenteIA", autorId: u.id, marca, mensagemConflito: "Esta tentativa já foi usada com outro texto." })` (`idempotencia.ts:21`, `:43`). A marca vai no payload do Evento `AcaoAriaAprovada`;
  - o payload da ação ganha `{ editadaPorId: u.id, original: { texto?, titulo?, venceEmISO?, agendadaPara? } }` e os campos novos substituem os do payload antes de `efetivarRespostaSugerida`/`aplicarAcao`, que revalidam valores e documento (`executor.ts:184-185`).
  - **Ramo A ("sai como Aria"):** a `IntencaoMensagem` é a de `efetivarRespostaSugerida`, com origem `IA`, e a Aria segue sem pausa.
  - **Ramo B ("sai como humano"):** a ação vira `APROVADA` sem `efetivarRespostaSugerida`. A mensagem sai pelo caminho humano (a mesma criação de `IntencaoMensagem` de `enviarTextoInbox`, origem `HUMANO`, `autorId: u.id`), e o envio pausa a Aria por `aoGravarSaidaHumana` (`pausa.ts:62-69`). Implementar só o ramo que a decisão escolher.

- [ ] **Step 1: Testes que falham**:
  - `editar_texto_aprova_com_o_texto_novo_e_guarda_o_original`;
  - `editar_com_valor_nao_autorizado_falha` (`executor.ts:184`);
  - `editar_tarefa_cria_a_tarefa_editada` (`tarefa.titulo` e prazo);
  - `editar_agendamento_fora_da_janela_falha`;
  - `mesma_chave_mesma_entrada_devolve_ok_sem_duplicar`;
  - `mesma_chave_outra_entrada_falha`;
  - `campo_que_nao_vale_para_a_acao_falha` (ex.: `tarefa` em RESPONDER);
  - do ramo escolhido: `ramo_a_sai_como_ia_sem_pausar` ou `ramo_b_sai_como_humano_e_pausa_a_aria`;
  - UI: `editar_troca_o_texto_por_textarea_e_o_rotulo`, `editar_tarefa_aparece_so_na_linha_de_tarefa_pendente`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** a ação e a UI. A chave vem de `useChaveIdempotencia()` (`src/lib/chave-idempotencia.ts:24`) com `depoisDo(desfecho)`.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Aceite visual** do cartão em edição (protótipo L310 com `editing`).
- [ ] **Step 6: Commit** `feat(inbox): aprovar sugestão da Aria com edição (D2)`.

<a id="task-15"></a>
### Task 15 (D2): Sugestão em pacote por turno

**Bloqueada por D2** (pergunta 16 da parte 2): sem decisão a favor, cada `AcaoAgenteIA` continua tendo o próprio cartão.

**Files:**
- Modify: `src/server/aria/historico.ts`: `aprovarTurnoAria` e `rejeitarTurnoAria`
- Modify: `src/app/(app)/inbox/aria/intercalar.ts` (`agruparPorTurno`), `aria/sugestao-visual.ts` (o pacote vira um cartão com N linhas, protótipo L306-L313) e `aria/CartaoSugestaoAria.tsx`
- Test: `src/server/aria/historico-turno.int.test.ts`, `src/app/(app)/inbox/aria/intercalar.test.ts`

**Interfaces:**
- Produces:
  - `export function agruparPorTurno(cartoes: readonly SugestaoAriaThread[]): SugestaoAriaThread[][]`: pendentes do mesmo `turnoId` juntas, decididas sozinhas;
  - `export async function aprovarTurnoAria(input: { turnoId: string; atendimentoId: string; chaveIdempotencia: string }): Promise<Resultado<{ aprovadas: number }>>`: numa transação só, trava as `SUGERIDA` do turno (`FOR UPDATE`, como `travarAcao`, `historico.ts:25-30`), confere o escopo de cada uma (`exigirEscopo`) e aplica na ordem MOVER_ETAPA, TAG, ATUALIZAR_CAMPO, CRIAR_TAREFA, NOTA_INTERNA, MARCAR_PERDIDO, CONDICAO_COMERCIAL, AGENDAR_MENSAGEM e, por último, RESPONDER/ENVIAR_DOCUMENTO. É tudo ou nada: o erro cita a ação ("Não foi possível mover de etapa: …"). Um Evento `AcaoAriaAprovada` por ação, com a marca de idempotência no primeiro;
  - `rejeitarTurnoAria(input: { turnoId; atendimentoId; motivo?; chaveIdempotencia })`.

- [ ] **Step 1: Testes que falham**: `aprova_todas_do_turno_na_ordem`, `falha_em_uma_desfaz_todas`, `turno_com_acao_fora_do_escopo_falha_inteiro`, `repetido_com_a_mesma_chave_e_ok`, `agrupa_so_pendentes_do_mesmo_turno`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Aceite visual** do cartão com três linhas (protótipo L298–L326, conversa c1).
- [ ] **Step 6: Commit** `feat(inbox): aprovar a sugestão da Aria em pacote por turno (D2)`.

<a id="task-16"></a>
### Task 16 (D3): "Assumir" pausa a Aria (motivo `MANUAL`)

**Bloqueada por D3** (perguntas 7 da parte 2 e 17 da parte 3). Implementar se a resposta for "Assumir pausa a Aria".

**Files:**
- Modify: `src/server/whatsapp/acoes-atendimento.ts`: `assumirConversaDaAria`, ao lado de `assumirAtendimento` (`:89`)
- Modify: `src/server/inbox/estado-aria.ts`: nada (o `AtendimentoAssumido` posterior à pausa já encerra o handoff, Task 1)
- Modify: `src/app/(app)/inbox/ConversaAberta.tsx` e `aria/ModalResumoHandoff.tsx`: "Assumir conversa" (protótipo L175–L177) e "Assumir e responder" chamam a ação nova quando `estadoAria` está em `ia`, `aprovacao` ou `handoff`
- Test: `src/server/whatsapp/assumir-da-aria.int.test.ts`

**Interfaces:**
- Produces: `export async function assumirConversaDaAria(atendimentoId: string): Promise<Resultado>`
  - escopo: `atendimentoVisivel(u, id, true)` (precisa de envio, porque é para responder);
  - alçada: `responsavelId === null` → `podeExecutar(u, "assumir", ctx)` (`permissoes.ts:51-56`); `responsavelId === u.id` → ok; outro responsável → "Outro atendente já assumiu este atendimento." (`acoes-atendimento.ts:21`);
  - na transação: `FOR UPDATE` no atendimento; grava `responsavelId` (se nulo) com `proximoStatus(status, "ASSUMIDO", true)`; `pausarAriaNoAtendimento(tx, id, "MANUAL", u.id)` (`pausa.ts:38`; se já pausada, não regrava, mas cancela as intenções pendentes da Aria); as `SUGERIDA` de mensagem (RESPONDER, ENVIAR_DOCUMENTO, AGENDAR_MENSAGEM) viram `EXPIRADA` com Evento `AcaoAriaExpirada` `payloadDaAria(id, { acao, motivo: "conversa_assumida" })`, porque não podem mais sair (`executor.ts:179`); as de CRM continuam `SUGERIDA`. **Se a D3 mandar "rejeitar todas"**, troque por `REJEITADA` com `decididaPorId: u.id` e Evento `AcaoAriaRejeitada` `{ motivo: "Conversa assumida por uma pessoa" }`. Por fim, Evento `AtendimentoAssumido` `{ de, para: u.id, daAria: true }`;
  - #166, idempotente por natureza: `jaAssumidoPor(tx, id, u)` (`acoes-atendimento.ts:79-84`) com a Aria já pausada → ok sem novo Evento;
  - `AvisoInbox`: o `UPDATE` do atendimento dispara `notificar_inbox`; a mudança de status das ações dispara o gatilho da Task 4.

- [ ] **Step 1: Testes que falham**:
  - `assumir_da_ia_pausa_manual_e_vira_responsavel`;
  - `assumir_com_handoff_pendente_encerra_o_handoff` (`estadoAria` → `humano`);
  - `sugestoes_de_mensagem_expiram_e_de_crm_ficam`;
  - `repetido_e_ok_sem_novo_evento`;
  - `com_outro_responsavel_falha`;
  - `sem_escopo_de_envio_falha`;
  - `intencao_pendente_da_aria_e_cancelada` (`pausa.ts:20-31`).
- [ ] **Step 2: Rodar e ver falhar** (`node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/assumir-da-aria.int.test.ts`).
- [ ] **Step 3: Implementar** a ação e a ligação na tela.
- [ ] **Step 4: Rodar e ver passar**, mais `src/server/aria/pausa.int.test.ts` e `src/server/whatsapp` (integração) sem regressão.
- [ ] **Step 5: Aceite visual**: cabeçalho com "Assumir conversa" no cenário `aria-ia` e o mesmo cenário depois de assumir (`aria-humano-voce`).
- [ ] **Step 6: Commit** `feat(inbox): assumir conversa da Aria com pausa MANUAL (D3)`.

<a id="task-17"></a>
### Task 17 (D3): Compositor travado enquanto a Aria conduz

**Bloqueada por D3** (pergunta 6 da parte 2). Depende da Task 16.

**Files:**
- Create: `src/app/(app)/inbox/aria/modo-rodape.ts`
- Modify: `src/app/(app)/inbox/ConversaAberta.tsx`: passa `modo` ao `RodapeConversa` (E1)
- Modify (só se a D3 pedir trava também no servidor): `src/server/whatsapp/acoes.ts` (`enviarTextoInbox`, `enviarMidiaInbox`)
- Test: `src/app/(app)/inbox/aria/modo-rodape.test.ts`, `src/server/whatsapp/trava-aria.int.test.ts` (se houver trava no servidor)

**Interfaces:**
- Produces:
  - `export function modoRodape(estado: EstadoAria | null, nota: boolean): "travado" | "compositor"`: `travado` quando `estado` está em `ia`, `aprovacao` ou `handoff` e a aba não é Nota (protótipo L997);
  - `export function textoTravado(estado: "ia" | "aprovacao" | "handoff"): string`: "Aria está respondendo esta conversa." / "Aria aguarda aprovação da sugestão acima." / "Aria parou de responder e aguarda um humano." (protótipo L999, adaptado: no ERP a Aria não pausa por sugestão);
  - barra travada (E1, `RodapeConversa` modo `"travado"`): "Nota interna" troca para a aba Nota; "Assumir para responder" chama `assumirConversaDaAria` (Task 16);
  - trava no servidor (opcional): `enviarTextoInbox`/`enviarMidiaInbox` recusam com "Assuma a conversa para responder." quando o estado do atendimento é `ia`, `aprovacao` ou `handoff` (Task 1, `carregarContextoAria` com um id).

- [ ] **Step 1: Testes que falham**: `travado_nos_tres_estados_da_aria`, `nota_destrava_so_a_aba_nota`, `humano_e_sem_estado_usam_o_compositor`, `textos_travados`; no servidor, `envio_com_aria_conduzindo_e_recusado` e `envio_depois_de_assumir_passa`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Aceite visual**: rodapé travado nos cenários `aria-ia`, `aria-aprovacao` e `aria-handoff` (protótipo L408–L415).
- [ ] **Step 6: Commit** `feat(inbox): compositor travado enquanto a Aria conduz (D3)`.

<a id="task-18"></a>
### Task 18 (D4): Interruptor "Aria ativa" no Inbox

**Bloqueada por D4** (pergunta 5 da parte 2 e 18 da parte 3): se o interruptor entra, para quais papéis e se o motivo é obrigatório. O padrão de hoje (capacidade `pausar` só para Admin e GC, motivo obrigatório, `estado.ts:72-96`) é o ponto de partida.

**Files:**
- Modify: `src/app/(app)/inbox/aria/FaixaAriaAtiva.tsx`: interruptor (`role="switch"`, `aria-checked`, 36×20, protótipo L120) visível com `podeGerenciar` e diálogo de motivo ao pausar
- Modify: `src/server/aria/estado.ts:72-119`: `pausarAria` e `reativarAria` idempotentes por natureza (#166)
- Test: `src/app/(app)/inbox/aria/FaixaAriaAtiva.test.ts`, `src/server/aria/estado.int.test.ts`

**Interfaces:**
- Consumes: `pausarAria({ motivo })` e `reativarAria()` (`src/server/aria/acoes.ts:35-41`); `SituacaoAriaInbox.podeGerenciar` (Task 3).
- Produces:
  - `pausarAria`: já pausada, e o último Evento `AriaPausada` de `AgenteIA/aria` é do mesmo autor com o mesmo motivo (`ultimoEventoDoAutor`) → ok sem gravar; senão, "A Aria já está pausada." (`estado.ts:82`);
  - `reativarAria`: o mesmo com `AriaReativada` (`estado.ts:105`);
  - o `AvisoInbox` `aria.global` (Task 4) atualiza a faixa de todos.
  - Se a D4 tirar a obrigação do motivo, `pausarAria` aceita `motivo` vazio só quando chamado pelo Inbox (parâmetro `origem: "inbox"`). Não mudar sem a decisão.

- [ ] **Step 1: Testes que falham**:
  - `interruptor_so_para_quem_pode_pausar`;
  - `pausar_exige_motivo_no_dialogo`;
  - `pausar_repetido_pelo_mesmo_autor_e_motivo_e_ok`;
  - `pausar_ja_pausada_por_outro_falha`;
  - `reativar_repetido_e_ok`;
  - `faixa_muda_para_pausada_no_aviso`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Aceite visual**: interruptor ligado e desligado (protótipo L114–L121) e o diálogo de motivo.
- [ ] **Step 6: Commit** `feat(inbox): interruptor Aria ativa na coluna de conversas (D4)`.

---

## Issues

Os mesmos blocos estão em `2026-10-22-inbox-prototipo-04-aria.issues.json`, para criação em lote. Labels comuns: `inbox` e `etapa-3`.

**[Inbox E3.1] Estado da Aria derivado no servidor**
Labels: `inbox`, `etapa-3`, `back-end`
Objetivo: definir `EstadoAria` (ia, aprovação, handoff, humano) por atendimento, numa função pura e em condições Prisma equivalentes, com o índice parcial do handoff.
Plano: `docs/superpowers/plans/2026-10-22-inbox-prototipo-04-aria.md#task-1`
Arquivos: `src/server/inbox/estado-aria.ts`; migration `20261023200000_inbox_aria_indice_handoff`.
Aceite: `estado-aria.test.ts` e `estado-aria.int.test.ts` (inclui `condicao_e_derivacao_concordam`, `pausa_global_tira_todas_de_ia` e `resposta_pelo_celular_encerra_handoff_pendente`).
Depende de: —.

**[Inbox E3.2] Estado da Aria e prévia com autor no item da lista**
Labels: `inbox`, `etapa-3`, `back-end`
Objetivo: `ItemListaInbox` ganha `estadoAria`, `atendidoPorVoce`, `previaAutor` e `previaRotulo`.
Plano: `…#task-2`
Arquivos: `src/server/inbox/previa.ts`, `src/server/inbox/consultas-pagina.ts`.
Aceite: `previa.test.ts` (inclui `previa_de_sugestao_mostra_so_o_rotulo`) e os casos novos de `consultas-pagina.int.test.ts`.
Depende de: E3.1.

**[Inbox E3.3] Filtro por estado da Aria e contagens dos chips**
Labels: `inbox`, `etapa-3`, `back-end`
Objetivo: `?aria=` na URL, uma consulta única de contagens (sete chips) e a situação da Aria para a faixa, também pela rota da lista (`contagens=1`).
Plano: `…#task-3`
Arquivos: `src/server/inbox/filtros.ts`, `consultas-pagina.ts`, `contagens.ts`, `src/app/api/inbox/atendimentos/route.ts`, `InboxNovo.tsx` (`paramsDosFiltros`).
Aceite: `filtros.test.ts`, `contagens.int.test.ts`, `filtro_e_item_concordam_em_cada_estado`.
Depende de: E3.1, E3.2.

**[Inbox E3.4] Tempo real: sugestões, decisões, handoff e estado global da Aria**
Labels: `inbox`, `etapa-3`, `back-end`
Objetivo: gatilhos em `AcaoAgenteIA` e `AgenteIA` publicam `AvisoInbox` (`atendimento.atualizado` e o novo `aria.global`), e o cliente reage.
Plano: `…#task-4`
Arquivos: migration `20261023210000_inbox_aria_tempo_real`, `barramento.ts`, `eventos-sse.ts`, `useEventosInbox.ts`, `historico-conversa.ts`, `InboxNovo.tsx`.
Aceite: `barramento.int.test.ts` (casos novos), `eventos-sse.test.ts`, `useEventosInbox.test.ts`, `historico-conversa.test.ts`, `InboxNovo.test.ts` (`avisoRecarregaPainel`).
Depende de: —.

**[Inbox E3.5] Badge, selo IA e prévia no item; chips da Aria com contagem**
Labels: `inbox`, `etapa-3`, `ui`
Objetivo: o item mostra o estado da Aria, o selo e a prévia com autor; os chips ganham os quatro estados e as contagens.
Plano: `…#task-5`
Arquivos: `chips-inbox.ts`, `estado-visual.ts`, `ItemConversa.tsx`, `ChipsFiltro.tsx`, `ColunaConversas.tsx`, `InboxNovo.tsx`, `page.tsx`, `scripts/visual/demo-inbox.ts`.
Aceite: `estado-visual.test.ts`, `chips-inbox.test.ts`, `ItemConversa.test.ts` e aceite visual dos cenários `aria-*`.
Depende de: E1 (lista e chips), E3.2, E3.3, E3.4.

**[Inbox E3.6] Faixa "Aria ativa" na coluna (sem interruptor)**
Labels: `inbox`, `etapa-3`, `ui`
Objetivo: faixa com "N em atendimento · M aguardando você", pausada ou em ensaio; o link "Gerenciar" para quem pode pausar.
Plano: `…#task-6`
Arquivos: `aria/FaixaAriaAtiva.tsx`, `InboxNovo.tsx`.
Aceite: `FaixaAriaAtiva.test.ts` (inclui `sem_interruptor_no_padrao_d4`) e aceite visual.
Depende de: E1 (`ColunaConversas`), E3.3.

**[Inbox E3.7] Estado da Aria no cabeçalho e "Devolver para Aria"**
Labels: `inbox`, `etapa-3`, `ui`
Objetivo: linha de estado ("Aria está atendendo"…) e o botão "Devolver para Aria" no cabeçalho de 68 px.
Plano: `…#task-7`
Arquivos: `aria/textos-aria.ts`, `aria/BotaoDevolverAria.tsx`, `CabecalhoConversa.tsx`, `ConversaAberta.tsx`.
Aceite: `textos-aria.test.ts`, `BotaoDevolverAria.test.ts` e aceite visual.
Depende de: E1 (`CabecalhoConversa`), E3.2.

**[Inbox E3.8] Dados do cartão de sugestão e decisão idempotente**
Labels: `inbox`, `etapa-3`, `aria`
Objetivo: `AriaDoAtendimento` ganha `podeDecidir` e `cartoes` (pendentes e decididas nas últimas 24 h); `aprovarAcaoAria` e `rejeitarAcaoAria` ficam idempotentes por natureza (#166).
Plano: `…#task-8`
Arquivos: `src/server/aria/sugestoes-thread.ts`, `historico.ts`, `src/server/whatsapp/consultas-inbox.ts`.
Aceite: `sugestoes-thread.test.ts`, `consultas-inbox.aria.int.test.ts` e `historico.int.test.ts` (inclui `aprovar_repetido_pelo_mesmo_decisor_nao_duplica_intencao` e `gerente_de_outra_equipe_ve_estado_sem_cartao`).
Depende de: E3.1.

**[Inbox E3.9] Cartão "Aria sugere" na thread (aprovar e rejeitar)**
Labels: `inbox`, `etapa-3`, `ui`
Objetivo: cartão na thread com título, motivo, texto proposto, ações, aviso de envio, "Aprovar e enviar" e "Rejeitar" e estado decidido. Padrão D1/D2: uma por vez, sem edição.
Plano: `…#task-9`
Arquivos: `aria/sugestao-visual.ts`, `aria/intercalar.ts`, `aria/CartaoSugestaoAria.tsx`, `ConversaAberta.tsx`.
Aceite: `sugestao-visual.test.ts`, `intercalar.test.ts`, `CartaoSugestaoAria.test.ts` (inclui `aprovar_sugestao_expirada_mostra_erro`) e aceite visual.
Depende de: E1 (thread), E2 (fio, `ItemFio`) se já mergeada, E3.8.

**[Inbox E3.10] Resumo do handoff no servidor**
Labels: `inbox`, `etapa-3`, `aria`
Objetivo: `AriaDoAtendimento.handoff`, com motivo, a nota do resumo separada por campo, o que a Aria já fez e as alçadas para assumir e responder.
Plano: `…#task-10`
Arquivos: `src/server/aria/turno/handoff.ts` (`lerNotaResumo`), `src/server/aria/handoff-inbox.ts`, `consultas-inbox.ts`, `src/lib/labels.ts` (`MOTIVO_HANDOFF_LABEL`), `Playground.tsx`, `enums-rotulos.test.ts`.
Aceite: `handoff.test.ts`, `handoff-inbox.int.test.ts` e `enums-rotulos.test.ts`.
Depende de: E3.1, E0 (notas do atendimento visíveis).

**[Inbox E3.11] Faixa e modal de handoff na conversa**
Labels: `inbox`, `etapa-3`, `ui`
Objetivo: faixa "Aria pediu ajuda há N min" e modal "Resumo de handoff" com "Assumir e responder" (só da fila) ou "Responder" (responsável). Padrão D3.
Plano: `…#task-11`
Arquivos: `aria/FaixaHandoff.tsx`, `aria/ModalResumoHandoff.tsx`, `ConversaAberta.tsx`, compositor (`data-compositor-campo`).
Aceite: `FaixaHandoff.test.ts`, `ModalResumoHandoff.test.ts` e aceite visual.
Depende de: E0 (`agora` vivo), E3.7, E3.10.

**[Inbox E3.12] Retirar o PainelAria e registrar a entrega da E3**
Labels: `inbox`, `etapa-3`, `ui`
Objetivo: o `PainelAria` sai, `sugestoes` vira `cartoes` na consulta, os testes de trava são atualizados e entra o registro no quadro de entregas.
Plano: `…#task-12`
Arquivos: `PainelAria.tsx` (sai), `InboxNovo.tsx`, `PainelAtendimento.aria.test.ts`, `consultas-inbox.ts`, `consultas-inbox.aria.int.test.ts`, `quadro-entregas.md`, `00-indice.md`.
Aceite: `PainelAtendimento.aria.test.ts`, `consultas-inbox.aria.int.test.ts` e a verificação completa (tsc, `npm test`, lint e a integração de `src/server/inbox` e `src/server/aria`).
Depende de: E3.7, E3.9, E3.11.

**[Inbox E3.13] Vendedor dono decide sugestões da Aria no Inbox (D1)**
Labels: `inbox`, `etapa-3`, `aria`, `bloqueado-por-decisao`
Objetivo: se a D1 aprovar, o vendedor dono da oportunidade aprova e rejeita as sugestões das próprias conversas no Inbox. `/aria` continua para Admin e GC.
Plano: `…#task-13`
Arquivos: `escopo-decisao.ts`, `historico.ts` (núcleos), `decisao-inbox.ts`, `acoes.ts`, `sugestoes-thread.ts`, `CartaoSugestaoAria.tsx`.
Aceite: `decisao-inbox.int.test.ts` e `consultas-inbox.aria.int.test.ts`.
Depende de: D1, E3.9.

**[Inbox E3.14] Aprovar sugestão da Aria com edição (D2)**
Labels: `inbox`, `etapa-3`, `aria`, `bloqueado-por-decisao`
Objetivo: editar o texto, a tarefa e o horário antes de aprovar, com autoria e pausa conforme a D2 (pergunta 17).
Plano: `…#task-14`
Arquivos: `historico.ts` (`aprovarAcaoAriaEditada`), `acoes.ts`, `CartaoSugestaoAria.tsx`, `sugestao-visual.ts`.
Aceite: `historico-edicao.int.test.ts` e os testes de UI da task.
Depende de: D2, E3.9, E2 (modal de tarefa), agendador (E4 ou o atual).

**[Inbox E3.15] Sugestão da Aria em pacote por turno (D2)**
Labels: `inbox`, `etapa-3`, `aria`, `bloqueado-por-decisao`
Objetivo: aprovar ou rejeitar de uma vez as sugestões do mesmo turno (enviar, mover etapa, criar tarefa), tudo ou nada.
Plano: `…#task-15`
Arquivos: `historico.ts` (`aprovarTurnoAria`, `rejeitarTurnoAria`), `intercalar.ts`, `sugestao-visual.ts`, `CartaoSugestaoAria.tsx`.
Aceite: `historico-turno.int.test.ts` e `intercalar.test.ts`.
Depende de: D2, E3.9.

**[Inbox E3.16] Assumir conversa da Aria com pausa MANUAL (D3)**
Labels: `inbox`, `etapa-3`, `aria`, `bloqueado-por-decisao`
Objetivo: "Assumir" pausa a Aria (`MANUAL`), faz da pessoa a responsável e trata as sugestões pendentes conforme a D3.
Plano: `…#task-16`
Arquivos: `acoes-atendimento.ts` (`assumirConversaDaAria`), `ConversaAberta.tsx`, `ModalResumoHandoff.tsx`.
Aceite: `assumir-da-aria.int.test.ts`.
Depende de: D3, E3.7, E3.11.

**[Inbox E3.17] Compositor travado enquanto a Aria conduz (D3)**
Labels: `inbox`, `etapa-3`, `ui`, `bloqueado-por-decisao`
Objetivo: barra "Aria está respondendo…" com "Nota interna" e "Assumir para responder"; trava também no servidor se a D3 pedir.
Plano: `…#task-17`
Arquivos: `aria/modo-rodape.ts`, `ConversaAberta.tsx`, opcional `src/server/whatsapp/acoes.ts`.
Aceite: `modo-rodape.test.ts`, opcional `trava-aria.int.test.ts`, e aceite visual.
Depende de: D3, E3.16.

**[Inbox E3.18] Interruptor "Aria ativa" no Inbox (D4)**
Labels: `inbox`, `etapa-3`, `ui`, `bloqueado-por-decisao`
Objetivo: interruptor na faixa para quem pode pausar, com motivo conforme a D4; `pausarAria` e `reativarAria` idempotentes (#166).
Plano: `…#task-18`
Arquivos: `aria/FaixaAriaAtiva.tsx`, `src/server/aria/estado.ts`.
Aceite: `FaixaAriaAtiva.test.ts` e `estado.int.test.ts`.
Depende de: D4, E3.6.

---

## Suposições

1. **"Handoff pendente" termina** quando uma pessoa envia (ERP ou celular) ou quando alguém registra `AtendimentoAssumido` depois da pausa. Uma mensagem da Aria (a do próprio handoff) não encerra. Isso não muda o motivo gravado (`iaPausaMotivo` continua `HANDOFF`), então `despachante.ts:619-620` não é afetado.
2. **Pausa por pessoa vence sugestão**: com a Aria pausada no atendimento, o estado é "humano", mesmo com sugestão de CRM ainda pendente (o cartão continua para quem decide). Uma resposta pendente já não pode ser aprovada nesse caso (`executor.ts:179`).
3. **SHADOW e DESLIGADA não são "IA atendendo"**, e orçamento estourado com `PAUSAR` também não (`guardas.ts:47`).
4. **Contagens** usam a base da lista (escopo e filtros) sem os três filtros que os chips trocam entre si. "Aguardando você", na faixa, é aprovação + handoff no escopo de quem vê, sem filtrar por "posso decidir".
5. **Decididas recentes** ficam no cartão por 24 h e só para quem decide. Depois disso, o histórico fica na aba Atividade (E2) e em `/aria`.
6. **Idempotência de aprovar e rejeitar** passa a ser por natureza (Task 8). Isso muda o teste `aprovar_duas_vezes_falha` (`historico.int.test.ts:68-72`), e a tela `/aria` herda o mesmo comportamento, alinhada ao 5º lote do #166.
7. **"Aria"** fica literal. Usar o `config.nome` publicado exigiria levá-lo a todas as telas e aos rótulos de `labels.ts`. Fica para depois.
8. **A nota do handoff** é lida da ação `HANDOFF` (`payload.nota`), e não do `Evento` `NotaInterna`, para não depender de como a E0 expõe as notas. As duas têm o mesmo texto (`handoff.ts:110`, `:121`, `:141`).
9. **Os nomes da E1** (`AcoesCabecalho`, a forma interna dos chips e o fixture `ItemListaInbox` dos testes) eram desconhecidos quando este plano foi escrito. Por isso a E3 usa props e slots aditivos (`linhaAria`, `acoesAria`, `href`, `resumo`) em vez de mudar tipos da E1.
