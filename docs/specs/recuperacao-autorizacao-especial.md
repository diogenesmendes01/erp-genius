# Q151 — autorização específica para recuperação

Atualização 552: histórico de autorizações de realização paginado e restrito à tentativa; testes direcionados, lint e build aprovados. Q163 aguarda decisão sobre a passagem de pausa para encerramento. [Evidências e limites](../planejamento/validacao-incremento-552.md).

Atualização 551: interface de disponibilização conectada à autorização especial, inclusive para plano aprovado antes da pausa. Quatro integrações, lint e build aprovados; validação interativa e demais casos Q151 pendentes. [Evidências e limites](../planejamento/validacao-incremento-551.md).

Estado: requisito aprovado, implementação ainda incompleta. Registro da autorização, validação pura e persistência implementados no [incremento 536](../planejamento/validacao-incremento-536.md); consumo na realização acrescentado no [incremento 537](../planejamento/validacao-incremento-537.md) e interface da gestão no [incremento 538](../planejamento/validacao-incremento-538.md). Demais casos discriminados e ensaio interativo continuam pendentes. Esta especificação complementa AV-33; não altera a política de segunda chamada, nota, oportunidade extra ou cobrança.

## Comportamento obrigatório

Atualização 550: servidor/banco permitem disponibilizar plano aprovado antes da pausa usando autorização válida sem substituir proposta/decisão. Interface desse parâmetro ainda pendente. [Evidências e limites](../planejamento/validacao-incremento-550.md).

Atualização 549: portal validado no serviço interno para nota oficial após encerramento; auditoria confirmou lacuna na disponibilização de plano aprovado antes da pausa e divergência de alcance entre autorizações na transição PAUSADA→ENCERRADA. [Evidências e encaminhamento](../planejamento/validacao-incremento-549.md).

Atualização 548: cenários de encerramento ampliados até submissão, aprovação independente da nota e consolidação, preservando matrícula/alocação encerradas. Dois testes direcionados, lint e tipos aprovados. [Evidências e limites](../planejamento/validacao-incremento-548.md).

Atualização 547: encerramento efetivado validado com recuperação preparada antes e depois dele, incluindo autorizações, aprovação, disponibilização, reserva e realização sem reativação. Suíte de lançamentos acadêmicos com 94 aprovações; ensaio interativo e auditoria integral ainda pendentes. [Evidências e limites](../planejamento/validacao-incremento-547.md).

Atualização 546: histórico paginado das autorizações de preparação disponível à gestão, com motivo, autoria, prazo e contagem de propostas. Integração, lint e build aprovados; validação interativa e demais cenários Q151 pendentes. [Evidências e limites](../planejamento/validacao-incremento-546.md).

Atualização 545: interface de autorização/preparação e projeção da aprovação conectadas. Dois cenários integrados, lint e build aprovados; histórico completo e ensaio interativo ainda precisam de conferência. [Evidências e limites](../planejamento/validacao-incremento-545.md).

Atualizações 543–544: registro e consumo da autorização de preparação implementados para criar proposta após pausa/encerramento, com aprovação independente e disponibilização conferidas. Interface desse caminho e verificações adicionais ainda pendentes. [Preparação](../planejamento/validacao-incremento-543.md); [aprovação e disponibilização](../planejamento/validacao-incremento-544.md).

Atualizações 541–542: autorização por plano/habilidade antes da reserva implementada no servidor, banco e interface, mantendo prazo geral e limite. Pendências sem plano aprovado/disponibilizado e ensaio interativo continuam em implementação. [Servidor e banco](../planejamento/validacao-incremento-541.md); [interface e validação](../planejamento/validacao-incremento-542.md).

Matrícula pausada ou encerrada mantém o histórico em leitura. A gestão pode liberar uma pendência identificada de recuperação com motivo e prazo. A liberação pertence à matrícula correspondente e não reativa contrato, cobrança, gravações ou outros acessos. Limites, plano aprovado, atribuição docente, agenda e oficialização continuam necessários.

Registrar ou conferir uma avaliação realizada antes da mudança contratual continua permitido quando o histórico comprovar as condições da realização. Não exigir uma nova autorização apenas porque o lançamento ocorreu depois; tampouco usar uma autorização posterior para inventar que a realização anterior estava autorizada.

## Lacunas e estado atual do código

- `src/server/avaliacoes/recuperacao-realizacao.ts` aceita situação ATIVA ou autorização específica válida para pausa/encerramento comprovados. Preserva intervalo da alocação quando não há autorização, atribuição histórica, prazo, reserva, cancelamento e agenda. O [incremento 539](../planejamento/validacao-incremento-539.md) acrescenta proteção temporal no banco e cenário de encerramento efetivado, sem reabrir matrícula ou alocação.
- `recuperacao-operacao.ts` calcula vínculo válido por alocação ativa e matrícula ATIVA; a projeção de ações precisa refletir a autorização específica, mantendo o histórico disponível.
- `recuperacao-proposta.ts`, `recuperacao-disponibilizacao.ts` e `recuperacao-reserva-tx.ts` precisam ser conferidos para impedir que a autorização de uma pendência abra preparação ou reservas indiscriminadas.
- Existe autorização especial de segunda chamada em `segunda-chamada-autorizacao-especial.ts`. É referência estrutural, não comprovação de que recuperação já está atendida. Não compartilhar limites nem autorizações entre os dois fluxos.

## Implementação necessária

Persistir autorização identificando matrícula, pendência de recuperação, autorizador, motivo, início e fim de validade, com histórico e repetição segura. O registro deve referenciar a pendência real e suas fontes acadêmicas; mudanças de fonte exigem nova conferência. Resolver a autorização no servidor, sem aceitar um booleano de liberação vindo do cliente.

Uma autorização não substitui plano aprovado, oportunidade disponível, reserva, designação docente ou agenda exigida. O fluxo de autorização precisa apontar quais etapas da pendência podem prosseguir, e essas etapas devem conferir o mesmo alcance. Preservar os bloqueios dos demais contratos e das demais habilidades/avaliações.

Na realização, guardar a referência da autorização efetivamente usada. Separar quem realizou de quem registrou. Mostrar na operação da recuperação a pendência liberada, motivo, prazo e impedimentos remanescentes. A gestão precisa consultar esse histórico sem alterar retroativamente a evidência original.

## Evidências exigidas para conclusão

1. Pausa e encerramento comprovados: bloquear sem autorização; permitir somente a pendência autorizada dentro do prazo.
2. Outra matrícula do mesmo aluno, outra pendência, prazo vencido e professor sem atribuição: recusar.
3. Avaliação realizada antes da mudança e registrada depois: preservar data/autoria e aceitar somente com histórico válido.
4. Autorização não aumenta tentativas, não reinicia prazos gerais, não altera notas nem reabre contrato/cobrança.
5. Histórico e consultas respeitam o acesso vigente; telas apresentam ações coerentes com o servidor.
6. Repetição e concorrência não duplicam autorização/realização ou consumo; banco preserva autoria e integridade das referências.

As regras acima derivam de Q151 e dos controles já aprovados; não concedem oportunidades extras de Q150 ou dispensa dos mínimos de Q138. Antes de declarar entrega, validar servidor, banco, projeções e interface juntos.
