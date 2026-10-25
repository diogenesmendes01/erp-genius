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
