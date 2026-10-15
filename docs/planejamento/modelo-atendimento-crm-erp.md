# Modelo de atendimento e CRM no ERP — plano de execução

**Para:** agente do repositório do ERP.
**Base:** `main` em `f8a9c0e`, `remocao-crm-levantamento-dependencias.md` (CRM) e `levantamento-troca-whatsapp-crm-novo.md` (WhatsApp). As referências `arquivo:linha` abaixo vêm desses dois levantamentos. **Copie os dois levantamentos para `docs/planejamento/` antes da fase E0**, para que sejam a fonte de consulta.
**Natureza:** plano em fases. Valem as regras do `AGENTS.md`: o integrador reserva IDs de migration e faz install; toda mutação grava `Evento` na mesma transação; teste e `tsc` só valem com exit 0; registrar no `quadro-entregas.md`.

---

## 0. Decisões tomadas

| # | Decisão |
|---|---|
| D1 | Ambiente em teste: **sem migração de dados**. Dados de WhatsApp e da casca comercial podem ser descartados. |
| D2 | **CRM:** remover só a casca (telas, crons, copiloto, réguas comerciais, auto-lead). Ficam como base do CRM novo: `Lead` (vira Oportunidade), os papéis `VENDEDOR`/`GERENTE_COMERCIAL`, o escopo de carteira e `Comissao`. |
| D3 | **WhatsApp:** Meta e Evolution saem. O transporte passa a ser o **motor próprio** (serviço separado, Baileys), integrado como um driver novo da porta `CanalWhatsApp`. As regras de negócio do despachante, da fila e das automações ficam. |
| D4 | **Régua de cobrança e avisos de agenda passam a rodar no motor.** A trava S1/D34 (cobrança automática só em `META_CLOUD`) é **revogada** para o driver do motor; o controle de ritmo fica no motor (roteiro do motor, M8). Atualizar docs 15 (D34) e 30 (S1) registrando a revogação. A porta continua aceitando um driver Meta no futuro. |
| D5 | **Vários números.** Um número pode servir a **um ou mais setores**; um setor pode ter **um ou mais números**. |
| D6 | **Cada atendente trabalha em um único setor.** |
| D7 | **Hierarquia = papéis do ERP.** Não há unidades/filiais. |
| D8 | **Grupos são suportados.** |
| D9 | **O celular pode ser usado em paralelo.** Mensagens enviadas pelo celular aparecem como "Enviada pelo celular", contam como resposta e pausam a IA. |
| D10 | O Inbox novo é **um só para todos os setores** (Vendas, Secretaria, Financeiro, Pedagógico). |
| D11 | O ERP é a **fonte da verdade das mensagens** das conversas que gerencia (`MensagemWhatsApp`), porque o escopo, a autorização de mídia, a fila e os triggers dependem dela. O motor guarda o próprio histórico para o protocolo e para recuperação. |
| D12 | **Regras de escopo atuais continuam** (levantamento WhatsApp §4.4): professor só vê pedagógico da própria turma; pedagógico esconde telefone; financeiro só por matrícula com o pagador atual; responsável legal exige autorização acadêmica vigente. |

---

## E0 — Preparação (integrador)

1. Instalar dependências e preparar um perfil de banco de teste da lista fechada; rodar `tsc --noEmit`, `vitest run` e `vitest run -c vitest.integration.config.ts` e **registrar as falhas pré-existentes** como linha de base.
2. Copiar os dois levantamentos para `docs/planejamento/`.
3. Decidir a atualização para **React 19** (o front do motor é React 19; o ERP está em 18.3.1 com Next 16). Necessária antes da fase E7.
4. Reservar os IDs de migration das fases E3 a E5.

**Aceite:** linha de base registrada no `quadro-entregas.md`.

## E1 — Remover a casca do CRM (sem schema, sem SQL)

Base: levantamento WhatsApp, Parte 6 (corrige a lista original).

**Remover:**
- telas `/pipeline`, `/carteiras`, `/comissoes` (a tela nova de Comissões do CRM substitui "minhas comissões"), `configuracao/whatsapp/comercial`, `configuracao/whatsapp/reguas`, `HomeVendedor`;
- `CockpitLead` (função dentro de `InboxCliente.tsx:1071-1220`) e `CopilotoSugestoes`;
- `src/server/ia`, editando os dois importadores da base: `comercial/acoes.ts:30,398` e `whatsapp/consultas-inbox.ts:1,204`;
- `cron-comercial.ts`, `cron-gestao.ts` e as etapas `:60,:61,:62,:64,:65,:67,:69,:71` de `src/app/api/whatsapp/cron/route.ts` (ajustar imports, JSON de resposta e `route.test.ts`);
- auto-lead e saudação em `comercial/captura.ts:254-294` e a chamada em `inbound.ts:149-164`.

**Manter (não é casca):**
- `whatsapp/linha-comercial.ts` (base do Inbox);
- etapas do cron `:73` comissões, `:76` fechamentos pendentes, `:79` linha comercial, `:81` despacho;
- **`/leads`, a ficha do lead e `/leads/[id]/contratacao`**, até o CRM novo ter a lista de oportunidades e a entrada de "Preparar contratação" (é a única tela dessa ação hoje).

**Atualizar na mesma entrega:** as travas globais listadas no levantamento WhatsApp §6.2 (`botoes.test.ts`, `borda-rota*`, `estados-vazios-mapa.ts`, `contraste*`, `responsivo.test.ts`, `confirmacoes*`, `colunas-ordenaveis.test.ts`, `enums-rotulos.test.ts`, `Esqueleto.test.ts`, `home/page.test.ts`, `InboxCliente.test.ts`, `configuracao/whatsapp/page.test.ts`, menus em `nav.ts`, `secoes.ts`, `trilha.ts`). O GERENTE_COMERCIAL não pode cair em `AcessoNegado` em `/configuracao/whatsapp`.

**Aceite:** suíte igual ou melhor que a linha de base de E0; nenhuma migration nova.

## E2 — Driver do motor

Depende do motor pronto até M5 (`01-roteiro-adaptacao-motor.md`).

1. **Enum:** `DriverWhatsApp` ganha `MOTOR` (com rótulo, por causa de `enums-rotulos.test.ts`).
2. **`drivers/motor.ts`** implementando `CanalWhatsApp` (`canal.ts:50-54`): `enviarTexto`, `enviarMidia`, `enviarTemplate` (no motor vira texto renderizado). Erros do motor mapeados para `ErroDriver`: `NAO_ENVIADO` → falha reprocessável; `RESULTADO_INCERTO` → revisão humana (fluxo atual).
3. **ID gerado pelo ERP antes do envio:** o despachante cria o `clientMessageId` (por exemplo, o id da `IntencaoMensagem` ou um id novo gravado nela) e o envia ao motor. O motor ecoa esse id nos eventos. Isso elimina a corrida do eco `fromMe` (levantamento WhatsApp §7.2).
4. **Rota de entrada** `POST /api/whatsapp/webhook/motor`:
   - valida `HMAC-SHA256(timestamp + "." + corpoCru)` com segredo próprio (não reaproveitar `CRON_SECRET`), `timingSafeEqual` e janela anti-replay;
   - responde 200 rápido e processa de forma assíncrona (doc 30 S7);
   - deduplica por `idEvento`;
   - normaliza para `InboundNormalizado` / `StatusNormalizado` e reaproveita o domínio de `inbound.ts`.
5. **Eco `fromMe`:** `origem: "erp"` atualiza a mensagem já gravada; `origem: "celular"` grava `MensagemWhatsApp` SAIDA com nova `OrigemEnvio.CELULAR` (rótulo "Enviada pelo celular"), sem autor, e marca o atendimento como respondido.
6. **Status:** atualiza `MensagemWhatsApp.status` com horário e motivo vindos do motor, e passa a refletir também na `IntencaoMensagem` correspondente (hoje não reflete).
7. **Sessão e QR:** `sessao.ts`, `NumerosPainel.tsx` e `acoes.ts:756-787` passam a chamar a API do motor e a receber `sessao.estado` / `sessao.qr`.
8. **Mídia:** download pela API do motor, **depois** do dedupe.
9. **Revogar a S1 para `MOTOR`** em `cron.ts:55-56` e `despachante.ts:192-199`; liberar avisos de agenda em `comunicacoes-agenda/whatsapp.ts:95-96` e `acoes.ts:726` para `MOTOR`. Registrar a decisão D4.
10. **Remover Meta e Evolution:** `drivers/meta-cloud.ts`, `drivers/evolution.ts`, `evolution-jid.ts` (a regra foi para o motor), `meta-templates.ts`, rotas `webhook/meta` e `webhook/evolution`, telas de submissão de template à Meta, variáveis `META_WA_*` e `EVOLUTION_*`, serviço e banco `evolution` nos dois composes; adicionar o serviço do motor. `TemplateWhatsApp` continua como modelo de texto; `statusMeta` e `metaTemplateId` deixam de ser usados.
11. Revisar todos os acoplamentos ao enum `DriverWhatsApp` listados no levantamento WhatsApp §2.4.

**Aceite:**
- Texto, mídia e documento enviados pelo Inbox chegam pelo motor (teste de integração com motor simulado).
- Régua de cobrança em número `MOTOR` envia respeitando janela, teto, silêncio e kill switch.
- Mensagem enviada pelo celular aparece como `CELULAR` e não duplica a enviada pelo ERP.
- Webhook com assinatura inválida, replay ou evento duplicado não altera nada.

## E3 — Modelo de dados do atendimento

### E3.1 Número × setor

- Nova tabela `NumeroSetorWhatsApp (numeroId, finalidade)`, N:N, com unique `(numeroId, finalidade)`. `finalidade` usa o enum existente `FinalidadeAtendimentoWhatsApp` (COMERCIAL, FINANCEIRO, SECRETARIA, PEDAGOGICO).
- Por número: **responsável pela triagem** (usuário ou papel) quando o número serve a mais de um setor. Padrão: ADMINISTRADOR.
- `FinalidadeNumero` (COBRANCA, VENDAS, AGENDA) deixa de definir acesso. As automações continuam escolhendo o número pelas FKs que já existem (`PoliticaRegua.numeroRemetenteId`, `ConfiguracaoOperacional.numeroAvisosAgendaId`). A linha comercial (VENDAS com dono) continua como está.

### E3.2 Setor do usuário (D6, D7)

O setor vem do **papel**, sem coluna nova:

| Papel | Setor | Nível |
|---|---|---|
| ADMINISTRADOR | todos | vê e configura tudo |
| GERENTE_COMERCIAL | COMERCIAL | vê todo o setor e a equipe |
| VENDEDOR | COMERCIAL | atendente |
| GERENTE_PEDAGOGICO | PEDAGOGICO | vê todo o setor |
| PROFESSOR | PEDAGOGICO | só a própria turma (regra atual) |
| FINANCEIRO | FINANCEIRO | atendente |
| SECRETARIA_ACADEMICA | SECRETARIA | atendente |

**Conflito a decidir antes de E5:** hoje a SECRETARIA_ACADEMICA também vê FINANCEIRO e PEDAGOGICO (`escopo.ts:66-71`). Com D6 ("cada atendente no seu setor"), ela passaria a ver só SECRETARIA. Confirmar com o produto. Exceções pontuais usam o convite de participante (E3.4).

### E3.3 Atendimento

Em `AtendimentoWhatsApp`, acrescentar:
- `status`: `ABERTO_SEM_RESPONSAVEL`, `EM_ATENDIMENTO`, `AGUARDANDO_CLIENTE`, `ENCERRADO` (mantendo `encerradoEm` coerente);
- `primeiroInboundEm`, `primeiraRespostaEm`, `prazoRespostaEm` (prazo configurável por setor);
- `atendimentoOrigemId` (FK para o próprio atendimento) para a cadeia de transferência.

Regras:
- **Transferência entre setores = encerrar + abrir outro** com `atendimentoOrigemId`, evento `AtendimentoTransferido`. Nunca alterar a finalidade de um atendimento (os triggers 264/265 e a imutabilidade de FIN e PEDAG continuam intactos).
- **Atribuição** dentro do setor: assumir, atribuir, devolver para a fila, com evento.
- **Reabertura:** inbound depois do encerramento abre um **novo** atendimento no mesmo setor (a regra atual proíbe reabrir; manter).
- **Encerramento:** a ação existe (`operacoes-atendimento.ts:286-304`) e ganha tela.

### E3.4 Participantes

`ParticipanteAtendimentoWhatsApp` já existe e não é usado em produção. Passa a ser o mecanismo de **chamar alguém de outro setor sem transferir** (ver e, se `podeEnviar`, responder), com prazo e revogação.

### E3.5 Grupos (D8)

- Nova tabela `GrupoWhatsApp (id, numeroId, grupoJid, nome, turmaId?, empresa?)`, unique `(numeroId, grupoJid)`.
- `ConversaWhatsApp.contatoId` passa a ser opcional, com `grupoId` opcional e CHECK "exatamente um dos dois". Unique de grupo: `(numeroId, grupoId)`.
- `MensagemWhatsApp` ganha `participanteJid`, `participanteE164` e `participanteNome` para mensagens de grupo.
- Grupos **não abrem atendimento automaticamente** nem cancelam automações ("conversa viva" só vale para conversa individual).
- Escopo: grupo ligado a turma → professor da turma e PEDAGOGICO; sem vínculo → setores do número.
- Os triggers 264 e 265 assumem conversa individual: revisar para ignorar conversas de grupo.

### E3.6 Mensagem

- `OrigemEnvio` ganha `CELULAR` e `IA` (com rótulos).
- `MensagemWhatsApp` ganha `clientMessageId` (unique) para casar envio do ERP, eco e status.
- `TipoMensagem` cobre o que o motor entrega; reação e edição atualizam a mensagem original, não criam uma nova.

**Aceite de E3:** migrations aplicadas num banco descartável; `pg_proc` sem função quebrada; testes de escopo e dos triggers continuam verdes.

## E4 — Roteamento de inbound

Base: `atendimentoDoInbound` (`atendimentos.ts:57-84`).

1. Conversa com **atendimento aberto** → mantém nele.
2. Número com **um setor só** → abre atendimento nesse setor, sem responsável (fila do setor), respeitando as regras atuais de contexto (FINANCEIRO exige matrícula etc.).
3. Número com **vários setores** → vai para a **triagem do número** (responsável definido em E3.1), que classifica com o fluxo auditado existente (`MensagemClassificada`, `operacoes-atendimento.ts:191-238`).
4. Mais tarde (fase do agente de IA), a Aria classifica primeiro e só manda para a triagem humana quando a confiança for baixa.
5. Linha comercial (VENDAS com dono) mantém a regra atual.

**Aceite:** os quatro caminhos cobertos por teste de integração.

## E5 — Escopo e hierarquia

Reescrever `escopoAtendimentos` (`escopo.ts:37-82`) mantendo o princípio "o acesso vem do atendimento, nunca do número":

| Quem | Vê |
|---|---|
| ADMINISTRADOR | tudo |
| Gerente (GC, GP) | todos os atendimentos do seu setor + carteira da equipe (GC) |
| Atendente | os atendimentos em que é responsável + **a fila sem responsável do seu setor nos números que servem ao setor** + atendimentos em que é participante vigente |
| VENDEDOR | além disso, a carteira comercial atual (regra atual) |
| PROFESSOR | regra atual (pedagógico aberto da própria turma ou experimental própria) + grupos da própria turma |
| Triagem | quem é responsável pela triagem do número vê as conversas ainda sem setor |

Todas as regras do levantamento WhatsApp §4.4 continuam valendo e viram a especificação de aceite (são 21, de "acesso pelo atendimento" a "auditoria por Evento").

**Aceite:** os testes existentes de escopo (`acesso-atendimento.int.test.ts`, `escopo*.test.ts`, `linha-comercial*`, `atendimento-pedagogico-autorizacao.int.test.ts`, `destinatario-atual.int.test.ts`) passam, com as mudanças de comportamento documentadas e testadas.

## E6 — Tempo real e paginação

- **SSE** numa route handler do Next (`/api/inbox/eventos`), alimentada por `LISTEN/NOTIFY` do Postgres. Não precisa de Redis: uma escola por instância.
- Eventos sem conteúdo: `atendimento.atualizado`, `mensagem.nova`, `mensagem.status`, com ids. O cliente busca os dados autorizados depois do aviso (mesmo padrão seguro do motor).
- Lista de atendimentos e thread com **cursor** (hoje 200 + 500 e 300 mensagens sem "carregar mais").
- O polling de 30 s (`InboxCliente.tsx:115-135`) sai.

**Aceite:** uma mensagem recebida aparece no Inbox em menos de 2 segundos sem recarregar a página; usuário sem escopo não recebe o aviso.

## E7 — Inbox novo (frontend)

- **Funções e permissões:** seguir a lista oficial `03-funcoes-do-inbox.md` (aprovada).
- Portar do motor os componentes de conversa: lista virtualizada (`VirtualList`), thread (`ChatView`), mensagem (`Message`, inclusive cartão Pix e botões comerciais), compositor com voz e anexos (`Composer`), seletor de emoji, GIF e figurinha (`ContentPicker`, `StickerEditor`), visualizador de mídia (`Media`), enquetes (`Poll`), diálogos de encaminhar, contato e localização (`Dialogs`) e as regras de paginação e âncora. `PhotoEditor` vai para Configurações › Números (foto do número, só Admin).
- **Não portar:** Status (2ª versão), Canais, Comunidades, conversas trancadas, listas pessoais, e **nenhum** asset visual derivado do WhatsApp Desktop.
- **Ações pessoais:** fixar, não lida, silenciar e favoritos ficam **por usuário** no ERP (tabela nova), sem sincronizar com o WhatsApp. "Arquivar" vira encerrar atendimento.
- Estilo: Tailwind + componentes do ERP + o design system novo do produto.
- Dados: route handlers / Server Actions do ERP + SSE de E6. O front nunca fala com o motor.
- Painel lateral por setor: Comercial (oportunidade), Financeiro (títulos e cobranças), Secretaria (matrícula e documentos), Pedagógico (turma e frequência).
- Filtros: setor, número, responsável, status do atendimento, não lidas, prazo estourado.
- Indicadores: "Enviada pelo celular", autor de cada mensagem (atendente, Aria, sistema), participante em grupos.
- Ações: assumir, atribuir, transferir para outro setor, convidar participante, encerrar, nota interna (nunca vira mensagem), agendar mensagem (`IntencaoMensagem` com `despacharAposEm`).
- Reduzir o intervalo do cron de despacho para 1 minuto, para que mensagens agendadas saiam no horário.

**Aceite:** as 21 regras do levantamento WhatsApp §4.4 cobertas por teste; mobile funcional (o desenho do CRM já tem a versão de celular).

## E8 — CRM novo (fora deste documento)

Depois do Inbox: Oportunidade (`model Oportunidade` com `@@map("Lead")`, sem renomear a tabela, para não reescrever as 4 funções SQL de desistência e segunda chamada), camada de Contato/Pessoa, Funil, Contatos, Tarefas, Comissões, Agente de IA (Aria), Relatórios e Configurações. Só então saem `/leads` e a ficha antiga, com "Preparar contratação" já movido. Terá um plano próprio.

---

## Ordem

```
E0 → E1 ─────────────┐
     motor M1–M5 → E2 ┼→ E3 → E4 → E5 → E6 → E7 → E8
```

E1 não depende do motor e pode começar logo depois de E0.

## Perguntas em aberto

1. **SECRETARIA_ACADEMICA** continua vendo FINANCEIRO e PEDAGOGICO (comportamento atual) ou passa a ver só SECRETARIA (D6)?
2. Quem faz a **triagem** padrão de um número de vários setores: ADMINISTRADOR ou um papel de recepção?
3. **Prazo de primeira resposta** por setor: quais valores?
4. Limite de mídia único (10 MB hoje no ERP, 32 MB no motor).
5. Para grupos sem vínculo com turma: quais setores podem ver?
