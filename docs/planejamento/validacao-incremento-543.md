# Incremento 543 — preparação de recuperação após pausa ou encerramento

A gestão pode registrar autorização imutável para preparar a pendência de um vínculo acadêmico com matrícula pausada/encerrada, motivo e prazo. O servidor exige insuficiência de notas comprovada; notas obrigatórias ausentes continuam seguindo segunda chamada. A fonte preserva matrícula, alocação, turma, nível, regra e situação.

A proposta de plano passa a aceitar a referência dessa autorização. Servidor e banco conferem vínculo, fonte, prazo e atividade/papel do autorizador. O preparador mantém as permissões vigentes; o professor anterior não recupera atribuição por causa dessa autorização. Continuam a validação de insuficiência, cobertura de habilidades, versões e repetição idempotente. A proposta grava a autorização utilizada.

O registro da autorização não gera plano ou oportunidades automaticamente; salvar a proposta não aprova, disponibiliza, reserva nem realiza a recuperação. A aprovação independente e as demais etapas precisam ser conectadas a este novo caminho antes da entrega integral.

Prisma e migrations 950/960 preparados pelo agente Terra, revisados e aplicados somente no banco local de testes. Cenário integrado direcionado aprovado em `docs/validacao-preparacao-especial-543-2026-09-15.json`: pausa efetiva, rejeição docente na autorização, idempotência, imutabilidade, fonte inválida, proposta bloqueada sem autorização, proposta com referência válida e rejeição de novo uso após inativação do autorizador. A regressão selecionada de planos aprovou 12 testes, zero falhas, 81 não selecionados (`docs/validacao-planos-543-2026-09-15.json`). Lint aprovado. TypeScript identificou um tipo JSON amplo no teste; corrigido, com nova conferência de tipos e repetição do cenário direcionado aprovadas.

Pendências: conectar aprovação/disponibilização e interface desse caminho, testar encerramento e demais efeitos de ponta a ponta. Q151 não está concluída. Sem operação externa ou ensaio interativo.
