# QA independente — Triagem administrativa #319

**Fonte exata:** `176903280c3007c3b839735a16090f408419b016`. Parecer favorável ao estado sem seleção com uma pendência real de Triagem nos seis contextos. A prova usa o aplicativo ERP, documento `GET /inbox` real e banco TESTER descartável preparado pelo integrador; não fabrica resposta de API, HTML, RSC ou estado de domínio. O servidor `page.tsx` chama `listarTriagemWhatsApp`; não existe GET público dedicado de Triagem a alegar.

## Resultado próprio

- Node 22, probe privado `output/qa-319-triagem-tester.mjs`: sessão `726635`, **exit 0**, 1440×900, 1024×768 e 320×500, claro e escuro. Em cada contexto, documento 200, hidratação `data-conectado=1`, vista lista, nenhuma seleção `?c`, lista visível e painel de contato ausente.
- Nos quatro contextos de 1440/1024, o resumo real `Triagem administrativa · 1 mensagens sem finalidade` está visível **acima** do placeholder `Escolha uma conversa`, comprovado por caixas geométricas e pelas PNGs. Nos dois contextos 320, lista visível e região central oculta; a Triagem permanece montada nessa região, sem exigir que apareça no celular sem seleção.
- Seis contextos: documento/corpo exatamente na altura do viewport, `scrollY=0`, tema correspondente, `submit=0`, POST observado=0, uma SSE iniciada/ativa no máximo por página, `pageerror=0`, aviso React=0 e origem externa=0. Manifesto conferido em sessão `67c88e`, **exit 0**.
- Seis PNGs anonimizadas foram **inspecionadas visualmente**, claro/escuro em cada tamanho. Os seis hashes e tamanhos conferem com a allowlist exclusiva `output/inbox-319-triagem-tester/allowlist-positiva.json`: **6 arquivos, 499.895 bytes**, SHA-256 do arquivo de allowlist `4f1ea2031d2c11e63a2883490670cd31cf357480d4f40e3472cab8ba83c6e5fb` (sessão `be9bde`, saída 0). A allowlist contém apenas as seis PNGs finais e a fonte explícita; script, manifesto bruto e negativos ficam fora do pacote.

## Ambiente e limites

O integrador preparou exclusivamente o TESTER com 424 hashes/1.386 linhas originais mais 150 mensagens fictícias, uma nota e **uma** mensagem sem finalidade. Preview 3109/sessão 33800 estava na fonte acima e com provedores externos vazios. Após fechar todos os browsers, o integrador parou o preview (`4e70f5`, Ctrl+C/exit 1 esperado) e restaurou o snapshot original: `322fb1`, **terminal exit 0**, 424 hashes/1.386 linhas. Não fiz seed, SQL, envio, classificação ou submit.

O primeiro comando (`132771`, exit 1) parou **antes do browser** apenas porque `next dev` gerou seu bloco automático em `AGENTS.md`; o diff mostrou exclusivamente essas dez linhas. O probe privado passou a aceitar só esse bloco exato, sem restaurá-lo durante o preview; `--check` de sintaxe e fonte saíram 0 (`357db0`, `8e5929`). Depois de o servidor parar, removi o bloco com `git restore --worktree -- AGENTS.md`; diff rastreado vazio, CRLF original presente e HEAD confirmado (sessões `c28b42`, `be9bde`, saídas 0). Esse RED não é defeito do aplicativo e não consta da allowlist positiva.

Esta prova cobre somente Triagem sem seleção/responsividade no SHA atual. Não homologa classificação, permissão de outros papéis, operação de envio ou corrida de estados #319. Também não substitui a captura formal do DEV B, a inspeção de suas imagens longas ou o pacote final. As 32 PNGs históricas do TESTER em `5e9` permanecem evidência separada.
