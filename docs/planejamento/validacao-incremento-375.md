# Incremento 375 — Agenda da recuperação no acompanhamento docente, 14/09/2026

## Entrega

O acompanhamento do plano, a fila de recuperações atribuídas e o detalhe da tentativa apresentam o encontro aprovado: início, fim, fuso de origem, avaliador, estado e indicação de exceção de dia não letivo. Ausência de agenda é informada explicitamente; a proposta ainda não aprovada não aparece como horário publicado.

As consultas carregam os encontros somente depois da autorização das tentativas e limitam a busca aos itens da página autorizada. Não retornam motivo da proposta, evidências de aprovação, informações financeiras, contatos ou horários de outras tentativas por meio do resumo da agenda. A lista de campos do resumo é verificada no teste de integração.

O avaliador designado consulta a própria habilidade sem obter acesso ao plano inteiro ou às demais habilidades. O titular continua no alcance de consulta já permitido do plano; se outro avaliador foi designado ao encontro, o formulário não o apresenta como apto a registrar sua realização. Os controles existentes do servidor continuam conferindo autoria e vínculo histórico.

Antes do início do encontro aprovado, o formulário de realização não é apresentado. A página pode ser atualizada pelo botão de situação; isso reconsulta permissões e estado no servidor. Registros posteriores ao horário continuam sujeitos à conferência da data histórica efetiva, sem presumir que o simples decurso do tempo realizou a avaliação.

O resumo permite escolher um fuso IANA de visualização, com sugestões de Brasil, Costa Rica, UTC e fuso de origem. Mostra as duas datas, inclusive quando diferentes, e informa preferência inválida. A escolha é local ao componente e não altera a agenda armazenada ou o calendário institucional; não implementa preferência global persistente do usuário.

Após cancelamento, a tentativa sem realização deixa de ser pendência acessível pela designação, seguindo as regras existentes. O plano conserva a agenda cancelada no histórico autorizado. Recuperações realizadas aparecem com seu horário no histórico próprio do docente, sem devolver permissão de edição.

## Validação e limites

77 integrações de avaliações aprovadas, sem testes omitidos nesta execução. [Relatório](../validacao-agenda-docente-recuperacao-375-2026-09-14.json). Esta rodada cobre o arquivo acadêmico afetado, não a regressão integral do projeto; a integral mais recente continua sendo a do incremento 371.

Três cenários direcionados aprovados inicialmente: agenda de avaliador designado com isolamento de habilidade/plano e retirada após cancelamento; publicação/realização normal; publicação/realização em dia não letivo. Os dois últimos agora verificam a agenda no histórico próprio após a realização.

TypeScript, lint dos arquivos alterados e build com 52 páginas estáticas aprovados. Não houve migration, alteração de produção, envio externo ou homologação interativa. A conversão visual usa `Intl.DateTimeFormat`; o build não é evidência de inspeção interativa da interface.

A consulta por cartões ainda não é uma agenda semanal unificada, não inclui o portal do aluno nem avisos automáticos. A fila de atribuições continua específica das designações; o titular acessa as recuperações pelo plano no seu alcance já autorizado. Remarcação, substituição de avaliador na agenda publicada, agrupamento de habilidades, cancelamento/falta do aluno e demais pendências da SPEC continuam em implementação.
