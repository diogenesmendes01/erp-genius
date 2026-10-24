# QA independente da issue #337

Estado atual: [QA da composição923](composicao-923.md) favorável, 15 arquivos/245 UNIT, dois arquivos/40 INT, TSC e lint19 com saída 0. O índice conserva nove pareceres anteriores e acrescenta esse décimo, sem alterar suas fontes ou hashes. ROOT passou global935/7400 e dez arquivos/116 INT; recortes sobrepostos não são somados. CI remota e merge seguem pendentes.

Os dois anexos históricos já foram autorizados e publicados diretamente na [PR416](https://github.com/diogenesmendes01/erp-genius/pull/416#issuecomment-6386780823). O bloqueio de acesso citado nos registros abaixo foi resolvido. A release continua em rascunho; o corpus visual não é reatribuído ao923.

Os parágrafos seguintes preservam os checkpoints anteriores.

O [índice de QA](indice.json) contém sete pareceres históricos completos, um parecer final R1 e uma revisão estática da fixture de calendário C1, cada qual nominal ao seu SHA, recorte e limites. A publicação verificou os hashes físicos originais e normalizou CRLF para LF; o índice preserva ambos os hashes. A preparação documental inicial R1 alterou somente prosa; os ajustes posteriores de código têm a QA própria descrita abaixo, mantendo os sete pareceres e hashes históricos intactos.

O runtime independente refere-se à preparação7d9: 46/783 UNIT, cinco arquivos completos/46 INT, TSC/lint. A revisão final refere-se ao código integrado9fa: seis arquivos completos/185 UNIT próprios, com backend337/schema/três SQLs preservados. São recortes dirigidos; execuções repetidas não são testes distintos. Fontes, sessões, gates ROOT e limites da composição estão no [relatório de composição final](../inbox-337-composicao-final.md).

A publicação documental419b preserva o código de [9fa1b30ecbb0c3d214d57f3a9544c05e249b919d](https://github.com/diogenesmendes01/erp-genius/tree/9fa1b30ecbb0c3d214d57f3a9544c05e249b919d). O parecer final conserva o diff-check global2 por uma linha vazia no EOF da SPEC em9fa; a correção documental posterior removeu essa linha. Esse negativo nominal não foi apagado nem reclassificado.

A evidência visual é histórica e permanece separada:38 PNGs d68 e dois ACK ab76. Não são capturas do executável integrado9fa, dos novos estados de feedback ou dos ajustes R1. Há pareceres próprios de paginação, caret/ACK e visual. Nenhuma nova nota UI/captura, cobertura de todos os IMEs ou cabimento integral do placeholder foi alegado; o orçamento autorizado de oito notas positivas/duas negativas está esgotado.

O pacote sanitizado histórico permanece em release privada de QA em rascunho, com nome/bytes/SHA registrados no índice e na composição. No checkpoint R1 de preparação, a revisão automática bloqueou o upload ao formulário da PR por ser outro destino, e a pergunta específica ao usuário ficou pendente sobROOT; não se presume acesso pelo revisor. Qualquer autorização e link posteriores devem ser conferidos na [conversa da PR416](https://github.com/diogenesmendes01/erp-genius/pull/416). Este registro não autoriza republicação, release pública ou envio por outra via. PNGs/ZIP ficam fora do Git; logs brutos, seeds e credenciais permanecem privados e não são conteúdo publicável do pacote.

[inbox-337-evidencias.json](../inbox-337-evidencias.json) e [inbox-337-report.md](../inbox-337-report.md) são índices dos registros históricos imutáveis9fa, com bytes/SHA256/blob e links para a narrativa integral. A seção gatesPreparacaoLimpa20261024 permanece completa e compatível com o procedimento histórico do parecer runtime; não se reatribuem esses gates ao head atual. Os pareceres originais e seus hashes não mudam. Aprovação de produto D20 não equivale a homologação; CI, comentários e decisão de merge continuam com o integrador.

O oitavo [parecer completo R1](revisao-r1.md) é nominal ao executável integrado ecc92d47:30 arquivos/431 UNIT, seis completos/53 INT, TSC e lint11 próprios do TESTER, todos saída0. Inclui teoria da união/ACL em fases, comandos,11 hashes e limitações; não é uma nova prova visual. Os sete pareceres históricos permaneceram com seus hashes originais. GlobalROOT930/7317, restauros dos bancos, workflow/CI e estado da publicação estão na composição e na conversa da PR.

A nona [revisão C1](calendario-c1.md) examina o ajuste de data do teste legado no commit b2df8321, com cinco caracterizações puras do helper existente. Não é nova INT própria do TESTER. Reprodução e três arquivos/27 INT pertencem ao ROOT; a primeira execução remota falha permanece negativa e o novo head requer nova CI/Integração.

## Atualização após o merge da dependência #419 — 24/10/2026

A #419 foi mergeada em 60a74096. A composição local 41a7e4d9 incorpora essa main e muda somente três documentos em relação a faa8, preservando todo o executável, schema, SQL, dependências e workflows. Os dez pareceres acima mantêm seus bytes normalizados em LF e suas fontes.

[Integração remota de faa8](integracao-remota-faa8.json): quatro shards SUCCESS, 349 arquivos/3.086 testes aprovados; três arquivos/quatro preparadores visuais opt-in ignorados, sem filtro adicional. CI rápida anterior 5/5. Esses resultados não são uma execução no SHA posterior: a identidade do código é a justificativa para reutilizá-los, com nova CI rápida e inspeção final ainda exigidas. [Composição detalhada](../inbox-337-composicao-final.md).

Os anexos já autorizados estão diretamente na PR, comentário 6386780823. O corpus de 40 imagens continua nominal a d68/ab76; a release permanece em rascunho. Não houve nova nota manual, captura, envio externo ou execução de produto nesta atualização documental.
