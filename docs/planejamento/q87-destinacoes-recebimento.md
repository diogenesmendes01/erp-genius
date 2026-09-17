# Q87 — migração de recebimentos para destinações

O recorte de banco está preparado na migração 211, ainda não aplicada. Um
`Recebimento` passa a ser o fato de caixa original, com titular obrigatório,
pagador quando houver evidência e moeda/data/forma/autoria preservadas. A
baixa de uma `Cobranca` é dada por `DestinacaoRecebimento`; o crédito sem
destino é outra destinação, seguida obrigatoriamente de um
`CreditoMatricula` cuja origem guarda a mesma destinação, valor, titular e
moeda.

O backfill é 1:1 para cada recebimento legado: conserva o ID do recebimento,
valor, data e autoria. O campo singular `Recebimento.cobrancaId` continua
somente para leitura durante a transição. Como o histórico não continha
pagador nem evidência por destinação, ambos ficam nulos no backfill e a linha
recebe `origemLegada=true`; nenhuma evidência é inventada.

Depois de aplicar e gerar o cliente Prisma, os consumidores devem migrar em
uma única transação:

- O registro de pagamento cria o recebimento sem `cobrancaId`, com
  `titularMatriculaId`, e insere uma ou mais destinações. Para cada cobrança,
  atualiza `valorRecebido`, `saldo`, estado e versão pela soma das respectivas
  destinações, nunca pelo valor bruto do recebimento.
- Pagamento informado e conciliação M01 devem associar o informe/linha ao
  recebimento e à destinação materialmente equivalente. Não podem mais validar
  `Recebimento.cobrancaId` nem criar uma baixa singular. M01 só preenche
  `pagadorId` quando sua própria fonte o identifica.
- As projeções de uso de crédito, encerramento/acertos, compra de horas e
  conferências devem incluir `destinacoesRecebimento` filtradas pela cobrança.
  A soma precisa conferir `Cobranca.valorRecebido`; a lista de recibos deve
  carregar o identificador da destinação para não contar o mesmo caixa duas
  vezes em dois períodos.
- Relatórios de caixa partem exclusivamente de `Recebimento`; junções com
  destinações servem somente para detalhamento e não podem repetir o valor
  original. Crédito Q68 e devolução Q69 continuam pelo `CreditoMatricula` de
  origem, sem criar cobrança fictícia.

Os guards SQL bloqueiam edição/exclusão do fato original e das destinações,
destinação entre titulares/moedas distintos, soma acima do valor original,
crédito sem origem e acumulado de cobrança que não corresponda às suas
destinações. O autor do fato ou da destinação deve estar ativo e ser
Financeiro/Administração ou ter `pagamento.caixa` vigente.

Pendências antes de aceitar Q87: aplicar 211 pelo integrador, gerar Prisma,
migrar ações e telas, e executar cenários de dois períodos, crédito sem
destino, repetição/concorrência, legado, uso Q68 e devolução Q69. Este
documento não declara Q87 concluída.
