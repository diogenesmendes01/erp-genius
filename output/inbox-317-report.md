# #317 — checkpoint produtivo DEV A

Branch codex/inbox-e1-317, base imutável 29479848432d2b4fd37972f104b6b7e5cae62368. Worktree inbox-dev-a; runtime Node 22.23.2. Fonte ainda sem aceite visual; commit deste relatório delimita o checkpoint produtivo, não uma entrega homologada. Branch316/27b preservada.

## Escopo entregue no checkpoint

- RodapeConversa: abas Responder/Nota interna por atendimento; semântica tablist/tab/tabpanel, roving tabindex, setas/Home/End, face26 e alvo44 por CSS. Dica somente / respostas rápidas. Variante travada com callbacks fornecidos, ainda sem produtor Aria na E1.
- Compositor: CampoTexto existente, moldura integrada, agenda apenas com callback real e somente Responder, nota âmbar, envio circular com nome acessível/aria-busy. Upload, emoji, voz, respostas rápidas e capacidades atuais permanecem; sem novo transporte.
- Nota individual usa a autorização de leitura já existente no servidor, independente da permissão comercial de envio. Grupo não oferece nota individual. Responder mantém null/carregando, false/negado e falha com Tentar de novo.
- Um coordenador local por atendimento executa o único useAcoesAtendimento existente e chama render-prop como função; cabeçalho/rodapé compartilham ações/agenda/diálogos, sem effect espelhando callbacks. Mesma conversa conserva caminho React do scroller/VList; contato realmente diferente pode remontar por ruling aprovado. Item null usa fallback real.
- Mapa useChavesPorAlvo existente vive acima da key; chave por tupla JSON atendimento+texto, renovada somente após ok. Compatibilidade com callback de um argumento e fallback local incondicional. A→B→A e texto incerto mantêm chave, resultado tardio não escreve no contexto novo.
- Proteção adicional por revisão de conteúdo/arquivo preserva edição deliberada durante await. Sucesso antigo renova apenas sua tentativa; não limpa novo rascunho/anexo. Upload substituído não despacha mídia antiga nem publica erro no conteúdo novo. Sem bloquear emoji/anexo por conveniência.
- Guardas somente nos registros específicos autorizados: dois Botões da variante travada, remoção do antigo Botao Enviar, controles Responder/Nota/Agendar/Enviar, duas ocorrências cruas reais Compositor e exceção aria-busy/modo de Enviar. Algoritmos/limites intactos; Rodape sem exceção de botão cru porque a contagem real é zero.

## TDD e evidências observadas

Todos os comandos abaixo foram observados até a saída terminal. Não houve suíte DB, full global, install, servidor ou browser DEV nesta etapa.

| Evidência | Resultado exato |
| --- | --- |
| ca0cb7 / ee19e8 | RED dos resultados obsoletos/permissão/idempotência e novo componente ausente; esperado antes da implementação |
| 11d703 | RED 4/4 de ligação real Rodape/Conversa antes do coordenador |
| 4ced94 | RED da guarda completa: 1/90 por registro sobrecontado; detector preservado |
| 3b0a6a | Diagnóstico com função original: Rodape zero botões crus; Compositor dois. Ruling ROOT aprovou registro medido |
| 73cd51 | GREEN Botões/Fundo/Compositor: 3 arquivos,124 testes, saída0 |
| 446735 → 0ca797 | RED orientação de resultado incerto → GREEN35; reutiliza executarAcaoCliente existente, sem helper novo |
| 38827 / 33289 | Históricos anteriores à proteção por revisão: 72 arquivos/803 testes e TSC saída0; não são gates da revisão final |
| a27db5 | RED dirigido final: 39 testes,2 falhas. Sucesso antigo apagava edição/anexo novo e falha antiga aparecia sobre a nova intenção |
| 5c42f4 | GREEN39 após proteção local por revisão |
| 173dbe | 41/43, duas falhas no helper de teste acionando botão por texto quando o nome é aria-label; corrigido só o acionamento do teste |
| 972373 | GREEN43/43: upload substituído e nota editada por emoji, confirmação/resultado incerto e chave original cobertos |
| 7989 | Recorte amplo final, saída0:72 arquivos/809 testes,34,75s, maxWorkers2; sem filtro de nome/ignorados. Inbox, componentes conversa, Menu, Botao e guardas de botões/campos/fundo/confirmação/responsivo/identificação |
| 57095 | TSC --noEmit heap8192, saída0, fonte final após revisão |
| fa7780 | ESLint11 fontes/testes afetados, --max-warnings0, saída0 |

Comando do recorte final:

    node node_modules/vitest/vitest.mjs run 'src/app/(app)/inbox' src/components/conversa src/components/Menu.test.ts src/components/Botao.test.ts src/app/botoes.test.ts src/app/campos.test.ts src/app/campos-texto.test.ts src/app/fundo-sobre-pagina.test.ts src/app/confirmacoes.test.ts src/app/responsivo.test.ts src/app/identificacao-registro.test.ts --maxWorkers=2

O node acima é explicitamente C:/Users/Mendes/AppData/Local/hermes/node/node.exe (22.23.2). Configuração unitária exclui integração; o número não é full global.

## Pendências e limites

1. CLI/harness317 ainda não alterado neste checkpoint. Próxima etapa é TDD e delta formal preservando todos os estados anteriores, hidratação, anonDOM392 e guardReact.
2. Browser real/coordenado: três tamanhos e dois temas app×protótipo para humano-compositor/nota; complemento320×500, permissões e agenda/abas/foco/scroll/identidade. Nenhuma PNG317 ou geometria comprovada ainda.
3. Correção C2/#402 do hook de busca pertence a outra frente. useBuscaConversa.ts e seu teste permanecem byte-iguais à base294; integrador fornecerá porte antes do formal/QA/global317. Nenhum aceite desse fix presumido.
4. Interações unitárias usam tela-sem-dom existente, hooks controlados e layout-effect sem cleanup real; não equivalem a hidratação/unmount/foco/medidas de navegador. Identidade comprovada é do caminho React, não observação DOM.
5. TESTER independente, composição com319/C2, global integrado, publicação e CI são etapas pendentes do integrador. Sem autoatribuir gates de outras branches ao checkpoint.
6. Banco dev-email permanece no snapshot original restaurado pelo ROOT282f2f; sem teste DB/server/browser DEV ativo e nenhuma escrita de negócio.

SPEC: docs/specs/inbox-rodape-compositor.md. Quadro recebe apenas seção317; históricos preservados.


## DeltaCLI posterior ao checkpoint a86

O produto a86c9ade33606350c1551c6a5759ebecc9366d6b permanece byte-igual. Novo commit separado altera somente CLI/prontidão/tipos/testes/README e este ledger/SPEC/quadro. Estado nota acrescenta12PNG, humano-compositor mais nota são24 formais planejadas; total136 (72app/64protótipo). Não houve imagem/browser/DB.

- RED8a9d75:6/6 por estado nota/prontidão ausentes e aviso de rodapé confundido com nota314. A correção de escopo exclui somente role=note dentro do footer; notas reais continuam exigindo data-nota-id e ausência de mídia/comandos/status.
- 402067:5/6; restante era mock de getByRole sem options no caso note, corrigido só no teste.
- 224da1:50/51; expectativa histórica124 da coluna atualizada para136, sem remover estado antigo.
- GREENff1da1 EXIT0:8 arquivos/51 testes de harness, sem filtro/ignorados;3tamanhos/2temas combinados em plano. CLI --help é executada por teste sem abrir browser ou DB.
- TSC38512 heap8192 EXIT0; lint8arquivos be4324 --max-warnings0 EXIT0; diffcheck c07e2e EXIT0. Node22.23.2 em todos.

Prontidão317 valida duas abas/seleção/painel e campo atual, header68, controles44 e viewport; nota sem agenda/anexo/voz e sem promessa de menção no app. Abrir nota espera thread real/hidratação e aciona só tab; protótipo usa sua aba/placeholder originais, menção histórica documentada como divergência. Manifesto/fonteApp/hashes, guardReact/hidratação/rede e anonDOM392 após interações/antesfoto preservados.

Formal aguarda C2/#402 congelado e preview fornecido pelo integrador. Testes DOM mínimos não medem CSS real; os tamanhos declarados são plano de captura, não aceite visual. TESTER estático do produto a86 em andamento. Nenhuma captura antiga é atribuída ao compositor317.
