# Entrega DEV B — Inbox #353

Base8535c5ba90e7446acef8d9e409fba5e9dcbd10d8; branch codex/inbox-e3-353-retirar-painel-aria. Plano/contrato de retirada aprovados tecnicamente pelo ROOT. Dois DEVs e TESTER coordenados; nenhuma terceira feature. Banco ci-integracao reservado exclusivamente a B para uma integração por vez após restauração ROOT400323 EXIT0 (503 originais/424 hashes), preview encerrado pelo integrador. Perfil local ci-integracao SHAae0f5496080ab61c84742dda9191a69579795188720819dc797386307101f01f; cliente schemaSHA647c2586589198b10c9345265e0cce7a43819d5cb44633dbad5e0e0b611fae2b. Sem alteração de perfil/dependências/config/cluster.

## TDD

UNIT RED73bba1 EXIT1:dois arquivos/112 casos, duas falhas/110 controles (arquivo PainelAria presente e consumidor ainda o monta). INT RED sessão91605/9b8f5f EXIT1:13 casos, quatro falhas/nove controles, campo sugestoes ainda presente no contrato. Config original vitest.integration.config.ts/ci-integracao/w1/heap1024, uma suíte na lease. Setup original somente confere migrate status; nenhuma migração é aplicada pelo teste.

Retirados arquivo PainelAria/import/montagem, entrada exata mapa botões, campo legado DTO e query/helper exclusivos. Mapeamentos de fixtures/testes migrados para cartoes; pendências filtradas por status sem eliminar histórico24h. Callback atual do cartão/conversa e refresh lista+painel estão explicitamente testados. Nenhuma action/ACL/produtor de cartões/handoff/estado352 foi alterado.

GREEN inicial f96c5a EXIT0:dois arquivos/112 testes. GREEN recorte sessão81247/2ce618 EXIT0:86 arquivos/1.024 casos, pasta Inbox inteira + paineis-tags + guardas botões85/estados-vazios/paginação/paleta/contraste/tipografia, w1/heap1024/sem filtro de caso/skip novo. Não é global. Lint10 572c9b EXIT0 --max-warnings=0.

Integração ampla do recorte terminou na MESMA sessão60306/chunk31a78a EXIT0:55 arquivos/699 testes,2677,49s, testes2652,87s, sem filtros de caso/skips no resumo. Inclui src/server/whatsapp/consultas-inbox.aria.int.test.ts e pastas src/server/inbox/src/server/aria, configuração original/w1/heap1024/fileParallelism=false, uma suíte por vez. Lease ci-integracao devolvida explicitamente ao ROOT após terminal; nenhum outro SQL/INT será iniciado pelo DEV. Testes usam fixtures descartáveis e fronteiras simuladas existentes. Não houve DB fora da lease, SQL de escrita manual, cluster/install/generate/schema/env/servidor/build/browser/HTTP externo/push/PR.

## Pendências e decisão de escopo

QA independente, TSC/global/lint originais da composição, build/CI e visual permanecem do integrador/TESTER. Visual1440×900/1024×768/390×844 nos dois temas deve comprovar Detalhes sem bloco duplicado e cabeçalho/cartões/handoff presentes. Não declarar issue/E3 homologada antes desses gates. D1–D4 são decisões humanas aprovadas, mas permissões/pacotes/edição/MANUAL/cancelamentos357/interruptor continuam nas extensões próprias.

## Fechamento e provas

Durante a espera, ROOT autorizou diagnóstico único somente leitura, executado em transação SET TRANSACTION READ ONLY e desconectado no finally:8a13ca EXIT0, snapshot14:30:17UTC. Havia uma conexão ativa, sem wait_event/type, consulta3,413565s, zero bloqueadores e nenhum lock agregado no segundo instante. Nenhum SQL/bind/segredo foi persistido; não houve cancel/terminate. Diagnóstico não foi usado como substituto do terminal nem para reduzir cobertura. Avisos MIXED_EXPORTS/vite-tsconfig-paths da configuração original preservados, sem alteração para ocultá-los.

Após a INT terminar, retirada também a condicional/wrapper secaoDetalhes que ficou órfã ao remover PainelAria, conforme pré-revisão ROOT. Só limpeza de UI; backend literal à fonte da integração. Replay focal6430fe EXIT0:5 arquivos/158 testes de InboxNovo/interação, PainelAtendimento.aria, PainelContato e AbaDetalhes. Lint do wrapper7e4432 EXIT0 --max-warnings=0. Sem repetir55arquivos por alteração estritamente visual coordenada. Adaptação anterior de nomes/fixture das identidades remanescentes:105/105630f4e e lint915fd4 EXIT0. O teste anterior de irmãos foi ajustado porque um irmão deixou de existir; as asserções de montagem única/key não nula/mesma key no SSE/troca de identidade por atendimento continuam sobre AcoesContato, além das guardas de formulários existentes.

Novos achados residuais das revisões #431 (combinações de filtros) e #434 (cartões após404) foram confirmados posteriormente pelo TESTER e atribuídos pelo ROOT a commits separados. Não estão corrigidos nem mascarados nesta #353. Não usar aria.podeDecidir como autorização de todo cartão: o produtor continua filtrando por lead da ação. Fonte desta feature não altera esses comportamentos herdados.

Comando INT efetivamente executado: node --max-old-space-size=1024 node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts src/server/whatsapp/consultas-inbox.aria.int.test.ts src/server/inbox src/server/aria --maxWorkers=1. Saída terminal31a78a0 e logs originais preservados; não é integração global do repositório. UNIT86/1024 também é recorte, não global. TSC/global/build/CI/QA/visual continuam pendentes do integrador, sem reatribuir gates de outras fontes à353.