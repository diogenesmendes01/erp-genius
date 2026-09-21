# Incremento 577 — reconferência de Q160 e persistência parcial de remarcação

## Q160

A resposta do usuário confirma FIN-02.3 da SPEC: novas mensalidades usam referência contratual explícita de mês anterior, mesmo mês ou mês seguinte ao início da cobertura, mantendo o dia contratado. Não avançar a partir do vencimento antigo de uma cobrança reprogramada, nem alterar cobranças emitidas. Condição incompleta exige conferência.

Os testes existentes de `continuidade-mensal.test.ts` e `continuidade-vencimento-financeiro.test.ts` foram executados conjuntamente: 25 aprovados, zero falhas. Evidência: `docs/validacao-q160-577-2026-09-15.json`. Isso verifica cálculo e validações; não torna a emissão recorrente operacional. Q161/Q162 continuam pendentes.

## Remarcação de segunda chamada — ainda incompleta

Agente Terra preparou os modelos Prisma e a migration `20260915121000_remarcacao_agenda_segunda_chamada`, com proposta/decisão imutáveis, papéis ativos, aprovação independente, versão por reserva, chave idempotente e estado conferido. A ordem de bloqueio começa pela reserva e depois pelo calendário.

A revisão identificou que permitir uma decisão aprovada sem alterar a agenda contrariaria Q21. A migration passou a recusar `aprovada=true` enquanto não houver aplicador atômico. Propostas e rejeições não alteram agenda, oportunidade ou prazo. Os comentários Prisma e SQL explicitam essa limitação.

Migration ainda não aplicada nem testada no PostgreSQL. Não foi executada geração Prisma. Não há ação ou tela operacional de remarcação. Não contar essa estrutura como funcionalidade entregue; faltam revalidações, aplicação atômica, interface e testes integrados.

## Verificação global

A suíte completa do incremento 574 permanece em execução na sessão 83089 às 22:29 de 15/09/2026. Nenhum segundo processo de integração ou alteração do banco foi iniciado. As mudanças desta etapa não são cobertas pela suíte já iniciada. Sem implantação ou migração de dados reais.
