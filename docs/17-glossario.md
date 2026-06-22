# Glossário — Linguagem Ubíqua

> Os termos do domínio Genius, com o sentido exato usado no código e nos docs. Quando um
> termo aparece no schema (`prisma/schema.prisma`), o nome técnico vem entre `código`.

## Comercial / CRM
- **Lead** — interessado em matrícula, antes de virar aluno. Tem um **dono** e um **funil**.
- **Dono (ownership)** — o vendedor responsável pelo lead = **quem recebe a comissão**
  (`Lead.vendedorDonoId`). Toda troca de dono é auditada.
- **Funil / Pipeline** — sequência de etapas do lead. **PF** (8 etapas) e **B2B** (próprio).
- **Etapas PF** (`EtapaLead`): Novo → 1º Contato (`EM_ATENDIMENTO`) → Qualificado →
  Experimental Agendada → Experimental Realizada → Proposta → Aguardando Matrícula →
  Matriculado. Saídas: **Perdido** (com motivo) e **No-show** (faltou na experimental).
- **Temperatura** (`Temperatura`) — Quente / Morno / Frio. Faixa de prioridade, não % (na Fase 0).
- **Segmento** (`Segmento`) — **quem** é o público: Adulto / Kids / Teens / Empresa (B2B).
- **Experimental** — aula experimental/avaliação. Dupla função: **converte a venda** E
  **define o nível**. Agendada × Realizada são etapas distintas para medir **no-show**.
- **No-show** — lead que faltou à experimental (maior gargalo de escola).
- **SLA** — tempo máximo para o 1º contato com um lead novo (ex.: X minutos).
- **Origem inteligente** — campanha/conjunto/anúncio/palavra que trouxe o lead (não só "Facebook").
- **Motivo de perda** (`MotivoPerda`) — lista fechada; responde "por que perdemos matrícula?".

## Catálogo / Acadêmico
- **Idioma** — Português (hoje); outros no futuro.
- **Modalidade** (`Modalidade`) — **como** o curso funciona: Regular, Semi-intensiva,
  Intensiva, Super-intensiva, Particular (+ Kids/Teens próprias). Carrega o **mínimo para abrir**.
- **Produto** (`Produto`) — unidade vendável = **idioma + modalidade**.
- **Segmento × Modalidade** — segmento = quem; modalidade = como. Por isso Kids/Teens são
  modalidades próprias (Kids Regular, Kids Intensivo…), não exceções de segmento.
- **Nível (CEFR)** (`Nivel`) — Pré A1 · A1 · A2 · B1 · B2 · C1 · C2.
- **Pré A1** — turma **rolling** (porta de entrada sempre aberta), só Regular/Semi.
  Intensiva/Super/Particular começam direto no A1.
- **Rolling** — turma de entrada contínua (encaixa quem chega depois do início). `Turma.rolling`.
- **Turma** (`Turma`) — cohort online = modalidade × nível × data de início × cronograma.
  Ciclo: Planejada → Aberta → Em andamento → Concluída. Só **Aberta com vaga** entra na matrícula.
- **Capacidade real** — exibir "8 matriculados · 4 vagas" (não 8/12).
- **Progressão de nível** — A1→A2… **dentro do mesmo contrato** (não é rematrícula nem troca
  de turma). Padrão automática (frequência + notas); exceções revisadas por ADM/Pedagógico.

## Matrícula / Financeiro
- **Matrícula** (`Matricula`) — **contrato composto** que reúne linhas de cobrança; cobre a
  **jornada inteira** do aluno. Vira **Ativa** só com **Contrato OK + Taxa paga + 1ª
  mensalidade paga** (`contratoOk + pagamentoTaxaOk + primeiraMensalidadeOk` — decisão P7).
  Admin/Gerente pode **ativar com pendência** (`ativadaComPendencia`) em exceção.
- **Linha de cobrança / Cobrança** (`Cobranca`) — taxa de matrícula, mensalidade, hora
  particular, material ou certificado. Cada uma na sua moeda.
- **Tipos de cobrança** (`TipoCobranca`) — `MATRICULA` (taxa, negociável) · `MENSALIDADE`
  (negociável; Regular/Intensivo/Kids) · `HORA_PARTICULAR` (Particular, por hora) ·
  `MATERIAL` · `CERTIFICADO` (fixo, só Costa Rica, **não** negociável).
- **Responsável financeiro / pagador** — o próprio aluno (Adulto), o responsável (Kids/Teens)
  ou a **empresa** (B2B). Em `AlunoResponsavel.papel = FINANCEIRO`.
- **Cronograma** — conjunto de cobranças geradas **na ativação** da matrícula (não mês a mês).
- **Movimentação do aluno** (`MovimentacaoAluno`) — registro **tipado** de cada mudança na
  vida do aluno (matrícula, troca de turma, pausa, reativação, encerramento) com de→para,
  motivo e autor. Fonte do histórico e dos indicadores; coexiste com o `Evento`.
- **Valor de referência × negociado** — referência vem do estudo de mercado; o **negociado** é
  fotografado na matrícula. Reajustar a tabela não muda contratos já fechados.
- **Ajuste financeiro** (`AjusteFinanceiro`) — desconto/bolsa/alteração/perdão/renegociação;
  tabela **tipada** para relatório (quanto de desconto, por vendedor/país/modalidade).
- **Comissão** (`Comissao`) — `% da taxa de matrícula` para o dono. Pendente → Aprovada → Paga;
  Estornada se cancelar <30d. Fechamento dia 30, pagamento dia 05.
- **Inadimplência** — cobrança vencida e não paga (`StatusCobranca.ATRASADO`).
- **Multi-moeda** — cada cobrança na moeda do país; consolidação em **USD só em relatório**.
- **Baixa manual** — registrar pagamento na mão (Fase 0), anexando comprovante.

## Acesso / Permissões
- **Papel** (`Papel`) — função no sistema (7 papéis). Uma pessoa pode ter **vários**.
- **Função × Propriedade** — função = o que pode fazer; propriedade (row-level) = quais
  registros vê (Vendedor → seus leads; Professor → suas turmas).
- **`limiteDescontoPct`** — teto de desconto do usuário em %; acima → vai para **aprovação**.

## Transversal
- **Evento** (`Evento`) — registro append-only de cada evento de negócio (autor · agregado ·
  antes→depois). É a **auditoria** e a fonte das projeções (timeline, histórico).
- **Agregado** — a entidade que um evento afeta (`Lead`, `Matricula`, `Aluno`…).
- **Projeção** — visão derivada do log de eventos (ex.: timeline do lead, histórico do aluno).
- **Código legível** — identificador humano por entidade (L-/A-/M-/C-/T-000001), via `Contador`.
- **Soft-delete** — "apagar" = mudar status (Perdido/Encerrado/Cancelada/Inativo); nunca DELETE físico.
- **Criar × alocar** — criar produto/preço/turma é Configuração (ADM/Pedagógico); o vendedor
  só **aloca** o aluno no que já existe.
- **Cockpit / Home como ação** — a Home é uma **lista de tarefas inteligente** ("com quem falo
  agora?"), não um dashboard.
