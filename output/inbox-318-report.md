# Relatório DEV A — #318, checkpoint exclusivo

Base243c9348454b6cca5795a6afa747efa25ed3eef1; branch codex/inbox-e1-318. Investigação GitHub/Task13 em output/inbox-318-investigacao.md aprovada pelo integrador antes de implementar. SPEC docs/specs/inbox-painel-contato-abas.md. Fonte314 permanece na ref congelada. Sem alteração de InboxNovo/ConversaAberta/dialogo/BotaoIcone/harness/quadro. Nenhuma instalação/package/lock/schema/migration/envio/PR/push ou preview.

## Escopo implementado

PainelContato aditivo, fallback308 e uma montagem/foco/inert/Escape/cleanup preservados; cabeçalho132/nome/tags, uma rolagem local, único fechar/ref. ABAS_ENTREGUES só Detalhes, abas controladas com teclado/ARIA e contagem mono. LinhaCampo puro; PainelSetor sem padding externo. Tags mínimas e ordenadas apenas após pessoa comercial autorizada/não legal; marca pela associação sem autor, sem nova regra de ativo. Quatro registros específicos de guardas autorizados depois, sem alterar algoritmos ou registros alheios.

## TDD e execuções observadas — Node22.23.2

- RED6d16db exit1:14 novos falharam,8 antigos verdes e módulo LinhaCampo ausente. Cabeçalho/abas/tags não existiam; unidade server prova que tags faltavam e não relaxa guarda.
- Primeiro GREEN parcial c35c64 exit1:29 passaram/1 antiga asserção de dt literal falhou porque o novo tamanho12,5 foi acrescentado. Atualizada a asserção para manter a mesma cor text-gray-600 e incluir tamanho exigido, sem afrouxar contraste.
- REDf94d04 exit1: teclado de abas falhou,8 interações de casca passaram. GREEN955a98 exit0:5 arquivos33 testes, incluindo9 interações reais ReactDOM e9 unidades de tags. Lint dos10 arquivos afetados da mesma chamada terminou0/0avisos. DOM mínimo não implementa SVG: mock local de três ícones decorativos, nenhum utilitário global alterado.
- TSCheap8192 e recorte77973/499cc8 exit0:29 arquivos316 testes, todos os testes unitários da pasta Inbox + Avatar.test.ts + paineis-tags.test.ts, maxWorkers2, sem ignorados. Não é global.
- Antes de executar DB, identificado beforeEach truncarBanco no arquivo autorizado. Integrador fez snapshot completo em schema privado fora de public,424 tabelas/551 registros e roundtrip com hashes424/424. Só após confirmação foi usada a janela dev-email; perfil fixo conferido, sem outro banco/servidor/suíteDB.
- Integração19403/5e7b32 exit1:11/12 passaram. Fixture nova financeira sem matrícula explícita foi rejeitada pelo trigger existente. Corrigida a fixture com seedCobranca já importado e vínculo aluno/matrícula; nenhum domínio/trigger alterado.
- Integração final52198/5de25e EXIT0:1 arquivo12 testes, vitest.integration.config.ts, src/server/inbox/paineis.int.test.ts, maxWorkers1, perfildev-email; nenhum ignorado. Cobre novas tags ordenadas/sem autor/inativa já vinculada, outra carteira/linha, responsável legal, outro setor e convite revogado, além dos nove casos antigos. Exatamente esse arquivo foi executado; não paineis-envio ou outra suíte DB. Banco liberado e integrador informou restauração a33eba exit0,424 assinaturas idênticas,307/314 normal9mensagens4notas preservada.
- TSCheap8192+lint afetados37893/9016c0 exit0 após correção da fixture. Guardas a7bdd8 exit1:4 registros ainda ausentes/95 testes verdes (7 arquivos99testes): aba1, key a.id, aria-selected e tag1 em superfície. Integrador autorizou somente esses quatro registros; nenhum algoritmo/regex/limite geral ou componente alheio mudou.

Gates finais após os quatro registros autorizados:80530/fe07f5 EXIT0,36 arquivos415 testes (pasta Inbox+Avatar+paineis-tags e sete guardas listadas), maxWorkers2, sem ignorados; TSCheap8192+lint dirigido1172/8fa94a EXIT0/0avisos. Node22.23.2. Fonte sem mudança após esses gates, só documentação. Não é full global.

## Pendências

Integração com composição do Inbox/triagem/estado da aba após handoff313; BotaoIcone real36/rótulo responsivo, preservando um fechar e a ref; normalização de padding/divisórias de filhos sem perder aprovação Aria/ações/opt-out; CLI painel-detalhes + estados atuais, esperas/hidratação/anonDOM392, capturas app×protótipo e provas de altura500/nomes/tags longas/resize/foco. Sem teste real de geometria ainda. TESTER e global coordenado pendentes. Quadro global reservado ao integrador, não editado nesta fase. Não chamar checkpoint parcial de funcionalidade pronta.

Checkpoint exclusivo será integrado à fonte313585753da por autorização do integrador. Composição ainda exige liberação posterior; scripts/visual permanecem comB durante formal313. Banco dev-email restaurado pelo integrador, nenhuma nova suíteDB/preview permitida neste intervalo.
