# Incremento 509 — aditivo de preço até emissão por hora

15/09/2026. Implementação e revisão com agentes Terra; integração e validação pelo orquestrador.

O fechamento por hora ainda recalculava a ocorrência pelo preço-base, rejeitando uma conferência que já usava o preço do aditivo. Agora valida e usa o preço preservado na conferência, com matrícula, versão, hash e vigência da fonte contratual. Fatos legados sem referência de aditivo mantêm o preço-base. Uma versão posterior não reprecifica conferências anteriores.

## Evidências

- 57 testes de integração aprovados, sem falhas ou ignorados: `docs/validacao-integracao-509-2026-09-15.json`.
- Cenário específico de contrato por hora: preço original de 125 CRC, aditivo de 200 CRC, encontro de 75 minutos, conferência de 250 CRC, fechamento com aprovação independente e emissão única de 250 CRC. Repetir a emissão retorna o mesmo resultado: `docs/validacao-hora-completa-509-2026-09-15.json`.
- Sete testes do resolvedor, incluindo equivalência de condições financeiras com ordem diferente das chaves: `docs/validacao-hora-aditivo-509-2026-09-15.json`.
- Build aprovado: `docs/validacao-build-509-2026-09-15.log`. TypeScript e lint dos arquivos de implementação e integração passaram na rodada.

## Limites

O cenário usa serviços reais da aplicação e banco descartável, mas assinatura e evidências externas são simuladas. O encontro histórico é semeado pela fixture; não comprova todo o fluxo operacional de ativação e agenda em produção. Não houve ensaio interativo de interface, assinatura externa real, envio ou alteração em produção.

Este incremento fecha a validação financeira específica que faltava no 508. Efeitos de aditivos sobre mensalidades e agenda, configuração do fornecedor e demais frentes da SPEC continuam pendentes. Estes números não medem a conclusão do ERP inteiro.
