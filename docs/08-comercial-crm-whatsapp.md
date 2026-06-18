# Módulo Comercial — CRM + WhatsApp + Automação (Fase 4)

> A esteira de vendas é a **joia da coroa** da Genius: "melhorar vendas = melhorar a
> escola". Este módulo precisa ser instrumentado de ponta a ponta.

## As duas dores que o módulo resolve

1. **Fricção do vendedor** — preencher/atualizar o CRM não pode ser trabalho extra.
2. **Visão / performance** — gestão precisa enxergar e analisar todo o funil.

> Princípio inviolável: **o CRM é alimentado pela conversa**, não mantido à parte.
> Se atualizar for fricção, o dado não entra e a análise morre.

## Arquitetura (decidida)

- **WhatsApp Cloud API direto da Meta** (sem BSP). Sem mensalidade de plataforma; paga só
  o per-message. A Genius constrói a própria interface (faz parte do ERP).
- **Números são da escola**, atribuídos a vendedores. Vendedor sai → reaponta o número.
- Todos os números sob **uma única WABA**; todas as conversas caem **no mesmo CRM**.
- O vendedor trabalha **na caixa de entrada do sistema** (não no app verde daquele número).
- Hoje: **1 vendedor/número**; meta **3 até o fim do ano**. Desenhar pra vários, simples.

### Distribuição de lead
- Hoje: o anúncio aponta para o número de um vendedor (distribuição no Meta Ads).
- O sistema **respeita o dono** do número/lead.
- **Opcional (ligar quando forem 3):** rede de segurança — se o vendedor não responder em
  X min ou estiver ausente, o lead é **reatribuído** a outro.

## Pipelines (DOIS funis separados — decidido)

PF e B2B têm ciclos completamente diferentes (PF fecha em 3–15 dias; Empresa pode levar 90).
Misturar polui métricas, erra conversão e mistura SLA/automações. **Decisão: pipelines separados.**

### Pessoa Física (PF)
```
Novo → 1º Contato → Qualificado → Experimental Agendada → Experimental Realizada → Proposta → Aguardando Matrícula → Matriculado
                                              ↘ Perdido (com motivo)
```
- A **aula experimental / avaliação** é dupla: **converte a venda** E **define o nível** do aluno.
- **Experimental Agendada × Realizada**: separadas para medir o **no-show** (maior gargalo de escola).
- "Aguardando Matrícula" em diante = máquina da matrícula (doc 05).

### Empresa (B2B)
```
Lead Empresa → Contato RH → Diagnóstico → Proposta Comercial →
Negociação → Fechado → Implantação
```
- ⚠️ **Consequência estrutural:** um negócio B2B fechado **gera várias matrículas** (os
  funcionários viram alunos) e o **pagador é a empresa** — ou seja, **matrícula em lote +
  faturamento corporativo** (uma fatura para a empresa, não mensalidade individual).
  Conecta diretamente com o Financeiro e difere de tudo do fluxo PF. **Detalhar na Fase 2.**

## Motivos de perda (lista fechada)

Campo **não** livre — lista fechada, para responder depois "por que perdemos matrícula?":

| Motivo | Detalhe |
|---|---|
| Não respondeu | Não respondeu após tentativas |
| Preço | Preço acima do orçamento |
| Tempo/Horário | Sem disponibilidade de horário |
| Concorrência | Escolheu outra escola |
| Interesse | Sem interesse no momento |
| Localização | Distância/localização *(⚠️ escola é online — confirmar se é conflito de **fuso horário**)* |
| Empresa | Projeto congelado (B2B) |
| Qualificação | Perfil não aderente |
| Outro | Observação **obrigatória** |

## Origem inteligente (atribuição)

Não salvar só "Facebook". Capturar:
- **Campanha**, **Conjunto (ad set)**, **Anúncio**, **Palavra-chave** (Google), **Landing page**.

**Se preenche sozinho:** os anúncios click-to-WhatsApp da Meta enviam um bloco *referral*
(anúncio/campanha de origem) junto da 1ª mensagem do lead — a API entrega isso automaticamente.
No Google, via UTM na landing page.

Destrava: qual anúncio gera mais matrícula, qual professor converte mais, **CAC por campanha**.

> ⚠️ **CAC precisa do gasto do anúncio**, que mora no Meta/Google Ads — não no CRM.
> Faseamento decidido:
> - **Fase 1 — manual:** campos `Investimento mês`, `Leads`, `Matrículas`. Já resolve.
> - **Fase 2 — Meta API:** captura `Campanha / Conjunto / Anúncio / Valor gasto` e o CRM
>   calcula **CPL, CAC e ROAS** automaticamente.

## Segmentos de lead

Adulto · Kids · Teens · **Empresa (B2B)**.

> Segmentos **dobram o funil**. ✅ **Decidido: Empresa tem pipeline próprio** (ver acima).
> **Kids** segue no funil PF, mas o decisor é o responsável (não o aluno).

## Menu de automações

### Captura / anti-fricção (Dor 1)
- **Captura automática do lead** — registro criado sozinho (nome, telefone, origem). Fundação.
- **IA preenche o CRM a partir da conversa** — atualiza etapa, campos e resumo sozinha
  (com confirmação opcional do vendedor).
- **Resumo executivo da IA** — após a conversa, um brief estruturado:
  ```
  Interesse: Português Adulto
  Objetivo: Promoção no trabalho
  Urgência: Alta
  Orçamento: Até $100
  Objeção: Falta de tempo
  Próximo passo: Aula experimental sábado
  ```
  → um consultor novo entende tudo em 10 segundos (ótimo p/ reatribuição e gestão).
- **Classificação de intenção (IA)** — temperatura (**Quente / Morno / Frio**) e segmento
  (**Adulto / Kids / Teens / Empresa**). Ajuda na distribuição. *(Revisável pelo vendedor.)*

### Velocidade (anti-lead-frio)
- **Resposta instantânea** — saudação automática no 1º segundo, segura o lead e começa a qualificar.
- **Follow-up automático** — régua de mensagens para lead que esfriou (com cuidado de ritmo).

### Aula experimental
- **Confirmação automática (24h antes)** — "Sua aula é amanhã às 19h. Confirma?" com botões
  **Confirmar / Reagendar**.
- **Recuperação de no-show** — "Percebemos que não conseguiu participar. Posso remarcar?"
- **Check-in do professor** — professor marca **Compareceu / Não compareceu** → o CRM
  **muda de etapa sozinho**.

### Fechamento (handoff → matrícula)
- **Recuperação de abandono de contrato** — contrato enviado, não assinou em 48h → "Posso
  ajudar com alguma dúvida?"
- **Recuperação de pagamento** — link enviado, não pagou → follow-up automático.
- **Matrícula automática** — quando **pagamento OK + contrato OK**, criar automaticamente:
  - **Aluno** ✅ (automático total)
  - **Financeiro** ✅ (automático total)
  - **Turma** ⚠️ = **alocar na turma certa** (depende do nível da avaliação + vaga + data);
    auto-alocação **com regra** e confirmação humana nos casos-limite.
  - **Acesso ao portal** 🔜 V2.

### Gestão / performance
- **Alerta de SLA** — lead "Novo" parado além de X min → cutuca vendedor/gerente.
- **Relatório diário automático (no WhatsApp)** — ex.:
  ```
  Leads hoje: 24 · Respondidos em até 5 min: 92%
  Aulas experimentais: 8 · Compareceram: 6
  Matrículas: 3 · Conversão: 12,5%
  ```
- **Ranking de gargalos (IA)** — onde o funil vaza, priorizado:
  ```
  37% dos leads param após receber o preço
  28% faltam na experimental
  15% não assinam o contrato
  ```
  → "vale ouro para a gestão": aponta onde melhorar primeiro.

## Régua de follow-up (poucas e inteligentes)

> Regra: **não** metralhar (queima o número e irrita). Poucas mensagens, bem colocadas.

| Cenário | Cadência |
|---|---|
| **Lead novo sem resposta** | D0 (imediata) · +30 min · +4h · +24h · +3 dias · +7 dias |
| **Após experimental agendada** | 24h antes · 2h antes |
| **No-show** | 30 min após · 1 dia · 3 dias · 7 dias |
| **Proposta enviada** | 1 dia · 3 dias · 7 dias · 14 dias |
| **Lead perdido (nutrição)** | 30 · 60 · 90 · 180 dias |

- A **nutrição do lead perdido ramifica pelo motivo de perda**: "Preço" recebe conteúdo
  diferente de "Sem interesse"; "Perfil não aderente" talvez nem entre na nutrição.
- Tudo fora da janela de 24h = **template pago** (modesto, mas existe).

## Auto-alocação de turma (HÍBRIDA — decidido)

Fluxo ideal: **Teste de nível → IA sugere turmas → Consultor confirma → Matrícula.**
(Nunca: teste → matrícula automática → aluno em turma errada.)

- **Sugestão automática** quando: nível definido **+** turma com vaga **+** horário escolhido
  **+** turma ativa → ex.: *"Turma Kids A · Ter/Qui · 18h · 3 vagas"*.
- **Confirmação humana obrigatória** quando: última vaga · troca de nível · aluno transferido ·
  turma premium · turma corporativa · kids especiais · conflito de horário.

## Propriedade do lead (ownership) — regras

> Parece detalhe operacional, mas no fundo são **regras de comissão disfarçadas**
> (dono = quem ganha). Gera mais discussão na operação do que qualquer automação.
> **Pré-requisito: existe comissão por matrícula?** (a confirmar) — define o rigor das regras.

Defaults propostos (a validar):

| Situação | Regra proposta |
|---|---|
| Vendedor de férias/ausente | Dono **continua o mesmo**; reatribuição só **temporária** (cobertura/SLA) |
| Lead volta após ~90 dias | **Posse expira** → volta **para a fila** (evita acúmulo de leads mortos) |
| Lead PF virou Empresa | Vai para o **pipeline B2B**, registrando o **consultor de origem** (crédito) |

## Comissão do vendedor

- Comissão = **percentual da taxa de matrícula** (não da mensalidade).
- **Dono do lead:**
  - Todo lead tem **um único dono** = quem recebe a comissão.
  - Definido na **entrada** (auto-distribuição ou atribuição manual).
  - Toda **troca de dono** gera **histórico/auditoria**.
- **Lead reativado:**
  - **≤ 90 dias** sem interação → continua com o **dono original**.
  - **> 90 dias** sem interação → volta para a **fila** (ou o **gerente decide**).
- **Registro na matrícula:**
  ```
  Lead → Vendedor responsável → Valor da taxa → % comissão → Valor calculado
       → Status (Pendente / Aprovada / Paga)
  ```
  Ex.: Taxa R$ 299 · 20% · **Comissão R$ 59,80**.
- ⚠️ **A definir — estorno/clawback:** se a matrícula for cancelada/reembolsada **depois**
  da comissão "Paga", a comissão é revertida? Provável gate "Pendente → Aprovada" =
  pagamento confirmado + contrato assinado; **fechamento mensal** na Fase 2.

## Métricas-chave do funil
Tempo até 1ª resposta · taxa de comparecimento na experimental · conversão etapa-a-etapa ·
conversão por vendedor · conversão por professor (experimental) · tempo parado por etapa ·
motivo de perda · valor médio · CAC por campanha · leads por origem.

## Considerações técnicas
- Toda mensagem **proativa** fora da janela de 24h = **template aprovado** pela Meta (custo +
  aprovação prévia). Ritmo importa para **não bloquear o número**.
- Custo de mensagem estimado p/ ~40 leads/semana: **~US$10–30/mês** (maior parte da conversa
  cai nas janelas grátis de 72h do anúncio + 24h de resposta).

## Resolvidos (este bloco)
- ✅ B2B com **pipeline próprio**.
- ✅ **Motivos de perda** = lista fechada.
- ✅ **Régua de follow-up** definida.
- ✅ **CAC** faseado (manual → Meta API).
- ✅ **Auto-alocação de turma** híbrida (IA sugere, consultor confirma).

## Em aberto
- **Estorno/clawback de comissão** (matrícula cancelada após comissão paga) — regra a definir (Fase 2).
- **Faturamento corporativo B2B** (matrícula em lote + fatura à empresa) — detalhar na Fase 2.
- Conteúdo da **nutrição segmentado por motivo de perda**.

> Resolvido: comissão = % da taxa de matrícula (regras de dono do lead acima).
> "Localização" = **fuso horário**, simplificado p/ `America/Sao_Paulo` único, fora da Fase 1.
