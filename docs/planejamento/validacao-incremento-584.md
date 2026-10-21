# Incremento 584 — proposta e aplicação da agenda inicial de segunda chamada

O fluxo ganhou persistência de proposta, decisão independente e aplicação. A prévia confere a fonte aprovada/disponibilizada, contexto da matrícula e avaliação, saldo, prazo, atribuição docente integral, conflitos e calendário. Propor preserva o estado conferido sem criar encontro ou reserva. A aprovação revalida o conjunto e materializa encontro, reserva e vínculo na mesma transação. Rejeição preserva histórico e não aplica efeitos.

A migration `20260915125000_agenda_inicial_segunda_chamada` acrescenta as três tabelas e a referência de origem no encontro. Guards impedem autoaprovação, alteração da proposta/decisão/aplicação e forjamento direto da origem nova. Aplicação confere calendário e exceção explícita, contexto, nota oficial, prazo, atribuição docente, disponibilidade e snapshot. O guard da reserva continua impondo saldo e condição contratual. Q151 é conferida no início e no último instante do encontro.

A página `/academico/segundas-chamadas/propostas/[propostaId]/agenda` permite preparar prévia, justificar período não letivo, propor, decidir e consultar histórico paginado. Mostra datas civis de feriados sem conversão indevida de fuso. O painel anterior agora encaminha ao novo fluxo. As funções legadas de criação e reserva foram retiradas de Server Actions e do formulário cliente; permanecem como compatibilidade interna e em testes históricos.

## Correções da integração

- Revisão antes de aplicar corrigiu ordem de locks, consulta que omitiria aulas coletivas, referência incorreta de reserva comercial, tratamento do snapshot JSON e proteções da cadeia aplicada.
- A primeira tentativa de migration falhou por parêntese SQL. Foi confirmado que nenhuma tabela nova persistiu e que a migration não havia terminado. Somente no banco descartável local foi marcada como revertida; corrigida antes da aplicação bem-sucedida. Não editar a versão aplicada.
- Duas fixtures de conflito estavam criando rascunhos, não encontros previstos; foram corrigidas. O ensaio de concorrência passou a esperar duas sessões efetivamente bloqueadas no PostgreSQL, evitando disparos simultâneos do carregamento dinâmico do mock de autenticação do Vitest. A aplicação continua sendo realmente concorrente.
- Corrigidos payload da prévia que excedia o schema estrito e apresentação de datas civis no formulário.

## Evidências finais

- 64 testes de integração aprovados em uma execução conjunta, zero falhas/pendências: `docs/validacao-integrada-final-584-2026-09-15.json`. Inclui sete cenários novos e 57 de regressão histórica.
- Cinco testes de schema/renderização aprovados: `docs/validacao-unitaria-584-2026-09-15.json`.
- Prisma validate, geração do client, TypeScript, lint direcionado e build aprovados; logs `validacao-prisma-584`, `validacao-generate-584`, `validacao-types-584`, `validacao-lint-584` e `validacao-build-584`, de 15/09/2026. O build inclui a nova página dinâmica.
- A migration 125 foi aplicada ao banco descartável local após a recuperação da tentativa malsucedida descrita acima. Nenhuma migration já aplicada foi reescrita.

## Limites verificados

- A coluna de origem é nullable para encontros anteriores. Inserções SQL diretas sem origem ainda seguem o caminho legado; fechar essa transição e proteger integralmente atualizações de encontros previstos permanece necessário. A retirada da Server Action não equivale a fechar essa lacuna SQL.
- A nova página admite Secretaria, mas o painel de avaliação que oferece o link é restrito à gestão/professor. Falta uma entrada administrativa adequada para a Secretaria localizar avaliações ainda sem agenda, sem abrir notas ou acesso pedagógico amplo.
- Não houve ensaio interativo no navegador, implantação nem importação de dados reais. A resolução do impedimento escolar Q164 segue pendente.

O novo fluxo tem aplicação funcional, mas esses limites impedem declarar a frente integralmente concluída.
