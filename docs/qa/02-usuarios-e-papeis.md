# Usuários e papéis de teste (UAT)

> Guia para o QA preparar e usar os usuários de teste no UAT v1.
> Base: código do commit `bc858aff` (`main`) e a auditoria em
> [`auditoria/01-papeis-permissoes.md`](auditoria/01-papeis-permissoes.md) e
> [`auditoria-consolidada.md`](auditoria-consolidada.md) (bloqueador **B3**).
> Fontes no código: `prisma/seed.ts`, `prisma/seed-qa.ts`, `src/lib/nav.ts`,
> `src/app/(app)/configuracao/_componentes/tabs.ts`, `src/lib/roles.ts`. Papéis: enum `Papel` em
> `prisma/schema.prisma` e [`docs/07-papeis-permissoes.md`](../07-papeis-permissoes.md).

## 1. Como preparar os usuários em UAT

1. Rodar o seed principal no banco de UAT: `npm run seed`. Ele cria os 5 usuários de dev
   (tabela 2.1), o catálogo, os contadores e o canal WhatsApp desligado.
2. Rodar o seed de QA: `npm run seed:qa`, com a variável de ambiente `QA_SEED_PASSWORD`
   definida. Ele cria ou atualiza (upsert por e-mail) os 7 usuários de papel único da tabela 2.2.
   Sem a variável, o script aborta sem gravar nada. Re-rodar o script redefine a senha e
   reativa esses 7 usuários (útil depois de um teste de desativação).
3. Como `admin@genius.com`, em **Configuração › Usuários**, redefinir a senha dos 5 usuários
   do seed principal. O seed principal usa uma senha de desenvolvimento conhecida, que **não
   pode** valer em UAT. Re-rodar `npm run seed` não altera senhas já existentes.

**Senhas.** As senhas de UAT são passadas pelo gestor ao QA por canal privado. Elas não
aparecem neste documento, em tickets, em prints ou no chat do time, e não podem ser a senha de
dev do seed (`SETUP.md`). Não existe troca de senha pelo próprio usuário: quem esquecer a senha
pede ao Admin (relatório 01 #37).

**Login.** 5 senhas erradas em 15 minutos bloqueiam o e-mail, inclusive para a senha certa.
O bloqueio fica em memória e zera quando o servidor reinicia (relatório 01 #35).

## 2. Usuários de teste

Regra de `limiteDescontoPct` no código (relatório 01 #16): Administrador e Financeiro não têm
limite, seja qual for o valor do campo. Para os demais papéis, campo vazio significa **0% de
autonomia** (todo desconto vai para aprovação), e não "sem limite".

### 2.1 Do seed principal (`prisma/seed.ts`), e-mails mantidos

| e-mail | nome | papéis | limiteDescontoPct | para que serve no teste |
|---|---|---|---|---|
| admin@genius.com | Diógenes Mendes | ADMINISTRADOR | vazio (sem limite) | Passa em todo guard. Cria e edita usuários, catálogo, preços, países, WhatsApp. Perdoa dívida. Importa XLSX. Único papel que cria **e** ativa matrícula numa ação só. |
| mariana@genius.com | Mariana López | GERENTE_COMERCIAL + VENDEDOR | 15 | Multi-papel (permissões = união). Teste de auto-aprovação do próprio desconto (R3). Mascara bugs de GC puro, então não serve para testar o Gerente Comercial isolado. |
| joao@genius.com | João Silva | VENDEDOR | 10 | Vendedor A do teste de escopo por linha. Desconto até 10% aplica direto, acima vai para aprovação. |
| ana@genius.com | Ana Torres | FINANCEIRO + SECRETARIA_ACADEMICA | vazio | Multi-papel do back-office. Vê a Home genérica. Não serve para isolar Financeiro ou Secretaria. |
| carla@genius.com | Carla Fernández | PROFESSOR | vazio | Escopo por turma: só vê alunos das turmas em que é professora. Check-in/no-show de experimental atribuída a ela. Não vê nada de financeiro. |

### 2.2 Do seed de QA (`prisma/seed-qa.ts`), usuários de papel único

| e-mail | nome | papéis | limiteDescontoPct | para que serve no teste |
|---|---|---|---|---|
| gp@genius.com | Paula Gómez | GERENTE_PEDAGOGICO | vazio | Único Gerente Pedagógico do ambiente. Cria e edita turmas, movimenta alunos. Não entra em Financeiro. Conferir se vê valores em aberto na ficha do aluno (relatório 01 #8). |
| gerente@genius.com | Ricardo Vargas | GERENTE_COMERCIAL | 20 | GC puro: aprova ou rejeita pedidos de desconto, reatribui dono do lead, bloqueia acesso por inadimplência, vê Financeiro em leitura e Configuração › WhatsApp comercial. Hoje **não** consegue renegociar nem dar desconto (R4). O limite de 20% (exemplo do doc 07) só passa a valer se R4 for corrigido. |
| financeiro@genius.com | Fernanda Rojas | FINANCEIRO | vazio (sem limite no código) | Financeiro puro: ativa matrícula, registra pagamento, promessa, envio de cobrança, ajuste sem limite, câmbio, fechamento de comissões. Não movimenta aluno, não perdoa dívida. |
| secretaria@genius.com | Sofía Mora | SECRETARIA_ACADEMICA | vazio | Secretaria pura: edita aluno, troca turma, pausa, reativa, encerra; registra pagamento pela ficha do aluno. Não entra em `/financeiro` (R7), não cria aluno fora da matrícula, não renegocia. |
| vendedor2@genius.com | Pedro Castro | VENDEDOR | 10 | Vendedor B do teste de escopo: não pode ver nem operar lead, matrícula ou ficha financeira de aluno do João (e vice-versa). |
| vendedor3@genius.com | Lucía Herrera | VENDEDOR | vazio | "VEND-0" do roteiro: limite vazio = 0% de autonomia, todo desconto vai para aprovação (FIN-11). Home sem lead pendente (HOM-07). |
| professor2@genius.com | Marcos Jiménez | PROFESSOR | vazio | "PROF-2" do roteiro: segundo professor para escopo por turma (ALU-15), troca de professor da turma (CFG-16) e experimental atribuída a outro (CRM-23). |

### 2.3 Dados que os usuários precisam ter antes dos testes

- **Carla** precisa ser professora de pelo menos uma turma com alunos, e deve haver outra turma
  de outro professor, para o teste de 404 fora do escopo. Turmas nascem `PLANEJADA` e a
  matrícula exige `ABERTA` (bloqueador B1).
- **João** e **vendedor2** precisam ter cada um ao menos um lead próprio e, de preferência, um
  aluno matriculado a partir desse lead.
- Para testar aprovação, deixar ao menos um pedido de desconto pendente criado por um Vendedor
  acima do limite.

## 3. Matriz papel × ação (o que o código permite hoje)

Adaptada da matriz do relatório 01. Legenda: ✅ permitido · ❌ negado · (esc.) = sujeito a
escopo por linha · `*` = o doc diz diferente (a nota de rodapé aponta o item do consolidado).
ADM = Administrador · GC = Gerente Comercial · VEND = Vendedor · GP = Gerente Pedagógico ·
PROF = Professor · FIN = Financeiro · SEC = Secretaria Acadêmica.

As colunas mostram o papel **puro**. Um usuário com vários papéis tem a união das permissões.

| Ação | ADM | GC | VEND | GP | PROF | FIN | SEC |
|---|---|---|---|---|---|---|---|
| Criar / editar lead | ✅ | ✅ | ✅ (esc.) | ❌ | ❌ | ❌ | ❌ |
| Mover etapa / registrar interação / nota | ✅ | ✅ | ✅ (esc.) | ❌ | ❌ | ❌ | ❌ |
| Agendar experimental / atribuir professor | ✅ | ✅ | ✅ (esc.) | ❌ | ❌ | ❌ | ❌ |
| Check-in / no-show da experimental | ✅ | ❌ | ❌ | ❌ | ✅ (só se atribuído) | ❌ | ❌ |
| Reatribuir dono do lead (sem tela; só server action) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Solicitar abertura de turma | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Criar matrícula (AGUARDANDO) | ✅ | ✅ | ✅ (esc. do lead) | ❌ | ❌ | ❌ | ❌ |
| Matrícula sem preço de referência (com justificativa) | ✅ | ✅ | ❌ `*`[^R14] | ❌ | ❌ | ❌ | ❌ |
| Ativar matrícula / receber taxa `*`[^B2] | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Criar **e** ativar numa ação só | ✅ | ❌ (só com +FIN/SEC) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Desconto / bolsa / renegociação em cobrança | ✅ sem limite | ❌ `*`[^R4] | ✅ até `limiteDescontoPct`; acima vai para aprovação `*`[^D10] `*`[^R2] | ❌ | ❌ | ✅ sem limite | ❌ |
| Aumentar valor / mudar vencimento sem aprovação | ✅ | ❌ | ✅ `*`[^R2] | ❌ | ❌ | ✅ | ❌ |
| Perdoar dívida | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Aprovar / rejeitar pedido de desconto | ✅ | ✅ (inclusive o próprio `*`[^R3]) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Registrar pagamento | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Promessa de pagamento | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Enviar cobrança por WhatsApp | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Bloquear / desbloquear acesso do aluno | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Fechar mês de comissões | ✅ | ❌ `*`[^D10] | ❌ | ❌ | ❌ | ✅ | ❌ |
| Cadastrar câmbio | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Editar aluno / trocar turma / pausar / reativar / encerrar | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Criar aluno fora da matrícula | ❌ (só import XLSX) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ `*`[^D10] |
| Importar alunos / turmas (XLSX) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Criar / editar turma, mudar status | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Criar / editar / ativar-desativar usuário | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Editar catálogo, preços, países | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Config WhatsApp: números/QR, templates, política, kill-switch | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Config comercial: auto-lead, saudação, régua comercial | ✅ | ✅ `*`[^D10] | ❌ | ❌ | ❌ | ❌ | ❌ |
| Inbox: ver conversas | ✅ todos | ✅ nº de vendas | ✅ nº próprios | ❌ | ❌ | ✅ nº de cobrança | ✅ nº de cobrança |
| Inbox: marcar conversa tratada | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Ver** Pipeline / Leads | ✅ todos | ✅ todos | ✅ próprios | abre vazio `*`[^R5] | abre vazio `*`[^R5] | abre vazio `*`[^R5] | abre vazio `*`[^R5] |
| **Ver** lista / ficha de alunos | ✅ | ❌ | ❌ | ✅ (vê valores em aberto `*`[^GP]) | ✅ suas turmas | ✅ | ✅ |
| **Ver** ficha financeira do aluno | ✅ | ✅ | ✅ seus alunos | ❌ | ❌ | ✅ | ✅ |
| **Ver** painel Financeiro | ✅ | ✅ leitura + Aprovações | ❌ | ❌ | ❌ | ✅ | ❌ `*`[^R7] |
| **Ver** Configuração › Países / Catálogo | ✅ | por URL `*`[^R5] | por URL `*`[^R5] | por URL `*`[^R5] | por URL `*`[^R5] | por URL `*`[^R5] | por URL `*`[^R5] |
| **Ver** Configuração › Turmas | ✅ | por URL `*`[^R5] | por URL `*`[^R5] | ✅ | por URL `*`[^R5] | por URL `*`[^R5] | por URL `*`[^R5] |
| **Ver** Configuração › Usuários | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Ver** Configuração › WhatsApp | ✅ tudo | ✅ só painéis comerciais | ❌ | ❌ | ❌ | ❌ | ❌ |

[^R2]: Consolidado §3 **R2**: o Vendedor aumenta valor e adia vencimento sem aprovação (só desconto acima do limite vai para aprovação). Além disso, a server action de ajuste não confere o dono do aluno, então aceita cobrança fora do escopo (relatório 01 #14 e #15).
[^R3]: Consolidado §3 **R3**: o Gerente Comercial pode aprovar o próprio pedido de desconto (relatório 01 #19). Testar com `mariana@genius.com`.
[^R4]: Consolidado §3 **R4**: o Gerente Comercial puro não concede desconto nem renegocia, só aprova. O doc 07 dá o exemplo "Gerente Comercial 20%" (relatório 01 #17).
[^R5]: Consolidado §3 **R5**: leituras sem guard de papel. Qualquer usuário autenticado abre `/configuracao/{paises,catalogo,turmas}`, `/pipeline`, `/leads` e `/matriculas/nova` digitando a URL e lê inclusive preços de referência. As mutações continuam protegidas (relatório 01 #28 e #29). **Decisão pendente** (ver seção 5).
[^R7]: Consolidado §3 **R7**: a Secretaria não entra em `/financeiro`; o doc 09 diz que ela vê e registra pagamento. Hoje ela registra só pela ficha do aluno.
[^R14]: Consolidado §3 **R14**: matrícula sem preço de referência exige justificativa **e** papel GC/Admin; o doc 10 §3.1 pede só a justificativa (relatório 01 #40).
[^B2]: Consolidado §2 **B2**: matrícula salva como AGUARDANDO não tem botão para ser ativada depois. Na prática só existe o botão "Receber pagamento e ativar" na criação, visível para quem tem os dois conjuntos de papéis (Admin). Ver também **R1** (ativa só com a taxa quitada).
[^D10]: Consolidado §6, linha "10 §2": a tabela de papéis do doc 10 está desatualizada e o código segue o doc 09. Vendedor dá desconto até o limite (relatório 01 #13), Secretaria não cria aluno (#21), GC não aprova comissão (#24), GC configura o WhatsApp comercial (#25). O QA testa pelo comportamento desta matriz.
[^GP]: Relatório 01 #8 (não está no §3 do consolidado): o doc 09 diz que o Gerente Pedagógico vê só a flag em dia/atrasado, mas a ficha do aluno entrega valores em aberto e próximo vencimento. Decidir com o PO.

## 4. Menu lateral esperado por papel

Fonte: `src/lib/nav.ts`. O menu é a união dos itens de todos os papéis do usuário, sempre nesta
ordem: Home · Pipeline · Leads · Inbox · Alunos · Financeiro · Configuração. Os papéis são relidos
do banco a cada request: remover um papel tira o item do menu no próximo clique, sem relogar.

| Item | Papéis que veem |
|---|---|
| Home | todos |
| Pipeline | ADM, GC, VEND |
| Leads | ADM, GC, VEND |
| Inbox | ADM, GC, VEND, FIN, SEC |
| Alunos | ADM, SEC, GP, FIN, PROF |
| Financeiro | ADM, FIN, GC |
| Configuração | ADM, GP, GC |

Por usuário de teste:

| Usuário | Menu esperado | Sub-abas de Configuração | Home exibida |
|---|---|---|---|
| admin@genius.com | Home · Pipeline · Leads · Inbox · Alunos · Financeiro · Configuração | Países · Catálogo · Turmas · Usuários · WhatsApp | conferir e registrar |
| mariana@genius.com | Home · Pipeline · Leads · Inbox · Financeiro · Configuração | WhatsApp | Gerente (nunca a do Vendedor) |
| gerente@genius.com | Home · Pipeline · Leads · Inbox · Financeiro · Configuração | WhatsApp | Gerente |
| joao@genius.com | Home · Pipeline · Leads · Inbox | (sem o item) | Vendedor |
| vendedor2@genius.com | Home · Pipeline · Leads · Inbox | (sem o item) | Vendedor |
| gp@genius.com | Home · Alunos · Configuração | Turmas | genérica |
| carla@genius.com | Home · Alunos | (sem o item) | Professor |
| financeiro@genius.com | Home · Inbox · Alunos · Financeiro | (sem o item) | genérica |
| ana@genius.com | Home · Inbox · Alunos · Financeiro | (sem o item) | genérica |
| secretaria@genius.com | Home · Inbox · Alunos | (sem o item) | genérica |

Notas:

- `mariana` e `gerente` têm o **mesmo menu**. A diferença aparece nas ações: só `mariana`
  (por ser também Vendedora) vê "Renegociar" na ficha financeira.
- Clicar em **Configuração** leva à primeira sub-aba permitida: Admin cai em Países, GC em
  WhatsApp, GP em Turmas.
- A Home segue a prioridade Gerente > Vendedor > Professor > genérica (relatório 01 #38).
- As sub-abas de Configuração leem os papéis do token de login, não do banco: depois de mudar o
  papel de alguém, elas só se atualizam no próximo login (relatório 01 #4).

## 5. URLs que cada papel deve e não deve abrir

Para cada URL, digitar o endereço direto no navegador (não só clicar no menu). Resultados possíveis:

- **abre**: a página carrega com dados.
- **negado (redireciona)**: vai para `/acesso-negado`.
- **negado (na tela)**: a URL fica a mesma e a página mostra "Acesso negado".
- **404**: registro fora do escopo do usuário.
- **abre `*`R5**: abre hoje por falta de guard de leitura. **Decisão pendente** do PO.

| URL | ADM | GC | VEND | GP | PROF | FIN | SEC |
|---|---|---|---|---|---|---|---|
| `/home` | abre | abre | abre | abre | abre | abre | abre |
| `/pipeline` | abre (todos) | abre (todos) | abre (próprios) | abre vazio `*`R5 | abre vazio `*`R5 | abre vazio `*`R5 | abre vazio `*`R5 |
| `/leads` | abre (todos) | abre (todos) | abre (próprios) | abre vazio `*`R5 | abre vazio `*`R5 | abre vazio `*`R5 | abre vazio `*`R5 |
| `/leads/<id>` | abre | abre | abre se for dono; outro → 404 | 404 | 404 | 404 | 404 |
| `/matriculas/nova` | abre | abre | abre (`?lead=` de outro vendedor vem vazio) | abre sem botões, vê preços `*`R5 | abre sem botões, vê preços `*`R5 | abre sem botões, vê preços `*`R5 | abre sem botões, vê preços `*`R5 |
| `/inbox` | abre (todos os números) | abre (nº de vendas) | abre (nº próprios) | negado (redireciona) | negado (redireciona) | abre (nº de cobrança) | abre (nº de cobrança) |
| `/alunos` | abre | negado (na tela) | negado (na tela) | abre | abre (suas turmas) | abre | abre |
| `/alunos/<id>` | abre | negado (redireciona) | negado (redireciona) | abre | abre se da sua turma; outro → 404 | abre | abre |
| `/alunos/turma/<id>` | abre | negado (redireciona) | negado (redireciona) | abre | abre se a turma for sua; outra → 404 | abre | abre |
| `/alunos/<id>/financeiro` | abre | abre | abre se o aluno for seu; outro → 404 | negado (redireciona) | negado (redireciona) | abre | abre |
| `/financeiro` | abre | abre (leitura + Aprovações) | negado (na tela) | negado (na tela) | negado (na tela) | abre | negado (na tela) `*`R7 |
| `/configuracao` | → Países | → WhatsApp | → `/home` | → Turmas | → `/home` | → `/home` | → `/home` |
| `/configuracao/paises` | abre | abre `*`R5 | abre `*`R5 | abre `*`R5 | abre `*`R5 | abre `*`R5 | abre `*`R5 |
| `/configuracao/catalogo` | abre | abre `*`R5 | abre `*`R5 | abre `*`R5 | abre `*`R5 | abre `*`R5 | abre `*`R5 |
| `/configuracao/turmas` | abre | abre `*`R5 | abre `*`R5 | abre | abre `*`R5 | abre `*`R5 | abre `*`R5 |
| `/configuracao/usuarios` | abre | negado (na tela) | negado (na tela) | negado (na tela) | negado (na tela) | negado (na tela) | negado (na tela) |
| `/configuracao/whatsapp` | abre (tudo) | abre (só painéis comerciais) | negado (na tela) | negado (na tela) | negado (na tela) | negado (na tela) | negado (na tela) |

Como tratar as células `*`R5 (consolidado §3 R5, relatório 01 #28 e #29):

- **Hoje** essas páginas abrem para qualquer usuário autenticado. Nas de Configuração, o usuário
  lê países, catálogo, **preços de referência** e turmas; o menu e as sub-abas só escondem o link.
  Salvar continua bloqueado: qualquer tentativa de gravar deve falhar com erro de permissão. Se
  gravar, é bug.
- **Decisão pendente:** o PO decide se a leitura deve ser bloqueada. Se sim, o esperado dessas
  células passa a ser "negado" e o QA abre bug para cada uma que ainda abrir. Até a decisão, o QA
  registra o comportamento observado como "conhecido (R5)" e **não** abre bug.
- O mesmo vale para `/pipeline`, `/leads` e `/matriculas/nova` abertos por papéis não
  comerciais: confirmar que **nenhum lead** aparece (o escopo dos dados é fechado) e que nenhum
  botão de criar matrícula existe.
