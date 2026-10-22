# #301 — aceite visual

`antes/`: 12 PNGs, duas sessões × três tamanhos × dois temas, base E0 `797994aa`; notas da rota já existem, mas não são renderizadas. Captura sessão25674 exit0.

`depois/`: 24 PNGs e manifesto, fonte301 `33d0a991`, mesma fonte de produção do head documental `29f401ff`. Duas sessões Admin fictícias, seis contextos; nota inicial visível e nova nota recebida em ambas sem reload. A quantidade real de MensagemWhatsApp fica3→3 em cada contexto, pageerrors vazios. Sessão80898 exit0. Parecer em `qa/inbox-301-review.md`, incluindo a correção de uma espera prematura do capturador na primeira tentativa.

Somente fixture descartável, BAILEYS desconectado e transportes externos vazios. Sem credenciais/cookies/seed versionados. Cartões inspecionados pelo TESTER e integrador em desktop claro e celular escuro. O defeito de rolagem externa é preexistente e resolvido separadamente pela #304.

Gates da combinação E0 `7657c528bb4d408066bc727bcfb4d12f39ae86e2`, Node22.23.2: full sem filtro maxWorkers2,845 arquivos/6526 testes sessão99285 exit0; TSC com tipos Next presentes sessão40124 exit0; lint global sessão5709 exit0,0erros/40avisos. Integração dirigida consultas-pagina/nota-interna:2 arquivos/26 testes sessão87157 exit0; preferencias/motor-presenca:2 arquivos/13 testes sessão56869 exit0, sem ignorados. Não são a suíte completa de integração.

A primeira execução de lint incluiu JS de um protótipo restaurado apenas para leitura e não rastreado nesta base (2erros/22avisos adicionais). A referência foi preservada no cache local; a execução final não altera regras/filtros e cobre o projeto com a configuração original.
