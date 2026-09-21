# Incremento 472 — fonte oficial no histórico e correções Q23

Data: 15/09/2026. Meta integral ativa. Incremento anterior foi progresso com persistência e evidências.

## Integração

O snapshot de correção aceita fonte OFICIAL com `publicacaoId`, além da exceção aprovada e ausência de fonte. O leitor consulta somente o identificador interno da publicação; não divulga arquivo do Drive nem credenciais. Propostas de texto/participação preservam a fonte. A projeção exige identidade igual entre os snapshots anterior e novo.

A migration 213 redefine o guard da proposta mantendo as verificações existentes e conferindo a fonte do encontro. A exceção aprovada tem precedência quando existir; caso contrário, a publicação oficial identifica a fonte. Campos extras são recusados. A migration 214 corrige a contagem de campos JSON para usar função disponível no PostgreSQL, sem editar migração já aplicada.

## Validação e falhas encontradas

A primeira rodada apresentou 33 falhas e 14 aprovações. A validação SQL referenciava uma função inexistente; o cenário novo também não informava classificação explícita da presença, exigida pela Q23. Ambos foram corrigidos. O relatório inicial permanece em `docs/validacao-fonte-oficial-q23-472-2026-09-15.json`.

O cenário novo registra a gravação pela ação, prepara uma aula concluída como fixture, propõe e publica correção textual com outra pessoa e confere a projeção efetiva sem alterar a publicação. Não testa ainda a ação normal de conclusão.

Oito testes unitários de schema/projeção aprovados; TypeScript e lint direcionado aprovados.

## Limites

Ainda falta integrar conclusão normal, interface e troca de gravação por proposta Q23 aprovada. A preservação da fonte nesta etapa não substitui o requisito de corrigir links. Migrations executadas apenas no banco descartável. Sem acesso ao Drive real, deploy ou alteração em produção.

Rodada final: 47 testes de integração aprovados em docs/validacao-fonte-oficial-q23-472-final-2026-09-15.json, abrangendo Q23 existente e registro da gravação oficial.
