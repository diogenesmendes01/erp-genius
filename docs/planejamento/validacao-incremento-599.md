# Incremento 599 — WhatsApp financeiro por matrícula

16/09/2026. Objetivo integral em andamento. Origem: achado confirmado na [revisão 598](revisao-crm-whatsapp-598.md).

## Comportamento implementado

O atendimento financeiro agora identifica a matrícula, além do aluno. Dois contratos da mesma pessoa geram atendimentos distintos no mesmo transporte. A abertura institucional exige escolher o contrato; listagem, cabeçalho e triagem mostram sua referência. A cobrança projetada é exclusivamente da matrícula escolhida: sem dívida nela, a tela não busca dívida em outro contrato.

O enfileiramento transporta a matrícula da cobrança. Antes de despachar, o sistema compara a matrícula do atendimento com a da cobrança, além das conferências já existentes de destinatário, autorização e transporte. Uma combinação cruzada é cancelada sem chamar o driver.

A migração 141 acrescenta a coluna e uma chave estrangeira composta para `Matricula(id, alunoId)`. Impede novos atendimentos financeiros sem contrato, vínculo com aluno divergente, troca do contexto financeiro e reclassificação de outra finalidade como financeira. Não preenche contratos antigos por inferência. As demais finalidades mantêm suas chaves anteriores.

Atendimentos financeiros antigos sem matrícula preservam o histórico, mas não permitem envio, seleção de cobrança ou roteamento automático de entrada. Uma entrada sem assunto aberto só gera atendimento financeiro automaticamente quando a identidade aponta para uma única matrícula; mais de uma mantém a mensagem na triagem. Múltiplos assuntos abertos também mantêm a triagem. Classificação administrativa exige destino financeiro contextualizado e aberto.

## Evidências

- Prisma validate e generate aprovados: `docs/validacao-schema-599-2026-09-16.log` e `docs/validacao-client-599-2026-09-16.log`.
- Ensaio SQL com BEGIN/ROLLBACK aprovado; migração 141 aplicada somente em `localhost:54329/erp_genius_test`: `docs/validacao-preflight-599-2026-09-16.log` e `docs/validacao-migration-599-2026-09-16.log`. A migração aplicada fica preservada.
- **45 integrações passaram** na rodada principal (cinco novas de isolamento e quarenta de inbox/acesso/destinatário): `docs/validacao-integrada-599-2026-09-16.json`.
- **49 integrações passaram** na regressão de cron, ciclo de cobrança, ações e despachantes: `docs/validacao-regressao-599-2026-09-16.json`.
- A suíte nova foi ampliada para **sete cenários e passou**, acrescentando ausência de cobrança no contrato escolhido e roteamento com matrícula única. Os cinco anteriores foram reexecutados, não são adicionais: `docs/validacao-integrada-final-599-2026-09-16.json`.
- **23 unitários passaram**, incluindo quatro específicos do legado sem contrato e do destinatário financeiro com lead associado: `docs/validacao-unitaria-final-599-2026-09-16.json`.
- Tipos, lint e build aprovados: `docs/validacao-tipos-599-2026-09-16.log`, `docs/validacao-lint-599-2026-09-16.log`, `docs/validacao-lint-final-599-2026-09-16.log` e `docs/validacao-build-599-2026-09-16.log`.

As integrações exercitam o banco real local; os drivers externos são substituídos por respostas de teste. Nenhuma mensagem real foi enviada. Não houve homologação interativa ou alteração de produção.

## Limites que permanecem

Este incremento corrige o contexto e a seleção de cobrança, não conclui todo o módulo WhatsApp. A resolução de responsáveis/destinatários ainda conserva as regras existentes ligadas ao cadastro do aluno; sua compatibilidade com pagadores e autorizações específicos de cada contrato deve ser verificada em frente própria. Não migra mensagens antigas para novos contratos nem inventa corte temporal do histórico após transferência. Também não habilita emissão recorrente de mensalidades ou encerra as pendências financeiras/documentais de desistência.


Atualização posterior: o [incremento 600](validacao-incremento-600.md) conecta a fonte de pagador por matrícula à resolução financeira, tratando o limite de destinatários descrito acima. Casos legados sem referência suficiente continuam exigindo conferência.
