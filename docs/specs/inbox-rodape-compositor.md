# Rodapé e compositor — #317

Base29479848432d2b4fd37972f104b6b7e5cae62368; implementação inline da Task12/brief aprovado. Branch31627b imutável. Só317+319 ativos.

RodapeConversa mantém abas Responder/Nota por atendimento, alvo44 com face26 e teclado/setas/Home/End/aria. Reutiliza Compositor e o único controlador de ações por atendimento (coordenador local/renderprop, sem wrapperDOM). Header/busca/Thread/rodapé permanecem na mesma árvore durante abas/interações/cargas; troca real de contato encerra o coordenador e pode remontar scroller, rulingROOT explícito. Itemnull é fallback real.

Nota usa autorização atual de leitura individual; não depende de envio comercial nem cria backend. Gate de envio null/false/falha continua na abaResponder. Agenda só callback real do controlador existente, nenhum novo diálogo/consulta. Variante travada completa/testável mas nunca ativada pela fonte E1; Aria produtora fica E3/D3. CampoTexto e funções de upload/emoji/voz/respostas rápidas permanecem.

TDD primeiro: resultado antigo sucesso/falha/rejeição não limpa texto/arquivo/erro atual; troca modo libera estado ocupado; A→B→A e cleanup sem vazamentos; tentativas de nota por atendimento+texto, chave estável noerro e renovada apenasok; callbacks existentes de1arg compatíveis. Abas preservam rascunhos separados; nota não inclui anexo/agenda/voz.

Recortes/TSC/lint/SPEC DEV; CLI somente após freeze de código; preview/DB e formais app×protótipo coordenados posteriormente. Sem instalações/package/schema/backend/envio real. Guardas somente registros específicos autorizados após leitura. Identidade e estado de Thread319 pertencemB, sem implementação paralela nessa região.

## Tentativas e revisões locais

O mapa de chaves existente vive uma única vez em ConversaAberta, fora do coordenador com key de atendimento. Rodape/Compositor aceitam a prop opcional; o fallback local é chamado incondicionalmente. O alvo é a tupla JSON atendimento+texto, sem colisões por delimitadores. Retentativa após erro/resultado incerto conserva a chave, inclusive A→B→A e retorno a um texto anterior. Só confirmação ok renova a tentativa original, mesmo tardia; callbacks de um argumento continuam compatíveis.

Contexto de montagem/modo e revisão de conteúdo/arquivo são proteções distintas. Uma resposta antiga não limpa o rascunho de outra aba/contato nem uma intenção deliberadamente editada enquanto aguarda. Uma edição não altera a chave da tentativa incerta. O upload antigo também não despacha mídia nem publica erro sobre o arquivo substituído. Emoji, anexo e respostas rápidas continuam acionáveis. A ocupação é liberada ao terminar, sem aplicar sucesso/erro antigo como resultado do novo conteúdo. Nenhuma lógica compartilhada de idempotência ou fluxo servidor foi alterada.

## Limites do checkpoint produtivo

A variante travada tem comandos reais fornecidos por callbacks, mas não há produtor Aria E1 que a ative. A integração usa sempre modo compositor. Grupo não oferece nota individual. O comportamento de leitura individual foi conferido na action existente; não houve integração DB nesta entrega.

Testes de marcação usam React SSR; parte das interações usa o harness existente tela-sem-dom, com hooks controlados e layout-effect aplicado sem simular cleanup/unmount real. Eles verificam contratos, callbacks e identidade React, não comprovam geometria/foco do navegador. Mount/cleanup real, identidade do scroller, teclado, alvos44, 320×500, imagens app×protótipo, fluxo de permissões, QA independente e global integrado permanecem pendentes de janela coordenada.

O hook useBuscaConversa e seu teste permanecem intactos na base294. A correção C2/#402 é de outra frente e será incorporada pelo integrador antes do QA/formal/global317; este checkpoint não atribui essa correção à própria fonte.
