# Incremento 388 — identidade e concorrência de autenticação

Data: 14/09/2026.

O limite de tentativas passou a serializar operações pela chave derivada do endereço. O bloqueio cobre também a primeira tentativa, antes de existir linha no banco, evitando colisão e perda de contagem em requisições simultâneas.

Dois testes de integração passaram em `portal-aluno/rate-limit.int.test.ts`: sete requisições concorrentes produziram cinco falhas registradas e dois bloqueios; a janela expirou corretamente e os controles de login/recuperação permaneceram separados. Datas foram conferidas em UTC. Evidência: `../validacao-portal-rate-limit-388-2026-09-14.json`.

Três testes de integração passaram em `portal-aluno/identidade.int.test.ts`: convite de uso único e sessão por digest; recuperação com revogação das sessões anteriores; troca de e-mail validada e aprovada, seguida de nova definição de senha e recusa de reposição de outro aluno. Evidência: `../validacao-identidade-portal-388-2026-09-14.json`.

Limites da prova: o adaptador de envio foi substituído por callback de teste; não houve Resend real, interface ou prova de entrega. O cenário inicial de autoaprovação usa uma pessoa da Secretaria, sem papel administrativo; é preciso complementar com administrador preparador para comprovar a separação de pessoas quando ambos têm o papel exigido. O envio externo ainda ocorre dentro da transação e precisa tratamento de persistência/resultado incerto antes de habilitação operacional.

Agenda de reposições e segunda chamada seguem em desenvolvimento, com drafts de migrations não aplicados. Estes cinco testes não comprovam regressão completa ou conclusão da SPEC.
