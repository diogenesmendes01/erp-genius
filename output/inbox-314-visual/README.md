# Evidências da issue #314

[ZIP sanitizado de revisão](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-314-evidencias-243c.zip), asset667631748, 14.528.057 bytes.

SHA256: `dcad18aa493d690b97116ff6032f7b8ed6f5cfe154a3348e01e08de53868d2f7`.

Upload/download e hash conferidos na release **draft** autorizada. O pacote contém129arquivos/106PNGs positivos:70DEV (28formais,24normais,12virtuais,6pranchas),15documentos/probes da allowlist e36PNG TESTER com manifestos e parecer. Sem negativos ou HTML bruto. Telefones do app são fictícios; protótipo recebe anonimização explícita do DOM antes da foto, preservando o original.

Fonte QA independente EXATA243c9348454b6cca5795a6afa747efa25ed3eef1; runtime/harness944e1736683aae58d85d00c6751dc8093b449b07. TESTER:13arquivos/181unitários exit0; seis contextos normais com24PNG e seis contextos99→101 com12PNG, sem erros/externos/overflow. Na transição, mesmo nó/linha/raiz/botão/foco, deslocamento0px, Tab para próxima mensagem e20–24linhas montadas. AllowlistDEV85/85hashes/tamanhos conferidos. As fontes individuais de cada prova permanecem no pacote.

DEV:51arquivos/613testes, TSC e lint dirigido exit0/0avisos. O opt-in stableMount vale somente para a thread; a lista de conversas mantém o comportamento312. A precisão subpixel evita o salto acumulado no limiar sem relaxar a tolerância2px. Negativos de remount e de salto5,0625px ficaram fora do pacote.

No agregado `7e71df45377d86bd91798a125659bf600140db59`, VirtualList, ConversaAberta e BalaoMensagem são idênticos à fonte243. O backend de NOTIFY das notas veio da revisão386e4; a leitura382 usa a R6 `37a78dfe`, aprovada independentemente (54 testes oficiais dirigidos +39 adversariais) e integrada na main pelo PR382. Não se presume QA de navegador posterior à fonte identificada acima.

Gate global do agregado, executor2194 observado até saída0: 864 arquivos/6.771 testes unitários, next typegen, TypeScript com heap8192 e lint global (0 erros/40 avisos herdados), Node22.23.2. A configuração unitária exclui integração DB; não houve nova suíte de banco nessa execução. Evidências e limites em `output/inbox-314-global-final.md`. Revisão incremental do head documental e publicação do PR ainda pendentes.

Limites da SPEC: sem autorId público, homônimos idênticos não se distinguem; o rótulo de dia sem nova revisão pode ficar antigo durante ociosidade após meia-noite. Sem novo timer/rede de apresentação, geração de IA, envio real ou deploy.
