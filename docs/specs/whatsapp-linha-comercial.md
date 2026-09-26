# SPEC-ERP-005 — Linha comercial do WhatsApp

> Estado em 26/09/2026: **especificação aprovada; Fases 0, 2, 3 e 4 codificadas com testes escritos,
> ainda sem execução** (o worktree não tinha dependências instaladas nem banco de teste — ver §9 e o
> quadro de entregas). Decisões tomadas pelo responsável do produto em 26/09/2026 a partir de testes
> em produção.
> Complementa os docs [26](../26-whatsapp-v1.md), [30](../30-whatsapp-spec-implementacao.md),
> [36](../36-politica-de-acesso-aprovada.md) e [37](../37-detalhamento-operacional-do-acesso.md);
> onde houver conflito sobre números de finalidade VENDAS, prevalece esta SPEC (decisão LC-D01).

## 1. Problema

Em produção, o administrador conecta um número de vendas, escolhe o vendedor como dono e a
inbox do vendedor continua vazia. Contato desconhecido que escreve para esse número não aparece
para ninguém além do administrador (triagem).

Causa: todo número é tratado como **canal institucional**. A mensagem só vira atendimento
quando o sistema consegue deduzir o assunto — num número de vendas, só quando o contato já tem
lead (`atendimentoDoInbound`, `src/server/whatsapp/atendimentos.ts`). Ser dono do número não
concede leitura (`escopoAtendimentos`, `src/server/whatsapp/escopo.ts`). Sem lead, a mensagem
fica com `atendimentoId = null` e só aparece na triagem administrativa.

Isso é correto para o número da escola (cobrança, secretaria, pedagógico), onde um mesmo
telefone mistura assuntos que pessoas diferentes não podem ver. Não é correto para o número de
vendas conectado por QR: ele é o WhatsApp de trabalho do vendedor, e o vendedor já vê todas as
conversas no próprio celular. A inbox tem de espelhar o aparelho.

## 2. Dois modelos de número

| | Canal institucional | Linha comercial |
|---|---|---|
| Números | `finalidade` COBRANCA e AGENDA | `finalidade` VENDAS |
| Unidade da inbox | Um atendimento por **assunto** (FINANCEIRO, SECRETARIA, PEDAGOGICO) | Um atendimento por **conversa** (finalidade COMERCIAL) |
| Contato sem vínculo | Triagem administrativa | Atendimento da linha, visível ao dono |
| Acesso | Vínculo com o assunto (docs 36/37) | Dono atual da linha, gerente comercial da equipe do dono, administrador |
| Histórico do aparelho | Não se aplica | Últimos 30 dias importados ao conectar (só BAILEYS) |

**Invariante LC-I01:** nada do canal institucional muda. Toda regra desta SPEC é condicionada a
`NumeroWhatsApp.finalidade = VENDAS`.

## 3. Decisões

| ID | Decisão |
|---|---|
| LC-D01 | Número de VENDAS é uma linha comercial: toda conversa 1:1 do número aparece na inbox, com ou sem lead. Exceção explícita à regra "número remetente não substitui carteira" (doc 37 §6.6), restrita ao **conteúdo da conversa**. |
| LC-D02 | Acesso à conversa da linha: dono atual da linha (`NumeroWhatsApp.donoId`), gerente comercial cuja equipe inclui o dono (`Usuario.gerenteComercialId`), administrador. Cobertura de carteira (`CoberturaCarteira`) **não** dá ao substituto acesso à linha do titular — regra implementada e testada; o substituto continua vendo os leads cobertos pela regra de carteira. Mudar isso é decisão de produto, não código pendente. |
| LC-D03 | O histórico segue a linha: quando o dono muda, o novo dono vê todas as conversas, inclusive as anteriores. A troca continua auditada (evento já emitido por `salvarNumeroWhatsApp`). |
| LC-D04 | Ao conectar uma linha BAILEYS, importar o histórico das conversas 1:1 dos **últimos 30 dias**. Nada anterior é gravado. |
| LC-D05 | Lead: a Configuração Comercial decide (`ConfigComercial.autoLeadAtivo`, já existente). Ligado → o 1º inbound real de contato sem vínculo cria o lead do dono da linha, como hoje. Desligado → a conversa aparece sem lead e mostra o botão **"Criar lead"**. |
| LC-D06 | Configuração do WhatsApp (números, QR, templates, política) permanece com administrador e gerente comercial nos escopos atuais (`secoes.ts`). O vendedor não conecta nem configura o número; vê o estado da própria linha só em leitura (doc 37: "equipes consultam disponibilidade do canal"). |

## 4. Limites de acesso preservados

Ver a conversa da linha **não** amplia nenhum outro acesso:

- **LC-L01** Contato que é aluno ou responsável: o vendedor vê as mensagens trocadas na linha
  (já estão no aparelho dele), mas o atendimento continua COMERCIAL sem `alunoId`/`matriculaId`.
  Ficha do aluno, financeiro, matrícula e pedagógico seguem as regras do doc 37.
- **LC-L02** Lead de outra carteira: a conversa aparece na linha, mas o painel do lead (etapa,
  notas, copiloto, transições) só é exibido se o lead estiver em `escopoComercialAtual` do
  usuário. Hoje `leadNaThread` não confere a carteira porque só chegava ali quem já tinha o lead
  no escopo — com LC-D01 a conferência passa a ser obrigatória.
- **LC-L03** Linha de outro vendedor fora da equipe: negada, inclusive por id direto (thread,
  envio, mídia `/api/files`, busca, contadores). A regra anterior continua somando: quem tem o
  lead da conversa na carteira (ou é participante vigente) também vê aquela conversa.
- **LC-L03b** Numa linha, o acesso sem lead vem só da posse atual da linha: o antigo critério
  "atendimento sem lead cujo responsável sou eu" deixa de valer para números de VENDAS (senão o
  dono anterior manteria acesso após a troca, contrariando LC-D03/LC-L05).
- **LC-L04** FINANCEIRO, SECRETARIA_ACADEMICA, PROFESSOR e GERENTE_PEDAGOGICO não passam a ver
  linhas comerciais.
- **LC-L05** Revogações valem no próximo acesso: remover o dono, desativar a linha, encerrar
  cobertura ou mudar a equipe corta o acesso sem migração de dados.

## 5. Comportamento

### 5.1 Atendimento único da linha

- Numa linha, cada conversa (`ConversaWhatsApp`, par número+contato) tem **no máximo um**
  atendimento COMERCIAL aberto, com chave de contexto fixa (`COMERCIAL:LINHA`), sem depender do
  lead. Encerrado não reabre: a próxima mensagem abre outro (`COMERCIAL:LINHA:2`…), com o
  histórico anterior preservado no encerrado — nunca vai para a triagem.
- Se a conversa da linha já tem um atendimento **institucional** aberto (ex.: pedagógico aberto
  pela escola nesse número), o roteamento institucional continua valendo para ela (LC-I01).
- Exceção: dois leads diferentes com o mesmo telefone mantêm atendimentos próprios, como antes.
- Toda mensagem da linha — entrada, saída pelo ERP e saída pelo celular (`fromMe`) — é associada
  a esse atendimento. Não há triagem para linha comercial.
- `responsavelId` do atendimento não governa o acesso da linha (o acesso vem de LC-D02); fica
  como o dono no momento da criação, para auditoria.
- Vincular ou criar lead **atualiza `leadId` no mesmo atendimento**. Hoje
  `vincularContatoWhatsApp` chama `garantirAtendimento` com o novo `leadId`, que gera outra chave
  e outro atendimento, partindo o histórico — na linha isso deixa de acontecer.
- Atendimentos comerciais já existentes em números de VENDAS (chave `COMERCIAL:<leadId>:...`)
  continuam válidos e passam a ser tratados como o atendimento da linha daquela conversa.
- Mensagens órfãs da linha (`atendimentoId = null`, paradas na triagem) são adotadas pelo
  atendimento da linha, contando as entradas como não lidas. Sem migração de dados: o backfill é
  idempotente e roda ao salvar o número e a cada tick do cron (`/api/whatsapp/cron`, lote de 50
  conversas).

### 5.2 Inbound em tempo real

Mantém todas as regras atuais de ingestão (dedupe, opt-out por palavra, cancelamento de
intenções automáticas, captura C1/C2, saudação reativa). Muda só o roteamento: em VENDAS,
`atendimentoDoInbound` sempre devolve o atendimento da linha (criando-o se preciso). Se a captura
C1 criar ou vincular lead na mesma transação, o lead é gravado nesse atendimento.

### 5.3 Criar lead pela conversa

Visível quando a conversa da linha não tem lead e o usuário (vendedor, gerente comercial ou
administração) a enxerga. Com a criação automática ligada o botão raramente aparece — só em
conversas que não passaram pela captura (histórico importado, contato que já era aluno). Usa o
mesmo miolo de `criarLeadDeInboundWhatsApp` (código, `LeadCriado` com origem `whatsapp_linha`,
`LeadAtribuido`), com autor = usuário da sessão e dono = dono atual da linha (linha sem dono:
quem cria, se for vendedor). Dedupe por telefone (gap 17): telefone que já é lead só vincula;
telefone de aluno/responsável é recusado com orientação para cadastrar pela tela de Leads.
Segundo clique é recusado ("Esta conversa já tem lead").

### 5.4 Importação do histórico (BAILEYS)

- Assinar os eventos de histórico da Evolution na criação/reconexão da instância (hoje
  `EVENTOS_WEBHOOK` em `sessao.ts` assina só MESSAGES_UPSERT, MESSAGES_UPDATE,
  CONNECTION_UPDATE e QRCODE_UPDATED).
- Gravar só conversas 1:1 e mensagens com data nos últimos 30 dias contados da conexão.
- **Sem efeitos colaterais:** mensagem histórica não dispara captura de lead, saudação,
  resposta de experimental, opt-out por palavra, cancelamento de intenções, nem incrementa
  `naoLidas`. Ela só entra no log e atualiza `ultimaMensagemEm` quando for mais recente.
- Idempotente pelo `@@unique([numeroId, providerMessageId])` existente; reconexão não duplica.
- O filtro de 30 dias é aplicado antes de tocar o banco; o que sobra é gravado em lotes de 200
  mensagens por transação (`createMany` com `skipDuplicates`), dentro da chamada do webhook. Sem
  tabela de preparo (evita migração de schema); se uma chamada falhar, o reenvio reimporta sem
  duplicar. Mídia histórica entra sem binário (tipo e legenda preservados).
- A recência da conversa só avança: histórico nunca recua `ultimaMensagemEm` de uma conversa viva.
- O WhatsApp envia o histórico **no momento em que o aparelho é vinculado**, e manda o histórico
  recente (a instância não é criada com sincronização completa). Linha já conectada antes desta
  entrega: clicar em "Conectar QR" atualiza os eventos assinados, mas o histórico só chega num
  novo vínculo (desconectar o aparelho e ler o QR de novo).
- Números META_CLOUD não têm histórico disponível pela API; valem só as mensagens novas.

### 5.5 Inbox

- Filtro "Minha linha / Institucional" quando o usuário tem acesso aos dois tipos.
- Estado da linha (conectado, aguardando QR, sessão caiu) visível ao dono em leitura, com
  orientação para acionar o administrador/gerente.
- Em "Abrir atendimento", a lista de números oferecida ao comercial passa a ser só as linhas às
  quais ele tem acesso (hoje lista todos os números ativos, inclusive cobrança).

## 6. Entregas

| Fase | Conteúdo | Depende de |
|---|---|---|
| 0 | Webhook Evolution: conferir no payload real da v2.3.7 se contatos chegam como `@lid` e, em caso positivo, resolver o telefone pelo campo alternativo em vez de descartar; registrar em log eventos descartados. | — |
| 1 | Esta SPEC + ajustes nos docs 26/36/37 e no índice. | — |
| 2 | Atendimento único da linha (§5.1–5.2), escopo LC-D02, limites LC-L01–L05, "Criar lead" no servidor, adoção das mensagens de VENDAS paradas na triagem (backfill idempotente, sem migração). | 1 |
| 3 | Importação do histórico (§5.4). | 2 |
| 4 | Telas (§5.3 botão, §5.5). | 2 |

## 7. Critérios de aceite

| ID | Cenário | Resultado esperado |
|---|---|---|
| LC-01 | Contato desconhecido escreve para a linha do vendedor A, auto-lead desligado | Conversa aparece na inbox de A, sem lead, com "Criar lead"; não aparece na triagem |
| LC-02 | Idem com auto-lead ligado | Lead criado com dono A, vinculado ao mesmo atendimento; conversa na inbox de A |
| LC-03 | Vendedor B (outra equipe, sem cobertura) pede a conversa de LC-01 por id | Negado em thread, envio, mídia, busca e contador |
| LC-04 | Gerente comercial de A abre a inbox | Vê as conversas da linha de A; gerente de outra equipe não vê |
| LC-05 | Vendedor A responde pelo celular | Mensagem entra como SAIDA no mesmo atendimento |
| LC-06 | A cria lead numa conversa com mensagens anteriores | Um único atendimento com todo o histórico e `leadId` preenchido |
| LC-07 | Contato da linha é aluno matriculado | A vê as mensagens da linha; ficha/financeiro/matrícula do aluno continuam negados |
| LC-08 | Contato da linha é lead da carteira de C | A vê a conversa; painel do lead (notas, etapa, copiloto) oculto para A |
| LC-09 | Dono da linha muda de A para D | D vê todas as conversas, inclusive anteriores; A perde o acesso no próximo pedido |
| LC-10 | Linha conectada com histórico de 90 dias no aparelho | Só as mensagens dos últimos 30 dias são gravadas; nenhuma saudação, lead, cancelamento ou não lida gerado |
| LC-11 | Evento de histórico reenviado | Nenhuma mensagem duplicada |
| LC-12 | Mensagem chega em número de COBRANCA de contato sem vínculo | Vai para a triagem como hoje |
| LC-13 | FINANCEIRO/SECRETARIA abre a inbox | Não vê conversas de linhas comerciais |
| LC-14 | Mensagem de grupo, broadcast ou status na linha | Não é gravada |
| LC-15 | Mensagens de VENDAS que estavam na triagem antes da Fase 2 | Associadas ao atendimento da linha pela migração; somem da triagem |

## 8. Implementação (26/09/2026)

| Fase | Arquivos |
|---|---|
| 0 | `src/server/whatsapp/evolution-jid.ts` (+ teste), `src/app/api/whatsapp/webhook/evolution/route.ts` (+ teste). LID resolvido por `remoteJidAlt`/`senderPn`; descarte inesperado registrado em log sem telefone nem conteúdo. |
| 2 | `linha-comercial.ts` (atendimento único, roteamento, donos visíveis, backfill), `atendimentos.ts`, `escopo.ts`, `consultas-inbox.ts` (LC-L02, `linhaComercial`, `podeCriarLead`, linhas do usuário), `acoes.ts` (`criarLeadDaConversa`, backfill ao salvar), `operacoes-atendimento.ts` (linhas por destino), `comercial/captura.ts` (autor/origem), `api/whatsapp/cron/route.ts` (backfill). |
| 3 | `historico.ts` (+ teste), `sessao.ts` (assina `MESSAGES_SET`), rota do webhook (`messages.set`). |
| 4 | `inbox/page.tsx`, `InboxCliente.tsx` (filtro de canal, estado da linha, "sem lead", "Criar lead"), `AtendimentosPainel.tsx` (canal conforme a finalidade), `busca-inbox.ts` (filtro puro). |

Sem migração de schema nem de dados. Testes: `linha-comercial.int.test.ts` (LC-01…LC-15 e §5.5),
ajustes em `acesso-atendimento.int.test.ts` (fixture com linha sem dono; o caso do dono da linha
passou para o arquivo novo) e `destinatario-atual.int.test.ts` (encerrado comercial numa linha
abre outro atendimento; financeiro continua na triagem), unitários de rota, histórico, busca,
página e cron, e registro do botão "Criar lead" em `botoes-mapa.ts`.

## 9. Verificação

Executado em 26/09/2026 (worktree sem `node_modules` próprio; binários locais do checkout principal,
sem install; `DATABASE_URL` forçado para endereço inalcançável durante os testes):

- TypeScript (`tsc --noEmit`, strict) nos 29 arquivos alterados e tudo o que importam, contra o
  Prisma Client gerado do schema DESTE worktree numa pasta temporária: saída 0, nenhum erro.
  Controle com três erros propositais acusou exatamente os três.
- ESLint nos 29 arquivos: saída 0.
- Vitest unitário completo (mesma configuração do projeto, trocando só `@prisma/client` pelo client
  gerado deste schema): 2519 testes aprovados; 10 arquivos falham por ambiente, fora do WhatsApp e
  sem relação com esta entrega — pacotes ausentes no `node_modules` do checkout principal
  (`pdfkit`, `google-auth-library`: contratos, gravações, reposições, portal) e fim de linha CRLF
  no `docker-compose.coolify.yml` do checkout Windows (`coolify-db-init`). O teste da rota do cron
  já estourava o tempo antes desta entrega (rotinas sem mock tentavam o banco); agora todas estão
  mockadas.

Travas unitárias no `npm test` comum (revisão R1 da PR #128, B1): `linha-comercial.test.ts`,
`escopo-atendimentos.test.ts` e `historico.test.ts` prendem, com Prisma mockado, o escopo da linha
(LC-D02/L03/L03b/L05), o roteamento (§5.1–5.2, LC-I01), o backfill (LC-15) e o histórico sem efeitos
(LC-10/LC-11). Treze mutações dessas garantias (ramo da linha, `ativo`, exclusão do responsável em
VENDAS, equipe do gerente, filtros e não lidas do backfill, ramo institucional, linha inativa,
janela, `skipDuplicates`, `ultimoInboundEm` e `naoLidas` no histórico) foram aplicadas uma a uma:
todas derrubaram a suíte unitária com teste nomeado; fontes restaurados.

Verificação a cargo do integrador e do tester (não há código pendente — tudo está na entrega):

- **Integração** (`vitest run -c vitest.integration.config.ts`): `linha-comercial.int.test.ts` e as
  suítes de WhatsApp ajustadas não rodaram — não havia banco descartável (Docker indisponível) e o
  AGENTS.md reserva ao integrador subir o ambiente.
- Conferir no payload real da Evolution v2.3.7 o nome do campo do telefone alternativo do LID e o
  formato do evento de histórico (`messages.set`: lista ou `{ messages }` — a rota aceita os dois).

## 10. O que esta correção não faz, e por quê

Nada do que corrige o problema reportado ficou para depois: todo o código das Fases 0–4 está nesta
entrega. Os itens abaixo não fazem parte do problema e não são implementação adiada:

- Transferir uma conversa isolada entre vendedores: a linha inteira muda de dono (LC-D03); regra do doc 26.
- Mais de um dono por linha: uma linha é o WhatsApp de um vendedor.
- Histórico em número META_CLOUD: a API oficial não entrega histórico.
- Grupos, status e broadcast: nunca entram no ERP (gap 18).
- Envio real durante o desenvolvimento: vedado pelo AGENTS.md.
