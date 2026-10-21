# Incremento 583 — contrato de entrada da agenda inicial

A auditoria de interface, servidor e SQL confirmou que a segunda chamada tem criação direta de encontro e reserva separada, mas a tela só seleciona encontros existentes. A criação não registra uma decisão concreta sobre calendário/exceção Q19. O guard da reserva não resolve essa ausência de proposta e evidência.

O desenho foi consolidado em `docs/specs/agenda-inicial-segunda-chamada.md`: preparar agenda depois da disponibilização, revisar professor/intervalo/calendário, decidir independentemente e criar encontro, reserva e vínculo atomicamente. Não usar remarcação como substituto: ela depende de uma reserva já existente. Não inventar bloqueio permanente de feriado, porque Q19 permite exceção aprovada.

Foi implementada a validação de entrada para a nova proposta e decisão em `segunda-chamada-agenda-inicial-schema.ts`. Ela identifica a avaliação autorizada e o professor, exige estado conferido, preserva fuso, normaliza instantes antes do hash e separa reenvio histórico de validação de nova proposta futura. Recusa campos de aplicação/autor enviados pelo cliente e rejeição que tente autorizar exceção. A decisão não presume autorização de dia não letivo.

## Evidências e limites

- Oito testes unitários aprovados, incluindo regressão do schema de remarcação: `docs/validacao-unitaria-583-2026-09-15.json`.
- TypeScript e lint direcionado aprovados: logs `validacao-types-583` e `validacao-lint-583`, de 15/09/2026.
- Ainda não existem persistência, endpoint, aplicação ou UI do novo fluxo. O schema não confere permissões, calendário ou saldo transacionalmente; esses requisitos seguem obrigatórios.
- Nenhuma migration foi criada/aplicada nesta rodada e nenhuma integração nova foi executada. As evidências de integração do 582 não comprovam o novo fluxo.

Próxima implementação: proposta/decisão/aplicação persistentes, guard SQL de contexto e calendário, prévia/consulta, aprovação atômica com reserva, interface e cenários concorrentes. Só então retirar o caminho legado como alternativa operacional. O objetivo integral permanece aberto.
