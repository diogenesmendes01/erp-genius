# Relatório DEV A — #304

## Estado

Implementação e medição DEV concluídas; revisão TESTER, gates globais finais e homologação pendentes. Branch `codex/inbox-e0-304`, base obrigatória #299 `729a0fe7faeb7ea918fa0223c58912ff45ef4a37`. #305 preservada em branch separada. SPEC: `docs/specs/inbox-rolagem-pagina.md`.

## Entrega

A página recebe uma coluna flex limitada ao conteúdo real do main, respeitando barra de 57 px no celular e 53 px no intervalo sm..md. Inbox ocupa o resto (`flex-1 min-h-0`) sem o mínimo antigo de 420 px. Formulário (30%), filtros (50%) e cabeçalho de ações da conversa (40%) podem rolar internamente em telas baixas; campos e comandos permanecem disponíveis. Cabeçalho e painel lateral passam a conter geometricamente seus avisos acessíveis absolutos. Nenhuma mudança de capacidade/contrato/SSE, upload, banco, pacote ou lockfile.

## Evidência TDD e recorte (Node 22.23.2)

- RED page/InboxNovo: chunk `9ceafe`, saída 1, 2 falhas e 23 aprovados antes do patch. Novos testes verificam o contrato flex e remoção da altura fixa.
- GREEN page/InboxNovo: chunk `e55971`, saída 0, 2 arquivos/25 testes.
- Recorte Inbox + `responsivo`, `paleta`, `design-system`, `botoes`: sessão `21965`, chunk `88a6fb`, saída 0, 20 arquivos/253 testes, nenhum ignorado. Executado antes do ajuste exclusivo de contexto relativo de avisos acessíveis; globals finais cobrirão a fonte congelada.
- Lint inicial dos quatro TS alterados: chunk `55caf1`, saída 0. Lint dos artefatos revelou um aviso de import não usado no script privado de diagnóstico (chunk `396d3d`, saída 1 com limite zero); removido sem alteração da UI.
- Avisos SSR `useLayoutEffect` de VirtualList são preexistentes e não equivalem a falha.

## Aplicativo real — medições e capturas

O integrador preparou fixture segura no perfil `dev-email` e servidor Node22 localhost:3110, sessão `63856`; DEV não iniciou/parou servidor/cluster e não executou migração. Autenticação de captura via CSRF+credentials local; transportes MOTOR/WHATSAPP/OPENAI vazios. Nenhum segredo, cookie, seed ou log de sessão será versionado.

- Antes: sessão `1147`, chunk `de9b2b`, saída 0: todos os 24 cenários tinham rolagem externa. Métricas antes registram o defeito, sem exigir o estado corrigido.
- Primeira medição depois: sessão `75306`, chunk `379936`, saída 1: os três tamanhos oficiais e 700 px passaram; selecionados em altura500 ainda cresceram (598/599 px).
- Diagnóstico real: chunk `af33c5`, saída 0, isolou texto `sr-only` absoluto no cabeçalho; contexto relativo corrigiu celular (chunk `7ab9fd`, saída 0). Nova rodada sessão `97262`, chunk `56f152`, saída 1 isolou desktop500; diagnóstico `70a550` identificou avisos equivalentes no painel lateral. `relative` no aside corrigiu (chunk `4caf6b`, saída 0). Um diagnóstico inicial teve locator ambíguo (`7f2169`, saída 1), corrigido para região Conversa.
- Final: sessão **99646**, chunk **6b9a75**, saída **0**. 24 cenários: 1440×900,1024×768,390×844,700×768,390×500,1440×500 × claro/escuro × sem/com seleção. Formulário aberto. Documento igual à altura/largura da viewport em todos; zero pageerror, acesso a todos os controles e probes de rolagem interna aprovados.
- Métricas completas e limites da prova estão na SPEC e em `output/inbox-304-visual/{antes,depois}/metricas.json`. Probes adicionam/removem overflow visual temporário porque a fixture contém uma conversa curta; não comprovam paginação de dados extensos. Não há clique em ações de negócio.
- Inspeção visual DEV de desktop selecionado, celular claro/escuro, 700 escuro selecionado e 500px selecionado confirmou rodapé, área de mensagens e campos alcançáveis. O badge de Issues do Next dev é visível e preexistente; não foi suprimido.
- Todas as 48 PNGs antes/depois são preservadas localmente (3,7 MiB com métricas/harness). Versionadas 24 PNGs da matriz oficial completa e três exemplos extras, além das métricas dos 48 casos e harness sem credenciais. O restante fica local para consulta; manifesto em `output/inbox-304-visual/README.md`.

## Pendências e limites

Revisão independente do commit exato e homologação TESTER; integração/publicação pelo integrador. Medições não cobrem zoom arbitrário nem viewport menor que as listadas. Não houve build ou suíte de integração de banco neste recorte de geometria. Nenhuma entrega E1 iniciada.
