# Incremento 412 — credenciais e build da reprodução

2026-09-14. Provider de token integrado com `google-auth-library@11.0.2`. Usa conta de serviço e escopo de leitura, sem impersonação. A biblioteca mantém cache/renovação; configurações só são lidas quando há requisição, permitindo compilar sem credenciais. `.env.example` contém variáveis vazias; nenhuma conta ou credencial real foi criada ou ativada.

## Evidência

- **18/18** testes simulados: seis de credenciais, nove do adaptador e três da rota.
- O guard de autorização já passou em sete testes de integração no incremento 411.
- Build completo passou com compilação, TypeScript, 61 páginas estáticas e rota dinâmica `/api/portal-aluno/reposicoes/[id]/video`.
- `git diff --check` passou.

## Limites e pendências reais

Reprodução está conectada no código, mas ainda não foi verificada com um vídeo do Drive da escola. Permissões efetivas da conta de serviço, volume de acessos, desempenho, custos e reprodução no navegador continuam sem evidência operacional. Testes simulados não comprovam essas condições. As verificações ocorrem em cada requisição; não foi implementada interrupção imediata de bytes já autorizados dentro de uma resposta em curso.

Matrículas pausadas/encerradas não recebem acesso ao vídeo por mera liberação de entrega. Eventual concessão de reprodução depende de representar a condição contratual aplicável. A identificação da versão de entrega validada está em implementação. O restante da SPEC segue sem declaração de conclusão integral.
