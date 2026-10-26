# Inbox #376 — presença automática D6

Em validação: DEV passou checkpoint nativo10 e regressão nativa17 na fonte3dd. QA independente, gates compostos e homologação visual ainda pendentes. Equipes são setores atuais; carga371 e presença são informações distintas. Sem distribuição automática, grants370 ou nova capacidade de transferência.

## Semântica e lifecycle

Somente InboxNovo montado registra presença. O SSE compartilhado continua literal e pode permanecer conectado pelo selo externo: isso não abre inscrição de presença. Uma inscrição por usuário/aba, gerações por abertura, self-bound pela sessão. Entrada deliberada registra atividade UTCservidor uma vez; replay/StrictMode não renovam. Reconexão técnica preserva última interação e exige pulso próprio.

PulsoPOST25s enquanto SSEOPEN observado pelo cliente; não é prova de recepçãoSSE no servidor. Pulse nunca atualiza atividade. Interação na árvoreReactInbox (inclusive portais) envia só marcador/seq; sem teclas/conteúdo, coalescida1s. Online depende de confirmação+leaseviva+atividade<600s, ausente sem atividade recente, offline quando expira60s. Close só marca desligada e pode ficarofflineimediato; nunca altera contato/atividade nem ressuscita lease expirada. Crash usaTTL, sem grace adicional.

CAS abrir exige inscriçãoEsperada(id|null) e geraçãoEsperada; após retenção/newID não pode confundirgeração1. SeqBigIntmonotônica e ID+geração em pulso/close/atividade. FalhaCAS nunca viraupsert. Limite8inclui inscrições recém-abertas não confirmadas, serializado porUser; retenção24h limpa sópróprias antigas em lote16, sem apagarvivas e sem worker global. Dedup não é eterno após apagar registro efêmero.

## Segurança e dados

POST /api/inbox/presenca exige Origin igual ao NEXTAUTH_URL configurado, Sec-Fetch-Site same-origin, JSON e X-Inbox-Presenca:1. Sem CORS/Hostfallback/tokenextra. Config ausente/inválida503; erro de presença não bloqueia Inbox/transferência. Header é defesa CSRF de navegador, não autorização. Payload<=4KiB/parserstrict, zero timestamps absolutos deatividade vindosbrowser. Volume porprocesso240/min/usuário é proteção auxiliar, não estado compartilhado/autorização.

Writer: Usuario FOR NO KEY UPDATE→atorfresh→Presenca FOR UPDATE→atorfresh→clock_timestamp Postgres após espera. Userausente recusa. Nenhum lockAtendimento/Lead/Acao/Config ou consulta global dentroTX. Leitor usa contextoPessoas canônico extraído para módulo interno db-aware, preservando API/policy/query histórica de371. Candidatos atuais atribuir, origem visível/aberta/nãogrupo, papéis/setor atuais, sem owner-peer370. Retorna só IDsjáoferecidos e enum; semlastseen/conexão/CRM/conteúdo. BigInt foraSafeInteger não viraNumbercego nemstatusinventado.

## Snapshot e UI

Presença opcional nos radios mantém Nome + segunda linha carga/status, seleção, rascunho, chave e payload. Missing/falha é “Presença indisponível”, nãoOnline/0. Offline/ausente não bloqueiam transferência autorizada.

Foto tem tokenModal e validade RELATIVA global limitada ao próximo deadline600/60 e<=25s. Cliente usa performance.now desdeINÍCIOrequest para descontar latência. Expiração degrada paraindisponível ANTESuma releituraautorizada; rearma sórespostafresca. TTLinválido/fotoantiga/erro não geraloop. Fechar/trocar modal cancela timer e descarta resposta antiga. Heartbeat pode transportar consulta do modalaberto, semreconsultarcarga/lista/CRM; fotoemcurso coalescida.

Exceção nominal fechada: somente src/lib/presenca-inbox-cliente.ts admite1intervalo25s e1timeoutvalidade. Mutantes URL/cadência/módulo/GET/timerextra/router.refresh/header negados. SSE/AvisoInbox não foram alterados.

## Infra e limites

Migração reservadaROOT49620261025203000_inbox_presenca_d6, modeloPresencaInbox efêmero, FKUsuarioCASCADE/RESTRICT, índicesbatch/cleanup. ROOT aplicou/validou, gerou clientpróprio3bafe670 e forneceu snapshot505linhas/426hashes; contagemREAL494migrações/426tabelas, não496migrações. SemSQLDEVatélease. Nunca usarrestaurador493grant; ROOTusa preservar-banco-ciint-b496-private.mjs.

Uma leitura batchpresença por observador maisACL/candidatos/revalidação; não uma consultaSQLtotal. Custos reais/native/pool1/locks/cleanup/limite8 e visual ainda precisam validação. Schema/pins atuais no relatório. #370 continua aguardandoautorizaçãohumana, semescopo/grantligado.

### Hardening antes do native

Leitura de inscrição porid também inclui usuarioId no predicado findFirst, não lê rowalheia para sódepois recusar. Atividade real coalescida durante uma requisição de interação é drenada após terminar essa requisição, respeitando1s e geração, sem esperar o próximo pulso25s e sem timer novo.

### Revogação e escopos de erro

401/403 do ator e404não-modal encerram ciclo/bindingvivo/seq/atividadependente e subscriptionSSE; invalidam foto/observador e impedem ACKdeabrir/foto/pulso antigos. CapturesReact permanecem inertes semciclo, sem criar nova inscrição. Só ErroFotoPresenca do contexto/cap específico produz404modal: cancela apenas observador, semderrubar batimento próprio. Pulso comconsulta mantém confirmação própria e retornaerroFoto tipadomodal; revogação de ator duranteleitor nunca vira404modal nem503foto. 409expiração segue recuperaçãoCAS técnica, semtransformar erro deautorização emreconexão.

CheckpointCAS não élease: sessionStorage guarda sóid/geração opacos porusuário eaba, semfoto/atividade/grant. Runtimebinding/seq são zerados na revogação; ACKantigo não regrava o ponteiro. Ele sópode ser lido em futuraentradaDELIBERADA apósrestauração legítima eauthfresh/CASservidor; logout/trocausuário não reutiliza checkpointalheio. Nenhuma retomada automática apósrevogação.

### Instante do relógio no adapter

Raw clock_timestamp()::timestamptz(3) preserva instante UTC no Date do Prisma, mesmo com sessãoPostgres em America/Sao_Paulo. Schema/SQL496 continuam TIMESTAMP(3) semfuso; Prisma serializa o DateUTC canonicamente. Não usar cast timestamp que descarte fuso antesdo adapter, CURRENT_TIMESTAMP deinícioTX, SETTIMEZONE ou mudança deenv paraocultarcondição. Holdernativo usa rawaware para não comparar doisrelógios igualmenteerrados.

### Abrir pendente compartilhado por usuário e aba

O broker reserva promessa ANTES do transporte. Se sair/reentrar antes do ACK de abrir, o próximo ciclo aguarda apenas o ponteiro CAS retornado da mesmaaba/usuário e faz sua própria abertura deliberada/authfresh. Não herda confirmação, atividade ou foto. Cleanup/finally antigos só removem sua própria promessa, e ciclos intermediários cancelados repassam apenas ponteiro, sem criar vida. Checkpointstorage também é explicitamente porusuário+aba; ACKdeoutraaba não sobrescreve ponteiro atual.

Rejeição de abrir anterior por401/403/rede encerra geração seguidora e foto semNULLupsert ou retryautomático. Recuperação em futuraentradaDELIBERADA apósACKperdido ainda exige investigação do replayexato dointent antigo ou contratoROselfbound aprovado; não prometer recuperação atéretenção nem inventar bypass. Esse ponto segue pendente separado antesaceite completo.

### Resolver SELF para futura entrada deliberada após ACK perdido

POSTJSON estrito `{modo:"resolver",abaId:UUID}` retorna somente `{checkpoint:{id,geracao}|null}`. Mesma defesa Origin/NEXTAUTH_URL/headers/JSON e auth vigente. UserNOKEY→atorfresh→ownrowselectid/gen→atorfresh; Userausente/inativo401, Portal/papel inválido403. Não é TX SET READ ONLY (há rowlock), mas não altera contato, atividade, seq, updatedAt, Event ouIntent. Nenhum timestamp/status/role/IDalheio retornado. Schema e política existentes imutáveis.

Somente uma NOVA entrada deliberada, após seu abrirCAS409, pode fazer1resolver e1nova tentativaCAScomum. Null só permite criação se aindaausente; corrida depois da resolução recusa. Não há NULLupsert/fallbackcego, nem retry de401/403, resolver de heartbeat/reconexão técnica/ACKantigo ou timer. Após novoabrir ainda precisa pulso próprio. Checkpoint nãoé lease: flag interna possuiAbertura sófica verdadeira depoisACKda própriaabertura; cleanup nãofecha metadata e pulso nãoopera sobreponteirosemACK.

AtorFresco do writer foi apenas extraído para helper interno db-aware e compartilhado pelo resolver, sem mudar corpo/papéis/roles; sourceproof comprova. O reader de presença/colegas permanece com o contrato anterior, sem CRM/grants370. A caracterização UNIT de replayexato da abertura expirada/fechada confirma409 semmutação, justificando esse leitorSELF emvezde prometer idempotência eterna ou guardar timestampsbrowser.

Native obrigatório: arquivo checkpoint10 completo e regressão17 completa, em série sóapósleaseROOT. Fonte anterior434 tem17verde, mas esse backend novo não herda aprovação sem regressão. D6/376 continua emvalidação atéQA evisual.

### Resultado nativo DEV na fonte3dd

Checkpoint completo10/10 EXIT0 (41651/272572,44,25s), depois regressão completa17/17 EXIT0 em nova sessão serial (19224/278a1c,72,19s). Configuração original, UTC/w1/1024, sete providers vazios, sem filtros/skips. Mantidos schema/SQL/client/perfil durante ambas. Não somar históricos sobrepostos nem considerar isto prova de escala/visual/CI. Banco entregue ao ROOT com fixtures e lease liberada; somente o integrador restaura. A extração fresca/metadados/newgen/CAS/ausência efeitos/pool1 e regressão são agora verificados nativamente, sem afirmar gates de composição ainda ausentes.

## #452 C1 — distinguir gesto humano de reposicionamento de lista

Scroll programático do VirtualList não representa atividade, mesmo se o evento scroll do browser tiver isTrusted:true. O boundary do Inbox usa wheel humano trusted junto dos pointerdown/keydown/touchstart já existentes, sempre exigindo aba visível pelo hook. Nenhuma posição, tecla ou conteúdo é enviado: apenas o marcador/seq existente, coalescido. Scroll permanece para layout; não alimenta presença. Sem listener global, fetch, setInterval ou polling novo. Sem mudança do idle10min, leaseoffline60s ou pulso25s, backend/SSE/CAS/schema.

RED873ee8 reproduziu duas falhas causais no boundary+hook normal (scrolltrusted renovava e wheel ausente), com44controles passando; patch de um binding deu GREEN0dad2a mesmos46/46 e lint2c94b1e0. TSC final e QA pública/browser/composição estão qualificados no recibo de docs/qa/inbox-presenca-scroll-452-dev.md; nenhum nativoSQL neste recorte. Teste portátil à fonte pública452(CodeE2fd), sem dependência de UI361/372.

Migration496 aplicada permanece imutável, inclusive comentários/checksum: explicação não exige reescrever SQL ou acrescentar IF NOT EXISTS. Cleanup existente é oportunista na abertura do próprio usuário, retenção24h, lote máximo16; backlog além de16 exige novas operações existentes, sem novo scheduler/worker/varredura global nesta correção. Limites são documentados, não ampliados. Homologação visual e CI específicos permanecem pendentes.