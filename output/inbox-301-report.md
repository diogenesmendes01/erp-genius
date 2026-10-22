# Relatório DEV B — #301

Estado em 22/10/2026: implementação em revisão. Branch `codex/inbox-e0-301`, criada sobre o commit congelado #300 `9853be8356f6a31664224d5b9b332ce108bcac06`, rebaseada sobre o HEAD publicado `30706754ae9b67ee6a37c40da6272212ed242b23` e depois sobre a base E0 integrada `797994aaab6f53017b72a808cf0de92abf827ac5`. O primeiro rebase teve conflito apenas no quadro, resolvido com ambas as seções; o segundo não teve conflito. SHA de código anterior à base integrada `4803b06100b6907968304ffddc11cd7da9fbeab4`.

## Entrega

- `fonteErp` preserva as notas da rota; `HistoricoConversa` mantém `null`/ausência e substitui por arrays, inclusive vazio. Abertura/troca limpam estado, resposta de geração anterior não vaza. Aviso `atendimento.atualizado` atualiza notas mesmo com página sem mensagens novas.
- `itensDaThread` mescla por horário e id com mensagem antes de nota no empate, chave `nota:<id>` e janela delimitada pela mensagem mais antiga. Notas não afetam cursores nem o limite de 600 mensagens.
- `NotaNaThread` renderiza conteúdo interno, origem, autor, texto escapado com quebras e hora no fuso. `ConversaAberta` usa a mescla e não oferece comandos de mensagem à nota. Não houve alteração em `InboxNovo`, schema, permissões, dependências ou transporte.
- SPEC `docs/specs/inbox-notas-visiveis.md` e quadro único atualizados.

## Evidência até agora

- RED funcional: 4 arquivos, 5 falhas esperadas / 35 testes verdes, saída 1. RED de janela fora de ordem: 1 falha / 4 verdes, saída 1. RED da paleta: 1 falha / 318 verdes, saída 1.
- GREEN dirigido Node 22.23.2: `src/components/conversa`, `src/app/(app)/inbox`, paleta, botões e contraste, 29 arquivos / 319 testes, saída 0, nenhum ignorado. Cenário adicional de duas sessões, 1 arquivo / 16 testes, saída 0. Recortes não são suíte completa.
- Recorte dirigido final com o cenário adicional: mesmos filtros, 29 arquivos / 320 testes, saída 0, nenhum ignorado. ESLint dos 9 TypeScript alterados com `--max-warnings 0`, saída 0.
- Mesmo recorte repetido no SHA pós-rebase: 29 arquivos / 320 testes, saída 0, nenhum ignorado, Node 22.23.2. Não se inferiu execução nova do lint por rebase exclusivamente documental.
- Gates globais no SHA documental `09222757` (fonte idêntica a `4803b061`), Node 22.23.2: TSC `--noEmit` heap 8192, sessão `23074` até saída 0; Vitest sem filtro `--maxWorkers=2`, 842 arquivos / 6.490 testes, sessão `54811` até saída 0, nenhum ignorado; ESLint global `.` com `--max-warnings 40`, sessão `96249` até saída 0, 0 erros / 40 avisos herdados.
- Rebase dos três commits #301 sobre E0 integrada `797994aaab6f53017b72a808cf0de92abf827ac5` sem conflito; delta contra a base contém só os 12 arquivos #301, e o quadro das demais issues permaneceu. No SHA `33d0a99174bc2d00601ad91b08037bc3eac4a74b`, Node 22.23.2: recorte dirigido com os mesmos filtros 32 arquivos / 354 testes, saída 0, nenhum ignorado; TSC heap 8192, sessão `26262`, saída 0; ESLint global `.` com `--max-warnings 40`, sessão `26917`, saída 0, 0 erros / 40 avisos herdados. O full da combinação #301 + #304 ficará com o integrador e não é atribuído a esta execução.

## Pendências

Vitest completo da combinação #301 + #304 pelo integrador, revisão TESTER e aceite manual/visual em duas sessões nos três viewports e dois temas. Sem instalação ou envio externo.
