# Inbox #337 — composição final de menções e avisos

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

`inbox-337-evidencias.json`, allowlists, validação e relatório original são registros históricos com fonte própria, não metadados do head atual. A SPEC conserva esses checkpoints. O relatório presente concentra a composição atual e não reatribui seus resultados. Revisão independente do ajuste final, publicação, CI e releitura de comentários ainda pendentes antes do merge; não representa homologação presumida.
