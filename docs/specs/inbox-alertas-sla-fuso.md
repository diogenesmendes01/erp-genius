# Alertas SLA: parametros UTC em sessoes PostgreSQL — #410

Issue: https://github.com/diogenesmendes01/erp-genius/issues/410

As colunas prazoRespostaEm e slaAlertadoEm sao TIMESTAMP(3) sem fuso e representam UTC. O claim recebe Date como timestamptz; comparacao/atribuicao mista dependia de TimeZone da conexao. Em America/Sao_Paulo, um prazo gravado como 14:55 UTC podia deixar de ser reclamado as 15:00 UTC, e a gravacao do claim podia perder tres horas.

O produtor converte somente os tres parametros Date para timestamp UTC com (::timestamptz AT TIME ZONE 'UTC'): SET slaAlertadoEm, limite <= agora e limite > desde. As colunas permanecem intactas, assim como a janela de 24 horas, limites inclusivo/exclusivo, claim atomico, NOT EXISTS de resposta Aria, destinatarios, eventos e segunda execucao idempotente. Nao ha schema, migration, nova API nem alteracao de fuso global, clock ou transporte.

A regressao alertas-sla-fuso.int.test.ts executa rodarAlertasSla real sob UTC e America/Sao_Paulo. Um wrapper apenas no teste envolve o callback real de prisma.$transaction, aplica set_config('TimeZone', fuso, true), confirma current_setting e pg_backend_pid antes/depois do claim, e restaura o spy em finally. SQL e resultados nao sao mockados. SET LOCAL fica restrito a transacao; nao ha configuracao persistente do pool.

Fixtures independentes: agora 2026-10-19T15:00:00Z; prazo 14:55Z; exatamente agora/agora+1ms; exatamente desde (2026-10-18T15:00:00Z)/desde+1ms. Sao reclamados somente 14:55, agora e desde+1ms. Notificacoes/eventos correspondem aos mesmos IDs, sem repeticao. Consulta dentro da conexao confirma timestamp without time zone gravado como 15:00:00.000, e leitura Prisma devolve 15:00Z. Aria enviada exatamente no prazo evita alerta; enviada 1ms depois nao evita, sem converter as colunas do NOT EXISTS.

TDD: RED 86523, 4 casos, 2 UTC passaram e 2 SP falharam por assertions reais; GREEN 77354, novo 4 + legado 14 completos, terminal 0. Recorte unitario 5/57, TSC 33847 e lint 2 fontes terminal 0. Os gates sao dirigidos, nao globais. Report com cronologias, fontes e hashes: output/inbox-410-report.md.

Este patch foi desenvolvido em branch separada descendente da #337 congelada em 9a9bfdc8. A futura publicacao extraira somente os dois fontes e metadados desta issue sobre main 487. Gates locais usaram cliente/banco 490 coordenados; QA independente e prova no agregado/main 487 sao responsabilidades posteriores do integrador. Nenhum gate ou visual da #337 e reatribuido ao patch 410. UI N/A: mudanca de SQL no servidor, sem novas telas. Nao publicar ou incorporar em #337 antes da coordenacao.
