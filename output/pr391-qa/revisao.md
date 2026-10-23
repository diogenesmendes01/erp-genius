# PR #391 — C1/C2: peso nativo e carregamento sob uso

O WOFF original conserva SHA25618be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e.
Fontkit confirmou eixo wght100–800, com600 nativo e cobertura dos códigos,
hashes e templates Latin. A declaração passa400–600, atendendo dt herdado e
contadores600 sem síntese. preload:false retira antecipação da mono nas
rotas sem consumidores; Roboto e seu preload permanecem.

TDD correto RED1falha/7passes; GREEN5arquivos/54testes, sem filtro/ignorados.
O primeiro ensaio do novo teste também usava cmap de uma instância variável
de Fontkit que não o expõe corretamente; foi corrigido para verificar cobertura
no asset original (independente do peso). Não era falha do aplicativo.
TypeScript75865 e lint dos dois arquivos alterados saída0.

Chrome real, seis contextos1440/1024/390 ×dois temas: oito trechos JSX reais
extraídos e renderizados com dados fictícios por contexto; fontes400/500/600
carregadas1/1/1, síntese desativada, família mono correta, dt600, sem overflow
externo e sans preservada. Zero erros de página/recurso externo. Duas imagens
inspecionadas: celular claro e desktop escuro. São amostras isoladas dos oito
usos globais, não navegação pelos fluxos completos dessas telas. Inputs de hash
mantêm a rolagem própria esperada; os hashes de texto quebram na largura útil.

Probe adicional de /login confirmou face400600 e ausência de preload mono no
DOM/header; um preload da Roboto foi preservado. Métricas positivas compactas
em aceite.json e preload.json. PNGs e probe privados locais, sem novos binários
no Git. Preview33433 encerrado; bloco gerado do AGENTS removido e backup original
comparado/restaurado byte a byte. Integração dos pais/gates globais/CI e revisão
independente final ainda pendentes.

Gates finais do estado integrado3410df0b: full17966 saída0,845arquivos/6570testes,
sem filtro/ignorados (maxWorkers=2); TSC47138 saída0; lintglobal64541 saída0,
0erros/40avisos herdados. Fontes da correção idênticas a7d29. Integração do
refR6 com classes de altura389 conciliada explicitamente. Dependências E0 e
CI/revisão final ainda pendentes; sem nova suíte DB ou recaptura completa.
