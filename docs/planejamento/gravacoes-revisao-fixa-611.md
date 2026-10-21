# Q611 — revisão fixa de gravações no Google Drive

## Problema

A fonte publicada hoje guarda `arquivoOficialId` e o Drive institucional, mas
não a revisão binária do arquivo. O adaptador
[`src/server/gravacoes/drive.ts`](../../src/server/gravacoes/drive.ts) consulta
metadados e baixa `files/{fileId}?alt=media` a cada reprodução. Se o conteúdo
do mesmo `fileId` for substituído entre duas requisições `Range`, o player pode
receber trechos de revisões diferentes.

A validação atual de MIME, Drive, download e `Content-Range` continua
necessária, mas não identifica uma versão imutável. `entradaHash` e o snapshot
da publicação também não são uma prova da revisão do blob no Drive.

## Recurso suportado pelo Drive

Para arquivos binários, como vídeo, Drive expõe `headRevisionId` no recurso de
arquivo e permite obter uma revisão por `revisions.get`. A revisão binária pode
ser baixada com `alt=media`; o guia oficial afirma que esse endpoint também
aceita o cabeçalho `Range`.

Uma revisão que não é a cabeça só pode ser baixada se estiver marcada como
`keepForever=true`. Revisões não preservadas podem ser eliminadas após conteúdo
mais novo e há no máximo 200 revisões `keepForever` por arquivo.

Fontes oficiais:

- [Download and export files](https://developers.google.com/workspace/drive/api/guides/manage-downloads): download de revisão binária com `revisions.get`, `alt=media` e `Range`; exige `keepForever`.
- [Manage file revisions](https://developers.google.com/workspace/drive/api/guides/manage-revisions): retenção, limite de 200 revisões e `revisions.get`/`revisions.update`.
- [Changes and revisions overview](https://developers.google.com/workspace/drive/api/guides/change-overview): `headRevisionId` para blobs e caráter descartável das revisões antigas.
- [revisions.get](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/get): rota `GET /drive/v3/files/{fileId}/revisions/{revisionId}`.

Não usar `ETag` ou `If-Match` como mecanismo de fixação: as referências acima
documentam `alt=media` e `Range`, mas não fornecem uma garantia de leitura
versionada por cabeçalho condicional. Um checksum detecta divergência apenas
após obter o conteúdo completo e não impede mistura de trechos.

## Desenho para a implementação futura

1. Na prévia de publicação, buscar a metadata do blob incluindo
   `headRevisionId`, MIME, Drive e capacidade de download.
2. Fora de transação longa do ERP, obter a metadata da revisão candidata,
   solicitar `revisions.update(..., { keepForever: true })` e reler/confirmar
   que a mesma revisão continua acessível, pertence ao mesmo arquivo e está
   marcada como permanente. Capturar `revisionId`, `md5Checksum`, `size` e MIME.
3. Se a atualização, confirmação ou resposta do Drive for incerta, falhar ou
   divergente, **não publicar**. A tentativa não pode ser convertida em
   publicação com a revisão da cabeça por inferência.
4. Na transação curta de gravação, revalidar a fonte aprovada e persistir a
   identidade completa da revisão já confirmada. Não fazer o I/O de Drive nem
   aguardar upload/download dentro dessa transação.
5. Na reprodução, resolver a fonte exclusivamente no servidor, depois chamar
   `revisions.get(fileId, revisionId, alt=media)` com o token institucional e
   encaminhar somente os cabeçalhos/bytes permitidos. O navegador não recebe
   token, `fileId`, `revisionId` nem link público.

A política operacional recomendada é não sobrescrever um arquivo já publicado:
uma nova gravação recebe novo `fileId`. A revisão fixa ainda deve ser guardada,
pois é a proteção API para versões no mesmo arquivo e para auditoria. A equipe
precisa acompanhar o limite de 200 revisões permanentes antes de adotar
sobrescritas recorrentes.

## Requisitos da futura migration 146

Esta seção descreve requisitos; a migration 146 não é criada por este registro.

- `PublicacaoGravacaoAula` precisa guardar, além de `arquivoOficialId` e
  `driveOrganizacaoId`, a revisão fixa (`driveRevisionId`) e a identidade
  conferida da revisão (`driveRevisionMd5`, `driveRevisionSize`, MIME).
- `MaterialReposicaoGravacao` publicado com arquivo próprio precisa de sua
  própria revisão fixa e metadata correspondente. Um material vinculado à
  publicação da aula deve conferir `fileId`, Drive **e revisão** contra a
  publicação, sem copiar uma revisão diferente.
- As colunas devem ser obrigatórias apenas para novas publicações depois da
  transição. Registros legados sem revisão permanecem em estado de
  regularização/indisponível para nova reprodução; não inferir que a revisão
  atual é a originalmente publicada.
- A migração não deve preencher revisão a partir de `headRevisionId` atual,
  checksum atual ou data da publicação. Isso falsificaria o histórico se o
  mesmo `fileId` já tiver sido substituído.
- O fluxo de correção/publicação posterior cria fonte nova com revisão nova;
  não atualiza a identidade histórica do material ou publicação anterior.

## Testes necessários

- Publicar `rev-1`, substituir o mesmo `fileId` por `rev-2` e confirmar que a
  reprodução ainda chama a rota de revisão `rev-1`, inclusive em dois ranges
  consecutivos. Nenhum byte pode vir da cabeça `rev-2`.
- Confirmar `Range` normal, aberto e sufixo sobre uma revisão fixa, mantendo a
  validação de `206`, `Content-Range` e tamanho já existente.
- Recusar publicação quando `keepForever` falhar, quando a releitura retornar
  outra revisão, quando a revisão não estiver permanente ou quando a resposta
  for incerta/expirar.
- Recusar reprodução se `fileId`, Drive, revisão, MD5, tamanho ou MIME da fonte
  persistida divergirem da revisão consultada.
- Para material derivado de aula, recusar `source mismatch`: mesmo arquivo com
  revisão diferente, revisão correta em outro arquivo, ou publicação da aula
  diferente da indicada pelo material.
- Confirmar que legado sem revisão não cai para a cabeça atual e oferece apenas
  o fluxo de regularização autorizado.
- Manter os testes de autorização, token não exposto, ausência de URL pública,
  redirecionamento recusado e falha segura do adaptador.
