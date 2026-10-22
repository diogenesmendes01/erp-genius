# Inbox no patamar do protótipo, Etapa 2: painel com o CRM dentro do Inbox. Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o painel do contato no `/inbox` passa a ser um mini-CRM: abas Detalhes, Oportunidades e Atividade, tags, edição do contato, etapa e perda, tarefas com cartão no fio, alterações da Aria com desfazer, e os atalhos de entrada e de saída do Inbox.

**Architecture:** quase tudo reaproveita o servidor do CRM (`comercial/acoes.ts`, `crm/tarefas.ts`, `crm/tags.ts`, `crm/contatos.ts`, `aria/historico.ts`). As consultas novas ficam em `src/server/inbox/painel-*.ts`. O cabeçalho e as tarefas do fio vão no payload do painel que já existe (`carregarPainel`, recarregado a cada `atendimento.atualizado`); o conteúdo de cada aba sai por uma rota de leitura por aba (`/api/inbox/atendimentos/[id]/painel/[aba]`). As escritas do Inbox passam por *wrappers* em `src/server/inbox/acoes-painel.ts`: eles conferem o atendimento e o alvo, chamam a ação de domínio e publicam `atendimento.atualizado` (`avisarAtendimento`). O único modelo novo é `Tarefa.atendimentoId`.

**Tech Stack:** Next.js (App Router, Server Actions), Prisma/PostgreSQL, Zod, React, Tailwind com tokens, `@tabler/icons-react`, Vitest (unit com `renderToStaticMarkup`, `*.int.test.ts` no banco descartável).

**Spec:**
- `docs/planejamento/inbox-prototipo/analise-parte3-telas-atalhos.md`: blocos B1–B5 e B7 do §7; T13–T15, T19, T23–T27, A01–A12, A18, A24; §4 e §5.
- `docs/planejamento/inbox-prototipo/analise-parte2-botoes-funcionalidades.md`: §3 (T6), §5 (F4), §7 (P2–P30), §8 (R1–R8).
- `docs/planejamento/inbox-prototipo/analise-parte1-design.md` §3.7 (painel).
- Protótipo `docs/planejamento/inbox-prototipo/prototipo/Inbox.dc.html`: `P:473-650` (painel), `P:283-297` (cartão de tarefa), `P:680-735` (modal de tarefa), `P:887-933`, `P:1005-1007` e `P:1119-1154` (lógica).
- Contrato comum: `docs/superpowers/plans/2026-10-22-inbox-prototipo-00-indice.md`. Vale inteiro e não é repetido aqui.
- Planos vizinhos consumidos sem renomear: `…-01-correcoes.md` (E0), `…-02-design.md` (E1), `…-04-aria.md` (E3), `…-05-fluxos.md` (E4).

## Global Constraints

Valem todas as do índice ("Global Constraints"), mais estas da E2:

- Faixa de migration da E2: `20261023100000`–`20261023190000`. Nenhuma fora dela.
- Nenhum arquivo em `src/app/(app)/inbox/**` usa `router.refresh()` nem `setInterval(` (trava `sem-polling.test.ts:9-13`). Depois de uma ação, a tela chama `aoMudar()`, e o `InboxNovo` recarrega o painel (`versaoPainel`); o SSE avisa os outros.
- Toda ação nova do Inbox publica `atendimento.atualizado` pelo `avisarAtendimento` (Task 1). Nenhum tipo novo em `AvisoInbox`.
- Nenhuma regra nova de papel. Quem pode cada coisa vem da matriz do CRM (`crm/permissoes.ts:33-48`), da Aria (`aria/permissoes-tela.ts:27-31`) e de `podeExecutar` (`inbox/permissoes.ts:41-74`). A "Matriz das ações novas" abaixo é a única fonte.
- Enquanto a decisão estiver aberta, vale o padrão da tabela do índice: D8 segue `destinoDoArraste`; D10 só os campos atuais de `criarTarefa` e cancelar com motivo; D13 sem telefone no pedagógico, sem CPF e idade, abas comerciais só na finalidade `COMERCIAL`; D14 gaveta para edição rápida e "Abrir ficha completa" navega; D18 reaproveita a oportunidade; D20 tag sem autor ganha ✦ e @menção não avisa; D21 entradas só como link; D1 só Admin e Gerente Comercial desfazem; D11 campos atuais do agendamento.
- Textos do protótipo copiados em sentence case e pt-BR. Quando o ERP não tem o dado, a tela mostra "—" (`P:1127`).
- Dinheiro: `formatarMoedaOuIndefinida(valor, moeda)` (`lib/dinheiro.ts:194`). Instantes: `formatarInstanteExibicao(iso, fusoPessoal, fusoEscola)` (`operacao/fuso-exibicao.ts:42`). Data e hora de tarefa: data civil e hora no fuso da escola (`crm/tarefas.ts:89-101`).
- Linhas de campo do painel usam o `LinhaCampo` da E1 (`02-design.md`, Task 13); pílulas, abas e contagem seguem os valores da mesma task.
- Verificação: unit `node_modules/.bin/vitest run <arquivo>`; integração `node_modules/.bin/vitest run -c vitest.integration.config.ts <arquivo>`, com o `.erp-test-profile` do worktree. Antes do PR: `node_modules/.bin/tsc --noEmit`, `npm test` e `npm run lint`, com saída 0.
- Aceite visual pelo harness da E1: cada task acrescenta seus estados a `ESTADOS` (`scripts/visual/nucleo-captura.mjs`) e os passos a `PASSOS_APP`/`PASSOS_PROTOTIPO` (`scripts/visual/capturar-inbox.mjs`), completa a demo em `criarDemoInbox` (`scripts/visual/demo-inbox.ts`; ids `mariana`, `ventura`, `beatriz`, `lucas`, `thiago`, `semNome`, `fernanda`) e roda `node scripts/visual/capturar-inbox.mjs --alvo ambos --estado <nome>`.
- Cada commit acrescenta a linha da entrega em `docs/planejamento/quadro-entregas.md` (seção "Inbox protótipo, E2") e termina com o trailer de co-autoria do projeto.

## Review Focus

1. **Dado de quem não deveria ver.** Pessoa de responsável legal no comercial (regra 6, `inbox/paineis.ts:60-61`), oportunidade de linha alheia (LC-L02, `whatsapp/consultas-inbox.ts:181-190`) e telefone no pedagógico (regra 5): o painel não mostra pessoa, campos, tarefas nem ações. Testes na Task 3 (`regra_6_e_linha_alheia_nao_carregam_pessoa`) e na Task 7 (`linha_alheia_sem_oportunidade`).
2. **Oportunidade encerrada** (`MATRICULADO` ou `PERDIDO`): barra e select travados com o motivo de `destinoDoArraste`; "Marcar como perdido" some. Testes na Task 7 (`opcoes_de_oportunidade_encerrada_sao_todas_recusadas`) e na Task 8 (`perdido_some_em_oportunidade_encerrada`).
3. **Tarefa alterada por outra pessoa** entre a leitura e o clique (versão otimista, `crm/tarefas.ts:151-154`): aparece "Esta tarefa foi alterada por outra pessoa. Recarregue.", nada é gravado e o painel recarrega. Teste na Task 10 (`versao_antiga_recusa_e_nao_grava`).
4. **Atalhos de horário da tarefa.** São calculados no fuso da escola, não no pessoal; "Hoje 18:00" some depois das 18h na escola; "Segunda 09:00" numa segunda vai para a próxima. Teste na Task 10 (`atalhosDeHorario`).
5. **Oportunidade sem pessoa** (`Oportunidade.pessoaId` nulo, comum em lead antigo): a aba Detalhes mostra a oportunidade e "Sem dados de contato para esta oportunidade.", sem lápis, sem "+ tag" e sem "Nova oportunidade". Testes na Task 3 (`oportunidade_sem_pessoa`) e na Task 5 (`sem_pessoa_sem_edicao`).

---

## Acréscimos ao contrato

Nada do índice nem das outras etapas é renomeado. A E2 acrescenta:

| Onde | Acréscimo | Por quê |
|---|---|---|
| `PainelContato.tsx` (E1) | Props opcionais `slotTags?: React.ReactNode` (substitui a linha de tags de leitura), `slotAviso?: React.ReactNode` (entre o cabeçalho e as abas) e `aoEditar?: () => void` (lápis de 34 px no canto superior direito, `P:475`; ausente esconde) | Tags, avisos e edição moram no cabeçalho (`P:475-489`) |
| `ABAS_ENTREGUES` e `abasDoPainel` (E1, `PainelContato.tsx`) | A Task 7 acrescenta `"oportunidades"` e a Task 13 acrescenta `"atividade"`, como a regra da E1 manda. `abasDoPainel(finalidade, contagens?: Partial<Record<IdAbaPainel, number>>)`: o segundo parâmetro é opcional e vira `contagem` na aba | Abas e contador da Atividade (`P:494`, `P:1114`) |
| `TagPainel` (E1, `{ rotulo: string; ia: boolean }`) | Campo `id: string`, preenchido por `tagsDaPessoa` (`paineis.ts`, E1) | Remover tag pelo painel |
| `PainelSetor` (`paineis.ts`) | `cabecalho?: CabecalhoPainel \| null` (Task 3) e `tarefasNoFio?: TarefaPainel[]` (Task 12); `DadosSetor` de `FINANCEIRO` e `SECRETARIA` ganha `matriculaId: string \| null` (Task 15) | Cabeçalho, cartões de tarefa e link da matrícula |
| `RodapeConversa` (E1) | `pedidoNota?: number` (cada valor novo troca para a aba Nota e foca o campo) e `aoCriarTarefa?: () => void` (ícone `IconListCheck` "Nova tarefa", `P:427`; a E1 reservou o lugar) | "Adicionar nota" do painel e tarefa pelo rodapé |
| `itensDoMenuConversa` (E1, `AcoesAtendimento.tsx`) | Item `{ id: "criar-tarefa", rotulo: "Criar tarefa", icone: <IconListCheck /> }` quando `acoes.criarTarefa` existe, logo antes de "Agendar mensagem" (`P:1183`) | T14 da análise |
| Fio (E0: `ItemThread`, `itensDaThread`) | `type ItemFio = ItemThread \| { tipo: "tarefa"; id: string; t: TarefaPainel }` e `intercalarFio(base: ItemThread[], tarefas: TarefaPainel[], o: { temMaisAntes: boolean }): ItemFio[]` em `src/components/conversa/intercalar-fio.ts`. A E3 já consome esses dois nomes (`04-aria.md`, Task 9) | Cartão de tarefa no fio |
| `funil/ModalPerda.tsx` | Prop opcional `acao?: (input: { motivoPerda: MotivoPerda; observacao?: string }) => Promise<Resultado>`; com ela o modal chama `acao` e não chama `router.refresh()` | Perda pelo Inbox, com aviso e sem refresh |
| `server/inbox/permissoes.ts` | `capacidadesPainel(u, ctx): CapacidadesPainel` (Task 1) | Uma fonte só para o que o painel mostra |
| `server/inbox/` | Novos: `aviso.ts`, `painel-detalhes.ts`, `painel-oportunidades.ts`, `painel-tarefas.ts`, `painel-atividade.ts`, `painel-abas.ts`, `atalhos.ts`, `texto-aria.ts`, `acoes-painel.ts` (`"use server"`) | Consultas e ações da E2 |
| Rota | `GET /api/inbox/atendimentos/[id]/painel/[aba]`, `aba` ∈ `detalhes`, `oportunidades`, `atividade` | Leitura por aba |
| `src/app/(app)/inbox/abas/` | Além dos três arquivos do contrato: `useAbaPainel.ts`, `TagsContato.tsx`, `ContatoSemNome.tsx`, `ClienteVoltou.tsx`, `BlocoB2B.tsx`, `GavetaContato.tsx`, `etapas-painel.ts`, `BarraEtapas.tsx`, `CartaoExperimental.tsx`, `OutrasOportunidades.tsx`, `TarefasOportunidade.tsx`, `AgendadasAtividade.tsx`, `AlteracoesAria.tsx` | Conteúdo das abas |
| `src/app/(app)/inbox/ModalTarefa.tsx`, `src/components/conversa/CartaoTarefaFio.tsx` | Modal e cartão de tarefa | T13–T15 da análise |
| `src/lib/atalhos-horario.ts` | Criado pela E2 **com a interface da E4** (`05-fluxos.md`, Task 4): `IdAtalhoHorario`, `AtalhoHorario { id; rotulo; valorLocal }`, `atalhosDeHorario(agora, fuso)`, sem o atalho `"1h"` (a E4 o acrescenta), mais `partesDoValorLocal` | A E4 pediu um módulo só |
| `src/lib/href-conversa.ts` | `hrefConversa(atendimentoId: string, o?: { agendar?: boolean }): string` | Atalhos de entrada (a E4 lê o `?agendar=1`) |
| Modelo | `Tarefa.atendimentoId String?` com relação para `AtendimentoWhatsApp` (`tarefas Tarefa[]`) e `@@index([atendimentoId, status])` | Cartão no fio e "Conversa vinculada" |
| Tipos de domínio | `TarefaInput.atendimentoId?: string` (só na criação); `ItemHistoricoAria.atendimentoId: string \| null` | Vínculo e "Abrir conversa" no Agente |

**Pedidos às outras etapas** (para não haver dono duplo):
- **E4:** a seção "Mensagens agendadas" da aba Atividade (Task 13) sai com a lista e "Cancelar". A E4 acrescenta "Reagendar" e "Enviar agora" com os wrappers da Task 3 dela e pode trocar a consulta pela `agendadasDoAtendimento`. O `?agendar=1` (leitura), o popover de agendar, os atalhos de horário do agendamento, o conflito, o rascunho e os cartões de agendada no fio são da E4 (Tasks 3–5).
- **E3:** o `ItemFio` da E2 não tem a variante `agendada` que a Task 9 da E3 cita; as agendadas vão no slot `cartoesNoFio` da E4. A `intercalarSugestoes` da E3 continua valendo, porque é genérica.

## Dependências

- **E0** (`01-correcoes.md`): notas do atendimento na rota e no fio (`notasInternasDoAtendimento`, `NotaInternaThread.origem`, `itensDaThread`, `ItemThread`, `NotaNaThread`). A E2 não refaz nada disso.
- **E1** (`02-design.md`): `PainelContato`, `AbasPainel`, `LinhaCampo`, `TagPainel`, `tagsDaPessoa`, `abasDoPainel`, `ABAS_ENTREGUES`, estado `aba` no `InboxNovo`, `RodapeConversa`, `itensDoMenuConversa`, o seletor de número com "Gerenciar números em Configurações" e o harness visual.
- **E3/E4:** ver "Pedidos às outras etapas". "Assumir" com pausa da Aria (D3) é da E3; a E2 mostra o "Assumir" atual.

## Matriz das ações novas

Todas em `src/server/inbox/acoes-painel.ts` (`"use server"`). Todas começam por `exigirSessao()` e `atendimentoVisivel(u, atendimentoId)` (`whatsapp/atendimentos.ts:79`), recusam com "Atendimento não encontrado." fora do escopo e, no sucesso, terminam com `avisarAtendimento`.

| Ação | Permissão (sem regra nova) | Domínio reaproveitado | Idempotência (#166) |
|---|---|---|---|
| `moverEtapaNoInbox(atendimentoId: string, etapa: EtapaLead): Promise<Resultado>` | `COMERCIAL` e lead do atendimento; `moverEtapaTx` exige `VENDEDOR`/`GERENTE_COMERCIAL` e escopo de carteira | `moverEtapaTx` (`crm/mover-etapa.ts:18-36`) | Por natureza: a mesma etapa é `"nenhum"`, sem Evento (`crm/etapas.ts:30`) |
| `marcarPerdidoNoInbox(atendimentoId: string, input: PerdaInput): Promise<Resultado>` | idem | `marcarPerdido` (`comercial/acoes.ts:572-602`) | Por natureza (`acoes.ts:578-585`) |
| `atribuirTagNoInbox(atendimentoId: string, tagId: string)` e `removerTagNoInbox(atendimentoId: string, tagId: string): Promise<Resultado>` | `contatos.editar`; pessoa do atendimento em `escopoPessoas` | `atribuirTag`/`removerTag` (`crm/tags.ts:126-132`) | Por natureza (`tags.ts:104`) |
| `criarEAtribuirTagNoInbox(atendimentoId: string, nome: string): Promise<Resultado<{ tagId: string }>>` | `carteira.equipe` e `contatos.editar` (as de `criarTag`, `tags.ts:39`) | `TagSchema` (`tags.ts:25-34`), `atribuirTag` | Por natureza: nome único, tag existente reaproveitada, `PessoaTag` existente sem Evento |
| `editarContatoNoInbox(atendimentoId: string, input: EditarContatoInbox): Promise<Resultado>` | `contatos.editar`; pessoa do atendimento | `editarPessoa` (`crm/contatos.ts:430`), `definirValorCampo` (`crm/campos.ts:147`) | Por natureza: diff vazio e valor igual não gravam Evento (`contatos.ts:454`, `campos.ts:190`) |
| `criarTarefaNoInbox(atendimentoId: string, input: TarefaInboxInput): Promise<Resultado<{ id: string }>>` | `tarefas.ver` | `criarTarefa` (`crm/tarefas.ts:161`), `concluirTarefa` (`:276`) | Chave por envio (marca no `TarefaCriada`, `tarefas.ts:166-176`); "Já foi feita" reconhece a conclusão do mesmo autor |
| `editarTarefaNoInbox`, `concluirTarefaNoInbox`, `reabrirTarefaNoInbox`, `reagendarTarefaNoInbox`, `cancelarTarefaNoInbox` | `tarefas.ver`; tarefa em `escopoTarefas`, ligada ao atendimento ou ao lead dele | `tarefas.ts:217-367` | Versão otimista, sem garantia de repetição; tela com `idempotente: false`, como `tarefas/PainelTarefa.tsx:51-55`. Cancelar é por natureza (`tarefas.ts:352-360`) |
| `cancelarAgendadaNoInbox(atendimentoId: string, intencaoId: string): Promise<Resultado>` | autor ou Admin (as de `cancelarMensagemAgendada`) | `cancelarAgendamentoDoAtendimento` (`whatsapp/acoes-conversa.ts:102-117`) | Por natureza (`mensagens-agendadas.ts:340-345`) |
| `desfazerAcaoAriaNoInbox(atendimentoId: string, acaoId: string): Promise<Resultado>` | `decidirHistorico` (D1: Admin e GC) e escopo (`aria/escopo-decisao.ts:35`) | `desfazerAcaoAria` (`aria/historico.ts:163-176`) | Por natureza, **nova** no domínio (Task 14) |
| `dadosModalTarefaNoInbox(atendimentoId: string): Promise<Resultado<DadosModalTarefa>>` (leitura) | `tarefas.ver` | `listarResponsaveisPossiveis` (`crm/tarefas-consulta.ts:43`) | — |

## Migrations

| ID | Task | Conteúdo | Estado |
|---|---|---|---|
| `20261023100000_tarefa_atendimento` | 2 | `Tarefa.atendimentoId` e FK | Entra |
| `20261023110000_tarefa_atendimento_indice` | 2 | `CREATE INDEX CONCURRENTLY`, sozinho | Entra |
| `20261023120000_tarefa_prioridade_lembretes` | 18 | `PrioridadeTarefa.BAIXA` | Reservada (D10) |
| `20261023130000_tarefa_recorrencia_notificar` | 18 | Recorrência e "notificar também" | Reservada (D10) |
| `20261023140000_notificacao_mencao_nota` | 17 | `TipoNotificacao.MENCAO_NOTA` | Reservada (D20) |
| `20261023150000_pessoa_cpf_nascimento` | 20 | `Pessoa.documento`, `Pessoa.nascimento` | Reservada (D13) |
| `20261023160000_oportunidade_probabilidade_previsao` | 21 | `Lead.probabilidadePct`, `Lead.previsaoFechamento` | Reservada (D13) |
| `20261023170000`–`20261023190000` | — | Livres | — |

---

<a id="task-1"></a>
### Task 1: Aviso do atendimento e capacidades do painel

**Files:**
- Create: `src/server/inbox/aviso.ts`
- Modify: `src/server/inbox/permissoes.ts` (acrescenta `capacidadesPainel` no fim)
- Modify: `src/server/whatsapp/acoes-atendimento.ts:323-325` (`avisarMudancaDeEscopo` delega a `avisarAtendimento`)
- Test: `src/server/inbox/aviso.int.test.ts`, `src/server/inbox/permissoes.test.ts` (casos novos)

**Interfaces:**
- Consumes: `capacidadesCrm` (`crm/permissoes.ts:50`), `capacidadesAria` (`aria/permissoes-tela.ts:27`).
- Produces:
  - `avisarAtendimento(db: Prisma.TransactionClient | typeof prisma, atendimentoId: string): Promise<void>`
  - `type CapacidadesPainel = { veLead: boolean; verContato: boolean; editarContato: boolean; editarTags: boolean; criarTag: boolean; moverEtapa: boolean; tarefas: boolean; tarefasEquipe: boolean; desfazerAria: boolean; verEmpresa: boolean }`
  - `capacidadesPainel(u: Pick<UsuarioSessao, "id" | "papeis">, ctx: { finalidade: Setor; veLead: boolean }): CapacidadesPainel`

- [ ] **Step 1: Write the failing tests**

```ts
// src/server/inbox/permissoes.test.ts (acrescentar)
const u = (papeis: Papel[]) => ({ id: "u1", papeis });
describe("capacidadesPainel", () => {
  it("vendedor no comercial com o lead visível edita contato, tags e etapa; não cria tag nem desfaz a Aria", () => {
    expect(capacidadesPainel(u([Papel.VENDEDOR]), { finalidade: "COMERCIAL", veLead: true })).toEqual({
      veLead: true, verContato: true, editarContato: true, editarTags: true, criarTag: false, moverEtapa: true,
      tarefas: true, tarefasEquipe: false, desfazerAria: false, verEmpresa: false });
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
  it("professor não tem tarefas", () => {
    expect(capacidadesPainel(u([Papel.PROFESSOR]), { finalidade: "PEDAGOGICO", veLead: false }).tarefas).toBe(false);
  });
});
```

```ts
// src/server/inbox/aviso.int.test.ts — escuta e cenário como em whatsapp/participantes-aviso.int.test.ts:1-36
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

`avisarAtendimento`: o mesmo `UPDATE "AtendimentoWhatsApp" SET "id" = "id" WHERE "id" = ${atendimentoId}` de `acoes-atendimento.ts:323-325`, que dispara o trigger `notificar_inbox_atendimento` (`migrations/20261017100000_inbox_tempo_real/migration.sql:38`); o NOTIFY sai no commit. `capacidadesPainel`: `comercial = finalidade === "COMERCIAL"`; `editarContato = editarTags = comercial && veLead && crm.has("contatos.editar")`; `criarTag = editarTags && crm.has("carteira.equipe")`; `moverEtapa = comercial && veLead && crm.has("funil.mover")`; `tarefas = crm.has("tarefas.ver")`; `tarefasEquipe = crm.has("tarefas.equipe")`; `desfazerAria = comercial && veLead && capacidadesAria(u).has("decidirHistorico")`; `verContato = crm.has("contatos.ver")`; `verEmpresa` = `ADMINISTRADOR` ou `FINANCEIRO` (guard de `empresas/[id]/page.tsx:13-17`; o vendedor não abre `/empresas/[id]`).

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos, mais `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/participantes-aviso.int.test.ts` (o aviso do convite não muda). Expected: PASS.

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
- Produces: coluna `Tarefa.atendimentoId`; `TarefaInput.atendimentoId?: string` (só na criação; `editarTarefa` descarta); `TarefaCriada.payload.atendimentoId: string | null`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/server/crm/tarefa-atendimento.int.test.ts — sessão trocada como em crm/criar-tarefa-idempotencia.int.test.ts:8-20;
// número e atendimento com criarNumeroSetor e garantirAtendimento (whatsapp/participantes-aviso.int.test.ts:29-36)
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
  expect((await criarTarefa({ titulo: "Ligar", tipo: "LIGACAO", atendimentoId: b.id, chaveIdempotencia: "k2" })).ok).toBe(false);
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
-- Vínculo da tarefa com a conversa (Inbox E2, T13): cartão no fio e "Conversa vinculada". Nulo nas tarefas de antes.
ALTER TABLE "Tarefa" ADD COLUMN "atendimentoId" TEXT;
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "AtendimentoWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

```sql
-- 20261023110000_tarefa_atendimento_indice/migration.sql
-- CONCURRENTLY não trava escrita em "Tarefa"; é o único comando da migration porque não roda em transação.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Tarefa_atendimentoId_status_idx" ON "Tarefa"("atendimentoId", "status");
```

No schema: em `Tarefa`, `atendimentoId String?`, `atendimento AtendimentoWhatsApp? @relation(fields: [atendimentoId], references: [id], onDelete: Restrict)` e `@@index([atendimentoId, status])`; em `AtendimentoWhatsApp`, `tarefas Tarefa[]`. Depois, `node_modules/.bin/prisma generate`.

- [ ] **Step 4: Implement the domain**

`CriarTarefaSchema = CamposSchema.extend({ chaveIdempotencia: …, atendimentoId: z.string().min(1).optional() })`. Fica fora de `CamposSchema`, então `editarTarefa` o descarta. Em `criarTarefa`, depois da repetição e antes de `validarVinculos`: com `atendimentoId`, chamar `atendimentoVisivel(autor, atendimentoId, false, tx)`; se vier nulo, `ErroRegra("Atendimento não encontrado.")`. Gravar `atendimentoId` na tarefa e no payload do `TarefaCriada`. No executor da Aria, passar ao `tarefa.create` o `atendimentoId` do turno, o mesmo que o `case "AGENDAR_MENSAGEM"` usa (`executor.ts:447`).

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
- Test: `src/server/inbox/painel-detalhes.test.ts`, `src/server/inbox/painel-detalhes.int.test.ts`, `src/app/api/inbox/atendimentos/[id]/painel/[aba]/route.test.ts`

**Interfaces:**
- Consumes: `capacidadesPainel` (Task 1); `podeVerLeadNaThread` (`whatsapp/consultas-inbox.ts:181`); `escopoPessoas` (`crm/pessoas.ts:32`); `camposDaPessoa`, `CampoDaFicha` (`crm/ficha-dados.ts:11-37`); `tagsAtivas` (`ficha-dados.ts:40`); `nomeEFonteDoAtendimento` (`whatsapp/nome-contato.ts:34-45`).
- Produces, em `painel-detalhes.ts`:
  - `type CabecalhoPainel = { pessoaId: string | null; tagsDisponiveis: { id: string; nome: string }[]; subtitulo: string | null; quadrado: boolean; semNome: boolean; capacidades: CapacidadesPainel }` (a Task 9 acrescenta `clienteVoltou`; a Task 14, `contadorAtividade`)
  - `type CampoPainel = CampoDaFicha & { ia: boolean }`
  - `type PessoaPainel = { id: string; nome: string; email: string | null; cidade: string | null; cargo: string | null; linkedin: string | null; origemCanal: OrigemCanal | null; telefone: string | null; empresa: { id: string; nome: string; documento: string | null; segmentoMercado: string | null; porte: string | null; site: string | null } | null }`
  - `type ResumoOportunidadePainel = { id: string; titulo: string; produto: string | null; valor: string | null; moeda: string | null; etapa: EtapaLead; b2b: boolean }`
  - `type BlocoB2BPainel = { empresa: { id: string; nome: string }; participantes: { pessoaId: string; nome: string; papel: PapelParticipante; cargo: string | null; naConversa: boolean; hrefConversa: string | null }[]; decisor: boolean | null }`
  - `type DetalhesPainel = { pessoa: PessoaPainel | null; oportunidade: ResumoOportunidadePainel | null; b2b: BlocoB2BPainel | null; campos: CampoPainel[] }`
  - `pessoaDoAtendimento(u: UsuarioSessao, atendimentoId: string, db?: Db): Promise<{ pessoaId: string; leadId: string | null } | null>`
  - `carregarCabecalhoPainel(u: UsuarioSessao, atendimentoId: string): Promise<CabecalhoPainel | null>`
  - `carregarDetalhesPainel(u: UsuarioSessao, atendimentoId: string): Promise<DetalhesPainel | null>`
  - `subtituloContato(i: { b2b: boolean; produto: string | null; cargo: string | null; empresa: string | null; interlocutor: { nome: string; papel: PapelParticipante } | null }): string`
- Produces, em `painel-abas.ts`: `type AbaDados = "detalhes" | "oportunidades" | "atividade"` e `carregarAbaPainel(u: UsuarioSessao, atendimentoId: string, aba: AbaDados): Promise<unknown | null>`. Nesta task só `"detalhes"` responde; `"oportunidades"` e `"atividade"` entram nas Tasks 7 e 13.

Regras fixadas aqui:
- **Pessoa do atendimento:** só em `COMERCIAL` (D13). É a `lead.pessoaId` quando `podeVerLeadNaThread` deixa e a pessoa não é responsável legal (regra 6, `paineis.ts:60-61`). Sem lead, é a `contato.pessoaId` dentro de `escopoPessoas`. Fora disso, `null`.
- **Fora do comercial:** `carregarDetalhesPainel` devolve `{ pessoa: null, oportunidade: null, b2b: null, campos: [] }`; a aba Detalhes fica com o conteúdo da E1.
- **✦ do campo:** `ia = true` quando o último `CampoPersonalizadoAlterado` da pessoa para aquele `campoId` tem `autorId === null` (a Aria grava assim, `aria/turno/executor.ts:411-416`). O ✦ da tag já vem da E1 (`TagPainel.ia`).
- **Sem nome:** `semNome = fonte === "contato" && !nomeExibicao && !nomePerfil` (`nome-contato.ts:19-45`).
- **Telefone:** `contato.telefoneE164`, só no comercial (a regra 5 cobre o pedagógico, que nem chega aqui).
- **Subtítulo** (`P:1138`):
  - B2B com o contato entre os participantes: `Falando com <nome> · <PAPEL_PARTICIPANTE_LABEL>`;
  - B2B sem ele: `<cargo> · <empresa>`, sem as partes nulas;
  - B2C: `Pessoa física · <produto ?? título>`;
  - sem oportunidade: `Pessoa física`;
  - fora do comercial: `null` (vale o subtítulo da E1).
- **Quadrado:** `quadrado = oportunidade?.b2b === true` (avatar quadrado da E1 para empresa).
- `tagsDisponiveis` = `tagsAtivas()` só com `capacidades.editarTags`; senão `[]`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/server/inbox/painel-detalhes.test.ts
describe("subtituloContato", () => {
  it("B2C mostra o produto", () => expect(subtituloContato({ b2b: false, produto: "Inglês Intensivo B1", cargo: null, empresa: null, interlocutor: null })).toBe("Pessoa física · Inglês Intensivo B1"));
  it("B2B com interlocutor", () => expect(subtituloContato({ b2b: true, produto: null, cargo: "Gerente de RH", empresa: "Grupo Ventura", interlocutor: { nome: "Rafael Nunes", papel: "DECISOR" } })).toBe("Falando com Rafael Nunes · Decisor"));
  it("B2B sem interlocutor junta cargo e empresa sem partes vazias", () => expect(subtituloContato({ b2b: true, produto: null, cargo: null, empresa: "Clínica Santa Helena", interlocutor: null })).toBe("Clínica Santa Helena"));
});
```

```ts
// src/server/inbox/painel-detalhes.int.test.ts — fixtures como inbox/paineis.int.test.ts:14-29
it("comercial: pessoa, oportunidade e campos; ✦ só no campo que a Aria preencheu por último", async () => {
  // campo "Objetivo" com CampoPersonalizadoAlterado autorId null; "Nível" com autorId = vendedor
  const d = await carregarDetalhesPainel(sess(dono), a.id);
  expect(d).toMatchObject({ pessoa: { id: p.id, email: "mariana@x.com", telefone: "+5511984213307" },
    oportunidade: { id: op.id, produto: "Inglês Intensivo B1", valor: "650.00", etapa: "PROPOSTA", b2b: false } });
  expect(d!.campos.map((x) => [x.nome, x.ia])).toEqual([["Objetivo", true], ["Nível", false]]);
});
it("regra_6_e_linha_alheia_nao_carregam_pessoa", async () => {
  expect(await carregarDetalhesPainel(sess(dono), atendimentoDaMae.id)).toMatchObject({ pessoa: null, campos: [] });
  expect(await carregarCabecalhoPainel(sess(donoDaLinhaSemCarteira), a.id)).toMatchObject({ pessoaId: null, tagsDisponiveis: [], capacidades: { veLead: false } });
});
it("oportunidade_sem_pessoa", async () => {
  expect(await carregarDetalhesPainel(sess(dono), semPessoa.id)).toMatchObject({ pessoa: null, oportunidade: { id: opSemPessoa.id }, campos: [] });
  expect((await carregarCabecalhoPainel(sess(dono), semPessoa.id))!.pessoaId).toBeNull();
});
it("fora do comercial não traz nada da pessoa (D13)", async () => {
  expect(await carregarDetalhesPainel(sess(fin), atFinanceiro.id)).toEqual({ pessoa: null, oportunidade: null, b2b: null, campos: [] });
  expect(await carregarCabecalhoPainel(sess(fin), atFinanceiro.id)).toMatchObject({ pessoaId: null, subtitulo: null, quadrado: false });
});
it("contato só com telefone é sem nome", async () => {
  expect((await carregarCabecalhoPainel(sess(dono), atSemNome.id))!.semNome).toBe(true);
});
it("fora do escopo: null", async () => {
  expect(await carregarDetalhesPainel(sess(outro), a.id)).toBeNull();
  expect(await carregarCabecalhoPainel(sess(outro), a.id)).toBeNull();
});
it("carregarPainel leva o cabeçalho", async () => {
  expect(await carregarPainel(sess(dono), a.id)).toMatchObject({ cabecalho: { pessoaId: p.id, subtitulo: "Pessoa física · Inglês Intensivo B1" } });
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
it("sem sessão 401; papel sem inbox 403; null 404; dado 200 sem cache", async () => { /* como painel/route.test.ts:12-37 */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run src/server/inbox/painel-detalhes.test.ts "src/app/api/inbox/atendimentos/[id]/painel/[aba]/route.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/painel-detalhes.int.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implement**

Consultas com `select` explícito; do Evento só `autorId` e `payload.campoId`. `produto = oportunidade.planoPrevisto`. B2B quando `oportunidade.b2b && oportunidade.empresaId`; participantes de `ParticipanteOportunidade` (`schema.prisma:9230-9240`) com `naConversa = pessoaId === pessoa.id`; `hrefConversa` fica `null` até a Task 16; `decisor` é o papel `DECISOR` da pessoa do atendimento, `null` sem participação. A rota segue `painel/route.ts:10-24`: `aba` fora de `["detalhes", "oportunidades", "atividade"]` responde 400 `{ erro: "Aba inválida." }`, e `null` responde 404.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos, mais `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/paineis.int.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/inbox/painel-detalhes.ts src/server/inbox/painel-detalhes.test.ts src/server/inbox/painel-detalhes.int.test.ts src/server/inbox/painel-abas.ts src/server/inbox/paineis.ts "src/app/api/inbox/atendimentos/[id]/painel/[aba]" docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): consultas do cabeçalho e da aba Detalhes (E2.3, D13)"
```

<a id="task-4"></a>
### Task 4: Tags e contato sem nome no cabeçalho do painel (D20)

**Files:**
- Create: `src/app/(app)/inbox/abas/TagsContato.tsx`, `src/app/(app)/inbox/abas/ContatoSemNome.tsx`, `src/server/inbox/acoes-painel.ts`
- Modify: `src/app/(app)/inbox/PainelContato.tsx` (`slotTags`, `slotAviso`, `TagPainel.id`); `src/server/inbox/paineis.ts` (`tagsDaPessoa` devolve `id`); `src/app/(app)/inbox/InboxNovo.tsx` (monta os slots); `src/server/crm/tags.ts:25` (exporta `TagSchema`)
- Test: `src/app/(app)/inbox/abas/TagsContato.test.ts`, `src/app/(app)/inbox/abas/ContatoSemNome.test.ts`, `src/server/inbox/acoes-painel-tags.int.test.ts`, `src/server/inbox/paineis.int.test.ts` (caso da E1 com `id`)

**Interfaces:**
- Consumes: `TagPainel` e `tagsDaPessoa` (E1); `CabecalhoPainel`, `pessoaDoAtendimento` (Task 3); `avisarAtendimento` (Task 1); `editarNomeContatoWhatsApp({ atendimentoId, nome, nomeAnterior })` (`whatsapp/acoes.ts`, usado em `AcoesContato.tsx:114`).
- Produces:
  - `atribuirTagNoInbox(atendimentoId: string, tagId: string): Promise<Resultado>`; `removerTagNoInbox(atendimentoId: string, tagId: string): Promise<Resultado>`; `criarEAtribuirTagNoInbox(atendimentoId: string, nome: string): Promise<Resultado<{ tagId: string }>>`
  - `TagsContato(props: { atendimentoId: string; tags: TagPainel[]; disponiveis: { id: string; nome: string }[]; podeEditar: boolean; podeCriar: boolean; aoMudar(): void })`
  - `tagsParaEscolher(disponiveis: { id: string; nome: string }[], atuais: TagPainel[], busca: string): { id: string; nome: string }[]` (sem as que a pessoa já tem; sem acento e sem caixa; no máximo 8)
  - `ContatoSemNome(props: { atendimentoId: string; ariaAtiva: boolean; aoMudar(): void })`

Visual: as pílulas e o ✦ são os da E1 (`h-[26px] rounded-[13px] bg-surface-muted`, `IconSparkles` com `aria-label="Criada pela Aria"`). "+ tag" (`P:486`): pílula tracejada `border-dashed border-gray-300 text-gray-600`. Abre um popover com o campo "Buscar tag" e a lista de `tagsParaEscolher`; o `Menu` não serve, porque não tem campo. Com `podeCriar` e busca sem correspondência exata, o último item é `Criar tag “<busca>”`. Cada pílula da pessoa ganha "×" (`aria-label="Remover tag <rótulo>"`) só com `podeEditar`.

Contato sem nome (`P:479`, `slotAviso`): caixa tracejada com `IconUserX`. Com `ariaAtiva`, o texto é `Contato sem nome, criado pelo telefone. Aria vai perguntar na conversa, ou você pode preencher agora.`; sem Aria ativa, `Contato sem nome, criado pelo telefone. Você pode preencher agora.`. Tem o campo "Nome do contato" e o botão "Salvar"; vazio mostra "Digite o nome" (`P:1119`). Salva com `editarNomeContatoWhatsApp`. `ariaAtiva = painel.aria !== null && !painel.aria.pausada`.

- [ ] **Step 1: Write the failing tests**

```ts
// TagsContato.test.ts
const props = { atendimentoId: "a1", tags: [{ id: "t1", rotulo: "Noite", ia: true }, { id: "t2", rotulo: "Inglês", ia: false }],
  disponiveis: [{ id: "t1", nome: "Noite" }, { id: "t3", nome: "Bolsista" }], podeEditar: true, podeCriar: false, aoMudar: () => {} };
const h = (p = {}) => renderToStaticMarkup(createElement(TagsContato, { ...props, ...p }));
it("✦ só na tag sem autor (D20)", () => expect(h().match(/aria-label="Criada pela Aria"/g)).toHaveLength(1));
it("“+ tag” e “×” só para quem edita", () => {
  expect(h()).toContain("+ tag"); expect(h()).toContain('aria-label="Remover tag Inglês"');
  expect(h({ podeEditar: false })).not.toContain("+ tag"); expect(h({ podeEditar: false })).not.toContain("Remover tag");
});
it("sem tags e sem edição não renderiza nada", () => expect(h({ tags: [], podeEditar: false })).toBe(""));
it("tagsParaEscolher tira as já atribuídas e ignora acento e caixa", () => {
  expect(tagsParaEscolher(props.disponiveis, props.tags, "")).toEqual([{ id: "t3", nome: "Bolsista" }]);
  expect(tagsParaEscolher([{ id: "t4", nome: "Matrícula" }], [], "MATRI")).toEqual([{ id: "t4", nome: "Matrícula" }]);
});
// ContatoSemNome.test.ts
it("com a Aria ativa avisa que ela vai perguntar", () => expect(h({ ariaAtiva: true })).toContain("Aria vai perguntar na conversa, ou você pode preencher agora."));
it("sem a Aria ativa não promete a pergunta", () => { const t = h({ ariaAtiva: false }); expect(t).not.toContain("Aria"); expect(t).toContain('placeholder="Nome do contato"'); });
```

```ts
// acoes-painel-tags.int.test.ts — sessão por authMock como whatsapp/participantes-aviso.int.test.ts:3-5
it("atribuir grava PessoaTag com autor e avisa o atendimento", async () => {
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
it("conversa sem pessoa visível recusa", async () => {
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

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/abas/TagsContato.test.ts" "src/app/(app)/inbox/abas/ContatoSemNome.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/acoes-painel-tags.int.test.ts src/server/inbox/paineis.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Os wrappers resolvem `pessoaDoAtendimento`; sem pessoa, `ErroRegra("Contato não encontrado.")`. Atribuir e remover chamam `atribuirTag({ tagId, pessoaId })` e `removerTag`; com `ok`, `avisarAtendimento`. `criarEAtribuirTagNoInbox` exige `carteira.equipe` e `contatos.editar` (`exigirCapacidadeCrm`) e valida o nome com `TagSchema`. Numa transação: busca a tag pelo nome exato; sem ela, cria com cor `NEUTRA` e grava `TagCriada` (mesmo payload de `tags.ts:46-52`), dentro de `comUnicidade`; depois cria a `PessoaTag` se faltar, com `TagAtribuida`. No cliente, `useAcaoCliente({ idempotente: true })` em todas, e `aoMudar()` no sucesso. O `InboxNovo` passa `slotTags={<TagsContato … />}` quando `cabecalho.pessoaId` existe e `slotAviso={<ContatoSemNome … />}` quando `cabecalho.semNome`.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos, mais `node_modules/.bin/vitest run "src/app/(app)/inbox/"`. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estados `painel-detalhes` (da E1, agora com "+ tag" e "×") e o novo `painel-sem-nome` (id `semNome`), com referências `telas/prototipo-estado-painel-detalhes.png` e `prototipo-estado-painel-sem-nome.png`. Anexar ao PR.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/abas/TagsContato.tsx" "src/app/(app)/inbox/abas/TagsContato.test.ts" "src/app/(app)/inbox/abas/ContatoSemNome.tsx" "src/app/(app)/inbox/abas/ContatoSemNome.test.ts" "src/app/(app)/inbox/PainelContato.tsx" "src/app/(app)/inbox/InboxNovo.tsx" src/server/inbox/acoes-painel.ts src/server/inbox/acoes-painel-tags.int.test.ts src/server/inbox/paineis.ts src/server/inbox/paineis.int.test.ts src/server/crm/tags.ts scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): tags com marca da Aria e contato sem nome no painel (E2.4, D20)"
```

<a id="task-5"></a>
### Task 5: Aba Detalhes e bloco B2B (D13)

**Files:**
- Create: `src/app/(app)/inbox/abas/AbaDetalhes.tsx`, `src/app/(app)/inbox/abas/BlocoB2B.tsx`, `src/app/(app)/inbox/abas/useAbaPainel.ts`
- Modify: `src/app/(app)/inbox/InboxNovo.tsx` (aba Detalhes do comercial; subtítulo e `quadrado` do `ContatoPainel` vindos do `cabecalho`)
- Test: `src/app/(app)/inbox/abas/AbaDetalhes.test.ts`, `src/app/(app)/inbox/abas/useAbaPainel.test.ts`

**Interfaces:**
- Consumes: `DetalhesPainel`, `CabecalhoPainel`, `AbaDados` (Task 3); `LinhaCampo` (E1).
- Produces:
  - `useAbaPainel<T>(atendimentoId: string | null, aba: AbaDados, versao: number, ativo: boolean): { dado: T | null; erro: boolean; recarregar(): void }` (busca `/api/inbox/atendimentos/<id>/painel/<aba>` com `cache: "no-store"` só quando `ativo`; recarrega quando `versao` muda; nada de intervalo)
  - `urlAbaPainel(atendimentoId: string, aba: AbaDados): string`
  - `AbaDetalhes(props: { dados: DetalhesPainel; capacidades: CapacidadesPainel; aoAbrirOportunidades(): void })`
  - `BlocoB2B(props: { bloco: BlocoB2BPainel; verEmpresa: boolean })`

Conteúdo no comercial (`P:497-538`, `P:1127-1139`). As ações que a E1 deixou na aba (PainelAria até a E3, AcoesContato, OptOutContato, PainelTriagem) continuam embaixo: nada some (análise parte 3 §1, item 7). Fora do comercial, a aba é a da E1, sem mudança.
- **Cartão "Oportunidade atual":** botão de raio 10, `bg-surface-muted`, borda, `IconBriefcase` em `text-brand-700`. Linha 1: "Oportunidade atual" (11,5 px, `text-gray-600`). Linha 2: `<produto ?? título> · <valor> · <ETAPA_LABEL>`; valor nulo sai "Sem valor". Não tem "/mês", porque `valorPrevisto` não é mensal no ERP (análise parte 3 §4).
- **Bloco B2B** (`P:498-502`): `IconBuilding` com o nome da empresa e "Ver empresa" (`/empresas/<id>`, só com `verEmpresa`); depois "Contatos nesta oportunidade" e um cartão por participante, com iniciais, nome e `<papel> · <cargo>`. Quem fala na conversa tem a borda `border-brand-solid` e "Na conversa"; os outros têm "Falar com" (link `hrefConversa`, só quando não nulo).
- **Contato** (`LinhaCampo`):
  - WhatsApp (`IconPhone`, valor `font-mono`);
  - E-mail (`IconMail`);
  - Cidade (`IconMapPin`); no B2B, "Segmento", com `empresa.segmentoMercado`;
  - "Origem do contato" (`IconSpeakerphone`, `ORIGEM_CANAL_LABEL`).
- **Perfil ou Empresa:** divisória, depois o título 12/500 em `text-brand-700`: "Perfil" (B2C) ou "Empresa" (B2B).
  - B2C: os campos personalizados (`IconSchool`, `ia` vira o ✦ "Preenchido pela IA" do `LinhaCampo`). Sem CPF e sem Idade (D13), e sem Preferências (o ERP não tem esse dado).
  - B2B: Empresa, Cargo, CNPJ (`empresa.documento`), Segmento, Tamanho (`porte`), "Site / LinkedIn" (`site ?? linkedin`) e "Decisor?" ("Sim", "Não" ou "—"), seguidos dos campos personalizados.
- Valor nulo sai "—". O link "Abrir ficha completa" (`/contatos?c=<pessoaId>`) aparece só com `verContato` (D14).
- **Sem pessoa** (`pessoa: null`): mostra só o cartão da oportunidade e "Sem dados de contato para esta oportunidade.". Sem oportunidade também: "Sem oportunidade visível para você." (texto atual de `PainelSetor.tsx:21`).

- [ ] **Step 1: Write the failing tests**

```ts
// AbaDetalhes.test.ts
const cap = { ...nenhuma, verContato: true, verEmpresa: false } as CapacidadesPainel;
it("B2C: oportunidade atual, contato e perfil com ✦ no campo da Aria", () => {
  const t = h(b2c);
  expect(t).toContain("Oportunidade atual");
  expect(t).toMatch(/Inglês Intensivo B1 · R\$\s650,00 · Proposta/);
  expect(t).toContain("mariana@x.com"); expect(t).toContain("Origem do contato");
  expect(t).toMatch(/Objetivo[\s\S]*aria-label="Preenchido pela IA"/);
});
it("sem CPF nem idade (D13 padrão)", () => { const t = h(b2c); expect(t).not.toContain("CPF"); expect(t).not.toContain("Idade"); });
it("valor nulo sai “Sem valor”; campo nulo sai “—”", () => {
  const t = h({ ...b2c, oportunidade: { ...b2c.oportunidade!, valor: null }, pessoa: { ...b2c.pessoa!, cidade: null } });
  expect(t).toContain("Sem valor"); expect(t).toMatch(/>—<[\s\S]*Cidade/);
});
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
it("sem_pessoa_sem_edicao", () => {
  const t = h({ ...b2c, pessoa: null, campos: [] });
  expect(t).toContain("Sem dados de contato para esta oportunidade."); expect(t).not.toContain("Abrir ficha completa");
});
// useAbaPainel.test.ts
it("url da aba", () => expect(urlAbaPainel("a 1", "detalhes")).toBe("/api/inbox/atendimentos/a%201/painel/detalhes"));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/abas/"`
Expected: FAIL.

- [ ] **Step 3: Implement**

`AbaDetalhes` só apresenta, sem efeito. O `InboxNovo` chama `useAbaPainel(selecionado, "detalhes", versaoPainel, aba === "detalhes" && atual?.finalidade === "COMERCIAL")`. O cartão chama `aoAbrirOportunidades`, que vira `setAba("oportunidades")` (efeito só depois da Task 7; até lá, o cartão leva a `/funil?o=<id>`). Carregando: o `EsqueletoPainel` da E1. Erro: "Não foi possível carregar os detalhes." com "Tentar de novo" (`recarregar`), o texto fixo da E1. O lápis (`aoEditar`) chega na Task 6.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmo comando, mais `node_modules/.bin/vitest run "src/app/(app)/inbox/"`. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estados `painel-detalhes` (Mariana; na demo, o campo "Objetivo" passa a ter `CampoPersonalizadoAlterado` sem autor) e o novo `painel-detalhes-b2b` (Grupo Ventura, com dois participantes na demo). Referências: `telas/prototipo-estado-painel-detalhes.png` e o protótipo renderizado em `c2`. Diferenças justificadas: sem CPF, Idade e Preferências (D13) e sem "/mês".

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/abas/AbaDetalhes.tsx" "src/app/(app)/inbox/abas/AbaDetalhes.test.ts" "src/app/(app)/inbox/abas/BlocoB2B.tsx" "src/app/(app)/inbox/abas/useAbaPainel.ts" "src/app/(app)/inbox/abas/useAbaPainel.test.ts" "src/app/(app)/inbox/InboxNovo.tsx" scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): aba Detalhes com bloco B2B (E2.5, D13)"
```

<a id="task-6"></a>
### Task 6: Gaveta de edição do contato (D14)

**Files:**
- Create: `src/app/(app)/inbox/abas/GavetaContato.tsx`
- Modify: `src/server/inbox/acoes-painel.ts` (`editarContatoNoInbox`); `src/app/(app)/inbox/InboxNovo.tsx` (`aoEditar` do `PainelContato` abre a gaveta, só com `capacidades.editarContato` e `cabecalho.pessoaId`)
- Test: `src/app/(app)/inbox/abas/GavetaContato.test.ts`, `src/server/inbox/acoes-painel-contato.int.test.ts`

**Interfaces:**
- Consumes: `DetalhesPainel` (Task 3); `editarPessoa`, `EditarPessoaInput` (`crm/contatos.ts:382-470`); `definirValorCampo`, `validarValorCampo` (`crm/campos.ts:30,147`); `Drawer` (`components/Drawer.tsx:14`).
- Produces:
  - `type EditarContatoInbox = { pessoa?: EditarPessoaInput; campos?: { campoId: string; valor: unknown }[] }`
  - `editarContatoNoInbox(atendimentoId: string, input: EditarContatoInbox): Promise<Resultado>`
  - `type FormContato = { nome: string; email: string; cidade: string; cargo: string; linkedin: string; origemCanal: OrigemCanal | ""; campos: Record<string, ValorCampo> }`
  - `formDoContato(d: DetalhesPainel): FormContato` e `diffContato(lido: FormContato, editado: FormContato): EditarContatoInbox` (só o que mudou; texto vazio vira `null`; `{}` sem mudança)
  - `GavetaContato(props: { atendimentoId: string; dados: DetalhesPainel; aoFechar(): void; aoSalvo(): void })`

A gaveta é um `Drawer` com `title="Editar contato"` e `largura="w-full max-w-none min-[700px]:w-[348px]"`: cobre a coluna do painel, como a edição no lugar do protótipo (`P:1141`).
- **Campos:** Nome, E-mail, Cidade, Cargo, LinkedIn e "Origem do contato" (select de `ORIGEM_CANAL_LABEL` com "Sem origem").
- **Campos personalizados, por tipo:** `TEXTO` input, `NUMERO` input numérico, `DATA` date, `SELECAO` select de `opcoes`, `BOOLEANO` checkbox.
- **Empresa:** só leitura, com "Trocar a empresa na ficha completa" (`/contatos?c=`).
- **Sem alternância B2C/B2B:** o tipo vem de `Oportunidade.b2b` (análise parte 3 §5, Pessoa).
- **Rodapé:** "Cancelar" e "Salvar"; "Salvar" fica desabilitado sem mudança.

- [ ] **Step 1: Write the failing tests**

```ts
// GavetaContato.test.ts
it("diffContato manda só o que mudou e vazio como null", () => {
  expect(diffContato(lido, { ...lido, cidade: "Campinas", email: "", campos: { ...lido.campos, c1: "Avançado" } }))
    .toEqual({ pessoa: { cidade: "Campinas", email: null }, campos: [{ campoId: "c1", valor: "Avançado" }] });
  expect(diffContato(lido, lido)).toEqual({});
});
it("a gaveta mostra os campos, empresa só leitura e a ficha completa", () => {
  const t = h();
  for (const r of ["Editar contato", "Nome", "E-mail", "Cidade", "Cargo", "LinkedIn", "Origem do contato", "Objetivo"]) expect(t).toContain(r);
  expect(t).toContain("Trocar a empresa na ficha completa"); expect(t).not.toContain("B2C");
});
```

```ts
// acoes-painel-contato.int.test.ts
it("salva pessoa e campo numa chamada; repetir não grava Evento", async () => {
  comoUsuario(dono);
  const input = { pessoa: { cidade: "Campinas" }, campos: [{ campoId: nivel.id, valor: "Avançado" }] };
  expect(await editarContatoNoInbox(a.id, input)).toEqual({ ok: true });
  expect(await editarContatoNoInbox(a.id, input)).toEqual({ ok: true });
  expect(await prisma.evento.count({ where: { tipo: { in: ["PessoaEditada", "CampoPersonalizadoAlterado"] }, agregadoId: p.id } })).toBe(2);
});
it("valor inválido num campo recusa antes de gravar qualquer coisa", async () => {
  comoUsuario(dono);
  const r = await editarContatoNoInbox(a.id, { pessoa: { cidade: "Campinas" }, campos: [{ campoId: numerico.id, valor: "abc" }] });
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

`editarContatoNoInbox` faz, nesta ordem:
1. resolve `pessoaDoAtendimento`;
2. carrega os `CampoPersonalizado` de `input.campos` e valida todos com `validarValorCampo` antes de qualquer escrita (o primeiro erro volta como `ErroRegra` com a mensagem do validador);
3. chama `editarPessoa(pessoaId, input.pessoa)`, quando houver, e `definirValorCampo` para cada campo, parando no primeiro `ok: false`;
4. no sucesso, chama `avisarAtendimento`.

No cliente, `useAcaoCliente({ idempotente: true })`; o sucesso fecha a gaveta e chama `aoSalvo` (= `aoMudar`).

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estado novo `painel-editar-contato` (gaveta aberta sobre Mariana), com a referência `telas/prototipo-estado-painel-editar-contato.png`. Diferenças justificadas: gaveta em vez de edição no lugar (D14) e sem alternância B2C/B2B.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/abas/GavetaContato.tsx" "src/app/(app)/inbox/abas/GavetaContato.test.ts" "src/app/(app)/inbox/InboxNovo.tsx" src/server/inbox/acoes-painel.ts src/server/inbox/acoes-painel-contato.int.test.ts scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): gaveta de edição do contato (E2.6, D14)"
```

<a id="task-7"></a>
### Task 7: Aba Oportunidades: consulta e barra de etapas (D8)

**Files:**
- Create: `src/server/inbox/painel-oportunidades.ts`, `src/app/(app)/inbox/abas/etapas-painel.ts`, `src/app/(app)/inbox/abas/BarraEtapas.tsx`, `src/app/(app)/inbox/abas/AbaOportunidades.tsx`
- Modify: `src/server/inbox/painel-abas.ts` (caso `"oportunidades"`); `src/server/inbox/acoes-painel.ts` (`moverEtapaNoInbox`); `src/app/(app)/inbox/PainelContato.tsx` (`ABAS_ENTREGUES` ganha `"oportunidades"`, só no `COMERCIAL`); `src/app/(app)/inbox/InboxNovo.tsx` (renderiza a aba)
- Test: `src/app/(app)/inbox/abas/etapas-painel.test.ts`, `src/app/(app)/inbox/abas/AbaOportunidades.test.ts`, `src/app/(app)/inbox/PainelContato.test.ts` (o caso "regra da E1: só Detalhes" vira a regra da E2), `src/server/inbox/painel-oportunidades.int.test.ts`

**Interfaces:**
- Consumes: `destinoDoArraste`, `COLUNAS_FUNIL`, `DestinoArraste` (`crm/etapas.ts:6-48`); `moverEtapaTx` (`crm/mover-etapa.ts:18`); `podeVerLeadNaThread`; `capacidadesPainel`.
- Produces:
  - `type OportunidadeAtualPainel = { id: string; titulo: string; produto: string | null; valor: string | null; moeda: string | null; etapa: EtapaLead; temperatura: Temperatura; responsavel: { id: string; nome: string } | null; dataExperimental: string | null; experimentalConfirmada: boolean; professorExperimental: string | null; motivoPerda: MotivoPerda | null }`
  - `type OutraOportunidadePainel = { id: string; titulo: string; etapa: EtapaLead; valor: string | null; moeda: string | null }`
  - `type OportunidadesPainel = { atual: OportunidadeAtualPainel | null; outras: OutraOportunidadePainel[]; pessoaId: string | null }` (a Task 10 acrescenta `tarefas` e `fusoEscola`)
  - `carregarOportunidadesPainel(u: UsuarioSessao, atendimentoId: string): Promise<OportunidadesPainel | null>`
  - `moverEtapaNoInbox(atendimentoId: string, etapa: EtapaLead): Promise<Resultado>`
  - `ETAPAS_BARRA: readonly EtapaLead[] = ["NOVO", "EM_ATENDIMENTO", "QUALIFICADO", "EXPERIMENTAL_AGENDADA", "EXPERIMENTAL_REALIZADA", "PROPOSTA", "AGUARDANDO_MATRICULA", "MATRICULADO"]`
  - `segmentosEtapa(atual: EtapaLead): { etapa: EtapaLead; estado: "feita" | "atual" | "futura"; tom: "marca" | "perigo" | "neutro" }[]`: com `NO_SHOW`, o segmento `EXPERIMENTAL_REALIZADA` fica `atual` com tom `perigo`; com `PERDIDO`, todos ficam `neutro` e `futura`
  - `opcoesEtapa(atual: EtapaLead): { etapa: EtapaLead; rotulo: string; destino: DestinoArraste }[]`: as 10 de `COLUNAS_FUNIL`, com o rótulo de `ETAPA_LABEL`
  - `AbaOportunidades(props: { dados: OportunidadesPainel; capacidades: CapacidadesPainel; atendimentoId: string; fuso: string | null; aoMudar(): void })` (as Tasks 8–12 acrescentam props)

**Barra** (`P:545-552`): 8 segmentos de 4 px, com `gap` de 3 px e raio 2. `feita` e `atual` usam `bg-brand-solid`; `futura`, `bg-neutral-muted`; `perigo`, `bg-danger-solid`. O `title` traz o `ETAPA_LABEL`. Abaixo, um select de 34 px com as 10 etapas. A escolha, pelo segmento ou pelo select, depende de `destino.tipo`:
- `mover` → `moverEtapaNoInbox`.
- `recusar` → a opção fica `disabled`, com o motivo no `title`; no clique do segmento, o motivo aparece no `FeedbackAcao`.
- `acao` com `marcarPerdido` → abre o `ModalPerda` (Task 8).
- `acao` com `agendarExperimental`, `enviarProposta` ou `prepararContratacao` → mostra "Para <ação>, abra a oportunidade no funil." e o link "Abrir no funil" (`/funil?o=<id>`), porque a ficha completa navega (D14). As ações se escrevem "agendar a experimental", "enviar a proposta" e "preparar a contratação".
- Sem `capacidades.moverEtapa`, barra e select ficam só leitura.

**Cabeçalho da aba** (`P:543-544`): "Oportunidade atual" (12/500, `text-brand-700`), com "Funil Matrículas" à direita (`text-gray-500`); título em 15/600 (`produto ?? titulo`); valor em 17/600 com `formatarMoedaOuIndefinida`. Linhas de 13 px com rótulo de 104 px (`P:1140`): Responsável (`responsavel?.nome ?? "Sem responsável"`), Temperatura (`TEMPERATURA_LABEL`, sem o score, que é da E4/D12) e Produto (`produto ?? "—"`). A probabilidade fica de fora (Task 21, D13).

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
// AbaOportunidades.test.ts
it("cabeçalho, valor, linhas e opções recusadas desabilitadas", () => {
  const t = h();
  expect(t).toContain("Funil Matrículas"); expect(t).toMatch(/R\$\s650,00/);
  expect(t).toContain("Responsável"); expect(t).toContain("Temperatura"); expect(t).not.toContain("Probabilidade");
  expect(t).toMatch(/<option[^>]*value="NOVO"[^>]*disabled[^>]*title="Avance uma etapa por vez\."/);
});
it("sem permissão de mover, select desabilitado", () => expect(h({ capacidades: { ...cap, moverEtapa: false } })).toMatch(/<select[^>]*disabled/));
it("sem oportunidade visível avisa", () => expect(h({ dados: { atual: null, outras: [], pessoaId: null } })).toContain("Sem oportunidade visível para você."));
// PainelContato.test.ts (o caso da E1 passa a ser)
it("abas entregues até a E2.7", () => {
  expect(abasDoPainel("COMERCIAL").map((a) => a.id)).toEqual(["detalhes", "oportunidades"]);
  expect(abasDoPainel("PEDAGOGICO").map((a) => a.id)).toEqual(["detalhes"]);
});
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
it("moverEtapaNoInbox: um passo grava EtapaAlterada; a mesma etapa não grava; pular recusa", async () => {
  comoUsuario(dono); // op em NOVO
  expect(await moverEtapaNoInbox(a.id, "EM_ATENDIMENTO")).toEqual({ ok: true });
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

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/abas/" "src/app/(app)/inbox/PainelContato.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/painel-oportunidades.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

A consulta lê o lead do atendimento (só se `podeVerLeadNaThread` deixar), com `pais.moedaLocal`, `vendedor` e `professorExperimental`. `outras` são as oportunidades do mesmo `pessoaId`, exceto a atual, dentro de `escopoComercialAtual(u)`, com `orderBy: { criadoEm: "desc" }` e `take: 10`.

`moverEtapaNoInbox` resolve `atendimento.leadId`; se for nulo, `ErroRegra("Esta conversa não tem oportunidade.")`. Numa transação, chama `moverEtapaTx(tx, u, leadId, etapa)` e `avisarAtendimento(tx, atendimentoId)` (o NOTIFY sai no commit); depois chama `revalidatePath("/funil")`.

No cliente, `useAcaoCliente({ idempotente: true })`. O `InboxNovo` busca a aba com `useAbaPainel(selecionado, "oportunidades", versaoPainel, aba === "oportunidades")`.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estado novo `painel-oportunidades` (Mariana em `PROPOSTA`), com o protótipo renderizado na aba Oportunidades de `c1`. Diferenças justificadas: 8 segmentos em vez de 6, select com as 10 etapas (D8) e sem probabilidade (D13).

- [ ] **Step 6: Commit**

```bash
git add src/server/inbox/painel-oportunidades.ts src/server/inbox/painel-oportunidades.int.test.ts src/server/inbox/painel-abas.ts src/server/inbox/acoes-painel.ts "src/app/(app)/inbox/abas/etapas-painel.ts" "src/app/(app)/inbox/abas/etapas-painel.test.ts" "src/app/(app)/inbox/abas/BarraEtapas.tsx" "src/app/(app)/inbox/abas/AbaOportunidades.tsx" "src/app/(app)/inbox/abas/AbaOportunidades.test.ts" "src/app/(app)/inbox/PainelContato.tsx" "src/app/(app)/inbox/PainelContato.test.ts" "src/app/(app)/inbox/InboxNovo.tsx" scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): aba Oportunidades com barra de etapas do funil (E2.7, D8)"
```

<a id="task-8"></a>
### Task 8: Perda, aula experimental e ações da oportunidade (D8)

**Files:**
- Create: `src/app/(app)/inbox/abas/CartaoExperimental.tsx`
- Modify: `src/app/(app)/funil/ModalPerda.tsx:27-55` (prop `acao`); `src/server/inbox/acoes-painel.ts` (`marcarPerdidoNoInbox`); `src/app/(app)/inbox/abas/AbaOportunidades.tsx` (cartão, seção de ações e modal)
- Test: `src/app/(app)/inbox/abas/CartaoExperimental.test.ts`, `src/app/(app)/inbox/abas/AbaOportunidades.test.ts` (casos novos), `src/app/(app)/funil/ModalPerda.acao.test.ts`, `src/server/inbox/acoes-painel-perda.int.test.ts`

**Interfaces:**
- Consumes: `OportunidadeAtualPainel`, `opcoesEtapa` (Task 7); `marcarPerdido`, `PerdaInput` (`comercial/acoes.ts:572`, `comercial/schema.ts:106-115`); `ModalPerda`; `assumirAtendimento` (`whatsapp/acoes-atendimento.ts`) e `podeExecutar(u, "assumir", ctx)`.
- Produces:
  - `marcarPerdidoNoInbox(atendimentoId: string, input: PerdaInput): Promise<Resultado>`
  - `statusExperimental(o: Pick<OportunidadeAtualPainel, "etapa" | "experimentalConfirmada">): "Agendada" | "Confirmada" | "Realizada" | "Não compareceu"`
  - `CartaoExperimental(props: { oportunidade: OportunidadeAtualPainel; fuso: string | null; fusoEscola: string })`
  - `AbaOportunidades` acrescenta `podeAssumir: boolean` e `aoAssumir(): void`

Regras:
- **Cartão "Aula experimental"** (`P:553`), só quando há `dataExperimental`: `IconCalendarCheck`, o título e o link "Editar" (`/funil?o=<id>`). Abaixo, `<data e hora> · <professor ?? "Sem professor">` e uma pílula com `statusExperimental`. A pílula diz "Não compareceu" em `NO_SHOW`, "Realizada" em `EXPERIMENTAL_REALIZADA`, "Confirmada" com `experimentalConfirmada` e "Agendada" nos demais casos.
- **Seção de ações** (`P:585-590`): botões de texto de 44 px com ícone de 17 px.
  - "Assumir conversa" (`text-brand-700`) aparece só com `podeAssumir` e chama o `assumirAtendimento` de hoje; a versão com pausa da Aria é da E3 (D3).
  - "Marcar como perdido" (`text-danger-text`, `IconThumbDown`) aparece só quando `opcoesEtapa(etapa)` dá a ação `marcarPerdido` para `PERDIDO` e há `capacidades.moverEtapa`.
  - "Criar tarefa" e "Adicionar nota" entram na Task 12.
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
// AbaOportunidades.test.ts (acrescentar)
it("perdido_some_em_oportunidade_encerrada", () => {
  expect(h()).toContain("Marcar como perdido");
  expect(h({ dados: { ...dados, atual: { ...dados.atual!, etapa: "MATRICULADO" } } })).not.toContain("Marcar como perdido");
});
it("“Assumir conversa” só com podeAssumir", () => { expect(h({ podeAssumir: false })).not.toContain("Assumir conversa"); expect(h({ podeAssumir: true })).toContain("Assumir conversa"); });
```

```ts
// ModalPerda.acao.test.ts — interação sem DOM, como inbox/InboxNovo.interacao.test.ts:8-40
it("com `acao`, confirmar chama a ação recebida e não chama router.refresh", async () => {
  // escolhe PRECO e confirma
  expect(acao).toHaveBeenCalledWith({ motivoPerda: "PRECO", observacao: undefined });
  expect(refresh).not.toHaveBeenCalled();
  expect(marcarPerdidoMock).not.toHaveBeenCalled();
});
```

```ts
// acoes-painel-perda.int.test.ts
it("marca perdido com motivo e avisa; repetir não grava outro LeadPerdido", async () => {
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

`marcarPerdidoNoInbox` resolve o `leadId` como na Task 7, chama `marcarPerdido(leadId, input)` e, com `ok`, `avisarAtendimento(prisma, atendimentoId)`. No `ModalPerda` com `acao`: `acao.executar(() => acao(input))` e, no `ok`, só `aoConcluir?.()` e `aoFechar()`.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos, mais `node_modules/.bin/vitest run "src/app/(app)/funil/"`. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estado `painel-oportunidades` com a experimental realizada, e o estado novo `perda` (o modal aberto pelo painel). Como `P:589` não tem ação no protótipo, o `perda` se compara ao `ModalPerda` do funil.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/abas/CartaoExperimental.tsx" "src/app/(app)/inbox/abas/CartaoExperimental.test.ts" "src/app/(app)/inbox/abas/AbaOportunidades.tsx" "src/app/(app)/inbox/abas/AbaOportunidades.test.ts" "src/app/(app)/funil/ModalPerda.tsx" "src/app/(app)/funil/ModalPerda.acao.test.ts" src/server/inbox/acoes-painel.ts src/server/inbox/acoes-painel-perda.int.test.ts scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): perda, experimental e ações da oportunidade no painel (E2.8, D8)"
```

<a id="task-9"></a>
### Task 9: Outras oportunidades, nova oportunidade e cliente que volta (D18)

**Files:**
- Create: `src/app/(app)/inbox/abas/OutrasOportunidades.tsx`, `src/app/(app)/inbox/abas/ClienteVoltou.tsx`
- Modify: `src/server/inbox/painel-detalhes.ts` (`clienteVoltou` no `CabecalhoPainel`); `src/app/(app)/inbox/abas/AbaOportunidades.tsx`; `src/app/(app)/inbox/InboxNovo.tsx` (`slotAviso`); `src/app/(app)/funil/page.tsx:20-40` e `src/app/(app)/funil/FunilCliente.tsx:52,196` (`?nova=<pessoaId>`)
- Test: `src/app/(app)/inbox/abas/OutrasOportunidades.test.ts`, `src/app/(app)/inbox/abas/ClienteVoltou.test.ts`, `src/server/inbox/cliente-voltou.int.test.ts`, `src/app/(app)/funil/page.test.ts` (caso novo)

**Interfaces:**
- Consumes: `OutraOportunidadePainel` (Task 7); `vincularContatoWhatsApp({ contatoId, alvo: { tipo: "lead", id }, atendimentoId })` (`whatsapp/acoes.ts:466-523`); `NovaOportunidade` com `preenchido={{ pessoaId, nome }}` (`funil/NovaOportunidade.tsx:41-47`; a ficha de contato já usa assim, `contatos/FichaContato.tsx:459`).
- Produces:
  - `CabecalhoPainel.clienteVoltou: { oportunidadeId: string; titulo: string; situacao: "ganha" | "perdida"; contatoId: string; podeVincular: boolean } | null`
  - `situacaoOutra(etapa: EtapaLead): string`: "Ganha" em `MATRICULADO`, "Perdida" em `PERDIDO` e `<ETAPA_LABEL> · em aberto` nas demais
  - `hrefNovaOportunidade(pessoaId: string): string` → `/funil?nova=<pessoaId>`
  - `OutrasOportunidades(props: { outras: OutraOportunidadePainel[]; pessoaId: string | null; podeCriar: boolean; verContato: boolean })`
  - `ClienteVoltou(props: { atendimentoId: string; nome: string; dado: NonNullable<CabecalhoPainel["clienteVoltou"]>; podeCriar: boolean; pessoaId: string; aoMudar(): void })`

Regras:
- **Cliente que voltou** (D18, com o padrão "reaproveitar"). O cartão aparece só em `COMERCIAL`, com o atendimento sem `leadId`, quando a pessoa do contato (`contato.pessoaId`, em `escopoPessoas`) tem uma oportunidade visível em `MATRICULADO` ou `PERDIDO`; vale a mais recente.
  - Texto (`P:1124`): `<primeiro nome> já é cliente e voltou a escrever. A oportunidade <título> foi <ganha|perdida>.`
  - "Vincular a <título até o primeiro “ · ”>": botão primário, só com `podeVincular`. `podeVincular` é a regra de `whatsapp/acoes.ts:496-501`: o telefone da oportunidade igual ao do contato e a oportunidade no escopo.
  - "Criar nova oportunidade": link secundário para `hrefNovaOportunidade`, só com `capacidades.moverEtapa`.
  - A pergunta "é um novo interesse?" do protótipo fica de fora até D18.
- **Outras oportunidades** (`P:577-581`):
  - título "Outras oportunidades deste contato", com "Ver no contato" (`/contatos?c=<pessoaId>`, só com `verContato`);
  - linhas em `bg-surface-muted` com `IconBriefcase`, título, `situacaoOutra` e o valor em mono à direita;
  - vazio: "Nenhuma outra. Rematrícula ou novo curso geram uma nova oportunidade.";
  - botão tracejado "Nova oportunidade" (link `hrefNovaOportunidade`), só com `podeCriar` e `pessoaId`.
- **Funil `?nova=<pessoaId>`:** a página lê `nova` e busca a pessoa com `escopoPessoas(usuario)`. Se achar, abre `NovaOportunidade` com `preenchido={{ pessoaId, nome }}`; fora do escopo, ignora o parâmetro, sem erro.

- [ ] **Step 1: Write the failing tests**

```ts
// cliente-voltou.int.test.ts
it("conversa sem lead de pessoa com oportunidade ganha mostra o cartão", async () => {
  expect((await carregarCabecalhoPainel(sess(dono), semLead.id))!.clienteVoltou).toEqual({ oportunidadeId: ganha.id, titulo: "Francês A1 · Semestral", situacao: "ganha", contatoId: ct.id, podeVincular: true });
});
it("com lead, sem oportunidade encerrada ou fora do comercial: null", async () => {
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
  expect(t).toContain("Vincular a Francês A1"); expect(t).toContain('href="/funil?nova=p8"'); expect(t).not.toContain("novo interesse");
});
it("sem podeVincular não oferece o vínculo", () => expect(h({ dado: { ...dado, podeVincular: false } })).not.toContain("Vincular a"));
// OutrasOportunidades.test.ts
it("situação e vazio", () => {
  expect(situacaoOutra("MATRICULADO")).toBe("Ganha"); expect(situacaoOutra("QUALIFICADO")).toBe("Qualificado · em aberto");
  expect(h({ outras: [] })).toContain("Nenhuma outra. Rematrícula ou novo curso geram uma nova oportunidade.");
});
it("“Nova oportunidade” só com pessoa e permissão", () => { expect(h({ pessoaId: null })).not.toContain("Nova oportunidade"); expect(h({ podeCriar: false })).not.toContain("Nova oportunidade"); });
// funil/page.test.ts (acrescentar, no molde dos casos existentes)
it("?nova=<pessoa no escopo> abre a nova oportunidade preenchida; fora do escopo ignora", async () => { /* … */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/abas/" "src/app/(app)/funil/page.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/cliente-voltou.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`ClienteVoltou` chama `vincularContatoWhatsApp` com `useAcaoCliente({ idempotente: false })`, porque a action não garante repetição, e no `ok` chama `aoMudar()`. Não precisa de `avisarAtendimento`: o `garantirAtendimento` da action (`whatsapp/acoes.ts:507`) grava `leadId` no atendimento, e esse UPDATE dispara o aviso. No `FunilCliente`, o estado `novo` nasce `true` quando a página manda `preenchidoNova`.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estado novo `painel-cliente-voltou` (id `fernanda`; na demo, a Fernanda ganha uma oportunidade `MATRICULADO` "Francês A1 · Semestral" e uma conversa sem lead), com a referência `telas/prototipo-estado-painel-cliente-voltou.png`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/abas/OutrasOportunidades.tsx" "src/app/(app)/inbox/abas/OutrasOportunidades.test.ts" "src/app/(app)/inbox/abas/ClienteVoltou.tsx" "src/app/(app)/inbox/abas/ClienteVoltou.test.ts" "src/app/(app)/inbox/abas/AbaOportunidades.tsx" "src/app/(app)/inbox/InboxNovo.tsx" src/server/inbox/painel-detalhes.ts src/server/inbox/cliente-voltou.int.test.ts "src/app/(app)/funil/page.tsx" "src/app/(app)/funil/FunilCliente.tsx" "src/app/(app)/funil/page.test.ts" scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): outras oportunidades, nova oportunidade e cliente que volta (E2.9, D18)"
```

<a id="task-10"></a>
### Task 10: Tarefas da oportunidade: lista e ações (D10)

**Files:**
- Create: `src/server/inbox/painel-tarefas.ts`, `src/app/(app)/inbox/abas/TarefasOportunidade.tsx`, `src/lib/atalhos-horario.ts`
- Modify: `src/server/inbox/painel-oportunidades.ts` (`tarefas`, `fusoEscola`); `src/server/inbox/acoes-painel.ts` (`concluirTarefaNoInbox`, `reabrirTarefaNoInbox`, `reagendarTarefaNoInbox`, `cancelarTarefaNoInbox`); `src/app/(app)/inbox/abas/AbaOportunidades.tsx`
- Test: `src/lib/atalhos-horario.test.ts`, `src/app/(app)/inbox/abas/TarefasOportunidade.test.ts`, `src/server/inbox/acoes-painel-tarefas.int.test.ts`

**Interfaces:**
- Consumes: `escopoTarefas` (`crm/tarefas.ts:73`); `grupoDaTarefa` (`crm/tarefas-regras.ts:17`); `instanteDoCampoLocal` (`operacao/fuso-entrada.ts:60`); `carregarFusoInstitucionalTx` (`operacao/relogio.ts:4`); as ações de `crm/tarefas.ts:276-367`.
- Produces:
  - `type TarefaPainel = { id: string; versao: number; titulo: string; descricao: string | null; tipo: TipoTarefa; status: StatusTarefa; prioridade: PrioridadeTarefa; dataCivil: string | null; hora: string | null; fusoOrigem: string; lembreteAntecedenciaMin: number | null; responsavel: { id: string; nome: string } | null; atrasada: boolean; ia: boolean; leadId: string | null; atendimentoId: string | null; criadoEm: string; criadorNome: string | null; podeAgir: boolean }`
  - `carregarTarefasDoAtendimento(u: UsuarioSessao, a: { id: string; leadId: string | null }, o: { soDaConversa: boolean; agora?: Date }): Promise<TarefaPainel[]>`. Com `soDaConversa: false`, devolve as abertas e as 5 concluídas mais recentes, sem as canceladas. Com `true` (o fio, Task 12), devolve só as de `atendimentoId === a.id`, de qualquer status.
  - `OportunidadesPainel.tarefas: TarefaPainel[]` e `OportunidadesPainel.fusoEscola: string`
  - Em `src/lib/atalhos-horario.ts`, com a interface da E4 (`05-fluxos.md`, Task 4) e sem o `"1h"`, que a E4 acrescenta:
    - `type IdAtalhoHorario = "hoje18" | "amanha9" | "amanha14" | "seg9"`
    - `interface AtalhoHorario { id: IdAtalhoHorario; rotulo: string; valorLocal: string }` (`valorLocal` no formato do `datetime-local`, no `fuso`)
    - `atalhosDeHorario(agora: Date, fuso: string): AtalhoHorario[]` (rótulos "Hoje 18:00", "Amanhã 09:00", "Amanhã 14:00" e "Segunda 09:00")
    - `partesDoValorLocal(v: string): { dataCivil: string; hora: string }`
  - `concluirTarefaNoInbox(atendimentoId: string, tarefaId: string, versao: number): Promise<Resultado>`; `reabrirTarefaNoInbox(atendimentoId, tarefaId, versao)`; `reagendarTarefaNoInbox(atendimentoId, tarefaId, versao, q: { dataCivil: string | null; hora: string | null })`; `cancelarTarefaNoInbox(atendimentoId, tarefaId, versao, motivo: string)`
  - `TarefasOportunidade(props: { atendimentoId: string; tarefas: TarefaPainel[]; fusoEscola: string; fuso: string | null; podeCriar: boolean; aoNova(): void; aoEditar(t: TarefaPainel): void; aoMudar(): void })`

Regras:
- **Atalhos** (as regras da E4 valem aqui):
  - "Hoje 18:00" só entra se 18:00 de hoje, no `fuso`, ainda não passou;
  - "Segunda" é a próxima segunda; numa segunda, a da semana seguinte;
  - um atalho cujo valor local não existe no fuso (`instanteDoCampoLocal` com `ok: false`) fica de fora.
  
  Para tarefa, o `fuso` é sempre o da escola, porque a tarefa grava a data civil e a hora nele.
- **Tarefa do atendimento:** é a que tem `atendimentoId === a.id`, ou `leadId === a.leadId` quando há lead, sempre dentro de `escopoTarefas(u, tarefas.equipe)`. Os wrappers recusam as outras com "Tarefa não encontrada.".
- `ia` vale para `origem` `IA` ou `IA_SUGERIDA`; `atrasada = grupoDaTarefa(…) === "ATRASADAS"`; `hora` sai no `fusoOrigem`; `podeAgir` só nas abertas.
- **Lista** (`P:559-576`):
  - cabeçalho "Tarefas · <n> aberta(s)" e "+ Nova tarefa" (só com `podeCriar`);
  - em cada linha: caixa de 18 px (concluir ou reabrir, com `title` "Concluir" ou "Reabrir"), título em 13,5 px (riscado se concluída), meta em 12 px `<prazo> · <responsável> · <TIPO_TAREFA_LABEL>` (em `text-danger-text` se atrasada) e o ✦ "Criada pela IA";
  - na tarefa aberta, três ícones: "Reagendar para amanhã 09:00" (`IconCalendarTime`, valor do atalho `amanha9`), "Editar" (`IconPencil`) e "Cancelar tarefa" (`IconTrash`);
  - vazio: "Nenhuma tarefa para esta oportunidade.".
- **"Cancelar tarefa"** (D10, no lugar de "Excluir"): um `Modal` com o campo "Motivo", obrigatório e com até 500 caracteres, e o botão de perigo "Cancelar tarefa".
- **Erro de versão** ("Esta tarefa foi alterada por outra pessoa. Recarregue."): aparece a mensagem e `aoMudar()` recarrega o painel.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/atalhos-horario.test.ts — fuso da escola "America/Sao_Paulo" (UTC-3)
const sp = "America/Sao_Paulo";
const ids = (a: AtalhoHorario[]) => a.map((x) => x.id);
it("amanhã no dia civil da escola, mesmo com o UTC já no dia seguinte", () => {
  const a = atalhosDeHorario(new Date("2026-10-22T02:30:00Z"), sp); // 21/10 23:30 em SP
  expect(a.find((x) => x.id === "amanha9")).toEqual({ id: "amanha9", rotulo: "Amanhã 09:00", valorLocal: "2026-10-22T09:00" });
  expect(partesDoValorLocal("2026-10-22T14:00")).toEqual({ dataCivil: "2026-10-22", hora: "14:00" });
});
it("“Hoje 18:00” some às 18h da escola", () => {
  expect(ids(atalhosDeHorario(new Date("2026-10-22T20:00:00Z"), sp))).toContain("hoje18"); // 17:00 SP
  expect(ids(atalhosDeHorario(new Date("2026-10-22T21:00:00Z"), sp))).not.toContain("hoje18"); // 18:00 SP
});
it("segunda numa segunda vai para a próxima", () => {
  expect(atalhosDeHorario(new Date("2026-10-26T12:00:00Z"), sp).find((x) => x.id === "seg9")!.valorLocal).toBe("2026-11-02T09:00");
  expect(atalhosDeHorario(new Date("2026-10-22T12:00:00Z"), sp).find((x) => x.id === "seg9")!.valorLocal).toBe("2026-10-26T09:00");
});
```

```ts
// TarefasOportunidade.test.ts
it("contagem, atraso em perigo, ✦ da IA e ações só na aberta", () => {
  const t = h();
  expect(t).toContain("Tarefas · 1 aberta(s)");
  expect(t).toMatch(/text-danger[^"]*"[^>]*>[\s\S]*?Ligação/);
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
it("cancelar com o mesmo motivo duas vezes grava um TarefaCancelada", async () => {
  comoUsuario(dono);
  await cancelarTarefaNoInbox(a.id, t.id, 1, "Cliente pediu"); await cancelarTarefaNoInbox(a.id, t.id, 1, "Cliente pediu");
  expect(await prisma.evento.count({ where: { tipo: "TarefaCancelada", agregadoId: t.id } })).toBe(1);
});
it("carregarTarefasDoAtendimento: abertas, 5 concluídas mais recentes, sem canceladas; ia pela origem", async () => { /* … */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run src/lib/atalhos-horario.test.ts "src/app/(app)/inbox/abas/TarefasOportunidade.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/acoes-painel-tarefas.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Os wrappers carregam a tarefa com `findFirst`, aplicando `escopoTarefas` e a regra de pertença. Depois chamam a ação de domínio de mesmo nome e, com `ok`, `avisarAtendimento`. O `fusoEscola` vem de `carregarFusoInstitucionalTx`. No cliente, concluir, reabrir e reagendar usam `useAcaoCliente({ idempotente: false })`, e cancelar usa `{ idempotente: true }`.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estado novo `painel-oportunidades-tarefas`. Na demo, a Mariana tem uma tarefa atrasada, uma tarefa da Aria e uma concluída. A referência é o protótipo renderizado na aba Oportunidades com tarefas (`c1`). Diferença justificada: a lixeira vira "Cancelar tarefa", com motivo (D10).

- [ ] **Step 6: Commit**

```bash
git add src/server/inbox/painel-tarefas.ts src/server/inbox/painel-oportunidades.ts src/server/inbox/acoes-painel.ts src/server/inbox/acoes-painel-tarefas.int.test.ts src/lib/atalhos-horario.ts src/lib/atalhos-horario.test.ts "src/app/(app)/inbox/abas/TarefasOportunidade.tsx" "src/app/(app)/inbox/abas/TarefasOportunidade.test.ts" "src/app/(app)/inbox/abas/AbaOportunidades.tsx" scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): tarefas da oportunidade no painel (E2.10, D10)"
```

<a id="task-11"></a>
### Task 11: Modal de tarefa: criar e editar (D10)

**Files:**
- Create: `src/app/(app)/inbox/ModalTarefa.tsx`
- Modify: `src/server/inbox/acoes-painel.ts` (`criarTarefaNoInbox`, `editarTarefaNoInbox`, `dadosModalTarefaNoInbox`); `src/app/(app)/inbox/InboxNovo.tsx` (estado `modalTarefa: null | { tipo: "nova" } | { tipo: "editar"; tarefa: TarefaPainel }`); `src/app/(app)/inbox/abas/AbaOportunidades.tsx` (`aoNova`, `aoEditar`)
- Test: `src/app/(app)/inbox/ModalTarefa.test.ts`, `src/server/inbox/acoes-painel-criar-tarefa.int.test.ts`

**Interfaces:**
- Consumes: `atalhosDeHorario`, `partesDoValorLocal`, `TarefaPainel`, `cancelarTarefaNoInbox` (Task 10); `criarTarefa`, `editarTarefa` (`crm/tarefas.ts:161,217`) e `TarefaInput.atendimentoId` (Task 2); `listarResponsaveisPossiveis` (`crm/tarefas-consulta.ts:43`); `camposAlterados` (`tarefas/edicao.ts:19`); `pessoaDoAtendimento` (Task 3).
- Produces:
  - `type TarefaInboxInput = { titulo: string; tipo: TipoTarefa; descricao?: string; dataCivil: string | null; hora: string | null; prioridade?: PrioridadeTarefa; lembreteAntecedenciaMin?: 0 | 10 | 30 | 60 | null; responsavelId?: string | null; vincularOportunidade: boolean; jaFeita?: boolean; chaveIdempotencia: string }`
  - `criarTarefaNoInbox(atendimentoId: string, input: TarefaInboxInput): Promise<Resultado<{ id: string }>>`
  - `editarTarefaNoInbox(atendimentoId: string, tarefaId: string, versao: number, input: Partial<TarefaInput>): Promise<Resultado>`
  - `type DadosModalTarefa = { contatoNome: string; oportunidade: { id: string; titulo: string } | null; responsaveis: { id: string; nome: string }[]; fusoEscola: string; usuarioId: string }`
  - `dadosModalTarefaNoInbox(atendimentoId: string): Promise<Resultado<DadosModalTarefa>>`
  - `validarTarefaModal(v: { titulo: string; dataCivil: string | null; hora: string | null; lembrete: number | null }): string | null`
  - `ModalTarefa(props: { atendimentoId: string; modo: { tipo: "nova" } | { tipo: "editar"; tarefa: TarefaPainel }; fuso: string | null; aoFechar(): void; aoSalvo(): void })`

Conteúdo (`P:680-735`), só com os campos atuais (D10). É um `Modal` (folha no celular) com o título "Nova tarefa" ou "Editar tarefa".
- **Contexto:** chip com o avatar e o nome do contato e "Conversa vinculada" (`IconMessageCircle`).
- **Título:** 17/500, sem borda, com sublinhado de 2 px (`border-brand-solid`, ou `border-danger-solid` depois de tentar salvar vazio) e o placeholder "O que precisa ser feito?".
- **"Tipo":** chips WhatsApp, Ligação, E-mail, Reunião e Outro (`TIPO_TAREFA_LABEL`, ícones `IconMessageCircle`, `IconPhone`, `IconMail`, `IconCalendar` e `IconCircleDot`). O padrão é WhatsApp.
- **"Quando":** chips de `atalhosDeHorario(agora, fusoEscola)`, mais data e hora com a legenda do fuso da escola. O padrão é "Amanhã 09:00". Na edição, o prazo atual vem como chip selecionado "<dd/mm> · <hh:mm>" (`P:1064`).
- **"Responsável":** "Você" mais os `responsaveis`; o campo só aparece para quem tem equipe.
- **"Lembrete":** Sem lembrete, Na hora, 10 min antes, 30 min antes e 1 h antes (os valores de `tarefas.ts:51`). O padrão é "Sem lembrete".
- **"Descrição":** opcional, até 2000 caracteres.
- **"Vincular à oportunidade":** marcado por padrão quando há oportunidade, mostrando o título; some quando não há.
- **"Mais opções":** só "Prioridade", com Normal e Alta.
- **Rodapé:** "Já foi feita" (só na criação), "Cancelar tarefa" (só na edição; abre o motivo da Task 10), "Cancelar" e "Criar tarefa" ou "Salvar". Com o título vazio, o botão de salvar fica cinza e, se clicado, mostra "Dê um título para a tarefa".

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
  for (const r of ["15 min antes", "1 dia antes", "Repetir", "Notificar também", "Baixa", "Enviar mensagem nesta data"]) expect(t).not.toContain(r);
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
it("“Já foi feita” conclui; repetir com a mesma chave não falha nem conclui de novo", async () => {
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

`criarTarefaNoInbox`, nesta ordem:
1. chama `atendimentoVisivel`;
2. calcula `leadId = vincularOportunidade && podeVerLeadNaThread ? a.leadId : undefined` e pega o `pessoaId` de `pessoaDoAtendimento`, quando existe;
3. chama `criarTarefa({ …campos, atendimentoId, leadId, pessoaId, chaveIdempotencia })`;
4. com `jaFeita`, relê a tarefa: se estiver `ABERTA`, chama `concluirTarefa(id, versao)`; se já estiver `CONCLUIDA` com `concluidaPorId === u.id`, devolve ok sem nova chamada;
5. termina com `avisarAtendimento`.

Na tela, a criação usa `useChaveIdempotencia()` com `useAcaoCliente({ idempotente: true })`, como `PainelTarefa.tsx:51-55`; a edição usa `{ idempotente: false }` e manda só `camposAlterados`. Os dados do modal são carregados ao abrir, por `dadosModalTarefaNoInbox`. "Enviar mensagem nesta data" fica de fora (Task 19, D11).

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estados novos `tarefa-nova` e `tarefa-editar`, com as referências `telas/prototipo-estado-tarefa-nova.png` e `prototipo-estado-tarefa-editar.png`. Diferenças justificadas (D10 e D11): lembretes do ERP, sem Repetir, sem "Notificar também", sem Baixa, "Cancelar tarefa" no lugar de "Excluir" e sem "Enviar mensagem nesta data".

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/ModalTarefa.tsx" "src/app/(app)/inbox/ModalTarefa.test.ts" "src/app/(app)/inbox/InboxNovo.tsx" "src/app/(app)/inbox/abas/AbaOportunidades.tsx" src/server/inbox/acoes-painel.ts src/server/inbox/acoes-painel-criar-tarefa.int.test.ts scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): modal de tarefa para criar e editar (E2.11, D10)"
```

<a id="task-12"></a>
### Task 12: Cartão de tarefa no fio e entradas de tarefa e nota

**Files:**
- Create: `src/components/conversa/CartaoTarefaFio.tsx`, `src/components/conversa/intercalar-fio.ts`
- Modify: `src/server/inbox/paineis.ts` (`tarefasNoFio`); a thread (`src/app/(app)/inbox/ConversaAberta.tsx`, que já usa o `itensDaThread` da E0, passa a usar `intercalarFio`); `src/app/(app)/inbox/AcoesAtendimento.tsx` (`itensDoMenuConversa` com "Criar tarefa"); `src/app/(app)/inbox/RodapeConversa.tsx` (`aoCriarTarefa`, `pedidoNota`); `src/app/(app)/inbox/abas/AbaOportunidades.tsx` ("Criar tarefa" e "Adicionar nota" na seção de ações); `src/app/(app)/inbox/InboxNovo.tsx`
- Test: `src/components/conversa/intercalar-fio.test.ts`, `src/components/conversa/CartaoTarefaFio.test.ts`, `src/app/(app)/inbox/RodapeConversa.test.ts` e `src/app/(app)/inbox/AcoesAtendimento.test.ts` (casos novos), `src/server/inbox/paineis.int.test.ts` (caso novo)

**Interfaces:**
- Consumes: `ItemThread`, `itensDaThread` (E0); `TarefaPainel`, `carregarTarefasDoAtendimento`, `concluirTarefaNoInbox` (Task 10); `ModalTarefa` (Task 11).
- Produces:
  - `PainelSetor.tarefasNoFio?: TarefaPainel[]`: `carregarTarefasDoAtendimento(u, a, { soDaConversa: true })`, só com `tarefas.ver`, e `[]` nos demais casos
  - `type ItemFio = ItemThread | { tipo: "tarefa"; id: string; t: TarefaPainel }`, com `id = \`tarefa:${t.id}\``
  - `intercalarFio(base: ItemThread[], tarefas: TarefaPainel[], o: { temMaisAntes: boolean }): ItemFio[]`
  - `CartaoTarefaFio(props: { t: TarefaPainel; fuso: string | null; usuarioNome: string | null; aoEditar(): void; aoConcluir(): void })`
  - `textoCriadorTarefa(t: Pick<TarefaPainel, "ia" | "criadorNome">, usuarioNome: string | null): string`: "Aria criou uma tarefa", "Você criou uma tarefa" ou "<Nome> criou uma tarefa"

Regras:
- **`intercalarFio`:** a tarefa entra no fio pelo `criadoEm`, entre as mensagens e notas da E0. Com `temMaisAntes`, a tarefa mais antiga que o primeiro item `"mensagem"` da base fica de fora; ela aparece quando as anteriores carregam (a mesma regra da nota na E0). O desempate é pelo `id`. A E3 intercala as sugestões sobre esta saída, e a E4 põe as agendadas no slot `cartoesNoFio`.
- **Cartão** (`P:283-297`, `P:1005-1007`):
  - forma: largura `min(440px, 86%)`, centralizado, `bg-surface` com borda e raio 12;
  - ícone de 34 px pelo tipo, em `bg-brand-bg`/`text-brand-700` quando criado por pessoa e em `bg-ai-50`/`text-ai-700` quando criado pela Aria;
  - cabeçalho `<textoCriadorTarefa> · <hora mono>`;
  - título 13,5/500, riscado se concluída;
  - meta `<prazo> · <responsável> · <tipo>`, em `text-danger-text` se atrasada;
  - com a tarefa aberta e `podeAgir`: o lápis "Editar" (abre o `ModalTarefa`) e "Concluir" (`IconCheck`, chama `concluirTarefaNoInbox`);
  - concluída: "Concluída" em `text-brand-700`;
  - cancelada: "Cancelada" em `text-gray-500` (o protótipo diz "Excluída", D10).
- **Entradas:** "Criar tarefa" no menu ⋮ (`P:1183`), o ícone "Nova tarefa" do rodapé (`P:427`) e "Criar tarefa" na seção de ações da aba (`P:586`) abrem o `ModalTarefa` em modo novo, quando há `capacidades.tarefas`. "Adicionar nota" (`P:587`) incrementa o `pedidoNota` do `RodapeConversa`, que troca para a aba Nota da E1 e foca o campo.

- [ ] **Step 1: Write the failing tests**

```ts
// intercalar-fio.test.ts
const msg = (id: string, em: string): ItemThread => ({ tipo: "mensagem", id, m: { id, criadoEm: em } as MensagemThread });
const tar = (id: string, em: string) => ({ ...tarefa, id, criadoEm: em });
it("tarefa entra pela hora entre mensagens e notas", () => {
  const base = [msg("m1", "2026-10-22T10:00:00Z"), { tipo: "nota", id: "nota:n1", n: { id: "n1", criadoEm: "2026-10-22T10:05:00Z" } } as ItemThread, msg("m2", "2026-10-22T10:10:00Z")];
  expect(intercalarFio(base, [tar("t1", "2026-10-22T10:07:00Z")], { temMaisAntes: false }).map((i) => i.id)).toEqual(["m1", "nota:n1", "tarefa:t1", "m2"]);
});
it("com mensagens anteriores por carregar, a tarefa mais antiga que a janela fica de fora", () => {
  expect(intercalarFio([msg("m1", "2026-10-22T10:00:00Z")], [tar("t0", "2026-10-22T09:00:00Z")], { temMaisAntes: true }).map((i) => i.id)).toEqual(["m1"]);
  expect(intercalarFio([msg("m1", "2026-10-22T10:00:00Z")], [tar("t0", "2026-10-22T09:00:00Z")], { temMaisAntes: false }).map((i) => i.id)).toEqual(["tarefa:t0", "m1"]);
});
// CartaoTarefaFio.test.ts
it("autor da tarefa", () => {
  expect(textoCriadorTarefa({ ia: true, criadorNome: null }, "Carla")).toBe("Aria criou uma tarefa");
  expect(textoCriadorTarefa({ ia: false, criadorNome: "Carla" }, "Carla")).toBe("Você criou uma tarefa");
  expect(textoCriadorTarefa({ ia: false, criadorNome: "Rodrigo" }, "Carla")).toBe("Rodrigo criou uma tarefa");
});
it("aberta tem Editar e Concluir; concluída e cancelada só o estado", () => {
  expect(h(aberta)).toContain(">Concluir<"); expect(h(aberta)).toContain('aria-label="Editar"');
  expect(h({ ...aberta, status: "CONCLUIDA", podeAgir: false })).toContain("Concluída");
  expect(h({ ...aberta, status: "CANCELADA", podeAgir: false })).toContain("Cancelada");
  expect(h({ ...aberta, status: "CONCLUIDA", podeAgir: false })).not.toContain(">Concluir<");
});
// RodapeConversa.test.ts e AcoesAtendimento.test.ts (acrescentar)
it("“Nova tarefa” no rodapé só com aoCriarTarefa", () => { /* toContain('aria-label="Nova tarefa"') com a prop; sem ela, não */ });
it("menu ⋮ com “Criar tarefa” antes de “Agendar mensagem” quando acoes.criarTarefa existe", () => { /* ordem dos rótulos de itensDoMenuConversa */ });
```

```ts
// paineis.int.test.ts (acrescentar)
it("tarefasNoFio: só as ligadas à conversa, de qualquer status; sem tarefas.ver, vazio", async () => {
  expect((await carregarPainel(sess(dono), a.id))!.tarefasNoFio!.map((t) => [t.id, t.status])).toEqual([[daConversa.id, "ABERTA"], [cancelada.id, "CANCELADA"]]);
  expect((await carregarPainel(sess(professor), atPedagogico.id))!.tarefasNoFio).toEqual([]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run src/components/conversa/intercalar-fio.test.ts src/components/conversa/CartaoTarefaFio.test.ts "src/app/(app)/inbox/RodapeConversa.test.ts" "src/app/(app)/inbox/AcoesAtendimento.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/paineis.int.test.ts`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Implement**

A thread passa `intercalarFio(itensDaThread(…), painel?.tarefasNoFio ?? [], { temMaisAntes })` ao `VirtualList` (`getKey = item.id`) e renderiza `CartaoTarefaFio` para `tipo: "tarefa"`. O cartão fica em `src/components/conversa/`, não importa ações e recebe callbacks; quem liga as ações é a thread do Inbox.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos, mais `node_modules/.bin/vitest run "src/app/(app)/inbox/" src/components/conversa/`. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estado novo `fio-tarefa`, com um cartão "Você criou uma tarefa" e outro da Aria (na demo, as duas tarefas da Mariana ganham `atendimentoId`). A referência é o protótipo renderizado em `c1`, onde o cartão aparece depois de "criar tarefa".

- [ ] **Step 6: Commit**

```bash
git add src/components/conversa/CartaoTarefaFio.tsx src/components/conversa/CartaoTarefaFio.test.ts src/components/conversa/intercalar-fio.ts src/components/conversa/intercalar-fio.test.ts src/server/inbox/paineis.ts src/server/inbox/paineis.int.test.ts "src/app/(app)/inbox/" scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): cartão de tarefa no fio e entradas de tarefa e nota (E2.12)"
```

<a id="task-13"></a>
### Task 13: Aba Atividade: agendadas, atividade recente e notas (D11)

**Files:**
- Create: `src/server/inbox/painel-atividade.ts`, `src/app/(app)/inbox/abas/AbaAtividade.tsx`, `src/app/(app)/inbox/abas/AgendadasAtividade.tsx`
- Modify: `src/server/inbox/painel-abas.ts` (caso `"atividade"`); `src/server/inbox/acoes-painel.ts` (`cancelarAgendadaNoInbox`); `src/app/(app)/inbox/PainelContato.tsx` (`ABAS_ENTREGUES` ganha `"atividade"`, em todas as finalidades); `src/app/(app)/inbox/InboxNovo.tsx`
- Test: `src/server/inbox/painel-atividade.int.test.ts`, `src/app/(app)/inbox/abas/AbaAtividade.test.ts`, `src/app/(app)/inbox/PainelContato.test.ts` (regra das abas)

**Interfaces:**
- Consumes: `notasInternasDoAtendimento` e `NotaInternaThread` (E0, `whatsapp/consultas-inbox.ts`); `carregarTarefasDoAtendimento` (Task 10); `cancelarAgendamentoDoAtendimento` (`whatsapp/acoes-conversa.ts:102`).
- Produces:
  - `type AgendadaAtividade = { id: string; texto: string; agendadaPara: string; autor: { tipo: "voce" } | { tipo: "aria" } | { tipo: "pessoa"; nome: string }; podeCancelar: boolean }`
  - `type AtividadeRecente = { ultimaInteracaoEm: string | null; conversas: number; tarefasAbertas: number; notas: NotaInternaThread[] }` (`notas`: as 2 mais recentes)
  - `type AtividadePainel = { agendadas: AgendadaAtividade[]; recente: AtividadeRecente }` (a Task 14 acrescenta `aria` e `alteracoes`)
  - `carregarAtividadePainel(u: UsuarioSessao, atendimentoId: string): Promise<AtividadePainel | null>`
  - `cancelarAgendadaNoInbox(atendimentoId: string, intencaoId: string): Promise<Resultado>`
  - `AbaAtividade(props: { dados: AtividadePainel; atendimentoId: string; fuso: string | null; fusoEscola: string; aoMudar(): void })`

Regras (`P:593-621`):
- **"Mensagens agendadas"** aparece só com itens. São as `IntencaoMensagem` do atendimento com `agendadaPara`, status `PENDENTE` ou `ADIADA` e `passo` e `passoComercial` nulos (o filtro de `consultas-acoes-atendimento.ts:60`), de qualquer autor.
  - `autor` é `voce` quando `autorId === u.id`, `aria` quando `origem === "IA"`, e o nome nos demais casos;
  - `podeCancelar = autorId === u.id || ADMINISTRADOR` (a regra de `cancelarMensagemAgendada`).
  - Cada linha tem `IconClock` em `text-brand-700`, "<quando> · <autor>" (a Aria em `text-ai-700`), a prévia numa linha e o ícone "Cancelar", que abre o `ConfirmarAcao` com o texto de `AcoesAtendimento.tsx:356`.
  - "Reagendar", "Enviar agora" e "Editar" são da E4 (ver "Pedidos às outras etapas").
- **"Atividade recente":**
  - `Última interação <instante> · <n> conversas · <n> tarefa(s) aberta(s)`;
  - `ultimaInteracaoEm` = `atendimento.ultimaMensagemEm`;
  - `conversas` = atendimentos do mesmo contato que o usuário enxerga (`escopoAtendimentos`);
  - `tarefasAbertas` = as abertas de `carregarTarefasDoAtendimento(…, { soDaConversa: false })`;
  - as 2 notas aparecem com `IconNote` em `text-warning-text`, o texto em 2 linhas e "<autor> · <instante>";
  - sem notas: "Nenhuma nota interna ainda.".
- A aba existe em todas as finalidades (agendadas e notas são do atendimento). A parte da Aria entra só no comercial (Task 14).

- [ ] **Step 1: Write the failing tests**

```ts
// painel-atividade.int.test.ts
it("agendadas pendentes de qualquer autor, conversas do contato e as duas últimas notas", async () => {
  const d = await carregarAtividadePainel(sess(dono), a.id);
  expect(d!.agendadas).toEqual([expect.objectContaining({ id: daAria.id, autor: { tipo: "aria" }, podeCancelar: false }), expect.objectContaining({ id: minha.id, autor: { tipo: "voce" }, podeCancelar: true })]);
  expect(d!.recente).toMatchObject({ conversas: 2, tarefasAbertas: 1 });
  expect(d!.recente.notas.map((n) => n.nota)).toEqual(["Terceira", "Segunda"]);
});
it("conversa de outro setor do mesmo contato, fora do escopo, não conta", async () => { /* conversas: 1 */ });
it("cancelarAgendadaNoInbox: intenção de outro atendimento recusa; a própria cancela e avisa", async () => { /* … */ });
// AbaAtividade.test.ts
it("seção de agendadas só com itens; contagens; vazio de notas", () => {
  expect(h({ ...d, agendadas: [] })).not.toContain("Mensagens agendadas");
  expect(h(d)).toMatch(/Última interação .+ · 3 conversas · 1 tarefa\(s\) aberta\(s\)/);
  expect(h({ ...d, recente: { ...d.recente, notas: [] } })).toContain("Nenhuma nota interna ainda.");
});
it("cancelar só onde pode", () => expect(h(d).match(/aria-label="Cancelar mensagem agendada"/g)).toHaveLength(1));
// PainelContato.test.ts
it("abas entregues até a E2.13", () => {
  expect(abasDoPainel("COMERCIAL").map((a) => a.id)).toEqual(["detalhes", "oportunidades", "atividade"]);
  expect(abasDoPainel("PEDAGOGICO").map((a) => a.id)).toEqual(["detalhes", "atividade"]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/abas/AbaAtividade.test.ts" "src/app/(app)/inbox/PainelContato.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/painel-atividade.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`cancelarAgendadaNoInbox` delega a `cancelarAgendamentoDoAtendimento` e, com `ok`, chama `avisarAtendimento`; até a E4 criar o trigger de `IntencaoMensagem`, a mudança de agendada não avisa sozinha. O `InboxNovo` busca a aba com `useAbaPainel(selecionado, "atividade", versaoPainel, aba === "atividade")`. O cancelamento na tela usa `ConfirmarAcao` com `idempotente`.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estados novos `painel-atividade` e `painel-atividade-agendadas` (Beatriz, que na demo da E1 já tem nota; ela ganha duas agendadas, uma da Aria). A referência é `telas/prototipo-estado-painel-atividade.png`. Diferença justificada: só "Cancelar" até a E4 (D11).

- [ ] **Step 6: Commit**

```bash
git add src/server/inbox/painel-atividade.ts src/server/inbox/painel-atividade.int.test.ts src/server/inbox/painel-abas.ts src/server/inbox/acoes-painel.ts "src/app/(app)/inbox/abas/AbaAtividade.tsx" "src/app/(app)/inbox/abas/AbaAtividade.test.ts" "src/app/(app)/inbox/abas/AgendadasAtividade.tsx" "src/app/(app)/inbox/PainelContato.tsx" "src/app/(app)/inbox/PainelContato.test.ts" "src/app/(app)/inbox/InboxNovo.tsx" scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): aba Atividade com agendadas, atividade recente e notas (E2.13, D11)"
```

<a id="task-14"></a>
### Task 14: Aba Atividade: Aria neste contato e alterações da IA com desfazer (D1)

**Files:**
- Create: `src/server/inbox/texto-aria.ts`, `src/app/(app)/inbox/abas/AlteracoesAria.tsx`
- Modify: `src/server/inbox/painel-atividade.ts` (`aria`, `alteracoes`); `src/server/inbox/painel-detalhes.ts` (`CabecalhoPainel.contadorAtividade`); `src/server/aria/historico.ts:163-176` (idempotência por natureza do desfazer); `src/server/inbox/acoes-painel.ts` (`desfazerAcaoAriaNoInbox`); `src/app/(app)/inbox/abas/AbaAtividade.tsx`; `src/app/(app)/inbox/PainelContato.tsx` (`abasDoPainel(finalidade, contagens?)`); `src/app/(app)/inbox/InboxNovo.tsx`
- Test: `src/server/inbox/texto-aria.test.ts`, `src/app/(app)/inbox/abas/AlteracoesAria.test.ts`, `src/app/(app)/inbox/PainelContato.test.ts` (contagem), `src/server/inbox/painel-atividade-aria.int.test.ts`, `src/server/aria/historico.int.test.ts` (casos novos)

**Interfaces:**
- Consumes: `versaoPublicada` (`aria/versoes.ts:30`), `modoDaAcao` (`aria/config-schema.ts:163`), `ACOES_MATRIZ` (`aria/matriz.ts:14`); `desfazerAcaoAria` (`aria/historico.ts:163`); `ACAO_AGENTE_IA_LABEL` (`lib/labels.ts:536`).
- Produces:
  - `textoAlteracaoAria(acao: AcaoAgenteIATipo, payload: unknown): string`
  - `faixaConfianca(valor: number, faixa: { executaAPartirDe: number; transfereAbaixoDe: number }): "alta" | "media" | "baixa"`
  - `type AlteracaoAriaPainel = { id: string; acao: AcaoAgenteIATipo; texto: string; em: string; desfeita: boolean; podeDesfazer: boolean; motivoIrreversivel: string | null }`
  - `type AriaNoContato = { ultimaAcao: { texto: string; confianca: number; em: string } | null; faixa: { executaAPartirDe: number; transfereAbaixoDe: number }; etapa: EtapaLead | null; automatico: AcaoAgenteIATipo[]; comAprovacao: AcaoAgenteIATipo[] }`
  - `AtividadePainel` acrescenta `aria: AriaNoContato | null; alteracoes: AlteracaoAriaPainel[]`
  - `CabecalhoPainel.contadorAtividade: number`
  - `abasDoPainel(finalidade: string, contagens?: Partial<Record<IdAbaPainel, number>>): AbaPainel[]` (zero ou ausente não gera `contagem`)
  - `desfazerAcaoAriaNoInbox(atendimentoId: string, acaoId: string): Promise<Resultado>`
  - `AlteracoesAria(props: { itens: AlteracaoAriaPainel[]; atendimentoId: string; aoMudar(): void })`

Regras (`P:623-649`, `P:745-751`, `P:903-910`, `P:1145`, `P:1154`):
- `aria` e `alteracoes` só existem no `COMERCIAL` com `veLead`; fora disso, `null` e `[]`.
- **Lista:**
  - `AcaoAgenteIA` do atendimento com status `EXECUTADA`, `APROVADA` ou `DESFEITA` e `acao` diferente de `CLASSIFICAR_SETOR`, das mais recentes para as mais antigas, até 30 (índice `[atendimentoId, criadoEm]`, `schema.prisma:9149`).
  - `podeDesfazer = capacidades.desfazerAria && reversivel && status ∈ {EXECUTADA, APROVADA}` (a regra de `aria/consultas.ts:239`).
  - Quem vê o lead vê a lista; o botão aparece só para quem desfaz (D1).
- **Contador:** quantos itens da lista estão em `EXECUTADA` ou `APROVADA`. Zero esconde o contador.
- **Texto** de cada ação, por `textoAlteracaoAria`. Payload sem o campo esperado cai no rótulo de `ACAO_AGENTE_IA_LABEL`.

  | Ação | Texto |
  |---|---|
  | `MOVER_ETAPA` | "Moveu para <ETAPA_LABEL[para]>" |
  | `MARCAR_PERDIDO` | "Marcou como perdido" |
  | `TAG` | "Adicionou a tag <nome>" |
  | `ATUALIZAR_CAMPO` | "Preencheu <nomeCampo ?? "um campo">" |
  | `CRIAR_TAREFA` | "Criou a tarefa <titulo>" |
  | `AGENDAR_MENSAGEM` | "Agendou uma mensagem" |
  | `NOTA_INTERNA` | "Registrou uma nota interna" |
  | `RESPONDER` | "Enviou uma mensagem" |
  | `ENVIAR_DOCUMENTO` | "Enviou um documento" |
  | `CONDICAO_COMERCIAL` | "Ofereceu uma condição comercial" |
  | `HANDOFF` | "Pediu ajuda a uma pessoa" |
- **Linha da lista:**
  - ícone de 28 px em `bg-ai-50`/`text-ai-700`;
  - texto de 13,5 px, riscado e com opacidade 0,5 quando desfeita;
  - meta em mono de 11 px (`Desfeito · ` + hora);
  - "Desfazer" (`IconArrowBackUp`) quando `podeDesfazer`;
  - nas irreversíveis, o botão de cadeado (`IconLock`) "Por que não dá para desfazer", que mostra `Não dá para desfazer: <motivo em minúsculas>. Se precisar corrigir, envie uma nova mensagem.` (`P:1154`).
  - Introdução: "Tudo que Aria fez neste contato. Desfazer restaura o valor anterior. Mensagens enviadas e handoffs já comunicados ao lead não podem ser desfeitos."
  - Vazio: "Aria ainda não alterou nada neste contato."
- **"Aria neste contato":**
  - título com `IconSparkles` em `text-ai-700`;
  - `ultimaAcao` é a ação mais recente do atendimento (qualquer status, menos `SIMULADA`), com `textoAlteracaoAria` e `confianca`;
  - a barra de 4 px tem largura `<confianca>%` e cor por `faixaConfianca`, contra a faixa da **versão publicada** (`config.confianca`; sem versão, 75 e 55, como o protótipo): `alta` em `bg-brand-solid`, `media` em `text-warning-text`/`bg-warning-solid` e `baixa` em `bg-danger-solid`; o número vai em mono;
  - sem ação: "Aria ainda não atuou neste contato.";
  - regras da etapa: `Automático em <ETAPA_LABEL>: <rótulos EXECUTA>` e `Com aprovação: <rótulos SUGERE>`, calculadas com `modoDaAcao` para cada item de `ACOES_MATRIZ` na etapa do lead; lista vazia vira "nenhuma".
- **Desfazer idempotente (#166):** em `desfazerAcaoAria`, depois de `travarAcao` e `exigirEscopo`, a ação com `status === "DESFEITA"` e `desfeitaPorId === u.id` devolve ok sem Evento. Desfeita por outra pessoa, continua "Esta ação já foi desfeita.". A E3 (`04-aria.md`, Task 8) faz o mesmo com aprovar e rejeitar no mesmo arquivo. O wrapper confere `acao.atendimentoId === atendimentoId` (senão, "Ação da Aria não encontrada.") e avisa.

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
  const t = h([{ ...i1, podeDesfazer: true }, { ...i2, podeDesfazer: false, motivoIrreversivel: "Mensagem já enviada" }, { ...i3, desfeita: true }]);
  expect(t.match(/>Desfazer</g)).toHaveLength(1);
  expect(t).toContain('title="Por que não dá para desfazer"');
  expect(t).toMatch(/line-through[\s\S]*Desfeito · /);
});
it("vazio", () => expect(h([])).toContain("Aria ainda não alterou nada neste contato."));
// PainelContato.test.ts
it("contagem da Atividade só quando maior que zero", () => {
  expect(abasDoPainel("COMERCIAL", { atividade: 2 }).find((a) => a.id === "atividade")).toEqual({ id: "atividade", rotulo: "Atividade", contagem: 2 });
  expect(abasDoPainel("COMERCIAL", { atividade: 0 }).find((a) => a.id === "atividade")).toEqual({ id: "atividade", rotulo: "Atividade" });
});
```

```ts
// historico.int.test.ts (acrescentar)
it("desfazer_repetido_pelo_mesmo_autor_e_ok_sem_evento", async () => {
  const a = await exec({ acao: "TAG", tagId: tag.id, justificativa: "x" }); logado(gerente);
  expect(await desfazerAcaoAria(a.id)).toEqual({ ok: true });
  expect(await desfazerAcaoAria(a.id)).toEqual({ ok: true });
  expect(await prisma.evento.count({ where: { tipo: "AcaoAriaDesfeita", agregadoId: a.id } })).toBe(1);
});
it("desfeita_por_outro_segue_recusada", async () => { /* admin desfaz; o gerente tenta e recebe "Esta ação já foi desfeita." */ });
// painel-atividade-aria.int.test.ts
it("lista, contador, última ação, regras da etapa e podeDesfazer por papel (D1)", async () => {
  expect((await carregarAtividadePainel(sess(vendedor), a.id))!.alteracoes.every((x) => !x.podeDesfazer)).toBe(true);
  expect((await carregarAtividadePainel(sess(gerente), a.id))!.alteracoes.some((x) => x.podeDesfazer)).toBe(true);
  expect((await carregarCabecalhoPainel(sess(vendedor), a.id))!.contadorAtividade).toBe(2);
});
it("desfazerAcaoAriaNoInbox recusa a ação de outro atendimento e o vendedor (D1)", async () => { /* … */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run src/server/inbox/texto-aria.test.ts "src/app/(app)/inbox/abas/AlteracoesAria.test.ts" "src/app/(app)/inbox/PainelContato.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/aria/historico.int.test.ts src/server/inbox/painel-atividade-aria.int.test.ts`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Implement**

O "Desfazer" usa `useAcaoCliente({ idempotente: true })` e, no sucesso, `aoMudar()`. O `InboxNovo` monta as abas com `abasDoPainel(atual.finalidade, { atividade: cabecalho?.contadorAtividade ?? 0 })`.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos, mais `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/aria/consultas.int.test.ts`. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estado `painel-atividade` com alterações: uma desfeita e uma irreversível, capturado como Gerente e como Vendedor (a demo ganha três `AcaoAgenteIA` da Mariana). A referência é `telas/prototipo-estado-painel-atividade.png`. Diferença justificada: o vendedor não vê "Desfazer" (D1).

- [ ] **Step 6: Commit**

```bash
git add src/server/inbox/texto-aria.ts src/server/inbox/texto-aria.test.ts src/server/inbox/painel-atividade.ts src/server/inbox/painel-atividade-aria.int.test.ts src/server/inbox/painel-detalhes.ts src/server/inbox/acoes-painel.ts src/server/aria/historico.ts src/server/aria/historico.int.test.ts "src/app/(app)/inbox/abas/AlteracoesAria.tsx" "src/app/(app)/inbox/abas/AlteracoesAria.test.ts" "src/app/(app)/inbox/abas/AbaAtividade.tsx" "src/app/(app)/inbox/PainelContato.tsx" "src/app/(app)/inbox/PainelContato.test.ts" "src/app/(app)/inbox/InboxNovo.tsx" scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): Aria neste contato e alterações da IA com desfazer (E2.14, D1)"
```

<a id="task-15"></a>
### Task 15: Atalhos de saída: matrícula, contato e link da conversa

**Files:**
- Create: `src/lib/href-conversa.ts`
- Modify: `src/server/inbox/paineis.ts:19-20,63-82` (`matriculaId`); `src/app/(app)/inbox/PainelSetor.tsx` (código da matrícula vira link); `src/app/(app)/funil/PainelOportunidade.tsx:281` (`/contatos/<id>` vira `/contatos?c=<id>`, achado da análise parte 3, A07)
- Test: `src/lib/href-conversa.test.ts`, `src/app/(app)/inbox/PainelSetor.test.ts` (caso novo), `src/server/inbox/paineis.int.test.ts` (caso novo), `src/app/(app)/funil/PainelOportunidade.test.ts` (caso novo)

**Interfaces:**
- Produces:
  - `hrefConversa(atendimentoId: string, o?: { agendar?: boolean }): string` → `/inbox?c=<id>` e, com `agendar`, `&agendar=1` (quem lê o parâmetro é a E4)
  - `DadosSetor` de `FINANCEIRO` e `SECRETARIA`: `matriculaId: string | null`

Saídas do B1 nesta etapa:
- `/contatos?c=`: "Abrir ficha completa" e "Ver no contato" (Tasks 5 e 9).
- `/empresas/<id>`: "Ver empresa" (Task 5).
- `/matriculas/<id>`: o código da matrícula vira link no painel de Financeiro e Secretaria, só para quem já via o código (a regra de papel de `paineis.ts:64,74`).
- Correção: o "Abrir contato" do funil apontava para uma rota que não existe.

Ficam com outras etapas: "Gerenciar números em Configurações" (E1, seletor de número) e a leitura de `?agendar=1` (E4).

- [ ] **Step 1: Write the failing tests**

```ts
// href-conversa.test.ts
it("monta o link com e sem agendar", () => {
  expect(hrefConversa("a 1")).toBe("/inbox?c=a%201");
  expect(hrefConversa("a1", { agendar: true })).toBe("/inbox?c=a1&agendar=1");
});
// PainelSetor.test.ts (acrescentar)
it("matrícula vira link para a ficha", () => expect(h({ setor: "SECRETARIA", matriculaCodigo: "M-2", matriculaId: "m2", documentosPendentes: 0 })).toMatch(/<a [^>]*href="\/matriculas\/m2"[^>]*>M-2<\/a>/));
it("sem matriculaId o código fica em texto", () => expect(h({ setor: "FINANCEIRO", matriculaCodigo: "M-1", matriculaId: null, cobrancas: [] })).not.toContain("/matriculas/"));
// paineis.int.test.ts (acrescentar)
it("secretaria e financeiro recebem o id da matrícula; quem não vê o código, não vê o id", async () => { /* … */ });
// PainelOportunidade.test.ts (acrescentar)
it("“Abrir contato” usa /contatos?c=", () => expect(h()).toContain('href="/contatos?c=p1"'));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run src/lib/href-conversa.test.ts "src/app/(app)/inbox/PainelSetor.test.ts" "src/app/(app)/funil/PainelOportunidade.test.ts"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/paineis.int.test.ts`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Implement**

Em `paineis.ts`, o `include` já traz `matricula.id` (`:46`); basta acrescentá-lo ao retorno, com a mesma condição do código.

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estado novo `painel-secretaria` (Lucas, transferido da Secretaria na demo da E1), sem referência no protótipo: confere só o link.

- [ ] **Step 6: Commit**

```bash
git add src/lib/href-conversa.ts src/lib/href-conversa.test.ts src/server/inbox/paineis.ts src/server/inbox/paineis.int.test.ts "src/app/(app)/inbox/PainelSetor.tsx" "src/app/(app)/inbox/PainelSetor.test.ts" "src/app/(app)/funil/PainelOportunidade.tsx" "src/app/(app)/funil/PainelOportunidade.test.ts" scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): atalhos de saída para matrícula e contato (E2.15)"
```

<a id="task-16"></a>
### Task 16: Atalhos de entrada nas outras telas (D21)

**Files:**
- Create: `src/server/inbox/atalhos.ts`
- Modify:
  - `src/app/(app)/funil/page.tsx` e `src/app/(app)/funil/PainelOportunidade.tsx` (prop `conversa`);
  - `src/app/(app)/tarefas/page.tsx:49,84` e `src/app/(app)/tarefas/PainelTarefa.tsx` (prop `conversa`);
  - `src/app/(app)/contatos/page.tsx:42,88` e `src/app/(app)/contatos/FichaContato.tsx` (prop `conversa`);
  - `src/server/aria/consultas.ts:29-40,230-243` (`atendimentoId` no item) e `src/app/(app)/aria/_componentes/Historico.tsx` (link por linha);
  - `src/server/inbox/painel-detalhes.ts` (`hrefConversa` dos participantes B2B).
- Test: `src/server/inbox/atalhos.int.test.ts`, `src/app/(app)/funil/PainelOportunidade.test.ts`, `src/app/(app)/tarefas/PainelTarefa.test.ts` (render novo), `src/app/(app)/contatos/FichaContato.test.ts`, `src/server/aria/consultas.int.test.ts` (caso novo), `src/server/inbox/painel-detalhes.int.test.ts` (caso novo)

**Interfaces:**
- Consumes: `hrefConversa` (Task 15); `escopoAtendimentos` (`whatsapp/escopo.ts:47`); `PAPEIS_INBOX` (`whatsapp/escopo.ts:16`).
- Produces:
  - `type ConversaParaAbrir = { atendimentoId: string; aberta: boolean }`
  - `atendimentoParaAbrir(u: UsuarioSessao, alvo: { atendimentoId?: string | null; leadId?: string | null; pessoaId?: string | null }): Promise<ConversaParaAbrir | null>`
  - Prop `conversa?: ConversaParaAbrir | null` em `PainelOportunidade`, `PainelTarefa` e `FichaContato`
  - `ItemHistoricoAria.atendimentoId: string | null`

Regras:
- **Ordem de busca**, sempre dentro de `escopoAtendimentos(u)` e sem grupo:
  1. o `atendimentoId` dado;
  2. o atendimento não encerrado do `leadId`, com a `ultimaMensagemEm` mais recente;
  3. o atendimento não encerrado de um contato com o `pessoaId`;
  4. o atendimento encerrado mais recente das mesmas fontes.
  
  `aberta = status !== "ENCERRADO"`. Quem não tem papel de `PAPEIS_INBOX` recebe `null`.
- **Links** (só texto, D21): "Abrir conversa" (`hrefConversa(id)`) e, quando a conversa está aberta, "Agendar mensagem" (`hrefConversa(id, { agendar: true })`). Onde ficam:
  - Funil: no topo do painel da oportunidade, ao lado do código;
  - Tarefas: abaixo do status, quando a tarefa tem `atendimentoId`, `leadId` ou `pessoaId`;
  - Contatos: no cabeçalho da ficha;
  - Agente (Histórico): "Abrir conversa" na linha, quando `atendimentoId` não é nulo.
  
  Sem conversa, nada aparece.
- **B2B (Task 5):** `hrefConversa` do participante, a partir de `atendimentoParaAbrir(u, { pessoaId })`.

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
it("fora do escopo ou sem papel do Inbox: null", async () => {
  expect(await atendimentoParaAbrir(sess(outro), { leadId: op.id })).toBeNull();
  expect(await atendimentoParaAbrir(sess(aluno), { leadId: op.id })).toBeNull();
});
// PainelOportunidade.test.ts
it("“Abrir conversa” e “Agendar mensagem” com conversa aberta; só abrir com encerrada", () => {
  expect(h({ conversa: { atendimentoId: "a1", aberta: true } })).toContain('href="/inbox?c=a1&amp;agendar=1"');
  expect(h({ conversa: { atendimentoId: "a1", aberta: false } })).not.toContain("Agendar mensagem");
  expect(h({ conversa: null })).not.toContain("Abrir conversa");
});
// aria/consultas.int.test.ts
it("historicoAria devolve o atendimentoId da ação", async () => { /* … */ });
// painel-detalhes.int.test.ts
it("participante B2B com conversa visível tem hrefConversa", async () => { /* … */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node_modules/.bin/vitest run "src/app/(app)/funil/" "src/app/(app)/tarefas/" "src/app/(app)/contatos/" "src/app/(app)/aria/"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/atalhos.int.test.ts src/server/aria/consultas.int.test.ts src/server/inbox/painel-detalhes.int.test.ts`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Implement**

As páginas só chamam `atendimentoParaAbrir` com o painel aberto (`?o=`, `?t=` ou `?c=`). No Agente, `historicoAria` acrescenta `atendimentoId: a.atendimentoId`; o escopo é conferido pelo Inbox ao abrir (`inbox/page.tsx:53-57`).

- [ ] **Step 4: Run the tests to verify they pass**

Mesmos comandos. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Capturar `/funil?o=<Mariana>`, `/tarefas?t=<tarefa da Mariana>`, `/contatos?c=<Mariana>` e `/aria?aba=historico` em 1440×900, nos dois temas (são estados novos `entrada-funil`, `entrada-tarefas`, `entrada-contatos` e `entrada-agente`, só do app). As referências são `ui2/Funil.dc.html:628`, `Tarefas.dc.html:582`, `Contatos.dc.html:624` e `Agente.dc.html:618`, e só valem para a presença e o texto do link.

- [ ] **Step 6: Commit**

```bash
git add src/server/inbox/atalhos.ts src/server/inbox/atalhos.int.test.ts src/server/inbox/painel-detalhes.ts src/server/inbox/painel-detalhes.int.test.ts src/server/aria/consultas.ts src/server/aria/consultas.int.test.ts "src/app/(app)/funil/" "src/app/(app)/tarefas/" "src/app/(app)/contatos/" "src/app/(app)/aria/_componentes/Historico.tsx" scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): abrir conversa e agendar mensagem a partir de funil, tarefas, contatos e agente (E2.16, D21)"
```

<a id="task-17"></a>
### Task 17: @menção em nota interna com aviso no sino (D20), bloqueada

**Estado:** bloqueada por D20. O padrão ("@menção sem aviso") não pede nada além da aba Nota da E1, onde `@` já é texto comum. A task só anda quando o dono aprovar o aviso.

**Files (quando aprovada):**
- Create: `prisma/migrations/20261023140000_notificacao_mencao_nota/migration.sql` (`ALTER TYPE "TipoNotificacao" ADD VALUE 'MENCAO_NOTA';`, sozinho na migration)
- Create: `src/server/inbox/mencoes.ts`
- Modify: `src/server/whatsapp/acoes-conversa.ts:24-45` (`registrarNotaAtendimento` grava as notificações na mesma transação); `src/app/(app)/tarefas/SinoNotificacoes.tsx` (rótulo e link `/inbox?c=`); `src/app/(app)/inbox/RodapeConversa.tsx` (lista de pessoas ao digitar `@`, `P:1108`)
- Test: `src/server/inbox/mencoes.test.ts`, `src/server/whatsapp/nota-mencao.int.test.ts`

**Interfaces (quando aprovada):**
- `extrairMencoes(texto: string, pessoas: { id: string; nome: string }[]): string[]`: devolve ids; reconhece `@` com o primeiro nome ou com o nome completo, sem acento e sem caixa; ignora o autor.
- Notificação `MENCAO_NOTA`, com `refTipo: "AtendimentoWhatsApp"`, `refId: atendimentoId` e `titulo: "<autor> mencionou você numa nota"`. Só vai para quem enxerga o atendimento (`atendimentoVisivel`), uma por pessoa e por nota; a idempotência vem da marca da nota (#166).

- [ ] **Step 1:** testes `extrai_primeiro_nome_e_nome_completo`, `ignora_o_autor_e_quem_nao_ve_o_atendimento` e `repetir_a_nota_com_a_mesma_chave_nao_duplica_notificacao`.
- [ ] **Steps 2–4:** ciclo TDD, com os comandos das tasks anteriores.
- [ ] **Step 5:** aceite visual do estado `nota-interna` com a lista de menção (`P:1105-1109`).
- [ ] **Step 6:** commit `feat(inbox): menção em nota com aviso no sino (E2.17, D20)`.

<a id="task-18"></a>
### Task 18: Tarefa com prioridade baixa, lembretes de 15 min e 1 dia, recorrência e "notificar também" (D10), bloqueada

**Estado:** bloqueada por D10. O padrão mantém os campos atuais (Task 11).

**Files (quando aprovada):**
- Create: `prisma/migrations/20261023120000_tarefa_prioridade_lembretes/migration.sql` (`ALTER TYPE "PrioridadeTarefa" ADD VALUE 'BAIXA';`, sozinho)
- Create: `prisma/migrations/20261023130000_tarefa_recorrencia_notificar/migration.sql`: `Tarefa.recorrencia`, enum `NAO_REPETE | DIARIA | SEMANAL | MENSAL` com o padrão `NAO_REPETE`; tabela `TarefaNotificado(tarefaId, usuarioId)` com PK composta
- Modify:
  - `src/server/crm/tarefas.ts:50-51`: prioridade `BAIXA`; lembretes `0 | 15 | 60 | 1440`, mantendo `10 | 30` para as tarefas antigas;
  - `src/server/crm/lembretes.ts`: gera a próxima ocorrência quando a recorrente é concluída e avisa os notificados;
  - `ModalTarefa`: "Mais opções" com Repetir e "Notificar também" (`P:724-727`).
- Test: `src/server/crm/tarefa-recorrencia.int.test.ts`, `ModalTarefa.test.ts`

- [ ] **Step 1:** testes `concluir_recorrente_cria_a_proxima_com_a_mesma_hora`, `lembrete_de_1_dia`, `notificados_recebem_o_lembrete` e `prioridade_baixa`.
- [ ] **Steps 2–5:** ciclo TDD; aceite visual `tarefa-nova-mais-opcoes` (`telas/prototipo-estado-tarefa-nova-mais-opcoes.png`).
- [ ] **Step 6:** commit `feat(tarefas): recorrência, lembretes e notificados (E2.18, D10)`.

<a id="task-19"></a>
### Task 19: "Enviar mensagem nesta data" na tarefa (D11), bloqueada

**Estado:** bloqueada por D11, que decide o vínculo do agendamento com a tarefa. O padrão é "campos atuais", e `agendarMensagemNoAtendimento` não passa `tarefaId` (`whatsapp/acoes-conversa.ts:72-87`). A Task 16 da E4 ("Anexo e vínculo no agendamento") cuida do mesmo vínculo; esta task consome o que ela entregar.

**Files (quando aprovada):**
- Modify: `src/server/inbox/acoes-painel.ts`: `criarTarefaNoInbox` aceita `mensagem?: { texto: string; chaveIdempotencia: string }` e agenda para o `inicioEm` da tarefa, só se for futuro (`P:926-927`), pelo wrapper de agendamento com vínculo da E4.
- Modify: `ModalTarefa`, com a caixa "Enviar mensagem nesta data" (`P:715-720`).
- Test: `src/server/inbox/acoes-painel-criar-tarefa.int.test.ts`, casos `mensagem_agendada_com_tarefaId`, `horario_passado_nao_agenda` e `repetir_nao_agenda_duas_vezes`.

- [ ] **Steps 1–6:** ciclo TDD; aceite `tarefa-nova-mais-opcoes`; commit `feat(inbox): mensagem agendada junto da tarefa (E2.19, D11)`.

<a id="task-20"></a>
### Task 20: CPF e idade na Pessoa (D13), bloqueada

**Estado:** bloqueada por D13. O padrão é não ter CPF nem idade na Pessoa; hoje esses dados só existem em `Aluno.documento` e `Aluno.nascimento` (`schema.prisma:1197-1207`).

**Files (quando aprovada):**
- Create: `prisma/migrations/20261023150000_pessoa_cpf_nascimento/migration.sql`: `Pessoa.documento TEXT` e `Pessoa.nascimento DATE`, ambos nulos e sem índice.
- Modify:
  - `src/server/crm/contatos.ts:382-407`: `EditarPessoaSchema` com o documento validado por país e o `nascimento` como data civil. O documento nunca vai em claro no payload do Evento, como já acontece com o e-mail.
  - `painel-detalhes.ts`: `PessoaPainel.documento` e a `idade`, calculada no fuso da escola.
  - `AbaDetalhes` e `GavetaContato`: linhas "CPF" e "Idade" (`P:1129`).
  - Regra de exibição por setor conforme a resposta do dono.
- Test: `src/server/crm/pessoa-documento.int.test.ts`, `AbaDetalhes.test.ts`

- [ ] **Steps 1–6:** ciclo TDD; aceite `painel-detalhes`; commit `feat(crm): CPF e nascimento na pessoa (E2.20, D13)`.

<a id="task-21"></a>
### Task 21: Probabilidade e previsão de fechamento da oportunidade (D13), bloqueada

**Estado:** bloqueada por D13. O pedido da etapa põe estes campos na mesma decisão. Eles não existem em `Oportunidade` (`schema.prisma:1408-1494`).

**Files (quando aprovada):**
- Create: `prisma/migrations/20261023160000_oportunidade_probabilidade_previsao/migration.sql`: `"Lead"."probabilidadePct" INTEGER`, com `CHECK` de 0 a 100, e `"Lead"."previsaoFechamento" TEXT`, como data civil.
- Modify:
  - `src/server/comercial/schema.ts` e `comercial/acoes.ts:321` (`editarLead`);
  - `crm/historico.ts:21-64,158-222` (`DetalheOportunidade`);
  - `painel-oportunidades.ts` e `AbaOportunidades`: linha "Probabilidade · previsão" (`P:1140`).
- Test: `src/server/comercial/probabilidade.int.test.ts`, `AbaOportunidades.test.ts`

- [ ] **Steps 1–6:** ciclo TDD; aceite `painel-oportunidades`; commit `feat(comercial): probabilidade e previsão de fechamento (E2.21, D13)`.

---

## Fora da E2

| Item | Onde fica |
|---|---|
| "Marcar como não lida" | E1 (menu ⋮) |
| "Devolver para Aria" | E3 (Task 7) |
| "Gerenciar números em Configurações" | E1 (seletor de número) |
| Parte de UI do B6: atalhos de horário do agendamento, conflito, rascunho e cartões de agendada no fio | E4 (Tasks 3–5), que já os planeja. O pedido da etapa os punha na E2 "se não dependerem de D11"; entraram na E4 para não ter dois donos. A E2 deixou o `src/lib/atalhos-horario.ts` com a interface dela |
| Leitura do `?agendar=1` | E4. A E2 só gera os links (Task 16) |
| Editar o texto da agendada, anexo, "perguntar se o contato responder", recorrência e "Escrever com Aria" | E4 (D11) |
| Cartão de sugestão, faixa e modal de handoff, assumir com pausa da Aria | E3 (D1–D3) |
| Aba Insights e temperatura com score | E4 (D12) |
| "Falar com" sem uma conversa da pessoa já aberta | Sem back-end (análise parte 3, T27). A E2 só leva à conversa que já existe |
| Notas do atendimento no fio e na rota | E0 (Tasks 3 e 4) |

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

Acrescentar `Tarefa.atendimentoId` (migrations `20261023100000` e `20261023110000`), aceito por `criarTarefa` e gravado pela Aria quando cria tarefa.

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
- `criar-tarefa-idempotencia.int.test.ts` e `tarefas.int.test.ts` sem regressão

**Dependências:**
- Nenhuma

### [Inbox E2.3] Cabeçalho e Detalhes: consultas e rota das abas (D13)

**Labels:** `inbox`, `etapa-2`, `back-end`

Consultas do cabeçalho do painel (subtítulo, contato sem nome, tags disponíveis, capacidades) e da aba Detalhes, com as regras 5 e 6 e o padrão de D13, mais a rota `GET /api/inbox/atendimentos/[id]/painel/[aba]`.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-3`

**Arquivos:**
- `src/server/inbox/painel-detalhes.ts`
- `src/server/inbox/painel-abas.ts`
- `src/server/inbox/paineis.ts`
- `src/app/api/inbox/atendimentos/[id]/painel/[aba]/route.ts`

**Critérios de aceite:**
- `painel-detalhes.test.ts`, `painel-detalhes.int.test.ts` e `painel/[aba]/route.test.ts` passando

**Dependências:**
- E2.1
- D13 (vale o padrão)

### [Inbox E2.4] Tags e contato sem nome no cabeçalho do painel (D20)

**Labels:** `inbox`, `etapa-2`, `ui`

"+ tag" com busca (e criação para quem gerencia equipe), remoção de tag sobre as pílulas da E1 com ✦, e o bloco "contato sem nome".

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-4`

**Arquivos:**
- `src/app/(app)/inbox/abas/TagsContato.tsx`
- `src/app/(app)/inbox/abas/ContatoSemNome.tsx`
- `src/app/(app)/inbox/PainelContato.tsx`
- `src/app/(app)/inbox/InboxNovo.tsx`
- `src/server/inbox/acoes-painel.ts`
- `src/server/inbox/paineis.ts`
- `src/server/crm/tags.ts`

**Critérios de aceite:**
- `TagsContato.test.ts`, `ContatoSemNome.test.ts`, `acoes-painel-tags.int.test.ts` e `paineis.int.test.ts` passando
- Aceite visual de `painel-detalhes` e `painel-sem-nome` (1440×900, 1024×768 e 390×844, claro e escuro) anexado ao PR

**Dependências:**
- E2.3
- E1 (`PainelContato`, `TagPainel`, `tagsDaPessoa`)
- D20 (vale o padrão)

### [Inbox E2.5] Aba Detalhes e bloco B2B (D13)

**Labels:** `inbox`, `etapa-2`, `ui`

Conteúdo comercial da aba Detalhes: oportunidade atual, contato, perfil ou empresa e bloco B2B; fora do comercial fica a aba da E1.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-5`

**Arquivos:**
- `src/app/(app)/inbox/abas/AbaDetalhes.tsx`
- `src/app/(app)/inbox/abas/BlocoB2B.tsx`
- `src/app/(app)/inbox/abas/useAbaPainel.ts`
- `src/app/(app)/inbox/InboxNovo.tsx`

**Critérios de aceite:**
- `AbaDetalhes.test.ts` e `useAbaPainel.test.ts` passando
- Aceite visual de `painel-detalhes` e `painel-detalhes-b2b` anexado ao PR

**Dependências:**
- E2.3
- E2.4
- E1 (`LinhaCampo`)
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
- `GavetaContato.test.ts` e `acoes-painel-contato.int.test.ts` passando
- Aceite visual de `painel-editar-contato` anexado ao PR

**Dependências:**
- E2.5
- D14 (vale o padrão)

### [Inbox E2.7] Aba Oportunidades: consulta e barra de etapas (D8)

**Labels:** `inbox`, `etapa-2`, `ui`

Aba Oportunidades com a barra e o select de etapas pelas regras do funil (`destinoDoArraste`) e a ação `moverEtapaNoInbox`.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-7`

**Arquivos:**
- `src/server/inbox/painel-oportunidades.ts`
- `src/server/inbox/painel-abas.ts`
- `src/server/inbox/acoes-painel.ts`
- `src/app/(app)/inbox/abas/etapas-painel.ts`
- `src/app/(app)/inbox/abas/BarraEtapas.tsx`
- `src/app/(app)/inbox/abas/AbaOportunidades.tsx`
- `src/app/(app)/inbox/PainelContato.tsx`
- `src/app/(app)/inbox/InboxNovo.tsx`

**Critérios de aceite:**
- `etapas-painel.test.ts`, `AbaOportunidades.test.ts`, `PainelContato.test.ts` e `painel-oportunidades.int.test.ts` passando
- Aceite visual de `painel-oportunidades` anexado ao PR

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
- `CartaoExperimental.test.ts`, `AbaOportunidades.test.ts`, `ModalPerda.acao.test.ts` e `acoes-painel-perda.int.test.ts` passando
- Aceite visual de `painel-oportunidades` e `perda` anexado ao PR

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
- `OutrasOportunidades.test.ts`, `ClienteVoltou.test.ts`, `cliente-voltou.int.test.ts` e `funil/page.test.ts` passando
- Aceite visual de `painel-cliente-voltou` anexado ao PR

**Dependências:**
- E2.7
- D18 (vale o padrão)

### [Inbox E2.10] Tarefas da oportunidade: lista e ações (D10)

**Labels:** `inbox`, `etapa-2`, `ui`

Lista de tarefas na aba Oportunidades, com concluir, reabrir, reagendar para amanhã 9h, editar e cancelar com motivo; cria `src/lib/atalhos-horario.ts` com a interface da E4.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-10`

**Arquivos:**
- `src/server/inbox/painel-tarefas.ts`
- `src/server/inbox/painel-oportunidades.ts`
- `src/server/inbox/acoes-painel.ts`
- `src/lib/atalhos-horario.ts`
- `src/app/(app)/inbox/abas/TarefasOportunidade.tsx`
- `src/app/(app)/inbox/abas/AbaOportunidades.tsx`

**Critérios de aceite:**
- `atalhos-horario.test.ts`, `TarefasOportunidade.test.ts` e `acoes-painel-tarefas.int.test.ts` passando
- Aceite visual de `painel-oportunidades-tarefas` anexado ao PR

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
- `ModalTarefa.test.ts` e `acoes-painel-criar-tarefa.int.test.ts` passando
- Aceite visual de `tarefa-nova` e `tarefa-editar` anexado ao PR

**Dependências:**
- E2.10
- D10 (vale o padrão)

### [Inbox E2.12] Cartão de tarefa no fio e entradas de tarefa e nota

**Labels:** `inbox`, `etapa-2`, `ui`

Tarefas ligadas à conversa entram no fio (`ItemFio`, `intercalarFio`, sobre o `itensDaThread` da E0) com editar e concluir; "Criar tarefa" no menu ⋮, no rodapé e no painel; "Adicionar nota" no painel.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-12`

**Arquivos:**
- `src/components/conversa/CartaoTarefaFio.tsx`
- `src/components/conversa/intercalar-fio.ts`
- `src/server/inbox/paineis.ts`
- `src/app/(app)/inbox/ConversaAberta.tsx`
- `src/app/(app)/inbox/AcoesAtendimento.tsx`
- `src/app/(app)/inbox/RodapeConversa.tsx`
- `src/app/(app)/inbox/abas/AbaOportunidades.tsx`
- `src/app/(app)/inbox/InboxNovo.tsx`

**Critérios de aceite:**
- `intercalar-fio.test.ts`, `CartaoTarefaFio.test.ts`, `RodapeConversa.test.ts`, `AcoesAtendimento.test.ts` e `paineis.int.test.ts` passando
- Aceite visual de `fio-tarefa` anexado ao PR

**Dependências:**
- E2.11
- E0 (`itensDaThread`, `ItemThread`)
- E1 (`RodapeConversa`, `itensDoMenuConversa`)

### [Inbox E2.13] Aba Atividade: agendadas, atividade recente e notas (D11)

**Labels:** `inbox`, `etapa-2`, `ui`

Aba Atividade com as mensagens agendadas (lista e cancelar), o resumo da atividade e as duas últimas notas internas.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-13`

**Arquivos:**
- `src/server/inbox/painel-atividade.ts`
- `src/server/inbox/painel-abas.ts`
- `src/server/inbox/acoes-painel.ts`
- `src/app/(app)/inbox/abas/AbaAtividade.tsx`
- `src/app/(app)/inbox/abas/AgendadasAtividade.tsx`
- `src/app/(app)/inbox/PainelContato.tsx`
- `src/app/(app)/inbox/InboxNovo.tsx`

**Critérios de aceite:**
- `AbaAtividade.test.ts`, `PainelContato.test.ts` e `painel-atividade.int.test.ts` passando
- Aceite visual de `painel-atividade` e `painel-atividade-agendadas` anexado ao PR

**Dependências:**
- E2.10
- E0 (`notasInternasDoAtendimento`)
- D11 (vale o padrão)
- Pedido à E4: "Reagendar" e "Enviar agora" na seção

### [Inbox E2.14] Aba Atividade: Aria neste contato e alterações da IA com desfazer (D1)

**Labels:** `inbox`, `etapa-2`, `ui`

Confiança, regras da etapa e lista das alterações da Aria com desfazer idempotente, mais o contador da aba.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-14`

**Arquivos:**
- `src/server/inbox/texto-aria.ts`
- `src/server/inbox/painel-atividade.ts`
- `src/server/inbox/painel-detalhes.ts`
- `src/server/inbox/acoes-painel.ts`
- `src/server/aria/historico.ts`
- `src/app/(app)/inbox/abas/AlteracoesAria.tsx`
- `src/app/(app)/inbox/abas/AbaAtividade.tsx`
- `src/app/(app)/inbox/PainelContato.tsx`

**Critérios de aceite:**
- `texto-aria.test.ts`, `AlteracoesAria.test.ts`, `PainelContato.test.ts`, `historico.int.test.ts` e `painel-atividade-aria.int.test.ts` passando
- Aceite visual de `painel-atividade` (gerente e vendedor) anexado ao PR

**Dependências:**
- E2.13
- D1 (vale o padrão)

### [Inbox E2.15] Atalhos de saída: matrícula, contato e link da conversa

**Labels:** `inbox`, `etapa-2`, `ui`

Código da matrícula vira link para `/matriculas/[id]`; `hrefConversa`; corrige o "Abrir contato" do funil para `/contatos?c=`.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-15`

**Arquivos:**
- `src/lib/href-conversa.ts`
- `src/server/inbox/paineis.ts`
- `src/app/(app)/inbox/PainelSetor.tsx`
- `src/app/(app)/funil/PainelOportunidade.tsx`

**Critérios de aceite:**
- `href-conversa.test.ts`, `PainelSetor.test.ts`, `paineis.int.test.ts` e `PainelOportunidade.test.ts` passando
- Aceite visual de `painel-secretaria` anexado ao PR

**Dependências:**
- E1

### [Inbox E2.16] Atalhos de entrada nas outras telas (D21)

**Labels:** `inbox`, `etapa-2`, `ui`

"Abrir conversa" e "Agendar mensagem" no Funil, em Tarefas, em Contatos e no Agente, pela conversa visível da oportunidade ou da pessoa.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-16`

**Arquivos:**
- `src/server/inbox/atalhos.ts`
- `src/server/inbox/painel-detalhes.ts`
- `src/server/aria/consultas.ts`
- `src/app/(app)/funil/PainelOportunidade.tsx`
- `src/app/(app)/tarefas/PainelTarefa.tsx`
- `src/app/(app)/contatos/FichaContato.tsx`
- `src/app/(app)/aria/_componentes/Historico.tsx`

**Critérios de aceite:**
- `atalhos.int.test.ts`, `aria/consultas.int.test.ts`, `painel-detalhes.int.test.ts` e os testes de render das quatro telas passando
- Aceite visual de `entrada-funil`, `entrada-tarefas`, `entrada-contatos` e `entrada-agente` anexado ao PR

**Dependências:**
- E2.15
- E4 (leitura de `?agendar=1`)
- D21 (vale o padrão)

### [Inbox E2.17] @menção em nota interna com aviso no sino (D20)

**Labels:** `inbox`, `etapa-2`, `back-end`, `bloqueado-por-decisao`

Mencionar uma pessoa com `@` na nota interna e avisá-la no sino (migration reservada `20261023140000`).

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-17`

**Arquivos:**
- `prisma/migrations/20261023140000_notificacao_mencao_nota/migration.sql`
- `src/server/inbox/mencoes.ts`
- `src/server/whatsapp/acoes-conversa.ts`
- `src/app/(app)/tarefas/SinoNotificacoes.tsx`
- `src/app/(app)/inbox/RodapeConversa.tsx`

**Critérios de aceite:**
- Testes da task passando
- Aceite visual de `nota-interna` com a lista de menção anexado ao PR

**Dependências:**
- D20 (aguarda resposta)
- E0
- E1

### [Inbox E2.18] Tarefa com prioridade baixa, lembretes de 15 min e 1 dia, recorrência e "notificar também" (D10)

**Labels:** `inbox`, `etapa-2`, `back-end`, `bloqueado-por-decisao`

Campos de tarefa do protótipo que o ERP não tem (migrations reservadas `20261023120000` e `20261023130000`).

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-18`

**Arquivos:**
- `prisma/migrations/20261023120000_tarefa_prioridade_lembretes/migration.sql`
- `prisma/migrations/20261023130000_tarefa_recorrencia_notificar/migration.sql`
- `src/server/crm/tarefas.ts`
- `src/server/crm/lembretes.ts`
- `src/app/(app)/inbox/ModalTarefa.tsx`

**Critérios de aceite:**
- Testes da task passando
- Aceite visual de `tarefa-nova-mais-opcoes` anexado ao PR

**Dependências:**
- D10 (aguarda resposta)
- E2.11

### [Inbox E2.19] "Enviar mensagem nesta data" na tarefa (D11)

**Labels:** `inbox`, `etapa-2`, `back-end`, `bloqueado-por-decisao`

Agendar a mensagem ao contato junto da tarefa, ligada a ela, pelo vínculo de agendamento da E4.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-19`

**Arquivos:**
- `src/server/inbox/acoes-painel.ts`
- `src/app/(app)/inbox/ModalTarefa.tsx`

**Critérios de aceite:**
- Testes da task passando
- Aceite visual de `tarefa-nova-mais-opcoes` anexado ao PR

**Dependências:**
- D11 (aguarda resposta)
- E2.11
- E4 (Task 16, vínculo no agendamento)

### [Inbox E2.20] CPF e idade na Pessoa (D13)

**Labels:** `inbox`, `etapa-2`, `back-end`, `bloqueado-por-decisao`

Documento e data de nascimento na Pessoa, no painel e na gaveta (migration reservada `20261023150000`).

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-20`

**Arquivos:**
- `prisma/migrations/20261023150000_pessoa_cpf_nascimento/migration.sql`
- `src/server/crm/contatos.ts`
- `src/server/inbox/painel-detalhes.ts`
- `src/app/(app)/inbox/abas/AbaDetalhes.tsx`
- `src/app/(app)/inbox/abas/GavetaContato.tsx`

**Critérios de aceite:**
- Testes da task passando
- Aceite visual de `painel-detalhes` anexado ao PR

**Dependências:**
- D13 (aguarda resposta)
- E2.5
- E2.6

### [Inbox E2.21] Probabilidade e previsão de fechamento da oportunidade (D13)

**Labels:** `inbox`, `etapa-2`, `back-end`, `bloqueado-por-decisao`

Probabilidade e previsão de fechamento na oportunidade e na aba Oportunidades (migration reservada `20261023160000`).

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-21`

**Arquivos:**
- `prisma/migrations/20261023160000_oportunidade_probabilidade_previsao/migration.sql`
- `src/server/comercial/schema.ts`
- `src/server/comercial/acoes.ts`
- `src/server/crm/historico.ts`
- `src/server/inbox/painel-oportunidades.ts`
- `src/app/(app)/inbox/abas/AbaOportunidades.tsx`

**Critérios de aceite:**
- Testes da task passando
- Aceite visual de `painel-oportunidades` anexado ao PR

**Dependências:**
- D13 (aguarda resposta)
- E2.7
