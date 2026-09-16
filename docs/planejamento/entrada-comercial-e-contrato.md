# Refinamento — Entrada comercial e documento contratual

**Iniciado em 10/09/2026. Estado:** Q103–Q123 respondidas: A nas questões 103/104/106–123, com complemento de turma disponível em Q103; C em Q105. Q120 atribui responsável próprio à nova negociação de aluno existente, preservando as contratações anteriores. Q121 autoriza desistência conforme avanço formal, com conferência financeira e documental. Q122 define cliente/responsáveis primeiro e escola depois, quando exigida. Q123 mantém preparação pendente de nova reserva após expiração sem avanço formal. Não há pergunta sem resposta neste bloco. Nenhuma opção foi considerada aprovada por estar marcada como recomendada. Complementa o registro Q04–Q102 do [F07](f07-agenda-aulas.md) e a [SPEC da matrícula](../specs/matricula-como-unidade-operacional.md).

## 1. Por que este bloco existe

O usuário pediu detalhar o início da matrícula pelo vendedor e entender a geração do contrato. A decisão de usar matrícula como unidade operacional permanece aprovada. Falta fechar sua origem comercial e o ciclo do documento contratual, sem confundir matrícula criada, contrato gerado, contrato enviado, aceite conferido, pagamento confirmado e matrícula ativa.

## 2. O que existe no código

| Evidência | Comportamento atual |
|---|---|
| [criarMatriculaTx](../../src/server/matricula/acoes.ts) | Salva pessoa nova, matrícula AGUARDANDO, cobranças iniciais, comissão e eventual alocação ativa. Não gera o arquivo de contrato. |
| [Formulário](../../src/app/(app)/matriculas/nova/MatriculaFormulario.tsx) | A etapa chamada “Curso, alocação e contrato” coleta curso/condições; o nome não comprova geração documental. |
| [SecretariaPainel](../../src/app/(app)/secretaria/SecretariaPainel.tsx) e [ações da Secretaria](../../src/server/secretaria/acoes.ts) | Secretaria assume, anexa documento pronto da categoria CONTRATO e registra que conferiu a evidência do aceite, com documento, autor e data. |
| [exigirContratoAceito](../../src/server/matricula/ativacao.ts) | Ativação exige documento contratual vinculado e disponível, confirmação de aceite, autor e data. Não é assinatura eletrônica integrada nem geração de contrato. |
| [Documento histórico do fluxo](../05-fase1-fluxo-matricula.md) | Menciona geração após pagamento e DocuSign. Essas integrações não foram encontradas implementadas; Q105 definiu a taxa prévia à liberação como configuração da oferta e Q106 escolheu serviço de assinatura integrado, sem escolher fornecedor/plano. |

Busca dirigida no código de aplicação, schema e dependências. Não houve teste de ponta a ponta, contratação de provedor ou envio real. Nenhum fornecedor de assinatura foi selecionado por esta revisão.

## 3. Perguntas enviadas

### Q103 — Em que momento a negociação do vendedor deve virar uma matrícula no ERP?

**Estado: respondida — A com complemento, em 10/09/2026.**

**Resposta do usuário:** “A - com atenção de que só é possivel proseguir com a contratação ( que é pagamento da taxa de matricula + assinatura de contrato) se tiver uma turma disponivel que ainda aceita entrada de aluno!”

**Definição incorporada:** quando o cliente decide prosseguir, vendedor registra as condições e cria a matrícula em preparação para a Secretaria completar/conferir. O avanço à contratação — pagamento da taxa e assinatura do contrato — exige turma disponível que ainda aceite a entrada do aluno. A condição não dispensa aceite conferido nem pagamentos exigidos pelo modelo/contrato para ativar; não altera Q100 ou a configuração de primeira mensalidade.

**Consequências para implementação:** demonstrar disponibilidade e admissão na turma correspondente à matrícula antes de liberar esse avanço; não autorizar taxa/assinatura por simples existência de turma no catálogo. Usar os requisitos já aprovados de publicação/professor e integridade de vagas; revalidar a condição nos atos dependentes. No código atual, turmaId é opcional na criação, cobranças nascem mesmo sem turma e a lista de turmas mostra somente ABERTA com início futuro. Esse comportamento não comprova o cumprimento da nova condição.

**Detalhamento posterior:** Q107 definiu a reserva temporária desde a preparação; Q108, sua expiração ou manutenção por pendência; Q109, a data-limite de admissão; Q110, a exceção aprovada para reserva anterior ao limite; Q111, a disponibilidade das particulares por regime da oferta. A resolução humana das reservas protegidas segue Q118. Não presumir prazo numérico ou entrada irrestrita. A ordem entre pagamento e assinatura segue Q105; a escolha de Q103 não resolve essa ordem por mencionar os dois requisitos.

Precisamos separar o interesse comercial da contratação em preparação. Criar a matrícula ainda não significa ativá-la: continuam necessários o aceite contratual conferido pela Secretaria e os pagamentos exigidos confirmados pelo Financeiro.

Esta escolha também deve funcionar quando a pessoa já é aluna e está comprando outro serviço, reutilizando seu cadastro. O momento de cobrar e de reservar uma vaga será tratado separadamente; nenhuma opção autoriza esses efeitos apenas por salvar um rascunho.

- **A — Quando o cliente decidir prosseguir com a contratação (recomendado):** vendedor registra as condições comerciais e cria a matrícula em preparação para a Secretaria completar/conferir. Antes disso, permanece uma negociação.
- **B — Desde a elaboração da proposta:** vendedor cria uma matrícula em rascunho ainda durante a negociação; ela acompanha revisões e pode ser abandonada sem ativação.
- **C — Somente após conferência da Secretaria:** vendedor encaminha a negociação e os dados; a Secretaria confere e cria a matrícula, mantendo a autoria comercial.

### Q104 — Como o documento do contrato deve ser produzido?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — O ERP gera o PDF usando modelos institucionais aprovados, sem edição livre das cláusulas (recomendado).”

**Definição incorporada:** o ERP gera o documento PDF com os dados da matrícula e as condições aprovadas a partir de modelo institucional aprovado; a equipe consulta a prévia sem editar livremente as cláusulas. Identificar a versão do modelo e das condições utilizadas, preservando documentos e condições já aceitos. Gerar PDF não registra assinatura/aceite, não comprova envio e não ativa matrícula.

**Ampliação explícita de escopo:** a geração documental deve ser implementada; o upload atual não a satisfaz. Detalhar modelo/variáveis, publicação, prévia, revisão e alterações, integrando B01 e a Secretaria. Os 14 corpos anteriores precisarão incorporar essa ampliação na organização da entrega. Q104 não escolhe fornecedor ou meio de assinatura; a liberação segue Q105. A guarda de evidência contratual e a conferência pela Secretaria continuam vigentes.

Hoje o ERP recebe um arquivo pronto; não existe geração automática. Precisamos decidir se essa entrega deve preencher o contrato com os dados da matrícula e as condições aprovadas, incluindo modelo mensal ou por hora, valores, cobertura, vencimentos, benefícios e cláusulas aplicáveis.

O documento precisa identificar a versão do modelo e das condições usadas. Uma alteração posterior não pode sobrescrever o contrato que já foi aceito. Esta pergunta trata da produção do documento; o momento de liberar para assinatura está em Q105.

- **A — Gerar PDF no ERP a partir de modelos institucionais aprovados (recomendado):** preencher os dados e condições da matrícula; equipe consulta a prévia, sem editar livremente as cláusulas.
- **B — Gerar um documento editável para revisão externa:** equipe prepara a versão final fora do ERP e a devolve para conferência e registro; alterações precisam ser rastreadas.
- **C — Preparar inteiramente fora do ERP:** continuar anexando o arquivo pronto; o sistema controla vínculo, versão, conferência e aceite, sem gerar o contrato nesta entrega.

### Q105 — Quando o contrato final pode ser liberado ao cliente para assinatura/aceite?

**Estado: respondida — C, em 10/09/2026.**

**Resposta do usuário:** “C — Conforme configuração da oferta: exigir ou dispensar o pagamento prévio da taxa, com a regra registrada na matrícula.”

**Definição incorporada:** cada oferta configura se a liberação do contrato para assinatura/aceite exige a taxa de matrícula previamente regularizada; guardar a regra aplicável à matrícula e conferir seus requisitos antes da liberação. Em ambos os caminhos, Secretaria confere dados/condições, exceções comerciais exigidas estão aprovadas e vale a condição de turma disponível de Q103. Quando exigida a taxa prévia, informe a conferir não satisfaz recebimento. Dispensar pagamento prévio à assinatura não dispensa taxa ou outros pagamentos exigidos para ativar, nem confere aceite automaticamente.

**Integração:** a prévia interna gerada por Q104 continua distinta da versão liberada. Esta configuração de liberação é separada da exigência de primeira mensalidade e do adiantamento da oferta por hora de Q100. Alteração no catálogo não reescreve silenciosamente a regra registrada e os fatos históricos da matrícula; versão liberada, responsável, data e requisitos conferidos precisam ser rastreáveis.

Gerar uma prévia interna é diferente de liberar a versão que o cliente irá aceitar. A documentação antiga previa pagamento antes da geração, mas isso não virou integração funcional; precisamos confirmar a regra desejada agora.

Em todas as opções, os dados e as condições comerciais precisam estar conferidos, com descontos/exceções aprovados quando exigidos. A Secretaria continua responsável pela conferência da evidência de aceite. Liberar o documento não ativa a matrícula. O meio de assinatura será definido no próximo bloco.

- **A — Após conferência da Secretaria, sem exigir pagamento prévio (recomendado):** cliente recebe o contrato para conhecer e aceitar as condições; ativação continua aguardando contrato e pagamentos exigidos.
- **B — Após conferência da Secretaria e regularização da taxa de matrícula:** somente liberar o contrato quando o Financeiro confirmar a taxa nas condições aplicáveis; mensalidade/adiantamento mantém sua regra de ativação.
- **C — Regra configurável por oferta:** definir explicitamente se a liberação exige pagamento prévio da taxa; registrar a regra aplicável na matrícula e impedir liberação sem os requisitos configurados.

### Q106 — Como o cliente deve assinar ou aceitar o contrato gerado pelo ERP?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Serviço de assinatura integrado ao ERP, recebendo o documento assinado e as evidências. Fornecedor e plano serão avaliados depois (recomendado).”

**Definição incorporada:** integrar o ERP a um serviço de assinatura para encaminhar o PDF liberado e receber o documento assinado e as evidências, preservando participantes, versão exata, origem e conferência da Secretaria. Retorno do provedor não ativa a matrícula nem confirma pagamento. Fornecedor e plano serão avaliados depois; esta escolha não contrata serviço, autoriza envio real ou confirma DocuSign como fornecedor.

**Consequências técnicas a detalhar:** relacionar solicitação/retorno ao documento e matrícula corretos; distinguir envio, assinatura pendente, conclusão, recusa, expiração/cancelamento e falha; verificar origem dos retornos e tratar repetição/conciliação sem duplicar solicitações. Os signatários, a liberação, a correção/substituição de documentos e a garantia de vaga seguem os refinamentos correspondentes. A integração não substitui a geração de Q104 nem a conferência contratual já aprovada.

Em qualquer opção, devemos guardar a versão exata aceita, os participantes e as evidências. A Secretaria continua conferindo a evidência antes da ativação. A referência antiga a DocuSign não representa uma integração já pronta nem obriga a escolher esse fornecedor.

- **A — Serviço de assinatura integrado (recomendado):** o ERP encaminha o PDF e recebe o documento assinado e as evidências; fornecedor e plano serão avaliados depois.
- **B — Assinatura fora do ERP:** a equipe envia o PDF por seu processo habitual e anexa o documento assinado e as evidências para conferência.
- **C — Aceite na área autenticada do próprio ERP:** ampliar o portal para apresentar o contrato, colher o aceite e guardar evidências; exige detalhar esse novo fluxo de identificação e confirmação.

### Q107 — Como assegurar a vaga enquanto o cliente paga e assina?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Reserva temporária ao iniciar a matrícula em preparação: a vaga deixa de ser oferecida a outras contratações durante o prazo configurado; Secretaria acompanha (recomendado).”

**Definição incorporada:** reservar temporariamente a vaga ao iniciar a matrícula em preparação, retirando-a da oferta a outras contratações durante o prazo configurado, com acompanhamento da Secretaria. A reserva pertence à matrícula e turma identificadas; não significa matrícula ativa, presença ou alocação acadêmica definitiva. Nenhum prazo numérico foi presumido.

**Consequências técnicas:** criação da preparação e reserva precisam ser coerentes e conferir publicação, professor, capacidade e admissão, conforme Q103/Q44. Proposta técnica: a disponibilidade desconta ocupações e reservas válidas sem contar duas vezes a mesma contratação; pedidos simultâneos pela última vaga não podem ambos reservar. Repetir a mesma operação não reserva novamente. O término do prazo, pagamento/assinatura pendentes e tratamento de desistência não estão resolvidos apenas por criar a reserva; Q108 trata da expiração.

Q103 exige turma disponível que ainda aceite a entrada. Precisamos decidir se uma vaga fica reservada durante a formalização, pois outro aluno pode ocupar a última vaga entre o início e o fim do processo.

Reserva não é matrícula ativa nem presença/alocação acadêmica definitiva. Nas opções com reserva, o prazo será configurável, sem número presumido; o efeito de pagamento/assinatura ou expiração será detalhado depois. Conferir turma, vaga e admissibilidade no momento de reservar ou avançar.

- **A — Reserva temporária ao iniciar a matrícula em preparação (recomendado):** a vaga deixa de ser oferecida a outras contratações durante o prazo configurado; Secretaria acompanha a formalização.
- **B — Reserva temporária após a conferência da Secretaria:** até a conferência há somente interesse; reservar antes de liberar os passos de pagamento/assinatura, se ainda houver vaga.
- **C — Sem reserva antes da ativação:** conferir disponibilidade em cada avanço e ocupar a vaga somente ao ativar; não há garantia de manter a última vaga durante a formalização.

### Q108 — O que fazer quando terminar o prazo da reserva e a matrícula ainda não estiver ativa?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Expirar automaticamente somente se não houver nenhum desses registros. Havendo comprovante em conferência, pagamento confirmado ou assinatura, manter a vaga e abrir pendência para a equipe resolver (recomendado).”

**Definição incorporada:** ao terminar o prazo de reserva de matrícula ainda não ativa, expirar automaticamente somente quando não houver comprovante em conferência, pagamento confirmado nem assinatura registrada nessa contratação. Se existir algum desses registros, manter a vaga reservada e abrir pendência para a equipe resolver. Preservar pagamentos/documentos/histórico; liberação de vaga não representa devolução de dinheiro nem cancelamento de contrato.

**Consequências técnicas:** a contagem de disponibilidade deve continuar descontando reserva mantida por pendência mesmo depois da data-limite original; usar apenas expiresAt maior que agora liberaria a vaga indevidamente. Conferir dados da matrícula correta e revalidar a transição com concorrência/repetição controladas. Uma reserva já mantida por pendência não é liberada apenas porque outro processamento encontra novamente o prazo vencido. A resolução/prorrogação/liberação segue Q118; não presumir estorno ou desistência.

Uma reserva pode vencer sem qualquer avanço ou enquanto já existe comprovante em conferência, pagamento confirmado ou assinatura registrada nessa contratação. Precisamos definir se a vaga é liberada automaticamente ou continua retida para resolução. Preservar pagamentos, documentos e histórico; esta escolha não equivale a devolver dinheiro ou cancelar contrato.

- **A — Liberar automaticamente somente sem avanço formal (recomendado):** se não houver comprovante em conferência, pagamento confirmado nem assinatura registrada nessa contratação, expirar a reserva. Havendo algum desses registros, manter a vaga e abrir pendência para a equipe resolver.
- **B — Liberar todas as reservas vencidas de matrículas não ativas:** mesmo com pagamento ou assinatura, liberar a vaga e abrir pendência para tratar a contratação e os valores/documentos existentes.
- **C — Toda liberação por prazo exige decisão humana:** ao vencer, manter a vaga e encaminhar à gestão, que decide prorrogar ou liberar, inclusive quando não houve pagamento nem assinatura.

### Q109 — Até quando uma turma deve aceitar novos alunos?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Data-limite configurável por turma: permitir entrada dentro dessa janela, inclusive após o início, e bloquear novas admissões depois do limite (recomendado).”

**Definição incorporada:** turma possui data-limite configurável de admissão. Permitir ingresso dentro dessa janela, inclusive depois do início, e bloquear novas admissões depois do limite. Continuam exigidos publicação, professor disponível e capacidade; a entrada não cria presenças ou faltas para encontros anteriores ao vínculo do aluno.

**Consequências técnicas:** a listagem não pode restringir elegibilidade apenas a turma ABERTA com início futuro como faz o código atual; deve considerar turma em andamento que ainda cumpra a janela e os demais requisitos. Mostrar o limite e sua referência temporal, sem deixá-lo mudar pelo fuso de visualização. Revalidar a admissão nos atos dependentes. Reservas em curso quando o limite acabar seguem a exceção independente de Q110, sem liberação automática da vaga protegida de Q108 ou prorrogação geral da janela.

Ter vaga não significa que ainda seja adequado entrar naquela turma. Precisamos definir o critério de admissão de Q103, inclusive a possibilidade de entrada depois do início. Todas as opções mantêm turma publicada, professor disponível, capacidade e reserva válidas; nenhuma entrada cria presença ou falta em aulas anteriores ao vínculo do aluno.

- **A — Data-limite configurável por turma (recomendado):** a equipe registra até quando aceita entrada; pode permitir ingresso após o início dentro dessa janela. ERP bloqueia novas admissões depois do limite.
- **B — Limite configurável de encontros já iniciados:** admitir até a quantidade definida de encontros oficiais não cancelados que já começaram; atraso no diário não prolonga esse limite.
- **C — Somente antes do primeiro encontro:** fechar novas admissões quando começar a primeira aula oficial não cancelada da turma.

### Q110 — Se o limite de admissão terminar durante a formalização, podemos concluir o ingresso de quem já tinha reserva?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Exceção com aprovação pedagógica específica: outra pessoa da Gerência Pedagógica/Administração verifica a viabilidade e aprova com motivo antes do ingresso após o limite (recomendado).”

**Definição incorporada:** uma contratação com reserva feita dentro da janela, ainda válida ou mantida por pendência, pode concluir o ingresso após a data-limite somente mediante aprovação específica de outra pessoa da Gerência Pedagógica/Administração, com conferência de viabilidade e motivo registrado. A turma deve continuar apta a receber o aluno; turma concluída não admite essa exceção. Preservar pagamentos, documentos e histórico; manter a proteção de Q108 enquanto aplicável até a resolução.

**Consequências técnicas:** vincular a exceção à matrícula, reserva e turma corretas, registrando solicitante, aprovador distinto, motivo e condições conferidas. Revalidar permissões, independência, estado da turma, disponibilidade e validade da proposta ao aplicar; mudanças relevantes exigem nova conferência. Aprovação não estende a janela para outros alunos, não autoriza nova reserva fora dela, não cria frequência anterior ao vínculo nem substitui os requisitos contratuais/financeiros de ativação. Bloquear ingresso sem a decisão válida; indeferimento não cancela contrato nem devolve valores automaticamente. Integrar a decisão aos pontos de avanço de Q103/Q105 quando o limite já tiver sido ultrapassado, sem desfazer fatos registrados.

**Pergunta e alternativas apresentadas:**

Exemplo: a vaga foi reservada dentro da janela, mas a confirmação do pagamento ou a assinatura termina depois da data-limite da turma. Q108 pode manter essa vaga reservada por haver avanço formal, mas preservar a vaga não decide sozinho se ainda é adequado iniciar naquela turma.

As opções exigem reserva válida ou mantida por pendência e turma ainda apta a receber o aluno; não autorizam ingresso em turma concluída. Preservar contrato, pagamentos e histórico; eventual mudança de turma ou acerto financeiro segue o fluxo aplicável.

- **A — Exceção com aprovação pedagógica específica (recomendado):** outra pessoa da Gerência Pedagógica/Administração confere a viabilidade e aprova com motivo antes de permitir ingresso após o limite. Até decidir, manter a pendência e a proteção de Q108 quando aplicável.
- **B — Honrar automaticamente a reserva feita dentro da janela:** permitir concluir o ingresso depois do limite se a reserva continuar válida ou protegida e os demais requisitos estiverem cumpridos.
- **C — Não admitir depois do limite, mesmo com reserva anterior:** encaminhar para solução em outra turma/oferta ou acerto aplicável, sem cancelar documentos ou devolver valores automaticamente.

### Q111 — Nas particulares contratadas, quais horários precisam estar garantidos antes de liberar a taxa e a assinatura?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Regra por oferta (recomendado): grade fixa exige reservar os horários recorrentes acordados; agenda flexível exige reservar ao menos o primeiro encontro, com os seguintes sujeitos a novo agendamento.”

**Definição incorporada:** cada oferta de particulares define grade fixa ou agenda flexível, com regime registrado na matrícula e no contrato. Antes de liberar taxa e assinatura, grade fixa exige professor e horários recorrentes acordados reservados; agenda flexível exige professor e ao menos o primeiro encontro reservado. Os encontros seguintes da agenda flexível dependem de novo agendamento e conferência de disponibilidade, sem promessa de horário fixo. Prazo de formalização e manutenção da reserva seguem Q107/Q108. Esta regra atende particulares mensais e por hora e não muda sua cobrança nem autoriza aulas antes da ativação.

**Consequências técnicas:** registrar o regime aplicável e a referência dos horários reservados por matrícula, com professor e intervalos reais. Conferir conflitos com turmas, outras particulares, reservas e indisponibilidades docentes, inclusive em requisições concorrentes, sem duplicar a reserva em uma repetição. A mera disponibilidade genérica do professor não satisfaz a contratação. Revalidar a disponibilidade nos avanços dependentes; alterações de oferta não reescrevem silenciosamente o regime contratado ou as reservas existentes. Preservar a separação entre particular contratada e cota de reposição; a representação técnica da agenda não pode transformar a reserva em aula ministrada ou cobrança por hora realizada.

**Pergunta e alternativas apresentadas:**

Q103 exige disponibilidade antes da contratação. Para particulares mensais ou por hora, precisamos definir o que a escola deve assegurar na agenda antes desse avanço. Esta pergunta trata de particulares contratadas, separadas do benefício de reposição.

Em todas as opções, identificar professor e horários disponíveis, conferir conflitos e indisponibilidades e reservar o que foi acordado; o prazo de formalização e a manutenção da reserva seguem Q107/Q108. O regime deve ficar claro na matrícula e no contrato. Na agenda flexível, os encontros seguintes dependem de novo agendamento; não prometer horário recorrente que não foi reservado. A escolha não muda a cobrança mensal/por hora ou autoriza aulas antes da ativação.

- **A — Regra por oferta (recomendado):** grade fixa exige reservar os horários recorrentes acordados; agenda flexível exige reservar ao menos o primeiro encontro, com os seguintes sujeitos a novo agendamento. Registrar o regime na matrícula e no contrato.
- **B — Sempre grade fixa:** particulares mensais e por hora só avançam com professor e horários recorrentes acordados e reservados.
- **C — Sempre agenda flexível:** reservar professor e primeiro encontro antes da taxa/assinatura; os demais são combinados depois, sem promessa de horário fixo.

### Q112 — Em que momento emitir a cobrança da taxa de matrícula?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Automaticamente após a conferência da Secretaria (recomendado): Secretaria confere dados e condições; cumpridos os requisitos, ERP emite a taxa uma única vez.”

**Definição incorporada:** a conferência dos dados e condições da matrícula em preparação pela Secretaria habilita a emissão automática da taxa, uma única vez, quando dados de cobrança, valores/condições aprovados, disponibilidade e reserva estiverem válidos. A criação da preparação pelo vendedor, sozinha, não emite a taxa. Não acrescentar uma segunda liberação manual do Financeiro para essa emissão; a confirmação do recebimento continua seguindo as permissões e a separação de pessoas aprovadas.

**Consequências técnicas:** persistir a conferência da preparação com autoria, data e versões dos dados/condições; revalidar requisitos ao emitir e tratar repetição, concorrência e retomada após falha sem gerar segunda taxa. Se já existir a taxa dessa contratação, inclusive recebida ou migrada, não emitir outra pelo novo gatilho nem sobrescrever seu histórico. Falta de requisito deixa emissão pendente com causa identificada. Emissão não comprova envio, pagamento, assinatura ou ativação; Q105 continua controlando a liberação do contrato conforme exigência da oferta. A conferência para emitir a taxa não equivale à conferência posterior da evidência de aceite. Primeira mensalidade, adiantamento por hora e comissão conservam suas regras próprias.

**Pergunta e alternativas apresentadas:**

Hoje salvar a matrícula já cria essa cobrança. Precisamos decidir o gatilho desejado no fluxo em preparação. Emitir significa criar a cobrança no Financeiro; envio ao cliente e confirmação do recebimento são etapas distintas.

Em todas as opções, exigir dados suficientes de quem será cobrado, valor e condições aprovados, disponibilidade e reserva válidas conforme Q103/Q107–Q111. Interesse comercial sozinho não gera cobrança. A conferência da Secretaria antes de liberar o contrato continua obrigatória; Q105 define se a assinatura exige taxa previamente confirmada. Emitir a taxa não ativa a matrícula. Esta pergunta não muda a primeira mensalidade, o adiantamento por hora de Q100 ou o momento de reconhecer comissão.

- **A — Automaticamente após a conferência da Secretaria (recomendado):** Secretaria confere dados e condições da preparação; cumpridos os requisitos, ERP emite a taxa uma única vez.
- **B — Financeiro libera após a conferência da Secretaria:** além da conferência administrativa, Financeiro revisa e comanda a emissão da taxa.
- **C — Ao iniciar a matrícula em preparação:** ERP emite a taxa assim que os requisitos estiverem atendidos, sem aguardar a conferência da Secretaria; se faltarem dados ou aprovações, mantém a emissão pendente.

### Q113 — Até onde o vendedor deve preencher os dados antes de encaminhar a matrícula à Secretaria?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Vendedor coleta o básico; Secretaria completa e confere (recomendado): vendedor registra identificação básica, contato e negociação; Secretaria complementa documentos, endereço e dados do responsável financeiro e dos participantes aplicáveis.”

**Definição incorporada:** vendedor registra identificação básica, contato e negociação, com oferta/condições comerciais e disponibilidade/reserva exigidas para a preparação. Secretaria complementa e confere documentos, endereço e dados do responsável financeiro e dos participantes aplicáveis. Cadastro existente deve ser aproveitado sem duplicação ou acesso a outros contratos. Depois que a Secretaria assume, vendedor solicita correções cadastrais; não recupera edição direta desses dados.

**Consequências técnicas:** separar validações e projeções por etapa. A preparação não exige do vendedor todos os campos hoje obrigatórios no schema de criação, mas não pode preencher lacunas com dados fictícios nem liberar taxa/assinatura sem os dados necessários e conferidos. Registrar origem/autoria e pendências de complementação, revalidando no servidor Q112 e os requisitos documentais. Identificação de aluno existente não equivale a autorização para consultar ou alterar sua ficha completa; se a identidade não estiver suficientemente confirmada, encaminhar para conferência em vez de presumir correspondência. A escolha não inclui o formulário externo da alternativa C nem define automaticamente quem assina.

**Pergunta e alternativas apresentadas:**

Oferta escolhida, condições comerciais e turma/grade reservada já fazem parte da preparação. Precisamos dividir a coleta do cadastro pessoal e financeiro. Q112 só permite emitir a taxa depois da conferência da Secretaria, com dados suficientes; o contrato também precisa dos dados exigidos para seus participantes.

Em todas as opções, aproveitar o cadastro de quem já é aluno sem duplicá-lo nem abrir acesso aos outros contratos. Depois que a Secretaria assume, vendedor solicita correções cadastrais, conforme a regra já aprovada. Definir participantes da assinatura continua sendo uma decisão própria; coletar dados de alguém não o torna signatário automaticamente.

- **A — Vendedor coleta o básico; Secretaria completa e confere (recomendado):** vendedor registra identificação básica, contato e negociação; Secretaria complementa documentos, endereço e dados do responsável financeiro e dos participantes aplicáveis.
- **B — Vendedor preenche o cadastro completo:** reúne também documentos, endereço e dados financeiros/contratuais necessários antes do encaminhamento; Secretaria confere e corrige.
- **C — Cliente complementa por formulário seguro:** vendedor registra negociação e identificação inicial; cliente preenche os dados solicitados, e Secretaria confere. Inclui um novo fluxo de formulário na entrega.

### Q114 — Quem poderá preparar, aprovar e publicar os modelos de contrato usados pelo ERP?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Secretaria/Administração prepara; outra pessoa da Administração aprova e publica (recomendado): Secretaria pode organizar a proposta de modelo, mas somente a aprovação administrativa independente libera seu uso.”

**Definição incorporada:** Secretaria ou Administração prepara a proposta de modelo institucional; outra pessoa da Administração confere, aprova e publica a versão para uso. Identificar conteúdo, condições de aplicação, versão, preparador e aprovador. Acúmulo de papéis não permite aprovar a própria preparação. Preservar contratos e versões já utilizados; publicar modelo não altera documentos aceitos nem as condições de matrículas existentes automaticamente.

**Consequências técnicas:** permitir preparação em estado não publicado e impedir seu uso como modelo aprovado da contratação. A publicação deve corresponder ao conteúdo/condições efetivamente revisados, revalidando papel e identidade do aprovador, versão da proposta e repetição/concorrência. Mudança relevante depois da revisão exige nova conferência; edição de versão publicada cria nova proposta, sem sobrescrever a anterior. Aprovar/publicar o modelo não dispensa alçadas comerciais, conferência da matrícula, requisitos financeiros ou verificação de aceite. A escolha não inclui a revisão externa obrigatória da alternativa C nem permite editar livremente cláusulas em uma venda.

**Pergunta e alternativas apresentadas:**

Q104 definiu geração de PDF a partir de modelos institucionais aprovados, sem edição livre das cláusulas em cada venda. Agora precisamos definir quem mantém esses modelos e libera uma nova versão para uso.

Em todas as opções, quem aprova é outra pessoa, mesmo com acúmulo de papéis. Registrar conteúdo, condições de aplicação, versão e aprovação; preservar contratos e versões já utilizados. Esta pergunta define o fluxo interno de publicação, não escolhe o conteúdo das cláusulas nem altera contratos assinados.

- **A — Secretaria/Administração prepara; outra pessoa da Administração aprova e publica (recomendado):** Secretaria pode organizar a proposta de modelo, mas somente a aprovação administrativa independente libera seu uso.
- **B — Somente Administração prepara e publica, com duas pessoas:** uma pessoa da Administração prepara; outra confere, aprova e publica. Secretaria utiliza os modelos aprovados.
- **C — Revisão externa obrigatória antes da publicação interna:** Administração cadastra o modelo e a evidência da revisão externa; outra pessoa da Administração confere, aprova e publica. A escola precisa definir quem realiza essa revisão.

### Q115 — Como o ERP deve definir quem obrigatoriamente assina cada contrato?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Regra por modelo institucional aprovado (recomendado): modelo define papéis obrigatórios e condições de aplicação; Secretaria identifica as pessoas correspondentes, e ERP exige as assinaturas previstas para aquele caso.”

**Definição incorporada:** o modelo institucional aprovado determina os papéis obrigatórios de assinatura e suas condições de aplicação. Secretaria identifica as pessoas correspondentes ao caso da matrícula; ERP exige as assinaturas previstas, vinculadas à versão correta do documento. Identificar aluno/representante, pagador e representante institucional conforme a regra aplicável, sem presumir que todos assinam ou que pagar gera acesso acadêmico. A conferência da Secretaria permanece necessária antes de satisfazer o requisito contratual de ativação; assinatura parcial não equivale à conclusão.

**Consequências técnicas:** versionar as regras de signatários junto ao modelo e registrar o conjunto aplicável ao documento, com papéis, pessoas e representação pertinente. Condição sem dados suficientes ou papel obrigatório sem pessoa identificada gera pendência antes do envio. Conferir retornos do provedor contra documento, processo e participantes esperados, sem aceitar que um evento isolado de assinatura satisfaça todos os obrigatórios. Mudança de modelo/cadastro não troca silenciosamente participantes de processo já enviado. Evidências parciais preservadas continuam relevantes para a proteção da reserva de Q108, mas não dispensam demais assinaturas, conferência ou pagamentos. Não acrescentar a aprovação individual da lista da alternativa C como requisito geral.

**Pergunta e alternativas apresentadas:**

Aluno ou representante legal, responsável financeiro e representante da escola podem ser pessoas diferentes. Q88 também permite empresa pagadora de contratos individuais. Precisamos definir a regra que determina os papéis e as pessoas exigidas em cada processo de assinatura.

Em todas as opções, respeitar o conteúdo e as obrigações do modelo aprovado, identificar os participantes e preservar suas evidências na versão correta. Ser pagador não concede acesso automático a informações acadêmicas, gravações ou conversas. A conferência da Secretaria antes da ativação permanece; assinatura parcial não comprova a conclusão das assinaturas obrigatórias.

- **A — Regra por modelo institucional aprovado (recomendado):** modelo define papéis obrigatórios e condições de aplicação; Secretaria identifica as pessoas correspondentes, e ERP exige as assinaturas previstas para aquele caso.
- **B — Padrão único para todas as matrículas:** exigir aluno ou representante legal, responsável financeiro quando diferente e representante da escola em todos os contratos.
- **C — Lista aprovada por matrícula:** Secretaria propõe os signatários do contrato; outra pessoa da Administração confere e aprova a lista antes do envio, respeitando o modelo.

### Q116 — Quem pode autorizar a substituição de um contrato já enviado, antes de completar as assinaturas?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Secretaria/Administração prepara; outra pessoa da Administração aprova (recomendado): revisão independente autoriza a substituição antes de encerrar a solicitação antiga e liberar a nova versão.”

**Definição incorporada:** Secretaria ou Administração prepara a substituição de documento enviado cujas assinaturas ainda não estão completas; outra pessoa da Administração confere e aprova, com motivo, alterações identificadas, versão substituta conferida e aprovações comerciais aplicáveis. Só depois da autorização pode ser encerrada a solicitação anterior; confirmar esse encerramento no serviço antes de liberar a nova. Resultado incerto fica pendente. Preservar documento original, assinaturas parciais e pagamentos; não transferir assinaturas para a versão nova nem gerar outra taxa automaticamente.

**Consequências técnicas:** vincular proposta/decisão à matrícula, documentos antigo/novo e processo externo corretos, com versões e pessoas distintas. Revalidar requisitos e estado do processo antes da execução. Registrar intenção e resultado de encerramento, conciliar falha/resultado incerto e impedir envio duplicado da substituta. Retorno tardio do processo anterior não comprova aceite do novo documento. Se o processo concluir todas as assinaturas antes de confirmar o encerramento, parar a substituição e encaminhar para o fluxo de contrato totalmente assinado, sem presumir cancelamento. Eventuais ajustes financeiros seguem seus fluxos e aprovações; a substituição não apaga recebimentos, cria nova matrícula, libera reserva protegida ou dispensa condições de Q105/Q115.

**Pergunta e alternativas apresentadas:**

Exemplo: depois do envio, foi identificado um erro de dados ou uma mudança aprovada nas condições; pode já haver alguma assinatura, mas o processo ainda não está completo. Corrigir um rascunho e alterar contrato totalmente assinado são situações diferentes; esta pergunta trata somente da versão enviada ainda em assinatura.

Em todas as opções, registrar motivo, alterações e versão substituta conferida; cumprir as alçadas comerciais aplicáveis. Preservar documento, assinaturas parciais e pagamentos. Confirmar o encerramento da solicitação anterior no serviço antes de liberar a nova; resultado incerto fica pendente para conferência. Assinaturas antigas não são transferidas para o novo documento. Substituição não gera outra taxa nem cancela matrícula/recebimentos automaticamente.

- **A — Secretaria/Administração prepara; outra pessoa da Administração aprova (recomendado):** revisão independente autoriza a substituição antes de encerrar a solicitação antiga e liberar a nova versão.
- **B — Aprovação também delegável à Secretaria:** Secretaria/Administração prepara; outra pessoa da Secretaria com permissão específica, ou da Administração, confere e aprova a substituição.
- **C — Somente Administração conduz, com duas pessoas:** uma pessoa da Administração prepara a substituição; outra confere e aprova. Secretaria registra os dados e a pendência para encaminhamento.

### Q117 — Que documento deve formalizar mudanças nas condições de um contrato já totalmente assinado?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Aditivo vinculado ao contrato original (recomendado): documento identifica as condições alteradas e sua vigência, preservando a referência ao contrato e aos aditivos anteriores.”

**Definição incorporada:** formalizar mudanças nas condições de contrato totalmente assinado por aditivo vinculado ao contrato original e aos aditivos anteriores. Secretaria/Administração prepara; outra pessoa da Administração aprova, além das aprovações comerciais/financeiras aplicáveis. ERP gera o PDF por modelo institucional aprovado, coleta as assinaturas exigidas no serviço integrado e a Secretaria confere. Aplicar novas condições somente com formalização completa e conforme a vigência aprovada. Preservar original, assinaturas e pagamentos; não criar outra matrícula ou taxa automaticamente. Pausa, encerramento e mudanças acadêmicas conservam os fluxos já aprovados.

**Ampliação de escopo e consequências técnicas:** acrescentar modelos/geração e ciclo de aditivos à entrega documental; a escolha não inclui documento consolidado como alternativa automática. Registrar condições anteriores/novas, motivo, vigência, referências ao contrato e aditivos pertinentes, autores, aprovações, documento e evidências. A aprovação interna ou assinatura parcial não torna as novas condições aplicáveis. Revalidar a base da alteração e a coerência com outros aditivos, evitando aplicação duplicada ou sobrescrita por propostas concorrentes. Históricos financeiros não são reescritos pela nova formalização; ajustes seguem seus próprios fluxos aprovados. Reaproveitar Q114/Q115 para modelo/participantes, mantendo a conferência específica da Secretaria.

**Pergunta e alternativas apresentadas:**

Exemplo: escola e cliente combinam uma mudança nas condições contratadas que precisa de nova formalização. O contrato original, suas assinaturas e pagamentos permanecem preservados. Esta pergunta trata do documento dessa alteração; pausa, encerramento e mudanças acadêmicas conservam os fluxos já aprovados.

Proposta comum às opções: Secretaria/Administração prepara a alteração; outra pessoa da Administração aprova, além das aprovações comerciais/financeiras aplicáveis. ERP usa modelo institucional aprovado, gera PDF, coleta as assinaturas exigidas pelo serviço integrado e a Secretaria confere. Aplicar novas condições somente com formalização completa e conforme a vigência aprovada, sem apagar documentos anteriores ou criar outra matrícula/taxa automaticamente. Acrescentar este fluxo ao escopo documental conforme a opção escolhida.

- **A — Aditivo vinculado ao contrato original (recomendado):** gerar documento que identifica as condições alteradas e sua vigência, preservando a referência ao contrato e aos aditivos anteriores.
- **B — Novo documento consolidado:** reunir todas as condições aplicáveis em uma nova versão para assinatura, identificando o documento anterior e a vigência da substituição, com histórico preservado.
- **C — Ambos, conforme tipo de alteração:** configurar no modelo/regra aprovada quando usar aditivo ou documento consolidado; cada proposta identifica a opção aplicável e passa pelo mesmo fluxo de aprovação e assinatura.

### Q118 — Quem poderá decidir prorrogar ou liberar uma reserva mantida por pendência?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Secretaria/Administração propõe; outra pessoa da Administração aprova (recomendado): Administração confere o caso antes de autorizar prorrogação ou liberação.”

**Definição incorporada:** Secretaria/Administração propõe prorrogar ou liberar a reserva mantida por pendência de Q108, registrando motivo, novo prazo quando houver prorrogação e tratamento previsto para contratação/documentos/valores. Outra pessoa da Administração confere, aprova e aplica a decisão da reserva se a proposta continuar válida. Preservar documentos, pagamentos e histórico. A decisão não confirma recebimento, devolve valores, cancela contrato ou dispensa os fluxos correspondentes. Q110 continua necessário para ingresso após o limite.

**Consequências técnicas:** proposta identifica matrícula/reserva, estado e versões conferidos, decisão e responsáveis distintos. Revalidar papel de Administração do aprovador, independência, disponibilidade e coerência dos dados antes da aplicação. Atualizar prazo ou liberar a ocupação uma única vez, com trilha anterior/nova; pendências ou mudanças relevantes impedem aplicação silenciosa de revisão desatualizada. Prorrogar reserva não prorroga a data-limite de admissão; ao vencer o novo prazo, aplicar novamente Q108, sem liberação incondicional. Os efeitos financeiros/contratuais previstos são acompanhados separadamente até sua efetiva resolução, sem simular que ocorreram ao aprovar a reserva.

**Pergunta e alternativas apresentadas:**

Q108 mantém a vaga depois do prazo quando há comprovante em conferência, pagamento confirmado ou assinatura. A equipe precisa resolver a pendência; o simples passar do tempo não libera essa vaga. Esta pergunta define quem prepara e aprova a decisão.

Em todas as opções, a proposta registra motivo, prorrogação com novo prazo ou liberação e o tratamento previsto para a contratação/documentos/valores. Outra pessoa aprova e aplica a decisão de reserva se ela continuar válida. Essa aprovação não confirma pagamento, devolve dinheiro, cancela contrato ou dispensa os fluxos correspondentes. Ingresso após o limite continua exigindo Q110; preservar o histórico e evitar liberar/reservar a mesma vaga duas vezes.

- **A — Secretaria/Administração propõe; outra pessoa da Administração aprova (recomendado):** Administração confere o caso com avanço formal antes de autorizar prorrogação ou liberação.
- **B — Gestão pedagógica também pode aprovar:** Secretaria, Gerência Pedagógica ou Administração propõe; outra pessoa da Gerência Pedagógica/Administração aprova a decisão da reserva, mantendo separados os efeitos financeiros e contratuais.
- **C — Somente Administração conduz, com duas pessoas:** uma pessoa da Administração prepara; outra aprova e aplica. Secretaria acompanha e fornece as informações da pendência.

### Q119 — Quando emitir a primeira mensalidade ou o adiantamento inicial das particulares?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Conforme a exigência para ativar (recomendado): se o pagamento inicial das aulas for exigido, emitir após conferência da Secretaria; se a primeira mensalidade não for exigida para ativar, emiti-la na ativação. Por hora sem adiantamento segue o fechamento mensal.”

**Definição incorporada:** se o pagamento inicial das aulas for requisito de ativação, emitir a cobrança após a conferência da Secretaria, com valores, cobertura/horas, vencimento e disponibilidade/reserva válidos. Na matrícula mensal cuja primeira mensalidade não seja exigida para ativar, emitir essa mensalidade na ativação. Na oferta por hora sem adiantamento contratado, não criar cobrança inicial fictícia; seguir o fechamento mensal Q93. Preservar pagamentos/cobranças existentes sem duplicidade. Taxa, exigências de pagamento e liberação documental mantêm Q112, configuração de ativação/Q100 e Q105.

**Consequências técnicas:** tratar explicitamente os quatro caminhos: mensal com/sem primeira mensalidade exigida, hora com/sem adiantamento exigido. Emissão não confirma pagamento e informe a conferir não satisfaz a exigência. Na mensal sem exigência prévia, ativação não pode bloquear esperando que uma cobrança criada justamente nesse ato já existisse; integrar emissão e ativação de forma consistente e sem duplicidade na repetição. No modelo por hora, remover a dependência de primeira MENSALIDADE e da geração mensal fixa; adiantamento guarda valor/horas contratados e origem da destinação. Dados insuficientes deixam a operação pertinente em conferência; não presumir cobertura, vencimento ou pagamento. Usar os registros anteriores da mesma contratação em vez de recriar obrigação ou recebimento.

**Pergunta e alternativas apresentadas:**

A taxa já segue Q112. Falta definir quando criar a cobrança inicial das aulas. Exigir o pagamento para ativar é diferente de decidir quando a cobrança aparece no Financeiro. A primeira mensalidade pode ser exigida ou dispensada como requisito de ativação; particulares por hora seguem a configuração de adiantamento de Q100.

Em todas as opções, valores, cobertura ou horas e vencimento precisam estar definidos e conferidos, com disponibilidade/reserva válidas. Não duplicar cobranças ou recebimentos existentes. Por hora sem adiantamento contratado segue o fechamento de Q93, sem mensalidade fictícia. A decisão não muda os pagamentos exigidos para ativar nem a regra de liberação do contrato Q105.

- **A — Conforme a exigência para ativar (recomendado):** se o pagamento inicial das aulas for exigido, emitir após a conferência da Secretaria; se a primeira mensalidade não for exigida para ativar, emiti-la na ativação. Por hora sem adiantamento segue o fechamento mensal.
- **B — Junto da taxa após a conferência da Secretaria:** emitir os valores iniciais contratados nesse momento, mesmo quando o pagamento da primeira mensalidade não for exigido para ativar.
- **C — Após o aceite contratual conferido:** emitir os valores iniciais contratados quando a Secretaria confirmar o aceite; pagamentos exigidos ainda precisam ser confirmados antes da ativação.

### Q120 — Quem será responsável comercial por uma nova contratação de quem já é aluno?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Responsável próprio da nova negociação (recomendado): vendedor que inicia e conduz a nova venda é registrado como responsável ao abri-la; não precisa ser o vendedor anterior. Mudança posterior segue transferência autorizada.”

**Definição incorporada:** a nova contratação de aluno existente possui negociação e matrícula próprias, reutilizando o cadastro. Registrar ao abrir a negociação o vendedor que inicia/conduz essa nova venda como seu responsável, mesmo se diferente do vendedor anterior. Mudanças posteriores seguem transferência autorizada; cobertura temporária não troca automaticamente o titular. Preservar autoria e comissões anteriores; comissão da nova contratação segue a política aplicável. A nova responsabilidade não concede acesso aos dados administrativos/financeiros dos demais contratos.

**Consequências técnicas:** a identidade e o responsável da negociação pertencem à oportunidade correspondente, sem impor um único vendedor global para todas as matrículas do aluno. Separar origem/autoria, responsável atual e beneficiário da comissão conforme a regra pertinente; não usar automaticamente o operador da Secretaria que formalizou a matrícula como vendedor. Repetir a conversão da mesma negociação não cria outra matrícula, e nova oportunidade não pode servir para tomar uma negociação existente sem transferência autorizada. Reutilizar identidade confirmada com projeções restritas, sem sobrescrever cadastro administrativo já conferido. A modelagem atual que une Lead a uma única matrícula e cria nova pessoa em cada contratação precisa ser adaptada; decidir a representação técnica final preservando essas relações, sem simplesmente remover a proteção contra conversão duplicada.

**Pergunta e alternativas apresentadas:**

Exemplo: alguém já cursa inglês mensal e procura outro vendedor para contratar particulares. A nova contratação terá negociação e matrícula próprias, aproveitando o cadastro do aluno. Precisamos definir quem fica responsável por essa nova venda, sem transferir as anteriores.

Em todas as opções, registrar responsável e origem da nova negociação, preservar comissões/autoria anteriores e manter as regras de transferência e cobertura temporária. Cobertura não troca o titular automaticamente. A comissão da nova contratação segue a política aplicável; ser responsável pela nova venda não abre os dados administrativos/financeiros dos outros contratos. Não presumir comissão sobre todas as mensalidades nem divisão entre vendedores.

- **A — Responsável próprio da nova negociação (recomendado):** vendedor que inicia e conduz a nova venda é registrado como responsável ao abri-la; não precisa ser o vendedor da contratação anterior. Mudança posterior segue transferência autorizada.
- **B — Vendedor da matrícula de origem:** identificar qual contratação originou a nova procura e encaminhar ao seu vendedor; se ele estiver indisponível, Gerência Comercial redistribui.
- **C — Gerência Comercial designa em cada caso:** nova oportunidade de aluno existente entra para distribuição pela gestão antes de atribuir a responsabilidade comercial.

### Q121 — Como autorizar a desistência de uma matrícula ainda em preparação?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Fluxo conforme o avanço (recomendado): sem comprovante em conferência, pagamento ou assinatura, Secretaria efetiva com os demais requisitos atendidos; havendo algum desses registros, Secretaria/Administração propõe e outra pessoa da Administração aprova.”

**Definição incorporada:** a desistência antes da ativação exige pedido/motivo e histórico da matrícula correspondente. Sem comprovante em conferência, pagamento confirmado ou assinatura dessa contratação, Secretaria pode efetivar com os demais requisitos atendidos. Havendo qualquer desses registros, Secretaria/Administração prepara e outra pessoa da Administração aprova. Conferir cobranças/valores e, quando necessário, preparar acerto pelo Financeiro com aprovação de outra pessoa autorizada antes da efetivação; não presumir retenção ou devolução. Solicitação de assinatura aberta exige encerramento confirmado no serviço; resultado incerto mantém a desistência pendente. Liberar a reserva conforme a decisão válida e preservar documentos, recebimentos e os demais contratos do aluno. Devolução efetiva segue operação separada.

**Consequências técnicas:** revalidar no servidor o avanço formal e as versões antes de efetivar; um comprovante, pagamento ou assinatura registrado durante a análise impede continuar pela execução direta e exige a aprovação administrativa aplicável. Vincular pedido, decisões, acerto e resultado externo à matrícula exata. Confirmação de encerramento da solicitação externa não apaga assinatura já concluída nem comprova extinção do contrato; se houver conclusão concorrente, preservar o resultado e conferir o tratamento documental/financeiro antes de efetivar. Repetição não libera a mesma vaga duas vezes nem duplica ajustes. Não ativar a matrícula apenas para desistir dela nem encerrar globalmente o cadastro do aluno.

**Pergunta e alternativas apresentadas:**

O cliente pode desistir antes da ativação. Precisamos distinguir uma preparação sem avanço formal de outra com comprovante em conferência, pagamento confirmado ou assinatura dessa contratação. Os demais contratos do aluno permanecem preservados.

Em todas as opções, registrar pedido/motivo e histórico; cobranças/valores exigem conferência e, quando necessário, acerto preparado pelo Financeiro e aprovado por outra pessoa autorizada antes da efetivação. Não presumir retenção ou devolução de valores. Devolução efetiva continua sendo uma operação registrada separadamente. Se houver solicitação de assinatura aberta, confirmar seu encerramento no serviço; resultado incerto mantém a desistência pendente. Liberar a reserva de forma coerente com a decisão válida, sem apagar documentos ou recebimentos.

- **A — Fluxo conforme o avanço (recomendado):** sem comprovante em conferência, pagamento ou assinatura, Secretaria efetiva a desistência com os demais requisitos atendidos; havendo algum desses registros, Secretaria/Administração propõe e outra pessoa da Administração aprova.
- **B — Aprovação administrativa em todos os casos:** Secretaria/Administração propõe; outra pessoa da Administração aprova, mesmo quando não houve comprovante, pagamento ou assinatura.
- **C — Vendedor pode encerrar a preparação inicial:** permitir ao vendedor efetivar desistência da própria matrícula ainda não assumida pela Secretaria e sem avanço formal; os demais casos seguem o fluxo da opção A.

### Q122 — Em que ordem os participantes devem receber o contrato para assinatura?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Cliente/responsáveis primeiro; escola por último (recomendado): participantes exigidos do lado do cliente recebem juntos; após essas assinaturas, encaminhar ao representante da escola, quando exigido.”

**Definição incorporada:** participantes obrigatórios do lado do cliente recebem o documento em paralelo na primeira etapa. Somente depois de concluídas essas assinaturas, encaminhar ao representante da escola quando exigido pelo modelo aprovado. A sequência também vale para aditivos que exigirem assinatura; não acrescenta signatário que o modelo não exija, não assina automaticamente pela escola e não dispensa a conferência da Secretaria nem os requisitos de reserva, pagamento e ativação.

**Consequências técnicas:** registrar participantes, etapas, documento e versão exatos no processo. Antes de liberar a etapa da escola, conferir a conclusão de todos os participantes exigidos na etapa do cliente; retorno parcial, repetido ou de outro documento não a libera. Quando a escola não for signatária obrigatória, não criar etapa vazia que impeça concluir as assinaturas exigidas. Conclusão do serviço ainda depende de conferência da Secretaria para satisfazer o aceite. A avaliação do fornecedor deverá comprovar esse comportamento, sem prometer compatibilidade antes da validação. Q122 não aprovou ordem livre por venda/modelo.

**Pergunta e alternativas apresentadas:**

Q115 já define os participantes obrigatórios pelo modelo aprovado, identificados pela Secretaria. Falta decidir se eles recebem o documento ao mesmo tempo ou em etapas. Esta ordem também se aplica aos aditivos que exigirem assinatura.

Nas três opções, exigir todas as assinaturas previstas no documento correto e a conferência da Secretaria. Só incluir representante da escola quando o modelo exigir; não assinar automaticamente em seu nome. A ordem não altera pagamentos, reserva ou requisitos de ativação. Registrar a sequência efetivamente usada; capacidade do fornecedor será conferida na avaliação da integração.

- **A — Cliente/responsáveis primeiro; escola por último (recomendado):** participantes exigidos do lado do cliente recebem juntos; concluídas essas assinaturas, encaminhar ao representante da escola, quando exigido pelo modelo.
- **B — Todos em paralelo:** encaminhar aos participantes obrigatórios ao mesmo tempo; aguardar a conclusão de todos antes da conferência final.
- **C — Ordem configurável por modelo aprovado:** o modelo define etapas e quem assina em paralelo em cada uma; preservar essa regra no processo enviado.

### Q123 — Como continuar uma contratação cuja reserva expirou sem avanço formal?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Manter a preparação pendente de nova reserva (recomendado): equipe pode retomar a mesma matrícula quando houver disponibilidade, conferindo novamente dados, condições e requisitos antes de liberar cobrança/assinatura.”

**Definição incorporada:** após expiração da reserva sem comprovante em conferência, pagamento confirmado ou assinatura, manter a mesma matrícula em preparação, pendente de nova reserva. Bloquear avanço sem disponibilidade e encerrar solicitação de assinatura ainda aberta, conferindo o resultado no serviço. Preservar documentos e cobranças; ajustes financeiros seguem seus fluxos. Ao retomar, conferir disponibilidade, dados, condições e requisitos atuais; não recriar identidade, matrícula, taxa ou recebimento apenas por renovar a tentativa. Pagamento ou assinatura concorrente gera pendência para conferência, sem presumir vaga, ativação ou devolução.

**Consequências técnicas:** matrícula em preparação não significa reserva válida. Registrar expiração e cada nova tentativa de reserva, descontando capacidade somente pelo estado válido correspondente. Novas liberações documentais exigem resultado confirmado do encerramento anterior, requisitos atuais e documento/versão conferidos; não reutilizar solicitação antiga encerrada. Revalidar Q108 antes de liberar a vaga: fato formal já registrado impede expiração automática. Fato recebido depois da liberação não toma a vaga já ocupada por outra contratação; encaminhar à conferência. Retomar esta preparação não é retomada de matrícula pausada de D13/Q66.

**Pergunta e alternativas apresentadas:**

Q108 libera a vaga quando não há comprovante em conferência, pagamento confirmado ou assinatura, mas podem existir taxa emitida e solicitação de assinatura enviada sem assinaturas. Nas três opções, bloquear avanços sem disponibilidade, encerrar solicitação aberta com resultado conferido e preservar documentos/cobranças. Ajustes financeiros seguem fluxo próprio; fatos formais concorrentes exigem conferência.

- **A — Manter a preparação pendente de nova reserva (recomendado):** equipe pode retomar a mesma matrícula quando houver disponibilidade, conferindo novamente dados, condições e requisitos antes de liberar cobrança/assinatura.
- **B — Exigir revisão da Secretaria antes de retomar:** manter a preparação pendente; Secretaria confere o caso e autoriza uma nova tentativa de reserva, com os demais requisitos aplicáveis.
- **C — Encerrar a preparação pelo fluxo de desistência:** Secretaria trata conforme Q121; uma nova tentativa comercial exige nova preparação, vinculada ao histórico anterior e sem duplicar o cadastro do aluno.

## 4. Situação do bloco e trabalho restante

Q103–Q123 foram respondidas e incorporadas às SPECs. Não há pergunta sem resposta neste registro. Isso fecha as escolhas apresentadas para esta jornada, sem declarar concluída a revisão técnica ou a implementação do projeto inteiro.

Trabalho técnico necessário antes de implementar os caminhos dependentes:

- Detalhar campos mínimos por etapa e tratamento de cliente já cadastrado; divisão vendedor/Secretaria já aprovada em Q113, sem duplicação ou acesso amplo a outros contratos.
- Integrar identidade/autoria da negociação e comissão à responsabilidade da nova venda definida em Q120, preservando acesso e contratos anteriores.
- Integrar desistência antes da ativação conforme Q121: autorização pelo avanço formal, acerto quando necessário e encerramento confirmado de solicitação de assinatura aberta. Emissão da taxa e dos primeiros valores das aulas já seguem Q112/Q119.
- Integrar resolução das reservas protegidas Q118 aos efeitos contratuais/financeiros aplicáveis. Reserva, expiração, admissão e disponibilidade das particulares seguem Q107–Q111; não reabrir essas decisões.
- Mapear campos exigidos nos modelos contratuais/aditivos e nas etapas da jornada. Governança, signatários, substituição durante assinatura e aditivos já seguem Q114–Q117.
- Detalhar integração de assinatura Q106: parâmetros, evidências, liberação e comunicação ao destinatário autorizado; sequência cliente/responsáveis primeiro e escola depois segue Q122. Convite do portal de reposições não é automaticamente um fluxo de assinatura pré-matrícula.

Insumos e escolhas operacionais adiados: conteúdo real/idiomas dos contratos e aditivos; fornecedor/plano e contas do serviço de assinatura; parâmetros configuráveis da escola e dados reais de migração. Podem ser preparados em paralelo, mas as etapas que deles dependem não podem ser homologadas sem sua conferência. Não inventar textos, prazos, credenciais ou capacidades do fornecedor para encerrar a especificação.

Se a revisão técnica revelar uma decisão de negócio ainda não coberta, registrar a lacuna concreta e submetê-la à escolha do usuário; detalhes de implementação que preservem as regras aprovadas não exigem reabrir perguntas já respondidas.

## 5. Atualização da SPEC

O [complemento dos corpos de entrega](corpos-entrada-comercial-contrato.md) organiza COM01 (jornada comercial), DCT01 (modelos/PDF), DCT02 (assinatura) e DCT03 (aditivos). São quatro propostas adicionais aos 14 corpos anteriores, com fronteiras e critérios para revisão antes de criar issues; a organização não altera as escolhas de negócio.

A [SPEC do documento contratual](../specs/documento-contratual.md) detalha geração/liberação de Q104/Q105, assinatura integrada de Q106, governança Q114, signatários Q115, substituição durante assinatura Q116, aditivos Q117, desistência Q121 e sequência Q122, com etapas, relações, operações propostas e critérios DOC-01–DOC-19. Parâmetros dos modelos e detalhes da integração ainda em refinamento; nenhum critério foi declarado executado.

Cada resposta deve manter seu ID, texto escolhido e complementos. Atualizar estados, requisitos, permissões, critérios e dependências da SPEC correspondente; registrar expansões de escopo, especialmente geração documental e integração de assinatura, se escolhidas. D01–D14 e Q04–Q102 permanecem vigentes salvo mudança explicitamente aprovada.

Esta etapa não cria issues, gera contrato real, ativa matrícula, cobra, envia mensagens ou modifica código.
