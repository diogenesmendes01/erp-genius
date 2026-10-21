# Incremento 416 — concorrência na publicação e fechamento acadêmico

2026-09-14. Foram adicionados dois testes de integração que alteram permissões/configuração durante a resposta externa do Drive. Ambos passaram: a publicação revalida o estado e não cria material, prazo ou evento quando o autor foi desativado ou a configuração necessária foi removida. Relatório: `docs/validacao-publicacao-concorrencia-416-2026-09-14.json` (2 aprovados, 12 não selecionados).

A SPEC central referencia agora `docs/specs/fechamento-e-aproveitamento-academico.md`, com rastreabilidade de fontes, confirmação versionada, mínimos de nota/frequência e condições para a aprovação e execução da progressão. Não foi introduzida aprovação independente adicional no simples fechamento Q154.

O núcleo puro de elegibilidade e o mapa de equivalência estão em implementação/revisão pelos agentes. Não há ainda persistência de fechamento ou aplicação do gate de progressão. A revisão identificou a necessidade de representar explicitamente pendências históricas e de segunda chamada e rejeitar estados contraditórios, antes da integração.

O build anterior, do incremento 415, passou incluindo a rota de resultados. Depois dele, a apresentação foi ajustada para decimais/percentuais legíveis; o build anterior não comprova essa revisão posterior. Não houve homologação visual ou operação real no Drive.

Verificação posterior pelo orquestrador: **11/11** testes unitários nos módulos de elegibilidade e equivalência e `tsc --noEmit` passaram. A revisão de validações do mapa de equivalência continua; esse resultado não comprova sua persistência nem os gates de transferência/progressão.
