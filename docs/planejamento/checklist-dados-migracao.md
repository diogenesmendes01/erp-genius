# Dados para preparar a migração da escola

**Preparado em 09/09/2026, a pedido do usuário em Q85; atualizado em 10/09/2026.** Objetivo: aproveitar o máximo de dados reais disponíveis antes de iniciar a produção. Esta é uma lista de levantamento, não um formato já suportado integralmente pelo importador.

**Primeira fonte recebida e analisada:** `Operacional Leticia (2).xlsx`, com sete abas, 106 alunos, 42 turmas, 89 vínculos iniciais e controle financeiro de julho a dezembro de 2026. A [análise da planilha](analise-planilha-operacional-leticia.md) compara cada conjunto deste checklist com a fonte e traz um pedido de complementos por equipe. Há datas provisórias, divergências de situação e pagamentos/antecipações a conciliar; contratos, diários e outros históricos ainda precisam de fontes complementares. O arquivo foi examinado em leitura, sem importação no ERP.

Podem ser utilizadas as planilhas atuais, mesmo com nomes de colunas diferentes ou informações distribuídas em arquivos. Não é necessário reorganizar tudo agora. Documentos e links existentes podem complementar as planilhas. Quando uma informação não existir, indicar “não disponível”; não criar datas, pagamentos, presenças ou aceites para completar campos.

## 1. Primeira prioridade: organizar a base operacional

| Conjunto | Dados a reunir, conforme existirem | Para que serão usados |
|---|---|---|
| Alunos | Código/identificador atual, nome completo, país, e-mail, telefone com DDI, fuso e situação conhecida. Data de nascimento, endereço e documento somente se já disponíveis e necessários ao cadastro | Identificar a pessoa correta e evitar duplicidades. Separar situação do aluno de situação da matrícula |
| Responsáveis e vínculos | Identificador do responsável e do aluno, nome, parentesco/tipo de vínculo, contatos e indicação de responsável legal, financeiro ou destinatário de avisos | Vincular corretamente cada pessoa e suas finalidades. Ser contato não comprova acesso ao portal ou autorização para todos os avisos |
| Equipe | Nome, e-mail institucional, função/papéis, ativo/inativo e turmas ou carteiras atendidas; datas de início/fim dos vínculos, se registradas | Preparar usuários, responsabilidades e visibilidade. Não importar senhas nem presumir aprovação de permissões só pelo cargo |
| Cursos, níveis, modalidades e planos | Nomes/códigos usados, idioma, ordem dos níveis, quantidade de aulas por nível, duração/frequência, modalidade e plano de cada oferta; condições e versões anteriores, quando houver | Relacionar a nomenclatura das planilhas ao catálogo e gerar agendas válidas. Campo ausente não recebe uma quantidade inventada |
| Turmas | Código/nome, curso/modalidade/nível, professor, dias da semana, início e duração/horário final, fuso, data inicial, situação, capacidade e término informado. Quantidade/meta e histórico de professores, se disponíveis | Reconstruir vínculos e preparar a agenda. Data prevista não comprova aula ministrada ou conclusão da turma |
| Matrículas e alocações | Código da matrícula, aluno, curso/plano/modalidade, turma, data de entrada na matrícula e na turma, situação e datas de pausa, retorno, transferência ou encerramento. Responsável financeiro e vendedor, se existentes | Relacionar contratos, alunos, turmas e cobranças sem criar uma nova matrícula para cada registro histórico |
| Contratos e condições | Contrato/modelo aplicável, versão/data, vínculo com a matrícula e evidência de aceite quando existente. Preço e moeda, taxa de matrícula, vencimento, cobertura mensal, descontos, continuidade, pausa/retorno e encerramento | Conferir regras de geração de cobranças e acerto. Um modelo de contrato não comprova o aceite de um aluno específico |
| Cobranças | Identificador, aluno/matrícula, tipo, moeda, valor-base, descontos/acréscimos, valor final, vencimento e situação. Competência e início/fim da cobertura, se registrados. Relação com cobrança substituída/cancelada, quando houver | Trazer valores devidos e períodos já emitidos sem gerar cobrança duplicada. Vencimento e cobertura são informações diferentes |
| Pagamentos/recebimentos | Identificador, cobrança(s) relacionada(s), valor e moeda, data efetiva, meio de pagamento, referência/comprovante existente e situação de conferência. Rateio entre cobranças e pagamentos parciais, se houver | Conciliar o que foi recebido. “Pago” sem data/valor suficiente será conferido; não inventar recebimento ou confirmação financeira |

**Condições contratuais que merecem identificação:** referência da cobertura (mês civil ou ciclo), possibilidade de continuidade automática, descontos e vigências, inclusão/exclusão do dia de encerramento, ordem do desconto no proporcional, multa fixa/percentual e sua base/cláusula. Podem ser extraídas dos documentos na preparação; não é necessário criar todas essas colunas manualmente agora. Se não constarem das fontes, ficam pendentes de definição/conferência aplicável.

## 2. Segunda prioridade: preservar histórico e pendências

| Conjunto | Dados a reunir, conforme existirem | Cuidado no aproveitamento |
|---|---|---|
| Saldos, créditos e devoluções | Aluno/matrícula, origem, valor/moeda, saldo restante, utilização, estorno/devolução, datas, cobrança de destino e evidências/decisões existentes | Não somar um saldo consolidado aos movimentos que já o compõem. Crédito apurado não é dinheiro devolvido |
| Aulas e frequência | Identificador do encontro, turma, início/fim e fuso, professor que ministrou, situação real, conteúdo, alunos elegíveis e presença/ausência registrada | Não gerar presenças a partir da turma atual nem transformar data passada em aula ministrada. Preservar autoria e vínculos históricos |
| Gravações e materiais | Link ou identificador do arquivo no Drive, aula/turma correspondente, data, descrição/conteúdo, versão ou substituição conhecida e indicação de indisponibilidade | Mapear a fonte privada para reprodução no ERP; não tornar os arquivos públicos. Acesso real e compatibilidade serão validados depois |
| Reposições individuais | Aluno, aula original, forma de reposição, pedido/autorização, data agendada/realizada, professor/avaliador, entregas, correções, avaliação e situação | Distinguir tentativa, falta, participação e validação. Vídeo assistido não equivale a reposição aprovada |
| Cotas de particulares | Plano/regra aplicável, período, cota, reservas, consumos, cancelamentos e devoluções de benefício | Se existir apenas saldo, conferir sua origem; não somar saldo inicial com consumos já considerados nele |
| Mudanças acadêmicas | Aluno/matrícula, turma/nível de origem e destino, datas efetivas, motivo, parecer e aprovações existentes | Preservar o que foi registrado sem fabricar uma aprovação antiga ou atribuir autoria ao importador |
| Pausas, retornos e encerramentos | Datas do pedido/registro/efeito, situação anterior, motivo, decisões e propostas financeiras/alterações de vencimento ou cobertura existentes | Não confundir pausa do aluno com falta de oferta da escola. Histórico incompleto exige conferência |
| Falta de oferta e compensações | Matrícula/período afetado, intervalo sem oferta, dias ou valor devidos, solução acordada, cobertura já recomposta e saldo de compensação | Evitar duplicação de cobertura, crédito ou ajuste de encerramento conforme Q67/Q70/Q83 |
| Calendário e disponibilidade | Fuso oficial, feriados/recessos/férias, aulas excepcionais/remarcadas e indisponibilidades docentes com decisões existentes | Diferenciar calendário escolar de ausência do professor e preservar encontros já realizados |

Os históricos enriquecem a migração quando existem. A ausência de um histórico não autoriza descartá-lo se houver outra fonte recuperável, nem exige fabricar registros. Primeiro serão identificados os dados disponíveis e os necessários para cada operação.

## 3. CRM, comunicação e registros complementares

| Conjunto | Dados a reunir, conforme existirem | Delimitação |
|---|---|---|
| Leads e negociações | Identificador, nome/contato, origem, interesse, etapa, vendedor/carteira, datas, próxima ação e vínculo com aluno/matrícula quando convertido | Evitar recriar o mesmo contato como pessoas distintas ou reabrir negociação concluída |
| Histórico de atendimento | Referência da conversa/contato, canal, datas, responsáveis e exportação existente, se disponível e pertinente | Migração de conversa completa depende do formato e da capacidade da integração; não está comprovada pelos importadores cadastrais |
| Preferências e autorizações de contato | Pessoa, canal, finalidade, permitido/recusado/desconhecido, origem/data do registro e eventual revogação | Ausência de informação não comprova autorização. Importação não inicia cadências, convites ou lembretes por si só |
| Documentos e comprovantes | Relação entre arquivo e aluno/matrícula/cobrança/aula, categoria, data e localização existente | Um link acessível à equipe não deve ficar automaticamente disponível a todos os papéis ou alunos |

Não é necessário incluir, nesta primeira preparação, despesas/folha docente, estrutura presencial ou contratos corporativos se não fizerem parte da entrada em operação combinada. Se houver esses dados, registrar sua existência para as frentes F16/F19/F20, sem declará-las incluídas ou implementadas por esta lista.

## 4. Informações que ajudam a conferir qualquer planilha

- Nome do arquivo e das abas, significado das colunas e quem pode esclarecer seu conteúdo.
- Data da última atualização e período histórico abrangido.
- Código que relaciona aluno, matrícula, turma, cobrança e pagamento. Se não existir código, manter a referência atual para conferência; não inventar correspondências por nome.
- Moeda dos valores, formato das datas e fuso dos horários. Não converter moedas ou interpretar datas ambíguas silenciosamente.
- Distinção entre dados reais, exemplos, rascunhos e registros cancelados.
- Indicação de fórmulas, totais, saldos consolidados e linhas de movimentação, para não contar a mesma informação duas vezes.
- Outras fontes que comprovem ou complementem o registro: contrato, comprovante, diário ou histórico anterior.

Para preparar a infraestrutura depois, serão necessários o responsável pelo DNS de geniusidiomas.com, remetente/destino de respostas e identificação do Drive compartilhado autorizado. Credenciais não fazem parte deste levantamento de dados.

## 5. Ordem sugerida de análise

**Prioridade ajustada pelo usuário em 10/09/2026:** discutir primeiro os modelos de funcionamento revelados pela planilha; retomar os dados faltantes depois. Os complementos não bloqueiam o refinamento. A conferência dos dados necessários continua sendo condição para migrar e habilitar cada operação em produção. As decisões novas estão nos [blocos Q86–Q99 do planejamento](f07-agenda-aulas.md); não há dispensa de conciliação ou autorização para completar campos por suposição.

1. Começar pelas planilhas atuais de **alunos, matrículas/turmas e financeiro**, junto da identificação dos cursos/planos e das pessoas responsáveis por esclarecer os dados.
2. Montar o mapa de origem → destino, registrar campos disponíveis/ausentes e apontar duplicidades ou inconsistências.
3. Identificar históricos e documentos complementares úteis, sem exigir reorganização manual prévia de todo o acervo.
4. Definir o escopo da carga e os critérios de conferência; preparar e ensaiar a importação depois que o corpo da entrega estiver fechado.
5. Conciliar dados, vínculos e valores e preparar corte/carga final antes de habilitar a operação real.

Ter uma base formada por dados reais e ter todos os campos preenchidos são condições diferentes. A completude será medida por conjunto e por operação necessária; pendências terão origem e tratamento explícitos. O recebimento da primeira planilha não comprova a existência dos demais conjuntos nem que a carga já possa ser executada sem adaptação e conferência.

Referências do projeto: [refinamento F07 e preparação da migração](f07-agenda-aulas.md), [relatório consolidado](../41-situacao-consolidada-do-projeto.md), [importador atual de alunos](../../src/app/api/alunos/importar/route.ts) e [importador atual de turmas](../../src/app/api/turmas/importar/route.ts).
