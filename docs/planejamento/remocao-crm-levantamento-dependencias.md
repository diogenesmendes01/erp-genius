# Remoção do CRM — levantamento de dependências

Data: 14/10/2026 · Base: `main` em `f8a9c0e7` (após PR #175/#176) · Situação: **levantamento, nada removido**.

Objetivo: retirar do ERP tudo o que é função de CRM (lead, funil/pipeline, etapas, temperatura, follow-up, aula experimental, proposta comercial, carteira de vendedor, cobertura de carteira, comissão de venda, captura/origem de campanha, régua/cadência comercial, linha comercial do WhatsApp, copiloto de IA, gestão/SLA comercial, metas, políticas comerciais) para que um CRM novo seja construído depois — **sem quebrar matrícula, contrato, financeiro, cobrança, secretaria, acadêmico e WhatsApp institucional**.

Método: varredura estática (leitura de código, `schema.prisma`, 439 migrations, seeds, docs e testes). Nenhum teste foi executado e nenhum banco foi consultado. Referências `arquivo:linha` valem para o commit acima.

---

## 1. Conclusão

**Não dá para apagar o CRM direto.** O núcleo do ERP foi construído com o CRM como porta de entrada da matrícula. Há 14 acoplamentos que quebram funções não-CRM (seção 4), quatro deles em nível de banco (funções PL/pgSQL que o Postgres **não** avisa ao remover tabela/coluna — quebram só em tempo de execução).

A remoção precisa ser feita em fases: **decidir → desacoplar o núcleo → retirar telas → retirar servidor → retirar schema → atualizar docs** (seção 6). Antes de codar, há 8 decisões de negócio (seção 5).

| Medida | Quantidade |
|---|---|
| Models/enums puramente CRM | 10 models + 7 enums (seção 2.1) |
| FKs atravessando a fronteira | 8 do núcleo → CRM, 13 do CRM → núcleo |
| Funções/triggers SQL que leem `Lead`/`leadId`/`Comissao`/`GERENTE_COMERCIAL` | ~25 |
| Migrations que tocam CRM | 14 só CRM + 11 mistas |
| Rotas de tela puramente CRM | 10 (`/leads`, `/leads/[id]`, `/leads/[id]/contratacao`, `/pipeline`, `/carteiras`, `/comissoes`, `/financeiro/comissoes`, `/financeiro/politicas`, `/configuracao/whatsapp/comercial`, `/configuracao/whatsapp/reguas`) |
| Telas mistas a recortar | ~12 (home, inbox, matrícula nova, preparação/reserva, secretaria, financeiro, ficha financeira do aluno, usuários, números WhatsApp…) |
| Testes puramente CRM (apagar junto) | ~42 |
| Testes não-CRM que quebram | ~118 (90 arquivos citam `VENDEDOR`/`GERENTE_COMERCIAL`) |
| Docs puramente CRM | 4 (08, 27, 32, SPEC-ERP-005) + ~15 docs mistos |

---

## 2. Inventário

### 2.1 Puramente CRM (sai inteiro, depois de cortar os vínculos da seção 4)

**Banco** (`prisma/schema.prisma`)

| Item | Linha |
|---|---|
| `Lead` (+ enums `Temperatura`, `EtapaLead`, `MotivoPerda`) | 1282–1391 |
| `Comissao` (+ `StatusComissao`) | 1985, 1992 |
| `PoliticaComissao` (+ `TipoComissao`) | 367, 372 |
| `CoberturaCarteira` | 264 |
| `PoliticaComercial`, `DegrauComercial` | 2591, 2617 |
| `ConfigComercial` (singleton `"comercial"`) | 2634 |
| `SugestaoIA` (+ `TipoSugestaoIA`, `StatusSugestaoIA`, `GatilhoSugestaoIA`) | 8382–8424 |

Aula experimental, proposta, origem/campanha e referral do click-to-WhatsApp **não têm model próprio**: são colunas de `Lead` (1332–1373). Metas não existem no banco (a meta da Home é fixa em `meta: 20`, `src/server/home/consultas.ts:114`).

**Servidor**

- `src/server/comercial/*` (8 arquivos + 9 testes)
- `src/server/ia/*` (copiloto comercial)
- `src/server/_shared/escopo-comercial.ts` (escopo de carteira — mas é usado por ~20 arquivos não-CRM, ver D6)
- `src/server/acesso/coberturas.ts`
- `src/server/whatsapp/cron-comercial.ts`, `cron-gestao.ts`, `linha-comercial.ts`
- `src/server/financeiro/cron-financeiro.ts`, `ordem-comissoes.ts`
- Trechos: `financeiro/schema.ts:52-64`, `financeiro/regras.ts:51-66`, `cobrancas/regua.ts:208-260` (wrapper comercial), `cobrancas/eventos.ts:45-61`, `matricula/escopo.ts:12-18` (`podeConverterLead`)

**Telas** (`src/app/(app)/`)

`leads/**`, `pipeline/**` (único uso de `@dnd-kit/*`), `carteiras/**`, `comissoes/**`, `financeiro/(painel)/comissoes`, `financeiro/(painel)/politicas` + `PoliticasComissao.tsx`, `configuracao/whatsapp/comercial/**`, `configuracao/whatsapp/reguas/**`, `home/HomeVendedor.tsx`, `src/components/CopilotoSugestoes.tsx`.

**Jobs** — etapas de `POST /api/whatsapp/cron` (`src/app/api/whatsapp/cron/route.ts`): `rodarLeadNovoSemResposta`, `rodarPreExperimental`, `rodarNoShow` (60-62), `rodarCheckInVencido` (67), `rodarCopilotoQuietude` (69), `rodarGestao` (71), `rodarFechamentoComissoes` (73), `adotarMensagensOrfasDaLinha` (79).

**Permissões** — papéis `VENDEDOR` e `GERENTE_COMERCIAL` (`schema.prisma:457-458`); capacidades `dados.exportar_leads` e `comissao.configurar` (`src/lib/capacidades.ts:2,11,13`).

### 2.2 Parece CRM, mas é núcleo — **manter**

| Item | Por quê |
|---|---|
| `PreparacaoComercialMatricula` / `DecisaoPrecoPreparacao` (S:3511, 3534) | É a contratação em si (proposta de preço, regime, reserva). ~40 arquivos de matrícula/contratos/secretaria e várias funções SQL de aditivo, horas, continuidade e desistência dependem dela. Pode ser renomeada no futuro, não removida. |
| `PoliticaRegua` / `DegrauPolitica` (S:2542) | Régua de **cobrança** (D-7…D+15). |
| WhatsApp (`NumeroWhatsApp`, `ContatoWhatsApp`, `ConversaWhatsApp`, `MensagemWhatsApp`, `TemplateWhatsApp`, `AtendimentoWhatsApp`, `IntencaoMensagem`) | Infra compartilhada: cobrança, atendimento FINANCEIRO/SECRETARIA/PEDAGOGICO, avisos de agenda. Só as partes comerciais saem (D8). |
| `/inbox` | Usado por Financeiro, Secretaria, Professor e Gerente Pedagógico (`src/server/whatsapp/escopo.ts:11-19`). Recortar, não remover. |
| `EncontroAgenda` | Finalidades `REPOSICAO/AULA/RECUPERACAO/SEGUNDA_CHAMADA`; nada de experimental. |
| `Segmento` / `SEGMENTO_LABEL` | Também usado por `Modalidade` (catálogo). |
| `Usuario.limiteDesconto*Pct` | Alçada de preço/desconto usada por ajustes e preparação. |
| `IntencaoMensagem.reativa`, `.validaAte` | Nasceram no CRM, mas são genéricas. |
| `CategoriaDocumento.PROPOSTA`, `TESTE_NIVEL` | Usadas também nas telas de documento da matrícula (confirmar). |

---

## 3. Fronteira no banco

### 3.1 FKs do núcleo apontando para o CRM

| FK | Nulo? | onDelete | Observação |
|---|---|---|---|
| `Matricula.leadId` → Lead (1:1 único) | sim | SET NULL | Lido por ~25 funções SQL e ~20 arquivos TS (D4, D5) |
| `Documento.leadId` → Lead | sim | RESTRICT | CHECK `Documento_contexto_exclusivo_check` exige **exatamente um** de `leadId`/`matriculaId` (`20260908010000_documentos_matricula:15`). Dropar a coluna derruba o CHECK em silêncio — recriar a regra. |
| `AtendimentoWhatsApp.leadId` | sim | RESTRICT | Na tupla de imutabilidade de `validar_contexto_financeiro_atendimento_whatsapp` (`20260918180000:36-37,103-104`) |
| `ContatoWhatsApp.leadId` | sim | SET NULL | |
| `IntencaoMensagem.leadId`, `.politicaComercialId` (+ `passoComercial`, `ocorrenciaComercial`) | sim | SET NULL | Índice parcial `IntencaoMensagem_comercial_degrau_key` existe só no SQL |
| `RegistroUpload.leadId` | sim | sem FK | |
| `AjusteFinanceiro.vendedorId` | sim | sem FK | Preenchido a partir de `comissoes[0].vendedorId` |

### 3.2 FKs do CRM apontando para o núcleo (somem com as tabelas)

`Comissao.matriculaId`/`vendedorId` (NOT NULL, RESTRICT), `PoliticaComissao.paisId`/`produtoId`, `Lead.paisId`/`vendedorDonoId`/`professorExperimentalId`, `CoberturaCarteira` (3× Usuario), `Usuario.gerenteComercialId` (auto-relação, CHECK `Usuario_gerente_distinto`), `SugestaoIA.decididaPorId`, `PoliticaComercial.numeroRemetenteId`, `ConfigComercial.gestaoNumeroId`, `DegrauComercial.templateId`.

Back-relations a apagar do schema: `Usuario` (S:745-750, 761, 762, 764, 809), `Pais` (840, 842), `Produto` (910), `Matricula` (1848), `NumeroWhatsApp` (2295, 2297), `TemplateWhatsApp` (2521).

### 3.3 Funções/triggers SQL que dependem do CRM (risco silencioso)

Postgres não rastreia nomes usados dentro do corpo de função: `DROP TABLE "Lead"` funciona, e essas funções passam a falhar quando forem chamadas. **Todas precisam ser reescritas (`CREATE OR REPLACE`) antes do drop.**

| Grupo | Funções (migration da última versão) |
|---|---|
| Documento achado "pela matrícula ou pelo lead dela" (`d."leadId" = m."leadId"`) | `validar_condicoes_horas` (20260914103000), `validar_conferencia_ocorrencia_horas` (20260918120000), `validar_rascunho_fechamento_horas` (20260914105000), `validar_decisao_fechamento_horas` (20260914110000), `conferir_participantes_aditivo_117` (20260917149000), `bloquear_evidencias_aditivo_117` (20260915062000), `conferir_evidencias_conferencia_aditivo_117` (20260915065000), `validar_condicoes_continuidade_mensal` (20260915144000), `validar_emissao_continuidade_mensal` (20260915145000), `conferir_base_periodo_integral_67` (20260917152000), `preservar_aceite_original`, `proteger_documento_original_aceito` (20260914003000) |
| Travam a linha `"Lead"` (`FOR UPDATE`) e comparam `snapshotJson.matricula.leadId` | `bloquear_contexto_fonte_segunda_chamada` (20260915131000), `bloquear_contexto_financeiro_desistencia` (20260915137000), `conferir_efetivacao_pedido_desistencia_preparacao` (20260917172000), `validar_fontes_decisao_administrativa_desistencia` (20260917167000), `validar_decisao_administrativa_desistencia` (20260915139000). Dado gravado também: `PedidoDesistenciaPreparacao.snapshotJson` contém `matricula.leadId`. |
| `AtendimentoWhatsApp.leadId` | `validar_contexto_financeiro_atendimento_whatsapp` (20260918180000) |
| `Comissao` | `dct03_invalidacao_acerto_taxa_guard`, `dct03_fotografia_invalidacao_canonica_217` (20260917142000) — exigem chave `comissoes` na fotografia do acerto de taxa do aditivo |
| Papel `GERENTE_COMERCIAL` | `validar_decisao_alcada_aditivo_117` (`20260915066000_alcadas_aditivo:61`), `exigir_alcadas_aditivo_117` (:92 — exige alçada COMERCIAL quando o aditivo muda preço, moeda ou regime); CHECK de `DecisaoAlcadaAditivo.alcada` permite `'COMERCIAL'` |

### 3.4 Enums compartilhados com valores de CRM

Postgres não remove valor de enum — é preciso recriar o tipo (`CREATE TYPE … ; ALTER COLUMN … USING …; DROP TYPE`).

- `Papel`: `GERENTE_COMERCIAL`, `VENDEDOR` (usado no SQL de alçada acima e em 90 arquivos de teste)
- `FinalidadeAtendimentoWhatsApp`: `COMERCIAL`
- `FinalidadeNumero`: `VENDAS`
- `OrigemEnvio`: `GESTAO` (só produzido por `cron-gestao.ts`)
- `TipoAprovacao`: `COMISSAO_EXCEPCIONAL`

---

## 4. Acoplamentos que quebram o ERP (bloqueadores)

### D1 — Barrel compartilhado importa o CRM
`src/server/_shared/regras.ts:2` importa `ETAPAS_MANUAIS` de `@/server/comercial/schema`, e `_shared/index.ts:6` reexporta. Quase todo o servidor importa `@/server/_shared`. **Apagar `comercial/schema.ts` derruba o build inteiro.** As regras de lead em `_shared/regras.ts` (46-75, 112-115, 181-200, 345-394) precisam sair junto; o restante do arquivo (preço, vencimento, pagamento) fica.

### D2 — Contratação nova exige Lead com vendedor dono
- `PreparacaoComercialSchema` exige `leadId` (`src/server/matricula/preparacao-comercial-tx.ts:15`), trava a linha `"Lead"` (:25) e recusa sem `lead.vendedorDonoId` (:38).
- A única entrada de tela é `/leads/[id]/contratacao`; daí seguem `/matriculas/[id]/preparacao` e `/reserva` (que a Secretaria também usa).
- Caminho legado `criarMatricula`: `leadId` é opcional (`matricula/schema.ts:16`), mas só `VENDEDOR`/`GERENTE_COMERCIAL` podem criar (`matricula/permissoes.ts:10`) — Secretaria fica de fora. O botão "Cadastrar aluno" (`alunos/(lista)/page.tsx:39`) e `/matriculas/nova` dependem disso.
- `exigirMatriculaNoEscopoTx` (`matricula/acoes.ts:732-753`) recusa matrícula sem lead para quem não é Secretaria/Financeiro.

**Impacto:** sem o CRM, ninguém consegue iniciar uma contratação nova. → Decisão A.

### D3 — Matrícula exige política de comissão e gera `Comissao`
- `resolverComissao` lança "Configure a política de comissão desta oferta antes de matricular." (`src/server/financeiro/politica.ts:18-24`), chamada em `criarMatriculaTx` (`matricula/acoes.ts:153`) e `ativarPreparacaoTx` (`ativacao-preparacao-tx.ts:67`).
- A ativação exige `referencias.vendedorResponsavelId` (:64) e cria `Comissao` APROVADA (:91-93). O fluxo legado cria PENDENTE (`acoes.ts:359-371`) e aprova na ativação (:569-575).
- Recalculada em `ajustes/acoes.ts:44-73` e no acerto de taxa de aditivo `contratos/aditivo-acerto-taxa-acoes.ts:33-92` (DCT03, com as guardas SQL da seção 3.3).
- Paga pelo fechamento mensal (`financeiro/acoes.ts:235-310`, flag `ConfigFinanceiro.fechamentoComissaoAutomatico`).
- **Dado real:** `docs/23-carga-docentes-vendedor-q10.md:21-26` registra o usuário "Henrique (vendas)" com 56 `Comissao` PAGA, uma por matrícula migrada.

→ Decisão B.

### D4 — Documentos contratuais vinculados ao lead
Documentos anexados antes da matrícula ficam com `leadId` e `matriculaId` nulo. ~20 arquivos buscam o contrato com `OR: [{ matriculaId }, { leadId: m.leadId }]`:
- `matricula/`: `ativacao.ts:21`, `condicoes-encerramento.ts:23`, `condicoes-horas.ts:40`, `condicoes-continuidade-mensal.ts:43`, `compra-horas.ts:59`, `compensacao-cobertura.ts:24`, `continuidade-estado-tx.ts:35`, `encerramento-contexto-tx.ts:35`, `fechamento-horas-revalidacao-tx.ts:21`, `fechamento-horas-rascunho.ts:32`, `ocorrencia-financeira-previa-tx.ts:31`, `periodo-integral-estado.ts:25`, `recomposicao-tx.ts:15`
- `contratos/`: `participantes.ts:39,91`, `original-estado.ts:29`, `aditivo-participantes.ts:43`, `aditivo-participantes-tx.ts:28`, `aditivo-original-estado.ts:46`
- `secretaria/acoes.ts:109,150`, `uploads/autorizacao.ts:105,114`
- + as 12 funções SQL do primeiro grupo da seção 3.3.

**Precisa de migração de dados:** mover `Documento.leadId → matriculaId` onde há matrícula, antes de reescrever as buscas. Documentos só de lead (sem matrícula) vão para a exportação (Decisão F).

### D5 — Desistência e segunda chamada travam o Lead
As 5 funções SQL de desistência/segunda chamada (seção 3.3) fazem `SELECT … FROM "Lead" … FOR UPDATE` e levantam "Lead da matrícula não encontrado". Snapshots gravados (`PedidoDesistenciaPreparacao.snapshotJson`) carregam `matricula.leadId` — a comparação "snapshot vs. vivo" precisa tolerar o campo ausente.

### D6 — Papéis comerciais carregam deveres não-CRM
Remover `VENDEDOR`/`GERENTE_COMERCIAL` deixa órfãos:

| Dever | Onde | Hoje |
|---|---|---|
| Criar matrícula | `matricula/permissoes.ts:10` | só VEN/GC (+admin) |
| Preparar contratação, reservar vaga/agenda | `preparacao-comercial.ts:11`, `reserva-comercial.ts:10`, `reserva-vaga-tx.ts:19`, `matriculas/[id]/secoes.ts:22-23` | VEN/GC/SEC |
| Decidir preço da preparação; exceção de preço | `preparacao-preco.ts:12`, `matricula/acoes.ts:66,380` | GC (+admin) |
| **Aprovar desconto/ajuste** | `ajustes/acoes.ts:134` (`exigirSessaoComPapel(GERENTE_COMERCIAL)`) | **só GC** (admin passa) |
| **Alçada COMERCIAL de aditivo** (preço, moeda, regime) | `contratos/aditivo-alcadas.ts:15,20`, `aditivo-alcadas-tx.ts:13` + SQL `20260915066000:61,92` + `docs/specs/documento-contratual.md:55-63` | **só GC** (+admin) |
| Enviar contrato e link da 1ª cobrança | `matricula/acoes.ts:724,759-877` | VEN/GC |
| Solicitar correção de cadastro (D05) | `secretaria/acoes.ts:83` | só VEN/GC |
| Solicitar abertura de turma | `turmas/acoes.ts:80` | VEN/GC |
| Painel `/financeiro`, publicar política de comissão | `financeiro/papeis.ts:6`, `financeiro/acoes.ts:172` | FIN/GC |

Além disso, o **escopo de carteira** (`_shared/escopo-comercial.ts`) é o filtro de linhas de módulos não-CRM: `financeiro/acesso.ts:10-27` (via `matricula.lead.vendedorDonoId`), `secretaria/acoes.ts:87`, `uploads/autorizacao.ts:41,130`, `titulos-registro.ts:33`, `home/consultas.ts`, `matricula/*` (10 arquivos), `whatsapp/escopo.ts:54`. → Decisão C.

### D7 — Um único cron mistura CRM e não-CRM
`POST /api/whatsapp/cron` (agendado a cada 300 s em `docker-compose.prod.yml:108-121` e `docker-compose.coolify.yml:157-167`) roda, na mesma chamada, vencimento de particulares, início de turmas, controle de acesso, régua de **cobrança** e o despachante — junto com 8 etapas de CRM. As chaves do JSON de resposta são verificadas por `route.test.ts`. Retirar as etapas CRM sem mexer nas outras; `despacharFila` (81) continua.

### D8 — WhatsApp: entrada cria lead e linha comercial roteia conversa
- Webhooks Meta (`api/whatsapp/webhook/meta/route.ts:83-90,143-166`, referral click-to-WhatsApp) e Evolution (:183) → `whatsapp/inbound.ts:146-176` → `capturarComercial`/`capturarRespostaExperimental`. Com `ConfigComercial.autoLeadAtivo`, o 1º inbound num número VENDAS cria lead e enfileira saudação (`inbound.ts:191-197`).
- Ramificações comerciais em arquivos compartilhados: `despachante.ts` (4-10, 85-89, 120-122, 151-178, 246-310, 334-350, 540-547, 591-594, 622-623, 653-670), `elegibilidade.ts`, `fila.ts:111-195`, `acoes.ts:371-500`, `consultas-inbox.ts`, `escopo.ts`, `operacoes-atendimento.ts`, `atendimentos.ts:25-31`, `historico.ts:45`, `identidade.ts`, `destinatario-atual.ts`, `nome-contato.ts`, `busca-inbox.ts`, `whatsapp/schema.ts:39`.
- Inbox (`inbox/InboxCliente.tsx`): "Criar lead", chip de lead, painel `CockpitLead` (1079-1221), copiloto (566-573), filtro "linha comercial" (72-76). `AtendimentosPainel.tsx`: ramos COMERCIAL.

→ Decisão D.

### D9 — Home do Administrador é o painel comercial
`home/page.tsx:18-26` manda ADMINISTRADOR e GERENTE_COMERCIAL para `HomeGerente` (todo CRM, salvo os KPIs "Matrículas no mês" e "Recebido no mês"). `HomeProfessor` mistura check-in de experimental (6, 20-26, 42-66, 78-159) com "Minhas turmas" (161-177), e `dadosHomeProfessor` consulta leads e `configComercial` (`home/consultas.ts:140-155`). → Decisão G.

### D10 — Ação de pagamento que só existe na ficha do lead
`registrarLinkPagamento` (de `server/matricula/acoes`) só é chamado em `leads/[id]/FichaLead.tsx:823` (card de fechamento 772-835). Precisa ganhar lugar na tela da matrícula antes de a ficha sair.

### D11 — Cadências de pós-venda usam o motor comercial
`regua-fabrica.ts` tem, além das 3 cadências de CRM, `CHAVE_CONTRATO` (contrato sem assinatura, ancorada em `Matricula.contratoEnviadoEm`) e `CHAVE_LINK_PAGAMENTO` (link sem pagamento, ancorada em `Cobranca.linkEnviadoEm`). Hoje vêm desligadas pela seed. → Decisão E.

### D12 — Matrícula automática configurada no CRM
`ConfigComercial.matriculaAutomaticaAtiva` (S:2656, decisão D35 do doc 15) é salva por `salvarConfigComercial` e lida por `matricula/cron-fechamento.ts:17` (hoje inerte). Se a regra continua valendo, a configuração precisa de outra casa (Financeiro/Secretaria). → Decisão H.

### D13 — Seeds e scripts
- `prisma/seed-whatsapp.ts:4` importa `CADENCIAS_COMERCIAIS` de `src/server/comercial/regua-fabrica` → `npm run seed:whatsapp` quebra. Linhas 51-83 criam as 5 cadências comerciais; 14-49 (cobrança) ficam.
- `prisma/seed.ts:23-33` cria Mariana (GC+VEN) e João (VEN); :57 contador `"lead"`.
- `scripts/reparar-nome-contato-whatsapp.ts:41-72`, `scripts/auditoria/cenarios.test.mjs:26-33`, `scripts/validacao/http-acesso.mjs:47,82`.

### D14 — Fotografias e eventos gravados
- Eventos de CRM emitidos por código não-CRM: `EtapaAlterada` no agregado Lead (`matricula/acoes.ts:396,582`, `ativacao-preparacao-tx.ts:97`), `ComissaoGerada/Aprovada/Recalculada/Paga`, `PoliticaComissaoPublicada`, `FechamentoComissoesMensal`, `ReguaComercialEnviada`. Payloads de `MatriculaCriada`, `ContratacaoPreparada`, `IdentidadeContratacaoSelecionada` carregam `leadId`.
- `AgregadoTipo` (`_shared/evento.ts:12-46`) lista `Lead`, `Comissao`, `PoliticaComissao`, `CoberturaCarteira`, `ConfigComercial`, `PoliticaComercial`.
- Eventos são histórico: **não apagar**; só parar de emitir e manter os tipos legíveis.

---

## 5. Decisões de negócio necessárias antes de codar

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| **A** | Quem inicia uma contratação nova sem o CRM? | (1) Secretaria/Admin iniciam a preparação a partir do cadastro de pessoa/aluno; (2) bloquear novas vendas até o CRM novo existir | (1), com um campo opcional de **referência externa de origem** (id da oportunidade no CRM novo) para a integração futura. Exige mudar Q103/Q113 e `matricula-como-unidade-operacional.md` §2.1. |
| **B** | Comissão de venda sai junto com o CRM? | (1) Sai — arquivar histórico (inclui 56 PAGA) e tirar `resolverComissao` da matrícula e do acerto de taxa (DCT03); (2) Fica no Financeiro do ERP, desacoplada do lead, com o beneficiário informado na preparação | (2) é menos arriscado: é dinheiro pago, tem histórico real e está dentro das guardas SQL do aditivo. Se a escolha for (1), o DCT03 e suas duas funções SQL precisam ser redesenhados. |
| **C** | Os papéis `VENDEDOR` e `GERENTE_COMERCIAL` deixam de existir? Quem herda os deveres da tabela D6? | Redistribuir para SECRETARIA_ACADEMICA / FINANCEIRO / ADMINISTRADOR | Criar matrícula e preparar → Secretaria; decidir preço e aprovar desconto → Financeiro ou Admin; alçada COMERCIAL do aditivo → definir se vira alçada da Direção (Admin) ou se deixa de existir (muda `documento-contratual.md:55-63` e o SQL). Correção de cadastro e abertura de turma → quem ficar no atendimento. Se B=(2), decidir se o vendedor ainda loga no ERP. |
| **D** | WhatsApp: o que acontece com o número de vendas até o CRM novo? | (1) Vira número institucional comum (cai no inbox geral); (2) é desativado no ERP e passa ao CRM novo | Manter WhatsApp como infraestrutura; remover finalidade `VENDAS`, atendimento `COMERCIAL`, linha comercial, auto-lead, copiloto e gestão/SLA. O destino do número é escolha operacional. |
| **E** | Lembretes de pós-venda (contrato sem assinatura, link sem pagamento) | (1) Migrar para régua do ERP (Secretaria/Cobrança); (2) descartar | Estão desligados hoje; descartar agora e reabrir como item próprio se forem desejados. |
| **F** | Dados reais do CRM no UAT (leads, interações, documentos só de lead, conversas vinculadas, comissões) | Exportar para o CRM novo / arquivar / descartar | Exportar tudo (inclui eventos de agregado `Lead`) antes de qualquer drop; migrar `Documento.leadId → matriculaId` onde houver matrícula. Levantar volumes no UAT antes (contagem de `Lead`, `Comissao`, `Documento` com `leadId` e sem `matriculaId`, `AtendimentoWhatsApp` COMERCIAL). |
| **G** | Nova Home do Administrador | Painel operacional (matrículas, recebimentos, pendências) | Precisa de desenho próprio; a Home do Professor só perde o bloco de experimentais. |
| **H** | Matrícula automática (D35: contrato + taxa OK ativam sozinhos) continua? | Sim (mover a chave para Financeiro/Secretaria) / não | Se continuar, mover a configuração antes de apagar `ConfigComercial`. |

Fora de código: cancelar ou ajustar itens do `quadro-entregas.md` ligados ao CRM (62-64: integração do inbox e renomear leads; 122: SPEC-005).

---

## 6. Ordem de remoção sugerida

Cada fase deixa o sistema compilando e com a suíte verde. Por `AGENTS.md`, mudanças de permissão, contrato e schema exigem coordenação técnica, e o integrador reserva os IDs de migration.

**Fase 0 — Decidir e preservar**
Decisões A–H registradas. Contagem de volumes no UAT. Exportação dos dados do CRM. Backup.

**Fase 1 — Desacoplar o núcleo (sem tirar nada visível)**
1. D1: tirar o import de `comercial/schema` de `_shared/regras.ts`.
2. D4: migração de dados `Documento.leadId → matriculaId`; reescrever as ~20 buscas TS para usar só `matriculaId`; reescrever as 12 funções SQL de documento.
3. D5: reescrever as 5 funções SQL de desistência/segunda chamada sem `"Lead"`; tolerar `leadId` ausente em snapshots.
4. D2 (Decisão A): preparação de contratação sem lead; nova entrada de tela a partir de aluno/pessoa; `PAPEIS_CRIAR` com os papéis decididos.
5. D3 (Decisão B): conforme a escolha, remover ou desacoplar `resolverComissao`/criação de `Comissao` da matrícula, ajustes e DCT03 (+ 2 funções SQL).
6. D6 (Decisão C): trocar o escopo de carteira nos módulos financeiro/secretaria/uploads/matrícula/títulos por escopo por papel; redistribuir aprovação de desconto, preço e alçada de aditivo (+ SQL `validar_decisao_alcada_aditivo_117` / `exigir_alcadas_aditivo_117` e CHECK `DecisaoAlcadaAditivo.alcada`).
7. D10: levar `registrarLinkPagamento` para a tela da matrícula.
8. D12 (Decisão H): mover `matriculaAutomaticaAtiva`.
9. Parar de escrever em `Lead` a partir da matrícula (`etapa = MATRICULADO` e evento `EtapaAlterada`).

**Fase 2 — Retirar telas e navegação**
Rotas da seção 2.1; recortes em home (D9), inbox (D8), matrícula nova, secretaria, financeiro (abas, `FinanceiroPainel`, `FichaFinanceira`, `ResumoFinanceiroComercial`), usuários ("gerente comercial da equipe"), números WhatsApp (finalidade VENDAS). Registros: `src/lib/nav.ts`, `src/lib/trilha.ts`, `src/lib/labels.ts` (manter `SEGMENTO_LABEL`, `STATUS_INTENCAO_LABEL`, `CATEGORIA_DOCUMENTO_LABEL`), `configuracao/_componentes/tabs.ts`, `configuracao/whatsapp/secoes.ts`, `financeiro/abas.ts`, `matriculas/[id]/secoes.ts`. Mapas de regra de UI: `botoes-mapa.ts`, `borda-rota-mapa.ts`, `confirmacoes-mapa.ts`, `contraste-mapa.ts`, `estados-vazios-mapa.ts`, `vazio-paginado-mapa.ts`. Exportação `?tipo=leads` (`api/exportacoes/[tipo]/route.ts:43-82`) e `ExportarPlanilha` (tipo `"leads"`).

**Fase 3 — Retirar servidor e jobs**
`src/server/comercial`, `src/server/ia`, `cron-comercial`, `cron-gestao`, `linha-comercial`, `acesso/coberturas.ts`, `_shared/escopo-comercial.ts`, etapas CRM do cron (D7), captura no inbound e ramos comerciais do despachante/fila/elegibilidade (D8), capacidades `dados.exportar_leads`/`comissao.configurar`, `AgregadoTipo` (manter os tipos legíveis para o histórico), seeds (D13). Se B=(1): comissões no financeiro.

**Fase 4 — Retirar o schema** (uma migration por etapa, IDs reservados pelo integrador)
1. Confirmar que nenhuma função SQL ainda referencia CRM (`grep` em `pg_proc.prosrc` no banco de teste).
2. Dropar FKs/colunas do núcleo (3.1) e recriar a regra de contexto de `Documento`.
3. Dropar tabelas do CRM (2.1) e índices/CHECKs ligados.
4. Recriar enums (3.4).
5. `Usuario.gerenteComercialId` e relações de cobertura.
6. Remover `@dnd-kit/*` do `package.json` (tarefa do integrador).

**Fase 5 — Documentação**
Seção 8.

**Fase 6 — Regressão global**
Suíte de integração completa num banco descartável, `tsc` e `vitest` com código 0, conforme `AGENTS.md`.

---

## 7. Testes

**Apagar junto (~42):** `src/server/comercial/*` (9), `src/server/ia/*` (2), `whatsapp/cron-comercial.int`, `cron-experimental.int`, `cron-gestao.int`, `cron-gestao`, `despachante-comercial.int`, `piloto-bloqueadores.int`, `linha-comercial.int`, `linha-comercial`, `elegibilidade` (9), `financeiro/comissoes-pagina`, `ordem-comissoes` (2, se B=1), `matricula/escopo.test.ts`, telas de `leads/**` (8), `pipeline/KanbanBoard`, `carteiras/*` (3), `comissoes/page`, `home/HomeVendedor`, `financeiro/PoliticasComissao`, `configuracao/whatsapp/ComercialPainel{,.confirmacao}`, `ReguaComercialPainel{,.confirmacao}`. A confirmar: `whatsapp/escopo-atendimentos`, `whatsapp/historico`.

**Ajustar (~118):**

| Grupo | Qtde | O que muda |
|---|---|---|
| G1 — fixture de matrícula cria Lead + VENDEDOR (+ política de comissão) | 21 | Inclui os 10 que usam o builder `src/test/substituicao-contratual.ts:29,45` (único helper de CRM em `src/test`). Trocar o builder resolve a maior parte. |
| G2 — criam/conferem comissão ou lead num fluxo não-CRM | 27 | ajustes, secretaria, uploads, fechamento, financeiro, exportações, telas do financeiro |
| G3 — afirmam que papéis comerciais fazem trabalho não-CRM | 14 | permissões de matrícula, guards, home, upload |
| G4 — usam VEN/GC só como "papel de fora" | 32 | Só troca o papel usado no teste |
| G5 — WhatsApp/inbox com fixture de lead ou VENDAS | 13 | |
| G6 — testes de regra de projeto com rotas/enums CRM fixos | 11 | `botoes.test.ts` tem trava "a lista só cresce" (:1180) que proíbe remover área — precisa ser editada conscientemente; `enums-rotulos.test.ts` exige lista fechada igual a `labels.ts`; `trilha.test.ts`, `Esqueleto.test.ts`, `colunas-ordenaveis.test.ts` (meta "≥ 3 tabelas ordenáveis" conta `/comissoes`) |

---

## 8. Documentação

- **Aposentar (CRM puro):** `docs/08-comercial-crm-whatsapp.md`, `docs/27-comercial-automacoes-ia.md`, `docs/32-comercial-c1-c2-piloto-baileys.md`, `docs/specs/whatsapp-linha-comercial.md` (SPEC-ERP-005), `docs/planejamento/auditoria-609-comercial.json`.
- **Editar (misto):** `01`, `03`, `04` (139-144, 189), `05` (fluxo de matrícula liderado pelo vendedor), `07` (inteiro), `09` (Home vendedor/gerente, Ficha do Lead, Pipeline, **Matrícula manual 200-247**, check-in do professor 357-381, renegociação/aprovações 406-445, comissões 486-493), `10` (máquina de estados do lead, §2 permissões, §3 comissão), `11`, `12` (eventos comerciais 42-66 e financeiros 79-98), `14`, `15` (D6–D9, D13, D25, D29, D34, D35), `17`, `26`, `30` (S11), `36`, `37` (mapa de capacidades comerciais), `38`, `docs/planejamento/revisao-crm-whatsapp-598.md` (metade financeira fica).
- **SPEC `docs/specs/erp-educacional.md`:** §1 (28, 30, 34), §4 (77, 85), §5 REQ-15/COM01 (111), §11 Q103, Q107, Q112, Q113, Q117–Q121, Q123, §13 (402, 597, 601-615).
- **Specs relacionadas:** `matricula-como-unidade-operacional.md` (§2.1 36-68, MAT-15/24/27, incrementos 211 e 280), `documento-contratual.md` (55-63 alçada comercial; 83, 90, 117, 164, 260, 388-410), `desistencia-preparacao.md:27`, `docs/planejamento/entrada-comercial-e-contrato.md` (Q103–Q123), `corpos-entrada-comercial-contrato.md` (COM01).
- **Índice `docs/00-indice.md`:** entradas 57, 73, 87, 92, 97. Problemas já existentes: linha 59 diz que o doc 36 falta (ele existe); links 60-61 e 73-74 apontam para outro worktree (`C:/Users/Mendes/.codex/worktrees/de19/...`).
- **Contexto útil:** a própria SPEC já declara "ERP/CRM/WhatsApp completos" fora do escopo (`erp-educacional.md:30`), e o doc 33 põe a passagem comercial → ERP em "matrícula e pagamento" (linha 115) — coerente com a fronteira proposta aqui.

---

## 9. Riscos e pontos não verificados

- Nenhum teste rodado; classificação de testes feita por busca e títulos de `describe`, não por leitura linha a linha.
- Volumes reais no UAT não consultados (Decisão F).
- Agendador das rotas `/api/agenda/avisos/cron`, `/api/financeiro/continuidade/cron` e `/api/portal-aluno/envios/cron` não encontrado no compose (não são CRM, mas convém saber antes de mexer no cron).
- Timelines de tela que leiam eventos de agregado `Lead` não foram conferidas.
- Atendimento PEDAGOGICO "de lead" (sem aluno) é permitido em `validar_contexto_financeiro_atendimento_whatsapp` (`20260918180000:46-48`) — possivelmente conversas de aula experimental; confirmar antes de mexer.
