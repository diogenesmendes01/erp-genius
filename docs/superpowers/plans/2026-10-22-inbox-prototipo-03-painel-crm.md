# Inbox no patamar do protótipo, Etapa 2: painel com o CRM dentro do Inbox. Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o painel do contato no `/inbox` passa a ser um mini-CRM: abas Detalhes, Oportunidades e Atividade, tags, edição do contato, etapa e perda, tarefas com cartão no fio, notas, alterações da Aria com desfazer, e os atalhos de entrada e de saída do Inbox.

**Architecture:** quase tudo reaproveita o servidor do CRM (`comercial/acoes.ts`, `crm/tarefas.ts`, `crm/tags.ts`, `crm/contatos.ts`, `aria/historico.ts`). As consultas novas ficam em `src/server/inbox/painel-*.ts` e saem por uma rota de leitura por aba (`/api/inbox/atendimentos/[id]/painel/[aba]`) e uma rota do fio (`.../fio`). As escritas do Inbox passam por *wrappers* em `src/server/inbox/acoes-painel.ts`: eles conferem o atendimento e o alvo, chamam a ação de domínio e publicam `atendimento.atualizado` (`avisarAtendimento`). O único modelo novo é `Tarefa.atendimentoId`.

**Tech Stack:** Next.js (App Router, Server Actions), Prisma/PostgreSQL, Zod, React, Tailwind com tokens, `@tabler/icons-react`, Vitest (unit com `renderToStaticMarkup`, `*.int.test.ts` no banco descartável).

**Spec:**
- `docs/planejamento/inbox-prototipo/analise-parte3-telas-atalhos.md` (blocos B1–B7 do §7; T13–T15, T19, T23–T27, A01–A12, A18–A21, A24; §4 e §5).
- `docs/planejamento/inbox-prototipo/analise-parte2-botoes-funcionalidades.md` §3 (T4, T6, T7), §5 (F2, F4), §7 (P2–P30), §8 (R1–R8).
- `docs/planejamento/inbox-prototipo/analise-parte1-design.md` §3.7 (painel).
- Protótipo `docs/planejamento/inbox-prototipo/prototipo/Inbox.dc.html`, linhas `P:473-650` (painel), `P:283-297` (cartão de tarefa), `P:680-735` (modal de tarefa), `P:887-933` e `P:1005-1007`, `P:1119-1154` (lógica).
- Contrato comum: `docs/superpowers/plans/2026-10-22-inbox-prototipo-00-indice.md`. Ele vale inteiro e não é repetido aqui.

## Global Constraints

Valem todas as do índice (`00-indice.md`, "Global Constraints"), mais estas da E2:

- Faixa de migration da E2: `20261023100000`–`20261023190000`. Nenhuma fora dela.
- Nenhum arquivo em `src/app/(app)/inbox/**` usa `router.refresh()` nem `setInterval(` (trava `sem-polling.test.ts:9-13`). Depois de uma ação, a tela chama `aoMudar()` e o `InboxNovo` recarrega o painel (`versaoPainel`); o SSE avisa os outros.
- Toda ação nova do Inbox publica `atendimento.atualizado` pelo `avisarAtendimento` (Task 1). Nenhum tipo novo em `AvisoInbox`.
- Nenhuma regra nova de papel. Quem pode cada coisa vem da matriz do CRM (`crm/permissoes.ts:33-48`), da Aria (`aria/permissoes-tela.ts:27-31`) e de `podeExecutar` (`inbox/permissoes.ts:41-74`). A tabela "Matriz das ações novas" abaixo é a única fonte.
- Enquanto a decisão estiver aberta, vale o padrão da tabela do índice: D8 segue `destinoDoArraste`; D10 só os campos atuais de `criarTarefa` e cancelar com motivo; D13 sem telefone no pedagógico, sem CPF e idade, abas comerciais só na finalidade `COMERCIAL`; D14 gaveta para edição rápida e "Abrir ficha completa" navega; D18 reaproveita a oportunidade; D20 tag sem autor ganha ✦ e @menção não avisa; D21 entradas só como link; D1 só Admin e Gerente Comercial desfazem; D11 campos atuais do agendamento.
- Textos copiados do protótipo, em sentence case e pt-BR. Quando o ERP não tem o dado, a tela mostra "—" (como o protótipo, `P:1127`).
- Valores em dinheiro: `formatarMoedaOuIndefinida(valor, moeda)` (`lib/dinheiro.ts:194`). Instantes: `formatarInstanteExibicao(iso, fusoPessoal, fusoEscola)` (`operacao/fuso-exibicao.ts:42`). Data e hora de tarefa: data civil e hora no fuso da escola (`crm/tarefas.ts:89-101`).
- Comandos de verificação: unit `node_modules/.bin/vitest run <arquivo>`; integração `node_modules/.bin/vitest run -c vitest.integration.config.ts <arquivo>` com o `.erp-test-profile` do worktree. Antes do PR: `node_modules/.bin/tsc --noEmit`, `npm test`, `npm run lint` com saída 0.
- Cada commit termina com o trailer de co-autoria do projeto e acrescenta a linha da entrega em `docs/planejamento/quadro-entregas.md` (seção "Inbox protótipo, E2").

## Review Focus

1. **Vazamento de dado de quem não deveria ver.** Pessoa de responsável legal no comercial (regra 6, `inbox/paineis.ts:60-61`), oportunidade de linha alheia (LC-L02, `whatsapp/consultas-inbox.ts:181-190`) e telefone no pedagógico (regra 5): o painel não pode mostrar pessoa, tags, campos, tarefas nem ações. Testes na Task 3 (`regra_6_e_linha_alheia_nao_carregam_pessoa`) e na Task 7 (`linha_alheia_sem_oportunidade`).
2. **Oportunidade encerrada** (`MATRICULADO` ou `PERDIDO`): a barra de etapas e o select ficam travados com o motivo de `destinoDoArraste`, e "Marcar como perdido" some. Testes na Task 7 (`opcoes_de_oportunidade_encerrada_sao_todas_recusadas`) e na Task 8 (`perdido_some_em_oportunidade_encerrada`).
3. **Tarefa alterada por outra pessoa** entre a leitura e o clique (versão otimista, `crm/tarefas.ts:151-154`): a tela mostra "Esta tarefa foi alterada por outra pessoa. Recarregue." e recarrega o painel, sem gravar. Teste na Task 10 (`versao_antiga_recusa_e_nao_grava`).
4. **Atalhos de horário e fuso.** "Hoje 18:00" depois das 18h na escola, e usuário com fuso pessoal diferente do da escola: os atalhos da tarefa são calculados no fuso da escola e "Hoje 18:00" fica desabilitado depois das 18h; "Segunda 09:00" numa segunda vai para a próxima semana. Testes na Task 10 (`quandoDoAtalho`) e na Task 18 (`valorDoAtalhoAgendar`).
5. **Link `?agendar=1` para conversa encerrada ou fora do escopo:** não abre o diálogo; na encerrada mostra "Esta conversa está encerrada. Não dá para agendar mensagens."; fora do escopo nada abre, como o `?c=`. Teste na Task 16 (`agendar_ao_abrir_so_em_conversa_aberta`).

---

## Acréscimos ao contrato

Nada do índice é renomeado. A E2 acrescenta:

| Onde | Acréscimo | Por quê |
|---|---|---|
| `PainelContato.tsx` (E1) | Props opcionais `children?: React.ReactNode` (conteúdo da aba ativa, se a E1 ainda não o tiver), `slotTags?: React.ReactNode` (substitui a linha de tags), `slotAviso?: React.ReactNode` (entre o cabeçalho e as abas: contato sem nome, cliente que voltou) e `aoEditar?: () => void` (lápis de 34 px no canto; ausente esconde o lápis) | Tags, avisos e edição moram no cabeçalho do painel (`P:475-489`) |
| `AbaPainel` (E1) | Campo opcional `contador?: number` (pílula mono em `--ai-bg`/`--ai-text`), se a E1 não o tiver | Contador da aba Atividade (`P:494`, `P:1114`) |
| `ContatoPainel` (E1) | Campo opcional `subtitulo?: string`; quando presente, substitui o subtítulo padrão da E1 | "Pessoa física · …" ou "Falando com X · papel" (`P:1138`) |
| `InboxNovo.tsx` | Prop `agendarAoAbrir?: boolean` (lida de `?agendar=1` em `page.tsx`); estado `abaPainel: IdAbaPainel` (volta a `"detalhes"` ao trocar de conversa) | A21 e as abas |
| `RodapeConversa.tsx` (E1) | Props `pedidoNota?: number` (cada valor novo troca para a aba Nota e foca o campo) e `aoCriarTarefa?: () => void` (ícone "Nova tarefa" do compositor, `P:427`) | "Adicionar nota" do painel e "Criar tarefa" do rodapé |
| `MenuConversa.tsx` (E1) | Item "Criar tarefa" (`P:1183`), entre "Silenciar" e "Agendar mensagem" | T14 |
| `AcoesAtendimento.tsx` (ou o arquivo para onde a E1 mover o diálogo) | `DialogoAgendar` passa a ser exportado, com props `{ atendimentoId: string; fuso: string; agendadas?: { agendadaPara: string }[]; aoFechar(): void; aoConcluir(): void }` | `?agendar=1` e Task 18 |
| `src/components/conversa/Compositor.tsx` | Export `gravarRascunhoConversa(atendimentoId: string, modo: "responder" \| "nota", texto: string): void`, que grava como `gravarRascunho` (`Compositor.tsx:41-43`) e dispara `window.dispatchEvent(new CustomEvent("conversa-rascunho", { detail: { atendimentoId } }))`; o `Compositor` relê o rascunho ao receber esse evento do seu atendimento | "Salvar rascunho" do agendamento (`P:401`) |
| `funil/ModalPerda.tsx` | Prop opcional `acao?: (input: { motivoPerda: MotivoPerda; observacao?: string }) => Promise<Resultado>`. Com ela, o modal chama `acao` e não chama `router.refresh()`; sem ela, nada muda | Perda pelo Inbox com aviso e sem refresh |
| `server/inbox/permissoes.ts` | `capacidadesPainel(u, ctx): CapacidadesPainel` (Task 1) | Uma fonte só para o que o painel mostra |
| `server/inbox/paineis.ts` | `PainelSetor` acrescenta `cabecalho?: CabecalhoPainel \| null` (Task 3); `DadosSetor` de `FINANCEIRO` e `SECRETARIA` acrescenta `matriculaId: string \| null` (Task 16) | Cabeçalho do painel e link da matrícula |
| `server/inbox/` | Arquivos novos: `aviso.ts`, `painel-detalhes.ts`, `painel-oportunidades.ts`, `painel-tarefas.ts`, `painel-atividade.ts`, `painel-abas.ts`, `itens-fio.ts`, `atalhos.ts`, `texto-aria.ts`, `acoes-painel.ts` (`"use server"`) | Consultas e ações da E2 |
| Rotas | `GET /api/inbox/atendimentos/[id]/painel/[aba]` (`aba` ∈ `detalhes`, `oportunidades`, `atividade`) e `GET /api/inbox/atendimentos/[id]/fio` | Leitura por aba e itens do fio |
| `src/app/(app)/inbox/abas/` | Além dos três arquivos do contrato: `abas-painel.ts`, `useAbaPainel.ts`, `TagsContato.tsx`, `ContatoSemNome.tsx`, `ClienteVoltou.tsx`, `BlocoB2B.tsx`, `GavetaContato.tsx`, `etapas-painel.ts`, `BarraEtapas.tsx`, `CartaoExperimental.tsx`, `OutrasOportunidades.tsx`, `TarefasOportunidade.tsx`, `AgendadasAtividade.tsx`, `AlteracoesAria.tsx` | Conteúdo das abas |
| `src/app/(app)/inbox/` | `ModalTarefa.tsx`, `quando-tarefa.ts`, `useItensFio.ts`, `atalhos-agendar.ts` | Tarefa e agendamento |
| `src/components/conversa/` | `CartaoTarefaFio.tsx`, `CartaoAgendadaFio.tsx`, `intercalar-fio.ts` e, se a E0 não entregar, `CartaoNotaFio.tsx` | Itens do fio |
| `src/lib/href-conversa.ts` | `hrefConversa(atendimentoId: string, o?: { agendar?: boolean }): string` | Atalhos de entrada |
| Modelo | `Tarefa.atendimentoId String?` com relação para `AtendimentoWhatsApp` (`tarefas Tarefa[]`) e `@@index([atendimentoId, status])` | Cartão no fio e "Conversa vinculada" (T13) |
| Tipos de domínio | `TarefaInput.atendimentoId?: string` (só na criação); `ItemHistoricoAria.atendimentoId: string \| null` | Vínculo e "Abrir conversa" no Agente |

## Dependências

- **E1 (plano `02`).** A E2 precisa de `PainelContato`, `AbasPainel`, `RodapeConversa`, `MenuConversa`, `CabecalhoConversa` e do harness de captura (`scripts/visual/demo-inbox.ts`, `scripts/visual/capturar-inbox.mjs`). Cada task diz o que usa.
- **E0 (plano `01`).** O plano `01` ainda não existe em `docs/superpowers/plans/`. O índice põe "notas visíveis" na E0. A Task 12 entrega a lista e o cartão de nota no fio **só se a E0 não os tiver entregue** (a task diz como conferir). A aba Nota no compositor vem da E1.
- **E3 e E4.** "Assumir" com pausa da Aria (D3) e o cartão de sugestão ficam na E3. Anexo, "perguntar se o contato responder", editar o texto da agendada e recorrência ficam na E4 (D11). A Task 18 entrega só a parte de UI do B6 que não depende de D11.

## Matriz das ações novas

Todas em `src/server/inbox/acoes-painel.ts` (`"use server"`). Todas começam por `exigirSessao()` e `atendimentoVisivel(u, atendimentoId)` (`whatsapp/atendimentos.ts:79`), recusam com "Atendimento não encontrado." fora do escopo e terminam com `avisarAtendimento(prisma, atendimentoId)` quando houve sucesso.

| Ação | Permissão (sem regra nova) | Domínio reaproveitado | Idempotência (#166) |
|---|---|---|---|
| `moverEtapaNoInbox(atendimentoId: string, etapa: EtapaLead): Promise<Resultado>` | `COMERCIAL`, lead do atendimento; `moverEtapaTx` exige `VENDEDOR`/`GERENTE_COMERCIAL` e escopo de carteira | `moverEtapaTx` (`crm/mover-etapa.ts:18-36`) | Por natureza: mesma etapa é `"nenhum"`, sem Evento (`etapas.ts:30`) |
| `marcarPerdidoNoInbox(atendimentoId: string, input: PerdaInput): Promise<Resultado>` | idem | `marcarPerdido` (`comercial/acoes.ts:572-602`) | Por natureza (`acoes.ts:578-585`) |
| `atribuirTagNoInbox(atendimentoId: string, tagId: string)` / `removerTagNoInbox(atendimentoId: string, tagId: string): Promise<Resultado>` | `contatos.editar`; pessoa do atendimento em `escopoPessoas` | `atribuirTag`/`removerTag` (`crm/tags.ts:126-132`) | Por natureza (`tags.ts:104`) |
| `criarEAtribuirTagNoInbox(atendimentoId: string, nome: string): Promise<Resultado<{ tagId: string }>>` | `carteira.equipe` e `contatos.editar` (as de `criarTag`, `tags.ts:39`) | `TagSchema` (`tags.ts:25-34`) e `atribuirTag` | Por natureza: nome único; tag existente é reaproveitada, `PessoaTag` existente não grava Evento |
| `editarContatoNoInbox(atendimentoId: string, input: EditarContatoInbox): Promise<Resultado>` | `contatos.editar`; pessoa do atendimento | `editarPessoa` (`crm/contatos.ts:430`), `definirValorCampo` (`crm/campos.ts:147`) | Por natureza: diff vazio e valor igual não gravam Evento (`contatos.ts:454`, `campos.ts:190`) |
| `criarTarefaNoInbox(atendimentoId: string, input: TarefaInboxInput): Promise<Resultado<{ id: string }>>` | `tarefas.ver` | `criarTarefa` (`crm/tarefas.ts:161`), `concluirTarefa` (`:276`) | Chave por envio (marca no `TarefaCriada`, `tarefas.ts:166-176`); "já foi feita" reconhece a conclusão do mesmo autor |
| `editarTarefaNoInbox`, `concluirTarefaNoInbox`, `reabrirTarefaNoInbox`, `reagendarTarefaNoInbox`, `cancelarTarefaNoInbox` | `tarefas.ver`; tarefa em `escopoTarefas` e ligada ao atendimento ou ao lead dele | `editarTarefa`, `concluirTarefa`, `reabrirTarefa`, `reagendarTarefa`, `cancelarTarefa` (`tarefas.ts:217-367`) | Versão otimista (sem garantia de repetição; tela com `idempotente: false`, como `tarefas/PainelTarefa.tsx:51-55`); cancelar é por natureza (`tarefas.ts:352-360`) |
| `desfazerAcaoAriaNoInbox(atendimentoId: string, acaoId: string): Promise<Resultado>` | `decidirHistorico` (D1: Admin e GC) e escopo (`aria/escopo-decisao.ts:35`) | `desfazerAcaoAria` (`aria/historico.ts:163-176`) | Por natureza, **nova** no domínio (Task 15) |
| `reagendarAgendadaNoInbox(atendimentoId: string, intencaoId: string, quandoLocal: string, fuso: string)` / `enviarAgoraNoInbox(atendimentoId: string, intencaoId: string): Promise<Resultado>` | `tarefas.ver` e autor ou Admin (os de `alterar`, `crm/mensagens-agendadas.ts:279-316`) | `reagendarMensagem`, `enviarAgora` (`mensagens-agendadas.ts:320-338`) | Por natureza no wrapper (Task 13) |
| `dadosModalTarefaNoInbox(atendimentoId: string): Promise<Resultado<DadosModalTarefa>>` (leitura) | `tarefas.ver` | `listarResponsaveisPossiveis` (`crm/tarefas-consulta.ts:43`) | — (só leitura) |

## Migrations

| ID | Task | Conteúdo | Estado |
|---|---|---|---|
| `20261023100000_tarefa_atendimento` | 2 | `Tarefa.atendimentoId` e FK | Entra |
| `20261023110000_tarefa_atendimento_indice` | 2 | `CREATE INDEX CONCURRENTLY` sozinho | Entra |
| `20261023120000_tarefa_prioridade_lembretes` | 20 | `PrioridadeTarefa.BAIXA` | Reservada (D10) |
| `20261023130000_tarefa_recorrencia_notificar` | 20 | recorrência e "notificar também" | Reservada (D10) |
| `20261023140000_notificacao_mencao_nota` | 19 | `TipoNotificacao.MENCAO_NOTA` | Reservada (D20) |
| `20261023150000_pessoa_cpf_nascimento` | 22 | `Pessoa.cpf`, `Pessoa.nascimento` | Reservada (D13) |
| `20261023160000_oportunidade_probabilidade_previsao` | 23 | `Oportunidade.probabilidadePct`, `previsaoFechamento` | Reservada (D13) |
| `20261023170000`–`20261023190000` | — | livres | — |

---

<a id="task-1"></a>
### Task 1: Aviso do atendimento e capacidades do painel

**Files:**
- Create: `src/server/inbox/aviso.ts`
- Modify: `src/server/inbox/permissoes.ts` (acrescenta `capacidadesPainel` no fim)
- Modify: `src/server/whatsapp/acoes-atendimento.ts:323-325` (`avisarMudancaDeEscopo` passa a chamar `avisarAtendimento`)
- Test: `src/server/inbox/aviso.int.test.ts`, `src/server/inbox/permissoes.test.ts` (casos novos)

**Interfaces:**
- Consumes: `capacidadesCrm` (`crm/permissoes.ts:50`), `capacidadesAria` (`aria/permissoes-tela.ts:27`).
- Produces:
  - `avisarAtendimento(db: Prisma.TransactionClient | typeof prisma, atendimentoId: string): Promise<void>`
  - `type CapacidadesPainel = { veLead: boolean; verContato: boolean; editarContato: boolean; editarTags: boolean; criarTag: boolean; moverEtapa: boolean; tarefas: boolean; tarefasEquipe: boolean; desfazerAria: boolean; verEmpresa: boolean; gerenciarNumeros: boolean }`
  - `capacidadesPainel(u: Pick<UsuarioSessao, "id" | "papeis">, ctx: { finalidade: Setor; veLead: boolean }): CapacidadesPainel`

- [ ] **Step 1: Write the failing tests**

```ts
// src/server/inbox/permissoes.test.ts (acrescentar)
const u = (papeis: Papel[]) => ({ id: "u1", papeis });
describe("capacidadesPainel", () => {
  it("vendedor no comercial com o lead visível edita contato, tags e etapa; não cria tag nem desfaz a Aria", () => {
    expect(capacidadesPainel(u([Papel.VENDEDOR]), { finalidade: "COMERCIAL", veLead: true })).toEqual({
      veLead: true, verContato: true, editarContato: true, editarTags: true, criarTag: false, moverEtapa: true,
      tarefas: true, tarefasEquipe: false, desfazerAria: false, verEmpresa: false, gerenciarNumeros: false });
  });
  it("sem ver o lead (LC-L02) nada do CRM é editável", () => {
    expect(capacidadesPainel(u([Papel.VENDEDOR]), { finalidade: "COMERCIAL", veLead: false }))
      .toMatchObject({ editarContato: false, editarTags: false, moverEtapa: false, desfazerAria: false, tarefas: true });
  });
  it("fora do comercial só tarefas, pela matriz do CRM (D13)", () => {
    expect(capacidadesPainel(u([Papel.FINANCEIRO]), { finalidade: "FINANCEIRO", veLead: false }))
      .toMatchObject({ tarefas: true, editarContato: false, moverEtapa: false, verEmpresa: true });
  });
  it("gerente comercial cria tag e desfaz a Aria (D1, padrão)", () => {
    expect(capacidadesPainel(u([Papel.GERENTE_COMERCIAL]), { finalidade: "COMERCIAL", veLead: true }))
      .toMatchObject({ criarTag: true, desfazerAria: true, tarefasEquipe: true });
  });
  it("professor não tem tarefas; administrador gerencia números", () => {
    expect(capacidadesPainel(u([Papel.PROFESSOR]), { finalidade: "PEDAGOGICO", veLead: false }).tarefas).toBe(false);
    expect(capacidadesPainel(u([Papel.ADMINISTRADOR]), { finalidade: "COMERCIAL", veLead: true }).gerenciarNumeros).toBe(true);
  });
});
```

```ts
// src/server/inbox/aviso.int.test.ts — escuta e cenário como em whatsapp/participantes-aviso.int.test.ts:20-36
it("avisarAtendimento publica atendimento.atualizado só com ids", async () => {
  const { a } = await cenario();
  const { r, sair } = escutar();
  await avisarAtendimento(prisma, a.id);
  await vi.waitFor(() => expect(r).toContainEqual({ tipo: "atendimento.atualizado", atendimentoId: a.id, mensagemId: null, conversaId: a.conversaId }), { timeout: 2000 });
  sair();
});
it("na transação revertida não avisa", async () => {
  const { a } = await cenario();
  const { r, sair } = escutar();
  await prisma.$transaction(async (tx) => { await avisarAtendimento(tx, a.id); throw new Error("x"); }).catch(() => {});
  await pausa(300);
  expect(r.filter((x) => x.atendimentoId === a.id)).toHaveLength(0);
  sair();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run src/server/inbox/permissoes.test.ts` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/aviso.int.test.ts`
Expected: FAIL com "capacidadesPainel is not a function" e "Cannot find module './aviso'".

- [ ] **Step 3: Implement**

`avisarAtendimento`: o mesmo `UPDATE "AtendimentoWhatsApp" SET "id" = "id" WHERE "id" = ${atendimentoId}` de `acoes-atendimento.ts:323-325`, que dispara o trigger `notificar_inbox_atendimento` (`migrations/20261017100000_inbox_tempo_real/migration.sql:38`); o NOTIFY sai no commit. `avisarMudancaDeEscopo` passa a delegar a ele. `capacidadesPainel`: `comercial = finalidade === "COMERCIAL"`; `editarContato = editarTags = comercial && veLead && crm.has("contatos.editar")`; `criarTag = editarTags && crm.has("carteira.equipe")`; `moverEtapa = comercial && veLead && crm.has("funil.mover")`; `tarefas = crm.has("tarefas.ver")`; `tarefasEquipe = crm.has("tarefas.equipe")`; `desfazerAria = comercial && veLead && capacidadesAria(u).has("decidirHistorico")`; `verContato = crm.has("contatos.ver")`; `verEmpresa` = `ADMINISTRADOR` ou `FINANCEIRO` (guard de `empresas/[id]/page.tsx:13-17`); `gerenciarNumeros` = `ADMINISTRADOR` (`P:104`).

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS. Rodar também `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/participantes-aviso.int.test.ts` (o refatoramento não muda o aviso).

- [ ] **Step 5: Commit**

```bash
git add src/server/inbox/aviso.ts src/server/inbox/aviso.int.test.ts src/server/inbox/permissoes.ts src/server/inbox/permissoes.test.ts src/server/whatsapp/acoes-atendimento.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): aviso do atendimento e capacidades do painel (E2.1)"
```

<a id="task-2"></a>
### Task 2: Vínculo da tarefa com a conversa

**Files:**
- Create: `prisma/migrations/20261023100000_tarefa_atendimento/migration.sql`, `prisma/migrations/20261023110000_tarefa_atendimento_indice/migration.sql`
- Modify: `prisma/schema.prisma` (`model Tarefa` em `:9595-9645`; `model AtendimentoWhatsApp` em `:434`)
- Modify: `src/server/crm/tarefas.ts:15-31` (`TarefaInput`), `:59` (`CriarTarefaSchema`), `:161-215` (`criarTarefa`)
- Modify: `src/server/aria/turno/executor.ts:420-443` (`case "CRIAR_TAREFA"`)
- Test: `src/server/crm/tarefa-atendimento.int.test.ts`; `src/server/aria/turno/executor-crm.int.test.ts:101-106` (caso existente)

**Interfaces:**
- Consumes: `atendimentoVisivel(usuario, id, enviar = false, db)` (`whatsapp/atendimentos.ts:79`).
- Produces: coluna `Tarefa.atendimentoId`; `TarefaInput.atendimentoId?: string` (só criação; `editarTarefa` ignora); `TarefaCriada.payload.atendimentoId: string | null`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/server/crm/tarefa-atendimento.int.test.ts — sessão trocada como em crm/criar-tarefa-idempotencia.int.test.ts:8-20;
// número e atendimento com criarNumeroSetor/garantirAtendimento (whatsapp/participantes-aviso.int.test.ts:29-36)
it("criarTarefa com atendimentoId grava o vínculo e o TarefaCriada o leva", async () => {
  const r = await criarTarefa({ titulo: "Ligar", tipo: "LIGACAO", atendimentoId: a.id, chaveIdempotencia: "k1" });
  expect(r.ok).toBe(true);
  expect(await prisma.tarefa.findUniqueOrThrow({ where: { id: r.dado!.id } })).toMatchObject({ atendimentoId: a.id });
  expect((await prisma.evento.findFirstOrThrow({ where: { tipo: "TarefaCriada", agregadoId: r.dado!.id } })).payload).toMatchObject({ atendimentoId: a.id });
});
it("atendimento fora do escopo recusa sem criar", async () => {
  sessao.usuarioId = outroVendedor.id;
  expect(await criarTarefa({ titulo: "X", tipo: "OUTRO", atendimentoId: a.id })).toEqual({ ok: false, erro: "Atendimento não encontrado." });
  expect(await prisma.tarefa.count()).toBe(0);
});
it("mesma chave com outro atendimento é conflito (#166)", async () => {
  await criarTarefa({ titulo: "Ligar", tipo: "LIGACAO", atendimentoId: a.id, chaveIdempotencia: "k2" });
  const r = await criarTarefa({ titulo: "Ligar", tipo: "LIGACAO", atendimentoId: b.id, chaveIdempotencia: "k2" });
  expect(r.ok).toBe(false);
  expect(await prisma.tarefa.count()).toBe(1);
});
it("editarTarefa não troca o atendimento", async () => {
  const { dado } = await criarTarefa({ titulo: "Ligar", tipo: "LIGACAO", atendimentoId: a.id });
  await editarTarefa(dado!.id, 1, { titulo: "Ligar de novo", atendimentoId: b.id } as never);
  expect(await prisma.tarefa.findUniqueOrThrow({ where: { id: dado!.id } })).toMatchObject({ titulo: "Ligar de novo", atendimentoId: a.id });
});
```

```ts
// executor-crm.int.test.ts:101-106 — acrescentar ao toMatchObject do caso "tarefa_com_origem_aria":
atendimentoId: c.at.id,
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/crm/tarefa-atendimento.int.test.ts src/server/aria/turno/executor-crm.int.test.ts`
Expected: FAIL (coluna inexistente).

- [ ] **Step 3: Write the migrations and the schema**

```sql
-- 20261023100000_tarefa_atendimento/migration.sql
-- Vínculo da tarefa com a conversa (Inbox E2, T13): cartão no fio e "Conversa vinculada". Nulo para as tarefas de antes.
ALTER TABLE "Tarefa" ADD COLUMN "atendimentoId" TEXT;
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "AtendimentoWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

```sql
-- 20261023110000_tarefa_atendimento_indice/migration.sql
-- CONCURRENTLY não trava escrita em "Tarefa"; é o único comando da migration porque não roda em transação.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Tarefa_atendimentoId_status_idx" ON "Tarefa"("atendimentoId", "status");
```

No schema: `atendimentoId String?`, `atendimento AtendimentoWhatsApp? @relation(fields: [atendimentoId], references: [id], onDelete: Restrict)`, `@@index([atendimentoId, status])` em `Tarefa`; `tarefas Tarefa[]` em `AtendimentoWhatsApp`. Rodar `node_modules/.bin/prisma generate`.

- [ ] **Step 4: Implement the domain**

`CriarTarefaSchema = CamposSchema.extend({ chaveIdempotencia: ..., atendimentoId: z.string().min(1).optional() })` (fica fora de `CamposSchema`, então `editarTarefa` o descarta). Em `criarTarefa`, depois da repetição e antes de `validarVinculos`: com `atendimentoId`, `atendimentoVisivel(autor, atendimentoId, false, tx)`; nulo lança `ErroRegra("Atendimento não encontrado.")`. Grava `atendimentoId` na tarefa e no payload do `TarefaCriada`. No executor da Aria, `atendimentoId` do turno (o mesmo que o `case "AGENDAR_MENSAGEM"` usa em `executor.ts:447`) vai para `tarefa.create`.

- [ ] **Step 5: Run the tests to verify they pass**

Mesmo comando, mais `src/server/crm/criar-tarefa-idempotencia.int.test.ts` e `src/server/crm/tarefas.int.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261023100000_tarefa_atendimento prisma/migrations/20261023110000_tarefa_atendimento_indice src/server/crm/tarefas.ts src/server/crm/tarefa-atendimento.int.test.ts src/server/aria/turno/executor.ts src/server/aria/turno/executor-crm.int.test.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(tarefas): vínculo da tarefa com a conversa (E2.2)"
```

<a id="task-3"></a>
### Task 3: Cabeçalho e Detalhes: consultas e rota das abas (D13)

**Files:**
- Create: `src/server/inbox/painel-detalhes.ts`, `src/server/inbox/painel-abas.ts`, `src/app/api/inbox/atendimentos/[id]/painel/[aba]/route.ts`
- Modify: `src/server/inbox/paineis.ts:8-40` (`cabecalho` no `PainelSetor`)
- Test: `src/server/inbox/painel-detalhes.int.test.ts`, `src/server/inbox/painel-detalhes.test.ts`, `src/app/api/inbox/atendimentos/[id]/painel/[aba]/route.test.ts`

**Interfaces:**
- Consumes: `capacidadesPainel` (Task 1); `podeVerLeadNaThread` (`whatsapp/consultas-inbox.ts:181`); `escopoPessoas` (`crm/pessoas.ts:32`); `camposDaPessoa` (`crm/ficha-dados.ts:21`); `tagsAtivas` (`ficha-dados.ts:40`).
- Produces (em `painel-detalhes.ts`):
  - `type TagPainel = { id: string; nome: string; cor: CorTag; ia: boolean }`
  - `type CabecalhoPainel = { pessoaId: string | null; tags: TagPainel[]; tagsDisponiveis: { id: string; nome: string; cor: CorTag }[]; subtitulo: string | null; semNome: boolean; capacidades: CapacidadesPainel }`
  - `type CampoPainel = CampoDaFicha & { ia: boolean }`
  - `type PessoaPainel = { id: string; nome: string; email: string | null; cidade: string | null; cargo: string | null; linkedin: string | null; origemCanal: OrigemCanal | null; telefone: string | null; empresa: { id: string; nome: string; documento: string | null; segmentoMercado: string | null; porte: string | null; site: string | null } | null }`
  - `type ResumoOportunidadePainel = { id: string; titulo: string; produto: string | null; valor: string | null; moeda: string | null; etapa: EtapaLead; b2b: boolean }`
  - `type BlocoB2BPainel = { empresa: { id: string; nome: string }; participantes: { pessoaId: string; nome: string; papel: PapelParticipante; cargo: string | null; naConversa: boolean; hrefConversa: string | null }[]; decisor: boolean | null }`
  - `type DetalhesPainel = { tipo: "comercial"; pessoa: PessoaPainel | null; oportunidade: ResumoOportunidadePainel | null; b2b: BlocoB2BPainel | null; campos: CampoPainel[] } | { tipo: "setor"; setor: DadosSetor }`
  - `pessoaDoAtendimento(u: UsuarioSessao, atendimentoId: string, db?: Db): Promise<{ pessoaId: string; leadId: string | null } | null>`
  - `carregarCabecalhoPainel(u: UsuarioSessao, atendimentoId: string): Promise<CabecalhoPainel | null>`
  - `carregarDetalhesPainel(u: UsuarioSessao, atendimentoId: string): Promise<DetalhesPainel | null>`
  - `subtituloContato(i: { b2b: boolean; produto: string | null; cargo: string | null; empresa: string | null; interlocutor: { nome: string; papel: PapelParticipante } | null }): string`
  - em `painel-abas.ts`: `type AbaDados = "detalhes" | "oportunidades" | "atividade"`; `carregarAbaPainel(u: UsuarioSessao, atendimentoId: string, aba: AbaDados): Promise<unknown | null>` (nesta task só `"detalhes"`; as outras lançam `ErroRegra("Aba inválida.")` até as Tasks 7 e 14)

Regras fixadas aqui:
- **Pessoa do atendimento:** só em `COMERCIAL` (D13). É a `lead.pessoaId` quando `podeVerLeadNaThread` e a pessoa não é responsável legal (regra 6, `paineis.ts:60-61`); sem lead, a `contato.pessoaId` dentro de `escopoPessoas`. Fora disso, `null`.
- **✦ da tag (D20):** `ia = PessoaTag.criadoPorId === null` (a Aria grava assim, `aria/turno/executor.ts:390`).
- **✦ do campo:** `ia = true` quando o último `CampoPersonalizadoAlterado` da pessoa para aquele `campoId` tem `autorId === null` (`executor.ts:411-416`).
- **Sem nome:** `semNome = fonteNome === "contato" && !nomeExibicao && !nomePerfil` (`whatsapp/nome-contato.ts:19-45`).
- **Telefone:** `contato.telefoneE164`, só no comercial (regra 5 cobre o pedagógico, que nem chega aqui).
- **Subtítulo** (`P:1138`): B2B com o contato entre os participantes: `Falando com <nome> · <PAPEL_PARTICIPANTE_LABEL>`; B2B sem ele: `<cargo> · <empresa>` (sem as partes nulas); B2C: `Pessoa física · <produto ?? título>`; sem oportunidade: `Pessoa física`; fora do comercial: `null` (vale o subtítulo da E1).

- [ ] **Step 1: Write the failing tests**

```ts
// src/server/inbox/painel-detalhes.test.ts
describe("subtituloContato", () => {
  it("B2C mostra produto", () => expect(subtituloContato({ b2b: false, produto: "Inglês Intensivo B1", cargo: null, empresa: null, interlocutor: null })).toBe("Pessoa física · Inglês Intensivo B1"));
  it("B2B com interlocutor", () => expect(subtituloContato({ b2b: true, produto: null, cargo: "Gerente de RH", empresa: "Grupo Ventura", interlocutor: { nome: "Rafael Nunes", papel: "DECISOR" } })).toBe("Falando com Rafael Nunes · Decisor"));
  it("B2B sem interlocutor junta cargo e empresa sem partes vazias", () => expect(subtituloContato({ b2b: true, produto: null, cargo: null, empresa: "Clínica Santa Helena", interlocutor: null })).toBe("Clínica Santa Helena"));
});
```

```ts
// src/server/inbox/painel-detalhes.int.test.ts — fixtures como inbox/paineis.int.test.ts:14-29
it("comercial: pessoa, campos e tags; ✦ só na tag sem autor (D20) e no campo da Aria", async () => {
  // pessoa com tag "Inglês" (criadoPorId null) e "Noite" (criadoPorId = vendedor); campo "Objetivo" com
  // CampoPersonalizadoAlterado autorId null e campo "Nível" com autorId = vendedor
  const c = await carregarCabecalhoPainel(sess(dono), a.id);
  expect(c!.tags).toEqual([{ id: tIngles.id, nome: "Inglês", cor: "IA", ia: true }, { id: tNoite.id, nome: "Noite", cor: "NEUTRA", ia: false }]);
  const d = await carregarDetalhesPainel(sess(dono), a.id);
  expect(d).toMatchObject({ tipo: "comercial", pessoa: { id: p.id, email: "mariana@x.com", telefone: "+5511984213307" },
    oportunidade: { id: op.id, produto: "Inglês Intensivo B1", valor: "650.00", etapa: "PROPOSTA" } });
  expect((d as { campos: CampoPainel[] }).campos.map((x) => [x.nome, x.ia])).toEqual([["Objetivo", true], ["Nível", false]]);
});
it("regra_6_e_linha_alheia_nao_carregam_pessoa", async () => {
  expect(await carregarDetalhesPainel(sess(dono), atendimentoDaMae.id)).toMatchObject({ pessoa: null, campos: [] });
  expect(await carregarCabecalhoPainel(sess(donoDaLinhaSemCarteira), a.id)).toMatchObject({ pessoaId: null, tags: [], capacidades: { veLead: false } });
});
it("fora do comercial devolve o painel do setor e nada da pessoa (D13)", async () => {
  expect(await carregarDetalhesPainel(sess(fin), atFinanceiro.id)).toEqual({ tipo: "setor", setor: expect.objectContaining({ setor: "FINANCEIRO" }) });
  expect(await carregarCabecalhoPainel(sess(fin), atFinanceiro.id)).toMatchObject({ pessoaId: null, tags: [], subtitulo: null });
});
it("contato só com telefone é sem nome", async () => {
  expect((await carregarCabecalhoPainel(sess(dono), atSemNome.id))!.semNome).toBe(true);
});
it("fora do escopo: null", async () => {
  expect(await carregarDetalhesPainel(sess(outro), a.id)).toBeNull();
  expect(await carregarCabecalhoPainel(sess(outro), a.id)).toBeNull();
});
it("carregarPainel leva o cabeçalho", async () => {
  expect(await carregarPainel(sess(dono), a.id)).toMatchObject({ cabecalho: { pessoaId: p.id } });
});
```

```ts
// route.test.ts — mesmo molde de painel/route.test.ts:1-40, com carregarAbaPainel simulado
it("aba fora da lista → 400, sem consultar", async () => {
  sessaoMock.mockResolvedValue(sessao([Papel.VENDEDOR]));
  const r = await GET(new Request("http://x"), { params: Promise.resolve({ id: "a1", aba: "insights" }) });
  expect(r.status).toBe(400);
  expect(carregarAbaPainel).not.toHaveBeenCalled();
});
it("detalhes no escopo → 200 sem cache; fora → 404", async () => { /* como painel/route.test.ts:21-36 */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run src/server/inbox/painel-detalhes.test.ts "src/app/api/inbox/atendimentos/[id]/painel/[aba]/route.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/painel-detalhes.int.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implement**

Consultas com `select` explícito (nunca o payload inteiro do Evento). `produto = oportunidade.planoPrevisto`. B2B: `oportunidade.b2b && oportunidade.empresaId`; participantes de `ParticipanteOportunidade` (`schema.prisma:9230-9240`) com `naConversa = pessoaId === pessoa.id` e `hrefConversa` preenchido na Task 17 (aqui `null`); `decisor` = papel `DECISOR` da pessoa do atendimento, `null` sem participação. `tagsDisponiveis` = `tagsAtivas()` só com `capacidades.editarTags`; senão `[]`. A rota segue `painel/route.ts:10-24`; `aba` fora de `["detalhes", "oportunidades", "atividade"]` responde 400 `{ erro: "Aba inválida." }`; `null` responde 404.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos, mais `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/paineis.int.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/inbox/painel-detalhes.ts src/server/inbox/painel-detalhes.test.ts src/server/inbox/painel-detalhes.int.test.ts src/server/inbox/painel-abas.ts src/server/inbox/paineis.ts "src/app/api/inbox/atendimentos/[id]/painel/[aba]" docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): consultas do cabeçalho e da aba Detalhes (E2.3)"
```

<a id="task-4"></a>
### Task 4: Tags e contato sem nome no cabeçalho do painel (D20)

**Files:**
- Create: `src/app/(app)/inbox/abas/TagsContato.tsx`, `src/app/(app)/inbox/abas/ContatoSemNome.tsx`, `src/server/inbox/acoes-painel.ts`
- Modify: `src/app/(app)/inbox/PainelContato.tsx` (slots do acréscimo), `src/app/(app)/inbox/InboxNovo.tsx` (passa `cabecalho` ao `PainelContato`), `src/server/crm/tags.ts:25` (exporta `TagSchema`)
- Test: `src/app/(app)/inbox/abas/TagsContato.test.ts`, `src/app/(app)/inbox/abas/ContatoSemNome.test.ts`, `src/server/inbox/acoes-painel-tags.int.test.ts`

**Interfaces:**
- Consumes: `CabecalhoPainel`, `TagPainel` (Task 3); `avisarAtendimento` (Task 1); `pessoaDoAtendimento` (Task 3); `editarNomeContatoWhatsApp({ atendimentoId, nome, nomeAnterior })` (`whatsapp/acoes.ts`, usado em `AcoesContato.tsx:114`).
- Produces:
  - `atribuirTagNoInbox(atendimentoId: string, tagId: string): Promise<Resultado>`; `removerTagNoInbox(atendimentoId: string, tagId: string): Promise<Resultado>`; `criarEAtribuirTagNoInbox(atendimentoId: string, nome: string): Promise<Resultado<{ tagId: string }>>`
  - `TagsContato(props: { atendimentoId: string; tags: TagPainel[]; disponiveis: { id: string; nome: string; cor: CorTag }[]; podeEditar: boolean; podeCriar: boolean; aoMudar(): void })`
  - `tagsParaEscolher(disponiveis, atuais: TagPainel[], busca: string): { id: string; nome: string }[]` (sem as que a pessoa já tem, filtro sem acento e sem caixa, no máximo 8)
  - `ContatoSemNome(props: { atendimentoId: string; ariaAtiva: boolean; aoMudar(): void })`

Visual (análise parte 1 §3.7): pílula de 26 px, raio 13, fundo `--surface-muted`, texto 12,5 px; ✦ = `IconSparkles` 11 px em `--ai-text` com `aria-label="Criada pela Aria"`; "+ tag" tracejado em `--border`, texto `--text-secondary`. "+ tag" abre um popover (o `Menu` não serve: tem campo de busca) com campo "Buscar tag" e a lista de `tagsParaEscolher`; com `podeCriar` e busca sem correspondência exata, o último item é `Criar tag “<busca>”`. Cada pílula da pessoa tem "×" (rótulo "Remover tag <nome>") só com `podeEditar`.

Contato sem nome (`P:479`): caixa tracejada, ícone `IconUserX`, texto `Contato sem nome, criado pelo telefone. Aria vai perguntar na conversa, ou você pode preencher agora.` quando `ariaAtiva`; sem Aria ativa, `Contato sem nome, criado pelo telefone. Você pode preencher agora.`. Campo "Nome do contato" e botão "Salvar"; vazio mostra "Digite o nome" (`P:1119`). Salva com `editarNomeContatoWhatsApp`. `ariaAtiva = painel.aria !== null && !painel.aria.pausada`.

- [ ] **Step 1: Write the failing tests**

```ts
// TagsContato.test.ts
const props = { atendimentoId: "a1", tags: [{ id: "t1", nome: "Inglês", cor: "IA" as const, ia: true }, { id: "t2", nome: "Noite", cor: "NEUTRA" as const, ia: false }],
  disponiveis: [{ id: "t1", nome: "Inglês", cor: "IA" as const }, { id: "t3", nome: "Bolsista", cor: "INFO" as const }], podeEditar: true, podeCriar: false, aoMudar: () => {} };
const h = (p = {}) => renderToStaticMarkup(createElement(TagsContato, { ...props, ...p }));
it("✦ só na tag sem autor, com rótulo acessível (D20)", () => { expect(h().match(/aria-label="Criada pela Aria"/g)).toHaveLength(1); expect(h()).toMatch(/Inglês[^<]*<svg[^>]*aria-label="Criada pela Aria"/); });
it("“+ tag” e “×” só para quem edita", () => { expect(h()).toContain("+ tag"); expect(h()).toContain('aria-label="Remover tag Noite"'); expect(h({ podeEditar: false })).not.toContain("+ tag"); expect(h({ podeEditar: false })).not.toContain("Remover tag"); });
it("sem tags e sem edição não renderiza nada", () => { expect(h({ tags: [], podeEditar: false })).toBe(""); });
it("tagsParaEscolher tira as já atribuídas e ignora acento e caixa", () => {
  expect(tagsParaEscolher(props.disponiveis, props.tags, "")).toEqual([{ id: "t3", nome: "Bolsista" }]);
  expect(tagsParaEscolher([{ id: "t4", nome: "Matrícula", cor: "NEUTRA" }], [], "MATRI")).toEqual([{ id: "t4", nome: "Matrícula" }]);
});
```

```ts
// ContatoSemNome.test.ts
it("com a Aria ativa avisa que ela vai perguntar", () => expect(h({ ariaAtiva: true })).toContain("Aria vai perguntar na conversa, ou você pode preencher agora."));
it("sem a Aria ativa não promete a pergunta", () => { const t = h({ ariaAtiva: false }); expect(t).not.toContain("Aria"); expect(t).toContain('placeholder="Nome do contato"'); });
```

```ts
// acoes-painel-tags.int.test.ts — sessão por authMock como whatsapp/participantes-aviso.int.test.ts:3-5
it("atribuir grava PessoaTag com autor, TagAtribuida e avisa o atendimento", async () => {
  const { r, sair } = escutar(); comoUsuario(dono);
  expect(await atribuirTagNoInbox(a.id, tag.id)).toEqual({ ok: true });
  expect(await prisma.pessoaTag.findUnique({ where: { pessoaId_tagId: { pessoaId: p.id, tagId: tag.id } } })).toMatchObject({ criadoPorId: dono.id });
  await vi.waitFor(() => expect(r).toContainEqual(expect.objectContaining({ tipo: "atendimento.atualizado", atendimentoId: a.id })));
  sair();
});
it("repetir a atribuição não grava outro TagAtribuida (#166 por natureza)", async () => {
  comoUsuario(dono); await atribuirTagNoInbox(a.id, tag.id); await atribuirTagNoInbox(a.id, tag.id);
  expect(await prisma.evento.count({ where: { tipo: "TagAtribuida", agregadoId: p.id } })).toBe(1);
});
it("conversa sem pessoa visível recusa e nada muda", async () => {
  comoUsuario(donoDaLinhaSemCarteira);
  expect(await atribuirTagNoInbox(a.id, tag.id)).toEqual({ ok: false, erro: "Contato não encontrado." });
});
it("gerente cria e atribui; repetir reaproveita a tag sem Evento novo", async () => {
  comoUsuario(gerente);
  const r1 = await criarEAtribuirTagNoInbox(a.id, " Bolsista ");
  const r2 = await criarEAtribuirTagNoInbox(a.id, "Bolsista");
  expect(r1.dado!.tagId).toBe(r2.dado!.tagId);
  expect(await prisma.evento.count({ where: { tipo: { in: ["TagCriada", "TagAtribuida"] } } })).toBe(2);
});
it("vendedor não cria tag nova", async () => {
  comoUsuario(dono);
  expect((await criarEAtribuirTagNoInbox(a.id, "Nova")).ok).toBe(false);
  expect(await prisma.tag.count({ where: { nome: "Nova" } })).toBe(0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/abas/TagsContato.test.ts" "src/app/(app)/inbox/abas/ContatoSemNome.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/acoes-painel-tags.int.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implement**

Os wrappers resolvem `pessoaDoAtendimento`; sem pessoa, `ErroRegra("Contato não encontrado.")`. `atribuir`/`remover` chamam `atribuirTag({ tagId, pessoaId })`/`removerTag`; resultado `ok` → `avisarAtendimento`. `criarEAtribuirTagNoInbox` exige `carteira.equipe` e `contatos.editar` (`exigirCapacidadeCrm`), valida o nome com o `TagSchema` (exportar de `tags.ts`), e numa transação: tag por nome exato (`findUnique({ where: { nome } })`); sem ela, cria com cor `NEUTRA` e grava `TagCriada` (mesmo payload de `tags.ts:46-52`), sob `comUnicidade`; depois cria a `PessoaTag` se faltar, com `TagAtribuida`. No cliente, `useAcaoCliente({ idempotente: true })` (todas são por natureza) e `aoMudar()` no sucesso.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS. Rodar `node_modules/.bin/vitest run "src/app/(app)/inbox/sem-polling.test.ts"`.

- [ ] **Step 5: Aceite visual**

No `scripts/visual/demo-inbox.ts`, o cenário "Mariana Costa" ganha as tags "Inglês" (sem autor) e "Turma noturna" (com autor), e o cenário "+55 11 98765-4321" fica sem nome. Capturar os estados `painel-detalhes` e `painel-sem-nome` nas três larguras e nos dois temas; comparar com `telas/prototipo-estado-painel-detalhes.png` e `prototipo-estado-painel-sem-nome.png`. Anexar ao PR.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/abas/TagsContato.tsx" "src/app/(app)/inbox/abas/TagsContato.test.ts" "src/app/(app)/inbox/abas/ContatoSemNome.tsx" "src/app/(app)/inbox/abas/ContatoSemNome.test.ts" "src/app/(app)/inbox/PainelContato.tsx" "src/app/(app)/inbox/InboxNovo.tsx" src/server/inbox/acoes-painel.ts src/server/inbox/acoes-painel-tags.int.test.ts src/server/crm/tags.ts scripts/visual/demo-inbox.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): tags com marca da Aria e contato sem nome no painel (E2.4, D20)"
```

<a id="task-5"></a>
### Task 5: Aba Detalhes e bloco B2B (D13)

**Files:**
- Create: `src/app/(app)/inbox/abas/AbaDetalhes.tsx`, `src/app/(app)/inbox/abas/BlocoB2B.tsx`, `src/app/(app)/inbox/abas/abas-painel.ts`, `src/app/(app)/inbox/abas/useAbaPainel.ts`
- Modify: `src/app/(app)/inbox/InboxNovo.tsx` (estado `abaPainel`, `abasDoPainel`, conteúdo da aba como `children` do `PainelContato`); `src/app/(app)/inbox/PainelSetor.tsx:10,15,21` (troca `text-muted-foreground`, classe inexistente, por `text-gray-600`, defeito da análise parte 1 §3.7)
- Test: `src/app/(app)/inbox/abas/AbaDetalhes.test.ts`, `src/app/(app)/inbox/abas/abas-painel.test.ts`

**Interfaces:**
- Consumes: `DetalhesPainel`, `CabecalhoPainel` (Task 3); `PainelSetor` (componente atual).
- Produces:
  - `abasDoPainel(finalidade: string, contadorAtividade: number): AbaPainel[]` → `COMERCIAL`: `detalhes` "Detalhes", `oportunidades` "Oportunidades", `atividade` "Atividade" (com `contador` quando > 0); demais: `detalhes`, `atividade`. `insights` fica para a E4 (D12).
  - `useAbaPainel<T>(atendimentoId: string | null, aba: AbaDados, versao: number): { dado: T | null; erro: boolean; recarregar(): void }` (busca `/api/inbox/atendimentos/<id>/painel/<aba>` sem cache; nada de intervalo)
  - `AbaDetalhes(props: { dados: DetalhesPainel; capacidades: CapacidadesPainel; aoAbrirOportunidades(): void })`
  - `BlocoB2B(props: { bloco: BlocoB2BPainel; verEmpresa: boolean })`

Conteúdo (`P:497-538`, `P:1127-1139`):
- Cartão "Oportunidade atual" (botão raio 10, `--surface-muted`, borda, `IconBriefcase` verde): linha 1 "Oportunidade atual" (11,5 px, secundária); linha 2 `<produto ?? título> · <valor> · <ETAPA_LABEL>`; valor nulo sai "Sem valor". Não tem "/mês": `valorPrevisto` não é mensal no ERP (análise parte 3 §4).
- B2B (`P:498-502`): `IconBuilding` + nome da empresa + "Ver empresa" (`/empresas/<id>`, só com `verEmpresa`); "Contatos nesta oportunidade"; cartão por participante com iniciais, nome, `<papel> · <cargo>`, "Na conversa" (borda `--brand-solid`) ou "Falar com" (link `hrefConversa`, só quando não nulo).
- Seção de contato, linhas min-h 52 com ícone 18 px: WhatsApp (`IconPhone`), E-mail (`IconMail`), Cidade (`IconMapPin`; no B2B, "Segmento" com `empresa.segmentoMercado`), "Origem do contato" (`IconSpeakerphone`, `ORIGEM_CANAL_LABEL`).
- Divisor; título 12/500 em `--brand-text`: "Perfil" (B2C) ou "Empresa" (B2B). B2C: campos personalizados (`IconSchool`), ✦ "Preenchido pela IA" quando `ia`. Sem CPF, sem Idade, sem Preferências (D13 e o ERP não tem "preferências"). B2B: Empresa, Cargo, CNPJ (`empresa.documento`), Segmento, Tamanho (`porte`), "Site / LinkedIn" (`site ?? linkedin`), "Decisor?" ("Sim"/"Não"/"—"), e depois os campos personalizados.
- Valor nulo sai "—". Link "Abrir ficha completa" (`/contatos?c=<pessoaId>`) só com `verContato` (D14).
- `tipo: "setor"`: só `<PainelSetor painel={…} />`.
- Sem pessoa no comercial: "Sem oportunidade visível para você." (texto atual de `PainelSetor.tsx:21`).

- [ ] **Step 1: Write the failing tests**

```ts
// abas-painel.test.ts
it("comercial tem três abas e o contador só aparece com alterações", () => {
  expect(abasDoPainel("COMERCIAL", 0).map((a) => a.id)).toEqual(["detalhes", "oportunidades", "atividade"]);
  expect(abasDoPainel("COMERCIAL", 2).find((a) => a.id === "atividade")).toMatchObject({ contador: 2 });
  expect(abasDoPainel("COMERCIAL", 0).find((a) => a.id === "atividade")?.contador).toBeUndefined();
});
it("fora do comercial, sem Oportunidades (D13)", () => expect(abasDoPainel("PEDAGOGICO", 0).map((a) => a.id)).toEqual(["detalhes", "atividade"]));
```

```ts
// AbaDetalhes.test.ts
const cap = { ...semNada, verContato: true, verEmpresa: false } as CapacidadesPainel;
it("B2C: oportunidade atual, contato e perfil com ✦ no campo da Aria", () => {
  const t = h(b2c);
  expect(t).toContain("Oportunidade atual");
  expect(t).toMatch(/Inglês Intensivo B1 · R\$\s650,00 · Proposta/);
  expect(t).toContain("mariana@x.com"); expect(t).toContain("Origem do contato");
  expect(t).toMatch(/Objetivo[\s\S]*aria-label="Preenchido pela IA"/);
});
it("sem CPF nem idade (D13 padrão)", () => { const t = h(b2c); expect(t).not.toContain("CPF"); expect(t).not.toContain("Idade"); });
it("campo vazio sai “—”; valor nulo sai “Sem valor”", () => { const t = h({ ...b2c, oportunidade: { ...b2c.oportunidade!, valor: null }, pessoa: { ...b2c.pessoa!, cidade: null } }); expect(t).toContain("Sem valor"); expect(t).toMatch(/>—<\/[^>]+>[\s\S]*Cidade/); });
it("B2B: empresa, CNPJ e contatos; “Na conversa” em quem fala; “Ver empresa” só com permissão", () => {
  const t = h(b2b);
  expect(t).toContain("Contatos nesta oportunidade"); expect(t).toContain("12.345.678/0001-90"); expect(t).toContain("Na conversa");
  expect(t).not.toContain("/empresas/");
  expect(h(b2b, { ...cap, verEmpresa: true })).toContain('href="/empresas/e1"');
});
it("“Abrir ficha completa” vai para /contatos?c= só para quem vê contatos", () => {
  expect(h(b2c)).toContain('href="/contatos?c=p1"');
  expect(h(b2c, { ...cap, verContato: false })).not.toContain("/contatos?c=");
});
it("fora do comercial mostra só o painel do setor", () => {
  const t = h({ tipo: "setor", setor: { setor: "PEDAGOGICO", turma: "T1", frequenciaPct: 80 } });
  expect(t).toContain("Frequência"); expect(t).not.toContain("E-mail"); expect(t).not.toMatch(/\+\d{6,}/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/abas/"`
Expected: FAIL.

- [ ] **Step 3: Implement**

`AbaDetalhes` é componente de apresentação puro (sem efeito). O `InboxNovo` usa `useAbaPainel(selecionado, "detalhes", versaoPainel)` só quando `abaPainel === "detalhes"`; troca de conversa volta `abaPainel` a `"detalhes"`; aba que sumiu de `abasDoPainel` também. O cartão chama `aoAbrirOportunidades` → `setAbaPainel("oportunidades")`. Carregando: o esqueleto da E1 para o corpo do painel; erro: "Não foi possível carregar os detalhes." com "Tentar de novo" (`recarregar`). Ações de cadastro e cobrança que hoje ficam no painel (`AcoesContato`, `OptOutContato`, `PainelAria`) continuam abaixo do conteúdo da aba Detalhes até a E3 mover o `PainelAria` (análise parte 3 §1 item 7: nada some).

- [ ] **Step 4: Run the tests to verify they pass**

Mesmo comando, mais `node_modules/.bin/vitest run "src/app/(app)/inbox/"`. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Cenários no `demo-inbox.ts`: "Mariana Costa" (B2C, campo "Objetivo" preenchido pela Aria) e "Grupo Ventura Logística" (B2B com dois participantes). Estados `painel-detalhes` e `painel-detalhes-b2b`; referência `telas/prototipo-estado-painel-detalhes.png` e a renderização do protótipo para `c2`. Diferenças justificadas: sem CPF, Idade e Preferências (D13); sem "/mês".

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/abas/AbaDetalhes.tsx" "src/app/(app)/inbox/abas/AbaDetalhes.test.ts" "src/app/(app)/inbox/abas/BlocoB2B.tsx" "src/app/(app)/inbox/abas/abas-painel.ts" "src/app/(app)/inbox/abas/abas-painel.test.ts" "src/app/(app)/inbox/abas/useAbaPainel.ts" "src/app/(app)/inbox/InboxNovo.tsx" "src/app/(app)/inbox/PainelSetor.tsx" scripts/visual/demo-inbox.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): aba Detalhes com bloco B2B (E2.5, D13)"
```

<a id="task-6"></a>
### Task 6: Gaveta de edição do contato (D14)

**Files:**
- Create: `src/app/(app)/inbox/abas/GavetaContato.tsx`
- Modify: `src/server/inbox/acoes-painel.ts` (`editarContatoNoInbox`); `src/app/(app)/inbox/InboxNovo.tsx` (`aoEditar` do `PainelContato` abre a gaveta, só com `capacidades.editarContato`)
- Test: `src/app/(app)/inbox/abas/GavetaContato.test.ts`, `src/server/inbox/acoes-painel-contato.int.test.ts`

**Interfaces:**
- Consumes: `DetalhesPainel` (Task 3); `editarPessoa` (`crm/contatos.ts:430-470`), `definirValorCampo` (`crm/campos.ts:147-215`), `validarValorCampo` (`crm/campos.ts`); `Drawer` (`components/Drawer.tsx:14`).
- Produces:
  - `type EditarContatoInbox = { pessoa?: EditarPessoaInput; campos?: { campoId: string; valor: unknown }[] }`
  - `editarContatoNoInbox(atendimentoId: string, input: EditarContatoInbox): Promise<Resultado>`
  - `diffContato(lido: FormContato, editado: FormContato): EditarContatoInbox` (só o que mudou; texto vazio vira `null`)
  - `GavetaContato(props: { atendimentoId: string; dados: Extract<DetalhesPainel, { tipo: "comercial" }>; aoFechar(): void; aoSalvo(): void })`

Regras: `Drawer` com `title="Editar contato"`, `largura="w-full max-w-none min-[700px]:w-[348px]"` (cobre a coluna do painel, como a edição no lugar do protótipo, `P:1141`). Campos: Nome, E-mail, Cidade, Cargo, LinkedIn, "Origem do contato" (select de `ORIGEM_CANAL_LABEL` com "Sem origem"), e os campos personalizados por tipo (`TEXTO` input, `NUMERO` input numérico, `DATA` date, `SELECAO` select de `opcoes`, `BOOLEANO` checkbox). Empresa fica só leitura com "Trocar a empresa na ficha completa" (`/contatos?c=`). Não há alternância B2C/B2B: o tipo vem de `Oportunidade.b2b` (análise parte 3 §5, Pessoa). Rodapé: "Cancelar" e "Salvar"; "Salvar" desabilitado sem mudança.

- [ ] **Step 1: Write the failing tests**

```ts
// GavetaContato.test.ts
it("diffContato manda só o que mudou e vazio como null", () => {
  expect(diffContato(lido, { ...lido, cidade: "Campinas", email: "" , campos: { c1: "Avançado", c2: lido.campos.c2 } }))
    .toEqual({ pessoa: { cidade: "Campinas", email: null }, campos: [{ campoId: "c1", valor: "Avançado" }] });
  expect(diffContato(lido, lido)).toEqual({});
});
it("a gaveta mostra os campos, empresa só leitura e a ficha completa", () => {
  const t = h();
  for (const r of ["Nome", "E-mail", "Cidade", "Cargo", "LinkedIn", "Origem do contato", "Objetivo"]) expect(t).toContain(r);
  expect(t).toContain("Trocar a empresa na ficha completa"); expect(t).not.toContain("B2C");
});
```

```ts
// acoes-painel-contato.int.test.ts
it("salva pessoa e campo numa chamada e avisa; repetir não grava Evento", async () => {
  comoUsuario(dono);
  const input = { pessoa: { cidade: "Campinas" }, campos: [{ campoId: nivel.id, valor: "Avançado" }] };
  expect(await editarContatoNoInbox(a.id, input)).toEqual({ ok: true });
  expect(await editarContatoNoInbox(a.id, input)).toEqual({ ok: true });
  expect(await prisma.evento.count({ where: { tipo: { in: ["PessoaEditada", "CampoPersonalizadoAlterado"] }, agregadoId: p.id } })).toBe(2);
});
it("valor inválido num campo recusa antes de gravar qualquer coisa", async () => {
  comoUsuario(dono);
  const r = await editarContatoNoInbox(a.id, { pessoa: { cidade: "Campinas" }, campos: [{ campoId: idade.id /* NUMERO */, valor: "abc" }] });
  expect(r.ok).toBe(false);
  expect((await prisma.pessoa.findUniqueOrThrow({ where: { id: p.id } })).cidade).not.toBe("Campinas");
});
it("pessoa fora do atendimento não é alcançável", async () => {
  comoUsuario(donoDaLinhaSemCarteira);
  expect(await editarContatoNoInbox(a.id, { pessoa: { cidade: "X" } })).toEqual({ ok: false, erro: "Contato não encontrado." });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/abas/GavetaContato.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/acoes-painel-contato.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`editarContatoNoInbox`: resolve `pessoaDoAtendimento`; carrega os `CampoPersonalizado` de `input.campos` e valida todos com `validarValorCampo` antes de qualquer escrita (o primeiro erro volta como `ErroRegra` com a mensagem do validador); só então `editarPessoa(pessoaId, input.pessoa)` (se houver) e `definirValorCampo` por campo, parando no primeiro `ok: false`. Sucesso → `avisarAtendimento`. Cliente: `useAcaoCliente({ idempotente: true })`; sucesso fecha a gaveta e chama `aoSalvo` (= `aoMudar`).

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estado `painel-editar-contato` (gaveta aberta sobre "Mariana Costa"); referência `telas/prototipo-estado-painel-editar-contato.png`. Diferença justificada: gaveta em vez de edição no lugar (D14) e sem alternância B2C/B2B.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/abas/GavetaContato.tsx" "src/app/(app)/inbox/abas/GavetaContato.test.ts" "src/app/(app)/inbox/InboxNovo.tsx" src/server/inbox/acoes-painel.ts src/server/inbox/acoes-painel-contato.int.test.ts scripts/visual/demo-inbox.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): gaveta de edição do contato (E2.6, D14)"
```

<a id="task-7"></a>
### Task 7: Aba Oportunidades: consulta e barra de etapas (D8)

**Files:**
- Create: `src/server/inbox/painel-oportunidades.ts`, `src/app/(app)/inbox/abas/etapas-painel.ts`, `src/app/(app)/inbox/abas/BarraEtapas.tsx`, `src/app/(app)/inbox/abas/AbaOportunidades.tsx`
- Modify: `src/server/inbox/painel-abas.ts` (caso `"oportunidades"`); `src/server/inbox/acoes-painel.ts` (`moverEtapaNoInbox`); `src/app/(app)/inbox/InboxNovo.tsx` (renderiza a aba)
- Test: `src/app/(app)/inbox/abas/etapas-painel.test.ts`, `src/app/(app)/inbox/abas/AbaOportunidades.test.ts`, `src/server/inbox/painel-oportunidades.int.test.ts`

**Interfaces:**
- Consumes: `destinoDoArraste`, `COLUNAS_FUNIL`, `DestinoArraste` (`crm/etapas.ts:6-48`); `moverEtapaTx` (`crm/mover-etapa.ts:18`); `podeVerLeadNaThread`; `capacidadesPainel`.
- Produces:
  - `type OportunidadeAtualPainel = { id: string; titulo: string; produto: string | null; valor: string | null; moeda: string | null; etapa: EtapaLead; temperatura: Temperatura; responsavel: { id: string; nome: string } | null; dataExperimental: string | null; experimentalConfirmada: boolean; professorExperimental: string | null; motivoPerda: MotivoPerda | null }`
  - `type OutraOportunidadePainel = { id: string; titulo: string; etapa: EtapaLead; valor: string | null; moeda: string | null }`
  - `type OportunidadesPainel = { atual: OportunidadeAtualPainel | null; outras: OutraOportunidadePainel[]; pessoaId: string | null }` (a Task 10 acrescenta `tarefas`)
  - `carregarOportunidadesPainel(u: UsuarioSessao, atendimentoId: string): Promise<OportunidadesPainel | null>`
  - `moverEtapaNoInbox(atendimentoId: string, etapa: EtapaLead): Promise<Resultado>`
  - `ETAPAS_BARRA: readonly EtapaLead[] = [NOVO, EM_ATENDIMENTO, QUALIFICADO, EXPERIMENTAL_AGENDADA, EXPERIMENTAL_REALIZADA, PROPOSTA, AGUARDANDO_MATRICULA, MATRICULADO]`
  - `segmentosEtapa(atual: EtapaLead): { etapa: EtapaLead; estado: "feita" | "atual" | "futura"; tom: "marca" | "perigo" | "neutro" }[]` (`NO_SHOW` marca `EXPERIMENTAL_REALIZADA` como atual com tom `perigo`; `PERDIDO` deixa todos `neutro` e `futura`)
  - `opcoesEtapa(atual: EtapaLead): { etapa: EtapaLead; rotulo: string; destino: DestinoArraste }[]` (as 10 de `COLUNAS_FUNIL`, rótulo de `ETAPA_LABEL`)
  - `AbaOportunidades(props: { dados: OportunidadesPainel; capacidades: CapacidadesPainel; atendimentoId: string; fuso: string | null; aoMudar(): void })` (as Tasks 8–10 acrescentam props)

Barra (`P:545-552`): 8 segmentos de 4 px, `gap` 3 px, raio 2; `feita`/`atual` em `--brand-solid`, `futura` em `--neutral-muted`, `perigo` em `--danger-solid`; `title` com `ETAPA_LABEL`. Abaixo, select de 34 px com as 10 etapas. Escolha (segmento ou select) por `destino.tipo`:
- `mover` → `moverEtapaNoInbox`;
- `recusar` → opção `disabled`, com o motivo em `title` e, no clique do segmento, o motivo em `FeedbackAcao`;
- `acao` `marcarPerdido` → abre o `ModalPerda` (Task 8);
- `acao` `agendarExperimental`, `enviarProposta` ou `prepararContratacao` → mensagem "Para <ação>, abra a oportunidade no funil." com link "Abrir no funil" (`/funil?o=<id>`) (D14: a ficha completa navega). Rótulos das ações: "agendar a experimental", "enviar a proposta", "preparar a contratação".
- Sem `capacidades.moverEtapa`, barra e select só leitura.

Cabeçalho da aba (`P:543-544`): "Oportunidade atual" (12/500, `--brand-text`) e "Funil Matrículas" à direita (`--text-terciary`); título 15/600 (`produto ?? titulo`); valor 17/600 com `formatarMoedaOuIndefinida`. Linhas 13 px, rótulo de 104 px (`P:1140`): Responsável (`responsavel?.nome ?? "Sem responsável"`), Temperatura (`TEMPERATURA_LABEL`, sem "score"), Produto (`produto ?? "—"`). Probabilidade fica fora (Task 23, D13).

- [ ] **Step 1: Write the failing tests**

```ts
// etapas-painel.test.ts
it("de QUALIFICADO: volta um passo, experimental e proposta por ação, pular recusa", () => {
  const o = Object.fromEntries(opcoesEtapa("QUALIFICADO").map((x) => [x.etapa, x.destino]));
  expect(o.EM_ATENDIMENTO).toEqual({ tipo: "mover" });
  expect(o.EXPERIMENTAL_AGENDADA).toEqual({ tipo: "acao", acao: "agendarExperimental" });
  expect(o.PROPOSTA).toEqual({ tipo: "acao", acao: "enviarProposta" });
  expect(o.NOVO).toEqual({ tipo: "recusar", motivo: "Avance uma etapa por vez." });
  expect(o.EXPERIMENTAL_REALIZADA).toEqual({ tipo: "recusar", motivo: "Esta etapa é registrada pelo check-in do professor." });
  expect(o.QUALIFICADO).toEqual({ tipo: "nenhum" });
});
it("opcoes_de_oportunidade_encerrada_sao_todas_recusadas", () => {
  for (const x of opcoesEtapa("MATRICULADO").filter((x) => x.etapa !== "MATRICULADO"))
    expect(x.destino).toEqual({ tipo: "recusar", motivo: "Oportunidade encerrada não volta ao funil." });
});
it("segmentos: PROPOSTA pinta até ela; NO_SHOW é perigo na realizada; PERDIDO apaga", () => {
  expect(segmentosEtapa("PROPOSTA").map((s) => s.estado)).toEqual(["feita", "feita", "feita", "feita", "feita", "atual", "futura", "futura"]);
  expect(segmentosEtapa("NO_SHOW")[4]).toEqual({ etapa: "EXPERIMENTAL_REALIZADA", estado: "atual", tom: "perigo" });
  expect(segmentosEtapa("PERDIDO").every((s) => s.tom === "neutro" && s.estado === "futura")).toBe(true);
});
```

```ts
// AbaOportunidades.test.ts
it("cabeçalho, valor, linhas e o select com opções recusadas desabilitadas", () => {
  const t = h();
  expect(t).toContain("Funil Matrículas"); expect(t).toMatch(/R\$\s650,00/);
  expect(t).toContain("Responsável"); expect(t).toContain("Temperatura"); expect(t).not.toContain("Probabilidade");
  expect(t).toMatch(/<option[^>]*value="NOVO"[^>]*disabled[^>]*title="Avance uma etapa por vez\."/);
});
it("sem permissão de mover, select desabilitado", () => expect(h({ capacidades: { ...cap, moverEtapa: false } })).toMatch(/<select[^>]*disabled/));
it("sem oportunidade visível avisa", () => expect(h({ dados: { atual: null, outras: [], pessoaId: null } })).toContain("Sem oportunidade visível para você."));
```

```ts
// painel-oportunidades.int.test.ts
it("atual com produto, valor, moeda do país, responsável e experimental", async () => {
  expect(await carregarOportunidadesPainel(sess(dono), a.id)).toMatchObject({ atual: { id: op.id, produto: "Inglês Intensivo B1", valor: "650.00", moeda: "BRL", responsavel: { id: dono.id }, dataExperimental: expect.any(String) } });
});
it("linha_alheia_sem_oportunidade", async () => {
  expect(await carregarOportunidadesPainel(sess(donoDaLinhaSemCarteira), a.id)).toMatchObject({ atual: null, outras: [] });
});
it("outras: só as da pessoa no escopo, sem a atual, mais recentes primeiro", async () => {
  expect((await carregarOportunidadesPainel(sess(dono), a.id))!.outras.map((o) => o.id)).toEqual([opGanha.id]);
});
it("moverEtapaNoInbox: um passo grava EtapaAlterada e avisa; a mesma etapa não grava; pular recusa", async () => {
  comoUsuario(dono);
  expect(await moverEtapaNoInbox(a.id, "EM_ATENDIMENTO")).toEqual({ ok: true });   // op em NOVO
  expect(await moverEtapaNoInbox(a.id, "EM_ATENDIMENTO")).toEqual({ ok: true });
  expect(await prisma.evento.count({ where: { tipo: "EtapaAlterada", agregadoId: op.id } })).toBe(1);
  expect(await moverEtapaNoInbox(a.id, "PROPOSTA")).toEqual({ ok: false, erro: "Use “Enviar proposta”." });
});
it("conversa sem oportunidade recusa", async () => {
  comoUsuario(dono);
  expect(await moverEtapaNoInbox(semLead.id, "EM_ATENDIMENTO")).toEqual({ ok: false, erro: "Esta conversa não tem oportunidade." });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/abas/etapas-painel.test.ts" "src/app/(app)/inbox/abas/AbaOportunidades.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/painel-oportunidades.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Consulta: lead do atendimento (`podeVerLeadNaThread`) com `pais.moedaLocal`, `vendedor`, `professorExperimental`; `outras` = oportunidades com o mesmo `pessoaId`, exceto a atual, dentro de `escopoComercialAtual(u)`, `orderBy: { criadoEm: "desc" }`, `take: 10`. `moverEtapaNoInbox`: resolve `atendimento.leadId` (nulo → `ErroRegra("Esta conversa não tem oportunidade.")`); numa transação, `moverEtapaTx(tx, u, leadId, etapa)` e `avisarAtendimento(tx, atendimentoId)` (NOTIFY no commit); chama `revalidatePath("/funil")`. Cliente: `useAcaoCliente({ idempotente: true })`.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estado `painel-oportunidades` (Mariana em `PROPOSTA`); referência `telas/` (renderização do protótipo, aba Oportunidades de `c1`). Diferenças justificadas: 8 segmentos em vez de 6 e o select com as 10 etapas (D8); sem probabilidade (D13).

- [ ] **Step 6: Commit**

```bash
git add src/server/inbox/painel-oportunidades.ts src/server/inbox/painel-oportunidades.int.test.ts src/server/inbox/painel-abas.ts src/server/inbox/acoes-painel.ts "src/app/(app)/inbox/abas/etapas-painel.ts" "src/app/(app)/inbox/abas/etapas-painel.test.ts" "src/app/(app)/inbox/abas/BarraEtapas.tsx" "src/app/(app)/inbox/abas/AbaOportunidades.tsx" "src/app/(app)/inbox/abas/AbaOportunidades.test.ts" "src/app/(app)/inbox/InboxNovo.tsx" scripts/visual/demo-inbox.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): aba Oportunidades com barra de etapas do funil (E2.7, D8)"
```

<a id="task-8"></a>
### Task 8: Perda, aula experimental e ações da oportunidade (D8)

**Files:**
- Create: `src/app/(app)/inbox/abas/CartaoExperimental.tsx`
- Modify: `src/app/(app)/funil/ModalPerda.tsx:27-55` (prop `acao`); `src/server/inbox/acoes-painel.ts` (`marcarPerdidoNoInbox`); `src/app/(app)/inbox/abas/AbaOportunidades.tsx` (cartão, seção de ações, modal)
- Test: `src/app/(app)/inbox/abas/CartaoExperimental.test.ts`, `src/app/(app)/inbox/abas/AbaOportunidades.test.ts` (casos novos), `src/app/(app)/funil/ModalPerda.acao.test.ts`, `src/server/inbox/acoes-painel-perda.int.test.ts`

**Interfaces:**
- Consumes: `OportunidadeAtualPainel` (Task 7); `marcarPerdido`, `PerdaInput` (`comercial/acoes.ts:572`, `comercial/schema.ts:106-115`); `ModalPerda`; `assumirAtendimento` (`whatsapp/acoes-atendimento.ts`) e `podeExecutar(u, "assumir", ctx)`.
- Produces:
  - `marcarPerdidoNoInbox(atendimentoId: string, input: PerdaInput): Promise<Resultado>`
  - `statusExperimental(o: Pick<OportunidadeAtualPainel, "etapa" | "experimentalConfirmada">): "Agendada" | "Confirmada" | "Realizada" | "Não compareceu"`
  - `CartaoExperimental(props: { oportunidade: OportunidadeAtualPainel; fuso: string | null; fusoEscola: string })`
  - `AbaOportunidades` acrescenta `podeAssumir: boolean` e `aoAssumir(): void`

Regras:
- Cartão "Aula experimental" (`P:553`) só com `dataExperimental`: `IconCalendarCheck`, título, link "Editar" (`/funil?o=<id>`), linha `<data e hora> · <professor ?? "Sem professor">`, pílula de status (`statusExperimental`: `NO_SHOW` → "Não compareceu"; `EXPERIMENTAL_REALIZADA` → "Realizada"; `experimentalConfirmada` → "Confirmada"; senão "Agendada").
- Seção de ações (`P:585-590`), botões de texto de 44 px com ícone 17 px: "Assumir conversa" (`--brand-text`, só com `podeAssumir`, chama `assumirAtendimento`; a semântica com pausa da Aria é da E3, D3) e "Marcar como perdido" (`--danger-text`, `IconThumbDown`, só quando `opcoesEtapa(etapa)` dá `acao` `marcarPerdido` e `capacidades.moverEtapa`). "Criar tarefa" e "Adicionar nota" entram na Task 13.
- "Marcar como perdido" e o destino `PERDIDO` da barra abrem o `ModalPerda` com `acao={(i) => marcarPerdidoNoInbox(atendimentoId, i)}` e `aoConcluir={aoMudar}`.

- [ ] **Step 1: Write the failing tests**

```ts
// CartaoExperimental.test.ts
it("status pela etapa e pela confirmação", () => {
  expect(statusExperimental({ etapa: "NO_SHOW", experimentalConfirmada: true })).toBe("Não compareceu");
  expect(statusExperimental({ etapa: "EXPERIMENTAL_REALIZADA", experimentalConfirmada: false })).toBe("Realizada");
  expect(statusExperimental({ etapa: "EXPERIMENTAL_AGENDADA", experimentalConfirmada: true })).toBe("Confirmada");
});
it("cartão com professor e “Editar” no funil", () => { const t = h(); expect(t).toContain("Aula experimental"); expect(t).toContain("Helena Prado"); expect(t).toContain('href="/funil?o=o1"'); });
```

```ts
// AbaOportunidades.test.ts (acrescentar)
it("perdido_some_em_oportunidade_encerrada", () => {
  expect(h()).toContain("Marcar como perdido");
  expect(h({ dados: { ...dados, atual: { ...dados.atual!, etapa: "MATRICULADO" } } })).not.toContain("Marcar como perdido");
});
it("“Assumir conversa” só com podeAssumir", () => { expect(h({ podeAssumir: false })).not.toContain("Assumir conversa"); expect(h({ podeAssumir: true })).toContain("Assumir conversa"); });
```

```ts
// ModalPerda.acao.test.ts — interação sem DOM como inbox/InboxNovo.interacao.test.ts:8-40
it("com `acao`, confirmar chama a ação recebida e não chama router.refresh", async () => { /* escolhe PRECO, confirma */
  expect(acao).toHaveBeenCalledWith({ motivoPerda: "PRECO", observacao: undefined });
  expect(refresh).not.toHaveBeenCalled();
  expect(marcarPerdidoMock).not.toHaveBeenCalled();
});
```

```ts
// acoes-painel-perda.int.test.ts
it("marca perdido com motivo, avisa, e repetir não grava outro LeadPerdido", async () => {
  comoUsuario(dono);
  expect(await marcarPerdidoNoInbox(a.id, { motivoPerda: "PRECO" })).toEqual({ ok: true });
  expect(await marcarPerdidoNoInbox(a.id, { motivoPerda: "PRECO" })).toEqual({ ok: true });
  expect(await prisma.evento.count({ where: { tipo: "LeadPerdido", agregadoId: op.id } })).toBe(1);
});
it("“Outro” sem observação recusa", async () => {
  comoUsuario(dono);
  expect((await marcarPerdidoNoInbox(a.id, { motivoPerda: "OUTRO" })).ok).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/abas/" "src/app/(app)/funil/ModalPerda.acao.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/acoes-painel-perda.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`marcarPerdidoNoInbox`: resolve `leadId` como na Task 7, chama `marcarPerdido(leadId, input)` e, com `ok`, `avisarAtendimento(prisma, atendimentoId)`. `ModalPerda`: com `acao`, `acao.executar(() => acao(input))` e, no `ok`, só `aoConcluir?.()` e `aoFechar()`.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos, mais `node_modules/.bin/vitest run "src/app/(app)/funil/"`. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estados `painel-oportunidades` (com experimental realizada) e `perda` (modal aberto pelo painel); referência: aba Oportunidades de `c1` no protótipo (o modal de perda não existe lá, `P:589` sem ação: comparar com o `ModalPerda` do funil).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/abas/CartaoExperimental.tsx" "src/app/(app)/inbox/abas/CartaoExperimental.test.ts" "src/app/(app)/inbox/abas/AbaOportunidades.tsx" "src/app/(app)/inbox/abas/AbaOportunidades.test.ts" "src/app/(app)/funil/ModalPerda.tsx" "src/app/(app)/funil/ModalPerda.acao.test.ts" src/server/inbox/acoes-painel.ts src/server/inbox/acoes-painel-perda.int.test.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): perda, experimental e ações da oportunidade no painel (E2.8, D8)"
```

<a id="task-9"></a>
### Task 9: Outras oportunidades, nova oportunidade e cliente que volta (D18)

**Files:**
- Create: `src/app/(app)/inbox/abas/OutrasOportunidades.tsx`, `src/app/(app)/inbox/abas/ClienteVoltou.tsx`
- Modify: `src/server/inbox/painel-detalhes.ts` (`clienteVoltou` no `CabecalhoPainel`); `src/app/(app)/inbox/abas/AbaOportunidades.tsx`; `src/app/(app)/inbox/InboxNovo.tsx` (`slotAviso`); `src/app/(app)/funil/page.tsx:20-40` e `src/app/(app)/funil/FunilCliente.tsx:52,196` (`?nova=<pessoaId>`)
- Test: `src/app/(app)/inbox/abas/OutrasOportunidades.test.ts`, `src/app/(app)/inbox/abas/ClienteVoltou.test.ts`, `src/server/inbox/cliente-voltou.int.test.ts`, `src/app/(app)/funil/page.test.ts` (caso novo)

**Interfaces:**
- Consumes: `OutraOportunidadePainel` (Task 7); `vincularContatoWhatsApp({ contatoId, alvo: { tipo: "lead", id }, atendimentoId })` (`whatsapp/acoes.ts:466-523`); `NovaOportunidade` com `preenchido={{ pessoaId, nome }}` (`funil/NovaOportunidade.tsx:41-47`, já usado por `contatos/FichaContato.tsx:459`).
- Produces:
  - `CabecalhoPainel.clienteVoltou: { oportunidadeId: string; titulo: string; situacao: "ganha" | "perdida"; contatoId: string; podeVincular: boolean } | null`
  - `situacaoOutra(etapa: EtapaLead): string` → `MATRICULADO` "Ganha", `PERDIDO` "Perdida", demais `<ETAPA_LABEL> · em aberto`
  - `hrefNovaOportunidade(pessoaId: string): string` → `/funil?nova=<pessoaId>`
  - `ClienteVoltou(props: { atendimentoId: string; nome: string; dado: NonNullable<CabecalhoPainel["clienteVoltou"]>; podeCriar: boolean; pessoaId: string; aoMudar(): void })`

Regras:
- **Cliente que voltou (D18, padrão "reaproveitar"):** só em `COMERCIAL`, atendimento sem `leadId`, e a pessoa do contato (`contato.pessoaId`, em `escopoPessoas`) com uma oportunidade `MATRICULADO` ou `PERDIDO` visível; vale a mais recente. Texto (`P:1124`): `<primeiro nome> já é cliente e voltou a escrever. A oportunidade <título> foi <ganha|perdida>.` Botões: "Vincular a <título até o primeiro “ · ”>" (primário, só com `podeVincular` = telefone da oportunidade igual ao do contato e oportunidade no escopo, a regra de `whatsapp/acoes.ts:496-501`) e "Criar nova oportunidade" (secundário, link `hrefNovaOportunidade`, só com `capacidades.moverEtapa`). A pergunta "é um novo interesse?" do protótipo fica fora até D18.
- **Outras oportunidades** (`P:577-581`): título "Outras oportunidades deste contato" + "Ver no contato" (`/contatos?c=<pessoaId>`, só com `verContato`); linhas em `--surface-muted` com `IconBriefcase`, título, `situacaoOutra` e valor mono à direita; vazio: "Nenhuma outra. Rematrícula ou novo curso geram uma nova oportunidade."; botão tracejado "Nova oportunidade" (link `hrefNovaOportunidade`, só com `moverEtapa` e `pessoaId`).
- **Funil `?nova=<pessoaId>`:** a página lê `nova`, busca a pessoa com `escopoPessoas(usuario)` e, achando, abre `NovaOportunidade` com `preenchido={{ pessoaId, nome }}`; fora do escopo, ignora o parâmetro (sem erro).

- [ ] **Step 1: Write the failing tests**

```ts
// cliente-voltou.int.test.ts
it("conversa sem lead de pessoa com oportunidade ganha mostra o cartão", async () => {
  expect((await carregarCabecalhoPainel(sess(dono), semLead.id))!.clienteVoltou).toEqual({ oportunidadeId: ganha.id, titulo: "Francês A1 · Semestral", situacao: "ganha", contatoId: ct.id, podeVincular: true });
});
it("conversa com lead, pessoa sem oportunidade encerrada ou fora do comercial: null", async () => {
  for (const id of [comLead.id, semHistorico.id, financeiro.id]) expect((await carregarCabecalhoPainel(sess(dono), id))?.clienteVoltou ?? null).toBeNull();
});
it("telefone diferente não deixa vincular", async () => {
  expect((await carregarCabecalhoPainel(sess(dono), outroTelefone.id))!.clienteVoltou).toMatchObject({ podeVincular: false });
});
```

```ts
// ClienteVoltou.test.ts
it("texto do protótipo e os dois caminhos", () => {
  const t = h();
  expect(t).toContain("Fernanda já é cliente e voltou a escrever. A oportunidade Francês A1 · Semestral foi ganha.");
  expect(t).toContain("Vincular a Francês A1"); expect(t).toContain('href="/funil?nova=p8"');
  expect(t).not.toContain("novo interesse");
});
it("sem podeVincular não oferece o vínculo", () => expect(h({ dado: { ...dado, podeVincular: false } })).not.toContain("Vincular a"));
// OutrasOportunidades.test.ts
it("situação, valor e o vazio", () => {
  expect(situacaoOutra("MATRICULADO")).toBe("Ganha"); expect(situacaoOutra("QUALIFICADO")).toBe("Qualificado · em aberto");
  expect(h({ outras: [] })).toContain("Nenhuma outra. Rematrícula ou novo curso geram uma nova oportunidade.");
});
```

```ts
// funil/page.test.ts (acrescentar, no molde dos casos existentes)
it("?nova=<pessoa no escopo> abre a nova oportunidade preenchida; fora do escopo ignora", async () => { /* ... */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/abas/" "src/app/(app)/funil/page.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/cliente-voltou.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`ClienteVoltou` chama `vincularContatoWhatsApp` com `useAcaoCliente({ idempotente: false })` (a action não tem garantia de repetição) e, no `ok`, `aoMudar()`. Não precisa de `avisarAtendimento`: o `garantirAtendimento` da action (`whatsapp/acoes.ts:507`) já grava `leadId` no atendimento, e o UPDATE dispara o aviso. No `FunilCliente`, o estado `novo` nasce `true` quando a página manda `preenchidoNova`.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estados `painel-cliente-voltou` (cenário "Fernanda Rocha", `c8`) e `painel-oportunidades` com uma oportunidade ganha antiga; referência `telas/prototipo-estado-painel-cliente-voltou.png`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/abas/OutrasOportunidades.tsx" "src/app/(app)/inbox/abas/OutrasOportunidades.test.ts" "src/app/(app)/inbox/abas/ClienteVoltou.tsx" "src/app/(app)/inbox/abas/ClienteVoltou.test.ts" "src/app/(app)/inbox/abas/AbaOportunidades.tsx" "src/app/(app)/inbox/InboxNovo.tsx" src/server/inbox/painel-detalhes.ts src/server/inbox/cliente-voltou.int.test.ts "src/app/(app)/funil/page.tsx" "src/app/(app)/funil/FunilCliente.tsx" "src/app/(app)/funil/page.test.ts" scripts/visual/demo-inbox.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): outras oportunidades, nova oportunidade e cliente que volta (E2.9, D18)"
```

<a id="task-10"></a>
### Task 10: Tarefas da oportunidade: lista e ações (D10)

**Files:**
- Create: `src/server/inbox/painel-tarefas.ts`, `src/app/(app)/inbox/abas/TarefasOportunidade.tsx`, `src/app/(app)/inbox/quando-tarefa.ts`
- Modify: `src/server/inbox/painel-oportunidades.ts` (`tarefas`); `src/server/inbox/acoes-painel.ts` (`concluirTarefaNoInbox`, `reabrirTarefaNoInbox`, `reagendarTarefaNoInbox`, `cancelarTarefaNoInbox`); `src/app/(app)/inbox/abas/AbaOportunidades.tsx`
- Test: `src/app/(app)/inbox/quando-tarefa.test.ts`, `src/app/(app)/inbox/abas/TarefasOportunidade.test.ts`, `src/server/inbox/acoes-painel-tarefas.int.test.ts`

**Interfaces:**
- Consumes: `escopoTarefas` (`crm/tarefas.ts:73`); `grupoDaTarefa` (`crm/tarefas-regras.ts:17`); `dataCivilInstitucional` (`operacao/fuso.ts:86`); `somarDiasDataCivil` (`tarefas-regras.ts:7`); as ações de `crm/tarefas.ts:276-367`.
- Produces:
  - `type TarefaPainel = { id: string; versao: number; titulo: string; descricao: string | null; tipo: TipoTarefa; status: StatusTarefa; prioridade: PrioridadeTarefa; dataCivil: string | null; hora: string | null; fusoOrigem: string; lembreteAntecedenciaMin: number | null; responsavel: { id: string; nome: string } | null; atrasada: boolean; ia: boolean; leadId: string | null; atendimentoId: string | null; criadoEm: string; criadorNome: string | null; podeAgir: boolean }`
  - `carregarTarefasDoAtendimento(u: UsuarioSessao, a: { id: string; leadId: string | null }, agora?: Date): Promise<TarefaPainel[]>` (abertas, mais as 5 concluídas mais recentes; sem canceladas)
  - `OportunidadesPainel.tarefas: TarefaPainel[]` e `OportunidadesPainel.fusoEscola: string`
  - `type AtalhoQuando = "hoje18" | "amanha9" | "amanha14" | "seg9"`
  - `quandoDoAtalho(atalho: AtalhoQuando, agora: Date, fusoEscola: string): { dataCivil: string; hora: string } | null` (`null` para "hoje18" depois das 18:00 na escola)
  - `rotuloAtalho(atalho: AtalhoQuando): string` → "Hoje 18:00", "Amanhã 09:00", "Amanhã 14:00", "Segunda 09:00"
  - `concluirTarefaNoInbox(atendimentoId: string, tarefaId: string, versao: number): Promise<Resultado>`; `reabrirTarefaNoInbox(…, versao)`; `reagendarTarefaNoInbox(atendimentoId, tarefaId, versao, q: { dataCivil: string | null; hora: string | null })`; `cancelarTarefaNoInbox(atendimentoId, tarefaId, versao, motivo: string)`
  - `TarefasOportunidade(props: { atendimentoId: string; tarefas: TarefaPainel[]; fusoEscola: string; fuso: string | null; podeCriar: boolean; aoNova(): void; aoEditar(t: TarefaPainel): void; aoMudar(): void })`

Regras:
- Tarefa pertence ao atendimento quando `atendimentoId === a.id` ou (`a.leadId` e `leadId === a.leadId`), sempre dentro de `escopoTarefas(u, tarefas.equipe)`. Os wrappers recusam com "Tarefa não encontrada." o que não pertence.
- `ia = origem in ["IA", "IA_SUGERIDA"]`; `atrasada = grupoDaTarefa(…) === "ATRASADAS"`; `hora` no `fusoOrigem`.
- Lista (`P:559-576`): "Tarefas · <n> aberta(s)" + "+ Nova tarefa" (só com `podeCriar`). Linha: caixa 18 px (concluir/reabrir, `title` "Concluir"/"Reabrir"), título 13,5 px (riscado se concluída), meta 12 px `<prazo> · <responsável> · <TIPO_TAREFA_LABEL>` em `--danger-text` se atrasada, ✦ "Criada pela IA"; com a tarefa aberta, ícones "Reagendar para amanhã 09:00" (`IconCalendarTime`), "Editar" (`IconPencil`) e "Cancelar tarefa" (`IconTrash`). Vazio: "Nenhuma tarefa para esta oportunidade."
- "Cancelar tarefa" (D10, no lugar de "Excluir"): `Modal` "Cancelar tarefa" com campo "Motivo" obrigatório (até 500) e botão perigo "Cancelar tarefa".
- Erro de versão ("Esta tarefa foi alterada por outra pessoa. Recarregue.") mostra a mensagem e chama `aoMudar()` para recarregar.

- [ ] **Step 1: Write the failing tests**

```ts
// quando-tarefa.test.ts — fuso da escola "America/Sao_Paulo"
const sp = "America/Sao_Paulo";
it("amanhã 9h e 14h no dia civil da escola, mesmo com UTC já no dia seguinte", () => {
  const agora = new Date("2026-10-22T02:30:00Z"); // 21/10 23:30 em SP
  expect(quandoDoAtalho("amanha9", agora, sp)).toEqual({ dataCivil: "2026-10-22", hora: "09:00" });
  expect(quandoDoAtalho("amanha14", agora, sp)).toEqual({ dataCivil: "2026-10-22", hora: "14:00" });
});
it("hoje 18h some depois das 18h na escola", () => {
  expect(quandoDoAtalho("hoje18", new Date("2026-10-22T20:00:00Z"), sp)).toEqual({ dataCivil: "2026-10-22", hora: "18:00" }); // 17:00 SP
  expect(quandoDoAtalho("hoje18", new Date("2026-10-22T21:00:00Z"), sp)).toBeNull(); // 18:00 SP
});
it("segunda 9h numa segunda vai para a próxima", () => {
  expect(quandoDoAtalho("seg9", new Date("2026-10-26T12:00:00Z"), sp)).toEqual({ dataCivil: "2026-11-02", hora: "09:00" }); // 26/10 é segunda
  expect(quandoDoAtalho("seg9", new Date("2026-10-22T12:00:00Z"), sp)).toEqual({ dataCivil: "2026-10-26", hora: "09:00" });
});
```

```ts
// TarefasOportunidade.test.ts
it("contagem, atraso em perigo, ✦ da IA e ações só na aberta", () => {
  const t = h();
  expect(t).toContain("Tarefas · 1 aberta(s)");
  expect(t).toMatch(/text-danger[^"]*"[^>]*>[^<]*Ontem/);
  expect(t).toContain('aria-label="Criada pela IA"');
  expect(t.match(/title="Reagendar para amanhã 09:00"/g)).toHaveLength(1);
  expect(t).not.toContain("Excluir");
});
it("vazio", () => expect(h({ tarefas: [] })).toContain("Nenhuma tarefa para esta oportunidade."));
```

```ts
// acoes-painel-tarefas.int.test.ts
it("concluir tarefa do lead do atendimento e avisar", async () => {
  comoUsuario(dono);
  expect(await concluirTarefaNoInbox(a.id, t.id, 1)).toEqual({ ok: true });
  expect(await prisma.tarefa.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({ status: "CONCLUIDA" });
});
it("versao_antiga_recusa_e_nao_grava", async () => {
  comoUsuario(dono);
  await reagendarTarefaNoInbox(a.id, t.id, 1, { dataCivil: "2026-10-23", hora: "09:00" });
  expect(await concluirTarefaNoInbox(a.id, t.id, 1)).toEqual({ ok: false, erro: "Esta tarefa foi alterada por outra pessoa. Recarregue." });
  expect((await prisma.tarefa.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("ABERTA");
});
it("tarefa de outro lead não pertence ao atendimento", async () => {
  comoUsuario(dono);
  expect(await concluirTarefaNoInbox(a.id, deOutroLead.id, 1)).toEqual({ ok: false, erro: "Tarefa não encontrada." });
});
it("cancelar com motivo repetido não grava outro TarefaCancelada", async () => {
  comoUsuario(dono);
  await cancelarTarefaNoInbox(a.id, t.id, 1, "Cliente pediu"); await cancelarTarefaNoInbox(a.id, t.id, 1, "Cliente pediu");
  expect(await prisma.evento.count({ where: { tipo: "TarefaCancelada", agregadoId: t.id } })).toBe(1);
});
it("carregarTarefasDoAtendimento: abertas, 5 concluídas mais recentes, sem canceladas, com ia", async () => { /* ... */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/quando-tarefa.test.ts" "src/app/(app)/inbox/abas/TarefasOportunidade.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/acoes-painel-tarefas.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Os wrappers carregam a tarefa (`findFirst` com `escopoTarefas` e a regra de pertença), chamam a ação de domínio de mesmo nome e, com `ok`, `avisarAtendimento`. O fuso da escola vem de `carregarFusoInstitucionalTx` (`operacao/relogio.ts`) e vai em `OportunidadesPainel.fusoEscola`. No cliente, `useAcaoCliente({ idempotente: false })` para concluir, reabrir e reagendar; `{ idempotente: true }` para cancelar.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estado `painel-oportunidades-tarefas` (Mariana com uma tarefa aberta atrasada, uma da Aria e uma concluída); referência `telas/` do protótipo, aba Oportunidades com tarefas (`prototipo-estado-painel-oportunidades-tarefas.png` do conjunto completo, renderizada pelo script). Diferença justificada: lixeira vira "Cancelar tarefa" com motivo (D10).

- [ ] **Step 6: Commit**

```bash
git add src/server/inbox/painel-tarefas.ts src/server/inbox/painel-oportunidades.ts src/server/inbox/acoes-painel.ts src/server/inbox/acoes-painel-tarefas.int.test.ts "src/app/(app)/inbox/quando-tarefa.ts" "src/app/(app)/inbox/quando-tarefa.test.ts" "src/app/(app)/inbox/abas/TarefasOportunidade.tsx" "src/app/(app)/inbox/abas/TarefasOportunidade.test.ts" "src/app/(app)/inbox/abas/AbaOportunidades.tsx" scripts/visual/demo-inbox.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): tarefas da oportunidade no painel (E2.10, D10)"
```

<a id="task-11"></a>
### Task 11: Modal de tarefa: criar e editar (D10)

**Files:**
- Create: `src/app/(app)/inbox/ModalTarefa.tsx`
- Modify: `src/server/inbox/acoes-painel.ts` (`criarTarefaNoInbox`, `editarTarefaNoInbox`, `dadosModalTarefaNoInbox`); `src/app/(app)/inbox/InboxNovo.tsx` (estado `modalTarefa: null | { tipo: "nova" } | { tipo: "editar"; tarefa: TarefaPainel }`); `src/app/(app)/inbox/abas/AbaOportunidades.tsx` (`aoNova`, `aoEditar`)
- Test: `src/app/(app)/inbox/ModalTarefa.test.ts`, `src/server/inbox/acoes-painel-criar-tarefa.int.test.ts`

**Interfaces:**
- Consumes: `quandoDoAtalho`, `rotuloAtalho`, `TarefaPainel` (Task 10); `criarTarefa`, `editarTarefa` (`crm/tarefas.ts:161,217`), `TarefaInput` com `atendimentoId` (Task 2); `listarResponsaveisPossiveis` (`crm/tarefas-consulta.ts:43`); `camposAlterados` (`tarefas/edicao.ts`, usado em `PainelTarefa.tsx:91`).
- Produces:
  - `type TarefaInboxInput = { titulo: string; tipo: TipoTarefa; descricao?: string; dataCivil: string | null; hora: string | null; prioridade?: PrioridadeTarefa; lembreteAntecedenciaMin?: 0 | 10 | 30 | 60 | null; responsavelId?: string | null; vincularOportunidade: boolean; jaFeita?: boolean; chaveIdempotencia: string }`
  - `criarTarefaNoInbox(atendimentoId: string, input: TarefaInboxInput): Promise<Resultado<{ id: string }>>`
  - `editarTarefaNoInbox(atendimentoId: string, tarefaId: string, versao: number, input: Partial<TarefaInput>): Promise<Resultado>`
  - `type DadosModalTarefa = { contatoNome: string; oportunidade: { id: string; titulo: string } | null; responsaveis: { id: string; nome: string }[]; fusoEscola: string; usuarioId: string }`
  - `dadosModalTarefaNoInbox(atendimentoId: string): Promise<Resultado<DadosModalTarefa>>`
  - `validarTarefaModal(v: { titulo: string; dataCivil: string | null; hora: string | null; lembrete: number | null }): string | null`
  - `ModalTarefa(props: { atendimentoId: string; modo: { tipo: "nova" } | { tipo: "editar"; tarefa: TarefaPainel }; fuso: string | null; aoFechar(): void; aoSalvo(): void })`

Conteúdo (`P:680-735`, só os campos atuais, D10): `Modal` (folha no celular) com título "Nova tarefa" ou "Editar tarefa". Contexto: chip com avatar e nome do contato e "Conversa vinculada" (`IconMessageCircle`). Campo título 17/500 sem borda, sublinhado 2 px (`--brand-solid`, ou `--danger-solid` depois de tentar salvar vazio), placeholder "O que precisa ser feito?". "Tipo": chips WhatsApp, Ligação, E-mail, Reunião, Outro (`TIPO_TAREFA_LABEL`, ícones `IconMessageCircle`, `IconPhone`, `IconMail`, `IconCalendar`, `IconCircleDot`); padrão WhatsApp. "Quando": chips dos quatro atalhos (o desabilitado quando `quandoDoAtalho` é `null`) + data + hora, com a legenda do fuso da escola; padrão "Amanhã 09:00"; na edição, o prazo atual vem como chip selecionado "<data> · <hora>" (`P:1064`). "Responsável": "Você" + `responsaveis` (só aparece com equipe). "Lembrete": Sem lembrete, Na hora, 10 min antes, 30 min antes, 1 h antes (valores de `tarefas.ts:51`; padrão "Sem lembrete"). "Descrição" (opcional, 2000). "Vincular à oportunidade" (marcado por padrão quando há oportunidade; mostra o título; some sem oportunidade). "Mais opções": só "Prioridade" com Normal e Alta. Rodapé: "Já foi feita" (só na criação), "Cancelar tarefa" (só na edição, abre o motivo da Task 10), "Cancelar" e "Criar tarefa"/"Salvar"; o botão fica cinza com título vazio e, clicado, mostra "Dê um título para a tarefa".

- [ ] **Step 1: Write the failing tests**

```ts
// ModalTarefa.test.ts
it("validação", () => {
  expect(validarTarefaModal({ titulo: "  ", dataCivil: "2026-10-23", hora: "09:00", lembrete: null })).toBe("Dê um título para a tarefa");
  expect(validarTarefaModal({ titulo: "Ligar", dataCivil: null, hora: null, lembrete: 10 })).toBe("O lembrete exige data e horário.");
  expect(validarTarefaModal({ titulo: "Ligar", dataCivil: "2026-10-23", hora: "09:00", lembrete: 10 })).toBeNull();
});
it("só os campos atuais do ERP (D10)", () => {
  const t = h({ modo: { tipo: "nova" } }, dados);
  for (const r of ["Sem lembrete", "Na hora", "10 min antes", "30 min antes", "1 h antes", "Conversa vinculada", "Vincular à oportunidade", "Já foi feita"]) expect(t).toContain(r);
  for (const r of ["15 min antes", "1 dia antes", "Repetir", "Notificar também", "Baixa"]) expect(t).not.toContain(r);
});
it("edição: sem “Já foi feita”, com “Cancelar tarefa” e o prazo atual como chip", () => {
  const t = h({ modo: { tipo: "editar", tarefa } }, dados);
  expect(t).not.toContain("Já foi feita"); expect(t).toContain("Cancelar tarefa"); expect(t).toContain("23/10 · 09:00");
});
```

```ts
// acoes-painel-criar-tarefa.int.test.ts
it("cria ligada à conversa, ao lead e à pessoa; avisa", async () => {
  comoUsuario(dono);
  const r = await criarTarefaNoInbox(a.id, { ...base, vincularOportunidade: true, chaveIdempotencia: "k1" });
  expect(await prisma.tarefa.findUniqueOrThrow({ where: { id: r.dado!.id } })).toMatchObject({ atendimentoId: a.id, leadId: op.id, pessoaId: p.id, criadorId: dono.id });
});
it("sem vincular, leadId nulo e atendimentoId mantido", async () => { /* … */ });
it("mesma chave devolve a mesma tarefa (#166)", async () => {
  comoUsuario(dono);
  const r1 = await criarTarefaNoInbox(a.id, { ...base, vincularOportunidade: true, chaveIdempotencia: "k2" });
  const r2 = await criarTarefaNoInbox(a.id, { ...base, vincularOportunidade: true, chaveIdempotencia: "k2" });
  expect(r2.dado!.id).toBe(r1.dado!.id); expect(await prisma.tarefa.count()).toBe(1);
});
it("já foi feita conclui; repetir com a mesma chave não falha nem conclui de novo", async () => {
  comoUsuario(dono);
  const i = { ...base, vincularOportunidade: true, jaFeita: true, chaveIdempotencia: "k3" };
  expect((await criarTarefaNoInbox(a.id, i)).ok).toBe(true); expect((await criarTarefaNoInbox(a.id, i)).ok).toBe(true);
  expect(await prisma.evento.count({ where: { tipo: "TarefaConcluida" } })).toBe(1);
});
it("professor (sem tarefas.ver) recusa", async () => { /* … */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/ModalTarefa.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/acoes-painel-criar-tarefa.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`criarTarefaNoInbox`: `atendimentoVisivel`; `leadId = vincularOportunidade && podeVerLeadNaThread ? a.leadId : undefined`; `pessoaId` de `pessoaDoAtendimento` quando houver; chama `criarTarefa({ …campos, atendimentoId, leadId, pessoaId, chaveIdempotencia })`. Com `jaFeita`: relê a tarefa; `ABERTA` → `concluirTarefa(id, versao)`; `CONCLUIDA` com `concluidaPorId === u.id` → ok sem nova chamada. `avisarAtendimento` no fim. Na tela, `useChaveIdempotencia()` + `useAcaoCliente({ idempotente: true })` na criação (`PainelTarefa.tsx:51-55`), `{ idempotente: false }` na edição; a edição manda só `camposAlterados`. Dados do modal carregados na abertura por `dadosModalTarefaNoInbox`.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estados `tarefa-nova` e `tarefa-editar`; referências `telas/prototipo-estado-tarefa-nova.png` e `prototipo-estado-tarefa-editar.png`. Diferenças justificadas (D10): lembretes do ERP, sem Repetir, sem "Notificar também", sem Baixa, "Cancelar tarefa" no lugar de "Excluir", sem "Enviar mensagem nesta data" (Task 21).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/ModalTarefa.tsx" "src/app/(app)/inbox/ModalTarefa.test.ts" "src/app/(app)/inbox/InboxNovo.tsx" "src/app/(app)/inbox/abas/AbaOportunidades.tsx" src/server/inbox/acoes-painel.ts src/server/inbox/acoes-painel-criar-tarefa.int.test.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): modal de tarefa para criar e editar (E2.11, D10)"
```

<a id="task-12"></a>
### Task 12: Itens do fio: consulta, rota e notas (B2)

**Files:**
- Create: `src/server/inbox/itens-fio.ts`, `src/app/api/inbox/atendimentos/[id]/fio/route.ts`, `src/components/conversa/intercalar-fio.ts`, `src/app/(app)/inbox/useItensFio.ts`
- Create (só se a E0 não entregou, ver Step 0): `src/components/conversa/CartaoNotaFio.tsx`
- Modify: `src/server/whatsapp/acoes-conversa.ts:47-63` (`notasDoAtendimento` delega a `listarNotasDoAtendimento`); a thread (`ConversaAberta.tsx:146-160` ou o arquivo da thread da E1) passa a renderizar `ItemFio`
- Test: `src/server/inbox/itens-fio.int.test.ts`, `src/components/conversa/intercalar-fio.test.ts`, `src/app/api/inbox/atendimentos/[id]/fio/route.test.ts`, `src/components/conversa/CartaoNotaFio.test.ts` (se criado)

**Interfaces:**
- Consumes: `NotaInternaThread` (`whatsapp/consultas-inbox.ts:46`); `TarefaPainel`, `carregarTarefasDoAtendimento` (Task 10); `MensagemThread`.
- Produces:
  - `listarNotasDoAtendimento(u: UsuarioSessao, atendimentoId: string): Promise<NotaInternaThread[]>` (a consulta de `acoes-conversa.ts:52-62`, com as notas arquivadas fora; até 50)
  - `type AgendadaFio = { id: string; texto: string; agendadaPara: string; criadaEm: string; autor: { tipo: "voce" } | { tipo: "aria" } | { tipo: "pessoa"; nome: string }; podeAlterar: boolean }`
  - `type ItensFio = { notas: NotaInternaThread[]; tarefas: TarefaPainel[]; agendadas: AgendadaFio[] }`
  - `carregarItensFio(u: UsuarioSessao, atendimentoId: string): Promise<ItensFio | null>`
  - `type ItemFio = { tipo: "mensagem"; m: MensagemThread } | { tipo: "nota"; n: NotaInternaThread } | { tipo: "tarefa"; t: TarefaPainel } | { tipo: "agendada"; a: AgendadaFio }`
  - `intercalarFio(mensagens: MensagemThread[], itens: ItensFio, o: { temMaisAntes: boolean }): ItemFio[]`
  - `useItensFio(atendimentoId: string | null, aviso: AvisoInbox | null): { itens: ItensFio; recarregar(): void }`

Regras:
- `tarefas` do fio: só as com `atendimentoId === id` (não as do lead), em `escopoTarefas`, de qualquer status; `podeAgir` só para abertas.
- `agendadas`: `IntencaoMensagem` do atendimento com `agendadaPara`, status `PENDENTE`/`ADIADA`, `passo` e `passoComercial` nulos (filtro de `consultas-acoes-atendimento.ts:60`), de qualquer autor; `autor`: `voce` quando `autorId === u.id`, `aria` quando `origem === "IA"`, senão o nome; `podeAlterar = autorId === u.id || ADMINISTRADOR`.
- `intercalarFio`: notas e tarefas entram por `criadoEm` entre as mensagens; com `temMaisAntes`, item mais antigo que a primeira mensagem carregada fica de fora (aparece ao carregar as anteriores); agendadas vão sempre no fim, por `agendadaPara`. Desempate por id.
- `useItensFio` busca `/api/inbox/atendimentos/<id>/fio` ao abrir e a cada `atendimento.atualizado` do atendimento aberto ou `resync`; nada de intervalo.
- **Step 0 (dependência da E0):** se `docs/superpowers/plans/2026-10-22-inbox-prototipo-01-correcoes.md` já tiver entregue a nota no fio (procure `CartaoNota`/`NotaThread` em `src/components/conversa/` e a chamada de `notasDoAtendimento`), não crie `CartaoNotaFio` e use o componente da E0 no `ItemFio` `"nota"`; a consulta deste fio continua sendo a fonte das notas. Senão, crie `CartaoNotaFio` (`P:273-279`, `P:1010-1013`): balão `--bubble-note` com borda tracejada `--warning-text`, cabeçalho "Nota interna · só equipe", autor e hora mono.

- [ ] **Step 1: Write the failing tests**

```ts
// intercalar-fio.test.ts
const m = (id: string, em: string) => ({ id, criadoEm: em } as MensagemThread);
it("nota e tarefa entram pela hora; agendadas no fim", () => {
  const r = intercalarFio([m("m1", "2026-10-22T10:00:00Z"), m("m2", "2026-10-22T10:10:00Z")],
    { notas: [{ id: "n1", nota: "x", autorNome: "Ana", criadoEm: "2026-10-22T10:05:00Z" }], tarefas: [{ ...tarefa, id: "t1", criadoEm: "2026-10-22T10:11:00Z" }],
      agendadas: [{ ...ag, id: "g1", agendadaPara: "2026-10-23T12:00:00Z" }] }, { temMaisAntes: false });
  expect(r.map((x) => x.tipo)).toEqual(["mensagem", "nota", "mensagem", "tarefa", "agendada"]);
});
it("com mensagens anteriores por carregar, o item mais antigo que a janela fica de fora", () => {
  const r = intercalarFio([m("m1", "2026-10-22T10:00:00Z")], { notas: [{ id: "n0", nota: "x", autorNome: null, criadoEm: "2026-10-22T09:00:00Z" }], tarefas: [], agendadas: [] }, { temMaisAntes: true });
  expect(r.map((x) => x.tipo)).toEqual(["mensagem"]);
});
```

```ts
// itens-fio.int.test.ts
it("notas do atendimento (sem as arquivadas), tarefas ligadas e agendadas pendentes de qualquer autor", async () => {
  const f = await carregarItensFio(sess(dono), a.id);
  expect(f!.notas.map((n) => n.nota)).toEqual(["Prefere noite"]);
  expect(f!.tarefas.map((t) => t.id)).toEqual([daConversa.id]);   // a do lead sem atendimentoId não entra
  expect(f!.agendadas).toEqual([expect.objectContaining({ id: daAria.id, autor: { tipo: "aria" }, podeAlterar: false })]);
});
it("fora do escopo: null", async () => expect(await carregarItensFio(sess(outro), a.id)).toBeNull());
it("notasDoAtendimento continua igual", async () => { /* resultado de notasDoAtendimento === listarNotasDoAtendimento */ });
```

```ts
// fio/route.test.ts — molde de painel/route.test.ts: 401, 403, 404 e 200 sem cache
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run src/components/conversa/intercalar-fio.test.ts "src/app/api/inbox/atendimentos/[id]/fio/route.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/itens-fio.int.test.ts src/server/aria/historico.int.test.ts`
Expected: FAIL nos novos.

- [ ] **Step 3: Implement**

Como descrito. A thread recebe `itens: ItemFio[]` no lugar de `conversa.mensagens` no `VirtualList` (`getKey` = `${tipo}:${id}`); o item `"mensagem"` continua no `BalaoMensagem`. Os itens `"tarefa"` e `"agendada"` usam os cartões da Task 13; até lá, a thread os ignora (`null`).

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos, mais `node_modules/.bin/vitest run "src/app/(app)/inbox/" src/components/conversa/`. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estado `nota-interna` (nota no fio de "Mariana Costa"); referência `telas/prototipo-estado-nota-interna.png`.

- [ ] **Step 6: Commit**

```bash
git add src/server/inbox/itens-fio.ts src/server/inbox/itens-fio.int.test.ts "src/app/api/inbox/atendimentos/[id]/fio" src/components/conversa/intercalar-fio.ts src/components/conversa/intercalar-fio.test.ts "src/app/(app)/inbox/useItensFio.ts" "src/app/(app)/inbox/ConversaAberta.tsx" src/server/whatsapp/acoes-conversa.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): itens do fio com notas, tarefas e agendadas (E2.12)"
```

<a id="task-13"></a>
### Task 13: Cartões de tarefa e de agendada no fio; entradas de tarefa e nota

**Files:**
- Create: `src/components/conversa/CartaoTarefaFio.tsx`, `src/components/conversa/CartaoAgendadaFio.tsx`
- Modify: `src/server/inbox/acoes-painel.ts` (`reagendarAgendadaNoInbox`, `enviarAgoraNoInbox`, `cancelarAgendadaNoInbox`); a thread (renderiza os itens `"tarefa"` e `"agendada"`); `src/app/(app)/inbox/MenuConversa.tsx` (item "Criar tarefa"); `src/app/(app)/inbox/RodapeConversa.tsx` (`aoCriarTarefa`, `pedidoNota`); `src/app/(app)/inbox/abas/AbaOportunidades.tsx` (ações "Criar tarefa" e "Adicionar nota"); `src/app/(app)/inbox/InboxNovo.tsx`
- Test: `src/components/conversa/CartaoTarefaFio.test.ts`, `src/components/conversa/CartaoAgendadaFio.test.ts`, `src/server/inbox/acoes-painel-agendadas.int.test.ts`

**Interfaces:**
- Consumes: `TarefaPainel`, `concluirTarefaNoInbox` (Task 10); `ModalTarefa` (Task 11); `AgendadaFio` (Task 12); `reagendarMensagem`, `enviarAgora` (`crm/mensagens-agendadas.ts:320-338`); `cancelarAgendamentoDoAtendimento` (`whatsapp/acoes-conversa.ts:102-117`); `exigirInstanteDoCampoLocal` (`_shared/campo-local.ts`).
- Produces:
  - `CartaoTarefaFio(props: { t: TarefaPainel; fuso: string | null; usuarioId: string; aoEditar(): void; aoConcluir(): void })`
  - `textoCriadorTarefa(t: Pick<TarefaPainel, "ia" | "criadorNome">, usuarioNome: string | null): string` → "Aria criou uma tarefa", "Você criou uma tarefa", "<Nome> criou uma tarefa"
  - `CartaoAgendadaFio(props: { a: AgendadaFio; fuso: string | null; aoReagendar(): void; aoEnviarAgora(): void; aoCancelar(): void })`
  - `reagendarAgendadaNoInbox(atendimentoId: string, intencaoId: string, quandoLocal: string, fuso: string): Promise<Resultado>`; `enviarAgoraNoInbox(atendimentoId: string, intencaoId: string): Promise<Resultado>`; `cancelarAgendadaNoInbox(atendimentoId: string, intencaoId: string): Promise<Resultado>`

Regras:
- Cartão de tarefa (`P:283-297`, `P:1005-1007`): largura `min(440px, 86%)`, centralizado, `--surface` com borda, raio 12; ícone 34 px do tipo em `--brand-bg`/`--brand-text` (humano) ou `--ai-bg`/`--ai-text` (Aria); cabeçalho `<textoCriadorTarefa> · <hora mono>`; título 13,5/500 (riscado se concluída); meta `<prazo> · <responsável> · <tipo>` em `--danger-text` se atrasada; aberta e `podeAgir`: lápis "Editar" e "Concluir" (`IconCheck`); concluída: "Concluída" em `--brand-text`; cancelada: "Cancelada" em `--text-terciary` e meta "Cancelada" (D10: o protótipo diz "Excluída").
- Cartão de agendada (`P:328-348`): `IconClock`, "Agendada para <Hoje|Amanhã|dd/mm> às <hh:mm> · por <você|Aria|nome>", texto em duas linhas; com `podeAlterar`: "Reagendar" (abre `Modal` com `CampoDataHoraLocal` e `validarQuando` de `AcoesAtendimento.tsx:56-62`), "Enviar agora" e "Cancelar" (`ConfirmarAcao` com o texto de `AcoesAtendimento.tsx:356`). Editar o texto, anexo, "Repete" e "X respondeu depois…" ficam na E4 (D11).
- Idempotência dos wrappers de agendada: `reagendarAgendadaNoInbox` lê a intenção; `agendadaPara` já igual ao instante pedido → ok sem chamar o domínio. `enviarAgoraNoInbox`: status fora de `PENDENTE`/`ADIADA` e último `MensagemReagendada` dessa intenção do mesmo autor com `enviarAgora: true` → ok. Cancelar delega a `cancelarAgendamentoDoAtendimento` (já por natureza). Os três conferem `intencao.atendimentoId === atendimentoId` e avisam.
- Entradas: "Criar tarefa" no menu ⋮ (`P:1183`), ícone `IconListCheck` "Nova tarefa" no compositor (`P:427`) e "Criar tarefa" na seção de ações da aba (`P:586`) abrem `ModalTarefa` (nova) quando `capacidades.tarefas`. "Adicionar nota" (`P:587`) incrementa `pedidoNota` do `RodapeConversa`.

- [ ] **Step 1: Write the failing tests**

```ts
// CartaoTarefaFio.test.ts
it("autor da tarefa", () => {
  expect(textoCriadorTarefa({ ia: true, criadorNome: null }, "Carla")).toBe("Aria criou uma tarefa");
  expect(textoCriadorTarefa({ ia: false, criadorNome: "Carla" }, "Carla")).toBe("Você criou uma tarefa");
  expect(textoCriadorTarefa({ ia: false, criadorNome: "Rodrigo" }, "Carla")).toBe("Rodrigo criou uma tarefa");
});
it("aberta tem Editar e Concluir; concluída e cancelada só o estado", () => {
  expect(h(aberta)).toContain("Concluir"); expect(h(aberta)).toContain('aria-label="Editar"');
  expect(h({ ...aberta, status: "CONCLUIDA" })).toContain("Concluída"); expect(h({ ...aberta, status: "CONCLUIDA" })).not.toContain(">Concluir<");
  expect(h({ ...aberta, status: "CANCELADA" })).toContain("Cancelada");
});
it("atrasada pinta a meta em perigo", () => expect(h({ ...aberta, atrasada: true })).toMatch(/class="[^"]*text-danger[^"]*"[^>]*>[^<]*Ligação/));
// CartaoAgendadaFio.test.ts
it("cabeçalho, autor e ações só com podeAlterar", () => {
  expect(h(ag)).toMatch(/Agendada para (Hoje|Amanhã|\d{2}\/\d{2}) às \d{2}:\d{2} · por você/);
  expect(h({ ...ag, podeAlterar: false })).not.toContain("Enviar agora");
  expect(h(ag)).not.toContain("Editar");
});
```

```ts
// acoes-painel-agendadas.int.test.ts
it("reagendar para o mesmo horário não grava MensagemReagendada", async () => { /* … */ });
it("enviar agora vira agendadaPara ≈ agora; repetir depois de despachada pelo mesmo autor devolve ok", async () => { /* … */ });
it("intenção de outro atendimento: “Mensagem agendada não encontrada.”", async () => { /* … */ });
it("quem não é o autor nem admin é recusado", async () => { /* … */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run src/components/conversa/CartaoTarefaFio.test.ts src/components/conversa/CartaoAgendadaFio.test.ts` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/acoes-painel-agendadas.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Como descrito. Os cartões ficam em `src/components/conversa/` sem importar ações (recebem callbacks); quem liga as ações é a thread do Inbox. `reagendarAgendadaNoInbox` converte com `exigirInstanteDoCampoLocal(quandoLocal, fuso)` e chama `reagendarMensagem(id, iso)`.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos, mais `node_modules/.bin/vitest run "src/app/(app)/inbox/"`. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estados `fio-tarefa` (cartão "Você criou uma tarefa" e um da Aria) e `fio-agendada`; referência: renderização do protótipo de `c1` (tarefa) e `c4` (agendada) pelo script.

- [ ] **Step 6: Commit**

```bash
git add src/components/conversa/CartaoTarefaFio.tsx src/components/conversa/CartaoTarefaFio.test.ts src/components/conversa/CartaoAgendadaFio.tsx src/components/conversa/CartaoAgendadaFio.test.ts src/server/inbox/acoes-painel.ts src/server/inbox/acoes-painel-agendadas.int.test.ts "src/app/(app)/inbox/" scripts/visual/demo-inbox.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): cartões de tarefa e de agendada no fio e entradas de tarefa e nota (E2.13)"
```

<a id="task-14"></a>
### Task 14: Aba Atividade: agendadas, atividade recente e notas (D11)

**Files:**
- Create: `src/server/inbox/painel-atividade.ts`, `src/app/(app)/inbox/abas/AbaAtividade.tsx`, `src/app/(app)/inbox/abas/AgendadasAtividade.tsx`
- Modify: `src/server/inbox/painel-abas.ts` (caso `"atividade"`); `src/app/(app)/inbox/InboxNovo.tsx`
- Test: `src/server/inbox/painel-atividade.int.test.ts`, `src/app/(app)/inbox/abas/AbaAtividade.test.ts`

**Interfaces:**
- Consumes: `listarNotasDoAtendimento`, `AgendadaFio` (Task 12); wrappers de agendada (Task 13).
- Produces:
  - `type AtividadeRecente = { ultimaInteracaoEm: string | null; conversas: number; tarefasAbertas: number; notas: NotaInternaThread[] }` (`notas`: as 2 mais recentes)
  - `listarAgendadasDoAtendimento(u: UsuarioSessao, atendimentoId: string): Promise<AgendadaFio[]>` (extraída de `itens-fio.ts`, usada pelo fio e pela aba)
  - `type AtividadePainel = { agendadas: AgendadaFio[]; recente: AtividadeRecente }` (a Task 15 acrescenta `aria` e `alteracoes`)
  - `carregarAtividadePainel(u: UsuarioSessao, atendimentoId: string): Promise<AtividadePainel | null>`
  - `AbaAtividade(props: { dados: AtividadePainel; atendimentoId: string; fuso: string | null; fusoEscola: string; aoMudar(): void })`

Regras (`P:593-621`):
- "Mensagens agendadas" (só com itens): linhas com `IconClock` em `--brand-text`, "<quando curto> · <autor>" (autor da Aria em `--ai-text`), prévia de uma linha; ícones "Reagendar", "Enviar agora", "Cancelar" (`podeAlterar`).
- "Atividade recente": `Última interação <instante> · <n> conversas · <n> tarefa(s) aberta(s)`; `ultimaInteracaoEm` = `atendimento.ultimaMensagemEm`; `conversas` = atendimentos do mesmo contato visíveis ao usuário (`escopoAtendimentos`); `tarefasAbertas` = abertas de `carregarTarefasDoAtendimento` (Task 10); as 2 notas com `IconNote` em `--warning-text`, texto em 2 linhas, "<autor> · <instante>"; vazio: "Nenhuma nota interna ainda."
- Fora do comercial a aba existe (agendadas e notas são do atendimento), sem a parte da Aria.

- [ ] **Step 1: Write the failing tests**

```ts
// painel-atividade.int.test.ts
it("agendadas pendentes, contagem de conversas do contato e as duas últimas notas", async () => {
  const d = await carregarAtividadePainel(sess(dono), a.id);
  expect(d!.agendadas.map((x) => x.id)).toEqual([g1.id]);
  expect(d!.recente).toMatchObject({ conversas: 2, tarefasAbertas: 1 });
  expect(d!.recente.notas.map((n) => n.nota)).toEqual(["Terceira", "Segunda"]);
});
it("conversa de outro setor do mesmo contato fora do escopo não conta", async () => { /* conversas: 1 */ });
// AbaAtividade.test.ts
it("seção de agendadas só com itens; vazio de notas", () => {
  expect(h({ ...d, agendadas: [] })).not.toContain("Mensagens agendadas");
  expect(h({ ...d, recente: { ...d.recente, notas: [] } })).toContain("Nenhuma nota interna ainda.");
  expect(h(d)).toMatch(/Última interação .+ · 3 conversas · 1 tarefa\(s\) aberta\(s\)/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/abas/AbaAtividade.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/painel-atividade.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Agendadas: `listarAgendadasDoAtendimento`, a consulta da Task 12 extraída em `itens-fio.ts` e usada pelos dois. `AgendadasAtividade` reaproveita os callbacks e modais da Task 13.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estados `painel-atividade` e `painel-atividade-agendadas`; referência `telas/prototipo-estado-painel-atividade.png`. Diferença justificada: "Reagendar" no lugar de "Editar" (D11).

- [ ] **Step 6: Commit**

```bash
git add src/server/inbox/painel-atividade.ts src/server/inbox/painel-atividade.int.test.ts src/server/inbox/painel-abas.ts src/server/inbox/itens-fio.ts "src/app/(app)/inbox/abas/AbaAtividade.tsx" "src/app/(app)/inbox/abas/AbaAtividade.test.ts" "src/app/(app)/inbox/abas/AgendadasAtividade.tsx" "src/app/(app)/inbox/InboxNovo.tsx" scripts/visual/demo-inbox.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): aba Atividade com agendadas, atividade recente e notas (E2.14, D11)"
```

<a id="task-15"></a>
### Task 15: Aba Atividade: Aria neste contato e alterações da IA com desfazer (D1)

**Files:**
- Create: `src/server/inbox/texto-aria.ts`, `src/app/(app)/inbox/abas/AlteracoesAria.tsx`
- Modify: `src/server/inbox/painel-atividade.ts` (`aria`, `alteracoes`); `src/server/inbox/painel-detalhes.ts` (`CabecalhoPainel.contadorAtividade`); `src/server/aria/historico.ts:163-176` (idempotência por natureza do desfazer); `src/server/inbox/acoes-painel.ts` (`desfazerAcaoAriaNoInbox`); `src/app/(app)/inbox/abas/AbaAtividade.tsx`; `src/app/(app)/inbox/InboxNovo.tsx` (`abasDoPainel(finalidade, cabecalho.contadorAtividade)`)
- Test: `src/server/inbox/texto-aria.test.ts`, `src/app/(app)/inbox/abas/AlteracoesAria.test.ts`, `src/server/inbox/painel-atividade-aria.int.test.ts`, `src/server/aria/historico.int.test.ts` (casos novos)

**Interfaces:**
- Consumes: `versaoPublicada` (`aria/versoes.ts:30`), `modoDaAcao` (`aria/config-schema.ts:163`), `ACOES_MATRIZ` (`aria/matriz.ts:14`); `desfazerAcaoAria` (`aria/historico.ts:163`); `ACAO_AGENTE_IA_LABEL` (`lib/labels.ts:536`).
- Produces:
  - `textoAlteracaoAria(acao: AcaoAgenteIATipo, payload: unknown): string`
  - `faixaConfianca(valor: number, faixa: { executaAPartirDe: number; transfereAbaixoDe: number }): "alta" | "media" | "baixa"`
  - `type AlteracaoAriaPainel = { id: string; acao: AcaoAgenteIATipo; texto: string; em: string; desfeita: boolean; podeDesfazer: boolean; motivoIrreversivel: string | null }`
  - `type AriaNoContato = { ultimaAcao: { texto: string; confianca: number; em: string } | null; faixa: { executaAPartirDe: number; transfereAbaixoDe: number }; etapa: EtapaLead | null; automatico: AcaoAgenteIATipo[]; comAprovacao: AcaoAgenteIATipo[] }`
  - `AtividadePainel` acrescenta `aria: AriaNoContato | null; alteracoes: AlteracaoAriaPainel[]`
  - `CabecalhoPainel.contadorAtividade: number`
  - `desfazerAcaoAriaNoInbox(atendimentoId: string, acaoId: string): Promise<Resultado>`
  - `AlteracoesAria(props: { itens: AlteracaoAriaPainel[]; atendimentoId: string; aoMudar(): void })`

Regras (`P:623-649`, `P:745-751`, `P:903-910`, `P:1145`, `P:1154`):
- `aria` só em `COMERCIAL` com `veLead`; `null` fora.
- **Lista:** `AcaoAgenteIA` do atendimento com status `EXECUTADA`, `APROVADA` ou `DESFEITA`, `acao` diferente de `CLASSIFICAR_SETOR`, mais recentes primeiro, até 30 (índice `[atendimentoId, criadoEm]`, `schema.prisma:9149`). `podeDesfazer = capacidades.desfazerAria && reversivel && status in (EXECUTADA, APROVADA)` (mesma regra de `aria/consultas.ts:239`). Visível a quem vê o lead; o botão só a quem desfaz (D1).
- **Contador:** quantos da lista têm `EXECUTADA` ou `APROVADA`. Zero esconde o contador.
- **Texto:** `MOVER_ETAPA` "Moveu para <ETAPA_LABEL[para]>"; `MARCAR_PERDIDO` "Marcou como perdido"; `TAG` "Adicionou a tag <nome>"; `ATUALIZAR_CAMPO` "Preencheu <nomeCampo ?? "um campo">"; `CRIAR_TAREFA` "Criou a tarefa <titulo>"; `AGENDAR_MENSAGEM` "Agendou uma mensagem"; `NOTA_INTERNA` "Registrou uma nota interna"; `RESPONDER` "Enviou uma mensagem"; `ENVIAR_DOCUMENTO` "Enviou um documento"; `CONDICAO_COMERCIAL` "Ofereceu uma condição comercial"; `HANDOFF` "Pediu ajuda a uma pessoa". Payload sem o campo esperado cai no rótulo de `ACAO_AGENTE_IA_LABEL`.
- **Linha:** ícone 28 px em `--ai-bg`/`--ai-text`, texto 13,5 px (riscado e opacidade 0,5 se desfeita), meta mono 11 px (`Desfeito · ` + hora). "Desfazer" (`IconArrowBackUp`) com `podeDesfazer`; irreversível: botão cadeado (`IconLock`) "Por que não dá para desfazer" que mostra `Não dá para desfazer: <motivo em minúsculas>. Se precisar corrigir, envie uma nova mensagem.` (`P:1154`). Vazio: "Aria ainda não alterou nada neste contato."; texto de introdução: "Tudo que Aria fez neste contato. Desfazer restaura o valor anterior. Mensagens enviadas e handoffs já comunicados ao lead não podem ser desfeitos."
- **"Aria neste contato":** título com `IconSparkles` em `--ai-text`; `ultimaAcao` = ação mais recente do atendimento (qualquer status menos `SIMULADA`) com `textoAlteracaoAria` e `confianca`; barra de 4 px com largura `<confianca>%` e cor por `faixaConfianca` contra a faixa da **versão publicada** (`config.confianca`; sem versão, 75 e 55 do protótipo): `alta` `--brand-solid`, `media` `--warning-text`, `baixa` `--danger-solid`; número mono. Sem ação: "Aria ainda não atuou neste contato." Regras: `Automático em <ETAPA_LABEL>: <rótulos EXECUTA>` e `Com aprovação: <rótulos SUGERE>` (`modoDaAcao` para cada `ACOES_MATRIZ` na etapa do lead); lista vazia vira "nenhuma".
- **Desfazer idempotente (#166):** em `desfazerAcaoAria`, depois de `travarAcao` e `exigirEscopo`, `status === "DESFEITA" && desfeitaPorId === u.id` devolve ok sem Evento; desfeita por outra pessoa segue "Esta ação já foi desfeita.". O wrapper confere `acao.atendimentoId === atendimentoId` ("Ação da Aria não encontrada.") e avisa.

- [ ] **Step 1: Write the failing tests**

```ts
// texto-aria.test.ts
it("textos por ação e queda no rótulo", () => {
  expect(textoAlteracaoAria("MOVER_ETAPA", { de: "NOVO", para: "QUALIFICADO" })).toBe("Moveu para Qualificado");
  expect(textoAlteracaoAria("TAG", { tagId: "t", nome: "Inglês" })).toBe("Adicionou a tag Inglês");
  expect(textoAlteracaoAria("CRIAR_TAREFA", {})).toBe("Criar tarefa");
});
it("faixa de confiança pela versão publicada", () => {
  const f = { executaAPartirDe: 80, transfereAbaixoDe: 50 };
  expect([faixaConfianca(80, f), faixaConfianca(79, f), faixaConfianca(49, f)]).toEqual(["alta", "media", "baixa"]);
});
// AlteracoesAria.test.ts
it("desfazer só onde pode; cadeado no irreversível; desfeita riscada", () => {
  const t = h([{ ...it1, podeDesfazer: true }, { ...it2, podeDesfazer: false, motivoIrreversivel: "Mensagem já enviada" }, { ...it3, desfeita: true }]);
  expect(t.match(/>Desfazer</g)).toHaveLength(1);
  expect(t).toContain('title="Por que não dá para desfazer"');
  expect(t).toMatch(/line-through[\s\S]*Desfeito · /);
});
it("vazio", () => expect(h([])).toContain("Aria ainda não alterou nada neste contato."));
```

```ts
// historico.int.test.ts (acrescentar)
it("desfazer_repetido_pelo_mesmo_autor_e_ok_sem_evento", async () => {
  const a = await exec({ acao: "TAG", tagId: tag.id, justificativa: "x" }); logado(gerente);
  expect(await desfazerAcaoAria(a.id)).toEqual({ ok: true });
  expect(await desfazerAcaoAria(a.id)).toEqual({ ok: true });
  expect(await prisma.evento.count({ where: { tipo: "AcaoAriaDesfeita", agregadoId: a.id } })).toBe(1);
});
it("desfeita_por_outro_segue_recusada", async () => { /* admin desfaz; gerente tenta → "Esta ação já foi desfeita." */ });
// painel-atividade-aria.int.test.ts
it("lista, contador, última ação, regras da etapa e podeDesfazer por papel (D1)", async () => {
  expect((await carregarAtividadePainel(sess(vendedor), a.id))!.alteracoes.every((x) => !x.podeDesfazer)).toBe(true);
  expect((await carregarAtividadePainel(sess(gerente), a.id))!.alteracoes.some((x) => x.podeDesfazer)).toBe(true);
  expect((await carregarCabecalhoPainel(sess(vendedor), a.id))!.contadorAtividade).toBe(2);
});
it("desfazerAcaoAriaNoInbox recusa ação de outro atendimento e o vendedor (D1)", async () => { /* … */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run src/server/inbox/texto-aria.test.ts "src/app/(app)/inbox/abas/AlteracoesAria.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/aria/historico.int.test.ts src/server/inbox/painel-atividade-aria.int.test.ts`
Expected: FAIL nos novos.

- [ ] **Step 3: Implement**

Como descrito. Cliente: `useAcaoCliente({ idempotente: true })` no "Desfazer"; sucesso chama `aoMudar()`.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos, mais `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/aria/consultas.int.test.ts`. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estado `painel-atividade` com alterações (uma desfeita, uma irreversível) para Gerente e para Vendedor; referência `telas/prototipo-estado-painel-atividade.png`. Diferença justificada: o vendedor não vê "Desfazer" (D1).

- [ ] **Step 6: Commit**

```bash
git add src/server/inbox/texto-aria.ts src/server/inbox/texto-aria.test.ts src/server/inbox/painel-atividade.ts src/server/inbox/painel-atividade-aria.int.test.ts src/server/inbox/painel-detalhes.ts src/server/inbox/acoes-painel.ts src/server/aria/historico.ts src/server/aria/historico.int.test.ts "src/app/(app)/inbox/abas/AlteracoesAria.tsx" "src/app/(app)/inbox/abas/AlteracoesAria.test.ts" "src/app/(app)/inbox/abas/AbaAtividade.tsx" "src/app/(app)/inbox/InboxNovo.tsx" scripts/visual/demo-inbox.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): Aria neste contato e alterações da IA com desfazer (E2.15, D1)"
```

<a id="task-16"></a>
### Task 16: Atalhos de saída e `?agendar=1`

**Files:**
- Create: `src/lib/href-conversa.ts`
- Modify: `src/app/(app)/inbox/page.tsx:31,72` (`agendarAoAbrir`); `src/app/(app)/inbox/InboxNovo.tsx` (abre o `DialogoAgendar`); `src/app/(app)/inbox/AcoesAtendimento.tsx:291` (exporta `DialogoAgendar`); `src/server/inbox/paineis.ts:19-20,63-82` (`matriculaId`); `src/app/(app)/inbox/PainelSetor.tsx:23,29` (link da matrícula); `src/app/(app)/inbox/ColunaConversas.tsx` (E1: o popover do seletor de número ganha "Gerenciar números em Configurações"); `src/app/(app)/funil/PainelOportunidade.tsx:281` (corrige `/contatos/<id>` para `/contatos?c=<id>`)
- Test: `src/lib/href-conversa.test.ts`, `src/app/(app)/inbox/PainelSetor.test.ts` (casos novos), `src/app/(app)/inbox/InboxNovo.interacao.test.ts` (casos novos), `src/app/(app)/inbox/page.test.ts` (caso novo), `src/app/(app)/funil/PainelOportunidade.test.ts` (caso novo)

**Interfaces:**
- Consumes: `capacidadesPainel().gerenciarNumeros` (Task 1); `DialogoAgendar`.
- Produces:
  - `hrefConversa(atendimentoId: string, o?: { agendar?: boolean }): string` → `/inbox?c=<id>` e `&agendar=1`
  - `PropsInboxNovo.agendarAoAbrir?: boolean`
  - `DadosSetor` `FINANCEIRO`/`SECRETARIA`: `matriculaId: string | null`

Regras:
- Saídas (B1): "Abrir ficha completa" e "Ver no contato" → `/contatos?c=` (Tasks 5 e 9); "Ver empresa" → `/empresas/<id>` (Task 5); matrícula → `/matriculas/<id>` no painel de Financeiro e Secretaria (código vira link quando `matriculaId`, só para quem já via o código); "Gerenciar números em Configurações" → `/configuracao/whatsapp/numeros`, só com `gerenciarNumeros` (`P:104`).
- `?agendar=1` (A21, `P:881`): `page.tsx` passa `agendarAoAbrir = um(parametros.agendar) === "1" && !!c`. O `InboxNovo` abre o `DialogoAgendar` uma vez, quando o painel do atendimento `c` chegou: com o item `status !== "ENCERRADO"`; se encerrado, `FeedbackAcao` "Esta conversa está encerrada. Não dá para agendar mensagens."; fora do escopo (item ausente), nada. Depois tira `agendar` da URL com `history.replaceState` (recarregar não reabre). D11 padrão: não exige ter assumido.

- [ ] **Step 1: Write the failing tests**

```ts
// href-conversa.test.ts
it("monta o link com e sem agendar", () => {
  expect(hrefConversa("a 1")).toBe("/inbox?c=a%201");
  expect(hrefConversa("a1", { agendar: true })).toBe("/inbox?c=a1&agendar=1");
});
// PainelSetor.test.ts (acrescentar)
it("matrícula vira link para a ficha", () => expect(h({ setor: "SECRETARIA", matriculaCodigo: "M-2", matriculaId: "m2", documentosPendentes: 0 })).toMatch(/<a [^>]*href="\/matriculas\/m2"[^>]*>M-2<\/a>/));
// InboxNovo.interacao.test.ts (acrescentar)
it("agendar_ao_abrir_so_em_conversa_aberta", async () => {
  // aberto: o diálogo "Agendar mensagem" aparece uma vez e a URL perde agendar=1
  // encerrado: aparece "Esta conversa está encerrada. Não dá para agendar mensagens." e nenhum diálogo
});
// page.test.ts (acrescentar)
it("?agendar=1 só vale com ?c=", async () => { /* agendarAoAbrir true com c; false sem c */ });
// PainelOportunidade.test.ts (acrescentar)
it("“Abrir contato” usa /contatos?c=", () => expect(h()).toContain('href="/contatos?c=p1"'));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run src/lib/href-conversa.test.ts "src/app/(app)/inbox/" "src/app/(app)/funil/PainelOportunidade.test.ts"`
Expected: FAIL nos novos.

- [ ] **Step 3: Implement**

Como descrito. `paineis.ts`: o `include` já traz `matricula.id` (`:46`); acrescentar ao retorno.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmo comando, mais `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/paineis.int.test.ts`. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estado `agendar-deeplink` (`/inbox?c=<Beatriz>&agendar=1`); referência `telas/prototipo-estado-agendar-deeplink.png` (só a abertura; o conteúdo do diálogo é da Task 18 e da E4).

- [ ] **Step 6: Commit**

```bash
git add src/lib/href-conversa.ts src/lib/href-conversa.test.ts "src/app/(app)/inbox/" src/server/inbox/paineis.ts "src/app/(app)/funil/PainelOportunidade.tsx" "src/app/(app)/funil/PainelOportunidade.test.ts" docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): atalhos de saída e ?agendar=1 (E2.16)"
```

<a id="task-17"></a>
### Task 17: Atalhos de entrada nas outras telas (D21)

**Files:**
- Create: `src/server/inbox/atalhos.ts`
- Modify: `src/app/(app)/funil/page.tsx` e `src/app/(app)/funil/PainelOportunidade.tsx` (prop `conversa`); `src/app/(app)/tarefas/page.tsx:49,84` e `src/app/(app)/tarefas/PainelTarefa.tsx` (prop `conversa`); `src/app/(app)/contatos/page.tsx:42,88` e `src/app/(app)/contatos/FichaContato.tsx` (prop `conversa`); `src/server/aria/consultas.ts:29-40,230-243` (`atendimentoId` no item) e `src/app/(app)/aria/_componentes/Historico.tsx` (link por linha); `src/server/inbox/painel-detalhes.ts` (`hrefConversa` dos participantes B2B)
- Test: `src/server/inbox/atalhos.int.test.ts`, `src/app/(app)/funil/PainelOportunidade.test.ts`, `src/app/(app)/tarefas/PainelTarefa.interacao.test.ts` (ou render novo), `src/app/(app)/contatos/FichaContato.test.ts`, `src/server/aria/consultas.int.test.ts` (caso novo)

**Interfaces:**
- Consumes: `hrefConversa` (Task 16); `escopoAtendimentos` (`whatsapp/escopo.ts:47`).
- Produces:
  - `type ConversaParaAbrir = { atendimentoId: string; aberta: boolean }`
  - `atendimentoParaAbrir(u: UsuarioSessao, alvo: { atendimentoId?: string | null; leadId?: string | null; pessoaId?: string | null }): Promise<ConversaParaAbrir | null>`
  - Prop `conversa?: ConversaParaAbrir | null` em `PainelOportunidade`, `PainelTarefa` e `FichaContato`; `ItemHistoricoAria.atendimentoId: string | null`

Regras:
- Ordem de busca, sempre dentro de `escopoAtendimentos(u)` e sem grupo: o `atendimentoId` dado; senão o atendimento não encerrado do `leadId` com `ultimaMensagemEm` mais recente; senão o não encerrado de um contato com `pessoaId`; senão o encerrado mais recente das mesmas fontes. `aberta = status !== "ENCERRADO"`.
- Links (só texto, D21): "Abrir conversa" (`hrefConversa(id)`) e, com `aberta`, "Agendar mensagem" (`hrefConversa(id, { agendar: true })`). Funil: no topo do painel da oportunidade, ao lado do código. Tarefas: abaixo do status, quando a tarefa tem `atendimentoId`, `leadId` ou `pessoaId`. Contatos: no cabeçalho da ficha. Agente (Histórico): link "Abrir conversa" na linha, quando `atendimentoId` não é nulo. Sem conversa, nada aparece.
- Participantes B2B (Task 5): `hrefConversa` do atendimento da pessoa do participante, por `atendimentoParaAbrir(u, { pessoaId })`.

- [ ] **Step 1: Write the failing tests**

```ts
// atalhos.int.test.ts
it("prefere o atendimento aberto mais recente do lead", async () => {
  expect(await atendimentoParaAbrir(sess(dono), { leadId: op.id })).toEqual({ atendimentoId: aRecente.id, aberta: true });
});
it("cai na pessoa e, sem aberto, no encerrado", async () => {
  expect(await atendimentoParaAbrir(sess(dono), { pessoaId: p.id })).toEqual({ atendimentoId: aDaPessoa.id, aberta: true });
  expect(await atendimentoParaAbrir(sess(dono), { leadId: soEncerrado.id })).toEqual({ atendimentoId: aEncerrado.id, aberta: false });
});
it("fora do escopo: null", async () => expect(await atendimentoParaAbrir(sess(outro), { leadId: op.id })).toBeNull());
// PainelOportunidade.test.ts
it("“Abrir conversa” e “Agendar mensagem” com conversa aberta; só abrir com encerrada", () => {
  expect(h({ conversa: { atendimentoId: "a1", aberta: true } })).toContain('href="/inbox?c=a1&amp;agendar=1"');
  expect(h({ conversa: { atendimentoId: "a1", aberta: false } })).not.toContain("Agendar mensagem");
  expect(h({ conversa: null })).not.toContain("Abrir conversa");
});
// consultas.int.test.ts (aria)
it("historicoAria devolve o atendimentoId da ação", async () => { /* … */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run "src/app/(app)/funil/" "src/app/(app)/tarefas/" "src/app/(app)/contatos/" "src/app/(app)/aria/"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/atalhos.int.test.ts src/server/aria/consultas.int.test.ts`
Expected: FAIL nos novos.

- [ ] **Step 3: Implement**

As páginas chamam `atendimentoParaAbrir` só quando o painel está aberto (`?o=`, `?t=`, `?c=`) e só para quem tem papel do Inbox (`PAPEIS_INBOX`); senão passam `null`. No Agente, `historicoAria` acrescenta `atendimentoId: a.atendimentoId` (o link usa o escopo do Inbox ao abrir).

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Capturar `/funil?o=<Mariana>`, `/tarefas?t=<tarefa>`, `/contatos?c=<Mariana>` e `/aria?aba=historico` em 1440×900 nos dois temas, com os links; referências: os protótipos `ui2/Funil.dc.html:628`, `Tarefas.dc.html:582`, `Contatos.dc.html:624` e `Agente.dc.html:618` (só a presença e o texto do link).

- [ ] **Step 6: Commit**

```bash
git add src/server/inbox/atalhos.ts src/server/inbox/atalhos.int.test.ts src/server/inbox/painel-detalhes.ts src/server/aria/consultas.ts src/server/aria/consultas.int.test.ts "src/app/(app)/funil/" "src/app/(app)/tarefas/" "src/app/(app)/contatos/" "src/app/(app)/aria/_componentes/Historico.tsx" docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): abrir conversa e agendar mensagem a partir de funil, tarefas, contatos e agente (E2.17, D21)"
```

<a id="task-18"></a>
### Task 18: Agendar: atalhos de horário, aviso de conflito e salvar rascunho (D11)

**Files:**
- Create: `src/app/(app)/inbox/atalhos-agendar.ts`
- Modify: `src/app/(app)/inbox/AcoesAtendimento.tsx:291-321` (`DialogoAgendar`); `src/components/conversa/Compositor.tsx:38-44` (`gravarRascunhoConversa` e releitura pelo evento)
- Test: `src/app/(app)/inbox/atalhos-agendar.test.ts`, `src/app/(app)/inbox/AcoesAtendimento.test.ts` (casos novos), `src/components/conversa/Compositor.test.ts` (casos novos, no molde de `:80-92`, com o `armazenamento` do próprio arquivo)

**Interfaces:**
- Consumes: `DialogoAgendar` exportado (Task 16); `listarAgendadasDoAtendimento` (Task 14) via a aba Atividade ou `listarConvitesEAgendamentos` (`whatsapp/consultas-acoes-atendimento.ts:46`) quando o diálogo abre sem a aba carregada.
- Produces:
  - `type AtalhoAgendar = "1h" | "hoje18" | "amanha9" | "amanha14" | "seg9"`
  - `valorDoAtalhoAgendar(atalho: AtalhoAgendar, agora: Date, fuso: string): string | null` (texto `YYYY-MM-DDTHH:mm` no `fuso` do campo; `null` para "hoje18" depois das 18:00)
  - `ROTULOS_ATALHO_AGENDAR: Record<AtalhoAgendar, string>` = "Em 1 hora", "Hoje 18:00", "Amanhã 09:00", "Amanhã 14:00", "Segunda 09:00" (`P:861`)
  - `conflitoAgendamento(quando: Date, agendadas: { agendadaPara: string }[]): string | null` → `Já existe uma mensagem agendada para <hh:mm>, a menos de 2 horas.` quando alguma está a menos de 2 h (`P:1076`)
  - `gravarRascunhoConversa(atendimentoId: string, modo: "responder" | "nota", texto: string): void`

Regras: chips acima de "Enviar em" preenchem o campo (o selecionado com `--brand-bg`); o aviso de conflito aparece abaixo do campo em `--warning-text` e não impede agendar; "Salvar rascunho" (`P:401`) grava o texto no rascunho do compositor desta conversa e fecha o diálogo, com "Rascunho salvo no compositor." no `FeedbackAcao` da tela. "Em 1 hora" zera os segundos. "Escrever com Aria", respostas rápidas no diálogo, anexo, "perguntar se o contato responder", "Repetir" e "Vincular a" ficam na E4 (D11).

- [ ] **Step 1: Write the failing tests**

```ts
// atalhos-agendar.test.ts
const sp = "America/Sao_Paulo";
it("atalhos no fuso do campo", () => {
  const agora = new Date("2026-10-22T13:20:30Z"); // 10:20:30 SP
  expect(valorDoAtalhoAgendar("1h", agora, sp)).toBe("2026-10-22T11:20");
  expect(valorDoAtalhoAgendar("amanha9", agora, sp)).toBe("2026-10-23T09:00");
  expect(valorDoAtalhoAgendar("seg9", agora, sp)).toBe("2026-10-26T09:00");
  expect(valorDoAtalhoAgendar("hoje18", new Date("2026-10-22T21:30:00Z"), sp)).toBeNull();
});
it("conflito a menos de 2 h", () => {
  const ags = [{ agendadaPara: "2026-10-23T12:00:00Z" }];
  expect(conflitoAgendamento(new Date("2026-10-23T13:30:00Z"), ags)).toMatch(/^Já existe uma mensagem agendada para \d{2}:\d{2}, a menos de 2 horas\.$/);
  expect(conflitoAgendamento(new Date("2026-10-23T14:00:00Z"), ags)).toBeNull();
});
// Compositor.test.ts (acrescentar)
it("gravarRascunhoConversa grava a chave do compositor e avisa o atendimento", () => {
  const disparar = vi.fn(); vi.stubGlobal("window", { dispatchEvent: disparar });
  gravarRascunhoConversa("at1", "responder", "Oi!");
  expect(armazenamento.get("conversa-rascunho:at1:responder")).toBe("Oi!");
  expect(disparar.mock.calls[0][0]).toMatchObject({ type: "conversa-rascunho", detail: { atendimentoId: "at1" } });
});
// AcoesAtendimento.test.ts
it("diálogo de agendar mostra os cinco atalhos e “Salvar rascunho”", () => { /* render do DialogoAgendar */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/atalhos-agendar.test.ts" "src/app/(app)/inbox/AcoesAtendimento.test.ts" src/components/conversa/Compositor.test.ts`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Implement**

Como descrito.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmo comando. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estados `agendar-deeplink` e `agendar-conflito`; referência `telas/prototipo-estado-agendar-mais-opcoes.png` (só chips, conflito e rascunho; o resto é da E4).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/atalhos-agendar.ts" "src/app/(app)/inbox/atalhos-agendar.test.ts" "src/app/(app)/inbox/AcoesAtendimento.tsx" "src/app/(app)/inbox/AcoesAtendimento.test.ts" src/components/conversa/Compositor.tsx src/components/conversa/Compositor.test.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): atalhos de horário, conflito e rascunho no agendamento (E2.18, D11)"
```

<a id="task-19"></a>
### Task 19: @menção em nota interna com aviso no sino (D20) — bloqueada

**Estado:** bloqueada por D20. O padrão ("@menção sem aviso") não pede nada além da aba Nota da E1, que já aceita `@` como texto. Só anda quando o dono aprovar o aviso.

**Files (quando aprovada):**
- Create: `prisma/migrations/20261023140000_notificacao_mencao_nota/migration.sql` (`ALTER TYPE "TipoNotificacao" ADD VALUE 'MENCAO_NOTA';`, sozinho na migration)
- Create: `src/server/inbox/mencoes.ts`
- Modify: `src/server/whatsapp/acoes-conversa.ts:24-45` (`registrarNotaAtendimento` grava as notificações na mesma transação); `src/app/(app)/tarefas/SinoNotificacoes.tsx` (rótulo e link `/inbox?c=`); `RodapeConversa` (lista de pessoas ao digitar `@`, `P:1108`)
- Test: `src/server/inbox/mencoes.test.ts`, `src/server/whatsapp/nota-mencao.int.test.ts`

**Interfaces (quando aprovada):**
- `extrairMencoes(texto: string, pessoas: { id: string; nome: string }[]): string[]` (ids; `@` seguido do primeiro nome ou do nome completo, sem acento e sem caixa; ignora o autor)
- Notificação `MENCAO_NOTA` com `refTipo: "AtendimentoWhatsApp"`, `refId: atendimentoId`, `titulo: "<autor> mencionou você numa nota"`, só para quem enxerga o atendimento (`atendimentoVisivel`), uma por pessoa por nota (idempotência pela marca da nota, #166).

- [ ] **Step 1:** testes `extrai_primeiro_nome_e_nome_completo`, `ignora_o_autor_e_quem_nao_ve_o_atendimento`, `repetir_a_nota_com_a_mesma_chave_nao_duplica_notificacao`.
- [ ] **Step 2–4:** ciclo TDD com os comandos das tasks anteriores.
- [ ] **Step 5:** aceite visual do estado `nota-interna` com a lista de menção (`P:1105-1109`).
- [ ] **Step 6:** commit `feat(inbox): menção em nota com aviso no sino (E2.19, D20)`.

<a id="task-20"></a>
### Task 20: Tarefa: prioridade baixa, lembretes de 15 min e 1 dia, recorrência e "notificar também" (D10) — bloqueada

**Estado:** bloqueada por D10. O padrão mantém os campos atuais (Task 11).

**Files (quando aprovada):**
- Create: `prisma/migrations/20261023120000_tarefa_prioridade_lembretes/migration.sql` (`ALTER TYPE "PrioridadeTarefa" ADD VALUE 'BAIXA';`, sozinho)
- Create: `prisma/migrations/20261023130000_tarefa_recorrencia_notificar/migration.sql` (`Tarefa.recorrencia` enum `NAO_REPETE | DIARIA | SEMANAL | MENSAL` com padrão `NAO_REPETE`; tabela `TarefaNotificado(tarefaId, usuarioId)` com PK composta)
- Modify: `src/server/crm/tarefas.ts:50-51` (prioridade `BAIXA`; lembretes `0 | 15 | 60 | 1440`, mantendo `10 | 30` para as tarefas antigas), `src/server/crm/lembretes.ts` (gera a próxima ocorrência ao concluir a recorrente; avisa os notificados); `ModalTarefa` ("Mais opções" com Repetir e "Notificar também", `P:724-727`)
- Test: `src/server/crm/tarefa-recorrencia.int.test.ts`, `ModalTarefa.test.ts`

- [ ] **Step 1:** testes `concluir_recorrente_cria_a_proxima_com_a_mesma_hora`, `lembrete_de_1_dia`, `notificados_recebem_o_lembrete`, `prioridade_baixa`.
- [ ] **Step 2–5:** ciclo TDD, aceite visual `tarefa-nova-mais-opcoes` (`telas/prototipo-estado-tarefa-nova-mais-opcoes.png`).
- [ ] **Step 6:** commit `feat(tarefas): recorrência, lembretes e notificados (E2.20, D10)`.

<a id="task-21"></a>
### Task 21: Tarefa: "Enviar mensagem nesta data" (D11) — bloqueada

**Estado:** bloqueada por D11 ("vínculo" do agendamento com a tarefa; o padrão é "campos atuais", e `agendarMensagemNoAtendimento` não passa `tarefaId`, `whatsapp/acoes-conversa.ts:72-87`).

**Files (quando aprovada):**
- Modify: `src/server/whatsapp/acoes-conversa.ts:72-99` (`tarefaId?: string` repassado a `agendarMensagem`, que já o aceita, `crm/mensagens-agendadas.ts:32`); `src/server/inbox/acoes-painel.ts` (`criarTarefaNoInbox` aceita `mensagem?: { texto: string; chaveIdempotencia: string }` e agenda para `inicioEm` da tarefa, só se futuro, `P:926-927`); `ModalTarefa` (caixa "Enviar mensagem nesta data", `P:715-720`)
- Test: `src/server/inbox/acoes-painel-criar-tarefa.int.test.ts` (casos `mensagem_agendada_com_tarefaId`, `horario_passado_nao_agenda`, `repetir_nao_agenda_duas_vezes`)

- [ ] **Step 1–6:** ciclo TDD; aceite `tarefa-nova-mais-opcoes`; commit `feat(inbox): mensagem agendada junto da tarefa (E2.21, D11)`.

<a id="task-22"></a>
### Task 22: CPF e idade na Pessoa (D13) — bloqueada

**Estado:** bloqueada por D13 (padrão: sem CPF e idade na Pessoa; hoje só em `Aluno.documento` e `nascimento`, `schema.prisma:1197-1207`).

**Files (quando aprovada):**
- Create: `prisma/migrations/20261023150000_pessoa_cpf_nascimento/migration.sql` (`Pessoa.documento TEXT`, `Pessoa.nascimento DATE`, ambos nulos; sem índice)
- Modify: `src/server/crm/contatos.ts:382-407` (`EditarPessoaSchema` com documento validado por país e `nascimento` data civil, nunca no payload do Evento em claro, como o e-mail); `painel-detalhes.ts` (`PessoaPainel.documento`, `idade` calculada no fuso da escola); `AbaDetalhes` e `GavetaContato` (linhas "CPF" e "Idade", `P:1129`); regra de exibição por setor conforme a resposta
- Test: `src/server/crm/pessoa-documento.int.test.ts`, `AbaDetalhes.test.ts`

- [ ] **Step 1–6:** ciclo TDD; aceite `painel-detalhes`; commit `feat(crm): CPF e nascimento na pessoa (E2.22, D13)`.

<a id="task-23"></a>
### Task 23: Probabilidade e previsão de fechamento da oportunidade (D13) — bloqueada

**Estado:** bloqueada por D13 (o pedido inclui estes campos na mesma decisão; não existem em `Oportunidade`, `schema.prisma:1408-1494`).

**Files (quando aprovada):**
- Create: `prisma/migrations/20261023160000_oportunidade_probabilidade_previsao/migration.sql` (`"Lead"."probabilidadePct" INTEGER` com `CHECK` 0–100 e `"Lead"."previsaoFechamento" TEXT` como data civil)
- Modify: `src/server/comercial/schema.ts` e `comercial/acoes.ts:321` (`editarLead`); `crm/historico.ts:21-64,158-222` (`DetalheOportunidade`); `painel-oportunidades.ts` e `AbaOportunidades` (linha "Probabilidade · previsão", `P:1140`)
- Test: `src/server/comercial/probabilidade.int.test.ts`, `AbaOportunidades.test.ts`

- [ ] **Step 1–6:** ciclo TDD; aceite `painel-oportunidades`; commit `feat(comercial): probabilidade e previsão de fechamento (E2.23, D13)`.

---

## Fora da E2 (para não haver dúvida)

- "Marcar como não lida" e "Devolver para Aria" no cabeçalho (B1 da análise): menu ⋮ e cabeçalho da E1; "Devolver" com a regra da E3.
- Cartão de sugestão, faixa e modal de handoff, assumir com pausa da Aria: E3 (D1–D3).
- Editar o texto da agendada, anexo, "perguntar se o contato responder", recorrência e "Escrever com Aria" no agendamento: E4 (D11).
- Aba Insights e temperatura com score: E4 (D12).
- "Falar com" que troca o interlocutor sem conversa aberta da pessoa: sem back-end (análise parte 3, T27); a E2 só leva à conversa existente.

---

## Issues

Uma por task, no formato do índice. O arquivo irmão `2026-10-22-inbox-prototipo-03-painel-crm.issues.json` tem os mesmos blocos para criação em lote.

### [Inbox E2.1] Aviso do atendimento e capacidades do painel

**Labels:** `inbox`, `etapa-2`, `back-end`

Criar `avisarAtendimento`, que publica `atendimento.atualizado` para as ações novas do Inbox, e `capacidadesPainel`, que diz o que o painel mostra a cada papel pela matriz atual.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-1`

**Arquivos:**
- `src/server/inbox/aviso.ts`
- `src/server/inbox/permissoes.ts`
- `src/server/whatsapp/acoes-atendimento.ts`

**Critérios de aceite:**
- `src/server/inbox/permissoes.test.ts` (casos de `capacidadesPainel`) passando
- `src/server/inbox/aviso.int.test.ts` passando
- `src/server/whatsapp/participantes-aviso.int.test.ts` sem regressão

**Dependências:**
- Nenhuma

### [Inbox E2.2] Vínculo da tarefa com a conversa

**Labels:** `inbox`, `etapa-2`, `back-end`

Acrescentar `Tarefa.atendimentoId` (migrations `20261023100000` e `20261023110000`), aceito por `criarTarefa` e gravado pela Aria ao criar tarefa.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-2`

**Arquivos:**
- `prisma/schema.prisma`
- `prisma/migrations/20261023100000_tarefa_atendimento/migration.sql`
- `prisma/migrations/20261023110000_tarefa_atendimento_indice/migration.sql`
- `src/server/crm/tarefas.ts`
- `src/server/aria/turno/executor.ts`

**Critérios de aceite:**
- `src/server/crm/tarefa-atendimento.int.test.ts` passando
- `src/server/aria/turno/executor-crm.int.test.ts` passando
- `src/server/crm/criar-tarefa-idempotencia.int.test.ts` e `tarefas.int.test.ts` sem regressão

**Dependências:**
- Nenhuma

### [Inbox E2.3] Cabeçalho e Detalhes: consultas e rota das abas (D13)

**Labels:** `inbox`, `etapa-2`, `back-end`

Consultas do cabeçalho do painel (tags com ✦, contato sem nome, subtítulo) e da aba Detalhes, respeitando as regras 5 e 6 e o padrão de D13, mais a rota `GET /api/inbox/atendimentos/[id]/painel/[aba]`.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-3`

**Arquivos:**
- `src/server/inbox/painel-detalhes.ts`
- `src/server/inbox/painel-abas.ts`
- `src/server/inbox/paineis.ts`
- `src/app/api/inbox/atendimentos/[id]/painel/[aba]/route.ts`

**Critérios de aceite:**
- `src/server/inbox/painel-detalhes.test.ts` passando
- `src/server/inbox/painel-detalhes.int.test.ts` passando
- `src/app/api/inbox/atendimentos/[id]/painel/[aba]/route.test.ts` passando

**Dependências:**
- E2.1
- D13 (vale o padrão)

### [Inbox E2.4] Tags e contato sem nome no cabeçalho do painel (D20)

**Labels:** `inbox`, `etapa-2`, `ui`

Pílulas de tag com ✦ nas criadas pela Aria, "+ tag" com busca (e criação para quem gerencia equipe), remoção de tag e o bloco "contato sem nome".

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-4`

**Arquivos:**
- `src/app/(app)/inbox/abas/TagsContato.tsx`
- `src/app/(app)/inbox/abas/ContatoSemNome.tsx`
- `src/app/(app)/inbox/PainelContato.tsx`
- `src/app/(app)/inbox/InboxNovo.tsx`
- `src/server/inbox/acoes-painel.ts`
- `src/server/crm/tags.ts`

**Critérios de aceite:**
- `TagsContato.test.ts`, `ContatoSemNome.test.ts` e `src/server/inbox/acoes-painel-tags.int.test.ts` passando
- Aceite visual dos estados `painel-detalhes` e `painel-sem-nome` (1440×900, 1024×768, 390×844, claro e escuro) anexado ao PR

**Dependências:**
- E2.3
- E1 (`PainelContato`)
- D20 (vale o padrão)

### [Inbox E2.5] Aba Detalhes e bloco B2B (D13)

**Labels:** `inbox`, `etapa-2`, `ui`

Conteúdo da aba Detalhes: oportunidade atual, contato, perfil ou empresa, bloco B2B, e o painel do setor fora do comercial.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-5`

**Arquivos:**
- `src/app/(app)/inbox/abas/AbaDetalhes.tsx`
- `src/app/(app)/inbox/abas/BlocoB2B.tsx`
- `src/app/(app)/inbox/abas/abas-painel.ts`
- `src/app/(app)/inbox/abas/useAbaPainel.ts`
- `src/app/(app)/inbox/InboxNovo.tsx`
- `src/app/(app)/inbox/PainelSetor.tsx`

**Critérios de aceite:**
- `AbaDetalhes.test.ts` e `abas-painel.test.ts` passando
- Aceite visual dos estados `painel-detalhes` e `painel-detalhes-b2b` anexado ao PR

**Dependências:**
- E2.3
- E2.4
- D13 (vale o padrão)

### [Inbox E2.6] Gaveta de edição do contato (D14)

**Labels:** `inbox`, `etapa-2`, `ui`

O lápis do painel abre a gaveta "Editar contato", que salva os dados da pessoa e os campos personalizados numa ação só.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-6`

**Arquivos:**
- `src/app/(app)/inbox/abas/GavetaContato.tsx`
- `src/app/(app)/inbox/InboxNovo.tsx`
- `src/server/inbox/acoes-painel.ts`

**Critérios de aceite:**
- `GavetaContato.test.ts` e `src/server/inbox/acoes-painel-contato.int.test.ts` passando
- Aceite visual do estado `painel-editar-contato` anexado ao PR

**Dependências:**
- E2.5
- D14 (vale o padrão)

### [Inbox E2.7] Aba Oportunidades: consulta e barra de etapas (D8)

**Labels:** `inbox`, `etapa-2`, `ui`

Aba Oportunidades com a barra e o select de etapas pelas regras do funil (`destinoDoArraste`), e a ação `moverEtapaNoInbox`.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-7`

**Arquivos:**
- `src/server/inbox/painel-oportunidades.ts`
- `src/server/inbox/painel-abas.ts`
- `src/server/inbox/acoes-painel.ts`
- `src/app/(app)/inbox/abas/etapas-painel.ts`
- `src/app/(app)/inbox/abas/BarraEtapas.tsx`
- `src/app/(app)/inbox/abas/AbaOportunidades.tsx`
- `src/app/(app)/inbox/InboxNovo.tsx`

**Critérios de aceite:**
- `etapas-painel.test.ts`, `AbaOportunidades.test.ts` e `src/server/inbox/painel-oportunidades.int.test.ts` passando
- Aceite visual do estado `painel-oportunidades` anexado ao PR

**Dependências:**
- E2.1
- E2.5
- D8 (vale o padrão)

### [Inbox E2.8] Perda, aula experimental e ações da oportunidade (D8)

**Labels:** `inbox`, `etapa-2`, `ui`

"Marcar como perdido" com o `ModalPerda` do funil, cartão da aula experimental e "Assumir conversa" na aba Oportunidades.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-8`

**Arquivos:**
- `src/app/(app)/inbox/abas/CartaoExperimental.tsx`
- `src/app/(app)/inbox/abas/AbaOportunidades.tsx`
- `src/app/(app)/funil/ModalPerda.tsx`
- `src/server/inbox/acoes-painel.ts`

**Critérios de aceite:**
- `CartaoExperimental.test.ts`, `AbaOportunidades.test.ts`, `ModalPerda.acao.test.ts` e `src/server/inbox/acoes-painel-perda.int.test.ts` passando
- Aceite visual dos estados `painel-oportunidades` e `perda` anexado ao PR

**Dependências:**
- E2.7
- D8 (vale o padrão)

### [Inbox E2.9] Outras oportunidades, nova oportunidade e cliente que volta (D18)

**Labels:** `inbox`, `etapa-2`, `ui`

Outras oportunidades da pessoa, "Nova oportunidade" pelo funil (`/funil?nova=`) e o cartão "já é cliente e voltou", que reaproveita a oportunidade anterior.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-9`

**Arquivos:**
- `src/app/(app)/inbox/abas/OutrasOportunidades.tsx`
- `src/app/(app)/inbox/abas/ClienteVoltou.tsx`
- `src/app/(app)/inbox/abas/AbaOportunidades.tsx`
- `src/app/(app)/inbox/InboxNovo.tsx`
- `src/server/inbox/painel-detalhes.ts`
- `src/app/(app)/funil/page.tsx`
- `src/app/(app)/funil/FunilCliente.tsx`

**Critérios de aceite:**
- `OutrasOportunidades.test.ts`, `ClienteVoltou.test.ts`, `src/server/inbox/cliente-voltou.int.test.ts` e `src/app/(app)/funil/page.test.ts` passando
- Aceite visual do estado `painel-cliente-voltou` anexado ao PR

**Dependências:**
- E2.7
- D18 (vale o padrão)

### [Inbox E2.10] Tarefas da oportunidade: lista e ações (D10)

**Labels:** `inbox`, `etapa-2`, `ui`

Lista de tarefas na aba Oportunidades, com concluir, reabrir, reagendar para amanhã 9h, editar e cancelar com motivo.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-10`

**Arquivos:**
- `src/server/inbox/painel-tarefas.ts`
- `src/server/inbox/painel-oportunidades.ts`
- `src/server/inbox/acoes-painel.ts`
- `src/app/(app)/inbox/quando-tarefa.ts`
- `src/app/(app)/inbox/abas/TarefasOportunidade.tsx`
- `src/app/(app)/inbox/abas/AbaOportunidades.tsx`

**Critérios de aceite:**
- `quando-tarefa.test.ts`, `TarefasOportunidade.test.ts` e `src/server/inbox/acoes-painel-tarefas.int.test.ts` passando
- Aceite visual do estado `painel-oportunidades-tarefas` anexado ao PR

**Dependências:**
- E2.2
- E2.7
- D10 (vale o padrão)

### [Inbox E2.11] Modal de tarefa: criar e editar (D10)

**Labels:** `inbox`, `etapa-2`, `ui`

Modal de tarefa do protótipo, só com os campos atuais do ERP, ligado à conversa, com "Já foi feita".

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-11`

**Arquivos:**
- `src/app/(app)/inbox/ModalTarefa.tsx`
- `src/app/(app)/inbox/InboxNovo.tsx`
- `src/app/(app)/inbox/abas/AbaOportunidades.tsx`
- `src/server/inbox/acoes-painel.ts`

**Critérios de aceite:**
- `ModalTarefa.test.ts` e `src/server/inbox/acoes-painel-criar-tarefa.int.test.ts` passando
- Aceite visual dos estados `tarefa-nova` e `tarefa-editar` anexado ao PR

**Dependências:**
- E2.10
- D10 (vale o padrão)

### [Inbox E2.12] Itens do fio: consulta, rota e notas

**Labels:** `inbox`, `etapa-2`, `ui`

Notas, tarefas ligadas e mensagens agendadas no fio da conversa, intercaladas pela hora; o cartão de nota entra só se a E0 não o entregou.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-12`

**Arquivos:**
- `src/server/inbox/itens-fio.ts`
- `src/app/api/inbox/atendimentos/[id]/fio/route.ts`
- `src/components/conversa/intercalar-fio.ts`
- `src/app/(app)/inbox/useItensFio.ts`
- `src/app/(app)/inbox/ConversaAberta.tsx`
- `src/server/whatsapp/acoes-conversa.ts`

**Critérios de aceite:**
- `intercalar-fio.test.ts`, `src/server/inbox/itens-fio.int.test.ts` e `fio/route.test.ts` passando
- Aceite visual do estado `nota-interna` anexado ao PR

**Dependências:**
- E2.2
- E2.10
- E0 (notas visíveis)
- E1 (thread)

### [Inbox E2.13] Cartões de tarefa e de agendada no fio; entradas de tarefa e nota

**Labels:** `inbox`, `etapa-2`, `ui`

Cartões no fio para tarefa (editar, concluir) e mensagem agendada (reagendar, enviar agora, cancelar); "Criar tarefa" no menu, no compositor e no painel; "Adicionar nota" no painel.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-13`

**Arquivos:**
- `src/components/conversa/CartaoTarefaFio.tsx`
- `src/components/conversa/CartaoAgendadaFio.tsx`
- `src/server/inbox/acoes-painel.ts`
- `src/app/(app)/inbox/MenuConversa.tsx`
- `src/app/(app)/inbox/RodapeConversa.tsx`
- `src/app/(app)/inbox/abas/AbaOportunidades.tsx`
- `src/app/(app)/inbox/InboxNovo.tsx`

**Critérios de aceite:**
- `CartaoTarefaFio.test.ts`, `CartaoAgendadaFio.test.ts` e `src/server/inbox/acoes-painel-agendadas.int.test.ts` passando
- Aceite visual dos estados `fio-tarefa` e `fio-agendada` anexado ao PR

**Dependências:**
- E2.11
- E2.12
- E1 (`MenuConversa`, `RodapeConversa`)

### [Inbox E2.14] Aba Atividade: agendadas, atividade recente e notas (D11)

**Labels:** `inbox`, `etapa-2`, `ui`

Aba Atividade com as mensagens agendadas, o resumo da atividade e as duas últimas notas internas.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-14`

**Arquivos:**
- `src/server/inbox/painel-atividade.ts`
- `src/server/inbox/painel-abas.ts`
- `src/server/inbox/itens-fio.ts`
- `src/app/(app)/inbox/abas/AbaAtividade.tsx`
- `src/app/(app)/inbox/abas/AgendadasAtividade.tsx`
- `src/app/(app)/inbox/InboxNovo.tsx`

**Critérios de aceite:**
- `AbaAtividade.test.ts` e `src/server/inbox/painel-atividade.int.test.ts` passando
- Aceite visual dos estados `painel-atividade` e `painel-atividade-agendadas` anexado ao PR

**Dependências:**
- E2.12
- E2.13
- D11 (vale o padrão)

### [Inbox E2.15] Aba Atividade: Aria neste contato e alterações da IA com desfazer (D1)

**Labels:** `inbox`, `etapa-2`, `ui`

Confiança, regras da etapa e lista das alterações da Aria com desfazer (idempotente por natureza), mais o contador da aba.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-15`

**Arquivos:**
- `src/server/inbox/texto-aria.ts`
- `src/server/inbox/painel-atividade.ts`
- `src/server/inbox/painel-detalhes.ts`
- `src/server/inbox/acoes-painel.ts`
- `src/server/aria/historico.ts`
- `src/app/(app)/inbox/abas/AlteracoesAria.tsx`
- `src/app/(app)/inbox/abas/AbaAtividade.tsx`

**Critérios de aceite:**
- `texto-aria.test.ts`, `AlteracoesAria.test.ts`, `src/server/aria/historico.int.test.ts` e `src/server/inbox/painel-atividade-aria.int.test.ts` passando
- Aceite visual do estado `painel-atividade` (gerente e vendedor) anexado ao PR

**Dependências:**
- E2.14
- D1 (vale o padrão)

### [Inbox E2.16] Atalhos de saída e ?agendar=1

**Labels:** `inbox`, `etapa-2`, `ui`

Links do Inbox para contatos, empresa, matrícula e números; `?agendar=1` abre o agendamento da conversa; corrige o link "Abrir contato" do funil.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-16`

**Arquivos:**
- `src/lib/href-conversa.ts`
- `src/app/(app)/inbox/page.tsx`
- `src/app/(app)/inbox/InboxNovo.tsx`
- `src/app/(app)/inbox/AcoesAtendimento.tsx`
- `src/app/(app)/inbox/PainelSetor.tsx`
- `src/app/(app)/inbox/ColunaConversas.tsx`
- `src/server/inbox/paineis.ts`
- `src/app/(app)/funil/PainelOportunidade.tsx`

**Critérios de aceite:**
- `href-conversa.test.ts`, `PainelSetor.test.ts`, `InboxNovo.interacao.test.ts`, `src/app/(app)/inbox/page.test.ts` e `PainelOportunidade.test.ts` passando
- Aceite visual do estado `agendar-deeplink` anexado ao PR

**Dependências:**
- E2.5
- E1

### [Inbox E2.17] Atalhos de entrada nas outras telas (D21)

**Labels:** `inbox`, `etapa-2`, `ui`

"Abrir conversa" e "Agendar mensagem" no Funil, em Tarefas, em Contatos e no Agente, pela conversa visível da oportunidade ou da pessoa.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-17`

**Arquivos:**
- `src/server/inbox/atalhos.ts`
- `src/server/inbox/painel-detalhes.ts`
- `src/server/aria/consultas.ts`
- `src/app/(app)/funil/PainelOportunidade.tsx`
- `src/app/(app)/tarefas/PainelTarefa.tsx`
- `src/app/(app)/contatos/FichaContato.tsx`
- `src/app/(app)/aria/_componentes/Historico.tsx`

**Critérios de aceite:**
- `src/server/inbox/atalhos.int.test.ts` e `src/server/aria/consultas.int.test.ts` passando
- Testes de render das quatro telas passando
- Aceite visual de `/funil`, `/tarefas`, `/contatos` e `/aria?aba=historico` anexado ao PR

**Dependências:**
- E2.16
- D21 (vale o padrão)

### [Inbox E2.18] Agendar: atalhos de horário, aviso de conflito e salvar rascunho (D11)

**Labels:** `inbox`, `etapa-2`, `ui`

Parte de UI do B6 que não depende de D11: chips de horário, aviso de outra agendada a menos de 2 h e "Salvar rascunho" no compositor.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-18`

**Arquivos:**
- `src/app/(app)/inbox/atalhos-agendar.ts`
- `src/app/(app)/inbox/AcoesAtendimento.tsx`
- `src/components/conversa/Compositor.tsx`

**Critérios de aceite:**
- `atalhos-agendar.test.ts`, `AcoesAtendimento.test.ts` e `src/components/conversa/Compositor.test.ts` passando
- Aceite visual dos estados `agendar-deeplink` e `agendar-conflito` anexado ao PR

**Dependências:**
- E2.14
- E2.16
- D11 (vale o padrão)

### [Inbox E2.19] @menção em nota interna com aviso no sino (D20)

**Labels:** `inbox`, `etapa-2`, `back-end`, `bloqueado-por-decisao`

Mencionar uma pessoa com `@` na nota interna e avisá-la no sino (migration reservada `20261023140000`).

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-19`

**Arquivos:**
- `prisma/migrations/20261023140000_notificacao_mencao_nota/migration.sql`
- `src/server/inbox/mencoes.ts`
- `src/server/whatsapp/acoes-conversa.ts`
- `src/app/(app)/tarefas/SinoNotificacoes.tsx`
- `src/app/(app)/inbox/RodapeConversa.tsx`

**Critérios de aceite:**
- Testes da task passando
- Aceite visual do estado `nota-interna` com a lista de menção anexado ao PR

**Dependências:**
- D20 (aguarda resposta)
- E2.12

### [Inbox E2.20] Tarefa: prioridade baixa, lembretes de 15 min e 1 dia, recorrência e "notificar também" (D10)

**Labels:** `inbox`, `etapa-2`, `back-end`, `bloqueado-por-decisao`

Campos de tarefa do protótipo que o ERP não tem (migrations reservadas `20261023120000` e `20261023130000`).

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-20`

**Arquivos:**
- `prisma/migrations/20261023120000_tarefa_prioridade_lembretes/migration.sql`
- `prisma/migrations/20261023130000_tarefa_recorrencia_notificar/migration.sql`
- `src/server/crm/tarefas.ts`
- `src/server/crm/lembretes.ts`
- `src/app/(app)/inbox/ModalTarefa.tsx`

**Critérios de aceite:**
- Testes da task passando
- Aceite visual do estado `tarefa-nova-mais-opcoes` anexado ao PR

**Dependências:**
- D10 (aguarda resposta)
- E2.11

### [Inbox E2.21] Tarefa: "Enviar mensagem nesta data" (D11)

**Labels:** `inbox`, `etapa-2`, `back-end`, `bloqueado-por-decisao`

Agendar a mensagem ao contato junto da tarefa, ligada a ela.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-21`

**Arquivos:**
- `src/server/whatsapp/acoes-conversa.ts`
- `src/server/inbox/acoes-painel.ts`
- `src/app/(app)/inbox/ModalTarefa.tsx`

**Critérios de aceite:**
- Testes da task passando
- Aceite visual do estado `tarefa-nova-mais-opcoes` anexado ao PR

**Dependências:**
- D11 (aguarda resposta)
- E2.11

### [Inbox E2.22] CPF e idade na Pessoa (D13)

**Labels:** `inbox`, `etapa-2`, `back-end`, `bloqueado-por-decisao`

Documento e data de nascimento na Pessoa, no painel e na gaveta (migration reservada `20261023150000`).

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-22`

**Arquivos:**
- `prisma/migrations/20261023150000_pessoa_cpf_nascimento/migration.sql`
- `src/server/crm/contatos.ts`
- `src/server/inbox/painel-detalhes.ts`
- `src/app/(app)/inbox/abas/AbaDetalhes.tsx`
- `src/app/(app)/inbox/abas/GavetaContato.tsx`

**Critérios de aceite:**
- Testes da task passando
- Aceite visual do estado `painel-detalhes` anexado ao PR

**Dependências:**
- D13 (aguarda resposta)
- E2.5
- E2.6

### [Inbox E2.23] Probabilidade e previsão de fechamento da oportunidade (D13)

**Labels:** `inbox`, `etapa-2`, `back-end`, `bloqueado-por-decisao`

Probabilidade e previsão de fechamento na oportunidade e na aba Oportunidades (migration reservada `20261023160000`).

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-23`

**Arquivos:**
- `prisma/migrations/20261023160000_oportunidade_probabilidade_previsao/migration.sql`
- `src/server/comercial/schema.ts`
- `src/server/comercial/acoes.ts`
- `src/server/crm/historico.ts`
- `src/server/inbox/painel-oportunidades.ts`
- `src/app/(app)/inbox/abas/AbaOportunidades.tsx`

**Critérios de aceite:**
- Testes da task passando
- Aceite visual do estado `painel-oportunidades` anexado ao PR

**Dependências:**
- D13 (aguarda resposta)
- E2.7
