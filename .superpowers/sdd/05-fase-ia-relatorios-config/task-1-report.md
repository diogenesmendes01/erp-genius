
# Task 1: trava de pré-requisitos

- Criado `src/test/pre-requisitos-fase5.test.ts` (helpers modelTem/enumTem por regex no schema; 5 testes do brief).
- Falha inicial (vermelho): `fase2_nomes` e `fase3_nomes` (nomes do plano ausentes no main).
- Desvios do brief, adaptados ao código real: `Tarefa.leadId` em vez de `oportunidadeId`; `Tag.ativo` em vez de `arquivadaEm`; `PrazoRespostaSetor{finalidade,minutos}` em vez de `ConfigSetorAtendimento{prazoPrimeiraRespostaMin}` (não existe no main). Step 3 (SDK) já feito pelo integrador: 0.131.0 exato. Task 39 do plano (colunas em ConfigSetorAtendimento) precisará ser adaptada a `PrazoRespostaSetor` ou à criação do modelo.
- Pendências no quadro: NotaAtendimento, envio-inbox.ts, perfil/privacidade/temporárias do NumeroWhatsApp, motor.ts 4D–4F.
- `node_modules/.bin/vitest run src/test/pre-requisitos-fase5.test.ts`: 5 passed. `node_modules/.bin/tsc --noEmit`: saída 0. Não mexe em código compartilhado; npm test não rodado.
