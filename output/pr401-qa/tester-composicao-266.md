# QA independente de composição — PR #401

Fonte exata: `266b180e1fae7c9f5edfb93438e7347d2cb45168`, merge de `7e9883103ed185f6652f1c489f6e891b541a64ec` (#401 isolada) e `9785433ed189be439c6be7ae2b8c5f63164f2843` (#399/#400 composta). Parecer estático favorável à resolução; gates finais de publicação/CI seguem externos.

## Evidência própria

- `git rev-parse HEAD` confirmou o SHA exato, rastreados limpos. Os módulos `AcoesAtendimento`, `CabecalhoConversa`, `MenuConversa`, `estado-visual` e seus testes selecionados são byteiguais ao pai `7e988` (`git diff --quiet`, exit 0). A projeção de estado e o cabeçalho não foram reimplementados no merge.
- `PainelContato`, `LinhaCampo`, backend de painéis, schema/migrações, `BalaoMensagem`, `itens-thread`, alias de preferências e package/lock são byteiguais ao pai `978543` (exit 0). Planos #297, E2E e `.github` também permanecem iguais a esse pai (exit 0); não houve dependência ou contrato QA280 novo na resolução.
- A única resolução funcional própria está em `ConversaAberta`: mantém `useAcoesAtendimento`, `CabecalhoConversa` e o cabeçalho de 68 px de #401; remove apenas `ItemTriagem`/`RevisaoEnvio` e as duas props órfãs conforme #399. O teste do cabeçalho #315 permanece, enquanto o único teste SSR que injetava a prop ignorada de triagem foi retirado. `git diff --check` no recorte `src` terminou 0.
- A triagem real continua nas duas posições de `InboxNovo` por `PainelTriagem`, inclusive a ponte sem seleção; a remoção das props da Conversa não removeu essa experiência. A composição não introduz componentes de estados futuros #319 ou DDL E2.

## Limites

Não executei banco, browser, suíte, TSC ou lint neste merge; o recorte externo da #401 composta foi 10 arquivos/201 testes (sessão 837b4b) e 2 arquivos/5 testes em São Paulo (sessão ceba6d); TSC 40454/5b1118 e lint 85407/521e25 (40 avisos) também são externos, não execuções minhas. A revisão confirma identidade e resolução estática, não substitui a integração final nem CI no head publicado. Não encontrei bloqueio alto ou médio novo. A futura decisão D13 da #409 não foi usada como exigência de `contatos.ver` nesta QA.
