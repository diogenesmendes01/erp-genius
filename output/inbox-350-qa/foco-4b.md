# QA causal independente #350 — fix 4b682c91

Fonte exata **4b682c913e02960cb6a3ee7b5400476d14114379**, runtime anterior b0be613ddd748abd6e1726c47a68eea757cadfc0. Parecer favorável à correção causal de foco/resultado no recorte executado: os mesmos seis contrafactuais antes negativos agora passaram, assim como os onze casos completos do arquivo B e lint dos dois paths. Não é aprovação de TypeScript, suíte global, integração, navegador ou aceite visual da #350 inteira.

## Fonte e preservação

Checkout próprio preparado em3f3513 EXIT0, HEAD exato/track limpo. Cliente/perfil492 preservados; nenhum DB acessado. O primeiro REDb0be a25472, log6.423/4854a528a713f8a7afb41f575546ee6c1f3808c10e4ec38e084de4cc2ef7be61, adendo6.401/dea829336e898535d67911a149b2d00bad67ce8048d1ce7d59a8ffd174ace157 e parecer344 foram conferidos/preservados por hash. Não modifiquei runtime ou teste para obter verde.

Freeze B nominal4b:1.573 bytes/SHA2569e33537c78149de31259011c1c33eeeb4fc59a54c3dd41ca0b86185c5e2e91c3. Pins conferidos:

| Fonte física/GitLF | Bytes | SHA256 |
|---|---:|---|
| CartaoSugestaoAria.tsx | 5335 | a36d2b135849e8959b994141b014b7c6eaa68c4cba21952c9b77d5787dadd573 |
| CartaoSugestaoAria.foco.test.ts | 11685 | 2d91a0ea9d8211d44637068cebca9c6f37a80d004e790fad4033ffd0930ea549 |
| intercalar.test.ts | 2409 | 39b96c9337c1869ac54d28af2d2cf4074cf7dafa0240431beb890628c524c69c |

Prova FS/Git própria f7422e EXIT0: entre b0be e4b o único runtime alterado é CartaoSugestaoAria.tsx. Os outros dois paths SRC são o teste novo de foco e o genérico explícito em intercalar.test.ts. Remover somente esse parâmetro de tipo recompõe literalmente o teste anterior, sem mudar dados/asserts. Os15 protegidos da revisão350 permanecem iguais e os privados preservados.

O original TESTER de9.104 bytes/SHA25684bc7e4bf7e0bb780f56faca07644800cd18ff0e5446fdd6ee2a570e2739b52b continua BYTEIGUAL no arquivo privado. O arquivo B contém esse MESMO bloco integral a partir do byte130, após um cabeçalho explícito de proveniência de130 bytes; depois acrescenta cinco controles. Não houve relabel de comentário histórico ou troca do oráculo entre RED/GREEN.

## Execuções próprias, completas e separadas

Todos com Node22 local, heap512MB, maxWorkers1, configuração original ou privada literal indicada, sem -t/filtro/skip ou timeout alterado. Cada chamada retornou terminal imediato, sem session_id pendente; não há executor TESTER ativo.

| Gate | Executor/terminal | Resultado |
|---|---|---|
| RED anterior, arquivo privado completo no b0be | a25472 | EXIT1;1 arquivo/6 casos;4 falhas causais/2 controles,972ms |
| MESMO arquivo privado completo no4b | 660937 | EXIT0;1 arquivo/6 casos,886ms |
| Arquivo B de foco completo no4b | b9a29d | EXIT0;1 arquivo/11 casos,663ms |
| Lint Card e foco B, maxWarnings0 | 01110b | EXIT0;2 paths,zero avisos/erros |

Os seis casos do primeiro verde estão contidos no arquivo B; **não somo6+11 como17 casos únicos ou global**. A coleção de onze contém os quatro causais, os dois controles antigos e cinco adicionais B.

Comando causal: node --max-old-space-size=512 node_modules/vitest/vitest.mjs run output/inbox-350-foco-decisao-causal-tester.test.ts --config output/inbox-350-foco-decisao-causal-vitest-tester.config.ts --maxWorkers=1. Teste84bc7e e config359bytes/1eeaa0811807ecd5a96340b466930bf416e66cc63edfd6de1785b0660093a51f não mudaram; só runtime e nome do log diferem da execução negativa. Config substitui include por arquivo literal, sem merge de arrays global.

Comando B: mesmo Node/Vitest/heap, run src/app/(app)/inbox/aria/CartaoSugestaoAria.foco.test.ts --maxWorkers=1, config original. Lint: mesmo Node/heap512 e node_modules/eslint/bin/eslint.js nos dois paths, --max-warnings=0. Não houve TSC/DB/global ou native.

## Causalidade verificada

Em aprovação e rejeição, tanto após deferredACK quanto com dado SSE antes do ACK, o mesmo cartão permanece conectado, mostra estado decidido, conserva foco conectado significativo dentro dele e possui anúncio semântico acessível do resultado. O oráculo não exige destino específico. No ramo SSE as mesmas condições também passam ANTES de liberar a promise; o sucesso posterior não é usado para mascarar a perda intermediária.

Pai ReactDOM/useState, Cartao/SessaoCartao, Botao, useAcaoCliente e FeedbackAcao reais; falsos apenas actions/dados, glifos SVG e DOM mínimo/eventos declarados. O pai não força foco/resultado do componente e não copia o algoritmo corretivo. A mesma callback de decisão é executada exatamente uma vez por ID; erro e ACK de cartão desmontado continuam controles positivos.

O arquivo B acrescenta: duas decisões remotas sem nossa action/ACK; foco externo preservado nos ramos ACK e SSE, enquanto anúncio ainda ocorre; e perda de foco simulada por blur após disabled, com retorno conectado ao resultado. Este último caso emula a ida a body no DOM mínimo, não é uma observação nativa de browser.

## Revisão do fix

O grupo de botões usa callback-ref estável; o detach captura o foco antes de remover os controles, inclusive no dado remoto sem action local. A origem é registrada antes de desabilitar durante a action para o cenário de blur. useLayoutEffect consome o pedido apenas ao sair de pendente e só transfere foco para resultado conectado quando o ativo ainda é o antigo controle, body ou desconectado. Nó externo conectado é preservado. Regiões hidden/inert/aria-hidden são recusadas como destino. Na montagem já decidida sem grupo anterior não se cria pedido genérico de foco.

O p de resultado, role=status/tabIndex−1, permanece montado vazio antes da decisão; recebe o texto real e classe visível quando decidido. Isso supre a região ausente anterior sem criar mensagem artificial no pai. A proteção por ID/ativa contra ACK desmontado e o executor/trava/erro continuam; não há ação nova, status otimista, retry automático, ACL ou backend alterado.

Não foi necessário alterar os seis contrafactuais para acomodar esse destino. Native/layout/tecnologia assistiva real permanecem escopos diferentes: os testes exercem semântica DOM, propriedade/conexão do foco e mutação real ReactDOM, mas não demonstram anúncio audível, Tab, clipping ou destino observado num navegador real.

## Artefatos e negativos administrativos

- RED original: inbox-350-foco-decisao-causal-red-b0be-tester.log,6.423 bytes/4854a528a713f8a7afb41f575546ee6c1f3808c10e4ec38e084de4cc2ef7be61.
- GREEN privado: inbox-350-foco-decisao-causal-green-4b-tester.log,478 bytes/1c93a2b4fed98ede3ceb19dd8d0b509d237cb36229ff3d8352eeafb1defcd165.
- GREEN B: inbox-350-foco-b11-4b-tester.log,480 bytes/60948b1d77f70f1a29a2398df09b7543d0aff472e7e1cedfb3817d883623ed80.
- O lint silencioso01110b terminou0, mas Tee não criou arquivo por não receber stdout/stderr. Não fabriquei log vazio nem repeti lint; o terminal da ferramenta é sua evidência.

O verificador administrativo94387e tentou ler esse log inexistente e parou ENOENT. O seguinte8d12b9 já confirmou runtime/pinos, mas esperava o bloco original no byte0, não após o cabeçalho de proveniência. Scripts/JSON negativos preservados. Ajustei apenas metadados/oráculo de localização literal; f7422e EXIT0 confirmou bloco único no byte130. Nenhum desses incidentes é teste de produto, nem altera os verdes660937/b9a29d/01110b.

Prova estruturada: output/inbox-350-foco-4b-final-resultados-tester.json, 5665 bytes/SHA256 8a4f37d430fc4666b40bb2eeeee2d2043f6d2450e1801d70c4f4c6ab141d6199. Contém arquivos, pins, primeiros negativos, gates, limites e liberações; não existe log de lint artificial.

## Limites finais e coordenação

Parecer estático b0be e adendo RED permanecem originais nominais. O finding causal está resolvido no4b para os cenários executados; não se converte o b0be em aprovado retroativamente. UNIT25/544 DEV/lint17 prévios e GREENDEV4/40 são provas DEV sobrepostas, não execuções minhas. ROOT comunicou TSC original80288/44bd90 EXIT2 com dois privados históricos e o genérico de teste; este fix não reatribui aquele run nem declara TSC final aprovado.

Liberei a janela ao ROOT após o lint terminal0 para o TSC final B. Nenhum executor meu ativo, nenhuma lease ou consulta DB. Cliente/perfil mantidos; restaurador TESTER491 continua proibido após492. Aceite visual seis pares, interações nativas, integração pertinente e composição/CI/publicação da #350 permanecem pendentes, sujeitos ao integrador. Não houve novo envio real, provider, captura ou autorização operacional.