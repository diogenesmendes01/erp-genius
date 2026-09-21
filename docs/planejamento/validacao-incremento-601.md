# Incremento 601 — Indicador de resposta por contrato

16/09/2026. Objetivo integral em andamento.

## Problema e correção

A fila financeira calculava `respondeuEm` pelo último inbound do telefone no transporte. Com dois contratos ou assuntos distintos no mesmo número, uma mensagem comercial ou resposta de outro contrato podia marcar uma cobrança como respondida.

Agora o indicador consulta somente atendimentos FINANCEIRO com matrícula explícita e entrada registrada, valida o contato contra o destinatário contratual atual e agrega a última entrada por matrícula. Não utiliza o timestamp global do transporte nem assuntos comerciais ou financeiros legados sem matrícula. A resposta precisa continuar sendo posterior ao último envio daquela cobrança. Cobrança sem envio não ganha o selo. Um atendimento encerrado pode conservar o sinal histórico se o contexto e destinatário permanecerem correspondentes.

A identificação de pagador externo (`viaResponsavel`) também reconhece RESPONSAVEL/EMPRESA da fonte contratual explícita, além dos vínculos legados. Isso evita apresentar empresa como se fosse o próprio aluno.

## Validação

- **18 integrações aprovadas**: quatro novas sobre resposta por contrato, seis do pagador contratual e oito de conferência/consulta da fila (`docs/validacao-integrada-601-2026-09-16.json`).
- Cenários novos: transporte e assunto comercial não contam; resposta de uma matrícula não marca a outra no mesmo telefone; contexto encerrado preserva histórico; entrada precisa ser posterior ao envio; cobrança nunca enviada permanece sem resposta; mudança de destinatário exclui o contato antigo; empresa aparece como pagador externo.
- Tipos, lint e build aprovados: `docs/validacao-tipos-601-2026-09-16.log`, `docs/validacao-lint-601-2026-09-16.log` e `docs/validacao-build-601-2026-09-16.log`.

As integrações usaram somente o banco de testes. Sem nova migração, envio real, produção ou homologação interativa. O selo registra uma entrada no atendimento após o envio; não comprova pagamento nem classifica semanticamente a mensagem. As políticas de silêncio e opt-out não foram alteradas por esta correção de projeção.
