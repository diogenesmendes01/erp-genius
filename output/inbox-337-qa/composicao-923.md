# QA independente da composição #416 / #337 com #325 e #418 R1

Favorável à composição inspecionada no commit exato 923f06bfbeb7ab015d38a6034513445af6dff4d8. Não identifiquei divergência nos arquivos selecionados nem falha nos gates próprios: 15 arquivos UNIT / 245 testes, dois arquivos INT / 40 testes, TypeScript e lint dirigido terminaram com código 0. Este parecer não substitui CI remota nem constitui homologação visual nova.

## Fonte e ambiente

O merge local tem pais fceaaf1cecf7e10ba28de7ace7d3a41faee6a6e6 e 2f3db8b0e1cbf0bf2c36f3f0ec64591a85bbc5b5. Fiz checkout detached próprio na sessão 9290f4 EXIT 0 e preservei 1.151 privados por bytes e SHA256 antes/depois. O checkout anterior 6039755842dbbe946ba19d0436436a23dd930ce9 e seus pareceres permaneceram preservados. Nenhum arquivo de outro checkout foi editado.

Aguardei READY490 explícito antes de executar os gates. O integrador preparou generate27168/eca0ea e Next typegen66a5c2, ambos EXIT 0; perfil tester, schema 490 GitOID 7365328d336ff6ae5892e46f1e595f25923e3f1e, cliente próprio SHA256 647C2586589198B10C9345265E0CCE7A43819D5CB44633DBAD5E0E0B611FAE2B. Confirmei HEAD, perfil, cliente físico e tracked limpo em 836846. A integração usou exclusivamente erp_genius_test_tester490 na lease T, distinto de dev-gravacoes490 usado pelo ROOT. Não executei install, generate, DDL, cluster ou ferramenta de banco manual.

## Identidade da composição

A sessão 16571 terminou em 3c2724 EXIT 0 com comparação literal de OIDs Git, não apenas inspeção de nomes:

- Os 11 arquivos SRC da união C2 + C3/C4 de #337 R1 são idênticos tanto a ecc92d4781c5fe0f94f06920442769e8ad37b999 quanto a fceaaf1cecf7e10ba28de7ace7d3a41faee6a6e6.
- Os quatro arquivos SRC de #418 (acoes.ts, acoes-numero.int.test.ts, sessao.ts e sessao.test.ts) são idênticos a 2f3db8b0e1cbf0bf2c36f3f0ec64591a85bbc5b5.
- Os quatro arquivos SRC de #325 R1 (InboxNovo e teste de detalhes; useAbaPainel e teste) são idênticos a fd1ea7e70e74af2e495c9f31582df2816b4b8ab2.
- Schema490 e SQL #337 de 14h, 17h e 18h são idênticos a FCEA. Não há migração20h342 nesse delta. Dependências/package/lock são iguais ao pai #418.
- O diff combinado do merge lista apenas quadro-entregas.md. diff --check 2f3db8b0..923 passou em 84eddd e novamente em 2dd153; não há fontes não rastreadas em src, scripts/visual ou prisma. HEAD e tracked limpo foram reconfirmados ao fim de cada executor.

O manifesto de fontes contém todos os 19 paths, OIDs, bytes e SHA256 do conteúdo Git LF. O índice de execuções registra também bytes e SHA256 físicos desses mesmos arquivos. Esses namespaces são distintos: hashes de arquivo físico não são apresentados como OIDs Git.

## Gates próprios, acompanhados até o terminal

| Gate | Sessão e terminal | Resultado | Escopo |
|---|---|---|---|
| UNIT | 76911 / da8e36 | EXIT 0; 15 arquivos / 245 testes; 7,77 s | Arquivos completos; maxWorkers=2 |
| INT | 68476 / 83d937 | EXIT 0; 2 arquivos / 40 testes; 174,88 s | Config integração; maxWorkers=1 |
| TypeScript | 70952 / 04b6e5 | EXIT 0; 71,108 s do executor | tsc --noEmit; heap 8192 MB |
| Lint | b79ca1 | EXIT 0; zero avisos | União literal dos 19 paths; --max-warnings 0 |

Os recortes Vitest não usam -t, filtros de nome ou testes ignorados. Não somei UNIT e INT nem os reclassifiquei como regressão global. Todos os comandos exatos, duração do executor e SHA256 dos logs estão nos JSON privados complementares. Os tempos Vitest acima diferem do tempo total do processo registrado no índice.

Arquivos UNIT executados:

- `src/app/(app)/inbox/InboxNovo.detalhes.test.ts`
- `src/app/(app)/inbox/abas/useAbaPainel.test.ts`
- `src/app/(app)/inbox/abas/AbaDetalhes.test.ts`
- `src/app/(app)/inbox/ConversaAberta.test.ts`
- `src/app/(app)/inbox/ConversaAberta.mencoes.interacao.test.ts`
- `src/components/conversa/Compositor.mencoes.interacao.test.ts`
- `src/components/conversa/Compositor.scroll.interacao.test.ts`
- `src/components/conversa/Compositor.rascunho.interacao.test.ts`
- `src/components/conversa/Compositor.test.ts`
- `src/lib/mencoes-nota.test.ts`
- `src/server/inbox/mencoes.test.ts`
- `src/server/inbox/consultas-mencoes.test.ts`
- `src/server/crm/notificacoes-mencoes.test.ts`
- `src/server/whatsapp/sessao.test.ts`
- `src/server/whatsapp/motor/cliente.test.ts`

Arquivos INT executados, completos e sequenciais na mesma sessão:

- `src/server/whatsapp/nota-mencao-pool1.int.test.ts`
- `src/server/whatsapp/acoes-numero.int.test.ts`

O arquivo pool1 contém dois casos; acoes-numero contém 38. Os mocks de motor impedem HTTP externo real. Os testes de integração criam dados sintéticos no banco descartável; isso não é execução de notas manuais ou UI.

## Oráculos e implicações

O callback de menções continua estável por atendimento e propaga AbortSignal, credenciais same-origin e cache no-store. Os testes exercitam re-render sem repetir GET, troca de atendimento e codificação do alvo. O recorte de Compositor cobre debounce, tokens, interação, rascunho, caret e rolagem/ACK com o código selecionado da composição.

O produtor useAbaPainel conserva o último DTO bom em mudança de versão ou falha transitória; troca de identidade/aba/ativação limpa sincronamente o snapshot. 403/404 revogam o dado. A leitura do código confirma que falha500 posterior não reconstitui o DTO revogado; não apresento essa sequência composta específica como uma asserção nova escrita ou rodada nesta QA. Os arquivos existentes de cache/SSE/foco e Detalhes passaram completos.

Os UNIT de domínio preservam ambiguidade entre usuários visíveis, tokens selecionados e cache local de ACL na invocação. O teste diferencial existente e os casos de notificações lazy/keyset foram executados integralmente: o escopo não é calculado para lista vazia/legados/referência inválida e não atravessa chamadas, de modo que revogação elimina título/link.

No pool1 real, nota + ACL + notificação + aviso/NOTIFY confirmam juntos; replay não duplica e token incompatível reverte sem aviso. Em #418, a suíte completa inclui a corrida em que o mock do comando chama aplicarEstadoSessao DESC antes da transação, a leitura fresca CAIU, rollback administrativo após webhook já confirmado, sessão inicialmente desconectada, repetição sem outro POST/evento e compatibilidade do comando legado. Esses oráculos passaram novamente no schema 490 da composição.

## Limites e entrega do banco

Não fiz UI, browser, HTTP real, Save ou nota manual; não gerei nem reatribuí capturas. A revisão não renova homologação visual337, nem autoriza wrapper327 ou bridge326. Não repeti as dez integrações do ROOT sem risco adicional identificado. A cobertura própria é exatamente a dos dois arquivos INT acima.

Li output/inbox-337-qa/README.md como histórico nominal. O integrador informou que os anexos já foram autorizados e publicados diretamente na PR416, comentário 6386780823, com ZIP33909097 e PNGd0a6b829 verificados por ROOT/conector+DOM antes desta QA. Não há decisão humana pendente sobre esse envio. Essa atualização não transforma o corpus histórico de 38 PNGs d68 + dois ACK ab76 em prova visual do commit923; não fiz nova verificação remota nesta revisão.

Após o terminal 83d937 liberei explicitamente erp_genius_test_tester490 ao ROOT. O ROOT confirmou restauro ed1a8c EXIT 0, 424 hashes e fixture original de nove mensagens/quatro notas preservada. Nenhum outro acesso ao banco foi iniciado por mim.

Como evidência complementar declarada pelo ROOT, e separada da minha execução: global 46358/7ba9a7 EXIT 0 com 935 arquivos / 7.400 testes, 327,02 s, w2 sem filtros/skips; TypeScript 74f9df e lint global191e89 EXIT 0, zero erros e 40 avisos herdados. As dez INT ROOT na sessão 7455 ainda estavam em andamento quando este parecer foi fechado e não recebem aprovação aqui. CI remota/publicação seguem sob coordenação do integrador.

A leitura administrativa inicial cad65a terminou EXIT 1 porque a busca opcional encontrou diretórios .agents/.codex inexistentes; isso ocorreu antes do checkout e não foi um gate de produto. Não houve falha de execução nos quatro gates próprios desta composição.

## Índices e logs preservados

- Preflight: output/inbox-337-923-composicao-preflight-tester.json; SHA256 1039180E186331447D5627F9B15543BCDAD0D5FEFA7C429E48580EFD803299D3.
- Fontes: output/inbox-337-923-composicao-fontes-tester.json; SHA256 6a6902044078eaaaa4258779714448393bdde0afcb375c399cbca74c7dfe9d2d.
- Execuções e hashes físicos: output/inbox-337-923-composicao-execucoes-tester.json; SHA256 ba0c752b874317f0f54798c38e4385444a89fafe74a3bcf3a79621c3c233a413.
- Log unit: output/inbox-337-923-unit-tester.log; SHA256 7e601b706a531d2557ab7f9cefbc0b76ca506af940ef00d6087c101a73f07714.
- Log int: output/inbox-337-923-int-tester.log; SHA256 a9a4f10fbf3e6d997b147294f715cde4f10804f1cd70d3250c00e141a2c6e9da.
- Log lint: output/inbox-337-923-lint-tester.log; SHA256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.
- Log tsc: output/inbox-337-923-tsc-tester.log; SHA256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.

Parecer privado UTF-8 sem BOM, com LF. Sem alteração de source, ambiente, dependência ou documentação versionada pelo TESTER.
