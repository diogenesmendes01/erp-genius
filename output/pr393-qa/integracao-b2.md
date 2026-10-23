# PR #393 — preservar a base final #392/B2

Composição local do head anterior `a1a791962daf3d4dd5faf7b44e31213e324afe1f` com a base publicada #392 `67e6cc60f5e26dce91af5284cb6c0b2ced41282a`. A #392 ainda aguarda CI e merge; esta composição não antecipa sua integração funcional.

## Contratos preservados

O delta de `src/` contra a base contém somente os nove arquivos próprios da #309: BadgeEstado e teste; estado-visual, seus testes puro/servidor; prazo-atendimento; prazo-vivo; Avatar e teste. Todos são byte a byte iguais ao head anterior a1. Os demais arquivos de src e todos os scripts são exatamente os da base67e, preservando as contagens #310, a leitura/SSE E0, o harness sanitizado e a correção B2. Manifesto, lockfile e ESLint são os da base67e. Layout e tokens globais já eram idênticos entre as duas fontes.

Os conflitos herdados em dois pareceres da fonte306 mantêm os arquivos da base publicada. Os quatro conflitos do quadro foram resolvidos com parser de estados, contagem explícita de quatro blocos e preservação literal dos dois lados (`dc6821`, saída 0). Nenhuma seção distinta foi truncada.

## Verificação inicial

Recorte `dc6821`, saída 0: seis arquivos / 73 testes, incluindo BadgeEstado, estado-visual puro/servidor, prazo-vivo, Avatar e dependências. maxWorkers=2, sem filtro de nomes ou skips acrescentados, sem banco ou browser. As provas visuais anteriores permanecem nominais às fontes históricas do relatório original.

Global, TypeScript, lint e revisão independente desta composição ainda serão registrados. O parecer independente da correção B2 na fontec7 é preservado como evidência do predecessor em `output/pr392-qa/tester-b2-c7.md`; ele não substitui a QA desta composição. CI final contra main e merge continuam dependendo da #392. Nenhum código exclusivo da #309 foi reimplementado e nenhuma dependência física de outro worktree foi alterada.
