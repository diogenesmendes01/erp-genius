# QA DEV — #377 Insights D12, fase pura

Base c2b77326069bee1d48b1688233dd20e0b4f85fc1 + cherry-pick de32c1 (fixture de composição) em1f0d9d51. Não é entrega completa, homologação ou base pública. HEAD anterior0b5a e refs63b/f347 preservadas. AGENTS histórico excluído.

## Evidência terminal observada

- Saída RED b1dd8e EXIT1:18 falhas por funcionalidade ausente; GREEN6d049c EXIT0:18.
- Contexto RED13666e EXIT1:7 falhas; combinado0f1402 EXIT0:2 arquivos25 testes.
- Prompt RED570bd5 EXIT1:3 falhas; ecd5d5 EXIT0:3 arquivos28.
- Contraprova de fronteira365b5f EXIT1:1 falha/3 controles, campos extras de objetos maiores vazavam para o prompt. Corrigido por projeção fechada dos campos e mensagens; ed0624 EXIT0:3 arquivos29.
- DTO RED012367 EXIT1:6 falhas; GREEN5b3415 EXIT0:4 arquivos35.
- Final após imports estáticos e fixture tipada: ab6019 EXIT0,4 arquivos/35 testes, original Vitest UTC,w1,heap1024, sem filtros por nome nem skips. Recortes anteriores sobrepostos não são somados. Aviso preexistente vite-tsconfig-paths observado, config preservada.
- Lint inicial6 arquivos a73b0d EXIT0, zero warnings; lint final8 arquivos189741 EXIT0, zero warnings.

Logs privados output/inbox-377-*.log; nenhum prompt/segredo/resposta real gravado. Hashes de schema/package/provider/Compositor/AGENTS preservados em output/inbox-377-pins-fase-pura-private.json. Nenhum SQL, API real, instalação, geração de client, TSC/global/build nesta fase.

## Pendências obrigatórias

Revisão ROOT do contrato claim/INCERTO/descarte/late-cost, reserva/preparo schema493, kernel/persistência nativa e custo/replay/ACL sob espera; provider deadline opcional ainda só proposta; DTO produtor/rota, UI/hook com portas, confirmação rascunho e consumidores358, testes DOM/guardas completos, blueprint visual aplicado por lease futura, TESTER independente, gates originais/CI/build/visual. Não marcar concluída pela fase pura.

## Checkpoint UI e hooks locais

Sem integração de aba ou consumidores compartilhados. Gerador e inserção de rascunho usam portas fake; React DOM e ConfirmarAcao são reais.

- Primeiro negativo do hook 2f8356 EXIT1 foi erro do harness (criarDomMinimo retorna documento dentro do objeto). Corrigido antes do RED causal 13e8f5 EXIT1: 12 falhas por hook ausente. GREEN 6c8099 EXIT0: 12 testes.
- SSR RED e6a45c EXIT1: 8 falhas; GREEN f0bead EXIT0: 8 testes.
- Rascunho RED 7ac18c EXIT1: 12 falhas por controle ausente; GREEN 8e24b0 EXIT0: 12 testes.
- Adversarial 48665e EXIT1: um bug real permitia handler antigo após cancelar/reabrir; outra falha era expectativa incorreta da mensagem canônica do teste. Correção usa token por pedido e a constante canônica no oráculo, sem mudar o componente global. Combinado 344fe0 EXIT0: 7 arquivos, 69 testes.
- Guardas nominais completas: sessão 97036, terminal 143fdc EXIT1, 5 arquivos/294 testes, 290 passaram e 4 falharam por registros novos ausentes (botões, vazios e mapa central). Somente entradas exatas foram acrescentadas, com semântica e negativos do mapa de sentimento; nenhum parser/exceção foi alterado.
- Final sessão 66794, terminal b69a66 EXIT0: 12 arquivos/365 testes (5 guardas completas + 7 arquivos puros/UI). UTC, um worker, heap 1024, sem filtro por nome/skips.
- Adicionais sessão 77403, terminal b0d5e5 EXIT0: 10 arquivos/199 testes completos: paleta, fundo, confirmações, ações-cliente, identificação, campos-texto, rótulos, rótulos-domínio, EstadoVazio e ConfirmarAcao. Não são suíte global nem homologação visual.
- Lint dos 10 arquivos alterados na fase UI: acba52 EXIT0, zero avisos, heap 1024. Aviso Vitest preexistente sobre vite-tsconfig-paths permanece separado.

Registro compartilhado restrito: mapa SENTIMENTO_INSIGHT_LABEL, dois botões e três estados vazios exatos, mais registro/semântica/negativos desse mapa em enums-rotulos. Compositor, scheduler, provider, schema, configuração e dependências permanecem intactos. A proteção do campo físico e o mesmo texto no scheduler ainda dependem da bridge real; não são cobertos por afirmação do harness local.

## Checkpoint schema e transporte opt-in

Infraestrutura executada pelo ROOT, não pelo DEV: validate 7fa01e EXIT0; generate sessão 60407/36d375 EXIT0, client72b4825a61e5e3ad098e11155fc19624f37eb3106e52a2d9177323b96050f70c; DDL493 a9216d EXIT0 somente dev-email; backup e98b31 EXIT0 com 425 tabelas/hashes e 559 linhas. Bancos e clients ROOT/B/TESTER continuam na versão492/647. Restaurador A é exclusivamente o493 do integrador; nunca reutilizar492 no A.

Schema fonte SHA257b91c3772970ad6d2c16b50172c4ccc205a40a4d055533f2de374f737010a2; SQL SHA241ee9fb0740a80ae902cf70aec2a2bf9674e44aa29cbeca5bf31049420e5b1c. O integrador confirmou aplicação e preservação da baseline, não testes funcionais do kernel. Nenhuma suite SQL do DEV foi autorizada ou executada nesta fase.

- Envelope inicial RED cf8c0c EXIT1: 13 falhas; GREEN e885aa EXIT0: 5 arquivos/48 testes. Usage ausente/parcial/inválido permanece desconhecido, sem custo0 fictício.
- Provider opt-in RED c0c2c4 EXIT1: 18 falhas e 2 controles, 20 testes. GREEN 580fd9 EXIT0: 20.
- Contraprovas de corpo/modelo 75d404 EXIT1: 4 falhas/21 controles, 25 testes. Corpo inválido perdia uso conhecido, modelo divergente não era identificado, modelo inválido anterior ao envio não tinha fase e erro de JSON era classificado como transporte. Corrigidos somente no caminho opt-in.
- Pasta completa de providers: sessão50551/253ff3 EXIT0, 6 arquivos/78 testes. Casos legados e novos foram executados, incluindo retries e bytes do payload, sem rede real.
- Origem INSIGHT: RED 3c000e EXIT1, 1 falha/2 controles; GREEN 561f2d EXIT0 em recorte sobreposto de 7 arquivos/77 testes, incluindo teste semântico exato das seis origens.
- Envelope do modelo observado: RED 7b79a7 EXIT1, 5 falhas; GREEN c74b87 EXIT0, 6 arquivos/53 testes. Ausência de diagnóstico, modelo ausente/divergente e usage parcial não são reparados com campos legados.
- Preços snapshot RED ab5f1b EXIT1, 7 falhas; GREEN 495bd6 EXIT0, 7 arquivos/60 testes. Dois controles adicionais comprovam tabela histórica independente e custo fora do Int persistível sem registro0.
- Final sessão8168/c0764f EXIT0: 14 arquivos/144 testes completos (providers, contratos puros e autoria). UTC, um worker, heap1024, sem filtros por nome ou skips. Não somar os recortes sobrepostos acima.
- Lint final dos 10 arquivos alterados: 6a96ef EXIT0, zero avisos. Sourceproof confirma chamarComRetry legado literal ao checkpoint85c, normalizando somente EOL. O formato do retorno e a chamada de um argumento dos consumidores sem controle foram testados.

Técnicas e pendências: versão/modelo/preços e metadata da base são contratos internos propostos/aprovados; nenhum endpoint recebe envelope/custo do browser. O custo tardio com ACL revogada, replay transacional, concorrência e rollback ainda exigem kernel e SQL nativos. A aba real, reconciliação/descarte UI e bridge/scheduler permanecem pendentes. Testes HTTP são fake; não houve chamada externa, leitura de chave real, instalação, build ou TSC global do DEV.

## Checkpoint kernel privado — 25/10/2026

- Pasta original completa src/server/aria/insights: b500a7 EXIT0, 17 arquivos/155 testes, UTC/w1/heap1024, sem filtro por nome/skips. Recorte backend somente, não suíte global nem SQL.
- Lint whitelist25 arquivos: negativo fc7b18 EXIT1 por Function no double/catch não usado; corrigidos, replay797242 EXIT0/zero avisos.
- Leitura RED ed94eb EXIT1/8 falhas; rebind pré-start11188e EXIT1/1 falha8 controles; final leitura+controlador702a80 EXIT0/2 arquivos17 testes. GETterminal PRONTA/FALHOU/RECUSADA é leitura, não reconciliação automática.
- Orquestrador inicial tinha sete falhas por módulo ausente e um unhandled do próprio double; esse erro de instrumentação não prova bug produtivo. Double corrigido sem chamar implementação na preparação e resetado entre casos. Diagnóstico knownusage: RED09ac81 EXIT1/1 falha7 controles; primeira correção1b870a teve erro local ReferenceError, preservado; replayf49d4e EXIT0/3 arquivos26 testes. Não somar recortes sobrepostos.
- Núcleos claim/start/finalização/operacional têm doubles DB-aware e testes de ordem/CAS/shape, não prova SQL de locks/concorrência. Os REDs anteriores e controles estão nos logs privados. Testes PostgreSQL ainda serão escritos/executados no perfil493 após review/lease ROOT; não atribuir RED causal nativo retroativo a testes pós-implementação.

Plano nativo entregue no output/inbox-377-preflight-nativo-plano-private.md: invariantes exclusividade/START, budget/config, ACL/binding frescos, custos/ACKlost/late/reconcile/discard, barreiras reais, pool1, NOTIFY commit/replay/rollback. Nenhuma lease SQL pedida/executada neste checkpoint. Endpoints/aba, UI operacional completa e bridges continuam pendentes. Schema/SQL493 e client permanecem congelados.

### Autoria nativa posterior ao checkpoint (ainda não executada)

Quatro arquivos .int.test.ts, 24 casos previstos: kernel12, concorrencia6, pool1 dois, notify quatro. Fixtures/instrumentação exclusivas377 em src/test/inbox-insights.ts e inbox-insights-observacao.ts. Lint desses6 arquivos19bc84 EXIT0, zero avisos; isso não executa nem valida comportamento SQL.

Barreiras usam Client pg real, holder e observador separados, pg_blocking_pids e snapshots autocommit. Papéis/ativo/binding são alterados no holder antes do commit; finally libera holder e acompanha tentativas. KEY SHARE é retido até assertar conclusão, sem alegar ausência geral de deadlock. Pool1 usa PrismaClient próprio connection_limit1 e trap somente da abertura de TX global; queries/locks/ACL continuam reais.

NOTIFY usa LISTEN real em inbox_eventos, conta entrega após commit e verifica replay0/rollback0. Rollback é injetado após callback real da TX, explicitamente instrumentação. ACKlost simula exclusivamente perda da entrega após COMMIT PostgreSQL real: uma ou duas finalizações perdem ACK, provider é fake e invocado uma vez, Chamada/Evento/aviso devem permanecer únicos; GET posterior resolve PRONTA mesmo quando a resposta do orquestrador é NAO_CONFIRMADA. Esses testes foram escritos depois do kernel, sem RED causal nativo retroativo.

Nenhum dos 24 casos foi executado nesta autoria. Execução depende de revisão e lease ROOT493. Não foi criado wrapper público só para fixture. Aba/bridge/endpoint continuam pendentes; produção literal8364385f.

### Revisão independente: descarte operacional após Pessoa incompatível

Achado T/ROOT procedente: leitura operacional INCERTO oferecia emCurso.podeDescartar=true, mas o DTO reutilizava capacidade de geração e devolvia painel.podeDescartarIncerta=false. RED b03079 EXIT1:2 falhas/15 controles em DTO+leitura. Capacidade operacional separada e explícita no produtor; gerar/análise continuam negados com Pessoa incompatível. GREEN24c38f EXIT0:2 arquivos18 testes, UTC/w1/1024, sem filtro/skips; lint5 18cc09 EXIT0/zero avisos. Acrescentado controle negativo da própria capacidade operacional.

Novo caso PostgreSQL autorado exige ambos sinalizadores true, gerarfalse/análisenull após retarget incompatível e descarte real; ainda NÃO executado. Autoria nativa passa a25 casos previstos (kernel13+conc6+pool1dois+notify4). Schema257b91c/SQL241ee9/profile67580e/AGENTS0544fa preservados; nenhum SQL/endpoint/bridge nesta correção.
