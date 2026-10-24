# @menções em nota interna — #337

Estado: registro evolutivo da entrega337. Código integrado nominal9fa e publicação documental419b; gates/fontes atuais em [composição final](../../output/inbox-337-composicao-final.md). Os checkpoints abaixo preservam seus estados históricos. D20 e brief ROOT aprovados; isso não presume homologação.

Ao digitar @ numa nota, a lista só oferece usuários internos ativos com leitura atual do atendimento. O solicitante precisa de sessão e leitura antes de qualquer consulta de usuários; busca limitada e ordenação estável. Candidatos exibem nome e papel/setor permitido; não exibem ID técnico/e-mail/documento. Texto livre resolve somente nome completo/primeiro nome inequívoco, sem caixa/acento; homônimos exigem seleção explícita.

Token opcional {usuarioId,inicio,fim} refere-se ao trecho da nota normalizada (CRLF→LF, trim), com coordenadas UTF16 válidas, sem cortar surrogate ou sobrepor outro token. O nome deve corresponder ao usuário. Alterar texto antes/dentro do token invalida a identidade; remount de rascunho textual não reconstrói homônimos. O comando enviado congela texto/tokens; chave local e hash incluem tokens presentes, em ordem canônica. Campo ausente mantém payload/hash legado. Preservar C3/owner/revisões/ACK A→B→A.

Na mesma tx da nota, recarregar usuários e revalidar atendimentoVisivel(...,false,tx), sem sessão/global aninhado (pool1). Excluir autor, inativo, portal e fora de escopo. Revalidar menções também ao listar o sino após revogação, sem alterar SLA/lembrete. Nota/avisos/SSE confirmam/revertem juntos; conteúdo nunca é mensagem/intenção/envio externo. Replay166 ocorre antes de novo escopo e não notifica novamente.

Notificação MENCAO_NOTA: refTipo AtendimentoWhatsApp, refId atendimento, título apenas '<autor> mencionou você numa nota'. Uma por Evento+destinatário, PK determinística de tupla inequívoca, Set e replay transacional, sem skipDuplicates. Dois eventos podem compartilhar criadaEm TIMESTAMP(3). Índice temporal parcial mantém as mesmas4colunas para tipo<>MENCAO_NOTA, preservando SLA/lembrete. Enum140000, criarparcial170000 e dropglobal180000 são reservas ROOT; schema/SQL só após RED e revisão, generate/DDL/snapshot pelo integrador.

Sino mantém ciclo SSR/navegação atual: aba aberta não recebe atualização realtime. Sem SSE/polling/refresh/consulta sob demanda nova. Link codificado para /inbox?c= e leitura por dono.

UI preserva Enter/ShiftEnter/IME; enquanto popup está aberto Arrow/Enter selecionam, Escape fecha e Tab não envia. Rascunho/nota/responder e ação pendente continuam protegidos. Props opcionais preservam os outros consumidores do Compositor.

Gates pendentes: puro/rota/interação e integrações autorizadas; duas notas mesmo horário; legado SLA/lembrete; regressões C3/rascunho/nota/idempotência/notificações; TSC/lint e QA independente. Visual real/protótipo com popup e sino em3tamanhos×2temas, teclado/mobile320500; N/A explícito quando sem equivalente. Sem homologação presumida.

## Checkpoint DEV de 23/10/2026

Domínio/UI/schema implementados. Gates dirigidos:18INT novos e26INT legados em execuções separadas,365unitários principais+171de consumidores, TSC e lint23fontes, todos saída0. Recorte inicial6arquivos/58casos terminou12falhas, não é verde:1premissa temporal da fixture corrigida e11falhas do produtorSLA preexistente, causalidade timezone/TIMESTAMP comprovada e tratamento isolado a cargo do ROOT. ProdutorSLA e relógio permanecem intactos.

A busca usa normalização comum do ERP no banco antes do limite:2–60caracteres, até201candidatos relevantes,20autorizados; não há cap global do diretório. Mais de200relevantes desabilitam apenas aliases livres, sem inferir unicidade por amostra. Comando sem mencoes preserva exatamente trim/hash legado inclusiveCRLF; comando com metadados normalizaCRLF→LF/trim. As3migrations foram aplicadas/verificadas pelo integrador, com snapshot337B490 próprio.

Visual, QA independente, global integrado e publicação permanecem pendentes. Pela prioridade de reviews/merges do usuário, não iniciar visual ou nova funcionalidade neste checkpoint. Relatório e evidências curadas: output/inbox-337-report.md e output/inbox-337-evidencias.json. Sem homologação presumida.

## Retomada e composição com as revisões pós-merge — 23/10/2026

O congelamento funcional c203da6df3c47d1c69031c8d310880a7393da182 foi composto por merge normal com ROOT 272a2b33452944d77b5f1e6ed2a750981f57c1bf. Acessibilidade dos anexos384 permanece por ID local incondicional e aria-describedby; o popup de menção usa outro useId independente. A assinatura mantém buscarMencoes opcional e o mock local usa a versão sem cast do ROOT. ConversaAberta conserva o ligação da nota #337 e a retirada das props órfãs399.

Escape395, novo teste real do hook SSE, remoção de contarNaoLidas, contratos 398–409, guardas e tooling foram preservados. Não há mudança no painel/tags da frente324. As exceções337 de option/aria-selected e referências DOM permanecem exatas; nenhum algoritmo de guarda foi relaxado.

Schema e três SQLs são byte a byte os do congelamento337 já aplicado: não há nova DDL, renumeração ou generate pelo DEV. Integrações antigas, 910/7159 e os demais gates de ROOT 272a não validam automaticamente esta composição. Aguardar cliente 490 preparado pelo integrador antes dos gates dependentes; usar exclusivamente snapshot/helper337 do banco490. Visual, QA independente, regressão relevante e a pendência SLA preexistente continuam sem aprovação presumida.

## Gates da composição retomada — 23/10/2026

Ambiente liberado pelo integrador: cliente Prisma 5.22.0 próprio, gerado em 43744/0d5cb0, verificação física ca40cd0 e preflight read-only f968da0 do banco/snapshot 490. Nenhuma DDL foi executada pelo DEV.

A validação inicial de bf823765 teve 17 arquivos/432 testes, com uma falha na paleta: o popup de menção usava shadow-lg. Foi trocada somente essa classe por shadow-popover, mantendo a guarda. Rodada final: 32 arquivos/671 testes unitários e consumidores, TypeScript e lint dos 23 fontes, todos terminais 0.

Integração: nota-mencao inteiro, 18/18 na fonte bf823765; quatro legados completos, 26/26 após o ajuste de classe, com backend inalterado. Duas invocações sequenciais no banco B490 exclusivo, configintegration/maxWorkers1, sem filtro/skips ou transportes. Não é suíte global. schema-sla é guarda pura; alertas-sla runtime não foi repetido e permanece pendente.

ROOT restaurou o snapshot490 em 6dcf6e, terminal 0, conferindo os 424 hashes/tabelas, migrações e fixture original. Fonte congelada antes do reparo SLA. Visual real/protótipo, QA independente, correção SLA e regressão integrada continuam obrigatórios. Não há preview/browser liberado sem novo Ready coordenado.

## Correcao P2: vinte avisos visiveis apos revogacoes — 23/10/2026

O limite de 20 e aplicado aos resultados visiveis, nunca antes de revalidar mencoes. A listagem percorre apenas notificacoes do proprio usuario em lotes fixos de 100, na ordem SQL criadaEm DESC/id DESC. O cursor usa os valores da ultima linha examinada e filtro estritamente menor na mesma ordenacao. Nao ha sort JavaScript, offset, teto silencioso de paginas ou acumulacao do historico.

escopoAtendimentos e calculado uma vez por chamada. Em cada lote, IDs de referencias MENCAO_NOTA/AtendimentoWhatsApp sao deduplicados e consultados juntos, por uma findMany com o mesmo escopo de leitura e contato individual. Nao ha atendimentoVisivel por notificacao, regra ACL duplicada em SQL nem nova permissao para SLA/lembrete. A consulta para quando obtem 20 visiveis ou esgota o historico. Memoria e consultas por pagina sao limitadas; o custo total depende das paginas revogadas examinadas e pode percorrer o historico proprio ate o fim. Nao e varredura de usuarios ou de todos os atendimentos.

RED unitario b20aa1: 7 casos, 3 passes/4 falhas causais, incluindo 20 mencoes revogadas ocultando SLA 21/lembrete 22. GREEN dirigido: 7 arquivos/74 unitarios, 5 arquivos/46 integracoes completas, TSC e lint dos tres fontes, todos terminal 0. PostgreSQL real cobre 205 revogadas antes de 21 mencoes validas, participante somente leitura e empate por ID ordenado pelo banco. Os gates anteriores continuam nominais aos seus SHAs; o negativo e preservado.

Novo freeze corrige o P2 de codigo para re-review; nao e homologacao. Visual, QA independente final, integracao do patch SLA #410 e regressao integrada continuam pendentes. A #410 permanece separada em 1995d87c e seu produtor nao foi incorporado aqui.

## Caret de mencao e handoff do harness — 23/10/2026

Probes privados reais na fonte a3bc identificaram P2: com texto “😀 @Al depois”, selecionar o homonimo preservava o sufixo, mas o caret ficava [35,35] no fim de “😀 @Alex Pessoa Fictícia 337 depois”, em vez de [29,29] antes de “depois”. Confirmado por assertions privadas em 1440×900 e 320×500, ambos saida 1. Nenhuma nota foi submetida nem aviso consumido; essas execucoes negativas nao integram allowlist.

A selecao pendente agora e aplicada sincronamente em useLayoutEffect, depois do value controlado estar no DOM. O ref carrega contexto, revisao, texto e indice UTF16; e consumido uma vez e descartado se o contexto/revisao/valor nao corresponder. Sem timer/RAF/await ou foco tardio. O indice avanca apos um espaco existente ou o separador inserido, preservando o restante do sufixo, inclusive dois espacos. A selecao do mesmo texto tambem aplica o caret no commit. Nenhuma API/prop compartilhada nova.

TDD ReactDOM: apos corrigir somente uma contagem da fixture, RED com 3 falhas causais de caret; final 13/13 cobre espaco presente/ausente/duplo, emoji, texto igual, revisao concorrente e troca A→B sem key. Recorte combinado 45 arquivos/775 casos passou; apos ajuste de tipo/binding somente da fixture, repetido teste afetado13/13, TSC e lint11 fontes saida 0. Report distingue cada fonte/negativo; nao e suite global. Backend/schema sao byte iguais a a3bc, preservando 46 INT nominais sem reatribui-los ao novo UI.

Recebidos SOMENTE 10 paths de harness/testes do handoff ce658 (scripts/visual e visual-inbox-*), mantendo #324 fora do produto e as 3 MDs 324 fora do commit. Guardas historicas de thread nao foram relaxadas: o helper antigo espera “Você” da fixture 314; o novo autor ficticio 337 exige prontidao privada que confirme autor original, notaID, dia, status e hidratacao. Formal337 aguardara novo Ready e usara essa distincao. Os novos estados 324 do harness nao homologam produto 324 nesta branch.

Autorizacao humana confirmada pelo integrador: “Sim, autorizar esses testes locais e a restauração”, para ate 8 notas positivas / 2 negativas337 e sino local, sem WhatsApp/email/externos. Nao houve submit durante estes probes; aguardam novo Ready apos este freeze, fixture/credenciais privadas e re-review. Visual final/QA independente/composicao #410/global/publicacao continuam pendentes.

## Rolagem do compositor vazio após confirmação — 23/10/2026

A confirmação da intenção atual pode limpar o value controlado enquanto o textarea ainda conserva rolagem interna de um texto longo. Em 320×500, o placeholder ocupa 62px em área interna de 42px; Chromium reteve scrollTop=20 após ACK, ocultando sua primeira linha. A limpeza por teclado e o baseline tinham scrollTop=0.

Após commit, um layout effect em texto/contexto zera somente a rolagem quando tanto o estado texto quanto o value do textarea estão vazios. Não há foco, seleção, timer, alteração de owner/revisão ou nova política de ACK. Texto não vazio em erro, intenção nova após ACK antigo e rascunho carregado de outro contexto preservam rolagem e foco.

TDD ReactDOM: RED com duas falhas 20→0, GREEN cinco casos; recorte 46/780 e lint dirigido terminaram 0. TSC com heap padrão terminou 134 por memória; repetido com heap8192 terminou 0. O browser causal na fonte d68 foi preservado. GREEN browser da fonte corrigida depende do novo Ready coordenado; nenhuma captura d68 é atribuída ao fix.

A matriz histórica d68 contém 32 APP e seis referências inspecionadas, oito notas positivas e uma negativa confirmadas. As oito notificações foram consumidas via SSR/navegação, sem canal novo de realtime. Uma única negativa continua disponível para validar o ACK corrigido, dentro da autorização humana de oito positivas e duas negativas.

## Validação visual local da menção e do ACK — 23/10/2026

Oito notas positivas em quatro tamanhos/dois temas comprovaram autocomplete de dois homônimos com papel, escolha por teclado, exclusão do ator sem ACL, nota interna persistida e exatamente um aviso para o escolhido. O sino foi validado por navegação SSR e leitura real, sem novo canal de atualização. Duas negativas confirmaram ausência de aviso quando se edita antes do token ou se remonta o rascunho sem metadados. Não houve mensagem externa.

A matriz de 32 APP + seis referências é histórica da fonte d68. O protótipo cobre somente baseline de nota; autocomplete/ACL/sino/IME não têm referência funcional equivalente. O complemento final é separado: duas imagens da fonte ab76 em 320×500/claro e ACK real com value vazio/scrollTop0, mantendo baseline y442..486 e foco sem intervenção. Não se atribui a matriz antiga à correção nem se alega cabimento integral do placeholder de duas linhas na área de 42px.

A prova IME é limitada a composição CDP/eventos nativos isComposing, sem seleção/submissão causada pelo handler; Enter produziu newline padrão. A repetição rejeitada automaticamente não foi executada. Auditoria ROOT confirmou dez notas/oito avisos, todos fictícios e nenhum transporte; limite humano oito positivas/duas negativas esgotado. Snapshot 490 foi restaurado em df221b/0 com 424 hashes e fixture original. Report e JSON curados registram negativos, fontes e limites; QA/regressão integrada/#410/publicação não são presumidos por esse visual.

## Preparação limpa para publicação — 24/10/2026

Branch codex/inbox-e2-337-preparacao, base congelada bf3443f4a922d2290ec18d372a4d2edf3ae69fb1. Origem final preservada em cae002d7a49c343a44f829be02ea61b72ccfc947. Os registros acima são históricos e seus gates não foram reatribuídos à nova composição.

Foram aplicados somente os deltas SRC/prisma de c203da6d → 9a9bfdc8 → a3bc5cb5 → d68f678c (dois SRC) → ab76f3f6 (dois SRC). O merge5541686f não foi reaplicado: as revisões da outra frente já estão na base. O harness misto d68 e seus testes visuais foram excluídos do porte; scripts/visual e matriz182 da base335 permaneceram intactos, sob ownership A326. As seis versões documentais finais de cae foram trazidas; no quadro, somente sete seções337 foram anexadas, sem apagar ou alterar o prefixo da base.

Três conflitos reais do c203 foram resolvidos por hunk: manter a guarda Tags da base junto às duas referências DOM337; manter useId tipado no mock; combinar buscarMencoes com idAvisosAnexos e as descrições acessíveis dos anexos. Os quatro patches seguintes aplicaram limpos. Verificação estática a5c946, EXIT0:25/28 paths iguais em LF à origem final; TODOS os executáveis, schema e três SQLs exatos. Dos24 TypeScript,22 têm AST do JS emitido equivalente; as únicas diferenças de JS são as duas guardas de Tags já existentes na nova base. A tipagem do mock em Compositor.test produz somente parênteses redundantes, sem diferença na AST. Essa prova não é typecheck, unit ou integração.

Os únicos IDs de migração são os três originais20261023140000/20261023170000/20261023180000. Não houve instalação, Prisma generate, schema novo, DDL, alteração de pacote/lock, DB, HTTP, preview, browser, push, PR ou merge. Cliente/perfil490 e lease serão preparados pelo ROOT após esta fonte; unit/TSC/INT dependentes ainda não foram executados. Não contar falha de cliente487 como RED de produto.

As provas visuais continuam nominais:38 imagens da fonte d68 e duas do ACK ab76, sem uma matriz40 atribuída à preparação nova. O ROOT registrou pacote histórico de3.743.253bytes, SHA256 db1203ff694febc3afb627b65d32f5eeac39b1ec8537f2411481bb7250546dfb, asset670630281/release draft421321214. Nenhum asset, PNG, ZIP, raw, credencial ou script privado foi portado. As oito notas positivas e duas negativas autorizadas já foram consumidas; NÃO executar novo submit/nota ou recaptura que grave. Placeholder de segunda linha permanece parcialmente visível: não se promete cabimento integral.

A interpretação dos contratos segue a origem: tokens selecionados e coordenadasUTF16, sem inferir homônimos; buscaSQL de candidatos antes do limite; nota/avisos/NOTIFY/idempotência na mesma transação; sinoSSR e P2keyset100 até20visíveis ouEOF, escopo único e ACL em lote; caret apóscommit com contexto/revisão/valor; ACK vazio zera sóscrollTop, sem foco ou seleção. Nenhuma dessas regras foi redesenhada no porte.

Fonte preparada para revisão e ambiente490. Gates atuais, QA independente exata, regressão integrada, CI/merge e publicação ROOT na ordem335→336→337 permanecem pendentes. A branch336, seu ZIP5FBD e as22PNG físicas foram preservados.

## Gates atuais da preparação limpa — 24/10/2026

Fonte executável congelada f971a9c84d1bf90981417f8c91f8ca1cffc773ea, branch codex/inbox-e2-337-preparacao, base bf3443f4. Nenhuma fonte mudou durante os quatro executores; tracked clean confirmado em 7a9c8e após o terminal.

ROOT preparou perfil dev-gravacoes/B490, sem DDL nova: auditoria 4cafa5, EXIT 0, confirmou 424 hashes/snapshot 337 e ausência de outras atividades. Generate próprio 3286/f147fb, EXIT 0 (64,86 s), cliente físico validado em 76cdae, EXIT 0, e Next typegen 0. O DEV não instalou, gerou, migrou ou alterou ambiente/cluster.

| Gate | Sessão/terminal | Resultado atual |
| --- | --- | --- |
| UNIT | 54035/1bd4f9 | EXIT 0, 46 arquivos/783 testes, 40,37 s, maxWorkers 2 |
| INT | 87016/3c2e61 | EXIT 0, cinco arquivos/46 testes, 165,26 s, maxWorkers 1/config integration |
| TSC | 78543/86130e | EXIT 0, heap 8192, nenhum diagnóstico |
| Lint | 413ab7 | EXIT 0, 24 arquivos TS/TSX, maxWarnings 0 |

UNIT inclui domínio, rota, sino, compositor, rascunho, ACK/scroll, guardas/schema e os 13 testes unitários existentes do harness da base; não altera ownership ou código do harness. A lista exata está no JSON curado. Integração executou os cinco arquivos completos: whatsapp/nota-mencao.int.test.ts, whatsapp/nota-interna.int.test.ts, whatsapp/inbox-idempotencia.int.test.ts, crm/notificacoes.int.test.ts e crm/lembretes.int.test.ts. Sem filtro de nome ou skips nas duas invocações. São recortes dirigidos, não suíte global.

Os warnings herdados vite-tsconfig-paths e MIXED_EXPORTS permaneceram; nenhum tooling/config foi alterado para silenciá-los. TSC/lint não emitiram diagnóstico; a prova é o código terminal observado na mesma sessão, não ausência de texto ou suposto arquivo vazio. Logs privados permanecem fora do Git; o JSON registra somente hashes/contagens quando o arquivo existe.

O banco foi liberado ao ROOT somente após 3c2e61, sem outra suíte B490 ativa. Restauro pelo helper 337B aguarda confirmação externa; não se presume execução. Nenhuma nota manual/UI, recaptura, mensagem externa, provider, preview, push, PR ou merge foi executado. As integrações automatizadas usam o banco descartável autorizado e não constituem nova prova UI.

A equivalência com cae foi comprovada antes dos gates: executáveis/schema/SQL exatos, mantendo apenas guardas de Tags da base nos dois testes. Os 40 PNGs permanecem históricos (38 d68 + dois ab76); orçamento humano de oito positivas/duas negativas esgotado. O placeholder de segunda linha continua parcialmente visível; não se promete cabimento integral.

Entrega DEV com gates atuais verdes na fonte f971. QA independente exata, ancestralidade final 335→336→337, regressão integrada, CI/merge e publicação coordenada continuam pendentes. Este complemento altera apenas documentação e não reatribui evidências visuais.
# Integração sobre main após #336 — 24/10/2026

Na composição atual, carregamento da busca de menções é anunciado como status; falha é alerta; resultado vazio usa EstadoVazio. Digitar/buscar conserva o foco e não registra nota. Dois testes de interação cobrem esses estados; as guardas globais de feedback e vazio permanecem estritas, com inventário do novo uso atualizado. Os 40 PNGs históricos continuam nominais a d68/ab76; a composição não cria nova evidência UI de notas ou de todos os IMEs. Gates, fontes e limites atuais em `output/inbox-337-composicao-final.md`; não reinterpretar os registros históricos desta SPEC como execução no novo head.

## R1 C5 — rastreabilidade do checklist e manutenção do índice

A decisão humana D20 está aprovada no [registro de produto](../planejamento/inbox-decisoes-produto.md): @menção gera aviso no sino somente para quem tem leitura atual do atendimento; a marca ✦ da tag sem autor permanece. O estado bloqueado e os nomes de testes da [Task 17 original](../superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-17) descrevem o planejamento anterior à resposta, não uma autorização ainda pendente. A tabela abaixo liga aqueles três nomes aos casos existentes, sem criar testes duplicados ou novas execuções.

| Nome no checklist original | Arquivo e caso existente | Regra observada |
| --- | --- | --- |
| `extrai_primeiro_nome_e_nome_completo` | [mencoes-nota.test.ts](../../src/lib/mencoes-nota.test.ts), describe “menções: aliases autorizados e inequívocos”, tabela com `@joao, falar com @ANA MARIA.` e `@Joa\u0303o Silva e @João` | Primeiro nome/nome completo sem caixa/acento, limites de palavra e homônimos; o servidor fornece apenas identidades autorizadas. |
| `ignora_o_autor_e_quem_nao_ve_o_atendimento` | [nota-mencao.int.test.ts](../../src/server/whatsapp/nota-mencao.int.test.ts), “menções repetidas da mesma pessoa deduplicam; autor/fora do escopo não recebem” e “participante somenteleitura recebe; revogação entre lista e submit exclui sem exigir envio” | Autor/sem leitura não recebem; leitura sem envio basta; revogação é revalidada no submit. |
| `repetir_a_nota_com_a_mesma_chave_nao_duplica_notificacao` | [nota-mencao.int.test.ts](../../src/server/whatsapp/nota-mencao.int.test.ts), “mesma chave sequencial e concorrente não duplica nota nem notificação” | Replay mantém uma nota/aviso; não usa skipDuplicates para esconder falha. |

O índice único parcial é mantido manualmente no SQL: `NotificacaoUsuario_legado_temporal_key` sobre `(tipo, refId, usuarioId, criadaEm)`, predicado `tipo <> 'MENCAO_NOTA'`, criado na [migration20261023170000](../../prisma/migrations/20261023170000_notificacao_mencao_unicidade_legada/migration.sql) antes da retirada do índice global na [20261023180000](../../prisma/migrations/20261023180000_notificacao_mencao_retira_unicidade_global/migration.sql). O schema documenta essa regra e conserva o índice de leitura `[usuarioId, lidaEm]`; não declara `@@unique` global equivalente, pois ele também impediria duas menções distintas no mesmo TIMESTAMP(3).

Ao revisar SQL de uma migração futura gerada, comparar com essas duas migrations e com [schema-mencoes.test.ts](../../src/test/schema-mencoes.test.ts): não aceitar remoção acidental do parcial, perda/troca do predicado ou restauração da unicidade global. Preservar nome, quatro colunas, unicidade e predicado, além da PK determinística Evento+usuário para menções. Não editar migrações já aplicadas nem executar seu SQL CONCURRENTLY dentro de uma transação; qualquer alteração futura exige nova reserva/revisão pelo integrador. Esta nota não gera SQL, DDL ou nova prova de banco.

## PR416 R1 — C3/C4 do servidor — 24/10/2026

O produtor processa cada ocorrência livre em grupos lexicais de alias completo/primeiro nome, do mais longo para o mais curto. Todos os membros de um grupo passam pela ACL existente e fresca, usando a mesma tx da nota; somente ausência total de autorizado permite tentar o próximo alias. Um grupo com dois ou mais autorizados continua ambíguo e impede fallback curto. Cache por ID true/false vive somente nesta invocação/tx e é compartilhado com tokens selecionados. O extrator original permanece intacto e recebe a união dos autorizados verificados. O grupo lexical nunca concede permissão ou escolhe identidade.

Sentinel201 é avaliado antes de formar grupos: mais de 200 relevantes desabilita texto livre, preservando tokens. Selecionados por ID não sofrem filtro textual; incompatibilidade ID/trecho ainda aborta nota e avisos. Nome longo oculto permite fallback curto entre autorizados; nome longo visível ambíguo impede esse fallback. Não há ACL em lote: @Ana amplo ou fallback pode continuar exigindo 200 verificações; com 50 IDs selecionados distintos a união pode chegar a 250. O ganho dirigido comprovado foi200→1 para @Ana Silva visível entre200 candidatos Ana, sem promessa de custo constante ou ganho universal. Listagem/sugestões e sua política de permissões não foram alteradas.

No sino, escopo é lazy no primeiro lote com MENCAO_NOTA/refTipo AtendimentoWhatsApp e memoizado apenas nesta chamada. Vazio, SLA/lembrete e refTipo incorreto não calculam escopo; nova chamada refaz autorização após revogação. Mantidos lote 100, keyset estrito criadaEm+id/cursor da última linha SQL examinada, ordem, ACL por lote e 20 resultados visíveis. Não há novo polling/SSE/refresh do sino.

INT48589/d80d91: seis arquivos completos/53 testes, 224,58 s, EXIT0, dev-gravacoes490 exclusivo; pool1/NOTIFY/replay/rollback e contagem real incluídos. Após terminal, somente UNIT foi reforçado:317970 EXIT0/quatro arquivos55 testes, com 4.608 comparações diferenciais; TSC00f37a e lint sete TS ee360c terminaram com saída 0. Manifesto preserva produto/INT antes/depois; report output/pr416-r1-server-c3-c4.md registra REDs, comandos, fontes e limites. QA exata do commit, composição C2 ROOT, global/CI/merge continuam pendentes; não há nova homologação visual ou nota UI. #327 segue pausada.
