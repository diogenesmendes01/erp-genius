# Incremento 474 — reprodução institucional da gravação original

Data: 15/09/2026. Meta integral ativa. Incremento anterior classificado como progresso de implementação e testes.

## Implementação

O diário oferece acesso à página de gravação quando existe fonte oficial. O autorizador reutiliza o escopo de leitura do histórico Q23: gestão autorizada ou docente da própria aula, com estado e autoria conferidos. Professor alheio e Secretaria não recebem a fonte. A designação Q24 não se transforma em acesso permanente após regularização. O drive registrado deve corresponder à configuração institucional atual.

A rota `/api/diario/encontros/[id]/video` reautoriza cada requisição e usa stream do Drive com Range. Não devolve identificador externo ou credenciais, não redireciona ao Drive, restringe cabeçalhos e usa resposta privada sem cache. Inclusão por outro site é recusada antes da busca externa. O player oferece reprodução sem botão de download; isso não promete impedir cópias por outros meios.

## Validação

- 14 testes de integração aprovados em `docs/validacao-video-institucional-474-2026-09-15.json`, incluindo autorização após conclusão/Q23, acesso do docente original e gestão, recusa de professor alheio/Secretaria e usuário desativado.
- 3 testes da rota aprovados em `docs/validacao-rota-video-474-2026-09-15.json`: Range, nova autorização negada, cabeçalhos restritos, cross-site e falha sem exposição de segredos.
- TypeScript e lint direcionado aprovados.

## Limites

Esta é a reprodução institucional. Não concede acesso novo a alunos ou responsáveis; o acesso do aluno por reposição mantém seu fluxo próprio. Integração entre gravação original e publicação de reposição, correção de vídeo Q23, relatos de indisponibilidade, testes visuais e validação real de desempenho/permissões/custos ainda exigem trabalho. Os testes simulam a fonte externa. Sem deploy ou alteração em produção.

Build aprovado com TypeScript e 63 páginas estáticas; rotas de gravação presentes. Sem validação visual em navegador nesta rodada.
