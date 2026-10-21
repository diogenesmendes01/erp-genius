# Incremento 373 — Aprovação e publicação de recuperação, 14/09/2026

## Entrega

A gestão pode aprovar ou rejeitar uma proposta de horário preparada por outra pessoa. A tela preserva proposta, conferência original, autoria, decisão, motivo, data e encontro resultante. A rejeição não publica encontro e pode encerrar a revisão de uma proposta sem condições atuais para aprovação.

A aprovação exige a versão mais recente, conferência identificada por hash canônico e revalidação transacional da tentativa, matrícula, vínculo, plano, prazo, avaliador, calendário, conflitos e reservas comerciais. Mudança na conferência exige preparar nova versão. A permissão é relida no servidor; acumular papéis não permite decidir a própria proposta. O hash tolera a reordenação de chaves do JSONB, mas identifica alterações de conteúdo.

Dia não letivo exige autorização explícita do aprovador e justificativa registrada na decisão. Essa autorização não dispensa conflitos, indisponibilidades ou outras pendências. Em dia letivo, a opção de exceção indevida é recusada.

A decisão aprovada publica o encontro `RECUPERACAO` na mesma transação, por trigger, vinculando proposta, matrícula, avaliador e intervalo. Falha na publicação desfaz a decisão. A origem é única e verificável; o reenvio idêntico conserva o resultado. O encontro não cria diário, ocorrência cobrável, consumo de horas compradas ou cobrança de particular.

A realização registrada no fluxo docente deve corresponder ao avaliador e intervalo aprovados, além das verificações já existentes de atribuição histórica e situação contratual. O registro da realização atualiza atomicamente o estado do encontro para `MINISTRADO`; isso não lança nota nem a oficializa e não transforma recuperação em aula regular para frequência ou faturamento.

As migrations 165–167 foram aplicadas somente ao banco descartável. A 165 cria decisão/origem/publicação; a 166 protege a agenda e integra realização; a 167 corrige ambiguidade de alias SQL encontrada pelo teste de realização. Prisma regenerado e comparação do schema vazia.

## Evidências

- **101 integrações em quatro arquivos aprovadas**, sem testes omitidos nessa execução: avaliações, finalidade, agenda e solicitação de encerramento. [Relatório](../validacao-publicacao-recuperacao-373-2026-09-14.json).
- Após ajustes finais na consulta/tela e inclusão da conferência de encerramento com um encontro realmente publicado, **quatro casos relevantes repetidos e aprovados**; outros 69 não foram selecionados nessa repetição. [Relatório final direcionado](../validacao-publicacao-recuperacao-final-373-2026-09-14.json).
- Dois unitários de identificação da conferência aprovados; lint dos arquivos alterados e build com TypeScript/52 páginas estáticas aprovados. Sem homologação interativa ou envio externo.

Os testes verificam autoaprovação negada também em escrita direta, hash incorreto, autorização de feriado, conflito criado depois da proposta, rollback sem decisão, concorrência SQL com uma única publicação, reenvio da ação, imutabilidade/exclusão, bloqueio de alterações diretas do avaliador/cancelamento, realização no intervalo e ausência de efeitos financeiros. O encerramento identifica a recuperação publicada separadamente das particulares.

A tentativa inicial de testar duas chamadas simultâneas da ação encontrou falha do carregamento dinâmico do mock de autenticação (`next/server`) no executor. A concorrência foi exercitada diretamente no banco, mantendo as validações e triggers reais; a ação foi exercitada sequencialmente para aprovação/reenvio. Não se declara validada a concorrência HTTP/autenticação por esse teste.

## Limites e próximos passos

A aprovação/publicação inicial está implementada para uma habilidade/tentativa por encontro. Não há remarcação, cancelamento ou substituição de avaliador com aprovação específica da agenda publicada. Os caminhos anteriores de designação e cancelamento de reserva são impedidos quando alcançam encontro previsto, no servidor e no banco, para não contornar a revisão independente. Esses bloqueios são uma limitação temporária, não a entrega dos fluxos correspondentes.

Ainda é necessário integrar múltiplas habilidades no mesmo encontro quando cabível, agenda do avaliador/aluno, organização pela Secretaria no escopo autorizado, notificações, falta/cancelamento do aluno e consumo de tentativa conforme Q137, e autorizações específicas após pausa/encerramento conforme Q151. Mudanças globais do calendário continuam com suas pendências próprias. A conferência inicial não comprova todas as combinações de conflitos com operações posteriores de matrícula/agenda.

A regressão integral do projeto mais recente continua sendo a do incremento 371, anterior a estas mudanças. Não houve produção, migração de dados reais ou comprovação de entrega integral. O objetivo permanece em implementação.
