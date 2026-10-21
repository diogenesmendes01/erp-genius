
# Task 30 - Lista e filtros

Feito: ListaAtendimentos.tsx (VirtualList acima de 100 linhas, linha com setor/número/status/responsável/prazo estourado, grupo com ícone e sem status, sem telefone, "Carregar mais"), PainelFiltros.tsx (abas Todas/Minhas/Fila/Não lidas/Prazo estourado, selects de setor/número/status, busca; escreve setor, numero, resp, status, naoLidas=1, prazo=estourado, busca via router.replace), ListaAtendimentos.test.ts (9 testes).
Desvio: lerFiltrosInbox (Task 23) lia numeroId/responsavel; o brief manda escrever numero/resp. Adicionei aliases numero/resp no parser (src/server/inbox/filtros.ts) + teste, mantendo os nomes antigos.
Testes: vitest ListaAtendimentos.test.ts + filtros.test.ts + pasta inbox: 8 arquivos, 58 testes verdes. tsc 0. eslint nos arquivos tocados 0. npm test completo não rodado (código compartilhado só filtros.ts, coberto).
Os componentes ainda não estão ligados ao InboxNovo (fora do escopo do brief).
