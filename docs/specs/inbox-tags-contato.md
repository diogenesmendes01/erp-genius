# Inbox #324 — tags e contato sem nome

Base local: 272a2b33452944d77b5f1e6ed2a750981f57c1bf. Branch codex/inbox-e2-324. Implementação autorizada; não é aceite final. A publicação será reconstruída pelo integrador sobre a MAIN com o follow-up, sem publicar a história agregada local.

## Contrato

D20: vínculo de tag sem autor conserva a marca ✦; atribuição humana nova registra a sessão real. Repetir atribuição não troca autor nem grava Evento. Tags inativas já atribuídas continuam legíveis/removíveis, mas não se atribuem novamente. Nenhum novo campo/schema.

D13 permite os dados comerciais a convidado autorizado, mas não concede edição CRM. Ações revalidam atendimento, identidade comercial da #323 e escopo/capacidade CRM na transação; nunca recebem pessoaId do cliente. Pessoa do lead, interlocutor B2B e responsável legal permanecem distintos. Catálogo só existe após pessoa autorizada e editarTags. A UI limita sugestões a oito, nunca autorização ou deduplicação.

TagsContato mantém busca sem caixa/acento, pílulas e remoção por capacidade, criação apenas com contatos.editar e carteira.equipe. Correspondência exata considera o catálogo inteiro. Popover com campo real, foco e Escape próprio; mesmo painel/rolagem/ciclo308/395. Sem Menu com input ou novo helper global.

ContatoSemNome reutiliza editarNomeContatoWhatsApp e nomeAnterior bruto (CAS), com limite de 80 e validação de campo preenchido. A cópia não promete que Aria perguntará nome automaticamente: não existe esse contrato implementado. PodeEditarNome controla somente a edição; aviso informativo continua possível. Erro/incerto conserva edição. Input e Salvar ficam indisponíveis durante a tentativa; após OK, a base CAS local passa ao valor confirmado com trim antes da recarga. Sucesso tardio não reconcilia outro atendimento. Não permite editar durante o await e depois reenviar com base obsoleta.

PainelContato ganha slots opcionais aditivos: undefined conserva fallback de leitura, null oculta; slotAviso entre cabeçalho e abas dentro da mesma rolagem. TagPainel.id obrigatório, chave por ID. InboxNovo compõe slots sem alterar consulta/leitura/SSR/SSE/ACK/syncURL. Nota/menções/Compositor/Rodape/Sino são da frente #337.

## Transação e concorrência

Contrato compartilhado aprovado e implementado: alterarTagNaTransacao conserva as regras CRM e retorna flag de mutação. criarOuObterTagNaTransacao valida TagSchema/capacidades. Lock parametrizado por nome exato precede o lock por vínculo; namespaces próprios e tuplas JSON evitam ambiguidade. Exports CRM anteriores mantêm Resultado/assinaturas; criarTag continua recusando duplicata. Wrapper resolve a pessoa na tx, grava Evento e avisa somente se mudou. Callback interno após adquirir o lock revalida identidade/pessoa/lead/capacidades no mesmo Db; troca/revogação durante a espera reverte toda a tx. Não há query global dentro da tx, catch para continuar tx abortada, schema ou canonicalização nova.

## Verificação e limites

TDD: SSR/pureza/segurança, ReactDOM com troca e promessas antigas, integrações de papéis/escopos/idempotência/autoria/rollback/NOTIFY/concorrência e regressão CRM. Node 22.23.2 e executáveis locais; uma suíte por vez no dev-email 487, snapshot E2 #323 restaurado somente pelo integrador. Sessões e códigos estão em output/inbox-324-report.md. Checkpoint: recorte 64 arquivos / 756 testes, TSC heap8192 e lint dirigido zero, saídas terminais 0. Integração cinco arquivos / 53 casos e arquivo de actions final com 15 casos, ambos saída 0 em execuções distintas; não são uma execução única nem a suíte global.

Visual DEV executado sobre produto2396/harnessce658:24formais app×protótipo nos3tamanhos/2temas, mais73complementares de altura500, bordas, foco/teclado/rolagem e CRM local autorizado. Allowlists/hashes/limites e negativos estão em output/inbox-324-report.md e output/inbox-324-visual-parecer.md. Referência semnome originalHTML c9/noName:true, PNGpré-exportado ausente. Sem promessa automática Aria. QAfinal/globalintegrado/PR/CI ainda pendentes.

## Regressão de perda de acesso e rastreabilidade

O 404 conserva o snapshot previamente recebido do mesmo atendimento, como antes. Os controles novos de tags exigem também acoes != null: retiram edição/criação sem remover as tags de leitura. Aria/OptOut/leitura/cache/R6 não mudam; servidor continua revalidando cada mutação. Teste de composição espera a resposta 404 antes de avaliar as capacidades.

| Critério Task 4 / risco | Teste real |
| --- | --- |
| D20 e ações por capacidade | TagsContato.test.ts: D20 mantém a marca somente na tag sem autor; sem capacidade mantém leitura e marca sem oferecer escrita |
| Busca limitada sem truncar catálogo | busca ignora caixa/acento e exclui vínculos por ID; limita oito sugestões sem limitar o catálogo que impede criar duplicata |
| Campo sem nome e cópia factual | ContatoSemNome.test.ts: explica a origem pelo telefone sem prometer automação Aria inexistente; oferece campo nomeado e Salvar apenas com edição autorizada |
| Foco, Escape, setas e await | ContatoCabecalho.interacao.test.ts: popover abre no campo; setas levam do campo às sugestões; resultado de A desmontado não reconcilia B; fechar popover durante await não devolve foco tardiamente |
| Nome/CAS/ocupado | nome vazio não chama action; CAS envia nomeAnterior bruto; nome fica indisponível durante tentativa; OK atualiza a base CAS; confirmação antiga do nome não apaga intenção na troca |
| Slots / 404 | PainelContato.test.ts slots324; três casos composição324 em InboxNovo.interacao.test.ts |
| Autor/no-op/aviso e inativa | acoes-painel-tags.int.test.ts: atribuição humana registra autor/Evento e aviso IDs somente; no-op conserva autoria IA e vínculo histórico inativo pode ser removido |
| Autorização / criação | gerente cria uma vez com nome trim; vendedor edita da carteira mas não cria; cinco contextos negados; convidado com leitura sem contatos.editar |
| Atomicidade / corrida | rollback após mutação/aviso; concorrência real entre conexões; revalida contexto depois de aguardar lock real (troca pessoa / revoga convite); núcleos em duas conexões/pessoas reutilizam nome |
| Mesma conexão | acoes-painel-tags-pool1.int.test.ts: pool1 real: resolução/escopo/núcleo/revalidação/aviso não pedem outra conexão |

Os registros Task12 são exclusivos dos quatro Botões novos, controle × com nome acessível, uma sugestão de rótulo dinâmico, uma pílula dentro do bg-surface e um aria-controls ligado a useId, com âncora e cópia literal. Nenhum sensor/limite foi mudado. O domínio/projeção de capacidades321 e resolução323 permanecem intactos.

## Harness visual — preparo congelado #324

Produto 2396a6c7703d0717a523d93f51a210a75f588135 permanece byte idêntico; somente scripts/testes/documentação visuais mudam. Node22.23.2: recorte de harness b1e89d, 13 arquivos/93 testes, saída0, sem filtro/skips novos; lint1ce79e saída0/max0; TSC sessão19125, aa79df→3b3698, heap8192/--noEmit, saída0. RED5abebe demonstra estado/prontidão ausentes; falhas intermediárias de fixture e referência PNG inexistente estão preservadas, sem enfraquecer a app.

A matriz anterior164 permanece; painel-sem-nome acrescenta12, total176 (106 app/70 protótipo). Recorte formal desta issue:24 imagens, dois estados×três tamanhos×dois temas×dois alvos. Preflight real c0d2c2 saída0 confirmou GET200/semNome=true/podeEditarNome=true do contato324 e Mariana com pessoa/três tags. Preview13519 controlado pelo integrador; restauro823a46 e fixturee11a8f0 são operações externas. Nenhuma imagem capturada neste checkpoint.

Referência funcional sem nome: HTML original docs/planejamento/inbox-prototipo/prototipo/Inbox.dc.html, conversa c9/noName:true, SHA2567698a34bad041c95f45710cfe3ed6f79a97ba5f49bf5d941751c37324233d8cf. O PNG pré-exportado prototipo-estado-painel-sem-nome.png não existe; nenhuma referência foi fabricada. Manifestos devem distinguir produto app, harness e HTML original; a cópia antiga da referência sobre Aria não representa promessa da app. Captura/inspeção/QA/global/publicação continuam pendentes.

## Aceitação visual e segurança da prova

97PNG originais positivos,26pranchas derivadas separadas;8móveisR1 obstruídos pelo indicadorNext e2parciaisR2 ficam fora da allowlist. RecapturaR3 usa somente Preferences→Hide oficial observado, sem CSS/DOM/app modificado. Salvar móvel44px termina emy500sem margem, acessível porTab e rolagem local; último controle e cabeçalho com4tagslongas alcançáveis sem scroll do documento. Normal1440claro semnome não prova a thread independente jácarregada.

A UI real local criou/atribuiu/removeu tags Mariana e salvou nome somente no NOVO contato324 após autorizaçãohumana explícita; vínculos/autoria canônicos preservados. Resultado real confirmado porGET/reload;503étransportecontrolado separado. ROOT restauro74efd6/0 conferiu424hashes/fixture9msg4notas após fechar todos browsers e pararpreview. SemPNG/scriptprivado/log/credencial versionado; sómetadados curados. Ownership doCLI entregue aB337 noce658; produção2396 permanece congelada.

## Composição sobre main e estado vazio — 23/10/2026

A publicação foi reconstruída diretamente da main `2712f4d28722c0c971f5464d82553a1ccfa92560`, após as PRs #411/#412. Os patches da issue foram selecionados; a história agregada das frentes paralelas não integra a branch. A composição `567ed5e1` tem árvore integralmente igual à preparação `f9c14500`; produto e harness mantêm suas fontes nominais acima.

A regressão global identificou o aviso vazio da busca de tags como parágrafo fora do design system. O patch `7ff341db2e11a92d2b42747749ddab469e862603` usa `EstadoVazio role="status"`, registra a âncora no mapa e preserva o botão Criar como ação separada. Não acrescenta exceção nem altera a guarda. Teste de interação demonstra o aviso, foco retido, criação não acionada e remoção do aviso ao encontrar sugestão. RED22f6ac causal; GREEN4arquivos/48testes9ded13; QA independente3/31/789ac0.

Fonte final7ff: unitário completo ROOT77906/5a1b72, saída0,914arquivos/7.188testes/46,30s, configuração padrão sem filtro e excluindo integração. TypeScript97cf38 e lint dos3arquivos077d9d terminaram0/zeroavisos. Integração própria do TESTER na preparaçãof9, árvoreigual567, executou5arquivos completos/54testes193,60s em94331/19cc40,perfilintegracao/cliente487/maxWorkers1. O delta posterior é exclusivamente UI, teste e mapa; não há nova execução de integração atribuída a7ff. Pareceres integrais e hashes original/LF em `output/inbox-324-qa/indice.json`.

As97fotos originais permanecem nominais ao produto2396 e harnessce658. O estado vazio alterado precisa de seis fotos complementares de7ff e não herda o aceite de pixels das fotos antigas. Capturas e publicação final serão registradas no relatório de composição, com fontes separadas.

Complemento visual do estado vazio concluído: TESTER4a5eec,saída0,seisPNG/433192bytes,1440×900/1024×768/320×500×claro/escuro,fonte7ff,semcliquedenegócio. Parecer visual independente e pacote417963bytes/SHAfeee5cab13a78a055c430eddbd6f5f921175ff7795092fe9d76b9829e5a2cc33 indexados no relatório final;asset670692813/roundtripa4b8660. ROOTencerroupreview/restaurou914af4,saída0,424hashes/snapshotmantido. Essa prova complementa as97imagens históricas,semreatribuição. PR/CI/mergeaindapendentes.
