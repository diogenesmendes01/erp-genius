# SPEC-ERP-001 — Operação educacional, acesso e integrações

Este documento define o comportamento requerido. A existência de um requisito aqui não comprova sua implementação. O objetivo integral permanece em andamento.

- [Detalhamento da remarcação de segunda chamada — implementação parcial](remarcacao-segunda-chamada.md).
- [Substituição docente de segunda chamada agendada — implementação e limites](substituicao-segunda-chamada.md).
- [Avisos internos de pendências do diário — Q22](avisos-pendencias-diario.md).
- [Desistência durante a preparação — Q121, implementação parcial](desistencia-preparacao.md).
- [Situação e evidências de implementação](../41-situacao-consolidada-do-projeto.md).
- [Verificação abrangente 574](../planejamento/validacao-incremento-574.md).
- [Histórico preservado da abertura, até o incremento 573](../planejamento/historico-abertura-spec-erp-ate-573.md).

## 1. Objetivo e alcance

**Atualização 366:** implementadas proposta/decisão independente e tela de oportunidades extras de recuperação, com aplicação do limite por matrícula/nível/habilidade e proteção de reservas no banco. [Validação e limites](../planejamento/validacao-incremento-366.md). Segunda chamada, homologação e integração da progressão continuam pendentes.

**Atualização 365:** acompanhamento identifica habilidades de planos aprovados sem tentativa reservada/realizada; disponibilização ou cancelamento não presume execução. [Evidências](../planejamento/validacao-incremento-365.md). Não substitui fechamento acadêmico ou resolução formal dos planos.

**Atualização 364:** consulta e tela do acompanhamento incluem pendências operacionais de correções e recuperação no vínculo autorizado. [Validação](../planejamento/validacao-incremento-364.md). Não é confirmação do fechamento de Q154 nem autorização de progressão.

**Atualização 363:** o acompanhamento acadêmico identifica recuperações já realizadas sem nota, mantendo a pendência e a média oficial. A comparação da base do plano foi separada para preservar a execução autorizada por etapas. [Evidências](../planejamento/validacao-incremento-363.md). Não constitui fechamento de Q154.

Implementar a operação aprovada para uma escola de idiomas inicialmente online: contratos mensais e particulares por hora, agenda institucional, diário, reposições, cobrança, comunicação e área autenticada de reposições. A matrícula identifica cada contratação operacional, permitindo que um aluno mantenha serviços independentes.

Esta SPEC reúne o contrato de comportamento e as interfaces entre as entregas. Os critérios e recortes dos [14 corpos originais](../planejamento/revisao-integracao-corpos-entregas.md) e dos [quatro corpos comerciais/documentais](../planejamento/corpos-entrada-comercial-contrato.md) fazem parte dela por referência: 18 propostas de entrega para revisão antes das issues. Os registros de [F07](../planejamento/f07-agenda-aulas.md) e da [entrada comercial](../planejamento/entrada-comercial-e-contrato.md) preservam respostas, justificativas e alternativas não escolhidas. Uma alternativa histórica não é requisito.

As políticas de acesso e os fluxos D01–D14 são a base a preservar e adaptar. ERP/CRM/WhatsApp completos, todas as frentes F01–F20, avaliações fora do recorte aprovado em Q124, certificados, remuneração docente, contas a pagar, fiscal, salas/unidades presenciais e portal empresarial não passam a integrar esta entrega. A área do aluno cobre reposições e o acompanhamento acadêmico oficial aprovado em Q143: avaliações por habilidade, comentários destinados ao aluno, frequência e consolidado com pendências. Não inclui o portal de responsáveis (Q145), aplicação de provas dentro do ERP (Q139) ou acesso comercial amplo.

## 2. Fontes, precedência e evidência

**Bloco comercial com respostas consolidadas:** [entrada comercial e documento contratual](../planejamento/entrada-comercial-e-contrato.md). Q103–Q123 estão respondidas e rastreadas na seção 11: origem pelo vendedor, cadastro pela Secretaria, reservas/admissão, cobrança inicial, modelos, assinatura, substituição e aditivos. Q120 define responsável próprio da nova negociação de aluno existente, com contratos e comissões anteriores preservados. Q121 define desistência conforme o avanço formal e os requisitos financeiros/documentais. Q122 define assinatura do cliente/responsáveis primeiro e da escola depois quando exigida. Não há pergunta sem resposta em Q103–Q123. Q123 mantém a preparação após expiração sem avanço formal, com nova conferência/reserva e encerramento da assinatura aberta. A aprovação de requisitos não comprova implementação.

A geração de PDF por modelo aprovado, a assinatura integrada de Q104–Q106 e os aditivos de Q117 ampliam os corpos anteriores e seguem a [SPEC documental](documento-contratual.md). Fornecedor/plano serão avaliados depois. A regra de taxa prévia à assinatura é configurada por oferta, sem dispensar requisitos de ativação. Referências históricas a DocuSign não comprovam integração ou escolha atual de fornecedor.

| Fonte | Uso nesta SPEC |
|---|---|
| [Detalhamento operacional do acesso](../37-detalhamento-operacional-do-acesso.md) | Decisões D01–D09, escopos e projeções de campos; descrições de código nesse documento são históricas |
| [Implementação de acesso](../38-implementacao-acesso-validacao.md) | D10–D12 e evidências limitadas das entregas anteriores |
| [Retomada aprovada](../39-retomada-com-aprovacao.md) | D13; adaptar seleção por matrícula, cobertura e modelos comerciais posteriores |
| [Mudanças acadêmicas](../40-mudancas-academicas-com-aprovacao.md) | D14; preservar pedido, parecer/dispensa, aprovação e execução pela Secretaria |
| [Refinamento F07](../planejamento/f07-agenda-aulas.md) | Decisões iniciais do calendário e Q04–Q102; Q84/Q85 tratam de dados e preparação operacional |
| [Revisão de integração](../planejamento/revisao-integracao-corpos-entregas.md) | Evidências dirigidas de código, 14 corpos, limites e aceite por entrega |
| [Corpos comerciais/documentais](../planejamento/corpos-entrada-comercial-contrato.md) | COM01 e DCT01–DCT03: preparação, reserva, PDF, assinatura e aditivos, com fronteiras, dependências e aceite de Q103–Q123 |
| [Progressão acadêmica em refinamento](../planejamento/progressao-academica.md) e [SPEC acadêmica](avaliacao-por-habilidades.md) | Q124–Q154 definem habilidades, notas, etapas, pesos, mínimos, frequência e recuperação com melhor resultado. Q134 define limite por habilidade; Q135 define proposta docente/gestão e aprovação independente; Q136 define prazo a partir da disponibilização; Q137 define consumo de tentativas; Q138 veda exceções de nota; Q139 limita a entrega ao registro de avaliações externas; Q140 define publicação independente pela gestão; Q141 preserva regras de turmas em andamento; Q142 exige conferência independente por avaliação; Q143 libera acompanhamento oficial ao aluno; Q144 exige correção com aprovação independente; Q145 mantém atendimento dos responsáveis pela equipe; Q146 define segunda chamada separada; Q147 limita segunda chamada por avaliação; Q148 define consumo de segunda chamada; Q149 define prazo da segunda chamada; Q150 autoriza extras com aprovação independente; Q151 define pausa/encerramento; Q152 define designação docente limitada; Q153 define equivalência aprovada; Q154 define fechamento pela gestão; revisão técnica e corpo adicional pendentes; corpo adicional em refinamento. |
| [SPEC da matrícula](matricula-como-unidade-operacional.md) | Detalhamento da base de identidade, vínculos, operações e isolamento de Q102 |
| [SPEC do documento contratual](documento-contratual.md) | Geração/liberação/assinatura integrada de Q104–Q106, governança Q114, signatários Q115, substituição Q116, aditivos Q117, desistência Q121 e sequência Q122; conteúdo/parâmetros e detalhes técnicos da integração pendentes |
| [Situação do projeto](../41-situacao-consolidada-do-projeto.md) | O que foi entregue, o que falta e limites da validação; não substitui evidência executada |

Precedência: decisão explícita mais recente do usuário; requisito correspondente nesta SPEC e fontes incorporadas; proposta técnica compatível. O schema e o código demonstram a implementação existente, não anulam um requisito aprovado ainda ausente. Divergência deve ser registrada e corrigida na entrega responsável. Revisões técnicas não podem criar uma política de negócio por omissão.

**Pendência documental encontrada em 10/09/2026:** há referências antigas a `docs/36-politica-de-acesso-aprovada.md`, mas o arquivo não foi localizado neste worktree nem no checkout principal consultado. Não foi tratado como fonte lida ou restaurado por suposição. As regras consolidadas aqui usam os documentos disponíveis acima e as decisões da conversa. Recuperar o original ou registrar uma reconstrução com sua proveniência antes de declarar a cadeia documental integralmente recuperada; isso não reabre Q102.

## 3. Modelo operacional e invariantes

| ID | Requisito obrigatório |
|---|---|
| INV-01 | Aluno é identidade e cadastro; matrícula é a referência do serviço contratado, situação operacional, condições e direitos. Selecionar um aluno não seleciona implicitamente todos os seus contratos. |
| INV-02 | Alocação/participação identifica a matrícula correta e sua vigência. Dois contratos independentes podem coexistir. Não escolher a primeira matrícula ativa nem manter unicidade global de alocação por aluno. |
| INV-03 | Turma, encontro coletivo, calendário, professor e gravação podem ser compartilhados. Elegibilidade e autorização de cada participante passam pela matrícula e pelo vínculo adequado; não duplicar a aula por aluno. |
| INV-04 | Pausa, retomada, encerramento e restrição de um contrato preservam os demais. Outro contrato ativo não concede acesso ao conteúdo daquele pausado, encerrado ou restrito. |
| INV-05 | Estado da matrícula, andamento da turma, conclusão da aula, frequência, ocorrência financeira e disponibilidade do material são estados distintos. Nenhum é inferido automaticamente do outro sem regra aprovada. |
| INV-06 | Recebimento original, destinação, dívida, crédito, compensação por serviço e devolução são fatos distintos. Manter titular, origem, moeda, valores e rastreabilidade; não duplicar dinheiro nem inventar recebimento. |
| INV-07 | Aprovação independente exige outra pessoa autorizada, mesmo quando alguém acumula papéis. Aprovação vale para o conjunto, versão e impactos revisados. |
| INV-08 | Datas efetivas, autoria e histórico permanecem preservados. Demora interna não desloca o encerramento aprovado nem aumenta o período cobrado. |
| INV-09 | Repetição, concorrência ou reprocessamento não duplicam cobrança, encontro, consumo de benefício, crédito, devolução ou aviso lógico. |
| INV-10 | Parâmetro contratual incompleto impede a operação que depende dele, com indicação do que falta. Não inventar percentuais, prazos, evidências ou histórico para liberar a operação. |

## 4. Acesso: ação, registro, campo e condição

Toda entrada no servidor resolve identidade atual, ação/capacidade, escopo do objeto, campos permitidos e condições da operação. Aplicar também a consultas, detalhes por ID, exportações, anexos, notificações, reprodução e trabalhos executados depois. Esconder um botão ou campo não cumpre a regra.

| Contexto | Acesso permitido e limite |
|---|---|
| Comercial | Carteira individual, equipe do gerente ou cobertura temporária expressa. Transferência revoga o acesso anterior quando não houver outro vínculo válido; preserva autoria e comissão histórica. Após assunção pela Secretaria, solicita correção cadastral/documental. |
| Secretaria | Cadastro, contrato e operação acadêmica autorizados; consulta financeira individual necessária ao atendimento. Informa comprovante, sem confirmar o próprio informe ou receber poderes de caixa por possuir o papel. |
| Professor | Encontros, alunos, pareceres e reposições atribuídos. Canal institucional, sem telefone/e-mail pessoal, documentos administrativos ou extrato financeiro. Histórico das próprias aulas em leitura ao sair. |
| Gerência Pedagógica | Organização, aprovação independente e acompanhamento acadêmico; recebe estado operacional necessário, sem extrato financeiro ou motivo de dívida por herança. |
| Financeiro | Cobranças, pagadores, evidências e ajustes pertinentes. Aprovar e executar devolução são capacidades específicas; conferência de pagamentos mantém separação de pessoas. |
| Administração | Configurações sensíveis e concessões; substituições de aprovação previstas. Não dispensa autoria independente, versão válida, evidência ou integridade. |
| Aluno | Próprias reposições, avaliações e material autorizado, conforme matrícula, etapa e prazo. Autenticação não concede papel interno de funcionário. |

Comissão própria/equipe e campos comerciais obedecem às projeções do doc 37. Exportação exige concessão específica e mantém registros/campos autorizados; revalidar na geração e no download. Dados livres, eventos, nomes de arquivo e metadados também podem revelar informação restrita.

WhatsApp separa contato, transporte e atendimento por finalidade. Um número compartilhado não abre todas as conversas dos contratos ou de outros alunos. Sucessor recebe somente o histórico necessário e autorizado. Cobertura temporária não concede exportação, aprovação ou acesso financeiro automaticamente.

## 5. Requisitos por entrega

Os IDs abaixo são referências internas de especificação, não números do GitHub. Os corpos correspondentes da revisão de integração são incorporados integralmente quanto a escopo, permissões, estados, limites e critérios de aceite.

**Revisão da entrada comercial em 10/09/2026:** Q103–Q123 definiram origem, divisão do cadastro, reserva/admissão, emissão inicial, responsabilidade da nova negociação, desistência e documentos/assinaturas. COM01 organiza a jornada; DCT01–DCT03 acrescentam geração, integração e aditivos. A SPEC da matrícula conserva a leitura do código existente, que ainda não implementa essas ampliações; B01 mantém a base operacional e não absorve implicitamente todos os novos corpos.

| ID / corpo | Resultado e regras vinculantes |
|---|---|
| REQ-01 / B01 | Matrícula como unidade operacional; vínculos e condições versionadas; modelo mensal/horário, cobertura, moeda/preço, vencimento 1–31, ajuste financeiro, multa/descontos/continuidade e entrada por hora. Detalhamento na SPEC da matrícula. |
| REQ-02 / B02 | Recebimento original com destinações, antecipação sem destinação, crédito e compensação rastreáveis. Uso de crédito com concordância, proposta e aprovação independente. Devolução distingue saldo, reserva, autorização e saída comprovada. |
| REQ-03 / F07.1 | Calendário letivo único com feriados/recessos/férias interpretados no fuso institucional. Exceção em dia não letivo vale para encontro identificado e exige aprovação independente. Calendário financeiro é referência separada. |
| REQ-04 / F07.2 | Gerar encontros por data inicial mínima, dias/horário/fuso, duração/frequência e quantidade de aulas por nível. Mostrar primeira aula e término previstos; aceitar passagem da meia-noite. Sem professor, somente rascunho; publicação/alocação exige disponibilidade real. |
| REQ-05 / F07.3 | Propostas de remarcação, cancelamento, exceção, substituição e mudanças globais mostram conflitos e impactos. Aplicar ao aprovar por outra pessoa se ainda válidas. Aumento alcança não finalizadas; redução somente não iniciadas. Mudanças globais têm aprovação/aplicação do conjunto completo. |
| REQ-06 / F07.4 | Aula permanece prevista após o horário até chamada e gravação, ou exceção aprovada. Chamada usa elegibilidade histórica. Pendências internas têm prazos configuráveis e escalonamento à gestão. Correção de aula concluída exige aprovação; regularização/substituição preserva autoria e limita acesso. |
| REQ-07 / F07.5 | Mensalidade integral na entrada/continuidade; recorrência somente contratada e com oferta. Pausa/retomada separa cobertura de vencimentos. Encerramento usa proporcional contratual por dias reais, multa separada, compensações e aprovação. Seleção por matrícula segue Q102. |
| REQ-08 / F07.6 | Reposição individual por particular permitida no plano ou gravação com resumo/atividade avaliados por professor designado. Preservar ausência original; regularizar frequência uma vez. Cotas, reservas, cancelamento, prazos, substituição, material indisponível e correções seguem decisões específicas. |
| REQ-09 / F07.7 | Convite individual por e-mail, senha definida pelo aluno e recuperação com token único e validade. Área de reposições com histórico, entregas e avaliações. Drive compartilhado oficial; reprodução pelo servidor sem conta Google do aluno e sem função de download/offline. |
| REQ-10 / P01 | Particular contratada mensal ou por hora, distinta de reposição por benefício. Hora de 60 minutos com frações, duração contratada, cancelamento/falta conforme contrato e fechamento mensal com ocorrências conferidas. Entrada própria, antecipação, validade e acerto do saldo. |
| REQ-11 / P02 | Permuta exige acordo, evidência pedagógica por período, proposta financeira e aprovação independente. Compensar somente o serviço comprovado segundo a fórmula acordada; não criar dinheiro recebido. |
| REQ-12 / N01 | Avisos consolidados após aplicação: equipe no ERP, WhatsApp institucional e e-mail cadastrado de destinatários autorizados. Resend como fornecedor escolhido; registrar tentativas/resultado e pendência de falha. Não enviar durante prévia ou migração. |
| REQ-13 / M01 | Migração por origem e IDs, prévia, conferência de ambiguidade, conciliação e ensaio rastreável. Aproveitar dados reais sem presumir histórico ausente ou disparar operação externa. Complementos podem ser coletados depois do refinamento. |
| REQ-14 / V01 | Homologação dos fluxos integrados, acesso, concorrência, recuperação, migração e operação dos serviços reais. Resultados antigos não comprovam as novas regras. |
| REQ-15 / COM01 | Negociação/matrícula própria e identidade reutilizada; vendedor coleta básico e Secretaria completa/confere. Reserva temporária/protegida, admissão e particulares disponíveis; emissão única conforme Q112/Q119, ativação com requisitos e desistência conforme Q121. |
| REQ-16 / DCT01 | Modelos contratuais e de aditivos preparados por Secretaria/Administração e publicados por outra pessoa da Administração; geração de PDF protegido com versão/dados preservados e participantes definidos pelo modelo, sem cláusulas livres por venda. |
| REQ-17 / DCT02 | Liberação conforme taxa prévia por oferta e conferência; assinatura integrada primeiro pelo cliente/responsáveis e depois pela escola quando exigida. Preservar evidências, conciliar incerteza, conferir aceite e substituir documento ainda em assinatura com aprovação independente. |
| REQ-18 / DCT03 | Aditivo ligado ao original e anteriores, com aprovação administrativa independente/alçadas, modelo aprovado, assinatura e conferência. Aplicar condições formalizadas conforme vigência/base válida, sem nova matrícula/taxa ou reescrita de pagamentos. |

## 6. Estados, aprovações e efeitos

**Ampliação acadêmica Q124/C:** incluir fala, compreensão oral, leitura, escrita, frequência e resultado consolidado com critérios configuráveis, conforme a [SPEC-ERP-004](avaliacao-por-habilidades.md). O corpo de entrega ainda será detalhado; não alterar os 18 corpos anteriores para presumir fórmulas, pesos, mínimos ou portal completo. A mudança de nível mantém D14.

Os rótulos abaixo especificam comportamento; nomes de enums/tabelas serão definidos nas entregas sem mudar as transições autorizadas.

| Objeto/fluxo | Transição e efeito obrigatório |
|---|---|
| Matrícula mensal | Ativação exige aceite com evidência confirmado pela Secretaria e taxa regularizada; primeira mensalidade somente quando configuração exigir. Comprovante a conferir não satisfaz pagamento. |
| Matrícula por hora | Mesmas condições de contrato/taxa, com adiantamento exigido ou dispensado pela oferta/contrato. Não criar primeira mensalidade fictícia nem executar geração mensal fixa. |
| Proposta | Rascunho → em análise → rejeitada/cancelada ou decisão válida. Mudança de seleção, versão ou impacto exige revisão. Não rotular aprovação como execução externa concluída. |
| Calendário/agenda | Aprovação independente aplica o conjunto válido; falha de conflito ou versão não aplica parte por acidente. Secretaria acompanha, sem etapa adicional de execução. |
| Mudança de nível | Pedido → parecer docente ou dispensa justificada → aprovação independente → execução pela Secretaria, revalidando condições. Não trocar este fluxo pelo de calendário. |
| Reposição individual | Pedido autorizado pela gestão → disponibilização/agendamento autorizado pela Secretaria → realização ou entrega/avaliação. A aprovação inicial não confirma a frequência. |
| Turma | Rascunho/publicação separados; início automático no primeiro encontro oficial não cancelado. Gestão conclui após meta e pendências; não conclui matrícula ou aprova aluno automaticamente. |
| Aula | Prevista → ministrada após requisitos; cancelamento somente após decisão aprovada. Data passada cria pendência, não presença, reposição automática ou extensão de cobrança. |
| Correção concluída | Proposta com motivo/antes/depois → aprovação independente → aplicação e conferência dos efeitos. Resultado anterior permanece até aplicar a correção válida. |
| Informe de pagamento | A conferir → confirmado/rejeitado. Suspender lembrete somente daquela cobrança por prazo configurável, inicialmente 48 horas; expiração retoma após revalidação, sem confirmar recebimento. |
| Restrição de acesso | Causa automática D+30 e causa manual aprovada são independentes, por matrícula. Pagamento remove causa automática quando regularizada; não revoga decisão manual por inferência. |
| Pausa/retomada/encerramento | Seleção e efeitos por contrato; guardar data de registro e data efetiva aprovada. Retomada aprova cobertura e vencimentos separadamente na mesma proposta. Encerramento aprovado não aguarda quitação para respeitar a data efetiva. |
| Devolução | Solicitação → preparação → aprovação por outra pessoa → execução autorizada/evidenciada. Preparador pode executar se tiver capacidade. Alteração de valor/destino exige nova aprovação; resposta externa incerta exige conciliação. |

## 7. Dinheiro, cobertura e benefícios

**FIN-01 — Mensalidades e cobertura.** Guardar início/fim do serviço separados do vencimento. Referência civil ou ciclo com âncora vem do contrato. Gerar continuidade na antecedência configurada ao vencimento, conferindo contrato, matrícula e oferta. Mudança A1→A2 não duplica período. Feriado/recesso ou atraso do diário não autoriza proporcional.

**FIN-02 — Pausa e indisponibilidade.** Na pausa, manter integral o período iniciado e suspender os seguintes abrangidos; no retorno, recompor cobertura segundo a referência contratual e aprovar a escolha de vencimentos. Falta de oferta da escola impede novas emissões pertinentes. Período inteiro já emitido exige escolha contratualmente permitida entre crédito/cobertura futura; período parcialmente indisponível recompõe dias sem cobrança adicional. Não sobrepor cobertura nem cobrar dias compensados.

**FIN-02.3 — Referência do vencimento de novas mensalidades (Q160, aprovada em 15/09/2026).** O contrato identifica expressamente se o vencimento pertence ao mês de início da nova cobertura, ao anterior ou ao seguinte, mantendo o dia contratado e a regra de mês curto de Q90. Calcular pela cobertura nova, inclusive depois de reprogramação, sem avançar simplesmente o vencimento anterior. Não alterar vencimentos já emitidos nem cobrar dias de compensação. Condição incompleta exige conferência; não atribuir referência padrão a contratos legados. Configuração, validação no banco e planejamento implementados no incremento 523; emissão recorrente ainda pendente. [Evidências e limites](../planejamento/validacao-incremento-523.md).

**FIN-03 — Encerramento.** Dias cobrados e total de dias são civis do período de cobertura. O contrato define inclusão do dia efetivo e ordem dos descontos. Suportar proporcional sobre valor líquido ou proporcional da base seguido do desconto, conforme a condição aplicável, sem extrapolar os limites do período. Multa fixa/percentual identifica base, cláusula e condições; alteração/dispensa exige autorização. Considerar dias de compensação ainda devidos e saldo de horas nas condições originais. Exibir memória completa e aprovar por pessoa distinta.

**FIN-02.1 — Fim da falta de oferta (Q156, aprovado em 15/09/2026).** Secretaria, Gestão Pedagógica ou Administração propõe a data final; outra pessoa da Gestão Pedagógica/Administração confere a oferta e aprova. Preservar relato original, motivo, evidências e autoria. Registrar o término não reativa matrícula nem emite cobrança por si só. A correção de relato já confirmado (Q157) permanece pendente de decisão e não está autorizada por esta regra. Fluxo de proposta/decisão e consulta do fim inclusivo implementado no incremento 517; interface sem ensaio interativo. [Evidências e limites](../planejamento/validacao-incremento-517.md).

**FIN-04 — Recebimentos e crédito.** Um pagamento pode ter destinações para vários períodos/serviços, conservando um único recebimento original. Crédito tem titular, origem e moeda; pode ainda não ter destino, conforme Q87. Cada uso exige concordância e aprovação de Q68. Encerramento não significa devolução automática; não transferir crédito entre alunos nem converter moeda implicitamente. Não interpretar a âncora por matrícula como autorização para redistribuir crédito automaticamente entre contratos.

**FIN-02.2 — Período integral sem oferta (Q158/Q159, aprovadas em 15/09/2026).** Na escolha de crédito, retirar o saldo não pago e reconhecer crédito pelo valor pago ou liquidado com crédito, sem duplicação. Na escolha de cobertura futura, reprogramar a cobertura da mesma mensalidade após aprovação independente, preservando cobertura original no histórico, valores e vencimento. Conferir cláusula e escolha documentada do aluno; impedir sobreposição e cobrança adicional da mesma cobertura. A aprovação da proposta não deve ser apresentada como crédito disponível ou mudança já aplicada antes da execução registrada. Proposta, decisão e aplicação implementadas nos incrementos 520/521; reconferência de aprovação obsoleta e regularizações sucessivas após cobertura reprogramada acrescentadas no incremento 522. Cada nova proposta preserva a anterior e exige aprovação própria; somente a versão vigente pode produzir nova aplicação. Repetir aplicação histórica não retrocede cobertura. [Evidências e limites](../planejamento/validacao-incremento-522.md).

**FIN-05 — Horas contratadas.** Quantidade cobrada = minutos contratados ÷ 60, sem arredondamento do tempo para cima. Diferenças financeiras de duração exigem ajuste aprovado. Cancelamento do aluno dentro do prazo não cobra; tardio/falta cobra integral sem presença. Escola cancela sem cobrar/consumir como realizado, mantendo escolha de remarcação ou crédito do valor antecipado. Fechamento mensal identifica ocorrências; parcial exige proposta/aprovação independente, e complemento não repete ocorrência.

**FIN-06 — Precisão e invariantes.** Proposta técnica: Decimal e convenção monetária atual de duas casas/ROUND_HALF_UP para CRC/USD; manter precisão intermediária, arredondar uma vez por item e somar itens. Rateios conservam soma e distribuição determinística dos centavos. Não reprecificar compras antigas pela tabela atual. Reservas, consumos, devoluções e ajustes possuem movimentos reconciliáveis, em vez de edição livre de saldo.

**BEN-01 — Cota de reposição.** Configuração por plano contém quantidade, duração/referência do período e prazo de cancelamento. Entrada recebe cota integral; saldo livre não acumula. Reserva pertence ao período da particular agendada; remarcação entre períodos libera/reserva atomicamente após conferir saldo. Realização, falta ou cancelamento tardio consomem; cancelamento no prazo devolve. Novo pedido após consumo exige nova aprovação e saldo.

**BEN-02 — Mudanças e exceções.** Mudança de configuração/plano vale no próximo período, honrando particulares autorizadas e considerando reservas antes de abrir saldo. Particular excepcional por material irrecuperável, escolhida pela gestão, não cobra nem consome benefício normal. Horas compradas e cota gratuita são saldos distintos; pausa de validade de horas antecipadas devolve somente o tempo restante, quando houver validade contratada.

**REP-01 — Frequência e prazos.** Reposição regulariza a aula original sem apagar a ausência/impedimento e sem contagem duplicada. Gravação mostra data da validação; entrega fica nos detalhes. Prazo começa com material disponível; expiração bloqueia novos envios até prorrogação justificada. Interrupção confirmada pausa o tempo restante; professor pode avaliar entrega já registrada no prazo. Pausa/encerramento deixa histórico em leitura, com entrega somente por autorização específica, motivo e prazo, sem contornar restrição de material.

## 8. Tempo, concorrência e integrações

Separar fuso institucional, fuso de origem da turma e preferência de exibição. Proposta técnica: identificadores IANA e instantes persistidos para encontros, mantendo regras e horários locais que os originaram. Horário local inexistente/ambíguo deve ser resolvido explicitamente antes da publicação. Verificar todo o intervalo, incluindo passagem da meia-noite e dias não letivos. Intervalos adjacentes não se sobrepõem por compartilhar apenas a fronteira.

Conflito docente considera encontros efetivos e indisponibilidades aprovadas nas datas futuras, não só a grade semanal atual. Alteração de ausência, substituição ou calendário identifica encontros já publicados afetados e exige solução aprovada. Não cancelar nem trocar professor silenciosamente.

Cada mutação relevante grava dados e evento na mesma transação, com versão e chave de repetição quando aplicável. Propostas coletivas revalidam todos os objetos; falha preserva o conjunto anterior. A aplicação no banco e o envio externo não formam uma única transação: persistir intenção de aviso após a mudança confirmada e processar com revalidação e registro durável.

Automações usam identidade/finalidade próprias e revalidam destinatário, contrato, saldo e autorização ao executar. A deduplicação do provedor não substitui a durabilidade interna. Falha de e-mail/WhatsApp não desfaz a agenda aprovada; gera pendência operacional rastreável. Resposta incerta não é sucesso confirmado nem licença para duplicar operação externa.

Drive permanece fonte oficial e Zoom pode gravar, sem transferência automática incluída. Reprodução no ERP exige autorização do lado do servidor por material/matrícula e validação de permissões, desempenho e capacidade reais. Não expor credenciais ou link público como substituto do controle. Ausência de função de download não promete impedir captura/cópia por outros meios.

## 9. Contrato das telas e operações

Cada tela e ação deve identificar contexto: aluno, matrícula(s), serviço, situação e data de referência. Na ficha consolidada, seções por contrato evitam misturar saldo, acesso e agenda. Filtros apenas restringem o escopo autorizado.

Propostas mostram antes/depois, contratos selecionados, data efetiva, cobertura, vencimentos, valores, conflitos e responsáveis pela aprovação. Retorno por erro diferencia validação incompleta, falta de autorização, conflito de agenda, versão desatualizada, saldo insuficiente e repetição já aplicada, sem revelar objetos fora do acesso do autor.

Datas e valores precisam ser inteligíveis: fuso exibido, primeira/última aula, período coberto separado do vencimento, moeda, origem do saldo e ordem do cálculo. Interfaces não oferecem decisões cujo servidor não consiga conferir. A revisão de cada entrega define contratos concretos de entrada/saída seguindo as [convenções locais](../13-convencoes-codigo.md), sem criar API pública apenas por usar o termo SPEC.

## 10. Migração e implantação

Usar o [inventário da primeira planilha](../planejamento/analise-planilha-operacional-leticia.md) e o [checklist de dados](../planejamento/checklist-dados-migracao.md). Complementos não impedem especificar/implementar mecanismos; habilitar operações dependentes em produção exige dados suficientes e conferidos.

Fases obrigatórias: inventário → mapa de origem/IDs → prévia sem efeitos → conferência de ambiguidades → ensaio → conciliação por moeda/contrato → carga aprovada e rastreável → validação operacional. Reexecutar lote não duplica registros. Nome igual, linha da planilha ou primeira matrícula ativa não são critérios de associação automática.

Migração estrutural é incremental: adicionar vínculos/versões, preencher casos comprováveis, separar pendências, validar integridade e adaptar consumidores antes de retirar a dependência global do aluno. Não apagar base nem inventar contratos, presenças ou pagamentos históricos. Conservar trilha de origem e permitir interromper a habilitação se a conciliação divergir.

Operação externa permanece desabilitada em ensaio. Habilitar portal, recorrência, material e mensagens somente após validar dependências, configuração institucional, autorização, tratamento de falhas e recuperação aplicáveis. Dados ausentes, fornecedores ainda não configurados e medição de capacidade são pendências operacionais, não escolhas de negócio respondidas por silêncio.

## 11. Rastreabilidade das decisões

**Ampliação acadêmica Q124–Q154:** avaliação por quatro habilidades e frequência, notas numéricas/comentário opcional, intermediárias selecionadas e final cobrindo as quatro, pesos individuais por avaliação e pesos por habilidade, mínimo geral e individual, frequência mínima com exceção independente e recuperação direcionada conservando o melhor resultado. A [SPEC acadêmica](avaliacao-por-habilidades.md) registra AV-01–AV-36 e ACA-01–ACA-34; respostas exatas permanecem no registro da progressão. Q134 define limite por habilidade; Q135 define proposta docente/gestão e aprovação independente; Q136 define prazo a partir da disponibilização; Q137 define consumo de tentativas; Q138 veda exceções de nota; Q139 limita a entrega ao registro de avaliações externas; Q140 define publicação independente pela gestão; Q141 preserva regras de turmas em andamento; Q142 exige conferência independente por avaliação; Q143 libera acompanhamento oficial ao aluno; Q144 exige correção com aprovação independente; Q145 mantém atendimento dos responsáveis pela equipe; Q146 define segunda chamada separada; Q147 limita segunda chamada por avaliação; Q148 define consumo de segunda chamada; Q149 define prazo da segunda chamada; Q150 autoriza extras com aprovação independente; Q151 define pausa/encerramento; Q152 define designação docente limitada; Q153 define equivalência aprovada; Q154 define fechamento pela gestão; revisão técnica e corpo adicional pendentes. Valores de configuração, duração dos prazos, autoria/publicação e demais pendências não foram presumidos; corpo adicional ainda em refinamento.

Esta matriz cobre Q04–Q154, incluindo as perguntas de inventário. As escolhas exatas, complementos e correções do usuário permanecem no registro F07 e no registro da entrada comercial; os conjuntos se sobrepõem quando uma regra atravessa entregas. D01–D14 têm as fontes específicas da seção 2.

| Decisões | Requisitos / entregas |
|---|---|
| D01–D09 | Acesso da seção 4; B01/B02/N01 e preservação do comportamento comercial |
| D10–D12 | Ativação, conferência e restrição; B01/B02/F07.5/P01/F07.7 |
| D13–D14, Q102 | SPEC da matrícula; B01/F07.5/P01/V01 |
| Q103 | Origem comercial e condição de turma disponível que aceite entrada; SPEC da matrícula, B01/F07.2/P01/V01; reserva/admissão e particulares detalhadas em Q107–Q111 |
| Q104 | Geração de PDF por modelo institucional aprovado, sem edição livre de cláusulas; versões/modelos e condições preservados; ampliação documental integrada a B01/Secretaria, com corpo de entrega a detalhar |
| Q105 | Liberação para assinatura com exigência/dispensa de taxa prévia por oferta, registrada na matrícula; conferir Secretaria, condições aprovadas e turma de Q103; preservar requisitos de ativação |
| Q106 | Serviço de assinatura integrado com documento assinado/evidências, versão correta e conferência da Secretaria; fornecedor/plano para avaliação posterior |
| Q107 | Reserva temporária de vaga desde o início da matrícula em preparação, prazo configurável e Secretaria acompanhando; B01/F07.2/V01, com expiração segundo Q108 |
| Q108 | Expirar reserva vencida somente sem comprovante em conferência, pagamento confirmado ou assinatura nessa contratação; caso contrário, manter vaga/pendência. B01/F07.2/B02 e integração contratual |
| Q109 | Data-limite de admissão por turma; permitir ingresso após o início dentro da janela e bloquear novas admissões depois; B01/F07.2/V01, sem criar frequência anterior ao vínculo |
| Q110 | Reserva feita dentro da janela, ainda válida ou mantida por pendência: ingresso após o limite exige aprovação específica de outra pessoa da Gerência Pedagógica/Administração, viabilidade e motivo; sem turma concluída, ampliação geral da janela ou dispensa dos requisitos de ativação. B01/F07.2/V01 e MAT-21 |
| Q111 | Particulares por regime da oferta, registrado na matrícula/contrato: reservar grade recorrente acordada ou ao menos o primeiro encontro na agenda flexível antes da taxa/assinatura; professor e conflitos conferidos, demais encontros flexíveis sujeitos a novo agendamento. B01/F07.2/P01/V01 e MAT-22 |
| Q112 | Emissão automática e única da taxa após Secretaria conferir dados/condições e requisitos válidos; sem emissão por simples preparação, segunda liberação manual do Financeiro ou baixa presumida. B01/B02, SPEC documental e MAT-23 |
| Q113 | Vendedor coleta identificação básica, contato e negociação; Secretaria complementa/confere documentos, endereço e dados financeiros/participantes aplicáveis. Reaproveitar cadastro com escopo restrito, sem dados fictícios ou edição cadastral do vendedor após assunção. B01, SPEC documental e MAT-24 |
| Q114 | Secretaria/Administração prepara modelo; outra pessoa da Administração confere, aprova e publica a versão exata. Sem autoaprovação, uso de modelo não publicado como aprovado ou alteração retroativa dos contratos. SPEC documental e DOC-13; amplia corpo documental a organizar |
| Q115 | Modelo aprovado define papéis obrigatórios e condições de assinatura; Secretaria identifica as pessoas. Exigir o conjunto aplicável no documento correto, sem conclusão por assinatura parcial, omissão arbitrária ou acesso acadêmico decorrente de pagamento/assinatura. SPEC documental e DOC-14 |
| Q116 | Secretaria/Administração prepara substituição durante assinatura; outra pessoa da Administração aprova. Encerramento externo anterior confirmado precede nova liberação; resultado incerto/conclusão concorrente impedem avançar indevidamente. Preservar versões, assinaturas e pagamentos, sem transferir aceite ou duplicar taxa. SPEC documental e DOC-15 |
| Q117 | Aditivo vinculado ao contrato original e anteriores: Secretaria/Administração prepara, outra pessoa da Administração aprova com alçadas aplicáveis, ERP gera PDF/assinatura integrada e Secretaria confere. Aplicar somente com formalização completa e vigência aprovada; preservar matrícula/históricos e fluxos de pausa/encerramento/academia. Amplia entrega documental; DOC-16 |
| Q118 | Secretaria/Administração propõe prorrogar/liberar reserva protegida com motivo, prazo e tratamento previsto dos efeitos; outra pessoa da Administração aprova/aplica proposta válida. Não presumir baixa, devolução ou cancelamento nem ampliar admissão; novo vencimento conserva Q108. B01/F07.2, SPEC documental e MAT-25 |
| Q119 | Mensalidade/adiantamento exigido para ativar nasce após conferência da Secretaria; primeira mensalidade não exigida nasce na ativação; hora sem adiantamento segue Q93. Conferir dados e não duplicar cobrança/recebimento; preservar taxa/contrato e confirmação dos pagamentos exigidos. B01/B02/P01 e MAT-26 |
| Q120 | Nova negociação/matrícula de aluno existente tem responsável próprio registrado ao abrir, sem transferir vendas/comissões anteriores. Reutilizar identidade com escopo restrito; cobertura não muda dono, transferência é autorizada e conversão repetida não duplica matrícula. B01/comercial e MAT-27 |
| Q121 | Desistência antes da ativação: Secretaria efetiva sem avanço formal com requisitos cumpridos; comprovante em conferência, pagamento confirmado ou assinatura exigem proposta de Secretaria/Administração e aprovação por outra pessoa da Administração. Conferir valores/acerto independente quando necessário, encerrar solicitação externa aberta com resultado confirmado e preservar demais contratos/históricos. Reserva liberada não comprova devolução. MAT-28/DOC-17 |
| Q122 | Assinatura em etapas: participantes obrigatórios do cliente recebem juntos; depois de todos assinarem, escola quando exigida no modelo. Vale também para aditivos, sem assinatura automática, etapa artificial ou dispensa da conferência da Secretaria. DOC-18 |
| Q123 | Expiração sem avanço formal mantém a mesma matrícula em preparação, pendente de nova reserva. Encerrar solicitação de assinatura aberta com resultado conferido; revalidar disponibilidade, dados e condições antes de novo avanço. Preservar documentos/cobranças e conferir fatos formais concorrentes, sem presumir vaga, ativação ou devolução. COM01/DCT02, MAT-29/DOC-19 |
| Q04–Q06, Q19–Q21 | REQ-03–REQ-05; calendário, quantidade e aprovação |
| Q07–Q08, Q22–Q24 | REQ-05/REQ-06; cancelamento, conclusão e regularização |
| Q09, Q12, Q15, Q17–Q18, Q28–Q32 | FIN-01–FIN-04; B01/B02/F07.5 |
| Q10–Q11, Q13–Q14, Q16, Q25–Q27 | BEN-01/REP-01; F07.6 |
| Q33–Q36 | REQ-08/REQ-09, BEN-02/REP-01; portal/material/prazos |
| Q37–Q39, Q41–Q48, Q56 | REQ-03–REQ-05/REQ-12; grade, professor, mudanças e avisos |
| Q40, Q49–Q55, Q57–Q61 | REQ-06/REQ-08; histórico, avaliação, material e cotas |
| Q62–Q66 | FIN-01–FIN-03; cobertura, recorrência, pausa e retomada |
| Q67–Q71 | FIN-02–FIN-04; ajustes, crédito, devolução e cobrança final |
| Q72–Q82 | REQ-09/REQ-12; identidade, Drive, reprodução e e-mail |
| Q83 | FIN-03; compensação restante no encerramento |
| Q84–Q85 | REQ-13; inventário/migração, sem presumir dados completos |
| Q86–Q88 | REQ-01/REQ-02/REQ-10; modelos, antecipação e empresa pagadora |
| Q89–Q90 | REQ-11/REQ-01; permuta e vencimento |
| Q91–Q97 | FIN-05/BEN-02; particular, apuração, cancelamento, pausa e saldo |
| Q98–Q99 | REQ-11/REQ-01; permuta parcial e dias úteis financeiros |
| Q100–Q101 | REQ-10; ativação por hora e fechamento parcial aprovado |

## 12. Validação e critério de conclusão

Além dos critérios por corpo, os cenários transversais seguintes são obrigatórios. São requisitos de teste/homologação, ainda não resultados executados nesta etapa.

| ID | Cenário e resultado esperado |
|---|---|
| CT-01 | Mesmo aluno com inglês mensal e particular por hora: criar vínculos independentes; pausar/encerrar só um preserva o outro e isola conteúdo. |
| CT-02 | Seleção coletiva com um contrato sem autorização ou versão alterada: não aplicar parte; mostrar necessidade de revisão no escopo permitido. |
| CT-03 | Trocar matrícula/aluno/encontro no pedido direto: servidor rejeita associação incoerente; não ampliar leitura, mutação, arquivo ou exportação. |
| CT-04 | Professor saiu, aluno mudou e chamada é antiga: lista histórica correta; autoria preservada; regularizador tem acesso pontual. |
| CT-05 | Mudança global com uma turma conflitante: proposta não aplica parcialmente; após revisão válida, histórico passado permanece intacto. |
| CT-06 | Dia 31 em mês curto, aula cruzando meia-noite e fusos diferentes: cobertura, vencimento, calendário e apresentação permanecem distintos e corretos. |
| CT-07 | Duas reservas do último benefício, uso/devolução concorrentes e reprocessamento: sem saldo negativo, consumo duplicado ou dinheiro duplicado. |
| CT-08 | Comprovante a conferir e prazo expirado: sem baixa ou liberação de aula fictícia; lembrete é suspenso/retomado só para a cobrança pertinente. |
| CT-09 | Particular sem gravação ainda pendente, ocorrência financeira conferida: não criar requisito financeiro indevido; parcial/complemento não cobra o mesmo encontro duas vezes. |
| CT-10 | Encerramento com descontos, multa, crédito e dias compensados: memória fecha com recebimentos e condições originais; aprovação independente e data efetiva preservadas. |
| CT-11 | Material indisponível, troca de avaliador e matrícula pausada: preservar entregas/autoria, prazo restante e restrições, sem conclusão automática. |
| CT-12 | Falha externa/reinício/reenvio/migração repetida: resultado durável, pendência verificável, nenhuma duplicação silenciosa ou envio de ensaio. |

Uma entrega fica pronta para implementação quando seu corpo, requisitos referenciados, contratos de dados/ações, estados, permissões, tratamento de legado, dependências e testes têm correspondência explícita. Questão técnica resolvível com as decisões existentes não exige nova rodada de negócio; mudança de comportamento requer refinamento próprio.

Uma entrega somente fica concluída quando há implementação, migração aplicável, testes apropriados executados com evidência, regressões pertinentes e atualização da situação do projeto. Integração real exige evidência no serviço e ambiente corretos. Caixa de aceite em documento não substitui resultado.

## 13. Sequência e governança

Começar pela [base da matrícula](matricula-como-unidade-operacional.md) de B01, com calendário inicial F07.1 independente quando possível. Em seguida, B02 e agenda/aprovações; depois diário, cobertura/acertos e permuta; reposições e particulares; portal/comunicação. M01 e V01 acompanham os marcos, sem esperar o final para validar vínculos e dinheiro.

GitHub acompanha execução; SPEC descreve comportamento; registro Q/D preserva decisões e sua origem. Cada issue referencia SPEC/requisitos, corpo de entrega, dependências e critérios de aceite. Mudança aprovada atualiza SPEC e testes antes de ser considerada cumprida. Não copiar versões divergentes da mesma regra para cada issue.

Esta consolidação cria documentos e rastreabilidade. Não cria issues, não altera funcionalidades, não executa migração nem ativa mensagens ou serviços externos.


### Nota técnica de execução — prazo de reserva (Q107, 12/09/2026)

O prazo inicial é configurado pela Administração em minutos inteiros, sem padrão presumido. A ausência impede criar novas reservas. A criação lê a configuração no servidor e fixa/audita o prazo aplicado; alterações posteriores não reinterpretam reservas existentes. Prorrogação individual mantém Q118. O limite do campo é técnico (inteiro do banco), não um prazo de negócio adotado pela escola. Evidências e pendências de integração no incremento 165 de B01.

### Nota técnica de implementação — Q100/Q105 (12/09/2026)

A oferta mantém configuração explícita e versionada de taxa antes da assinatura e adiantamento por hora. Não definido é distinto de dispensado. A preparação preserva os valores vigentes em sua origem; mudanças posteriores exigem revisão da contratação, sem substituir seu histórico. Configurar exigência de adiantamento não define valor ou quantidade de horas: ambos devem ser explicitados na contratação. Este registro não comprova conferência integral, emissão, pagamento, assinatura ou ativação. Evidência e pendências: incremento 178 de implementacao-b01.md.


### Evidência de implementação — atendimento financeiro por matrícula (599)

Novos atendimentos financeiros do WhatsApp exigem matrícula explícita e coerente com o aluno. A chave do assunto, a projeção de cobrança e o despacho respeitam esse contrato. Conversa sem cobrança na matrícula escolhida não apresenta dívida de outra. Atendimento legado sem matrícula não recebe envio nem cobrança inferida; preservar histórico e encaminhar mensagens ambíguas à triagem. A identificação do contrato aparece na escolha do atendimento e no acompanhamento. [Validação e limites atuais](../planejamento/validacao-incremento-599.md), incluindo a revisão ainda necessária de responsáveis específicos por contrato.


### Evidência de implementação — destinatário financeiro contratual (600)

A resolução financeira utiliza o pagador versionado da matrícula, com a mesma fonte na abertura, projeção, fila e despacho. ALUNO usa sua identidade conferida e telefone atual; RESPONSAVEL/EMPRESA usa o contato explícito do contrato. Fonte insuficiente não autoriza usar outro telefone. Legado sem fonte e com vários contratos exige conferência; preparação comercial sem pagador não herda o responsável global. Alteração do destinatário ou de sua fonte invalida texto preparado para a versão anterior, inclusive se o telefone não mudar. Essa resolução não concede acesso acadêmico. [Evidências e limites](../planejamento/validacao-incremento-600.md).


### Evidência de implementação — resposta financeira por matrícula (601)

O indicador de resposta da fila financeira considera apenas entrada no atendimento financeiro da matrícula, vinculada ao destinatário atual do contrato e posterior ao último envio da cobrança. Mensagem em transporte compartilhado ou assunto comercial não marca outros contratos como respondidos. Preservar o significado histórico do indicador, sem inferir pagamento. [Evidências](../planejamento/validacao-incremento-601.md).


### Evidência de implementação — cobrança manual (602)

O envio manual usa preparação no servidor com destinatário contratual atual, saldo/ciclo e suspensão de conferência verificados. Não reutilizar telefone global do aluno quando o pagador estiver incompleto. Abrir o link não comprova envio nem avança a régua; a equipe registra separadamente a confirmação de envio realizado. Preservar o caráter declaratório do registro manual. [Evidências e limites de homologação](../planejamento/validacao-incremento-602.md).


### Evidência de implementação — confirmação manual validada (603)

A confirmação declaratória valida modelo, passo e ciclo no servidor e revalida autorização na transação de gravação. Aceitar o ciclo histórico válido sem atribuir o envio à régua nova; recusar ciclo futuro. A interface recupera o estado ocupado após falhas e separa seu estado por cobrança/ciclo. Resposta incerta exige conferir o histórico antes de repetir. [Testes e limites de homologação](../planejamento/validacao-incremento-603.md).


### Decisão Q161 — comprovação de oferta para continuidade (16/09/2026)

Aprovada a alternativa A: conferir agenda e vínculo da matrícula para comprovar a oferta do período a emitir. Quando essas fontes não comprovarem a continuidade, exigir confirmação específica da Gestão Pedagógica, identificando período e justificativa. Matrícula ativa e ausência de relato de indisponibilidade não comprovam oferta por si sós. Feriados/recessos normais seguem o calendário institucional. A confirmação não ativa matrícula nem emite cobrança isoladamente; permanecem contrato, cobertura, preço, vencimento, compensações e demais requisitos da emissão. Esta decisão está aprovada; sua implementação e validação ainda precisam de evidências.


### Decisão Q162 — ciclo mensal após compensação (16/09/2026)

Aprovada a alternativa A: depois de uma cobertura deslocada por compensação de indisponibilidade da escola, a próxima cobertura começa no dia seguinte ao término da anterior e estabelece um novo ciclo mensal. Exemplo: cobertura deslocada para 03/out–02/nov é seguida por 03/nov–02/dez. Não sobrepor cobertura nem cobrar novamente dias compensados. Preservar coberturas originais e aplicação aprovada da recomposição como origem; não inferir esse tratamento de datas legadas ou de uma proposta ainda não aplicada. Vencimentos já emitidos permanecem preservados; novos vencimentos seguem Q160. A decisão está aprovada; a implementação deve demonstrar o vínculo entre a recomposição aplicada e o cálculo subsequente.


### Evidência de implementação — ciclo após recomposição (604)

A prévia reconhece a origem Q70 aplicada e coerente com as cobranças atuais da matrícula, calcula o novo ciclo de Q162 e preserva referência e origem na memória retornada. Não infere fonte de proposta, legado ou outra matrícula. Emissão recorrente e comprovação positiva Q161 permanecem em implementação; conflitos com origens de retomada/regularização integral exigem tratamento antes de concluir o fluxo. [Validações e pendências exatas](../planejamento/validacao-incremento-604.md).


### Evidência de implementação — comprovação de oferta Q161 (605)

A prévia distingue agenda comprovada, confirmação pedagógica atual para o período e bloqueio por indisponibilidade. Confirmações positivas exigem proposta e decisão independente por matrícula/intervalo, preservam versões e revalidam a fonte projetada antes do consumo; não apagam Q156. A tela permite registrar e acompanhar esse fluxo. Emissão permanece desabilitada enquanto seu executor não estiver implementado e validado. [Evidências e limites do incremento](../planejamento/validacao-incremento-605.md).


### Evidência de implementação — emissão de continuidade mensal (606)

Executor transacional e rotina protegida implementados, com memória persistida por matrícula/âncora e revalidação de contrato, prazo e oferta. A configuração operacional permanece desligada; nenhum agendamento externo foi ativado. Q162 conserva bloqueio em combinações de origens sem precedência definida. [Evidências e limites exatos](../planejamento/validacao-incremento-606.md).


### Evidência de implementação — Q162 integrado e fontes de continuidade (607)

A emissão foi verificada depois de recomposição aplicada e em dois ciclos subsequentes, preservando referência e origem na memória. Condições mensais exigem preparação comercial mensal; a confirmação de oferta detecta alterações nas fontes mesmo quando a agenda segue insuficiente. Banco reforçado quanto a contrato ativo e estado financeiro inicial. [Resultados, correções e limites](../planejamento/validacao-incremento-607.md). Combinações com outras origens sem precedência definida e homologação operacional permanecem pendentes.


### Evidência de implementação — fila financeira de continuidade (608)

Financeiro/Administração podem consultar a fila paginada por matrícula, identificar a falta de comprovação e acompanhar a passagem para condições prontas após aprovação pedagógica. A consulta não emite nem expõe dados financeiros ao restante da equipe. [Validações e limites](../planejamento/validacao-incremento-608.md). Não substitui monitoramento persistido de execuções nem homologação operacional.

### Evidência incremental 609–611 — auditoria e transmissão autorizada

A [matriz preliminar](../planejamento/auditoria-609-matriz.md) inventaria 122 critérios, sem declarar percentual global até reconciliar fontes e ampliações. Os incrementos [610](../planejamento/validacao-incremento-610.md) e [611](../planejamento/validacao-incremento-611.md) adicionam revalidação durante os streams de aluno/equipe. F07.7 continua parcial: revisão fixa do Drive e homologação operacional permanecem pendentes. Regressão unitária611:1.240 testes aprovados; build/tipos/lint passaram. Regressão global de integração em execução, sem resultado final nesta atualização.

### Evidência incremental 612–617 — gravações e e-mails de acesso

Os incrementos [612](../planejamento/validacao-incremento-612.md) e [613](../planejamento/validacao-incremento-613.md) implementam adaptadores de revisão fixa do Drive e credenciais separadas de publicação. A publicação e o material de reposição agora fixam e persistem a identidade completa da revisão; as duas rotas de vídeo reautorizam e leem exclusivamente essa revisão em todos os ranges. Registro legado sem fonte fixa não recebe a cabeça atual do Drive e exige regularização. A cadeia de fontes substitutas é append-only, conserva a origem e exige proposta e decisão de pessoas distintas antes de produzir a próxima versão. A migração desta cadeia é 147; o rascunho 146 permanece rejeitado e não é parte deste fluxo.

Os incrementos [614](../planejamento/validacao-incremento-614.md) e [615](../planejamento/validacao-incremento-615.md) adicionam transporte Resend e integração com o despacho transacional de convites, recuperação e validação de e-mail, com recibo auditado. [616](../planejamento/validacao-incremento-616.md) adiciona consulta operacional restrita e conferência do contato vigente antes do envio. [617](../planejamento/validacao-incremento-617.md) adiciona processamento paginado, rota cron protegida e revalidação do contato ao consumir convite. Resultados incertos não são reenviados automaticamente; aceitação pelo provedor não comprova entrega.

Q72/Q73/Q78 permanecem parcialmente entregues: faltam tela da fila, resolução operacional dos envios incertos, proteção SQL equivalente do contato, validação integrada das últimas mudanças e homologação real. Os testes unitários, tipos e lint desses incrementos estão registrados nos relatórios vinculados; não houve envio externo nem ativação de agendador. Esta atualização registra implementação e limitações, sem considerar requisito concluído apenas pela existência de código.

### Q166 — resolução dos e-mails de acesso com resultado incerto (16/09/2026)

Decisão aprovada: Secretaria registra a evidência consultada; Administração autoriza nova emissão quando necessária. Preservar tentativa anterior e histórico; não inferir entrega, aceitação ou falha sem comprovação. Nova emissão exige autorização administrativa independente conforme INV-07, destinatário e estado da conta válidos, novo token e revogação do anterior. Repetição/concorrência não duplica a emissão autorizada. Regras de contato, identidade e troca de e-mail permanecem aplicáveis; decisão de transporte não altera titularidade da conta.

### Integração da fila e proteção do convite

A tela `/secretaria/envios-portal` integra consulta paginada e guard de Secretaria/Administração, distinguindo aceitação pelo provedor de entrega. A migração `20260916100000_convite_email_atual` impede por SQL a ativação inicial de convite para contato cadastral alterado/removido, preservando a identidade já estabelecida e o fluxo Q74. Testes SSR/fila: 5 aprovados. Identidade/envio: 10 aprovados na integração; os dois cenários SQL independentes passaram após corrigir a precisão do relógio do fixture. TypeScript passou; lint sem erros, com aviso preexistente na Sidebar. Q166 e homologação externa continuam pendentes; a entrega EMAIL ainda não está concluída. Estado corrente no quadro único.
