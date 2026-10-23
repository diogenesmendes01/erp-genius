# PR #389 — revisão C1–C4

C1: teste da página exige as três contas de altura e um segundo teste confere
o padding do main, padding/borda da BarraMobile e as duas alturas de botão.
C2: teste SSR de InboxNovo+ConversaAberta exige o header direto, com todas as
classes do seletor de teto; detecta um wrapper que deixaria o seletor sem alvo.
Nenhuma mudança no header que a frente315 altera. Ao compor308, a guarda de
altura deve acompanhar as novas margens/classes dessa casca.

Prova negativa: removidas temporariamente as alturas e inserido wrapper no
header, 2falhas/25passes. Produções restauradas e comparadas com HEAD sem
qualquer delta; recorte3arquivos/53testes passou, sem filtro/ignorados.

C3: aplicativo real desta fonte389 em localhost3112, Chrome, conta fictícia,
banco ci-integracao exclusivo, transportes vazios e BAILEYS desconectado.
390/700/1024/1440×500, claro/escuro, lista/conversa:8contextos/16estados.
Documento500px em16/16 e controles do formulário/filtros/header geometricamente
alcançáveis por scrollIntoView em16/16. A prova de capacidade de rolagem usa
um bloco temporário aria-hidden de2000px e restaura posição, como o harness
original; não equivale a carga real de centenas de mensagens. Não houve
clique de abrir atendimento/envio. Duas imagens inspecionadas:390claro e
1440escuro, ambas com o overlay de Issues do Next dev visível.

Zero pageerror no navegador, mas o servidor registrou destino de stream
encerrado cedo durante navegação/fechamento de contextos. Não se atribui causa
a389 nem se alega zero diagnósticos de servidor. Capturas novas permanecem
locais; baixo.json contém as métricas positivas. Essa medição é da fonte
intermediária389, não homologação automática dos layouts308/315 posteriores.
A rolagem aninhada permanece, com alcance observado; não houve redesenho de
fluxo. Preview39117 encerrado; AGENTS original restaurado byte a byte.

C4:107PNG históricos conferidos individualmente por tamanho/hash antes de sair
do index. História ae4d71b1 e backup local preservados, sem force ou novo upload
legado. ZIPLOCAL7.741.141bytes/117arquivos, SHA256
c0497482162947d74f57d30b4a5857309ab07f2119c568f8d62a09eb2f2c2035.
README/manifesto na pasta original, sem substituir o aceite histórico por esse
novo recorte de geometria.

TSC70812 e lintglobal47298 encerraram com saída0 (0erros/40avisos herdados).
Suíte global80173 finalizou com saída0:845arquivos/6570testes completos, sem filtro/skip (maxWorkers2). Parecer independente e CI do head final
permanecem pendentes. Nenhum schema/permissão, pacote/lock ou transporte real.
