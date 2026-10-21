# Incremento 499 — valores estruturados e evidências do aditivo

Data: 15/09/2026. Implementação por três agentes Terra, com revisão e integração pelo orquestrador.

## Escopo

Preparação do aditivo com valores explícitos de texto, e-mail, dinheiro/moeda, data civil, minutos e regime. O texto documental deve corresponder ao valor estruturado. O snapshot preserva a entrada e seu hash; propostas legadas permanecem sem conversão automática.

A migração 650 acrescenta conferência das evidências documentais ao preservar o original e registrar a conferência interna de assinatura. Bloqueia documentos arquivados, fora do escopo ou diferentes do snapshot de participantes. Bloqueia os documentos antes de conferir seus valores e preserva as proteções anteriores.

## Limites

Estruturar a proposta não aplica condições à matrícula, não comprova alçadas específicas e não altera cobranças ou agenda. Agenda estruturada ainda depende de resolução da proposta acadêmica autorizada; uma referência digitada não comprova essa autorização. O caminho textual anterior permanece para a preparação documental de agenda.

Assinatura operacional, formalização, cadeia de aditivos aplicados e demais requisitos da SPEC continuam pendentes. Não houve publicação em produção nem envio externo nesta etapa.

## Evidências de validação

- 11 testes unitários aprovados: `docs/validacao-aditivo-unitarios-499-2026-09-15.json`.
- 24 testes de integração aprovados: `docs/validacao-aditivo-499-2026-09-15.json`. Incluem persistência e aprovação do valor estruturado, compatibilidade com propostas legadas e inserções diretas recusadas após alteração de URL, nome, categoria ou arquivamento de evidência.
- Migração 650 aplicada somente no PostgreSQL descartável de testes.
- TypeScript, lint direcionado do servidor e da interface e build aprovados. Build: `docs/validacao-build-499-2026-09-15.log`.
- Sem ensaio interativo da interface no navegador. Os testes de integração usam sessão simulada; não comprovam autenticação real no navegador nem operação do fornecedor de assinatura.
