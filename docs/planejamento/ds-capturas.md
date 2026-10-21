# Fase 0, DS-C: conferência visual (Task 11)

Data: 15/10/2026. Branch `claude/fase0-ds-c-conferencia` = DS-A (`claude/fase0-ds-a-fundacao`) + os seis DS-B
(`botao`, `campos`, `camadas`, `navegacao`, `avisos`, `primitivos`), mergeados sem squash.

## Como as capturas foram feitas

- Banco `erp_genius_test_tester` (perfil `tester`), já migrado. `prisma/seed.ts` (usuários, catálogo, WhatsApp
  desligado) e um script local (não versionado) com 6 alunos da Costa Rica, uma turma "Salvador" (Regular A1,
  Seg/Qua 19:00–21:00), 6 matrículas (5 ativas e 1 rascunho) e 18 mensalidades pendentes ou atrasadas.
- `npm run build` e `next start -p 3100` com `AUTH_SECRET`, `NEXTAUTH_URL` e `AUTH_TRUST_HOST` de teste.
  Login `admin@genius.com`.
- Playwright 1.64 com o Chromium de `/opt/pw-browsers/chromium-1194`. Tema escuro por `localStorage.tema = "dark"`
  (o script do `layout.tsx` aplica `.dark` no `<html>`) e `colorScheme: dark`. Larguras 1440 × 900 e 390 × 844.
- 70 PNGs em `tmp/capturas/` (não versionado), nomeados `<tela>-<claro|escuro>-<1440|390>.png`.
- Telas: login, login com erro (formulário enviado vazio), home, alunos (lista e ficha), matrícula nova, financeiro
  (painel e fila de cobrança), secretaria, acadêmico, diário, configuração (turmas e WhatsApp), inbox. Camadas:
  modal compartilhado (`Cadastrar por lote` em Alunos), diálogo de nova turma, drawer de detalhe da cobrança e
  menu do celular (gaveta da `BarraMobile`).
- O script também mede `document.documentElement.scrollWidth` para detectar estouro horizontal no celular.

## Achados por tela

Legenda: **C** = corrigido neste PR (com o commit); **P** = pendente, fora do recorte do design system.

### Todas as telas (shell)
1. **C**: sombra do drawer fechado vazava na borda da tela. A gaveta do celular (e a do detalhe, à direita) fica
   montada fora da tela com `shadow-dialog`, e os 60 px de sombra apareciam como um degradê cinza na borda
   esquerda (e direita na ficha), inclusive no desktop. `src/components/Drawer.tsx`: `shadow-dialog` só com
   `open` (`translate-x-0 shadow-dialog`). Teste "drawer fechado não projeta sombra".
2. **C**: botão de fechar do drawer `rounded-md hover:bg-gray-100` → `rounded-full hover:bg-highlight
   max-sm:min-h-11 max-sm:min-w-11` (botão é pílula; 44 px no celular).

### Login e formulário com erro
3. **C**: anel de foco duplo. Os campos tinham `focus:ring-1 focus:ring-brand-500`, que somava um anel interno
   ao contorno global de `globals.css` (foco tem regra única). Removido dos 14 lugares (login, matrícula nova,
   leads, ficha do aluno, catálogo, países, usuários, turmas). Trava nova em `src/app/paleta.test.ts`: nenhum
   `focus:ring*` em `src/app`, `src/components` e `src/lib`.
   - Mensagens de erro legíveis nos dois temas (`text-red-600` = `--danger-text`); sem outro achado.

### Home
- Sem achado além do item 1. Cartões `bg-surface`, chips da equipe em pílula, seleção suave na navegação.

### Alunos, lista
4. **C**: página estourava para 471 px no celular. O `sr-only` da `ColunaOrdenavel` (absoluto) não tinha ancestral
   posicionado dentro do `overflow-x-auto` da tabela e alargava a página. `src/components/ColunaOrdenavel.tsx`:
   link `inline-flex …` → `relative inline-flex …` (vale para as 5 listas que usam a coluna). Teste novo.
5. **C**: no celular, "Cadastrar por lote" e "Cadastrar aluno" se espremiam em pílulas de duas linhas.
   `AlunosLista.tsx`: cabeçalho `flex items-center justify-between` → `flex flex-wrap …`, grupo de botões com
   `flex-wrap`. Teste novo.
6. **P**: "Exportar planilha" fica sozinho numa linha acima do título (layout da página, não token).

### Alunos, ficha
- Sem achado de DS além do item 1. **P**: os links "Acesso ao portal de reposições" e "Conferir agenda para
  aditivo" aparecem recuados em relação ao primeiro link (layout).

### Matrícula nova
- Campos com fundo `surface-muted`, raio 8 px e 44 px no celular; rótulos 500. Só o item 3 (anel duplo).

### Financeiro (painel e fila de cobrança)
7. **C**: abas do financeiro `rounded-md … hover:bg-gray-100` (diferentes da `SubTabs`) →
   `rounded-full … hover:bg-highlight max-sm:min-h-11`. `BarraAbasFinanceiro.tsx`, teste novo.
8. **C**: no celular, a segunda linha de cada item da fila truncava turma · país em "Re…" porque chip e ação
   ocupavam a linha. `FilaCobranca.tsx`: `mt-1 flex items-center justify-between gap-3` →
   `mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1`, ações com `ms-auto`.
9. **C**: chips de estado da fila (`respondeu`, `envio falhou`, rótulo da ação) `rounded-md` → `rounded-full`.
10. **C**: detalhe da cobrança (drawer próprio) sem camada: `bg-black/30` → `bg-black/60`; painel `bg-surface` →
    `border-s border-gray-200 bg-surface-raised shadow-dialog`.
11. **C**: o valor do detalhe ("₡ 25.000") partia o símbolo e o número em duas linhas → `shrink-0
    whitespace-nowrap`. Testes novos para 8 a 11.
12. **P**: o ✕ do detalhe da cobrança é um `<button>` cru com `disabled:opacity-50`; caberia `IconX` em pílula,
    como no `Drawer`. O componente não usa o `Drawer` compartilhado por causa do bloqueio de fechamento durante o
    envio manual.

### Secretaria
13. **C**: os sete links de ação de cada matrícula vinham colados ("…comercialConferir pagador…").
    `SecretariaPainel.tsx`: agrupados em `<nav aria-label="Ações da matrícula …" class="flex flex-wrap gap-x-4
    gap-y-1">`.
14. **C**: cartão da matrícula `rounded-lg border p-4` (borda sem cor de token, sem fundo) →
    `rounded-lg border border-gray-200 bg-surface p-4`. Teste novo.

### Acadêmico e diário
- Sub-abas em pílula, 44 px no celular, seleção sólida legível nos dois temas. Sem achado.

### Configuração, turmas (inclui o diálogo aberto)
15. **C**: diálogo de nova turma sem camada (sem sombra, véu `bg-black/40`, cartão `bg-surface` que no escuro
    some no fundo). `TurmasPainel.tsx`: véu `bg-black/60`, casco `rounded-dialog shadow-dialog`;
    `TurmaFormulario.tsx`: cartão `rounded-lg … bg-surface` → `rounded-dialog … bg-surface-raised`.
16. **C**: dias da semana (chips com `aria-pressed`) `rounded-md … border-gray-300 hover:bg-gray-50` →
    `rounded-full … max-sm:min-h-11 border-border-soft hover:bg-highlight`. A trava de contraste
    (`contraste-elementos.test.ts`) foi atualizada para a classe nova.
17. **C**: "Importar turmas" e "Nova turma" viravam pílulas de duas linhas ao lado do texto longo. Cabeçalho com
    `flex-wrap`, texto `min-w-0 flex-1 basis-80` e grupo de botões `shrink-0 flex-wrap`.
18. **C**: status "Em andamento" partia em duas linhas na tabela → `whitespace-nowrap`.

### Configuração, WhatsApp
- Sub-abas em dois níveis em pílula, botão "Novo número" primário. Sem achado.

### Inbox
19. **C**: no celular, o select "Finalidade e destinatário" estourava a tela (413 px). `AtendimentosPainel.tsx`:
    rótulos `grid gap-1` → `grid min-w-0 max-w-full gap-1`; selects `rounded border p-2` (raio 4 px, borda sem
    token) → `w-full max-w-sm rounded-md border border-gray-300 px-3 py-2` e `w-full rounded-md border
    border-gray-300 px-3 py-2`. Teste novo.

### Modal compartilhado (Cadastrar por lote), menu do celular
- Modal: `bg-surface-raised`, `shadow-dialog`, raio 14 px, véu 60%, cabe em 390 px, ações que quebram linha.
  Sem achado.
- Gaveta do celular: itens de 44 px, seleção suave, `shadow-dialog` ao abrir. Sem achado além dos itens 1 e 2.
- **P**: o `Menu` (primitivo da Task 10) ainda não é usado por nenhuma tela; não há menu de ações para capturar
  no desktop. A conferência dele fica para a primeira tela que o adotar (Fases 2 e 3).

## Resumo

- 19 achados corrigidos neste PR (11 commits `fix(ds)` e 1 `test(ds)`), com teste novo ou trava ajustada em cada
  componente tocado.
- 4 pendências anotadas (itens 6, 12, a ficha do aluno e o `Menu` sem uso), todas fora de token e raio, sem
  bloquear a Fase 0.
- Depois das correções, as 70 capturas foram refeitas: nenhuma tela estoura 390 px e a borda da tela fica com a
  cor da página (sem o degradê da sombra). A correção do item 11 entrou depois da última recaptura e está coberta
  pelo teste.
