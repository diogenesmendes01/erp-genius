# #336 — checkpoint de implementação e verificação

Base: `4c76d200257ea4c3df3707e95100d9180a9efdbc`. Branch própria `codex/inbox-e2-336`, Node 22 local, cliente Prisma 487 preparado pelo integrador. Perfil de integração autorizado: `ci-integracao`; banco B490/snapshot337 não foi acessado. Nenhum install, DDL, generate, servidor, browser, envio ou alteração de dependências/harness pelo DEV.

## Mudança

Produtor individual de atalhos e resolução B2B paginada, ligações de páginas autorizadas com FunilCliente, links em Funil/Tarefas/Contatos/Aria e projeção do atendimentoId no histórico existente. Contrato e limites em `docs/specs/inbox-atalhos-entrada.md`. Os exports/actions/formulários CRM e `src/server/crm/contatos.ts` foram preservados.

A coordenação aprovou lote B2B sem N+1: páginas de 100, escopo uma vez por operação, ordem SQL data/ID, sem cap global, mesmo cliente db/tx. A leitura read-only não se torna permissão de envio. Agendar é link para consumidor E4 pendente.

## TDD e negativos preservados

| Execução | Resultado observado | Classificação |
| --- | --- | --- |
| f0b4af | exit 1, 13 falhas / 28 pass em 5 arquivos | RED causal: 6 asserts dos links e 7 do produtor ausente |
| 9edd66 | exit 1, 40 pass / 1 fail | Oráculo novo de Aria também encontrou opção de filtro preexistente “Agendar mensagem”; corrigido para testar links, sem produto |
| dae552 | exit 0, 5 arquivos / 41 testes | GREEN individual e componentes |
| 72065 | exit 1, 12 falhas | Fixture usava campo inexistente statusSessao; enum/campo reais são sessao DESCONECTADO. Não conta como RED de feature |
| 56090 | exit 1, 8 pass / 4 fail | 3 REDs causais do lote ausente; 1 premissa de fixture de fila comercial, corrigida atribuindo responsável explícito, sem mudar ACL |
| 856b81 | exit 1, 7 pass / 3 fail | RED unit causal: lote ausente e ponte FunilCliente sem repasse |
| aeb64a | exit 0, 6 arquivos / 44 testes | GREEN lote, ponte e componentes |
| 394507 | exit 1, 18 pass / 3 fail | RED causal dos três callers: consulta/repasse ausentes após autorização |
| b8edf3 | exit 1, 1 fail / 15 filtrados | RED B2B real: href do interlocutor ainda null |
| 1ece9d | exit 0, 9 arquivos / 65 testes | GREEN dos callers e contratos de UI/produtor |
| 71440 | exit 1, 35 pass / 3 fail em 38 | Expectativas D13 antigas ainda esperavam null no único interlocutor autorizado. Atualizadas para href; pessoa sem conversa e negativas de acesso mantidas |
| 13635 | exit 2 | Dois tipos da nova fixture FunilCliente e tipo Next legado337. Fixture corrigida; produto/guardas intactos |
| 40436 | exit 2 | Backup dos tipos Next movido a output com extensão .ts entrou no glob; somente ambiente gerado, nenhum erro src |

Logs privados correspondentes permanecem em `output/inbox-336-*-private.log`. Não são artefatos de publicação nem novas provas de fonte futura.

## Gates finais

- UNIT sessão 11907, chunk e8ffb6: exit 0, **33 arquivos / 363 testes**, 21,09 s. Áreas completas Funil/Contatos/Tarefas/Aria, atalhos, escopo, encoder e guardas botões/identificação/confirmações/tipografia. Sem filtro de nome ou skips novos; é recorte, não suíte global.
- INT sessão 54219, chunk 4c5a65: exit 0, **3 arquivos / 38 testes**, 138,50 s, maxWorkers 1. Arquivos completos `atalhos.int.test.ts` (12), `aria/consultas.int.test.ts` (10) e `painel-detalhes.int.test.ts` (16), sem filtros/skips novos.
- Lint final chunk 94351a: exit 0, 23 arquivos afetados, `--max-warnings=0`.
- TSC final sessão 98658, chunk 73fe76: exit 0, heap 8192, sem diagnóstico. Fonte executável igual à dos gates finais acima.

As provas incluem prioridade explícita/lead/pessoa/encerrado, NULLS LAST e desempate SQL, convite vigente/revogado/expirado, papel negado, grupo sem atendimento, mudança de dono da linha, candidato invisível mais novo, mais de 100 candidatos de outra pessoa, lote sem query por participante, mesma transação com pool 1, links codificados e contrato de props opcionais.

## Comandos principais

```powershell
& 'C:/Users/Mendes/AppData/Local/hermes/node/node.exe' node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts src/server/inbox/atalhos.int.test.ts src/server/aria/consultas.int.test.ts src/server/inbox/painel-detalhes.int.test.ts --maxWorkers=1
& 'C:/Users/Mendes/AppData/Local/hermes/node/node.exe' node_modules/vitest/vitest.mjs run 'src/app/(app)/funil/' 'src/app/(app)/contatos/' 'src/app/(app)/tarefas/' 'src/app/(app)/aria/' src/server/inbox/atalhos.test.ts src/server/whatsapp/escopo.test.ts src/server/whatsapp/escopo-atendimentos.test.ts src/server/whatsapp/escopo-setor.test.ts src/lib/href-conversa.test.ts src/app/botoes.test.ts src/app/identificacao-registro.test.ts src/app/confirmacoes.test.ts src/app/tipografia.test.ts --maxWorkers=2
& 'C:/Users/Mendes/AppData/Local/hermes/node/node.exe' --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit --incremental
```

## Ambiente e pendências

ROOT preparou Prisma487 (17202/03d093, saída 0), validou cliente próprio/perfil (9c5eca, saída 0) e concedeu lease exclusiva ci-integracao após restauro 2dd656. Tipos Next antigos foram preservados pelo ROOT (bb7812) e typegen realizado (f77744), ambos saída 0; a extensão do backup ainda precisou correção antes de novo TSC. ROOT d2c168 terminou 0 preservando os quatro arquivos byte/hash idênticos como .ts.txt e manifesto, sem alterar tsconfig/src; o TSC final 98658 então terminou 0.

Banco liberado ao ROOT após o terminal 54219. ROOT confirmou restauro ci-integracao 368489 terminal 0, 424 hashes do snapshot preservados. A tentativa anterior 0f843e abortou antes de conectar por guarda de âncora de perfil; não é restauro aprovado nem erro do produto. Visual real app-only entrada-funil/tarefas/contatos/agente (dois temas, desktop e mobile), navegação real ao Inbox, QA independente e global integrado ainda pendentes. Só integrador publica após #335 main. Nenhum PNG novo e nenhum estado compartilhado do harness editado.

## Visual real e correção mobile — 24/10/2026

Fontes separadas: produto inicial a96d864; porte exato do harness 335 em a18c78e8 (dez OIDs iguais a 6e498, sem produto ou AGENTS); harness 336 em 953fb634; produto final em 65839a85ebf87b4dcb443fef5acebe86538d00f0. O único delta produtivo após a96 é a correção responsiva em FichaContato e no grid de Contatos. Servidor, ACL, schema e dependências permaneceram intactos.

O TDD do harness registrou três REDs causais em 5ecf2e, EXIT 1, seguidos por f647e7, EXIT 0, 3/3. O recorte completo pré-visual 695999 terminou EXIT 0, 15 arquivos/104 testes. Os quatro estados APP-only acrescentam oito capturas desktop às 182 combinações anteriores, total 190; tamanhos globais e guardas preservados.

A tentativa 61698/c3b34d terminou EXIT 1 em Contatos a 320×500, após seis estados. O diagnóstico c98d33 confirmou documento com 442 px, dois atalhos íntegros com 44 px de altura e a ação Nova oportunidade cortada. ROOT autorizou a correção e coordenou os caminhos com A326. RED fdb686, EXIT 1, reproduziu os 442 px; o primeiro ajuste do cabeçalho ainda produziu 360 px (a7c26b, EXIT 1). Cabeçalho móvel em duas colunas, ação na própria linha e grid-cols-1 explícito na página corrigiram a origem. GREEN 5c5a55/bf62ed, EXIT 0: documento com 320 px e controle inteiro. A regressão persistente scripts/visual/contatos-mobile.browser.test.mjs passou em c774bb, EXIT 0, um teste e zero skips; os atalhos têm 44 px e Nova oportunidade é alcançável por Tab sem execução.

Gates da fonte 65839: UNIT 27125/58a5a3, EXIT 0, 48 arquivos/467 testes em 22,10 s; recorte completo de Funil, Contatos, Tarefas, Aria, atalhos, ACL, encoder, guardas e harness, maxWorkers 2, sem filtro de nome ou novos skips. Lint fa837c e lint do browser c774bb, EXIT 0, maxWarnings 0. TSC 66457/d6c537, EXIT 0, heap 8192, sem diagnóstico. Esse recorte não é suíte global. Nenhuma integração foi reexecutada durante a fixture visual; INT 3/38 e QA inicial 9/66 + INT 3/38 referem-se ao produtor a96. A revisão exata do fix/harness continua pendente.

A tentativa 17689/aa24ad terminou EXIT 1 após dez estados: o runner privado esperava o nome da Pessoa no Inbox, mas a política canônica mostra o nome do Lead. Screenshot e fonte confirmaram Oportunidade aberta fictícia 336. Corrigida somente a expectativa privada; produto, guarda e ACL intactos. As duas tentativas negativas e seus parciais estão fora da allowlist.

A matriz final 78032/49aa31 terminou EXIT 0: 22/22 estados na fonte APP 65839/harness 953fb. São oito desktop 1440×900 e oito mobile 320×500 (quatro origens, dois temas), quatro de encerrada/ausente e dois do Inbox leitor/B2B. Houve 28 navegações reais por Tab/Enter (16 Abrir e 12 Agendar), com o mesmo documento, zero documentos adicionais e máximo de uma SSE simultânea. Nenhum pageerror, erro React/console/HTTP/rede ou alerta inesperado; documento contido. Os 58 diagnósticos são exclusivamente GET de mensagens cancelado e recuperado por GET 2xx íntegro, conforme o classificador existente. Não há lista genérica de erros ignorados.

Nenhum submit de negócio, Enviar, Assumir, nota, ação Aria, CRUD ou agendamento foi executado. Somente as actions automáticas autorizadas marcarAtendimentoLidoAutomatico e respostasRapidasDoCompositor ocorreram, com IDs/hrefs no manifesto. Contextos e browser fecharam em finally.

A inspeção DEV das 22 imagens, nas seis pranchas de temas/tamanhos/variantes, foi favorável: atalhos legíveis, identidade/status correspondentes, Contatos móvel corrigido, cartão real da Aria após rolagem, encerrada só com Abrir e ausente sem atalhos. O aviso de fuso escolar não configurado em Tarefas é dado preexistente do ambiente e permaneceu visível. O Inbox leitor mostra Você não pode enviar; HTTP real comprova A 200/podeEnviar=false, B 404 e /painel/detalhes 200 com href A real/href B null. A lista JSX de participantes pertence à 325 e ainda não existe nessa fonte; as fotos não alegam esses links. Estados completos APP-only sem referência funcional equivalente; ui2 serve somente à presença/texto dos atalhos.

Curadoria fdeb3d, EXIT 0: os 22 hashes/dimensões foram conferidos e o manifesto não contém credenciais. Allowlist exclusiva em output/inbox-336-allowlist.json; fontes em output/inbox-336-fontes.json; 22 PNGs físicos locais em output/inbox-336-visual-final. O ZIP original output/inbox-336-positivos.zip foi preservado como arquivo histórico privado; o aceite curado vigente está identificado no complemento abaixo e em output/inbox-336-zip.json. Nada foi enviado ou publicado.

ROOT encerrou o preview 91464/70e67b (Ctrl+C, EXIT 1 esperado) e restaurou ciint 487 em a79184, EXIT 0: 424 hashes/498 originais preservados. AGENTS foi restaurado apenas após o stop; seu único delta eram dez linhas geradas pelo Next. Instruções originais intactas. Ownership do harness devolvido expressamente à A326 após o freeze das evidências.

Entrega DEV verificável; a issue não está concluída. QA exata/visual independente, regressão global integrada, CI/merge e publicação ROOT após 335 em main continuam pendentes. Agendar=1 permanece somente a ponte E4.

## Correção de curadoria antes da publicação

Conforme docs/specs/inbox-curadoria-evidencias.md e coordenação ROOT, as 22 PNGs introduzidas em 59f0271 foram retiradas somente do índice por git rm --cached com caminhos exatos. Todos os arquivos físicos e hashes foram preservados; não houve exclusão, nova captura ou alteração de pixels. O commit histórico não foi reescrito. ROOT integrará somente o delta documental final contra 65839, sem a história dos PNGs.

O manifesto raw de 2.637 linhas foi preservado em cópia privada e substituído no repositório por registro curado de fontes, gates, resultado, limites, negativos resumidos e 22 imagens com SHA-256, bytes e dimensões. A versão curada tem 10.427 bytes, SHA-256 0e580b456416df27d41be900c4d665f8d771bf7c70634c5fd4e636c4b9d2fba4; não contém requests, headers, cookies, logs brutos, credenciais ou scripts. SHA-256 do raw preservado: 50708bc659bfa3e2d311a431b37fbe988f41abd34c70416cc1500c206611379d.

Novo pacote privado de aceite: output/inbox-336-aceite-65839-953fb-20261024.zip, 1730536 bytes, SHA-256 5FBD1FB9DF576F0FBCCE250155048AE6BC9B949B19C8FC79F32CC107CEAA5285. Contém somente 22 PNGs, manifesto curado e README curado, total de 24 entradas. As entradas são reabertas e comparadas por hash/tamanho com o catálogo. O ZIP antigo output/inbox-336-positivos.zip permanece intacto com SHA-256 EE0BA81A8BC661A0E144B92CA437F8B5512420912D5C47536E1DCF967DFE4555 e não é o aceite vigente.

APP 65839/harness 953fb e gates nominais permanecem inalterados. Esta fase é exclusivamente documental, sem instalação, banco, HTTP, preview, testes ou captura novos. Allowlist, manifesto, README, fontes e índice do ZIP foram atualizados. Nenhum upload/publicação; frente parada para QA até novo GO do ROOT.
