# QA offline #327 — curadoria e handoff mínimo

Curadoria favorável no commit documental exato fd6ea6594f8e926458c3c7ee5afd6f291f1692a2. O ZIP corresponde às 18 originais individualmente certificadas, com proveniência e limitações corretas. O manifesto de fonte é fiel como inventário de hunks; NÃO é um patch integral pronto para aplicação. Rejeito portar a linha antiga de aquisição Detalhes que regrediria a #420 e qualquer reversão de Main fora da whitelist. A exclusão já está expressa no próprio handoff. Não compus, apliquei ou executei a fonte integrada.

## Artefatos e ZIP

Report A inbox-327-entrega-curadoria-handoff.md: 6.725 bytes/SHA a1320057d5bc4f0b3a9ed86950cddb4f6c64216c5066c2e3bc366ffc1aeb11cf. Manifesto inbox-327-fonte-handoff.json: 40.940 bytes/SHA b8ed650ca549f8deea2a82a43fce9d24fb9529176c691d53aa08ac00ce5da309. Conferi os dois arquivos físicos contra os blobs do commit fd6. Esse commit altera somente quatro MD/JSON; SRC, scripts/harness, Prisma e dependências permanecem idênticos a cfa243291d154b445e1dec83f52604589f42a58e, com APP runtime EBF.

ZIP inbox-327-evidencias-selecionadas-v1.zip: 1.935.721 bytes/SHA 2e06d8551647a73f4e8760c31c09b5767cc5de15e4d6b5a7a739c2f33fd53994. Exatas 20 entradas únicas: 18 PNG + README.md + manifesto.json. Sem diretórios absolutos, traversal ou arquivo extra. CRC ZIP 20/20 e CRC de cada chunk PNG 18/18 conferidos pelo Python padrão instalado, sem instalação. Os 18 PNG somam 1.911.161 bytes e correspondem byte a byte aos originais das minhas QA anteriores; bytes/SHA/dimensões/fonte/executor foram confrontados por arquivo. Não houve crop, regravação ou edição de imagem.

Manifesto interno: 18.628 bytes/SHA 50c17226bc31cd64727c568bbe49ea2e5ab8c34210022cc465bb2dd40605d65b. PNGs contêm apenas os tipos de chunk declarados, sem tEXt/zTXt/iTXt/eXIf; múltiplos IDAT legítimos foram verificados individualmente por CRC. README e manifesto preservam as qualificações e não contêm raw, logs, env, cookies, credenciais, CSRF, nonces ou IDs de Page/contexto/run. Os hashes de fonte/executor e o nome do lote são proveniência técnica, não identificadores de runtime removidos.

Representativa inbox-327-representativa-v1.png: 164.617 bytes/SHA 09f69eb67ab4326b7db8f4e2b1bc0fcaa4c3341e54d5b88f2f028ddd7a548224. É byteigual à A7 claro/desktop do ZIP e ao meu original já certificado. Abri novamente essa representativa em resolução original; continua nominal A7/9480, não uma captura cfa ou fonte integrada. As outras 17 originais já tinham sido inspecionadas individualmente nas respectivas QA; nesta revisão reconferi seus hashes, sem fabricar nova inspeção visual ou operação.

Verificação própria do ZIP: cca940 EXIT0. Meu primeiro parser ed6edb comparou a sequência completa de chunks à lista de tipos únicos do manifesto, falhando em PNG com IDAT repetido. Preservei o verificador negativo e corrigi apenas essa interpretação, mantendo CRC de todos os chunks. Nenhum ZIP, PNG ou manifesto original foi alterado; não é falha de produto nem dispensa de metadados.

## Corpus e status históricos

Grupos exatos: seis APPadmin A7 nominais HARNESS 9480; seis referências PROTO A9 nominais be45; seis APPleitor A11 nominais cfa. APP comparado é EBF. Não é um run18 novo de um único executor. A7 e A9 agregados continuam EXIT1; somente suas seleções individuais certificadas entram. A8, A10 e todos os diagnósticos permanecem negativos e fora do ZIP. A10 fornece zero PNG.

O reuso A7 continua qualificado por congruência de fonte/produtor/fixture. As fotos antigas NÃO mediram nativamente os novos checks de href/slot/fronteira; não se retroaplicam selos ou valores DOM. Badge Next cobre parte do link mobile A7, sem prova fotográfica integral desse link. PROTO tem fixture, valor e etapas diferentes, referência estática legítima, sem provar foco/autoscroll/seleção ou toda função desenhada. Nada disso é convertido em entrega da UI #328.

Os seis leitores A11 têm meu parecer operacional/visual de 10.927 bytes/SHA afd86c4a81fa30bbed390d3f89bc0b8912d45846a8a78629a32044fb095f3ac8 e allowlist de 16.193 bytes/SHA a869150df34f015b313c4ea0263803df6358030c47fc9461e0d17d7c632daa4a. Conferi as referências no manifesto curado. São seis PNG novos positivos, não reuso de A10 ou diagnóstico. Os históricos mantêm seus pareceres/allowlists e executores próprios.

As métricas A11 são preservadas sem reatribuição: UI 17 Detalhes + 6 Oportunidades = 23, separada de 42 chamadas API preparatórias; auditoria de rede 290 registros = 284 não-SSE + 6 SSE. Três incidentais por Page/18 POSTs incidentais no lote, além de autenticação; zero Save/etapa/perda/nota/envio. A11 teve seis contextos/browsers fechados, core/rede/SSE positivos após browser, pendentes/handlers zero. SSE 1 START/1 terminal real por Page, ERR_ABORTED com Page viva antes de context.close; dois objetos históricos/uma ativa antes, zero depois, máximo simultâneo um. Essas provas nativas não foram repetidas na curadoria.

## Fonte e isolamento do porte

Baseline do inventário: PR420 HEAD 179b6919a08cc70fdd078488a0c531395501d1b8; fonte cfa. Verificador próprio de Git, sessão 40905/terminal d569ba EXIT0: os 45 paths têm OID baseline/fonte, SHA256 do diff -U0 e todos os cabeçalhos de hunks exatos. Grupos: cinco runtime novos, nove compartilhados, cinco testes novos, sete testes por hunks, oito fundação mínima #328, oito harness novos e três harness compartilhados. Nenhum path da whitelist invade a lista de não portar.

Os oito paths marcados semDelta420Preservar são realmente idênticos: produtor Detalhes, permissões do painel, hook useAbaPainel e seu teste, GavetaContato, etapas CRM e duas regressões Funil. Não precisam ser reimportados. O editor e R1/Retry/foco da #420 são dependência existente, não conteúdo antigo a substituir.

Há reversões concretas na história agregada A fora da whitelist: Compositor e teste, ConversaAberta, SinoNotificacoes, notificações, labels, whatsapp/acoes, acoes-conversa, sessao e guardas. Seus OIDs divergem da #420 e estão excluídos. O inventário não autoriza copy-all, reset ou cherry-pick da história A. Main atual deve conservar #337/menções/Sino, #418, #423, #343 e demais funcionalidades que não existem naquela base antiga. O manifesto compara a baseline explícita, não garante paridade automática com Main futuro.

Hunk recusado para aplicação literal: InboxNovo da A usa detalhesComerciais && (abaDetalhes || editorAberto). A #420 usa (detalhesComerciais && abaDetalhes) || editorAberto. Com finalidade não comercial e editor aberto, o destino correto resulta true e a linha A resulta false; impediria a aquisição necessária ao editor. Preserve a expressão OR da #420 e acrescente o hook Oportunidades separadamente, sob demanda comercial. O handoff identifica essa exclusão expressamente. Não se muda o produtor #326 para satisfazer o source antigo ou sua captura comercial.

Demais deltas compartilhados são justificados por #327: dispatcher/aba entregue Oportunidades; callback do cartão contextual em AbaDetalhes com fallback link e B2B/hrefs preservados; podeAbrirFunil derivado de funil.ver no servidor, separado de moverEtapa e visibilidade D13; estado de modal por thread/oportunidade/sessão, CAS e ACK antigo; inventários de botões/campos e exceção técnica exata. Preservar todos os registros Main nos mapas e testes, incluindo labels/guardas de outras issues; copiar apenas os acréscimos necessários. O tabpanel continua contendo todos os slots; o harness atual delimita bloco327 pelo header/parent validado, sem inventar marcador no produto.

Fundação mínima #328 necessária e explicitamente parcial: núcleo interno marcarPerdidoTx, contexto de mutação compartilhado, wrapperNoInbox com ID esperado somente como CAS e prop acao opcional no ModalPerda. O alvo vem da thread, com locks Atendimento→Lead e autorização atual revalidada depois da espera. API pública Funil, validação, repetição/no-op e revalidação permanecem; aviso do atendimento somente quando mudou e tudo na tx. Callback do modal usa o wrapper; sem callback, o caminho Funil e refresh padrão permanecem. Seus testes de equivalência/rollback/pool1 pertencem à fundação, não comprovam UI328. Não portar CartaoExperimental, Assumir, agendar/enviar/confirmar, transferência ou novos endpoints328.

## Sugestão concreta de composição e gates

Primeiro partir de Main atual com a #420 composta e protegida. Isolar núcleo/contextoCAS/wrapperPerda/propModal como fundação mínima, com vínculo explícito à opção PERDIDO327. Em seguida inserir consulta/movimento/dispatcher e aplicar hunks UI sobre o destino, preservando OR do editor e testes atuais. Por fim unir os estados/harness e acrescentar documentação por blocos, sem substituir quadro Main. Uma separação em commits técnicos facilita conferir que nenhum contrato global ou UI328 entrou por arrasto.

A CLI capturar-inbox histórica tem limites diferentes do wrapper A11. O diff acrescenta dispatcher/core327, mas sua auditoria genérica ainda usa Set de conclusões e Promise.all de tarefas de requestfinished; isso não equivale aos drenos finitos/SSE/WS e selos pós-PNG do wrapper A11 auditado. Não usar CLI sozinha para nova evidência operacional/escrita nem alegar que sua execução comprova os mesmos limites nativos. O handoff já exige wrapper/GO separados. Preserve guardas953 e coletor Detalhes325 do destino; mantenha a matriz base por união de IDs/estados e conte o resultado integrado, sem presumir número de estados de outra árvore.

Após o porte, exigir manifesto novo de OIDs e delta permitido, proteção explícita de Main/326/337/418 e conferência de imports/tipos/migrações. Gates integrados apropriados devem ser nominais à nova árvore e seu cliente/schema491 preparados pelo integrador; não reatribuir automaticamente 67 INT históricos487,176 harness ou corpus EBF à fonte Main. Esta QA não executa esses gates nem substitui a futura revisão exata da composição.

## Provas ROOT posteriores e limites finais

ROOT informou auditoria pós-A11 4d98a0 EXIT0: 566 total/553 originais/424 hashes/sequências/PROPOSTA e zero Save. Preview3546 parado por CtrlC (exit1 esperado), porta3110 fechada em1c27a1 EXIT0; restauro A487 1fd8ac EXIT0 confirmou snapshot553/424hashes/sequências. Cluster compartilhado intocado. São provas do integrador comunicadas depois dos documentos, não operações desta QA; eventual adendo deve ser novo, sem reescrever o pacote congelado.

- output/inbox-327-curadoria-review-tester/zip-prova-tester.json: 14831 bytes/SHA 114793ad40ea0f8c449ff3ed42279d91e31fdfdbf6360554f8b3d11ed891c26e.
- output/inbox-327-curadoria-review-tester/fonte-prova-tester.json: 20901 bytes/SHA 61b8cae5b9068f1e2bedc100a49f4d3e7f0eac60746c975963b00a4109a16817.

Meu checkout permanece #351/6fe, cliente490/perfil tester; banco já liberado e restaurado pelo ROOT55a5ff, sem nova lease. Somente FS/Git/parser padrão e uma representativa visual já certificada foram usados. Nenhum teste, main, browser, HTTP, DB, grant, Save, upload, merge ou composição foi executado. Autorização/publicação do ZIP327 continuam pendentes; não usar outra via para contornar essa etapa. #327/#328 não são encerradas por esta revisão.
