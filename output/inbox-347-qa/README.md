# QA #347 — faixa da Aria

A faixa mostra o estado global autorizado e as contagens do resumo fresco da #346, com Gerenciar somente pela capacidade recebida. Não inclui o interruptor global D4 (#359).

Fonte funcional716 e correção canônica287 identificadas no [índice](indice.json). [QA final independente](tester-287-final.md): nove arquivos completos/248 testes, incluindo a guarda integral de botões. [QA histórico716](tester-716-historico.md): sete arquivos/153 testes nominais, sem reatribuição. Cópias públicas sanitizadas somente nos caminhos locais, com hashes originais separados.

ROOT: suíte unitária completa UTC950 arquivos/7.597 testes, TypeScript original sem exclusões e lint integral com zero erros passaram. Os40 avisos rastreados e sete de executores privados preexistentes permanecem qualificados. A tentativa de tipo com4GB terminou OOM; a execução final com8GB terminou0. A primeira unitária foi interrompida após a falha conhecida do link, e o resultado final pertence à sessão92937/655010.

A #346/PR431 é dependência real do estado/resumo consumido; a PR desta faixa deve apontar para a branch dela até sua integração. O workflow rápido só executa para main; CI no head final será gate após retarget. Visual nas três larguras e dois temas, anexos e build permanecem pendentes. Nada aqui declara issue concluída, envio real ou deploy.

O índice usa os bytes publicados nos blobs Git/LF; os hashes privados preservam a representação original. A verificação independente detectou uma quebra final CRLF nas cópias antes do ajuste do índice. Somente o índice foi alinhado aos objetos publicados, sem alterar os pareceres ou seus resultados.
