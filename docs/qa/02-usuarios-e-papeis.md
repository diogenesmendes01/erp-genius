# Usuários e papéis de teste (UAT)

> Guia para o QA preparar e usar os usuários de teste no UAT v1. Substitui a versão de agosto (commit `bc858aff`),
> que descrevia o CRM antigo e outra matriz de acesso.
>
> Base: código do commit `9e3d1d3c` (branch `qa/auditoria-e-onboarding`), lido em 21/10/2026, e os relatórios
> [`auditoria/01-acesso-papeis.md`](auditoria/01-acesso-papeis.md), [`auditoria/07-financeiro.md`](auditoria/07-financeiro.md)
> e [`auditoria/09-configuracao-ambiente-uat.md`](auditoria/09-configuracao-ambiente-uat.md), mais a
> [`auditoria-consolidada.md`](auditoria-consolidada.md) (B7, X1 a X3, R1, R12 a R14).
>
> Fontes no código: `prisma/schema.prisma` (enum `Papel` e model `Usuario`), `prisma/seed.ts`, `prisma/seed-qa.ts`,
> `src/server/acesso/` (cadastro de usuário), `src/lib/nav.ts`, `src/app/(app)/configuracao/_componentes/tabs.ts`,
> `src/app/(app)/academico/secoes.ts`, `src/app/(app)/diario/secoes.ts`, `src/app/(app)/financeiro/abas.ts`,
> `src/lib/capacidades.ts`.
>
> Este documento descreve o que o código faz. Onde o resultado depende de decisão do PO, aparece a marca **R#** da
> auditoria consolidada: registre o que viu e não abra bug. Onde já há bug conhecido, aparece a marca **X#**.

Papéis (enum `Papel`): ADMINISTRADOR (ADM), GERENTE_COMERCIAL (GC), VENDEDOR (VEN), GERENTE_PEDAGOGICO (GP),
PROFESSOR (PRO), FINANCEIRO (FIN), SECRETARIA_ACADEMICA (SEC) e ALUNO. Um usuário pode acumular papéis; o menu e o
acesso são a união dos papéis. O ADM passa em todo guard de papel. O papel ALUNO num usuário da equipe é legado: o
aluno de verdade entra pelo portal do aluno, com conta própria (ver §2.2).

## 1. Como preparar os usuários em UAT

A ordem importa: cada passo depende do anterior. O checklist completo do ambiente (prazos, catálogo, turmas, regras de
avaliação etc.) está no relatório 09, seção "Dados mínimos do UAT". Aqui fica só a parte de usuários.

1. **[DEV] Seed principal: `npm run seed`.** Cria os 5 usuários de desenvolvimento (ADM, GC+V, VEND-A, FIN+SEC, PROF),
   os contadores, o catálogo e o canal WhatsApp desligado. Esses 5 usuários nascem com uma senha de desenvolvimento
   conhecida, que **não pode** valer em UAT (passo 3). Re-rodar o seed principal não troca senha, mas regrava nome,
   papéis e o campo antigo de desconto desses 5.
2. **[DEV] Seed de QA: `npm run seed:qa`, com a variável de ambiente `QA_SEED_PASSWORD` definida.** Sem a variável
   (ou com menos de 6 caracteres) o script para e não grava nada. Ele:
   - cria ou atualiza, por e-mail, os 12 usuários de QA da tabela do §2 que não vêm do seed principal (GC, GP, GP-2,
     FIN, FIN-2, SEC, VEND-B, VEND-0, PROF-2, ADM-2, VEND+PROF e ALUNO-EQUIPE), com a senha de `QA_SEED_PASSWORD`;
   - grava as alçadas de desconto nos campos que as regras leem (taxa e mensalidade), vincula os vendedores ao GC e
     dá ao FIN-2 a permissão "Aprovar acertos e compensações financeiras";
   - nos usuários do seed principal, **só** grava alçadas e gerente de VEND-A (joao) e GC+V (mariana). Não troca senha,
     nome nem papéis de ninguém do seed principal. Se o seed principal não rodou, o script avisa e segue.

   Re-rodar o seed de QA devolve os 12 usuários ao estado de QA: senha, papéis, alçadas, gerente, permissões e
   "ativo". Serve para reativar um usuário depois do teste de desativação, mas desfaz o que o ADM mudou pela tela
   nesses usuários. O script imprime a lista do que gravou, sem a senha.
3. **ADM, Configuração › Usuários.**
   - Trocar a senha dos 5 usuários do seed principal (inclusive a do próprio ADM). Não existe troca de senha pelo
     próprio usuário.
   - Conferir a coluna de desconto (mostra "taxa% / mensalidade%"; vazio aparece como 0%) e o campo "Gerente
     comercial da equipe" de cada vendedor contra a tabela do §2.
   - Se o seed de QA não puder rodar, criar os usuários pela tela com os mesmos dados do §2. E-mail **sempre em
     minúsculas** (X1, ver §6). O ADM consegue criar outro ADM, mas não aumenta os próprios papéis, permissões ou
     alçadas: quem faz isso para o ADM é o ADM-2.
4. **ADM, Configuração › Operação.** Preencher os 4 prazos do portal do aluno antes de qualquer convite (sem eles
   nada do portal funciona). Os demais campos estão no relatório 09.
5. **SEC ou ADM, ficha do aluno › Acesso ao portal.** Só quando o roteiro chegar ao portal: o aluno precisa estar
   cadastrado com o e-mail de uma caixa que o QA lê (§2.2).

**Senhas.** As senhas de UAT chegam ao QA por canal privado. Não aparecem neste documento, em ticket, print, gravação
de tela nem no chat do time. Não use a senha de desenvolvimento do seed principal.

**Duas sessões ao mesmo tempo.** Para testar quem pede e quem aprova, use uma janela normal e uma anônima (ou dois
navegadores), cada uma com um usuário.

## 2. Usuários de teste

### 2.1 Tabela

"Alçada" = os campos **Desconto máximo na taxa (%)** e **Desconto máximo na mensalidade (%)** do cadastro de usuário
(`limiteDescontoTaxaPct` e `limiteDescontoMensalidadePct` no banco). Vazio = **0% de autonomia**, não "sem limite"
(§5). "Gerente" = o campo **Gerente comercial da equipe** (`gerenteComercialId`). "Permissões extras" = as caixas de
permissão do cadastro (`permissoes`, lista em `src/lib/capacidades.ts`).

| Apelido | E-mail | Nome | Papéis | Alçada taxa / mensalidade | Gerente | Permissões extras | Origem | Para que serve |
|---|---|---|---|---|---|---|---|---|
| ADM | admin@genius.com | Diógenes Mendes | ADM | vazio / vazio | — | nenhuma marcada (o ADM passa em todas) | seed | Configuração completa, usuários, prazos do portal, decisões de direção. |
| ADM-2 | admin2@genius.com | Tomás Rivera | ADM | vazio / vazio | — | nenhuma (passa em todas) | seed:qa | "Outro administrador": decide o que o ADM pediu (desconto pedido por ADM ou GC, bolsa, perdão, troca de e-mail do portal, modelos contratuais) e concede permissões ou alçadas ao ADM. |
| GC | gerente@genius.com | Ricardo Vargas | GC | 20% / 20% | — (é o gerente da equipe) | — | seed:qa | GC isolado: escopo de equipe (VEND-A, VEND-B, VEND-0 e GC+V), aba Aprovações do Financeiro, Coberturas, Configuração › CRM. |
| GC+V | mariana@genius.com | Mariana López | GC + VEN | 15% / 15% | GC | — | seed (alçada e gerente pelo seed:qa) | Acúmulo de papéis e autoaprovação negada. Não serve para testar o GC isolado. |
| VEND-A | joao@genius.com | João Silva | VEN | 10% / 10% | GC | — | seed (alçada e gerente pelo seed:qa) | Carteira própria; desconto dentro e acima da alçada. |
| VEND-B | vendedor2@genius.com | Pedro Castro | VEN | 10% / 10% | GC | — | seed:qa | Leads e alunos de outro vendedor (escopo por linha); cobertura de carteira. |
| VEND-0 | vendedor3@genius.com | Lucía Herrera | VEN | vazio / vazio | GC | — | seed:qa | Vendedor sem autonomia: todo desconto vai para aprovação. Também é o usuário para o teste de desativação. |
| GP | gp@genius.com | Paula Gómez | GP | vazio / vazio | — | — | seed:qa | Acadêmico, Diário, Catálogo, Turmas, Permutas (confirma serviço), ficha de aluno sem contato. |
| GP-2 | gp2@genius.com | Elena Quesada | GP | vazio / vazio | — | — | seed:qa | Segunda pessoa da gestão pedagógica: decide o que o GP prepara (regra de avaliação, calendário, grade, admissão, mudanças acadêmicas). |
| PROF | carla@genius.com | Carla Fernández | PRO | vazio / vazio | — | — | seed | Escopo por turma (só alunos das próprias turmas). Precisa de turma com alunos. |
| PROF-2 | professor2@genius.com | Marcos Jiménez | PRO | vazio / vazio | — | — | seed:qa | Turma de outro professor; troca de professor; experimental atribuída a outro. |
| FIN | financeiro@genius.com | Fernanda Rojas | FIN | vazio / vazio | — | nenhuma | seed:qa | Painel financeiro, conferência de informe, Empresas; prepara acertos, permutas, uso e devolução de crédito. |
| FIN-2 | financeiro2@genius.com | Gabriel Solís | FIN | vazio / vazio | — | **Aprovar acertos e compensações financeiras** (`financeiro.aprovar_acertos`) | seed:qa | Segunda pessoa do Financeiro: decide o que o FIN preparou (permuta, uso e devolução de crédito, acertos de aditivo, acerto de desistência) e confere o informe da SEC. |
| SEC | secretaria@genius.com | Sofía Mora | SEC | vazio / vazio | — | — | seed:qa | Matrículas, contratos, convite e envios do portal, Modelos contratuais, informe de pagamento. |
| FIN+SEC | ana@genius.com | Ana Torres | FIN + SEC | vazio / vazio | — | — | seed | Autoconferência negada (a mesma pessoa informa e tenta conferir). Não serve para isolar papéis. |
| VEND+PROF | venprof@genius.com | Daniel Araya | VEN + PRO | vazio / vazio | — | — | seed:qa | AC03: o escopo de professor não abre o financeiro comercial; menu com a união dos dois papéis. |
| ALUNO-EQUIPE | alunoequipe@genius.com | Bruno Salas | ALUNO (só) | vazio / vazio | — | — | seed:qa | Usuário da equipe só com o papel ALUNO: ao entrar vai para `/portal`, que só explica que o aluno tem acesso próprio. Não opera nada (achado 2 do relatório 01). |
| Aluno do portal | e-mail real de uma caixa do QA | o do cadastro do aluno | — (não é usuário da equipe) | — | — | — | nasce do convite | Ativação, login, recuperação, sair e escopo do portal (§2.2). |

Notas da tabela:

- O ADM está com alçada vazia. Ele decide aprovações sem olhar a própria alçada, mas o desconto que **ele mesmo** pede
  vai para aprovação de outro ADM (§5). Por isso o ADM-2 existe.
- Ninguém além do FIN-2 tem permissão extra. As outras 6 (`pagamento.caixa`, `comissao.configurar`,
  `financeiro.executar_devolucoes` e as 3 de exportação) o ADM concede pela tela quando o cenário pedir; re-rodar o
  seed de QA tira essas permissões dos 12 usuários de QA.
- VEND+PROF não está na equipe de nenhum gerente. Se um cenário precisar disso, o ADM vincula pela tela.
- O relatório 08 chama de "FIN-2" a ana (FIN+SEC). Neste kit, **FIN-2 é financeiro2@genius.com**; ana é FIN+SEC.

### 2.2 Aluno do portal (não é um usuário da equipe)

O portal do aluno (`/portal-aluno/...`) tem identidade própria (`ContaPortalAluno`), separada do cadastro de usuários
da equipe. Nenhum seed cria essa conta: ela nasce do convite.

1. Pré-condições: os 4 prazos do portal preenchidos pelo ADM (Configuração › Operação); envio de e-mail real
   configurado pelo DEV (sem modo simulado, bloqueador B4 e decisão R3); um aluno cadastrado com o e-mail de uma caixa
   que o QA lê.
2. SEC ou ADM abre a ficha do aluno › **Acesso ao portal** e prepara o convite. A equipe nunca vê senha, token nem link;
   a fila aparece em **Envios do portal** (`/secretaria/envios-portal`).
3. O aluno recebe o e-mail, abre o link `/portal-aluno/ativar`, define a senha (12 caracteres ou mais, com
   confirmação) e entra em "Suas reposições".
4. Depois disso entra por `/portal-aluno/entrar` e recupera a senha por `/portal-aluno/recuperar`.

A sessão da equipe não abre o portal, e a sessão do portal não abre o ERP. O ALUNO-EQUIPE **não** é o aluno do portal:
ele só confirma que um usuário da equipe com papel ALUNO não opera nada.

## 3. Matriz papel × área

O que cada papel abre de fato, por prefixo de rota (guard de cada `page.tsx`). Adaptado da "Matriz de acesso por área"
do relatório 01, onde estão os arquivos e linhas.

- **ADM abre tudo** e não aparece nas colunas. **ALUNO-EQUIPE** vai para `/portal` em qualquer rota da equipe.
- Sem sessão, qualquer rota da equipe leva a `/login` e, depois do login, volta à página pedida.
- "sim" = abre. "escopo" = abre, mas mostra só a parte do usuário (carteira, equipe, turma). Vazio = não abre.
- Usuário com dois papéis abre a união das colunas.
- Quando não abre, a negação vem de três formas (todas esperadas, menos a terceira): a URL muda para `/acesso-negado`;
  a URL fica e aparece "Você não tem permissão para acessar ..."; ou, em duas telas, a tela de erro genérica (X3).

| Área / prefixo | GC | VEN | GP | PRO | FIN | SEC | Observação |
|---|---|---|---|---|---|---|---|
| `/home`, `/preferencias` | sim | sim | sim | sim | sim | sim | Home diferente por papel (§4.1). |
| `/funil`, `/carteira`, `/relatorios` | escopo (equipe) | escopo (própria + coberturas) | | | | | GC sem vendedores vinculados vê tudo vazio. |
| `/aria` | sim | | | | | | |
| `/contatos` | sim | sim | | | | sim | |
| `/tarefas` | sim | sim | | | sim | sim | |
| `/comissoes` | escopo (equipe) | escopo (própria) | | | sim | | |
| `/inbox` | sim | sim | sim | sim | sim | sim | Conversas filtradas por atendimento. |
| `/oportunidades/[id]/contratacao` | sim | sim | | | | sim | |
| `/matriculas/nova` (fluxo antigo) | sim | sim | | | | sim | **R1**: destino do fluxo em aberto; a SEC abre mas não consegue salvar. |
| `/secretaria` (Matrículas) | sim | sim | | | | sim | |
| `/secretaria/{avisos-agenda,desistencias,envios-portal,reservas}` | | | | | | sim | |
| `/matriculas/[id]` (hub) | conforme a seção | conforme a seção | conforme a seção | | conforme a seção | conforme a seção | O cabeçalho exige algum papel das seções e aplica o escopo comercial. |
| `/matriculas/[id]/{preparacao,reserva}` | sim | sim | | | | sim | |
| `/matriculas/[id]/{contrato,emissao,nova-reserva}` | | | | | | sim | Alçadas de aditivo também para FIN, GC e GP; agenda de aditivo também para GP. |
| `/matriculas/[id]/{pagador,condicoes,condicoes-horas,continuidade-mensal,entrada-particular}` | | | | | sim | sim | |
| `/matriculas/[id]/{ocorrencias-financeiras,fechamentos-horas,compensacoes}` | | | | | sim | | |
| `/matriculas/[id]/{autorizacoes-comunicacao,desistencia}` | | | | | | sim | `desistencia/financeiro` é do FIN. |
| `/matriculas/[id]/{disponibilidade-oferta,indisponibilidade-oferta}` | | | sim | | sim | sim | |
| `/alunos` (lista), `/alunos/[id]`, `/alunos/turma/[id]` | | | sim (sem contato) | escopo (só as próprias turmas, sem documento, contato, endereço nem valores) | sim | sim | Ficha de aluno de outra turma, para o PRO: "não encontrado". |
| `/alunos/[id]/financeiro` | escopo (resumo comercial da equipe) | escopo (resumo comercial da carteira) | | | sim | sim | |
| `/alunos/[id]/academico` | | | sim | sim | | sim | |
| `/alunos/[id]/movimentacoes` | | | | | sim | sim | O GP não abre. |
| `/alunos/[id]/{agenda-aditivo}` · `/creditos/[id]` · `/portal` | | | agenda-aditivo | | créditos | agenda-aditivo, portal | |
| `/academico` e sub-áreas | | | sim | sim | | sim | Abas por papel no §4.3. |
| `/diario` e sub-áreas | | | sim | sim | | só Encontros | Abas por papel no §4.4. A gravação da aula decide na própria tela. |
| `/financeiro` (painel e abas) | 3 abas | | | | sim | | §4.5. A SEC não abre o painel (vê a ficha financeira do aluno). X4: GC na aba Comissões pode dar erro. |
| `/financeiro/{acertos-*,continuidade,desistencias,migracao,recebimentos}` | | | | | sim | | |
| `/financeiro/permuta` | | | sim | | sim | | Os outros papéis veem a tela de erro genérica, não "Acesso negado" (X3). |
| `/empresas` | menu mostra, página nega | | | | sim | menu mostra, página nega | X2: bug de menu. |
| `/configuracao` (índice) | leva a CRM | | sim | | | sim | **R13**: o GC não tem o item no menu, mas abre por URL e pelo link "Definir metas" (Relatórios › Equipe). |
| `/configuracao/{paises,usuarios,operacao,migracao}` | | | | | | | Só ADM. |
| `/configuracao/migracao/presenca/[linhaId]` | | | sim | | | sim | |
| `/configuracao/{catalogo,turmas}` | | | sim | | | | **R14**: a SEC não gerencia turmas (o doc 37 diz GP/SEC). |
| `/configuracao/contratos` | erro genérico | | erro genérico | | | sim | X3: GP e GC que digitam a URL veem a tela de erro. |
| `/configuracao/crm` | sim (sem a seção IA) | | | | | | Seção IA só ADM. |
| `/configuracao/whatsapp` | volta para a Home | | | | | | Só ADM vê as seções. |
| `/portal` (legado) | — | — | — | — | — | — | Público; destino do ALUNO-EQUIPE. |
| `/portal-aluno/**` | — | — | — | — | — | — | Só a conta do portal do aluno (§2.2). |

## 4. Menu lateral e sub-abas por papel

### 4.1 Menu lateral (`src/lib/nav.ts`)

O menu aparece na ordem do código, e **a Home não é o primeiro item** (para ADM, FIN e GP o primeiro é "Permutas").
Os papéis do menu são relidos do banco a cada página: ao tirar um papel de alguém logado, o item some no próximo
clique, sem novo login. O rodapé tem nome, "Fuso" (Preferências), tema e "Sair".

| Usuário (papéis) | Itens, na ordem da tela |
|---|---|
| ADM, ADM-2 | os 18: Permutas, Mudanças acadêmicas, Comissões, Matrículas, Envios do portal, Diário de aulas, Home, Funil, Relatórios, Agente de IA, Carteira, Contatos, Tarefas, Inbox, Alunos, Financeiro, Empresas, Configuração |
| GC | Comissões, Matrículas, Home, Funil, Relatórios, Agente de IA, Carteira, Contatos, Tarefas, Inbox, Financeiro, Empresas (12; sem Configuração, R13; Empresas nega, X2) |
| GC+V (GC + VEN) | igual ao GC (12): os itens do VEN já estão no menu do GC |
| VEND-A, VEND-B, VEND-0 | Comissões, Matrículas, Home, Funil, Relatórios, Carteira, Contatos, Tarefas, Inbox (9) |
| GP, GP-2 | Permutas, Mudanças acadêmicas, Diário de aulas, Home, Inbox, Alunos, Configuração (7) |
| PROF, PROF-2 | Mudanças acadêmicas, Diário de aulas, Home, Inbox, Alunos (5) |
| FIN, FIN-2 | Permutas, Comissões, Home, Tarefas, Inbox, Alunos, Financeiro, Empresas (8) |
| SEC | Mudanças acadêmicas, Matrículas, Envios do portal, Home, Contatos, Tarefas, Inbox, Alunos, Empresas, Configuração (10; Empresas nega, X2) |
| FIN+SEC | Permutas, Mudanças acadêmicas, Comissões, Matrículas, Envios do portal, Home, Contatos, Tarefas, Inbox, Alunos, Financeiro, Empresas, Configuração (13) |
| VEND+PROF | Mudanças acadêmicas, Comissões, Matrículas, Diário de aulas, Home, Funil, Relatórios, Carteira, Contatos, Tarefas, Inbox, Alunos (12) |
| ALUNO-EQUIPE | nenhum: é levado para `/portal` antes de ver o menu |

**Home por papel:** ADM e GC veem a Home de gestão; PROF vê turmas e experimentais; os demais (VEN, GP, FIN, SEC)
veem "Olá, nome" com atalhos iguais aos do menu. A Home do GC fica vazia se ele não tiver vendedores vinculados.

### 4.2 Configuração (`src/app/(app)/configuracao/_componentes/tabs.ts`)

O layout de Configuração aceita ADM, GC, GP e SEC. Abrir `/configuracao` leva à primeira aba do papel.

| Aba | ADM | GC | GP | SEC |
|---|---|---|---|---|
| Países | sim | | | |
| Modelos contratuais | sim | | | sim |
| Catálogo | sim | | sim | |
| Turmas | sim | | sim | (R14) |
| Usuários | sim | | | |
| Operação (inclui os prazos do portal) | sim | | | |
| Preparação de migração | sim | | | |
| CRM (Distribuição e SLA, Tags e campos, Respostas rápidas, Metas; IA só ADM) | sim | sim (R13) | | |
| WhatsApp | sim | | | |

Resumo: ADM vê as 9; GC vê só CRM; GP vê Catálogo e Turmas; SEC vê só Modelos contratuais (com uma aba só, ela cai
direto nela). FIN+SEC vê o mesmo que a SEC.

### 4.3 Acadêmico (`src/app/(app)/academico/secoes.ts`)

A barra de abas some quando o papel tem uma aba só. ADM vê as 16.

| Papel | Abas |
|---|---|
| GP | Mudanças acadêmicas, Avaliações, Recuperações, Segundas chamadas pendentes, Agendas de segunda chamada, Regras de avaliação, Correções, Aproveitamentos, Reposições, Indisponibilidades docentes, Grades, Quantidade de aulas, Calendário, Admissões (14) |
| PRO | Mudanças acadêmicas, Avaliações, Recuperações, Minhas recuperações, Minhas segundas chamadas, Indisponibilidades docentes (6) |
| SEC | Mudanças acadêmicas, Segundas chamadas pendentes, Agendas de segunda chamada, Aproveitamentos, Reposições, Indisponibilidades docentes, Grades, Quantidade de aulas, Calendário, Admissões (10) |

Algumas sub-telas abrem para papéis que a aba do ramo não tem (ex.: uma correção específica abre para o PRO); nesse
caso a barra aparece sem aba marcada. É intencional.

### 4.4 Diário (`src/app/(app)/diario/secoes.ts`)

ADM vê as 7.

| Papel | Abas |
|---|---|
| GP | Aulas, Encontros, Pendências, Regularizações de aula, Exceções de gravação, Regularizações de gravação (6) |
| PRO | Aulas, Encontros, Pendências, Regularizações de aula, Reposições, Exceções de gravação (6) |
| SEC | só Encontros, sem barra. Não há item de menu: chega pelo Acadêmico |

### 4.5 Financeiro (`src/app/(app)/financeiro/abas.ts` e `contexto.ts`)

Abrem o painel: ADM, FIN e GC. Aba pedida na URL sem permissão cai na aba padrão, sem erro.

| Papel | Abas |
|---|---|
| ADM | Cobranças, A conferir, Retomadas, Comissões, Descontos, Visão geral, Política de comissão, Aprovações, Câmbio |
| FIN, FIN-2, FIN+SEC | Cobranças, A conferir, Retomadas, Comissões, Descontos, Visão geral, Câmbio (Política de comissão só com a permissão "Configurar política de comissão") |
| GC, GC+V | Comissões, Descontos, Aprovações (lê e aprova; não opera cobrança). Política de comissão só com a permissão "Configurar política de comissão" |

## 5. Alçadas de desconto e aprovações

### 5.1 Os campos

| Campo no banco | Na tela de usuário | Quem lê |
|---|---|---|
| `limiteDescontoTaxaPct` | Desconto máximo na taxa (%) | As regras de desconto em cobrança de taxa de matrícula, na ficha financeira e na preparação comercial |
| `limiteDescontoMensalidadePct` | Desconto máximo na mensalidade (%) | O mesmo, para mensalidade |
| `limiteDescontoPct` (antigo) | não aparece | **Nenhuma regra.** Ficou no banco por compatibilidade. Até esta versão os seeds só preenchiam este campo, e por isso todo vendedor ficava com 0% de autonomia (B7). |
| `alcadaAlteradaEm` | não aparece | Data da última mudança de alçada. Um pedido aberto **antes** da mudança só pode ser aprovado pelo ADM ("Alçada alterada após o pedido. Encaminhe à direção."). |

Como a regra funciona (`src/server/financeiro/politica.ts` e `regras.ts`):

- O desconto é **acumulado** sobre o valor original da cobrança: 5% e depois mais 7% na mesma cobrança contam 12%.
- Taxa e mensalidade são conferidas separadamente, cada uma com o seu limite.
- Campo vazio = **0%** para qualquer papel, inclusive ADM e FIN. A versão anterior deste kit dizia que ADM e FIN não
  têm limite: isso valia para uma regra antiga que o código não usa mais.
- Cobrança que não é taxa nem mensalidade não tem limite próprio: qualquer desconto nela vai para aprovação.
- Aumentar o valor ou adiar o vencimento não passa por alçada (**R12**).
- A alçada não tem vigência (data de início e fim), só a data da última alteração.
- O ADM não aumenta a própria alçada, os próprios papéis nem as próprias permissões: recebe "Outro administrador deve
  conceder aumento das suas permissões ou alçadas.". Quem faz é o ADM-2.

### 5.2 Quem pede e quem aprova o desconto

| Situação | Resultado |
|---|---|
| VEN pede desconto dentro da própria alçada | Aplica direto: "Preço ajustado dentro da alçada." |
| VEN pede acima da própria alçada | Vira pedido na aba Aprovações. Aprova o GC **da equipe do vendedor**, se o desconto couber na alçada do GC, ou o ADM. |
| Pedido acima da alçada do GC (ex.: VEND-A pede 30%, GC tem 20%) | O GC recebe "Desconto acima da sua alçada. Encaminhe à direção."; o ADM aprova. |
| GC ou ADM pede desconto acima da própria alçada (inclui GC+V e o ADM, que está com alçada vazia) | Só outro ADM aprova (ADM-2). |
| FIN pede desconto acima da própria alçada (vazia no seed) | Vira pedido; aprova o GC da equipe do vendedor dono do lead, ou o ADM. |
| Bolsa | Sempre vai para aprovação, só ADM aprova (outra pessoa). |
| Perdão de dívida | Só o ADM pede; outro ADM aprova. |
| Qualquer pedido, aprovado por quem pediu | "A conferência exige outra pessoa, mesmo quando você acumula papéis." |
| Pedido aberto antes de a alçada do GC mudar | Só o ADM aprova. |

Na aba Aprovações o GC não vê o próprio pedido, os pedidos fora da equipe dele nem os que exigem direção. A exceção de
preço na **preparação comercial** da matrícula segue a mesma lógica: GC (com o lead na equipe e alçada suficiente) ou
ADM decidem, sempre outra pessoa.

Valores gravados pelo seed de QA: VEND-A 10/10, VEND-B 10/10, VEND-0 vazio, GC 20/20, GC+V 15/15. Todos os outros
ficam vazios.

### 5.3 Permissões extras e a aprovação de acertos

As 7 permissões extras ficam no cadastro do usuário (campo `permissoes`); o ADM concede e retira em Configuração ›
Usuários, e elas são relidas a cada uso. O ADM passa em todas sem precisar marcar.

| Permissão (rótulo na tela) | Valor | Para que serve no teste |
|---|---|---|
| Aprovar acertos e compensações financeiras | `financeiro.aprovar_acertos` | FIN com ela (FIN-2) decide o que outro FIN preparou: compensação de permuta, uso de crédito, aprovação de devolução de crédito, acertos de aditivo (adiantamento, vencimento, taxa, cobertura; quem decide também aplica) e acerto de desistência. Sempre outra pessoa. |
| Executar devoluções financeiras aprovadas | `financeiro.executar_devolucoes` | Executar a devolução de crédito já aprovada. Ninguém do seed tem: o ADM concede se o cenário pedir. |
| Registrar recebimento no caixa | `pagamento.caixa` | Recebimento direto no caixa por quem não é FIN. |
| Configurar política de comissão | `comissao.configurar` | Mostra a aba Política de comissão para FIN e GC. |
| Exportar alunos / leads / contatos | `dados.exportar_*` | Exportações. |

## 6. Armadilhas

1. **E-mail com letra maiúscula não loga (X1).** O login converte o e-mail digitado para minúsculas e busca igual; o
   cadastro grava como foi digitado. Um usuário criado como `Teste.QA@genius.com` nunca entra ("E-mail ou senha
   incorretos."). Crie todo usuário em minúsculas. Também dá para criar dois usuários que diferem só em maiúsculas:
   é o mesmo bug.
2. **Usar o ADM como segundo decisor esconde erros de papel.** O ADM passa em todo guard e em toda permissão. Para
   testar quem aprova, use o papel certo: GC para desconto da equipe, GP-2 para decisões pedagógicas, FIN-2 para
   acertos e compensações, ADM-2 para o que exige outro administrador. Use o ADM só quando o cenário pedir direção.
3. **Alçada vazia não é "sem limite".** É 0%. Na lista de usuários, vazio aparece como "0% / 0%". Se todo desconto
   estiver indo para aprovação, confira os dois campos antes de abrir bug.
4. **GC sem equipe vê tudo vazio.** Funil, Carteira, Relatórios, Comissões e Aprovações dependem dos vendedores
   vinculados a ele. O seed de QA vincula VEND-A, VEND-B, VEND-0 e GC+V. Se o ADM mudar o vínculo pela tela, o escopo
   muda na hora.
5. **GC+V e FIN+SEC não isolam papel.** Mariana vê a união GC + VEN e todo desconto que ela pede vai para a direção;
   Ana vê a união FIN + SEC. Para testar um papel sozinho, use GC, FIN ou SEC.
6. **"FIN-2" tem dois sentidos nos relatórios.** No relatório 08, FIN-2 é a ana; neste kit e no relatório 07, é o
   financeiro2@genius.com.
7. **Re-rodar o seed de QA desfaz ajustes.** Nos 12 usuários de QA ele volta senha, papéis, alçadas, gerente,
   permissões e "ativo". Em VEND-A e GC+V volta alçadas e gerente. Se as alçadas mudarem, pedidos e preparações abertos
   antes disso passam a exigir o ADM (`alcadaAlteradaEm`). Combine com o time antes de re-rodar no meio de um ciclo.
8. **ALUNO-EQUIPE não é o aluno do portal.** Ele só confirma que o papel ALUNO num usuário da equipe não dá acesso a
   nada. O aluno real entra por `/portal-aluno/entrar`, com a conta criada pelo convite (§2.2).
9. **Bloqueio de login.** 5 senhas erradas em 15 minutos bloqueiam aquele e-mail (não o IP), inclusive para a senha
   certa, com a mesma mensagem de senha errada. O bloqueio fica em memória e zera quando o servidor reinicia. No
   portal do aluno o bloqueio é gravado no banco e sobrevive ao reinício.
10. **Senha.** Não existe "esqueci minha senha" nem troca pelo próprio usuário da equipe: só o ADM redefine. Trocar a
    senha não encerra as sessões abertas (X12). Ao editar outro usuário, o navegador pode preencher a senha do próprio
    ADM no campo "Nova senha" (X11): confira se o campo está vazio antes de salvar.
11. **Usuário desativado** é levado ao login no próximo clique e vê "E-mail ou senha incorretos." (não há aviso de
    acesso desativado). O ADM não desativa a si mesmo.
12. **Menu não é permissão.** O item "Empresas" aparece para GC e SEC e a página nega (X2). `/financeiro/permuta` e
    `/configuracao/contratos` negam com a tela de erro genérica (X3). Antes de abrir bug de acesso, compare com a
    matriz do §3.
13. **Sessão longa.** A sessão da equipe não expira em horas (padrão de 30 dias da biblioteca). Não é bug sem decisão
    do PO.
