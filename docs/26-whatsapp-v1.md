# 26 — WhatsApp V1: canal bimotor + braço da régua + inbox (one-pager)

> Escopo fechado em brainstorm (2026-07-06); **revisado no mesmo dia para arquitetura
> bimotor** (Cloud API oficial + Baileys). Constrói a **fundação WhatsApp** e liga **dois
> consumidores**: o braço automático da régua de cobrança ([`24`](24-cobrancas-regua-fluxo.md)
> §V2) e uma inbox comercial mínima ([`08`](08-comercial-crm-whatsapp.md), fatia sem IA).
> As automações comerciais e a IA são a fase seguinte: [`27`](27-comercial-automacoes-ia.md).

## Motores (bimotor — decidido)
- **Dois drivers atrás de uma porta única**: **Meta Cloud API** (oficial) e **Baileys**
  (não-oficial, protocolo do WhatsApp Web). O driver é **atributo do número**
  (`NumeroWhatsApp.driver`), não do módulo — vendas e cobrança podem usar qualquer motor.
- **Extensão Chrome: avaliada e descartada** — frágil (DOM), presa a um navegador aberto,
  mesma violação de ToS do Baileys sem os benefícios.
- **Pedágio de cada driver** (pago por número, não por departamento):
  - *Oficial*: verificação do negócio (1× por empresa) + registro do número na WABA (**o
    número sai do app do celular, histórico não migra**) + template aprovado para mensagem
    proativa fora da janela de 24h. Estável, zero risco de ban.
  - *Baileys*: violação dos ToS do WhatsApp; risco de ban **baixo em conversa reativa e alto
    em disparo proativo em massa**; sessão via QR que pode cair; manutenção acompanha o
    protocolo. Número **continua funcionando no app do celular** (aparelho vinculado).
- **Se Baileys, via Evolution API** self-hosted (REST + webhooks + gestão de instância/QR),
  fora da internet pública, com auth — não rodar Baileys cru dentro do app.
- **Números**: cobrança ganha **número novo** (recomendação: driver oficial). Vendas **pode
  manter o número atual** conectando via QR — o app verde do vendedor segue como fallback;
  o "número novo de vendas" da versão anterior deste doc deixou de ser necessário.
- **Um contexto conversa por um número só**: a régua de uma cobrança usa o mesmo número do
  início ao fim; o responsável nunca recebe o mesmo assunto de dois números da escola.
- Volume atual (~95 alunos, ~40 leads/semana) cabe no tier de entrada oficial (250
  conversas únicas/dia por número).
- Desenvolvimento: **número de teste da Meta** (5 destinatários whitelistados) + instância
  Baileys de teste. Banco será resetado no go-live.

## Camada 0 — Fundação (o canal)
- **Porta única `CanalWhatsApp`** com adaptadores `meta-cloud` e `baileys`:
  `enviarTexto · enviarMidia · enviarTemplate` + eventos normalizados (`mensagemRecebida`,
  `statusAtualizado`). Régua, inbox e lote **não sabem qual motor mandou**.
- **Fila de envio única (outbox)**: nenhuma automação envia direto — cron, lote aprovado e
  clique na inbox gravam uma *intenção de mensagem*; um **despachante único** drena a fila
  aplicando os guard-rails uma vez para os dois motores: **idempotência por degrau · janela
  de horário · kill switch · shadow mode · pacing anti-ban** (jitter + limite/hora por
  número) · **teto de frequência por contato** (máx. de mensagens automáticas/dia somando
  todas as políticas, config). Falha de driver = mensagem fica na fila + alerta, nunca se perde.
- **Lei do despachante: automação nunca fala por cima de conversa viva** — toda intenção
  automática é cancelada se houver inbound do contato posterior à sua criação.
- **WABA + verificação do negócio** — só para números oficiais; caminho crítico da
  *cobrança*; inicia no dia 1.
- **Inbound + status normalizados**: webhook (oficial) e eventos (Baileys) traduzidos pelo
  driver para o mesmo enum `na_fila → enviada → entregue → lida / falhou` antes do banco.
- **Log de mensagens**: direção, contato, conversa, tipo, template, **status unificado**,
  **driver**, origem (humano/cron/lote), timestamps.
- **Identidade** (a costura com o ERP): telefone E.164/`wa_id` → **responsável financeiro** /
  aluno / lead. Opt-out por contato.
- **Sessão Baileys**: estado por número (`conectado / aguardando QR / caiu`) + fluxo
  "conectar via QR" na tela do número; desconexão degrada para "acumula na fila + alerta".

## Camada 1 — Braço da régua (cobranças)
- **Cron diário** roda o cérebro (`proximaAcao`) e grava intenções na fila para os degraus
  configurados como automáticos, registrando `CobrancaEnviadaWhatsApp { passo, canal: "api" }`
  — humano e cron continuam um do outro (doc 24). O evento de domínio **não sabe o driver**;
  o driver fica só no log de mensagem.
- **Régua configurável pelo admin** (política como **dado**):
  - por degrau: offset em dias · template · modo (**automático / manual / lote-com-aprovação**) · ativo;
  - global: janela de horário · dias da semana · **kill switch** · número remetente por automação.
  - A config **valida prontidão por número**: degrau só arma se o template estiver pronto
    para o driver do número remetente (aprovado na Meta, ou qualquer texto no Baileys).
  - Cérebro segue puro: `proximaAcao(cobranca, historico, hoje, politica)` — antecipa o
    doc 25 (motor de risco = escolher qual política aplicar).
- **D+15 (bloqueio) fora da config**: aprovação humana **sempre**, hardcoded.
- **Defaults de fábrica**: D-7/D-3/D0 automáticos · D+3/D+7 lote-com-aprovação · D+15 aprovação.
- **Lote por degrau entra no V1** (selecionar → aprovar → fila dispara); o motivo do
  adiamento no doc 24 (popup do navegador) morreu com a API.
- **Destino**: telefone do **responsável financeiro** (Kids: nunca o aluno).
- Falha de envio (número sem WhatsApp, template rejeitado, `failed`) devolve o item à
  **fila humana com o motivo**; opt-out marca o contato e o item vira manual-only.

## Camada 2 — Templates no ERP (entidade única, ciclo duplo)
- **Template é uma entidade só** (corpo + variáveis `{nome}`, `{valor}`, `{vencimento}`,
  `{link}`); o que muda por driver é o ciclo: **aprovação da Meta** só quando o template vai
  rodar em número oficial; em número Baileys todo template está aprovado no ato (é texto).
- **Marco 1 — mapeador** (pré-requisito do go-live da cobrança em número oficial): sincroniza
  templates aprovados da WABA e mapeia degrau → template (`amigavel · dados · vencida ·
  firme`, categoria *utility*).
- **Marco 2 — editor completo**: criar/editar no ERP; variáveis amigáveis mapeadas para as
  posicionais `{{1}}…`; submissão via API; ciclo **rascunho → em revisão → aprovado/rejeitado**
  (status via webhook). Edição de aprovado volta à revisão; a Meta limita frequência e pode
  reclassificar *utility* → *marketing*.

## Camada 3 — Inbox mínima (vendas + respostas de cobrança)
- **Dentro**: lista de conversas (não-lidas primeiro) · thread com histórico · texto livre ·
  indicador da janela de 24h (**só em conversas de número oficial**) · **mídia completa:
  receber E enviar** áudio/imagem/documento (gravação de áudio no navegador) · vincular
  contato → aluno/lead · ação rápida contextual (cobrança ativa → registrar promessa/pagamento).
- **Dono da conversa = dono do número** (1 vendedor/número hoje; sem transferência na V1).
- Se o cronograma apertar: **envio de mídia é o primeiro item que desliza** — nunca a
  fundação ou o braço da cobrança.

## Rollout (3 fases)
**Shadow mode** (cron grava intenções sem despachar) → **piloto** (N alunos) → **geral**.

## Métricas do V1
Entrega/leitura por degrau · promessas registradas · dias-até-pagar antes/depois · % da fila
zerada pelo cron · % das conversas de venda atendidas pela inbox.

## Dados & eventos (mudanças necessárias)
- Novas entidades: **número** (driver, finalidade, dono, estado de sessão) · **contato/vínculo**
  · **conversa** · **mensagem** (log unificado) · **intenção/fila de envio** · **template**
  (ciclo duplo) · **política da régua**.
- `CobrancaEnviadaWhatsApp` ganha `canal: "manual" | "api"` (o `{ passo }` já existe, doc 24).
- Novo evento: **opt-out do contato**. Atualizar [`12`](12-catalogo-de-eventos.md) na implementação.

## Ordem de construção (marcos)
1. **WABA + verificação** (burocracia — dia 1, corre em paralelo).
2. **Fundação**: porta + drivers + fila/despachante + log + identidade (número de teste).
3. **Política da régua** (config) + cron em **shadow mode**.
4. **Mapeador de templates** + go-live da cobrança (piloto → geral).
5. **Inbox** (thread + mídia) + conexão do número de vendas (QR Baileys).
6. **Editor de template** completo.

## Fora de escopo do V1 (estacionado — nada se perde)
Automações comerciais e IA ([`27`](27-comercial-automacoes-ia.md)) · múltiplas réguas por
segmento/risco ([`25`](25-motor-de-risco-cobranca.md)) · grupos (só Baileys suporta; fora do
V1) · transferência de conversa · enforcement técnico do bloqueio de acesso à aula (doc 24).

## Em aberto
- **Trava proposta, pendente de decisão**: régua *automática* (cron desassistido) exigir
  número com driver **oficial** — disparo proativo + repetitivo + link em Baileys é o padrão
  de maior risco de ban. Envio manual e lote-com-aprovação liberados em qualquer driver.
  Default proposto: trava ligada, sem toggle no admin.

## Suposição mais arriscada
**A inbox mínima segurar o dia-a-dia do vendedor sem as automações** — validar com o
vendedor real no piloto. Segunda: **prazos da Meta** (verificação, templates) — mitigação:
iniciar no dia 1; o braço manual (`wa.me`) permanece como fallback permanente. Terceira
(nova, do bimotor): **estabilidade do Baileys** — mitigação: fila segura mensagens em queda
de sessão, e qualquer número pode migrar de driver sem tocar régua/inbox/histórico.

## Relacionados
[`27`](27-comercial-automacoes-ia.md) (fase seguinte: automações comerciais + IA) ·
[`08`](08-comercial-crm-whatsapp.md) (visão comercial completa) ·
[`24`](24-cobrancas-regua-fluxo.md) (cérebro/braço — este doc é o braço automático) ·
[`25`](25-motor-de-risco-cobranca.md) (consome a política-como-dado) ·
[`12`](12-catalogo-de-eventos.md) · [`11`](11-modelo-de-dados.md).
