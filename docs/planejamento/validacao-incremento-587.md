# Incremento 587 — substituição docente de segunda chamada agendada

Estado: fluxo implementado e validado no alcance automatizado descrito abaixo, em 16/09/2026. Homologação interativa e o objetivo integral continuam pendentes.

## Lacuna encontrada

A designação Q152 concedia atribuição limitada, mas não mudava o professor de `EncontroAgenda`. A realização exige cumulativamente atribuição e correspondência com o professor do encontro. Assim, o substituto de um encontro publicado permanecia impedido de realizá-lo. A remarcação mantém o mesmo professor; uma edição direta é bloqueada pela migration 126.

A [SPEC de substituição](../specs/substituicao-segunda-chamada.md) articula Q21/Q56/Q152: proposta da Secretaria/gestão, aprovação por outra pessoa da Gerência Pedagógica/Administração, revalidação e aplicação conjunta da atribuição limitada e do professor do encontro. Horário, matrícula, titular da turma e oportunidade permanecem preservados.

Agentes Terra trabalham em banco, servidor e interface; o orquestrador integra, confere o fluxo e executa testes no banco descartável. Nenhum envio externo ou alteração de produção está autorizado por consequência desta rodada.

## Verificações e limites

As migrations 127 e 128 foram aplicadas somente no PostgreSQL descartável em `localhost:54329`. Nenhuma migration anterior aplicada foi reescrita.

- Dez integrações específicas aprovadas na execução direcionada: `docs/validacao-integrada-substituicao-587-2026-09-16.json`. Cobrem proposta sem efeitos, papéis, autoaprovação, reenvio, preservação do encontro/reserva/titular, mutações SQL proibidas, conflito posterior, indisponibilidade, professor desativado, duas trocas sucessivas, decisões SQL concorrentes, realização pelo substituto e autorização especial até o fim do encontro.
- Cinco testes de schema e renderização aprovados: `docs/validacao-unitaria-587-2026-09-16.json`.
- Build e checagem de tipos aprovados: `docs/validacao-build-587-2026-09-16.log`.
- Lint direcionado aprovado: `docs/validacao-lint-587-2026-09-16.log`.
- Rodada conjunta de **82 integrações aprovada, sem falhas ou ignorados**: `docs/validacao-integrada-final-587-2026-09-16.json`. Inclui dez testes novos, 57 do fluxo principal, 12 de agenda inicial e três de fechamento.
- Após o ajuste de calendário da migration 128, os **11 testes específicos** passaram novamente: `docs/validacao-integrada-substituicao-final-587-2026-09-16.json`. A nova migration redefine apenas a validação da proposta de substituição. A rodada de 82 antecede esse ajuste; não somar as duas execuções como 93 casos distintos.

## Correções da revisão

Antes de aplicar a migration, a revisão retirou uma unicidade indevida que limitaria a uma substituição por encontro, corrigiu sintaxe SQL e verificou a situação contratual em cada extremo do intervalo. A última designação conhecida integra o estado conferido, mesmo expirada, sem restaurar uma versão antiga.

A primeira versão da proteção comparava toda a referência do calendário de origem, impedindo nova revisão mesmo quando uma versão posterior alterava apenas datas fora do encontro. A migration 128 admite uma nova proposta quando fuso e períodos não letivos incidentes continuam iguais. A proposta registra a versão atual integral; mudança posterior à revisão continua invalidando a aprovação. Se as condições do encontro mudaram, a interface orienta conferir a agenda pela remarcação, sem inventar uma exceção letiva. Um teste demonstra a nova versão sem impacto, a recusa da proposta antiga e a aplicação após nova revisão.

No servidor, o snapshot SQL integral é preservado para comparação; timestamps sem offset oriundos de colunas UTC recebem tratamento explícito apenas para leitura/exibição. Os bloqueios seguem reserva, calendário/contexto e depois proposta. Rejeição não exige que as condições de aplicação continuem válidas.

Na interface, mudança na seleção não reutiliza a prévia anterior; pendências permanecem visíveis e impedem envio. O histórico mostra professor e horário conferidos na proposta, além da situação atual. A consulta não limita silenciosamente os professores elegíveis aos primeiros 50.

## Limites

Não houve homologação interativa, envios externos, implantação ou importação de dados reais. A execução direcionada não comprova todos os requisitos do ERP.

Achado adjacente preservado para conferência: `conferirDestinoRemarcacaoTx` verifica autorização especial Q151 no início do novo intervalo, enquanto a agenda inicial verifica também fim menos um milissegundo. Conferir a proteção SQL e cobrir uma autorização que termina dentro do encontro antes de afirmar que a remarcação trata integralmente essa condição. O novo fluxo de substituição deve conferir os dois limites.

Q164 (resolução do impedimento escolar) e os demais itens do objetivo integral continuam abertos.
