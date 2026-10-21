# Incremento 405 — regressão de notas e resultado no portal

2026-09-14. Portal agora exibe Reposta em [data] usando a validação/realização efetiva, considerando a última correção aprovada. Uma correção que retira conclusão não restaura a data anterior; entrega conserva sua própria data. Datas de resultado identificadas como UTC. Particular deixa de ser rotulada presencial, pois também pode acontecer online.

Validação ampla:84 lançamentos e3 relatos passaram; segunda chamada inicialmente7/8 por mensagem esperada diferente do guard que já rejeitava autoaprovação. Corrigido texto esperado para Oficialização exige outra pessoa; repetição8segunda chamada+10permissões passou, incluindo data do resultado e retirada por correção. São105 testes distintos aprovados entre essas execuções, não uma execução única nem toda a SPEC.

Relatórios: docs/validacao-avaliacoes-relatos-405-2026-09-14.json contém94pass1fail histórica; docs/validacao-notas-data-405-2026-09-14.json contém18pass. TypeScript e lint dos arquivos alterados passaram.

Q57 rota/formulário e histórico de relatos implementados;3 testes de integração confirmam autoria e isolamento entre matrículas. SQL190 adicional ainda em preparação. Transmissão Drive ausente. Remarcação185 em testes dedicados. Escopo geral ERP/CRM/WhatsApp/avaliações permanece incompleto.
