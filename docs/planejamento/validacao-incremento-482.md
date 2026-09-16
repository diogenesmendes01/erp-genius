# Incremento 482 — repetição estável das integrações afetadas

Data: 15/09/2026. Turno anterior foi progresso: dependências recuperadas, prevenção adicionada e unitários aprovados. Meta integral ativa.

## Banco e repetição

O log confirmou o fim da recuperação automática do PostgreSQL, e uma consulta `SELECT 1` no banco fixo de testes confirmou prontidão. Não foi necessário reiniciar o servidor novamente. A sessão `16366` repetiu os 12 arquivos com falhas da regressão 479: **109 aprovações e uma falha**, relatório `docs/validacao-falhas-estavel-482-2026-09-15.json` e log correspondente.

A única falha persistente foi a observação de locks em `academico/visibilidade.int.test.ts`. A execução acadêmica já retém calendário/matrícula antes de aguardar o aluno; o diário passou a esperar o calendário primeiro. O helper do teste filtrava apenas consultas sobre Aluno/Matricula, ignorando o segundo bloqueado real. O filtro passou a incluir a trava institucional, e o teste exige explicitamente um bloqueio no aluno e outro no calendário, ambos na mesma cadeia. Permanecem as verificações de chamada histórica preservada, escrita histórica permitida, recusa de aula após a saída, quantidade de diários e transferência efetivada. Nenhuma ordem de lock ou regra de produção foi relaxada.

## Arquivo ausente e resultado final do recorte

A comparação entre os arquivos selecionados e o relatório 479 identificou `financeiro/politica.int.test.ts` como o arquivo não contabilizado após a saída do worker. A sessão `20916` executou esse arquivo junto à visibilidade corrigida: **26 testes aprovados** (20 financeiros e seis de visibilidade), relatório `docs/validacao-concorrencia-financeiro-482-2026-09-15.json`. Considerando sobreposição, os 13 arquivos totalizam **130 cenários distintos aprovados** no ambiente estabilizado. Lint do teste alterado aprovado.

A revisão Terra não identificou nova incompatibilidade funcional no arquivo financeiro, mas observou que alguns cenários são explicitamente legados: contrato manual e pagamentos históricos injetados não provam contratação integrada ou ledger completo. Os testes de concorrência não devem impor um resultado único quando ambas as ordens serializadas são válidas.

## Regressão integral novamente viva

Iniciada a sessão `17801` com toda a suíte de integração e gate de dependências antes das migrations. Log: `docs/validacao-integracao-estavel-482-2026-09-15.log`. Relatório final previsto: `docs/validacao-integracao-estavel-482-2026-09-15.json`. Ainda sem resultado terminal neste registro. Não executar outro processo de banco, instalar dependências ou alterar o código exercitado durante essa execução.

## Limites e continuidade

Os testes aprovados do recorte não comprovam a suíte completa, que permanece em execução, nem a conclusão da SPEC. Q116 ainda precisa das entidades persistidas, proposta/decisão, cancelamento autenticado e criação do substituto; demais lacunas documentadas continuam ativas. Sem deploy, integração externa real ou novo build nesta rodada.
