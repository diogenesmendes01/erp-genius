# Auditoria 01: Acesso, papéis e navegação

> Branch `qa/auditoria-e-onboarding` (= `main` atual + kit de QA), leitura de código em 21/10/2026. Auditoria somente
> leitura: nenhum teste foi executado nesta rodada. "Atendido" nos critérios do doc 37 significa que existe código e
> teste automatizado nomeado para o cenário; não significa homologação. Regra do projeto: especificação não comprova
> implementação, e teste antigo vale só para o recorte que verificou.
>
> Fontes normativas usadas, por precedência: SPEC central (`docs/specs/erp-educacional.md` §1 e §4), doc 37 (inteiro),
> doc 36 (o arquivo existe, mas é uma reconstrução de 16/09/2026 e o original não foi recuperado, ver
> `docs/36-politica-de-acesso-aprovada.md:3`), doc 38, doc 41 e `docs/planejamento/quadro-entregas.md`, doc 07 e doc 09
> (camada original, parcialmente obsoleta). `docs/42-auditoria-frontend-ux.md` é auditoria de UX, não norma: aparece só
> como referência de pendência.

## Resumo

Universo conferido: 189 `page.tsx` em `src/app/(app)/**` (o guard de cada uma foi lido), 12 `page.tsx` fora do shell
(login, raiz, portal legado, portal do aluno, certificado, pagamento), 39 `route.ts` em `src/app/api`, 18 itens de menu,
9 sub-abas de Configuração, 16 sub-abas do Acadêmico, 7 do Diário e 9 abas do Financeiro.

| Status | Achados |
|---|---|
| CONFORME | 13 |
| DIVERGENTE | 10 |
| PARCIAL | 4 |
| NAO_IMPLEMENTADO | 1 |
| SEM_DOC | 6 |
| **Total** | **34** |

Critérios de aceite do doc 37 §8 (30): **25 atendidos** por código e teste nomeado, **4 parciais** (AC14, AC18, AC19, AC24)
e **1 sem evidência** (AC30).

Páginas sem guard de papel na própria `page.tsx`: 15 de 189. Treze estão protegidas por layout/contexto ou pela consulta
do servidor (Financeiro, hub da matrícula, gravação da aula). Nas outras duas a negação aparece como tela de erro genérica
(achados 6 e 7). Nenhuma página deixa um papel não autorizado ler dados.

**Os 5 achados mais importantes**

1. **E-mail com letra maiúscula no cadastro de usuário impede o login (achado 18).** O login converte o e-mail para
   minúsculas (`src/lib/auth.ts:18`) e busca por igualdade exata (`src/lib/auth.ts:26`), mas o cadastro grava o e-mail
   como foi digitado (`src/server/acesso/acoes.ts:44` e `:53`; `src/server/acesso/schema.ts:13` não normaliza). Um
   usuário criado como `Maria@genius.com` nunca entra e vê "E-mail ou senha incorretos.".
2. **O menu "Empresas" aparece para Gerente Comercial e Secretaria, mas a página só abre para Financeiro e Administrador
   (achado 3).** `src/lib/nav.ts:63-69` contra `src/app/(app)/empresas/page.tsx:13` e `:16-17`. A restrição entrou em
   21/09/2026 (merge `eeee7801`) e o menu não foi atualizado. Quem clica recebe "Acesso negado".
3. **Duas telas negam acesso com a tela de erro genérica, e não com "Acesso negado" (achados 6 e 7).** `/financeiro/permuta`
   usa o guard de Server Action (`src/app/(app)/financeiro/permuta/page.tsx:12`), que lança exceção. `/configuracao/contratos`
   não tem guard na página (`src/app/(app)/configuracao/contratos/page.tsx:6-8`), e a consulta lança exceção para quem não é
   Secretaria (`src/server/contratos/modelos.ts:48`). O usuário vê "Não foi possível carregar esta tela... Tente de novo".
4. **O portal do aluno só pode ser testado em UAT depois de preparar a infraestrutura (achados 23, 24 e 29).** O acesso exige
   os 4 prazos configurados pelo Administrador (`src/server/portal-aluno/politica.ts:25-37`). Convite e recuperação só chegam
   por e-mail real, via Resend e cron (`src/server/portal-aluno/processar-envios.ts:33-36`). A equipe nunca vê o link
   (`src/app/(app)/alunos/[id]/portal/page.tsx:22`), e nenhum seed cria aluno, conta de portal ou prazos.
5. **O Gerente Comercial de teste não tem equipe, e o seed não cria dados (achado 29).** `prisma/seed.ts:10-46` e
   `prisma/seed-qa.ts:40-83` não preenchem `gerenteComercialId`. Como o escopo do gerente é a equipe vinculada
   (`src/server/_shared/escopo-comercial.ts:33-58`), `gerente@genius.com` vê funil, carteira e relatórios vazios até um
   Administrador vincular vendedores a ele. O seed também não cria leads, alunos nem turmas.

## Papéis e menu

Enum `Papel` (`prisma/schema.prisma:509-518`): ADMINISTRADOR, GERENTE_COMERCIAL, VENDEDOR, GERENTE_PEDAGOGICO, PROFESSOR,
FINANCEIRO, SECRETARIA_ACADEMICA e ALUNO. Os 7 primeiros batem com o doc 07 (`docs/07-papeis-permissoes.md:126-127`). O
ALUNO do enum é legado: o portal do aluno real usa identidade própria (`ContaPortalAluno`, ver a seção do portal). Os rótulos
estão em `src/lib/labels.ts:127-136`. Um usuário pode acumular papéis (`papeis Papel[]`, `prisma/schema.prisma:805`), e o menu
é a união dos itens. O Administrador passa em todo guard de papel (`src/server/_shared/sessao.ts:120-123`, `src/lib/guards.ts:31-34`).

### Menu lateral (fonte: `src/lib/nav.ts:11-78`, filtrado por `navParaPapeis`, `:80-84`)

O menu aparece **nesta ordem**, que é a ordem do array; Home não é o primeiro item. Papéis puros:

| # | Item (rota) | ADM | GC | VEN | GP | PRO | FIN | SEC | Linha |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Permutas (`/financeiro/permuta`) | sim | | | sim | | sim | | nav.ts:12 |
| 2 | Mudanças acadêmicas (`/academico`) | sim | | | sim | sim | | sim | nav.ts:13 |
| 3 | Comissões (`/comissoes`) | sim | sim | sim | | | sim | | nav.ts:14 |
| 4 | Matrículas (`/secretaria`) | sim | sim | sim | | | | sim | nav.ts:15 |
| 5 | Envios do portal (`/secretaria/envios-portal`) | sim | | | | | | sim | nav.ts:16 |
| 6 | Diário de aulas (`/diario`) | sim | | | sim | sim | | | nav.ts:17 |
| 7 | Home (`/home`) | sim | sim | sim | sim | sim | sim | sim | nav.ts:18 |
| 8 | Funil (`/funil`) | sim | sim | sim | | | | | nav.ts:19 |
| 9 | Relatórios (`/relatorios`) | sim | sim | sim | | | | | nav.ts:20 |
| 10 | Agente de IA (`/aria`) | sim | sim | | | | | | nav.ts:21 |
| 11 | Carteira (`/carteira`) | sim | sim | sim | | | | | nav.ts:22 |
| 12 | Contatos (`/contatos`) | sim | sim | sim | | | | sim | nav.ts:23 |
| 13 | Tarefas (`/tarefas`) | sim | sim | sim | | | sim | sim | nav.ts:24-29 |
| 14 | Inbox (`/inbox`) | sim | sim | sim | sim | sim | sim | sim | nav.ts:30-44 |
| 15 | Alunos (`/alunos`) | sim | | | sim | sim | sim | sim | nav.ts:45-56 |
| 16 | Financeiro (`/financeiro`) | sim | sim | | | | sim | | nav.ts:57-62 |
| 17 | Empresas (`/empresas`) | sim | sim (página nega) | | | | sim | sim (página nega) | nav.ts:63-69 |
| 18 | Configuração (`/configuracao`) | sim | **não** (mas tem aba CRM) | | sim | | | sim | nav.ts:70-77 |

Resultado por papel (o que o QA deve ver no menu):

| Papel | Itens, na ordem da tela |
|---|---|
| ADMINISTRADOR | os 18 |
| GERENTE_COMERCIAL | Comissões, Matrículas, Home, Funil, Relatórios, Agente de IA, Carteira, Contatos, Tarefas, Inbox, Financeiro, Empresas (12) |
| VENDEDOR | Comissões, Matrículas, Home, Funil, Relatórios, Carteira, Contatos, Tarefas, Inbox (9) |
| GERENTE_PEDAGOGICO | Permutas, Mudanças acadêmicas, Diário de aulas, Home, Inbox, Alunos, Configuração (7) |
| PROFESSOR | Mudanças acadêmicas, Diário de aulas, Home, Inbox, Alunos (5) |
| FINANCEIRO | Permutas, Comissões, Home, Tarefas, Inbox, Alunos, Financeiro, Empresas (8) |
| SECRETARIA_ACADEMICA | Mudanças acadêmicas, Matrículas, Envios do portal, Home, Contatos, Tarefas, Inbox, Alunos, Empresas, Configuração (10) |
| ALUNO (usuário da equipe só com esse papel) | nenhum: é redirecionado para `/portal` antes do menu (`src/server/_shared/sessao.ts:182-185`) |

Rodapé do menu: iniciais e nome, link "Fuso" (`/preferencias`), alternância de tema e "Sair" (`src/components/Sidebar.tsx:139-153`;
no celular, `src/components/BarraMobile.tsx:60-61`). Os papéis do menu são relidos do banco a cada requisição
(`src/app/(app)/layout.tsx:10`). O contador de não lidas aparece só no item Inbox (`src/components/Sidebar.tsx:105-110`).

Home por papel (`src/app/(app)/home/page.tsx:17-37`): ADM e GC veem a Home de gestão; PROFESSOR vê turmas e experimentais;
os demais (VEN, GP, FIN, SEC) veem "Olá, nome" com atalhos iguais aos do menu. A Home do Vendedor descrita no doc 09 foi
removida na E1 (`src/app/casca-crm-removida.test.ts:9`).

### Sub-abas de Configuração (`src/app/(app)/configuracao/_componentes/tabs.ts:11-32`)

O layout de Configuração aceita GP, GC e SEC, além do ADM (`src/app/(app)/configuracao/layout.tsx:11`); `/configuracao` leva à
primeira aba do papel (`src/app/(app)/configuracao/page.tsx:8-10`).

| Aba | ADM | GC | GP | SEC | Guard da página |
|---|---|---|---|---|---|
| Países | sim | | | | `paises/page.tsx:7` ADM |
| Modelos contratuais | sim | | | sim | **sem guard na página**; a consulta exige SEC (`src/server/contratos/modelos.ts:48`) |
| Catálogo | sim | | sim | | `catalogo/page.tsx:19` GP |
| Turmas | sim | | sim | | `turmas/page.tsx:12` GP |
| Usuários | sim | | | | `usuarios/page.tsx:13` ADM |
| Operação (inclui os prazos do portal) | sim | | | | `operacao/page.tsx:10` ADM |
| Preparação de migração | sim | | | | `migracao/page.tsx:11` ADM |
| CRM | sim | sim | | | `crm/page.tsx:8` ADM, GC |
| WhatsApp | sim | | | | layout e índice aceitam GC (`whatsapp/layout.tsx:10`), mas as 4 seções são só do ADM (`whatsapp/secoes.ts:15-22`) |

Seções do CRM (`src/app/(app)/configuracao/crm/secoes.ts:17-21`): Distribuição e SLA, Tags e campos, Respostas rápidas e
Metas (ADM e GC); IA (só ADM).

### Sub-abas do Acadêmico e do Diário (SecaoArea)

Fontes: `src/app/(app)/academico/secoes.ts:21-39` e `src/app/(app)/diario/secoes.ts:14-21`. Os layouts só desenham a barra
(`academico/layout.tsx:11-14`, `diario/layout.tsx:11-14`) e a escondem quando há uma aba só. O Administrador vê todas
(`src/lib/nav.ts:128-138`).

| Papel | Acadêmico (16 abas) | Diário (7 abas) |
|---|---|---|
| ADM | todas | todas |
| GP | Mudanças acadêmicas, Avaliações, Recuperações, Segundas chamadas pendentes, Agendas de segunda chamada, Regras de avaliação, Correções, Aproveitamentos, Reposições, Indisponibilidades docentes, Grades, Quantidade de aulas, Calendário, Admissões (14) | Aulas, Encontros, Pendências, Regularizações de aula, Exceções de gravação, Regularizações de gravação (6) |
| PRO | Mudanças acadêmicas, Avaliações, Recuperações, Minhas recuperações, Minhas segundas chamadas, Indisponibilidades docentes (6) | Aulas, Encontros, Pendências, Regularizações de aula, Reposições, Exceções de gravação (6) |
| SEC | Mudanças acadêmicas, Segundas chamadas pendentes, Agendas de segunda chamada, Aproveitamentos, Reposições, Indisponibilidades docentes, Grades, Quantidade de aulas, Calendário, Admissões (10) | só Encontros, sem barra (não há item de menu; chega pelo Acadêmico) |

### Abas do Financeiro (`src/app/(app)/financeiro/abas.ts:28-38`, permissões em `financeiro/contexto.ts:22-37`)

Abrem o painel: ADM, FIN e GC (`src/app/(app)/financeiro/papeis.ts:6`). A Secretaria não abre o painel; ela consulta a
ficha financeira individual do aluno.

| Papel | Abas |
|---|---|
| ADM | Cobranças, A conferir, Retomadas, Comissões, Descontos, Visão geral, Política de comissão, Aprovações, Câmbio |
| FIN | Cobranças, A conferir, Retomadas, Comissões, Descontos, Visão geral, Câmbio (Política de comissão só com a capacidade `comissao.configurar`) |
| GC | Comissões, Descontos, Aprovações (leitura e aprovação) |

## Matriz de acesso por área

Guard real = papéis passados a `exigirSessaoPagina` (redireciona para `/acesso-negado`), a `exigirPapelLeitura` (mostra
"Acesso negado" na própria página) ou outro mecanismo indicado. O ADM passa sempre e não é repetido na coluna. Sem sessão,
todo guard da equipe manda para `/login?callbackUrl=...` (`src/server/_shared/sessao.ts:145-155`, `:169-179`). Usuário só
ALUNO vai para `/portal` (`sessao.ts:182-185`).

| Área / prefixo | Páginas | Guard real (papéis) | Fonte normativa | Status |
|---|---|---|---|---|
| `/home`, `/preferencias` | 2 | só sessão (`home/page.tsx:12`, `preferencias/page.tsx:7`) | doc 09 (shell); SPEC §8 (preferência de fuso) | CONFORME |
| `/acesso-negado` | 1 | nenhum; tela estática (`acesso-negado/page.tsx:7-25`) | doc 07 | CONFORME |
| `/funil`, `/carteira`, `/relatorios` | 3 | GC, VEN (`funil/page.tsx:20`, `carteira/page.tsx:34`, `relatorios/page.tsx:50`); escopo por carteira/equipe | doc 37 §3 e §4 `crm.ler`; SPEC §4 Comercial | CONFORME |
| `/aria` | 1 | GC (`aria/page.tsx:27`) | sem norma de acesso específica | SEM_DOC |
| `/contatos` | 1 | GC, VEN, SEC (`contatos/page.tsx:23`) | doc 37 §5 (contato) | CONFORME |
| `/tarefas` | 1 | GC, VEN, FIN, SEC (`tarefas/page.tsx:25`) | sem norma específica | SEM_DOC |
| `/comissoes` | 1 | FIN, GC, VEN (`comissoes/page.tsx:12`); VEN vê só a própria, GC a da equipe (`comissoes/page.tsx:24`) | doc 37 §5 (Comissão) | CONFORME |
| `/inbox` | 1 | GC, VEN, FIN, SEC, PRO, GP (`inbox/page.tsx:29`, `src/server/whatsapp/escopo.ts:16-24`); conteúdo filtrado por atendimento | doc 37 §6.6 e D04; doc 36 (linha comercial) | CONFORME |
| `/oportunidades/[id]/contratacao`, `/matriculas/nova` | 2 | VEN, GC, SEC (`contratacao/page.tsx:9`, `matriculas/nova/page.tsx:23`) | doc 37 §4 `matricula.criar` | CONFORME |
| `/secretaria` (Matrículas) | 1 | SEC, VEN, GC (`secretaria/page.tsx:15`) | doc 37 §4 e D05 | CONFORME |
| `/secretaria/{avisos-agenda,desistencias,envios-portal}` | 3 | SEC (`:15`, `:12`, `:19`) | SPEC §5; doc 41 l.447 | CONFORME |
| `/secretaria/reservas/**` | 3 | SEC (`reservas/page.tsx:10`, `[id]/page.tsx:10`, `particulares/[id]/page.tsx:10`) | SPEC §5 | CONFORME |
| `/matriculas/[id]` (hub) | 1 | sem guard na página; `carregarCabecalho` exige a união dos papéis das seções (`matriculas/[id]/carregar-cabecalho.ts:12`, `secoes.ts:41`) e aplica o escopo comercial (`src/server/matricula/cabecalho.ts:24`) | SPEC matrícula como unidade operacional | CONFORME |
| `/matriculas/[id]/{preparacao,reserva}` | 2 | VEN, GC, SEC | D05 | CONFORME |
| `/matriculas/[id]/{contrato/**,emissao,nova-reserva}` | 13 | SEC; `aditivos/[propostaId]/alcadas` aceita SEC, FIN, GC e GP; `aditivos/agenda` aceita SEC e GP | SPEC contratual | CONFORME |
| `/matriculas/[id]/{pagador,condicoes,condicoes-horas,continuidade-mensal,entrada-particular}` | 5 | SEC, FIN | D01; SPEC §7 | CONFORME |
| `/matriculas/[id]/{ocorrencias-financeiras/**,fechamentos-horas,compensacoes/**}` | 5 | FIN | SPEC §7 | CONFORME |
| `/matriculas/[id]/{autorizacoes-comunicacao,desistencia,desistencia/administracao,desistencia/documentos,desistencia/financeiro}` | 5 | SEC; `desistencia/financeiro` é FIN | SPEC desistência | CONFORME |
| `/matriculas/[id]/{disponibilidade-oferta,indisponibilidade-oferta/**}` | 4 | SEC, GP, FIN | SPEC §5 | CONFORME |
| `/alunos` (lista) | 1 | SEC, GP, FIN, PRO (`alunos/(lista)/page.tsx:14-24`); PRO só vê alunos das próprias turmas | doc 37 §4 `aluno.ler`; doc 07 (row-level) | CONFORME |
| `/alunos/[id]`, `/alunos/turma/[id]` | 2 | SEC, GP, FIN, PRO (`alunos/[id]/page.tsx:24-29`, `turma/[id]/page.tsx:17-22`); projeção de campos por papel | doc 37 §5 | CONFORME |
| `/alunos/[id]/financeiro` | 1 | FIN, SEC, GC, VEN (`financeiro/page.tsx:21-26`); VEN e GC recebem só o resumo comercial do próprio escopo (`:31-35`) | doc 37 §4 `financeiro.ler_comercial` | CONFORME |
| `/alunos/[id]/{academico,agenda-aditivo,movimentacoes,creditos/[creditoId],portal}` | 5 | SEC/GP/PRO; SEC/GP; SEC/FIN (`PAPEIS_PAUSA`, `src/server/matricula/pausa-estado.ts:8`); FIN; SEC | doc 37 §4 `aluno.movimentar`; SPEC §4 (Aluno) | CONFORME |
| `/academico` (raiz) | 1 | SEC, GP, PRO (`academico/page.tsx:14`) | D14 (doc 40) | CONFORME |
| `/academico/{avaliacoes,recuperacoes,correcoes,regras,segundas-chamadas,reposicoes,equivalencias}/**` | 46 | combinações de PRO, GP e SEC conforme a operação (lista no Apêndice A) | SPEC-ERP-004; specs de segunda chamada e recuperação | CONFORME |
| `/academico/{admissoes,calendario,grades,modalidades,indisponibilidades}/**` | 17 | SEC, GP (indisponibilidades também PRO) | SPEC §5 | CONFORME |
| `/diario/**` (exceto gravação) | 12 | PRO, GP; encontros e cancelamento também SEC; remarcação SEC e GP; pendências e regularizações de gravação GP; reposições só PRO | D08; SPEC §4 (Professor) | CONFORME |
| `/diario/encontros/[id]/gravacao` | 1 | sem guard de papel; `autorizarVideoAulaInstitucional` decide (`gravacao/page.tsx:7`), e a tela mostra "Gravação indisponível para este acesso." | SPEC §4 | CONFORME |
| `/financeiro` (painel e 9 abas) | 10 | sem `exigirSessaoPagina`; `contextoDaAba` exige FIN ou GC e a aba visível (`financeiro/contexto.ts:22-43`; cada aba, ex. `(painel)/cobrancas/page.tsx:18`) | doc 37 §4 `financeiro.ler_gestao` | CONFORME |
| `/financeiro/{acertos-*,continuidade,desistencias,migracao/**,recebimentos}` | 11 | FIN (`recebimentos/page.tsx:14` usa `exigirPapelLeitura("FINANCEIRO")`) | SPEC §7 | CONFORME |
| `/financeiro/permuta` | 1 | FIN, GP via `exigirSessaoComPapel`, que é o guard de Server Action (`permuta/page.tsx:12`) | padrão de guard de página (`sessao.ts:157-162`) | DIVERGENTE |
| `/empresas`, `/empresas/[id]` | 2 | FIN (`empresas/page.tsx:13`, `[id]/page.tsx:13`) | doc 03 (B2B); o menu mostra o item a GC e SEC | DIVERGENTE |
| `/configuracao` (índice) | 1 | GP, GC, SEC (`configuracao/page.tsx:8`) | doc 37 §4 (configurações) | CONFORME |
| `/configuracao/{paises,usuarios,operacao/**,migracao,migracao/[loteId]}` | 6 | ADM | doc 37 §4 `acesso.administrar` e `mercado.manter` | CONFORME |
| `/configuracao/migracao/presenca/[linhaId]` | 1 | SEC, GP (`presenca/[linhaId]/page.tsx:8`) | M01 | CONFORME |
| `/configuracao/{catalogo,turmas}` | 2 | GP | doc 37 §4 `curriculo.manter` e `turma.manter` (GP/SEC) | DIVERGENTE (Turmas, achado 13) |
| `/configuracao/contratos` | 1 | **nenhum na página**; o layout aceita GP, GC e SEC; a consulta exige SEC (`src/server/contratos/modelos.ts:48`) | padrão de guard de página | DIVERGENTE |
| `/configuracao/contratos/{novo,[codigo]}` | 2 | SEC (`novo/page.tsx:5`, `[codigo]/page.tsx:16`) | SPEC contratual | CONFORME |
| `/configuracao/crm/**` | 6 | GC (`crm/page.tsx:8`); seção IA só ADM (`crm/ia/page.tsx:7`) | doc 37 §4 `comercial.configurar` | CONFORME |
| `/configuracao/whatsapp/**` | 5 | índice e layout aceitam GC; as 4 seções só ADM (`whatsapp/numeros/page.tsx:12` e demais) | doc 37 §4 `canal.configurar` | CONFORME |
| Fora do shell: `/login` e `/` | 2 | públicas; `/` redireciona para `/home` (`src/app/page.tsx:4`) | docs/42 (/login) | PARCIAL (achado 22) |
| Fora do shell: `/portal` (legado) | 1 | pública, sem consulta (`src/app/(portal)/portal/page.tsx:9-28`) | SPEC §4 (Aluno) | CONFORME |
| Fora do shell: `/portal-aluno/{entrar,ativar,recuperar}` | 3 | públicas | SPEC §4 (Aluno) | CONFORME |
| Fora do shell: `/portal-aluno`, `/resultados`, `/preferencias`, `/reposicoes/[id]` | 4 | sessão do portal (`exigirSessaoPortalAlunoPagina`, `src/server/portal-aluno/sessao.ts:112-116`; resultados e reposição pelo guard da consulta) | SPEC §4 (Aluno) | CONFORME |
| Fora do shell: `/certificado/[codigo]`, `/pagar/[token]` | 2 | públicas, por código ou token | fora da área 01 | SEM_DOC |
| `src/app/api/**` | 39 rotas | todas com guard: sessão e papel, sessão do portal, segredo de cron ou assinatura de webhook. As importações XLSX conferem ADM ativo no próprio handler (`src/app/api/alunos/importar/route.ts:58-72`, `src/app/api/turmas/importar/route.ts:44-57`) | doc 37 §4 (rotas) | CONFORME |

As 15 páginas sem guard de papel na própria `page.tsx` são `acesso-negado`, `configuracao/contratos`,
`diario/encontros/[id]/gravacao`, as 10 de `financeiro/(painel)`, `financeiro/permuta` (usa o guard de ação) e
`matriculas/[id]` (hub). Só `configuracao/contratos` e `financeiro/permuta` mostram tela de erro em vez de negação.

## Critérios de aceite do doc 37 §8

Os critérios estão em `docs/37-detalhamento-operacional-do-acesso.md:317-348`. "Atendido" quer dizer que código e teste
automatizado nomeado existem; nenhum teste foi executado nesta auditoria. O doc 38 registra a última rodada global de
acesso em 08/09/2026 (`docs/38-implementacao-acesso-validacao.md:36-42`), anterior a muitas mudanças.

| Critério | Evidência arquivo:linha | Status |
|---|---|---|
| AC01 VEN consulta lead próprio e alheio | `src/server/_shared/escopo-comercial.ts:33-58`; `src/server/comercial/consultas.test.ts:18`; `src/server/crm/funil-carteira-equivalencia.int.test.ts:226`; `src/server/crm/ficha-contato.int.test.ts:157` | Atendido |
| AC02 GC vê só a equipe atribuída, inclusive em totais e relatórios | `escopo-comercial.ts:52-57`; `src/server/acesso/politica.int.test.ts:100`; `src/server/relatorios/escopo.int.test.ts:29` | Atendido |
| AC03 VEN+PRO consulta aluno da turma sem vínculo comercial | `src/server/alunos/cadastro.int.test.ts:88` | Atendido |
| AC04 PRO recebe só o contexto pedagógico | `src/server/alunos/consultas.ts:281-318` (projeção); `src/server/alunos/projecao.test.ts:27-89`; `src/app/api/exportacoes/[tipo]/route.int.test.ts:98`; `src/server/uploads/arquivos.int.test.ts:127` | Atendido |
| AC05 PRO perde a turma e mantém só as próprias aulas em leitura | `src/server/diario/diario.int.test.ts:413`; `projecao.test.ts:84` | Atendido |
| AC06 desativação ou perda de papel após o login | `src/server/_shared/sessao.ts:68-77` e `:163-188`; `src/server/acesso/politica.int.test.ts:85`; `src/app/api/upload/route.test.ts:19`; `src/app/api/files/[...path]/route.test.ts:92`; `src/app/api/inbox/eventos/route.test.ts:93` | Atendido |
| AC07 cobertura começa, termina ou é revogada | `escopo-comercial.ts:43-49`; `politica.int.test.ts:107` e `:125`; tela em `src/app/(app)/carteira/page.tsx:36-66` (aba Coberturas) | Atendido |
| AC08 lead ou atendimento muda de dono | `politica.int.test.ts:134`; `src/server/whatsapp/acesso-atendimento.int.test.ts:53` | Atendido |
| AC09 PRO não obtém conteúdo financeiro de contato misto | `acesso-atendimento.int.test.ts:100` | Atendido |
| AC10 informe da SEC não baixa nem ativa | `src/server/financeiro/politica.int.test.ts:66` e `:232` | Atendido |
| AC11 FIN diferente confirma; a rejeição preserva a evidência | `financeiro/politica.int.test.ts:66` e `:91` | Atendido |
| AC12 SEC+FIN não confirma o próprio informe | `financeiro/politica.int.test.ts:83`; `src/server/financeiro/operacoes.test.ts:121` | Atendido |
| AC13 confirmações simultâneas ou repetidas | `financeiro/politica.int.test.ts:66` ("exatamente uma vez") e `:99` | Atendido |
| AC14 mudança após submissão ou aprovação invalida a conferência | `financeiro/politica.int.test.ts:130` (aprovação de desconto); para informe de pagamento alterado após o envio, não encontrado | Parcial |
| AC15 VEN altera cadastro após a assunção pela SEC | `src/server/secretaria/politica.int.test.ts:114` | Atendido |
| AC16 desconto dentro e acima da alçada, na criação e no ajuste | `financeiro/politica.int.test.ts:120` e `:199` | Atendido |
| AC17 taxa e mensalidade verificadas separadamente | `src/server/financeiro/regras.test.ts:28` | Atendido |
| AC18 reduções sucessivas ou promoção acumulada | `financeiro/politica.int.test.ts:120` (desconto acumulado); promoção acumulada não encontrada | Parcial |
| AC19 GC solicitante, ausente ou acumulando ADM | `financeiro/politica.int.test.ts:130` (solicitante não aprova o próprio pedido) e `:148`; roteamento D03 para "GC ausente" não encontrado | Parcial |
| AC20 usuário altera a própria alçada para aprovar | `src/server/acesso/acoes.ts:96-101`; `acesso/politica.int.test.ts:64` | Atendido |
| AC21 comissão percentual e fixa; o formulário do VEN não sobrescreve a regra | `financeiro/politica.int.test.ts:184` e `:189` | Atendido |
| AC22 nova regra de comissão preserva a anterior | `financeiro/politica.int.test.ts:189` | Atendido |
| AC23 desconto na taxa de comissão fixa ou já paga | `financeiro/politica.int.test.ts:139`; `regras.test.ts:46` | Atendido |
| AC24 regra ausente, sobreposta ou com moeda incompatível | `financeiro/politica.int.test.ts:184` (regra ausente); sobreposta e moeda incompatível não encontradas | Parcial |
| AC25 transferência equivalente e salto de nível | `src/server/academico/fluxo.int.test.ts:736`; `src/server/alunos/movimentacao.test.ts:40` | Atendido |
| AC26 equipe consulta o catálogo e não edita | `src/server/catalogo/permissoes.int.test.ts:14` e `:27` | Atendido |
| AC27 exportação sem concessão e com colunas/IDs forjados | `src/app/api/exportacoes/[tipo]/route.int.test.ts:62`, `:69` e `:134-160` | Atendido |
| AC28 link de arquivo reutilizado ou acessado após revogação | `secretaria/politica.int.test.ts:176`; `uploads/arquivos.int.test.ts:127`, `:146` e `:167-186` | Atendido |
| AC29 permissão, dono, recusa ou cobrança muda antes do envio | `acesso-atendimento.int.test.ts:140-167`; `src/server/whatsapp/destinatario-atual.int.test.ts:97-135` | Atendido |
| AC30 FIN pesquisa responsável compartilhado por irmãos | nenhum teste específico encontrado (`src/server/ajustes/ficha.int.test.ts:64` cobre só o vendedor) | Não |

## Tabela de achados

| # | Tema | Fonte normativa | O que a fonte diz | O que o código faz (arquivo:linha) | Status | O que o QA deve esperar na interface |
|---|---|---|---|---|---|---|
| 1 | Papéis do enum | doc 07 `:83-94` e `:126-127`; SPEC §1 `docs/specs/erp-educacional.md:30` | 7 papéis da equipe; no doc 07, ALUNO é "V2, fora do V1"; a SPEC inclui a área do aluno | Enum com 8 papéis, incluindo ALUNO (`prisma/schema.prisma:509-518`) | CONFORME (doc 07 obsoleto quanto ao Aluno) | Em Configuração › Usuários aparecem 8 caixas de papel. |
| 2 | Papel ALUNO no cadastro de usuários da equipe | SPEC §4 `erp-educacional.md:85` | "Autenticação não concede papel interno de funcionário"; o aluno tem acesso próprio | O formulário lista todos os valores do enum, inclusive "Aluno (portal)" (`src/app/(app)/configuracao/usuarios/UsuarioFormulario.tsx:127-137`). Usuário só ALUNO vai para `/portal` (`sessao.ts:182-185`), que só explica que o acesso é outro (`src/app/(portal)/portal/page.tsx:9-28`) | DIVERGENTE | É possível criar um usuário só com "Aluno (portal)", mas ao entrar ele vê "A área do aluno tem acesso próprio" e não consegue fazer nada. O caminho certo do aluno é o convite do portal. |
| 3 | Menu Empresas | doc 03 (B2B); o próprio comentário diz "papéis alinhados ao nav" (`empresas/page.tsx:10-11`) | Menu e página devem bater | Menu: ADM, GC, FIN, SEC (`src/lib/nav.ts:63-69`). Página: só FIN e ADM (`src/app/(app)/empresas/page.tsx:13`, `:16-17`; `[id]/page.tsx:13`) | DIVERGENTE | GC e SEC veem "Empresas" no menu; ao clicar, aparece "Acesso negado — Você não tem permissão para acessar as empresas (B2B)". Registrar como bug de menu. |
| 4 | Gerente Comercial sem item Configuração | doc 37 §4 `comercial.configurar` (GC/ADM) | GC configura os parâmetros comerciais no seu escopo | GC passa no layout e tem a aba CRM (`configuracao/layout.tsx:11`, `tabs.ts:25`), mas o item de menu exclui o GC (`nav.ts:70-77`; trava em `src/app/casca-crm-removida.test.ts:25-28`). O único link é "Definir metas", em Relatórios › Equipe (`src/app/(app)/relatorios/_componentes/AbaEquipe.tsx:14`). Em `/configuracao/whatsapp`, o GC é levado para a Home sem explicação (`configuracao/whatsapp/page.tsx:13-14`) | DIVERGENTE (depende do PO) | O GC não vê "Configuração" no menu. Digitando `/configuracao`, cai em Configuração › CRM, com as seções Distribuição e SLA, Tags e campos, Respostas rápidas e Metas. |
| 5 | Ordem do menu | doc 09 `docs/09-fase0-telas.md:13` | Home é o primeiro item | Segue a ordem do array: Permutas, Mudanças acadêmicas, Comissões, Matrículas, Envios do portal, Diário, Home... (`nav.ts:12-18`) | DIVERGENTE (baixo) | Para ADM, FIN e GP o primeiro item é "Permutas"; a Home fica no meio da lista. |
| 6 | Negação em Permutas | padrão de guard de página (`sessao.ts:157-162`, `src/lib/guards.ts:5-10`) | A página nega redirecionando para `/acesso-negado` | Usa `exigirSessaoComPapel(FINANCEIRO, GERENTE_PEDAGOGICO)` (`permuta/page.tsx:12`), que lança `ErroPermissao` (`sessao.ts:129-138`) e cai no erro da área (`src/app/(app)/financeiro/error.tsx`) | DIVERGENTE | VEN, GC, SEC ou PRO que digitam `/financeiro/permuta` veem "Não foi possível carregar esta tela", e não "Acesso negado". |
| 7 | Modelos contratuais sem guard de página | idem | idem | `configuracao/contratos/page.tsx:6-8` não tem guard; o layout aceita GP, GC e SEC (`configuracao/layout.tsx:11`); `listarFamiliasModelos` exige SEC (`src/server/contratos/modelos.ts:47-48`) | DIVERGENTE (baixo) | GP ou GC que digitam `/configuracao/contratos` veem a tela de erro com "Tentar de novo". A aba não aparece para eles. |
| 8 | Duas formas de "Acesso negado" | sem norma | — | `exigirSessaoPagina` redireciona para `/acesso-negado` (`sessao.ts:186`; tela em `acesso-negado/page.tsx:13-23`, com o botão "Voltar ao início"). `exigirPapelLeitura` mostra o componente na mesma URL, sem botão (`src/components/AcessoNegado.tsx:3-12`) | SEM_DOC | Em algumas páginas a URL muda para `/acesso-negado`; em outras (Alunos, Empresas, Financeiro, Usuários, WhatsApp) a URL fica e aparece "Você não tem permissão para acessar X". As duas formas estão corretas. |
| 9 | Guard no servidor com papéis atualizados | doc 36 `:24`; doc 37 §7 `:303` e `:309` | Conferir no servidor com os papéis atuais; o menu não é segurança | `carregarUsuarioFresco` relê papéis e `ativo` a cada requisição (`sessao.ts:68-77`); os guards de página e de ação usam essa leitura (`sessao.ts:106-117`, `:163-188`; `guards.ts:17-28`); o layout relê o menu (`(app)/layout.tsx:10`) | CONFORME | Ao remover um papel de alguém logado, o item some do menu no próximo clique e a página passa a negar, sem novo login. |
| 10 | Escopo comercial por linha | doc 37 §3 `:88-89`; D02 | Carteira própria, cobertura vigente e equipe explícita; falta de vínculo não vira escopo global | `escopo-comercial.ts:33-58`: VEN = próprios + coberturas vigentes; GC = vendedores cujo `gerenteComercialId` é ele; sem vínculo = nada. Aba Coberturas para GC e ADM (`carteira/page.tsx:36-66`; ações só de GC em `src/server/acesso/coberturas.ts:15` e `:30`). O quadro registrava a cobertura como "sem UI" (`quadro-entregas.md:186`); hoje há tela | CONFORME | O vendedor vê só os próprios leads e os do titular coberto durante o período. GC sem equipe vê o funil vazio. Lead de outro vendedor aberto pela URL não carrega. |
| 11 | Escopo do professor e projeção de campos | doc 37 §3 `:91-92` e §5 `:199-221`; doc 07 `:77` | Professor vê só as próprias turmas, sem documento, contato, endereço ou financeiro | `escopoAlunos` (`src/server/alunos/consultas.ts:65-72`), `professorVeAluno` (`:76-87`), `obterTurma` (`:359-379`), vínculo docente temporal (`src/server/diario/permissoes.ts:4` e `:16`); projeção por campo (`consultas.ts:281-318`); financeiro só para ADM, SEC e FIN (`:40-42`) | CONFORME | O professor vê na lista só os alunos das turmas atuais dele, e a ficha não mostra documento, e-mail, telefone, endereço nem valores. A ficha de aluno de outra turma dá "não encontrado". O GP também não vê contato (só ADM e SEC têm o cadastro completo). |
| 12 | Escopo do aluno no portal | SPEC §4 `:85`; doc 36 `:34` | O aluno vê só os próprios dados, por matrícula | A sessão liga a conta ao `alunoId` (`src/server/portal-aluno/sessao.ts:41-63`); reposição de outro aluno vira 404 (`src/app/portal-aluno/reposicoes/[id]/page.tsx:24-29`); isolamento por matrícula testado (`src/server/portal-aluno/identidade.int.test.ts:142` e `:151`) | CONFORME | Trocar o ID da reposição na URL mostra "página não encontrada", e não dados de outro aluno. |
| 13 | Manutenção de turmas pela Secretaria | doc 37 §4 `:162` (`turma.manter`: GP/SEC conforme atribuição); doc 07 `:92` (SEC aloca aluno) | A SEC participa da manutenção de turmas | Só GP e ADM: `configuracao/turmas/page.tsx:12`; ações em `src/server/turmas/acoes.ts:66` e `:73`; a aba não inclui SEC (`tabs.ts:15-19`) | DIVERGENTE (depende do PO) | A Secretaria não vê a aba Turmas e, digitando `/configuracao/turmas`, vai para "Acesso negado". A movimentação de aluno entre turmas continua na ficha do aluno. |
| 14 | Bloqueio de login da equipe | sem norma no doc 37; descrito em `docs/qa/02-usuarios-e-papeis.md:28-29` | — | 5 falhas por e-mail em 15 min bloqueiam, contadas na memória do processo (`src/lib/rate-limit-login.ts:8-9`, `:11`, `:21-23`); conta bloqueada recebe a mesma resposta de senha errada; tentativa em conta inativa também conta como falha (`src/lib/auth.ts:24-30`) | SEM_DOC | Na 6ª tentativa em 15 min, até a senha certa dá "E-mail ou senha incorretos.". Reiniciar o servidor zera o bloqueio. O bloqueio é por e-mail, não por IP. |
| 15 | Duração da sessão da equipe | sem norma | — | JWT do Auth.js sem `maxAge` configurado (`src/lib/auth.ts:9`), então vale o padrão da biblioteca (30 dias, renovado com o uso). O Inbox fecha a conexão quando o token vence (`src/lib/prazo-sessao.ts:7-9`) | SEM_DOC | A sessão não expira em horas. Não abrir bug de "não deslogou" sem decisão do PO sobre o prazo. |
| 16 | Troca e recuperação de senha da equipe | docs/42 `:2554` (pendência) | Sem fluxo próprio; orientar a pessoa a pedir ao administrador | Não há troca pelo próprio usuário (Preferências só tem fuso, `src/app/(app)/preferencias/page.tsx:9`). O login mostra "Esqueceu a senha? Peça a redefinição a um administrador." (`src/app/login/page.tsx:96-97`). O ADM redefine em Usuários (`src/server/acesso/acoes.ts:84` e `:121`; mínimo de 6 caracteres em `schema.ts:24` e `:31`) | NAO_IMPLEMENTADO | Não existe "Esqueci minha senha" para a equipe nem tela de troca de senha. Só o ADM troca, em Configuração › Usuários › editar. |
| 17 | Troca de senha não encerra sessões | doc 37 AC06 (trata só desativação e perda de papel) | — | A sessão JWT não tem versão; trocar a senha não invalida o cookie em uso (`auth.ts:53-71`; `acoes.ts:121`) | SEM_DOC | Se o ADM trocar a senha de alguém logado em outro navegador, essa pessoa continua logada até ser desativada ou até a sessão vencer. |
| 18 | E-mail com maiúsculas | — (defeito) | O login deve funcionar com o e-mail cadastrado | O login converte para minúsculas (`auth.ts:18`) e busca por igualdade exata (`auth.ts:26`); o cadastro grava como foi digitado (`acoes.ts:44` e `:53`; `schema.ts:13`) | DIVERGENTE | Criar o usuário `Teste.QA@genius.com` e tentar entrar: "E-mail ou senha incorretos.", com qualquer grafia. Também é possível criar dois usuários que diferem só em maiúsculas e minúsculas. |
| 19 | Campo de senha no formulário de usuário | docs/42 `:2412` (prioridade Alta) | Usar `autoComplete="new-password"` para o navegador não preencher a senha do ADM | O campo não tem `autoComplete` (`UsuarioFormulario.tsx:99`) | DIVERGENTE | Ao editar outro usuário, o navegador pode preencher a senha do próprio ADM no campo "Nova senha"; salvar troca a senha do outro sem aviso. |
| 20 | Desativação de usuário | doc 37 AC06 `:324`; docs/42 `:2555` | Próximas ações negadas; a auditoria de UX sugere mensagem própria | Desativar exige confirmação e grava evento (`acoes.ts:145-162`; diálogo em `UsuariosPainel.tsx:164-176`); o ADM não desativa a si mesmo (`acoes.ts:154`); na próxima página o desativado vai para `/login` (`sessao.ts:175-179`); o login responde com a mensagem genérica (`auth.ts:27-30`, `login/page.tsx:40-43`) | PARCIAL | A pessoa desativada é levada ao login no próximo clique e, ao tentar entrar, vê "E-mail ou senha incorretos." (não há aviso de "acesso desativado"). |
| 21 | `/login` com sessão ativa | docs/42 `:2557` (pendência) | Redirecionar quem já está logado | Página cliente, sem checagem de sessão (`login/page.tsx:1-27`) | SEM_DOC | Com a sessão ativa, abrir `/login` mostra o formulário de novo. |
| 22 | Entrada pela raiz e caminho do aluno | docs/42 `:2542` e `:2556` | Separar a entrada do aluno da entrada da equipe | `/` vai para `/home` e daí para `/login` (`src/app/page.tsx:4`); o login tem "É aluno? Acesse a área do aluno" (`login/page.tsx:99-102`); depois do login, volta ao `callbackUrl` interno (`login/page.tsx:46`) | PARCIAL | Abrir o domínio sem sessão leva ao login da equipe, com o link para a área do aluno no rodapé. Abrir um link interno sem sessão e fazer login leva de volta à página pedida. |
| 23 | Prazos do portal obrigatórios | SPEC §10 `:224`; comentário em `politica.ts:24` | Sem número implícito; configurar antes do uso | Sem os 4 prazos, emitir link ou abrir sessão falha (`src/server/portal-aluno/politica.ts:25-37`; `identidade.ts:48-62`); o ADM salva os prazos em Configuração › Operação (`src/server/portal-aluno/configuracao.ts:15-35`) | CONFORME | Antes de qualquer teste de portal, o ADM preenche os prazos de sessão, convite, recuperação e validação de e-mail. Sem isso, o aluno vê "Não foi possível entrar com esses dados..." e a Secretaria recebe "Configure todos os prazos do portal do aluno antes de emitir links ou sessões." |
| 24 | Entrega de convite e recuperação | SPEC §10 `:224`; doc 41 `:447`; quadro `:366` ("criação de senha pela equipe" não liberada) | Envio real só com as dependências validadas; a equipe não cria senha | O envio só ocorre com `EMAIL_PORTAL_ENVIO_ENABLED=true`, `RESEND_API_KEY`, remetente e URL pública (`processar-envios.ts:8-36`), pelo cron protegido (`src/app/api/portal-aluno/envios/cron/route.ts:9-11`). A tela avisa que a equipe não vê senha, token ou link (`alunos/[id]/portal/page.tsx:22`) | CONFORME (bloqueia o UAT) | O QA precisa de um aluno cadastrado com o e-mail de uma caixa que ele lê. Em `/secretaria/envios-portal`, acompanha o estado do envio. Sem as variáveis, o envio fica preparado e nada chega. |
| 25 | Bloquear a conta do portal | doc 36 `:34` (aluno com matrícula autorizada) | Não exige bloqueio manual | A coluna `ativa` é respeitada no login e na sessão (`sessao.ts:56`), mas não há ação na interface para bloquear a conta (`src/server/portal-aluno/actions.ts:10-18` tem só convite e troca de e-mail) | SEM_DOC | Não existe botão "bloquear acesso do aluno ao portal". Não é bug enquanto o PO não decidir. |
| 26 | Bloqueio de login e de recuperação no portal | SPEC §4 | — | Gravado no banco: 5 falhas em 15 min bloqueiam por 15 min (`src/server/portal-aluno/rate-limit.ts:4-5` e `:49-51`); a recuperação usa a mesma regra com chave própria, e cada pedido conta (`identidade.ts:190-191`); a resposta é sempre a mesma (`src/app/api/portal-aluno/recuperacao/route.ts:12-17`) | CONFORME | Na 6ª senha errada em 15 min aparece "E-mail ou senha incorretos.", mesmo com a senha certa, e o bloqueio sobrevive a um reinício. Depois de 5 pedidos de recuperação em 15 min, a tela confirma igual, mas nenhum e-mail novo sai. |
| 27 | Ativação e troca de senha do aluno | SPEC §4; quadro `:319` (#172) | Token de uso único, senha forte e confirmação | Senha de 12 caracteres a 72 bytes (`identidade.ts:28-29`), com confirmação (`src/app/portal-aluno/ativar/ativacao.ts:68-73`); consumir o token revoga os outros tokens e todas as sessões e abre uma sessão nova (`identidade.ts:234-307`); o token vai só no fragmento `#token=` (`politica.ts:58-61`) | CONFORME | Link usado duas vezes: "Este link não está mais disponível...". Senha curta: aviso no campo, e o link continua valendo. Depois de definir a senha, o aluno entra direto em "Suas reposições". |
| 28 | Conteúdo do portal | SPEC §1 `:30` e §4 `:85` | Reposições, avaliações, frequência, consolidado e material autorizado; sem portal de responsáveis | Páginas: reposições (`src/app/portal-aluno/page.tsx:16-20`), resultados, preferências de fuso e detalhe da reposição (vídeo, entregas, indisponibilidade). Sem financeiro, contrato ou cadastro | CONFORME | O aluno vê "Suas reposições", "Ver frente acadêmica e resultados parciais", "Preferências de horário" e "Sair". Não há boletos nem dados cadastrais. |
| 29 | Seeds para UAT | `docs/qa/02-usuarios-e-papeis.md:11-24` | Usuários de papel único para testar cada papel isolado | `seed.ts:10-46` (5 usuários, senha de desenvolvimento em `:8`) e `seed-qa.ts:40-83` (7 de papel único). Nenhum define `gerenteComercialId`, e nenhum cria lead, aluno, turma, conta de portal ou prazos (`seed.ts:48-54`, `seed-qa.ts:87-97`) | PARCIAL | Antes de testar escopo, o QA (como ADM) vincula `joao` e `vendedor2` ao gerente em Configuração › Usuários e cria os dados de teste pela interface. |
| 30 | Alçadas no seed de QA | `acesso/schema.ts:5` ("Limite ausente não concede autonomia"); D06 | Limites separados para taxa e mensalidade | `seed-qa.ts:92` grava só `limiteDescontoPct`, que é o campo legado (`schema.prisma:806`); `limiteDescontoTaxaPct` e `limiteDescontoMensalidadePct` ficam vazios | PARCIAL | Os vendedores de QA começam sem autonomia de desconto nos dois componentes. Para testar "desconto dentro da alçada", o ADM preenche os dois limites antes. |
| 31 | Documentação de papéis desatualizada | regra do projeto (precedência) | — | O doc 07 trata o Aluno como V2 (`docs/07-papeis-permissoes.md:94`) e aponta para o doc 36 com um caminho absoluto de outra máquina (`:67`). `docs/qa/02` descreve o GC com "Configuração › WhatsApp comercial", a Secretaria que "registra pagamento" e o menu "Home · Pipeline · Leads..." (`docs/qa/02-usuarios-e-papeis.md:54`, `:57`, `:132-134`); tudo isso foi superado | DIVERGENTE (documental) | Não usar a matriz de `docs/qa/02` como resultado esperado; usar este relatório. |
| 32 | Abas do Acadêmico e do Diário | `src/lib/nav.ts:120-125` (mesmos papéis do guard) | A aba aparece só para quem abre a página | `academico/secoes.ts:21-39` e `diario/secoes.ts:14-21`, com teste que lê cada `page.tsx` (`academico/secoes.test.ts`, `diario/secoes.test.ts`) | CONFORME | Cada papel vê só as abas listadas em "Papéis e menu"; com uma aba só, a barra não aparece (caso da Secretaria no Diário). |
| 33 | Financeiro por permissão | doc 37 §4 `:138-140`; doc 36 `:29` | SEC sem caixa, despesas ou comissões; GC lê e aprova | `financeiro/papeis.ts:6`; `abas.ts:28-38`; aba pedida sem permissão cai na aba padrão (`abas.ts:44-47`) | CONFORME | A Secretaria não tem "Financeiro" no menu e, pela URL, vê "Acesso negado — o financeiro". O GC vê três abas e não opera cobrança. |
| 34 | Autoescalação do administrador e capacidades | doc 37 AC19/AC20; D09 | Ninguém aumenta a própria permissão | O ADM não se dá papel, capacidade ou alçada maior, nem remove o próprio papel de ADM (`acoes.ts:96-101`); as 7 capacidades adicionais (`src/lib/capacidades.ts:1-5`) são relidas a cada uso (`src/server/_shared/capacidades.ts:11-18`) | CONFORME | O ADM que edita o próprio usuário e marca uma permissão nova recebe "Outro administrador deve conceder aumento das suas permissões ou alçadas." |

## Portal do aluno: fluxo real de ativação/login/recuperação

O portal do aluno é uma árvore separada (`src/app/portal-aluno/layout.tsx:7-13`), com identidade própria: `ContaPortalAluno`,
`TokenPortalAluno` (convite, recuperação e validação de troca de e-mail) e `SessaoPortalAluno`. O cookie é `portal_aluno_session`
(`src/server/portal-aluno/politica.ts:3`), httpOnly e SameSite=Lax (`:69-82`). A sessão da equipe não abre o portal, e a do
portal não abre o ERP (`src/server/_shared/portal-barreira.int.test.ts:25-57`). O endereço antigo `/portal` só explica isso e
oferece "Entrar na área do aluno" (`src/app/(portal)/portal/page.tsx:14-23`).

**Pré-condições (todas obrigatórias no UAT)**

1. O ADM preenche os 4 prazos em Configuração › Operação (`src/server/portal-aluno/configuracao.ts:15-35`). Sem isso, nada funciona (achado 23).
2. O ambiente precisa de `EMAIL_PORTAL_ENVIO_ENABLED=true`, `RESEND_API_KEY`, `EMAIL_INSTITUCIONAL_REMETENTE`, `PORTAL_ALUNO_URL_PUBLICA`
   e `CRON_SECRET`, com o cron chamando `/api/portal-aluno/envios/cron` (`processar-envios.ts:8-36`; `.env.example:53-62`).
3. Um aluno cadastrado com o e-mail de uma caixa que o QA lê. O convite só vale para o e-mail cadastral atual (`identidade.ts:271-276`).

**Convite e ativação**

1. A Secretaria ou o ADM abre a ficha do aluno › Acesso ao portal (`/alunos/[id]/portal`, guard SEC/ADM em `page.tsx:10`) e prepara
   o convite (`prepararConvitePortalAluno`, `identidade.ts:131-183`). Sem e-mail no cadastro, o resultado fica "pendente de e-mail"
   (`:156-167`). Para conta já ativada, o convite é recusado com "O aluno já possui credencial; use recuperação de acesso quando necessário." (`:152`).
2. O cron envia o e-mail com o link `/portal-aluno/ativar#token=...` (`politica.ts:58-61`). A fila aparece em `/secretaria/envios-portal`.
3. O aluno abre o link, define a senha (de 12 caracteres a 72 bytes, com confirmação) e é levado a `/portal-aluno`
   (`src/app/portal-aluno/ativar/page.tsx:74`). Sem token, a página mostra "Não encontramos o link de acesso nesta aba.", com
   "Pedir um novo link" e "Já tenho senha: entrar" (`ativar/page.tsx:35-39`).
4. Link já usado, vencido ou substituído: "Este link não está mais disponível. Ele pode ter sido usado, ter expirado ou ter sido
   substituído por um mais novo." (`src/app/portal-aluno/requisicoes.ts:10`).

**Login (`/portal-aluno/entrar`)**

- Título "Área de reposições" e o texto "Entre com o e-mail individual confirmado no seu convite." (`entrar/page.tsx:58-59`).
- Mensagens: 401 "E-mail ou senha incorretos."; 422 "Não foi possível entrar com esses dados..." (inclui prazos não configurados);
  403 para origem diferente; erro de rede (`entrar/page.tsx:8-15` e `:44-47`).
- Bloqueio: 5 falhas em 15 min (achado 26). A sessão dura o prazo configurado, sem renovação (`src/server/portal-aluno/sessao.ts:31-32`).
  Com a sessão vencida, o aluno vai para `/portal-aluno/entrar` (`sessao.ts:112-116`); outras falhas mostram "Não foi possível abrir
  esta página", com "Entrar de novo" (`src/app/portal-aluno/error.tsx:10-18`).

**Recuperação (`/portal-aluno/recuperar`)**

- O aluno informa o e-mail, e a resposta é sempre a mesma, com ou sem conta (`recuperar/page.tsx:33`; rota `recuperacao/route.ts:12-17`).
- Só sai e-mail para conta ativa, com senha e com e-mail verificado igual ao digitado (`identidade.ts:185-204`). O link leva à mesma
  tela de definir senha; ao concluir, todas as sessões anteriores são encerradas (`identidade.ts:296-303`; teste em `identidade.int.test.ts:125`).

**Troca de e-mail assistida**

- A SEC ou o ADM prepara a troca com motivo e evidência (`identidade.ts:309-312`); o aluno valida o novo e-mail pelo link; **outro** ADM
  decide (`identidade.ts:354-374`). Se o mesmo ADM que preparou tentar decidir, recebe "Outra pessoa da Administração deve decidir a troca de e-mail.".

**Sair**

- O botão "Sair", no topo de "Suas reposições", revoga a sessão no banco e volta para `/portal-aluno/entrar` (`src/app/portal-aluno/sair.tsx:8`;
  `src/app/api/portal-aluno/sair/route.ts:7-13`).

**O que o aluno abre**: `/portal-aluno` (reposições), `/portal-aluno/resultados` (frente acadêmica e resultados parciais),
`/portal-aluno/preferencias` (fuso de exibição) e `/portal-aluno/reposicoes/[id]` (detalhe, vídeo, entrega e relato de
indisponibilidade). Nada da área da equipe.

## Usuários de teste necessários

As senhas do seed principal são de desenvolvimento (`prisma/seed.ts:8`) e devem ser trocadas pelo ADM no UAT; as do seed de
QA vêm de `QA_SEED_PASSWORD` (`prisma/seed-qa.ts:20-31`). Não anotar senhas em tickets.

| Papel | Existe no seed? | E-mail | Para que serve |
|---|---|---|---|
| ADMINISTRADOR | sim (`seed.ts:17-20`) | admin@genius.com | Configuração completa, usuários, prazos do portal, vínculo de equipe e decisão da troca de e-mail do aluno. |
| ADMINISTRADOR (segundo) | **não** | criar, ex.: admin2@genius.com | Decisões independentes: troca de e-mail do portal, modelos contratuais, autoaprovação (AC19/AC20) e aumento de permissões do primeiro ADM. |
| GERENTE_COMERCIAL puro | sim (`seed-qa.ts:47-52`) | gerente@genius.com | Escopo de equipe (AC02), coberturas, aprovações no Financeiro e Configuração › CRM. **Precisa ter vendedores vinculados** (achado 29). |
| GERENTE_COMERCIAL + VENDEDOR | sim (`seed.ts:22-26`) | mariana@genius.com | Acúmulo de papéis e autoaprovação. Não serve para testar o GC isolado. |
| VENDEDOR A | sim (`seed.ts:28-32`) | joao@genius.com | Carteira própria (AC01). |
| VENDEDOR B | sim (`seed-qa.ts:65-70`) | vendedor2@genius.com | Leads e alunos de outro vendedor para o João; cobertura (AC07). |
| VENDEDOR sem limite | sim (`seed-qa.ts:71-76`) | vendedor3@genius.com | Todo desconto vai para aprovação. |
| GERENTE_PEDAGOGICO | sim (`seed-qa.ts:41-46`) | gp@genius.com | Acadêmico, Turmas, Catálogo, Permutas e ficha de aluno sem contato. |
| PROFESSOR A | sim (`seed.ts:40-44`) | carla@genius.com | Escopo por turma (AC04/AC05). Precisa de uma turma com alunos. |
| PROFESSOR B | sim (`seed-qa.ts:77-82`) | professor2@genius.com | Turma de outro professor e troca de professor (AC05). |
| FINANCEIRO puro | sim (`seed-qa.ts:53-58`) | financeiro@genius.com | Painel financeiro, Empresas e conferência de informe (AC11). |
| SECRETARIA pura | sim (`seed-qa.ts:59-64`) | secretaria@genius.com | Matrículas, convite e envios do portal, Modelos contratuais e informe de pagamento (AC10). |
| FINANCEIRO + SECRETARIA | sim (`seed.ts:34-38`) | ana@genius.com | Autoconferência negada (AC12). Não serve para isolar papéis. |
| VENDEDOR + PROFESSOR | **não** | criar, ex.: venprof@genius.com | AC03: o escopo docente não abre o financeiro comercial. |
| Só ALUNO (usuário da equipe) | **não** | criar, ex.: alunoequipe@genius.com | Confirmar que vai para `/portal` e não opera nada (achado 2). |
| Aluno do portal | **não** (a conta nasce do convite) | e-mail real de uma caixa do QA, no cadastro do aluno | Ativação, login, recuperação, sair e escopo (seção do portal). Precisa de matrícula com reposição para ver conteúdo. |
| Usuário para desativar | sim (qualquer um do seed de QA) | ex.: vendedor3@genius.com | AC06; rodar `npm run seed:qa` de novo reativa o usuário (`seed-qa.ts:86-95`). |

Dados que nenhum seed cria e o QA precisa montar pela interface: leads do João e do vendedor2; ao menos duas turmas (uma da Carla
e outra do professor2) com alunos alocados; uma matrícula com cobrança; um aluno com e-mail para o portal e uma reposição autorizada.

## Cenários de teste para o QA

Marcação: **[PO]** = depende de decisão do PO antes de abrir bug.

| # | Papel | Passos | Resultado esperado |
|---|---|---|---|
| 1 | cada papel puro | Entrar e anotar os itens do menu lateral. | Igual à tabela "Resultado por papel". |
| 2 | ADM | Conferir a ordem do menu. | Começa por "Permutas"; a Home é o 7º item. **[PO]** se a Home deve vir primeiro (achado 5). |
| 3 | GC (gerente@) e SEC | Clicar em "Empresas". | "Acesso negado — ... as empresas (B2B)". Bug de menu (achado 3). |
| 4 | FIN | Clicar em "Empresas". | A lista de empresas abre. |
| 5 | GC | Procurar "Configuração" no menu; depois digitar `/configuracao`. | Não há item no menu; a URL abre Configuração › CRM com 4 seções (sem IA). **[PO]** (achado 4). |
| 6 | GC | Relatórios › aba Equipe › "Definir metas". | Abre Configuração › CRM › Metas. |
| 7 | SEC | Abrir Configuração. | Só a aba "Modelos contratuais". |
| 8 | GP | Abrir Configuração; depois digitar `/configuracao/contratos`. | Abas Catálogo e Turmas; a URL digitada mostra "Não foi possível carregar esta tela" (achado 7). |
| 9 | SEC | Digitar `/configuracao/turmas`. | Vai para "Acesso negado" (URL `/acesso-negado`, com o botão "Voltar ao início"). **[PO]** se a SEC deve manter turmas (achado 13). |
| 10 | VEN | Digitar `/financeiro/permuta`. | Tela "Não foi possível carregar esta tela" com "Tentar de novo", e não "Acesso negado" (achado 6). |
| 11 | VEN | Digitar `/alunos`. | "Acesso negado — Você não tem permissão para acessar os alunos.", na mesma URL. |
| 12 | SEC | Digitar `/financeiro`. | "Acesso negado — o financeiro". |
| 13 | GC | Abrir Financeiro. | Abas Comissões, Descontos e Aprovações; sem Cobranças. |
| 14 | VEN (joao) | Abrir Funil e Carteira; copiar a URL de um lead do vendedor2 e abrir. | Só leads do João; o lead do vendedor2 não carrega (AC01). |
| 15 | GC (gerente@) | Antes de vincular a equipe, abrir o Funil. Como ADM, vincular o joao ao gerente; voltar ao Funil. | Primeiro vazio; depois só os leads do João, e não os do vendedor2 (AC02). |
| 16 | GC | Em Carteira › Coberturas, fazer o joao cobrir o vendedor2 por 1 hora; como joao, abrir a Carteira; revogar a cobertura; recarregar como joao. | Durante a cobertura, o João vê os leads do vendedor2; depois da revogação, não vê mais (AC07). |
| 17 | PRO (carla) | Abrir Alunos; abrir pela URL a ficha de um aluno da turma do professor2. | Só alunos das turmas da Carla; a outra ficha mostra "não encontrado". A ficha própria não tem documento, e-mail, telefone, endereço nem valores (AC04). |
| 18 | GP | Abrir a ficha de um aluno. | Sem e-mail, telefone, documento e endereço; sem bloco financeiro. |
| 19 | PRO | Conferir as abas de Mudanças acadêmicas e do Diário. | 6 abas no Acadêmico e 6 no Diário (lista em "Papéis e menu"). |
| 20 | SEC | Abrir Mudanças acadêmicas e, por um link do Acadêmico, Diário › Encontros. | 10 abas no Acadêmico; Encontros sem barra de abas. |
| 21 | ADM + qualquer | Com o usuário logado em outra janela, remover um papel dele em Usuários; na outra janela, clicar no menu. | O item some no próximo clique, e a página daquele papel nega, sem novo login (achado 9). |
| 22 | ADM + qualquer | Desativar o usuário logado em outra janela; nela, clicar em qualquer item; tentar entrar de novo. | Vai para o login; ao entrar, "E-mail ou senha incorretos." (achado 20, AC06). |
| 23 | ADM | Tentar desativar a si mesmo; tentar marcar uma permissão nova no próprio usuário. | "Você não pode desativar a si mesmo." e "Outro administrador deve conceder aumento das suas permissões ou alçadas." |
| 24 | ADM | Criar um usuário com o e-mail `Teste.QA@genius.com` e senha válida; sair; entrar com o mesmo e-mail. | Hoje: "E-mail ou senha incorretos." Bug (achado 18). |
| 25 | ADM | Editar outro usuário e observar o campo "Nova senha" com o gerenciador de senhas do navegador ativo. | Hoje o navegador pode preencher a senha do ADM. Bug (achado 19). |
| 26 | qualquer da equipe | Errar a senha 5 vezes; na 6ª, usar a senha certa. | "E-mail ou senha incorretos." até passarem 15 min da 1ª falha (achado 14). |
| 27 | qualquer da equipe | Sem sessão, abrir `/alunos/<id>` e entrar. | Vai para `/login`; depois do login, volta à página pedida. |
| 28 | sem sessão | Abrir a raiz do domínio. | Login da equipe, com "É aluno? Acesse a área do aluno" levando a `/portal-aluno/entrar`. |
| 29 | ADM | Criar um usuário só com "Aluno (portal)" e entrar com ele. | Tela "A área do aluno tem acesso próprio", com "Entrar na área do aluno" e "Sair". **[PO]** se a caixa deve sair do formulário (achado 2). |
| 30 | ADM + SEC | Sem os prazos do portal, a SEC prepara um convite. O ADM preenche os 4 prazos em Configuração › Operação, e a SEC repete. | Primeiro, recusa por falta de prazos; depois, o envio aparece em Envios do portal (achado 23). |
| 31 | Aluno | Abrir o link do convite e digitar uma senha de 8 caracteres; depois uma senha válida com confirmação diferente; depois a correta. | Avisos no campo, e o link continua valendo; ao concluir, entra em "Suas reposições". |
| 32 | Aluno | Reabrir o mesmo link de convite. | "Este link não está mais disponível...". |
| 33 | Aluno | Sair; entrar com senha errada 5 vezes; na 6ª, usar a certa. | "E-mail ou senha incorretos." durante 15 min, mesmo depois de um reinício do servidor (achado 26). |
| 34 | Aluno | Pedir recuperação com o e-mail correto e com um e-mail inexistente. | A mesma confirmação nas duas vezes; só o e-mail real recebe o link; ao definir a nova senha, a outra sessão aberta do aluno cai. |
| 35 | Aluno | Na URL de uma reposição, trocar o ID pelo de outro aluno. | "Página não encontrada" (achado 12). |
| 36 | Aluno | Logado no portal, abrir `/home` do ERP. | Login da equipe: a sessão do portal não abre o ERP. |
| 37 | SEC + ADM + ADM2 | A SEC prepara a troca de e-mail do aluno; o aluno valida; o ADM que preparou (se for ADM) tenta decidir; o ADM2 decide. | O mesmo autor é recusado ("Outra pessoa da Administração deve decidir..."); o ADM2 decide, e o aluno passa a entrar com o novo e-mail. |
| 38 | ADM + qualquer | Trocar a senha de um usuário logado em outra janela e continuar usando a outra janela. | Continua logado. **[PO]** se a troca de senha deve derrubar as sessões (achado 17). |

## Apêndice A: guard de cada página do Acadêmico

Papéis além do ADM, que sempre passa. Arquivos em `src/app/(app)/academico/`.

| Página | Guard (linha) |
|---|---|
| `page.tsx` | SEC, GP, PRO (:14) |
| `admissoes`, `admissoes/[id]`, `admissoes/excecoes`, `admissoes/excecoes/[reservaId]` | SEC, GP (:11, :10, :8, :27) |
| `avaliacoes`, `avaliacoes/[alocacaoId]`, `[alocacaoId]/[codigo]`, `[alocacaoId]/extras` | PRO, GP (:11, :35, :27, :11) |
| `avaliacoes/[alocacaoId]/[codigo]/designacao`, `equivalencia`, `fechamento` | GP (:15, :10, :42) |
| `calendario`, `calendario/novo`, `[id]`, `[id]/replanejamento`, `[id]/revisoes`, `[id]/revisoes/[revisaoId]` | SEC, GP |
| `correcoes`, `correcoes/[lancamentoId]/[propostaId]` | GP (:12, :10) |
| `correcoes/[lancamentoId]` | PRO, GP (:13) |
| `correcoes/revisoes/[casoId]` | GP (:24) |
| `equivalencias`, `equivalencias/[propostaId]` | GP, SEC (:17, :64) |
| `grades`, `grades/nova`, `grades/[id]` | SEC, GP |
| `indisponibilidades` | PRO, SEC, GP (:16) |
| `modalidades/quantidade`, `modalidades/[id]/quantidade`, `.../propostas/[propostaId]` | SEC, GP |
| `recuperacoes`, `[realizacaoId]`, `correcoes/[notaId]`, `planos`, `planos/[propostaId]`, `planos/[propostaId]/prorrogacoes` | PRO, GP |
| `recuperacoes/designadas`, `tentativas/[itemReservaId]` | PRO (:13, :13) |
| `recuperacoes/planos/autorizacoes-preparacao`, `planos/[propostaId]/autorizacao-reserva`, `reservas/[reservaId]/cancelamento`, `tentativas/[itemReservaId]/{agenda,autorizacao,designacao,designacao/propostas}` | GP |
| `regras`, `regras/[nivelId]`, `regras/turmas/[turmaId]`, `regras/turmas/[turmaId]/historica` | GP |
| `reposicoes` | SEC, GP (:19) |
| `reposicoes/correcoes/[reposicaoId]` | PRO, GP (:16) |
| `segundas-chamadas/[alocacaoId]/[codigoAvaliacao]` | PRO, GP (:10) |
| `segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/{autorizacoes,historico}`, `propostas/[propostaId]/designacao`, `reservas/[reservaId]/cancelamento` | GP |
| `segundas-chamadas/minhas`, `minhas/[reservaId]` | PRO (:14, :13) |
| `segundas-chamadas/{agendas,pendentes-agenda}`, `propostas/[propostaId]/agenda`, `reservas/[reservaId]/{remarcacao,substituicao}` | SEC, GP |
