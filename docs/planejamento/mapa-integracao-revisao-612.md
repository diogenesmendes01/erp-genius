# Mapa de integração — revisão fixa de gravações (Q611 / preparação 612)

Este mapa é somente leitura do estado atual. Ele não cria a migration 146, não
altera o schema e não declara que uma revisão atual do Drive represente o blob
que foi publicado no passado.

## Publicação da aula

- `src/server/diario/gravacao-aula.ts` recebe apenas `arquivoOficialId`, faz
  prévia fora da transação com `conferirVideoDriveOrganizacional`, chama
  `verificarDisponibilidadeGravacaoDrive` e persiste
  `PublicacaoGravacaoAula` na segunda transação. É o ponto para substituir a
  conferência por uma prévia de revisão fixa: metadata do arquivo, leitura da
  revisão, `keepForever`, confirmação e retorno da identidade já conferida.
- A I/O do Drive deve continuar entre as duas transações curtas. A segunda
  transação já revalida acesso, idempotência, Drive institucional e snapshot
  de conclusão; ela deve receber a identidade fixa pronta e persistir todas as
  colunas juntas. Reenvio idempotente só pode retornar a publicação cuja
  identidade completa confere com a entrada já gravada.
- `src/app/(app)/diario/encontros/[id]/PublicarGravacao.tsx` hoje pede só o
  identificador interno. Não deve pedir `revisionId`, checksum ou token ao
  usuário: a action obtém esses dados do Drive. O DTO de sucesso deve continuar
  limitado ao identificador interno da publicação, sem expor file/revision.
- `src/server/diario/correcao-aula-tx.ts`,
  `src/server/diario/correcao-aula-efetiva-tx.ts` e
  `src/server/diario/gravacao-aula.ts` formam o limite de correção: uma troca
  posterior deve criar outra fonte/publicação aprovada, jamais atualizar a
  revisão persistida da publicação histórica.

## Material de reposição e disponibilização

- `src/server/portal-aluno/entregas-reposicao.ts` contém
  `publicarMaterialReposicaoGravacao`, `fonteDaAulaOriginalTx`,
  `conferirPublicacaoMaterialTx` e a inserção de
  `MaterialReposicaoGravacao` seguida de `DisponibilizacaoEntregaReposicao`.
  É o ponto único de material próprio e de reutilização da gravação da aula.
- Para arquivo próprio, a mesma prévia externa de revisão fixa precisa ocorrer
  entre as duas transações; a inserção deve persistir revisão, MD5, tamanho e
  MIME já confirmados. `verificarDisponibilidadeGravacaoDrive` não basta, pois
  só prova disponibilidade da cabeça naquele instante.
- Para `usarGravacaoAulaOriginal`, `fonteDaAulaOriginalTx` deve retornar a
  identidade inteira da publicação, incluindo revisão fixa. A segunda
  revalidação compara publicação, arquivo, Drive e revisão; o material não
  pode copiar uma revisão diferente do mesmo arquivo.
- A disponibilização não cria outra fonte, mas deve continuar apontando para o
  `materialId` imutável. Relatos, indisponibilidades, retomadas e prorrogações
  em `entregas-reposicao.ts` precisam tratar material legado sem revisão como
  indisponível para reprodução, sem alterar prazo/histórico por inferência.

## Autorização, stream e DTOs de leitura

- `src/server/gravacoes/aula-institucional.ts` autoriza vídeo da equipe por
  publicação da aula; deve devolver internamente `fileId`, `driveId` e revisão
  fixa, e a factory contínua deve comparar também a revisão entre pulls.
- `src/server/gravacoes/autorizacao.ts` autoriza reposição ao aluno. Hoje o
  SQL seleciona arquivo/material e confere publicação ligada apenas por
  arquivo e Drive. A projeção e a conferência posterior devem incluir revisão,
  MD5, tamanho e MIME; qualquer divergência entre material e publicação ligada
  nega acesso.
- `src/server/gravacoes/reproducao-continua.ts`,
  `src/server/gravacoes/stream-autorizado.ts` e
  `src/server/gravacoes/drive.ts` são o caminho de Range. O adaptador Drive
  precisa obter bytes por `revisions.get(fileId, revisionId, alt=media)` e
  validar a metadata da revisão contra os campos persistidos antes de repassar
  bytes. Não usar a cabeça do arquivo, URL pública, ETag ou fallback legado.
- `src/server/portal-aluno/reposicoes.ts`,
  `src/server/portal-aluno/entregas-reposicao.ts` e as páginas em
  `src/app/portal-aluno/reposicoes/[id]` devem projetar somente estados
  operacionais (disponível, regularização, prazo). `fileId`, `revisionId`,
  checksum, token e URL nunca entram no DTO/browser.

## Fixtures, testes e transição

- `src/server/gravacoes/drive.test.ts`, `stream-autorizado.test.ts`,
  `reproducao-continua.test.ts`, `autorizacao.int.test.ts` e
  `src/server/diario/regularizacao-designacao.int.test.ts` são os pontos para
  testes de revisão fixa da aula, Range e autorização.
- `src/server/portal-aluno/entregas-reposicao.int.test.ts`,
  `reposicoes-conclusao.int.test.ts`, `relatos-indisponibilidade.int.test.ts`
  e `guardrails-entrega-190.int.test.ts` inserem material diretamente por SQL;
  suas fixtures precisam declarar explicitamente legado ou identidade de
  revisão válida depois da migration. Elas não devem preencher `headRevisionId`
  atual como se fosse histórico.
- Acrescentar cenários: dois Ranges na revisão `rev-1` após a cabeça virar
  `rev-2`; falha/incerteza de `keepForever`; metadata fixa divergente;
  material derivado com arquivo/revisão/publicação cruzados; legado sem revisão
  sem fallback; token/URL/revision não expostos.

## Proposta para migration 146 (não criada)

1. Adicionar a `PublicacaoGravacaoAula` colunas nullable de transição:
   `driveRevisionId`, `driveRevisionMd5`, `driveRevisionSize BIGINT` e manter
   `mimeType` como MIME conferido da revisão. Adicionar a
   `MaterialReposicaoGravacao` as mesmas quatro identidades, incluindo
   `mimeType` próprio.
2. Não fazer `UPDATE` de legado usando metadata do Drive atual. Linhas sem
   revisão representam fonte histórica não regularizada e não podem autorizar
   nova reprodução.
3. Proteger novas inserções por trigger/constraint de aplicação: publicação
   nova exige todos os campos de revisão não vazios, tamanho não negativo e
   MIME de vídeo; material próprio também. Material com `publicacaoAulaId`
   exige igualdade exata de arquivo, revisão, MD5, tamanho, MIME e Drive com a
   publicação apontada. Não permitir `UPDATE` desses campos depois da criação.
4. Manter FKs com `RESTRICT`/`NO ACTION` conforme schema atual e usar nomes de
   constraints, índices e triggers mapeados explicitamente no Prisma para não
   causar drift. A migration deve distinguir legado de publicação nova por um
   marcador persistido ou trigger que só aceite campos nulos em linhas já
   existentes no momento da migração; uma coluna nullable sozinha não pode
   conceder fallback à cabeça.

## Invariantes de segurança

- A identidade binária autorizada é `(driveId, fileId, revisionId, md5, size,
  mime)`, não apenas `fileId`.
- `keepForever` e a releitura da revisão terminam antes da transação de escrita;
  erro, timeout, resposta incerta ou mismatch não publica.
- Cada pull/Ranged request revalida autorização e a identidade da fonte; mudar
  qualquer campo encerra o stream em vez de trocar conteúdo.
- Revisão histórica permanece imutável; correção cria fonte nova aprovada.
- Legado sem revisão é regularização/indisponibilidade, nunca revisão atual
  inferida. Nenhum segredo, link público ou identificador de revisão atravessa
  API/DTO ao navegador.
