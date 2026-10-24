# Inbox #351 — resumo do handoff no servidor

O DTO AriaDoAtendimento ganha handoff: HandoffDoAtendimento | null. O produtor depende da #342 e do contrato compartilhado da #349; sua publicação aguarda a integração da #349. Interface #352, ação de Assumir, envio, aprovação e novas alçadas continuam em suas próprias issues. D1–D3 orientam as futuras #354–#358.

## Fonte e cronologia

O atendimento deve chegar autorizado pelo caller. handoffDoAtendimento recebe o Db e consulta idsHandoffPendente da #342, restrito ao ID. Sem pendência, retorna null. A fonte é a última HANDOFF EXECUTADA, por criadoEm DESC e id DESC. SIMULADA e BLOQUEADA não são fontes. Encerramento e resolução por HUMANO, CELULAR ou Assumido seguem a #342, sem duplicar seu predicado.

O campo feito contém as dez ações mais recentes autorizadas, EXECUTADA ou APROVADA, exceto HANDOFF, com criadoEm <= pedidoEm. Os candidatos são lidos em páginas keyset de 100 e autorizados em lote pela oportunidade própria ou pelo fallback do atendimento, até dez ou EOF. Não há limite artificial de 200 ou consulta por item. O DTO apresenta criadoEm ASC e id ASC. O ID desempata; não prova causalidade. criadoEm não é a data da aprovação, e o estado da ação não comprova entrega externa. A resposta de transição criada por executarHandoff entra pelo mesmo predicado.

A leitura reutiliza escopoComercialAtual e a autorização contextual canônica do lead do atendimento. Participação não concede acesso a outro lead arbitrário. Ações de outro lead fora do escopo são excluídas. Ações sem alvo ou contexto autorizado usam frases sem dados. decidirHistorico não é usado para leitura.

## Resumo e privacidade

A nota pertence ao ATENDIMENTO. Pela regra E0, todo leitor autorizado recebe o resumo, inclusive convidado vigente sem carteira ou contatos.ver. O exemplo histórico que negava esse resumo ao convidado está superado. A fonte é payload.nota da HANDOFF escolhida. Quer vem de Resumo; proximoPasso vem de Próximo passo. Sem ambos, resumo é null.

Campos personalizados mostram nome e valor somente com contatos.ver e contexto autorizado; caso contrário, a ação permanece como “Preencheu um campo”. Tarefas exigem tarefas.ver e leitura atual do ID persistido em payload.tarefaId, com escopoTarefas (minhas, fila ou equipe), em uma consulta em lote no mesmo Db. ID ausente, inexistente ou fora do escopo gera “Criou uma tarefa”, preservando quantidade e cronologia. resultado.tarefaId é uma variável local do executor mesclada no payload; AcaoAgenteIA não tem coluna resultado.

O descritor valida folhas primitivas e enum, preserva 0 e false e não serializa payload. Resposta, documento, agendamento, nota, condição e setor usam frases fixas sem corpo, URL, percentual ou campo bruto. feito contém apenas texto e quando. O nome do destinatário vem do ID histórico do payload, ou null. ehResponsavel usa o responsável atual da conversa, representado no atendimento; podeAssumir informa a capacidade atual de fila/linha, sem mutação.

## Formato canônico e rótulos

lerNotaResumo reutiliza Motivo, Resumo e Próximo passo do formatter. Aceita subconjuntos em ordem canônica, CRLF e continuações; preserva quebras internas e aplica trim nas bordas dos valores. Preâmbulo, inclusive linhas vazias ou espaços, rótulos duplicados e ordem regressiva retornam {}. Não acrescenta ao formatter um limite de nota manual.

O formato legado não escapa conteúdo que imita um rótulo posterior: essas linhas são indistinguíveis de separadores. A ambiguidade está documentada e testada; não se promete inversão arbitrária. montarNotaResumo e executarHandoff permanecem idênticos.

MOTIVO_HANDOFF_LABEL centraliza os 13 textos antigos do Playground e acrescenta “Turno interrompido”. O tipo inclui o motivo de sistema, sem mudar o schema de saída do modelo. Motivos desconhecidos, inclusive constructor e __proto__, devolvem motivo null e “Motivo não informado”, sem ecoar o código. Destino desconhecido usa FILA_SETOR; nome ou nota ausentes permanecem null. O Playground conserva layout e textos conhecidos, importando o mapa central.

## Db e compatibilidade

Pendência, autorização, ações, tarefas e nomes usam o Db recebido. Não há transação interna ou conexão global quando o caller fornece tx. O teste com pool de uma conexão lê nome, carteira, tarefa, nota e ações ainda não commitados e confirma o rollback. Não se promete snapshot universal em READ COMMITTED.

podeVerLeadNaThread foi movido literalmente para whatsapp/visibilidade-lead.ts, com import e reexport compatíveis no módulo anterior. Corpo e assinatura são idênticos. escopoTarefas foi reutilizado sem alteração ou extração adicional.

Fontes da #349, decoder, histórico, executor, estado da #342, uso, schema e dependências ficam preservados. Cinco literais de teste do cliente e três expectativas completas recebem somente handoff: null. A guarda de mapas acrescenta o novo mapa e uma exceção exata por arquivo/nome para a descrição histórica contextual, sem alterar o classificador.

Visual novo: N/A, produtor interno e refatoração de rótulos com layout e textos existentes preservados. [Relatório DEV](../../output/inbox-351-report.md) registra gates, negativos e limites. QA independente, CI e publicação permanecem com ROOT.
