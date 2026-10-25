# Revisão estática independente — PR429 / #345

HEAD exato11f913f2f59780c83fa9aa45a77ecfd7f358da39, runtime2cd984b773e576886e878642650e17a25e04c3a5, Mainfabf7addf291de6e4b821927cfc1c88ce93bd9fb. Parecer favorável à publicação documental:15 objetos executáveis permanecem literais à fonte já examinada e o pacote público conserva os artefatos originais. Nenhum gate novo ou merge é presumido.

Revisão por objetos Git/FS do worktree TESTER, sem trocar HEADf948 nem alterar privados/cliente/perfil492. Sem UNIT/TSC/DB/HTTP/browser/captura. O gate próprio51a458 EXIT0 usa trees/cat-file em lote e compara arquivos publicados com os originais privados, não apenas nomes ou relatos.

## Fonte e escopo

Contra runtime2cd, o diff contém somente seis documentos:quadro e cinco objetos em output/inbox-345-qa. SPEC e report DEV continuam literalmente2cd. Contra Main são23paths:15 fontes/migration e oito documentos. composicao.json declara pathsFonte18 para a entrega original2cd (15 executáveis+trêsdocs), não o número total da publicação23.

Os15 OIDs/modos listados em composicao.json conferem integralmente com runtime2cd:14 paths SRC/testes e a migration reservada20261025020000_inbox_aria_tempo_real. Outros3.566 objetos Main no escopo src/scripts/prisma/.github/package/lock permanecem iguais. Não há alteração extra de schema/deps/workflows/scripts, ACL, query ou produtor causada por esta publicação. A migration nova em relação a Main é a mesma já testada2cd, GitLF1.466/b7c9f6 e físicoWindows1.505/9ad86e; não é um DDL adicional da etapa documental.

O quadro HEAD preserva por inteiro o Main GitLF1.147.341bytes e o quadro fonte2cd1.149.806bytes. Acrescenta somente851bytes de adendo ROOT, total1.150.657. Todo o bloco DEV345, seus negativos e restauroB continuam antes desse adendo; o novo texto distingue TESTER492 e seu restauro5f99cc. Não há corte/reescrita do histórico nem dependência artificial da #344.

## Cinco objetos QA e artefatos literais

São cinco objetos públicos, não cinco pareceres independentes:README.md, codigo-2cd.md, resultados-2cd.json, composicao.json e indice.json. Os dois artefatos publicados são BYTEIGUAIS aos meus originais e concordam simultaneamente com índice/composição:

- codigo-2cd.md:9.909bytes/SHA25672fa9a5d858034b6c650c4ba2a72a06c2cf33b402e78d643963cddcd8dd71e39.
- resultados-2cd.json:1.993bytes/SHA25699723155c43aa736dfbaa7aa8c7a0c763bea545a8b35f5b14fc12db6a49066a5.

Os links Markdown relativos do pacote resolvem dentro do mesmo HEAD. README explica a fonte e as duas execuções de integração separadas; índice fixa bytes/hash. O JSON contém metadados/hashes de logs privados, não os logs, snapshot ou credenciais. Não há PNG/ZIP/raw ou executor privado novo no pacote.

## Atribuição e limites

As provas continuam NOMINAIS2cd:UNIT14/354 (95270/c75407),lint14 (59992/c1a114),barramento completo1/26 (46336/b24a65) e cincoINT completos5/48 (90341/f06ed8),todos0. Não somo14+1+5 ou354+26+48 como suíte global, não chamo a revisão de docs de nova execução e não reatribuo essas integrações a um full da publicação.

RestauroROOT5f99cc EXIT0 após minha liberação:424hashes/1.393registros/snapshot/trêsfunções615triggers preservados. Isso concorda com meu relatório/JSON originais; não foi novo restauro executado por mim nesta tarefa. Banco continua sem lease TESTER ativa.

TypeScript DEV é AUXILIAR qualificado, com somente duas exclusões privadas históricas. README/composição não o tratam como original ou global. CI=PENDENTE, e original/global/lint integral/build/fusos/integração remotos ainda exigem seus terminais no CI limpo. Não consultei rede ou assumi resultado de run. Quadro mantém rascunho/Refs345, sem encerramento/homologação.

Prova própria: output/inbox-345-publicacao-11f-identidades-tester.json,7226bytes/SHA256e6678f191f51cec4c6ec5328a6d212cd04ec3359329c994f9318da2fd66a9a86. Inclui15OIDs,seisdocscontra2cd,23pathscontraMain,comparação literal dos dois artefatos e a cauda completa do quadro. Recomendação: aceitar a fidelidade da publicação mantendo os gates CI/composição e merge separados. Nenhum teste repetido por estes documentos.