# Inbox #350 — candidata DEV, aceite visual e nativo pendentes

Base coordenada MAIN fabf7addf291de6e4b821927cfc1c88ce93bd9fb; branch codex/inbox-e3-350-cartao-sugestao. Plano privado e638e8cf102988e78225415ba6fdb93648a80c359e11da145613a824b20eaee9 aprovado pelo ROOT, incluindo decorator temporal e perigoContorno/classificador fechado. A fonte #345/2cd984b e seus relatórios seguem preservados em branch/output; #350 não depende de #344 ou #345.

## Implementação e preservação

Projeção pura, intercalação e cartão consomem SugestaoAriaThread/ações #349. Uma prop aditiva passa aria do painel atual para ConversaAberta. Nenhuma autorização, schema, dependência, consulta, servidor, executor ou decisão de negócio mudou. PainelAria legado preservado para #353. D1/D2 aprovadas continuam como extensões #354–356; não são novas dúvidas de produto.

A intercalação ocorre antes da decoração atual de mensagens/notas/dias; nova variante rompe sequência sem contaminar cursores/comandos/status de transporte. VirtualList núcleo intacto; consumidor passa a reconhecer foco do cartão. Um teste observa suas props renderizando o núcleo real com mais de100itens e compara keys de mensagens. Isso não comprova teclado/layout nativo.

O cartão usa actions existentes e useAcaoCliente/FeedbackAcao reais, sessão por ID, trava síncrona e callback guardado contra ACK desmontado. Não altera status otimisticamente. podeDecidir=false do lead do atendimento não esconde cartão já autorizado pela oportunidade da ação. Troca de seleção limpa a prop antiga enquanto painel novo carrega.

perigoContorno mantém tokens/foco/disabled/mínimo44. Quatro pontos de classificação compartilham somente o conjunto exato perigo|perigoContorno; nomes inventados, secundário/fantasma, ramo invertido, condições distintas e spreads opacos continuam negativos. Mapa registra dois novos botões. ROOT autorizou uma entrada exata ROTULOS_DINAMICOS arquivo/nome(sem nome)/vezes2, acompanhada de âncora AST: origem visualSugestao, bindingv único/sem atribuição e filhos/variantes dos dois Botao exatos. Seis mutantes recusados. Nenhum resolvedor genérico ou nome acessível foi alterado.

## TDD nominal — nenhum resultado reatribuído

| Executor | Resultado |
| --- | --- |
| fb2637 | RED inicial: dois módulos ausentes/zero coletados; decorator real falhou na nova variante,21 controles verdes, EXIT1 |
| 40d526 | GREEN três arquivos completos/43, EXIT0 |
| db0bb9 | RED Botao/guarda:5 falhas causais/93 controles, dois completos/98, EXIT1 |
| 34986/f5c8d7 | GREEN quatro completos/124, inclui paleta/contraste, EXIT0 |
| 7b30fe | RED cartão ausente e consumo real ausente na thread;31 controles, EXIT1 |
| 0f8d66 | Dois completos/38 verdes; seis falhas administrativas no DOM mínimo sem createElementNS/SVG, EXIT1 |
| 7eec99 | GREEN interação completo6/6 depois de mock SOMENTE dos glifos, EXIT0 |
| b54994 | RED do hunk de prop retirado por backup exato: InboxNovo.interacao completo82,1 falha causal/81 controles, EXIT1 |
| 2038/9d59cb | Recorte12 completos/424:422 verdes e DUAS falhas REAIS DE GUARDA (mapa/rótulos sem registro), EXIT1; não é recorte aprovado |
| 9e056f | RED alinhamento completo6:1falha/5controles; self-end sozinho não basta na row flow-root, EXIT1 |
| 019fed | GREEN quatro completos/127 após ml-auto e prova virtual/contexto, EXIT0 |
| 6f2d83 | GREEN guarda/estático completos98/98, registro e âncora aprovados ROOT, EXIT0 |
| 5a2b9b | Lint17SRC/testes anterior à âncora final, EXIT0 |
| dd095a | Lint final17SRC/testes, após âncora e oráculos adicionais, EXIT0 |

Os novos módulos ausentes são negativos de implementação, separados dos erros administrativos SVG. A correção SVG está apenas no teste de interação; estático usa ícones reais. ReactDOM, executor, feedback e componente continuam reais. Backup do hunk Inbox foi restaurado só depois do terminal RED. Não se somam recortes sobrepostos nem se chama recorte de global.

Prova final de preservação 53d0aa, EXIT0:15 paths de backend/DTO/ACL/ações/hook/VirtualList/PainelAria/schema/deps iguais à base normalizando EOL;12 corpos AST antigos de itens-thread/Botao literais. InboxNovo equivale à base removendo SOMENTE a linha aria={painelDoAberto?.dado?.aria}. Prefixo do quadro1.154.254bytes/SHA2569b560f5b1b84b549c49b6607e626bb85b6c3cf1880786200d5a846b4d71895cb preservado byte a byte. Índice privado de identidade1.389bytes/SHA256f69498d423ee2012fbb62ebbd46c133b758c0f50ce477956eaebf55a30450f75.

## Gates finais e pendências

UNIT25 completo/w1 terminou na MESMA sessão75190/298d77, EXIT0:25arquivos/544casos,61,61s; sem filtro por nome ou skip. Resultado nominal ao runtime b0be ANTES do fix de foco, não reatribuído à fonte posterior. Lista exata: quatro testes novos em inbox/aria; ConversaAberta{,.rodape,.mencoes.interacao,.busca}; InboxNovo{,.interacao,.detalhes,.foco}; itens-thread; VirtualList{,.estavel}; virtual-window; historico-conversa; agora-thread; busca-conversa-virtual; acao-cliente; Botao; botoes; paleta; contraste; enums-rotulos. Recorte relacionado, não UNIT global.

TSC ORIGINAL80288/44bd90 terminou EXIT2 no b0be, com três diagnósticos preservados: TS2307 nos dois caminhos privados históricos326 e TS2345 em intercalar.test.ts:12 (lista vazia inferida sem id). O delta efd561393b61044aa59ab23c402b2097a3d7a422 explicita o genérico em uma chamada, sem mudar asserts/runtime; arquivo completo6/6 e lint1 em3930c7 EXIT0. A execução auxiliar foi adiada até a QA causal de foco; o terminal final está registrado no adendo abaixo. Somente os dois caminhos históricos poderão ser excluídos, preservando todos os excludes originais e todos os SRC/testes atuais. Nenhuma DB/INT, fixture, preview, captura, HTTP, schema/migration, instalação ou provider foi executado nesta frente. Perfil/client preservados, sem lease492. Recortes INT eventualmente necessários dependem de lease própria; não presumir aprovação de fonte nova pelos testes antigos349.

Aceite visual seis pares APP/PROTO e interações nativas estão pendentes de fixture/GO específico. Não houve aprovação/envio real. QA independente, união dos hunks com328/344/345, CI/merge/publicação pertencem ao ROOT. #350 não está concluída ou homologada.


## Correção causal de foco e anúncio após decisão

TESTER reproduziu no runtime b0be: a25472 EXIT1, seis casos=quatro falhas (aprovar/rejeitar por ACK ou SSE antes do ACK) e dois controles verdes. O mesmo article persistia com o texto correto, mas controle removido perdia foco conectado/contextual no DOM mínimo e faltava anúncio do estado. Prova original84bc7e4bf7e0bb780f56faca07644800cd18ff0e5446fdd6ee2a570e2739b52b/9.104bytes preservada; os quatro oráculos permanecem inalterados no teste versionado.

DEV REDb4c093:11completos,9falhas/2controles, EXIT1. Complementos: SSE sem nossa ação/ACK, foco movido para fora e blur emulado ao desabilitar. Fix produtivo somente CartaoSugestaoAria: snapshot de origem antes de busy +refdetach estável antes de remover o grupo; em layout, foco no resultado conectado se o controle foi perdido, preservando foco externo. role=status sempre montado antes da decisão, sem inventar ACK/sucesso e sem tomar foco a cada reload. Sem alteração em VirtualList, IDs, ACL, backend ou compositor.

GREEN1a4f1d:quatro arquivos completos/40casos, heap512/w1; lint2 ac46f8 EXIT0. Controles de erro/expiração, ACK desmontado/cardB, duplo clique e transporte incerto mantidos. São testes ReactDOM reais com glifos fakes; ainda não prova nativa/visual. Não repetir global ou atribuir o UNIT25/544 anterior ao runtime corrigido. Este checkpoint precedeu a QA causal e o TSC auxiliar final, registrados no adendo abaixo; os demais aceites permanecem pendentes.


## TSC auxiliar final e transferência da candidata

Fonte executável congelada4b682c913e02960cb6a3ee7b5400476d14114379, sobre o delta de testeefd561 e baseb0be. ROOT comunicou QA causal independente favorável: seis casos originais e onze de foco, mais lint2. Isso não substitui QA geral, aceite visual ou interação nativa. A execução original80288/44bd90 continua EXIT2, com seus três diagnósticos, sem reclassificação.

TSC AUXILIAR92312/b61820 terminou EXIT0 no mesmo executor, Node22/heap8192, --noEmit --incremental false --pretty false -p tsconfig.inbox-342-aux-private.json. Validação9c3b13 confirmou extends da configuração original, todos os includes/excludes originais preservados e SOMENTE duas exclusões adicionais: output/inbox-326-a2-diagnostico-private.test.ts; output/inbox-326-package-r8-7a30d4-preservado-private/inbox-326-a2-diagnostico-private.test.ts. Nenhum SRC, teste novo, config atual ou output inteiro foi excluído. Não se chama esse resultado de TSC original/global do checkout.

Todos os executores DEV encerraram, sem repetir global/UNIT25 após o fix por rotina. UNIT25/544 permanece nominalb0be; para o fix4b os quatro completos/40 e lint2 são nominais próprios. Este fechamento é somente documental: TODA árvore src de4b deve permanecer idêntica, assim como prisma/package/lock. Manifesto privado final separa hashes GitLF/físicos e fontes de cada gate. Nenhum banco/fixture/preview/build/browser/provider ou negócio real executado nesta frente.

Plano visualFS é nominalb0be e não é pacote operacional. ROOT escolheu18pares/36PNGsRAW (seis primários de resposta e doze complementares tarefa/aprovado); fontes/refs c1/c7 e diferenças pacote/individual permanecem propostas, exigindo novos pins do runtime4b/composição antes do GO. Visual/nativo, eventual integração pertinente, QA geral, união328/344/345, CI e publicação continuam pendentes. Não concluir350.
