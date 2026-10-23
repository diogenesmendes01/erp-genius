# Inbox #335 — atalhos de saída

Base local8e503a72, branchcodex/inbox-e2-335. Agregado somente local; integrador reconstruirá publicação após324. Plano privado output/inbox-335-investigacao-dev-a.md aprovado, ordem335→336→325.

## Contrato

hrefConversa(id, {agendar?}) é encoder puro de URL relativa /inbox?c=, encodeURIComponent do id bruto e &agendar=1 somente quando true. Não autoriza alvo nem executa agendamento. #336 resolverá atendimento autorizado e links B2B antes do aceite completo325.

matriculaId:string|null nos DTOs FINANCEIRO e SECRETARIA segue exatamente o gate atual de matriculaCodigo: Admin/Financeiro/Secretaria no financeiro; Admin/Secretaria no setorSecretaria. Convite sozinho não libera os dados setoriais. Seleção da matrícula játraz id/código: sem query ou ACL nova. Código com id vira link /matriculas/id; semid permanece texto; semcódigo não cria link sem nome. Página destino revalida papéis/carteira.

Abrir contato no Funil aponta para /contatos?c=id codificado, identidade da Pessoa da oportunidade preservada. Não criar rota /contatos/[id] nem ampliar contatos.ver/escopoPessoa. D13 leitura comercial não se torna acesso aoCRM global.

## Verificação e pendências

TDD unitário/SSR e integração real paineis no dev-email487, uma suíte porvez, Node22.23.2/configintegration/maxWorkers1. Gates precisam saída terminal observada. Visual app-only painel-secretaria exige fixture ROOT legítima/Ready/handoffCLI B337, ainda pendente. Nenhuma migração/schema/deps/Prisma/push; preservar324/323, Compositor/Sino337.

## Checkpoint de código e rastreabilidade

RED unitário0d2a8e (3falhas de links/rota; encoder módulo ausente separado) e RED INT73676/bb5d73 (12pass/1fail em13, campo ausente com matrícula real) precederam produto. GREEN65arquivos/653unit sessão45159, INT3arquivos/32 sessão1473, TSC16563 heap8192 e lint9fontes818ebc max0, todos saída terminal0/Node22.23.2, sem filtro de nome/skips novos. Relatório output/inbox-335-report.md tem fontes, comandos, limites e casos. Não são global/QA/aceite visual.

Encoder5casos inclui espaços/Unicode e caracteres que não podem injetar origem/parâmetro. PainelSetor3casos novos preservam código legível/ausência de link; Funil mantém Pessoa e rota real. Integração com6atores e dados não vazios prova gates e convidados sem dados setoriais, além dos arquivos completos deenvio/Detalhes. CampoAPI aditivo usa seleção existente; nenhuma nova consulta ou ACL.

BancoA liberado ao integrador após1473 terminal0; restauro ainda não presumido. Visual/fixture/CLI/handoff B337, QA independente/global integrado/PR/CI permanecem pendentes. Nenhuma foto histórica atribuída a esta alteração.
