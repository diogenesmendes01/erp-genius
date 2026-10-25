# Inbox #350 — candidata DEV, TSC e aceite visual pendentes

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

UNIT25 completo/w1 terminou na MESMA sessão75190/298d77, EXIT0:25arquivos/544casos,61,61s; sem filtro por nome ou skip. Lista exata: quatro testes novos em inbox/aria; ConversaAberta{,.rodape,.mencoes.interacao,.busca}; InboxNovo{,.interacao,.detalhes,.foco}; itens-thread; VirtualList{,.estavel}; virtual-window; historico-conversa; agora-thread; busca-conversa-virtual; acao-cliente; Botao; botoes; paleta; contraste; enums-rotulos. Recorte relacionado, não UNIT global.

TSC ainda NÃO iniciado: janela coordenada ROOT após global/TSC344. Nenhuma DB/INT, fixture, preview, captura, HTTP, schema/migration, instalação ou provider foi executado nesta frente. Perfil/client preservados, sem lease492. Recortes INT eventualmente necessários dependem de lease própria; não presumir aprovação de fonte nova pelos testes antigos349.

Aceite visual seis pares APP/PROTO e interações nativas estão pendentes de fixture/GO específico. Não houve aprovação/envio real. QA independente, união dos hunks com328/344/345, CI/merge/publicação pertencem ao ROOT. #350 não está concluída ou homologada.
