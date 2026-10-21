# Incremento 396 — calendário vigente na reposição

Data: 2026-09-14. Escopo: Q20/Q45 e confirmação persistente do agendamento.

## Problema reproduzido

O guard SQL de agenda expandia períodos de todas as versões aprovadas. O serviço já consultava somente a última versão. Um feriado removido continuava impedindo o commit. O teste encontrou retorno de sucesso sem AgendaReposicaoIndividual persistida; antecipar a validação dos constraints para dentro da transação fez a ação reportar erro corretamente.

## Alterações

- Migration 186 (20260915012000_calendario_vigente_reposicao), aplicada somente ao PostgreSQL descartável localhost:54329/erp_genius_test: seleciona a última versão aprovada, confere todo intervalo no fuso dessa versão e preserva os demais guards. A alteração pontual reconhece o guard equivalente da futura migration 185.
- agendarReposicaoIndividual força SET CONSTRAINTS ALL IMMEDIATE antes de devolver sucesso.
- Novo teste de integração verifica remoção de feriado, manutenção de feriado e ausência de efeito de versão posterior rejeitada, conferindo persistência/ausência real da agenda.

## Evidência

Antes: 1 falha por agenda ausente apesar de retorno ok. Após antecipar constraints: 1 falha, agora com retorno ok=false. Após corrigir calendário: 2 testes passaram; lint dos dois arquivos passou.

Relatórios: docs/validacao-calendario-396-2026-09-14.json, docs/validacao-calendario-396-confirmacao-2026-09-14.json, docs/validacao-calendario-396-corrigido-2026-09-14.json.

## Limites

Não comprova cancelamento/remarcação completo (185), segunda chamada (179), entrega do portal (183), serviços externos ou a SPEC inteira. Esses incrementos continuam pendentes de integração e validação. Nenhuma alteração de produção.
