# Pendência verificada — ciclo da agenda de segunda chamada

Estado atual: agenda inicial, remarcação, exceções de calendário e proteções SQL de origem, campos, exclusão e transições estão implementadas até o incremento 586. Rodada conjunta: 72 integrações aprovadas, além de lint e build. Permanecem resolução do impedimento escolar conforme Q164 e validação interativa. Ver [evidências e limites do 586](validacao-incremento-586.md). Os registros abaixo são históricos.

Atualização 570: impedimento escolar encerra/protege encontro como IMPEDIDO_ESCOLA sem consumo. Faltam resolução rastreável da pendência escolar no fechamento e proteção/alteração de encontros previstos; ver `validacao-incremento-570.md`.

Atualização 569: falta encerra o encontro como NAO_REALIZADO e preserva agenda/histórico; ver `validacao-incremento-569.md`. Permanecem impedimento da escola e proteção/alteração de encontros previstos.

Atualização 568: cancelamento pelo aluno implementado com aprovação e efeito pela antecedência original. Ver `validacao-incremento-568.md`. Permanecem falta, impedimento e proteção/alteração de encontros previstos.

Atualização 567: cancelamento pela escola implementado com proposta, aprovação independente, aplicação atômica e histórico. Ver `validacao-incremento-567.md`. Permanecem cancelamento pelo aluno, falta, impedimento e proteção dos encontros ainda previstos. A evidência histórica abaixo não representa o estado atual das partes concluídas.

Auditoria de código em 15/09/2026, incremento 565. Atualização 566: a realização agora conclui seu encontro de forma transacional; encontro concluído e ligação ficam protegidos. Cancelamento, falta, impedimento e proteção dos encontros ainda previstos continuam pendentes. A evidência abaixo descreve a situação encontrada no 565.

## Evidência

`src/server/avaliacoes/segunda-chamada-ocorrencia-tx.ts` registra a ocorrência e encerra a reserva, mas não altera o encontro. `segunda-chamada-realizacao.ts` também preserva o encontro como PREVISTO. A proteção `preservar_finalidade_encontro`, definida em `20260914230000`, protege os encontros vinculados a proposta de agenda de recuperação; não abrange as ligações por `AgendaSegundaChamada`. O guard desta ligação não oferece proteção equivalente contra mudanças diretas no horário/docente/status de EncontroAgenda.

## Trabalho necessário

Implementar proposta, revisão e aprovação independente para cancelamento de agenda publicada de segunda chamada, conforme Q21 e Q148. Preservar proposta, reserva, oportunidade, fato e encontro; revalidar o conjunto antes de aplicar. A realização comprovada deve concluir o encontro correspondente sem criar presença, nota, cobrança ou consumo de outro benefício automaticamente. Cancelamento, falta e impedimento precisam de tratamento coerente na agenda e na contagem de oportunidades, sem transformar ocorrência financeira/acadêmica em aula ministrada.

Proteger os campos e transições do encontro no banco; impedir exclusão, reatribuição ou mudança de horário que contorne a aprovação. Cobrir concorrência entre realização e cancelamento, autoaprovação, revisão desatualizada, preservação de oportunidade e liberação do horário. Verificar consumidores da agenda antes de mudar estados. Não reutilizar silenciosamente a aprovação de segunda chamada como aprovação de cancelamento posterior.

Esta pendência não foi corrigida no incremento 565. Sua solução deverá incluir servidor, banco, interface e testes, sem declarar o módulo completo enquanto persistir.
