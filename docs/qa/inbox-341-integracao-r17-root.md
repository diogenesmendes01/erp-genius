# Previsão e probabilidade — integração ROOT

Base `db36023a`, candidata A `580bc46c` (runtime/testes/schema originais `997acd53`). O merge alterou somente os27 SRC previstos, os dois arquivos Prisma495 e a documentação; o único conflito foi o quadro, resolvido preservando todas as linhas históricas. Prova22e4c7: todos os27 SRC inicialmente literaisA, schema/configs conferidos e demais fontes preservadas. Depois foi corrigida somente a fixture unitária de papéis descrita abaixo; o runtime continua literalA.

O DEV executou quatro arquivos nativos completos/19 casos em997, todos EXIT0: contratos10 (53901/6f3465), concorrência5 (56078/bc82e3), pool1um (96017/98cf3d) e NOTIFYtrês (24436/fe3abd). Há provas reais de NOWAIT contra atribuirDono, ator/carteira após esperas e commit1/no-op0/rollback0. Não atribuir essas execuções ao merge ROOT; QA independente SQL nesta composição ainda será executada após preparar TESTER495. Parecer RO independente da candidata favorável, com limites registrados.

## Correção da fixture de autorização

O `it.each` antigo expandia as linhas `[['ALUNO'],['PROFESSOR']]`; o callback recebia strings, e `toThrow()` aceitava um TypeError de `papeis.every`, sem provar a permissão. Primeiro a expectativa passou a exigir ErroPermissao: RED1eadab terminou com duas falhas específicas e15 controles verdes, arquivo completo17casos, sem filtro. A tabela passou a objetos contendo arrays de papéis; mantidas as expectativas de zero update/Evento/aviso. GREENd5aac9:17/17, EXIT0. Nenhuma mudança no setter foi necessária. Os nativos do DEV já usavam papéis reais e mantêm sua evidência própria.

Recorte integrado completo98dd3b:12 arquivos/200 casos, EXIT0, UTC/w1/heap1024, sem filtros ou skips. Inclui os dez arquivos do recorte DEV, o wrapper e a edição no funil. Fonte de trabalho conferida antes/depois pelo hash do diff. ESLint dos27 SRC alterados:49797/ffb938, EXIT0, sem saída. Esse recorte não é suíte global.

## Infraestrutura ROOT495

Schema validado4cbe11 e client gerado48365/8d3c71, EXIT0; client próprio `e251ba321793510fa473b2778f6d4ffd9f0ef2d9e0f60f0c3fb1f15bd5861a9b`, igual ao modelo da candidataA. O client anterior ficou em arquivo físico fora do workspace. Hash bruto ROOTschema `d13138e69c1ab93897e6a2ae22608b34a2f56b275671d65e7845c037e7d6a603`; SQL `f60fe8c80b161e532eb47e0ac8f0f93ae38a1cfe879ae49de68c190ba230a8d9`. Os blobs Git são iguais aos da candidata; hashes brutos diferem entre perfis por finais de linha, sem reescrever migração aplicada.

Auditoria493 anterior1b0758 EXIT0:425 hashes/1380 originais. DDL4915fe EXIT0 aplicou somente a reserva lógica495 no dev-gravacoes: contagem real494 migrações,425 tabelas,424 tabelas de dados antigas preservadas e Lead projetado sem as novas colunas; campos novos NULL, sem default/backfill/índice, histórico493/funções/gatilhos preservados. Novo snapshot38b6de EXIT0:425 hashes/1381 linhas; SHAf54f80f1860f6b0f372496abf3b3672ce9f84f7c027a7b135e97359b977fdc61. Usar somente o restaurador ROOT495; nunca restaurador493 neste banco agora.

Nenhum teste com gravação foi liberado no ROOT após este snapshot. TSC/regressão global/lint global/build da composição nova, QA SQL independente e aceite visual continuam pendentes. Não houve provedor real, deploy, merge em main ou homologação presumida.
