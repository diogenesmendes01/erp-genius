# Evidência visual curada — Inbox #325

36 PNGs originais: 30 formais (18 da aplicação e 12 referências) e seis complementares da aplicação em 320×500. Fonte APP: `ddf872e13078fb48c7648da9c2fc48b1d3f29438`. Harness: `96c9e60752b3c1951922a745cee89045b4597ace`. Todas foram inspecionadas individualmente pelo DEV. QA independente, CI e publicação permanecem pendentes.

O lote L1 (`74891/eb2985`) permanece EXIT1: foram selecionadas por arquivo suas 18 imagens APP sem falhas, após auditoria dos GETs e fechamento do browser. A primeira referência foi recusada sem PNG. O lote L2 (`18441/ba4c36`) terminou EXIT0 com 12 referências e seis APP320. Fontes, hashes, bytes e dimensões estão em `manifesto.json`. A seleção das imagens não reclassifica L1 como uma execução aprovada.

As referências comprovam somente o painel visual estático. O erro herdado de `componentDidUpdate` sem `prevState` interrompe `toBottom`: não comprovam autoscroll, posição da thread, foco, comportamento após seleção ou aceite funcional. A exceção foi restrita à mensagem e aos callsites originais, com hashes verificados. APP e guardas953 permaneceram sem exceção. Convidado tem N/A funcional de autorização por convite.

As complementares em 320×500 mostram rolagem interna real e documento/rótulo contidos. Uma linha posterior pode aparecer parcialmente na borda inferior; o painel inteiro exige rolagem. Dados fictícios LATAM, valores totais em CLP e o rótulo Documento da empresa diferem dos exemplos BR/mensais da referência. CPF/idade e abas futuras não foram antecipados.

Seis probes reais somente leitura (`53179/a656b7`, EXIT0) confirmaram Funil, ficha do contato, empresa, Admin A/B e leitor A com HTTP200/enviofalse e B com HTTP404/sem link. Tab e Control+Enter abriram duas páginas distintas por contexto. SSE: duas aberturas sequenciais por página, máximo uma simultânea por página; não se afirma uma conexão única para as duas abas. Os alvos A/B não têm lead; a chegada comprova thread autorizada e ausência legítima de oportunidade.

O executor nominal dos probes, preservado byte a byte, usa skip explícito de about:blank e router por origem exata http://localhost:3111. Todos os destinos executados foram internos. A versão futura com guard do init por origem exata tem outro arquivo/hash e não foi executada nem atribuída a esta prova.

Nenhum Save, Assumir, Aria, nota, envio ou CRUD foi executado. Houve 99 chamadas das duas ações automáticas autorizadas de leitura/compositor nos cenários positivos e probes. Todos os contextos/browsers foram fechados. ROOT parou o preview e restaurou 424 hashes/498 linhas do snapshot (`ae152c`, EXIT0). O bloco Next gerado de AGENTS foi removido sozinho após esse stop, preservando as instruções originais.

Este ZIP contém apenas 36 PNGs e dois documentos curados. Não contém credenciais, cookies/headers, logs ou respostas brutas, probes, scripts ou fotos rejeitadas. Imagens e ZIP permanecem privados até publicação pelo integrador.
