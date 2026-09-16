# SPEC-ERP-002 — Matrícula como unidade operacional

**Versão:** 1.80 — 14/09/2026. **Estado:** ativação de preparação em turma e particular integrada; B01 ainda não concluído. [Incremento, testes e limites](../planejamento/implementacao-b01.md). Base B01, consumida por B02, F07.2–F07.7, P01/P02, N01, M01 e V01.

## 1. Problema, decisão e resultado

Q102 permite selecionar um ou vários contratos numa solicitação de pausa/encerramento, mostrando e aprovando seus impactos, preservando os excluídos. O usuário confirmou que a matrícula precisa ser a âncora dos vínculos acadêmicos, cobrança, pausa e acesso. Não existe decisão de negócio pendente sobre esse isolamento.

Aluno representa a pessoa. Matrícula representa cada contratação operacional. Condições e evidências contratuais pertencem ao vínculo aplicável; não confundir o PDF assinado com a entidade operacional. Este desenho não exige separar cada nível em um contrato nem criar uma entidade jurídica genérica para contratos coletivos fora do escopo.

Resultado obrigatório: um aluno pode ter inglês mensal e particular por hora, com situações, saldos e direitos independentes. Pausar um preserva o outro. A ficha do aluno pode continuar consolidando informações autorizadas, identificando a origem por matrícula.

Fonte: [Q102 e demais decisões](../planejamento/f07-agenda-aulas.md), [B01 e revisão de integração](../planejamento/revisao-integracao-corpos-entregas.md), [SPEC central](erp-educacional.md). Esta SPEC detalha a identidade compartilhada; não substitui fórmulas financeiras ou regras acadêmicas desses documentos.

## 2. Diagnóstico histórico e evidência no código existente

Esta seção preserva o diagnóstico do fluxo legado que existia quando a
especificação foi escrita; ela não é um inventário completo do estado atual. A
revisão CRM/WhatsApp 598 corrige, em especial, a conclusão antiga sobre Q120 na
seção 2.1. As demais lacunas abaixo continuam a exigir evidência própria.

| Código | Situação e mudança necessária |
|---|---|
| [Aluno, Matricula, Cobranca e AlocacaoTurma](../../prisma/schema.prisma) | Alocação agora admite vínculo explícito com integridade de titular. Legado continua sem associação presumida e o enum da matrícula ainda não representa pausa. Demais relações e consumidores seguem pendentes. |
| [Unicidade da alocação](../../prisma/migrations/20260622120000_integridade_alocacao_preco/migration.sql) | Índice parcial permite somente uma alocação ativa por aluno. Substituir por integridade no vínculo correto após identificar matrículas, sem simplesmente retirar toda proteção. |
| [Pausa/encerramento](../../src/server/alunos/acoes.ts) | Atualizam estado global, procuram matrículas ativas do aluno e encerram alocações por aluno. Precisam receber seleção de matrículas e restringir todos os efeitos a ela. |
| [Criação/ativação](../../src/server/matricula/acoes.ts) | O fluxo legado ainda cria aluno; ativação consulta situação global e espera cobrança mensal. Ele não descreve sozinho a preparação comercial atual, que pode reutilizar uma identidade existente. Examinar separadamente os consumidores legados e a ativação. |
| [Retomada](../../src/server/retomada/acoes.ts) | Proposta atual parte de pausa do aluno e parcelas. Relacionar movimentação e itens ao contrato, preservando evidências e ampliando cobertura/horas. |
| [Mudança acadêmica](../../src/server/academico/acoes.ts) | Pedido e execução precisam identificar o vínculo da matrícula para não movimentar outro serviço. Preservar as etapas D14. |
| [Diário](../../src/server/diario/acoes.ts) | Elegibilidade usa alocações atualmente ativas e aluno ativo. Trocar pela participação histórica pertinente, sem reabrir dados amplos do aluno. |

Leitura dirigida de integração, não nova auditoria completa. Os links apontam para o código atual, e não para funções novas já entregues.

### 2.1 Origem comercial da matrícula — conferência de 10/09/2026

**Refinamento comercial registrado:** [entrada comercial e contrato](../planejamento/entrada-comercial-e-contrato.md). Q103–Q123 estão respondidas. Q103 exige disponibilidade para avançar à taxa/assinatura. Q107 reserva desde a preparação por prazo configurável; Q108 mantém vaga/pendência após o prazo se houver comprovante em conferência, pagamento confirmado ou assinatura. Q109 define a data-limite da turma; Q110 exige exceção pedagógica independente e viabilidade para ingresso com reserva anterior após esse limite, nunca em turma concluída. Q111 define por oferta grade fixa reservada ou agenda flexível com ao menos primeiro encontro reservado, com professor e disponibilidade conferidos.

Q112 emite a taxa automaticamente uma única vez após conferência de dados/condições da preparação pela Secretaria e requisitos atendidos. Q113 atribui ao vendedor identificação básica, contato e negociação; Secretaria complementa e confere documentos, endereço e dados financeiros/participantes aplicáveis. Depois da assunção, vendedor solicita correções. Q104–Q106 definem PDF por modelo aprovado, regra de taxa prévia por oferta e assinatura integrada, preservando conferência e ativação; ver [SPEC documental](documento-contratual.md). Q114 exige aprovação administrativa independente do modelo; Q115 define signatários pelas regras desse modelo e pessoas identificadas pela Secretaria. Geração/integração ainda não existem no código e ampliam o escopo. Q116 exige aprovação administrativa independente para substituir documento ainda em assinatura, confirmando o encerramento anterior antes da nova liberação. Q117 formaliza alterações após assinatura completa por aditivo na mesma matrícula, com aprovação independente, assinatura, conferência e vigência aprovada. Q118 exige proposta de Secretaria/Administração e aprovação/aplicação por outra pessoa da Administração para prorrogar/liberar reserva protegida, sem presumir efeitos em documentos/valores. Q119 emite pagamento inicial das aulas exigido após conferência; mensalidade não exigida nasce na ativação; hora sem adiantamento segue fechamento. Q120 registra responsável próprio na abertura de cada nova negociação de aluno existente, preservando vendas anteriores e transferência autorizada. Q121 permite desistência pela Secretaria sem avanço formal, com requisitos cumpridos; havendo comprovante em conferência, pagamento confirmado ou assinatura, exige proposta de Secretaria/Administração e aprovação administrativa independente. Conferir valores/acerto e encerramento externo quando aplicáveis. Q122 define assinatura dos participantes do cliente primeiro e da escola depois, quando exigida pelo modelo; fornecedor/plano serão avaliados depois.

O usuário pediu revisar o início pelo vendedor. A âncora operacional por matrícula continua aprovada; o detalhamento anterior não fechava toda a jornada comercial anterior à ativação. Não considerar a criação de uma segunda contratação completa apenas por aceitar alunoId existente.

| Etapa atual | Comportamento conferido no código |
|---|---|
| Atendimento do lead | [Ficha do lead](../../src/app/(app)/leads/[id]/FichaLead.tsx) oferece “Converter em matrícula” quando não há matrícula vinculada. A criação manual também aceita leadId ausente. Não existe exigência de proposta aceita na ação de conversão. |
| Proposta | [enviarProposta](../../src/server/comercial/acoes.ts) altera etapa/data e grava PropostaEnviada. Essa ação não gera documento, registra aceite da proposta ou executa seu envio externo. Não confundir com eventual mensagem enviada manualmente no atendimento. |
| Autor e formulário | [Permissões](../../src/server/matricula/permissoes.ts): Vendedor/Gerente Comercial, além da Administração, podem criar; Secretaria/Financeiro podem ativar nas condições aplicáveis. [Schema](../../src/server/matricula/schema.ts) exige cadastro pessoal, documentação, contato, produto e valores mensais; lead e turma são opcionais. Esse formulário legado não recebe alunoId; a preparação comercial atual recebe identidade existente selecionada explicitamente ou novo cadastro. |
| Salvar matrícula | No fluxo legado, criarMatriculaTx cria Aluno novo (ATIVO por padrão do schema), Matricula AGUARDANDO, taxa e primeira mensalidade pendentes, comissão pendente e, se escolhida turma válida, AlocacaoTurma ativa. Essa alocação já entra na contagem de vagas, antes de ativar a matrícula. A preparação comercial atual é uma via distinta para nova matrícula de aluno existente. |
| Negociação e autoria | Valores usam referências/alçadas no servidor; exceção gera aprovação pendente e não torna o preço proposto vigente antes de decidir. Comissão segue política e dono do lead quando existente, senão o autor usado pela rotina; passagem administrativa não transfere automaticamente comissão. |
| Passagem à Secretaria | [assumirMatricula](../../src/server/secretaria/acoes.ts) registra responsável/data. Secretaria/Administração confirma evidência contratual; comercial acompanha e solicita correções após assunção. O lead passa a AGUARDANDO_MATRICULA na criação. |
| Ativação | [ativarMatriculaTx](../../src/server/matricula/acoes.ts) verifica aceite contratual, taxa confirmada, primeira mensalidade quando configurada e ausência de aprovação de preço pendente. Secretaria/Financeiro/Administração concluem no alcance autorizado; vendedor com somente papel comercial não ativa. O lead passa a MATRICULADO na ativação e o restante do cronograma mensal é criado. |

Revisão do diagnóstico Q120: `Matricula.leadId` único limita uma matrícula por
lead; não impede que leads distintos abram novas vendas para o mesmo aluno. O
formulário legado cria uma pessoa nova, mas a preparação comercial atual em
`preparacao-comercial.ts` e `preparacao-comercial-tx.ts` aceita, de forma
exclusiva, `alunoId` existente ou `novoCadastro`; para identidade existente,
exige seleção explícita entre candidatos do mesmo telefone E.164. A cobertura
de integração em `reserva-vaga.int.test.ts` demonstra duas matrículas do mesmo
aluno, com lead novo, fotografia do vendedor e repetição idempotente. Isso
corrige somente a afirmação de que toda venda cria uma pessoa nova; não declara
resolvidos os demais limites deste diagnóstico. A criação legada continua no
modelo de taxa/mensalidade, e o estado `Aluno` `ATIVO` ou uma alocação ativa não
demonstram, por si, que o contrato já esteja ativado.

**Jornada refinada:** origem, divisão do cadastro, reserva/admissão, cobranças iniciais e responsabilidade de cada nova venda já seguem Q103/Q107–Q113/Q118–Q121. Desistência antes da ativação segue o avanço formal e os demais requisitos de Q121. Detalhar campos e representação técnica de negociação/matrícula sem copiar efeitos do fluxo legado nem reabrir o isolamento de Q102. A negociação precisa ter identidade, autoria e condições próprias; nova contratação de pessoa existente não duplica sua identidade nem transfere outras vendas.

## 3. Limites das entidades

Nomes nesta seção são conceituais; o schema final e migrations devem manter estas relações e invariantes.

| Entidade | Identidade e relações | Regra de integridade |
|---|---|---|
| Aluno | Pessoa única; possui várias matrículas e vínculos de responsáveis | Não duplicar cadastro para contratar segundo serviço. Sem associação automática por nome/e-mail compartilhado. |
| Matrícula | ID estável, aluno, produto/oferta, moeda e modelo comercial, situação e versão | Matrícula pertence ao aluno indicado; seleção não pode combinar ID de aluno com matrícula de outra pessoa. |
| Condições contratuais | Matrícula, versão/vigência, evidência de aceite, preço/descontos, cobertura, continuidade, multa e configurações pertinentes | Editar catálogo não reescreve compras, períodos ou decisões históricas. Ativação/operação exige campos suficientes. |
| Negociação comercial | Identidade da oportunidade, cadastro/contato de origem, autor, responsável e histórico, condições/proposta e matrícula da contratação | Q120 permite responsável próprio em cada nova negociação do mesmo aluno. Repetição de conversão não duplica matrícula; preservar anteriores, transferências autorizadas e comissão pela política, sem acesso global ao aluno. |
| Alocação/participação | Matrícula, turma ou encontro específico, início/fim de vigência e origem | Aluno deriva da matrícula; se persistido também, exigir consistência. Preservar histórico e impedir duplicidade incompatível do mesmo vínculo. |
| Reserva de vaga | Matrícula, turma, criação, prazo/versão de regra, estado e histórico de movimentações | Q107 reserva desde a preparação e reduz disponibilidade. Não cria presença/vínculo definitivo nem duplica vaga. Q108 mantém ocupação após o prazo quando houver comprovante em conferência, pagamento confirmado ou assinatura, com pendência a resolver. |
| Resolução de reserva protegida | Matrícula/reserva, estado/versões, proposta de prorrogação ou liberação, motivo, novo prazo, tratamento previsto dos efeitos e autores | Q118: Secretaria/Administração propõe; outra pessoa da Administração aprova e aplica proposta válida. Histórico e ocupação coerentes, sem presumir efeitos financeiros/contratuais ou estender limite de admissão. |
| Desistência antes da ativação | Matrícula, pedido/motivo, avanço formal conferido, versões, decisões, acerto aplicável, processo de assinatura e resultado da reserva | Q121 permite Secretaria efetivar sem comprovante em conferência, pagamento confirmado ou assinatura da contratação; havendo algum, Secretaria/Administração propõe e outra pessoa da Administração aprova. Exigir demais requisitos, acerto aprovado quando necessário e encerramento confirmado de solicitação externa aberta; incerteza mantém pendência. |
| Regime e reserva de horários da particular contratada | Matrícula, regra da oferta, grade fixa/agenda flexível, professor, encontros/intervalos acordados e reservas | Q111 exige grade recorrente acordada reservada ou ao menos o primeiro encontro na agenda flexível antes da taxa/assinatura. Conferir conflitos também com reservas, sem vincular regime de agenda ao modelo de cobrança. Prazo/manutenção seguem Q107/Q108; não usar a cota de reposição. |
| Exceção de admissão após o limite | Matrícula, reserva anterior, turma, proposta/condições conferidas, motivo, solicitante, aprovador e decisão | Q110 exige aprovador distinto da Gerência Pedagógica/Administração, reserva válida ou mantida por pendência e turma ainda apta, nunca concluída. Revalidar ao aplicar; não estende a janela para outras contratações nem satisfaz pagamentos/aceite. |
| Turma/encontro | Identidade compartilhada, agenda, professor e participantes | Não exigir uma matrícula dona da turma coletiva; cada participação indica a sua. |
| Diário/frequência | Encontro, participante elegível e autoria; referências de reposição | Aula original não perde autoria nem falta histórica; matrícula e participação devem ser coerentes com a data. |
| Movimentação por matrícula | Tipo, matrícula, registro, data efetiva, motivo/evidência, origem e versão | Pausa/retomada/encerramento de um contrato não altera estado operacional de outro. |
| Proposta coletiva / item | ID da proposta, aluno, conjunto de matrículas; por item, estado/versão e impactos acadêmicos/financeiros | Aprovação identifica exatamente o conjunto e os impactos. Não aceitar inclusão/remoção silenciosa depois de aprovar. |
| Cobrança/cobertura | Matrícula, período ou ocorrências, moeda e valores; versões de ajuste | Uma obrigação pertence ao contrato correspondente; competência e vencimento não substituem cobertura. |
| Conferência da preparação e emissão da taxa | Matrícula, dados/condições conferidos e versões, autoria/data da Secretaria, requisitos, origem da emissão e cobrança resultante | Q112 habilita emissão automática única com requisitos válidos. Distinguir conferência cadastral/contratual, emissão, envio, recebimento e evidência de aceite; taxa existente não é recriada. |
| Recebimento/destinação/crédito | Fato original, pagador/titular, moeda, origem e movimentos; destinações identificadas | B02 é responsável pelo registro comum. Crédito sem destinação é permitido; vínculo por matrícula não autoriza redistribuição automática. |
| Benefício / horas compradas | Matrícula e regra/período ou compra original; reservas e movimentos | Não compartilhar automaticamente cota entre contratos nem confundir benefício com horas pagas. |
| Material / autorização | Arquivo/encontro compartilhado; autorização deriva de participação ou reposição da matrícula | Um arquivo comum não vira público nem duplica o direito de quem teve outro contrato bloqueado. |
| Atendimento / aviso | Finalidade, contexto, participantes e referências de matrícula quando pertinentes | Contato global não abre histórico de outro serviço/finalidade; notificações revalidam contexto. |

Para alocação regular, a implementação deve impedir vínculos ativos incompatíveis no escopo da matrícula, preservando a regra de transferência do curso. Participações pontuais, substituições e reposições têm tipo/origem próprios e não criam uma segunda matrícula ou transferência por acidente. Esta SPEC não autoriza múltiplas turmas regulares simultâneas dentro do mesmo contrato por retirar a unicidade por aluno.

## 4. Estado e elegibilidade

**Expiração sem avanço formal — Q123:** manter a matrícula em preparação, pendente de nova reserva; a equipe retoma a mesma contratação após conferir disponibilidade, dados e condições atuais. Não há vaga garantida enquanto pendente. Encerrar solicitação de assinatura aberta com resultado confirmado e preservar documentos/cobranças; ajustes financeiros seguem fluxo próprio. Fatos formais concorrentes exigem conferência conforme Q108, sem tomar vaga alheia, ativar ou devolver automaticamente. Retomada da preparação não usa o fluxo de matrícula pausada.

O ciclo operacional de cada matrícula precisa representar rascunho/aguardando, ativa, pausada e encerrada, preservando o significado legado de cancelamento prévio e seus efeitos legítimos. Falta de oferta, causa de bloqueio de acesso, dívida e pendência documental têm fatos próprios; não comprimir todos em um único status.

O estado geral mostrado na ficha do aluno é uma projeção para orientação. Ele não autoriza aula, gera cobrança ou seleciona contratos. Eventual suspensão de conta por identidade/segurança é mecanismo separado e não deve ser reutilizada para implementar pausa acadêmica.

| Verificação | Deve usar |
|---|---|
| Ativar contratação | Condições, evidência, taxa e pagamento inicial do modelo daquela matrícula |
| Avançar para taxa/assinatura | Disponibilidade e reserva identificadas por matrícula conforme Q103/Q107–Q111, com professor/agenda válidos e admissão permitida. Revalidar o registro efetivo de reserva; a gravação da preparação no fluxo legado não comprova que Q107 tenha sido cumprida. |
| Reservar/participar de encontro | Matrícula, vigência da participação, situação/autorização aplicável e disponibilidade |
| Preencher chamada antiga | Participações e fatos vigentes na data do encontro; responsável atual autorizado àquela regularização |
| Assistir material | Identidade, relação material→encontro/reposição→matrícula, prazo e restrições atuais |
| Entregar reposição | Matrícula/pendência específica, autorização e prazo; histórico em leitura não implica permissão de envio |
| Gerar cobrança | Contrato, oferta/cobertura, modelo comercial, data pertinente e origem ainda não emitida |
| Emitir taxa de matrícula | Q112: conferir registro válido da Secretaria, dados suficientes do pagador, valores/condições aprovados, disponibilidade e reserva; emitir automaticamente uma vez por origem, sem baixa ou liberação manual adicional do Financeiro |
| Emitir primeira cobrança das aulas | Q119: mensalidade/adiantamento exigido para ativar nasce após conferência da Secretaria; primeira mensalidade não exigida nasce na ativação; hora sem adiantamento segue fechamento Q93. Exigir dados completos e reusar origem existente, sem duplicar obrigação/recebimento. |
| Transferir/retomar | Matrícula e vínculo exatos, proposta aplicável, alçada, versão e condições revalidadas |
| Efetivar desistência antes da ativação | Q121: avanço formal atual da matrícula, pedido/motivo, autorização pertinente, conferência de cobranças/valores, acerto aprovado quando necessário e encerramento confirmado de solicitação de assinatura aberta. Não encerrar outros contratos nem tratar reserva liberada como dinheiro devolvido. |

Outro contrato ativo nunca é condição suficiente para liberar uma operação bloqueada no contrato alvo. Alteração posterior não apaga a elegibilidade histórica nem autoriza inventar presença; restrição deve ser representada como impedimento quando aplicável, conforme Q59.

## 5. Contratos de operações

Assinaturas abaixo são contratos conceituais de serviço interno, compatíveis com o monólito existente. Não prescrevem novas URLs nem novos nomes públicos. Identidade/autorização vêm da sessão atual no servidor, não de campos confiados ao cliente.

| Operação | Entrada mínima | Saída / condição |
|---|---|---|
| Consultar contratos do aluno | alunoId e filtros restritivos | Lista autorizada com matrícula, serviço, situação e projeção por papel. Saldo/contato só onde permitido. |
| Criar contratação | alunoId existente **ou** cadastro novo explicitamente escolhido; oferta e condições | Nova matrícula, sem duplicar pessoa existente por padrão. Modelo por hora não cria dívida mensal fictícia. |
| Consultar vínculo acadêmico | matriculaId e instante/período pertinente | Vínculo exato e histórico autorizado; ambiguidade retorna pendência, nunca primeira linha. |
| Preparar movimentação | alunoId, matriculaIds explícitos e sem repetição, tipo, datas/motivos/evidências por item | Proposta com conjunto normalizado, versões e impactos por contrato; nenhum efeito definitivo na prévia. |
| Revisar proposta | propostaId, versão esperada e alterações autorizadas | Nova versão; mudança relevante invalida a revisão/aprovação anterior pertinente. |
| Decidir/aplicar | propostaId, versão revisada, decisão/motivo | Verifica aprovações aplicáveis e pessoa distinta; aplica somente conjunto válido ou retorna pendência sem efeitos parciais. |
| Retomar matrícula | matrícula(s) selecionada(s), pausa(s) de origem, cobertura e escolha de vencimentos | Proposta D13 ampliada; condições de cobertura/vencimento e saldo/validade de horas revisadas conjuntamente. |
| Preparar/efetivar desistência | matriculaId ainda não ativa, pedido/motivo, versões e referências dos efeitos financeiros/documentais | Revalidar Q121: Secretaria efetiva sem avanço formal com requisitos cumpridos; caso contrário, exigir proposta de Secretaria/Administração aprovada por outra pessoa da Administração. Acerto financeiro necessário tem aprovação própria; resultado externo incerto mantém pendência. Efetivar e liberar reserva uma única vez, preservando recebimentos e demais contratos. |
| Executar mudança de nível | proposta acadêmica aprovada, matriculaId e versão do vínculo | Secretaria executa após revalidar vaga/vínculo; não encerra alocações de outras matrículas. |
| Conferir acesso ao recurso | ação e recurso identificado | Resolve a matrícula pela relação persistida, confere vínculo e retorna projeção mínima ou negativa sem vazamento. |

Operações coletivas desta SPEC pertencem ao mesmo aluno, como no caso aprovado em Q102; seleção de vários alunos em lote não está implicitamente incluída. A tela sempre mostra os contratos selecionados e não pré-seleciona outros silenciosamente.

Os papéis solicitantes e aprovadores de cada movimentação continuam os dos fluxos de origem. Seleção coletiva não cria uma alçada genérica, não exige que o mesmo aprovador possua todos os papéis por suposição e não dispensa a aprovação financeira quando houver acerto. Registrar as decisões necessárias por domínio; aplicar apenas quando o conjunto estiver coberto e ainda válido.

## 6. Pré-condições, transação e pós-condições

Sequência proposta para pausa/encerramento coletivo:

1. Resolver usuário atual e capacidades. Validar seleção não vazia, IDs únicos, pertença ao aluno e alcance por contrato, antes de apresentar dados protegidos.
2. Preparar impactos por matrícula: situação, datas efetivas, vínculos, cobertura, cobranças, créditos, benefício/horas, material e avisos. Guardar versões e origem; não consultar todas as matrículas ativas para substituí-las pela seleção.
3. Submeter às aprovações exigidas, com separação de pessoas. Conservar data do pedido e data efetiva; revisão posterior não aumenta automaticamente cobrança.
4. Na aplicação, usar transação e ordem consistente de bloqueio dos registros envolvidos; revalidar permissões, seleção, versões, saldos e vínculos. Conflito exige nova revisão, sem aplicar apenas contratos que continuaram válidos.
5. Persistir movimentações por matrícula, relações e ajustes aprovados, com evento por efeito e referência ao conjunto. Gerar intenções de aviso vinculadas à operação aplicada.
6. Após confirmação, atualizar projeções da ficha e processar avisos com revalidação. Não incluir chamada ao provedor no meio da transação como condição para preservar consistência interna.

Pós-condições obrigatórias:

- Matrículas fora do conjunto mantêm situação, vínculos, direitos, cobranças e saldos anteriores. Projeções consolidadas podem mudar apenas para refletir corretamente os efeitos selecionados.
- Objetos compartilhados, como turma e gravação, permanecem existentes; muda o direito pertinente, sem retirar acesso de participantes de outros contratos.
- Aplicação não apaga cobranças/recebimentos nem redefine valor histórico. B02/F07.5/P01 executam somente efeitos aprovados do modelo correspondente.
- Repetir a mesma operação válida devolve referência ao resultado aplicado, sem segunda movimentação. Mesma chave com conteúdo diferente gera conflito.
- Falha na transação não deixa parte do conjunto aplicada. Falha externa posterior aparece como pendência de comunicação, sem fingir que a aplicação no ERP não ocorreu.

## 7. Leitura, UI e compatibilidade

Manter ficha única do aluno com lista identificada de contratos. Cada contexto mostra curso/oferta, modalidade comercial, matrícula, situação e ação permitida. Saldos consolidados distinguem moeda e origem, sem abrir campos de contratos fora do escopo do usuário.

Pausa/encerramento passam a partir da seleção de contratos e de uma prévia de impactos. Retomada aponta a pausa de origem e mostra cobertura e vencimentos separados. Consulta acadêmica e financeira deve manter o contexto ao navegar, exportar ou abrir anexos.

Chamadas legadas que só recebem alunoId não podem continuar modificando todos os contratos por compatibilidade silenciosa. Atualizar consumidores; quando contexto não puder ser determinado com segurança, exigir seleção/conferência. Adaptadores temporários só podem operar quando a correspondência for inequívoca e as mesmas autorizações forem verificadas.

A criação de segunda matrícula reutiliza a identidade do aluno já identificado. Não exigir copiar documentos pessoais para novo cadastro de pessoa; evidência e condições de cada contratação continuam identificadas conforme sua finalidade.

## 8. Migração da estrutura e dos dados

| Etapa | Resultado exigido |
|---|---|
| Inventário | Identificar alocações, movimentos, propostas, documentos, diários, contratos e cobranças existentes; listar todos os consumidores do estado global do aluno. |
| Expansão | Acrescentar relações/versões necessárias sem remover primeiro o histórico ou a integridade antiga. Registrar mapa de origem e versão do lote. |
| Correspondência | Vincular registros somente com evidência suficiente. Múltiplas matrículas possíveis ou datas insuficientes geram pendência de conferência. |
| Integridade nova | Validar pertença, intervalos, contratos duplicados e compatibilidade das alocações; só então substituir a unicidade global e habilitar novos vínculos. |
| Consumidores | Migrar criação/ativação, pausa/retomada/encerramento, D14, diário, financeiro, acesso, materiais, exportações, cron e avisos. |
| Ensaio | Executar cenário de múltiplos contratos, conciliar saldos por moeda/origem e conferir o histórico acadêmico; sem mensagens reais. |
| Habilitação | Liberar fluxos quando dados e consumidores necessários estiverem coerentes. Registros ambíguos não são liberados pela simples existência da coluna matriculaId. |

Conservar IDs e recebimentos originais. Não tornar aluno inativo/ativo para simular a situação dos contratos migrados. Não presumir que uma pausa global antiga se aplicava somente a uma matrícula; conferir evidência e listar contratos afetados antes de representá-la no modelo novo.

A falta de planilhas complementares não impede desenvolver esse mecanismo; a carga real dependente continua sujeita à conferência. Este documento não autoriza apagar dados, executar carga nem alterar produção.

## 9. Critérios verificáveis

Critérios ainda não executados nesta consolidação. A implementação deve vincular os testes e evidências a estes IDs e aos critérios dos corpos B01/F07.5/P01/V01.

| ID | Dado / ação | Resultado esperado |
|---|---|---|
| MAT-01 | Aluno existente contrata curso regular e particular por hora | Uma pessoa, duas matrículas; criação não exige duplicação de cadastro ou mensalidade fictícia para hora. |
| MAT-02 | Duas matrículas precisam de vínculos acadêmicos simultâneos | Permitidos vínculos independentes; duplicidade incompatível no mesmo vínculo é rejeitada. |
| MAT-03 | Pausar somente o contrato regular | Particular mantém situação, agenda, cobranças e direitos; regular passa às regras aprovadas de pausa. |
| MAT-04 | Encerrar somente a particular com horas antecipadas | Regular permanece; saldo da particular entra no acerto pelas condições originais, sem duplicar crédito. |
| MAT-05 | Selecionar ambos para encerramento | Prévia e aprovação mostram cada contrato/modelo; aplicação abrange exatamente o conjunto válido. |
| MAT-06 | Um item muda depois da aprovação ou falha na aplicação | Nenhum item é aplicado parcialmente; revisão necessária mantém data efetiva conforme decisão aprovada. |
| MAT-07 | Alterar ID do aluno, matrícula, vínculo ou material em chamada direta | Rejeitar inconsistência/falta de acesso sem consultar ou alterar outro contrato indevidamente. |
| MAT-08 | Outro contrato permanece ativo enquanto o alvo está bloqueado | Não libera material/entrega do alvo; acesso ao contrato válido permanece. |
| MAT-09 | Aluno transferido depois de uma aula com chamada pendente | Participação histórica correta; responsáveis autorizados não recebem acesso amplo ao cadastro/contrato atual. |
| MAT-10 | D13/D14 executados para uma matrícula | Retomar/mudar nível não escolhe a primeira matrícula nem encerra alocações de outra. |
| MAT-11 | Turma/material compartilhados por várias matrículas | Alteração de um participante não remove aula/material nem direitos de outros participantes autorizados. |
| MAT-12 | Repetir operação ou executar decisões concorrentes | Uma aplicação coerente; sem movimentos, créditos, cobranças ou avisos lógicos duplicados. |
| MAT-13 | Recebimento único com várias destinações e crédito sem destino | Origem, titular e moeda preservados; contratos identificados nas destinações, sem exigir destino fictício. |
| MAT-14 | Migração encontra duas matrículas possíveis para vínculo antigo | Registrar pendência; nenhuma atribuição por primeira linha/nome ou alteração financeira presumida. |
| MAT-15 | Professor/comercial consulta ficha com vários contratos | Somente contratos/registros/campos autorizados; resumo não revela valores, contatos ou materiais proibidos. |
| MAT-16 | Remover permissão de aprovador durante análise | Aplicação revalida acesso e separação de pessoas; múltiplos papéis não permitem autoaprovação. |
| MAT-17 | Avançar para pagamento da taxa/assinatura sem disponibilidade ou admissão permitida | Bloquear o avanço no servidor; turma opcional no formulário legado ou mera presença no catálogo não satisfaz Q103. Validar mudança de disponibilidade entre consulta e ação e, após o limite, a exceção específica válida de Q110, sem ampliar a janela geral. Nas particulares, validar o regime e as reservas de Q111/MAT-22. |
| MAT-18 | Duas preparações simultâneas disputam a última vaga, ou a mesma preparação é repetida | Reservar no máximo a capacidade disponível e uma vez por contratação; vaga reservada não é oferecida de novo. Distinguir reserva de alocação e evitar contagem dupla na transição. |
| MAT-19 | Vencer reserva de matrícula ainda não ativa, com/sem avanço formal, e repetir o processamento | Sem comprovante em conferência/pagamento confirmado/assinatura, expirar uma vez. Havendo algum desses registros, manter vaga e abrir pendência, inclusive após a data-limite; repetição não libera nem duplica ocupação. |
| MAT-20 | Turma em andamento dentro/fora da data-limite de admissão | Dentro da janela, pode aceitar nova contratação com demais requisitos válidos; depois, bloquear novas admissões, ressalvado o caso de reserva anterior com exceção Q110/MAT-21. A lista não exige início futuro, e o ingresso não cria faltas/presenças anteriores ao vínculo. |
| MAT-21 | Reserva anterior ao limite tenta concluir ingresso após ele, com/sem aprovação específica, autoaprovação ou mudança de viabilidade | Exigir reserva ainda válida ou mantida por pendência, decisão com motivo de outra pessoa autorizada e turma apta, nunca concluída. Rejeitar falta de aprovação/autoaprovação e exigir nova conferência diante de mudança relevante. Preservar proteção Q108, pagamentos e documentos; aprovação não ativa sozinha nem permite ingresso de outras contratações fora da janela. |
| MAT-22 | Contratar particular mensal/por hora com grade fixa ou agenda flexível, faltando reserva ou havendo conflito concorrente | Regime registrado por matrícula/contrato; grade fixa exige horários recorrentes acordados reservados, flexível exige ao menos primeiro encontro com professor disponível. Bloquear avanço sem requisitos ou com conflito; não duplicar reservas. Demais encontros flexíveis exigem novo agendamento, sem promessa de recorrência. Não alterar cobrança, consumir benefício de reposição ou permitir aula antes da ativação. |
| MAT-23 | Salvar preparação, conferir com requisito faltante e repetir uma conferência válida, inclusive com taxa já emitida/recebida ou após falha | Preparação sozinha não emite taxa. Conferência válida da Secretaria e requisitos atendidos geram emissão automática única; pendência de requisito é identificada. Concorrência/repetição ou taxa preexistente não duplicam nem sobrescrevem histórico. Não confirmar recebimento, assinatura ou ativação pela emissão; preservar Q105 e regras dos demais valores. |
| MAT-24 | Vendedor prepara com identificação básica/contato/negociação; Secretaria complementa, com cliente novo ou existente | Permitir a preparação com dados mínimos da etapa e pendências explícitas, sem exigir todos os dados cadastrais finais ou inventá-los. Taxa/contrato exigem dados suficientes e conferência. Reutilizar identidade confirmada sem abrir outros contratos. Depois da assunção, vendedor solicita correção; alteração direta no servidor é rejeitada. |
| MAT-25 | Prorrogar/liberar reserva protegida com aprovador igual, papel insuficiente, versão alterada ou repetição | Exigir proposta de Secretaria/Administração, outra pessoa da Administração e dados ainda válidos. Aplicar uma vez prazo/liberação, preservando histórico e tratamento separado de documentos/valores. Não prorrogar admissão nem confirmar recebimento/devolução/cancelamento; no novo vencimento, reaplicar Q108. |
| MAT-26 | Mensal com/sem primeira mensalidade exigida e hora com/sem adiantamento; repetir conferência/ativação com cobranças existentes | Se pagamento das aulas for exigido, emitir após conferência e exigir confirmação antes de ativar. Mensal sem exigência emite na ativação, sem bloqueio circular por ausência anterior. Hora sem adiantamento não gera mensalidade fictícia e segue Q93. Preservar requisitos de taxa/contrato e dados de cobertura/horas/vencimento; não duplicar cobrança/recebimento nem aceitar informe como quitação. |
| MAT-27 | Aluno com matrícula vendida por A abre nova negociação com B; converter/repetir e testar acesso/transferência | Nova oportunidade e matrícula usam responsável B e a mesma identidade confirmada; operação repetida não duplica conversão. Vendas/autoria/comissões anteriores permanecem. B não lê outros contratos nem sobrescreve cadastro conferido por essa origem; cobertura não muda titular, transferência exige autorização e comissão segue política da nova contratação. |
| MAT-28 | Desistir antes da ativação, com/sem avanço formal; inserir comprovante/pagamento/assinatura durante a revisão; repetir operação | Sem avanço formal, Secretaria efetiva somente com requisitos cumpridos. Havendo algum registro, exigir proposta de Secretaria/Administração e outra pessoa da Administração aprovadora; evento concorrente impede execução direta. Acerto necessário exige Financeiro e aprovação independente; assinatura aberta com resultado de encerramento incerto mantém pendência. Preservar matrícula/documentos/recebimentos, liberar reserva coerentemente uma vez e não alterar contratos excluídos nem presumir devolução. |
| MAT-29 | Expiração sem avanço formal e nova tentativa de reserva; assinatura/pagamento concorrente | Mesma matrícula fica em preparação sem vaga garantida; nova tentativa confere disponibilidade, dados e condições atuais. Solicitação de assinatura aberta é encerrada com confirmação. Preservar cobranças/recebimentos e não usar retomada de matrícula pausada. Fato formal já registrado impede expiração; fato tardio abre conferência sem retirar vaga alheia ou criar ativação/devolução automática. |

## 10. Entrega e limites

B01 entrega a base de identidade, condições e vínculos usada pelos consumidores. B02 entrega o registro financeiro; F07.5/P01 completam comportamentos de pausa/acerto conforme modelo; F07.4/F07.6/F07.7 completam diário/reposição/material. Não considerar Q102 entregue ao adicionar uma chave estrangeira ou alterar só a tela.

Antes de criar tarefas de implementação, cada corpo deve referenciar os IDs aplicáveis, entradas/saídas e dependências. Nomes exatos de tabelas, enums, serviços e estratégia de migração serão fechados na revisão técnica com o código, preservando estes invariantes. Não há nova pergunta de negócio necessária para tornar a matrícula a unidade operacional.

Pronto para homologar este ponto significa MAT-01–MAT-29 atendidos nos fluxos implementados, migração/legado tratados, evidências registradas e caminhos globais incompatíveis retirados de uso. Nenhuma dessas condições foi declarada executada por criar esta SPEC.

### Implementação Q110 — incremento 204

Há proposta/decisão independente e revisão do cenário para reserva feita dentro da janela original. Emissão e conferência contratual utilizam a exceção específica, preservando capacidade, agenda e docente apto e recusando turma concluída. A autorização não se estende a outras reservas nem representa alocação/ativação. A integração à ativação final continua pendente. Implementação e evidências: [registro B01](../planejamento/implementacao-b01.md) e [validação 204](../validacao-excecao-admissao-204-2026-09-12.json).


## Q111 — Forma de agenda por oferta (incremento 206)

A oferta deve identificar explicitamente turma, particular com grade fixa ou particular com agenda flexível. A distinção é independente de mensalidade versus cobrança por hora: particulares podem usar os dois regimes financeiros. O nome textual da modalidade não classifica a oferta automaticamente.

Grade fixa exige reservar os horários recorrentes acordados, com professor e conflitos conferidos. Agenda flexível exige ao menos o primeiro encontro reservado e os posteriores sujeitos a novo agendamento. Os limites e a manutenção da reserva seguem Q107/Q108; reserva não concede acesso às aulas ou ativa matrícula. Condições de agenda devem chegar ao contrato correspondente, sem reclassificar contratações existentes ao editar o catálogo.

**Implementado nesta rodada:** `ProdutoPais.formaAgenda`, configuração administrativa com controle de versão e evento anterior/atual, consulta no catálogo e captura da classificação na preparação. A preparação mostra a regra preservada. Registros antigos permanecem sem classificação até conferência; a migration não deduz a modalidade ou reescreve histórico.

**Proteção temporária explícita:** o fluxo atual de preparação só reserva vaga em turma; ele recusa ofertas explicitamente classificadas como particulares e recusa hora particular em oferta explicitamente classificada como turma. Não transforma vaga em reserva de horário individual. Isso é um bloqueio de funcionalidade ainda não entregue, não uma decisão de excluir particulares do escopo.

**Ainda pendente:** reserva individual de professor/encontros, recorrência fixa versus primeiro encontro flexível, concorrência com agenda de turmas e indisponibilidades, revisão/expiração/liberação, captura dos horários no contrato e consumo na ativação. Preparações e ofertas antigas sem classificação continuam no caminho legado e precisam de conferência/migração antes de produção; não comprovam Q111. A nova classificação não retroage sobre elas.


### Conferência dos horários particulares — incremento 207

A conferência interna recebe oferta/versão, professor, fuso de origem e datas/horários/durações explicitamente propostos. Exige classificação particular, oferta ativa no país/moeda e calendário institucional publicado no fuso vigente. Converte cada horário local sem escolher silenciosamente um instante ambíguo ou inexistente. Considera o intervalo completo, inclusive após meia-noite; o fim é exclusivo, portanto encerrar exatamente à meia-noite não ocupa o dia seguinte.

O resultado identifica docente inapto, horários passados, conflitos com encontros previstos/ministrados, sobreposição interna, indisponibilidades aprovadas e períodos não letivos que exigem Q19. Pedido de ausência ainda não aprovado não ocupa o intervalo. Nenhuma exceção não letiva é concedida por esta conferência. O resultado conserva referências de oferta/calendário, instantes, conflitos e hash do estado, para revisão posterior.

Limites: função interna, sem Server Action ou interface, não concede acesso a vendedor/usuário por si só; chamador deverá autorizar o contexto da contratação. A leitura usa o bloqueio comum do calendário, mas não persiste reserva e não promete disponibilidade futura. Reserva individual concorrente, conjunto completo de horários contratuais, recorrência, autorização de exceções e ciclo de reserva continuam pendentes. `reservaEfetuada=false` é explícito; lista vazia de impedimentos não é autorização para cobrar, assinar ou ativar.


### Reserva persistida de particulares — incremento 208

ReservaAgendaParticular identifica matrícula, preparador, motivo, prazo configurado, chave de repetição e snapshot da conferência. HorarioReservaParticular preserva professor, instantes e fuso de cada encontro acordado. O executor interno para Secretaria/Administração repete a conferência sob o bloqueio comum da agenda, exige a versão/hash revisados, confirma oferta compatível com a matrícula e persiste todo o conjunto atomicamente. Horários repetidos/sobrepostos não criam reservas parciais. A mesma solicitação retorna o registro já existente; chave com conteúdo diferente é recusada.

Reservas ATIVA e MANTIDA_PENDENCIA ocupam horários mesmo depois do prazo. O relógio não libera disponibilidade sem conferir avanço formal de Q108; o ciclo de decisão/expiração específico ainda será integrado. Preparação não pode manter simultaneamente reserva de turma e de particulares. Banco preserva base e intervalos, impede reativação de reserva terminal e protege publicação/remarcação/substituição de encontros contra horários reservados. A futura ativação deverá consumir a reserva e criar os encontros na mesma transação, sem dispensar contrato/pagamentos.

Conferência particular identifica reservas concorrentes. Conferência/publicação de grade de turma e substituição docente também consideram os intervalos reservados; a tela de grade mostra o impedimento. Alterar somente o professor de uma aula não contorna a proteção do banco.

Limites atuais: primitiva interna sem botão/Server Action de contratação particular. Preparação comercial conjunta, geração/conferência da recorrência fixa, vínculo documental dos horários, renovação/liberação com avanço formal, tratamento das reservas afetadas por licença docente e ativação/consumo permanecem pendentes. A regra temporária do incremento 206 continua bloqueando o caminho de turma comum; nenhuma oferta particular foi declarada operacional apenas por esta primitiva.


### Ausência docente que afeta reservas particulares — incremento 209

A decisão de ausência aprovada captura também os horários particulares reservados que intersectam o intervalo, preservando referência da reserva e início/fim. A consulta exibe impacto antes da decisão e, depois da aprovação, mantém como pendentes os horários cujas reservas continuam ATIVA ou MANTIDA_PENDENCIA. O vencimento do prazo, por si só, não retira o compromisso dessa lista.

A tela de indisponibilidades separa aulas previstas de reservas particulares. A equipe autorizada pode conferir os impactos; professor acessa apenas as próprias ausências/horários, sem dados financeiros ou cadastrais dos contratantes. Rejeição não cria pendência de ausência. Depois da solução, a consulta atual deixa de listar a reserva como pendente, enquanto a captura imutável na decisão conserva o impacto original.

A ausência não libera reservas, troca professor, cancela contratação ou cria devolução. Reagendamento/liberação da reserva, com suas aprovações e efeitos contratuais, continuam pendentes. Esta entrega completa a identificação e o acompanhamento do impacto; não comprova resolução operacional.


### Revisão válida antes de aprovar ausência — incremento 210

A consulta de ausência pendente fornece um hash do impacto identificado: solicitação/professor/intervalo, aulas previstas e horários particulares reservados. A interface envia esse hash ao aprovar. Sob o bloqueio comum da agenda, o servidor repete a leitura e exige correspondência; alteração de horário, inclusão ou retirada de compromisso exige atualizar a lista e conferir novamente antes da decisão. Sem hash de revisão, a aprovação é recusada. Rejeição não exige autorizar um impacto.

O evento registra o hash aprovado. Repetição da mesma decisão verifica a identidade do decisor, conteúdo e impacto histórico preservado na decisão, sem usar pendências atuais como se fossem o cenário originalmente aprovado. Assim, resolução posterior não invalida a confirmação de uma aprovação já aplicada; hash divergente não passa como repetição da mesma decisão. Aprovar continua exigindo outra pessoa autorizada.


### Preparação comercial com reserva particular — incremento 211

PreparacaoComercialMatricula passa a identificar exatamente uma reserva: vaga de turma ou agenda particular. Migration 101 preserva preparações antigas e mantém o vínculo imutável, com conferência de pertença à mesma matrícula no banco. Não há turma fictícia para particulares.

Preparação aceita exclusivamente turmaId ou agendaParticular, que contém oferta/versão, professor, fuso, horários acordados e hash da revisão. Oferta explicitamente particular exige agenda particular; oferta de turma não aceita reserva individual. Matrícula, reserva e preparação são persistidas na mesma transação. A forma de agenda permanece no snapshot comercial, com condições e responsável próprios da negociação. Repetição retorna o mesmo vínculo sem duplicar.

Vendedor/Gerente Comercial podem preparar/reservar somente no escopo vigente da negociação; Secretaria/Administração mantêm o alcance operacional autorizado. Aproveitar cadastro existente não abre outros contratos. Consulta da preparação exibe os horários da reserva particular, docente/fuso e prazo, preservando o filtro comercial. O diagnóstico da Secretaria identifica a integração particular pendente, sem solicitar uma vaga de turma inexistente.

Este incremento substitui o bloqueio absoluto de particulares do 206 apenas quando há agenda particular válida no novo payload. O formulário comercial ainda só oferece turma: falta sua interface de revisão/seleção particular. Ativação mensal legada recusa preparações com reserva particular; prévia contratual também aguarda a integração dos horários ao documento. Emissão continua sem caminho particular validado. Não há liberação automática de cobrança, assinatura, aula ou acesso por esta preparação.


### Formulário comercial de horários particulares — incremento 212

A oferta selecionada informa classificação e versão. O formulário particular substitui a escolha de turma pela busca paginada de professor ativo, fuso de origem e lista explícita de datas/horários/durações acordados. Grade fixa solicita todos os encontros recorrentes; agenda flexível exige ao menos o primeiro, sem presumir os seguintes. Não há geração automática de recorrência nesta interface.

A revisão pública exige negociação no escopo atual e informa intervalos e impedimentos, sem expor identificadores de aulas/reservas/matrículas concorrentes. Busca docente retorna somente id/nome. Revisão não reserva. Após conferir o resultado sem impedimentos, o usuário confirma os horários e pode preparar; qualquer alteração da agenda invalida a confirmação. O servidor revalida oferta, hash e disponibilidade na transação de preparação, preservando o controle concorrente do 208.

O envio usa as ações existentes de identificação/cadastro e preparação para pessoa nova ou cadastro selecionado. O formulário fica bloqueado durante o envio, e o resultado abre a página da preparação, adequada para turma ou particular. Não passa pela página exclusiva de reserva de turma. Ao editar a versão da oferta, a página reinicia o formulário da nova versão.

A interface e o caminho público do servidor estão implementados, com integração automatizada de preparação particular por cadastro existente. Ensaio interativo e homologação ainda pendentes. Não habilita contrato, emissão, assinatura ou ativação particular antes da integração documental/financeira já identificada.


### Integração documental da agenda — incremento 213

A prévia particular agora consome a reserva histórica e inclui o campo institucional AGENDA_PARTICULAR no corpo do modelo aprovado. Isso substitui o bloqueio documental temporário do 211 quando o modelo e as fontes estiverem completos. O servidor conserva forma/fuso/docente/encontros, verifica conflitos/ausência/calendário e mantém a separação entre prévia, emissão, assinatura e ativação. Detalhes em documento-contratual.md; ciclo financeiro e ativação particulares continuam incompletos.


## Incremento 215 — Emissão inicial das particulares, 12/09/2026

Conferência da Secretaria e emissão inicial agora usam a reserva particular vinculada à preparação. A revisão mostra os horários e inclui sua configuração histórica e o calendário no hash. O executor revalida reserva, prazo, docente, conflitos e períodos não letivos na transação antes de emitir. Memória da emissão conserva a agenda conferida. Alterar a oferta depois da preparação não substitui suas condições históricas.

Mantido o planejador das cobranças: taxa após conferência; primeira mensalidade conforme exigência de entrada; por hora sem adiantamento não recebe mensalidade fictícia. Emissão não ativa matrícula nem consome a reserva. Repetição da confirmação retorna a emissão existente sem duplicar.

74 integrações de reservas/agenda aprovadas, incluindo quatro combinações particulares e bloqueios por docente inativo e revisão desatualizada. TypeScript, lint do trecho, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-emissao-particular-215-2026-09-12.json. Sem migration, produção, importação ou envio externo. Última regressão integral permanece 201. Conferência para assinatura, ciclo de reserva e ativação particulares continuam pendentes; ensaio interativo também pendente.


## Incremento 217 — Conferência do vencimento de reservas particulares, 12/09/2026

Executor transacional e ação autenticada da Secretaria/Administração conferem vencimento com bloqueio comum da agenda e da matrícula. Prazo vigente e estados já tratados não sofrem nova transição. Reserva vencida vinculada à preparação pode expirar sem avanço formal local: horários deixam de ocupar disponibilidade, mas os registros, cobranças e preparação permanecem preservados.

Comprovante a conferir/confirmado, recebimento, indício financeiro legado, contrato/documento contratual ou processo de assinatura impedem liberação automática. Processo mesmo cancelado exige conciliação; não presumir ausência de assinaturas parciais. Reserva sem preparação correspondente ou matrícula fora da preparação também fica mantida por pendência. Evento registra referências e motivo objetivo da transição. Nenhuma cobrança é cancelada, recebimento devolvido ou matrícula ativada.

A página da preparação mostra o botão de conferência para Secretaria/Administração quando a reserva particular ativa vence. Comercial não recebe esse controle e a ação recusa seu papel. A execução periódica automática, resolução independente da pendência e retomada com nova reserva continuam pendentes; esta rodada entrega executor e operação manual, sem declarar concluídos Q108/Q118/Q123.


Validação 217: 74 integrações aprovadas; cenários incluem prazo vigente, papel comercial recusado, expiração sem avanço, manutenção por indício financeiro/documento/processo de assinatura, repetição sem transição e preservação de horários/cobranças. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-vencimento-particular-217-2026-09-12.json. Sem migration; última regressão integral permanece 201. Ensaio interativo pendente.


## Incremento 218 — Rotina periódica de reservas particulares, 12/09/2026

A rota operacional existente POST /api/whatsapp/cron, protegida por CRON_SECRET no cabeçalho x-cron-secret, inclui agora a conferência de reservas particulares antes das rotinas de mensagens. Seleciona até 50 reservas ativas vencidas e revalida cada uma na própria transação. Retorna contagens de expiração, manutenção, ausência de transição e falhas; lote cheio sinaliza continuação em novas chamadas. Falha individual não libera a reserva nem impede as seguintes. A rotina de reservas não depende de WhatsApp habilitado e não envia mensagens.

Quatro integrações direcionadas passaram (56 casos não selecionados): os cenários particulares agora exercitam o lote e sua repetição. Quatro unitários passaram para falha isolada e autenticação da rota (sem segredo, segredo incorreto e chamada válida). TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-cron-particular-218-2026-09-12.json. A rodada de 74 integrações continua sendo a 217; última regressão integral é 201.

Sem agendador externo configurado ou validado nesta rodada; o código atende chamadas periódicas autenticadas, mas não comprova operação periódica em produção. Antes de operar, dimensionar lote/tempo limite do ambiente e tratamento de falhas persistentes que possam ocupar o começo dos lotes. Sem migration, produção, importação ou envio externo. Resolução aprovada e retomada com nova reserva permanecem pendentes.


## Incremento 219 — Continuidade dos lotes de vencimento, 12/09/2026

Cursor persistente no banco guarda a última reserva selecionada por vencimento/id. Seleção e avanço são serializados em transação própria. A posição avança antes do processamento, portanto falha ou queda não prende as reservas posteriores. Ao terminar a passagem, o cursor é zerado para revisitar as pendentes na chamada seguinte. Reserva permanece ocupante até a própria conferência transacional autorizar sua transição; cursor não libera horários.

A rotina inicia no máximo 50 conferências e para de selecionar ao atingir 15 segundos de trabalho. Transações individuais usam timeout de 5 segundos e espera de conexão de 1 segundo; uma operação em curso pode ultrapassar o orçamento do lote. Retorno identifica limite de tempo. São limites técnicos de processamento, sem alterar prazo de reserva ou condições contratuais.

Migration 102 aplicada somente no banco local de testes, com schema diff vazio. Cinco integrações direcionadas e cinco unitários passaram; teste de cursor confirma avanço por duas reservas ainda ativas e retorno à primeira em nova passagem. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-cursor-particular-219-2026-09-12.json. Demais 56 integrações do arquivo não foram selecionadas. Última regressão integral permanece 201.

Sem agendador externo configurado nesta rodada; capacidade, tempo limite total da rota e alertas operacionais ainda precisam ser homologados no ambiente de execução. Sem produção, importação ou envio externo. Resolução aprovada e retomada com nova reserva continuam pendentes.


## Incremento 220 — Painel de reservas particulares da Secretaria, 12/09/2026

Painel /secretaria/reservas distingue turmas e particulares. Consulta particular exige Secretaria/Administração com papel ativo revalidado no banco, pagina 30 registros, permite matrícula específica e inclusão do histórico. Apresenta estado, prazo/fuso, docente e quantidade de horários, com link à preparação. Não retorna snapshot, documentos financeiros ou contatos pessoais na projeção da lista. Vencidas ativas oferecem a conferência existente; mantidas ocupam horários e expiradas só aparecem ao incluir histórico.

Quatro integrações direcionadas passaram: consulta comercial negada, filtro por matrícula, projeção limitada, ocupantes e histórico após expiração/manutenção. Demais 57 casos do arquivo não selecionados. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-painel-particular-220-2026-09-12.json. Última regressão integral permanece 201. Sem migration, produção ou envio externo; ensaio interativo pendente. Resolução aprovada e retomada da preparação com nova reserva ainda não concluídas.


## Incremento 222 — Resolução particular com aprovação independente, 12/09/2026

Servidor permite propor prorrogação/liberação de reserva particular mantida por pendência. Secretaria/Administração prepara com motivo, tratamento previsto da contratação e novo prazo quando aplicável. Outra pessoa da Administração decide; acúmulo de papéis não permite autoaprovação. Proposta e decisão permanecem imutáveis, com versões, idempotência e auditoria. Liberação da reserva não cancela contrato/cobrança nem devolve recebimentos.

Decisão revalida a versão mais recente e o contexto da reserva, matrícula, cobranças/informes/recebimentos, documentos e processos de assinatura. Mudança exige nova proposta. Prorrogação exige prazo futuro/posterior e disponibilidade da agenda particular; calendário, docente e horários compõem a revisão preservada. A transição válida muda somente estado/prazo da reserva.

Quatro integrações direcionadas aprovadas: liberação/prorrogação, autoaprovação recusada, Secretaria impedida de decidir, nova evidência invalidando proposta, nova versão aprovada, repetição e imutabilidade. Demais 57 casos não selecionados. TypeScript, lint e build Next.js 16.3.5 (46 páginas estáticas) aprovados; migration 103 somente no banco local de teste, schema diff vazio. Evidência: docs/validacao-resolucao-particular-222-2026-09-12.json. Última regressão integral permanece 221.

Esta rodada entrega ações de servidor e persistência. Consulta detalhada e interface de preparação/decisão particulares ainda pendentes; não declarar Q118 concluída na experiência operacional. Retomada com nova reserva, assinatura externa e ativação continuam incompletas. Sem produção ou envio externo.


## Incremento 223 — Interface de resolução particular, 12/09/2026

Painel de particulares abre /secretaria/reservas/particulares/[id], com horários, prazo, estado e histórico paginado de propostas. Formulários reutilizam a estrutura existente com ações particulares: Secretaria/Administração prepara; outra pessoa da Administração decide. Consulta revalida papel e projeta permissões de decisão/aprovação conforme autoria, versão, estado, prazo e hash. Uma indisponibilidade da agenda bloqueia prorrogação e aparece como pendência, sem impedir a consulta de histórico ou o tratamento de liberação.

Proposta/decisão exibem motivos e tratamento previsto; reavaliação transacional do servidor continua obrigatória. Histórico preserva também proposta superada, sem apresentá-la como aplicada. Não são expostos snapshots ou documentos internos na projeção de propostas.

Quatro integrações direcionadas passaram, incluindo consulta comercial negada, autoria independente, revisão desatualizada e histórico das duas versões após aprovação. Demais 57 casos não selecionados. TypeScript, lint e build Next.js 16.3.5 (46 páginas estáticas e nova rota dinâmica) aprovados. Evidência: docs/validacao-tela-resolucao-particular-223-2026-09-12.json. Sem migration; última regressão integral permanece 221. Ensaio interativo pendente, portanto não declarar homologação operacional. Retomada com nova reserva, assinatura externa e ativação continuam incompletas. Sem produção ou envio externo.


## Incremento 224 — Cadeia histórica de reservas particulares, 12/09/2026

Novo vínculo imutável RetomadaReservaParticular identifica reserva anterior, nova, autor, motivo e data. Origem/destino únicos impedem dois sucessores ou reutilização do destino. Banco exige mesma matrícula, origem expirada/liberada e destino ativo; preparação comercial mantém sua referência original. Resolver interno percorre a cadeia para encontrar a reserva atual, com detecção de ciclo.

Vinculação interna exige Secretaria/Administração ativa, matrícula em preparação e origem correspondente à ponta atual da cadeia. Repete somente o mesmo autor/conteúdo; outra proposta para a mesma origem é recusada. Não é Server Action e deve integrar a transação da criação da nova reserva após as conferências aplicáveis.

Quatro integrações direcionadas aprovadas; cenário flexível por hora cobre nova reserva, vinculação, repetição, papel comercial recusado, histórico original preservado e alteração do vínculo impedida. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Migration 104 aplicada somente no banco local de testes, schema diff vazio. Evidência: docs/validacao-cadeia-particular-224-2026-09-12.json. Demais 57 casos não selecionados; última regressão integral permanece 221.

A ação operacional de retomada, sua revisão de condições/documentos, interface e adaptação dos consumidores para a reserva atual ainda precisam ser implementadas. Esta base não habilita contratação, assinatura ou ativação por si só. Sem produção ou envio externo.


## Incremento 225 — Consumidores da reserva particular atual, 12/09/2026

Fonte da agenda contratual resolve a cadeia de reservas antes de conferir disponibilidade. Prévia, revisão de emissão e conferência para assinatura passam a receber os horários da reserva atual pelos consumidores existentes dessa fonte. Consulta da preparação mostra reserva atual e identifica a original preservada. Controle de vencimento também resolve a ponta da cadeia, evitando manter a nova reserva apenas por divergir da referência histórica inicial.

Quatro integrações direcionadas aprovadas. Cenário de nova reserva confirma consulta atual, snapshot documental com novo identificador, original anterior preservado mas conferência de assinatura desatualizada, e expiração normal da nova reserva sem avanço formal. Sem duplicação de cobrança. Demais 57 casos não selecionados. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-reserva-atual-225-2026-09-12.json. Sem migration; última regressão integral permanece 221.

Não há ação pública ou interface completa de retomada nesta rodada: a criação/vinculação usada no teste continua interna. Revalidação contratual, encerramento das solicitações externas quando necessário e demais requisitos da retomada ainda precisam ser conectados. Sem homologação interativa, produção ou envio externo.


## Incremento 226 — Revisão e executor interno de nova reserva, 12/09/2026

Revisão de retomada exige Secretaria/Administração, matrícula em preparação assumida, reserva atual expirada/liberada, pagador/condições vigentes e preço autorizado. Oferta precisa conservar produto, país, moeda e forma de agenda; alteração contratual não é presumida. Disponibilidade nova integra o hash junto às condições e ao pagador.

Executor confere o hash e cria nova reserva/vínculo na mesma transação. Registra confirmação com hash de entrada; repetição exata retorna o resultado anterior, enquanto conteúdo diferente com a mesma chave é recusado. Não emite cobrança, assina ou ativa matrícula. Documentos contratuais, aceite ou processos de assinatura exigem conciliação própria e permanecem bloqueados até integrar esse fluxo.

Quatro integrações direcionadas aprovadas, incluindo autorização, revisão divergente sem criar reserva, criação/vínculo conjunto, repetição e conflito de chave. Demais 57 casos não selecionados. TypeScript, lint e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-nova-reserva-226-2026-09-12.json. Sem migration; última regressão integral permanece 221.

Entrega ainda interna: ações públicas, interface, conferência completa de condições financeiras/documentais e conciliação de assinatura não estão concluídas. Sem produção ou envio externo.


## Incremento 227 — Ações autenticadas de nova reserva, 12/09/2026

Ações de revisão e confirmação de retomada exigem sessão da Secretaria/Administração e revalidação do papel no executor. Autor vem da sessão; entrada estrita não aceita autor fornecido pelo cliente. Consulta projeta cadastro, pagador, versão de condições, plano financeiro, cobranças existentes e novos horários. Valores monetários são serializados como texto; não retorna snapshot interno da disponibilidade.

Cadastro do aluno e estados/versões das cobranças, informes e recebimentos passam a integrar o hash da revisão. Cadastro é relido sob bloqueio compartilhado antes da confirmação. Alteração posterior exige nova consulta. A ação usa o executor atômico/idempotente existente e não emite cobranças.

Quatro integrações direcionadas aprovadas; cenário de retomada agora usa ações públicas, testa vendedor recusado, projeção da revisão, alteração cadastral invalidando confirmação, nova revisão e confirmação bem-sucedida. Demais 57 casos não selecionados. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-retomada-publica-227-2026-09-12.json. Sem migration; última regressão integral permanece 221.

Interface ainda pendente. Conciliação de documentos/processos de assinatura e alteração de condições/oferta não são liberadas por estas ações; dependem dos fluxos correspondentes ainda incompletos. Sem produção ou envio externo.


## Incremento 228 — Tela de retomada com nova reserva, 12/09/2026

Preparação particular expirada/liberada oferece à Secretaria/Administração a rota /matriculas/[id]/nova-reserva. Tela permite busca paginada de professores, fuso e encontros explícitos; fixa orienta informar todos os encontros acordados e flexível ao menos o primeiro. Revisão mostra cadastro, pagador, condições, cobranças existentes e agenda; exige conferência e motivo antes da confirmação. Mudança na agenda remove revisão/consentimento. Campos ficam bloqueados durante operações; confirmação bem-sucedida retorna à preparação.

Consulta de formulário revalida papel, matrícula, reserva atual e forma de oferta; devolve professores ativos somente com id/nome, em páginas de 30. Ações de confirmação mantêm validação transacional e idempotência já implementadas. Pagador possui projeção tipada de identificação/contato/endereço para a revisão.

Quatro integrações direcionadas aprovadas, incluindo consulta comercial negada, oferta/versão atual, busca docente e página inválida. Demais 57 casos não selecionados. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas, nova rota dinâmica) aprovados. Evidência: docs/validacao-tela-retomada-228-2026-09-12.json. Sem migration; última regressão integral permanece 221.

Ensaio interativo ainda pendente. Conciliação de documentos/processos de assinatura e alteração contratual/oferta continuam bloqueadas até integrar seus fluxos próprios; a tela não declara esses casos resolvidos. Sem produção ou envio externo.


## Incremento 229 — Concorrência e repetição da retomada, 12/09/2026

Teste de integração executa duas transações concorrentes com chaves diferentes para retomar a mesma reserva de origem. Uma vence, a outra é recusada; banco conserva somente origem e nova reserva, um vínculo e um evento de confirmação. A ação pública repete a tentativa vencedora e retorna o mesmo resultado.

Depois de expirar a nova reserva, repetição conserva seu estado expirado e retorna o resultado histórico sem reativar horários. Desativar o executor impede nova consulta idempotente pela ação. Quatro integrações direcionadas passaram; demais 57 casos não selecionados. TypeScript, lint e diff check aprovados. Evidência: docs/validacao-concorrencia-retomada-229-2026-09-12.json. Não houve alteração de código de produção ou migration; build mais recente permanece 228 e regressão integral 221.

Validação de servidor não substitui ensaio interativo ou os fluxos contratuais pendentes. Sem produção ou envio externo.


## Incremento 274 — Conferência dos pagamentos de entrada das particulares, 13/09/2026

Consulta e tela /matriculas/[id]/entrada-particular conferem os pagamentos da preparação particular, com acesso de Secretaria/Financeiro/Administração e papel ativo revalidado. A tela de emissão inicial oferece o acesso para particulares. Projeta identificação mínima da matrícula/aluno, versão das condições, cobranças de entrada e recebimentos confirmados; não retorna contatos, documentos ou snapshots.

A conferência exige preparação particular assumida, condições/pagador atuais e emissão inicial conferida vinculada à mesma versão. Compara o plano de cobrança das condições à memória de emissão, vínculos ItemEmissaoEntrada e cobranças existentes. Divergências de valor, moeda, vencimento, cobertura, minutos ou vínculo exigem regularização. Usa o fuso da emissão preservada para conferir o vencimento, sem substituí-lo pela configuração atual da escola.

Por hora sem adiantamento contratado confere somente a taxa; não cria nem exige mensalidade. Adiantamento obrigatório precisa estar integralmente recebido com confirmação/data; antecipação opcional não se transforma em requisito de ativação. Particular mensal respeita a exigência da primeira mensalidade: se dispensada antes da ativação, apresenta a emissão prevista nessa etapa. Cobrança cancelada é pendência. A consulta não registra recebimento, ativa matrícula, libera contrato ou consome a reserva; horários e aceite ainda precisam de validação própria.

Validação: 10 testes unitários do conferidor e 61 integrações de reserva/preparação aprovados. As quatro combinações particulares existentes agora conferem emissão, acesso comercial negado, ausência de campos privados, leitura pelo Financeiro, quitação real via ledger e usuário inativo recusado. Pagamentos preservados não são repetidos e a matrícula continua sem ativação por efeito da consulta. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-entrada-particular-274-2026-09-13.json.

Sem migration adicional. Última regressão integral: 273. Permanecem pendentes a ativação transacional particular, aceites/assinaturas aplicáveis, conversão dos horários reservados em encontros e consumo da reserva, além dos demais requisitos da SPEC. Esta conferência financeira é uma etapa preparatória; não declara Q100/Q111 ou a ativação concluídas. Sem homologação interativa, produção, importação ou envio externo.

## Auditoria 279 — Conclusão da preparação comercial ainda pendente

A conferência integrada de aceite (incremento 278) satisfaz somente o requisito documental. A revisão do caminho público concluirMatricula/ativarMatriculaTx identificou estes impedimentos concretos, que não podem ser considerados implementados com base em testes de aceite isolados:

| Requisito aprovado | Evidência no código atual | Entrega e verificação necessárias |
|---|---|---|
| Q119: primeira mensalidade dispensada como requisito de entrada é emitida na ativação | plano-cobrancas-entrada.ts seleciona ATIVACAO, mas ativarMatriculaTx exige uma mensalidade existente antes de avançar; não chama emitirEntradaTx nessa etapa | Integrar a emissão da versão contratada na mesma transação da ativação; provar que não duplica período, recebimento ou cobrança em repetição/falha |
| Q103/Q107–Q110: reserva de turma vira ingresso válido | PreparacaoComercialMatricula registra a reserva; o trecho de ativação não a utiliza nem cria AlocacaoTurma com matriculaId | Revalidar capacidade, publicação, professor, janela/exceção e reserva atual; criar vínculo da matrícula e marcar uso da reserva atomicamente |
| Q111: horários particulares garantidos viram encontros da contratação | exigirEntradaMensalRegistrada bloqueia particulares; ReservaAgendaParticular/HorarioReservaParticular ainda não são convertidos em encontros na ativação | Revalidar calendário, professor e conflitos; gerar EncontroAgenda por matrícula a partir dos horários autorizados, sem turma fictícia, com rastreabilidade e sem liberar o horário entre reserva e encontro |
| Q100: por hora aceita entrada sem mensalidade fictícia | Guard rejeita regime por hora no caminho mensal, corretamente sem substituir por mensalidade | Implementar ativação própria com taxa e eventual adiantamento contratado confirmado, preservando saldo/horas e deixando pagamento posterior para o fechamento aplicável |
| Q102: contratos do mesmo aluno são independentes | Caminho antigo ainda consulta status global do Aluno e conserva pressupostos de ativação mensal | Na nova ativação, preservar contratos excluídos e não reativar/pausar o cadastro inteiro; conferir explicitamente dados legados ambíguos, sem inferir vínculo acadêmico ou condições financeiras |

O fechamento da transação precisa incluir matrícula, ingresso/encontros, reserva, emissão de entrada aplicável e eventos, mantendo os recebimentos já confirmados. Repetição deve retornar o mesmo resultado e falha deve desfazer os novos efeitos conjuntamente. Ativar não deve inventar comissão ou tabela atual: responsabilidade comercial e política aplicável permanecem conforme as decisões aprovadas. Estes pontos são pendências de implementação, não novas escolhas de negócio nem autorização de migração de produção.

A migration de expansão 20260910010000 mantém explicitamente AlocacaoTurma_alunoId_ativa_key até migrar os consumidores globais, além do índice por matrícula. A liberação de múltiplos vínculos simultâneos exige tratar essa restrição e seus consumidores; adicionar matriculaId ao cadastro não conclui esse requisito.

## Incremento 280 — Ativação da preparação em turma, 13/09/2026

O caminho público de conclusão agora encaminha preparações comerciais em turma para ativarPreparacaoTurmaTx. Na mesma transação, revalida o usuário, aceite integrado de produção, condições aceitas, emissão inicial e pagamentos confirmados; confere reserva, capacidade, professor, calendário, produto e janela de entrada ou exceção aprovada. Converte a reserva em UTILIZADA, cria a alocação vinculada à matrícula e registra ativação, movimentação, comissão e eventos. Recebimentos exigidos são confirmados pelo Financeiro antes da conclusão.

A emissão da etapa ATIVACAO utiliza a versão contratada: cria a primeira mensalidade quando dispensada como pagamento prévio; não duplica a mensalidade já emitida nem os recebimentos. A comissão utiliza o responsável capturado na preparação e a política com vigência na data da contratação; ausência de política exige conferência. Repetição retorna o resultado existente. Falha após os efeitos reverte todo o ingresso e duas ativações concorrentes não duplicam reserva, alocação, cobrança, comissão ou evento.

Validação: 791 testes unitários e 79 integrações direcionadas aprovados, incluindo os dois regimes de exigência da primeira mensalidade, reversão e concorrência reais. TypeScript, lint direcionado e build Next.js com 52 páginas estáticas passaram. As duas expectativas antigas de mensagem foram ajustadas para os bloqueios anteriores do novo fluxo, preservando a verificação direta da política de entrada. Evidência: docs/validacao-ativacao-preparacao-280-2026-09-13.json. Última regressão integral de integração: 279; nenhuma migration adicional.

Limites: particulares mensais/por hora continuam exigindo ativação própria e conversão de horários reservados. O índice legado de uma alocação ativa por aluno e a conferência da situação global do cadastro permanecem; esta entrega não libera contratos simultâneos nem conclui Q102/B01. A ativação não presume doze mensalidades futuras; continuidade contratada mantém seu escopo próprio. Assinatura real com fornecedor, homologação interativa e demais requisitos da SPEC permanecem pendentes. Sem produção, importação ou envios externos.

## Incremento 281 — Ativação de particulares mensais e por hora, 13/09/2026

ativarPreparacaoTx agora atende turma e particular no caminho público concluirMatricula. Para particulares, resolve a cadeia atual da reserva e revalida horários preservados, professor ativo, calendário e conflitos sob bloqueio da agenda. Depois de conferir aceite integrado, condições, pagamentos e comissão, utiliza a reserva e cria EncontroAgenda com matriculaId, sem turma ou alocação fictícia. Preserva professor, instantes e fuso; o evento da ativação relaciona cada horarioReservaId ao encontroId criado. Conversão, emissão aplicável, ativação e eventos pertencem à mesma transação.

Mensalidade particular respeita a exigência registrada: pagamento inicial obrigatório precisa estar confirmado; quando dispensado antes da entrada, a primeira mensalidade é emitida na ativação. Por hora confere a taxa e eventual adiantamento obrigatório; sem adiantamento não cria mensalidade ou cobrança de horas fictícia. Recebimentos existentes permanecem preservados. O novo ingresso particular não altera outro contrato ou sua alocação ativa. Professor inativo, encontros já registrados nesta preparação ou alocação de turma na própria preparação exigem regularização.

Validação: 83 integrações aprovadas em reserva/preparação, ativação e Secretaria, com quatro novos cenários de particulares. Cobrem grade fixa/flexível, mensal/hora, pagamento inicial exigido/dispensado, reversão após criação dos encontros, concorrência real, repetição pública e preservação de outro contrato. Trinta testes unitários direcionados, TypeScript, lint direcionado sem avisos e build Next.js com 52 páginas estáticas aprovados. Evidência: docs/validacao-ativacao-particular-281-2026-09-13.json. Sem migration adicional; última regressão integral 279.

Limites atuais: src/server/diario/chamada-encontro.ts ainda recusa encontro sem turma e exige o fluxo individual. A entrega de ativação não conclui diário particular, apuração de ocorrências cobráveis, saldo persistente de horas antecipadas, próximos agendamentos flexíveis nem todo Q111. A exceção em dia não letivo ainda precisa alcançar a reserva particular. Permanecem a migração da situação global do aluno e das múltiplas alocações em turmas, além de fornecedor real de assinatura e demais requisitos da SPEC. Os processos de assinatura dos testes usam protocolo simulado, sem envio externo. Sem homologação interativa, produção ou importação.

## Incremento 282 — Diário de encontros particulares, 13/09/2026

AulaDiario admite turma nula somente quando identifica um encontro. A migration 20260914010000_diario_particular preserva contexto, autoria e data depois do registro e confere a correspondência entre diário e encontro. Não cria turma fictícia nem altera os diários existentes. A aplicação ocorreu somente no banco descartável local.

O professor atribuído acessa a chamada existente em /diario/encontros/[id] e salva por salvarDiarioParticular. O servidor deriva a matrícula do encontro, revalida o docente, o horário já terminado, o estado PREVISTO e o histórico daquele contrato. Aceita somente o aluno correspondente, sem dados financeiros ou contatos pessoais. Histórico insuficiente exige conferência. Conteúdo e presença podem ficar pendentes; salvar não conclui o encontro nem emite cobrança. Edição exige o estado atual do diário; autoria diferente exige regularização. O histórico geral apresenta Particular e encaminha edição pendente ao encontro, preservando o nome capturado na chamada.

A conclusão por exceção de gravação usa o fluxo independente existente, agora com matrícula no contexto revisado. Exige conteúdo, presença confirmada e outra pessoa da gestão para aprovação. Falta na particular não comprova aula ministrada: permanece ocorrência a conferir no fluxo próprio, sem gerar nota, presença ou cobrança automaticamente. Depois da conclusão, a edição direta fica bloqueada.

Validação: 83 integrações aprovadas (16 diário e 67 reserva/preparação), 12 testes unitários, TypeScript, lint direcionado sem avisos e build Next.js com 52 páginas estáticas. Schema diff vazio após 129 migrations. Uma fixture antiga passou a cadastrar o encontro antes de criar o diário, respeitando a preservação do vínculo. Evidência: docs/validacao-diario-particular-282-2026-09-13.json. Última regressão integral: 279.

Limites: conclusão regular com gravação integrada, responsável designado para regularização de autoria, correção aprovada da particular e apuração financeira de ocorrências/horas permanecem pendentes. O reconstrutor de situação contratual ainda exige conferência para encerramento sem histórico suficiente. Não houve homologação interativa, produção, importação ou envios externos; este incremento não conclui toda a operação particular nem toda a SPEC.

## Auditoria 283 — Continuidade do diário e da operação particular

A revisão após a expansão de AulaDiario confirmou que adicionar encontros e chamada não encerra a operação particular. As próximas entregas devem respeitar os seguintes limites observados no código:

| Requisito | Evidência atual | Critério da próxima entrega |
|---|---|---|
| Q07/Q75–Q82: conclusão regular com material autorizado | conclusao-contexto.ts confere diário; excecao-gravacao.ts conclui pela exceção. Não há publicação de gravação nesse fluxo | Integrar material oficial e seu estado de disponibilidade; acesso controlado pela matrícula; manter exceção independente para arquivo irrecuperável |
| Q23/Q24: correção oficial e responsável designado | particular.ts bloqueia edição de encontro concluído e autoria diferente | Proposta com anterior/novo/motivo, aprovação independente e efeitos conferidos; designação limitada sem trocar autoria original |
| Q91–Q93/Q101: ocorrência cobrável separada do diário | Particular ausente permanece PREVISTO; registrar diário não cria cobrança. Schema não contém o fechamento de ocorrências particulares | Registrar ocorrência e duração contratada com conferência própria; fechar período sem duplicar encontro e com aprovação de emissão parcial |
| Q87/Q96/Q97: horas antecipadas | CompraHorasAntecipadas e compra-horas.ts já persistem compra quitada e seus recebimentos; saldo-horas.ts e ocorrencia-horas.ts calculam reserva/consumo sem persistir esse ciclo | Integrar a compra à versão e aos minutos do adiantamento preparado; persistir reservas, consumos, validade e ajustes. Não duplicar o modelo de compra já existente nem tratar cálculo puro como saldo operacional |
| Q53/Q102: histórico por contrato | historico-situacao.ts reconstrói ativação, pausas e retomadas; encerramento insuficiente retorna A_CONFERIR | Preservar conferência até incorporar eventos de encerramento e dados migrados; outro contrato ativo não comprova elegibilidade |

Estes itens são pendências técnicas de requisitos já aprovados; não exigem presumir novas decisões do usuário. As verificações integrais e os ensaios operacionais devem continuar separados da declaração de cobertura funcional.

## Incremento 284 — Compra de horas da preparação aceita, 13/09/2026

registrarCompraHorasAntecipadas agora distingue preparação comercial de compra legada. Nas preparações exige aceite integrado vigente, regime HORA_PARTICULAR e cobrança vinculada à emissão inicial conferida da mesma versão das condições. Minutos, valor e moeda devem corresponder ao adiantamento contratado. Uma quantidade informada diferente não cria compra. Registra na memória preparação, condições, versão e emissão; conserva os recebimentos existentes e a idempotência da compra.

Quando o preço negociado aceito excede a referência da cobrança, a base da compra é o valor negociado, com desconto zero; o valor de referência permanece na memória. Quando existe desconto, preserva a diferença entre base original e valor pago. Isso evita desconto negativo sem alterar cobrança, preço contratado ou recebimento. Compras legadas mantêm seu fluxo de conferência próprio.

Validação: 71 integrações aprovadas em compra-horas e reserva/preparação, incluindo adiantamento aceito e pago, recusa de quantidade indevida, repetição e preservação de recebimentos. TypeScript, lint direcionado e build com 52 páginas estáticas aprovados. Sem migration adicional. Evidência: docs/validacao-compra-preparada-284-2026-09-13.json. Última regressão integral: 283.

Ainda faltam a persistência do ciclo de reservas/consumos, validade, pausa e acerto de saldo. Compra posterior fora do adiantamento inicial precisa de condições próprias; não pode reutilizar sua emissão ou inventar quantidade. O formulário existente continua exigindo conferência da quantidade; a validação autoritativa é do servidor. Sem homologação interativa, produção ou envios externos.

## Incremento 285 — Reserva persistente de horas compradas, 13/09/2026

ReservaHorasCompradas vincula compra, encontro, autor, minutos e intervalo preservado. O Financeiro pode reservar pelo painel de compras horas para encontro particular futuro já publicado da mesma matrícula ativa. O servidor deriva a duração do encontro; não aceita quantidade livre nesse passo. Travas da agenda, matrícula, compra e encontro serializam a operação. O banco impede ultrapassar a quantidade comprada, duplicar o encontro e alterar/apagar a reserva diretamente. Repetição idempotente não cria outra reserva nem recebimento.

O painel mostra minutos reservados e ainda não reservados, além dos vínculos por encontro, e oferece seleção de até 100 encontros futuros. A operação não cria agenda, não transfere saldo entre matrículas, não conclui aula nem registra consumo. Reserva não equivale a serviço prestado. No estado atual, a quantidade permanece comprometida até a implementação do fluxo de desfecho.

Validação: seis integrações aprovadas de compras/reservas, incluindo concorrência por saldo, idempotência, tentativa SQL acima do limite, outro contrato, pausa e recebimentos preservados. TypeScript, lint direcionado e build com 52 páginas estáticas aprovados. Migration 20260914013000_reserva_horas_compradas aplicada ao banco descartável; 130 migrations e schema diff vazio. Evidência: docs/validacao-reserva-horas-285-2026-09-13.json. Última regressão integral: 283.

Pendências: consumo por ocorrência conferida, devolução de disponibilidade por cancelamento, revisão de reservas afetadas por alteração de agenda, validade e pausa. A imutabilidade atual exige implementar eventos/decisões de desfecho, sem substituir o histórico. Ainda não se declara o ciclo completo de horas nem a SPEC concluídos. Sem homologação interativa, produção ou envios externos.

## Incremento 286 — Consumo por realização conferida, 13/09/2026

ConsumoHorasCompradas registra uma conferência imutável por reserva, com autor, motivo, estado do diário e data. Pelo painel financeiro, a equipe consulta a realização e confirma o consumo da quantidade reservada. O servidor confere matrícula/encontro da compra, intervalo preservado, horário terminado, autoria docente, conteúdo e presença do aluno. Uma revisão anterior perde validade quando o diário muda. Concorrência e repetição preservam um único consumo.

A realização pode estar registrada enquanto EncontroAgenda ainda está PREVISTO por pendência de gravação; essa pendência não bloqueia a conferência financeira. A operação não altera o status acadêmico, registra presença, cria cobrança ou recebimento. Falta/cancelamento não são classificados como realização. Reservados, consumidos e saldo ainda não reservado aparecem separados; consumir não devolve disponibilidade. O diário com horas consumidas deixa de aceitar edição direta pelo professor e exige correção com revisão dos efeitos financeiros.

Validação: 23 integrações aprovadas (compras e diário); os sete testes de compras foram repetidos após acrescentar a verificação da edição bloqueada. TypeScript, lint direcionado e build com 52 páginas estáticas aprovados. Migration 20260914020000_consumo_horas_realizadas aplicada somente no banco descartável; 131 migrations e schema diff vazio. Evidência: docs/validacao-consumo-horas-286-2026-09-13.json. Última regressão integral: 283.

Continuam pendentes os desfechos de falta/cancelamento cobrável, liberação de reserva, correção aprovada do consumo, validade, pausa e acerto de saldo. A conferência de realização não substitui esses fluxos e não conclui o ciclo completo de horas. Sem homologação interativa, produção ou envios externos.

## Incremento 287 — Integridade do consumo no banco, 13/09/2026

A inserção de ConsumoHorasCompradas agora também confere no PostgreSQL o autor ativo com papel financeiro/administrativo, reserva e compra, matrícula do encontro, intervalo preservado, diário com autoria compatível, conteúdo e presença única do aluno contratado. A correspondência exata do hash e a exigência de horário terminado permanecem verificadas pelo serviço; o trigger acrescenta integridade estrutural, sem substituir essas verificações.

Diário, presença e encontro vinculados a consumo ficam protegidos contra alterações diretas que mudem sua base. A conclusão acadêmica posterior de PREVISTO para MINISTRADO permanece permitida quando nenhum outro dado do encontro muda, preservando a separação entre conferência financeira e pendência de gravação. Correções que afetem a base financeira precisam do fluxo próprio ainda pendente. O guard de registros verifica também mudança para uma aula de destino já consumida.

Foram aplicadas, somente no banco descartável, as migrations 20260914023000_integridade_consumo_horas e 20260914024000_contexto_trigger_consumo. A segunda refina o acesso aos campos do trigger compartilhado entre tabelas e a verificação do destino; a primeira migration aplicada foi preservada. Total: 133 migrations; schema diff vazio.

Validação: 23 integrações de compras/diário aprovadas, com tentativas diretas no banco de consumo sem presença/papel, alteração de conteúdo/presença e cancelamento do encontro, além da conclusão acadêmica posterior permitida. TypeScript e lint direcionado aprovados. O código executável da aplicação não mudou; o build aprovado no incremento 286 permanece correspondente. Evidência: docs/validacao-integridade-consumo-287-2026-09-13.json. Última regressão integral: 283.

Continuam pendentes correção aprovada com ajuste financeiro, cancelamentos, liberação de horas, validade e acerto do saldo. Esta proteção impede reescrita silenciosa, mas não implementa essas operações. Sem homologação interativa, produção ou envios externos.

## Incremento 288 — Cancelamento acadêmico de particular pela escola, 13/09/2026

Professor atribuído ao encontro, Secretaria, Gerência Pedagógica ou Administração podem propor o cancelamento de uma particular contratada. Outra pessoa da Gerência Pedagógica/Administração decide; acúmulo de papéis não permite autoaprovação. Até aprovar, o encontro permanece previsto. A decisão válida aplica CANCELADO na mesma transação, com motivo e eventos vinculados à matrícula correspondente.

O serviço serializa com agenda e matrícula, confere papel ativo, autoria, estado do encontro e reservas atuais. Mudança de horário/professor/reserva exige rejeitar a proposta desatualizada e preparar outra. Solicitação e decisão repetidas não duplicam efeitos. Encontro com diário ou consumo registrado é bloqueado e exige correção própria, ainda incompleta. Proposta e decisão são imutáveis no banco; o banco também exige decisor ativo, autorizado e diferente do preparador. A comparação completa do estado e aplicação da agenda são garantias do serviço, não de um trigger universal de agenda.

Interface disponível em /diario/encontros/[id]/cancelamento, com entrada pela lista de encontros e pela página acadêmica. Secretaria consulta somente a projeção operacional da lista, sem ampliar acesso ao diário, cadastro ou financeiro. Professor continua limitado aos encontros atribuídos. A projeção acrescenta somente o indicador booleano de particular.

Este incremento entrega a decisão acadêmica, não Q95 inteiro: escolha do aluno entre remarcação/crédito, proposta financeira, liberação/reassociação de horas reservadas e acerto ainda precisam ser integrados. Cancelar não apaga recebimentos, não cria presença, não consome horas, não libera saldo nem devolve dinheiro. A interface avisa explicitamente que o acerto continua pendente. Avisos externos de Q38 ainda não são disparados por este fluxo.

Migration 20260914030000_cancelamento_particular aplicada somente no banco descartável. Total de 134 migrations, schema diff vazio. Evidências e resultados: docs/validacao-cancelamento-particular-288-2026-09-13.json. Última regressão integral permanece 283. Sem homologação interativa, produção ou envios externos.

## Incremento 289 — Liberação de horas para remarcação escolhida pelo aluno, 13/09/2026

Após o cancelamento da particular pela escola aprovado no incremento 288, o Financeiro pode propor a liberação da reserva de horas compradas. A proposta identifica a reserva, a decisão acadêmica, motivo e evidência da escolha do aluno por remarcação. Outra pessoa do Financeiro com financeiro.aprovar_acertos, ou Administração, aprova/rejeita. Autoaprovação é recusada mesmo com vários papéis.

A aprovação devolve os minutos à disponibilidade da compra por um registro de decisão imutável. A reserva original permanece no histórico. Consulta, nova reserva e trigger de saldo desconsideram somente reservas com liberação aprovada; propostas pendentes ou rejeitadas não liberam saldo. Aprovação repetida não amplia saldo. O banco impede duas liberações aprovadas para a mesma reserva, consumo de reserva liberada e alteração/remoção das propostas/decisões. Confere também papel, permissão, outro aprovador, correspondência da reserva, cancelamento acadêmico aprovado e ausência de consumo.

Serviços usam bloqueio de calendário, matrícula e autor vigente. Uma nova reserva continua exigindo matrícula ativa, encontro futuro da mesma contratação e saldo suficiente. A liberação é possível sem reativar uma matrícula pausada; não agenda aula nem muda validade por si só. Nenhuma cobrança ou recebimento é criado/alterado. O painel de compras apresenta a reserva liberada, histórico das propostas, evidência e decisão; esconde conferência de consumo de encontros cancelados/liberados. A consulta financeira reconfere o papel ativo.

Q95 continua parcial: a alternativa de crédito financeiro e a criação/remarcação do encontro com aprovação de agenda ainda precisam ser integradas. O ciclo aqui permite reservar o saldo liberado para outro encontro já autorizado/publicado da mesma matrícula; não publica uma nova aula implicitamente. Falta/cancelamento pelo aluno, correção de consumo, validade e acerto de encerramento continuam pendentes no ciclo persistente das horas.

Migration 20260914033000_liberacao_horas_remarcacao aplicada somente no banco descartável: 135 migrations, schema diff vazio. 29 integrações de compras, cancelamento acadêmico e diário aprovadas, incluindo liberação independente, idempotência, uso concorrente do saldo liberado, preservação dos recebimentos, rejeição, falta de cancelamento aprovado e revogação de acesso. TypeScript e lint direcionado aprovados. Evidência completa: docs/validacao-liberacao-horas-289-2026-09-13.json. Última regressão integral permanece 283; sem homologação interativa, produção ou envios externos.

## Incremento 290 — Remarcação vinculada à particular cancelada, 13/09/2026

Secretaria/Gerência Pedagógica/Administração preparam novo horário e professor para particular cancelada pela escola, com escolha do aluno documentada. Outra pessoa da Gerência Pedagógica/Administração aprova e publica o novo encontro na mesma transação. O original permanece cancelado e vinculado ao sucessor pela decisão. Proposta/decisão imutáveis, idempotência por operação e unicidade da remarcação aprovada impedem publicar duas aulas para a mesma origem.

Preservar a matrícula e a duração do encontro original. Data/hora são resolvidas no fuso informado, sem escolher silenciosamente horário ambíguo/inexistente. Conferir todo o intervalo no calendário/fuso institucional, encontros do professor ou matrícula, indisponibilidades aprovadas e reservas comerciais ativas/mantidas. Professor precisa estar ativo; matrícula, ativa. Calendário ou contexto diferente daquele conferido exige nova proposta. A consulta mostra a conferência atual e pendências; a aprovação reconfere dentro dos bloqueios de calendário/matrícula/autor/configuração/professor. Rejeição continua possível para proposta inviável.

Exceção em dia não letivo exige justificativa específica na proposta, apresentada na tela e incluída na aprovação independente. Não dispensa conflitos ou indisponibilidade. Atravessar meia-noite é permitido preservando duração. Este fluxo não altera duração/preço contratados; mudanças desses termos seguem ajuste próprio.

Quando o original tem reserva de horas compradas, exigir liberação financeira aprovada conforme incremento 289 antes de submeter a remarcação. Publicar não cria cobrança/recebimento nem reserva horas automaticamente: o painel financeiro permite vincular o saldo liberado ao novo encontro da mesma contratação. O teste de ciclo pago cobre cancelamento, liberação independente, remarcação aprovada e reutilização de horas sem novo recebimento/cobrança.

Interface: /diario/encontros/[id]/remarcacao, acessível à equipe organizadora pelo cancelamento. Professor não recebe autorização para preparar remarcações por esta entrega. Propostas e decisões preservam evidência da escolha, exceção, origem e novo encontro. SQL reforça origem correspondente, aprovador independente/ativo/autorizado, matrícula/duração/estado do par de encontros e unicidade; a conferência completa de conflitos/calendário permanece no serviço.

Migration 20260914040000_remarcacao_particular aplicada somente no banco descartável: 136 migrations, schema diff vazio. Evidência: docs/validacao-remarcacao-particular-290-2026-09-13.json. Última regressão integral permanece 283. Q95 continua parcial pela alternativa de crédito financeiro; notificações Q38 ainda não integradas ao fluxo. Não há promessa de conclusão de validade/encerramento/correções financeiras das horas. Sem homologação interativa, produção ou envios externos.

## Incremento 291 — Crédito por horas canceladas pela escola, 13/09/2026

O destino da reserva cancelada passa a ser REMARCACAO ou CREDITO, com escolha documentada do aluno, proposta do Financeiro e aprovação de outra pessoa do Financeiro com financeiro.aprovar_acertos ou Administração. A decisão aprovada é única por reserva, tornando os destinos mutuamente exclusivos. Propostas antigas preservam destino REMARCACAO e a idempotência dos pedidos sem destino explícito. O campo interno evidenciaEscolhaRemarcacao é conservado por compatibilidade, mas representa a evidência da escolha em ambos os destinos.

Para crédito, calcular pela proporção dos minutos sobre o valor efetivamente pago na compra original, já com o desconto original, sem reprecificar pela tabela atual. A memória guarda compra, moeda, minutos, valor pago, descontos, conversões anteriores e valor proposto. Arredondar o valor acumulado proporcional em duas casas, HALF_UP, e subtrair créditos anteriores, evitando criação/perda de centavos por fragmentação. Valor zero após arredondamento é preservado com seus minutos; não representa dinheiro disponível adicional. Mudança nas conversões anteriores exige rejeitar/repreparar a proposta antes de aprovar.

A aprovação cria CreditoMatricula na mesma transação da decisão. SQL confere origem, matrícula, moeda, decisão aprovada de crédito, valor original/arredondamento acumulado e exige o registro monetário antes do commit. Crédito é imutável; recebimento/cobrança originais não são alterados. Minutos convertidos saem da disponibilidade, mas não aparecem como aula realizada/consumo. Consulta, reserva, SQL de saldo e remarcação distinguem a conversão de uma liberação para novo encontro. Consumo e nova liberação das mesmas horas permanecem bloqueados.

O painel financeiro oferece as duas escolhas e apresenta memória de cálculo e crédito apurado. Não aplica o crédito automaticamente a cobranças e não afirma que houve devolução. Uso do crédito e devolução com concordância, aprovação e execução continuam pendentes (Q68/Q69). A origem implementada exige compra paga e reserva identificadas; outros tipos de crédito precisam de origem própria, sem reutilizar este registro indevidamente. Q95 avança na alternativa monetária, mas os fluxos de destinação/devolução e notificações externas ainda não estão completos.

Migration 20260914043000_credito_horas_canceladas aplicada apenas no banco descartável: 137 migrations, schema diff vazio. 35 integrações de compras, cancelamento/remarcação e diário aprovadas. Validado bloqueio de dupla destinação, cálculo original, saldo indisponível para nova reserva inclusive por SQL, decisão monetária atômica, crédito imutável, revisão de proposta desatualizada e soma exata de créditos parciais. Corrigida durante os testes a comparação da memória JSON para independência da ordem das propriedades após persistência em JSONB. TypeScript/lint direcionado/build aprovados; evidência em docs/validacao-credito-horas-291-2026-09-13.json. Última regressão integral: 283. Sem homologação interativa, produção ou envios externos.

## Incremento 292 — Proposta de utilização de crédito, 13/09/2026

PropostaUsoCredito identifica crédito, cobrança, valor, concordância do aluno, motivo, preparador, versão e snapshot de conferência. Financeiro/Administração com papel ativo prepara. Versões e valores anteriores são imutáveis; repetir a chave com os mesmos dados normalizados não duplica a proposta. Guardar a proposta não reserva crédito, não aprova uso, não altera cobrança, não aumenta valorRecebido e não cria Recebimento.

O recorte disponível prepara destinação a cobrança da mesma matrícula e moeda, pendente/atrasada, sem suspensão por pausa, cancelamento ou comprovante em conferência. Confere recebimentos tipados e saldo armazenado contra o valor devido. Valor proposto precisa ser positivo, com até duas casas e dentro do crédito e saldo devedor. SQL reforça autor ativo/financeiro, matrícula, moeda, estado e limites de valor. A conferência completa dos recebimentos/informes permanece no serviço. Propostas não comprometem o saldo; seu somatório não representa utilização aprovada.

Tela /alunos/[id]/creditos/[creditoId] acessível pelo crédito no painel de compras. Mostra crédito apurado, cobranças candidatas e versões não aplicadas. A interface explicita que aprovação/aplicação ainda não estão disponíveis. Consulta restringe aluno e papel financeiro; professor não acessa os dados.

Este incremento NÃO conclui Q68: faltam aprovação independente, movimento de utilização, disputa de saldo com devolução, revalidação do destino e contabilização efetiva. Destinação explícita entre contratos do mesmo aluno também permanece pendente; limitar esta preparação à mesma matrícula não define proibição definitiva nem autoriza redistribuição automática. Outros alunos não podem receber esse crédito.

### Dependência encontrada para aplicação correta

O código atual ainda usa valorNegociado menos valorRecebido em financeiro/regras.ts (saldoAtual/pagamentoConfirmado), financeiro/recebimentos.ts (saldo/excedente da nova baixa), financeiro/consultas.ts (indicadores), ajustes/acoes.ts e ajustes/consultas.ts, retomada/regras.ts e matricula/recebimento-preservavel.ts. Há também cálculos numéricos compartilhados em _shared/regras.ts. Aplicar crédito como se fosse Recebimento criaria dinheiro fictício; alterar apenas Cobranca.saldo deixaria esses consumidores contraditórios.

Antes de habilitar aprovação/aplicação, implementar movimento de liquidação por crédito separado de caixa, adaptar leituras/recalculos e critérios de quitação, preservar valor negociado/recebido original, conferir efeitos em ativação, retomada, ajustes, emissão/encerramento e cobrança automática. Esta lista é uma dependência técnica apurada, não uma alegação de implementação concluída. A proposta guarda a base para revalidação, sem liberar uma aplicação incompleta.

Migration 20260914050000_proposta_uso_credito aplicada somente no banco descartável: 138 migrations, schema diff vazio. 14 integrações de compras/horas/crédito aprovadas; novos casos verificam proposta idempotente/versionada sem efeitos financeiros, valores e estados inválidos, vínculo/moeda, imutabilidade e escopo de acesso. TypeScript/lint direcionado aprovados. Evidência: docs/validacao-proposta-uso-credito-292-2026-09-13.json. Última regressão integral permanece 283. Sem homologação interativa, produção ou envios externos.

## Incremento 293 — Aprovação e aplicação de crédito, 13/09/2026

DecisaoUsoCredito registra aprovação ou rejeição imutável. Outro Financeiro com financeiro.aprovar_acertos ou Administração decide; acúmulo de papéis não permite autoaprovação. A aprovação revalida versão, concordância registrada, cobrança, moeda e saldo disponível dentro da transação. Repetição da mesma decisão é idempotente. Alterações na cobrança invalidam a proposta anterior para aplicação e exigem nova conferência.

A utilização aprovada liquida a cobrança por valorLiquidadoCredito, separado de valorRecebido e de Recebimento. Não cria entrada de caixa. O saldo disponível do crédito é o valor inicial menos utilizações aprovadas. Bloqueios transacionais e validação SQL impedem utilização excedente e alteração incoerente do saldo derivado. A interface permite aprovar/rejeitar e consultar decisões; a preparação continua sem reservar saldo.

Cálculo de saldo, confirmação de quitação, recebimento posterior em dinheiro, indicadores financeiros, ajustes e retomada passam a considerar a liquidação por crédito. A conferência aritmética de pausa/retomada reconhece crédito integral mesmo com valorRecebido nulo. Pagamento misto preserva apenas o dinheiro efetivamente recebido no caixa. Alterar valor negociado para menos que o total já liquidado exige revisão.

Este recorte atende utilização na mesma matrícula e moeda. Destinação explícita entre contratos do mesmo aluno, devolução de dinheiro e concorrência com devoluções permanecem pendentes. Compras antecipadas ainda exigem conciliação integral dos recebimentos; encerramento com crédito aplicado ainda pode exigir conferência por seus validadores anteriores. Esses caminhos não estão declarados concluídos. Falta ampliar a validação integrada de todos os consumidores financeiros e homologar a interface. Q68 e o objetivo geral permanecem incompletos.

Migration 20260914053000_liquidacao_credito aplicada somente no banco descartável, totalizando 139 migrations e schema diff vazio. Evidência detalhada em docs/validacao-liquidacao-credito-293-2026-09-13.json. A última regressão integral permanece no incremento 283. Sem produção ou envios externos. As descrições dos incrementos anteriores são registros históricos; este incremento substitui a indicação de que aprovação/aplicação de crédito não estavam disponíveis.
## Incremento 294 — Compra de horas com quitação por crédito, 13/09/2026

RegistrarCompraHorasAntecipadas aceita cobrança integralmente liquidada com dinheiro, crédito aprovado ou ambos. Confere os Recebimentos detalhados contra valorRecebido e as utilizações aprovadas contra valorLiquidadoCredito; a soma precisa corresponder ao valor negociado. Moeda e matrícula das origens são conferidas. Crédito apenas proposto não compõe quitação. Versão da cobrança, contrato, autor financeiro, impedimentos e idempotência permanecem exigidos.

ValorPagoAlocado representa o valor total liquidado alocado à compra, não uma nova entrada de caixa. Snapshot imutável discrimina valorEmDinheiro, valorEmCredito, valorTotal e cada proposta/decisão/crédito utilizado. Preserva preço original e desconto. Nenhum Recebimento é criado ou alterado ao identificar a compra. Isso permite converter novamente horas canceladas em crédito pela regra já existente, conservando a cadeia de origem e sem devolver disponibilidade ao crédito anteriormente utilizado.

O painel de compras mostra a composição da quitação. Compras antigas sem essa memória não recebem uma composição inventada; a tela orienta consultar os registros de origem. A consulta fornece somente o resumo necessário, sem expor o snapshot integral.

Validação direcionada: 19 integrações de compra/horas/crédito; casos novos cobrem quitação integral por crédito com valorRecebido nulo e quitação mista, desconto, idempotência, fontes preservadas e resumo da consulta. Evidência: docs/validacao-compra-credito-294-2026-09-13.json. Sem nova migration (139 existentes); sem produção ou envios externos. Última regressão integral permanece 283.

Pendências: encerramento com crédito aplicado ainda necessita adaptação conjunta do contexto, cálculo proporcional, outras cobranças e compensações. A integração de devoluções e utilização entre contratos continua pendente. Este incremento não declara esses fluxos concluídos nem altera suas regras aprovadas. Falta homologação interativa.
## Incremento 295 — Crédito utilizado na apuração de encerramento, 13/09/2026

O contexto de encerramento confere as utilizações de crédito aprovadas contra o saldo liquidado da cobrança, com referências de proposta, decisão e origem. Confere moeda e matrícula; dinheiro continua conciliado somente contra Recebimentos. Quitação integral por crédito com valorRecebido nulo não gera pendência fictícia de recebimento.

Proporcional mensal, demais cobranças e compensações de cobertura passam a deduzir do valor devido a soma de dinheiro e crédito já aplicado. O excedente compõe apenas a apuração do acerto. As origens permanecem separadas: recebido/valorRecebido conserva dinheiro, creditoLiquidado/valorLiquidadoCredito identifica crédito anterior. Crédito disponível ainda não utilizado não é automaticamente abatido. Campos novos são opcionais para preservar leitura de memórias anteriores sem crédito.

A tela do acerto distingue recebido em dinheiro e liquidado por crédito. Nenhum crédito de origem é reaberto; a apuração não cria um novo saldo utilizável, não altera cobranças, não cria Recebimento nem executa devolução. A efetivação financeira do acerto e a proteção contra destinação duplicada ainda precisam ser concluídas antes de declarar o encerramento integralmente funcional.

Validação: 24 testes unitários em quatro arquivos e 28 integrações em três arquivos. Incluem proporcional com crédito parcial/integral, combinação com compensações sem duplicar dias, demais cobranças com quitação mista, e contexto carregado de utilizações reais aprovadas no banco. Evidência: docs/validacao-encerramento-credito-295-2026-09-13.json. Sem nova migration. Última regressão integral permanece 283; sem homologação interativa, produção ou envios externos.
## Incremento 296 — Horas antecipadas na prévia de encerramento, 13/09/2026

A prévia e o rascunho de encerramento carregam automaticamente as compras de horas da matrícula, seus consumos registrados, reservas ainda não resolvidas e créditos anteriormente emitidos. A apuração usa preço/desconto originais; a referência financeira é a cobrança de origem, que pode estar liquidada por dinheiro, crédito ou ambos. Reservas liberadas para remarcação deixam de comprometer horas; reservas convertidas em crédito são liquidações anteriores e não geram novo crédito pela mesma quantidade.

Reservas não resolvidas geram pendência e impedem o cálculo de horas. O componente aparece na tela e no snapshot quando há compras; alterações posteriores nas origens invalidam a conferência por comparação do snapshot. Sem compras, a forma anterior é preservada. O componente não é somado automaticamente ao subtotal das demais cobranças: a consolidação deve evitar apurar novamente a cobrança que originou uma compra.

26 integrações aprovadas em compra-horas e encerramento-solicitacao, incluindo leitura de liquidações reais, reserva pendente, saldo remanescente sem repetir crédito e recusa de outro aluno. Sem nova migration, produção ou envio externo. Ainda pendentes: consolidação sem sobreposição de componentes, aprovação e efetivação financeira integral, devoluções e homologação interativa. Este incremento integra uma dependência real da efetivação, mas não declara o encerramento concluído. Última regressão integral: 283.
## Incremento 297 — Consolidação da prévia de encerramento, 13/09/2026

A prévia agrega mensalidades após compensações, multa proposta, outras cobranças independentes e saldo de horas antecipadas por matrícula/moeda. Mantém saldo devido e crédito apurado separados, sem compensação automática. A multa proposta substitui a contratual no total apresentado, sem autorizar a exceção; ambas ficam identificadas.

Cobranças que originaram compras de horas são identificadas e excluídas da soma de outras cobranças. Sua conferência deve preservar a quitação original, sem propor ajuste duplicado; o direito restante é apurado pelo componente de horas. Reservas pendentes, componentes incompletos e sobreposição de ajustes impedem apresentar um total consolidado disponível para revisão. A tela mostra os totais e pendências, que também integram o snapshot do rascunho. Rascunhos anteriores sem consolidação precisam de nova conferência.

Validação: 10 unitários e 5 integrações, lint e build com 52 páginas estáticas aprovados. Cobertura inclui multa proposta uma única vez, separação entre crédito e dívida, compra de horas excluída do subtotal independente e bloqueio de ajuste duplicado/reserva pendente. Sem nova migration. Última regressão integral permanece 283. Ainda faltam aprovação e efetivação financeira integral; prévia não emite crédito, utiliza saldo ou devolve dinheiro. Sem homologação interativa, produção ou envios externos.
## Incremento 298 — Regressão completa após créditos e encerramento, 13/09/2026

Suítes completas executadas: 804 testes unitários em 87 arquivos e 665 testes de integração em 51 arquivos, todos aprovados. A integração rodou uma única vez, serialmente, em localhost:54329/erp_genius_test, terminou com exit code 0 e levou 640,60 segundos. TypeScript, lint direcionado e comparação schema/banco aprovados (diff vazio). Último build aprovado: incremento 297, sem mudança posterior no código de produção.

A primeira execução unitária encontrou quatro falhas em duas fixtures que não continham valorLiquidadoCredito, campo obrigatório com default zero no schema. Fixtures atualizadas sem enfraquecer as expectativas. Dois casos adicionais cobrem ajuste abaixo da quitação mista recusado e ajuste válido que preserva dinheiro/crédito separados. A suíte unitária completa foi repetida após as alterações e passou.

Esta é a nova referência de regressão integral, substituindo 283. Evidência: docs/validacao-regressao-298-2026-09-13.json. Os resultados comprovam somente a cobertura automatizada existente; não declaram todas as funcionalidades implementadas. Permanecem as pendências de aprovação/efetivação do acerto, devoluções, destinação entre contratos e demais itens do plano. Sem homologação interativa, produção ou envios externos.

## Incremento 299 — Decisão independente do acerto, 13/09/2026

DecisaoAcertoEncerramento registra decisão imutável por versão do rascunho, decisor, motivo e autorizações explícitas de retroatividade/exceção de multa. Outro Financeiro com financeiro.aprovar_acertos ou Administração decide; o preparador não aprova mesmo acumulando papéis. A ação serializa pelo pedido e revalida a versão mais recente, origens atuais e consolidação sem pendências antes de aprovar. Mudança de origens exige nova conferência. Rejeição pode resolver uma versão desatualizada sem aplicar valores. Repetição idêntica é idempotente.

A interface oferece decisão aos usuários elegíveis e exibe o resultado registrado. Aprovação não encerra matrícula, altera cobrança, emite crédito ou devolve dinheiro. Efetivação permanece pendente e deverá revalidar novamente versão, origens e decisão. Uma aprovação anterior não torna válida uma nova versão nem autoriza executar origens modificadas.

Migration 20260914060000_decisao_acerto_encerramento: 140 migrations no banco descartável, schema diff vazio. SQL reforça imutabilidade, independência, papel/permissão, versão e autorizações explícitas; conferência integral das origens e consolidação está no serviço. Integração cobre decisão concorrente idempotente, autoaprovação recusada, escopo de aluno, decisão imutável, cobrança/matrícula preservadas, origem modificada recusada e rejeição. As cinco integrações do arquivo encerramento-solicitacao passaram; TypeScript, lint e build aprovados. Última regressão completa permanece 298. Sem homologação interativa, produção ou envios externos. Efetivação financeira integral ainda não implementada.
### Complemento de validação do incremento 299

Sete integrações de encerramento-solicitacao aprovadas após acrescentar cenários independentes de retroatividade e dispensa de multa. O Financeiro sem financeiro.aprovar_acertos é recusado; com permissão, continua impedido de aprovar sem a autorização específica. Inserção direta da decisão no banco também recusa cada exceção não autorizada. Com a autorização explícita, registra a decisão e preserva matrícula ativa. TypeScript e lint do teste aprovados; nenhum código de produção alterado neste complemento. Efetivação financeira continua pendente.

## Incremento 300 — Plano de lançamentos do acerto, 13/09/2026

A prévia/snapshot passa a conter lançamentos previstos por origem: ajustes das cobranças, valor devido após acerto, saldo restante, crédito apurado, valor recebido preservado, crédito anteriormente liquidado e vencimento preservado. Multa mantém condição original e valor proposto. Compras de horas são preservadas como origem; horas restantes e compensações mantêm as referências necessárias para posterior liquidação.

O plano confere a soma dos saldos e créditos contra a consolidação, rejeita cobrança repetida/origem incompatível e fica indisponível com componentes pendentes. Crédito por cobrança e crédito por compra de horas têm tipos de origem diferentes. A tela apresenta detalhamento dos lançamentos do rascunho sem expor o snapshot bruto nem somar os detalhes novamente ao total.

Onze unitários e sete integrações aprovados; lint e build aprovados. Testes adicionais conferem quitação mista preservada, vencimento original, crédito por origem, ausência de mutação, bloqueio com reserva pendente e divergência entre lançamentos e total. A inclusão no snapshot exige nova conferência de rascunhos anteriores antes de nova aprovação. Não houve migration. Última regressão integral: 298. Persistência/aplicação dos lançamentos e encerramento efetivo continuam pendentes; nenhum movimento financeiro foi executado neste incremento. Sem homologação interativa, produção ou envio externo.
## Incremento 301 — Origem persistente dos créditos de encerramento, 13/09/2026

OrigemCreditoAcerto identifica decisão aprovada, matrícula, moeda, tipo de origem (cobrança ou compra de horas), identificador e valor. SQL exige correspondência com o plano de lançamentos preservado na decisão e impede duplicar a mesma origem. Registro imutável. CreditoMatricula passa a exigir exatamente uma origem: liberação de horas canceladas ou origem de acerto. O crédito deve corresponder ao valor, matrícula e moeda da origem. Créditos antigos conservam sua cadeia de cancelamento.

A memória de utilização inclui origemAcertoId quando aplicável. O cálculo de créditos por cancelamento continua restrito às origens de cancelamento, com conferência explícita da relação. Migration 20260914063000_origem_credito_acerto aplicada somente ao banco descartável: 141 migrations, schema diff vazio.

28 integrações em encerramento-solicitacao e compra-horas aprovadas. Casos novos exercitam a persistência diretamente no banco de teste: origem com valor/matrícula divergentes recusada, crédito sem origem ou duplicado recusado, correspondência do crédito com o plano aprovado e preservação de origens anteriores. TypeScript/build e lint aprovados.

Este incremento fornece a estrutura de persistência; não oferece uma ação pública para emitir crédito de encerramento isoladamente. A aplicação final deverá revalidar decisão/versão/origens e gravar créditos, ajustes, liquidação de horas e encerramento na mesma transação. Os testes de estrutura não comprovam essa execução completa. Última regressão integral: 298; sem homologação interativa, produção ou envios externos.
## Incremento 302 — Vencimento da multa no acerto, 13/09/2026

Conferência da multa permite informar vencimento civil explícito. Se o valor proposto for positivo, a consolidação permanece pendente até registrar data válida. Dispensa integral/valor zero não exige vencimento nem implica emitir cobrança. Não se presume prazo ou vencimento a partir da data de execução.

O vencimento integra entrada, snapshot e plano de lançamentos, sendo mostrado ao revisor. Alterá-lo exige nova conferência da versão e aprovação correspondente, seguindo a revalidação existente. A futura aplicação usará a data aprovada, mantendo a multa separada dos recebimentos e dos ajustes originais.

12 unitários e 7 integrações aprovados; lint, TypeScript e build com 52 páginas aprovados. Casos novos: multa positiva sem data bloqueada, data conferida preservada, data civil inexistente recusada e dispensa sem cobrança programada. Sem migration. Última regressão integral: 298. Efetivação financeira ainda pendente; sem homologação interativa, produção ou envios externos.
## Incremento 303 — Revalidação transacional da efetivação, 13/09/2026

carregarAcertoAprovadoParaEfetivacaoTx fornece a guarda interna de aplicação. Confere decisão e aluno, trava agenda/pedido/matrículas/cobranças/documentos, verifica executor financeiro vigente e aprovador ativo/autorizado, versão mais recente, igualdade das origens com o snapshot aprovado, autorizações de exceção e plano sem pendências. Data efetiva precisa ter chegado no fuso institucional. Vínculo legado ativo sem matrícula exige conciliação.

A guarda recebe a transação do chamador: futura gravação dos efeitos deve ocorrer nela, antes de liberar os locks. Não é uma autorização reutilizável fora da transação e não aplica lançamentos isoladamente. Também não existe nova ação pública que alegue efetivação concluída.

Sete integrações de encerramento-solicitacao aprovadas, com casos adicionais: execução antecipada recusada, seleção contratual preservada, aprovador desativado recusado, mudança no pedido invalidando aprovação e nova versão impedindo aplicação da anterior. TypeScript e lint aprovados. Sem alteração de schema ou UI; último build 302. Última regressão integral 298. Persistência dos efeitos e encerramento efetivo ainda pendentes; sem produção ou envios externos.
## Incremento 304 — Aplicação interna dos ajustes por cobrança, 13/09/2026

AjusteCobrancaAcerto preserva decisão, executor, cobrança, versão e valor anteriores, novo valor, crédito apurado, moeda e snapshot da origem. A cobrança admite um registro de acerto; o histórico é imutável. SQL exige decisão aprovada, executor financeiro ativo, correspondência do valor ao plano e conferência do crédito apurado. A inserção atualiza valor negociado, saldo, versão e situação na mesma transação, mantendo recebimentos, valorRecebido, crédito já liquidado e vencimento.

aplicarAjustesCobrancaAcertoTx é uma etapa interna que recebe a mesma transação da guarda de efetivação e dos demais efeitos. Não abre transação própria nem constitui ação pública de encerramento. Não emite crédito ou multa e não encerra matrícula isoladamente. Essas etapas ainda devem ser integradas antes da disponibilização pública.

Migration 20260914070000_ajuste_cobranca_acerto aplicada no banco descartável: 142 migrations, schema diff vazio. Sete integrações de encerramento-solicitacao aprovadas, incluindo ajuste de valor/saldo com origem preservada e falha posterior simulada que desfaz integralmente o histórico e a alteração. TypeScript e lint aprovados. Sem alteração de UI; último build 302. Última regressão integral 298. Sem homologação interativa, produção ou envios externos; objetivo geral não concluído.
## Incremento 305 — Créditos na transação dos ajustes, 13/09/2026

aplicarCreditosAcertoTx grava a origem aprovada e o crédito da matrícula usando a transação recebida. Crédito de cobrança exige que o ajuste da mesma decisão já tenha sido aplicado e que seu valor corresponda ao crédito apurado. Não cria recebimento nem modifica dinheiro recebido. Não oferece ação pública isolada.

Sete testes de integração aprovados no banco descartável, incluindo recusa de crédito antes do ajuste e falha simulada após a emissão: ajuste, origem e crédito são revertidos juntos, preservando a cobrança e o recebimento originais. TypeScript e lint direcionado aprovados. Sem alteração de schema ou UI. Última regressão integral: 298; último build: 302.

A execução completa do encerramento permanece pendente: integrar liquidação de horas e compensações, multa, encerramento dos vínculos selecionados e controle de repetição na mesma operação antes da exposição pública. O helper de créditos, por si só, não comprova esses efeitos. Sem homologação interativa, produção ou envios externos.
## Incremento 306 — Liquidação de horas no acerto, 13/09/2026

LiquidacaoHorasAcerto registra uma única destinação final por compra, com decisão aprovada, minutos e valor preservados. A conferência SQL compara o plano aprovado com consumos, créditos anteriores e reservas reais; reservas pendentes impedem a liquidação. Valor zero é permitido para registrar minutos cujo direito monetário já tenha sido absorvido pelo arredondamento acumulado.

Crédito positivo de compra exige liquidação correspondente na mesma transação, e liquidação positiva exige crédito. A consulta de compras desconta os minutos liquidados; a apuração posterior de encerramento considera essa destinação anterior. Novas reservas são recusadas no serviço e no banco, inclusive quando a matrícula ainda consta ativa. Não se criam recebimentos e não se alteram compras originais.

aplicarLiquidacaoHorasAcertoTx é etapa interna, sem ação pública isolada. A execução final ainda precisa integrar os demais efeitos e verificar SET CONSTRAINTS ALL IMMEDIATE antes de retornar sucesso: no ensaio, uma falha de constraint diferida no commit foi registrada pelo Prisma sem rejeitar a Promise; a conferência explícita dentro da transação detectou o erro corretamente. O banco reverte a operação inválida. Esse comportamento exige atenção na futura ação de efetivação.

Validação: 22 integrações de compra de horas aprovadas na execução final; outras 7 de encerramento aprovadas na execução anterior deste incremento. Sete unitários de apuração de horas aprovados. Casos novos: dependência bidirecional entre crédito e liquidação, rollback após falha, preservação do recebimento, histórico imutável, recusa de repetição, saldo zerado e bloqueio de reserva por serviço/SQL. O caso monetário zero ainda não teve novo cenário integrado específico neste incremento. TypeScript, lint, build com 52 páginas e diff sem erros aprovados; migration 20260914073000_liquidacao_horas_acerto aplicada apenas no banco descartável, 143 migrations e schema diff vazio.

Última regressão integral: 298. Efetivação completa, homologação interativa e objetivo geral continuam pendentes. Sem produção ou envios externos.
## Incremento 307 — Emissão interna da multa do acerto, 13/09/2026

MULTA_ENCERRAMENTO identifica a cobrança gerada pelo acerto, vinculada à decisão e à matrícula. Uma decisão admite uma multa por matrícula. O banco confere moeda, valor contratual original, valor proposto positivo e vencimento contra o plano aprovado; a emissão não registra dinheiro ou crédito recebido. Origem e vínculo são preservados, e a cobrança não pode ser apagada. Dispensa integral não gera cobrança.

aplicarMultasAcertoTx recebe a transação revalidada do acerto. Não fornece ação pública de emissão isolada; integrar todos os efeitos do encerramento continua obrigatório. Valor/vencimento posteriores seguem os fluxos financeiros aplicáveis. O novo tipo tem rótulo financeiro, mas não é ofertado nem aceito como preço de catálogo: sua origem é o contrato e o acerto aprovado.

Validação: 806 testes unitários em 87 arquivos; 10 integrações de encerramento e catálogo; TypeScript, lint sem avisos, build com 52 páginas e schema diff vazio aprovados. Casos adicionais cobrem multa de 80 com vencimento aprovado, dispensa sem cobrança, falha posterior desfazendo emissão, recusa de repetição, valor divergente, falta de origem e alteração/remoção da origem. Migration 20260914080000_multa_acerto aplicada somente no banco descartável; 144 migrations. Última regressão integral de integrações: 298. Sem homologação interativa, produção ou envios externos. Objetivo geral ainda incompleto.
## Incremento 308 — Destinação dos dias de compensação no acerto, 13/09/2026

DestinacaoDiaAcerto registra a decisão e o tratamento de cada dia: COMPENSACAO para o ajuste pelos dias ainda devidos, PROPORCIONAL para os já descontados pelo encerramento. O vínculo é único e imutável. A inserção exige dia pendente, compensação aprovada, correspondência ao plano da decisão e ajuste da cobrança aplicado; atualiza o estado para LIQUIDADO_FINANCEIRAMENTE com referência ao registro, data e incremento de versão.

aplicarCompensacoesAcertoTx é etapa interna da transação de efetivação. Não emite crédito adicional: o efeito monetário já pertence ao ajuste de cobrança. Dias anteriormente recompostos ou liquidados não são selecionados. O fluxo completo de encerramento e o tratamento dos vínculos/agenda ainda precisam ser integrados antes da disponibilização pública.

Sete integrações aprovadas, incluindo distinção entre dia anterior e posterior ao último dia coberto, recusa de tratamento divergente, exigência de ajuste, recusa de repetição/apagamento e rollback de dias e cobrança após falha. No cenário de mensalidade de 400 e encerramento no dia 15 de um período de 30 dias, um dia de compensação reduz os 200 para 186,67; o dia 20 já descontado pelo proporcional não gera novo abatimento. Quatro unitários de compensação aprovados. TypeScript, lint e schema diff vazio aprovados. Migration 20260914083000_destinacao_compensacao_acerto aplicada somente no banco descartável, 145 migrations. Último build e suíte unitária integral: 307; última regressão integral de integração: 298. Sem alteração de interface neste incremento, homologação interativa, produção ou envios externos. Objetivo geral ainda incompleto.
## Incremento 309 — Origens acadêmicas na conferência do acerto, 13/09/2026

A prévia agora registra situação/ativação/versão de acesso da matrícula, vínculos de turma com datas e situação, encontros particulares com horário, professor, fuso e reservas de horas. Apenas a matrícula correspondente é consultada; o cadastro de outro aluno não pode ser usado para obter esses dados. A aprovação adquire a trava da agenda antes das demais travas, compatível com a execução e operações de particulares.

A comparação da versão aprovada passa a detectar alteração dos vínculos e encontros, além das origens financeiras. Versões antigas sem essas informações exigem nova conferência. A interface mostra os vínculos e a agenda revisados e informa que não houve cancelamento de aulas ou encerramento de vínculo. Essa conferência não equivale a autorizar alterações pedagógicas isoladas.

29 integrações de encerramento e compra de horas aprovadas, com casos novos: encontro em contrato excluído preserva a validade da aprovação; novo encontro ou alocação no contrato selecionado invalida a efetivação; consulta de outro aluno é recusada. TypeScript, lint, build com 52 páginas e diff sem erros aprovados. Sem migration. Última suíte unitária integral: 307; última regressão integral de integração: 298.

Ainda faltam o registro temporal do encerramento, a aplicação dos efeitos nos vínculos/acessos/agenda e a ação completa e repetível que reúna os componentes. O índice global legado de alocação e os consumidores que dele dependem também seguem pendentes de migração coordenada; este incremento não removeu essa proteção. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.
## Incremento 310 — Núcleo financeiro integrado do encerramento, 13/09/2026

aplicarFinanceiroEncerramentoTx reúne revalidação da decisão/origens, ajustes de cobranças, liquidação de horas, créditos, multas e destinação de compensações na transação recebida. A ordem respeita as dependências entre ajustes e crédito e entre liquidação de horas e crédito. SET CONSTRAINTS ALL IMMEDIATE confere ainda dentro da função as restrições diferidas, antes de retornar os identificadores dos componentes aplicados.

Não há ação pública para aplicar somente este núcleo. O chamador da efetivação completa deverá aplicar os efeitos acadêmicos, registrar o encerramento e concluir o pedido na mesma transação, incluindo controle de repetição. Não tratar o retorno financeiro como matrícula encerrada. Esta integração não executa devoluções, consome créditos disponíveis nem cria recebimentos.

29 integrações aprovadas nos arquivos de compra de horas e encerramento; após ajuste adicional do cenário de crédito de cobrança, as 7 integrações de encerramento foram repetidas e aprovadas. Os cenários de horas/crédito, multa, dispensa, compensação/proporcional e crédito de cobrança agora exercitam o núcleo integrado, com rollback simulado após a aplicação e preservação dos recebimentos. TypeScript, lint sem avisos e diff sem erros aprovados. Sem schema ou UI alterados; último build 309, última suíte unitária integral 307 e última regressão integral de integração 298.

Permanecem pendentes os efeitos acadêmicos e temporais do encerramento e a ação completa com controle de repetição. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.
## Incremento 311 — Registro temporal do encerramento e histórico contratual, 13/09/2026

RegistroEncerramentoMatricula preserva matrícula, decisão, situação anterior, data efetiva, fuso, inclusão/exclusão do dia, limite exclusivo do vínculo e data da aplicação. O banco confere as condições aprovadas e a conversão temporal e impede alteração/apagamento. registrarLimitesEncerramentoTx prepara esses registros na transação recebida, sem alterar sozinho o estado da matrícula ou os vínculos.

O leitor do histórico contratual passa a carregar esse registro. situacaoMatriculaNaAula reconhece ENCERRADA a partir do limite e reconstrói ATIVA/PAUSADA para aulas anteriores, quando há ativação e movimentos consistentes. Encerramento sem evidência temporal continua A_CONFERIR; o registro não inventa ativação nem libera uma matrícula encerrada para novas aulas.

807 unitários em 87 arquivos aprovados, incluindo 5 de histórico temporal. Integração: 8 testes de encerramento na execução final e 16 de diário na execução anterior. As duas regras de último dia foram testadas no banco em America/Sao_Paulo; o registro pertence apenas à matrícula escolhida, preserva os demais contratos e é desfeito com a transação. TypeScript, lint, build com 52 páginas e schema diff vazio aprovados. Migration 20260914090000_registro_temporal_encerramento aplicada apenas no banco descartável; 146 migrations.

Ainda integrar à efetivação final: fixar o fuso revisado na prévia, aplicar situação/vínculos/acesso, conferir agenda futura e concluir o pedido com controle de repetição. O núcleo de histórico não comprova todos os consumidores acadêmicos e filtros de listagem. Última regressão integral de integração: 298. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.
## Incremento 312 — Fuso institucional na versão aprovada do acerto, 13/09/2026

A prévia carrega e registra o fuso institucional com carregarFusoInstitucionalTx, mantendo a linha de configuração protegida por FOR SHARE durante a transação. Fuso ausente/inválido impede a conferência. A guarda de efetivação usa o mesmo leitor, e a comparação integral do snapshot detecta mudança de fuso após aprovação. Versões antigas sem a referência temporal precisam de nova conferência.

A interface apresenta o fuso da versão revisada, sem confundi-lo com a preferência de visualização ou com o fuso originalmente registrado no pedido. A data civil do pedido permanece preservada. O cálculo do limite temporal usa a referência revalidada e estável na transação.

30 integrações aprovadas em encerramento e compra de horas; novos casos verificam fuso capturado, mudança após aprovação recusada e ausência de configuração bloqueada. TypeScript, lint, build com 52 páginas e diff sem erros aprovados. Sem migration. Última suíte unitária integral: 311; última regressão integral de integração: 298. Efeitos acadêmicos e ação completa de encerramento ainda pendentes. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.
## Incremento 313 — Estado e vínculos das matrículas encerradas, 13/09/2026

aplicarEstadoEncerramentoTx registra os limites contratuais, muda somente as matrículas selecionadas para ENCERRADA e incrementa acessoVersao. Fecha os vínculos ativos capturados na conferência, preservando criadoEm, turma e matrícula. Vínculo cadastrado após o limite fica com intervalo vazio, sem fabricar uma data anterior à criação. Vínculos históricos e outros contratos permanecem preservados; vínculo ativo com data de encerramento contraditória exige conciliação.

A etapa registra uma MovimentacaoAluno de ENCERRAMENTO vinculada à matrícula e evento MatriculaEncerrada com decisão, registro temporal e vínculos fechados. Não altera o status global do aluno. O executor é o mesmo usuário validado pela guarda, agora incluído no resultado interno da revalidação.

Oito integrações de encerramento aprovadas, cobrindo inclusão/exclusão do último dia, fechamento do vínculo, preservação do histórico de outro contrato, incremento de acesso apenas na matrícula selecionada, movimentação e rollback conjunto de cadastro/vínculo/registro/financeiro. TypeScript, lint e diff sem erros aprovados. Sem migration ou UI neste incremento; último build 312, última suíte unitária integral 311, última regressão integral de integração 298.

Ainda integrar a conferência/destinação da agenda futura e a conclusão repetível do pedido antes de oferecer uma ação pública completa. Não há homologação interativa ou comprovação de todos os consumidores de acesso. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 314 — Conferência da agenda no limite contratual, 13/09/2026

A prévia apura o limite exclusivo no fuso institucional conforme inclusão/exclusão do dia. Encontros particulares PREVISTOS ou MINISTRADOS cujo fim ultrapasse esse limite são identificados em agendaEncerramento. A aprovação e a guarda de efetivação exigem regularização. Encontro que termina exatamente no limite não ultrapassa a cobertura; encontro que atravessa o limite exige conferência.

O acerto não substitui aprovação pedagógica de cancelamento. Usar o fluxo existente para os encontros canceláveis; diário/consumo e aula já ministrada exigem conferência da data efetiva ou correção aplicável, preservando evidências. Cancelados e rascunhos não ocupam esta pendência; rascunho não é aula publicada. A interface apresenta as pendências da versão revisada. Regularização muda a origem e requer nova versão do acerto.

32 integrações de encerramento/compra de horas aprovadas, incluindo os dois critérios de dia, término exato, cruzamento do limite, aula ministrada, cancelada e rascunho. TypeScript, lint, build com 52 páginas e diff sem erros aprovados. Sem migration; última suíte unitária integral 311 e última regressão integral de integração 298.

Ainda concluir a operação pública repetível e verificar sua composição com reservas, apurações por hora e demais consumidores. Este incremento não comprova todo o encerramento nem gera cancelamento/ajuste automático. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.
## Incremento 315 — Executor transacional e conclusão única do acerto, 13/09/2026

EfetivacaoAcertoEncerramento preserva pedido, decisão, executor, data e identificadores dos efeitos em registro único por pedido/decisão. A inserção confere aprovação, executor vigente, matrículas encerradas com registros temporais, ajustes, créditos, horas, multa e dias de compensação previstos; conclui o pedido na mesma transação. Registro de efetivação é imutável.

efetivarAcertoEncerramentoTx serializa agenda/pedido, confere o aluno e a permissão atual, aplica financeiro e estado/vínculos e registra a conclusão. A repetição da mesma decisão retorna o resultado preservado; outra decisão ou outro aluno é recusado. Repetição não dispensa a permissão atual do executor. As constraints são conferidas antes de retornar. O transporte público autenticado e a interface ainda não foram adicionados; o relógio não poderá vir do cliente.

32 integrações de encerramento e compra de horas aprovadas, agora com executor completo nos cenários de horas/crédito e compensação/proporcional, concorrência/repetição sem duplicidade, pedido CONCLUIDA, matrícula ENCERRADA, histórico imutável, revogação de acesso e rollback posterior à conclusão. TypeScript, lint, build com 52 páginas e schema diff vazio aprovados. Migrations 20260914093000_efetivacao_acerto_encerramento e 20260914094000_conferencia_dias_efetivacao aplicadas apenas no banco descartável; 148 migrations. Última suíte unitária integral 311; última regressão integral de integração 298.

Ainda verificar a exposição pública, consumidores acadêmicos/acesso e composição com apurações por hora e reservas. Este executor não comprova a implementação integral dos demais fluxos. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.
## Incremento 316 — Ação autenticada e interface de efetivação, 13/09/2026

A ação efetivarAcertoEncerramento recebe somente aluno e decisão, obtém executor da sessão e usa o relógio do servidor. Exige Financeiro/Administração vigente e delega ao executor transacional, preservando revalidação, isolamento por matrícula e repetição sem duplicidade. Revalida as páginas do aluno e do Financeiro após a operação.

A conferência mostra a ação de efetivação para uma decisão aprovada ainda não aplicada. Após a conclusão, apresenta executor, data e resumo dos valores aprovados, mantendo o histórico acessível em pedidos concluídos e retirando as ações de decisão/efetivação. O crédito exibido não comprova devolução de dinheiro. A consulta de um encerramento concluído não depende de recarregar o contexto de uma matrícula ativa.

A origem acadêmica inclui o regime de cobrança da preparação comercial. Para HORA_PARTICULAR, encontro não cancelado/não rascunho até o limite contratual e sem reserva de horas gera pendência de destinação financeira. É uma proteção provisória: o fechamento posterior por hora ainda não tem destinação persistida integrada. Regime legado ausente, cancelamentos cobráveis e conferência completa das ocorrências permanecem pendentes; esta proteção não comprova a apuração integral.

Validação desta versão: 32 testes de integração em encerramento-solicitacao e compra-horas aprovados, incluindo chamadas públicas concorrentes, rejeição de executor fornecido pelo cliente, data efetiva futura, consulta concluída e a pendência por hora. Lint aprovado nos nove arquivos alterados; build aprovado com TypeScript e 52 páginas. Sem migration; 148 migrations até o incremento 315. Última suíte unitária integral: 311; última regressão integral de integração: 298. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 317 — Apuração detalhada do fechamento por hora, 13/09/2026

apurarFechamentoHoras reúne ocorrências conferidas por matrícula, período e moeda. Usa os minutos contratados divididos por 60, preço da versão aplicável a cada encontro e dinheiro decimal: arredondar uma vez por item e somar os itens. Preserva evidência, horários, comunicação, antecedência contratada e classificação financeira. Falta/cancelamento tardio cobra integral; cancelamento no prazo ou pela escola não compõe valor. Não altera presença nem conclusão do diário.

O período possui referência e limites explícitos, separados do vencimento. A inclusão técnica usa início do encontro no intervalo inclusivo/exclusivo informado; a montagem dos limites pela condição contratual ainda deve ser integrada ao serviço. Não presume mês/fuso ou calendário financeiro. Duplicação de encontro, mistura de matrícula/moeda, ocorrência de outra versão/horário, duração não inteira em minutos e total acima da precisão monetária são recusados.

Destinação faturada ou antecipação conferida fica preservada, fora dos novos itens. Reserva antecipada pendente exige conferência, sem ser tratada como quitação ou nova obrigação. Ocorrência ausente permanece pendente. O Financeiro pode apurar com a escolha de aguardar ou propor parcial: parcial identifica aprovação independente obrigatória, mas não emite. Uma complementar inclui apenas itens sem destinação anterior; a proteção transacional contra concorrência depende da persistência ainda por implementar.

Validação: 14 novos unitários; 18 aprovados junto ao classificador existente. Suíte unitária integral: 821 testes em 88 arquivos, zero falhas. TypeScript e lint dos dois arquivos aprovados. Sem schema, migration ou interface alterados; último build e integração direcionada no incremento 316, última regressão integral de integração no 298.

Limite: núcleo interno de cálculo, ainda sem ação pública, leitor de origens persistidas, registro/conferência de ocorrências posteriores, proposta/aprovação parcial ou emissão transacional. Não remover a pendência provisória do encerramento de Q93/Q101 antes dessa integração. Não há nova cobrança, recebimento ou produção. O objetivo integral permanece incompleto.

## Incremento 318 — Informe docente persistido por encontro particular, 13/09/2026

OcorrenciaParticular registra matrícula, encontro, professor autor, versão, tipo, horários, comunicação de cancelamento, evidência e chave de repetição. O registro é imutável; nova informação gera versão sequencial preservando a anterior. registrarOcorrenciaParticular exige professor ativo atribuído ao encontro, revalida a atribuição dentro da transação e devolve apenas identificação/versão, sem preços ou dados financeiros.

Realização/falta só podem ser informadas após o término em encontro previsto/ministrado. Cancelamento exige encontro cancelado com decisão pedagógica aprovada, sem transformar o informe em decisão financeira. Não cria diário, presença, cobrança, recebimento ou consumo de horas. O banco verifica vínculos, autoria, horários e sequência; a operação registra evento na mesma transação. Agenda e matrícula são bloqueadas na ordem compartilhada pelos fluxos existentes.

A primeira validação encontrou incompatibilidade entre timestamp sem fuso e o fuso da sessão PostgreSQL. Migration adicional fixa criadoEm pelo relógio do banco convertido explicitamente a UTC; o cliente não escolhe o instante do registro. Comunicação futura é recusada. As migrations aplicadas anteriormente não foram reescritas.

Validação final: 13 integrações aprovadas em informe docente (6 novas) e cancelamento particular (7 existentes), incluindo concorrência/repetição, versões, imutabilidade, acesso revogado, atribuição, origem divergente, rollback, cancelamento aprovado e ausência de efeitos financeiros/acadêmicos. TypeScript, lint e build com 52 páginas aprovados; schema diff vazio. Migrations 20260914100000_ocorrencia_particular e 20260914101000_relogio_ocorrencia_particular aplicadas somente no banco descartável; 150 migrations. Última suíte unitária integral: 317 (821 testes); última regressão integral de integração: 298.

Ainda falta interface docente, conferência financeira vinculada à versão informada e às condições contratuais, aprovação parcial, emissão persistida e integração à apuração/encerramento. Informar ocorrência não satisfaz Q93/Q101 por si só. Quando a conferência financeira for adicionada, alteração posterior do informe deverá exigir revisão dos efeitos, sem substituir silenciosamente a versão faturada. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 319 — Interface docente e histórico dos informes, 13/09/2026

A página do encontro particular apresenta formulário de ocorrência e histórico por versão, com autor, instante do registro, comunicação e evidência. Realização/falta são oferecidas depois do término; cancelamentos são oferecidos quando há decisão pedagógica aprovada. A navegação de encontros próprios inclui particulares futuras, ministradas e canceladas, mantendo as condições de registro no servidor. A chamada permanece uma operação distinta.

consultarOcorrenciasParticular revalida professor ativo e atribuição em leitura consistente. Projeta apenas dados necessários do encontro e informes, sem valores ou dados pessoais/financeiros do aluno. Turmas não recebem este formulário. A comunicação usa data/hora no fuso identificado do encontro; o conversor recusa horários inexistentes ou ambíguos. Repetição de envio conserva a chave enquanto a entrada não mudar, e nova versão preserva os informes anteriores.

Validação: seis integrações de ocorrência aprovadas, ampliadas para histórico ordenado, formato temporal, acesso indevido/revogado, permissões de registro e projeção dos campos. Lint aprovado nos cinco arquivos alterados; build com TypeScript e 52 páginas aprovado; diff sem erros. Sem migration; último schema diff vazio no incremento 318. Última suíte unitária integral: 317; última regressão integral de integração: 298.

Sem homologação interativa desta interface. Conferência financeira vinculada à versão e às condições contratuais, emissão parcial, apuração persistida e integração ao encerramento permanecem pendentes. Informes ainda não confirmam cobrança nem alteram diário/presença. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 320 — Origem aprovada do cancelamento particular, 13/09/2026

A integração dos informes expôs incompatibilidade: a liberação de horas tratava qualquer cancelamento aprovado como cancelamento da escola. PropostaCancelamentoParticular passa a registrar origem ESCOLA/ALUNO, preservada com a proposta imutável e apresentada ao aprovador. A interface exige escolha explícita. Chamadores anteriores sem origem mantêm ESCOLA, que era o alcance declarado da tela/fluxo anterior, sem alterar sua chave/hash de repetição. Migração de base real requer conferir se o histórico foi usado fora desse alcance.

O informe docente só aceita a mesma origem do cancelamento aprovado, validada na ação e no banco. A consulta fornece a origem e o formulário oferece apenas a opção correspondente. O fluxo de liberação/remarcação ou crédito próprio de Q95 exige origem ESCOLA; proposta financeira com cancelamento do aluno é recusada no serviço e no banco. Cancelamento do aluno não consome nem devolve horas automaticamente: sua conferência contratual de antecedência continua pendente.

Validação: 36 integrações aprovadas em compra de horas, ocorrências e cancelamento, incluindo novo caso de recusa de liberação/crédito para origem ALUNO e divergência do informe por serviço/SQL. Build final com TypeScript e 52 páginas aprovado; lint e diff sem erros; schema diff vazio. Migration 20260914102000_origem_cancelamento_particular aplicada somente ao banco descartável; 151 migrations. Última suíte unitária integral: 317; última regressão integral de integração: 298.

Ainda implementar condições de antecedência versionadas/aceitas, conferência financeira, emissão parcial e integração ao encerramento. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 321 — Condições contratuais estruturadas de cobrança por hora, 13/09/2026

CondicoesHorasMatricula preserva matrícula, documento confirmado, versão, regras, preparador e decisão. As regras identificam preço/hora, moeda, unidade fixa de 60 minutos, início de vigência com fuso explícito, antecedência de cancelamento e referências das cláusulas de preço/cancelamento. Não há prazo numérico padrão. A transcrição não altera o contrato original nem autoriza mudança comercial sem formalização.

Secretaria/Administração prepara; outra pessoa da Administração aprova ou rejeita. Só uma versão pendente é permitida por matrícula, com sequência serializada. O banco revalida autor, decisão independente, fonte confirmada/vinculada, moeda e dados obrigatórios; não aceita criação diretamente aprovada ou alteração/apagamento de versões decididas. Fonte arquivada impede aprovação, mas permite rejeitar a proposta pendente. Oferta preparada em regime mensal não aceita condições de hora. Matrículas legadas ainda exigem transcrição e conferência explícitas do documento.

Quatro integrações aprovadas: preparação/decisão, autoaprovação recusada por serviço e SQL, preservação, parâmetros incompletos, moeda incompatível, contrato não confirmado, concorrência, fonte arquivada e usuário revogado. Lint e build com TypeScript/52 páginas aprovados; schema diff vazio; migration 20260914103000_condicoes_horas aplicada apenas no banco descartável, total de 152 migrations. Última suíte unitária integral: 317; última regressão integral de integração: 298.

Ainda falta interface e seleção explícita/revalidação da versão aplicável na conferência da ocorrência, incluindo vigência e conflitos entre transcrições. Não usar simplesmente a última configuração para faturar aulas antigas. Este incremento não emite cobrança, não registra recebimento e não modifica PDF/assinaturas; geração dessas condições em novos documentos e aditivos permanece pendente. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 322 — Interface e consulta das condições por hora, 13/09/2026

A rota /matriculas/[id]/condicoes-horas apresenta preparação, cláusulas, vigência, histórico de versões e decisão independente. A página de condições de entrada das ofertas por hora oferece o acesso. Secretaria/Administração prepara após contrato confirmado e sem versão pendente; Administração distinta do preparador decide. Financeiro consulta em leitura. Professor não consulta condições financeiras.

A consulta revalida usuário e projeta as condições da matrícula em leitura consistente. O formulário não preenche antecedência ou preço automaticamente; mantém unidade 60 e moeda da matrícula. Vigência é informada como data/hora no fuso institucional identificado e convertida sem escolha silenciosa em horário ambíguo/inexistente. O servidor permanece responsável pela validação final, incluindo documento vigente/disponível e regime compatível.

Cinco integrações aprovadas, incluindo consulta das versões, permissão independente, leitura financeira, recusa ao professor e usuário revogado. TypeScript, lint e build com 52 páginas aprovados; diff sem erros. Sem migration; último schema diff vazio 321, última suíte unitária integral 317 e última regressão integral de integração 298.

Sem homologação interativa. Ainda falta conectar a versão aplicável à ocorrência e à conferência financeira, resolver vigências conflitantes e emitir/aprovar parciais com proteção transacional. A interface transcreve contrato confirmado; não altera documento nem emite cobrança. Matrículas legadas ainda precisam de entrada de navegação e conferência na migração. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 323 — Prévia financeira com ocorrência e condições persistidas, 13/09/2026

preverConferenciaOcorrenciaHoras exige Financeiro/Administração vigente, aluno/matrícula correspondentes e versões explícitas do informe e das condições. O leitor interno mantém as travas de agenda/matrícula do chamador e confere contrato confirmado, documento disponível, moeda, regime preparado, horários e último informe. Condições ainda não vigentes, versão mais nova aplicável, transcrição pendente aplicável ou mudança dentro do encontro exigem conferência. Versão futura posterior ao encontro não reprecifica a aula antiga.

A classificação usa a antecedência transcrita do contrato e a origem aprovada do cancelamento, sem preço/prazo fornecidos pelo cliente. Calcula minutos contratados e valor decimal por hora de 60 minutos. Devolve referências, condições, classificação e memória, sem registrar conferência ou emitir cobrança. Reservas antecipadas são identificadas como pendência de destinação; não constituem automaticamente nova dívida.

Oito integrações aprovadas nas condições por hora (três cenários novos): preço aplicável em 75 minutos, condição futura, documento arquivado, isolamento por aluno, professor sem acesso financeiro, informe superado, cancelamento tardio com limite contratual e vigência conflitante. TypeScript, lint e build com 52 páginas aprovados; diff sem erros. Sem migration; último schema diff vazio no 321. Última suíte unitária integral 317; última regressão integral de integração 298.

Ainda persistir a conferência financeira com suas origens e proteger alterações posteriores; criar interface, fechamento parcial aprovado e emissão sem duplicidade. Histórico com aditivos/documentos anteriores necessita sua cadeia contratual, não está comprovado pelo leitor do contrato atualmente confirmado. A prévia não conclui Q93/Q101 nem remove a pendência de encerramento. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 324 — Conferência financeira persistida da ocorrência, 13/09/2026

ConferenciaOcorrenciaHoras preserva encontro, informe, condições aprovadas, conferente, minutos, valor, moeda, desfecho e memória da prévia. A ação exige Financeiro/Administração vigente, correspondência aluno/matrícula e hash da prévia revalidada. Chave de repetição e unicidade por encontro/informe impedem duplicação; repetição continua exigindo acesso atual. A gravação e o evento são atômicos, sem emissão de cobrança ou recebimento.

O banco confere autoria financeira, origem, contrato, moeda, vigência, cancelamento e cálculo de minutos/valor. Conferência de encontro com reserva antecipada é recusada neste fluxo, exigindo destinação própria. Conferências são imutáveis; novos informes e novas reservas de horas sobre encontro conferido são bloqueados, assim como alterações financeiras relevantes da agenda. A passagem PREVISTO para MINISTRADO permanece permitida para conclusão acadêmica. A interface docente identifica a conferência e orienta revisão dos efeitos antes de alterar.

Quinze integrações aprovadas nos arquivos de condições e ocorrências, incluindo novo cenário de gravação concorrente, repetição, hash divergente, cálculo SQL divergente, revogação, preservação e bloqueio da agenda/informe. O ensaio de concorrência precisou do adaptador de sessão já usado em outras suítes para evitar importação concorrente do NextAuth no Vitest; a ação e o banco continuam revalidando usuário/papéis. TypeScript, lint e build com 52 páginas aprovados; schema diff vazio; migration 20260914104000_conferencia_ocorrencia_horas aplicada somente ao banco descartável, total de 153 migrations.

Ainda criar interface financeira e consulta específica da conferência registrada; a prévia continua sendo cálculo, não histórico de conferência. Implementar revisão aprovada dos efeitos antes de permitir alteração de registro conferido, além de emissão parcial/fechamento e integração com antecipações/encerramento. O bloqueio preserva os dados enquanto essa revisão não está disponível; não equivale ao fluxo de correção concluído. Última suíte unitária integral 317; última regressão integral de integração 298. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 325 — Interface financeira da ocorrência e memória registrada, 13/09/2026

A ficha financeira oferece navegação por matrícula para /matriculas/[id]/ocorrencias-financeiras, incluindo acesso às condições por hora de contratos legados. A consulta exige Financeiro/Administração vigente, pagina encontros particulares em grupos de 30 e valida o cursor dentro da matrícula. Apresenta informe vigente, versões contratuais aprovadas e conferência persistida com valores serializados, autor, motivo e memória histórica.

A tela separa prévia de conferência registrada. Selecionar outra versão invalida a prévia; registrar exige justificativa e usa o hash revalidado no servidor. Repetição mantém a chave para a mesma entrada. Condições, vigência, desfecho, preço, minutos, comunicação/limite e pendências de antecipação são apresentados. Conferência salva mostra a memória preservada com cláusulas e versões, sem recalcular o histórico pela configuração atual. Emissão da cobrança continua uma etapa separada.

Nove integrações de condições por hora aprovadas, ampliadas para consulta histórica do valor/origens, cursor fora da matrícula, professor sem acesso e usuário revogado. Lint aprovado nos cinco arquivos alterados; build com TypeScript e 52 páginas aprovado; diff sem erros. Sem migration. Último schema diff vazio no incremento 324; última suíte unitária integral 317 e última regressão integral de integração 298.

Sem homologação interativa desta interface. Ainda implementar fechamento mensal, proposta/decisão parcial, emissão transacional, destinação de antecipações e revisão dos efeitos da conferência. A navegação não comprova operação integral desses fluxos nem a migração de dados reais. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 326 — Leitura da apuração por período com conferências persistidas, 13/09/2026

carregarApuracaoHorasTx lê os encontros particulares publicados do período informado, incluindo cancelados e encontros sem informe/conferência. Somente a conferência financeira preservada fornece preço, condições e ocorrência ao cálculo. Informe docente isolado permanece pendência; condições/preço ausentes são representados por null, sem fabricar valor zero ou versão fictícia. A apuração conserva identificadores do encontro, informe e conferência.

O leitor confronta memória, condições imutáveis, minutos, moeda, valor, desfecho e vínculo com a conferência gravada. Reserva de horas antecipadas com consumo/liberação conferidos é preservada fora da nova obrigação; reserva sem destinação continua pendente. Não reprecifica encontros conferidos pelo catálogo atual. Rascunho não integra a apuração. O chamador deve fornecer período/vencimento contratuais e manter travas de agenda/matrícula; este leitor é interno, sem nova ação pública.

Dez integrações de condições por hora aprovadas, incluindo novo cenário com informe ainda não conferido, conferência completa, encontro adicional pendente, proposta parcial e isolamento do aluno. Quatorze unitários do cálculo aprovados; suíte unitária integral também executada: 821 testes em 88 arquivos, zero falhas. TypeScript e lint aprovados. Sem schema/migration/UI alterados; último build 325, último schema diff vazio 324, última regressão integral de integração 298.

Ainda persistir período contratual/fechamento, aprovar emissão parcial, registrar itens faturados e impedir repetição sob concorrência na emissão. O estado de apuração completa não comprova faturamento; o leitor ainda não consome origem persistida de item faturado porque esse registro não existe. Integrar antecipações liberadas e revisão financeira aos cenários completos antes de habilitar produção. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 327 — Rascunho persistido do fechamento mensal por hora, 14/09/2026

O Financeiro/Administração pode preparar uma versão imutável da apuração por matrícula, vinculada ao contrato confirmado. O registro conserva a referência civil ou ciclo mensal proposto, fuso, limites do período, vencimento, cláusula informada, escolha de aguardar/propor parcial, motivo e origens da apuração. A referência transcrita ainda precisa de conferência contratual antes da emissão; salvar o rascunho não aprova suas condições nem gera cobrança.

A ação verifica permissões vigentes e vínculo do aluno, trava agenda/matrícula e preserva a chave de repetição. Solicitações concorrentes iguais retornam a mesma versão; entrada divergente com a mesma chave e versão anterior desatualizada são rejeitadas. A migration protege autoria autorizada, documento disponível, sequência de versões, coerência de matrícula/período e imutabilidade. O banco não certifica sozinho toda a memória financeira: a futura aprovação deve revalidar as origens e a apuração.

Validação: 11 testes de integração de condições por hora aprovados; 17 unitários de período/apuração aprovados, incluindo fevereiro bissexto, ciclo no dia 31 e mudança de horário de verão. TypeScript e lint aprovados. As 154 migrations estão aplicadas somente na base descartável; schema diff vazio. Último build: incremento 325; última suíte unitária integral: 326 (821 testes); última regressão integral de integração: 298. Nenhuma homologação de interface realizada neste incremento.

Pendências: consulta/interface do fechamento, aprovação independente da proposta parcial, conferência da referência contratual, itens faturados e emissão transacional sem duplicação. Sobreposição de propostas não é autorização de faturamento. Não habilitar produção usando apenas este rascunho. Sem produção, importação real ou envios externos. Objetivo geral incompleto.
## Incremento 328 — Consulta autorizada das versões de fechamento por hora, 14/09/2026

consultarFechamentosHoras oferece listagem paginada e leitura individual das versões preservadas. Exige Financeiro/Administração vigente e matrícula pertencente ao aluno informado; cursor e identificador da versão são validados na mesma matrícula. A leitura usa transação RepeatableRead. A listagem traz até 30 versões, autor, motivo, documento e intervalos, sem carregar a memória completa dos encontros. A consulta individual retorna o snapshot preservado, sem recalcular a apuração pelo estado atual. Chave de repetição e hash da entrada não são expostos. Toda versão é identificada como rascunho e não comprova emissão.

Validação: 12 integrações de condições por hora aprovadas, incluindo resumo/detalhe, navegação por cursor, consulta de versão anterior, isolamento aluno/matrícula, Financeiro autorizado, professor/Secretaria sem acesso e usuário desativado. TypeScript e lint aprovados. Nenhuma migration ou interface alterada. Último build 325, schema diff vazio 327, suíte unitária integral 326 e regressão integral de integração 298.

Ainda faltam interface, aprovação independente, revalidação da referência contratual e emissão com itens faturados persistidos. A consulta histórica não atesta validade atual da proposta nem autoriza cobrança. Sem produção, importação real ou envios externos. Objetivo geral incompleto.
## Incremento 329 — Interface de consulta dos fechamentos por hora, 14/09/2026

A conferência das particulares oferece acesso ao histórico em /matriculas/[id]/fechamentos-horas. A página exige sessão financeira e utiliza a consulta autorizada do incremento 328. Lista versões com autor, motivo e intervalo, navega por cursor e abre a apuração preservada individualmente. O detalhe apresenta período civil/fuso, vencimento, estado, total, minutos, encontros incluídos com data e preço, pendências e quantidades preservadas/sem cobrança. Memória incompatível apresenta erro de conferência, sem inventar valores. Rascunho não é apresentado como aprovação, emissão ou recebimento.

Validação: build Next.js aprovado após a última alteração, incluindo TypeScript e geração de 52 páginas estáticas; a nova rota dinâmica consta no resultado. Lint e TypeScript independente aprovados. Testes de autorização/histórico continuam os 12 aprovados no incremento 328; não foram repetidos para esta alteração de apresentação. Sem migration; último schema diff vazio 327. Sem homologação visual interativa.

Ainda completar preparação pela interface, detalhes de destinações/pendências identificáveis por encontro, aprovação independente, revalidação contratual e emissão transacional. Esta tela consulta rascunhos já persistidos; não conclui o fluxo operacional. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 330 — Preparação do fechamento por hora pela interface, 14/09/2026

O histórico de fechamentos agora inclui formulário de preparação. Financeiro/Administração informa referência civil/ciclo, âncora quando aplicável, data no período, fuso, vencimento, cláusula, motivo e escolha de aguardar/propor parcial. A consulta calcula os limites e busca a última versão do período exato, sem depender da página do histórico. A tela apresenta período e versão antes de salvar; alteração de campo invalida a conferência. O servidor continua revalidando contrato, escopo, permissões, versão e apuração na transação de gravação.

A entrada conserva a mesma chave de repetição enquanto for idêntica. Resultado de transporte incerto orienta consultar o histórico; erro explícito permite conferir novamente. Salvar abre a versão persistida, sem emitir cobrança. Não foram presumidos fuso, prazo ou condições contratuais. O documento utilizado é o atual da matrícula, sujeito à conferência do serviço no momento da gravação.

Validação: 12 integrações aprovadas, ampliadas para versão corrente do período e ausência de versões em outro mês. Lint aprovado nos quatro arquivos. Build com TypeScript e 52 páginas aprovado; após ajuste final de recuperação do formulário e ampliação dos testes, TypeScript independente aprovado. Sem migration e sem homologação visual interativa.

Pendências: detalhamento identificável dos encontros pendentes e destinações, aprovação independente, revalidação contratual e emissão transacional com origens faturadas. O formulário prepara rascunho; não conclui o fechamento financeiro. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 331 — Revalidação transacional do fechamento por hora, 14/09/2026

revalidarFechamentoHorasTx confere matrícula/aluno, entrada preservada, contrato atual confirmado, documento disponível, limites do período e versão mais recente. Recompõe a apuração sob as travas de agenda/matrícula e confronta integralmente com o snapshot, sem atualizar o rascunho. É um componente interno para integração à decisão/execução na mesma transação; o chamador deve autenticar e autorizar o responsável. Não existe ainda aprovação ou emissão por este componente.

As origens passaram a preservar início, fim e estado dos encontros, além de identificadores do informe/conferência. Isso detecta remarcação dentro do próprio período mesmo quando o total permanece igual. Versões antigas sem essas informações continuam no histórico, mas exigem nova preparação antes de aprovação; nenhum histórico foi preenchido artificialmente.

Validação: 13 integrações aprovadas. O novo cenário verifica versão atual, aluno incorreto, remarcação de encontro pendente com rollback, conferência financeira posterior, versão superada e documento arquivado, sem emissão. TypeScript e lint aprovados. Sem migration/interface alterada; último build 330. A validação é técnica das origens e não substitui a conferência humana da referência contratual.

Pendentes: integrar aprovação independente e emissão transacional, resolver sobreposição entre períodos propostos e persistir os itens faturados. Revalidação isolada não certifica a operação completa. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 332 — Decisão independente do fechamento por hora, 14/09/2026

DecisaoFechamentoHoras preserva decisão única por versão, responsável, motivo, data e confirmação explícita da referência contratual. decidirFechamentoHoras exige Administração ou Financeiro com financeiro.aprovar_acertos vigente e pessoa distinta do preparador. Aprovação revalida contrato, período, versão e todas as origens na mesma transação. Rejeição preserva o histórico sem exigir que a apuração continue atual. Repetição exata retorna a decisão; tentativa divergente não a substitui. A escolha de aguardar também pode receber decisão, sem autorizar emissão dos encontros pendentes.

A migration protege autoria autorizada, independência, versão/documento na aprovação e imutabilidade. A recomposição integral das origens é responsabilidade do serviço e deve ocorrer novamente na emissão; uma linha de decisão isolada não certifica faturamento. A consulta e a tela mostram a decisão separada do estado histórico da apuração.

Validação: 14 integrações aprovadas, incluindo autoaprovação, Financeiro sem permissão, referência não confirmada, concorrência/repetição, histórico da decisão, tentativa de alteração/exclusão e revogação de permissão. Build com TypeScript e 52 páginas aprovado; lint aprovado. Migration aplicada somente na base descartável: 155 migrations, schema diff vazio. Sem homologação visual interativa.

Pendentes: formulário para decidir pela interface, cenários adicionais de aprovação/rejeição após mudanças de origem, emissão transacional com revalidação e itens faturados, tratamento de períodos sobrepostos e integração ao encerramento. A decisão não emite cobrança. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 333 — Decisão do fechamento pela interface, 14/09/2026

A consulta expõe elegibilidade de decisão calculada com permissões vigentes, autoria e ausência de decisão. O detalhe apresenta a cláusula/período transcritos e a escolha de aguardar ou propor parcial sem expor chave/hash da entrada. O formulário exige decisão e justificativa; aprovação também exige confirmação explícita da referência contratual. Ao salvar, o serviço revalida independência, permissões e origens. A rejeição continua disponível para uma versão desatualizada, sem alterá-la. A elegibilidade da tela não certifica validade atual para aprovação.

Validação: 15 integrações aprovadas, ampliadas para visibilidade do decisor, cláusula apresentada, bloqueio após nova conferência financeira e documento arquivado, rejeição preservada e retirada do formulário após decisão. Build com TypeScript e 52 páginas aprovado; TypeScript final e lint aprovados. Sem migration. Sem homologação visual interativa.

Pendentes: acesso direto ao documento contratual de origem nesta tela, detalhamento das destinações e encontros pendentes, emissão transacional, proteção contra faturamento duplicado e integração ao encerramento. Aprovação não comprova emissão. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 334 — Emissão interna do fechamento e origens faturadas, 14/09/2026

EmissaoFechamentoHoras vincula decisão, cobrança, executor e memória; ItemFechamentoHoras vincula cada conferência faturada uma única vez. emitirFechamentoHorasTx exige executor Financeiro/Administração vigente, decisão aprovada da matrícula/aluno e revalidação das origens. Apuração completa ou proposta parcial com itens pode emitir; aguardar pendências e ausência de itens não geram cobrança. A cobrança HORA_PARTICULAR conserva valor apurado, moeda e vencimento no fuso proposto, sem criar recebimento. Registro, itens e evento são gravados na mesma transação. Repetir a decisão retorna a emissão existente.

O leitor da apuração reconhece itens faturados e os preserva fora do novo valor, inclusive em nova versão do período. A migration impede repetir a conferência em outro item, protege a imutabilidade da origem e confere o vínculo/valor do item com a decisão aprovada. Esta primeira proteção não substitui as verificações integrais de emissão no serviço; ainda faltam restrições de fechamento do conjunto e proteção contra alterações incompatíveis da cobrança por outros fluxos.

Validação: 16 integrações aprovadas. O novo cenário cobre conferência, preparação, decisão independente, duas emissões simultâneas, uma cobrança de 156,25 CRC, um item, imutabilidade, apuração posterior zerada com origem faturada e ausência de recebimento. TypeScript e lint aprovados. Base descartável com 156 migrations e schema diff vazio. Último build 333. Sem interface de emissão ou homologação visual.

Pendentes: endurecer integridade do conjunto cobrança/emissão/itens, testar emissão parcial e mudanças concorrentes entre decisões/períodos, proteger alterações da cobrança, expor ação autenticada/interface e integrar o encerramento. Executor é interno; o chamador deve fornecer identidade autenticada. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 335 — Integridade do conjunto de emissão por hora, 14/09/2026

A nova migration confere executor vigente, decisão independente, memória igual à versão aprovada e compatibilidade inicial de matrícula, tipo, moeda, valores e vencimento da cobrança. Uma constraint diferida exige que a transação termine com a quantidade, soma e encontros dos itens correspondentes à apuração. Origem da cobrança (matrícula, tipo, moeda e valor original) passa a ser preservada após emissão. Pagamentos e ajustes não são inferidos desta origem.

O executor força a verificação da constraint antes de retornar sucesso. O teste inicial expôs rejeição no commit sem propagação esperada pelo Prisma; a verificação explícita na transação corrigiu o caminho de erro observável. Transação sem itens reverte também a cobrança. Não foi removida ou afrouxada a constraint.

Validação final: 16 integrações aprovadas, incluindo transação incompleta, rollback, origem alterada, emissão concorrente e apuração posterior. TypeScript e lint aprovados. Base descartável com 157 migrations; schema diff vazio. Último build 333. Sem interface alterada.

Pendentes: cenários adicionais de emissão parcial e concorrência entre períodos/decisões, ajustes autorizados de valor/vencimento e efeitos em outros fluxos, ação pública/interface e encerramento. Banco confere consistência do conjunto; revalidação completa da agenda/contrato permanece no serviço antes de emitir. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 336 — Emissão parcial, complementar e ação autenticada, 14/09/2026

emitirFechamentoHoras recebe apenas aluno, matrícula e decisão; obtém o executor da sessão Financeiro/Administração e delega à transação protegida. Após sucesso, invalida as páginas do fechamento e Financeiro. O cliente não escolhe a identidade executora. Esta ação ainda não possui botão na interface.

O novo cenário integrado cobre dois encontros, um conferido e outro pendente: a decisão de aguardar impede emissão; uma nova versão parcial aprovada gera 156,25 CRC; após conferência do segundo encontro, uma versão complementar gera somente 125,00 CRC. A primeira origem fica preservada fora da nova cobrança. Repetir ambas as decisões retorna suas emissões anteriores. Não há recebimento criado. A ação pública foi exercitada com repetição autorizada, aluno incorreto e professor sem permissão.

Validação: 17 integrações aprovadas, TypeScript e lint aprovados, build com 52 páginas aprovado. Sem migration; último schema diff vazio 335. Nenhuma homologação visual interativa.

Pendentes: navegação/identificação explícita das cobranças parcial e complementar, botão de emissão e memória no Financeiro, testes de decisões concorrentes sobre períodos sobrepostos, integração ao encerramento e ajustes posteriores. Não considerar o fluxo inteiro concluído por este cenário. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 337 — Emissão pela interface e consulta da cobrança, 14/09/2026

O detalhe da versão aprovada com itens e estado apto oferece Emitir cobrança aprovada, exibindo o valor antes da ação. O servidor continua revalidando as origens e a decisão. Após registro, a tela apresenta emissão, executor/data, identificação da cobrança, valor original, valor atual e saldo, com acesso à ficha financeira. Emissão existente retira a ação de emitir. Estado histórico da apuração permanece separado do registro da emissão.

A consulta serializa valores e datas da cobrança, mantendo emissão nula para decisões ainda não executadas. O histórico mostra separadamente a cobrança parcial e a complementar vinculadas às respectivas versões. Não transforma emissão em pagamento; recebimentos continuam na ficha financeira. O botão é uma possibilidade de execução, não uma garantia de que origens ainda estejam válidas.

Validação: 17 integrações aprovadas, ampliadas para ambas as cobranças no histórico, valores/saldos e versão sem emissão. Build com TypeScript e 52 páginas aprovado após correção de sintaxe na consulta; lint aprovado. Sem migration. Sem homologação visual interativa.

Pendentes: apresentação explícita do vínculo entre cobranças complementares, acesso ao contrato de origem, identificação dos encontros pendentes/destinações, concorrência entre períodos sobrepostos e integração ao encerramento/ajustes. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 338 — Concorrência de períodos sobrepostos e regressão unitária, 14/09/2026

Foi exercitado o cenário de dois rascunhos aprovados com referências distintas (mês civil e ciclo da matrícula) que incluem a mesma conferência. As emissões públicas são disparadas simultaneamente. A trava serializa a revalidação: uma cria a cobrança/item e a outra identifica mudança das origens, exigindo nova versão. Repetir a vencedora retorna sua emissão; repetir a outra continua sem emitir. A existência de duas propostas não autoriza cobrar o mesmo encontro duas vezes nem decide qual referência contratual deveria ter sido escolhida pela equipe.

Validação: 18 integrações de condições por hora aprovadas; uma única cobrança, emissão e item no cenário de sobreposição, sem recebimentos. Suíte unitária integral executada: 824 testes em 89 arquivos, zero falhas. TypeScript e lint aprovados. Sem alteração de produção ou migration neste incremento. Último build 337, último schema diff vazio 335. A última regressão integral de integração permanece 298; os testes atuais são direcionados.

Pendentes: revisão da usabilidade das referências concorrentes, vínculo visível entre cobranças complementares, detalhes de origens, integração ao encerramento/ajustes e homologação visual. Não inferir conclusão geral a partir destas verificações. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 339 — Identificação dos encontros e cobranças anteriores, 14/09/2026

O detalhe identifica pendências e destinações preservadas pelo horário guardado na origem, no fuso da apuração. Memórias antigas sem horário permanecem identificadas como incompletas; não são reconstruídas pela agenda atual. Encontros sem cobrança exibem data e motivo de classificação. Para encontros já faturados, a consulta resolve o fechamento anterior dentro da mesma matrícula e oferece navegação até a cobrança de origem, permitindo acompanhar a complementar sem repetir seus itens.

A resolução usa somente as referências preservadas no snapshot individual e filtra tanto cobrança quanto rascunho pela matrícula autorizada. A lista paginada não carrega essas origens. Destinações de antecipações continuam indicadas como conferidas, sem afirmar recebimento novo.

Validação: 18 integrações aprovadas, ampliadas para vínculo da cobrança complementar com a versão parcial e horários preservados das origens. Build com TypeScript e 52 páginas aprovado após correção de estreitamento de tipo no componente; lint aprovado. Sem migration. Última suíte unitária integral 338 (824 testes). Sem homologação visual interativa.

Pendentes: acesso ao documento contratual nesta tela, detalhes próprios das destinações de antecipação, integração ao encerramento/ajustes e homologação visual. A navegação não substitui a conferência contratual nem autoriza correções financeiras. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 340 — Contrato do fechamento e autorização financeira do arquivo, 14/09/2026

A tela oferece abertura do contrato de origem quando ele é o documento atual confirmado da matrícula, não arquivado e usa a rota privada de uploads. Links externos ou referências indisponíveis não são publicados. A abertura passa novamente pela autorização da rota privada, com sessão e papéis atuais.

Foi corrigida a divergência que permitia ao Financeiro conferir condições mas negava o próprio contrato: podeLerArquivo permite CONTRATO somente quando o documento exato está registrado como contrato confirmado de uma matrícula coerente com seu vínculo direto ou lead. Os demais documentos administrativos continuam restritos. Arquivado, finalidade de upload incompatível e contrato não confirmado não recebem essa concessão. A mudança concede leitura, não edição ou upload administrativo.

Validação: 19 integrações de condições por hora e 23 unitários de autorização aprovados. O mock unitário foi ampliado para a nova consulta de vínculo; o teste anterior de contrato sem confirmação continua negando Financeiro. Build com TypeScript e 52 páginas aprovado; após ajuste final de visibilidade conforme confirmação, TypeScript aprovado. Lint aprovado antes desse ajuste simples. Sem migration. Sem homologação visual interativa ou comprovação de existência física dos arquivos legados.

Pendentes: versões contratuais substituídas/aditivos e sua leitura histórica, detalhes de antecipações, integração ao encerramento/ajustes e homologação visual. Acesso permitido não comprova que o arquivo legado exista no armazenamento. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 341 — Destinação financeira por hora na conferência de encerramento, 14/09/2026

A conferência da agenda de encerramento reconhece conferências faturadas e preserva cobrança/item como origem. Encontros por hora sem destinação continuam pendentes até emitir ou comprovar não cobrança. Cancelamentos deixam de ser ignorados: sem conferência continuam pendentes; cancelamento da escola ou do aluno no prazo, conferido sem valor, é identificado como SEM_COBRANCA. Cancelamento tardio cobrável permanece pendente até destinação. Matrículas legadas sem preparação comercial são reconhecidas como por hora quando têm condições aprovadas.

O acerto conserva destinacoesHoras na memória; alterações futuras dessa origem invalidam propostas anteriores pela revalidação existente. Não cria quitação, não cancela dívidas e não dispensa a consolidação das cobranças no acerto. Encontros com reservas antecipadas continuam sujeitos ao fluxo próprio de liquidação, ainda a revisar em conjunto.

Validação: 29 integrações de condições por hora e solicitação de encerramento aprovadas inicialmente; após acrescentar os cenários de cancelamento, 21 testes do arquivo de condições por hora aprovados (incluindo os 19 anteriores). TypeScript e lint aprovados. Cenários cobrem bloqueio antes de faturar, liberação após emissão com origem preservada, cancelamento sem conferência, no prazo sem cobrança e tardio ainda pendente. Sem migration/interface alterada; último build 340.

Pendentes: consolidação financeira completa das cobranças por hora no acerto, reservas antecipadas e cancelamentos pela escola no encerramento, execução integral do encerramento com esses casos, ajustes e homologação visual. Esta integração trata a conferência da agenda, não comprova encerramento completo de todas as ofertas. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 342 — Origem do faturamento por hora na memória do acerto, 14/09/2026

O contexto de encerramento passa a carregar emissão, decisão, memória e itens das cobranças originadas de fechamento por hora. A conferência de outras cobranças preserva essa origem na proposta do acerto. O valor permanece separado das mensalidades: não recebe cobertura fictícia nem proporcional mensal. Alteração proposta continua explícita e sujeita à aprovação do acerto, sem modificar o valor original de emissão.

O teste integrado confirma que a cobrança HORA_PARTICULAR de 156,25 CRC não tem cobertura mensal, conserva os itens e entra na conferência como saldo integral, crédito zero e sem alteração proposta quando a equipe mantém o valor. As origens passam a participar da memória revalidada do acerto.

Validação: 31 integrações de condições por hora e solicitação de encerramento aprovadas; suíte unitária integral com 825 testes em 89 arquivos aprovada. Build com TypeScript e 52 páginas aprovado; lint aprovado. Sem migration/interface alterada. Última regressão integral de integração permanece 298.

Pendentes: execução integral do encerramento com fechamento por hora, ajustes posteriores e suas autorizações, apresentação da origem na revisão do acerto, reservas antecipadas e homologação visual. Este incremento confirma a conferência das cobranças; não comprova todos os casos de encerramento. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 343 — Execução do encerramento com horas faturadas, 14/09/2026

O cenário integrado de faturamento foi estendido até a efetivação do encerramento: condições contratuais preparadas e aprovadas, pedido da Secretaria, acerto preparado pelo Financeiro/Administração, aprovação independente e executor de encerramento. Uma cobrança por hora de 156,25 CRC é preservada integralmente, sem proporcional mensal, recebimento, crédito ou apagamento do item faturado. A repetição da efetivação retorna o mesmo resultado.

O mesmo aluno tem um segundo contrato ativo fora do pedido. A execução encerra somente a matrícula selecionada e preserva situação e versão de acesso do contrato excluído. As datas futuras usadas no teste são fornecidas ao executor interno de validação; nenhuma data ou operação real foi alterada.

Validação: 21 integrações de condições por hora aprovadas com o cenário ampliado; TypeScript e lint aprovados. Sem alteração de código de produção ou migration neste incremento. Último build e suíte unitária integral no incremento 342. Esta evidência cobre encerramento sem desconto/ajuste do saldo faturado; não generalizar para todos os tipos de acerto.

Pendentes: ajustes autorizados sobre cobranças por hora, coexistência com antecipações e compensações, apresentação das origens na revisão, contratos históricos/aditivos e homologação visual. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 344 — Ajuste aprovado de horas faturadas no encerramento, 14/09/2026

O cenário de encerramento agora cobre manutenção do saldo de 156,25 CRC e redução aprovada para 100,00 CRC. Em ambos, o valor original da cobrança e do item faturado permanece em 156,25 CRC. O registro de ajuste identifica decisão do acerto, valor anterior e novo valor. A efetivação atualiza valor negociado/saldo conforme a aprovação, sem gerar pagamento ou crédito inexistente, e conserva o outro contrato ativo.

A preparação do acerto identifica particulares por hora e informa a origem em fechamento aprovado com quantidade de encontros. Cobertura mensal pendente é apresentada apenas nas mensalidades; cobranças por hora não exigem período de serviço fictício para serem revisadas. A redução continua proposta sujeita à aprovação independente.

Validação: 22 integrações de condições por hora aprovadas, com a execução completa nos dois valores finais; TypeScript e lint aprovados. Build com 52 páginas aprovado após ajuste de apresentação. Sem migration. Sem homologação visual interativa.

Pendentes: combinação com recebimentos/antecipações/compensações, crédito por valor já pago, apresentação detalhada na decisão e homologação visual. Não generalizar o cenário sem recebimentos para todos os acertos financeiros. Sem produção ou envios externos. Objetivo geral incompleto.
## Incremento 345 — Crédito de horas já pagas no encerramento, 14/09/2026

Validação integrada adicional: cobrança por hora de 156,25 CRC recebe pagamento pelo serviço financeiro; acerto com aprovação independente reduz o devido para 100,00 CRC e encerra somente a matrícula selecionada. O recebimento completo permanece idêntico, o valor original da cobrança e do item faturado é preservado, o saldo devido fica zerado e um crédito de 56,25 CRC é criado na matrícula, com origem no acerto. Repetir a efetivação mantém um único crédito e um único recebimento. O segundo contrato continua ativo.

Esta entrega amplia a verificação do comportamento existente; não altera regras de produção nem implementa execução de devolução. Crédito apurado permanece distinto de devolução efetiva. Permanecem pendentes a homologação visual, os cenários combinados com antecipações e a conclusão integral do escopo.

Validação: 23 testes de integração no arquivo de condições por hora aprovados; TypeScript e lint aprovados. Sem migration, sem novo build por se tratar de teste e documentação, sem envios externos ou alteração de produção.

## Incremento 346 — Memória financeira visível na revisão do acerto, 14/09/2026

O resumo das demais cobranças na prévia e no rascunho do encerramento agora apresenta separadamente valor negociado anterior, recebimentos, crédito já utilizado, valor devido proposto, saldo e crédito apurado. O aprovador pode expandir a origem das particulares por hora e conferir os valores dos itens faturados preservados, os recebimentos individuais e as utilizações anteriores de crédito com suas referências de aprovação. Os dados vêm da memória da proposta, sem consultar ou misturar outros contratos.

A apresentação esclarece que crédito apurado acompanha a efetivação aprovada e que uso/devolução seguem os fluxos próprios. Os campos adicionais são opcionais para leitura de versões anteriores. Não houve alteração dos cálculos, permissões ou movimentações financeiras.

Validação: lint aprovado; build Next.js com TypeScript e geração de 52 páginas aprovado; diff sem erros. Sem novo teste de integração porque a alteração se limita à apresentação de dados já produzidos e verificados no incremento 345. Homologação visual interativa permanece pendente. Sem migration, produção ou envio externo.

## Incremento 347 — Regressão completa e pendências estruturais, 14/09/2026

Concluída a regressão completa do estado atual: 825 testes unitários em 89 arquivos e 701 integrações em 53 arquivos, todos aprovados. A integração levou 812,07 segundos no PostgreSQL descartável localhost:54329, com execução sequencial. Relatórios por teste: validacao-regressao-unitarios-347-2026-09-14.json e validacao-regressao-integracao-347-2026-09-14.json. O build/TypeScript/lint mais recente é o incremento 346, sem alteração de código desde então.

Esta regressão comprova os cenários existentes, não os requisitos ainda sem implementação. A revisão confirmou que contratos simultâneos em turmas continuam limitados pelo índice global de alocação e pela ativação. O fluxo global antigo e o índice de solicitações acadêmicas abertas por aluno também exigem revisão antes de liberar múltiplos vínculos. A tela já seleciona matrícula e alguns serviços já restringem pelo contrato; isso não conclui a migração estrutural. Detalhes em validacao-regressao-347-em-andamento.md, agora encerrado como registro histórico.

Não houve alteração de produção, execução de migration nova nem envio externo. Os drivers externos de WhatsApp são simulados nos testes, inclusive nos cenários denominados live. Homologação visual e operação de serviços reais continuam pendentes. O objetivo integral permanece incompleto.

## Incremento 348 — Proteção contra movimentação global de contratos independentes, 14/09/2026

O limite do fluxo legado agora recusa pausa, encerramento e solicitação/decisão de retomada globais quando o aluno tem mais de uma matrícula, mesmo sem movimentação contratual anterior. Também recusa um contrato único já estruturado por preparação comercial, vínculo acadêmico (inclusive histórico), condições por hora ou compra de horas. Mantém as proteções anteriores para pausa e movimentações contratuais. A conferência ocorre sob os bloqueios já usados pelos serviços; a resposta orienta selecionar contratos no fluxo contratual.

Três novos testes de integração exercitam as ações públicas com Secretaria e Administração, dois contratos ativos sem movimentação anterior e contrato único com alocação vinculada. Cada recusa preserva integralmente cadastro, matrículas, cobranças, vínculos, movimentos, propostas e eventos. Um teste acadêmico antigo passou a representar explicitamente alocação legada sem matrícula: continua provando que pausa/retomada reais invalidam aprovação anterior, sem exigir que o caminho global alcance vínculo já migrado.

Validação: 825 unitários aprovados; 36 integrações de retomada aprovadas na primeira execução; após adequação do cenário, 58 integrações (55 acadêmicas e 3 novas) aprovadas. TypeScript, lint e diff aprovados. Não houve migration nem novo build. A regressão completa 347 é anterior a esta alteração; não afirmar que todos os arquivos foram novamente executados.

Esta proteção não libera múltiplas alocações. Permanecem a migração do índice global, do limite de solicitações acadêmicas abertas e dos demais consumidores de situação global, além da homologação e do restante do escopo. O legado não estruturado ainda precisa ser migrado; não é autorização para operar produção pelo caminho antigo.

## Incremento 349 — Fila acadêmica filtrada pela matrícula, 14/09/2026

A consulta de solicitações acadêmicas aceita matrícula e aplica esse filtro pela alocação de origem, conjuntamente com aluno, estado e escopo docente. A página acadêmica passa a matrícula selecionada à listagem e preserva o filtro nos links de paginação. O cursor precisa pertencer ao mesmo escopo; cursor de outro contrato é recusado. A consulta sem matrícula continua sendo a visão consolidada autorizada do aluno/equipe.

Teste integrado com dois contratos e solicitações históricas distintas comprova separação do histórico, filtro de abertas, cursor válido e cursor de outro contrato, combinação de aluno divergente e matrícula, rejeição de matrícula vazia e restrição docente. O professor atual só recebe o pedido de seu vínculo vigente; conhecer a matrícula ou o cursor não amplia a autorização. O cenário usa vínculos sequenciais porque a liberação de múltiplas alocações simultâneas permanece pendente.

Validação: 56 integrações acadêmicas aprovadas; lint e build Next.js com TypeScript e 52 páginas aprovados. Sem migration. Não houve homologação visual interativa nem nova regressão completa. Permanecem os índices globais de alocação e de solicitação aberta e as demais pendências de migração por contrato.

## Incremento 350 — Elegibilidade acadêmica pela matrícula vinculada, 14/09/2026

Mudanças acadêmicas de uma alocação vinculada passam a exigir a situação ativa e a compatibilidade do contrato correspondente, sem depender do status global legado do aluno. O vínculo sem matrícula continua exigindo aluno globalmente ativo. A tela usa as permissões e impedimentos calculados no servidor para oferecer a ação, removendo a condição global redundante.

Novas propostas usam memória versão 2: statusAluno fica nulo para alocação contratual, porque a situação vinculante está na matrícula preservada na memória. Isso não altera o cadastro do aluno. A versão 1 continua sendo lida e comparada segundo sua condição global original; uma mudança global não amplia uma aprovação antiga automaticamente. Alterações de matrícula, vínculo, currículo e demais condições continuam sujeitas à revalidação.

Validação: 828 unitários aprovados, incluindo conservação da versão antiga, independência de status global e recusa de matrícula pausada; 58 integrações acadêmicas aprovadas. Novos cenários solicitam, emitem parecer, aprovam e executam mudança de contrato ativo com cadastro global PAUSADO/ENCERRADO, preservando cadastro e dados financeiros. Build com TypeScript e 52 páginas e lint aprovados. Sem migration, homologação visual ou alteração de produção.

Pendências: ativação e índices ainda limitam múltiplas alocações; migração completa e homologação operacional permanecem incompletas. A regressão integral 347 é histórica; somente os escopos acima foram novamente executados.

## Incremento 351 — Alocações ativas em contratos independentes, 14/09/2026

A migration 20260914140000 substitui a unicidade global por aluno. Mantém uma alocação ativa por matrícula, uma alocação legada ativa sem matrícula por aluno e impede duplicação ativa do mesmo aluno na mesma turma. O banco serializa a conferência pelo aluno e recusa coexistência de vínculo legado sem matrícula com outro vínculo ativo até a conciliação. Nenhum vínculo histórico é inferido ou apagado. Migration aplicada exclusivamente ao PostgreSQL descartável: 158 migrations aplicadas; comparação com o schema sem divergência representável pelo Prisma.

A ativação da preparação passa a conferir o vínculo da matrícula alvo e a pendência de vínculo legado, sem bloquear apenas pela existência de outro contrato ou pela situação global legada. Os requisitos de aceite, pagamentos, reserva, ingresso e comissão permanecem. Consulta acadêmica sem seleção diante de múltiplos vínculos retorna origem ausente, em vez de escolher a primeira alocação.

Validação: 828 unitários aprovados; 150 integrações de reserva/ativação, acadêmico, diário e alocação aprovadas. Após ampliar as asserções de contratos simultâneos, 67 integrações acadêmicas/alocação novamente aprovadas. Os testes comprovam ativação concorrente/repetida preservando contrato e alocação anteriores, mudança acadêmica com outra alocação ativa preservada, recusa sem seleção, unicidade por matrícula em turma livre e bloqueio da mistura com legado nas duas ordens. Build com TypeScript/52 páginas e lint aprovados. Sem homologação visual ou produção.

Pendências: o índice global de solicitação acadêmica aberta ainda impede pedidos simultâneos de contratos diferentes. A revisão completa de consumidores, cenários de concorrência entre fluxos distintos e homologação operacional continua necessária. A liberação estrutural e os testes deste incremento não significam conclusão do objetivo integral.

## Incremento 352 — Solicitações acadêmicas simultâneas por contrato, 14/09/2026

A solicitação acadêmica agora possui matrícula de origem tipada com FK composta ao aluno. A migration 20260914143000 preenche os registros antigos somente pela identidade já preservada na memória da proposta; memória sem vínculo permanece legada. Substitui o índice global de pedido aberto por uma unicidade por matrícula e outra para pedidos legados por aluno. O banco confere correspondência entre alocação, matrícula e memória e impede trocar a identidade da solicitação. Aplicação realizada apenas no banco descartável: 159 migrations; schema diff vazio.

O serviço registra a matrícula exata ao criar o pedido. Teste integrado cria simultaneamente pedidos de dois contratos do mesmo aluno, conserva os dois abertos, repete o mesmo pedido sem duplicar, recusa outra proposta no mesmo contrato e cancelamento de um mantém o outro intacto. Inserção duplicada e alteração de identidade também são recusadas pelo banco.

Validação: 828 unitários aprovados; 59 integrações acadêmicas aprovadas; 53 integrações de avaliações aprovadas após estabilizar os instantes das fixtures. As primeiras execuções de avaliações falharam em limites temporais imediatamente posteriores a aprovação/reserva/designação. Os testes agora conferem o instante do banco antes de registrar eventos seguintes, sem flexibilizar validações de produção. Fixtures de mudanças preexistentes nas avaliações também passaram a identificar a matrícula na coluna e memória. TypeScript, lint e build/52 páginas aprovados. Mudanças posteriores ao build limitaram-se às fixtures, novamente verificadas por TypeScript/lint/integração.

Não houve homologação visual, produção ou envios reais. Permanecem a revisão integral dos consumidores de múltiplos contratos, concorrência entre fluxos distintos, regressão integral posterior às migrations e demais requisitos ainda incompletos.

## Incremento 353 — Pausa e encerramento preservam outra turma ativa, 14/09/2026

Ampliada a integração dos fluxos contratuais com duas alocações ativas reais em turmas distintas. Na pausa, o vínculo é preservado, a chamada da turma pausada exclui o aluno durante a pausa e a chamada do outro contrato continua incluindo-o. O contrato excluído permanece idêntico; o período financeiro iniciado e os recebimentos conservam as verificações anteriores.

No encerramento, os cenários INCLUIR/EXCLUIR o dia efetivo agora mantêm outro contrato alocado em turma própria: a execução encerra somente o vínculo selecionado e preserva integralmente o outro vínculo e contrato. A chamada posterior ao encerramento exclui o vínculo encerrado e mantém o aluno na outra turma. Continuam os testes de crédito, preservação de recebimento e rollback após falha financeira.

As fixtures identificam explicitamente a ativação necessária à elegibilidade histórica; a aplicação não presume essa data. Foi atualizada uma asserção da mensagem do bloqueio global para o texto contratual introduzido em 348. Sem mudança nas regras de produção neste incremento.

Validação: 36 integrações em dois arquivos aprovadas, TypeScript e lint aprovados. Sem migration ou novo build, pois as alterações são de testes/documentação. Homologação visual, regressão completa posterior às migrations e revisão dos demais consumidores seguem pendentes.

## Incremento 354 — Regressão completa após contratos independentes, 14/09/2026

Regressão integral concluída após as migrations 158/159 e as alterações dos incrementos 348–353: 828 testes unitários em 89 arquivos e 710 integrações em 54 arquivos aprovados, sem falhas ou testes pendentes. A integração executou sequencialmente no PostgreSQL descartável e levou aproximadamente 680 segundos. Evidências em docs/validacao-regressao-unitarios-354-2026-09-14.json e docs/validacao-regressao-integracao-354-2026-09-14.json.

A revisão estática dos consumidores encontrou pendências concretas: ação acadêmica pública aceita preparação sem escopo de matrícula mesmo com origem contratual; ficha oferece ações globais que o servidor já recusa para contratos estruturados; consultas de solicitações ainda usam a matrícula da alocação em vez da identidade tipada do pedido. O formulário acadêmico já envia a matrícula quando identificada; a primeira lacuna não foi atribuída a esse formulário. Evidências, limites e critérios de correção em docs/planejamento/revisao-consumidores-contratuais-354.md.

Nenhum código de produção ou teste foi alterado durante a regressão. Este incremento acrescenta evidência e revisão documental; não corrige ainda os consumidores identificados. Diff check aprovado. Sem novo build, migration, homologação visual, produção ou envios externos. Testes aprovados não comprovam funcionalidades ainda ausentes da SPEC, migração real ou operação integral.
## Incremento 355 — Escopo contratual nas novas preparações acadêmicas, 14/09/2026

A ação de solicitar mudança acadêmica agora resolve a matrícula da única origem válida sob os locks existentes e recarrega somente esse contrato antes de capturar a memória. Isso também vale quando o chamador omite matriculaId; múltiplas origens continuam exigindo seleção. A busca de pedido aberto nessa ação usa a identidade tipada da solicitação. Repetir uma proposta existente revalida o escopo preservado em sua própria memória, sem convertê-la silenciosamente para outro regime.

Integração comprova solicitação com e sem matrícula explícita, seguida de outra alocação ativa e pausa de outro contrato, preservando parecer/aprovação/execução do contrato original. Recusa solicitação ambígua sem criar pedido adicional. Memórias anteriores v1/v2 sem escopo conservam seus requisitos e conteúdo; alterar outro contrato ainda invalida essas propostas antigas. Nova contratação posterior à solicitação já vinculada não impede sua execução e permanece integralmente preservada.

Validação: 828 unitários, 62 integrações acadêmicas, TypeScript, lint e build de produção com 52 páginas aprovados. A primeira integração teve 61 aprovações e uma falha em expectativa antiga que exigia invalidar proposta por nova contratação independente; o teste foi substituído por aprovação/execução com preservação do novo contrato, conforme INV-01/INV-04, e a suíte completa acadêmica passou. Relatório: docs/validacao-integracao-academica-355-2026-09-14.json. Sem migration, produção ou envios. A regressão integral de todas as integrações permanece a do incremento 354, anterior a esta correção; homologação visual e os demais consumidores identificados em 354 ainda pendentes.
## Incremento 356 — Identidade histórica das consultas e ações da ficha, 14/09/2026

Lista acadêmica, paginação e consulta de pedido aberto por matrícula agora filtram SolicitacaoMudancaAcademica.matriculaId. Regularização posterior da referência de uma alocação não transfere seu pedido histórico a outro contrato. Pedidos legados sem identidade contratual preservada permanecem na consulta consolidada autorizada, sem atribuição automática à matrícula posteriormente identificada. Escopo docente e validação dos cursores continuam aplicáveis.

A proteção das ações globais e a ficha passam a compartilhar impedimentoFluxoGlobal. A página consulta a elegibilidade após autorizar a ficha e somente para quem pode movimentar. Contratos estruturados/múltiplos não recebem botões globais de pausa/encerramento/retomada nessa ficha; o link identifica o fluxo por matrícula, incluindo encerramento. O estado global foi rotulado como Cadastro. A leitura de elegibilidade não substitui a revalidação sob locks nas ações; edição cadastral e ações acadêmicas preservam suas capacidades anteriores.

Validação: 63 integrações acadêmicas aprovadas, incluindo histórico realocado, pedido legado e cursor fora do contrato; três integrações de proteção legada aprovadas, com consulta antes/depois do vínculo e recusa de chamadas diretas preservando os dados. Lint, TypeScript pelo build e build de produção com 52 páginas aprovados. Diff check aprovado. Relatório acadêmico em docs/validacao-integracao-academica-356-2026-09-14.json. Sem nova migration ou homologação visual. A revisão de outros caminhos legados, inclusive apresentação da retomada na ficha financeira, e as demais funcionalidades incompletas seguem pendentes. A última regressão integral continua sendo 354; esta rodada verificou os escopos alterados.
## Incremento 357 — Retomada financeira respeita limite contratual, 14/09/2026

O contexto da retomada global consulta a mesma regra de impedimento das ações. Contratos estruturados ou múltiplos bloqueiam a preparação global e não recebem uma grade de parcelas para esse fluxo. Na lista individual e global, propostas pendentes informam impedimento de aprovação; a interface omite a aprovação incompatível, conserva consulta/rejeição independente e oferece acesso ao fluxo por matrícula. A ficha financeira passa a oferecer esse acesso diretamente. A consulta compartilha o resultado por aluno para não repeti-la em cada proposta da mesma pessoa.

Rejeitar continua sendo uma decisão distinta de retomar: não altera situação, parcelas ou recebimentos. O teste cria uma proposta antiga, adiciona outro contrato, verifica impedimento no contexto/lista, recusa aprovação direta e permite rejeição independente, preservando o aluno, calendário, recebimentos e outro contrato.

Validação: 37 integrações de retomada aprovadas, lint e build com TypeScript/52 páginas aprovados. Relatório docs/validacao-retomada-357-2026-09-14.json. Após o build, somente o texto do aviso de rejeição foi ajustado para não afirmar que o aluno necessariamente continua pausado. Sem migration, produção, envio externo ou homologação visual. Última regressão integral permanece 354; demais funcionalidades da SPEC seguem incompletas.
