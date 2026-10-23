# Inbox no patamar do protótipo, Etapa 4 (fluxos novos): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** entregar no Inbox os fluxos do protótipo que ainda não existem (Transferir unificado, nova conversa, agendamento completo, anexos extras e Insights) até onde as regras atuais do ERP permitem, e deixar escritas, prontas para executar, as partes que dependem das decisões D5, D6, D9, D11 e D12.

**Architecture:** cada fluxo vira um componente em `src/app/(app)/inbox/fluxos/`, aberto num painel ancorado (`PopoverFluxo`) que vira folha de baixo no celular. As regras de quem vê cada opção ficam em funções puras (`opcoesTransferir`, `buscarNovaConversa`, `atalhosDeHorario`, `agendadaProxima`), testadas sem DOM. O servidor reaproveita as ações que já existem (`transferirAtendimento`, `atribuirAtendimento`, `devolverParaFila`, `devolverParaAria`, `abrirAtendimentoInstitucional`, `agendarMensagem`, `reagendarMensagem`, `enviarAgora`, `cancelarMensagemAgendada`, `enviarConteudoInbox`). Ganha só wrappers por atendimento, uma consulta das agendadas, o envio da proposta e um trigger de aviso em tempo real. As tasks bloqueadas mudam regra ou modelo e só rodam depois da decisão registrada no índice.

**Tech Stack:** Next.js (App Router, Server Actions), React 19, Prisma/Postgres, Zod, Vitest (unitário `node_modules/.bin/vitest run <arquivo>`; integração `node_modules/.bin/vitest run -c vitest.integration.config.ts <arquivo>` com o perfil de banco descartável), `@tabler/icons-react`.

**Spec:**
- Contrato comum: `docs/superpowers/plans/2026-10-22-inbox-prototipo-00-indice.md` (decisões, contrato de componentes, tokens, faixa de migration, formato de issues).
- Análise parte 3: `docs/planejamento/inbox-prototipo/analise-parte3-telas-atalhos.md`, blocos B6 (parte de back-end), B9, B10 e B11; telas T01, T05, T16, T17, T18 e T21; atalhos A14, A16 e A21; perguntas 3, 4, 7, 9 e 10.
- Análise parte 2: `docs/planejamento/inbox-prototipo/analise-parte2-botoes-funcionalidades.md`, itens L13–L14, C4–C8, C10, T7–T12, F5–F25, P27 e P31; seção 11.3; perguntas 8, 9, 10, 11, 14, 15 e 18.
- Protótipo: `docs/planejamento/inbox-prototipo/prototipo/Inbox.dc.html`. Linhas citadas como `P:<linha>`:
  - Nova conversa: P:45-79 e P:934-939, P:1041-1054.
  - Transferir: P:174 e P:187-236, P:833-835, P:960-968, P:1172-1176.
  - Agendar: P:362-403, P:859-863, P:881, P:940-958, P:1075-1095.
  - Cartões de agendada: P:328-350.
  - Anexos: P:355-360, P:969-972, P:1161.
  - Insights: P:651-677, P:823, P:1165-1166.

## Acréscimos ao contrato (E4)

Valem junto com o contrato do índice. Nada aqui redefine o que outra etapa criou. Quando a etapa anterior já tiver entregue o equivalente, use o dela e ajuste os nomes nesta tabela no mesmo PR.

**Componentes novos.** Caminhos relativos a `src/app/(app)/inbox/`.

| Arquivo | Task | Responsabilidade | Interface pública |
|---|---|---|---|
| `fluxos/PopoverFluxo.tsx` | 1 | Painel ancorado (cabeçalho, coluna ou compositor). No celular vira folha de baixo. `role="dialog"` + `useDialogo` (trava `dialogos.test.ts`) | `PopoverFluxo(props: { titulo: string; posicao: "cabecalho" \| "coluna" \| "compositor"; aoFechar(): void; bloquearFechamento?: boolean; icone?: React.ReactNode; children: React.ReactNode })` |
| `fluxos/transferir/opcoes-transferir.ts` | 1 | Quem vê Pessoas, Equipes e filas, Fila do setor e Devolver para a Aria (pura) | `opcoesTransferir(e: EntradaTransferir): OpcoesTransferir`; `REGRAS_TRANSFERIR_PADRAO` |
| `fluxos/transferir/PopoverTransferir.tsx` | 1 | Popover de 2 passos | `PopoverTransferir(props: PropsPopoverTransferir)` |
| `fluxos/nova-conversa/busca-nova-conversa.ts` | 2 | Filtra conversas e destinos pela busca (pura) | `buscarNovaConversa(...)`, `canaisDoDestino(...)` |
| `fluxos/nova-conversa/PopoverNovaConversa.tsx` | 2 | Substitui `NovoAtendimento.tsx` (contrato: "vira o popover de nova conversa") | `PopoverNovaConversa(props: PropsPopoverNovaConversa)` |
| `fluxos/agendar/validar-quando.ts` | 4 | `validarQuando` sai de `AcoesAtendimento.tsx:56-62` | `validarQuando(quando: string, fuso: string, agora?: Date): string \| null` |
| `fluxos/agendar/conflito.ts` | 4 | Outra agendada a menos de 2 h (pura) | `agendadaProxima(...)` |
| `fluxos/agendar/PopoverAgendar.tsx` | 4 | Agendar e editar agendamento | `PopoverAgendar(props: PropsPopoverAgendar)` |
| `fluxos/agendar/quando-agendada.ts` | 5 | "Hoje às 18:00", "Amanhã às 09:00" e "26/10 às 09:00" no fuso de exibição (pura) | `quandoAgendada(iso: string, fuso: string, agora: Date): string` |
| `fluxos/agendar/useAgendadas.ts` | 5 | Carrega as agendadas do atendimento num efeito. Recarrega pelo aviso do SSE, sem polling | `useAgendadas(atendimentoId: string \| null): { agendadas: AgendadaNoFio[]; recarregar(): void }` |
| `fluxos/agendar/CartaoAgendada.tsx` | 5 | Cartão tracejado no fio | `CartaoAgendada(props: PropsCartaoAgendada)` |
| `abas/AbaInsights.tsx` | — | Só depois da Task 18 (spike D12) | definida pelo spike |

**Fora de `inbox/`:**

| Arquivo | Task | Interface |
|---|---|---|
| `src/lib/atalhos-horario.ts` | 4 | `atalhosDeHorario(agora: Date, fuso: string): AtalhoHorario[]`. Se a E2 já tiver criado atalhos para o modal de tarefa, estenda esse módulo com o atalho `"1h"` em vez de criar outro |
| `src/components/conversa/itens-anexo.ts` | 6 | `ITENS_ANEXO`, `IdItemAnexo` |
| `src/components/conversa/anexos/FormEnquete.tsx`, `FormLocalizacao.tsx`, `coordenadas.ts` | 8 | `FormEnquete`, `FormLocalizacao`, `lerCoordenadas(texto: string)` |
| `src/server/whatsapp/proposta-atendimento.ts` | 7 | `propostasVisiveis(...)`, `exigirPropostaVisivel(...)`. Módulo comum, sem `"use server"` |
| `src/server/aria/resumo-nota.ts` | 10 | `resumoDaAriaParaNota(db, atendimentoId): Promise<string \| null>`. Se a E3 já tiver uma leitura do resumo de handoff, use a dela |
| `src/server/whatsapp/nova-conversa.ts` | 13 | `buscarParaNovaConversa`, `iniciarConversaPorNumero` (`"use server"`) |

**Pontos de encaixe nos componentes da E1.** Se a E1 já entregou o equivalente, use o nome dela.

- `CabecalhoConversa`:
  - o botão Transferir chama `acoes.aoTransferir(): void`;
  - prop nova `popoverTransferir?: React.ReactNode`, desenhada dentro do `<header>` com `position: relative`.
- `ColunaConversas`: `aoNovaConversa()` já está no contrato. Prop nova `popoverNovaConversa?: React.ReactNode`.
- `RodapeConversa`, no modo compositor:
  - `aoAgendar?(): void`: botão relógio com `aria-label="Agendar mensagem"`, entre o clipe e o campo (P:426);
  - `popoverAgendar?: React.ReactNode`.
- Fio da conversa: slot `cartoesNoFio?: React.ReactNode`, desenhado depois da última mensagem, dentro da área que rola. A E3 usa o mesmo slot para `CartaoSugestaoAria`; se a E3 o nomeou de outro jeito, use o nome dela.
- `PropsInboxNovo` ganha dois campos:
  - `opcoesAtendimento: OpcoesAtendimento`, que hoje vai só para o `NovoAtendimento`;
  - `agendarAoAbrir?: boolean`.
- `page.tsx` lê `?agendar=1`. A E4 é dona da leitura; a E2 (D21) só gera os links.
- `MenuConversa`:
  - o item "Agendar mensagem" abre `PopoverAgendar`;
  - "Atribuir" e "Devolver para a fila" saem do menu ⋮ e passam a ser opções do Transferir (Task 1).

**Compositor** (`src/components/conversa/Compositor.tsx`). `PropsCompositor` ganha:
- `propostas?: { oportunidadeId: string | null; itens: readonly PropostaAnexavel[] }`;
- `aoEnviarProposta?(documentoId: string): Promise<Resultado<unknown>>`;
- `aoEnviarConteudo?(c: ConteudoEspecial): Promise<Resultado<unknown>>`;
- `aoListarContatosCartao?(): Promise<ContatoCartao[]>`.

O módulo também exporta `lerRascunho` e `gravarRascunho`, para o "Salvar rascunho" do agendar.

**Servidor.** Exportações novas nas tasks executáveis:
- `src/server/whatsapp/consultas-acoes-atendimento.ts` (`"use server"`):
  - `agendadasDoAtendimento(atendimentoId)` (Task 3);
  - `propostasDoAtendimento(atendimentoId)` (Task 7);
  - `contatosParaCartao(atendimentoId)` (Task 9).
- `src/server/whatsapp/acoes-conversa.ts` (`"use server"`):
  - `reagendarAgendamentoDoAtendimento` e `enviarAgendamentoAgoraDoAtendimento` (Task 3);
  - `enviarPropostaNoAtendimento` (Task 7).
- `src/server/crm/mensagens-agendadas.ts`:
  - `type OpcoesAlterarAgendada = { viaAtendimento?: boolean; chaveIdempotencia?: string }`, terceiro parâmetro opcional de `reagendarMensagem`, `enviarAgora` e `cancelarMensagemAgendada`. Só os wrappers de `acoes-conversa.ts` o passam. Os wrappers `"use server"` de `tarefas-acoes.ts` continuam sem ele;
  - `escopoAutoresAgendada`, que é o `escopoAutores` atual exportado (Task 3).
- `src/server/whatsapp/midia.ts`: `copiarDocumentoParaSaida(autorId, url)` (Task 7).

**Eventos novos** (registrar em `docs/12-catalogo-de-eventos.md` na task que os cria):
- `PropostaEnviadaNoAtendimento` (Task 7);
- `MensagemAgendadaEditada` (Task 15);
- `MensagemAgendadaMantida` (Task 14).

`MensagemReagendada` passa a levar a marca de idempotência.

**Migrations da faixa E4:**

| ID | Task | Conteúdo |
|---|---|---|
| `20261023300000_inbox_aviso_agendada` | 3 | Função `notificar_inbox_agendada()` e trigger em `IntencaoMensagem` |
| `20261023310000_agendada_perguntar_se_responder` | 14 (D11) | `perguntarSeResponder`, `confirmadaAposRespostaEm` |
| `20261023320000_origem_prospeccao_ativa` | 13 (D9) | `OrigemCanal.PROSPECCAO_ATIVA` |
| `20261023330000`–`20261023340000` | reserva da Task 18 (D12) | modelo de Insights, se a decisão for "completo" |
| `20261023350000`–`20261023360000` | reserva da Task 17 (D6) | presença e equipes, se a decisão pedir modelo |
| `20261023370000` | reserva da Task 19 (D22) | catálogo, se a decisão pedir modelo |

**Decisão nova proposta ao índice:**

| ID | Pergunta | Padrão enquanto aberta | Bloqueia |
|---|---|---|---|
| D22 | O item "Catálogo" do anexo entra? De onde vêm os arquivos (materiais "enviáveis ao lead" da Aria, nova categoria de `Documento` ou outro cadastro)? | Fora: o item não aparece | E4 (Task 19) |

## Global Constraints

Valem todas as do índice (`00-indice.md`, seção "Global Constraints"). Em especial:
- Textos em pt-BR, sentence case. Ícones `@tabler/icons-react`. Cor só por classe de token. Pesos 400, 500 e 600.
- Agentes não rodam `npm install`, `npm ci` nem `npx` de instalação. Use `node_modules/.bin/*`.
- Antes de cada PR, com saída 0:
  - `node_modules/.bin/tsc --noEmit`;
  - `npm test`;
  - `npm run lint` (`--max-warnings 40`);
  - a integração tocada: `node_modules/.bin/vitest run -c vitest.integration.config.ts <arquivos>`.
- Toda ação nova com efeito colateral segue o #166: chave por envio (`useChaveIdempotencia`), `marcaIdempotencia` e `repeticaoIdempotente`, e marca no payload do Evento.
- Datas e horas exibidas: `formatarInstanteExibicao` no fuso pessoal, com fallback na escola. Campo de entrada: `CampoDataHoraLocal` (trava `src/app/fuso-pessoal-telas.test.ts`). O servidor converte (`agendarMensagemNoAtendimentoLocal`).
- Nenhuma regra nova de papel sem decisão registrada. Toda task que muda a matriz (`src/server/inbox/permissoes.ts:41-74`) está bloqueada por decisão.
- Tempo real sem polling (`src/app/(app)/inbox/sem-polling.test.ts`: nada de `setInterval(` nem `router.refresh()` na pasta). Mudança nova publica `AvisoInbox`.
- As funções do ERP que o protótipo não mostra continuam acessíveis:
  - atribuir, convidar e devolver para a fila;
  - cancelar agendamento e "Convites e agendamentos";
  - emoji, GIF, figurinha, voz e enquete.
- Travas de tela que toda task de UI atualiza:
  - botão novo entra em `src/app/botoes-mapa.ts` (`botoes.test.ts`);
  - estado vazio novo entra em `src/app/estados-vazios-mapa.ts` (`estados-vazios.test.ts`);
  - action destrutiva da lista fechada só dentro de `<ConfirmarAcao acao>` (`confirmacoes.test.ts`);
  - overlay com `role="dialog"`, `aria-modal` e `useDialogo` (`dialogos.test.ts`).
- Migration só na faixa `20261023300000`–`20261023390000`. Função SQL redefinida exige `diff -w` no corpo do PR. Índice em tabela grande: `CREATE INDEX CONCURRENTLY`, sozinho.
- Enum novo precisa de rótulo em `src/lib/labels.ts` (`enums-rotulos.test.ts`).
- Registrar cada entrega em `docs/planejamento/quadro-entregas.md`. Commits terminam com o trailer de co-autoria do projeto.
- **Task bloqueada:** só começa depois que a linha da decisão no índice tiver a resposta. Se a resposta for a que a task assume, execute como está. Se não for, aplique a linha "Se a decisão vier diferente" e atualize o índice no mesmo PR.

## Review Focus

1. **Atalho de horário no fuso errado.** "Amanhã 09:00" calculado no fuso do navegador, e não no fuso escrito ao lado do campo (pessoal ou o da escola), agenda numa hora diferente para quem viaja. "Hoje 18:00" depois das 18h e "Segunda 09:00" numa segunda também são casos de borda. O esperado: o valor sai no fuso do campo, "Hoje 18:00" some depois das 18h, e "Segunda" numa segunda vai para a semana seguinte. Testes `atalhos no fuso do campo, não no do processo`, `hoje 18:00 some depois das 18h` e `segunda numa segunda vai para a próxima` (Task 4).
2. **Atalho que cai no horário de silêncio da escola.** "Em 1 hora" às 20h cai fora da janela. `exigirAgendamentoNaJanela` (`src/server/whatsapp/janela-agendamento.ts:16`) recusa. O esperado: o erro aparece dentro do popover, que continua aberto com o texto preservado. Teste `erro do servidor (horário de silêncio) fica no popover e o texto não se perde` (Task 4).
3. **Papel sem `tarefas.ver` que agendou pelo Inbox.** Gerente pedagógico e professor agendam (`podeExecutar("agendar")` é `true` para todos), mas `alterar` exige `tarefas.ver` (`src/server/crm/mensagens-agendadas.ts:280`) e recusa reagendar, enviar agora e cancelar. O esperado: quem agendou opera o próprio cartão pelo atendimento. Teste `gerente pedagógico que agendou reagenda, envia agora e cancela pelo atendimento` (Task 3).
4. **Clique duplo ou reenvio em "Enviar agora", "Reagendar" e "Transferir".** O esperado: um único Evento e nenhum envio a mais. Testes `mesma chave no reagendar e no enviar agora grava um Evento só` (Task 3) e `transferir manda a chave da tentativa e não a troca no erro` (Task 1).
5. **Atendimento encerrado ou transferido com o popover ou o cartão aberto.** Na transferência a agendada vira `CANCELADA` (`atendimento_encerrado`). O esperado: as ações recusam com "Atendimento não encontrado." e o cartão some no próximo aviso do SSE. Testes `atendimento encerrado: recusa reagendar e a agendada sai da lista` (Task 3) e `aviso do SSE do atendimento aberto recarrega os cartões` (Task 5).

---

## Mapa das tasks

| # | Task | Tipo | Situação | Depende de |
|---|---|---|---|---|
| 1 | Transferir com a UI nova e as regras atuais | ui | executável (D5 e D6 padrão) | E1 |
| 2 | Nova conversa com o fluxo atual de abrir atendimento | ui | executável (D9 padrão) | E1 |
| 3 | Agendadas no servidor: aviso em tempo real, consulta, reagendar e enviar agora pelo atendimento | back-end | executável | — |
| 4 | Popover "Agendar mensagem" | ui | executável (D11 padrão) | 3, E1 |
| 5 | Cartões de mensagens agendadas no fio | ui | executável | 3, 4 |
| 6 | Anexos: câmera e resposta rápida | ui | executável | E1 |
| 7 | Anexo de proposta da oportunidade | back-end | executável | 6 |
| 8 | Enquete e localização pelo menu de anexos | motor | executável com motor | 6 |
| 9 | Cartão de contato com os números da escola | motor | executável com motor | 6 |
| 10 | Contexto opcional e resumo da Aria na transferência (D5) | back-end | bloqueada | 1 |
| 11 | Transferir para pessoa por quem atende (D5) | back-end | bloqueada | 1, 10 |
| 12 | Carga por pessoa no Transferir (D6) | back-end | bloqueada | 1 |
| 13 | Iniciar conversa por número novo (D9) | back-end | bloqueada | 2 |
| 14 | Perguntar antes de enviar se o contato responder (D11) | back-end | bloqueada | 3, 5 |
| 15 | Editar o texto da mensagem agendada (D11) | back-end | bloqueada | 3, 4 |
| 16 | Anexo e vínculo no agendamento (D11) | back-end | bloqueada | 4, 7 |
| 17 | Spike: presença e equipes (D6) | back-end | spike | — |
| 18 | Spike: Insights (D12) | aria | spike | — |
| 19 | Spike: catálogo no anexo (D22) | ui | spike | 6 |

---

<a id="task-1"></a>
### Task 1: Transferir com a UI nova e as regras atuais (D5 e D6 padrão)

Junta num só popover as ações que hoje estão separadas em `AcoesAtendimento.tsx:95-102`, com as regras atuais:
- **Equipes e filas:**
  - os outros setores do número, com `transferirAtendimento` e contexto obrigatório de pelo menos 12 caracteres;
  - "Fila de <setor>", com `devolverParaFila`.
- **Pessoas:** só para o gerente do setor, com `atribuirAtendimento`. O contexto é opcional e, preenchido, vira nota interna.
- **Devolver para a Aria:** só com a Aria pausada e escopo de envio (`AriaDoAtendimento.podeDevolver`, `src/server/whatsapp/consultas-inbox.ts:261`).

Fica sem presença nem carga (D6). "Continuar seguindo a conversa" fica fora (D19).

**Files:**
- Create: `src/app/(app)/inbox/fluxos/PopoverFluxo.tsx`
- Create: `src/app/(app)/inbox/fluxos/transferir/opcoes-transferir.ts`
- Create: `src/app/(app)/inbox/fluxos/transferir/PopoverTransferir.tsx`
- Modify: `src/app/(app)/inbox/CabecalhoConversa.tsx` (E1): prop `popoverTransferir`; `acoes.aoTransferir`; tira "Atribuir" e "Devolver para a fila" dos itens do `MenuConversa`
- Modify: `src/app/(app)/inbox/InboxNovo.tsx`: estado `fluxo: null | "transferir" | ...`; monta `opcoesTransferir` com o item selecionado (`ItemListaInbox.setoresDoNumero`, `responsavelId`, `numeroDonoId`) e com `painel.aria.podeDevolver`
- Modify: `src/app/botoes-mapa.ts`, `src/app/estados-vazios-mapa.ts`
- Test: `src/app/(app)/inbox/fluxos/transferir/opcoes-transferir.test.ts`
- Test: `src/app/(app)/inbox/fluxos/transferir/PopoverTransferir.test.ts`

**Interfaces:**
- Consumes:
  - `podeExecutar(u, acao, ctx)` (`src/server/inbox/permissoes.ts:41`);
  - `transferirAtendimento({ atendimentoId, destino, destinoChave, contexto, chaveIdempotencia })` (`src/server/whatsapp/acoes-atendimento.ts:216`);
  - `atribuirAtendimento({ atendimentoId, usuarioId })` (`:144`);
  - `devolverParaFila(atendimentoId)` (`:119`);
  - `devolverParaAria(atendimentoId)` (`src/server/aria/acoes.ts:70`, que chama `src/server/aria/pausa.ts:80`);
  - `listarPessoasParaAtendimento(atendimentoId, "atribuir")` (`src/server/whatsapp/consultas-acoes-atendimento.ts:18`);
  - `registrarNotaAtendimento({ atendimentoId, nota, chaveIdempotencia })` (`src/server/whatsapp/acoes-conversa.ts:24`);
  - `DestinoTransferencia` (`AcoesAtendimento.tsx:29`);
  - `useAcaoCliente` (`src/lib/acao-cliente.ts:75`), `useChaveIdempotencia` (`src/lib/chave-idempotencia.ts:24`), `useDialogo` (`src/lib/dialogo.ts:96`).
- Produces:

```ts
// opcoes-transferir.ts
export interface RegrasTransferir {
  pessoasPor: "gerenteDoSetor" | "responsavelOuGerente"; // D5 padrão: "gerenteDoSetor" (atribuir)
  contextoMinimoSetor: number;                           // D5 padrão: 12
  resumoAria: boolean;                                   // D5 padrão: false
  carga: boolean;                                        // D6 padrão: false
}
export const REGRAS_TRANSFERIR_PADRAO: RegrasTransferir;
export interface EntradaTransferir {
  usuario: { id: string; papeis: Papel[] };
  atendimento: { finalidade: Setor; responsavelId: string | null; encerrado: boolean; linhaComercial?: boolean; donoLinhaId?: string | null };
  setoresDoNumero: Setor[];
  ariaPodeDevolver: boolean;
  regras?: RegrasTransferir;
}
export interface OpcoesTransferir {
  visivel: boolean; pessoas: boolean; setores: Setor[]; filaDoSetor: Setor | null; aria: boolean; regras: RegrasTransferir;
}
export function opcoesTransferir(e: EntradaTransferir): OpcoesTransferir;

// PopoverTransferir.tsx
export type AlvoTransferir =
  | { tipo: "pessoa"; usuarioId: string; nome: string }
  | { tipo: "setor"; setor: Setor };
export interface PropsPopoverTransferir {
  atendimentoId: string; opcoes: OpcoesTransferir; responsavelAtualId: string | null;
  destinos: DestinoTransferencia[]; aoFechar(): void; aoConcluir(mensagem: string): void;
}
```

Regras de `opcoesTransferir`, com `ctx = { setor, responsavelId, linhaComercial, donoLinhaId }`:
- encerrado: tudo `false` ou vazio;
- `setores`: os do número menos o atual, se `podeExecutar(u, "transferir", ctx)`;
- `filaDoSetor`: o setor atual, se `responsavelId !== null` e `podeExecutar(u, "devolver", ctx)`;
- `pessoas`: `podeExecutar(u, "atribuir", ctx)` com `"gerenteDoSetor"`, ou `podeExecutar(u, "transferir", ctx)` com `"responsavelOuGerente"`;
- `aria`: `ariaPodeDevolver`;
- `visivel`: qualquer uma das quatro.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// opcoes-transferir.test.ts
const base = { usuario: { id: "eu", papeis: [Papel.VENDEDOR] }, atendimento: { finalidade: "COMERCIAL" as Setor, responsavelId: "eu", encerrado: false }, setoresDoNumero: ["COMERCIAL", "SECRETARIA"] as Setor[], ariaPodeDevolver: false };
it("vendedor responsável: Secretaria e a fila do comercial; sem pessoas nem Aria", () => {
  expect(opcoesTransferir(base)).toMatchObject({ visivel: true, pessoas: false, setores: ["SECRETARIA"], filaDoSetor: "COMERCIAL", aria: false, regras: { contextoMinimoSetor: 12, resumoAria: false, carga: false } });
});
it("gerente comercial vê Pessoas (atribuir)", () => {
  expect(opcoesTransferir({ ...base, usuario: { id: "g", papeis: [Papel.GERENTE_COMERCIAL] } }).pessoas).toBe(true);
});
it("conversa na fila: sem fila do setor", () => {
  expect(opcoesTransferir({ ...base, usuario: { id: "g", papeis: [Papel.GERENTE_COMERCIAL] }, atendimento: { ...base.atendimento, responsavelId: null } }).filaDoSetor).toBeNull();
});
it("sem alçada e sem Aria: invisível", () => {
  expect(opcoesTransferir({ ...base, usuario: { id: "outro", papeis: [Papel.VENDEDOR] } }).visivel).toBe(false);
});
it("Aria pausada com escopo de envio: só Devolver para a Aria já deixa visível", () => {
  expect(opcoesTransferir({ ...base, usuario: { id: "outro", papeis: [Papel.VENDEDOR] }, ariaPodeDevolver: true })).toMatchObject({ visivel: true, aria: true, setores: [] });
});
it("encerrado: nada", () => {
  expect(opcoesTransferir({ ...base, ariaPodeDevolver: true, atendimento: { ...base.atendimento, encerrado: true } })).toMatchObject({ visivel: false, aria: false, setores: [], filaDoSetor: null, pessoas: false });
});
```

```ts
// PopoverTransferir.test.ts (tela-sem-dom, como Compositor.test.ts; mocks das actions e de consultas-acoes-atendimento)
it("passo 1 do vendedor: 'Equipes e filas' com Secretaria e 'Fila de Comercial'; sem 'Pessoas' e sem 'Devolver para Aria'", ...);
it("gerente: 'Pessoas' vem de listarPessoasParaAtendimento(id, 'atribuir') sem o responsável atual", async () => {
  // mock devolve [{ id: "eu", nome: "Eu" }, { id: "v2", nome: "Vera" }], responsavelAtualId "eu"
  expect(listarPessoasParaAtendimento).toHaveBeenCalledWith("a1", "atribuir");
  expect(textoDaTela).toContain("Vera"); expect(textoDaTela).not.toContain(">Eu<");
});
it("setor: passo 2 mostra o destino com 'Trocar', exige 12 caracteres e transfere com a chave", async () => {
  clicarBotao(tela(), "Secretaria"); preencher(tela(), "contexto", "curto");
  expect(botao(tela(), "Transferir").props.disabled).toBe(true);
  preencher(tela(), "contexto", "Pediu histórico escolar");
  clicarBotao(tela(), "Transferir"); await esvaziar();
  expect(transferirAtendimento).toHaveBeenCalledWith({ atendimentoId: "a1", destino: "SECRETARIA", destinoChave: null, contexto: "Pediu histórico escolar", chaveIdempotencia: expect.any(String) });
  expect(aoConcluir).toHaveBeenCalledWith("Transferida para Secretaria.");
});
it("FINANCEIRO no passo 2 pede o contexto do destino com as opções de `destinos`", ...);
it("transferir manda a chave da tentativa e não a troca no erro", async () => {
  // 1ª chamada { ok: false, erro: "Atendimento encerrado." }, 2ª { ok: true }: as duas com a mesma chave; o erro aparece no popover, que não fecha
});
it("pessoa: atribuirAtendimento e, com contexto, registrarNotaAtendimento depois do sucesso", async () => {
  expect(atribuirAtendimento).toHaveBeenCalledWith({ atendimentoId: "a1", usuarioId: "v2" });
  expect(registrarNotaAtendimento).toHaveBeenCalledWith({ atendimentoId: "a1", nota: "Quer fechar hoje", chaveIdempotencia: expect.any(String) });
  expect(aoConcluir).toHaveBeenCalledWith("Transferida para Vera.");
});
it("pessoa sem contexto: não grava nota", ...);
it("'Trocar' volta ao passo 1 e mantém o contexto digitado", ...);
it("Devolver para Aria executa na hora", async () => {
  expect(devolverParaAria).toHaveBeenCalledWith("a1"); expect(aoConcluir).toHaveBeenCalledWith("Conversa devolvida para a Aria.");
});
it("Fila de Comercial chama devolverParaFila", ...);
it("PopoverFluxo: role=dialog, aria-modal e useDialogo; no celular a classe de folha (inset-x-0 bottom-0)", ...);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/fluxos/transferir"`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar `opcoesTransferir` e `REGRAS_TRANSFERIR_PADRAO`** conforme as regras acima.

- [ ] **Step 4: Implementar `PopoverFluxo`**
  - A partir de `md`, painel `absolute` com `rounded-[14px] border border-gray-200 bg-surface-raised shadow-popover`. A posição segue o protótipo:
    - cabeçalho: `top-[62px] right-[18px] w-[340px]`;
    - coluna: `top-[56px] inset-x-3`;
    - compositor: `bottom-[calc(100%+8px)] left-4 w-[min(430px,calc(100%-32px))]`.
  - Abaixo de `md`, folha `fixed inset-x-0 bottom-0 max-h-[85vh] rounded-t-[14px]` com fundo `fixed inset-0`.
  - Cabeçalho: título 14,5 px, peso 600, e botão fechar `IconX`. Fecha com Esc e com clique fora.

- [ ] **Step 5: Implementar `PopoverTransferir`**
  - Passo 1, nesta ordem:
    1. "Pessoas": avatar com `Avatar` da E1, sem ponto de presença (D6);
    2. "Equipes e filas": ícone `IconUsers`, rótulo `SETOR_ATENDIMENTO_LABEL`, subtítulo "Transfere e encerra este atendimento"; e "Fila de <setor>", com subtítulo "Volta para quem atende o setor";
    3. divisória e "Devolver para Aria", com subtítulo "A IA retoma com o contexto atual" (P:207-213).
  - Passo 2, como em P:216-234:
    - cartão do destino com "Trocar";
    - "Contexto do destino" (select) para FINANCEIRO e PEDAGOGICO, com a mesma regra de `DialogoTransferir` (`AcoesAtendimento.tsx:150-160`);
    - "Contexto para quem recebe": `CampoTexto`, até 1000 caracteres. No setor, `minLength` vem de `regras.contextoMinimoSetor`, com dica "Mínimo de 12 caracteres." quando for maior que 0. Na pessoa, opcional;
    - Voltar e Transferir.
  - Uma chave (`useChaveIdempotencia`) por ação com efeito: transferir e nota.

- [ ] **Step 6: Ligar no `CabecalhoConversa` e no `InboxNovo`**
  - O botão Transferir aparece com `opcoes.visivel`.
  - `aoConcluir` fecha, mostra o aviso da E1 e recarrega a lista, como `aoMudar` em `AcoesAtendimento.tsx:80`.
  - Remova "Atribuir" e "Devolver para a fila" do array de itens do `MenuConversa`. "Convidar" fica no ⋮.

- [ ] **Step 7: Rodar e ver passar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox" src/app/botoes.test.ts src/app/estados-vazios.test.ts src/app/dialogos.test.ts`
Expected: PASS.

- [ ] **Step 8: Aceite visual**
  - Estados no roteiro de `scripts/visual/capturar-inbox.mjs` (formato da E1):
    - `transferir-passo1-vendedor`;
    - `transferir-passo1-gerente`;
    - `transferir-passo2-setor`;
    - `transferir-passo2-pessoa`;
    - `celular-sheet-transferir`.
  - Referências:
    - `telas/prototipo-claro-admin-desktop-transferir.png`;
    - `prototipo-estado-transferir-passo1.png` e `prototipo-estado-transferir-passo2.png`, renderizados do HTML.
  - Diferenças justificadas no PR (D5 e D6 padrão):
    - sem ponto de presença nem "N conversas";
    - "Pessoas" só para o gerente;
    - contexto do setor obrigatório;
    - sem "Anexar resumo" nem "Continuar seguindo".

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)/inbox/fluxos" "src/app/(app)/inbox/CabecalhoConversa.tsx" "src/app/(app)/inbox/InboxNovo.tsx" src/app/botoes-mapa.ts src/app/estados-vazios-mapa.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): Transferir em popover com as regras atuais (E4.1)"   # + trailer de co-autoria do projeto
```

---

<a id="task-2"></a>
### Task 2: Nova conversa com o fluxo atual de abrir atendimento (D9 padrão)

O popover da coluna (P:45-79) troca o formulário fixo `NovoAtendimento.tsx`.

A busca procura:
- nas conversas já carregadas na lista: abre `?c=` sem chamar o servidor;
- nos destinos de `listarOpcoesAtendimento`: abre com `abrirAtendimentoInstitucional`.

O telefone continua só no servidor. Um número digitado sem contato não cria nada. Aparece o aviso "Este número não está nos seus contatos. Cadastre o contato antes de iniciar a conversa." (D9 padrão).

**Files:**
- Create: `src/app/(app)/inbox/fluxos/nova-conversa/busca-nova-conversa.ts`
- Create: `src/app/(app)/inbox/fluxos/nova-conversa/PopoverNovaConversa.tsx`
- Modify: `src/app/(app)/inbox/ColunaConversas.tsx` (E1): prop `popoverNovaConversa`
- Modify: `src/app/(app)/inbox/InboxNovo.tsx`: `PropsInboxNovo.opcoesAtendimento`
- Modify: `src/app/(app)/inbox/page.tsx:69`: deixa de renderizar `NovoAtendimento` e passa `opcoesAtendimento={opcoes}` ao `InboxNovo`
- Delete: `src/app/(app)/inbox/NovoAtendimento.tsx` e `NovoAtendimento.test.ts`, depois de portar os casos
- Modify: `src/app/(app)/inbox/page.test.ts:12` (mock de `NovoAtendimento` sai), `src/app/botoes-mapa.ts:1133`, `src/app/estados-vazios-mapa.ts:653`
- Test: `src/app/(app)/inbox/fluxos/nova-conversa/busca-nova-conversa.test.ts`
- Test: `src/app/(app)/inbox/fluxos/nova-conversa/PopoverNovaConversa.test.ts`

**Interfaces:**
- Consumes:
  - `OpcoesAtendimento` e `OpcaoAtendimento` (`src/server/whatsapp/operacoes-atendimento.ts:23-34`);
  - `abrirAtendimentoInstitucional({ destinoChave, numeroId, chaveIdempotencia })` (`:122`);
  - `ItemListaInbox` (`src/server/inbox/consultas-pagina.ts:18`);
  - `PopoverFluxo` (Task 1).
- Produces:

```ts
export type ResultadoNovaConversa =
  | { tipo: "conversa"; atendimentoId: string; nome: string; detalhe: string }
  | { tipo: "destino"; chave: string; nome: string; finalidade: Setor; disponivel: boolean; impedimento: string | null };
export function buscarNovaConversa(q: string, itens: ItemListaInbox[], destinos: OpcaoAtendimento[]):
  { titulo: "Contatos e conversas recentes" | "Resultados"; resultados: ResultadoNovaConversa[]; numeroSemContato: boolean };
export function canaisDoDestino(destino: OpcaoAtendimento, numeros: OpcoesAtendimento["numeros"]): OpcoesAtendimento["numeros"];
export interface PropsPopoverNovaConversa { opcoes: OpcoesAtendimento; itens: ItemListaInbox[]; aoAbrirConversa(atendimentoId: string): void; aoFechar(): void }
```

Regras de `buscarNovaConversa`:
- **Busca vazia:** até 8 conversas, em ordem de `ultimaMensagemEm`, e até 12 destinos.
- **Busca por nome:** sem acento e sem diferença de caixa (`normalize("NFD")`), em `contatoNome` e `nome`.
- **3 dígitos ou mais:** procura também em `item.contatoTelefone`, quando ele vem preenchido (a regra 5 o esconde no pedagógico).
- **`numeroSemContato`:** 10 dígitos ou mais e nenhum resultado.

`canaisDoDestino` aplica a regra de `NovoAtendimento.tsx:23`: no COMERCIAL, só `n.comercial`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// busca-nova-conversa.test.ts
it("sem busca: conversas recentes e destinos, com o título do protótipo", () => {
  expect(buscarNovaConversa("", itens, destinos).titulo).toBe("Contatos e conversas recentes");
});
it("busca por nome ignora acento e caixa", () => {
  expect(buscarNovaConversa("julia", [item({ contatoNome: "Júlia" })], []).resultados).toEqual([expect.objectContaining({ tipo: "conversa", nome: "Júlia" })]);
});
it("3 dígitos procuram no telefone das conversas; destino não expõe telefone", ...);
it("10 dígitos sem resultado: numeroSemContato", () => {
  expect(buscarNovaConversa("11 98111-3344", [], []).numeroSemContato).toBe(true);
});
it("destino indisponível vem com o impedimento", ...);
it("canais: comercial só pelas linhas comerciais", () => {
  expect(canaisDoDestino(dest("COMERCIAL"), [{ id: "n1", nome: "A", comercial: false }, { id: "n2", nome: "B", comercial: true }])).toEqual([{ id: "n2", nome: "B", comercial: true }]);
});
```

```ts
// PopoverNovaConversa.test.ts (portados de NovoAtendimento.test.ts + novos)
it("vendedor sem lead na carteira: orienta a cadastrar o lead, sem culpar o canal", ...);         // texto de NovoAtendimento.tsx:55
it("papel não comercial sem destinatário: mensagem de escopo", ...);                                // :56
it("há destinatário e nenhum canal: a administração precisa disponibilizar o canal", ...);         // :58
it("clicar numa conversa da lista chama aoAbrirConversa sem ir ao servidor", ...);
it("destino com um canal possível abre direto, com a chave", async () => {
  expect(abrirAtendimentoInstitucional).toHaveBeenCalledWith({ destinoChave: "COMERCIAL:l1", numeroId: "n2", chaveIdempotencia: expect.any(String) });
  expect(aoAbrirConversa).toHaveBeenCalledWith("at-novo");
});
it("destino com dois canais pede 'Canal da escola' antes de abrir", ...);
it("comercial sem linha comercial: 'Atendimento comercial sai pela sua linha comercial…'", ...);   // :59
it("número novo: aviso de cadastro, sem 'Conversar com +55…' (D9 padrão)", ...);
it("erro do servidor fica no popover", ...);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/fluxos/nova-conversa"`
Expected: FAIL.

- [ ] **Step 3: Implementar `buscarNovaConversa` e `canaisDoDestino`.**

- [ ] **Step 4: Implementar `PopoverNovaConversa`**
  - Layout de P:48-79:
    - campo "Nome ou número com DDD" com `IconSearch` e borda de acento;
    - título da lista em caixa normal (sentence case; o `uppercase` do protótipo vira letra normal);
    - itens com avatar, nome e detalhe, e a marca "Conversa" ou "Contato" à direita.
  - Destino com `disponivel === false`: desabilitado, com o `impedimento` embaixo.
  - Abrir: `useAcaoCliente({ idempotente: true })` mais `useChaveIdempotencia`, como `NovoAtendimento.tsx:19-30`.

- [ ] **Step 5: Ligar**
  - `InboxNovo` guarda `fluxo === "nova-conversa"`.
  - `aoAbrirConversa(id)` usa o mesmo caminho do clique na lista, que grava `?c=` (`InboxNovo.tsx:169-177`).
  - Atualize `page.tsx`, `page.test.ts` e os dois mapas de trava. Apague `NovoAtendimento.*`.

- [ ] **Step 6: Rodar e ver passar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox" src/app/botoes.test.ts src/app/estados-vazios.test.ts`
Expected: PASS.

- [ ] **Step 7: Aceite visual**
  - Estados: `nova-conversa`, `nova-conversa-busca`, `nova-conversa-numero` e celular.
  - Referências: `telas/prototipo-estado-nova-conversa.png` e `prototipo-estado-nova-conversa-numero.png`.
  - Diferenças justificadas no PR: sem "Conversar com +55…" e sem "Novo contato" (D9 padrão).

- [ ] **Step 8: Commit**

```bash
git add -A "src/app/(app)/inbox" src/app/botoes-mapa.ts src/app/estados-vazios-mapa.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): nova conversa em popover com o fluxo de abrir atendimento (E4.2)"   # + trailer
```

---

<a id="task-3"></a>
### Task 3: Agendadas no servidor: aviso em tempo real, consulta, reagendar e enviar agora pelo atendimento

O servidor já tem `reagendarMensagem` e `enviarAgora` (`src/server/crm/mensagens-agendadas.ts:320,331`), mas nenhum wrapper pelo atendimento. Faltam ainda três coisas:
- a consulta para os cartões do fio;
- o aviso de tempo real quando uma agendada muda. Hoje só `MensagemWhatsApp` e `AtendimentoWhatsApp` avisam (`prisma/migrations/20261017100000_inbox_tempo_real/migration.sql:35-38`);
- a correção do item 3 do Review Focus: quem agendou pelo Inbox, sem `tarefas.ver`, não opera o próprio agendamento.

**Files:**
- Create: `prisma/migrations/20261023300000_inbox_aviso_agendada/migration.sql`
- Modify: `src/server/crm/mensagens-agendadas.ts:69-76` (exporta `escopoAutoresAgendada`), `:272-314` (`alterar` com `opcoes`), `:320-345` (assinaturas)
- Modify: `src/server/whatsapp/acoes-conversa.ts`: wrappers novos; `cancelarAgendamentoDoAtendimento` (`:102-117`) passa `{ viaAtendimento: true }`
- Modify: `src/server/whatsapp/consultas-acoes-atendimento.ts`: `agendadasDoAtendimento`
- Modify: `docs/12-catalogo-de-eventos.md`: `MensagemReagendada` com marca
- Test: `src/server/whatsapp/agendamento.int.test.ts` (novo `describe`)
- Test: `src/server/inbox/barramento.int.test.ts` (aviso da agendada)

**Interfaces:**
- Consumes:
  - `atendimentoVisivel(u, id, enviar?, db?)` (`src/server/whatsapp/atendimentos.ts:79`);
  - `exigirInstanteDoCampoLocal` (`src/server/_shared/campo-local`), como em `acoes-conversa.ts:96`;
  - `marcaIdempotencia` e `repeticaoIdempotente` (`src/server/_shared/idempotencia.ts`);
  - `capacidadesCrm` (`src/server/crm/permissoes.ts:49`).
- Produces:

```ts
// mensagens-agendadas.ts
export type OpcoesAlterarAgendada = { viaAtendimento?: boolean; chaveIdempotencia?: string };
export function escopoAutoresAgendada(usuario: UsuarioSessao, equipe: boolean): Prisma.IntencaoMensagemWhereInput; // o escopoAutores de hoje
export async function reagendarMensagem(id: string, agendadaPara: string, opcoes?: OpcoesAlterarAgendada): Promise<Resultado>;
export async function enviarAgora(id: string, opcoes?: OpcoesAlterarAgendada): Promise<Resultado>;
export async function cancelarMensagemAgendada(id: string, opcoes?: OpcoesAlterarAgendada): Promise<Resultado>;

// acoes-conversa.ts ("use server")
export async function reagendarAgendamentoDoAtendimento(input: { atendimentoId: string; intencaoId: string; quandoLocal: string; fuso: string; chaveIdempotencia?: string }): Promise<Resultado>;
export async function enviarAgendamentoAgoraDoAtendimento(input: { atendimentoId: string; intencaoId: string; chaveIdempotencia?: string }): Promise<Resultado>;

// consultas-acoes-atendimento.ts ("use server")
export interface AgendadaNoFio {
  id: string; texto: string; agendadaPara: string; status: "PENDENTE" | "ADIADA";
  tipo: TipoMensagem; temAnexo: boolean;
  autor: "voce" | "aria" | "equipe"; autorNome: string | null;
  podeAlterar: boolean;
}
export async function agendadasDoAtendimento(atendimentoId: string): Promise<AgendadaNoFio[]>;
```

Regras:
- **`alterar(id, tipo, montar, estadoAlvo?, opcoes = {})`:**
  - Pula `exigirCapacidadeCrm(autor, "tarefas.ver")` só com `opcoes.viaAtendimento`. O wrapper já conferiu `atendimentoVisivel` e que a intenção é do atendimento.
  - `escopoAutores(autor, true)` continua valendo: o autor, a equipe do gerente comercial ou o admin.
  - Com `opcoes.chaveIdempotencia`:
    - a marca é `marcaIdempotencia(chave, { id, tipo, entrada })`, onde `entrada` é `{ agendadaPara }` no reagendar e `{}` no enviar agora;
    - depois de achar `m` e antes de conferir o status, `repeticaoIdempotente(tx, { tipo, agregadoTipo: aggregadoDe(m).agregadoTipo, autorId, marca, mensagemConflito: "Esta tentativa já foi usada com outro horário. Confira os agendamentos antes de repetir." })`; se houver repetição, devolve ok sem gravar;
    - a marca entra no payload do Evento.
- **`opcoes` nunca vem do cliente.** `src/server/crm/tarefas-acoes.ts:41` continua chamando `reagendarMensagemDominio(id, agendadaPara)`.
- **Wrappers:**
  - mesma checagem de `cancelarAgendamentoDoAtendimento` (`acoes-conversa.ts:103-113`): atendimento visível (leitura) e intenção com o mesmo `atendimentoId`, senão "Mensagem agendada não encontrada.";
  - atendimento encerrado: "Atendimento não encontrado.";
  - `reagendar…` converte `quandoLocal` + `fuso` com `exigirInstanteDoCampoLocal`.
- **`agendadasDoAtendimento`:**
  - atendimento visível (leitura) e aberto, senão `[]`;
  - `IntencaoMensagem` com o `atendimentoId`, `agendadaPara` não nulo, `passo` e `passoComercial` nulos, status `PENDENTE` ou `ADIADA`, origem `HUMANO` ou `IA`, em ordem de `agendadaPara`, `take: 50`;
  - `autor`: `"aria"` para IA, `"voce"` quando `autorId === u.id`, `"equipe"` nos demais;
  - `podeAlterar`: origem HUMANO e a intenção casa com `escopoAutoresAgendada(u, capacidadesCrm(u.papeis).has("tarefas.equipe"))`;
  - `temAnexo`: `midiaPath !== null || conteudo !== null`.

SQL da migration (função nova, nenhuma redefinida):

```sql
-- E4.3: agendada criada, reagendada, enviada ou cancelada avisa o Inbox (só ids). O NOTIFY sai no commit.
CREATE FUNCTION notificar_inbox_agendada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_conversa text;
BEGIN
  IF NEW."atendimentoId" IS NULL OR NEW."agendadaPara" IS NULL THEN RETURN NULL; END IF;
  SELECT "conversaId" INTO v_conversa FROM "AtendimentoWhatsApp" WHERE "id" = NEW."atendimentoId";
  PERFORM pg_notify('inbox_eventos', json_build_object('tipo', 'atendimento.atualizado', 'atendimentoId', NEW."atendimentoId", 'mensagemId', NULL, 'conversaId', v_conversa)::text);
  RETURN NULL;
END $$;

CREATE TRIGGER notificar_inbox_agendada AFTER INSERT OR UPDATE ON "IntencaoMensagem"
  FOR EACH ROW EXECUTE FUNCTION notificar_inbox_agendada();
```

- [ ] **Step 1: Escrever os testes que falham**

```ts
// agendamento.int.test.ts — usa cenario(), comoUsuario() e util() do arquivo
describe("agendadas pelo atendimento (E4.3)", () => {
  it("lista as pendentes do atendimento com autor e podeAlterar", async () => {
    // vend agenda 2; uma é cancelada; uma IA agendada é criada direto (origem IA, agendadaPara futura)
    expect(await agendadasDoAtendimento(a.id)).toEqual([
      expect.objectContaining({ texto: "Lembrete", autor: "voce", podeAlterar: true, status: "PENDENTE" }),
      expect.objectContaining({ autor: "aria", podeAlterar: false }),
    ]);
  });
  it("quem não vê o atendimento recebe lista vazia", async () => { comoUsuario(fora); expect(await agendadasDoAtendimento(a.id)).toEqual([]); });
  it("reagendar pelo atendimento muda o horário e grava MensagemReagendada com a marca", async () => {
    const r = await reagendarAgendamentoDoAtendimento({ atendimentoId: a.id, intencaoId: id, quandoLocal: valorCampoLocal(util(14), "America/Sao_Paulo"), fuso: "America/Sao_Paulo", chaveIdempotencia: "chave-reag-0001" });
    expect(r.ok).toBe(true);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id } })).agendadaPara?.getTime()).toBe(Math.floor(util(14).getTime() / 60_000) * 60_000);
    expect(await prisma.evento.findFirst({ where: { tipo: "MensagemReagendada", agregadoId: a.id } })).toMatchObject({ payload: expect.objectContaining({ chaveIdempotencia: "chave-reag-0001" }) });
  });
  it("mesma chave no reagendar e no enviar agora grava um Evento só", async () => {
    await reagendarAgendamentoDoAtendimento(entrada); await reagendarAgendamentoDoAtendimento(entrada);
    expect(await prisma.evento.count({ where: { tipo: "MensagemReagendada" } })).toBe(1);
    const e2 = { atendimentoId: a.id, intencaoId: id, chaveIdempotencia: "chave-agora-0001" };
    await enviarAgendamentoAgoraDoAtendimento(e2); await enviarAgendamentoAgoraDoAtendimento(e2);
    expect(await prisma.evento.count({ where: { tipo: "MensagemReagendada" } })).toBe(2);
  });
  it("mesma chave com outro horário é recusada", ...);
  it("enviar agora: sai no próximo ciclo do despachante", async () => {
    await enviarAgendamentoAgoraDoAtendimento({ atendimentoId: a.id, intencaoId: id });
    await despacharFila(new Date());
    expect(["DESPACHADA", "SIMULADA"]).toContain(await status(r));
  });
  it("intenção de outro atendimento: 'Mensagem agendada não encontrada.'", ...);
  it("atendimento encerrado: recusa reagendar e a agendada sai da lista", async () => {
    await transferirAtendimento({ atendimentoId: a.id, destino: "SECRETARIA", destinoChave: null, contexto: "x".repeat(12) });
    expect(await reagendarAgendamentoDoAtendimento(entrada)).toEqual({ ok: false, erro: "Atendimento não encontrado." });
    expect(await agendadasDoAtendimento(a.id)).toEqual([]);
  });
  it("gerente pedagógico que agendou reagenda, envia agora e cancela pelo atendimento", async () => {
    // número com setor PEDAGOGICO; atendimento PEDAGOGICO com responsável = gp (GERENTE_PEDAGOGICO, sem tarefas.ver).
    // Se a fábrica exigir matrícula, use alunoComMatricula() de transferencia.int.test.ts:28.
    expect((await reagendarAgendamentoDoAtendimento(eGp)).ok).toBe(true);
    expect((await cancelarAgendamentoDoAtendimento({ atendimentoId: aPed.id, intencaoId: idGp })).ok).toBe(true);
  });
  it("tarefas: o reagendar da agenda (/tarefas) continua exigindo tarefas.ver", async () => {
    comoUsuario(gp); expect((await reagendarMensagem(idGp, util(15).toISOString())).ok).toBe(false);
  });
});
```

```ts
// barramento.int.test.ts
it("agendada no atendimento avisa atendimento.atualizado; intenção sem agendadaPara não usa esse trigger", async () => {
  const { r, sair } = escutar();
  await prisma.intencaoMensagem.create({ data: { numeroId, atendimentoId: a.id, contatoId, origem: "HUMANO", corpoRenderizado: "x", agendadaPara: new Date(Date.now() + 3_600_000) } });
  await vi.waitFor(() => expect(r).toContainEqual({ tipo: "atendimento.atualizado", atendimentoId: a.id, mensagemId: null, conversaId: a.conversaId }), { timeout: 2000 });
  r.length = 0;
  await prisma.intencaoMensagem.create({ data: { numeroId, atendimentoId: a.id, contatoId, origem: "HUMANO", corpoRenderizado: "y" } });
  await pausa(500); expect(r).toEqual([]); sair();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/agendamento.int.test.ts src/server/inbox/barramento.int.test.ts`
Expected: FAIL (wrappers e consulta inexistentes; nenhum aviso da intenção).

- [ ] **Step 3: Criar a migration** com o SQL acima e rodar `node_modules/.bin/prisma migrate dev --skip-generate` no banco descartável. O schema Prisma não muda.

- [ ] **Step 4: Implementar** `OpcoesAlterarAgendada` e as mudanças em `alterar`, os dois wrappers, `{ viaAtendimento: true }` em `cancelarAgendamentoDoAtendimento` e `agendadasDoAtendimento`, conforme as regras acima.

- [ ] **Step 5: Rodar e ver passar**

Run: o comando do Step 2, mais `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/despachante-agendada.int.test.ts src/server/crm` e `node_modules/.bin/vitest run src/server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/migrations/20261023300000_inbox_aviso_agendada src/server/crm/mensagens-agendadas.ts src/server/whatsapp/acoes-conversa.ts src/server/whatsapp/consultas-acoes-atendimento.ts src/server/whatsapp/agendamento.int.test.ts src/server/inbox/barramento.int.test.ts docs/12-catalogo-de-eventos.md docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): agendadas por atendimento com aviso em tempo real, reagendar e enviar agora (E4.3, migration 20261023300000)"   # + trailer
```

---

<a id="task-4"></a>
### Task 4: Popover "Agendar mensagem" (D11 padrão)

Troca o `DialogoAgendar` (`AcoesAtendimento.tsx:291-321`) pelo popover de P:362-403. Entra:
- texto pré-preenchido com o rascunho do compositor;
- respostas rápidas;
- atalhos de horário;
- data e hora com o fuso escrito;
- erro de horário passado;
- aviso de conflito;
- "Salvar rascunho";
- modo editar, que no padrão só reagenda.

O popover abre por três caminhos:
- pelo relógio do compositor;
- pelo item "Agendar mensagem" do ⋮;
- por `?agendar=1` (P:881).

Não aparecem (D11 padrão):
- "Perguntar antes de enviar se o contato responder" (Task 14);
- anexo e "Vincular a" (Task 16);
- edição do texto (Task 15).

"Repetir" fica fora (pendência 12, D19). "Escrever com Aria" depende da Task 18. O padrão também não exige ter assumido (D11), então o aviso "Assuma a conversa" (P:940) não existe.

**Files:**
- Create: `src/lib/atalhos-horario.ts`
- Create: `src/app/(app)/inbox/fluxos/agendar/validar-quando.ts` (move `validarQuando` de `AcoesAtendimento.tsx:56-62`; `AcoesAtendimento.tsx` passa a reexportar enquanto existir)
- Create: `src/app/(app)/inbox/fluxos/agendar/conflito.ts`
- Create: `src/app/(app)/inbox/fluxos/agendar/PopoverAgendar.tsx`
- Modify: `src/components/conversa/Compositor.tsx:38-44`: exporta `lerRascunho` e `gravarRascunho`
- Modify: `src/app/(app)/inbox/RodapeConversa.tsx` (E1): `aoAgendar`, `popoverAgendar`
- Modify: `src/app/(app)/inbox/CabecalhoConversa.tsx` (E1): o item "Agendar mensagem" do ⋮ abre o popover
- Modify: `src/app/(app)/inbox/page.tsx`: lê `agendar`
- Modify: `src/app/(app)/inbox/InboxNovo.tsx`: `agendarAoAbrir`; `fluxo === "agendar" | { tipo: "editar-agendada"; id }`
- Modify: `src/app/botoes-mapa.ts`
- Test: `src/lib/atalhos-horario.test.ts`
- Test: `src/app/(app)/inbox/fluxos/agendar/conflito.test.ts`
- Test: `src/app/(app)/inbox/fluxos/agendar/PopoverAgendar.test.ts`
- Test: `src/app/(app)/inbox/page.test.ts`
- Test: `src/app/(app)/inbox/InboxNovo.interacao.test.ts`

**Interfaces:**
- Consumes:
  - `agendarMensagemNoAtendimentoLocal({ atendimentoId, texto, quandoLocal, fuso, chaveIdempotencia })` (`acoes-conversa.ts:95`);
  - `reagendarAgendamentoDoAtendimento` e `AgendadaNoFio` (Task 3);
  - `valorCampoLocal` e `instanteDoCampoLocal` (`src/server/operacao/fuso-entrada.ts:38,60`);
  - `fusoDoCampoLocal` (`:23`);
  - `CampoDataHoraLocal` (`src/components/CampoDataHoraLocal.tsx:25`);
  - `respostasRapidasDoCompositor()` (`src/server/crm-config/acoes-respostas.ts:21`), já carregadas em `ConversaAberta.tsx:98-103`;
  - `aplicarVariaveisResposta` (`src/components/conversa/respostas-rapidas.ts`);
  - `PopoverFluxo` (Task 1).
- Produces:

```ts
// src/lib/atalhos-horario.ts
export type IdAtalhoHorario = "1h" | "hoje18" | "amanha9" | "amanha14" | "seg9";
export interface AtalhoHorario { id: IdAtalhoHorario; rotulo: string; valorLocal: string } // valorLocal no formato do datetime-local, no `fuso`
export function atalhosDeHorario(agora: Date, fuso: string): AtalhoHorario[];

// conflito.ts
export function agendadaProxima(quando: Date, agendadas: readonly { id: string; agendadaPara: string }[], ignorarId?: string): { id: string; agendadaPara: string } | null; // |Δ| < 2 h

// PopoverAgendar.tsx
export interface PropsPopoverAgendar {
  atendimentoId: string; fuso: string; nomeContato: string;
  textoInicial: string; agendadas: readonly AgendadaNoFio[];
  respostas: readonly RespostaDoCompositor[]; variaveisResposta: { nome?: string | null; responsavel?: string | null; curso?: string | null };
  editar?: AgendadaNoFio | null; agora?: Date;
  aoSalvarRascunho(texto: string): void; aoFechar(): void; aoConcluir(mensagem: string): void;
}
```

Rótulos e regras dos atalhos (P:861): "Em 1 hora", "Hoje 18:00", "Amanhã 09:00", "Amanhã 14:00", "Segunda 09:00".
- "Em 1 hora" é `agora` + 60 min, truncado no minuto.
- "Hoje 18:00" só aparece se 18:00 de hoje, no `fuso`, for depois de `agora`.
- "Segunda" é a próxima segunda; numa segunda, a da semana seguinte.
- Atalho cujo valor local não existe no fuso (`instanteDoCampoLocal` com `ok: false`) é omitido.
- O padrão ao abrir é "Amanhã 09:00".

Textos (P:362-403, P:1083-1084):
- título "Agendar mensagem" ou "Editar agendamento";
- seções "Mensagem" e "Quando";
- erro "Esse horário já passou. Escolha uma data e hora no futuro.";
- conflito "Já existe uma mensagem agendada para {nomeContato} {quandoAgendada}, perto desse horário.";
- botões "Salvar rascunho" (só ao criar), "Cancelar" e "Agendar" ou "Salvar".

No modo editar (D11 padrão), o texto fica só de leitura, com a dica "Para mudar o texto, cancele e agende de novo.".

- [ ] **Step 1: Escrever os testes que falham**

```ts
// atalhos-horario.test.ts (instantes em UTC; quinta 2026-10-22)
it("atalhos no fuso do campo, não no do processo", () => {
  expect(atalhosDeHorario(new Date("2026-10-22T13:30:00Z"), "America/Sao_Paulo").map((a) => [a.id, a.valorLocal])).toEqual([
    ["1h", "2026-10-22T11:30"], ["hoje18", "2026-10-22T18:00"], ["amanha9", "2026-10-23T09:00"], ["amanha14", "2026-10-23T14:00"], ["seg9", "2026-10-26T09:00"],
  ]);
  expect(atalhosDeHorario(new Date("2026-10-22T13:30:00Z"), "America/Costa_Rica")[0].valorLocal).toBe("2026-10-22T08:30");
});
it("hoje 18:00 some depois das 18h", () => {
  expect(atalhosDeHorario(new Date("2026-10-22T21:05:00Z"), "America/Sao_Paulo").map((a) => a.id)).not.toContain("hoje18");
});
it("segunda numa segunda vai para a próxima", () => {
  expect(atalhosDeHorario(new Date("2026-10-26T12:00:00Z"), "America/Sao_Paulo").find((a) => a.id === "seg9")!.valorLocal).toBe("2026-11-02T09:00");
});
it("rótulos do protótipo", () => {
  expect(atalhosDeHorario(new Date("2026-10-22T13:30:00Z"), "America/Sao_Paulo").map((a) => a.rotulo)).toEqual(["Em 1 hora", "Hoje 18:00", "Amanhã 09:00", "Amanhã 14:00", "Segunda 09:00"]);
});
```

```ts
// conflito.test.ts
it("menos de 2 h antes ou depois é conflito; 2 h exatas não", () => {
  const q = new Date("2026-10-23T12:00:00Z");
  expect(agendadaProxima(q, [{ id: "x", agendadaPara: "2026-10-23T13:59:00Z" }])?.id).toBe("x");
  expect(agendadaProxima(q, [{ id: "x", agendadaPara: "2026-10-23T14:00:00Z" }])).toBeNull();
});
it("ignora a própria agendada no modo editar", () => { expect(agendadaProxima(q, [{ id: "x", agendadaPara: q.toISOString() }], "x")).toBeNull(); });
```

```ts
// PopoverAgendar.test.ts (tela-sem-dom; agora fixo 2026-10-22T13:30Z; fuso America/Sao_Paulo)
it("abre com o rascunho e 'Amanhã 09:00' escolhido; o campo diz o fuso", () => {
  // CampoDataHoraLocal com value "2026-10-23T09:00" e fuso "America/Sao_Paulo"; texto = textoInicial
});
it("atalho troca o valor do campo", ...);
it("horário passado mostra o erro do protótipo e desabilita Agendar", ...);
it("conflito com outra agendada a menos de 2 h mostra o aviso e não bloqueia", ...);
it("resposta rápida preenche o texto com as variáveis", ...);
it("Agendar chama agendarMensagemNoAtendimentoLocal com texto, quandoLocal, fuso e chave", async () => {
  expect(agendarMensagemNoAtendimentoLocal).toHaveBeenCalledWith({ atendimentoId: "a1", texto: "Oi Ana", quandoLocal: "2026-10-23T09:00", fuso: "America/Sao_Paulo", chaveIdempotencia: expect.any(String) });
  expect(aoConcluir).toHaveBeenCalledWith("Mensagem agendada.");
});
it("erro do servidor (horário de silêncio) fica no popover e o texto não se perde", async () => {
  // mock { ok: false, erro: "Fora do horário de envio da escola…" }: FeedbackAcao mostra o erro, aoConcluir não é chamado, o texto continua
});
it("Salvar rascunho leva o texto ao compositor e fecha", () => { expect(aoSalvarRascunho).toHaveBeenCalledWith("Oi Ana"); });
it("editar: texto só leitura, 'Salvar' chama reagendarAgendamentoDoAtendimento e não mostra 'Salvar rascunho'", ...);
it("não mostra 'Perguntar antes…', 'Mais opções', 'Anexar' nem 'Escrever com Aria' (D11 e D12 padrão)", ...);
```

```ts
// page.test.ts
it("?agendar=1 com ?c= chega ao InboxNovo como agendarAoAbrir", ...);
// InboxNovo.interacao.test.ts
it("agendarAoAbrir abre o popover de agendar uma vez e tira 'agendar' da URL com router.replace", ...);
it("agendarAoAbrir sem escopo de envio (painel podeEnviar false) mostra MOTIVO_SEM_ENVIO em vez do popover", ...);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/lib/atalhos-horario.test.ts "src/app/(app)/inbox/fluxos/agendar" "src/app/(app)/inbox/page.test.ts" "src/app/(app)/inbox/InboxNovo.interacao.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implementar `atalhosDeHorario`.** Monte a data civil local de `agora` no `fuso` com `valorCampoLocal(agora, fuso)`, some os dias pela data civil e confira cada candidato com `instanteDoCampoLocal`.

- [ ] **Step 4: Implementar `agendadaProxima` e mover `validarQuando`.**

- [ ] **Step 5: Implementar `PopoverAgendar`**
  - Layout de P:362-403:
    - ícone `IconClock` no título;
    - a caixa da mensagem com o fundo do balão "eu" (token `--b-me` da E1);
    - chips de resposta rápida com `IconBolt`, no máximo 5, por `titulo`;
    - chips de horário com o escolhido destacado;
    - `CampoDataHoraLocal` com `fuso`;
    - erro em `--danger-soft` e conflito em `--warn-soft`;
    - rodapé com borda superior.
  - "Agendar" fica habilitado só com texto e horário no futuro (`validarQuando`).
  - `useAcaoCliente({ idempotente: true })` mais `useChaveIdempotencia`.

- [ ] **Step 6: Ligar**
  - O relógio do `RodapeConversa` e o item do ⋮ chamam `setFluxo("agendar")`.
  - `textoInicial = lerRascunho(atendimentoId, "responder")`.
  - `aoSalvarRascunho(t)` faz `gravarRascunho(atendimentoId, "responder", t)` e força o compositor a reler: troca a `key` do compositor, sem efeito.
  - `page.tsx`: `const agendar = um(parametros.agendar) === "1" && !!c`, passado como `agendarAoAbrir`.
  - O `InboxNovo` abre uma vez com o painel carregado e `podeEnviar === true`, depois faz `router.replace` sem `agendar`.
  - O `DialogoAgendar` antigo sai do cabeçalho, junto com o restante de `AcoesAtendimento` que a E1 já desmontou.

- [ ] **Step 7: Rodar e ver passar**

Run: o comando do Step 2, mais `node_modules/.bin/vitest run "src/app/(app)/inbox" src/components/conversa src/app/fuso-pessoal-telas.test.ts src/app/botoes.test.ts`
Expected: PASS.

- [ ] **Step 8: Aceite visual**
  - Estados: `agendar`, `agendar-conflito`, `agendar-erro-passado`, `agendar-deeplink` (`?c=<id>&agendar=1`) e celular.
  - Referências: `telas/prototipo-estado-agendar-mais-opcoes.png` (só a parte de cima, sem anexos, até a Task 16), `prototipo-estado-agendar-erro-passado.png` e `prototipo-estado-agendar-deeplink.png`.
  - Diferenças justificadas no PR: fuso pessoal escrito em vez de "Horário de Brasília (GMT-3)" fixo (F19); sem "Perguntar antes…", "Mais opções" e "Anexar" (D11 padrão).

- [ ] **Step 9: Commit**

```bash
git add src/lib/atalhos-horario* "src/app/(app)/inbox" src/components/conversa/Compositor.tsx src/app/botoes-mapa.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): popover de agendar com atalhos, conflito, rascunho e ?agendar=1 (E4.4)"   # + trailer
```

---

<a id="task-5"></a>
### Task 5: Cartões de mensagens agendadas no fio

Cartão tracejado no fim do fio, para cada agendada pendente (P:328-350):
- cabeçalho "Agendada para {Hoje às 18:00}" com "por você", "por Aria" ou "por {nome}";
- o texto;
- "Editar", "Enviar agora" e "Cancelar", só com `podeAlterar`.

Comportamento:
- "Editar" abre o `PopoverAgendar` no modo editar (no padrão, só reagenda).
- "Cancelar" mantém a confirmação do ERP (`ConfirmarAcao`, como `AcoesAtendimento.tsx:345-357`).
- "Enviar agora" é direto, como o "Enviar" do compositor.

Os cartões recarregam a cada aviso do SSE do atendimento aberto.

**Files:**
- Create: `src/app/(app)/inbox/fluxos/agendar/quando-agendada.ts`
- Create: `src/app/(app)/inbox/fluxos/agendar/useAgendadas.ts`
- Create: `src/app/(app)/inbox/fluxos/agendar/CartaoAgendada.tsx`
- Modify: `src/app/(app)/inbox/InboxNovo.tsx`: `useAgendadas(selecionado)`; no handler de `useEventosInbox`, `recarregar()` quando `aviso.atendimentoId === selecionado` ou `aviso.tipo === "resync"`; monta `cartoesNoFio`
- Modify: o componente do fio da E1: slot `cartoesNoFio`
- Modify: `src/app/botoes-mapa.ts`
- Test: `src/app/(app)/inbox/fluxos/agendar/quando-agendada.test.ts`
- Test: `src/app/(app)/inbox/fluxos/agendar/CartaoAgendada.test.ts`
- Test: `src/app/(app)/inbox/InboxNovo.interacao.test.ts`

**Interfaces:**
- Consumes:
  - `agendadasDoAtendimento`, `AgendadaNoFio`, `enviarAgendamentoAgoraDoAtendimento` (Task 3);
  - `cancelarAgendamentoDoAtendimento` (`acoes-conversa.ts:102`);
  - `ConfirmarAcao` (`src/components/ConfirmarAcao.tsx:55`);
  - `PopoverAgendar` (Task 4).
- Produces:

```ts
export function quandoAgendada(iso: string, fuso: string, agora: Date): string; // "Hoje às 18:00" | "Amanhã às 09:00" | "26/10 às 09:00"
export function useAgendadas(atendimentoId: string | null): { agendadas: AgendadaNoFio[]; recarregar(): void };
export interface PropsCartaoAgendada { agendada: AgendadaNoFio; atendimentoId: string; fuso: string; agora: Date; aoEditar(): void; aoMudar(mensagem: string): void }
```

- [ ] **Step 1: Escrever os testes que falham**

```ts
// quando-agendada.test.ts
it("hoje, amanhã e data curta no fuso de exibição", () => {
  const agora = new Date("2026-10-22T13:30:00Z");
  expect(quandoAgendada("2026-10-22T21:00:00Z", "America/Sao_Paulo", agora)).toBe("Hoje às 18:00");
  expect(quandoAgendada("2026-10-23T12:00:00Z", "America/Sao_Paulo", agora)).toBe("Amanhã às 09:00");
  expect(quandoAgendada("2026-10-26T12:00:00Z", "America/Sao_Paulo", agora)).toBe("26/10 às 09:00");
});
it("o mesmo instante vira outro dia em Costa Rica", () => {
  expect(quandoAgendada("2026-10-23T03:00:00Z", "America/Costa_Rica", new Date("2026-10-22T13:30:00Z"))).toBe("Hoje às 21:00");
});
```

```ts
// CartaoAgendada.test.ts
it("da própria pessoa: 'Agendada para Amanhã às 09:00', 'por você' e os três botões", ...);
it("da Aria: 'por Aria' em --ai, sem botões", ...);
it("sem podeAlterar: só leitura", ...);
it("Enviar agora chama enviarAgendamentoAgoraDoAtendimento com a chave e avisa 'Mensagem enviada.'", ...);
it("Cancelar só roda dentro da prop `acao` de um ConfirmarAcao (fonte)", () => {
  const fonte = readFileSync("src/app/(app)/inbox/fluxos/agendar/CartaoAgendada.tsx", "utf8");
  expect(fonte).toMatch(/<ConfirmarAcao[\s\S]*acao=\{\(\) => cancelarAgendamentoDoAtendimento\(/);
});
it("com anexo: mostra o nome do anexo acima do texto", ...);
// InboxNovo.interacao.test.ts
it("aviso do SSE do atendimento aberto recarrega os cartões; de outro atendimento, não", ...);
it("cartões ficam em ordem de agendadaPara no slot cartoesNoFio", ...);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/fluxos/agendar" "src/app/(app)/inbox/InboxNovo.interacao.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implementar `quandoAgendada`.** Use `formatarInstanteExibicao` (`src/server/operacao/fuso-exibicao.ts:42`) e a data civil no `fuso`.

- [ ] **Step 4: Implementar `useAgendadas`** (efeito com `ativo`, como `DialogoPendentes` em `AcoesAtendimento.tsx:333-341`) **e o `CartaoAgendada`.**
  - Borda `1.5px dashed` de acento, cabeçalho em `--accent-soft`, largura `min(440px, 80%)`, alinhado à direita (P:329-331).
  - "Cancelar" em `--danger`.

- [ ] **Step 5: Ligar no `InboxNovo` e no slot do fio.**

- [ ] **Step 6: Rodar e ver passar**

Run: o comando do Step 2, mais `node_modules/.bin/vitest run "src/app/(app)/inbox" src/app/confirmacoes.test.ts src/app/botoes.test.ts`
Expected: PASS.

- [ ] **Step 7: Aceite visual**
  - Estados: `fio-agendada-voce`, `fio-agendada-aria` e `fio-agendada-anexo`.
  - Referências: P:328-350 renderizado e `telas/prototipo-estado-painel-atividade-agendadas.png`, só para o conteúdo do cartão.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/inbox" src/app/botoes-mapa.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): cartões de mensagens agendadas no fio (E4.5)"   # + trailer
```

---

<a id="task-6"></a>
### Task 6: Anexos: câmera e resposta rápida

O menu "Anexar" (`Compositor.tsx:243-261`) passa a seguir a lista do protótipo (P:1161), sem perder a Enquete do ERP:
- Documento;
- Fotos e vídeos;
- Câmera (novo);
- Áudio;
- Localização;
- Contato;
- Enquete;
- Proposta (Task 7);
- Resposta rápida (o "Template" do protótipo).

Comportamento dos itens novos:
- **Câmera:** abre o seletor com `accept="image/*"` e `capture="environment"`. No computador, o navegador cai no seletor de arquivo.
- **Resposta rápida:** põe "/" no campo e foca, o que abre a lista que já existe (`Compositor.tsx:228-238`). Sem respostas, o item não aparece.

O Catálogo não aparece até a Task 19 (D22). Localização, Contato e Enquete continuam desabilitados sem o motor até as Tasks 8 e 9.

**Files:**
- Create: `src/components/conversa/itens-anexo.ts`
- Modify: `src/components/conversa/Compositor.tsx:54-58, 201-204, 246-260`
- Test: `src/components/conversa/Compositor.test.ts` (novo `describe`)

**Interfaces:**
- Consumes: `RecursoMotor` (`src/components/conversa/recursos-canal.ts`), `AVISO_RECURSO_MOTOR`.
- Produces:

```ts
export type IdItemAnexo = "documento" | "midia" | "camera" | "audio" | "localizacao" | "contato" | "enquete" | "proposta" | "resposta";
export interface ItemAnexo { id: IdItemAnexo; rotulo: string; icone: TablerIcon; recurso?: RecursoMotor }
export const ITENS_ANEXO: readonly ItemAnexo[]; // na ordem acima
```

Ícones:

| Item | Ícone |
|---|---|
| Documento | `IconFileText` |
| Fotos e vídeos | `IconPhoto` |
| Câmera | `IconCamera` |
| Áudio | `IconMicrophone` |
| Localização | `IconMapPin` |
| Contato | `IconUser` |
| Enquete | `IconListCheck` |
| Proposta | `IconFileCheck` |
| Resposta rápida | `IconBolt` |

`abrirSeletor(accept: string, captura?: "environment")` grava `accept`, liga ou desliga o atributo `capture` no input e clica.

- [ ] **Step 1: Escrever os testes que falham**

```ts
describe("Compositor: itens de anexo (E4.6)", () => {
  it("ordem do protótipo, com Enquete do ERP e sem Catálogo", () => {
    expect(ITENS_ANEXO.map((i) => i.rotulo)).toEqual(["Documento", "Fotos e vídeos", "Câmera", "Áudio", "Localização", "Contato", "Enquete", "Proposta", "Resposta rápida"]);
  });
  it("Câmera abre o seletor com image/* e capture=environment; Documento tira o capture", () => {
    m.g = criarGanchos(); const p = props(); const tela = () => m.g!.renderizar(Compositor, p);
    const falso = { accept: "", setAttribute: vi.fn(), removeAttribute: vi.fn(), click: vi.fn() };
    (elementos(tela()).find((n) => n.type === "input" && n.props["aria-label"] === "Escolher arquivo")!.props.ref as { current: unknown }).current = falso;
    abrirAnexos(tela()); clicarBotao(tela(), "Câmera");
    expect(falso.accept).toBe("image/*"); expect(falso.setAttribute).toHaveBeenCalledWith("capture", "environment"); expect(falso.click).toHaveBeenCalled();
    abrirAnexos(tela()); clicarBotao(tela(), "Documento");
    expect(falso.removeAttribute).toHaveBeenCalledWith("capture");
  });
  it("Resposta rápida põe '/' no campo e mostra a lista", ...);
  it("sem respostas rápidas, o item não aparece", ...);
  it("Proposta só aparece com a prop `propostas` (Task 7)", ...);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/components/conversa/Compositor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `ITENS_ANEXO` e o menu a partir dele.** Os itens com `recurso` mantêm o desabilitado com `AVISO_RECURSO_MOTOR` dos testes que já existem (`Compositor.test.ts:145-164`).

- [ ] **Step 4: Rodar e ver passar**

Run: `node_modules/.bin/vitest run src/components/conversa src/app/botoes.test.ts`
Expected: PASS.

- [ ] **Step 5: Aceite visual**
  - Estado: `anexos` (menu aberto), com e sem motor.
  - Referência: `telas/prototipo-estado-anexos.png`. A grade 3×3 com ícones coloridos segue o estilo que a E1 der ao menu.

- [ ] **Step 6: Commit**

```bash
git add src/components/conversa docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): câmera e resposta rápida no menu de anexos (E4.6)"   # + trailer
```

---

<a id="task-7"></a>
### Task 7: Anexo de proposta da oportunidade

O item "Proposta" (P:970) envia um dos documentos `PROPOSTA` (`prisma/schema.prisma:1497-1527`) da oportunidade da conversa. O ERP não gera PDF de proposta. O anexo é o documento que a equipe já subiu na oportunidade (Funil). O envio não muda a etapa: a etapa segue o Funil (`enviarProposta`, `src/server/comercial/acoes.ts:549`; D8).

O arquivo é copiado para `whatsapp-out/<autor>`, porque o despachante só lê dessa pasta (`src/server/whatsapp/midia.ts:150-170`).

**Files:**
- Create: `src/server/whatsapp/proposta-atendimento.ts`
- Modify: `src/server/whatsapp/midia.ts`: `copiarDocumentoParaSaida`
- Modify: `src/server/whatsapp/consultas-acoes-atendimento.ts`: `propostasDoAtendimento`
- Modify: `src/server/whatsapp/acoes-conversa.ts`: `enviarPropostaNoAtendimento`
- Modify: `src/components/conversa/Compositor.tsx`: item Proposta abre a lista; `PropsCompositor.propostas` e `aoEnviarProposta`
- Modify: `src/app/(app)/inbox/InboxNovo.tsx` (ou onde a E1 monta o `RodapeConversa`): carrega `propostasDoAtendimento` no efeito do painel, só na finalidade COMERCIAL
- Modify: `docs/12-catalogo-de-eventos.md`, `src/app/estados-vazios-mapa.ts`
- Test: `src/server/whatsapp/proposta-atendimento.int.test.ts`
- Test: `src/components/conversa/Compositor.test.ts`

**Interfaces:**
- Consumes:
  - `podeVerLeadNaThread(u, atendimentoId, leadId, agora)` (`src/server/whatsapp/consultas-inbox.ts:181`);
  - `podeLerArquivo(usuario, segmentos)` (`src/server/uploads/autorizacao.ts:115`);
  - `salvarMidiaSaida` e `tipoPorMime` (`midia.ts:79,44`);
  - `resolverCaminhoUpload` e `contentTypePorExtensao` (`src/lib/uploads.ts:31`);
  - `despacharFila(agora, { intencaoId })` (`src/server/whatsapp/despachante.ts:159`);
  - `EnvioInboxResultado` (`src/server/whatsapp/acoes.ts:245`).
- Produces:

```ts
// proposta-atendimento.ts (sem "use server")
export interface PropostaAnexavel { id: string; nome: string; criadoEm: string }
export async function propostasVisiveis(u: UsuarioSessao, atendimentoId: string): Promise<{ oportunidadeId: string | null; propostas: (PropostaAnexavel & { url: string })[] }>;
export async function exigirPropostaVisivel(u: UsuarioSessao, atendimentoId: string, documentoId: string): Promise<{ url: string; nome: string }>; // ErroRegra "Proposta não encontrada."
// midia.ts
export async function copiarDocumentoParaSaida(autorId: string, url: string): Promise<string | null>; // null: fora de /api/files, tipo não aceito ou arquivo ausente
// consultas-acoes-atendimento.ts ("use server")
export async function propostasDoAtendimento(atendimentoId: string): Promise<{ oportunidadeId: string | null; propostas: PropostaAnexavel[] }>;
// acoes-conversa.ts ("use server")
export async function enviarPropostaNoAtendimento(input: { atendimentoId: string; documentoId: string; legenda?: string; chaveIdempotencia?: string }): Promise<Resultado<EnvioInboxResultado>>;
```

Regras:
- **`propostasVisiveis`:**
  - atendimento visível e COMERCIAL, com `leadId` (ou `contato.leadId`) e `podeVerLeadNaThread`;
  - documentos `categoria = PROPOSTA`, `arquivado = false`, do lead, em ordem de `criadoEm desc`, `take: 10`;
  - fica cada um cujo `podeLerArquivo(u, segmentos da url)` seja verdadeiro;
  - nos demais casos, `{ oportunidadeId: null, propostas: [] }`.
- **`enviarPropostaNoAtendimento`**, com a mesma trava de `enviarMidiaInbox` (`acoes.ts:288-327`):
  - escopo de envio, número ativo e sem opt-out;
  - com chave: `repeticaoIdempotente` sobre `PropostaEnviadaNoAtendimento`, antes das validações (C3 da R2 do #267, como `acoes-conversa.ts:30-38`);
  - `exigirPropostaVisivel`, depois `copiarDocumentoParaSaida`; se der `null`: "Não foi possível anexar esta proposta. Abra a oportunidade e confira o arquivo.";
  - na transação: `IntencaoMensagem` HUMANO com `tipo = tipoPorMime(mime)`, `midiaPath` e `corpoRenderizado = legenda ?? ""`, mais o `Evento` `PropostaEnviadaNoAtendimento` no `AtendimentoWhatsApp`, com payload `{ documentoId, intencaoId, ...marca }`;
  - depois, `despacharFila(new Date(), { intencaoId })`.

Na UI:
- "Proposta" abre uma lista com nome e data de cada proposta. O clique envia (`useAcaoCliente({ idempotente: true })` mais chave).
- Sem proposta, `EstadoVazio` "Nenhuma proposta anexada a esta oportunidade." com o link "Abrir oportunidade" para `/funil?o=<oportunidadeId>`.
- O item só aparece com `propostas.oportunidadeId`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// proposta-atendimento.int.test.ts (arquivo gravado em UPLOAD_DIR/documentos, como encaminhar.int.test.ts:76-78)
it("vendedor envia a proposta da oportunidade da conversa: DOCUMENTO em whatsapp-out do autor, Evento com a marca", async () => {
  const r = await enviarPropostaNoAtendimento({ atendimentoId: a.id, documentoId: doc.id, chaveIdempotencia: "chave-prop-0001" });
  expect(r.ok).toBe(true);
  const i = await prisma.intencaoMensagem.findFirstOrThrow({ where: { atendimentoId: a.id } });
  expect(i).toMatchObject({ origem: "HUMANO", tipo: "DOCUMENTO", autorId: vend.id });
  expect(midiaSaidaDoAutor(i.midiaPath!, vend.id)).toBe(true);
  expect(await prisma.evento.findFirst({ where: { tipo: "PropostaEnviadaNoAtendimento", agregadoId: a.id } })).toMatchObject({ payload: expect.objectContaining({ documentoId: doc.id, intencaoId: i.id, chaveIdempotencia: "chave-prop-0001" }) });
});
it("mesma chave: uma intenção e um Evento", ...);
it("documento de outra oportunidade, arquivado ou de outra categoria: 'Proposta não encontrada.' e nenhuma intenção", ...);
it("quem não vê a oportunidade na thread não lista nem envia", ...);
it("contato em opt-out: recusa sem intenção", ...);
it("lista: só PROPOSTA não arquivada, da mais nova para a mais antiga, até 10", ...);
```

```ts
// Compositor.test.ts
it("Proposta lista as propostas e o clique chama aoEnviarProposta(documentoId)", ...);
it("sem proposta: estado vazio com 'Abrir oportunidade' para /funil?o=<id>", ...);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/proposta-atendimento.int.test.ts && node_modules/.bin/vitest run src/components/conversa/Compositor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `copiarDocumentoParaSaida`, com a mesma leitura de `copiarMidiaParaSaida` (`midia.ts:119-135`) mas sem restringir a pasta de origem. A autorização vem de `exigirPropostaVisivel`. Depois `propostasVisiveis`, `exigirPropostaVisivel`, as duas actions e a UI.

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2, mais `node_modules/.bin/vitest run src/app/estados-vazios.test.ts src/app/botoes.test.ts`
Expected: PASS.

- [ ] **Step 5: Aceite visual**
  - Estados: `anexos-proposta` (lista) e `anexos-proposta-vazia`.
  - Referência: P:970, a proposta enviada como anexo no balão "eu".

- [ ] **Step 6: Commit**

```bash
git add src/server/whatsapp src/components/conversa "src/app/(app)/inbox" src/app/estados-vazios-mapa.ts docs/12-catalogo-de-eventos.md docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): enviar a proposta da oportunidade pelo menu de anexos (E4.7)"   # + trailer
```

---

<a id="task-8"></a>
### Task 8: Enquete e localização pelo menu de anexos (motor)

**O que o motor já faz** (conferido no código; `docs/MODO-SERVICO.md` não existe no repositório, e os docs 30–32 não tratam desses conteúdos):
- `enviarConteudoInbox({ atendimentoId, conteudo, midiaUrl? })` (`src/server/whatsapp/motor/acoes-mensagem.ts:405-439`) valida com `ConteudoSchema` (`:375-390`):
  - ENQUETE: `nome` de 1 a 255 caracteres, 2 a 12 opções de 1 a 100 caracteres, `maxEscolhas` entre 1 e o número de opções;
  - LOCALIZACAO: `latitude` e `longitude` no intervalo, `nome` opcional;
  - CONTATO: `contatoJid` no formato `^\d{8,20}@s\.whatsapp\.net$`.
- Exige driver MOTOR e sessão conectada (`exigirMotorConectado`).
- Grava a intenção HUMANO e passa pelo despachante.
- `ConteudoEspecial` está em `src/server/whatsapp/canal.ts:48-53`. A tradução para o motor fica em `src/server/whatsapp/drivers/motor.ts:133-146`.
- Os testes de servidor já existem: `src/server/whatsapp/motor/conteudo.int.test.ts:37-120`.

Falta só a tela. Os itens já aparecem e não têm `onClick` (`Compositor.tsx:255`).

**Files:**
- Create: `src/components/conversa/anexos/coordenadas.ts`
- Create: `src/components/conversa/anexos/FormEnquete.tsx`
- Create: `src/components/conversa/anexos/FormLocalizacao.tsx`
- Modify: `src/components/conversa/Compositor.tsx`: `aoEnviarConteudo`; Enquete e Localização abrem `Modal folha` com o formulário
- Modify: o ponto da E1 que monta o compositor: `aoEnviarConteudo={(c) => enviarConteudoInbox({ atendimentoId, conteudo: c })}`
- Modify: `src/app/botoes-mapa.ts`
- Test: `src/components/conversa/anexos/coordenadas.test.ts`
- Test: `src/components/conversa/anexos/FormEnquete.test.ts`
- Test: `src/components/conversa/Compositor.test.ts`

**Interfaces:**
- Consumes: `enviarConteudoInbox` e `ConteudoEspecial` (acima); `Modal` (`src/components/Modal.tsx:22`).
- Produces:

```ts
export function lerCoordenadas(texto: string): { latitude: number; longitude: number } | null;
// aceita "-23.5614, -46.6559", ".../@-23.5614,-46.6559,17z", "...?q=-23.5614,-46.6559" e "...query=-23.5614,-46.6559"; fora de [-90,90]/[-180,180] → null
export function FormEnquete(props: { aoEnviar(c: Extract<ConteudoEspecial, { tipo: "ENQUETE" }>): Promise<Resultado<unknown>>; aoFechar(): void }): JSX.Element;
export function FormLocalizacao(props: { aoEnviar(c: Extract<ConteudoEspecial, { tipo: "LOCALIZACAO" }>): Promise<Resultado<unknown>>; aoFechar(): void }): JSX.Element;
```

Os formulários:
- **Enquete:**
  - "Pergunta" (obrigatória, até 255);
  - "Opções", 2 a 12 campos, com "Adicionar opção" e remover;
  - "Escolhas por pessoa" (número, padrão 1, máximo igual ao número de opções).
- **Localização:**
  - "Nome do local" (opcional, até 255);
  - "Link do mapa ou coordenadas" (obrigatório, com dica "Cole o link do Google Maps ou digite latitude, longitude.").

O envio usa `useAcaoCliente({ idempotente: false })`, que trava o clique duplo. `enviarConteudoInbox` não tem chave (é do ERP, como `enviarTextoInbox`). Ver as suposições.

- [ ] **Step 1: Escrever os testes que falham**

```ts
it("coordenadas: par, link com @, ?q= e query=", () => {
  expect(lerCoordenadas("-23.5614, -46.6559")).toEqual({ latitude: -23.5614, longitude: -46.6559 });
  expect(lerCoordenadas("https://www.google.com/maps/place/X/@-23.5614,-46.6559,17z")).toEqual({ latitude: -23.5614, longitude: -46.6559 });
  expect(lerCoordenadas("https://maps.google.com/?q=-23.5,-46.6")).toEqual({ latitude: -23.5, longitude: -46.6 });
});
it("coordenadas fora do intervalo ou texto solto: null", () => { expect(lerCoordenadas("91, 10")).toBeNull(); expect(lerCoordenadas("Av. Paulista")).toBeNull(); });
it("enquete: 'Enviar' só com pergunta e 2 opções; escolhas não passam do número de opções", ...);
it("enquete: envia { tipo: 'ENQUETE', nome, opcoes, maxEscolhas }", ...);
it("Compositor com motor: Enquete e Localização abrem o formulário; sem motor seguem desabilitados com o aviso", ...);
it("erro do servidor ('Este canal não envia esse tipo de conteúdo.') fica no formulário", ...);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/components/conversa`
Expected: FAIL.

- [ ] **Step 3: Implementar** `lerCoordenadas`, os dois formulários e a ligação no compositor.

- [ ] **Step 4: Rodar e ver passar**

Run: `node_modules/.bin/vitest run src/components/conversa src/app/botoes.test.ts src/app/dialogos.test.ts && node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/motor/conteudo.int.test.ts`
Expected: PASS.

- [ ] **Step 5: Aceite visual**
  - Estados: `anexo-enquete` e `anexo-localizacao`, com motor simulado (`capacidades` com os recursos).
  - Não há referência no protótipo, que só simula o envio (P:969-972). Siga o estilo dos diálogos da E1.

- [ ] **Step 6: Commit**

```bash
git add src/components/conversa "src/app/(app)/inbox" src/app/botoes-mapa.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): enquete e localização pelo motor no menu de anexos (E4.8)"   # + trailer
```

---

<a id="task-9"></a>
### Task 9: Cartão de contato com os números da escola (motor)

O motor envia o cartão por JID (`ConteudoEspecial` CONTATO). O ERP não tem cadastro de "contatos para compartilhar" (`Usuario` não tem telefone). A fonte deste item são os números ativos da escola (`NumeroWhatsApp`). Assim nenhum telefone de cliente vai para outro cliente. Ver as suposições.

**Files:**
- Modify: `src/server/whatsapp/consultas-acoes-atendimento.ts`: `contatosParaCartao`
- Modify: `src/components/conversa/Compositor.tsx`: item Contato lista as opções (`aoListarContatosCartao`) e o clique envia por `aoEnviarConteudo({ tipo: "CONTATO", contatoJid })`
- Test: `src/server/whatsapp/consultas-acoes-atendimento.int.test.ts` (crie, ou acrescente ao `consultas-acoes-atendimento.int.test.ts` existente)
- Test: `src/components/conversa/Compositor.test.ts`

**Interfaces:**
- Consumes: `aoEnviarConteudo` (Task 8); `atendimentoVisivel(u, id, true)`.
- Produces:

```ts
export interface ContatoCartao { id: string; rotulo: string; contatoJid: string }
export async function contatosParaCartao(atendimentoId: string): Promise<ContatoCartao[]>;
// [] sem escopo de envio, com atendimento encerrado ou com número que não é MOTOR; senão os NumeroWhatsApp ativos,
// em ordem de rótulo, com contatoJid = dígitos de telefoneE164 + "@s.whatsapp.net"
```

- [ ] **Step 1: Escrever os testes que falham**

```ts
it("lista os números ativos da escola com o JID; inativo fica de fora", async () => {
  expect(await contatosParaCartao(a.id)).toEqual([{ id: numero.id, rotulo: "Número +5511999990001", contatoJid: "5511999990001@s.whatsapp.net" }]);
});
it("sem escopo de envio: lista vazia", ...);
it("Compositor: Contato lista os números e envia { tipo: 'CONTATO', contatoJid }", ...);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/consultas-acoes-atendimento.int.test.ts && node_modules/.bin/vitest run src/components/conversa/Compositor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Rodar e ver passar** com o mesmo comando. Expected: PASS.

- [ ] **Step 5: Aceite visual.** Estado `anexo-contato`. O protótipo mostra um contato fixo (P:970), sem tela de escolha.

- [ ] **Step 6: Commit**

```bash
git add src/server/whatsapp/consultas-acoes-atendimento* src/components/conversa docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): cartão de contato com os números da escola pelo motor (E4.9)"   # + trailer
```

---

<a id="task-10"></a>
### Task 10: Contexto opcional e resumo da Aria na transferência (D5)

> **Bloqueada por D5.** Assume a resposta: "contexto opcional e 'Anexar resumo da Aria como nota' entram".
> **Se a decisão vier diferente:**
> - contexto obrigatório e resumo sim: mantenha `min(12)` e faça só a parte do resumo;
> - nenhum dos dois: a task é cancelada e o índice registra "D5: transferência entre setores segue igual".

**Files:**
- Create: `src/server/aria/resumo-nota.ts`
- Modify: `src/server/whatsapp/acoes-atendimento.ts:169-263` (`TransferirSchema`, `transferirAtendimento`)
- Modify: `src/server/whatsapp/consultas-acoes-atendimento.ts`: `temResumoDaAria`
- Modify: `src/app/(app)/inbox/fluxos/transferir/opcoes-transferir.ts`: `REGRAS_TRANSFERIR_PADRAO.contextoMinimoSetor = 0`, `resumoAria = true`
- Modify: `src/app/(app)/inbox/fluxos/transferir/PopoverTransferir.tsx`: checkbox "Anexar resumo da Aria como nota", ligado por padrão quando `temResumoDaAria` (P:227, P:964)
- Modify: `docs/superpowers/plans/2026-10-22-inbox-prototipo-00-indice.md` (D5 respondida)
- Test: `src/server/whatsapp/transferencia.int.test.ts` (o caso `:75`, "contexto curto…", muda)
- Test: `src/app/(app)/inbox/fluxos/transferir/*.test.ts`

**Interfaces:**
- Consumes: `AcaoAgenteIA` com `acao = "HANDOFF"` e `payload.nota` (`src/server/aria/turno/handoff.ts:110-122`, montado por `montarNotaResumo` em `:38-45`).
- Produces:

```ts
export async function resumoDaAriaParaNota(db: Prisma.TransactionClient | typeof prisma, atendimentoId: string): Promise<string | null>;
// última AcaoAgenteIA HANDOFF EXECUTADA do atendimento com payload.nota não vazia → "Resumo da Aria\n" + nota; senão null
export async function temResumoDaAria(atendimentoId: string): Promise<boolean>; // "use server"; false fora do escopo
// TransferirSchema: contexto: z.string().trim().max(1000).default(""), anexarResumoAria: z.boolean().default(false)
// transferirAtendimento(input: { atendimentoId; destino; destinoChave; contexto?: string; anexarResumoAria?: boolean; chaveIdempotencia? })
```

Regras:
- **Permissão:** igual (`podeExecutar(u, "transferir", ctx)`).
- **Idempotência:** a marca passa a cobrir `anexarResumoAria`, porque o hash é calculado sobre `dados`.
- **Payload do `AtendimentoTransferido`:** `contexto: string | null`.
- **Notas no atendimento novo, autor = quem transferiu:**
  - a `NotaInterna` do contexto só é gravada se o contexto não estiver vazio;
  - com `anexarResumoAria` e um resumo não nulo, grava mais uma `NotaInterna` com `payload { nota, origem: "resumoAria" }`.
- **Migration:** nenhuma.

- [ ] **Step 1: Escrever os testes que falham**

```ts
it("contexto vazio transfere sem nota de contexto (D5)", async () => {
  const r = await transferirAtendimento({ atendimentoId: a.id, destino: "SECRETARIA", destinoChave: null, contexto: "" });
  expect(r.ok).toBe(true);
  expect(await prisma.evento.count({ where: { tipo: "NotaInterna", agregadoId: r.ok ? r.dado!.novoAtendimentoId : "" } })).toBe(0);
});
it("anexarResumoAria grava o resumo do último handoff como nota no atendimento novo", async () => {
  await prisma.acaoAgenteIA.create({ data: { /* turno fixture */ atendimentoId: a.id, acao: "HANDOFF", status: "EXECUTADA", payload: { nota: "Motivo: quer desconto" }, /* ... */ } });
  // nota "Resumo da Aria\nMotivo: quer desconto" com payload.origem "resumoAria"
});
it("sem handoff: anexarResumoAria não grava nota e não falha", ...);
it("mesma chave com anexarResumoAria diferente: conflito", ...);
it("PopoverTransferir: setor sem mínimo de contexto; checkbox ligado quando há resumo e desligado/ausente sem", ...);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/transferencia.int.test.ts && node_modules/.bin/vitest run "src/app/(app)/inbox/fluxos/transferir"`
Expected: FAIL.

- [ ] **Step 3: Implementar** conforme as interfaces. Atualize o caso `transferencia.int.test.ts:75`: só "outro vendedor sem alçada" e "destino igual" continuam recusados.

- [ ] **Step 4: Rodar e ver passar** com o comando do Step 2, mais `src/server/whatsapp/agendamento.int.test.ts`. Expected: PASS.

- [ ] **Step 5: Aceite visual.** Estado `transferir-passo2-setor` com o checkbox. Referência: `prototipo-estado-transferir-passo2.png`.

- [ ] **Step 6: Commit**

```bash
git add src/server/aria/resumo-nota.ts src/server/whatsapp "src/app/(app)/inbox/fluxos/transferir" docs/superpowers/plans/2026-10-22-inbox-prototipo-00-indice.md docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): contexto opcional e resumo da Aria na transferência (E4.10, D5)"   # + trailer
```

---

<a id="task-11"></a>
### Task 11: Transferir para pessoa por quem atende (D5)

> **Bloqueada por D5.** Assume a resposta:
> - o responsável (não só o gerente) passa a conversa para um colega que atende o setor;
> - o contexto é opcional;
> - a carteira (`Oportunidade.vendedorDonoId`) **não** muda.
>
> **Se a decisão vier diferente:**
> - "muda a carteira": na mesma transação, aplique a regra de `atribuirDono` (`src/server/comercial/acoes.ts:773-790`), extraída para `transferirCarteiraTx(tx, leadId, de, para, autorId, motivo)` e chamada pelas duas ações;
> - "só gerente": a task é cancelada, e o "Pessoas" continua na regra da Task 1.

**Files:**
- Modify: `src/server/whatsapp/acoes-atendimento.ts`: `transferirParaPessoa`
- Modify: `src/server/whatsapp/consultas-acoes-atendimento.ts:18-29`: `para: "atribuir" | "convidar" | "transferir"` (no `"transferir"`, as pessoas são as de `papeisDoSetor` sob a alçada `podeExecutar("transferir")`)
- Modify: `src/app/(app)/inbox/fluxos/transferir/opcoes-transferir.ts`: `REGRAS_TRANSFERIR_PADRAO.pessoasPor = "responsavelOuGerente"`
- Modify: `src/app/(app)/inbox/fluxos/transferir/PopoverTransferir.tsx`: pessoa usa `transferirParaPessoa` (atômico) no lugar de atribuir mais nota
- Modify: `docs/superpowers/plans/2026-10-22-inbox-prototipo-00-indice.md`, `docs/12-catalogo-de-eventos.md`
- Test: `src/server/whatsapp/transferir-pessoa.int.test.ts`
- Test: `src/app/(app)/inbox/fluxos/transferir/*.test.ts`

**Interfaces:**
- Consumes:
  - `podeExecutar(u, "transferir", ctx)` (`permissoes.ts:58-59`: o responsável ou o gerente do setor; nenhuma `AcaoInbox` nova);
  - `exigirResponsavelEnxerga` (`acoes-atendimento.ts:38`);
  - `cancelarIntencoesDoResponsavel` (`:51`);
  - `papeisDoSetor` (`src/server/whatsapp/setor.ts:62`);
  - `resumoDaAriaParaNota` (Task 10).
- Produces:

```ts
export async function transferirParaPessoa(input: { atendimentoId: string; usuarioId: string; contexto?: string; anexarResumoAria?: boolean; chaveIdempotencia?: string }): Promise<Resultado>;
```

Regras, na mesma transação e com `FOR UPDATE`, como `atribuirAtendimento` (`acoes-atendimento.ts:144-167`):
- **Validações:**
  - atendimento visível, aberto e com alçada `transferir`;
  - o destino está ativo, tem papel do setor e é diferente de quem transfere;
  - o destino continua enxergando o atendimento (`exigirResponsavelEnxerga`, que cobre a linha de vendas, LC-D02).
- **Efeitos:**
  - grava o responsável e o status com `proximoStatus(..., "ASSUMIDO", true)`;
  - cancela as intenções HUMANO do responsável anterior;
  - grava o Evento `AtendimentoAtribuido` com `{ de, para, via: "transferencia", contexto: string | null, ...marca }`. É o mesmo tipo de `TIPOS_RESPONSAVEL` (`:60`), então assumir e devolver continuam idempotentes;
  - grava a `NotaInterna` do contexto, se houver, e a do resumo da Aria, se pedido.
- **Idempotência:** com chave, `repeticaoIdempotente` sobre `AtendimentoAtribuido` antes das validações.
- **Migration:** nenhuma.

- [ ] **Step 1: Escrever os testes que falham**

```ts
describe("transferir para pessoa (E4.11, D5)", () => {
  it("vendedor responsável passa para outro vendedor do setor: responsável muda, intenções dele canceladas, Evento com via transferencia", ...);
  it("contexto vira NotaInterna do mesmo atendimento; vazio não grava", ...);
  it("quem não é o responsável nem gerente: 'Sua função não autoriza esta ação neste atendimento.'", ...);
  it("destino sem papel do setor: 'A pessoa escolhida não atende este setor.'", ...);
  it("linha de vendas: destino que não enxergaria é recusado (MSG_RESPONSAVEL_SEM_ACESSO_LINHA)", ...);
  it("mesma chave duas vezes: um Evento", ...);
  it("a carteira (vendedorDonoId) não muda", ...);
});
// opcoes-transferir.test.ts
it("D5: vendedor responsável vê Pessoas", () => { expect(opcoesTransferir(base).pessoas).toBe(true); });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/transferir-pessoa.int.test.ts && node_modules/.bin/vitest run "src/app/(app)/inbox/fluxos/transferir"`
Expected: FAIL.

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Rodar e ver passar** com o comando do Step 2, mais `src/server/whatsapp/atribuicao.int.test.ts`. Expected: PASS.

- [ ] **Step 5: Aceite visual.** Estado `transferir-passo1-vendedor` com "Pessoas".

- [ ] **Step 6: Commit**

```bash
git add src/server/whatsapp "src/app/(app)/inbox/fluxos/transferir" docs docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): transferir para pessoa por quem atende (E4.11, D5)"   # + trailer
```

---

<a id="task-12"></a>
### Task 12: Carga por pessoa no Transferir (D6)

> **Bloqueada por D6.** Assume a resposta: "a carga entra; a presença fica para o spike (Task 17)".
> **Se a decisão vier diferente:** sem carga, a task é cancelada. Com presença, as tasks saem da Task 17.

**Files:**
- Modify: `src/server/whatsapp/consultas-acoes-atendimento.ts`: `cargaDasPessoas`
- Modify: `src/app/(app)/inbox/fluxos/transferir/opcoes-transferir.ts`: `carga = true`
- Modify: `src/app/(app)/inbox/fluxos/transferir/PopoverTransferir.tsx`: subtítulo "{n} conversas" (P:1173)
- Test: `src/server/whatsapp/consultas-acoes-atendimento.int.test.ts`
- Test: `src/app/(app)/inbox/fluxos/transferir/PopoverTransferir.test.ts`

**Interfaces:**
- Produces:

```ts
export async function cargaDasPessoas(atendimentoId: string, usuarioIds: string[]): Promise<Record<string, number>>;
// só com alçada de transferir/atribuir no atendimento (senão {}); conta AtendimentoWhatsApp com responsavelId ∈ ids, encerradoEm null; até 200 ids
```

Permissão: a mesma de `listarPessoasParaAtendimento`. Migration: nenhuma. O índice atual por `responsavelId` basta; se o `EXPLAIN` mostrar varredura, crie `20261023350000` com `CREATE INDEX CONCURRENTLY`, sozinho.

- [ ] **Step 1: Testes que falham**

```ts
it("conta só os atendimentos abertos de cada pessoa", async () => {
  expect(await cargaDasPessoas(a.id, [v1.id, v2.id])).toEqual({ [v1.id]: 2, [v2.id]: 0 });
});
it("sem alçada: {}", ...);
it("PopoverTransferir mostra '2 conversas' no subtítulo da pessoa", ...);
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/consultas-acoes-atendimento.int.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar** com `groupBy` por `responsavelId`.
- [ ] **Step 4: Rodar e ver passar** com o mesmo comando, mais `node_modules/.bin/vitest run "src/app/(app)/inbox/fluxos/transferir"`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(inbox): carga por pessoa no Transferir (E4.12, D6)"` (+ trailer), incluindo o índice com D6 respondida.

---

<a id="task-13"></a>
### Task 13: Iniciar conversa por número novo (D9)

> **Bloqueada por D9.** Assume a resposta:
> - vendedor e gerente comercial digitam um número;
> - a conversa sai só pelas linhas comerciais a que a pessoa tem acesso;
> - nasce a Pessoa e a oportunidade em "Novo" (`EtapaLead.NOVO`), com origem "Prospecção ativa" e dono = quem iniciou;
> - a primeira mensagem é texto livre (motor, sem modelo aprovado; ver L13 da parte 2).
>
> **Se a decisão vier diferente:**
> - "exige modelo aprovado": o popover passa a pedir um `TemplateWhatsApp` com status APROVADO, e o primeiro envio vira `enviarTemplate`. Isso é uma task com label `motor`;
> - "outros papéis": troque `PAPEIS_COMERCIAL` pela lista decidida;
> - "origem Outro": sem migration, use `OrigemCanal.OUTRO`.

**Files:**
- Create: `prisma/migrations/20261023320000_origem_prospeccao_ativa/migration.sql`
- Create: `src/server/whatsapp/nova-conversa.ts` (`"use server"`)
- Modify: `prisma/schema.prisma:9396-9407` (`OrigemCanal.PROSPECCAO_ATIVA`), `src/lib/labels.ts:170` (`ORIGEM_CANAL_LABEL`: "Prospecção ativa")
- Modify: `src/app/(app)/inbox/fluxos/nova-conversa/PopoverNovaConversa.tsx`:
  - busca no servidor com atraso de 300 ms (`setTimeout` limpo no efeito, nunca `setInterval`);
  - item "Conversar com {número}" com o subtítulo "Número novo · cria o contato e uma oportunidade em Novo lead" (P:58-63);
  - "Novo contato" (P:64-67): com número válido, inicia a conversa; sem ele, mostra o aviso "Digite o número com DDD no campo acima" (P:1052).
- Modify: `docs/superpowers/plans/2026-10-22-inbox-prototipo-00-indice.md`, `docs/12-catalogo-de-eventos.md`
- Test: `src/server/whatsapp/nova-conversa.int.test.ts`
- Test: `src/app/(app)/inbox/fluxos/nova-conversa/PopoverNovaConversa.test.ts`

**Interfaces:**
- Consumes:
  - `criarLead(input)` (`src/server/comercial/acoes.ts:137`), com `garantirPessoaTx` (`src/server/crm/pessoas.ts:90`) por dentro;
  - `abrirAtendimentoInstitucional` (`src/server/whatsapp/operacoes-atendimento.ts:122`);
  - `listarOpcoesAtendimento` (`:36`);
  - `escopoComercialAtual` (`src/server/_shared/escopo-comercial`);
  - `escopoAtendimentos` (`src/server/whatsapp/escopo.ts:47`);
  - `marcaIdempotencia` e `repeticaoIdempotente`.
- Produces:

```ts
export interface ResultadoBuscaNovaConversa {
  itens: ({ tipo: "conversa"; atendimentoId: string; nome: string } | { tipo: "oportunidade"; destinoChave: string; nome: string })[];
  numeroNovo: string | null;        // E.164, quando ≥ 10 dígitos e nenhum cadastro com o número
  numeroIndisponivel: boolean;      // há cadastro com o número fora do escopo de quem busca (sem dizer qual)
}
export async function buscarParaNovaConversa(q: string): Promise<ResultadoBuscaNovaConversa>;
export async function iniciarConversaPorNumero(input: { telefone: string; numeroId: string; nome?: string; chaveIdempotencia?: string }): Promise<Resultado<{ atendimentoId: string; criado: boolean }>>;
```

Regras:
- **Permissão:** `exigirPapel(u, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.ADMINISTRADOR)`.
- **Telefone:** `telefone` casa `^\+\d{10,15}$`. A UI monta o número com "+" e o código do país, e a dica é "Digite com o código do país, como +55 11 98111-3344".
- **Canal:** `canal = listarOpcoesAtendimento().numeros.find(n => n.id === numeroId && n.comercial)`, senão "Atendimento comercial sai somente por uma linha comercial à qual você tem acesso.".
- **Com chave:** `repeticaoIdempotente` sobre `ConversaIniciadaPorNumero` (agregado `AtendimentoWhatsApp`) primeiro.
- **Oportunidade no escopo com o mesmo `telefoneE164`:** `abrirAtendimentoInstitucional({ destinoChave: "COMERCIAL:"+id, numeroId, chaveIdempotencia: chave+":atendimento" })` e `criado: false`.
- **Cadastro com o número fora do escopo** (`ContatoWhatsApp` ou `Oportunidade`): "Este número já tem cadastro na escola. Peça à gestão para incluí-lo na sua carteira.", sem criar nada.
- **Número novo:**
  - `criarLead({ nome: nome?.trim() || telefone, telefoneE164: telefone, origemCanal: "PROSPECCAO_ATIVA", chaveIdempotencia: chave+":lead" })`;
  - depois `abrirAtendimentoInstitucional` com `chave+":atendimento"`;
  - por fim o Evento `ConversaIniciadaPorNumero` `{ leadId, criado: true, ...marca }`.
- **Atomicidade:** são três transações. Um reenvio com a mesma chave retoma do ponto em que parou, porque cada passo tem a sua chave derivada.
- **No telefone, nada vai para o cliente** além do número que a própria pessoa digitou.

SQL:

```sql
ALTER TYPE "OrigemCanal" ADD VALUE IF NOT EXISTS 'PROSPECCAO_ATIVA';
```

- [ ] **Step 1: Testes que falham**

```ts
it("número novo: cria Pessoa, oportunidade NOVO com origem PROSPECCAO_ATIVA e dono = vendedor, e abre o atendimento COMERCIAL com ele responsável", ...);
it("número de oportunidade da carteira: abre o atendimento dela, criado false, sem nova oportunidade", ...);
it("número de cadastro fora do escopo: recusa com a mensagem neutra e não cria nada", ...);
it("canal que não é linha comercial do vendedor: recusa", ...);
it("mesma chave duas vezes: uma oportunidade, um atendimento, um Evento", ...);
it("reenvio depois de falha no abrir (canal desativado e reativado): reaproveita a oportunidade", ...);
it("financeiro: sem permissão", ...);
it("busca: 3 dígitos acham a conversa visível; 10 dígitos sem cadastro devolvem numeroNovo; o telefone não sai nos itens", ...);
// PopoverNovaConversa.test.ts
it("D9: 'Conversar com +55 21 98111-3344' chama iniciarConversaPorNumero com o canal comercial e a chave", ...);
it("'Novo contato' sem número válido mostra 'Digite o número com DDD no campo acima'", ...);
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/nova-conversa.int.test.ts`. Expected: FAIL.
- [ ] **Step 3: Migration** (`prisma migrate dev --skip-generate` no banco descartável), `prisma generate` com o binário local, rótulo em `labels.ts` e implementação.
- [ ] **Step 4: Rodar e ver passar** com o comando do Step 2, mais `node_modules/.bin/vitest run src/app/enums-rotulos.test.ts "src/app/(app)/inbox/fluxos/nova-conversa"`. Expected: PASS.
- [ ] **Step 5: Aceite visual.** Estado `nova-conversa-numero`. Referência: `telas/prototipo-estado-nova-conversa-numero.png`.
- [ ] **Step 6: Commit** `git commit -m "feat(inbox): iniciar conversa por número novo (E4.13, D9, migration 20261023320000)"` (+ trailer).

---

<a id="task-14"></a>
### Task 14: Perguntar antes de enviar se o contato responder (D11)

> **Bloqueada por D11.** Assume a resposta:
> - a opção entra, ligada por padrão (P:391; `cancelOnReply: true` em P:879);
> - se o contato escrever depois de agendar, a mensagem **não sai** e o cartão pergunta "{Nome} respondeu depois que você agendou. Ainda quer enviar?", com "Cancelar envio" e "Manter agendada" (P:335-340, P:1090).
>
> **Se a decisão vier diferente:**
> - "cancelar sozinho": o passo do despachante marca `CANCELADA` com o motivo `contato_respondeu` e não há pergunta;
> - "não entra": a task é cancelada.

**Files:**
- Create: `prisma/migrations/20261023310000_agendada_perguntar_se_responder/migration.sql`
- Modify: `prisma/schema.prisma:2652-2721` (`IntencaoMensagem.perguntarSeResponder Boolean @default(false)`, `confirmadaAposRespostaEm DateTime?`)
- Modify: `src/server/crm/mensagens-agendadas.ts`:
  - `AgendarMensagemInput.perguntarSeResponder?: boolean`, só no caminho do atendimento e dentro da marca;
  - `confirmarAgendadaAposResposta`;
  - `reagendarMensagem` e `enviarAgora` gravam `confirmadaAposRespostaEm: agora`.
- Modify: `src/server/whatsapp/acoes-conversa.ts`:
  - `agendarMensagemNoAtendimento(Local)` repassa `perguntarSeResponder`;
  - `manterAgendadaAposResposta`.
- Modify: `src/server/whatsapp/despachante.ts`: passo 4b depois de `:300`; `reterParaConfirmar` junto de `adiar` (`:746`)
- Modify: `src/server/whatsapp/consultas-acoes-atendimento.ts`: `AgendadaNoFio.perguntaPendente`
- Modify: `PopoverAgendar.tsx` (checkbox), `CartaoAgendada.tsx` (pergunta)
- Modify: `docs/12-catalogo-de-eventos.md`, índice (D11)
- Test: `src/server/whatsapp/despachante-agendada.int.test.ts`, `src/server/whatsapp/agendamento.int.test.ts`
- Test: `fluxos/agendar/PopoverAgendar.test.ts`, `CartaoAgendada.test.ts`

**Interfaces:**

```ts
export const MOTIVO_AGUARDA_CONFIRMACAO = "aguarda_confirmacao_resposta"; // despachante.ts
export async function confirmarAgendadaAposResposta(id: string, opcoes?: OpcoesAlterarAgendada): Promise<Resultado>; // alterar(id, "MensagemAgendadaMantida", …)
export async function manterAgendadaAposResposta(input: { atendimentoId: string; intencaoId: string; chaveIdempotencia?: string }): Promise<Resultado>; // "use server"
// AgendadaNoFio += perguntaPendente: boolean
```

Regras:
- **Passo 4b do despachante:**
  - vale para `origem === "HUMANO"`, com `agendadaPara`, `perguntarSeResponder` e `conversa.ultimoInboundEm > (it.confirmadaAposRespostaEm ?? it.criadaEm)`;
  - faz `reterParaConfirmar(it.id)`: `updateMany` de `PENDENTE` ou `ADIADA` para `ADIADA`, com `despacharAposEm: null` e `motivoFalha: MOTIVO_AGUARDA_CONFIRMACAO`. A consulta da fila (`:189-195`) não pega `ADIADA` com `despacharAposEm` nulo, então ela espera;
  - conta em `r.adiadas`.
- **`confirmarAgendadaAposResposta`:** `data { confirmadaAposRespostaEm: agora, status: "PENDENTE", despacharAposEm: null, motivoFalha: null }`.
- **`perguntaPendente`:** `perguntarSeResponder && atendimento.ultimoInboundEm > (confirmadaAposRespostaEm ?? criadaEm)`.
- **Tempo real:** a mensagem de entrada já avisa (`mensagem.nova`), e o `useAgendadas` recarrega.
- **Permissão:** a de `cancelarAgendamentoDoAtendimento`.

SQL:

```sql
ALTER TABLE "IntencaoMensagem" ADD COLUMN "perguntarSeResponder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "IntencaoMensagem" ADD COLUMN "confirmadaAposRespostaEm" TIMESTAMP(3);
```

- [ ] **Step 1: Testes que falham**

```ts
it("com a opção, entrada depois de agendar retém a mensagem: ADIADA aguarda_confirmacao_resposta e não envia", ...);
it("sem a opção, sai normalmente (HUMANO não cai na lei da conversa viva)", ...);
it("entrada antes de agendar não retém", ...);
it("manter agendada: confirma e sai no ciclo seguinte ao horário", ...);
it("enviar agora sobre a retida envia", ...);
it("cancelar envio: CANCELADA cancelada_pelo_autor", ...);
it("agendadasDoAtendimento marca perguntaPendente depois da entrada", ...);
it("mesma chave com perguntarSeResponder diferente: conflito", ...);
it("CartaoAgendada com perguntaPendente mostra a pergunta e os dois botões", ...);
it("PopoverAgendar: 'Perguntar antes de enviar se o contato responder' ligado por padrão e enviado na action", ...);
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/despachante-agendada.int.test.ts src/server/whatsapp/agendamento.int.test.ts`. Expected: FAIL.
- [ ] **Step 3: Migration, schema e implementação** conforme acima.
- [ ] **Step 4: Rodar e ver passar** com o comando do Step 2, mais `src/server/whatsapp/despachante*.int.test.ts` e `node_modules/.bin/vitest run "src/app/(app)/inbox/fluxos/agendar"`. Expected: PASS.
- [ ] **Step 5: Aceite visual.** Estado `fio-agendada-pergunta`. Referência: P:335-340 renderizado.
- [ ] **Step 6: Commit** `git commit -m "feat(inbox): perguntar antes de enviar a agendada se o contato responder (E4.14, D11, migration 20261023310000)"` (+ trailer).

---

<a id="task-15"></a>
### Task 15: Editar o texto da mensagem agendada (D11)

> **Bloqueada por D11.** Assume a resposta: "editar o texto entra; só agendadas HUMANO, e só por quem pode alterá-las".
> **Se a decisão vier diferente:**
> - "não entra": a task é cancelada, e "Editar" segue só reagendando (Task 4);
> - "também as da Aria": inclua `origem: "IA"` em `baseAgendada` só para esta ação, com permissão `decidirHistorico` (`capacidadesAria`), e registre o pedido em D2.

**Files:**
- Modify: `src/server/crm/mensagens-agendadas.ts`: `editarMensagemAgendada`
- Modify: `src/server/whatsapp/acoes-conversa.ts`: `editarAgendamentoDoAtendimento`
- Modify: `fluxos/agendar/PopoverAgendar.tsx`: no modo editar, o texto fica editável e "Salvar" chama `editarAgendamentoDoAtendimento`
- Modify: `docs/12-catalogo-de-eventos.md`, índice
- Test: `src/server/whatsapp/agendamento.int.test.ts`, `fluxos/agendar/PopoverAgendar.test.ts`

**Interfaces:**

```ts
export async function editarMensagemAgendada(id: string, dados: { texto: string; agendadaPara: string }, opcoes?: OpcoesAlterarAgendada): Promise<Resultado>;
// alterar(id, "MensagemAgendadaEditada", …): texto 1–4096 (vazio só se houver midiaPath), futuro, validade, exigirAgendamentoNaJanela;
// data { corpoRenderizado, agendadaPara, status: "PENDENTE", despacharAposEm: null, motivoFalha: null }; payload { agendadaPara, textoAlterado: boolean }
export async function editarAgendamentoDoAtendimento(input: { atendimentoId: string; intencaoId: string; texto: string; quandoLocal: string; fuso: string; chaveIdempotencia?: string }): Promise<Resultado>;
```

Permissão: o escopo de `alterar` (autor, equipe do gerente comercial ou admin) mais `viaAtendimento`. Idempotência: marca sobre `{ texto, agendadaPara }`. Migration: nenhuma.

- [ ] **Step 1: Testes que falham**

```ts
it("edita texto e horário: Evento MensagemAgendadaEditada, sem o texto no payload; sai com o texto novo", ...);
it("já enviada: 'A mensagem já foi enviada.'", ...);
it("de outro autor (vendedor sem equipe): 'Mensagem não encontrada.'", ...);
it("mesma chave duas vezes: um Evento", ...);
it("PopoverAgendar editar: texto editável e Salvar chama editarAgendamentoDoAtendimento", ...);
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/agendamento.int.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar** com o mesmo comando, mais `node_modules/.bin/vitest run "src/app/(app)/inbox/fluxos/agendar"`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(inbox): editar o texto da mensagem agendada (E4.15, D11)"` (+ trailer).

---

<a id="task-16"></a>
### Task 16: Anexo e vínculo no agendamento (D11)

> **Bloqueada por D11.** Assume a resposta:
> - **Anexo:** entra, com a proposta da oportunidade ou um arquivo subido pelo uploader do Inbox (P:374-378). "Catálogo" depende de D22 e "Foto da turma" é um arquivo subido.
> - **"Vincular a":** entra, com Nenhum, Oportunidade ou Tarefa aberta (P:396).
> - **Recorrência:** continua fora (pendência 12, D19).
>
> **Se a decisão vier diferente:** só anexo ou só vínculo; o que ficar de fora sai do schema e da UI desta task.

**Files:**
- Modify: `src/server/crm/mensagens-agendadas.ts:27-55, 99-155`:
  - `AgendarMensagemInput` + `midiaUrl?`, `documentoPropostaId?`;
  - `leadId` e `tarefaId` passam a valer também com `atendimentoId`;
  - o texto vira opcional quando há anexo.
- Modify: `src/server/whatsapp/acoes-conversa.ts:72-99`: repassa os campos
- Modify: `src/server/whatsapp/consultas-acoes-atendimento.ts`: `tarefasAbertasParaVinculo` (use a consulta da E2, se ela já listar as tarefas do atendimento)
- Modify: `fluxos/agendar/PopoverAgendar.tsx`: "Anexar" (chips Proposta e Arquivo) e "Mais opções › Vincular a"
- Modify: `fluxos/agendar/CartaoAgendada.tsx`: nome do anexo
- Test: `src/server/whatsapp/agendamento.int.test.ts`, `fluxos/agendar/PopoverAgendar.test.ts`

**Interfaces:**

```ts
// AgendarMensagemInput +=
midiaUrl?: string;            // midiaSaidaDoAutor(midiaUrl, autor.id), senão "Anexo inválido: envie o arquivo pelo uploader da inbox."
documentoPropostaId?: string; // exigirPropostaVisivel + copiarDocumentoParaSaida (Task 7) — exclusivo com midiaUrl
// com atendimentoId: leadId só se === atendimento.leadId (senão "Oportunidade não é desta conversa."); tarefaId só se
// a tarefa está no escopoTarefas do autor, aberta e com leadId === atendimento.leadId ou pessoaId === contato.pessoaId
export async function tarefasAbertasParaVinculo(atendimentoId: string): Promise<{ id: string; titulo: string }[]>;
```

Regras:
- `tipo = tipoPorMime(mime)` quando há anexo. O despachante já envia mídia agendada (`despachante.ts:487-495`).
- A marca de idempotência passa a cobrir `midiaUrl`, `documentoPropostaId`, `leadId` e `tarefaId`.
- O Evento `MensagemAgendada` continua no `AtendimentoWhatsApp`, com `leadId` e `tarefaId` no payload.
- Migration: nenhuma (`midiaPath`, `leadId` e `tarefaId` já existem em `IntencaoMensagem`).

- [ ] **Step 1: Testes que falham**

```ts
it("agenda com a proposta: intenção DOCUMENTO com midiaPath em whatsapp-out do autor; texto opcional", ...);
it("agenda com arquivo do uploader; arquivo de outro autor é recusado", ...);
it("vínculo com a oportunidade da conversa grava leadId; de outra oportunidade é recusado", ...);
it("vínculo com tarefa aberta da oportunidade grava tarefaId; tarefa concluída ou de outro contato é recusada", ...);
it("agendada com anexo sai como mídia no horário", ...);
it("PopoverAgendar: 'Anexar' mostra Proposta e Arquivo; 'Mais opções' mostra 'Vincular a' sem 'Repetir'", ...);
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/agendamento.int.test.ts src/server/whatsapp/despachante-agendada.int.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar** com o mesmo comando, mais `node_modules/.bin/vitest run "src/app/(app)/inbox/fluxos/agendar"`. Expected: PASS.
- [ ] **Step 5: Aceite visual.** Estado `agendar-mais-opcoes`. Referência: `telas/prototipo-estado-agendar-mais-opcoes.png` (sem "Repetir").
- [ ] **Step 6: Commit** `git commit -m "feat(inbox): anexo e vínculo no agendamento (E4.16, D11)"` (+ trailer).

---

<a id="task-17"></a>
### Task 17: Spike: presença e equipes no Transferir (D6)

A decisão define o próprio desenho. Por isso esta task não escreve interfaces: leva as perguntas ao dono, registra a resposta e, conforme a opção escolhida, acrescenta tasks a este plano.

**Files:**
- Modify: `docs/superpowers/plans/2026-10-22-inbox-prototipo-00-indice.md` (linha D6)
- Modify: este plano (tasks novas a partir de E4.20, se a resposta pedir)

**Perguntas e opções**

1. **Presença** ("online", "ausente" e "offline", P:833-835 e P:1173).
   - A. Sem presença (padrão).
   - B. Automática pela conexão do SSE: online com o Inbox aberto; ausente depois de N minutos sem interação; offline sem conexão.
     - Exige estado compartilhado entre processos (tabela `PresencaUsuario` com batimento, ou a escuta do Postgres).
     - Exige a regra do batimento sem `setInterval` no Inbox: a trava `sem-polling.test.ts` precisaria de exceção decidida.
   - C. Manual: a pessoa escolhe o status no menu do usuário. É um campo em `Usuario` ou uma tabela própria.
   - Para B e C: quem vê a presença de quem? A presença entra na distribuição automática (`RegraDistribuicao` RODIZIO e MENOR_CARGA)?
2. **Equipes e filas** (Fila Vendas B2C, Fila Corporativo e Pedagógico, P:834).
   - A. Equipes = setores (padrão). É o que a Task 1 entrega.
   - B. Subfilas dentro do setor: cadastro `EquipeAtendimento` (nome, setor, membros, regra de distribuição). Muda o escopo (`escopoAtendimentos`), a distribuição e os filtros.
   - Para B: o B2B vai para a fila "Corporativo" por regra (por exemplo, "acima de 5 vagas") ou por escolha manual?

**Steps**
- [ ] **Step 1:** levar as perguntas ao dono, com as capturas `prototipo-estado-transferir-passo1.png` e `atual-claro-admin-desktop-transferir.png`.
- [ ] **Step 2:** registrar a resposta na linha D6 do índice.
- [ ] **Step 3:**
  - se for A e A, fechar a issue, sem código;
  - senão, escrever as tasks no formato deste plano (arquivos, interfaces, migration na reserva `20261023350000`–`20261023360000`, testes, permissão, idempotência), com as issues `[Inbox E4.20+]`.
- [ ] **Step 4:** commit `docs(inbox): decisão D6 e tasks de presença e equipes (E4.17)`.

---

<a id="task-18"></a>
### Task 18: Spike: Insights (D12)

O protótipo tem a aba Insights (P:651-677) com:
- temperatura;
- chance de fechar (%);
- sentimento;
- melhor horário;
- intenção detectada;
- sinais de compra;
- objeções e riscos;
- "Próximo melhor passo", com "Usar como rascunho" ou "Assumir e usar como rascunho" (P:1165-1166).

Também tem "Escrever com Aria" no agendar (P:367, P:1095), que usa o mesmo texto.

No ERP:
- só existem `temperatura`, manual (`definirTemperatura`, `src/server/comercial/acoes.ts:299`), e o resumo executivo da oportunidade (`interesse`, `objetivo`, `urgencia`, `orcamento`, `objecao` e `proximaAcao`; `prisma/schema.prisma:1454-1460`; `atualizarResumo` em `acoes.ts:365`);
- `OrigemChamadaIA.RESUMO` existe sem gerador;
- nenhuma fase planeja Insights (`03-fase-inbox.md:1474`).

Pelo contrato, `abas/AbaInsights.tsx` é da E4, mas só depois desta decisão. Até lá, a aba "insights" de `IdAbaPainel` não aparece (D12 padrão: fora).

**Files:**
- Modify: `docs/superpowers/plans/2026-10-22-inbox-prototipo-00-indice.md` (linha D12)
- Modify: este plano (tasks a partir de E4.20, se a resposta pedir)

**Perguntas e opções**

1. **Entra?**
   - A. Fora (padrão).
   - B. Insights mínimos, sem IA nova:
     - a aba mostra a temperatura e o resumo executivo que já existem;
     - "Próximo melhor passo" é o `proximaAcao`;
     - "Usar como rascunho" põe o texto no compositor.
     - Só UI e leitura; a escrita é `atualizarResumo` e `definirTemperatura`. Sem migration.
   - C. Insights completos com geração:
     - modelo próprio (por exemplo, `InsightOportunidade`: chance, sentimento, melhor horário, sinais, riscos, próximo passo, texto sugerido, base e `geradoEm`);
     - gerador da Aria (`OrigemChamadaIA.RESUMO`);
     - gatilho e custo definidos;
     - migration na reserva `20261023330000`–`20261023340000`.
2. **Quando gera** (só C): a cada turno da Aria, a cada mensagem de entrada (com limite) ou sob demanda ("Atualizar")? O rodapé "Atualizado há 2 min" exige guardar `geradoEm`.
3. **Quem vê?** Todos os papéis do Inbox na finalidade comercial, ou só quem tem `funil.ver` (D13)?
4. **"Escrever com Aria" no agendar:** usa o mesmo "próximo passo" (B e C) ou fica fora?
5. **"Assumir e usar como rascunho":** depende de D3 (assumir com pausa). Vale o padrão da E3?

**Steps**
- [ ] **Step 1:** levar as perguntas ao dono, com `telas/prototipo-estado-painel-insights.png`.
- [ ] **Step 2:** registrar a resposta na linha D12 do índice.
- [ ] **Step 3:**
  - se for A, fechar a issue;
  - se for B, escrever uma task de UI (`abas/AbaInsights.tsx` mais o "Usar como rascunho"), com testes de marcação;
  - se for C, escrever as tasks de modelo e migration, do gerador (label `aria`) e da UI, no formato deste plano.
- [ ] **Step 4:** commit `docs(inbox): decisão D12 e tasks de Insights (E4.18)`.

---

<a id="task-19"></a>
### Task 19: Spike: catálogo no menu de anexos (D22, proposta)

O item "Catálogo" (P:1161, P:970) envia um PDF institucional. Para humanos, o ERP não tem fonte. A Aria envia materiais marcados como `FonteConhecimento.enviavelAoLead` (`prisma/schema.prisma:9700-9718`; `src/server/aria/tela.ts:16`).

**Files:**
- Modify: `docs/superpowers/plans/2026-10-22-inbox-prototipo-00-indice.md` (nova linha D22, conforme os acréscimos acima)
- Modify: este plano (task nova, se a resposta pedir)

**Perguntas e opções**
1. **Entra?**
   - A. Fora (padrão).
   - B. Sim, com a mesma fonte da Aria: arquivos `FonteConhecimento` do tipo ARQUIVO, `enviavelAoLead`, não arquivados e dentro de `validoAte`. Lista no menu e copia para `whatsapp-out` como na Task 7. Sem migration.
   - C. Sim, com cadastro próprio: nova categoria de `Documento` (`CATALOGO`) ou tabela de materiais. Migration na reserva `20261023370000`.
2. **Quem pode enviar?** Todos os papéis do Inbox ou só o comercial?
3. **O catálogo também entra no anexo do agendamento** (Task 16)?

**Steps**
- [ ] **Step 1:** levar as perguntas ao dono.
- [ ] **Step 2:** registrar D22 no índice.
- [ ] **Step 3:** se for B ou C, escrever a task (label `ui` mais `back-end`) no formato deste plano.
- [ ] **Step 4:** commit `docs(inbox): decisão D22 sobre catálogo no anexo (E4.19)`.

---

## Self-review (feito)

**Cobertura da spec:**
- **T01, L13 e L14 (nova conversa):** Tasks 2 e 13.
- **T05 e C4–C8, C10, A16 (transferir):** Tasks 1, 10, 11 e 12, mais a Task 17 para presença e equipes. "Seguir conversa" fica fora (D19).
- **T16 e F14–F25 (agendar):** Task 4. F17 e F24 estão na Task 16 e F22 na Task 14. F15 depende da Task 18. F23 fica fora.
- **T17 e T7–T11 (cartões):**
  - T7 e T10: Task 5;
  - T8 (editar): Tasks 4 (reagendar) e 15 (texto);
  - T9: Tasks 3 e 5;
  - T11: Task 14.
- **A21 (`?agendar=1`):** Task 4.
- **T18 e F5–F13 (anexos):**
  - F7 e F13: Task 6;
  - F11: Task 7;
  - F9 e F10, mais Enquete: Tasks 8 e 9;
  - F12: Task 19.
- **T21 (modelos aprovados):** Task 13, na linha "Se a decisão vier diferente".
- **P31, A14 e B10 (Insights):** Task 18.
- **B6, parte de back-end:**
  - "perguntar se responder": Task 14;
  - editar o texto: Task 15;
  - anexo: Task 16.
- **Lacuna de tempo real das agendadas** (parte 2, §13): Task 3.

**Consistência de tipos:**
- `AgendadaNoFio` é definida na Task 3 e estendida na 14 (`perguntaPendente`).
- `OpcoesAlterarAgendada` é usada nas Tasks 3, 14 e 15.
- `PropostaAnexavel` e `exigirPropostaVisivel` vêm da Task 7 e são reusadas na 16.
- `resumoDaAriaParaNota` vem da Task 10 e é reusada na 11.
- `RegrasTransferir` é da Task 1; as Tasks 10, 11 e 12 só mudam `REGRAS_TRANSFERIR_PADRAO`.
- `ConteudoEspecial` está em `canal.ts:48`.
- `ContatoCartao` é da Task 9.
- `ItemListaInbox.setoresDoNumero`, `responsavelId` e `numeroDonoId` estão em `consultas-pagina.ts:18-24`.

**Review Focus:** os cinco itens têm teste na task dona (Tasks 1, 3, 4 e 5).

---

## Issues

Todas com as labels `inbox` e `etapa-4`. As tasks 10–19 também levam `bloqueado-por-decisao`. O link é relativo a `docs/superpowers/plans/2026-10-22-inbox-prototipo-05-fluxos.md`. O arquivo para criação em lote é `2026-10-22-inbox-prototipo-05-fluxos.issues.json`.

### [Inbox E4.1] Transferir com a UI nova e as regras atuais
- **Labels:** `inbox`, `etapa-4`, `ui`
- **Objetivo:** juntar transferir para setor, atribuir, devolver para a fila e devolver para a Aria no popover de 2 passos do protótipo, com as regras atuais (D5 e D6 padrão).
- **Plano:** `#task-1`
- **Arquivos:** `src/app/(app)/inbox/fluxos/PopoverFluxo.tsx`, `fluxos/transferir/{opcoes-transferir.ts,PopoverTransferir.tsx}`, `CabecalhoConversa.tsx`, `InboxNovo.tsx`, mapas de trava.
- **Aceite:** testes de `opcoes-transferir.test.ts` e `PopoverTransferir.test.ts` (inclusive `transferir manda a chave da tentativa e não a troca no erro`); travas de botões, estados vazios e diálogos; aceite visual com `transferir-passo1/2` e `celular-sheet-transferir`.
- **Dependências:** Etapa 1 (`CabecalhoConversa`, `MenuConversa`).

### [Inbox E4.2] Nova conversa com o fluxo atual de abrir atendimento
- **Labels:** `inbox`, `etapa-4`, `ui`
- **Objetivo:** trocar o formulário `NovoAtendimento` pelo popover "Nova conversa" do protótipo, com busca nas conversas e nos destinos, usando `abrirAtendimentoInstitucional` (D9 padrão).
- **Plano:** `#task-2`
- **Arquivos:** `fluxos/nova-conversa/{busca-nova-conversa.ts,PopoverNovaConversa.tsx}`, `ColunaConversas.tsx`, `InboxNovo.tsx`, `page.tsx`; apagar `NovoAtendimento.*`.
- **Aceite:** testes de `busca-nova-conversa.test.ts` e `PopoverNovaConversa.test.ts` (casos portados de `NovoAtendimento.test.ts`); `page.test.ts`; aceite visual com `nova-conversa` e `nova-conversa-numero`.
- **Dependências:** Etapa 1 (`ColunaConversas`).

### [Inbox E4.3] Agendadas no servidor: aviso em tempo real, consulta, reagendar e enviar agora pelo atendimento
- **Labels:** `inbox`, `etapa-4`, `back-end`
- **Objetivo:** consulta das agendadas do atendimento, wrappers de reagendar e enviar agora com idempotência, operação por quem agendou sem `tarefas.ver` e trigger de aviso (migration `20261023300000`).
- **Plano:** `#task-3`
- **Arquivos:** `prisma/migrations/20261023300000_inbox_aviso_agendada`, `src/server/crm/mensagens-agendadas.ts`, `src/server/whatsapp/{acoes-conversa.ts,consultas-acoes-atendimento.ts}`.
- **Aceite:** `agendamento.int.test.ts` (inclusive `gerente pedagógico que agendou reagenda, envia agora e cancela pelo atendimento`, `mesma chave no reagendar e no enviar agora grava um Evento só` e `atendimento encerrado: recusa reagendar e a agendada sai da lista`); `barramento.int.test.ts` (aviso da agendada).
- **Dependências:** nenhuma.

### [Inbox E4.4] Popover "Agendar mensagem"
- **Labels:** `inbox`, `etapa-4`, `ui`
- **Objetivo:** agendar com rascunho, respostas rápidas, atalhos de horário no fuso, erro de horário passado, conflito de 2 h, salvar rascunho, editar (reagendar) e `?agendar=1` (D11 padrão).
- **Plano:** `#task-4`
- **Arquivos:** `src/lib/atalhos-horario.ts`, `fluxos/agendar/{validar-quando.ts,conflito.ts,PopoverAgendar.tsx}`, `Compositor.tsx`, `RodapeConversa.tsx`, `CabecalhoConversa.tsx`, `page.tsx`, `InboxNovo.tsx`.
- **Aceite:** `atalhos-horario.test.ts` (fuso, 18h e segunda), `conflito.test.ts`, `PopoverAgendar.test.ts` (inclusive `erro do servidor (horário de silêncio) fica no popover e o texto não se perde`), `page.test.ts`, `InboxNovo.interacao.test.ts`; aceite visual com `agendar`, `agendar-conflito`, `agendar-erro-passado` e `agendar-deeplink`.
- **Dependências:** E4.3; Etapa 1.

### [Inbox E4.5] Cartões de mensagens agendadas no fio
- **Labels:** `inbox`, `etapa-4`, `ui`
- **Objetivo:** cartão por agendada pendente no fio, com Editar, Enviar agora e Cancelar (com confirmação), recarregado pelo SSE.
- **Plano:** `#task-5`
- **Arquivos:** `fluxos/agendar/{quando-agendada.ts,useAgendadas.ts,CartaoAgendada.tsx}`, `InboxNovo.tsx`, o fio da E1.
- **Aceite:** `quando-agendada.test.ts`, `CartaoAgendada.test.ts`, `InboxNovo.interacao.test.ts` (`aviso do SSE do atendimento aberto recarrega os cartões`); `confirmacoes.test.ts`; aceite visual com `fio-agendada-*`.
- **Dependências:** E4.3, E4.4.

### [Inbox E4.6] Anexos: câmera e resposta rápida
- **Labels:** `inbox`, `etapa-4`, `ui`
- **Objetivo:** menu de anexos na ordem do protótipo, com Câmera (`capture`) e Resposta rápida, sem perder Enquete.
- **Plano:** `#task-6`
- **Arquivos:** `src/components/conversa/{itens-anexo.ts,Compositor.tsx}`.
- **Aceite:** `Compositor.test.ts` ("itens de anexo (E4.6)"); aceite visual com `anexos`.
- **Dependências:** Etapa 1 (compositor).

### [Inbox E4.7] Anexo de proposta da oportunidade
- **Labels:** `inbox`, `etapa-4`, `back-end`
- **Objetivo:** enviar pelo Inbox um documento PROPOSTA da oportunidade da conversa, com cópia para `whatsapp-out`, idempotência e Evento.
- **Plano:** `#task-7`
- **Arquivos:** `src/server/whatsapp/{proposta-atendimento.ts,midia.ts,consultas-acoes-atendimento.ts,acoes-conversa.ts}`, `Compositor.tsx`.
- **Aceite:** `proposta-atendimento.int.test.ts`; `Compositor.test.ts` (Proposta e vazio); estados vazios; aceite visual com `anexos-proposta`.
- **Dependências:** E4.6.

### [Inbox E4.8] Enquete e localização pelo menu de anexos
- **Labels:** `inbox`, `etapa-4`, `motor`
- **Objetivo:** ligar Enquete e Localização a `enviarConteudoInbox` (o motor já suporta), com formulários e leitura de coordenadas.
- **Plano:** `#task-8`
- **Arquivos:** `src/components/conversa/anexos/{coordenadas.ts,FormEnquete.tsx,FormLocalizacao.tsx}`, `Compositor.tsx`.
- **Aceite:** `coordenadas.test.ts`, `FormEnquete.test.ts`, `Compositor.test.ts`; `motor/conteudo.int.test.ts` continua verde; aceite visual com `anexo-enquete` e `anexo-localizacao`.
- **Dependências:** E4.6; motor conectado para o uso real.

### [Inbox E4.9] Cartão de contato com os números da escola
- **Labels:** `inbox`, `etapa-4`, `motor`
- **Objetivo:** ligar o item Contato ao conteúdo CONTATO do motor, com os números ativos da escola como fonte.
- **Plano:** `#task-9`
- **Arquivos:** `src/server/whatsapp/consultas-acoes-atendimento.ts`, `Compositor.tsx`.
- **Aceite:** `consultas-acoes-atendimento.int.test.ts` (`contatosParaCartao`), `Compositor.test.ts`.
- **Dependências:** E4.6, E4.8 (`aoEnviarConteudo`).

### [Inbox E4.10] Contexto opcional e resumo da Aria na transferência (D5)
- **Labels:** `inbox`, `etapa-4`, `back-end`, `bloqueado-por-decisao`
- **Objetivo:** contexto opcional na transferência entre setores e nota com o resumo do último handoff da Aria.
- **Plano:** `#task-10`
- **Arquivos:** `src/server/aria/resumo-nota.ts`, `src/server/whatsapp/{acoes-atendimento.ts,consultas-acoes-atendimento.ts}`, `fluxos/transferir/*`.
- **Aceite:** `transferencia.int.test.ts` (contexto vazio, resumo, sem handoff, conflito de chave); testes do popover.
- **Dependências:** D5; E4.1.

### [Inbox E4.11] Transferir para pessoa por quem atende (D5)
- **Labels:** `inbox`, `etapa-4`, `back-end`, `bloqueado-por-decisao`
- **Objetivo:** o responsável passa a conversa para um colega do setor, numa ação atômica com contexto e resumo opcionais, sem mexer na carteira.
- **Plano:** `#task-11`
- **Arquivos:** `src/server/whatsapp/{acoes-atendimento.ts,consultas-acoes-atendimento.ts}`, `fluxos/transferir/*`.
- **Aceite:** `transferir-pessoa.int.test.ts`; `atribuicao.int.test.ts` continua verde; `opcoes-transferir.test.ts`.
- **Dependências:** D5; E4.1, E4.10.

### [Inbox E4.12] Carga por pessoa no Transferir (D6)
- **Labels:** `inbox`, `etapa-4`, `back-end`, `bloqueado-por-decisao`
- **Objetivo:** mostrar "N conversas" abertas de cada pessoa no Transferir.
- **Plano:** `#task-12`
- **Arquivos:** `src/server/whatsapp/consultas-acoes-atendimento.ts`, `fluxos/transferir/*`.
- **Aceite:** teste de integração de `cargaDasPessoas`; `PopoverTransferir.test.ts`.
- **Dependências:** D6; E4.1.

### [Inbox E4.13] Iniciar conversa por número novo (D9)
- **Labels:** `inbox`, `etapa-4`, `back-end`, `bloqueado-por-decisao`
- **Objetivo:** com um número digitado, criar Pessoa e oportunidade em Novo ("Prospecção ativa") e abrir a conversa pela linha comercial (migration `20261023320000`).
- **Plano:** `#task-13`
- **Arquivos:** `prisma/migrations/20261023320000_origem_prospeccao_ativa`, `prisma/schema.prisma`, `src/lib/labels.ts`, `src/server/whatsapp/nova-conversa.ts`, `fluxos/nova-conversa/*`.
- **Aceite:** `nova-conversa.int.test.ts`; `enums-rotulos.test.ts`; `PopoverNovaConversa.test.ts`; aceite visual com `nova-conversa-numero`.
- **Dependências:** D9; E4.2.

### [Inbox E4.14] Perguntar antes de enviar se o contato responder (D11)
- **Labels:** `inbox`, `etapa-4`, `back-end`, `bloqueado-por-decisao`
- **Objetivo:** reter a agendada quando o contato escreve depois de agendar e perguntar no cartão se ainda deve sair (migration `20261023310000`).
- **Plano:** `#task-14`
- **Arquivos:** `prisma/migrations/20261023310000_agendada_perguntar_se_responder`, `prisma/schema.prisma`, `src/server/crm/mensagens-agendadas.ts`, `src/server/whatsapp/{despachante.ts,acoes-conversa.ts,consultas-acoes-atendimento.ts}`, `fluxos/agendar/*`.
- **Aceite:** `despachante-agendada.int.test.ts` e `agendamento.int.test.ts` (retém, não retém, manter, enviar agora, cancelar); testes do cartão e do popover.
- **Dependências:** D11; E4.3, E4.5.

### [Inbox E4.15] Editar o texto da mensagem agendada (D11)
- **Labels:** `inbox`, `etapa-4`, `back-end`, `bloqueado-por-decisao`
- **Objetivo:** editar texto e horário de uma agendada HUMANO pelo atendimento, com Evento e idempotência.
- **Plano:** `#task-15`
- **Arquivos:** `src/server/crm/mensagens-agendadas.ts`, `src/server/whatsapp/acoes-conversa.ts`, `fluxos/agendar/PopoverAgendar.tsx`.
- **Aceite:** `agendamento.int.test.ts` (edição); `PopoverAgendar.test.ts`.
- **Dependências:** D11; E4.3, E4.4.

### [Inbox E4.16] Anexo e vínculo no agendamento (D11)
- **Labels:** `inbox`, `etapa-4`, `back-end`, `bloqueado-por-decisao`
- **Objetivo:** agendar com anexo (proposta ou arquivo) e vincular a oportunidade ou tarefa aberta.
- **Plano:** `#task-16`
- **Arquivos:** `src/server/crm/mensagens-agendadas.ts`, `src/server/whatsapp/{acoes-conversa.ts,consultas-acoes-atendimento.ts}`, `fluxos/agendar/*`.
- **Aceite:** `agendamento.int.test.ts` e `despachante-agendada.int.test.ts` (anexo e vínculo); `PopoverAgendar.test.ts`; aceite visual com `agendar-mais-opcoes`.
- **Dependências:** D11; E4.4, E4.7.

### [Inbox E4.17] Spike: presença e equipes no Transferir (D6)
- **Labels:** `inbox`, `etapa-4`, `back-end`, `bloqueado-por-decisao`
- **Objetivo:** levar ao dono as opções de presença (nenhuma, automática ou manual) e de equipes (setores ou subfilas) e transformar a resposta em tasks.
- **Plano:** `#task-17`
- **Arquivos:** índice (D6); este plano.
- **Aceite:** D6 registrada no índice; tasks escritas ou issue fechada.
- **Dependências:** D6.

### [Inbox E4.18] Spike: Insights (D12)
- **Labels:** `inbox`, `etapa-4`, `aria`, `bloqueado-por-decisao`
- **Objetivo:** decidir se os Insights entram (fora, mínimos com os dados atuais ou completos com geração) e transformar a resposta em tasks (`abas/AbaInsights.tsx`).
- **Plano:** `#task-18`
- **Arquivos:** índice (D12); este plano.
- **Aceite:** D12 registrada; tasks escritas ou issue fechada.
- **Dependências:** D12.

### [Inbox E4.19] Spike: catálogo no menu de anexos (D22)
- **Labels:** `inbox`, `etapa-4`, `ui`, `bloqueado-por-decisao`
- **Objetivo:** propor D22 e decidir a fonte do item "Catálogo" (fora, materiais da Aria ou cadastro próprio).
- **Plano:** `#task-19`
- **Arquivos:** índice (D22); este plano.
- **Aceite:** D22 registrada; task escrita ou issue fechada.
- **Dependências:** D22; E4.6.
