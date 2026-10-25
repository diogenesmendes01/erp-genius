# Transferir unificado — #360

Status: em validação, implementação local com UNIT/INT; visual, QA independente e gates do integrador pendentes. Não encerra D5: #369 (contexto opcional setorial/resumo) e #370 (grant contextual da nova transferência) são dependências obrigatórias. Base c2b77326069bee1d48b1688233dd20e0b4f85fc1 + correção test-only ROOT 32c1 em 61a8e381.

O gatilho Transferir reúne Pessoas, Equipes e filas e Devolver para a Aria. Escolher uma categoria não executa ação; há confirmação deliberada. Pessoas mantém a alçada atribuir atual, setor mantém transferir, fila exige responsável não nulo e devolver, e Aria usa podeDevolver do painel autorizado. Grupo/encerrado não oferecem operação. A pessoa atual não aparece no picker. Nenhuma exceção de carteira é concedida por ser responsável. O atalho Aria #348 existente e suas regras permanecem, assim como APIs/consumidores legados; Atribuir e Devolver para fila deixam apenas o menu do coordenador novo.

Desktop: painel340 px por portal fora do containment; mobile: folha pelo mesmo diálogo/ref. useDialogo fornece Escape, foco contido, bloqueio durante execução e retorno ao gatilho. A mudança de passo foca campo local; não há seletor global. O Header tem somente a linha de callback ref opcional, sem mudar classes/layout. O integrador aplicará esse delta sobre seu Header responsivo mais novo.

Identidade, responsável e capacidades invalidam a abertura e o ACK anterior, inclusive A→B→A. A restauração exige fechar/reabrir. Cada abertura tem leitura própria de pessoas; dados da anterior não reaparecem durante a nova leitura. Retry preserva chave por entrada; outra entrada usa outra chave. Nenhum foco de compositor é acrescentado.

Pessoa usa transferirPessoaInbox: contexto opcional trim/max1000, idempotência antes do lock do Atendimento, ator/ACL/destino frescos depois da espera, dono/cancelamento/evento/nota na mesma TX. Replay também exige destino ainda no escopo e recibo atual; não cria Evento/nota. Cancela somente HUMANAS PENDENTE/ADIADA do responsável anterior. IA, ENVIANDO e outras conversas são preservados. Falha de nota faz rollback integral.

Setor usa o comportamento histórico min12 e contexto atômico até #369. Os núcleos foram extraídos sem use server; schemas/hash/retornos/defaults globais e núcleo setorial permanecem. Fila/Aria usam actions históricas. Nenhuma flag de bypass é recebida do cliente, e não há schema/client/dependência/heartbeat/SSE novo.

Validação DEV: UNIT focal ampliado115 arquivos / 1.384 casos EXIT0 (sessão76052/75727b); INT novo14/14 EXIT0 (21645/32bedb), incluindo pool1, esperas reais e replay após revogação comercial; regressão histórica4 arquivos/41 casos EXIT0 (26978/32a3fe). Os14 substituem o recorte anterior13, não somam27. Configurações originais, UTC, w1/heap1024, sem filtro de caso/skip; INT sem paralelismo de arquivos e sete providers vazios. A falha de persistência da nota é injeção pontual declarada; transação/SQL/ACL reais, sem driver externo.

Lint focal final e0ec93 EXIT0, zero avisos; recibo de freeze separado. Pendências explícitas: revisão técnica do delta, commit individual/publicação pelo integrador, TSC/global/build, visual e QA independente. Banco liberado ao integrador após cada terminal; DEV não restaurou nem declarou503 após suas fixtures. Relatório: output/inbox-360-report.md.

## R2 — porta de renderização explícita (2026-10-25)

A guarda original classificava a função passada como JSX children em CoordenadorAcoesConversa como formulário aninhado. O oráculo independente confirmou que os formulários físicos são irmãos. A função agora passa por prop explícita renderizar, no padrão já usado pelo controlador, com chamada selfclosing. Não há mudança de topologia, portal, handlers, key, permissões, backend, parser ou exceções.

Evidência R2: RED dad62b EXIT1,23casos22 pass/1 fail; GREEN 29bf78 EXIT0,23/23 incluindo negativas originais, w1/heap2048. UI relevante 46301/cb2299 EXIT0,13 arquivos/222 casos, w1/1024. Oráculo T copiado byteigual SHA d9698922575d40cbf72363ede30339d653baae38d1af7471c3826a2d79839d4c,3176f6 EXIT0,8 casos (5 sobrepostos e3 independentes); Controller/Popover/useDialogo reais e compositor como fixture form, não teste visual. Config privada adapta só include; original intacta. Lint e recibo final R2 separados. Backend literal78fb: INT14+41 não repetidos, conforme coordenação ROOT.
