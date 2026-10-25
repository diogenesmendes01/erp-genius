# QA independente — Inbox #349

Favorável ao commit exato cb285c3284b382f6e7f9348ad8747df8f53959b2, base54c44b2ad2f5414f346e07dea76001a13c799051. Os recortes próprios completos passaram e não identifiquei bloqueador no escopo produtor/decisões examinado. Não é aprovação global, CI, composição futura ou fechamento de issue. Cartão visual pertence à350; nenhuma interface nova foi homologada aqui.

## Fonte, ambiente e preservação

Worktree exclusivo C:/Users/Mendes/.codex/worktrees/inbox-tester/erp-genius, branch codex/inbox-e3-349-qa, HEAD e tracked limpo confirmados em94d64d EXIT0 e reconferidos ao final. Perfil tester, banco descartável TESTER491/erp_genius_test_tester preparado pelo ROOT122084, lease exclusiva. Cliente próprio490 SHA647c2586589198b10c9345265e0cce7a43819d5cb44633dbad5e0e0b611fae2b. Snapshot1392 registros/424 hashes,9 mensagens/4 notas, SHA f1d15dff3df9ddfab63b8c2e238c0e3d89122c47471d27c8724e20ffd7c291c5, informado/conferido pelo integrador antes da execução. Nenhum install, generate, DDL, alteração de perfil ou controle de cluster pelo TESTER.

Prova output/inbox-349-identidade-tester.json SHA f7ed9ccb6a1a041f59ef06d38329578e526258c87202b085cdd68f2668ce5ff7, terminal f9b7a1 EXIT0 (sessão41911). Dez paths totais/sete SRC. Os sete hashes GitLF do relatório DEV foram recalculados; a prova registra OIDs/bytes/SHA físicos e GitLF de todos os paths. Doze paths protegidos são byteiguais à base: schema, produtor342/testes, uso.ts, executor/guardas de turno, escopo-decisao, permissões Aria, idempotência compartilhada, PainelAria e escopo Inbox. Prisma/scripts/deps/workflows sem delta; git diff --check passou.

No histórico, seis funções são textualmente iguais por AST: exigirDecisor, travarAcao, exigirEscopo, campoMudouPorHumano, reverter e desfazerAcaoAria. No fixture PainelAtendimento.aria.test.ts, remover somente as cinco inserções podeDecidir:false/cartoes:[] recompõe o arquivo anterior inteiro; asserts e consumidor de produção não foram alterados. A identidade foi registrada enquanto INT ainda seguia, portanto seu campo de execução pendente não é gate verde. O terminal final e os hashes dos logs ficam na prova separada abaixo.

## Execuções próprias e término da lease

Executável C:/Users/Mendes/AppData/Local/hermes/node/node.exe, módulos Vitest/ESLint locais. Sem filtro de nome, skips ou exclusões auxiliares.

| Gate | Comando e terminal observado |
| --- | --- |
| UNIT | node_modules/vitest/vitest.mjs run src/server/aria/sugestoes-thread.test.ts 'src/app/(app)/inbox/PainelAtendimento.aria.test.ts' --maxWorkers=2. adac5a EXIT0:2 arquivos/30 testes (decoder23 +PainelAria7),1,84s. |
| INT | node_modules/vitest/vitest.mjs run src/server/aria/historico.int.test.ts src/server/whatsapp/consultas-inbox.aria.int.test.ts --config vitest.integration.config.ts --maxWorkers=1. Início3e7741/session36387, terminal fb4a50 EXIT0:2 arquivos COMPLETOS/44 testes,185,95s. |
| Lint | ESLint local nos sete SRC exatos de git diff base..HEAD, --max-warnings=0.839fad EXIT0,log vazio. |

Sessão36387 foi acompanhada até o mesmo executor retornar terminal0; silêncio não foi contado como sucesso. Banco LIBERADO explicitamente ao ROOT imediatamente após fb4a50. Não houve atividade DB posterior do TESTER. Restauro cabe ao integrador; não executei helper de restauro nem o antigo banco490. Nenhuma operação de browser, Save, nota manual ou motor real.

Logs privados output/inbox-349-unit-tester.log, inbox-349-int-tester.log e inbox-349-lint-tester.log. Prova final output/inbox-349-gates-final-tester.json SHA7d42ced7f18dc44cb76f76459ab80f0998ea4ee8bf14abf13400102cf600d6a9, a23f39 EXIT0, contém bytes/hashes dos três logs, terminais e liberação. Avisos mixed exports/vite-tsconfig-paths são os avisos de configuração observados, sem falha. Não executei TSC auxiliar/global ou integração ampla.

## Revisão adversarial — cartões e DTO

carregarAriaDoAtendimento mantém escopoAtendimentos antes de montar o resultado. cartoesDaThread recebe Db/transação e retorna vazio antes de consultar ações/nomes quando não há decidirHistorico. Cada cartão autoriza sua própria oportunidade, com fallback para lead do atendimento; leadsDecidiveis opera por lote no Db recebido. O indicador podeDecidir continua referindo-se ao lead do atendimento, não é permissão da action nem precisa coincidir com toda oportunidade de cartão. O caso indicador false/cartão autorizado foi deliberadamente testado; não o tratei como bug de produto.

SUGERIDAS entram somente com expiração nula ou estritamente posterior; APROVADAS/REJEITADAS/EXPIRADAS exigem decisão desde agora−24h inclusive, e decisão sem data fica fora. Ordem criadoEm ASC/id ASC e cursor composto preservam desempate. Páginas de100 prosseguem até20 AUTORIZADOS ou EOF, sem200 candidatos como cap. O teste real passa por201 fora da equipe e21 autorizados e retorna os20 primeiros exatos, sem segredo dos recusados. Não há consulta por cartão: ACL em lote por página e uma consulta de nomes para os decisores finais. Custo continua proporcional ao número de páginas de candidatos; não é promessa de consulta única para qualquer volume. A lista legada sugestoes permanece com seu comportamento até353, separada do limite do DTO novo.

O DTO constrói campos explicitamente, sem espalhar payload. texto só é string de payload.texto; detalhe tipado valida o que consegue interpretar e usa outro em formato inválido. Decoder23 cobre tipos conhecidos, enums de etapa, conversão de datas finitas, objetos/arrays/folhas inválidas e números não finitos;0 e false são preservados nos campos. Não confundir decoder de apresentação com validação integral de negócio do executor. Integração confere ausência de payload bruto, datas, status, limite24h, nomes em lote e fronteira de expiração.

Pool1 cria ação e decisor apenas na transação, lê ambos pelo Db recebido e confirma rollback sem registro residual. Isso verifica que a consulta não busca nomes/ações no client global durante a tx. A lógica de ACL herdada e os DTOs anteriores não receberam ampliação de papel.

## Revisão adversarial — decidir, retry e efeitos

Aprovar/rejeitar mantêm lock da AcaoAgenteIA antes dos locks de alvo no executor. Depois da espera, decisorAtual relê ativo/papéis/permissões em tx.usuario, sem memo ou lock de Usuario. Essa identidade fresca é usada no escopo ANTES do no-op. Revogação de papel nas duas operações e inativação antes de um retry são demonstradas com lock real e observação de pg_stat_activity nos testes. O checkpoint não promete serialização universal de qualquer mudança de ACL posterior; não o descrevo como tal.

Retry só retorna sucesso com estado e decididaPorId próprios e último Evento do tipo/agregado pelo mesmo autor. Rejeição exige também motivo normalizado por trim/limite500 com null preservado. Ausência de evento, evento incompleto, outro autor, escopo revogado, status oposto ou motivo divergente continuam recusados. Aprovação concluída pode ser reconhecida depois do prazo original, mas somente depois das autorizações atuais. No-op ocorre antes de update/evento/executor; não é reexecução de efeito nem correção de estado.

Os oráculos completos cobrem concorrência do mesmo ator com duas respostas ok e uma intenção/Evento, retry sem novo aviso/Evento/efeito, troca de equipe antes do no-op, motivo null/500 e último evento por outro autor. Casos herdados de preço/documento/pausa e desfazer permaneceram no arquivo completo e passaram. Executor, guards globais e seis funções de reversão/escopo mantiveram identidade literal; não houve ajuste de autorização para tornar o retry verde.

## Limites e resultados DEV preservados

DEV relata UNIT23/185 e global938/7.448, INT próprio2/44, TSC auxiliar e lint7 aprovados. O agregado INT amplo23 arquivos/280 de282 terminou EXIT1, com orçamento inconclusivo e busca temporal herdada fora349; os dois arquivos349 passaram ali, mas isso não converte o agregado em verde. Lint global DEV também ficou negativo por configuração de um privado histórico. Os relatos de clock/default/timestamp são observações e hipóteses separadas; não diagnostiquei orçamento nem corrigi busca nesta QA. Não somei recortes próprios aos números DEV ou a CI.

O TSC auxiliar DEV com duas exclusões privadas não foi repetido nem tratado como TypeScript original desta composição. ROOT deve verificar sua fonte integrada/CI original. A base342 está integrada, mas esta branch349 não importa343; publicação diretamente na main, eventuais conflitos em consultas-inbox e gates da composição pertencem ao integrador. Nenhum fechamento349/350/351/354–358, decisão humana nova, global verde ou aceite visual foi inferido destes recortes.
