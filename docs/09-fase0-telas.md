# Fase 0 — Telas (UX)

> Especificação tela por tela da Fase 0 (operação 100% manual, sem automações).

## App shell (moldura de todas as telas)

Toda tela vive dentro de uma moldura com **menu lateral persistente**:
- Itens: **Home · Pipeline · Leads · Alunos · Financeiro · Configuração** (role-aware — mostra só o que o papel acessa).
- Rodapé do menu: **usuário logado** (e troca de conta/logout).
- **Estado ativo destacado em DOIS níveis:** a **seção** no menu lateral **+** a **sub-aba**
  (ex.: Configuração → **Países**). A pessoa sempre sabe **onde está**.
  A **sub-aba ativa é um botão preenchido** (destaque forte, não só sublinhado).

## Filosofia da Home

**A Home é uma lista de tarefas inteligente, não um relatório.** A pergunta que ela
responde no segundo em que abre: *"com quem eu falo agora?"*. Home como **ação**, não
como dashboard. É a tela que mais aumenta matrícula.

> Fase 0: a "inteligência" da priorização é **regra determinística** (tempo + etapa),
> não IA. O scoring por IA ("maior chance de virar matrícula") entra na Fase 1+.

---

## Tela: Home do Vendedor

Ordem dos blocos (revisada com o usuário — de cima pra baixo):

> Sem botão "Iniciar trabalho": entrou no CRM → já está trabalhando (a fila é o trabalho).
> No **cabeçalho**: indicador de **SLA do dia** (ex.: "95%") e **leads atrasados** (ex.: "0") —
> importa pro vendedor e pro gerente.

### 1. Cards de topo (4)
Saudação + 4 cards. **Comissão sobe pro topo** (vendedor trabalha por meta e comissão):
| Card | Exemplo | Cor |
|---|---|---|
| Leads novos | 3 | vermelho |
| Follow-ups vencidos | 5 | âmbar |
| Experimentais hoje | 3 | azul |
| **Comissão prevista** | R$ 2.340 | verde |

> "Proposta aguardando" sai dos cards do topo (continua aparecendo na fila).

### 2. Oportunidades de hoje (central de ação)
A "sugestão" que diferencia a Genius de HubSpot/Pipedrive/RD — **clicável**, cada item com
ação (**[Atender]** / **[Ver detalhes]**). Não é vitrine, é central de ação.
**Duas velocidades, sem número falso:**
- **Fase 0/1 (regras):** mostra **faixa de prioridade** (`Alta / Média` ou `Quente / Morno / Frio`),
  não porcentagem. Honesto e igualmente útil ("vale teu tempo agora").
- **Fase 1+ (IA real):** quando houver modelo calibrado, aí sim aparece o **% real** de conversão.

> **Decisão:** não exibir "% de chance" derivado de regra simples — erode a confiança do
> vendedor e contamina a previsão da gestão. Faixa de prioridade até ter modelo de verdade.

### 3. Fila de trabalho (o coração)
Lista priorizada por **regras**:
| Prioridade | Lead | Motivo |
|---|---|---|
| 🔥 | Maria | Entrou há 4 min |
| 🔥 | João | SLA vencendo em 2 min |
| ⚠️ | Carlos | Follow-up D+3 |
| 💰 | Pedro | Proposta enviada há 5 dias |

Ações: **[Abrir conversa]** · **[Próximo lead]**

> **Modo Foco (call center)** — o botão **"Próximo lead"** serve **um lead por vez**; o
> vendedor resolve e avança. É o **antídoto contra "ficar arrastando card"**.

### 4. Agenda de hoje (destaque)
A experimental é o evento mais importante do dia. **No topo, a próxima aula em destaque**
com contagem regressiva; abaixo, a agenda completa (sem abrir outra tela):
```
Próxima aula experimental
18h • Ana — faltam 7h23min
──────────────
14h - Lucas   (experimental)
18h - Ana     (experimental)
19h - Gabriel (experimental)
```

### 5. Kanban resumido (contexto, não execução)
```
Novo (12) · Contato (8) · Experimental (5) · Proposta (4) · Matrícula (2)
```

### 6. Meta do mês
Barra de progresso: 13 de 20 · faltam 7. (Comissão já está no card do topo.)

### Regras de priorização da fila (Fase 0)
- 🔥 **Lead novo sem 1º contato** / **SLA vencendo** (tempo desde a entrada).
- ⚠️ **Follow-up vencido** (data do próximo follow-up < hoje).
- 📅 **Aula experimental hoje**.
- 💰 **Proposta parada** há X dias sem retorno.

### Estado vazio
Sem pendências → mensagem positiva ("Tudo em dia ✅") + atalho para prospectar/ver pipeline.

---

## Tela: Home do Gerente

Foco em **gestão**, não execução:
```
1. Dashboard (Leads hoje · Conversão · SLA · Matrículas · Receita)
2. Alertas de SLA
3. Ranking de vendedores
4. Funil
5. Equipe
```
> Ranking deve ser **justo** (considerar volume/qualidade de leads recebidos, não só nº bruto).

---

## Tela: Ficha do Lead

> O **motor da Home**: é aqui que se registra o que alimenta a fila e o Foco do dia.
> **Fase 0:** registro de CRM com campos + histórico **manual** + ações.
> O **painel de conversa do WhatsApp embutido é Fase 1** (Cloud API), não existe aqui ainda.

### 1. Cabeçalho (identidade + status)
- Nome, **WhatsApp/telefone**, país, **idade do lead** ("no funil há 2 dias").
- **Trilha de estágios (breadcrumb):** Novo → 1º Contato → Qualificado → Experimental Agendada →
  Experimental Realizada → Proposta → Aguardando Matrícula → Matriculado, com o **estágio atual destacado**.
  (Perdido = terminal, fora da trilha.)
- Chips: **temperatura** (Quente/Morno/Frio) · **segmento** (Adulto/Kids/Teens/Empresa) · **dono**.
- **Origem**: Meta Ads → campanha · anúncio (capturada automaticamente; ver doc 08).

### 1b. Valor da oportunidade (bloco financeiro)
Responde "quanto vale esse lead?": **Matrícula prevista · Plano · Comissão · Prioridade.**
> A **Prioridade** é faixa (Alta/Média) na Fase 0; **% real** só na Fase 1 (mesma regra da Home).

### 2. Barra de ações
Registrar interação · Agendar experimental · Enviar proposta · Mudar etapa ·
**Converter em matrícula** · Marcar perdido (motivo da lista fechada).

### 3. Resumo executivo
Os 6 campos: **Interesse · Objetivo · Urgência · Orçamento · Objeção · Próximo passo**.
**Manual na Fase 0; IA preenche na Fase 1.**

### 4. Próximos passos / datas (edição inline)
**Próximo follow-up · Data da experimental · Status da proposta** — editáveis direto na ficha.
> São exatamente os campos que **alimentam a fila da Home**.

### 5. Linha do tempo
Histórico de interações (criação do lead, contatos, materiais enviados).
Na Fase 0 é **registro manual**; na Fase 1 a conversa do WhatsApp entra automaticamente.

### 6. Documentos
Categorias: **Propostas · Contratos · Comprovantes · Teste de nível**. Anexos por lead,
que crescem ao longo do funil.

### 7. Histórico de dono (auditoria da comissão) — obrigatório
Toda **atribuição/transferência** registrada: quem, quando, **motivo** (ex.: férias).
> Crítico porque **dono = comissão**. Sem esse log, vira briga.

### Marcar perdido → motivo (lista fechada)
Abre a **lista fechada de motivos** (doc 08): Preço · Sem tempo · Sem interesse ·
Concorrência · Sem resposta · Localização · Qualificação · Outro (observação obrigatória).

## Tela: Pipeline / Kanban

> **O Kanban é para VISUALIZAR + DECIDIR (sobretudo o gerente), não para trabalhar leads** —
> quem trabalha lead é a Home. Por isso a granularidade é a favor: o Kanban existe para mostrar
> **onde o funil vaza**. Lista canônica usada por Ficha, Kanban e relatórios.

### Lista canônica — PF (TRAVADA, refinada)
```
Novo · 1º Contato · Qualificado · Experimental Agendada · Experimental Realizada ·
Proposta · Aguardando Matrícula · Matriculado
```
**Perdido** = coluna **visível** (não esconder), em cinza/de-ênfase e **filtrável por período**
(senão acumula pra sempre). Recuperação/nutrição saem dela.

> Separar **Experimental Agendada × Realizada** é proposital: o **no-show** é o maior gargalo
> de escola; só dá pra ver e atacar o vazamento se forem etapas distintas.

### Board separado — B2B (toggle)
```
Lead Empresa · Contato RH · Diagnóstico · Proposta Comercial · Negociação · Fechado · Implantação
```

### Cards (ferramenta de decisão)
**Nome · temperatura (barra lateral) · valor · última ação · próxima ação.**
Mais: **SLA no card** ("⚠️ 2 min" / "🚨 vencido") e **idade da etapa** ("2d nesta etapa").
Cada coluna mostra **contagem + valor total**; **colunas-gargalo destacadas** (Novo,
Experimental Agendada, Proposta).

### Comportamento (Fase 0)
- Mover card = **drag manual**.
- Mover para **Perdido** → exige **motivo** (lista fechada).
- Mover para **Matriculado** → abre a **conversão em matrícula**.
- **Filtros:** vendedor (respeitando permissão — vendedor vê só os seus), segmento, temperatura, período.

### Decisões travadas ✅
- Funil refinado: **8 etapas** + **Perdido como coluna visível** (cinza, filtrável por período).
- **Experimental separada** em **Agendada × Realizada** (mede o no-show).
- Renomes: "Em atendimento" → **1º Contato**; "Aguardando pagamento" → **Aguardando Matrícula**.
- **Kanban = visualizar + decidir** (gerente); o vendedor trabalha na Home.

## Tela: Matrícula manual

> Destino do **"Converter em matrícula"**. Como a **negociação nasceu no comercial**, a tela
> chega **pré-preenchida pelo lead** → é **confirmar + completar**, não redigitar.

### Seções
1. **Aluno** — o **país dirige** documento, moeda e formato de telefone. Documento avisa-não-bloqueia.
   - **Responsável financeiro (o pagador)** = **o próprio aluno** (Adulto) · **responsável** (Kids/Teens) ·
     **empresa** (B2B). Modela o **faturamento corporativo** de brinde. Escondido para Adulto.
2. **Curso & alocação (SELEÇÃO, não criação)** — idioma · modalidade · **nível inicial** ·
   **turma** (escolhida de uma lista de **turmas já existentes**).
   - ⚠️ **Princípio criar × alocar:** aqui o vendedor só **seleciona/aloca**. **Criar** produto/preço/turma
     é em **Configuração** — turma é responsabilidade do **Gerente Pedagógico**. **Não há "criar turma"** nesta tela.
   - **Origem do nível** registrada: **avaliação (data)** ou **manual** ("quem colocou no A1?").
   - Turma mostra **vagas restantes** ("3 vagas" / "última vaga") e **data de início**.
   - **Sem turma compatível aberta?** O vendedor **não cria** — vai para **lista de espera**, encaixa no
     **Pré A1** (porta rolling de Regular/Semi), ou **solicita abertura** ao Gerente Pedagógico.
3. **Contrato — linhas de cobrança** — taxa de matrícula e mensalidade (**referência → negociado**);
   certificado **só Costa Rica**; **moeda local ou USD**. Alteração entra no **histórico de negociação**.
   - **Card "Primeiro pagamento":** taxa + 1ª mensalidade = **total** (vendedor/financeiro perguntam o dia todo).
   - **Dia de vencimento** da mensalidade (5/10/15/20/25) — escolhido na matrícula; o **cronograma inteiro** é gerado na ativação.
4. **Comissão** — automática (**% da taxa**), amarrada ao **dono**.
5. **Pagamento & contrato** — forma (Transferência / GreenPay) + status.

### Estado / gatilho
- Nasce em **"Aguardando Matrícula"** (o **aluno é criado já em rascunho**).
- Vira **"Matriculado" (ativo)** só com **pagamento confirmado + contrato assinado**.
- Botões: **"Salvar matrícula"** e **"Receber pagamento e ativar"** (não usar "ativar" sozinho — jargão).
- Fase 0: registrado **manualmente**. DocuSign + gateway = **Fase 1**.

### Resolvido / em aberto
- ✅ **Nível** vem da avaliação **ou** manual, com **origem registrada**.
- ✅ **Aluno** criado em **rascunho** ao salvar (aparece no "Aguardando Matrícula").
- ❓ **Gatilho de ativação:** só a **taxa**, ou **taxa + 1ª mensalidade**? (acerta o card e o gatilho)

## Tela: Configuração (backstage)

> O backstage que **abastece** todas as telas. Dono = **ADM**; **Turmas = Gerente Pedagógico**.
> Quatro áreas: **Usuários & papéis · Países · Catálogo · Turmas**.

### 1. Países
Tudo que muda por país, num só lugar:
- Moeda · tipo de documento (+ validador) · DDI/WhatsApp · **idiomas habilitados** · **modalidades habilitadas** · **status** (rascunho/ativo/pausado).
- O país **liga um subconjunto do catálogo global** → define o que é **vendável** ali.
- **Checklist de prontidão** antes de ativar (doc 04).

### 2. Catálogo (editável só pelo ADM)
- **Produtos = idioma → modalidade** (Português → Regular/Intensiva/Particular; Inglês no futuro).
- **Níveis (CEFR):** Pré A1 · A1 · A2 · B1 · B2 · C1 · C2.
- **Preços de referência por país × idioma × modalidade** (taxa de matrícula + mensalidade); certificado só Costa Rica.
- Versão por estudo de mercado (doc 06).

### 3. Turmas
Onde a turma **nasce** (o "criar" do princípio criar × alocar). Casa do **Gerente Pedagógico**.
- Cada turma: **modalidade × nível · dias/horário · data de início · professor · capacidade · status**.
- **Capacidade real:** mostrar **"8 matriculados · 4 vagas"** (não só 8/12 — leitura mais rápida).
- **Próxima aula** (data/hora) por turma — o Gerente Pedagógico usa muito.
- **Ciclo de vida:** Planejada → Aberta → Em andamento → Concluída.
- **Regra-chave:** só turma **"Aberta" com vaga** aparece no seletor da matrícula.
- **Pré A1** = turma **rolling** especial (porta de entrada de Regular/Semi).
- **Mínimo para abrir vive na MODALIDADE** (Regular 4, Intensivo 3, Particular 1) e a **turma herda**.

#### Decidido — Turmas
- ✅ **Kids/Teens = modalidades próprias** (Kids Regular, Kids Intensivo…), cada uma com seu **mínimo** — segmento ≠ modalidade.
- ✅ Pré A1 rolling · ✅ mínimo na modalidade (turma herda) · ✅ capacidade real + próxima aula.

### 4. Usuários & papéis
7 papéis (doc 07), **permissões separadas**, multi-papel, ativo/inativo:
**Administrador · Gerente Comercial · Vendedor · Gerente Pedagógico · Professor · Financeiro · Secretaria Acadêmica.**
- **Último acesso** por usuário (ex.: "hoje 08:12" / "há 43 dias") — o admin vê quem usa e quem sumiu.

## Área: Alunos (gestão operacional/acadêmica pós-matrícula)

> Responde **"esse aluno está em qual turma?"**. Telas: **Ficha do Aluno · Lista de Alunos · Ficha da Turma · Movimentações**.

### Ciclo de status do aluno (TRAVADO)
| Status | Mensalidades | Vaga | Outras regras |
|---|---|---|---|
| **Ativo** | Gera | Ocupa | Participa da turma |
| **Pausado** | **Não gera novas** | **Não ocupa** | Dívidas permanecem · não aparece p/ professor · mantém histórico · reativável · **alerta após 90 dias** |
| **Encerrado** | Não gera futuras | Não ocupa | Dívidas permanecem · **motivo obrigatório** · **sem aprovação** |
| **Reativado** | — | — | Pausado → Ativo |

- **Pausar** captura: **data da pausa · motivo · data prevista de retorno (opcional)**. Aos **90 dias** → **alerta para a
  Secretaria** (não encerra automático — aluno volta de intercâmbio, gravidez, viagem, problema financeiro).
- **Encerrar** **sem aprovação** (evita gargalo), por Secretaria/Pedagógico/Admin, com **motivo da lista fechada**:
  **Concluiu · Desistiu · Mudou de país · Inadimplência · Transferência · Outro**. Auditoria: quem · quando · motivo.
  > O motivo vira **indicador** ("por que estamos perdendo alunos?"), não só auditoria.
- **Trocar turma:** respeita **vaga**. **Mesmo nível** (ex.: mudança de horário) livre; **entre níveis** (A1↔A2) permitido
  **com justificativa** (avaliação errada, turma incompatível, ajuste pedagógico). A **progressão de nível** (A1→A2 ao
  concluir) é **processo pedagógico separado**, não é troca de turma.

### Ficha do Aluno
- Header: nome · país · contato · **status em destaque** (Ativo/Pausado/Encerrado — a info mais crítica da ficha).
- **Turma atual** (professor · horário · início) com **tempo na turma** ("há 4 meses").
- **Dados pessoais** (nascimento, documento, responsável financeiro, data de matrícula).
- **Financeiro resumido** (situação · saldo · próximo vencimento) + link **Ver ficha financeira**.
- **Histórico de movimentações** (linha do tempo completa — **entidade própria**): matrícula · troca de turma ·
  pausa · reativação · encerramento · avanço de nível — cada um com **data · de→para · motivo · autor**.
  Responde "**por que a Maria está nessa turma?**" meses depois.
- **Movimentações:** Trocar turma · Pausar · Encerrar · Reativar (conforme o status).

### Lista de Alunos
- **Busca** + filtros: **país · turma · status**.
- Cada linha: aluno · país · turma · **status acadêmico** (+ **tempo desde a matrícula**, ex.: "há 4 meses") +
  **situação financeira** (em dia/atrasado) → clica → Ficha do Aluno.

### Ficha da Turma
- Header: modalidade · nível · **professor** · dias/horário · início · **status** (Planejada/Aberta/Em andamento/Concluída).
- **Ocupação** (matriculados · vagas) + **próxima aula**.
- **Lista de alunos** da turma (com situação financeira).

### Movimentações (modais)
- **Pausar:** data da pausa · motivo · data prevista de retorno (opcional).
- **Encerrar:** **motivo da lista fechada** (Concluiu/Desistiu/Mudou de país/Inadimplência/Transferência/Outro) + auditoria.
- **Trocar turma:** seleciona turma compatível (respeita vaga); **entre níveis exige justificativa**.
- **Reativar:** Pausado → Ativo.

> **Entidade `MovimentacaoAluno`** (`id, alunoId, tipo, deValor, paraValor, motivo, usuarioId, data`) — registra
> **toda** movimentação; é a fonte do **histórico** na Ficha do Aluno ("por que está nessa turma?").

### Visão por papel (área Alunos)
| Papel | Ficha do Aluno / Movimentações |
|---|---|
| **Secretaria Acadêmica** | Ferramenta principal: dados, turma, **movimentações** |
| **Gerente Pedagógico** | Decide turma/progressão; movimentações acadêmicas |
| **Professor** | Só os alunos das **turmas dele** (read) |
| **Administrador** | Tudo |
| **Financeiro** | Aluno + financeiro resumido (sem movimentação acadêmica) |

### Regras — TRAVADAS ✅
Status, pausa, encerramento (motivos + auditoria) e troca de turma definidos no **Ciclo de status** acima.

## Tela: Visão do Professor (V0)

> Notas e frequência completas = **Fase 3**. No V0 o professor é **enxuto, mas conectado**.

### Home do Professor (enxuta)
O professor responde 3 perguntas: **quais turmas tenho? quem são meus alunos? qual o status deles?**
- **Próxima aula em destaque** (hero) + **resto da agenda** (Hoje / Amanhã); clicar abre a **Ficha da Turma**.
- **Minhas turmas** — só as dele, **com horário** (ex.: Ter/Qui 18h) + nº de alunos.
- **Ficha da Turma** (já desenhada) responde o resto (alunos · status · próxima aula).

### Check-in da experimental (V0 — captura de dado, não automação) ✅
É registrar **um evento que aconteceu** (como Registrar pagamento / Encerrar / Trocar turma). Na agenda, o professor marca:

**Compareceu**
```
lead.status        = Experimental Realizada
lead.proxima_acao  = Comercial (apresentar proposta)
timeline           += "Experimental realizada · registrado por Carla Fernández · 18/jun 19:54"
```

**Faltou**
```
lead.status        = No-show
lead.proxima_acao  = Remarcar experimental
timeline           += "Aluno não compareceu · registrado por Carla Fernández · 18/jun 19:54"
```

Em ambos: o lead **volta pra fila do comercial** e o evento (**com autor**) entra na **timeline do lead** → aparece na Home do vendedor.

### Acesso (papel Professor)
- Vê **só as turmas/alunos dele** (read). Sem financeiro, sem movimentações acadêmicas, sem configuração.

### Resolvido
- ✅ **Check-in da experimental no V0.**  ✅ **Presença e notas completas = Fase 3.**

## Tela: Ficha Financeira do Aluno (V0)

> Zoom financeiro de **um aluno** (a tela global de Cobranças mostra a fila; esta mostra a pessoa). Dono: **Financeiro**.

### Topo
- Identidade + **situação** (em dia / atrasado) + **responsável financeiro** (a própria pessoa /
  responsável Kids / **empresa** B2B).
- Tiles em destaque: **Próximo vencimento** (valor + data — info mais consultada) · **Último pagamento**
  (valor + data + forma) · Em aberto · Em atraso.

### Conteúdo
- **Contrato** (valores negociados, moeda) · **Cobranças** (taxa + mensalidades, status, datas) ·
  **Histórico de negociação** (auditoria) · **Comissão**.
- Ações: **Registrar pagamento** · **Renegociar / ajustar**.

### Visão por papel
| Papel | Ficha Financeira do Aluno |
|---|---|
| **Administrador** | Tudo: vê, dá baixa, renegocia, comissão |
| **Gerente Comercial** | **Somente leitura** (valores + comissão da equipe; aprova desconto) ✅ |
| **Gerente Pedagógico** | Só a **flag** "em dia / atrasado" — **sem valores** (proposta) |
| **Financeiro** | Tudo (dono): baixa, gerar cobrança, renegociar |
| **Secretaria Acadêmica** | Read-only nos valores · **pode registrar pagamento** ✅ (não renegocia) |

## Tela: Renegociação / Ajuste Manual (V0)

> Ação a partir da Ficha Financeira. **Tudo com motivo + auditoria** (entra no histórico de negociação).

### O que ajusta
- Valor da mensalidade · **desconto / bolsa** · **vencimento**.
- **Perdoar cobrança** = só com **autorização do Administrador** (opção bloqueada para os demais).
- **Impacto financeiro** explícito: além de `25.000 → 20.000`, mostra **"Desconto concedido: ₡5.000"**.
- **Vigência (esp. bolsa), com badge de risco:** 🟢 Apenas esta cobrança · 🟡 Próximos N meses · 🔴 Contrato inteiro
  (o mesmo % pesa muito diferente conforme a vigência).
- Quando exige aprovação, mostra o **aprovador nomeado** ("Será enviado para: Mariana López — Gerente Comercial").

### Regras
- **Renegociam:** Administrador e Financeiro (total).
- **Vendedor:** desconto **até o limite** (definido em **Config**); acima → **envia para aprovação**
  (Gerente Comercial **ou** Administrador).
- **Comissão:** recalcula **só quando muda a taxa de matrícula** (comissão = % da taxa);
  ajuste em **mensalidade não afeta** a comissão.

### Visão por papel
| Papel | Renegociação / Ajuste |
|---|---|
| **Administrador** | Tudo, incl. **perdoar cobrança**; aprova over-limit |
| **Financeiro** | Renegocia (valor/desconto/bolsa/vencimento); **perdão exige Admin** |
| **Gerente Comercial** | **Aprova** descontos acima do limite do vendedor |
| **Vendedor** | Desconto **até o limite** (Config); acima → envia p/ aprovação |
| **Gerente Pedagógico** / **Secretaria Acadêmica** | Sem acesso |

### Aprovações (desbloqueada por esta tela)
Lista simples, **sem motor de workflow**: cada pedido mostra aluno · ajuste (valor + impacto) · **vigência (com risco)** ·
solicitante · motivo, com **[Aprovar] / [Rejeitar]**.
- **Resumo no topo:** pendentes · **impacto mensal** · **impacto anual** (o gerente vê o peso total).
- **Engine genérica:** o registro tem um **tipo** — **desconto · bolsa · alteração de valor · perdão de dívida ·
  comissão excepcional** — e a **mesma tela** serve a todos (constrói uma vez, reusa sempre).
- Aparece para **Gerente Comercial** e **Administrador** (e nas **pendências da Home** deles).
- Aprovado → ajuste aplicado e entra no histórico; Rejeitado → volta com o motivo.

### Resolvido
- ✅ **Limite de desconto em % POR vendedor** (`limiteDescontoPct` no usuário); **Admin sem limite** (doc 07).

## Tela: Financeiro (V0 — manual)

> Dono: **Financeiro**. As cobranças **nascem da matrícula** (taxa + mensalidades).

### Sub-abas
- **Cobranças (contas a receber)** — cada cobrança com **contexto** (aluno + turma) · vencimento · valor (moeda) · status.
  **Atrasados no topo; a vencer agrupado por urgência (Hoje · 7 dias · 30 dias).**
  Ações por linha: **Cobrar via WhatsApp · Registrar pagamento · Ver ficha**.
  Indicador de **última cobrança manual** (quando / por quem) — evita cobrar em duplicidade.
- **Inadimplência** — atrasados (quanto, há quanto tempo).
- **Comissões** — por vendedor, status (pendente/aprovada/paga).
- **Visão geral** — KPIs: recebido · a receber · em atraso · comissões a pagar.

### Registrar pagamento (baixa manual)
Modal com: **valor esperado · valor recebido · diferença** (pagamento a menor deixa **saldo em aberto**) ·
**data** · **forma** (Transferência/GreenPay/Dinheiro/Cartão) · **upload de comprovante** (PDF/JPG/PNG) · **comentário**.
Botão de ação: **"Registrar pagamento"**. Essencial pro fluxo de **transferência** (anexa a prova). A cobrança paga
mostra o selo **"comprovante"**.
- **Parciais modelados desde já:** `valorOriginal · valorRecebido · saldo` (mesmo que a baixa parcial seja ativada depois).

### Cobrança via WhatsApp (V0 — sem API)
- Botão **"Cobrar via WhatsApp"** abre um **modal** com **5 modelos** + **preview editável** + **Copiar / Abrir no WhatsApp**:
  **Amigável · Vencida · Firme · Dados de pagamento · Promessa de pagamento**. Cada modelo = um **wa.me/texto**
  (**não é a Cloud API** — manual e sem custo).
- **Modelo sugerido pelo atraso** (editável): 0–5 dias → Amigável · 6–15 → Vencida · 16+ → Firme.
- **Lembrete proativo:** o botão também aparece em cobranças **a vencer** (3 dias antes e no dia).
- Aponta pro **aluno ou responsável financeiro** (Adulto → aluno · Kids → responsável · B2B → contato da empresa).
- **Registro automático** ao "Abrir no WhatsApp": grava a tentativa (**modelo + usuário + horário**), sem confirmação →
  alimenta a **última cobrança** e o **contador de tentativas** ("3 cobranças" / "última há 7 dias").
- **Card escaneável:** nome / cobrança / país-turma / vencimento empilhados.

### Cobranças — visão por papel
| Papel | Cobranças |
|---|---|
| **Administrador** | Tudo: vê, registra pagamento, ajusta |
| **Gerente Comercial** | Somente leitura |
| **Gerente Pedagógico** | Sem acesso (só a flag na ficha do aluno) |
| **Financeiro** | Tudo (dono) |
| **Secretaria Acadêmica** | Vê + **registra pagamento**; não renegocia |

### Comissões (detalhe)
- **Por vendedor** (agrupado, com subtotal). Ciclo: **Pendente** (matrícula não ativa) → **Aprovada** (ativa, a pagar) → **Paga** (fechamento mensal).
- **Estorno automático** se a matrícula for cancelada.
- KPIs: a pagar (aprovadas) · pendentes · pagas no mês. Ação: **"Fechar mês e marcar pagas"**.
- **Data prevista de pagamento** visível (ex.: Fechamento 30/jun → Pagamento 05/jul) — o vendedor pergunta sempre.
- **Visão por papel:** Financeiro/Admin gerenciam (aprovam/pagam) · Gerente Comercial vê a **equipe** ·
  Vendedor vê **só as suas** · Pedagógico/Secretaria sem acesso.

### Visão geral (dashboard)
- KPIs: **novas matrículas no mês** (a receita futura nasce na matrícula) · **previsto · recebido · em atraso · % recebido**.
- **Recebido × previsto** (com fatia em atraso e a vencer) · **receita por país** (consolidada em USD) ·
  comissões a pagar · inadimplência.
- **Visão por papel:** Admin/Financeiro/Gerentes; o Vendedor vê os próprios números **na Home** (não esta consolidada).

### Multi-moeda
- Cada cobrança **na sua moeda**; **consolidação em USD só nos KPIs/painel** (reporting, nunca na conta do aluno).

### Escopo V0 × Fase 2
- **V0 = manual** (baixa na mão). **Fase 2 =** integrações (GreenPay/PIX/boleto/cartão), conciliação,
  faturamento corporativo B2B, comissão automática.

### Resolvido
- ✅ **Dia de vencimento por matrícula** (operador escolhe 5/10/15/20/25 — serve p/ aluno e empresa).
- ✅ **Cronograma inteiro gerado na ativação** (não mês a mês): previsão de receita, inadimplência e Visão geral
  ficam corretas; **Pausar/Encerrar cancela só as mensalidades futuras**.

## Dependências (o que a Home consome)

A fila inteligente só funciona se a **Ficha do Lead** registrar:
- **Data de entrada** (para SLA do 1º contato).
- **Próximo follow-up** (data).
- **Data da aula experimental**.
- **Data de envio da proposta**.

> Ou seja: a Home **consome** o que a Ficha do Lead **captura** → já define campos
> obrigatórios da próxima tela.

## Em aberto
- Homes de **Secretaria Acadêmica** e **Professor** (definir junto das telas deles).
- Critério exato do **ranking** do gerente.
- Valor de "X dias" para "proposta parada".
