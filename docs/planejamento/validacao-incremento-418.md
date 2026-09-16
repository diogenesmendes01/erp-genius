# Incremento 418 — conferência e proposta de aproveitamento

2026-09-14. `equivalencia-estado-tx.ts` confere matrícula/alocação, compatibilidade das turmas, regras, fontes oficiais e requisitos do destino, produzindo snapshot e hash. Teste de integração passou: leitura repetida conserva hash, nova fonte oficial muda o estado, requisito sem fonte fica pendente e nenhuma alocação é criada nessa conferência.

`equivalencia-proposta.ts` implementa prévia e registro da proposta para gestão, com revalidação de papel, versão, hash conferido e idempotência. **Ainda não testado contra as novas tabelas**: a migração está em revisão e não foi aplicada. O schema Prisma contém as tabelas planejadas, enquanto o SQL permanece em `docs/planejamento/equivalencia-transferencia-ddl.sql`. Não declarar banco e schema sincronizados nesta etapa.

Coletor `pendencias-fechamento-tx.ts`: **3/3 integrações** passaram, incluindo segunda chamada, cancelamento, realização sem nota, pendência da escola e isolamento. Evidência: `docs/validacao-pendencias-fechamento-418-2026-09-14.json`.

**12/12 testes unitários** de equivalência/elegibilidade passaram, assim como lint dos novos serviços. TypeScript passou antes dos últimos ajustes do rascunho de banco. A revisão SQL identificou comparações com matrícula nula e serialização de versões que ainda estão sendo ajustadas antes da aplicação local.

Permanecem pendentes decisão/aplicação do aproveitamento, integração de recuperação/aproveitamentos anteriores, fechamento persistido, gates de progressão e UI correspondente. Não houve alteração de produção nem homologação visual.
