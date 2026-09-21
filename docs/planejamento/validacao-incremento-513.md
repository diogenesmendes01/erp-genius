# Incremento 513 — conferência do preço para continuidade

15/09/2026. Implementação com agentes Terra e revisão pelo orquestrador.

A prévia de continuidade precisa conferir a preparação comercial preservada, a autorização de preço e o aceite do documento exato. Preço de catálogo atual não reescreve a negociação. A transcrição administrativa é conferida contra a fonte contratual e os aditivos formalizados; uma aprovação da transcrição não autoriza um preço comercial divergente.

São distintas a data da regra transcrita e a cobertura da próxima cobrança: uma versão posterior de aditivo pode alterar o preço aplicável ao novo período, sem alterar a transcrição anterior ou cobranças existentes.

## Limites

A consulta é preparatória. Não emite cobrança. Oferta da escola por intervalo, ajustes por pausa/recomposição e emissão idempotente permanecem por implementar. Contratos legados sem fonte comercial estruturada exigem conferência própria; não usar a tabela atual para fabricar sua origem.

## Verificação

42 integrações de aditivos e continuidade aprovadas, sem falhas ou testes ignorados: `docs/validacao-integracao-513-2026-09-15.json`. O cenário mensal usa aceite integrado, preparação histórica, condição aprovada e aditivo formalizado: referência original de 85000 CRC, preço de 500 CRC pelo aditivo, mudança posterior do catálogo sem reprecificação e rejeição de transcrição aprovada de 300 CRC sem lastro. Cobranças anteriores permanecem iguais. Transporte e assinaturas externas são simulados.

Build (incluindo TypeScript) e lint focado aprovados; log `docs/validacao-build-513-2026-09-15.log`. A consulta pública preparatória tem verificação negativa de acesso e fonte ausente. Ainda falta cenário positivo de toda essa consulta com matrícula ativada e integração à interface; o cenário positivo atual valida seu componente de preço, não emissão recorrente completa. Não houve envio externo, migração ou alteração em produção.
