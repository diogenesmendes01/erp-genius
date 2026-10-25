# #344 — relatório DEV, marco 1 do tradutor SQL

Estado: somente o tradutor fechado e seu corpus de paridade foram implementados. A #344 completa NÃO está entregue. Agregado de sete chips, filtros antes da paginação, preferências da página, rota, SSR e InboxNovo aguardam revisão ROOT e GO dos marcos 2/3. [SPEC parcial](../docs/specs/inbox-contagens-aria.md).

Base 170edbadfdf35a93f5366ba504bb7870a1ebf0c1, branch codex/inbox-e3-344-contagens. ROOT preparou cliente próprio 490 e ciint491, snapshot de 502 registros/424 hashes, em 23fe3a EXIT0. Plano privado de 21.663 bytes/SHA e63a8f83 lido integralmente e aprovado para o marco 1; investigação independente T b197db8c foi referência. Nenhum helper de ACL/CRM, fonte da lista/API/InboxNovo, #342/#343/uso, schema ou dependência foi alterado. Sem migração, geração ou instalação.

## Entrega e corpus

whereAtendimentoEmSql é puro: converte o where produzido pelas fontes canônicas em Prisma.Sql, com registry privado de tabelas/campos/relações e validação de tipos/enum. Valores são bindings; identificadores são internos. Formato novo é recusado antes da execução SQL. Some/none e relações usam EXISTS correlacionado, sem multiplicação de linhas. A função não conhece papéis nem concede permissão; futuro consumidor precisa combinar escopo autorizado.

O arquivo UNIT próprio tem 26 casos, incluindo 256 combinações dos oito papéis em leitura e envio: 512 chamadas ao construtor canônico, sem banco. Não são 512 casos Vitest. Contexto com membro301 não é truncado. Parametrização, formatos/tipos/protótipos recusados, UTC explícito e busca canônica têm controles próprios.

O arquivo INT próprio tem 67 casos e compara os IDs de SQL com findMany Prisma sob o MESMO where. Inclui onze atores, leitura e envio; positivos e negativos não vazios; lógicos/NULL/NOT/is:null/some/none; buscas com acento, curingas, dígitos, aspas e barra; fim/revogação de convite e envio independente; posse atual de linha e carteira como vias independentes; cobertura/docente revogados; contexto real de 301 membros sem commit; pool1/rollback; comparação em UTC/São Paulo/Tokyo na mesma conexão, com restauração da TZ. Os três casos completos de escopo-transacao existentes também foram revalidados.

## TDD e negativos nominais preservados

- UNIT 5df3ca e INT bedd32: EXIT1 por módulo ausente, zero casos coletados. Não são provas de comportamento DB.
- Stub explícito: UNIT 890a44, 25/25 falhas; INT sessão30402/94f470, 49/49 falhas. Fixtures reais executaram antes de implementar o tradutor.
- Setup anterior 0dbc1b: EXIT1 com 49 ignorados, trigger pedagógico recusou contato de responsável sem autorização. A fixture foi corrigida para aluno direto com telefone/WhatsApp atuais e financeiro com matrícula/canal inativo. Não se desabilitou trigger ou fabricou atendimento financeiro novo sem matrícula.
- Primeiro tradutor: UNIT 21a967, 24/25; a falha era uma expectativa textual que não aceitava NOT (EXISTS). O oráculo foi ajustado para a mesma operação com parêntese, mantendo a paridade DB. INT sessão5170/b35c53, 47/49: divergência lógica real e expectativa de fixture que esquecia acesso por carteira.
- Lógica ampliada: sessão27236/e9fae7, 55/58; sessão74462/c89574, 60/65. Prisma trata OR:[] no topo como falso, mas poda grupos estruturalmente vazios dentro dos conectivos. AND:[{}, {OR:[]}] deve ser vazio, não FALSE. Os controles misturam predicados positivos para não mascarar divergências com um resultado já vazio. O tradutor valida todo filho antes da poda; o where canônico ficou intacto. Esse diagnóstico supera a hipótese inicial do plano para grupos vazios.
- GREEN causal: UNIT 80d22f, 26/26; INT sessão99195/ac62f5, 65/65, 11,03 s, ambos EXIT0.
- Controles adicionais: sessão29747/2097db, EXIT1, 69/70 nos dois arquivos. Paridade de NOT/relações e contexto301 passou; somente o controle positivo de busca tinha uma barra a menos e ambos SQL/Prisma retornavam vazio. Corrigido exclusivamente o literal do teste, sem alterar o tradutor. O run continua nominalmente negativo.

## Gates finais

| Gate | Sessão/terminal | Resultado |
| --- | --- | --- |
| UNIT relacionado completo | 32613/1d3b0f | Oito arquivos, 184 casos, 32,33 s, EXIT0 |
| INT relacionado completo | 71265/d0f988 | Dois arquivos, 70 casos, 23,72 s, EXIT0 |
| Lint dos três paths finais | a93b4f | EXIT0, sem aviso |
| TSC auxiliar final | 94659/c46e69 | EXIT0 |

Sem filtro por nome ou teste ignorado nos gates finais. Não se somam os 65/67/70 sobrepostos; a execução final contém 67 casos próprios e três do arquivo escopo-transacao. O UNIT relacionado terminou antes do último ajuste exclusivo do literal INT; produção e UNIT permaneceram byteiguais. Não é suíte global.

Comando UNIT: vitest run src/server/inbox/where-sql.test.ts src/server/whatsapp/escopo-atendimentos.test.ts src/server/whatsapp/escopo-setor.test.ts src/server/whatsapp/escopo.test.ts src/server/whatsapp/busca-inbox.test.ts src/server/crm/escopo-comercial-sql.test.ts src/server/inbox/filtros.test.ts src/app/enums-rotulos.test.ts --maxWorkers=2. Comando INT: vitest run --config vitest.integration.config.ts src/server/inbox/where-sql.int.test.ts src/server/whatsapp/escopo-transacao.int.test.ts --maxWorkers=1. Executáveis locais com Node22, uma suíte DB por vez e mesma sessão até terminal.

TSC auxiliar usa heap8192, --noEmit --incremental false e a configuração privada que estende a original, preservando includes/excludes e acrescentando SOMENTE os privados históricos output/inbox-326-a2-diagnostico-private.test.ts e output/inbox-326-package-r8-7a30d4-preservado-private/inbox-326-a2-diagnostico-private.test.ts. Todos os SRC/testes atuais entram. O TSC anterior 86646/c5144d saiu 0 antes da correção do literal final; não é reatribuído ao arquivo posterior. Nenhum TSC original/global deste worktree com privados é alegado verde.

## Fontes e limites

SHA256 GitLF/físico LF: where-sql.ts, 10.391 bytes, 94ab79b2674d9ee2e7b46f9e00a563981d6306ff5cc8c5968c55531962841abf; where-sql.test.ts, 3.249 bytes, 952e37de3c8165c9f1b6216108b71552ffb9a063eff14ea6e682f838f4970362; where-sql.int.test.ts, 13.320 bytes, 305b1eb6318b4976519cff7504182418034eeb37b99a72230f148133398666d9. Logs/ledger/provas permanecem privados, sem credenciais ou binários no commit.

O banco foi explicitamente liberado ao ROOT depois do último terminal DB. Nenhuma nova operação DB está autorizada ao DEV nesta entrega; restauro e sua constância serão responsabilidade ROOT. Sem mensagem/provedor externo ou nova UI. QA independente, revisão e demais marcos da #344 permanecem pendentes. Dependências #349/#351 têm suas próprias entregas; não se presume encerramento delas nem da #344 por este marco.


Restauro final confirmado pelo ROOT em d01e09, EXIT0: ciint491, 424 hashes, snapshot de 502 registros, fixture e sequências preservados, zero outras atividades. Nenhuma nova DB pelo DEV.

## Marco 2 — estado SQL e sete contagens, 24/10/2026

Base do delta: c9e710e35a56c9b64366c31b5d292f9b5ae8a516, no mesmo worktree/branch. ROOT leu integralmente QA do marco 1 (66ed1e5a/10519), aprovou o tradutor e preparou a lease exclusiva do ciint491 em 2a4d0a EXIT0, 424 hashes/502 registros. O corpus M1 e sua QA permanecem nominais; não se somam aos gates M2.

Dois módulos de produção novos, quatro arquivos de testes e uma fixture local: estado-aria-sql.ts/.test.ts/.int.test.ts; contagens.ts/.test.ts/.int.test.ts; contagens-fixture.int.ts. Nenhum arquivo de fonte existente mudou. Registry M1, #342/#343, helpers ACL/CRM/uso, lista, API, SSR, InboxNovo, schema e dependências permanecem idênticos. O contexto fica em contagens.ts e não importa consultas-pagina, evitando criar o ciclo discutido para a fase 3.

O contexto carrega situação, orçamento e ACL uma vez, no mesmo Db, sem H global. O agregado novo executa sete totais em uma query SQL, com H/S correlacionados e CASE equivalente à derivação342. COUNT bigint passa por validação de inteiro seguro. Não lidas usa EXISTS equivalente ao helper canônico, sem copiar ACL nem materializar IDs de atendimentos. Base retira aria/prazo/fila e mantém eu/ID/nãoLidas e os demais filtros. A nova resposta é produtor interno: consumidores do marco 3 ainda não recebem resumo.

### TDD e negativos M2

- UNIT 258da0 e INT 12a1ae: EXIT1 por módulos ausentes, zero casos coletados; não são provas DB.
- Stubs explícitos: UNIT c7d501, seis falhas/sete controles esperados em 13; INT sessão67325/2eb359, dois arquivos completos/20 falhas, 89,11 s, EXIT1. As fixtures A–G executaram com matrícula financeira válida e sem desativar guardas.
- Primeiro GREEN unitário 03c4c8: dois arquivos/13 casos, EXIT0. Integração sessão24679/30ab13: dois arquivos/20 casos, 19 passes/uma falha, 96,63 s, EXIT1. A falha era do oráculo: “Contato A” casa os sete nomes pela palavra “a” dentro de “Contato”, conforme whereBuscaConversas. A expectativa foi corrigida e acompanhada por controles de telefone único=1 e termo ausente=0. Não houve ajuste de produção para fazer o teste passar. Esse run não é reclassificado.
- O último delta foi exclusivamente no teste INT, incluindo também leitura pessoal em T/T+1. Produção e arquivos UNIT ficaram byteiguais. TSC anterior5527/7168e6 e lint anterior6cec6d eram verdes na versão anterior do teste, sem reatribuição.

### Gates finais M2

| Gate | Sessão/terminal | Resultado |
| --- | --- | --- |
| UNIT relacionado completo | 36424/142433 | Oito arquivos/219 casos, 28,19 s, EXIT0 |
| INT relacionado completo | 79338/8d4c6c | Três arquivos/38 casos, 184,28 s, EXIT0 |
| TSC auxiliar final | 8911/4b8c5f | EXIT0 |
| Lint dos sete paths | 861edb | EXIT0, sem aviso |

UNIT inclui estado-aria-sql.test, contagens.test, estado-aria.test, where-sql.test, aria/uso.test, aria/permissoes-tela.test, aria/turno/guardas.test e enums-rotulos.test, todos completos, maxWorkers=2. O comando final INT usa vitest.integration.config.ts, estado-aria-sql.int.test.ts (nove), contagens.int.test.ts (onze) e estado-aria.int.test.ts (18 preservados), maxWorkers=1. Cada sessão foi acompanhada até terminal. Sem filtro por nome ou teste ignorado. Não é global; não se somam recortes sobrepostos ou execuções independentes.

TSC com heap8192, --noEmit --incremental false, auxiliar privada que estende a configuração original e acrescenta somente os dois privados históricos autorizados já descritos no marco 1. Todos os SRC/testes atuais estão incluídos; nenhum TSC original/global deste worktree com privados é alegado verde. Executáveis locais Node22, sem instalação/generate.

O corpus real comprova Admin A–G=7 e FINANCEIRO=1; vendedor só B/D; fila/aria/prazo removidos da base mas eu/ID e não lidas mantidos; prioridade H/pausa/sugestão/global/responsável; campos null e estado bruto versus global efetivo; prazo estrito, primeira resposta e encerramento; contagem pessoal por usuário e igualdade da leitura; múltiplos filhos sem duplicar linhas; contexto reutilizado sem duplicar situação/orçamento/versão; uma query agregada; 301 handoffs adicionais sem cap; pool1, alterações não commitadas e rollback; três TZ com restauração. Grupo é um SELECT sintético porque o trigger impede a gravação dessa fixture.

SHA256 GitLF/físico LF dos módulos: estado-aria-sql.ts, 2.057 bytes, 45872a3f360b1466eb29290f9154c19271d333f4283211b0f02bbaff0ff075d2; contagens.ts, 5.922 bytes, 8587a003fcd82a005e31e3abf8da50d3ad57d91cdccefbb4cf521f74ae992f46. INT finais: estadoSQL cdaab115531e7d78642e875a87283f27bdeed5ac2ff2887e17389d4e086462a9 e contagens 9236ef84d7df24da8b26c4f2cfea36e32322f27db68de1953b9f1b0da53db925. Logs/ledger e recibo completo permanecem privados.

Banco explicitamente liberado após o último terminal. ROOT confirmou restauro 3564e1 EXIT0: ciint491, 424 hashes, snapshot502, fixture e sequências preservados, zero outras atividades. Nenhuma nova DB pelo DEV. QA independente, leitura ROOT e GO3 permanecem pendentes. Não há UI nova ou prova visual nova; não se publicou PR, não se alterou provider e a #344 continua parcial.

## Marco 3 — produtor completo em validação, 24/10/2026

GO ROOT após M1/M2 e QA independentes. Base executável M2 0fdedf47ba900fd8a43c06a20b78fe716e27471f, ciint491/cliente próprio490; READY c5b35a confirmou 424 hashes/502 registros. Não houve migração, instalação, generate, provider, mensagem ou operação manual de interface. A entrega acrescenta parser/URL aria, seleção SQL antes de paginação, preferências pessoais limitadas à página, contexto interno reutilizável e resumo HTTP/SSR aditivo. Os cinco chips legados permanecem distintos dos sete contadores; controles #345–#347 não foram implementados.

Extrações aprovadas: corpo literal naoLidaPessoalEmSql para filtros-sql; contexto M2 compatível para contexto-lista com promessas preguiçosas memoizadas; consulta-sql para cursor/seleção/snapshot/cinco chips. A extração adicional autorizada em #342 move apenas ESTADOS_ARIA/EstadoAria para módulo puro, mantendo imports/reexports compatíveis. Não há expansão do registry, cast Sql→WhereInput ou ciclo contagens↔consultas. Db/ator/papéis/instante/envio são conferidos ao compartilhar uma operação. Seleção segura precede LIMIT; hidratação revalida ACL. Sob alterações concorrentes uma linha pode sair da página; não se promete serialização universal das permissões.

API: novo resumo somente com contagens=1 sem cursor, junto dos cinco contadores existentes; envio restringe todos. Falhas 401/403/cursor400 não consultam lista/resumos. SSR solicita resumo sempre, depois da guarda, mantendo fallback de cursor inválido para primeira página e deep link autorizado. Isoladamente, lista vazia sem aria/resumo mantém retorno antes dos loaders343/global. InboxNovo muda somente serializer/tipagem, preservando editor, foco, ações e OR; hunks A328 serão unidos por ROOT.

### TDD e negativos M3 preservados

- URL RED 37cccf: três arquivos/32 casos, três falhas/29 passes. GREEN f6a9d5: quatro completos/55, EXIT0.
- Composição/contexto RED 33da07: dois módulos ausentes, zero coletados. GREEN 655364: cinco completos/27, EXIT0.
- consulta-sql UNIT RED 8e68fa e INT RED bfab47: módulo ausente, zero coletados; não são provas de comportamento DB. Helper UNIT a3a5bf: quatro casos, EXIT0.
- RED comportamental sessão62281/fa9ba4: arquivo INT completo, quatro falhas/dois controles em seis, EXIT1. Mostrou aria ignorada, base legada sem aria, três leituras globais e Db da tx ignorado. GREEN sessão11433/0004d8: seis completos, 24,47 s, EXIT0.
- API/SSR RED 65eb9a: dois completos/24, sete falhas/17 controles, EXIT1. Intermediário 82b9ac: dois negativos de setup dos novos mocks (contagem acumulada e opção esperada incompleta), sem ajuste de produção. GREEN 666488: dois completos/24, EXIT0.
- Recorte UNIT sessão76902/3c580a: 20 completos/471 casos, 468 passes/três falhas, EXIT1. Duas foram beforeEach de foco com timeout10s na importação dinâmica, sem asserção funcional. A terceira é finding REAL da guarda: contagens-fixture.int.ts importava src/test/integracao.ts e era classificado como produção. Não se reclassifica esse run.
- TSC auxiliar sessão18178/77de0d: EXIT1, dois erros nos novos testes (invocationCallOrder.at(-1) opcional e retorno Promise versus PrismaPromise do spy). Correções exclusivamente de tipagem, sem alterar o callback real encaminhado ao banco.

ROOT aprovou mover literalmente a fixture M2 para src/test/inbox-contagens-fixture.ts e atualizar exatamente três imports INT. Prova f3c6c1: 3.934 bytes/SHA256 7cf2668396bc5509c0e1351c3be95dddc6c0ce59fce9c72a85dc122b786716f1, igual M2. Nenhuma guarda ou dado foi afrouxado. O recorte afetado isolado, sessão67178/5c49ef, passou três arquivos completos/44 casos em 20,00 s, EXIT0: foco9, page17 e colunas18, sem aumentar timeout.

INT sessão51235/b392f4 terminou EXIT0: quatro arquivos completos/59 casos, 495,32 s de testes (504,61 s total), maxWorkers1, sem filtro/skip. Consulta-sql7, consultas-pagina32, estado-aria-sql9 e contagens11. Inclui mais de305 linhas antes do alvo,307 itens IA em duas páginas/cursorNULL/empates,105 fixadas com exclusão de todas nas páginas normais, quatro estados contra Prisma real, bases cinco/sete, contexto único concorrente, snapshot pessoal em uma query, ACL revalidada, pool1/rollback, regressão legada completa e M2/TZ. Essa execução antecede somente a mudança literal de localização da fixture e as duas correções de tipagem; produção é idêntica.

Prova AST 1decdf EXIT0: sete funções342 idênticas normalizando EOL; corpo naoLidaPessoalEmSql e listarMensagensPagina literais. RegistryM1 e seus testes/INT, testes342, estadoSQL, previa343, uso, escopo e preferencias-consulta preservados. Whitelist pura possui duas declarações/zero imports. Os executores e históricos não são somados como suítes novas ou globais. Revalidações finais após o movimento e constância ROOT serão registradas abaixo.

Revalidação após a localização/tipagem: sessão31050/7c85a2, três arquivos INT completos/27 casos, 380,32 s de testes (395,84 s total), EXIT0. Mesmo config isolado, maxWorkers1, sem filtro por nome ou caso ignorado. Cobriu consulta-sql (sete), estado-aria-sql (nove) e contagens (onze). Não se soma aos 59 anteriores. O legado completo de 32 mantém a prova51235 sobre produção idêntica. Banco ciint491 explicitamente liberado ao ROOT após esse terminal; nenhuma nova DB pelo DEV.

Lint final dos 24 arquivos presentes da entrega: sessão82774/353b0d, EXIT0, sem aviso. Diff check80094/cd785a EXIT0; avisos administrativos de conversão EOL não são erros de fonte. Pins físicos/GitLF e grafo acíclico estão no manifesto privado, com namespaces separados. Quadro acrescentado preserva byte a byte o prefixo anterior de1.145.690 bytes/SHA ddec19006f3ca614c9355484aa98ab7c4a66caf25564ef880d9730384225b858.

### Fechamento DEV M3

TSC auxiliar final sessão6077/04c1ce: EXIT0, heap8192, --noEmit --incremental false -p tsconfig.inbox-342-aux-private.json. A configuração estende a original, preserva seus includes/excludes e acrescenta SOMENTE output/inbox-326-a2-diagnostico-private.test.ts e output/inbox-326-package-r8-7a30d4-preservado-private/inbox-326-a2-diagnostico-private.test.ts. SRC, configs e testes atuais permanecem incluídos. Não se declara TSC original/global deste worktree com privados como verde. O negativo original histórico e o negativo de duas tipagens18178 continuam preservados.

UNIT de 20 arquivos completos: contexto-lista, filtros-sql, consulta-sql, contagens, estado-aria-sql, estado-aria, where-sql, filtros, cursor, previa; API atendimentos/route; Inbox page, InboxNovo, InboxNovo.detalhes, InboxNovo.foco, InboxNovo.interacao, filtros-url; enums-rotulos, botoes e colunas-ordenaveis. maxWorkers2, 471 casos, run76902 negativo descrito acima. A revalidação isolada final executou InboxNovo.foco.test.ts, page.test.ts e colunas-ordenaveis.test.ts completos, maxWorkers1, 44 casos, EXIT0. Os outros 18 arquivos haviam terminado verdes no run nominal anterior; não se inventa novo comando verde de 20 nem global. API/SSR24 também têm prova completa666488; page17 foi revalidado depois da correção de tipagem. Nenhum filtro de nome/skip.

Integração reproduzível: Node22 node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts src/server/inbox/consulta-sql.int.test.ts src/server/inbox/consultas-pagina.int.test.ts src/server/inbox/estado-aria-sql.int.test.ts src/server/inbox/contagens.int.test.ts --maxWorkers=1 (51235/59). Após movimento da fixture, mesmo comando retirando somente consultas-pagina.int.test.ts (31050/27). São execuções sobrepostas, não 86 casos únicos ou um comando final59 após o movimento. Produção é idêntica e o corpo da fixture foi preservado byte a byte.

Hashes SHA256 GitLF de produção M3: contexto-lista.ts 7338379b9995b7e1d08490352525d9eb5160e2ba3ee6051b8430db2c459c61d6; filtros-sql.ts 294e1ef3c9f2564b88d8390eb89f7a7859831b49ed2aa0ce49b3b5d3f9ab1c98; consulta-sql.ts f9be89659a11857887321dff5c79cdb218184a9de484a8dfad3163f40645b883; consultas-pagina.ts c58553275315269436c9f7a2160aa1dc3e14823ca9280be8dd4fbd2c14be147b; contagens.ts c8f967f6e572f95ed8c0726e8bcc85ad4e7eff3fe621f4d83d8fa2e2960b7388; estado-aria-valores.ts 0e4bb5505a5af40b485b1bd52748a502e0f34a050496713b0e57f690e9c60978. O manifesto privado separa SHA físico de GitLF e contém os demais paths/bytes, comandos e provas. Não há binário, raw, segredo ou executor privado nesta entrega Git.

DEV concluído para handoff. Restauro491 pelo ROOT, QA independente no commit exato, união dos hunks A328, regressão integrada/CI e publicação permanecem sob coordenação ROOT. #344 não é marcada concluída ou homologada por estes gates locais.

Constância final ROOT após a liberação: sessão72031/460f14 EXIT0. ciint491, 491 migrações/424 tabelas, hashes originais, fixture e snapshot preservados, zero outra atividade. Nenhuma nova lease DB ao DEV. QA independente M3 e TSC original/global pertencem à composição ROOT, sem reatribuir o auxiliar como original.


## Revisão de QA M3 — cursor aceito com offset

A QA independente no7138574 passou UNIT20/471, INT4/59 e lint24, mas não aprovou a fonte: oráculo somente leitura demonstrou seis divergências em18combinações de cursor/fuso. O decoder preserva strings Date.parse válidas; o cast direto para timestamp ignorava o offset. O integrador preservou o negativo e acrescentou consulta-sql.cursor.int.test.ts com21combinações reais, em três fusos, CTE VALUES e TX READ ONLY. RED a3fdbe:9falhas/12passes, incluindo os offsets e a entrada legada aceita0 que produzia erroSQL. Nenhuma tabela/fixture foi escrita.

A correção somente normaliza a fronteira temporal com new Date(c.em).toISOString antes do cast. Decoder, NULL, desempate por ID, parametrização, ACL, registry e todos os demais corpos permanecem intactos. GREEN8845ac EXIT0:21/21,3,21s,w1. UNITd8f7a5 EXIT0:dois arquivos completos/seis casos,1,35s,w1;lint2c96bba EXIT0. TSC original26267/03ef61 EXIT0, Node22heap8192/noEmit/incrementalfalse, sem configuração auxiliar ou exclusões extras. Após RED/GREEN, auditoria53cc14 confirmou424hashes/1378registros iguais ao snapshot4834: somente leitura, sem restauro necessário. Esses recortes não são somados nem convertem a QA negativa original em aprovação. Nova QA causal/composiçãoMain/CI continuam pendentes.
