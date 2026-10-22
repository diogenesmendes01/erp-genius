# Relatório DEV A — #306

## Estado e escopo

Implementação e recortes concluídos; globais, revisão TESTER e aceite visual pendentes. Branch `codex/inbox-e1-306` sobre o commit de asset preparado `3eb87ea6c41c27edd10333e89594cd33e3b232af`, que sucede a base E0 fechada `bcc3d27ab007231a08cabe2c3cf9c9b46a151558`. SPEC em `docs/specs/inbox-tokens-fonte.md`. Sem fonte/runtime de CDN, instalação, package/lock, schema, permissão, envio externo ou novo consumidor de UI.

## Entrega

- `globals.css`:8 cores de avatar herdadas no escuro,3 tokens de balão/pontos por tema e `fundo-conversa` em utilities, com comentários de origem.
- `tailwind.config.ts`:cores planas avatar1–8/bubbleIA/nota e pilha mono por variável local.
- `layout.tsx`:JetBrains Mono 400–500 por next/font/local, display swap, duas variáveis no html; Roboto preservada. Asset/licença são o commit prévio do integrador, não foram obtidos/alterados pelo DEV. Hash SHA256 real conferido: `18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e` (chunk 706131, saída 0); licença contém OFL 1.1.
- `contraste-mapa.ts`:iniciais brancas nos 8 avatares. Travas de design-system/contraste/tipografia atualizadas; nenhuma exceção no detector de paleta/contraste, nenhum relaxamento de parser.
- `docs/18-design-system.md`:valores, motivo da adaptação L 0,54 e exceção estreita de radial-gradient para pontos. Fonte continua400–500; mono 600 de contadores futuros fica para task consumidora, decisão expressa do integrador.

## TDD e evidências automatizadas — Node 22.23.2

1. RED: `vitest run src/app/design-system.test.ts src/app/contraste.test.ts src/app/tipografia.test.ts --maxWorkers=2`, chunk **656626**, saída **1**: **9 falhas/33 aprovados,3 arquivos/42 testes**. Falhas por tokens ausentes, mapa/cores/mono ainda não registrados e fundo sem CSS; nenhum erro de parsing de teste. Hash e licença entregues já passaram.
2. GREEN: `vitest run src/app/design-system.test.ts src/app/contraste.test.ts src/app/tipografia.test.ts src/app/paleta.test.ts src/app/contraste-elementos.test.ts --maxWorkers=2`, chunk **dbe6b2**, saída **0**, **5 arquivos/53 testes**, nenhum ignorado/todo.
3. ESLint dirigido a 6 TS (`tailwind.config`,layout,mapa,design-system,contraste,tipografia), `--max-warnings 0`, chunk **9b5a8c**, saída **0**, sem avisos.
4. O teste de CSS compila globals+config reais por PostCSS/Tailwind local com content raw contendo todos os utilitários:confere background de cada avatar/balão, pilha mono e imagem/intervalo de pontos. Não depende de classes ainda não consumidas no aplicativo e não adiciona safelist global.
5. Contraste com o núcleo existente:nos dois temas,8 avatares+branco >=4,5, autoteste com avatar8 mais claro reprova; textos primário/secundário nos4 balões e autores IA/nota/humano passam 4,5. Valores congelados em hex/rgba preservam parser fechado.

## Visual e limites pendentes

- A task registra tokens e fonte; ainda não redesenha lista/avatares/thread. Comparativo app×protótipo aguardará o harness #307 (desenvolvido em paralelo por DEV B).
- Ao liberar ambiente, verificar nos dois temas a variável avatar4=#6e62aa, os demais tokens, carregar a família real via document.fonts.load e renderizar elemento mono temporário. Não basta document.fonts.check sem família real, nem presença da variável.
- Amostrar usos de font-mono existentes fora Inbox (códigos/hash/templates), pois o mapeamento é global. Contadores600 futuros não foram corrigidos nesta issue.
- Registrar capturas nos3 tamanhos/2 temas com amostra explícita das classes e manter evidências app/protótipo identificadas. Nenhuma captura ou homologação é presumida pelo GREEN unitário.
- Globais somente na janela do integrador, com sessões observadas até exit. Sem servidor ou suíte de integração de banco iniciados pelo DEV.
