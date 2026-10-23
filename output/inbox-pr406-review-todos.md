# PR #406 — atendimento de todos os comentários da R1

Review5626682648, publicação nominal1bb721b7e6e72bbfd8f5f8fe7f3f944bef0440b3.
Patch preparado no worktree ROOT sobre9ed8a88a; apenas um teste duplicado foi
removido do arquivo de integração. O produtor, o teste unitário e o arquivo
de integração eram byteidênticos à publicação406 antes desta edição.
Este é um patch a aplicar na composição final406; não atribuir a ele a CI
remota ou testes da fonte composta que ainda não existe.

| Item | Tratamento |
|---|---|
| C1 MEDIUM | CI contra main continua obrigatória depois dos pais; nenhum check da PR empilhada foi inventado. |
| C2 MEDIUM | Já atendido na resposta6362517454: corpo da PR contém tabela20estados/100APP/64referências/36N/A e diferenças justificadas. Este patch não altera tabela, ZIP ou fontes visuais. |
| C3 LOW | Removido de eventos-sse.int.test.ts o caso puramente formatador com IDs públicos u9. A mesma prova estrutural continua em eventos-sse.test.ts: quatro campos públicos, framing e ausência de paraUsuarioId. Os dez casos restantes de integração preservam escopo, revogação, TTL, destinatário, grupos e formato básico. Não há caso novo ou alteração de comportamento. |
| C4 LOW | Avaliado o delta próprio:13arquivos output, sendo7JSON/13046linhas e6MD/209linhas. Os JSON guardam a comparação individual app/protótipo, inventário/hash/allowlists e métricas que sustentam o aceite visual obrigatório da320. Os MD descrevem fontes e limites de cada executor. Manter esses registros preserva a auditoria verificável e os links já publicados; removê-los apenas por tamanho quebraria essa rastreabilidade. Não há PNG novo, dumpHTML, cookie, segredo ou probe executável acrescentado por este patch. O ZIP e seu SHA continuam a alternativa para inspecionar as imagens. |

## Verificação própria do patch

Node22.23.2/executáveis instalados, sem instalação, schema, migration ou transporte.
Todas as saídas abaixo são terminais0 no mesmo executor:

- Unitário SSE:1arquivo/8testes, aae707; mantém explicitamente a negativa de
  vazamento paraUsuarioId e IDs públicos contendo u9. Sem filtro/skips.
- Integração SSE restante: sessão4022/72c72e,1arquivo/10testes,28,68s,
  vitest.integration.config.ts/maxWorkers1/perfil integracao/banco descartável487.
  Arquivo completo, sem filtro/skips; não é integração completa do ERP.
- TypeScript: sessão98906/9564e3, heap8192/--noEmit/--prettyfalse, saída0.
- Lint do único arquivo alterado:5f8dc4,0erros/0avisos, saída0.

Não houve alteração produtiva, novo browser, captura, seed, E2E, serviço externo
ou reenvio de mensagem. O teste removido não usava banco; a redução de11para10
casos de integração é intencional e a cobertura estrutural permanece na suíte
unitária. QA independente do patch e aplicação no head final406 pertencem à
próxima coordenação, assim como retarget/CI final/merge após os predecessores.
