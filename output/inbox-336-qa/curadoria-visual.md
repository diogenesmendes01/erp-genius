# QA independente — curadoria visual #336 em 6ac

Fonte final curada `6ac0ae06f819e2fd7371a99e6947a16727b6d1bc`; APP nominal `65839a85ebf87b4dcb443fef5acebe86538d00f0`, harness `953fb6342642d40d6ebdb80443adcc42761c3637`, backend/fixture `a96d86455efedb960b60dac198a99eb82238cbdd`. Revisão própria em 24/10/2026, exclusivamente no worktree TESTER para checkout/testes/parecer; assets fornecidos no DEV B somente em leitura. Parecer favorável à fonte final estática, ao recorte unitário, à curadoria dos 22 PNG e à inspeção das imagens, sem blocker identificado. Não é nova execução de browser/backend, QA da futura composição ROOT ou encerramento da issue.

## Fonte, delta e testes próprios

Preflight `971c51`, exit 0: tracked limpo antes do checkout detached exato6ac; pareceres privados anteriores preservados. Contra65839, o delta contém somente oito MD/JSON: quadro, SPEC, allowlist, fontes, relatório, README/manifesto curados e índice ZIP. Nenhum PNG/ZIP/raw/script entra nesse delta. `17800a` confirmou src/scripts/prisma/package/lock byte-identical a65839. O histórico intermediário59f que incluiu PNG não é pacote publicável: ROOT deve transportar somente o delta final contra65839.

Após a96, o único produto adicional é CSS de Contatos: grid-cols-1 explícito na página e cabeçalho móvel em duas colunas com Nova oportunidade na linha própria; há também a regressão browser persistente, que não executei. `1b844f`, exit 0, confirmou backend/schema/deps idênticos a96, HEAD6ac e tracked limpo/diff-check. Assim, os testes backend independentes históricos de a96 continuam nominais àquela fonte; não fiz INT nova.

UNIT próprio: sessão `60593`, inicial `934afd`, terminal `40099c`, exit 0: **48 arquivos/467 testes, 19,52s**, maxWorkers2, sem -t/skips. Comando `node node_modules/vitest/vitest.mjs run "src/app/(app)/funil/" "src/app/(app)/contatos/" "src/app/(app)/tarefas/" "src/app/(app)/aria/" src/server/inbox/atalhos.test.ts src/server/whatsapp/escopo.test.ts src/server/whatsapp/escopo-atendimentos.test.ts src/server/whatsapp/escopo-setor.test.ts src/lib/href-conversa.test.ts src/app/botoes.test.ts src/app/identificacao-registro.test.ts src/app/confirmacoes.test.ts src/app/tipografia.test.ts src/test/visual-inbox --maxWorkers=2`. Node22.23.2, Vitest local4.1.11, dependências existentes. Config unitária exclui os dois *.int do prefixo visual. Não é suíte global. Uma primeira seleção `07f6d9` passou35/236, mas usou prefixoagente e atalhos-caller inexistentes; foi substituída pelo comando completo com Aria real. Não conto a primeira seleção como recorte completo nem casos novos acumulados.

## Harness e atribuição dos hashes

Verificador final próprio `1b844f`, exit 0: **182 combinações anteriores +8 novas APP-only =190**. As quatro entradas reais são Funil/Tarefas/Contatos/Agente; não há referência funcional de protótipo fabricada. Config exige rota relativa da superfície e ID explícito; pronto exige href relativo exato, identidade codificada, Abrir/Agendar conforme origem, controles visíveis/fora de inert e documento contido. Aria só oferece Abrir. Navegação real do runner continua evidência nominal78032/49aa31, não uma navegação minha.

Os seis módulos do manifesto são idênticos nos blobs Git953↔6ac. Os SHA declarados são físicos e incluem EOL: capturar-inbox é LF; espera-app/estados-inbox/anonimizar-telefones são CRLF; entradas-inbox tem as primeiras33 quebras LF e a última CRLF; nucleo-captura tem CRLF exceto a quebra índice8 em LF (índice zero). Reconstrução apenas em memória produz exatamente os seis SHA esperados, sem BOM ou mudança de conteúdo.

A primeira checagem estrita `c5d339` saiu1 ao assumir hashGit=hashfísico. Investigação `96d3a8` comparou fontes Git exatas; prova `02cba8`, exit0, reproduziu os dois EOL mistos; verificador final `1b844f` saiu0 com todos os seis módulos. Uma tentativa read-only de fonte física B (`0bed68`) encontrou entradas-inbox ausente porque B já trocou checkout para outra tarefa; não foi usada como fonte desta QA. Nenhum arquivo B ou executável foi alterado para reconciliar os hashes.

## Verificação independente dos assets

`17800a`, exit 0: 22 arquivos regulares, paths seguros/únicos dentro do worktree B fornecido, sem symlinks; SHA-256, bytes, assinatura PNG/IHDR e dimensões deram zero divergência com a allowlist do MEU checkout6ac. **22 PNG somam1.801.972 bytes**. São16 origens (4×desktop/mobile×2temas),4 encerrada/ausente e2 B2B-leitor. `1b844f` confirmou que os22 originais da pasta da execução usados nas pranchas têm os mesmos hashes da allowlist final.

ZIP privado `output/inbox-336-aceite-65839-953fb-20261024.zip`, lido em B: **1.730.536 bytes**, SHA256 `5FBD1FB9DF576F0FBCCE250155048AE6BC9B949B19C8FC79F32CC107CEAA5285`,24 entradas exatas (22 PNG +manifesto.json +README.md). Reabri todas as entradas em memória, verifiquei CRC32/tamanho e comparei cada PNG byte a byte com o físico já validado. Nenhum extra/raw/negativo/script/credencial. Manifesto e README do ZIP são byte-identical aos blobs Git6ac, inclusive LF: manifesto10427B/SHA `0e580b456416df27d41be900c4d665f8d771bf7c70634c5fd4e636c4b9d2fba4`; README1913B/SHA `c96c17906fa26da555a7d4f053b338d9e6ea301d5929e1af3d8ba97e32d3baaf`.

## Inspeção visual independente, por passo

Inspecionei seis pranchas fornecidas em `output/inbox-336-visual-2026-10-24T12-38-57-940Z/inspecao-{claro,escuro}-{desktop,mobile,variantes}.png`, cobrindo os22 positivos. Abri também seis originais: Contatos móvel e Agente móvel nos dois temas, mais B2B-leitor desktop claro/escuro. Não criei nova captura. A revisão segue as regras de evidência visual do Product Design aplicadas às imagens explicitamente fornecidas, sem alegar execução interativa própria.

1. Funil — favorável: Abrir conversa e Agendar mensagem visíveis, identidade da oportunidade legível no painel em claro/escuro e desktop/mobile. Conteúdo inferior parcial em500px é limite do viewport, não prova de alcance de todos os comandos.
2. Tarefas — favorável aos atalhos: ambos visíveis nos dois temas/tamanhos; o aviso preexistente de fuso escolar não configurado permanece no desktop. Não foi ocultado nem tratado como resultado novo desta mudança.
3. Contatos — favorável ao fix: nos originais320×500, Abrir/Agendar e Nova oportunidade inteiros, com a ação na linha própria e margens laterais visíveis. Nome comprido usa reticências, sem empurrar o documento para fora da imagem. A foto não prova a largura DOM; o gate de documento320 e foco por Tab permanece nominal ao browserDEV.
4. Agente/Aria — favorável ao estado fornecido: cartão real do histórico após rolagem, identidade da oportunidade, Simulada e Abrir conversa íntegros nos originais móveis dos dois temas. Não há Agendar nem promessa de execução automática nessa foto.
5. Conversa encerrada — favorável: nas variantes desktop claro/escuro, contato encerrado só apresenta Abrir conversa, sem Agendar.
6. Conversa ausente — favorável: contato sem conversa não fabrica atalhos; mensagem de ausência de telefone continua visível.
7. B2B/leitor — favorável com limite: originais mostram Inbox real e “Você não pode enviar nesta conversa”. Não há lista JSX de participantes nessa fonte e não atribuo à imagem links da futura325. A200/podeEnviarfalse, B404 e DTOhrefA/hrefBnull são prova HTTP nominal do DEV, não nova prova minha.

## Limites preservados

Os22 estados/28 navegações (16Abrir/12Agendar), documento preservado, máximo de uma SSE simultânea e58 GETs cancelados/recuperados são dados históricos curados da execução78032/49aa31. Não reexecutei navegador, HTTP, teclado nativo, backend, browser regression, TSC ou lint; screenshots sozinhos não demonstram autorização, semântica de agendamento, acessibilidade integral ou todas as geometrias. Agendar=1 segue somente a ponte E4. Participantes visuais B2B da325 são N/A nesta fonte, sem botão inventado.

As duas negativas anteriores (overflow442→360→320 e expectativa privada Pessoa em vez do Lead canônico) permanecem fora da allowlist/ZIP positivo; não foram reclassificadas como positivas. Não houve upload, edição de fontes, instalação, Prisma/DDL, banco, preview, envio externo, push, PR ou merge. Não identifiquei achado geométrico nas imagens fornecidas que exija reabrir browser para esta QA; eventual nova composição deverá manter fontes e gates próprios.
