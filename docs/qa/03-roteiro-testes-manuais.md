# Roteiro de testes manuais: UAT v1

> Roteiro para o QA executar **pela interface do UAT**, na ordem real de uso do ERP Genius:
> configurar, preparar a parte acadêmica, captar, atender, matricular, acompanhar o aluno, dar
> aula, avaliar, cobrar e, por fim, conferir permissões e a Home.
>
> Base: auditoria código × docs de 2026-10-21 sobre o commit `9e3d1d3c`
> ([`auditoria-consolidada.md`](auditoria-consolidada.md) e os relatórios 01 a 09 em
> [`auditoria/`](auditoria/)). Este arquivo substitui o roteiro de agosto (commit `bc858aff`), que
> descrevia telas removidas (Leads, Pipeline, ficha do lead, movimentações na ficha do aluno).
> Não use o roteiro antigo nem os docs 09, 10, 11, 12, 16, 26 e 27 como resultado esperado
> (consolidado §7).

## Como usar este roteiro

**Um ciclo = executar os módulos 0 a 11 na ordem, do primeiro ao último cenário.** A ordem importa:
cada módulo cria dados que os seguintes usam (seção "Massa de dados do ciclo"). Para repetir um
cenário isolado, confira antes a coluna "Pré-condição".

**Para cada cenário, registre na planilha de resultados um destes resultados:**

| Resultado | Quando usar |
|---|---|
| **Passou** | O sistema fez exatamente o que está em "Resultado esperado". |
| **Falhou → issue** | O sistema fez outra coisa. Abra a issue antes de seguir e anote o número dela na planilha. |
| **Bloqueado** | Não deu para executar: pré-condição faltando, tela quebrada antes do passo ou bloqueador 🛑 B#. Anote o motivo (ex.: "Bloqueado B2"). |
| **Não aplicável** | O cenário não se aplica a este ciclo (ex.: o PO tirou o fluxo legado do ciclo, R1). Anote o motivo. |

**Marcadores usados na coluna "Resultado esperado":**

| Marcador | O que significa | O que fazer |
|---|---|---|
| ⚠️ **DECISÃO PENDENTE (R#)** | Código e docs dizem coisas diferentes e o PO ainda não decidiu (consolidado §4). Às vezes aparece com "rel. 0N #x": é uma decisão levantada num relatório que ainda não entrou na lista R. | Executar, **registrar o observado** na coluna Observação e anotar o R# (ou o rel.). **Não abrir bug.** No fim do ciclo esses cenários vão para a lista do PO. |
| 🛑 **BLOQUEADOR (B#)** | Problema conhecido que impede o fluxo (consolidado §2). | Se acontecer o descrito, marcar **Bloqueado (B#)**. Não abrir bug novo. Se o DEV já resolveu o B#, executar o cenário normalmente. |
| 🐞 **BUG PROVÁVEL (X#)** | A auditoria leu no código um defeito que o QA precisa confirmar (consolidado §3). Às vezes aparece com "rel. 0N #x": defeito apontado num relatório e ainda fora da lista X. | Executar. Se acontecer o defeito, marcar **Falhou** e abrir issue citando o X# (ou o rel.) no título. Se não acontecer, marcar **Passou** e anotar "X# não reproduz". |
| ℹ️ **NÃO É BUG** | Parece estranho, mas é a regra atual (consolidado §5 e §6). | Conferir que acontece como descrito. Só é falha se acontecer outra coisa. |
| **[DEV]** | O cenário precisa de um passo fora da interface (banco, variável, cron, fixture, mensagem recebida simulada). | Pedir o passo ao DEV de plantão antes de executar. Sem apoio, marcar **Bloqueado ([DEV])**. |
| **[MOB]** | Repetir o cenário no celular (ou no navegador em 375 × 812, modo dispositivo do DevTools). | Registrar o resultado do celular na mesma linha, com "MOB:" na observação. |
| ⏭ (na Pré-condição) | O cenário depende de algo que só existe mais adiante no ciclo. | Pular e voltar a ele quando a pré-condição existir. Anotar "adiado" até lá. |

**Convenção de IDs:** `MÓDULO-NN`, com numeração contínua dentro do módulo.

| Prefixo | Módulo |
|---|---|
| `ACE` | 0. Login, sessão, menu por papel e acesso negado |
| `CFG` | 1. Configuração |
| `ACD-PREP` | 2. Preparação acadêmica |
| `CRM` | 3. CRM e Aria |
| `INB` | 4. Inbox, WhatsApp simulado e avisos |
| `MAT` | 5. Entrada comercial, matrícula, contrato e Secretaria |
| `ALU` | 6. Alunos, portal do aluno, certificado e empresas |
| `DIA` | 7. Diário de aulas e reposições |
| `AVA` | 8. Avaliações |
| `FIN` | 9. Financeiro |
| `PER` | 10. Permissões transversais |
| `HOM` | 11. Home por papel e interface |

**Coluna Ref:** `B#`, `X#` e `R#` são itens do [consolidado](auditoria-consolidada.md); `§5`, `§6`,
`§7` são seções dele. `rel. 0N #x` é o achado x do relatório N em [`auditoria/`](auditoria/);
`rel. 0N CT-xx` (ou outro código) é o cenário original do relatório. `crit. MAT-xx`, `crit. DOC-xx`,
`crit. ACA-xx`, `crit. LC-xx` e `crit. ACxx` são critérios de aceite das SPECs e do doc 37
(atenção: `crit. MAT-19` é o critério da SPEC, não o cenário `MAT-19` deste roteiro).

**Prioridade:** **P1** = fluxo principal, dinheiro ou permissão; **P2** = importante; **P3** =
acabamento ou caso raro. Se o tempo do ciclo acabar, garanta todos os P1 primeiro.

**Regras de ouro do UAT**

- **Nunca escanear o QR do WhatsApp** com um celular real (X15). Nunca usar e-mail, telefone ou
  documento de pessoa real. Telefones fictícios no formato `+506 8888 01xx`.
- Todo registro criado começa com `QA` (ex.: "QA-OPORT-01"), para o DEV achar e limpar.
- Quando o cenário pede "outra pessoa" (GP-2, FIN-2, ADM-2), use essa pessoa. Usar o ADM como
  segundo decisor esconde erros de papel (§6). Se o usuário não existir, use o ADM e anote
  "decisor substituto: ADM" na observação.
- Senha, token e dado pessoal nunca vão para issue, print ou chat.

**Onde abrir bug:** GitHub Issues do repositório, template **"Bug"** (passo a passo em
[`04-fluxo-de-bugs.md`](04-fluxo-de-bugs.md)). A issue precisa ter:

- título começando pelo ID do cenário e, quando houver, pelo X#: `[CFG-22][X1] Usuário com e-mail em maiúsculas não consegue entrar`;
- ambiente: **UAT v1**, o `sha` mostrado em `/api/health`, data, hora e navegador;
- papel e apelido do usuário (tabela PG-1), nunca a senha;
- passos executados (copiar do roteiro e ajustar ao que foi feito);
- resultado esperado (copiar do roteiro) × resultado obtido, em duas frases;
- evidência: print ou vídeo curto, sem dado pessoal.

**Ambiente:** o UAT v1 é o único ambiente. Cada merge na `main` faz deploy automático. Abra
`/api/health` no início de cada dia de teste e anote o `sha` na planilha; se ele mudar no meio do
ciclo, anote a hora e reexecute os cenários que falharam.

## Pré-condições gerais (PG)

### PG-1. Usuários por papel

Lista completa, e-mails e preparo em [`02-usuarios-e-papeis.md`](02-usuarios-e-papeis.md). Se o 02
divergir deste quadro, vale o 02. As senhas chegam por canal privado.

| Apelido | Papel(is) | E-mail | Existe no seed? | Uso principal no ciclo |
|---|---|---|---|---|
| ADM | Administrador | admin@genius.com | sim (seed principal) | Configuração, usuários, decisões da Administração |
| ADM-2 | Administrador | ver 02 (ex.: admin2@genius.com) | **não**: criar (PG-2 passo 4) | Segunda pessoa da Administração: perdão, troca de e-mail do portal, permissões do ADM |
| GC | Gerente Comercial | gerente@genius.com | sim (seed QA) | Equipe comercial, aprovações de desconto e preço, coberturas, Configuração › CRM |
| GC+V | Gerente Comercial + Vendedor | mariana@genius.com | sim | Acúmulo de papéis; autoaprovação recusada |
| VEND-A | Vendedor | joao@genius.com | sim | Carteira A; alçada 10% (taxa) / 10% (mensalidade) |
| VEND-B | Vendedor | vendedor2@genius.com | sim (seed QA) | Carteira B; alçada 5% (taxa) / 50% (mensalidade) |
| VEND-0 | Vendedor | vendedor3@genius.com | sim (seed QA) | Sem alçada: todo desconto vai para aprovação; usuário para desativar |
| GP | Gerente Pedagógico | gp@genius.com | sim (seed QA) | Regras, calendário, turmas, grades, oficialização, fechamento |
| GP-2 | Gerente Pedagógico | ver 02 (ex.: gp2@genius.com) | **não**: criar | Decisor independente da área acadêmica |
| PROF | Professor | carla@genius.com | sim | Professora da QA-TURMA-A1 |
| PROF-2 | Professor | professor2@genius.com | sim (seed QA) | Professor da QA-TURMA-A2; escopo por turma |
| FIN | Financeiro | financeiro@genius.com | sim (seed QA) | Cobranças, conferência, recebimentos, comissões |
| FIN-2 | Financeiro + permissão "Aprovar acertos e compensações financeiras" | ver 02 (ex.: financeiro2@genius.com) | **não**: criar | Segunda pessoa do Financeiro |
| SEC | Secretaria Acadêmica | secretaria@genius.com | sim (seed QA) | Matrículas, contrato, reservas, desistências, portal |
| FIN+SEC | Financeiro + Secretaria | ana@genius.com | sim | Autoconferência do próprio informe negada |
| VEND+PROF | Vendedor + Professor | ver 02 (ex.: venprof@genius.com) | **não**: criar | Fora da equipe do GC (sem gerente); escopo docente × comercial |
| Aluno | Conta do portal (não é usuário da equipe) | e-mail de uma caixa do time, no cadastro do QA-ALUNO-01 | nasce do convite (B4) | Portal do aluno |

### PG-2. Preparação do ambiente (checklist do relatório 09, "Dados mínimos do UAT")

Os passos 1 a 4 acontecem **antes** do Módulo 0. Os passos 5 a 17 são executados como cenários dos
Módulos 1 e 2 (coluna "Cenário"). Os passos 15, 18 e 19 e os extras A a E são do DEV ou do PO.
Sem este checklist o ciclo para logo no início (B7).

| # | Quem | Onde | O que fazer | Sem isso | Cenário |
|---|---|---|---|---|---|
| 1 | DEV | Coolify | Variáveis obrigatórias; `WHATSAPP_LIVE` vazio; flags de envio de e-mail, agenda e continuidade em `false`; "Include Source Commit in Build" ligado. Conferir `/api/ready` = 200 e anotar o `sha` de `/api/health`. | Deploy ou login não sobem; versão desconhecida | ACE-01 |
| 2 | DEV | banco do UAT | Seed principal: 5 usuários, 3 países ativos (CR, PA, SV), catálogo de Português, preços só do Regular, templates e política de cobrança desligada. | Nada para configurar | — |
| 3 | DEV | banco do UAT | Seed de QA: 7 usuários de papel único (GP, GC, FIN, SEC, VEND-B, VEND-0, PROF-2). | Faltam papéis puros | — |
| 4 | ADM | Configuração › Usuários | Trocar a senha dos 5 usuários do seed principal; criar ADM-2, GP-2, FIN-2 e VEND+PROF. O vínculo de equipe e as alçadas ficam para o CFG-20. | Senha de dev publicada vale no UAT; faltam decisores | CFG-20 |
| 5 | ADM | Configuração › Operação | Fuso da escola, 1ª mensalidade, suspensão de lembretes, prazo de reserva, 4 prazos do portal, 2 prazos de reposição, avisos do diário. | Reserva, preparação, calendário, notas e portal falham | CFG-02 a CFG-04 |
| 6 | ADM | Configuração › Países | Corrigir o fuso de CR, PA e SV (o seed deixa São Paulo). | Horários errados | CFG-05 |
| 7 | ADM | Configuração › Catálogo › Preços | MATRÍCULA e MENSALIDADE dos produtos do ciclo; um par habilitado **sem** preço para o teste negativo. | Matrícula pede justificativa por falta de preço | CFG-14 |
| 8 | ADM | Catálogo › Regras de entrada por oferta | Forma de agenda, taxa antes da assinatura, adiantamento de hora. | "Regras de entrada incompletas nesta preparação." | CFG-18 |
| 9 | ADM | Financeiro › Política de comissão | Uma política vigente por país × produto usado. | "Configure a política de comissão desta oferta antes de matricular." | CFG-19 |
| 10 | GP prepara, GP-2 publica | Acadêmico › Regras de avaliação | Regra do nível, **antes** de criar as turmas. | Turma sem regra; notas não lançam | ACD-PREP-02, -04 |
| 11 | SEC prepara, GP aprova | Acadêmico › Calendário | Calendário institucional com feriado. | Grade não gera encontros | ACD-PREP-05 |
| 12 | GP | Configuração › Turmas | QA-TURMA-A1, QA-TURMA-A2 e QA-TURMA-SP. | Sem turma | ACD-PREP-07, -09 |
| 13 | SEC prepara, GP aprova | Acadêmico › Grades | Grade de cada turma. | `AGENDA_NAO_PUBLICADA` na reserva | ACD-PREP-14, -15 |
| 14 | SEC prepara, GP aprova | Acadêmico › Admissões | Janela de admissão de A1 e A2. | "Configure e aprove a janela de admissão antes de reservar." | ACD-PREP-17 |
| 15 | DEV + PO | banco do UAT | Status ABERTA nas turmas usadas pelo fluxo legado `/matriculas/nova` (B1). O PO decide se o legado fica no ciclo (R1). | Lista de turmas do legado vazia | MAT-32 |
| 16 | SEC prepara, ADM decide | Configuração › Modelos contratuais | Um modelo publicado por regime usado. | Sem prévia de contrato | CFG-25, -26 |
| 17 | ADM | Configuração › WhatsApp | Números de vendas, cobrança e agenda; política Desligada; kill switch desligado. | Inbox sem linha | CFG-28 a CFG-32 |
| 18 | DEV | logs do Coolify | Confirmar `cron tick 200` a cada 5 min. | Turma não passa a Em andamento; lembretes e reservas particulares param | DIA-01 |
| 19 | PO | — | Decidir se o pagamento online simulado entra no ciclo (R2). Hoje está desligado no código (B3). | Baixa só manual | FIN-15, FIN-16 |
| A | DEV | Catálogo › Modalidades | Criar a modalidade curta **QA-MOD-15** (aula de 15 min, 5x por semana, 3 aulas por nível), com produto habilitado em CR. | Cada chamada exige esperar 2 h (§6) | ACD-PREP-09 |
| B | DEV | — | Combinar a fixture de conclusão de assinatura em produção para ativar QA-MAT-01, QA-MAT-04 e QA-MAT-X (B2). | Nenhuma matrícula do fluxo novo fica Ativa | MAT-24, -25, -28 |
| C | DEV + PO | — | Definir como o QA recebe o link do portal sem e-mail real (B4, R3): chave de teste do Resend para uma caixa do time, ou ferramenta que gera o token. | Portal do aluno intestável | ALU-24 a ALU-30 |
| D | DEV | — | Ficar disponível para simular mensagem recebida no WhatsApp (receita do relatório 03) e para ler o banco quando o cenário pede (B8). | Cenários [DEV] da Inbox bloqueados | INB-16 a INB-21 |
| E | DEV | — | Confirmar que o Google Drive **não** está configurado (B5) e que as flags de envio estão desligadas. | Resultados diferentes dos esperados | DIA-05 |

### PG-3. Integrações em modo simulado ou desligadas

| Integração | Estado no UAT | O que aparece na tela | Ref | O que o QA faz |
|---|---|---|---|---|
| WhatsApp, envio | `WHATSAPP_LIVE` vazio: tudo é simulado | O que se envia pela Inbox some do campo e não aparece na conversa; cobrança mostra "Simulada (ensaio)"; mensagem agendada vira "Simulada" em Tarefas. Nota interna e contexto de transferência são gravados e não aparecem. | B8 | Registrar como observação; não abrir bug do "sumiço" |
| WhatsApp, recebimento | Não há simulação pela tela | Conversa nova só aparece se o DEV fizer um POST assinado no webhook do motor | B8 | Pedir ao DEV (PG-2 extra D) |
| WhatsApp, pareamento | O motor pode estar no ar e mostrar um QR real | QR na tela | X15 | **Nunca escanear**; fechar o diálogo |
| E-mail (Resend) | Sem modo simulado; envio desligado | Convite, recuperação e troca de e-mail do portal, e avisos por e-mail, ficam "Preparado" | B4, R3 | Cenários do portal ficam 🛑 B4 até o PG-2 extra C |
| Pagamento online | Desligado no código | `/pagar` sem botão; webhook responde 404 | B3, R2 | Pagar = SEC informa e FIN confirma, ou FIN registra o recebimento |
| Assinatura de contrato | Não existe driver, nem simulado | "O envio ao serviço de assinatura ainda não está disponível"; "Concluir matrícula" recusa | B2 | Ativação só com a fixture do DEV (PG-2 extra B) |
| Google Drive | Não configurado | Publicar gravação dá "Erro inesperado. Tente novamente."; vídeo indisponível | B5 | Concluir a aula pela exceção de gravação |
| Aria (IA) | Sem chave: provedor simulado | Respostas fixas; selo "SIMULAÇÃO" só no Playground; PDF na base de conhecimento falha | R9 | Esperado |
| Crons | Tick geral a cada 5 min; despacho e portal a cada 60 s; continuidade mensal sem agendador | Turma passa a Em andamento até 5 min depois do 1º encontro; lembretes de tarefa e alertas de SLA dependem do tick | PG-2 passo 18 | Confirmar com o DEV que o cron está no ar |
| Continuidade mensal, avisos de agenda, régua automática | Flags em `false`; política nasce Desligada | Nada é emitido nem enviado sozinho | §5 | Esperado |

### PG-4. Massa de dados do ciclo

Objetos com nome fixo, criados num módulo e reutilizados depois. Anote na planilha o código que o
sistema gerar para cada um (ex.: `L-000123`, `T-…`, o código da matrícula).

| Objeto | O que é | Criado em | Usado em |
|---|---|---|---|
| QA-MOD-15 | Modalidade curta de UAT (15 min, 5x por semana, 3 e depois 4 aulas por nível) | PG-2 extra A | CFG-14, ACD-PREP, DIA |
| QA-PAIS | País de teste (Rascunho → Ativo → Encerrado) | CFG-06 | CFG-08, CFG-09 |
| QA Idioma | Idioma de teste, desativado | CFG-12 | CFG-13 |
| QA-MODELO-MENS | Modelo contratual publicado, regime mensalidade | CFG-25, CFG-26 | MAT-16 |
| QA Vendas — João, QA Vendas geral, QA Cobrança, QA Agenda | Números de WhatsApp (nunca conectar) | CFG-28 | CRM-38, INB, FIN-07 |
| QA-REGRA (v1, v2) | Regra de avaliação do nível da QA-MOD-15 | ACD-PREP-02, -04, -20 | AVA |
| QA Feriado | Feriado do calendário aprovado (em D+1) | ACD-PREP-05 | ACD-PREP-13, ACD-PREP-14, DIA-15 |
| QA-TURMA-A1 | Turma da PROF, capacidade 5, 1º encontro no dia D | ACD-PREP-09, -14, -17 | MAT, DIA, AVA |
| QA-TURMA-A2 | Turma do PROF-2, capacidade 3, mesmo nível | ACD-PREP-09, -15, -17 | MAT-28, MAT-30, ALU, AVA |
| QA-TURMA-SP | Turma sem agenda publicada (casos negativos) | ACD-PREP-07 | ACD-PREP-13, -16, -18, -20; MAT-04 |
| QA-OPORT-01 | Oportunidade de VEND-A; vira QA-MAT-01 | CRM-01 | CRM, INB-03, MAT-01 |
| QA-OPORT-02 | Oportunidade de VEND-A para experimental e perda | CRM-02 | CRM-08, CRM-11 |
| QA-OPORT-03, QA-OPORT-04 | Oportunidades de VEND-A; 03 vira QA-MAT-03; 04 vai para VEND-B | CRM-02 | CRM-12, -19, -21; MAT-27 |
| QA-OPORT-GC | Criada pelo GC para VEND-A, reatribuída a VEND-B; vira QA-MAT-04 | CRM-04 | CRM-14, MAT-25 |
| QA-OPORT-B1, QA-OPORT-B2 | Oportunidades de VEND-B; B1 vira QA-MAT-X; B2 entra na disputa pela vaga | CRM-05 | MAT-03, MAT-28, MAT-30 |
| QA-OPORT-06 | Oportunidade de VEND-0 (sem alçada); vira QA-MAT-02 | CRM-05 | MAT-07 a MAT-09, MAT-26 |
| QA-MAT-01 → QA-ALUNO-01 | Fluxo novo completo em A1, vendido por VEND-A; Ativa só com [DEV] (B2). O cadastro recebe o e-mail da caixa do time (aluno do portal). | MAT-01 a MAT-24 | INB-22 a INB-27, ALU, DIA, AVA, FIN |
| QA-MAT-04 → QA-ALUNO-02 | Segunda matrícula ativa em A1, vendida por VEND-B | MAT-25 | DIA (faltas), AVA (insuficiente, segunda chamada, recuperação, equivalência) |
| QA-MAT-X → QA-ALUNO-X | Matrícula ativa em A2 (PROF-2), vendida por VEND-B | MAT-28 | ALU (pausa e retomada), escopo de PROF e VEND, AVA |
| QA-MAT-02 | Preço fora da alçada; desistência simples | MAT-07 | MAT-08, MAT-09, MAT-26 |
| QA-MAT-03 | Reserva vencida sem pagamento (X8); desistência com cobrança | MAT-27 | MAT-29 |
| QA-MAT-05 | Vencedora da disputa pela última vaga; desistência com taxa paga | MAT-30 | MAT-31 |
| QA-ALUNO-L1 | Aluno do fluxo legado (sob R1), com mensalidades 1 a N | MAT-32, MAT-35 | ALU-12, ALU-20, ALU-21, FIN-13, FIN-25, FIN-29 |
| QA-ALUNO-S | Aluno importado por planilha, sem matrícula | ALU-13 | ALU-18, ALU-22 |
| QA-EMP-01 | Empresa (B2B, só cadastro) | CRM-17, MAT-32 | ALU-33 |

### PG-5. Linha do tempo sugerida

A chamada só abre depois do fim real do encontro e lista quem estava alocado no início dele (§6).
Por isso o 1º encontro da QA-TURMA-A1 (dia **D**) precisa acontecer **depois** da ativação das
matrículas e **antes** dos módulos DIA e AVA.

| Quando | O que executar |
|---|---|
| Antes do ciclo | DEV: PG-2 passos 1 a 3 e extras A a E. ADM: passo 4. |
| Dia 1 | Módulos 0, 1 e 2. Na grade (ACD-PREP-14 e -15), marque o 1º encontro de A1 e A2 para o dia D = dia 3, no fim da tarde. |
| Dia 2 | Módulos 3 e 4 (o que não depende de aluno) e Módulo 5 até as ativações (MAT-24, MAT-25, MAT-28). Do MAT-01 à emissão (MAT-15), termine dentro do prazo de reserva (120 min). |
| Dia 3 (D) | Módulo 6. Depois do fim do 1º encontro: DIA-01 a DIA-07. Cenários ⏭ da Inbox. |
| Dias 4 a 6 | Encontros 2 a 4 (o dia D+1 é o QA Feriado e não tem aula): resto do Módulo 7 e Módulos 8, 9, 10 e 11. |

## Módulo 0 — ACE: login, sessão, menu por papel e acesso negado

Primeiro módulo do ciclo: confirma a versão do UAT, o login da equipe e o que cada papel vê no menu
lateral. Não cria dados de negócio. Há duas formas corretas de negar acesso: redirecionar para
`/acesso-negado` (com o botão "Voltar ao início") ou mostrar "Acesso negado" na própria URL (rel. 01 #8).

**Menu esperado por papel puro** (na ordem da tela; a Home não é o primeiro item):

| Papel | Itens do menu |
|---|---|
| ADM | Permutas, Mudanças acadêmicas, Comissões, Matrículas, Envios do portal, Diário de aulas, Home, Funil, Relatórios, Agente de IA, Carteira, Contatos, Tarefas, Inbox, Alunos, Financeiro, Empresas, Configuração (18) |
| GC | Comissões, Matrículas, Home, Funil, Relatórios, Agente de IA, Carteira, Contatos, Tarefas, Inbox, Financeiro, Empresas (12) |
| VEND | Comissões, Matrículas, Home, Funil, Relatórios, Carteira, Contatos, Tarefas, Inbox (9) |
| GP | Permutas, Mudanças acadêmicas, Diário de aulas, Home, Inbox, Alunos, Configuração (7) |
| PROF | Mudanças acadêmicas, Diário de aulas, Home, Inbox, Alunos (5) |
| FIN | Permutas, Comissões, Home, Tarefas, Inbox, Alunos, Financeiro, Empresas (8) |
| SEC | Mudanças acadêmicas, Matrículas, Envios do portal, Home, Contatos, Tarefas, Inbox, Alunos, Empresas, Configuração (10) |

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| ACE-01 | PG-2 passo 1 | QA, sem login | 1) Abrir `/api/health`. 2) Abrir `/api/ready`. | 1: `{ok:true, sha:"…"}`; anotar o `sha` na planilha. 2: `{ready:true}`. Se o `sha` vier "desconhecido", avisar o DEV (PG-2 passo 1). | rel. 09 #40 | P1 |
| ACE-02 | — | sem sessão | 1) Abrir a raiz do domínio. 2) Clicar em "É aluno? Acesse a área do aluno". | 1: tela de login da equipe. 2: abre `/portal-aluno/entrar`, com o título "Área de reposições". | rel. 01 #22 | P2 |
| ACE-03 | PG-1 | ADM, GC, VEND-A, GP, PROF, FIN, SEC (um por vez) | 1) Entrar. 2) Anotar os itens do menu lateral, na ordem da tela. 3) Sair. | Igual à tabela "Menu esperado por papel puro". Item a mais ou a menos é falha (uma issue por papel). | rel. 01 §Papéis e menu | P1 |
| ACE-04 | — | ADM | Conferir a posição de "Home" no menu. | ⚠️ DECISÃO PENDENTE (rel. 01 #5): hoje o 1º item é "Permutas" e a Home é o 7º. Registrar o observado. | rel. 01 #5 | P3 |
| ACE-05 | PG-1 | GC+V, depois FIN+SEC | Entrar com cada um e anotar o menu. | O menu é a união dos itens dos dois papéis, na ordem da tabela: GC+V vê os mesmos 12 itens do GC; FIN+SEC vê 13 (Permutas, Mudanças acadêmicas, Comissões, Matrículas, Envios do portal, Home, Contatos, Tarefas, Inbox, Alunos, Financeiro, Empresas, Configuração). | rel. 01 §Papéis e menu | P2 |
| ACE-06 | — | sem sessão, depois VEND-A | 1) Sem sessão, abrir `/funil`. 2) Entrar como VEND-A. | 1: vai para o login. 2: depois do login, volta para `/funil`. | rel. 01 #22 | P2 |
| ACE-07 | — | VEND-0 | 1) Errar a senha 5 vezes seguidas. 2) Na 6ª tentativa, usar a senha certa. 3) Depois de 15 min da 1ª falha, entrar de novo. | 1 e 2: sempre "E-mail ou senha incorretos.". 3: entra. ℹ️ NÃO É BUG: o bloqueio é por e-mail, fica na memória do servidor e zera se ele reiniciar (§6). | rel. 01 #14 | P2 |
| ACE-08 | — | VEND-A | 1) Na tela de login, procurar "esqueci a senha". 2) Entrar e abrir "Fuso" no rodapé do menu. | 1: só o texto "Esqueceu a senha? Peça a redefinição a um administrador.". 2: Preferências tem só o fuso. ℹ️ NÃO É BUG: não existe troca de senha pelo próprio usuário (§6). | rel. 01 #16 | P3 |
| ACE-09 | VEND-A logado | VEND-A | Com a sessão ativa, abrir `/login`. | O formulário de login aparece de novo. ℹ️ NÃO É BUG enquanto o PO não decidir (rel. 01 #21). | rel. 01 #21 | P3 |
| ACE-10 | — | FIN+SEC (janela A) e ADM (janela B) | 1) Janela A: FIN+SEC logada na Home. 2) Janela B: ADM, Configuração › Usuários, tira o papel Secretaria de FIN+SEC e salva. 3) Janela A: clicar em qualquer item. 4) Janela A: digitar `/secretaria`. 5) ADM devolve o papel. | 3: "Mudanças acadêmicas", "Matrículas", "Envios do portal", "Contatos" e "Configuração" somem do menu, sem novo login. 4: acesso negado. 5: os itens voltam no próximo clique. | rel. 01 #9; crit. AC06 | P1 |
| ACE-11 | — | VEND-0 (janela A) e ADM (janela B) | 1) VEND-0 logado na janela A. 2) ADM desativa VEND-0 (o diálogo nomeia a pessoa) e confirma. 3) Janela A: clicar em qualquer item. 4) Tentar entrar de novo como VEND-0. 5) ADM reativa VEND-0. | 3: vai para o login. 4: "E-mail ou senha incorretos." (não há aviso de "acesso desativado"). 5: volta a entrar. | rel. 01 #20; crit. AC06 | P1 |
| ACE-12 | — | VEND-0 (janela A) e ADM (janela B) | 1) VEND-0 logado na janela A. 2) ADM troca a senha de VEND-0 em Usuários › editar (guarde a nova senha só no cofre do time). 3) Janela A: continuar navegando. | Esperado: a sessão aberta é encerrada. 🐞 BUG PROVÁVEL (X12): hoje VEND-0 continua logado. Confirmar e abrir issue citando X12. | X12; rel. 01 #17 | P2 |
| ACE-13 | — | VEND-A | Digitar `/alunos`. | "Acesso negado — Você não tem permissão para acessar os alunos.", na mesma URL e sem botão. ℹ️ NÃO É BUG: esta é uma das duas formas corretas de negar. | rel. 01 #8, #11 | P1 |
| ACE-14 | — | VEND-A | 1) Digitar `/configuracao`. 2) Clicar em "Voltar ao início". | 1: redireciona para `/acesso-negado`. 2: abre a Home. | rel. 01 §Matriz | P2 |
| ACE-15 | — | ADM | 1) Criar o usuário "QA Só Aluno" só com o papel "Aluno (portal)". 2) Sair e entrar com ele. 3) Entrar como ADM e desativar "QA Só Aluno". | 2: tela "A área do aluno tem acesso próprio", com "Entrar na área do aluno" e "Sair"; nada da área da equipe. ⚠️ DECISÃO PENDENTE (rel. 01 #2): a caixa "Aluno (portal)" continua no formulário. | rel. 01 #2 | P3 |
| ACE-16 | SEC logada | SEC | 1) Abrir `/portal`. 2) Abrir `/portal-aluno`. | 1: "A área do aluno tem acesso próprio". 2: pede o login do aluno; a sessão da equipe não abre o portal. | rel. 08 #14 | P2 |
| ACE-17 | — | PROF | 1) No rodapé do menu, clicar em "Fuso", escolher `America/Costa_Rica` e salvar. 2) Recarregar. 3) Voltar para "Usar fuso de origem". | 1 e 2: preferência salva e mantida. ℹ️ Só muda a exibição das datas; o DIA-02 confere o efeito nas telas do diário. | rel. 08 #28 | P3 |
| ACE-18 | logado | VEND-A [MOB] | 1) Clicar em "Sair". 2) Usar "Voltar" do navegador. | 1: volta ao login. 2: nenhuma página interna reabre sem login. | rel. 01 §Papéis e menu | P2 |

## Módulo 1 — CFG: configuração

O Administrador monta a configuração que o resto do ciclo usa (PG-2 passos 4 a 9, 16 e 17), na ordem
Operação, Países, Catálogo e preços, Regras de entrada, Política de comissão, Usuários, Modelos
contratuais, WhatsApp e CRM. Cada cenário positivo deixa um dado da massa do ciclo; os negativos
conferem validações e mensagens.

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| CFG-01 | PG-2 passos 1 a 4 | PROF, depois ADM | 1) PROF abre Diário de aulas › Pendências. 2) ADM abre o mesmo painel. | 1: aviso "Os prazos de regularização e lembrete do diário ainda não foram configurados.". 2: o mesmo aviso, com o link "Configurar avisos" (só o ADM vê o link). | rel. 06 DIA-01 | P3 |
| CFG-02 | — | ADM | 1) Configuração › Operação: fuso oficial `America/Costa_Rica`; exigir 1ª mensalidade = não; suspender lembretes = 48 h; prazo inicial de reserva = 120 min; salvar. 2) Recarregar. 3) Mudar a suspensão para 0 e salvar. | 1 e 2: mensagem de sucesso em verde; valores mantidos. 3: mensagem de erro em vermelho, separada do sucesso; nada muda. | PG-2 passo 5; rel. 09 #31 | P1 |
| CFG-03 | CFG-02 | ADM | Na mesma tela, preencher os 4 prazos do portal (sessão 60, convite 1440, recuperação 60, validação de e-mail 1440) e os 2 prazos de reposição por gravação (1ª entrega 2880, resposta à correção 2880); salvar e recarregar. | Salvos e mantidos. Sem eles o portal e a reposição por gravação não funcionam (rel. 01 #23). | rel. 01 #23; rel. 06 #54 | P1 |
| CFG-04 | CFG-02 | ADM, depois PROF | 1) Operação › Configurar avisos do diário: prazo 0, salvar. 2) Intervalo -5, salvar. 3) Prazo 60 e intervalo 30, salvar. 4) PROF reabre Diário › Pendências. | 1 e 2: recusados. 3: salvo e mantido. 4: o aviso do CFG-01 não aparece mais. | rel. 06 DIA-02 | P2 |
| CFG-05 | PG-2 passo 2 | ADM | Configuração › Países: editar CR, PA e SV e corrigir o fuso para `America/Costa_Rica`, `America/Panama` e `America/El_Salvador`; conferir que cada um tem ao menos 1 tipo de documento. | Salvo nos três. ℹ️ NÃO É BUG o fuso inicial `America/Sao_Paulo`: vem do seed (B7). | B7; rel. 09 #5 | P1 |
| CFG-06 | — | ADM | Novo país: nome "QA País", ISO `q1`, moeda `usd`, DDI `+999`, fuso `America/Costa_Rica`, idioma `es`, sem tipo de documento; salvar. | Criado como **Rascunho**, com ISO e moeda em maiúsculas (Q1, USD). Massa: QA-PAIS. | rel. 09 CFG9-01 | P2 |
| CFG-07 | — | ADM | Em "Novo país", testar um erro por vez (cancelar no fim): ISO `CR`; fuso `America/SaoPaulo`; fuso `GMT-3`; DDI `506`; moeda `US`. | "Já existe país com código CR."; os dois fusos recusados como não reconhecidos; "DDI no formato +XXX"; "Moeda em 3 letras". Nada é criado. | rel. 09 #15 | P3 |
| CFG-08 | CFG-06 | ADM | 1) No QA-PAIS, clicar em Ativar. 2) Adicionar o tipo de documento Passaporte e Ativar. 3) Em Catálogo › Preços, criar a MENSALIDADE do Regular para o QA-PAIS e Ativar o país. | 1: "Cadastre ao menos um tipo de documento antes de ativar.". 2: "Cadastre ao menos um produto com preço (Catálogo) antes de ativar.". 3: país **Ativo**; o preço aparece em USD. | rel. 09 CFG9-05 a -07 | P2 |
| CFG-09 | CFG-08 | ADM | 1) No QA-PAIS, Pausar e depois Reativar. 2) Encerrar: tentar confirmar sem digitar o nome; depois digitar "QA País" e confirmar. | 1: Ativo → Pausado → Ativo. 2: o botão fica bloqueado até o nome exato; depois o país fica **Encerrado**, sem botões de status na linha. | rel. 09 #11, #12 | P2 |
| CFG-10 | ⏭ depois do ALU-05 (QA-ALUNO-01 com documento de CR) | ADM | 1) Editar CR, remover o tipo de documento usado pelo QA-ALUNO-01 e salvar. 2) Só renomear esse tipo (acrescentar " QA"), salvar e abrir a ficha do aluno. 3) Desfazer a renomeação. | 1: "Não é possível excluir tipo de documento usado por alunos…"; o tipo continua. 2: salvo; o aluno continua com o documento, agora com o nome novo. | rel. 09 #13 | P2 |
| CFG-11 | ⏭ depois do CRM-01. [DEV]: país de teste com oferta pronta, indicado pelo DEV (não usar CR, PA nem SV) e uma oportunidade de VEND-A desse país | ADM, depois VEND-A | 1) ADM troca a moeda do país de teste (ex.: USD → CRC) e salva. 2) VEND-A abre a oportunidade e clica em "Preparar contratação". | Esperado: a preparação segue normalmente. 🐞 BUG PROVÁVEL (X9): hoje aparece "Confira a oferta e a moeda do país antes de preparar.". | X9; rel. 09 #8 | P2 |
| CFG-12 | — | ADM | 1) Catálogo › Idiomas: clicar em "Adicionar" com o nome vazio. 2) Criar "QA Idioma". 3) Catálogo › Produtos: criar QA Idioma × Regular; criar de novo o mesmo par. | 1: 🐞 BUG PROVÁVEL (rel. 09, Estados de interface): nada acontece e nenhuma mensagem aparece; abrir issue de severidade Baixa. 2: criado. 3: o 1º é criado; o 2º recebe "Já existe um produto para esse idioma + modalidade.". | rel. 09 §Estados; CFG9-19 | P3 |
| CFG-13 | CFG-12 | ADM | 1) Desativar "QA Idioma" e confirmar. 2) Abrir Catálogo › Produtos e Níveis e procurar o idioma nas opções. | 1: a confirmação mostra o impacto. 2: esperado: o idioma inativo some das opções. 🐞 BUG PROVÁVEL (X10): hoje continua listado em produto, nível e matrícula. | X10; rel. 09 #17 | P2 |
| CFG-14 | PG-2 extra A (QA-MOD-15 existe) | ADM | Catálogo › Preços: cadastrar MATRÍCULA e MENSALIDADE de CR para o Regular (se faltar) e para a QA-MOD-15. Escolher um produto habilitado em PA e deixá-lo **sem** preço (anotar qual). | Um preço ativo por par e tipo, na moeda de CR (CRC). Massa pronta para o MAT. | PG-2 passo 7; rel. 09 #7 | P1 |
| CFG-15 | CFG-14 | ADM | 1) Novo preço MENSALIDADE para um par que já tem preço ativo. 2) Desativar o novo (confirmar) e Reativar o antigo. 3) Novo preço com valor 0; depois com -10. | 1: o novo fica Ativo e o anterior, Inativo. 2: há confirmação antes de desativar; reativar inativa o outro. 3: "Valor deve ser maior que zero". Deixe ativo, no fim, o preço que o ciclo vai usar. | rel. 09 #18 | P2 |
| CFG-16 | — | ADM | Catálogo › Modalidades: editar a QA-MOD-15 mudando "aulas por nível". | Erro que manda para Acadêmico › Quantidade de aulas; nada muda. | rel. 06 #31 | P3 |
| CFG-17 | — | GP | Abrir Configuração. | Abas Catálogo e Turmas; em Catálogo, só Idiomas e Níveis. | rel. 09 #16 | P2 |
| CFG-18 | CFG-14 | ADM | Catálogo › Regras de entrada por oferta: 1) oferta CR × QA-MOD-15, salvar com motivo "abc". 2) Forma de agenda = Turma, "exigir taxa antes da assinatura" = sim, motivo "QA ciclo UAT", salvar. 3) Oferta CR × Regular: forma de agenda = Turma, taxa antes da assinatura = não, salvar. | 1: recusado (motivo de 5 a 2.000 caracteres). 2 e 3: salvos; a "Versão" sobe 1 em cada oferta. | PG-2 passo 8; rel. 04 CT-03 | P1 |
| CFG-19 | CFG-14 | ADM | 1) Financeiro › Política de comissão: publicar PERCENTUAL 10% para CR × QA-MOD-15 e para CR × Regular, vigência agora. 2) Clicar de novo em publicar. 3) Tentar nova versão com vigência no passado. | 1: versão 1 listada em cada oferta. 2: não cria versão 2. 3: "Publique a política com vigência atual ou futura.". ℹ️ O produto de PA do CFG-14 fica sem política (usado no MAT-33). | PG-2 passo 9; rel. 07 FIN7-03, -04; crit. AC21 | P1 |
| CFG-20 | PG-2 passo 4 | GC, depois ADM | 1) GC abre a Home. 2) ADM, Configuração › Usuários: em VEND-A, VEND-B e VEND-0, "Gerente comercial" = Ricardo Vargas (GC). Desconto máximo na taxa / na mensalidade: VEND-A 10/10, VEND-B 5/50, VEND-0 vazio/vazio, GC 20/20, GC+V 15/15. VEND+PROF sem gerente. 3) GC recarrega a Home. | 1: "Sem vendedores.". 3: VEND-A, VEND-B e VEND-0 no ranking e na equipe. ℹ️ Sem o passo 2, todo desconto de vendedor vai para aprovação e a Home do GC fica vazia (B7). | B7; rel. 09 #29, #30 | P1 |
| CFG-21 | — | ADM | Usuários › Novo, um erro por vez: e-mail já existente; senha de 5 caracteres; nenhum papel marcado. | Três erros: e-mail já cadastrado; senha com no mínimo 6 caracteres; "Selecione ao menos um papel". | rel. 09 CFG9-33 | P2 |
| CFG-22 | — | ADM | 1) Criar "QA Maiúscula", e-mail `Teste.QA@genius.com`, papel Vendedor, senha válida. 2) Sair e entrar com `Teste.QA@genius.com`; depois com `teste.qa@genius.com`. 3) Como ADM, criar outro usuário com `teste.qa@genius.com`. 4) Desativar os dois. | Esperado: o login funciona com o e-mail cadastrado e o passo 3 é recusado por e-mail repetido. 🐞 BUG PROVÁVEL (X1): hoje as duas grafias dão "E-mail ou senha incorretos." e o passo 3 é aceito. | X1; rel. 01 #18 | P1 |
| CFG-23 | Gerenciador de senhas do navegador ligado, com a senha do ADM salva | ADM | Editar outro usuário (ex.: VEND-0) e olhar o campo "Nova senha" antes de salvar; cancelar sem salvar. | Esperado: o campo fica vazio. 🐞 BUG PROVÁVEL (X11): o navegador pode preencher a senha do ADM nesse campo. Se preencher, abrir issue citando X11 (não salvar). | X11; rel. 01 #19 | P2 |
| CFG-24 | PG-2 passo 4 | ADM, depois ADM-2 | 1) ADM tenta desativar a própria conta. 2) ADM marca uma permissão específica nova no próprio usuário e salva. 3) ADM-2 concede a mesma permissão ao ADM. 4) ADM-2 remove. | 1: "Você não pode desativar a si mesmo.". 2: "Outro administrador deve conceder aumento das suas permissões ou alçadas.". 3 e 4: aceitos. | rel. 01 #34; crit. AC20 | P1 |
| CFG-25 | — | SEC | 1) Abrir Configuração. 2) Modelos contratuais › Novo: finalidade CONTRATO, regime MENSALIDADE, título "QA-MODELO-MENS", campos variáveis `{{chave}}`, assinatura ALUNO/SEMPRE; preparar. 3) Preparar outra versão usando `{{inexistente}}` sem declarar o campo. 4) Abrir o modelo preparado. | 1: só a aba Modelos contratuais. 2: versão proposta, ainda não publicada. 3: erro "Campo não declarado". 4: a SEC não tem botão de decisão. | rel. 04 CT-04, -05, -07; crit. DOC-13 | P1 |
| CFG-26 | CFG-25 | ADM | Abrir QA-MODELO-MENS e aprovar. | Modelo publicado; versões anteriores preservadas. Massa: QA-MODELO-MENS. | PG-2 passo 16; crit. DOC-13 | P1 |
| CFG-27 | — | ADM | Abrir Configuração › WhatsApp. | Abas Números, Templates, Política da régua e Avisos da agenda. Não existem "Comercial" nem "Réguas". | rel. 03 CFG-WA-01 | P2 |
| CFG-28 | — | ADM | Números › Novo, com telefones fictícios: 1) "QA Vendas — João", finalidade Vendas, dono VEND-A. 2) "QA Vendas geral", Vendas, sem dono. 3) "QA Cobrança", Cobrança. 4) "QA Agenda", Agenda. 5) Repetir o telefone do 1. | 1 a 4: números na lista com o selo "desconectado", sem escolha de driver. 5: "Já existe um número cadastrado com este telefone.". | PG-2 passo 17; rel. 03 CFG-WA-03 | P1 |
| CFG-29 | CFG-28 | ADM | No QA Cobrança, marcar os setores Financeiro e Secretaria, escolher o responsável pela triagem e salvar. | "Setores salvos."; a lista de responsáveis só mostra quem tem papel de um dos setores marcados. | rel. 03 CFG-WA-04 | P2 |
| CFG-30 | CFG-28 | ADM | Clicar em "Conectar" num número. | Motor fora do ar: mensagem de erro e nada muda. Motor no ar: aparece um QR. **Não escanear**; fechar o diálogo. ℹ️ Com um celular pareado, ações da Inbox sairiam de verdade (X15). | X15; rel. 03 #3 | P1 |
| CFG-31 | CFG-28 | ADM | 1) Templates: criar `qa_agenda` com o corpo `Olá {nome}, novos horários: {horarios}`, idioma es; criar outro com o mesmo nome. 2) Avisos da agenda: escolher o número QA Vendas geral e o template qa_agenda, salvar; depois o número QA Agenda, salvar. | 1: o 2º recebe "Já existe um template com este nome.". 2: com o número de Vendas, "Escolha um número de agenda ativo do motor WhatsApp."; com QA Agenda, salvo. Templates sem `{horarios}` não aparecem na lista. | rel. 03 CFG-WA-06, -09 | P3 |
| CFG-32 | CFG-28 | ADM | Política da régua: 1) estado "Ensaio" sem número remetente, salvar. 2) Remetente QA Cobrança, salvar. 3) Ligar e desligar o kill switch. 4) Voltar o estado para **Desligada** e salvar. | 1: "Defina o número remetente antes de armar a política.". 2: salvo; o degrau D+15 continua manual. 3: alterna e a política continua salva. 4: Desligada é o estado do ciclo (o FIN-07 liga o Ensaio). | rel. 03 CFG-WA-07, -08 | P2 |
| CFG-33 | — | GC | 1) Digitar `/configuracao/whatsapp`. 2) Digitar `/configuracao/whatsapp/numeros`. | 1: vai para a Home, sem explicação. 2: "Acesso negado". ℹ️ NÃO É BUG: só o ADM configura o WhatsApp (decisão D21). | rel. 03 #9 | P2 |
| CFG-34 | — | GC | 1) Procurar "Configuração" no menu. 2) Digitar `/configuracao`. 3) Digitar `/configuracao/crm/ia`. | 1: o item não existe. 2: abre Configuração › CRM com Distribuição e SLA, Tags e campos, Respostas rápidas e Metas (sem IA). ⚠️ DECISÃO PENDENTE (R13): registrar. 3: acesso negado. | R13; rel. 02 #48, #49 | P2 |
| CFG-35 | CFG-20 | GC | Configuração › CRM › Distribuição e SLA: regra Rodízio com VEND-A e VEND-B; prazo da 1ª resposta; horário de segunda a sexta; salvar e recarregar. | Só o bloco Comercial aparece; valores mantidos. | rel. 02 CRM-CF01 | P2 |
| CFG-36 | CFG-35 | ADM | Distribuição e SLA › setor Financeiro › "Copiar de outro setor" = Comercial › salvar. | Os 4 setores aparecem; o horário é copiado; há uma nota sobre os feriados do calendário escolar. | rel. 02 CRM-CF02 | P3 |
| CFG-37 | — | GC | 1) Tags e campos: criar a tag "Ação"; criar "acao"; arquivar "Ação". 2) Respostas rápidas: criar "qa_oi" com "Aria pode usar" marcado. | 1: "acao" recusada (mesmo nome, sem acento e sem caixa); a arquivada some das listas de escolha. 2: só o setor Comercial está disponível; salva. | rel. 02 #50, #51 | P3 |
| CFG-38 | — | ADM | Configuração › CRM › IA: conferir o estado da chave; mudar o orçamento mensal e salvar. | "Chave de API: ausente" e "Sem chave, a Aria usa o provedor simulado e nada chama a rede."; a barra de uso muda com o novo orçamento. | rel. 02 #52 | P3 |

## Módulo 2 — ACD-PREP: preparação acadêmica

Prepara o que a matrícula, o diário e as avaliações exigem: regra de avaliação (antes da turma),
calendário, turmas, grades e janelas de admissão. Quase toda decisão aqui exige outra pessoa: use
GP-2 quando o cenário pedir. A data D do 1º encontro segue a PG-5; sem a QA-MOD-15 (PG-2 extra A) a
aula dura 2 h e o ciclo atrasa.

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| ACD-PREP-01 | — | PROF, depois SEC | Digitar `/academico/regras`. | `/acesso-negado` para os dois. ℹ️ Não existe "sugerir regra" pelo professor. | rel. 05 #9; crit. ACA-20 | P3 |
| ACD-PREP-02 | CFG-02 | GP | Mudanças acadêmicas › Regras de avaliação › nível do produto QA-MOD-15: preparar a QA-REGRA v1 com escala 0 a 10; avaliação I1 intermediária só de Fala; F1 final com as 4 habilidades; pesos; mínimo geral e por habilidade; frequência mínima; limite de 1 recuperação e de 1 segunda chamada; prazos. Depois tentar publicar. | Versão proposta. Ao publicar: "A decisão precisa ser registrada por outra pessoa". | PG-2 passo 10; crit. ACA-07 | P1 |
| ACD-PREP-03 | — | GP | Preparar outra versão sem o mínimo geral. | Erro de validação; nada gravado; nenhum valor padrão é preenchido. | crit. ACA-04 | P3 |
| ACD-PREP-04 | ACD-PREP-02 | GP-2 | Abrir a QA-REGRA v1 e publicar. | Publicada. ℹ️ Ela só se liga a turmas criadas **depois** da publicação e com início futuro (§6). | §6; crit. ACA-21 | P1 |
| ACD-PREP-05 | CFG-02 | SEC, depois GP | 1) SEC: Mudanças acadêmicas › Calendário › Novo, com o FERIADO "QA Feriado" no dia D+1 e um RECESSO depois do fim previsto das turmas. 2) SEC tenta decidir. 3) GP aprova com motivo. | 2: "Outra pessoa da Gerência Pedagógica/Administração deve decidir". 3: a versão passa a valer. | PG-2 passo 11; rel. 05 AVA-01 | P1 |
| ACD-PREP-06 | ACD-PREP-05 | GP, depois GP-2 | 1) GP prepara uma nova versão do calendário (mude só o nome de um período) e tenta aprová-la. 2) GP-2 rejeita essa versão com motivo. | 1: botão ausente ou recusa (quem preparou não decide). 2: rejeitada; a versão do ACD-PREP-05 continua valendo. | rel. 06 #13 | P2 |
| ACD-PREP-07 | ACD-PREP-04 | GP | Configuração › Turmas › Nova turma "QA-TURMA-SP": modalidade QA-MOD-15, sem professor, sem data final, início em D+3. | Criada como **Planejada**, com "Previsão de término pendente da grade.", o link "Preparar grade" e "Avaliações: versão 1". ℹ️ Data final vazia é aceita. | rel. 06 #1; rel. 05 #12 | P2 |
| ACD-PREP-08 | — | GP | Nova turma (cancelar no fim): 1) modalidade Regular (1x por semana) com 2 dias marcados. 2) Regular das 19:00 às 20:00. | 1: "A modalidade Regular é 1x/semana: selecione exatamente 1 dia(s)…". 2: erro dizendo que a aula dura 2 hora(s). ℹ️ Não existe exceção de duração por turma (rel. 06 #2). | rel. 06 #2; rel. 09 CFG9-23, -24 | P2 |
| ACD-PREP-09 | ACD-PREP-04; PG-2 extra A | GP | Criar: 1) "QA-TURMA-A1": QA-MOD-15, professora PROF, os 5 dias da semana, 17:00 às 17:15, início em D, capacidade 5. 2) "QA-TURMA-A2": mesma modalidade e nível, professor PROF-2, 17:30 às 17:45, início em D, capacidade 3. | As duas **Planejadas**, com código T-…, "0 matriculados · 0 reservas · N vagas" e "Avaliações: versão 1". | PG-2 passo 12 | P1 |
| ACD-PREP-10 | — | GP | Abrir o formulário de nova turma, preencher um campo e clicar no fundo escuro; depois apertar Escape. | Nas duas formas, pede confirmação antes de descartar. | rel. 09 CFG9-26 | P3 |
| ACD-PREP-11 | ACD-PREP-09 | GP | Procurar em Configuração › Turmas uma ação para mudar a turma para "Aberta" ou "Concluída". | 🛑 BLOQUEADOR (B1): a ação não existe. Marcar Bloqueado; não abrir bug. | B1 | P1 |
| ACD-PREP-12 | — | ADM, depois GP | 1) ADM: Configuração › Turmas › Importar uma planilha com 1 linha válida e 1 com modalidade inexistente. 2) GP: digitar `/api/turmas/modelo`. | 1: cria a turma válida (Planejada) e lista "Modalidade não reconhecida" para a outra. 2: recusado (apenas administrador). | rel. 09 CFG9-29, -30 | P3 |
| ACD-PREP-13 | ACD-PREP-07 | SEC, depois GP | 1) SEC: "Preparar grade" da QA-TURMA-SP (sem professor), com motivo. 2) GP abre a proposta e aprova. | 1: prévia com data informada, primeira aula e término, pulando o QA Feriado. 2: "Defina o professor antes de publicar a grade.". | rel. 06 #15 | P2 |
| ACD-PREP-14 | ACD-PREP-09 | SEC, GP, depois PROF | 1) SEC prepara a grade da QA-TURMA-A1. 2) GP aprova. 3) PROF abre Diário de aulas › Encontros. | 2: grade publicada. 3: encontros "Previsto" a partir de D, com "exibido em …; origem …"; nenhum no QA Feriado. | PG-2 passo 13; rel. 06 #14 | P1 |
| ACD-PREP-15 | ACD-PREP-09 | GP, depois GP-2 | 1) GP prepara a grade da QA-TURMA-A2. 2) GP tenta aprovar a própria. 3) GP-2 aprova. | 2: "Outra pessoa deve decidir a grade.". 3: publicada. | rel. 06 DIA-11 | P1 |
| ACD-PREP-16 | ACD-PREP-14 | GP, SEC | 1) GP edita a QA-TURMA-SP: professora PROF e o mesmo horário da A1. 2) SEC prepara a grade da SP; GP tenta aprovar. 3) GP tenta mudar o professor ou o horário da QA-TURMA-A1. | 2: "Resolva os conflitos ou a indisponibilidade docente antes de publicar a grade.". 3: "A turma possui agenda publicada. Mudanças de professor, nível, modalidade, datas ou horários exigem revisão e aprovação da agenda.". | rel. 06 #16; rel. 06 DIA-12, DIA-14 | P2 |
| ACD-PREP-17 | ACD-PREP-14, -15 | SEC, depois GP | 1) SEC: Mudanças acadêmicas › Admissões › QA-TURMA-A1: preparar a janela de admissão com limite em D+2. 2) SEC tenta decidir. 3) GP aprova. 4) Repetir 1 e 3 para a QA-TURMA-A2. | 2: recusado (outra pessoa decide). 3 e 4: janela vigente nas duas turmas. | PG-2 passo 14; rel. 04 CT-09, -10 | P1 |
| ACD-PREP-18 | ACD-PREP-16 | PROF, GP, SEC | 1) PROF: Mudanças acadêmicas › Indisponibilidades: pedir ausência num período futuro **sem** aulas de A1 (ex.: D+20), com motivo. 2) PROF procura como decidir. 3) GP aprova. 4) GP muda o início da QA-TURMA-SP para dentro desse período; SEC prepara a grade da SP; GP tenta aprovar. | 2: o próprio professor não decide. 3: aprovada; a tela lista as aulas afetadas e **não** as remarca. 4: recusada por indisponibilidade docente. | rel. 06 #16; rel. 05 AVA-05 | P2 |
| ACD-PREP-19 | ACD-PREP-14, -15 | SEC, depois GP | Mudanças acadêmicas › Quantidade de aulas: SEC propõe aumentar a QA-MOD-15 de 3 para 4 aulas por nível; SEC tenta aprovar; GP aprova. | O autor não aprova. Depois da aprovação, A1 e A2 ganham 1 encontro "Previsto" cada. | rel. 06 #31 | P2 |
| ACD-PREP-20 | ACD-PREP-07 | GP, GP-2 | 1) GP prepara a QA-REGRA v2 (mude um peso); GP-2 publica. 2) Na QA-TURMA-SP, abrir "Avaliações: versão 1" e propor a migração para a v2; GP-2 decide. | A SP passa à v2; A1 e A2 continuam na v1 (já têm agenda e vão receber notas). | rel. 05 AVA-10; crit. ACA-21 | P3 |

## Módulo 3 — CRM: funil, carteira, contatos, tarefas, relatórios, metas e Aria

CRM novo: oportunidades no Funil (quadro e lista), Carteira, Contatos (a Pessoa é o centro),
Tarefas, Relatórios, Metas e a Aria. O CRM antigo (Leads, Pipeline, ficha do lead) não existe mais.
Use telefones `+506 8888 01xx` e nomes começando por QA. A experimental não chega ao professor
(🛑 B6); por isso as etapas "Exp. realizada" e "No-show" ficam fora do alcance da interface.

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| CRM-01 | CFG-20 | VEND-A | Funil › Nova oportunidade › Pessoa: nome "QA-OPORT-01", WhatsApp `+506 8888 0101`, país Costa Rica, etapa Novo › Criar. | Cartão na coluna Novo, com código `L-` e 6 dígitos e dono João Silva. Não existe campo "Responsável" para o vendedor. | rel. 02 CRM-F01; #16 | P1 |
| CRM-02 | CRM-01 | VEND-A | Criar "QA-OPORT-02" (etapa Qualificado, `+506 8888 0102`), "QA-OPORT-03" e "QA-OPORT-04" (etapa Novo, `…0103` e `…0104`). | Cartões nas colunas certas. A aba Atividade da QA-OPORT-02 mostra as mudanças de etapa. | rel. 02 CRM-F02 | P2 |
| CRM-03 | CRM-01 | VEND-A | Nova oportunidade digitando o telefone `+506 8888 0101`; clicar em "Usar cadastro"; cancelar. | Aviso "Já existe no CRM: QA-OPORT-01" e o botão "Usar cadastro"; ao usar, "Usando o cadastro de QA-OPORT-01". | rel. 02 #40 | P2 |
| CRM-04 | CFG-20 | GC | Nova oportunidade "QA-OPORT-GC" (`…0110`): 1) Responsável = "Sem responsável", criar. 2) Responsável = João Silva, criar. | 1: "Selecione um vendedor da sua equipe.". 2: criada com dono João Silva. O campo só lista a equipe do GC. | rel. 02 #15 | P1 |
| CRM-05 | CFG-20 | VEND-B, VEND-0, depois VEND-A | 1) VEND-B cria "QA-OPORT-B1" e "QA-OPORT-B2" (`…0105`, `…0106`). 2) VEND-0 cria "QA-OPORT-06" (`…0107`). 3) VEND-A abre o Funil e depois `/funil?o=<id da QA-OPORT-B1>`. | 3: VEND-A não vê os cartões de VEND-B nem de VEND-0; pela URL, "Oportunidade fora da sua carteira.". | rel. 02 #19; crit. AC01 | P1 |
| CRM-06 | CRM-01 | VEND-A [MOB] | 1) Arrastar QA-OPORT-01 de Novo para Qualificado. 2) Arrastar de Novo para 1º contato. | 1: "Avance uma etapa por vez." e nada muda. 2: move; a Atividade registra a mudança. | rel. 02 #1 | P2 |
| CRM-07 | CRM-02 | VEND-A | Arrastar QA-OPORT-02 para "Exp. realizada"; depois para "No-show". | Nas duas: "Esta etapa é registrada pelo check-in do professor.". | rel. 02 #3 | P2 |
| CRM-08 | CRM-02 | VEND-A, depois PROF | 1) Abrir QA-OPORT-02 (Qualificado) › aba Oportunidade › escolher data e hora futuras › "Agendar experimental". 2) Procurar o campo de professor. 3) PROF abre a Home. 4) VEND-A tenta remarcar. | 1: cartão em "Exp. agendada". 2 e 3: 🛑 BLOQUEADOR (B6): não há campo de professor e a experimental não aparece na Home de nenhum professor. 4: ℹ️ o botão "Agendar experimental" some em Exp. agendada; para remarcar, voltar a Qualificado e agendar de novo. | B6; rel. 02 #4, #5 | P1 |
| CRM-09 | CRM-06 | VEND-A | Na QA-OPORT-01 (1º contato), clicar em "Enviar proposta". | Vai para Proposta; a Atividade mostra "Proposta enviada". ⚠️ DECISÃO PENDENTE (rel. 02 #6): o botão aparece desde Novo e não pede conteúdo; registrar. | rel. 02 #6 | P2 |
| CRM-10 | CRM-09 | VEND-A | Na QA-OPORT-01, clicar em "Preparar contratação"; ver a tela e voltar sem preparar. | Abre `/oportunidades/<id>/contratacao`. A oportunidade continua em Proposta. ℹ️ A coluna "Aguardando matrícula" fica vazia no fluxo novo. A contratação é feita no MAT-01. | rel. 02 #9 | P1 |
| CRM-11 | CRM-08 | VEND-A | 1) QA-OPORT-02 › "Marcar como perdida" › motivo Outro sem observação. 2) Repetir com observação. 3) Arrastar o cartão de Perdido para Novo. | 1: recusado. 2: vai para Perdido, com o motivo no painel e sem botões de ação. 3: "Oportunidade encerrada não volta ao funil.". | rel. 02 #8 | P2 |
| CRM-12 | CRM-02 | VEND-A | 1) Funil › Lista › marcar QA-OPORT-03 e QA-OPORT-04 (em Novo) › "Mover para…" Proposta › "Mover selecionadas". 2) Com as mesmas, mover para 1º contato. | 1: esperado: aviso de que as duas foram recusadas. 🐞 BUG PROVÁVEL (X7): hoje aparece "Etapa atualizada." e nada muda. 2: as duas mudam e a seleção é limpa. | X7; rel. 02 #10 | P2 |
| CRM-13 | CRM-01 | VEND-A | QA-OPORT-01 › aba Detalhes › "Abrir contato". | Esperado: abre a ficha do contato. 🐞 BUG PROVÁVEL (X7): hoje leva a "página não encontrada". Contorno: menu Contatos e clicar no nome. | X7; rel. 02 #11 | P2 |
| CRM-14 | CRM-04 | GC, depois VEND-A e VEND-B | 1) GC abre QA-OPORT-GC › Responsável = VEND-B › motivo › "Atribuir responsável" › confirmar. 2) VEND-A e VEND-B abrem o Funil. | 1: "Responsável atualizado."; a Atividade registra a troca e o motivo. 2: VEND-A não vê mais a QA-OPORT-GC; VEND-B passa a ver. | rel. 02 #27; crit. AC08 | P1 |
| CRM-15 | CRM-01 | VEND-A | Na QA-OPORT-01: aba Detalhes, editar o resumo e uma data, anexar um PDF fictício; aba Atividade, registrar uma interação e uma nota interna. | Cada ação mostra sucesso e aparece no histórico com autor e hora. | rel. 02 CRM-F17 | P2 |
| CRM-16 | Permissão "Exportar leads" dada ao GC+V (ADM, Configuração › Usuários) | VEND-A, depois GC+V | 1) VEND-A procura o botão Exportar no Funil. 2) GC+V aplica um filtro de origem ou de perdidos e exporta. | 1: o botão não aparece. 2: baixa um .xlsx sem telefone. 🐞 BUG PROVÁVEL (rel. 02 #14): os filtros de origem, tag e perdidos não são aplicados à planilha; registrar se vierem linhas a mais. | rel. 02 #14; crit. AC27 | P3 |
| CRM-17 | — | VEND-A | 1) Nova oportunidade › Empresa "QA-EMP-01 SA". 2) Repetir com o mesmo nome. 3) Clicar em Empresas no menu, se houver; digitar `/empresas`. | 1 e 2: duas oportunidades e duas empresas criadas. 3: acesso negado para o vendedor. ⚠️ DECISÃO PENDENTE (rel. 02 #17): registrar. | rel. 02 #17 | P3 |
| CRM-18 | CRM-01 | VEND-A | 1) Contatos › clicar em QA-OPORT-01. 2) Na ficha, "Nova oportunidade" e criar "QA-OPORT-01b". | 1: a ficha abre na mesma tela (`?c=` na URL); a lista só tem contatos com oportunidade do VEND-A; não há Importar nem Mesclar. 2: o modal já vem com "Usando o cadastro de QA-OPORT-01"; a 2ª oportunidade fica ligada ao mesmo contato. | rel. 02 CRM-K01, -K02 | P2 |
| CRM-19 | CRM-02 | VEND-A | Contatos › QA-OPORT-03 › "Registrar opt-out" › confirmar. | "Opt-out registrado: não recebe mensagens." e "(opt-out)" ao lado do telefone. | rel. 02 CRM-K03 | P2 |
| CRM-20 | CRM-15 | VEND-A | 1) Abrir Carteira. 2) Numa oportunidade com N dias sem interação, registrar uma nota interna e recarregar. 3) Registrar uma interação e recarregar. | 1: título "Minha carteira", só as dele, sem a aba Coberturas, sem as perdidas. 2: os dias não mudam. 3: os dias zeram. | rel. 02 #28 | P2 |
| CRM-21 | CRM-18 | GC | Carteira › marcar QA-OPORT-04 e QA-OPORT-01b › reatribuir para VEND-B: 1) motivo "ok". 2) Motivo "troca de férias". | 1: "Informe o motivo (mínimo 5 caracteres).". 2: reatribuídas; a Atividade de cada uma mostra o motivo. | rel. 02 #27 | P2 |
| CRM-22 | CFG-20 | GC, depois VEND-B | 1) Carteira › Coberturas: titular VEND-A, substituto VEND-B, de hoje a amanhã › conceder. 2) VEND-B abre Funil e Carteira. 3) GC revoga a cobertura. 4) VEND-B recarrega. | 2: VEND-B vê as oportunidades do VEND-A e "João Silva (cobertura até dd/mm)" na Carteira. 4: deixam de aparecer. | rel. 02 #29; crit. AC07 | P1 |
| CRM-23 | — | GC | 1) Contatos › Importar um .xlsx com as colunas Nome, WhatsApp, E-mail, Cidade, Origem e Tag: 3 linhas válidas, 1 sem nome, 1 repetida › Prévia › Aplicar com dono VEND-A. 2) Importar um .csv renomeado para .xlsx. | 1: a prévia mostra novos, existentes e a linha inválida; aplicar cria os contatos com oportunidade em Novo para VEND-A; a tag nova aparece em Configuração › CRM › Tags e campos. 2: "Não foi possível ler o arquivo. Use um .xlsx válido.". | rel. 02 #41, #42 | P2 |
| CRM-24 | CRM-23 | GC | Contatos › Mesclar dois contatos duplicados › Revisar mesclagem › confirmar. | A prévia mostra o que passa de um para o outro; depois aparece "Contatos mesclados". | rel. 02 #43 | P3 |
| CRM-25 | Cron no ar (PG-2 passo 18) | VEND-A | Tarefas › Nova tarefa para hoje, hora daqui a 15 min, lembrete 10 min; esperar. | A tarefa aparece em "Hoje"; depois do lembrete, aparece um item no sino de Tarefas. ℹ️ O sino só existe em Tarefas e Inbox. | rel. 02 #35 | P3 |
| CRM-26 | — | VEND-A | 1) Nova tarefa com lembrete e sem horário. 2) Criar uma tarefa válida; Concluir com resultado; Reabrir; Cancelar sem motivo; Cancelar com motivo. 3) Procurar como ligar a tarefa a uma oportunidade. | 1: "O lembrete exige data e horário.". 2: Concluída → Aberta → "Informe o motivo do cancelamento." → Cancelada. 3: ⚠️ DECISÃO PENDENTE (rel. 02 #33): não há campo de vínculo; registrar. | rel. 02 #33, #37 | P2 |
| CRM-27 | — | GC, depois VEND-A | 1) Tarefas › Equipe › Nova tarefa para VEND-A. 2) Abrir a mesma tarefa em duas abas e salvar uma edição em cada. 3) Tentar atribuir uma tarefa a VEND+PROF. | 1: a tarefa aparece para VEND-A. 2: na 2ª aba, "Esta tarefa foi alterada por outra pessoa. Recarregue.". 3: "Você só pode atribuir tarefas à sua equipe.". | rel. 02 #34 | P2 |
| CRM-28 | — | FIN, VEND-A, FIN-2 | 1) FIN cria tarefa sem responsável. 2) VEND-A procura a tarefa. 3) FIN-2 clica em "Assumir". | 2: VEND-A não vê. 3: a tarefa sai da fila do Financeiro e passa a ser de FIN-2. | rel. 02 CRM-T05 | P3 |
| CRM-29 | — | VEND-A | Abrir Relatórios. | Abas Visão geral, Funil, Conversas e Atividades; não há filtros Responsável e Autor. | rel. 02 CRM-R01 | P2 |
| CRM-30 | — | GC | 1) Relatórios › Equipe › filtrar por VEND-A › clicar num número. 2) Período personalizado com "até" antes de "de". | 1: 6 abas; tabela por pessoa; o detalhe lista as oportunidades da métrica. 2: aviso do erro e "Mostrando os últimos 30 dias.". | rel. 02 CRM-R02, -R03; crit. AC02 | P2 |
| CRM-31 | CFG-35 | ADM | Relatórios › Conversas. | Esperado: a métrica "Fora do horário" usa o horário salvo. 🐞 BUG PROVÁVEL (X7): hoje aparece "Fora do horário: sem horário de funcionamento configurado.". | X7; rel. 02 #32 | P3 |
| CRM-32 | CFG-20 | GC, depois ADM | 1) Relatórios › Equipe › "Definir metas". 2) Meta "Matrículas" do mês para VEND-A = 5; salvar. 3) Meta "Valor ganho" sem moeda. 4) Meta geral. 5) ADM define a meta geral. | 1: abre Configuração › CRM › Metas. 2: salva. 3: exige moeda. 4: "Só o administrador define a meta geral.". 5: salva. | rel. 02 #47 | P2 |
| CRM-33 | — | ADM | 1) Agente de IA › Estado = Sombra, antes de publicar. 2) Comportamento: mudar o nome da Aria › Salvar › Publicar com nota "QA v1". | 1: "Publique uma versão antes de ligar a Aria.". 2: versão 1 publicada; o aviso "A Aria ainda não foi publicada" some; o Histórico de versões mostra a nota. | rel. 02 #53 | P2 |
| CRM-34 | CRM-33 | GC | 1) Abrir Agente de IA. 2) Tentar mudar a matriz de Permissões. 3) Baixar a faixa de confiança. 4) Pausar com motivo; depois Reativar. | 1: não há seletor de estado. 2: bloqueado ("Só o Administrador…"). 3: recusado. 4: "Aria está pausada." com o motivo; depois "Aria reativada.". | rel. 02 #53; rel. 02 CRM-AR05 | P2 |
| CRM-35 | CRM-33 | GC | Playground › mensagem do cliente "Quanto custa o curso?" › Testar; depois "quero falar com um atendente". | Selo "SIMULAÇÃO · nada é enviado nem alterado". 1ª: "Obrigada pela mensagem! Vou verificar e já te respondo.". 2ª: handoff "Pediu para falar com uma pessoa". Nenhuma oportunidade ou mensagem nova. | rel. 02 #56; R9 | P2 |
| CRM-36 | — | ADM | Agente de IA › Conhecimento: criar uma fonte de texto; depois enviar um PDF fictício. | Texto: "Pronta". PDF: erro "Não foi possível extrair texto deste PDF…". ℹ️ NÃO É BUG sem chave (§6). | rel. 02 #57 | P3 |
| CRM-37 | CRM-33 | ADM | 1) Estado = Ativa. 2) Voltar para Desligada. | 1: muda na hora, sem pedir confirmação. ⚠️ DECISÃO PENDENTE (R9): registrar. 2: Desligada (estado do ciclo). | R9; rel. 02 #63 | P2 |
| CRM-38 | CRM-33; CFG-28. [DEV] simular mensagem recebida (PG-2 extra D) | ADM | 1) Estado = Sombra. 2) DEV simula mensagem de um contato novo para o número QA Vendas geral (sem dono) e outra para QA Vendas — João. 3) Abrir Agente de IA › Histórico. 4) Estado = Ativa e o DEV repete a mensagem no QA Vendas geral. 5) Voltar para Desligada. | 3: ações da 1ª mensagem registradas como "Simulada"; nada enviado nem mudado no CRM; a mensagem na linha do João não gera turno. 4: o atendimento passa para uma pessoa com o motivo "Falha do provedor". ⚠️ DECISÃO PENDENTE (R9): a Aria só atua no Comercial e em número sem dono, regra não documentada. Sem o DEV: 🛑 BLOQUEADOR (B8). | R9; B8; rel. 02 #54, #55 | P3 |

## Módulo 4 — INB: Inbox, WhatsApp em modo simulado e avisos

Atendimento por WhatsApp em modo simulado: nada sai de verdade, o que se envia não aparece na
conversa e mensagem recebida só existe se o DEV simular (🛑 B8). "Abrir atendimento" cria a conversa
sem precisar de mensagem recebida, o que permite testar escopo, filtros e ações. Os cenários marcados
⏭ dependem de aluno matriculado (Módulo 5) ou de alteração de agenda (Módulo 7). **Nunca conectar
um número com celular real** (X15).

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| INB-01 | — | PROF, depois GP | Clicar em Inbox. | Abre sem erro (lista vazia ou só atendimentos pedagógicos). ℹ️ NÃO É BUG: Professor e Gerente Pedagógico abrem a Inbox hoje (§6). | rel. 03 #22 | P2 |
| INB-02 | CFG-28; CRM-05 | VEND-B | Inbox › "Abrir atendimento". | Aviso "Atendimento comercial sai pela sua linha comercial. Peça à administração para atribuir uma linha a você." (VEND-B não tem linha). | rel. 03 INB-02 | P2 |
| INB-03 | CFG-28; CRM-01 | VEND-A [MOB] | Inbox › "Abrir atendimento" › destino "Comercial · QA-OPORT-01" › canal. | O canal só lista "QA Vendas — João". Abre a conversa vazia, status "Em atendimento", "Responsável: João Silva". | rel. 03 INB-03 | P1 |
| INB-04 | INB-03 | VEND-A | Na conversa, escrever "teste QA" e enviar. | O campo limpa, nada aparece na conversa e não há mensagem de erro. 🛑 BLOQUEADOR (B8): registrar como observação, não abrir bug. | B8; rel. 03 #2 | P1 |
| INB-05 | INB-03 | VEND-B | Colar a URL da conversa do INB-03 (`/inbox?c=<id>`). | A conversa não carrega (erro ou "sem acesso"); nenhum conteúdo do VEND-A aparece. | crit. LC-03 | P1 |
| INB-06 | INB-03 | GC, FIN, SEC | Cada um abre a Inbox e busca "QA-OPORT-01". | GC vê a conversa (setor Comercial inteiro). FIN e SEC não veem. | crit. LC-04, LC-13 | P1 |
| INB-07 | INB-03 | ADM | Usar as abas Todas, Minhas, Fila, Não lidas e Prazo estourado, e os filtros de setor, número, status e busca; dar F5. | A URL guarda o filtro (`setor=`, `numero=`, `status=`, `naoLidas=1`, `prazo=estourado`) e o F5 mantém o recorte. | rel. 03 INB-10 | P3 |
| INB-08 | INB-03 | VEND-A, depois GC | 1) VEND-A: Fixar e Silenciar a conversa. 2) GC abre a mesma conversa. | 1: "Conversa fixada." e "Silenciada por N horas.". 2: para o GC nada muda ("Fixar e silenciar valem só para você."). | rel. 03 INB-12 | P3 |
| INB-09 | INB-03 | VEND-A | Registrar uma "Nota interna" na conversa. | Mensagem de sucesso, mas a nota não aparece na conversa nem no painel. 🛑 BLOQUEADOR (B8). | B8; rel. 03 #4 | P2 |
| INB-10 | INB-03 | VEND-A | 1) "Agendar mensagem" para daqui a 5 min, dentro da janela de envio. 2) Abrir "Convites e agendamentos". 3) Depois do horário, abrir Tarefas. | 2: a mensagem aparece em "Mensagens agendadas". 3: status "Simulada"; a conversa não muda. ℹ️ NÃO É BUG em modo simulado. | rel. 03 INB-19 | P2 |
| INB-11 | INB-03 | VEND-A | Agendar uma mensagem para um horário passado; depois para fora da janela de envio. | As duas são recusadas com mensagem de horário ou janela; nada é agendado. | rel. 03 INB-20 | P3 |
| INB-12 | INB-03 | VEND-A, depois ADM | 1) VEND-A marca opt-out do contato e tenta enviar. 2) VEND-A procura "reautorizar". 3) ADM reautoriza o contato. | 1: "O contato pediu para não receber mensagens (opt-out)…". 2: o VEND-A não vê a opção. 3: o ADM vê e reautoriza. | rel. 03 INB-21 | P2 |
| INB-13 | INB-03 | VEND-A, depois GC | 1) VEND-A procura "Encerrar atendimento". 2) GC encerra e confirma. | 1: o vendedor não tem o botão. 2: status "Encerrado"; o campo de envio fica bloqueado. ℹ️ Encerrar o Comercial é só do GC e do ADM (rel. 03 #15). | rel. 03 #15 | P2 |
| INB-14 | INB-03 | ADM, VEND-A, VEND-B | 1) ADM troca o dono da linha "QA Vendas — João" para VEND-B. 2) VEND-A e VEND-B recarregam a Inbox. 3) ADM devolve a linha para VEND-A. | 2: VEND-B vê todas as conversas da linha, inclusive as antigas; VEND-A deixa de ver. 3: volta ao estado anterior. | crit. LC-09 | P2 |
| INB-15 | INB-03 | ADM, VEND-A | 1) ADM desativa a linha "QA Vendas — João". 2) VEND-A recarrega a Inbox. 3) ADM reativa. | 2: VEND-A perde o acesso às conversas da linha. 3: volta a ver. | rel. 03 INB-32 | P3 |
| INB-16 | [DEV] PG-2 extra D | DEV, depois VEND-A, GC, ADM, VEND-B | DEV simula uma mensagem recebida de um telefone novo na linha "QA Vendas — João". Cada usuário abre a Inbox. | VEND-A, GC e ADM veem a conversa nova, sem oportunidade e com o botão "Criar oportunidade"; ela não cai na triagem. VEND-B não vê. | B8; crit. LC-01, LC-03 | P2 |
| INB-17 | INB-16 | VEND-A | 1) Na conversa nova, clicar em "Criar oportunidade". 2) Clicar de novo. 3) Abrir Contatos e procurar o contato. | 1: oportunidade criada com dono VEND-A, no mesmo atendimento. 2: devolve a mesma oportunidade, sem duplicar. 3: 🐞 BUG PROVÁVEL (rel. 02 #21): o contato não aparece em Contatos, porque a oportunidade criada pela Inbox não gera Pessoa. | crit. LC-06; rel. 02 #21 | P2 |
| INB-18 | INB-16 | VEND-A, depois ADM | Abrir o menu da mensagem recebida; conferir Reagir, Encaminhar, Editar e Apagar; conferir "Bloquear" no atendimento. | As ações aparecem desabilitadas, com a dica "Disponível quando o motor próprio da escola entrar em uso."; "Bloquear" (só ADM e gerentes) fica sempre desabilitado. ℹ️ Essas ações não passam pela trava de modo simulado (X15): por isso nunca conectar um celular. | X15; rel. 03 #3, #12 | P1 |
| INB-19 | INB-16 | VEND-A | 1) Conferir o número ao lado do item Inbox no menu. 2) Abrir a conversa. 3) Recarregar. | 1: o contador subiu com a mensagem. Esperado em 2 e 3: zerar ao abrir. 🐞 BUG PROVÁVEL (X5): hoje não diminui. | X5; rel. 03 #1 | P2 |
| INB-20 | INB-16; [DEV] | DEV, depois VEND-A | 1) DEV simula uma resposta enviada pelo celular (`mensagem.enviada`, origem celular) na mesma conversa. 2) DEV simula uma mensagem recebida com o texto exato "parar". 3) VEND-A tenta enviar. | 1: aparece como mensagem de saída, no mesmo atendimento. 2: o contato fica em opt-out. 3: envio recusado por opt-out. | crit. LC-05; rel. 03 INB-27, -29 | P3 |
| INB-21 | [DEV] | DEV, depois ADM e VEND-A | DEV simula uma mensagem de contato desconhecido no número "QA Cobrança". | ADM vê no painel de triagem e consegue classificar num atendimento; VEND-A não vê. | crit. LC-12 | P3 |
| INB-22 | ⏭ depois do MAT-24; CFG-29 | FIN, depois SEC | FIN: "Abrir atendimento" › "Financeiro · QA-ALUNO-01 · contrato" pelo canal QA Cobrança. SEC abre a Inbox. | Atendimento criado. A SEC também o vê na lista. ⚠️ DECISÃO PENDENTE (rel. 03 #16): a Secretaria vê as filas Financeiro e Pedagógico; registrar. | rel. 03 #16 | P2 |
| INB-23 | ⏭ depois do MAT-28 | PROF | "Abrir atendimento" e conferir a lista de destinos. | Só destinos "Pedagógico · <aluno>" das turmas da PROF (QA-ALUNO-01, QA-ALUNO-02); o QA-ALUNO-X (turma do PROF-2) não aparece. Aluno sem WhatsApp aparece "· indisponível", com o motivo. | rel. 03 INB-09; crit. AC09 | P1 |
| INB-24 | ⏭ depois do MAT-24; CFG-29 | SEC, depois FIN | 1) SEC abre um atendimento de Secretaria para o QA-ALUNO-01 pelo canal QA Cobrança. 2) Transferir para Financeiro com contexto curto; depois com 12 ou mais caracteres. 3) FIN abre o atendimento transferido. | 2: com contexto curto o botão fica desabilitado; com o válido, "Atendimento transferido.". 3: o cabeçalho mostra a origem, mas o contexto não aparece. 🛑 BLOQUEADOR (B8). | B8; rel. 03 #4 | P2 |
| INB-25 | INB-24 | SEC, depois FIN | 1) SEC: Convidar FIN com motivo de menos de 10 caracteres; depois motivo válido, "Pode enviar" desmarcado, prazo 2 dias. 2) FIN abre a conversa e tenta enviar. 3) SEC: "Convites e agendamentos" › Revogar convite, com o FIN olhando a conversa. | 1: motivo curto deixa o botão desabilitado. 2: FIN vê a conversa e recebe "Você não pode enviar nesta conversa.". 3: a tela do FIN trava sem ações, sem recarregar. | rel. 03 INB-16, -17 | P2 |
| INB-26 | ⏭ depois do DIA-15 (replanejamento aprovado) | SEC | Abrir Matrículas › Avisos de alterações na agenda (`/secretaria/avisos-agenda`); numa pendência, "Reconferir" com observação, sem corrigir o aluno. | Avisos "E-mail · Preparado" ou "WhatsApp · Preparado" para os alunos afetados, ou pendências como "Contato sem aceite de comunicações" e "Sem destinatário acadêmico autorizado". A reconferência registra a observação e a pendência continua. Nada é enviado (§5). | rel. 03 AGE-01 a -03; rel. 06 #33 | P2 |
| INB-27 | ⏭ depois do MAT-24 | SEC | Abrir `/matriculas/<id da QA-MAT-01>/autorizacoes-comunicacao` e autorizar um responsável como destinatário pedagógico, com evidência. | Autorização registrada com autoria; o responsável aparece como destino pedagógico em "Abrir atendimento". | rel. 03 AGE-05; crit. ACA-25 | P3 |
| INB-28 | [DEV] | DEV | 1) POST nos crons sem o cabeçalho de segredo. 2) Com o segredo, em `/api/agenda/avisos/cron` e `/api/portal-aluno/envios/cron`. 3) POST no webhook do motor sem assinatura e com assinatura de 10 min atrás. | 1: 401. 2: `{"executou":false,"motivo":"envio_desligado"}`. 3: 401 "Assinatura inválida.". | rel. 03 CRON-01, WH-01 | P3 |

## Módulo 5 — MAT: entrada comercial, matrícula, contrato e Secretaria

Fluxo novo: oportunidade → preparação comercial (vendedor) → Secretaria assume → pagador →
condições → emissão da taxa → pagamento → prévia, participantes e original do contrato →
conferência para assinatura → ativação. 🛑 B2: sem assinatura, nenhuma matrícula fica Ativa sem a
fixture do DEV (MAT-24). O pagamento é sempre manual (🛑 B3). O fluxo legado `/matriculas/nova`
está sob ⚠️ R1 (MAT-32 a MAT-35). Prepare a QA-MAT-03 e a QA-MAT-X cedo: os cenários MAT-27 e MAT-28
esperam a reserva vencer (120 min).

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| MAT-01 | CFG-14, -18, -19, -26; ACD-PREP-17; CRM-10 | VEND-A | 1) Funil › QA-OPORT-01 › "Preparar contratação". 2) Escolher "pessoa nova" (só primeiro nome e país), a oferta CR × QA-MOD-15 e a QA-TURMA-A1. 3) Preparar. 4) Abrir a ficha financeira pela matrícula, se houver link. | 2: A1 aparece "elegível", com vagas. 3: matrícula QA-MAT-01 em **Rascunho**, com reserva de 120 min. 4: nenhuma cobrança. Anote o código. | crit. MAT-17, MAT-24 | P1 |
| MAT-02 | MAT-01 | VEND-A | Recarregar a tela de contratação e preparar de novo (ou dar duplo clique em "Preparar"). | Volta a mesma QA-MAT-01; não cria segunda reserva. | crit. MAT-12 | P2 |
| MAT-03 | MAT-01; CRM-05 | VEND-B | Abrir pela URL `/oportunidades/<id da QA-OPORT-01>/contratacao`. | Acesso negado ou erro de escopo; nenhum dado da oportunidade aparece. | rel. 04 CT-14 | P1 |
| MAT-04 | ACD-PREP-07 | VEND-A | Na contratação da QA-OPORT-03, escolher a QA-TURMA-SP; cancelar sem preparar. | A SP aparece **inelegível**, com o motivo (ex.: `LIMITE_NAO_CONFIGURADO`, `AGENDA_NAO_PUBLICADA`); não deixa reservar. | rel. 04 #9; crit. MAT-20 | P2 |
| MAT-05 | MAT-01; CRM-21 (QA-OPORT-01b é do VEND-B) | VEND-B | Contratação da QA-OPORT-01b (mesmo telefone do QA-OPORT-01): escolher "pessoa nova"; depois só olhar o candidato sugerido e cancelar. | "Pessoa nova": "Existe cadastro com esse contato…". A tela mostra o cadastro existente como candidato. | rel. 04 CT-16, -17; crit. MAT-01 | P3 |
| MAT-06 | CFG-20; ACD-PREP-17 | GC+V | 1) Criar no Funil "QA-OPORT-07" na própria carteira e avançar até Proposta. 2) Preparar a contratação em A2 com taxa abaixo da referência (fora da alçada de 15%). 3) Abrir `/matriculas/<id>/preparacao` e tentar aprovar o próprio preço. 4) Limpar: SEC faz a desistência simples (como no MAT-26). | 3: recusado (outra pessoa decide). 4: matrícula Cancelada, vaga liberada. | rel. 04 CT-20; crit. MAT-16 | P1 |
| MAT-07 | CRM-05; CFG-20 | VEND-0 | Preparar a contratação da QA-OPORT-06 em A1 com a taxa abaixo da referência. | Matrícula QA-MAT-02 em Rascunho, com o preço "pendente de decisão" (VEND-0 não tem alçada). | rel. 04 CT-19; B7 | P1 |
| MAT-08 | MAT-07 | SEC | 1) Em Matrículas (`/secretaria`), buscar a QA-MAT-02 e "Assumir matrícula". 2) Registrar o pagador. 3) Tentar registrar as condições de entrada. | 3: bloqueado por preço não autorizado. | rel. 04 CT-26 | P2 |
| MAT-09 | MAT-08 | GC | Abrir `/matriculas/<id da QA-MAT-02>/preparacao` e aprovar o preço. | Preço aprovado; a SEC passa a conseguir registrar as condições. | rel. 04 CT-19; crit. MAT-16 | P1 |
| MAT-10 | MAT-01 | SEC | Matrículas › buscar o código da QA-MAT-01 › "Assumir matrícula". | Marcada como assumida, com a SEC responsável. | rel. 04 CT-21 | P1 |
| MAT-11 | MAT-10 | VEND-A, depois SEC | 1) VEND-A tenta editar um dado da QA-MAT-01; usa "Solicitar correção". 2) SEC aplica (ou rejeita) a correção. | 1: o vendedor não edita direto depois da assunção. 2: a correção aparece com status e autor. | rel. 04 CT-22; crit. MAT-24, AC15 | P2 |
| MAT-12 | MAT-10 | SEC | `/matriculas/<id>/pagador`: registrar o pagador RESPONSAVEL (nome fictício, país, motivo). | Versão 1 no histórico do pagador. | rel. 04 CT-23 | P1 |
| MAT-13 | MAT-12 | SEC | `/matriculas/<id>/condicoes`: registrar as condições de entrada (dia de vencimento, cobertura). | Condições salvas em versão. | rel. 04 CT-25 | P1 |
| MAT-14 | MAT-13 | FIN | Abrir `/matriculas/<id>/pagador` e `/matriculas/<id>/condicoes` da QA-MAT-01. | As duas abrem só para leitura, sem formulário. | rel. 04 CT-24 | P2 |
| MAT-15 | MAT-13; reserva ainda dentro do prazo | SEC | 1) `/matriculas/<id>/emissao`: conferir e emitir. 2) Repetir a emissão. 3) Voltar ao pagador e tentar alterá-lo. | 1: a taxa é criada uma vez; a 1ª mensalidade não (CFG-02). 2: não cria segunda taxa. 3: bloqueado ("Alterações exigem revisão documental/financeira"). | crit. MAT-23, MAT-26 | P1 |
| MAT-16 | MAT-15; CFG-26 | SEC | `/matriculas/<id>/contrato`: escolher QA-MODELO-MENS, registrar a prévia e abrir o PDF. | Prévia preservada; o PDF abre com os dados da matrícula. | crit. DOC-01, DOC-02 | P1 |
| MAT-17 | MAT-16 | SEC | Conferir os participantes (aluno maior de idade) e preservar o original; abrir o PDF do original. | O original aparece na lista e o PDF abre. | crit. DOC-14 | P1 |
| MAT-18 | MAT-17; taxa ainda não paga | SEC | No original, registrar a conferência para assinatura. | Erro "Esta oferta exige taxa integralmente recebida e confirmada…" (CFG-18 exigiu a taxa antes da assinatura). | crit. DOC-06 | P1 |
| MAT-19 | MAT-15 | SEC, depois FIN | 1) SEC: ficha financeira do aluno (`/alunos/<id>/financeiro`) › taxa › "Informar pagamento", valor total, com um comprovante fictício. 2) FIN: Financeiro › A conferir › "Confirmar recebimento". 3) Conferir a matrícula. | 1: informe "A conferir"; o saldo não muda. 2: taxa Paga. 3: a matrícula continua em Rascunho. ℹ️ Pagar não ativa a matrícula. | crit. AC10, AC11; rel. 07 #9 | P1 |
| MAT-20 | MAT-18, MAT-19 | SEC | Registrar de novo a conferência para assinatura. | Registrada, com o aviso "O envio ao serviço de assinatura ainda não está disponível" e sem botão de envio. 🛑 BLOQUEADOR (B2). | B2; rel. 04 #1 | P1 |
| MAT-21 | MAT-20 | SEC | Em Matrículas, clicar em "Concluir matrícula" na QA-MAT-01. | "O contrato precisa estar aceito e confirmado pela secretaria antes da ativação"; o painel não oferece anexar contrato. 🛑 BLOQUEADOR (B2). | B2; rel. 04 #2 | P1 |
| MAT-22 | MAT-17 | SEC | Abrir o PDF do original e trocar, na URL, o identificador da matrícula pelo de outra (ex.: QA-MAT-02). | Página não encontrada ou erro; nenhum PDF de outra matrícula. | crit. DOC-09 | P1 |
| MAT-23 | MAT-16 | VEND-A | Abrir `/matriculas/<id da QA-MAT-01>/contrato`. | Acesso negado. | rel. 04 CT-41 | P2 |
| MAT-24 | MAT-21; [DEV] PG-2 extra B | DEV, depois SEC | 1) DEV registra a conclusão de assinatura em produção (fixture) para a QA-MAT-01. 2) SEC confirma o aceite do original assinado. 3) SEC "Concluir matrícula". 4) Conferir matrícula, turma, comissão e funil. | Matrícula **Ativa**; reserva Utilizada; aluno QA-ALUNO-01 em A1; 1ª mensalidade emitida; comissão do VEND-A **Aprovada**; QA-OPORT-01 em Matriculado. Sem o DEV: 🛑 BLOQUEADOR (B2). | B2; rel. 04 CT-43; crit. DOC-11 | P1 |
| MAT-25 | CRM-14; [DEV] | VEND-B, SEC, FIN, DEV | Repetir MAT-01 e MAT-10 a MAT-24 com a QA-OPORT-GC (agora do VEND-B), em A1, pessoa nova "QA-ALUNO-02". | QA-MAT-04 Ativa; QA-ALUNO-02 em A1; comissão do VEND-B Aprovada. Sem o DEV: 🛑 B2. | B2 | P1 |
| MAT-26 | MAT-09; mais de 120 min desde o MAT-07 | SEC | 1) Registrar as condições da QA-MAT-02 e tentar emitir a entrada. 2) `/matriculas/<id>/desistencia`: registrar o pedido de desistência com motivo e efetivar. 3) Recarregar e tentar efetivar de novo. 4) Ver as vagas da A1 em Configuração › Turmas. | 1: bloqueado por reserva vencida. 2: matrícula **Cancelada**; reserva Liberada. 3: não há segunda efetivação; a tela mostra a existente. 4: a vaga voltou. | crit. MAT-28, MAT-12; rel. 04 CT-29, -53, -54 | P1 |
| MAT-27 | CRM-02; prepare cedo | VEND-A, SEC | 1) VEND-A prepara a QA-OPORT-03 em A1 (QA-MAT-03). 2) SEC assume, registra pagador e condições e emite a taxa, sem pagar. 3) Esperar a reserva vencer (120 min). 4) Matrículas › Reservas (`/secretaria/reservas`) › "Conferir" a reserva. 5) Comparar as vagas da A1 em Configuração › Turmas e na ficha da turma (Alunos › turma). | 4: esperado: a reserva expira e libera a vaga. 🐞 BUG PROVÁVEL (X8): hoje continua Ativa, com "É necessário conferir o processo de assinatura externa… Esta conferência não liberou a reserva.". 5: 🐞 BUG PROVÁVEL (rel. 06 #7): com reserva ativa, as duas telas mostram números de vagas diferentes. | X8; rel. 04 #4; rel. 06 #7; crit. MAT-19 | P1 |
| MAT-28 | CRM-05; prepare cedo; [DEV] PG-2 extra B | VEND-B, SEC, FIN, ADM, DEV | 1) VEND-B prepara a QA-OPORT-B1 em A2 (QA-MAT-X). 2) SEC assume, pagador, condições e emite. 3) FIN registra o recebimento da taxa direto na ficha financeira ("Registrar recebimento"). 4) Esperar a reserva vencer; SEC "Conferir". 5) SEC propõe prorrogar em `/secretaria/reservas/<id>`; SEC tenta decidir. 6) ADM aprova. 7) Seguir MAT-16 a MAT-24 com a QA-MAT-X. | 3: taxa Paga na hora. 4: reserva "mantida por pendência". 5: a SEC não decide a própria proposta. 6: reserva Ativa com novo prazo; histórico preservado. 7: QA-MAT-X Ativa e QA-ALUNO-X em A2. | crit. MAT-25; rel. 04 CT-32, -48, -50, -51 | P1 |
| MAT-29 | MAT-27 | FIN, FIN-2, SEC | 1) FIN: `/matriculas/<id da QA-MAT-03>/desistencia/financeiro` › propor o cancelamento da taxa não paga. 2) FIN tenta aprovar a própria proposta. 3) FIN-2 aprova. 4) SEC registra o pedido e efetiva a desistência. | 2: recusado (outra pessoa). 3: aprovado. 4: taxa **Cancelada** (valor preservado); matrícula Cancelada; a vaga presa pelo X8 é liberada. | crit. MAT-28; rel. 04 CT-55, -56 | P1 |
| MAT-30 | MAT-28 | GP, VEND-A, VEND-B | 1) GP ajusta a capacidade da A2 para ocupação + 1. 2) VEND-A cria "QA-OPORT-09" e avança até Proposta. 3) Ao mesmo tempo, em dois navegadores, VEND-A (QA-OPORT-09) e VEND-B (QA-OPORT-B2) preparam a contratação em A2. 4) GP volta a capacidade para 3. | 3: só uma preparação reserva a vaga (QA-MAT-05); a outra vê a turma sem vaga. | crit. MAT-18 | P3 |
| MAT-31 | MAT-30 | SEC, FIN, ADM | 1) SEC assume a QA-MAT-05, registra pagador e condições e emite; FIN registra o recebimento da taxa. 2) SEC registra o pedido de desistência. 3) SEC abre Matrículas › Desistências (`/secretaria/desistencias`). 4) ADM decide em `/matriculas/<id>/desistencia/administracao`. | 3: o pedido aparece na fila; a SEC vê, mas não decide. 4: a decisão fica registrada. ⚠️ DECISÃO PENDENTE (rel. 04 CT-57): a efetivação ainda exige o acerto contratual do Financeiro; registrar até onde o fluxo vai. | crit. MAT-28; rel. 04 #14 | P2 |
| MAT-32 | PG-2 passo 15 | VEND-A | 1) `/matriculas/nova`: abrir a lista de turmas. 2) Sem turma (lista de espera), cadastrar o aluno novo "QA-ALUNO-L1" (CR, com documento), produto Regular, pagador "Empresa (B2B)" com o nome "QA-EMP-01 SA". 3) Olhar o campo de certificado; trocar o país para PA e olhar de novo; voltar para CR. 4) Salvar. 5) Abrir a ficha financeira do aluno. | 1: lista vazia se o DEV não abriu a turma. 🛑 BLOQUEADOR (B1) para matricular com turma. 3: ⚠️ DECISÃO PENDENTE (R10): o valor do certificado é editável nos dois países. 4: matrícula **Aguardando**. 5: a taxa e a 1ª mensalidade já existem; comissão Pendente. ⚠️ DECISÃO PENDENTE (R1): registrar. | R1; R10; B1; rel. 04 #6, #20 | P2 |
| MAT-33 | CFG-14, CFG-19 | VEND-A | `/matriculas/nova` com o produto de PA deixado sem política de comissão e sem preço (CFG-14): preencher e salvar. | "Configure a política de comissão desta oferta antes de matricular." (ou o pedido de justificativa por falta de preço; anotar qual aparece primeiro). | R1; crit. AC24; rel. 07 FIN7-05 | P2 |
| MAT-34 | MAT-32 | VEND-A, depois SEC | 1) VEND-A: `/matriculas/nova` com o mesmo nome e documento do QA-ALUNO-L1; salvar. 2) SEC abre `/matriculas/nova` e preenche. | 1: cria um **segundo** cadastro de aluno. 2: a tela abre, mas não há "Salvar matrícula". ⚠️ DECISÃO PENDENTE (R1) nos dois. | R1; rel. 04 #6, #7 | P3 |
| MAT-35 | MAT-32 | SEC, FIN, SEC | 1) SEC assume a matrícula do QA-ALUNO-L1, anexa um CONTRATO (PDF fictício) e confirma o contrato. 2) FIN registra o recebimento da taxa. 3) SEC "Concluir matrícula". | Matrícula **Ativa**; mensalidades 2 a N geradas; comissão Aprovada. ⚠️ DECISÃO PENDENTE (R1): é o único fluxo que ativa sem o DEV. | R1; rel. 04 CT-47 | P2 |

## Módulo 6 — ALU: ficha do aluno, movimentações, créditos, documentos, importação, portal, certificado e empresas

A ficha do aluno é uma página única, sem abas; as operações ficam em sub-telas. Pausar, retomar,
encerrar e trocar de turma saíram da ficha e viraram propostas com aprovação de outra pessoa, por
matrícula (§6). O portal do aluno tem login próprio e depende do link enviado por e-mail, que não sai
no UAT (🛑 B4): os cenários do portal ficam bloqueados até o PG-2 extra C.

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| ALU-01 | MAT-24 | SEC | Abrir a ficha do QA-ALUNO-01 (Alunos › nome). | Seções: cabeçalho com "Cadastro: Ativo", código e telefone; Turmas atuais (A1); Dados pessoais; Financeiro; Histórico. Links no topo: "Pausa, retomada e encerramento por matrícula", "Acesso ao portal de reposições", "Conferir agenda para aditivo". Botão "Editar dados". **Sem** Pausar, Encerrar ou Trocar turma; aparece o aviso "Pausa, retomada e encerramento devem identificar as matrículas envolvidas…". | rel. 08 #1, #5 | P1 |
| ALU-02 | MAT-24 | FIN | Abrir a ficha do QA-ALUNO-01. | Bloco Financeiro visível; **sem** Dados pessoais e sem telefone; sem "Editar dados"; com o link de pausa por matrícula; sem o botão acadêmico. | rel. 08 #2; crit. AC04 | P1 |
| ALU-03 | MAT-24, MAT-28 | GP | 1) Abrir a ficha do QA-ALUNO-01 e a do QA-ALUNO-X. 2) No bloco Acadêmico, clicar em "Gerenciar acesso ao portal". | 1: as duas abrem; sem Financeiro e sem Dados pessoais; bloco Acadêmico e botão "Turma, nível e solicitações acadêmicas". 2: 🐞 BUG PROVÁVEL (rel. 08 #53): cai em "Acesso negado" (link oferecido a quem não pode usar). | rel. 08 #2, #53 | P1 |
| ALU-04 | MAT-28 | PROF | 1) Abrir Alunos. 2) Abrir a ficha do QA-ALUNO-01. 3) Abrir pela URL a ficha do QA-ALUNO-X. | 1: só os alunos da A1. 2: sem Financeiro, sem Dados pessoais, sem botões de cadastro; botão "Consultar solicitações e emitir parecer"; histórico sem motivo. 3: página não encontrada. | rel. 08 #2; rel. 01 #11; crit. AC04 | P1 |
| ALU-05 | MAT-24 | SEC | Ficha do QA-ALUNO-01 › Editar dados: 1) incluir documento (tipo de CR), e-mail da caixa do time e "Recebe comunicações" marcado, sem motivo; salvar. 2) Repetir com motivo. | 1: não salva sem motivo. 2: salva; o histórico de cadastro registra a alteração. | rel. 08 A08-06 | P1 |
| ALU-06 | MAT-28 | SEC | Ficha do QA-ALUNO-X › "Pausa, retomada e encerramento por matrícula" › Nova pausa: escolher a QA-MAT-X, ver a prévia e solicitar. | Proposta "Pendente", com os impactos; a SEC **não** vê "Aprovar proposta". | crit. MAT-03; rel. 08 A08-07 | P1 |
| ALU-07 | ALU-06 | FIN | Abrir a proposta; motivo com menos de 5 caracteres; depois motivo válido › Aprovar. | Com motivo curto o botão fica desabilitado; com o válido, status "Aprovada". | rel. 08 A08-08 | P1 |
| ALU-08 | MAT-25 | FIN, depois FIN-2 | 1) FIN solicita uma pausa da QA-MAT-04 (QA-ALUNO-02) e tenta aprovar a própria. 2) FIN-2 rejeita com motivo. | 1: "Quem solicita não pode decidir a própria proposta.". 2: rejeitada; QA-ALUNO-02 continua Ativa. | rel. 08 A08-09; crit. MAT-16 | P1 |
| ALU-09 | ALU-07 | SEC, depois PROF-2 | 1) SEC: "Aplicar proposta aprovada". 2) Abrir a ficha do QA-ALUNO-X e as vagas da A2 em Configuração › Turmas. 3) PROF-2 abre Alunos. | 1: contrato "Pausada". Esperado em 2 e 3: a pausa libera a vaga e tira o aluno da visão do professor. 🐞 BUG PROVÁVEL (X13): hoje a vaga continua ocupada, o PROF-2 continua vendo o aluno e o selo do cadastro segue "Ativo". | X13; rel. 08 #8 | P1 |
| ALU-10 | — | GP | Digitar `/alunos/<id do QA-ALUNO-X>/movimentacoes`. | Redireciona para "Acesso negado". ℹ️ NÃO É BUG: o Gerente Pedagógico não abre a página de movimentações (§6). | §6; rel. 08 #7 | P2 |
| ALU-11 | ALU-09 | SEC, FIN-2, SEC | 1) SEC: Nova retomada da QA-MAT-X (ou pela ficha financeira › Retomada). 2) SEC procura aprovar. 3) FIN-2 aprova. 4) SEC aplica. | 2: quem propôs não aprova. 4: contrato Ativo; anote o período da pausa (usado no AVA-22). | crit. MAT-06; rel. 07 #27 | P1 |
| ALU-12 | ⏭ depois do FIN-29 (o FIN ainda usa o QA-ALUNO-L1); MAT-35 (fluxo legado, R1) | SEC, FIN, FIN-2 | 1) SEC: Movimentações do QA-ALUNO-L1 › Novo pedido de encerramento (data, motivo, evidência). 2) FIN prepara o acerto e tenta decidir. 3) FIN-2 decide. 4) FIN efetiva. | 1: pedido "Aberto", com autor e datas. 2: "Outra pessoa deve decidir o acerto.". 3 e 4: matrícula Encerrada. | rel. 08 #9; crit. MAT-04 | P2 |
| ALU-13 | — | ADM | Alunos › "Cadastrar por lote" › baixar o modelo › preencher 1 linha (Nome "QA-ALUNO-S", País CR, Tipo e Número do documento; deixar vazia a coluna "Número" do endereço) › importar › abrir a ficha. | Esperado: a ficha mostra o documento. 🐞 BUG PROVÁVEL (X6): hoje a ficha fica **sem** documento (a coluna "Número" do endereço sobrescreve o documento). | X6; rel. 08 #36 | P2 |
| ALU-14 | ALU-13 | ADM | 1) Importar o mesmo arquivo do ALU-13 de novo. 2) Importar duas vezes uma planilha com Nome, Sobrenome, País e E-mail ("QA-ALUNO-S2"). | 1: esperado: linha ignorada por já existir. 🐞 BUG PROVÁVEL (X6): hoje duplica o aluno. 2: na 2ª vez, "0 de 1 aluno(s) cadastrado(s)" e "1 linha(s) ignorada(s)…: Já cadastrado como … mesmo nome e e-mail.". | X6; rel. 08 #35 | P2 |
| ALU-15 | ALU-13 | ADM | Abrir a ficha do QA-ALUNO-S (importado com "Recebe comunicações" vazio) › Editar dados. | "Recebe comunicações" aparece marcado. ⚠️ DECISÃO PENDENTE (R11): registrar. | R11; rel. 08 #37 | P2 |
| ALU-16 | — | ADM | Importar: um .csv; um .xlsx sem a coluna País; um .xlsx com País "Narnia". | "Não foi possível ler o arquivo. Use um .xlsx válido."; "Cabeçalho inválido…"; erro na linha "País não reconhecido". | rel. 08 A08-39 | P3 |
| ALU-17 | — | SEC, FIN, ADM | 1) SEC e FIN abrem Alunos e procuram "Cadastrar por lote" e "Exportar planilha"; digitam `/api/alunos/modelo`. 2) ADM aplica um filtro e exporta. | 1: sem os dois botões; o modelo responde "Apenas administrador.". 2: "Exportar planilha (filtros aplicados)" baixa um .xlsx com Código, Nome, Situação, País e Turma. | rel. 08 #11; crit. AC27 | P2 |
| ALU-18 | ALU-13 | SEC | Ficha do QA-ALUNO-S (sem matrícula): 1) Pausar sem motivo; depois com motivo. 2) Encerrar com "Outro" sem observação; depois "Desistiu". | Os botões aparecem (aluno sem vínculo). 1: sem motivo bloqueia; com motivo, "Cadastro: Pausado". 2: "Observação obrigatória quando o motivo é Outro"; com "Desistiu", "Encerrado" e histórico com motivo e autor. | rel. 05 #24; rel. 08 A08-15, -16 | P2 |
| ALU-19 | MAT-19 (informe com comprovante) | SEC, depois VEND-A, PROF e FIN | 1) SEC abre o comprovante do informe da taxa da QA-MAT-01 e copia a URL do arquivo. 2) VEND-A, PROF e FIN abrem essa URL. | VEND-A e PROF: "Acesso negado." (403). FIN: o arquivo abre. | rel. 08 #48; crit. AC28 | P1 |
| ALU-20 | MAT-35 (R1) | FIN | Ficha financeira do QA-ALUNO-L1 › uma mensalidade aberta › "Registrar recebimento" acima do saldo: 1) sem autorizar o excedente. 2) Autorizando o excedente como crédito. | 1: "Autorize o registro do excedente como crédito.". 2: mensalidade Paga; crédito criado, com link para a página do crédito. | rel. 07 FIN7-22, -23; crit. MAT-13 | P2 |
| ALU-21 | ALU-20 | FIN, depois FIN-2 | Página do crédito › propor o uso numa outra mensalidade aberta do QA-ALUNO-L1, com a concordância do aluno; FIN procura decidir; FIN-2 decide. | O FIN que propôs não tem o botão de decidir; depois da aprovação do FIN-2, o saldo da mensalidade cai pelo valor do crédito. | rel. 08 #12; rel. 07 FIN7-55 | P2 |
| ALU-22 | ALU-13 | SEC | Ficha do QA-ALUNO-S (sem e-mail) › Acesso ao portal › "Preparar convite". | "Acesso pendente: cadastre e confirme um e-mail individual."; identidade do portal "Aguardando definição de senha". | rel. 08 #15 | P2 |
| ALU-23 | ALU-05; CFG-03 | SEC | 1) Ficha do QA-ALUNO-01 › Acesso ao portal › "Preparar convite"; clicar de novo. 2) Abrir Envios do portal › aba Todos. 3) Esperar 2 min e recarregar. | 1: "Convite preparado. O envio depende da configuração institucional."; o 2º clique não cria outro envio; nenhum link ou senha aparece. 2: 1 item "Convite de acesso · Preparado". 3: continua "Preparado". 🛑 BLOQUEADOR (B4) e ⚠️ DECISÃO PENDENTE (R3). | B4; R3; rel. 08 #15, #16 | P1 |
| ALU-24 | ALU-23; [DEV] PG-2 extra C (link do convite) | Aluno | Abrir o link do convite: senha de 11 caracteres; depois duas senhas diferentes; depois uma senha válida igual nos dois campos. | 11 caracteres: aviso de mínimo de 12. Diferentes: não deixa concluir. Válida: entra em `/portal-aluno` com "Acesso individual: <e-mail>"; a barra de endereço não mostra `#token`. Sem o link: 🛑 BLOQUEADOR (B4). | B4; rel. 01 #27; rel. 08 #18 | P1 |
| ALU-25 | ALU-24 | Aluno | Abrir de novo o mesmo link do convite. | "Este link não está mais disponível. Ele pode ter sido usado…" e o botão "Já tenho senha: entrar". | rel. 08 #18 | P2 |
| ALU-26 | ALU-24 | Aluno | `/portal-aluno/entrar` com senha errada 5 vezes; na 6ª, a senha certa; depois de 15 min, de novo. | As 6 primeiras: "E-mail ou senha incorretos." (o bloqueio dura 15 min e sobrevive a reinício do servidor). Depois de 15 min, entra. | rel. 08 #19; rel. 01 #26 | P2 |
| ALU-27 | ALU-24 | Aluno [MOB] | 1) Ver o Início, "Ver frente acadêmica e resultados parciais" e "Preferências de horário". 2) Em Preferências, fuso Costa Rica › Salvar. 3) "Sair" e depois "Voltar" do navegador. | 1: lista de reposições (ou "Não há reposições para este acesso."); resultados por matrícula; **sem** cobranças, contrato ou cadastro (ℹ️ NÃO É BUG). 2: "Preferência salva.". 3: volta a `/portal-aluno/entrar`. | rel. 08 #20, #24, #28 | P2 |
| ALU-28 | ⏭ depois do DIA-21; ALU-24 | Aluno | Abrir uma reposição do QA-ALUNO-01 (se houver) e trocar, na URL `/portal-aluno/reposicoes/<id>`, o id pelo de uma reposição do QA-ALUNO-02 (o DEV ou a SEC informa o id). | Página "não encontrado", sem dizer que a reposição existe. | rel. 01 #12 | P1 |
| ALU-29 | — | sem sessão | `/portal-aluno/recuperar` com um e-mail inexistente; depois com o e-mail do QA-ALUNO-01. Abrir Envios do portal › Todos como SEC. | As duas respostas iguais: "Pedido registrado. Se houver uma conta ativa…". Com conta ativa (só se o ALU-24 passou), aparece um envio "Recuperação"; sem conta, nada. | rel. 08 #21 | P2 |
| ALU-30 | ALU-24; PG-1 (ADM-2) | ADM, Aluno, ADM-2 | 1) ADM: Acesso ao portal do QA-ALUNO-01 › preparar a troca assistida de e-mail, com motivo e evidência. 2) Aluno valida o link recebido no novo e-mail. 3) ADM tenta aprovar a troca que ele mesmo preparou. 4) ADM-2 aprova. | 3: "Outra pessoa da Administração deve decidir a troca de e-mail.". 4: confirmação "Aplicar a troca do e-mail…"; depois, a sessão do aluno cai e a senha antiga deixa de valer. Sem o link: 🛑 BLOQUEADOR (B4). | B4; rel. 08 #22 | P3 |
| ALU-31 | [DEV] certificado de teste com código conhecido no banco | sem sessão, depois GP | 1) Abrir `/certificado/<código>`, `/certificado/abc` e o código em minúsculas. 2) GP abre a ficha da QA-TURMA-A1 (Alunos › turma) › progressão. | 1: "Certificado autêntico ✅" com nome, nível e data; "Código inválido…"; minúsculas aceitas. 2: "Elegível: concluir no fluxo acadêmico", sem botão de emitir. ℹ️ NÃO É BUG: a emissão de certificado está fora do escopo. | rel. 08 #29, #30 | P3 |
| ALU-32 | — | FIN | Empresas › Nova empresa "QA-EMP-02", país CR, dia de vencimento 29 › salvar; corrigir para 10 › salvar; inativar. | Dia 29 recusado (máximo 28); salva com 10; inativar pede confirmação. | rel. 08 #50 | P2 |
| ALU-33 | MAT-32 | FIN | Abrir a ficha da empresa "QA-EMP-01 SA" (ou a usada como pagadora no legado) › Colaboradores e faturas. | "Colaboradores (0)": "Nenhum contrato individual vinculado…"; se houver fatura antiga, o aviso "A cobrança de empresas (fatura B2B) está desligada…", sem "Pagar". ℹ️ NÃO É BUG: Empresas é só cadastro (§5). | §5; rel. 08 #51, #52 | P3 |
| ALU-34 | [DEV] CSV pequeno no formato de migração, com cabeçalho na linha 1 e 1 linha sem e-mail | ADM, depois SEC | 1) ADM: Configuração › Preparação de migração › ler o arquivo, mapear e preparar com a chave "QA-1"; preparar de novo com a mesma chave. 2) Detalhe do lote › Ensaiar cadastro › Aplicar. 3) SEC digita `/configuracao/migracao`. | 1: lote "Com pendências" (EMAIL_AUSENTE); a 2ª preparação devolve o mesmo lote. 2: a linha com pendência fica "Bloqueado"; a completa, "Aplicado", sem WhatsApp e sem comunicações. ⚠️ DECISÃO PENDENTE (rel. 08 #43): o aluno migrado fica sem código `A-`. 3: acesso negado. | rel. 08 #40, #42, #43 | P3 |

## Módulo 7 — DIA: diário de aulas, chamada, pendências, regularização, reposições e gravações

A aula de turma só fica "Ministrada" com a chamada completa **e** gravação oficial ou exceção de
gravação aprovada por outra pessoa. Sem Google Drive (🛑 B5), o caminho do UAT é sempre a exceção.
A chamada só abre depois do fim real do encontro (§6). Encontros da A1: D, D+2, D+3 e o 4º acrescentado
no ACD-PREP-19 (D+1 é o QA Feriado). A reposição só vai até "Autorizada" neste ciclo (§5).

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| DIA-01 | ACD-PREP-14; 5 min depois do início do 1º encontro da A1 | ADM | Abrir Configuração › Turmas. | QA-TURMA-A1 "Em andamento". Se continuar Planejada, pedir ao DEV para conferir o cron (PG-2 passo 18) e marcar [DEV]. | rel. 06 #4; rel. 09 #2 | P2 |
| DIA-02 | MAT-24, MAT-25; antes do fim do 1º encontro | PROF | 1) Diário de aulas › Encontros. 2) Abrir pela URL `/diario/encontros/<id do 1º encontro>`. | 1: não há "Abrir chamada" ainda; os horários mostram "exibido em …; origem …". 2: "A chamada exige encontro previsto já terminado.". | rel. 06 #17 | P2 |
| DIA-03 | Depois do fim do 1º encontro | PROF [MOB] | Abrir chamada; deixar o QA-ALUNO-01 "Não informado"; escrever o conteúdo da aula; salvar; abrir Pendências. | Salvo. Pendências mostra "Complete as presenças da chamada." e "Registre a gravação oficial ou solicite exceção.". | rel. 06 DIA-22 | P1 |
| DIA-04 | DIA-03 | PROF | Completar a chamada: QA-ALUNO-01 Presente, QA-ALUNO-02 Falta; salvar. | Salvo; a lista só tem os alunos alocados no início da aula (QA-ALUNO-01 e QA-ALUNO-02). | rel. 06 #18; crit. MAT-09 | P1 |
| DIA-05 | DIA-04; PG-2 extra E | PROF | "Publicar gravação e concluir aula" com um ID qualquer (ex.: `abc123`). | Falha e o encontro continua "Previsto". 🛑 BLOQUEADOR (B5). 🐞 BUG PROVÁVEL (rel. 06 #21): a mensagem é "Erro inesperado. Tente novamente." em vez de "Configuração de gravações indisponível."; abrir issue de severidade Baixa. | B5; rel. 06 #20, #21 | P2 |
| DIA-06 | DIA-04 | PROF | "Gravação irrecuperável": justificativa com 3 letras; depois uma justificativa válida. | Com menos de 5 caracteres o botão fica desabilitado; com a válida, "Solicitação enviada." e o item aparece em Exceções de gravação. | rel. 06 #22 | P1 |
| DIA-07 | DIA-06 | PROF, depois GP | 1) PROF abre Diário › Exceções de gravação. 2) GP aprova a exceção com motivo. 3) PROF reabre Pendências. | 1: vê a própria solicitação, sem botão de decidir. 2: encontro "Ministrado". 3: o item some. | rel. 06 #22 | P1 |
| DIA-08 | Depois do fim do 2º encontro (D+2) | PROF, GP, GP-2 | 1) Abrir a chamada: QA-ALUNO-01 "Impedido por restrição" sem observação, salvar; depois com observação; QA-ALUNO-02 Falta; salvar. 2) Solicitar exceção de gravação; depois mudar o conteúdo da chamada; GP tenta aprovar. 3) PROF solicita de novo; GP rejeita com motivo. 4) PROF solicita de novo; GP-2 aprova. | 1: "Registre a ocorrência do impedimento, sem dados financeiros"; com observação, salvo. 2: "O encontro ou diário mudou. Prepare uma nova solicitação para conferência.". 3: encontro continua "Previsto". 4: "Ministrado". | rel. 06 #19, #22; rel. 06 DIA-23, -27, -28 | P2 |
| DIA-09 | DIA-03 | GP | Abrir `/diario/encontros/<id de um encontro da PROF>` sem designação. | "Sem designação vigente para regularizar esta aula." ℹ️ O papel de gestão sozinho não preenche o diário de outra pessoa. | rel. 06 DIA-29 | P2 |
| DIA-10 | CFG-04; um encontro terminado e pendente | PROF, depois GP | 1) PROF: Pendências; anotar a quantidade de lembretes; recarregar duas vezes seguidas; recarregar de novo depois de 30 min. 2) GP: Pendências antes e depois de 60 min do fim da aula. | 1: prazo = fim da aula + 60 min; no mesmo intervalo a contagem não sobe; depois de 30 min sobe 1. 2: antes, sem "atrasada"; depois, "Prazo: … — atrasada"; o GP não tem "Abrir diário para regularizar". | rel. 06 #23; rel. 03 DIA-04 | P3 |
| DIA-11 | DIA-03 | PROF-2 | Abrir Pendências e Encontros. | Nenhum encontro da A1 aparece. | rel. 06 #10; crit. AC05 | P1 |
| DIA-12 | Depois do fim do 3º encontro, sem a PROF preencher | GP, PROF-2, PROF | 1) GP: Diário › Regularizações de aula: designar PROF-2 para o 3º encontro, com motivo. 2) PROF-2 abre a chamada pelo painel, marca as presenças e salva. 3) GP revoga a designação. 4) PROF-2 tenta abrir de novo. 5) PROF conclui o 3º encontro por exceção (como DIA-06 e DIA-07). | 2: salvo; o diário fica no nome da PROF (professora original). 4: "Sem designação vigente para regularizar esta aula.". 5: "Ministrado". | rel. 06 #24 | P2 |
| DIA-13 | DIA-08 | PROF, GP, GP-2 | 1) No 2º encontro (Ministrado), PROF › Propor correção: QA-ALUNO-01 de Impedido para Presente, com motivo. 2) PROF procura aprovar. 3) GP confere os impactos e aprova. 4) GP propõe outra correção e tenta aprovar a própria; GP-2 rejeita. 5) PROF propõe correção sem mudar nada. | 1 e 2: o histórico mantém o valor antigo; a PROF não aprova. 3: "Correção publicada · versão 1". 4: "Outra pessoa da gestão deve decidir a proposta, mesmo com acúmulo de papéis."; depois da rejeição a aula fica como estava. 5: "A proposta precisa identificar uma alteração na aula.". | rel. 06 #25 | P2 |
| DIA-14 | DIA-03 | PROF | Num encontro da A1, procurar "cancelar"; abrir `/diario/encontros/<id>/cancelamento`. | Não há opção; a URL mostra "Escolha um encontro particular contratado.". ℹ️ NÃO É BUG: cancelamento de aula de turma pelo professor não existe (§5). | §5; rel. 06 #26 | P3 |
| DIA-15 | ACD-PREP-05; o último encontro da A1 ainda "Previsto" | SEC, GP | 1) SEC: nova versão do calendário com um feriado no dia do último encontro da A1; GP tenta aprovar direto. 2) SEC prepara a revisão de replanejamento; GP aprova. 3) Seguir para o INB-26. | 1: "Há encontros publicados. Revise os impactos…". 2: o encontro vai para outra data só depois da aprovação. | rel. 06 #13, #29 | P2 |
| DIA-16 | — | PROF | Diário › "Registrar aula": 1) num horário passado sem encontro; 2) no horário exato de um encontro da A1. | 1: aceito como aula avulsa. ⚠️ DECISÃO PENDENTE (rel. 06 #49): registrar. 2: "Identifique o encontro da agenda para registrar esta aula.". | rel. 06 #49 | P3 |
| DIA-17 | — | PROF, GP, SEC, FIN | Abrir `/diario`. | PROF: abas Aulas, Encontros, Pendências, Regularizações de aula, Reposições, Exceções de gravação. GP: Aulas, Encontros, Pendências, Regularizações de aula, Exceções de gravação, Regularizações de gravação. SEC: só Encontros, sem barra de abas. FIN: acesso negado. | rel. 06 #52; rel. 01 §Acadêmico e Diário | P2 |
| DIA-18 | DIA-07 | PROF, FIN | Abrir `/diario/encontros/<id do 1º encontro>/gravacao`. | Os dois veem "Gravação indisponível para este acesso.". ℹ️ NÃO É BUG: a página não nega por papel, mas não mostra nada (rel. 06 #48). | rel. 06 #48 | P3 |
| DIA-19 | DIA-07 | SEC | Mudanças acadêmicas › Reposições: buscar a matrícula do QA-ALUNO-02; depois a do QA-ALUNO-01. | QA-ALUNO-02: a falta do 1º encontro aparece em "Solicitar a partir de ausência conferida". QA-ALUNO-01 (presente): nenhuma ausência elegível. | rel. 06 #34 | P1 |
| DIA-20 | DIA-19 | SEC | Solicitar reposição **por gravação** da falta do 1º encontro, com motivo e evidência; tentar solicitar de novo para a mesma falta. | 1ª: "Aguardando autorização". 2ª: "Esta falta já possui reposição pendente, autorizada, agendada ou concluída.". | rel. 06 #34 | P1 |
| DIA-21 | DIA-20; DIA-08 | SEC, GP | 1) SEC procura decidir; GP aprova a reposição por gravação. 2) SEC solicita reposição **particular** da falta do 2º encontro; GP rejeita com motivo. 3) SEC solicita de novo; GP aprova. | 1: a SEC não decide; aprovada vira "Autorizada". 2: a falta volta a ser elegível, com aviso de pedido anterior rejeitado. 3: "Autorizada". | rel. 06 #35 | P1 |
| DIA-22 | DIA-21 | SEC | Na reposição particular autorizada, abrir a prévia do agendamento com PROF-2 num horário livre. | "Sem benefício normal vigente." e "A prévia não permite confirmar este horário.". ℹ️ NÃO É BUG: benefício e autorização excepcional não têm tela (§5). | §5; rel. 06 #36, #37 | P2 |
| DIA-23 | DIA-21; CFG-03 | GP, depois PROF | 1) GP: painel operacional da reposição por gravação › publicar o material com a gravação da aula original. 2) PROF abre Diário › Reposições. 3) GP designa a PROF como avaliadora; PROF recarrega. | 1: "A aula original não possui gravação oficial disponível…" (a aula foi concluída por exceção). 🛑 BLOQUEADOR (B5). 2: fila vazia. 3: "Aguardando entrega gravada". | B5; rel. 06 #41, #43 | P2 |
| DIA-24 | Uma reposição concluída (não acontece neste ciclo sem Drive e portal) | PROF | Abrir Diário de aulas › histórico da aula original da falta reposta. | Esperado: "Reposta em [data]". 🐞 BUG PROVÁVEL (X14): hoje aparece só "Ausente". Sem reposição concluída: 🛑 BLOQUEADOR (B5). | X14; B5; rel. 06 #44 | P3 |

## Módulo 8 — AVA: avaliações, oficialização, correção, segunda chamada, recuperação, fechamento e mudança de nível

O professor lança e submete; outra pessoa da gestão oficializa. Nota ausente nunca vira zero. A
oficialização já publica a nota no portal (⚠️ R4). A tela de segunda chamada só abre pela URL (§5):
o `<alocacaoId>` é o número que aparece na URL de Mudanças acadêmicas › Avaliações › vínculo do
aluno. Planejamento: QA-ALUNO-01 segue o caminho normal; QA-ALUNO-02 falta à I1 (segunda chamada) e
fica insuficiente em Escrita (recuperação); QA-ALUNO-X serve aos casos negativos.

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| AVA-01 | ACD-PREP-04; MAT-24; CFG-02 | PROF | Mudanças acadêmicas › Avaliações › vínculo do QA-ALUNO-01 › I1. | A I1 mostra só o campo Fala. (Sem fuso da escola, apareceria o aviso "Configurar o fuso da escola" no lugar do formulário, §6.) | crit. ACA-07; rel. 05 #11 | P1 |
| AVA-02 | AVA-01 | PROF | Na F1 do QA-ALUNO-01: 1) nota 11; 2) data futura; 3) data anterior à entrada do aluno; 4) data de hoje, um campo vazio, "salvar rascunho"; 5) submeter com o campo vazio. | 1: "Nota fora da escala configurada". 2 e 3: "A data da avaliação precisa estar no vínculo…". 4: rascunho salvo. 5: recusado, "Preencha as notas… sem zero". | crit. ACA-05 | P2 |
| AVA-03 | AVA-01 | PROF | Na I1 do QA-ALUNO-01: nota 8, comentário ao aluno e comentário interno, data de hoje › Submeter. | Pendência "aguardando oficialização". | crit. ACA-22 | P1 |
| AVA-04 | AVA-03 | PROF-2, depois ADM | 1) PROF-2 abre a URL da avaliação do QA-ALUNO-01. 2) ADM tenta lançar uma nota na mesma avaliação. | 1: o vínculo não aparece ou acesso negado. 2: "Somente o professor com atribuição vigente…". | crit. ACA-22; rel. 05 AVA-16 | P1 |
| AVA-05 | AVA-03 | GP, depois Aluno | 1) GP abre a I1 submetida e oficializa com motivo. 2) Se o ALU-24 passou: o aluno abre `/portal-aluno/resultados`. | 1: nota oficial. 2: a nota e o comentário ao aluno aparecem logo após a oficialização; o comentário interno nunca aparece. ⚠️ DECISÃO PENDENTE (R4): oficializar já divulga ao aluno; registrar. Sem portal: 🛑 B4 só no passo 2. | R4; crit. ACA-22, ACA-23 | P1 |
| AVA-06 | AVA-05 | GP | Abrir o vínculo do QA-ALUNO-01 (`/academico/avaliacoes/<alocacaoId>`) com a I1 oficial e a F1 em rascunho. | F1 "Pendente — nota ausente"; média geral pendente; nenhum zero; frequência e "Avaliações: versão 1". | crit. ACA-02, ACA-06 | P2 |
| AVA-07 | AVA-06 | PROF, depois GP | 1) PROF submete a F1 do QA-ALUNO-01 com uma habilidade exatamente no mínimo. 2) GP oficializa. 3) Conferir a média na calculadora (soma de nota × peso dividida pela soma dos pesos). | 2: nota oficial. 3: valores com 2 casas decimais iguais aos da calculadora; "Mínimo atingido" na habilidade igual ao mínimo. | crit. ACA-08, ACA-09, ACA-10 | P1 |
| AVA-08 | MAT-25 | PROF, GP | 1) PROF salva em rascunho a F1 do QA-ALUNO-02 com média acima do mínimo e Escrita abaixo do mínimo da habilidade. 2) GP tenta oficializar o rascunho. 3) PROF submete; GP devolve com motivo. 4) PROF submete de novo; GP oficializa. 5) PROF tenta editar a nota oficial. 6) GP abre o vínculo. | 2: "não pode ser oficializado". 3: a devolução aparece para a PROF. 4: oficial. 5: "Nota oficial exige o fluxo de correção". 6: resultado insuficiente em Escrita; a média não compensa. A I1 do QA-ALUNO-02 continua sem nota (ele "faltou"). | crit. ACA-10, ACA-22 | P1 |
| AVA-09 | AVA-08 | GP, depois PROF | 1) GP abre `/academico/avaliacoes/<alocacaoId do QA-ALUNO-02>/fechamento` e tenta confirmar. 2) PROF abre a mesma URL. | 1: pendências listadas (I1 sem nota, Escrita insuficiente); confirmar é recusado com "Resolva as pendências…". 2: acesso negado. | crit. ACA-34 | P1 |
| AVA-10 | AVA-07 | PROF, GP, GP-2 | 1) Na I1 oficial do QA-ALUNO-01, PROF usa "Propor correção" para 7, com motivo. 2) Conferir o vínculo. 3) GP aprova em `/academico/correcoes/<…>`. 4) GP propõe uma correção na F1 e tenta decidir a própria; GP-2 rejeita. | 2: proposta pendente; o consolidado continua com 8. 3: o 7 passa a valer no consolidado (e no portal). 4: recusado para o autor; depois da rejeição a F1 não muda. | crit. ACA-24 | P1 |
| AVA-11 | AVA-08 | GP, depois PROF | 1) No vínculo do QA-ALUNO-02, procurar um link para pedir segunda chamada da I1. 2) Abrir `/academico/segundas-chamadas/<alocacaoId>/I1`. 3) PROF abre a mesma URL e propõe a segunda chamada. 4) Procurar "prorrogar prazo" e "oportunidade extra". | 1: não há link. 2: saldo e histórico. 3: proposta pendente, com o saldo. 4: não existem. ℹ️ NÃO É BUG: a tela só abre pela URL e prorrogação e extra não têm tela (§5). | §5; rel. 05 #1, #2; crit. ACA-26 | P1 |
| AVA-12 | AVA-11 | GP | Na mesma tela, aprovar a proposta e disponibilizar, com data, condições e evidência de comunicação ao aluno. | Prazo exibido = disponibilização + minutos da regra. ℹ️ O prazo conta minutos corridos e não pula feriado (rel. 05 #14). | rel. 05 #14; crit. ACA-29 | P1 |
| AVA-13 | AVA-12 | SEC | Mudanças acadêmicas › Segundas chamadas pendentes › item do QA-ALUNO-02 › preparar a agenda: professora PROF, horário dentro do prazo. Se o prazo alcançar um dia não letivo, tentar esse dia também. Depois procurar como decidir. | A prévia mostra prazo e conflitos; dia não letivo exige justificativa e marcação explícita. A SEC não decide. | crit. AGI E3, E4 (rel. 05) | P1 |
| AVA-14 | AVA-13 | GP, depois SEC | 1) GP tenta aprovar uma agenda que termina depois do prazo. 2) GP aprova a agenda válida. 3) SEC abre `/academico/segundas-chamadas/reservas/<id da reserva>/cancelamento`. | 1: recusada. 2: reserva "Reservada", encontro "Previsto" de segunda chamada, saldo −1, item em Agendas de segunda chamada. 3: acesso negado. ⚠️ DECISÃO PENDENTE (R6): a Secretaria não cancela segunda chamada; registrar. | R6; crit. AGI CA3; rel. 05 #15 | P1 |
| AVA-15 | AVA-14 | SEC, depois GP | Agendas de segunda chamada › "Abrir remarcação" com novo horário; GP decide. | Encontro antigo "Cancelado" e novo "Previsto", mesma reserva, prazo inalterado. ℹ️ Dia não letivo aparece só como "N período(s) não letivo(s)", sem nomes (rel. 05 #16). | crit. REM 5, 6; rel. 05 #16 | P2 |
| AVA-16 | AVA-15 | SEC, GP, PROF, PROF-2 | 1) Agendas › "Substituir professor" por PROF-2; GP decide. 2) PROF abre Minhas segundas chamadas. 3) PROF-2 abre Minhas segundas chamadas. | 2: a PROF não consegue registrar a realização. 3: a reserva aparece para o PROF-2. | crit. SUB 3, 5 | P2 |
| AVA-17 | AVA-16; no horário do encontro de segunda chamada (entre o início e o fim) | PROF-2, depois GP | 1) PROF-2: Minhas segundas chamadas › registrar a realização e a nota da I1 do QA-ALUNO-02. 2) GP oficializa na I1. | 1: reserva consumida pela realização; a nota entra como submetida na I1 original. 2: oficial (o GP não é quem realizou). | crit. ACA-26; rel. 05 AVA-32 | P1 |
| AVA-18 | AVA-08; MAT-28 | PROF, PROF-2, GP | 1) PROF: `/academico/recuperacoes/planos?alocacaoId=<do QA-ALUNO-02>` › preparar o plano (Escrita). 2) PROF-2 tenta preparar plano para o QA-ALUNO-X (sem nota lançada). 3) GP aprova o plano da PROF. | 1: plano proposto com a habilidade Escrita. 2: recusado (nota ausente vai para segunda chamada). 3: aprovado. | crit. ACA-12, ACA-15 | P1 |
| AVA-19 | AVA-18 | GP | Em `/academico/recuperacoes/planos/<id>`: disponibilizar e reservar a tentativa de Escrita. | O prazo começa na disponibilização; a tela mostra, por habilidade, limite, consumo, reserva e disponível. | crit. ACA-14, ACA-16 | P1 |
| AVA-20 | AVA-19 | PROF, depois GP | PROF registra a realização e a nota de recuperação de Escrita maior que a original; GP oficializa. | O consolidado passa a usar a maior nota; a tentativa fica no histórico do cálculo. | crit. ACA-13 | P1 |
| AVA-21 | AVA-19 | PROF, GP, GP-2 | 1) PROF: `/planos/<id>/prorrogacoes` › propor prorrogação; GP decide. 2) GP propõe outra prorrogação e tenta decidir a própria. 3) Procurar "falta" ou "cancelamento pelo aluno" na tentativa. | 1: novo prazo vale. 2: recusado. 3: não existem. ℹ️ NÃO É BUG (§5). Se algum prazo de recuperação vencer sem realização, o fechamento fica bloqueado sem saída: ⚠️ DECISÃO PENDENTE (R5), registrar. | R5; §5; rel. 05 #4, #5 | P3 |
| AVA-22 | ALU-11 (período da pausa anotado) | PROF-2 | Lançar uma avaliação do QA-ALUNO-X com data dentro do período em que a matrícula esteve pausada. | Recusado ("Confira a situação contratual…"). | crit. ACA-31 | P2 |
| AVA-23 | MAT-28 | GP | Abrir o fechamento do QA-ALUNO-X (turma A2, sem nenhuma chamada registrada). | Pendência "frequência não apurada". ℹ️ O fechamento exige ao menos uma aula concluída com chamada (§6). | rel. 05 #13 | P2 |
| AVA-24 | AVA-17, AVA-20; DIA-08 | GP, GP-2 | 1) No fechamento do QA-ALUNO-02 (com faltas), GP propõe exceção de frequência e tenta decidir. 2) GP-2 decide. 3) GP confirma o fechamento. | 1: autoexceção recusada. 2: aprovada; o percentual real continua visível. 3: versão 1 confirmada, com o resultado calculado. | crit. ACA-11, ACA-34 | P2 |
| AVA-25 | AVA-10; DIA-07 | GP, depois Aluno | 1) GP confirma o fechamento do QA-ALUNO-01. 2) Se o ALU-24 passou: o aluno abre os resultados. | 1: versão 1, confirmada por uma pessoa só. 2: "Fechamento confirmado" com o resultado. Sem portal: 🛑 B4 só no passo 2. | crit. ACA-34; rel. 05 AVA-48 | P1 |
| AVA-26 | AVA-25 | PROF, GP | 1) PROF propõe correção da F1 do QA-ALUNO-01; GP aprova. 2) Abrir o portal (se houver). 3) GP reabre o fechamento e confirma de novo. | 2: "em revisão". 3: a tela exige nova versão (v2); a v1 continua no histórico. | rel. 05 AVA-50 | P2 |
| AVA-27 | AVA-26 | SEC, PROF, PROF-2 | 1) SEC: `/alunos/<QA-ALUNO-01>/academico` › solicitar mudança para o nível seguinte (motivo, horário confirmado). 2) SEC tenta uma 2ª solicitação na mesma matrícula. 3) PROF registra parecer em Mudanças acadêmicas. 4) PROF-2 procura o pedido. | 1: PENDENTE; o aluno continua na A1. 2: recusada. 3: parecer gravado; status continua PENDENTE. 4: o PROF-2 não vê o aluno. | rel. 05 AVA-51, -52; §7 (doc 40) | P1 |
| AVA-28 | AVA-27 | GP, SEC | 1) GP aprova o pedido do QA-ALUNO-01. 2) SEC solicita mudança para o QA-ALUNO-X; GP tenta aprovar. 3) GP solicita mudança para o QA-ALUNO-02 e procura o botão de aprovar. 4) SEC cancela, com motivo, os pedidos do QA-ALUNO-X e do QA-ALUNO-02. | 1: APROVADA; o aluno ainda na A1 (sem turma do nível seguinte, a execução fica Não aplicável). 2: "exige fechamento acadêmico suficiente…". 3: o botão não aparece para quem pediu. 4: CANCELADA. ℹ️ Ninguém recebe aviso (rel. 05 #22). | rel. 05 #20, #22; crit. ACA-18 | P1 |
| AVA-29 | AVA-28 | GP, GP-2, SEC | 1) GP: `/academico/avaliacoes/<alocacaoId do QA-ALUNO-02>/equivalencia` › preparar o aproveitamento para a QA-TURMA-A2. 2) GP-2 decide em `/academico/equivalencias/<id>`. 3) SEC executa. 4) Na ficha do aluno, procurar "Trocar turma". | 3: origem encerrada; destino A2 com as notas aproveitadas; a SEC não vê as notas. 4: não há troca direta; a mensagem remete ao fluxo de equivalência. ℹ️ NÃO É BUG: o doc 40 está desatualizado (§7). | §7; crit. ACA-33; rel. 05 #19 | P2 |
| AVA-30 | AVA-29; conta de portal do QA-ALUNO-02 (opcional, como ALU-23 e ALU-24) | Aluno | Abrir `/portal-aluno/resultados`. | Aparecem os blocos da A2 **e** da A1 encerrada. ⚠️ DECISÃO PENDENTE (R8): registrar. Sem conta: Não aplicável ou 🛑 B4. | R8; rel. 05 #8 | P3 |

## Módulo 9 — FIN: cobranças, pagamentos, descontos, aprovações, comissões e acertos

No UAT o pagamento é sempre manual: a Secretaria informa e outro usuário do Financeiro confirma, ou o
Financeiro registra o recebimento (🛑 B3). Toda aprovação compara pessoas, não papéis. "Em atraso" é
calculado na leitura e não é gravado (§6). Cobranças usadas: mensalidade do QA-ALUNO-01, do
QA-ALUNO-02 e do QA-ALUNO-X, e as mensalidades do QA-ALUNO-L1 (se o legado estiver no ciclo, R1).

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| FIN-01 | — | FIN | Abrir Financeiro e conferir as abas. | Cobranças, A conferir, Retomadas, Comissões, Descontos, Visão geral e Câmbio. Sem Política de comissão (sem a permissão) e sem Aprovações. | rel. 07 FIN7-07; rel. 01 §Financeiro | P1 |
| FIN-02 | — | GC | 1) Clicar em Financeiro. 2) Abrir `/financeiro/descontos` e `/financeiro/aprovacoes`. | 1: esperado: abre a aba Comissões com os dados da equipe. 🐞 BUG PROVÁVEL (X4): hoje deve aparecer "Não foi possível carregar o financeiro". 2: as duas carregam. | X4; rel. 07 #25 | P1 |
| FIN-03 | MAT-24 | SEC | 1) Digitar `/financeiro` e `/financeiro/informes`. 2) Abrir a ficha financeira do QA-ALUNO-01. | 1: "Acesso negado — o financeiro", sem dados. 2: o botão se chama "Informar pagamento" (não "Registrar recebimento"). ℹ️ A Secretaria opera pela ficha do aluno. | rel. 07 #6, #41 | P1 |
| FIN-04 | MAT-24, MAT-28 | VEND-A | Abrir `/alunos/<QA-ALUNO-01>/financeiro`; depois `/alunos/<QA-ALUNO-X>/financeiro` (aluno do VEND-B). | 1º: "Acompanhamento comercial", com preços e a própria comissão. 2º: página não encontrada. | crit. AC01; rel. 07 FIN7-10 | P1 |
| FIN-05 | MAT-24 | FIN | 1) Financeiro › Cobranças: clicar em cada cartão (A vencer, Em atraso, Bloquear, Promessas, Recebido hoje) e buscar o QA-ALUNO-01; dar F5. 2) Numa cobrança com degrau devido: "Abrir WhatsApp" e fechar sem confirmar; reabrir. 3) "Confirmar envio". | 1: os cartões filtram; a URL guarda o filtro e o F5 mantém. 2: abre `wa.me` com o telefone do pagador; nada fica no histórico. 3: o histórico mostra o passo (ex.: D-3) e a fila avança para o próximo degrau. | rel. 07 #33 | P2 |
| FIN-06 | FIN-05 | FIN | Registrar promessa de pagamento para daqui a 3 dias; depois tentar com a data de ontem. | A cobrança vai para "Promessas" e sai da ação do dia; o vencimento não muda. Ontem: "A data prometida não pode ser no passado.". | rel. 07 FIN7-16 | P2 |
| FIN-07 | CFG-32 | FIN, ADM, DEV | 1) Com a política Desligada e o remetente QA Cobrança: numa cobrança com ação devida, "Cobrar via API" › confirmar. 2) Marcar duas cobranças › "Aprovar e enviar lote". 3) [DEV] ADM arma a política em "Ensaio"; o DEV dispara o cron duas vezes. 4) ADM volta a política para Desligada. | 1: "Ensaio (shadow): <passo> simulado — nada foi enviado de verdade."; a linha mostra "Braço API · <passo>: Simulada (ensaio)". 2: resultado com a contagem e "simulada(s) (ensaio)". 3: D-7, D-3 e D0 ficam "Simulada (ensaio)" sem duplicar no 2º disparo; D+3, D+7 e D+15 não saem sozinhos. | B8; rel. 03 COB-01 a -03 | P3 |
| FIN-08 | MAT-24 | SEC | Ficha financeira do QA-ALUNO-01 › mensalidade › "Informar pagamento" de 40% do valor, com comprovante fictício; dar duplo clique rápido no botão. | Um só informe "A conferir"; o saldo da mensalidade não muda; a matrícula não muda. | crit. AC10, AC13 | P1 |
| FIN-09 | FIN-08 | FIN | Financeiro › Cobranças › a mesma mensalidade › "Abrir WhatsApp". | "Lembretes estão suspensos enquanto o pagamento está em conferência." | rel. 07 FIN7-18 | P2 |
| FIN-10 | FIN-08 | FIN | Financeiro › A conferir › "Confirmar recebimento". | Informe Confirmado; recebido 40% e saldo 60%; status continua Pendente (ou Em atraso); o contador da aba diminui. | crit. AC11 | P1 |
| FIN-11 | FIN-10 | SEC, depois FIN | 1) SEC informa outro pagamento de 10% na mesma mensalidade. 2) FIN clica em Rejeitar sem motivo; depois com motivo. | 2: sem motivo o botão fica desabilitado; com motivo, Rejeitado; o saldo não muda e o informe fica no histórico. | crit. AC11 | P1 |
| FIN-12 | FIN-10 | FIN+SEC, depois FIN | 1) FIN+SEC informa um pagamento de 10% na mensalidade do QA-ALUNO-01. 2) Em Financeiro › A conferir, FIN+SEC tenta confirmar o próprio informe. 3) FIN rejeita com motivo, para limpar. | 2: "A conferência exige outra pessoa, mesmo quando você acumula papéis.". | crit. AC12 | P1 |
| FIN-13 | MAT-35 (R1) | FIN | `/financeiro/recebimentos`: 1) um valor repartido entre duas mensalidades abertas do QA-ALUNO-L1, com total diferente do valor. 2) Um destino maior que o saldo da mensalidade. 3) Repartição correta, com evidência em cada destino. | 1: "As destinações devem consumir exatamente o recebimento; o saldo deve virar crédito explícito.". 2: "A destinação excede o saldo devido…". 3: um recebimento e duas mensalidades com saldo reduzido. | crit. MAT-13; rel. 07 #7 | P2 |
| FIN-14 | MAT-19 | FIN | 1) Na taxa paga da QA-MAT-01, tentar Renegociar. 2) Procurar uma ação para estornar o recebimento. | 1: "Cobrança paga ou cancelada não aceita ajuste.". 2: não existe. ℹ️ NÃO É BUG: estorno de recebimento confirmado está fora do escopo (§5). | §5; rel. 07 #8 | P2 |
| FIN-15 | — | sem sessão | Abrir `/pagar/abc`; depois `/pagar/` seguido de 48 caracteres hexadecimais inventados (0-9 e a-f). | "Link de pagamento inválido", com orientação para falar com a Secretaria; depois "Link de pagamento expirado". | rel. 07 FIN7-28, -29 | P2 |
| FIN-16 | [DEV] o DEV grava uma referência de pagamento numa cobrança de teste | sem sessão, DEV | 1) Abrir `/pagar/<token>` com a cobrança Pendente; depois vencida mas ainda Pendente no banco. 2) O DEV muda para Paga e depois para Cancelada. 3) O DEV faz POST no webhook simulado com o token. | 1: valor, vencimento, "Pagamento em aberto" e "Pagamento online indisponível no momento…", sem botão de pagar. 🛑 BLOQUEADOR (B3); ⚠️ DECISÃO PENDENTE (R2). A vencida também aparece como "Pagamento em aberto" (ℹ️ §6). 2: "Pagamento confirmado" / "Cobrança cancelada", sem valor. 3: 404 `{"erro":"Pagamento simulado desabilitado."}`; a cobrança não muda. | B3; R2; rel. 07 #1, #4 | P3 |
| FIN-17 | CFG-20; MAT-24 | VEND-A | Ficha financeira do QA-ALUNO-01 › mensalidade › desconto de 5%. | "Preço ajustado dentro da alçada.". | crit. AC16 | P1 |
| FIN-18 | FIN-17 | VEND-A | Na mesma mensalidade, novo valor 12% abaixo da referência. | "Pedido encaminhado para aprovação independente."; o valor não muda. ℹ️ O desconto é acumulado (5% + 7% = 12% > 10%). | crit. AC16, AC18; rel. 07 #11 | P1 |
| FIN-19 | FIN-18 | GC | Financeiro › Aprovações › aprovar o pedido do VEND-A. | Valor aplicado; o histórico de negociação mostra o autor e a aprovação. | crit. AC16 | P1 |
| FIN-20 | MAT-25 | GC, depois ADM | 1) GC pede um desconto numa mensalidade do QA-ALUNO-02 (aluno da equipe). 2) GC abre Aprovações. 3) ADM abre Aprovações e decide. | 2: o GC não vê o próprio pedido. 3: o ADM vê e aprova. | crit. AC19; rel. 07 #15 | P1 |
| FIN-21 | FIN-19 | VEND-A, GC, ADM | 1) VEND-A pede 30% de desconto na mensalidade do QA-ALUNO-01. 2) GC (alçada 20%) tenta aprovar. 3) ADM aprova. | 2: "Desconto acima da sua alçada. Encaminhe à direção.". 3: aplicado. | rel. 07 #15; crit. AC16 | P1 |
| FIN-22 | MAT-28; CFG-20 | VEND-B, FIN, GC | 1) VEND-B dá 30% de desconto na mensalidade do QA-ALUNO-X. 2) VEND-B pede 55%. 3) FIN registra um recebimento parcial nessa mensalidade. 4) GC tenta aprovar o pedido de 55%. | 1: aplicado direto (alçada da mensalidade = 50%). 2: vai para aprovação. 4: "A cobrança mudou desde a solicitação. Envie um novo pedido.". ℹ️ Taxa e mensalidade têm alçadas separadas. | crit. AC14, AC16; rel. 07 #16 | P2 |
| FIN-23 | MAT-25 | FIN | Ficha financeira do QA-ALUNO-02 › Renegociar com qualquer desconto. | "Ajuste acima do limite — enviado para aprovação."; o FIN não tem a aba Aprovações. ⚠️ DECISÃO PENDENTE (rel. 07 #14): o kit antigo dizia "Financeiro sem limite"; registrar. | rel. 07 #14 | P2 |
| FIN-24 | MAT-24 | VEND-A | Numa mensalidade aberta do QA-ALUNO-01: aumentar o valor; depois adiar o vencimento. | Os dois são aplicados direto, sem aprovação. ⚠️ DECISÃO PENDENTE (R12): registrar. | R12 | P2 |
| FIN-25 | PG-1 (ADM-2); uma mensalidade aberta do QA-ALUNO-L1 (ou do QA-ALUNO-02) | ADM, ADM-2, FIN, VEND-A | 1) FIN e VEND-A procuram a opção "Perdão" na ficha financeira. 2) ADM pede o perdão da mensalidade. 3) ADM-2 aprova. | 1: a opção não aparece para eles. 3: mensalidade Cancelada. | rel. 07 #17 | P2 |
| FIN-26 | MAT-24, MAT-25, MAT-35 | VEND-A, VEND-B, FIN | 1) VEND-A e VEND-B abrem Comissões. 2) FIN confere as comissões das matrículas do ciclo. | 1: cada um vê só as próprias, com tipo (percentual ou fixo), status e previsão de pagamento. 2: QA-MAT-01 Aprovada = 10% da taxa; a do legado ficou Pendente até a ativação (⚠️ DECISÃO PENDENTE R1, rel. 04 #20). ℹ️ Não existe "Aprovar comissão": a aprovação é automática na ativação. | rel. 07 #18, #20; crit. AC21 | P1 |
| FIN-27 | FIN-26 | FIN, depois ADM | 1) FIN: Comissões › estornar uma Aprovada com motivo "Outro" sem detalhe; depois com detalhe. 2) "Fechar mês"; clicar de novo. 3) Tentar estornar uma Paga. 4) ADM abre Comissões (menu) e depois Financeiro › Comissões. | 1: "Descreva o motivo." e depois Estornada. 2: as Aprovadas viram Pagas (inclusive as do mês corrente, rel. 07 #21); de novo: "Nenhuma comissão aprovada para pagar.". 3: "Comissão já paga: o desconto no próximo fechamento ainda não existe." (ℹ️ §5). 4: 🐞 BUG PROVÁVEL (rel. 07 #22): o ADM não vê "Fechar mês" no menu Comissões; em Financeiro › Comissões, vê. | §5; rel. 07 #21, #22, #23 | P2 |
| FIN-28 | MAT-28 | FIN, ADM, DEV | 1) FIN: ficha financeira do QA-ALUNO-X › acesso às aulas › solicitar restrição manual com motivo; tentar decidir. 2) ADM aprova. 3) FIN registra um pagamento. 4) ADM libera a restrição. 5) [DEV] Opcional: cobrança com 30 dias de atraso e o cron disparado; depois o pagamento. | 1: o FIN não decide. 2: acesso restrito. 3: a restrição manual continua. 5: restrição automática depois do tick; o pagamento a remove. | rel. 07 #35 | P2 |
| FIN-29 | MAT-35 (R1) ou outra mensalidade aberta | FIN, GP, FIN-2 | `/financeiro/permuta`: 1) FIN prepara o acordo. 2) GP confirma o serviço do período. 3) FIN propõe a compensação e tenta decidir. 4) FIN-2 aprova. | 3: o FIN autor não decide (a mensagem pode ser genérica). 4: o saldo da mensalidade cai sem criar recebimento. | rel. 07 #28 | P2 |
| FIN-30 | — | FIN, depois GC | 1) FIN: `/financeiro/continuidade`. 2) Câmbio: cadastrar CRC manual; Visão geral › consolidar em USD; "buscar automaticamente". 3) GC procura a aba Câmbio e um botão de exportar no Financeiro. | 1: lista de estados (aguardar prazo, pronta, conferir oferta, regra a conferir), sem botão de emitir (ℹ️ §5). 2: consolidado com "≈" e aviso de referência; sem internet, mensagem amigável; as cobranças não mudam de moeda. 3: não existem para o GC (exportação financeira não existe para ninguém). | §5; rel. 07 #32, #37, #39 | P3 |

## Módulo 10 — PER: permissões transversais

Confere, por papel, as URLs que abrem e as que não abrem, digitando o endereço direto (não só
clicando no menu), e as ações que não devem aparecer. Use os IDs reais da massa do ciclo. Resultados
possíveis: abre; negado por redirecionamento (`/acesso-negado`); negado na tela ("Acesso negado" na
mesma URL); página não encontrada (registro fora do escopo). Depois do AVA-29 o QA-ALUNO-02 está na A2.

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| PER-01 | Massa do ciclo | VEND-A | Abrir: Funil, Carteira, Relatórios, Contatos, Tarefas, Comissões, Matrículas (`/secretaria`), Inbox e `/alunos/<QA-ALUNO-01>/financeiro`. | Todas abrem, sempre só com o escopo do VEND-A (Comissões só as próprias; a ficha financeira como "Acompanhamento comercial"). | rel. 01 §Matriz; crit. AC01 | P1 |
| PER-02 | Massa do ciclo | VEND-A | Digitar: `/aria`, `/alunos`, `/alunos/<QA-ALUNO-01>`, `/alunos/<QA-ALUNO-X>/financeiro`, `/financeiro`, `/empresas`, `/configuracao`, `/matriculas/<QA-MAT-01>/contrato`, `/academico`, `/diario`, `/financeiro/permuta`. | Negado em todas: `/alunos`, `/financeiro` e `/empresas` na tela; `/alunos/<id>` e as demais por redirecionamento; `/alunos/<QA-ALUNO-X>/financeiro` = página não encontrada. Em `/financeiro/permuta`: 🐞 BUG PROVÁVEL (X3): aparece "Não foi possível carregar esta tela" com "Tentar de novo" em vez de "Acesso negado". | X3; rel. 01 #6 | P1 |
| PER-03 | Massa do ciclo | VEND-A | Procurar: campo Responsável na nova oportunidade; Importar e Mesclar em Contatos; aba Coberturas; "Equipe" em Tarefas; "Encerrar atendimento" na Inbox; Exportar no Funil; "Perdão" na ficha financeira. | Nenhuma dessas ações aparece. | rel. 02 #16, #46; rel. 03 #15 | P2 |
| PER-04 | Massa do ciclo | GC | Abrir: Funil (só a equipe), Carteira (com Coberturas), Relatórios (6 abas), Agente de IA (sem seletor de estado), Contatos (com Importar e Mesclar), `/financeiro/descontos`, `/financeiro/aprovacoes`, `/configuracao/crm`, Matrículas e `/alunos/<QA-ALUNO-01>/financeiro`. | Todas abrem. `/configuracao/crm`: ⚠️ DECISÃO PENDENTE (R13), só por URL. | R13; crit. AC02 | P1 |
| PER-05 | Massa do ciclo | GC | 1) Clicar em Empresas no menu. 2) Digitar: `/alunos`, `/alunos/<QA-ALUNO-01>`, `/configuracao/crm/ia`, `/configuracao/whatsapp/numeros`, `/configuracao/contratos`, `/financeiro/permuta`. | 1: 🐞 BUG PROVÁVEL (X2): o item existe no menu, mas a página mostra "Acesso negado — … as empresas (B2B)". 2: negado nas quatro primeiras; em `/configuracao/contratos` e `/financeiro/permuta`, 🐞 BUG PROVÁVEL (X3): tela de erro genérica em vez de "Acesso negado". | X2; X3 | P1 |
| PER-06 | Massa do ciclo | SEC | Abrir: Matrículas, Reservas, Desistências, Envios do portal, Avisos de alterações na agenda, Contatos, Alunos, Mudanças acadêmicas, Configuração, `/alunos/<QA-ALUNO-01>/movimentacoes` e `/alunos/<QA-ALUNO-01>/portal`. | Todas abrem. Contatos mostra só alunos e responsáveis, sem oportunidades e sem "Nova oportunidade". Mudanças acadêmicas com 10 abas. Configuração vai direto para Modelos contratuais (única aba). | rel. 01 §Acadêmico; rel. 02 #38 | P1 |
| PER-07 | Massa do ciclo | SEC | 1) Clicar em Empresas no menu. 2) Digitar: `/funil`, `/financeiro`, `/configuracao/turmas`, `/configuracao/operacao`, `/configuracao/usuarios`, `/academico/regras`, `/aria`, `/financeiro/permuta`. | 1: 🐞 BUG PROVÁVEL (X2). 2: negado em todas; `/configuracao/turmas`: ⚠️ DECISÃO PENDENTE (R14); `/financeiro/permuta`: 🐞 BUG PROVÁVEL (X3). | X2; X3; R14 | P1 |
| PER-08 | Massa do ciclo | FIN | Abrir: Financeiro, `/financeiro/recebimentos`, `/financeiro/desistencias`, Permutas, Empresas, Alunos, `/alunos/<QA-ALUNO-01>/movimentacoes`, Comissões, Tarefas, Inbox e `/matriculas/<QA-MAT-01>/pagador`. | Todas abrem. Alunos sem dados pessoais; o pagador só em leitura. | rel. 01 §Matriz | P1 |
| PER-09 | Massa do ciclo | FIN | Digitar: `/funil`, `/contatos`, `/secretaria`, `/secretaria/desistencias`, `/configuracao`, `/academico`, `/diario`, `/matriculas/<QA-MAT-01>/contrato`, `/alunos/<QA-ALUNO-01>/portal`. | Negado em todas. | rel. 01 §Matriz; rel. 04 CT-59 | P1 |
| PER-10 | Massa do ciclo | GP | Abrir: Mudanças acadêmicas (14 abas), Diário de aulas, Configuração, Alunos, Permutas, Inbox e `/matriculas/<QA-MAT-01>`. | Todas abrem. Configuração vai para Catálogo (abas Catálogo e Turmas). Alunos mostra todos, sem contato e sem financeiro. Permutas só com a confirmação de serviço, sem valores de cobrança. | rel. 01 §Acadêmico; rel. 07 FIN7-11 | P1 |
| PER-11 | Massa do ciclo | GP | Digitar: `/financeiro`, `/alunos/<QA-ALUNO-01>/financeiro`, `/alunos/<QA-ALUNO-01>/movimentacoes`, `/alunos/<QA-ALUNO-01>/portal`, `/configuracao/contratos`, `/configuracao/usuarios`, `/funil`, `/tarefas`. | Negado em todas. `/alunos/<id>/movimentacoes`: ℹ️ NÃO É BUG (§6). `/configuracao/contratos`: 🐞 BUG PROVÁVEL (X3). | X3; §6 | P1 |
| PER-12 | AVA-29 | PROF | Abrir: Mudanças acadêmicas (6 abas), Diário de aulas (6 abas), Alunos, `/alunos/turma/<QA-TURMA-A1>`, Inbox, Indisponibilidades. | Todas abrem. Alunos só com o QA-ALUNO-01 (o QA-ALUNO-02 foi para a A2). Inbox só com atendimentos pedagógicos das suas turmas. | rel. 01 #11; crit. AC04, AC05 | P1 |
| PER-13 | AVA-29 | PROF | Digitar: `/alunos/<QA-ALUNO-X>`, `/alunos/<QA-ALUNO-02>`, `/alunos/turma/<QA-TURMA-A2>`, `/financeiro`, `/funil`, `/aria`, `/academico/regras`, `/academico/calendario`, `/matriculas/<QA-MAT-01>`, `/alunos/<QA-ALUNO-01>/financeiro`, `/secretaria/avisos-agenda`, `/configuracao`. | As três primeiras: página não encontrada. As demais: negado. | rel. 01 #11; rel. 04 CT-60 | P1 |
| PER-14 | — | ADM | 1) Abrir Configuração. 2) Abrir Financeiro. 3) Abrir Agente de IA. | 1: abre em Países, com 9 abas (Países, Modelos contratuais, Catálogo, Turmas, Usuários, Operação, Preparação de migração, CRM, WhatsApp). 2: 9 abas (Cobranças, A conferir, Retomadas, Comissões, Descontos, Visão geral, Política de comissão, Aprovações, Câmbio). 3: seletor de estado, matriz e provedor. | rel. 01 §Configuração, §Financeiro | P2 |
| PER-15 | GP define VEND+PROF como professor de uma turma QA com aluno (se não for possível, Não aplicável) | VEND+PROF | 1) Abrir a ficha do aluno da turma. 2) Abrir `/alunos/<id desse aluno>/financeiro`. | 1: abre a ficha pedagógica, sem dados pessoais. 2: página não encontrada (o escopo docente não abre o financeiro comercial). | crit. AC03 | P3 |

## Módulo 11 — HOM: Home por papel e interface

A Home muda por papel: Gerente (ADM e GC), Professor, e atalhos para os demais. Quem acumula GC e
Professor vê a do Gerente. Fecha o ciclo conferindo estados de interface e o uso no celular
(menu em gaveta abaixo de 768 px).

| ID | Pré-condição | Papel | Passos | Resultado esperado | Ref | Prioridade |
|---|---|---|---|---|---|---|
| HOM-01 | Massa do ciclo | ADM | Abrir a Home. | Cards Leads hoje, Conversão, Matrículas ativadas no mês e Recebido no mês (por moeda); Ranking de vendedores; Funil por etapa; Equipe. ℹ️ A nota "refinar (P10)" aparece na tela. | rel. 09 #37 | P2 |
| HOM-02 | CFG-20; uma oportunidade em Novo criada há mais de 60 min | GC, GC+V, FIN+SEC | 1) GC abre a Home e clica na faixa "Alertas de SLA". 2) GC+V abre a Home. 3) FIN+SEC abre a Home. | 1: ranking e equipe com VEND-A, VEND-B e VEND-0; a faixa mostra o alerta, mas clicar não leva a lugar nenhum: 🐞 BUG PROVÁVEL (rel. 09 #37), severidade Baixa. 2: Home do Gerente (nunca a de atalhos). 3: Home de atalhos. | rel. 09 #30, #37; rel. 09 HOME9-02, -03 | P2 |
| HOM-03 | VEND-A agenda uma experimental para daqui a 5 min numa nova "QA-OPORT-10" | GC | Depois do horário, abrir a Home. | A faixa "check-in vencido" conta essa experimental, que nenhum professor consegue resolver. 🛑 BLOQUEADOR (B6). | B6; rel. 02 #4 | P3 |
| HOM-04 | AVA-29 | PROF | Abrir a Home. | "Minhas turmas" com a A1 (dias, horário e número de alunos ativos). Não há "próxima aula" da turma nem agenda de hoje e amanhã. ⚠️ DECISÃO PENDENTE (rel. 06 #11): registrar. | rel. 06 #11; rel. 09 #36 | P2 |
| HOM-05 | — | VEND-A, GP, SEC, FIN | Abrir a Home. | "Olá, <nome>" com atalhos iguais aos itens do menu do papel. ℹ️ NÃO É BUG: não há Home de trabalho para esses papéis (rel. 09 #35). | rel. 09 #35 | P2 |
| HOM-06 | — | ADM [MOB] | Em 375 × 812: abrir Home, Configuração › Países e Configuração › Usuários; abrir e fechar o menu (inclusive com Escape). | Barra no topo com o botão de menu; a gaveta abre e fecha; as tabelas rolam na horizontal sem a página vazar para o lado. | rel. 09 #38 | P2 |
| HOM-07 | INB-03 | VEND-A [MOB] | Em 375 × 812: abrir o Funil, um cartão e a Inbox; abrir as ações do atendimento. | O painel da oportunidade cabe na tela; as ações do atendimento abrem numa folha que sobe do rodapé. | rel. 09 §Estados (bottom sheet) | P2 |
| HOM-08 | — | GP, ADM [MOB] | Em 375 × 812: GP abre o formulário de nova turma; ADM abre a confirmação de desativar um usuário (cancelar). | Os diálogos cabem na tela e rolam; nada fica escondido atrás do teclado. | rel. 09 UI9-03 | P3 |
| HOM-09 | — | ADM | Abrir a confirmação de desativar um usuário e apertar Enter de imediato; depois Escape. | O foco inicial está em "Voltar": Enter não desativa ninguém; Escape fecha sem agir. | rel. 09 §Estados (confirmação) | P3 |
| HOM-10 | — | VEND-0, depois GC | 1) VEND-0 abre Carteira e Tarefas (sem dados) e busca no Funil um nome que não existe. 2) GC digita `/configuracao/contratos`. | 1: mensagens de estado vazio com texto explicativo, não uma tabela em branco. 2: o erro aparece dentro do menu, com "Tentar de novo" e um caminho de volta, sem mensagem técnica (o fato de não ser "Acesso negado" já está no PER-05, X3). | rel. 09 §Estados, #39 | P3 |

## Fora do escopo deste ciclo

Não testar e não abrir bug (consolidado §5). Se aparecer na tela, registrar só como observação.

- Motor de risco de cobrança (doc 25): não existe tier nem score.
- Estorno automático de comissão quando a matrícula é cancelada.
- Estorno de recebimento já confirmado.
- B2B: fatura única e lote de colaboradores, desligados por decisão do dono (D9); Empresas é só cadastro e "Colaboradores" fica sempre vazio.
- LGPD: exportação, anonimização e exclusão por aluno, e consentimento por canal e finalidade.
- Cancelamento de aula de turma pedido pelo professor (Q08).
- Remarcação pontual de um encontro de turma (só existe o replanejamento global do calendário).
- Substituição temporária de professor em aula de turma (sem tela).
- Reposição particular: benefício do plano e autorização excepcional só no servidor; reposição por gravação depende de Drive e de conta do portal. Neste ciclo, a reposição vai só até "Autorizada".
- Segunda chamada: prorrogação (Q149) e oportunidade extra (Q150) sem tela; propor e decidir só pela URL.
- Recuperação: falta e cancelamento pelo aluno (Q137); a antecedência de cancelamento é configurada e nunca usada.
- Lead automático, saudação e réguas comerciais (C1, C2), removidos com o CRM antigo; LC-10 e LC-11 (histórico de 30 dias) da SPEC-005.
- Continuidade mensal: exige flag de ambiente e uma chamada externa que nada agenda.
- Régua de cobrança automática: começa desligada.
- Modo simulado de e-mail: não existe; convites e avisos ficam "Preparado".

## Checklist de fim de ciclo

1. **Planilha de resultados completa:** todo ID deste roteiro com um resultado (Passou, Falhou,
   Bloqueado, Não aplicável), data, usuário, navegador, observação e o `sha` de `/api/health` de
   cada dia. Nenhum cenário ⏭ pode ficar como "adiado".
2. **Issues abertas:** lista com número da issue, ID do cenário, X# ou "rel. 0N #x", severidade e
   etiqueta de módulo. Todo 🐞 confirmado tem issue; todo 🐞 que não reproduziu está anotado como
   "X# não reproduz", para o gestor tirar da lista.
3. **Lista de decisões para o PO:** uma linha por R# (R1 a R14) e por "rel. 0N #x" marcado com ⚠️,
   com os cenários que o exercitaram, o comportamento observado e a evidência. R# sem cenário
   executável neste ciclo (ex.: R7, que depende de autorização especial com matrícula passando de
   pausada a encerrada) entra como "não exercitado".
4. **Bloqueios:** quantos cenários ficaram Bloqueados por B1 a B8 e por [DEV], e quais B# o DEV
   resolveu durante o ciclo (reexecutar esses cenários antes de fechar).
5. **Resumo por módulo**, no formato:

   | Módulo | Cenários | Passou | Falhou | Bloqueado | Não aplicável | Issues |
   |---|---|---|---|---|---|---|
   | 0. ACE | 18 | | | | | |
   | 1. CFG | 38 | | | | | |
   | 2. ACD-PREP | 20 | | | | | |
   | 3. CRM | 38 | | | | | |
   | 4. INB | 28 | | | | | |
   | 5. MAT | 35 | | | | | |
   | 6. ALU | 34 | | | | | |
   | 7. DIA | 24 | | | | | |
   | 8. AVA | 30 | | | | | |
   | 9. FIN | 30 | | | | | |
   | 10. PER | 15 | | | | | |
   | 11. HOM | 10 | | | | | |
   | **Total** | **320** | | | | | |

6. **Ambiente devolvido:** política da régua Desligada, Aria Desligada, nenhum número de WhatsApp
   conectado, usuários de teste reativados ou desativados como estavam no início. Não apagar dados:
   o DEV limpa pelo prefixo QA.
7. **Roteiro:** anotar os cenários cujo texto não bateu com a tela (rótulo, mensagem, caminho), para
   a revisão do roteiro antes do próximo ciclo.
