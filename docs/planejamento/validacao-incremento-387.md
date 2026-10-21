# Incremento 387 — identidade persistida e pendências acadêmicas

Data: 14/09/2026.

## Identidade do aluno

O schema principal recebeu conta, sessão com digest, tokens de finalidade específica, fila de envio, limitação persistida de tentativas e proposta/decisão de troca de e-mail. Foram integradas as relações com Aluno e Usuario e os prazos operacionais opcionais, exigidos pelo serviço antes de habilitar a operação.

A migration `20260915004000_identidade_portal_aluno` foi aplicada somente em `localhost:54329/erp_genius_test`. Existem 177 migrations aplicáveis: a agenda reservada como incremento 177 continua fora da pasta de migrations. Não confundir a numeração de planejamento com a contagem física.

Validação Prisma e geração de cliente passaram. A comparação do banco de teste com o schema resultou em `This is an empty migration`. Isso comprova a estrutura comparável pelo Prisma, não o funcionamento completo do fluxo ou dos serviços externos. Testes de integração de identidade, interfaces e envio Resend permanecem pendentes.

## Acompanhamento acadêmico

A consulta e a tela de acompanhamento passaram a apresentar propostas de oportunidade extra de recuperação aguardando decisão, no alcance da matrícula e nível. O teste `oportunidade extra revalida saldo e permite rejeitar proposta desatualizada` passou, verificando a retirada da pendência após decisão. Foram executados somente esse teste e suas novas asserções: 83 outros testes do arquivo ficaram fora do filtro.

Essa exposição de pendências não implementa ainda o fechamento versionado Q154 nem a autorização de progressão. Segunda chamada está em desenvolvimento independente. A agenda de reposições e a falha de integração registrada no incremento 386 ainda dependem da próxima migração.
