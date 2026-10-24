# PR416 C1 — revisão independente estática do calendário

**Favorável ao ajuste de fixture no commit exato `b2df832187fea15d2c970888b03e6c9fbf12ea9f`, pai55add8ce.** Nenhum bloqueio técnico identificado nesse delta. Checkout96c9e607/client487/perfilintegracao mantidos; nenhum checkout490, INT/TSC do commit, Prisma, SQL/banco, browser/UI/nota ou edição de produto pelo TESTER.

2c533e confirmou cinco paths: um arquivo INT e quatro MD. O único deltaTS importa diaUtilAs de@/test/janela-envio e troca Date.now()+86_400_000 por diaUtilAs(10).toISOString() no cenário de cancelamento repetido. Não muda mocks, helper, relógio, validação produtiva, ACL, schema/SQL ou asserts. 2f2fc5 EXIT0 provou que remover o import novo e reverter essa linha recupera byte a byte o arquivo do pai. O agendamento real e os dois cancelamentos/umEvento permanecem exigidos.

Arquivo alterado: src/server/whatsapp/atendimento-idempotencia.int.test.ts, blob `d1c3775a1315bf4eceaa954a7c4636d74b10b7e1`, SHA256GitLF `f3241917f52b2dc322f0ae4feff3e64ff8308cf544c76b237da1657e8da19a38`.

## Caracterização pura, não integração

Os blobs do meu checkout são idênticos ao commitC1: src/test/janela-envio.ts `2e2ec52768e995955429f511d88841dc9a88e0d2`; src/server/operacao/fuso.ts `9cfe96e1858651920edb0000c6cf955890249723`. O helper busca a partir de amanhã o primeiro dia de segunda a sexta no fuso informado e retorna a hora especificada.

2f2fc5 EXIT0 executou somente esses helpers locais transpilados em memória, com imports limitados aZod/fuso, datas explícitas e sem infraestrutura/Prisma. Resultados:

| Entrada explícita | Resultado |
| --- | --- |
| sexta23/10/2026,12hSP | segunda26/10,10hSP =13:00Z |
| sábado24/10,12hSP | segunda26/10,10hSP =13:00Z |
| domingo25/10,12hSP | segunda26/10,10hSP =13:00Z |
| sexta23/10,23h59m59SP | segunda26/10,10hSP =13:00Z |
| segunda26/10,12hSP | terça27/10,10hSP =13:00Z |

Todos os resultados eram futuros, dia útil e hora10 no fusoAmerica/Sao_Paulo. Também foi confirmado que24/10/2026+1dia resulta emdomingo25/10. São cinco caracterizações puras do helper existente, não cinco casosINT do commit e não prova de regras de feriados ou janelas customizadas.

## Evidências e limites

Falha remota original do shard1 e reprodução ROOT2076/2cdece (11casos,10pass/1falha) continuam negativas nominais ao head anterior. GREEN ROOT37237/85094b (três arquivos completos/27casos,103,50s), TSC18981/2a66230,lintf93642 e restauro1aa89a/424hashes são provas do ROOT, não execuções minhas. Não são27testes novos.

Diff-check do commit0, helper/produção/asserts intactos e meu tracked limpo. Esta revisão não reclassifica a primeira execuçãoC1 nem os shards do head antigo como verdes no head corrigido. Push, CI rápida e nova Integração no novoSHA continuam sobROOT. Não é necessário alegar nova integração independente para essa revisão de fixture.
