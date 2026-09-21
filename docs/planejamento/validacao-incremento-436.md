# Incremento 436 — decisões de resolução de revisão

Data: 14/09/2026. Meta integral ativa.

## Implementação

Propostas versionadas reúnem todos os casos pendentes de uma solicitação e preservam contexto, fontes e motivo. Outra pessoa ativa da Gestão Pedagógica/Administração decide. Aprovação relê os casos e a base acadêmica sob locks e confere hash/versão; reenvios idênticos não duplicam proposta ou decisão.

- `REGISTRAR_CANCELAMENTO`: registra resolução apenas depois do cancelamento pelo fluxo acadêmico existente. Não cancela nem recria solicitação automaticamente.
- `RECONFIRMAR_EXECUTADA`: exige novo fechamento suficiente, atual e posterior aos casos, na origem da progressão; preserva o fechamento histórico da aprovação original e as movimentações.
- `ENCAMINHAR_REGULARIZACAO`: mantém os casos pendentes e registra encaminhamento, sem dispensar notas, alterar frequência ou desfazer a progressão.

A consulta do caso apresenta resolução aprovada, data e motivo. Os formulários de preparação e decisão ainda não foram entregues; nesta etapa, as ações de servidor foram implementadas e exercitadas por integração.

## Evidências

- Fluxo de cancelamento com proposta, autoaprovação negada, aprovação por Administração, replay e consulta resolvida passou: `docs/validacao-resolucao-cancelamento-436-final-2026-09-14.json`. A primeira execução exigiu mock de `next/cache` na fixture, sem alteração da regra de produção.
- Fluxo executado A→B→C passou: rejeita reconfirmação anterior ao novo fechamento, encaminha sem resolver, fecha novamente e reconfirma com decisão independente. Confere a preservação integral das movimentações anteriores: `docs/validacao-resolucao-executada-436-final-2026-09-14.json`. Asserções de retorno sem payload e contagem de transferências da fixture foram corrigidas.
- Build completo com 62 páginas estáticas, TypeScript e lint direcionado aprovados. Migração 198 aplicada somente ao banco local de testes; comparação com schema sem diferenças.
- Regressão completa dos dois arquivos afetados: **88/88 testes aprovados**, sem filtro, em 133 segundos. Relatório: `docs/validacao-regressao-resolucao-436-2026-09-14.json`.

## Limites e próxima etapa

Rejeição registra recusa da proposta histórica exata, sem atestar a base atual ou resolver casos; aprovação exige nova conferência da base. Esse comportamento de rejeição ainda precisa de teste específico com base alterada. Concorrência de decisões, chegada de novo caso entre revisão/aprovação e formulários continuam pendentes de validação/entrega.

O banco valida independência, estados, contexto, cobertura dos casos e referências de fechamento. Os hashes canônicos e a recomputação acadêmica atual são responsabilidade do serviço; esta etapa não prova equivalência criptográfica dos hashes em inserções SQL arbitrárias. Migrações já aplicadas permanecem preservadas. Sem implantação em produção ou validação visual no navegador; a SPEC completa continua em implementação.
