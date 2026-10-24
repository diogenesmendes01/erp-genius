# Inbox #342 — EstadoAria no servidor

Entrega DEV sobre origin/main cf29add93cd63fe14f95bf8a53fb079d3efe9a27, ramo codex/inbox-e3-342-produtor. Novo produtor puro e condições Prisma equivalentes; contexto e consultas em lote usam o Db recebido. A única alteração compartilhada é o argumento opcional de transação em estadoOrcamento. Consumidores, permissões, envio, schema Prisma, dependências e harness permanecem intactos. [SPEC](../docs/specs/inbox-estado-aria.md). QA independente, composição, CI e publicação estão pendentes com ROOT; a issue não está concluída.

## Contratos

Prioridade: grupo/encerrado→null; handoff pendente; pausa→humano; sugestão vigente→aprovacao; global+guardas do turno→ia; responsável→humano; restante→null. A função reutiliza motivoParaNaoAtuar e o filtro precisa ser combinado com ACL pelos consumidores futuros. Sem resposta/não atribuída continuam marcações sobrepostas. Nenhuma alçada D1–D3 é antecipada nesta issue.

Handoff exige pausa HANDOFF não nula e ausência de SAIDA HUMANO/CELULAR ou Evento AtendimentoAssumido posterior do mesmo alvo/agregado. Igualdade de instante não encerra a pendência. Sugestões usam DISTINCT ON/criadoEm DESC/id DESC com vigência estrita. IDs[] não consultam; undefined significa universo; lote205 é completo e parametrizado, sem N+1/cap. O contexto fixa agora, passa Db a situação/orçamento/handoff e funciona em tx real/pool1 com rollback. O upsert legado de ConfigIA é preservado e pode inicializar configuração ausente.

A migração reservada prisma/migrations/20261024213000_inbox_aria_indice_handoff/migration.sql tem262 bytes/SHA256 dc3a00d7a1832309613d1d80ff27a278960b1bb3b695187dd0cf9c4fcbdce319, um único CREATE INDEX CONCURRENTLY fora de transação. ROOT9131f5 aplicou apenas esse SQL e conferiu indisvalid/ready e definição; DEV não aplicou DDL. Histórico491, cliente próprio490 SHA256647c2586589198b10c9345265e0cce7a43819d5cb44633dbad5e0e0b611fae2b: índice não muda o modelo. ROOT448796 conferiu preparação; backup9b5f9a preservou424 tabelas/502 linhas (491 migrations e11 registros originais). Perfil ci-integracao/ciint, localhost54329, sem preview ou provedores.

## TDD e achado temporal

RED1432f4 terminou1: módulo estado-aria ausente (suite sem casos coletados) e teste Db do orçamento falha no client global; controle legado semDb passou. GREEN57440f: três arquivos unitários completos/27 testes, saída0.

INT inicial53533/5cd945 terminou1:22/26 passaram; três falhas revelaram vigência incorreta na query raw e uma era fixture de grupo proibida pelo trigger. RED causal45033c confirmou que Date bound é timestamp with time zone, enquanto expiraEm é timestamp without time zone: igualdade era falsa emUTC e verdadeira emAmerica/Sao_Paulo. A fronteira agora usa ISO UTC parametrizado com cast timestamp(3), sem alterar TZ global ou guarda. GREEN69d2cc validou T−1/T/T+1 emUTC/SãoPaulo/Tokyo; uma prova filtrada,17 testes ignorados pelo filtro, não suíte completa.

A segunda execução integral93144/0a2e82 terminou1,27/28: a única falha era outra fixture inválida, atendimento financeiro sem matrícula. Grupo virou negativo explícito da invariante existente; a fixture financeira passou a criar catálogo/aluno/matrícula válidos, sem contornar triggers. Não houve mudança de produto após o global; somente o arquivo INT, excluído da configuração unitária, recebeu essa correção. Os negativos e logs permanecem privados, sem reclassificação.

## Gates nominais finais

| Gate | Fonte/escopo e resultado |
| --- | --- |
| UNIT global52501/3ffd9f | 937 arquivos/7425 testes;271,84s;dois workers;EXIT0. Sem filtro de nome ou skips impostos. Configuração original exclui *.int.test.ts. |
| INT34211879/a17723 | estado-aria.int.test.ts completo:18/18;70,48s;um worker;EXIT0,sem filtro/skips. |
| INT legado orçamento | uso.int.test.ts completo:10/10 EXIT0 nas duas execuções53533 e93144. Arquivo e produto de orçamento permaneceram idênticos depois. Dois arquivos distintos/28 casos verdes em execuções nominais separadas; não um comando final28. |
| TSC auxiliar62768/43cf58 | --noEmit --incremental false,heap8192;EXIT0,com todoSRC/testes342 incluído. |
| Lint353527 | Cinco arquivos SRC/testes alterados/novos;--max-warnings=0;EXIT0. |

A integração cobre prioridade e paridade filtro/derivação, global/versão/orçamento, expiração e milissegundos em três fusos, handoff por humano/celular/Assumir, rejeição do grupo, empate de sugestões, lote205/SQL como parâmetro, Db/tx real com pool1 e índice parcial. Não houve envio externo: mensagens são registros fictícios de teste com MOTOR. Aceite visual N/A: produtor interno, sem interface nova.

## TSC original e exclusões auxiliares

O TSC original27111/d08ff2 terminou1 porque dois arquivos privados históricos326 importam GavetaContato, ausente legitimamente nesta base:

- output/inbox-326-a2-diagnostico-private.test.ts
- output/inbox-326-package-r8-7a30d4-preservado-private/inbox-326-a2-diagnostico-private.test.ts

ROOT aprovou tsconfig.inbox-342-aux-private.json, não versionado, extends original, mantendo todos os includes/excludes originais e excluindo SOMENTE esses dois paths. Prova29bc68 pelo parser TypeScript:3025 arquivos originais→3023 auxiliares, exatamente os dois removidos/zero adicionados; SRC342 e INT incluídos. O primeiro TSCaux44366/7f0610 ainda detectou quatro erros de nomes/tipos da fixture nova, corrigidos (OrigemEnvio, VENDAS e Prisma como valor). TSCaux84395/f2c8f7 e final62768/43cf58 terminaram0. Não se anuncia que o TSC original ficou verde. ROOT verificará checkout limpo na integração/publicação. Nenhum original privado ou tsconfig público foi alterado.

## Estado da entrega

Banco liberado ao ROOT após a última integração; restauro do snapshot491 é responsabilidade do integrador, sem usar helper487 e sem nova consulta DEV. Não houve instalação, generate, mudança de perfil/cliente, DDL pelo DEV, preview, consumidor E3 ou edição de outro checkout. Fonte do produtor SHA256 físico b193fb0a5aef0c9b282ef0dd1947863d4b4b1514eae41c4eeb2c70f9555e2bd1; SQL e fontes serão reconferidos no commit exato para QA. D1 usa responsável da CONVERSA e D3 cancela pendentes nas issues futuras; os textos históricos divergentes354/357 não alteram este produtor. Próxima343 permanece somente em planejamento até revisão do produtor e novo GO ROOT.
