# Refinamento — avaliações e progressão acadêmica

**Iniciado em 10/09/2026. Estado:** Q124–Q154 respondidas: C em Q124/Q128 e A nas demais. Q151 define autorização específica após pausa/encerramento; Q152 define designação docente limitada; Q153 define equivalência aprovada; Q154 define fechamento pela gestão; revisão técnica e corpo adicional pendentes. A [SPEC acadêmica](../specs/avaliacao-por-habilidades.md) reúne regras e critérios; corpo adicional ainda em refinamento, separado dos 18 corpos anteriores.

Fontes: [situação do projeto](../41-situacao-consolidada-do-projeto.md), [mudanças acadêmicas D14](../40-mudancas-academicas-com-aprovacao.md) e [SPEC central](../specs/erp-educacional.md). A conclusão da turma não aprova automaticamente os alunos. Mudança de nível conserva solicitação, parecer docente ou dispensa justificada, aprovação independente e execução pela Secretaria conforme D14.

### Q124 — Qual alcance de avaliações e progressão deve entrar nesta primeira entrega?

**Estado: respondida — C, em 10/09/2026.**

**Resposta do usuário:** “C — Incluir avaliação por habilidades: acompanhar fala, compreensão oral, leitura e escrita, além da frequência, com critérios configuráveis e resultado consolidado; detalhar pesos, recuperação e apresentação.”

**Definição incorporada:** incluir avaliação por fala, compreensão oral, leitura e escrita, acompanhando também frequência e resultado consolidado com critérios configuráveis. Preservar o fluxo aprovado de mudança de nível: solicitação, parecer ou dispensa justificada, aprovação independente e execução pela Secretaria. Conclusão da turma ou resultado de avaliação não promove o aluno nem altera cobrança automaticamente. A forma de lançamento foi detalhada em Q125; critérios, pesos, recuperação e apresentação ainda precisam ser definidos.

**Consequências técnicas e escopo:** acrescentar módulo de avaliações vinculado à matrícula e ao contexto acadêmico correto, com autoria, regra aplicável e histórico. Não representar quatro habilidades em uma nota única sem conservar os resultados de origem. Frequência conserva a distinção entre presença original e regularização por reposição. Q124 não escolhe escala numérica, médias, pesos, mínimos, regras de recuperação ou publicação no portal; não inferi-los do nome A1/A2 ou de condição financeira. O corpo dessa ampliação será organizado após as respostas dependentes.

**Pergunta e alternativas apresentadas:**

Já definimos conclusão das aulas/turmas e mudança de nível com aprovação. Falta delimitar se o ERP também calculará resultados de avaliações para apoiar a passagem de A1 para A2, por exemplo. A conclusão da turma não significa aprovação automática do aluno. Nas três opções, preservar o fluxo de aprovação/execução da mudança de nível e não alterar matrícula/cobrança automaticamente pelo resultado acadêmico.

- **A — Usar o fluxo pedagógico já definido, sem novo módulo de avaliações agora (recomendado):** professor apresenta parecer e gestão decide a mudança pelo fluxo aprovado; notas, fórmulas e boletins ficam para uma entrega posterior.
- **B — Incluir avaliação final e frequência:** registrar resultado final e frequência, com critérios configuráveis para apoiar a decisão pedagógica; detalhar escala, mínimos e recuperação antes de implementar.
- **C — Incluir avaliação por habilidades:** acompanhar fala, compreensão oral, leitura e escrita, além da frequência, com critérios configuráveis e resultado consolidado; detalhar pesos, recuperação e apresentação dos resultados. Amplia mais o escopo.

A alternativa C foi escolhida e amplia o recorte. Nenhuma opção presume notas mínimas, percentuais, pesos ou aprovação automática por condição financeira. Parâmetros acadêmicos dependem de decisão pedagógica, sem usar condições financeiras como nota.

### Q125 — Como registrar o resultado de cada habilidade?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Nota numérica e comentário pedagógico (recomendado): registrar nota por habilidade, em escala configurável, e permitir comentário; critérios de cálculo e aprovação serão definidos depois.”

**Definição incorporada:** registrar nota numérica por habilidade, em escala configurável, com comentário pedagógico opcional. Não acrescentar rubricas/conceitos como campo exigido ou como conversão automática da nota. Q125 não define a escala concreta, pesos, mínimos ou fórmula do resultado consolidado.

**Consequências técnicas:** nota deve identificar habilidade, avaliação, matrícula, autor e escala aplicável; validar limites configurados no servidor. Ausência de lançamento não é nota zero. Comentário não muda o valor nem substitui a nota exigida; acesso ao comentário segue o registro acadêmico autorizado. Preservar regra e valor de origem em vez de reinterpretar notas históricas pela escala vigente. Regras de correção/publicação ainda serão detalhadas.

**Pergunta e alternativas apresentadas:**

Q124 inclui fala, compreensão oral, leitura e escrita. Precisamos definir o que o responsável registra em cada habilidade antes de escolher como consolidar os resultados. Uma rubrica é uma descrição dos níveis de desempenho esperados, por exemplo o que caracteriza um desempenho inicial ou consolidado; esses descritores serão definidos pela escola.

- **A — Nota numérica e comentário pedagógico (recomendado):** registrar nota por habilidade, em escala configurável, e permitir comentário; critérios de cálculo e aprovação serão definidos depois.
- **B — Rubrica com conceitos de desempenho:** registrar um conceito/nível por habilidade com descritores configurados, sem nota numérica; definir depois como os conceitos compõem o resultado final.
- **C — Nota numérica e rubrica:** registrar nota e conceito baseado em descritores por habilidade; detalhar a relação entre ambos para evitar resultados contraditórios.

Não presumir escala, quantidade de conceitos, nota mínima, conversão entre conceito/nota ou resultado de aprovação. A apresentação ao aluno e a recuperação permanecem para perguntas posteriores.

### Q126 — Em quais momentos o aluno deve ser avaliado durante um nível?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Avaliações intermediárias e avaliação final (recomendado): registrar avaliações ao longo do nível e uma etapa final; detalhar depois quantidade, habilidades avaliadas e participação de cada etapa no resultado.”

**Definição incorporada:** registrar avaliações intermediárias ao longo do nível e uma etapa final. Identificar cada avaliação e seu papel no percurso; quantidade, datas, habilidades abrangidas e participação no resultado ainda serão detalhadas. Frequência continua separada. Não concluir resultado pela ausência de lançamentos nem promover o aluno automaticamente.

**Consequências técnicas:** avaliações precisam identificar contexto de nível, matrícula e etapa intermediária/final, preservando notas de origem. Não substituir silenciosamente as notas intermediárias por uma única final. Uma etapa final não exige por inferência que todas as habilidades sejam avaliadas no mesmo encontro ou instrumento; Q127 tratará a cobertura de habilidades. Quantidade de aulas da turma não cria notas ou avaliações realizadas automaticamente.

**Pergunta e alternativas apresentadas:**

Q125 definiu notas por habilidade. Agora precisamos decidir quais avaliações formarão o histórico e o resultado do nível: apenas uma avaliação final ou também avaliações ao longo do percurso. Quantidade, datas, pesos e mínimos não serão presumidos; a frequência continua registrada separadamente. Esta pergunta define a estrutura das avaliações, sem aprovar automaticamente o aluno nem executar a mudança de nível.

- **A — Avaliações intermediárias e avaliação final (recomendado):** registrar avaliações ao longo do nível e uma etapa final; detalhar depois quantidade, habilidades avaliadas e participação de cada etapa no resultado.
- **B — Somente avaliação final por habilidades:** registrar uma avaliação final do nível com as habilidades exigidas; acompanhamento anterior permanece nos registros pedagógicos, sem compor notas intermediárias neste módulo.
- **C — Avaliação contínua, sem final obrigatória:** registrar avaliações distribuídas durante o nível e consolidar seus resultados; nenhuma avaliação final separada é exigida por padrão.

### Q127 — Quais habilidades precisam ser avaliadas em cada etapa?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Intermediárias selecionam habilidades; final cobre as quatro (recomendado): cada avaliação intermediária identifica quais habilidades mede; a etapa final exige fala, compreensão oral, leitura e escrita.”

**Definição incorporada:** cada avaliação intermediária identifica as habilidades que mede; não é obrigatório que cada uma cubra as quatro. A etapa final precisa cobrir fala, compreensão oral, leitura e escrita, podendo distribuir essa cobertura em mais de um instrumento ou momento. Habilidade não abrangida por uma avaliação não recebe zero. Pesos e composição ainda serão definidos.

**Consequências técnicas:** guardar o conjunto de habilidades previsto em cada avaliação e distinguir não aplicável de nota exigida ainda não lançada. Conferir cobertura das quatro habilidades no conjunto da etapa final, sem obrigar todas em cada instrumento. Não calcular média incluindo zeros fictícios para habilidades fora do escopo. Cobertura prevista não comprova que o aluno foi avaliado ou que existem notas lançadas.

**Pergunta e alternativas apresentadas:**

Q126 inclui avaliações intermediárias e uma etapa final. Podemos ter, por exemplo, uma atividade intermediária apenas de fala, enquanto outras medem leitura ou escrita. Precisamos definir a cobertura exigida, mantendo as quatro habilidades no acompanhamento do nível.

Uma habilidade que não faz parte de determinada avaliação não recebe nota zero por isso. A etapa final pode ter mais de um instrumento ou momento; esta pergunta não obriga concentrar tudo em uma única prova. Pesos e forma de consolidação ainda serão definidos.

- **A — Intermediárias selecionam habilidades; final cobre as quatro (recomendado):** cada avaliação intermediária identifica quais habilidades mede; a etapa final exige fala, compreensão oral, leitura e escrita.
- **B — Todas as avaliações cobrem as quatro:** cada avaliação intermediária e a etapa final exigem resultados nas quatro habilidades.
- **C — Habilidades selecionadas em ambas as etapas:** intermediárias e final podem avaliar partes diferentes; o conjunto do nível precisa cobrir as quatro, sem exigir todas novamente na etapa final.

### Q128 — Como combinar as notas intermediárias e finais de cada habilidade?

**Estado: respondida — C, em 10/09/2026.**

**Resposta do usuário:** “C — Peso individual por avaliação: cada avaliação tem peso configurado; combinar diretamente as notas da habilidade, sem calcular primeiro uma média intermediária e outra final.”

**Definição incorporada:** cada avaliação possui peso configurado. Calcular o resultado de cada habilidade diretamente a partir das notas dessa habilidade e dos pesos das avaliações correspondentes, sem calcular primeiro médias intermediária/final. Etapas continuam identificadas no histórico e a final cobre as quatro habilidades conforme Q127. Não fixar percentuais ou mínimos; resultado geral e frequência ainda serão detalhados.

**Consequências técnicas:** para a habilidade h, a média ponderada usa soma(nota de h × peso da avaliação) dividida pela soma dos pesos das avaliações que avaliam h. Identificar conjunto, notas, pesos e regra de origem; configuração insuficiente, escala incompatível ou denominador inválido impedem resultado completo. Habilidade fora do escopo não entra com zero; nota exigida ausente não autoriza redistribuir pesos como se a avaliação não existisse. Registrar pendência e distinguir cálculo parcial de resultado completo, sem presumir regras de falta/recuperação. Repetição de lançamento não acrescenta o mesmo peso duas vezes.

**Pergunta e alternativas apresentadas:**

Agora precisamos definir como várias notas de fala, por exemplo, formam o resultado de fala do nível. Q127 permite avaliações intermediárias que medem habilidades diferentes; usar apenas as notas correspondentes à habilidade em cálculo. O resultado geral entre habilidades e a frequência serão tratados separadamente.

Nenhuma opção fixa percentuais ou nota mínima. Mostrar quais notas e regras produziram o resultado; nota exigida ainda não lançada não vira zero nem é confundida com habilidade fora do escopo da avaliação.

- **A — Média por etapa, com pesos entre etapas (recomendado):** calcular a média simples das notas da habilidade nas intermediárias e a média simples na etapa final; combinar as duas médias com pesos configuráveis para intermediárias/final.
- **B — Etapa final determina o resultado da habilidade:** usar a média simples das notas da habilidade na etapa final; intermediárias permanecem como acompanhamento, sem peso nesse resultado.
- **C — Peso individual por avaliação:** cada avaliação tem peso configurado; combinar diretamente as notas da habilidade, sem calcular primeiro uma média intermediária e outra final.

### Q129 — Como consolidar as quatro habilidades no resultado geral do nível?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Média geral com pesos configuráveis por habilidade (recomendado): cada habilidade tem peso próprio na média geral, preservando também os quatro resultados individuais.”

**Definição incorporada:** calcular média geral ponderada dos resultados de fala, compreensão oral, leitura e escrita, com peso configurável por habilidade. Manter os quatro resultados individuais e a frequência visíveis separadamente. Mínimos, recuperação e decisão pedagógica ainda dependem de regras próprias; a média geral não promove o aluno automaticamente.

**Consequências técnicas:** são dois níveis de composição distintos: Q128 aplica pesos por avaliação ao resultado de cada habilidade; Q129 aplica pesos por habilidade à média geral. Usar soma(resultado da habilidade × peso da habilidade) / soma(pesos das habilidades), com memória de origem e configuração válida. Não inserir frequência como nota ou reutilizar automaticamente o peso de uma avaliação como peso da habilidade. Resultado ausente não vira zero e não autoriza redistribuição silenciosa dos pesos. Pesos e escala concretos não foram presumidos.

**Pergunta e alternativas apresentadas:**

Q128 define o resultado de cada habilidade pelos pesos individuais das avaliações. Agora tratamos de uma etapa diferente: combinar os resultados de fala, compreensão oral, leitura e escrita ou apresentá-los sem nota geral única.

Em todas as opções, mostrar as quatro habilidades e a frequência separadamente. Critérios mínimos, recuperação e decisão de progressão serão definidos depois; uma média geral não autoriza ignorar dificuldade em uma habilidade. Nenhum percentual ou nota mínima será presumido.

- **A — Média geral com pesos configuráveis por habilidade (recomendado):** cada habilidade tem peso próprio na média geral, preservando também os quatro resultados individuais.
- **B — Média geral com pesos iguais:** calcular a média simples dos quatro resultados; todas as habilidades contribuem igualmente.
- **C — Quadro por habilidade, sem nota geral única:** apresentar os quatro resultados e a frequência; a decisão pedagógica usa critérios por habilidade, sem calcular uma média geral.

### Q130 — Quais requisitos de nota devem ser cumpridos para a progressão?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Mínimo geral e mínimo por habilidade (recomendado): exigir média geral suficiente e o mínimo configurado em cada uma das quatro habilidades; nota alta em outra habilidade não dispensa um mínimo individual.”

**Definição incorporada:** o critério de notas exige, conjuntamente, média geral igual ou superior ao mínimo configurado e resultado igual ou superior ao mínimo de cada uma das quatro habilidades. Resultado alto em outra habilidade não compensa o descumprimento de mínimo individual. Valores são configuráveis; frequência, recuperação e exceções ainda serão detalhadas. Cumprir as notas não executa mudança de nível, preservando D14.

**Consequências técnicas:** manter os cinco requisitos identificados na regra aplicável e mostrar quais foram cumpridos/insuficientes. Nota ou configuração ausente é pendência, não aprovação por ausência de limite. Usar resultados e regra de origem de Q128/Q129; não modificar peso para contornar um mínimo. Separar cumprimento dos requisitos, decisão pedagógica e execução da mudança. Não criar dispensa automática de mínimo pela autoridade do usuário.

**Pergunta e alternativas apresentadas:**

Já teremos resultados por habilidade e média geral ponderada. Falta definir se uma média geral suficiente pode compensar uma nota baixa em uma habilidade ou se haverá mínimos separados.

Os valores mínimos serão configuráveis, sem fixar números agora. A frequência será tratada separadamente. Cumprir os requisitos de nota não executa a mudança de nível: continuam parecer ou dispensa justificada, aprovação independente e execução pela Secretaria. Recuperação e exceções serão detalhadas depois.

- **A — Mínimo geral e mínimo por habilidade (recomendado):** exigir média geral suficiente e o mínimo configurado em cada uma das quatro habilidades; nota alta em outra habilidade não dispensa um mínimo individual.
- **B — Mínimo por habilidade:** exigir os mínimos das quatro habilidades; média geral permanece informativa, sem um corte adicional próprio.
- **C — Somente mínimo geral:** exigir o mínimo da média geral, permitindo compensação entre habilidades; resultados individuais continuam visíveis para o parecer pedagógico.

### Q131 — Como a frequência deve participar da progressão?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Mínimo configurável com exceção pedagógica específica (recomendado): abaixo do mínimo, exigir regularização ou aprovação explícita de outra pessoa da Gerência Pedagógica/Administração, com motivo e evidências. Preservar a frequência real.”

**Definição incorporada:** frequência mínima configurável é requisito independente das notas. Abaixo do mínimo, exigir regularização pelas regras aplicáveis ou exceção específica aprovada por outra pessoa da Gerência Pedagógica/Administração, com motivo e evidências. Preservar a frequência real e o histórico de faltas/reposições/impedimentos. A exceção não dispensa mínimos de nota e não está implícita na aprovação habitual da mudança de nível.

**Consequências técnicas:** identificar frequência apurada, regra/mínimo aplicável, matrícula/contexto de nível e, se houver, proposta e decisão de exceção com autores distintos. Revalidar permissão, versão e independência no servidor; acúmulo de papéis não permite autoaprovação. Não substituir percentual real por mínimo ou por presença fictícia. Reposição regulariza a aula original sem duplicidade; impedimento por restrição conserva a regra Q59. Distinguir frequência cumprida, insuficiente, pendente de conferência e exceção válida, mantendo o critério de notas separado.

**Pergunta e alternativas apresentadas:**

Q130 exige mínimo geral e por habilidade. Agora precisamos decidir se também existe uma frequência mínima e como tratar um aluno abaixo dela. Não fixaremos percentual agora.

Preservar as regras de frequência já aprovadas: reposição concluída pode regularizar a aula original sem apagar a falta nem contar duas vezes; impedimento por restrição permanece identificado conforme Q59. Cumprir notas/frequência não executa automaticamente a mudança de nível.

- **A — Mínimo configurável com exceção pedagógica específica (recomendado):** abaixo do mínimo, exigir regularização ou aprovação explícita de outra pessoa da Gerência Pedagógica/Administração, com motivo e evidências. Preservar a frequência real.
- **B — Mínimo obrigatório sem exceção neste fluxo:** abaixo do mínimo, exigir regularização da frequência conforme as reposições permitidas antes de aprovar a progressão.
- **C — Frequência informativa:** apresentar presença/faltas/reposições para o parecer, mas não criar percentual mínimo como requisito de progressão.

A exceção da alternativa A trata somente de frequência; não dispensa os mínimos de nota de Q130. A aprovação habitual da mudança não implica essa exceção sem decisão específica registrada.

### Q132 — Quais habilidades devem entrar na recuperação de notas?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Recuperação direcionada às habilidades necessárias (recomendado): reavaliar as habilidades abaixo do mínimo; se faltar apenas atingir a média geral, o plano de recuperação identifica quais habilidades serão trabalhadas e reavaliadas.”

**Definição incorporada:** recuperação direcionada às habilidades abaixo do mínimo. Quando todos os mínimos individuais forem cumpridos, mas faltar o mínimo geral, o plano identifica quais habilidades trabalhar/reavaliar para esse objetivo. Preservar notas e tentativas anteriores. Recuperação de notas não regulariza frequência, não consome cota de particulares nem autoriza cobrança adicional automaticamente. A incorporação da nota será definida em Q133.

**Consequências técnicas:** plano identifica matrícula, contexto de nível, resultados/requisitos de origem e habilidades abrangidas, inclusive o motivo de recuperação para média geral. Não exigir nova avaliação das quatro quando apenas parte precisa de recuperação. Guardar tentativa e notas vinculadas às habilidades previstas; não sobrescrever avaliações regulares nem reutilizar reposição de falta como se fosse resultado de recuperação acadêmica.

**Pergunta e alternativas apresentadas:**

Q130 exige mínimo geral e mínimo em cada habilidade. Se o aluno não atingir esses critérios, precisamos definir o alcance da recuperação. Pode haver uma habilidade insuficiente ou todas acima dos mínimos individuais, mas média geral ainda abaixo do mínimo geral.

Preservar as notas e tentativas anteriores; a forma de incorporar a nova nota ao resultado será definida em seguida. Recuperação de nota não é reposição de falta e não regulariza frequência nem consome cota de particulares automaticamente. Esta decisão não autoriza cobrança adicional.

- **A — Recuperação direcionada às habilidades necessárias (recomendado):** reavaliar as habilidades abaixo do mínimo; se faltar apenas atingir a média geral, o plano de recuperação identifica quais habilidades serão trabalhadas e reavaliadas.
- **B — Recuperar sempre as quatro habilidades:** realizar nova avaliação das quatro, mesmo quando apenas uma habilidade ou a média geral estiver insuficiente.
- **C — Alcance configurável por nível:** a regra aplicável define recuperação direcionada ou das quatro habilidades; registrar qual política vale para o aluno, sem escolher silenciosamente a cada cálculo.

### Q133 — Como a nota da recuperação deve alterar o resultado da habilidade?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Conservar o melhor resultado (recomendado): usar o maior entre o resultado vigente da habilidade e a nota da recuperação; uma tentativa pior permanece no histórico sem reduzir o resultado vigente.”

**Definição incorporada:** resultado da habilidade após recuperação válida é o maior entre o resultado vigente e a nota dessa recuperação. Tentativa menor ou igual permanece registrada sem reduzir o resultado. Preservar avaliações regulares e tentativas; aplicar somente às habilidades do plano, recalcular média geral de Q129 e conferir mínimos de Q130. Frequência e aprovação/execução da mudança continuam separadas; tentativas e prazos ainda serão definidos.

**Consequências técnicas:** conservar resultado antes/depois e origem da tentativa, sem sobrescrever as notas regulares ou incluir a recuperação outra vez como avaliação ponderada de Q128. Aplicar uma única vez a tentativa válida; uma nota menor posterior não desfaz melhora válida anterior. Escala, contexto e autoria precisam ser consistentes. Esta regra trata de novas tentativas válidas, não substitui o futuro fluxo de correção de nota errada ou invalidação de evidência.

**Pergunta e alternativas apresentadas:**

Q132 definiu recuperação direcionada. Agora precisamos decidir o efeito da nova nota sobre o resultado da habilidade que o aluno já possui. Preservar avaliações originais, tentativas e a regra aplicada; alterar o resultado exibido não apaga a nota anterior.

Depois de aplicar a regra, recalcular a média geral pelos pesos de Q129 e conferir os mínimos de Q130. A recuperação não entra duas vezes no cálculo nem muda notas de habilidades fora do plano. Frequência e aprovação da mudança de nível continuam separadas. Quantidade de tentativas e prazos serão tratados depois.

- **A — Conservar o melhor resultado (recomendado):** usar o maior entre o resultado vigente da habilidade e a nota da recuperação; uma tentativa pior permanece no histórico sem reduzir o resultado vigente.
- **B — Combinar resultado vigente e recuperação:** calcular média ponderada entre os dois, com pesos configuráveis; a nova nota pode aumentar ou reduzir o resultado.
- **C — Usar a nota da recuperação:** substituir o resultado vigente pela nova nota, mesmo quando menor; manter o anterior e a tentativa no histórico.

### Q134 — Como limitar as tentativas de recuperação?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Limite configurável por habilidade no nível (recomendado): cada habilidade tem seu controle de tentativas naquele nível da matrícula; recuperar fala não esgota o limite de escrita.”

**Definição incorporada:** limite de tentativas configurável por habilidade, no contexto do nível da matrícula. Tentativa de uma habilidade não consome o limite de outra que não participou; outro contrato do aluno não compartilha o controle. Quantidade, prazo, autorização e eventos de consumo por realização/falta/cancelamento ainda não foram definidos. Não usar a cota de reposições particulares como esse limite.

**Consequências técnicas:** identificar matrícula, contexto de nível, habilidade, regra e tentativas vinculadas ao plano. Plano com várias habilidades precisa conferir cada limite correspondente; não usar contador global do aluno nem multiplicar o consumo por repetição técnica do mesmo registro. Alterar configuração ou editar plano não reinicia tentativas já registradas por inferência. O evento que reserva/consome/devolve tentativa será detalhado antes da implementação dependente.

**Pergunta e alternativas apresentadas:**

A recuperação pode abranger apenas algumas habilidades. Precisamos decidir se tentar recuperar fala usa um limite próprio de fala ou um limite único de recuperação do nível. O controle pertence à matrícula correspondente; outro contrato do mesmo aluno não compartilha tentativas automaticamente.

Nenhuma quantidade será presumida. Prazos, autorização e o tratamento de falta/cancelamento serão detalhados separadamente. Não confundir esse limite com a cota de reposições particulares.

- **A — Limite configurável por habilidade no nível (recomendado):** cada habilidade tem seu controle de tentativas naquele nível da matrícula; recuperar fala não esgota o limite de escrita.
- **B — Limite configurável único por nível:** cada tentativa de recuperação usa o limite do nível da matrícula, independentemente de avaliar uma ou várias habilidades.
- **C — Sem limite numérico de tentativas:** permitir novas tentativas dentro das condições e prazos autorizados, mantendo todo o histórico; prazo e autorização ainda serão definidos.

### Q135 — Quem prepara e autoriza o plano de recuperação?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Professor propõe; gestão aprova (recomendado): professor responsável prepara; outra pessoa da Gerência Pedagógica/Administração confere e autoriza. Gestão também pode preparar quando necessário, mantendo outro aprovador.”

**Definição incorporada:** professor responsável prepara o plano; outra pessoa da Gerência Pedagógica/Administração confere e autoriza, incluindo limites por habilidade de Q134. Gestão também pode preparar quando necessário, com aprovador distinto. Aprovação do plano não aprova progressão nem dispensa notas/frequência. Prazos e procedimentos de avaliação ainda serão detalhados.

**Consequências técnicas:** proposta identifica matrícula, nível, habilidades, avaliações, regra/limites, autor e versão. Aprovação registra pessoa autorizada distinta; revalidar vínculo do professor, permissões, contexto e limites no servidor. Mudança relevante na proposta exige nova conferência/aprovação; não liberar execução por simples criação de rascunho. Guardar autoria quando gestão preparar, sem atribuí-la ao professor. Consumo/reserva de tentativa depende da regra específica ainda a definir, não da existência isolada da aprovação.

**Pergunta e alternativas apresentadas:**

O plano identifica o aluno/matrícula, o nível, as habilidades a recuperar e as avaliações propostas. Precisamos definir quem transforma o resultado insuficiente nesse plano e quem libera sua execução, conferindo os limites de Q134.

Autorizar recuperação não é aprovar mudança de nível nem dispensar mínimos de nota/frequência. Preservar autoria e regras aplicáveis. Nas opções com aprovação independente, a pessoa que preparou não pode aprovar, mesmo acumulando papéis. Prazos e procedimentos de avaliação serão detalhados depois.

- **A — Professor propõe; gestão aprova (recomendado):** professor responsável prepara; outra pessoa da Gerência Pedagógica/Administração confere e autoriza. Gestão também pode preparar quando necessário, mantendo outro aprovador.
- **B — Gestão prepara e outra pessoa da gestão aprova:** Gerência Pedagógica/Administração monta o plano com parecer do professor; outra pessoa autorizada confere e libera.
- **C — Professor libera dentro das regras configuradas:** professor responsável prepara e libera plano que cumpra os critérios e limites, sem aprovação individual da gestão; não recebe permissão para dispensar regras ou aprovar progressão.

### Q136 — Como definir o prazo para realizar a recuperação?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Prazo configurável a partir da disponibilização do plano (recomendado): contar quando o plano aprovado for disponibilizado ao aluno com as condições necessárias para realizá-lo; guardar início e data-limite.”

**Definição incorporada:** prazo configurável começa quando o plano aprovado é disponibilizado ao aluno com as condições necessárias para execução. Guardar início e data-limite e informar o prazo ao aluno. Se a escola não oferecer essas condições, registrar pendência e revisar o prazo, sem presumir falta/zero. Prorrogação exige motivo e aprovação de outra pessoa da Gerência Pedagógica/Administração. Vencimento sozinho não cria nota, aprovação ou consumo de tentativa.

**Consequências técnicas:** separar aprovação interna, disponibilização efetiva e contagem. Registrar regra, marco inicial, limite e histórico de prorrogações com autores distintos; não iniciar prazo em rascunho ou pela aprovação isolada sem condições de realização. Não reiniciar prazo por reabrir tela ou repetir envio. Indisponibilidade exige registro/revisão, sem copiar por inferência a regra de pausa automática de prazo de outro fluxo. Falta/cancelamento terão regra própria em Q137.

**Pergunta e alternativas apresentadas:**

Q135 exige plano aprovado. Falta definir como estabelecer a data-limite para o aluno realizar as avaliações previstas. Não fixaremos quantidade de dias agora.

O prazo precisa ser informado ao aluno. Se a escola não oferecer as condições necessárias, registrar a pendência e revisar o prazo; não presumir falta ou nota zero. Prorrogação exige motivo e aprovação de outra pessoa da Gerência Pedagógica/Administração. O vencimento sozinho não cria nota, aprovação ou consumo de tentativa; falta/cancelamento terá regra própria.

- **A — Prazo configurável a partir da disponibilização do plano (recomendado):** contar quando o plano aprovado for disponibilizado ao aluno com as condições necessárias para realizá-lo; guardar início e data-limite.
- **B — Data-limite comum por turma/nível:** definir uma data de recuperação para aquele grupo; planos identificam essa data, e impedimentos exigem revisão/prorrogação justificada.
- **C — Prazo individual aprovado em cada plano:** professor/gestão propõe a data-limite conforme o caso; outra pessoa autorizada aprova junto do plano, sem duração padrão obrigatória.

### Q137 — Quando uma tentativa de recuperação consome o limite da habilidade?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Regra com antecedência configurável (recomendado): cancelamento do aluno dentro do prazo libera a reserva; cancelamento tardio ou falta consome a tentativa das habilidades abrangidas.”

**Definição incorporada:** reservar disponibilidade por habilidade ao liberar tentativa autorizada. Realização consome mesmo sem melhorar nota; cancelamento tempestivo do aluno ou pela escola libera; cancelamento tardio ou falta consome. Antecedência configurável, sem número presumido. Não criar zero, presença ou aprovação; vencimento isolado não consome.

**Consequências técnicas:** conferir saldo por matrícula, nível e habilidade antes de reservar, impedindo duplicação em solicitações simultâneas ou repetidas. Preservar ocorrência, regra de antecedência aplicada e transições, sem usar a cota de particulares.

**Pergunta e alternativas apresentadas:**

Q134 definiu limite por habilidade. Ao liberar uma tentativa autorizada, proponho reservar a disponibilidade das habilidades abrangidas, evitando liberar mais tentativas simultâneas que o limite. Reservar não é consumir definitivamente.

Nas três opções, avaliação efetivamente realizada consome tentativa, mesmo sem melhorar a nota. Cancelamento pela escola libera a reserva sem consumo. Falta/cancelamento não cria nota zero, presença ou aprovação; preservar ocorrência e histórico. Nenhum prazo numérico será presumido, e o simples vencimento do plano continua seguindo Q136.

- **A — Regra com antecedência configurável (recomendado):** cancelamento do aluno dentro do prazo libera a reserva; cancelamento tardio ou falta consome a tentativa das habilidades abrangidas.
- **B — Somente realização consome:** falta ou cancelamento do aluno libera a reserva sem consumo; uma nova tentativa ainda precisa cumprir prazo, plano e autorização aplicáveis.
- **C — Gestão decide faltas e cancelamentos:** manter a reserva pendente até decisão independente da Gerência Pedagógica/Administração, com motivo, sobre consumir ou liberar; realização consome normalmente.

### Q138 — A gestão poderá autorizar progressão com notas abaixo dos mínimos?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Não permitir exceção de nota (recomendado): exigir os mínimos geral e por habilidade para progredir; resultado insuficiente permanece pendente de solução pedagógica, sem mudança automática de nível.”

**Definição incorporada:** mínimos geral e por habilidade obrigatórios, inclusive após recuperação. Não há exceção de nota pela gestão; preservar notas reais e histórico. Dispensa de frequência continua separada. Não conceder tentativas extras ou alterar cobranças por essa decisão.

**Consequências técnicas:** bloquear a progressão com requisito de nota insuficiente também nas operações do servidor e para Administração. Aprovação habitual ou exceção de frequência não contorna mínimos; insuficiência fica pendente de solução pedagógica, sem fabricar resultado.

**Pergunta e alternativas apresentadas:**

Q130 exige mínimo geral e por habilidade; Q131 permite uma exceção específica de frequência, que não dispensa notas. Agora precisamos decidir se haverá também uma exceção de nota, por exemplo quando o aluno continuar abaixo do mínimo após a recuperação.

Em qualquer opção, preservar as notas reais e o histórico. Uma autorização não aumenta notas nem cria avaliações ausentes. A mudança de nível continua com parecer ou dispensa justificada, aprovação independente e execução pela Secretaria. Esta decisão não concede tentativas extras de recuperação nem altera cobranças.

- **A — Não permitir exceção de nota (recomendado):** exigir os mínimos geral e por habilidade para progredir; resultado insuficiente permanece pendente de solução pedagógica, sem mudança automática de nível.
- **B — Permitir somente após esgotar a recuperação:** outra pessoa da Gerência Pedagógica/Administração pode aprovar exceção específica, com parecer, evidências e motivo, quando as tentativas aplicáveis estiverem esgotadas.
- **C — Permitir exceção antes ou depois da recuperação:** outra pessoa da Gerência Pedagógica/Administração pode autorizar com parecer, evidências e motivo, sem exigir esgotar as tentativas.

### Q139 — As avaliações acontecerão dentro do ERP ou o sistema registrará seus resultados?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Registrar avaliações realizadas fora do ERP (recomendado): professor cadastra avaliação, notas por habilidade e comentário; aplicação acontece na aula ou em ferramenta externa, sem entrega de prova pelo portal nesta versão.”

**Definição incorporada:** ERP registra avaliações intermediárias, finais e de recuperação, notas por habilidade e comentários; aplicação ocorre fora do módulo, na aula ou em ferramenta externa. Não incluir provas/entregas de avaliação no portal nem correção por IA. O fluxo aprovado de resumo/atividade das reposições por gravação permanece.

**Consequências técnicas:** delimitar este módulo ao cadastro e apuração de resultados com atribuição docente e matrícula corretas. Não criar dependência de banco de questões ou submissão de provas para essa entrega; comentário permanece opcional conforme Q125.

**Pergunta e alternativas apresentadas:**

Já definimos notas, habilidades, pesos e recuperação. Falta delimitar onde o aluno realiza as avaliações intermediárias, finais e de recuperação. Isso é diferente do envio de resumo/atividade das reposições por gravação, que já foi aprovado.

Em todas as opções, manter as regras de atribuição docente, matrícula, notas e aprovação. Uma entrega não gera nota automaticamente. Esta escolha não inclui correção por inteligência artificial.

- **A — Registrar avaliações realizadas fora do ERP (recomendado):** professor cadastra avaliação, notas por habilidade e comentário; aplicação acontece na aula ou em ferramenta externa, sem entrega de prova pelo portal nesta versão.
- **B — Receber atividades pelo portal:** além das notas, aluno envia texto e arquivos nas avaliações configuradas; professor avalia manualmente. Exige detalhar formatos, prazos, correções e acesso.
- **C — Oferecer provas e entregas no ERP:** incluir questões respondidas no sistema e envio de atividades, com correção conforme o tipo de questão. Amplia o módulo e exige detalhar banco de questões, tentativas e aplicação.

### Q140 — Quem prepara e publica as regras de avaliação de cada nível?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Gestão Pedagógica prepara; outra pessoa da Gestão Pedagógica/Administração aprova e publica (recomendado): professores contribuem com sugestões, e a gestão organiza a proposta institucional.”

**Definição incorporada:** Gestão Pedagógica prepara regras institucionais; outra pessoa da Gestão Pedagógica/Administração aprova e publica. Professores contribuem com sugestões. Registrar versão, autoria e condições de aplicação, preservando resultados existentes. Acúmulo de papéis não permite autoaprovação.

**Consequências técnicas:** distinguir sugestão, proposta e versão publicada, verificar permissões e autoria na publicação. A aplicação de nova versão a turmas existentes depende de Q141; publicação não autoriza recalcular silenciosamente notas anteriores.

**Pergunta e alternativas apresentadas:**

Essas regras incluem escala, avaliações exigidas, habilidades, pesos, mínimos de nota/frequência e parâmetros de recuperação. Os valores continuam configuráveis; precisamos definir quem pode colocá-los em uso.

Em todas as opções, registrar versão, autoria e condições de aplicação. Uma edição não altera silenciosamente notas ou resultados existentes; a aplicação de novas versões a turmas em andamento será tratada separadamente. Quem prepara não pode aprovar a própria proposta, mesmo acumulando papéis.

- **A — Gestão Pedagógica prepara; outra pessoa da Gestão Pedagógica/Administração aprova e publica (recomendado):** professores contribuem com sugestões, e a gestão organiza a proposta institucional.
- **B — Professor ou Gestão Pedagógica prepara; outra pessoa da Gestão Pedagógica/Administração aprova e publica:** professores também podem submeter diretamente propostas de regras.
- **C — Gestão Pedagógica/Administração prepara; outra pessoa da Administração aprova e publica:** toda publicação exige aprovação administrativa.

### Q141 — Quando uma nova versão das regras de avaliação passa a valer para turmas já cadastradas?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Preservar turmas em andamento (recomendado): aplicar a nova versão a novas turmas; turmas ainda não iniciadas podem migrar após revisão de impactos e aprovação independente. As que começaram mantêm sua versão até concluir o nível.”

**Definição incorporada:** nova versão vale para novas turmas. Turmas não iniciadas podem migrar com revisão de impactos e aprovação independente; as em andamento mantêm sua versão até concluir o nível. Preservar notas, regras e resultados; publicação não recalcula silenciosamente turmas.

**Consequências técnicas:** vincular versão aplicável ao contexto acadêmico, conferir início real conforme Q48 antes de migrar e registrar proposta/impactos/aprovador. Não usar diário atrasado para tratar turma iniciada como futura. Mudanças de quantidade de aulas/cronograma seguem suas regras próprias.

**Pergunta e alternativas apresentadas:**

Exemplo: a escola altera pesos, mínimos ou avaliações exigidas de um nível. Q140 já exige publicação independente; falta definir se essa versão pode alcançar uma turma que já começou.

Em todas as opções, mostrar a versão aplicável e preservar notas, regras e resultados anteriores. Publicar uma regra não recalcula turmas silenciosamente. A regra de quantidade de aulas e atualização de cronogramas continua separada. Nenhuma opção permite dispensar mínimos de nota em um caso individual.

- **A — Preservar turmas em andamento (recomendado):** aplicar a nova versão a novas turmas; turmas ainda não iniciadas podem migrar após revisão de impactos e aprovação independente. As que começaram mantêm sua versão até concluir o nível.
- **B — Permitir mudança em andamento por exceção:** gestão propõe com motivo, impacto e tratamento dos registros; outra pessoa autorizada aprova antes de aplicar e comunicar. Turmas concluídas permanecem preservadas.
- **C — Usar a nova versão somente em novas turmas:** todas as turmas já cadastradas, inclusive as ainda não iniciadas, mantêm a versão vinculada até concluir o nível.

### Q142 — Quem confere e oficializa as notas registradas pelo professor?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Professor submete; gestão confere e oficializa (recomendado): outra pessoa da Gerência Pedagógica/Administração revisa cada avaliação e libera suas notas para o resultado oficial.”

**Definição incorporada:** professor responsável registra e submete as notas sob sua atribuição; outra pessoa da Gerência Pedagógica/Administração confere cada avaliação antes de oficializar. Preservar autoria e histórico; notas ausentes não viram zero. Oficialização não aprova automaticamente mudança de nível. Divulgação será definida separadamente.

**Consequências técnicas:** separar rascunho, submissão e oficialização, vinculando conferência à versão das notas. Impedir autoaprovação mesmo com acúmulo de papéis e não tratar registros provisórios como resultado oficial.

**Pergunta e alternativas apresentadas:**

Q139 definiu avaliações realizadas fora do ERP. Precisamos separar o lançamento em rascunho do resultado oficial usado no acompanhamento e na análise de progressão.

Nas três opções, o professor responsável registra as notas das avaliações sob sua atribuição, com autoria e histórico. Notas ausentes não viram zero. Oficializar notas não aprova automaticamente a mudança de nível; o fluxo de progressão permanece. A divulgação ao aluno será definida separadamente.

- **A — Professor submete; gestão confere e oficializa (recomendado):** outra pessoa da Gerência Pedagógica/Administração revisa cada avaliação e libera suas notas para o resultado oficial.
- **B — Professor oficializa cada avaliação; gestão confere o resultado do nível:** notas entram no acompanhamento quando o professor conclui o lançamento, e outra pessoa da gestão valida o consolidado antes de usá-lo na progressão.
- **C — Conferência única ao fechar o nível:** professor mantém os lançamentos como provisórios; outra pessoa da Gerência Pedagógica/Administração confere e oficializa o conjunto ao final do nível.

### Q143 — Quais resultados acadêmicos o aluno poderá consultar no portal?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Avaliações oficiais e acompanhamento consolidado (recomendado): aluno consulta notas por habilidade de cada avaliação oficializada, comentários pedagógicos destinados a ele, frequência e resultado consolidado, com indicação das pendências.”

**Definição incorporada:** ampliar portal do aluno ao acompanhamento oficial da matrícula: notas por habilidade de cada avaliação oficializada, comentários destinados a ele, frequência e consolidado com pendências. Distinguir parcial/final, preservar regularizações sem dupla contagem, não divulgar rascunhos como oficiais nem anunciar progressão antes da aprovação. Acesso dos responsáveis permanece separado.

**Consequências técnicas:** autorização por identidade e matrícula, filtrar estado oficial e comentários destinados ao aluno no servidor. Não abrir dados de colegas ou conceder acesso a pagadores por inferência. Essa consulta não inclui provas/entregas de avaliação, conforme Q139.

**Pergunta e alternativas apresentadas:**

Q142 exige conferência independente antes de oficializar as notas. Agora precisamos definir a apresentação ao próprio aluno, dentro da matrícula correspondente. Notas em rascunho ou aguardando conferência não serão divulgadas como oficiais.

Em todas as opções, a tela distingue resultado parcial de resultado final, mostra a frequência real e suas regularizações sem duplicação e não anuncia mudança de nível antes da aprovação. Este acesso não inclui dados de outros alunos. Acesso de responsáveis será tratado separadamente; não decorre automaticamente de serem pagadores.

- **A — Avaliações oficiais e acompanhamento consolidado (recomendado):** aluno consulta notas por habilidade de cada avaliação oficializada, comentários pedagógicos destinados a ele, frequência e resultado consolidado, com indicação das pendências.
- **B — Somente fechamento do nível:** aluno consulta resultados oficiais por habilidade, média geral e frequência após fechamento; avaliações intermediárias e comentários ficam disponíveis apenas à equipe.
- **C — Publicação selecionada pela gestão:** após oficialização, gestão escolhe quais avaliações/resultados e comentários divulgar; registrar a publicação e manter o restante restrito à equipe.

### Q144 — Como corrigir uma nota que já foi oficializada?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Professor responsável ou gestão propõe (recomendado): professor com atribuição vigente ou Gerência Pedagógica/Administração registra a correção; outra pessoa autorizada confere e aplica.”

**Definição incorporada:** professor vigente ou gestão propõe; outra pessoa da Gerência Pedagógica/Administração aprova antes de aplicar. Preservar nota anterior, nova, motivo e autoria, conferindo habilidade, média, recuperação e progressão. Até aplicar, conservar resultado oficial anterior. Correção de erro pode reduzir nota, diferentemente de recuperação válida pior. Progressão já aprovada/executada afetada abre pendência de revisão, sem reversão automática.

**Consequências técnicas:** validar atribuição atual, versão corrigida e aprovação independente; preservar histórico e conferir dependências. Não reutilizar Q133 para proteger nota errada nem devolver acesso de edição ao professor sem vínculo vigente.

**Pergunta e alternativas apresentadas:**

Exemplo: o professor percebe erro de digitação ou de avaliação depois da conferência. A correção deve preservar nota anterior, nova nota, motivo e autoria, além de conferir os efeitos na habilidade, média geral, recuperação e progressão.

Minha proposta comum às opções é exigir aprovação de outra pessoa da Gerência Pedagógica/Administração antes de aplicar. Até lá, manter o resultado oficial anterior. Corrigir erro pode reduzir uma nota; isso é diferente de uma recuperação válida pior, que não reduz o resultado conforme Q133. Se já houver mudança de nível aprovada ou executada, abrir pendência para revisão, sem desfazer a matrícula ou movimentar o aluno automaticamente.

- **A — Professor responsável ou gestão propõe (recomendado):** professor com atribuição vigente ou Gerência Pedagógica/Administração registra a correção; outra pessoa autorizada confere e aplica.
- **B — Somente gestão propõe:** professor informa o erro; Gerência Pedagógica/Administração prepara a correção e outra pessoa autorizada confere e aplica.
- **C — Professor propõe; somente Administração aprova:** gestão também pode preparar quando necessário, mas toda correção oficial depende de outra pessoa da Administração.

### Q145 — O responsável terá acesso próprio aos resultados acadêmicos nesta entrega?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Atendimento pela equipe nesta entrega (recomendado): manter o portal acadêmico para o aluno; responsáveis autorizados recebem informações pela equipe, sem nova área autenticada de responsáveis agora.”

**Definição incorporada:** portal acadêmico do aluno; responsáveis autorizados são atendidos pela equipe, sem portal próprio nesta entrega. Pagamento ou responsabilidade financeira não concede acesso acadêmico por si só.

**Consequências técnicas:** não incluir contas/área de responsáveis no escopo atual nem herdar permissões acadêmicas de vínculo financeiro. Atendimento pela equipe continua sujeito à autorização e ao alcance aplicáveis ao aluno/matrícula.

**Pergunta e alternativas apresentadas:**

Q143 liberou o acompanhamento no portal do aluno. Precisamos decidir se também haverá uma conta individual para o responsável consultar esses resultados.

Ser responsável financeiro ou pagar a mensalidade não concede acesso acadêmico automaticamente. Se houver portal para responsáveis, a escola deverá conferir o vínculo e a autorização aplicável ao aluno e à matrícula; cada pessoa usa sua própria conta. O acesso não inclui conversas comerciais, dados de colegas ou gravações por consequência desta escolha. Cadastro, revisão e retirada da autorização serão detalhados se esse acesso entrar no escopo.

- **A — Atendimento pela equipe nesta entrega (recomendado):** manter o portal acadêmico para o aluno; responsáveis autorizados recebem informações pela equipe, sem nova área autenticada de responsáveis agora.
- **B — Portal do responsável em leitura:** incluir conta própria para consultar os mesmos resultados acadêmicos oficiais autorizados, sem enviar atividades ou agir em nome do aluno.
- **C — Portal em leitura e avisos acadêmicos:** incluir a consulta autorizada e notificações de novos resultados/pendências; detalhar canais e preferências, sem permitir ações em nome do aluno.

### Q146 — Como tratar uma avaliação obrigatória que o aluno não realizou?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Segunda chamada separada da recuperação (recomendado): oferecer nova aplicação da avaliação pendente, com autorização; ela fornece a nota original e não consome tentativa de recuperação de nota.”

**Definição incorporada:** avaliação não realizada permanece pendente sem zero; professor propõe segunda chamada e outra pessoa da Gerência Pedagógica/Administração autoriza. Ela fornece nota original, sem consumir recuperação. Preservar motivo/histórico; se a escola não ofereceu, registrar sua pendência sem atribuir falta ao aluno. Não há cobrança adicional autorizada.

**Consequências técnicas:** vincular segunda chamada à avaliação original, sem duplicar nota/peso ou usar cota de recuperação/particulares. Reposição de frequência não supre avaliação. Limites e prazos serão refinados.

**Pergunta e alternativas apresentadas:**

Exemplo: o aluno faltou à avaliação final de leitura. Isso é diferente de ter realizado a avaliação e obtido nota insuficiente. A nota continua pendente, sem zero automático; a reposição de falta à aula não substitui a avaliação.

Em todas as opções, registrar o motivo e preservar o histórico. Professor propõe o atendimento e outra pessoa da Gerência Pedagógica/Administração autoriza. Se a escola não ofereceu a avaliação, registrar a pendência da escola sem atribuir falta ao aluno. Quantidade de oportunidades e prazos serão detalhados depois; esta decisão não autoriza cobrança adicional.

- **A — Segunda chamada separada da recuperação (recomendado):** oferecer nova aplicação da avaliação pendente, com autorização; ela fornece a nota original e não consome tentativa de recuperação de nota.
- **B — Avaliação equivalente escolhida pela gestão:** autorizar segunda chamada ou outro instrumento equivalente para as mesmas habilidades; registrar a substituição e usar o resultado como nota original, sem consumir recuperação.
- **C — Atender pelo plano de recuperação:** incluir a habilidade sem nota no plano aprovado e usar a avaliação para suprir a pendência; será necessário detalhar o cálculo e se essa oportunidade consome o limite de recuperação.

### Q147 — Como limitar as oportunidades de segunda chamada?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Limite configurável por avaliação pendente (recomendado): cada avaliação tem seu próprio limite de segunda chamada naquela matrícula; uma não esgota as oportunidades de outra.”

**Definição incorporada:** limite configurável por avaliação pendente e matrícula, sem número presumido ou compartilhamento com recuperação/particulares. Professor propõe e outra pessoa da Gerência Pedagógica/Administração autoriza. Cancelamento ou falta de oferta pela escola não consome oportunidade.

**Consequências técnicas:** identificar origem da avaliação e matrícula nos contadores, preservar histórico e não reiniciar saldo ao editar cadastro. Consumo por ocorrências do aluno e prazos ainda serão definidos.

**Pergunta e alternativas apresentadas:**

Q146 criou a segunda chamada para suprir uma avaliação não realizada. Precisamos decidir se o limite pertence a cada avaliação pendente ou ao conjunto do nível da matrícula.

Nenhuma quantidade será presumida. O professor propõe e outra pessoa da Gerência Pedagógica/Administração autoriza; não há uso da cota de recuperação nem das reposições particulares. Cancelamento ou falta de oferta pela escola não deve consumir oportunidade do aluno. Prazos e o tratamento de falta/cancelamento do aluno serão definidos separadamente.

- **A — Limite configurável por avaliação pendente (recomendado):** cada avaliação tem seu próprio limite de segunda chamada naquela matrícula; uma não esgota as oportunidades de outra.
- **B — Limite configurável por nível da matrícula:** as segundas chamadas das diferentes avaliações compartilham um limite do nível, separado de outros contratos.
- **C — Sem limite numérico automático:** cada nova segunda chamada depende de proposta e aprovação da gestão, com histórico das oportunidades anteriores e motivo.

### Q148 — Quando a segunda chamada consome uma oportunidade?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Antecedência configurável (recomendado): cancelamento do aluno dentro do prazo libera a reserva; cancelamento tardio ou falta consome a oportunidade, mantendo a nota pendente.”

**Definição incorporada:** reservar oportunidade ao autorizar e agendar. Realização consome e fornece nota original; cancelamento pela escola ou pelo aluno dentro da antecedência configurada libera. Falta/cancelamento tardio consome mantendo nota pendente, sem zero. Nova oportunidade exige autorização e saldo; nenhum número presumido.

**Consequências técnicas:** impedir reservas simultâneas acima do limite por avaliação/matrícula, duplicação de transições e uso da cota de recuperação. Registrar ocorrência, regra aplicada, liberação ou consumo.

**Pergunta e alternativas apresentadas:**

Q147 definiu limite próprio por avaliação pendente. Proponho reservar uma oportunidade ao autorizar e agendar a segunda chamada, impedindo reservas simultâneas acima desse limite.

Nas três opções, realização consome a oportunidade e fornece a nota original; cancelamento pela escola libera sem consumo. Falta ou cancelamento não gera nota zero nem preenche a avaliação. Se continuar pendente, outra oportunidade exige nova autorização e disponibilidade no limite. Não presumiremos antecedência numérica.

- **A — Antecedência configurável (recomendado):** cancelamento do aluno dentro do prazo libera a reserva; cancelamento tardio ou falta consome a oportunidade, mantendo a nota pendente.
- **B — Apenas realização consome:** falta ou cancelamento do aluno libera a reserva; uma nova aplicação continua exigindo autorização e prazo válido.
- **C — Decisão da gestão para falta/cancelamento:** manter a reserva pendente até outra pessoa da Gerência Pedagógica/Administração decidir consumir ou liberar, com motivo; realização consome normalmente.

### Q149 — Como definir o prazo para realizar a segunda chamada?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Prazo configurável a partir da disponibilização (recomendado): iniciar quando a segunda chamada aprovada estiver disponível ao aluno com as condições necessárias; guardar a regra aplicada.”

**Definição incorporada:** prazo configurável e separado da recuperação inicia na disponibilização aprovada com condições necessárias; registrar regra, início e limite e informar aluno. Prorrogação exige motivo e outra pessoa da Gerência Pedagógica/Administração. Impedimento da escola gera pendência/revisão, sem falta/zero presumidos. Vencimento sozinho não consome; ocorrências agendadas seguem Q148.

**Consequências técnicas:** separar aprovação, disponibilização e contagem; repetir envio não reinicia relógio. Preservar prorrogações e autoria, sem presumir duração numérica ou pausa automática copiada de outro fluxo.

**Pergunta e alternativas apresentadas:**

A segunda chamada precisa estar autorizada e disponível, com condições para o aluno realizá-la. Seu prazo é separado do prazo de recuperação, mesmo que a escola escolha durações iguais.

Nas três opções, informar o prazo ao aluno e registrar início e data-limite. Prorrogação exige motivo e aprovação de outra pessoa da Gerência Pedagógica/Administração. Se a escola não oferecer as condições, registrar pendência e revisar o prazo, sem presumir falta ou zero. O vencimento sozinho não consome oportunidade; falta/cancelamento de encontro agendado segue Q148. Não fixaremos número de dias.

- **A — Prazo configurável a partir da disponibilização (recomendado):** iniciar quando a segunda chamada aprovada estiver disponível ao aluno com as condições necessárias; guardar a regra aplicada.
- **B — Data-limite comum por turma/nível:** escola estabelece uma janela de segunda chamada para o grupo; impedimentos individuais exigem revisão ou prorrogação aprovada.
- **C — Data individual aprovada em cada solicitação:** professor propõe a data-limite conforme o caso e a gestão aprova, sem duração padrão obrigatória.

### Q150 — Podemos autorizar uma oportunidade extra quando o limite estiver esgotado?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Exceção com aprovação pedagógica independente (recomendado): professor/gestão propõe; outra pessoa da Gerência Pedagógica/Administração autoriza a quantidade extra para o caso identificado.”

**Definição incorporada:** permitir oportunidades extras por proposta docente/gestão e aprovação independente da Gerência Pedagógica/Administração. Identificar matrícula, habilidade/avaliação, quantidade, motivo e evidências. Preservar consumos e separar recuperação/segunda chamada; não alterar limite padrão nem dispensar notas/progressão.

**Consequências técnicas:** registrar autorização excepcional por contexto, sem reiniciar contador ou duplicar extras por repetição; vedar autoaprovação e revalidar quantidade aprovada. Concessão não substitui aprovação do plano/segunda chamada.

**Pergunta e alternativas apresentadas:**

Essa decisão vale para os limites de recuperação por habilidade e de segunda chamada por avaliação, mantendo os dois controles separados. Exemplo: o aluno esgotou as oportunidades previstas, mas a gestão identifica motivo para permitir mais uma avaliação.

Uma oportunidade extra não dispensa os mínimos de nota de Q138 nem aprova progressão. Se permitida, deve identificar matrícula, habilidade ou avaliação, quantidade adicional, motivo e evidências, preservando os consumos anteriores. A autorização não altera o limite padrão de outros alunos e não permite autoaprovação.

- **A — Exceção com aprovação pedagógica independente (recomendado):** professor/gestão propõe; outra pessoa da Gerência Pedagógica/Administração autoriza a quantidade extra para o caso identificado.
- **B — Exceção exclusiva da Administração:** professor/gestão propõe, mas somente outra pessoa da Administração pode autorizar oportunidades adicionais.
- **C — Não permitir oportunidades extras:** respeitar o limite vigente; gestão define outro encaminhamento pedagógico, sem conceder tentativas adicionais nem dispensar mínimos de nota.

### Q151 — Como ficam recuperação e segunda chamada quando a matrícula é pausada ou encerrada?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Histórico em leitura; realização por autorização específica (recomendado): novas realizações ficam bloqueadas, salvo liberação da gestão para uma pendência identificada, com motivo e prazo, respeitando limites e aprovações aplicáveis.”

**Definição incorporada:** preservar histórico em leitura após pausa/encerramento. Nova realização depende de autorização específica da gestão para pendência, motivo e prazo. Permitir registrar/conferir avaliação efetivamente realizada antes da mudança, com data/autoria preservadas. Não alterar outros contratos, conceder extras, reativar cobrança ou liberar restrições/gravações automaticamente.

**Consequências técnicas:** separar consulta, regularização de fato passado e nova realização; conferir matrícula, alcance e validade da liberação em cada operação, mantendo limites e aprovações existentes.

**Pergunta e alternativas apresentadas:**

O histórico acadêmico e as notas oficiais permanecem preservados. Precisamos distinguir a consulta desse histórico da realização de uma nova avaliação após a pausa ou encerramento do contrato correspondente.

Nas três opções, permitir regularizar o registro e a conferência de avaliações efetivamente realizadas antes da mudança, preservando data e autoria. Não alterar outros contratos do aluno. Eventual autorização acadêmica não libera gravações ou restrições de acesso por conta própria, não concede oportunidade extra e não reativa cobrança.

- **A — Histórico em leitura; realização por autorização específica (recomendado):** novas realizações ficam bloqueadas, salvo liberação da gestão para uma pendência identificada, com motivo e prazo, respeitando limites e aprovações aplicáveis.
- **B — Aguardar reativação para realizar:** manter consulta ao histórico e regularização de registros anteriores; recuperação e segunda chamada só podem acontecer com a matrícula novamente ativa.
- **C — Concluir somente o que já estava autorizado:** permitir realizar recuperação/segunda chamada aprovadas antes da pausa ou encerramento, dentro dos prazos vigentes; bloquear novas solicitações.

### Q152 — Quem assume avaliações pendentes quando o professor responsável sai ou fica indisponível?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Gestão designa outro professor (recomendado): Gerência Pedagógica/Administração identifica as avaliações e registra substituto e motivo; ele continua o trabalho com acesso limitado.”

**Definição incorporada:** gestão designa outro professor para avaliações identificadas, com motivo e acesso limitado. Preservar autoria, evidências e notas anteriores; oficialização e correção continuam independentes. Designação não reinicia prazo nem concede extras.

**Consequências técnicas:** registrar atribuição por avaliação, responsável anterior/novo e motivo; não transferir autoria de fatos passados nem restaurar edição ampla ao professor que saiu. Conferir escopo vigente em cada operação.

**Pergunta e alternativas apresentadas:**

Pode faltar aplicar uma segunda chamada, avaliar uma recuperação ou registrar notas de uma avaliação já realizada. Precisamos manter a continuidade sem devolver acesso amplo ao professor anterior nem atribuir ao substituto o trabalho de outra pessoa.

Nas três opções, preservar autoria, evidências e notas anteriores. O novo responsável recebe acesso limitado às avaliações atribuídas; oficialização e correção continuam exigindo outra pessoa conforme Q142/Q144. A substituição não reinicia prazos nem concede oportunidades extras por si só.

- **A — Gestão designa outro professor (recomendado):** Gerência Pedagógica/Administração identifica as avaliações e registra substituto e motivo; ele continua o trabalho com acesso limitado.
- **B — Designação com aprovação independente:** gestão propõe professor e avaliações; outra pessoa da Gerência Pedagógica/Administração aprova antes de liberar o acesso.
- **C — Gestão assume ou designa professor:** Gerência Pedagógica/Administração pode assumir a tarefa avaliativa ou atribuí-la a um professor, registrando responsável, motivo e alcance; outra pessoa oficializa as notas.

### Q153 — Como aproveitar avaliações ao transferir o aluno para outra turma do mesmo nível?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Aproveitamento por equivalência aprovada (recomendado): mapear avaliações/habilidades de origem às exigências do destino, identificar o que será aproveitado e o que falta avaliar, com memória do cálculo.”

**Definição incorporada:** gestão prepara equivalência e outra pessoa da Gerência Pedagógica/Administração aprova. Mapear origem às exigências do destino, preservar notas/autoria e memória de cálculo, identificar pendências sem inventar notas ou duplicar pesos. Não alterar regra dos demais alunos nem dispensar mínimos; execução da transferência mantém fluxo aplicável.

**Consequências técnicas:** registrar referências de origem/destino e decisão de equivalência, revalidar versões na aplicação e conservar histórico. Mudança de turma não é nova avaliação nem autoriza duplicar resultados.

**Pergunta e alternativas apresentadas:**

As turmas podem ter avaliações ou versões de regras diferentes. Precisamos evitar perder notas válidas ou usar automaticamente resultados que não correspondem às exigências da turma de destino.

Em todas as opções, preservar avaliações, notas e autoria da origem, sem duplicar pesos ou criar notas ausentes. A transferência não altera a regra dos demais alunos da turma nem dispensa os mínimos de progressão. A decisão pedagógica de aproveitamento deve ser preparada pela gestão e aprovada por outra pessoa da Gerência Pedagógica/Administração; execução da transferência mantém seu fluxo aplicável.

- **A — Aproveitamento por equivalência aprovada (recomendado):** mapear avaliações/habilidades de origem às exigências do destino, identificar o que será aproveitado e o que falta avaliar, com memória do cálculo.
- **B — Manter a regra de origem até terminar o nível:** aluno leva suas avaliações e conclui aquele nível sob a versão original; registrar essa condição individual sem alterar a turma de destino.
- **C — Avaliar novamente segundo o destino:** manter notas de origem no histórico, mas exigir as avaliações da turma de destino para seu resultado nesse contexto, sem aproveitamento de notas anteriores.

### Q154 — Quando o resultado acadêmico do aluno no nível passa de parcial para final?

**Estado: respondida — A, em 10/09/2026.**

**Resposta do usuário:** “A — Gestão confirma o fechamento (recomendado): ERP confere pendências e apresenta o consolidado; Gerência Pedagógica/Administração confirma o resultado final, mantendo separada a aprovação da mudança de nível.”

**Definição incorporada:** ERP confere pendências e apresenta consolidado; gestão confirma o resultado final. Não fechar com registros obrigatórios ou decisões de aproveitamento/correção pendentes. Final pode ser insuficiente sem autorizar progressão. Fechamento não encerra matrícula/mensalidades; recuperação autorizada ou correção posterior exige nova versão preservando o fechamento anterior.

**Consequências técnicas:** separar completude, fechamento e elegibilidade para progressão; registrar autor, versão e momento do fechamento. Não confundir confirmação do consolidado com aprovação de nota, exceção ou mudança de nível.

**Pergunta e alternativas apresentadas:**

Q142 oficializa as notas de cada avaliação. Ainda precisamos distinguir esse lançamento do fechamento do conjunto: avaliações exigidas, frequência e eventuais recuperações ou segundas chamadas.

Nas três opções, impedir fechamento com registros obrigatórios ou decisões de aproveitamento/correção pendentes. Resultado final pode indicar requisitos não atingidos; isso não autoriza progressão. Fechar o resultado não encerra matrícula ou mensalidades. Recuperação posterior autorizada e correção exigem nova versão do resultado, preservando o fechamento anterior.

- **A — Gestão confirma o fechamento (recomendado):** ERP confere pendências e apresenta o consolidado; Gerência Pedagógica/Administração confirma o resultado final, mantendo separada a aprovação da mudança de nível.
- **B — Professor propõe; outra pessoa da gestão fecha:** professor solicita o fechamento do conjunto, e outra pessoa da Gerência Pedagógica/Administração confere e confirma.
- **C — Fechamento automático quando completo:** ERP torna final o consolidado após cumprir todos os requisitos de completude configurados; gestão continua responsável pela decisão de progressão.
