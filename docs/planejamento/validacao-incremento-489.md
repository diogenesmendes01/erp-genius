# Incremento 489 — acompanhamento da substituição contratual

Data: 15/09/2026. Meta integral ativa; esta entrega não representa conclusão da SPEC.

## Implementação

A consulta autorizada da proposta Q116 passa a apresentar o andamento persistido: aprovação, intenção de cancelamento, confirmação, aplicação e situação do envio substituto. Uma conclusão assinada na fonte ou em seus predecessores aparece como conflito que exige revisão contratual. O ambiente de teste fica identificado explicitamente.

A tela mostra autoria e datas da intenção/aplicação, acesso ao original substituto e histórico paginado dos retornos. Referências externas, chaves internas e hashes de evidências não são publicados nessa consulta. A confirmação considera todo o histórico, mesmo quando estiver numa página anterior. A leitura usa uma transação RepeatableRead para manter o conjunto consistente.

## Validação

- `docs/validacao-andamento-substituicao-489-2026-09-15.json`: 21 testes de integração aprovados, nenhum reprovado. Inclui as transições exibidas, conflito tardio e paginação com confirmação fora da primeira página.
- TypeScript e ESLint dos arquivos alterados aprovados.
- Build concluído com sucesso; saída em `docs/validacao-build-489-2026-09-15.log`.

## Limites e continuidade

O painel acompanha fatos locais preservados; não executa cancelamento ou envio no fornecedor. Integração externa, conciliação operacional e homologação visual permanecem pendentes. A escolha Q155 foi reapresentada e continua sem resposta registrada. Q117, aditivos de contratos já assinados, permanece uma frente própria a implementar, preservando contrato original, versões e aprovações independentes. Nenhuma operação de produção foi realizada.
