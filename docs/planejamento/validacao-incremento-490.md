# Incremento 490 — regras e conteúdo documental de aditivos Q117

Data: 15/09/2026. O incremento anterior atualizou o registro da entrega Q116 e a SPEC; foi progresso documental verificado. A meta integral permanece ativa.

## Implementação

As origens de campos dos modelos passam a incluir referência ao original assinado, cadeia de aditivos anteriores, condições anteriores/novas e vigência. Modelos de contrato inicial não podem usar essas origens. O preenchimento específico de aditivo exige as quatro informações no corpo do documento; declarar campos sem utilizá-los ou colocá-los somente no título não satisfaz essa exigência.

`aditivo-texto.ts` projeta uma base preservada fornecida pelo servidor. Preserva a ordem das referências documentais, identifica cada documento e hash, recusa referências/condições duplicadas e alterações sem diferença. Não interpreta valores como expressões ou novos campos. Fontes genéricas não podem substituir as informações específicas do aditivo. Esta função não comprova aprovação, assinatura ou autorização por si só.

O agente Terra implementou as regras puras e testes de autorização Q117. Após revisão, a formalização fica vinculada à vigência e ao hash das alterações exatas; a conferência identifica o PDF e a conclusão original, e a liberação exige cobertura exata das alçadas obrigatórias derivadas do servidor. Preparação exige Secretaria/Administração e aprovação exige outro administrador ativo. A saída autoriza aplicação futura com vigência explícita, sem alegar que condições já foram aplicadas. A revisão final também bloqueia atores sem identidade e o original repetido na cadeia de aditivos. Os serviços futuros devem recarregar esses fatos no banco; nenhum booleano informado por formulário pode constituir prova de autorização.

## Evidências e limites

O relatório `docs/validacao-aditivo-texto-490-2026-09-15.json` registra 19 testes aprovados de projeção de aditivo, preenchimento de modelos, exigências de assinatura e geração de PDF existente. TypeScript e lint da projeção passaram. Build concluído com sucesso em `docs/validacao-build-490-2026-09-15.log` antes da revisão final das regras do agente.

Validação final: `docs/validacao-aditivos-final-490-2026-09-15.json` contém 25/25 testes aprovados, incluindo as seis unidades de regras com cenários adversariais de permissão, autoaprovação, alçada omitida/duplicada, identidade documental, hash, vigência e repetição. TypeScript e lint passaram novamente após as correções finais. Não foi necessário repetir o build para funções puras ainda sem consumidores na aplicação; a versão exata testada está distinguida acima.

Esta entrega ainda não persiste proposta ou decisão de aditivo, não produz um documento assinado, não expõe tela de aditivo nem aplica novas condições. Persistência, consulta autorizada, geração vinculada, assinatura, conferência e aplicação transacional continuam necessárias. A integração real depende também da escolha Q155. Não houve alteração do banco ou operação em produção neste incremento.
