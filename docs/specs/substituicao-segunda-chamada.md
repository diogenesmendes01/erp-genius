# SPEC-ACA-SUB-01 — Substituição docente em segunda chamada agendada

Estado: servidor, banco e interface implementados no incremento 587. Onze integrações específicas, regressão conjunta anterior de 82 cenários, cinco testes de schema/renderização, build e lint aprovados no alcance documentado. Homologação interativa e produção não realizadas. [Evidências e limites](../planejamento/validacao-incremento-587.md).

Cobertura contratual contínua reforçada no incremento 589: [evidências e limites atuais](../planejamento/validacao-incremento-589.md), com o achado de concorrência SQL com pausa tratado e testado no [incremento 590](../planejamento/validacao-incremento-590.md).

## Requisitos e fronteiras

Q152 permite que a gestão designe outro professor para uma avaliação identificada, com motivo, acesso limitado e autoria anterior preservada. Q21 e Q56 exigem proposta e aprovação de outra pessoa para alterar o responsável de encontros já publicados. A designação de acesso, isoladamente, não modifica uma agenda aprovada.

A substituição trata de segunda chamada com reserva vigente e encontro previsto ainda não iniciado, sem realização ou ocorrência terminal. Preservar o encontro, seus horários e fuso, a matrícula, a avaliação, a turma e a oportunidade reservada. Não alterar o professor titular da turma nem criar outra tentativa, cobrança, presença ou nota. Remarcação, cancelamento, prorrogação e regularização de avaliações já realizadas mantêm os fluxos próprios.

## Fluxo obrigatório

1. Secretaria, Gerência Pedagógica ou Administração prepara a proposta identificando reserva, professor substituto, motivo e evidência. A prévia mostra professor atual, substituto, horário completo, contexto acadêmico e impedimentos; guardar o estado conferido e uma chave para reenvio seguro.
2. Proposta não altera a agenda nem concede atribuição ao substituto. Conferir que o substituto é professor ativo e diferente do responsável atual, além de conflitos, indisponibilidades e reservas comerciais. A agenda precisa manter cobertura contratual, prazo, autorização específica durante pausa/encerramento e calendário aplicável. Essa cobertura é contínua: pausas e alterações de vigência dentro do encontro também são conferidas, mesmo com as duas extremidades ativas. Servidor e aplicador SQL recusam a troca sem cobertura integral.
3. Outra pessoa da Gerência Pedagógica/Administração confere e decide. Secretaria não aprova. Acumular papéis não permite autoaprovação. Revalidar o estado sob bloqueios antes de aplicar; proposta desatualizada pode ser rejeitada e exige nova conferência para aprovação.
4. Aprovação aplica de forma atômica a mudança de professor do encontro e a designação limitada à segunda chamada. A designação fica registrada com vigência e autoria próprias, conforme Q152, permitindo continuidade do trabalho dessa avaliação sem transferir o vínculo da turma. Guardar professor anterior/novo, proposta, decisão e aplicação.
5. O professor anterior não registra realização do encontro substituído; o novo professor precisa satisfazer também as condições efetivas de realização. O histórico preserva todas as atribuições e quem efetivamente realizou a avaliação. Fatos anteriores não passam a ser de autoria do substituto.
6. Reenvio idêntico não duplica a decisão, a designação ou a aplicação. Concorrência com outra alteração ou fato terminal permite somente um resultado coerente. SQL direto não pode modificar professor, apagar histórico ou simular a aprovação.
7. A interface fornece preparação, conferência, decisão e histórico paginado com nomes e datas legíveis. Não apresentar a concessão de acesso Q152 como se já tivesse substituído o professor de um encontro publicado.

## Critérios de verificação

Integração com banco real: autorização por papel, autoaprovação, proposta sem efeitos, aplicação única, preservação de horário/reserva/titular, isolamento de contrato, reenvio, conflito surgido após revisão, indisponibilidade, docente desativado, prazo/contexto alterado, calendário, concorrência e mutações diretas proibidas. Exercitar realização pelo substituto e recusa do antigo responsável, mantendo nota original e sua oficialização no fluxo existente. Validar a interface e registrar os limites da homologação.

Uma nova versão do calendário sem mudança do fuso ou dos períodos não letivos incidentes permite nova conferência de substituição. O snapshot guarda a referência atual completa; alteração após a proposta exige nova revisão. Alteração real das condições letivas continua pelo fluxo de agenda/exceção aplicável.

Q164 continua independente: substituir o professor não resolve por consequência um impedimento escolar histórico.

## Concorrência com mudança contratual

A decisão deve conferir a situação contratual após obter os bloqueios compartilhados com os fluxos de pausa e retomada. Uma pausa que confirma enquanto a decisão aguarda deve ser considerada antes dos efeitos. Isso também vale para decisões inseridas diretamente no banco. Preservar a ordem compatível de reserva (quando existente), calendário, lead/matrícula e contexto acadêmico, antes dos bloqueios da proposta/fonte. Revalidar o vínculo depois da espera. Uma pausa revertida não deve impedir uma decisão que permaneça válida.

Rejeitar proposta obsoleta não exige contexto válido para aplicação. A rejeição preserva a ordem de reserva/calendário/proposta e os controles de decisão independente, sem criar efeitos de aprovação. [Verificação da concorrência e desse limite](../planejamento/validacao-incremento-590.md).

O histórico administrativo permanece consultável quando o vínculo atual diverge do registrado na proposta. Mostrar a matrícula e a turma originais, sinalizar que o contexto mudou e impedir nova proposta/aprovação nesse histórico. Outra pessoa autorizada pode rejeitar a proposta; essa operação preserva hash, motivo, autoria, papéis vigentes e reenvio idempotente. A consulta não passa a exibir os dados do contrato para o qual a alocação foi alterada.
