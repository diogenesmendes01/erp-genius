# PR #396 — B1/C1/C2

O encerramento físico CLOSED libera a fonte compartilhada e invalida seus
callbacks. A próxima assinatura abre uma única substituta e entrega resync
a todos, incluindo a Sidebar que permaneceu montada. CONNECTING conserva a
reconexão nativa. Não há timer/retry/backoff novo; sem nova assinatura, continua
desconectado. Ciclos têm identidade própria, inclusive durante instalação
com callback síncrono, sem sobrescrever a substituta ou reviver a fonte antiga.

Fonte funcional babd1fe6, documentação ad47a2e7, ambas do DEV B isoladas sobre
5ff849d1, sem importar315/313. TESTER independente aprovou7arquivos/41testes.
C1 está documentado como capacidade por aba e recomendação de verificar HTTP/2
no proxy; não houve verificação ou mudança do proxy nesta entrega.

Integração4ef recebe main5f/#394 e produtores393 via base-r3, preservando
finally recontar311 e os IDs pendentes/R6. Recorte7/94, global857/6727,
typegen/TSC74791 e lint56565 terminaram0. Esse checkpoint não é o head final.

Merge9cfbbad6 incorpora3953fc e concilia README/quadro preservando as duas
seções. A PR fica empilhada sobre a308, mantendo somente o delta311/SSE.
Toda a fonte9cf difere da base312-r3@7c7f3cfc apenas nos três arquivos de SSE
do ad47, idênticos por bytes. OptOut/PainelContato/ConversaAberta são idênticos
à3953fc. Nenhum312/313/315 entra nesta PR.

Gates finais do9cf, Node22.23.2, executores encerrados0:

- Global82670:860 arquivos /6.748 testes unitários, maxWorkers2, sem filtro
  ou ignorados; integração DB é excluída pela configuração.
- TypeScript83357, heap8192.
- Lint global95898:zero erros /40 avisos herdados.

Browser do DEV B nas fontes babd isolada e3b combinada:503 controlado local
levou EventSource nativo a CLOSED antes do callback; Link Home→Inbox manteve
a Sidebar e abriu uma SSE real200, máximo uma fonte ativa e um documento/
timeOrigin. Resync do assinante antigo verificado. Dois diagnósticos esperados
do503 em cada fonte, zero falhas. Quatro PNGs positivos inspecionados; isso
não é recaptura deste9cf ou teste prolongado de capacidade.

[Pacote sanitizado](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-396-evidencias-babd-3b.zip):
344.425 bytes /11 arquivos /4 PNGs, SHA256
c7c4fb49b51be277b3cfb6bd34c7bdbbd1e675d8bce94051053532f7fa5561f7.
Upload/download/hash confirmados pelo integrador da produção das evidências;
metadados do draft conferidos novamente nesta revisão. Sem HTML/log/stack/
negativo ou credenciais no pacote. Binários não foram acrescentados ao Git.

Parecer independente final e CI contra main ainda são gates. Aguardar395 e
a decisão humana #392/B2; nenhum package/lock/install foi alterado aqui.
Não houve novo DB/browser próprio, integração externa ou deploy.
