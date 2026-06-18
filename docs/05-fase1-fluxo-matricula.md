# Fase 1 — Fluxo de Matrícula (máquina de estados)

> A matrícula não é um evento, é uma **máquina de estados** que começa no comercial
> e termina com o aluno ativo. É praticamente a cauda do funil de vendas.

## Contexto da Genius

- **Escola de idiomas online** para **hispanohablantes** (público da América Latina).
- Hoje: **curso de português**. Futuro: outros idiomas.
- Portanto a matrícula é em um **curso/produto**, não em turma física com sala.

## Gatilho de virada (CONFIRMADO)

Uma pessoa só vira **aluno matriculado** quando acontece:

> **Pagamento da taxa de matrícula + assinatura do contrato.**

Ordem importante: **paga primeiro, contrato depois.** O contrato só é gerado após o
pagamento confirmado, já com os valores negociados dentro.

## Fluxo do aluno novo (conduzido pelo vendedor)

1. **Negociação** — vendedor acerta os valores (matrícula + mensalidade).
2. **Coleta de dados** — aluno entrega as informações pedidas pelo vendedor.
3. **Cobrança da taxa** — vendedor gera **link de pagamento** *ou* passa dados para **transferência bancária**.
4. **Confirmação do pagamento** — dois caminhos:
   - **Link/gateway:** confirmação automática.
   - **Transferência bancária:** conferência **manual** do comprovante (passo humano).
5. **Geração do contrato** — com dados do aluno + valores negociados.
6. **Assinatura digital** — envio via **DocuSign**.
7. **Matrícula ATIVA** — contrato assinado; aluno oficialmente matriculado.

## Estados do contrato/matrícula

| Estado | Significado | Quem age |
|---|---|---|
| **Em negociação** | Valores sendo acertados | Vendedor (comercial) |
| **Aguardando pagamento** | Valores acordados, link/transferência enviado | Aluno |
| **Pagamento em conferência** | Transferência aguardando conferência do comprovante | Financeiro/Vendedor |
| **Aguardando assinatura** | Pago; contrato gerado e enviado (DocuSign) | Aluno |
| **Ativa** | Contrato assinado; aluno cursando | — |
| **Cancelada / Desistiu** | Abandonou antes de ativar (terminal do funil) | — |
| **Concluída / Trancada / Inadimplente** | Estados pós-ativação (detalhar nas fases seguintes) | — |

## Decisões de arquitetura que isso gera

- **Dois caminhos de pagamento** = dois fluxos de confirmação. A transferência exige um
  **estado de conferência manual** — não dá pra ignorar.
- **Integração DocuSign** para geração/envio/assinatura do contrato (conector disponível).
- **Gateway de pagamento multi-país** para os links (a definir — precisa suportar
  múltiplas moedas/métodos na América Latina; ex.: Stripe, dLocal, etc.).
- **Conexão Fase 1 ↔ Fase 4:** o funil de matrícula é o mesmo do comercial. A automação
  de WhatsApp pode conduzir coleta de dados, envio do link de pagamento e do DocuSign.

## Rematrícula = retorno de ex-aluno (CONFIRMADO)

Não existe rematrícula de renovação. O **aluno progride de nível dentro do mesmo
contrato**, sem refazer matrícula. O único caso de "rematrícula" é o **ex-aluno que
cancelou, ficou fora e volta** — faz uma nova matrícula reaproveitando o cadastro.

> Estrutura de cursos (modalidades, níveis, turmas, Pré A1, particular) detalhada em
> [`06-fase1-catalogo-cursos.md`](06-fase1-catalogo-cursos.md).

## Em aberto

- Pagamento: **GreenPay** (Costa Rica, link) + **transferência global** (demais países, conferência manual). Estratégia de gateway = Fase 2.
- Matriz de preços (mensalidade por modalidade × país) — a fornecer.
