# Revisão de integração e corpos das próximas entregas

**Referência de implementação:** estes corpos integram a [SPEC central](../specs/erp-educacional.md). A [SPEC da matrícula](../specs/matricula-como-unidade-operacional.md) detalha B01/Q102, relações, contratos de operações, migração e testes de isolamento. Respostas até Q102 permanecem em F07; Q103–Q123 estão no [registro comercial](entrada-comercial-e-contrato.md). O [complemento comercial/documental](corpos-entrada-comercial-contrato.md) acrescenta quatro corpos, COM01 e DCT01–DCT03: total de 18 propostas para revisão antes das issues.

**Consolidado em 10/09/2026.** Pacote para revisão antes da criação das issues. Reúne os corpos das entregas, dependências, permissões e critérios de aceite derivados das decisões registradas no [refinamento F07](f07-agenda-aulas.md). Q100–Q102 foram esclarecidas durante esta revisão, todas com opção C.

Os códigos deste arquivo são referências internas, não números de issues do GitHub. F07.1–F07.7 conservam os identificadores existentes. B01/B02, P01/P02, N01, M01 e V01 organizam componentes compartilhados, particulares contratadas, comunicação e preparação operacional. Essa divisão organiza o escopo aprovado; não inclui funcionalidades novas por atribuir um código.

**Estado:** implementação autorizada e iniciada por [B01 — expansão do vínculo acadêmico](implementacao-b01.md), com evidências próprias. Restante dos corpos segue para implementação/revisão técnica; nenhuma issue, carga real ou integração externa ativada nesta etapa. Os testes anteriores de D01–D14 não validam estas ampliações.

## 1. O que a revisão do código mudou na organização

| Evidência atual | Consequência para a entrega |
|---|---|
| [Matricula e Cobranca](../../prisma/schema.prisma) guardam mesesPlano, competência e vencimento, sem a cobertura contratual estruturada necessária aos novos cálculos | B01 passa a ser a referência comum de contrato, cobertura, preço e vencimento para F07.5 e P01 |
| [Cálculo de vencimento](../../src/server/_shared/regras.ts) constrói datas com o dia informado; [schema da matrícula](../../src/server/matricula/schema.ts) aceita somente 5/10/15/20/25 | Ampliar a lista para 1–31 sem adaptar o cálculo permite transbordar para o mês seguinte. B01 deve calcular o último dia válido, preservar referência e depois aplicar Q99, sem deslocar a competência silenciosamente |
| [Ativação](../../src/server/matricula/acoes.ts) procura taxa e primeira mensalidade e depois gera meses 2..N | P01 precisa adaptar criação/ativação ao modelo por hora, conforme Q100; não criar mensalidade fictícia nem deixar a rotina mensal gerar cobranças indevidas |
| [Recebimento](../../prisma/schema.prisma) pertence obrigatoriamente a uma cobrança; [receberTx](../../src/server/financeiro/recebimentos.ts) soma recebimentos nessa cobrança | B02 precisa representar pagamento original, destinações e crédito sem duplicar entrada de dinheiro. Um evento textual ou campo saldo não substitui essas relações |
| [dinheiro](../../src/server/financeiro/regras.ts) já utiliza Decimal, duas casas e ROUND_HALF_UP | Reutilizar a convenção como proposta técnica para os novos valores, com precisão intermediária e itens rastreáveis; não transformar minutos em Float arredondado antes da cobrança |
| [TurmaSchema](../../src/server/turmas/schema.ts) exige fim manual e horário final maior no mesmo dia; professor é opcional | F07.2 precisa de encontros com início/fim completos, publicação distinta de rascunho e bloqueio efetivo de conflitos |
| [Diário](../../src/server/diario/acoes.ts) busca alocações atualmente ativas e permite atualizar o próprio lançamento dentro do vínculo vigente | F07.4 precisa da elegibilidade histórica, estados de conclusão, gravação, responsáveis designados e aprovação das correções; conservar os controles atuais de autoria |
| [Pausa/encerramento](../../src/server/alunos/acoes.ts) cancelam mensalidades futuras pelo vencimento; [retomada](../../src/server/retomada/acoes.ts) atua sobre parcelas/proposta já existentes | F07.5 deve passar a avaliar cobertura e acerto; P01 deve integrar validade/saldo de horas. Alterar somente rótulos na tela não atende esses fluxos |
| [pausarAluno/encerrarAluno](../../src/server/alunos/acoes.ts) alteram o cadastro do aluno inteiro e alcançam suas matrículas/alocações | Q102 permite selecionar um ou vários contratos e aprovar o conjunto antes de aplicar. B01/F07.5/P01 precisam preservar os excluídos e recalcular acesso/estado geral pelos vínculos, sem tratar contrato e aluno como a mesma entidade |
| [AlocacaoTurma](../../prisma/schema.prisma) agora admite matrícula explícita; restrição por aluno permanece durante expansão | Primeiro incremento liga novas alocações e preserva referência em transferências. Conferir legado e migrar consumidores antes de retirar restrição global; não escolher contratos arbitrariamente |
| [Capacidades adicionais](../../src/server/_shared/capacidades.ts) cobrem exportação, caixa e configuração de comissão; [autenticação](../../src/lib/auth.ts) autentica Usuario interno | Aprovação financeira específica dos novos acertos e execução de devolução precisam de autorização explícita; F07.7 requer identidade do aluno própria, sem papel de funcionário |
| [TipoCobranca](../../prisma/schema.prisma) inclui HORA_PARTICULAR, mas não relaciona duração, fechamento ou consumo aos encontros | P01 precisa da apuração por ocorrência. Q101 permite parcial/complemento aprovado: a unicidade deve impedir repetir uma ocorrência, sem impedir documentos complementares do mesmo fechamento |
| [Importadores atuais](../../src/app/api/alunos/importar/route.ts) leem formato cadastral; a [primeira planilha analisada](analise-planilha-operacional-leticia.md) tem histórico e financeiro incompletos | M01 prepara correspondência, prévia e conciliação por conjunto; os importadores existentes não constituem migração completa |

O escopo desta conferência foi verificar os pontos de integração dos novos fluxos. Não foi executada nova auditoria integral da aplicação nem uma suíte de regressão.

## 2. Limites e contratos compartilhados entre as entregas

### 2.1 Estado acadêmico e estado financeiro

Um encontro tem identidade estável, início/fim, professor efetivo, origem e versões. Diário, reposição e cobrança referenciam essa identidade. A ocorrência financeira identifica realização/falta/cancelamento conforme a regra aplicável; não concede presença nem marca aula ministrada. Ausência de gravação gera pendência acadêmica própria. A conferência de Q101 não transforma a entrega da gravação em requisito financeiro novo.

Cada contrato declara o modelo comercial. Mensalidade fixa segue Q09/Q62–Q71; particulares por hora seguem Q86/Q91–Q101. A mesma aula não é simultaneamente uma reposição gratuita com consumo de benefício e uma particular contratada cobrada, sem relação explícita que justifique a operação. A particular excepcional de Q34 permanece sem cobrança nem consumo da cota normal.

Q102 permite selecionar um ou vários contratos na pausa/encerramento. A proposta identifica o conjunto, as datas efetivas e os impactos de cada contrato; aprovações necessárias precedem a aplicação, preservando os excluídos. Não alterar o aluno para um estado global que impeça usar outro contrato ainda ativo. Acesso a cada aula/material segue o contrato correspondente: existir outro contrato ativo não libera conteúdo do contrato pausado/bloqueado. Pausa/encerramento continua respeitando as datas e condições aprovadas, sem aumentar dias cobrados por demora interna. A seleção coletiva acrescenta controle sobre o conjunto e não dispensa os acertos de cada modelo.

### 2.2 Propostas e quatro dimensões de acesso

| Operação | Quem age | Registros e campos | Condições verificadas no servidor |
|---|---|---|---|
| Organizar calendário/agenda | Secretaria, Gerência Pedagógica, Administração | Agenda e dados acadêmicos necessários; sem anexar valores financeiros ao retorno docente | Publicação válida, professor disponível; alteração/exceção depende de outra pessoa autorizada |
| Aprovar mudança de calendário, agenda ou correção acadêmica | Outra pessoa da Gerência Pedagógica/Administração | Proposta, motivo, impactos e versão examinada | Autor não aprova a própria proposta; revalidar papéis, vínculo, conflitos e conteúdo |
| Registrar aula/parecer/avaliação | Professor com vínculo ou designação vigente | Somente encontros/alunos/entregas atribuídos; sem telefone pessoal, valores ou dívida | Histórico do ex-professor em leitura; designação pontual não amplia acesso à turma inteira |
| Preparar ajuste, acerto, uso de crédito ou permuta | Financeiro; Secretaria apenas no alcance de solicitação/informe já aprovado | Contrato, cobrança, evidência e memória necessários ao caso | Não efetivar por preparar; separar confirmação de pagamento, aprovação e execução |
| Aprovar acerto/uso de crédito/devolução/permuta/emissão parcial | Outro Financeiro com permissão específica ou outra pessoa da Administração | Proposta financeira e efeitos | Usuário atual autorizado, versão válida e pessoa distinta do proponente, inclusive acumulando papéis |
| Executar devolução | Financeiro com permissão de execução | Valor/destino aprovados e evidência de saída | Preparador pode executar depois de outra pessoa aprovar; mudança de valor/destino exige nova aprovação |
| Consultar negociação | Comercial no escopo vigente | Carteira/equipe/cobertura e campos comerciais já permitidos | Não ganhar dados do diário, saldo global ou edição cadastral após assunção pela Secretaria |
| Usar área de reposições | Aluno autenticado | Próprias reposições, material autorizado, entregas e avaliações | Matrícula, autorização, prazo e acesso ao conteúdo revalidados; aluno não aprova a própria entrega |
| Exportar | Usuário com concessão específica | Mesmos registros e campos permitidos em tela | Revalidar concessão e escopo na geração; não reutilizar consulta administrativa ampla |

As permissões específicas novas são requisito de B02, não capacidades já implementadas. Seus nomes internos serão definidos na implementação. Administração concede configurações sensíveis; consulta operacional mostra somente os parâmetros necessários à função. Acúmulo de papéis preserva a vedação de autoaprovação.

Toda proposta mantém estado, proponente, decisor, versão, motivo e impactos. Estados técnicos sugeridos: rascunho, em análise, rejeitada, cancelada, aplicada e obsoleta. Uma aprovação não aplicada em sistema externo permanece distinguível de uma execução concluída. Calendário/agenda aplica ao aprovar (Q21); mudança de nível mantém execução pela Secretaria de D14. Devolução conserva etapa de execução de Q69.

### 2.3 Dinheiro, tempo e repetição de operações

- **Proposta técnica monetária:** preservar a escala de duas casas já existente para CRC/USD e ROUND_HALF_UP; calcular com Decimal/razão exata, nunca Float de minutos. Na particular, calcular cada item a partir de preço aplicável × minutos contratados ÷ 60 e arredondar uma vez ao registrar o item monetário; totalizar itens. Descontos/rateios mantêm memória e distribuição determinística de eventual centavo, para que documentos, saldos e estornos fechem. Não reescrever valores históricos ou converter moeda automaticamente.
- Contratos/preços/regras de benefício são versionados por vigência. Uma mudança de catálogo não reprecifica serviço já quitado, muda cláusula antiga ou reinicia cota. Propostas exibem a versão usada; alteração relevante exige revisão.
- Cobertura usa datas civis da referência contratual, separadas do vencimento. Dias reais de cobertura não são calculados dividindo milissegundos por 24 horas. Representação técnica sugerida: intervalos com início incluído e fim exclusivo, com conversão explícita para o último dia coberto de Q28.
- Agenda usa instantes de início/fim e fuso IANA de origem; escola mantém fuso letivo e usuário mantém preferência de exibição. Intervalos adjacentes não são sobreposição. Hora local ambígua/inexistente exige correção/escolha explícita na preparação; não deslocar aula silenciosamente.
- Publicação/replanejamento trava e revalida o conjunto, inclusive nova turma afetada enquanto a proposta era analisada. Aplicar alterações e evento de comunicação na mesma transação; enviar depois da confirmação da transação. Falha não deixa publicação parcial.
- Crédito disponível, reservado para execução, utilizado e devolvido devem reconciliar com sua origem. Recebimento original, quitação por destinação e compensação de permuta são fatos diferentes. Resultado externo incerto de devolução mantém reserva/conciliação, sem liberar saldo para segunda utilização.
- Fechamento mensal tem identidade por contrato/período; parcial e complementos referenciam esse fechamento. Cada ocorrência possui uma única destinação financeira vigente. Corrigir algo já emitido gera ajuste rastreável, sem apagar documento ou reemitir o encontro.

## 3. Corpos consolidados

Os requisitos comuns acima fazem parte dos corpos. Ao preparar uma issue, vincular este pacote e o registro das decisões correspondente. Os critérios abaixo são verificações exigidas da implementação futura; caixas não representam testes já executados.

### B01 — Estruturar contratos, vínculos, cobertura, preços e vencimentos

**Problema e resultado:** competência/vencimento e preço atual não bastam para reconstruir cobertura, proporcional ou particulares. Registrar as condições efetivamente aplicáveis ao contrato e usar uma única rotina de cálculo nos fluxos consumidores.

**Escopo:** modelo mensal ou por hora; versão de condições e preço/moeda; cobertura civil/ciclo contratual; referência de vencimento 1–31 com último dia do mês e ajuste financeiro de Q99; ordem de desconto, multa/base/cláusula e continuidade. Incluir configuração inicial da oferta por hora de Q100, com exigência/dispensa, valor ou horas e memória do valor correspondente. Configuração incompleta bloqueia somente a operação dependente, indicando os campos necessários.

Incluir identidade operacional por matrícula/contrato e correspondência das alocações/participações conforme Q102. Revisar a unicidade global de AlocacaoTurma ao introduzir contratos independentes, preservando a vedação de duplicidade no vínculo aplicável. D13/D14, documentos, cobranças, diário e materiais devem identificar a matrícula correta; vínculos legados ambíguos ficam em conferência na migração, sem escolha por nome ou primeira linha.

**Complemento comercial de 10/09/2026:** Q103–Q123 responderam o bloco da jornada iniciada pelo vendedor e dos documentos. A criação atual já grava pessoa nova, cobranças e eventual alocação ativa; não é um rascunho sem efeitos. B01 fornece a base da matrícula/condições; COM01 implementa negociação própria, reutilização de identidade, reserva, conferência e gatilhos da nova jornada. Preservar comissões/autoria anteriores e alçadas vigentes. DCT01–DCT03 organizam modelos/PDF, assinatura e aditivos separadamente.

**Disponibilidade e entrada:** Q103 exige disponibilidade para avançar à taxa/assinatura; Q107–Q111 definem reserva, expiração protegida, limite de admissão, exceção e horários das particulares. COM01 integra a fonte de disponibilidade de F07.2/P01, sem criar outra agenda ou presumir prazo numérico. Q112/Q119 separam emissão inicial de preparação, confirmação financeira e ativação.

**Permissões/estados:** Administração configura políticas globais e referências financeiras; condições negociadas seguem alçadas/escopo já aprovados. Registrar vigência e versão em cada proposta; não liberar edição administrativa ao professor ou aluno. Contrato/documento aceito mantém sua evidência e não substitui campos estruturados.

**Aceite:**

- [ ] Referência 31 gera último dia do mês curto e volta a 31; regra de dia não útil usa referência contratual configurada, sem deslocar cobertura ou aplicar recesso escolar.
- [ ] Contratos com inclusão/exclusão do dia e desconto antes/depois do proporcional produzem a memória correspondente; condição ausente não vira padrão oculto.
- [ ] Preço novo não altera documento/serviço passado; unidades por hora preservam minutos/60 e total dos itens.
- [ ] Configuração de adiantamento distingue valor e horas; falta de preço/unidade aplicável impede exigir um valor inventado. Ofertas mensais preservam configuração de primeira mensalidade.
- [ ] Dois contratos do mesmo aluno preservam vínculos e acesso independentes; unicidade não impede contratos distintos nem permite duplicar o mesmo vínculo. Leituras/transferências/retomadas usam o contrato identificado.

**Dependências/limites:** base de F07.5, P01/P02 e B02. Não gerar cobranças recorrentes, declarar integração bancária, parametrizar tributos ou alterar contratos existentes apenas pela edição do catálogo.

### B02 — Preservar recebimentos, destinações, créditos e devoluções aprovadas

**Problema e resultado:** um recebimento atualmente pertence a uma cobrança. Antecipação para vários serviços, crédito sem destinação e compensação não podem ser representados duplicando recebimentos. Entregar o registro financeiro comum usado por mensalidades e particulares.

**Escopo:** pagamento original com pagador, moeda, evidência e data; destinações identificadas; crédito com origem e movimentos; proposta de uso com concordância Q68; devolução Q69 com reserva, aprovação e execução distintas. Identificar empresa responsável financeira em contratos individuais de Q88. Preservar conciliação e compatibilidade dos informes/recebimentos existentes de D01–D14. Incluir permissões específicas de aprovação financeira e execução de devolução, concedidas pela Administração.

**Permissões/estados:** Secretaria informa; Financeiro confirma conforme regras existentes. Novo ajuste/uso exige outro aprovador autorizado. Devolução permite preparador executar se autorizado, após outra pessoa aprovar. Empresa pagadora não recebe portal ou visibilidade acadêmica; titular e destino de ajustes são conferidos pelo acordo/origem.

**Aceite:**

- [ ] Uma antecipação destinada a vários períodos conserva um único recebimento original e alocações cuja soma confere; não duplicar caixa por mês quitado.
- [ ] Uso concorrente e devolução do mesmo crédito não ultrapassam saldo; rejeição/cancelamento libera somente a reserva correspondente e conserva histórico.
- [ ] Resposta externa incerta não vira devolução confirmada nem permite repetir saída automaticamente; conciliação registra resultado e evidência.
- [ ] Autor não aprova o próprio ajuste; papel sem capacidade não aprova/executa; revogação durante análise é revalidada.
- [ ] Status, relatórios, lembretes e acesso distinguem dívida remanescente de crédito/compensação; não preencher valorRecebido com dinheiro fictício.

**Dependências/limites:** B01 e regras vigentes de informes/caixa. Não inclui contrato corporativo coletivo, transferência de crédito entre alunos, câmbio ou autorização para movimentar conta bancária automaticamente.

### F07.1 — Criar o calendário letivo único e sua referência temporal

**Problema e resultado:** geração de aulas precisa de dias letivos comuns para toda a escola, independentemente do país ou fuso de exibição.

**Escopo:** feriado, recesso e férias por data/intervalo, nome/motivo, autoria e fuso institucional. Consultar disponibilidade e histórico de versões. Exceção por encontro e alteração que afete agenda publicada usam F07.3, sem publicar por editar diretamente o calendário.

**Permissões/estados:** Secretaria/gestão organiza; mudança/exceção segue aprovação por outra pessoa da Gerência Pedagógica/Administração. Versão em preparação não modifica o calendário aplicado.

**Aceite:**

- [ ] Turmas mistas recebem os mesmos bloqueios institucionais, inclusive quando a data local da turma difere da escola.
- [ ] Troca de fuso de exibição não muda a decisão de disponibilidade; intervalo de aula que cruza dia não letivo exige exceção específica.
- [ ] Alteração global com turmas publicadas somente entra em vigor pelo conjunto aprovado de F07.3; não antecipar avisos.

**Dependências/limites:** fornece calendário a F07.2. A alteração de agendas publicadas só é habilitada com F07.3 integrado; criação inicial não deve ser apresentada como entrega completa das alterações. Importação automática de feriados por país está fora.

### F07.2 — Gerar encontros, previsão de término e disponibilidade docente

**Problema e resultado:** grade textual não reserva o período efetivo do professor. Gerar e publicar encontros até a meta de aulas por nível e impedir conflito real.

**Escopo:** data inicial mínima, grade, duração/frequência herdadas, fuso, professor, meta; próximo encontro válido de Q46; término após meia-noite de Q47; indisponibilidades aprovadas Q39; rascunho sem professor Q44; início automático da turma Q48. Exceções de duração/frequência exigem F07.3/Q37 antes de publicar. Compartilhar a checagem de intervalos com reposições e particulares contratadas.

**Permissões/estados:** Secretaria/gestão prepara; professor atual ou substituto tem atribuição temporal. Rascunho não confirma ocupação, permite publicação ou alocação. Solicitação de ausência docente pendente não bloqueia novos horários por si só; aprovação bloqueia novos e identifica os já existentes para solução.

**Aceite:**

- [ ] Início fora da grade/feriado encontra próximo dia válido e mantém meta; gerar duas vezes não duplica encontros.
- [ ] 23h–1h é um encontro e confere todo o intervalo; turma anterior encerrada libera o horário futuro.
- [ ] Duas publicações simultâneas para o mesmo professor/intervalo não passam ambas, inclusive particular versus turma.
- [ ] Rascunho sem professor não permite publicar/alocar por chamada direta; relógio inicia turma somente por encontro oficial, sem marcar aula ministrada.

**Dependências/limites:** F07.1; integração com F07.3 para exceções e ausências. Não aprova nível do aluno nem gera mensalidade por aumento da previsão de término.

### F07.3 — Aprovar e aplicar replanejamento, cancelamentos e substituições

**Problema e resultado:** editar grade/modalidade diretamente pode perder história ou aplicar uma mudança global só em parte. Entregar proposta revisável e aplicação independente do conjunto válido.

**Escopo:** mudanças de calendário/modalidade Q20/Q41; aumento de meta em todas não finalizadas Q43; redução somente antes do início Q42; exceções locais Q37; cancelamento solicitado pelo professor; data de reposição coletiva escolhida pela gestão Q08; substituição temporária Q56; solução das aulas afetadas por ausência Q39. Preservar ministradas e encontros passados com pendências. Publicação aplica ao aprovar Q21 e produz evento para N01.

**Permissões/estados:** Secretaria/gestão prepara; professor solicita cancelamento próprio; outra pessoa da Gerência Pedagógica/Administração aprova. Proposta pendente/rejeitada não muda agenda. Professor titular permanece distinto do efetivo e do regularizador.

**Aceite:**

- [ ] Aumento/redução afeta exatamente as turmas permitidas e respeita exceções locais; início automático impede redução indevida por diário atrasado.
- [ ] Conflito, nova turma afetada ou alteração concorrente invalida a proposta; falha não publica subconjunto e nova aprovação examina versão atual.
- [ ] Cancelamento mantém origem e reposição, sem contar ambos para a meta; substituto recebe somente os encontros atribuídos.
- [ ] Aviso de N01 só nasce após aplicação efetiva e repetição não duplica mudança ou envio.

**Dependências/limites:** F07.1/F07.2 e N01 para comunicação completa. Aprovação acadêmica não autoriza compensação financeira, que mantém B02/F07.5/P01/P02.

### F07.4 — Concluir aulas e manter diário histórico com correções aprovadas

**Problema e resultado:** registro atual usa vínculos ativos e não possui conclusão condicionada à gravação. Representar quem era elegível na aula, sua realização e as pendências de documentação.

**Escopo:** presença, conteúdo e gravação; aula continua prevista até conclusão; pendência no fim do horário e avisos internos Q22; exceção sem gravação Q07; correções independentes Q23; responsável designado Q24; lista histórica Q53; indisponibilidade relatada/confirmada Q57; impedimento por restrição Q59. Link de material referencia F07.7, sem tornar arquivo externo público.

**Permissões/estados:** professor vigente/designado registra dentro do escopo; ex-professor mantém leitura das próprias aulas. Outra pessoa da gestão aprova exceção/correção; gestão designa regularizador e preserva autoria original.

**Aceite:**

- [ ] Aluno transferido depois da aula permanece elegível na chamada antiga; aluno que entrou depois não aparece. Ausência de evidência não inventa presença.
- [ ] Presença sem gravação ou gravação sem presença não conclui normalmente; exceção válida exige justificativa/decisão independente.
- [ ] Correção preserva antes/depois e resultado vigente até aplicação aprovada; designação pontual não libera outra aula.
- [ ] Impedimento por restrição permanece no denominador sem presença até reposição válida; retirada de bloqueio não altera chamada automaticamente.

**Dependências/limites:** F07.2/F07.3; integra F07.6 para frequência. Material perdido depois não apaga aula concluída; cobrança de particular não transforma falta em presença.

### F07.5 — Gerar continuidade e aprovar cobertura, pausa e acerto de encerramento

**Problema e resultado:** cronograma finito e cancelamento por vencimento não representam as condições já aprovadas. Emitir períodos devidos e apurar encerramento com saldos rastreáveis.

**Escopo:** continuidade contratada Q30/Q64; indisponibilidade da escola Q32; cobertura Q62; desconto Q63; pausa imediata Q65 e retomada com cobertura/vencimentos Q66; proporcional Q15/Q28, retroatividade excepcional Q31, multa Q17; escolha entre crédito/cobertura futura Q67; dias compensados Q70/Q83; crédito e cobrança final única Q29/Q71. Usar B01 para cálculo e B02 para movimentos, uso/devolução.

**Permissões/estados:** Financeiro prepara acerto; outro Financeiro autorizado/Administração aprova. Secretaria executa seu alcance operacional sem dispensar aprovação financeira. Q102 seleciona um ou vários contratos e exige mostrar/aprovar os impactos antes da aplicação. A seleção não libera autoaprovação ou operação sobre contratos fora do escopo. Pausa e retomada conservam condições D13 e suas ampliações; conclusão acadêmica não encerra contrato.

**Aceite:**

- [ ] Mesmo período não é cobrado novamente ao passar A1→A2; sem continuidade/contrato/oferta válidos a geração não ocorre. Atraso do diário não cria extensão.
- [ ] Pausa preserva o período iniciado, mesmo se o vencimento for futuro; retomada aprova cobertura e vencimentos juntos, sem sobreposição.
- [ ] Encerramento calcula dias civis reais e regra de inclusão do contrato, descontos na ordem correta e multa separada; data aprovada não é aumentada pela demora interna.
- [ ] Período inteiro sem oferta mantém escolha Q67; parte sem oferta mantém compensação de dias Q70. Ao encerrar, somente dias ainda devidos entram no acerto Q83, sem dupla compensação.
- [ ] Cobrança final única depende de concordância e aprovação, vincula originais como substituídas e não duplica dívida. Encerramento efetiva pela data aprovada sem exigir quitação.
- [ ] Seleção de um contrato preserva os demais; seleção coletiva mostra acertos por contrato/modelo e aplica somente o conjunto aprovado válido. Mudança de seleção/impacto exige revisão; falha não encerra parte por acidente. Histórico/acesso geral não bloqueia contrato excluído ainda ativo.

**Dependências/limites:** B01/B02, histórico e D13/D14. Não criar um segundo controle de créditos dentro desta entrega. Preço por hora não usa proporcional de mensalidade automaticamente.

### F07.6 — Autorizar reposições e controlar benefícios e avaliações

**Problema e resultado:** falta original e reposição precisam de vínculo e resultado conferível. Entregar pedido, autorização, execução e frequência regularizada sem apagar ausência.

**Escopo:** particular pelo benefício do plano ou gravação/resumo/atividade Q10/Q13; aprovação de outra pessoa da gestão e agendamento pela Secretaria Q11; quotas/periodicidade/versionamento Q14/Q16/Q25/Q26/Q49–Q51/Q60/Q61; avaliação/correções e prazos Q35/Q40/Q52; correção de conclusão Q54; data da validação gravada Q55; indisponibilidade e pausa do prazo Q34/Q57/Q58; acesso em matrícula pausada/encerrada Q36.

**Permissões/estados:** gestão autoriza pedido; Secretaria agenda; professor designado avalia e pede correção. Entrega pendente/vencida não é aprovação. Autorização de envio em pausa/encerramento é pontual e não remove restrição de conteúdo.

**Aceite:**

- [ ] Reserva usa período da particular e confere saldo; remarcação entre períodos libera/reserva corretamente, sem devolver consumo anterior por falta/tardio.
- [ ] Cota inicial integral, sem acumular livre; nova versão/plano no próximo período honra reservas sem conceder saldo duplicado.
- [ ] Aprovação de reposição regulariza a aula original uma única vez e preserva ausência/impedimento e tentativa anterior. Particular vendida de P01 não consome essa cota.
- [ ] Vencimento bloqueia envio novo, não avaliação de entrega existente; indisponibilidade confirmada devolve só tempo restante, sem duplicar intervalos.
- [ ] Exceção Q34 não cobra nem consome benefício; alteração de resultado concluído exige outra pessoa e preserva versões/autoria.

**Dependências/limites:** F07.2–F07.4, condições versionadas e F07.7 para jornada do aluno. Não entrega progressão F09, jornada comercial completa de troca de plano F10 ou portal completo F13.

### F07.7 — Autenticar o aluno e reproduzir suas gravações no ERP

**Problema e resultado:** login interno e vídeo da Inbox não comprovam acesso do aluno ao Drive. Entregar a área restrita de reposições com reprodução autorizada no ERP.

**Escopo:** identidade vinculada ao aluno; convite individual, senha e recuperação por token de uso único Q72; pendência de e-mail Q73; recuperação assistida independente Q74; próprias reposições e entregas Q33/Q36; Drive compartilhado oficial Q77/Q79; player/transmissão pelo servidor sem conta Google do aluno Q81; sem recurso de download/offline Q82. Relacionar arquivo/versão, aula e autorização.

**Permissões/estados:** aluno acessa seus próprios dados; Secretaria orienta/prepara recuperação e outra Administração confere/aplica. Credenciais do Drive ficam no servidor. Sessões, tokens, vínculo, prazo, matrícula e bloqueio são revalidados; autoria e avaliações não mudam com o login.

**Aceite:**

- [ ] Trocar ID do aluno/reposição/material, usar token reutilizado/expirado ou sessão revogada não abre acesso. E-mail individual ausente deixa pendência sem conta fictícia.
- [ ] Gravação inicia, avança e retoma pelo ERP; requisição não expõe credencial/link público nem carrega o vídeo inteiro na memória do servidor.
- [ ] Revogação impede novas leituras e interrompe fluxo ativo segundo verificação de autorização do serviço; documentar dados já transmitidos/bufferizados como limite técnico, sem prometer impedir captura.
- [ ] Falhas de permissão, material, intervalo de bytes ou provedor geram resposta/pendência coerentes, sem exposição de outro arquivo. Verificar versão para não misturar trechos de materiais diferentes.
- [ ] Homologação mede latência, concorrência, memória, banda, limites e custo no ambiente real autorizado antes de habilitar a reprodução em produção.

**Dependências/limites:** F07.6, N01 para convites/e-mail e configuração institucional do Drive. Não inclui portal financeiro, login de responsável, migração automática do acervo, gravação automática, Google Vids/transcodificação ou armazenamento definitivo adicional. Formatos incompatíveis ficam em regularização, sem afirmar reprodução universal.

### P01 — Contratar, ativar e fechar particulares por hora com antecipações

**Problema e resultado:** HORA_PARTICULAR é um tipo de cobrança sem fluxo completo. Entregar a particular contratada com configuração de entrada, encontros, apuração e saldo, separada do benefício de reposições.

**Escopo:** mensalidade fixa ou preço/hora explícitos Q86; antecipação Q87; ativação Q100; duração contratada e hora de 60 minutos Q91/Q94; cancelamento/falta do aluno Q92; cancelamento pela escola Q95; fechamento mensal Q93 com parcial aprovado Q101; pausa/validade Q96; saldo no encerramento Q97. Associar os encontros oficiais ao contrato/aluno, preservando vínculos de turma quando existentes e controles comuns de agenda.

**Permissões/estados:** Comercial negocia no escopo/alçada; Secretaria confirma contrato e prepara agenda/informe; professor registra ocorrência sem preço; Financeiro confere, fecha e propõe ajustes. Oferta por hora configura exigência/dispensa de adiantamento e explicita valor/horas no contrato. Emissão parcial exige outro aprovador financeiro autorizado.

**Aceite:**

- [ ] Ativação por hora usa contrato, taxa e adiantamento configurado; não exige/cria mensalidade fictícia e não dispara mesesPlano. Configuração de adiantamento exigido sem pagamento confirmado bloqueia.
- [ ] Encontro de 75 minutos cobra 1,25 hora contratada. Diferença de duração financeira exige ajuste aprovado; não ler gravação pendente como falta/não realização automaticamente.
- [ ] Cancelamento no prazo não cobra; tardio/falta cobra integral sem presença. Escola cancela sem consumo/cobrança e mantém escolha do aluno entre remarcação/crédito, com as aprovações correspondentes.
- [ ] Fechamento incompleto mostra ocorrências pendentes; parcial só é emitida depois de aprovação independente. Complementares conservam período/origem e incluem apenas ocorrências ainda não cobradas. Falha/repetição não duplica.
- [ ] Antecipação não reaparece como nova dívida; pausa conserva saldo/tempo de validade; encerramento usa preço/condições originais e gera crédito aprovado sem novas aulas por contrato encerrado.
- [ ] Pausar/encerrar a particular selecionada não bloqueia o curso regular de outro contrato; incluir ambos na proposta confere cada saldo/cobertura antes de aplicar. O acesso a uma particular pausada não é liberado apenas porque o curso regular continua ativo.

**Dependências/limites:** B01/B02, F07.2–F07.4, integração com pausa/acerto F07.5. Não aplica quota gratuita, cria presença financeira ou remunera professor automaticamente. Não amplia portal F07.7 para gestão comercial de particulares nesta entrega.

### P02 — Compensar permuta por serviço comprovado

**Problema e resultado:** anotação de permuta não comprova entrada de dinheiro ou cumprimento integral. Registrar acordo e compensações por período com validação independente.

**Escopo:** acordo, vigência, quantidade/contrapartida, regra/valor e cobranças compensáveis; evidência do serviço confirmado pelo Pedagógico; proposta do Financeiro e aprovação Q89; parcial somente pela parte comprovada Q98. Usar B02 para movimento de compensação e B01 para condições/versionamento.

**Permissões/estados:** Pedagógico confirma serviço necessário sem obter finanças completas; Financeiro calcula; outro Financeiro autorizado/Administração aprova. Proposta não altera saldo antes da aplicação. Falta de fórmula/evidência deixa pendência explícita.

**Aceite:**

- [ ] Serviço parcial compensa apenas a fração comprovada pelo acordo, e o saldo restante mantém condições aplicáveis.
- [ ] Mesmo serviço/evidência não compensa duas cobranças acima do valor autorizado; correção mantém antes/depois e nova aprovação.
- [ ] Compensação não aparece como dinheiro recebido nem converte automaticamente o acordo em bolsa/isenção.

**Dependências/limites:** B01/B02; não inclui folha/remuneração docente F16, obrigações fiscais ou execução de transferências bancárias.

### N01 — Comunicar alterações e acesso com fila institucional rastreável

**Problema e resultado:** aprovar agenda ou gerar convite não prova envio/entrega. Entregar avisos Q38 e e-mails de acesso com estados e destinatários autorizados.

**Escopo:** evento transacional após aplicação, consolidação por destinatário/mudança, WhatsApp institucional e e-mail cadastrado; Resend Q78; convites/recuperação de F07.7; revalidação de contato/permissão, histórico de tentativas e pendência para Secretaria. Mostrar situação no ERP, sem expor telefone ao professor.

**Permissões/estados:** equipe consulta resultado no próprio escopo. Fila distingue preparada, enviada, entregue quando comprovada, falha e resultado incerto. Reprocessamento conserva chave interna durável; credenciais e dados de outros destinatários não são retornados em tela.

**Aceite:**

- [ ] Proposta rejeitada ou transação revertida não envia aviso de alteração aplicada; conjunto aprovado gera comunicação consolidada sem duplicação.
- [ ] Destinatário revogado ou contato alterado é reavaliado; token expirado não é reenviado como convite válido.
- [ ] Falha de canal não vira entrega; repetição de retorno do provedor não duplica eventos ou muda destinatário por engano.
- [ ] Homologar domínio/remetente, recebimento de convite e recuperação, limites/picos e falhas antes de habilitar envios reais.

**Dependências/limites:** fluxo WhatsApp existente, F07.3/F07.7 como produtores e configuração de Resend/DNS. Não inclui nova campanha/cadência, envio durante migração ou contratação de plano por esta especificação.

### M01 — Preparar e ensaiar migração rastreável dos dados reais

**Problema e resultado:** os cadastros atuais não carregam histórico acadêmico/financeiro completo. Preparar a carga por conjunto com correspondência de origem e conferência antes de habilitar operação.

**Escopo:** inventário já iniciado pela [planilha](analise-planilha-operacional-leticia.md); mapa origem→destino por IDs; prévia, erros/pendências por campo, preservação de origem; validação de vínculos temporais, contratos/coberturas e recebimentos; ensaio, conciliação por moeda e carga final rastreável. Implementar preparação independentemente de completar agora os dados faltantes.

**Permissões/estados:** Administração autorizada prepara/importa; responsáveis validam seu conjunto. Lote tem preparado, conferido, aplicado e pendências; leitura da planilha não é aplicação. Registros incompletos não ganham status, consentimento, pagamento ou presença presumidos.

**Aceite:**

- [ ] Reexecutar lote/linha não duplica aluno, contrato, vínculo ou pagamento; colisões de origem aparecem para revisão.
- [ ] Datas provisórias e divergências da fonte não se tornam histórico confirmado. Financeiro separa pagamento original de meses cobertos antecipadamente.
- [ ] Conciliação confere contagens, vínculos e valores por moeda; configuração/dados incompletos bloqueiam a operação dependente sem impedir examinar outros conjuntos.
- [ ] Importação/ensaio não dispara convites, cobranças recorrentes, lembretes ou devoluções. Carga final tem relatório de validação e rastreabilidade.

**Dependências/limites:** entidades das entregas importadas; integra preparação operacional F05. Complementos ficam para depois. Não autoriza apagar base existente, sobrescrever o original ou colocar registros reais em testes públicos.

### V01 — Validar as jornadas integradas e preparar entrada em operação

**Problema e resultado:** aprovação isolada de cada corpo não prova que as integrações funcionam. Produzir evidência de execução, acesso e conciliação antes da liberação real.

**Escopo:** cenários combinados abaixo; validação de API/servidor e interface; concorrência nos pontos críticos; integrações em ambiente autorizado; capacidade de mídia/avisos; parâmetros necessários, plano de carga e acompanhamento de falhas. Registrar versão do código e resultado reproduzível.

**Permissões/estados:** validar cada perfil com seu acesso previsto e casos de negação; resultado local, integração homologada e operação habilitada são estados distintos. A evidência deve identificar o ambiente e as permissões usadas, sem supor que executar tudo como administrador valida os demais papéis.

**Aceite:**

- [ ] Agenda alterada concorrentemente com publicação, substituição e particular conserva disponibilidade e aprovações; mensagem só após aplicação.
- [ ] Professor removido, aluno transferido/pausado e entrega antiga mantêm autoria, elegibilidade, restrições e acesso limitado.
- [ ] Aluno com contrato mensal e contrato por hora: pausa/encerramento seletivo preserva o excluído; operação coletiva valida todos os selecionados. D13/D14 não escolhem matrícula errada nem encerram outras alocações silenciosamente.
- [ ] Crédito usado enquanto chega pagamento ou devolução não duplica saldo; fechamento parcial, complemento e encerramento reconciliam com os recebimentos.
- [ ] Fim de mês, ano bissexto, fuso e dia não útil produzem datas/valores esperados; autoaprovação e acesso por ID não autorizado falham.
- [ ] Relatórios distinguem validado localmente, integração homologada e apto à operação; lacuna de produção não é marcada como entregue por teste com substituto de serviço.
- [ ] Jornada COM01/DCT01–DCT03 confere reserva, emissão e ativação nos quatro caminhos iniciais, nova negociação do mesmo aluno, assinatura por etapas, desistência com concorrência/resultado incerto, substituição e aditivo com vigência; incorporar MAT-17–MAT-29 e DOC-01–DOC-19.

**Dependências/limites:** acompanha cada entrega e conclui após as integrações habilitadas. Não exige dados pessoais completos para começar os cenários, mas dados/contas/configuração necessários devem estar conferidos para a operação real correspondente.

## 4. Sequência e fronteiras de entrega

| Ordem lógica | Entregas | Resultado verificável |
|---|---|---|
| 1 | B01; base inicial de F07.1 | Condições/versionamento, datas e calendário para consumidores, sem geração/avisos indevidos |
| 2 | B02; F07.2/F07.3; base de N01 | Registro financeiro compartilhado; agenda, conflito e aplicação de mudanças; fila pós-transação |
| 3 | F07.4; F07.5; P02 | Diário histórico, continuidade/acerto mensal e permuta com aprovações |
| 4 | F07.6; P01 | Benefícios/reposições e particulares contratadas usando bases comuns, sem confundir cobranças/cotas |
| 5 | F07.7; N01 integrado | Jornada autenticada do aluno, material privado e avisos homologados |
| Transversal | M01 e V01 | Preparação/ensaio dos conjuntos disponíveis e validação de cada integração; dados faltantes não bloqueiam o refinamento |

A ordem é técnica e não exige publicar um fluxo incompleto em produção. Replanejamento de calendário, portal e envios somente são habilitados quando suas dependências estiverem prontas. F07.5 consome B01/B02, P01 compartilha agenda/diário e F07.7 consome F07.6: cada componente tem um responsável pelo dado, evitando implementações concorrentes do mesmo saldo ou estado.

O complemento de Q103–Q123 acrescenta COM01 e DCT01 sobre as bases de matrícula/financeiro/agenda, DCT02 para integrar assinatura à jornada e DCT03 para formalizar/aplicar aditivos. P01 fornece o caminho por hora; M01/V01 incluem os novos registros e cenários. A [sequência complementar](corpos-entrada-comercial-contrato.md) detalha as fronteiras; não habilitar contratação parcialmente integrada em produção.

## 5. Integrações externas: referências verificadas e configuração posterior

Para os arquivos de vídeo binários, o Drive documenta leitura por `files.get` com `alt=media` e leitura parcial com `Range`. Isso sustenta a proposta de transmitir trechos autorizados pelo servidor; não comprova desempenho da instalação da escola. [Download e leitura parcial no Drive](https://developers.google.com/workspace/drive/api/guides/manage-downloads).

O acesso a arquivos do Drive compartilhado requer suporte específico, incluindo `supportsAllDrives` nas operações aplicáveis. A identidade institucional, permissões efetivas e acervo autorizado ainda precisam ser conferidos antes de operar. [Suporte a drives compartilhados](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives).

O Resend mantém sua deduplicação por chave por 24 horas. Por isso, N01 precisa manter no ERP o vínculo durável entre evento/destinatário/canal e tentativa; uma retentativa antiga não pode depender somente da janela do provedor. Essa persistência é proposta de implementação derivada do limite documentado. [Chaves de idempotência do Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).

Referências consultadas em 10/09/2026. Ainda serão necessários responsável por DNS, remetente/destino de respostas, conta de integração e permissões do Drive, configuração financeira contratual, prazos operacionais e volume para homologação. Esses itens de configuração/operação não reabrem as decisões já respondidas nem precisam ser coletados agora para revisar os corpos.

## 6. Resultado desta consolidação

Este arquivo mantém 14 corpos com problema, resultado, limites, permissões, dependências e aceite. O [complemento comercial/documental](corpos-entrada-comercial-contrato.md) acrescenta quatro, totalizando 18 propostas. Q100–Q102 definem entrada por hora, fechamento parcial e alcance seletivo/coletivo; Q103–Q123 definem a jornada comercial/documental e não têm pergunta sem resposta. Os corpos estão consolidados para revisão, sem valores/dados pessoais presumidos; isso não equivale a provar ausência de cenários novos durante revisão/implementação.

Próxima etapa do processo combinado: revisar estes corpos e, após seu fechamento, criar as issues correspondentes. Implementação, testes e habilitação real permanecem etapas posteriores. O [relatório consolidado do projeto](../41-situacao-consolidada-do-projeto.md) deve distinguir esse preparo das entregas D01–D14 já verificadas localmente.
