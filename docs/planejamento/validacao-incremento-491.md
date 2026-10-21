# Incremento 491 — persistência de propostas de aditivo Q117

Data: 15/09/2026. O incremento anterior entregou regras e projeção documental testadas; foi progresso de implementação. A meta integral permanece ativa.

## Implementação

`PropostaAditivoContratual` e `DecisaoAditivoContratual` guardam separadamente proposta e decisão administrativa. Propostas são versionadas por matrícula e possuem chave idempotente por autor, vigência, hashes e snapshot com fonte, alterações e texto documental. As duas tabelas têm FKs restritivas e proteção contra atualização/exclusão. Outra pessoa da Administração decide, inclusive quando há acúmulo de papéis; o banco também impede autoaprovação e aprovação de proposta superada.

Os serviços internos recarregam autorização, bloqueiam calendário/matrícula/processo e conferem a fonte assinada. Revalidam PDF original, conclusão, evidências e assinaturas contra o original preservado. O modelo precisa estar aprovado, com finalidade de aditivo e regime compatível. Valores anteriores são extraídos dos campos do documento preservado; uma condição sem origem estruturada exige conferência, sem inventar seu valor. O cadastro atual do aluno não reconstrói o original.

A decisão positiva reconstitui a base e compara o hash completo da proposta. A negativa pode registrar a rejeição de uma proposta antiga. Preparação e decisão não criam cobrança, pagamento, novo processo de assinatura ou matrícula; não aplicam condições. Alçadas específicas, formalização e aplicação continuarão sendo etapas próprias.

## Banco e validação

Migração `20260915055000_proposta_aditivo_contratual` aplicada somente no PostgreSQL descartável. Prisma Client regenerado; TypeScript e lint dos arquivos novos aprovados. A primeira rodada focada passou em cinco testes de integração (`docs/validacao-aditivo-persistencia-491-2026-09-15.json`).

Regressão concluída: `docs/validacao-aditivos-regressao-491-2026-09-15.json` registra **27/27 testes aprovados**, seis de persistência Q117 e 21 de substituição Q116. Cobrem concorrência/idempotência, integridade, modelo incorreto, rejeição de dados internos, isolamento por matrícula, autoaprovação no serviço/banco, versão superada, revogação de papel, rollback e preservação de cobranças/processos. Build concluído com sucesso, log em `docs/validacao-build-491-2026-09-15.log`.

## Limites

Serviços ainda internos, sem ações públicas ou telas Q117. Esta base cobre proposta inicial a partir de um único original concluído; encadeamento de aditivos aplicados, solução de múltiplos originais assinados e conclusão tardia de fonte cancelada ainda exigem implementação específica. Não escolher silenciosamente uma fonte conflitante. A assinatura simulada SANDBOX pode sustentar proposta interna de teste, com ambiente preservado; isso não comprova contratação real nem autoriza aplicação em produção.

Não há aplicação financeira ou alteração de cadastro pelo texto proposto. Geração/preservação do PDF próprio, participantes, assinatura, conferência, alçadas específicas, aplicação e revalidação temporal permanecem pendentes. O banco confere identidades e correspondência dos campos; o serviço recomputa hashes canônicos e valida bytes. Não atribuir ao SQL a recomputação integral desses hashes. Não houve deploy ou envio externo.
