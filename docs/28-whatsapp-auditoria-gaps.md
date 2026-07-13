# 28 — WhatsApp V1 + fase comercial: auditoria de gaps (pré-implementação)

> Auditoria de 2026-07-06 sobre os escopos fechados [`26`](26-whatsapp-v1.md) e
> [`27`](27-comercial-automacoes-ia.md): 6 lentes independentes (infra, bordas, segurança/
> LGPD, operação, dados, comercial) + verificação adversarial contra os docs e o código.
> **Gap ≠ escopo novo**: são decisões e pré-requisitos que faltam *dentro* do escopo já
> fechado. Cada item vira decisão de uma linha nos docs 26/27 ou pré-requisito de marco.

## A — Infra e plataforma (pré-requisitos de execução)
1. **Deploy de produção não existe** — o doc 26 pressupõe URL HTTPS pública (webhook Meta +
   eventos Evolution) e **processo sempre-vivo** (sessão Baileys, despachante com pacing) —
   nada disso roda em serverless, e não há Dockerfile/CI/VPS provisionado. Junto com a WABA,
   é o verdadeiro item de caminho crítico do dia 1. `[alta]`
2. **Modelo de execução do despachante** — frequência do tick, garantia de instância única
   (lock/lease), recuperação de crash no meio do envio (estado "enviando" órfão = risco de
   duplo envio), deploy durante o drain. Sem isso os guard-rails não têm chão. `[alta]`
3. **Armazenamento de mídia** — URLs de mídia da Meta expiram em minutos (download imediato
   no webhook); mídia Baileys chega cifrada; o storage atual é disco local com whitelist que
   nem aceita áudio; envio outbound exige Media API/URL pública. Pré-requisito da Camada 3;
   decidir S3/compatível + retenção. `[alta]`
4. **Segredos + autenticidade do webhook** — token permanente da WABA, app secret,
   **validação `X-Hub-Signature-256`** (sem ela, um POST forjado cancela réguas pela lei do
   despachante e cria leads via curl), apikey Evolution, e o auth state Baileys (= takeover
   total do número se vazar). Onde vivem, quem rotaciona, criptografia em repouso. `[alta]`
5. **Dev × produção no mesmo banco** — dev rodando o despachante local dispara mensagem real
   para responsável real. Exige: banco por ambiente + guard "despachante só drena em
   produção" + app Meta de dev com túnel. `[alta]`
6. **Backup inexistente** — o banco vira o arquivo único das conversas (o WhatsApp não é
   fonte de re-sincronização). `pg_dump` agendado + retenção + teste de restore **antes** do
   go-live; incluir estado da Evolution e mídia. `[alta]`
7. **Observabilidade mínima** — "alerta" aparece 3× no doc 26 sem existir canal/processo:
   health da sessão por número, idade do item mais velho da fila, monitor externo do
   webhook (a Meta suspende entrega após 5xx repetidos). `[media]`
8. **Resiliência do inbound** — dedupe por `message_id` (a Meta reentrega: lead duplicado,
   saudação dupla), handler responde 200 imediato e processa async, backfill de downtime. `[media]`

## B — Regras de negócio da régua (decisões novas para o cérebro)
9. **Destinatário sob ambiguidade** — adulto sem responsável, N vínculos FINANCEIRO,
   telefone nulo (schema permite tudo isso). O cron desassistido precisa de resolução
   determinística ou "sem destino → fila humana". Bloqueia o Marco 4. `[alta]`
10. **Pagamento parcial invisível** — a régua só conhece `quitada`; quem pagou 50% recebe
    "vencida" em tom firme. Decidir: parcial pausa? rebaixa tom? `{valor}` = saldo? `[alta]`
11. **Multi-país no envio** — janela de horário avaliada no **fuso do contato** (o schema já
    tem `Pais.fuso` e `Aluno.fuso` com comentário literal "envio de mensagens" — o modelo
    antecipou, o doc não usa); **idioma do template** por país (Meta exige language code;
    `Pais.idioma` existe); formatação de `{valor}` por moeda. 8h de SP = 5h na Costa Rica. `[alta]`
12. **Réguas simultâneas no mesmo contato** — semântica do teto de frequência (intenção
    suprimida: adia? descarta? consolida?), prioridade cobrança×comercial, 2 mensalidades /
    irmãos com o mesmo responsável. `[media]`
13. **Silêncio pós-inbound** — a lei do despachante cancela só intenções *anteriores* ao
    inbound; o cron do dia seguinte grava novas que passam. Falta período de silêncio
    (ex.: inbound não tratado suspende N horas/dias) e regra de rearme pós-promessa. `[media]`
14. **Vencimento alterado / cancela-e-recria** — os passos cumpridos ficam ancorados na data
    antiga (fluxo de ajuste existe no código); regra "mudou vencimento ⇒ remapeia/reseta
    passos". `[media]`
15. **Snapshot de renderização** — `{valor}`/`{vencimento}` resolvidos na criação da intenção
    ou no despacho (horas depois)? Gravar o corpo renderizado na Mensagem (auditoria). `[media]`

## C — Canal híbrido (o buraco do app verde)
16. **Eventos `fromMe` não especificados** — mensagem que o vendedor manda **pelo celular**
    (fallback declarado como permanente!) não entra no log: a stop-condition "vendedor
    assumiu" não dispara, a régua cobra lead já atendido, a IA lê meia conversa. Decisão
    provável: ingerir `fromMe` do Baileys como origem nova no log. `[alta]`
17. **Identidade/dedupe no C1** — telefone que já é aluno/responsável/lead-perdido manda
    mensagem no número de vendas: auto-criar o quê? (`telefoneE164` sem unique no schema;
    régua de lead novo metralhando aluno matriculado é o cenário concreto). Obrigatório
    antes do C1. `[alta]`
18. **Filtro de tráfego não-conversacional** — número Baileys recebe grupos, status,
    reações, broadcast; a normalização precisa filtrar antes do C1 auto-criar lead. `[media]`
19. **Referral no driver errado** — a origem automática do click-to-WhatsApp (doc 08) foi
    prometida para a Cloud API; vendas foi para Baileys. Validar se o referral chega via
    Evolution; especificar o caminho Google/UTM. `[media]`
20. **Reativo × proativo** — saudação "em segundos" colide com a janela de horário dos
    guard-rails. Falta a classe *reativa* (resposta a inbound), isenta de janela; degraus
    +30min/+4h idem. `[media]`

## D — Papéis, LGPD e auditoria
21. **Matriz papéis × WhatsApp** — quem aprova lote D+3/D+7 e o D+15, aciona kill switch,
    edita política, submete template, vincula contato, registra promessa pela inbox (doc 12
    dá PromessaPagamento a Financeiro/Secretaria — vendedor pode?). Doc 10 §2 sem linha de
    WhatsApp. `[alta]`
22. **Escopo row-level da conversa** — conversa é do *número*, não do lead: responsável
    financeiro que escreve no número de vendas vira legível pelo vendedor (doc 07 nega);
    quem atende a inbox do número de cobrança; gerente supervisiona threads? `[alta]`
23. **Base legal e consentimento** — contrato de matrícula não prevê comunicação/cobrança
    por WhatsApp; **nutrição de perdido é marketing sem opt-in** (LGPD + política Meta).
    Registrar opt-in por finalidade. `[alta]`
24. **Menores (Teens)** — lead menor conversa com automação e é perfilado pela IA
    (temperatura/orçamento/objeção). LGPD Art. 14: detecção de menor, redirecionamento ao
    responsável, retenção de mídia. `[alta]`
25. **Direito de eliminação × "ninguém apaga nada"** — conversas/áudios de lead que nunca
    virou cliente vs. doc 10 §6 append-only: desenhar anonimização/expurgo por categoria e
    prazo de retenção (dever legal de guarda ≠ conversa comercial). `[alta]`
26. **Auditoria das ações do canal** — eventos com autor para: aprovação de lote, kill
    switch, mudança de política (antes→depois), troca de driver, vínculo contato→aluno,
    edição/submissão de template. `[media]`
27. **Opt-out por finalidade** — revogação de marketing não pode matar cobrança contratual
    (nem vice-versa); prova e data da revogação (evento auditável). `[media]`
28. **Mídia inbound** — validação tipo/tamanho, risco de arquivo malicioso, autorização por
    objeto (a regra atual de arquivos não cobre mídia de mensagem). `[media]`
29. **IA × LLM externo** — DPA/no-training, minimização (mascarar telefone, enviar só o
    trecho necessário), e o output (temperatura/resumo) é dado pessoal derivado sujeito a
    acesso/contestação/eliminação. Requisitos escritos **antes** de escolher fornecedor. `[media]`
30. **Uso misto do número de vendas** — se o número atual tiver conversa pessoal, o espelho
    Baileys põe vida privada do funcionário no log; runbook de revogação no desligamento
    (o aparelho vinculado continua ativo até desconectar). Governança do doc 08 ("números
    são da escola") cobre a posse; faltam o filtro e o runbook. `[media]`

## E — Fase comercial (doc 27)
31. **C4 sem pré-requisitos declarados** — DocuSign e gateway não existem (GreenPay é baixa
    manual); as âncoras "contrato sem assinatura"/"link sem pagamento" precisam de sinal
    machine-readable ou de rodar sobre eventos manuais (com atraso). Declarar no doc 27
    como o C2 declarou a experimental. `[media]`
32. **B2B órfão** — C1 auto-cria com `b2b=false`; lead empresa entra na cadência PF
    (D0·+30min·+4h em RH é errado por definição do doc 08). Mínimo: excluir `b2b=true` das
    políticas PF. `[media]`
33. **Experimental subdimensionada** — o C2 precisa de entidade (estado de confirmação,
    histórico de reagendamento, check-in obrigatório — sem check-in não há detecção de
    no-show), não do campo `dataExperimental` mutável. `[media]`

## F — Go-live
34. **Apresentar o número novo às famílias** — antes do primeiro D-7, avisar pelo canal
    atual + "salve este contato": protege entrega/leitura (as primeiras métricas do V1) e o
    quality rating. Uma linha no plano de rollout. `[baixa]`

## Como usar (mapeamento gap → marco do doc 26)
- **Antes do Marco 2 (fundação):** A1–A8, C16, C18, D22 (escopo da conversa entra no modelo).
- **Antes do Marco 3 (política + shadow):** B9–B15, D21, D26, D27.
- **Antes do Marco 4 (go-live cobrança):** D23, D25, F34.
- **Antes do Marco 5 (inbox + vendas):** A3 (mídia), C17, C19, C20, D28, D30.
- **Antes da Onda 1 do doc 27:** C16–C20, D24, D29, E31–E33.

## Relacionados
[`26`](26-whatsapp-v1.md) · [`27`](27-comercial-automacoes-ia.md) ·
[`07`](07-papeis-permissoes.md)/[`10`](10-regras-sistema.md) (matriz de papéis a estender) ·
[`04`](04-fase1-dominio.md) (fuso por país — requisito de domínio já declarado) ·
[`15`](15-decisoes-adr.md) (ADRs de deploy/storage a criar).
