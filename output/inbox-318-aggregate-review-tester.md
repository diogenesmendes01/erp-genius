# #318 — revisão independente do agregado

Commit exato: `e5941b8c3644370451f3e7a13610cce223adf5c5` (pai `3ec69a93`). **Parecer favorável ao escopo do painel e à exceção de identificação**, condicionado apenas aos gates globais do integrador ainda em execução. Não há novo aceite em navegador deste commit.

## Identidade e alteração nova

- `git diff --exit-code 156d1a6f..e5941b8c` para `PainelContato.tsx`, `LinhaCampo.tsx`, `PainelSetor.tsx`, `src/server/inbox/paineis.ts`, teste de tags e teste visual do painel: exit 0. Os três componentes principais também são byteiguais a `d31f4213`. Portanto o QA próprio da #318 no freeze `156d1a6f` (13 arquivos/138 unitários e 42 PNGs, incluindo caso longo/Aria) se estende somente a esses objetos e contratos visuais.
- A composição `InboxNovo.tsx` difere de `156d1a6f`: contém a leitura automática R6 e a navegação/filtros de #313. Essas mudanças já receberam pareceres específicos; não atribuo ao browser histórico da #318 prova visual desta composição agregada ou nova prova de SSE.
- O último commit `3ec69a93..e5941b8c` muda apenas `src/app/identificacao-registro.test.ts` e quadro. A exceção usa arquivo `InboxNovo.tsx`, tipo `prop`, trecho exato `abaAtiva={abaAtiva}`, alvo `abaDoContato.id`, categoria `nao-registro` e motivo explícito. No código, `abaDoContato.id` tem tipo `IdAbaPainel` e valores fechados `detalhes | oportunidades | insights | atividade`; a prop seleciona a aba, sem expor identificador de registro. A exceção também entrou na cópia literal da lista. Não houve mudança no analisador AST ou na UI.
- O bloco automático de dez linhas do Next em `AGENTS.md`, único diff rastreado ao trocar o checkout, foi conferido e restaurado depois de encerrado o preview anterior.

## Execuções próprias no worktree TESTER

Node 22.23.2, Vitest local, sem filtros de nomes ou skips:

- Painel, LinhaCampo, InboxNovo, ColunaConversas, OptOut e guarda de identificação: **13 arquivos/166 testes, exit 0** (`chunk_id af395e`).
- Tags, visual do painel e guarda de botões: **3 arquivos/99 testes, exit 0** (`chunk_id ebaa3c`).

Não executei banco, browser, TSC nem suíte global neste candidato. O global `25190` e o TSC `85080` foram iniciados pelo integrador e ainda não tinham saída terminal quando redigi este parecer; seu resultado deve ser atribuído a ele e verificado antes da publicação.
