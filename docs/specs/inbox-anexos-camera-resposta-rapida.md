# Inbox — anexos, câmera e resposta rápida (#365)

O menu de anexos reutiliza o Compositor existente. A ordem é Documento, Fotos e vídeos, Câmera, Áudio, Localização, Contato, Enquete, Proposta e Resposta rápida. Os itens usam ícones e organização em três colunas; o aceite visual permanece pendente.

Câmera abre o seletor local com accept image/* e capture environment. Documento, mídia e áudio removem capture antes de reutilizar o mesmo input. Nenhuma câmera real é aberta pelos testes e selecionar uma entrada não envia mensagem.

Resposta rápida aparece quando existem respostas disponíveis. A seleção prepara `/`, fecha o menu e foca o campo, sem enviar. O usuário pode continuar editando e escolher uma resposta pelo mecanismo existente. Intenção nova não é apagada por ACK antigo; callback de outra conversa não altera nem foca o contexto atual.

Proposta usa somente a porta opcional `propostas?: { oportunidadeId: string | null; aoAbrir: () => void }`. O item aparece com oportunidade não nula e callback disponível; um clique chama o callback uma vez. A ausência da porta esconde o item. DTOs, controller e envio da #366 ficam fora desta entrega.

Localização, contato e enquete mantêm os bloqueios e motivos atuais do MOTOR. Permissões de envio, nota, contexto e bloqueios existentes continuam sendo aplicados. Não há mudança de backend, schema, provedores ou política de Aria.

A integração pública deve aplicar hunks sobre MAIN 0dc1ede1, preservando diferenças legítimas do Compositor público. Não transportar o blob privado completo nem incorporar AriaLocked por esta funcionalidade.

Cada ícone fica em quadrado arredondado de 40px (h-10/w-10/rounded-lg). O ícone é decorativo e o botão mantém seu nome acessível. As equivalências aprovadas usam os tokens existentes: Documento/Contato azul; Mídia/Resposta violeta ai; Câmera/Áudio vermelho rosado; Localização/Proposta verde; Enquete laranja. Onde o ERP não possui rosa, coral ou violeta distintos, a aproximação pelos tokens registrados é deliberada; não é correspondência pixel a pixel com os hues do HTML. Nenhuma cor inline ou paleta global foi adicionada. Alvo, foco, disabled e descrições MOTOR permanecem iguais.
