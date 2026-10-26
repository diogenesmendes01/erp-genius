# Integração da nova conversa #361

Base ROOT43913c111e2282001e4c8ebee84c9b48829506ab. Aplicado somente o delta do commit DEV02aab2f339360b89870f4aeca0e8e93ba1ef9bf7, cujo pai é o carry44707639a49ad141e1a97e7a2949076e315bb1dd904. O carry já existia na composição; os ancestrais privados não foram incorporados.

O delta tem17 caminhos,14 em src (três remoções). O único conflito foi o quadro: preservado o histórico ROOT e acrescentado apenas o trecho novo361. Reversão em índice temporário d96321 EXIT0 recuperou exatamente todo o src da base439. Backend, schema, migrações e configurações têm delta zero. A árvore executável antes da documentação desta integração é715f65c579683616195bf9c2bbfe1bd49a7a5416.

Verificação ROOT: sessão90962/terminal8d0b8d EXIT0,123 arquivos completos/1.583 testes,160,07s. Recorte: diretório Inbox inteiro, arquivo completo da API de presença e seis guardas Botões/Campos/FormuláriosPreservados/EstadosVazios/FeedbackSeparado/PaginaçãoDoisSentidos. Configuração original, UTC, um worker/heap1024, sem paralelismo de arquivos, filtro de casos ou novos skips, sete provedores vazios. A primeira tentativa3909d1 parou no preflight por um caminho inexistente de formulário; nenhum teste foi executado nela. O caminho correto foi conferido e utilizado no recorte aprovado.

Lint dos11 arquivos src existentes alterados: sessão63410/terminal91cfc7 EXIT0, zero avisos. Os três arquivos removidos foram substituídos pelos contratos de interação e renderização descritos no QA DEV; não são testes ignorados. Os escopos anteriores do DEV permanecem qualificados no relatório próprio, sem somar execuções repetidas.

Revisão independente exclusivamente estática da árvore715f:657f831ecfb6dd90fe6c4ea4f546aa4de86ffe982225fa731c3b89c0a0b22750, sem bloqueante confirmado. Limite registrado: um callback retido de conversa recente removida pode selecionar um ID antigo; não executa mutação nem evita a leitura/ACL vigente do servidor. Os listeners do teste isolado são simulados; prova real de teclado/foco em navegador continua pendente.

Esta entrega utiliza os destinos existentes e não cria contato ou oportunidade por telefone. D9/#372, escolha de dono, migração500 e saudação manual são uma frente separada. Nenhuma mensagem, chamada a provedor, instalação ou mutação de banco ocorreu nesta integração.

Suíte global e TypeScript completos, lint global, build, execução independente, visual e CI ainda precisam ser concluídos na composição final antes do aceite. A global de1.067arquivos/9.431casos aprovada anteriormente pertence à fonte73d9c2a0, anterior a esta integração.

TypeScript completo na composição a2fdb274: sessão63082/terminalc927d3, CLI EXIT2 (wrapper EXIT1), um único erroTS2352 na fixture PopoverNovaConversa.interacao.test.ts:18. O cast de props omitindo children não representa o contrato obrigatório do diálogo. A fixture passa a declarar o objeto completo com children:null, sem cast, e mantém o filho real no terceiro argumento do React; produção e comportamento dos testes preservados, sem exceção de lint.

Replay da pasta nova-conversa e do arquivo de foco: cdf0b1 EXIT0, quatro arquivos completos/50 casos. Lint do único arquivo ed61d4 EXIT0/zero avisos. A checagem completa ainda precisa ser repetida; essas execuções não aprovam o TypeScript por inferência.
