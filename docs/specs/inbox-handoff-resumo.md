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


### Composição sobre349 corrigida e expectativas completas
A fontef95688f7 incorpora34923fb eMain170edbad;12SRC351 são byteiguais aoDEV/QA6fe. Um13ºpath de teste acrescenta somente handoff:null a quatro expectativas completas, mantendo os nove toEqual. RED completo1124/3d2992:11passes/2falhas em13,saída1; GREEN completo49233/22d738:13/13,76,35s,saída0,um worker,sem filtro/skips. RestauroROOT98878/db4b5d terminou0:424hashes/1378registros/sequências preservados. QA independente nominal:7/235UNIT e3/34INT,lint12;restauroTESTER55a5ff. [Evidências e limites](../../output/inbox-351-qa/indice.json). UNITglobal/TSCoriginal da composição em curso;CI/revisão final/publicação/merge pendentes. Não concluir351 e não somar recortes.


### Gates originais da fonte integrada e899cef2
ROOT aprovou a regressão UNIT global:941arquivos/7.483testes,448,67s,doisworkers,sem filtro/skips na configuração unitária que excluiINT (sessão53058/terminalc68959,saída0). TypeScript ORIGINAL sem exclusões/incremental,heap8192MB:85065/e8c411,saída0. Lint GLOBAL43255/98c001,saída0,zero erros/40avisos herdados. Os13SRC do manifesto foram conferidos no commit e899cef25252452614a73b46303c444c8ba8e51e:12iguais aoDEV6fe e fixture adicional com4defaults completos. Nenhuma fonte mudou durante os gates. A dependência349 ainda aguarda integração completa/merge;CI/full351 e revisão final continuam separadas.


### Dependência349 integrada em main
A PR424 foi mergeada em7c880a81eedea7d6c9fc4167b8d7bad310c63586. A composição351 incorpora essaMain, preservando toda a árvore executávelf99fa9a7:os conflitos de squash foram resolvidos mantendo os quatro arquivos351 já testados e a documentação349 atual. O quadroMain permanece integral, com o bloco351 unido. [Identidade](../../output/inbox-351-qa/composicao-main349.json). Não houve mudança de função/ACL/schema/dependência nem repetição dos gates de código. Full35140145615424 segue nominalf99 e está emcurso;CI final será conferida após retarget paraMain.
