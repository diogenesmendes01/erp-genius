# Handoff DEV B — #307

Branch `codex/inbox-e1-307`, base `8a320f97e4a2f4b09175a633c6a5668780e6a4f9`.

Fonte: `scripts/visual/demo-inbox.ts`, `nucleo-captura.mjs`/`.d.mts`, `capturar-inbox.mjs`, README; testes `src/test/visual-inbox.test.ts` e `visual-inbox.int.test.ts`; SPEC e quadro. Package/lock e referência PR297 foram preparados pelo integrador antes desta implementação e não são alterados pelo DEV.

## Evidência já obtida

- RED do núcleo ausente: Vitest 1 arquivo/0 testes, exit1 esperado; depois 4/4 exit0.
- RED de fonte Lucide com query: 1/4 falhou; depois 4/4 exit0.
- RED de reparo parcial real no banco dev-gravacoes: 1/1 falhou em `Demo parcial`; após upserts, integração 1 arquivo/1 teste exit0, nenhum ignorado. Confirmados sete atendimentos, nota, envio falho, origem de transferência, três tags, repetição sem duplicar, restauração de Fernanda e outro número intacto.
- RED da CLI inexistente 1/5 falhou; unitários+dependências depois 2 arquivos/9 testes exit0, nenhum ignorado, Node22.23.2.
- CLI protótipo-only: seis PNGs `conversa` em três viewports e dois temas, Chrome155 e `playwright-core`1.56.1, exit0, manifesto sem falhas. Capturas desktop escuro e celular claro inspecionadas.

## Pendências para congelamento

Executar fixture no perfil coordenado do integrador e servidor Next local apontando para o mesmo banco; capturar doze PNGs app × protótipo, verificar manifesto e imagens. Rodar recortes pós-últimas edições, TSC heap8192, Vitest completo `--maxWorkers=2`, ESLint global e revisão TESTER. A fonte mono da #306 é coordenada na base integrada; não depende de acesso a Google Fonts. Nenhum envio externo.
