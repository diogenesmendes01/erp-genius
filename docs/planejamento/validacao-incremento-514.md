# Incremento 514 — prévia após ativação e relato de falta de oferta

15/09/2026. Implementação com agentes Terra e integração pelo orquestrador.

A tela da continuidade passa a exibir a prévia ou seu impedimento: período coberto, vencimento, antecedência calculada e valores. Não exibe hashes nem oferece emissão. O cenário integrado agora ativa a matrícula pelos serviços reais: aceite integrado, recebimento da taxa, política de comissão, uso da reserva e emissão da primeira mensalidade. Consultar a próxima cobertura não cria novas cobranças.

O registro de falta de oferta mantém matrícula, intervalo civil, motivo e evidência, com autoria, repetição idempotente e histórico imutável. É somente o relato inicial. Confirmação, encerramento de intervalo aberto, correção e efeito na recorrência ainda precisam ser integrados; não declarar falta de oferta confirmada apenas pela existência do relato.

## Verificação

42 integrações de aditivos/continuidade aprovadas em `docs/validacao-integracao-514-2026-09-15.json`. O cenário PRODUCAO_MENSAL confirma a prévia pública positiva após ativação real, com cobertura seguinte, preço do aditivo e consulta repetida sem emissão. Três integrações do relato aprovadas em `docs/validacao-relato-oferta-514-2026-09-15.json`, cobrindo idempotência, imutabilidade, datas e autorização. Build (incluindo TypeScript) e lint focado aprovados; log `docs/validacao-build-514-2026-09-15.log`.

A migração 760 foi aplicada somente ao banco descartável. A assinatura/transporte externos são simulados. Não houve ensaio interativo da tela, envio externo ou alteração em produção. O registro de relatos ainda não tem interface; a prévia já está ligada à tela da continuidade.
