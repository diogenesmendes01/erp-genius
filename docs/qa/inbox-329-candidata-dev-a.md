# Candidata #329 — evidências DEV A

Base:83ad189a0f9ebecacea22def49e9afc63915424e, branch codex/inbox-e2-329-cliente-voltou. Esta candidata contém DTO/UI/Funil e hardening coordenado do ramo lead; não representa aceite final. Gates pendentes: TypeScript original/global, visual APP2temas×3tamanhos/PROTO original, QA independente do commit exato e CI.

## Validação do comportamento atual

Todos os runners abaixo usaram Node local, heap1024, maxWorkers1 e no-file-parallelism. INT usou vitest.integration.config.ts original/perfil dev-email492 com lease exclusiva ROOT, integrações externas vazias. Toda sessão foi acompanhada até terminal0. Recortes sobrepostos: não somar nem chamar de suíte global.

| Recorte | Arquivos/testes | Terminal |
|---|---|---|
| UI/DTO/SSR/Funil inicial |14/162|d38a3b EXIT0|
| Inbox interação/foco/Aria/detalhes |4/133|47c24c EXIT0|
| UNIT ação corrigida/garantir/DTO/linha/AcoesContato/auditoria |6/69|e8cb65 EXIT0|
| ACTION pública corrigida + institucional/controle/repetição/deriva nativa |1/4|139026 session34578→7e5210 EXIT0|
| Concorrência nativa7 + pool1/legados PessoaNULL/rollback4 |2/11|a715d2 session57412→b79c64 EXIT0|
| Concorrência expandida11 + desvincular7 + linha-comercial24 |3/42|db433a session87607→94d1e5 EXIT0|
| Leitura32915 + legados aluno/responsável2 + acesso-atendimento11 |3/28|d7a55c session3362→8512dc EXIT0|
| Lint hardening/provas/ClienteVoltou |9 arquivos|f761af EXIT0 sem warnings|

Filtros exatos das integrações atuais: src/server/inbox/cliente-voltou-action-caracterizacao.int.test.ts; src/server/inbox/cliente-voltou-concorrencia.int.test.ts; src/server/inbox/cliente-voltou-pool1.int.test.ts; src/server/inbox/cliente-voltou-legados.int.test.ts; src/server/inbox/cliente-voltou.int.test.ts; src/server/whatsapp/desvincular-contato.int.test.ts; src/server/whatsapp/linha-comercial.int.test.ts; src/server/whatsapp/acesso-atendimento.int.test.ts. Últimas execuções completas de cada arquivo, sem teste ignorado. UNIT6: src/server/inbox/{cliente-voltou-action-caracterizacao,cliente-voltou-vinculo-caracterizacao,cliente-voltou}.test.ts; src/server/whatsapp/linha-comercial.test.ts; src/app/(app)/inbox/AcoesContato.test.ts; src/server/crm-config/auditoria.test.ts.

## REDs e limites das provas

Antes do patch, ACTION real com doubles DB4/4 f4cc9d e integrada Postgres4/4 session87293→aba141 caracterizaram sucesso institucional em outroID, repetição2Eventos e deriva. A primeira deriva integrada intercalava escrita real via spy de fronteira; não foi chamada de concorrência SQL. Na suíte atual, ela foi substituída por transações reais com espera comprovada por pg_blocking_pids.

REDs da correção: UNITf01eeb EXIT1,2falhas/2controles; INTe88011/session53666 EXIT1,2falhas/2controles; barreiraContato nativa b4cd57/session62689 EXIT1,2falhas/2controles. Depois helper/CAS: UNITe29754 EXIT0,4/4 e INT7e5210 EXIT0,4/4.

O primeiro detector concorrente c7335a EXIT1 tinha uma falha de formato de query,6pass/1fail. O cenário com outroLead a1836e passou1 com6skips porque recusava antes de esperar Contato; foi ajustado para vínculo repetido MESMOlead. Este cenário312c6f EXIT1,1fail/6skips, reproduziu Postgres40P01 real em desvincular. Só após esse RED o ramo lead de desvincular alinhou Selected→Contato. As execuções completas atuais42/42 incluem cenário corrigido, sem skips. Não se afirma ausência geral de deadlocks fora dos escritores/ordens cobertos.

Pool1 limita connection_limit=1/pool_timeout=3 no processo do teste, sem mudar arquivo .env, configuração de DB ou dependências. Prova que esta transação não pede conexão global adicional; sessão inicial permanece fora da TX. O rollback é Postgres real após writes, com erro de Evento INJETADO; não é uma falha nativa do Evento. Repetição manual da ação mantém contrato Evento por POST (2posts→2Eventos); UI idempotente:false e sem retry automático.

Negativos adicionais preservados no ledger: Funil inicialmente falhou por DOM mínimo select.options/self (corrigidos só no teste); depois RED funcional27f13b,4falhas/1pass. DTO RED9ebe52→GREEN3e1b0a16/16. Composição8ac761 RED; lintdd259b detectou ref durante render (movida para efeito); assertions legadas sobre slot direto301766 foram adaptadas para inspecionar filho do fragmento, mantendo slot vazio ausente. INT leitura f86ed2,14pass/1fail, revelou fixture convidado que ainda tinha acesso próprio pela fila; responsável passou para outro dono, nenhuma ACL mudou, rerun31269315/15.

AGENTS autogerado, outputs privados e corpus anteriores preservados fora do commit. Sem install/ci/npx/pnpm, schema/migrations/package/lockfile, ativação externa, push ou deploy. Lease dev-email492 liberada ao ROOT após8512dc; somente ROOT restaura snapshot492, nunca491.

## Correção editorial de guardas, filha da candidata47a4c5c3

As guardas ROOT sobre47 tiveram238/241 aprovados e3falhas: faltavam duas entradas em botoes-mapa; ClienteVoltou imprimia situacao sem rotular; Outras definia rótulos de EtapaLead localmente. O ajuste registra os dois botões e cria SITUACAO_CLIENTE_VOLTOU_LABEL e SITUACAO_OUTRA_OPORTUNIDADE_LABEL em labels.ts, ambos Object.freeze e registrados nominalmente em MAPAS_NOVOS. Nenhum parser/exceção foi relaxado. labels.ts continua exportando apenas rotular e os mapas permitidos; situacaoOutra fica como wrapper compatível no componente, apenas chamando rotular no mapa central. ClienteVoltou usa o rótulo central em minúsculas na frase, preservando seu texto.

A nova etiqueta de outras oportunidades usa os quatro rótulos editoriais aprovados: Primeiro contato · em aberto; Experimental agendada · em aberto; Experimental realizada · em aberto; Aguardando matrícula · em aberto. ETAPA_LABEL global permanece intacto. Não há alteração de backend, DTO, ação, alçada, classe visual ou banco neste commit.

REDs adicionais:66eaf2/session33216→00ec32 EXIT1,299pass/2fail em8arquivos: exporthelpercentral e mapanãoregistrado foram recusados pela guarda fechada. A alternativa de mapas removeu o helper central; e108c5/session30981→6a7ba0 EXIT1,319pass/1fail em10arquivos: etiquetas derivadas de ETAPA_LABEL legado violavam sentencecase. Não houve exceção: os quatro rótulos locais329 receberam revisão editorial, com casos renderizados específicos.

GREEN: d95a13/session19972→654db3 EXIT0,10arquivos324/324,52.81s; heap1024/1worker/no-file-parallelism, sem filtro/skip. Arquivos completos: src/app/{botoes,enums-rotulos,paleta,rotulos,rotulos-dominio}.test.ts; src/components/Botao.test.ts; src/app/(app)/inbox/abas/{OutrasOportunidades,ClienteVoltou,AbaOportunidades}.test.ts; src/app/(app)/inbox/InboxNovo.detalhes.test.ts. Lint whitelist6 e diffcheck971714 EXIT0. Backend47 e DTO congelados para TESTER, sem diff no servidor; sem lease/execuçãoDB DEV A.

Este commit corrige apenas guardas/rótulos do frontend. TypeScript original/global, fullUNIT, visual, QA independente e CI continuam sob coordenação ROOT e sem aprovação presumida. Não foi reaproveitada evidência SQL de47 para afirmar QA desta fonte composta.

## Correção frontend filha de65 após gates globais ROOT

O fullUNIT ROOT65 foi negativo:966arquivos,963pass/3fail;8166pass/3fail8169 (session83803→6895e9). Ofensores: import irreversível sem confirmação em ClienteVoltou, lista vazia fora de EstadoVazio e linha muted sem borda. A TSC originalA session96476→a13da3 terminou2, com1086TS2307 nos três caches Next históricos privados e um TS2352 real na fixture FunilCliente.nova. Caches históricos foram preservados; nenhum tsconfig/exclusão/env/cache foi alterado pelo DEV. ROOT reexecutará a configuração original sobre o SHA final em checkout/dependências próprios do integrador; os negativosA não são chamados de green.

Correções: ConfirmarAcao canônico real/idempotente:false, abertura sem executar, cancelamento seguro por Voltar/Escape e foco devolvido, bloqueio de fechamento/duplo clique durante confirmação, falhas permanecem dentro do diálogo e ACK de sessão desmontada não reconcilia outra (inclui A→B→A). ClienteVoltou.test usa ReactDOM/ConfirmarAcao/Modal/useDialogo e executor reais; só a ação servidor é dublada. Teste DOM mínimo não comprova geometria de browser nem executa vínculo real. EstadoVazio compacto e borda neutra mantêm a superfície muted, com manifesto nominal atualizado. A fixture incompleta de PainelOportunidade recebe cast unknown explícito documentado apenas no teste de fronteira; tipos produtivos não foram relaxados.

O novo ponto de ação foi registrado exatamente por arquivo/módulo/ação e na cópia literal. Isso revelou bug estrutural preexistente: filtrar a lista apenas por arquivo diferente fazia dois donos registrados da mesma action se acusarem mutuamente. Com GO ROOT, a seleção cria Set de pares(modulo,acao) já registrados PARA O ARQUIVO e mantém proibidas todas as demais combinações. verificarConfirmacoes/importacoesForaDaLista/codigoOpaco e PorArquivo não mudaram; não há exceção geral. Autotestes do mesmo caminho cobrem dois donos dentro do ConfirmarAcao, terceiro sem registro com import/alias/reexport, owner que chama fora da confirmação e mesmo nome em outro módulo.

RED/GREEN preservados: UI7ba79d EXIT1,12fail/2pass14 → bdfce4 EXIT0,3arquivos27/27. Guardas+UI10cd91/session95244→864b5e EXIT1,408pass/2fail410 (manifesto de vazio/bugmultiowner). RED específico c841d6/session93447→6804a4 EXIT1,62pass/4fail66, antes do Set exato. Após correção:9172fe/session73994→a7fc53 EXIT0,14arquivos417/417,68.87s,heap1024/w1/semfileparallel, sem filtros/skips. Lint8 e diffcheck21c7f3 EXIT0. Arquivos completos do recorte: src/app/{confirmacoes,estados-vazios,fundo-sobre-pagina,botoes,enums-rotulos,paleta,rotulos,rotulos-dominio}.test.ts; src/components/Botao.test.ts; src/app/(app)/inbox/abas/{ClienteVoltou,OutrasOportunidades,AbaOportunidades}.test.ts; src/app/(app)/funil/FunilCliente.nova.test.ts; src/app/(app)/inbox/InboxNovo.detalhes.test.ts.

Backend/DTO65==47 e labels centrais sem diff neste fix; sem DB/provider/realaction. TSCoriginal/global, novo fullUNIT e QA independente do SHA composto/CI/visual permanecem pendentes ROOT. A rodada visual precisa registrar o ConfirmarAcao aberto e cancelar sem call; o arquivo offline output/inbox-329-visual-proposta-offline-65d9862c-r1-private.md é proposta de65, não execução nem aceite desta nova fonte (SHA físico d86ea437dce0871141d7d0c01f35105be8744967198bc4f3f0f8aca34701f643).

## Guarda de transporte — filha510, produção inalterada

ROOT confirmou TSC original510 no integrador43207→3bc11b EXIT0, sem exclusões e com dependências próprias, e BUILD original51092830→80e288 EXIT0. O fullUNIT51016729→d9b12d terminou1:966arquivos965pass/1fail;8178pass/1fail8179. O único vermelho foi acoes-cliente.test.ts: sua heurística lexical não reconhecia a delegação ao ConfirmarAcao real, cujo transporte já era coberto pela UI canônica. Não se adicionou catch/hook/no-op redundante à produção.

Este fix altera apenas src/app/acoes-cliente.test.ts e documentação. As heurísticas anteriores de catch/useAcaoCliente/executarAcaoCliente e try assíncrono permanecem literais; um fallback AST verifica import de valor nomeado do ConfirmarAcao real (alias nomeado permitido), módulos locais com diretiva use-server e todos os bindings de actions. Só aceita cada referência de action como chamada direta, sem optional-call, no expression-body de arrow sem parâmetros da prop acao do componente importado. Cada action importada de valor precisa de pelo menos uma chamada admitida; referências escapadas, shadowing/declarações locais dos bindings e componentes homônimos/falsos são recusados. Nomes puramente de tipo/importtype são ignorados; utilitários locais estáticos sem use-server não viram actions. Não há helper ou mudança em código produtivo.

Fallback não resolve cadeias/framework nem loaders: importEquals/dynamicimport/require e reexportação de valor não suportados falham fechados, inclusive loader dinâmico de utilitário puro. Isso só restringe o novo fallback; não modifica o caminho lexical legado. A guarda de confirmação irreversível continua fazendo sua prova PorArquivo e seus parsers/exceções permanecem intactos.

REDs:1ea084 EXIT1,28pass/4fail32 (caso global e três positivos canônicos)→dcb90e EXIT0,32/32. Optional-call216c26 EXIT1,34pass/1fail35, depois fechado; guarda+18focais509c4b/session27090→8404c1 EXIT0,19arquivos480/480. Auto-revisão acrescentou loaders/reexport não admitidos:5630ab EXIT1,36pass/6fail42; após orientação ROOT de tratar todo loader dinâmico não suportado como failclosed,6e9da8 EXIT1,35pass/7fail42. Negativos cobrem mixed handled/unhandled, default/namespace/desconhecido, props/componente errados, callbacks indiretos/block-body, alias/reexport, shadowing até em escopo não chamado e JSX apenas em texto/comentário. Controle positivo mantém dois bindings de actions canônicos e import de utilitário puro. Não houve exceção por filename.

GREEN final d7c725/session48722→3c7535 EXIT0:19arquivos487/487,60.90s, guarda mais18focais completos, heap1024/w1/no-file-parallelism, sem filtros/skips. Arquivos completos: src/app/{acoes-cliente,confirmacoes,estados-vazios,fundo-sobre-pagina,botoes,enums-rotulos,paleta,rotulos,rotulos-dominio}.test.ts; src/components/{Botao,ConfirmarAcao,ConfirmarAcao.interacao}.test.ts; src/app/(app)/inbox/abas/{ClienteVoltou,OutrasOportunidades,AbaOportunidades}.test.ts; src/app/(app)/inbox/InboxNovo.detalhes.test.ts; src/app/(app)/funil/{FunilCliente.nova,FunilCliente,page}.test.ts. Lint da guarda/diffcheck05016b EXIT0. Nenhum diff em produçãoUI/DTO/backend/labels versus510; AGENTS e privados/cache/env/deps preservados. Novo fullUNIT e TSC da fonte final, QA independente/visual/CI continuam sob ROOT; BUILD510 é prova da produção literal510, não execução de browser ou aceite visual. Não foi iniciada330.

## Especificação histórica anterior à revisão R2 (preservação de evidências)

# Inbox — Cliente voltou e Outras oportunidades (#329)

Estado: implementação local em revisão, base83ad189a0f9ebecacea22def49e9afc63915424e. Não concluída nem homologada: TypeScript, verificação visual e QA do commit exato ainda pendentes. Evidências históricas e filtros detalhados em output/inbox-329-ledger-private.md.

## Comportamento e leitura

D18 reaproveita a oportunidade anterior. ClienteVoltou aparece no cabeçalho de atendimento COMERCIAL sem lead quando o Contato possui Pessoa explícita, em escopo, não mesclada e sem responsável legal. A oportunidade visível MATRICULADO/PERDIDO mais recente é escolhida por criadoEm/id descendentes, antes de avaliar telefone. Não há busca por telefone nem escolha de uma oportunidade anterior para coincidir o número.

Telefone divergente mantém o histórico e veta vínculo. O DTO também veta selecionado encerrado, número inativo/institucional, alcance sem escrita, contato/pessoa/vínculo incompatível ou candidato do helper diferente do selecionado. Não concede moverEtapa sem lead ou alçadas CRM ao convidado D13. A projeção de leitura não substitui autorização de escrita.

Outras oportunidades consome o DTO327 existente, com rótulos centrais e valor zero válido; null mostra Sem valor. Abrir Funil, Ver no contato e Nova têm alçadas independentes. Nova usa funil.mover global existente, COMERCIAL e Pessoa autorizada; a URL /funil?nova=PessoaID contém apenas ID codificado. O servidor resolve scope antes de preencher nome; fora de escopo ignora a entrada. O formulário mantém snapshot da Pessoa, uma superfície de modal, Cancelar remove somente nova e preserva filtros/o. Criar não vincula automaticamente a conversa.

Contato sem nome e ClienteVoltou coexistem no slotAviso. Tags, abas, editores, rodapé e comportamentos328 permanecem compostos. O primeiro clique em Vincular abre ConfirmarAcao canônico com consequência e foco no botão seguro. Somente Confirmar vínculo chama a ação pública exata com contatoId, atendimentoId e alvo lead, pelo executor real idempotente:false, sem retry automático. Cancelar/Voltar/Escape antes da confirmação não chamam a ação; durante a execução, o diálogo bloqueia fechamento e duplo clique. ACK de sessão antiga, inclusive A→B→A, não recarrega outra sessão.

## Vínculo e coordenação compartilhada

Após caracterização SQL real e GO técnico ROOT, somente o ramo lead de vincularContatoWhatsApp passa por vincular-lead-selecionado.ts. Assinatura pública e ramos aluno/responsável preservados. Ordem: Atendimento selecionado→Contato→Lead. Depois de cada espera, a TX relê autor ativo/papéis/permissões, alcance de escrita, identidade/vínculos/telefone/Pessoa atual e carteira. Pessoa NULL legada continua permitida; ponteiros explícitos incompatíveis ou Pessoa mesclada/legal são recusados.

Contato e Atendimento selecionado são atualizados com CAS, pós-condição e Evento na mesma TX. O ramo não chama garantirAtendimento, não trava outro Atendimento, não cria/mescla/reabre contexto e não muda etapa/carteira/régua. Repetição manual mantém Evento por POST, sem promessa de idempotência. Desvincular apenas no ramo lead alinha Selected→Contato e revalida política após ambas esperas; demais vínculos, motivos e Eventos permanecem.

Uma barreira SQL real reproduziu Postgres40P01 na ordem antiga de desvincular; após alinhamento, o recorte vínculo/desvínculo passou. Não há alegação de ausência geral de deadlocks entre todos os escritores nem de serialização de toda alteração possível em carteira/participantes/número/Pessoa.

## Evidências e limites

- UI/SSR/DTO: regressão focal14arquivos162/162 EXIT0 d38a3b, e sessões/foco/Aria4arquivos133/133 EXIT0 47c24c. Recortes sobrepostos, não soma nem suíte completa.
- ACTION real antes do patch:4/4 integrados EXIT0 aba141/session87293 comprovaram institucional em outroID/repetição/deriva intercalada. REDs de correção unitários f01eeb e integrados e88011; barreiraContato SQL real b4cd57 também RED. Após helper/CAS, unit4/4 EXIT0 e29754 e INT4/4 EXIT0 7e5210/session34578.
- Leitura integrada15/15 EXIT0 312693/session43745; fixture readonly corrigida para eliminar acesso próprio pela fila, sem mudar ACL produtiva.
- Vínculo versus desvínculo:312c6f EXIT1 com40P01 real antes do alinhamento. Concorrência/pool1 após alinhamento:2arquivos11/11 EXIT0 b79c64/session57412. Pool1 usa uma conexão/timeout3 no processo do teste e inclui Pessoa NULL legada. Rollback é SQL real com falha de Evento INJETADA após writes, não falha nativa do Evento.
- Unitários compartilhados/AcoesContato/auditoria:6arquivos69/69 EXIT0 e8cb65. Lint7arquivos do hardening EXIT0 2ef2c5 sem warnings.
- Regressão integrada expandida concorrência/desvincular/linha comercial:3arquivos42/42 EXIT0 94d1e5/session87607; inclui revalidação após espera em Lead e desvincular após Selected/Contato. Leitura/legados positivos aluno-responsável/acesso:3arquivos28/28 EXIT0 8512dc/session3362. Sem filtros/skips nessas execuções.

Sem alteração de schema/migrations/package/lockfile, instalações, integrações externas, push ou deploy. Perfil descartável dev-email492 sob lease exclusiva ROOT; restauração é exclusiva do integrador e nunca usa o snapshot491 antigo. Visual obrigatório: APP2temas×3tamanhos e referênciaPROTO original; ausência da pergunta de novo interesse é diferença D18 explícita. Não reutilizar GO/corpus328 para afirmar QA329.

Correção editorial filha de47a4c5c3: rótulos de retorno/situação de outras oportunidades agora vêm dos mapas centrais congelados SITUACAO_CLIENTE_VOLTOU_LABEL e SITUACAO_OUTRA_OPORTUNIDADE_LABEL, registrados nas guardas existentes. Wrapper situacaoOutra preserva API e somente chama rotular. Na frase de retorno, o rótulo central é exibido em minúsculas. As situações de outras oportunidades usam Primeiro contato, Experimental agendada, Experimental realizada e Aguardando matrícula, seguidas de · em aberto; ETAPA_LABEL global não mudou. Dois botões registrados em botoes-mapa; sem alteração de classes, backend, DTO ou política. Guardas reais/adicionais+UI:10arquivos324/324 EXIT0 654db3/session19972; lint6+diffcheck971714 EXIT0. TSC/fullUNIT/visual/QA/CI permanecem pendentes de coordenação ROOT. Causas dos REDs intermediários e filtros completos no relatório QA.

Correção frontend filha de65d9862c após fullUNIT/TSC ROOT: vínculo agora exige ConfirmarAcao/Modal/useDialogo reais, mantendo D18 reaproveitar e as identidades da ação; registro nominal exato em confirmacoes-mapa/cópia literal. A guarda de imports agora seleciona pares(modulo,acao) registrados para o arquivo atual antes de construir proibidas, suportando dois donos nominais da mesma ação. Os parsers/verificação de referências/código opaco e a exigência de chamada dentro do ConfirmarAcao não mudam. Autotestes mantêm terceiro não registrado, alias, reexport, módulo distinto e chamada fora da confirmação recusados.

Outras vazia usa EstadoVazio compacto registrado no manifesto, e cada linha muted ganhou border border-border-soft. O único TS2352 real relatado foi corrigido na fixture de fronteira FunilCliente.nova com cast unknown explícito e comentário: o PainelOportunidade é mockado e seus dados internos não são consumidos. Nenhum tipo produtivo foi relaxado. TSC original continua pendente de reexecução ROOT no checkout limpo do integrador, sem mudar tsconfig/exclusões nem caches históricosA.

Provas: RED UI7ba79d EXIT1(12falhas/2pass,14), depois bdfce4 EXIT0(3arquivos27/27). Guardas14 iniciais10cd91/session95244→864b5e EXIT1(408pass/2fail410) mostraram o manifestoEstadoVazio e o bugmultiowner. RED específico da seleção multiowner c841d6/session93447→6804a4 EXIT1(62pass/4fail66), depois Set exato aprovadoROOT. GREEN14arquivos417/417 EXIT0 9172fe/session73994→a7fc53,68.87s,semfiltros/skips; lintwhitelist8+diffcheck21c7f3 EXIT0. Backend/DTO65==47 e ETAPA_LABEL permanecem intactos; sem DBleaseA/provider/ação real. Visual precisa incluir a nova confirmação aberta/cancelada sem executar vínculo; propostaoffline65r1 não é aceite desta fonte.

Guarda de transporte filha510: nenhum código de produção mudou. O fallback AST em acoes-cliente.test.ts reconhece exclusivamente a delegação direta de todos os bindings server-action à prop acao do ConfirmarAcao real importado por nome, com shadowing/refs fora/callers mistos não admitidos. Heurísticas lexicais antigas e guardas irreversíveis continuam intactas; loaders/reexports de valor não suportados falham fechados. Não há hook/catch redundante nem exceção por arquivo. ROOT TSCoriginal5103bc11b e BUILD51080e288 terminaram0; o fullUNIT510 tinha só falso positivo lexical(8178pass/1fail8179). Provas/REDs no relatório QA; execução final d7c725/session48722→3c7535 EXIT0,19arquivos487/487 sem filtros/skips; lint/diffcheck05016b EXIT0. TSC/fullUNIT da fonte final e visual/QA/CI continuam pendentes ROOT.

## PR435 — revisão R2: separar o vínculo do cartão e preservar o legado

Referência: [review5643224235](https://github.com/diogenesmendes01/erp-genius/pull/435#pullrequestreview-5643224235), B2. Base local737506d7, branch temporária codex/inbox-revisoes-435-436-r2. Patch desta seção pertence só à PR435; não altera tarefas330/436.

O cartão passou a chamar `inbox/acoes-cliente-voltou.vincularLeadRetornoNoInbox`, que conserva o helper estrito329 literalmente. O registro nominal ConfirmarAcao e sua cópia acompanham o novo par. A ação pública legada conserva assinatura e ramos aluno/responsável, e o lead usa helper legado específico, sem tocar garantirAtendimento/linha-comercial/inbound. COMERCIAL é a finalidade do atendimento; AGENDA/COBRANCA continuam permitidos como finalidade do número. Os papéis, telefone, carteira e veto a contato com outro lead são os mesmos de83ad. Não acrescenta igualdade de Pessoa nem de selected/candidato. Contato.pessoaId e o contexto histórico selecionado permanecem intactos quando o destino é outro contexto.

Locks: resolve a conversa autorizada, coleta todos os IDs comerciais candidatos e o selecionado, trava em ordemID antes de Contato→Lead; relê autor/escopo/vínculos/telefone/conjunto/destino após as esperas. Candidato surgido fora do conjunto força rollback sem retry, não lock tardio de outro atendimento. CAS nas escritas existentes; contexto novo usa create, não upsert que substitui silenciosamente o destino. A operação estrita continua recusando institucional, outro selected/candidato e Pessoa incompatível. Não há migração/contrato global novo nem promessa de ausência global de deadlocks.

### Saídas próprias observadas

Todos os comandos usam executável Node local, heap1024/w1/UTC. INT somente perfil dev-email492 autorizado pelo Root, uma suíte por vez, sete flags externas vazias. Os GREENs abaixo são arquivos completos sem filtros/skips; contagens sobrepostas não são somadas.

| Recorte | Sessão / terminal | Exit | Resultado |
|---|---|---|---|
| Casos reais B2, antes do patch |87250/b635db e93719/92d58d|1|4falhas/3pass; o segundo isolou Pessoa compatível no caso de candidato diferente|
| Primeiros legados + endpoint estrito + aluno/responsável |35705/7a2144|0|3arquivos13|
| UNIT ClienteVoltou/AcoesContato/ação/doubles/guardas |55311/b93fa1|0|12arquivos417|
| Negativo acidental de import em concorrência |31628/97ad4d|1|3arquivos27:22pass5fail; ver explicação abaixo|
| Mensagem de alcance legada, RED direcionada |48256/a06e09|1|2falhas;12SKIPS solicitados por -t apenas nesta RED|
| Legado14 + strictconcorrência11 + pool1real6 |5983/437655|0|3arquivos31,120.79s|
| Arquivo concorrente completo, com controle cruzado adicional |74188/57edf8|0|1arquivo12,48.85s|
| Lint whitelist final |0fe7f3|0|12arquivos,0warnings|

O conjunto final cobre5arquivos INT distintos/38casos (legado14, concorrência12, pool1 6, ação estrita4 e aluno/responsável2), em terminais separados. Inclui vendedor em número institucional, selected com outro lead sem sobrescrever histórico, candidato de linha diferente, Pessoa divergente preservada, mensagens de erro anteriores e recusas de telefone/carteira/contato já vinculado.

As esperas SQL reais foram observadas em pg_stat_activity antes de alterar papéis, carteira ou inserir novo candidato. Duas ações legadas em selecteds distintos e o cruzamento legado×endpoint estrito têm um vencedor, sem sobrescrita. Vínculo estrito×desvínculo mantém o controle anterior. Pool1 usa connection_limit1/pool_timeout3 no processo, sem alterar perfil/env persistente, tanto para o endpoint estrito quanto para o legado VENDAS/AGENDA. Falha de Evento INJETADA depois da escrita SQL real desfaz Contato, novo Atendimento e Evento; isso não é uma falha espontânea do PostgreSQL.

O negativo97ad4d foi erro do DEV na substituição por substring: o nome de desvincular também foi renomeado no teste, gerando TypeError. A chamada vinha antes do try da barreira e deixou a liberação pendente, contaminando hooks com timeout. Não é evidência de deadlock produtivo nem40P01. Corrigidos import/chamadas e liberação em finally, sem alterar a asserção do produto. O executor terminou; inventário Win32 não mostrou runner próprio pendente antes da repetição. O replay completo terminou0, conforme tabela.

A SPEC foi reescrita em português legível; o conteúdo histórico anterior ficou preservado acima. Visual final, TSC/global/QA independente da fonte R2 e composição de conflitos B1/C2 permanecem com Root. Não publica, não responde à revisão no GitHub e não marca a issue concluída. #331 continua suspensa.
### R2 — preservar também aluno e turma no contexto legado

Na revisão de19aa1988, Root identificou que o legado83ad passava `alunoId: data.alunoId ?? alcance.alunoId` e `turmaId: alcance.turmaId` ao garantirAtendimento. O novo helper havia fixado as duas posições vazias da chave e omitido os campos no create. Não existe uma proibição demonstrada desses vínculos em COMERCIAL; a prova nativa criou registros reais com ambas as FKs. A candidata19aa não deve ser publicada sem esta correção filha.

RED49649/692a10 EXIT1, comando com -t 'aluno e turma':2controles do garantirAtendimento REAL passaram (AGENDA e fallbackVENDAS com outro lead);2chamadas da ação legada falharam por ausência do destino esperado com aluno/turma;14SKIPS solicitados só nesta RED. Corrigidos o helper local, o teste e este relatório, sem alterar estrito/inbound/permissões nem incorporar WIP436.

No institucional e fallback de VENDAS, a chave agora é COMERCIAL:lead:aluno:turma e o novo contexto preserva alunoId/turmaId do atendimento autorizado. Quando o helper de linha aproveita candidato existente, continua alterando só lead; quando cria uma linha nova sem abertos, continua sem herdar aluno/turma, como a linha comercial histórica. Não propaga matrícula em COMERCIAL. Contexto selecionado e Pessoa do contato não são modificados.

GREEN94562/c988b4 EXIT0: arquivo legado COMPLETO18/18,75.51s,sem filtros/skips, UTC/w1/heap1024, config/perfil originaldev-email492 sob a mesma lease exclusiva. Lint whitelist2 8c3701 EXIT0,0warnings. Os demais controles já verdes são históricos sobre19aa; este replay cobre os14legados anteriores e os4novos casos tocados. WIP de UI436 permaneceu fora do commit; sem push, nova migração, schema, cache, provider ou alteração de outro checkout. QA independente/TSC/global/visual da fonte final seguem com o integrador.
## Revisão R2 aprovada — conferência documental C3, C4 e C5

Referência: [review 5643684239](https://github.com/diogenesmendes01/erp-genius/pull/435#pullrequestreview-5643684239). A revisão aprovou os blockers B1/B2 e manteve observações de documentação e manutenção. Este patch é filho de `4c155828`, em branch temporária própria; não incorpora implementação de #332 nem altera o comportamento do vínculo.

**C3 — arquivo efetivo.** A SPEC de `4c155828` contém 46 linhas e termina no parágrafo sobre schema, integrações, push e merge. A leitura de `be8e63e149d3adac124aadc1d2fea60dee117ca3` mostrou o mesmo conteúdo, sem delta entre as duas versões. Nenhuma delas contém a seção “Especificação histórica anterior à revisão R2” citada na revisão. Portanto, não houve remoção fictícia de uma seção ausente. A SPEC permanece curta, com o contrato atual; as contagens, fontes e negativos históricos continuam neste relatório de QA. A indicação da revisão e o conteúdo efetivo foram conferidos separadamente.

**C4 — seleção duplicada por necessidade transacional.** Um comentário em `linha-comercial.ts` aponta `vincular-lead-legado.ts`. A preferência por atendimento do lead, linha e mais recente, as chaves e a criação de contexto devem permanecer equivalentes quando um dos caminhos mudar. O comentário lembra ainda o fallback de `garantirAtendimento` com aluno/turma e os controles históricos existentes. Não houve extração, import, alteração de assinatura ou chamada nova.

**C5 — concorrência e repetição manual.** A recusa “Os atendimentos mudaram. Recarregue a conversa antes de vincular.” continua intacta. Quando surge um candidato fora do conjunto travado, a transação recusa e desfaz a tentativa. O usuário deve recarregar, conferir o contexto e então repetir manualmente, se ainda quiser vincular. Não se acrescentou retry automático nem promessa de idempotência.

Verificação deste patch: comparação literal de `linha-comercial.ts` com a base após retirar somente o comentário acrescentado; o restante do arquivo é idêntico. Diff limitado à SPEC, a este QA, ao quadro e ao comentário. Nenhum teste, Node, SQL, TypeScript ou build foi executado por alteração exclusivamente documental/comentada. Evidências anteriores mantêm suas fontes originais; não há novo aceite visual, CI ou homologação implícita.
