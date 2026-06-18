# Roadmap — ERP Genius (revisado)

> Filosofia: **primeiro operar tudo manualmente no sistema → depois automatizar →
> depois dinheiro → depois acadêmico.** Cada fase entrega algo usável.

## Fase 0 — Estrutura (operar manualmente)
- Login · papéis · permissões (função + propriedade)
- App shell (navegação)
- Home (cockpit) · Pipeline (PF/B2B) · Leads / Ficha do lead
- Matrícula manual → aluno
- Configuração (países · catálogo · turmas · usuários)
- **Financeiro manual** (cobranças · baixa manual · inadimplência · comissões · visão geral)

**Sem automações nem integrações.**
**Objetivo:** conseguir operar a escola inteira **manualmente** dentro do sistema.

## Fase 1 — CRM operacional (automações)
- Captura de leads (origem inteligente)
- Distribuição (dono do lead) + SLA
- WhatsApp (Cloud API direto)
- Follow-up (régua)
- Aula experimental / avaliação
- Matrícula (máquina de estados + DocuSign)

## Fase 2 — Financeiro (automação/integração)
> A base **manual** (cobranças, baixa, inadimplência, comissões, visão geral) já está na Fase 0.
> A Fase 2 adiciona **automação e integração** por cima dela.

**PF:** taxa de matrícula · mensalidades · descontos · bolsas · inadimplência · renegociação.
**B2B:** contrato corporativo · fatura única · matrículas em lote · relatório por colaborador.
**Integrações:** GreenPay · PIX · Boleto · Cartão.
**Comissão:** apuração automática · fechamento mensal · relatório por vendedor.

## Fase 3 — Acadêmico
- Turmas (online e — a confirmar — presencial em Campinas)
- Frequência
- Notas
- Teste de nível
- Progressão automática
- Certificados
- Portal do aluno

---

## Mapa dos documentos de design
- **Domínio / preços / matrícula / catálogo:** docs `04`, `05`, `06` (substância das Fases 0–3).
- **Papéis e permissões:** doc `07` (base da Fase 0).
- **Comercial / CRM / WhatsApp / automação / comissão:** doc `08` (Fases 0–1).

> Nota: os nomes de arquivo `04`–`06` usam a numeração antiga ("Fase 1"); o conteúdo
> continua válido — o que vale para a **sequência de construção** é este roadmap.
