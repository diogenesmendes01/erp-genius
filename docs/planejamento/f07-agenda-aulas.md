# F07 — Calendário escolar, agenda e acompanhamento das aulas

**Especificação consolidada em 10/09/2026:** a [SPEC central](../specs/erp-educacional.md) reúne comportamento, invariantes, estados, permissões, integrações, migração e rastreabilidade das decisões. A [SPEC da matrícula](../specs/matricula-como-unidade-operacional.md) detalha a base B01/Q102. Este arquivo conserva o histórico das perguntas e respostas; alternativas não escolhidas não se tornam requisitos. Criação dos documentos não implementa os fluxos.

**Atualizado em 10/09/2026 — Q04–Q84 respondidas e registradas. Q81/Q82 definem reprodução no ERP sem conta Google e sem download/offline; Q83 inclui compensação restante no acerto de encerramento. Q84 informou planilhas reais para migração. Após o checklist de Q85, a primeira planilha foi recebida e analisada: inventário parcial concluído, com complementos por equipe documentados. Preparação de migração e limites dos importadores documentados. Integrações, capacidade/custos e homologação seguem pendentes; issues e implementação desta ampliação ainda não concluídas.**

**Refinamento após a planilha:** Q86 aprovou particulares mensais e por hora; Q87 permite antecipação destinada a períodos/serviços ou crédito sem destinação; Q88 limita a empresa pagadora a contratos individuais, sem portal empresarial. Q89 exige conferência da permuta por período e aprovação financeira independente. Q90 permite dia de vencimento de 1 a 31, usando o último dia do mês quando faltar o dia contratado. Q86–Q90 respondidas; detalhes derivados ainda precisam de fechamento. Por orientação do usuário, discutir funcionamento primeiro e retomar os dados faltantes depois.

**Detalhamento das particulares:** Q91–Q98 respondidas com opção A; Q99 com opção C. Duração contratada, hora de 60 minutos com frações, cancelamento do aluno no prazo sem cobrança e falta/tardio integral, fechamento mensal após apuração, escolha entre remarcação/crédito quando a escola cancela, validade suspensa na pausa e crédito do saldo não utilizado no encerramento. Permuta compensa somente a parte comprovada; ajuste de vencimento por dia não útil depende de regra explícita no contrato. Não há resposta pendente nos blocos Q86–Q99. A consolidação dos corpos/critério de aceite e a revisão de integração continuam antes da implementação; os dados faltantes serão levantados depois.

**Revisão de integração:** Q100–Q102 respondidas com opção C. Oferta por hora tem configuração própria de adiantamento inicial; fechamento incompleto permite proposta de emissão parcial com aprovação independente; pausa/encerramento seleciona um ou vários contratos e aprova o conjunto antes de aplicar, preservando os excluídos. A [revisão de integração e os 14 corpos consolidados](revisao-integracao-corpos-entregas.md) organizam dependências, escopos, permissões e critérios de aceite, incluindo a revisão dos vínculos por matrícula. Nenhuma issue foi criada nem funcionalidade implementada por essa consolidação.

Frente de origem: [F07 no relatório consolidado](../41-situacao-consolidada-do-projeto.md). Este arquivo reúne decisões, dúvidas e corpos de issue em preparação. Os códigos F07.1–F07.7 são identificadores internos, não números de issues do GitHub. F07.7 cobre somente a área autenticada de reposições escolhida em Q33, um recorte de F13.

## 1. Decisões confirmadas pelo usuário

| Tema | Definição vigente |
|---|---|
| Calendário escolar | Um único calendário da escola para todas as turmas, inclusive turmas com alunos de países diferentes; configurar feriados, recessos e férias |
| Exceção em dia não letivo — Q19 | Permitir encontro específico, inclusive reposição ou particular, com justificativa, aprovação de outra pessoa da Gerência Pedagógica/Administração e verificação de conflitos. O restante da escola mantém o calendário normal |
| Mudança global com agendas publicadas — Q20 | ERP sugere novas datas para todas as turmas afetadas; equipe revisa/ajusta e outra pessoa autorizada aprova o conjunto com seus impactos. Preservar aulas ministradas e registros passados; aplicar somente após aprovação e resolução dos conflitos |
| Países | Calendários letivos separados por país não fazem parte do escopo atual. A proposta anterior foi substituída pela escolha de calendário único |
| Meta de término — Q04 | Quantidade de aulas por nível. Frequência e duração do encontro orientam a distribuição; meses/semanas deixam de ser o limite determinante da previsão |
| Formação da agenda | Usar data inicial, dias da semana, horário, duração da aula, modalidade e calendário escolar para calcular os encontros e a previsão de término |
| Primeira aula — Q46 | Data inicial informada é limite a partir do qual gerar; começar no próximo dia/horário válido e letivo da grade. Mostrar separadamente data informada, primeira aula efetiva e previsão de término, preservando a quantidade de aulas |
| Aula atravessando meia-noite — Q47 | Permitir na grade normal; calcular data/hora final pelo início e duração, mostrar as duas datas e conferir conflitos e calendário em todo o intervalo. Qualquer parte em período não letivo exige exceção explícita de Q19 |
| Duração/frequência por turma — Q37 | Herdar os valores da modalidade; permitir proposta justificada de valores diferentes para uma turma, aprovada por outra pessoa da Gerência Pedagógica/Administração antes da publicação. Preservar meta por quantidade de aulas e bloqueio de conflitos |
| Comunicação de alterações — Q38 | Após aprovação e aplicação da alteração, equipe acompanha no ERP; alunos/responsáveis autorizados recebem aviso consolidado pelo WhatsApp institucional e também por e-mail quando cadastrado. Registrar envios por canal e gerar pendência para a Secretaria em caso de falha/indisponibilidade ou ausência de destinatário autorizado |
| Exibição de fuso | Cada pessoa escolhe o horário de referência que deseja visualizar; a criação guarda o horário e seu fuso para conversão |
| Fuso do calendário escolar — Q45 | Fuso oficial da escola configurável; interpretar dias não letivos nessa referência e converter encontros para conferir. Fuso de origem da turma e preferência de exibição não alteram a referência do calendário |
| Organização — Q05 | Secretaria, Gerência Pedagógica e Administração criam, organizam e publicam o calendário |
| Aprovação — Q05 | Outra pessoa da Gerência Pedagógica ou Administração aprova alterações. Acumular papéis não permite autoaprovação |
| Efetivação de calendário/agenda — Q21 | Aprovação independente aplica a proposta revisada se continuar válida; Secretaria acompanha o resultado, sem segunda etapa de execução. Conflitos ou mudanças relevantes exigem nova conferência antes de aplicar |
| Mudança na modalidade | Aumento alcança todas as turmas não finalizadas, inclusive ainda não iniciadas e rascunhos, conforme Q43; redução somente antes do início, conforme Q42. Agendas publicadas afetadas seguem aprovação conjunta; finalizadas e histórico permanecem preservados |
| Aprovação do conjunto na modalidade — Q41 | ERP prepara impactos de todas as turmas afetadas; equipe resolve conflitos e outra pessoa da Gerência Pedagógica/Administração aprova o conjunto completo. Aplicar tudo na mesma operação, preservando finalizadas, registros passados e a revisão das exceções locais de Q37 |
| Redução da quantidade de aulas — Q42 | Turmas em andamento conservam a quantidade anterior; turmas ainda não iniciadas podem receber redução mediante revisão e aprovação conjunta. Novas turmas usam a nova configuração; preservar aulas ministradas e encontros passados com pendências |
| Alcance do aumento — Q43 | Atualizar todas as turmas não finalizadas, em andamento ou ainda não iniciadas; recalcular rascunhos sem publicá-los e aprovar conjuntamente mudanças de agendas publicadas |
| Turma sem professor — Q44 | Permitida somente como rascunho para planejamento/previsão; exigir professor definido e disponível para publicar a agenda e alocar alunos. Rascunho não confirma disponibilidade docente |
| Início/conclusão da turma — Q48 | Início automático no começo do primeiro encontro previsto não cancelado; Gerência Pedagógica/Administração confirma conclusão após conferir meta cumprida e pendências de conclusão das aulas resolvidas. Estado da aula permanece independente; não aprova alunos nem encerra matrículas/cobranças |
| Aula prevista | Continua prevista mesmo depois de passar sua data/horário; a passagem do tempo não a torna ministrada |
| Conclusão da aula | Exigir presenças preenchidas e link da gravação para marcar como ministrada |
| Exceção de gravação — Q07 | Se a aula ocorreu sem gravação recuperável, professor preenche presenças e justifica; outra pessoa da Gerência Pedagógica/Administração pode concluir com exceção explícita |
| Pendência docente | Depois do horário da aula, o sistema passa a cobrar do professor o preenchimento das presenças e o link da gravação |
| Avisos de pendência — Q22 | Dentro do ERP: professor recebe pendências/lembretes; gestão acompanha o painel e recebe alerta quando vencer o prazo. Prazo de regularização e intervalo dos lembretes configuráveis, sem valores numéricos presumidos |
| Correção de aula concluída — Q23 | Professor responsável ainda vinculado ou equipe autorizada propõe com motivo; outra pessoa da Gerência Pedagógica/Administração aprova e publica. Toda correção guarda antes/depois, autoria e histórico; professor desvinculado mantém leitura |
| Chamada histórica — Q53 | ERP calcula alunos pelo vínculo/situação na data da aula; responsável autorizado preenche mesmo após saída posterior do aluno, com dados limitados à aula. Histórico incompleto exige conferência; não reabre acesso amplo ao professor desvinculado |
| Correção de reposição concluída — Q54 | Professor designado vigente ou gestão propõe com motivo; outra pessoa da Gerência Pedagógica/Administração aprova/publica toda correção. Resultado anterior permanece até aplicar correção válida, conferindo frequência, benefício e histórico |
| Pendência após saída do professor — Q24 | Gestão designa professor ou integrante autorizado da gestão com acesso limitado àquela aula, motivo e histórico. Preservar professor original e identificar quem regulariza; não transferir o vínculo da turma. Exceção de gravação mantém aprovação independente de Q07 |
| Cancelamento | Professor solicita cancelamento com justificativa; a gestão precisa aprovar. Selecionar a opção não cancela imediatamente a aula |
| Reposição da turma — Q08 | Ao decidir o cancelamento, a gestão escolhe data da grade ou extraordinária. O sistema apresenta conflitos e efeito na previsão de término; a escolha não dispensa o bloqueio de conflito docente já aprovado |
| Reposição individual — Q10 | Aluno pode solicitar reposição de aula à qual faltou por duas formas: aula particular, se seu plano permitir; ou gravação disponibilizada para assistir, acompanhada de resumo e atividade. Após conclusão, exibir “Reposta em [data]”, ligada à aula original |
| Autorização da reposição — Q11 | Outra pessoa da Gerência Pedagógica/Administração aprova o pedido registrado; Secretaria executa o agendamento autorizado. A aprovação inicial é distinta da avaliação da entrega gravada |
| Conclusão da reposição gravada — Q13 | Professor designado avalia resumo e atividade, pede correção quando necessário e confirma a reposição; gestão acompanha pendências |
| Data exibida da reposição — Q55 | Na gravação, mostrar “Reposta em [data da validação]”, com a data da versão entregue e aprovada nos detalhes. Preservar ambas no histórico e regularizar frequência somente após confirmação docente; particular mantém data de realização |
| Substituição do avaliador — Q40 | Gerência Pedagógica/Administração designa outro professor, com motivo e acesso limitado à reposição. Preservar avaliações, autoria, histórico e prazos do aluno; prorrogação segue Q35 |
| Entrega do aluno — Q33 | Área autenticada com acesso às próprias reposições, link de gravação, envio de resumo/atividade e acompanhamento de avaliação/correções |
| Entrada e recuperação do aluno — Q72 | E-mail e senha com convite individual; aluno define a própria senha. Recuperação por link de uso único com validade no e-mail verificado. Escola confere vínculo com o aluno correto; equipe não consulta nem envia a senha. Não duplicar cadastro acadêmico nem atribuir papel de funcionário |
| Aluno sem e-mail próprio — Q73 | Secretaria orienta aluno/responsável a providenciar e verificar endereço individual antes do convite; registrar pendência de acesso até lá. Convite/recuperação seguem Q72; não acrescentar condição financeira de ativação da matrícula |
| Recuperação assistida — Q74 | Secretaria/Administração prepara solicitação de troca do e-mail perdido; outra pessoa da Administração confere, aprova e aplica. Conferir identidade/vínculo, validar novo endereço, registrar motivo/decisão e invalidar links/sessões anteriores ao aplicar; equipe não define nem recebe senha |
| Serviços de gravação informados — Q75 | Escola utiliza Google Drive e Zoom. Q77 definiu Drive como fonte oficial de publicação e Q79 informou Drive compartilhado do Workspace da escola; combinação de gravação/armazenamento e controles/API ainda precisam de conferência |
| Serviço de e-mail informado — Q76 | No relato inicial não havia serviço definido para esta operação; Q78 escolheu Resend e Q80 informou geniusidiomas.com. Plano, responsável/acesso ao DNS, remetente e configuração/validação de envio permanecem pendentes |
| Fonte oficial das gravações — Q77 | Google Drive como fonte oficial do material; Zoom pode continuar como ferramenta de gravação. Q81 definiu reprodução pelo ERP usando a fonte no Drive; não inclui captura automática ou transferência do acervo entre serviços |
| Envio de e-mails automáticos — Q78 | Resend escolhido para convites, recuperação e avisos institucionais. Plano conforme volume e picos reais; domínio/remetente e operação exigem configuração/validação. Escolha não contrata plano, cria conta ou ativa envios |
| Estrutura das gravações — Q79 | Drive compartilhado do Google Workspace da escola, com arquivos na estrutura da organização. Informação fornecida pelo usuário; identificar Drive/conta de integração e validar permissões reais antes da operação |
| Domínio informado — Q80 | Escola confirmou domínio próprio e informou https://www.geniusidiomas.com/; registrar geniusidiomas.com como domínio informado. Resposta não identifica quem administra/acessa DNS nem escolhe remetente/subdomínio de envio; não comprova verificação no Resend |
| Reprodução das gravações — Q81 | C — Aluno assiste no ERP sem conta Google; ampliar F07.7 com player, reprodução e controle de acesso pelo servidor. Drive compartilhado permanece como fonte oficial. Validar desempenho, permissões e custos antes de operar; não comprova integração entregue |
| Download das gravações — Q82 | A — Somente assistir no ERP, sem recurso de download ou acesso offline. Manter reprodução autenticada de Q81; isso não promete impedir captura/cópia por outros meios nem confirma reposição ao assistir |
| Fonte para entrada em produção — Q84 | Usuário possui planilhas com alguns dados reais e quer aproveitar o máximo de dados reais na migração antes de iniciar produção. Primeira fonte mapeada em 10/09/2026; não confirma completude das fontes nem que a base atual do ERP seja descartável |
| Levantamento da migração — Q85 | [Checklist entregue](checklist-dados-migracao.md). Em 10/09/2026, recebida e analisada `Operacional Leticia (2).xlsx`: sete abas, cadastros e financeiro parcial. [Relatório com cobertura, divergências e complementos por equipe](analise-planilha-operacional-leticia.md). Inventário das demais fontes e conciliação pendentes; nenhuma carga executada |
| Particulares contratadas — Q86/Q91–Q94 | Mensalidade fixa ou preço por hora conforme contrato, separados da cota de reposições. Para preço por hora, duração contratada em minutos dividida por 60, aceitando frações; diferenças financeiras exigem ajuste aprovado. Cancelamento do aluno no prazo configurável sem cobrança; tardio/falta integral, sem presença fictícia. Pagamento posterior à apuração tem fechamento mensal discriminado |
| Antecipações de particulares — Q87/Q96/Q97 | Recebimento destinado a períodos/serviços ou crédito sem destinação. Na pausa, preservar saldo e suspender validade contratada; no encerramento, converter saldo não utilizado em crédito com memória de cálculo pelas condições originais e aprovação independente. Uso/devolução mantém Q68/Q69 |
| Cancelamento de particular pela escola — Q95 | Aluno escolhe remarcação ou crédito do valor já pago. Não cobrar/consumir como aula realizada; preservar recebimento, aplicar aprovações de agenda e financeiras e evitar duplicação |
| Empresa pagadora — Q88 | Responsável financeiro de contratos individuais e pagamentos vinculados aos alunos; sem contrato coletivo, cobrança consolidada ou portal empresarial nesta entrega. Pagadora não recebe acesso pedagógico automático |
| Permuta por aulas — Q89/Q98 | Pedagógico confirma serviço, Financeiro propõe e outra pessoa autorizada aprova compensação por período. Compensar apenas a parte comprovada conforme fórmula do acordo; restante devido nas condições aplicáveis, sem recebimento fictício |
| Dias de vencimento — Q90/Q99 | Permitir referência de 1 a 31, usando último dia do mês se faltar o dia. Regra explícita do contrato define manter a data ou prorrogar ao próximo dia útil financeiro; configurar referência aplicável, preservar data calculada/ajustada e não confundir feriados financeiros com calendário letivo |
| Reposição sem gravação recuperável — Q34 | Gestão escolhe gravação substituta equivalente com resumo/atividade ou particular excepcional sem consumir benefício e sem cobrança adicional; registrar escolha e motivo. Particular excepcional exige aprovação de outra pessoa da Gerência Pedagógica/Administração |
| Relato de gravação indisponível — Q57 | Aluno sinaliza problema na própria reposição com material autorizado; professor/equipe também registram no ERP. Gestão confere indisponibilidade e acompanha regularização, preservando conclusão da aula/histórico; troca de link segue Q23 e solução sem gravação segue Q34 |
| Interrupção do prazo por material indisponível — Q58 | Pausar contagem durante indisponibilidade confirmada pela escola, com início/fim registrados; material restabelecido retoma somente tempo restante, com nova data limite e histórico. Preservar entregas, permissões de Q36 e restrições vigentes |
| Prazos de entrega/correção — Q35 | Prazos configuráveis por etapa: primeira entrega a partir da disponibilidade real do material; prazo próprio para responder a cada pedido de correção. Gestão pode autorizar prorrogação com motivo registrado; sem valores numéricos presumidos |
| Entrega com prazo vencido — Q52 | Bloquear novos envios e mostrar pendência; gestão pode autorizar novo prazo com motivo para liberar a etapa. Professor pode avaliar entregas já registradas; vencimento não aprova/reprova automaticamente e pausa/encerramento mantém Q36 |
| Acesso durante pausa/encerramento — Q36 | Próprias reposições e avaliações em leitura; novas entregas bloqueadas, salvo autorização da gestão para pendência específica, com motivo e prazo. Novos pedidos exigem matrícula ativa; acesso à gravação continua sujeito ao contrato e às restrições vigentes |
| Benefício de particular — Q14 | Configurar por plano se permite reposições particulares, quantidade e período, mensal ou outro escolhido. Agendamento reserva disponibilidade do benefício |
| Referência do período da cota — Q49 | Configurável por plano: duração e calendário civil ou ciclo com data de referência da matrícula. Exigir configuração completa, mostrar início/fim da cota e não presumir quantidade ou prazo; reserva usa período da particular agendada |
| Vigência de mudança do benefício — Q50 | Nova configuração vale no próximo período de cada aluno; atual mantém sua regra. Honrar particulares autorizadas e considerar reservas antes de novas; se já ocuparem a nova cota, não abrir saldo adicional. Preservar histórico e condições contratuais aplicáveis |
| Consumo/devolução — Q16 | Prazo configurável: realização consome; cancelamento do aluno dentro do prazo devolve; cancelamento tardio ou falta consome. Cancelamento pela escola devolve; remarcação do mesmo pedido não consome duas vezes. Nenhum prazo numérico foi definido |
| Nova tentativa particular — Q51 | Após falta/cancelamento tardio, permitir outro pedido aprovado se plano/cota permitirem; manter consumo anterior. Gravação com resumo/atividade continua alternativa; nova tentativa não recebe gratuidade por si só e mantém Q11/Q34 |
| Saldo entre períodos — Q25 | Saldo livre não utilizado/não reservado expira ao terminar o período; o próximo recebe apenas sua cota. Preservar agendamentos autorizados e histórico |
| Período da particular — Q26 | Usar o período da particular agendada. Remarcar reserva ainda não consumida para outro período libera a anterior e reserva a nova, conferindo saldo antes de confirmar |
| Frequência regularizada — Q27 | Particular concluída e gravação com entrega aprovada regularizam frequência; distinguir presença original de regularização por reposição. Preservar a falta original e contar cada aula uma única vez |
| Frequência sob restrição — Q59 | Registrar “Impedido por restrição”, distinguindo de falta comum; manter aula na base de frequência, sem presença/regularização até reposição concluída. Professor recebe apenas informação operacional, sem detalhes financeiros; restrição e autorizações permanecem |
| Cota no período de entrada — Q60 | Disponibilizar quantidade integral do plano no período de entrada, mesmo parcial; consumo/reserva normal e expiração de saldo livre ao fim, sem acumulação ou proporcional da cota |
| Benefício na troca de plano — Q61 | Manter regra/cota atuais até o fim e aplicar novo benefício no período seguinte; honrar particulares autorizadas e considerar reservas antes de liberar saldo. Preservar usos, sem duas cotas no mesmo intervalo; preço/contrato/acerto seguem fluxo próprio |
| Conflito docente | Alertar e impedir criação de turma com sobreposição real de aulas do professor, considerando o período em que a nova turma começará |
| Indisponibilidade docente — Q39 | Professor solicita período e motivo; Secretaria/gestão também podem registrar. Outra pessoa da Gerência Pedagógica/Administração aprova. Bloquear novos agendamentos no período aprovado e deixar aulas existentes pendentes de solução aprovada, sem cancelamento/troca de professor automática |
| Substituição temporária docente — Q56 | Secretaria, Gerência Pedagógica ou Administração propõem substituto, aulas/período e motivo; outra pessoa autorizada da Gerência Pedagógica/Administração aprova/aplica. Preservar titular e autoria real de cada aula; acesso do substituto limitado aos encontros atribuídos |
| Modelo de cobrança — Q09 | Mensalidade sempre integral; a única exceção admitida pelo usuário é o encerramento da matrícula solicitado pelo aluno. A passagem A1 → A2 mantém a lógica mensal, sem converter o curso em pacote de aulas |
| Último período — Q12/Q15/Q28 | Proporcional por dias reais do período coberto até o último dia coberto, identificado conforme a regra do contrato sobre incluir/excluir o dia de encerramento. Apurar saldo/crédito e preservar recebimentos |
| Multa de encerramento — Q15/Q17 | Valor fixo ou percentual conforme o contrato aplicável à matrícula; no percentual, registrar também base de cálculo e condições da cláusula. Nenhum valor, percentual ou base padrão foi presumido |
| Aprovação do acerto — Q18 | Financeiro prepara; outro Financeiro com permissão de aprovação ou outra pessoa da Administração confere antes da efetivação. Dispensa/alteração de multa exige justificativa e autorização. Acumular papéis não permite autoaprovação |
| Último dia coberto — Q28 | ERP permite incluir ou excluir o dia efetivo de encerramento conforme regra registrada no contrato aplicável à matrícula; mostrar explicitamente o último dia coberto |
| Data retroativa de encerramento — Q31 | Normalmente usar data solicitada igual/posterior ao pedido; data anterior exige motivo, evidências e aprovação explícita no acerto. Preservar data do pedido e data efetiva; demora administrativa não desloca a data aprovada |
| Destino do crédito — Q29 | Manter crédito identificado para uso futuro; se o aluno solicitar devolução, Financeiro processa e registra. Apuração de crédito e execução da devolução são eventos distintos |
| Continuidade das mensalidades — Q30 | Gerar próximos períodos integrais automaticamente quando houver continuidade prevista no contrato e matrícula ativa, respeitando pausa/encerramento; sem essa previsão, solicitar renovação |
| Período de cobertura — Q62 | Referência definida no contrato da matrícula: mês civil ou ciclo mensal com data de referência registrada; guardar início/fim de cada período separados do vencimento. Contrato sem regra suficiente exige conferência; entrada e continuidade permanecem integrais |
| Ordem dos descontos no encerramento — Q63 | Método definido no contrato: suportar proporcional do valor líquido ou proporcional da base seguido do desconto, conforme condições aplicáveis. Registrar método e ordem; condição do desconto pouco clara exige conferência antes de aprovar; multa permanece separada |
| Emissão da continuidade — Q64 | Gerar cada nova mensalidade na antecedência configurada ao vencimento, revalidando contrato, matrícula e oferta; sem duplicar períodos, presumir renovação ou alterar cobranças antigas. Nenhuma antecedência numérica presumida |
| Início da pausa — Q65 | Pausa imediata na data registrada; manter integral o período iniciado e suspender os períodos seguintes abrangidos. Acesso passa às regras de matrícula pausada; preservar recebimentos e histórico, sem proporcional ou devolução automática pela parte não utilizada |
| Cobertura na retomada — Q66 | Reprogramar a cobertura dos períodos suspensos a partir do retorno, conforme referência contratual; manter separada a escolha entre vencimentos originais/reprogramados e aprovar cobertura e vencimentos na mesma proposta. Preservar períodos já iniciados, recebimentos e histórico; impedir sobreposição/cobrança duplicada |
| Indisponibilidade de continuidade — Q32 | Registrar indisponibilidade da escola e impedir novas mensalidades para períodos sem oferta. Retomar somente após regularizar oferta e condições da matrícula; preservar cobranças e pagamentos anteriores |
| Cobrança emitida para período inteiro sem oferta — Q67 | Aluno escolhe entre crédito e cobertura futura permitidos pelo contrato; Financeiro registra a escolha e prepara a proposta, aprovada por outra pessoa autorizada do Financeiro/Administração. Sem escolha ou dados suficientes, manter regularização pendente; preservar cobrança e recebimentos, sem duplicação |
| Indisponibilidade parcial — Q70 | Manter valor integral e recompor os dias de cobertura indisponíveis após o retorno, sem cobrança adicional pela compensação. Proposta financeira mostra extensão e início dos próximos períodos; outra pessoa autorizada do Financeiro/Administração aprova, conferindo contrato e impedindo sobreposição/cobrança dos dias compensados |
| Compensação restante no encerramento — Q83 | A — Acertar financeiramente os dias de compensação ainda devidos no encerramento; ajustar saldo, com possível crédito de valores já pagos. Financeiro prepara e outra pessoa autorizada aprova; preservar origem, pagamentos e dias já compensados, sem ajuste duplicado |
| Utilização de crédito — Q68 | Autorizar cada utilização: registrar solicitação/concordância do aluno, Financeiro propõe abatimento em cobranças identificadas e outra pessoa autorizada do Financeiro/Administração aprova antes de aplicar. Registrar origem, destino, valor e saldo; não transferir para outro aluno nem usar/devolver o mesmo saldo duas vezes |
| Execução de devolução — Q69 | Financeiro prepara pedido, saldo, valor e destino conferido; outra pessoa autorizada aprova. Preparador pode executar se também tiver permissão de execução, exigindo ao menos duas pessoas distintas. Registrar execução real/evidência; mudança de valor ou destino exige nova aprovação |
| Saldo devedor no encerramento — Q71 | Com concordância do aluno, Financeiro propõe cobrança final única com saldo/vencimento para aprovação independente. Vincular cobranças anteriores como substituídas, sem apagamento ou duplicidade; sem acordo, manter condições originais. Efetivar encerramento após acerto aprovado respeitando a data efetiva, sem esperar quitação |

O calendário único resolve a dúvida de precedência entre países. Escolher Brasil, Costa Rica ou outro fuso na consulta muda a exibição, não os dias letivos da escola.

A modalidade é uma configuração no modelo atual; o estado de conclusão pertence à turma. Q43 estendeu aumentos a todas as turmas não finalizadas, inclusive rascunhos e ainda não iniciadas; Q42 preserva a meta das turmas em andamento quando houver redução. Replanejamento não altera turmas concluídas ou registros passados.

## 2. Regras derivadas para manter o fluxo consistente

As condições abaixo conectam as decisões recebidas aos controles existentes. Detalhes ainda sujeitos a escolha são identificados como proposta.

- Atualizar a quantidade de aulas da modalidade exige aplicar o alcance definido em Q42/Q43, respeitando a aprovação de alterações da agenda oficial. Aumento alcança todas as turmas não finalizadas; redução preserva a quantidade anterior nas já iniciadas e só pode atingir ainda não iniciadas. Conforme Q41, ERP prepara impactos do conjunto afetado, a equipe resolve conflitos e outra pessoa da Gerência Pedagógica/Administração aprova e aplica o conjunto na mesma operação. Conflito em uma agenda publicada afetada impede a aplicação; não aprovar por turma ou por grupos nem dispensar a aprovação pela edição da configuração.
- Manter a configuração vigente e as agendas oficiais até aplicação válida do conjunto; a proposta identifica a versão anterior/nova e mostra exceções locais de Q37, quantidade de aulas, grade e término de cada turma afetada. Antes de aplicar, conferir novamente conjunto de turmas, versão examinada, permissões e conflitos. Nova turma afetada ou mudança relevante exige nova revisão; falha de aplicação preserva o estado anterior completo. Repetição não duplica encontros/remarcações e não altera turmas finalizadas ou registros passados.
- Q42 exige preservar a versão/meta de turmas já iniciadas quando a configuração diminuir; novas turmas usam a nova configuração e turmas ainda não iniciadas podem ser replanejadas com aprovação conjunta. Identificar explicitamente no impacto quais turmas conservam a meta anterior e por quê. Não apagar aulas ministradas ou encontros passados com pendência para caber na quantidade menor; não encerrar matrícula nem cancelar cobranças automaticamente.
- Conforme Q43, aumentos incluem turmas em andamento, ainda não iniciadas e rascunhos. Recalcular rascunho não o publica nem concede disponibilidade de professor; manter seu estado. Agendas publicadas afetadas entram no conjunto de Q41. A preparação de rascunho sem professor não substitui a validação exigida antes da publicação.
- Conforme Q44, turma sem professor pode ser salva e ter encontros simulados somente como rascunho. Bloquear publicação da agenda e alocação de alunos até designar professor válido/disponível e conferir conflitos/indisponibilidades no período real. Validar essas condições também nas operações do servidor, incluindo tentativa de alocar diretamente. Cadastros legados incompatíveis precisam de conferência na migração; não desfazer silenciosamente alocações existentes.
- Conforme Q48, no instante de início do primeiro encontro previsto não cancelado da agenda oficial, a turma passa automaticamente a em andamento. Rascunho/simulação não dispara início. Separar o marco temporal do preenchimento do diário: aula continua prevista até cumprir suas condições de conclusão. Se o processamento do status atrasar, operações de redução precisam conferir o marco efetivo e não tratar a turma como ainda não iniciada por um atraso da rotina.
- Gerência Pedagógica/Administração confirma a conclusão da turma somente depois de conferir a meta vigente cumprida por aulas ministradas elegíveis e as pendências de conclusão dessas aulas resolvidas. Registrar autor, data e condições conferidas; não concluir turma apenas pela previsão de término ou passagem do tempo. Conclusão da turma não aprova alunos, não executa transferência de nível, não encerra matrículas nem cancela mensalidades. Preservar registros e permissões históricas aplicáveis.
- Conforme Q37, duração e frequência começam herdadas da modalidade. Secretaria/gestão pode preparar uma exceção para a turma com valores anteriores/propostos, motivo, grade resultante, conflitos e previsão de término. Outra pessoa da Gerência Pedagógica/Administração precisa aprovar a versão examinada antes de publicar com esses valores, inclusive na criação; acumular papéis não autoriza autoaprovação.
- A exceção aprovada identifica turma, campos alterados, valores e origem da configuração. Não altera a modalidade, outras turmas ou a meta de quantidade de aulas do nível. Mudança posterior da exceção exige nova proposta/aprovação. Ao replanejar por alteração da modalidade, mostrar os valores herdados e as exceções existentes; não apagar nem substituir silenciosamente uma exceção aprovada. Revalidar frequência, duração, grade e conflitos antes da publicação; preservar encontros ministrados e registros passados.
- Mostrar quais turmas e encontros serão afetados, a meta anterior/nova e a previsão de término anterior/nova. O processamento deve preservar aulas ministradas e seus registros.
- Exemplo ilustrativo: meta de 25 passa a 30, com 10 aulas ministradas. A agenda deve representar o total de 30, preservando as 10 anteriores. Os encontros já previstos válidos devem ser reaproveitados; não gerar 30 aulas adicionais.
- Encontros passados com pendência docente continuam previstos. Não tratá-los como cancelados nem criar reposições ou cobranças automaticamente por falta de preenchimento.
- Solicitação de cancelamento e pendência de documentação são situações de acompanhamento distintas do estado final da aula. Cancelamento só se efetiva após aprovação; conclusão normal exige presenças e gravação. A exceção Q07 exige presenças, justificativa e decisão explícita de outra pessoa autorizada; acumular papéis não permite concluir a própria exceção.
- A reprovação de um cancelamento conserva a aula e o motivo da decisão. Ao aprovar, a gestão escolhe a reposição na grade ou em encontro extraordinário, com o conflito e a alteração de término visíveis antes da decisão. Se a data for feriado/recesso/férias, a proposta deve incluir explicitamente a exceção justificada de Q19, aprovada por outra pessoa da Gerência Pedagógica/Administração; escolher uma data extraordinária sozinho não dispensa essa condição.
- A exceção Q19 se vincula ao encontro autorizado. Não torna o dia letivo para todas as turmas nem altera a geração regular das demais agendas. Revalidar conflitos e condições da particular quando aplicável; a exceção de calendário não dispensa o benefício do plano nem amplia a visibilidade dos participantes.
- Conforme Q20, alteração de feriado/recesso que afete agendas publicadas gera uma proposta conjunta com todas as turmas afetadas, datas sugeridas, conflitos e previsões anteriores/novas de término. A equipe revisa e pode ajustar as sugestões antes da aprovação por outra pessoa da Gerência Pedagógica/Administração. Preservar aulas ministradas, encontros passados com pendências e registros históricos; não aplicar apenas parte da alteração global enquanto o restante permanece conflitante ou sem aprovação.
- Conforme Q21, aprovação e aplicação da proposta válida de calendário/agenda ocorrem na mesma operação, sem uma fila posterior de execução pela Secretaria. Revalidar permissões, versão examinada, conjunto de turmas afetadas e conflitos; se houver mudança relevante ou impedimento, exigir nova conferência antes de aprovar/aplicar. Uma falha não pode deixar só parte das agendas alterada. Repetir a operação não reaplica remarcações.
- Q21 trata de calendário/agenda. Reposição individual mantém autorização da gestão e agendamento pela Secretaria conforme Q11; encerramento financeiro continua com o acerto e a aprovação definidos em Q18.
- Conforme Q38, após aplicação efetiva de uma alteração aprovada, criar acompanhamento no ERP e avisos consolidados para alunos/responsáveis vinculados e autorizados à informação pedagógica, pelo WhatsApp institucional e também por e-mail quando houver endereço cadastrado para esse destinatário. E-mail é canal adicional, não apenas alternativa em caso de falha do WhatsApp. Ausência de e-mail não impede o canal WhatsApp nem exige cadastro inventado; manter os avisos docentes de Q22 dentro do ERP.
- Os avisos de Q38 identificam a alteração efetivada, a versão da agenda, datas/horários e fuso de referência. Proposta pendente, rejeitada ou cuja aplicação falhou não gera aviso de alteração concluída. Consolidar os encontros afetados por destinatário e alteração, sem expor contatos ou dados de outros alunos.
- Registrar destinatário, canal, versão comunicada, tentativas e resultado; envio solicitado não comprova entrega/leitura. Revalidar destinatário/autorização antes do envio. Repetir o processamento não duplica aviso já enviado no mesmo canal; enviar pelos dois canais escolhidos não é duplicação indevida. Falha/indisponibilidade de um canal não desfaz a agenda aplicada nem marca o outro como falho: criar pendência de comunicação para a Secretaria e preservar o resultado de cada canal. Sem destinatário autorizado, gerar pendência sem enviar a terceiros.
- Para o canal WhatsApp proativo de Q38, Administração escolhe explicitamente um número institucional `AGENDA` ativo da Meta Cloud e um template `utility` aprovado/sincronizado. O sistema não infere número de cobrança/vendas, não usa Baileys como caminho proativo e mantém o gate de ambiente desligado até homologação externa. O template deve corresponder ao idioma e aos parâmetros do snapshot antes do envio.
- Aula cancelada não conta como ministrada nem reduz automaticamente a meta do nível. Reposição deve manter vínculo com o encontro cancelado, evitar duplicação e recalcular a previsão sem apagar o histórico.
- Sobreposição deve ser verificada nas ocorrências e instantes reais, considerando começo/fim das turmas e períodos não letivos, não apenas professor + dia da semana + horário.
- Conforme Q45, interpretar início/fim dos dias não letivos no fuso institucional configurado, convertendo cada encontro real para essa referência ao conferir o calendário. Não usar a preferência de exibição ou a data local de cada turma como outro calendário. Guardar referência/versão usada; uma mudança do fuso institucional com impacto em agendas publicadas precisa da revisão/aprovação global aplicável, sem reescrever encontros passados ou liberar conflitos silenciosamente.
- Conforme Q46, a data inicial é o limite a partir do qual o gerador procura o primeiro dia/horário válido da grade; pular datas incompatíveis ou não letivas, mantendo quantidade de aulas. Mostrar data informada, primeira aula efetiva e término previsto antes da publicação. Não criar uma primeira aula extraordinária automaticamente para manter a data informada.
- Conforme Q47, calcular início/fim reais a partir do horário/fuso de origem e duração, permitindo data final no dia seguinte. Conferir sobreposição docente, indisponibilidade e calendário sobre o intervalo completo; início fora do bloqueio não basta se parte da aula entrar nele. Sobreposição com período não letivo exige exceção explícita de Q19. Exibir ambas as datas quando necessário; não truncar duração à meia-noite nem duplicar o encontro por atravessar dois dias.
- Conforme Q39, professor solicita sua indisponibilidade por período/motivo; Secretaria/gestão também podem registrá-la. Outra pessoa da Gerência Pedagógica/Administração aprova; acumular papéis não dispensa decisão independente. A solicitação fica visível para análise, mas Q39 não escolheu bloqueio provisório automático antes da aprovação.
- Indisponibilidade aprovada impede novos agendamentos, remarcações e particulares que sobreponham o período, com a mesma proteção em operações concorrentes. Mostrar encontros publicados afetados e abrir pendência de solução aprovada; a existência desses encontros não apaga a indisponibilidade aprovada. Não cancelar, remarcar, transferir autoria ou trocar docente automaticamente. Alterações da agenda mantêm revisão, aprovação e comunicação de Q21/Q38; particular mantém condições de Q11/Q16. O calendário letivo único permanece igual para os demais professores.
- Conforme Q56, Secretaria, Gerência Pedagógica ou Administração podem preparar proposta de substituição temporária com professor substituto, encontros ou período com aulas identificadas e motivo. Outra pessoa da Gerência Pedagógica/Administração aprova e aplica a versão válida, após conferir conflitos, indisponibilidade e escopo; autor não aprova a própria proposta. Solicitação/ausência aprovada não muda o docente antes dessa decisão.
- Preservar o titular da turma e atribuir cada encontro ao professor que o ministrará, registrando autoria real do diário. A substituição temporária dá ao substituto acesso às aulas atribuídas e aos dados necessários, sem transferir permanentemente a turma ou liberar contatos pessoais/financeiros. Encerrado o escopo, não manter edição ampla; histórico das próprias aulas e regularização pendente seguem as regras já definidas. Revisão de proposta após mudança dos encontros exige nova conferência; comunicação de alteração efetivada segue Q38.
- Exemplo ilustrativo: uma turma termina no dia 30 e a seguinte começa no dia 1 do mês seguinte no mesmo horário. Isso não constitui conflito. Se uma prorrogação posterior fizer as aulas coincidirem, será necessário resolver o conflito antes de aplicar a alteração.
- A mesma proteção contra sobreposição deve valer na publicação, na aprovação de mudanças e em operações concorrentes; caso contrário, uma turma inicialmente válida pode tornar-se conflitante por outra operação.
- Ausência individual não cancela a aula da turma. Repor essa ausência também não remarca automaticamente a turma inteira nem prolonga sua cobrança.
- Preservar o registro da falta na aula original e vinculá-lo à reposição concluída. Na apresentação ao usuário, mostrar “Reposta em [data]”. Solicitar, autorizar, agendar ou disponibilizar a gravação não basta para conceder esse resultado.
- Conforme Q55, na reposição gravada concluída, mostrar “Reposta em [data da validação do professor]” e conservar a data da versão entregue/aprovada nos detalhes. Guardar entrega e validação como acontecimentos distintos, com seus autores; envio não produz o estado de reposição concluída. Particular mantém a data de realização. Correções continuam seguindo Q54, preservando os registros anteriores.
- Na particular, confirmar realização da aula e presença do aluno. Conforme Q16, uma falta na própria reposição consome o benefício, mas não conclui a recuperação da aula original. Na opção gravada, registrar a gravação disponibilizada e as versões entregues do resumo e da atividade. Conforme Q13, somente a confirmação do professor designado conclui essa reposição; acesso ao link, envio ou pedido de correção não concluem.
- Preservar avaliação, pedido de correção, nova entrega, autoria e datas. Conforme Q40, Gerência Pedagógica/Administração pode designar outro professor para avaliar a reposição, registrando motivo, responsável anterior/novo e momento da mudança. O substituto recebe acesso limitado à reposição e aos materiais necessários; avaliações anteriores conservam seus autores. A designação não transfere vínculo de turma nem permite acesso pessoal/financeiro adicional. Gestão não assume automaticamente o papel de avaliador; Q40 escolheu outro professor.
- Encerrar a capacidade de novas avaliações do responsável anterior por aquela designação, sem apagar atos ou retirar leituras que tenham fundamento em outra permissão vigente. Revalidar avaliador atual no envio da decisão; mudança concorrente de designação não pode publicar avaliação em nome de responsável que já perdeu a atribuição. Conservar prazo do aluno; prorrogação exige registro conforme Q35. Q40 é distinta da designação de regularizador de pendência de aula de Q24.
- Q22 mantém os avisos de pendência no ERP, com prazo e intervalo configuráveis e alerta à Gerência Pedagógica após vencimento. Professor consulta somente pendências no seu escopo. Regularização resolve a pendência e encerra seus lembretes; repetição da rotina não duplica avisos do mesmo ciclo.
- Conforme Q23, corrigir aula concluída exige proposta justificada e aprovação de outra pessoa da Gerência Pedagógica/Administração, inclusive para conteúdo e link. Preservar antes/depois e revalidar dados e efeitos em frequência/reposições antes de publicar; mudança relevante exige revisão. Acumular papéis não permite aprovar a própria correção.
- Conforme Q53, calcular a lista de alunos elegíveis na data/instante da aula usando os vínculos e situações históricos. Transferência, pausa ou encerramento posteriores não retiram o aluno de uma chamada passada; entrada posterior não o acrescenta. Não usar somente a lista/status atuais para o primeiro lançamento atrasado. Histórico insuficiente gera conferência, sem inventar presença ou presumir vínculo a partir do estado atual.
- Lista histórica não equivale a autorização docente: o responsável precisa de acesso vigente à aula, pelo vínculo aplicável ou designação restrita de Q24. Não reabrir o acesso geral de professor desvinculado nem dados pessoais/financeiros desnecessários. Primeira chamada atrasada de aula pendente e correção de aula já concluída são operações distintas; a segunda continua exigindo Q23.
- Conforme Q24, designação para regularizar pendência registra gestor, responsável, aula e motivo. O acesso se limita à pendência atribuída, preserva o professor original da aula e não libera a turma inteira nem dados pessoais/financeiros. Após resolução ou revogação, não há nova edição amparada por aquela designação. Usar evidências disponíveis; eventual falta de gravação continua sujeita à aprovação independente de Q07. Correção de aula concluída continua sujeita a Q23.
- Conforme Q14, distinguir benefício permitido, limite do período, reservas e utilizações. Ao agendar, revalidar disponibilidade docente e saldo; concorrência não pode reservar a última unidade duas vezes e repetição não cria nova reserva. Q25 impede acumulação; Q49 define referência configurável; Q50 aplica mudanças somente no próximo período de cada aluno, sem reiniciar saldo por edição.
- Conforme Q49, configuração do plano identifica duração do período e referência pelo calendário civil ou por ciclo com data registrada na matrícula. Exigir parâmetros e referência completos antes de reservar, mostrar início/fim e aplicar a cota que contém a data da particular conforme Q26. Não inferir uma nova data de referência a cada pedido/agendamento nem reiniciar ciclo pela remarcação; manter períodos identificáveis, sem lacunas/sobreposição artificial e com regras usadas no histórico.
- Conforme Q60, entrada no meio de um período disponibiliza a quantidade integral prevista no plano para aquele período, sem proporcionalidade por dias. Usos e reservas consomem a cota normalmente; saldo livre expira conforme Q25. Isso não permite agendar antes da elegibilidade da matrícula, reiniciar saldo com nova alocação/retomada no mesmo período ou criar duas cotas para a mesma cobertura; mensalidade mantém sua regra própria.
- Conforme Q61, uma troca de plano autorizada preserva benefício/cota do período atual e aplica o novo benefício no seguinte. Registrar plano/versão anterior e novo, data da troca autorizada e início de vigência do benefício; não confundir essa troca com edição de configuração de Q50. Honrar particulares já autorizadas e computar suas reservas antes de aceitar novas; se ocuparem ou ultrapassarem o limite aplicável, saldo livre fica zero, sem apagar reservas/utilizações.
- Mudança de duração/referência do benefício respeita a fronteira do período vigente e não produz cota duplicada. Q61 define como as reposições recebem uma troca de plano autorizada; não autoriza por si só alteração de preço/contrato, devolução, novo acordo ou a efetivação comercial/financeira dessa troca.
- Conforme Q50, preservar a regra e datas do período vigente ao alterar quantidade, duração ou referência do benefício; nova configuração passa a valer no próximo período de cada aluno, respeitando condições contratuais aplicáveis. Identificar versões e vigência por período, sem recalcular usos passados ou iniciar uma cota nova no meio da vigente. A transição entre referências precisa conservar cobertura sem duplicação de período/cota.
- Honrar particulares já autorizadas quando o benefício mudar. Ao calcular disponibilidade sob a nova regra, considerar reservas existentes para aquele período e impedir saldo extra quando já ocuparem ou ultrapassarem o novo limite; manter saldo para novas reservas em zero nesse caso, sem apagar reservas nem cancelar agendamentos silenciosamente. Registrar condições usadas na autorização e na transição; Q50 não devolve consumo anterior nem permite acumulação de saldo livre.
- Conforme Q25, expirar apenas saldo livre no fim do período, preservando reservas, utilizações e histórico. Liberar posteriormente saldo de período encerrado não o transforma em cota disponível de outro período; a próxima cota não recebe acumulação.
- Conforme Q16, converter reserva em utilização por realização, cancelamento tardio do aluno ou falta; cancelamento do aluno dentro do prazo configurado e cancelamento pela escola devolvem a reserva. Registrar momento, autoria, motivo e regra aplicada sem duplicar consumo/devolução. Q26 permite mudar de período somente a reserva ainda não consumida, sem desfazer consumo anterior por falta/cancelamento tardio.
- Conforme Q51, falta ou cancelamento tardio de uma particular permite nova solicitação ligada à mesma aula original, com nova aprovação de Q11 e conferência de plano, cota e disponibilidade. Preservar a tentativa anterior e seu consumo; não reabrir uma reserva já consumida como se a nova data fosse simples remarcação de Q26. A nova tentativa reserva sua própria unidade quando autorizada/agendada; formatos não podem regularizar a mesma falta duas vezes. Manter alternativa gravada e aplicar Q34 somente quando sua causa específica existir, sem gratuidade automática por repetição.
- Conforme Q26, usar a cota do período da data agendada. Ao remarcar para outro período, conferir benefício, saldo de destino e disponibilidade docente antes de confirmar; liberar origem e reservar destino na mesma operação. Se faltar saldo ou houver conflito, preservar reserva e agendamento anteriores. Manter o vínculo com a aula original.
- Q27 permite que particular concluída e entrega gravada aprovada regularizem o critério de frequência. Distinguir presenças originais de aulas regularizadas e usar a mesma base de aulas elegíveis nos indicadores; a reposição recupera a falta original sem acrescentar outra aula à base. Repetição, uso dos dois formatos ou correção da presença original não contam o mesmo encontro duas vezes. Preservar falta original e evidência de reposição; outros critérios de avaliação/progressão e percentuais mínimos continuam próprios.
- Conforme Q59, quando restrição registrada impediu acesso à aula, guardar situação operacional “Impedido por restrição” distinta da falta comum. Manter esse encontro na base da frequência, sem presença/crédito de regularização enquanto não houver reposição concluída. Após conclusão válida, regularizar uma vez conforme Q27, preservando o impedimento original e a evidência da reposição.
- Considerar o impedimento que afetou o encontro, sem usar a restrição atual para reclassificar aulas passadas ou apagar presença já registrada. Remover uma restrição não concede frequência retroativa. Professor consulta somente informação operacional necessária; valores, débitos e detalhes financeiros ficam fora dessa projeção, inclusive na resposta do servidor. Correções continuam seguindo Q23/Q54; Q59 não remove bloqueio de acesso nem define aprovação acadêmica.
- Conforme Q54, toda correção de reposição já concluída exige proposta com motivo do professor designado vigente ou da gestão, seguida de aprovação/publicação por outra pessoa da Gerência Pedagógica/Administração. Preservar entrega, avaliação, decisão anteriores e autoria; acumular papéis não permite autoaprovação. Resultado vigente permanece enquanto a proposta não for aplicada validamente.
- Antes de aplicar a correção, conferir versão, vínculo com a falta original, permissão, frequência regularizada e movimentos do benefício afetados; mudança relevante exige revisão. Publicar correção e efeitos consistentes na mesma operação, mantendo histórico e sem duplicar regularização, consumo ou devolução. Corrigir dado da aula original exige também Q23; proposta sobre reposição não autoriza alterar registros de outra aula/aluno fora do escopo.
- Q10 definiu particular condicionada ao plano e gravação com resumo/atividade, sem transferência ou segunda alocação permanente. Q34 acrescenta exceção específica quando não existe gravação recuperável: gestão escolhe gravação substituta equivalente ou particular excepcional aprovada, sem consumo de benefício e sem cobrança adicional. Restringir acesso à reposição e aos materiais necessários.
- Em Q34, identificar a causa, a aula perdida, a escolha pedagógica e o motivo. Particular excepcional depende de aprovação de outra pessoa da Gerência Pedagógica/Administração, continua sujeita a disponibilidade docente e conclusão com presença/documentação, mas não reserva/consome a cota normal. Não gerar cobrança adicional, novas exceções por repetição ou frequência regularizada por falta nessa particular.
- Conforme Q57, permitir ao aluno relatar indisponibilidade somente na própria reposição e em material ao qual tenha acesso autorizado; professor/equipe também registram. Relato identifica aula/reposição/material, autor e momento, sem validar a alegação automaticamente. Gestão confere a indisponibilidade e acompanha a pendência; múltiplos relatos do mesmo problema não criam correções ou prorrogações duplicadas.
- Confirmar problema do material não desfaz aula ministrada, presenças ou histórico; distinguir a pendência de material de pendência de conclusão docente. Troca de link/dados da aula segue aprovação de Q23; falta de gravação recuperável na reposição segue Q34. Q57 não inclui verificação periódica automática de acesso a provedor externo; registro e conferência humana foram escolhidos.
- Gravação substituta de Q34 deve ser identificada como substituta, pedagogicamente equivalente e autorizada para aquele público; não sobrescrever a ausência da gravação original nem transformar o material substituto em nova aula da turma. Resumo/atividade seguem avaliação de Q13 e regularização de Q27.
- Q33 introduz área autenticada limitada às reposições do próprio aluno, materiais autorizados, envio de resumo/atividade e acompanhamento de avaliação/correções. Autenticação não concede papel interno de funcionário nem acesso a outros alunos; conferir vínculo na leitura, envio e acesso a arquivos. Projeções e decisões de gestão/financeiro permanecem restritas.
- Conforme Q72, a área de reposições usa e-mail e senha, com convite individual após conferência do vínculo com o cadastro correto. Aluno define sua senha; recuperação usa link de uso único com validade enviado ao e-mail verificado. A equipe pode iniciar o fluxo autorizado, mas não consulta, escolhe ou envia a senha pessoal do aluno.
- Conforme Q77, usar Google Drive como fonte oficial, identificando arquivo e vínculo com aula/reposição. Q81 acrescenta leitura/transmissão pelo servidor para o aluno assistir no ERP, sem conta Google. Zoom pode permanecer como ferramenta de gravação; não inclui captura automática, transferência do acervo entre serviços ou publicação direta do Zoom ao aluno. Registrar/conferir materiais legados antes da publicação nesse fluxo.
- Conforme Q79, preparar a integração para o Drive compartilhado do Workspace da escola: identificar Drive autorizado e validar capacidades da conta de integração e permissões de arquivos/pastas, inclusive herança. Conforme Q81, essa identidade fica no servidor; não exigir conta Google do aluno nem criar concessão direta a ele para viabilizar o player. A informação de estrutura organizacional não comprova acesso real da integração.
- Integrar autorização do ERP com leitura autorizada da fonte no Drive. O servidor confere o aluno e o material permitido antes de transmitir metadados ou conteúdo, inclusive novos trechos/retomadas. Preservar Q36 e restrições contratuais/acadêmicas; não expor credenciais nem redirecionar o aluno para um link público. Conferir e tratar acessos públicos/diretos legados que possam contornar o controle; esconder um link não retira essas permissões. Falha de acesso ou revogação exige estado/pendência rastreável, sem sucesso fictício.
- Conforme Q78, Resend será o serviço de envio automático de convites, recuperação de conta e avisos de Q38. Preparar domínio/remetente verificados, credencial restrita no servidor, fila, registro por finalidade/destinatário e processamento de eventos de entrega/falha. Credenciais, domínio, plano e envios reais ainda não foram configurados por esta decisão.
- Conforme Q80, registrar geniusidiomas.com como domínio informado pela escola, a partir de https://www.geniusidiomas.com/. Identificar responsável/acesso ao DNS e definir domínio ou subdomínio de envio, remetente e destino de respostas antes de habilitar a operação. A resposta não confirma o domínio do tenant Workspace, verificação DNS no Resend ou configuração do site; não inventar endereço de remetente ou marcar domínio verificado por existir um site.
- Conforme Q81, ampliar F07.7 com player e transmissão autenticada pelo servidor, mantendo login do aluno conforme Q72. Controlar acesso por material e requisição; validar reprodução, avanço/retomada, cancelamento de fluxo, retirada de acesso, compatibilidade, consumo de banda/memória e limites/custos da fonte e da hospedagem. Abrir ou terminar o vídeo não regulariza frequência nem aprova reposição. Q82 definiu somente assistir: não oferecer recurso de download ou acesso offline.
- Conforme Q82, não criar botão/rota dedicada à cópia offline da gravação, modo offline ou cache de vídeo para uso offline no aplicativo. A leitura de trechos pela API e o buffer necessário à reprodução continuam permitidos em Q81. Isso descreve funcionalidades do ERP, sem prometer impedir captura de tela ou recuperação dos bytes já recebidos; não adicionar DRM ou exceção de download por inferência.
- Conforme Q84, preparar migração das planilhas reais antes da entrada em produção: identificar fontes, mapear dados/relações, conferir lacunas e duplicidades e validar os conjuntos importados. Maximizar aproveitamento de dados reais não autoriza fabricar informação ausente, presumir consentimentos ou comprovar pagamentos/contratos por um status cadastral. A primeira fonte foi analisada em 10/09/2026 e os complementos estão documentados; não há autorização de exclusão de dados por essa resposta.
- A escolha do Resend não fixa plano gratuito ou pago: selecionar a capacidade conforme volume mensal e picos reais. Respeitar limites e revalidar destinatário, finalidade, versão do conteúdo e validade de convite/recuperação antes do envio; reexecução não duplica mensagem. Distinguir intenção, aceitação pelo provedor, entrega/falha e eventual confirmação do usuário; um estado não comprova os demais.
- Conforme Q73, se faltar e-mail individual, Secretaria orienta aluno/responsável a providenciar e verificar o endereço antes do convite e registra pendência de acesso até a regularização. Convite e recuperação seguem Q72 após a verificação; não inventar endereço, compartilhar conta de turma ou criar cadastro acadêmico duplicado. A pendência de acesso não adiciona requisito financeiro para ativar matrícula.
- Q73 não incluiu caixa institucional fornecida pela escola nem acesso próprio do responsável às reposições. A ajuda do responsável para providenciar endereço não transfere a autoria das atividades nem concede acesso ao portal; avisos autorizados de Q38 continuam distintos de identidade/permissão de acesso.
- Conforme Q74, a recuperação por perda do e-mail verificado exige solicitação preparada pela Secretaria ou Administração. Conferir identidade e vínculo, validar novo endereço e registrar motivo, evidências da conferência, autor e decisão. Somente outra pessoa da Administração pode aprovar e aplicar a troca; Secretaria não aprova essa operação e acúmulo de papéis não permite autoaprovação.
- A aprovação de Q74 corresponde ao aluno, endereço anterior/novo e versão conferidos. Revalidar permissões, vínculo, endereço validado e estado da conta antes de aplicar; alteração relevante exige nova conferência/aprovação. Aplicar a troca invalidando links e sessões anteriores e emitir novo fluxo de recuperação de Q72. Até a aplicação, solicitação pendente não transfere acesso ao endereço proposto; equipe não define, consulta ou recebe a senha do aluno.
- Repetição ou concorrência na recuperação assistida não cria contas ou convites válidos duplicados, não aplica endereço de proposta substituída e não reabre sessão revogada. Registrar falha de entrega do novo fluxo sem expor credencial nem marcar a recuperação como concluída antes de sua realização; reenvio deve respeitar uso único/revogação e endereço aprovado.
- A conta de acesso mantém identidade vinculada ao aluno independentemente de mudanças cadastrais. Não criar outro aluno por aceitar convite, reutilizar senha de funcionário ou herdar papéis internos por coincidência de e-mail. Troca de e-mail cadastral não transfere silenciosamente o acesso; aluno sem endereço próprio segue Q73 e recuperação assistida segue Q74.
- Especificar convites/recuperação com tokens individuais armazenados de forma segura, expiração, uso único e limitação de tentativas. Link expirado, revogado, reutilizado ou de outra conta não define senha nem abre acesso. Manter respostas que não exponham existência da conta, senha ou token em consultas/listagens/logs; alteração de senha e sessão precisam de validação no servidor. Q36 continua limitando ações conforme situação da matrícula.
- Conforme Q35, registrar quando o material fica efetivamente disponível e iniciar daí o prazo configurado da primeira entrega. Cada pedido de correção publicado ao aluno inicia prazo próprio configurado para resposta; preservar versões e avaliações anteriores. Prorrogação exige autorização da gestão com motivo e datas anteriores/novas no histórico. Não concluir reposição pelo relógio nem reiniciar prazo arbitrariamente em uma repetição da operação.
- Conforme Q52, ao vencer o prazo da etapa, bloquear novos envios de resumo/atividade ou correção e mostrar a pendência. Revalidar etapa, prazo e autorização no servidor ao receber a entrega; simples abertura prévia da tela não mantém permissão depois do vencimento. Prorrogação autorizada pela gestão registra motivo, autor e prazo anterior/novo e libera somente a etapa correspondente.
- Conforme Q58, indisponibilidade de material confirmada pela escola suspende a contagem da etapa afetada pelo intervalo registrado. Guardar início/fim efetivos conferidos, confirmação, responsável, prazo anterior e tempo restante no início da interrupção. Restabelecido o material, retomar apenas esse tempo e registrar nova data limite; não conceder prazo integral automaticamente.
- Preservar entregas/avaliações já registradas e impedir que repetição ou sobreposição do mesmo incidente devolva tempo duas vezes. Se o prazo já tinha vencido antes de começar a indisponibilidade, não havia tempo restante: eventual liberação exige prorrogação de Q35/Q52. Antes da primeira disponibilidade, vale Q35. Ajuste de prazo não remove restrição de conteúdo nem substitui autorização específica de Q36; envio/avaliação mantêm as permissões e etapas aplicáveis.
- Vencimento não apaga versões nem impede o professor designado de avaliar o que já foi registrado; não aprova, reprova ou regulariza frequência pelo relógio. Em pausa/encerramento, prorrogação de Q35/Q52 não substitui liberação específica de Q36 e essa liberação não estende sozinha o prazo da entrega; ambas as condições precisam estar válidas.
- Conforme Q36, a pausa ou o encerramento da matrícula preserva a consulta às próprias reposições, entregas e avaliações em leitura. Bloquear novos envios de resumo, atividade e correções, salvo liberação da gestão para uma pendência específica, com motivo e prazo registrados. Validar matrícula, pendência, etapas permitidas e validade da autorização também no servidor, a cada envio; vencimento ou revogação encerra a liberação sem apagar o histórico.
- A liberação de Q36 se limita às entregas da pendência autorizada; não autoriza novos pedidos, agendamento de novas particulares, retomada da matrícula ou remoção de bloqueio de aulas. Novos pedidos exigem matrícula ativa e continuam sujeitos às demais condições de autorização do fluxo. Gravações permanecem sujeitas ao contrato e aos controles de acesso vigentes. O prazo de liberação e o prazo de entrega de Q35 precisam estar válidos; eventual prorrogação é explícita, motivada e registrada, sem reinício automático pela pausa.
- Q11 separa autorização do pedido e execução pela Secretaria. A autorização pedagógica precisa identificar a aula perdida e a proposta de reposição; na particular, conferir permissão do plano e disponibilidade. Quem registra o pedido não o aprova acumulando papéis. A aprovação inicial não substitui a comprovação de conclusão acadêmica.
- A resposta Q09 substitui a hipótese anterior de proporcionalidade por entrada, atraso ou mudança de nível: a mensalidade permanece integral. Q12/Q15 confirmaram proporcionalidade por dias reais no encerramento solicitado, com apuração de saldo/crédito. Q62 define a referência contratual de cobertura; Q63 define a ordem contratual dos descontos; Q18 exige aprovação independente antes da efetivação, sem presumir devolução automática.
- Cálculo do encerramento conforme Q15/Q28/Q62/Q63: identificar dias reais do período de cobertura e dias cobertos até o último dia contratualmente incluído. Se o contrato determina desconto antes do proporcional, aplicar os descontos válidos ao valor mensal e depois multiplicar pela fração de dias; se determina desconto depois, calcular o proporcional da base e então aplicar os descontos conforme suas condições. Registrar e exibir a ordem, sem aplicar o mesmo desconto duas vezes. Vencimento não define início da cobertura; divisor não é fixado em 30. Exemplo sem desconto, apenas aritmético: R$ 310,00 em período de 31 dias e 10 dias cobertos resulta em R$ 100,00 antes de multa e acerto dos recebimentos.
- A regra de inclusão/exclusão de Q28 deve corresponder ao contrato aplicável, com sua referência registrada na memória do acerto. Não escolher inclusão por padrão para contratos sem regra identificada nem alterar a regra histórica por edição de configuração geral; pendência de informação exige conferência antes da aprovação.
- Conforme Q62, registrar na matrícula a referência do período financeiro prevista no contrato: mês civil ou ciclo mensal com data de referência. Cada mensalidade identifica início/fim da cobertura, competência e vencimento como informações distintas. Regra insuficiente exige conferência; não inventar cobertura a partir de vencimentos legados nem usar uma edição de configuração para reescrever períodos anteriores. A regra não cria proporcional na entrada/continuidade.
- Conforme Q63, suportar os dois métodos contratuais de desconto no encerramento e registrar o método aplicável à matrícula/acerto, a base, os descontos válidos, suas condições, a fração de dias e a ordem de cálculo. A escolha entre os métodos depende do contrato. Informação insuficiente impede aprovar o cálculo até conferência. Multa continua separada, recebimentos preservados e decisão vinculada à versão examinada.
- Exemplo de aceite de Q63, sem definir preços da escola: base de R$ 500, desconto fixo válido de R$ 100 e metade do período resulta em R$ 200 com desconto antes do proporcional, ou R$ 150 com desconto integral depois quando essa for a condição contratual. Exibir a diferença na memória, sem converter o exemplo em parâmetro padrão.
- Conforme Q31, registrar separadamente data do pedido, data efetiva solicitada e data aprovada. Retroatividade exige motivo, evidências e aprovação explícita por outra pessoa autorizada no acerto de Q18; a data histórica do pedido não é alterada para simular ausência de retroatividade. Recalcular impactos nas cobranças mantendo recebimentos e histórico; inclusão/exclusão do dia permanece conforme Q28.
- Conforme Q29, crédito apurado permanece identificado para utilização futura. Encerrar matrícula não apaga crédito nem gera devolução automática. Solicitação do aluno inicia processamento pelo Financeiro, que registra a execução efetiva e preserva o recebimento original. Impedir uso e devolução duplicados do mesmo saldo; apuração de crédito não comprova devolução executada.
- Conforme Q71, encerramento com saldo devedor é efetivado após aprovação do acerto, respeitando a data efetiva sem aguardar pagamento. A dívida permanece rastreável para acompanhamento. Com concordância registrada do aluno, Financeiro propõe uma cobrança final única que identifica saldo, vencimento e cobranças de origem; outra pessoa autorizada do Financeiro/Administração aprova antes da consolidação.
- Na consolidação aprovada de Q71, vincular cobranças anteriores como substituídas e retirar sua exigibilidade para evitar cobrança duplicada, preservando valores, recebimentos, ajustes e histórico. Registrar a composição do saldo final e as operações já consideradas, sem registrar pagamento fictício nas originais nem criar desconto, perdão, juros ou mudança de condições além do que foi autorizado.
- Sem concordância do aluno, manter as cobranças devidas nas condições originais, com os ajustes de encerramento já aprovados; a ausência de acordo não posterga a data efetiva de encerramento. Parcelamento não foi escolhido como regra de Q71; eventual renegociação futura depende de escopo/proposta próprios.
- Revalidar concordância, saldos, recebimentos, créditos, versão da proposta e permissões antes de consolidar. Mudança relevante exige nova aprovação; repetição/concorrência não gera segunda cobrança final nem deixa saldo original e consolidado simultaneamente exigíveis. Cobranças/recebimentos externos posteriores relativos a uma origem substituída precisam de conciliação com o vínculo de consolidação, sem perder pagamento nem cobrar novamente.
- Conforme Q68, cada utilização do crédito exige solicitação ou concordância registrada do aluno, proposta do Financeiro com cobranças de destino identificadas e aprovação de outra pessoa autorizada do Financeiro/Administração antes de aplicar. Crédito disponível não gera abatimento automático; concordância genérica com usos futuros não substitui a decisão da utilização proposta. Registrar origem do crédito, destino, valor aplicado e saldo restante, preservando cobrança e recebimento original.
- Revalidar titular do crédito, cobranças do próprio aluno, saldos, versão da proposta e permissões antes do abatimento. Não permitir transferência para outro aluno. Impedir que duas propostas, um pagamento concorrente ou uma devolução consumam o mesmo saldo; mudança relevante exige revisão/aprovação antes de aplicar, sem saldo negativo nem quitação duplicada. Uso de crédito é operação identificada, não um novo recebimento em dinheiro.
- Conforme Q69, a devolução parte do pedido do aluno e de proposta financeira que identifica saldo disponível, valor e destino conferido. Outra pessoa autorizada do Financeiro/Administração aprova antes da saída. O preparador pode executar após essa aprovação somente se possuir permissão específica de execução; preparar, aprovar e executar são capacidades distintas, e acumular papéis não autoriza aprovar a própria proposta.
- Registrar execução efetiva, responsável e evidência da devolução, preservando pedido, proposta, decisão e recebimentos originais. Aprovação não marca dinheiro como devolvido. Alteração de valor ou destino exige nova aprovação; revalidar saldo e autorização antes da execução e impedir uso/saída duplicados. Resultado externo incerto exige conciliação antes de repetir a transferência, sem registrar sucesso fictício.
- A multa admitida em Q15 deve aparecer separada do proporcional, identificando a cláusula e as condições do contrato aceito aplicável à matrícula. Não aplicar multa quando não houver previsão; informação contratual incompleta exige conferência, não um percentual inventado. Não confundir esta multa com juros/multa por atraso.
- Registrar a versão das condições contratuais usada no acerto; uma edição posterior de configuração geral não modifica silenciosamente contratos anteriores. Q17 permite valor fixo ou percentual; cada regra precisa dos parâmetros e condições da cláusula, incluindo base explícita no percentual. Não inferir percentual, saldo futuro ou valor padrão a partir da existência de um contrato.
- Conforme Q18, Financeiro prepara e outra pessoa do Financeiro com permissão de aprovação ou da Administração aprova antes da efetivação. Registrar proposta, cálculo, autor, aprovador e decisão. Dispensa/alteração de multa exige justificativa e autorização; a mesma pessoa não pode preparar e aprovar, mesmo acumulando papéis.
- A aprovação corresponde à proposta examinada. Mudanças de data, valores, condições contratuais ou recebimentos que alterem o acerto exigem revalidação e nova aprovação. Preservar a data efetiva aprovada sem acrescentar dias por demora administrativa. Aprovação não autoriza apagar recebimentos nem devolução automática de crédito; Q71 confirma encerramento após aprovação do acerto sem aguardar quitação.
- Conforme Q30, continuar gerando períodos integrais após o cronograma inicial somente com previsão contratual e matrícula ativa, respeitando pausa/encerramento e a indisponibilidade de Q32. Sem previsão, solicitar renovação; aulas previstas ou diário pendente não autorizam extensão. A passagem A1 → A2 não duplica período. Identificar contrato aplicável e impedir duplicação em concorrência; D13 mantém suas aprovações.
- Conforme Q64, a emissão de cada mensalidade adicional ocorre quando alcançar a antecedência configurada ao vencimento. Exigir configuração válida, sem número presumido, e revalidar continuidade contratual, situação da matrícula e oferta de Q32 no momento da operação. Reexecução, concorrência ou mudança da antecedência não duplicam um período nem alteram uma cobrança já emitida. A passagem do prazo não autoriza recuperar cobranças de períodos suspensos ou dispensar renovação; D13 mantém suas aprovações.
- Conforme Q65, a pausa passa a valer imediatamente na data registrada e o acesso segue as regras de matrícula pausada, inclusive Q36. A mensalidade do período de cobertura já iniciado permanece integral, ainda que seu vencimento seja posterior à pausa; suspender os períodos seguintes abrangidos. Preservar recebimentos, débitos e histórico, sem converter a parte não utilizada em proporcional, desconto, crédito ou devolução automática.
- Classificar as mensalidades afetadas pela cobertura contratual de Q62 e pela data efetiva da pausa, não apenas pelo vencimento. Registrar a origem da suspensão e os períodos alcançados, distinguindo pausa de cancelamento por outra causa e da indisponibilidade da escola de Q32. Falta de cobertura confiável no legado exige conferência, sem inventar datas.
- Conforme Q66, a proposta de retomada reprograma a cobertura das mensalidades de períodos ainda não iniciados quando suspensos pela pausa, a partir do retorno e conforme a referência contratual de Q62. Apresentar início/fim anteriores e propostos de cada cobertura ao lado dos vencimentos anteriores/propostos. Manter a escolha de D13 entre vencimentos originais ou reprogramados: mudar cobertura não escolhe vencimento nem cria quitação.
- Aprovar cobertura e vencimentos na mesma proposta de D13, por outra pessoa autorizada; enquanto pendente, manter a pausa e os dados oficiais. Revalidar data do retorno, cobertura, parcelas, contrato, recebimentos e versões na aprovação; mudança relevante exige revisão e nova decisão. Aplicar o conjunto válido na mesma transação, sem duplicar parcelas, apagar recebimentos ou alterar valores/benefícios por conta própria.
- Preservar períodos já iniciados, inclusive quando o retorno ocorre dentro de uma cobertura preservada: a nova distribuição não pode sobrepor ou cobrar novamente esse intervalo. Mostrar a primeira cobertura efetiva conforme contrato; manter vencimento original pode conservar atraso, conforme D13, e precisa aparecer explicitamente na proposta. A reprogramação não autoriza gerar cobrança retroativa de período marcado sem oferta pela escola.
- Conforme Q32, registrar período e motivo da indisponibilidade de continuidade da escola, com autoria e histórico, e impedir nova emissão para períodos sem oferta. Regularizar oferta e condições da matrícula antes de retomar; retomada não gera retroativamente mensalidades dos períodos marcados sem oferta. Não apagar cobranças ou recebimentos anteriores nem tratar automaticamente o intervalo como encerramento solicitado. Feriados/recessos programados não são essa indisponibilidade.
- Conforme Q67, para mensalidade já emitida relativa a período inteiramente sem oferta da escola, Financeiro apresenta as soluções permitidas pelo contrato: crédito/retirada do saldo exigível daquele período ou cobertura futura identificada. Registrar a escolha do aluno e preparar a proposta; outra pessoa autorizada do Financeiro/Administração aprova antes de aplicar. Sem escolha, compatibilidade contratual ou dados suficientes, manter regularização pendente sem escolher solução automaticamente.
- Quando a escolha de Q67 for crédito, o ajuste retira o saldo ainda exigível do período e reconhece somente o valor efetivamente pago como crédito identificado, preservando documentos/recebimentos; não registrar pagamento fictício nem transformar valor não pago em saldo credor. Uso posterior segue Q68; devolução exige pedido e fluxo de Q69. Quando for cobertura futura, identificar novas datas, preservar pagamento e impedir nova cobrança para a mesma cobertura. Revalidar pagamentos, períodos e versão antes da aplicação; não aplicar as duas soluções ao mesmo valor.
- Conforme Q70, indisponibilidade da escola durante apenas parte do período mantém a mensalidade integral e gera recomposição dos dias de cobertura indisponíveis após o retorno, sem cobrança adicional pela compensação. Registrar o intervalo sem oferta, a cobertura anterior, os dias a recompor, a extensão proposta e o início dos próximos períodos. Preservar contrato, recebimentos e histórico.
- Financeiro prepara a proposta de Q70 e outra pessoa autorizada do Financeiro/Administração aprova antes de aplicar, conferindo as condições contratuais e os impactos em coberturas/cobranças existentes. A emissão por antecedência de Q64 precisa usar o calendário financeiro aprovado; impedir cobrança dos dias compensados, sobreposição de períodos ou compensação duplicada por repetição/concorrência. Mudança relevante de retorno, cobertura, valores ou dados examinados exige revisão da proposta antes da aplicação.
- Recomposição de cobertura em Q70 não é reposição individual de aula, não concede presença ou regularização de frequência e não transforma mensalidade em pacote de aulas. Se a solução também exigir alteração da agenda acadêmica, manter suas permissões, conflitos e aprovações próprias; aprovação financeira não substitui aprovação pedagógica. Pausa solicitada segue Q65/Q66; feriados/recessos e faltas do aluno não ativam Q70.
- Q67 abrange período inteiro sem oferta, distinto de feriado/recesso e pausa solicitada. Para período parcialmente afetado e matrícula que continua, Q70 mantém valor integral e recompõe cobertura após retorno. Q83 acrescenta acerto financeiro somente quando a matrícula encerra antes de usar toda a compensação; não estender automaticamente a escolha de Q67 nem criar proporcionalidade fora do encerramento.
- Conforme Q83, incluir no acerto de encerramento os dias de compensação de Q70 ainda devidos. Identificar período/cobrança de origem, intervalo sem oferta, quantidade devida, cobertura já recomposta e saldo restante na data efetiva. Financeiro prepara memória de cálculo e outra pessoa autorizada do Financeiro/Administração aprova com o acerto de Q18; manter condições contratuais e histórico.
- Conferir o ajuste de Q83 junto do proporcional, descontos, ajustes anteriores e recebimentos: um mesmo dia/valor não pode ser devolvido pelo proporcional e novamente pela compensação. Reduzir valor devido quando aplicável; crédito depende de valor efetivamente pago e não compensado. Não calcular pela mensalidade atual nem dividir pelo período ampliado sem conferir a origem e a regra contratual. Dados/regra insuficientes exigem conferência antes da aprovação.
- Aplicar o ajuste de Q83 somente com aprovação válida e revalidação das compensações, coberturas e recebimentos examinados. Identificar dias liquidados financeiramente para impedir uso posterior como cobertura gratuita ou novo crédito. Proposta pendente/rejeitada não apaga o direito registrado nem aplica o ajuste; concorrência não pode conceder cobertura e crédito para os mesmos dias.
- O ajuste de Q83 não comprova devolução de dinheiro nem autoriza uso de crédito em cobranças diferentes por si só. Crédito apurado, solicitação de devolução, utilização e execução seguem Q29/Q68/Q69. Multa e demais itens do acerto continuam separados, com as regras contratuais e aprovações já definidas; Q70 permanece para quem continua estudando.

## 3. O que o código atual já possui e o que falta

- A [Modalidade](../../prisma/schema.prisma) possui frequência, horas por aula, duração por nível em texto e quantidade opcional de aulas. A escolha Q04 exigirá quantidade válida nas modalidades usadas para gerar turmas; não presumir números para cadastros incompletos.
- [TurmaSchema](../../src/server/turmas/schema.ts) atualmente exige data final informada e permite professorId opcional; as ações de criação persistem a ausência de professor como null. A ausência permitida no cadastro não comprova o novo limite de Q44: rascunho sem publicação ou alocação até haver professor disponível. Tratar data prevista, estados e cadastros existentes na implementação/migração.
- As [ações de turma](../../src/server/turmas/acoes.ts) conferem frequência/horários, mas ainda não geram encontros a partir de feriados/recessos nem executam o bloqueio temporal docente solicitado.
- O [diário atual](../../src/server/diario/acoes.ts) registra conteúdo e presença de aulas passadas. Ainda não possui link de gravação, vínculo com encontro previsto, solicitação de cancelamento ou rotina de cobrança dessas pendências.
- [RegistroAulaAluno](../../prisma/schema.prisma) guarda presente como booleano opcional, sem relação de reposição. A [consulta do diário](../../src/server/diario/consultas.ts) e a [interface](../../src/app/(app)/diario/DiarioAulas.tsx) apresentam presença/ausência/não informado; “Reposta em [data]” ainda não está implementado. Não basta trocar o texto de “Ausente” sem registrar a reposição correspondente.
- Na [chamada atual](../../src/server/diario/acoes.ts), a lista para novos lançamentos vem de alocações ativas e alunos atualmente ativos, filtrada pela data de criação da alocação. Registros anteriores de quem saiu são preservados em leitura, mas isso não implementa uma lista histórica completa para o primeiro lançamento atrasado após transferência/pausa/encerramento. O [modelo de alocação](../../prisma/schema.prisma) contém criadoEm/encerradaEm; F07.4 precisa definir e validar a elegibilidade na data da aula sem reabrir acesso amplo ou inventar presença.
- O [schema atual](../../prisma/schema.prisma) possui TipoCobranca.HORA_PARTICULAR e mesesPlano, mas esses campos não representam permissão/limite de reposições particulares por plano. Falta o vínculo entre falta, gravação, resumo, atividade e conclusão, bem como a particular excepcional aprovada sem consumo/cobrança de Q34.
- O enum Papel no [schema](../../prisma/schema.prisma) contém papéis internos; a estrutura de acesso atual inclui [autenticação](../../src/lib/auth.ts) e [sessão interna](../../src/server/_shared/sessao.ts). Essa estrutura não comprova a área autenticada do aluno de Q33. Identidade vinculada ao aluno e autorização das suas reposições continuam pendentes; não atribuir papel de funcionário como atalho.
- A [Inbox atual](../../src/app/(app)/inbox/InboxCliente.tsx) possui renderização de vídeo a partir de midiaPath, mas isso não implementa reprodução autorizada de gravações do Drive para o aluno. A leitura direcionada de src/app, src/server e src/lib não encontrou integração Drive/Google API ou tratamento Content-Range para esse fluxo. [Docker](../../Dockerfile) e [Compose](../../docker-compose.prod.yml) preparam Next.js standalone; esses arquivos não comprovam capacidade de transmissão em produção. Q81 exige nova entrega e validação.
- As rotas atuais de importação de [alunos](../../src/app/api/alunos/importar/route.ts) e [turmas](../../src/app/api/turmas/importar/route.ts) recebem XLSX e criam registros por linha para administrador ativo. Alunos recebem status ATIVO e aceitaComunicacoes=true se não informado; turmas recebem PLANEJADA, datas manuais e professor opcional. Essas rotas não importam contratos, matrículas, recebimentos ou histórico acadêmico completo; também não apresentam prévia/lote com correspondência idempotente. Q84 exige preparar a migração real sem confundir esses padrões com evidências das planilhas.
- As [permissões do diário](../../src/server/diario/permissoes.ts) preservam leitura do histórico após fim do vínculo. Q24 definiu designação restrita para regularizar pendência após saída do professor; o código atual ainda não implementa essa designação nem a aprovação de correções de Q23. Isso não reabre indiscriminadamente o acesso histórico.
- A [ativação da matrícula](../../src/server/matricula/acoes.ts) gera mensalidades conforme mesesPlano. Não há nessa ação extensão recorrente nem cálculo proporcional com base no novo calendário.
- [Cobranca](../../prisma/schema.prisma) possui competência e vencimento, mas não datas explícitas de início/fim do período de cobertura. O cálculo de Q15 precisa dessa representação e de tratamento do legado; inferir o período apenas do vencimento não comprova a regra aprovada.
- O [encerramento atual](../../src/server/alunos/acoes.ts) encerra o aluno e suas alocações ativas, cancelando mensalidades pendentes com vencimento futuro. O [formulário de encerramento](../../src/server/alunos/schema.ts) recebe motivo/observação, sem data efetiva escolhida ou cálculo do último período. Isso não comprova a nova exceção de Q09/Q12 nem equivale ainda a uma solicitação de encerramento por matrícula com acerto final.
- A [validação de aceite contratual](../../src/server/matricula/ativacao.ts) verifica documento vinculado, categoria, disponibilidade e autoria/data da confirmação. Ela não interpreta cláusulas nem calcula multa. O schema e o encerramento atual não representam uma política estruturada de multa de encerramento; o aceite documentado não comprova esse cálculo implementado.
- A [retomada D13](../39-retomada-com-aprovacao.md) preserva parcelas e recebimentos ao manter/reprogramar vencimentos, com aprovação independente. Essa entrega local não comprova a reprogramação explícita de início/fim de cobertura aprovada em Q66; a ampliação da proposta e sua integração com Q62/Q65 continuam pendentes.
- Na [pausa atual](../../src/server/alunos/acoes.ts), cancelarMensalidadesFuturas seleciona mensalidades PENDENTES com vencimento posterior ao instante da operação, registrando a origem da pausa. Esse filtro usa vencimento, não cobertura explícita, e não comprova Q65/Q66. Por exemplo, pode selecionar uma mensalidade de período já iniciado que ainda vai vencer; Q65 exige preservar esse período integral. A integração precisa classificar a cobertura real e preservar recebimentos, sem inferir as datas apenas do vencimento.
- [D14](../40-mudancas-academicas-com-aprovacao.md) valida condições de turma/horário e preserva finanças na mudança de nível. A nova política de calendário/cobrança exige integração explícita; a simples aprovação de uma transferência acadêmica não é uma autorização financeira.
- O [catálogo documentado](../06-fase1-catalogo-cursos.md) descreve avanço entre níveis no mesmo contrato. A nova definição mensal é compatível com essa continuidade, mas seus cálculos específicos ainda precisam ser fechados.

Esses achados são leitura direcionada para refinamento. Os testes das entregas D01–D14 não comprovam funcionalidades novas descritas neste arquivo.

## 4. Calendário e fuso

**Calendário letivo:** único da escola, com fuso oficial configurável conforme Q45; determina datas letivas e pausas para todas as turmas. Converter encontros para essa referência ao conferir bloqueios. Nenhum fuso regional ou deslocamento fixo foi escolhido como valor padrão.

**Referência da turma:** horário local e fuso usados para gerar cada ocorrência, preservados junto dos instantes de início/fim. Q46 inicia no próximo encontro válido a partir da data informada; Q47 permite término no dia seguinte e exige conferir todo o intervalo.

**Exibição:** escolha de quem consulta, sem alterar o encontro ou o calendário. A interface pode organizar opções por país, identificando cidade/fuso quando necessário. Não representar um país inteiro por um deslocamento fixo de horas.

Referência técnica: a documentação do Google Calendar distingue fuso da recorrência e fuso de exibição. Isso fundamenta a separação proposta, sem escolher uma integração externa para a escola. [Documentação oficial](https://developers.google.com/workspace/calendar/api/concepts/events-calendars).

## 5. Divisão revisada das issues

Os [corpos consolidados na revisão de integração](revisao-integracao-corpos-entregas.md) são a versão organizada para revisar a criação das próximas issues. As seções abaixo conservam o detalhamento de origem de F07.1–F07.7. B01/B02 passam a concentrar as bases contratuais/financeiras compartilhadas; P01/P02 tratam particulares contratadas/permuta e N01 concentra comunicação. Não implementar esses componentes de novo dentro de cada F07.

Acompanhamento/gravação, continuidade financeira e reposição individual têm entregas próprias. A reposição da turma cancelada permanece no replanejamento; a ausência de um aluno exige outro vínculo e outro resultado no diário.

### F07.1 — Calendário único da escola

**Problema:** falta uma referência institucional de dias letivos para gerar as aulas.

**Resultado:** Secretaria/gestão cadastram feriados, recessos e férias aplicáveis a todas as turmas.

**Corpo em preparação:**

- Cadastrar data ou intervalo, identificação e motivo.
- Consultar dias letivos e pausas.
- Configurar o fuso oficial da escola conforme Q45 e usá-lo para interpretar dias não letivos. Distinguir essa configuração da referência da turma e da preferência pessoal de exibição; alteração com impacto em agendas publicadas segue revisão/aprovação do conjunto.
- Manter autoria e referência das condições usadas em cada agenda.
- Quando uma mudança alcançar agendas oficiais, gerar proposta automática de remarcações para todas as turmas afetadas, permitir revisão/ajuste e exigir aprovação independente do conjunto conforme Q20. Mostrar conflitos e efeito no término; preservar registros passados.
- Aplicar a proposta revisada ao aprovar, conforme Q21, revalidando as condições e preservando o conjunto se houver falha; Secretaria acompanha o resultado.
- Após aplicação da mudança, integrar avisos consolidados e acompanhamento por canal de Q38, compartilhados com F07.3; não comunicar uma proposta como se já estivesse publicada.
- Permitir exceção em dia não letivo para encontro específico, com motivo, aprovação independente e validação de conflitos conforme Q19; identificar essa exceção na agenda sem mudar o calendário das demais turmas.
- Não importar feriados por país ou serviço externo automaticamente.

**Aceite candidato:** turmas mistas seguem as mesmas pausas; trocar o fuso da consulta não altera o calendário; mudanças não reescrevem silenciosamente encontros publicados ou históricos. Encontro excepcional em dia não letivo exige justificativa e aprovação independente; sua autorização não libera outros encontros nesse dia nem permite conflito docente.

**Aceite de Q20/Q21:** mudança global apresenta todas as turmas afetadas, datas sugeridas e término anterior/novo; equipe pode revisar antes da aprovação; aprovação independente aplica somente a versão válida e sem conflitos. Nova turma afetada, alteração relevante ou falha de aplicação não pode produzir publicação parcial; repetição não duplica remarcações. Aulas ministradas e registros passados permanecem preservados.

**Aceite de Q45:** duas consultas com fusos de exibição diferentes produzem a mesma decisão sobre o calendário; dia não letivo é interpretado no fuso institucional, inclusive quando a data da turma for diferente. Troca do fuso institucional não altera agendas publicadas sem revisão dos impactos; histórico preserva a referência usada.

**Detalhes de preparação:** limites exatos dos intervalos, horários ambíguos/inexistentes na conversão e integração com o gerador de F07.2, sem ajustes silenciosos. Fuso institucional foi definido em Q45. Exceção, proposta conjunta e efetivação seguem Q19–Q21. Q38 definiu os canais; integrar WhatsApp/e-mail com acompanhamento no ERP.

### F07.2 — Geração da agenda, término e bloqueio de conflito docente

**Problema:** a grade semanal não representa cada aula nem considera o período real de ocupação do professor.

**Resultado:** preparar e publicar encontros até completar a quantidade de aulas por nível, com término previsto e professor disponível nas datas necessárias.

**Corpo em preparação:**

- Aplicar início, dias, horário, duração, fuso, modalidade e calendário único.
- Herdar duração/frequência da modalidade. Permitir proposta de exceção por turma conforme Q37, com motivo, valores anteriores/propostos, grade e término resultantes. Exigir aprovação por outra pessoa da Gerência Pedagógica/Administração antes da publicação, inclusive na criação, e usar somente valores aprovados na agenda oficial.
- Conforme Q46, procurar o primeiro encontro válido a partir da data inicial, pulando dias fora da grade ou não letivos; gerar a quantidade configurada sem duplicação. Mostrar data informada, primeira aula efetiva e previsão de término.
- Exibir os encontros e a previsão de término no fuso escolhido.
- Conforme Q47, permitir que o encontro termine em outro dia; representar início/fim completos, conferir todo o intervalo no calendário institucional de Q45 e manter exceção de Q19 se necessário. A passagem da meia-noite não interrompe a aula nem cria outro encontro.
- Bloquear sobreposição real do professor, inclusive em duas publicações concorrentes.
- Conferir também indisponibilidades aprovadas conforme Q39 em novos agendamentos, remarcações e particulares; mostrar impedimento no período real. Solicitação ainda não aprovada não cria bloqueio provisório automático.
- Permitir o mesmo horário quando a turma anterior terminar antes da nova.
- Conservar acesso docente restrito e projeção sem contato pessoal ou dados financeiros.
- Conferir cadastros antigos antes da conversão.
- Aplicar Q44: permitir salvar turma e simular agenda sem professor apenas em rascunho; exigir professor definido/disponível antes de publicar ou alocar alunos. Tratar as mesmas condições no servidor e na interface, sem presumir disponibilidade pela simulação.
- Aplicar o início automático de Q48 somente a encontros oficiais não cancelados; simulação em rascunho não inicia turma nem declara aula ministrada. Exibir a distinção entre início previsto, início efetivo do estado e primeira aula documentada.

**Aceite candidato:** cálculo correto com feriados, geração repetida sem duplicação, conflito real bloqueado e horário liberado após término anterior; calendário não cria registros de aula ministrada. Sem exceção, usar duração/frequência herdadas. Com exceção, bloquear publicação pendente/rejeitada, sem motivo ou por autoaprovação; outra pessoa autorizada aprova valores e impacto antes da publicação. A exceção válida afeta somente a turma, conserva a quantidade de aulas e não dispensa conflito docente.

**Aceite de Q39:** solicitação registra professor, período, motivo e autor; outra pessoa autorizada aprova. Depois da aprovação, novos agendamentos sobrepostos são recusados, inclusive em concorrência. Aulas já publicadas permanecem registradas e entram em pendência de solução; aprovação da ausência não as cancela nem substitui automaticamente o professor. Solicitação pendente não aplica o bloqueio provisório da alternativa C.

**Aceite de Q44:** salvar rascunho sem professor funciona e mantém previsão não publicada; tentativa de publicar ou alocar aluno é recusada, inclusive por chamada direta ao servidor. Designar professor conflitante/indisponível não libera publicação/alocação. Professor válido e disponível permite seguir o fluxo normal com as demais aprovações aplicáveis.

**Aceite de Q46/Q47:** data inicial fora da grade ou não letiva resulta no próximo encontro regular válido, sem reduzir a meta; mostrar primeira aula e término recalculados. Aula das 23h por duas horas pode terminar à 1h do dia seguinte; contar um encontro e detectar conflito/indisponibilidade na parte após meia-noite. Qualquer sobreposição com dia não letivo no fuso institucional exige a exceção de Q19. Mudar fuso de exibição não muda disponibilidade ou instantes.

**Pendências específicas:** conversão do legado, limites dos intervalos e tratamento explícito de horários ambíguos/inexistentes. Fuso institucional, primeira aula e travessia da meia-noite foram definidos em Q45–Q47. Turma sem professor segue Q44; exceção de duração/frequência Q37 e indisponibilidade Q39.

### F07.3 — Replanejamento, modalidade e cancelamento aprovados

**Problema:** mudanças de carga e cancelamentos precisam atualizar agendas vigentes sem perder histórico ou produzir conflitos.

**Resultado:** proposta com impacto conferível, decisão independente e aplicação do calendário autorizado.

**Corpo em preparação:**

- Identificar turmas afetadas conforme Q42/Q43: aumento inclui todas as não finalizadas, inclusive rascunhos/ainda não iniciadas; redução preserva meta de turmas em andamento e pode atingir ainda não iniciadas. Preservar concluídas e manter rascunhos sem publicação automática.
- Exibir aulas atingidas pela indisponibilidade aprovada de Q39 e acompanhar proposta de solução. Aplicar Q56 à substituição temporária: Secretaria/gestão prepara substituto, aulas/período e motivo; outra pessoa autorizada aprova/aplica depois de conferir conflitos e versão. Preservar titular, registrar autoria real das aulas e limitar acesso do substituto aos encontros atribuídos; comunicar alteração efetivada por Q38.
- Preservar aulas ministradas, encontros passados com pendência e registros históricos.
- Apresentar metas e datas anteriores/propostas, conflitos e impacto estimado na continuidade.
- Mostrar duração/frequência herdadas e exceções aprovadas por turma conforme Q37. Alterar esses valores exige proposta justificada e aprovação independente antes da publicação; uma mudança global não elimina silenciosamente uma exceção local. Revalidar versão, conflitos e término resultante.
- Permitir ao professor solicitar cancelamento de encontro sob sua responsabilidade, com justificativa.
- Aprovação por outra pessoa da Gerência Pedagógica/Administração.
- Não modificar a agenda oficial enquanto a proposta está pendente; recusar proposta obsoleta.
- Permitir à gestão escolher a data de reposição na grade ou extraordinária ao decidir; apresentar conflitos e mudança de término e revalidar antes de aplicar.
- Vincular a reposição à aula cancelada, preservando a meta de aulas e sem contar dois encontros para a mesma reposição.
- Na alteração global de feriado/recesso, sugerir remarcações e submeter o conjunto revisado das turmas afetadas à aprovação independente conforme Q20. Q41 aplica a mesma unidade de aprovação às mudanças de modalidade: conjunto completo de turmas afetadas, após resolução dos conflitos. Conforme Q21, aprovação efetiva a proposta válida na mesma operação, sem etapa separada pela Secretaria.
- Após aprovação e aplicação, comunicar alunos/responsáveis autorizados conforme Q38: aviso consolidado pelo WhatsApp institucional e também por e-mail se cadastrado, com acompanhamento no ERP. Registrar tentativas/resultados por canal e pendências para a Secretaria. Não enviar aviso de efetivação para proposta pendente/rejeitada ou aplicação que falhou.

**Aceite candidato:** mudança de 25 para 30 amplia corretamente a meta de turmas em andamento; concluídas permanecem iguais; solicitação docente não cancela diretamente; gestão pode escolher grade/extraordinária, vê conflitos e novo término; aprovação revalida disponibilidade, bloqueia conflito docente e não apaga aulas dadas.
**Aceite de Q37/Q38:** a nova proposta preserva autoria e valores da exceção anterior, mostra impacto e não altera outra turma sem escopo aprovado; proposta obsoleta ou conflitante não se publica. Avisos correspondem à alteração aplicada e não saem antes dela. Destinatário autorizado com WhatsApp e e-mail recebe pelos dois canais; sem e-mail cadastrado, não há tentativa para endereço inexistente. Não expor contatos de terceiros. Falha de um canal mantém resultado do outro e cria pendência no ERP; processamento repetido não duplica aviso já enviado por canal.

**Aceite de Q41:** a proposta apresenta o conjunto afetado conforme Q42/Q43, preserva finalizadas e mostra exceções locais aprovadas. Conflito em uma agenda oficial afetada impede aplicar o conjunto; após resolver, outra pessoa autorizada aprova e aplica configuração e cronogramas conjuntamente. Nova turma afetada, alteração relevante, versão obsoleta ou falha exige revisão/preserva estado anterior, sem aplicação parcial. Repetição não duplica encontros; avisos de Q38 correspondem somente à alteração efetivada, sem tratar recalculo de rascunho como publicação.

**Aceite de Q42/Q43:** reduzir 30 para 25 preserva meta de turma em andamento; turma ainda não iniciada pode receber 25 após revisão/aprovação conjunta. Aumentar 25 para 30 inclui andamento, ainda não iniciadas e rascunhos; rascunho recalculado continua sem publicação. Finalizadas, aulas ministradas e encontros passados pendentes não são apagados ou reescritos para ajustar meta. Manter versão aplicável a cada turma e exibir diferenças no impacto.

**Aceite de Q48:** ao chegar o início do primeiro encontro previsto não cancelado, turma oficial passa a em andamento e aula permanece prevista. Rascunho ou encontro cancelado não dispara o marco. Rotina atrasada não permite redução indevida de turma já iniciada. Somente Gerência Pedagógica/Administração confirma conclusão após meta vigente e pendências resolvidas; conclusão por data final, professor sem capacidade de gestão ou pendência de aula é recusada. Não alterar automaticamente aprovação de alunos, alocações, matrículas ou mensalidades.

**Aceite de Q56:** Secretaria/gestão pode propor substituto e encontros identificados com motivo; proposta não troca professor antes da aprovação independente. Conflito, indisponibilidade, autoaprovação ou versão obsoleta bloqueiam aplicação. Aprovação válida atribui somente os encontros previstos, preserva titular e autoria real, e concede acesso limitado ao substituto. Ausência aprovada sozinha não designa professor; avisos seguem Q38.

**Pendências específicas:** conferir legado e integração das versões/estados/atribuições por encontro. Substituição temporária foi definida em Q56; marco da turma segue Q48, meta/rascunho Q42–Q44, referência temporal Q45–Q47 e demais aprovações Q20/Q21/Q37/Q38/Q39/Q41.

### F07.4 — Conclusão docente: presença, gravação e pendências

**Problema:** o relógio não comprova a realização de aula e o diário atual não exige gravação.

**Resultado:** controlar encontros previstos, sua documentação e a conclusão como ministrados.

**Corpo em preparação:**

- Manter estado previsto mesmo quando o horário passar.
- Abrir pendência ao terminar o horário previsto, com prazo de regularização e intervalo de lembretes configuráveis. Avisar professor dentro do ERP e alertar Gerência Pedagógica quando vencer o prazo, com painel de acompanhamento conforme Q22; concluir a pendência encerra seus lembretes.
- Exigir preenchimento das presenças e link da gravação para conclusão normal.
- Não preencher presença automaticamente nem afirmar ausência quando falta lançamento.
- Vincular registro ao encontro, com autoria e histórico.
- Tratar cancelamento pela aprovação de F07.3.
- Oferecer exceção para aula sem gravação recuperável: professor preenche presenças e justifica; outra pessoa da Gerência Pedagógica/Administração decide explicitamente pela conclusão excepcional. Registrar autoria, motivo e decisão, sem inventar um link de gravação.
- Restringir gravações e contexto aos públicos definidos, sem presumir portal já entregue.
- Toda correção de aula concluída exige proposta com motivo, aprovação independente e publicação da versão examinada conforme Q23; guardar valores anteriores/novos e conferir efeitos em frequência/reposição.
- Para pendência de professor desvinculado, permitir designação pela gestão de responsável com acesso limitado àquela aula conforme Q24; registrar motivo, autoria e término/revogação da designação. Preservar professor original e identificar separadamente o regularizador; não dispensar Q07/Q23.

**Aceite candidato:** aula passada permanece prevista até cumprir os requisitos; presenças sem gravação ou gravação sem presenças não concluem pelo fluxo normal; exceção exige presenças, justificativa e outra pessoa autorizada; decisão excepcional é identificável no histórico; pendência não cria aula extra nem altera cobrança automaticamente.

**Aceite de Q22–Q24:** aviso e alerta respeitam prazo/intervalo configurados e escopo de acesso; pendência resolvida não continua gerando lembretes. Correção direta de aula concluída é bloqueada, inclusive para link/conteúdo; outra pessoa autorizada aprova a proposta, com histórico e sem autoaprovação. Responsável designado regulariza somente a pendência atribuída, sem mudar o professor original ou liberar outras aulas; exceção de gravação e correção de aula concluída mantêm suas aprovações.

**Aceite de Q53:** aluno elegível na terça que sai na quarta continua na chamada da terça lançada na quinta; aluno admitido depois da aula não entra nessa lista. Usar história de vínculo/situação, sem inventar presença quando faltar evidência. Responsável autorizado acessa somente dados necessários à aula; professor desvinculado não ganha acesso geral. Correção de aula concluída mantém Q23.

**Aceite de Q57:** aluno relata apenas material autorizado da própria reposição; acesso direto a material de outro aluno é recusado. Relato registra autoria/momento, mas só a conferência da gestão confirma indisponibilidade. Preservar aula ministrada, presenças e histórico; manter aprovação de Q23 para alterar link e Q34 para solucionar ausência de gravação. Não apresentar monitoramento automático como implementado/definido.

**Aceite de Q59:** aluno impedido aparece com situação própria, distinta de falta comum, e a aula permanece no denominador sem crédito de presença/reposição até conclusão válida. Regularização posterior conta uma vez e conserva o impedimento original. Retirada do bloqueio não altera frequência automaticamente; professor não recebe dados financeiros. Histórico usa situação do encontro e correções seguem Q23/Q54.

**Preparação restante:** integrar situação de frequência, histórico e controles de acesso ao código/legado. Lista histórica segue Q53; frequência sob restrição Q59; material/prazo Q57/Q58, mantendo correções/regularização de Q22–Q24.

### F07.5 — Continuidade mensal integral e acerto no encerramento solicitado

**Problema:** o calendário pode prolongar a jornada, mas o financeiro atual gera um conjunto de meses na ativação.

**Resultado desejado:** refletir mensalidades integrais ao longo da matrícula, acompanhando a continuidade entre níveis; no encerramento solicitado, apurar proporcional por dias reais até a data efetiva, eventual multa prevista no contrato e saldo/crédito, preservando recebimentos.

**Corpo em preparação:**

- Conforme Q30, ao terminar o cronograma inicial, gerar próximos períodos integrais se houver continuidade contratada e matrícula ativa, respeitando pausa/encerramento e indisponibilidade registrada em Q32; sem previsão, solicitar renovação. Não duplicar por mudança de nível nem estender por pendência do diário; revalidar estado, oferta e contrato na geração.
- Registrar indisponibilidade da escola e suspender novas mensalidades de períodos sem oferta conforme Q32. Retomada requer oferta e condições regularizadas, sem gerar retroativamente os períodos suspensos nem apagar cobranças/pagamentos anteriores.
- Detalhar solicitação de encerramento e data efetiva. Calcular pelos dias reais conforme Q15, inclusão/exclusão contratual do dia conforme Q28, período contratual de Q62 e ordem dos descontos conforme Q63. Mostrar último dia coberto e memória de cálculo; arredondamento ainda exige especificação. Regra contratual insuficiente exige conferência.
- Representar início/fim do período coberto conforme referência contratual de Q62, permitindo mês civil ou ciclo mensal com data registrada, separados da competência e do vencimento. Tratar meses com diferentes quantidades de dias e períodos que atravessem meses; conferir dados antigos antes de calcular.
- Representar eventual multa separadamente, vinculada à cláusula do contrato aceito, por valor fixo ou percentual conforme Q17. Exigir base explícita no percentual, condições e memória de cálculo; ausência de cláusula não gera multa e condição desconhecida precisa de conferência. Alteração de configuração não reescreve contratos/acertos anteriores.
- Tratar a transição A1 → A2 sem presumir nova contratação ou duplicação de período.
- Não transformar a quantidade de aulas do nível em pacote comercial.
- Preservar recebimentos, cobranças pagas, descontos e comissões existentes.
- Financeiro prepara a proposta; outro Financeiro com permissão de aprovação ou outra pessoa da Administração aprova antes da efetivação, conforme Q18. Dispensa/alteração da multa exige justificativa e autorização; impedir autoaprovação inclusive por múltiplos papéis. Apresentar proporcional, multa, recebimentos, efeitos nas parcelas futuras e saldo/crédito separadamente.
- Vincular decisão à versão da proposta e revalidar os dados na efetivação. Se alterarem o resultado aprovado, devolver para revisão e nova aprovação. Preservar autoria e histórico de propostas rejeitadas ou substituídas.
- Integrar Q65/Q66 à pausa/retomada D13: pausa imediata preserva integral o período iniciado; períodos seguintes abrangidos ficam suspensos. Na retomada, reprogramar cobertura e apresentar a escolha independente dos vencimentos na mesma proposta aprovada. Preservar períodos iniciados, valores e recebimentos, revalidar a versão e impedir sobreposição/duplicação; aprovação de vencimentos isolada não comprova a nova cobertura.
- Manter saldo credor para uso futuro conforme Q29; solicitação de devolução pelo aluno é registrada e processada pelo Financeiro, com confirmação da execução e histórico. Impedir que o mesmo crédito seja utilizado/devolvido duas vezes; preservar recebimentos originais.

**Aceite candidato:** continuidade no mesmo período não duplica cobrança; mensalidades seguem integrais e no encerramento solicitado o último período usa os dias reais de cobertura até a data efetiva, com datas e valores conferíveis; eventual multa depende da previsão contratual aplicável e aparece separada; saldo/crédito e recebimentos permanecem rastreáveis; repetição e concorrência não duplicam cobranças ou multa nem perdem pagamentos. A fórmula não usa automaticamente 30 dias ou o vencimento como início do período.

**Aceite de Q17/Q18:** multa fixa e percentual respeitam a cláusula registrada; percentual sem base não pode ser efetivado; dispensa/alteração sem justificativa e autorização não é aplicada; autor da proposta não pode aprová-la, inclusive pela Administração; Financeiro sem permissão de aprovação não aprova; alteração relevante após aprovação exige nova decisão; recebimentos originais são preservados.

**Aceite de Q28/Q29:** contrato pode determinar inclusão ou exclusão do dia, com regra e último dia coberto visíveis no acerto; falta de regra identificada exige conferência antes de aprovar. Crédito aprovado permanece disponível e não dispara devolução automática; solicitação de devolução e execução pelo Financeiro têm registros distintos; concorrência não permite uso/devolução duplicados e o recebimento original permanece preservado.

**Aceite de Q30:** cronograma inicial encerrado com continuidade contratual válida e matrícula ativa permite próximos períodos integrais; sem previsão contratual, exige renovação; pausa/encerramento impedem geração incompatível. Repetição, concorrência ou passagem de nível não duplicam período; pendência de diário não gera extensão.

**Aceite de Q31:** data anterior ao pedido sem motivo, evidências ou aprovação explícita não pode ser efetivada; aprovação usa os impactos da data examinada, sem autoaprovação. Datas do pedido e da decisão permanecem reais no histórico; demora administrativa não aumenta dias cobrados. Retroatividade não apaga recebimentos.

**Aceite de Q32:** indisponibilidade registrada impede nova emissão nos períodos sem oferta, mesmo se houver matrícula ativa e cláusula de continuidade; retomada exige regularização e não gera cobranças retroativas dos períodos suspensos. Histórico de cobranças/recebimentos permanece; recesso/feriado do calendário não ativa essa regra indevidamente.

**Aceite de Q62/Q63/Q64:** mês civil e ciclo mensal individual guardam cobertura explícita sem inferi-la do vencimento; regra contratual insuficiente bloqueia a aprovação do acerto até conferência. Os dois métodos contratuais de desconto produzem o resultado correspondente e mostram a ordem, sem desconto duplicado e com multa separada. A continuidade é emitida na antecedência configurada, somente após conferir contrato, matrícula e oferta; repetição/concorrência não duplicam período e alteração da configuração não reescreve cobranças antigas. Entrada/continuidade seguem integrais.

**Aceite de Q65/Q66:** pausa no meio da cobertura aplica acesso de matrícula pausada e mantém integral a mensalidade iniciada, mesmo com vencimento futuro; períodos seguintes abrangidos ficam suspensos e identificados por origem. Retomada apresenta coberturas e vencimentos anteriores/propostos, mantendo ambas as opções de D13 para vencimentos; outra pessoa aprova a mesma versão do conjunto antes de aplicar. Coberturas reprogramadas respeitam o contrato e não sobrepõem período preservado. Repetição/concorrência não duplicam mensalidade; mudança relevante exige nova decisão e recebimentos permanecem. Dados legados sem cobertura suficiente exigem conferência.

**Aceite de Q67/Q68/Q69:** ausência de escolha/dados mantém regularização de período inteiro sem oferta pendente. Proposta financeira registra escolha do aluno e requer aprovação independente; crédito considera pagamento real, e cobertura futura não duplica cobrança. Cada utilização de crédito registra concordância, origem e destino e só é aplicada após outra pessoa aprovar; não permitir uso automático genérico ou transferência a outro aluno. Devolução permite preparador executar somente com permissão e aprovação anterior de outra pessoa; aprovação isolada não comprova saída. Mudança relevante invalida a proposta anterior; execução/abatimento concorrentes não usam o mesmo saldo, e resultado externo incerto exige conciliação.

**Aceite de Q70:** falta de oferta em parte do período preserva valor integral e registra dias indisponíveis e extensão de cobertura após retorno sem cobrança adicional. Proposta mostra cobertura anterior/proposta e início dos períodos seguintes; outra pessoa autorizada aprova antes de aplicar. Emissão concorrente ou repetida não cobra os dias compensados nem duplica compensação; histórico e recebimentos ficam preservados. Falta de condição contratual/dados suficientes exige conferência. Feriado, recesso, falta do aluno e pausa solicitada mantêm suas regras próprias; nenhuma presença é concedida pela compensação financeira.

**Aceite de Q83:** ao encerrar com compensação pendente, o acerto identifica dias de origem, dias já recompostos e restante, com memória de cálculo e aprovação independente. No exemplo de três dias devidos e um já recomposto, apenas dois seguem para conferência do ajuste; o exemplo não define valores monetários. Não duplicar ajuste com proporcional, crédito anterior ou extensão de cobertura; não inventar pagamento. Após aplicar, impedir compensar novamente os dias liquidados financeiramente. Mudança de saldo/cobertura durante análise exige revalidação antes da aplicação. Preservar cobranças, recebimentos, decisões e histórico; crédito não é devolução executada.

**Aceite de Q71:** com concordância registrada e proposta aprovada por outra pessoa autorizada, gerar uma cobrança final única com saldo/vencimento conferíveis e vínculo com as origens substituídas. Não manter originais exigíveis em duplicidade, apagar recebimentos ou simular pagamento. Sem acordo, preservar condições originais e ajustes aprovados. Efetivar encerramento na data aprovada sem exigir quitação. Mudança relevante exige nova decisão; repetição ou pagamento concorrente não duplica cobrança nem perde recebimento.

**Detalhes de preparação financeira:** Q62–Q71 definiram cobertura, descontos, emissão, pausa/retomada, indisponibilidade inteira/parcial, uso de crédito, devolução e cobrança final única no encerramento. Precisão/arredondamento e cenários de limites/concorrência ainda precisam de especificação técnica, incluindo relação entre recomposição de cobertura e eventual encerramento. Datas, multa e aprovações mantêm Q15/Q17/Q18/Q28–Q32; implementação/integração permanecem pendentes.

### F07.6 — Reposição individual e situação “Reposta em [data]”

**Problema:** o aluno pode precisar recuperar uma aula perdida, mas o diário atual só registra presença/ausência e não relaciona uma particular ou uma entrega por gravação à falta original.

**Resultado desejado:** registrar e autorizar reposição por particular permitida pelo plano ou gravação com resumo/atividade, com área autenticada do aluno; quando faltar gravação recuperável, oferecer a solução de Q34. Após conclusão, mostrar reposição e data na aula original, com frequência regularizada conforme Q27.

**Corpo em preparação:**

- Identificar aluno, aula perdida, pedido, formato, autorização independente e execução pela Secretaria conforme Q11. Distinguir particular coberta pelo plano de particular excepcional aprovada por indisponibilidade da gravação conforme Q34.
- Separar solicitação, autorização, agendamento/disponibilização e conclusão; nenhuma das três primeiras etapas substitui a comprovação final. Detalhar como a Secretaria executa a disponibilização na opção gravada, que não exige um encontro ao vivo.
- Na particular, configurar permissão, quantidade e período por plano conforme Q14. Conferir saldo do período e disponibilidade docente; agendamento reserva uma unidade sem exceder o limite em concorrência. Conforme Q16, realização consome, cancelamento do aluno dentro do prazo configurado devolve, cancelamento tardio/falta consome e cancelamento pela escola devolve. Remarcação do mesmo pedido não consome duas vezes; registrar os movimentos do benefício.
- Expirar saldo livre sem acumulação conforme Q25, preservando agendamentos autorizados. Usar a cota do período da particular agendada conforme Q26; remarcação de reserva não consumida transfere a reserva após conferir saldo e conflitos. Falha preserva a reserva original; liberação de cota encerrada não a transfere para o período atual.
- Confirmar realização e presença para concluir a reposição particular; documentação do encontro segue F07.4, incluindo a exceção de gravação aprovada. Consumo por falta ou cancelamento tardio não marca a aula como reposta.
- Na gravação, disponibilizar material correspondente e autorizado na área do aluno de Q33, receber resumo/atividade e aplicar prazos por etapa de Q35. Professor designado avalia, solicita correção quando necessário e confirma; gestão acompanha e pode prorrogar com motivo. Preservar versões, autoria, datas e avaliações; não criar presença fictícia na aula original.
- Conforme Q40, Gerência Pedagógica/Administração pode substituir o professor avaliador por outro professor, com motivo e acesso limitado à reposição. Preservar identidade dos autores de entregas, correções e avaliações anteriores; novo professor assina somente seus atos. Revalidar a designação atual para avaliar e manter os prazos do aluno, salvo prorrogação registrada de Q35.
- Sem gravação recuperável, gestão registra solução de Q34: gravação substituta equivalente com resumo/atividade ou particular excepcional com aprovação independente, sem consumo de benefício e sem cobrança adicional. Particular mantém conflito, documentação e presença; gravação substituta mantém avaliação docente. Ambas mantêm uma única regularização da falta original.
- Manter ausência original e exibir “Reposta em [data]” após conclusão. Conforme Q55, particular usa data de realização; gravação usa data da validação do professor, com a data da versão entregue/aprovada nos detalhes. Preservar ambas e não regularizar frequência antes da confirmação.
- Impedir duplicação da conclusão da mesma aula perdida, inclusive se houver troca de formato; ausência na particular ou entrega gravada incompleta não produz conclusão.
- Conceder visibilidade limitada à reposição e materiais do próprio aluno, preservando alocação original e demais dados restritos. A entrega do resumo/atividade ocorrerá na área autenticada de Q33, com dependência de F07.7; a alternativa inicial de registro manual como único canal foi substituída pela escolha do usuário. Conforme Q36, matrícula pausada/encerrada mantém histórico em leitura; novos envios exigem liberação da gestão para pendência específica com motivo/prazo, sem novos pedidos e sem liberar restrições de gravação.
- Aplicar Q27 após conclusão: particular e entrega gravada aprovada regularizam frequência, distinguindo presença original de reposição e sem duplicar a aula na contagem. Preservar falta e vínculo no histórico; não modificar agenda da turma inteira ou mensalidade por essa reposição. Demais critérios de avaliação/progressão permanecem em F09.

**Aceite candidato:** particular normal exige permissão/saldo do plano, com proteção contra concorrência e duplicação; particular excepcional de Q34 exige motivo e aprovação independente sem consumir cota ou gerar cobrança adicional. Realização com presença/documentação conclui a particular. Entrega gravada permanece em avaliação até confirmação docente; correção permite nova versão e não conclui automaticamente. Depois da conclusão, aula original mostra reposição e data, mantendo histórico e frequência sem contagem duplicada. Acesso e envio são limitados ao aluno e aos profissionais autorizados.

**Aceite de Q16:** cancelamento dentro do prazo devolve a reserva uma única vez; cancelamento tardio/falta converte a reserva em utilização sem concluir a reposição; cancelamento da escola devolve; remarcação do mesmo pedido não gera duas utilizações; histórico identifica prazo e momento usados na decisão. Nenhum prazo numérico padrão foi presumido.

**Aceite de Q25–Q27:** saldo livre expira sem aumentar a próxima cota nem apagar reservas; particular usa a cota da data agendada, ainda que falta/pedido sejam de outros períodos. Remarcação entre períodos transfere somente reserva não consumida, sem ultrapassar saldo em concorrência; indisponibilidade mantém o agendamento anterior. Particular concluída e entrega gravada aprovada regularizam frequência uma vez por aula original; solicitação, reserva, falta na particular ou entrega pendente não regularizam. Indicadores distinguem presença original e regularização, sem aumentar a base de aulas pela reposição.

**Aceite de Q33–Q36:** aluno autenticado consulta/envia apenas nas próprias reposições; troca de identificador não abre entrega/arquivo de outro aluno nem permite aprovação docente. Gravação substituta é identificada e mantém avaliação; particular excepcional não movimenta a cota normal nem gera cobrança adicional. Prazo inicial nasce com material disponível, cada correção tem prazo configurado e prorrogação conserva motivo, autor e datas. Na pausa/encerramento, histórico permanece em leitura e envio é recusado sem autorização específica válida; autorização para uma pendência não libera outra, não sobrevive ao vencimento/revogação e não permite novo pedido. Gravações mantêm controles próprios; registros anteriores permanecem.

**Aceite de Q40:** gestão designa outro professor com motivo e histórico do responsável anterior/novo; substituto consulta/avalia somente a reposição atribuída, sem receber acesso à turma inteira. Avaliações anteriores mantêm autoria e versões. Responsável anterior não envia novas avaliações amparado pela atribuição substituída; mudança concorrente de avaliador é revalidada. Designação não reinicia prazo do aluno nem conclui a reposição automaticamente.

**Aceite de Q49:** plano pode usar calendário civil ou ciclo com referência da matrícula e duração configurada; períodos mostram datas exatas. Configuração incompleta bloqueia reserva sem criar regra presumida. Particular usa período da data agendada; mudar sua data não reinicia ciclo ou cota. Remarcação, expiração e devolução continuam seguindo Q16/Q25/Q26 com histórico da regra aplicada.

**Aceite de Q50:** mudança não altera período vigente nem reinicia saldo; nova versão vale no próximo período do aluno. Regras/datas do período anterior permanecem auditáveis. Reservas autorizadas são honradas e consideradas sob a nova cota; se já a ocuparem, novas reservas são recusadas por falta de saldo, sem cancelar as anteriores. Mudança de referência/duração não cria cota duplicada ou libera consumo antigo.

**Aceite de Q51:** depois de falta/cancelamento tardio, nova tentativa exige novo pedido/aprovação, disponibilidade e saldo do período da nova data. Consumo da tentativa anterior permanece; remarcação não o devolve. Sem plano/cota, particular normal não é agendada; gravação continua alternativa e Q34 mantém causa/aprovação próprias. Concluir uma tentativa regulariza a falta original uma única vez.

**Aceite de Q52:** depois do vencimento, novo envio é recusado inclusive por acesso direto/tela aberta anteriormente; entregas existentes permanecem disponíveis à avaliação do professor designado. Prorrogação sem motivo/autorização não libera etapa; prorrogação válida guarda datas e autor. Não alterar resultado/frequência automaticamente. Em matrícula pausada/encerrada, conferir também a liberação específica de Q36.

**Aceite de Q54:** proposta não muda resultado vigente antes da aprovação; autor não aprova a própria correção, inclusive acumulando papéis. Outra pessoa autorizada publica somente a versão válida, com efeitos em frequência/benefício conferidos conjuntamente. Alteração concorrente ou falha não produz aplicação parcial; valores anteriores permanecem com seus autores. Professor sem atribuição vigente não propõe por uma permissão encerrada; dados da aula original mantêm Q23.

**Aceite de Q55:** antes da aprovação, envio de resumo/atividade não exibe reposição concluída; depois dela, mostrar a data da validação docente. Detalhes conservam data e versão da entrega aprovada, inclusive após pedidos de correção. Particular continua mostrando data de realização; histórico não troca entrega por validação nem antecipa regularização.

**Aceite de Q58:** indisponibilidade confirmada pausa contagem da etapa e, após restabelecimento, devolve somente tempo restante, com intervalo/prazo anterior/novo no histórico. Relato não confirmado não altera prazo. Incidente repetido/sobreposto não duplica tempo; prazo já vencido antes do incidente não reabre sem prorrogação. Entregas anteriores permanecem e ajuste de prazo não contorna Q36 ou restrições de conteúdo.

**Aceite de Q60/Q61:** ingresso no meio do período recebe a cota integral, sem fração, e saldo livre expira ao final. Troca de plano mantém regra/cota atual e só aplica novo benefício no período seguinte. Reservas autorizadas permanecem e reduzem saldo para novas; ausência de saldo bloqueia novo agendamento sem cancelar os anteriores. Troca, reprocessamento ou mudança de referência não abrem segunda cota nem devolvem uso passado. Preservar condições/versionamento e escopo próprio de preço/contrato.

**Preparação restante:** consolidar transição de versões/períodos e o contrato de integração com troca de plano autorizada, sem presumir implementada a jornada comercial/financeira de F10. Correção/data seguem Q54/Q55; material/prazo Q57/Q58; benefícios seguem Q49–Q52/Q60/Q61 e demais regras de acesso permanecem. Progressão pertence a F09.

Q33 acrescenta a área autenticada de reposições, detalhada em F07.7; não equivale ao portal completo de F13. Q34 acrescenta particular excepcional apenas para indisponibilidade de gravação, com aprovação, sem consumo de benefício e sem cobrança adicional. Q77/Q79 definem Drive compartilhado do Workspace como fonte oficial, mantendo Zoom como possível ferramenta de gravação. Q81 substitui a entrega inicialmente prevista por link com reprodução dentro do ERP, via servidor e sem conta Google do aluno. Player/transmissão autorizada entram nesta entrega; armazenamento próprio permanente, captura/importação automática e movimentação do acervo entre serviços não foram incluídos. Venda avulsa de particulares, remuneração docente e operação presencial permanecem fora deste recorte.

### F07.7 — Área autenticada do aluno para reposições (recorte de F13)

**Problema:** Q33 exige que o aluno acompanhe reposições e envie entregas; Q81 exige assistir às gravações no ERP sem conta Google. O código atual não comprova identidade/permissões do aluno nem reprodução autenticada da fonte Drive para esse fluxo.

**Resultado desejado:** aluno consulta suas reposições, assiste no ERP aos vídeos autorizados sem conta Google, envia resumo/atividade, recebe avaliação/pedido de correção e acompanha o resultado.

**Corpo em preparação:**

- Estabelecer identidade autenticada vinculada ao cadastro correto do aluno, sem atribuir papel interno de funcionário ou criar novo cadastro acadêmico a cada acesso. Conforme Q72, oferecer convite individual por e-mail, definição da própria senha e recuperação por link de uso único com validade no e-mail verificado; equipe não consulta nem envia a senha.
- Restringir listagem, detalhe, materiais, envio, versões e feedback às reposições do aluno autenticado; validar no servidor, inclusive acesso direto por identificador.
- Integrar etapas e prazos de F07.6/Q35/Q52, preservando autoria e datas de entregas, correções e avaliação. Mostrar prazo vencido e bloquear novos envios até prorrogação justificada, sem apagar versões anteriores. Aluno não altera nota/decisão docente, cotas ou aprovações.
- Mostrar avaliações e pedidos de correção com seus autores mesmo após substituição docente de Q40; novas interações com o professor designado não sobrescrevem autoria ou reiniciam prazos.
- Mostrar “Reposta em [data da validação]” na reposição gravada concluída conforme Q55 e manter data/versão da entrega aprovada nos detalhes; não antecipar esse estado quando a entrega ainda aguarda avaliação.
- Permitir relato de material indisponível da própria reposição conforme Q57, sem expor outros materiais. Mostrar andamento da conferência e ajuste de prazo decorrente de indisponibilidade confirmada conforme Q58, preservando histórico das entregas e autorização vigente.
- Aplicar Q36 à situação da matrícula: na pausa/encerramento, manter as próprias reposições e avaliações em leitura; novos envios exigem autorização da gestão para a pendência específica, com motivo e prazo. Novos pedidos dependem de matrícula ativa. Conferir validade, escopo e eventual revogação da autorização em cada operação; preservar histórico da liberação e dos envios. Autenticação ou liberação de entrega não remove restrição vigente de conteúdo nem retoma a matrícula.
- Reutilizar matrícula e histórico; demais alunos, contatos pessoais de terceiros, financeiro e administração do ERP permanecem fora desse acesso.
- Implementar reprodução e controle de acesso pelo servidor conforme Q81: player recebe conteúdo autorizado pelo ERP, com fonte no Drive compartilhado de Q77/Q79. Manter credenciais da integração no servidor; não exigir login Google, tornar arquivo público ou usar link direto como substituto desse controle. Conferir permissões e acessos legados; cancelamento/revogação deve impedir novas leituras. Zoom continua somente como possível ferramenta de gravação.
- Delimitar identidade/autorização e telas como partes da mesma entrega verificável. A área cobre reposições, não presume consultas financeiras, edição cadastral ou acesso de responsáveis.

**Aceite candidato:** aluno A não lê, altera ou baixa entregas de aluno B por lista, identificador ou arquivo; aluno envia apenas nas etapas autorizadas e não confirma sua própria avaliação; professor designado vê as entregas necessárias sem ampliar contato/financeiro; mudança de permissão ou vínculo é revalidada; todas as versões permanecem atribuídas. Pausa/encerramento permite leitura do próprio histórico, mas bloqueia novos pedidos e envios sem liberação; autorização de uma pendência não libera outra e expiração/revogação volta a bloquear envios. Restrições contratuais/de acesso à gravação continuam aplicadas.

**Aceite de Q72:** convite é individual e vinculado ao aluno conferido; aceitá-lo não duplica cadastro nem concede acesso interno. Aluno define senha e recupera somente por link válido da conta no e-mail verificado. Link reutilizado, expirado, revogado ou de outro aluno falha sem alterar credenciais; equipe não obtém senha em tela, resposta ou envio. Login não amplia permissões de reposição, altera matrícula ou remove restrição de conteúdo. Validar convites, recuperação e autorização como jornada própria, sem considerar o login interno existente como evidência de entrega.

**Aceite de Q73/Q74:** aluno sem e-mail individual verificado fica com pendência de acesso e orientação da Secretaria, sem endereço fictício, conta compartilhada ou novo requisito financeiro. Após verificação, seguir convite de Q72. Secretaria/Administração pode preparar recuperação por perda do endereço; somente outra pessoa da Administração aprova/aplica. Recusar autoaprovação, aprovação pela Secretaria ou alteração de destinatário sem nova conferência. Novo e-mail e vínculo precisam estar validados; ao aplicar, invalidar links/sessões anteriores e iniciar recuperação sem exposição de senha. Preservar identidade/histórico e não conceder acesso a responsável por essa decisão.

**Aceite de Q77/Q78, atualizado por Q81:** material publicado identifica arquivo do Drive e aula/reposição; provar leitura da fonte pela integração e acesso permitido/negado pelo servidor para o aluno. Revogar autorização no ERP deve impedir novas leituras desse aluno; não exige retirar o acesso institucional da integração ao arquivo. Conferir acessos diretos/públicos legados que possam contornar a política. Preservar histórico e gerar pendência se controles não forem aplicáveis. Resend envia com configurações verificadas e estados separados de envio/entrega; reenvio não duplica mensagem nem usa convite expirado/destinatário revogado. Falha não é marcada como entrega. Validar integrações reais antes da operação.

**Preparação decorrente de Q79/Q80:** validar Drive compartilhado e conta de integração autorizada, com acesso limitado ao material necessário. Q81 definiu a reprodução intermediada pelo servidor; alunos não precisam de contas Google. Registrar geniusidiomas.com como domínio informado, mantendo verificação DNS/Resend, remetente, destino de respostas e capacidade como configuração exigida antes de envios reais. Informações fornecidas não são evidência de integração implementada ou homologada.

**Preparação de acesso:** Q72–Q74 definiram convite/e-mail/senha, pendência até endereço individual verificado e recuperação assistida com aprovação independente da Administração. Especificar identidade, comprovação de vínculo, proteção de tokens, sessões, revogação e falhas de entrega conforme essas regras; controles continuam pendentes de implementação.

**Dependências:** fluxo e dados de F07.6, política temporal de Q36, identidade/autorização do aluno e integração privada com Drive compartilhado, player e serviço de transmissão de Q81. Validar capacidade da hospedagem e fonte antes de operar. Portal completo de F13 continua separado e pendente.

#### Preparação técnica da reprodução no ERP — Q81

Esta é a ampliação aprovada da F07.7, ainda sem implementação ou homologação. Proposta técnica inicial: player no portal e serviço autenticado de mídia que lê trechos do arquivo no Drive e transmite ao aluno autorizado. Não usar incorporação de um link restrito como evidência de reprodução sem conta Google. Drive permanece como fonte oficial; Zoom não recebe integração de publicação nesta entrega.

| Parte | Especificação a implementar e validar |
|---|---|
| Origem e identidade | Registrar Drive, arquivo e versão/material vinculados à aula/reposição. Usar identidade de integração da escola somente no servidor, com o menor acesso necessário. Não solicitar conta/senha Google ao aluno nem conceder a ele permissão direta no Drive como requisito do fluxo |
| Autorização por requisição | Resolver material a partir da reposição autorizada; conferir aluno, matrícula, contrato/restrições e versão vigente antes de retornar metadados ou conteúdo, inclusive em requisições parciais e retomadas. Rejeitar identificadores de outro aluno e URLs/arquivos arbitrários; conhecer o identificador não concede acesso |
| Leitura da fonte | Conferir capacidades/permissões da conta de integração para ler conteúdo. Uma restrição do Drive não pode ser contornada. A leitura pela API para reprodução de Q81 não oferece cópia offline ao aluno: Q82 permite somente assistir |
| Reprodução e recursos | Transmitir por fluxo com memória limitada, controle do ritmo e cancelamento da leitura upstream ao fechar o player. Suportar avanço/retomada por intervalos de bytes, respostas parciais e intervalos inválidos; validar limites dos intervalos e evitar carregar o vídeo inteiro na memória |
| Sessão e retirada de acesso | Revalidar autorização em cada requisição; projetar transmissão limitada e mecanismo de encerramento de fluxos ativos quando houver revogação relevante. Impedir novas leituras após expiração/revogação, inclusive em outra aba. Dados já recebidos pelo dispositivo não podem ser recolhidos pelo servidor; explicitar esse limite na homologação |
| Segredos e cache | Não retornar credenciais Google, URLs públicas ou redirecionamentos que dispensem a autorização do ERP. Evitar cache público/compartilhado de respostas privadas; cache técnico eventualmente proposto precisa preservar isolamento e revogação. Não inclui espelhamento permanente do acervo, novo serviço de armazenamento ou transcodificação automática por esta decisão |
| Compatibilidade e falhas | Validar formatos/codecs dos arquivos reais, player nos navegadores usados, início/avanço/retomada e troca da versão do material. Arquivo removido, inacessível ou incompatível gera estado de material pendente; não declarar disponível só porque existe um link. Repetições/falhas não confirmam reposição nem presença |
| Capacidade e operação | Medir espectadores simultâneos, duração/tamanho/bitrate dos vídeos, tempo inicial, interrupções, memória, banda de entrada/saída, requisições/cotas da API e custos do ambiente. Definir limites e retentativas limitadas para falhas transitórias. Conferir capacidade contratada antes de habilitar uso real; não presumir custo zero ou contratar serviço por esta especificação |

A evidência de publicação deve corresponder à versão conferida do material. Detectar troca do conteúdo no Drive sob o mesmo identificador e encaminhar a regularização conforme Q23/Q34, sem servir silenciosamente uma versão nova como se fosse a aprovada. Interrupção confirmada e prazos do aluno seguem Q57/Q58; simples falha transitória não substitui a conferência da gestão. Abrir o player, avançar ou chegar ao fim do vídeo não aprova a reposição: continuam valendo entrega e avaliação de Q13/Q27.

**Aceite adicional de Q81:** aluno autorizado assiste sem sessão Google; outro aluno, sessão expirada ou permissão revogada não recebe novos trechos nem metadados privados. Trocar o identificador, reutilizar URL de mídia ou enviar intervalos alternativos não contorna a autorização. Testar início/avanço/retomada, fechamento do player, revogação durante reprodução, arquivos grandes/incompatíveis e falhas/limites da fonte. Demonstrar que respostas/logs não expõem credenciais e que memória e tráfego permanecem dentro da capacidade validada. Validar com arquivo representativo no Drive compartilhado autorizado; testes simulados não comprovam integração real. Q82 permite somente assistir, sem recurso de download ou acesso offline.

**Base técnica consultada em 09/09/2026:** o Google documenta [leitura de conteúdo e intervalos de bytes](https://developers.google.com/workspace/drive/api/guides/manage-downloads), além de [limites, cotas e tratamento de falhas](https://developers.google.com/workspace/drive/api/guides/limits). Esses recursos sustentam a proposta de intermediação; não comprovam desempenho no projeto. O repositório prepara Next.js em [Docker](../../Dockerfile) e [Compose de produção](../../docker-compose.prod.yml), mas os arquivos de implantação não comprovam recursos contratados, ambiente ativo ou capacidade de vídeo.

**Aceite de Q82:** player oferece reprodução sem recurso de baixar gravação ou modo offline; não há rota adicional de exportação do vídeo nem cache do aplicativo para uso offline. Autorização permanece aplicada às requisições de reprodução. Não bloquear a leitura técnica de trechos necessária ao player nem apresentar essa política como proteção absoluta contra captura/cópia. Assistir até o fim continua sem concluir automaticamente a reposição.

## 6. Registro das respostas encerradas

- **Q04:** A — quantidade de aulas por nível.
- **Q05:** A — Secretaria, Gerência Pedagógica e Administração organizam; outra pessoa da Gerência Pedagógica/Administração aprova alterações.
- **Q06:** calendário único da escola para todas as turmas. A justificativa foi a possibilidade de turmas mistas; não ficou um compromisso de acrescentar calendários por país depois.
- **Q07:** professor preenche presenças e justifica a ausência de gravação recuperável; outra pessoa da Gerência Pedagógica/Administração pode concluir com exceção explícita.
- **Q08:** gestão escolhe uma data da grade ou extraordinária ao decidir a reposição de aula cancelada; sistema alerta conflitos e mostra efeito no término. O usuário acrescentou reposição individual de aula perdida, com exibição da data após sua conclusão.
- **Q09:** resposta própria do usuário, substituindo as alternativas anteriores: mensalidade sempre integral, com exceção no encerramento solicitado pelo aluno. Entrada, atraso e mudança de nível não foram autorizados como gatilhos de proporcionalidade. Q12 definiu o tratamento do último período.
- **Q10:** resposta própria do usuário, substituindo as alternativas anteriores: aula particular se o plano permitir, ou disponibilização de gravação para o aluno assistir e entregar resumo + atividade. A reposição por participação em outra turma não foi escolhida. Q13/Q14 fecharam avaliador e configuração do benefício.
- **Q11:** A — outra pessoa da Gerência Pedagógica/Administração aprova o pedido registrado; Secretaria executa o agendamento autorizado.
- **Q12:** A — proporcional até a data efetiva de encerramento, com apuração de saldo/crédito e preservação dos recebimentos. Q15 definiu a base de dias reais; não foi escolhida a alternativa de manter sempre integral no encerramento.
- **Q13:** A — professor designado avalia resumo e atividade, pede correção quando necessário e confirma a reposição; gestão acompanha pendências. Entrega automática não foi escolhida como conclusão.
- **Q14:** A — limite configurável por plano e período: permitir e definir quantidade mensal ou em outro período escolhido; agendamento reserva disponibilidade. Q16 definiu consumo/devolução do benefício.
- **Q15:** A com complemento — dias reais do período de cobertura: dividir o valor mensal pelos dias efetivos desse período e multiplicar pelos dias cobertos até o encerramento. O usuário acrescentou multa quando prevista no contrato. Q17/Q18 definiram tipos suportados e aprovação; nenhum percentual ou valor foi definido.
- **Q16 — registrada em 09/09/2026:** A — prazo configurável: realização consome; cancelamento do aluno dentro do prazo devolve; cancelamento tardio ou falta consome. A pergunta também previa devolução no cancelamento pela escola e ausência de consumo duplicado na remarcação do mesmo pedido. Nenhum prazo numérico foi escolhido.
- **Q17 — registrada em 09/09/2026:** A — valor fixo ou percentual conforme contrato; no percentual, registrar também a base de cálculo e as condições da cláusula.
- **Q18 — registrada em 09/09/2026:** A — Financeiro prepara; outro Financeiro com permissão de aprovação ou outra pessoa da Administração confere antes da efetivação. Dispensa/alteração de multa exige justificativa e autorização; não há autoaprovação.
- **Q19 — registrada em 09/09/2026:** A — permitir exceção justificada em feriado, recesso ou férias para um encontro específico, inclusive reposição ou particular, com aprovação de outra pessoa da Gerência Pedagógica/Administração e verificação de conflitos. O restante da escola mantém o calendário normal.
- **Q20 — registrada em 09/09/2026:** A — ERP sugere novas datas para todas as turmas afetadas pela alteração de feriado/recesso; equipe revisa/ajusta e outra pessoa autorizada aprova o conjunto com seus impactos. Calendário único, aulas ministradas e registros passados preservados; alteração aguarda aprovação e resolução dos conflitos.
- **Q21 — registrada em 09/09/2026:** A — aprovação independente efetiva a proposta revisada de calendário/agenda se continuar válida; Secretaria acompanha o resultado, sem segunda etapa de execução. Conflitos ou mudanças relevantes exigem nova conferência antes de aplicar. Q11 continua regendo autorização/agendamento da reposição individual.
- **Q22 — registrada em 09/09/2026:** A — avisos dentro do ERP; professor recebe pendências/lembretes; gestão acompanha painel e recebe alerta de prazo vencido. Prazo e intervalo configuráveis, sem valores padrão presumidos.
- **Q23 — registrada em 09/09/2026:** A — toda correção de aula concluída exige proposta do professor responsável ainda vinculado ou equipe autorizada, motivo e aprovação de outra pessoa da Gerência Pedagógica/Administração para publicação. Preservar antes/depois e conferir impactos; professor desvinculado mantém histórico somente leitura.
- **Q24 — registrada em 09/09/2026:** A — gestão designa professor ou integrante autorizado da gestão para regularizar a pendência, com acesso limitado àquela aula, motivo e histórico. Preservar autoria original, identificar regularizador e não transferir vínculo de turma; exceção de gravação mantém Q07.
- **Q25 — registrada em 09/09/2026:** A — não acumular: saldo livre expira ao terminar o período; o próximo recebe apenas sua própria cota. Preservar reservas existentes e agendamentos autorizados.
- **Q26 — registrada em 09/09/2026:** A — período da particular agendada. Mudar reserva ainda não consumida para outro período libera a anterior e reserva a nova, conferindo saldo antes de confirmar; sem duplicar utilização nem desfazer consumo por falta/cancelamento tardio.
- **Q27 — registrada em 09/09/2026:** A — particular concluída e gravação com entrega aprovada regularizam frequência; distinguir presença original de regularização por reposição. Preservar falta original e contar cada aula uma única vez, mantendo critérios acadêmicos adicionais separados.
- **Q28 — registrada em 09/09/2026:** C — conforme regra registrada no contrato: ERP permite incluir/excluir o dia de encerramento, identifica a regra aplicável à matrícula e mostra explicitamente o último dia coberto.
- **Q29 — registrada em 09/09/2026:** C — manter crédito para uso futuro até solicitação de devolução; se o aluno pedir, Financeiro processa e registra. Preservar recebimento original e distinguir apuração de crédito da execução da devolução.
- **Q30 — registrada em 09/09/2026:** A — continuidade automática quando prevista no contrato: gerar próximos períodos integrais com continuidade contratada e matrícula ativa, respeitando pausa/encerramento; sem previsão, solicitar renovação. Não duplicar período na mudança de nível nem estender por pendência do diário.
- **Q31 — registrada em 09/09/2026:** A — retroatividade somente por exceção justificada. Normalmente data solicitada igual/posterior ao pedido; data anterior exige motivo, evidências e aprovação explícita no acerto. Preservar data de registro e data efetiva, sem deslocamento por demora interna.
- **Q32 — registrada em 09/09/2026:** A — suspender novas mensalidades dos períodos sem oferta; registrar indisponibilidade da escola e retomar somente após regularizar oferta e condições da matrícula. Preservar cobranças/pagamentos anteriores; distinguir de feriados/recessos previstos.
- **Q33 — registrada em 09/09/2026:** A — área autenticada do aluno com suas reposições, link de gravação, envio de resumo/atividade e acompanhamento de avaliação/correções; incluir identidade e acesso do aluno para esse fluxo.
- **Q34 — registrada em 09/09/2026:** A — gestão escolhe gravação substituta equivalente com resumo/atividade ou particular excepcional sem consumir benefício e sem cobrança adicional; registrar escolha e motivo. Particular excepcional exige aprovação de outra pessoa da Gerência Pedagógica/Administração.
- **Q35 — registrada em 09/09/2026:** A — prazos configuráveis para primeira entrega e para responder a cada pedido de correção; material precisa estar realmente disponível para iniciar o prazo. Gestão pode autorizar prorrogação com motivo registrado; nenhum número de dias foi presumido.
- **Q36 — registrada em 09/09/2026:** A — histórico das próprias reposições e avaliações em leitura durante pausa/encerramento; novas entregas bloqueadas, salvo liberação da gestão para pendência específica, com motivo e prazo. Novos pedidos dependem de matrícula ativa. Preservar entregas/avaliações e aplicar contrato e restrições vigentes à gravação; a liberação não retoma a matrícula nem remove bloqueio de aulas.
- **Q37 — registrada em 09/09/2026:** B — permitir exceção aprovada por turma: herdar duração/frequência da modalidade, mas permitir proposta justificada de valores diferentes; outra pessoa da Gerência Pedagógica/Administração aprova antes da publicação.
- **Q38 — registrada em 09/09/2026:** A com complemento do usuário — ERP, WhatsApp institucional e e-mail se cadastrado. Equipe acompanha no ERP; alunos/responsáveis autorizados recebem aviso consolidado após a aplicação, com registro dos envios. E-mail foi acrescentado ao WhatsApp como canal adicional quando cadastrado; manter pendência para a Secretaria se faltar destinatário autorizado ou houver falha/indisponibilidade.
- **Q39 — registrada em 09/09/2026:** A — professor solicita indisponibilidade com período/motivo; Secretaria/gestão também podem registrar. Outra pessoa da Gerência Pedagógica/Administração aprova. Bloquear novos agendamentos no período aprovado e deixar aulas existentes pendentes de solução aprovada, sem cancelamento ou troca de professor automáticos.
- **Q40 — registrada em 09/09/2026:** A — Gerência Pedagógica/Administração designa outro professor avaliador, com motivo e acesso limitado à reposição. Preservar avaliações, autores e histórico; prazos do aluno continuam válidos, salvo prorrogação registrada conforme Q35.
- **Q41 — registrada em 09/09/2026:** A — aprovar o conjunto completo: ERP prepara os impactos de todas as turmas afetadas pela mudança da modalidade; equipe resolve os conflitos e outra pessoa da Gerência Pedagógica/Administração aprova o conjunto. Aplicar tudo na mesma operação, como nas mudanças globais de feriado/recesso, preservando histórico, finalizadas e revisão das exceções locais.
- **Q42 — registrada em 09/09/2026:** A — reduzir somente antes do início: turmas em andamento conservam quantidade anterior; ainda não iniciadas podem receber redução mediante revisão/aprovação conjunta. Novas turmas usam a nova configuração. Preservar aulas ministradas e encontros passados pendentes.
- **Q43 — registrada em 09/09/2026:** A — aumentos atualizam todas as turmas não finalizadas, em andamento ou ainda não iniciadas; recalcular rascunhos sem publicá-los e submeter alterações de agendas publicadas à aprovação conjunta; preservar finalizadas.
- **Q44 — registrada em 09/09/2026:** A — turma sem professor somente como rascunho: equipe prepara turma/previsão, mas precisa de professor definido e disponível para publicar agenda e alocar alunos. Rascunho não confirma disponibilidade docente.
- **Q45 — registrada em 09/09/2026:** A — fuso oficial da escola configurável; interpretar todos os dias não letivos nessa referência institucional e converter encontros para conferir. Preferência de visualização não muda resultado; manter origem da turma.
- **Q46 — registrada em 09/09/2026:** A — próximo encontro válido da grade: data informada é limite a partir do qual gerar; começar no primeiro dia/horário letivo da grade e mostrar diferença entre data informada e primeira aula efetiva.
- **Q47 — registrada em 09/09/2026:** A — permitir na grade normal aulas que atravessem meia-noite; gerar data/hora final a partir de início/duração, conferir todo o intervalo e mostrar as duas datas. Qualquer parte em período não letivo exige exceção de Q19 na referência de Q45.
- **Q48 — registrada em 09/09/2026:** A — início automático no primeiro encontro previsto não cancelado; Gerência Pedagógica/Administração confirma conclusão depois de conferir meta cumprida e pendências resolvidas. Estado da aula é distinto; não aprovar alunos, encerrar matrículas ou cancelar mensalidades automaticamente.
- **Q49 — registrada em 09/09/2026:** A — referência configurável por plano: duração do período e calendário civil ou ciclo com data de referência da matrícula. Exigir configuração completa e mostrar início/fim de cada cota, sem presumir quantidade/prazo.
- **Q50 — registrada em 09/09/2026:** A — mudança no benefício vale no próximo período de cada aluno; manter regra do período atual. Honrar particulares já autorizadas e considerar reservas antes de aceitar novas; se já ocuparem a nova cota, não abrir saldo adicional. Preservar utilizações, reservas e condições contratuais aplicáveis, sem reiniciar saldo por edição.
- **Q51 — registrada em 09/09/2026:** A — permitir nova tentativa particular mediante novo pedido/aprovação e nova conferência de saldo, se o plano permitir. Tentativa anterior permanece consumida; gravação com resumo/atividade continua alternativa. Preservar Q11, regra de consumo de Q16 e causa específica da exceção de Q34.
- **Q52 — registrada em 09/09/2026:** A — bloquear novos envios após prazo vencido até prorrogação autorizada pela gestão com motivo; mostrar pendência e registrar novo prazo. Professor continua podendo avaliar entregas já registradas. Vencimento não aprova/reprova automaticamente; pausa/encerramento continua seguindo Q36.
- **Q53 — registrada em 09/09/2026:** A — lista histórica automática: calcular alunos pelo vínculo/situação na data da aula e permitir lançamento pelo responsável autorizado mesmo após saída posterior do aluno. Dados limitados à aula; não inventar presença ou reabrir acesso amplo ao professor desvinculado.
- **Q54 — registrada em 09/09/2026:** A — toda correção de reposição concluída exige proposta justificada do professor designado vigente ou gestão e aprovação/publicação por outra pessoa da Gerência Pedagógica/Administração. Manter resultado anterior até aplicar correção válida e conferir efeitos; preservar histórico e Q23 para dados da aula original.
- **Q55 — registrada em 09/09/2026:** A — mostrar “Reposta em [data da validação]” na reposição gravada; data da versão entregue/aprovada fica nos detalhes. Preservar ambas e regularizar frequência somente após aprovação. Particular mantém data de realização.
- **Q56 — registrada em 09/09/2026:** A — Secretaria, Gerência Pedagógica ou Administração preparam substituto, aulas/período e motivo; outra pessoa autorizada aprova/aplica. Preservar titular, autoria real e acesso limitado aos encontros atribuídos; ausência não escolhe substituto automaticamente.
- **Q57 — registrada em 09/09/2026:** A — aluno relata problema na própria reposição/material autorizado; professor/equipe também registram no ERP. Gestão confere indisponibilidade e acompanha regularização, preservando conclusão da aula e histórico; manter Q23/Q34.
- **Q58 — registrada em 09/09/2026:** A — pausar contagem durante indisponibilidade confirmada, com início/fim registrados; material restabelecido retoma somente tempo restante. Registrar intervalo e nova data limite, preservar entregas e manter Q36/restrições vigentes.
- **Q59 — registrada em 09/09/2026:** A — “Impedido por restrição” separado das faltas comuns, mantendo aula na base de frequência e sem presença/regularização até reposição concluída. Informação docente somente operacional; preservar restrições, autorizações e histórico.
- **Q60 — registrada em 09/09/2026:** A — cota integral do período de entrada: quantidade completa do plano, consumo/reserva normal e expiração do saldo livre ao fim; sem acumulação ou proporcionalidade por entrada parcial.
- **Q61 — registrada em 09/09/2026:** A — benefício do novo plano no próximo período; manter regra/cota atuais até o fim, honrar particulares autorizadas e considerar reservas antes de liberar saldo. Preservar usos e impedir cota duplicada; condições de preço/contrato/acerto pertencem ao fluxo próprio da troca.
- **Q62 — registrada em 09/09/2026:** A — referência definida no contrato da matrícula, permitindo mês civil ou ciclo mensal com data registrada; guardar início/fim de cada cobertura separados do vencimento. Contrato sem regra suficiente exige conferência; sem nova proporcionalidade na entrada/continuidade.
- **Q63 — registrada em 09/09/2026:** C — método definido no contrato: suportar desconto antes ou depois do proporcional, registrar qual se aplica à matrícula e mostrar a ordem de cálculo. Condição do desconto pouco clara exige conferência antes de aprovar; manter multa separada, recebimentos e aprovação do acerto.
- **Q64 — registrada em 09/09/2026:** A — antecedência configurável ao vencimento: gerar cada nova mensalidade ao atingir esse prazo, conferindo novamente contrato, matrícula e oferta. Sem números presumidos, duplicação de períodos ou alteração de cobranças antigas.
- **Q65 — registrada em 09/09/2026:** A — pausa imediata na data registrada; manter integral o período iniciado e suspender os períodos seguintes abrangidos pela pausa. Acesso passa às regras de matrícula pausada; preservar recebimentos e histórico, sem proporcional ou devolução automática pela parte não utilizada.
- **Q66 — registrada em 09/09/2026:** A — reprogramar cobertura dos períodos suspensos a partir do retorno, conforme referência contratual; manter separada a escolha de vencimentos originais/reprogramados e aprovar as duas informações na mesma proposta. Preservar períodos já iniciados, recebimentos e regras de aprovação de D13; evitar sobreposição e cobrança duplicada.
- **Q67 — registrada em 09/09/2026:** C — aluno escolhe entre crédito e cobertura futura permitidos pelo contrato; Financeiro registra escolha e prepara proposta para aprovação independente. Sem escolha ou dados suficientes, manter regularização pendente; preservar cobrança/recebimentos e evitar duplicação. Aplicável a período inteiro sem oferta.
- **Q68 — registrada em 09/09/2026:** A — autorizar cada utilização: solicitação/concordância do aluno, proposta do Financeiro para cobranças identificadas e aprovação de outra pessoa autorizada do Financeiro/Administração antes de aplicar. Registrar origem, destino, valor e saldo; impedir uso/devolução duplicados e transferência para outro aluno.
- **Q69 — registrada em 09/09/2026:** A — preparador pode executar a devolução após outra pessoa autorizada aprovar, se também tiver permissão de execução. Exigir ao menos duas pessoas distintas, proposta com pedido/saldo/valor/destino conferido e evidência da execução; mudança de valor ou destino exige nova aprovação.
- **Q70 — registrada em 09/09/2026:** A — manter valor integral e recompor os dias de cobertura indisponíveis após o retorno, sem cobrança adicional pela compensação. Proposta mostra extensão e início dos próximos períodos, sem sobreposição ou cobrança dos dias compensados; Financeiro prepara e outra pessoa autorizada aprova, preservando contrato, recebimentos e histórico.
- **Q71 — registrada em 09/09/2026:** B — com concordância do aluno, Financeiro propõe cobrança final única com saldo/vencimento para aprovação independente. Anteriores vinculadas como substituídas, sem apagamento ou duplicidade; sem acordo, condições originais. Encerramento respeita a data efetiva após acerto aprovado, sem esperar quitação. Usuário confirmou que o fragmento da opção C era erro de digitação; parcelamento não foi escolhido.
- **Q72 — registrada em 09/09/2026:** A — e-mail e senha com convite individual; aluno define senha, recuperação por link de uso único com validade no e-mail verificado. Equipe não consulta nem envia a senha; conferir vínculo, sem duplicar cadastro acadêmico ou conceder papel interno.
- **Q73 — registrada em 09/09/2026:** A — Secretaria orienta aluno/responsável a providenciar e verificar endereço individual antes do convite; registrar pendência de acesso até lá e seguir Q72. Não foram escolhidos fornecimento de caixa institucional nem acesso próprio do responsável ao portal.
- **Q74 — registrada em 09/09/2026:** A — Secretaria/Administração prepara; outra pessoa da Administração confere, aprova e aplica a troca do e-mail perdido. Conferir identidade/vínculo, validar novo endereço, registrar motivo/decisão e invalidar links/sessões anteriores ao aplicar; equipe não define nem recebe senha, sem autoaprovação.
- **Q75 — registrada em 09/09/2026:** informação operacional — escola usa Google Drive e Zoom. Não foi informado um único repositório oficial nem detalhada a combinação de gravação/armazenamento, conta/plano ou permissões disponíveis; isso ainda exige definição/conferência.
- **Q76 — registrada em 09/09/2026:** informação operacional — ainda não existe serviço de e-mail definido para essa operação. Integração, domínio/remetente e condições de produção ainda precisam ser preparados; não houve contratação nem ativação de envios.
- **Q77 — registrada em 09/09/2026:** A — Google Drive como fonte oficial: Zoom pode continuar para gravar, material liberado ao aluno é publicado no Drive, concentrando integração de acesso em um serviço. Conferir contas/permissões; não inclui transferência automática de arquivos nem captura automática.
- **Q78 — registrada em 09/09/2026:** A — Resend escolhido para e-mails automáticos; plano a definir conforme volume/picos. Referências de preço consultadas não equivalem à contratação de plano gratuito/Pro, definição de domínio/remetente ou ativação de envio. Configurar e validar antes de operar.
- **Q79 — registrada em 09/09/2026:** A — Drive compartilhado do Google Workspace da escola; arquivos na estrutura da organização. Identificar Drive e conta autorizada e validar controles reais; não presumir permissões por arquivo nem configuração de compartilhamento externo.
- **Q80 — registrada em 09/09/2026:** resposta livre — “Sim”, com https://www.geniusidiomas.com/. Confirma domínio próprio informado como geniusidiomas.com; não escolhe entre administração direta/terceirizada do DNS nem define remetente/subdomínio. Esses detalhes e a verificação real permanecem na preparação antes da operação; não atribuir automaticamente opção A ou B.
- **Q81 — registrada em 09/09/2026:** C — Assistir pelo próprio ERP sem exigir conta Google do aluno; ampliar a entrega com reprodução e controle de acesso pelo servidor. Drive permanece como fonte oficial; validar desempenho, permissões e custos antes de operar. F07.7 incorpora player/transmissão autenticada; a decisão não comprova implementação nem escolhe política de download.
- **Q82 — registrada em 09/09/2026:** A — Somente assistir no ERP: oferecer reprodução sem recurso de download ou acesso offline. Manter acesso autorizado e avaliação de Q13/Q27; não significa impedir captura/cópia por outros meios.
- **Q83 — registrada em 09/09/2026:** A — Acertar financeiramente no encerramento os dias de compensação ainda devidos; ajustar saldo e apurar possível crédito de valores já pagos, com cálculo e aprovação no acerto. Preservar origem, pagamentos e compensações realizadas; impedir duplicação e manter Q29/Q68/Q69 para destino/uso/devolução do crédito.
- **Q84 — registrada em 09/09/2026:** resposta livre — usuário possui planilhas com alguns dados reais e deseja aproveitar o máximo de dados reais para iniciar produção após migração. Não escolheu A/B/C nem classificou a base atual do ERP; não informou conjuntos/volume nem comprovou completude. Preparar inventário, mapeamento, conferência e homologação; não autoriza exclusão de dados ou operação em produção.
- **Q85 — registrada em 09/09/2026:** encaminhamento — usuário informou que pode fornecer os dados necessários e pediu a lista. Entregue [checklist de dados para migração](checklist-dados-migracao.md), com prioridade, campos, históricos complementares e conferência de origem. Grupos/conteúdo das fontes ainda não foram confirmados; nenhuma alternativa A/B/C foi escolhida e não houve recebimento/importação dos dados.
- **Complemento de Q85 — 10/09/2026:** usuário forneceu `Operacional Leticia (2).xlsx` e pediu comparar seu conteúdo ao checklist para solicitar o restante ao time. [Análise concluída](analise-planilha-operacional-leticia.md): 106 alunos, 42 turmas, 89 vínculos iniciais, 14 alterações e financeiro parcial de julho a dezembro de 2026. Datas provisórias, vínculos divergentes, dados financeiros incompletos e modelos por hora/antecipação/permuta exigem conferência. Complementos e células de origem documentados; original preservado, sem importação no ERP.
- **Q86 — registrada em 10/09/2026:** C — permitir mensalidade fixa e cobrança por hora nas particulares, conforme o contrato, com regras e saldos separados. Amplia o escopo a detalhar; particulares contratadas permanecem separadas da cota de reposições. Forma de apuração das horas, cobrança de faltas/cancelamentos e antecipações precisam dos respectivos detalhamentos; não presumir esses comportamentos nem converter contratos antigos automaticamente.
- **Q87 — registrada em 10/09/2026:** C — permitir antecipação que quite períodos/serviços identificados ou crédito ainda sem destinação, conforme acordo documentado. Preservar recebimento original, data/valor e alocações; não registrar novo recebimento por mês quitado nem usar o mesmo saldo duas vezes. Uso posterior do crédito mantém concordância e aprovação de Q68. Não presumir pacote de horas apenas porque houve antecipação.
- **Q88 — registrada em 10/09/2026:** A — empresa como responsável financeiro de contratos individuais, com pagamentos vinculados aos alunos e sem portal empresarial nesta entrega. Não inclui contrato coletivo/cobrança consolidada de F20 nem concede acesso automático aos dados pedagógicos, materiais ou conversas do aluno.
- **Q89 — registrada em 10/09/2026:** A — conferência da permuta por período: Pedagógico confirma o serviço prestado; Financeiro propõe a compensação das cobranças identificadas conforme acordo; outro Financeiro com permissão de aprovação/Administração aprova antes de aplicar. Registrar vigência, contrapartida, evidências e compensação, sem criar dinheiro recebido. Quantidade, valor e tratamento de descumprimento dependem do acordo e do detalhamento restante.
- **Q90 — registrada em 10/09/2026:** A — permitir dia de vencimento de 1 a 31. Quando o mês não tiver o dia contratado, usar seu último dia, preservando a referência para os seguintes. Não alterar cobranças anteriores, cobertura ou usar calendário letivo como financeiro. Ajustes por fim de semana/feriado financeiro permanecem para detalhamento.
- **Q91 — registrada em 10/09/2026:** A — duração contratada de cada encontro como base de cobrança da particular por hora; diferenças com efeito financeiro exigem ajuste justificado e aprovado. Guardar duração prevista/registrada, respeitar autorização contratual de acréscimos e tratar redução do serviço pela escola; professor não recebe visibilidade financeira adicional. Unidade de preço segue o detalhamento de Q94.
- **Q92 — registrada em 10/09/2026:** A — prazo configurável: cancelamento do aluno dentro do prazo não é cobrado; cancelamento tardio ou falta cobra o valor integral do encontro particular por hora. Não presumir prazo numérico; identificar ocorrência financeira sem lançar presença/aula ministrada. Serviço antecipado não gera cobrança duplicada. Não altera mensalidade fixa nem movimenta a cota de reposições.
- **Q93 — registrada em 10/09/2026:** A — fechamento mensal das particulares por hora pagas após apuração: reunir ocorrências conferidas do período em uma cobrança detalhada por contrato, com vencimento definido. Discriminar encontros, quantidades e valores; reexecução não duplica ocorrência. Antecipações mantêm Q87 e não são cobradas novamente como dívida posterior.
- **Q94 — registrada em 10/09/2026:** A — hora de 60 minutos com frações: quantidade cobrável = minutos contratados divididos por 60. Não arredondar tempo para cima; separar arredondamento monetário da quantidade. Mantém a duração contratada de Q91; exemplo de 75 minutos corresponde a 1,25 hora, sem definir preço.
- **Q95 — registrada em 10/09/2026:** A — no cancelamento pela escola de particular por hora, aluno escolhe remarcação ou crédito do valor já pago. Não cobrar encontro cancelado nem consumir horas como realizadas. Registrar escolha, preservar recebimento e evitar duplicação. Remarcação segue agenda aprovada; Financeiro prepara ajuste e outra pessoa autorizada aprova. Uso/devolução de crédito conserva Q68/Q69.
- **Q96 — registrada em 10/09/2026:** A — durante pausa aprovada, suspender a contagem de validade das horas particulares antecipadas não utilizadas, conservando saldo e somente o tempo que restava ao retomar. Sem validade no contrato, não criar prazo. Suspender novos agendamentos na pausa; retomada exige proposta/aprovação, sem repor consumo nem criar saldo. Mensalidade fixa conserva Q65/Q66.
- **Q97 — registrada em 10/09/2026:** A — no encerramento, converter em crédito o saldo não utilizado de horas particulares pagas antecipadamente, com memória de cálculo e aprovação do acerto por outra pessoa autorizada. Preservar horas utilizadas/legitimamente cobradas, compra original, descontos aplicáveis e multa contratual separada; não reprecificar pela tabela atual. Novas aulas exigem contratação ativa. Uso/devolução do crédito mantém Q68/Q69.
- **Q98 — registrada em 10/09/2026:** A — na permuta parcial, compensar apenas a parte comprovada conforme fórmula do acordo; restante permanece devido nas condições aplicáveis. Mantém confirmação pedagógica, proposta financeira e aprovação independente de Q89. Regra insuficiente exige conferência; não inventar pagamento, perdão ou multa.
- **Q99 — registrada em 10/09/2026:** C — regra explícita no contrato define manter a data ou prorrogar ao próximo dia útil financeiro; exigir referência financeira aplicável configurada. Aplicar depois do cálculo mensal de Q90, guardando data calculada/ajustada e preservando referência, cobertura e contratos existentes. Calendário letivo único não vira calendário financeiro, e não há presunção de regra universal entre países.
- **Q100 — registrada em 10/09/2026:** C — configuração de entrada própria da oferta por hora: exigir ou dispensar adiantamento inicial, com valor/horas explicitados e registrados no contrato. Manter aceite confirmado pela Secretaria e taxa regularizada nas condições aprovadas; informe a conferir não é recebimento. Não criar primeira mensalidade fictícia nem alterar ativação das ofertas mensais.
- **Q101 — registrada em 10/09/2026:** C — no fechamento incompleto por contrato/período, Financeiro propõe aguardar ou emitir parcialmente; outra pessoa autorizada aprova escolha/efeitos antes da emissão parcial. Discriminar ocorrências incluídas e pendentes, preservando complementares com vínculo ao mesmo fechamento. Não presumir realização ou duplicar encontros; outros contratos conferidos seguem normalmente. Pendência apenas de material/gravação tem acompanhamento próprio.
- **Q102 — registrada em 10/09/2026:** C — permitir selecionar um ou vários contratos na solicitação de pausa/encerramento, mostrando e aprovando os impactos do conjunto antes de aplicar e preservando os que ficaram fora. Cada contrato conserva suas regras, saldos, datas, acesso e aprovações. Não apagar cadastro/dívida nem bloquear outro contrato ativo pelo status global do aluno. Revisar vínculos de turma, retomada e mudança acadêmica para identificar a matrícula correta.

## 7. Situação das perguntas e cenários fechados

**Q04–Q84 e Q86–Q102 estão respondidas e registradas.** Após o [checklist da migração](checklist-dados-migracao.md) de Q85, a primeira planilha real foi recebida e [analisada em 10/09/2026](analise-planilha-operacional-leticia.md). Seu inventário está concluído; complementos, conciliação e inventário das demais fontes permanecem para levantamento posterior conforme orientação do usuário. A revisão dirigida de integração e os [14 corpos de entrega](revisao-integracao-corpos-entregas.md) foram consolidados para revisão, sem esperar os dados faltantes. Criação das issues, implementação, migração e homologação são etapas posteriores; decisões e importadores cadastrais não comprovam carga completa ou implementação das ampliações.

### Benefício particular e conclusão acadêmica

| Situação | Benefício do plano | Aula original |
|---|---|---|
| Agendamento autorizado | Reserva disponibilidade | Continua sem reposição concluída |
| Realização com presença e documentação exigida | Consome a reserva | Pode ser marcada como reposta, com data |
| Cancelamento do aluno dentro do prazo | Devolve a reserva | Continua sem reposição concluída |
| Cancelamento tardio ou falta do aluno | Consome a reserva | Continua sem reposição concluída |
| Cancelamento pela escola | Devolve a reserva | Continua sem reposição concluída |
| Remarcação do mesmo pedido | Reserva ainda não consumida muda para a cota da nova data se houver saldo; falha preserva a anterior, sem consumo duplicado | Depende da realização posterior |
| Fim do período | Saldo livre expira sem acumulação; reservas e histórico são preservados | Não altera registros acadêmicos |

### Acerto de encerramento

1. Financeiro prepara proposta com data efetiva, período coberto, proporcional por dias reais, eventual multa contratual, recebimentos e saldo/crédito.
2. Multa fixa registra valor e condições; multa percentual registra percentual, base e condições. Identificar a cláusula do contrato aplicável. Dispensa/alteração inclui justificativa na proposta.
3. Outra pessoa do Financeiro com permissão de aprovação ou da Administração confere e decide; autor da proposta não aprova o próprio acerto.
4. A efetivação exige decisão válida para a versão examinada e revalidação dos dados. Mudança relevante exige revisão e nova aprovação.
5. O histórico conserva proposta, justificativas, cálculo, decisão e recebimentos. Conforme Q29, crédito fica disponível para uso futuro; solicitação do aluno inicia processamento e registro da devolução pelo Financeiro.

## 8. Detalhes restantes por entrega

### Prioridade após a análise da primeira planilha — 10/09/2026

O usuário orientou discutir primeiro os pontos de funcionamento encontrados e retomar depois o levantamento dos dados faltantes. A coleta dos complementos não bloqueia o refinamento das regras. Antes de habilitar uma operação em produção, seus cadastros, condições e saldos necessários devem estar conferidos. A orientação não dispensa a conciliação da migração nem autoriza presumir informações ausentes. Permanece a sequência de fechar escopo/corpos de issues antes da implementação desta ampliação.

Os cinco pontos novos desta análise são: formas de cobrança das particulares, antecipações, empresa pagadora, permuta e vencimentos. Q86–Q90 foram respondidas. Permanecem os detalhes derivados dos modelos escolhidos, sem declarar o refinamento integral concluído. Dados cadastrais incompletos e divergências de histórico permanecem no relatório da fonte para levantamento posterior, sem criar uma decisão de negócio para cada célula vazia.

### Bloco de modelos comerciais encontrados na planilha — Q86–Q88 respondidas

Enviado e respondido em 10/09/2026: Q86 = C, Q87 = C e Q88 = A. Alternativas não escolhidas permanecem como histórico. As decisões ampliam/delimitam o escopo, mas não comprovam implementação.

#### Q86 — Quais formas de cobrança das aulas particulares o ERP deve atender?

A fonte tem 15 cadastros Por hora, além de particulares com cobrança mensal. A decisão trata de particulares contratadas pelo aluno, separadas da cota de reposições. Mensalidade fixa conserva o preço contratado do período; preço por hora depende da quantidade cobrada. Antecipação segue Q87. Critérios de cobrança por falta/cancelamento exigem detalhamento próprio, sem copiar automaticamente a regra da cota de reposição.

| Opção | Alcance proposto |
|---|---|
| C — Recomendada | Permitir mensalidade fixa e cobrança por hora, conforme contrato, com regras e saldos separados; amplia a implementação |
| A | Trabalhar com mensalidade fixa nas particulares; casos atuais por hora precisam de encaminhamento antes de operar no novo fluxo |
| B | Trabalhar com preço por hora nas particulares; casos atuais com mensalidade fixa precisam de encaminhamento antes de operar no novo fluxo |

**Situação: respondida — opção C, em 10/09/2026.** Permitir os dois modelos conforme o contrato, com regras/saldos separados. Não alterar contratos antigos nem converter preços por hora em mensalidade por presunção. A implementação da ampliação permanece pendente e exige detalhar apuração de horas, vigência do preço e tratamento de faltas/cancelamentos.

#### Q87 — Como registrar um pagamento feito antecipadamente?

A fonte menciona curso/ano pago e particulares antecipadas. Um recebimento conserva sua data/valor originais; quitar meses não cria novos recebimentos. Distinguir pagamento destinado a períodos/serviços identificados de crédito para destinação futura. Antecipação depende da oferta contratada e não cria pacote de horas por conta própria. Crédito sem destinação mantém a concordância e aprovação de utilização de Q68.

| Opção | Alcance proposto |
|---|---|
| C — Recomendada | Permitir quitar períodos/serviços identificados ou registrar crédito ainda sem destinação, conforme acordo documentado |
| A | Exigir destinação definida na antecipação; valor ainda não identificado fica em conferência |
| B | Registrar primeiro como crédito e depois destinar a períodos/serviços com concordância e aprovação de Q68; acrescenta uma etapa operacional |

**Situação: respondida — opção C, em 10/09/2026.** Permitir as duas destinações conforme acordo, preservando recebimento e saldo sem duplicação. Crédito sem destinação segue Q68 para utilização. A decisão não revoga os créditos de encerramento já aprovados em Q29.

#### Q88 — Qual alcance precisamos para uma empresa que paga pelos alunos?

A fonte registra ano pago pelo empregador. Distinguir empresa que paga contratos individuais de contrato coletivo vendido à empresa. Ser pagadora não concede acesso automático a presença, avaliações, gravações ou conversas dos alunos. Contrato coletivo amplia a frente F20 e exige detalhar cobrança, vínculos e permissões.

| Opção | Alcance proposto |
|---|---|
| A — Recomendada | Empresa como responsável financeiro de contratos individuais; pagamentos vinculados aos alunos, sem portal empresarial nesta entrega |
| B | Incluir contrato coletivo, vários alunos e cobrança consolidada já nesta entrega; detalhar ampliação corporativa |
| C | Suportar contratos individuais pagos por empresa e contratos coletivos; detalhar ambos antes da implementação |

**Situação: respondida — opção A, em 10/09/2026.** Incluir vínculo da empresa pagadora com contratos individuais e alocação dos pagamentos. Contrato coletivo, cobrança consolidada e portal empresarial não foram incluídos nesta entrega; a condição de pagadora não amplia automaticamente a visibilidade dos dados do aluno.

### Bloco de permuta e vencimentos — Q89/Q90 respondidas

Enviado e respondido em 10/09/2026, ambas com a opção A. As alternativas não escolhidas permanecem como histórico. A coleta dos complementos da planilha permanece para depois.

#### Q89 — Como validar a permuta de mensalidade por aulas prestadas à escola?

A fonte descreve um aluno que oferece aulas de espanhol à equipe em contrapartida à mensalidade. Registrar acordo, vigência, contrapartida e cobranças que ele pode compensar; uma compensação por serviço não é dinheiro recebido. Todas as opções exigem acordo e aprovação por outra pessoa autorizada. Quantidade, valor e tratamento de descumprimento dependem das condições documentadas, sem presunção.

| Opção | Alcance proposto |
|---|---|
| A — Recomendada | Conferência por período: Pedagógico confirma o serviço; Financeiro propõe compensação; outro Financeiro com permissão de aprovação/Administração aprova antes de aplicar |
| B | Liberação pela vigência: acordo aprovado autoriza compensações periódicas; gestão acompanha cumprimento e propõe revisão por descumprimento |
| C | Proposta manual por ocorrência: equipe registra acordo, evidências e cobranças; Financeiro prepara e outra pessoa autorizada aprova, sem rotina periódica própria na primeira entrega |

**Situação: respondida — opção A, em 10/09/2026.** Conferência por período pelo Pedagógico, proposta do Financeiro e aprovação de outro Financeiro autorizado/Administração antes da compensação. Não criar recebimento fictício nem classificar automaticamente permuta como bolsa ou isenção.

#### Q90 — Como tratar um vencimento no dia 29, 30 ou 31 quando o mês não tiver esse dia?

Proposta comum às alternativas: permitir contratar qualquer dia de 1 a 31, preservando a referência do contrato. A regra para mês sem esse dia calcula somente a data daquela cobrança; manter a referência nos meses seguintes. Não mudar cobertura, cobranças anteriores ou usar o calendário de aulas como calendário financeiro. Eventuais ajustes por fim de semana/feriado financeiro serão tratados separadamente.

| Opção | Alcance proposto |
|---|---|
| A — Recomendada | Último dia do próprio mês quando o dia contratado não existir; conservar referência nos meses seguintes |
| B | Primeiro dia do mês seguinte quando o dia contratado não existir; conservar referência e identificar cobrança de origem |
| C | Regra por contrato entre as duas formas; exigir a opção aplicável antes de gerar cobranças |

**Situação: respondida — opção A, em 10/09/2026.** Permitir os dias de 1 a 31; se não existir no mês, usar o último dia e preservar a referência contratual. Exemplo de conferência: referência 31 gera 28/29 em fevereiro, 30 em abril e volta a 31 em maio; a redução de um mês não redefine o dia contratual. Não deslocar vencimentos existentes para caber nas opções do schema atual.

**Encaminhamento dos detalhes de Q86–Q90:** duração/unidade, faltas/cancelamentos, fechamento mensal, pausa/encerramento de horas antecipadas, permuta parcial e dias não úteis foram decididos em Q91–Q99 abaixo. Na especificação, preservar vigência/preço conforme contrato e distinguir particular contratada, cota de reposição e mensalidade fixa. Não reprecificar serviços quitados ou copiar regras de um modelo para outro por presunção. Revisão dos corpos e integração ainda necessária; o encerramento desses blocos de perguntas não comprova implementação nem ausência de novos cenários na revisão.

### Bloco de apuração das particulares por hora — Q91–Q93 respondidas

Enviado e respondido em 10/09/2026, todas com a opção A, após o usuário reafirmar que deseja continuar o refinamento e deixar a complementação dos dados para depois. As três decisões tratam das particulares por hora de Q86. Mensalidade fixa, benefício de reposições e antecipações de Q87 conservam seus próprios controles. Alternativas não escolhidas permanecem como histórico.

#### Q91 — Qual duração determina o valor de uma particular cobrada por hora?

Exemplo: encontro previsto para 60 minutos com duração registrada diferente. Guardar duração prevista e registrada. O professor informa aula/ocorrências sem ampliar seu acesso financeiro. Tempo adicional não aumenta a cobrança sem autorização conforme o contrato; redução de serviço pela escola exige tratamento explícito. O exemplo não define unidade comercial de hora-aula ou regra de arredondamento, que precisarão constar no detalhamento aplicável.

| Opção | Alcance proposto |
|---|---|
| A — Recomendada | Duração contratada por encontro: tempo previamente combinado; diferenças que afetem cobrança exigem ajuste justificado e aprovado |
| B | Duração efetivamente realizada e conferida: apurar o registro, respeitando limites contratados e autorização de acréscimos |
| C | Base configurada no contrato entre duração contratada ou efetiva; exigir a regra antes de apurar |

**Situação: respondida — opção A, em 10/09/2026.** Usar duração contratada por encontro; diferença financeira exige ajuste justificado e aprovado. Não alterar automaticamente o preço com base apenas no horário registrado pelo professor.

#### Q92 — Como cobrar falta ou cancelamento do aluno em uma particular por hora?

Aplica-se à particular contratada e paga; não usa cota de reposições nem altera mensalidade fixa. Cancelamento pela escola é situação distinta. Eventual cobrança sem realização deve identificar o motivo financeiro sem criar presença ou aula ministrada. Se o serviço já estiver pago, impedir cobrança duplicada. Prazo e eventual percentual dependem da configuração/contrato; nenhum número foi presumido.

| Opção | Alcance proposto |
|---|---|
| A — Recomendada | Prazo configurável: cancelamento dentro do prazo não é cobrado; cancelamento tardio ou falta cobra o valor integral do encontro |
| B | Cobrar somente aulas realizadas; falta/cancelamento do aluno não gera cobrança pela aula não realizada |
| C | Regra por contrato: prazo e cobrança zero, parcial ou integral para cancelamento tardio e falta; amplia configurações/validações |

**Situação: respondida — opção A, em 10/09/2026.** Prazo configurável sem número presumido; dentro do prazo não cobrar, tardio/falta cobrar integral. Identificar o motivo sem criar presença, aula ministrada ou cobrança duplicada de antecipação. Não reutilizar o consumo do benefício de reposições como lançamento financeiro.

#### Q93 — Quando emitir a cobrança das particulares por hora que serão pagas depois da apuração?

A cobrança deve discriminar encontros/ocorrências conferidos, quantidades, valor e vencimento. Esta decisão trata de pagamento posterior à apuração. Antecipações seguem Q87: preservar recebimento e destinação, sem cobrar novamente o que já estiver quitado. Reexecução do fechamento não pode incluir a mesma ocorrência duas vezes.

| Opção | Alcance proposto |
|---|---|
| A — Recomendada | Fechamento mensal: uma cobrança detalhada por contrato reunindo ocorrências conferidas do período, com vencimento definido |
| B | Cobrança por encontro: cada aula/ocorrência cobrável conferida gera sua própria cobrança e vencimento |
| C | Frequência por contrato: fechamento mensal ou cobrança por encontro, com regra registrada antes da emissão |

**Situação: respondida — opção A, em 10/09/2026.** Fechamento mensal por contrato com ocorrências conferidas, cobrança discriminada e vencimento definido. Não aplicar automaticamente a geração de mensalidades integrais de Q64 a uma apuração variável de horas.

### Bloco de unidade, cancelamento pela escola e pausa — Q94–Q96 respondidas

Enviado e respondido em 10/09/2026, todas com a opção A. Alternativas não escolhidas permanecem como histórico. As decisões mantêm Q91–Q93; conferir condições das fontes antigas sem preenchimento por suposição.

#### Q94 — O preço por hora corresponde a qual unidade de tempo?

Usar a duração contratada de Q91 e explicitar a unidade no contrato/tela. Um encontro de 75 minutos representa 1,25 hora de 60 minutos, mas teria outra quantidade em uma unidade comercial de 50 minutos; valores ilustrativos. Arredondamento monetário não pode alterar silenciosamente a duração.

| Opção | Alcance proposto |
|---|---|
| A — Recomendada | Hora de 60 minutos, aceitando frações: minutos contratados divididos por 60, sem arredondar tempo para cima |
| B | Blocos inteiros de 60 minutos; cobrar integralmente cada bloco iniciado, com condição explícita no contrato |
| C | Unidade comercial configurável no contrato, em minutos, com cálculo das frações e configuração exigida antes de cobrar |

**Situação: respondida — opção A, em 10/09/2026.** Hora de 60 minutos, com frações calculadas pelos minutos contratados. Não arredondar o tempo para cima; preservar a duração exata e calcular valores monetários separadamente.

#### Q95 — Se a escola cancelar uma particular por hora, como tratar a aula e o valor antecipado?

Distinguir do cancelamento/falta do aluno de Q92. Nas três alternativas, não cobrar o encontro cancelado pela escola nem consumir horas como realizadas. Preservar cancelamento e recebimento original. Remarcação exige disponibilidade/aprovação de agenda; ajuste financeiro é preparado pelo Financeiro e aprovado por outra pessoa autorizada. Crédito não comprova devolução; uso/devolução seguem Q68/Q69.

| Opção | Alcance proposto |
|---|---|
| A — Recomendada | Aluno escolhe remarcação ou crédito do valor já pago; registrar escolha e ajuste sem duplicação |
| B | Priorizar remarcação e manter antecipação vinculada; conversão em crédito por solicitação e ajuste aprovado |
| C | Cancelar cobrança e apurar crédito do pagamento existente; novo encontro tem cobrança própria e pode usar crédito autorizado |

**Situação: respondida — opção A, em 10/09/2026.** Aluno escolhe remarcação ou crédito do valor já pago; registrar escolha, ajuste aprovado e vínculos com encontro/recebimento. Sem cobrança/consumo pela aula cancelada. Não presumir escolha do aluno nem marcar devolução como executada.

#### Q96 — Durante uma pausa aprovada, como fica a validade de horas particulares pagas antecipadamente e ainda não utilizadas?

Preservar recebimentos, utilização e saldo. Suspender novos agendamentos na pausa. Sem validade contratada, não criar vencimento; havendo validade, definir se a contagem para. A retomada mantém proposta/aprovação já previstas, sem repor consumo ou conceder novo saldo. Aplica-se a horas antecipadas; mensalidade fixa conserva Q65/Q66.

| Opção | Alcance proposto |
|---|---|
| A — Recomendada | Suspender contagem durante a pausa; conservar saldo e retomar somente com o tempo de validade que restava |
| B | Manter validade contratada; extensão depende de proposta justificada e aprovada conforme contrato |
| C | Registrar no contrato se suspende a contagem ou mantém validade; regra obrigatória antes de aprovar pausa |

**Situação: respondida — opção A, em 10/09/2026.** Suspender a validade durante a pausa e retomar com o tempo restante, preservando saldo e consumo. Não criar validade onde ela não existir no contrato, presumir prazo numérico ou repor saldo utilizado.

### Bloco de encerramento, permuta parcial e dias não úteis — Q97–Q99 respondidas

Enviado e respondido em 10/09/2026: Q97 = A, Q98 = A e Q99 = C. Alternativas não escolhidas permanecem como histórico. Preservar contratos e origens dos valores; escolhas não executam ajustes financeiros.

#### Q97 — No encerramento, como tratar horas particulares pagas antecipadamente e ainda não utilizadas?

Preservar recebimentos e horas utilizadas ou legitimamente cobradas por Q92. Financeiro prepara acerto e outra pessoa autorizada aprova. Calcular conforme compra original, descontos aplicáveis e eventual multa contratual separada, sem reprecificar horas antigas pela tabela atual. Crédito apurado não é devolução executada; uso/devolução conservam Q68/Q69.

| Opção | Alcance proposto |
|---|---|
| A — Recomendada | Converter saldo não utilizado em crédito no acerto, com memória de cálculo e aprovação; novas aulas exigem contratação ativa |
| B | Preservar uso das horas pagas conforme contrato, com autorização específica de agendamento/acesso após encerramento; amplia o fluxo |
| C | Registrar escolha entre crédito e utilização das horas quando ambas forem permitidas pelo contrato; inclui os dois fluxos |

**Situação: respondida — opção A, em 10/09/2026.** Converter saldo não utilizado em crédito no acerto aprovado, pela compra original, preservando consumo legítimo e cálculo. Novas aulas exigem contratação ativa; não confundir crédito apurado com devolução executada.

#### Q98 — Se a contrapartida da permuta for cumprida apenas em parte, o que o Financeiro pode compensar?

Q89 mantém confirmação pedagógica, proposta financeira e aprovação independente. Registrar realizado e restante, com quantidade, valor e fórmula do acordo. Sem regra suficiente, manter ajuste em conferência. Não inventar pagamento, perdoar saldo ou criar multa automaticamente.

| Opção | Alcance proposto |
|---|---|
| A — Recomendada | Compensar apenas a parte comprovada conforme fórmula do acordo; restante permanece devido nas condições aplicáveis |
| B | Compensar somente depois de cumprir toda a contrapartida exigida no período; sem compensações parciais |
| C | Permitir compensação parcial ou novo prazo para completar a contrapartida conforme acordo/proposta aprovada; registrar saldo e datas |

**Situação: respondida — opção A, em 10/09/2026.** Compensar somente a parte comprovada conforme acordo; saldo restante conserva as condições aplicáveis. Valores/fórmula não foram presumidos e permanecem sujeitos à conferência quando incompletos.

#### Q99 — Para novos contratos, qual regra oferecer quando o vencimento cair em fim de semana ou feriado financeiro?

Após calcular a data mensal de Q90, definir eventual ajuste por dia não útil. Preservar contratos existentes e dia de referência; guardar data calculada/ajustada, histórico e regra, sem mudar cobertura. Prorrogação depende dos dias úteis/feriados financeiros da referência aplicável ao contrato. O calendário letivo continua único; recesso escolar não se torna feriado financeiro. A configuração não presume uma regra financeira universal entre países.

| Opção | Alcance proposto |
|---|---|
| C — Recomendada | Regra explícita no contrato: manter data ou prorrogar ao próximo dia útil financeiro, exigindo referência aplicável configurada |
| A | Oferecer prorrogação ao próximo dia útil como padrão dos novos contratos, com calendário financeiro aplicável configurado |
| B | Oferecer manutenção da data como padrão dos novos contratos, sem deslocamento automático por fim de semana/feriado |

**Situação: respondida — opção C, em 10/09/2026.** Registrar por contrato se mantém a data ou prorroga ao próximo dia útil, exigindo referência aplicável configurada. Preservar o cálculo base de Q90, dia contratual, cobertura e histórico; não ajustar cobranças existentes nem escolher calendário financeiro por presunção.

### Bloco de ativação e fechamento incompleto — Q100/Q101 respondidas

Enviado e respondido em 10/09/2026, ambas com opção C, durante a revisão do código e da integração das entregas. Alternativas não escolhidas ficam como histórico.

#### Q100 — Como ativar uma matrícula de particulares cobradas por hora?

A ativação atual procura taxa e primeira mensalidade e recusa quando qualquer uma falta. A oferta por hora não deve criar mensalidade fictícia para passar nessa validação. Manter aceite do contrato confirmado pela Secretaria e regularização da taxa nas condições aprovadas; informe a conferir não comprova recebimento. O comportamento das ofertas mensais continua sujeito à configuração já aprovada.

| Opção | Alcance |
|---|---|
| A | Respeitar forma contratada: pós-pago ativa sem antecipar aulas; pré-pago exige antecipação inicial contratada |
| B | Exigir sempre primeira aula antecipada; encontros seguintes podem ser pagos após fechamento |
| C — Escolhida | Configuração própria da oferta por hora: exigir ou dispensar adiantamento inicial, com valor/horas explícitos no contrato |

**Situação: respondida — opção C, em 10/09/2026.** Não presumir valor ou quantidade inicial; configuração exigida precisa estar completa e o recebimento confirmado quando aplicável.

#### Q101 — Como fechar o mês de particulares por hora quando houver encontros sem conferência da ocorrência cobrável?

A pendência trata da classificação financeira da ocorrência como realizada, falta ou cancelamento, sem presumir realização. Gravação/material pendente tem acompanhamento próprio. Outros contratos conferidos podem fechar. Emissão parcial precisa discriminar origem e o que falta; complemento não inclui novamente uma ocorrência já cobrada.

| Opção | Alcance |
|---|---|
| A | Aguardar conferência completa do contrato/período antes da emissão |
| B | Emitir o conferido e cobrar o restante em complemento vinculado após conferência |
| C — Escolhida | Financeiro propõe aguardar ou emitir parcialmente; outra pessoa autorizada aprova a escolha e seus efeitos antes da emissão parcial |

**Situação: respondida — opção C, em 10/09/2026.** Revalidar ocorrências/valores/saldo ao aplicar; parcial e complementares ficam vinculadas ao fechamento mensal de Q93, sem duplicação ou aprovação pelo próprio proponente.

#### Q102 — Se o aluno tiver contratos distintos, a pausa ou o encerramento deve afetar qual deles?

Enviada em 10/09/2026 após confirmar que pausarAluno/encerrarAluno atuais alcançam o aluno inteiro e suas matrículas. Exemplo: curso regular e particular por hora em contratos distintos. Cada contrato afetado mantém suas regras, saldos, acesso e aprovações; histórico continua no alcance aprovado. Não autoriza apagar cadastro ou cancelar dívida.

| Opção | Alcance proposto |
|---|---|
| A — Recomendada | Somente matrícula/contrato escolhido; demais ativos, com estado geral sem bloquear o vínculo restante |
| B | Todos os contratos, com proposta do conjunto e acertos/aprovações necessários antes de efetivar |
| C | Escolher um ou vários contratos na solicitação; conferir/aprovar conjunto e preservar os excluídos |

**Situação: respondida — opção C, em 10/09/2026.** Solicitação seleciona um ou vários contratos, apresenta os impactos e aplica o conjunto após aprovações necessárias, preservando os excluídos. Incorporar aos estados, vínculos, cobertura, saldo de horas, acesso e agenda; alteração de seleção ou impacto exige revisão. Não encerrar alocações de outros contratos nem bloquear seu acesso por um estado global inadequado.

### Consolidação dos critérios de conferência — Q86–Q102

Critérios derivados das respostas para orientar os corpos da entrega e a revisão antes da implementação. São cenários a verificar no código futuro, não testes executados ou prova de funcionamento atual.

| Cenário | Resultado a conferir |
|---|---|
| Particular mensal e particular por hora | O contrato identifica o modelo. A apuração variável não altera a regra de mensalidade integral; particulares contratadas não usam a cota do benefício de reposições |
| Encontro contratado de 75 minutos | Quantidade de 1,25 hora com duração de 60 minutos por hora; não arredondar tempo para cima. Duração registrada diferente mantém evidência e exige ajuste aprovado para mudar cobrança |
| Cancelamento pelo aluno no prazo, tardio ou falta | Prazo configurado é conferido; no prazo não cobrar, tardio/falta cobrar integral com ocorrência identificada. Nenhum caso cria presença ou aula ministrada por efeito financeiro |
| Fechamento mensal repetido | Cada ocorrência conferida aparece uma única vez na cobrança do contrato/período. Quantidades, preços aplicáveis e vencimento são rastreáveis; o que já foi antecipado não reaparece como dívida não paga |
| Cancelamento pela escola com recebimento prévio | Preservar original e escolha do aluno. Remarcação aprovada reaproveita a destinação sem cobrar em duplicidade; crédito exige ajuste financeiro aprovado. Não tratar crédito como devolução executada |
| Pausa e retomada de saldo antecipado | Preservar saldo/utilizações e suspender novos agendamentos. Havendo validade, pausa preserva tempo restante; retomada aprovada não reinicia prazo integral nem repõe consumo. Sem validade contratada, não criar expiração |
| Encerramento com horas antecipadas restantes | Acerto calcula saldo não utilizado pelas condições da compra original, com descontos e multa aplicáveis separados. Aprovação independente gera crédito rastreável; não continuar novas aulas sem contratação ativa |
| Empresa pagadora | Pagamento se vincula ao contrato individual e às cobranças corretas. A condição de pagadora não expõe avaliações, gravações ou conversas; conferir titular/destino financeiro conforme origem e acordo nos ajustes/devoluções |
| Permuta parcialmente cumprida | Pedagógico confirma evidência; Financeiro calcula só a parte comprovada pela fórmula do acordo; outra pessoa aprova. Registrar compensação, sem entrada de caixa fictícia; restante conserva condições aplicáveis |
| Referência de vencimento 31 | Mês curto usa último dia, depois a regra contratual de dia não útil se aplicável. Manter referência 31 para os próximos meses; mostrar datas base/ajustada e referência financeira, sem usar recesso escolar ou mudar cobertura |
| Ativação de oferta por hora | Sem criar mensalidade fictícia, conferir contrato, taxa e configuração inicial. Adiantamento exigido sem pagamento confirmado bloqueia; dispensado não impõe pagamento de aula futura. Registrar valor/horas e preservar fluxo mensal existente |
| Fechamento com encontros não conferidos | Mostrar pendências; Financeiro propõe tratamento. Emissão parcial exige aprovação independente da versão examinada; complementos ligam-se ao mesmo fechamento e cobram só ocorrências ainda não incluídas. Falha/reexecução não duplica |
| Pausa/encerramento com contratos distintos | Mostrar seleção e impactos de cada contrato e aprovar o conjunto antes de aplicar. Excluídos conservam vínculo/acesso/cobrança; acesso geral não libera material restrito de outro contrato. Mudança de seleção/impacto exige revisão |

Na revisão técnica, definir precisão/arredondamento monetário, versões de contrato/preço, permissões por ação/registro/campo/condição e prevenção de concorrência/duplicação. Ausência de unidade, prazo, valor, vigência ou referência exigida deve ser identificada como configuração pendente, sem número presumido. Esses requisitos de implementação não solicitam agora os dados pessoais/históricos que o usuário adiou.

### Bloco de conteúdo das planilhas reais — Q85 com primeira fonte analisada

Enviada em 09/09/2026 após Q84. Usuário respondeu que pode fornecer os dados necessários e solicitou a lista. Foi preparado o [checklist completo](checklist-dados-migracao.md). Em 10/09/2026, a planilha fornecida pelo usuário foi analisada e recebeu um [relatório de cobertura e complementos](analise-planilha-operacional-leticia.md). As alternativas abaixo ficam como referência, sem escolha presumida.

#### Q85 — Quais tipos de informação real vocês já têm nas planilhas para migrar?

Identificar cadastros de alunos/responsáveis, matrículas/contratos, turmas/professores, aulas/presenças, cobranças/pagamentos, créditos ou leads comerciais. Nesta etapa basta descrever grupos/cabeçalhos; não é necessário transcrever dados pessoais ou valores individuais. As planilhas ainda não tinham sido inspecionadas quando esta pergunta foi enviada; a análise recebida depois está registrada na situação abaixo.

| Opção | Conteúdo disponível a confirmar |
|---|---|
| A | Principalmente cadastros de alunos/responsáveis e contatos, sem histórico acadêmico/financeiro estruturado |
| B | Cadastros e dados acadêmicos, como matrículas, turmas, professores e/ou aulas/presenças, sem financeiro estruturado |
| C | Há também dados financeiros, como cobranças, pagamentos, parcelas em aberto e/ou créditos, além dos demais grupos informados |

**Situação: primeira fonte analisada em 10/09/2026; complementos pendentes.** O usuário não selecionou A/B/C: pediu a lista e depois forneceu a planilha operacional. A análise identifica os conjuntos presentes, as divergências e o que solicitar ao time. Aproveitar as fontes existentes e concluir o mapeamento antes de dimensionar a carga; não presumir histórico completo a partir desse arquivo.

### Bloco de situação dos dados existentes — Q84 respondida

Enviada e respondida em 09/09/2026 por texto livre: há planilhas com alguns dados reais, e o objetivo é iniciar produção com o máximo de dados reais migrados. As alternativas abaixo ficam como histórico; não houve escolha entre A/B/C ou classificação conclusiva da base atual do ERP.

#### Q84 — O ERP já contém dados reais da escola ou ainda trabalha somente com dados de teste?

Distinguir testes, piloto e operação para tratar turmas sem agenda gerada, cobranças sem cobertura explícita e contratos sem todas as regras estruturadas. Havendo ambientes separados, identificar quais contêm registros reais. Arquivos de implantação e testes locais não comprovam uso operacional.

| Opção | Situação atual a confirmar |
|---|---|
| A | Somente desenvolvimento/testes, com cadastros fictícios que não sustentam a operação real |
| B | Piloto com dados reais de alguns alunos, turmas ou pagamentos, com uso limitado |
| C | Uso operacional diário pela equipe com dados reais da escola |

**Situação: respondida — informação operacional por texto livre, em 09/09/2026.** Planilhas reais serão fonte da migração para início de produção. Primeira fonte inventariada em 10/09/2026, com complementos pendentes (Q85). Preservar informações, conferir lacunas e duplicidades e validar a carga; não presumir registros descartáveis nem autorizar exclusão/alteração de produção.

### Bloco de encerramento com compensação de cobertura pendente — Q83 respondida

Enviada e respondida em 09/09/2026, opção A: acerto financeiro no encerramento para a compensação de cobertura ainda devida. Q70 permanece para quem continua; não são faltas do aluno, reposições individuais ou feriados/recessos. Alternativas B/C ficam como histórico.

#### Q83 — Se o aluno encerrar a matrícula antes de usar todos os dias que a escola deve compensar, como acertar o restante?

Q70 recompõe após o retorno os dias sem oferta em parte do período. Exemplo: período já pago deixou três dias de cobertura a compensar; aluno recebeu um e encerra com dois pendentes. Falta definir o destino dessa compensação no encerramento.

Recomenda-se incluir o valor dos dias ainda devidos no acerto financeiro. Em qualquer alternativa, Financeiro prepara e outra pessoa autorizada aprova, identificando período de origem, pagamentos e compensações realizadas. O mesmo dia não gera duas compensações ou ajuste em duplicidade com o proporcional de encerramento. Crédito não comprova devolução; uso/devolução seguem Q29/Q68/Q69. Não inventar recebimento para apurar crédito.

| Opção | Tratamento proposto |
|---|---|
| A — Recomendada | Acertar financeiramente no encerramento: ajustar saldo pelos dias de compensação ainda devidos; valores já pagos podem gerar crédito, com cálculo e aprovação no acerto |
| B | Aluno escolhe entre crédito e cobertura futura permitidos pelo contrato; registrar escolha e submeter à aprovação. Sem escolha, manter o item pendente |
| C | Tratamento definido na cláusula contratual específica; se insuficiente, exigir conferência antes da aprovação |

**Situação: respondida — opção A, em 09/09/2026.** Ajustar financeiramente no acerto os dias de compensação ainda devidos, com possível crédito de valores já pagos, cálculo e aprovação independente. Preservar origem/histórico e impedir duplicação; não tratar o crédito como devolução executada.

Referência de modelagem: a [documentação de ajustes da Stripe](https://docs.stripe.com/invoicing/dashboard/credit-notes) distingue redução de valor devido, crédito e devolução, preservando vínculo com a cobrança original. Isso sustenta o registro rastreável; não define a regra contratual da escola, não inclui integração com Stripe e não escolhe a alternativa de Q83.

### Bloco de download de gravações — Q82 respondida

Enviada e respondida em 09/09/2026, opção A: somente assistir no ERP, sem recurso de download ou acesso offline. Reprodução sem conta Google de Q81 permanece. B/C ficam como histórico e não autorizam download ou exceção.

#### Q82 — O aluno poderá baixar a gravação para assistir fora do ERP?

Recomendação: começar somente com reprodução no ERP. Se houver download, a cópia já salva continuará disponível mesmo depois do fim da autorização no sistema. Em qualquer opção, acessar apenas materiais autorizados; assistir/baixar não conclui reposição, que continua exigindo resumo, atividade e avaliação docente.

| Opção | Funcionalidade oferecida |
|---|---|
| A — Recomendada | Somente assistir no ERP; sem recurso de download ou acesso offline |
| B | Permitir download dos vídeos autorizados enquanto a autorização estiver válida; registrar o download |
| C | Download somente por exceção: pedido identifica aluno/gravação; outra pessoa da Gestão Pedagógica/Administração aprova com motivo e prazo para baixar |

**Situação: respondida — opção A, em 09/09/2026.** Somente assistir no ERP, sem recurso de download ou acesso offline. Isso define a funcionalidade oferecida, sem prometer impedir captura/cópia por outros meios; a leitura técnica de trechos do Drive pelo servidor para reprodução continua em Q81.

### Bloco de identidade para assistir às gravações — Q81 respondida

Enviada e respondida em 09/09/2026, opção C: reprodução pelo ERP e controle de acesso no servidor, sem conta Google do aluno. Q72 mantém e-mail e senha para o portal. A/B permanecem apenas como histórico; a recomendação inicial não foi escolhida. F07.7 foi ampliada e segue pendente de implementação/validação.

#### Q81 — Como o aluno deve se identificar para assistir às gravações protegidas do Drive?

Contexto apresentado na pergunta: login no ERP não autentica no Google Drive. A/B dependiam de identidade Google do aluno; C, escolhida, usa a identidade institucional da integração no servidor e a autorização do ERP. Nenhuma senha Google é solicitada ao aluno.

| Opção | Comportamento e impacto |
|---|---|
| A — Recomendada | Mesmo e-mail no ERP e na conta Google; aluno abre o vídeo com essa conta. Falta de configuração mantém o acesso ao material pendente até regularizar |
| B | Permitir outro e-mail Google do próprio aluno; verificar e vincular a segunda identidade antes da liberação. Trocas exigem conferência e retirada do acesso anterior |
| C | Assistir pelo próprio ERP sem exigir conta Google do aluno; ampliar a entrega com reprodução e controle de acesso pelo servidor. Drive permanece como fonte oficial; validar desempenho, permissões e custos antes de operar |

Nas opções A/B, autorizar apenas arquivos necessários, sem incluir o aluno como membro de todo o Drive compartilhado. A opção C amplia a entrega atual por link e exige especificação própria; não basta incorporar um link restrito em um player. Nenhuma opção muda a senha do ERP para a senha Google, concede papel interno ou libera uma restrição vigente por si só.

**Situação: respondida — opção C, em 09/09/2026.** Assistir no ERP sem conta Google, com reprodução e controle pelo servidor. Drive permanece como fonte oficial; validar desempenho, permissões e custos antes de operar.

O Google permite [criar uma conta usando e-mail existente de outro provedor](https://support.google.com/accounts/answer/27441) e documenta [permissões dos arquivos](https://developers.google.com/workspace/drive/api/guides/manage-sharing). A [API permite obter conteúdo de arquivos, incluindo vídeos, conforme capacidades/permissões](https://developers.google.com/workspace/drive/api/guides/manage-downloads); a viabilidade operacional da alternativa C depende de avaliação da arquitetura e capacidade do projeto. O [compartilhamento com visitantes](https://support.google.com/drive/answer/9195194) lista tipos de arquivo específicos e não comprova reprodução das gravações de vídeo deste fluxo; não tratar PIN de visitante como solução validada para elas.

### Bloco de estrutura do Drive e domínio de envio — Q79–Q80 respondidas

Enviadas e respondidas em 09/09/2026. Q79: opção A, Drive compartilhado do Workspace da escola. Q80: resposta livre confirmando domínio próprio e informando https://www.geniusidiomas.com/; não confirmou quem administra/acessa o DNS nem escolheu remetente. As alternativas abaixo ficam como histórico. Preparação técnica e verificação real continuam pendentes.

#### Q79 — Em qual estrutura do Google Drive ficam as gravações que serão publicadas ao aluno?

Identificar quem controla os arquivos para definir concessão/revogação de acesso e continuidade quando um professor sai. Um Drive compartilhado do Google Workspace é diferente de uma pasta compartilhada dentro do Meu Drive. A resposta não inclui migração de arquivos nem contratação de serviço; estrutura mista ou desconhecida pode ser descrita.

| Opção | Estrutura atual a confirmar |
|---|---|
| A | Drive compartilhado do Google Workspace da escola; arquivos na estrutura da organização |
| B | Meu Drive de uma conta Google central da escola; essa conta concentra os arquivos |
| C | Contas de professores/equipe ou estrutura mista; arquivos distribuídos entre contas |

**Situação: respondida — opção A, em 09/09/2026.** Drive compartilhado do Google Workspace da escola; arquivos na estrutura da organização. Ainda é necessário identificar o Drive/conta de integração e validar as permissões reais.

O [Google diferencia a propriedade e o acesso em Drives compartilhados](https://developers.google.com/workspace/drive/api/guides/about-shareddrives). A configuração real e as permissões herdadas precisam ser conferidas antes de definir o controle de publicação.

#### Q80 — A escola já possui um domínio próprio que poderá verificar para enviar e-mails pelo Resend?

Identificar domínio disponível e quem controla seus registros DNS. Se já definidos, registrar também domínio e remetente desejado, sem senhas ou credenciais. Endereço pessoal em domínio de terceiros não substitui a configuração de um domínio controlado pela escola.

| Opção | Disponibilidade atual a confirmar |
|---|---|
| A | Domínio próprio com acesso aos registros DNS |
| B | Domínio próprio, mas DNS administrado por outra pessoa ou empresa |
| C | Ainda não há domínio definido para esta operação |

**Situação: respondida — domínio confirmado por resposta livre, em 09/09/2026.** Usuário informou https://www.geniusidiomas.com/; domínio registrado como geniusidiomas.com. Responsável/acesso ao DNS, remetente/subdomínio e verificação no Resend continuam na preparação. Não classificar a resposta como opção A ou B sem confirmação.

O [Resend documenta a verificação de domínio por registros DNS](https://resend.com/docs/dashboard/domains/introduction). Os dados e a verificação real serão necessários antes de habilitar envio em produção; a especificação pode indicar configuração obrigatória sem inventar esses valores.

### Bloco de fonte oficial e serviço de envio — Q77–Q78 respondidas

Enviadas e respondidas em 09/09/2026, ambas com opção A: Google Drive como fonte oficial e Resend para envio de e-mails. Demais alternativas ficam como histórico. Plano, domínio/remetente e controles reais ainda precisam de preparação; não houve contratação, transferência automática de arquivos ou disparos reais.

#### Q77 — Qual serviço será a fonte oficial das gravações disponibilizadas ao aluno pelo ERP?

Definir quais links são aceitos como material publicado e onde conferir permissões do aluno. Recomendação para a primeira entrega: concentrar a publicação no Drive. Ocultar link no ERP não revoga permissão externa; conferir contas, planos e configurações reais antes de declarar a integração funcional. A escolha não inclui transferência automática de arquivos nem captura automática de aulas.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Google Drive como fonte oficial; Zoom pode continuar como ferramenta de gravação, com material publicado ao aluno no Drive. Concentrar integração de acesso em um serviço |
| B | Drive e Zoom como fontes oficiais; identificar serviço de cada gravação e integrar/validar os controles dos dois, ampliando o trabalho da entrega |
| C | Nuvem do Zoom como fonte oficial com autenticação/compartilhamento compatíveis; Drive como arquivo interno. Depende de plano e configuração adequados |

**Situação: respondida — opção A, em 09/09/2026.** Google Drive como fonte oficial do material publicado ao aluno; Zoom pode continuar como ferramenta de gravação. Integração de acesso concentrada no Drive, ainda pendente de implementação/validação.

#### Q78 — Qual serviço devemos adotar para os e-mails automáticos do ERP?

Convites, recuperação de conta e avisos institucionais. Recomendação: Resend pela integração documentada com Next.js e opção inicial de baixo volume, conferindo picos e volume mensal antes de escolher plano. A decisão orienta a implementação, sem contratação ou envio imediato; domínio/remetente e operação ainda precisam ser configurados/validados.

| Opção | Referência de custo e impacto |
|---|---|
| A — Recomendada: Resend | Gratuito até 3.000 e-mails/mês e 100/dia; Pro de US$ 20/mês para 50.000. Escolher plano conforme volume/picos. [Preços oficiais](https://resend.com/pricing) |
| B — Postmark | Basic de US$ 15/mês para 10.000 e-mails; API/SMTP e acompanhamento de entregas. [Preços oficiais](https://postmarkapp.com/pricing) |
| C — Amazon SES | Tarifa avulsa base de US$ 0,10/1.000 enviados, com possíveis adicionais. Exige preparação AWS e liberação de produção. [Preços oficiais](https://aws.amazon.com/ses/pricing/) |

Preços consultados em 09/09/2026, em dólares, sem conversão, tributos ou custos de outros serviços. Referências comparativas, não orçamento contratado, parâmetros financeiros do ERP ou escolha automática do plano gratuito.

**Situação: respondida — opção A, em 09/09/2026.** Resend escolhido, com plano conforme volume/picos. Preparar domínio/remetente, conta/configuração e validação antes de operar; não houve contratação ou envio.

#### Referências técnicas para as integrações

- O [Google Drive documenta permissões por usuário e sua revogação](https://developers.google.com/workspace/drive/api/guides/manage-sharing); permissões herdadas da pasta também precisam ser conferidas. Verificar configuração real para não prometer revogação apenas pela exclusão de uma concessão individual.
- O [Zoom documenta autenticação de gravações e compartilhamento específico](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0067223), com requisitos de conta/plano. Isso não comprova configuração ou automação nas contas da escola.
- O [Resend documenta integração com Next.js](https://resend.com/docs/send-with-nextjs) e [verificação de domínio](https://resend.com/docs/dashboard/domains/introduction). Preparar domínio/remetente verificados, tratamento de falhas e limites; não presumir domínio existente ou usar domínio de teste para destinatários reais.
- O [Postmark documenta API, SMTP e eventos de entrega](https://postmarkapp.com/developer). A [documentação do SES](https://docs.aws.amazon.com/ses/latest/dg/Welcome.html) descreve API/SMTP, eventos e permissões AWS; [produção exige saída do ambiente restrito](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).

Consulta em 09/09/2026. Recomendações são avaliações para este projeto a partir dessas referências; não garantem entrega na caixa de entrada, adequação do plano contratado ou integração já existente. Verificar cenários reais antes da entrada em operação.

### Bloco de serviços existentes — Q75–Q76 respondidas

Enviadas e respondidas em 09/09/2026. Q75: Google Drive e Zoom. Q76: serviço de e-mail ainda não definido. São informações operacionais; não equivalem a contratação, integração implementada ou autorização para enviar mensagens reais. As opções abaixo ficam como histórico.

#### Q75 — Onde as gravações das aulas ficam disponíveis hoje?

Identificar armazenamento/disponibilização real para conferir liberação/revogação de acesso ao vídeo. Login no ERP não controla sozinho um link externo já compartilhado. Se a escola grava em um serviço e armazena em outro, registrar a combinação informada; resposta em texto pode indicar outro serviço.

| Resposta sugerida | Informação |
|---|---|
| Google Drive | Arquivos e links ficam no Drive |
| Nuvem do Zoom | Vídeos permanecem hospedados no Zoom e são compartilhados pelos links dele |
| Serviço ainda não definido | Escolha e validação necessárias para disponibilizar gravações |

**Situação: respondida — Google Drive e Zoom, em 09/09/2026.** Informação operacional recebida; Q77 posteriormente escolheu Drive como fonte oficial. Conferir estrutura, conta, permissões e integração; não presumir fluxo de transferência ou gravação em nuvem.

#### Q76 — Qual serviço de e-mail institucional a escola já utiliza?

Identificar serviço e, se definido, endereço/domínio institucional remetente para convites, recuperação e avisos de Q38. Resposta pode informar serviço diferente das opções. Solicitar somente identificação operacional, sem credenciais. Não contratar fornecedor nem ativar envios por essa resposta.

| Resposta sugerida | Informação |
|---|---|
| Google Workspace ou Gmail | Identificar serviço/conta institucional e remetente aplicável |
| Microsoft 365 ou Outlook | Identificar serviço/conta institucional e remetente aplicável |
| Serviço ainda não definido | Escolha e validação necessárias para envio de e-mails do ERP |

**Situação: respondida — serviço ainda não definido no relato de Q76, em 09/09/2026.** Q78 posteriormente escolheu Resend. Plano, domínio/remetente e configuração ainda precisam ser preparados; escolha não comprova envio/entrega nem autoriza contratação ou disparo real.

### Bloco de e-mail individual e recuperação assistida — Q73–Q74 respondidas

Enviadas e respondidas em 09/09/2026, ambas com opção A. Q73 exige endereço individual verificado antes do convite, com pendência acompanhada pela Secretaria. Q74 exige solicitação da Secretaria/Administração e aprovação/aplicação por outra pessoa da Administração. Demais alternativas ficam como histórico; implementação pendente.

#### Q73 — Como atender um aluno que ainda não tem e-mail próprio?

Identificar corretamente quem acessa/envia atividade; não usar conta compartilhada da turma, e-mail fictício ou senha conhecida pela equipe. Pode haver aluno que dependa de ajuda do responsável. Esta escolha trata do portal e não acrescenta requisito financeiro de ativação da matrícula.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Secretaria orienta aluno/responsável a providenciar e verificar endereço individual antes do convite. Registrar pendência de acesso até lá; convite/recuperação seguem Q72 |
| B | Escola fornece caixa institucional individual; definir serviço e operação dessas contas. Convite continua seguindo Q72 |
| C | Incluir conta própria do responsável verificado para atuar nas reposições do dependente autorizado, com autoria identificada. Amplia o recorte para esse fluxo, sem portal financeiro/administrativo |

**Situação: respondida — opção A, em 09/09/2026.** Secretaria orienta a providenciar/verificar endereço individual antes do convite e registra pendência. Convite/recuperação seguem Q72; não inclui caixa institucional ou acesso próprio do responsável.

#### Q74 — Quem pode autorizar a troca do e-mail de acesso quando o aluno perdeu o endereço anterior?

Tratar recuperação assistida quando o aluno não recebe mais o link no e-mail verificado. Edição de contato cadastral não transfere a conta automaticamente. Em todas as alternativas, conferir identidade/vínculo, validar novo endereço e registrar motivo, solicitação e decisão; aprovação aplica a troca, invalida links/sessões anteriores e envia o novo fluxo de recuperação. Equipe não define nem recebe senha; sem autoaprovação.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Secretaria/Administração prepara; outra pessoa da Administração confere, aprova e aplica |
| B | Secretaria/Administração prepara; outra pessoa da Secretaria com permissão específica de recuperação, ou da Administração, confere, aprova e aplica |
| C | Somente Administração: uma pessoa prepara e outra confere/aprova/aplica. Secretaria apenas encaminha o atendimento, sem preparar alteração no ERP |

**Situação: respondida — opção A, em 09/09/2026.** Secretaria/Administração prepara; outra pessoa da Administração confere, aprova e aplica. Preservar verificação de identidade/vínculo e novo endereço, registro, invalidação de links/sessões anteriores e senha definida pelo aluno.

### Bloco de acesso do aluno — Q72 respondida

Enviada e respondida em 09/09/2026, opção A: e-mail/senha com convite individual e recuperação por link de uso único com validade no e-mail verificado. Equipe não consulta nem envia senha. Alternativas não escolhidas ficam como histórico; área permanece limitada às reposições de Q33 e pendente de implementação.

#### Q72 — Como o aluno deve entrar na área de reposições e recuperar seu acesso?

Em todas as opções, vincular a conta ao aluno correto sem duplicar cadastro acadêmico ou atribuir papel de funcionário; escola confere o vínculo antes do primeiro acesso. O procedimento assistido para aluno sem contato próprio ou perda do canal será detalhado após a escolha, sem inventar contato ou compartilhar uma conta entre alunos.

| Opção | Tratamento |
|---|---|
| A — Recomendada | E-mail e senha com convite individual: aluno define senha; recuperação por link de uso único com validade no e-mail verificado. Equipe não consulta nem envia a senha |
| B | Sem senha, com código de uso único em e-mail ou WhatsApp verificado ao entrar; depende do canal. Troca/perda exige conferência assistida, sem liberação apenas por informar contato novo |
| C | Conta Google ou Microsoft previamente vinculada ao aluno; recuperação no provedor e troca de vínculo conferida pela escola. Integração e provedor precisam ser definidos para a entrega |

**Situação: respondida — opção A, em 09/09/2026.** E-mail/senha com convite individual; aluno define senha e recupera por link de uso único com validade no e-mail verificado. Equipe não consulta nem envia senha. Procedimentos para ausência/perda do canal ainda serão detalhados.

Referências técnicas consultadas em 09/09/2026: a OWASP orienta [recuperação de conta](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) com tokens de uso único e expiração, proteção contra tentativas excessivas e respostas que não revelem contas existentes; também reúne [orientações de autenticação](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html). São referências para especificar e verificar o mecanismo escolhido; não comprovam implementação no projeto nem escolhem um provedor.

### Bloco de indisponibilidade parcial e saldo devedor — Q70–Q71 respondidas

Enviadas e respondidas em 09/09/2026: Q70 = A e Q71 = B. O usuário confirmou que o fragmento de parcelamento em Q71 era erro de digitação, encerrando a ambiguidade. As demais alternativas permanecem como histórico; proporcional em Q70 e parcelamento em Q71 não foram escolhidos.

#### Q70 — Como tratar uma mensalidade quando a falta de oferta da escola afetar apenas parte do período?

Exemplo: continuidade disponível no início, alguns dias sem turma compatível por indisponibilidade da escola e retorno posterior. Distinguir de feriado/recesso, falta do aluno e pausa solicitada. Em todas as alternativas, registrar intervalo sem oferta, mostrar efeito nas coberturas/cobranças e conferir contrato; Financeiro prepara e outra pessoa autorizada do Financeiro/Administração aprova antes de aplicar. Preservar recebimentos e evitar compensação duplicada.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Manter valor integral e recompor os dias de cobertura indisponíveis após o retorno, sem cobrança adicional pela compensação; proposta mostra extensão e início dos próximos períodos, sem sobreposição ou cobrança dos dias compensados |
| B | Dispensar a mensalidade inteira do período: retirar saldo exigível e reconhecer valor pago como crédito; sem fração diária, mantendo aprovações de utilização/devolução |
| C | Acrescentar exceção de proporcional por indisponibilidade da escola à regra de Q09, cobrando a parte dos dias com oferta; mostrar fórmula, descontos, ajuste e crédito. Não estender a férias, recessos ou faltas do aluno |

**Situação: respondida — opção A, em 09/09/2026.** Manter valor integral e recompor dias de cobertura indisponíveis após retorno, sem cobrança adicional; proposta aprovada mostra extensão e início dos próximos períodos, sem sobreposição ou cobrança dos dias compensados.

#### Q71 — Como organizar o saldo devedor depois de aprovar o encerramento da matrícula?

O acerto considera última mensalidade, eventual multa contratual, recebimentos e créditos; pode restar valor a pagar. As alternativas propõem efetivar encerramento após aprovação do acerto, respeitando a data efetiva sem esperar quitação, conservando a dívida para acompanhamento financeiro. Não criar desconto, perdão, novos juros ou mudança de vencimentos sem autorização; preservar registros e impedir cobrança duplicada.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Manter cobranças devidas, sua identificação/vencimentos e somente os ajustes aprovados no acerto. Financeiro acompanha o saldo; renegociação por proposta própria |
| B | Com concordância do aluno, Financeiro propõe uma cobrança final com saldo/vencimento para aprovação independente. Anteriores ficam vinculadas como substituídas, sem apagamento ou duplicidade; sem acordo, condições originais |
| C | Propor parcelas/vencimentos do saldo no acerto, com concordância do aluno e aprovação independente antes de substituir a forma anterior. Sem acordo, condições originais; não atrasar a data efetiva de encerramento |

**Situação: respondida — opção B, confirmada em 09/09/2026.** Cobrança final única mediante concordância e aprovação independente; vincular originais como substituídas, sem apagamento/duplicidade. Sem acordo, condições originais. Usuário esclareceu que o trecho da opção C era erro de digitação.

### Bloco de cobranças sem oferta, uso de crédito e devolução — Q67–Q69 respondidas

Enviadas e respondidas em 09/09/2026: Q67 = C, Q68 = A e Q69 = A. As alternativas não escolhidas ficam como histórico. Q32 impede nova emissão sem oferta e Q29 conserva crédito para uso futuro/devolução a pedido. Este bloco detalha cobranças existentes, uso de crédito e execução da devolução; permanece pendente de implementação.

#### Q67 — Como regularizar uma mensalidade já emitida para um período inteiro sem oferta da escola?

A cobrança pode ter sido emitida antes de registrar a indisponibilidade, inclusive já paga. Tratar período inteiramente sem oferta, distinto de feriado/recesso ou pausa solicitada pelo aluno. Nas alternativas, Financeiro prepara e outra pessoa autorizada do Financeiro/Administração aprova o ajuste. Preservar cobrança, recebimentos e histórico; impedir crédito/devolução duplicados.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Retirar cobrança do período: proposta zera o saldo ainda exigível e reconhece o valor efetivamente pago como crédito identificado; devolução somente por pedido conforme Q29. Ajuste não registra pagamento fictício |
| B | Com concordância registrada do aluno e contrato compatível, aprovar novas datas de cobertura na continuidade futura para a mesma mensalidade, preservando o pagamento; identificar cobertura e não cobrar novamente o mesmo período |
| C | Aluno escolhe entre crédito ou cobertura futura permitidos pelo contrato; Financeiro registra a escolha e prepara a proposta. Sem escolha/dados suficientes, regularização fica pendente, sem decisão automática |

**Situação: respondida — opção C, em 09/09/2026.** Aluno escolhe entre crédito e cobertura futura permitidos pelo contrato; Financeiro registra a escolha e prepara proposta aprovada por outra pessoa autorizada. Sem escolha/dados suficientes, regularização pendente. Período parcialmente afetado segue Q70.

#### Q68 — Como autorizar o uso de um crédito para abater cobranças do próprio aluno?

Crédito disponível não significa mensalidade já quitada por ele. Registrar origem, cobrança de destino, valor usado e saldo restante; preservar cobrança/recebimento original e impedir uso/devolução concorrentes do mesmo saldo. Nenhuma alternativa autoriza transferir crédito para outro aluno.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Autorizar cada utilização: registrar solicitação/concordância do aluno; Financeiro propõe cobranças e abatimentos identificados, outra pessoa autorizada do Financeiro/Administração aprova antes de aplicar |
| B | Uso automático previamente autorizado pelo aluno e com regra/limites aprovados por outra pessoa autorizada; ERP aplica nas cobranças elegíveis e registra cada uso. Mudança relevante exige nova autorização |
| C | Aprovar um conjunto fechado de utilizações: aluno concorda com distribuição entre cobranças identificadas; Financeiro prepara e outra pessoa autorizada aprova. Destinos/valores fora do conjunto exigem nova proposta |

**Situação: respondida — opção A, em 09/09/2026.** Cada utilização exige solicitação/concordância, proposta de abatimento em cobranças identificadas e aprovação independente antes de aplicar; sem autorização genérica para uso automático.

#### Q69 — Como dividir preparação, aprovação e execução de uma devolução de dinheiro?

Q29 exige solicitação do aluno e processamento pelo Financeiro. A proposta identifica pedido, saldo disponível, valor e destino conferido. Em todas as alternativas, outra pessoa autorizada do Financeiro/Administração aprova antes da saída; registrar execução real e evidência. Mudança de valor/destino exige nova aprovação; acumular papéis não autoriza autoaprovação.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Financeiro prepara; outra pessoa autorizada aprova; preparador pode executar se também tiver a permissão de execução. Ao menos duas pessoas distintas |
| B | Financeiro prepara; outra pessoa com permissões de aprovação e execução confere, aprova e realiza a devolução. Preparador não executa essa proposta |
| C | Três pessoas distintas: uma prepara, outra aprova e uma terceira autorizada executa; requer equipe para as três etapas |

**Situação: respondida — opção A, em 09/09/2026.** Preparador pode executar se autorizado após outra pessoa aprovar; ao menos duas pessoas distintas. Preservar valor/destino aprovados e registrar execução real com evidência.

Referência técnica consultada em 09/09/2026: a documentação da Stripe distingue [ajuste de cobrança, crédito ao cliente e devolução](https://docs.stripe.com/invoicing/dashboard/credit-notes), preservando o documento original. A referência ajuda a separar os registros; as políticas, permissões e etapas do ERP dependem das decisões acima. Não define integração com a Stripe nem adoção de um documento fiscal específico.

### Bloco de pausa e cobertura na retomada — Q65–Q66 respondidas

Enviadas e respondidas em 09/09/2026, ambas com opção A. Mensalidade integral e proporcional somente no encerramento permanecem conforme Q09/Q12. D13 mantém a escolha dos vencimentos com aprovação independente; Q66 acrescenta a cobertura à mesma proposta. Alternativas não escolhidas ficam como histórico; decisões ainda pendentes de implementação.

#### Q65 — Quando o aluno pede pausa no meio de um período já iniciado, quando ela passa a valer?

Exemplo ilustrativo: cobertura de 1 a 30 e pedido de pausa no dia 12. Definir quando o acesso passa à situação de pausa e a partir de quais períodos suspender a cobrança. Preservar recebimentos e histórico; nenhuma alternativa autoriza desconto, crédito ou devolução automática pela parte não utilizada. Retomada exige proposta aprovada.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Pausa imediata na data registrada; manter integral o período iniciado e suspender os períodos seguintes abrangidos pela pausa. Acesso passa às regras de matrícula pausada |
| B | Registrar o pedido agora e efetivar a pausa somente após o último dia do período coberto. Até lá matrícula/acesso permanecem ativos, respeitando restrições; suspender os períodos seguintes |
| C | Momento definido no contrato: pausa imediata ou no fim do período, mostrando pedido, data efetiva e mensalidades afetadas; regra insuficiente exige conferência, sem nova proporcionalidade |

**Situação: respondida — opção A, em 09/09/2026.** Pausa imediata, período iniciado integral e períodos seguintes abrangidos suspensos; acesso passa às regras de matrícula pausada.

#### Q66 — Na retomada, como ficam os períodos de serviço das mensalidades suspensas pela pausa?

D13 já exige proposta aprovada para manter ou reprogramar vencimentos. Definir o destino da cobertura das mensalidades de períodos ainda não iniciados quando suspensos pela pausa. Preservar períodos já iniciados e recebimentos. Mostrar cobertura e vencimento separadamente, conferir contrato e evitar sobreposição/cobrança duplicada. Indisponibilidade da escola continua distinta, conforme Q32.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Reprogramar cobertura dos períodos suspensos a partir do retorno, conforme referência contratual; manter separada a escolha de vencimentos originais/reprogramados e aprovar as duas informações na mesma proposta |
| B | Manter cobertura original; mudar somente vencimentos quando essa opção for escolhida. Explicitar períodos que coincidam com a pausa e conferir correspondência ao contrato |
| C | Tratamento definido no contrato: deslocar ou preservar cobertura conforme condições da matrícula, registrando regra e efeito junto da escolha dos vencimentos; informação insuficiente exige conferência antes de aprovar |

**Situação: respondida — opção A, em 09/09/2026.** Reprogramar cobertura conforme referência contratual a partir do retorno, mantendo separada a escolha dos vencimentos; aprovar as duas informações na mesma proposta. Preservar períodos iniciados, recebimentos e ausência de duplicação.

### Bloco de período financeiro, descontos e continuidade — Q62–Q64 respondidas

Enviadas e respondidas em 09/09/2026: Q62 = A, Q63 = C e Q64 = A. As alternativas não escolhidas permanecem como histórico. Mensalidade integral, proporcional apenas no encerramento solicitado, condições do contrato e aprovação do acerto continuam aplicáveis.

#### Q62 — Como definir o período que cada mensalidade cobre?

Separar vencimento do intervalo de serviço coberto; guardar início/fim para calcular encerramento por dias reais. Mês civil e ciclo individual são referências possíveis. A cobrança integral na entrada/continuidade permanece; não autorizar proporcionalidades novas.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Referência definida no contrato da matrícula: permitir mês civil ou ciclo mensal com data registrada, conforme condições contratadas; guardar início/fim separados do vencimento; regra incompleta exige conferência |
| B | Ciclo mensal individual para todas: primeiro período começa na data de início da prestação registrada na matrícula e demais seguem a referência mensal; vencimento separado |
| C | Calendário civil para todas: seguir meses civis, registrando cobertura aplicável na entrada/encerramento; vencimento separado e entrada sem proporcional automático |

**Situação: respondida — opção A, em 09/09/2026.** Referência definida no contrato da matrícula, mês civil ou ciclo mensal com data registrada; cobertura explícita e separada do vencimento. Regra insuficiente exige conferência.

#### Q63 — Como aplicar descontos no proporcional de encerramento?

Exemplo ilustrativo: base de R$ 500, desconto fixo de R$ 100 e metade do período. Proporcional do líquido de R$ 400 resulta em R$ 200; proporcional da base seguido do desconto fixo integral resulta em R$ 150. Usar somente descontos válidos, respeitar condições contratuais, preservar recebimentos, mostrar memória e manter multa separada/aprovação do acerto.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Proporcional do valor mensal líquido: aplicar descontos válidos e depois fração pelos dias cobertos; no exemplo R$ 200, sem descontar novamente |
| B | Proporcional primeiro, desconto depois: fração da base e depois desconto contratual, fixo integral quando essa for a condição; no exemplo R$ 150 |
| C | Método definido no contrato: suportar as duas formas, registrar método/ordem aplicável; condição pouco clara exige conferência antes da aprovação |

**Situação: respondida — opção C, em 09/09/2026.** Suportar os dois métodos conforme contrato, registrando o aplicável e a ordem; condição do desconto pouco clara exige conferência antes de aprovar. Exemplo não define parâmetros da escola.

#### Q64 — Quando gerar novas mensalidades após acabar o cronograma inicial?

Q30 permite continuidade contratada com matrícula ativa, respeitando pausa/encerramento e falta de oferta. Escolher quando lançamentos aparecem, sem duplicar períodos, presumir renovação ou alterar cobranças antigas. Antecedência/horizonte configuráveis sem números presumidos.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Antecedência ao vencimento configurável: gerar cada nova mensalidade ao chegar o prazo anterior ao vencimento, revalidando contrato, matrícula e oferta |
| B | Horizonte futuro configurável: manter lançada quantidade configurada de períodos à frente, repondo o horizonte quando condições permitirem |
| C | Início do período de cobertura: gerar quando o período começar, compatibilizando esse momento com o vencimento contratado |

**Situação: respondida — opção A, em 09/09/2026.** Antecedência configurável ao vencimento, com nova conferência de contrato, matrícula e oferta. Preservar autorização contratual de Q30, evitar duplicação e manter cobranças antigas.

Referências técnicas consultadas em 09/09/2026: a Stripe documenta a [referência do ciclo de cobrança](https://docs.stripe.com/billing/subscriptions/billing-cycle) e o uso do [preço com desconto no cálculo proporcional](https://docs.stripe.com/billing/subscriptions/prorations). São referências de modelagem; os gatilhos, períodos e métodos deste ERP continuam sujeitos às decisões da escola. Não foi escolhida integração com a Stripe nem importada sua política padrão de proporcionalidade.

### Bloco de frequência e transição de benefícios — Q59–Q61 respondidas

Enviadas e respondidas em 09/09/2026, todas com opção A; as demais alternativas permanecem como histórico.

#### Q59 — Como registrar frequência quando uma restrição impediu acesso à aula?

Distinguir ausência do aluno de impedimento registrado no ERP; professor recebe apenas informação operacional necessária, sem valores/detalhes financeiros. Não remover restrição, inventar presença ou concluir reposição; recuperação mantém autorizações. Outros critérios de progressão continuam separados.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Impedimento identificado sem crédito: “Impedido por restrição”, mantendo aula na base da frequência e sem presença/regularização até reposição concluída; distinguir de faltas comuns |
| B | Impedimento fora do percentual: registrar motivo, excluir aula do denominador e manter pendência de conteúdo visível; exclusão não comprova conteúdo cumprido |
| C | Gestão decide ocorrência com motivo: cálculo correspondente fica pendente até decidir inclusão/exclusão da base; relatório identifica decisões pendentes |

**Situação: respondida — opção A.** Impedimento identificado permanece na base, sem crédito até reposição concluída; professor recebe somente informação operacional e restrição não é removida por essa regra.

#### Q60 — Quanto da cota particular recebe quem entra no meio de um período?

Mais relevante no calendário civil; ciclo da matrícula pode começar completo. Mensalidade mantém regra financeira aprovada. Decisão trata apenas de quantidade de particulares; saldo livre não acumula.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Cota integral do período de entrada: quantidade completa do plano, consumo/reserva normal e expiração de saldo livre ao fim |
| B | Cota proporcional aos dias restantes: quantidade × dias cobertos restantes ÷ dias do período, arredondando para baixo, sem fração de aula; mostrar cálculo |
| C | Particular somente no próximo período completo: período parcial sem cota particular; gravação com resumo/atividade quando aplicável |

**Situação: respondida — opção A.** Entrada parcial recebe cota integral do plano no período; consumo/reserva e expiração normais. Quantidade continua configurável; regra financeira da mensalidade permanece própria.

#### Q61 — Como ficam benefício e reservas numa troca de plano autorizada?

Distinguir edição da configuração de Q50 da troca do plano do aluno. Esta decisão delimita o benefício; preço, contrato e acerto pertencem ao fluxo próprio da mudança. Preservar usos/reservas, condições e impedir duas cotas do mesmo intervalo por simples troca.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Benefício novo no próximo período: manter regra/cota atuais até o fim; aplicar novo no seguinte, honrando particulares autorizadas e considerando reservas antes de liberar saldo |
| B | Benefício novo imediato com ciclo atual preservado: novo limite desconta usos/reservas existentes; honrar autorizadas e zerar saldo livre se já atingiram limite; nova duração/referência só após período atual |
| C | Resolver reservas antes de mudar benefício: manter anterior enquanto houver particulares futuras reservadas; realizar ou tratar cancelamento/remarcação pelas regras antes de efetivar mudança |

**Situação: respondida — opção A.** Troca autorizada aplica novo benefício no próximo período, preservando atual, usos/reservas e saldo sem duplicação. A jornada comercial/financeira de troca continua própria, sem ser declarada implementada por essa definição.

### Bloco de substituição docente e indisponibilidade de gravação — Q56–Q58 respondidas

Enviadas e respondidas em 09/09/2026, todas com opção A; as demais alternativas permanecem como histórico.

#### Q56 — Quem solicita substituição temporária do professor em aulas publicadas?

Proposta cobre um encontro ou período com aulas identificadas; preservar titular e autoria de quem realmente ministra cada aula. Substituto recebe acesso limitado às aulas atribuídas; conferir conflitos/indisponibilidades. Outra pessoa da Gerência Pedagógica/Administração aprova antes de aplicar; ausência de Q39 não escolhe substituto automaticamente.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Secretaria/gestão solicitam: Secretaria, Gerência Pedagógica ou Administração preparam substituto, aulas/período e motivo; outra pessoa autorizada aprova/aplica |
| B | Professor também solicita: além da Secretaria/gestão, titular pede substituição das próprias aulas e pode sugerir colega; gestão confere e aprovação independente antecede aplicação |
| C | Somente gestão solicita: Gerência Pedagógica/Administração prepara; Secretaria/professor informam necessidade, sem abrir a substituição; outra pessoa aprova |

**Situação: respondida — opção A.** Secretaria/gestão propõe e outra pessoa autorizada aprova/aplica, com acesso restrito do substituto e titular preservado. Não substitui Q24/Q40.

#### Q57 — Como registrar gravação que deixa de funcionar após conclusão da aula?

Preservar aula realizada e histórico. Confirmada a indisponibilidade, abrir pendência de material; troca de link mantém Q23. Reposição sem gravação recuperável segue Q34. Aluno só informa problema em material com acesso autorizado.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Aluno e equipe informam: aluno sinaliza na própria reposição; professor/equipe também registram; gestão confere indisponibilidade e acompanha regularização, preservando conclusão/histórico |
| B | Somente equipe registra: aluno comunica pelo canal institucional; professor, Secretaria ou gestão registram no ERP; gestão confere/acompanha |
| C | Verificação automática mais relatos: conferência periódica se provedor permitir validar acesso real; relatos continuam; falha suspeita exige conferência e URL respondendo não comprova acesso do aluno |

**Situação: respondida — opção A.** Relato pelo aluno/equipe e conferência da gestão; preservar aula/histórico, Q23 e Q34. Não foi escolhida verificação periódica automática.

#### Q58 — Como ajustar prazo se a gravação fica indisponível durante a contagem?

Q35 inicia prazo quando material está disponível; Q52 bloqueia envio após vencimento. Interrupção depende de indisponibilidade confirmada pela escola, com início/fim registrados. Preservar entregas existentes e manter Q36/restrições de acesso; não concluir reposição pelo relógio.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Pausar e retomar tempo restante: suspender contagem durante indisponibilidade confirmada; restabelecido material, devolver apenas tempo restante e registrar intervalo/nova data limite |
| B | Gestão define prorrogação: manter prazo e abrir pendência urgente; gestão autoriza novo prazo com motivo conforme Q35, sem alteração automática |
| C | Reiniciar prazo integral da etapa quando material voltar: conceder prazo completo configurado, preservando causa e datas anteriores/novas |

**Situação: respondida — opção A.** Contagem pausa no intervalo de indisponibilidade confirmado e retoma com tempo restante, preservando datas e permissões; relato sem conferência não altera prazo.

### Bloco de histórico e correções da reposição — Q53–Q55 respondidas

Enviadas e respondidas em 09/09/2026, todas com opção A; as demais alternativas permanecem como histórico.

#### Q53 — Como preencher chamada antiga depois da transferência, pausa ou encerramento do aluno?

Aluno pertencia à turma na terça, saiu na quarta e professor lança na quinta. O código atual usa alocações atualmente ativas para novos registros, preservando anteriores. A chamada precisa representar elegibilidade na data da aula, sem incluir quem entrou depois ou inventar presença; histórico incompleto exige conferência. Professor desvinculado não recupera acesso amplo; regularização designada segue Q24.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Lista histórica automática: ERP calcula vínculo/situação na data da aula e libera chamada ao responsável autorizado mesmo após saída do aluno, com dados limitados à aula |
| B | Secretaria valida casos de saída: ERP monta lista histórica; lançamentos de já transferidos/pausados/encerrados aguardam conferência da Secretaria |
| C | Gestão autoriza cada regularização após saída: alunos históricos identificados, mas incluir/completar registro exige autorização da Gerência Pedagógica/Administração para aula/aluno com motivo |

**Situação: respondida — opção A.** Lista histórica automática pela data da aula, com vínculo/situação conferidos e autorização própria do responsável. Preservar Q23/Q24 e tratar histórico incompleto sem inventar presença.

#### Q54 — Como corrigir reposição que já foi concluída?

Preservar entrega, avaliação/decisão anteriores e registrar motivo, autor e valores corrigidos; conferir efeitos na frequência e no benefício. Dados da aula original continuam seguindo Q23; esta pergunta trata de registros próprios da reposição. Professor sem atribuição vigente não volta a editar.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Toda correção exige aprovação independente: professor designado vigente ou gestão propõe; outra pessoa da Gerência Pedagógica/Administração aprova/publica; resultado anterior permanece até correção válida |
| B | Aprovação para resultado/vínculo: professor corrige apenas texto do próprio feedback com histórico; conclusão, aula vinculada, frequência ou benefício exigem aprovação independente; Q23 permanece |
| C | Somente gestão inicia: professor informa necessidade; gestão prepara proposta e outra pessoa autorizada aprova/publica com conferência dos efeitos |

**Situação: respondida — opção A.** Toda correção de reposição concluída exige aprovação independente, com resultado anterior vigente até aplicação válida e efeitos conferidos. Preservar evidências e Q23 quando houver dados da aula original.

#### Q55 — Qual data aparece na reposição por gravação depois da aprovação?

Preservar data da versão final entregue/aprovada e data da validação; frequência só é regularizada depois da aprovação. Na particular permanece a data de realização.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Mostrar “Reposta em [data da validação]”; data da entrega fica nos detalhes |
| B | Depois da validação, mostrar “Reposta em [data da versão entregue e aprovada]”; validação nos detalhes, sem regularização antecipada |
| C | Mostrar ambas na tela principal: “Entrega em [data] · Reposição validada em [data]” |

**Situação: respondida — opção A.** Mostrar data da validação docente na reposição gravada e data da entrega aprovada nos detalhes, preservando histórico e confirmação de Q13. Particular mantém data de realização.

### Bloco de mudanças do benefício e pendências do aluno — Q50–Q52 respondidas

Enviadas e respondidas em 09/09/2026, todas com opção A; as demais alternativas permanecem como histórico.

#### Q50 — Quando a mudança na configuração do benefício vale para alunos que já têm o plano?

Mudança de quantidade ou duração/referência do período deve preservar utilizações, reservas e condições contratuais aplicáveis; não apagar consumos ou cancelar silenciosamente particulares autorizadas. Esta pergunta trata do benefício e sua versão, sem reiniciar saldo por simples edição.

| Opção | Tratamento |
|---|---|
| A — Escolhida | No próximo período de cada aluno: manter regra atual até o fim; aplicar nova no seguinte. Honrar particulares autorizadas, considerar reservas antes de novas e não abrir saldo adicional se já ocuparem a nova cota |
| B | Imediatamente sem zerar histórico: aplicar regra ao período vigente descontando usos/reservas; honrar agendamentos autorizados e zerar saldo livre se ultrapassarem limite. Alterar referência preserva cobertura anterior sem cota duplicada |
| C | Somente novas adesões: atuais mantêm versão vinculada à matrícula; novas adesões usam configuração nova. Migrar aluno existente exige mudança de condição explicitamente registrada |

**Situação: respondida — opção A.** Nova configuração somente no próximo período de cada aluno; preservar atual e honrar reservas anteriores, consideradas no saldo disponível. Não reiniciar cota por edição nem presumir alteração das condições contratuais aplicáveis.

#### Q51 — Depois de faltar à particular ou cancelar fora do prazo, pode pedir outra para a mesma aula original?

Q16 mantém consumo anterior sem regularizar a aula. Nova tentativa não devolve consumo, dispensa Q11 ou ganha gratuidade por si só; exceção por falta de gravação segue Q34.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Novo pedido e nova conferência de saldo: permitir outra tentativa aprovada se plano/cota permitirem; manter consumo anterior e gravação com resumo/atividade como alternativa |
| B | Limite adicional configurável por aula original: além da cota do período, definir número de tentativas; atingido limite, gravação quando disponível e exceções por decisão registrada da gestão; nenhum número presumido |
| C | Particular adicional somente por exceção: após falta/cancelamento tardio, seguir normalmente pela gravação; outra particular exige motivo, autorização excepcional, saldo e regras aplicáveis |

**Situação: respondida — opção A.** Nova solicitação/aprovação com conferência de plano/cota; consumo anterior permanece e gravação segue como alternativa. Preservar uma regularização por aula original e a causa da exceção de Q34.

#### Q52 — O que ocorre após vencer o prazo de entrega ou correção?

Q35 define prazos/prorrogação justificada. Preservar entregas anteriores; entrega registrada no prazo continua avaliável depois dele. Relógio não aprova/reprova reposição; pausa/encerramento mantém Q36.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Bloquear novos envios até prorrogação: mostrar prazo vencido; gestão autoriza novo prazo com motivo e libera etapa. Professor pode avaliar o que já estava registrado |
| B | Aceitar envio atrasado identificado: aluno envia na etapa pendente, com atraso registrado e aviso à gestão/professor; avaliação normal sem exigir prorrogação para receber |
| C | Configurar por etapa se bloqueia ou aceita atrasado: mostrar política/prazo ao aluno; bloqueio admite prorrogação justificada |

**Situação: respondida — opção A.** Bloquear novos envios até prorrogação justificada, preservando avaliação de entregas existentes. Aplicar em F07.6/F07.7 sem alterar resultado por decurso do prazo; manter Q36.

### Bloco de estado da turma e referência das cotas — Q48/Q49 respondidas

Enviadas e respondidas em 09/09/2026, ambas com opção A; as demais alternativas permanecem como histórico.

#### Q48 — Como a turma passa para “em andamento” e depois para “concluída”?

Distinguir estado da turma do estado da aula. A aula continua prevista até presença/gravação ou exceção aprovada, mesmo depois da data. Conclusão da turma exige meta cumprida e pendências de conclusão das aulas resolvidas, sem aprovar automaticamente alunos, encerrar matrículas ou cancelar mensalidades. Atraso no diário não pode permitir redução como se uma turma já iniciada não tivesse começado.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Início automático no começo do primeiro encontro previsto não cancelado; Gerência Pedagógica/Administração confirma conclusão após conferir meta cumprida e pendências resolvidas |
| B | Gestão confirma início e conclusão; encontro passado/evidência de aula bloqueia redução até conferir início, mesmo com status atrasado |
| C | Início e conclusão automáticos: começar no primeiro encontro previsto não cancelado e concluir ao cumprir meta de aulas ministradas sem pendências de conclusão; gestão acompanha |

**Situação: respondida — opção A.** Início automático e conclusão confirmada pela gestão com meta/pendências conferidas. Integrar F07.2/F07.3/F07.4 e proteção contra redução de Q42; não equivale a progressão acadêmica ou encerramento financeiro.

#### Q49 — Como delimitar o período da cota de reposições particulares?

Quantidade/duração do período já são configuráveis e saldo livre não acumula. Q49 permite configurar a referência por plano: calendário civil ou ciclo com data da matrícula. Mostrar datas exatas antes da reserva e usar período da particular agendada conforme Q26.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Referência configurável por plano: duração e calendário civil ou ciclo com data de referência da matrícula; exigir configuração completa e mostrar início/fim sem presumir quantidade/prazo |
| B | Períodos pelo calendário civil: mês do calendário e demais divisões civis explicitadas; matrícula iniciada no meio entra na cota vigente |
| C | Períodos pelo ciclo da matrícula: contar a partir da data de referência registrada, conforme duração configurada no plano; não usar automaticamente virada do mês civil |

**Situação: respondida — opção A.** Referência configurável por plano, com datas da cota explícitas e parâmetros obrigatórios. Mantém expiração sem acumulação e consumo/devolução já aprovados.

### Bloco de referência temporal e primeira aula — Q45–Q47 respondidas

Enviadas e respondidas em 09/09/2026, todas com opção A; as demais alternativas permanecem como histórico. A escolha de fuso de visualização e o horário/fuso de origem da turma permanecem definidos, sem calendários por país.

#### Q45 — Qual referência de horário define os dias não letivos do calendário único?

Uma mesma aula pode estar em dias diferentes conforme o fuso. Q45 definiu a referência institucional configurável para início/fim de feriados, recessos e férias, preservando referência de origem da turma e liberdade de visualização.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Fuso oficial da escola configurável: todos os dias não letivos usam a mesma referência institucional; converter encontros para ela ao conferir; preferência de visualização não altera resultado |
| B | Fuso de origem de cada turma: mesma lista de datas, interpretada no fuso da turma; o mesmo instante pode ser letivo para uma e não letivo para outra |
| C | Intervalo com fuso em cada registro: cadastrar início, fim e fuso do bloqueio; intervalo real vale para todas as turmas; exige cadastro mais detalhado |

**Situação: respondida — opção A.** Fuso institucional configurável define dias não letivos para todas as turmas. Não presumir Brasil, Costa Rica ou deslocamento fixo como padrão.

#### Q46 — Quando a data inicial não é válida na grade, quando acontece a primeira aula?

Exemplo: terça/quinta com data inicial numa segunda ou numa terça não letiva. Manter quantidade de aulas e mostrar primeira aula efetiva e previsão de término antes da publicação.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Próximo encontro válido: data informada é limite a partir do qual gerar aulas; começar no primeiro dia/horário letivo da grade e mostrar diferença entre data informada e primeira aula |
| B | Exigir data exata da primeira aula: bloquear publicação até a equipe ajustar data incompatível; exceção em dia não letivo continua pelo fluxo de Q19 |
| C | Primeira aula extraordinária aprovada: manter data fora da grade com motivo/aprovação independente; depois seguir grade regular. Dia não letivo exige exceção explícita de Q19 |

**Situação: respondida — opção A.** Gerar a partir da data informada, começando no próximo encontro letivo da grade; mostrar primeira aula efetiva e preservar quantidade.

#### Q47 — Uma aula pode começar em um dia e terminar no seguinte?

Exemplo: das 23h à 1h do dia seguinte no fuso da turma. A validação atual exige horário final maior que o inicial no mesmo dia. Se permitido, mostrar data final correta, conferir conflitos em todo o intervalo e aplicar referência de Q45. Qualquer parte em período não letivo exige exceção de Q19; atravessar meia-noite não autoriza feriado por si só.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Permitir na grade normal: calcular data/hora final a partir do início e duração, mesmo no dia seguinte, verificando o intervalo completo |
| B | Não permitir atravessar meia-noite: todas as aulas começam/terminam no mesmo dia no fuso de origem; bloquear cadastros e remarcações incompatíveis |
| C | Somente exceção aprovada: grade regular no mesmo dia; encontro específico pode atravessar meia-noite com motivo e aprovação de outra pessoa da Gerência Pedagógica/Administração |

**Situação: respondida — opção A.** Travessia da meia-noite permitida na grade normal, com datas explícitas e checagem de todo o intervalo. Calendário usa Q45 e sobreposição com período não letivo exige Q19.

### Bloco de limites e preparação das turmas — Q42–Q44 respondidas

Enviadas e respondidas em 09/09/2026, todas com opção A. As demais alternativas permanecem como histórico.

#### Q42 — Podemos reduzir a quantidade de aulas de um nível para turmas que já existem?

O aumento já foi definido; esta pergunta trata de reduzir, por exemplo, de 30 para 25 aulas. Qualquer redução permitida mostra conteúdo/encontros afetados, preserva aulas ministradas e registros passados, inclusive encontros passados com diário pendente, e segue a aprovação conjunta de Q41. A redução não encerra a matrícula nem cancela cobranças por conta própria.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Reduzir somente antes do início: turmas em andamento conservam quantidade anterior; ainda não iniciadas podem receber redução mediante revisão/aprovação conjunta; novas turmas usam a nova configuração |
| B | Permitir também em andamento: gestão justifica e confere cobertura de conteúdo; aprovação conjunta; meta não pode ficar abaixo das aulas ministradas e encontros passados que precisam ser preservados; bloquear proposta incompatível |
| C | Redução somente para turmas criadas depois: todas as já cadastradas conservam quantidade anterior, mesmo sem início; quantidade menor vale apenas para novas turmas |

**Situação: respondida — opção A.** Redução somente para ainda não iniciadas mediante revisão/aprovação conjunta; turmas em andamento mantêm a quantidade anterior e novas usam a configuração vigente. Preservar histórico; regra distinta do aumento.

#### Q43 — O aumento também deve atingir turmas já cadastradas que ainda não começaram?

Exemplo: modalidade passa de 25 para 30 aulas, com uma turma em andamento, outra com início no próximo mês e outra em rascunho. A turma em andamento deve ser atualizada; falta definir o alcance sobre as ainda não iniciadas. Agendas publicadas afetadas seguem Q41; recalcular rascunho não significa publicá-lo. Redução segue Q42.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Atualizar todas as não finalizadas: incluir andamento e ainda não iniciadas; recalcular rascunhos e aprovar conjuntamente mudanças de agendas publicadas; preservar finalizadas |
| B | Preservar as futuras já cadastradas: atualizar andamento, manter versão anterior nas turmas existentes ainda não iniciadas e usar nova quantidade para turmas criadas depois |
| C | Gestão escolhe para as não iniciadas: atualizar andamento obrigatoriamente; na proposta conjunta, identificar as futuras que acompanharão a mudança e justificar as que conservarão versão anterior |

**Situação: respondida — opção A.** Aumento alcança todas as não finalizadas; rascunhos são recalculados sem publicação automática. Agendas publicadas afetadas seguem o conjunto de Q41.

#### Q44 — Podemos cadastrar uma turma antes de escolher o professor?

O cadastro atual permite professor não informado. Distinguir planejamento, publicação da agenda e alocação de alunos: a disponibilidade docente só pode ser confirmada depois de designar professor e conferir conflitos/indisponibilidades.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Somente rascunho: preparar turma/previsão, mas exigir professor definido e disponível para publicar agenda e alocar alunos; rascunho não confirma disponibilidade |
| B | Exigir professor desde o cadastro: nenhuma turma pode ser salva sem professor definido |
| C | Publicação provisória aprovada: gestão autoriza professor a definir com motivo/prazo; permitir alocação de alunos informando essa condição; acompanhar pendência e confirmar disponibilidade somente após designação e validação de conflitos |

**Situação: respondida — opção A.** Sem professor, somente planejamento em rascunho. Publicação e alocação exigem professor definido/disponível; implementar verificação no servidor e integração com os estados da turma.

### Bloco de alteração da modalidade — Q41 respondida

Enviada e respondida em 09/09/2026 com opção A; as demais alternativas permanecem como histórico.

#### Q41 — Como aprovar e aplicar mudanças da modalidade que afetem várias turmas em andamento?

Aumentar a quantidade de aulas deve atualizar as turmas em andamento e preservar finalizadas. Mostrar as exceções locais de duração/frequência de Q37 na revisão. Q41 escolheu aprovação e aplicação do conjunto completo após resolução dos conflitos. Outra pessoa da Gerência Pedagógica/Administração aprova e aplica os cronogramas revisados se continuarem válidos, conforme Q21; preservar aulas ministradas/registros passados e incluir todas as turmas afetadas.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Aprovar o conjunto completo: preparar impactos de todas as turmas, resolver conflitos e aprovar/aplicar tudo na mesma operação, como nas mudanças globais de feriado/recesso |
| B | Aprovar turma por turma: cada cronograma é revisado/aprovado/aplicado separadamente; pendentes mantêm versão anterior com acompanhamento explícito até atualizar todas |
| C | Aprovar por grupos definidos pela gestão: cada grupo exige revisão/aprovação independente e aplicação conjunta; grupo conflitante aguarda enquanto os demais podem avançar |

**Situação: respondida — opção A.** Aprovação e aplicação conjunta de todas as turmas afetadas, depois de resolver conflitos, por outra pessoa da Gerência Pedagógica/Administração. Afeta F07.3 e versionamento da configuração; não há aplicação por turma/grupo nem sobrescrita silenciosa de exceções ou histórico.

### Bloco de indisponibilidade e continuidade docente — Q39/Q40 respondidas

Enviadas e respondidas em 09/09/2026, ambas com opção A; as demais alternativas permanecem como histórico.

#### Q39 — Como registrar férias, licença ou outra indisponibilidade de um professor?

O calendário da escola continua único; esta decisão trata apenas da disponibilidade daquele professor. Novas turmas, remarcações e particulares precisam conferir esses períodos. Se já houver aulas publicadas no intervalo, mostrar os encontros afetados; registrar a ausência não cancela aulas nem troca o professor silenciosamente.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Professor solicita período/motivo; Secretaria/gestão também podem registrar. Outra pessoa da Gerência Pedagógica/Administração aprova. Novos agendamentos ficam bloqueados no período aprovado e aulas existentes entram em pendência para solução aprovada |
| B | Somente Secretaria/gestão registram, a partir da informação do professor fora do ERP; outra pessoa da Gerência Pedagógica/Administração aprova. Bloquear novos agendamentos e acompanhar a solução das aulas existentes |
| C | Bloqueio provisório desde a solicitação do professor/equipe. Aprovação mantém o bloqueio; rejeição o remove. Aulas existentes exigem solução aprovada |

**Situação: respondida — opção A.** Solicitação de professor/equipe e aprovação de outra pessoa da Gerência Pedagógica/Administração; bloquear novos agendamentos no período aprovado e acompanhar solução das aulas existentes. Afeta F07.2/F07.3/F07.6; não cria outro calendário letivo nem substitui aprovações de alterações da agenda.

#### Q40 — Quem assume a avaliação de uma reposição gravada quando o professor designado estiver ausente ou tiver saído?

Q13 atribui avaliação, correções e confirmação ao professor designado. Preservar avaliações anteriores com seus autores; substituto acessa somente a reposição necessária e recebe autoria apenas pelos próprios atos. Conservar prazos do aluno, salvo prorrogação registrada conforme Q35.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Gerência Pedagógica/Administração designa outro professor com motivo; substituto recebe acesso limitado à reposição e continua a avaliação, preservando autoria e histórico |
| B | Secretaria/gestão propõe outro professor; outra pessoa da Gerência Pedagógica/Administração aprova a designação antes de liberar a avaliação |
| C | Gestão pode designar outro professor ou integrante autorizado da gestão como avaliador, com motivo e acesso limitado; amplia a regra de Q13 |

**Situação: respondida — opção A.** Gestão designa outro professor, com motivo, acesso limitado e preservação do histórico e dos prazos. Afeta F07.6/F07.7; a regularização de pendência de aula de Q24 continua distinta dessa avaliação.

### Bloco de configuração da turma e comunicação — Q37/Q38 respondidas

Enviadas e respondidas em 09/09/2026. Q37: opção B. Q38: opção A com complemento do usuário, acrescentando e-mail quando cadastrado. As demais alternativas permanecem como histórico.

#### Q37 — A turma pode ter duração ou frequência de aulas diferente da configuração da modalidade?

A modalidade define duração e frequência; a quantidade de aulas por nível determina a previsão de término. Q37 permite valores próprios por turma mediante proposta justificada e aprovação independente antes da publicação. Alterações de agenda já publicada mantêm aprovação e conferência de conflitos.

| Opção | Tratamento |
|---|---|
| A | Seguir sempre a modalidade: turma herda duração/frequência sem alteração local; mudanças ocorrem na configuração da modalidade e no replanejamento aprovado das turmas afetadas |
| B — Escolhida | Permitir exceção aprovada por turma: herdar os valores, mas permitir proposta justificada de duração/frequência diferentes; outra pessoa da Gerência Pedagógica/Administração aprova antes da publicação |
| C | Permitir escolha na criação: Secretaria/gestão podem ajustar duração/frequência ao criar; após publicação, alterações exigem aprovação independente |

**Situação: respondida — opção B.** Exceção justificada aprovada por outra pessoa da Gerência Pedagógica/Administração antes da publicação. Afeta F07.2/F07.3; não muda a meta por quantidade de aulas nem autoriza conflito docente.

#### Q38 — Como avisar alunos e responsáveis quando uma alteração de agenda for aprovada e aplicada?

Comunicar a versão efetivamente publicada e consolidar mudanças, evitando uma mensagem por encontro alterado. Selecionar apenas destinatários vinculados e autorizados a receber informações pedagógicas. Se o canal automático escolhido estiver indisponível ou não houver destinatário autorizado, gerar pendência para a Secretaria. Os avisos docentes de presença/gravação continuam dentro do ERP, conforme Q22.

| Opção | Tratamento |
|---|---|
| A — Escolhida com complemento | ERP, WhatsApp institucional e e-mail se cadastrado: equipe acompanha no ERP; alunos/responsáveis autorizados recebem aviso consolidado após a aplicação, pelo WhatsApp e também por e-mail quando cadastrado, com registro por canal |
| B | ERP e e-mail: equipe acompanha no ERP; alunos/responsáveis autorizados recebem aviso consolidado por e-mail, com registro dos envios; inclui integração de e-mail |
| C | ERP e comunicação manual pela Secretaria: ERP gera pendência com as mudanças aprovadas; Secretaria comunica pelo canal institucional e registra a comunicação, sem envio externo automático |

**Situação: respondida — opção A com complemento do usuário.** Inclui e-mail cadastrado como canal adicional ao WhatsApp institucional. Afeta comunicação de F07.1/F07.3 e exige integração dos envios com acompanhamento no ERP; não amplia a área autenticada de Q33 para responsáveis nem autoriza envios durante este refinamento.

### Bloco de prazos e acesso — Q35/Q36 respondidas

Enviadas e respondidas em 09/09/2026, ambas com opção A; as demais alternativas permanecem como histórico.

#### Q35 — Prazos para entrega e correções

Material deve estar realmente disponível para iniciar contagem. Professor designado avalia; nenhuma quantidade de dias presumida.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Prazo configurável para primeira entrega e para responder a cada correção; gestão autoriza prorrogação com motivo |
| B | Entregar/corrigir até encerramento acadêmico do nível, com prorrogação excepcional autorizada |
| C | Sem prazo automático enquanto matrícula estiver ativa; manter acompanhamento |

**Situação: respondida — opção A.** Registrar disponibilidade do material, entrega/correção e prorrogações com motivo, autor e datas.

#### Q36 — Área de reposições durante pausa ou após encerramento

Distinguir consulta histórica de envio. Preservar entregas e avaliações; gravações permanecem sujeitas ao contrato e às restrições de acesso às aulas já aprovadas. Nenhuma opção libera bloqueio por conta própria.

| Opção | Tratamento |
|---|---|
| A — Escolhida | Histórico em leitura; envio somente por liberação da gestão para pendência específica, com motivo/prazo. Novos pedidos dependem de matrícula ativa |
| B | Permitir terminar resumo/atividade e correções de reposições gravadas já aprovadas enquanto prazo válido; sem novos pedidos ou novas particulares |
| C | Bloquear a área na pausa/encerramento, preservando dados internamente; reabrir após retomada/ativação aprovada |

**Situação: respondida — opção A.** Histórico em leitura durante pausa/encerramento; entregas exigem liberação da gestão para pendência específica, com motivo/prazo. Novos pedidos dependem de matrícula ativa. Aplicar em F07.6/F07.7 sem alterar por essa liberação as aprovações de retomada ou as restrições de acesso às gravações.

### Bloco de entrega e falta de gravação — Q33/Q34 respondidas

Enviadas e respondidas em 09/09/2026, ambas com opção A; demais alternativas ficam como histórico. Q33 inclui identidade/permissões do aluno para o fluxo de reposições (F07.7, recorte de F13); Q34 inclui solução excepcional aprovada quando faltar gravação. Implementação pendente.

#### Q33 — Como o aluno entrega resumo e atividade?

O professor designado avalia e pede correção conforme Q13. Definir como a entrega entra no ERP; nas opções manuais, distinguir autoria do aluno e pessoa que cadastrou o material.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Área autenticada do aluno: suas reposições, link de gravação, envio de resumo/atividade e acompanhamento de avaliação/correções. Inclui acesso do aluno para esse fluxo |
| B | Secretaria recebe pelo canal institucional e registra em nome do aluno; professor designado avalia; preservar remetente e cadastrador |
| C | Professor recebe pelo canal institucional e registra entrega de aluno sob sua responsabilidade; avaliação segue o designado, preservando autoria/datas |

**Situação: respondida — opção A.** Área autenticada do aluno para reposições e entregas. Q22 continua com avisos docentes dentro do ERP; não foram escolhidos envios externos automáticos.

#### Q34 — Reposição quando não existe gravação recuperável

Q07 permite concluir aula sem gravação por exceção, mas aluno ausente ainda pode precisar repor, mesmo com plano sem particular ou sem saldo. Solução deve corresponder ao conteúdo perdido. Particular excepcional fora do benefício é uma nova exceção, exigindo justificativa e aprovação de outra pessoa da Gerência Pedagógica/Administração.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Gestão escolhe gravação substituta equivalente com resumo/atividade ou particular excepcional sem consumir benefício e sem cobrança adicional; registrar escolha e motivo |
| B | Sempre gravação substituta preparada/selecionada pelo professor e validada pedagogicamente, com resumo/atividade; sem exceção para particular fora do plano/saldo |
| C | Sempre particular excepcional aprovada, sem consumir benefício e sem cobrança adicional; registrar indisponibilidade da gravação como causa |

**Situação: respondida — opção A.** Gestão escolhe gravação substituta equivalente ou particular excepcional aprovada, sem consumo/cobrança adicional, identificando motivo e escolha. Fora dessa causa, particular mantém plano e saldo exigidos.

### Bloco de encerramento e indisponibilidade — Q31/Q32 respondidas

Enviadas e respondidas em 09/09/2026, ambas com opção A; demais alternativas ficam como histórico. Este bloco detalha F07.5 sem alterar dias reais, regra contratual do último dia, multa, crédito e aprovação independente.

#### Q31 — Encerramento pode ter data anterior ao pedido?

Registrar data solicitada e data de entrada do pedido no ERP. Financeiro prepara e outra pessoa autorizada aprova conforme Q18; demora interna não muda a data efetiva aprovada. Inclusão/exclusão do dia continua conforme contrato, em Q28.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Normalmente data solicitada igual/posterior ao pedido; data anterior somente por exceção com motivo, evidências e aprovação explícita no acerto |
| B | Não admitir data anterior ao registro do pedido, mesmo que o aluno informe saída anterior |
| C | Admitir retroatividade somente dentro de janela prevista no contrato e configurada no ERP; aprovação independente do acerto permanece |

**Situação: respondida — opção A.** Data retroativa exige motivo, evidências e aprovação explícita. Nenhum prazo retroativo numérico foi presumido.

#### Q32 — Cobrança sem turma disponível para continuidade

Exemplo: aluno termina A1 e quer A2, mas a escola não consegue oferecer turma compatível. Diferenciar indisponibilidade da continuidade de feriados/recessos planejados. A mensalidade permanece integral; a pergunta trata da emissão de novos períodos, sem apagar cobranças ou pagamentos anteriores.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Registrar indisponibilidade e impedir novas mensalidades para períodos sem oferta; retomar continuidade após regularizar oferta e condições da matrícula |
| B | Manter emissão integral somente com reserva prevista no contrato e manutenção confirmada pelo aluno; sem isso, suspender nova emissão |
| C | Secretaria combina turma alternativa ou pausa formal com o aluno pelos fluxos existentes; bloquear novas mensalidades enquanto a solução estiver pendente |

**Situação: respondida — opção A.** Suspender novas mensalidades dos períodos sem oferta e retomar após regularização. Não presumir ajustes/estornos de cobranças anteriores nem converter automaticamente em encerramento solicitado.

### Bloco financeiro — Q28–Q30 respondidas

Enviadas e respondidas em 09/09/2026: Q28/Q29 com opção C e Q30 com opção A. Demais alternativas ficam como histórico das opções não escolhidas. Este bloco detalha F07.5; implementação pendente.

#### Q28 — O dia efetivo de encerramento entra no proporcional?

Definir o significado da data para evitar diferença de um dia no cálculo. A data efetiva aprovada prevalece sobre eventual demora administrativa.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Incluir o dia: data de encerramento é o último dia ativo; dia seguinte fica fora da cobrança |
| B | Não incluir o dia: data de encerramento é o primeiro dia inativo; cobrar até o anterior |
| C | Conforme regra do contrato: permitir ambas as formas, identificando a aplicável e o último dia coberto |

**Situação: respondida — opção C.** Inclusão/exclusão segue contrato e o ERP mostra o último dia coberto; retroatividade foi definida em Q31.

#### Q29 — Como destinar crédito apurado no encerramento?

Após proporcional, multa e recebimentos, pode sobrar crédito. Preservar recebimento original; apuração do crédito e execução de devolução são operações distintas, registradas pelo Financeiro.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Aluno escolhe devolução ou crédito futuro; registrar escolha e execução/confirmação pelo Financeiro |
| B | Todo saldo credor segue para devolução pelo Financeiro, com registro da execução |
| C | Manter crédito para uso futuro até pedido de devolução; Financeiro processa e registra quando solicitado |

**Situação: respondida — opção C.** Crédito fica disponível para uso futuro; devolução depende de solicitação do aluno e processamento registrado pelo Financeiro. Apurar crédito não equivale a devolver dinheiro.

#### Q30 — Continuidade após o cronograma inicial de mensalidades

O código atual gera quantidade finita de meses na ativação. Definir continuidade de matrícula ativa sem duplicar mensalidade na passagem de nível ou gerar extensão por pendência de diário. Em todas as opções, respeitar o contrato; aulas ainda previstas não constituem por si só autorização de renovação.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Gerar próximos períodos integrais automaticamente quando houver continuidade prevista no contrato e matrícula ativa, respeitando pausa/encerramento; sem previsão, solicitar renovação |
| B | Exigir novo aceite de renovação em todo novo ciclo antes de gerar mensalidades adicionais, mesmo havendo previsão de continuidade |
| C | Financeiro propõe extensão manual e outra pessoa autorizada aprova, com previsão/aceite contratual registrado; sem geração automática além do cronograma inicial |

**Situação: respondida — opção A.** Continuidade automática depende de previsão contratual e matrícula ativa, respeitando pausa/encerramento; sem previsão, solicitar renovação. Q32 suspende novas mensalidades dos períodos sem oferta.

### Bloco da reposição individual — Q25–Q27 respondidas

Enviadas e respondidas em 09/09/2026, todas com a opção A. Opções B/C ficam como histórico de alternativas não escolhidas. Este bloco detalha F07.6; implementação pendente.

#### Q25 — Saldo de particulares não utilizado acumula?

A quantidade e o período são configuráveis. Esta pergunta trata do saldo livre não utilizado nem reservado ao terminar o período; não autoriza apagar agendamentos já aprovados.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Não acumular: saldo livre expira no fim do período; cada período tem sua própria quantidade |
| B | Acumular com quantidade máxima e validade configuradas no plano |
| C | Acumular enquanto a matrícula estiver ativa, sem prazo de expiração ou teto específico |

**Situação: respondida — opção A.** Saldo livre não acumula; reservas existentes continuam identificadas e não são apagadas pela mudança do período.

#### Q26 — A qual período pertence a reposição particular?

Exemplo: falta em agosto, pedido em setembro e particular em outubro. A decisão define a cota de referência. O agendamento reserva benefício; remarcação não duplica utilização nem desfaz automaticamente consumo já registrado por falta ou cancelamento tardio.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Período da particular agendada. Mudar reserva ainda não consumida para outro período libera a anterior e reserva a nova, conferindo saldo antes de confirmar |
| B | Período da aula perdida. Pedido e remarcação preservam a referência à falta original |
| C | Período do registro do pedido. Agendamento e remarcação preservam essa referência |

**Situação: respondida — opção A.** Usar o período da particular agendada; transferir reserva não consumida com conferência de saldo, preservando a anterior se a nova não puder ser confirmada.

#### Q27 — Reposição concluída conta no critério de frequência?

Manter a falta original no histórico e a exibição “Reposta em [data]”. Cada aula perdida pode ser regularizada uma única vez, sem aumentar o número de aulas da turma. Frequência não substitui outros critérios de avaliação/progressão ainda a definir.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Particular concluída e gravação com entrega aprovada regularizam a frequência; distinguir presença original e regularização por reposição |
| B | Somente particular regulariza frequência; gravação aprovada registra conteúdo reposto sem compensar a ausência no percentual acadêmico |
| C | Nenhum formato altera o percentual de frequência original; ambos registram apenas recuperação de conteúdo |

**Situação: respondida — opção A.** Ambos os formatos concluídos regularizam frequência, distinguindo presença original e reposição. Nenhum percentual mínimo de aprovação acadêmica foi presumido.

### Bloco do diário — Q22–Q24 respondidas

Enviadas e respondidas em 09/09/2026, todas com a opção A. As opções B/C ficam como histórico de alternativas não escolhidas. As regras estão aprovadas, mas sua implementação permanece pendente em F07.4.

#### Q22 — Como cobrar pendências de presença e gravação do professor?

A pendência nasce após o fim do horário previsto. A aula continua prevista até cumprir os requisitos; atraso no lançamento não gera reposição nem cobrança financeira. Proposta para as três opções: prazo de regularização e intervalo de lembretes configuráveis, aviso ao professor e alerta à Gerência Pedagógica quando o prazo vencer. Nenhum prazo numérico presumido.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Avisos dentro do ERP: professor recebe pendências/lembretes no sistema; gestão recebe alerta de prazo vencido e acompanha o painel |
| B | ERP e WhatsApp institucional: painel e lembretes ao professor por WhatsApp; gestão acompanha no ERP. Exige incluir destinatários e regras de envio |
| C | ERP e e-mail: painel e lembretes ao professor por e-mail; gestão acompanha no ERP. Exige incluir serviço de e-mail |

**Situação: respondida — opção A.** Avisos e acompanhamento dentro do ERP, com prazo/intervalo configuráveis e alerta à gestão após vencimento.

#### Q23 — Como corrigir aula já concluída como ministrada?

Exemplos: presença incorreta, conteúdo ou link de gravação. Preservar valor anterior/novo, motivo e autoria; conferir efeitos na frequência e reposições vinculadas. O professor que deixou a turma mantém o histórico somente leitura.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Toda correção exige aprovação: professor responsável ainda vinculado ou equipe autorizada propõe; outra pessoa da Gerência Pedagógica/Administração aprova e publica a correção |
| B | Professor ainda vinculado pode corrigir conteúdo/link dentro de janela configurável, com histórico; presença ou mudança fora da janela exige aprovação independente |
| C | Somente Gerência Pedagógica/Administração prepara correção no ERP e outra pessoa autorizada aprova; professor comunica o erro à gestão |

**Situação: respondida — opção A.** Toda correção exige proposta e aprovação independente; professor desvinculado mantém histórico somente leitura.

#### Q24 — Quem regulariza pendência após saída do professor?

Preservar o professor original da aula e identificar separadamente quem regularizou o registro. Usar registros disponíveis para conferir lançamentos. Ausência de gravação recuperável continua exigindo a exceção de Q07, com justificativa e decisão de outra pessoa autorizada. A regularização não permite inventar presença ou realização de aula sem evidência.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Gestão designa professor ou integrante autorizado da gestão com acesso limitado àquela aula, motivo e histórico da designação; vínculo da turma não é transferido |
| B | Gerência Pedagógica/Administração regulariza diretamente com evidências; não delega a outro professor |
| C | Somente Administração regulariza; gestão pedagógica fornece as informações |

**Situação: respondida — opção A.** Designação pela gestão dá acesso limitado àquela pendência e preserva autoria original. Corrigir aula concluída segue Q23; designação não dispensa aprovação de exceções.

### Bloco do calendário — Q19–Q21 respondidas

As três perguntas abaixo foram enviadas e respondidas em 09/09/2026, todas com a opção A. As opções B/C são mantidas apenas como histórico das alternativas não escolhidas. Este bloco detalha F07.1–F07.3; diário, reposição individual e financeiro mantêm suas pendências específicas.

#### Q19 — Aula excepcional em feriado, recesso ou férias da escola

A regra normal pula dias não letivos. A eventual exceção se refere a um encontro específico e não transforma o dia em letivo para toda a escola. Nas opções que permitem exceção, exigir justificativa, aprovação de outra pessoa da Gerência Pedagógica/Administração e verificação de conflito docente.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Permitir encontro excepcional justificado, inclusive reposição ou particular, mantendo as demais turmas no calendário normal |
| B | Não permitir nenhuma aula nesses dias; encontrar uma data letiva disponível |
| C | Permitir apenas reposições de aulas perdidas/canceladas; aulas regulares novas continuam impedidas |

**Situação: respondida — opção A.** A exceção não cria calendários separados por turma ou país.

#### Q20 — Alteração de feriado/recesso com agendas já publicadas

Exemplo: acrescentar recesso em uma semana com aulas previstas exige reorganizar encontros, verificar conflitos e mostrar o término previsto. Aulas ministradas e registros passados são preservados. Nas três propostas, o calendário continua único; a alteração e as remarcações só entram em vigor após as aprovações necessárias e a resolução dos conflitos.

| Opção | Tratamento |
|---|---|
| A — Recomendada | ERP sugere novas datas para todas as turmas afetadas; equipe revisa/ajusta e outra pessoa autorizada aprova o conjunto |
| B | ERP sugere novas datas; cada turma recebe decisão individual e a alteração global aguarda todas as decisões necessárias |
| C | Equipe escolhe manualmente as novas datas; ERP confere conflitos e término; outra pessoa autorizada aprova o conjunto |

**Situação: respondida — opção A.** O sistema prepara uma proposta automática revisável e submete o conjunto à aprovação independente; conforme Q21, aprovação aplica a proposta se continuar válida e sem conflitos.

#### Q21 — Quem efetiva alterações aprovadas de calendário/agenda

Organização pela Secretaria/gestão e aprovação independente da Gerência Pedagógica/Administração já estão definidas. Falta escolher se a aprovação efetiva a mudança ou se há execução posterior. Em qualquer opção, conflitos ou mudanças relevantes exigem nova conferência antes de aplicar. Q11 continua regendo a reposição individual, com autorização da gestão e agendamento pela Secretaria.

| Opção | Tratamento |
|---|---|
| A — Recomendada | Aprovação independente efetiva a proposta revisada se continuar válida; Secretaria acompanha o resultado |
| B | Proposta fica aprovada aguardando execução; Secretaria confere e efetiva a versão autorizada |
| C | Proposta aprovada aguarda uma pessoa da Administração para efetivação |

**Situação: respondida — opção A.** Aprovação independente aplica a proposta válida; Secretaria acompanha o resultado sem nova etapa de execução. Proposta que ficou conflitante ou sofreu mudança relevante exige nova conferência.

### Demais detalhes por entrega

Os itens abaixo permanecem no refinamento da entrega correspondente. Quantidade/período de particulares, prazo de cancelamento e parâmetros da multa contratual já foram escolhidos como configuráveis; não precisam virar políticas fixas nem receber valores inventados para preparar a issue. Os critérios de aceite devem exigir configuração válida antes da operação.

- Valores configuráveis do prazo/intervalo de pendência docente; avisos internos e alerta à gestão já definidos em Q22.
- Q42–Q48 fecharam alcance das mudanças da meta, rascunho sem professor, referência temporal/geração e início/conclusão da turma. Conferir dados legados, marco temporal e integração das versões sem confundir status de turma com conclusão de aula.
- Preparação técnica dos avisos: Q38 definiu ERP, WhatsApp institucional e e-mail quando cadastrado; integrar destinatários autorizados, consolidação, registro por canal, prevenção de duplicação e pendências de falha. Execução da alteração aprovada já foi definida em Q21.
- Integrar disponibilidade individual aprovada de Q39 à agenda e ao acompanhamento das aulas afetadas, sem outro calendário letivo. Exceções em dias não letivos da escola seguem Q19 e continuam conferindo a disponibilidade individual.
- Q53 definiu chamada histórica por vínculo/situação na data da aula, inclusive depois de transferência, pausa ou saída; integrar dados temporais e conferência do legado sem ampliar acesso docente.
- Q57/Q58 definiram relato pelo aluno/equipe, conferência da gestão e pausa/retomada do tempo restante durante indisponibilidade confirmada. Preservar conclusão da aula e manter Q23/Q24/Q34.
- Q49–Q61 fecharam benefícios/cotas, tentativas, prazos, chamada histórica/frequência, correções/data da reposição, substituição docente e material indisponível. Consolidar execução e casos de legado, mantendo contrato de integração da troca de plano e aprovações; progressão pertence a F09.
- Integração da indisponibilidade de oferta com a geração recorrente: aplicar Q32, manter histórico e impedir cobranças retroativas dos períodos suspensos; política já definida.
- Preparação do acerto por matrícula: integrar regras já aprovadas de data efetiva, inclusão contratual do dia, multa, crédito/devolução e aprovação independente ao código atual; conservar evidências e valores pagos.
- Migração do financeiro e agenda existentes, conservando evidência e sem presumir cálculos históricos.

### Preparação da migração de planilhas reais — Q84

**Objetivo informado:** aproveitar o máximo de dados reais das planilhas para iniciar a produção com uma base real. Após o [checklist de dados por prioridade](checklist-dados-migracao.md), a primeira planilha foi [analisada em 10/09/2026](analise-planilha-operacional-leticia.md): cadastros aproveitáveis e histórico/financeiro parcial, com divergências e complementos identificados. Isso não significa preencher campos ausentes com valores presumidos. A base atual do ERP não foi classificada, e não se presumem registros descartáveis.

**Alcance do código lido em 09/09/2026:** os importadores de [alunos](../../src/app/api/alunos/importar/route.ts) e [turmas](../../src/app/api/turmas/importar/route.ts) aceitam XLSX para administrador ativo, conferido no banco, e gravam cada linha em sua própria transação, com evento e relatório de erros. As rotas leem a primeira aba e têm limites atuais de arquivo/linhas; esses limites são implementação existente, não novos parâmetros aprovados para a migração.

| Evidência atual | Implicação para a migração |
|---|---|
| Alunos: cadastro individual; status ATIVO fixado e aceitaComunicacoes recebe true quando o campo não está informado | Isso não comprova situação real da matrícula, aceite contratual, pagamento confirmado ou autorização de comunicação. Mapear valores/evidências das fontes e tratar ausências; importação não pode autorizar disparos por inferência |
| Turmas: modalidade/nível existentes, professor opcional, datas inicial/final informadas, status PLANEJADA e vínculo docente sincronizado | Não gera o novo calendário nem importa histórico de aulas, presenças, alocações ou todas as datas de vínculos anteriores. Integrar rascunho/publicação, temporalidade e regras de F07 |
| As duas rotas geram novos códigos e criam por linha; não apresentam identificador de lote/origem nem prévia de conciliação nesse fluxo | Não comprova reexecução sem duplicação. Preparar identificação estável da origem, correspondência de registros, prévia e retomada segura de lotes |
| As rotas lidas não criam contratos, matrículas, cobranças, recebimentos ou créditos históricos | Importação cadastral não equivale à carga acadêmica/financeira completa; delimitar conjuntos após Q85 e preservar vínculos/origens |

**Corpo em preparação da entrega transversal:** vincular esta migração às entidades importadas e à homologação/entrada em produção de F05, sem atribuir um novo número de issue GitHub ou considerar F07.1–F07.7 entregues.

1. Inventariar arquivos, abas, cabeçalhos, datas de referência, volume, identificadores e responsável pela fonte. Manter correspondência de origem e separar data do fato histórico de data/autor da importação.
2. Mapear campos e relações em prévia sem disparos ou geração de cobranças/aulas. Exibir o que seria criado, vinculado, rejeitado ou depende de conferência; mostrar campos desconhecidos, ambíguos e transformações necessárias.
3. Definir correspondência e prevenção de duplicidades de alunos/responsáveis, matrículas, turmas e demais conjuntos efetivamente disponíveis. Nome igual não prova mesma pessoa; nova importação do mesmo lote não duplica cadastros, pagamentos, saldos ou eventos operacionais.
4. Conferir lacunas temporais, contratos e evidências. Não inventar aulas ministradas, presenças, vínculos antigos, períodos cobertos, pagamentos ou consentimentos. Estado importado do aluno não ativa matrícula nem satisfaz requisitos financeiros/contratuais por si só.
5. Se houver financeiro, conciliar por aluno/matrícula/cobrança os valores de origem, recebimentos, saldos e créditos, com totais e diferenças rastreáveis. Preservar registros originais e regras de aprovação aplicáveis; não relançar pagamento nem aplicar crédito sem correspondência/conferência.
6. Ensaiar a carga em ambiente controlado, com acesso adequado aos dados reais, relatório por lote e validação pelos responsáveis dos conjuntos. Dados fictícios de teste devem permanecer distinguíveis; a entrada em produção exige um plano concreto, sem limpeza destrutiva implícita.
7. Preparar data de corte e tratamento das mudanças nas planilhas entre ensaio e carga final. Habilitar rotinas futuras apenas após conciliação, evitando cobrança duplicada, geração de aulas passadas fictícias, convites ou lembretes históricos disparados pela importação.
8. Definir critérios de homologação e recuperação antes da produção: contagens e totais conferidos, relações válidas, pendências identificadas, consultas por papel e reexecução sem duplicação. “Base real” deve ser demonstrada por rastreabilidade/conferência; não declarar 100% de completude sem confrontar as fontes.

**Evidências da primeira fonte, em 10/09/2026:** 76 datas de entrada são explicitamente provisórias; 25 alunos inativos mantêm vínculo histórico ativo sem saída; parte dos meses Pago não tem valor/data no campo mensal e pode representar antecipação. Há 15 cadastros Por hora, antecipações de curso/ano, empresa pagadora e permuta. Os modelos comerciais e suas condições precisam ser delimitados antes da carga financeira; não são automaticamente reposições individuais nem aprovação de todo F20. Dos 49 dias de vencimento preenchidos, 39 não cabem nas opções atuais do schema da matrícula: adaptar a implementação às condições verificadas, preservando os vencimentos reais. O relatório detalha células e pedidos por equipe.

Continuar pelos complementos de alunos, matrículas/turmas e financeiro, aproveitando observações e outras fontes sem exigir reorganização manual prévia. O primeiro arquivo foi examinado somente em leitura; não há importação executada, eliminação de testes ou alteração de produção por este levantamento.

### Mapa de fechamento antes de iniciar a implementação

Orientação recebida em 09/09/2026: continuar o refinamento para não deixar os pontos necessários desta frente sem definição antes de implementar. Este mapa organiza o que falta; não transforma hipóteses em regras aprovadas e não garante ausência de novas dúvidas quando os cenários forem conferidos. As perguntas serão enviadas em blocos, com pelo menos três alternativas por decisão de negócio.

| Frente | Decisões/cenários ainda a fechar | Preparação técnica e evidência exigida |
|---|---|---|
| Calendário e formação da turma — F07.1/F07.2/F07.3 | Regras de Q42–Q48 e substituição temporária de Q56 respondidas; consolidar cenários de execução/legado | Distinguir rascunho/publicação/status acadêmico; datas/intervalos/fuso; revisão do conjunto completo, versão da modalidade e exceções; atribuição docente por encontro, conflitos e conversão do legado |
| Chamada e gravações — F07.4 | Lista histórica, material/prazo e frequência sob restrição definidos em Q53/Q57/Q58/Q59; consolidar cenários de execução | Preservar vínculo temporal/autoria, informação docente sem financeiro, correções/material e frequência/reposições sem apagar histórico |
| Benefícios e reposições — F07.6 | Regras de Q49–Q61 respondidas; consolidar casos de fronteira e contrato de integração com troca de plano | Cota, reserva, consumo e devolução sem duplicação; versões de plano/entregas; uma regularização por falta original; revalidar avaliador/autorização e indisponibilidade do material |
| Mensalidades e encerramento — F07.5 | Q62–Q71/Q83 respondidas; consolidar cálculo e cenários de compensação/encerramento | Memória de cálculo/arredondamento; origem dos dias e prevenção de ajuste duplicado; cláusula/versionamento do contrato; conciliação sem apagar recebimentos; coberturas/ajustes/usos/devoluções/consolidação autorizados; limites de períodos e concorrência |
| Área do aluno — F07.7 | Q72–Q74/Q77/Q79/Q81/Q82 respondidas; reprodução no ERP sem conta Google, sem download/offline | Player e transmissão autenticada a partir do Drive compartilhado; autorização/revogação por material e requisição, versões, compatibilidade e falhas; medir desempenho, capacidade e custos antes de operar |
| Comunicação — F07.1/F07.3 e integrações | Q38 define canais, Q78 escolhe Resend e Q80 informa geniusidiomas.com; preparar responsável/acesso ao DNS, remetente/destino de respostas e plano conforme capacidade | Destinatários autorizados, consolidação, fila/eventos por canal; verificação real de domínio, limites e falhas/retentativas sem duplicação; separar envio/entrega e comprovar integração antes de operar |
| Particulares contratadas e condições comerciais | Q86–Q102 respondidas; revisão dirigida e corpos B01/B02/P01/P02 consolidados, incluindo ativação própria, parcial aprovado e seleção de contratos | Revisar os corpos propostos e a integração com vínculos/estados por matrícula; depois criar issues e implementar com os critérios de aceite. Separar do benefício de F07.6 |
| Dados existentes e entrada em operação — transversal | Q84 informou planilhas reais antes da produção; após o [checklist](checklist-dados-migracao.md) de Q85, primeira fonte [analisada em 10/09/2026](analise-planilha-operacional-leticia.md). Usuário priorizou decisões de funcionamento e retomará complementos depois. Importadores atuais cobrem alunos/turmas, não a carga completa | Correspondência das fontes, prévia, deduplicação, temporalidade e conciliação; preservar condições/vencimentos reais; ensaio, corte e carga final rastreáveis sem disparos/geração indevidos; homologação por conjunto sem inventar histórico |
| Fechamento das issues — pacote consolidado | [14 corpos preparados](revisao-integracao-corpos-entregas.md), preservando F07.1–F07.7 e separando bases compartilhadas, particulares/permuta, comunicação, migração e validação | Revisar o pacote antes de criar as issues; implementação local, integração homologada e operação real continuam distintas. F09/F10 completos, F13 completo, F16/F19/F20 completos permanecem fora do recorte |

Os itens agrupados ainda precisam de análise; não correspondem necessariamente a uma pergunta cada. Uma condição já respondida será ligada à decisão existente; uma escolha técnica será especificada e justificada; uma nova regra de negócio será perguntada. Quantidades e prazos configuráveis não receberão valores inventados. Novos critérios de progressão, portal completo de responsáveis, venda avulsa de particulares, folha docente e presencial continuam fora deste recorte até inclusão explícita.

## 9. Condição para criar as issues

Conforme orientação do usuário em 09/09/2026, concluir o refinamento necessário desta frente antes de iniciar sua implementação. Fechar corpo, critérios de aceite, permissões, estados, exceções, integrações e tratamento do legado das entregas previstas; usar o mapa de fechamento para não deixar decisão necessária sem responsável ou encaminhamento. Escolhas de negócio serão apresentadas com alternativas e registradas; detalhes técnicos devem ter proposta verificável, sem virar aprovação de regra de negócio por silêncio. Expansões que permaneçam fora do recorte devem ser explicitamente identificadas, sem serem consideradas entregues ou descartadas. Criar issues somente após os respectivos corpos e dúvidas estarem fechados.

Os docs de implementação D01–D14 permanecem como evidências do que já foi entregue. Este arquivo registra especificação em refinamento; F07 e as ampliações de diário/financeiro aqui descritas continuam pendentes de implementação.
