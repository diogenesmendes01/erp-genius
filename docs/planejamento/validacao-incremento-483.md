# Incremento 483 — persistência preparada para Q116

Data: 15/09/2026. Turno anterior foi progresso em validação e correção do teste de concorrência. Meta integral ativa.

## Alterações preparadas

Acrescentados ao schema `PropostaSubstituicaoContratual` e `DecisaoSubstituicaoContratual`, com relações para matrícula, processo fonte, originais, conferência do substituto e atores. A proposta possui versão por processo, chave idempotente por preparador, hashes das revisões, motivo, diferenças e snapshot. A decisão é um fato único por proposta com aprovador, resultado, motivo e hash da proposta exata.

Migration 216 (`20260915050000_proposta_substituicao_contratual`) preparada com proteção de imutabilidade, mesma matrícula, fonte/referência corretas, substituto distinto, conferências compatíveis e ausência de conclusão total de assinatura. Preparação exige Secretaria/Administração ativa; decisão exige outro administrador ativo. Aprovação de versão anterior a outra proposta é recusada. Essas verificações não substituem a revisão completa das condições no futuro serviço transacional.

A migration não cancela processo, não altera cobrança e não libera envio. Cancelamento externo e consumo da aprovação continuam exigindo implementação própria. O índice de idempotência recebeu nome explícito curto para evitar truncamento de identificadores PostgreSQL.

## Evidência e limite da validação

`prisma validate` passou com a URL do banco descartável fornecida somente para validação da configuração. Esse comando não aplicou migration nem conectou ao banco. A primeira tentativa sem DATABASE_URL falhou por configuração ausente; a validação com configuração explícita passou, inclusive após o ajuste de nome do índice.

O Prisma Client não foi regenerado. Nenhuma migration nova foi aplicada. O SQL foi encaminhado à revisão Terra somente leitura; a validação sintática e comportamental no PostgreSQL ainda está pendente. O schema validado, por si só, não comprova os triggers SQL nem Q116 funcional.

A revisão Terra foi concluída: não identificou incompatibilidade do tipo composto, da chamada com NEW ou dos nomes restantes de índices. Seus apontamentos foram incorporados antes de aplicar: referência externa deve estar sem espaços nas extremidades; snapshot deve conter identidade, revisões, versão, autor, motivo e diferenças iguais às colunas; a decisão adquire a trava institucional antes de ler a proposta. A revisão de leitura não substitui execução e testes no PostgreSQL.

## Execução preservada e próximos passos

A sessão `17801` da regressão 482 foi consultada e permanece viva. Ela iniciou antes da nova migration e valida a base aplicada até 215. Nenhuma dependência, código de ação ou configuração exercitada foi alterada durante essa execução; os novos modelos/tabelas ainda não são consumidos por ela.

Após o término, registrar o resultado terminal, concluir a revisão SQL e só então aplicar 216 no banco descartável, gerar o cliente e construir/testar proposta, decisão e consumo. Persistência de intenção/resultado de cancelamento, adaptador autenticado, substituição efetiva e UI continuam pendentes. Sem deploy ou comprovação de conclusão integral.
