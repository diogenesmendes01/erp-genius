# Compositor durante condução Aria — #358 / D3

## Regra

D3 aprovada: bloquear saída externa durante os estados canônicos `ia`, `aprovacao` e `handoff`, permitir nota interna. Assumir para responder usa somente `assumirConversaDaAria` (#357), que atribui, pausa MANUAL e trata pendências. Não implementa edição/aprovação #355, não amplia alçada de vendedor ou convidados e não muda o dispatcher global.

O helper puro `modoRodape(estado, nota)` seleciona barra nos três estados somente na aba Responder; Nota continua compositor. Textos: “Aria está respondendo esta conversa.”, “Aria aguarda aprovação da sugestão acima.” e “Aria parou de responder e aguarda um humano.”. Humano/null e grupo/encerrado conservam seus controles legados.

## Estado local e saída

RodapeConversa conserva uma única seleção de aba e a instância do Compositor. A barra não desmonta a instância; File e rascunho permanecem em memória durante bloquear/desbloquear a mesma identidade. A troca de aba conserva as regras de rascunhos/revisões anteriores. Nota usa a action de nota e a sua idempotência atuais; não cria intenção externa, anexo ou gravação de voz.

Compositor recebe bloqueioExterno opcional, default false. Sem campo externo visível quando bloqueado, com validação do estado/geração atual antes do handler e após upload. Enter, callback retido e upload tardio não podem enviar. Voltar a permitir envio cria geração nova, sem reviver handlers antigos. Não limpa automaticamente File, texto ou nota. Reconciliação de ACK de envio já ocorrido continua usando a revisão de intenção existente.

## Tomada e foco

O controlador local do rodapé usa useAcaoCliente idempotente, capacidade contextual obrigatória, envio confirmado e leitura corrente. Não oferece CTA com leitura pendente/503 ou envio negado. Duploclique gera uma tentativa; falha explícita permite retry da tomada. Depois do ACK, retry é só leitura pelo aoMudar já existente, sem repetir Assumir.

Foco exige ACK vivo, painel200 posterior ao ACK/retry, owner/envio/capacidade atuais e a lista canônica fora dos três estados Aria. Lista e painel podem chegar em qualquer ordem: nenhum libera cedo sozinho. Nenhum DTO novo ou inferência de humano por pausada. A→B→A, unmount, perda/retorno de capacidade/envio e responsável concorrente invalidam intenção antiga. Foco somente no textarea da mesma conversa, sem selector global, remount ou envio automático. Cabeçalho/AbaOportunidades permanecem sem autofocus.

A ponte #352 recebe apenas gate aditivo de disponibilidade, default true, separado de perda de permissão. Enquanto a lista ainda informa condução Aria, o campo indisponível adia a conclusão; não passar podeEnviar falso só por atraso de lista. A integração inclui o carry coordenado da correção357 (f347→1a8aaa), com regressões próprias da disponibilidade.

## Actions de saída no servidor

EnviarTextoInbox e enviarMidiaInbox enfileiram pelo mesmo núcleo db-aware, na mesma TX da autorização e da regra de condução; despacho ocorre somente após commit. Schemas de entrada, posse de mídia por autor, MIME, número ativo, opt-out, destinatário e escopo de envio continuam exigidos. ConversaVisivel é alias literal de atendimentoVisivel, já db-aware; nenhum leitor global substitui a TX.

A correção C1 da PR #446 inclui também enviarConteudoInbox: enquete, localização, contato, figurinha e GIF usam esse núcleo. O ramo especial preserva atendimento aberto, canal MOTOR conectado, MIME específico e arquivo do próprio autor. As exigências de canal/sessão continuam específicas desse ramo. Texto e mídia conservam os seus contratos.

O ator relido depois do lock também passa pela barreira pura apenasPortal usada por exigirSessao. Assim, uma mudança concorrente para papel exclusivamente ALUNO não aproveita um convite antigo para continuar enviando. Essa verificação usa a mesma row da transação, sem sessão memoizada ou conexão global.

Ordem: pré-materializar ConfigIA antes do pai → Atendimento FOR NO KEY UPDATE → ator/escopo/destino frescos → situacaoAria, ConfigIA.findUnique e aggregate de custo com relógio fresco → handoff/sugestão canônicos → derivar estado → recusar ou criar intenção HUMANO. Ausência de Config depois do pai falha fechado; não há upsert tardio, lock novo de Agente/Ação, advisory ou skip-locked. Estado global/configurados anteriores à espera não autorizam o envio.

O cálculo de orçamento é fatorado para cálculo puro compartilhado; estadoOrcamento conserva seu comportamento default de upsert e aggregate. Seu corpo não é declarado literal. Dispatcher, CRM, executor355 e helpers globais de pausa não mudam. Intenções humanas existentes/ENVIANDO e integrações externas não recebem nova política por esta entrega.

## Evidência e pendências

Relatório DEV em output/inbox-358-report.md; plano/matriz fictícia em output/inbox-358-plano-ro.md e inbox-358-visual-blueprint-proposta.json. Nenhuma fixture visual foi aplicada ou captura executada pelo DEV. Aceite visual exige 1440×900, 1024×768 e390×844, claro/escuro, comparados com o HTML original; pronto/credenciais/origem continuam fechados até admissão ROOT.

Gates globais originais, TypeScript, build, QA independente e visual devem ser observados na composição exata de publicação. A entrega não encerra automaticamente issue/D3 nem autoriza envio real ou publicação.
