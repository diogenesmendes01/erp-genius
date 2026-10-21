# SLA: contagem só no horário de atendimento e alertas de prazo estourado — Plano de Implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** ligar os dois campos que a Task 39 (5F) só grava (`contarSoNoHorario`, `alertarResponsavel` e `alertarGerente`): o prazo da 1ª resposta passa a contar só dentro do horário do setor, e o prazo estourado gera um aviso no app, uma única vez por atendimento.

**Arquitetura:** o horário de atendimento fica em `PrazoRespostaSetor.horario` (JSON validado por Zod, um calendário por setor). Uma função pura, `prazoVenceEm`, calcula o vencimento no fuso da escola, e `aplicarInbound` passa a usá-la, por isso filtros, lista e relatórios ("prazo estourado") herdam o comportamento sem mudança. Um enfileirador novo no `/api/whatsapp/cron` faz o claim atômico (`slaAlertadoEm` nulo → agora, como em `rodarLembretesTarefas`), cria `NotificacaoUsuario` do tipo `SLA_ESTOURADO` para os destinatários e registra `Evento` na mesma transação. O `UPDATE` em `AtendimentoWhatsApp` já dispara o trigger `notificar_inbox` (`atendimento.atualizado`), e o SSE do inbox repassa o aviso a quem enxerga o atendimento.

**Tech Stack:** Next.js (App Router, Server Actions), Prisma/Postgres, Zod, Vitest (`node_modules/.bin/vitest run`; integração: `npm run test:int -- <arquivo>`).

**Spec:** `planejamento/plano/05-fase-ia-relatorios-config.md` (Task 39, pendência P5; R1 da Task 39 em `docs/planejamento/quadro-entregas.md:3348`: "o plano 05 não define o efeito de `alertarResponsavel`, `alertarGerente` e `contarSoNoHorario`"); `planejamento/02-modelo-atendimento-crm-erp.md` E3.3 (prazo configurável por setor) e E7 (filtro "prazo estourado"); `docs/33-diagnostico-projeto-papeis-erp-crm-whatsapp.md:149` ("SLA de primeira resposta humana … com horário de atendimento").

## Restrições globais

- Migration única: `prisma/migrations/20261018090000_sla_horario_alertas/` (a última no origin/main é `20261018080000_aria_triagem_shadow_sem_atendimento`; antes de criar, confira de novo com `git ls-tree --name-only origin/main prisma/migrations/`).
- Trava `src/server/crm-config/auditoria.test.ts`: toda função exportada de `src/server/crm-config/*.ts` que grava registra `Evento` com `registrarEvento(tx, …)` dentro da transação. Funções puras (sync) não entram na trava. Leitura async nova em crm-config entra em `SOMENTE_LEITURA`. A mesma regra vale para o cron (docs/13).
- Canal só dentro do app: `NotificacaoUsuario` mais o SSE existente (`/api/inbox/eventos`). **Nada de WhatsApp nem e-mail.** Não reaproveitar o "alerta de SLA" da régua de gestão (`cron-gestao`, WhatsApp do gestor).
- Fuso: `ConfiguracaoOperacional.fusoInstitucional`, lido por `fusoDaEscola()` (`src/server/relatorios/atendimento.ts`, padrão `America/Sao_Paulo`). Horários do calendário são hora civil nesse fuso.
- Prazo é **gravado uma vez** (`prazoRespostaEm`, no 1º inbound). Mudar config não recalcula atendimentos abertos.
- Sem horário cadastrado ou com `contarSoNoHorario = false`, a contagem é corrida (comportamento de hoje), sem mudança silenciosa.
- Textos da tela em português, sem "em breve" restante para estes campos.

## Review Focus

1. **Inbound fora do horário (noite, sábado):** o relógio começa na próxima abertura. Ex.: sex 19:00, seg–sex 08–18, 60 min → vence seg 09:00. → teste `fora_do_horario_comeca_na_proxima_abertura` (Task 1).
2. **Prazo que atravessa o fechamento:** sobra do dia passa para o dia útil seguinte (17:30 + 60 min → próximo dia 08:30). → `atravessa_o_fechamento` (Task 1).
3. **Duas notificações na mesma transação:** `NotificacaoUsuario @@unique([tipo, refId, criadaEm])` com `criadaEm = now()` (igual dentro da transação) faz o 2º destinatário (gerente) violar a unique. → migration inclui `usuarioId` na unique; teste `responsavel_e_gerente_recebem_um_cada` (Task 4).
4. **Ligar alertas com fila antiga estourada:** o 1º tick não pode inundar o sino com estouros de dias atrás. → janela de 24 h e claim mesmo com alertas desligados; testes `alertas_desligados_marcam_sem_notificar` e `estouro_antigo_fora_da_janela_nao_alerta` (Task 4).
5. **Marcar como lida uma notificação de SLA:** `marcarNotificacaoLida` grava `agregadoTipo: "Tarefa"` fixo, e o sino abre `/tarefas`. Para SLA deve usar `AtendimentoWhatsApp` e abrir `/inbox?c=<id>`. → `lida_de_sla_audita_no_atendimento` (Task 5).

---

### Task 1: Calendário de atendimento e `prazoVenceEm` (puro)

**Files:**
- Create: `src/server/crm-config/horario-atendimento.ts`
- Test: `src/server/crm-config/horario-atendimento.test.ts`

**Interfaces:**
- Produces:
  - `HorarioAtendimentoSchema = z.object({ intervalos: z.array(z.object({ dia: z.number().int().min(0).max(6) /* 0 = domingo */, inicio: HHMM, fim: HHMM })).max(28), feriados: z.array(DataCivilSchema).max(366).default([]) }).strict()` com refinamentos `inicio < fim` e sem sobreposição no mesmo dia.
  - `type HorarioAtendimento = z.infer<typeof HorarioAtendimentoSchema>`
  - `prazoVenceEm(inicio: Date, minutos: number, calendario: HorarioAtendimento | null, fuso: string): Date`. Com `calendario` nulo ou sem intervalos, soma corrida.
  - `dentroDoHorario(instante: Date, calendario: HorarioAtendimento, fuso: string): boolean` (para o "fora do horário" dos Relatórios, P5).

- [ ] **Step 1: Escrever os testes que falham** (`util` = seg–sex 08:00–18:00, `fuso = "America/Sao_Paulo"`, instantes em UTC −03:00)

```ts
it("sem_calendario_conta_corrido", () => expect(prazoVenceEm(d("2026-10-16T19:00-03:00"), 60, null, fuso)).toEqual(d("2026-10-16T20:00-03:00")));
it("dentro_do_horario_soma_simples", () => expect(prazoVenceEm(d("2026-10-19T09:10-03:00"), 30, util, fuso)).toEqual(d("2026-10-19T09:40-03:00")));
it("fora_do_horario_comeca_na_proxima_abertura", () => expect(prazoVenceEm(d("2026-10-16T19:00-03:00"), 60, util, fuso)).toEqual(d("2026-10-19T09:00-03:00")));
it("atravessa_o_fechamento", () => expect(prazoVenceEm(d("2026-10-19T17:30-03:00"), 60, util, fuso)).toEqual(d("2026-10-20T08:30-03:00")));
it("intervalo_de_almoco_pausa", () => expect(prazoVenceEm(d("2026-10-19T11:30-03:00"), 60, comAlmoco /* 08-12, 13-18 */, fuso)).toEqual(d("2026-10-19T13:30-03:00")));
it("feriado_pula_o_dia", () => expect(prazoVenceEm(d("2026-11-19T17:00-03:00"), 120, { ...util, feriados: ["2026-11-20"] }, fuso)).toEqual(d("2026-11-23T09:00-03:00")));
it("1440_min_em_horario_comercial_sao_2_4_dias_uteis", () => expect(prazoVenceEm(d("2026-10-19T08:00-03:00"), 1440, util, fuso)).toEqual(d("2026-10-21T12:00-03:00")));
it("outro_fuso", () => expect(prazoVenceEm(d("2026-10-19T07:30-06:00"), 30, util, "America/Costa_Rica")).toEqual(d("2026-10-19T08:30-06:00")));
it("calendario_sem_intervalos_conta_corrido", () => expect(prazoVenceEm(d("2026-10-19T09:00-03:00"), 15, { intervalos: [], feriados: [] }, fuso)).toEqual(d("2026-10-19T09:15-03:00")));
it("schema_rejeita_fim_antes_do_inicio_e_sobreposicao", () => { expect(HorarioAtendimentoSchema.safeParse({ intervalos: [{ dia: 1, inicio: "18:00", fim: "08:00" }] }).success).toBe(false); expect(HorarioAtendimentoSchema.safeParse({ intervalos: [{ dia: 1, inicio: "08:00", fim: "12:00" }, { dia: 1, inicio: "11:00", fim: "14:00" }] }).success).toBe(false); });
it("dentro_do_horario", () => { expect(dentroDoHorario(d("2026-10-19T10:00-03:00"), util, fuso)).toBe(true); expect(dentroDoHorario(d("2026-10-18T10:00-03:00"), util, fuso)).toBe(false); });
```

- [ ] **Step 2: Rodar e ver falhar**: `node_modules/.bin/vitest run src/server/crm-config/horario-atendimento.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3: Implementar.** Algoritmo: converter `inicio` em data civil local (`dataHoraAvaliacaoLocal` de `src/server/avaliacoes/tempo.ts`). Percorrer dia a dia, no máximo 400 dias, senão erro. Pular feriados. Para cada intervalo do dia da semana, em ordem, converter início e fim com `instanteDaGrade` (`src/server/agenda/grade.ts`). Se a hora não existe ou é ambígua por horário de verão, avançar 1 h e usar o primeiro candidato, sem lançar erro. Consumir `min(restante, fim − max(cursor, início))`.
- [ ] **Step 4: Rodar e ver passar** com o mesmo comando → PASS. Rodar também `node_modules/.bin/vitest run src/server/crm-config/auditoria.test.ts` → PASS (as funções são sync).
- [ ] **Step 5: Commit** `git add src/server/crm-config/horario-atendimento*` · `git commit -m "feat(sla): calendário de atendimento e prazoVenceEm no fuso da escola"`

### Task 2: Migration, schema e gravação do horário

**Files:**
- Create: `prisma/migrations/20261018090000_sla_horario_alertas/migration.sql`
- Modify: `prisma/schema.prisma` (`PrazoRespostaSetor`, `AtendimentoWhatsApp`, `NotificacaoUsuario`, `enum TipoNotificacao`), `src/server/crm-config/sla.ts`, `src/server/crm-config/acoes-distribuicao.ts` (fronteira repassa `horario`)
- Test: `src/server/crm-config/sla.int.test.ts` (crie, ou acrescente se já existir), `src/test/schema*.test.ts` (padrão `modelTem`)

**Interfaces:**
- Consumes: `HorarioAtendimentoSchema` (Task 1).
- Produces (Prisma): `PrazoRespostaSetor.horario Json?`; `AtendimentoWhatsApp.slaAlertadoEm DateTime?`; `TipoNotificacao.SLA_ESTOURADO`; `NotificacaoUsuario @@unique([tipo, refId, usuarioId, criadaEm])`.
- Produces (TS): `EntradaSla` ganha `horario: HorarioAtendimento | null`; `aplicarSlaSetor` compara e grava `horario`; o payload de `SlaAlterado` inclui `horario` em `de` e `para`.

SQL (só estrutura, sem `UPDATE` de dados, para não disparar `notificar_inbox` em massa):

```sql
ALTER TYPE "TipoNotificacao" ADD VALUE 'SLA_ESTOURADO';
ALTER TABLE "PrazoRespostaSetor" ADD COLUMN "horario" JSONB;
ALTER TABLE "AtendimentoWhatsApp" ADD COLUMN "slaAlertadoEm" TIMESTAMP(3);
CREATE INDEX "AtendimentoWhatsApp_sla_pendente_idx" ON "AtendimentoWhatsApp"("prazoRespostaEm")
  WHERE "primeiraRespostaEm" IS NULL AND "slaAlertadoEm" IS NULL AND "status" <> 'ENCERRADO';
DROP INDEX "NotificacaoUsuario_tipo_refId_criadaEm_key";
CREATE UNIQUE INDEX "NotificacaoUsuario_tipo_refId_usuarioId_criadaEm_key" ON "NotificacaoUsuario"("tipo", "refId", "usuarioId", "criadaEm");
```

- [ ] **Step 1: Testes que falham**

```ts
it("schema_tem_campos_sla", () => { expect(modelTem("PrazoRespostaSetor", "horario")).toBe(true); expect(modelTem("AtendimentoWhatsApp", "slaAlertadoEm")).toBe(true); });
// int
it("grava_horario_e_audita", async () => { logado(admin); expect((await salvarSlaSetor({ ...sla, horario: util })).ok).toBe(true); expect((await prisma.prazoRespostaSetor.findUnique({ where: { finalidade: "COMERCIAL" } }))!.horario).toEqual(util); expect((await ultimoEvento("SlaAlterado")).payload).toMatchObject({ para: { horario: util } }); });
it("horario_invalido_recusado_sem_evento", async () => { logado(admin); const n = await contarEventos("SlaAlterado"); expect((await salvarSlaSetor({ ...sla, horario: { intervalos: [{ dia: 1, inicio: "18:00", fim: "08:00" }], feriados: [] } })).ok).toBe(false); expect(await contarEventos("SlaAlterado")).toBe(n); });
it("mesmo_horario_nao_gera_evento_vazio", async () => { logado(admin); await salvarSlaSetor({ ...sla, horario: util }); const n = await contarEventos("SlaAlterado"); await salvarSlaSetor({ ...sla, horario: util }); expect(await contarEventos("SlaAlterado")).toBe(n); });
```

- [ ] **Step 2:** `node_modules/.bin/vitest run src/test && npm run test:int -- src/server/crm-config/sla.int.test.ts` → FAIL.
- [ ] **Step 3:** Migration acima, `npx prisma generate`, schema Zod com `horario: HorarioAtendimentoSchema.nullable()`. A comparação de "mudou?" usa JSON canônico, com intervalos ordenados por `dia` e `inicio`.
- [ ] **Step 4:** Mesmo comando → PASS. Rodar também `auditoria.test.ts` → PASS.
- [ ] **Step 5:** `git commit -m "feat(sla): horário de atendimento por setor e campos de alerta (migration 20261018090000)"`

### Task 3: Prazo do atendimento respeita o horário

**Files:**
- Modify: `src/server/whatsapp/status-atendimento.ts:20-23` (`prazoRespostaEm`), `src/server/relatorios/atendimento.ts:23` (`fusoDaEscola(db = prisma)`, lendo pelo `tx` do chamador)
- Test: `src/server/whatsapp/status-atendimento.int.test.ts`

**Interfaces:**
- Consumes: `prazoVenceEm`, `HorarioAtendimentoSchema` (Task 1); `PrazoRespostaSetor.horario` (Task 2).
- Produces: `prazoRespostaEm(db, finalidade, inicio): Promise<Date | null>` (mesma assinatura). Lê `minutos`, `contarSoNoHorario` e `horario`. Usa o calendário só se `contarSoNoHorario && horario` passar no schema. Horário corrompido conta corrido, e um `console.warn` registra o caso.

- [ ] **Step 1: Testes que falham**

```ts
it("inbound_sexta_noite_vence_segunda", async () => { await sla("COMERCIAL", { minutos: 60, contarSoNoHorario: true, horario: util }); const a = await abrirComercial(); await aplicarInbound(prisma, a.id, d("2026-10-16T19:00-03:00")); expect((await le(a.id)).prazoRespostaEm).toEqual(d("2026-10-19T09:00-03:00")); });
it("flag_desligada_conta_corrido", async () => { await sla("COMERCIAL", { minutos: 60, contarSoNoHorario: false, horario: util }); /* … */ expect(prazo).toEqual(d("2026-10-16T20:00-03:00")); });
it("sem_horario_conta_corrido", async () => { await sla("COMERCIAL", { minutos: 60, contarSoNoHorario: true, horario: null }); /* … */ expect(prazo).toEqual(d("2026-10-16T20:00-03:00")); });
it("filtro_prazo_estourado_usa_o_prazo_util", async () => { /* inbound sex 19:00, agora = sáb 12:00 */ expect(await idsComFiltro({ prazoEstourado: true }, agoraSabado)).not.toContain(a.id); });
```

- [ ] **Step 2:** `npm run test:int -- src/server/whatsapp/status-atendimento.int.test.ts` → FAIL.
- [ ] **Step 3:** Implementar como descrito em Interfaces. Se `consultas-pagina.ts:64` usa `new Date()` fixo, o último teste pode precisar de `vi.setSystemTime`.
- [ ] **Step 4:** O mesmo comando → PASS. Rodar `node_modules/.bin/vitest run src/server/whatsapp` → PASS.
- [ ] **Step 5:** `git commit -m "feat(sla): prazo da 1ª resposta conta só no horário do setor"`

### Task 4: Alerta de prazo estourado (cron)

**Files:**
- Create: `src/server/whatsapp/alertas-sla.ts`
- Modify: `src/app/api/whatsapp/cron/route.ts` (novo `seguro("alertas_sla", () => rodarAlertasSla(agora))` depois de `lembretesTarefas`, com chave `alertasSla` no JSON), `src/server/_shared/evento.ts` (o tipo `SlaEstouradoAlertado`, se houver união de tipos)
- Test: `src/server/whatsapp/alertas-sla.test.ts` (puro) e `src/server/whatsapp/alertas-sla.int.test.ts`; acrescentar a chave em `src/app/api/whatsapp/cron/route.test.ts`

**Interfaces:**
- Produces:
  - `JANELA_ALERTA_SLA_MS = 24 * 60 * 60_000`
  - `destinatariosAlertaSla(i: { responsavelId: string | null; alertarResponsavel: boolean; alertarGerente: boolean; gerentesIds: string[]; adminsIds: string[] }): string[]` (pura, sem repetição). Responsável, se `alertarResponsavel`. Gerentes do setor, se `alertarGerente`. **Sem responsável e `alertarResponsavel` ligado:** cai para os gerentes, ou para os administradores se o setor não tiver gerente.
  - `GERENTE_DO_SETOR: Record<Setor, Papel[]> = { COMERCIAL: [GERENTE_COMERCIAL], PEDAGOGICO: [GERENTE_PEDAGOGICO], FINANCEIRO: [ADMINISTRADOR], SECRETARIA: [ADMINISTRADOR] }`
  - `rodarAlertasSla(agora: Date): Promise<{ alertados: number; notificacoes: number }>`
  - Evento `SlaEstouradoAlertado` (agregado `AtendimentoWhatsApp`, `autorId: null`), com payload `{ finalidade, prazoRespostaEm, responsavelId, destinatarios: string[] }`.

Claim, numa transação (mesmo padrão de `src/server/crm/lembretes.ts`):

```sql
UPDATE "AtendimentoWhatsApp" a SET "slaAlertadoEm" = ${agora}
FROM "ConversaWhatsApp" c
WHERE c.id = a."conversaId" AND c."grupoId" IS NULL
  AND a.status <> 'ENCERRADO' AND a."primeiraRespostaEm" IS NULL AND a."slaAlertadoEm" IS NULL
  AND a."prazoRespostaEm" <= ${agora} AND a."prazoRespostaEm" > ${agora - JANELA}
  AND NOT EXISTS (SELECT 1 FROM "MensagemWhatsApp" m WHERE m."atendimentoId" = a.id AND m.direcao = 'SAIDA' AND m.origem = 'IA')
RETURNING a.id, a.finalidade, a."responsavelId", a."prazoRespostaEm"
```

(Confira os nomes reais de `direcao` e `origem` no schema.) Para cada linha reclamada, crie uma `NotificacaoUsuario` por destinatário (`tipo: SLA_ESTOURADO`, `refTipo: "AtendimentoWhatsApp"`, título `"Prazo estourado: <nome do contato> (<setor>)"`) e registre um `SlaEstouradoAlertado`, **mesmo com zero destinatários**. A linha fica marcada e não é avaliada de novo. O `UPDATE` dispara `notificar_inbox`, e o SSE avisa quem está no escopo.

- [ ] **Step 1: Testes que falham**

```ts
// puro
it("responsavel_e_gerente", () => expect(destinatariosAlertaSla({ responsavelId: "v1", alertarResponsavel: true, alertarGerente: true, gerentesIds: ["g1"], adminsIds: ["ad"] })).toEqual(["v1", "g1"]));
it("sem_responsavel_cai_no_gerente", () => expect(destinatariosAlertaSla({ responsavelId: null, alertarResponsavel: true, alertarGerente: false, gerentesIds: ["g1"], adminsIds: ["ad"] })).toEqual(["g1"]));
it("sem_responsavel_e_sem_gerente_cai_no_admin", () => expect(destinatariosAlertaSla({ responsavelId: null, alertarResponsavel: true, alertarGerente: false, gerentesIds: [], adminsIds: ["ad"] })).toEqual(["ad"]));
it("gerente_que_e_o_responsavel_recebe_uma_vez", () => expect(destinatariosAlertaSla({ responsavelId: "g1", alertarResponsavel: true, alertarGerente: true, gerentesIds: ["g1"], adminsIds: [] })).toEqual(["g1"]));
// int
it("estourado_gera_notificacao_e_evento_uma_vez", async () => { await rodarAlertasSla(agora); await rodarAlertasSla(agora); expect(await prisma.notificacaoUsuario.count({ where: { tipo: "SLA_ESTOURADO", refId: a.id } })).toBe(1); expect(await contarEventos("SlaEstouradoAlertado", a.id)).toBe(1); });
it("responsavel_e_gerente_recebem_um_cada", async () => { await sla("COMERCIAL", { alertarResponsavel: true, alertarGerente: true }); expect((await rodarAlertasSla(agora)).notificacoes).toBe(2); });
it("concorrencia_nao_duplica", async () => { await Promise.all([rodarAlertasSla(agora), rodarAlertasSla(agora)]); expect(await contarNotif(a.id)).toBe(1); });
it("respondido_encerrado_grupo_ou_aria_nao_alerta", async () => { expect((await rodarAlertasSla(agora)).alertados).toBe(0); });
it("alertas_desligados_marcam_sem_notificar", async () => { await sla("COMERCIAL", { alertarResponsavel: false, alertarGerente: false }); await rodarAlertasSla(agora); expect((await le(a.id)).slaAlertadoEm).not.toBeNull(); expect(await contarNotif(a.id)).toBe(0); expect((await ultimoEvento("SlaEstouradoAlertado")).payload).toMatchObject({ destinatarios: [] }); });
it("estouro_antigo_fora_da_janela_nao_alerta", async () => { /* prazo = agora − 25 h */ expect((await rodarAlertasSla(agora)).alertados).toBe(0); });
it("ainda_no_prazo_nao_alerta", async () => { /* prazo = agora + 1 min */ expect((await rodarAlertasSla(agora)).alertados).toBe(0); });
it("gerente_desativado_nao_recebe", async () => { /* Usuario.ativo = false */ expect(destinatariosDoUltimoEvento()).not.toContain(g1.id); });
```

- [ ] **Step 2:** `node_modules/.bin/vitest run src/server/whatsapp/alertas-sla.test.ts src/app/api/whatsapp/cron && npm run test:int -- src/server/whatsapp/alertas-sla.int.test.ts` → FAIL.
- [ ] **Step 3:** Implementar. Gerentes e administradores são `Usuario` com `ativo: true` e o papel correspondente.
- [ ] **Step 4:** O mesmo comando → PASS.
- [ ] **Step 5:** `git commit -m "feat(sla): alerta único de prazo estourado no app (notificação + evento + SSE)"`

### Task 5: Notificação de SLA visível e auditada

**Files:**
- Modify: `src/server/crm/notificacoes.ts` (`NotificacaoItem` ganha `tipo` e `refTipo`; `marcarNotificacaoLida` usa `agregadoTipo` a partir de `refTipo`, ou seja, `"AtendimentoWhatsApp"` para SLA e `"Tarefa"` para lembrete), `src/app/(app)/tarefas/SinoNotificacoes.tsx` (destino por tipo: `SLA_ESTOURADO` → `/inbox?c=<refId>`, `LEMBRETE_TAREFA` → `hrefTarefas`), `src/app/(app)/inbox/page.tsx` (renderiza o sino no cabeçalho, com `listarNotificacoes`)
- Test: `src/server/crm/notificacoes.int.test.ts`, `src/app/(app)/tarefas/SinoNotificacoes.test.tsx` (ou o teste de página existente)

**Interfaces:**
- Consumes: `TipoNotificacao.SLA_ESTOURADO` (Task 2), notificações criadas pela Task 4.
- Produces: `hrefNotificacao(n: NotificacaoItem): string` (pura, exportada do sino).

- [ ] **Step 1: Testes que falham**

```ts
it("lida_de_sla_audita_no_atendimento", async () => { const n = await notifSla(v1, a.id); logado(v1); await marcarNotificacaoLida(n.id); expect(await ultimoEvento("NotificacaoLida")).toMatchObject({ agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id }); });
it("lida_de_lembrete_continua_na_tarefa", async () => { /* … */ expect(ev).toMatchObject({ agregadoTipo: "Tarefa" }); });
it("href_por_tipo", () => { expect(hrefNotificacao({ ...n, tipo: "SLA_ESTOURADO", refId: "at1" })).toBe("/inbox?c=at1"); expect(hrefNotificacao({ ...n, tipo: "LEMBRETE_TAREFA", refId: "t1" })).toBe(hrefTarefas({ t: "t1" })); });
it("inbox_mostra_o_sino", async () => { /* render da página com notificações mockadas */ expect(html).toContain("Notificações"); });
```

- [ ] **Step 2:** `node_modules/.bin/vitest run "src/app/(app)/tarefas" "src/app/(app)/inbox" && npm run test:int -- src/server/crm/notificacoes.int.test.ts` → FAIL.
- [ ] **Step 3:** Implementar. Confira se `/inbox?c=` abre o atendimento ao carregar (hoje `c` é escrito por `InboxNovo.abrir`). Se a leitura inicial não existir, acrescente-a.
- [ ] **Step 4:** O mesmo comando → PASS.
- [ ] **Step 5:** `git commit -m "feat(sla): sino com notificação de prazo estourado no inbox"`

### Task 6: Tela de Distribuição e SLA

**Files:**
- Modify: `src/app/(app)/configuracao/crm/distribuicao/SetorPainel.tsx` (remove `AVISO_SLA_EM_BREVE`, inclui o editor de horário), `src/app/(app)/configuracao/crm/distribuicao/page.tsx` (passa `horario` e o fuso da escola), `src/app/estados-vazios-mapa.ts` e `src/app/botoes-mapa.ts` se os guards exigirem
- Test: o teste de página existente de `configuracao/crm/distribuicao` e o de `SetorPainel`

**Interfaces:**
- Consumes: `HorarioAtendimento` (Task 1), `salvarConfigSetorDaTela` com `sla.horario` (Task 2).
- Produces: `SetorPainelProps.horario: HorarioAtendimento | null`, `SetorPainelProps.fuso: string`.

UI: sete linhas (Dom a Sáb), cada uma com caixa "Atende", início e fim (`<input type="time">`), e um intervalo por dia na v1. O botão "Copiar segunda para dias úteis" é opcional. Rótulos que precisam aparecer:

- legenda: `Horário de atendimento (fuso da escola: {fuso})`;
- ajuda quando `contarSoNoHorario` está ligado e não há dia marcado: `Sem horário cadastrado: o prazo conta direto, 24 h por dia.`;
- ajuda dos alertas: `O alerta aparece no sino e na lista do Inbox uma vez por atendimento. Sem responsável, vai ao gerente do setor.`;
- `Mudanças valem para os próximos atendimentos; prazos já calculados não mudam.`

- [ ] **Step 1: Testes que falham**

```ts
it("sem_aviso_em_breve", () => expect(html).not.toContain("Em breve"));
it("mostra_horario_gravado", () => { expect(html).toContain('value="08:00"'); expect(html).toContain("fuso da escola: America/Sao_Paulo"); });
it("envia_horario_ao_salvar", async () => { /* marcar seg 08–18, salvar */ expect(salvarConfigSetorDaTela).toHaveBeenCalledWith(expect.objectContaining({ sla: expect.objectContaining({ horario: { intervalos: [{ dia: 1, inicio: "08:00", fim: "18:00" }], feriados: [] } }) })); });
it("sem_dias_marcados_envia_null", async () => { expect(arg.sla.horario).toBeNull(); });
it("aviso_sem_horario_quando_flag_ligada", () => expect(html).toContain("Sem horário cadastrado"));
```

- [ ] **Step 2:** `node_modules/.bin/vitest run "src/app/(app)/configuracao/crm/distribuicao"` → FAIL.
- [ ] **Step 3:** Implementar. Feriados não têm UI na v1 (ver decisão D2) e o campo é enviado como `[]`, preservando o que estiver gravado.
- [ ] **Step 4:** O mesmo comando, mais `node_modules/.bin/vitest run src/app` (guards de mapa) → PASS.
- [ ] **Step 5:** `git commit -m "feat(sla): tela de distribuição edita horário e liga os alertas"`

### Fechamento

- [ ] `node_modules/.bin/vitest run` e `npm run test:int` completos → PASS. `npx tsc --noEmit` → sem erros.
- [ ] Atualizar `docs/planejamento/quadro-entregas.md`: R1 resolvido, P5 com horário por setor e "fora do horário" disponível para ligar em `metricasAtendimento` (`dentroDoHorario`) e no gatilho `foraHorario` da Aria, ambos em tarefa separada.

---

## Decisões de produto em aberto (a especificação não responde)

| # | Pergunta | Recomendação (usada no plano) |
|---|---|---|
| D1 | Horário **por setor** ou **geral da escola** (ou por número)? | **Por setor**, em `PrazoRespostaSetor.horario`. Pedagógico e Comercial têm rotinas diferentes, e P5 fala em "setor ou número". Um botão "copiar de outro setor" cobre o caso de horário único. Por número fica fora (um número atende vários setores). |
| D2 | **Feriados** entram na contagem? | O cálculo já aceita `feriados` (testado), mas a **v1 não tem UI**: a lista fica vazia. O calendário acadêmico (`FERIADO` em versão de calendário) não deve ser reusado, porque é acadêmico e versionado por turma. Se o dono quiser, a próxima tarefa é uma lista de datas por escola na tela. **Atualização 21/10/2026 (`claude/sla-feriados`):** a premissa "versionado por turma" não confere: `VersaoCalendarioEscolar` é o calendário único da escola (versão global, aprovada por outra pessoa). O SLA passou a usar os períodos `FERIADO` da versão aprovada vigente, sem cadastro paralelo; ver o quadro. |
| D3 | O alerta **repete** enquanto ninguém responde? | **Não, alerta uma vez por atendimento.** A lista do Inbox continua mostrando "Prazo estourado", e o filtro já existe. Lembrete repetido (ex.: a cada 60 min) pode vir depois com `slaAlertadoEm` + contador. |
| D4 | O **gerente** recebe? Quem é o gerente de Financeiro e Secretaria? | Segue a flag `alertarGerente` (padrão desligado). Gerente = `GERENTE_COMERCIAL` / `GERENTE_PEDAGOGICO`. **Financeiro e Secretaria não têm gerente, e a recomendação é ADMINISTRADOR.** |
| D5 | Atendimento **sem responsável** (fila) estoura: quem recebe? | Com `alertarResponsavel` ligado, vai ao gerente do setor (ou admin). Os participantes do rodízio não recebem, para evitar ruído. Alternativa: avisar todos os participantes do setor. |
| D6 | **Resposta da Aria** conta como primeira resposta para o alerta? | **Conta para o alerta (não alerta)**, porque o cliente foi respondido. A métrica `primeiraRespostaEm` continua só humana, como hoje, e o filtro "Prazo estourado" segue igual. Confirmar com o dono. |
| D7 | Mudar o horário ou o prazo **recalcula** atendimentos abertos? | **Não.** Vale para os próximos, e a tela avisa. Recalcular mexe em métricas já exibidas. |
| D8 | Ligar os alertas com a fila já estourada | Janela de **24 h**: estouros mais antigos não geram notificação no 1º tick. |
| D9 | "Contar só no horário" ligado (padrão `true`) **sem horário cadastrado** | Conta corrido, como hoje, e a tela mostra o aviso. Não inventar um horário padrão. |
| D10 | Aviso em tempo real (toast) além do sino e da lista? | **Não na v1.** O SSE já recarrega o item (`atendimento.atualizado`). Um toast exige um evento SSE direcionado novo (`paraUsuarioId`) e pode vir depois. O sino fica só em `/tarefas` e `/inbox`, e levá-lo ao layout global é decisão de UX à parte. |
| D11 | Intervalo de almoço (vários intervalos por dia) | O schema e o cálculo aceitam vários. A **UI v1 tem um intervalo por dia**. |
