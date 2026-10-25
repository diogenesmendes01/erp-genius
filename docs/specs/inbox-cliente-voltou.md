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
