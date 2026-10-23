# PR #395 — B1/C2: pais integrados sem perder contratos

Fonte d4c110cce1f1f5a9a2074e2e9e9fdde11bf7bae4, merge normal da base
codex/inbox-e1-base-revisoes-r3@00147761 na casca4818f43e.
A base original55968084 ficou intacta para o trabalho paralelo da #396.

A nova base incorpora main5f476a19 (inclui #386/#388/#389/#390/#391/#394),
a revisão #39206248af0 e a #393a1a79196 por merges normais. Os três primeiros
alvos de ancestralidade main/#392/#394 foram conferidos com resultado0.
As correções de fonte da #392 estão incorporadas; B2 continua pendente de
decisão humana e não houve alinhamento novo de package/lock ou instalação.

Preservados no consumidor: fila50ms/um GET com corpo/uma pendência e regras
R6 de IDs pendentes, época das entradas, visibilidade e GET fresco zero.
Avatar/estado e helper puro vêm da #393 aprovada. ConversaAberta passa o
quarto argumento da janela de notas da #388. OptOutContato, PainelContato e
scripts visuais são byte a byte idênticos ao4818; o foco aprovado não mudou.

Testes conciliados preservam os casos R6/fila e a ligação do painel da308.
O teste390 exige dois painéis, em montagem única, mantendo irmãos distintos,
identidade na mesma conversa e troca de keys/atendimentoId na seleção.
Uma expectativa legada4 residual reproduziu uma falha/88passes; ajustada
para2, o recorte três arquivos /89 testes passou. A guarda389 exige o header
direto e todas as classes do teto; a página confere três alturas da casca,
margens que anulam o padding, main e alturas reais da barra mobile.

Node22.23.2, executores acompanhados até saída0:

- Global2766:855 arquivos /6.723 testes unitários, maxWorkers2, sem filtro
  ou ignorados. Integração de banco não faz parte dessa configuração.
- TypeScript57449, heap8192.
- Lint global97075:zero erros /40 avisos herdados.

Sem novo browser ou DB nesta integração. Os 12 contextos de foco do relatório
foco.md são do4818 e não são apresentados como recaptura do novo consumidor.
B1/C2 de conflitos foram conciliados. Parecer do head final e C4/CI contra
main são gates; #392/B2 impede o merge antecipado da pilha. Sem deploy/envio.
