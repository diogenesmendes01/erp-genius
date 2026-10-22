# #303 — Anexos sem formulário desabilitados com motivo

Estado em 22/10/2026: implementação, testes dirigidos e gates globais aprovados em Node22.23.2; **aguarda TESTER e captura visual**. Branch `codex/inbox-e0-303` sobre #302 congelada `133b935ed71e20af4f9f517762131dc4ce98d8fd`, worktree exclusivo DEV A, perfil `dev-email`.

## SPEC

Contato, Enquete e Localização continuam visíveis no menu Anexar, mas sempre desabilitados até os formulários da E4. Se a capacidade específica está ausente da thread, o motivo continua `AVISO_RECURSO_MOTOR`. Se está presente, o motivo é a nova exportação `AVISO_ANEXO_EM_BREVE = "O envio deste tipo pelo Inbox ainda não está disponível."`. A decisão é individual por recurso, inclusive com capacidades parciais. E4 removerá o aviso ao ligar os formulários.

Todo item habilitado de Anexar precisa ter `onClick`. Documento, Fotos e vídeos e Áudio continuam habilitados com seus handlers de seletor; upload, legenda, gravação, permissões e envio não foram alterados. Modo Nota continua sem menu Anexar e conserva seu fluxo interno. Nenhuma alteração de servidor, driver/capacidades, contrato de envio, schema, permissão ou package/lockfile. Não iniciado trabalho da #305.

## Diagnóstico, TDD e verificação dirigida

A versão anterior usava `disabled={!livre}` nos três itens, sem qualquer handler, de modo que capacidades do MOTOR conectado liberavam cliques sem resultado. O teste anterior exigia essa habilitação; foi substituído pelo comportamento correto. A implementação muda somente a constante exportada, `disabled` incondicional e o motivo exibido em cada item.

- RED antes da alteração de produção, `node_modules/.bin/vitest.cmd run src/components/conversa/Compositor.test.ts`: **exit 1**, 3 falhas por assertion/19 aprovados, sem ignorados (`c01f10`): ausência do novo aviso, Enquete habilitada com capacidade parcial e itens sem ação no conjunto habilitado. Esse RED usou o Node24.16.0 que estava no PATH naquele momento.
- A trava geral foi refinada para não congelar uma lista fechada de futuros itens: exige pelo menos um habilitado e handler para cada um. RED específico `... run src/components/conversa/Compositor.test.ts -t 'nenhum item habilitado'`: **exit 1**, uma falha por `Contato: onClick undefined`, 21 testes fora do filtro (`065f2a`), ainda Node24.16.0. Não houve implementação antes desse RED.
- Após o integrador localizar o Node22 existente, todas as verificações GREEN abaixo usaram exclusivamente `C:/Users/Mendes/AppData/Local/hermes/node/node.exe`, versão **v22.23.2** observada no terminal `722460`, compatível com `.nvmrc`22. Nenhuma dependência foi instalada, copiada ou regenerada.
- GREEN obrigatório: `node.exe node_modules/vitest/vitest.mjs run src/components/conversa/Compositor.test.ts src/app/botoes.test.ts`: **exit 0**, **2 arquivos/86 testes**, sem filtro de nome/ignorados (`722460`). A contagem das exceções de botões permaneceu igual.
- Recorte ampliado: `node.exe node_modules/vitest/vitest.mjs run src/components/conversa/Compositor.test.ts src/components/conversa/recursos-canal.test.ts 'src/app/(app)/inbox/sem-polling.test.ts' src/app/botoes.test.ts src/app/design-system.test.ts src/app/paleta.test.ts src/app/fundo-sobre-pagina.test.ts src/app/contraste-elementos.test.ts`: **exit 0**, **8 arquivos/131 testes**, sem filtro de nome ou ignorados (`7f43ac`). Não é suíte global nem integração.
- `git diff --check`: **exit 0**, `51a7e0`; apenas avisos Git LF/CRLF, sem erro de whitespace.
- Lint dirigido: `node.exe node_modules/eslint/bin/eslint.js src/components/conversa/Compositor.tsx src/components/conversa/Compositor.test.ts`: **exit 0**, sem erros/avisos (`b18776`).

Compositor tem agora22 testes; inclui capacidades vazias, completas e parciais, motivo junto a cada item, presença de handler em todos os habilitados e ausência de Anexar no modo Nota mesmo com capacidades. Testes existentes de upload com legenda, limite de10MB, gravação, rascunho, envio e Nota permaneceram verdes. O harness existente combina SSR real com simulação local dos hooks para interação; isso não substitui navegador ou transporte. Todo upload/envio nos testes é simulado, sem serviço externo. Todos os comandos terminaram com código final, sem sessão pendente/processo desacoplado. Aviso preexistente de `vite-tsconfig-paths` não tratado nesta issue.

## Pendências

A janela global reservada pelo integrador foi utilizada conforme os resultados abaixo. Re-review TESTER do SHA exato. Captura posterior coordenada do menu com número MOTOR em fixture descartável, três viewports/dois temas conforme contrato visual, sem envio externo; registrar capacidades recebidas e os três motivos novos. Não há servidor/DB iniciado pelo DEV A. Sem push/PR/merge/deploy; integrador publica por issue. #303 não concluída antes desses gates.

## Gates globais próprios no código `fe051d41d937c3f7a85b09479c034cb7f87b18a2`

Todos executados por `C:/Users/Mendes/AppData/Local/hermes/node/node.exe` (**v22.23.2**), sem instalação/regeneração de dependências e sem filtros adicionais:

- `NODE_OPTIONS=--max-old-space-size=8192 node.exe node_modules/typescript/bin/tsc --noEmit`: **exit 0**, sessão `77141`, conclusão `5a9fe1`.
- `node.exe node_modules/vitest/vitest.mjs run --reporter=json --outputFile=output/inbox-303-unitarias.json`: **exit 0**, sessão `11868`, conclusão `f1e2f3`. JSON conferido em `542732`: **841 arquivos, 6.488 testes aprovados, zero falhas, pendentes ou todo**, sem filtro de nome. É a suíte unitária completa configurada; integração `*.int.test.ts` permanece excluída pela configuração normal. JSON apenas local, fora do commit.
- `node.exe node_modules/eslint/bin/eslint.js . --max-warnings 40`: **exit 0**, sessão `61660`, conclusão `53d5b7`, **zero erros e 40 avisos preexistentes**, sem exclusões adicionais. Nenhum aviso acrescentado pela #303.
- `git diff 133b935ed71e20af4f9f517762131dc4ce98d8fd HEAD --check`: **exit 0**, `542732`.

Cada sessão foi acompanhada até o exit code final, sem processos ativos. A consolidação posterior altera somente relatório/quadro, sem modificar fonte/testes nem repetir gates. TESTER e captura do menu MOTOR seguem pendentes; não declarar a issue concluída antes dessas evidências.
