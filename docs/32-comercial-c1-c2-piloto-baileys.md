# 32 — Comercial C1/C2: piloto no Baileys (antes da WABA)

> Executa um **piloto de produto e operação** das automações comerciais C1 (captura +
> velocidade) e C2 (experimental) do [`27`](27-comercial-automacoes-ia.md) rodando no driver
> **Baileys**, antes da burocracia Meta/WABA do [`31`](31-whatsapp-go-live.md) §0.
>
> **O que este piloto É:** validação dos gatilhos, cadências, uso da inbox, stop-conditions e
> resultados comerciais. **O que NÃO é:** homologação definitiva do canal. Template aprovado,
> botões Confirmar/Reagendar, referral de click-to-WhatsApp e o comportamento da Cloud API
> **precisam ser revalidados na WABA** (§7). O Baileys carrega risco operacional próprio
> (sessão não oficial, risco de bloqueio do número) — tratado como risco aceito e monitorado,
> não como estado final.

## 0. Bloqueadores conhecidos (fechar ANTES de ativar o piloto)
Levantados na revisão de prontidão; enquanto abertos, o piloto não começa. Cada um vira item
dos **portões de entrada** (§2) e/ou dos **critérios de stop** (§6).

| # | Bloqueador | Onde | Correção |
|---|---|---|---|
| B1 | **Sem cohort real.** Ativar uma régua alcança TODOS os leads elegíveis do número — isso é go-live geral, não piloto. | resolvers em [`cron-comercial.ts`](../src/server/whatsapp/cron-comercial.ts) | **Allowlist de leads na política** (decidido): `PoliticaComercial` ganha uma lista explícita de `leadId`s do piloto + UI; o cron só enfileira para leads na allowlist. Migração + tela. |
| B2 | **Resposta do vendedor pelo celular não para a cadência.** O `fromMe` entra como `origem: null`; a stop-condition só conta `origem: HUMANO`. | [`inbound.ts:94`](../src/server/whatsapp/inbound.ts) grava `origem: null`; [`cron-comercial.ts:170`](../src/server/whatsapp/cron-comercial.ts) conta só `HUMANO` | Contar como "vendedor assumiu" TODA saída manual — `origem` ∈ {`HUMANO`, `null`} **após a âncora** (não as automáticas `CRON`/`LOTE`). Enquanto não corrigido: **atendimento exclusivamente pela inbox** durante o piloto. |
| B3 | **Cadência pré-evento sem validade no despacho.** Há guarda no enfileiramento (`encerrada` quando a aula começou), mas uma intenção pré-evento já enfileirada e **ADIADA** (janela/silêncio/kill switch) ainda dispara depois da aula; o degrau "‑24h/amanhã" pode sair atrasado. | [`cron-comercial.ts:205`](../src/server/whatsapp/cron-comercial.ts) (só no enqueue); nada no [`despachante.ts`](../src/server/whatsapp/despachante.ts) | Toda intenção pré-evento carrega `validaAte`; o despachante **cancela** (não envia) se `agora > validaAte`, inclusive itens adiados por janela/silêncio/kill switch. Tolerância por degrau. |
| B4 | **Cron horário incompatível com `+30min`.** O tick de hora em hora transforma "+30min" em quase "+90min". | [`31-whatsapp-go-live.md:145`](31-whatsapp-go-live.md) | Definir tolerância máxima por degrau; para C1/C2, tick a cada **5–10 min**. |
| B5 | **Spec em contradição.** A [`30`](30-whatsapp-spec-implementacao.md) §S1 ainda diz "régua automática exige driver oficial"; código e doc 27 abrem a exceção C1/C2 no Baileys. | [`30`](30-whatsapp-spec-implementacao.md) §S1 × [`despachante.ts:138`](../src/server/whatsapp/despachante.ts) | Registrar a decisão final (exceção comercial no Baileys), seus limites e o risco aceito, como ADR no [`15`](15-decisoes-adr.md) e reconciliar o texto da S1. |
| B6 | **Origem do lead no Baileys.** O referral de anúncio não é garantido nesse driver — origem pode ser inferida errada. | captura em [`captura.ts`](../src/server/comercial/captura.ts) | No piloto, origem fica explicitamente **"não identificada (Baileys)"** ou tem preenchimento manual — nunca inferida incorretamente. |
| B7 | **Stop-conditions só avaliadas no enqueue, não no despacho.** O despachante revalida a idempotência (passo+ocorrência já enviados), mas NÃO a **etapa** nem a **ocorrência atual**. Uma intenção já `PENDENTE`/`ADIADA` dispara mesmo que, após o enqueue, o lead vá para `EM_ATENDIMENTO`, faça check-in ou a experimental seja reagendada → follow-up de C1 sai após o vendedor assumir, e no-show/pré-experimental sai para a **ocorrência anterior**. (Generaliza B2/B3: o despacho não pode confiar no snapshot do enqueue.) | idempotência em [`despachante.ts:223`](../src/server/whatsapp/despachante.ts); stop-conditions só em [`cron-comercial.ts:163`](../src/server/whatsapp/cron-comercial.ts) | Revalidar no despachante **etapa + `ocorrenciaComercial` + takeover** (e `validaAte`, B3); **cancelar** as intenções obsoletas em vez de enviar. Testes cobrindo itens **adiados**. |
| B8 | **`REAGENDAR` não pausa a cadência.** `capturarRespostaExperimental` só grava `ExperimentalReagendamentoSolicitado`; o lead segue `EXPERIMENTAL_AGENDADA` com a MESMA `dataExperimental`, e `rodarPreExperimental` consulta só etapa/data — ignora o evento. O inbound cancela as intenções que existiam, mas o tick seguinte enfileira o próximo degrau (ex.: `-2h`). É **falha conhecida**, não cenário a validar. | evento em [`captura.ts:190`](../src/server/comercial/captura.ts); resolver em [`cron-comercial.ts:187`](../src/server/whatsapp/cron-comercial.ts) | Estado persistido **"aguardando reagendamento"** (flag no lead ou o cron respeitando o evento sem remarcação posterior) que o cron honra **até a ação humana**. |
| B9 | **Sem alerta de check-in ausente/vencido.** A Home do professor lista todos os `EXPERIMENTAL_AGENDADA` e escolhe o mais antigo como "Próxima aula" — inclusive com a data já vencida; não há estado de vencido, evento nem notificação para cobrar o check-in. Como a recuperação de no-show **só começa após o check-in**, sem isso o cenário C2 nunca dispara de forma confiável. | [`home/consultas.ts`](../src/server/home/consultas.ts) · [`HomeProfessor.tsx`](../src/app/(app)/home/HomeProfessor.tsx) | Alerta operacional de check-in vencido — **responsável, tolerância e canal** definidos; estado/estilo de vencido na Home + evento/notificação. |

---

## 1. Objetivo e limites
- **O que o piloto quer provar:** que os gatilhos disparam certo, as cadências respeitam
  ordem/tolerância, a inbox é o posto de trabalho do vendedor, as stop-conditions cortam a
  automação quando devem, e que há **resultado comercial** (leads capturados, confirmações,
  recuperação de no-show) sem incidente de entrega para a pessoa errada.
- **O que NÃO será validado até a WABA:** templates aprovados e variáveis; botões
  Confirmar/Reagendar e seus payloads; referral click-to-WhatsApp; regras de janela de 24h e
  seleção texto/template da Cloud API; qualidade/limites/custo do canal oficial.
- **Escopo declarado do piloto:** número (Baileys dedicado), país, vendedor responsável,
  datas de início/fim, volume-alvo e **cohort** (allowlist de leads na política — B1).
- **Governança:** quem pode **ativar**, quem pode **interromper** (kill switch) e quem
  **autoriza expansão** de cohort/degraus.
- **Risco operacional do Baileys (declaração explícita):** sessão não oficial pode cair ou ser
  bloqueada; o número pode ser banido por pacing agressivo. Contido por teto/janela/pacing,
  rollout gradual (§4) e stop imediato (§6) — não é homologação do canal.

## 2. Portões de entrada (todos verdes antes de ativar)
- [ ] Build, lint, testes unitários e de integração **verdes**.
- [ ] Produção e desenvolvimento com **bancos separados** (gap A5; dev sem `WHATSAPP_LIVE=1`).
- [ ] Evolution **privada** (fora da internet), sessão Baileys **conectada** e webhook recebendo.
- [ ] Backup e **restore testados** (não só backup — restaurar num compose limpo, §31 §4).
- [ ] Health monitorado **externamente** (UptimeRobot/Better Stack no `/api/whatsapp/health`).
- [ ] **Kill switch ensaiado** (congela e descongela sem perder fila) pelo responsável.
- [ ] **Todas as políticas fora do piloto DESLIGADAS ou em SHADOW.**
- [ ] Templates (texto livre do Baileys) revisados em **espanhol/português** com variáveis reais.
- [ ] **Fuso e data/hora** da experimental validados (a janela usa `Aluno/Pais.fuso`; cron em UTC).
- [ ] Consentimento, **opt-out**, retenção e responsáveis definidos (docs 31 §8: D23/D25/D21).
- [ ] **Despacho revalida estado** (B7): etapa/ocorrência/takeover conferidos no despachante, não só no enqueue; intenção obsoleta é **cancelada**, não enviada.
- [ ] **`REAGENDAR` pausa a cadência** (B8): estado "aguardando reagendamento" respeitado pelo cron até ação humana.
- [ ] **Alerta de check-in vencido** (B9) no ar — responsável, tolerância e canal definidos.
- [ ] **Bloqueadores B1–B9 (§0) fechados** — ou o mitigador operacional aplicado e registrado.

## 3. Matriz de cenários obrigatórios
Cada cenário precisa de **evidência** (print, evento, consulta ou mensagem identificável) — ver §7.

### C1 — captura + velocidade
- [ ] Contato novo cria **exatamente um** lead e **uma** saudação.
- [ ] Dois inbounds simultâneos **não duplicam** (claim atômico `capturadaEm`).
- [ ] **Retry** do webhook não duplica (dedupe `providerMessageId`).
- [ ] Aluno, responsável ou lead **existente** não cria outro lead.
- [ ] Grupo, status, broadcast e reação são **ignorados**.
- [ ] **Resposta do lead** (inbound após a âncora) encerra a cadência.
- [ ] **Resposta do vendedor** pela inbox **e pelo celular** (`fromMe`) encerra a cadência (B2 no enqueue; **B7** para item já adiado).
- [ ] Mudança para **`EM_ATENDIMENTO`** encerra a cadência (só `NOVO` é frio) — inclusive um degrau **já adiado** não sai depois disso (**B7**).
- [ ] **Opt-out** na primeira mensagem impede saudação e follow-ups.
- [ ] Saudação sai **fora do horário** (reativa); follow-up respeita **janela/fuso/teto**.

### C2 — experimental
- [ ] Experimental marcada com **mais e menos de 24h** (degraus ‑24h/‑2h corretos).
- [ ] Confirmação **exata** por `SIM`/`CONFIRMO`.
- [ ] `REAGENDAR` gera **sinal visível** e **pausa** a cadência até ação humana (**B8** — hoje não pausa).
- [ ] Frases **ambíguas não confirmam** presença.
- [ ] **Reagendamento** inicia uma **ocorrência limpa** (nova âncora) e o degrau da ocorrência antiga **não sai** (**B7/B8**).
- [ ] **Segundo no-show** inicia **outro ciclo** (nova ocorrência); degrau do ciclo anterior não sai no despacho (**B7**).
- [ ] Check-in **"compareceu"** encerra a recuperação — inclusive um degrau já adiado (**B7**).
- [ ] Check-in **"não compareceu"** inicia no-show.
- [ ] **Ausência de check-in** gera alerta operacional (**B9** — hoje inexistente).
- [ ] **Nenhum lembrete pré-experimental** sai **após o começo** da aula (**B3**) nem para a **ocorrência anterior** (**B7**) — inclusive itens adiados.
- [ ] Confirmação/resposta sempre se relaciona ao **lembrete e à ocorrência corretos**.

## 4. Rollout progressivo
Ativar **nesta ordem**, um passo por vez, observando health + métricas entre cada um. Isso
reduz o risco de comportamento agressivo no Baileys e isola qual política causou um problema.
1. **Shadow** de todas as políticas (intenções `SIMULADA` — o que TERIA sido enviado).
2. **Auto-lead**, ainda **sem mensagem**.
3. **Saudação reativa**.
4. Apenas **C1 `+30min` e `+4h`**.
5. **Pré-experimental**.
6. **Recuperação de no-show**.
7. **C1 `+24h`, `+3d`, `+7d`** por último.

## 5. Critérios de aceite

### Segurança (absolutos — qualquer violação para o piloto, §6)
- [ ] **Zero** lead ou saudação duplicados.
- [ ] **Zero** envio para a pessoa errada.
- [ ] **Zero** mensagem após opt-out.
- [ ] **Zero** follow-up após resposta ou depois de o vendedor assumir.
- [ ] **Zero** lembrete pré-evento enviado depois do evento.
- [ ] **100%** das mensagens automáticas visíveis e **marcadas** na inbox (origem `CRON`/régua).
- [ ] **Kill switch e recuperação de sessão** executáveis pelo responsável.

### Métricas (medir e reportar)
- Tempo **p50/p90** até a saudação.
- **Atraso real** de cada degrau versus horário planejado.
- Taxa de **entrega / leitura / resposta**.
- **Leads criados** e origem identificada.
- **Confirmação** e **reagendamento**.
- **No-show** antes/depois.
- **Recuperação** após no-show.
- **Intervenções manuais** e **falhas por motivo**.

## 6. Stop e rollback
**Interromper imediatamente** (kill switch) se ocorrer:
- Duplicidade (lead/saudação/envio).
- Mensagem após resposta/opt-out.
- Mensagem depois de o vendedor assumir (`EM_ATENDIMENTO`/takeover) ou para uma **ocorrência obsoleta** (reagendada / ciclo anterior) — B7/B8.
- Destinatário incorreto.
- Mensagem temporalmente inválida (lembrete pós-evento; "amanhã" no dia).
- Sessão instável ou risco de bloqueio do número.
- Falha de webhook/cron.
- Reclamação de usuário.

**Backlog no descongelamento:** ao liberar o kill switch, as mensagens antigas **não podem sair
em rajada**. Primeiro **inspecionar e cancelar** tudo que ficou obsoleto (intenções `ADIADA`
vencidas, lembretes pré-evento expirados — B3) e só então retomar o tick.

## 7. Migração para a WABA (validado no Baileys × retestar na WABA)
O que passou no Baileys **não** transfere automaticamente para a Cloud API. Cada item abaixo é
**retestado na WABA**, e cada linha carrega **responsável · evidência · data · resultado** —
"testado" sem print, evento, consulta ou mensagem identificável **não conta** como aceite.

| Item a revalidar na WABA | Responsável | Evidência | Data | Resultado |
|---|---|---|---|---|
| Templates aprovados + variáveis | | | | |
| Botões Confirmar/Reagendar + payloads | | | | |
| Referral de click-to-WhatsApp | | | | |
| Regras de janela 24h e seleção texto/template | | | | |
| Webhook, autenticação, dedupe e status de entrega | | | | |
| Idioma por país | | | | |
| Qualidade, limites e custo do canal | | | | |
| Regressão completa das stop-conditions (§3) | | | | |

## Relacionados
[`26`](26-whatsapp-v1.md) (canal bimotor) · [`27`](27-comercial-automacoes-ia.md) (C1/C2/C3) ·
[`30`](30-whatsapp-spec-implementacao.md) (S1 — reconciliar B5) ·
[`31`](31-whatsapp-go-live.md) (deploy/health/backup/rollout; cron — B4) ·
[`15`](15-decisoes-adr.md) (ADR da exceção Baileys — B5).
