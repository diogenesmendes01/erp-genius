# SPEC-ACA-AGI-01 — Agenda inicial de segunda chamada

Estado: proposta, prévia, aprovação e aplicação atômica implementadas no incremento 584; fila administrativa no 585; proteção SQL da origem e dos encontros concluída no 586, com retirada das funções legadas e 72 integrações aprovadas na rodada conjunta. Validação interativa permanece pendente. [Evidências e limites](../planejamento/validacao-incremento-586.md).

Cobertura contratual contínua reforçada no incremento 589: [evidências e limites atuais](../planejamento/validacao-incremento-589.md), com o achado de concorrência SQL com pausa tratado e testado no [incremento 590](../planejamento/validacao-incremento-590.md).

## Fontes normativas já registradas

- **Q146** define segunda chamada como nova realização de avaliação original pendente, sem recuperação, nota automática, presença, cobrança ou troca de avaliação. O professor propõe a segunda chamada e outra pessoa da gestão a autoriza; isso não torna um horário concreto automaticamente aprovado. [AV-28](avaliacao-por-habilidades.md#av-28) registra essa regra.
- **Q147 e Q148** mantêm o limite por avaliação e reservam a oportunidade apenas quando a agenda é efetivamente vinculada. Realização, falta e cancelamentos têm efeitos próprios; o agendamento não pode duplicar ou compartilhar saldo. [AV-29 e AV-30](avaliacao-por-habilidades.md#av-29) registram a regra.
- **Q149** inicia o prazo na disponibilização aprovada. O encontro inteiro precisa caber nesse prazo; prorrogação é fluxo próprio e não consequência de agendar. [AV-31](avaliacao-por-habilidades.md#av-31).
- **Q19** admite encontro específico em período não letivo somente com justificativa, aprovação independente e conflitos conferidos. A exceção vale apenas para o encontro, sem tornar o calendário geral letivo. [Q19 em F07](../planejamento/f07-agenda-aulas.md#q19--aula-excepcional-em-feriado-recesso-ou-frias-da-escola).
- **Q21** estabelece que Secretaria/gestão prepara a proposta de agenda e outra pessoa da Gerência Pedagógica/Administração aprova e aplica a versão ainda válida na mesma operação. Não há etapa posterior de execução pela Secretaria. [Q21 em F07](../planejamento/f07-agenda-aulas.md#q21--quem-efetiva-alteraes-aprovadas-de-calendrioagenda).

Q151 e Q152 continuam aplicáveis como restrições já existentes: vínculo pausado/encerrado exige a autorização específica aplicável, e a atribuição docente precisa cobrir todo o intervalo. Nenhuma delas substitui a decisão de agenda inicial. A autorização contratual deve cobrir continuamente o encontro: conferir também mudanças de situação e de vigência da autorização dentro do intervalo, mesmo quando a matrícula estiver ativa nas duas extremidades. A verificação ocorre no servidor e na aplicação SQL antes de criar encontro ou reserva.

## Estado observado antes da implementação (incremento 583)

O painel da avaliação oferece proposta, decisão e disponibilização da **segunda chamada**, e depois somente um seletor de encontros já previstos para reservar e vincular a agenda. Não há formulário que crie ou revise o primeiro encontro de segunda chamada. Ver [SegundaChamadaPainel.tsx](../../src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/SegundaChamadaPainel.tsx).

A página busca essa lista somente para a gestão por meio de `listarEncontrosSegundaChamada`; a ação de criação `criarEncontroSegundaChamada` existe no servidor, recebe diretamente professor, início, fim, fuso e motivo e cria `EncontroAgenda` previsto. Depois, `agendarSegundaChamada` reserva e vincula em operação separada. Esse registro descreve a página e os módulos `segunda-chamada-encontro.ts` e `segunda-chamada-agenda.ts` no incremento 583; os dois módulos legados foram removidos no incremento 586 após a migração dos consumidores.

Esse caminho confirma prazo, disponibilidade e atribuição no servidor, mas não contém uma revisão concreta do calendário Q19 antes de criar o encontro nem expõe calendário, versão, períodos não letivos ou justificativa para decisão. A ausência dessa interface não deve ser suprida bloqueando permanentemente feriados: Q19 já definiu uma exceção vinculada a encontro, com revisão independente.

## Escopo de implementação

Reutilizar a conferência de [remarcação de segunda chamada](remarcacao-segunda-chamada.md), adaptando-a para a primeira agenda, que ainda não possui reserva nem encontro anterior. Isto integra as decisões Q19 e Q21; não cria uma aprovação de negócio adicional além do ponto de aprovação independente que efetiva a agenda concreta.

1. A implementação usará proposta de agenda após a disponibilização, preservando o fluxo existente de autorização da avaliação e seu prazo. A entrada contém professor, início, fim, fuso de origem, motivo, evidência, chave idempotente e hash do estado conferido; só existe uma aprovação independente que aplica aquela agenda concreta. A preparação não cria encontro, reserva, nota, consumo ou cobrança.
2. A conferência prepara um snapshot separado do contexto usado: matrícula, alocação, turma, regra, avaliação, disponibilidade, prazo, professor e sua atribuição para o intervalo integral. Para calendário, guardar referência do calendário publicado, versão, fuso institucional e os períodos não letivos afetados em forma canônica, junto da justificativa opcional de exceção.
3. Se o intervalo atingir período não letivo, exigir a justificativa na proposta. A decisão de aprovação oferece autorização explícita da exceção e deve coincidir exatamente com a presença de períodos afetados. Rejeição não autoriza exceção. Mudança de calendário, versão, fuso ou períodos exige nova proposta; histórico sem referência permanece visível e rejeitável, mas não aprovável.
4. Secretaria e gestão podem preparar conforme Q21; outra pessoa da Gerência Pedagógica/Administração aprova a agenda concreta. Essa aprovação revalida hash, prazo integral, situação acadêmica/contratual, saldo, professor ativo e atribuído por todo o intervalo, conflitos, indisponibilidades, reservas comerciais e calendário. Autoaprovação é recusada mesmo com mais de um papel.
5. A aprovação da agenda concreta aplica atomicamente: cria o `EncontroAgenda` exclusivo com finalidade `SEGUNDA_CHAMADA`, reserva a oportunidade e cria a relação de agenda. Reenvio idêntico retorna o mesmo resultado; falha reverte tudo. Rejeição preserva proposta e revisão, sem criar fatos.
6. Manter `criarEncontroSegundaChamada` e `agendarSegundaChamada` fora da interface administrativa quando o fluxo de proposta estiver pronto, ou fazê-los consumidores internos da aplicação atômica. Não permitir que a UI componha criação e reserva como duas confirmações independentes.

## Interface necessária

Depois da disponibilização, a página da segunda chamada mostra **Preparar agenda inicial** antes da reserva. O formulário mostra identificador acadêmico, prazo com fuso, professor pesquisável/designado, início e fim locais com fuso explícito, motivo e evidência. Instantes devem ser enviados de forma explícita, sem converter implicitamente pelo navegador.

A prévia mostra período completo, professor, efeitos que serão aplicados e referências legíveis do calendário. Quando houver período não letivo, ela mostra nomes e datas dos períodos afetados, exige justificativa e, na decisão independente, um controle explícito para autorizar a exceção. Não mostrar identificadores técnicos como substituto da revisão.

O histórico paginado mostra proponente, decisor, datas, motivo, evidência, referência de calendário, justificativa, decisão e encontro/reserva aplicados. Os botões respeitam `podePropor` e `podeDecidir` calculados pelo servidor; a interface não infere autorização a partir de matrícula ativa, papel ou seleção de data.

## Critérios de aceite

- Não existe agenda, reserva ou consumo antes da aprovação independente da agenda concreta.
- A mesma pessoa não prepara e aprova a agenda concreta.
- O fim do encontro não ultrapassa o prazo, e toda a duração passa pelas conferências de professor, conflito e calendário.
- Dia não letivo é revisável e só é aplicado com justificativa e autorização explícita para esse encontro.
- Mudança relevante depois da proposta impede aprovação e não produz aplicação parcial.
- Aprovação cria uma única agenda/reserva; reenvios idênticos não duplicam efeitos.
- A realização posterior continua sendo fluxo docente separado e não cria nota, presença, cobrança ou consumo adicional por inferência.

## Decisões técnicas e trabalho restante

A agenda será proposta depois da disponibilização: sua fonte é `PropostaSegundaChamada`, e não uma reserva inexistente. Proposta, decisão e aplicação devem ser persistidas e rastreáveis. A aprovação cria encontro, reserva e vínculo na mesma transação. O fluxo legado de criação/reserva não pode permanecer como desvio dessa decisão quando o novo fluxo for habilitado.

Reutilizar os helpers de calendário e atribuição integral. Criar proteção SQL contra aplicação direta, autorização implícita de período não letivo, alteração/exclusão de histórico e duplicação concorrente. A interface precisa fornecer nomes/datas dos períodos para revisão, mantendo IDs apenas nas referências internas. Não há nova pergunta de negócio necessária para esses pontos.

O incremento 583 preparou a entrada estrita; o 584 acrescentou serviço, persistência, guards, aplicação e interface. As funções antigas deixaram de ser ações expostas ao cliente. A origem nullable ainda permite o caminho SQL legado; sua transição precisa ser fechada. A Secretaria localiza a fonte autorizada pela fila administrativa do incremento 585, sem acesso às notas. O fechamento SQL e a validação interativa permanecem necessários antes de declarar entrega integral.

## Concorrência com mudança contratual

A decisão deve conferir a situação contratual após obter os bloqueios compartilhados com os fluxos de pausa e retomada. Uma pausa que confirma enquanto a decisão aguarda deve ser considerada antes dos efeitos. Isso também vale para decisões inseridas diretamente no banco. Preservar a ordem compatível de reserva (quando existente), calendário, lead/matrícula e contexto acadêmico, antes dos bloqueios da proposta/fonte. Revalidar o vínculo depois da espera. Uma pausa revertida não deve impedir uma decisão que permaneça válida.

Rejeitar proposta obsoleta não exige contexto válido para aplicação. A rejeição preserva a ordem de reserva/calendário/proposta e os controles de decisão independente, sem criar efeitos de aprovação. [Verificação da concorrência e desse limite](../planejamento/validacao-incremento-590.md).

O histórico administrativo permanece consultável quando o vínculo atual diverge do registrado na proposta. Mostrar a matrícula e a turma originais, sinalizar que o contexto mudou e impedir nova proposta/aprovação nesse histórico. Outra pessoa autorizada pode rejeitar a proposta; essa operação preserva hash, motivo, autoria, papéis vigentes e reenvio idempotente. A consulta não passa a exibir os dados do contrato para o qual a alocação foi alterada.
