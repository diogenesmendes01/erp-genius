# QA independente #344 — marco 1, tradutor fechado

Parecer favorável ao marco 1 no commit exato c9e710e35a56c9b64366c31b5d292f9b5ae8a516. O recorte próprio terminou sem falha de produto ou divergência de paridade nas formas aceitas verificadas. Isso não conclui #344: agregado único das sete contagens, filtro antes da paginação, preferências e consumidores dos marcos 2/3 não foram implementados nem aprovados por este parecer.

## Ambiente e gates próprios

Worktree exclusivo inbox-tester, branch codex/inbox-e3-344-marco1-qa, perfil tester e banco descartável TESTER491. READY ROOT c944a6 confirmou snapshot f1d15dff, 424 hashes/1.392 registros e lease exclusiva. Préflight 7c3a2f/9e4bd7 confirmou HEAD/perfil e arquivos versionados limpos; os privados anteriores foram preservados. Cliente físico próprio 490: SHA256 647c2586589198b10c9345265e0cce7a43819d5cb44633dbad5e0e0b611fae2b. Não instalei, gerei cliente, executei DDL, alterei schema/perfil/cluster ou operacionei browser/HTTP de produto.

Node22 local: C:/Users/Mendes/AppData/Local/hermes/node/node.exe. Comandos no próprio worktree:

```text
node node_modules/vitest/vitest.mjs run src/server/inbox/where-sql.test.ts src/server/whatsapp/escopo-atendimentos.test.ts src/server/whatsapp/escopo-setor.test.ts src/server/whatsapp/escopo.test.ts src/server/whatsapp/busca-inbox.test.ts src/server/crm/escopo-comercial-sql.test.ts src/server/inbox/filtros.test.ts src/server/inbox/permissoes.test.ts --maxWorkers=2
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts src/server/inbox/where-sql.int.test.ts src/server/whatsapp/escopo-transacao.int.test.ts --maxWorkers=1
node node_modules/eslint/bin/eslint.js src/server/inbox/where-sql.ts src/server/inbox/where-sql.test.ts src/server/inbox/where-sql.int.test.ts --max-warnings=0
```

- UNIT: terminal 38d907 EXIT0, oito arquivos completos/117 testes, 2,90 s, w2. O recorte inclui permissões Inbox e não inclui enums-rotulos; portanto não é o recorte DEV de oito/184.
- INT: sessão 36237, início 3cb371, terminal 297d65 EXIT0, dois arquivos completos/70 testes, 22,71 s, w1. São 67 do tradutor e três de escopo-transacao; não se somam execuções sobrepostas.
- Lint: d61dab EXIT0, três arquivos, sem saída/avisos. Tee-Object não criou arquivo quando o comando não emitiu stdout; o terminal é a evidência, não um log vazio fabricado.

Sem filtros de nome ou skips nos gates próprios. A mesma sessão INT foi acompanhada até a saída terminal. As advertências de configuração vite-tsconfig-paths/MIXED_EXPORTS não foram falhas de teste. Não executei global ou TSC, nem transformo o TSC auxiliar DEV em TSC original próprio.

Após o terminal INT, executei somente o oráculo READONLY autorizado sobre a fixture final. Terminais 0b5758 e b16ae0 EXIT0; nenhuma suíte DB simultânea, nenhum DML/DDL. Liberei explicitamente TESTER491 ao ROOT após b16ae0 e não voltei ao banco. Restauro é responsabilidade/prova posterior do ROOT, não presumida aqui.

## SQL, autorização e formas fechadas

O tradutor é puro e não consulta banco, carrega contexto ou decide papéis. O chamador futuro precisa combinar o escopo autorizado produzido por escopoAtendimentos; where vazio sozinho é TRUE e não autoriza uma tela. Nesta entrega não há consumidor de produção da função, apenas os testes. Os emissores canônicos de ACL, busca, filtros e preferências atuais continuam intactos.

Tabelas, campos, casts de enum, operações e aliases a/rN vêm do registry interno fechado. Valores de texto, enum, booleano, inteiro e data ficam em bindings Prisma.Sql. Campo/relação desconhecido é validado antes de pular undefined ou podar grupos. Object.hasOwn e a validação de objeto simples evitam interpretar constructor/__proto__ como coluna; cada nível de relação volta ao registry. Não há identificador SQL fornecido pelo usuário, queryRawUnsafe, interpolação de busca em Prisma.raw ou fragmento SQL arbitrário do chamador.

some/none e relações singulares geram EXISTS correlacionados com aliases únicos por construção, preservando uma linha por atendimento e sem joins multiplicadores. Relação opcional nula compara a FK; is:{} mantém a exigência de existência. NOT e comparações preservam o NULL de SQL nos formatos verificados, em vez de acrescentar um IS NULL que ampliaria a regra. Enums são validados antes do cast; datas válidas são ISO UTC com precisão de milissegundo e cast timestamp(3), coerente com o schema e o Prisma instalados.

LIKE/ILIKE mantém os curingas e escape de barra usados pelo Prisma canônico. Não troca a busca atual por uma busca literal diferente. O controle de aspas/OR e os bindings de UNIT impedem concatenação/injeção; INT compara também conjuntos reais com acento, nome, dígitos, %_, aspas e barra, incluindo o controle positivo corrigido pelo DEV.

A registry não aceita todo WhereInput do Prisma. every, isNot, notIn, startsWith e tipos/enum inválidos são recusados. Comparações ordenadas de texto como id.lt também estão fora do subconjunto; o cursor atual não é um where de ACL/filtro a ser implicitamente traduzido aqui. Qualquer consumidor posterior que precise desse formato terá de explicitá-lo com paridade, sem converter erro em TRUE ou remover o predicado. Não se presume cobertura de operadores futuros pelo tipo amplo da assinatura TypeScript.

## Normalização de vazios e contrafactual adicional

OR:[] no topo retorna falso. No Prisma instalado, grupos logicamente estruturais vazios podem ser podados dentro de AND/OR/NOT: AND:[{}, {OR:[]}] não deve ser traduzido como falso. condicao valida cada filho antes de grupoVazio, evitando que um formato desconhecido seja descartado como grupo vazio permissivo.

O ROOT levantou especificamente escalar({}) retornando null, em filhos que não são grupoVazio por terem chave de coluna. O oráculo privado importou a implementação exata por transpilação local do arquivo, com SHA GitLF conferido, e comparou IDs de findMany e SELECT traduzido na mesma transação SET TRANSACTION READ ONLY. Não editou o módulo. A fixture final tem um atendimento, porque o arquivo escopo-transacao recria seus dados; acrescentei combinações com esse ID existente e com ID impossível para evitar uma conclusão baseada apenas em resultados vazios.

Resultado final: 23 construções observadas; 19 formas aceitas coincidiram integralmente, com resultados positivos e negativos. Incluem id:{}, responsavelId:{}, OR/AND/NOT envolvendo esses filtros, OR com ID existente, NOT com existente/inexistente e combinações com OR:[]. Não encontrei o suposto alargamento por scalar{} nesses casos.

Quatro formas Prisma permissivas foram recusadas conservadoramente: id.mode:undefined, conversa.is:undefined, id.equals:undefined dentro de OR e responsavelId.not:undefined dentro de NOT. O JSON tem label textual que preserva undefined, pois JSON.stringify do where sozinho o omite. Esses formatos não são emitidos pelos produtores canônicos lidos. Recusá-los é compatível com o contrato fechado e não constitui paridade geral com qualquer objeto JavaScript aceito pelo Prisma. Não aceitei essas recusas como igualdade e não chamei as 23 construções de 23 testes Vitest.

## Oráculos reais e limites

O UNIT do tradutor faz 512 construções em um único caso: 256 subconjuntos dos oito papéis vezes leitura/envio. Isso trava formatos emitidos, não prova 512 consultas ou 512 testes. A INT compara SQL/Prisma com o MESMO where e Db para onze atores em leitura/envio, incluindo os caminhos de carteira, posse atual de linha, convite e docente. Há controles explícitos positivos e negativos, não só igualdade de conjuntos vazios.

Fim estrito/revogação de convite e podeEnviar independente, troca de dono/desativação de linha sem remover outra via legítima de carteira, revogação de cobertura e fim de vínculo docente são verificados com restabelecimento das alterações de fixture. O contexto de 301 membros inclui o membro final sem cap. O teste pool1 usa linha e ACL não commitadas no mesmo Db, exige visibilidade dentro da transação e confirma rollback depois. O teste adicional escopo-transacao comprova que o caminho global não vê o que só foi gravado na tx.

O controle UTC/São Paulo/Tokyo usa a mesma conexão transacional, bordas T−1/T/T+1 e finally que restaura a TZ. A paridade dos casos observados não promete uma única snapshot sob concorrência irrestrita READ COMMITTED, equivalência universal para todos os WhereInput, limite de complexidade arbitrária ou desempenho do futuro agregado. Os EXISTS não fazem N+1 de chamadas DB no tradutor; isso não aprova uma futura implementação de sete counts em Promise.all.

## Identidade, negativos e fechamento do marco

A prova própria inbox-344-marco1-identidade-tester.json registra os seis paths exatos do commit, OIDs, bytes/hash GitLF e físicos normalizados. Somente os três novos SRC/testes, SPEC, relatório e quadro mudam. Todos os outros arquivos versionados são iguais ao pai, incluindo ACL existente, lista/API, produtores #342/#343 presentes na base, Prisma/SQL/schema, scripts/harness, packages e workflows. git diff --check entre pai e HEAD passou. Arquivos versionados continuam limpos. Verificação própria: sessão70412/terminalbac58c EXIT0; prova de identidade de 4.289 bytes, SHA256 0db7c050cced9014f28a84256695a96a5e7fbb7d2bbee5c65f3301909791bf32. As dependências #349/#351 têm entregas próprias e não foram integradas por este marco.

Os negativos DEV descritos no relatório permanecem nominais: módulo ausente/stub, fixtures inválidas, divergências reais 47/49 e 55/58 e 60/65, além de 69/70 com literal de barra errado. Não os reclassifiquei como verdes. Minha leitura exploratória 598af0/d9d549 consultou dois nomes inferidos que não existem (escopo-atendimentos.ts e consultas.ts); usei depois os emissores reais escopo.ts/consultas-pagina.ts. O primeiro coletor de evidência, sessão91355/9bd4ac EXIT1, presumiu a existência do log de lint sem stdout; foi preservado como negativo administrativo e corrigido somente no verificador privado, sem repetir gates ou alterar produto.

Nenhum achado bloqueante de produto no marco 1. A autorização dos marcos 2/3, integração final na main, novos produtores de filtro/contagem, CI e encerramento #344 continuam pendentes de coordenação e provas próprias. Este parecer não autoriza mudança de ACL nem novo uso de banco.
