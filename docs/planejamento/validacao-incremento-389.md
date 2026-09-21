# Incremento 389 — rotas do portal e integração da agenda

Data: 14/09/2026.

As rotas de login, token e recuperação usam leitura limitada aos bytes reais do corpo, mesmo com Content-Length ausente ou falso. Os parsers Zod recebem `unknown`. Nove testes de rotas passaram, cobrindo origem, tamanho, resposta sem segredo de sessão, cookie HttpOnly/no-store e resposta genérica de recuperação.

A suíte de identidade e limitação de tentativas teve seis testes de integração aprovados: `../validacao-identidade-portal-389-2026-09-14.json`. Inclui leitura de sessão após pausa/encerramento e tentativa de autoaprovação por administrador. Envio externo segue substituído por callback.

O schema da agenda foi integrado e o cliente gerado. A migração `20260915003000_agenda_reposicao` foi aplicada no banco de teste. A primeira aplicação falhou por colisão de nomes de índices truncados a 63 caracteres; confirmou-se rollback da tabela antes de corrigir nomes e reaplicar. Após aplicação, o diff banco/schema é vazio. Não houve produção.

A regressão de reposições/frequência registrou sete aprovações e quatro falhas (`../validacao-agenda-integracao-389-2026-09-14.json`). Três casos criavam encontros sem o vínculo pedido/agenda agora obrigatório. Um caso revelou erro real de lógica SQL com NULL, que podia deixar passar pedido pendente. A ação e consulta passaram a usar `IS NOT TRUE`, e o bloqueio SQL de leitura passou a nomear somente a tabela não opcional.

Após correção, o teste direcionado de pedido pendente/rejeitado/nova solicitação passou, incluindo recusa de duplicidade. Os outros sete testes do arquivo ficaram fora desse filtro. A migração das fixtures e a validação do agendamento completo seguem pendentes; não apresentar a regressão como inteiramente aprovada. A alteração posterior do despachante para persistir antes de chamar o provedor também exige novo teste.
