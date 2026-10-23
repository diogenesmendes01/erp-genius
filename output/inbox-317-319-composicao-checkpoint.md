# Composição preliminar #317 + #319

Pais: publicação #317 c2b7d920 (produto a86c9ade) e documentação #319
3dc215ef (produto472e17fd), base comum29479848. Integração na branch própria
codex/inbox-e1-319-integracao, sem alterar os heads de PRs publicados.

Conflitos reais em ConversaAberta e quadro: preservados coordenador único/key e
mapa de tentativas #317, com loading/erro/retry/handoff/busy internos #319.
VirtualList permanece no mesmo ramo; rodapé não foi substituído pela versão
antiga. Mapas de guardas e testes conciliados automaticamente e conferidos.

Primeiro recorte ROOT terminou exit1 (sessão47789):12 arquivos,311 aprovados e
uma falha. O novo caso #319 ainda procurava CabecalhoControlado, removido pela
montagem única #317; o helper já atravessava render-prop corretamente. Ajustado
somente seletor para CabecalhoConversa real, com expect de existência explícito;
asserções de identidade virtual, pin e termo permanecem iguais. Log negativo
privado preservado em output/inbox-317-319-composicao-unit.log.

Mesmo recorte após ajuste: execução013e72, exit0,12 arquivos/312 testes,8,81s,
sem filtro de nome/skip,maxWorkers2, Node22 local. TSC25316 inicial e TSC63460
após ajuste do teste terminaram exit0 com heap8192. Lint inicial8fontes669b3f e final9fontes748069 terminaram exit0,
sem avisos; final inclui o teste ajustado. Diff-check antes do commit exigido.

Não é regressão global nem aceite final. C2/#402 ainda será incorporado, CLI e
capturas formais #317/#319 pendentes, QA independente da composição/browser e
global ROOT também. QA estática original #317:13/239 e #319:11/306, ambas
favoráveis condicionais, atribuídas ao TESTER nas respectivas fontes originais.
Nenhum banco, browser, envio externo ou migration foi executado neste gate.
