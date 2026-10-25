# QA independente #344 — Marco 3 — 7138574b

Fonte inspecionada e executada: `7138574b547b7169445268edab3fe60fae5f3489`, base M2 `0fdedf47ba900fd8a43c06a20b78fe716e27471f`. Worktree exclusivo TESTER, branch `codex/inbox-e3-344-marco3-qa`. Parecer: **não aprovar esta fonte ainda**, pelo desvio de cursor com offset reproduzido abaixo. Os gates dirigidos aprovados permanecem válidos e separados do complemento negativo.

## Preparação, fonte e isolamento

ROOT preparou o checkout em c6d1c2 e admitiu o ambiente em ee87ea, ambos EXIT0: perfil tester, cliente490 próprio SHA256 `647c2586589198b10c9345265e0cce7a43819d5cb44633dbad5e0e0b611fae2b`, banco descartável TESTER491 exclusivo, snapshot f1d15d/424 tabelas/1.392 registros conferidos. Meu preflight e61865 confirmou HEAD/profile/client/tracked limpo; seu exit1 final foi apenas descoberta rg sem correspondência, não teste de produto. Não houve install, generate, DDL, provider, browser, HTTP, UI ou alteração de produto pelo TESTER.

O manifesto DEV congelado foi copiado integralmente para `inbox-344-marco3-manifesto-dev-snapshot-tester.json`: 13.926 bytes, SHA256 `8adc4727cf002651d2e3981c05c4fa8e28bfc3e4da183220a6f1b0096f6c78d6`. Verificador próprio `inbox-344-marco3-identidade-tester.cjs`, sessão70712/ed3976 EXIT0, conferiu os 27 blobs presentes, OID/bytes/SHA Git e normalização LF da cópia física TESTER. Há 28 entradas sem detectar rename: 27 presentes e a origem removida da fixture; não são 28 arquivos novos. Não afirmo igualdade física LF/CRLF.

Provas independentes: dez paths protegidos literais; sete funções342 literais, corpo de naoLidaPessoalEmSql e função listarMensagensPagina literais; fixture de 3.934 bytes/SHA256 `7cf2668396bc5509c0e1351c3be95dddc6c0ce59fce9c72a85dc122b786716f1` movida literalmente para src/test; constantes novas com duas declarações e zero imports, imports/reexports compatíveis. Prefixo do quadro preservado no namespace GitLF: 1.138.871 bytes/SHA256 `171aaddfd507d2b9c49569437a26058d5f9316030faa60e6079415c042975565`; a métrica física DEV é distinta. Identidades completas estão no JSON próprio adjacente. diff-check b1e0ea EXIT0; HEAD e tracked limpo reconfirmados em dfe916.

## Execuções próprias no commit exato

Executável: `C:/Users/Mendes/AppData/Local/hermes/node/node.exe`; Vitest local `node_modules/vitest/vitest.mjs`. Todos os arquivos abaixo completos, sem -t, filtros por nome, exclusões ou skips. Os caminhos de arquivo delimitam recortes, não suíte global.

| Gate | Sessão / terminal | Resultado |
|---|---|---|
| UNIT20, maxWorkers1 | 83498 / 133aa4 | EXIT0, 20 arquivos, 471 testes, 60,24s |
| INT4, config integration, maxWorkers1 | 43618 / c8cb2a | EXIT0, 4 arquivos, 59 testes, 254,32s; 248,86s nos testes |
| ESLint24, max-warnings0 | 875d61 | EXIT0, sem erros/avisos |
| Oráculo readonly inicial privado | 9551c8 | EXIT1 administrativo do controle de referência; preservado |
| Oráculo readonly v2 privado | df9c42 | EXIT1 causal, 1 caso/18 combinações; seis divergências do produto |

Ordem respeitada: UNIT terminou antes de iniciar INT4; esta terminou antes dos dois complementos sequenciais. Cada executor foi acompanhado até o terminal. Banco explicitamente liberado ao ROOT após df9c42; nenhum acesso DB posterior pelo TESTER. O restauro é responsabilidade do integrador e ainda não é atribuído a este parecer.

Comando UNIT: Node + Vitest `run` com os seguintes 20 paths e `--maxWorkers=1`:

```text
src/server/inbox/contexto-lista.test.ts
src/server/inbox/filtros-sql.test.ts
src/server/inbox/consulta-sql.test.ts
src/server/inbox/contagens.test.ts
src/server/inbox/estado-aria-sql.test.ts
src/server/inbox/estado-aria.test.ts
src/server/inbox/where-sql.test.ts
src/server/inbox/filtros.test.ts
src/server/inbox/cursor.test.ts
src/server/inbox/previa.test.ts
src/app/api/inbox/atendimentos/route.test.ts
src/app/(app)/inbox/page.test.ts
src/app/(app)/inbox/InboxNovo.test.ts
src/app/(app)/inbox/InboxNovo.detalhes.test.ts
src/app/(app)/inbox/InboxNovo.foco.test.ts
src/app/(app)/inbox/InboxNovo.interacao.test.ts
src/app/(app)/inbox/filtros-url.test.ts
src/app/enums-rotulos.test.ts
src/app/botoes.test.ts
src/app/colunas-ordenaveis.test.ts
```

Comando INT: Node + Vitest `run --config vitest.integration.config.ts` com os quatro paths e `--maxWorkers=1`:

```text
src/server/inbox/consulta-sql.int.test.ts
src/server/inbox/consultas-pagina.int.test.ts
src/server/inbox/estado-aria-sql.int.test.ts
src/server/inbox/contagens.int.test.ts
```

Lint: os 24 arquivos src existentes da diferença HEAD^..HEAD, lista real conferida, executável local ESLint e `--max-warnings=0`. A origem deletada da fixture não foi passada ao lint. Logs UNIT/INT/oráculos foram preservados em output com prefixo `inbox-344-marco3-`.

## P2 — offset aceito no cursor altera a fronteira SQL

`src/server/inbox/cursor.ts:17–18` aceita qualquer em cujo Date.parse é válido e preserva a string. No produtor anterior, depoisDoCursor criava `new Date(c.em)` antes do filtro Prisma. Agora `src/server/inbox/consulta-sql.ts:15–16` interpola a string original em `::timestamp(3)`: o PostgreSQL ignora o offset ao converter uma string para timestamp sem fuso.

O complemento autorizado importou **depoisDoCursorEmSql real**, codificarCursor e decodificarCursor reais, sem copiar o predicado novo. Executou uma TX explicitamente READ ONLY no TESTER, CTE VALUES sem tabelas de fixture, DML ou DDL. Comparou o SQL real com o instante normalizado por `new Date(em).toISOString()` e um oráculo JS independente para menor instante, empate por id e NULL. SET LOCAL de TimeZone foi restaurado automaticamente no fim da TX. Três zonas: UTC, America/Sao_Paulo e Asia/Tokyo.

Para o mesmo instante 2026-10-01T12:00:00Z e cursor id m-m:

| em aceito | Esperado / referência normalizada | SQL atual |
|---|---|---|
| 12:00Z | linha10Z, empate12Z/id menor e NULLs | igual |
| 09:00-03:00 | mesmos IDs de 12:00Z | apenas NULLs; omite10Z e empate menor |
| 17:30+05:30 | mesmos IDs de 12:00Z | inclui também14Z, o próprio id e empate maior |

A referência normalizada concordou em 18/18 combinações. O produtor atual concordou nos 12 controles Z/outros instantes/NULL e divergiu nos dois offsets em cada zona: seis divergências. Não é hipótese de TimeZone do host nem escalada de ACL; é regressão de paginação para entradas de cursor aceitas, capaz de omitir/repetir linhas. Cursores gerados normalmente pelo servidor são Z, o que explica o recorte atual permanecer verde.

Coleção privada v2 comprovada antes da execução: f9eba3 EXIT0 mostrou **um único arquivo literal**, sem concatenação de includes. Comando: Node + Vitest `run --config output/inbox-344-marco3-cursor-oraculo-v2-private.config.ts output/inbox-344-marco3-cursor-oraculo-v2-private.int.test.ts --maxWorkers=1`. Config preserva plugins, setup, perfil e guardas da integração e sobrescreve include literalmente. JSON `inbox-344-marco3-cursor-oraculo-v2-tester.json` contém SQL parametrizado, valores, cursores, zonas e resultados completos; log e código privado adjacentes.

O primeiro oráculo 9551c8 passou Date diretamente ao $queryRaw com cast explícito timestamp, introduzindo conversão de parâmetro dependente do TimeZone e invalidando seu próprio controle. A primeira versão, JSON e log foram preservados. A v2 muda somente essa referência para ISO normalizado e acrescenta NULL positivo; não altera o produto e não transforma o primeiro executor em green. Recomendo normalizar a fronteira temporal para UTC antes do cast, mantendo id/null/parametrização, e acrescentar teste causal do produtor para os offsets equivalentes. Não aplicar Date cru ao $queryRaw como solução sem verificar o tipo/cast.

## Revisão adversarial e limites

A seleção SQL aplica escopo, busca e demais filtros antes de LIMIT. Os primeiros 100 fixados ficam fora da paginação normal; o NOT EXISTS exclui todos os fixados dos normais, não só os 100 exibidos. A hidratação reaplica escopo e filtros e restaura a ordem selecionada; o teste revoga a carteira entre seleção e findMany e não entrega o ID revogado. Cursor posterior é calculado da seleção, então alterações concorrentes podem reduzir a página sem retornar itens fora da ACL.

Snapshot pessoal usa apenas IDs selecionados/hidratados, uma consulta correlacionada e mesmo Db/ator/instante; vazio retorna sem query. H/S da montagem são limitados à página. A operação lazy memoiza a promessa antes do await, compartilha contexto entre lista/legados/resumo/deep link e rejeita troca de ator/Db/envio/instante. O upsert legado de ConfigIA permanece só no loader global; não surgiu inicialização na construção da operação. Pool1 observa alteração não commitada e rollback. O teste de volume cobre305 linhas novas, mais de100 fixadas, NULL/empates e alvo posterior ao antigo limite200. O registry M1 não recebeu id.lt genérico: o cursor é composição SQL fechada e parametrizada.

As cinco contagens legadas mantêm base distinta dos sete estados novos: o legado retira responsável/não lidas/prazo e mantém aria; o resumo novo retira estado/prazo/fila e conserva eu/ID/não lidas. Um agregado SQL calcula os sete com as prioridades342; a extração de constantes não muda corpos342. HTTP/SSR reutilizam operação após autorização e levam o filtro whitelist aria; resumo é aditivo, sem implementar telas345–347. Esses pontos têm evidência nos recortes e inspeção, sem alegação de exaustão combinatória ou equivalência universal.

DEV preservou UNIT20/471 negativo 76902/3c580a (468 aprovados/3 falhas), revalidação3/44 separada, dois erros de tipagem18178/77de0d e TSC auxiliar final6077/04c1ce com duas exclusões privadas históricas. Seus INT4/59 e INT3/27 posteriores têm sobreposição e não são86 testes únicos. Minha execução20/471 e INT4/59 são novas provas nominais do HEAD exato; não apagam os negativos DEV. Não rodei TSC/global, não atribuo TSC original ou CI futura a esta fonte e não fecho M3 antes de corrigir o cursor. União com A328, global/TSC original e CI da composição permanecem sob ROOT.
