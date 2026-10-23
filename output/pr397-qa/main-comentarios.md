# PR #397 — main atual e todos os comentários da R1

A fonte inicial 194fd6b9f9f7d8993f794d82b14dfa7566eb7966 recebeu QA independente favorável: dez arquivos / 120 testes próprios, saída0 em b1b240; CLI, resoluções e diff check em9a6241; identidade em74bc7b. Parecer original SHA2568d55968e58eb008823de5b6e48298ec6f4e1ed40beb2a341df58a2de4ddd0e03, preservado em tester-b2-194.md com apenas EOF normalizado. O recorte do integrador foi nove arquivos /109 testes, não a execução do TESTER.

## C1 — composição com a main atual

A #396 foi mergeada em2f512985, mas sua base também recebeu o kit QA da #280, commit003025b1. Por isso a árvore da main não é igual ao ancestral6a. A asserção597d25 detectou essa diferença antes do merge; nenhuma dessas adições foi descartada para simplificar a integração.

O merge normal preserva os43 arquivos da QA280: documentação, PDFs, modelos de bug, e2e/config, seed-qa, gitignore e scripts adicionais em package.json. Seus objetos são iguais aos da main2f, incluindo package/lock. Não executei seed, E2E ou banco. O único novo arquivo em prisma é seed-qa; schema e migrations permanecem iguais à fonte194. As verificações15a121 e98cf81 terminaram0. Os conflitos do quadro preservam ambos os lados, com quatro blocos contados; README mantém a versão194, que já inclui todos os dados da main referentes ao ancestral6a.

## C2–C4 — comentários LOW também tratados

- C2: SPEC e comentário do relógio registram o timer visual intencional. Há um único timer pendente; os prazos individuais podem ter fronteiras de minuto diferentes e causar mais de um despertar por minuto. O relógio não consulta a rede, e o cleanup cancela a espera.
- C3: as props agoraInicial de InboxNovo e ListaAtendimentos documentam o requisito para consumidores SSR, com instante serializado e fallback0 até hidratar. A opcionalidade e o comportamento existentes foram preservados.
- C4: rg em src/scripts encontrou proximoEstouroEm e esperaAteProximo apenas nas declarações e nos testes históricos. Ambos foram marcados @deprecated como APIs legadas, conforme a alternativa oferecida na revisão. Mantê-los preserva a API explicitamente documentada; o relógio produtivo usa proximaMudancaVisualEm.

As alterações em três fontes TypeScript são somente comentários. A comparação do JavaScript emitido com removeComments:true contra a fonte194 terminou0 em9ce708 para ListaAtendimentos, InboxNovo e prazo-vivo. Não foram criados testes que apenas repetem documentação ou alterada a lógica do relógio.

## Verificações da composição atual

- Typegen/TSC após integrar QA280:54202/05dab5, terminal0; lint29352/e0a6c7, terminal0/40avisos.
- TypeScript após as anotações LOW:62608/d0f1e3, terminal0; lint global4967/4088ba, terminal0, zero erros e40avisos.
- Os109 testes do integrador e120 do TESTER permanecem nominais à fonte194; o código funcional foi preservado e o emit das três anotações é idêntico. Não se declara nova suíte global local.

QA independente da extensão com mainQA280 e anotações, CI global final contra main em dois fusos e merge ainda são gates pendentes. Os globais/visuais históricos mantêm suas fontes originais. Não há envio real, nova instalação, migração ou uso de banco nesta revisão.
