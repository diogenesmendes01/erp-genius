# Reserva técnica de migrations — Inbox E2

Reserva do integrador em 23/10/2026, após o fecho técnico E1 e abertura da PR #406.

| ID e diretório | Issue | Responsável | Finalidade | Estado |
|---|---|---|---|---|
| `20261023100000_tarefa_atendimento` | #322 | DEV B; aplicação pelo integrador | Coluna nullable Tarefa.atendimentoId e FK RESTRICT/CASCADE | Aplicada nos bancos B, integrador e TESTER; A permanece no schema anterior |
| `20261023110000_tarefa_atendimento_indice` | #322 | DEV B; aplicação pelo integrador | Índice atendimentoId/status, CONCURRENTLY em migration própria | Aplicada nos bancos B, integrador e TESTER; índice validado |

Preflight somente leitura: sessão ROOT15573, confirmação2ca1b4, saída0. Foram
conferidos452 commits distintos apontados por refs locais/origin, após fetch de
main, e os quatro bancos descartáveis: integracao, dev-email, dev-gravacoes e
tester, todos com485 migrations aplicadas. Os dois IDs e a coluna não existiam.
Não foram consultados bancos externos ou de produção. Nenhum ID aplicado foi
reutilizado; novas migrations posteriores exigem outra reserva coordenada.

Antes de aplicar no banco B, encerrar a suíte RED e restaurar o snapshot E1 de
1.372registros/424tabelas. Revisar os arquivos e gerar Prisma somente no worktree
B. Após aplicar, comprovar coluna nullable, FK, migrations concluídas e índice
válido/pronto com a definição correta; IF NOT EXISTS isolado não é comprovação.

Criar snapshot/manifesto E2 antes das suítes GREEN que truncam dados. Os helpers e
snapshots E1 permanecem históricos e não podem restaurar o schema novo. O DEV A
trabalha na #321, sem migration, em banco separado. Instalações, scripts npm,
Prisma generate e aplicação de migrations continuam sob responsabilidade do
integrador; nenhum cluster será iniciado/parado por agentes.

## Aplicação e verificação observadas

B: sessão28331/2fa10b saída0; coluna nullable, FK RESTRICT/CASCADE e índice
válido/pronto conferidos em2db2d4. Uma tarefa temporária criada antes do DDL
permaneceu com vínculo null e foi retirada. Novo snapshot E2:424tabelas/1374registros.
DEV executou4arquivos/62testes de integração, saída0; restauração final23337c saída0.

Integrador: sessão6281/9a9028 saída0, Prisma gerado e duas migrations aplicadas.
Composição cea teve8arquivos/88testes de integração aprovados em duas execuções
sequenciais (95770 e40708), sem concorrer pelo mesmo banco.

TESTER: primeira geração87694 atingiu timeout120s antes de aplicar migrations.
Nova sessão64301/181f3c, limite360s, terminou0 e aplicou ambas. Verificação04825a
conferiu423tabelas originais contra o snapshot anterior, incluindo Tarefa sem
a coluna nova, e comprovou preservação dos dados. Novo snapshot E2 tem424tabelas,
1388registros e487migrations. QA própria53653/25856d terminou0,4arquivos/62testes.
Restauração4df8ff saída0 conferiu todos os hashes e a fixture original.

Os snapshots E1 permanecem históricos; não restauram os bancos migrados. IDs
aplicados continuam exclusivos. Não houve migração em produção ou no banco A.
