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

## Correção P2 após QA de6076

Catálogo de tags exige simultaneamente pessoa resolvida válida e capacidades.editarTags. A capacidade projetada pode continuar true para lead autorizado sem pessoa/legal; isso não autoriza consultar catálogo sem alvo. Guarda local pessoa && capacidades.editarTags, sem mudar matriz321/escopos. RED não vazio com tag ativa e editarTags=true nos dois contextos; unitário prova ausência da consulta. Nominais6076 não cobriam essa borda e permanecem históricos. Pós-patch:15/145unit,3/28INTcompletos,TSCheap8192/lint3fontes/max0/diffcheck0,Node22. RechecagemQA/global integrado e restore desta janela E2 sob coordenaçãoROOT.


## PR409 R1 — decisão D13 e rastreabilidade vigente

Base desta revisão:58b2d4b8574772dc70232cbe05188041c03cfe99. C1 da review5633341791 recebeu decisão humana explícita em23/10: “Permitir esses dados para qualquer convidado autorizado na conversa comercial”. Isso confirma o comportamento existente; nenhum gate contatos.ver é acrescentado à projeção contextual de Pessoa/empresa/participantes B2B. Não altera capacidadesCrm/CRM global: os três papéis FINANCEIRO/PROFESSOR/GERENTE_PEDAGOGICO continuam sem contatos.ver, os campos personalizados permanecem[] para eles e editarContato/editarTags não passam a ser permitidos. Convite só de leitura também não ganha envio.

A autorização continua passando por escopoAtendimentos e podeVerLeadNaThread vigente; não existe fallback com lead negado/sem pessoa/legal nem aproximação por telefone. Pessoa principal e interlocutor efetivo continuam distintos. Sem convite, revogado ou expirado, esses papéis não alcançam o atendimento comercial da fixture; fora do COMERCIAL, inclusive PEDAGOGICO, a exceção não se aplica e os DTOs sensíveis seguem vazios. Resumo contextual de empresa não libera /empresas global. Documento/nascimento futuros e demais campos D13 permanecem em suas próprias tasks.

Os três casos novos de painel-detalhes.int.test.ts usam it.each para esses papéis e PII não vazia: Pessoa com email/cidade/cargo/linkedin/origem/telefone, empresa com documento/segmento/porte/site e dois participantes B2B com cargos. Antes do convite a consulta nega; vigente devolve os DTOs completos; revogação e expiração negam novamente. Convite ainda vigente em PEDAGOGICO/SECRETARIA/FINANCEIRO mantém Detalhesvazio/cabeçalhosempessoa. Campo personalizado e catálogo ativo são criados e visíveis ao dono para provar que campos[]/tagsDisponiveis[] do convidado não são ausência vacuosa. Testes são contratuais sobre comportamento já implementado: não se inventa RED de um patch runtime inexistente.

### C6/C7/C8 — contratos e limite intencional

- C6 já está fixado nos Contratos aprovados: ficha principal é lead.pessoa, enquanto naConversa/subtítulo/decisor usam contato.pessoaId efetivo entre os participantes da oportunidade autorizada. Sem correspondência, nenhum destaque/decisornull. Task16 e UI devem consumir esse contrato, não trocar pela ficha principal.
- C7: subtítulo B2B sem cargo/empresa/interlocutor é stringvazia intencional. A futura UI324 deve tratar stringvazia como ausente; não inventar rótulo ou renderizar linha vazia. Esta infraestrutura não afirma que324 foi implementada.
- C8: carregarPainel ainda resolve dadossetoriais e cabeçalho separadamente, com duas passagens de autorização/consulta; nenhuma otimização/caching/transação global foi introduzida. Consolidar posteriormente exige preservar alinhamento de identidade/veLead e contextoDb. Esta revisão não promete um snapshot atômico do painel inteiro nem mede desempenho.

### C9 — mapa dos critérios da Task3 aos nomes reais

Nomes/linhas originais são da fonte58b2; a inserção de novos casos pode deslocar posições. Caminhos relativos a src/server/inbox salvo indicação. Testes mais amplos foram preservados sem renomear.

| Critério no plano | Caso(s) reais e oráculo |
| --- | --- |
| comercial: pessoa, oportunidade e campos; ✦ só no campo que a Aria preencheu por último | painel-detalhes.int.test.ts: carteira: DTO mínimo, valor decimal e moeda do país; cabeçalho e agregado usam a mesma pessoa + campos: último evento por pessoa/campo e desempate id, sem dados de empresa/payload no DTO |
| regra_6_e_linha_alheia_nao_carregam_pessoa | linha alheia autoriza conversa mas não lead nem fallback pelo contato; fora do escopo é null + lead sem pessoa ou responsável legal não usa pessoa do contato |
| oportunidade_sem_pessoa | lead sem pessoa ou responsável legal não usa pessoa do contato; oportunidade é preservada, pessoa/campos ficam vazios; catálogo de tags exige identidade autorizada: %s, mesmo com editarTags cobre sempessoa/legal com catálogo ativo |
| fora do comercial não traz nada da pessoa (D13) | D13 filtra pela finalidade mesmo em multirrole e não retorna telefone; novos três casos de convite também cobrem PED/SEC/FIN |
| pessoa semlead e fallback | sem lead: fallback somente à pessoa do contato dentro do escopo, não por telefone, incluindo mescla/legal/carteira |
| B2B e interlocutor | B2B: ficha principal difere do interlocutor efetivo, empresa contextual não amplia capacidade global; campos/cargos/naConversa/decisor são explicitamente verificados |
| empresa nula e subtítulo/nome | B2B sem empresa mantém quadrado, bloco null e subtítulo sem dado inventado; semNome segue fonte real com trim, incluindo lead sem Pessoa |
| carregarPainel leva o cabeçalho | carteira: DTO mínimo... verifica carregarPainel pessoaId/cabecalho.pessoaId; caso semlead verifica agregado; paineis.int.test.ts mantém contratos setoriais com cabeçalho esperado |
| tags/autoria | tags disponíveis só ativas e edição autorizada; vínculos históricos E1 preservados; paineis.int.test.ts pessoa comercial visível traz ordem por nome e marca sem autor, sem filtrar vínculo histórico e convite vigente autoriza tags e revogação retira o painel inteiro |
| Db/pool1/carteira/equipe/cobertura/convite | pool1: autorização carteira/cobertura/equipe/convite na MESMA tx e revogação imediata; whatsapp/visibilidade-lead-db.test.ts prova não pedir cliente global |
| rota detalhes/abas/autenticação | painel-abas.test.ts Detalhes preserva o resultado autorizado e o null do produtor; %s não consulta nem fabrica dados antes da entrega; rota painel/[aba]/route.test.ts cobre auth/códigos/no-store |
| decisão C1 nova explicitada | D13 aprovado: %s convidado comercial recebe Pessoa/empresa/B2B sem contatos.ver; ausência, revogação, expiração e outro setor não ampliam acesso, expandido para FINANCEIRO/PROFESSOR/GERENTE_PEDAGOGICO |

C2 requer os dois arquivos INT completos desta revisão, com configintegration/maxWorkers1/perfilA e Ready/snapshot nominal; resultados finais no relatório output/inbox-pr409-review-todos.md. C3CI, C4composição/pais/main/QA280 e C5quadro permanecem com integrador. As correções de revisão398 e402 precisam entrar na composição final dos pais; esta revisão409 não as copia parcialmente nem reescreve seus hooks/contratos. QA/global/CI anteriores continuam atribuídos às fontes originais, sem homologação presumida.
