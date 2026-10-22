# Handoff DEV B — #307

Branch `codex/inbox-e1-307`, base `8a320f97e4a2f4b09175a633c6a5668780e6a4f9`.

Fonte: `scripts/visual/demo-inbox.ts`, `nucleo-captura.mjs`/`.d.mts`, `capturar-inbox.mjs`, README; testes `src/test/visual-inbox.test.ts` e `visual-inbox.int.test.ts`; SPEC e quadro. Package/lock e referência PR297 foram preparados pelo integrador antes desta implementação e não são alterados pelo DEV.

## Evidência já obtida

- RED do núcleo ausente: Vitest 1 arquivo/0 testes, exit1 esperado; depois 4/4 exit0.
- RED de fonte Lucide com query: 1/4 falhou; depois 4/4 exit0.
- RED de reparo parcial real no banco dev-gravacoes: 1/1 falhou em `Demo parcial`; após upserts, integração 1 arquivo/1 teste exit0, nenhum ignorado. Confirmados sete atendimentos, nota, envio falho, origem de transferência, três tags, repetição sem duplicar, restauração de Fernanda e outro número intacto.
- RED da CLI inexistente 1/5 falhou; unitários+dependências depois 2 arquivos/9 testes exit0, nenhum ignorado, Node22.23.2.
- CLI protótipo-only: seis PNGs `conversa` em três viewports e dois temas, Chrome155 e `playwright-core`1.56.1, exit0, manifesto sem falhas. Capturas desktop escuro e celular claro inspecionadas.
- Review P1: a região da conversa podia aparecer antes de mensagens/painel; login por clique em `domcontentloaded` podia ocorrer antes da hidratação. RED determinístico do módulo de espera ausente, Vitest 1 arquivo/0 testes exit1. A CLI agora autentica via CSRF+credentials e confirma `/api/auth/session`; aguarda mensagem da fixture, nota de Beatriz e painel quando pertinente, sem delay fixo. O Drawer só recebe clique depois da mensagem renderizar. Teste com Promises diferidas prova que a espera não conclui antes de mensagem/painel/nota.
- Pós-P1: unitários+dependências 2 arquivos/12 testes exit0, nenhum ignorado; TSC Node22.23.2 com heap8192 exit0; ESLint dirigido `scripts/visual src/test/visual-inbox.test.ts --max-warnings 0` exit0. ESLint global `eslint . --max-warnings 40` na sessão 12375, exit0, 0 erros/40 avisos.
- Re-review do Drawer: RED determinístico em `celular-painel` com região Conversa oculta (1/9 falhou, exit1). A espera após o clique exige só `Painel Comercial`; a mensagem já é exigida antes do clique. Casos celular/tablet GREEN; unitários+dependências 2 arquivos/14 testes exit0, sem ignorados; TSC heap8192 exit0 e ESLint dirigido exit0. Não repetimos global após esse ajuste dirigido; integrador fará o global na fonte #306+#307 combinada.

## Pendências para congelamento

Integrador já executou a fixture duas vezes em cada perfil root/tester (saída0); aguardar servidor Next apontando para o mesmo banco, capturar doze PNGs app × protótipo, verificar manifesto e imagens. Vitest completo `--maxWorkers=2`, ESLint global na combinação #306+#307 e revisão TESTER permanecem pendentes. A fonte mono da #306 é coordenada na base integrada; não depende de acesso a Google Fonts. Nenhum envio externo.
