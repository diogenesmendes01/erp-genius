# QA estática #337 R1 — paginação do sino após revogação

Fonte exata `a3bc5cb50b67aeab155d6d7f6733f9cdba6afa71`, pai `9a9bfdc8a74cb6d2abc8487fd8b1fb766066aec2`. Worktree TESTER em HEAD detached, rastreados limpos. Esta é somente a revisão estática; cliente e banco TESTER ainda estão no schema487, enquanto esta fonte exige490. Nenhuma integração, TypeScript, import do Prisma, DDL, browser ou preview foi iniciada nesta etapa.

O P2 anterior (`take:20` antes de revalidar menções) foi tratado: a consulta lê somente notificações do próprio usuário, em lotes de100 na ordem `criadaEm DESC,id DESC`; o cursor estritamente menor usa a última linha SQL examinada, inclusive quando o lote inteiro foi revogado. A lista termina em20 itens visíveis ou no fim real. Não há teto arbitrário de páginas, offset, sort JS, acúmulo do histórico nem N+1; o custo total continua proporcional às páginas próprias examinadas, com memória de lote limitada.

O escopo de atendimentos é calculado uma vez por chamada e aplicado em uma consulta em lote aos IDs deduplicados de `MENCAO_NOTA` com `refTipo=AtendimentoWhatsApp`. A restrição adicional de conversa individual conserva `comContatoIndividual` da checagem antiga. SLA e lembrete entram sem essa ACL nova; menção com `refTipo` diferente permanece excluída. `atendimentoVisivel` anterior também usava o mesmo `escopoAtendimentos` e não exigia envio nesta rota. Consumidores de `/inbox` e `/tarefas` seguem usando `listarNotificacoes`, sem API/contrato novo.

Os testes novos cobrem 20 menções revogadas antes de SLA21/lembrete22, 205 revogadas antes de 21 válidas, empate por ID, cursor após lote totalmente revogado, deduplicação da referência, `refTipo` incorreto, usuário sem sessão e preservação de avisos legados. A integração adicional usa PostgreSQL para conferir a ordenação dos IDs empatados; a execução independente ficará para o schema490 preparado pelo ROOT. Nenhum achado alto/médio estático identificado até aqui.

Identidade de objetos Git, R1 versus pai9a9: `prisma/schema.prisma` `7365328d336ff6ae5892e46f1e595f25923e3f1e`; migrations 140000 `937af8132d8c33a27d068feefcdc29bdf8db8241`, 170000 `1fdef70b7d10a9337d17f343838ec4527e756f83`, 180000 `4154f32fccdaa04141ab3003e189faf5ed9bfb88`. OIDs iguais nos dois commits. Nenhum diff em schema, migrações ou `src/server/inbox`; `git diff --check` do incremento terminou0. A fonte #410/SLA não foi incorporada.

Pendente: ROOT preparar Prisma/banco TESTER490 e novo snapshot; depois executar os cinco arquivos INT completos da #337, sem filtro/skips, e registrar saída terminal. Visual, SLA integrado, global e publicação não estão homologados por esta leitura.

## Execuções independentes após Ready TESTER490

O ROOT preparou as três migrations e o cliente Prisma490, confirmou 424 hashes/9 mensagens/4 notas e criou snapshot337490; nenhuma DDL/generate foi feita pelo TESTER. Fonte permaneceu `a3bc5cb50b67aeab155d6d7f6733f9cdba6afa71` e rastreados limpos.

- Unidade, chunk `e01ce8`, **exit 0**: 6 arquivos/68 testes (`notificacoes-mencoes`, `consultas-mencoes`, `SinoNotificacoes`, `mencoes-nota`, `schema-mencoes`, `identificacao-registro`), maxWorkers2; recorte, não global.
- Integração sessão `26765`, chunk final `0783a9`, **exit 0**: **3 arquivos/30 testes**, 89,63 s. A invocação listava cinco argumentos, mas dois caminhos antigos sob `src/server/inbox/` não existem e Vitest selecionou só `nota-mencao`, `crm/notificacoes`, `crm/lembretes`. Não se declara essa sessão como cinco arquivos.
- Integração corretiva sessão `13301`, chunk final `00e71a`, **exit 0**: **2 arquivos/16 testes**, 52,99 s, nos caminhos reais `src/server/whatsapp/nota-interna.int.test.ts` e `src/server/whatsapp/inbox-idempotencia.int.test.ts` completos. Ambas as invocações foram sequenciais, com `vitest.integration.config.ts --maxWorkers=1`, sem filtro `-t` nem skips e transportes externos vazios. Assim, cinco arquivos/46 testes foram cobertos em **duas sessões distintas**, não uma.

Banco TESTER490 liberado ao ROOT somente após o terminal de `13301`; restauração pelo helper337/snapshot490 é responsabilidade do ROOT e não se presume concluída aqui. O recorte próprio confirma o P2 no PostgreSQL real sob o schema490, inclusive saturação/ordem. Não inclui `alertas-sla.int`, a correção isolada #410, browser/visual, global integrado ou CI; estes permanecem gates separados.
