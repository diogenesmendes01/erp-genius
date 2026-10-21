# Fechamento e aproveitamento acadêmico — Q131/Q138/Q153/Q154

## Escopo e situação

Esta especificação detalha decisões já aprovadas. A unidade é matrícula e nível, com rastreabilidade das alocações em turmas. O portal parcial Q143 não comprova implementação do fechamento. Em 14/09/2026, propostas, aprovação independente e execução da equivalência estão implementadas e possuem evidências de integração nos incrementos 419–423; o caminho direto legado foi bloqueado. O incremento 425 integra o aproveitamento no cálculo do destino e valida transferência com fonte oficial e invalidação após correção, na equipe e no portal. O incremento 426 valida cadeia A→B→C e implementa persistência, revisão e confirmação do fechamento, incluindo frequência do nível e versões preservadas após correção. Recuperação posterior ao aproveitamento foi validada em integração no incremento 429, incluindo preservação do melhor resultado após tentativa inferior. O incremento 427 integra a exceção independente de frequência ao fechamento, preservando frequência real e revalidando a fonte. O incremento 428 exige fechamento suficiente e atual na aprovação e na execução da progressão, com referência à versão aprovada e 13 integrações direcionadas aprovadas. A regressão dos fluxos antigos foi corrigida e aprovada no incremento 429, com 83 integrações direcionadas no conjunto da rodada. O incremento 430 apresenta a situação do fechamento no portal por matrícula/nível, com sessão própria e conferência das fontes atuais. O incremento 431 acrescenta resumo numérico de notas e frequência real ao fechamento atual no portal. O incremento 432 valida a transferência no mesmo nível no portal, com frequência histórica sem duplicação e nova versão de fechamento. O incremento 433 identifica impactos potenciais por cadeias de equivalência aplicadas, com testes de progressão aprovada e executada. A resolução persistida da revisão após progressão executada permanece pendente; Q154 não está integralmente concluído.

## Aproveitamento na transferência do mesmo nível

A gestão prepara o mapeamento das avaliações/habilidades de origem para os requisitos da turma de destino. Outra pessoa da Gerência Pedagógica/Administração aprova. A proposta identifica matrícula, alocação de origem, turma de destino, versões das regras, fontes oficiais utilizadas e requisitos ainda pendentes. Uma fonte conserva identidade da avaliação, lançamento oficial, correção aprovada vigente e autoria.

A execução pela Secretaria confere novamente o contexto e aplica a transferência autorizada. Mudança relevante nas fontes, nas regras ou na disponibilidade exige revisão. Não copiar lançamentos para simular avaliações realizadas na turma de destino. O cálculo usa os requisitos e pesos do destino e registra o aproveitamento de cada requisito; não soma o mesmo requisito duas vezes por aparecer na origem e no destino. Habilidade não avaliada permanece pendente, sem zero automático.

O caminho existente `trocarTurma` deve passar pelo fluxo autorizado, sem manter uma alternativa de escrita direta que ignore a equivalência. A decisão de aproveitamento não altera regras dos demais alunos nem dispensa os mínimos de nota.

### Disponibilidade de destino pela agenda publicada — 19/09/2026

A disponibilidade para uma transferência não depende da previsão manual `dataFim`: exige grade aprovada e pelo menos um encontro regular futuro, com professor apto e sem indisponibilidade aprovada que o alcance. Uma aula já iniciada não cria vínculo retroativo. A proposta v3 conserva a grade, o calendário vigente e, quando houver replanejamento conjunto aplicado, a cadeia dessa aplicação e a fotografia da agenda. Aprovação e execução conferem novamente o mesmo recorte futuro no mesmo marco; alteração, remoção, cancelamento ou indisponibilidade futura exige nova proposta. Fatos já iniciados não tornam uma decisão obsoleta somente pela passagem do tempo.

Memórias v1/v2 continuam consultáveis e podem repetir a solicitação idêntica sem reescrita, mas não podem ser aprovadas ou executadas sem fotografia v3. A cadeia atual reconhece a grade publicada e a última revisão conjunta aplicada, inclusive sem remarcações. O reconhecimento de escritores posteriores aprovados que alterem uma agenda futura sem pertencer a essa cadeia permanece pendente de uma fonte compartilhada com Q161; até lá a divergência conserva a recusa, sem declarar a transferência integralmente concluída.

## Fechamento do resultado

A gestão consulta o consolidado e confirma uma versão final. Q154 não exige uma segunda pessoa apenas para essa confirmação; as aprovações independentes de notas, correções, equivalência e exceções continuam obrigatórias.

Cada versão conserva matrícula, nível, alocações consideradas, regra aplicável, referências das fontes oficiais, frequência real, memória de cálculo, pendências conferidas, eventual exceção de frequência aprovada, resultado e autoria/data da confirmação. A leitura e a confirmação devem comparar a mesma base: se ela mudou, atualizar a conferência antes de concluir. O identificador da versão não substitui a conferência de atualidade das fontes.

Pendência impede fechamento: avaliações obrigatórias incompletas ou sem oficialização, registros históricos a conferir, decisões de equivalência/correção pendentes e providências de recuperação/segunda chamada ainda abertas. Vencimento de prazo ou consumo de oportunidade sem realização não inventa nota.

Resultado completo insuficiente pode ser confirmado como final insuficiente. Isso não permite progressão. Exigir mínimo geral e em cada habilidade; não há exceção de nota. Frequência abaixo do mínimo requer regularização ou exceção específica independente, com motivo e evidências. A exceção conserva a frequência real e não supre notas ou registros ausentes.

Correção ou recuperação posterior autorizada gera nova versão do resultado, preservando o fechamento anterior. Uma mudança nas fontes torna o resultado anterior inadequado para uma nova decisão de progressão até revisão; não apaga o histórico.

## Integração com mudança de nível

Tanto a aprovação quanto a execução verificam resultado final suficiente e atual, ausência de pendências e as demais condições acadêmicas. A aprovação referencia o fechamento usado. A execução não pode aceitar uma versão superada por mudança nas fontes entre as duas etapas. Parecer docente ou dispensa justificada e aprovação independente continuam exigidos; a Secretaria executa sem receber acesso financeiro ou acadêmico mais amplo por consequência.

Se uma correção afetar progressão já executada, registrar pendência de revisão. Não desfazer a alocação automaticamente. Nenhum fechamento, aproveitamento ou resultado altera mensalidades ou encerra matrícula por conta própria.

## Evidências exigidas para concluir a implementação

### Consulta do fechamento pelo aluno

A sessão própria do portal determina o aluno; a consulta não aceita identidade de funcionário para obter acesso ao fechamento. Para cada matrícula e nível, conferir a versão mais recente e sua atualidade nas mesmas fontes utilizadas pela gestão. Compartilhar o cálculo interno não compartilha a autorização administrativa.

Apresentar fechamento suficiente ou insuficiente somente se versão, contexto e fontes continuarem válidos. Se mudaram, identificar que o fechamento está em revisão e manter o histórico institucional. Ausência de fechamento não se transforma em resultado final apenas porque todas as notas foram lançadas. Resultado final suficiente não anuncia progressão aprovada ou executada.

A projeção do portal não inclui hashes, documentos internos de evidência, motivos reservados, identificadores de aprovadores ou o snapshot integral. Ela pode apresentar versão, data de confirmação e situação do fechamento junto ao acompanhamento acadêmico já permitido. Outro contrato do mesmo aluno conserva seu próprio fechamento; dados de outros alunos permanecem inacessíveis.

### Verificação

- Integração com banco: mesma pessoa com vários contratos, versões das regras e fontes oficiais, isolamento de aluno, autoria, imutabilidade e concorrência.
- Transferência: proposta, aprovação independente, execução, pendências do destino, preservação das fontes e bloqueio do caminho direto.
- Fechamento: pendente, suficiente e insuficiente; mínimos individuais/geral; frequência e exceção sem mudar valores reais; segunda chamada e recuperação.
- Progressão: alteração entre confirmação/aprovação/execução, revisão após execução e impossibilidade de autoaprovação.
- Portal e equipe: resultado parcial/final identificado, permissões e apresentação conferidas em execução real.

Testes unitários isolados e build não bastam para declarar essas frentes concluídas.
