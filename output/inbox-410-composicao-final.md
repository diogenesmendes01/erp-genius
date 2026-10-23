# #410 — composição final e validação

O claim dos alertas SLA dependia do fuso da sessão PostgreSQL: parâmetros JavaScript Date chegavam como timestamptz, enquanto as colunas guardam UTC em timestamp(3) sem fuso. A correção converte explicitamente os três parâmetros para UTC antes da comparação e da gravação. A janela, seus limites, NOT EXISTS da Aria, destinatários, eventos e idempotência permanecem iguais.

Branch `codex/inbox-sla-fuso-410-main`, base direta main `c1b474cd66bbb8c0a4ed8ea1893988696ed14022` após a #411. Foi selecionado somente o patch original `1995d87c721c6ff8267d25491f9ef4a9235aeee3`, reaplicado em `56a212902e7bc215778b7feba45a9b0343c8489c`. O único conflito documental preservou os 1.083.401 bytes do quadro de main e acrescentou somente as quatro linhas #410. Nenhum código, migração ou histórico da #337 foi incorporado.

Fonte executável final: `32d34493bc6839696a630ead449e7adf666caa1e`. O segundo commit corrige dois valores da fixture do novo teste para o driver atual `MOTOR`, como já faz o teste legado de SLA; também normaliza EOF. O SQL produtivo continua byte a byte igual ao patch original. Não houve ampliação da guarda de provedores legados.

## Evidência e cronologia

- Desenvolvimento original: RED PostgreSQL com UTC 2 passes e America/Sao_Paulo 2 falhas causais; GREEN 18 casos após a conversão. Fontes, limites e logs privados estão identificados em `output/inbox-410-report.md`. Essa prova não foi reatribuída à composição atual.
- Revisão independente da composição inicial 56a: 2 arquivos completos/18 testes de integração, sessão 4784/8da3e3, saída 0. Porém o unitário global ROOT 61335/b1e1ad terminou **1**: 909 arquivos passaram e um falhou; 7.158 testes passaram e um falhou. A guarda identificou os dois literais de driver legado na fixture nova. Esse resultado permanece negativo, não é apresentado como gate aprovado.
- Após o ajuste mínimo da fixture em 32d: recorte ROOT da guarda e SLA, 2 arquivos/10 testes, fb52f6, saída 0. Um terceiro path solicitado não existia e não foi selecionado; não é contabilizado.
- Unitário completo final ROOT em 32d: sessão **70461/1ea125**, saída **0**, **910 arquivos/7.159 testes**, 222,08 s. Node 22.23.2, `vitest run --maxWorkers=2`, heap 8192, sem filtro por nome/skips; configuração padrão exclui integração. Windows, fuso local America/Sao_Paulo, sem TZ definido. Fonte mantida fixa durante a execução.
- TypeScript global final em 32d: 80eaf2, saída 0, heap 8192. Next typegen na composição 56a: 56331/ba9a25, saída 0; nenhuma rota mudou depois. Lint global 56a: 74649/717dcb, saída 0, zero erros/40 avisos herdados; lint final dos dois fontes alterados em 32d: 03d8a2, saída 0, zero avisos.
- TESTER independente no SHA exato 32d: sessão **81165/909a8e**, saída **0**, **2 arquivos completos/18 testes**, 66,36 s, `vitest.integration.config.ts`, `--maxWorkers=1`, perfil descartável `ci-integracao`, schema e cliente físico próprios 487, sem filtro/skips. Os arquivos são `alertas-sla-fuso.int.test.ts` e `alertas-sla.int.test.ts`. A rodada inicial e a final repetem os mesmos casos; não são 36 testes distintos.

O teste novo confirma TimeZone e PID dentro da transação real, parâmetros nas bordas de 1 ms, valor timestamp bruto gravado em UTC, exclusão da Aria enviada no prazo/depois e replay sem duplicar eventos/avisos. Não fabrica resultados SQL nem chama o transporte de mensagens.

Parecer final em [inbox-410-qa/final-tester.md](inbox-410-qa/final-tester.md), com [índice de fonte, hashes original/LF e execuções](inbox-410-qa/indice.json). O banco descartável foi restaurado pelo ROOT em 2dd656, saída 0, conferindo as 424 tabelas/hashes; snapshot preservado. Banco de produção, cluster e integrações externas não foram usados.

UI N/A: esta correção é do produtor SQL. Sem schema/migração, dependências, fuso global, envio real, ativação externa ou deploy. O commit final de publicação acrescenta somente este relatório, o parecer/índice e o estado do quadro. CI remoto dos cinco checks e comentários da PR ainda precisam ser conferidos antes do merge. #410 é suporte técnico e não aumenta a contagem das 26/81 issues funcionais originais já integradas.
