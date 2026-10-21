# Incremento 485 — proposta e decisão Q116 no banco

Data: 15/09/2026. Turno anterior classificado como progresso: correção de identidade nas transições e schemas estritos comprovados por testes. A meta integral continua ativa.

## Regressão concluída

A sessão 17801 terminou com código 0. `docs/validacao-integracao-estavel-482-2026-09-15.json` registra **968 testes aprovados, zero falhas, 87 arquivos**, `success: true`. A execução levou 946,33 segundos. Esse resultado cobre a base anterior à migração Q116; não comprova automaticamente os arquivos novos deste incremento. O relatório 479 com falhas sob dependências divergentes foi preservado.

## Implementação

Aplicada no PostgreSQL descartável local a migração `20260915050000_proposta_substituicao_contratual` (identificada como 216 no planejamento). `prisma migrate deploy` terminou com sucesso, seguido de `prisma generate` 5.22.0. Nenhum banco de produção foi alterado.

`substituicao-estado.ts` confere processo enviado, referência externa, identidade e integridade do PDF fonte, conferências compatíveis e ausência de conclusão total de assinatura. A fonte é histórica: não recalcula sua prévia contra os dados corrigidos. O substituto deve pertencer à mesma matrícula e passar pela revisão atual completa de assinatura, incluindo condições, participantes, emissão e disponibilidade. A comparação preserva as duas revisões. Hash determinístico suporta reordenação das chaves JSONB sem ignorar alterações de conteúdo ou ordem dos arrays.

`substituicao-tx.ts` implementa preparação e decisão como primitivas internas. Preparação deriva autor, versão, contexto, diferenças e snapshot; serializa operações e repete apenas a mesma chave com a mesma entrada. Decisão exige outro administrador ativo, hash da proposta exata e condições ainda válidas; versão superada não pode ser aprovada. Rejeição continua possível para registrar decisão histórica quando a proposta ficou desatualizada. Proposta e decisão geram eventos na mesma transação. Aprovar não cancela a fonte, não envia o substituto e não altera cobrança.

## Evidências

- `docs/validacao-substituicao-estado-485-2026-09-15.json`: sete testes unitários aprovados, incluindo fonte histórica, conclusão total, integridade do original, vínculo, revisões obsoletas e hash JSONB.
- `docs/validacao-substituicao-integracao-485-2026-09-15.json`: cinco testes reais de PostgreSQL aprovados. Cobrem proposta/decisão e repetição idempotente, fonte ainda ENVIADA, cobranças preservadas, imutabilidade, autoaprovação também rejeitada no SQL, versão superada, hash errado, reaproveitamento de chave, revogação de permissão, preparação concorrente e desatualização do cadastro após proposta.
- TypeScript sem emissão e ESLint dos arquivos novos passaram.

A fixture `src/test/substituicao-contratual.ts` foi reescrita pelo coordenador: usa preparação comercial, pagador, condições, emissão, publicação de modelo, prévia, conferência de participantes, geração/preservação de PDF, conferência de assinatura e envio simulado pelos serviços transacionais. Depois do envio, corrige o nome e prepara um segundo original. Não importa arquivos de testes nem simula a revisão de assinatura. Somente sessão e retorno do transporte são simulados; calendário/grade de suporte usam a mesma construção persistida das fixtures existentes. A primeira versão mínima feita pelo Terra foi descartada por não representar uma contratação válida.

## Pendências preservadas

As primitivas ainda não estão expostas em Server Actions nem em interface. Intenção persistida de cancelamento externo, prova autenticada do fornecedor, conciliação de resultado incerto e consumo da aprovação para liberar o novo processo permanecem pendentes. O processo de envio existente ainda bloqueia substituição. Q117/aditivos e escolha/integração operacional do fornecedor também não foram concluídos aqui. Não houve deploy, envio real ou declaração de conclusão integral.
