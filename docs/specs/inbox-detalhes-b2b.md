# Inbox #325 — Detalhes comerciais e participantes B2B

## Contrato

A apresentação comercial consome o DTO autorizado de #323 e os destinos produzidos pela #336. Não resolve atendimentos no navegador nem concede capacidade de envio. O participante atual recebe “Na conversa”; os demais recebem “Falar com” somente quando `hrefConversa` não é nulo. Empresa, Pessoa e oportunidade mantêm suas identidades distintas.

O cabeçalho utiliza o subtítulo e o formato de avatar projetados pelo servidor. A oportunidade atual exibe produto ou título, valor na moeda do registro e etapa, sem periodicidade mensal presumida. Enquanto #327 não fornece a aba Oportunidades completa, o cartão navega para `/funil?o=<id>`. Nenhuma aba vazia é habilitada.

Contato/perfil/empresa usam `LinhaCampo`; dados nulos ficam explícitos. A marca “Preenchido pela Aria” depende da autoria já projetada no DTO. “Abrir ficha completa” e “Ver empresa” exigem suas capacidades próprias; um convite comercial não autoriza essas fichas globais.

D13 segue o esclarecimento humano da PR409: dados contextuais podem ser lidos pelo convidado atualmente autorizado no atendimento comercial, preservando filtros de Pessoa legal, carteira/linha e campos personalizados. Não ampliar a matriz de permissões. Documento e nascimento opcionais LATAM continuam na #340; não acrescentar CPF/idade/preferências na #325.

## Aquisição e composição

O hook `useAbaPainel` portado isoladamente da #326 faz GET no-store somente para Detalhes comercial ativo, por chave atendimento/aba/versão/tentativa. Abort e identidade de contexto impedem a apresentação de respostas antigas. Loading, erro com Retry e ausência legítima são estados distintos. Não há intervalo ou nova assinatura SSE.

A integração futura da #326 reutilizará esta mesma instância para Detalhes ativo OU editor aberto; o editor não integra o escopo desta entrega. Fora do comercial a composição E1 permanece; ações Aria, contato, opt-out e triagem continuam abaixo dos detalhes conforme os gates existentes.

## Verificação e pendências

Testes de apresentação e composição estão em preparação. Os gates exigem cliente/perfil487 fornecidos pelo integrador e saída terminal observada. Nenhuma execução em cliente490 será atribuída a esta base487. Aceite visual, QA independente, integração, CI e publicação permanecem pendentes. Harness pertence à frente326 e não é alterado nesta fase.

## Checkpoint DEV — 24/10/2026

Base `8d843c06e52eaf78d2232a3033be10d0e9b59650`, ramo `codex/inbox-e2-325`. Produtores de Detalhes, capacidades e links B2B da #336 permanecem sem alteração; não há migração nem delta de dependências. Hook e teste portados isoladamente de `2de9d10b82b52a5d6b1492d3553eec4d3551c22c`, com blobs idênticos.

RED por asserções: nove falhas em onze testes antes da apresentação. GREEN inicial: três arquivos e 22 testes. O recorte causal final passou com 69 arquivos e 726 testes. A suíte unitária geral final passou com 924 arquivos e 7.252 testes (sessão 4380, terminal 45dc6b, 157,10 s, quatro workers). Integração final: três arquivos completos e 41 testes (sessão 32745, terminal d4e174, 229,96 s, um worker). TypeScript com heap 8192 (95233/20aaf5) e lint dos nove arquivos (2c76f9, warnings máximos zero) terminaram com código 0. Não foram usados filtros por nome nem testes ignorados nessas execuções.

O banco descartável ci-integracao487 foi fornecido e restaurado pelo ROOT antes da rodada final; a lease foi liberada após a saída terminal da integração. O restauro posterior cabe ao integrador e não é presumido neste checkpoint. Nenhum submit manual, preview, captura ou envio real foi executado para a #325.

A entrega é revisável localmente. Aceite visual dos estados Detalhes/B2B, QA independente, integração, CI e publicação continuam pendentes. A #325 não está concluída nem homologada. Detalhes dos comandos, negativos e limites estão em `output/inbox-325-report.md`.

## Ajuste textual D13/LATAM

Após o checkpoint `05588ca5`, o rótulo passou a “Documento da empresa” por aprovação do ROOT, sem alterar `empresa.documento` ou o contrato de dados. O teste usa documento PJ chileno fictício e não cria campo de Pessoa. RED `c9d894` e GREEN `97434/447bf9` (69 arquivos/726 testes, 17,10 s), além do lint dos dois arquivos `116014`, foram observados com saída final 0 no GREEN/lint. Global, TSC e integração anteriores permanecem atribuídos a `05588ca5`; não foram repetidos para esta cópia. Visual e QA continuam pendentes.

## Harness visual325

A extensão separada preserva190 combinações953 e acrescenta30 (total220): Pessoa e B2B com referências reais c1/c2; convidado APP-only/N/A de autorização por convite. O preflight exige dois GETs reais, IDs/credenciais explícitos e contrato D13; prontidão valida corpo, destinos, capacidades, forma132 e documento contido. Guardas críticas de hidratação, semântica318/324, rodapé, cancelamento recuperado e React permaneceram idênticas953.

Gates do harness: 16 arquivos/115 testes `7a72c9` (2,80 s), TSC `226547`, lint14 `fbda5b` e syntax4 `74e4b9`, todos EXIT0. Nenhuma nova integração, aplicação de fixture, navegação HTTP/browser ou captura. Fixture/plano privados foram entregues para inspeção ROOT e novo READY; dados originais/canônica não foram alterados. O preparo do harness não encerra o aceite visual/QA da #325.

## Recuperação restrita do GETDetalhes no harness

A prova causal325 permite diagnosticar somente aborto GET exato do mesmo atendimento/página/contexto quando outro GET iniciou depois, observou headers200, concluiu corpo JSON com hash igual ao preflight e a página/semântica atual é revalidada no fim. Não muda guardas953/SSE nem APP;200 sem corpo, body diferente, outra identidade/ID/query/POST ou troca/desmonte seguem negativos.

Primeiro lote26ab1b (uma PNG) e diagnóstico c588cb continuam negativos privados. Validação focada c578af terminou0 sem PNG, após corpos/Tab; não é aceite visual. TDD RED23→GREEN138, unitário final16/138 b6c655,TSC60126/f7c101,lint4a1e86d e syntax2d86b3f terminaram0. A rodada formal30+6 e QA visual continuam pendentes de avalROOT; APP permanece ddf872e.

## Revisão R2 do coletor visual325

O coletor de d1f51 aguardava apenas Promises inseridas em requestfinished e podia ignorar um GETDetalhes já iniciado. A revisão bloqueou a rodada formal. A prova focada c578af continua nominal, sem PNG, e não comprova a conclusão de todos os STARTs; os negativos anteriores permanecem preservados.

A barreira nova rastreia cada START do GET exato por página/contexto/atendimento até falha ou headers/corpo/hash concluídos. Inclui pedidos iniciados enquanto aguarda, impõe prazo comum e sela apenas revisão estável, zero pendências e DOM atual válido. Eventos posteriores ao selo reprovam. Listeners permanecem até browser.close, com auditoria após o contexto e veredito final após o browser. SSE/guardas953 permanecem intactos. Falha tardia de 48 não é recuperada pelo GET38 anterior.

Reprodução em memória dos callbacks originais: 7f1915/EXIT1, falso verde confirmado sem HTTP/browser/DB. Testes finais de eventos e harness: 40d4ce/EXIT0, 17 arquivos/150 testes, sem filtro por nome ou skip imposto; TSC heap8192 fc8bb6 e lint4/syntax2/diff4a7fc3 terminaram0. APPddf, servidor, schema e dependências sem delta. Os detalhes e negativos estão no report325. A rodada30+6 permanece suspensa até revisão e aval ROOT; esta correção não atribui aceite visual.

## Freeze visual DEV — 24/10/2026

Corpus inspecionado individualmente: 36 imagens, 24 APP e 12 referências estáticas. APPddf/harness96c. L1/74891 permanece EXIT1, com 18 APP selecionadas por arquivo e primeira referência rejeitada sem PNG. L2/18441 terminou 0 com 12 PROTO e seis APP320 restantes. Nenhuma repetição das 18 APP. A referência original falha antes de toBottom por ausência de prevState; exceção exata PROTO/hashes/callsites aprovada e registrada. Não comprova autoscroll, posição da thread, foco, comportamento após seleção ou aceite funcional. APP/953 permanecem sem exceção.

Seis probes reais53179/a656b7 terminaram 0: links Funil/ficha/empresa/AdminA/B/leitorA por Tab+Control+Enter, URLs e contexto reais, leitor A200/enviofalse e B404/sem hrefB. Alvos A/B sem lead comprovam thread e ausência legítima de oportunidade. Em 320×500, documento/rótulo estão contidos com rolagem real. Fotos, hashes, fontes, negativos e limites em output/inbox-325-visual.md e allowlist; ZIP privado com 38 entradas/38 hashes conferidos. Assets e brutos ficam fora do Git. ROOT stop/restauroae152c/0: 424 hashes/498 linhas; AGENTSNext removido sozinho. Visual DEV favorável por arquivo; QA independente, composição, CI e publicação pendentes. Não concluir a issue antecipadamente.

## Integração e QA independente final — 24/10/2026
Composição bf42c956 diretamente main239: nove blobs APPddf e18 do harnessd775 conferidos independentemente pelo TESTER (23621/cdc305, saída0), sem backend/schema/deps/337. Pareceres integrais em output/inbox-325-qa/indice.json. QA visual final favorável delimitada:36 imagens reais inspecionadas em resolução original, ZIP38/hashes/proveniência/probes conferidos; parecer437EF02A89978AAA33906CF5E260680BCB967C6D110C9EF8C97260D3C847E1C0. L1/74891 continua saída1, com18APP aprovadas individualmente; L2/18441 saída0 forneceu12 referências estritamente estáticas+seis APP320. Limite herdado do protótipo preservado, sem afirmar seu lifecycle funcional. Seis probes53179/a656b7 saída0, sem reatribuir versão futura de executor. Preview parado/banco restaurado ae152c saída0/424hashes/498linhas. Regressão global final ROOT em curso; publicação/CI/comentários/merge pendentes, sem encerramento ou homologação presumida.

Gates finais da composição bf42: GLOBAL86371/3a5714 saída0,926arquivos/7298testes,240,28s,maxWorkers2,semfiltrodenomeouskips/configunitexcluiINT; TSC56393/54a572 e lintglobal61942/79eb4d saída0 (zeroerros/40avisosherdados). Integração3/41anterioré nominal ao produto/servidor idêntico, sem nova execução. Setepareceresintegrais e limites no índice QA; CI/publicação/merge ainda pendentes.

## Revisão R1 da PR417
B1: o hook mantém o último DTO bom durante versão/retry e falha transitória, preservando DOM/foco; ID/aba/ativação continuam identidades isoladas e403/404 revogam o cache. C1: telefone autorizado do item aparece no comercial sem Pessoa; nenhuma nova autorização ou dado consultado. RED58d5bd6falhas/18pass; GREENe76b843completos33casos+lint4zeroavisos;TSC71274/3f8f09 saída0. Global21939 emcurso, QA/CI/mergependentes. C2ZIP/PNG anexados emcomentário6386805037, nominaisAPPddf/harness96c. C3rótuloLATAM jáaprovado; C4callbacké327. C5“sem CPF nem idade (D13 padrão)” corresponde ao B2C comassert explícito not.toContain deCPF/Idade; “sem_pessoa_sem_edicao” corresponde a“sem Pessoa não apresenta perfil nem links”. Disposições completas emoutput/inbox-325-revisao-r1.md, sem duplicar cobertura ou atribuir nomes literais que não existem.

GlobalfinalR1 ROOT21939/026749:saída0,926arquivos/7309testes,236,42s,maxWorkers2,semfiltrocasosouskips/configunitexcluiINT. Demaisgatesnominaisacima; QAindependente/CI/mergeaindapendentes.

QA independenteR1 fd1ea:3/47 e8/163sobrepostos,TSC/lint4todos0,parecer3148C600DB05A3A5E65847E2A76E3A7AD3A0471885A19A124956ABC75BA06477 emoutput/inbox-325-qa/revisao-r1.md. Índice8preservaseteanteriores/corpusnominal. DisposiçõesB1/C1–C5registradas;CIheadnovo/mergependentes.
