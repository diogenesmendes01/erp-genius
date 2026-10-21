# Incremento 420 — decisão independente e consulta por papel

2026-09-14. `equivalencia-decisao.ts` implementa decisão independente, hash da revisão, versão atual e revalidação das fontes. Aprovação exige participantes atuais; rejeição continua possível para preservar a resolução histórica de uma proposta já inelegível. Reenvio da mesma decisão não cria outra decisão nem declara que houve aplicação.

O cenário integrado de proposta foi ampliado com aprovação por outra pessoa, reenvio e consultas por papel. Passou: a gestão recebe a visão pedagógica; Secretaria recebe visão de execução sem snapshot/mapeamentos/fontes, e professor não recebe acesso. Evidência: `docs/validacao-consulta-equivalencia-420-2026-09-14.json` (1 cenário aprovado, 4 não selecionados).

A suíte nova de decisão inicialmente falhou em suas três fixtures, que tentavam escolher diretamente a regra inicial da turma. A regra deve vir da publicação vigente. Relatório intermediário: `docs/validacao-decisao-ampliada-420-2026-09-14.json`; a correção está em andamento. Esse relatório não comprova validação da suíte ampliada.

Execução e tela ainda em desenvolvimento. A revisão do executor identificou ordem de locks inversa à preparação/decisão e solicitou alinhamento antes da integração. O fluxo legado de transferência ainda não foi substituído, e não há conclusão integral de Q153/Q154.

Após corrigir as fixtures, **3/3 integrações de decisão passaram**: `docs/validacao-decisao-ampliada-420-corrigido-2026-09-14.json`. A tela de preparação foi entregue pelo agente com lint/TypeScript aprovados, ainda sem homologação visual; aprovação/execução pela interface continuam pendentes.
