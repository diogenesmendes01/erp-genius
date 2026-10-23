# #323 — integração e publicação individual

Estado: código e QA aprovados localmente; CI remota e integração na main ainda
pendentes. Não contar a issue como concluída antes de entrar na main.

Fonte DEV corrigida: `0c61fb628ad3a2c63b1963f943b6d8e159c9b9b2`, pai nominal
`6076cd818fc397d0aedc6059e09ecac775255edc`. Fonte ROOT integrada e testada:
`6eb578478e3f19c8fe56f5ea88686d8c1b08e34c`. Código inteiro src/scripts/prisma,
package e lock idênticos entre ambas. A publicação usa o commit DEV como pai e
acrescenta somente este relatório e o parecer independente; a reserva de
migrations da futura #337 fica fora da PR. Base publicada: #408,
`ddf9a9bd51eb6fd54abd2a6e64381a229a25190b`.

## Comportamento entregue

Consultas mínimas e autorizadas do cabeçalho/Detalhes, resolver comum da pessoa
para ficha e tags, interlocutor B2B contextual e propagação do mesmo Db nas
verificações de escopo. Marca IA dos campos consulta apenas campoId/autorId do
último evento. A rota autenticada /painel/[aba] entrega Detalhes sem cache;
oportunidades/atividade retornam404 enquanto suas issues não forem implementadas,
insights400 sem consulta. Preservados setores não comerciais, restrição do
telefone pedagógico, painel E1 e ações existentes. Não há UI ou schema novo.
Documento/nascimento LATAM e autorização contextual D1 continuam nas issues
específicas, conforme as decisões registradas.

A QA nominal encontrou um P2 real: catálogo ativo podia aparecer sem pessoa
autorizada, apesar da capacidade editarTags. Foi corrigido em commit separado
por pessoa&&editarTags. Dois novos unitários comprovam ausência de consulta e
duas integrações não vazias verificam pessoaIdnull/capacidadetrue/opçõesvazias
para lead sem pessoa e responsável legal. REDs e falhas de fixture anteriores
permanecem descritos no relatório DEV; não são apresentados como sucesso.

## Verificação final observada

Node22.23.2; todos os resultados abaixo têm saída terminal0 no mesmo executor.

- ROOT global unitário: sessão8550, chunk20f73d, **908 arquivos/7141 testes**,
  203,06s, maxWorkers2, configuração unitária exclui integrações, sem filtro de
  nome/skips novos. Log privado inbox-323-6eb-final-unit-r2.log.
- ROOT TypeScript: sessão11742/d0cb75, heap8192, --noEmit/--prettyfalse, saída0.
- ROOT lint: sessão43264/e429d9, saída0, **0 erros/40 avisos preexistentes**.
- ROOT integração: sessão44004/183504, **3 arquivos/28 testes**, 123,91s,
  vitest.integration.config.ts/maxWorkers1/perfil integracao/banco descartável487.
  Arquivos completos painel-detalhes.int, paineis.int e paineis-envio.int;
  sem filtro de nome/skips. É recorte, não toda a integração do ERP.
- DEV pós-patch: 15 arquivos/145 unitários; 3 arquivos/28 integrações,
  sessão57187/8ad6d7; TSC31727/716fcd e lint3fontes/max0, todos0.
  Regressões anteriores adicionais e seus limites constam do relatório DEV.
- TESTER exato0c61: parecer favorável output/inbox-323-review-tester.md,
  SHA256 original b669d3edaad91aad0f7728f08b35cb67c569e4943ba7a1436ecb865a34382528.
  O original permanece preservado; somente o blob publicado remove as linhas
  vazias adicionais ao fim do arquivo para passar git diff --check, sem alterar
  o conteúdo do parecer. A primeira preparação parou nesse check antes de
  criar a branch; índice privado anterior preservado.
  Nominal6076:6arquivos33unit e3arquivos26INT completos0. Rechecagem do patch:
  unit11/11 2b2e3c0 e INT dirigido2pass/11filtrados7f2ee10; os filtrados não
  contam como execução nova. QA não é atribuída à fonte nominal depois do patch.
- ROOT smoke da aplicação real fonte0c61: sessão13267/e0f5500, seis contextos
  humano-compositor, 1440x900/1024x768/390x844 em claro/escuro, Chrome155,
  documento HTTP real e hidratação. Script público de captura inalterado.
  Seis PNG privados inspecionados; é smoke do bundle, não repetição da matriz
  visual264 nem homologação de UI nova. Manifesto registra GET inicial da thread
  cancelado e recuperado, sem falhas finais. Nenhum PNG/manifesto técnico é
  incluído nesta PR de backend. Nenhum serviço externo foi ativado.
- Preview97442 encerrado por CtrlC, saída1 esperada; porta3110 livre9b7e7a.
  Banco A restaurado após smoke b45fc70:424hashes/553originais/9msgs4notas;
  TESTER restaurado c4e8680:424hashes/1388originais/9msgs4notas. Bloco Next de
  dez linhas removido pelo DEV somente após conferir o diff; AGENTS preservado.

Tentativas operacionais anteriores: global12016/3c56d0 falhou porque o sandbox
impediu rename do cache temporário Vite;908 suites sem coleta/zero testes.
Integração48980/7be344 falhou no setup por localhost inacessível no sandbox.
Repetições explicitamente autorizadas fora sandbox passaram conforme acima;
nenhuma dessas tentativas foi contada como aprovação. O global nominal a451
908/7139 pertence à fonte anterior ao P2, e não ao código final.

## Dependências e limites de integração

PR empilhada sobre #408 para revisão do delta individual. Depois de integrar
as dependências na main, reconciliar a fonte final, mudar a base para main e
exigir CI/revisão apropriadas antes do merge. Preservar também as adições
concorrentes da QA #280 (docs/e2e/playwright/seed-qa/package scripts), que ainda
não pertencem a esta fonte local; não sobrescrever esses arquivos por árvores
antigas. Não houve seed/e2e dessa frente, instalação, migração323, envio real,
deploy ou fechamento presumido da issue. O quadro DEV registra o histórico;
este relatório e o parecer independente atualizam seus gates antes pendentes.
