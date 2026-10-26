# #333 — correção de concorrência e QA independente da PR #443

O cancelamento aguardava a intenção depois de travar o atendimento com `FOR NO KEY UPDATE`. Um claim concorrente já segurava a intenção e precisava do `FOR SHARE` do atendimento exigido pelos gatilhos264/265. A contraprova observou o ciclo e o PostgreSQL abortou o claim com `40P01`; o cancelamento só prosseguiu após esse rollback.

A alteração produtiva é uma linha: o atendimento usa `FOR SHARE`. O cancelamento não escreve esse registro; o lock continua protegendo sua estabilidade contra alterações e exclusão, enquanto a intenção permanece em `FOR UPDATE`. Permissões, autoria, replay, CAS, Evento e aviso não mudaram. O mesmo teste passou exigindo claim confirmado, recusa de domínio do cancelamento, intenção `ENVIANDO` e nenhum Evento de cancelamento. Erro de infraestrutura não satisfaz a expectativa. Isso corrige o ciclo reproduzido, sem alegar ausência global de deadlocks ou prova fim a fim de provedor.

## Fonte pública e escopo

O candidato `8345c2340f209f40e6928f918bf643b0029b1ba2` seleciona a correção do checkpoint DEV `2fc7aec3` sobre o head público anterior `fe23d132`. Sua diferença tem seis arquivos: núcleo de cancelamento, contraprova, adaptação da baseline do teste de rollback, SPEC, QA própria e quadro público preservado. Não importa a implementação #362, migrações501/502, schema, dependências ou ancestrais privados do DEV.

O teste de rollback mantém cancel1/replay1. Após o setup que reabre a intenção, drena o listener e mede sua baseline; a transação revertida precisa acrescentar zero avisos e zero Eventos. O ambiente DEV com502 mediu2→2; o TESTER sem502 mediu1→1. O aviso válido do setup não é confundido com publicação de rollback.

## Verificação independente no candidato exato

| Verificação | Executor/sessão e terminal | Resultado |
|---|---|---|
| TypeScript original, heap8192, noEmit/incrementalfalse | 96609 → `8506f9` | EXIT0 |
| UNIT global, configuração original, dois workers/heap1024 | 24270 → `595c71` | EXIT0;997 arquivos/8.633 testes |
| Lint global original | 62951 → `9711a4` | EXIT0;0 erros/57 avisos |
| Contraprova de claim | `c1b220` | EXIT0;1/1 |
| Ações de agendadas333 | 35242 → `5c3195` | EXIT0;20/20 |
| KEY SHARE | `ed6c0e` | EXIT0;1/1 |
| Consulta do painel Atividade | 90498 → `52121c` | EXIT0;3/3 |

Os quatro arquivos nativos completos somam25 casos, sem filtros, skips ou retries. Configuração de integração original, Hermes/Node22, UTC, um worker e sete provedores externos vazios; fetch inesperado é bloqueado. A baseline pré502 observada foi avisos1→1/delta0, Eventos1→1/delta0 e status `PENDENTE`. Artefatos próprios do TESTER: claim SHA256 `e4564c859bfade508b39d9878bdd72c1f1ac0ff8f75ac45627fd629e14cd4967`; NOTIFY SHA256 `818900bde3e5967b0d7e5df296e4a1a859c6119625dbd4a915853a36cce70e1d`.

Relatório privado completo do TESTER: `inbox-333-8345-qa-tester.md`, SHA256 `20af587711c9ef4055b19a7f1869fbca2f95a999bfddc372bab6f7dc8fddcb83`. Os logs e JSON brutos permanecem locais; este registro publica os resultados e suas qualificações.

## Ambiente e resultados anteriores preservados

O TESTER usou seu próprio client gerado da fonte443, SHA256 de schema `647c2586589198b10c9345265e0cce7a43819d5cb44633dbad5e0e0b611fae2b`. Seu banco descartável `tester` é um superset com497 migrações e426 tabelas, sem501/502; as492 migrações da fonte estão presentes. `prisma migrate status` terminou0, sem aplicar migrações. Os casos não usam os campos posteriores de documento/prospecção. O ROOT restaurou o snapshot de1.445 linhas após os25 casos (`5d606e EXIT0`). Nenhum banco de produção foi usado.

Uma primeira rodada com o client500 e artefatos gerados de versões posteriores passou22 nativos, mas o TypeScript terminou2 por incompatibilidade de ambiente. Esses22 não foram reatribuídos ao client443: os25 acima foram executados novamente depois do alinhamento. Foram preservados o client próprio anterior e os artefatos históricos não rastreados; tipos Next foram gerados para o candidato. Nenhum arquivo rastreado, tsconfig, filtro ou exclusão da suíte foi alterado para obter os resultados. A primeira geração em1GB terminou134 por OOM; a repetição documentada em8GB terminou0. Nenhum pacote foi instalado ou compartilhado.

## Pendências da PR

Esta atualização não homologa o visual. C1 continua exigindo o aceite de `painel-atividade` e `painel-atividade-agendadas` antes de sair do rascunho. A CI do head final contra main e a composição com as dependências continuam necessárias; os testes locais não são CI remota. As mensagens de captura dos testes UNIT do CLI são doubles e não representam novas PNGs nativas.

C4 mantém o alias real `text-amber-700` definido pelo tema; C5 já usa diretório temporário por execução; C6 preserva a regra atual de cancelamento com `tarefas.ver`, autor próprio/Administrador e IA somente Administrador. A decisão pendente sobre gerente pedagógico no agendamento E4 não foi aplicada nesta correção333. Nenhum merge, fechamento de issue, envio real ou deploy foi realizado por esta verificação.
