# Incremento 521 — execução financeira do período integral sem oferta

15/09/2026. Continuação de Q158/Q159. Agentes Terra implementaram banco, execução e interface; o orquestrador revisou e integrou os testes.

Uma decisão aprovada pode ser executada pelo Financeiro/Administração. Antes de aplicar, o servidor relê papel ativo, contrato, cobrança, recebimentos, crédito utilizado, fontes de indisponibilidade e cobertura futura. A aplicação guarda a versão aprovada e sua data; execução repetida retorna o mesmo registro, inclusive sob concorrência.

**Crédito:** constitui saldo de crédito com origem própria na aplicação, equivalente ao dinheiro recebido mais o crédito anteriormente liquidado. O saldo não pago deixa de ser devido. A cobrança conserva o valor original, os recebimentos, a liquidação prévia e a cobertura; o valor negociado final corresponde ao total já liquidado, com saldo zero. O status de liquidação não representa novo recebimento. A ficha financeira identifica “Regularizada por crédito”. Não se restaura o saldo do crédito antigo nem se cria devolução de dinheiro. Se nada foi liquidado, a aplicação retira a obrigação sem criar crédito de valor zero.

**Cobertura futura:** altera início/fim da cobertura da mesma mensalidade para o período aprovado, sem nova cobrança, preservando valores, saldo e vencimento. A cobertura original permanece na memória imutável. A ficha mostra “Cobertura reprogramada”; pagamentos posteriores continuam permitidos conforme o fluxo financeiro normal.

Aplicação, crédito e ajuste da cobrança pertencem à mesma transação. A proteção diferida do banco impede confirmar aplicação que deveria gerar crédito sem constituí-lo. Há proteção contra novos recebimentos e reabertura de mensalidade já regularizada por crédito. No encerramento, essa mensalidade fica no histórico de regularizações, fora do conjunto a acertar novamente; uma cobertura futura continua elegível pelas novas datas.

## Validação

- Migração 810 aplicada somente ao PostgreSQL descartável em localhost:54329; cliente Prisma gerado.
- Treze casos de período integral: seis de proposta/decisão e sete de aplicação, incluindo concorrência, rollback integral, pagamento misto, crédito zero, fonte alterada após aprovação, escopo e replays.
- Regressão conjunta com encerramento e fonte de compensação: 27 integrações aprovadas. Evidência em `docs/validacao-integracao-521-2026-09-15.json`.
- O ensaio de concorrência encontrou uma corrida no import dinâmico do NextAuth no runner. Apenas a entrada de sessão desse caso foi isolada; as duas transações, a releitura do executor, os bloqueios e os guards do PostgreSQL continuam reais. Nenhuma alteração de autorização em produção foi feita para acomodar o teste.
- Os treze casos de período integral foram revalidados após a revisão final de tipos e snapshot (`docs/validacao-periodo-integral-521-2026-09-15.json`); não são casos adicionais aos 27 acima.
- Vinte e três testes unitários aprovados nas suites de apuração integral, prévia mensal e demais cobranças do encerramento.
- Lint focado e build aprovados (`docs/validacao-build-521-2026-09-15.log`). A primeira compilação identificou tipos de união e fixtures incompletos; corrigidos antes da rodada final aprovada.

## Pendências explícitas

O fluxo ainda exige evolução para reconferir e substituir uma decisão aprovada cuja fonte mudou antes da aplicação. Hoje essa execução é bloqueada; a decisão original não é sobrescrita. Também falta permitir nova regularização de uma mensalidade cuja cobertura já foi reprogramada e posteriormente sofreu outra indisponibilidade: a aplicação atual é única por cobrança. São lacunas de implementação, não limites operacionais aprovados pela escola.

Emissão recorrente e retificação Q157 continuam pendentes. Interface sem ensaio interativo; o bloqueio anterior de inicialização local permanece registrado no incremento 518. Não houve mudança em produção nem devolução externa. A SPEC integral permanece em implementação.
