# WhatsApp — auditoria de desativação e exclusão (#418)

Dependência técnica descoberta na Integração da PR #416. O logout do motor persistia `DESCONECTADO` antes da transação administrativa. A releitura fresca desta transação então suprimia `NumeroWhatsAppDesconectado`, deixando somente Desativado/Excluido; uma falha posterior também deixava a sessão previamente alterada fora do rollback administrativo.

A ação administrativa solicita somente o comando externo `solicitarLogoutMotor({providerRef})`. Este comando faz o POST e propaga o erro do motor, sem ler/gravar o banco. A transação administrativa conserva a releitura fresca, confirma estado/inativação/exclusão e registra os eventos com autor na mesma transação. A API legada `desconectarNumeroMotor` mantém seu contrato de comando mais sincronização local, documentado no código; ações administrativas usam o comando puro. Desconectar explicitamente continua registrando o evento pela ação administrativa, sem duplicação pelo helper.

Não há schema, migração, dependência, permissão ou integração externa nova. Motor inexistente conserva a tolerância administrativa atual; indisponibilidade recusa a operação. Repetir desativação/exclusão não recria eventos ou logout. Uma sessão fresca diferente de `DESCONECTADO`, como `CAIU`, determina o `de` do evento. Se a gravação do evento final falha, estado e eventos da transação administrativa são revertidos. O efeito externo de um logout não pode ser revertido pela transação local; os testes usam exclusivamente motor simulado.

## R1 — webhook confirma o logout antes da transação

A revisão da PR #419 identificou um segundo caminho: o webhook pode confirmar `DESCONECTADO` enquanto o motor responde. O processamento genérico de sessão não registra o evento administrativo e permanece sem essa responsabilidade. A ação agora leva à transação a sessão anterior ao logout que ela própria solicitou. Usa esse valor somente quando a releitura já encontra `DESCONECTADO`; qualquer outra sessão fresca prevalece. Um número que já estava desconectado antes da ação não recebe evento de desconexão inventado.

O rollback não desfaz uma confirmação do webhook já commitada em outra transação: nesse caso, uma falha administrativa mantém `DESCONECTADO`, ativo e sem exclusão/eventos administrativos. As duas ações têm testes para evento único com autor, repetição sem novo POST, esse rollback e o caso inicialmente desconectado.

RED R1: sessão 4846/85a2cb, arquivo completo com 38 casos, 36 aprovados e duas falhas causais por ausência do evento; duração 147,18 s. GREEN 71622/a48f1a: dois arquivos completos, 46 testes, 195,21 s, um worker, sem filtro de nome ou skips impostos, saída 0. TypeScript 61539/02f5d6 e lint de quatro fontes 45146/4a0571 com saída 0. Banco restaurado c07a8a, com 424 hashes e snapshot de 494 registros preservados.

A primeira tentativa de global (40595) foi interrompida após arquivos sem coleta; diagnóstico isolado 92989/2d9f0d terminou 1 por EPERM ao renomear o cache temporário do Vitest, sem executar testes. Global final autorizada 60813/5e25c4: 926 arquivos e 7.313 testes, 308,93 s, dois workers, sem filtro de nome ou skips impostos, saída 0. Lint global 8318/85ea9e: zero erros e 40 avisos herdados, saída 0. As tentativas anteriores não são gates aprovados. Integração remota no head final e QA independente atualizados são obrigatórios antes do merge. As evidências abaixo continuam nominais à correção anterior, sem reatribuição à R1.

QA independente R1 do commit exato `6039755842dbbe946ba19d0436436a23dd930ce9`: dois arquivos/37 UNIT (c75a11), dois arquivos/46 INT (66428/ab9020, 217,57 s, um worker), TypeScript 10003/551e0e e lint de quatro fontes 680678, todos com saída 0. [Parecer R1 integral](../../output/ci-418-qa/r1-6039.md), SHA256 `C5943BAEB966B058D32958B2ABCB73FD51160DCFFEF1950A924522B00A07175E`. Banco restaurado pelo ROOT em cd77db, com os 424 hashes e 494 registros originais conferidos. Resta executar e acompanhar CI rápido e Integração remota no SHA de publicação antes do merge.

Evidências ROOT, sem filtro de nome/skips:

- Reprodução original4084/87c6a3: arquivo completo28 testes,27 positivos/uma falha,107,50s.
- RED reforçado34808/f35559: arquivo completo32 testes,25 positivos/sete falhas causais,130,60s. Inclui desativação/exclusão, contagem/autor/payload, releitura CAIU durante resposta do motor e rollback dos dois eventos/estado.
- RED unitário2da5a1: três casos falham pela ausência da nova função; oito passam. Não é uma reprodução adicional do defeito de produção.
- GREENdc059b:11 UNIT completos e lint4 estrito, saída0. GREEN15687/6924fa:dois arquivos completos/40 INT (administração e processamento de sessão),146,20s,maxWorkers1,saída0, banco descartável integracao487. Restaurado c82270,saída0,424 hashes/snapshot494.
- Fonte dos quatro arquivos preservada por hash no fast-forward da base239 para main ae56c00f (#417), prova9c98cf. Os40 INT são nominais à mesma fonte backend, sem nova execução depois desse fast-forward. TSC90998/c4c4a0 e lint global36395/dca4ff (zero erros/40 avisos herdados), saída0 na nova composição.

Regressão global91717/006c1a:saída0,926 arquivos/7.313 testes,242,24s,maxWorkers2,sem filtro de casos ou skips; configuração unitária exclui INT. QA independente no commit d9c1d0bb:2 UNIT completos/37 casos,2 INT completos/40 casos,TypeScript/lint4, todos saída0; [parecer integral](../../output/ci-418-qa.md), SHA A29DD0396BCC52D8417FCA79ABD3D0FEB3AFEA08AFB513F350BD118108264C9F. Banco restaurado novamente pelo ROOT3e3048,424 hashes/snapshot494. PR419 aberta; CI e merge ainda pendentes. Nenhuma mensagem real, chamada ao motor real ou deploy foi feito nos testes.

## Integração completa — porte da fixture de calendário já validada

A revisão da composição constatou que o head 2f3db8b0 da #419 ainda usava Date.now()+1dia no caso de cancelamento de agendamento. Em 24/10/2026, amanhã é domingo. A #416 já corrigia essa fixture no commit b2df8321; esse ajuste agora é portado literalmente para a dependência, com o helper existente diaUtilAs(10). O teste não verifica a política de domingo: precisa criar um agendamento válido antes de verificar idempotência do cancelamento.

Delta exclusivo de teste: um import e a data da fixture. Nenhum produtor de janela, autorização, transporte, schema, dependência ou workflow muda. O blob final é exatamente d1c3775a1315bf4eceaa954a7c4636d74b10b7e1, igual ao já publicado na #416. Evidência anterior nominal: reprodução 2076/2cdece com uma falha em 11 casos e GREEN 37237/85094b, três arquivos completos/27 INT; a composição923 também aprovou o mesmo arquivo no recorte ROOT 7455/eabe78, dez arquivos/116 INT no schema490. Isso não é uma nova INT local desta publicação, cujo schema é487. QA e gates anteriores da correção de produção permanecem atribuídos às suas fontes; os quatro SRC #418 não mudam.

Nova CI rápida e Integração completa devem rodar no novo SHA publicado. O run 40118084095 permanece nominal a 2f3, sem esse ajuste; não é reatribuído. A composição #416 faa8 já contém o mesmo teste corrigido e sua Integração40119667033 continua pertinente. Merge da #419 e depois da #416 continuam condicionados às verificações finais. Não há mudança da regra de envio ou nova nota manual.
