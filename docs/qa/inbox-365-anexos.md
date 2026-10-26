# QA DEV — anexos #365

Fonte privada: parent a41792ca85e2e2a66e55889b87086bf59025d537. A composição pública e o QA independente ainda não foram executados. Sem SQL, browser, câmera real ou integrações externas nesta etapa.

O RED assertivo dos dois arquivos completos Compositor.test.ts e botoes.test.ts terminou EXIT1 (b93bd4): 148 casos, 9 falhas e 139 aprovados, após corrigir a instrumentação de refs do primeiro RED misto. Após implementação e adaptação semântica das verificações antigas que usavam HTML com SVG, os mesmos arquivos terminaram EXIT0 (896f4d), 148/148: Compositor 55 e guarda 93. Nenhum caso antigo foi removido. A guarda mudou somente o inventário nominal do Compositor, sem alterar detectores, exceções, tetos ou lógica.

Cobertura nova: ordem do menu, seletor de câmera, remoção de capture nos outros três tipos, porta de proposta presente/ausente/nula, resposta rápida com foco sem envio, callback obsoleto e ACK antigo preservando intenção nova. O mock de input não comprova suporte de câmera em dispositivo real.

Lint dos quatro arquivos TS terminou EXIT0 (f24b4b). TypeScript original --noEmit --incremental false, heap8192, terminou EXIT0 na sessão47686. Ambiente de testes UTC, sete provedores vazios e URL mock localhost:1; sem instalações.

Regressão conversa + guarda: 20 arquivos completos, 325 casos, EXIT1 na sessão35107 (90ab58), 280 aprovados e 45 falhas. Causa observada: mocks fechados de @tabler/icons-react em Compositor.mencoes.interacao.test.ts, Compositor.rascunho.interacao.test.ts e Compositor.scroll.interacao.test.ts não exportam IconFileText e os novos ícones do menu. Ampliação TEST-ONLY solicitada ao ROOT antes de editar esses três arquivos. Esse resultado não é regressão verde e não deve ser atribuído à fonte pública.

Pendentes: adequação autorizada dos três mocks e repetição do recorte, composição pública por hunks, QA independente, visual do grid/foco/menu e dispositivos com captura. #365 não está concluída.

Após GO ROOT, os três mocks receberam somente os oito exports de ícones ausentes. O mesmo recorte completo terminou EXIT1 na sessão83130: 20 arquivos, 325 casos, 323 aprovados e duas falhas em PR384 C3 do teste de rascunho. São expectativas posicionais da ordem anterior Contato/Enquete/Localização; a ordem aprovada #365 é Localização/Contato/Enquete. As verificações de IDs únicos/estáveis e disabled continuam presentes. A adaptação nominal dessas duas expectativas foi solicitada ao ROOT antes de qualquer edição. Lint dos sete TS terminou EXIT0 (90c3de). O resultado anterior de 45 falhas permanece preservado.

Os três testes MOTOR em Compositor.test.ts perderam apenas a dependência de HTML sem filhos SVG: o helper semântico exige exatamente um menuitem por rótulo, disabled=true, ausência de onClick, aria-describedby válido e uma descrição com texto canônico exato. Mantém os cenários sem capacidade, com capacidade e capacidades parciais; não libera envio MOTOR nem relaxa seus motivos.

Após autorização ROOT dos dois arrays nominais PR384, somente a sequência dos três rótulos e de seus motivos mudou para Localização/Contato/Enquete. As demais verificações de IDs únicos/estáveis, associação por aria-describedby e disabled ficaram intactas. Mesmos 20 arquivos completos: sessão9655 → c311dd EXIT0, 325/325 em 14,28s; nenhum filtro individual, skip ou timeout alterado. Lint7 final 6c75df EXIT0. O negativo intermediário 323/325 e o original 280/325 continuam preservados nos logs privados. Guardas nominais só alteram a entrada Compositor; seus detectores, exceções e tetos permanecem intactos.

TypeScript final após os dois arrays: sessão84768 → 6654cd EXIT0, configuração original --noEmit --incremental false/heap8192. O recorte final passou unidade, lint e tipos locais. Não constitui aceite visual, câmera real ou QA independente público.

Revisão de apresentação ROOT: a primeira implementação tinha SVG cinza sem o quadrado colorido do protótipo. Contraprova focal antes do ajuste, c9432f EXIT1: 56 casos, 55 aprovados/1 falha, esperava nove quadrados e recebeu zero. Ajuste autorizado somente nos dois produtos: metadados com classes existentes e span decorativo flex h-10 w-10 shrink-0 items-center justify-center rounded-lg. Equivalências aprovadas: azul/info Documento e Contato; violeta/ai Mídia e Resposta; vermelho rosado/danger Câmera e Áudio; verde/success Localização e Proposta; laranja/warning Enquete. Não há token específico de rosa/coral; desvio de hue documentado, sem alegar fidelidade pixel exata. O teste adicional verifica nove quadrados, tamanho, arredondamento, classes por categoria e aria-hidden. Disabled/guardas/MOTOR e backend não mudaram.

Gates após apresentação: 23 arquivos completos, 355/355, sessão10719→ccd49c EXIT0,22,76s. Comando inclui src/components/conversa, botoes.test.ts, paleta.test.ts, contraste.test.ts e contraste-elementos.test.ts, configuração unitária original/w1/sem fileparallel. Inclui agora 56 casos Compositor (novo teste visual estrutural), sem filtro/skip. Lint7 a3cdaa EXIT0. A imagem real no navegador continua pendente; estes testes verificam estrutura, tokens e guardas estáticas.

TypeScript após apresentação: sessão58824→40c80c EXIT0, original --noEmit --incremental false/heap8192. Todos os gates DEV finais atribuídos a esta fonte passaram. Checkpoint local autorizado somente nos dez paths; não encerra a issue nem substitui QA público/visual.

## Composição pública sobre main a20524fc

O integrador aplicou somente os dez paths do patch portátil, preservando o Compositor público e sem importar a ancestralidade privada. Na árvore pública, os 23 arquivos completos de conversa, botões, paleta e contraste passaram: 349 testes, sessão38979/terminal054542, código0,22,93s. A primeira tentativa no sandbox falhou antes de carregar qualquer teste por EPERM no cache temporário; foi preservada como falha de ambiente. O lint dos sete TypeScript terminou bd5959/código0. As contagens355 do DEV e349 da composição pública conservam suas fontes distintas.

O TypeScript local original com heap8GB terminou 8bd762/código1 por falta de memória, sem produzir resultado de tipos. A configuração inclui recursivamente os arquivos TypeScript; foram encontrados890 arquivos privados dessa extensão em output, incluindo clientes Prisma e fontes históricas preservadas. A tentativa diagnóstica listFilesOnly também esgotou seu heap; isso não é aprovação nem prova de ausência de erro no produto. Não foram alteradas exclusões, fontes históricas ou limites para declarar sucesso. A CI em checkout limpo e o aceite visual continuam pendentes; a PR deve permanecer em rascunho até concluir esses gates.

## Composição após integração das bases até #455

A main bfb85569 foi incorporada preservando o bloqueio externo da Aria, sua geração de callbacks e a porta física de rascunho de Insights. O menu365 conserva a porta de Proposta e os atributos de captura. Os conflitos ficaram no Compositor e no quadro; o quadro da main foi preservado e recebeu apenas a seção365.

Dois casos de montagem real verificam callbacks retidos de Resposta rápida e Proposta durante o bloqueio e após uma nova geração. A primeira tentativa4e8530 encontrou apenas spies ausentes nos novos dados de teste, corrigidos sem alterar os asserts. A contraprova234b48 removeu temporariamente o guard de saída somente no processo local: arquivo completo24casos,22pass/2falhas causais; os bytes produtivos foram restaurados em finally e conferidos por SHA. Não houve SQL ou envio.

A primeira regressão da composição encontrou seis falhas de mock fechado no arquivo de Insights recém-integrado, antes da importação dos ícones. Foram acrescentados somente os oito exports ausentes, mantendo os testes de rascunho físico e suas negativas. Resultado final:24arquivos completos/363testes, sessão64010/terminal9c8c5e, código0; lint8 d5ad47/código0. São os resultados dessa composição, sem somar os recortes anteriores. TypeScript/build/globais na CI limpa e aceite visual continuam gates próprios; o OOM local anterior permanece registrado.

## Achados da primeira CI e correção da composição

A CI40406566781 do head e2b6ccc passou TypeScript, build e lint. Os dois fusos unitários falharam: mock fechado de ícones do RodapeConversa.nota-foco; escrita genérica de atributo vetada pela guarda de aria-sort; e grade móvel de três colunas sem enquadramento na guarda responsiva. Esse run permanece vermelho, sem retry cego.

O seletor usa agora a propriedade DOM nativa capture para configurar environment; os outros tipos continuam removendo o atributo. O mock do rodapé ganhou apenas os exports ausentes. A grade de ícones tem exceção AST única no arquivo/elemento/atributos/classes exatos; os detectores e as exceções de KPI continuam intactos. Negativos recusam outro arquivo, outro rótulo, formulário, dois menus e uma segunda grade de formulário no mesmo arquivo. Não é uma liberação genérica de grades móveis.

O recorte ampliado passou27arquivos completos/390testes, sessão57756/terminalde19c5, código0,40,18s; lint10 terminou465588/código0. O quadro continha22 linhas de delimitadores de conflitos já presentes na main; foram retirados somente esses delimitadores, preservando todas as demais linhas e os dois lados históricos. O recibo privado253560 registra a comparação. A composição própria passa a13paths; nova CI e aceite visual ainda pendentes.
