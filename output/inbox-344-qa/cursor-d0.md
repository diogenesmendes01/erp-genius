# QA causal #344 M3 — d0dfa5a3

Fonte exata: `d0dfa5a3b2470e70490cd4167a58f9b2073c2b3c`, filho direto de `7138574b547b7169445268edab3fe60fae5f3489`. **Parecer favorável à correção causal do P2 de cursor.** O produtor agora preserva o instante aceito pelo decoder antes do cast SQL; os mesmos casos que expuseram seis divergências na fonte713 passaram sem alterar a referência do oráculo. Isto não conclui a integração/publicação da #344 nem reatribui os gates antigos ao novo commit.

## Fonte, ambiente e escopo

ROOT preparou o próprio worktree TESTER em d4af59 EXIT0, branch `codex/inbox-e3-344-cursor-qa`, tracked limpo e perfil tester. Cliente490 próprio preservado. Após a liberação anterior, ROOT restaurou TESTER491 em 1dce1c EXIT0: 424 hashes/1.392 registros/9 mensagens/4 notas, snapshot f1d15d preservado. A nova lease autorizava somente leitura/VALUES. Preflight próprio 0ef6d3 confirmou HEAD e tracked limpo; final 5acf64 reconfirmou ambos e diff-check EXIT0. Não houve DML/DDL/fixture, install, generate, TSC, global, UI, browser, HTTP ou alteração de produto pelo TESTER.

Prova independente `inbox-344-cursor-d0-identidade-tester.json`, verificador sessão38434/a9942a EXIT0: exatamente cinco deltas na árvore inteira — consulta-sql.ts, novo consulta-sql.cursor.int.test.ts e três adendos MD. **5.778 entradas de árvore fora desses paths permanecem idênticas a713**, incluindo decoder, schema, dependências, ACL, registry, UI, scripts e workflows.

No módulo de produção, remover apenas o comentário/constante nova e substituir os dois parâmetros instante por c.em recompõe o arquivo713 literalmente. As três outras funções continuam literais: selecionarIdsPaginaInbox, preferenciasDaPaginaSql e contarLegadosComContexto. NULL retorna antes da conversão; ID/desempate, operador, cast e parametrização não mudam. A normalização usa string UTC `new Date(c.em).toISOString()`, evitando passar Date cru ao $queryRaw. A validação de cursor continua no decoder legado, não foi restringida a um formato novo para esconder o desvio.

Os três documentos preservam seus prefixos e acrescentam a causa, RED/GREEN e pendências. A prova registra GitLF e físico separadamente: consulta-sql.ts: 4.883 bytes/SHA256 `d208709390a170bfd4c99c049dec3df930e1d78d89ff4fc284d0f23f8c97c989`; teste novo: 2.254 bytes/SHA256 `a8bbfe9c5669011cbb0e6c778dfae16d36ada0628dc5976bd54142c458be6843`. Documentos físicos CRLF correspondem após normalização, não são chamados byteiguais ao Git.

## Execuções próprias e terminais

Node22 local `C:/Users/Mendes/AppData/Local/hermes/node/node.exe`, Vitest/ESLint instalados no worktree. Todos os arquivos completos, sem -t, filtros por nome ou skips. Nenhum segundo executor DB simultâneo.

| Recorte | Executor / terminal | Resultado nominal d0 |
|---|---|---|
| Novo consulta-sql.cursor.int, config integration/w1 | 882572 | EXIT0, 1 arquivo/21 testes,4,52s |
| Oráculo independente preservado, config literal/w1 | a0601a | EXIT0,1 arquivo/1 teste com18 combinações,3,28s |
| consulta-sql.test + cursor.test, w1 | 348905 | EXIT0,2 arquivos/6 testes,4,54s |
| ESLint dos2 paths alterados, max-warnings0 | sessão76271/42eb11 | EXIT0,sem erros/avisos |

Os dois executores DB concluíram antes de iniciar o UNIT/lint. Após a0601a, **liberei explicitamente TESTER491 ao ROOT** e não fiz novo acesso DB. A constância/restauração posterior pertence ao integrador; não é presumida neste parecer.

Comandos, precedidos do executável Node:

```text
node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts src/server/inbox/consulta-sql.cursor.int.test.ts --maxWorkers=1
node_modules/vitest/vitest.mjs run --config output/inbox-344-cursor-d0-oraculo-private.config.ts output/inbox-344-cursor-d0-oraculo-private.int.test.ts --maxWorkers=1
node_modules/vitest/vitest.mjs run src/server/inbox/consulta-sql.test.ts src/server/inbox/cursor.test.ts --maxWorkers=1
node_modules/eslint/bin/eslint.js src/server/inbox/consulta-sql.ts src/server/inbox/consulta-sql.cursor.int.test.ts --max-warnings=0
```

O novo teste usa somente VALUES com sete linhas sintéticas; começa cada transação com SET TRANSACTION READ ONLY e muda TimeZone por set_config local à TX. Não chama truncarBanco/fixtures/models de escrita, nem cria tabelas. O executeRawUnsafe existente recebe exclusivamente a constante literal SET TRANSACTION READ ONLY, sem interpolação. Retorna linhas por predicado real e compara com a semântica JS do instante, empate por ID e NULL. Os21 casos são sete entradas em UTC, America/Sao_Paulo e Asia/Tokyo: Z, offsets -03/+05:30 equivalentes, instantes anterior/posterior, NULL e string0 já aceita pelo decoder. afterAll desconecta o cliente próprio.

## Reexecução independente sem mover a meta

Antes de copiar, conferi o teste v2 antigo: 3.254 bytes/SHA256 `05eff568122e6c86e7749b2d1073b583e894d60bf96da5517b23f512606e3175`. Criei arquivo novo; somente o nome do JSON de saída e a atribuição de HEAD mudaram. A substituição inversa recompõe **o arquivo inteiro antigo**, provando casos, referência, asserts e SQL de controle literais. A prova está em `inbox-344-cursor-d0-oraculo-identidade-tester.json`.

Coleção fea3be EXIT0, antes do run, mostrou um único arquivo privado. Configuração copia os plugins/setup/perfil/guardas originais e sobrescreve include literalmente, sem merge de arrays. O teste confirma current_database TESTER e transaction_read_only=on. O predicado novo é importado da produção; SQL/valores são preservados no JSON. A referência continua `new Date(em).toISOString()`, comparada também com o oráculo JS independente.

Na fonte713, df9c42 EXIT1 revelou 6/18 divergências: 09:00-03 omitia linhas de 12Z e 17:30+05:30 incluía linhas posteriores/empates indevidos. Agora **18/18 concordam tanto com a referência quanto com o oráculo JS**, incluindo os dois offsets em três zonas. Os demais controles Z/instantes/NULL continuam positivos. Não são 18 testes Vitest separados, e não somo esse complemento aos 21 como39 testes únicos.

O JSON antigo negativo permanece: 29.564 bytes/SHA256 `84d16abeb2aad5ddd5a71f453ef7dc192eb657d160cbc4daddb75b32d37d19e5`. O parecer antigo: 10.184 bytes/SHA256 `a7a780ee45a112215c90578671966ab56bf897e40326305ab2841b62dae71648` foi conferido intacto. O primeiro controle incorreto 9551c8 (Date cru com cast timestamp e conversão dependente do TimeZone) também permanece preservado; nunca foi contado como aprovação ou convertido em causa de produto.

## Atribuições e limites

Os gates anteriores TESTER 20/471, INT4/59 e lint24 pertencem a713, apesar da identidade fora do fix; não foram repetidos nem chamados execução do d0. O P2 anterior continua evidência histórica negativa e é fechado aqui por correção mínima + nova prova causal. Não executei a suíte global, TSC ou outro recorte DB.

ROOT registra separadamente RED a3fdbe: 9 falhas/12 passes dos 21, GREEN 8845ac: 21/21, UNIT d8f7a5 dois/seis, lint 2c96bba e TSC original 26267/03ef61 sem configuração auxiliar/exclusões, além da constância readonly 53cc14 no seu banco. São provas ROOT, não execuções TESTER. A nova prova não elimina os negativos UNIT/TSC DEV anteriores nem transforma a revalidação 3/44 em suíte 20 inteira verde.

Não encontrei outro desvio no delta. Permanecem sob coordenação ROOT a composição com A328, TSC/global originais da árvore integrada, CI e publicação. Nenhuma captura visual nova foi feita ou reatribuída. Logs e provas deste parecer têm prefixo `inbox-344-cursor-d0-` no output próprio.
