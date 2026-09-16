# SPEC-ACA-N01 — Avisos de alterações da agenda

Estado: implementação local validada em 16/09/2026. A fila persiste intenções de aviso; aceite do provedor não comprova entrega, leitura ou ciência pelo aluno. O transporte automático permanece desligado até configuração e homologação próprias.

## Escopo

Uma remarcação aprovada ou uma substituição docente aprovada cria avisos por matrícula e canal disponível, dentro da mesma transação que aplica a mudança. Cada aviso referencia o evento aplicado e seus encontros; a chave por evento, matrícula e canal impede duplicação e chamadas repetidas reúnem itens da mesma origem.

Para encontro particular, o encontro pertence diretamente à matrícula. Para encontro de turma regular, cada matrícula é avaliada no instante do encontro: a alocação precisa ter sido criada até aquele instante e não pode estar encerrada nele. Uma alocação encerrada exatamente no início já não recebe aviso. Matrícula sem esse vínculo não recebe item nem aviso.

O banco preserva a origem, a matrícula, o aluno, os itens e as tentativas. A guarda SQL aceita o caminho de turma somente para `SubstituicaoDocenteDecidida` aprovada, do agregado canônico `ConfiguracaoOperacional/escola`, com o encontro presente no payload; as guardas de origem e compatibilidade entre aluno e matrícula continuam obrigatórias.

## Despacho e estados

O worker revalida evento, matrícula ativa, consentimento, contato, hash do contato e pertencimento do encontro pela mesma regra histórica antes de chamar o transporte injetado. Uma chamada concorrente somente obtém um claim. Resultado recusado registra `FALHOU`; resultado incerto preserva `INCERTO` e não é reenviado automaticamente; aceite com recibo registra `ENVIADO`. `ENVIADO` significa que o provedor aceitou a solicitação, não que o destinatário recebeu ou leu a mensagem.

Para substituição, o renderer informa alteração de docente e os horários afetados. Ele usa exclusivamente os itens persistidos do próprio aviso, revalida que cada item continua no evento e no vínculo histórico da matrícula e recusa identificadores de encontro estranhos ao aviso. Antes do transporte, o endereço de email precisa continuar igual ao contato atual do aluno e ao hash preservado pela intenção. Ele não reutiliza o texto da remarcação. Email externo real, WhatsApp, credenciais, monitoramento de entrega e reconciliação com o provedor continuam fora desta validação local.

## Critérios de verificação

Integração com PostgreSQL descartável: aprovar uma substituição de turma por pessoa diferente do preparador, com duas matrículas vinculadas e uma alocação encerrada no limite do encontro; criar somente os dois avisos elegíveis; validar renderer por transporte de email simulado, inclusive proposta com duas turmas sem expor o horário da outra e mudança de contato após o claim; rejeição e rollback sem avisos; guardas de origem/matrícula; e transições `RECUSADO → FALHOU`, `INCERTO → INCERTO` e `ACEITO → ENVIADO`.
