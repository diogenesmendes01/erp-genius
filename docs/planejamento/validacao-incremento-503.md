# Incremento 503 — preservação da conclusão assinada do aditivo

15/09/2026. Implementação com três agentes Terra, revisão e integração pelo orquestrador. O incremento anterior representou progresso; a meta integral permanece ativa.

## Entrega

Conclusão do aditivo persistida como fato imutável, vinculada ao processo, referência externa, hash do original, PDF assinado, evidências, participantes e instantes. A primitiva de recebimento é interna, destinada ao adaptador autenticado; não existe ação pública para informar assinatura concluída.

O recebimento exige envio confirmado e valida os participantes preservados no documento. Cadastro alterado depois do envio não substitui essa identidade nem impede guardar uma conclusão válida. Assinaturas ausentes, de pessoa diferente, fora do intervalo ou com ordem incompatível são recusadas. Repetição exata conserva o registro; conteúdo divergente exige conferência.

O banco verifica integridade dos arquivos, identidade de cada assinatura, papéis exigidos e ordem clientes/escola. A consulta e a rota privada conferem matrícula, proposta, conclusão e papel atual. Arquivos são entregues dos bytes preservados após verificação SHA, sem regeneração. A página do original apresenta metadados e links privados.

## Validação

31 integrações aprovadas em `docs/validacao-aditivo-503-2026-09-15.json`. O cenário de conclusão foi ampliado e repetido isoladamente em `docs/validacao-conclusao-aditivo-503-2026-09-15.json`, verificando também inserções SQL com identidade/hash falsos e entrega privada de evidências. Essa repetição não é um teste adicional no total de 31.

TypeScript, lint direcionado e build aprovados; log `docs/validacao-build-503-2026-09-15.log`. Migração 690 aplicada somente ao PostgreSQL descartável. A revisão corrigiu um alias SQL ambíguo antes da aplicação.

## Limites

Os testes usam sessão, retorno e PDF assinado simulados. Não comprovam assinatura externa real. Guardar a conclusão não confere aceite pela Secretaria, não aplica condições e não altera cobranças. Ainda faltam conferência final, aplicação versionada das condições e integração operacional com o fornecedor. Não houve envio externo, produção ou ensaio interativo da nova tela no navegador.
