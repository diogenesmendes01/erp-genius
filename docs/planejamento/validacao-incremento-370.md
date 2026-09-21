# Incremento 370 — Propostas preservadas da agenda de recuperação, 14/09/2026

## Entrega

Gestão Pedagógica/Administração pode guardar uma proposta de início/fim/fuso para uma habilidade reservada, com motivo e conferência dos dados atuais. Versões anteriores permanecem imutáveis. Reenvio idêntico retorna a proposta existente; chave repetida com conteúdo diferente é recusada. Versões concorrentes sobre a mesma base não sobrescrevem o histórico.

A rota `/academico/recuperacoes/tentativas/[itemReservaId]/agenda` permite preparar e revisar propostas, identificando aluno, contrato, nível, habilidade, autor, horários e pendências originais. A versão mais recente é novamente conferida; conflitos ou mudanças posteriores são sinalizados sem substituir a conferência original. Versões anteriores são paginadas e identificadas como históricas. O cancelamento da tentativa bloqueia novas propostas, preservando consulta e reenvio idempotente pela gestão autorizada.

Uma pessoa distinta do autor é identificada como revisora independente, mas **a decisão/aprovação e a publicação ainda não estão implementadas**. A revisão é consulta; não produz uma decisão, reserva de horário, encontro, nota, cobrança ou recebimento. Propostas com pendências de calendário/disponibilidade podem ser preservadas para revisão, sem transformar essas pendências em exceções aprovadas.

Migration 163 (`20260914180000_proposta_agenda_recuperacao`) cria `PropostaAgendaRecuperacao`, com referências, versão e chave únicas, imutabilidade e conferências SQL de autoria ativa, vínculo/contrato, plano aprovado, disponibilização/prazo, tentativa não realizada/cancelada, fuso e coerência do intervalo/base. Aplicada somente ao banco descartável. Prisma regenerado; schema diff vazio.

## Dependência para publicação

A inspeção confirmou que consumidores existentes usam `matriculaId` e ausência de `turmaId` para identificar particular contratada. Exemplos: `agenda/encontros-docente.ts`, `diario/particular.ts`, `matricula/ocorrencia-particular.ts`, `matricula/reserva-horas-compradas.ts`, `matricula/fechamento-horas-tx.ts` e `agenda/cancelamento-particular.ts`. As proteções SQL dessas operações também precisam ser atualizadas.

Antes de gravar avaliações publicadas em `EncontroAgenda`, identificar explicitamente sua finalidade e origem, impedir seu uso como aula cobrável/diário de aula e atualizar consultas/telas, cancelamento, substituição e remarcação. Manter encontros de avaliação nos controles comuns de conflitos, calendário e indisponibilidade. Publicação deve ocorrer na mesma operação da aprovação independente, revalidando a versão e o estado; não basta criar a proposta nem gravar uma decisão isolada.

Secretaria na preparação/revisão de horários, agrupamento de habilidades em encontro, exceções não letivas, aprovação/publicação, ocorrências do aluno e homologação interativa permanecem pendentes. O recorte disponível à gestão não revoga o alcance aprovado para Secretaria na agenda. A implementação integral do projeto permanece aberta.

## Validação

70 integrações de avaliações aprovadas: [relatório](../validacao-proposta-agenda-370-2026-09-14.json). Build com TypeScript, lint direcionado e comparação do schema aprovados. O build gerou 52 páginas estáticas, além das rotas dinâmicas, incluindo a nova rota de propostas. Não houve nova regressão integral das demais integrações ou repetição de todos os unitários.

Dois testes novos cobrem idempotência, conteúdo divergente, escrita/remoção imutáveis no banco, revisão independente sem aprovação, versões concorrentes, consulta histórica, professor sem acesso, conflito posterior e tentativa cancelada. A proposta não cria encontro/recebimento. Não houve alteração de produção ou envio externo.
