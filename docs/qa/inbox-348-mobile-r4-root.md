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
