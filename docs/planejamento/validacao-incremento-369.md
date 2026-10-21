# Incremento 369 — Prévia da agenda de recuperação, 14/09/2026

Implementada a conferência de intervalo de uma habilidade reservada, acessível pela gestão na tela de execução do plano. Início/fim locais e fuso são convertidos no servidor, inclusive para encontros que atravessam a meia-noite. A conferência não grava encontro, não reserva horário, não realiza avaliação e não concede aprovação.

`recuperacao-agenda-tx.ts` revalida usuário, vínculo, contrato ativo, plano aprovado/disponibilizado, fontes e prazo. Recusa tentativa realizada/cancelada e intervalo passado, invertido ou fora do prazo. Usa professor designado para a tentativa ou titular com atribuição vigente, conferindo atividade e papel. Designação não concede ao professor leitura da agenda alheia: a nova consulta exige Gestão Pedagógica/Administração.

Conferências de disponibilidade:

- Calendário institucional publicado e fuso consistente com a configuração; períodos não letivos exigem exceção específica, sem aprovação implícita.
- Encontros publicados do avaliador e do aluno, incluindo particulares e turmas de outros contratos da mesma pessoa. Intervalos adjacentes não conflitam; rascunhos/cancelados não ocupam agenda.
- Indisponibilidades docentes aprovadas e horários de reservas comerciais ativas ou mantidas por pendência.

A resposta expõe apenas intervalos conflitantes e participação do avaliador, sem identidade de outros alunos, contratos ou condições financeiras. A tela elimina a prévia anterior quando o formulário muda e mantém explícito que não houve agendamento. A conferência opera sob os locks do calendário e matrícula; uma futura aprovação deverá repetir os controles na transação que publicar o encontro.

## Validação e limites

68 integrações de avaliações aprovadas: [relatório](../validacao-previa-recuperacao-369-2026-09-14.json). Lint direcionado e build com TypeScript aprovados (52 páginas estáticas, além das rotas dinâmicas). Não houve nova execução de todos os unitários ou regressão integral das demais integrações.

Os cenários de integração verificam acesso, calendário ausente/feriado, prazo e intervalo inválidos, outro contrato do aluno, fronteiras de intervalos, cancelamento, avaliador designado, indisponibilidade ainda não aprovada/aprovada, reserva comercial, avaliador inativo e ausência de criação de encontro/realização/recebimento. A fixture da reserva comercial foi corrigida para conter a revisão dos horários exigida pelo banco, sem alterar sua proteção.

Não há migration nova neste incremento. Aprovação/publicação, remarcações, cancelamento tardio/falta e consumo por ocorrência do aluno ainda não estão implementados para essa agenda. Agrupar várias habilidades em um encontro também permanece para a integração de agendamento. A prévia não implementa Q137 integralmente, não confirma disponibilidade futura e não constitui homologação interativa. Não houve alteração de produção ou envio externo.
