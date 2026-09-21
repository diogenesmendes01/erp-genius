# Integração da frequência com reposições individuais

## Fonte que a frequência aceita

`carregarReposicoesFrequenciaTx` só considera `ReposicaoIndividual` que aponta
para a aula original coletiva, pertence à mesma matrícula e tem autorização
aprovada. A fonte efetiva é a conclusão original ou a última correção aprovada;
uma correção pendente ou rejeitada conserva a conclusão anterior.

Para uma particular, a conclusão precisa apontar para `EncontroAgenda` de
finalidade `REPOSICAO`, sem turma, na mesma matrícula, ministrado e encerrado
até a apuração. Também exige diário e registro `PRESENTE` do aluno com a mesma
matrícula. Este encontro é acadêmico e não usa `OcorrenciaParticular`, reservas
ou cobranças da particular contratada.

O encontro particular é registrado somente por
`registrarDiarioReposicaoIndividual`: exige a decisão aprovada, matrícula
ativa, encontro `REPOSICAO` previsto/terminado na própria matrícula e o
professor responsável. A ação grava a chamada presente e então muda o encontro
para ministrado. O guard de diário aceita essa finalidade somente nesse contexto
individual; recuperação, cobrança, reserva, remarcação e consumo continuam
restritos a `AULA`.

Para uma gravação, a conclusão precisa guardar entrega, resumo e atividade,
além de validação até a apuração por professor ativo designado para a reposição
naquele instante. A aprovação do pedido não substitui essa validação.

`EntregaReposicaoGravacao` conserva a entrega do aluno antes da validação. O
modelo atual ainda não tem uma identidade autenticável `Aluno ↔ Usuario`; por
isso não existe ação docente que crie essa entrega e o portal autenticado é a
próxima dependência concreta. `concluirReposicaoIndividual` recebe somente
`entregaId`, data de validação e evidência: professor não informa resumo,
atividade ou data de entrega em nome do aluno.

O leitor ainda confere que a aula original é `AULA` coletiva, ministrada, que a
regularização ocorre após o fim dela e que a fonte não é futura. Não consulta
`RealizacaoRecuperacao`, `NotaRecuperacao` ou os encontros de finalidade
`RECUPERACAO`; recuperação de nota não regulariza falta.

Instantes persistidos nas tabelas sem fuso são enviados em UTC explicitamente
(`timestamptz AT TIME ZONE 'UTC'`). O carregador compara a apuração no mesmo
referencial e a prova de integração confere o roundtrip de início, entrega e
validação; o fuso da sessão do banco não pode deslocar a data mostrada em Q55.

## Efeito na apuração

O carregador anexa fontes somente a registros originais classificados como
`FALTA` ou `IMPEDIDO_POR_RESTRICAO`. `apurarFrequenciaNivel` preserva a
participação original na memória, conta a aula original uma vez e escolhe uma
única reposição concluída para o numerador. Presença original e chamada
pendente nunca recebem crédito pela existência de uma reposição.

## Persistência pendente de integração central

O schema vigente não tinha nenhuma relação entre uma reposição e a aula
original: `OcorrenciaParticular` é a particular contratada/cobrável e
`RECUPERACAO` é avaliação por habilidades. Por isso eles não são usados como
atalhos. O fragmento [reposicao-modelos.prisma](./reposicao-modelos.prisma)
define as entidades e relações que a migration
`20260914234000_regularizacao_reposicao` deve acrescentar. Ele também exige
`REPOSICAO` em `FinalidadeEncontroAgenda` e os inversos Prisma necessários.

Depois de integrar schema e migration, os critérios verificáveis são:

1. particular `REPOSICAO` ministrada, com chamada presente, autorização e
   mesma matrícula regulariza uma falta/impedimento, sem aumentar a base;
2. entrega gravada só regulariza após resumo, atividade e validação do docente
   designado ativo;
3. correção aprovada substitui a fonte; pendente/rejeitada não a altera;
4. encontro contratado, recuperação de nota, pedido meramente aprovado,
   presença original e fonte futura não criam presença nem regularização.
