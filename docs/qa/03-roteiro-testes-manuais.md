# Roteiro de testes manuais: UAT v1

> Roteiro para o QA executar pela interface, na ordem real de uso do ERP Genius (configurar,
> captar, matricular, acompanhar o aluno, cobrar). Base: auditoria de 2026-10-21 sobre o commit
> `bc858aff` ([`auditoria-consolidada.md`](auditoria-consolidada.md) e relatórios em
> [`auditoria/`](auditoria/)), doc 09 (telas da Fase 0) e `SETUP.md`.

## Como usar este roteiro

**Um ciclo = executar todos os módulos na ordem (0 → 7).** A ordem importa: o Módulo 1 cria a
configuração que o Módulo 2 usa, e o Módulo 3 cria os alunos que os Módulos 4 e 5 usam. Para
reexecutar um cenário isolado, confira antes a coluna "Pré-condição".

**Para cada cenário, registre na planilha de resultados um destes quatro resultados:**

| Resultado | Quando usar |
|---|---|
| **Passou** | O sistema fez exatamente o que está em "Resultado esperado". |
| **Falhou (abrir issue)** | O sistema fez outra coisa. Abra a issue antes de seguir e anote o número dela na planilha. |
| **Bloqueado** | Não deu para executar (pré-condição faltando, tela quebrada antes do passo, bloqueador B1/B2/B3). Anote o motivo. |
| **Não aplicável** | O cenário não se aplica a este ambiente (ex.: o UAT não tem o país citado). Anote o motivo. |

**Marcadores que aparecem na coluna "Resultado esperado":**

| Marcador | O que significa | O que fazer |
|---|---|---|
| ⚠️ **DECISÃO PENDENTE (R#)** | O código e os docs dizem coisas diferentes e o PO ainda não decidiu qual vale. | Executar, **registrar o observado** na coluna Observação e preencher a coluna "R#". **Não abrir bug.** No fim do ciclo esses cenários vão numa lista separada para o PO. |
| 🛑 **BLOQUEADOR (B#)** | Problema já conhecido que impede o fluxo (consolidado §2). | Se acontecer o que está descrito, marcar **Bloqueado (B#)**. Não abrir bug novo: já está mapeado. |
| 🔎 **GAP CONHECIDO** | O doc diz uma coisa e a auditoria já viu que o código faz outra, mas o item não está na lista de decisões do PO. | O esperado é o do doc. Se falhar, **abrir issue** citando o item da auditoria indicado (ex.: "rel. 05 #26"). |
| ℹ️ **NÃO É BUG** | Comportamento que parece estranho, mas é a regra atual (consolidado §5) ou o doc não define. | Conferir que acontece como descrito. Só é falha se acontecer outra coisa. |
| **[DEV]** | O cenário precisa de um passo que não existe na interface (mudar algo no banco, disparar o cron, simular mensagem recebida). | Pedir o passo ao desenvolvedor de plantão antes de executar. Sem apoio, marcar **Bloqueado**. |

**Convenção de IDs:** `MÓDULO-NN`, com numeração contínua dentro do módulo.

| Prefixo | Módulo |
|---|---|
| `ACE` | 0. Login, sessão, acesso negado e menu por papel |
| `CFG` | 1. Configuração |
| `CRM` | 2. Comercial / CRM |
| `MAT` | 3. Matrícula |
| `ALU` | 4. Alunos |
| `FIN` | 5. Financeiro |
| `PER` | 6. Permissões transversais |
| `HOM` | 7. Home por papel |

**Prioridade:** **P1** crítico (bloqueia o uso real ou expõe dado ou dinheiro), **P2** importante,
**P3** acabamento. Se o tempo do ciclo acabar, garanta todos os P1 primeiro.

**Coluna Ref:** R# e B# são itens do [consolidado](auditoria-consolidada.md); "rel. 0N #x" é o
achado x do relatório N em [`auditoria/`](auditoria/); "doc 09 §X" é a seção do doc de telas.

**Onde abrir bug:** GitHub Issues do repositório `erp-genius`, template **"Bug"**
(`.github/ISSUE_TEMPLATE/bug.yml`; o passo a passo está em [`04-fluxo-de-bugs.md`](04-fluxo-de-bugs.md)).
Garanta que a issue tenha:

- Título começando pelo ID do cenário (ex.: `[FIN-04] baixa parcial sobrescreve a anterior`)
- Ambiente: UAT v1 · data e hora · navegador
- Papel e usuário usado (apelido da tabela PG-1)
- Passos executados (copiar do roteiro e ajustar ao que foi feito)
- Resultado esperado (copiar do roteiro) × resultado obtido
- Evidência: print da tela e a mensagem de erro exata, se houver
- Referência da auditoria (coluna Ref), quando houver

**Ambiente UAT v1:**

- URL informada pelo PO; banco próprio do UAT (nunca o de produção).
- WhatsApp em **modo simulado**: o ambiente roda sem `WHATSAPP_LIVE`, então nenhuma mensagem sai
  de verdade; tudo que seria enviado fica registrado como "simulado" ou "ensaio".
- Política de cobrança e réguas comerciais nascem **desligadas**; nada dispara sozinho.
- Use Chrome ou Edge atualizados. Para testar dois papéis ao mesmo tempo, use uma janela normal e
  uma janela anônima, cada uma com um usuário.
- Datas aparecem em `dd/mm/aaaa`; dinheiro com o símbolo da moeda (₡, US$…). Colón (CRC) aparece
  **sem centavos**.

## Pré-condições gerais

### PG-1. Usuários por papel

Os e-mails, as senhas e como criar os usuários que faltam estão em
[`02-usuarios-e-papeis.md`](02-usuarios-e-papeis.md). Neste roteiro os usuários aparecem pelos
apelidos abaixo. Se o doc 02 usar outros nomes, vale a correspondência pelo papel.

| Apelido | Papel(is) | Origem | Limite de desconto |
|---|---|---|---|
| ADM | Administrador | seed (`admin@genius.com`) | sem limite |
| GC+V | Gerente Comercial + Vendedor | seed (`mariana@genius.com`) | 15% |
| VEND-A | Vendedor | seed (`joao@genius.com`) | 10% |
| FIN+SEC | Financeiro + Secretaria Acadêmica | seed (`ana@genius.com`) | não se aplica |
| PROF | Professor | seed (`carla@genius.com`) | não se aplica |
| GC | Gerente Comercial **puro** | doc 02 (`gerente@genius.com`) | 20% (sem efeito hoje, ver R4) |
| VEND-B | Vendedor **puro** | doc 02 (`vendedor2@genius.com`) | 10% |
| VEND-0 | Vendedor **puro** | doc 02 (`vendedor3@genius.com`) | **vazio** |
| GP | Gerente Pedagógico | doc 02 (`gp@genius.com`) | não se aplica |
| PROF-2 | Professor | doc 02 (`professor2@genius.com`) | não se aplica |
| FIN | Financeiro **puro** | doc 02 (`financeiro@genius.com`) | não se aplica |
| SEC | Secretaria Acadêmica **pura** | doc 02 (`secretaria@genius.com`) | não se aplica |

> 🛑 **B3:** o seed não tem Gerente Pedagógico nem usuários puros de Gerente Comercial, Financeiro
> e Secretaria. Sem os usuários do seed de QA (doc 02, `npm run seed:qa`), os cenários desses
> papéis ficam **Bloqueados (B3)**.
> Testar só com Mariana (GC+V) ou Ana (FIN+SEC) esconde bugs de papel isolado.

### PG-2. País configurado

- **Costa Rica** (moeda CRC, DDI 506) **Ativo**, com tipo de documento cadastrado, produto
  Português · Regular habilitado e preço de referência ativo de taxa de matrícula e mensalidade.
- **Panamá** (moeda USD) **Ativo**, com o mesmo produto habilitado e com preço (para os testes de
  multimoeda e de certificado fora da Costa Rica).
- Pelo menos **um par país × produto habilitado e sem preço de referência** (para MAT-08 e MAT-09).
- Se o UAT não tiver esses países, crie-os com os passos do Módulo 1 (CFG-01 a CFG-10) antes de
  seguir.

### PG-3. Catálogo com preços

Idioma Português; modalidades Regular (2x/semana) e Intensiva (3x/semana); níveis A1 e A2; produto
Português · Regular com preço ativo nos países do PG-2.

### PG-4. Turmas (atenção ao bloqueador B1)

> 🛑 **B1:** a turma nasce "Planejada" e nenhuma tela muda o status para "Aberta", mas a matrícula
> com turma exige "Aberta". **Antes do Módulo 3, peça ao DEV para colocar em ABERTA, no banco de
> UAT,** as turmas marcadas [DEV] abaixo. Sem isso, toda matrícula com turma falha.

| Turma (nome sugerido) | Modalidade · nível | Professor | Capacidade | Início | Status |
|---|---|---|---|---|---|
| QA-T-A1 | Regular · A1 | PROF | 12 | daqui a 14 dias | ABERTA [DEV] |
| QA-T-A1B | Regular · A1 (outro horário) | PROF-2 | 12 | daqui a 14 dias | ABERTA [DEV] |
| QA-T-A2 | Regular · A2 | PROF | 12 | daqui a 14 dias | ABERTA [DEV] |
| QA-T-LOTADA | Regular · A1 | PROF | 1 | daqui a 14 dias | ABERTA [DEV] (fica lotada no MAT-14) |
| QA-T-PLAN | Regular · A1 | PROF | 12 | daqui a 14 dias | Planejada (não mexer; serve para confirmar o B1) |

O GP cria as turmas no Módulo 1 (CFG-13). O DEV ajusta o status logo depois.

### PG-5. WhatsApp em modo simulado

- `WHATSAPP_LIVE` vazio no ambiente (confirmar com o DEV no início do ciclo).
- Um número de **vendas** (driver Baileys, dono VEND-A) e um de **cobrança** cadastrados (CFG-26).
- Política de cobrança **Desligada** e kill switch **desligado** ao começar.
- Nos cenários de inbox e de régua comercial marcados [DEV], o desenvolvedor simula a mensagem
  recebida ou dispara o cron. Sem esse apoio, esses cenários ficam Bloqueados.

### PG-6. Massa de dados do ciclo

Para achar depois o que foi criado, comece todo nome com `QA` e o ID do cenário
(ex.: lead "QA CRM-01 Maria"). Telefones de teste: `+506 8888 0001`, `0002`, … (fictícios).

| Massa | Criada em | Usada em |
|---|---|---|
| País QA (rascunho → ativo) | CFG-01 a CFG-10 | ALU-17 (não use a Costa Rica real nesse teste) |
| Leads do VEND-A e do VEND-B | Módulo 2 | Módulos 2, 3 e 7 |
| AL-1: aluno com matrícula ATIVA, Costa Rica, turma QA-T-A1, lead do VEND-A | MAT-20 | Módulos 4, 5 e 6 (não pausar nem encerrar) |
| AL-2: aluno com matrícula ATIVA, Panamá (USD), lead do VEND-A | MAT-20 (repetir) | FIN-16, FIN-26, FIN-29 |
| AL-3: aluno com matrícula AGUARDANDO (salva pelo VEND-A) | MAT-17 | MAT-19, FIN-16 |
| AL-4: aluno do País QA | MAT-20 (repetir no País QA) | ALU-17 |
| AL-5: aluno na QA-T-LOTADA | MAT-14 | ALU-06, ALU-11 |
| AL-6: aluno da matrícula salva com a QA-T-A1 | MAT-16 | ALU-03 a ALU-13 |
| AL-7: aluno com matrícula ATIVA, de lead do VEND-0 | MAT-20 (repetir com lead do VEND-0) | FIN-11 |
| AL-8: aluno com matrícula ATIVA, de lead do GC+V | MAT-20 (repetir com lead do GC+V) | FIN-21 |

---

## Módulo 0. Login, sessão, acesso negado e menu por papel

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| ACE-01 | Usuário ADM ativo | ADM | 1) Abrir a URL do UAT<br>2) Informar e-mail e senha do ADM<br>3) Clicar em Entrar | Abre a Home. Menu lateral: Home · Pipeline · Leads · Inbox · Alunos · Financeiro · Configuração. Rodapé com iniciais, nome, alternar tema e Sair. | doc 09 §App shell · rel. 01 #30 | P1 |
| ACE-02 | Nenhuma | qualquer | 1) Na tela de login, e-mail válido + senha errada → Entrar<br>2) Repetir com um e-mail que não existe | Nas duas tentativas aparece "E-mail ou senha incorretos." (não revela se o e-mail existe). Continua na tela de login. | rel. 01 #35 | P1 |
| ACE-03 | VEND-A; servidor sem reinício nos últimos 15 min | VEND-A | 1) Errar a senha 5 vezes seguidas<br>2) Na 6ª tentativa, dentro de 15 min, usar a senha **correta**<br>3) Esperar 15 min e entrar com a senha correta | Passo 2 falha com "E-mail ou senha incorretos."; passo 3 entra. ℹ️ NÃO É BUG: são 5 falhas em 15 min por e-mail, guardadas em memória (reiniciar o servidor zera o contador). | §5 · rel. 01 #35 | P2 |
| ACE-04 | Logado | qualquer | 1) Clicar em Sair<br>2) Usar Voltar do navegador<br>3) Digitar `/home` na barra de endereço | Volta para o login. Voltar e a URL direta não mostram dados e levam ao login. | doc 09 §App shell | P1 |
| ACE-05 | Janela anônima, sem login | nenhum | 1) Digitar `/alunos`<br>2) Digitar `/financeiro`<br>3) Digitar `/configuracao/usuarios` | As três redirecionam para o login, sem mostrar dados. | rel. 01 #32 | P1 |
| ACE-06 | VEND-B logado na janela anônima; ADM na janela normal | ADM, VEND-B | 1) ADM: Configuração › Usuários › Desativar o VEND-B<br>2) Na janela do VEND-B, clicar em qualquer item do menu<br>3) Tentar entrar de novo como VEND-B<br>4) ADM reativa o VEND-B | Passo 2: VEND-B é levado ao login sem precisar sair. Passo 3: login recusado. Passo 4: VEND-B volta a entrar. | rel. 01 #4, #36 | P1 |
| ACE-07 | Usuário de teste com papéis Vendedor + Financeiro (CFG-19) logado na janela anônima | ADM | 1) ADM edita esse usuário e remove o papel Vendedor<br>2) Na outra janela, clicar no menu e digitar `/pipeline` | Pipeline e Leads somem do menu e `/pipeline` não mostra leads, sem precisar logar de novo. ℹ️ NÃO É BUG: as sub-abas de Configuração podem mostrar o papel antigo até o próximo login. | rel. 01 #4 | P2 |
| ACE-08 | PROF logado | PROF | 1) Digitar `/financeiro`<br>2) Digitar `/configuracao/usuarios` | Aparece "Acesso negado" (pode ser a página `/acesso-negado` ou o aviso dentro da própria URL; as duas formas são esperadas). Nenhum dado aparece. | rel. 01 #32 | P1 |
| ACE-09 | GC logado | GC | 1) Conferir o menu lateral<br>2) Clicar em Configuração | Menu: Home · Pipeline · Leads · Inbox · Financeiro · Configuração (sem Alunos). Configuração abre direto na sub-aba WhatsApp. ℹ️ NÃO É BUG: Inbox e Configuração para o GC vêm dos docs 26 e 27, não do doc 09. | rel. 01 #30, #31 · §5 | P2 |
| ACE-10 | VEND-A logado | VEND-A | 1) Conferir o menu lateral | Menu: Home · Pipeline · Leads · Inbox. Sem Alunos, Financeiro e Configuração. | rel. 01 #30 | P1 |
| ACE-11 | GP logado | GP | 1) Conferir o menu<br>2) Clicar em Configuração | Menu: Home · Alunos · Configuração. Configuração abre direto em Turmas e só mostra a sub-aba Turmas. | rel. 01 #30, #31 | P2 |
| ACE-12 | PROF logado | PROF | 1) Conferir o menu | Menu: Home · Alunos. Nada mais. | rel. 01 #30 · doc 09 §Visão do Professor | P1 |
| ACE-13 | FIN logado | FIN | 1) Conferir o menu | Menu: Home · Inbox · Alunos · Financeiro. Sem Pipeline, Leads e Configuração. | rel. 01 #30 | P2 |
| ACE-14 | SEC logado | SEC | 1) Conferir o menu | Menu: Home · Inbox · Alunos. ⚠️ DECISÃO PENDENTE (R7): hoje o código não mostra Financeiro para a Secretaria; os docs (doc 09 §Cobranças, visão por papel) dizem que a Secretaria vê as cobranças e registra pagamento no Financeiro. Registrar o observado, não abrir bug até o PO decidir. | R7 | P2 |
| ACE-15 | GC+V e FIN+SEC disponíveis | GC+V, FIN+SEC | 1) Entrar como GC+V e conferir o menu<br>2) Sair, entrar como FIN+SEC e conferir o menu | GC+V: Home · Pipeline · Leads · Inbox · Financeiro · Configuração. FIN+SEC: Home · Inbox · Alunos · Financeiro. O menu é a soma dos papéis. | rel. 01 #38 | P2 |
| ACE-16 | ADM logado | ADM | 1) Clicar em Configuração › Países<br>2) Trocar para Catálogo | O item Configuração fica destacado no menu **e** a sub-aba ativa aparece como botão preenchido. Ao trocar de sub-aba, o destaque acompanha. | doc 09 §App shell | P3 |
| ACE-17 | Qualquer usuário logado | qualquer | 1) No rodapé do menu, alternar o tema claro/escuro<br>2) Navegar por 3 telas | O tema muda e se mantém entre as telas; os textos continuam legíveis. | rel. 02 #2 | P3 |

---

## Módulo 1. Configuração

### 1.1 Países (Administrador)

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| CFG-01 | Nenhuma | ADM | 1) Configuração › Países › Novo país<br>2) Nome "País QA", ISO, moeda, DDI, fuso e idioma<br>3) Adicionar um tipo de documento (ex.: Passaporte)<br>4) Salvar | O país aparece na lista com status **Rascunho**. | doc 09 §1 Países · rel. 04 #14 | P1 |
| CFG-02 | País QA em Rascunho, ainda sem preço de referência | ADM | 1) Na linha do País QA, clicar em Ativar | Ativação recusada com a mensagem do checklist sobre preço ("Cadastre ao menos um produto com preço…"). O país continua Rascunho. | rel. 04 #14 · rel. 02 #53 | P1 |
| CFG-03 | Criar "País QA-X" sem tipo de documento (se o formulário não deixar salvar sem tipo, marcar Não aplicável) | ADM | 1) Clicar em Ativar no País QA-X | Recusado com "Cadastre ao menos um tipo de documento…". | rel. 04 #14 | P2 |
| CFG-04 | País QA criado; produto Português · Regular existe (CFG-06) | ADM | 1) Abrir o País QA › catálogo do país<br>2) Marcar o produto Português · Regular e salvar<br>3) Desmarcar e salvar<br>4) Marcar de novo e salvar | O produto passa a ser oferecido no país, deixa de ser e volta a ser, conforme o checkbox. (O efeito na matrícula é testado no MAT-07.) | doc 09 §1 Países · rel. 02 #53 | P2 |

### 1.2 Catálogo (Administrador)

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| CFG-05 | Nenhuma | ADM | 1) Catálogo › Idiomas: criar (ou conferir) Português<br>2) Modalidades: criar "QA Regular" (segmento Adulto, 2x/semana, mínimo 4)<br>3) Níveis: criar A1 e A2 para Português | Cada item aparece na sua lista logo após salvar. | doc 09 §2 Catálogo · rel. 02 #54 | P2 |
| CFG-06 | Modalidade e idioma existem | ADM | 1) Produtos: criar Português · QA Regular<br>2) Tentar criar de novo o mesmo idioma + modalidade | O 1º salva. O 2º é recusado com "Já existe um produto para esse idioma + modalidade." | rel. 04 #17 | P2 |
| CFG-07 | Produto habilitado no País QA (CFG-04) | ADM | 1) Preços: definir para País QA × produto a Taxa de matrícula (ex.: 100) e a Mensalidade (ex.: 200)<br>2) Conferir a lista | Os dois preços aparecem como **ativos**, na moeda do país. | doc 09 §2 · rel. 04 #19 | P1 |
| CFG-08 | Preço de mensalidade ativo do CFG-07 | ADM | 1) Definir nova Mensalidade (ex.: 220) para a mesma chave país × produto<br>2) Conferir a lista<br>3) Clicar em Reativar no preço antigo (200) | Passo 2: o 220 fica ativo e o 200 vira "Histórico"; nunca há dois ativos na mesma chave. Passo 3: o 200 volta a ativo e o 220 vira histórico. | rel. 03 regra #23 · rel. 04 #19 | P1 |
| CFG-09 | Nenhuma | ADM | 1) Tentar definir preço com valor 0<br>2) Tentar com valor negativo | Recusado com "Valor deve ser maior que zero". Nada é criado. | rel. 04 cenário 24 | P2 |
| CFG-10 | País QA com tipo de documento, produto habilitado e preço ativo | ADM | 1) Países › País QA › Ativar | O status muda para **Ativo**. | rel. 04 #14 | P1 |
| CFG-11 | País QA Ativo; País QA-X em Rascunho | ADM | 1) País QA: Pausar e conferir<br>2) Reativar e conferir<br>3) País QA-X: Encerrar | QA: Pausado → Ativo. QA-X: Encerrado, sem botões de ação. ℹ️ NÃO É BUG: a troca de status grava na hora, sem pedir confirmação. | rel. 04 #14 · rel. 02 #71 | P2 |

### 1.3 Turmas (Gerente Pedagógico)

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| CFG-12 | Modalidade 2x/semana e níveis existem | GP | 1) Configuração › Turmas › Nova turma<br>2) Modalidade Regular (2x/semana), nível A1, marcar **1** dia → Salvar<br>3) Marcar **3** dias → Salvar | Recusado nas duas tentativas: "A modalidade … é 2x/semana: selecione exatamente 2 dia(s) — você marcou N." | rel. 04 #24 · rel. 03 regra #22 | P1 |
| CFG-13 | Mesmo do CFG-12 | GP | 1) Criar as turmas do PG-4 (2 dias, horário, início daqui a 14 dias, fim daqui a 6 meses, professor, capacidade)<br>2) Conferir a lista | Cada turma aparece no formato "0 matriculados · N vagas" e com Situação "Aceitando matrícula". ℹ️ NÃO É BUG: a capacidade padrão do formulário é 12. | doc 09 §3 Turmas · rel. 02 #56 · rel. 04 #35 | P1 |
| CFG-14 | Formulário de nova turma aberto | GP | 1) Data de fim igual ou anterior ao início → Salvar<br>2) Data de fim vazia → Salvar<br>3) Horário de fim antes do início → Salvar | Os três são recusados com mensagem de erro; nada é criado. | rel. 03 regra #22 · rel. 04 #24 | P2 |
| CFG-15 | Turmas do CFG-13 criadas | GP | 1) Procurar na lista e no Editar uma ação para mudar o status (Abrir, Em andamento, Concluir) | Não existe ação de status; só aparece a "Situação" calculada pelas datas. 🛑 BLOQUEADOR (B1): é a causa do B1. Registrar o observado, não abrir bug novo, e pedir ao DEV o ajuste do PG-4. | B1 · rel. 04 #4, #22 | P1 |
| CFG-16 | QA-T-A1B criada | GP | 1) Editar a QA-T-A1B e trocar o professor para PROF-2<br>2) Salvar e conferir a lista | O professor novo aparece na lista e na ficha da turma. | rel. 03 regra #6 | P2 |
| CFG-17 | Nenhuma | ADM | 1) Turmas › Importar turmas › baixar o modelo<br>2) Preencher 1 linha válida (modalidade, "Português A1", dias "Seg, Qua", horários, datas) e importar<br>3) Entrar como GP e procurar o botão de importar | Passo 2: turma criada e listada (Situação pelas datas). Passo 3: o GP não vê o botão de importar (só Admin). | rel. 04 #35 | P2 |
| CFG-18 | Modelo de importação baixado | ADM | 1) Montar uma planilha com 4 linhas: modalidade inexistente; Intensiva 3x com "Seg,Qua"; professor inexistente; capacidade "abc"<br>2) Importar | Cada linha ruim volta com seu erro ("Modalidade não reconhecida", "… precisa de 3 dia(s), veio 2", "Professor não encontrado", "Capacidade inválida"); o lote não cai inteiro por causa de uma linha. | rel. 04 tabela de cargas | P3 |

### 1.4 Usuários (Administrador)

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| CFG-19 | Nenhuma | ADM | 1) Configuração › Usuários › Novo<br>2) Nome, e-mail novo, senha com 6+ caracteres, papéis Vendedor **e** Financeiro, limite de desconto 10<br>3) Salvar; entrar com esse usuário numa janela anônima; voltar à lista | O usuário aparece ativo, com os dois papéis e limite 10%. Antes do login, "Último acesso" mostra "nunca"; depois, a data e a hora do acesso. ℹ️ NÃO É BUG: o formato é data/hora absoluta (o doc 09 sugere "há 43 dias"). | doc 09 §4 Usuários · rel. 02 #57 | P1 |
| CFG-20 | Usuário do CFG-19 existe | ADM | 1) Criar outro usuário com o **mesmo e-mail**<br>2) Criar com senha de 5 caracteres<br>3) Criar sem marcar nenhum papel | 1: mensagem de e-mail duplicado. 2: erro de senha mínima. 3: erro pedindo ao menos um papel. Nenhum é criado. | rel. 03 regra #20 · rel. 01 #2, #37 | P1 |
| CFG-21 | ADM logado | ADM | 1) Desativar o usuário do CFG-19<br>2) Ativar de novo<br>3) Tentar desativar o próprio ADM | 1 e 2 funcionam e a lista mostra o status. 3 é recusado. ℹ️ NÃO É BUG: desativar não pede confirmação. | rel. 01 #33 · rel. 02 #71 | P1 |
| CFG-22 | Usuários VEND-A e VEND-0 existem | ADM | 1) Editar VEND-A: limite 10<br>2) Editar VEND-0: deixar o limite vazio<br>3) Salvar | Valores gravados e exibidos. (Preparação do Módulo 5.) | rel. 01 #16 | P2 |

### 1.5 WhatsApp (Administrador e Gerente Comercial)

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| CFG-23 | ADM logado | ADM | 1) Configuração › WhatsApp<br>2) Conferir os painéis e o estado da política de cobrança<br>3) Templates: criar um rascunho (nome, idioma, corpo com `{nome}`) e salvar | Painéis: Números, Templates, Política, Comercial, Réguas. Política de cobrança **Desligada**. Template salvo com status Rascunho. ℹ️ NÃO É BUG: a política nasce desligada e nada dispara até alguém ligar. Submeter ou sincronizar template com a Meta está fora do escopo. | §5 · rel. 06 #47, #49 | P2 |
| CFG-24 | GC logado | GC | 1) Clicar em Configuração<br>2) Conferir as sub-abas e os painéis | Só a sub-aba WhatsApp, com os painéis Comercial e Réguas. **Não** aparecem Números, Templates, Política, Países, Catálogo nem Usuários. ℹ️ NÃO É BUG (consolidado §5). | §5 · rel. 01 #25 · rel. 02 #4 | P1 |
| CFG-25 | ADM logado | ADM | 1) Na Política de cobrança, ligar o kill switch e salvar<br>2) Recarregar a página<br>3) Desligar e salvar | O estado do kill switch fica gravado após recarregar. Terminar o cenário com ele **desligado**. | rel. 06 #51 | P3 |
| CFG-26 | VEND-A existe | ADM | 1) Números › Novo: finalidade Vendas, driver Baileys, dono VEND-A, telefone de teste<br>2) Novo: finalidade Cobrança, outro telefone<br>3) Tentar cadastrar um terceiro com o **mesmo telefone** do passo 1 | Passos 1 e 2 salvam e aparecem na lista. Passo 3 é recusado com erro de duplicidade. | rel. 06 cenário 14 | P1 |
| CFG-27 | GC logado; número de vendas do CFG-26 | GC | 1) Painel Comercial: ligar "Criar lead automaticamente"<br>2) Saudação: escolher "Ensaio" (shadow) e salvar<br>3) Recarregar a página | A configuração continua gravada depois de recarregar. | rel. 06 #12, #26 | P2 |
| CFG-28 | GC logado | GC | 1) Réguas › "Lead novo sem resposta": estado Ensaio (shadow), remetente = número de vendas Baileys, sem template → Salvar<br>2) Mudar o degrau +4h para um tempo menor que o do +30min → Salvar<br>3) Trocar o remetente para um número Meta sem template aprovado → Salvar | 1: salva. 2: recusado (os degraus precisam estar em ordem crescente). 3: recusado, pedindo template aprovado. | rel. 06 #25, cenário 26 | P2 |

---

## Módulo 2. Comercial / CRM

### 2.1 Captura e criação de lead

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| CRM-01 | Costa Rica ativa | VEND-A | 1) Leads › Novo lead<br>2) Nome "QA CRM-01 Maria", telefone `+506 8888 0001`, país Costa Rica, segmento Adulto, temperatura Quente, origem campanha "QA"<br>3) Salvar e abrir a ficha | Lead em **Novo**, com código `L-` + 6 dígitos, dono = VEND-A. Linha do tempo com "Lead criado" e "Lead atribuído". O campo de dono não aparece para o vendedor. | rel. 06 cenários 1-2 · rel. 03 regra #17 | P1 |
| CRM-02 | Formulário de novo lead aberto | VEND-A | 1) Salvar sem nome<br>2) Salvar sem telefone | Os dois são recusados com mensagem do campo; nenhum lead é criado. | rel. 02 #40 | P1 |
| CRM-03 | Formulário de novo lead aberto | VEND-A | 1) Nome "QA CRM-03", telefone `123`, país Costa Rica → Salvar | ⚠️ DECISÃO PENDENTE (R12): hoje o código aceita e salva o telefone como "+506123"; os docs (doc 04 §3) dizem que telefone inválido bloqueia o cadastro. Registrar o observado, não abrir bug até o PO decidir. | R12 | P2 |
| CRM-04 | VEND-B existe | GC | 1) Leads › Novo lead "QA CRM-04", escolhendo dono VEND-B → Salvar<br>2) Entrar como VEND-A e procurar o lead<br>3) Entrar como VEND-B e procurar o lead | Dono = VEND-B. O VEND-A **não** vê o lead; o VEND-B vê. | rel. 03 regra #17 · rel. 01 #5 | P2 |
| CRM-05 | Nenhuma | VEND-A | 1) Novo lead "QA CRM-05" com valor previsto 150000, plano e comissão prevista, temperatura Morna<br>2) Abrir a ficha | O bloco "Valor da oportunidade" mostra matrícula prevista, plano, comissão e Prioridade (Quente = Alta, Morna = Média, Fria = Baixa). ℹ️ NÃO É BUG: esses valores aparecem sem símbolo de moeda. | doc 09 §Ficha 1b · rel. 02 #23 · rel. 03 convenções | P3 |
| CRM-06 | Leads de etapas e segmentos diferentes | VEND-A | 1) Abrir Leads<br>2) Filtrar por etapa, depois por segmento, depois por temperatura | A lista mostra só os leads que batem com o filtro e volta ao normal ao limpar. | rel. 02 #40 | P3 |

### 2.2 Ficha do lead

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| CRM-07 | Lead do CRM-01 | VEND-A | 1) Abrir a ficha<br>2) Conferir o cabeçalho e a trilha de etapas | Cabeçalho com nome, telefone, país, "no funil há Xd", chips de temperatura, segmento e dono, e a origem. Trilha com as 8 etapas (Novo → 1º Contato → Qualificado → Exp. Agendada → Exp. Realizada → Proposta → Aguardando Matrícula → Matriculado), com a atual destacada. | doc 09 §Ficha 1 · rel. 02 #21, #22 | P2 |
| CRM-08 | Lead do CRM-01 | VEND-A | 1) Registrar interação: canal WhatsApp, nota "QA primeiro contato"<br>2) Conferir a linha do tempo | A interação aparece com a nota, o autor (VEND-A) e a data/hora. | doc 09 §Ficha 5 · rel. 02 #28 | P2 |
| CRM-09 | Lead do CRM-01 | VEND-A | 1) Resumo executivo › Editar<br>2) Preencher Interesse, Objetivo, Urgência, Orçamento, Objeção e Próximo passo<br>3) Salvar | Os 6 campos ficam gravados e a linha do tempo ganha um evento de resumo atualizado com autor. | doc 09 §Ficha 3 · rel. 02 #26 | P2 |
| CRM-10 | Lead do CRM-01 | VEND-A | 1) Próximos passos: follow-up = amanhã, data da experimental, data da proposta<br>2) Salvar datas | As datas ficam gravadas e a linha do tempo registra a alteração. ℹ️ NÃO É BUG: o doc 09 fala em "Status da proposta"; a tela tem só a data da proposta. | doc 09 §Ficha 4 · rel. 02 #27 | P2 |
| CRM-11 | Lead em Novo | VEND-A | 1) Abrir "Mudar etapa…" e conferir as opções<br>2) Escolher Qualificado<br>3) Escolher 1º Contato | Opções: só Novo, 1º Contato, Qualificado e Exp. Agendada. Passo 2: erro de transição inválida, a etapa não muda. Passo 3: muda para 1º Contato e a linha do tempo mostra "de → para". | rel. 02 #24 · rel. 06 #3 | P1 |
| CRM-12 | Lead do CRM-01; um PDF pequeno, um .docx e um arquivo com mais de 10 MB à mão | VEND-A | 1) Documentos: anexar o PDF na categoria "Teste de nível"<br>2) Arquivar esse documento<br>3) Tentar anexar o .docx<br>4) Tentar anexar o arquivo grande | 1: documento listado. 2: sai da lista ativa; linha do tempo mostra "anexado" e "arquivado". 3: "Tipo inválido (use PDF, JPG ou PNG)." 4: "Arquivo acima de 10MB." | doc 09 §Ficha 6 · rel. 02 #29 · rel. 04 #37 | P2 |

### 2.3 Pipeline (Kanban)

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| CRM-13 | Lead novo "QA CRM-13" do VEND-A | VEND-A | 1) Pipeline: arrastar o card pela alça "⠿ arrastar" de Novo para 1º Contato<br>2) Depois para Qualificado<br>3) Depois para Exp. Agendada<br>4) Arrastar de volta de Exp. Agendada para Qualificado | Cada movimento é aceito, a contagem das colunas muda e o card mostra "0d nesta etapa". ℹ️ NÃO É BUG: voltar etapa (passo 4, ou 1º Contato → Novo) é permitido pela regra atual. | rel. 02 #37 · rel. 06 #3 · rel. 03 regra #1 | P1 |
| CRM-14 | Lead em Novo e lead em Qualificado | VEND-A | 1) Arrastar o lead de Novo direto para Qualificado<br>2) Arrastar o de Qualificado para Proposta<br>3) Arrastar qualquer um para Exp. Realizada | Os três são recusados com mensagem e o card volta para a coluna de origem. | rel. 02 #37 · rel. 06 cenário 4 | P1 |
| CRM-15 | Lead em 1º Contato | VEND-A | 1) Arrastar para a coluna Perdido<br>2) No modal, clicar Cancelar<br>3) Arrastar de novo, escolher motivo "Preço" e confirmar | 2: nada muda. 3: o lead vai para a coluna Perdido (cinza), com o motivo. | doc 09 §Pipeline Comportamento · rel. 02 #38 | P2 |
| CRM-16 | Lead em Proposta | VEND-A | 1) Arrastar para Matriculado<br>2) Na tela de matrícula que abriu, voltar sem salvar<br>3) Reabrir o Pipeline | Passo 1 abre a matrícula com o lead pré-preenchido. Passo 3: o lead continua em Proposta (soltar em Matriculado não muda a etapa). | rel. 02 #38 · rel. 06 #6 | P2 |
| CRM-17 | Um lead em Novo criado há mais de 60 min | GC | 1) Abrir o Pipeline e olhar o card e as colunas | Card: nome, temperatura, código · país · valor, "Xd nesta etapa", "Próxima: …" e a tag **SLA**. Cada coluna mostra contagem e soma de valores; Novo, Exp. Agendada e Proposta aparecem destacadas como gargalo. | doc 09 §Pipeline Cards · rel. 02 #35, #36 | P3 |
| CRM-18 | Um lead marcado como B2B (Empresa) e outros PF | GC | 1) Alternar o seletor "Pessoa Física / Empresa (B2B)"<br>2) No modo PF, alternar o filtro "Perdidos" entre 30 dias, 90 dias e todos | B2B mostra só os leads marcados como empresa, com as **mesmas colunas** do PF. O filtro de Perdidos muda o que aparece na coluna Perdido. | rel. 02 #33, #34 | P3 |
| CRM-19 | Leads do VEND-A e do VEND-B existem | VEND-A, GC | 1) VEND-A abre o Pipeline<br>2) GC abre o Pipeline<br>3) VEND-B copia a URL de um lead do VEND-A (pedir ao GC) e abre | 1: só os leads do VEND-A. 2: os leads de todos. 3: página de "não encontrado" (404), sem dados do lead. | rel. 01 #5 · rel. 06 #18 | P1 |

### 2.4 Lead perdido

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| CRM-20 | Lead "QA CRM-20" em 1º Contato | VEND-A | 1) Ficha › Marcar perdido › conferir a lista de motivos<br>2) Escolher "Outro", deixar a observação vazia, confirmar<br>3) Preencher a observação e confirmar | Lista: Não respondeu · Preço · Tempo/Horário · Concorrência · Sem interesse · Localização · Empresa (B2B) · Qualificação · Outro. Passo 2: erro pedindo a observação (aparece depois do clique). Passo 3: chip "Perdido · Outro" na ficha e o lead na coluna Perdido. | doc 09 §Marcar perdido · rel. 02 #25 · rel. 06 #4 | P1 |
| CRM-21 | Um lead já Matriculado (do Módulo 3; se ainda não existir, voltar aqui depois do MAT-20) | VEND-A | 1) Abrir a ficha do lead Matriculado<br>2) Tentar Marcar perdido | ℹ️ NÃO É BUG por ora: o doc não define o que acontece. Registrar se o sistema aceita ou recusa (a auditoria indica que hoje aceita). | rel. 06 máquina de estados | P3 |

### 2.5 Experimental e no-show

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| CRM-22 | Lead "QA CRM-22" em Qualificado | VEND-A, PROF | 1) VEND-A: Agendar experimental para hoje, daqui a 1 h, com professor PROF<br>2) Entrar como PROF e abrir a Home | 1: lead em Exp. Agendada. 2: a experimental aparece na Home do PROF, com os botões Compareceu e Faltou. | doc 09 §Visão do Professor · rel. 06 #16, #17 | P1 |
| CRM-23 | Lead "QA CRM-23" em Qualificado | VEND-A, PROF, PROF-2 | 1) VEND-A: Agendar experimental **sem** professor<br>2) PROF e PROF-2 abrem a Home<br>3) PROF-2 abre a Home e procura a experimental do CRM-22 (atribuída ao PROF) | Passo 2: nenhum dos dois vê a experimental do CRM-23. Passo 3: PROF-2 não vê a do CRM-22. | rel. 01 #27 · rel. 02 #19 | P2 |
| CRM-24 | Experimental do CRM-22 na Home do PROF | PROF | 1) Clicar em Compareceu<br>2) VEND-A abre a ficha do lead | Lead em **Exp. Realizada**. Linha do tempo com "Experimental realizada", autor PROF e data/hora. O lead volta a aparecer para o VEND-A. | doc 09 §Check-in · rel. 03 cenário 3 | P1 |
| CRM-25 | Outro lead em Exp. Agendada com professor PROF | PROF, VEND-A | 1) PROF clica em Faltou<br>2) VEND-A abre a ficha do lead<br>3) VEND-A abre o Pipeline e procura o card<br>4) VEND-A abre Leads e filtra a etapa No-show | 2: chip No-show na ficha e evento na linha do tempo. 3: ⚠️ DECISÃO PENDENTE (R9): hoje o código não mostra o lead em nenhuma coluna do Kanban (não existe coluna No-show); os docs (doc 09 §Pipeline) tratam o no-show como etapa visível do funil, para medir o vazamento. Registrar o observado, não abrir bug até o PO decidir. 4: o lead aparece na lista. | R9 · rel. 06 #2 | P1 |
| CRM-26 | Lead do CRM-25 em No-show | VEND-A | 1) Ficha › Agendar experimental de novo (nova data, professor PROF) | O lead volta para Exp. Agendada e a linha do tempo ganha um novo evento de agendamento. | rel. 06 cenário 9 | P2 |
| CRM-27 | Lead do CRM-24 em Exp. Realizada | VEND-A | 1) Ficha › Enviar proposta<br>2) No Pipeline, arrastar de Proposta para Qualificado | 1: lead em Proposta com a data da proposta preenchida. ℹ️ NÃO É BUG: o botão grava na hora, sem confirmação. 2: aceito (retrocesso permitido). Arrastar de volta para Proposta é recusado; use de novo "Enviar proposta" pela ficha. | rel. 06 #16 · rel. 02 #71 | P2 |

### 2.6 Inbox (WhatsApp em modo simulado)

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| CRM-28 | Números do CFG-26 cadastrados | VEND-A, PROF | 1) VEND-A clica em Inbox<br>2) PROF digita `/inbox` | 1: a Inbox abre sem erro (lista vazia se ainda não houve mensagem). 2: "Acesso negado". | rel. 06 #43 | P2 |
| CRM-29 | [DEV] simular mensagem recebida de um telefone novo no número de vendas do VEND-A | VEND-A, VEND-B, FIN, GC | 1) VEND-A abre a Inbox<br>2) VEND-B abre a Inbox<br>3) FIN abre a Inbox<br>4) GC abre a Inbox | 1: conversa nova no topo, com contador de não lidas também no item Inbox do menu. 2 e 3: não veem a conversa (o número não é deles; o FIN só vê números de cobrança). 4: vê (número de vendas). | rel. 06 #43, cenário 15 | P2 |
| CRM-30 | "Criar lead automaticamente" ligado (CFG-27); [DEV] simular mensagens de: (a) telefone novo; (b) telefone de um lead já existente; e, com o auto-lead desligado, (c) outro telefone novo | VEND-A | 1) Depois de cada mensagem simulada, abrir Leads e a Inbox | (a) lead novo em Novo, dono = VEND-A (dono do número), nome do contato, autor "sistema" na linha do tempo. (b) nenhum lead novo; a conversa aparece vinculada ao lead existente. (c) só a conversa, sem lead. | rel. 06 #12, cenários 18-19 | P2 |
| CRM-31 | Conversa do CRM-29 aberta | VEND-A | 1) Escrever uma nota interna e salvar<br>2) Escrever um texto no campo de envio e enviar<br>3) Clicar no botão de opt-out e tentar enviar de novo<br>4) Remover o opt-out e tentar enviar | 1: a nota aparece como nota interna e não vai para o contato. 2: aviso "Ensaio (shadow)…" e a mensagem **não** aparece na conversa. ℹ️ NÃO É BUG: no modo simulado nada é enviado e a mensagem não entra na thread. 3: envio recusado por opt-out. 4: envio volta a ser aceito (ainda como ensaio). | rel. 06 #29, #32, cenários 21-22 | P2 |

### 2.7 Régua comercial em modo simulado

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| CRM-32 | Régua "Lead novo sem resposta" em Ensaio (CFG-28); lead automático do CRM-30 em Novo há mais de 30 min; [DEV] disparar o cron duas vezes | GC | 1) Depois do 1º disparo, abrir Configuração › WhatsApp › Réguas › painel "Ensaio"<br>2) Depois do 2º disparo, conferir de novo<br>3) Mover outro lead automático para 1º Contato e pedir um 3º disparo | 1: aparece o degrau +30min simulado para o lead. 2: não duplica. 3: nada novo para o lead que saiu de Novo. | rel. 06 #21, #22, #26, cenários 23-24 | P2 |
| CRM-33 | Lead automático em Novo com degrau já simulado; [DEV] simular uma resposta enviada **pelo celular do vendedor** (fromMe) e depois disparar o cron | GC | 1) Conferir a conversa na Inbox<br>2) Conferir o painel "Ensaio" após o cron | 1: a mensagem aparece marcada como "celular". 2: ⚠️ DECISÃO PENDENTE (R16): hoje o código continua a cadência (resposta pelo celular não conta como "vendedor assumiu"); os docs (doc 27 e doc 32, bloqueador B2) dizem que a resposta do vendedor para a cadência. Registrar o observado, não abrir bug até o PO decidir. | R16 · rel. 06 #22, #40 | P2 |
| CRM-34 | Régua "Pré-experimental" em Ensaio; lead em Exp. Agendada; [DEV] simular resposta "REAGENDAR" do lead e depois "SIM"; disparar o cron | VEND-A | 1) Conferir a linha do tempo do lead<br>2) Conferir o painel "Ensaio" e a ficha do lead | 1: evento de pedido de reagendamento. 2: ⚠️ DECISÃO PENDENTE (R16): hoje o código não pausa a cadência após "REAGENDAR" (o lembrete seguinte ainda é gerado); os docs (doc 27 e doc 32, bloqueador B8) dizem que a cadência pausa até ação humana. Registrar o observado, não abrir bug até o PO decidir. ℹ️ NÃO É BUG: "SIM" não confirma a experimental em modo simulado (só confirma depois de um lembrete enviado de verdade). | R16 · §5 · rel. 06 #24, #30 | P3 |

---

## Módulo 3. Matrícula

Fluxo atual: wizard de 2 passos (1. Aluno; 2. Curso, alocação e contrato). "Salvar matrícula"
deixa a matrícula **Aguardando**; "Receber pagamento e ativar" cria e ativa de uma vez.

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| MAT-01 | Lead do VEND-A em Proposta (ex.: CRM-27) | VEND-A | 1) Ficha do lead › Converter em matrícula<br>2) Conferir o passo 1 | O wizard abre com nome e sobrenome separados, telefone e país vindos do lead. Pagador padrão "O próprio aluno". | doc 09 §Matrícula · rel. 02 #41 | P1 |
| MAT-02 | Wizard no passo 1 | VEND-A | 1) Deixar Gênero vazio → Próximo<br>2) Preencher e deixar Nacionalidade vazia → Próximo<br>3) Repetir com Data de nascimento e Número do documento<br>4) Trocar o pagador para Responsável sem informar o nome → Próximo | Cada tentativa é barrada com a mensagem do campo que falta (uma por vez). Obrigatórios: País, Tipo e Nº do documento, Nome, Sobrenome, País de residência, Telefone, E-mail, Nascimento, Nacionalidade, Gênero e, se o pagador não for o aluno, o nome do responsável. | doc 09 §Seções 1 · rel. 02 #43, #45 | P1 |
| MAT-03 | Wizard no passo 1 | VEND-A | 1) E-mail "abc" → Próximo | Barrado com mensagem de e-mail inválido. | rel. 04 #12 | P1 |
| MAT-04 | Wizard no passo 1 | VEND-A | 1) Telefone "123", demais campos válidos<br>2) Concluir e salvar a matrícula<br>3) Abrir a ficha do aluno (pedir ao ADM ou à SEC) | ⚠️ DECISÃO PENDENTE (R12): hoje o código aceita e grava "+506123"; os docs (doc 04 §3) dizem que telefone inválido bloqueia. Registrar o observado, não abrir bug até o PO decidir. | R12 · rel. 04 #11 | P1 |
| MAT-05 | País Costa Rica (tipo cédula) | VEND-A | 1) Número de documento com formato **correto** de cédula → salvar a matrícula<br>2) Outra matrícula com número claramente inválido<br>3) Abrir as fichas dos dois alunos | As duas matrículas salvam (documento avisa, não bloqueia). A ficha com documento inválido mostra "não validado". 🔎 GAP CONHECIDO (rel. 04 #13): a ficha com documento correto deveria aparecer validada; hoje só o CPF tem validador, então todo documento de outro tipo aparece "não validado". Se for o caso, abrir issue citando o item. | doc 09 §Seções 1 · rel. 04 #13 | P2 |
| MAT-06 | Wizard no passo 1 com país Costa Rica | VEND-A | 1) Trocar o país para Panamá<br>2) Ir ao passo 2 e olhar taxa e mensalidade<br>3) Editar a taxa para outro valor | 1: o tipo de documento é limpo se não for do Panamá. 2: valores vêm do preço de referência do Panamá com a etiqueta "Sugerido". 3: a etiqueta muda para "Manual (sugerido: …)". | rel. 02 #47 · rel. 02 cenário 20 | P2 |
| MAT-07 | Produto desabilitado no País QA (desmarcar no CFG-04) | ADM | 1) Matrícula com país País QA e esse produto → Salvar<br>2) Reabilitar o produto no país ao final | Recusado com "Produto não está disponível para o país selecionado." | rel. 04 cenário 8 | P2 |
| MAT-08 | Par país × produto habilitado **sem** preço (PG-2) | VEND-A | 1) No passo 2, escolher esse produto<br>2) Conferir o aviso e o campo de justificativa<br>3) Preencher a justificativa e salvar | 2: aviso "Sem tabela" e campo "Justificativa da exceção" obrigatório. 3: ⚠️ DECISÃO PENDENTE (R14): hoje o código recusa com "Apenas Gerente Comercial ou Administrador podem matricular sem preço de referência."; os docs (doc 10 §3.1) dizem que basta a justificativa, sem restrição de papel. Registrar o observado, não abrir bug até o PO decidir. | R14 · rel. 04 #8 | P1 |
| MAT-09 | Mesmo par sem preço; lead do GC+V | GC+V | 1) Passo 2 com esse produto, justificativa vazia → Salvar<br>2) Preencher a justificativa → Salvar | 1: bloqueado pedindo o preço ou a justificativa. 2: matrícula salva e marcada "Sem tabela". | rel. 04 #8 · rel. 03 regra #9 | P1 |
| MAT-10 | Wizard no passo 2 | VEND-A | 1) Abrir o campo Dia de vencimento<br>2) Conferir Meses do plano e o card "Primeiro pagamento"<br>3) Conferir o campo Comissão | 1: só 5, 10, 15, 20 e 25. 2: meses padrão 12; o card mostra taxa + 1ª mensalidade = total. 3: comissão em % da taxa, padrão 20. ℹ️ NÃO É BUG por ora: o campo de comissão é editável pelo vendedor (o doc 09 diz "automática"); registrar se o PO quiser rever. | doc 09 §Seções 3-4 · rel. 02 #47, #48 · rel. 03 regra #26 | P2 |
| MAT-11 | Matrícula no Panamá | GC+V | 1) No passo 2, informar Certificado com valor 50<br>2) Salvar | ⚠️ DECISÃO PENDENTE (R15): hoje o código aceita o certificado com valor livre em qualquer país; os docs (doc 04) dizem que o certificado é fixo, em colones e só para a Costa Rica. Registrar o observado, não abrir bug até o PO decidir. | R15 · rel. 04 #6 | P2 |
| MAT-12 | Turmas do PG-4 ajustadas pelo DEV | VEND-A | 1) No passo 2, abrir o seletor de Turma<br>2) Conferir quais turmas aparecem e o rótulo de cada uma | Aparecem só turmas com início no futuro e com vaga (QA-T-LOTADA some depois do MAT-14; turma já iniciada não aparece). O rótulo mostra as vagas. 🔎 GAP CONHECIDO (rel. 02 #46): o doc 09 pede também a data de início no rótulo; se não aparecer, abrir issue citando o item. | doc 09 §Seções 2 · rel. 04 #4 | P2 |
| MAT-13 | QA-T-PLAN (Planejada, sem ajuste no banco) | VEND-A | 1) Escolher a QA-T-PLAN no seletor de Turma<br>2) Salvar a matrícula | Esperado pelo doc 09: matrícula salva com a turma. 🛑 BLOQUEADOR (B1): hoje aparece "A turma selecionada não está aberta para matrícula." Se for isso, marcar Bloqueado (B1); não abrir bug novo. | B1 · rel. 04 #4 | P1 |
| MAT-14 | QA-T-LOTADA em ABERTA [DEV]; lead do VEND-A | ADM | 1) Converter o lead, escolher a QA-T-LOTADA<br>2) Receber pagamento e ativar (valor = taxa)<br>3) Abrir Configuração › Turmas | Matrícula criada com a turma. A turma passa a "1 matriculado · 0 vagas" e some do seletor da próxima matrícula. Esse aluno é o AL-5. 🛑 Se aparecer "A turma selecionada não está aberta para matrícula.", o ajuste do DEV não foi feito: marcar Bloqueado (B1). | B1 · rel. 04 #23 | P1 |
| MAT-15 | Wizard no passo 2 | VEND-A | 1) Escolher "Sem alocação / lista de espera"<br>2) Clicar em "Solicitar abertura ao Gerente Pedagógico"<br>3) Entrar como GP e procurar a solicitação | 2: mensagem de solicitação enviada. 3: ℹ️ NÃO É BUG por ora: o GP não tem tela onde ver a solicitação (só fica registrada). Registrar o observado. | doc 09 §Seções 2 · rel. 04 #25 | P3 |
| MAT-16 | Matrícula com turma ABERTA | VEND-A, ADM | 1) VEND-A salva uma matrícula escolhendo a QA-T-A1<br>2) ADM abre Configuração › Turmas | A turma soma 1 matriculado e perde 1 vaga. | rel. 04 cenário 7 | P1 |
| MAT-17 | Lead do VEND-A em Proposta | VEND-A | 1) Converter em matrícula, preencher tudo, sem turma<br>2) Conferir os botões no fim do passo 2<br>3) Salvar matrícula<br>4) Abrir a ficha do lead<br>5) Pedir ao ADM para abrir Alunos e achar o aluno | 2: só existe "Salvar matrícula" (sem bloco de pagamento). 3: salva e redireciona. 4: lead em **Aguardando Matrícula**. 5: aluno com código `A-` + 6 dígitos. ⚠️ DECISÃO PENDENTE (R11): hoje o código mostra o aluno como **Ativo** mesmo com a matrícula Aguardando; os docs (doc 09 §Matrícula, estado/gatilho) dizem que o aluno fica em rascunho até a ativação. Registrar o observado, não abrir bug até o PO decidir. ℹ️ NÃO É BUG: a numeração dos códigos pode pular números. Esse aluno é o AL-3. | R11 · rel. 04 #10 · §5 | P1 |
| MAT-18 | Lead do GC+V em Proposta | GC, ADM | 1) GC abre a matrícula de um lead e confere os botões<br>2) ADM abre a matrícula de outro lead e confere | 1: só "Salvar matrícula". ⚠️ DECISÃO PENDENTE (R1): hoje o código não deixa o Gerente Comercial receber nem ativar (ativar com pendência não existe); os docs (doc 09 §Matrícula, P7) dizem que Admin ou Gerente podem ativar com pendência. Registrar o observado, não abrir bug até o PO decidir. 2: aparecem "Salvar matrícula" e "Receber pagamento e ativar", com a seção "Pagamento da taxa". | R1 · rel. 02 #50 | P1 |
| MAT-19 | AL-3 (matrícula Aguardando, do MAT-17) | FIN | 1) Abrir Alunos › AL-3 › Ver ficha financeira<br>2) Procurar uma ação para ativar a matrícula ou receber a taxa e ativar<br>3) Se só houver "Registrar pagamento" na taxa, registrar e conferir o status da matrícula | Esperado pelo doc 09: o Financeiro recebe a taxa e a matrícula fica Ativa. 🛑 BLOQUEADOR (B2): hoje não existe ação de ativar depois de salvar; se registrar o pagamento da taxa não ativar a matrícula, marcar Bloqueado (B2). Não abrir bug novo. | B2 · rel. 04 #3 | P1 |
| MAT-20 | Lead do VEND-A; turma QA-T-A1 ABERTA [DEV] | ADM | 1) Converter o lead (Costa Rica), escolher a QA-T-A1, dia de vencimento 10<br>2) Pagamento da taxa: valor = taxa, forma Transferência, comprovante preenchido<br>3) Receber pagamento e ativar<br>4) Abrir a ficha financeira do aluno e a ficha do lead | Matrícula **Ativa**; taxa Paga; 1ª mensalidade Pendente com vencimento no dia 10, cerca de 30 dias depois do início da turma; demais mensalidades geradas até completar os meses do plano; comissão **Aprovada** para o VEND-A; lead **Matriculado**. ⚠️ DECISÃO PENDENTE (R1): hoje o código ativa só com a taxa paga (marca o contrato como ok automaticamente e deixa a 1ª mensalidade pendente); os docs (docs 05, 10 e 16, P7) dizem que a ativação exige taxa + 1ª mensalidade + contrato. Registrar o observado, não abrir bug até o PO decidir. Este aluno é o AL-1. Repetir no Panamá (AL-2) e no País QA (AL-4). | R1 · rel. 04 fluxo · rel. 03 cenário 5 | P1 |
| MAT-21 | Lead do VEND-A; taxa conhecida | ADM | 1) Converter, preencher tudo<br>2) Valor recebido = taxa − 1 → Receber pagamento e ativar<br>3) Abrir Alunos e procurar o nome<br>4) Repetir com valor = taxa + 50 | 2: erro "… O valor recebido não cobre a taxa de matrícula …". 3: nenhum aluno com esse nome foi criado. 4: ativa normalmente. ℹ️ NÃO É BUG por ora: o excedente (troco) não é aplicado em nenhuma cobrança, só fica registrado; confirmar a regra com o PO. | rel. 04 cenários 4-5 | P1 |
| MAT-22 | Wizard como ADM com bloco de pagamento | ADM | 1) Forma Transferência, comprovante vazio → Receber pagamento e ativar<br>2) Forma Dinheiro, comprovante vazio → Receber pagamento e ativar | 1: bloqueado com "Informe o comprovante do pagamento". 2: aceito. ℹ️ NÃO É BUG: nesta tela o comprovante é um campo de texto (aceita qualquer texto), não um upload. | rel. 04 #37, cenário 6 · rel. 02 #49 | P2 |
| MAT-23 | Lead do VEND-A | VEND-B, GC+V | 1) VEND-B abre `/matriculas/nova?lead=<id do lead do VEND-A>` (pegar o id na URL da ficha, com o GC)<br>2) GC+V abre o mesmo endereço | 1: formulário vazio, sem os dados do lead. 2: formulário pré-preenchido com o lead. | rel. 01 #10 · rel. 01 cenário 3 | P2 |
| MAT-24 | Lead já convertido (do MAT-17) | VEND-A | 1) Abrir a ficha do lead e clicar em Converter em matrícula<br>2) Preencher e salvar | Recusado com "Lead já possui matrícula." | rel. 04 #41 | P2 |

---

## Módulo 4. Alunos

Alunos usados: AL-1 (ativo, QA-T-A1), AL-5 (QA-T-LOTADA) e **AL-6** = aluno do MAT-16 (QA-T-A1).
Não pause nem encerre o AL-1: ele é usado no Módulo 5.

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| ALU-01 | Alunos do Módulo 3 existem | SEC | 1) Abrir Alunos<br>2) Buscar pelo nome e depois pelo código `A-` de um aluno<br>3) Filtrar por status, por país e por turma | A busca acha pelos dois critérios; os filtros reduzem a lista. Colunas: aluno, país, turma, status e situação financeira. 🔎 GAP CONHECIDO (rel. 02 #59): o doc 09 pede também "tempo desde a matrícula" na linha; se não houver, abrir issue citando o item. | doc 09 §Lista de Alunos | P2 |
| ALU-02 | AL-1 | SEC | 1) Abrir a ficha do AL-1 | Cabeçalho com nome, país, contato e status em destaque; turma atual com horário e professor; dados pessoais completos; bloco financeiro resumido com o link "Ver ficha financeira". 🔎 GAP CONHECIDO (rel. 02 #61): o doc 09 pede também a data de início e o "tempo na turma"; se não houver, abrir issue citando o item. | doc 09 §Ficha do Aluno | P2 |
| ALU-03 | AL-6 | SEC | 1) Ficha › Editar dados<br>2) Mudar o e-mail sem preencher o motivo<br>3) Preencher o motivo e salvar | 2: o botão de salvar fica desabilitado. 3: e-mail atualizado na ficha, com registro da alteração (antes → depois, motivo, autor). | doc 09 §Ficha do Aluno · rel. 04 cenário 19 | P1 |
| ALU-04 | AL-6 | SEC | 1) Editar dados: apagar a data de nascimento, motivo preenchido → salvar<br>2) Editar dados: apagar o nome → salvar | 1: salva (edição flexível: só a identidade é obrigatória). 2: recusado pedindo o nome. | doc 09 §Ficha do Aluno (edição lenient) | P2 |
| ALU-05 | AL-6 na QA-T-A1; QA-T-A1B com vaga | SEC | 1) Ficha do AL-6 › Trocar turma › QA-T-A1B (mesmo nível), sem justificativa<br>2) Abrir Configuração › Turmas (como ADM) ou a ficha das duas turmas | 1: troca aceita; a ficha mostra a QA-T-A1B. 2: QA-T-A1 com uma vaga a mais; QA-T-A1B com uma vaga a menos. | doc 09 §Ciclo de status · rel. 03 regra #24 | P1 |
| ALU-06 | QA-T-LOTADA sem vaga (AL-5 nela) | SEC | 1) Ficha do AL-6 › Trocar turma › tentar escolher a QA-T-LOTADA e confirmar | Recusado com "Turma de destino sem vaga." (ou a turma nem aparece como opção). O AL-6 continua na turma atual. | rel. 04 cenário 17 | P1 |
| ALU-07 | AL-6 em turma A1; QA-T-A2 com vaga | GP | 1) Trocar turma do AL-6 para a QA-T-A2 (nível diferente) **sem** justificativa | Esperado pelo doc 09: recusado, pedindo justificativa para troca entre níveis. 🔎 GAP CONHECIDO (rel. 04 #26): hoje a troca é aceita sem justificativa. Se aceitar, abrir issue citando o item. Ao final, voltar o AL-6 para a QA-T-A1B. | doc 09 §Ciclo de status · rel. 04 #26 | P2 |
| ALU-08 | AL-6 Ativo | SEC | 1) Ficha › Pausar sem motivo → confirmar<br>2) Pausar com motivo "QA viagem" e retorno previsto daqui a 1 mês<br>3) Conferir os botões e a ficha financeira do AL-6 | 1: bloqueado pedindo o motivo. 2: status **Pausado**. 3: botões Reativar e Encerrar (Pausar some). Mensalidades com vencimento futuro aparecem como Canceladas; as já vencidas continuam. | doc 09 §Ciclo de status · rel. 03 cenário 10 | P1 |
| ALU-09 | AL-6 Pausado na QA-T-A1B (professor PROF-2) | ADM, PROF-2 | 1) ADM confere as vagas da QA-T-A1B<br>2) PROF-2 abre Alunos e a ficha da turma | ⚠️ DECISÃO PENDENTE (R10): hoje o código mantém o aluno pausado ocupando a vaga e visível para o professor; os docs (doc 09 §Ciclo de status) dizem que o aluno pausado não ocupa vaga e não aparece para o professor. Registrar o observado, não abrir bug até o PO decidir. | R10 · rel. 04 #27 | P1 |
| ALU-10 | AL-6 Pausado | SEC | 1) Ficha › Reativar<br>2) Conferir a ficha financeira | 1: volta para **Ativo** na hora. ℹ️ NÃO É BUG: reativar não pede confirmação. 2: ℹ️ o doc não define se as mensalidades canceladas na pausa voltam; registrar o que aparece. | rel. 02 #65, #71 · rel. 03 cenário 10 | P1 |
| ALU-11 | AL-5 na QA-T-LOTADA (já usado no ALU-06) | SEC | 1) Ficha do AL-5 › Encerrar com motivo "Outro" e observação vazia → confirmar<br>2) Encerrar com motivo "Desistiu"<br>3) Conferir a ficha e as vagas da QA-T-LOTADA | 1: bloqueado pedindo observação. 2: status **Encerrado**, sem botões de movimentação; histórico com motivo, autor e data. Motivos da lista: Concluiu, Desistiu, Mudou de país, Inadimplência, Transferência, Outro. 3: ⚠️ DECISÃO PENDENTE (R10, mesmo caso para o encerrado): hoje o código mantém o aluno encerrado na turma e ocupando vaga; os docs (doc 09 §Ciclo de status) dizem que o encerrado não ocupa vaga. Registrar o observado, não abrir bug até o PO decidir. | doc 09 §Ciclo de status · R10 · rel. 04 #28 | P1 |
| ALU-12 | AL-6 Ativo | SEC | 1) Pausar o AL-6 de novo<br>2) Com ele Pausado, Encerrar com motivo "Transferência" | ℹ️ NÃO É BUG por ora: o doc 09 não diz se dá para encerrar direto de Pausado. Registrar o observado (a auditoria indica que hoje é aceito). | rel. 03 regra #2 | P3 |
| ALU-13 | Movimentações feitas nos cenários anteriores | SEC | 1) Abrir o histórico de movimentações do AL-6 | Uma linha por movimentação (troca, pausa, reativação, encerramento), com tipo, motivo, observação, autor e data. 🔎 GAP CONHECIDO (rel. 02 #64): o doc 09 pede também "de → para" (turma de origem e destino); se não houver, abrir issue citando o item. | doc 09 §Ficha do Aluno | P3 |
| ALU-14 | QA-T-A1 com alunos | SEC | 1) Na ficha do aluno, clicar na turma (ou abrir a ficha da turma) | Cabeçalho com modalidade, nível, professor e horário; ocupação (matriculados · vagas); lista de alunos com código e status. 🔎 GAP CONHECIDO (rel. 02 #66): o doc 09 pede também início, status, próxima aula e situação financeira de cada aluno; se faltar, abrir issue citando o item. | doc 09 §Ficha da Turma | P3 |
| ALU-15 | PROF tem as turmas QA-T-A1, QA-T-A2 e QA-T-LOTADA; AL-6 está na QA-T-A1B (PROF-2) | PROF | 1) Abrir Alunos<br>2) Abrir a ficha de um aluno da QA-T-A1<br>3) Pedir ao ADM a URL da ficha do AL-6 e abrir | 1: só alunos das turmas do PROF. 2: ficha sem bloco financeiro e sem botões de movimentação. 3: página "não encontrado" (404). | doc 09 §Visão do Professor · rel. 01 #6, #7 | P1 |
| ALU-16 | Nenhuma | ADM, SEC, FIN | 1) ADM: Alunos › Cadastrar por lote › baixar o modelo<br>2) Importar o próprio modelo (linha de exemplo)<br>3) SEC e FIN abrem Alunos e procuram os botões "Cadastrar por lote" e "Cadastrar aluno" | 2: 1 aluno criado, status Ativo, sem turma nem matrícula. 3: os dois botões não aparecem. ℹ️ NÃO É BUG: "Cadastrar aluno" leva para a matrícula, porque o aluno nasce da matrícula (o doc 10 que diz "Secretaria cria aluno" está desatualizado). | rel. 04 #34 · rel. 01 #21 · consolidado §6 | P2 |
| ALU-17 | AL-4 (aluno do País QA, com tipo de documento preenchido) | ADM | 1) Abrir a ficha do AL-4 e anotar o tipo de documento<br>2) Configuração › Países › editar o País QA mudando só o nome (ex.: "País QA 2") e salvar<br>3) Reabrir a ficha do AL-4 | ⚠️ DECISÃO PENDENTE (R8): hoje o código apaga o tipo de documento de todos os alunos do país quando o país é editado (mesmo mudando só o nome); os docs não descrevem esse efeito (doc 10 §6 só prevê recriar a configuração). Registrar o observado, não abrir bug até o PO decidir. **Não execute este cenário com a Costa Rica ou o Panamá.** | R8 · rel. 04 #16 | P1 |
| ALU-18 | Modelo de importação de alunos | ADM | 1) Importar um arquivo .csv<br>2) Importar uma planilha sem a coluna País<br>3) Importar uma linha com país "Brasilia" e outra com gênero "X"<br>4) Importar duas vezes o mesmo arquivo válido | 1: "Não foi possível ler o arquivo. Use um .xlsx válido." 2: "Cabeçalho inválido…". 3: a linha de "Brasilia" volta com "País não reconhecido"; a de gênero "X" cria o aluno com gênero vazio. 4: os alunos ficam duplicados. ℹ️ NÃO É BUG: gênero inválido vira vazio e não há deduplicação na importação (regra atual). | rel. 04 #34, cenário 28 | P3 |

---

## Módulo 5. Financeiro

Pré-condições do módulo: AL-1 (CRC) e AL-2 (USD) com matrícula ativa e mensalidades geradas (MAT-20),
ambos de leads do VEND-A; AL-3 com matrícula Aguardando (MAT-17); limites do CFG-22. Cada cenário
usa uma **mensalidade diferente** do AL-1 (anote qual). O vendedor não tem Alunos no menu: para
abrir a ficha financeira de um aluno seu, copie com o ADM o endereço `/alunos/<id>/financeiro`
e abra logado como vendedor (ℹ️ não há outro caminho pela interface).

### 5.1 Cobranças e registro de pagamento

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| FIN-01 | Nenhuma | FIN | 1) Abrir Financeiro<br>2) Conferir as abas | Abas: Cobranças · Comissões · Descontos · Visão geral · Câmbio. Sem Aprovações (é do GC e do ADM). 🔎 GAP CONHECIDO (rel. 02 #67): o doc 09 pede uma aba "Inadimplência"; hoje os atrasados ficam no topo de Cobranças. Se não houver, abrir issue citando o item. | doc 09 §Financeiro | P2 |
| FIN-02 | Cobranças do AL-1 e AL-2 | FIN | 1) Aba Cobranças: conferir os cartões do topo<br>2) Buscar pelo nome e pelo código do aluno<br>3) Filtrar por país e por turma<br>4) Abrir uma cobrança › Ver ficha | Cartões: A vencer · Em atraso · Bloquear · Promessas · Recebido hoje. Busca e filtros reduzem a lista. "Ver ficha" abre a ficha financeira do aluno. | rel. 05 #18, #19 | P2 |
| FIN-03 | Mensalidade 2 do AL-1 Pendente | FIN | 1) Ficha financeira do AL-1 › Registrar pagamento na mensalidade 2<br>2) Valor = saldo total, forma Dinheiro, data de hoje → Registrar<br>3) Voltar à aba Cobranças | Status **Pago**; o tile "Último pagamento" mostra valor, data e forma; "Registrar pagamento" some dessa cobrança; "Recebido hoje" soma o valor em ₡. 🔎 GAP CONHECIDO (rel. 05 #5): o doc 09 diz que a cobrança paga mostra o selo "comprovante"; se não houver, abrir issue citando o item. | doc 09 §Registrar pagamento · rel. 05 #3 | P1 |
| FIN-04 | Mensalidade 3 do AL-1 Pendente | FIN | 1) Registrar pagamento de metade do valor (Dinheiro)<br>2) Abrir Registrar pagamento de novo e conferir o modal<br>3) Registrar o restante | 1: continua **Pendente**, com saldo. 2: o modal mostra o já recebido e o saldo restante. 3: **Pago**; o primeiro pagamento não foi sobrescrito. | rel. 05 #3 · rel. 03 regra #25 | P1 |
| FIN-05 | Mensalidade 4 do AL-1 Pendente | FIN | 1) Registrar valor **acima** do saldo sem marcar "registrar excedente como crédito"<br>2) Repetir marcando a opção | 1: erro, nada muda. 2: aceito e a cobrança fica Paga. | rel. 05 #3 · rel. 03 cenário 8 | P2 |
| FIN-06 | Mensalidade 5 do AL-1 Pendente; um PDF e um .docx à mão | FIN | 1) Forma Transferência sem anexo → Registrar<br>2) GreenPay sem anexo → Registrar<br>3) Transferência anexando o .docx<br>4) Transferência anexando o PDF → Registrar | 1 e 2: bloqueado pedindo comprovante. 3: "Tipo inválido (use PDF, JPG ou PNG)." 4: aceito, Pago. (Cartão e Dinheiro não exigem anexo.) | doc 09 §Registrar pagamento · rel. 05 #5 | P1 |
| FIN-07 | Mensalidade 6 do AL-1 Pendente | SEC | 1) Abrir Alunos › AL-1 › Ver ficha financeira<br>2) Registrar pagamento (Dinheiro, valor total)<br>3) Procurar o botão Renegociar<br>4) Digitar `/financeiro` | 2: aceito, Pago. 3: não existe. 4: ⚠️ DECISÃO PENDENTE (R7): hoje o código nega o acesso da Secretaria ao Financeiro; os docs (doc 09 §Cobranças, visão por papel) dizem que a Secretaria vê as cobranças e registra pagamento lá. Registrar o observado, não abrir bug até o PO decidir. | R7 · rel. 05 #41 | P1 |
| FIN-08 | Mensalidade 7 do AL-1 Pendente | FIN | 1) Renegociar a mensalidade 7 mudando só o vencimento para **ontem** (motivo "QA atraso")<br>2) Conferir a fila e a ficha financeira | Na fila, a cobrança aparece em "Em atraso" (chip do degrau com "há 1d"). Na ficha, o tile "Em atraso" fica destacado. ℹ️ NÃO É BUG: a coluna Status continua "Pendente" para cobrança vencida; o atraso é calculado pela data (consolidado §5). | §5 · rel. 05 #2 | P2 |

### 5.2 Renegociação e desconto

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| FIN-09 | VEND-A com limite 10%; mensalidade 8 do AL-1 | VEND-A | 1) Ficha financeira do AL-1 › Renegociar a mensalidade 8<br>2) Tipo Desconto, novo valor = valor − 8%, vigência "Apenas esta cobrança", motivo → confirmar | Aplicado na hora. O modal mostrou "Desconto concedido: …". O histórico de negociação registra de → para, motivo e autor VEND-A. | doc 09 §Renegociação · rel. 05 cenário 14 | P1 |
| FIN-10 | Mensalidade 9 do AL-1 | VEND-A | 1) Renegociar com Desconto de 15%, motivo → confirmar<br>2) Conferir o valor da cobrança | 1: mensagem de que o pedido foi enviado para aprovação. 2: o valor **não** muda. | doc 09 §Renegociação · rel. 05 cenário 15 | P1 |
| FIN-11 | VEND-0 (limite vazio); aluno de lead do VEND-0 (converter um lead dele no Módulo 3 ou usar AL de um lead dele) | VEND-0 | 1) Renegociar com Desconto de 1% | Vai para aprovação; o valor não muda. ℹ️ NÃO É BUG: vendedor com limite vazio não tem autonomia de desconto (o doc só define limite vazio para o Admin). | rel. 01 #16 · rel. 05 #25 | P2 |
| FIN-12 | Mensalidade 10 do AL-1 | VEND-A | 1) Tipo **Desconto** com novo valor **maior** que o atual → confirmar | Recusado com "Este ajuste não pode aumentar o valor". | rel. 03 cenário 12 | P2 |
| FIN-13 | Mensalidade 10 do AL-1 | VEND-A | 1) Tipo **Alteração de valor** com novo valor **maior** que o atual, motivo → confirmar | ⚠️ DECISÃO PENDENTE (R2): hoje o código aplica o aumento direto, sem aprovação; os docs (doc 09 §Renegociação; doc 10 §2) dizem que o vendedor só dá desconto até o limite (doc 10: vendedor não altera cobrança). Registrar o observado, não abrir bug até o PO decidir. | R2 · rel. 05 #24 | P1 |
| FIN-14 | Mensalidade 11 do AL-1 | VEND-A | 1) Tipo Renegociação mantendo o valor e mudando só o vencimento para 20 dias depois, motivo → confirmar<br>2) Ver a régua da cobrança na fila | ⚠️ DECISÃO PENDENTE (R2): hoje o código adia o vencimento direto, sem aprovação; os docs (doc 09 §Renegociação; doc 10 §2) dizem que o vendedor só dá desconto até o limite. Registrar o observado, não abrir bug até o PO decidir. ℹ️ NÃO É BUG: com vencimento novo, os passos da régua dessa cobrança recomeçam. | R2 · rel. 05 #24, cenário 20 | P1 |
| FIN-15 | Mensalidade 12 do AL-1 | FIN | 1) Renegociar com Desconto de 40%, motivo → confirmar | Aplicado na hora, sem aprovação (Financeiro não tem limite). | doc 09 §Renegociação · rel. 01 #22 | P2 |
| FIN-16 | AL-3 com a taxa Pendente e comissão Pendente; uma mensalidade Pendente do AL-2 | FIN, ADM | 1) FIN abre Renegociar e procura o tipo "Perdão"<br>2) ADM: Renegociar a mensalidade do AL-2 › Perdão, motivo → confirmar<br>3) ADM: Perdão na taxa do AL-3 → conferir a comissão | 1: a opção Perdão não existe para o FIN. 2: cobrança **Cancelada** com valor 0; "Registrar pagamento" some. 3: taxa Cancelada e comissão recalculada para 0. | doc 09 §Renegociação · rel. 05 #31 · rel. 03 cenário 13 | P1 |

### 5.3 Aprovação de desconto (Gerente Comercial e Administrador)

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| FIN-17 | Pedido do FIN-10 pendente | GC, VEND-A | 1) GC abre Financeiro › Aprovações<br>2) Conferir o pedido e o resumo do topo<br>3) VEND-A confere que não tem acesso à aba | 1: a aba mostra o contador de pendentes. 2: aluno, de → para, vigência, solicitante e motivo; resumo com pendentes, impacto mensal e impacto anual. 3: o VEND-A nem entra no Financeiro. | doc 09 §Aprovações · rel. 05 #26 | P1 |
| FIN-18 | Pedido do FIN-10 | GC | 1) Aprovar<br>2) Abrir a ficha financeira do AL-1<br>3) Abrir Financeiro › Descontos | 2: a mensalidade 9 está com o valor novo; o histórico de negociação mostra o ajuste com o motivo original. 3: o desconto aparece somado por moeda e por vendedor. | doc 09 §Aprovações · rel. 05 cenário 16 | P1 |
| FIN-19 | Novo pedido acima do limite do VEND-A (repetir o FIN-10 em outra mensalidade) | GC | 1) Rejeitar o pedido<br>2) Conferir a cobrança | A cobrança fica igual. 🔎 GAP CONHECIDO (rel. 05 #26): o doc 09 diz "Rejeitado → volta com o motivo"; hoje a rejeição não pede nem registra motivo. Se não pedir motivo, abrir issue citando o item. | doc 09 §Aprovações · rel. 05 #26 | P2 |
| FIN-20 | GC (puro) | GC | 1) Abrir a ficha financeira do AL-1<br>2) Procurar o botão Renegociar | ⚠️ DECISÃO PENDENTE (R4): hoje o código não dá ao Gerente Comercial puro nenhum jeito de conceder desconto ou renegociar (ele só aprova); os docs (doc 07, exemplo "Gerente Comercial 20%") dão limite próprio ao GC. Registrar o observado, não abrir bug até o PO decidir. | R4 · rel. 01 #17 | P1 |
| FIN-21 | GC+V (limite 15%); aluno de um lead do GC+V | GC+V | 1) Pedir Desconto de 20% numa mensalidade do aluno<br>2) Ir em Financeiro › Aprovações e aprovar o próprio pedido | ⚠️ DECISÃO PENDENTE (R3): hoje o código deixa o Gerente Comercial aprovar o próprio pedido; os docs (doc 07) dizem que o GC aprova os pedidos do vendedor (sem prever auto-aprovação). Registrar o observado, não abrir bug até o PO decidir. | R3 · rel. 01 #19 | P1 |
| FIN-22 | Uma mensalidade Pendente do AL-1 ou do AL-2 | VEND-A, FIN, GC | 1) VEND-A pede Desconto de 15% (vai para aprovação)<br>2) FIN registra o pagamento integral dessa cobrança<br>3) GC aprova o pedido<br>4) Conferir a cobrança na ficha financeira | ⚠️ DECISÃO PENDENTE (R6): hoje o código aplica a aprovação mesmo com a cobrança já Paga e reescreve o valor negociado (fica menor que o recebido); os docs tratam a cobrança paga como encerrada (implícito no doc 10 §1). Registrar o observado, não abrir bug até o PO decidir. | R6 · rel. 05 #33 | P1 |
| FIN-23 | Duas mensalidades Pendentes de alunos diferentes | FIN | 1) Desconto de 10% com vigência "Próximos meses" num aluno<br>2) Desconto de 10% com vigência "Contrato inteiro" no outro<br>3) Comparar quais cobranças mudaram em cada um<br>4) Como VEND-A, pedir um desconto acima do limite com vigência "Apenas esta cobrança" e, como GC, ver o impacto anual na aba Aprovações | 3: ⚠️ DECISÃO PENDENTE (R13): hoje o código trata "Próximos meses" e "Contrato inteiro" do mesmo jeito (esta e todas as futuras não pagas) e não pede o número de meses; os docs (doc 09 e doc 11) definem "próximos N meses". 4: ⚠️ DECISÃO PENDENTE (R13): hoje o impacto anual é sempre o mensal × 12, sem olhar a vigência; os docs (doc 09 §Aprovações) esperam o impacto real da vigência. Registrar o observado, não abrir bug até o PO decidir. | R13 · rel. 05 #29, #30 | P2 |

### 5.4 Comissões e fechamento do mês

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| FIN-24 | AL-1 ativo (comissão Aprovada); uma matrícula Aguardando com taxa ainda pendente (ex.: a do MAT-05) | FIN, GC | 1) FIN abre Financeiro › Comissões<br>2) Conferir status e o total "A pagar"<br>3) Clicar em "Fechar mês e marcar pagas"<br>4) Clicar de novo<br>5) GC abre a aba Comissões | 2: comissão do AL-1 **Aprovada**; a da matrícula Aguardando **Pendente**; "A pagar" somado por moeda. 3: todas as aprovadas viram **Pagas**. 4: "Nenhuma comissão aprovada para pagar". 5: o GC vê a lista, sem o botão de fechar. ℹ️ NÃO É BUG: o fechamento paga todas as aprovadas, sem filtro de período. | doc 09 §Comissões · rel. 05 #35, cenário 24 | P1 |

### 5.5 Régua de cobrança, promessa e bloqueio de acesso

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| FIN-25 | Duas mensalidades Pendentes: uma com vencimento ajustado (pelo FIN) para daqui a 7 dias e outra para 5 dias atrás, sem nenhum envio | FIN | 1) Na fila, conferir o chip das duas<br>2) Abrir a de 7 dias › "Abrir no wa.me (manual)" e fechar a aba do WhatsApp<br>3) Conferir o detalhe dessa cobrança | 1: a de 7 dias mostra D-7 "lembrar"; a de 5 dias atrás mostra a ação D+3 marcada "há 5d" (não D-7, D-3 nem D0). 2-3: aparece "Envio manual registrado"; a linha do tempo marca o D-7 como feito e o contador de cobranças sobe. | rel. 05 #8, #9, cenários 8-9 | P2 |
| FIN-26 | Mensalidade Pendente do AL-2 | FIN | 1) Registrar promessa de pagamento para daqui a 3 dias<br>2) Tentar promessa com data passada<br>3) Tentar promessa numa cobrança já Paga | 1: o item vai para o cartão "Promessas", com chip de promessa e a data; sai de A vencer e Em atraso. 2: erro. 3: opção indisponível ou erro. | rel. 05 #10 | P2 |
| FIN-27 | Dois itens com ação devida e destino (telefone) na fila | FIN | 1) Marcar os dois e clicar em "Aprovar e enviar lote"<br>2) Procurar um aluno Kids sem telefone de responsável (se houver) | 1: aparece a contagem do lote; o resultado é simulado. ℹ️ NÃO É BUG: no modo simulado nada é enviado de verdade. 2: a linha mostra "sem destino", sem caixa de seleção para o lote. | rel. 05 #16, cenários 12-13 | P3 |
| FIN-28 | Uma mensalidade com vencimento ajustado para 16 dias atrás, sem promessa | FIN, GC | 1) FIN confere o cartão "Bloquear" e o detalhe da cobrança<br>2) GC abre a mesma cobrança e clica em Bloquear acesso<br>3) Abrir a ficha financeira do aluno<br>4) GC clica em Desbloquear | 1: o cartão conta a cobrança; o FIN vê "aguarda gerente" (não bloqueia). 2: selo "acesso bloqueado" na fila. 3: "Acesso bloqueado" na ficha. 4: o selo some. ℹ️ NÃO É BUG: o critério de "Bloquear" é fixo em 15 dias de atraso, mesmo que a política use outro prazo (consolidado §5). | §5 · rel. 05 #11, #12 | P1 |

### 5.6 Multimoeda, câmbio e visão geral

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| FIN-29 | Cobranças em CRC (AL-1) e USD (AL-2); um pagamento **parcial** registrado hoje | FIN | 1) Abrir Visão geral e conferir os KPIs<br>2) Comparar "Recebido hoje" (fila) com "Recebido no mês" (Visão geral) | 1: uma linha por moeda, nunca um total somando moedas; CRC sem centavos, USD com 2 casas. 2: 🔎 GAP CONHECIDO (rel. 05 #40): os dois deveriam bater no mesmo dia; hoje o parcial entra em "Recebido hoje" e não em "Recebido no mês". Se divergirem, abrir issue citando o item. | doc 09 §Multi-moeda · rel. 05 #39, #40 | P2 |
| FIN-30 | Nenhuma | FIN | 1) Aba Câmbio: cadastrar CRC = 512 e salvar<br>2) Tentar cadastrar uma taxa para USD<br>3) Visão geral › Consolidar em USD | 1: cotação salva com a data. 2: recusado (USD é a moeda pivô). 3: totais com "≈" em USD; moeda sem cotação aparece em "faltam taxas: …". | doc 09 §Multi-moeda · rel. 05 #38 | P3 |

---

## Módulo 6. Permissões transversais

Faça este módulo com a massa já criada. Para cada papel, digite as URLs na barra de endereço. Use
os ids reais anotados nos módulos anteriores (`<id>` de um lead do VEND-A, do AL-1 e da QA-T-A1).

**Matriz de referência (o que o código faz hoje).** ✅ abre · ❌ acesso negado (página
`/acesso-negado` ou aviso na própria URL) · 404 = "não encontrado" · ⚠️ = abre, mas é decisão
pendente R5 ou R7.

| URL | ADM | GC | VEND | GP | PROF | FIN | SEC |
|---|---|---|---|---|---|---|---|
| `/pipeline`, `/leads` | ✅ todos | ✅ todos | ✅ só os seus | ⚠️ R5 abre vazio | ⚠️ R5 abre vazio | ⚠️ R5 abre vazio | ⚠️ R5 abre vazio |
| `/leads/<id do VEND-A>` | ✅ | ✅ | ✅ dono · 404 outro vendedor | 404 | 404 | 404 | 404 |
| `/matriculas/nova` | ✅ dois botões | ✅ só Salvar | ✅ só Salvar | ⚠️ R5 abre sem botões | ⚠️ R5 abre sem botões | ⚠️ R5 abre sem botões | ⚠️ R5 abre sem botões |
| `/inbox` | ✅ todos os números | ✅ números de vendas | ✅ números próprios | ❌ | ❌ | ✅ números de cobrança | ✅ números de cobrança |
| `/alunos`, `/alunos/<id>` | ✅ | ❌ | ❌ | ✅ | ✅ só suas turmas (404 nas outras) | ✅ | ✅ |
| `/alunos/<id>/financeiro` | ✅ | ✅ leitura | ✅ só alunos seus | ❌ | ❌ | ✅ | ✅ registra pagamento |
| `/financeiro` | ✅ | ✅ leitura + Aprovações | ❌ | ❌ | ❌ | ✅ | ⚠️ R7 ❌ |
| `/configuracao/paises`, `/configuracao/catalogo` | ✅ | ⚠️ R5 | ⚠️ R5 | ⚠️ R5 | ⚠️ R5 | ⚠️ R5 | ⚠️ R5 |
| `/configuracao/turmas` | ✅ | ⚠️ R5 | ⚠️ R5 | ✅ edita | ⚠️ R5 | ⚠️ R5 | ⚠️ R5 |
| `/configuracao/usuarios` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/configuracao/whatsapp` | ✅ tudo | ✅ só Comercial e Réguas | ❌ | ❌ | ❌ | ❌ | ❌ |

Texto padrão do R5 para registrar: ⚠️ DECISÃO PENDENTE (R5): hoje o código deixa qualquer usuário
logado abrir essas páginas pela URL e ler os dados (inclusive preços de referência); só o salvar é
bloqueado. Os docs (doc 09 §Configuração) dizem que Configuração é do Admin (Turmas: Admin e GP).
Registrar o observado, não abrir bug até o PO decidir.

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| PER-01 | Massa dos módulos 1 a 5 | ADM | 1) Abrir todas as URLs da matriz | Todas abrem com dados. | rel. 01 #3 | P2 |
| PER-02 | ADM logado | ADM | 1) Conferir que existem: Perdão na renegociação, "Receber pagamento e ativar", Importar alunos/turmas, Números/Templates/Política no WhatsApp, Aprovações e Câmbio no Financeiro | Todas as ações existem e funcionam (já exercitadas nos módulos anteriores). | rel. 01 matriz | P2 |
| PER-03 | Massa criada | GC | 1) Abrir as URLs da coluna GC<br>2) Em `/configuracao/catalogo`, tentar salvar uma alteração | Resultado igual à coluna GC da matriz. Em `/alunos`: acesso negado. Passo 2: erro de permissão. Para as linhas ⚠️: ⚠️ DECISÃO PENDENTE (R5): hoje o código deixa o GC abrir Países, Catálogo e Turmas pela URL e ler os dados; os docs (doc 09 §Configuração) dizem que essas áreas são do Admin (Turmas: Admin e GP). Registrar o observado, não abrir bug até o PO decidir. | R5 · rel. 01 #29 | P1 |
| PER-04 | GC logado | GC | 1) No Financeiro, procurar Registrar pagamento, Enviar cobrança e Promessa<br>2) Procurar Fechar mês em Comissões<br>3) Procurar Bloquear acesso numa cobrança com 15+ dias de atraso | 1: não aparecem (GC é só leitura nas cobranças). 2: não aparece. 3: aparece (o GC bloqueia e desbloqueia). | doc 09 §Cobranças visão por papel · rel. 05 cenário 6 | P1 |
| PER-05 | Massa criada | VEND-A | 1) Abrir as URLs da coluna VEND<br>2) Abrir a ficha financeira de um aluno de lead do VEND-B | Resultado igual à coluna VEND da matriz (`/alunos` e `/financeiro` negados). Passo 2: acesso negado ou não encontrado. Para as linhas ⚠️: ⚠️ DECISÃO PENDENTE (R5): hoje o código deixa o vendedor abrir Países, Catálogo e Turmas pela URL e ver preços de referência; os docs (doc 09 §Configuração) dizem que essas áreas são do Admin. Registrar o observado, não abrir bug até o PO decidir. | R5 · rel. 01 #29 | P1 |
| PER-06 | VEND-A logado | VEND-A | 1) Procurar o check-in de experimental<br>2) Procurar Perdão, Aprovar desconto e Registrar pagamento na ficha financeira de um aluno seu | 1: não existe para o vendedor. 2: nenhuma dessas ações aparece; só Renegociar. | rel. 01 matriz | P1 |
| PER-07 | Massa criada | GP | 1) Abrir as URLs da coluna GP<br>2) Abrir a ficha do AL-1 e olhar o bloco financeiro | 1: igual à coluna GP; `/financeiro` e `/alunos/<id>/financeiro` negados. Para Pipeline, Leads, Matrícula, Países e Catálogo: ⚠️ DECISÃO PENDENTE (R5): hoje o código abre essas páginas para o GP (vazias ou sem botões); os docs (doc 09 §Configuração e §Acesso) restringem o GP a Turmas e Alunos. Registrar o observado, não abrir bug até o PO decidir. 2: ℹ️ o doc 09 marca como proposta que o GP veja só "em dia / atrasado", sem valores; registrar se aparecem valores (a auditoria indica que sim). | R5 · rel. 01 #8, #28 | P1 |
| PER-08 | GP logado | GP | 1) Na ficha do AL-1, conferir os botões de movimentação<br>2) Em Turmas, conferir Nova turma e Editar | 1: Trocar turma, Pausar e Encerrar aparecem. 2: aparecem e funcionam (exercitados no Módulo 1). | rel. 01 #26 | P2 |
| PER-09 | Massa criada | PROF | 1) Abrir as URLs da coluna PROF<br>2) Abrir `/alunos/<id>` de um aluno fora das turmas dele | 1: igual à coluna PROF; `/inbox`, `/financeiro` e ficha financeira negados. Para Pipeline, Leads, Matrícula e Configuração: ⚠️ DECISÃO PENDENTE (R5): hoje o código abre essas páginas para o professor (Configuração com dados e preços; Pipeline e Leads vazios); os docs (doc 09 §Visão do Professor: "sem configuração") dizem que não. Registrar o observado, não abrir bug até o PO decidir. 2: 404. | R5 · rel. 01 #28, #29 | P1 |
| PER-10 | PROF logado | PROF | 1) Na ficha de um aluno dele, procurar botões de movimentação e o bloco financeiro<br>2) Procurar check-in de uma experimental não atribuída a ele | 1: nada disso aparece. 2: não aparece na Home dele. | doc 09 §Visão do Professor · rel. 01 #27 | P1 |
| PER-11 | Massa criada | FIN | 1) Abrir as URLs da coluna FIN<br>2) Em `/matriculas/nova`, conferir os botões | 1: igual à coluna FIN. Para Pipeline, Leads, Países, Catálogo e Turmas: ⚠️ DECISÃO PENDENTE (R5): hoje o código abre essas páginas para o Financeiro; os docs (doc 09 §Configuração) dizem que são do Admin e do comercial. Registrar o observado, não abrir bug até o PO decidir. 2: a página abre sem nenhum botão de salvar. | R5 · rel. 01 #28 | P1 |
| PER-12 | FIN logado | FIN | 1) Na ficha do AL-1, procurar Trocar turma, Pausar e Encerrar<br>2) No Financeiro, procurar Bloquear acesso | 1: não aparecem (Financeiro não faz movimentação acadêmica). 2: aparece "aguarda gerente", sem botão de bloquear. | rel. 01 #22, #41 | P2 |
| PER-13 | Massa criada | SEC | 1) Abrir as URLs da coluna SEC | Igual à coluna SEC. `/financeiro`: ⚠️ DECISÃO PENDENTE (R7): hoje o código nega o acesso; os docs (doc 09 §Cobranças) dizem que a Secretaria vê e registra pagamento no Financeiro. Para Pipeline, Leads, Matrícula e Configuração: ⚠️ DECISÃO PENDENTE (R5): hoje o código abre essas páginas pela URL; os docs (doc 09 §Configuração) dizem que são do Admin e do comercial. Registrar o observado, não abrir bug até o PO decidir. | R5 · R7 · rel. 01 #28 | P1 |
| PER-14 | SEC logado | SEC | 1) Na ficha financeira do AL-1, procurar Renegociar e Perdão<br>2) Na ficha do aluno, conferir Trocar turma, Pausar, Encerrar e Editar dados | 1: não aparecem (Secretaria registra pagamento e promessa, mas não renegocia). 2: aparecem. | doc 09 §Renegociação visão por papel · rel. 01 #20 | P2 |

---

## Módulo 7. Home por papel

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| HOM-01 | VEND-A com leads | VEND-A | 1) Abrir a Home | Saudação e 4 cartões: Leads novos (vermelho), Follow-ups vencidos (âmbar), Experimentais hoje (azul), Comissão prevista (verde, por moeda). No cabeçalho, o percentual de SLA e "Leads atrasados". ℹ️ NÃO É BUG: o percentual é a fatia dos leads abertos que já saíram de Novo, não um número "do dia". | doc 09 §Home do Vendedor · rel. 02 #5, #6 | P2 |
| HOM-02 | Lead do VEND-A em Novo criado há mais de 60 min | VEND-A | 1) Abrir a Home | "Leads atrasados: 1" (ou mais); cartão Leads novos conta o lead; a fila mostra 🔥 "Lead novo sem 1º contato" e o lead aparece em "Oportunidades de hoje" com "Prioridade Alta" e o botão Atender. | doc 09 §Regras de priorização · rel. 02 cenário 1 | P1 |
| HOM-03 | Lead em 1º Contato com próximo follow-up = ontem | VEND-A | 1) Abrir a Home<br>2) Na ficha, mudar o follow-up para amanhã e voltar à Home | 1: aparece com ⚠️ "Follow-up vencido" e conta no cartão Follow-ups vencidos. 2: some dos dois. | doc 09 §Regras de priorização · rel. 02 cenário 2 | P1 |
| HOM-04 | Lead em Exp. Agendada para hoje (não Novo, sem follow-up vencido) | VEND-A | 1) Abrir a Home | O lead aparece em "Agenda de hoje" com a hora, conta no cartão Experimentais hoje e aparece na fila como "Experimental hoje". ℹ️ NÃO É BUG: cada lead entra em uma faixa só (Novo tem prioridade sobre follow-up, que tem prioridade sobre experimental). | doc 09 §Agenda de hoje · rel. 02 #10, cenário 3 | P2 |
| HOM-05 | Um lead em Proposta com data da proposta há 6 dias e outro há 4 dias | VEND-A | 1) Abrir a Home | O de 6 dias aparece como 💰 "Proposta parada"; o de 4 dias não. | doc 09 §Regras de priorização · rel. 02 cenário 4 | P2 |
| HOM-06 | Fila do VEND-A com itens de faixas diferentes | VEND-A | 1) Clicar em "Próximo lead →" | Abre a ficha do primeiro item da fila (🔥 antes de ⚠️, antes de 📅, antes de 💰). | rel. 02 #9, cenário 6 | P2 |
| HOM-07 | VEND-0 sem nenhum lead pendente | VEND-0 | 1) Abrir a Home | A fila mostra "Tudo em dia" e o bloco "Oportunidades de hoje" não aparece. 🔎 GAP CONHECIDO (rel. 02 #14): o doc 09 pede também um atalho para prospectar ou ver o pipeline; se não houver, abrir issue citando o item. | doc 09 §Estado vazio | P3 |
| HOM-08 | VEND-A salvou matrícula no mês (Módulo 3) | VEND-A | 1) Conferir o cartão "Meta do mês" | Barra "X de 20 matrículas". ℹ️ NÃO É BUG: a meta é fixa em 20 e o contador sobe ao **salvar** a matrícula, não ao ativar. | doc 09 §Meta do mês · rel. 02 #13 | P3 |
| HOM-09 | Leads e matrículas do ciclo | GC, GC+V | 1) GC abre a Home<br>2) GC+V abre a Home | 1: KPIs Leads hoje, Conversão, Matrículas no mês e Recebido no mês; ranking de vendedores; funil com as etapas; equipe com os nomes. ℹ️ NÃO É BUG: a conversão é acumulada (todos os leads), o ranking conta leads matriculados e não há KPI de SLA separado (só o alerta). 2: a GC+V vê a Home do Gerente, não a do Vendedor. | doc 09 §Home do Gerente · rel. 02 #15-18 · rel. 01 #38 | P2 |
| HOM-10 | Lead em Novo há mais de 60 min | GC | 1) Abrir a Home e conferir o alerta de SLA<br>2) Mover o lead para 1º Contato e voltar à Home | 1: banner "Alertas de SLA: N". 2: o número cai; com 0, o banner some. | doc 09 §Home do Gerente · rel. 02 cenário 7 | P2 |
| HOM-11 | Experimental atribuída ao PROF para hoje; PROF com turmas | PROF | 1) Abrir a Home | Destaque da próxima experimental, lista de check-in (Compareceu / Faltou) e "Minhas turmas" com horário e número de alunos. 🔎 GAP CONHECIDO (rel. 02 #19): o doc 09 pede também a agenda de Hoje/Amanhã das aulas regulares; se não houver, abrir issue citando o item. | doc 09 §Home do Professor | P1 |
| HOM-12 | FIN, SEC e GP | FIN, SEC, GP | 1) Cada um abre a Home | Home genérica: saudação e atalhos para os itens do menu do papel. | doc 09 §Em aberto · rel. 02 #20 | P3 |

---

## Fora do escopo deste ciclo

Não criar cenário, não testar e **não abrir bug** pela ausência destes itens. São funcionalidades
descritas nos docs que não existem no código (consolidado §4), ou que dependem de WhatsApp real.

**Não implementado (consolidado §4):**

- Notificações (lead novo, desconto aprovado, cobrança vencida, comissão aprovada).
- Busca global.
- Motor de risco de cobrança (doc 25 é só desenho).
- Estorno de comissão, cancelamento e encerramento de **matrícula** (status Estornada, Cancelada,
  Encerrada e Rascunho nunca são gravados). Encerrar **aluno** existe e está no Módulo 4.
- Regra dos 90 dias de posse do lead.
- Pipeline B2B com etapas próprias (o seletor B2B do Kanban só filtra; isso está no CRM-18).
- IA copiloto (resumo, temperatura e sugestões automáticas); o sistema só reconhece palavras exatas.
- Progressão de nível A1 → A2 (hoje só existe a troca manual de turma).
- Rematrícula reaproveitando o cadastro do ex-aluno (hoje gera aluno duplicado).
- Moeda USD na matrícula fora de país dolarizado.
- Bloqueio de aluno novo em país pausado, rascunho ou encerrado.
- Edição dos dados do lead pela ficha e transferência de dono do lead pela interface (o
  "Histórico de dono" só mostra a atribuição inicial).
- Filtros do Kanban por vendedor, segmento, temperatura e período.
- Histórico de movimentações registrando a própria matrícula (a ficha nova mostra "Sem
  movimentações").
- Cargas Q10 (docs 19 a 23). Os importadores XLSX de alunos e turmas existem e estão no roteiro.
- Integrações de pagamento e contrato (DocuSign, gateway, conferência de comprovante).

**Também ausentes segundo os relatórios da auditoria (não testar):**

- Troca de senha pelo próprio usuário (só o Admin redefine).
- Estorno ou reabertura de pagamento registrado; cancelamento avulso de cobrança (use Perdão,
  que é do Admin).
- Aprovador nomeado no modal de renegociação ("Será enviado para: …") e aprovações nas
  pendências da Home do gerente.
- Data prevista de pagamento da comissão; ação "Pular" degrau da régua; progresso "N de M feitas
  hoje" da fila de cobrança.
- Alerta de 90 dias para aluno pausado.
- Modo Foco sequencial e contagem regressiva da próxima experimental na Home do vendedor.
- Área de documentos na ficha do aluno (documentos só existem na ficha do lead e no pagamento).
- Ajuste de cobrança de aluno fora do escopo do vendedor (R2, segunda parte): só é explorável fora
  da interface, não faz parte do teste manual.

**Depende de WhatsApp real, Meta ou Evolution (fora do modo simulado):**

- Envio real de texto, template ou mídia e os status Enviada, Entregue, Lida e Falhou.
- Confirmação da experimental por "SIM" (em modo simulado nunca confirma; ver CRM-34).
- Marcação "auto" nas mensagens da conversa; conectar número por QR e alerta de sessão caída.
- Submeter e sincronizar templates com a Meta; referral de anúncio click-to-WhatsApp; janela de
  24 h do número oficial.

---

## Checklist de fim de ciclo

Entregue ao PO, no fim de cada ciclo:

- [ ] **Planilha de resultados** com uma linha por cenário e as colunas: ID · Resultado (Passou,
  Falhou, Bloqueado, Não aplicável) · Data · Testador · Usuário/papel usado · Evidência (link do
  print) · Nº da issue · R# (se for decisão pendente) · Observação (o que foi visto).
- [ ] **Issues abertas** no GitHub (template "Bug"), uma por falha, com o ID do cenário no título e a
  referência da auditoria quando houver. Listar os números na planilha.
- [ ] **Lista de decisões pendentes** separada: para cada cenário ⚠️, o R#, o que foi observado e se
  bateu com o "hoje o código faz" descrito. Esta lista vai para o PO decidir; não vira bug.
- [ ] **Bloqueios**: cenários marcados Bloqueado, agrupados por motivo (B1, B2, B3, falta de apoio
  [DEV], massa de dados faltando).
- [ ] **Resumo de 1 página**: total de cenários por módulo e por resultado; P1 que falharam; os 3
  maiores riscos vistos no ciclo; o que precisa ser retestado no próximo ciclo.
- [ ] **Limpeza do ambiente**: reativar usuários desativados nos testes, kill switch desligado,
  políticas e réguas de volta para Desligada, auto-lead desligado.
- [ ] **Retestes**: para cada issue corrigida no ciclo anterior, reexecutar o cenário de origem e
  atualizar a planilha.
