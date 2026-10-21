# Incremento 471 — registro persistente de gravação de AULA

Data: 15/09/2026. Meta integral ativa; incremento anterior foi progresso de código e diagnóstico.

## Implementado

`PublicacaoGravacaoAula` identifica encontro, arquivo e drive institucionais, tipo de mídia, publicador, instante de conferência, chave idempotente e snapshot da chamada. Migration 211 cria a referência imutável, separada de material de reposição. Exige aula prevista cujo horário terminou, diário do professor original e autor ativo com atribuição original ou designação Q24 vigente.

`registrarGravacaoAula` confere autorização e chamada antes da consulta externa; verifica metadados e disponibilidade de um byte sem manter transação aberta durante a rede; confere novamente autorização e snapshot antes de persistir publicação e evento juntos. Mudança da chamada, acesso revogado ou indisponibilidade impedem gravação. Repetir a mesma chave/entrada não duplica publicação nem evento. Identificador do arquivo não é devolvido no resultado público.

## Validação

- Primeira rodada: 12 testes aprovados e 1 falha. PostgreSQL rejeitou o quantificador de regex para limite 500. Migration 212 corrige com validação separada de comprimento e caracteres, preservando a migration aplicada.
- Rodada final: 13 testes aprovados em `docs/validacao-registro-gravacao-471-final-2026-09-15.json`. Relatório da falha permanece em `docs/validacao-registro-gravacao-471-2026-09-15.json`.
- TypeScript, lint direcionado e diff-check aprovados. Migrations aplicadas apenas ao banco descartável de testes.

## Limites

A ação registra a fonte, mas ainda não conclui a aula nem aparece na interface. A integração da conclusão normal com fonte Q23, correção de link, reprodução autorizada e indisponibilidade continua obrigatória. O encontro permanece PREVISTO nesta etapa; isso não representa o comportamento final pretendido. Guards de snapshot no banco verificam identidade da aula/diário; a conferência completa da chamada é realizada pela ação e exige cobertura adicional de integridade antes da entrega final. Drive real não foi acessado: testes simulam o serviço. Sem deploy ou alteração em produção.
