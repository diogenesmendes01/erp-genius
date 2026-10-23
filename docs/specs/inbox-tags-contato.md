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

Visual obrigatório ainda pendente: painel-detalhes e painel-sem-nome, 1440×900 / 1024×768 / 390×844 nos dois temas, mais altura500, tags extensas/foco/teclado/popover. Fixture real semnome exige preparo coordenado; não alterar seed histórica nem inventar DOM. Sem DB no browser/produção/envio/instalação/Prisma/package/lock.

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
