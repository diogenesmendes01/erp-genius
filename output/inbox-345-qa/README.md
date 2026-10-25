# QA da #345 — atualizações da Aria em tempo real

A entrega avisa mudanças de sugestões e do estado global da Aria, recarrega lista/painel e preserva o aviso de mensagem quando o React agrupa os eventos. O evento global tem contrato fechado de quatro campos; o acesso aos dados continua nas consultas autorizadas.

- [Parecer independente integral](codigo-2cd.md): commit `2cd984b7`, UNIT/lint e duas execuções de integração separadas, com limites e negativos preservados.
- [Resultados estruturados](resultados-2cd.json): sessões, totais e identidades nominais.
- [Composição](composicao.json): objetos executáveis, base, gates e restauro do banco descartável.
- [Índice](indice.json): bytes e hashes dos dois artefatos acima.

São 14 arquivos/354 UNIT; o barramento passou 26 casos e os cinco arquivos de regressão passaram 48. Os recortes não são somados como suíte global. TypeScript DEV é auxiliar qualificado, excluindo somente dois diagnósticos privados não versionados; o comando original, o lint completo, o build, os dois fusos e a integração global serão verificados no CI limpo antes do merge.

A SQL usa o ID reservado `20261025020000_inbox_aria_tempo_real`; o ID histórico do plano não foi reutilizado. O parecer distingue o SQL Git/LF da cópia Windows/CRLF, sem normalizar os artefatos de origem. Nenhum snapshot, credencial, log bruto, imagem ou executor privado integra este pacote.
