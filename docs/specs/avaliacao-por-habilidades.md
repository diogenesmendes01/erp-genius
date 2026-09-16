Atualização 561: gestão de designações de segunda chamada disponível pela interface, com vigência, busca, histórico paginado e proteção SQL do histórico. 14 integrações, lint e build aprovados; ensaio interativo pendente. [Evidências e limites](../planejamento/validacao-incremento-561.md).

Atualização 560: designação de segunda chamada expirada não restaura autorização anterior; novas datas de criação gravadas em UTC. 13 integrações, lint e tipos aprovados. Histórico legado exige conferência. [Evidências e limites](../planejamento/validacao-incremento-560.md).

Atualização 559: professor designado pode regularizar a nota de segunda chamada aplicada por outra pessoa, com evidências e autoria preservadas. 108 integrações, lint e build aprovados; homologação interativa e demais fluxos pendentes. [Evidências e limites](../planejamento/validacao-incremento-559.md).

> Atualização até 414 (2026-09-14): versão de entrega validada no portal integrada e testada. Resultados acadêmicos do aluno (Q143) em implementação; equivalência (Q153) e fechamento com controle de progressão (Q154) continuam pendentes, conforme [auditoria de código](../planejamento/auditoria-resultados-progressao-413.md). Evidências de reposição não comprovam conclusão destes requisitos. Os incrementos anteriores abaixo são históricos.

# SPEC-ERP-004 — Avaliação por habilidades e apoio à progressão

**Integração 394:** 129 testes aprovados em nove arquivos de avaliações, diário, reposições, agenda e identidade. Build aprovado no incremento 393. Segunda chamada, entregas no portal, fechamento/progressão e demais requisitos seguem em implementação. [Evidências e limites](../planejamento/validacao-incremento-394.md).


**Incremento 393 — estado atual:** identidade e rotas do portal integradas; build aprovado com 61 páginas estáticas. Agenda de reposições e frequência integradas com correções de vínculo, cotas e períodos. Entrega pelo portal, segunda chamada e demais frentes da SPEC permanecem em desenvolvimento. Evidência de testes e limites: [validação 393](../planejamento/validacao-incremento-393.md). Os incrementos abaixo são histórico, não comprovação da entrega integral.


**Integração 381:** 113 testes acadêmicos, de diário e reposição aprovados em cinco arquivos. Correção de UTC e isolamento de contratos conferidos; agenda por pedido, benefícios e portal do aluno continuam em implementação. [Evidências e limites](../planejamento/validacao-integracao-terra-381.md).

**Integração 378 em andamento:** substituição aprovada e aplicada passou nos testes focados; a rodada completa encontrou duas falhas na frequência em integração. Migração de reposições e nova validação de fontes ainda exigem conclusão e nova rodada. [Estado e evidências](../planejamento/validacao-integracao-terra-378.md).

**Incremento 377:** propostas versionadas de substituição com conferência atual, histórico e isolamento de acesso; 81 integrações acadêmicas aprovadas. Aprovação/aplicação seguem em implementação paralela com subagentes Terra. [Evidências e limites](../planejamento/validacao-incremento-377.md).

**Incremento 376:** a tela diferencia designação direta de tentativa sem agenda e conferência de substituição em encontro publicado. A prévia confere outro avaliador sem conceder acesso ou mudar a atribuição. 79 integrações acadêmicas aprovadas. [Evidências e dependências para aplicação](../planejamento/validacao-incremento-376.md). Proposta persistida e aprovação da substituição seguem pendentes.

**Incremento 375:** agenda publicada apresentada no plano, fila de atribuições e detalhe da tentativa, mantendo o escopo docente e os históricos autorizados. O formulário de realização considera o horário de início e o avaliador da agenda. 77 integrações acadêmicas aprovadas. [Evidências e limites](../planejamento/validacao-incremento-375.md).

**Incremento 374:** cancelamento pela escola de reserva com recuperação agendada, exigindo outra pessoa para aprovar o conjunto conferido. Cancela encontros previstos e libera apenas habilidades não realizadas na mesma operação, preservando histórico e consumos anteriores. [Evidências e limites](../planejamento/validacao-incremento-374.md). Não implementa cancelamento/falta do aluno ou remarcação.

**Incremento 373:** gestão decide proposta de outra pessoa e a aprovação publica o encontro da tentativa na mesma transação, após revalidação. Realização exige o avaliador e intervalo aprovados e conclui o encontro sem efeito de aula cobrável. [Evidências e limites](../planejamento/validacao-incremento-373.md). Alterações de agenda publicada ainda exigem implementar fluxo próprio; os caminhos diretos estão impedidos.

**Incremento 372:** impactos de recuperações identificados separadamente no calendário e no encerramento contratual; pendências acadêmicas não entram na apuração de particulares por hora. [Evidências e limites](../planejamento/validacao-incremento-372.md). Ainda não libera publicação ou realização após encerramento.

**Incremento 371:** finalidade explícita dos encontros (`AULA`/`RECUPERACAO`) e proteção dos consumidores de diário, ocorrência e horas contratadas. A publicação de recuperação continua bloqueada até implementar aprovação própria e revisar os impactos globais. [Evidências e limites](../planejamento/validacao-incremento-371.md).

**Incremento 370:** propostas versionadas e imutáveis de horário, com consulta histórica e revisão do estado atual pela gestão. [Escopo, evidências e dependências](../planejamento/validacao-incremento-370.md). Não há decisão/aprovação ou publicação; a integração dos encontros exige distinguir avaliação de aula particular nos consumidores da agenda.

**Incremento 369:** prévia de horário de recuperação na tela do plano, com conferência de vínculo, prazo, avaliador, calendário, encontros do aluno entre contratos, indisponibilidades e reservas comerciais. Não publica nem reserva horário. [Escopo e evidências](../planejamento/validacao-incremento-369.md). Aprovação da agenda e ocorrências do aluno permanecem pendentes.

**Incremento 368:** corrigida divergência de autoria na proteção SQL de extras: professor precisa ser titular de turma não concluída e ter vínculo já iniciado, sem encerramento, assim como no servidor. Migration 162 aplicada somente ao banco descartável; 65 integrações de avaliações aprovadas. [Reprodução, validação e pendências](../planejamento/validacao-incremento-368.md). A integração de tentativas com horários ainda precede o cálculo de cancelamento tardio.

**Versão:** 0.83 — 14/09/2026. **Estado:** regras Q124–Q154 aprovadas; implementação parcial. Cálculo, regras versionadas, lançamentos e correções regulares, designação limitada, planos e tentativas de recuperação, notas de recuperação e suas telas foram implementados no alcance dos incrementos 230–272 abaixo. Permanecem pendentes fluxos acadêmicos e homologação; este documento não comprova entrega integral. Consulte o incremento mais recente e suas evidências para o estado atual.

**Incremento 367:** saldo de recuperação apresentado com regra, extras aprovadas e total separados. Concorrência de aprovações/reservas e autorização com limite original zero verificadas em integração; 62 testes da suíte de avaliações aprovados. [Evidências e limites](../planejamento/validacao-incremento-367.md). Segunda chamada, fechamento e integração da progressão permanecem pendentes.

**Incremento 362:** a chamada que alimenta a frequência não escolhe uma alocação quando há vínculos históricos sobrepostos do mesmo aluno. Exige conferência, preserva o diário anterior e impede lançamento/conclusão indevida. Isso não implementa a resolução da ambiguidade nem o fechamento acadêmico. [Validação e escopo](../planejamento/validacao-incremento-362.md).

## 1. Objetivo e fontes

Incluir na primeira entrega o acompanhamento de fala, compreensão oral, leitura e escrita, além da frequência, com critérios configuráveis e resultado consolidado. O [registro da progressão acadêmica](../planejamento/progressao-academica.md) preserva as respostas e alternativas históricas. Integrar a [SPEC central](erp-educacional.md), a [matrícula como unidade operacional](matricula-como-unidade-operacional.md) e o [fluxo D14](../40-mudancas-academicas-com-aprovacao.md).

Q124 não determina escala, fórmula, pesos ou critérios mínimos de aprovação. O término da turma e a conclusão de aulas não aprovam alunos automaticamente. Resultado acadêmico não altera cobrança ou contrato por si só.

Q125 define nota numérica por habilidade, em escala configurável, com comentário pedagógico opcional. A escala concreta e o cálculo ainda dependem de configuração/definição; rubricas e conceitos não foram escolhidos.

## 2. Requisitos já aprovados

| ID | Requisito |
|---|---|
| AV-01 | Conservar resultado de fala, compreensão oral, leitura e escrita de forma identificável, além da frequência e do resultado consolidado. Não reduzir o histórico das habilidades a um único resultado sem origem. |
| AV-02 | Critérios serão configuráveis. A operação dependente exige regra suficiente e aplicável; não usar pesos, mínimos ou fórmulas ocultos para preencher configuração ausente. |
| AV-03 | Identificar matrícula, contexto acadêmico e autor autorizado. Um aluno com vários contratos não tem resultados automaticamente compartilhados entre eles. Aplicar ação, registro, campo e condição no servidor. |
| AV-04 | Frequência integra o acompanhamento, preservando presença original e regularização por reposição segundo as regras aprovadas. A avaliação não inventa presenças, faltas ou reposições. |
| AV-05 | Mudança de nível conserva solicitação, parecer docente ou dispensa justificada, aprovação independente e execução pela Secretaria. Nota, frequência ou término de turma não executa a mudança automaticamente. |
| AV-06 | Preservar dados e regra utilizados no resultado, autoria e histórico. Oficialização e correção seguem Q142/Q144; apresentação ao aluno segue Q143; não assumir que editar configuração pode sobrescrever resultados anteriores. |
| AV-07 | Q125: nota numérica por habilidade e comentário opcional, com escala aplicável identificada e validação no servidor. Lançamento ausente não equivale a zero; comentário não altera a nota e não implica rubrica/conceito obrigatório. |
| AV-08 | Q126: registrar avaliações intermediárias e uma etapa final, identificando suas notas de origem e papel no percurso. Quantidade, datas, habilidades abrangidas e participação no resultado não foram presumidas. Frequência permanece separada. |
| AV-09 | Q127: intermediárias selecionam habilidades; a etapa final cobre as quatro, podendo distribuir instrumentos/momentos. Registrar conjunto aplicável e distinguir habilidade não avaliada de nota exigida ausente, sem zeros artificiais. |
| AV-10 | Q128: resultado por habilidade usa diretamente notas e pesos individuais das avaliações aplicáveis, sem médias prévias por etapa. Conservar memória e evitar zero/redistribuição automática por nota ausente. Pesos concretos e consolidação entre habilidades não foram presumidos. |
| AV-11 | Q129: média geral ponderada dos quatro resultados, com peso configurável por habilidade, mantendo resultados individuais e frequência separados. Distinguir peso da avaliação e peso da habilidade, sem fórmula/compensação de mínimos presumida. |
| AV-12 | Q130: exigir simultaneamente mínimo da média geral e mínimo de cada habilidade, em valores configurados. Resultado de outra habilidade não compensa mínimo individual; mostrar cumprimento/insuficiência ou pendência sem executar progressão ou criar dispensa automática. |
| AV-13 | Q131: frequência mínima configurável, com regularização ou exceção específica aprovada por outra pessoa da Gerência Pedagógica/Administração com motivo/evidências. Preservar frequência real, autoria e registros; não dispensar notas nem inferir exceção da aprovação comum da mudança. |
| AV-14 | Q132: recuperação direcionada às habilidades insuficientes; quando só faltar mínimo geral, plano identifica habilidades a trabalhar/reavaliar. Preservar notas/tentativas, sem frequência, benefício particular ou cobrança adicional automática. Incorporação conserva o melhor resultado conforme Q133. |
| AV-15 | Q133: recuperação válida conserva máximo(resultado vigente da habilidade, nota da tentativa). Preservar originais/tentativas, aplicar uma vez às habilidades do plano e recalcular média geral. Nota menor não reduz o vigente; não contar recuperação também na média regular. |
| AV-16 | Q134: limite configurável de tentativas por matrícula, nível e habilidade. Não compartilhar contagem entre habilidades não abrangidas ou contratos; preservar origem e não reiniciar histórico ao editar plano/regra. Reserva, consumo e liberação seguem Q137. |
| AV-17 | Q135: professor responsável ou gestão prepara plano; outra pessoa da Gerência Pedagógica/Administração confere e autoriza. Verificar vínculo, contexto, versão e limites; rascunho não libera execução, e aprovação não dispensa notas/frequência ou executa progressão. |
| AV-18 | Q136: prazo configurável inicia com plano aprovado disponibilizado ao aluno e condições necessárias de realização. Registrar início e limite; prorrogação exige motivo e aprovação independente. Falta de condições pela escola gera pendência/revisão; vencimento sozinho não gera nota, aprovação ou consumo. |
| AV-19 | Q137: reservar disponibilidade por habilidade ao liberar tentativa autorizada. Realização, falta e cancelamento tardio consomem; cancelamento do aluno dentro da antecedência configurada ou pela escola libera. Não gerar nota zero, presença ou aprovação por ocorrência; vencimento do plano sozinho não consome. |
| AV-20 | Q138: não permitir exceção de nota para progressão. Exigir mínimo geral e de cada habilidade, inclusive após recuperação. Insuficiência permanece pendente de solução pedagógica; não elevar notas, criar avaliação ausente ou conceder tentativa extra. Exceção de frequência não dispensa notas. |
| AV-21 | Q139: avaliações intermediárias, finais e de recuperação são aplicadas na aula ou em ferramenta externa; ERP registra avaliação, notas por habilidade e comentário. Não incluir provas ou entregas de avaliação no portal nesta versão, nem correção por IA. Preservar o fluxo separado de resumo/atividade das reposições por gravação. |
| AV-22 | Q140: Gestão Pedagógica prepara regras de avaliação; outra pessoa da Gestão Pedagógica/Administração aprova e publica. Professores contribuem com sugestões. Registrar versão, autoria e condições de aplicação; vedar autoaprovação e alteração silenciosa de resultados existentes. |
| AV-23 | Q141: novas turmas usam nova versão; turmas ainda não iniciadas podem migrar após revisão de impactos e aprovação independente. Turmas em andamento conservam regras até concluir o nível. Preservar versões, notas e resultados; não confundir atualização de regras avaliativas com quantidade de aulas/cronograma. |
| AV-24 | Q142: professor responsável submete notas das avaliações sob sua atribuição; outra pessoa da Gerência Pedagógica/Administração confere cada avaliação e oficializa suas notas. Preservar autoria/histórico, distinguir rascunho e oficial; ausência não vira zero. Oficialização não executa progressão nem define por si só divulgação ao aluno. |
| AV-25 | Q143: aluno consulta, na própria matrícula, notas por habilidade das avaliações oficializadas, comentários destinados a ele, frequência e consolidado com pendências. Distinguir parcial/final; não divulgar rascunhos como oficiais nem anunciar progressão não aprovada. Não estender acesso a responsáveis/pagadores automaticamente. |
| AV-26 | Q144: professor com atribuição vigente ou Gerência Pedagógica/Administração propõe correção de nota oficial; outra pessoa autorizada da Gerência Pedagógica/Administração aprova e aplica. Preservar anterior/novo/motivo/autoria e conferir efeitos nos resultados, recuperação e progressão. Manter oficial anterior até aplicação; erro corrigido pode reduzir nota. Progressão já aprovada/executada gera pendência de revisão, sem reversão automática. |
| AV-27 | Q145: responsáveis autorizados recebem informações acadêmicas pela equipe; não incluir área autenticada de responsáveis nesta entrega. Portal acadêmico permanece do aluno. Ser pagador não concede acesso acadêmico automaticamente. |
| AV-28 | Q146: avaliação obrigatória não realizada fica pendente, sem zero automático; oferecer segunda chamada proposta pelo professor e autorizada por outra pessoa da Gerência Pedagógica/Administração. Ela fornece nota original, sem consumir recuperação. Preservar motivo/histórico; falta de oferta da escola não é falta do aluno. Não autorizar cobrança adicional ou substituir avaliação por reposição de frequência. |
| AV-29 | Q147: limite configurável de segunda chamada por avaliação pendente na matrícula. Uma avaliação não esgota outra; não compartilhar limite com recuperação, particulares ou outros contratos. Cancelamento/falta de oferta pela escola não consome oportunidade. Quantidade não presumida; proposta docente e aprovação independente permanecem. |
| AV-30 | Q148: reservar oportunidade ao autorizar e agendar segunda chamada. Realização, falta ou cancelamento tardio do aluno consomem; cancelamento tempestivo ou pela escola libera. Antecedência configurável. Falta/cancelamento mantém nota pendente, sem zero. Nova oportunidade exige autorização e saldo; impedir reservas simultâneas acima do limite. |
| AV-31 | Q149: prazo configurável da segunda chamada inicia com disponibilização aprovada e condições necessárias. Registrar regra, início/limite e informar aluno. Prorrogação exige motivo e aprovação independente; falta de condições pela escola gera pendência/revisão. Vencimento sozinho não consome oportunidade ou gera falta/zero; ocorrências seguem Q148. |
| AV-32 | Q150: professor/gestão propõe oportunidades extras de recuperação ou segunda chamada; outra pessoa da Gerência Pedagógica/Administração aprova quantidade, motivo e evidências para matrícula/habilidade/avaliação identificada. Manter controles separados e consumos anteriores; não alterar limite padrão, dispensar mínimos de nota ou aprovar progressão. |
| AV-33 | Q151: matrícula pausada/encerrada mantém histórico em leitura; nova realização de recuperação/segunda chamada exige liberação específica da gestão para pendência, motivo e prazo, respeitando limites/aprovações. Permitir registro/conferência de avaliações realizadas antes da mudança, preservando autoria/data. Não afetar outros contratos, reativar cobrança ou liberar restrições/gravações por inferência. Lacuna de recuperação e critérios de implementação: [autorização específica](recuperacao-autorizacao-especial.md). |
| AV-34 | Q152: Gerência Pedagógica/Administração designa outro professor para avaliações pendentes identificadas, com motivo e acesso limitado. Preservar autoria, evidências e notas anteriores. Oficialização/correção exige outra pessoa conforme Q142/Q144; designação não reinicia prazo, concede extras ou devolve acesso amplo ao professor anterior. |
| AV-35 | Q153: transferência entre turmas do mesmo nível exige aproveitamento por equivalência, preparado pela gestão e aprovado por outra pessoa da Gerência Pedagógica/Administração. Mapear avaliações/habilidades às exigências do destino, identificar aproveitado e pendente e preservar memória de cálculo, origem e autoria. Não duplicar pesos, fabricar notas ou alterar regra dos demais alunos. |
| AV-36 | Q154: ERP confere pendências e apresenta consolidado; Gerência Pedagógica/Administração confirma resultado final do aluno no nível. Bloquear fechamento com registros obrigatórios ou decisões de aproveitamento/correção pendentes. Resultado final insuficiente não autoriza progressão; não encerrar matrícula/cobrança. Recuperação posterior autorizada ou correção produz nova versão preservando fechamento anterior. |

## 3. Relações técnicas propostas

**Prazo de recuperação — Q136/A:** contar prazo configurável somente após disponibilizar o plano aprovado ao aluno com as condições de realização. Guardar regra, início, limite e informação ao aluno. Prorrogação exige motivo e aprovação de outra pessoa da Gerência Pedagógica/Administração; indisponibilidade causada pela escola gera pendência/revisão sem falta ou zero presumidos. Aprovação isolada ou rascunho não inicia contagem, repetição não reinicia prazo, e vencimento sozinho não consome tentativa ou gera nota/aprovação.

**Autorização da recuperação — Q135/A:** professor responsável prepara plano; outra pessoa da Gerência Pedagógica/Administração confere e autoriza, verificando habilidades e limites. Gestão pode preparar com outro aprovador. Registrar contexto, autor, versão, proposta e decisão; revalidar vínculo/permissões/limites e vedar autoaprovação por acúmulo de papéis. Mudança relevante exige nova aprovação. Autorizar plano não dispensa notas/frequência, não aprova progressão nem define por si só o evento de consumo de tentativa.

**Limite de recuperação — Q134/A:** controlar tentativas por matrícula, contexto de nível e habilidade, com limite configurável e histórico de origem. Uma tentativa somente envolve as habilidades do plano; não consome limite de habilidade não abrangida ou de outro contrato. Conferir cada limite em plano com várias habilidades. Quantidade permanece configurável; eventos seguem Q137 e autorização segue Q135; não reutilizar a cota de particulares ou reiniciar histórico ao editar regra/plano.

**Efeito da recuperação — Q133/A:** resultado atualizado da habilidade = máximo(resultado vigente, nota da recuperação válida). Guardar tentativa e resultado antes/depois; nota menor ou igual não reduz o vigente. Aplicar uma vez somente às habilidades do plano, sem reintroduzir a recuperação na média regular de Q128; recalcular média geral com Q129 e conferir Q130. Preservar histórico, frequência e fluxo de progressão. Correção/invalidação de nota errada é fluxo distinto ainda a refinar, não garantia de imutabilidade de erro.

**Recuperação direcionada — Q132/A:** identificar habilidades abaixo do mínimo ou, se apenas a média geral for insuficiente, as habilidades escolhidas no plano para atingir esse requisito. Preservar resultados, plano e tentativas; não reavaliar todas por padrão. Notas da recuperação têm vínculo com matrícula/contexto/plano e não são reposição de falta, consumo de benefício particular ou cobrança adicional automática. Efeito no resultado segue a conservação do melhor resultado de Q133.

**Frequência — Q131/A:** requisito mínimo configurável e separado das notas. Abaixo dele, exigir regularização ou decisão específica de outra pessoa da Gerência Pedagógica/Administração, com motivo/evidências e referência à matrícula/contexto/regra. Preservar frequência real e registros de origem; exceção não cria presenças nem dispensa mínimos de nota. Revalidar independência, autorização e versão; aprovação ordinária de mudança de nível não implica dispensa de frequência.

**Mínimos de nota — Q130/A:** cumprir simultaneamente média geral ≥ mínimo geral e resultado de cada habilidade ≥ respectivo mínimo configurado. Mostrar os cinco requisitos e resultados usados, sem compensar mínimo individual por nota alta em outra habilidade. Ausência de regra/resultado gera pendência. Cumprimento do critério de notas não é aprovação/execução da progressão; frequência, recuperação e exceções têm definição própria.

**Média geral — Q129/A:** combinar os quatro resultados por soma(resultado da habilidade × peso da habilidade) / soma(pesos das habilidades), com pesos configuráveis próprios e memória de origem. Preservar os quatro resultados e a frequência separadamente. Peso por habilidade não é o peso por avaliação de Q128; frequência não entra automaticamente como nota. Regra insuficiente, resultado exigido ausente ou denominador inválido não permite declarar resultado geral completo.

**Composição por habilidade — Q128/C:** média ponderada direta das notas da habilidade, usando o peso de cada avaliação correspondente: soma(nota × peso) / soma(pesos aplicáveis). Não agrupar primeiro as notas por etapa intermediária/final. Conservar etapas, conjunto e regra de origem na memória de cálculo. Habilidades fora da avaliação não entram com zero; lançamento exigido ausente não permite excluir seu peso silenciosamente e apresentar cálculo como completo. Não calcular resultado completo com regra insuficiente, escala incompatível ou denominador inválido.

Q127 permite selecionar habilidades em cada avaliação intermediária e exige cobertura das quatro na etapa final, inclusive por instrumentos/momentos distintos. Registrar o conjunto aplicável por avaliação; habilidade fora do conjunto não equivale a nota zero. Distinguir cobertura prevista, nota ainda ausente e resultado efetivamente registrado.

| Registro conceitual | Relação necessária |
|---|---|
| Regra de avaliação | Habilidades, escala numérica configurada e critérios aplicáveis, com versão/contexto. Limites concretos e demais campos dependem de configuração e próximas decisões. |
| Avaliação | Matrícula e contexto de nível, autoria, etapa intermediária/final e resultados por habilidade. Cobertura segue Q127; quantidade, datas e instrumentos ainda dependem de detalhamento. |
| Frequência de referência | Período/conjunto pertinente e origem nos registros acadêmicos, sem segundo diário editável dentro do módulo. |
| Resultado consolidado | Avaliações e regra de origem, frequência pertinente e memória de composição; composição segue Q128/Q129/Q133; fechamento segue Q154. |
| Decisão de progressão | Referência ao resultado pertinente quando aplicável, mantendo as etapas de D14; não confundir resultado calculado com aprovação/execução. |

Nomes são conceituais, não tabelas implementadas. A revisão definirá operações e migração após as escolhas de representação e critérios. Não criar informação histórica para alunos importados sem fonte suficiente.

## 4. Critérios de aceite iniciais

Critérios de aceite do escopo completo. A evidência por incremento ao final discrimina o alcance já testado; não considerar toda a tabela executada.

| ID | Cenário | Resultado esperado |
|---|---|---|
| ACA-01 | Aluno com dois contratos recebe avaliação em um deles | Resultados vinculados ao contrato/contexto correto; não alterar nem expor os do outro contrato por herança da identidade. |
| ACA-02 | Consultar resultado consolidado | Identificar habilidades e frequência que o fundamentam, com regra de origem; fórmula/escala somente após sua definição. |
| ACA-03 | Turma termina ou aluno recebe resultado acadêmico favorável | Não transferir nível, ativar contrato ou alterar cobrança automaticamente; manter o fluxo de mudança aprovado. |
| ACA-04 | Regra acadêmica necessária está incompleta | Mostrar pendência e impedir cálculo/decisão dependente, sem presumir nota, peso ou mínimo. |
| ACA-05 | Lançar nota válida, fora da escala ou deixar sem lançamento; incluir/omitir comentário | Aceitar nota válida com comentário opcional; rejeitar valor fora dos limites configurados. Ausência de lançamento permanece identificada, sem virar zero. Identificar escala de origem e não criar conceito/rubrica por inferência. |
| ACA-06 | Consultar percurso com avaliações intermediárias e etapa final ainda sem resultado | Identificar notas de cada avaliação/etapa e o que ainda falta, sem apagar intermediárias, inventar final ou transformar ausência em zero. Composição só usa regras suficientes; nenhum resultado executa progressão automaticamente. |
| ACA-07 | Avaliação intermediária só de fala; etapa final distribuída por instrumentos | Intermediária não exige notas/zeros das outras habilidades. Final confere cobertura das quatro no conjunto, sem exigir as quatro em cada instrumento; cobertura prevista não equivale a notas lançadas ou resultado concluído. |
| ACA-08 | Consolidar habilidade com avaliações de pesos diferentes e outras que não a avaliam | Aplicar soma(nota × peso)/soma(pesos aplicáveis), sem agrupar por etapa ou incluir habilidade fora do escopo. Mostrar notas/pesos de origem; ausência exigida, regra incompleta, escala incompatível ou denominador inválido impedem apresentar resultado como completo. Repetição não duplica nota/peso. |
| ACA-09 | Consolidar quatro habilidades com pesos próprios, distintos dos pesos das avaliações | Calcular soma(resultado × peso da habilidade)/soma(pesos das habilidades), mostrando memória e resultados individuais. Não usar frequência como nota nem trocar os dois níveis de pesos. Resultado ausente/configuração inválida não produz média completa por exclusão silenciosa. |
| ACA-10 | Média geral atinge mínimo, mas uma habilidade não; conferir também igualdade ao mínimo e regra ausente | Critério de notas só é cumprido quando os cinco requisitos são atendidos. Igualdade atinge o mínimo configurado; falta de regra/resultado gera pendência. Não compensar habilidade insuficiente por média alta nem executar a mudança automaticamente. |
| ACA-11 | Frequência abaixo do mínimo; tentar aprovação comum, autoexceção ou exceção válida | Exigir regularização ou decisão específica independente com motivo/evidências, ligada à matrícula/contexto/regra. Manter percentual real e mínimos de nota. Rejeitar autoaprovação, inclusive por acúmulo de papéis; reposição não duplica frequência e exceção não fabrica presença. |
| ACA-12 | Uma habilidade insuficiente ou apenas média geral abaixo do mínimo | Plano identifica habilidades necessárias e motivo/requisitos de origem, sem exigir todas por padrão. Tentativas preservam avaliações anteriores e contexto da matrícula; recuperação não fabrica frequência, consumo de benefício ou cobrança, e aplica a regra de Q133 somente ao resultado válido das habilidades abrangidas. |
| ACA-13 | Aplicar recuperação maior, menor, igual e repetir a mesma tentativa válida | Maior atualiza habilidade; menor/igual fica no histórico sem reduzir resultado. Recalcular média geral e conferir mínimos, sem alterar habilidades fora do plano, duplicar peso ou executar progressão. Preservar resultado antes/depois e avaliações originais. |
| ACA-14 | Conferir plano com fala e escrita e contagens válidas diferentes; repetir consulta/registro | Exibir/conferir limite de cada habilidade no nível da matrícula, sem consumo de habilidade alheia, contador global do aluno ou duplicação por repetição. Limite esgotado de fala não esgota escrita; eventos de reserva, consumo e liberação seguem Q137. |
| ACA-15 | Professor prepara plano; gestão prepara outro; tentar autoaprovar ou alterar plano aprovado | Exigir aprovador distinto autorizado em ambos os casos, revalidando vínculo, versão e limites. Mudança relevante exige nova aprovação; rascunho ou decisão comum de progressão não substitui autorização do plano. Preservar autoria real. |
| ACA-16 | Aprovar internamente sem disponibilizar; disponibilizar com condições; repetir envio; vencer prazo ou solicitar prorrogação | Iniciar contagem somente na disponibilização efetiva com condições, registrar início/limite e informar aluno. Repetição não reinicia prazo. Prorrogação exige motivo e outro aprovador autorizado; indisponibilidade da escola gera pendência/revisão, sem presumir falta ou zero. Vencimento isolado não consome tentativa nem aprova. |
| ACA-17 | Reservar simultaneamente o último saldo; realizar, faltar, cancelar dentro/fora do prazo e cancelar pela escola; repetir eventos | Impedir reserva acima do limite por habilidade e duplicação de consumo/liberação. Realização consome mesmo sem melhora; falta/tardio consomem sem zero/presença; tempestivo ou escola liberam. Preservar ocorrência e regra aplicada; simples vencimento não consome. |
| ACA-18 | Tentar progredir com mínimo geral ou individual insuficiente, inclusive após recuperação ou com exceção de frequência | Bloquear progressão por insuficiência de nota, sem caminho de dispensa administrativa. Preservar notas e histórico; não criar tentativa extra, avaliação, alteração financeira ou mudança automática de nível. |
| ACA-19 | Registrar resultado de avaliação externa e acessar área do aluno | Permitir registro por responsável autorizado com regras de notas/habilidades aplicáveis. Não exigir nem oferecer entrega/prova acadêmica no portal por este módulo; manter entregas das reposições por gravação no fluxo próprio. Não gerar nota por simples disponibilização. |
| ACA-20 | Professor sugere regra; gestão prepara; preparador tenta publicar e outra pessoa autorizada aprova | Sugestão não publica regra; exigir proposta da Gestão Pedagógica e aprovação independente autorizada. Preservar versão aprovada, autoria e condições; publicar não altera resultados ou regras de turmas existentes silenciosamente. |
| ACA-21 | Publicar regra com turmas novas, não iniciadas, em andamento e concluídas | Novas usam nova versão; não iniciadas só migram mediante revisão/aprovação independente. Bloquear migração de regra em turma já iniciada, sem depender de lançamento tardio de diário/notas. Preservar regras e resultados das turmas em andamento e concluídas. |
| ACA-22 | Professor submete avaliação; tenta oficializá-la sozinho; gestão confere | Exigir pessoa distinta autorizada para oficializar cada avaliação. Preservar notas ausentes como pendentes, autoria e versão conferida; rascunho não se torna resultado oficial. Não executar mudança de nível ou presumir divulgação ao aluno. |
| ACA-23 | Aluno consulta avaliação oficial e rascunho, consolidado incompleto e outra matrícula/aluno | Exibir somente dados autorizados do próprio aluno/matrícula e avaliações oficiais, comentários destinados a ele e pendências. Distinguir parcial/final; preservar frequência e regularizações sem duplicar. Bloquear dados alheios, rascunhos e anúncio de progressão não aprovada. |
| ACA-24 | Corrigir nota oficial para valor menor; autoaprovar; corrigir após progressão executada | Exigir proposta de responsável vigente/gestão e aprovação independente; manter anterior até aplicação válida. Preservar histórico e recalcular efeitos, sem aplicar regra de melhor recuperação a um erro. Abrir pendência para progressão afetada, sem mover aluno ou desfazer matrícula automaticamente. |
| ACA-25 | Responsável financeiro solicita consulta acadêmica ou conta no portal | Exigir conferência de autorização para atendimento pela equipe; não criar acesso acadêmico automático por vínculo financeiro nem conta/área de responsável neste recorte. Preservar acesso próprio do aluno. |
| ACA-26 | Aluno não realiza avaliação; escola deixa de oferecê-la; segunda chamada autorizada é realizada | Manter pendência sem zero, distinguir responsabilidade da escola e exigir proposta/aprovação independente. Nota obtida preenche avaliação original, sem duplicar peso, consumir recuperação ou regularizar frequência por inferência. Não criar cobrança adicional. |
| ACA-27 | Conferir limites de duas avaliações pendentes e de outro contrato | Manter contagens por avaliação/matrícula, sem esgotar oportunidades alheias ou consumir recuperação/particulares. Não consumir por cancelamento ou falta de oferta da escola; exigir quantidade configurada sem padrão oculto. |
| ACA-28 | Disputar última oportunidade e repetir eventos de realização/falta/cancelamento | Impedir excesso e duplicação de reserva/consumo. Realização fornece nota original; falta/tardio consomem mantendo nota pendente; tempestivo/escola liberam. Preservar ocorrência e antecedência aplicada; não consumir limite de recuperação. |
| ACA-29 | Aprovar sem disponibilizar; disponibilizar com condições; vencer prazo; prorrogar | Iniciar relógio somente com disponibilização e condições, registrar/informar limite e impedir reinício por repetição. Exigir justificativa e outro aprovador na prorrogação. Vencimento isolado não consome nem gera zero/falta; impedimento da escola gera pendência/revisão. |
| ACA-30 | Esgotar limite e propor quantidade extra; tentar autoaprovar ou reaplicar decisão | Exigir aprovação independente e identificar contexto, quantidade, motivo/evidências. Acrescentar autorização específica sem apagar consumo, duplicar crédito de oportunidade ou alterar limite de outros alunos/habilidades; manter notas e demais aprovações. |
| ACA-31 | Pausar um contrato com avaliação antiga sem lançamento e recuperação futura; liberar pendência específica | Manter leitura e regularização da avaliação anterior; bloquear realização futura sem autorização específica válida. Liberação não amplia para outras pendências, contratos, gravações ou cobrança; limites e aprovações continuam exigidos. |
| ACA-32 | Professor sai com avaliação pendente; gestão designa substituto | Liberar somente avaliações atribuídas ao novo professor, registrar motivo e preservar autoria real anterior. Não alterar prazos/limites ou permitir autooficialização/correção; professor anterior não recupera acesso de edição. |
| ACA-33 | Transferir entre turmas com avaliações/regras diferentes | Exigir mapeamento e aprovação independente de equivalência; conservar notas/autoria de origem e identificar exigências pendentes no destino. Impedir dupla ponderação e nota inventada; não alterar regras da turma ou dispensar mínimos. Execução da transferência conserva fluxo aplicável. |
| ACA-34 | Fechar consolidado com pendências; fechar resultado completo insuficiente; alterar por recuperação/correção posterior | Bloquear fechamento incompleto; exigir confirmação da gestão. Admitir final insuficiente sem aprovar progressão ou encerrar contrato/cobrança. Nova alteração autorizada gera versão rastreável, preservando resultado e fechamento anteriores. |

## 5. Pendências de refinamento

- Q124–Q154 estão respondidas. Revisar integrações e critérios técnicos antes de declarar o corpo de entrega pronto; novas lacunas de negócio devem ser apresentadas, sem presumir respostas.
- Instrumentos e valores configurados de escala, pesos e mínimos. Representação numérica, etapas, cobertura, composição, requisitos de nota e frequência já aprovados em Q125–Q131.
- Q146 define segunda chamada para avaliação não realizada; ausência de lançamento de avaliação já realizada exige regularização, sem inventar nota. Q138 veda exceção de nota.
- Lançamento, conferência, correção, substituição e fechamento definidos em Q142/Q144/Q152/Q154. Detalhar operações, estados e validações preservando atribuição e histórico.
- Q145 fecha o recorte de responsáveis: atendimento pela equipe aos autorizados, sem portal próprio nesta entrega. Q143 mantém o portal acadêmico do aluno.
- Corpo de entrega, dependências, operações concretas e migração dos registros existentes após decisões suficientes.

Estas são lacunas identificadas, não opções aprovadas nem notas/valores pendentes que possam ser preenchidos por conveniência. Não confundir esta avaliação acadêmica com remuneração docente, cobrança por hora ou avaliação financeira.


## Incremento 230 — Núcleo de cálculo das avaliações, 12/09/2026

Implementado src/server/avaliacoes/calculo.ts como função interna pura, com contexto explícito de matrícula, nível e versão. Calcula média ponderada direta por avaliação/habilidade (Q128), média geral com pesos próprios (Q129) e mínimos geral/individuais (Q130). Notas ausentes ou não oficializadas mantêm resultado dependente pendente; habilidades não avaliadas em um instrumento não recebem zero. Final pode distribuir as quatro habilidades entre instrumentos.

Cálculo usa frações exatas de decimais textuais e retorna numerador/denominador serializáveis, evitando aprovação por arredondamento. Validação técnica exige pesos positivos, escala crescente, mínimos/notas na escala, identificadores únicos e cobertura final completa. Limite técnico de 100 caracteres por decimal não define escala pedagógica. Memória conserva avaliação, etapa e peso; rascunhos não são apresentados como notas oficiais.

Doze testes unitários direcionados passaram; TypeScript, lint dos arquivos e diff check aprovados. Evidência: docs/validacao-calculo-avaliacoes-230-2026-09-12.json. Sem migration. Não houve regressão integral ou build neste incremento (últimos: 221 e 228).

Implementação parcial: ainda não integrada à persistência, autorização por matrícula, publicação de regras, lançamento/oficialização, recuperação, equivalência, frequência, fechamento ou portal. O chamador futuro deverá carregar somente a versão e notas autorizadas do contexto. A função não constitui fechamento final nem autorização de progressão. Não houve produção ou envio externo.


## Incremento 231 — Efeito da recuperação no cálculo, 12/09/2026

Núcleo de cálculo recebe resultados de recuperações vinculadas ao contexto de matrícula/nível/versão e ao plano aprovado. Aplica máximo entre resultado vigente e nota oficial da tentativa (Q133), em ordem histórica explícita, preservando resultado original e memória de cada tentativa com antes/depois. Recalcula média geral e mínimos sem introduzir peso adicional de recuperação na média regular. Habilidades fora do plano são recusadas.

Notas de recuperação ausentes ou não oficializadas não alteram o resultado vigente e aparecem como pendências. Recuperação não substitui avaliação original ausente: mantém a habilidade pendente para regularização própria. Identificadores/ordens duplicados, colisão com avaliação regular, nota fora da escala e contexto diferente são recusados. Recalcular a mesma fonte produz o mesmo resultado; uma fonte corrigida pode diminuir o resultado antes calculado, sem perpetuar uma nota errada como melhor resultado histórico.

Vinte e sete testes unitários passaram (12 anteriores e 15 novos), além de TypeScript, lint direcionado e diff check. Evidência: docs/validacao-recuperacao-calculo-231-2026-09-12.json. Sem migration, build ou regressão integral neste incremento.

Limite: função interna não comprova aprovação pela existência de um ID. Integração futura deverá carregar planos, notas e ordem do histórico autorizado; nenhuma ação pública permite fornecer esses dados. Persistência, aprovação/oficialização, consumo de oportunidades, correções versionadas, frequência, fechamento e portal permanecem pendentes. O indicador completa descreve as notas regulares disponíveis; recuperacoesPendentes é separado e nenhum dos dois autoriza fechamento/progressão por conta própria.


## Incremento 232 — Regras de avaliação versionadas e conferência, 12/09/2026

Migration 105 (20260913030000_regras_avaliacao) cria VersaoRegraAvaliacao por nível/idioma e DecisaoRegraAvaliacao, com propostas e decisões imutáveis, relações restritas e autor/data/motivo. Gestão Pedagógica/Administração prepara; outra pessoa da Gestão Pedagógica/Administração decide. Autoaprovação, inclusive por acúmulo de papéis, é recusada no servidor e no banco. Bloqueio por nível serializa versões/publicações; chaves idempotentes impedem duplicação de proposta. Decisão exige hash da versão normalizada e publicação só aceita proposta mais recente. Rejeitar versão posterior mantém a última aprovada.

Conteúdo inclui escala, pesos e mínimos por habilidade/geral, frequência mínima, instrumentos intermediários/finais, habilidades por instrumento, limite de recuperações por habilidade e segundas chamadas por avaliação, prazos e antecedências independentes. Todos os valores pedagógicos são obrigatórios, sem padrões ocultos. Validação exige pesos positivos, quatro habilidades, escala coerente e cobertura final completa; permite instrumentos finais distribuídos. Durações armazenadas em minutos inteiros explícitos; limites podem ser zero, prazos de realização devem ser positivos. Limites técnicos de tamanho não constituem parâmetros pedagógicos.

Rotas /academico/regras e /academico/regras/[nivelId] oferecem busca paginada por idioma/nível, formulário com campos próprios, histórico e revisão integral antes da decisão. Formulário novo deixa valores pedagógicos em branco; nova versão pode partir do conteúdo anterior sem sobrescrevê-lo. Link aparece para gestão/Administração no acadêmico; ações e consultas revalidam papéis ativos. Histórico não expõe chave idempotente ou hash de entrada. Consulta serializa com mutações para apresentar versão publicada e histórico coerentes.

Validação local: 40 unitários (27 do cálculo e 13 da configuração), 10 integrações, TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 47 páginas estáticas e duas novas rotas dinâmicas. Integrações conferem persistência, imutabilidade, autorizações, autoaprovação direta no banco, reenvios concorrentes, decisões opostas concorrentes, hash divergente, versões superadas, revogação, paginação e separação por nível. Evidência: docs/validacao-regras-avaliacao-232-2026-09-12.json. Sem regressão integral neste incremento; última integral permanece 221.

Limitações abertas: publicação ainda não atribui versão às turmas novas ou migra turmas não iniciadas (Q141); não altera turmas existentes. Persistência de notas, oficialização, oportunidades, frequência, equivalência, fechamento e portal continuam pendentes. Sugestões docentes não possuem fluxo próprio nesta tela. Ensaio interativo não executado; build e testes de servidor não equivalem a homologação da interface. Migration aplicada somente ao banco local descartável de teste; nenhuma operação em produção ou envio externo.


## Incremento 233 — Versão de avaliação na criação da turma, 12/09/2026

Migration 106 (20260913040000_regra_inicial_turma) acrescenta referência à versão de avaliação na turma. Na criação de turma planejada/aberta com início futuro, banco seleciona a última versão publicada do respectivo nível, serializando com a publicação. Propostas pendentes/rejeitadas não substituem a publicada. A seleção comum cobre formulário e importação XLSX. Eventos TurmaCriada/TurmaImportada incluem a referência escolhida; painel de turmas mostra a versão ou pendência de vinculação.

Turmas existentes não são preenchidas retrospectivamente. Datas históricas/desconhecidas e turmas criadas em estado iniciado/concluído permanecem pendentes de conferência, sem presumir que usaram a regra atual. Ausência de publicação conserva referência nula; não cria regra padrão. Publicar nova versão não altera turmas anteriores, estejam planejadas, em andamento ou concluídas. Edição direta não pode substituir/remover vínculo nem trocar o nível de turma vinculada. Fluxo de revisão e aprovação para turma não iniciada continua pendente; bloqueio atual não é sua implementação.

Cadastro e cada linha importada conferem papel ativo após bloqueio de publicação e conservam leitura compartilhada do usuário durante a transação. Trigger rejeita seleção livre da regra inicial, troca direta e incompatibilidade de nível. Consulta de turmas retorna somente id/versão da regra para apresentação resumida.

Validação: 36 integrações aprovadas em três arquivos (6 vínculo, 10 regras, 20 integridade acadêmica); depois do reforço transacional de permissões, as 6 de vínculo foram repetidas e passaram. Casos cobrem formulário, importação real de XLSX fictício em memória, histórico, rascunho sem regra, outro nível, imutabilidade do vínculo e publicação concorrente. Schema diff vazio; TypeScript, lint direcionado e build Next.js 16.3.5 (47 páginas estáticas) aprovados. Evidência: docs/validacao-regra-turma-233-2026-09-12.json. Sem regressão integral; última permanece 221. Não houve produção ou uso de planilhas reais.

Pendente: migração aprovada das turmas não iniciadas, conferência do legado, bloqueios dos fluxos de avaliação quando falta regra, lançamento/oficialização, oportunidades, frequência, fechamento, portal e ensaio interativo. Atribuir uma regra não oficializa notas nem autoriza progressão.


## Incremento 234 — Migração aprovada de regra antes do início, 12/09/2026

Migration 107 (20260913050000_migracao_regra_turma) cria proposta e decisão imutáveis da migração da regra de avaliação da turma. Gestão Pedagógica/Administração revisa e propõe; outra pessoa autorizada decide. Aprovação aplica a nova referência na mesma transação da decisão, com evento. Rejeição preserva a regra anterior. Chave idempotente, versão de proposta e hash da revisão impedem repetição com outro conteúdo ou aprovação de impacto desatualizado.

Revisão conserva regra de origem/destino, dados da turma, agenda e alocações. Consulta oferece conteúdos anterior/novo, campos alterados, quantidades afetadas e versão/hash da revisão. Mudança de agenda/alocação/contexto ou nova publicação exige nova revisão/proposta. Destino deve ser a última publicação do mesmo nível, posterior à regra atual. Primeira vinculação de turma futura sem regra também exige aprovação. Histórico paginado preserva decisões e indica quando uma proposta pendente já não pode ser aplicada, sem expor chave idempotente ou snapshot de alocações.

Bloqueios do calendário, nível e turma coordenam proposta/decisão com a agenda; papel ativo é conferido após a espera. Início é verificado pelo estado, encontro previsto passado, qualquer encontro ministrado, diário legado ou evento de início. Sem agenda publicada, exige data inicial futura conhecida. Data inicial de referência passada pode ser aceita somente com agenda publicada que ainda não iniciou, conforme diferença entre data de referência e primeiro encontro. SQL protege imutabilidade, independência, destino, regra de origem e impedimento de início; atualização direta da referência continua proibida fora da decisão aprovada.

Validação: 28 integrações aprovadas em três arquivos (12 migração, 6 vínculo inicial, 10 regras), TypeScript, lint direcionado, schema diff vazio e diff check. Houve duas correções de fixtures durante o teste: professor obrigatório no encontro publicado e chave idempotente distinta por nível; a execução final passou integralmente. Evidência: docs/validacao-migracao-regra-234-2026-09-12.json. Sem build ou regressão integral neste incremento; últimos permanecem 233 e 221. Migration aplicada somente ao banco local descartável.

Limitações: ações/consultas de servidor prontas, tela específica de migração e ensaio interativo pendentes. Não regulariza histórico de turmas já iniciadas sem regra. Futuro registro de avaliações deverá participar da conferência de impactos e dos bloqueios; persistência de notas ainda não existe neste módulo. Frequência, oportunidades, equivalências, fechamento e portal permanecem incompletos. Não houve produção, importação de dados reais ou envio externo.


## Incremento 235 — Tela de migração e regressão consolidada, 12/09/2026

Rota /academico/regras/turmas/[turmaId], acessível pela indicação de regra no painel de turmas, permite revisar origem/destino, campos alterados, quantidades de encontros e alocações registradas, enviar proposta com motivo e decidir de forma independente. Histórico mostra conteúdos completos das duas regras, autoria/data/motivo e decisões. Proposta desatualizada não oferece aprovação; rejeição permanece disponível para outro gestor autorizado. Formulários bloqueiam campos durante operações e conservam a chave de tentativa quando o resultado da gravação é incerto.

Consulta de preparação seleciona a última publicação do nível e explica ausência de publicação, regra já atual ou impedimento pelo início/histórico. Consulta de histórico extrai contagens do snapshot original e omite o snapshot bruto, IDs das alocações e chaves de processamento. Assim, alocação posterior invalida a proposta sem reescrever o que foi revisado. Regras, papéis e contexto continuam revalidados no servidor ao confirmar.

Validação: 20 integrações direcionadas (14 migração, 6 vínculo), 761 unitários na execução integral, TypeScript e build Next.js 16.3.5 aprovados (47 páginas estáticas, nova rota dinâmica). Lint completo sem erros e com três avisos preexistentes: FinanceiroPainel.tsx 116/402 e Sidebar.tsx 38; lint direcionado aprovado. Banco local tem 107 migrations e schema diff vazio; nenhuma migration nova neste incremento.

Regressão de integração integral executou 579 testes: 578 passaram e um falhou por fixture dependente do horário em whatsapp/cron.int.test.ts. O teste fixava a mensagem às 23h01, podendo preceder a criação real da intenção. Corrigido para usar criação +/- 60 segundos e conferir inbound anterior e posterior; regra de produção do WhatsApp permaneceu preservada. Reexecução completa desse arquivo passou os 12 casos. A cobertura consolidada da última execução de cada arquivo é de 580 integrações aprovadas, sem falhas ou pendências; isso não representa uma segunda execução integral. Evidência detalhada por execução/arquivo: docs/validacao-regressao-235-2026-09-12.json.

Tela compilada e consultas/ações testadas; ensaio interativo ainda pendente. Registro/oficialização de notas, gestão de oportunidades, frequência, equivalências, fechamento e portal continuam incompletos. As contagens de teste não comprovam atendimento integral de Q124–Q154 ou do objetivo geral. SPEC central atualizada para discriminar o avanço acadêmico. Sem produção, dados reais ou envio externo.


## Incremento 236 — Lançamento e oficialização de avaliações, 12/09/2026

Migration 108 (20260913060000_lancamento_avaliacao), aplicada somente ao banco local descartável, cria registro por matrícula/turma/avaliação, versões imutáveis do lançamento e decisão independente. O professor titular com atribuição vigente registra notas e comentário destinado ao aluno; rascunho permite nota ausente, submissão exige todas as habilidades previstas e notas na escala da regra vinculada. A data deve corresponder ao vínculo histórico conferido do aluno e do professor e à situação contratual elegível. Ausência não vira zero.

Outra pessoa ativa da Gerência Pedagógica/Administração oficializa ou devolve a submissão. Aprovação exige a versão mais recente e o conteúdo conferido. Reenvio idêntico não duplica o lançamento; versão nova invalida aprovação da anterior. Nota já oficializada não pode ser sobrescrita pelo lançamento normal: exige o futuro fluxo de correção. Banco protege imutabilidade, contexto matrícula/alocação/turma, sequência e independência das decisões. Bloqueios coordenam gravação com matrícula e turma; permissões são revalidadas dentro da transação.

Consulta paginada limita o professor atual à turma atribuída; professor anterior pode consultar somente versões de sua autoria, sem recuperar edição. Gestão autorizada consulta os registros. A projeção omite dados financeiros, contatos e chaves de processamento. Registro segue a matrícula da alocação, sem alcançar outro contrato do mesmo aluno. Migração de regra passa a bloquear turmas com registros de avaliação, preservando o histórico até existir revisão específica desse impacto.

Validação: 11 integrações novas passaram isoladamente; execução conjunta de quatro arquivos acadêmicos passou 41 testes (11 lançamentos, 14 migração, 6 vínculo inicial, 10 regras). TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 (47 páginas estáticas) aprovados. Evidência: docs/validacao-lancamentos-236-2026-09-12.json. Última regressão integral/consolidada permanece a do incremento 235.

Limitações explícitas: esta entrega implementa persistência, ações e consulta de servidor, sem tela de lançamento ou portal de notas. Falta conectar notas oficiais ao consolidado, implementar correções, responsáveis designados, avaliações históricas de matrícula encerrada, autorizações específicas durante pausa/encerramento, oportunidades, equivalência, frequência e fechamento. Registros com histórico insuficiente ficam bloqueados para conferência; esse bloqueio não implementa os fluxos faltantes. Não houve homologação interativa, produção, importação real ou envio externo.


## Incremento 237 — Telas de lançamento e conferência, 12/09/2026

Rotas /academico/avaliacoes/[alocacaoId] e /academico/avaliacoes/[alocacaoId]/[codigo] oferecem seleção da avaliação, lançamento de notas por habilidade e comentário destinado ao aluno, rascunho/submissão, histórico paginado e conferência independente. A ficha acadêmica fornece acesso por vínculo de matrícula aos papéis professor e gestão; Secretaria não recebe esse acesso de notas.

Consulta prepara configuração, escala, versão esperada e ações disponíveis. Apenas a versão submetida mais recente permite aprovação; versões anteriores ainda podem ser devolvidas. Autoaprovação não é oferecida, inclusive com papéis acumulados. Resultado oficial impede lançamento normal e informa a necessidade de correção aprovada. Todas as operações mantêm as validações transacionais do incremento 236. Formulários bloqueiam campos durante envio, preservam chave de reenvio incerto e atualizam o histórico após confirmação.

Professor anterior consulta somente avaliações em que possui lançamento e somente suas próprias versões; essa leitura não permite novos lançamentos. A projeção não contém telefone, e-mail, responsável financeiro ou chaves de processamento. A avaliação em outra turma/contrato continua sujeita à autorização da consulta; links não concedem acesso.

Validação: 12 integrações do arquivo lancamentos.int.test.ts aprovadas, incluindo seleção restrita do ex-professor, bloqueio da Secretaria, ações por autoria/versão e omissão de campos privados. TypeScript, lint direcionado, build Next.js 16.3.5 (47 páginas estáticas e duas novas rotas dinâmicas) e diff check aprovados. Sem migration nova. Evidência: docs/validacao-telas-avaliacoes-237-2026-09-12.json. Última regressão ampliada acadêmica: 236; integral/consolidada: 235.

Limites: telas compiladas, ainda sem ensaio interativo. Data de realização e histórico usam UTC explicitamente identificado; preferência de fuso nessa tela ainda precisa ser integrada. Navegação pela ficha lista vínculos ativos; acesso navegável ao histórico de vínculos encerrados ainda precisa ser completado. Consolidação de notas oficiais, correção, designação limitada, recuperação/segunda chamada, equivalência, frequência, fechamento e portal do aluno permanecem incompletos. Não houve produção, dados reais ou envio externo.


## Incremento 238 — Consolidação das avaliações regulares, 12/09/2026

Consulta consultarConsolidadoAvaliacoes carrega regra publicada vinculada à turma e lançamentos da matrícula correspondente, sob os bloqueios de matrícula/turma e conferência do papel ativo. Professor titular atual e gestão acessam o conjunto; autoria histórica isolada não concede leitura do consolidado completo. Registros de outra alocação/regra impedem cálculo até conferência de aproveitamento.

Notas oficiais alimentam o cálculo exato por habilidade e a média geral, com os pesos da regra preservada. Notas ausentes ou aguardando conferência produzem pendências e não recebem zero. A consulta retorna referências das fontes e memória do cálculo, sem comentários privados ou dados financeiros. A regra atual impede novas versões normais após oficialização; a futura correção deverá atualizar a seleção de fontes de forma explícita.

Tela de avaliações do vínculo mostra resultados regulares, mínimos individuais/geral e composição por avaliação. Valores são apresentados com duas casas decimais; comparação de mínimos permanece exata, sem usar o arredondamento da tela. O título e os avisos distinguem acompanhamento regular de fechamento, recuperação, frequência e decisão de progressão.

Validação: 13 integrações do arquivo de lançamentos passaram após corrigir uma asserção do teste que comparava uma lista de quatro habilidades com lista de tamanho um. Teste de consolidação confere pendência antes da oficialização, pesos publicados, média exata e bloqueio de professor sem vínculo. TypeScript, lint direcionado e build Next.js 16.3.5 com 47 páginas estáticas aprovados. Sem migration nova. Evidência: docs/validacao-consolidado-238-2026-09-12.json.

Limites: acompanhamento consultado em tempo real, sem fechamento/versionamento do resultado final. Recuperações persistidas, correções, equivalências, frequência e oportunidades ainda precisam integrar o consolidado; nenhuma aprovação automática foi acrescentada. Portal do aluno e ensaio interativo permanecem pendentes. Sem produção ou dados reais. Regressão integral/consolidada de referência continua 235.


## Incremento 239 — Navegação de vínculos e histórico docente, 12/09/2026

Painel /academico/avaliacoes, ligado ao Diário e à área acadêmica, lista vínculos atuais e histórico com lançamentos. A seleção identifica aluno, matrícula, nível e turma; não inclui telefone, e-mail, financeiro ou notas na listagem. Consulta paginada de 20 itens revalida usuário ativo e papéis em transação. Gestão consulta os vínculos permitidos ao papel; professor consulta atuais sob sua atribuição ou históricos que contenham versões de sua autoria.

Histórico inclui alocações encerradas sem depender de abrir a ficha atual do aluno. Abrir o vínculo continua sujeito às consultas de avaliações e versões: professor anterior somente lê suas próprias versões. O painel não concede escrita, consolidado de outras pessoas, nova atribuição ou reativação da matrícula. A aba histórica pode incluir vínculo ainda ativo quando já possui registros; seu significado é histórico com lançamentos, não apenas vínculos encerrados.

Validação: 14 integrações do arquivo lancamentos.int.test.ts aprovadas. Caso novo cobre histórico vazio antes de lançar, saída do professor, encerramento da alocação, leitura própria, negação de consolidado amplo, ausência de histórico para outro docente, acesso da gestão e usuário desativado. TypeScript, lint direcionado, diff check e build Next.js 16.3.5 com 48 páginas estáticas aprovados; nova rota do painel é dinâmica. Sem migration nova.

Limites: acesso navegável ao histórico implementado; ensaio interativo ainda pendente. Não resolve atribuição específica a substitutos, correção, oportunidades, frequência, fechamento ou portal do aluno. Preferência de fuso das telas permanece pendente. Evidência: docs/validacao-painel-avaliacoes-239-2026-09-12.json. Regressão integral/consolidada de referência: 235. Sem produção, dados reais ou envio externo.


## Incremento 240 — Fuso no lançamento e histórico da avaliação, 12/09/2026

Detalhe da avaliação permite escolher um fuso regional válido, com sugestões Brasil, Costa Rica e UTC. Escolha afeta entrada e apresentação de horários, conservada nos links de paginação da tela. Datas registradas são convertidas para preencher o formulário e mostrar autoria/decisões; trocar visualização não grava alterações. A tela orienta salvar rascunho antes da troca.

Ação salvarLancamentoAvaliacaoLocal valida data local e fuso no servidor, converte para instante UTC e chama a mesma transação autorizada de lançamento. Preserva segundos e milissegundos. Não escolhe silenciosamente horários inexistentes/ambíguos em mudanças de horário de verão; exige revisão ou equivalente conferido em UTC. Não altera a regra do calendário institucional ou o fuso da turma.

Validação: 10 unitários de conversão aprovados, incluindo Brasil, Costa Rica, Nepal, virada de data, milissegundos, datas inválidas e horário de verão; 15 integrações de lançamentos aprovadas, com novo caso de conversão no servidor, reenvio idempotente e negação a outro professor. TypeScript, lint direcionado, build Next.js 16.3.5 com 48 páginas estáticas e diff check aprovados. Evidência: docs/validacao-fuso-avaliacoes-240-2026-09-12.json. Sem migration nova.

Limites: escolha nesta tela é parâmetro da navegação, não preferência global persistida do usuário. Painel de vínculos e outras telas ainda têm referências UTC explícitas. Integração global da preferência e ensaio interativo permanecem pendentes. Não conclui correções, recuperação, frequência, fechamento ou portal. Sem produção, dados reais ou envio externo. Última regressão integral/consolidada: 235.


## Incremento 241 — Propostas de correção de notas oficiais, 12/09/2026

Migration 109 (20260913070000_proposta_correcao_nota), aplicada somente ao banco local descartável, cria proposta imutável vinculada ao lançamento oficial. Registra versão, autoria, novos valores/comentários, hash da origem e motivo. Professor com atribuição vigente ou gestão pode preparar; professor que saiu conserva somente leitura. Proposta admite reduzir nota incorreta, distinguindo correção de recuperação.

Ação e transação validam origem oficial, hash, escala e conjunto completo das habilidades, rejeitando proposta sem mudança. Chave idempotente e versão esperada impedem duplicação ou reescrita de tentativa com outro conteúdo. Banco protege imutabilidade, sequência, origem oficial e papel/atribuição. Evento CorrecaoNotaProposta acompanha a gravação na mesma transação. Notas oficiais e consolidado permanecem preservados; nenhuma decisão/aplicação é criada por este incremento.

Validação: 17 integrações de lançamentos aprovadas, incluindo duas novas de correção. Concorrência diretamente entre transações cria uma proposta; ação autenticada também confere reenvio. Duas execuções iniciais falharam no carregamento concorrente da autenticação simulada (next/server importado pelo next-auth); teste foi separado entre transação concorrente e ação autenticada, sem remover verificação de concorrência ou permissões. TypeScript, lint direcionado, schema diff vazio, build Next.js 16.3.5 (48 páginas estáticas) e diff check aprovados. Evidência: docs/validacao-proposta-correcao-241-2026-09-12.json.

Limites: somente preparação no servidor. Consulta/tela da proposta, decisão independente, aplicação dos valores, revisão dos efeitos em recuperação/equivalência/progressão e fechamento ainda precisam ser implementadas. Não declarar Q144 completo. Também pendem demais fluxos acadêmicos e ensaio interativo. Sem produção, dados reais ou envio externo. Última regressão integral/consolidada: 235.


## Incremento 242 — Decisão da correção e notas vigentes, 12/09/2026

Migration 110 (20260913080000_decisao_correcao_nota), aplicada ao banco local descartável, cria decisão imutável com aprovador, motivo e impactos. Outra pessoa da Gestão Pedagógica/Administração aprova ou rejeita. Aprovação exige proposta mais recente e origem vigente; chave de origem acompanha a última correção aprovada, permitindo correções sucessivas sem sobrescrever o lançamento original.

Revisão no servidor apresenta notas vigentes/propostas e solicitações acadêmicas aprovadas/executadas do vínculo. Hash dos impactos precisa continuar válido ao aprovar. Decisão e evento são atômicos; repetição da mesma decisão é idempotente, decisões conflitantes concorrentes não produzem dois resultados. Banco protege independência, papel ativo, sequência/origem e imutabilidade.

Consolidado regular passa a usar a última correção aprovada, inclusive quando reduz uma nota incorreta. Fontes identificam a correção utilizada. Detalhe apresenta valores originais e, separadamente, valores vigentes corrigidos para gestão/professor atual. Professor anterior conserva sua leitura histórica sem receber os valores lançados por outros em correções posteriores. Propostas rejeitadas não alteram resultado.

Validação: 19 integrações de lançamentos aprovadas, com nova cobertura de duas correções sucessivas, origem desatualizada, recalculação, autoaprovação no servidor/banco, versão antiga e decisões concorrentes. Reexecução após ampliar a cadeia também passou os 19 casos. TypeScript, lint direcionado, schema diff vazio, build Next.js 16.3.5 (48 páginas estáticas) e diff check aprovados. Evidência: docs/validacao-decisao-correcao-242-2026-09-12.json.

Limites: consulta/decisão de servidor e apresentação do valor vigente prontas, mas formulários de proposta/decisão e histórico completo de correções ainda pendentes. Impactos em mudanças acadêmicas são preservados na decisão e sinalizados por evento; fila operacional e resolução da revisão ainda não implementadas/testadas. Recuperação, equivalência e fechamento precisam participar da revisão ao serem implementados. Não declarar Q144 integralmente concluído. Sem ensaio interativo, produção, dados reais ou envio externo. Regressão integral/consolidada de referência: 235.


## Incremento 243 — Telas e histórico de correções, 12/09/2026

Rotas /academico/correcoes/[lancamentoId] e /academico/correcoes/[lancamentoId]/[propostaId] permitem preparar proposta, consultar histórico paginado e revisar notas/impactos antes de decidir. Acesso pelo detalhe da avaliação oficial; professor atual/gestão prepara e outra pessoa da gestão decide. Formulários mantêm chave de reenvio incerto, bloqueiam edição durante envio e atualizam consultas após confirmação.

Consulta do histórico recupera os valores da origem específica de cada proposta. Duas correções sucessivas mostram, por exemplo, 7 para 5 e depois 5 para 6, preservando a referência histórica. Notas vigentes alimentam a nova proposta. Proposta antiga não oferece aprovação na revisão, mas pode ser rejeitada quando ainda pendente e com outro decisor. Motivos, comentários e autoria ficam visíveis no contexto autorizado; chaves de processamento e dados financeiros/contatos são omitidos.

Validação: 19 integrações do arquivo de lançamentos aprovadas, ampliadas com comparação histórica em cadeia, paginação, ausência de campos privados e revogação do acesso de correção após saída docente. TypeScript, lint direcionado, diff check e build Next.js 16.3.5 com 48 páginas estáticas e duas rotas dinâmicas novas aprovados. Evidência: docs/validacao-telas-correcao-243-2026-09-12.json. Sem migration nova.

Limites: telas compiladas e consultas/ações testadas; ensaio interativo ainda pendente. Fila e resolução da revisão de impactos acadêmicos continuam pendentes; referências técnicas de solicitações nessa revisão ainda precisam de apresentação operacional. Datas das correções usam UTC explícito, sem preferência global integrada. Recuperação, equivalência, frequência, fechamento e portal permanecem incompletos. Q144 ainda não está integralmente concluído. Sem produção, dados reais ou envio externo. Regressão integral/consolidada de referência: 235.


## Incremento 244 — Fila de revisões após correção, 13/09/2026

Rota /academico/correcoes, ligada à área acadêmica, lista correções aplicadas com impactos em solicitações aprovadas/executadas. Consulta paginada revalida gestão ativa em transação e apresenta aluno/matrícula, correção, autoria/motivo, turma de destino e situação da solicitação no momento da correção e atualmente. Links conduzem ao histórico de correções e às mudanças acadêmicas da matrícula.

Fila deriva das decisões imutáveis com impactos, sem depender de localizar eventos. Não desfaz movimentações e não registra resolução automaticamente. Fonte atual da solicitação é conferida pelo vínculo de origem; referência ausente/incompatível aparece como pendência de conferência. Professor e Secretaria não recebem acesso à fila de gestão.

Validação: 20 integrações do arquivo de lançamentos aprovadas. Caso novo simula estado preexistente de mudança aprovada, identifica aprovação posterior à prévia, bloqueia hash antigo, aplica após nova revisão e verifica fila, evento e preservação da solicitação. O caso não valida o fluxo de aprovação da transferência. Primeira execução falhou por fixture sem motivo de decisão obrigatório; corrigida e reexecutada com sucesso. TypeScript, lint direcionado, diff check e build Next.js 16.3.5 (49 páginas estáticas e nova rota dinâmica) aprovados. Após o build, houve somente ajuste textual de orientação na página. Evidência: docs/validacao-fila-correcao-244-2026-09-13.json.

Limites: identificação e acompanhamento dos casos entregues; resolução/versionamento da revisão pedagógica e bloqueios correspondentes ainda pendentes. Fila ainda não diferencia casos resolvidos porque essa resolução não foi implementada. Integrações com recuperação, equivalência e fechamento permanecem pendentes, assim como ensaio interativo e preferência global de fuso. Q144 continua incompleto. Sem produção, dados reais ou envio externo. Regressão integral/consolidada de referência: 235.


## Incremento 245 — Regressão integral após avaliações e correções, 13/09/2026

Executadas as suítes completas contra o estado atual do código: 771 testes unitários e 600 integrações aprovados, sem falhas ou testes pendentes. Integrações rodaram em um único processo sequencial contra PostgreSQL local descartável; não se trata de soma de reexecuções parciais. Evidência por arquivo: docs/validacao-regressao-245-2026-09-13.json.

Lint completo terminou sem erros, com os três avisos preexistentes de react-hooks/set-state-in-effect: FinanceiroPainel.tsx linhas 116/402 e Sidebar.tsx linha 38. Build Next.js 16.3.5 aprovado com 49 páginas estáticas; TypeScript passou no build. Schema diff vazio em relação às 110 migrations aplicadas. Nenhuma alteração funcional neste incremento; relatórios temporários foram consolidados no artefato versionável.

Esta regressão substitui 235 como referência mais recente de verificação integral. Não prova requisitos ainda não implementados, homologação interativa das telas, integrações externas em operação ou migração de dados reais. Resolução das revisões por correção, oportunidades de avaliação, frequência, equivalência, fechamento, portal e demais frentes da SPEC continuam incompletos. Objetivo integral permanece ativo. Sem produção, dados reais ou envio externo.


## Incremento 246 — Integridade do conteúdo de notas no banco, 13/09/2026

Migrations 111/112 (20260913090000_integridade_notas e 20260913100000_corrigir_integridade_notas), aplicadas somente ao banco local descartável, conferem notas contra a regra do registro acadêmico também em gravações diretas. Validam conjunto e unicidade de habilidades, estrutura dos campos, comentário textual limitado, formato decimal e limites da escala. Rascunho permite nota ausente; submissão, correção e aprovação exigem conteúdo completo.

Triggers executam a conferência em lançamento/proposta e novamente na aprovação. A regra é carregada da versão vinculada ao registro, não da publicação mais recente do nível. Histórico existente não é reescrito. As restrições de papel, autoria, independência e imutabilidade anteriores permanecem.

Validação: primeira execução acadêmica teve 35 aprovações/20 falhas devido a alias SQL ambíguo na função nova, corrigido pela migration 112. Reexecução dos quatro arquivos acadêmicos passou 55 testes (25 lançamentos, 14 migração de regra, 6 vínculo e 10 regras). Cinco casos novos tentam inserir diretamente nota fora da escala, habilidade diferente, número JSON em vez de decimal textual, comentário em objeto e campo extra; cada caso verifica lançamento e correção, além de confirmar que os registros válidos continuam funcionando. TypeScript, lint direcionado, schema diff vazio e diff check aprovados.

Evidência: docs/validacao-integridade-notas-246-2026-09-13.json. Sem build novo por ser alteração SQL/testes; último build e regressão integral permanecem 245. Banco local agora tem 112 migrations. Não houve produção, dados reais ou envio externo. A integridade adicional não conclui resolução das revisões acadêmicas, oportunidades, frequência, equivalência, fechamento, portal ou homologação interativa.


## Incremento 247 — Identificação da matrícula nas avaliações, 13/09/2026

Detalhe da avaliação, proposta/histórico e revisão da correção exibem identificação consistente de aluno, matrícula, oferta, turma e nível antes da operação. Consulta mínima é executada somente após autorização do vínculo; não inclui contatos ou financeiro. Quando falta código de matrícula, a tela conserva referência única pelo identificador do registro, evitando identificação apenas pelo nome do aluno.

Validação: 25 integrações de lançamentos aprovadas, com asserções adicionais da matrícula correta no histórico de correção e ausência do identificador de outro contrato do mesmo aluno. TypeScript, lint direcionado, diff check e build Next.js 16.3.5 (49 páginas estáticas) aprovados. Após o build, o fallback para matrícula sem código recebeu somente ajuste de apresentação/tipagem, verificado novamente por TypeScript e lint. Evidência: docs/validacao-identificacao-avaliacao-247-2026-09-13.json.

Sem migration nova; banco permanece com 112 migrations. Última regressão integral: 245. Não altera autorização, regras de nota ou situação dos contratos. Pendem resolução das revisões, oportunidades, frequência, equivalência, fechamento, portal e homologação interativa. Sem produção, dados reais ou envio externo.

## Incremento 248 — Registro da designação de avaliador, 13/09/2026

Primeira parte de Q152: Gestão Pedagógica/Administração pode registrar um professor ativo para uma avaliação pendente identificada por matrícula, alocação e código da avaliação. A designação é versionada, com motivo, autoria, chave de idempotência e controle de versão esperada. Revogar cria uma nova versão com destinatário vazio; não apaga a designação anterior. Não troca o professor titular da turma nem a autoria dos lançamentos anteriores.

Migration 113 (20260913110000_designacao_avaliacao) protege registros contra atualização/exclusão e confere gestão ativa, professor ativo, sequência de versões e ausência de nota oficial. A ação também confere regra, avaliação e vínculo correspondente. Registro criado somente para designação já impede a migração da regra da turma pelo bloqueio conservador existente; revisar esse caso antes de oferecer migração de regra com designações pendentes.

Validação: 27 integrações de lançamentos aprovadas, incluindo designação/revogação, repetição idempotente, preservação de titular/autoria, imutabilidade e rejeição de solicitante sem papel, destinatário sem papel docente, avaliação inexistente e avaliação oficializada. TypeScript, lint direcionado e schema diff vazio aprovados. Evidência: docs/validacao-designacao-avaliacao-248-2026-09-13.json. Migration aplicada somente ao banco local descartável; último build permanece 247 e última regressão integral 245.

Limite explícito: a designação ainda NÃO concede acesso nas consultas, lançamentos ou telas. Falta conectar o avaliador vigente às permissões limitadas da avaliação, preservar a distinção entre responsável pela realização e pelo lançamento histórico e oferecer operação pela interface. Q152 permanece parcialmente implementada. Também permanecem pendentes oportunidades, frequência, equivalência, fechamento, portal e homologação interativa. Sem produção, importação de dados reais ou envio externo.

## Incremento 249 — Consulta limitada do avaliador designado, 13/09/2026

Q152 avança da persistência para a consulta: professor ativo com a designação mais recente consulta as versões da avaliação pendente atribuída, com autoria original e contexto mínimo da matrícula. A lista do vínculo mostra somente códigos designados ou histórico próprio, salvo acesso já concedido por outro papel/vínculo. Troca ou revogação posterior invalida a designação anterior; conclusão por oficialização encerra esse acesso delegado à pendência. Histórico próprio continua seguindo sua regra de leitura.

Painel de avaliações oferece “Avaliações designadas a mim”, com paginação no banco e conferência da última designação. A consulta não abre avaliações não designadas, outro contrato do mesmo aluno, consolidado do nível ou permissões de gestão. Conferência do usuário/papel atual e das designações ocorre na transação coordenada com as alterações do vínculo.

Validação final: 29 integrações de lançamentos aprovadas, incluindo consulta, identidade/autoria, isolamento de código e matrícula, negativa do consolidado, painel/paginação, troca/revogação, retirada de papel, inativação e encerramento do acesso delegado após oficialização. Primeiro ensaio encontrou enum incorreto no fixture do teste (SECRETARIA); corrigido para SECRETARIA_ACADEMICA antes das reexecuções. TypeScript, lint direcionado e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-acesso-avaliador-249-2026-09-13.json.

Não há migration nova. Última regressão integral permanece 245. Falta liberar escrita pelo substituto com distinção entre quem realizou a avaliação e quem registra a regularização histórica, bem como a interface de gestão das designações. Q152 segue parcial. Demais fluxos acadêmicos e frentes da SPEC permanecem em implementação; não houve homologação interativa, produção, dados reais ou envio externo.

## Incremento 250 — Gestão de designações pela interface, 13/09/2026

Detalhe da avaliação oferece à Gestão Pedagógica/Administração a tela de designações, identificando matrícula, aluno, oferta, turma e avaliação. A consulta própria exige papel de gestão atualizado e valida a regra/vínculo. Exibe última designação e histórico paginado com professor, gestor, motivo e data; não retorna chaves de idempotência, hashes, contatos ou credenciais.

Equipe busca professores ativos por nome (até 50 resultados, com indicação para refinar a busca), seleciona novo responsável ou revogação explícita e informa motivo. A ação existente revalida papel, versão esperada e estado da avaliação. Formulário conserva chave de idempotência ao repetir tentativa de resultado incerto; mudar os dados gera nova tentativa. Oficialização deixa a tela somente para histórico e retira opções de alteração.

Validação: 30 integrações de lançamentos aprovadas. Novo caso verifica negativa ao professor, seleção apenas de docentes ativos, contexto da matrícula, histórico/autoria, paginação, ausência de campos internos e bloqueio após oficialização. TypeScript, lint direcionado e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-tela-designacoes-250-2026-09-13.json.

Sem migration nova; última regressão integral permanece 245. Q152 continua parcial: falta lançamento pelo substituto com autoria da realização separada da autoria da regularização histórica; a tela e consulta não habilitam escrita por consequência. Demais fluxos acadêmicos e frentes da SPEC seguem pendentes. Build não substitui homologação interativa, ainda não realizada. Sem produção, dados reais ou envio externo.

## Incremento 251 — Lançamento pelo substituto e autoria histórica, 13/09/2026

Avaliador com designação vigente pode lançar a avaliação atribuída. Servidor e banco conferem a atribuição atual do registrador e a atribuição do realizador na data informada (vínculo docente ou designação histórica válida). Regularizar trabalho de outro professor exige designação vigente, identificação do realizador, motivo e evidências textuais. Autoria da realização e do lançamento ficam separadas na versão imutável e no hash do conteúdo conferido. Registros antigos e seus hashes permanecem intactos, com campos novos opcionais para o histórico anterior.

Tela permite escolher o realizador entre os docentes vinculados/designados à avaliação e informar motivo/evidências quando outra pessoa a realizou. Histórico apresenta ambas as autorias e os dados da regularização. Revogação bloqueia novos lançamentos do substituto sem outro vínculo vigente; nota oficial continua exigindo correção independente. Conferência não pode ser feita nem pelo registrador nem pelo realizador, mesmo acumulando papel de gestão. Eventos de rascunho/submissão acrescentam realizadaPorId e indicador regularizacao, mantendo os textos na versão protegida.

Migrations 114/115 (20260913120000_autoria_avaliacao e 20260913130000_utc_autoria_avaliacao) aplicadas somente ao PostgreSQL local descartável. O teste com realização atual encontrou comparação incorreta entre timestamp UTC e clock_timestamp no fuso da sessão America/Sao_Paulo; migration 115 torna explícita a referência UTC nessas funções. Não houve alteração global de fuso do banco.

Validação final: 62 integrações acadêmicas aprovadas em execução única dos quatro arquivos (32 lançamentos, 14 migração de regra, 6 vínculo e 10 regras). Novos casos cobrem realização pelo designado, regularização de titular anterior, exigência de motivo/evidência, repetição idempotente, autoria preservada, bloqueio de conferência pelos dois participantes e rejeição de gravação direta após revogação. Primeiro ensaio de lançamentos teve 31 aprovações e uma falha de fuso, depois corrigida. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-autoria-avaliacao-251-2026-09-13.json.

Q152 avançou para avaliações regulares identificadas; ainda não comprova os fluxos completos de recuperação/segunda chamada ou autorização específica de Q151. Regularização histórica com matrícula encerrada ainda depende da situação contratual conferida; não há liberação automática. Equivalência, frequência, oportunidades, fechamento, portal e demais frentes da SPEC seguem pendentes. Última regressão integral permanece 245. Homologação interativa ainda não realizada. Sem produção, dados reais ou envio externo.

## Incremento 252 — Histórico do realizador anterior, 13/09/2026

Consulta e painel histórico reconhecem tanto autoria do lançamento quanto autoria da realização. Professor sem atribuição atual pode ler as versões que registrou ou efetivamente realizou, inclusive quando outro avaliador designado regularizou as notas. O filtro é aplicado em cada versão: uma versão posterior realizada e registrada pelo substituto não entra nesse histórico apenas por compartilhar a avaliação.

O acesso continua exigindo professor ativo e não concede edição, conferência, consolidado do nível, outras avaliações ou versões de terceiros. Gestão/titular/designado vigente conservam seus escopos próprios. Histórico anterior sem realizadaPorId segue reconhecendo autorId.

Validação: 33 integrações de lançamentos aprovadas. Novo caso encerra o vínculo do titular, registra sua avaliação por substituto e depois cria uma versão própria do substituto; confere leitura apenas da primeira, autoria de ambos, descoberta na lista/painel e negativas de edição, consolidado e outro código. TypeScript e lint direcionado aprovados; ajustada a tipagem do helper de teste para aceitar a entrada completa da ação. Evidência: docs/validacao-historico-realizador-252-2026-09-13.json. Sem alteração de tela ou migration; último build 251, última regressão integral 245.

Dependência verificada: encerramento contratual ainda tem solicitação e rascunho de acerto, sem registro final aplicado que comprove a data efetiva. Por isso, o leitor de situação contratual continua exigindo conferência para matrículas encerradas; esta etapa não presume uma data a partir do pedido. Q151 completo depende desse fluxo e das autorizações específicas. Recuperação, segunda chamada, equivalência, frequência, fechamento, portal e demais frentes continuam pendentes. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 253 — Proposta de plano de recuperação no servidor, 13/09/2026

Professor titular com atribuição vigente ou Gestão Pedagógica/Administração pode preparar proposta para matrícula/alocação ativa. O consolidado regular foi extraído para uma função transacional compartilhada, conservando autorização e cálculo; a proposta obtém esse resultado dentro da mesma transação bloqueada. Registra matrícula, nível, regra, preparador, versão, estratégias e avaliações propostas por habilidade, motivo e snapshot das notas oficiais e fontes usadas.

Recusa notas obrigatórias pendentes (segunda chamada não é recuperação), resultados suficientes, habilidades repetidas e omissão de habilidade abaixo do mínimo. Se faltar somente atingir a média geral, a proposta identifica quais habilidades serão trabalhadas. Com média geral suficiente, limita o plano às habilidades individualmente insuficientes. Chave idempotente e versão esperada impedem repetição acidental e gravação sobre versão mais recente.

Migration 116 (20260913140000_proposta_recuperacao) aplicada somente ao banco local descartável. Preserva propostas contra alteração/exclusão, confere papel/atribuição e vínculo de matrícula, nível e regra, com sequência de versões por matrícula/nível. Evento PlanoRecuperacaoProposto pertence à matrícula e identifica proposta, regra, nível, versão e habilidades.

Validação: 36 integrações de lançamentos aprovadas. Três casos novos verificam cobertura das habilidades insuficientes, snapshot/autoria, idempotência, versão, imutabilidade, negativa a professor sem atribuição, pendência de nota, notas suficientes e recuperação direcionada quando só a média geral é insuficiente. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-proposta-recuperacao-253-2026-09-13.json.

Limite: proposta ainda não tem decisão independente, reserva/consumo de tentativas, prazo de disponibilização, realização/resultado ou tela. Não autoriza recuperação, altera notas ou inicia prazo. O snapshot atual cobre resultados regulares; integrar recuperações oficiais e revalidar fontes antes da futura aprovação. Q132/Q135 e demais regras de recuperação permanecem parciais. Segunda chamada, autorizações Q151, equivalência, frequência, fechamento, portal e demais frentes seguem pendentes. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 254 — Decisão independente do plano de recuperação, 13/09/2026

Ação de decisão permite a outra pessoa da Gestão Pedagógica/Administração aprovar ou rejeitar a proposta identificada por versão/hash. Aprovação reconfere vínculo ativo, matrícula, regra, versão mais recente e snapshot de notas/fontes dentro da transação coordenada com os lançamentos. Correção de nota posterior à proposta exige nova preparação. Confere também que a regra prevê tentativas positivas nas habilidades propostas; oportunidades extras continuam exigindo fluxo próprio.

Migration 117 (20260913150000_decisao_plano_recuperacao), aplicada somente ao banco local descartável, cria decisão única e imutável por proposta. Banco confere gestão ativa, independência em relação ao preparador, versão e vínculo. Repetir a mesma decisão confirmada retorna o resultado anterior; tentar outra decisão não o substitui. Eventos PlanoRecuperacaoAprovado/PlanoRecuperacaoRejeitado ficam vinculados à matrícula, com proposta, decisão, versão e motivo.

Validação: 38 integrações de lançamentos aprovadas. Casos novos cobrem autoaprovação na ação e no SQL, hash incorreto, aprovação independente, idempotência, imutabilidade, versão superada e invalidação por correção oficial de nota, com rejeição ainda possível. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-decisao-recuperacao-254-2026-09-13.json.

Limite explícito: decisão aprova o plano pedagógico, mas não libera nem reserva uma tentativa, inicia prazo ou publica resultado. Saldo disponível, reservas/consumos, oportunidades extras, disponibilização, aplicação, notas e telas ainda precisam ser implementados. Antes da liberação, reconferir condições e saldo; limite positivo configurado não comprova saldo disponível. Aprovação com base no consolidado regular também não substitui futura integração de recuperações anteriores. Q135 e o fluxo completo permanecem parciais. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 255 — Reserva de tentativas por habilidade, 13/09/2026

Gestão Pedagógica/Administração pode reservar uma tentativa para habilidades identificadas de um plano aprovado. A ação reconfere hash, aprovação, vínculo ativo, matrícula, regra e notas/fontes atuais; restringe a reserva às habilidades do plano. Reserva agrupa itens por habilidade, com autoria, motivo e idempotência. Contagem pertence à matrícula e ao nível e atravessa versões do plano, sem reiniciar a cota ao editar uma proposta.

Migration 118 (20260913160000_reserva_tentativa_recuperacao), aplicada somente ao banco local descartável, preserva reservas/itens contra edição ou exclusão, exige plano aprovado e gestão ativa na reserva e confere habilidade/limite também no banco. Trava da matrícula serializa concorrência para a cota. Evento TentativaRecuperacaoReservada identifica reserva, proposta, nível e habilidades na matrícula.

Validação: 40 integrações de lançamentos aprovadas. Casos novos verificam papel, aprovação, habilidade fora do plano, idempotência, evento e imutabilidade, além de duas reservas concorrentes disputando a última oportunidade: apenas uma é aceita. Nova versão do plano não libera outra tentativa de fala esgotada, enquanto escrita mantém sua própria disponibilidade; tentativa direta no SQL também é rejeitada ao exceder o limite. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-reserva-recuperacao-255-2026-09-13.json.

Limite: reservas ainda não têm realização, consumo definitivo, liberação por cancelamento, falta, extras aprovados ou prazo de disponibilização. Neste estágio, todos os itens reservados permanecem ocupando a cota; implementar movimentos de consumo/liberação preservando esse registro antes de operar o ciclo completo. Reserva não cria nota, presença, cobrança ou agendamento. Telas e integração de resultados de recuperação permanecem pendentes. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 256 — Cancelamento da tentativa pela escola, 13/09/2026

Gestão Pedagógica/Administração pode cancelar a tentativa reservada por iniciativa da escola, com motivo e evidência. Cancelamento é único e imutável, separado da reserva e de seus itens; libera todas as habilidades daquele agrupamento na contagem da cota, sem apagar histórico ou criar consumo. Repetição exata confirma a decisão existente; conteúdo diferente não a substitui. Repetir a criação original da reserva também não reabre a reserva cancelada.

Migration 119 (20260913170000_cancelamento_reserva_recuperacao), aplicada somente ao banco local descartável, registra o cancelamento e altera a contagem de itens ocupados no trigger de limite. Nova reserva usa apenas itens não cancelados; a reserva cancelada não recebe outros itens, inclusive por gravação direta. Liberação e nova reserva são serializadas pela matrícula. Evento TentativaRecuperacaoCanceladaPelaEscola preserva reserva, proposta, cancelamento, habilidades, motivo e autoria.

Validação: 41 integrações de lançamentos aprovadas. Caso novo esgota fala/escrita, cancela uma reserva, confere devolução única e aceita uma substituta, voltando a impedir excesso. Verifica negativa ao professor, idempotência, preservação dos itens, evento único, imutabilidade e bloqueio de novos itens na reserva cancelada. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-cancelamento-recuperacao-256-2026-09-13.json.

Limite: cancelamento institucional da tentativa reservada ainda não altera agenda externa ou encontros da turma; quando houver agendamento vinculado, integrar suas aprovações e efeitos. Não trata cancelamento do aluno, falta ou realização, que ainda precisam de consumo/liberação e conferência temporal próprios. Antes de adicionar consumo/resultado, impedir este cancelamento em tentativa já realizada/consumida; esses registros ainda não existem nesta etapa. Prazos, extras, resultados e telas continuam pendentes. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 257 — Disponibilização e prazo do plano, 13/09/2026

Gestão registra quando o plano aprovado foi disponibilizado ao aluno, as condições oferecidas e a evidência da comunicação. A data não pode anteceder a aprovação nem ser futura. A ação reconfere vínculo, matrícula e fontes de notas; prazo em minutos vem da regra vinculada e gera data-limite explícita. Registro único/imutável impede reiniciar a contagem por edição; repetição exata confirma o mesmo registro.

Nova reserva exige disponibilização registrada e instante atual anterior ao limite, na ação e no banco. No instante limite, novas reservas ficam bloqueadas. Isso não consome uma reserva anterior nem cria falta, nota zero ou conclusão. Migração 120 (20260913180000_disponibilizacao_recuperacao), aplicada somente ao PostgreSQL local descartável, valida papel, aprovação, datas, cálculo do prazo e os textos de condições/comunicação. Comparações SQL usam UTC explicitamente.

Validação: 42 integrações de lançamentos aprovadas. Caso novo confere reserva bloqueada antes da disponibilização, datas anterior à aprovação/futura rejeitadas, cálculo pelo parâmetro fictício da regra de teste, idempotência, negativa à edição, bloqueio no instante limite com relógio da aplicação controlado, evento único e imutabilidade. Fixtures dos fluxos de reserva agora registram a disponibilização explicitamente. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-disponibilizacao-recuperacao-257-2026-09-13.json.

Limite: registra comunicação realizada pela escola e sua evidência; não envia mensagem ou disponibiliza portal automaticamente. Ainda faltam prorrogação independente, tratamento de indisponibilidade posterior, agendamento/aplicação, consumo e resultado, cancelamento do aluno/falta e telas. Reservas anteriores ao vencimento permanecem no histórico/cota até movimento próprio. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 258 — Prorrogação independente do prazo, 13/09/2026

Professor com atribuição vigente ou Gestão Pedagógica/Administração propõe extensão do prazo de uma disponibilização, identificando prazo anterior, novo limite futuro, versão esperada e motivo. Outra pessoa da gestão aprova ou rejeita. Aprovação exige proposta mais recente e base ainda igual ao prazo vigente; preserva proposta/decisão e não edita a disponibilização original. Repetições idempotentes não criam outra extensão.

Prazo efetivo é a última extensão aprovada, com fallback para o limite original. Consulta transacional e função SQL usam essa referência ao conferir novas reservas. Rejeição, proposta pendente ou superada não altera prazo. Extensão não reinicia cota, consome tentativa, concede oportunidade extra ou libera matrícula pausada/encerrada.

Migration 121 (20260913190000_prorrogacao_recuperacao), aplicada somente ao PostgreSQL local descartável, protege propostas/decisões e confere papel, atribuição, independência, versão e datas em UTC. Eventos ProrrogacaoRecuperacaoProposta/Aprovada/Rejeitada preservam referências e motivo no alcance da matrícula.

Validação: 44 integrações de lançamentos aprovadas. Casos novos cobrem repetição, autoaprovação na ação e no SQL, aprovação independente, prazo efetivo igual na aplicação e no banco, original preservado, reserva dentro do intervalo estendido com relógio da aplicação controlado, imutabilidade, proposta superada e rejeição sem mudança do limite. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-prorrogacao-recuperacao-258-2026-09-13.json.

Limite: ainda não comunica automaticamente o novo prazo ao aluno, não resolve indisponibilidade posterior por conta própria e não oferece tela. Agendamento/aplicação, resultados, consumo, faltas/cancelamentos do aluno, oportunidades extras e demais fluxos seguem pendentes. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 259 — Realização e consumo por habilidade, 13/09/2026

Professor titular com atribuição vigente registra a realização de cada habilidade reservada, com data e evidência. Confere reserva não cancelada, período após reserva/disponibilização e antes do prazo autorizado na data da realização, vínculo histórico do aluno/docente e situação contratual nessa data. Prorrogação aprovada depois do fato não é usada para autorizar retroativamente a realização. Repetição exata confirma o mesmo registro; alteração exige futuro fluxo de correção.

Realização imutável consome apenas o item/habilidade correspondente. Itens realizados continuam ocupando a cota mesmo quando a escola cancela o restante da reserva; cancelamento libera somente habilidades pendentes. Reserva inteiramente realizada não pode ser liberada, inclusive por SQL. A mesma reserva pode agrupar habilidades realizadas em momentos distintos, sem antecipar consumo das demais.

Migration 122 (20260913200000_realizacao_recuperacao), aplicada somente ao banco local descartável, cria o registro de realização e adapta limite/cancelamento. Função de prazo na data considera somente extensões aprovadas até o instante da avaliação. Servidor mantém a conferência contratual histórica; matrícula encerrada sem histórico suficiente continua exigindo conferência própria.

Validação: 46 integrações de lançamentos aprovadas. Casos novos verificam professor/gestão, datas anterior à reserva e futura, realização idempotente, evidência preservada, consumo individual, cancelamento parcial sem devolução de consumo, limites separados, bloqueio da realização de item cancelado, ausência de alteração automática da nota, evento e imutabilidade. Caso de realização integral confirma negativa de cancelamento na ação e no SQL. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-realizacao-recuperacao-259-2026-09-13.json.

Limite: ainda não registra nota de recuperação nem sua conferência independente. Ao implementar notas, a habilidade já realizada deve continuar recebendo seu resultado mesmo se outras habilidades da reserva foram canceladas; não usar o cancelamento do agrupamento para apagar a realização. Substituição/designação do avaliador de recuperação, correção da ocorrência, falta/cancelamento do aluno, extras, agenda e telas permanecem pendentes. Não altera frequência, mensalidade ou progressão. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 260 — Notas de recuperação e consolidação, 13/09/2026

Cada realização por habilidade recebe versões imutáveis de nota e comentário destinado ao aluno: rascunho pode não ter nota; submissão exige valor na escala da regra vinculada ao plano. Professor que realizou, com atribuição vigente, registra. Outra pessoa da Gestão Pedagógica/Administração confere a versão e seu hash; acúmulo de papéis não autoriza autoaprovação. Reenvio exato confirma o registro anterior. Nota já oficializada não recebe edição comum; correção própria permanece pendente.

A habilidade realizada recebe nota mesmo quando a escola cancelou os demais itens da reserva. O consolidado carrega notas do vínculo, matrícula, nível e regra corretos, vinculadas a planos aprovados. Notas não oficializadas não melhoram resultado; após conferência, aplica o maior entre resultado vigente e nota de recuperação. Preserva notas regulares, todas as tentativas e fontes das versões/decisões. Novas propostas de recuperação passam a considerar o consolidado com recuperações; mudanças nas fontes invalidam a revisão anterior. A tela de acompanhamento apresenta resultado regular, notas de recuperação, pendências e resultado vigente. Continua sem fechamento, frequência ou progressão automática.

Migration 123 (20260913210000_notas_recuperacao), aplicada somente ao banco local descartável: NotaRecuperacao e DecisaoNotaRecuperacao, autoria, versões, idempotência, imutabilidade, escala e aprovação independente também protegidas por triggers.

Validação: 47 integrações de lançamentos e 27 testes do cálculo aprovados; TypeScript, lint direcionado e schema diff vazio. Build Next.js 16.3.5 aprovado com 49 páginas estáticas; verificação final de tipos cobre o acréscimo posterior dos identificadores das fontes. Casos novos incluem cancelamento parcial, rascunho/submissão, escala inválida na ação e SQL, professor não atribuído, gestão sem lançamento docente, autoaprovação negada também em SQL, hash incorreto, idempotência, nota inferior preservada sem redução, proibição de edição da oficial e imutabilidade. Evidência: docs/validacao-notas-recuperacao-260-2026-09-13.json. Última regressão integral: 245.

Limites: ainda faltam consultas/telas próprias para preparar e conferir notas de recuperação, designação do substituto para esse fluxo, correções de nota de recuperação, autorização específica após pausa/encerramento, faltas/cancelamentos do aluno, oportunidades extras e ligação com agenda. Realização sem versão de nota ainda deve entrar na futura conferência de pendências de fechamento; não é prova de resultado final. Sem homologação interativa, produção ou envios externos. O objetivo completo permanece em implementação.

## Incremento 261 — Consulta e telas de notas de recuperação, 13/09/2026

Entrega consultas autorizadas e duas rotas: /academico/recuperacoes?alocacaoId=... lista realizações do vínculo, inclusive sem nota; /academico/recuperacoes/[realizacaoId] apresenta identificação mínima da matrícula, habilidade, evidência, escala, histórico e formulários de lançamento/conferência. Navegação a partir das avaliações da matrícula. Listagem paginada em 50 e histórico em 20, com continuação explícita. Datas identificadas em UTC nesta tela; preferência de visualização ainda não integrada.

Servidor revalida usuário ativo e papéis sob bloqueio do vínculo. Gestão e professor atual consultam o vínculo; ex-professor ativo consulta somente realizações próprias e suas versões, sem escrita. Professor não atribuído e usuário inativo não consultam. Campos de contato e financeiro não são projetados. Hash da versão só é entregue quando há permissão de decisão; chave de idempotência não é exposta. Formulários usam as ações do incremento 260, com nova conferência no servidor. Aprovação exige seleção explícita e motivo; versão antiga não oferece aprovação. Rascunhos aceitam nota ausente; submissão exige nota na escala. Reenvio após resultado incerto conserva chave enquanto o conteúdo não muda.

Validação: 47 integrações de lançamentos aprovadas; cenário de saída repetido após remover o papel de gestão do professor. Cobertura inclui realização sem nota na lista, autoria, gestão sem lançamento docente, visibilidade das ações/hash, campos privados ausentes, ex-professor em leitura e bloqueio de inativo. TypeScript e lint direcionado aprovados; build Next.js aprovado. Evidência: docs/validacao-telas-recuperacao-261-2026-09-13.json.

Limites: não houve homologação interativa em navegador. A criação/decisão de planos, reserva e realização ainda precisam das próprias telas; este incremento permite trabalhar nas realizações já registradas. Designação de substituto, correções e exceções continuam pendentes. Descoberta de vínculos exclusivamente por histórico de recuperação ainda deve ser integrada ao painel geral. Nenhuma migration adicional, produção, envio externo ou conclusão do objetivo total.

## Incremento 262 — Preparação e revisão de planos pela equipe, 13/09/2026

Rota /academico/recuperacoes/planos?alocacaoId=... permite consultar o consolidado, preparar estratégia/avaliação proposta por habilidade e decidir planos. Navegação a partir da matrícula acadêmica. As habilidades insuficientes são obrigatórias; quando só falta a média geral, a equipe escolhe quais trabalhar. Quantidades, pesos, mínimos e prazos não recebem valores presumidos. Proposta usa a ação e idempotência existentes, com versão esperada e chave conservada em reenvio de resultado incerto.

Consulta autoriza primeiro o consolidado, depois projeta identificação mínima e planos do vínculo. Não concede leitura dos planos ao professor sem atribuição atual; histórico próprio de notas continua nas telas específicas. Lista 20 propostas por página, preservando base numérica e atividades de cada versão. Gestão independente recebe hash apenas para decisão; preparador não recebe ação para autoaprovar. Tela sinaliza mudança das fontes, limita aprovação à versão atual com vínculo/regra válidos, notas insuficientes e limite configurado positivo. A ação de decisão revalida essas condições. Aprovação de plano não reserva tentativa nem disponibiliza prazo automaticamente.

Validação: 48 integrações de lançamentos aprovadas. Novo cenário verifica ausência de nota impedindo proposta, insuficiência permitindo, base preservada, autoaprovação indisponível com papéis acumulados, versão antiga sem aprovação, paginação por versão, decisão pelo hash consultado, professor não atribuído/inativo negados e ausência de contato/financeiro/chave de idempotência. TypeScript, lint direcionado e build Next.js aprovados. Sem migration adicional. Evidência: docs/validacao-planos-recuperacao-262-2026-09-13.json.

Pendências: telas de disponibilização, reserva e realização ainda precisam ser conectadas ao plano aprovado; também permanecem designação específica, correção, oportunidades extras, faltas/cancelamentos do aluno e autorização de exceções. Sem homologação interativa, produção ou envio externo. Última regressão integral 245. Escopo completo ainda em implementação.

## Incremento 263 — Operação do plano aprovado pela interface, 13/09/2026

Rota /academico/recuperacoes/planos/[propostaId] conecta o plano aprovado às ações existentes de disponibilização, reserva de tentativas, realização por habilidade e cancelamento pela escola. Exibe identificação mínima, aprovação, condições/evidência de comunicação, prazo original e vigente, limite/consumo/reserva/disponibilidade por habilidade e reservas paginadas em 20. Realização possui link para nota/conferência. A reserva de oportunidade não agenda um encontro; a ligação à agenda permanece pendente.

Gestão registra disponibilização e reserva; professor atual registra realização; gestão cancela pendências da escola. Autorizações e requisitos são novamente conferidos pelas ações. As notas/fontes e o vínculo são conferidos antes de apresentar avanço. O saldo inclui todas as versões do plano na matrícula/nível, preserva consumo realizado após cancelamento parcial e libera apenas itens pendentes. Nenhum valor de cota ou prazo foi presumido. Realização e disponibilização aceitam data/hora e fuso informado, convertidos no servidor com rejeição de horário inválido/ambíguo. Leitura de datas segue UTC explicitamente nesta tela; preferência global ainda não integrada. Comunicação é evidência registrada pela equipe, sem envio automático.

Validação: 49 integrações de lançamentos aprovadas, incluindo plano ainda não aprovado, disponibilidade e flags por papel, conversão de America/Sao_Paulo para o instante persistido, fuso inválido, reserva/realização/cancelamento parcial e saldo exato por habilidade, dados privados ausentes e professor não atribuído negado. TypeScript, lint direcionado e build Next.js aprovados. Sem migration adicional. Evidência: docs/validacao-operacao-recuperacao-263-2026-09-13.json.

Pendências: telas de prorrogação, designação de substituto, correções, oportunidades extras, faltas/cancelamentos do aluno e exceções de matrícula; integração com agenda e comunicação/portal. Sem homologação interativa, produção ou envio externo. Última regressão integral 245. O fluxo implementado não prova entrega integral do módulo nem do projeto.

## Incremento 264 — Prorrogação pela interface, 13/09/2026

Rota /academico/recuperacoes/planos/[propostaId]/prorrogacoes conecta proposta e decisão de extensão do prazo, com navegação pela operação do plano. Exibe prazo original, vigente e histórico paginado em 20 propostas, autoria, justificativa e decisão. Professor atual/gestão propõe; outra pessoa da gestão decide. Autoaprovação não aparece mesmo com papéis acumulados. Aprovação exige versão mais recente, base igual ao prazo vigente, novo prazo posterior e futuro e matrícula ativa; ação revalida sob bloqueio.

Novo prazo é informado em data/hora e fuso explícito, convertido no servidor. A interface conserva chave em reenvios incertos e registra uma nova proposta somente conforme a versão esperada. Prazo original não é sobrescrito, rejeição conserva o vigente e proposta sozinha não muda o prazo nem concede tentativas. Matrícula não ativa não recebe nova proposta por esta tela; autorização específica permanece fluxo próprio. Consulta autoriza o vínculo antes de projetar os dados; hash só aparece para decisão permitida e dados de contato/financeiro não são consultados.

Validação: 49 integrações de lançamentos aprovadas. Cenários de prorrogação agora verificam a consulta sem disponibilização, proposta pela conversão de America/Costa_Rica, reenvio coerente com a ação original, visibilidade de autoaprovação, versão superada/paginação, hash de decisão, prazo vigente após aprovação, preservação do original e professor não atribuído negado. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-interface-prorrogacao-264-2026-09-13.json. Sem migration adicional. Última regressão integral 245.

Limites: comunicação da nova data ao aluno ainda não automatizada; exibição usa UTC explícito, sem preferência global integrada. Designação, correções, oportunidades extras, faltas/cancelamentos do aluno, exceções e integração com agenda permanecem pendentes. Sem homologação interativa, produção ou envios externos. Objetivo completo ainda em implementação.

## Incremento 265 — Regressão completa após os fluxos de recuperação, 13/09/2026

Executada regressão integral do código atual: 771 testes unitários e 629 integrações aprovados, sem falhas ou testes pendentes. A integração foi executada em processo único no PostgreSQL local descartável. Tipos aprovados e schema diff vazio, com 123 migrations aplicadas. Lint completo sem erros e três avisos preexistentes de react-hooks/set-state-in-effect em FinanceiroPainel/Sidebar. Build do mesmo código validado no incremento 264, Next.js 16.3.5, 51 páginas estáticas. Evidência por arquivo: docs/validacao-regressao-265-2026-09-13.json.

Esta regressão substitui 245 como referência integral mais recente. A suíte abrange somente o comportamento coberto pelos testes existentes; não demonstra conclusão dos requisitos ainda pendentes, homologação interativa, operação dos provedores externos ou migração real. A leitura atual de src/server/matricula/entrada-ativacao.ts confirma bloqueio explícito da ativação de particulares no fluxo legado; src/server/matricula/encerramento-rascunho.ts preserva uma versão de trabalho, sem constituir execução final do encerramento. Essas pendências continuam abertas. Nenhum código de produto foi alterado neste incremento e nenhum envio externo foi realizado. A execução do objetivo completo continua aberta.

## Incremento 266 — Designação docente limitada à tentativa de recuperação, 13/09/2026

Gestão designa/revoga professor ativo para item/habilidade de uma reserva, com motivo, versão e idempotência. Designações são imutáveis; troca e revogação preservam o histórico. Item cancelado sem realização ou com nota já oficializada não recebe nova designação. Não reinicia prazo, reserva ou cota e não transfere titularidade da turma. Migration 124 (20260913220000_designacao_recuperacao), aplicada ao banco local descartável, acrescenta DesignacaoRecuperacao e guardas equivalentes no banco.

Professor designado registra realização somente com autorização vigente e válida no instante informado, mantendo a elegibilidade histórica/contratual e o prazo. Também pode registrar nota de realização feita por outro professor, preservando o professor realizador e o autor de cada versão da nota. Oficialização exige pessoa distinta de ambos. Consulta e lista de notas incluem apenas realizações designadas ou histórico próprio, sem abrir consolidado, plano inteiro ou outra habilidade. Revogação retira escrita; realizações/notas próprias permanecem em leitura. A tela da nota identifica separadamente o professor realizador. Designação deixa de conceder acesso a pendência ao oficializar, preservando apenas os demais acessos legítimos.

Validação: 51 integrações de lançamentos aprovadas, incluindo professor sem poder de designação, idempotência, nota por substituto com autoria preservada, negação de acesso ao plano/consolidado e habilidade não atribuída, revogação, impedimento de ambos os autores na oficialização, bloqueio após oficialização, imutabilidade, realização antes da designação negada, realização após designação aceita e usuário inativo bloqueado. TypeScript, lint direcionado e schema diff vazio aprovados; build Next.js aprovado. Evidência: docs/validacao-designacao-recuperacao-266-2026-09-13.json. Última regressão integral 265.

Limites: ainda faltam consulta/tela administrativa de designação e fila de tentativas designadas para permitir descobrir e operar a atribuição antes da realização. Acesso direto à nota já realizada está integrado. Regularização de realização antiga atribuída a terceiro, correções, oportunidades extras, ocorrências do aluno, exceções e agenda permanecem pendentes. Sem homologação interativa, produção ou envio externo. Objetivo total permanece aberto.

## Incremento 267 — Gestão da designação de recuperação pela interface, 13/09/2026

Rota /academico/recuperacoes/tentativas/[itemReservaId]/designacao permite à Gestão Pedagógica/Administração consultar e alterar o avaliador de um item, a partir da operação do plano. Consulta transacional revalida o papel antes de projetar identificação mínima, professor realizador, designação atual e histórico paginado em 20. Busca de professores ativos por nome, limitada a 50 com indicação para refinar; sem contatos ou credenciais. Atual professor inativo/sem papel docente é sinalizado, preservando o histórico.

Formulário exige escolha explícita e motivo; permite revogação, usa versão esperada e conserva a chave em reenvio incerto do mesmo conteúdo. Ação e trigger existentes continuam conferindo pendência/versão/alvo. Item sem pendência fica em leitura, inclusive depois de oficialização; não oferece busca/alteração. Link administrativo aparece somente para gestão na operação do plano. Não altera autoria, turma, prazo ou saldo.

Validação: 51 integrações de lançamentos aprovadas; cenário de designação ampliado para consultar candidatos, busca sem resultado, leitura negada ao professor, versão atual/revogação/histórico anterior e bloqueio de edição após oficialização, sem campos privados. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-tela-designacao-recuperacao-267-2026-09-13.json. Sem migration adicional; última regressão integral 265.

Pendências: fila própria e acesso da tentativa para o professor designado antes da realização; regularização de realização antiga por terceiro, correções, extras, ocorrências do aluno, exceções e agenda. Sem homologação interativa, produção ou envio externo. Objetivo completo permanece em implementação.

## Incremento 268 — Fila e detalhe da tentativa designada, 13/09/2026

Fila /academico/recuperacoes/designadas, ligada ao painel de avaliações para professores, lista até 20 tentativas pendentes com atribuição vigente, identificação mínima e continuidade por cursor. Consulta exige professor ativo mesmo quando há papel administrativo. Usa o estado atual da designação, exclui itens cancelados sem realização e itens com nota oficializada. Não inclui outras habilidades do mesmo plano por consequência de uma atribuição.

Detalhe /academico/recuperacoes/tentativas/[itemReservaId] revalida a atribuição sob bloqueio do vínculo e apresenta somente a estratégia/avaliação da habilidade selecionada, datas da reserva/disponibilização, prazo vigente e eventual realização. Antes de realizada, permite registrar o fato usando as ações com autorização histórica já implementadas; depois, abre a nota/conferência com autoria preservada. Não abre o consolidado nem o plano inteiro. Revogação ou oficialização retiram a tarefa da fila e encerram o acesso por designação; histórico próprio continua na consulta de notas.

Validação: 51 integrações de lançamentos aprovadas. Cenários de designação agora verificam fila antes/depois da realização, detalhe da habilidade atribuída, negação de outra habilidade, ausência de campos privados, remoção após revogação e oficialização e bloqueio de gestão sem papel docente/usuário inativo. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-fila-recuperacao-268-2026-09-13.json. Sem migration adicional; última regressão integral 265.

Pendências: regularização de realização antiga por terceiro, correções, oportunidades extras, faltas/cancelamentos do aluno, exceções contratuais, integração com agenda e comunicação/portal. Preferência global de fuso ainda não integrada às novas telas. Sem homologação interativa, produção ou envio externo. Escopo completo permanece em implementação.

## Incremento 269 — Descoberta do histórico próprio de recuperação, 13/09/2026

A área Minhas recuperações distingue atribuições pendentes e Meu histórico. O histórico encontra realizações do professor ou registros de nota de sua autoria, mesmo após revogação/oficialização, com link direto à consulta de notas. Designação sem realização/lançamento não concede histórico por si só. Consulta continua exigindo professor ativo e conserva projeção mínima e paginação por cursor; uma realização aparece uma vez mesmo que possua várias versões de nota. Não abre o histórico de outras habilidades/alunos por associação ao plano.

Links históricos seguem as permissões da consulta de notas existente: autoria preservada, acesso em leitura sem atribuição vigente e sem reabrir o plano. A navegação resolve a descoberta de recuperações que deixaram a fila de pendências, sem conceder escrita por escolher o filtro histórico.

Validação: 51 integrações de lançamentos aprovadas; cenários de designação ampliados para histórico vazio antes do trabalho, presença por autoria da nota ou realização, persistência após revogação, cursor sem repetição, campos privados ausentes e inativo negado. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-historico-recuperacao-269-2026-09-13.json. Sem migration adicional; última regressão integral 265.

Pendências: regularização de realização antiga por terceiro, correções, oportunidades extras, ocorrências do aluno, exceções, integração com agenda/portal e preferência global de fuso. Sem homologação interativa, produção ou envio externo. O objetivo completo permanece em implementação.


## Incremento 270 — Regularização da realização de recuperação, 13/09/2026

O professor com designação vigente para a tentativa pode registrar uma avaliação realizada por outro professor, informando realizador, data efetiva, motivo e evidência. A consulta oferece somente nomes de professores com vínculo histórico na turma ou designação no item; o servidor confere a atribuição na data exata. O realizador pode estar atualmente inativo. O registrador precisa continuar ativo, com papel docente e designação específica; ser titular da turma não basta para registrar em nome de terceiro.

RealizacaoRecuperacao preserva separadamente professorId (realizador), registradaPorId e motivoRegularizacao. A migration 125 acrescenta campos sem reescrever históricos anteriores e reforça a proteção de inserção/imutabilidade no banco. Reenvio idêntico conserva o registro; alteração exige fluxo próprio. Mantêm-se prazo autorizado na data, reserva, vínculo histórico do aluno e situação contratual aplicável. Não cria nota, presença, progressão ou novo saldo.

A tela da tentativa designada permite escolher o realizador e exige motivo quando for outra pessoa. A consulta de notas exibe as duas autorias. Após revogação, o registrador encontra sua realização em Meu histórico, em leitura; isso não abre notas de outros autores nem o plano inteiro. Oficialização da nota continua independente do autor da nota e do realizador.

Validação: 52 integrações de lançamentos aprovadas, incluindo ausência de designação/motivo, realizador sem vínculo, item não atribuído, realizador atualmente inativo, replay, imutabilidade SQL e leitura própria após revogação. TypeScript, lint direcionado, build Next.js e comparação do schema aprovados. Evidência: docs/validacao-regularizacao-recuperacao-270-2026-09-13.json. Migration aplicada somente ao banco descartável local.

Pendências: correções de recuperações, oportunidades extras, ocorrências do aluno, exceções contratuais, segunda chamada, frequência, equivalências, fechamento final e integração com agenda/portal. Sem homologação interativa, produção ou envio externo. A entrega integral permanece em implementação.


## Incremento 271 — Correções de notas de recuperação, 13/09/2026

Notas de recuperação oficializadas agora possuem propostas de correção versionadas, preparadas pelo professor atualmente responsável pela turma ou pela Gestão Pedagógica/Administração. Cada proposta identifica a nota original, a origem vigente, o novo valor/comentário e o motivo. Outra pessoa da gestão revisa e decide. Acúmulo de papéis não permite autoaprovação. A proposta mantém o resultado anterior até aprovação válida; rejeição não altera o consolidado. Reenvio do mesmo conteúdo é idempotente e origem/versão superadas são recusadas.

Modelos PropostaCorrecaoRecuperacao e DecisaoCorrecaoRecuperacao preservam histórico, autoria e impactos. Migration 126 protege imutabilidade, nota oficial de origem, papel/vínculo docente, versão sequencial, escala e decisão independente no banco. O servidor também confere hash da proposta e da revisão de impactos antes de aplicar. Inclui mudanças acadêmicas aprovadas/executadas e planos de recuperação aprovados do vínculo; registra evento de revisão necessária para progressões afetadas, sem transferir o aluno nem desfazer decisões automaticamente.

O consolidado usa a última correção aprovada de cada nota de recuperação e conserva a nota original no histórico. Corrigir uma recuperação indevidamente alta pode reduzir o resultado vigente: o melhor resultado é recalculado com as notas válidas, sem tratar a correção como nova tentativa e sem consumir oportunidade. As fontes da consolidação incluem a correção aprovada, invalidando propostas dependentes cuja base tenha mudado.

A tela /academico/recuperacoes/correcoes/[notaId], acessível pela nota oficial aos perfis autorizados, identifica matrícula e habilidade, mostra original/vigente, permite propor, conferir impactos e decidir, com histórico paginado. Não expõe chaves ou hashes no histórico docente; a revisão para decisão exige gestão. A consulta da recuperação mostra o valor corrigido e preserva a nota anterior. Não devolve escrita a professor desligado ou sem atribuição vigente.

Validação: 53 integrações de lançamentos aprovadas, incluindo redução de recuperação 8 para 4 restaurando resultado original 5, preservação da nota 8 no histórico, rejeição, replay, escala, origem superada, acesso indevido, autoaprovação no servidor/banco, imutabilidade, histórico e paginação. TypeScript, lint direcionado, build Next.js e comparação do schema aprovados. Evidência: docs/validacao-correcao-recuperacao-271-2026-09-13.json. Migration aplicada somente ao banco descartável local.

Limites: esta entrega corrige nota/comentário, não a realização, habilidade ou consumo da tentativa. A resolução operacional das revisões de progressão, fila consolidada dessas pendências de recuperação, oportunidades extras, ocorrências do aluno, segunda chamada, frequência, equivalências, fechamento final e integração com portal continuam pendentes. Sem homologação interativa, produção ou envio externo. O escopo integral permanece em implementação.


## Incremento 272 — Fila conjunta de impactos das correções, 13/09/2026

A fila /academico/correcoes passa a consultar correções regulares e de recuperação que foram aprovadas com mudanças acadêmicas afetadas. A paginação é aplicada ao conjunto das duas fontes antes de carregar os detalhes, em ordem de decisão e identificador; cada página contém no máximo 20 casos, com indicação da próxima. Isso evita que uma fonte esconda ou duplique a outra na navegação.

Cada item informa matrícula/aluno, origem da correção, avaliação ou habilidade, responsável/data da aplicação e as mudanças acadêmicas afetadas. Preserva a situação registrada na correção e confere a situação atual pelo vínculo de origem. Links levam às correções correspondentes e às movimentações da matrícula. Acesso exige Gestão Pedagógica/Administração ativa, revalidada no servidor; não projeta contatos, credenciais ou chaves de operação.

Validação: 53 integrações de lançamentos aprovadas. O cenário de recuperação agora cria uma mudança aprovada depois da revisão, confirma que a aprovação fica desatualizada e exige nova conferência. Após aplicação, o caso aparece na fila sem desfazer a mudança. Cobertura adicional verifica fila mista com 21 correções em duas páginas, sem repetição/perda, acesso negado a professor e ausência de campos privados. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-fila-correcoes-272-2026-09-13.json.

Não há nova migration. A fila torna as pendências encontráveis; não afirma que foram resolvidas. Resolução operacional da revisão de progressão continua pendente, assim como correções da realização/consumo, oportunidades extras, ocorrências do aluno, segunda chamada, frequência, equivalências, fechamento final e portal. Sem homologação interativa, produção ou envio externo. Última regressão integral: incremento 265; entrega completa permanece em implementação.


## Incremento 273 — Regressão integral e conferência das pendências, 13/09/2026

Regressão executada após os incrementos 266–272: 771 testes unitários e 633 integrações aprovados, sem falhas ou casos pendentes. Integração em processo único, somente no banco descartável local. Lint completo sem erros e com três avisos preexistentes react-hooks/set-state-in-effect (FinanceiroPainel.tsx:116/402 e Sidebar.tsx:38). TypeScript aprovado, schema diff vazio com 126 migrations. Build do mesmo código executável foi aprovado no incremento 272 (52 páginas estáticas). Evidência por arquivo: docs/validacao-regressao-273-2026-09-13.json.

A regressão confirma os comportamentos cobertos pelos testes existentes, não a conclusão do escopo. A conferência direta do código mantém pendências importantes: entrada-ativacao.ts bloqueia corretamente o caminho mensal legado para particulares; acoes.ts ainda exige taxa e primeira mensalidade nesse caminho; a conversão dos horários reservados em encontros da contratação não está integrada à ativação. Contratos por hora precisam conferir adiantamento exigido/dispensado conforme contrato, sem inventar mensalidade. O rascunho de acerto em encerramento-rascunho.ts não equivale a aprovação ou efetivação final.

Próxima implementação da ativação particular deve integrar, na mesma operação, condições aceitas e pagamentos exigidos, disponibilidade/reserva atual, encontros vinculados à matrícula, consumo da reserva e mudança de estado. Assinatura externa e a comprovação de todas as assinaturas exigidas continuam com dependências próprias. Não remover as recusas existentes antes de implementar esses efeitos e seus testes.

Sem mudanças de produto nesta rodada, homologação interativa, produção, importação ou envio externo. O objetivo integral permanece ativo; a lista de pendências das SPECs continua válida.

## Incremento 358 — Lacuna entre avaliações e progressão, 14/09/2026

Revisão direta confirmou que decidirMudancaAcademica/executarMudancaAcademica ainda não consultam notas, frequência ou fechamento acadêmico. O consolidado calcula os mínimos, mas permanece acompanhamento; a fila de impactos de correções não resolve nem bloqueia operacionalmente a progressão. Portanto, aprovação manual e testes do fluxo atual não comprovam Q130/Q131/Q138/Q154.

Plano vinculante à implementação em docs/planejamento/integracao-progressao-academica-358.md: frequência histórica por contrato, fechamento versionado, exceção independente somente de frequência, integração da decisão/execução às fontes atuais e resolução das correções/equivalências. Inclui os caminhos válidos de regularização, segunda chamada e oportunidades, sem reduzir o escopo a um bloqueio. Critérios exigem preservar notas reais, financeiro e outros contratos.

Nesta rodada houve revisão de código e atualização documental; não houve mudança executável nem novos testes. A lacuna permanece aberta e impede declarar conformidade integral da progressão. O objetivo completo segue ativo.

## Incremento 359 — Apuração de frequência por encontros, 14/09/2026

Implementado src/server/avaliacoes/frequencia.ts como cálculo interno determinístico por matrícula/nível e instante de apuração. Entradas explicitam aula original, estado da conclusão, participação e reposições validadas. Recusa mistura de contratos/níveis, aula duplicada, reposição de outra origem, validação futura e realização futura. Não consulta dados externos nem concede autorização à existência de um identificador: o carregador ainda deverá verificar fontes, vínculo histórico e equivalência.

Presenças e regularizações compõem o numerador; uma aula original entra uma única vez, mesmo com mais de uma reposição validada. Memória conserva falta/impedimento original e apresenta a data de validação da regularização. Impedimento sem reposição permanece na base sem crédito. Canceladas e previstas futuras ficam fora da base; prevista passada gera pendência de conclusão; chamada ausente deixa resultado inconclusivo. Sem aulas não há frequência suficiente presumida. O percentual é preservado como fração e o mínimo é comparado sem arredondamento; 2/3 não satisfaz 66,67%.

Validação: oito testes unitários aprovados, TypeScript e lint direcionado aprovados; diff check aprovado. Não houve integração com banco, migration, build novo, exposição em tela, produção ou envio. Os tipos da função não representam novos estados persistidos no schema. Carregamento histórico, vínculo das reposições aprovadas, frequência consolidada do nível após transferências, fechamento, exceção de frequência e validação da progressão seguem pendentes conforme plano 358. Este incremento é uma base de cálculo, não a entrega integral de Q131/Q154.
## Incremento 360 — Frequência consultada nos registros do vínculo, 14/09/2026

A consulta autorizada do consolidado carrega encontros publicados do vínculo, chamadas do próprio aluno e situação contratual histórica no início da aula. Usa a regra de frequência vinculada à turma, sem padrão presumido. Datas fora da alocação e contratos não ativos na aula não fornecem presença. Diários sem encontro associado, situação contratual não conferida e outros vínculos do mesmo nível geram pendências; múltiplos vínculos exigirão o aproveitamento aprovado.

O booleano legado de presença não distingue impedimento e regularização. Ausência registrada gera conferência específica e não permite concluir atendimento do mínimo automaticamente. A tela mostra presenças/base e pendências como acompanhamento parcial deste vínculo. Não apresenta essa consulta como fechamento final. A apuração temporal fica fora da memória interna estável dos planos de recuperação, preservando sua revisão/idempotência.

Validação: suíte de lançamentos com 54 integrações aprovada; acrescentado cenário de presença ministrada e ausência não classificada, seguido de execução direcionada dos dois testes de frequência (dois aprovados, 53 não selecionados). Total atual do arquivo: 55 testes, sem nova execução integral após a adição do segundo cenário. TypeScript, lint e build/52 páginas aprovados; somente teste foi alterado após o build. Evidência da suíte: docs/validacao-frequencia-360-2026-09-14.json. Diff check aprovado. Nenhuma migration, produção, envio externo ou homologação visual.

Ainda faltam classificação persistida da ausência/impedimento, reposições com decisões verificáveis, agregação e equivalência entre vínculos, fechamento versionado, exceção de frequência e integração na aprovação/execução da progressão. Não afirmar conclusão de Q131/Q154 a partir desta consulta parcial.
## Incremento 361 — Participação contratual na chamada, 14/09/2026

Migration 160 (20260914150000) adiciona matrícula e participação opcional ao registro da aula: PRESENTE, FALTA e IMPEDIDO_POR_RESTRICAO. A FK composta exige o mesmo aluno do contrato; check SQL impede classificação incompatível com o booleano; identidade contratual já preenchida não pode ser removida/trocada. Registros antigos permanecem nulos, sem backfill presumido. Aplicada somente ao PostgreSQL descartável; Prisma regenerado e schema diff vazio.

Chamada coletiva e particular capturam o contrato conferido no servidor para registros novos. Classificação explícita requer matrícula identificada, presença coerente e, para impedimento, observação da ocorrência sem dados financeiros. Entrada antiga sem classificação preserva a anterior se a presença não mudar; edição legada não atribui contrato silenciosamente. Reclassificação explícita de registro pendente utiliza o vínculo histórico validado. Registros de quem saiu continuam em leitura; encontro ministrado conserva os bloqueios de edição existentes.

A tela do encontro oferece classificação quando a matrícula histórica foi identificada. Histórico e revisão da exceção de gravação distinguem impedimento de falta. Matrícula/classificação entram na comparação do estado do diário, preservando a forma anterior para registros sem identidade; consultas de revisão carregam os mesmos campos. A frequência usa a classificação confirmada e recusa usar registro tipado de outro contrato; impedimento permanece na base sem crédito.

Validação: 839 unitários em 91 arquivos aprovados; 55 integrações de avaliações aprovadas e 17 de diário aprovadas na execução final. A rodada combinada anterior teve duas falhas de fixtures: objeto esperado sem o novo campo nulo e sessão da gestão não restaurada após nova consulta. Ambas corrigidas sem flexibilizar regra e repetida a suíte de diário. Evidências docs/validacao-participacao-361-2026-09-14.json (rodada intermediária) e docs/validacao-diario-361-final-2026-09-14.json (17 aprovados). TypeScript, lint, build/52 páginas e diff check aprovados. Após build, apenas fixtures e nome de mapeamento da FK no schema foram alinhados; cliente regenerado.

Sem homologação visual, produção ou envios. Registrar impedimento não cria/revoga restrição nem executa cobrança. Correções aprovadas de chamadas concluídas, regularização formal do legado, reposições com evidências, frequência entre vínculos, fechamento e integração da progressão continuam pendentes. A classificação não comprova conclusão integral de Q59/Q131/Q154.


## Incremento 363 — Recuperações realizadas sem nota

O acompanhamento inclui todas as realizações autorizadas, inclusive sem nota, preservando pendência, fonte e média oficial. Comparação da base de notas do plano fica separada para não invalidar sua execução por etapas. Fechamento futuro exige acompanhamento completo e demais pendências conferidas; Q154 permanece aberta. [Validação e limites](../planejamento/validacao-incremento-363.md).


## Incremento 364 — Pendências operacionais do resultado

O acompanhamento passa a apresentar correções sem decisão, planos em aprovação/não disponibilizados e tentativas reservadas ainda não realizadas, no escopo autorizado da matrícula e vínculo. Não confirma fechamento, não dispensa equivalência e não resolve impactos de correções já aplicadas. [Evidências e limites](../planejamento/validacao-incremento-364.md).


## Incremento 365 — Atividades aprovadas sem tentativa

A consulta identifica habilidades de cada plano aprovado sem tentativa reservada ou realizada. Preserva realização após cancelamento parcial e não confunde disponibilização com execução. Não confirma cumprimento integral do plano nem fechamento do nível. [Validação e limites](../planejamento/validacao-incremento-365.md).


## Incremento 366 — Oportunidades extras de recuperação

Q150 recebeu proposta com quantidade, motivo/evidências, consulta/tela e decisão independente para recuperação por habilidade. A aprovação revalida a base e acrescenta saldo somente à matrícula/nível/habilidade; reserva considera extras também no SQL. Reenvios e histórico preservados. Não cria nota nem dispensa plano, prazo ou mínimos. Segunda chamada e homologação permanecem pendentes. [Evidências e limites](../planejamento/validacao-incremento-366.md).
