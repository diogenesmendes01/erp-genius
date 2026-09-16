# Incremento 558 — revisão de nota de segunda chamada devolvida

A realização da segunda chamada permanece única. Após rejeição explícita pela gestão, o professor com atribuição vigente pode submeter outra versão da nota original, preservando a anterior, sua decisão e a data/autoria da realização. Enquanto a nota aguarda decisão, não se permite nova versão; depois de oficializada, permanece obrigatório o fluxo de correção.

A relação entre realização e lançamentos passou a aceitar múltiplas versões. A consulta docente retorna a versão mais recente e o motivo da devolução, sem duplicar itens na fila. O formulário envia a versão esperada. Pendências de fechamento consideram se alguma versão dessa realização foi oficializada. Reenvio idêntico de versão antiga recupera o mesmo registro e não duplica evento.

A revisão do agente Terra identificou um caminho de inserção direta no banco sem devolução prévia. A migration 104000 acrescenta a exigência de rejeição da versão anterior, além dos guards existentes de autoria, origem, versão e oficialização independente. As migrations 103000 e 104000 foram aplicadas somente ao banco local de testes.

Validação: 14 testes de integração aprovados, zero falhas e zero não selecionados (`docs/validacao-segunda-chamada-final-558-2026-09-15.json`). Incluem rejeição, nova submissão, preservação da versão anterior, bloqueio por SQL direto, reenvio histórico sem duplicação de evento, fila sem duplicação e resolução da pendência somente após oficialização. ESLint focado e build aprovados (`docs/validacao-build-558-2026-09-15.log`). Backend e interface preparados por agentes Terra, com revisão e integração do orquestrador.

Não houve ensaio interativo no navegador, implantação ou alteração de produção. Regularização por professor distinto, demais cenários de segunda chamada e auditoria integral continuam pendentes. Q163 não foi presumida. Este incremento não representa conclusão geral da SPEC.
