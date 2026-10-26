# Inbox #371 — Carga por pessoa

O seletor Pessoa da transferência usa radios nativos obrigatórios, com nome e contagem de conversas abertas em duas linhas. A seleção continua sendo usuarioId; contexto, chave idempotente, gerações e confirmação permanecem no controlador existente. Durante carregamento/envio o grupo fica indisponível. Consumidores históricos sem carga mostram “Carga indisponível”, sem inventar zero.

A carga é um snapshot informativo ao abrir Pessoa. Não há polling, presença, reserva ou redistribuição; presença é #376. O novo leitor exige atendimento visível, aberto, não grupo e alçada atual de atribuir, reutilizando candidatos autorizados existentes. Não implementa a autorização contextual pendente de #370 nem conclui D5.

Uma groupBy conta somente IDs oferecidos, no mesmo setor, encerradoEm null E status diferente de ENCERRADO. Não restringe o total à carteira do consulente; retorna somente usuarioId e número, sem IDs/conteúdo de conversas ou CRM. Após as leituras revalida ator, capacidade, origem e candidatos. Uma groupBy não significa um SELECT total. Listas/APIs históricas atribuir e convidar mantêm contratos e política.

A interface conserva foco local, seleção ao voltar, navegação nativa, fieldset/legend, required e disabled. O registro nominal Campos retira apenas “Pessoa · obrigatório · select”; os testes reais verificam a equivalência por radios. Parser e negativas da guarda não mudam.

Sem schema, cliente, índice ou mutação de distribuição. O RO mediu somente baseline minúsculo e não justifica índice #496. QA independente, gates compostos e homologação visual permanecem pendentes.

Revisão PR450 C1/C2, R22: a contagem mantém o recorte autorizado do setor do atendimento e agora o explicita como “N conversa(s) aberta(s) neste setor”. Não soma atendimentos de outros setores nem muda elegibilidade. Os controles 0/1/2, carga desconhecida, foco e seleção continuam no arquivo completo do popover.

O cenário de sucesso447 C1 agora cobre tanto contexto vazio, válido no novo fluxo369, quanto contexto digitado com mais de12 caracteres, verificando o payload e o aviso preservado após desmontagem. Não se restaura mínimo12 no opt-in; a API histórica mantém sua regra. A alegação sobre `setores` foi conferida: o próprio head98205a21 da PR450 já contém SECRETARIA em useTransferirConversa.test.ts, literal ao arquivo desta composição.

ROOT: RED92d017 EXIT1(um caso falhou/22 controles passaram), seguido dos oito arquivos completos/85 casos, sessão88474/5f8db7 EXIT0. Lint três arquivos9ba5a0 EXIT0/zero avisos. São recortes, não suíte global; presença e regras de distribuição preservadas. Visual específico e CI permanecem pendentes; nativos anteriores conservam a proveniência registrada, sem reatribuição a esta mudança de texto/teste.
