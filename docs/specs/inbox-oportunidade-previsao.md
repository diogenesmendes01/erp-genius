# Inbox — probabilidade e previsão de fechamento (#341, D13)

A oportunidade comercial pode guardar uma probabilidade manual inteira entre 0 e 100 e uma previsão de fechamento como data civil YYYY-MM-DD. Ambos os campos são opcionais; registros antigos ficam null. Zero aparece como 0%, sem se confundir com ausência. Não existe regra de data futura. O calendário usa DataCivilSchema e a apresentação usa formatarDataCivil, sem converter a data por fuso.

A leitura segue a oportunidade atual autorizada do painel. Convite vigente de Professor permite leitura contextual, mas não edição. A edição exige os papéis comerciais já usados pelo ERP (Administrador, Gerente Comercial ou Vendedor) e escopoComercialAtual na mesma conexão. Leitura por convite não substitui carteira ou papel. Não há permissão global nova nem exigência nova de Assumir ou envio.

O painel oferece Editar previsão somente quando a capacidade específica do DTO permite. O formulário preserva campo físico e rascunho em refresh irrelevante; cancelar não chama action. Falha ou transporte incerto conserva a edição e não repete automaticamente. ACK de outro atendimento ou abertura, ou após revogação, não fecha a edição nem atualiza outro alvo.

O setter recebe atendimento, oportunidade esperada, valores anteriores e somente os campos alterados. A oportunidade real deriva do atendimento; o ID recebido serve apenas de comparação. Omissão preserva, null limpa. Valor desejado já presente é reconciliação sem novo Evento ou aviso; alteração concorrente para outro valor recusa sem sobrescrever. O CAS por valores não promete detectar toda sequência ABA de valores.

A transação trava Atendimento FOR NO KEY UPDATE e Lead FOR UPDATE NOWAIT, antecipa a FK do autor e relê ator, ativo, apenasPortal, papéis, ACL e carteira depois das esperas. Cada lock precisa retornar a linha efetivamente travada. O erro 55P03 é convertido somente fora da transação abortada para recusa humana, com atualização do painel e nova tentativa manual. Não há retry automático ou catch de 40P01. UPDATE, LeadEditado com antes/depois fechado e aviso de IDs são atômicos. Carteira, etapa e régua não mudam.

EditarLeadSchema é uma extensão separada. LeadSchema, CriarLeadSchema e criarLead conservam o contrato anterior. editarLead preserva os campos novos omitidos e aceita null para limpar. O payload histórico nome/temperatura e seus efeitos inclusive no-op permanecem; acrescenta previsoes somente quando houve mudança nesses campos. A ordem global conserva Lead → Matricula e antecipa País de destino/autor KEY SHARE antes da última conferência fresca. País ausente recusa antes do UPDATE; o DDI usa a mesma TX. Não se promete linearizabilidade geral contra mudanças de ACL posteriores à última conferência.

O ROOT reservou 20261025202000_inbox_oportunidade_previsao_probabilidade (495 lógica): dois campos nullable e CHECK do percentual, sem default, backfill ou upsert. O timestamp histórico do plano não é usado. Migração, client e aplicação pertencem ao integrador.

A probabilidade manual é independente de chanceFechar dos Insights. Não se ampliam prompt, campos ATUALIZAR_CAMPO da Aria ou contratos de #357/#358/#377. Não há API externa.

Estado: WIP. Infraestrutura lógica495 preparada pelo ROOT somente no banco A; 19 nativos do DEV passaram na fonte 997 (quatro arquivos completos, terminais 0); guardas, TypeScript/global, QA independente e visual pendentes. Não homologada.