# Incremento 600 — Destinatário financeiro pelo pagador do contrato

16/09/2026. Objetivo integral em andamento. Continuidade do [incremento 599](validacao-incremento-599.md).

## Correção

A fonte versionada `PagadorPreparacaoMatricula`, já registrada pela Secretaria, passa a governar o destino financeiro daquele contrato. Antes, cobranças e abertura institucional ainda consultavam o responsável global do aluno, mesmo quando a matrícula identificava outro pagador.

Um resolvedor comum atende abertura de atendimento, projeção de cobrança, fila financeira, cron, ações humanas e revalidação no despacho. Para ALUNO, exige a identidade correspondente e utiliza o telefone atual do cadastro. Para RESPONSAVEL/EMPRESA explícitos, utiliza nome e telefone da fonte contratual, sem criar vínculo global com o aluno ou presumir acesso acadêmico. Fonte incompleta/inválida não recai em outro telefone.

Telefone já presente em um contato de outro contexto pode ser usado quando corresponde ao pagador explicitamente conferido daquele contrato; os vínculos globais existentes são preservados. Atendimento de outro telefone não recebe projeção de cobrança nem autorização de envio. Nas matrículas legadas sem fonte explícita, a regra anterior somente resolve destino se houver uma única matrícula do aluno. Múltiplos contratos sem referência suficiente e preparações comerciais sem pagador ficam em conferência. A opção de atendimento permanece visível com indicação da pendência.

A referência do destinatário inclui matrícula, fonte/versão, tipo de pagador, telefone, nome e vínculos pertinentes. O enfileiramento compara essa referência com a usada para preparar o texto. A assinatura da cobrança também a conserva para revalidação no despacho. Assim, mudança de pagador, inclusive mantendo telefone, não autoriza reutilizar mensagem preparada para outra versão.

## Validação

A primeira integração passou em 37 de 39 cenários. Uma expectativa revelou mensagem pouco esclarecedora para destinatário ausente; a listagem passou a conservar a matrícula com indicação da pendência, e a abertura explica a conferência necessária. Outra fixture da inbox associava um contato com telefone diferente do cadastro; foi corrigida para representar um destinatário válido, mantendo a conferência de identidade em produção. Evidência inicial preservada: `docs/validacao-integrada-600-2026-09-16.json`.

- Integração principal corrigida: **39 de 39 aprovados**, incluindo seis cenários novos de pagador por contrato, sete de isolamento por matrícula e regressões de inbox/destinatário (`docs/validacao-integrada-final-600-2026-09-16.json`).
- **28 unitários aprovados**, incluindo cinco novos do resolvedor, legado, assinatura de fila e elegibilidade (`docs/validacao-unitaria-600-2026-09-16.json`).
- Tipos, lint e build aprovados: `docs/validacao-tipos-final-600-2026-09-16.log`, `docs/validacao-lint-600-2026-09-16.log`, `docs/validacao-lint-final-600-2026-09-16.log` e `docs/validacao-build-600-2026-09-16.log`.
- **71 integrações adicionais aprovadas** na regressão de cron, ciclo de cobrança, ações, despachantes, acesso e comprovantes (`docs/validacao-regressao-600-2026-09-16.json`). Junto à rodada principal final, são 110 cenários distintos; a execução inicial com falhas não é somada como cobertura adicional.

A tentativa de executar `src/server/cobrancas/consultas.test.ts` não encontrou testes (arquivo inexistente); o relatório com zero cenários não comprova validação. A consulta da fila é coberta pela integração real `src/server/cobrancas/conferencia.int.test.ts`, incluída na regressão adicional.

## Limites

Sem migração nova, produção ou mensagens reais. Banco local de testes e drivers substituídos por respostas de teste. Não houve homologação interativa.

Esta entrega consome o pagador contratual já existente; não cria fluxo para escolher automaticamente pagador de contratos legados ambíguos nem para mudar o pagador após a contratação. Esses casos dependem de conferência/migração ou revisão documental e financeira aplicável. A referência nova faz intenções antigas com assinatura incompleta exigirem nova preparação/revisão; não as considera aprovadas por compatibilidade. Não conclui o módulo WhatsApp inteiro nem as integrações externas restantes.
