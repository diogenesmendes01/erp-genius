# Reserva técnica de migrations — Inbox E2

Reserva do integrador em 23/10/2026, após o fecho técnico E1 e abertura da PR #406.

| ID e diretório | Issue | Responsável | Finalidade | Estado |
|---|---|---|---|---|
| `20261023100000_tarefa_atendimento` | #322 | DEV B; aplicação pelo integrador | Coluna nullable Tarefa.atendimentoId e FK RESTRICT/CASCADE | Reservada; ainda não aplicada |
| `20261023110000_tarefa_atendimento_indice` | #322 | DEV B; aplicação pelo integrador | Índice atendimentoId/status, CONCURRENTLY em migration própria | Reservada; ainda não aplicada |

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
