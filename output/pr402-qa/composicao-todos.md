# PR #402 — busca na conversa e comentários

Fonte6aa08b37e673a23eca0104ab205d7e8252a53d2c, pais7fdb52ed (patchf94 isolado sobre a8dba58c443ff24be4745e51aab47abed9c4cf2a) e4014b9b1a5a. Um conflito do quadro manteve ambos os lados. O restante incorpora correções398/399/400 e contratos401 sem alterar o hook da busca ou desfazer o Pick do cabeçalho. Nenhuma feature317/319/E2 foi antecipada.

C1 HIGH e C6 LOW: composição local preserva main/QA280/planejamento297/B2 e os pais; publicação aguarda401main e CI final em dois fusos. C2 MEDIUM: a correção7a825062 de scroll manual/RAF/pin/intenção permanece byte idêntica no hook e teste (9e9ad0a3 e8c129061). Nenhuma rolagem ou foco automático adicional foi introduzido. C3 LOW: Ctrl/Meta+Shift+F ficam disponíveis ao navegador; Ctrl/Meta+F simples continuam abrindo a busca regional. C4 LOW: SPEC descreve os contratos existentes e o teste de campo controlado/ref/callback. C5 LOW: inventário e curadoria dos artefatos permanecem, com capturas históricas atribuídas às fontes corretas.

## Gates próprios

- Recorte d55b9b, terminal0:12arquivos/176testes, America/Sao_Paulo, maxWorkers2, sem filtro de caso/skips novos. Inclui cinco arquivos de busca, Conversa, interaçãoInbox, cabeçalho, VirtualList/estabilidade e guardas visual/dependências. Não é global, DB ou browser.
- Next typegen/TypeScript30533/f27cd4 terminal0; lint global79500/513ce0 terminal0, zero erros/40avisos herdados.
- Asserções cbe748/fd06f8 confirmam as fontes de busca iguais ao patch7f, o estado visual/Pick iguais401, thread398/alias400/deps/schema iguais ao pai composto401. Conversa incorpora apenas a remoção de props/importtype órfãos399, já validada no pai401.

QA independente do patchf94 favorável: sete arquivos/40testes por fuso, executados pelo TESTER em dois recortes; original SHA256 2b6b61b7b1d8b09a526d721cad6333ae6da65bd4a352d97a95c90a87e6dc85ce, cópia tester-patch-f94.md com EOF normalizado. Não é uma execução no head6aa.

QA composta, squash401/main e CI final ainda pendentes. Global894/6.987 e capturas316/C2 pertencem às fontes nominais históricas; não houve nova captura, DB, migração, instalação, seed, envio ou deploy.
