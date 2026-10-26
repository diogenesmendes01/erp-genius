# Inbox #328 — produtor mínimo de perda (parcial)

Branch de trabalho codex/inbox-e2-328-produtor sobre7721e744. O histórico agregado desta base não é publicável: ROOT comporá somente os deltas necessários sobre325/326/336. GO e lease exclusiva A/dev-email/client487 foram concedidos pelo integrador em24/10/2026.

## Escopo entregue pelo produtor

- ModalPerda aceita `acao?: (input: PerdaInput) => Promise<Resultado>`. Com a prop, valida/normaliza os mesmos dados, executa o callback pelo executor existente e só no sucesso chama aoConcluir/aoFechar; não chama marcarPerdido global nem router.refresh. Sem a prop, mantém o caminho atual do Funil, inclusive seu refresh e feedback.
- Novo núcleo interno `marcarPerdidoTx(tx, autor, leadId, input, revalidar?) => Promise<boolean>` em src/server/crm/marcar-perdido.ts, sem use server, sessão, transação própria ou consulta global. Trava Lead, chama a revalidação do contexto se fornecida, aplica papel/carteira usando tx, valida PerdaSchema e preserva a idempotência por autor/motivo/observação. Retorna se houve mudança.
- A API pública `marcarPerdido(id, input)` do Funil permanece igual e consome o núcleo dentro de sua transação. Mantém Resultado, revalidarLead, regras de carteira/validação e a possibilidade histórica de registrar outro motivo/observação. Não se exporta uma transação como server action.

## Contrato Inbox e CAS aprovado

`marcarPerdidoNoInbox(atendimentoId: string, input: PerdaInput, oportunidadeIdEsperada: string): Promise<Resultado>` exige terceiro argumento. A futura ação327 passa a ter `moverEtapaNoInbox(atendimentoId, etapa, oportunidadeIdEsperada)` também obrigatório;327 ainda não está implementada.

A identidade de escrita é sempre atendimento.leadId resolvida no servidor. oportunidadeIdEsperada serve exclusivamente como comparação CAS depois da resolução autorizada; nunca seleciona um alvo no WHERE. Campo ausente, vazio ou ID de outra oportunidade recusa sem escrever em nenhuma. Não usar pessoaDoAtendimento: uma oportunidade autorizada pode existir sem Pessoa.

A transação única trava Atendimento→Lead. Refaz ator ativo/papéis/permissões, escopoAtendimentos e podeVerLeadNaThread usando a mesma tx após esperar os locks; compara a oportunidade resolvida e a precondição novamente. Capacidade moverEtapa é projeção e não substitui carteira: o núcleo também exige escopoComercialAtual. Convite de leitura ou D13 não concede perda fora da carteira. O lock Lead do núcleo é reentrante na mesma conexão e não introduz outra ordem compartilhada.

No Inbox, destinoDoArraste rege encerradas: MATRICULADO recusa. PERDIDO só aceita a repetição idempotente já registrada pelo mesmo autor com mesmos dados; tentativa de mudar os dados de uma oportunidade encerrada reverte integralmente. Isso não muda a API/regras históricas do Funil. A mesma tx inclui alteração de etapa/motivo, LeadPerdido e avisarAtendimento apenas se mudou. No-op não grava Evento nem aviso; rollback após aviso não publica NOTIFY. Revalidação de /funil ocorre após commit; o Inbox segue seu aviso/SSE existente.

## TDD e validação

Testes próprios: ModalPerda.acao.test.ts (callback, legado, Outro inválido, erro de negócio e transporte); acoes-painel-perda.int.test.ts (perda sem Pessoa, CAS, validação, contexto/carteira/setor/convite, encerradas, equivalência Funil, rollback+NOTIFY e waits reais em troca lead/carteira/papel/inativação); acoes-painel-perda-pool1.int.test.ts (uma conexão para contexto/ator/núcleo/Eventos/aviso e no-op).

Somente bancos descartáveis do perfil, maxWorkers1, uma integração por vez. Evidências/negativos/gates nominais estão em output/inbox-328-produtor-report.md; nenhuma aprovação é inferida de silêncio no executor. Regressões incluem os arquivos inteiros experimental-perda-idempotencia.int.test.ts e leads.int.test.ts do Funil.

## PENDENTE — restante da #328

AbaOportunidades, CartaoExperimental, botões da aba/Assumir, composição InboxNovo/PainelContato, harness, fixtures visuais, preview, capturas APP/protótipo, aceite visual e QA da experiência ainda NÃO estão entregues por este produtor. Dependem da composição325/326 e da entrega327, sob coordenação ROOT. Nenhum desses paths foi alterado aqui; não marcar328 concluída ou homologada. Sem schema, migração, instalação, pacote/lock, novo polling/SSE ou envio real.
## Gates finais do produtor — 24/10/2026

Unitário ampliado39770/3ab215 EXIT0:80arquivos973testes,44,66s,maxWorkers2,sem filtro/skips (Funil/Inbox/servidor unitário/rotas/guardas; não global). INT88169/2b3e7b EXIT0:quatro arquivos inteiros35testes,110,34s,maxWorkers1,sem filtro/skips:acoes-painel-perda(17),pool1(1),experimental-perda-idempotencia e leads do Funil(17). TSC30074/29152f EXIT0/noEmit/incrementalfalse/heap8192;lint8arquivos/diff5ffe66 EXIT0. Histórico RED/erros de fixture R1 está preservado no report; nenhum gate negativo foi reclassificado. Banco liberado ao ROOT após terminal para restauro; nenhum preview/fixture visual/Save/nota foi executado.

Esta aprovação DEV refere-se apenas ao produtor mínimo. Restante328UI/visual, composição sobre325/326, QA independente/global integrada e publicação continuam PENDENTES. O histórico agregado da branch é só base de trabalho; ROOT selecionará os paths/deltas para integração.

## Fundação compartilhada327/328 na composição — 24/10/2026

ROOT aprovou extrair contexto-oportunidade.ts somente para mutações. comOportunidadeDoInboxTx recebe tx/sessão já obtida/atendimento/CAS e callback(autor,leadId) resolvidos, sem use server, sessão, cliente global ou tx própria. Trava Atendimento→Lead e refaz ator/escopo/CAS após os locks antes de chamar a callback. Wrapper328 mantém três argumentos, regras de encerradas, núcleoCRM e aviso apenas se mudou. O lockLead do núcleo é reentrante; a consulta de leitura327 não usa esse helper.

Gates NOVOS da composição: INT78021/49ae21 EXIT0,quatro arquivos35testes completos(17wrapper328+1pool1+17regressõesFunil),100,16s,maxWorkers1,sem filtros/skips; não são gates0430 reatribuídos. Unit34423/9c8ffe EXIT0,85arquivos1006testes,33,77s,maxWorkers2;TSC27988/1ef31d EXIT0;lint5arquivos162e82 EXIT0. Restante328UI/visual continua PENDENTE. Esta fundação será selecionada por ROOT com327 para evitar dependência circular de327UI e produtor328.

## Porte coordenado R2 — 24/10/2026

Fundacao minima328 portada por hunks para base74d4 (PR420+Main),preservando API Funil e editor326. Helper/contexto e wrapperCAS mantidos sem ampliar328UI. Este checkpoint tecnico antecede os gates da nova composicao:UNIT/TSC aguardam freeze do porte;INT depende GO especifico ROOT no baselineA491. Gates antigos487 continuam nominais,nao reatribuidos. CartaoExperimental/Assumir/restante328UI e visual seguem PENDENTES.
