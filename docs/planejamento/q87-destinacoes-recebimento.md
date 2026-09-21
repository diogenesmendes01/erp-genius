# Q87 — migração de recebimentos para destinações

O recorte de banco está aplicado no perfil descartável pela migração 211. Um
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

A rota `/financeiro/recebimentos` atende a operação manual: seleciona um
contrato e sua moeda, reparte o valor entre cobranças abertas daquele contrato
e/ou crédito sem destino, apresenta o total antes da confirmação, permite
pagador, data, forma, comprovante e evidência por destino. O retry preserva a
mesma chave idempotente enquanto o formulário estiver aberto.

Aceite local Q87 concluído: código, interface, uso Q68/devolução Q69 e preservação de reserva Q108 têm evidência independente no [quadro único](quadro-entregas.md). Integração52bdf51f e correções054385e9/0fa78a18/f17fc0f8; migrações211/214 no banco descartável principal. Regressão integrada ampliada segue registrada separadamente; aceite local não declara toda a SPEC nem operação externa concluídas.
