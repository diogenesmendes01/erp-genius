# Inbox #371 — Carga por pessoa

O seletor Pessoa da transferência usa radios nativos obrigatórios, com nome e contagem de conversas abertas em duas linhas. A seleção continua sendo usuarioId; contexto, chave idempotente, gerações e confirmação permanecem no controlador existente. Durante carregamento/envio o grupo fica indisponível. Consumidores históricos sem carga mostram “Carga indisponível”, sem inventar zero.

A carga é um snapshot informativo ao abrir Pessoa. Não há polling, presença, reserva ou redistribuição; presença é #376. O novo leitor exige atendimento visível, aberto, não grupo e alçada atual de atribuir, reutilizando candidatos autorizados existentes. Não implementa a autorização contextual pendente de #370 nem conclui D5.

Uma groupBy conta somente IDs oferecidos, no mesmo setor, encerradoEm null E status diferente de ENCERRADO. Não restringe o total à carteira do consulente; retorna somente usuarioId e número, sem IDs/conteúdo de conversas ou CRM. Após as leituras revalida ator, capacidade, origem e candidatos. Uma groupBy não significa um SELECT total. Listas/APIs históricas atribuir e convidar mantêm contratos e política.

A interface conserva foco local, seleção ao voltar, navegação nativa, fieldset/legend, required e disabled. O registro nominal Campos retira apenas “Pessoa · obrigatório · select”; os testes reais verificam a equivalência por radios. Parser e negativas da guarda não mudam.

Sem schema, cliente, índice ou mutação de distribuição. O RO mediu somente baseline minúsculo e não justifica índice #496. QA independente, gates compostos e homologação visual permanecem pendentes.
