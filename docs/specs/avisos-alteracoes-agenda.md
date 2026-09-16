# SPEC-ACA-N01 — Avisos de alterações da agenda

Estado: e-mail, WhatsApp, autorizações, tela paginada de pendências, avisos globais e diagnósticos de configuração/contato incorporados até `67a1e3d9`, com revisão independente, testes dirigidos e build aprovados. A reconferência operacional para encerrar pendências corrigidas ainda está em implementação; a existência do helper interno de resolução não fecha esse caminho da equipe. A fila persiste intenções de aviso; aceite do provedor não comprova entrega, leitura ou ciência pelo aluno. O transporte automático permanece desligado até configuração e homologação próprias.

## Escopo

Uma remarcação aprovada, uma substituição docente aprovada ou um replanejamento global aprovado cria avisos por matrícula e canal disponível, dentro da mesma transação que aplica a mudança. Cada aviso referencia o evento aplicado e seus encontros; a chave por evento, matrícula e canal impede duplicação e chamadas repetidas reúnem itens da mesma origem.

Para encontro particular, o encontro pertence diretamente à matrícula. Para encontro de turma regular, cada matrícula é avaliada no instante do encontro: a alocação precisa ter sido criada até aquele instante e não pode estar encerrada nele. Uma alocação encerrada exatamente no início já não recebe aviso. Matrícula sem esse vínculo não recebe item nem aviso.

O banco preserva a origem, a matrícula, o aluno, os itens e as tentativas. A guarda SQL aceita o caminho de turma para `SubstituicaoDocenteDecidida` aprovada e para `ReplanejamentoConjuntoAplicado` comprovado, do agregado canônico `ConfiguracaoOperacional/escola`, com o encontro presente no payload e pertencente ao vínculo histórico aplicável; as guardas de origem e compatibilidade entre aluno e matrícula continuam obrigatórias.

## Destinatários e canal institucional

O WhatsApp exige número institucional ativo com finalidade de agenda e template aprovado, de categoria e idioma compatíveis. O processamento da agenda seleciona apenas suas próprias intenções, sem despachar a fila comercial ou financeira por consequência. Ausência de configuração não cria tentativa externa nem transforma aviso preparado em resultado incerto.

Cada destinatário conserva sua identidade, além do hash do contato. O aluno com consentimento e contato habilitados pode receber seu próprio aviso. Um responsável exige vínculo pedagógico e autorização explícita daquela matrícula, com evidência registrada pela Secretaria/Administração. Ser pagador ou ter o mesmo telefone de outra pessoa não transfere autorização. A releitura anterior ao transporte confere novamente identidade, autorização vigente, contato e configuração.

Autorização, matrícula, responsável, evidência e autoria são preservados; revogação registra pessoa e motivo. As ações conferem o papel atual, serializam operações do mesmo vínculo e rejeitam entradas divergentes sem substituir o histórico. A guarda SQL 177 rejeita autorização criada por papel inadequado, exclusão/alteração da identidade e aviso que usa autorização de outra matrícula, futura ou revogada. Registrar o resultado de tentativa já iniciada continua permitido após revogação, sem autorizar outro envio.

O aviso por e-mail mantém sua chave lógica existente. A chave WhatsApp inclui o hash do contato, mas o registro preserva também a identidade selecionada: contato compartilhado não permite trocar o destinatário histórico nem reutilizar autorização de outra pessoa. Incerto continua sem retentativa automática. As verificações de driver usam transportes simulados, não comprovam operação externa.
Para `ReplanejamentoConjuntoAplicado`, a origem canônica inclui decisão e aplicação aprovadas, fotografia do rascunho e a correspondência exata entre os horários anterior/proposto da fotografia, do evento e da agenda aplicada. A matrícula somente recebe os encontros da turma aos quais esteve alocada no horário anterior ou no proposto; outra matrícula não recebe os seus itens. Criação, enfileiramento, claim e releitura imediatamente antes do driver repetem essa validação. O texto é renderizado da fotografia `antes → depois`, nunca do horário atual como se ele fosse a origem.

Se uma matrícula afetada por qualquer alteração aprovada não puder formar aviso, a própria transação mantém a aplicação e registra uma única pendência operacional por evento, matrícula e motivo. Falta de identidade acadêmica elegível registra `SEM_DESTINATARIO_AUTORIZADO`; identidade existente com comunicações recusadas registra `CONTATO_SEM_OPT_IN`. Replays não duplicam a pendência. Ausência de vínculo com os encontros não cria aviso nem pendência. Configuração ou contato que se tornem indisponíveis depois da criação são revalidados pela fila e não fabricam tentativa ou reenvio.

No enfileiramento WhatsApp, aviso com origem e matrícula ainda válidas permanece `PREPARADO` quando faltar configuração institucional, contato atual ou opt-in. A fila registra, de modo idempotente, respectivamente `CONFIGURACAO_INDISPONIVEL`, `CONTATO_INDISPONIVEL` ou `CONTATO_SEM_OPT_IN`; ela não cria intenção, tentativa, `INCERTO` nem reenvio automático. A resolução exige um fluxo autorizado que confirme a condição corrigida.

## Reconferência operacional de pendência

Secretaria Acadêmica ou Administração pode solicitar uma reconferência com observação identificável. A ação bloqueia a pendência e os avisos do mesmo evento e matrícula, relê o papel atual antes de qualquer resposta e conserva a primeira autoria e observação; replay só é reconhecido quando traz a mesma evidência. Matrícula precisa estar `ATIVA`, a origem aplicada precisa continuar canônica e cada item congelado de aviso precisa pertencer à matrícula no instante histórico aplicável.

Para replanejamento global, o subconjunto da matrícula é calculado pela alocação no horário anterior ou proposto e é validado contra a fotografia aplicada. Para substituição, cada turma é filtrada pela alocação daquela matrícula no início do encontro. A reconferência não lê, anexa ou renderiza encontros de outra turma. Avisos existentes são somente relidos: contato, hash, identidade e itens permanecem congelados; `INCERTO` não é preparado nem reemitido. Quando não existia aviso por falta de destinatário ou opt-in, a ação só prepara uma intenção pela mesma fonte depois de todas as verificações; se não puder prepará-la, mantém a pendência.

Responsável só satisfaz a reconferência quando sua autorização daquela matrícula está vigente, seu vínculo pedagógico com o aluno permanece atual e seu telefone ainda corresponde ao hash congelado. Para configuração, a ação reutiliza a validação institucional por idioma do destinatário. Encerrar a pendência não afirma envio ou entrega e não encerra outra pendência do mesmo evento/matrícula que tenha motivo próprio.

## Despacho e estados

O worker revalida evento, matrícula ativa, consentimento, contato, hash do contato e pertencimento do encontro pela mesma regra histórica antes de chamar o transporte injetado. Uma chamada concorrente somente obtém um claim. Resultado recusado registra `FALHOU`; resultado incerto preserva `INCERTO` e não é reenviado automaticamente; aceite com recibo registra `ENVIADO`. `ENVIADO` significa que o provedor aceitou a solicitação, não que o destinatário recebeu ou leu a mensagem.

Para substituição, o renderer informa alteração de docente e os horários afetados. Ele usa exclusivamente os itens persistidos do próprio aviso, revalida que cada item continua no evento e no vínculo histórico da matrícula e recusa identificadores de encontro estranhos ao aviso. Antes do transporte, o endereço de email precisa continuar igual ao contato atual do aluno e ao hash preservado pela intenção. Ele não reutiliza o texto da remarcação. Email externo real, WhatsApp, credenciais, monitoramento de entrega e reconciliação com o provedor continuam fora desta validação local.

## Critérios de verificação

Integração com PostgreSQL descartável: aprovar uma substituição de turma por pessoa diferente do preparador, com duas matrículas vinculadas e uma alocação encerrada no limite do encontro; criar somente os dois avisos elegíveis; validar renderer por transporte de email simulado, inclusive proposta com duas turmas sem expor o horário da outra e mudança de contato após o claim; rejeição e rollback sem avisos; guardas de origem/matrícula; e transições `RECUSADO → FALHOU`, `INCERTO → INCERTO` e `ACEITO → ENVIADO`.

A reconferência é coberta em banco descartável para responsável pedagógico vigente e duas turmas, matrícula pausada, vínculo encerrado antes da aula, contato congelado alterado, `INCERTO`, replay concorrente e pendências de motivos distintos. Drivers e `fetch` são bloqueados nesses cenários.
