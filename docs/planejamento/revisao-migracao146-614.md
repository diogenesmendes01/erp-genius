# Revisão 614 — rascunho da migration 146 (revisão Drive)

Escopo: leitura de `docs/planejamento/rascunho-146-revisao-drive.sql`, do schema e
das migrations 211–215. Nenhum SQL foi aplicado e este documento não altera schema,
runtime ou o rascunho.

## Conclusão

O rascunho acerta ao adicionar campos nullable, não preencher legado pela cabeça
atual do Drive e exigir a identidade completa em inserções futuras. Porém, ele
torna impossível regularizar uma fonte que já existe: a publicação e o material
históricos não podem ser alterados, ao mesmo tempo que suas chaves únicas impedem
uma nova fonte no mesmo encontro ou reposição. A migration precisa preservar a
linha original e introduzir uma cadeia imutável de fontes substitutas aprovada
explicitamente; remover as chaves únicas ou atualizar a linha existente destruiria
a referência histórica.

## Falhas e correções mínimas

### 1. A regularização da publicação é inalcançável

`PublicacaoGravacaoAula.encontroId` é único
(`20260915045000_publicacao_gravacao_aula/migration.sql`) e
`validar_publicacao_gravacao_aula_211` rejeita toda atualização e exclusão. O
rascunho 146 só permite inserir outra publicação com identidade completa. Logo,
uma publicação legada, ou uma publicação cuja revisão ficou indisponível, não pode
receber fonte regularizada: inserir conflita com a chave e atualizar é recusado.

A mensagem atual de `registrarGravacaoAula` confirma o bloqueio: “A
substituição exige o fluxo de correção”, mas o fluxo de correção vigente também
preserva `snapshot.*.gravacao` e não cria uma fonte nova
(`validar_proposta_correcao_aula`, migrations 212–214).

**Correção mínima proposta:** manter `PublicacaoGravacaoAula` como o registro
original único do encontro e criar uma tabela append-only de fontes, por exemplo
`FonteRevisaoPublicacaoGravacaoAula`, com:

- FK `publicacaoAulaId` para a publicação original, `versao` sequencial e
  `@@unique([publicacaoAulaId, versao])`;
- a identidade completa `(arquivoOficialId, driveOrganizacaoId,
  driveRevisionId, driveRevisionMd5, driveRevisionSize, mimeType)`;
- `substituiFonteId` nullable, FK para a fonte anterior, e vínculo obrigatório
  à decisão de regularização que autorizou a nova fonte;
- autor, motivo, hash/snapshot da entrada e data, todos imutáveis.

A publicação original conserva sua fonte inicial (inclusive os campos NULL de
legado). O resolvedor de reprodução passa a escolher a última fonte **aprovada**
da cadeia; se não houver uma fonte fixa válida, devolve regularização, sem usar a
cabeça do Drive. A inserção da cadeia deve travar a publicação e verificar a
próxima versão. Não remover a unique de `encontroId`.

A aprovação não pode reutilizar automaticamente `AprovacaoCorrecaoAula`: o
guard vigente exige que a gravação do snapshot permaneça igual. A solução mínima
é uma proposta/decisão própria de regularização da fonte, com aprovação
independente, ou ampliar esse fluxo em migration e runtime posteriores com uma
decisão explícita que carregue a identidade anterior e a candidata. Apenas criar
a tabela sem esse vínculo permitiria trocar o conteúdo sem a correção aprovada.

### 2. A regularização do material de reposição é inalcançável

`MaterialReposicaoGravacao.reposicaoId` é único
(`20260915009000_entrega_reposicao_portal/migration.sql`). O novo trigger 613
também proíbe completar, trocar ou apagar qualquer campo de fonte depois do
insert. O serviço já recusa uma segunda publicação para a mesma reposição em
`conferirPublicacaoMaterialTx`. Assim, material legado ou uma fonte que precisa
ser substituída fica permanentemente indisponível, sem rota de recuperação.

**Correção mínima proposta:** manter `MaterialReposicaoGravacao` como o
material/publicação original e criar uma cadeia append-only análoga, por exemplo
`FonteRevisaoMaterialReposicao`, com versão por `materialId`, identidade
completa, fonte anterior e decisão de regularização. A disponibilização, relatos,
indisponibilidades, prorrogações e entregas continuam ligados ao
`materialId` original; somente a resolução de bytes consulta a última fonte
aprovada. Isso preserva todos os prazos e relatos já gravados. Não remover a
unique de `reposicaoId` e não criar outro `DisponibilizacaoEntregaReposicao`.

Para material derivado da aula, a trigger da nova fonte deve exigir igualdade
integral com a **fonte aprovada efetiva** da publicação vinculada, não apenas com
as colunas da publicação original. Para material próprio, a decisão precisa
prender a fonte anterior esperada, evitando que uma aprovação atrasada substitua
uma cadeia já avançada.

### 3. O vínculo material–publicação quebra para legado e para substituição

`validar_revisao_material_reposicao_gravacao_613` compara o material derivado
às colunas da própria `PublicacaoGravacaoAula`. Para publicação legada, essas
colunas ficam NULL por desenho, mas o trigger exige que o novo material tenha
todos os campos preenchidos; a regularização aprovada de uma publicação legada
nunca pode ser reutilizada. Depois de criada a cadeia proposta acima, a comparação
deve ser contra a fonte efetiva aprovada, sob `FOR SHARE`, e comparar os seis
campos. A migration não deve preencher o legado para contornar a comparação.

A trigger 215 hoje compara apenas encontro, arquivo e provedor. Na migração
definitiva, essa checagem deve continuar e ser complementada pela identidade
inteira da fonte, sem trocar a referência `publicacaoAulaId` histórica.

### 4. Integridade de IDs no material ainda é incompleta

O rascunho valida `driveOrganizacaoId` e `driveRevisionId` em
`MaterialReposicaoGravacao`, mas não aplica a mesma regra de ID ao
`arquivoOficialId` já existente. O schema atual de material também não tem esse
check; a validação HTTP aceita mínimo de três caracteres mas não o alfabeto do
adapter. Uma escrita SQL pode persistir um file ID inválido e ainda satisfazer o
novo conjunto de revisão.

**Correção mínima proposta:** adicionar
`MaterialReposicaoGravacao_arquivoOficialId_formato_check` com o mesmo contrato
das publicações: comprimento 3–500 e `^[A-Za-z0-9_-]+$`. As novas tabelas de
fonte devem usar exatamente as mesmas constraints para file, Drive e revisão,
MD5, tamanho positivo e MIME de vídeo. A validação deve ser case-insensitive
para MD5/MIME como no rascunho; a normalização na aplicação continua
complementar, nunca substituta do check.

### 5. Compatibilidade de escrita precisa ser transição coordenada

As colunas nullable não quebram linhas existentes, e os triggers propostos só
disparam para DML posterior. Isso preserva corretamente legado. Em contrapartida,
os caminhos atuais não preenchem as novas colunas:

- `src/server/diario/gravacao-aula.ts` cria
  `PublicacaoGravacaoAula` sem revisão, MD5 e tamanho;
- `src/server/portal-aluno/entregas-reposicao.ts` insere
  `MaterialReposicaoGravacao` por SQL sem Drive, revisão, MD5, tamanho e MIME;
- fixtures SQL listadas ao final do rascunho também falharão se representarem
  novas publicações.

A migration real só deve entrar junto da alteração desses caminhos e de fixtures
que declarem fonte fixa válida. Fixtures que representam legado devem manter
todos os campos de revisão NULL e testar que não há fallback à cabeça atual.
Não há backfill seguro.

### 6. Schema Prisma e nomes estáveis

O rascunho DDL não vem acompanhado dos campos no
`prisma/schema.prisma`; a migration final precisa refletir as colunas nullable
de transição e as novas relações/tabelas com `onDelete: Restrict` e
`onUpdate: NoAction`, iguais às relações existentes. Uniques e índices devem
receber `map:` com os nomes SQL usados na migration. Checks e triggers são SQL
manual, mas seus nomes devem permanecer explícitos e estáveis. Nenhuma FK deve
usar cascata para apagar uma fonte, publicação ou material histórico.

## Invariantes para a implementação posterior

1. A identidade autorizada continua sendo os seis campos completos; file ID,
   Drive ou MD5 isolados não identificam o blob.
2. Legado sem identidade fixa só pode ficar indisponível/aguardando
   regularização; nunca adota metadata atual do Drive.
3. A linha original de publicação/material, seus relatos, prazos e eventos não
   são atualizados nem excluídos para regularizar conteúdo.
4. Uma nova fonte só existe após decisão explícita, com âncora na fonte anterior
   esperada e versão serializada.
5. Material derivado reutiliza exatamente a fonte aprovada efetiva da aula.
6. Reprodução escolhe uma fonte fixa aprovada e nunca a cabeça atual.

## Validação necessária quando houver implementação

- publicação e material legados continuam legíveis como histórico, mas são
  recusados para reprodução;
- regularização aprovada cria nova fonte sem alterar a publicação/material
  original e passa a autorizar a revisão fixa;
- tentativa sem aprovação, com fonte anterior stale ou com identidade parcial
  falha;
- uma segunda regularização preserva ambas as fontes anteriores e seleciona só a
  última aprovada;
- material derivado não aceita mesmo arquivo com revisão, MD5, tamanho, MIME ou
  Drive diferentes da fonte efetiva da aula;
- constraints de unique originais continuam presentes, e não há segunda
  publicação por encontro nem segundo material/disponibilização por reposição.
 
