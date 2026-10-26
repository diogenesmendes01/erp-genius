# QA estática #327 — porte R2 sobre Main/#420

Favorável à congruência do porte exato 9a8ebc81fe59eb978a219443485952d56ab83bbe sobre 74d4dbc67fd1d9c3750633029f4141c8cbcfc597. Não encontrei regressão estática que exija correção antes da coordenação dos gates de integração pelo ROOT. Isto não é saída verde de UNIT/TSC/INT da árvore nova, autorização operacional ou aprovação de merge. Não executei testes, CLI/main, browser, HTTP ou DB; não alterei checkout A ou meu checkout #351/6fe/cliente490.

## Fonte e cobertura

Três commits: ca208d9cd61ce562eff3854135bafead6e0e4043 (fundação mínima328), 83b50b99caf74f51e73885ce696e076ed24db362 (produto327) e 9a8ebc81 (harness/documentos). Manifesto privado A/output/inbox-327-port-r2-fontes-pre-gates-private.json: 536.074 bytes/SHA a4bf6b85f5b8bbcae98323d4b3e778ccde514b87c82bf8e34e4ad79e7c98f454, copiado byteigual ao snapshot TESTER. A fonte histórica cfa24329 e APP histórica EBF são antecedentes, não nomes da nova árvore inteira que agora inclui Main.

Verificador próprio verificar-inbox-327-port-r2-tester.mjs, sessão55553/terminal55f335 EXIT0: 3.530 OIDs da cobertura declarada (src, scripts/visual, Prisma, package e lock), sendo 21 paths selecionados que já existiam e 3.509 não selecionados preservados exatamente. Todos os registros foram comparados aos trees Git da base e do porte; não apenas a amostras. Conferi adicionalmente os 42 scripts não visuais fora dessa cobertura e os workflows: nenhum delta. Isso explicita o escopo do número3.530 sem alegar que era o tree inteiro do repositório.

Os 45 paths selecionados têm OID de base/cfa/porte e hashes GitLF corretos; bytes/hash físicos no A congelado e normalização LF também conferidos. São 40 arquivos literais cfa e cinco exceções identificadas abaixo. Nenhuma diferença executável fora dessa whitelist foi encontrada. Fora dela, só quatro documentos autorizados mudaram: quadro, SPEC327, relatório de curadoria e manifesto de handoff.

Meu primeiro verificador c1ea9a presumiu que a tabela incluía todos os scripts e contou3.572; preservei o negativo administrativo e corrigi a definição da cobertura. Os42 arquivos adicionais foram então verificados e são iguais. Nenhuma divergência real foi ignorada ou fonte modificada para satisfazer a prova.

## Cinco exceções reconciliadas

1. acoes-painel.ts: as sete funções completas e todos os imports são literais cfa. O diff efetivo é somente uma linha em branco separando os dois wrappers; removê-la recompõe o módulo cfa inteiro. A prosa do manifesto menciona ordenação de imports/checkpoints, mas o resultado final tem imports idênticos, sem diferença funcional adicional.
2. InboxNovo.tsx: reverter apenas a expressão (detalhesComerciais && abaAtiva===detalhes) || editorAberto para a expressão antiga cfa recompõe TODO o arquivo cfa byte a byte. A expressão correta420 ficou no porte; preserva o editor aberto também fora da finalidade comercial. O hook Oportunidades continua separado/sob demanda. Nenhum callback, ciclo SSE/cache, estado de modal ou ACK foi alterado para acomodar o porte.
3. InboxNovo.foco.test.ts: remover apenas a sequência dos quatro defaultsDTO343 recompõe o teste cfa inteiro. Mocks, asserts, drivers e causais327 anteriores permanecem. Os defaults da Main343 são preservados, sem cast ou relaxamento do teste.
4. SPEC do produtor de perda: somente adendo R2; conteúdo cfa anterior permanece prefixo literal. Gates da nova composição são explicitamente pendentes e a UI328 permanece parcial.
5. README do harness: somente adendo R2; prefixo cfa preservado. Explicita que CLI histórica não equivale ao wrapper A11 e não autoriza operação nem substitui API facade, allowlists, drenos/SSE/QA.

As exceções são menores ou iguais às justificativas aprovadas. Não há hunk desconhecido de produto escondido sob a normalização. As fontes e testes de oportunidades, seus helpers/harness, consulta/autorização e a fundação mínima restante permanecem literais cfa nos outros40paths. Não se conclui disso aprovação dinâmica da nova árvore.

## Proteções de Main e contratos

A preservação dos3.509 não selecionados inclui Main337/Compositor, ConversaAberta, Sino/notificações, menções, labels, whatsapp/ações/sessão, schema490/migrações/dependências e guardas anteriores; não foram revertidos pelos blobs antigos A. Conferi também os paths explicitamente não portar do handoff e o tree Prisma inteiro. Não foi importada a história agregada EBF/cfa que continha reversões fora da seleção.

Os comuns953, nucleo-captura, espera-app, Detalhes325/coletorDetalhes, hook useAbaPainel e GavetaContato são iguais à base74d. APIs, papéis e propriedades de edição326 permanecem, incluindo OR do editor, R1/cache e aquisição única. A nova aba e callback contextual não substituem os gates B2B/hrefs ou a permissão global independente de abrirFunil.

Em acoes-painel, as funções novas e as existentes são as mesmas cfa já revisadas: alvos resolvidos na thread, ID esperado apenas CAS, lock Atendimento→Lead, ator/ACL atuais relidos depois da espera, núcleo interno e aviso somente quando mudou na mesma tx. Nenhuma sessão/cliente global/transação autônoma foi acrescentada ao helper. A nova leitura de oportunidades não usa locks de mutação nem amplia outras oportunidades por vínculo Pessoa sem escopo.

A fundação328 portada é somente a dependência de PERDIDO327: núcleo marcarPerdidoTx, contextoCAS, wrapper e prop opcional do ModalPerda com testes/fixture/SPEC pertinentes. O caminho default Funil mantém API/validação/revalidação; o callback evita invocar a ação global para Inbox. CartaoExperimental, Assumir, agendar/enviar/confirmar, transferir e restante UI/visual328 não entram. Nenhum documento fecha328 parcial.

## Provas históricas, ambiente e próximos gates

O corpus18 e ZIP aprovados na curadoria continuam históricos individualizados: seis A7admin9480, seis PROTO A9be45 e seis leitores A11cfa. Não são captura da nova árvore9a8 nem run18 único; A7 mantém a qualificação de href/slot/fronteira não medidos retroativamente e badgeNext, A9 referência estática, agregados antigos negativos e A10zeroPNG. Esta revisão não certifica novos PNGs nem executa wrapper antigo contra Main. O wrapper A11 pinava cfa e seus recursos/READY anteriores; não se deve reutilizar sua autorização/pins como se validassem automaticamente o porte491.

ROOT comunicou cliente A490 preparado em14922/d67f07 e baselineA491/snapshot557 fc12cc64; é preparação do integrador, sem consulta minha. O manifesto foi emitido antes dos gates e registra UNIT/TSC pendentes e INT sem GO. A execução global44258 foi comunicada em curso; não conferi seu terminal nem presumo sucesso. TSC, integração na mesma fonte/Db491 e eventual nova QA de composição devem conservar fonte congelada e resultados próprios. Nenhum green487/cfa ou corpus EBF substitui esses gates novos.

Meu parecer anterior de curadoria fd6/fedea5c6 permanece independente; o antigo manifesto de45hunks relativo420/179b é um inventário histórico. O manifesto R2 ora conferido fornece os OIDs atuais9a8. Fonte/README/fundação precisam manter esses namespaces e os limites de CLI versus wrapper. A publicação dos anexos327 continua aguardando a autorização coordenada; nenhum upload, merge ou conclusão327/328 é presumido.

Prova privada output/inbox-327-port-r2-review-tester/identidade-tester.json, 22086 bytes/SHAb72e2155a75d5ff6cf81f23a30d9ece9b5dc482d884d33344a515e096848ff25. Nenhum banco ou ambiente foi alterado por esta revisão; meu TESTER491 permanece sem lease e restaurado pelo ROOT. GO de integração e demais atos operacionais pertencem ao ROOT, após conferir os terminais/preparo que considerar necessários.
