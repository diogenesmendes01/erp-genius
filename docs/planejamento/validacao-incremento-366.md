# Incremento 366 — Oportunidades extras de recuperação, 14/09/2026

## Entrega de Q150 para recuperação

Implementadas proposta, consulta paginada, revisão/decisão independente e aplicação do saldo extra de recuperação, por matrícula, nível e habilidade. Professor com atribuição vigente ou gestão propõe quantidade positiva, motivo e evidências quando o saldo está esgotado. A proposta preserva a base de regra, extras anteriormente aprovadas, ocupações e vínculo. Não altera limites institucionais nem consumos anteriores.

Outra pessoa da Gestão Pedagógica/Administração decide, inclusive quando o solicitante acumula papéis. Aprovação revalida o estado; alteração de saldo ou vínculo exige nova proposta. Rejeição permanece possível para resolver a proposta desatualizada. Reenvio idêntico não cria outra proposta/decisão; conteúdo divergente com a mesma chave é recusado. Propostas e decisões são imutáveis, com auditoria na mesma transação.

Quantidades aprovadas somam ao limite da habilidade no nível da matrícula. Reserva, aprovação de plano com limite base zero e consultas operacionais usam a quantidade adicional. Reservas e realizações continuam obedecendo plano, prazo, situação contratual e regras existentes; a autorização não cria avaliação, nota, presença, cobrança ou aprovação de progressão. Outros contratos e habilidades conservam seus limites.

Tela em `/academico/avaliacoes/[alocacaoId]/extras`, acessível pelo acompanhamento de avaliações. Identifica aluno/contrato/nível, recebe proposta, apresenta motivo/evidências/base da solicitação e permite decisão independente. Ações de aprovação indisponíveis quando a base mudou. Formulário conserva chave para reenvio dos mesmos dados.

## Persistência e validação

Migration 161 (`20260914160000_extra_recuperacao`) cria propostas/decisões com referências e controles SQL de conteúdo, vínculo, autoria, independência, imutabilidade e saldo conferido. Atualiza a proteção SQL da reserva para considerar extras aprovadas. Aplicada somente ao PostgreSQL descartável; Prisma regenerado e comparação do schema vazia.

- 60 integrações de avaliações aprovadas: [relatório](../validacao-extras-366-2026-09-14.json). Antes da integração da tela/consultas, dois testes direcionados das novas ações passaram.
- Casos novos: solicitação apenas após esgotamento, idempotência, recusa de autoaprovação na ação e no SQL, conferência do estado alterado, rejeição posterior, incremento de uma habilidade, preservação de outro contrato e habilidade, reserva adicional autorizada e recusa de quarta reserva tanto pela ação quanto por escrita direta.
- 839 unitários em 91 arquivos aprovados; build com TypeScript/52 páginas, lint direcionado e diff check aprovados. O total de páginas estáticas não representa a contagem de rotas dinâmicas.

Não houve envio externo, alteração de produção ou homologação interativa. Não houve regressão integral de todas as integrações nesta rodada. Cenários adicionais de concorrência/zero de fábrica e homologação visual devem ser ampliados antes de declarar o fluxo integralmente homologado.

## Pendências mantidas

Q150 também exige oportunidades extras de segunda chamada; esse fluxo permanece por implementar. As regras de autorização específica após pausa/encerramento, ocorrência do aluno (falta/cancelamento tardio), resolução de planos sem continuidade, fechamento versionado e integração da progressão permanecem abertas nas entregas correspondentes. Esta entrega não comprova conclusão integral de Q150 ou Q154.
