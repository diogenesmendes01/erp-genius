# Incremento 421 — aplicação da equivalência

2026-09-14. A execução usa a ordem de locks acadêmicos antes da proposta/decisão, confere os três participantes, a versão e a base aprovada. Fecha origem, cria destino, movimentação, aplicação e eventos na mesma transação e com o mesmo instante UTC. Reenvio retorna os mesmos identificadores.

**2/2 integrações passaram**, incluindo duas chamadas simultâneas que produzem uma única aplicação e recusa por destino alterado. Relatório final: `docs/validacao-execucao-concorrente-421-corrigido-2026-09-14.json`.

As rodadas anteriores falharam por infraestrutura do teste: revalidação de cache fora do Next e resolução dinâmica simultânea do NextAuth pelo runner. O teste simula cache e identidade, mantendo consulta real de usuário ativo, verificação de papel e todas as transações/guards do banco. Não comprova sessão HTTP concorrente em execução real.

O conferidor passou a recusar transferência quando existe mudança de nível aberta na mesma matrícula, preservando a restrição do fluxo anterior. A interface de decisão/execução segue em implementação; o caminho legado ainda não foi substituído. Fontes de recuperação, aproveitamentos sucessivos, fechamento e progressão seguem pendentes. Não houve homologação visual ou alteração de produção.
