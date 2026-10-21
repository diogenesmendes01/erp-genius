# Incremento 456 — persistência e leitura da correção aprovada

Data: 15/09/2026. Meta integral ativa.

## Implementação

- Migration 206 cria `AprovacaoCorrecaoAula`: decisão imutável, uma por proposta, com motivo, autoria e revisão de impactos vinculada. Exige gestor pedagógico/administrador ativo diferente do autor, proposta mais recente e hash correspondente. Aprovação e rejeição são incompatíveis nos dois sentidos, inclusive por escrita SQL direta.
- A próxima proposta passa a usar a última correção aprovada como fonte. Propostas apenas preparadas ou rejeitadas não alteram a chamada vigente. O diário e os registros originais continuam protegidos.
- O leitor interno `carregarCorrecoesAulaEfetivasTx` seleciona a última publicação por encontro e valida as identidades dos snapshots. Frequência do nível e conferência de novas correções usam a projeção; a simulação continua sobreposta apenas em memória.
- Histórico do diário mostra conteúdo, participação e observações efetivos, identificando a versão publicada. O histórico de correções apresenta aprovador, data e motivo e não oferece rejeição/revisão como se uma publicação ainda estivesse pendente.
- Migration 207 e ações de reposição usam a participação efetiva da AULA original. Presença corrigida impede novo pedido, aprovação de atendimento e nova associação de agenda; falta corrigida passa a ser elegível. Uma decisão negativa continua disponível para resolver o pedido antigo, inclusive após pausa, preservando autorização e independência.
- Consultas e telas de reposição mostram a origem corrigida sem apagar o histórico ou concluir o pedido. A chamada da própria REPOSICAO permanece separada. A função SQL é VOLATILE para reler a publicação depois de aguardar o bloqueio do calendário.

## Verificação

- Rodada inicial de 27 integrações: `docs/validacao-projecao-publicada-456-2026-09-15.json`.
- Rodada final de **60 integrações aprovadas em seis arquivos**: `docs/validacao-correcao-reposicao-456-2026-09-15.json`. Inclui cadeia de duas publicações, diário efetivo, originais intactos, independência, decisões concorrentes incompatíveis, pedido que aguarda publicação e relê a origem, nova falta elegível e preservação/rejeição de pedido cuja falta virou presença. Regressões de agenda, permissões, Q54, frequência e fechamento também aprovadas.
- Dez unitários Q23, lint direcionado e build aprovados; build gerou 62 páginas estáticas e concluiu TypeScript.
- Migrations 206 e 207 aplicadas somente ao PostgreSQL descartável. Prisma Client gerado.

## Continuação e limites

Ainda não existe ação pública de aprovação/publicação Q23: a persistência foi exercitada internamente pelos testes. Antes de expor a decisão, faltam o tratamento das reposições já agendadas/concluídas afetadas, os efeitos financeiros e os casos de revisão de progressão. A validação estrutural dos impactos no banco não substitui seu recálculo transacional no comando de aprovação. A elegibilidade de novos atendimentos já usa a fonte efetiva; isso não representa a resolução automática das dependências existentes.

Não houve deploy, alteração de produção ou envio externo. Sem nova validação visual em navegador.
