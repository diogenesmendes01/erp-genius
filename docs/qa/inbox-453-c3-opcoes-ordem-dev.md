# PR453 C3 — opções determinísticas e escopo irrestrito (DEV, nativo pendente)

Recorte autorizado pelo integrador em 26/10/2026, sobre HEAD próprio274170a6. Pré-requisito explícito: somente o blob público cf5c28a283ae79623bf28c5c5aa998b3c54e5ee8 de src/server/whatsapp/operacoes-atendimento.ts, que acrescenta a correção OR irrestrito já aprovada. Nenhuma ancestralidade, UI/B1 ou fonte privada foi importada. A seleção pública futura deve aplicar somente o delta C3 sobre esse pré-requisito; não reaplicar OR.

Review real: https://github.com/diogenesmendes01/erp-genius/pull/453#pullrequestreview-5656812100. O modelo Oportunidade/Lead não possui updatedAt/atualizadoEm geral. Ruling técnico ROOT: ordenar os cadastros mais recentes por CRIAÇÃO, usando criadoEm desc e id desc; não representar isso como atualização/recência de edição, nem criar timestamp/schema/migração.

A consulta limitada a200 agora tem ordem determinística. O laço dispensa COUNT por lead somente quando o escopo comercial canônico inicial é exatamente{}; não é um bypass por papel. Para escopos restritos permanecem as releituras/COUNT e a interseção comercial anterior. Destinos acadêmicos, canais e confirmações permanecem literais. A lista é um snapshot para seleção, não autoridade para confirmar; não há alegação de linearização global de ACL.

TDD em arquivo UNIT inteiro, config vitest.config.ts original, Hermes local/heap1024, UTC, sete provedores vazios, DBlocalhost:1, maxWorkers1/no-file-parallelism, sem filtros/skips:

- RED940b25 EXIT1:14casos,3falhas assertivas (orderBy ausente e duas expectativas zeroCOUNT de escopo vazio),11controles aprovados. Não é falha de import/fixture/infra.
- GREENe4950c EXIT0:14/14, mesmo arquivo completo após patch mínimo. Controles VEN/equipe/Admin com escopo restrito, perfil misto VEN/PROF e professor acadêmico preservados. A fixture UNIT passou a fornecer escopos restritos aos perfis restritos, em vez do antigo mock{} universal.
- Lint focal3TS e20659 EXIT0, sem avisos; nenhum guard/config/exceção/teto alterado.

Novo arquivo operacoes-atendimento-opcoes-ordem453.int.test.ts: quatro casos AUTORADOS, AINDA NÃO EXECUTADOS. Um caso usa207leads e três datas com empates, exige exatamente top200 por criação/id desc, resposta repetida igual, zeroCOUNT com spy pass-through e fotografia sem writes. Três casos usam sessão/ACL/SQL reais para VEN/equipe/misto, comprovam carteira e experimental próprio sem permitir comercial alheio, preservam COUNT e fotografia. Fetch externo bloqueado; nenhuma mensagem/provedor/DDL é necessário. Exige lease ROOT antes de qualquer execução SQL. Estes testes não são prova de banco até terminal próprio0 e não constituem suíte global.

GP362/Doc454, C4, schema/client/perfil/dependências e AGENTS histórico permanecem congelados. Sem commit/push, SQL, instalação, cluster ou publicação nesta etapa. QA independente, CI e browser/foco do fluxo453 continuam gates próprios; este recorte não conclui aPR/issue361.
TSC original --noEmit --incremental false/heap8192, mesmo perfil isolado/UTC/sete provedores vazios/DBport1: executor a476f3, sessão31108 acompanhada até terminal4f5060 EXIT0, log vazio sem diagnósticos. Nenhuma SQL foi executada. Diffcheck824dd1 EXIT0; apenas dois tracked C3 e dois paths novos autorizados, além do AGENTS histórico fora do recorte.

## Nativo completo e restauração confirmada

Após TFS favorável7e7055 e admissão ROOT86b66e, arquivo nativo completo4/4 em18.06s, executor a70b60/sessão75365→c8bd74 EXIT0. Mesma sessão acompanhada até terminal, config integration original/w1/no-file-parallelism/Hermes1024/UTC/sete provedores vazios/fetch bloqueado, require_escalated, sem filtros/skips/bail/retry/edição/outroSQL. Fonte READY9c4b e quatro pins permaneceram iguais; recibo privado c7685f89c380b588d9e9ded6cbf6c116837a3b088cf77766046dd0e485334141, log SHA e23bb18682c371ef04f203790ade1a33b4fdbe8e50021dd0ead3ce084c9e5cb0. ROOT confirmou restauração A502/566 em5bc44b EXIT0; SQL permanece encerrado.

Este resultado substitui somente a pendência de execução nativa DEV registrada acima. Não é regressão global, QA independente ou aceite de teclado/foco. Checkpoint local autorizado somente nos quatro pathsC3; o OR público é pré-requisito de fonte, sem ancestralidade importada, e o delta selecionável sobreCF contém somenteC3. AGENTS histórico permanece fora do índice.
