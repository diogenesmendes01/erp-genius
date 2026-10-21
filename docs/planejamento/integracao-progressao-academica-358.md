# Integração da progressão acadêmica — revisão 358, 14/09/2026

## Lacuna confirmada no código

Atualização 363: a omissão de recuperações realizadas sem nota no acompanhamento foi corrigida. O carregador exige finalidade explícita; fechamento deverá usar `ACOMPANHAMENTO`, nunca `BASE_PLANO`, e conferir também pendências de reservas, decisões e fontes. [Evidências](validacao-incremento-363.md). A persistência e integração descritas abaixo continuam abertas.

Q130/Q138 exigem mínimos geral e por habilidade, sem exceção de nota. Q131 exige frequência ou exceção pedagógica específica. Q154 distingue o fechamento do resultado da aprovação da mudança de nível. A execução atual de mudança acadêmica não integra essas verificações.

Evidência direta:

- `src/server/avaliacoes/calculo.ts`, `calcularNotasNivel`: calcula `completa`, `atendeRequisitosNotas`, mínimos individuais e recuperação pendente, sem produzir decisão de progressão.
- `src/server/avaliacoes/consolidado-tx.ts`, `carregarConsolidadoAvaliacoesTx`: reúne notas oficiais/correções/recuperações do vínculo e retorna estado `ACOMPANHAMENTO_REGULAR`. Não fecha o resultado nem integra frequência.
- `src/server/academico/acoes.ts`, `decidirMudancaAcademica`: confere identidade, papéis atuais, independência, memória do estado e parecer/dispensa. Não consulta o consolidado ou um fechamento acadêmico.
- No mesmo arquivo, `executarMudancaAcademica` repete essas conferências e altera a alocação. Não verifica notas, frequência, fechamento ou revisões de correção antes de aplicar.
- `src/server/avaliacoes/revisoes-pendentes.ts` torna impactos das correções consultáveis. Não constitui resolução da revisão nem bloqueio integrado da progressão afetada.
- A página de avaliações descreve corretamente o consolidado como acompanhamento. A falta está na ligação com a decisão operacional, e não em transformar esse texto em afirmação de resultado final.

Consequência: uma aprovação manual no fluxo atual não comprova conformidade com Q130/Q131/Q138/Q154. Testes acadêmicos aprovados até 357 verificam o fluxo implementado; não comprovam esse requisito ausente. Não liberar produção com base nessa evidência parcial.

## Entrega necessária, sem redução de escopo

1. Consolidar frequência por matrícula, nível e vínculos históricos, incluindo transferência/equivalência, faltas e regularizações aprovadas. Não duplicar a aula original com a reposição nem contar impedimento como presença. Ausência de dados não equivale a frequência suficiente.
2. Persistir fechamento versionado por matrícula/nível com regra aplicável, fontes de notas, correções, recuperações, segunda chamada, frequência e pendências. Gestão confirma conforme Q154; o resultado final pode ser insuficiente. Não inventar nota ou aceitar configuração incompleta para fechar.
3. Implementar exceção de frequência com proposta/evidências e aprovação independente; ela não altera o percentual real nem dispensa notas. A autorização precisa referenciar o contexto válido.
4. Integrar a aprovação e a execução da progressão ao resultado aplicável. Reavaliar fontes sob locks e recusar resultado insuficiente, pendências obrigatórias, configuração incompleta ou versão superada. Não ampliar o acesso financeiro/administrativo da gestão nem expor notas à Secretaria por consequência da execução.
5. Resolver revisões de correção e aproveitamento por equivalência com autoria e decisão registradas. Correção posterior não desfaz transferência automaticamente; precisa abrir e permitir resolver a pendência. Antes da execução, resultado alterado exige nova conferência.
6. Completar segunda chamada, oportunidades extras e fluxos relacionados já aprovados. Bloquear aprovação indevida não substitui oferecer os caminhos válidos para o aluno regularizar sua situação.

## Evidência de aceite exigida

- Nota ausente, não oficial ou abaixo de qualquer mínimo bloqueia progressão, inclusive com parecer favorável, dispensa de parecer ou administrador.
- Nota suficiente e frequência insuficiente continuam bloqueadas até regularização ou exceção específica válida. Exceção de frequência não altera o resultado numérico.
- Correção entre aprovação e execução invalida a base quando necessário; correção posterior à execução abre revisão sem movimento automático.
- Transferência entre turmas com regras diferentes exige equivalência aprovada, preservando avaliações anteriores e identificando pendências.
- Outra matrícula do mesmo aluno não fornece notas, frequência, oportunidades ou autorização ao contrato selecionado.
- Condições suficientes permitem o fluxo completo: fechamento, solicitação/parecer, aprovação independente, execução pela Secretaria e preservação do financeiro.
- Testes de concorrência devem cobrir correção, fechamento, decisão e execução sobre as mesmas fontes. Homologação da interface e das permissões integra o aceite; testes de cálculo isolados não bastam.

Esta revisão não implementa os itens acima, não modifica as decisões aprovadas e não transforma as lacunas em exceções legadas. É a referência para continuar a implementação da frente acadêmica com critérios verificáveis.
