# Incremento 500 — coerência da proposta com a origem contratual

15/09/2026. O incremento 499 constituiu progresso validado. A meta integral permanece ativa.

## Implementação

Três agentes Terra implementaram o extrator das condições preservadas, a validação de coerência e os nomes acessíveis do formulário. O orquestrador integrou a validação ao serviço de preparação/revisão e acrescentou cenários financeiros ao fluxo real de teste.

A origem de moeda e cobertura vem de `snapshot.condicoes` da prévia original, após as conferências de integridade e escopo já existentes. Não é extraída do texto renderizado nem do cadastro atual. Os regimes mensal e por hora, com ou sem adiantamento, possuem fontes monetárias identificadas.

Quando uma proposta financeira estruturada muda uma ponta da cobertura, ela é comparada à outra ponta contratual; ambas devem estar identificadas e o início não pode superar o fim. Valores monetários devem usar a moeda contratada ou uma mudança explícita de moeda com valores definidos para todas as condições monetárias envolvidas. A proposta não converte valores por cotação nem altera cobranças passadas.

Não se permite misturar alterações financeiras textuais e estruturadas na mesma proposta financeira estruturada. As propostas integralmente legadas continuam sem interpretação automática. A conferência também ocorre na decisão, pelo recarregamento da mesma origem.

O formulário associa nomes aos campos de texto, e-mail, datas, minutos, moeda e regime. Valores monetários usam grupo com legenda, rótulos e ajuda associados. Não houve ensaio interativo no navegador nesta etapa.

## Verificação

15 unitários aprovados em `docs/validacao-aditivo-unitarios-500-2026-09-15.json`. Build e TypeScript aprovados; log em `docs/validacao-build-500-2026-09-15.log`. Lint direcionado do servidor e interface aprovado.

A primeira integração apontou moeda incorreta no cenário de teste (BRL para contrato CRC); o teste foi corrigido para a moeda efetivamente contratada, preservando o bloqueio de divergência. Relatório inicial preservado em `docs/validacao-aditivo-500-2026-09-15.json`. Rodada final: 26/26 integrações aprovadas em `docs/validacao-aditivo-500-final-2026-09-15.json`, incluindo proposta financeira válida, bloqueios de incoerência, idempotência, integridade documental e preservação das cobranças. Sessão e transporte externo continuam simulados na integração; o PostgreSQL e serviços internos são reais.

## Limites e próxima integração

Esta conferência não prova aprovação comercial/financeira, não calcula sobreposição de períodos já emitidos e não aplica valores à matrícula. Ainda faltam o registro versionado dos efeitos, as alçadas específicas, a formalização operacional e a aplicação transacional do aditivo. A agenda estruturada continua dependendo da proposta acadêmica autorizada. Nenhuma migração, publicação em produção ou comunicação externa foi realizada nesta etapa.
