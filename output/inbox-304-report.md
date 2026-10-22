# Relatório DEV A — #304

## Estado

Implementação, gates DEV, revisão independente, aceite visual e regressão integrada concluídos; PR em publicação. Branch `codex/inbox-e0-304`, origem #299 `729a0fe7`, reaplicada na base E0 `797994aa`. Fonte revisada98c76bd4, DEVheadc0b1dd2b. Fechamento e evidências em `output/inbox-304-visual/ACEITE-TESTER.md`; notas abaixo preservam o histórico anterior ao aceite. SPEC: `docs/specs/inbox-rolagem-pagina.md`. Sem merge/deploy.

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

Revisão independente do commit exato e homologação TESTER; regressão global integrada e publicação pelo integrador. Medições não cobrem zoom arbitrário nem viewport menor que as listadas. Não houve build ou suíte de integração de banco neste recorte de geometria. Nenhuma entrega E1 iniciada.

## Gates observados e rebase final

Todos os comandos desta seção usaram Node **22.23.2**, confirmado pelo executável local do integrador. Nenhuma instalação ou mudança de package/lock. Comandos observados até exit; nenhum processo de DEV restante.

### Histórico na fonte inicial 5d44ef3c03087a5624d5b0f5596182611710d0cd

- `vitest run --maxWorkers=2`: sessão **95297**, chunk **1762ec**, saída **0**; **840 arquivos/6480 testes**, nenhum ignorado/todo, duração227,21s. Suíte unitária completa dessa base; não é execução na base E0 integrada posterior.
- `eslint . --max-warnings 40`, sem filtros: sessão **99223**, chunk **c22246**, saída **0**, zero erros/40 avisos existentes.
- `tsc --noEmit`, heap8192: sessão **90264**, chunk **1a3e27**, saída **1**. O servidor3110 havia gerado `.next/dev/types/app/api/inbox/eventos/route.ts`; o validador recusou export extra VIDA_MAX_MS. Rota e exports eram idênticos na base729a0fe7. O integrador corrigiu o pré-requisito Next separadamente (constantes em módulo não-route) e incorporou na baseE0; DEV não removeu tipos gerados para contornar a falha.

### Fonte congelada após rebase 98c76bd486c50251cda8a04430637e52b2eff28d

- Rebase somente do commit304 sobre **797994aaab6f53017b72a808cf0de92abf827ac5**, seis issues publicadas e pré-requisito Next. Único conflito no quadro: preservadas todas as seções existentes e acrescida304. Comparação com5d44 dos quatro arquivos TS304 e do harness de captura vazia: fonte/testes/harness304 invariáveis. Diff de src contra base contém apenas page/InboxNovo e seus dois testes.
- Recorte `vitest run --maxWorkers=2 'src/app/(app)/inbox' src/app/responsivo.test.ts src/app/paleta.test.ts src/app/design-system.test.ts src/app/botoes.test.ts`: sessão **97122**, chunk **635fbd**, saída **0**, **22 arquivos/272 testes**, nenhum ignorado. Os demais testes existentes da nova base também pertencem ao recorte.
- `tsc --noEmit`, heap8192: sessão **37381**, chunk **637f9c**, saída **0**, com o arquivo de tipos Next acima presente. A correção do integrador resolveu o defeito sem alteração da fonte304.
- `eslint . --max-warnings 40`, sem filtros: sessão **93477**, chunk **178b9b**, saída **0**, zero erros/40 avisos existentes, incluindo harnessMJS rastreado.
- Full não repetido após rebase por orientação explícita do integrador: ele executará um único global final na combinação301+304. Não atribuo os840/6480 históricos à nova base. Consolidação posterior restrita a documentação não requer repetir os gates de fonte.
- Capturas DEV pertencem à implementação304 na base #299; TESTER repetirá seu harness independente na base integrada. A seleção de conversa exercita a marcação local de leitura herdada da #299; não é envio nem integração externa. O integrador encerrou seu servidor63856 após a medição final.
