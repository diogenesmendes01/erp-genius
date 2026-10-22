# Relatório DEV B — #299

Estado em 22/10/2026: implementação preparada para re-review, com gates finais pendentes. Branch `codex/inbox-e0-299`, base inicial `7e4810e5e6c4f25a00497fe743e0ea4abfb0c6ee`; revisão inicial no antigo commit `201f0a9daaeb23c5447a6f351729298fb3db60f2`. A branch agora está sobre o baseline Windows aprovado `3dbd3df803ef840bf2190cec9d4fc98d4a05a755` (PR #380); o SHA corrente é a ponta da branch.

## Alterações

- `preferencias.ts`: ação `marcarAtendimentoLido` executa leitura pessoal; se ela falhar por escopo, para. Caso contrário, chama a leitura compartilhada/WhatsApp existente.
- `acoes.ts`: `message.read` agora depende da capacidade `confirmacaoLeitura` do número (ativo, driver compatível, sessão `CONECTADO`). O contador local continua sendo zerado quando o motor está indisponível.
- `InboxNovo.tsx` e `marcar-lida.ts`: abertura inicial, troca de conversa e `mensagem.nova` da thread visível disparam leitura; contador da lista zera de imediato. Pedidos da mesma conversa em voo viram uma repetição final; conversas distintas são independentes. Sem polling.
- Correção pós-review P2: GET iniciado antes ou durante a leitura não repõe `naoLidas` da conversa aberta. O zero otimista termina quando a leitura falha: restaura-se a última contagem conhecida e faz-se uma consulta única. GET posterior a uma leitura bem-sucedida pode mostrar nova contagem.
- Correção pós-re-review R1: após falha de uma leitura nova, GET da versão anterior é descartado; somente GET iniciado já na fase de falha pode corrigir a contagem restaurada.
- SPEC em `docs/specs/inbox-leitura-automatica.md` e evidências no quadro único.

## Evidências executadas

- **P2 residual do re-review R1 (`91e554d0`):** RED determinístico: GET anterior à `mensagem.nova` devolveu 0 após falha da leitura e da reconciliação, quando a última contagem conhecida era 1. GREEN cobre também GET fresco válido que atualiza para 2. Unitário direcionado **4 arquivos / 36 testes**, saída 0, nenhum ignorado (17:26:54); integração direcionada **2 arquivos / 13 testes**, saída 0, nenhum ignorado no `dev-gravacoes`, `session_id 23506` até código final 0 (17:27:03–17:27:56); ESLint dos dois arquivos TypeScript tocados, saída 0. Novo re-review ainda pendente.

- **Pós-rebase sobre o baseline Windows:** rebase dos dois commits #299 sem conflito, preservando no quadro as entradas do baseline e da #299. Unitário direcionado **4 arquivos / 35 testes**, saída 0, nenhum ignorado (17:21:58); integração direcionada **2 arquivos / 13 testes**, saída 0, nenhum ignorado, perfil `dev-gravacoes`, `session_id 29621` acompanhado até código final 0 (17:22:05–17:22:58); ESLint direcionado aos oito arquivos TypeScript da #299, saída 0. O diff contra `codex/inbox-baseline-windows` contém só a #299. Ainda aguardam janela global, re-review e aceite visual.

- **Correção pós-review do TESTER:** 3 cenários RED determinísticos em `InboxNovo.interacao.test.ts` falharam como esperado: GET de `mensagem.nova` em voo retornou 1 em vez de 0; GET iniciado antes de abrir retornou 2 em vez de 0; falha da Server Action deixou 0 em vez de 2. Dois casos adicionais cobrem GET tardio após sucesso/GET novo e rejeição da ação com GET falho. GREEN: unitário direcionado **4 arquivos / 35 testes**, saída 0, nenhum ignorado (17:20:19); integração direcionada **2 arquivos / 13 testes**, saída 0, nenhum ignorado, perfil `dev-gravacoes`, `session_id 68963` acompanhado até código final 0 (17:19:33–17:20:14); ESLint dos dois arquivos TypeScript alterados, saída 0. A revisão independente do novo commit está pendente.

- **Pós-rebase em `201f0a9daaeb23c5447a6f351729298fb3db60f2`** (sobre `origin/main` `36334f27b13ede2b88e5290e21510fe354eeddcf`): o integrador informou `prisma generate` e `migrate deploy` com saída 0 no perfil `dev-gravacoes`, incluindo `numero_excluido`. Repeti os mesmos quatro arquivos unitários: **30/30 testes, saída 0**, nenhum ignorado (17:13:25). Repeti os dois arquivos de integração no mesmo banco: **13/13 testes, saída 0**, nenhum ignorado, `session_id 12830` acompanhado até código final 0 (17:13:34–17:14:25). Os avisos de configuração `MIXED_EXPORTS`/`vite-tsconfig-paths` não afetaram o resultado. TSC e checks globais ainda aguardam a janela do integrador.

- Unitário RED observado: abertura inicial (0 chamadas), troca (contador 2), novo aviso (0 chamadas), coalescência (3 chamadas). GREEN final: `node_modules/.bin/vitest.cmd run` com `marcar-lida.test.ts`, `InboxNovo.interacao.test.ts`, `InboxNovo.test.ts`, `sem-polling.test.ts`; **4 arquivos / 30 testes**, saída **0**, nenhum ignorado.
- Integração RED observada: 3 falhas esperadas em `motor/presenca.int.test.ts` e `preferencias.int.test.ts` (ação inexistente e chamada indevida ao motor em `CAIU`). GREEN final: `node_modules/.bin/vitest.cmd run -c vitest.integration.config.ts` nesses dois arquivos; perfil `dev-gravacoes`, **2 arquivos / 13 testes**, saída **0**, nenhum ignorado, `session_id 50977` acompanhado até encerrar.
- ESLint direcionado aos oito arquivos TypeScript tocados: saída **0**, nenhum aviso. O primeiro lint encontrou duas violações `react-hooks/refs`; o marcador estável passou para inicialização `useState` e o contador é atualizado na seleção.
- A primeira tentativa unitária no sandbox falhou antes de carregar testes por `EPERM` ao renomear cache temporário do Vitest. A repetição escalada executou RED funcional. Não houve banco de produção, instalação ou envio externo.

## Pendências explícitas

- TypeScript (`tsc --noEmit`), `npm test`, lint global e checks pós-rebase: aguardam janela global do integrador; não há alegação de aprovação.
- Aceite visual nos três tamanhos e dois temas, com contador antes/depois: TESTER organizará fixture isolada; ainda não há captura. O harness visual da E1 não existe na base E0.
- Novo re-review do commit corrigido pelo TESTER, homologação, PR/push e integração: a cargo do integrador. O primeiro review (`201f0a9d`) e o re-review R1 (`91e554d0`) encontraram P2 reproduzidos e corrigidos acima; não marcar #299 concluída até os gates restantes.
- Node em uso: 24.16.0; `.nvmrc` pede 22. Registrar qualquer diferença observada nos checks finais.
