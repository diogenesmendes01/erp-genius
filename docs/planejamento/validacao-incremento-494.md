# Incremento 494 — conferência dos signatários do aditivo

Data: 15/09/2026. A entrega anterior implementou e validou o PDF privado da prévia; foi progresso. Meta integral ativa.

## Implementação

`ConferenciaParticipantesAditivo` registra proposta, decisão aprovada, autor, versão, hash da proposta, snapshot, hash da revisão e chave idempotente. O serviço interno revalida a fonte e a versão integral aprovada antes de conferir; nova proposta impede prosseguir com a anterior. Repetição idêntica retorna o registro existente. Atualização/exclusão são recusadas no banco.

O plano de signatários vem das regras do modelo aprovado e do pagador da contratação. Maioridade exige classificação e evidência quando necessária. Participantes do cliente precedem a escola. Os papéis precisam corresponder exatamente ao plano; identidades de aluno/pagador são conferidas contra seus registros, e representantes exigem identificação e evidência disponível na contratação. Não exigir identidade completa de um papel que não seja signatário do modelo. Nenhuma assinatura do original é herdada.

Condições de identificação alteradas na proposta precisam corresponder ao cadastro conferido antes de registrar signatários. Esta etapa não atualiza o cadastro silenciosamente. Evidências são bloqueadas antes de consultar disponibilidade; o reforço também protege INSERT direto no banco contra leitura anterior a um arquivamento concorrente. O SQL confere papéis, etapas, contexto, regras do modelo e ausência exata de assinaturas herdadas; o serviço valida os dados completos e hashes canônicos.

## Migrações e validação

Aplicadas somente no banco descartável:

- `20260915060000_participantes_aditivo`;
- `20260915061000_integridade_plano_aditivo`;
- `20260915062000_bloquear_evidencias_aditivo`.

A primeira tentativa da primeira migração falhou por sintaxe de CASE. Foi verificado que a tabela não existia após o rollback automático; a migração foi marcada como revertida e reaplicada após correção. Não houve remoção de dados. Migrações já aplicadas não foram editadas; reforços foram novas migrações.

Prisma Client regenerado. Cinco unitários aprovados em `docs/validacao-unitarios-participantes-aditivo-494-2026-09-15.json`. Os primeiros 12 testes e a extensão para 13 passaram (`docs/validacao-participantes-aditivo-494-2026-09-15.json` e `docs/validacao-participantes-aditivo-final-494-2026-09-15.json`), incluindo proposta sem aprovação, concorrência/idempotência, versão, identidade, ausência de evidência, herança recusada diretamente no banco, modelo de menor com representantes e evidência arquivada. TypeScript corrigido e aprovado após ajustes de tipos nos testes e no helper.

Após a última migração, **13/13 integrações aprovadas** em `docs/validacao-participantes-aditivo-bloqueios-494-2026-09-15.json`. Lint final e build aprovados; log em `docs/validacao-build-494-2026-09-15.log`.

## Limites

Conferência ainda disponível como serviço interno; formulário, consultas e ação pública específicos virão na integração seguinte. Não há convite, envio, assinatura, geração do original definitivo ou aplicação do aditivo. Aprovação administrativa não substitui as alçadas comerciais/financeiras aplicáveis. A regra de bloqueio das evidências foi conferida por código; não atribuir aos testes atuais uma reprodução de interleaving concorrente de arquivamento. Nenhuma operação em produção.
