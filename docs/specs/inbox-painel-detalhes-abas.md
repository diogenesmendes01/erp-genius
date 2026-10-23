# Inbox E2.3 — cabeçalho, Detalhes e rota por aba (#323)

Base ddf9a9bd51eb6fd54abd2a6e64381a229a25190b, branch codex/inbox-e2-323. ReadyDB completo recebido após Prisma5.22/duas migrations322 aplicadas exclusivamente pelo integrador. Banco dev-email487, snapshot novo E2 inbox_snapshot_323_a_20261023 (424tabelas553registros), preservação original conferida. Apenas helper preservar-banco-323-a.mjs ROOT pode restaurar; nunca helper318. DEV não altera schema/migration/package/lock nem gera Prisma.

## Contratos aprovados

Pessoa da ficha: atendimento no escopo, finalidadeCOMERCIAL; lead autorizado por podeVerLeadNaThread, pessoa principal do lead exceto responsável legal. Só SEMlead aceita contato.pessoaId emescopoPessoas, sem lápide/legal. Lead negado, semPessoa ou regra6 não permite fallback por telefone/contato. Db opcional deve seguir atendimento/lead/escopoComercialAtual/escopoPessoas na mesma conexão; defaultprisma compatível com consumidores anteriores.

Pessoa principal não é necessariamente interlocutor: naConversa, subtítuloB2B e decisor usam pessoa do CONTATO efetivo quando ligada aos participantes autorizados da oportunidade. Sem correspondência, nenhum naConversa e decisornull. Avatarquadrado segue flagb2b; blocoB2B exige empresa real. B2B sem empresa/interlocutor usa cargo/empresa conhecidos sem partes vazias, ou stringvazia; nunca inventarEmpresa/Pessoa física.

Moeda: pais.moedaLocal ou null; valorDecimal serializa string, semBRL/mensalidade inventada. PessoaPainel entrega campos mínimos previstos; telefone comercial é doContato. Demais setores têm Detalhesvazio/cabeçalho semdadosPessoa, mantendo conteúdoE1.

Campos: ✦ quando último CampoPersonalizadoAlterado daquela pessoa+campo tem autorIdnull, com ordemtotalestável. SQL parametrizado projeta apenas payload->>campoId/autorId e DISTINCT ON reduz ao último por campo, ordem criadoEmDESC/idDESC; jsonb_typeof restringe campoId a string válida. Nenhum payload completo é carregado; não há concatenação de parâmetros. Semevento=false; humano posterior remove✦. Não retornar payloadde/para/acaoId nem camposEmpresa. Tags disponíveis sódepois de identidade autorizada+editarTags; vínculos de tags existentes preservados, tagsDaPessoa privada/TagPainel.id somente324.

CapacidadesPainel321 é projeção, sem conceder acesso. D1responsável/contexto#354 e CPF/nascimentoD13 pertencem às própriasissues. Não mudar matrizesglobais/configAria/autorização de envio.

## Recorte e composição

Novos painel-detalhes.ts (DTOs/resolver/consultas/subtítulo), painel-abas.ts (AbaDados e dispatcher), rota /api/inbox/atendimentos/[id]/painel/[aba]. paineis.ts recebe cabecalho opcional e identidade consistente para tags sem recursão (direção paineis→detalhes). Acoes/Aria/podeEnviar/dadossetoriais E1 preservados. SemJSX, novasabas ou polling/SSE paralelo.

Aba insights/qualquerdesconhecida:400 sem consulta de domínio após autenticação/alçada. detalhes:200no-store ou404 foraescopo. oportunidades/atividade são vocabulário válido mas retornamnull/404 atéprodutores327/333, semstubs. Rota E1/painel permanece atual. Auth401/403 precede resolução de domínio.

## Plano TDD / gates

1. RED unitário puro/rota por móduloausente descrito honestamente, mais REDcausal doDb na funçãoexistente (cliente global não pode ser usado se tx passada).
2. Implementar helpers/rota mínimos após RED, preservar imports seguros/tipos reais.
3. Unitários sem DB, lint dirigido e regressões de rota/predicados; TSC após ReadyDB/Prisma do integrador.
4. Depois deReadyDB separado: testes reais de carteira/equipe/cobertura/convites/revogação, pessoa semlead/legal/mescla/linha, setores/multiroles, interlocutor diferente, empresa/moeda nulas, autoria porcampo e empate; regressões paineis.int/paineis-envio.int/pool1/participantes. Uma suíte porbanco com sessões atéterminal0.
5. TSCheap8192/lint/gates coordenados, SPEC/quadro/report, QAexata. UI N/Ainfra; compilação/inbox coordenada se grafo cliente mudar. Sem global/DB/browser presumidos.


## Verificação e limitações

Evidências e todas as tentativas negativas em output/inbox-323-report.md. Infraestrutura sem UI nova: nenhuma captura/homologação presumida. Cabeçalho/Detalhes usam resolver comum; tags existentes consultam a pessoa resolvida pelo cabeçalho, inclusive fallback sem lead, mantendo tags históricas. Quatro expectativas integrais não comerciais de paineis.int recebem só o novo cabecalho esperado, preservando demais campos/negativos. Fixtures unitárias de tags preservam os nove casos e o produtor real, acrescentando apenas projeções necessárias.

Pedido de pool1 é validado em transações reais: carteira própria, equipe, cobertura de outro titular, convite de leitura e revogações visíveis ainda na tx; fallback escopoPessoas também é chamado na tx. Parâmetro Db não habilita autorização nova. Filtros e skips de execuções parciais são declarados no relatório, sem chamar recorte de suíte global.

Gates DEV finais observados em Node22.23.2:15arquivos143unit (1be1d1);9arquivos80INT em duas sessões exclusivas A14422/32185;TSC10376 heap8192/lint12fontes77357a max0/diffcheck0. Sem filtro de nome/skips novos nas execuções finais; RED D13 isolado -t/10filtrados só histórico. Banco liberado ao ROOT após sessão32185 terminal0, restauraçãoE2/QA/global integrado ainda sob coordenação. UI N/A, sem homologação presumida.

Evidência EXTERNA do integrador após liberar o banco: ROOT def141 terminal0, snapshotE2 A restaurado,424hashes conferidos/553registros originais/fixture9mensagens4notas preservada. Nenhum preview ou nova suíte A iniciada; essa restauração não foi executada pelo DEV. Gates DEV acima permanecem os mesmos; QA independente/global integrado/publicação aguardam coordenação.
