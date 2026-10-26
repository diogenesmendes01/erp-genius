# Aria e alterações na aba Atividade — #334

Candidata DEV A sobre a composição local b437e13c4bca27e36b006a1896f3571ea95b9d52. A cadeia de PR será nomeada pelo integrador. A implementação não está homologada enquanto os gates originais, a revisão independente e o aceite visual estiverem pendentes.

## Leitura e contador

AtividadePainel acrescenta aria e alteracoes; CabecalhoPainel acrescenta contadorAtividade. O módulo Aria exige atendimento visível, finalidade COMERCIAL e oportunidade atual visível por podeVerLeadNaThread. Fora desse contexto retorna null, lista vazia e contador zero. As agendadas, notas e tarefas da #333 mantêm suas autorizações próprias.

A lista contém EXECUTADA, APROVADA e DESFEITA, exclui CLASSIFICAR_SETOR e ordena por criadoEm e id decrescentes. A seleção preenche até 30 itens depois da autorização, por keyset em lotes de 100. Uma oportunidade explícita diferente exige escopo comercial próprio; Pessoa do payload precisa corresponder ao contexto autorizado. Não há fallback de nomes por IDs. O contador é a quantidade de EXECUTADA/APROVADA dessa mesma lista limitada; DESFEITA não conta. Requisições separadas de cabeçalho e aba conservam essa mesma política, sem promessa de snapshot transacional entre HTTPs.

Última ação consulta qualquer status menos SIMULADA com a mesma autorização. Nos estados que comprovam execução usa texto de alteração; sugestão, rejeição, falha e demais estados sem efeito comprovado usam rótulo neutro canônico. Preparar resposta/documento não significa entrega externa.

## Configuração e apresentação

A versão PUBLICADA rege os limiares e a matriz. Somente ausência de publicação usa configPadrao canônico, atualmente 80/50. A referência 75/55 do plano anterior diverge do padrão ERP atual; uma publicação válida customizada em 75/55 continua soberana. Publicação inválida lança erro, sem fallback silencioso. O DTO projeta somente executaAPartirDe e transfereAbaixoDe. Configuração global e rascunhos não são alterados.

Automático e Com aprovação derivam de ACOES_MATRIZ e modoDaAcao na etapa atual autorizada; não se inventa etapa ausente. A confiança apresenta percentual em mono, faixa em texto e barra de 4 px com largura percentual e cores semânticas brand/warning/danger. O Tailwind atual as expressa por bg-brand-solid, bg-amber-600 e bg-danger; texto de aviso usa text-amber-700, sem inventar os utilitários warning-solid/danger-solid do plano antigo. A região mantém role=meter, valor e limiares acessíveis; a interpretação não depende só da cor.

Alterações desfeitas usam risco, opacidade 0,5 e meta Desfeito antes do instante no fuso exibido. Desfazer usa botão canônico com ícone de retorno. Introdução e vazio seguem a issue. Adaptação aprovada: o cadeado é decorativo e o motivo fica inline, legível sem hover ou title, seguindo o Histórico global. Isso substitui o popup do mock sem mudar reversibilidade ou criar botão sem ação. Motivo ausente recebe explicação canônica.

## Desfazer contextual

D1 permanece: capacidade por ação da #354, incluindo vendedor responsável em contexto compatível, sem conceder permissão global nem substituir autorização por carteira. Reutiliza a API pública desfazerSugestaoNoInbox; não há endpoint duplicado nem flag pública de bypass.

O wrapper mantém Acao → Config quando necessária → Atendimento FOR NO KEY UPDATE → alvos/FKs, com ator, ACL e bindings frescos depois das esperas. O replay opt-in interno exige DESFEITA real, mesmo desfeitaPorId e último Evento AcaoAriaDesfeita do mesmo autor, agregado AcaoAgenteIA e ID da ação. O replay não chama reverter, update, Evento ou aviso. A API global/default continua literal, inclusive erro histórico para DESFEITA.

A UI usa ConfirmarAcao real e idempotente para esse contrato contextual. Voltar não chama a action; duplo clique é bloqueado. SSE próprio pode antecipar DESFEITA sem perder ACK válido. Troca A→B→A, desmontagem/reabertura, revogação conhecida e mudança da identidade do alvo invalidam ACK antigo. Erro/resultado incerto permanece na confirmação, sem retry automático.

## Limites e validação

Sem schema, migração, dependências, configuração global ou permissão nova. Não se afirma ausência geral de deadlocks nem linearizabilidade global de ACL. SQL usa perfil descartável exclusivo e barreiras reais com finally. Falha de Evento injetada é distinguida de falha SQL espontânea no QA.

Pendentes no freeze: gates originais coordenados, QA independente e visual APP/PROTO original em três larguras e dois temas. O blueprint offline não é captura nem aplicação de fixture.
## PR444 R1 — contador independente e textos históricos (C3/C4)

O cabeçalho usa carregarContadorAtividadeAria, que compartilha o leitor autorizado de histórico com carregarAriaAtividade. A fábrica mantém atendimentoVisivel, COMERCIAL+lead, podeVerLeadNaThread, escopoComercialAtual/Pessoa, lotes100/keyset criadoEm/id desc e até30 depois da autorização. DESFEITA ocupa a janela mas só EXECUTADA/APROVADA contam. Não é contador global por countSQL.

A leitura de contador não busca publicação/configuração, última ação nem alçada de desfazer. O módulo completo continua parseando publicação estritamente; configPadrao só vale na ausência, nunca em publicação inválida. Header/painel podem manter contador e podeEnviar de contexto mesmo se a configuração publicada for inválida; isso não afrouxa os guards de envio/execução da Aria. O Db opcional inclui leituras/autorização na mesma conexão; o default preserva a chamada de leitura histórica de dois argumentos.

Quatro fallbacks de ALTERACAO_ARIA_LABEL passam ao passado: Preencheu um campo, Adicionou uma tag, Moveu a etapa, Criou uma tarefa. ACAO_AGENTE_IA_LABEL permanece neutro para sugestão ainda nãoexecutada. Preparou resposta/documento continua sem afirmar entrega externa. IDs do payload não viram nomes.

Validação DEV: RED nativo2/10 por ConfigAriaSchema real, GREEN arquivo completo10/10; UNIT3/161 (mapa completo de enums), focal final11/106 com UI real/guarda paginação e Db explícito; detalhes e recibos no relatório C3/C4. Ambiente compatível B493grant/client383 preparado pelo ROOT, não atribuído ao perfil492. O fix histórico de fixture cliente-voltou (ROOT57822fc2) é carry qualificado; nenhum mock do contador. C1 visual de Atividade como gerente/vendedor e gates de composição continuam pendentes.
