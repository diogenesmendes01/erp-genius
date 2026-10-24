# Inbox #337 — composição final de menções e avisos

Fonte executável atual da revisão R1: `ecc92d4781c5fe0f94f06920442769e8ad37b999`, combinando C2/C3/C4 e os ajustes documentais C5/C6. Global ROOT930/7.317 e QA independente30/431 UNIT +seis completos/53 INT aprovadas, com detalhes abaixo. Os checkpoints iniciais permanecem históricos. CI do head publicado, workflow Integração C1 e autorização específica para anexar os dois arquivos à PR ainda são etapas externas pendentes.

Base direta main `239ed17fde1593f2e96fde53a01851f48ed13f86`, squash da #415; issue #336 confirmada closed/completed (`0b75e5`). A árvore desse squash é igual à publicação `89445880`, prova `9622b2` e ajuste do ponteiro local `b3bf02`, sem mudar índice ou arquivos. Foram selecionados apenas os 28 paths SRC/Prisma e seis documentos finais da preparação `7d9f565c3b840b64ec6b88dc4d2c4446a95803f5`; a identidade dos 28 blobs foi conferida em `660b06`, saída 0. O quadro atual foi preservado. Nenhuma história agregada, PNG, ZIP, log bruto ou credencial entrou no porte.

O produto selecionado preserva tokens explícitos/UTF16, homônimos, busca autorizada, nota/avisos/NOTIFY/idempotência na mesma transação, paginação do sino com ACL por lote, caret após commit e reconciliação de rolagem após ACK. Os três IDs de migração são os originais reservados `20261023140000`, `20261023170000` e `20261023180000`, já aplicados somente nos bancos descartáveis490. Não foi criado ID novo nem aplicado o índice planejado da #342.

## Regressão e correção de feedback

A primeira global ROOT `46634/b9594d` terminou com saída 1: 928 arquivos, 926 aprovados; 7.288 testes, 7.286 aprovados, 296,24 s. As duas falhas reais apontaram o mesmo ramo do compositor: lista vazia sem EstadoVazio e falha de busca anunciada como status. Foram separados os estados carregando, erro em role=alert, candidatos e vazio no componente padrão. O inventário de usos de EstadoVazio ganhou apenas esse uso; nenhuma exceção, guarda ou limite foi relaxado.

O novo teste de interação teve RED causal `4a2400` (um falho/14 aprovados), antes do ajuste. O recorte `48551/787764` saiu 0: seis arquivos/185 testes, 17,84 s, cobrindo compositor, caret/ACK, estado vazio e feedback. Dois casos novos verificam vazio/erro sem enviar nota, foco conservado e carregamento sem vazio antecipado.

Gates finais ROOT após a correção:

- Global `73157/44853b`: **928 arquivos/7.290 testes**, saída 0, 211,42 s, maxWorkers2, sem filtro de nome ou skips; integração é excluída pela configuração unitária.
- TypeScript `92113/673531`: saída 0, heap8192, sem diagnóstico.
- Lint global `15112/75d712`: saída 0, zero erros/40 avisos herdados, teto40.
- Integração `24889/bc373d`: cinco arquivos completos/46 testes, saída 0, 233,94 s, maxWorkers1, perfil dev-gravacoes490 exclusivo ROOT. É nominal ao porte antes do ajuste exclusivamente visual; backend/schema/SQL permanecem iguais. Arquivos: nota-mencao, nota-interna, inbox-idempotencia, notificacoes e lembretes. Nenhum filtro ou skip. Banco restaurado após o terminal por `0ae170`, 424 hashes.

O TESTER executou independentemente a preparação exata7d9: UNIT46/783 (`24135/9677c0`), INT5 completos/46 (`48615/e1073a`, 232,03 s), TSC (`9209/fce50f`) e lint24 (`b33ad1`), todos com saída0; perfil tester490 próprio. Restauro ROOT `6f0010`, 424 hashes. A comparação textual inicial do schema esbarrou na formatação/reordenação feita pelo Prisma; cópia privada formatada pelo Prisma oficial5.22 ficou idêntica aos clientes físicos ROOT e TESTER (`d44020`), sem alterar fonte ou aplicar DDL. Os negativos administrativos estão no parecer independente; não foram chamados de RED de produto.

## Evidência visual nominal e limites

Os 40 PNGs anteriores permanecem separados por fonte: 38 de `d68f678c` e dois complementares ACK de `ab76f3f6`. Total3.707.250 bytes. O [pacote curado privado](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-337-aceite-d68-ab76-20261023.zip) tem3.743.253 bytes, SHA-256 `db1203ff694febc3afb627b65d32f5eeac39b1ec8537f2411481bb7250546dfb`, asset670630281; release421321214 mantida em rascunho. Não houve recaptura atribuída ao porte nem à correção de feedback.

Os oito submits positivos e dois negativos de notas fictícias autorizados foram consumidos na rodada original. Nenhuma nova nota manual/UI, mensagem ou integração externa foi executada nesta composição. As integrações automatizadas em bancos isolados não são nova prova UI. Placeholder de segunda linha parcialmente visível e limite dos eventos IME observados continuam explícitos; não se promete cobertura de todos os IMEs ou cabimento integral.

O TESTER revisou a fonte integrada exata `9fa1b30e`: seis arquivos completos/185 testes (`87589/115ee5`, saída0, 16,57 s), 26 dos 28 paths selecionados337 idênticos à preparação7d9 e somente os dois paths UI previstos diferentes, além do novo item do mapa. Schema/três SQLs/caret/ACK preservados. Parecer SHA físico `84f6c3af7cdb2788658fe3dd2ce9e2a7608af22c6bd113093e53980504b54f1f`. A conferência global de whitespace encontrou somente linha vazia no EOF da SPEC; foi removida na publicação documental, mantendo o código. O negativo administrativo `5a44c2` e o check nominal2 em9fa permanecem no parecer original. Sete pareceres completos e hashes estão no [índice de QA](inbox-337-qa/indice.json).

O pacote remoto foi novamente baixado e conferido em `ef67bf`, saída0, hash idêntico. A captura histórica positiva de homônimos foi extraída sem edição, inspecionada (somente dados fictícios), enviada em `8482ca` e validada por roundtrip `6f06c5`; asset672414695, 180.379 bytes, SHA-256 `daea864d48438e1516f38aae746e72ed0190fb2bda89fdda9072c19913efcc96`. Permanece nominal a d68, sem nova nota/captura.

`inbox-337-evidencias.json`, allowlists, validação e relatório original são registros históricos com fonte própria, não metadados do head atual. A SPEC conserva esses checkpoints. O relatório presente concentra a composição atual e não reatribui seus resultados. CI e releitura de comentários ainda pendentes antes do merge; não representa homologação presumida.

## Revisão R1 — busca de menções (C2)

O callback de busca em ConversaAberta agora permanece estável para o mesmo atendimento, incluindo atualizações do pai e respostas rápidas. O compositor espera 200 ms após a última digitação, cancela o temporizador ao fechar a lista e aborta a requisição ao trocar consulta/conversa ou desmontar. A proteção de resposta obsoleta permanece. Nenhuma nota foi enviada nesta revisão.

RED causal `cf09e8`, saída1: dois arquivos/20 casos, cinco falhas novas e 15 aprovados, antes da implementação. GREEN `b36c41`, saída0: os mesmos dois arquivos completos/20 testes, 743 ms. Inclui debounce/consulta mais recente, fechamento antes do GET, AbortSignal e resposta antiga após troca de conversa, estabilidade no pai e URL codificada.

Recorte ampliado `63674/f8ea4a`, saída0: 26 arquivos completos/376 testes, 17,50 s, maxWorkers2, sem filtro de caso ou skip. TypeScript `77234/07b3ba`, saída0, heap8192. Lint dos quatro paths de fonte/teste `f52547`, saída0, zero avisos. Esses gates não são uma regressão global nem validam os ajustes de servidor C3/C4 ainda em desenvolvimento. A CI anterior `40101081717` passou cinco jobs no head419b; não é atribuída a este código novo.

## Revisão R1 integrada — C2/C3/C4/C5/C6

O commit DEVd38 foi integrado como ecc, preservando os sete blobs servidor/testes; os quatro blobs frontend continuam iguais a540fa. Prova `3a0e3c`, saída0. Dois conflitos eram exclusivamente documentais no quadro e na SPEC: ambos os blocos foram preservados (`3987b1`, saída0). Nenhuma alteração de schema/três SQLs, permissões compartilhadas ou dependências. O extrator original permanece intacto. C3 processa aliases do mais longo para o mais curto, consulta todo o grupo e só desce se nenhum membro é visível; cache porID somente nesta tx/invocação. Ganho dirigido200→1 e limites residuais200/250 documentados no [relatório DEV](pr416-r1-server-c3-c4.md). C4 calcula escopo do sino somente no primeiro lote de menção válida.

Gates ROOT em ecc, fonte congelada, todos positivos abaixo têm terminal0:

- Global `39412/16ad36`: **930 arquivos/7.317 testes**, 276,05 s, maxWorkers2, sem filtro de casos ou skips; integração é excluída pela configuração unitária.
- TypeScript `10637/568474`: heap8192, sem diagnóstico.
- Lint global final `26067/370329`: zero erros/40 avisos herdados, teto40. A primeira tentativa `3705/cca706` terminou1 por dois nomes não usados em um helper privado de curadoria325, fora do Git; foram removidos sem alterar produto/configuração/limite. O negativo permanece no log privado.

TESTER no SHA exato ecc: **30 arquivos/431 UNIT** (`8605/f4840a`, 20,46 s), **seis arquivos completos/53 INT** (`43384/7d1293`, 221,10 s, tester490 exclusivo), TSC (`34056/678604`) e lint11 (`485fed`), todos saída0. O [parecer completo R1](inbox-337-qa/revisao-r1.md),10996bytes/SHA256 `79870a6c2ebf77e2411319db7da7dbe03e2a6c0367f7a95604ae0fe08ba7f35b`, contém comandos,11 hashes, oráculo de4.608 comparações em um caso, negativos e limites. Essas comparações não são4.608 testes independentes. As execuções C2 anteriores são subconjuntos, sem soma duplicada.

ROOT restaurou dev-gravacoes490 após a INT DEV (`56dd59`, saída0,424hashes/3mensagens1nota) e tester490 após a INT independente (`11a3d1`, saída0,424hashes/9mensagens4notas). As duas cópias snapshot permaneceram intactas. Nenhuma nova nota manual/UI ou imagem foi produzida. Sete pareceres históricos foram novamente conferidos antes de acrescentar o oitavo R1 (`f32bff`, saída0); não foram editados ou reatribuídos.

C5 mapeia os três nomes do checklist aos casos reais. C6 alinha D20 e a manutenção do índice parcial; os dois legados caíram de73.322 para12.840bytes, preservando o objeto inteiro gatesPreparacaoLimpa20261024 e links/hashes/blobs imutáveis9fa. A liberação do ZIP/PNG no formulário da PR segue pendente da resposta humana específica ao bloqueio da revisão automática. A release continua DRAFT; este registro não concede autorização de upload por outra via. Disposições em [revisão R1](inbox-337-revisao-r1.md).

## C1 — primeira execução remota e fixture de calendário

Publicação55add8ce passou nos cinco jobs da CI rápida40106490742. Integração40106514674 no mesmo SHA encontrou uma falha no shard1: teste legado de cancelamento montava domingo com agora+1dia. ROOT reproduziu11/uma falha em2076/2cdece e trocou apenas essa data pelo helper existente diaUtilAs(10). Três arquivos completos/27 INT (`37237/85094b`), TSC (`18981/2a6623`) e lint do arquivo (`f93642`) passaram; banco490 restaurado424hashes (`1aa89a`). Produção/SQL/ACL e os11 paths R1 permanecem iguais a55add. [Registro do ajuste e limites](inbox-337-ci-calendario.md). A primeira integração não está aprovada: shard4 success, shard1 failure e shards2/3 ainda em andamento no checkpoint; nova publicação e CI/Integração no head corrigido seguem pendentes.
