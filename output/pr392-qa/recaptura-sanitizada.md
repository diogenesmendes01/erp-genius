# PR #392 — recaptura com telefones fictícios

Fonte do harness: 52a8b315, incluindo fixture83043f51 e anonimização3f381489.
CLI59879 terminou com saída0: 34 PNGs (18 app / 16 protótipo), 0 falhas e
14 diagnósticos de GET de mensagens abortado e recuperado. O manifesto declara
a transformação do DOM do protótipo antes da foto, sem alterar o HTML original
ou os pixels prontos. A fixture local validou linha+5500000000300 e sete
contatos+5500000000301..0307 em BAILEYS/DESCONECTADO.

Inspeção por amostragem de oito imagens: conversa app desktop escura/celular
clara, quatro drawers app celular/tablet nos dois temas, conversa protótipo
desktop escura e painel protótipo celular claro. Telefones fictícios visíveis,
painéis inteiros e conteúdo esperado; não é nova homologação de todos os fluxos
ou paridade pixel a pixel. A tela desta fonte precede a nova casca #308.

Somente o banco descartável reservado ci-integracao e preview local3112.
Primeira tentativa falhou no CSRF por AUTH_SECRET ausente; o preview foi
reiniciado com segredo efêmero local, sem gravá-lo em arquivo/exportá-lo. A
captura completa seguinte passou. Preview76942 parado depois e AGENTS.md
restaurado apenas do bloco gerado pelo Next. Não houve transporte WhatsApp,
envio de mensagem ou integração externa. A fonte de reserva no protótipo
offline e os contadores mutáveis ao abrir conversas continuam sendo limites.

O ZIP de aceite contém somente os 34 arquivos listados no manifesto, o próprio
manifesto e este relatório. O ZIP histórico separado permanece somente local
e preserva os124 arquivos
versionados de output/inbox-307-* (104 PNGs) sem modificar os originais;
contém imagens anteriores à anonimização e tentativas históricas, não foi
enviado ao GitHub e não serve
como aceite sanitizado atual. Referências imutáveis da #297 não são alteradas.

## Preservação da limpeza404 no head307

Sobre06248af0, retirados64PNG298 herdados da base antiga. Todos os64
coincidem por tamanho/SHA256/GitOID com o manifesto404/ZIP381 autorizado,
3.595.413bytes. Backup local dedicado conferido antes de retirar do índice;
sem variantes adicionais ou novo upload. src/scripts/prisma/package/lock
permanecem byteidênticos06248. A proposta B2 continua somente preservada,
sem aplicar stash, instalar dependências ou mudar lock. Revisão técnica do
porte e a decisão humana B2 seguem pendentes; não atribuir novo global
ou aceite visual a essa alteração exclusivamente documental/de artefatos.
