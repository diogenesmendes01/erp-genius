# Incremento 530 — cálculo de dias úteis financeiros preparado

15/09/2026. Preparação de Q99, já aprovada no planejamento F07. Agente Terra criou somente o helper puro e seus testes; o orquestrador revisou e acrescentou os limites de mês e ano persistível.

`ajustarVencimentoDiaUtil` recebe a data já calculada por Q90/Q160 e uma regra explícita: manter a data ou prorrogar ao primeiro dia útil financeiro. A prorrogação exige calendário identificado e versionado, referência, vigência, dias da semana úteis e feriados. Não presume país, sábado/domingo, feriado escolar ou regra contratual. Mantém a data calculada e retorna separadamente a ajustada e a referência utilizada; não altera cobertura nem dia contratado.

Data/calendário incompletos ou inválidos, data fora da vigência e ausência de dia útil até o limite exigem conferência. A busca não extrapola a vigência nem o intervalo de datas persistíveis.

Nove testes unitários aprovados, cobrindo fins de semana, feriados consecutivos, outra composição de semana útil, dia já útil, manutenção da data, vigência inválida, travessia de mês e limite de 9999. Evidência: `docs/validacao-dia-util-530-2026-09-15.json`. ESLint dos dois arquivos aprovado.

O helper ainda não está conectado às condições contratuais, cadastro de calendários e emissão; não representa a entrega completa de Q99. Nenhum arquivo do fluxo ativo foi alterado enquanto a suíte geral rodava. Essa suíte terminou neste incremento com 1.073 integrações aprovadas, conforme relatório do incremento 528. Integração dos helpers de cadeia e dias úteis, Q161/Q162 e demais pendências continuam necessárias. Nenhuma alteração de produção ou chamada externa.
