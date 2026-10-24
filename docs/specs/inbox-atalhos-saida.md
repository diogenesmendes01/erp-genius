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

## Visual e harness — freeze documental DEV (23/10/2026)

APP4c76 e harness6e498 têm fontes distintas. O harness adiciona seis combinações APP Secretaria, preservando176 anteriores (182 total), com preflightGET autorizado e conclusão finita das mensagens antes da foto. RED/GREEN e TSC/lint dirigidos constam do relatório, sem mudança de produção/ACL e sem novo global.

Prova real: 24 formais APP +40 complementares =64 PNGs positivos, 4.273.828 bytes, originais/hashes em allowlists curadas. Admin/Secretaria chegaram à matrícula real com código público; Admin saiu do Funil para a mesma Pessoa em /contatos?c=; Professor convidado recebe campos setoriais nulos/enviofalse e redireciona no navegador para acesso-negado no cadastro. Não inferir autorização de uma URL nem de HTTP200 do stream. Protótipo funcional N/A, tabela12 linhas; nenhuma referência fabricada.

Altura500: oito contextos +12 medidas de borda, Tab/Escape/foco/mesmoDOM/scroll local. Link móvel íntegro em482,5–499,5, sem margem ampla; posição inicial e após rolagem são provas diferentes. Último controle apenas focado, nenhuma mutação. Duas construções SSE sequenciais/máximo uma simultânea nas origens. R1formal, R1alcance e uma fotoNext estão preservadas/excluídas e têm substitutos/fontes próprios.

ROOT preparou11linhas suplementares e restaurou A487 em c538fc/0 após stop79643:424hashes/9msgs4notas originais. BlocoNextAGENTS conferido/removido sozinho. Parecer output/inbox-335-visual-parecer.md e allowlists formais/complementares documentam evidências e limites. QA independente/global integrado/publicação/CI continuam pendentes; não é homologação presumida.
## Composição de publicação sobre main

FonteE0b35f2c54d90ad79cfc70ef69d20b688290de29,base6fe0e49aapós413. Árvoreintegraligualprebf344,global916/7205,TSCe lint40todos0; QAindependente19/139noE0eintegração3completos32na preparaçãoa4f6,comfontesdistintas. Os9pathsprodutivos335continuamiguais4c76e9harnessiguais6e498;32INTnãoforamreexecutadossónorebase. Evidências/hash/limitesnoíndiceoutput/inbox-335-qa/indice.json e relatóriooutput/inbox-335-composicao-final.md.64imagensoriginaisnãoforamrecapturadas;limite0,5pxmobilemantido. CIremoto/mergeaindapendentes.
