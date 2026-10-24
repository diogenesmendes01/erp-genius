# QA independente — revisão C5 da PR413

Fonte exata: `0e4ec6edcb430568ed339f8bf6630265d356a02a`, base `e991c48be4aa4fd995d3f28cc1b7b4f3384b38ac`. Revisão própria em 24/10/2026 no worktree TESTER exclusivo, Node v22.23.2/dependências locais existentes. Parecer favorável ao delta e aos recortes abaixo, sem blocker identificado. Não é homologação global nem aprovação do CI do novo head.

## Execuções próprias

Preflight `265627` exit 0: tracked limpo, artefatos QA335/336 untracked preservados, checkout detached exato 0e4 sem reset/limpeza. Delta de seis paths: três fontes/testes e SPEC/quadro/relatório. `git diff --check` exit 0 `90c722` e pós-testes `d8103b`; tracked continuou limpo e HEAD exato confirmado.

UNIT `165dda`, saída terminal 0: `node node_modules/vitest/vitest.mjs run "src/app/(app)/inbox/abas/ContatoCabecalho" "src/app/(app)/inbox/abas/ContatoSemNome" "src/app/(app)/inbox/abas/TagsContato" src/lib/acao-cliente --maxWorkers=2`, quatro arquivos/37 testes, 1,47s. Sem -t/skips. Recorte, não suíte global. Runner local Vitest 4.1.11, sem instalação.

INT sob a mesma lease exclusiva T, concedida após restauro ROOT bf350c e continuada expressamente após a suíte T335 terminar. Perfil local integracao/cliente487/banco descartável erp_genius_test em localhost:54329. Comando `node node_modules/vitest/vitest.mjs run -c vitest.integration.config.ts src/server/inbox/acoes-painel-tags.int.test.ts src/server/crm/tags.int.test.ts --maxWorkers=1`, dois arquivos completos, sem -t/skips. Sessão preservada `46676`, chunk inicial `a2e54e`, final `ba3aed`, saída terminal 0: **2 arquivos/25 testes**, 96,11s (94,13s testes), início 09:40:06. Não houve executor de banco paralelo do TESTER. O globalSetup padrão só valida status de migração read-only; nenhuma aplicação de migração manual.

## Revisão C1–C6

C1: o parecer local histórico `output/inbox-324-integracao-composicao-review-tester.md` registra execução independente 94331/19cc40 exit 0, cinco arquivos completos/54 testes / 193,60s na fonte nominal F9. A equivalência integral de tree F9≡567 já foi registrada sem alegar nova execução no 567/7ff. Conferi os workflows: CI rápido exclui *.int; integração completa é noturna/sob demanda. Os 54 da repetição ROOT C5 e os 25 desta nova QA são recortes/execuções, não novos casos distintos acumuláveis. Não reexecutei os cinco arquivos nesta revisão nem confirmei novo CI remoto.

C2: a cópia continua factual, permite preencher manualmente o nome quando autorizado e não promete uma pergunta automática da Aria ausente no produto. O deltaC5 não acrescenta automação ou altera regra de produto.

C3: `idempotente:false` é coerente com CAS por nomeAnterior. A action atualiza condicionalmente e retorna conflito quando o nome carregado ficou obsoleto; não garante repetir a mesma resposta após sucesso com transporte incerto. O hook mantém orientação de recarregar/conferir antes de repetir. O único delta no componente é comentário. `d8103b` exit 0 comparou a saída TypeScript com comentários removidos e confirmou JS igual entre base/0e4.

C4: li a PR413 via conector GitHub somente leitura. Na consulta, head remoto ainda e991, estado open, descrição atualizada 2026-10-24T12:36:19Z. Ela contém seis imagens Markdown inline: desktop/tablet/celular×claro/escuro, com arquivos nomeados 2396 e atribuição explícita ao produto original 2396, sem nova captura/reatribuição. Não baixei/reinspecionei PNG, não atestei renderização de acesso privado nem revalidei hashes remotos nesta rodada; esses gates históricos continuam nos pareceres nominais. A PR não foi editada por mim.

C5: o núcleo compartilhado agora orienta reativar no CRM antes de atribuir a tag inativa. A recusa continua no mesmo ponto, após locks/revalidação e antes de qualquer vínculo/Evento. A criação reaproveita a tag de nome igual e a exceção desfaz a transação; não há reativação implícita. O aviso fica depois do retorno bem-sucedido com mudança, portanto não é alcançado nesse erro. O caso INT existente foi fortalecido para resultado exato e mantém contagens zero de vínculo/Evento; o recorte completo Inbox+CRM passou 25. O RED filtrado ROOT e GREEN 54 são evidências do integrador; não são execução própria minha. Sem alteração de assinatura, seleção, autorização, schema ou dependências.

C6: quadro único e SPEC continuam registrando evidências/pendências. O commit acrescenta relatório de revisão, sem ZIP/PNG/credenciais/log bruto. Artefatos históricos foram preservados: QA335 a4f6 SHA256 `A9D36DFFADFD23DA66E1B54E4A45DD22DA6E45A0805ACAD9563DE04083C8FE66`; QA336 SHA256 `550E84988094C74E070D8092B12EECE10F9FC479BFEE3845BE8B9462B7D412C4`, conferidos após checkout/testes.

## Limites e entrega do banco

A sessão 46676 terminou e foi comunicada ao integrador; banco liberado para ROOT restaurar, sem restauro/cluster/DDL pelo TESTER. Nenhum servidor/browser, envio externo, instalação, Prisma manual, push, comentário público, PR ou merge foi executado. TSC/lint/global ROOT e checks remotos são gates separados. Este parecer se aplica exclusivamente ao 0e4; eventual composição 335 precisa manter suas próprias fontes/evidências.
