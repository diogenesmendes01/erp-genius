# QA independente — #342 EstadoAria no servidor (revisão documental R2)

Código aprovado no recorte independente do commit exato 54c44b2ad2f5414f346e07dea76001a13c799051, parent cf29add93cd63fe14f95bf8a53fb079d3efe9a27. Não encontrei bloqueador de implementação. A impressão digital física DEV foi reconciliada por uma CRLF isolada; resta qualificá-la documentalmente em relação ao blob GitLF, sem alegar byteigualdade física. Esta QA não conclui a issue, composição ou CI remota.

## Ambiente e fonte

ROOT preparou a branch TESTER codex/inbox-e3-342-qa no SHA indicado, tracked limpo, perfil tester resolvendo exclusivamente localhost:54329/erp_genius_test_tester. O rótulo tester491 corresponde ao histórico com o índice 342; o modelo/cliente continua 490, SHA256 físico 647c2586589198b10c9345265e0cce7a43819d5cb44633dbad5e0e0b611fae2b. Não gerei cliente nem alterei perfil, schema ou dependências.

Conferi o snapshot preparado pelo integrador por hash: f1d15dff3df9ddfab63b8c2e238c0e3d89122c47471d27c8724e20ffd7c291c5, em ROOT/output/inbox-342-snapshot-tester491.json. Preparação ROOT 12da25/sessão 74892 EXIT0: 424 tabelas/1.392 registros, originais 9 mensagens/4 notas preservados, conforme handoff. O snapshot foi lido por FS para conferir hash; não fiz consulta manual aos dados.

O diff tem nove paths: produtor novo, três arquivos de testes, extração mínima em uso.ts, uma migração de índice e três MD. Schema Prisma, dependências, workflows, consumidores UI e scripts visuais permanecem idênticos à base. O verificador 005037 EXIT0 conferiu os nove blobs GitLF versus físicos e diff --check.

Produtor estado-aria.ts: 6.783 bytes, SHA256 GitLF/físico T 6bdc1150772e4589c790a79c099a0a24a090b11ce47cc3c93ede121963355129. Migração 20261024213000_inbox_aria_indice_handoff: 262 bytes GitLF/dc3a00d7a1832309613d1d80ff27a278960b1bb3b695187dd0cf9c4fcbdce319; físico CRLF 266 bytes/1f13277373b72c12d59752443bfa74cdece7639247806be7631acbcb120637fb. A equivalência SQL é textual após normalizar CRLF; não apliquei DDL.

## Execução própria até terminal

| Gate | Executor/terminal | Resultado |
|---|---|---|
| UNIT | c0fbd2, EXIT0 | Quatro arquivos completos, 42/42, 1,04 s, dois workers. |
| INT | sessão 75901, início 1641b6, terminal 468d13 EXIT0 | Dois arquivos completos, 28/28, 112,46 s, um worker. |
| Lint | cc1162, EXIT0 | Cinco arquivos SRC/testes alterados, --max-warnings=0; zero erros/avisos. |

UNIT: src/server/inbox/estado-aria.test.ts, src/server/aria/uso-db.test.ts, src/server/aria/uso.test.ts e src/server/aria/turno/guardas.test.ts, via Node 22 local + node_modules/vitest/vitest.mjs run, --maxWorkers=2. Não houve filtro de nome, skip ou cancelamento.

INT: src/server/inbox/estado-aria.int.test.ts e src/server/aria/uso.int.test.ts, no MESMO comando com --config vitest.integration.config.ts --maxWorkers=1, sem filtro de nome/skips/cancelamentos. São18 casos #342 e10 legados de uso, aprovados juntos nesta execução final própria; não são os dois resultados DEV separados reatribuídos. A suíte #342 usa connection_limit=1/pool_timeout=3 no banco descartável próprio. O global setup padrão foi mantido; não houve install, generate ou DDL manual pelo TESTER. MOTOR_URL/MOTOR_API_KEY são vazios pela configuração de integração. Não houve provedor ou mensagem real.

Acompanhei a mesma sessão 75901 até o terminal 468d13. O banco foi explicitamente LIBERADO ao ROOT imediatamente depois; não fiz consultas posteriores ou restauro próprio. O integrador confirmou que restauraria tester491; não presumo o resultado desse restauro sem sua prova.

TSC: por orientação explícita do integrador, não rodei outro TSC nem criei configuração auxiliar para contornar snapshots privados. Prova separada ROOT no SHA54: TSC ORIGINAL 82014/b78b4b EXIT0, sem exclusões auxiliares, e lint GLOBAL 6956/e2f4d8 EXIT0, zero erros/40 avisos herdados. Esses gates não são execução minha. Não surgiu dúvida nova de tipos na revisão. O global DEV 937/7.425 continua nominal DEV; não repeti global nem o somei aos recortes.

## Revisão adversarial

A prioridade é coerente entre derivação e filtros: encerrado/grupo→null; handoff pendente; pausa→humano; sugestão vigente→aprovação; global e elegibilidade→ia; responsável→humano; restante→null. Pausa vence sugestão, e handoff vence ambas. SHADOW/DESLIGADA, versão ausente e pausa global não viram ia; ESTOURADO+PAUSAR bloqueia, enquanto SO_SUGERIR conserva o contrato existente. A guarda do turno é reutilizada, sem copiar permissões.

Comparei cada ramo de condicaoEstadoAria com a derivação: abertura individual comum, exclusão do handoff nos estados inferiores, pausa/sugestão na ordem correta e responsável condicionado à ausência de sugestão/elegibilidade. A matriz INT consulta o PostgreSQL pelos filtros e compara com classificação pura nos dois estados globais, inclusive nulos, opt-out, linha com dono, setor financeiro e atendimento encerrado. O grupo é negativo explícito da invariante DB existente, sem fixture que contorne trigger.

Handoff exige motivo HANDOFF, pausa não nula e atendimento aberto. Os dois NOT EXISTS usam mensagem SAIDA/HUMANO ou CELULAR e evento AtendimentoAssumido do MESMO agregado/tipo/alvo, sempre criadoEm estritamente maior que a pausa. Igualdade não encerra handoff. Os testes completos cobrem T−1/T/T+1 para humano/celular, tipo/alvo/agregado errados, igualdade do evento, IA/ENTRADA ignoradas, pausa nula e representação equivalente por fuso.

Sugestões usam status SUGERIDA e expiração nula ou estritamente futura; DISTINCT ON por atendimento, criadoEm DESC/id DESC. O empate por ID é somente seleção estável. O parâmetro agora.toISOString()::timestamp(3) mantém a comparação UTC com coluna timestamp sem fuso, sem interpolar literal ou alterar TZ global. O teste completo executou T−1/T/T+1 comparando raw e filtro Prisma em UTC, America/Sao_Paulo e Asia/Tokyo, com set_config local à transação. Não confundo esse oráculo final com os RED temporais DEV anteriores.

IDs[] retornam vazio sem consulta; undefined em handoff significa universo, conforme contrato. As listas são deduplicadas e ligadas como parâmetro ANY(text[]), sem cap 100/200 ou concatenação SQL. O caso 205 cria e recupera todos os atendimentos/sugestões, exige uma query por loader e recusa a string com aparência SQL como simples ID, preservando os 205 registros. Isso prova ausência de N+1 de chamadas do produtor nesse lote, não benchmark ou plano ótimo em qualquer volume.

carregarContextoAria fixa agora uma vez e encaminha o MESMO Db a situação, orçamento e handoff. A alteração compartilhada em estadoOrcamento é somente tx opcional, db=tx??prisma e uso desse db no upsert/agregado mensal UTC. Chamadas legadas sem segundo argumento preservam o caminho anterior; uso.int completo também passou. O upsert de ConfigIA ausente é comportamento legado documentado: o contexto não promete ser absolutamente sem escrita. O teste pool1 lê alterações não commitadas de estado/orçamento/pausa dentro do mesmo tx e força rollback; depois confirma estado global anterior, ausência da chamadaIA e pausa nula. Não há client/transação interna ou escape ao global nesse fluxo.

A migração contém um único CREATE INDEX CONCURRENTLY IF NOT EXISTS, sem BEGIN/COMMIT, no campo iaPausadaEm com predicado HANDOFF aberto. O caso INT conferiu existência única, indisvalid e definição esperada. A preparação/aplicação do índice pertence ao ROOT. Não há mudança de modelo, enum, dados de domínio, envio, ACL ou consumidor. Os futuros consumidores devem combinar o filtro com seu escopo autorizado; classificar não concede acesso. D1–D3 e futuras ações/consumidores não são implementados ou encerrados por esta entrega.

## Achado documental e negativos preservados

O relatório DEV declara hash físico B b193fb0a5aef0c9b282ef0dd1947863d4b4b1514eae41c4eeb2c70f9555e2bd1. ROOT reconciliou a diferença em leitura8e830b; confirmei independentemente em bcc0ca EXIT0: B possui 6.784 bytes, exatamente 1 CR e 122 LF. Normalizar apenas CRLF→LF produz 6.783 bytes byteiguais ao blob54/arquivo T, SHA256 6bdc1150772e4589c790a79c099a0a24a090b11ce47cc3c93ede121963355129. Portanto b193 é correto para o físico B: a diferença não é mudança de código, nem CRLF integral. Minha reconstrução anterior de todas as linhas como CRLF não testava essa mistura; o apontamento anterior fica refinado por esta prova. A errata final deve qualificar físico B e GitLF com ambos hashes, sem afirmar que os bytes físicos são iguais. Nenhum gate foi reexecutado. Prova privada output/inbox-342-reconciliacao-linhas-tester.json, SHA256 373e1ea5fd5bf5f0ffe8e18129fcd7024bc660f2e03f1c12835791fc082405eb.

Preservo os negativos DEV do relatório: módulos ausentes na etapa RED, query temporal inicial incorreta, fixtures inválidas e TSC original DEV com dois privados históricos, seguido de auxiliar restrito. O TSC original ROOT verde atual não transforma o TSC antigo DEV em verde. No TESTER, b81d4d foi somente erro administrativo do leitor ESM (require+await), corrigido em 213f39 antes de iniciar a integração; não é gate ou regressão do produto. Os avisos MIXED_EXPORTS/vite-tsconfig-paths nos logs são preexistentes da configuração, sem alteração solicitada nesta QA.

## Evidências e conclusão

Prova output/inbox-342-identidade-tester.json: SHA256 3aa28ad79dfc4cd5f80a32b992f30f8a885187e65f7a98a365c3bc67ec3d69b2. Contém nove fontes/hashes GitLF/físicos, SQL, snapshot e logs. Logs próprios:

- UNIT f7466393fd3f8da60a7215d41e779ecca931a49d664fa177c9e5fd9b36588c27;
- INT 14f850a79d26aba5165e10ea7ca46fed500c1bf909af588534865622d2096b22;
- lint vazio/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.

Código favorável no recorte executado e identidade de código reconciliada. A qualificação documental dos dois hashes físicos/normalizados permanece com o integrador. Aceite visual N/A: produtor interno sem interface nova; não houve UI, Save, nota manual ou chamada externa. Composição/CI/publicação e restauro confirmado continuam responsabilidades separadas do integrador. Não alterei implementação, quadro de outro agente, cliente ou perfil.

Esta revisão R2 preserva integralmente o parecer inicial output/inbox-342-final-review-tester.md (9.848 bytes/SHA256 5aa81685667bcb6022c677c5eec2af0008aa7af4e3121178238fb3e05970001c). Atualiza somente a conclusão sobre finais de linha; não substitui nem reatribui as saídas UNIT/INT/lint.
