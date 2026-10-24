# #325 — limite da referência estática PROTO, lote74891

Avaliação somente leitura da delimitação autorizada pelo ROOT. **Não há motivo técnico para reter a referência estática apenas por este erro legado, desde que a exceção seja exatamente a autorizada e mantenha os limites abaixo.** Não é aprovação da implementação do matcher futuro, do lote74891 ou das imagens; QA final36 depende da entrega/inspeção.

Nenhum browser/HTTP/UI/banco/SQL ou edição dos originais pelo TESTER. Checkout permanece96c9e60752b3c1951922a745cee89045b4597ace, perfilintegracao/client487. O parecer final do coletorR2 e o negativo d1 permanecem intactos; este adendo é separado.

## Causa verificada no original

Leitura feec94 conferiu os hashes físicos informados pelo ROOT:
- docs/planejamento/inbox-prototipo/prototipo/Inbox.dc.html: `7698A34BAD041C95F45710CFE3ED6F79A97BA5F49BF5D941751C37324233D8CF`.
- docs/planejamento/inbox-prototipo/prototipo/support.js: `D6BB6DD3AADB9FF722D5D6DB2193572ECE476B915899575A571DE7A0717F001F`.

support.js1013 chama this.logic.componentDidUpdate(prevProps), com um argumento. Inbox.dc.html883 define componentDidUpdate(pp,ps) e acessa ps.sel/ps.convs. O segundo argumento é undefined. O wrapper chama o hook no ciclo didUpdate, após o commitDOM, e captura a exceção em console.error.

Antes da leitura de ps, o hook executa syncPerfil, applyTheme e ajuste da altura do textarea. Após a leitura faltante, o efeito restante seria toBottom. Portanto esse update pode deixar de ajustar a rolagem da thread. O componentDidMount tem toBottom próprio; a limitação não significa que nunca houve scroll inicial, mas impede usar essa referência como prova de autoscroll após updates/seleção.

## Delimitação honesta

A exceção pode registrar diagnóstico apenas no alvoPROTO, para a mensagem exata observada de undefined/sel, stack/callsites do par original e com AMBOS os hashes acima. A correspondência ampla “TypeError”/“sel” ou uma exceção aplicada também ao APP não seria equivalente ao aval. Outros erros de protótipo, falhas de rede, inconsistência visual ou divergência de hash continuam negativos. APP/guardas953/coletorR2 e respectivos critérios permanecem inalterados.

Não editar HTML/support, sobrescrever estado/DOM, injetar ps falso ou executar toBottom manualmente para fabricar uma referência positiva. A imagem só pode representar o estado estático efetivamente renderizado pelo original. A ausência desse erro não pode ser simulada por remoção de listeners.

Referência serve para aparência estática do painel/cabeçalho/valores/links visíveis. Não comprova funcionalidade, ACL, envio, teclado/foco, autoscroll/posição final da thread ou comportamento de seleção. Diferenças de scroll decorrentes do hook devem ser documentadas, não apresentadas como regressão/aceite funcional do APP. Prontidão/fontes/elementos esperados e inspeção dos PNGs continuam necessárias; a exceção não substitui essas provas.

Não li o código concreto do novo filtro privado nesta rodada; confirmei a causa e a honestidade do limite proposto. A implementação precisa preservar a vinculação estrita acima e registrar fonte/diagnóstico em vez de apagar o erro.

## Fontes, lotes e limites

74891 terminou EXIT1 após18APP candidatas auditadas sem falha e o primeiroPROTO semPNG. Esse resultado continua negativo. As18APP podem ser avaliadas individualmente por arquivo/hash/fonte/auditoria, mas não tornam o executor inteiro verde e ainda não foram inspecionadas visualmente pelo TESTER.

A autorização nova é para lote separado de12PROTO+6APP320 restantes, com o diagnóstico específico sóPROTO. Ele não é uma repetição retroativa de74891 e não entrega36fotos verdes sozinho. A curadoria final precisa manter origem dos18APP anteriores e dos18arquivos novos, manifestos/terminais/negativos e avaliar cada candidato. Nenhuma reclassificação de26ab1b/c588cb/d1/7f1915/c578af decorre deste limite.

Os dados do protótipo são referência fictícia local, não provaSQL nem leitura da base real. Nenhuma nota/Save/envio/integração externa está autorizada por este adendo. Aguardo a entrega final para QA das36imagens; a correção de fixtureC1 será revista separadamente após commit, sem novoDB por esta avaliação.
