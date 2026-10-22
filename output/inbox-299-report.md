# Relatório DEV B — #299

Estado em 22/10/2026: implementação preparada para revisão, com gates finais pendentes. Branch `codex/inbox-e0-299`, base inicial `7e4810e5e6c4f25a00497fe743e0ea4abfb0c6ee`; SHA do commit e rebase serão informados ao integrador separadamente.

## Alterações

- `preferencias.ts`: ação `marcarAtendimentoLido` executa leitura pessoal; se ela falhar por escopo, para. Caso contrário, chama a leitura compartilhada/WhatsApp existente.
- `acoes.ts`: `message.read` agora depende da capacidade `confirmacaoLeitura` do número (ativo, driver compatível, sessão `CONECTADO`). O contador local continua sendo zerado quando o motor está indisponível.
- `InboxNovo.tsx` e `marcar-lida.ts`: abertura inicial, troca de conversa e `mensagem.nova` da thread visível disparam leitura; contador da lista zera de imediato. Pedidos da mesma conversa em voo viram uma repetição final; conversas distintas são independentes. Sem polling.
- SPEC em `docs/specs/inbox-leitura-automatica.md` e evidências no quadro único.

## Evidências executadas

- Unitário RED observado: abertura inicial (0 chamadas), troca (contador 2), novo aviso (0 chamadas), coalescência (3 chamadas). GREEN final: `node_modules/.bin/vitest.cmd run` com `marcar-lida.test.ts`, `InboxNovo.interacao.test.ts`, `InboxNovo.test.ts`, `sem-polling.test.ts`; **4 arquivos / 30 testes**, saída **0**, nenhum ignorado.
- Integração RED observada: 3 falhas esperadas em `motor/presenca.int.test.ts` e `preferencias.int.test.ts` (ação inexistente e chamada indevida ao motor em `CAIU`). GREEN final: `node_modules/.bin/vitest.cmd run -c vitest.integration.config.ts` nesses dois arquivos; perfil `dev-gravacoes`, **2 arquivos / 13 testes**, saída **0**, nenhum ignorado, `session_id 50977` acompanhado até encerrar.
- ESLint direcionado aos oito arquivos TypeScript tocados: saída **0**, nenhum aviso. O primeiro lint encontrou duas violações `react-hooks/refs`; o marcador estável passou para inicialização `useState` e o contador é atualizado na seleção.
- A primeira tentativa unitária no sandbox falhou antes de carregar testes por `EPERM` ao renomear cache temporário do Vitest. A repetição escalada executou RED funcional. Não houve banco de produção, instalação ou envio externo.

## Pendências explícitas

- TypeScript (`tsc --noEmit`), `npm test`, lint global e checks pós-rebase: aguardam janela global do integrador; não há alegação de aprovação.
- Aceite visual nos três tamanhos e dois temas, com contador antes/depois: TESTER organizará fixture isolada; ainda não há captura. O harness visual da E1 não existe na base E0.
- Revisão do commit exato pelo TESTER, homologação, PR/push e integração: a cargo do integrador após este commit e rebase. Não marcar #299 concluída até esses gates.
- Node em uso: 24.16.0; `.nvmrc` pede 22. Registrar qualquer diferença observada nos checks finais.
