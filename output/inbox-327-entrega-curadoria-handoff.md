# Inbox #327 — curadoria e handoff selecionado

Status: corpus visual misto com QA operacional/visual favorável, preparado para revisão de curadoria. Sem upload/publicação, integração em Main, CI ou homologação final presumidos. #328 permanece parcial. Este commit altera somente documentação/metadados, sem runtime/teste/harness/schema/deps.

## Corpus e fontes

18 PNGs originais selecionadas individualmente:6APPadmin A7 (HARNESS9480),6PROTO A9 (HARNESSbe45),6APPleitor A11 (HARNESS cfa). APP runtime ebf7675d5c7c0397fb9de1a988f78a99c873e37a em todos; a fonte do harness mais recente é cfa243291d154b445e1dec83f52604589f42a58e. Não é uma execução nova18. Agregados A7/A8/A9/A10 e diagnósticos continuam negativos, preservados fora da allowlist. A10 forneceu0PNG.

A7 é reuso qualificado por congruência de código/produtor/fixture: os novos checks href/slot/fronteira não foram medidos nativamente nas fotos antigas. BadgeNext cobre parte do link mobile A7; não se afirma foto integral desse link. A9 mantém caminho PROTO literal e referência original estática:fixture,valor e etapas diferem do APP; não comprova foco/autoscroll/seleção nem implementação de tudo que está desenhado. Não houve edição de HTML/DOM/CSS/imagem para igualar resultados.

A11 executou somente6APPleitores novos, sessão39668/ea44d4 EXIT0; wrapper6ad3b51a4f3ac42ad9612e92f0aadedbc7f4f976f7f276fa9f425d129892941b. RAW376049B/SHA8c2972fd1d1fb7ef943ea663d16d583dc3cc28a5e5c72130217fe6927f250d8f. Seis candidatos positivos,6contextos e browser fechados, core/rede/SSE auditados depois do browser. Pendências/handlers0. Cada SSE teve1START/1terminal real ERR_ABORTED da mesmaRequest comPageviva antes de context.close; objetos históricos2,ativa1antes/0depois,máximo simultâneo1.

AquisiçõesUI A11:17Detalhes+6Oportunidades=23, separadas de42chamadas API preparatórias (7porPage). Rede290inclui6SSE, portanto284nãoSSE.18POSTs incidentais naturais (3porPage:rápidas,lido,rápidas), além de autenticação;0Save/etapa/perda/nota/envio. Abortos recuperados permanecem explicitados no raw com sucessor posterior/body/hash/DOM e identidade; nenhuma dispensa genérica. Zero operação nativa adicional durante curadoria.

QA independente A11:parecer10927B/SHAafd86c4a81fa30bbed390d3f89bc0b8912d45846a8a78629a32044fb095f3ac8; allowlist16193B/SHAa869150df34f015b313c4ea0263803df6358030c47fc9461e0d17d7c632daa4a. T inspecionou seis originais novos e reconferiu12históricos. QA código cfa176/176 e congruência:8731B/SHAf5bdcacb75bdb51808cfdd39ee57c92bfb0ebb60432cba578bacd7a268f0bec7. Esses pareceres não são uma nova suíte DEV nem regressão integrada Main.

## Anexos propostos, ainda não publicados

- ZIP output/inbox-327-evidencias-selecionadas-v1.zip,1935721B,SHA2e06d8551647a73f4e8760c31c09b5767cc5de15e4d6b5a7a739c2f33fd53994. Exatos20arquivos:18PNG+README+manifestoJSON.
- PNG representativa separada output/inbox-327-representativa-v1.png,164617B,SHA09f69eb67ab4326b7db8f4e2b1bc0fcaa4c3341e54d5b88f2f028ddd7a548224; cópia original A7claroDesktop individualmente certificada, com a mesma qualificação9480.
- Manifesto interno18628B,SHA50c17226bc31cd64727c568bbe49ea2e5ab8c34210022cc465bb2dd40605d65b; bytes/dimensões/SHA/fonte/executor e qualificação por arquivo, sem IDs internos de runtime.

Verificação offline2c2e8b EXIT0:originais byteiguais,dimensões,SHA,CRC e20entradas ZIP. Todos18originais foram abertos porview_image nesta curadoria. Sem credenciais visíveis; aparecem apenas fixtures demonstrativas e exemplos do protótipo original. PNGs sem chunks textuais/exif. ZIP não contém raw,logs,env,login,cookies,CSRF,nonces,IDs dePage/contexto/run ou dump. Capturas não foram recortadas/anonimizadas; nenhum dado original foi alterado. Prova privada e gerador permanecem fora do commit/publicação.

## Fonte327 mínima sobre PR420

Manifesto output/inbox-327-fonte-handoff.json lista paths,OIDs de baseline/fonte,SHA do diff e cabeçalhos de hunks por grupo. Comparação exata PR420HEAD179b6919a08cc70fdd078488a0c531395501d1b8 → cfa. A história agregada A não é publicável e o diff global contém reversões337/418 ausentes nesta branch antiga; NÃO cherry-pick/reset/copy-all. A ref main local A é antiga e não define Main atual. Integrador parte de Main atual e preserva seus contratos/schema/menções/Compositor/Sino/notificações.

Dependência real326 é a composição existente da PR420:editor/Gaveta,CAS Pessoa,retorno foco/Retry,hookR1 único de Detalhes e testes. Não reimportar326 antigo. Em InboxNovo, PRESERVAR a expressão420 que ativa Detalhes por (comercial && abaDetalhes) OU editorAberto, acrescentando separadamente Oportunidades sob demanda. A linha antiga A que condiciona também o editor ao comercial não é hunk327 a portar. Preservar cabeçalho325/B2B/rótuloLATAM e produtor de hrefs336. PainelContato envolve todos os slots no tabpanel; bloco327 é o parent do header validado, irmão do Cadastro legado.

Fundação328 explicitamente necessária para PERDIDO327:marcarPerdidoTx interno,wrapperNoInbox com3args/CAS,prop acao opcional do ModalPerda e testes de equivalência/no-op/rollback/pool1. Contexto de mutação compartilhado327/328 temAtendimento→Lead e autorização fresca apóslocks;ID esperado só compara alvo resolvido no servidor. O Funil mantém API e regras públicas. Isso não porta CartaoExperimental,Assumir,agendar/enviar/confirmar nem encerra328UI/visual. Não há nova ação global dentro daTx.

Shared files exigem hunks sobre o destino, especialmenteInboxNovo,acoes-painel,comercial/acoes,ModalPerda,mapas e CLI. Testes326/337 e todos ramos Main permanecem. Consulta327 é sem locks;outras oportunidades têm escopoComercial independente. PodeAbrirFunil vem de funil.ver servidor e é diferente de moverEtapa/visibilidade contextual. Link Cadastro legado não é link novo327.

## Gates nominais e trabalho restante

Backend/fundação preservados nominalmente:3próprios32INT verdes59550/11a8f5;fundação32818INT+17regressõesFunil78021/49ae21 (7arquivos/67 no conjunto histórico). UNIT97/1192 e posteriores119/1621,TSC/lint e QA independente permanecem nos reports de suas fontes; não foram repetidos na curadoria. Harness atual176/176,lint/TSC verdes e QA T cfa; A11 operacional6/6 aqui documentado. Nenhum global/INT/UI novo neste commit documental.

Aguardam QA desta curadoria/handoff, auditoria DB pós A11/parada/restauro pelo ROOT, composição mínima sobre420/Main, regressão/CI da fonte integrada, revisão final e autorização de upload/publicação. Não marcar327/328 concluídas. Preview3546/client487/perfildev-email não foram alterados pelo DEV; nenhum servidor/DB acessado na curadoria.
