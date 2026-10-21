# Incremento 502 — processo interno de assinatura do aditivo

15/09/2026. A rodada anterior constituiu progresso verificado. A meta integral permanece ativa.

## Implementação

Três agentes Terra implementam processo, tentativas e observações de envio vinculados ao original do aditivo e à conferência interna exata. A preparação exige fonte vigente, integridade documental, participantes e alçadas aprovadas, com fornecedor escolhido explicitamente e ambiente compatível com o documento.

A preparação pública apenas registra o processo interno. Iniciar tentativa e observar retorno são serviços internos, destinados ao adaptador autenticado. Não há botão de simulação nem ação pública que permita declarar envio concluído. Resultado incerto impede repetir a criação e pode receber conciliação posterior. A mesma chave com conteúdo diferente é recusada.

A migração 670 mantém identidades, tentativas e observações imutáveis e exige fatos correspondentes para mudar o estado do processo. Cancelamento precisa de seu fluxo próprio e não pode ser declarado diretamente.

## Limites

Preparar processo não envia nem assina o documento. O fornecedor operacional e o transporte ainda precisam ser integrados e validados; a escolha armazenada para um processo não comprova conta, credenciais ou plano contratado. A conclusão das assinaturas, conferência final e aplicação das condições do aditivo continuam pendentes. Testes de retornos usam fatos simulados, sem comunicação externa.

Consulta de tentativas paginada em 20 registros. Observações mostram as 20 mais recentes por tentativa, com aviso quando há anteriores; navegação completa dessas observações ainda precisa ser acrescentada. Não houve ensaio interativo no navegador, publicação em produção ou envio de mensagens nesta etapa.

## Evidências

- 29 integrações aprovadas em `docs/validacao-aditivo-502-final-2026-09-15.json`, incluindo ambiente incompatível, idempotência, incerteza, conciliação, escopo e papéis.
- Uma integração adicional aprovada em `docs/validacao-aditivo-retentativa-502-2026-09-15.json`: confirmação de não criação permite uma nova tentativa; resposta atrasada da anterior é recusada.
- TypeScript, lint direcionado e build aprovados; `docs/validacao-build-502-2026-09-15.log`.
- A primeira integração encontrou alias SQL ambíguo em uma função PL/pgSQL. A migração 680 corrigiu o problema preservando a 670 já aplicada; ambas somente no banco descartável. Relatório inicial preservado em `docs/validacao-aditivo-502-2026-09-15.json`.

Os retornos do fornecedor nos testes são simulados. Esses resultados comprovam o processo interno e os bloqueios exercitados, não envio externo real nem conclusão de assinatura.
