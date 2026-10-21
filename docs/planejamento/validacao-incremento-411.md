# Incremento 411 — autorização e rota de vídeo

2026-09-14. Guard de reprodução vincula sessão, conta, matrícula exata, reposição aprovada e material publicado sem indisponibilidade. Confere bloqueios e D+30 usando a política financeira existente antes de acessar o Drive. Pausa/encerramento não são liberados pela concessão de entrega, que não representa permissão contratual para assistir.

Rota GET de vídeo conectada ao guard e ao adaptador. Cada requisição, inclusive Range, revalida a autorização. Só devolve stream e cabeçalhos permitidos, sem URL externa, token ou ID de arquivo. Respostas são privadas e não armazenáveis em cache. Player no portal usa apenas o ID da reposição e não oferece recurso de download; isso não constitui proteção contra captura/cópia.

## Evidência

- Guard: **7/7** testes de integração após corrigir fixture que tentava duas alocações ativas para a mesma matrícula. Relatório: `docs/validacao-video-acesso-411-corrigido-2026-09-14.json`.
- Rota: **3/3** testes simulados: stream parcial/cabeçalhos, revalidação após bloqueio, origem cruzada e erro neutro do provedor.
- O provider `credenciais.ts` ainda está em implementação; portanto a rota ainda não está pronta para operação nem há build aprovado desta integração. Testes da rota substituem o provider por mock.

## Pendências

Concluir provider, compilar, validar reprodução real e desempenho com permissões da escola. Conferir regras contratuais de acesso após pausa/encerramento antes de implementar concessão própria. A SPEC inteira permanece incompleta.
