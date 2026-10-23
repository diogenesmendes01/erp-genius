# #323 — relatório DEV A (código validado no recorte, QA/global pendentes)

Branch codex/inbox-e2-323, base ddf9a9bd51eb6fd54abd2a6e64381a229a25190b. Node22.23.2 local. Implementação exclusivamente no worktree inbox-dev-a/perfil dev-email. Nenhuma instalação, schema, migration, Prisma, cluster, preview/browser ou escrita de negócio executada pelo DEV. Integrações usam apenas vitest.integration.config.ts/maxWorkers1, uma sessão DB A por vez. O integrador aplicou schema322487 e gerou Prisma5.22 antes do Ready.

## Contratos entregues

- Resolver privado comum autoriza Atendimento antes de consultar Pessoa/Oportunidade detalhada; Db opcional propagado por toda a autorização, carteira/equipe/cobertura/convite/escopoPessoas, default prisma compatível. pessoaDoAtendimento retorna somente os IDs previstos.
- Pessoa principal do lead autorizado para ficha/cabeçalho/tags; contato efetivo distinto para interlocutor B2B, naConversa e decisor. Sem lead pode usar contato.pessoaId em escopoPessoas; lead negado/semPessoa/legal não dá fallback, nem busca/fusão por telefone.
- DTOs mínimos: telefone do contato só comercial, empresa contextual sem abrir ficha global, valor decimal string e moeda do país/null. Quadrado mantém b2b mesmo sem empresa; bloco exige empresa real. Fonte do nome real com trim nos campos de contato.
- Campos reutilizam camposDaPessoa. SQL parametrizado aprovado projeta APENAS campoId/autorId do último evento por campo, DISTINCT ON e ordem criadoEm/idDESC, aceitando somente JSONstring; não carrega payloadcompleto/de/para/acaoId. Pessoa/agregado/tipo delimitados; camposEmpresa não viram camposPessoa.
- Dispatcher só Detalhes entregue, oportunidades/atividade null/404, insights400 sem consulta; auth401/403 precede domínio, dados200no-store. Painel E1 mantém dados/ações/Aria/envio e recebe cabecalho opcional; tagsDaPessoa privada e histórico de vínculos preservado. Nenhuma UI/aba/polling/SSE/permissão global nova.
- D1 vendedor responsável depende do contexto/autorização#354; veLead não equivale a responsabilidade. Dados sensíveisD13 e TagPainel.id#324 fora do recorte.

## TDD e resultados observados até este checkpoint

- RED e38391: módulos novos ausentes (zero assertions executadas nas suites ausentes), Db existente3falhas/2pass por acesso indevido ao cliente global. Correção da expectativa do rótulo RH_OPERACIONAL para o rótulo real Recursos humanos antes do GREEN.
- GREEN8133b0:2arquivos9testes helpers puros/Db, saída0.
- RED DB session17938/754c8b:11falhas, dez por consultas ainda ausentes e uma fixture D13 inválida por tentar reclassificar histórico. Fixture corrigida para criação por finalidade; RED ccdf1f apenasD13:1falha por consulta ausente/10filtrados. Não foi relaxado trigger.
- Primeira implementação DB session2212/77e914:9pass/2falhas de fixture (financeiro sem matrícula e ordem criada em paralelo). Correção somente das fixtures com matrícula/aluno explícitos/timestamps distintos. session86737/438e65:10pass/1fixture pedagógica com telefone atual ausente; corrigida para telefone/whatsapp reais fictícios correspondentes. Negativos preservados, sem contar como falha de feature nem sucesso final.
- GREEN DB session89500/46a942:1arquivo11testes completos, saída0,38.26s de testes. Pool1 real carteira/equipe/cobertura/convidado/revogação e fallback na mesma tx. Sem -t ou skips nesta execução. Depois foram acrescentadas asserções de fallback mesclado/legal e valor real do campo: repetição final session32185/07f68f terminal0,1arquivo11testes completos,39.03s,sem filtros/skips.
- Unitário inicial c48664:5arquivos84testes,0. Ampliado44afae:135pass/8falhas por projeções antigas incompletas da fixture de tags; completadas as projeções sem substituir o produtor/autorização real ou remover casos. GREEN1be1d1:15arquivos143testes, saída0,2.47s, maxWorkers2, sem -t/skips novos, configuração unitária exclui INT.
- TSC session99971/575661:exit1 por contato anulável; estreitamento pelo helper existente comContatoIndividual, sem cast fake. TSC efcf59 heap8192:terminal0. Lint bd7e58:12fontes,0erros/0avisos/max0.
- Regressões DB completas session14422/c8d74c A:8arquivos69testes,terminal0,291.50s,maxWorkers1,sem -t/skips novos: paineis.int,paineis-envio.int,participantes.int,participantes-aviso.int,acoes-atendimento-pool.int,linha-comercial.int,consultas-acoes-atendimento.int,consultas-inbox.aria.int. Somadas à execução final própria,9arquivos80testes integrais em duas sessões sequenciais; não é integração completa do ERP.
- TSC final session10376/9c7d04 heap8192:terminal0. Lint final77357a:12fontes,max-warnings0,terminal0. git diff --check a63944:0. Fontes reservadas/package/lock/prisma/scripts/JSX/AGENTS sem delta.

## Ambiente e limites

Snapshot E2 do integrador inbox_snapshot_323_a_20261023:424tabelas553registros/487migrations; normal9msgs4notas/providers vazios. Apenas helper ROOT preservar-banco-323-a.mjs poderá restaurar. Snapshot/helper318 NÃO pode ser usado após schema322. Durante sessões truncantes, banco reservado; declarar liberação ao fim, sem restauração/SQL manual pelo DEV.

UI N/A nesta infraestrutura. Nenhuma captura antiga apresentada como prova desta fonte. QA exata, global integrado, bundler focado se necessário e restauração final pertencem à coordenação posterior. Não marcar issue/E2 homologada antes desses gates.


## Entrega / handoff

Banco A declarado LIVRE ao ROOT após32185 terminar: nenhum processoDB/preview/browser/teste ativo; não rodar nova suíte após a liberação. Restauração pelo integrador ainda deve ser confirmada, sem atribuí-la ao DEV. Não houve comandosSQL manuais; query SQL parametrizada pertence à implementação de leitura autorizada.

Recorte final unitário15arquivos143testes (1be1d1) conserva guardas sem-polling/inbox-e1 e permissõesCRM/Aria/Inbox, escopos, nome real, rotas velha/nova, tags e dispatcher. Execução unitária exclui .int pela configuração, sem filtro de nome/skips adicionais. Avisos de configuração Vitest (mixed exports/tsconfig-paths) não são falhas dos testes; não alterei configuração/deps.

Não houve global próprio: global integrado e QA independente do commit exato sob coordenação ROOT. Nenhum bundle/browser foi executado pelo DEV; grafo servidor cresce via paineis→painel-detalhes→ficha-dados e importa tipos de painel nos consumidores atuais. Recomenda-se compilação focada /inbox pelo integrador se necessário, sem inventar UI nova/matriz visual. UI N/A para esta infraestrutura. PR/push/CI remota/merge pendentes.

Evidência EXTERNA do integrador após liberar o banco: ROOT def141 terminal0, snapshotE2 A restaurado,424hashes conferidos/553registros originais/fixture9mensagens4notas preservada. Nenhum preview ou nova suíte A iniciada; essa restauração não foi executada pelo DEV. Gates DEV acima permanecem os mesmos; QA independente/global integrado/publicação aguardam coordenação.
