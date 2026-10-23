# Auditoria 03: Inbox, WhatsApp e comunicações

> Auditoria de leitura (código × documentação), branch `qa/auditoria-e-onboarding` (= `main` + kit de QA), 21/10/2026.
> Nada foi executado (sem npm/npx), nada foi alterado fora deste arquivo.
> Precedência usada: (1) SPECs `docs/specs/*.md`; (2) doc 37; (3) doc 41 e `docs/planejamento/quadro-entregas.md`;
> (4) docs 26 e 28 a 32 (originais, parcialmente obsoletos). Regra: especificação não comprova implementação.
> Linhas citadas como `arquivo:linha` referem-se ao estado desta branch.

## Resumo

**Critérios normativos** (tabela "Critérios LC-01..LC-15 e das specs de avisos", 38 linhas):

| Status | Qtde |
|---|---|
| CONFORME | 30 |
| DIVERGENTE | 4 (LC-02, LC-14, LC-D06, §5.5 filtro de canal) |
| NAO_IMPLEMENTADO | 3 (LC-10, LC-11, §5.5 estado da linha) |
| PARCIAL | 1 (AG-05, template de agenda) |
| SEM_DOC | 0 |

**Tabela de achados** (27 linhas; os achados 6 a 11 e 18 repetem critérios acima com o efeito na interface):

| Status | Qtde |
|---|---|
| CONFORME | 6 |
| DIVERGENTE | 8 |
| NAO_IMPLEMENTADO | 2 |
| PARCIAL | 6 |
| SEM_DOC | 5 |

**Os 5 achados mais importantes**

1. **"Não lidas" nunca zeram no Inbox novo.** Abrir a conversa não chama `marcarConversaLida` nem `marcarLida` (nenhum chamador na UI; `src/app/(app)/inbox/InboxNovo.tsx:169-177`). O contador do menu soma `AtendimentoWhatsApp.naoLidas` (`src/server/whatsapp/consultas-inbox.ts:78-81`), que só é zerado por `marcarConversaLida` (`src/server/whatsapp/acoes.ts:329-347`). Resultado: o selo do menu e o filtro "Não lidas" só crescem. A lista oficial de funções (`docs/planejamento/funcoes-do-inbox.md:24`) diz que abrir a conversa marca como lida.
2. **Em UAT, o que o atendente envia pela Inbox some.** Sem `WHATSAPP_LIVE=1` toda intenção, inclusive a humana, vira `SIMULADA` (`src/server/whatsapp/despachante.ts:123-130`, `:389-397`). O despachante só cria `MensagemWhatsApp` no envio real (`despachante.ts:521-541`), e a thread lê apenas `MensagemWhatsApp` (`src/server/inbox/consultas-pagina.ts:165-176`). O compositor limpa o campo sem aviso (`src/components/conversa/Compositor.tsx:137-155`). Não há tela que liste as intenções da Inbox; só o DEV vê no banco (`IntencaoMensagem.status = 'SIMULADA'`, `motivoFalha = 'ambiente_sem_live'`).
3. **Ações diretas do motor não passam pela chave `WHATSAPP_LIVE`.** Encaminhar, reagir, editar, apagar, "digitando", confirmação de leitura, bloquear, grupos e perfil do número chamam o motor direto (`src/server/whatsapp/motor/acoes-mensagem.ts:56, 76, 107, 145, 261, 322, 358, 398`; `src/server/whatsapp/acoes.ts:341`). Só o despachante confere a chave (`despachante.ts:30-31`, `:166`). Hoje esses botões ficam desabilitados porque exigem sessão `CONECTADO`. Se alguém parear um celular real no UAT (o QR aparece quando o motor está no ar), essas ações sairiam de verdade.
4. **A nota interna é gravada e não aparece em lugar nenhum.** "Nota interna" grava `Evento NotaInterna` no atendimento (`src/server/whatsapp/acoes-conversa.ts:23-45`). A thread só traz notas do **lead**, e só no comercial com lead (`consultas-pagina.ts:180-183`; `consultas-inbox.ts:204-209`). `notasDoAtendimento` (`acoes-conversa.ts:47`) não tem chamador na UI, e o retorno `notas` não é renderizado. O contexto obrigatório da transferência também vira nota interna (`src/server/whatsapp/acoes-atendimento.ts:203`) e o destinatário não o vê. O próprio quadro registrava "Inbox sem nota interna" como pendência da Fase 3 (`docs/planejamento/quadro-entregas.md:188`).
5. **O roteiro de QA existente está desatualizado para esta área.** `docs/qa/03-roteiro-testes-manuais.md` espera:
   - PROF sem Inbox (CRM-28; matriz em `:462`), mas PROF e GP estão em `PAPEIS_INBOX` (`src/server/whatsapp/escopo.ts:16-24`);
   - auto-lead "Criar lead automaticamente" (CRM-30), que saiu com o CRM antigo (`prisma/schema.prisma:2789-2790`; `src/server/whatsapp/linha-comercial.int.test.ts:85`);
   - réguas comerciais com painel "Ensaio" (CRM-32 a 34), também removidas;
   - painéis "Comercial" e "Réguas" e a aba WhatsApp para o GC (CFG-23/24), mas hoje só o ADM vê a configuração (`src/app/(app)/configuracao/whatsapp/secoes.ts:6-22`);
   - aviso "Ensaio (shadow)" e nota visível na Inbox (CRM-31), que a Inbox não mostra (achados 2 e 4).

   Não há rota nem ferramenta para simular uma mensagem recebida: o DEV precisa assinar um POST HMAC para o webhook do motor (ver a seção de UAT).

## Mapa de telas e rotas

| rota | arquivo | papéis (guard real) | o que faz | Status vs doc |
|---|---|---|---|---|
| `/inbox` | `src/app/(app)/inbox/page.tsx:29` | `exigirSessaoPagina(...PAPEIS_INBOX)`: ADM, GC, VEND, FIN, SEC, PROF, GP (`escopo.ts:16-24`). O que cada um vê vem de `escopoAtendimentos` (`escopo.ts:47-104`) | Lista paginada por cursor, conversa e painel do setor; "Abrir atendimento" (`NovoAtendimento.tsx`); triagem para o ADM ou o responsável pela triagem do número (`page.tsx:36-45`; `operacoes-atendimento.ts:222-245`); revisão de falhas só para o ADM (`page.tsx:46`) | PARCIAL (achados 1, 2, 4, 10, 12, 13) |
| `GET /api/inbox/atendimentos` | `src/app/api/inbox/atendimentos/route.ts:12-29` | sessão + `PAPEIS_INBOX` (401/403) | Página da lista. `envio=1` devolve só os destinos onde o usuário pode enviar (diálogo de encaminhar) | CONFORME |
| `GET /api/inbox/atendimentos/[id]/mensagens` | `.../[id]/mensagens/route.ts:11-28` | sessão + `PAPEIS_INBOX`; 404 fora do escopo | Thread por cursor (`antes`/`depois`) | CONFORME |
| `GET /api/inbox/atendimentos/[id]/painel` | `.../[id]/painel/route.ts` | sessão + `PAPEIS_INBOX`; 404 fora do escopo | Painel por setor (`src/server/inbox/paineis.ts:31-95`) | CONFORME |
| `GET /api/inbox/eventos` | `src/app/api/inbox/eventos/route.ts:34-46` | sessão + `PAPEIS_INBOX`. Revalida o usuário a cada 60 s; a conexão vive no máximo 15 min | SSE só com ids; o filtro é o escopo (`src/server/inbox/eventos-sse.ts`) | CONFORME (achado 17) |
| `POST /api/whatsapp/upload` | `src/app/api/whatsapp/upload/route.ts:18-55` | `PAPEIS_INBOX` + escopo de envio do atendimento | Upload de mídia de saída, até 10 MB | CONFORME |
| `POST /api/whatsapp/webhook/motor` | `src/app/api/whatsapp/webhook/motor/route.ts:40-75` | Sem sessão. HMAC-SHA256 (`motor/assinatura.ts:7-22`), janela de 5 min, teto de 1 MB, cabeçalho `x-motor-evento` igual a `idEvento`. 503 se faltar `MOTOR_URL`/`MOTOR_API_KEY`/`MOTOR_WEBHOOK_SECRET` (`motor/config.ts:12-20`) | Grava o evento (dedupe por `idEvento`) e drena depois da resposta (`after`) | CONFORME |
| `POST /api/whatsapp/cron` | `src/app/api/whatsapp/cron/route.ts:37-89` | `x-cron-secret` (503 sem `CRON_SECRET`, 401 se errado) | Tick único com 14 rotinas (ver "Crons") | CONFORME |
| `POST /api/whatsapp/despacho` | `src/app/api/whatsapp/despacho/route.ts:8-14` | `x-cron-secret` | Só drena a fila, incluindo mensagens agendadas vencidas | CONFORME |
| `GET /api/whatsapp/health` | `src/app/api/whatsapp/health/route.ts:12-21` | `x-cron-secret` | Saúde do canal: 200 ou 503 com motivos | CONFORME (doc 30 E5) |
| `POST /api/agenda/avisos/cron` | `src/app/api/agenda/avisos/cron/route.ts:6-13` | `x-cron-secret` + `COMUNICACOES_AGENDA_ENVIO_ENABLED=true` | Envia e-mail de agenda, enfileira o WhatsApp de agenda e drena só a agenda | CONFORME (desligado por padrão) |
| `POST /api/portal-aluno/envios/cron` | `src/app/api/portal-aluno/envios/cron/route.ts:8-23` | `x-cron-secret` + `EMAIL_PORTAL_ENVIO_ENABLED=true` | E-mails de convite, recuperação e troca de e-mail do portal | CONFORME (desligado por padrão) |
| `/configuracao/whatsapp` | `src/app/(app)/configuracao/whatsapp/page.tsx:11-15`, `layout.tsx:10-12` | ADM ou GC na leitura; o GC não tem seção e é redirecionado para `/home` (`secoes.ts:6-7`) | Redireciona para a 1ª seção visível | DIVERGENTE da LC-D06 (achado 9) |
| `/configuracao/whatsapp/numeros` | `.../numeros/page.tsx:12` | só ADM (`secoes.ts:15-18`; ação `acoes.ts:628`) | Cadastro (todo número novo nasce MOTOR: `NumerosPainel.tsx:23`), dono, finalidade COBRANCA/VENDAS/AGENDA (`:203-206`), setores e triagem (`:270-310`), conectar por QR ou código, desconectar, perfil do número | CONFORME |
| `/configuracao/whatsapp/templates` | `.../templates/page.tsx:9` | só ADM | Modelos de automação (`acoes.ts:860-920`) | CONFORME |
| `/configuracao/whatsapp/politica` | `.../politica/page.tsx:9` | só ADM | Política da régua de cobrança (estado, janela, teto, silêncio, kill switch, degraus) | CONFORME |
| `/configuracao/whatsapp/avisos-agenda` | `.../avisos-agenda/page.tsx:9` | só ADM | Número AGENDA do motor + template com `{horarios}` (`acoes.ts:738-778`) | PARCIAL (AG-05) |
| `/configuracao/operacao/avisos-diario` | `src/app/(app)/configuracao/operacao/avisos-diario/page.tsx:8` | só ADM | Prazo de regularização e intervalo de lembrete, em minutos | CONFORME |
| `/diario/pendencias` | `src/app/(app)/diario/pendencias/page.tsx:17` | PROF, GP, ADM | Painel de pendências do diário; o aviso é reconciliado ao consultar | CONFORME |
| `/secretaria/avisos-agenda` | `src/app/(app)/secretaria/avisos-agenda/page.tsx:15` | SEC, ADM | Filas paginadas de avisos e de pendências; "Reconferir" | CONFORME |
| `/secretaria/envios-portal` | `src/app/(app)/secretaria/envios-portal/page.tsx:19` | SEC, ADM | Fila de e-mails do portal (abas Incertos/Falhas/Todos) e conciliação de incerto | CONFORME |
| `/matriculas/[id]/autorizacoes-comunicacao` | `src/app/(app)/matriculas/[id]/autorizacoes-comunicacao/page.tsx:11` | SEC, ADM | Autoriza um responsável como destinatário acadêmico | CONFORME |
| `/financeiro` (fila de cobrança) | `src/app/(app)/financeiro/FilaCobranca.tsx:176-184, 767` | ver auditoria 05 | Envio pela API (degrau devido) e lote; mostra o estado da última intenção ("Simulada (ensaio)") | CONFORME |
| `/tarefas` | `src/lib/nav.ts:25-28` | ADM, GC, VEND, FIN, SEC | Mensagens agendadas e o status real do despachante ("Simulada": `src/lib/labels.ts:642-650`) | CONFORME |

## Critérios LC-01..LC-15 e das specs de avisos

### SPEC-ERP-005 (linha comercial), `docs/specs/whatsapp-linha-comercial.md`

| critério | evidência arquivo:linha | Status |
|---|---|---|
| LC-01: contato desconhecido na linha de A aparece para A, sem lead, com "Criar lead"; fora da triagem | Roteamento: `linha-comercial.ts:77-102` e `atendimentos.ts:113-119`. Botão: `consultas-inbox.ts:84-91`; o rótulo na tela é "Criar oportunidade" (`inbox/AcoesContato.tsx:79`). Teste: `linha-comercial.int.test.ts:68` | CONFORME |
| LC-02: com auto-lead ligado, o lead nasce com dono A | O auto-lead não existe mais: `ConfigComercial` sem `autoLeadAtivo` (`schema.prisma:2789-2806`), e `inbound.ts:55-175` não cria lead. O teste confirma a mudança (`linha-comercial.int.test.ts:85`, "o auto-lead saiu com o CRM antigo") | DIVERGENTE |
| LC-03: vendedor B (outra equipe) negado por id em thread, envio, mídia, busca e contador | `escopo.ts:65-78`; mídia: `uploads/autorizacao.ts:160-161`. Teste: `linha-comercial.int.test.ts:109-123` | CONFORME |
| LC-04: gerente vê a linha de A; desde a Fase 3, gerente de outra equipe também | `escopo.ts:84-85` (gerente do setor vê todo o COMERCIAL). Teste: `linha-comercial.int.test.ts:125` | CONFORME |
| LC-05: resposta pelo celular entra como SAIDA no mesmo atendimento | `inbound.ts:85-95, 150-159`; motor: `motor/processar-mensagem.ts:71-75`. Teste: `linha-comercial.int.test.ts:166` | CONFORME |
| LC-06: criar lead mantém um atendimento só, com o histórico e o `leadId` | `acoes.ts:388-454` (`updateMany` no mesmo atendimento). Teste: `linha-comercial.int.test.ts:177` | CONFORME |
| LC-07: aluno na linha: A vê as mensagens; ficha, financeiro e matrícula continuam negados | `acoes.ts:430-432` (recusa criar lead para aluno). Teste: `linha-comercial.int.test.ts:231` | CONFORME |
| LC-08: lead de outra carteira: A vê a conversa, sem o painel do lead | `consultas-pagina.ts:180-183` (`podeVerLeadNaThread`). Teste: `linha-comercial.int.test.ts:251` | CONFORME |
| LC-09: troca de dono: D vê o histórico e A perde o acesso | `linha-comercial.ts:153-174` (posse atual), `escopo.ts:70`. Teste: `linha-comercial.int.test.ts:271` | CONFORME |
| LC-10: histórico de 30 dias importado sem efeitos colaterais | Removido: `importarHistoricoLinha` saiu na R1 da #221 (cabeçalho da SPEC, `whatsapp-linha-comercial.md:8-12`); não encontrado no código | NAO_IMPLEMENTADO |
| LC-11: reenvio do histórico não duplica | Idem LC-10 (só resta o dedupe geral `@@unique([numeroId, providerMessageId])`, `schema.prisma:2584`) | NAO_IMPLEMENTADO |
| LC-12: número COBRANCA com contato sem vínculo vai para a triagem | `atendimentos.ts:128-137`. FINANCEIRO só abre com matrícula única (`atendimentos.ts:140-147`). Teste: `linha-comercial.int.test.ts:286` | CONFORME |
| LC-13: FIN e SEC não veem linha comercial | `setor.ts:44-53` (SEC: SECRETARIA, FINANCEIRO e PEDAGOGICO; sem COMERCIAL). Teste: `linha-comercial.int.test.ts:134` | CONFORME |
| LC-14: grupo, broadcast e status não são gravados | Grupos **são** gravados como conversa de grupo, sem atendimento (`motor/processar-mensagem.ts:124`; `grupos.ts:29`; `GrupoWhatsApp`, `schema.prisma:2461-2474`), por decisão posterior (`funcoes-do-inbox.md:31-32`). Filtro de status e broadcast não encontrado no ERP: depende do motor | DIVERGENTE |
| LC-15: mensagens de VENDAS paradas na triagem vão para o atendimento da linha | `linha-comercial.ts:110-147`; roda no cron (`api/whatsapp/cron/route.ts:59`) e ao salvar o número (`acoes.ts:719-727`). Teste: `linha-comercial.int.test.ts:311` | CONFORME |
| LC-D06: configuração com ADM **e GC** | Só ADM (`configuracao/whatsapp/secoes.ts:6-7, 15-22`; ações com `exigirSessaoComPapel(ADMINISTRADOR)` em `acoes.ts:628, 740, 786, 862, 942`) | DIVERGENTE |
| §5.3: "Criar lead" com dedupe e segundo clique recusado | `acoes.ts:388-454` | CONFORME |
| §5.5: filtro "Minha linha / Institucional" | Não existe. Os filtros são aba, setor, número, status e busca (`src/server/inbox/filtros.ts:5-30`; `inbox/PainelFiltros.tsx:45-49`) | DIVERGENTE |
| §5.5: estado da linha (conectado/QR/caiu) visível ao dono | `listarLinhasDoUsuario` existe (`consultas-inbox.ts:194`) mas não tem chamador na UI; o doc 37 (`:133`) também pede "equipes consultam disponibilidade do canal" | NAO_IMPLEMENTADO |
| §5.5: em "Abrir atendimento", o comercial só vê as próprias linhas | `operacoes-atendimento.ts:107-112, 139`. Teste: `linha-comercial.int.test.ts:360-386` | CONFORME |

### SPEC-ACA-N01 (avisos de alterações da agenda), `docs/specs/avisos-alteracoes-agenda.md`

| critério | evidência arquivo:linha | Status |
|---|---|---|
| AG-01: aviso criado por matrícula e canal na mesma transação que aplica remarcação, substituição, replanejamento, quantidade (Q38) ou aditivo | `comunicacoes-agenda/avisos.ts:39-50` (origens aceitas), `:85-99` | CONFORME |
| AG-02: só matrículas com vínculo histórico no encontro | `avisos.ts:51-62` (`alocacaoDaMatriculaCobreEncontro`); evento incompatível lança erro (`:50`, `:62`) | CONFORME |
| AG-03: chave por evento, matrícula e canal (WhatsApp com hash do contato) sem duplicar | `avisos.ts:88-97` | CONFORME |
| AG-04: pendências `SEM_DESTINATARIO_AUTORIZADO` e `CONTATO_SEM_OPT_IN` na transação | `avisos.ts:68-84` | CONFORME |
| AG-05: WhatsApp exige número AGENDA ativo e template **aprovado**, de **categoria** e idioma compatíveis | `comunicacoes-agenda/whatsapp.ts:85-92` confere número AGENDA/MOTOR ativo, idioma e variáveis `{nome}`/`{horarios}`. **Não confere** categoria nem `statusMeta` (aprovação); `acoes.ts:749-752` idem | PARCIAL |
| AG-06: enfileiramento mantém `PREPARADO` e registra `CONFIGURACAO_INDISPONIVEL`, `CONTATO_INDISPONIVEL` ou `CONTATO_SEM_OPT_IN`, sem tentativa | `whatsapp.ts:122-125`. Só roda dentro do cron de agenda (`avisos.ts:151-167`), que fica desligado por padrão | CONFORME |
| AG-07: reconferência por SEC/ADM com observação, revalidando o papel atual | `comunicacoes-agenda/reconferencia.ts`; UI `secretaria/avisos-agenda/ReconferirPendencia.tsx`; guard da consulta `consultas.ts:21-26` | CONFORME |
| AG-08: RECUSADO→FALHOU, INCERTO→INCERTO, ACEITO→ENVIADO; sem reenvio automático | `avisos.ts:106-149`; WhatsApp: `despachante.ts:568` e `whatsapp.ts:193-200` | CONFORME |
| AG-09: Q38 só alcança o provedor com `COMUNICACOES_AGENDA_QUANTIDADE_ENVIO_ENABLED` | `avisos.ts:83`; `envio-gate.ts:11` | CONFORME |
| AG-10: transporte automático desligado até homologação | `envio-gate.ts:4`; `.env.example:73-75`; compose `docker-compose.coolify.yml:102-104`. O despachante geral retém avisos (`despachante.ts:143-146, 384-388`) | CONFORME |

### Q22 (avisos de pendências do diário), `docs/specs/avisos-pendencias-diario.md`

| critério | evidência arquivo:linha | Status |
|---|---|---|
| DI-01: só AULA prevista cujo término já chegou | `src/server/diario/avisos-pendencias-diario.ts:80` (`finalidade: "AULA", status: "PREVISTO", fim <= agora`) | CONFORME |
| DI-02: professor só com atribuição vigente ou designação; gestão vê o conjunto sem escrever | `avisos-pendencias-diario.ts:44-75` | CONFORME |
| DI-03: ADM configura minutos positivos; sem configuração, nada de prazo implícito, e o painel avisa | `:244-266`; aviso na tela: `diario/pendencias/page.tsx:30` | CONFORME |
| DI-04: o primeiro aviso ao docente sai no término; a gestão é alertada a partir do vencimento | `:112-146` (`primeiroLembrete`) | CONFORME |
| DI-05: só dentro do ERP, reconciliado ao consultar, sem job nem envio externo | `:145-152`; sem cron (ver "Crons") | CONFORME |
| DI-06: sem duplicidade por encontro, destinatário e tipo | `@@unique encontroId_destinatarioId_tipo` usada em `:116-118` | CONFORME |
| DI-07: alteração de configuração auditada com antes e depois | `:258-259` (`AvisosPendenciasDiarioConfigurados`, `de`/`para`) | CONFORME |
| DI-08: paginação | `LIMITE = 20` (`:10`), cursor nos dois sentidos (`:148-190`) | CONFORME |

## Como funciona em UAT sem integrações reais

### Chaves de ambiente (`.env.example:32-75`; compose de UAT/produção `docker-compose.coolify.yml:70-104`)

| chave | padrão | efeito |
|---|---|---|
| `WHATSAPP_LIVE` | vazio | O despachante transforma toda intenção que passaria em `SIMULADA`, com `motivoFalha = ambiente_sem_live` (`despachante.ts:166, 389-397`), inclusive a humana. **Não** cobre as ações diretas do motor (achado 3) |
| `MOTOR_URL`, `MOTOR_API_KEY`, `MOTOR_WEBHOOK_SECRET` | obrigatórias no compose (`:79-81`); o motor é outro container (`:126-141`) | Sem as três (chaves com 32+ caracteres), o webhook responde 503 e conectar/QR dá erro. Com o motor no ar, o QR aparece de verdade: **não escanear** |
| `RESEND_API_KEY`, `EMAIL_INSTITUCIONAL_REMETENTE` | vazias | Não há modo simulado de e-mail: sem chave, `enviarEmailResend` lança `ErroConfiguracaoEmail` (`src/server/email/resend.ts:22-31`) |
| `EMAIL_PORTAL_ENVIO_ENABLED` | `false` | Cron do portal responde `{executou:false, motivo:"envio_desligado"}` (`portal-aluno/envios/cron/route.ts:12-14`); solicitações ficam `PREPARADO` |
| `COMUNICACOES_AGENDA_ENVIO_ENABLED` / `..._QUANTIDADE_ENVIO_ENABLED` | `false` | Cron de agenda não processa; avisos ficam `PREPARADO`; o despachante retém intenções de agenda (`envio_agenda_desligado`) |
| `ANTHROPIC_API_KEY` | vazio | Aria usa provedor local "simulado" (fora do escopo desta auditoria) |

### O que dá para testar pela interface

- Configuração do canal pelo ADM: números, setores, triagem, templates, política, avisos da agenda e avisos do diário.
- "Abrir atendimento" (`operacoes-atendimento.ts:122-220`) cria conversa e atendimento **sem** precisar de mensagem recebida. Isso permite testar escopo, lista, filtros, ações (assumir só vale na fila), transferir, convidar, encerrar, agendar, fixar, silenciar e opt-out.
- O envio pela Inbox: o resultado volta `ok`, mas a mensagem **não aparece** na conversa (achado 2).
- Régua de cobrança: armar a política em "Ensaio" exige número remetente MOTOR ativo (`acoes.ts:957-976`). O envio pela fila de cobrança mostra a nota "Ensaio (shadow): D0 simulado — nada foi enviado de verdade." (`FilaCobranca.tsx:180`). A linha da cobrança mostra "Braço API · <passo>: Simulada (ensaio)" (`FilaCobranca.tsx:767`; `labels.ts:639`).
- Mensagem agendada: depois do horário, o cron-despacho (60 s) marca `SIMULADA`; aparece em `/tarefas` como "Simulada".
- Avisos de agenda: depois de uma alteração aprovada (remarcação, substituição etc., área de agenda), `/secretaria/avisos-agenda` mostra o aviso "E-mail · Preparado" ou "WhatsApp · Preparado", ou uma pendência ("Contato sem aceite de comunicações", "Sem destinatário acadêmico autorizado").
- E-mails do portal: `/secretaria/envios-portal`, aba **Todos** (a tela abre em "Incertos"), mostra "Convite de acesso · Preparado".
- Avisos do diário: totalmente testáveis (são internos ao ERP).
- Tempo real: duas janelas com usuários diferentes; mudanças de atendimento (assumir, devolver, convidar) chegam por SSE sem F5. Atendimento **novo** não gera aviso SSE para os outros (achado 17).

### O que não dá para testar em UAT

- Entrega, leitura e status ENTREGUE/LIDA (sem motor real; um DEV pode simular `mensagem.status`).
- Tudo que exige sessão `CONECTADO` no motor fica visível e desabilitado com a dica "Disponível quando o motor próprio da escola entrar em uso." (`src/components/conversa/recursos-canal.ts:7-13`): editar, apagar, reagir, encaminhar, enquete, figurinha, GIF, localização, contato, responder citando, confirmação de leitura, "digitando", grupos e bloquear. "Bloquear" fica desabilitado sempre (`inbox/AcoesAtendimento.tsx:91`).
- Link do convite do portal: o token só vai no e-mail, que não sai.
- Pareamento por QR: **proibido** usar celular real (AGENTS.md: "Não enviar mensagens/e-mails reais").

### Onde ver o que "teria sido enviado"

| origem | onde o QA vê | onde o DEV confirma |
|---|---|---|
| Resposta na Inbox (texto/mídia) | Em lugar nenhum da interface | `SELECT id, "corpoRenderizado", status, "motivoFalha", "criadaEm" FROM "IntencaoMensagem" WHERE origem='HUMANO' ORDER BY "criadaEm" DESC` |
| Cobrança (botão, lote, cron em Ensaio) | Fila de cobrança (`FilaCobranca.tsx:176-184, 767`) | mesma tabela, `"cobrancaId" IS NOT NULL` |
| Mensagem agendada | `/tarefas` (status "Simulada") e "Convites e agendamentos" no atendimento enquanto pendente | `"agendadaPara" IS NOT NULL` |
| Aviso de agenda | `/secretaria/avisos-agenda` | `"AvisoAlteracaoAgenda"`, `"PendenciaAvisoAgenda"` |
| E-mail do portal | `/secretaria/envios-portal` (aba Todos) | `"SolicitacaoEnvioPortalAluno"` |
| Falhas de envio | Revisão de falhas no painel de triagem (só ADM: `operacoes-atendimento.ts:294-330`) | `status='FALHOU'` |

### [DEV] Simular uma mensagem recebida (não existe rota de simulação)

Não há endpoint de teste, seed de conversas (`prisma/seed-whatsapp.ts` só cria templates e a política DESLIGADA, `:6-8, 24-29`) nem ferramenta na UI. O único caminho é o webhook do motor com assinatura válida (`webhook/motor/route.ts:51-69`; `motor/assinatura.ts:18`: HMAC-SHA256 de `"<timestamp>.<corpo>"`, timestamp em segundos, janela de 5 min).

```sh
SEGREDO="$MOTOR_WEBHOOK_SECRET"; TS=$(date +%s); MS=$(date +%s000); ID=$(uuidgen | tr A-Z a-z)
NUM="<NumeroWhatsApp.id>"   # providerRef do número MOTOR = id do número (acoes.ts:699)
CORPO='{"idEvento":"'$ID'","tipo":"mensagem.recebida","numeroId":"'$NUM'","ocorridoEm":'$MS',"dados":{"mensagemId":"50670001111@s.whatsapp.net:QA'$TS'","providerMessageId":"QA'$TS'","chatJid":"50670001111@s.whatsapp.net","ehGrupo":false,"contato":{"telefoneE164":"+50670001111","nomePerfil":"Cliente QA"},"tipo":"TEXTO","texto":"Olá, quero informações","quando":'$MS'}}'
SIG=$(printf '%s.%s' "$TS" "$CORPO" | openssl dgst -sha256 -hmac "$SEGREDO" -hex | sed 's/^.* //')
curl -sS -X POST "https://<host-uat>/api/whatsapp/webhook/motor" -H "content-type: application/json" \
  -H "x-motor-timestamp: $TS" -H "x-motor-assinatura: $SIG" -H "x-motor-evento: $ID" --data "$CORPO"
```

- Resposta do celular (LC-05): `"tipo":"mensagem.enviada"` com `"origem":"celular"` em `dados` (`motor/processar-mensagem.ts:66-75`).
- Opt-out por palavra: texto exatamente `parar`, `sair`, `stop`, `baja`, `no enviar` ou `unsubscribe` (`inbound.ts:46-51`).
- O dreno também roda no cron de 5 min (`api/whatsapp/cron/route.ts:61`).
- Não simular `sessao.estado = CONECTADO`: liga os botões do motor, que chamariam o container real (achado 3).

## Crons e cadências

| rotina | rota/arquivo | gatilho | o que faz | ligada por padrão? |
|---|---|---|---|---|
| Tick geral | `POST /api/whatsapp/cron` (`route.ts:37-89`) | serviço `cron`, a cada 300 s (`docker-compose.coolify.yml:145-158`) | Roda em sequência: reservas particulares, início de turmas, acesso por vencimento, acesso a aulas, **régua de cobrança**, fechamento de comissões, fechamentos pendentes, **backfill da linha comercial** (LC-15), **dreno dos eventos do motor**, lembretes de tarefas, **alertas de SLA**, Aria (reprocessar/expirar) e **despacho** | Agendador ligado no compose; cada rotina tem a própria trava |
| Régua de cobrança | `src/server/whatsapp/cron.ts:46-58` | dentro do tick | Degraus de fábrica: D-7/D-3/D0 AUTOMATICO, D+3/D+7 LOTE, D+15 MANUAL (`src/server/cobrancas/fabrica.ts:13-20`; o D+15 nunca automático: `acoes.ts:911-917`). Para em `politica_desligada`, `kill_switch`, `sem_numero_remetente` ou `trava_driver_oficial` | **Não**: política nasce DESLIGADA (`schema.prisma:2755`; `seed-whatsapp.ts:24-29`). Em "Ensaio", gera intenções que viram SIMULADA |
| Cadências comerciais (lead novo, pré-experimental, no-show), saudação, auto-lead, gestão C5 | removidas com o CRM antigo (`schema.prisma:2789-2790`; `despachante.ts:244-245, 636-639`) | — | Intenções que sobraram são canceladas (`politica_comercial_alterada`, `configuracao_gestao_alterada`) | Não existem |
| Despacho | `POST /api/whatsapp/despacho` (`route.ts:8-14`) | serviço `cron-despacho`, 60 s (`compose:160-172`) | Drena a fila (inclui agendadas vencidas); recupera claims órfãos como `FALHOU` (`despachante.ts:175-180`) | Sim; sem `WHATSAPP_LIVE` tudo vira SIMULADA |
| Alertas de SLA | `src/server/whatsapp/alertas-sla.ts` (no tick) | 5 min | Prazo da 1ª resposta estourado vira notificação no sino, uma vez por atendimento; sem envio externo | Sim (depende do `PrazoRespostaSetor` em Configuração › CRM › Distribuição) |
| Lembretes de tarefas | `src/server/crm/lembretes.ts` (no tick) | 5 min | Notificação interna | Sim |
| Backfill linha comercial | `linha-comercial.ts:110-147` | tick e ao salvar número VENDAS | Adota mensagens órfãs da linha | Sim |
| Eventos do motor | `src/server/whatsapp/motor/drenar.ts` | `after()` no webhook e no tick | Processa `mensagem.*`, `sessao.*`, `grupo.atualizado`, `chamada.recebida` em ordem de `seq` | Sim (só tem o que processar se o motor enviar) |
| Avisos de agenda | `POST /api/agenda/avisos/cron` | serviço `cron-avisos-agenda`, 300 s (`compose:188-198`) | E-mail (se Resend configurado), enfileirar WhatsApp de agenda, despachar só agenda | **Não** (`COMUNICACOES_AGENDA_ENVIO_ENABLED=false`) |
| E-mails do portal | `POST /api/portal-aluno/envios/cron` | serviço `cron-portal-envios`, 60 s (`compose:174-186`) | Convite, recuperação e validação de troca de e-mail | **Não** (`EMAIL_PORTAL_ENVIO_ENABLED=false`) |
| Saúde do canal | `GET /api/whatsapp/health` | monitor externo (não agendado no compose) | 200/503 | Não agendado |
| Avisos do diário | `src/server/diario/avisos-pendencias-diario.ts:145-152` | ao abrir `/diario/pendencias` | Reconcilia ciclos e lembretes; sem job | Sim, mas só quando alguém consulta, e só com a configuração preenchida |

## Tabela de achados

| # | Tema | Fonte normativa | O que a fonte diz | O que o código faz (arquivo:linha) | Status | O que o QA deve esperar na interface |
|---|---|---|---|---|---|---|
| 1 | Marcar como lida | `funcoes-do-inbox.md:24`; doc 37 `:128` | Abrir a conversa marca como lida | Nenhum chamador de `marcarConversaLida`/`marcarLida` na UI (`InboxNovo.tsx:169-177`); o selo do menu soma `naoLidas` (`consultas-inbox.ts:78-81`; `(app)/layout.tsx:12`) | DIVERGENTE | Depois de uma mensagem recebida, o número no item Inbox do menu e o filtro "Não lidas" não diminuem ao abrir a conversa. Registrar bug |
| 2 | Envio simulado | doc 28 gap A5 / doc 30 S8 (via `despachante.ts:30-31, 372-378`) | Sem LIVE, "registra o que TERIA sido enviado" | Grava `IntencaoMensagem SIMULADA` e não cria `MensagemWhatsApp` (`despachante.ts:389-397`); a thread só lê `MensagemWhatsApp` (`consultas-pagina.ts:165-176`); o compositor limpa o campo sem aviso (`Compositor.tsx:148-150`) | PARCIAL | Texto enviado some do campo e **não** aparece na conversa, sem mensagem de "ensaio". Não é falha de envio; registrar como observação de usabilidade |
| 3 | Chave LIVE e ações do motor | `despachante.ts:30-31`; `.env.example:32-33` | Sem `WHATSAPP_LIVE=1` nenhuma mensagem real sai | Encaminhar, reagir, editar, apagar, digitando, leitura, bloquear, grupos e perfil chamam o motor direto (`motor/acoes.ts:27-40`; `motor/acoes-mensagem.ts:56, 76, 107, 145, 261, 322, 358, 398`; `acoes.ts:341`) | DIVERGENTE | Em UAT os botões ficam desabilitados (sessão não conectada). **Nunca parear um celular real no UAT** |
| 4 | Nota interna | `quadro-entregas.md:188` (pendência "Inbox sem nota interna") | Nota visível na thread | Gravada como Evento do atendimento (`acoes-conversa.ts:23-45`); a thread só mostra notas do lead (`consultas-pagina.ts:180-183`); `notasDoAtendimento` sem chamador (`acoes-conversa.ts:47`); contexto da transferência idem (`acoes-atendimento.ts:203`) | PARCIAL | "Nota interna registrada" com sucesso, mas a nota não aparece em lugar nenhum; quem recebe uma transferência não vê o contexto. Registrar bug |
| 5 | Simulação de mensagem recebida | AGENTS.md (sem envio real) | — | Sem rota/seed de teste; só o webhook HMAC (`webhook/motor/route.ts:40-75`), que dá 503 sem as 3 chaves do motor (`motor/config.ts:12-20`) | SEM_DOC | Cenários [DEV] dependem do DEV assinar o POST (receita na seção de UAT) |
| 6 | Auto-lead | SPEC-ERP-005 LC-02/LC-D05 | Auto-lead ligado cria o lead do dono | Removido (`schema.prisma:2789-2790`; `inbound.ts` não cria lead; teste `linha-comercial.int.test.ts:85`) | DIVERGENTE | Toda conversa nova na linha chega **sem** lead, com o botão "Criar oportunidade". Não procurar o toggle "Criar lead automaticamente" |
| 7 | Histórico de 30 dias | LC-D04, LC-10, LC-11 | Importar o histórico ao conectar | Saiu na R1 da #221 (`whatsapp-linha-comercial.md:8-12`); não encontrado | NAO_IMPLEMENTADO | Ao conectar, nada antigo aparece. Não testar |
| 8 | Grupos | LC-14 × `funcoes-do-inbox.md:31-32` | LC-14: grupo não é gravado; lista oficial: grupo visto e enviado por quem tem acesso | Grupo vira conversa de grupo sem atendimento (`processar-mensagem.ts:124`; escopo `escopo.ts:134-150`) | DIVERGENTE (a SPEC está superada) | Conversas de grupo aparecem com ícone, sem status nem responsável (`ConversaAberta.tsx:120-121`); envio em grupo exige o motor |
| 9 | Quem configura o canal | LC-D06 | ADM e GC | Só ADM, decisão D21 (`secoes.ts:6-7`) | DIVERGENTE | GC em `/configuracao/whatsapp` vai para a Home; URL direta de uma seção → "Acesso negado". Não é bug (D21); a SPEC está desatualizada |
| 10 | Estado da linha para o vendedor | §5.5; doc 37 `:133` | Dono vê conectado/aguardando QR/caiu | `listarLinhasDoUsuario` sem chamador na UI (`consultas-inbox.ts:194`) | NAO_IMPLEMENTADO | O vendedor não vê o estado da própria linha na Inbox |
| 11 | Filtro de canal | §5.5 | "Minha linha / Institucional" | Abas Todas/Minhas/Fila/Não lidas/Prazo estourado + setor/número/status/busca (`PainelFiltros.tsx:45-49`; `filtros.ts:15-30`) | DIVERGENTE | Usar o filtro "Número" para separar a linha das institucionais |
| 12 | Bloquear contato | `funcoes-do-inbox.md:33` | Admin e gerentes, motivo obrigatório | Ação existe (`motor/acoes-mensagem.ts:310-340`), mas o botão é sempre `disabled` (`AcoesAtendimento.tsx:91`) | PARCIAL | Botão "Bloquear" visível (ADM/gerentes) e sempre desabilitado |
| 13 | Funções sem tela | `funcoes-do-inbox.md:21-35` | Favoritar, marcar não lida, digitando, enquete, figurinha, GIF, localização, contato, grupos (criar/participantes/enviar) | Servidor pronto (`preferencias.ts:45, 64`; `motor/acoes-mensagem.ts:206, 246, 273, 344, 388`) sem chamador na UI; comandos ligados só `copiar/reagir/encaminhar/editar/apagar` (`ConversaAberta.tsx:54`) | PARCIAL | Não procurar "Favoritar"/"Marcar como não lida" no menu da mensagem |
| 14 | Alçadas assumir/devolver/atribuir/transferir/convidar | — (doc 03 não define) | — | Proposta da Tarefa 14 "a confirmar com o produto (Pendência 8)" (`src/server/inbox/permissoes.ts:36-73`) | SEM_DOC | Assumir: só da fila. Devolver/transferir/convidar: responsável ou gerente do setor. Atribuir: só gerente do setor/ADM. Registrar o observado |
| 15 | Encerrar atendimento | — | — | COMERCIAL só GC/ADM; FINANCEIRO só FIN; SECRETARIA só SEC; PEDAGOGICO GP/SEC (`operacoes-atendimento.ts:336-350`; `permissoes.ts:29-34`) | SEM_DOC | VEND não vê "Encerrar atendimento" nem na própria linha |
| 16 | Secretaria no Inbox | Q1 provisória (`setor.ts:9-15`) | — | SEC vê SECRETARIA, FINANCEIRO e PEDAGOGICO (`setor.ts:48-51`) | SEM_DOC | SEC vê a fila financeira e pedagógica; não abrir bug até o PO decidir a Q1 |
| 17 | Tempo real de atendimento novo | Fase 3 bloco D (`quadro-entregas.md:72-80`) | Lista atualiza por SSE | O trigger só avisa INSERT/UPDATE de mensagem e UPDATE de atendimento (`prisma/migrations/20261017100000_inbox_tempo_real/migration.sql:35-39`) | PARCIAL | Atendimento aberto por "Abrir atendimento" só aparece para os outros após F5 |
| 18 | Template de agenda | SPEC-ACA-N01 "Destinatários e canal" | Template aprovado, categoria e idioma compatíveis | Confere só idioma e variáveis (`comunicacoes-agenda/whatsapp.ts:85-92`) | PARCIAL | Qualquer template com `{horarios}` (e opcional `{nome}`) aparece na lista (`AvisosAgendaPainel.tsx:27`), mesmo em "Rascunho" |
| 19 | WhatsApp de agenda em UAT | SPEC-ACA-N01 (transporte desligado) | Desligado até homologação | O enfileiramento só roda no cron de agenda, desligado (`avisos.ts:151-167`) | CONFORME | Avisos WhatsApp ficam "Preparado"; a pendência "Configuração institucional indisponível" **não** aparece só por falta de configuração enquanto o cron estiver desligado (exceto Q38: `avisos.ts:83`) |
| 20 | E-mail | `.env.example:51-62` | Vazio = sem e-mail | Só Resend (`email/resend.ts`); usos: portal (`portal-aluno/envio-resend.ts:20-45`) e aviso de agenda (`avisos.ts:158-161`) | CONFORME | Nenhum e-mail chega; convites ficam "Preparado" |
| 21 | Régua comercial e cadências | docs 27/32 (obsoletos) e roteiro QA CRM-30, 32-34, CFG-23/24 | Réguas "Lead novo", "Pré-experimental", painel "Ensaio", painéis Comercial/Réguas | Removidas (`schema.prisma:2789-2790`; `secoes.ts:17-22`; `despachante.ts:636-639`) | DIVERGENTE | Cenários do roteiro antigo não executáveis; marcar como obsoletos |
| 22 | Papéis com Inbox | roteiro QA CRM-28 e matriz `03-roteiro-testes-manuais.md:462` | PROF "Acesso negado" | PROF e GP entram (`escopo.ts:16-24`; `nav.ts:31-43`); PROF vê só o PEDAGOGICO das turmas atuais (`escopo.ts:95-102`) | DIVERGENTE (roteiro) | PROF/GP abrem a Inbox sem erro |
| 23 | Número AGENDA sem setores | — | — | Finalidade legada AGENDA não mapeia setor (`numero-setor.ts:88-93`); inbound de contato desconhecido vai à triagem | SEM_DOC | Mensagens no número de agenda sem setores ficam na triagem do ADM |
| 24 | Régua de cobrança | doc 26/27 "toda automação nasce desligada" | Desligada por padrão; Ensaio simula | `seed-whatsapp.ts:24-29`; `cron.ts:51`; armar exige número MOTOR (`acoes.ts:957-976`) | CONFORME | Política "Desligada" ao abrir; "Ensaio" exige número remetente |
| 25 | Webhook do motor | doc 37 `:140` | Exige identidade do serviço | HMAC + janela + teto + dedupe (`webhook/motor/route.ts:40-75`; teste `route.test.ts`, 11 casos) | CONFORME | — ([DEV]) POST sem assinatura → 401 |
| 26 | Tempo real e paginação | Fase 3 bloco D; Task 29/30 (`.superpowers/sdd/03-fase-inbox/`) | SSE sem polling; cursor | `api/inbox/eventos/route.ts`; `consultas-pagina.ts:86-189`; trava `sem-polling.test.ts` | CONFORME | Lista com "Carregar mais"; thread com "Mensagens anteriores" |
| 27 | Avisos do diário | Q22 | Interno, por consulta | `avisos-pendencias-diario.ts` | CONFORME | Ver cenários DIA-* |

### Testes existentes por módulo (contagem de arquivos)

| módulo | unitários (`*.test.ts`) | integração (`*.int.test.ts`, fora do CI) |
|---|---|---|
| `src/server/whatsapp` (inclui `motor/` 7+14 e `drivers/` 1+0) | 40 | 63 |
| `src/server/inbox` | 4 | 7 |
| `src/server/comunicacoes-agenda` | 7 | 5 |
| `src/server/diario` (avisos) | — | 1 (`avisos-diario.int.test.ts`) |
| `src/server/email` | 1 (`resend.test.ts`) | 0 |
| `src/app/(app)/inbox` | 15 | 0 |
| `src/app/(app)/configuracao/whatsapp` | 9 | 0 |
| `src/app/(app)/secretaria/avisos-agenda` / `envios-portal` | 2 / 2 | 0 |
| `src/app/api/inbox` / `api/whatsapp` / `api/agenda/avisos` / `api/portal-aluno/envios` | 2 / 3 / 1 / 1 | 0 |
| `src/components/conversa` | 8 | 0 |

Sem teste: `api/whatsapp/health/route.ts` e `api/whatsapp/upload/route.ts`. E2E (`e2e/`): só login e permissões, nada de Inbox. A SPEC-ERP-005 registra que `linha-comercial.int.test.ts` não rodou na sua entrega (`whatsapp-linha-comercial.md:7-8, 224-226`). Depois disso, o quadro registra rodadas de integração por recorte (por exemplo `quadro-entregas.md:55`).

## Cenários de teste para o QA

Usuários: ADM = `admin@`, GC = `gerente@` (Ricardo), VEND-A = `joao@`, VEND-B = `vendedor2@`, FIN = `financeiro@`, SEC = `secretaria@`, PROF = `carla@`, PROF-2 = `professor2@`, GP = `gp@` (ver `docs/qa/02-usuarios-e-papeis.md`).

**Pré-requisito** (ADM, cenários CFG-WA): números "Vendas — João" (VENDAS, dono VEND-A), "Cobrança" (COBRANCA) e "Agenda" (AGENDA); VEND-A com ao menos um lead na carteira.

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| CFG-WA-01 | ADM | Configuração › WhatsApp | Abas: Números, Templates, Política da régua, Avisos da agenda. Sem "Comercial" nem "Réguas" |
| CFG-WA-02 | GC | 1) Clicar Configuração › WhatsApp 2) Digitar `/configuracao/whatsapp/numeros` | 1: vai para a Home. 2: "Acesso negado". Não é bug (D21, achado 9) |
| CFG-WA-03 | ADM | Números › Novo: telefone E.164, rótulo "Vendas — João", finalidade Vendas, dono VEND-A, salvar. Repetir com o mesmo telefone | Número na lista com selo "desconectado", sem escolha de driver. Na repetição: "Já existe um número cadastrado com este telefone." |
| CFG-WA-04 | ADM | No número Cobrança, marcar setores Financeiro e Secretaria; escolher responsável pela triagem; salvar | "Setores salvos." A lista de responsáveis só traz quem tem papel de um dos setores marcados |
| CFG-WA-05 | ADM | Clicar "Conectar" num número | Motor fora: mensagem de erro, nada muda. Motor no ar: QR na tela. **Não escanear**; fechar |
| CFG-WA-06 | ADM | Templates: criar "qa_agenda" com corpo `Olá {nome}, novos horários: {horarios}`, idioma es; criar outro com o mesmo nome | 1º salvo. 2º: "Já existe um template com este nome." |
| CFG-WA-07 | ADM | Política da régua: estado "Ensaio" sem número remetente → salvar; depois escolher o número Cobrança → salvar | 1º: "Defina o número remetente antes de armar a política." 2º: salvo. D+15 continua manual |
| CFG-WA-08 | ADM | Ligar e desligar o kill switch | Estado alterna; a política continua salva |
| CFG-WA-09 | ADM | Avisos da agenda: escolher o número **Vendas** e o template qa_agenda → salvar; depois o número **Agenda** → salvar | 1º: "Escolha um número de agenda ativo do motor WhatsApp." 2º: salvo. Templates sem `{horarios}` não aparecem na lista |
| INB-01 | PROF, GP | Clicar Inbox | Abre sem erro (lista vazia ou só pedagógico). Não é bug, apesar do roteiro antigo CRM-28 (achado 22) |
| INB-02 | VEND-B (sem linha) | Inbox › "Abrir atendimento" | Com lead: aviso "Atendimento comercial sai pela sua linha comercial. Peça à administração para atribuir uma linha a você." Sem lead: "Nenhum lead na sua carteira para iniciar uma conversa…" |
| INB-03 | VEND-A | Abrir atendimento: destino "Comercial · <lead>", canal | O canal só lista a linha "Vendas — João". Abre conversa vazia, status "Em atendimento", "Responsável: João Silva" |
| INB-04 | VEND-A | Na conversa do INB-03, enviar "teste QA" | O campo limpa; nada aparece na thread; sem mensagem de erro (achado 2). Registrar como observação |
| INB-05 | VEND-B | Colar a URL `/inbox?c=<id do INB-03>` | A conversa não carrega (erro ou "sem acesso"); nada do conteúdo de VEND-A aparece |
| INB-06 | GC | Abrir Inbox | Vê a conversa de VEND-A (setor comercial inteiro, LC-04) |
| INB-07 | FIN, SEC | Abrir Inbox; buscar o nome do lead do INB-03 | Não veem a conversa comercial (LC-13) |
| INB-08 | FIN | Abrir atendimento "Financeiro · <aluno> · contrato X" pelo canal Cobrança | Atendimento criado; SEC também o vê na lista (Q1, achado 16) |
| INB-09 | PROF | Abrir atendimento | Só destinos "Pedagógico · <aluno da turma dele>". Aluno sem WhatsApp aparece "· indisponível" com o motivo |
| INB-10 | ADM, SEC | Filtros: abas Todas/Minhas/Fila/Não lidas/Prazo estourado, setor, número, status, busca; dar F5 | A URL muda (`setor=`, `numero=`, `resp=`, `status=`, `naoLidas=1`, `prazo=estourado`) e o F5 mantém o filtro |
| INB-11 | ADM | Com mais de uma página de atendimentos, rolar até "Carregar mais" | Novos itens sem repetir os anteriores |
| INB-12 | VEND-A | Fixar e Silenciar uma conversa; entrar como GC e abrir a mesma | Para VEND-A: "Conversa fixada." / "Silenciada por N horas." Para GC nada muda ("Fixar e silenciar valem só para você.") |
| INB-13 | SEC | Num atendimento de secretaria aberto por ela: Transferir → Financeiro com contexto curto, depois com 12+ caracteres | Curto: botão desabilitado. Válido: "Atendimento transferido."; o novo atendimento é do setor Financeiro (exige número que atenda o setor) |
| INB-14 | SEC | Depois do INB-13, entrar como FIN e abrir o atendimento transferido | Cabeçalho indica a origem; o **contexto não aparece** (achado 4). Registrar bug |
| INB-15 | VEND-A | Nota interna: escrever e salvar | Mensagem de sucesso; a nota **não aparece** na conversa nem no painel (achado 4). Registrar bug |
| INB-16 | SEC | Convidar FIN com motivo de menos de 10 caracteres; depois válido, "Pode enviar" desmarcado, prazo 2 dias | Curto: botão desabilitado. Válido: FIN passa a ver o atendimento e não consegue enviar ("Você não pode enviar nesta conversa.") |
| INB-17 | SEC | "Convites e agendamentos" › Revogar convite; FIN com a conversa aberta | O convite some; o painel do FIN trava sem ações e o compositor bloqueia (tempo real) |
| INB-18 | VEND-A, GC | Conversa comercial: VEND-A procura "Encerrar atendimento"; GC encerra | VEND-A não tem o botão (achado 15). GC confirma; status "Encerrado"; compositor bloqueado |
| INB-19 | VEND-A | "Agendar mensagem" para daqui a 5 min (dentro da janela); abrir "Convites e agendamentos"; após 5 min ver `/tarefas` | Aparece em "Mensagens agendadas"; depois do horário, `/tarefas` mostra "Simulada" e a thread não muda |
| INB-20 | VEND-A | Agendar para um horário passado ou fora da janela de envio | Recusado com mensagem de horário/janela; nada é agendado |
| INB-21 | ADM, VEND-A | Marcar opt-out do contato; tentar enviar; reautorizar (só ADM) | Envio recusado: "O contato pediu para não receber mensagens (opt-out)…". VEND-A não vê "reautorizar"; ADM vê |
| INB-22 | VEND-A | Abrir o menu de uma mensagem e conferir Bloquear | Reagir/Encaminhar/Editar/Apagar ausentes ou desabilitados ("Disponível quando o motor próprio da escola entrar em uso."); "Bloquear" (só ADM/gerentes) sempre desabilitado |
| INB-23 | VEND-A, GC | Duas janelas na mesma conversa da fila de um setor; GC/ADM clica "Assumir" | A outra janela atualiza o responsável sem F5. Um segundo "Assumir" simultâneo recebe "Outro atendente já assumiu este atendimento." |
| INB-24 | [DEV] + VEND-A, GC, ADM, VEND-B | DEV simula mensagem recebida de telefone novo na linha "Vendas — João" | VEND-A, GC e ADM veem a conversa nova, sem lead e com "Criar oportunidade"; não aparece na triagem; VEND-B não vê (LC-01, LC-03) |
| INB-25 | VEND-A | Na conversa do INB-24: "Criar oportunidade"; clicar de novo | Lead criado com dono VEND-A, no mesmo atendimento; o 2º clique devolve o mesmo lead, sem duplicar (LC-06) |
| INB-26 | [DEV] + VEND-A | DEV simula mensagem de um telefone que é de **aluno**; VEND-A clica "Criar oportunidade" | Recusa: "Este telefone já pertence a um aluno ou responsável. Cadastre o lead pela tela de Leads…" (LC-07) |
| INB-27 | [DEV] + VEND-A | DEV simula `mensagem.enviada` com `origem: celular` na mesma conversa | Aparece como saída, no mesmo atendimento (LC-05) |
| INB-28 | [DEV] + ADM, VEND-A | DEV simula mensagem de contato desconhecido no número **Cobrança** | ADM vê no painel de triagem e pode classificar num atendimento; VEND-A não vê (LC-12) |
| INB-29 | [DEV] + VEND-A | DEV simula mensagem com texto exatamente "parar" | O contato fica em opt-out; o próximo envio é recusado |
| INB-30 | [DEV] + VEND-A | Depois do INB-24, conferir o número do item Inbox no menu; abrir a conversa; recarregar | O número aumenta com a mensagem e **não zera** ao abrir (achado 1). Registrar bug |
| INB-31 | ADM, VEND-A, VEND-B | ADM troca o dono da linha "Vendas — João" para VEND-B; os dois recarregam a Inbox | VEND-B vê todas as conversas da linha, inclusive as anteriores; VEND-A deixa de ver (LC-09) |
| INB-32 | ADM, VEND-A | ADM desativa a linha; VEND-A recarrega | VEND-A perde o acesso às conversas da linha (LC-L05) |
| COB-01 | FIN | Política Desligada, com número remetente; numa cobrança com ação devida: "Cobrar via API" › confirmar | Nota "Ensaio (shadow): <passo> simulado — nada foi enviado de verdade."; a linha mostra "Braço API · <passo>: Simulada (ensaio)" |
| COB-02 | [DEV] + FIN | Política em "Ensaio"; DEV dispara `/api/whatsapp/cron` duas vezes | Cobranças D-7/D-3/D0 com "Simulada (ensaio)"; o 2º disparo não duplica; D+3/D+7 (lote) e D+15 (manual) não saem sozinhos |
| COB-03 | FIN | Marcar dois itens e "Aprovar e enviar lote" | Resultado com contagem e "simulada(s) (ensaio)" |
| AGE-01 | SEC | Depois de uma remarcação aprovada (roteiro de agenda) de aluno com e-mail e aceite de comunicações: `/secretaria/avisos-agenda` | Aviso "<aluno>", "E-mail · Preparado"; o texto da tela diz que aceite do provedor não confirma entrega |
| AGE-02 | SEC | Repetir com um aluno sem aceite de comunicações | Pendência "Contato sem aceite de comunicações · Pendente" com "Reconferir" e o link "Conferir destinatários acadêmicos" |
| AGE-03 | SEC | Reconferir a pendência do AGE-02 sem corrigir o aluno, com observação | A pendência continua (ou a tela explica por que não encerra); nenhum envio |
| AGE-04 | PROF, FIN | Digitar `/secretaria/avisos-agenda` e `/secretaria/envios-portal` | Acesso negado nas duas |
| AGE-05 | SEC | `/matriculas/<id>/autorizacoes-comunicacao`: autorizar um responsável pedagógico com evidência | Autorização registrada com autoria; aparece como destino pedagógico em "Abrir atendimento" |
| DIA-01 | PROF | Sem configuração: `/diario/pendencias` | Aviso "Os prazos de regularização e lembrete do diário ainda não foram configurados." (o ADM vê o link para configurar) |
| DIA-02 | ADM | Configuração › Operação › Avisos do diário: 0 ou negativo; depois prazo 60 e intervalo 30 | Valores inválidos recusados; válidos salvos |
| DIA-03 | PROF, PROF-2 | Com uma aula prevista de PROF já terminada e sem diário: os dois abrem `/diario/pendencias` | PROF vê a pendência da aula (turma e horário, sem dados pessoais do aluno); PROF-2 não vê |
| DIA-04 | GP | Abrir `/diario/pendencias` antes e depois de vencer o prazo | Vê o conjunto com "Acompanhamento da gestão: alertas começam somente depois do prazo de regularização." |
| POR-01 | SEC | Preparar o convite do portal de um aluno (área do portal); `/secretaria/envios-portal` › aba Todos | "Convite de acesso · Preparado"; abas Incertos e Falhas vazias; nenhum e-mail chega |
| CRON-01 | [DEV] | POST nos crons sem `x-cron-secret`; depois com o segredo em `/api/agenda/avisos/cron` e `/api/portal-aluno/envios/cron` | Sem segredo: 401. Com segredo: `{"executou":false,"motivo":"envio_desligado"}` |
| WH-01 | [DEV] | POST no webhook do motor: (a) sem assinatura; (b) assinado com timestamp de 10 min atrás; (c) assinado corretamente, mas com `x-motor-evento` diferente do `idEvento` | 401 "Assinatura inválida." nos dois primeiros; 400 "Evento divergente do cabeçalho." no terceiro |
