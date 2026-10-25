# Cabeçalho mobile Inbox — correção R4

Fonte anterior: `21f55aa838a88a7d5a6ef27aa4b01bf3c5e37b73`, build `hKcOdv72sU5j1ltwsiZ1C`. O arquivo do cabeçalho era idêntico ao da PR #434 (`955552b1`). Esta correção altera somente apresentação e agrupamento acessível; servidor, capacidades, domínio, controlador, ações e menu permanecem com seus contratos.

## Defeito demonstrado

Com a linha fictícia ativa e desconectada, o caso Handoff mobile claro com Transferir, Devolver, Assumir, Painel e Menu exibia nome/estado como `Han…` / `Ari…`. O TESTER confirmou a compressão e aprovou o plano de duas linhas, preservando o Menu fora do containment. Parecer técnico SHA256 `11545380253b527d0d83e834781d3c9445bcc0203f7cf6ff75a36c3b2ed5ce56`.

Foram obtidas 30 capturas de diagnóstico: 15 com manifesto válido antes de uma falha de infraestrutura do Chromium (`ERR_NO_BUFFER_SPACE`, lote EXIT1), mais 15 restantes com EXIT0 (`20006/6429a3`), na mesma fonte, build e hash da fixture ativa. A retomada passou a fechar cada contexto antes do próximo; nenhum erro de rede foi ignorado. O conjunto demonstrou o defeito e não constitui aceite final da #348.

A fixture alterou apenas `NumeroWhatsApp(inbox-346r-v1-numero).ativo`, mantendo a sessão desconectada, `providerRef`/dono nulos, sem workers ou provedores externos. As duas fases foram restauradas aos hashes originais (`07bef1`, `82d26e`, EXIT0). Auditoria posterior `3c8a91` confirmou 1379 registros originais/424 tabelas, 47 fictícios, sequências e campos de negócio preservados; sete datas de acesso/leitura explicitamente permitidas mudaram. Após os testes das variações #347, a auditoria `a68f0a` confirmou o mesmo estado íntegro.

O preview foi encerrado pela sessão `71324` (terminal `ecd049`, EXIT1 por interrupção). Verificação `010773` confirmou PID ausente e porta 3130 livre; o recibo antigo de ownership continuou LISTENING e foi preservado como dado histórico. Restauração `e77e56` terminou EXIT0, recompondo os 1379 registros originais no banco descartável próprio. O cluster compartilhado permaneceu ativo.

## Verificação da correção

- RED comportamental: `be745b`, EXIT1, 11 casos — dez controles aprovados e o novo contrato de agrupamento acessível ausente. Tentativas administrativas anteriores não executaram casos: opção CLI não suportada (`1e3bb3`) e cache temporário bloqueado pelo sandbox (`a16571`).
- GREEN focal: `62c59b`, EXIT0, um arquivo completo / 11 casos, sem filtro de caso. Verifica o grupo acessível, handlers originais, slot Devolver e Menu separado.
- Regressão dos consumidores: sessão `80663`, terminal `9b25c9`, EXIT0, nove arquivos completos / 235 casos. Cabeçalho, InboxNovo, busca, rodapé, menu e Devolver; um worker, heap 1024 MiB, configuração original. É um recorte, sem integração SQL ou novos skips.
- ESLint dos dois arquivos alterados: `525966`, EXIT0, zero avisos com `--max-warnings 0`.
- TypeScript original inicial: sessão `5530`, terminal `ecb26a`, EXIT1. O teste passava o tipo abstrato `No` do helper a uma função que recebe `ReactNode`; nenhum erro de produção foi apontado. O teste passou a verificar `isValidElement` e percorrer os filhos reais, sem cast para contornar a checagem. Replay focal `e9aab3`: EXIT0, 11/11.
- TypeScript original final: sessão `73242`, terminal `95ba03`, EXIT0, `--noEmit --incremental false`, heap 8192 MiB e sem diagnósticos. Nenhuma configuração ou exclusão alterada; stdout vazio, sem log de texto criado.
- ESLint final dos dois arquivos: `b1a3ea`, EXIT0, zero avisos. A correção final de tipos do teste não alterou o componente nem os handlers verificados no recorte de 235 casos.

## Pendências

Build e comparação visual da fonte corrigida, com medição da largura útil de nome/estado, geometria dos controles e Menu, nos dois temas e na borda 699/700. Verificar também 320/360px e conjuntos parciais, preservando o comportamento a partir de 700px. Nenhuma homologação visual ou merge é presumido. A composição com #332/#333/#354/#359 terá seus próprios gates.

## R4.1 — diagnóstico do build composto e correção local

A composição `b437e13c`, build `z1ivcGA6NikkKmXZP6V_S`, passou TSC original (`77524/4d2480`, EXIT0), global original de 997 arquivos/8617 casos (`84212/ec84b9`, EXIT0), lint original com zero erros/48 avisos (`8750/ad3541`, EXIT0) e build original (`23043/5feba8`, EXIT0). Esses resultados pertencem à fonte anterior a R4.1.

O smoke novo de Handoff claro (`8b42e0`, EXIT0, três tamanhos) foi inspecionado pelo integrador e pelo TESTER. Mobile estava legível, mas tablet tinha cabeçalho de 500×68px e desktop de 496×68px, ambos comprimindo nome/estado. Essas capturas são diagnóstico, sem aceite. Parecer independente SHA256 `a7edd5abfc5c410724d4ebb35ed07c097fcc04e538e99e1217d28fb26bb8e5d2`.

A linha fictícia foi restaurada para inativa (`03cccf`, EXIT0); auditoria posterior `9d1c9f`, EXIT0, preservou os 1379 registros originais/424 hashes, 47 fictícios e sequências, com três alterações de datas permitidas. Preview interrompido pela mesma sessão `84452` (`1f64d6`, EXIT1 por interrupção); `b1cd86`, EXIT0, comprovou PID 1515516 ausente e porta 3130 livre. Restauração `936c06`, EXIT0, recompôs o banco original antes de editar a fonte.

R4.1 usa container query no wrapper existente até 640px e altura natural, mantendo o Menu fora do containment. A regressão focal conjunta com a apresentação do switch global passou `a080c2`, EXIT0: três arquivos completos/41 testes, sem filtro de caso ou novos skips, um worker/1024 MiB. O teste de agrupamento do switch teve RED causal `f262c4`, EXIT1 (16 controles aprovados/uma falha); tentativa anterior `dc7717` falhou no cache antes de executar casos. Nenhum teste de CSS por comparação literal foi adicionado. Novo build, medição real de identidade/estado/ações/Menu e aceite dos dois temas continuam pendentes.
