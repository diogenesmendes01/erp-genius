# SPEC-ACA-REM-01 — Remarcação de segunda chamada

Estado: aplicação atômica e tela implementadas, com limites ainda abertos. [Evidências e pendências do incremento 588](../planejamento/validacao-incremento-588.md). A existência deste documento não comprova entrega integral.

## Fontes e alcance

Aplicam-se as decisões gerais de agenda Q21, as regras de oportunidade Q146–Q148 e de prazo Q149. Secretaria/gestão preparam a alteração; outra pessoa da Gerência Pedagógica/Administração aprova e aplica a proposta ainda válida. A troca de professor é uma atribuição distinta e não pode ser introduzida por um campo extra em uma alteração apenas de horário.

## Comportamento requerido

1. Selecionar a reserva e conferir seu encontro atual, matrícula, avaliação, professor e prazo. Registrar os horários anterior/proposto, fuso, motivo, evidência, autoria e a versão conferida.
2. Preparar uma proposta não modifica a agenda nem cria outra oportunidade. Reenvio idêntico preserva a proposta; mesma chave com conteúdo diferente é recusada.
3. A decisão deve revalidar o conjunto após os bloqueios: reserva ainda aberta, encontro alterável, contexto contratual/acadêmico, atribuição docente, ausência de fato terminal, calendário, disponibilidade e conflitos. Aprovação da própria proposta é recusada mesmo com acúmulo de papéis.
4. Horário proposto deve ser futuro e seu fim posterior ao início; pode atravessar meia-noite. Instantes são normalizados em UTC, preservando o fuso de origem. O calendário e os conflitos são verificados sobre todo o intervalo.
5. A alteração não reinicia o prazo da disponibilização. Se o novo horário exigir prorrogação, o fluxo independente de Q149 precisa estar concluído antes da aplicação. Esta proposta não concede exceção de prazo por consequência.
6. Aplicação preserva o encontro e os horários anteriores no histórico e mantém a identidade da oportunidade reservada. Não cria nota, presença, cobrança, consumo adicional ou liberação de saldo por si só. Fatos terminais não são reabertos.
7. Toda aplicação é atômica e reenvio da decisão não repete efeitos. Concorrência com realização, falta, impedimento ou cancelamento precisa produzir um único estado válido.
8. Quando o intervalo atingir dia não letivo, a proposta exige justificativa específica e registra a versão do calendário, seu fuso e os períodos afetados. Outra pessoa autorizada deve aprovar expressamente essa exceção para o encontro, junto à decisão de remarcação. Não alterar o calendário geral nem liberar outros encontros.
9. Mudança na referência de calendário depois da conferência exige nova proposta antes da aprovação. Propostas históricas sem essa conferência permanecem consultáveis e podem ser rejeitadas; não presumir autorização de exceção nem completar evidências antigas automaticamente.
10. Secretaria e gestão acessam a fila administrativa de agendas e o histórico paginado das propostas, com os mesmos limites de dados e permissões aplicados no servidor. A conferência da reserva mostra seu identificador, código da avaliação, professor da agenda e prazo vigente no fuso exibido; se o vínculo atual divergir, identifica esses dados como históricos e não como autorização para nova remarcação.
11. A matrícula pausada ou encerrada exige autorização específica Q151 válida no novo intervalo, conferida no início, no fim menos um milissegundo e nas mudanças contratuais ou de vigência da autorização dentro do encontro. A proposta e a aplicação revalidam a situação contratual nesses instantes; autorização que termina antes de acabar o encontro não basta. Remarcar não reativa a matrícula nem concede nova autorização.
12. A atribuição docente deve cobrir todo o intervalo do encontro, inclusive depois da remarcação. O fim do encontro pode coincidir com o fim do vínculo/designação, sem ultrapassá-lo. Mudanças de atribuição dentro do intervalo exigem cobertura contínua; uma designação antiga substituída não volta a valer por expiração da mais recente.

## Implementação técnica prevista

Usar a ordem de bloqueios corrigida na segunda chamada: reserva antes do calendário/contexto, depois proposta e agenda/encontro. Não bloquear proposta e aguardar calendário mantendo ordem inversa. A comparação do estado deve abranger os dados usados na revisão, e a decisão revalida disponibilidade atual.

O fluxo deve ter persistência de proposta/decisão, consulta de revisão, aplicação transacional, proteções SQL, interface e testes. O helper puro de entrada é apenas uma parte desse conjunto; não dispensa as verificações transacionais.

## Critérios de aceitação

- Proposta não altera reserva, encontro, cota, notas ou cobrança.
- Autoaprovação, revisão desatualizada e encontro terminal são recusados.
- Instantes equivalentes com offsets diferentes têm representação UTC estável; horário de visualização não muda o instante.
- Conflito de professor, indisponibilidade e período não letivo sem exceção impedem aplicação.
- Autorização Q151 que cobre apenas o início é recusada no servidor e no banco; uma autorização suficiente permite remarcar sem reativar a matrícula.
- Prazo vencido não é reiniciado; prorrogação possui sua própria aprovação.
- Aplicação concorrente com fato terminal não deixa histórico órfão nem duplica oportunidade.
- Histórico, permissões e interface refletem o resultado efetivamente aplicado.

Q164 continua tratando resolução de impedimento e não é resolvida por esta remarcação. A implementação deverá preservar essa separação.

## Concorrência com mudança contratual

A decisão deve conferir a situação contratual após obter os bloqueios compartilhados com os fluxos de pausa e retomada. Uma pausa que confirma enquanto a decisão aguarda deve ser considerada antes dos efeitos. Isso também vale para decisões inseridas diretamente no banco. Preservar a ordem compatível de reserva (quando existente), calendário, lead/matrícula e contexto acadêmico, antes dos bloqueios da proposta/fonte. Revalidar o vínculo depois da espera. Uma pausa revertida não deve impedir uma decisão que permaneça válida.

Rejeitar proposta obsoleta não exige contexto válido para aplicação. A rejeição preserva a ordem de reserva/calendário/proposta e os controles de decisão independente, sem criar efeitos de aprovação. [Verificação da concorrência e desse limite](../planejamento/validacao-incremento-590.md).

O histórico administrativo permanece consultável quando o vínculo atual diverge do registrado na proposta. Mostrar a matrícula e a turma originais, sinalizar que o contexto mudou e impedir nova proposta/aprovação nesse histórico. Outra pessoa autorizada pode rejeitar a proposta; essa operação preserva hash, motivo, autoria, papéis vigentes e reenvio idempotente. A consulta não passa a exibir os dados do contrato para o qual a alocação foi alterada.
