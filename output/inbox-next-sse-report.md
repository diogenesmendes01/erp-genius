# Inbox — compatibilidade da rota SSE com os tipos gerados do Next

O validador `.next/dev/types/app/api/inbox/eventos/route.ts`, gerado pelo servidor Next real, rejeitava os exports `VIDA_MAX_MS`, `REVALIDAR_MS` e `RETRY_MS`. A reprodução no predecessor #299 terminou com código 2 (sessão10576, TS2344). Os checks sem esse arquivo gerado não detectavam o defeito.

As três constantes foram movidas para `limites.ts`, importado pela rota e pelo teste existente. Valores, autenticação, revalidação, encerramento e reconexão não mudaram. A rota exporta apenas GET/runtime/dynamic. Não se removeu o tipo gerado para esconder o erro.

Validação em Node22.23.2: sessão59855 terminou com código0 após 10 testes da rota, TypeScript global com heap8192 incluindo o mesmo validador Next e ESLint dos três arquivos com zero avisos. Sem filtros adicionais ou testes ignorados. A regressão global da combinação E0 ocorrerá após integrar localmente suas trilhas.

PR técnico separado, dependente de #382, sem merge/deploy ou tráfego externo. Não altera schema, contratos ou permissões. Não há alteração visual.
