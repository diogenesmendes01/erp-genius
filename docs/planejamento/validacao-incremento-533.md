# Incremento 533 — Q99 integrado às condições e à prévia

O planejador mensal usado por `continuidade-estado-tx.ts` agora aplica o calendário financeiro contratado depois da referência mensal Q160 e do ajuste Q90. Calcula a antecedência Q64 sobre a data efetiva e devolve memória com a data original, data ajustada e referência/versão. A mesma implementação atende a retomada cuja aplicação já foi comprovada pelo fluxo existente. Não altera cobertura, preço ou cobranças anteriores.

As condições contratuais aceitam o formato histórico explícito `MANTER_DATA` e os objetos `MANTER_DATA`/`PROXIMO_DIA_UTIL`. O segundo preserva um snapshot completo de vigência, dias úteis e feriados. A migração 880 amplia a validação no banco sem reescrever versões anteriores; aplicada somente ao banco de teste local.

O formulário exige escolha de regra e permite preencher o calendário financeiro. O histórico mostra o calendário completo antes da aprovação independente, incluindo ausência de feriados. A prévia mostra vencimentos calculado e efetivo e a referência aplicada. Não utiliza o calendário escolar nem presume país ou fim de semana.

Evidências:

- 31 testes unitários aprovados: `docs/validacao-unitarios-final-533-2026-09-15.json` (planejamento mensal, composição financeira e seleção de versão).
- 12 integrações de condições aprovadas: `docs/validacao-condicoes-final-533-2026-09-15.json`. Incluem snapshot aprovado imutável, representação antiga, objeto manter data, calendário inválido/duplicado e datas fora de vigência.
- Um cenário completo de contrato/aditivo, ativação e prévia aprovado: `docs/validacao-previa-final-533-2026-09-15.json`; outros 34 cenários não selecionados nesta execução. Duas datas de feriado e fim de semana prorrogam vencimento de 05/11/2099 para 09/11/2099 e emissão para 30/10/2099; versão futura não substitui a vigente. Fixture simulada, sem serviço externo real.
- ESLint dos arquivos alterados e build aprovados (`docs/validacao-build-533-2026-09-15.log`). As últimas alterações posteriores ao build acrescentaram somente testes de retomada e objeto manter data, aprovados separadamente.

Correções durante validação: atualização de expectativas dos testes para a memória adicional e para o vencimento efetivamente prorrogado. A revisão da migração incluiu o objeto manter data antes da primeira aplicação.

Limites: não houve validação interativa da interface ou implantação. A emissão recorrente continua bloqueada; Q161/Q162 não foram respondidas nem presumidas. A regra financeira agora alcança a prévia, mas não comprova a conclusão do emissor recorrente ou de todas as funcionalidades do projeto. O wrapper do incremento 532 delega ao planejador comum, evitando duas fórmulas distintas.
