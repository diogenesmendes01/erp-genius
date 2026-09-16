# Incremento 507 — cadeia documental de aditivos

15/09/2026. Implementação dividida entre agentes Terra; integração e correções finais pelo orquestrador.

A próxima proposta lê as condições formalizadas anteriores da mesma matrícula e inclui referências aos PDFs assinados dos aditivos. O formulário apresenta os valores anteriores desse histórico. A preparação e a revalidação distinguem a cadeia anterior à proposta da própria versão formalizada, preservando a base histórica. Os controles existentes de proposta superada continuam ativos.

O carregador verifica encadeamento, matrícula, proposta, ambiente, hash de condições, integridade do PDF assinado, tipos dos campos e ordem de vigência. A migração 720 mantém as verificações anteriores da fonte e exige a lista exata das versões formalizadas precedentes e vigência posterior. Foi aplicada somente ao banco descartável.

## Evidências

33 integrações passaram em `docs/validacao-aditivo-507-2026-09-15.json`. O cenário de produção simulada prepara e aprova uma segunda proposta, verifica o valor anterior, a referência ao PDF assinado e a rejeição SQL de cadeia omitida. Quatro testes puros da cadeia passaram em `docs/validacao-cadeia-aditivo-507-2026-09-15.json`. TypeScript, lint direcionado e build aprovados; log `docs/validacao-build-507-2026-09-15.log`.

## Limites

Não houve assinatura externa real, envio ou alteração em produção. A integração documental não executa ajustes financeiros nem aplica mudanças de agenda. Consumidores financeiros/acadêmicos das condições continuam pendentes. Não houve ensaio interativo no navegador. A meta integral permanece ativa.
