# Inbox #343 — estado e autoria da prévia no item da lista

Estado de publicação: integração remota nominalf1f aprovada4/4,350arquivos/3.112testes;3arquivos/4preparadores visuais opt-in ignorados, sem somar recortes. A candidata incorpora main425/a0b8f82c:12SRC343 byteiguais3de/f1f e2SRC423 byteiguais àPR425/QA38. Fullf1f antecede423 e NÃO é execução integral combinada posterior. TypeScript original combinado26136/db8c4f passou0 sem exclusões. [CI nominal e limites](inbox-343-qa/ci-f1f.json), [composição atual](inbox-343-qa/composicao-main-423.json) e [QA integral](inbox-343-qa/indice.json). CI global final da composição e merge ainda pendentes; issue343 aberta.

Entrega DEV no ramo codex/inbox-e3-343-previa, pai54c44b2ad2f5414f346e07dea76001a13c799051, produtor342 congelado. ItemListaInbox ganha estadoAria, atendidoPorVoce, previaAutor e previaRotulo, com o mesmo contrato em página e deep link. [SPEC](../docs/specs/inbox-estado-previa-lista.md). A dependência342 está integrada; QA independente/composição e gates originais ROOT aprovados, CI e merge343 seguem com ROOT. A issue não está concluída.

## Comportamento e preservação

A prévia segue a ordem literal aprovada ROOT: sugestão mais nova; entrada/ausência; IA; autor próprio; outro HUMANO/CELULAR com nome; restantes nulos. Assim IA vence autorId próprio, e origem automática com autor próprio é voce. Sugestão mostra somente ACAO_AGENTE_IA_LABEL, nunca texto/payload. Empate de instante não é sugestão posterior. Nome de outro autor é reduzido ao primeiro nome, com espaços normalizados. preview mantém a última mensagem; estadoAria e autoria da prévia são independentes.

montarItens retorna imediatamente para vazio, carrega contexto uma vez e sugestões em um lote só com os IDs autorizados de fixadas+pagina. Um deep link fora do escopo retorna null antes disso. A quantidade de operações adicionais é constante; o volume e o processamento dependem do lote. Não se afirma que as consultas herdadas de preferências, agrupadas por lidaAte, já fossem constantes. Não há cap novo: o caso100 fixadas+200 normais valida300 IDs e a página seguinte preserva o item301. ConfigIA continua podendo ser inicializada pelo contexto342 quando existem itens; vazio não a inicializa.

includeLista seleciona direcao/origem/autorId/criadoEm/autor.nome além de corpo/tipo, escolhendo criadoEm DESC/id DESC. ACL, keyset, fixadas, limites, contagens e thread foram preservados: provaAST bcbfb1 confere seis funções textualmente idênticas ao pai (condicoesDosFiltros, contarChipsInbox, depoisDoCursor, listarAtendimentosPagina, obterItemListaInbox e listarMensagensPagina). Produtor342, seus testes, uso.ts, schema e migração permanecem com os mesmos blobs. Nenhum helper342 foi extraído durante QA.

Oito literais completos em testes cliente receberam apenas os quatro defaults. ProvaAST/diff preserva o restante dos objetos, asserts e drivers. Nenhuma produção cliente, harness, permissão D1, envio D2/D3, schema, dependência ou migração foi alterada. D1 usa o responsável da CONVERSA; atendidoPorVoce é indicador, não autorização. Consumidores visuais ficam em346/348.

## TDD e gates observados

| Execução | Escopo nominal e resultado |
| --- | --- |
| 8514c2 RED | previa.ts ausente; suite sem casos coletados, EXIT1. |
| 8777/484947 RED INT | Novos oito casos filtrados: sete falharam por DTO ausente, controle vazio/ACL passou;24 testes ignorados pelo filtro. EXIT1, não suíte completa. |
| 0d263d GREEN | previa.test.ts completo,9/9,EXIT0. Inclui origens automáticas/própria/IA/entrada, nome vazio e sugestão anterior/igual/posterior. |
| 80820/fc832e | Recorte completo Inbox cliente+prévia:60 arquivos/533 testes,19,29s,dois workers,EXIT0. Fonte anterior apenas ao oitavo literal inferido; não somar ao global. |
| 14765/5308b7 | consultas-pagina.int.test.ts completo:32/32,133,27s,um worker,sem filtro/skips,EXIT0. Produto e arquivo INT não mudaram depois; só um literal UNIT foi completado. |
| 40027/cc3c5f | TSC auxiliar inicial,EXIT2: literal inferido de InboxNovo.foco sem quatro campos; defaults acrescentados sem cast unknown ou relaxar asserções. |
| 89471/f0c373 | TSC auxiliar final,--noEmit --incremental false,heap8192,EXIT0. |
| ca1886 | Lint dos12 arquivos SRC/testes343,--max-warnings=0,EXIT0. |
| 85689/59dd3e | Global UNIT:938 arquivos/7434 testes,277,88s,dois workers,sem filtro/skips,EXIT0. Configuração original exclui INT. |

A integração valida IA/pessoa/próprio/sugestão, responsabilidade da conversa, página/deep link, label sem texto sugerido, sugestão vencida, pausa/handoff, empate de mensagem, empty/ACL e lote300+cursor. O controle de query confere contexto/ConfigIA uma vez no lote e uma query de sugestões com exatamente os IDs retornados. As24 integrações antigas de paginação, fixadas, preferências, escopo e contagens também passaram no mesmo arquivo completo. Mensagens são registros fictícios MOTOR; nenhum provedor/envio externo foi acionado.

## Escopo TypeScript e ambiente

Usou-se a auxiliar privada já aprovada ROOT para as duas importações históricas326 ausentes na base. Ela estende tsconfig original, mantém todos os includes/excludes e acrescenta SOMENTE:

- output/inbox-326-a2-diagnostico-private.test.ts
- output/inbox-326-package-r8-7a30d4-preservado-private/inbox-326-a2-diagnostico-private.test.ts

Prova b7dd47 pelo parser TypeScript:3027 arquivos originais→3025 auxiliares, somente os dois removidos, fonte343 incluída. TSC original27111/d08ff2 foi negativo nominal342 por essas importações e não foi repetido/reclassificado nesta343; ROOT verificará o checkout limpo. Nenhum tsconfig público ou original privado foi alterado.

ROOTe6bbc5 preparou branch/cliente próprio490 SHA256647c2586589198b10c9345265e0cce7a43819d5cb44633dbad5e0e0b611fae2b e ciint491,424 hashes/502 registros. A lease foi exclusiva, uma suíte DB por vez. Após a liberação, ROOTac8071 restaurou o snapshot491:424 tabelas/502 registros,424 hashes e sequências preservados, zero outras atividades. Snapshot SHA256 8d5eaa17a42aa8c2579943a4650c2d56dea33e09d73d29b858a0007041d03f94. Nenhum DB DEV ocorreu depois. Não houve install, generate, DDL, preview ou alteração de perfil/cliente pelo DEV.

Visual N/A: produtorDTO sem novo layout/controle. Sem captura ou pacote visual artificial; as interfaces346/348 terão seu aceite próprio. Fonte congelada para QA ROOT; não publicar343 antes do produtor342 revisado e mergeado.
