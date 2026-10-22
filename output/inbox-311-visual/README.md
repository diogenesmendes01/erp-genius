# Evidência DEV #311

Fonte: delta #311 sobre103a507d8a8fda7a6758a4eee46177d4c3ce7a67, congelado no commit que contém este arquivo. Captura local final sessão95056, exit0, preview3111/dev-gravacoes preparado pelo integrador, somente fixture fictícia.

24PNG app: antes2; lida1; entrada-sem-selecao2; entrada-chat-aberto1. Cada fase tem desktop1440×900, tablet1024×768, celular390×844, claro/escuro. Celular mostra gaveta Menu para conferir a pílula; o ponto do botão permanece coberto pelo menu nesse estado. Pranchas inspecao-* são derivações dos PNGs originais, sem alterar pixels dos originais.

Inspeção visual DEV: as oito imagens de cada viewport apresentam selo legível 2/1/2/1 nos temas escuro/claro. Menu mobile totalmente aberto, sem branco/transição; tablet/desktop Sidebar224 preservada. Não há texto fantasma de transição na rodada final. Fotos de chat aberto contêm as duas entradas fictícias reais. A nova mensagem é lida automaticamente conforme #299.

manifesto.json é saída original do harness, zero falhas/diagnósticos. Monitor em cada aba: SSEativa1/máxima1, GETmáximo1; duas fontes criadas sequencialmente pelo StrictMode. A segunda aba Home também chegou2 após entrada sem reload. Leituras do chat aberto limitadas pelo harness a no máximo duas ações após nova entrada.

Ruling: entre lida e entrada-sem-selecao navega Home por Link, desmontando a seleção. Permanecer com chat selecionado implica auto-leitura e impede subida estável; não houve alteração da regra produtiva.

Referências do protótipo: CLI existente --alvo prototipo --estado conversa, sessão18038 exit0, seisPNG e prototipo-manifesto.json; recursos offline locais. A chamada anterior sem PW_CHROMIUM saiu1 antes de abrir navegador. Comparação de tokens verde do selo; protótipo possui outra casca/navegação, fora do escopo311.

Negativos anteriores: output/inbox-311-visual-tentativa1 preserva12PNG/README, falha de asserção de segunda aba antes da hidratação, sem manifesto gerado. Tentativa2 preserva README, nenhum PNG novo/manifesto: preparo pessoal inadequado com sharedThiago0. Não se apresentam imagens novas como antigas.
