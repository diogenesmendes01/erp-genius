# QA DEV — Inbox #371

Fonte sobre 5be40c79, branch codex/inbox-e4-371-carga-pessoas. Integrar somente o delta: os pais privados contêm schema grant ainda sem ligação de ACL autorizada.

## Evidências

- RED inicial b7b76d: falha real de radio ausente; oito falhas de API inexistente são scaffolding, não prova de autorização. RED adapter f14e8e: 3 falhas reais de carga omitida/invalidada/erro.
- UNIT final 17dc7c EXIT0: 7 arquivos/54 casos, diretório transferir completo e carga-pessoas.test, UTC/w1/1024, sem filtro de caso/skips.
- Campos completo 48e540 EXIT0: 28/28. Negativo 8e9e11 preservado (1 falha nominal/27 pass). Removido somente item Pessoa/select; acessibilidade equivalente por radios testada. Não declarar o mapa literal.
- Lint a7f5d3 EXIT0 nos 10 SRC alterados, zero erros/avisos ESLint. Mensagens Git CRLF são normalização de checkout, não diagnóstico ESLint.
- Native carga completo session90660/e7573c EXIT0: 11 casos/52,99s. Regressão consultas-acoes-atendimento.int completa session77131/74af20 EXIT0: 2 casos/13,69s. Config original, UTC/w1/1024/no-fileparallel, sete providers vazios, sem filtros/skips; execuções em série.
- Primeiro caso nativo comprova CHECK Atendimento_status_encerrado: duas atualizações inconsistentes rejeitadas pelo constraint específico, linha e contagem intactas. Estados inconsistentes são impossíveis no banco; o UNIT prova o AND do predicado, nativo prova integridade e contagem dos estados válidos. Nenhum CHECK desabilitado.
- Casos cobrem total fora da carteira sem expor conversa/CRM, zero real, candidato inválido, capacidade ausente, origem fechada/fora de escopo, ator/candidato revogado entre leituras, limite200 e APIs históricas atribuir/convidar.

## Infra e custo

Perfil ci-integracao, client383782975cb5cd3b979559a2a48eea4ad47ce92913098387a089ca6f3e9a34ef, contagem real493 migrations/425 tabelas, grant494 reservado/aplicado pelo ROOT sem InsightsA. Não atribuir a baseline492. Admission5d40d9 e releasebfdc64: zero outros atores; release não afirmou baseline. ROOT restaurou90d2ac EXIT0,425 hashes/baseline504; sem lease SQL depois disso.

RO afb818 EXIT0: BEGIN READ ONLY, pg_indexes e EXPLAIN sem ANALYZE, rollback. Onze índices reais, nenhum responsavelId; baseline1 atendimento/1 aberto. Planos do núcleo agrupador SeqScan/Sort/Aggregate com custos12,79/13,93 são irrelevantes para escala real. Não prometem latência/custo constante nem justificam índice496. Uma groupBy, várias consultas de ACL/candidatos/revalidação.

Escopo, permissões, kernels de transferência, distribuição, Header, Compositor, schema/migration, cliente/config/package permanecem sem delta. Sourceproof e hashes no output/inbox-371-sourceproof-private.json. #370 continua aguardando autorização humana específica; nenhum grant ligado à ACL. Carga é snapshot; presença376 separada.

## Pendências

QA independente do SHA, gates originais da composição e visual desktop/mobile/temas. Sem homologação presumida, sem D5 completo, sem build/servidor/SQL adicional.
