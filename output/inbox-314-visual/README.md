# Evidências da issue #314

[ZIP sanitizado de revisão](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-314-evidencias-243c.zip), asset667631748, 14.528.057 bytes.

SHA256: `dcad18aa493d690b97116ff6032f7b8ed6f5cfe154a3348e01e08de53868d2f7`.

Upload/download e hash conferidos na release **draft** autorizada. O pacote contém129arquivos/106PNGs positivos:70DEV (28formais,24normais,12virtuais,6pranchas),15documentos/probes da allowlist e36PNG TESTER com manifestos e parecer. Sem negativos ou HTML bruto. Telefones do app são fictícios; protótipo recebe anonimização explícita do DOM antes da foto, preservando o original.

Fonte QA independente EXATA243c9348454b6cca5795a6afa747efa25ed3eef1; runtime/harness944e1736683aae58d85d00c6751dc8093b449b07. TESTER:13arquivos/181unitários exit0; seis contextos normais com24PNG e seis contextos99→101 com12PNG, sem erros/externos/overflow. Na transição, mesmo nó/linha/raiz/botão/foco, deslocamento0px, Tab para próxima mensagem e20–24linhas montadas. AllowlistDEV85/85hashes/tamanhos conferidos. As fontes individuais de cada prova permanecem no pacote.

DEV:51arquivos/613testes, TSC e lint dirigido exit0/0avisos. O opt-in stableMount vale somente para a thread; a lista de conversas mantém o comportamento312. A precisão subpixel evita o salto acumulado no limiar sem relaxar a tolerância2px. Negativos de remount e de salto5,0625px ficaram fora do pacote.

No consolidado atual, os objetos VirtualList, ConversaAberta e BalaoMensagem são idênticos aos da fonte243. O backend de NOTIFY das notas foi incorporado da revisão386e4 e a leitura382 está em consolidação separada. **Global final e PR314 ainda pendentes da correção382/R5 e verificação do novo agregado.** Não se presume QA de navegador posterior à fonte identificada acima.

Limites da SPEC: sem autorId público, homônimos idênticos não se distinguem; o rótulo de dia sem nova revisão pode ficar antigo durante ociosidade após meia-noite. Sem novo timer/rede de apresentação, geração de IA, envio real ou deploy.