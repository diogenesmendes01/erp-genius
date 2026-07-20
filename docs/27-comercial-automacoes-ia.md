# 27 — Comercial: automações + IA sobre o canal WhatsApp (one-pager)

> Desenhado em brainstorm (2026-07-06). **Fase própria, inicia após o V1 do canal**
> ([`26`](26-whatsapp-v1.md)) estabilizar. Executa o menu de automações do
> [`08`](08-comercial-crm-whatsapp.md) sobre a infraestrutura bimotor — quase tudo aqui é
> **política + gatilho sobre o motor que já existe**, não módulo novo.
>
> **Estado (2026-07-20):** **C1 "captura + velocidade" COMPLETA.** Auto-lead no 1º inbound
> (dedupe gap 17 + referral cru) + saudação reativa (fecha o gap C20) + **motor generalizado
> por âncora** (`proximaAcaoAncora`, corte de progresso forward-only por ordem imutável) +
> **régua "lead novo sem resposta"** (`PoliticaComercial`/`DegrauComercial`, cadência
> +30min·+4h·+24h·+3d·+7d — o D0 é a saudação): enfileirador no mesmo tick do cron da
> cobrança (um por cenário, isolados), stop-conditions (etapa/inbound/opt-out/vendedor
> assumiu), trava S1 **liberada no Baileys** (decisão de produto), shadow próprio por
> política, ensaio observável e tela editável em `/configuracao/whatsapp`. Tudo nasce
> DESLIGADO.
>
> **C2 "experimental" também implementada:** cadências **pré-experimental** (24h/2h ANTES —
> offsets negativos no mesmo núcleo) e **recuperação de no-show** (30min·1d·3d·7d após a
> aula perdida), com **confirmação capturada por keyword** ("SIM"/"REAGENDAR" — o fallback
> textual do Baileys da §nota bimotor; `Lead.experimentalConfirmadaEm` fecha o gap 33) e o
> **check-in do professor** que já movia o funil. Lembrete pré-evento **nunca chega
> atrasado** (a aula começar encerra a cadência). Enfileirador genérico: um núcleo,
> N cenários. **C3 (IA)** aguarda a decisão de fornecedor de LLM + os requisitos LGPD do
> gap D29 — é o que resta da fase comercial.

## Tese estrutural: um motor de réguas, N políticas
A régua de follow-up comercial (doc 08) é **a mesma máquina** da régua de cobrança (doc 24):
âncora temporal + degraus + template por degrau + "devido quando a data chegou e o passo não
foi cumprido". A única diferença é a âncora — **evento** (última mensagem do lead · horário
da experimental · envio da proposta) em vez de data de vencimento. O cérebro generaliza:
`proximaAcao(âncora, historico, agora, politica)`.

Cada cenário do doc 08 vira **uma política a mais no mesmo motor**:

| Política | Âncora | Degraus (doc 08) |
|---|---|---|
| Lead novo sem resposta | 1ª mensagem sem retorno | D0 · +30min · +4h · +24h · +3d · +7d |
| Pré-experimental | horário agendado | 24h antes · 2h antes |
| No-show | horário perdido | 30min · 1d · 3d · 7d |
| Proposta enviada | envio da proposta | 1d · 3d · 7d · 14d |
| Nutrição de perdido | data da perda | 30 · 60 · 90 · 180d (ramifica por motivo) |

Tudo passa pela **fila única** e herda os guard-rails do doc 26 — inclusive a **lei do
despachante** (inbound do lead cancela/reseta a régua do cenário; automação nunca fala por
cima de conversa viva).

## Dois eixos separados (decisão de sequência)
- **Automação determinística** (réguas, gatilhos, botões): barata, confiável, move as
  métricas de funil. **Vem primeiro.**
- **Inteligência (IA)**: lê o log de mensagens e produz estrutura. Camada por cima.
- **Linha vermelha: IA-que-lê ≠ IA-que-fala.** Nesta fase a IA **nunca envia mensagem ao
  lead**. Postura decidida: **só-leitura — sugere → vendedor confirma (1 clique) → mede-se
  a taxa de aceitação → auto-aplicação só depois**, para os tipos de sugestão de alta
  confiança. ("Resposta instantânea" não viola a linha: é texto fixo, não IA.)

## Ondas

### Onda 1 (decidida): C1 + C2 + C3
- **C1 — Captura + velocidade** *(ataca a métrica nº 1: tempo até 1ª resposta)*
  - Lead **auto-criado** no 1º inbound do número de vendas: nome, telefone e **origem via
    bloco referral do click-to-WhatsApp** (campanha/conjunto/anúncio chegam na 1ª mensagem).
  - **Saudação automática** (texto fixo, em segundos) — revoga o "saudação = V2" da 1ª
    versão do doc 26; ela estreia aqui, nesta fase.
  - Política **lead novo sem resposta** ligada no motor.
- **C2 — Experimental** *(ataca o maior vazamento: no-show)*
  - Confirmação 24h/2h antes com botões **Confirmar / Reagendar**; recuperação de no-show;
    **check-in do professor** (Compareceu/Não) move a etapa do funil sozinho.
  - **Dependência de implementação**: a experimental precisa existir como **dado
    estruturado** (data/hora vinculada ao lead) antes da onda.
  - **Nota bimotor**: botões interativos são confiáveis no driver oficial e instáveis no
    Baileys → confirmação com botões pede número oficial, ou fallback "responda SIM".
- **C3 — IA copiloto (só-leitura)**
  - **Resumo executivo** nos campos do doc 08: Interesse · Objetivo · Urgência · Orçamento ·
    Objeção · Próximo passo.
  - **Temperatura** (Quente/Morno/Frio) + **segmento** (Adulto/Kids/Teens/Empresa).
  - **Sugestões de CRM** (campos + mudança de etapa) com aceitar/corrigir em 1 clique,
    embutidas onde o vendedor já está (inbox/ficha do lead).
  - Gatilho: conversa quieta ~10min após o último inbound · mudança de etapa · sob demanda.
  - **Métrica-gate**: taxa de aceitação por tipo de sugestão — é ela que autoriza (ou não) a
    auto-aplicação futura.

### Onda 2: C4 — Fechamento
Contrato enviado sem assinatura em 48h · link de pagamento sem pagamento · **matrícula
automática** (pagamento OK + contrato OK → aluno + financeiro automáticos; turma =
auto-alocação **híbrida** do doc 08 — IA sugere, consultor confirma). Toca a máquina do
doc [`05`](05-fase1-fluxo-matricula.md).

### Onda 3: C5 — Gestão
Alerta de SLA (lead Novo parado > X min) · **relatório diário no WhatsApp do gestor** ·
ranking de gargalos (IA).

## Modelo de configuração (3 níveis — decidido)
Tudo desta fase é configurável pelo admin, **exceto as leis**:
- **Nível 1 — Leis (código, sem toggle)**: lei do despachante (nunca falar por cima de
  conversa viva) · D+15 com aprovação humana · opt-out sempre respeitado · IA nunca fala
  com o lead (nesta fase).
- **Nível 2 — Políticas (dado, admin edita)**: cada régua (degraus, offsets, template,
  modo, número remetente, estado **ativa/desligada/shadow**) · texto da saudação ·
  thresholds de gatilho (SLA, prazo de contrato, quiet da IA) · janela de horário/dias/
  pacing por número · cada tipo de sugestão da IA liga/desliga · templates (editor, doc 26).
- **Nível 3 — Preferências (por usuário)**: notificação, ordenações — cosmético.

Duas regras de ouro: **toda automação nasce desligada** e tem **shadow mode próprio**
(admin vê o que *teria sido enviado* antes de ativar — rollout política por política, sem
big bang); e **teto de frequência por contato** (máx. de mensagens automáticas/dia somando
todas as políticas) vira guard-rail do despachante — o "não metralhar" do doc 08 como regra
executável, não boa intenção.

## Regras transversais
- Mensagem automática aparece na thread da inbox **marcada como "auto"** — o vendedor sempre
  vê o que o robô disse em seu nome.
- **Stop-conditions** de toda política (avaliadas no despachante): inbound do lead · mudança
  de etapa · opt-out · vendedor assumiu (enviou manual).
- Régua de lead fora da janela de 24h em número oficial = template aprovado (a config valida
  prontidão por número, como na cobrança). Click-to-WhatsApp abre janela de 72h grátis.
- Escolha de modelo/fornecedor de LLM: decidir na implementação da C3 (volume atual torna o
  custo marginal — centavos/dia).

## Fora de escopo desta fase (estacionado)
IA que responde/qualifica o lead · auto-aplicação de sugestões (gated pela taxa de
aceitação) · conteúdo da nutrição segmentada por motivo de perda (aberto no doc 08) · rede
de segurança de reatribuição (liga quando forem 3 vendedores) · CAC via Meta API (doc 08,
Fase 2).

## Suposição mais arriscada
**A taxa de aceitação das sugestões da IA** — se o vendedor ignora o copiloto, o "CRM
alimentado pela conversa" (princípio inviolável do doc 08) não acontece. Mitigação:
sugestão embutida no fluxo, 1 clique, e medição desde o dia 1. Segunda: adoção da inbox
pelo vendedor é pré-requisito de tudo aqui — validada no piloto do V1 (doc 26).

## Relacionados
[`08`](08-comercial-crm-whatsapp.md) (menu original das automações) ·
[`26`](26-whatsapp-v1.md) (canal bimotor + fila + lei do despachante) ·
[`24`](24-cobrancas-regua-fluxo.md) (onde o motor de réguas nasceu) ·
[`05`](05-fase1-fluxo-matricula.md) (matrícula automática) ·
[`12`](12-catalogo-de-eventos.md) (eventos novos na implementação).
