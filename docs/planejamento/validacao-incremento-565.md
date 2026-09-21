# Incremento 565 — justificativas reais e reenvio da disponibilização

O painel de segunda chamada exige decisão explícita e motivo informado para autorizar/rejeitar, além de motivo próprio do agendamento. Remove os textos fixos que atribuíam à equipe justificativas não digitadas. Limites dos campos acompanham os schemas do servidor.

Os formulários usam controle assíncrono com trava síncrona, estado de envio, tratamento de erro e preservação dos valores após falha. A proposta mantém sua chave idempotente enquanto o conteúdo não mudar; disponibilização mantém o instante no reenvio dos mesmos dados. Esses dados de reenvio persistem durante a sessão do componente, não após recarregar a página.

O servidor aceita disponibilização repetida somente para mesmo autor autorizado, proposta, instante, condições e evidência. Retorna o registro e prazo originais sem emitir outro evento. Reenvio modificado, outro autor ou usuário inativo permanece recusado. A repetição não prorroga o prazo.

Validação: 26 integrações aprovadas em segunda chamada e pendências de fechamento, incluindo reenvios e negativas; ESLint aprovado. Build Next.js aprovado, incluindo TypeScript. Evidências: `docs/validacao-painel-final-565-2026-09-15.json` e `docs/validacao-build-565-2026-09-15.log`. Testes executados somente no banco local descartável. Sem ensaio interativo, produção ou dados reais.

A auditoria Terra identificou uma pendência relevante: o encontro da segunda chamada continua previsto após fatos terminais da reserva, sem proteção de agenda equivalente à recuperação. A solução exige revisão do ciclo e aprovação independente de cancelamento; não foi substituída por alteração automática sem aprovação. Ver [pendência e critérios](pendencia-agenda-segunda-chamada-565.md). Este incremento não comprova conclusão do módulo ou da SPEC geral.
