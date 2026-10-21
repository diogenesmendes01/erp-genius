# Incremento 554 — autorização de segunda chamada na interface

A gestão agora acessa uma página dedicada a autorizações especiais a partir da segunda chamada. A página identifica aluno, matrícula, turma e avaliação, recebe motivo e prazo local com fuso explícito e mostra histórico paginado de vinte registros em ordem cronológica decrescente. O atalho permanece disponível à gestão para consultar histórico mesmo quando a matrícula retorna à situação ativa; novas autorizações exigem pausa ou encerramento e avaliação pendente.

O adaptador converte o prazo no servidor. O formulário mantém a chave de reenvio para os mesmos dados. A ação retorna a mesma autorização e prazo no reenvio idêntico, sem criar outro registro; alteração de conteúdo usando a mesma chave é recusada. O histórico exige gestão habilitada, restringe o cursor à alocação e avaliação consultadas e omite hash e chave de idempotência.

Interface e consulta implementadas pelo agente Terra; orquestrador revisou elegibilidade, acesso ao histórico, identificação e reenvio, e integrou o adaptador. A autorização não cria saldo, prorrogação geral, agenda ou realização. Não foram liberadas automaticamente as demais operações que exigem vínculo ativo.

Validação: nove testes de integração aprovados, zero falhas ou não selecionados (`docs/validacao-segunda-interface-final-554-2026-09-15.json`). Inclui autorização por adaptador, fuso inválido, reenvio, tentativa docente, consulta administrativa e paginação completa de 21 registros, com recusa de cursor estranho. ESLint focado aprovado. Build final aprovado após inclusão da identificação (`docs/validacao-build-final-554-2026-09-15.log`).

Sem ensaio interativo no navegador, implantação ou envio externo. Fluxos anteriores à reserva, auditoria completa dos guards e cenários de encerramento/lançamento histórico continuam pendentes. Q163 permanece sem resposta e não foi presumida.
