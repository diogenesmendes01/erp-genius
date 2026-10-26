# Inbox #340 — Documento e nascimento na Pessoa LATAM

## Decisão e fronteira

D13 aprova documento/nascimento opcionais na Pessoa e idade calculada, sem CPF-only. Registro4d8c7512b260dbe42221727783e2eaf5a621d046 tem o mesmo blob c70767bc0683c2819ad55d7ec157b439a8430704 da base local. A exceção contextual PR409 do convidado comercial continua limitada aos dados antigos aprovados: não inclui novos Doc/DOB/idade. Leitura futura exigirá contexto comercial + contatos.ver + escopoPessoa atual; edição mantém contatos.editar e binding fresco, sem nova permissão global.

## Fase1 autorizada

Branch codex/inbox-e2-340-documento-latam parte de db441, preservando338. Publicação futura será somente delta340 em base pública preparada ROOT, sem levarD10 parcial por herança. Nesta fase só há autoria schemaSQL/puro, sem ligação a writers/DTO/UI.

Reserva ROOT499:20261025205000_inbox_pessoa_documento_nascimento. Pessoa ganha4nullable: documento TEXT, tipoDocumentoId TEXT com FKRestrict/Cascade paraTipoDocumento, documentoPaisEmissor TEXT ISO3166 e nascimento DATE. Inversa TipoDocumento.pessoas e índiceFK. Sem UNIQUE/default/backfill/syncAluno. Schema/SQL congelados; ROOT validou/gerou client4992cf80d56 e aplicou DDL efc083 EXIT0 somenteA:497migrações reais/426tabelas/563linhas baseline. Snapshot d158d7 EXIT0. Sem validate/generate/DDL pelo DEV. Restaurador exclusivo ROOT499; nunca498.

País do catálogo vem do TipoDocumento; emissor é independente de mercado/residência/nacionalidade. Validação reutiliza cpf/cedula_cr/curp/dni_ar/dui_sv/passaporte existentes. Formato inválido/validador desconhecido não bloqueiam nem apagam número; tipo inválido/país incompatível são incoerência de referência, não formato. TipoNULL não escolhe CPF automaticamente.

Patch puro estrito: omissão preserva literalmente, null/vazio limpa somente campo explícito da tupla; número só trim nas bordas, sem normalização global CPF/caixa. Campos arbitrários/idade/flag/autor não são aceitos. Projeção copia apenas4campos, nunca extras de objeto raw. Auditoria da tupla/DOB só guarda presença, sem número/data/idade/hash.

Nascimento é civil YYYY-MM-DD. Data/instante/offset não é aceito no patch. Idade recebe hoje civil institucional explícito, não host/browser;29/02 completa no01/03 em ano não bissexto. Zero é idade válida; ausente/futuro/calendário inválido/fuso ausente retornaNULL. Não há política1900/idade mínima inventada. NascimentoCivilSchema específico limita ano0001..9999 pela representaçãoDATE/contratoYYYY, sem alterar DataCivilSchema genérico.0000/10000 são recusados e0001/9999 preservados; isso não é corte etário.

## Pendências obrigatórias

Shared writers/DTO/gate/UI somente após client499/GO ROOT. Não copiar Aluno no backfill/GET nem sincronizar edição acadêmica; mescla preserva principal/lápide e não transfere novos campos. Não acrescentar novos dados a prompts/Aria/Insights/export/cache automaticamente. Vetos de excluir TipoDocumento precisam considerar pessoas além de alunos; ordem Pessoa/Tipo/User e NOWAIT/fresh após esperas/FK/Evento exigem caracterização nativa futura.

Unidades/doubles não provam ACL/SQL. Nativos/pool1/NOTIFY, testes de JSON/SSR convidado negado, guardas/gates originais, QA independente e visual continuam ausentes. #340 não está concluída nem habilitada em runtime.
## Checkpoint fase2 — writer CRM e leitor privado

O contrato puro agora é reutilizado por editarPessoaNaTransacao somente quando os quatro campos novos são explicitamente informados. Omissão preserva o caminho legado/no-op. O ramo cadastral exige contatos.ver + contatos.editar e escopo da mesma Pessoa com ator fresco na conexão da TX; TipoDocumento/autor usam KEY SHARE NOWAIT, sem retry automático. Erro de contenção é convertido fora da TX; FK indeterminada recebe mensagem cadastral genérica, sem atribuição falsa ao tipo nem metadata sensível. Evento guarda apenas presença, e a validação CRM final acontece depois do callback pós-Evento.

O leitor privado exige contatos.ver/escopo, projeta quatro valores, usa fuso operacional somente por leitura e oferece catálogo mínimo apenas a quem pode editar. Depois da seleção sensível, confere novamente ator e identidade/escopo por select de id, sem reler os quatro valores, e falha fechado se os papéis mudarem. Isso não promete linearizabilidade além da última conferência. A fronteira Inbox ainda deverá acrescentar COMERCIAL/binding fresco e manter blocos constantes NULL quando negados; o leitor não está ligado ao DTO público/UI neste checkpoint.

A infraestrutura499 foi preparada exclusivamente pelo ROOT; os testes deste checkpoint são UNIT com doubles, sem SQL. Wrappers/DTO/UI, vetos de exclusão, rollback real Pessoa+Evento+aviso, pool1/NOTIFY, SSR/DOM, gates originais, QA independente e visual continuam pendentes. #340 permanece parcial.

## Fronteira Inbox fase2

DetalhesPainel possui dois blocos aditivos separados de PessoaPainel409: cadastroPessoa e informacoesCadastro. Ambos são NULL sob negação, sem bits de existência. O gate novo relê ator, exige contatos.ver, escopoPessoa e contexto COMERCIAL da mesma identidade; rebind durante leitura descarta somente os novos blocos. Catálogo permanece sob contatos.editar. Header/capacidades globais não são ampliados.

Na escrita dos novos campos, o wrapper usa Atendimento NO KEY UPDATE antes do núcleo Pessoa, captura binding mínimo e revalida contexto/ator/contatos.ver+editar/escopo após esperas e aviso. Só o ramo cadastral recebe esse delta; o payload legado omitido preserva o fluxo existente. A recusa causa rollback da mesma TX por contrato, cuja prova PostgreSQL ainda está pendente. Erros imprevistos desse ramo são sanitizados fora da TX. Nenhuma dispensa de assumir/enviar ou permissão CRM é criada.

## Interface Inbox e manutenção do catálogo

AbaDetalhes apresenta documento pessoal, tipo, emissorISO, nascimento civil e idade derivada somente quando ambos os blocos autorizados existem. Idade0 aparece como0anos; idadeNULL como travessão. Número não validado recebe aviso legível sem bloquear edição.

Gaveta mantém quatro controles opcionais sob o catálogo de edição autorizado. O estado inicial e o campo físico não são substituídos por refresh. Se o novo DTO negar o bloco ou mudar identidade, o cadastro fica indisponível até reabrir, sem reaproveitar ACK/handler ou enviar rascunho sensível; demais campos antigos continuam conforme contrato. Diff envia apenas propriedades cadastrais alteradas: salvar nome não restaura Doc/DOB do snapshot; vazio explícito de campo alterado viraNULL. Não há key por valores nem idade editável.

Tipos usados por Pessoa também impedem remoção na manutenção do país; renomear preserva ID. Count obrigatório e deleteMany com alunos:none AND pessoas:none complementam FKRestrict. A prova de concorrência dessa manutenção ainda depende de nativos.

## Ficha globalCRM

obterContato mantém assinatura e dados antigos; acrescenta somente cadastroPessoa/informacoesCadastro explícitos. A leitura desses blocos ocorre em TX curta ReadCommitted e passa conexão ao helper. Isso evita reutilizar escopoComercialAtual memoizado por React.cache no singleton durante a mesma renderização; não altera cache/defaults para outros consumidores. GlobalCRM exige contatos.ver+escopo atual, escrita exige também editar, sem conversa fictícia.

FichaContato mostra nascimento civil/idade0 e quatro controles opcionais somente sob os blocos/catalogo autorizados e capacidade atual. O payload antigo mantém seu contrato; valores cadastrais não alterados são omitidos e vazio alterado limpa somente o campo explícito. Idade não é editável, número malformatado permanece salvo com aviso. Não sincroniza Aluno nem transporta novos valores para prompts/exportações. SQL/DOMglobal/visual ainda pendentes.

## Callback cadastral da ficha global

A edição cadastral possui geração vigente de abertura, vida, capacidade e busy; closures retidas não são autorização. Atualização para blocoNULL ou perda de edição invalida a geração, inclusive reconcessão no mesmo ID. Handler antigo não envia nem altera draft durante execução; ACK de geração inválida não produz sucesso/refresh. Nova abertura autorizada pode editar novamente com estado novo. O servidor continua responsável por freshACL/escopo, sem alegação de bypass confirmado. Campos e payloads legados preservam fluxo anterior.

## Gate antes de selecionar os quatro valores na escrita

O ramo cadastral usa o lock de identidade Pessoa FOR UPDATE já existente; não adiciona outro. Depois de sua espera e do callback, relê ator ativo/nãoPortal/contatos.ver+editar antes de pessoaNoEscopo selecionar valores sensíveis e scope db-aware. Continuam as conferências após FK/Evento/callback/aviso. Omitidos preservam o caminho antigo. Unidade distingue lock/leitura de identidade da seleção de documento/nascimento; SQL real ainda exige lease.

## Commit anterior ao efeito passivo

A publicação/veto da geração cadastral usa efeito de layout no filho, antes do layout do ancestral, inclusive cleanup. Não depende de o efeito passivo já ter rodado. Em Gaveta, o efeito legado de vivo.current permanece useEffect literal; só o controle novo do cadastro muda de fase. A prova ReactDOM conserva o mesmo formulário e dispara callback retido no commit de revogação. O servidor ainda deve rejeitar com suas ACL/binding frescos; nenhum bypass servidor foi demonstrado pelos oráculos de UI.

## Verificação nativa pendente

Os testes nativos autorados após a implementação não são RED retroativo. Cobrem transações/ACL/locks reais com fixture fictícia; mocks somente de sessão/nextcache e injeção de barreira/falha explicitamente qualificada. NOTIFY usa LISTEN real, sem spy como prova de entrega. Cache usa implementação realNext e dispatcher instrumental, não renderizaçãoRSC/browser. Cancelamento de query só pode atingir o PID da própria conexão isolada comprovado antes, sob leaseROOT, após confirmar a coleta do logger. Nenhum deles foi executado neste checkpoint.

## Prova da FK documental

A exclusão de TipoDocumento referenciado deve ser recusada pelo RESTRICT da FK Pessoa_tipoDocumentoId_fkey, sem exigir um código de abstração Prisma específico. O nativo exige o PostgreSQL SQLSTATE23001 e a constraint, além de verificar Pessoa/Tipo intactos antes de testar a manutenção/renomeação. A primeira execução confirmou recusa e falhou na expectativa P2003; a nova expectativa ainda precisa de replay admitido. Nenhum runtime foi alterado por essa correção.

## Instrumentação de dois writers

A prova exige dois processos reais bloqueados na mesma leitura Pessoa sob holder conhecido, permitindo caminho direto ou indireto no grafo observado. Os PIDs vêm de pg_backend_pid dos próprios clientes/holder, não de busca ampla. A fila de locks não é confundida com concessão de ACL ou prova de deadlock. Os resultados de ambos, Pessoa e dois Eventos continuam obrigatórios depois de soltar a barreira. UPDATE de fixture usa a tabela física Lead, conforme @@map. A lógica produtiva não muda.


### Instrumentação do cache nativo — revisão test-only
O negativo 2e97b0 (1 passou/3 falharam) terminou antes do catálogo: as três revogações não ocorreram. protegerTransacoes captura o cliente base; a extensão derivada não observava a TX real. O teste agora observa por callthrough a transação protegida e o tipoDocumento.findMany efetivamente concluído. Cada cenário exige canário SQL/captura/retorno no mesmo caminho antes da revogação. React.cache instalado e dispatcher instrumental permanecem; não é renderização RSC/browser. Lint focal 12601/47af1c EXIT0. Runtime 04eed permanece literal. Arquivo7 e seis regressões seguem não executados; #340 permanece parcial.


### Coletor de logger nativo (test-only)
Negativo 68385/7b2518: 3 casos, 1 passou/2 falharam no canário console.error; Prisma emitiu prisma:error em stdout. O cancelamento não foi alcançado. Runtime instalado library.js contém emissores console.log/error/warn/info; o coletor agora observa os quatro com callthrough preservando emissão e registra o canal real do canário antes do teste. Ausência de Doc/DOB, ownPID/banco/app/UPDATE/holder seguem mandatórios. Lint82982/a4f108 EXIT0. Runtime04eed literal; nova execução ainda pendente neste checkpoint.

### Nativos e regressões executados — fonte 25a93e83
O arquivo 7 completo passou em 93774/e63469 EXIT0 (3/3). Os dois canários registraram o canal real console.log com emissão preservada. O cancelamento foi somente da conexão própria, com PID/banco/app/UPDATE/FKholder conferidos; ausência de Doc/DOB e rollback foram verificados. O negativo 7b2518 permanece preservado e naquela execução o cancelamento não foi alcançado.
As seis regressões completas passaram, em série: contatos 66056/d6fb34 (5), pessoas 27193/f300c2 (16), duplicados 72700/3d3b2c (14), painel-detalhes 61600/a5cac7 (16), acoes-painel-contato 78364/fecf43 (21), pool1 18618/918ff6 (1): 73 casos nesta seleção, sem filtros/skips. Original integration config, UTC, w1, heap1024, no-file-parallelism e sete provedores vazios via bootstrap. Não é suíte global.
Proveniência dos sete novos arquivos sem repetição indevida: arquivos 1/2 verdes 0482 (7/5), arquivo 3 verde 34c7 (8), arquivos 4/5 verdes 34c7 (3/3), arquivo 6 verde 6a6c (4), arquivo 7 verde 25a9 (3). São 33 casos distintos; históricos negativos preservados. Os 27 pins foram reconferidos; runtime 04eed/schema/client/perfil literais. Lease e Node liberados para restauro exclusivo ROOT A499; baseline não presumida.
Recibo privado output/inbox-340-native-final25a9-receipt-private.json SHA f57383c26da54ae3b3b1d2e6293b0ab24178fbe8aa02efb10819f550b2dc920e. #340 permanece parcial: gates originais/QA independente/visual e publicação seguem pendentes; puros/DOM não são browser.