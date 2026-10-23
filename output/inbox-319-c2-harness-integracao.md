# #319 — composição C2 e harness

Pai #319 2f7b5a0d: produto93a5 e harness congelado do DEV; incorporada a
publicação #317 8aedf1a7, código df9 com C2 7a e documentação c2ec. Conflito
somente no quadro, preservando as duas frentes. Nenhuma lógica de aplicação
foi alterada nesta composição.

Primeiro gate ROOT72124 terminou exit1:57arquivos/624testes aprovados e uma
suíte sem testes executados por SyntaxError ao importar a CLI. TSC44335 exit0.
Node --check e CLI --help passaram. Mesmo blob e versões Vitest4.1.11,
Vite8.0.16 e Playwright1.56.1 no ROOT/DEV B; diferença causal era CRLF no
shebang do checkout ROOT, contra LF no DEV.

Experimento reversível f5deab mudou somente a quebra de linha do shebang e os
4testes de fluxo passaram; finally restaurou os bytes originais, SHA conferido.
Correção restrita: atributo /scripts/visual/capturar-inbox.mjs text eol=lf em
.gitattributes e checkout dessa CLI em LF. Nenhuma regra global, dependência,
package/lock ou lógica da CLI alterada. git check-attr confirmou o alvo exato.

Mesmo recorte após correção, sessão21327 exit0:58arquivos/628testes,15,98s,
sem filtro de nome/skip,maxWorkers2, Node22. Os4testes de fluxo agora executam.
Logs negativos e do experimento permanecem privados e separados do GREEN.

Continuam pendentes: patch isolado nota-protótipo aa5703 da #317, gate global
da #319, QA do commit final e browser/formal42PNG+12mobile, complemento real
com Triagem presente e empacotamento. Provas preliminares472 não são atribuídas
à composição final. C6/#396 continua reservado ao outro chat, sem retry novo
presumido. Nenhum DB, preview, envio externo ou migration neste gate.
