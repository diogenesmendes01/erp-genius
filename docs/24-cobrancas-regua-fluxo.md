# 24 — Cobranças: régua + fluxo de trabalho (one-pager)

> Redesenho da tela de Cobranças como **facilitador de cobrança**, não tabela passiva.
> Decidido em brainstorm (2026-06-26). Substitui as abas separadas **Cobranças** e
> **Inadimplência** do [`09-fase0-telas.md`](09-fase0-telas.md).

## Problema
- **Cobranças** e **Inadimplência** são redundantes: Inadimplência é literalmente o
  subconjunto atrasado de Cobranças (`cobrancas.filter(atrasado)` = o balde "Atrasados").
- A tela é organizada por **tempo** (vence em 7/30 dias) quando o trabalho é organizado por
  **ação** (o que faço com isso hoje). Resultado: tabela passiva, o humano traduz na cabeça.

## Decisão
Uma tela só, dirigida pela **régua de cobrança** (*dunning ladder*). "Atrasado" vira o degrau
mais urgente — não uma aba. A régua é a coluna vertebral de tudo (dashs, lista, detalhe).

## A régua (a política da escola)
| Degrau | Quando | Tom | Template (já existe) | Ação |
|---|---|---|---|---|
| **D-7** | 7 dias antes do vencimento | preventivo, gentil | `amigavel` | Lembrar |
| **D-3** | 3 dias antes | preventivo | `amigavel` | Lembrar |
| **D0** | dia do vencimento | neutro | `dados` | Cobrar no dia |
| **D+3** | 3 dias de atraso | firme leve | `vencida` | Cobrar |
| **D+7** | 7 dias de atraso | firme | `vencida` | Cobrar |
| **D+15** | 15 dias de atraso | última | `firme` | Cobrar + **bloquear acesso à aula** |

Templates existentes: `amigavel · vencida · firme · dados · promessa` (`FinanceiroPainel`/schema).
O **bloqueio (D+15) exige aprovação humana** — nunca automático.

## Arquitetura: cérebro vs braço (a chave do "pronto pra automatizar")
- **Cérebro** = função **pura** `proximaAcao(cobranca, historico, hoje) → { degrau, acao, template, prioridade }`.
  Determinística, testável, **sem IA**. Construída 100% agora.
- **Braço** = quem executa. **V1 = humano** clica (abre `wa.me`). **V2 = cron + WhatsApp API**.
  O cérebro **não muda uma linha** quando o braço troca. É isso que torna "automatizável" uma
  propriedade do design, não um retrabalho.
- **Memória** = os eventos (ver abaixo). A régua-timeline do detalhe é a leitura desses eventos.

## Modelo de tela
1. **Mini-dashs (topo) = filtros clicáveis** da régua: `A vencer · Em atraso · Bloquear ·
   Promessas · Recebido hoje` (≈80% régua + 1 financeiro). Clicar filtra a lista.
2. **Lista magra** = 1 cobrança por linha (2 linhas), com coluna **"próxima ação"** (chip do
   degrau + botão rápido) → o fácil resolve **sem abrir**. Ordenada por prioridade.
3. **Detalhe (drawer ao clicar a linha)** = (a) **Ação de hoje** no topo: mensagem sugerida
   pré-preenchida + botões (Enviar · Registrar pagamento · Promessa · Pular); (b) **régua como
   linha do tempo** (o que já foi feito com data, onde está, o que vem, D+15 como "aprovação");
   (c) contato + link pra ficha do aluno.

## Comportamento em escala (volume)
- **Densidade por padrão** (linha, não card). O card rico é só o detalhe (drawer). ✅ V1
- **Triagem** por prioridade (urgência × valor × risco) — a fila já abre ordenada. ✅ V1
- **Busca + filtros** (aluno/código · país · turma) para navegar o volume. ✅ V1
- **Lote por degrau (enviar em massa) → V2.** Manualmente é **inviável**: disparar N WhatsApps
  num clique é bloqueado pelo navegador (múltiplos `window.open`/popup). É exatamente a dor que a
  automação (cron + WhatsApp API) resolve — por isso o lote **nasce na V2**, não no V1 manual.
  (Lote de *bloqueio* — ação interna, sem popup — pode ser adicionado ao V1 se houver demanda.)

## Dados & eventos (mudanças necessárias)
- `CobrancaEnviadaWhatsApp` ganha `{ passo: "D-3" }` — **qual degrau da régua foi cumprido**.
  É o detalhe que torna a linha do tempo legível por máquina (o cron de V2 continua de onde o
  humano parou). Sem isso, vira retrabalho ao automatizar.
- **Novo evento** `PromessaPagamento { ate }` — a cobrança sai da fila até a data prometida.
- **Bloqueio:** flag de acesso (Matricula/Aluno) + evento de bloqueio **com aprovação humana**
  (`agregado Cobranca`/`Matricula`). O *enforcement* técnico (barrar entrada na aula) fica
  **fora do escopo V1** — V1 grava a flag + a aprovação.
- **Risco do aluno:** sinal **simples** (nº de cobranças no ciclo ⇒ "reincidente"). Começa burro;
  estrutura extensível. O **motor de risco** completo (score explicável que classifica e adapta a
  régua) está especificado para V2 em [`25-motor-de-risco-cobranca.md`](25-motor-de-risco-cobranca.md).

## Regra "devido hoje" (com backlog — dias pulados não somem)
A ação de um degrau é **devida** quando: a data do degrau chegou **E** o degrau ainda não foi
cumprido (não há evento `{ passo }` correspondente). Um lembrete D-3 que ninguém mandou ontem
continua **devido (atrasado na ação)** até ser feito ou superado pelo degrau seguinte. A tela
nunca "perde" um item por dia pulado — isso protege a suposição de adoção.

## Fases
- **V1 (agora):** cérebro completo + tela (dash/lista/detalhe) + braço humano (`wa.me`) +
  eventos `{ passo }`/`PromessaPagamento`/bloqueio-com-aprovação. Manual, mas pronto pra automatizar.
- **V2 (futuro, [`08`](08-comercial-crm-whatsapp.md) §automação):** braço automático (cron +
  WhatsApp API) dispara os lembretes preventivos; o humano só entra nos itens de julgamento
  (cobranças, promessas, bloqueios, respostas).

## Fora de escopo do V1 (estacionado)
Score de risco sofisticado · régua diferenciada por risco (bom pagador vs reincidente) · régua
B2B/bolsa (pagador-empresa) · envio em lote real (depende da API) · enforcement técnico do
bloqueio de acesso à aula.

## Próximo passo
Construir o **cérebro primeiro**: `proximaAcao` (função pura) + testes, sobre os dados que já
existem. É a peça mais valiosa e a que se sente funcionando — e independe de UI.

## Suposição mais arriscada
**Adoção do ritual** ("abrir a fila e zerar o dia"). Mitigação na tela: mini-dashs de progresso
("8 de 14 feitas hoje") + triagem. Validar com o cobrador real antes de investir no V2.

## Consistência: a ficha financeira compartilha o cérebro (read-only)
A ficha financeira do aluno (`/alunos/[id]/financeiro`) **reusa o mesmo cérebro**
(`montarReguaPorCobranca`, em `cobrancas/consultas.ts`) — fonte única, sem duplicar lógica.
Ela passou a mostrar, **só leitura** (nenhuma ação nova): selo **"Acesso bloqueado"**, o
**degrau / promessa / bloqueio-pendente / reincidência (Nª cobrança)** por cobrança, e um **Histórico de cobrança** (linha do
tempo dos eventos: lembretes, cobranças, promessas, pagamentos incl. parciais, bloqueios). As
**ações** seguem exclusivas da fila (`/financeiro`); a ficha apenas *enxerga* a régua e guarda o
histórico. Fila e ficha contam a **mesma história** — eram irmãs que compartilhavam o dado mas
não o cérebro; agora compartilham os dois.

## Relacionados
[`09`](09-fase0-telas.md) (telas — substitui Cobranças/Inadimplência) ·
[`10`](10-regras-sistema.md) (máquina de estado da cobrança) ·
[`12`](12-catalogo-de-eventos.md) (eventos novos) ·
[`08`](08-comercial-crm-whatsapp.md) (automação Fase 1+).
