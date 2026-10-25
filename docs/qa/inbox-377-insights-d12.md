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
