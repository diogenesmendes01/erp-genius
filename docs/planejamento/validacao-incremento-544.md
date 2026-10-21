# Incremento 544 — aprovação e disponibilização da preparação especial

Proposta com autorização de preparação pode avançar para aprovação independente e disponibilização durante pausa/encerramento. Servidor e banco reconferem vínculo, fonte, papel/atividade do autorizador e prazo. Na disponibilização, a autorização precisa valer na data informada e no momento do registro. Plano que referencia autorização especial não usa o caminho comum como alternativa quando essa autorização deixa de valer.

Permanecem revisão por outra pessoa, versão mais recente, notas/fontes conferidas, limites configurados e prazo da regra contado da disponibilização. A projeção de `podeDisponibilizar` acompanha a nova regra. Reserva e realização continuam exigindo as liberações correspondentes; nenhuma etapa reativa contrato ou amplia oportunidades.

Migration 970 preparada pelo agente Terra e revisada antes da aplicação: corrigidos fechamentos SQL excedentes e acrescentado bloqueio da autorização/autorizador. Aplicação somente no banco local descartável.

Validação: 12 integrações selecionadas de planos aprovadas, zero falhas, 81 não selecionadas (`docs/validacao-planos-544-2026-09-15.json`). Depois foram acrescentadas verificações de inserção direta no banco para autor inativo e autoaprovação; repetição do cenário aprovada (`docs/validacao-preparacao-final-544-2026-09-15.json`, um aprovado, 92 não selecionados). ESLint e TypeScript aprovados.

Pendências: interface para registrar/selecionar a autorização de preparação, projeções de revisão do plano, cenários adicionais de encerramento e validação interativa. Q151 permanece parcial. Não houve produção, envio externo ou conclusão automática de avaliação.
