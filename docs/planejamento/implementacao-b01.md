> Atualização até 414 (2026-09-14): portal e versão validada passaram em regressão de 24 testes; Drive conectado e build aprovado, sem ensaio real. [Evidências](validacao-incremento-413.md), [limites Drive](validacao-incremento-412.md). Publicação com verificação e resultados do aluno em implementação; equivalência e fechamento/progressão pendentes conforme [auditoria](auditoria-resultados-progressao-413.md). Registros abaixo são históricos; escopo integral ainda não concluído.

# B01 — Registro de implementação

**Integração 394:** 129 testes aprovados em nove arquivos de avaliações, diário, reposições, agenda e identidade. Build aprovado no incremento 393. Segunda chamada, entregas no portal, fechamento/progressão e demais requisitos seguem em implementação. [Evidências e limites](validacao-incremento-394.md).


**Incremento 393 — estado atual:** identidade e rotas do portal integradas; build aprovado com 61 páginas estáticas. Agenda de reposições e frequência integradas com correções de vínculo, cotas e períodos. Entrega pelo portal, segunda chamada e demais frentes da SPEC permanecem em desenvolvimento. Evidência de testes e limites: [validação 393](validacao-incremento-393.md). Os incrementos abaixo são histórico, não comprovação da entrega integral.


**Integração 381:** 113 testes acadêmicos, de diário e reposição aprovados em cinco arquivos. Correção de UTC e isolamento de contratos conferidos; agenda por pedido, benefícios e portal do aluno continuam em implementação. [Evidências e limites](validacao-integracao-terra-381.md).

**Integração 378 em andamento:** substituição aprovada e aplicada passou nos testes focados; a rodada completa encontrou duas falhas na frequência em integração. Migração de reposições e nova validação de fontes ainda exigem conclusão e nova rodada. [Estado e evidências](validacao-integracao-terra-378.md).

**Incremento 377:** propostas versionadas de substituição com conferência atual, histórico e isolamento de acesso; 81 integrações acadêmicas aprovadas. Aprovação/aplicação seguem em implementação paralela com subagentes Terra. [Evidências e limites](validacao-incremento-377.md).

## Incremento 1 — Vínculo explícito da alocação, 10/09/2026

Implementado e validado localmente. É a etapa de expansão da [SPEC-ERP-002](../specs/matricula-como-unidade-operacional.md), não a conclusão de B01/Q102.

### Código e integridade

- `AlocacaoTurma.matriculaId` é opcional durante a transição. A migration não atribui contratos a registros históricos por inferência.
- Chave estrangeira composta exige matrícula e alocação do mesmo aluno, inclusive em SQL direto. Alterar titular de contrato já vinculado é impedido.
- Índice parcial protege uma alocação ativa por matrícula. O índice antigo por aluno permanece até migrar os consumidores globais; múltiplos vínculos simultâneos ainda não estão habilitados.
- Criação de matrícula com turma grava seu ID exato na alocação. Transferência equivalente e mudança de nível preservam a referência da origem; legado sem vínculo continua assim identificado.
- Mudança acadêmica exige contrato vinculado ativo e compatível. Outro contrato ativo não substitui essa condição.
- Snapshot registra a matrícula da origem. Alterar/conferir esse vínculo depois da solicitação invalida a revisão anterior. Snapshot antigo só continua válido enquanto a origem permanece sem vínculo.

### Evidências locais

- Prisma validate e geração do cliente passaram. Migration aplicada somente em `localhost:54329/erp_genius_test`, banco descartável.
- TypeScript sem erros; suíte unitária completa: 50 arquivos, 574 testes aprovados.
- Integração inicial: `matricula/alocacao`, `academico/fluxo`, `matricula/ativacao`: 60 testes aprovados.
- Integração seguinte: `matricula/ativacao` com novo caso de criação com turma, `academico/visibilidade`, `turmas/integridade-academica`: 28 testes aprovados. Há sobreposição; não somar como testes distintos.
- Testes verificam vínculo inválido por SQL, troca de titular, legado sem associação, preservação em transferências, contrato encerrado com outro ativo e snapshot anterior à vinculação.

MAT-02, MAT-07, MAT-10 e MAT-14 têm cobertura parcial neste incremento; nenhum critério completo de múltiplos contratos foi declarado homologado.

### Continuação necessária

1. Inventariar/conferir vínculos legados e consumidores globais, preservando ambiguidades como pendências.
2. Migrar seleção, movimentações, propostas e efeitos de pausa, retomada e encerramento para matrícula.
3. Adaptar diário, acesso, consultas, notificações e nova contratação para pessoa existente, com a jornada comercial aprovada.
4. Só então substituir a restrição global por aluno e validar múltiplos contratos de ponta a ponta.

Não houve carga real, alteração de produção, integração externa ativada ou issue criada. Alterações anteriores no workspace foram preservadas.

## Incremento 2 — Cobertura contratual, 11/09/2026

Pré-requisito de Q62/Q65 para migrar pausa: vencimento não determina se o período de serviço começou. O cancelamento legado por vencimento ainda precisa ser substituído no fluxo de propostas por matrícula.

Implementado:

- Referência de cobertura opcional na matrícula, por mês civil ou ciclo com data de referência. Ausência identifica legado não conferido.
- Início/fim de cobertura em colunas DATE na mensalidade, com intervalo inclusivo; sem preenchimento automático do histórico.
- Restrições de banco exigem configuração coerente e par de datas ordenado; taxa de matrícula não recebe cobertura mensal.
- Domínio `src/server/matricula/cobertura.ts` calcula período pelos dias reais, preservando o aniversário original após meses curtos. A classificação para pausa distingue período anterior, iniciado integral e futuro a suspender, sem usar vencimento.

Validação: Prisma validate/generate, TypeScript e ESLint passaram; 9 testes unitários e 2 de integração com PostgreSQL passaram. A migration foi aplicada no banco descartável da porta 54329, sem produção. O banco estava parado e foi iniciado para a validação.

Limite desta etapa: estrutura e cálculo estão implementados, mas ainda não conectados às telas, geração de cobranças ou execução de pausa. Não comprova Q65/Q102 completos. Próxima integração deve preparar/aprovar o conjunto de matrículas e seus impactos, tratar cobertura ausente como pendência e preservar recebimentos e contratos excluídos.

## Incremento 3 — Prévia de pausa por seleção, 11/09/2026

Implementada a Server Action `preverPausaMatriculas` com seleção explícita, não vazia e sem duplicatas, de contratos do mesmo aluno. Secretaria, Financeiro e Administração podem consultar; papéis são relidos após os locks. Vendedor/professor não têm acesso. A projeção não devolve valores monetários.

Somente contratos selecionados e respectivas mensalidades entram na prévia. A classificação usa cobertura, separada do vencimento. Registra pendências para referência contratual ausente, alocação ativa legada sem matrícula, cobertura ausente/sobreposta e recebimento ou comprovante pendente referente a período futuro. Nenhuma dessas situações é resolvida por inferência.

É uma consulta transacional, não uma autorização: não pausa matrícula, modifica cobrança ou cria recebimento. A data informada é a data analisada na prévia; regras de aplicação e data efetiva precisarão ser revalidadas na operação final.

Validação: 4 testes de integração passaram em PostgreSQL de teste, cobrindo seleção, isolamento, autorizações, classificação por cobertura e ausência de mutação. TypeScript e ESLint passaram. Ainda faltam persistência da proposta, aprovação independente, aplicação atômica e interface, além dos consumidores descritos nos incrementos anteriores.

## Incremento 4 — Solicitação e decisão de pausa, 11/09/2026

Implementadas as ações `solicitarPausaMatriculas` e `decidirPropostaPausaMatriculas`, com persistência da seleção, data efetiva proposta, motivo, prévia e assinaturas de integridade dos dados conferidos. A leitura transacional da prévia foi extraída para `pausa-estado.ts`, compartilhada entre consulta, solicitação e aprovação.

- Solicitação exige Secretaria, Financeiro ou Administração. Decisão exige Financeiro ou Administração e uma pessoa diferente do solicitante, inclusive quando acumula papéis. O banco também impede autoaprovação.
- Proposta e itens são gravados na mesma transação do evento de auditoria. Chaves estrangeiras compostas impedem incluir contrato de outro aluno.
- Repetição com a mesma chave e conteúdo retorna a proposta existente. Outra seleção ou condição não pode reutilizar a chave. Solicitações concorrentes distintas não abrem duas propostas para o mesmo contrato.
- Aprovação relê os papéis vigentes e os contratos selecionados. Mudanças nos dados, cobranças, recebimentos ou vínculos exigem nova conferência. Pendências impedem aprovação; rejeição continua disponível para outro usuário autorizado.
- Alterar um contrato fora da seleção não invalida a proposta. A decisão preserva esse contrato e seus dados.
- A prévia compartilhável continua sem valores financeiros; os dados financeiros participam da verificação de integridade no servidor.

Validação local: 21 testes de integração passaram nos arquivos `pausa-proposta` (11), `pausa-previa` (4), `cobertura` (2) e `alocacao` (4), em PostgreSQL descartável. Incluem concorrência, repetição, pagamento posterior, isolamento entre contratos, revogação de autorização, ausência de aplicação parcial e restrições no banco. A sessão é simulada nos testes; dados, transações e conferência de papéis usam o banco real de teste. ESLint passou nos arquivos desta etapa.

**Limite explícito:** aprovar esta proposta ainda não executa a pausa. Não há interface para estas ações; o fluxo legado de pausa por aluno ainda não foi substituído. A execução por matrícula, os efeitos nas cobranças/acesso, a retomada por seleção e a interface continuam pendentes. Não habilitar este incremento isoladamente como pausa por contrato concluída.

Próxima etapa de B01: integrar estado e execução atômica por matrícula, revalidar os impactos no momento da aplicação e migrar os consumidores do estado global do aluno antes de liberar múltiplos contratos na interface.

## Incremento 5 — Núcleo de execução da pausa, 11/09/2026

Adicionado o estado `Matricula.PAUSADA` e o núcleo interno `aplicarPausaMatriculasTx`. A execução exige proposta aprovada independente, autorizações vigentes, data efetiva alcançada e nova conferência da seleção/estado. Repetir aplicação concluída não duplica efeitos. A data civil da operação deverá vir do relógio institucional no servidor quando houver integração com a interface; não é um campo confiável do cliente.

Na mesma transação, altera somente as matrículas selecionadas, incrementa sua versão de acesso, suspende mensalidades de cobertura futura conferidas e registra eventos por matrícula e a data de aplicação na proposta. Períodos iniciados continuam integrais, mesmo com vencimento futuro. Períodos futuros sem recebimento podem ser suspensos mesmo com vencimento anterior. Valores, datas, cobertura e recebimentos não são apagados. A suspensão usa `CANCELADA` com origem explícita `suspensaPorItemPausaId`, distinta do cancelamento comum e da pausa legada; retomada deverá reconhecer essa origem. A FK composta impede relacionar a cobrança ao item de outro contrato.

A aprovação ainda não aplicada pode ser retirada por decisão independente justificada, preservando o evento anterior e registrando o estado anterior na nova decisão. Isso permite preparar nova proposta se os impactos mudarem. Não desfaz uma pausa aplicada.

Validação: Prisma validate/generate, TypeScript e ESLint passaram. Foram aprovados 20 testes na execução inicial (`pausa-proposta` e `pausa-previa`), depois 22 em `pausa-proposta`, `cobertura` e `alocacao`; há sobreposição entre as execuções. A suíte unitária completa passou com 583 testes em 51 arquivos. Os novos casos verificam execução por cobertura, preservação de contrato excluído, repetição, revalidação após aprovação, data futura, autorização revogada, rollback com auditoria e FK da origem da suspensão. Migration aplicada somente no PostgreSQL descartável.

**Continua incompleto:** o núcleo é interno, sem Server Action de execução ou interface. Ainda é necessário migrar diário, acesso, projeção do aluno e retomada antes de expor essa execução. Recebimentos/comprovantes em períodos futuros continuam como pendência de conferência; o tratamento aprovado de cobertura futura paga precisa ser implementado. Alocações e restrições manuais são preservadas. O fluxo legado por aluno permanece e B01/Q65/Q102 não estão homologados de ponta a ponta.

## Incremento 6 — Diário e intervalo de alocação, 11/09/2026

O diário passou a conferir a matrícula explicitamente vinculada à alocação. Outro contrato ativo não autoriza novos lançamentos para uma matrícula pausada. O legado sem vínculo conserva a regra existente por aluno enquanto aguarda conferência, sem associação presumida.

A primeira chamada de uma aula atrasada já aceita alocação encerrada por transferência quando há data de encerramento e a aula pertence ao intervalo `[criadoEm, encerradaEm)`. A interface recebe início/fim, filtra pela data escolhida e evita duplicar o aluno com múltiplos intervalos. O servidor repete a conferência; registros sem fim conhecido não são tratados como histórico válido por inferência. Continuam preservados o vínculo docente vigente, a autoria e a proteção contra edição direta dos registros anteriores de quem saiu.

Validação: 9 testes de integração do diário passaram no PostgreSQL descartável, incluindo chamada inicial posterior à transferência e matrícula pausada com outro contrato ativo. TypeScript e ESLint passaram nos arquivos alterados.

Q53 continua parcial: a situação histórica durante pausa/retomada/encerramento ainda depende da linha do tempo por contrato e da referência temporal institucional. Neste incremento, contrato atualmente pausado não permite nova chamada, inclusive de uma aula anterior à pausa. A regularização desses casos, a designação de responsável e o fluxo de correções aprovadas precisam ser integrados; não considerar o histórico completo homologado.

## Incremento 7 — Preparação da cobertura na retomada, 11/09/2026

Implementado `prepararCoberturasRetomada` como cálculo sem mutação para Q66. Recebe períodos suspensos identificados, períodos preservados, referência contratual, retorno e opção de vencimentos. Produz comparação de cobertura/vencimento anterior e proposto por cobrança. Não calcula desconto ou proporcional financeiro, não altera valores e não cria recebimentos.

As novas coberturas começam no retorno, respeitando os limites da referência contratual; se o retorno ocorrer dentro de um período já preservado, começam depois dele para não duplicar cobertura. O primeiro intervalo pode começar depois do início do mês/ciclo, mantendo seu fim contratual. Isso não reduz o valor integral. Vencimentos podem ser conservados, inclusive antigos, ou informados para exatamente as cobranças selecionadas, sem interferir no cálculo de cobertura. Ciclos preservam o aniversário original após meses curtos. Sobreposições e seleção incoerente são recusadas para conferência.

Validação: 15 testes unitários passaram em `retomada-cobertura` (6) e `cobertura` (9); TypeScript e ESLint passaram. Não houve migration nesta etapa. Ainda falta usar o cálculo na proposta persistida por matrícula, revalidar/autorizar a aplicação, restaurar cobranças e integrar interface e acesso. A retomada legada ainda não usa este cálculo; Q66 permanece parcial.

## Incremento 8 — Prévia da retomada conectada ao banco, 11/09/2026

Implementada `preverRetomadaMatriculas`: seleção explícita de contratos do mesmo aluno, data de retorno e opção de vencimentos por matrícula. Secretaria/Financeiro/Administração consultam a projeção operacional sem valores monetários; a autorização é relida após os locks. O cálculo recebe a referência contratual e as cobranças suspensas pelo item da última pausa aplicada, preservando as demais cobranças válidas como limites de cobertura.

A prévia aponta matrícula não pausada, ausência de pausa contratual rastreável, retorno anterior à pausa, referência/cobertura ausente, recebimentos ou informes em suspensão que exigem conferência e conflitos do cálculo. Não presume a origem de pausas legadas. Consulta não restaura cobranças, muda vencimentos, ativa contrato ou decide uma proposta.

Validação: 18 testes de integração passaram em `pausa-proposta`, incluindo pausa aplicada seguida de prévia de retomada no banco real de teste, preservação dos dados, projeção sem valores, seleção/titularidade e papel comercial sem acesso. TypeScript e ESLint passaram. Persistência/aprovação/aplicação da retomada por seleção e interface continuam pendentes; o fluxo legado permanece separado.

## Incremento 9 — Proposta e aprovação de retomada por matrícula, 11/09/2026

Persistidas seleção, entrada, motivo e prévia na `PropostaRetomadaMatriculas`, separada da retomada legada por aluno. Itens usam FKs compostas para manter a titularidade. Banco e ações impedem decisão pelo solicitante. A solicitação tem chave de repetição e bloqueia propostas abertas sobrepostas.

`decidirRetomadaMatriculas` exige Financeiro/Administração independente e relê papéis, condições, estado financeiro e prévia antes de aprovar. Mudanças exigem nova conferência; pendências impedem aprovação. Repetir decisão idêntica não duplica evento. Aprovação não aplicada pode ser retirada com motivo, sem desfazer execução. O helper `carregarPreviaRetomadaTx` é compartilhado pela consulta, solicitação e decisão.

Validação: migration aplicada somente no PostgreSQL descartável; Prisma validate/generate, TypeScript e ESLint passaram. Os 20 testes de integração de `pausa-proposta` passaram, incluindo persistência/repetição, decisão independente e alteração posterior à proposta de retomada. Aprovar mantém a matrícula pausada: execução, restauração de cobranças, linha do tempo e interface permanecem pendentes. Q66/Q102 continuam parciais.

## Incremento 10 — Núcleo de aplicação da retomada, 11/09/2026

`aplicarRetomadaMatriculasTx` revalida aprovação, participantes, seleção, estado e prévia antes de aplicar. Exige data de retorno alcançada. Na mesma transação, restaura as cobranças rastreadas, aplica cobertura/vencimentos conferidos, reativa somente as matrículas selecionadas, reavalia restrição automática e registra histórico por matrícula. Não altera valores nem cria recebimentos. Manter vencimento conserva inclusive o instante original; novo ciclo da régua impede reutilizar intenções antigas. Restrições manuais continuam preservadas pela reavaliação de acesso.

Repetição de aplicação concluída não duplica efeitos. A origem da suspensão permanece na proposta e nos eventos; o vínculo de suspensão vigente na cobrança é limpo após restaurar. Vencimentos antigos podem manter a dívida em atraso e o bloqueio automático; retomar não equivale a quitar.

Validação: 21 testes de integração passaram em `pausa-proposta`, incluindo aplicação, preservação de outro contrato, valores/vencimento original, ciclo da régua, restrição automática, data futura e rollback. TypeScript e ESLint passaram. Núcleo ainda interno: interface, linha do tempo institucional, consumidores globais e fluxos com pagamentos futuros pendentes precisam ser integrados antes da liberação operacional. Não declara B01 concluído.

## Incremento 11 — Configuração do fuso institucional, 11/09/2026

Adicionado fuso opcional à configuração operacional e ao formulário administrativo, sem presumir valor para dados existentes. Validação aceita identificadores reconhecidos pelo runtime e recusa entradas inválidas. `dataCivilInstitucional` converte um instante para a data da escola, incluindo regras sazonais, independentemente do fuso do servidor. O valor permanece ao editar outras opções; auditoria registra antes/depois completos. Autorização administrativa é relida após o lock.

Troca de fuso já definido com pausas/retomadas aplicadas é impedida nesta configuração simples, pois exige revisão temporal ainda não implementada. A configuração não cria calendários por país. Falta fixar a referência temporal nas movimentações e conectar o relógio às ações operacionais; Q45 continua parcial.

Validação: 6 testes unitários de conversão/validação e 12 testes de integração de configuração passaram; TypeScript e ESLint passaram. Migration aplicada no banco descartável. O formulário foi conferido por código e compilação, sem validação visual nesta etapa.

## Incremento 12 — Referência temporal nas propostas e execução, 11/09/2026

Prévias e snapshots de pausa/retomada agora incluem o fuso institucional. Ausência ou configuração inválida fica como pendência, sem presumir Brasil, país do aluno ou fuso do servidor. A configuração existente é protegida por lock compartilhado durante a transação. Alterar o fuso depois da conferência invalida a aprovação/aplicação pela comparação do snapshot.

Os núcleos de execução recebem um instante do relógio e calculam internamente a data institucional, eliminando o argumento separado de data civil. Pausa registra o mesmo instante usado na conferência como `aplicadaEm`. A referência aprovada permanece no snapshot, para futura reconstrução histórica. Interfaces ainda não chamam esses núcleos.

Validação: 27 testes de integração passaram em `pausa-proposta` e `pausa-previa`, incluindo fronteira de meia-noite na Costa Rica, ausência de fuso e mudança após conferência. TypeScript e ESLint passaram. A linha do tempo acadêmica ainda precisa consumir os snapshots, e Q53/B01 permanecem incompletos.

## Incremento 13 — Situação contratual histórica no salvamento do diário, 11/09/2026

`situacaoMatriculaNaAula` reconstrói estado por ativação e snapshots de pausas/retomadas aplicadas. Usa datas efetivas no fuso registrado, mesmo com execução posterior. Recusa evidência incompleta, sequência contraditória, fuso divergente ou estado atual incompatível com o histórico. Encerramentos ainda exigem sua linha do tempo própria.

O salvamento do diário carrega o histórico dos contratos candidatos e confere o estado na aula. Pode registrar primeira chamada anterior à pausa de contrato ainda pausado; não concede presença durante a pausa apenas porque houve retomada posterior. Legado sem matrícula permanece separado. Vínculo docente e alocação na data continuam exigidos.

Validação: 4 testes unitários históricos e 10 testes de integração do diário passaram, incluindo contrato pausado com chamada anterior permitida e chamada durante pausa recusada. TypeScript e ESLint passaram. A seleção da interface ainda usa a consulta anterior e precisa receber a lista por data; consulta de edição, histórico de encerramento e concorrência com movimentações também precisam ser integrados antes de declarar Q53 completo.

## Incremento 14 — Lista histórica no formulário de chamada, 11/09/2026

A tela de nova aula consulta `listarAlunosParaChamada` ao escolher turma/data. O servidor verifica professor vigente e vínculo docente na aula, intervalo de alocação e histórico contratual. Retorna apenas identificação/nome necessários à chamada e indicação de conferência, sem campos financeiros ou snapshots. Matrícula pausada pode aparecer em aula anterior à pausa, sem aparecer durante ela.

Respostas antigas são descartadas quando a seleção muda ou o formulário fecha. Salvamento fica desabilitado durante carregamento ou conferência. O servidor também recusa nova chamada quando os vínculos candidatos têm histórico contratual incompleto; omiti-los no formulário não contorna a verificação.

Validação: 10 testes de integração do diário passaram, com conferência da consulta antes/durante pausa, projeção mínima e recusa de outro professor. TypeScript e ESLint passaram. Interface verificada por código/compilação, ainda sem teste visual ou de interação no navegador. Concorrência com movimentações, consulta de edição e histórico de encerramento permanecem pendentes.

## Incremento 15 — Serialização do salvamento do diário, 11/09/2026

O salvamento confere atribuição docente antes de adquirir locks e segue a ordem contratos/lead, aluno e turma, compatível com movimentações acadêmicas. Relê o conjunto de contratos após esperar; mudança de vínculos exige recarregar a chamada, sem adquirir novos locks em ordem inversa. Papéis e vínculos docentes continuam sendo relidos após a espera.

Validação: 11 testes de integração do diário passaram. O novo teste segura uma alteração de matrícula em outra transação, confirma a espera real por lock em `pg_stat_activity`, libera a alteração e verifica que o diário recusa o estado sem histórico suficiente, sem gravar chamada adicional. TypeScript e ESLint passaram. Isso cobre a disputa com alteração contratual; não comprova todos os intercalamentos possíveis nem conclui a validação de múltiplos contratos. Consulta de edição, encerramento e verificação da interface ainda pendentes.

## Incremento 16 — Permissão histórica na consulta de edição, 11/09/2026

A listagem de aulas calcula a permissão de edição do registro pela mesma situação histórica contratual usada no salvamento. Mantém vínculo docente vigente e alocação ativa; registros de quem saiu continuam em leitura. Carrega históricos em lote para a página, sem consulta por aula nem exposição dos snapshots ao cliente. Aula anterior à pausa pode ter registro editável; registro legado durante a pausa permanece em leitura.

O seletor inicial de turmas agora retorna somente ID e rótulo. Nomes de alunos são consultados apenas após escolher turma/data pelo endpoint autorizado. Removido o carregamento antecipado de todos os alunos das turmas.

Validação: 11 testes de integração do diário passaram, incluindo permissão histórica antes/durante pausa e projeção mínima do seletor. TypeScript e ESLint passaram. Ainda pendem histórico de encerramento, conferência de dados legados e validação no navegador, além das demais frentes de B01.

## Verificação de regressão após incremento 16 — 11/09/2026

Executadas as suítes completas disponíveis: **599 testes unitários em 54 arquivos** e **429 testes de integração em 38 arquivos**, todos aprovados. Integração rodou sequencialmente contra o PostgreSQL descartável; duração aproximada de 108 segundos. TypeScript sem erros e ESLint aprovado no diário e nos núcleos de execução conferidos.

A execução unitária inicial identificou seis falhas nas fixtures do diário, que ainda não forneciam consultas de matrícula/alocação e campos de intervalo agora utilizados. As fixtures foram atualizadas para representar o contrato de dados real; as regras de autorização e histórico não foram removidas para fazer os testes passarem. A suíte completa foi repetida e passou.

Na validação anterior de visibilidade acadêmica, o teste concorrente foi alinhado a Q53: permite a chamada atrasada de aula anterior à transferência e verifica separadamente a recusa de aula posterior à saída. Preserva os registros originais e a validação de ausência de deadlock.

Este resultado é evidência de regressão dos comportamentos cobertos, não homologação integral das SPECs. Permanecem as limitações dos incrementos, inclusive interface de pausa/retomada, encerramento por contrato, períodos futuros pagos, conferência/migração de legado e validação no navegador, além das outras frentes do produto.

## Incremento 17 — Consulta operacional das propostas, 11/09/2026

`listarPropostasMovimentacao` lista pausa ou retomada de um aluno, com paginação de 50 propostas, contratos envolvidos, autores, decisões e indicação de aprovação independente. O cursor é conferido no mesmo aluno/tipo. Consulta restrita a Secretaria/Financeiro/Administração; não retorna hashes, chaves de repetição, snapshots brutos ou valores monetários. A indicação de permissão não substitui a autorização na ação de decisão.

Validação: 24 testes de integração passaram em `pausa-proposta`, incluindo projeção, isolamento de cursor, recusa do vendedor e distinção entre autor e aprovador. TypeScript e ESLint passaram. O resumo não contém a comparação detalhada dos impactos; essa consulta e a interface ainda precisam ser integradas antes de permitir revisão operacional completa.

## Incremento 18 — Consulta detalhada dos impactos registrados, 11/09/2026

`obterDetalhesMovimentacao` retorna cobertura e vencimento da proposta, preservando a comparação anterior/proposta da retomada e a classificação de períodos da pausa. Usa o snapshot da conferência, sem substituí-lo por recálculo atual. Confere aluno/tipo/ID e autorização; campos são projetados por schema explícito, descartando extras inclusive em objetos internos. Histórico insuficiente é identificado sem inventar impactos.

Validação: 2 testes unitários de projeção e 24 testes de integração passaram, incluindo detalhes da proposta, titularidade e recusa do vendedor. TypeScript e ESLint passaram. A interface de revisão e aplicação ainda não está integrada; o detalhe é operacional e não amplia acesso a valores financeiros.

## Incremento 19 — Interface de consulta de propostas, 11/09/2026

Criada a página `/alunos/[id]/movimentacoes`, acessível pela ficha para Secretaria/Financeiro/Administração. Lista propostas por tipo, paginação, autoria, estado e contratos; permite abrir os impactos registrados com cobertura anterior/proposta e vencimentos. Distingue aprovação de aplicação e identifica histórico incompleto. A rota e as consultas têm autorização própria; ocultar o link não é a proteção única.

A tela oferece consulta, ainda sem criação/decisão/aplicação. Estados de carregamento e erro impedem trocar seleção durante a consulta; não inclui valores financeiros. TypeScript e ESLint passaram. Falta validação no navegador e completar os controles operacionais antes de declarar a jornada implementada.

## Incremento 20 — Decisão independente na interface, 11/09/2026

A revisão detalhada oferece aprovar/rejeitar para quem tem indicação de permissão independente na lista. Exige motivo; aprovação fica desabilitada se o histórico está incompleto ou contém pendências. As ações já existentes revalidam autorizações e impactos no servidor. Após sucesso confirmado, a tela atualiza o estado e remove os controles de decisão. Falha de comunicação orienta consultar o resultado antes de repetir.

A mensagem distingue aprovação registrada de aplicação pendente. Ainda não há criação de proposta ou aplicação operacional pela interface. TypeScript e ESLint passaram; interação visual ainda não homologada. Os testes de integração das ações são evidência do servidor, não substituem o teste de ponta a ponta desta tela.

## Incremento 21 — Formulário de proposta de pausa, 11/09/2026

Adicionado formulário com seleção explícita de contratos ativos, identificação de idioma/modalidade, data e motivo. Consulta a prévia antes de registrar a proposta, mostra períodos futuros a suspender, períodos iniciados integrais e pendências. Alterar dados invalida a prévia local; a ação refaz a conferência no servidor. Repetir envio após resultado incerto mantém a chave do pedido enquanto os dados não mudarem.

A data inicial usa o fuso institucional quando configurado; ausência é informada. O envio registra proposta para decisão independente, sem executar a pausa nem alterar os outros contratos. TypeScript e ESLint passaram. Ainda faltam formulário de retomada, aplicação pela interface e validação visual/de ponta a ponta; B01 continua parcial.

## Incremento 22 — Formulário de proposta de retomada, 11/09/2026

A página oferece seleção de contratos pausados, data de retorno e motivo. A consulta inicial identifica os períodos suspensos; a equipe escolhe explicitamente manter ou reprogramar vencimentos por contrato. A prévia completa mostra cobertura recalculada e vencimentos anteriores/propostos para aprovação conjunta. Alterações invalidam a prévia; o servidor refaz a conferência ao registrar. Envios em curso bloqueiam interação, e uma repetição após resultado incerto conserva a chave do pedido enquanto os dados não mudarem.

Validação: 6 testes de cálculo da retomada e 24 testes de integração de propostas passaram. TypeScript e ESLint passaram. Esses testes validam regras e ações do servidor; a interface ainda não foi homologada no navegador. Aplicação operacional pela interface, tratamento de períodos futuros pagos e migração dos fluxos globais antigos continuam pendentes; B01 permanece parcial.

## Incremento 23 — Interação durante operações e pendências, 11/09/2026

Formulários de pausa/retomada e painel de decisões usam bloqueio explícito até a promessa da operação terminar, com proteção contra uma segunda execução entre renders. A interface não depende da duração de uma transição React para manter os controles desabilitados. A idempotência e as autorizações permanecem conferidas no servidor.

As pendências conhecidas agora apresentam orientações para conferência, em vez de mostrar apenas sua quantidade. Mensagens inesperadas usam orientação genérica, sem expor erros internos ou identificadores de cobranças. TypeScript, ESLint e verificação de whitespace passaram; a interação no navegador ainda precisa ser validada. Não houve ampliação das condições permitidas para aplicar pausa ou retomada.

## Incremento 24 — Situação contratual no painel de acesso, 11/09/2026

O painel distingue ausência de restrição financeira de contrato apto a aulas regulares: exige matrícula ativa e ausência dos bloqueios registrados. Pausada/encerrada não aparece como liberada apenas porque o controle automático deixou de identificar dívida elegível. A consulta calcula a condição por matrícula; a situação de outro contrato do aluno não é herdada.

Validação: 12 testes de integração do controle de acesso passaram, incluindo dois contratos do mesmo aluno, um pausado sem bloqueio financeiro e outro ativo. TypeScript e ESLint passaram. Esta mudança corrige a consulta e a apresentação operacional; não implementa o portal de reprodução nem suas autorizações específicas, ainda pendentes.

## Incremento 25 — Conferência explícita de alocação legada, 11/09/2026

Criada ação `vincularAlocacaoLegada` para Secretaria/Administração associar uma alocação ativa sem contrato à matrícula escolhida, com motivo. Confere autorização atual após locks, titularidade, situação ativa e compatibilidade de idioma/modalidade. Preserva turma, datas e histórico; não substitui vínculo existente, não escolhe automaticamente uma matrícula e não preenche evidências históricas ausentes. Repetir o vínculo já confirmado não duplica o evento de auditoria.

Seis testes de integração passaram, incluindo integridade por FK, conferência pela Secretaria, repetição, recusa de outra titularidade e papel revogado. TypeScript e ESLint passaram. Falta integrar a conferência à interface e tratar os vínculos históricos encerrados. A proteção global de uma alocação ativa por aluno ainda permanece até concluir a migração dos consumidores para contrato; múltiplos contratos simultaneamente alocados não estão liberados.

## Incremento 26 — Interface de conferência do vínculo legado, 11/09/2026

Na página de movimentações, Secretaria/Administração consulta vínculos ativos sem matrícula e escolhe explicitamente entre contratos ativos compatíveis do mesmo aluno. O formulário exige motivo, bloqueia interação durante o envio e remove da lista o vínculo confirmado. A consulta retorna somente identificação de turma e contratos, sem dados financeiros ou pessoais adicionais. A autorização também é verificada no servidor, inclusive diante de papel revogado.

Os seis testes de integração de alocação passaram com cobertura adicional da projeção da consulta, isolamento por aluno e retirada do vínculo já conferido. TypeScript e ESLint passaram. Validação no navegador permanece pendente; conferência de vínculos encerrados e migração completa das operações acadêmicas continuam necessárias.

## Incremento 27 — Seleção contratual na transferência equivalente, 11/09/2026

A ação `trocarTurma` aceita matrícula explícita e consulta somente sua alocação e contrato dentro do aluno indicado. Uma seleção inexistente ou sem alocação não utiliza o vínculo de outro contrato como alternativa. Na seleção explícita, pedidos acadêmicos em aberto são conferidos no contrato correspondente. A nova alocação e a auditoria preservam a matrícula de origem.

Validação: 54 testes de integração do fluxo acadêmico passaram, incluindo recusa de outra matrícula sem alocação, transferência da matrícula correta e preservação do segundo contrato. TypeScript e ESLint passaram. A interface ainda precisa oferecer essa seleção; chamadas antigas sem matrícula conservam a validação de uma única alocação. A remoção da unicidade global depende de concluir os demais consumidores, inclusive mudança de nível e histórico por contrato.

## Incremento 28 — Contexto contratual enviado pela interface acadêmica, 11/09/2026

O contexto acadêmico identifica a matrícula da alocação apresentada. A transferência equivalente pela tela envia essa matrícula e o ID da alocação consultada. O servidor recusa origem diferente após os locks, evitando executar transferência a partir de um vínculo que mudou desde a consulta. Para legado sem contrato, preserva a ausência de vínculo e envia a alocação conhecida.

Os 54 testes de integração acadêmica passaram, incluindo projeção da matrícula de origem e recusa de alocação divergente sem movimentação. TypeScript e ESLint passaram. A tela ainda trabalha com o contexto de uma única alocação; seleção entre múltiplas alocações, migração do fluxo de mudança de nível e homologação no navegador permanecem pendentes.

## Incremento 29 — Escopo contratual da solicitação acadêmica, 11/09/2026

A solicitação aceita matrícula e alocação de origem explícitas, enviadas pela interface. O snapshot registra o escopo escolhido; parecer, decisão, execução e consulta do pedido recarregam esse contrato. Pedidos antigos sem escopo conservam a conferência global anterior. Comparação do snapshot usa igualdade estrutural, sem depender da ordem de propriedades JSON.

Validação: 55 testes de integração acadêmica e 37 testes unitários passaram. O novo cenário verifica pedido do contrato correto, rejeição de outro contrato sem alocação e conclusão do fluxo após alterar o estado do segundo contrato. TypeScript e ESLint passaram. O contador de movimentações ainda é global; migração desse histórico, seleção de múltiplas alocações na interface e remoção da unicidade global continuam pendentes.

## Incremento 30 — Vínculo contratual no histórico acadêmico, 11/09/2026

`MovimentacaoAluno` passa a aceitar matrícula opcional, com FK composta que exige o mesmo aluno. A migração preserva registros antigos sem inferir contrato. Transferências equivalentes e execução de mudanças de nível gravam a matrícula de origem no histórico. Na conferência de pedidos com escopo contratual, movimentos de outros contratos não entram no contador; movimentos sem contrato continuam sendo considerados, pois podem representar operações globais ou legado ainda não conferido.

Validação: 62 testes de integração passaram, incluindo rejeição de titularidade incorreta no banco, preservação do legado, escrita do contrato no histórico e fluxo acadêmico após movimento de outro contrato. Prisma Client gerado, TypeScript e ESLint passaram; migração aplicada somente ao banco local de testes. Outros produtores de movimentação e a apresentação do histórico ainda precisam migrar; não há habilitação de múltiplas alocações neste incremento.

## Incremento 31 — Escolha contratual na página acadêmica, 11/09/2026

A página acadêmica individual oferece links para as matrículas com alocação ativa, respeitando o escopo docente. A consulta recebe a matrícula e retorna origem, destinos e pedido aberto desse contrato. Seleção sem vínculo não utiliza outra alocação. Ao trocar contrato, a interface recria o formulário, e a paginação conserva a seleção. A lista de solicitações continua sendo o histórico do aluno, com a autorização própria de cada pedido.

Validação: 55 testes de integração acadêmica passaram, incluindo contexto do contrato selecionado e contexto vazio/bloqueado do contrato sem alocação. TypeScript e ESLint passaram. Validação visual permanece pendente. A unicidade global ainda limita alocações simultâneas até concluir os consumidores restantes; a ficha geral do aluno e os fluxos globais antigos ainda precisam ser adaptados.

## Incremento 32 — Todos os vínculos autorizados na ficha, 11/09/2026

A consulta da ficha remove o limite de uma alocação e aplica o escopo docente na busca e na projeção. A apresentação lista as turmas atuais com referência da matrícula, horário e professor, preservando a ausência de identificação no legado. Perfis administrativos mantêm a visão ampla; professor recebe somente suas turmas autorizadas.

Validação: 6 testes de integração de visibilidade, 17 testes unitários de consultas e 9 de projeção passaram. O cenário de projeção com dois vínculos confirma que a turma alheia não vaza ao professor e que sua própria turma é encontrada mesmo após outra alocação. Esse cenário usa fixture, pois a unicidade global no banco ainda permanece. TypeScript e ESLint passaram. Lista geral de alunos e operações globais antigas ainda precisam migrar; homologação no navegador permanece pendente.

## Incremento 33 — Lista e exportação com todas as turmas autorizadas, 11/09/2026

A lista geral remove o limite de uma alocação e projeta `turmas`, aplicando o escopo docente na consulta e na saída. A tabela apresenta todos os vínculos autorizados, e o filtro encontra o aluno por qualquer um deles. A exportação usa a mesma coleção na coluna de turma, sem ampliar o acesso.

Validação: 26 testes unitários de consultas/projeção e 14 testes de integração de visibilidade/exportação passaram. TypeScript e ESLint passaram. O teste de projeção com múltiplos vínculos usa fixture; a restrição global no banco permanece até concluir as operações antigas. A interface ainda não foi homologada no navegador.

## Regressão e incremento 34 — Turma da matrícula cobrada, 11/09/2026

Após o incremento 33, passaram 602 testes unitários (55 arquivos) e 436 testes de integração (38 arquivos, 112 segundos). Essa regressão cobre os cenários automatizados existentes, sem comprovar a implementação integral das SPECs ou homologação visual.

Em seguida, a fila de cobrança passou a consultar a alocação da própria matrícula, em vez da primeira turma do aluno. Sem um vínculo contratual inequívoco, não presume a turma de outra contratação. O teste específico identifica uma alocação em outro contrato e confirma que ela não aparece na cobrança selecionada; depois confere a associação correta. Os 8 testes de conferência passaram após a alteração; TypeScript e ESLint passaram. Migração dos fluxos globais restantes e validação no navegador continuam pendentes.

## Incremento 35 — Pausa e retomada no histórico contratual, 11/09/2026

Os núcleos de execução da pausa e retomada gravam movimentação por matrícula na mesma transação, com autor, motivo e referência da proposta. A data de registro acompanha a execução; a data efetiva permanece na proposta e na descrição. Repetição de execução aplicada não duplica o histórico. A consulta da retomada global antiga passa a considerar somente pausas sem matrícula, para não escolher uma pausa contratual como origem global.

Validação: 60 testes de integração de propostas contratuais e retomada antiga passaram, incluindo ausência de duplicação e preservação do histórico de outro contrato. TypeScript e ESLint passaram. A apresentação da identificação contratual na linha do tempo e a substituição dos fluxos globais antigos permanecem pendentes; a aplicação dos novos núcleos ainda não foi exposta na interface.

## Incremento 36 — Contrato identificado na linha do tempo, 11/09/2026

A ficha identifica a matrícula de cada movimentação e distingue registros globais/legados sem vínculo identificado. A projeção limita o professor a movimentos relacionados aos contratos de suas alocações autorizadas ou, no legado, à turma de origem/destino autorizada. Não presume relação acadêmica para uma movimentação global sem referência. Perfis de visão ampla conservam a consulta institucional; motivos privados continuam sujeitos à projeção cadastral existente.

Validação: 10 testes unitários de projeção e 6 testes de integração de visibilidade passaram, incluindo identificação contratual e exclusão de movimentos alheios para o professor. TypeScript e ESLint passaram. Falta homologar a apresentação no navegador e concluir a substituição das operações globais antigas.

## Incremento 37 — Separação dos fluxos globais antigos, 11/09/2026

Pausa/encerramento globais e preparação/aprovação de retomada global recusam alunos com matrícula pausada ou proposta contratual pendente, aprovada ou aplicada. A conferência ocorre após os locks. Rejeitar uma proposta global permanece possível; a proteção impede aplicá-la sobre um contexto já tratado por contrato. Propostas contratuais rejeitadas, isoladamente, não acionam esse bloqueio.

Validação: 60 testes de integração de propostas contratuais e retomada antiga passaram. O novo cenário verifica que pausa/encerramento globais recusados preservam contratos e histórico. TypeScript e ESLint passaram. Esta proteção não conclui a substituição dos fluxos: a aplicação contratual pela interface e o encerramento por contrato ainda precisam ser implementados antes de declarar a jornada operacional completa.

## Incremento 38 — Aplicação contratual pela interface, 11/09/2026

O painel de impactos oferece aplicação de proposta aprovada por meio de `aplicarMovimentacaoContratual`. A ação autentica o operador, confere aluno/proposta e usa relógio do servidor. Os núcleos revalidam aprovação independente, permissões atuais, data efetiva e impactos. O cadastro global é conferido sob lock: situação não ativa exige regularização do legado antes da execução contratual. Repetição de operação aplicada conserva o resultado sem duplicar alterações ou histórico.

Validação: 25 testes de integração de propostas passaram, incluindo a ação pública de pausa/retomada, recusa de proposta não aprovada, isolamento do aluno e repetição. TypeScript e ESLint passaram. A interface ainda exige homologação no navegador. Períodos futuros com recebimento/informe continuam em conferência; encerramento contratual, liberação de múltiplas alocações e demais SPECs permanecem incompletos.

## Incremento 39 — Cobertura futura integralmente paga, 11/09/2026

A pausa aceita período futuro com status PAGO, saldo zero e valor recebido suficiente, sem informe pendente. Suspende sua cobertura pelo vínculo da proposta e conserva o estado PAGO. A retomada reprograma a cobertura mantendo a quitação, valores, data do pagamento e registros de recebimento; não reabre a dívida. Casos parciais, inconsistentes ou com comprovante em conferência permanecem pendentes.

Validação: 29 testes de integração de proposta/prévia passaram. O ciclo pela ação pública inclui mensalidade futura paga e recebimento persistido, verifica conservação durante a pausa, nova cobertura na retomada e ausência de duplicação. TypeScript e ESLint passaram. Ainda faltam tratar recebimentos parciais e homologar a apresentação desses efeitos no navegador.

## Incremento 40 — Recebimento parcial preservado, 11/09/2026

A pausa aceita recebimento parcial quando valor negociado, recebido e saldo são consistentes, sem comprovante pendente. A suspensão mantém valores e recebimentos; a retomada restaura a exigibilidade do saldo conforme o vencimento aprovado e reprograma a cobertura. A conferência usa Decimal e não confirma comprovantes nem inventa quitação. Estado PAGO continua preservado para períodos integralmente quitados.

Validação: 30 testes de integração de proposta/prévia passaram, incluindo ciclos públicos com 40 e 100 recebidos de uma cobrança de 100, preservação do recebimento e recusa de saldo inconsistente. TypeScript e ESLint passaram. Comprovantes pendentes continuam exigindo conferência prévia; apresentação detalhada dos efeitos e homologação no navegador ainda precisam ser concluídas.

## Validação no navegador — Pausa e retomada, 11/09/2026

O build de produção passou após o incremento 40. Em instância local conectada exclusivamente ao banco de testes, dois usuários fictícios percorreram a interface de movimentações: solicitação de pausa, consulta de impactos, aprovação por outra pessoa e aplicação. A tela removeu o contrato dos ativos e o apresentou como pausado. O solicitante não recebeu controles para aprovar sua própria proposta.

Em seguida, a interface exigiu escolha explícita do tratamento dos vencimentos, gerou a proposta de retomada e permitiu aprovação por outro usuário e aplicação. O contrato voltou à lista de ativos; a proposta apareceu como aplicada. O cenário usou contrato sem cobranças: não homologa visualmente reprogramação de parcelas, valores parciais, múltiplos contratos, perfis não administrativos ou todos os tamanhos de tela. Os cenários financeiros permanecem cobertos pelos testes automatizados descritos acima. A implementação integral das SPECs continua pendente.

## Incremento 41 — Cobertura no cronograma da ativação, 11/09/2026

A ativação expande os períodos seguintes a partir da cobertura completa da primeira mensalidade e da referência contratual registrada. O vencimento continua independente. Meses civis e ciclos da matrícula preservam continuidade, inclusive âncora 31 após fevereiro. Informação parcial ou incompatível exige conferência antes de ativar; o legado sem nenhuma referência permanece sem cobertura presumida.

Validação: 3 testes unitários e 4 de integração de ativação passaram, além de TypeScript e ESLint. O cenário integrado verifica três períodos de um ciclo iniciado em 31/01/2028, atravessando fevereiro bissexto, sem derivá-los dos vencimentos. Ainda é necessário concluir a coleta/conferência contratual dessas informações, eliminar o caminho legado sem cobertura na entrada definitiva e implementar os demais regimes comerciais. Esta expansão não conclui B01 nem a geração contínua de Q64.

## Incremento 42 — Coleta de cobertura na criação, 11/09/2026

O formulário de matrícula exige seleção explícita entre mês civil e ciclo mensal e a data inicial do primeiro período. A ação valida datas civis reais e exige primeiro dia do mês para a referência civil; grava a regra na matrícula e o intervalo completo na primeira mensalidade. No ciclo, a data inicial torna-se a âncora contratual. Não altera vencimento nem aplica proporcionalidade. A ação ainda aceita ausência completa desses campos para chamadas legadas; essa compatibilidade não satisfaz a entrada definitiva sem lacunas.

Validação: 13 testes unitários de cobertura e 4 de integração de ativação passaram, além de TypeScript e ESLint. O teste integrado passou a fornecer a cobertura pela ação de criação, sem preencher esses campos diretamente no banco. Homologação dos novos campos no navegador, conferência/edição das condições pela Secretaria e remoção do caminho legado continuam pendentes.

## Incremento 43 — Conferência de cobertura pela Secretaria, 11/09/2026

O painel da Secretaria apresenta a referência e as datas do primeiro período. Na preparação assumida e ainda sem aceite, Secretaria/Administração pode completar ou corrigir a cobertura com motivo. A ação revalida papel atual sob transação, bloqueia matrícula/cobranças, exige uma única mensalidade inicial sem recebimento ou comprovante pendente e registra valores anteriores/novos em evento. Valores e vencimento permanecem preservados. Contrato aceito ou mensalidade com avanço financeiro exige seu fluxo de alteração próprio.

Validação: 10 testes de integração da Secretaria passaram, incluindo recusa para vendedor, falta de assunção, pagamento e contrato aceito, além de conservação dos valores e cobertura por ciclo. TypeScript e ESLint passaram. Homologação visual destes campos, confirmação contratual versionada e obrigatoriedade da cobertura em todas as entradas ainda precisam ser concluídas; este incremento não substitui as aprovações financeiras/documentais previstas nas SPECs.

## Incremento 44 — Vencimento de 1 a 31, 11/09/2026

Q90: o formulário e o schema aceitam qualquer dia inteiro de 1 a 31. O cálculo mensal limita dias inexistentes ao último dia do próprio mês, preserva a competência e usa novamente o dia contratual na próxima emissão. A primeira mensalidade usa o mesmo ajuste. Coberturas e cobranças já persistidas não são reescritas. Ajuste por dia útil financeiro de Q99 continua separado e pendente.

Validação: 67 testes unitários e 4 de integração de ativação passaram, além de TypeScript e ESLint. Casos incluem fevereiro comum/bissexto, retorno a março 31, abril 30 e persistência do dia contratado e das datas no cronograma da ativação. A regra anterior de referência da primeira cobrança (início mais 30 dias) ainda precisa ser substituída pelo vencimento explicitamente conferido na jornada comercial; a alteração atual trata exclusivamente do ajuste de dia inexistente.

## Regressão após incremento 44 — 11/09/2026

Passaram 613 testes unitários em 56 arquivos e 440 testes de integração em 38 arquivos (113 segundos). A primeira execução unitária revelou um mock antigo sem a consulta de proteção de movimentações contratuais; o mock foi atualizado e acrescentado cenário que verifica ausência de alterações no encerramento global recusado. A regra de produção não foi flexibilizada. ESLint e diff-check passaram. Os resultados cobrem os cenários existentes, sem demonstrar conclusão integral das SPECs ou homologação de todas as telas.

## Incremento 45 — Primeiro vencimento explícito, 11/09/2026

A entrada pelo formulário exige a data acordada da primeira mensalidade, separada do período coberto e do dia de referência dos meses seguintes. O servidor valida a data civil e impede omissão quando a contratação informa cobertura estruturada. Criação grava a data indicada; ativação conserva a primeira e calcula os próximos meses usando o dia contratual. Chamadas legadas sem cobertura ainda conservam o cálculo anterior e precisam migrar antes da conclusão da jornada.

Validação: cenário de integração com primeiro vencimento em 29/02/2028, referência 31 e cobertura iniciada em janeiro confirma competências fevereiro/março/abril e dias corretos. Os 4 testes de ativação passaram, assim como testes do schema, TypeScript e ESLint. Conferência/alteração do vencimento pela Secretaria e homologação visual continuam pendentes.

## Incremento 46 — Conferência do primeiro vencimento, 11/09/2026

A conferência da preparação pela Secretaria passa a exigir também o primeiro vencimento acordado. Atualiza data, competência e situação pendente/atrasada conforme o dia institucional configurado, conservando os valores e registrando a condição anterior e a nova. Mantém os bloqueios por aceite, recebimento, comprovante pendente e cronograma ambíguo. O formulário apresenta a data existente para revisão explícita. O armazenamento da data continua na convenção temporal legada; a unificação de datas civis do financeiro ainda não está concluída.

Validação: 10 testes de integração da Secretaria, TypeScript e ESLint passaram. O cenário verifica primeiro vencimento em fevereiro bissexto independente da cobertura iniciada em janeiro, sem alterar o valor devido. Homologação visual, substituição dos caminhos legados e emissão somente após conferência conforme Q112/Q119 continuam pendentes.

## Incremento 47 — Revisão obsoleta da preparação, 11/09/2026

A conferência da cobertura/vencimento exige a identidade e a versão da mensalidade exibida. Sob os locks, uma versão diferente ou substituição de cobrança recusa a gravação e pede nova consulta, impedindo que uma revisão antiga sobrescreva condições mais recentes. O formulário reinicia seus valores quando recebe uma nova versão do servidor.

Validação: 10 testes de integração da Secretaria passaram, incluindo rejeição de revisão antiga e conservação do vencimento já conferido; TypeScript e ESLint passaram. Esta proteção cobre o formulário de cobertura e primeiro vencimento, sem declarar controle de concorrência concluído para toda a preparação comercial.

## Incremento 48 — Condições mensais no registro de aceite, 11/09/2026

A confirmação contratual bloqueia matrícula/cobranças antes de conferir documento e registra uma cópia das condições mensais: referência, cobertura, dia de referência, vencimentos, valores, moedas e versões das cobranças. Quando existe cobertura estruturada, informação incompleta/incompatível impede o aceite. O legado sem referência continua identificado por campos nulos. O evento preserva as condições naquele momento; não é uma assinatura digital nem conclui o versionamento documental/aditivos.

Validação: 11 testes de integração da Secretaria passaram, incluindo recusa de cobertura incompleta, condições preservadas no evento e concorrência de confirmação/arquivamento já existente. TypeScript e ESLint passaram. Exigência universal de condições estruturadas, conferência da versão exibida no momento do aceite e integração de assinatura continuam pendentes.

## Incremento 49 — Aceite com versões conferidas, 11/09/2026

A confirmação exige a lista de identidades/versões das mensalidades consultadas. Sob lock, inclusão, remoção, duplicidade ou versão divergente bloqueia o aceite até nova conferência. A página envia a coleção completa, preservando a comparação mesmo quando já há cronograma. A proteção não cobre ainda todos os atributos do modelo documental/signatários; esses fluxos seguem pendentes.

Validação: 11 testes de integração da Secretaria passaram, incluindo mudança de versão entre consulta e aceite, além de TypeScript e ESLint. O teste confere que a versão antiga é recusada e a atual permite registrar as condições. Homologação no navegador permanece pendente.

## Incremento 50 — Mensalidades visíveis na conferência contratual, 11/09/2026

O painel apresenta à Secretaria/Administração todas as mensalidades do conjunto conferido, com intervalo coberto, vencimento e valor contratado na moeda correspondente. Ausência de cobertura aparece como pendência. O conjunto detalhado não é enviado ao perfil comercial por essa projeção. O aceite envia somente identidades/versões para a comparação no servidor, sem confiar em valores informados pelo navegador.

Validação: TypeScript e ESLint passaram. Este incremento é de apresentação; não foi homologado no navegador e não amplia a evidência dos testes financeiros anteriores. A conferência documental completa e os demais módulos continuam pendentes.

## Incremento 51 — Renovar conferência visual do aceite, 11/09/2026

O formulário de aceite é reiniciado quando o servidor entrega mensalidades, documentos ou referência alterados. Isso limpa a seleção documental e a confirmação marcada anteriormente, evitando reaproveitar uma marcação visual após atualizar as condições. A verificação de versões no servidor continua obrigatória.

Validação: build de produção concluído com TypeScript e geração de páginas; ESLint e diff-check passaram. A interação visual de limpeza ainda precisa ser homologada no navegador. O build não comprova a entrega das funcionalidades pendentes.

## Incremento 52 — Entrada mensal sem cobertura implícita, 11/09/2026

Novas criações mensais exigem cobertura estruturada e primeiro vencimento também no schema do servidor. O fluxo de criação deixa de usar início da turma/relógio mais 30 dias como substituto do vencimento contratado. O formulário passa os campos explicitamente; chamadas incompletas são recusadas antes de persistir aluno, matrícula ou cobrança. Não há migração presumida dos registros antigos: a ativação do legado ainda requer seu tratamento próprio.

Validação: 6 testes unitários do schema e 25 de integração de ativação/política financeira passaram, além de TypeScript e ESLint. O novo cenário verifica ausência de efeitos persistidos quando cobertura ou vencimento são omitidos. Fixtures de criação foram atualizadas com condições explícitas. Este requisito ainda trata da oferta mensal atual; preparação sem emissão, particulares por hora, disponibilidade/reserva e demais regras comerciais continuam pendentes.

## Incremento 53 — Ativação exige cobertura conferível, 11/09/2026

A expansão do cronograma deixa de aceitar ausência completa de cobertura. A ativação recusa matrícula sem referência e período inicial coerentes, inclusive no legado e em plano de um mês. Não preenche condições presumidas nem apaga os dados antigos. Preparação ainda sem aceite/pagamento pode usar a conferência da Secretaria; contratos já aceitos ou com avanço financeiro precisam dos fluxos próprios de regularização, ainda incompletos.

Validação: 20 testes unitários e 25 de integração de ativação/política financeira passaram, além de TypeScript e ESLint. O novo teste verifica recusa mesmo com contrato aceito e taxa confirmada, sem atualização da matrícula. A mudança não conclui a migração dos dados antigos nem os demais requisitos de ativação das SPECs.

## Incremento 54 — Ativação confere condições do aceite, 11/09/2026

Quando o registro de aceite contém condições mensais, a ativação compara documento, referência, cobertura, vencimentos, valores e moedas com o estado atual. Divergência exige revisão contratual. Status de pagamento, valor recebido e versão técnica não participam dessa igualdade: confirmar pagamento não altera a condição comercial aceita. Eventos legados sem cópia das condições ainda exigem migração/conferência própria; não foi criado histórico retroativo.

Validação: 17 testes unitários de conclusão e 5 de integração de ativação passaram, além de TypeScript e ESLint. O cenário unitário recusa valor negociado alterado e permite pagamento confirmado com condições preservadas. A prova integrada de todo o percurso Secretaria–aceite–pagamento–ativação e a migração do legado permanecem pendentes.

## Validação integrada do aceite até a ativação — 11/09/2026

O cenário de ativação agora usa as ações públicas de assunção e confirmação contratual, com documento/registro de upload fictícios, em vez de preencher manualmente os campos de aceite. Após confirmar a taxa, uma alteração artificial no valor da mensalidade é recusada na ativação; matrícula permanece aguardando e nenhum mês adicional é criado. Restauradas as condições originais no teste, a ativação gera o cronograma e preserva o aceite.

Os 5 testes de integração da ativação passaram; ESLint e diff-check passaram. Essa evidência cobre a integração das ações no banco de testes. Não equivale a upload físico, assinatura externa ou homologação da jornada no navegador.

## Incremento 55 — Cálculo da parcela no encerramento, 11/09/2026

Iniciado o núcleo do acerto por contrato com cálculo de uma parcela: dias reais, inclusão/exclusão explícita da data efetiva, desconto antes/depois do proporcional, referência da versão contratual, memória e apuração separada de saldo/crédito. Usa Decimal e arredondamento monetário existente, sem criar recebimento, crédito contábil ou devolução. Exige desconto já validado pelas condições contratuais; desconto percentual e condições de elegibilidade devem ser resolvidos antes desta função.

Validação: 4 testes unitários passaram, cobrindo os exemplos de Q63, fevereiro bissexto, limites do período e ausência de crédito fictício por desconto superior ao proporcional. TypeScript e ESLint passaram. O núcleo ainda não está exposto por ação/interface nem integrado à proposta/aprovação de encerramento. Multa, compensações de oferta, períodos já ajustados e ledger permanecem pendentes; não representa acerto completo.

## Incremento 56 — Cálculo da multa contratual, 11/09/2026

Núcleo de Q17 representa ausência explícita de previsão, valor fixo ou percentual com base e descrição obrigatórias. Regras com multa exigem versão contratual, cláusula, condições e evidência de aplicabilidade. Preserva a regra e memória do cálculo em Decimal, sem misturar multa ao proporcional. Não recebe opção livre de dispensa nem autoriza cobrança; justificativa/aprovação de alteração ainda devem integrar a proposta.

Validação: 8 testes dos núcleos de encerramento passaram, além de TypeScript e ESLint. Casos incluem percentual com fração monetária, falta de base, ausência de previsão e recusa de dispensa não autorizada no formato de entrada. Falta integrar estes cálculos às condições persistidas, proposta/aprovação, compensações e execução financeira; o encerramento permanece incompleto.

## Incremento 57 — Composição da prévia mensal de encerramento, 11/09/2026

O núcleo reúne parcelas e multa de uma matrícula/versão/moeda/data efetiva, recusa identidades duplicadas, períodos sobrepostos e referências incompatíveis. Totaliza serviço, saldo devido e crédito apurado separadamente, sem compensar automaticamente crédito contra outra cobrança. A multa aparece uma única vez em linha própria. A origem real das parcelas ainda deve ser carregada e validada pelo futuro fluxo de proposta; o cálculo puro não autentica titularidade.

Validação: 11 testes dos núcleos de encerramento, TypeScript e ESLint passaram. Permanecem pendentes condições persistidas, ajustes anteriores, compensações de oferta, horas antecipadas, proposta/aprovação e execução. Esta prévia mensal não é o acerto operacional completo nem um lançamento no ledger.

## Incremento 58 — Persistência das versões de encerramento, 11/09/2026

Expansão do schema com condições de encerramento por matrícula, documento de origem, número de versão, regras estruturadas, preparador e decisão. A migration exige versão única por matrícula, impede autoaprovação e decisão concluída sem autor/data/justificativa; referências preservam matrícula/documento/usuários. Nenhuma regra antiga foi preenchida automaticamente.

Validação: migration aplicada no banco de testes; 2 testes de integração de restrições e TypeScript/ESLint passaram. As regras JSON ainda precisam de validação pelo fluxo de preparação/aprovação, inclusive pertença documental, condições completas e imutabilidade após aprovação. Não há ação/interface consumindo esta expansão nem uso automático no acerto. A persistência isolada não conclui a entrega.

## Incremento 59 — Preparação e decisão das regras de encerramento, 11/09/2026

Ações de servidor permitem à Secretaria/Administração transcrever as regras do contrato confirmado e à outra pessoa da Administração aprovar/rejeitar. Exigem documento vigente da matrícula, regras completas, motivo e papéis atuais; serializam versões por matrícula e impedem nova preparação enquanto houver proposta pendente. Versão decidida não recebe outra decisão pela ação. A aprovação estrutura condições existentes; não altera cláusula assinada nem substitui aditivo.

Validação: 3 testes de integração passaram, incluindo exigência de contrato confirmado, pendência duplicada, autoaprovação mesmo com papel administrativo e preservação da decisão. TypeScript e ESLint passaram. A interface e a seleção da versão aplicável ao acerto ainda não estão implementadas; a regra de aplicabilidade da multa será conferida no caso concreto, sem presumir base financeira.
# Incremento 60 — Interface de condições contratuais de encerramento

A Secretaria/Administração pode preparar as condições do contrato confirmado na página de Secretaria. A tela apresenta versões, documento de origem, inclusão/exclusão do dia, método e condições de desconto, previsão de multa, autoria e decisão. Outra pessoa da Administração pode aprovar ou rejeitar com motivo. As opções contratuais não recebem valores presumidos; uma proposta pendente impede nova preparação. A consulta fica restrita à Secretaria/Administração e as ações mantêm a autorização e a proibição de autoaprovação no servidor.

Validação: TypeScript e ESLint dos componentes passaram; os três testes de integração das condições passaram. A interface ainda não foi validada em navegador. Este incremento não implementa a efetivação do acerto financeiro, geração de crédito ou encerramento da matrícula.
## Incremento 61 — Consulta para conferência do encerramento, 11/09/2026

Consulta de servidor exclusiva do Financeiro/Administração carrega uma matrícula identificada também pelo aluno, suas cobranças e ajustes em leitura consistente. Seleciona condições aprovadas somente do documento confirmado vigente, sinalizando revisão pendente, cobertura incompleta, comprovantes pendentes e necessidade de conciliação. Não transforma a diferença de preços em desconto elegível automaticamente nem cria crédito ou acerto.

Validação: quatro testes de integração das condições passaram, incluindo consulta autorizada, rejeição de matrícula de outro aluno, preservação dos valores e revisão pendente; TypeScript e ESLint passaram. A primeira execução identificou um filtro de matrícula incorreto, corrigido antes da repetição bem-sucedida. Próxima integração: conferência dos componentes e persistência da proposta financeira com aprovação independente. A consulta ainda não constitui prévia final ou efetivação de encerramento.
## Incremento 62 — Solicitação de encerramento por matrícula, 11/09/2026

Implementada a entrada do pedido do aluno pela Secretaria/Administração, selecionando uma ou várias matrículas ativas/pausadas. Registra data solicitada, data de registro no fuso institucional, motivo, referência da evidência e justificativa/evidência adicionais para retroatividade. A retroatividade fica solicitada, sem aprovação implícita. A operação é idempotente, serializa pedidos concorrentes e recusa outra solicitação aberta para contratos já selecionados. Chaves estrangeiras compostas impedem misturar contratos de outro aluno; nenhum estado acadêmico, financeiro ou de acesso é alterado pelo registro.

A página de movimentações oferece formulário e histórico dos 50 pedidos mais recentes para Secretaria/Financeiro/Administração; somente Secretaria/Administração prepara. O caminho global legado passa a recusar aluno com solicitação contratual aberta, em acerto ou concluída, evitando atingir contratos não escolhidos.

Validação: migrations aplicadas somente no banco de testes; 33 testes de integração (solicitação, condições e pausa) e 21 testes unitários (movimentação e cálculo) passaram; TypeScript e ESLint passaram. Testes cobrem repetição concorrente, chave reutilizada com dados diferentes, seleção entre alunos, papéis, retroatividade documentada, preservação dos contratos e bloqueio do caminho global. Interface ainda sem validação em navegador. O fluxo de preparação/aprovação/efetivação do acerto continua pendente; registrar um pedido não conclui B01 ou Q102.
## Incremento 63 — Prévia mensal vinculada ao pedido, 11/09/2026

O Financeiro/Administração pode conferir o componente mensal de um pedido de encerramento. A ação exige exatamente os contratos selecionados e todas as mensalidades de cada um, versão vigente das condições e versões conferidas das cobranças. Carrega valores/recebimentos de origem; base e desconto elegível são declarados pelo preparador com evidência, preservados ao lado da origem para posterior revisão independente. O cálculo usa a data solicitada do pedido e as regras contratuais de proporcional/desconto. Multa fixa/percentual usa valor/percentual e descrição da base da versão aprovada; o preparador informa aplicabilidade e valor da base percentual. Dispensa/alteração não é presumida.

A consulta passou a confrontar o acumulado recebido com os recebimentos detalhados e suas moedas, recusando divergências na prévia. Não há compensação automática de créditos. Cobranças não mensais são apresentadas separadamente, sem desaparecer da conferência. Esta etapa é explicitamente um componente do acerto, ainda sem persistência da proposta financeira, tela, aprovação, concessão de créditos ou efetivação. As origens terão de ser recarregadas e comparadas na aprovação; leituras de vários contratos não são uma execução financeira atômica.

Validação: 4 testes unitários da prévia e 8 de integração das condições/pedido passaram, cobrindo cálculo a partir do pedido, papéis, seleção, versões, omissões/duplicidades, origem preservada e recebimento sem conciliação. TypeScript e ESLint passaram.
## Incremento 64 — Rascunho financeiro versionado, 11/09/2026

Persistência do componente mensal conferido em versões de rascunho vinculadas ao pedido. Financeiro/Administração informa a versão anterior, motivo e chave idempotente; o servidor recarrega a prévia e conserva entrada, origens e memória de cálculo. Repetição concorrente retorna a mesma versão; chave com dados diferentes e preparação sobre versão antiga são recusadas. Versões anteriores permanecem consultáveis pelo Financeiro/Administração. O pedido passa a “em acerto”, sem modificar contratos ou cobranças.

Consultas de contexto/prévia foram separadas em funções transacionais internas. A prévia de vários contratos agora usa uma leitura consistente única; ao salvar o rascunho, o servidor serializa o pedido e bloqueia matrículas, cobranças e documentos de origem durante a conferência. A migration foi aplicada somente no banco de testes. Rascunho não é aprovação nem acerto completo: outros componentes, revisão independente, interface financeira e efetivação continuam pendentes.

Validação: 8 testes de integração e 4 unitários passaram, com cobertura de salvamento concorrente, nova versão, histórico, controle de acesso e preservação financeira. TypeScript e ESLint passaram.
## Incremento 65 — Interface de preparação financeira, 11/09/2026

Pedidos abertos/em acerto na página de movimentações exibem preparação financeira somente ao Financeiro/Administração. A equipe carrega contextos e último rascunho, consulta cobranças/ajustes/pendências e informa base, desconto elegível e evidências sem valores presumidos. Multa apresenta a cláusula aprovada e exige aplicabilidade/base percentual quando cabível. A tela calcula e apresenta dias cobertos, base, desconto, serviço, multa, saldo e crédito separado por matrícula/moeda; edição invalida a prévia anterior. O salvamento exige motivo e conserva chave de repetição enquanto a conferência não muda, consultando a versão efetivamente salva.

Cobranças fora do componente mensal aparecem explicitamente como pendentes do acerto completo. A tela não oferece efetivação nem representa rascunho como aprovado. O preparo financeiro completo e sua aprovação permanecem em desenvolvimento.

Validação: build de produção Next.js, TypeScript, ESLint dos componentes e 8 testes de integração das condições/pedido/rascunho passaram. O formulário ainda precisa de validação interativa em navegador; build e testes de servidor não comprovam essa etapa.
## Incremento 66 — Proposta de exceção da multa, 11/09/2026

A conferência mensal admite propor dispensa ou alteração de multa com justificativa. Mantém a regra e o valor contratual originais, acrescentando uma proposta explícita com valor alternativo e saldo correspondente, marcada como dependente de aprovação independente. O rascunho conserva essa conferência no mesmo registro versionado; não altera cobrança, cláusula ou autorização. Multa percentual mantém base e percentual originais identificados. A interface permite escolher o tratamento e mostra ambos os resultados sem apresentar a exceção como aprovada.

Validação: 10 testes unitários de prévia/multa, 8 testes de integração do fluxo existente, TypeScript e ESLint passaram. A aprovação específica e a execução do acerto completo permanecem pendentes. Interface ainda sem validação interativa em navegador.
## Incremento 67 — Validação interativa do pedido e rascunho, 11/09/2026

Executado no navegador integrado contra servidor local e banco descartável, com fixture fictícia: autenticação, escolha de somente um dos dois contratos, pedido para 15/09/2099, carga da conferência, base 500/desconto 100, multa contratual 80 e proposta de alteração para 35, cálculo e salvamento. A tela mostrou 15/30 dias, serviço 200, saldo contratual 280 e saldo alternativo 235, identificando a exceção como pendente. O banco confirmou um pedido e um rascunho, seleção exata, ambas as matrículas ativas e cobrança de 400 preservada, sem recebimento criado.

Corrigidas duas observações do uso: validação local em português para data incompleta/seleção vazia e atualização do status do pedido após salvar. TypeScript e ESLint passaram. A fixture usa documento contratual fictício já confirmado e regras previamente aprovadas; esta execução não valida upload, assinatura, aprovação das regras, papéis distintos no navegador nem efetivação do acerto. Evidência: `docs/validacao-encerramento-navegador-2026-09-11.json`; preparação/verificação em `scripts/validacao/encerramento-navegador.mjs`.
## Incremento 68 — Conferência de atualidade do rascunho, 11/09/2026

Financeiro/Administração pode comparar o rascunho salvo com o pedido e as origens atuais, em leitura consistente. O diagnóstico identifica versão posterior, entrada incompatível, mudança de evidências/condições/cobranças e pendências que impedem reproduzir o cálculo. O resultado informa quando foi conferido; não concede aprovação nem garante validade futura. A interface oferece essa consulta dentro do rascunho e preserva o cálculo anterior.

O snapshot passa a guardar também os dados/evidências do pedido, vencimento e saldo das cobranças. Versões antigas sem esse contexto completo exigem nova conferência, sem preenchimento retroativo inventado. Validação: 8 testes de integração e 6 unitários da prévia passaram; TypeScript e ESLint passaram. A nova consulta visual ainda não foi exercitada no navegador; a validação interativa anterior cobre pedido/cálculo/salvamento, não este botão.
## Incremento 69 — Regressão completa e relógio do Pipeline, 11/09/2026

Regressão completa após os incrementos de encerramento: 633 testes unitários em 60 arquivos e 450 testes de integração em 40 arquivos passaram. A integração levou aproximadamente 118 segundos no banco descartável. O lint global terminou sem erros e com 9 avisos preexistentes em telas; isso não equivale a ausência de pendências funcionais da SPEC.

Durante a revisão, o Pipeline passou a usar uma referência temporal por requisição, compartilhada com a hidratação, e atualização a cada minuto no cliente. Indicadores de tempo/SLA e filtro de perdidos usam o mesmo instante, sem consultar o relógio a cada renderização. Foram removidos import não utilizado e avisos de aspas no Pipeline/Home. TypeScript e lint dos arquivos alterados passaram; permanecem os avisos de efeitos nas telas Financeiro/Sidebar. A suíte completa antecedeu estas alterações locais de apresentação; não comprova validação interativa do relógio. O escopo funcional restante continua registrado nas SPECs e incrementos anteriores.
## Incremento 70 — Apuração dos dias de compensação restantes, 11/09/2026

Núcleo de Q83 identifica dias indisponíveis do período original e exclui dias recompostos, liquidados financeiramente ou já contemplados pelo proporcional. Recusa duplicidade, destinações conflitantes e datas fora da origem. Para a regra explicitamente conferida de dias reais do período original, apura o ajuste com valor original informado/conferido e arredondamento único, preservando memória e referências. Não usa preço atual nem cobertura ampliada.

Validação: 4 testes unitários passaram, incluindo três dias devidos/um recomposto, exclusão de ajuste anterior, conflito de destinação e diferença de arredondamento diário versus conjunto. TypeScript e ESLint passaram. Este núcleo ainda precisa dos registros persistidos de indisponibilidade/compensação e integração ao acerto; não cria crédito nem registra liquidação. Recebimentos, proporcional e aprovação independente deverão ser confrontados na execução completa.
## Incremento 71 — Persistência dos direitos de compensação, 11/09/2026

Schema e migrations adicionam proposta de compensação por matrícula/cobrança, condições de origem, dias propostos, preparação e decisão independente. Dias de direito somente podem ser registrados para origem aprovada, dentro da cobertura e da lista proposta. Unicidade por matrícula/dia impede duplicação entre origens. Destinação exige referência/data e incremento de versão; dia já recomposto/liquidado não pode ser reutilizado, trocado de origem ou apagado. Compensação decidida permanece imutável. Correções futuras deverão preservar esses registros, não editar o saldo diretamente.

Validação: migrations aplicadas no banco de testes, 2 testes de integração com casos de vínculo cruzado, autoaprovação, origem pendente, duplicação, destinação incompleta, reuso e alteração de origem decidida passaram. TypeScript e ESLint passaram. Ainda faltam as ações de preparação/aprovação, recomposição de cobertura, interface e integração ao encerramento. A existência das tabelas não significa que Q70/Q83 estejam operacionais.
## Incremento 72 — Preparação e decisão dos dias de compensação, 11/09/2026

Financeiro/Administração prepara proposta de dias sem oferta dentro de uma mensalidade conferida, com motivo, evidência das condições e documento confirmado de origem. O servidor registra cobertura, valor e versão da cobrança; exige chave idempotente e recusa proposta pendente para a mesma cobrança. Período inteiro sem oferta é encaminhado ao tratamento próprio de Q67; não se converte automaticamente em compensação parcial.

Outra pessoa da Administração ou Financeiro com a permissão `financeiro.aprovar_acertos` decide. Aprovação revalida cobrança/documento/valor/cobertura e cria os dias de direito uma vez; rejeição não cria dias. A nova capacidade está disponível no catálogo de permissões administrativas. Os direitos criados ainda aguardam recomposição ou liquidação: esta decisão não aprova uma extensão de cobertura, muda vencimentos, quita cobrança ou executa Q83. A proposta de recomposição com seus impactos continua pendente.

Validação: 3 testes de integração passaram, incluindo ações públicas, papel/capacidade, autoaprovação, repetição, origem alterada e preservação da cobrança. Migrations aplicadas somente no banco de testes; TypeScript e ESLint passaram. Interface e integração ao acerto ainda pendentes.
## Incremento 73 — Compensações na origem do rascunho, 11/09/2026

A consulta financeira do encerramento carrega propostas de compensação e seus dias, com período/valor/documento de origem, decisão, destinação e versão de cada dia. A preparação exibe essas informações e o rascunho as conserva no snapshot. A conferência de atualidade passa a detectar nova compensação ou alteração da destinação dos dias, impedindo considerar silenciosamente atual uma análise anterior.

Validação: 7 testes de integração e 6 unitários passaram, incluindo rascunho atual antes da recomposição de um dia e desatualizado depois dela. TypeScript e ESLint passaram. O valor de Q83 ainda não é aplicado ao total do acerto; a ligação seguinte deverá confrontar proporcional, compensações e recebimentos. A nova apresentação de compensações ainda não foi validada no navegador.
## Incremento 74 — Leitura das compensações preservadas no rascunho, 11/09/2026

O resumo financeiro apresenta as compensações do snapshot da própria versão, incluindo origem, estado e destinação dos dias. A consulta atual usa o mesmo componente de apresentação. Propostas pendentes/rejeitadas são identificadas como sem concessão de dias; versões antigas sem esse registro recebem indicação explícita, sem preencher o histórico com dados atuais. A interface informa que o valor das compensações ainda não integra o total mensal.

Validação: TypeScript e ESLint dos dois componentes passaram. Alteração de apresentação, sem novas operações financeiras ou mudança de permissões. Não foi realizada validação desta apresentação no navegador. A integração monetária e a aprovação/efetivação completa do acerto continuam pendentes.

## Incremento 75 — Apuração de compensação no rascunho financeiro, 11/09/2026

A prévia e o snapshot agora incluem a apuração monetária das compensações aprovadas por cobrança original. Agrupam os dias da mesma cobrança antes do arredondamento e excluem dias recompostos, liquidados ou já contemplados pelo proporcional. Apresentam serviço após ajuste, saldo devido e crédito apurado, preservando o cálculo mensal original para comparação. Propostas pendentes, dias duplicados, cobertura/valor divergentes ou ajuste superior ao serviço apurado exigem conciliação. Não há aplicação de crédito ou destinação dos dias nesta etapa.

Validação: 11 testes unitários e 7 de integração passaram; TypeScript e ESLint passaram. Inclui exclusão de dias após o último dia coberto, recomposição, liquidação anterior, duplicação e cobertura divergente. A interface não foi validada no navegador neste incremento. O acerto completo ainda precisa consolidar demais ajustes, créditos anteriores e aprovações antes de efetivar o encerramento; os valores por cobrança não podem ser somados novamente aos saldos anteriores.

## Incremento 76 — Subtotal mensal após compensações, 11/09/2026

A apuração agora consolida as parcelas após substituir os valores das cobranças com compensação. Mantém multa contratual, dívida e crédito separados, sem usar o crédito de uma cobrança para pagar outra. Havendo pendência nas compensações, não apresenta subtotal consolidado. Uma exceção de multa proposta mostra também o saldo após compensações, ainda sujeito à aprovação independente. O snapshot conserva esses resultados e a interface distingue o cálculo original do subtotal ajustado.

Validação: 11 testes unitários e 7 de integração passaram, além de TypeScript e ESLint. Caso com duas cobranças verificou serviço de 586,67, saldo de 480,00 e crédito separado de 213,33; proposta de multa de 35,00 levou o saldo alternativo a 435,00 sem consumir crédito. Corrigida a codificação UTF-8 de textos da interface. Não houve validação no navegador neste incremento. Este subtotal ainda não inclui o conjunto completo de taxas, horas e ajustes do encerramento, nem autoriza sua efetivação.

## Incremento 77 — Interface de propostas de compensação, 11/09/2026

Financeiro/Administração acessa as compensações na página de movimentações do aluno, independentemente de existir pedido de encerramento. A equipe seleciona matrícula e mensalidade, adiciona dias da cobertura e registra motivo/evidência. Propostas pendentes mostram os dias solicitados e permitem decisão por outra pessoa com permissão, com justificativa. O servidor continua revalidando papéis, capacidade, independência, versão da cobrança e origem contratual. Repetição após resposta incerta conserva a chave da proposta; falha de atualização após sucesso é apresentada como falha de consulta, sem sugerir que o registro não ocorreu.

Validação: TypeScript e ESLint passaram; 3 testes de integração das ações utilizadas passaram. A interface ainda não foi validada no navegador. Aprovar dias reconhece o direito de compensação; recomposição da cobertura e efetivação financeira continuam pendentes nos fluxos correspondentes.

## Incremento 78 — Validação da compensação no navegador, 11/09/2026

Fluxo executado pela interface local com dois usuários administrativos fictícios distintos: operador escolheu contrato/cobrança, adicionou 10/09/2099, informou motivo/evidência e enviou a proposta. A interface mostrou a pendência e impediu a decisão pelo preparador. Após sair e entrar como aprovador, a decisão independente registrou um dia devido. O campo de data nativo foi preenchido por segmentos do teclado; a tentativa de preenchimento automatizado incompleta foi recusada antes do envio.

O verificador `scripts/validacao/compensacao-navegador.mjs` confirmou seis condições no banco descartável: proposta única, pessoas distintas, dia correto sem destinação, origem correta, cobrança sem alteração/recebimento e ambos os contratos ativos. Evidência em `docs/validacao-compensacao-navegador-2026-09-11.json`. Este ensaio não comprova rejeição, perfis Financeiro/Secretaria no navegador, recomposição de cobertura ou liquidação financeira. O contrato confirmado foi criado como fixture, sem assinatura externa real.

## Incremento 79 — Conferência da proposta de recomposição, 11/09/2026

Núcleo e ação de prévia financeira conferem dias de direitos aprovados da matrícula contra os períodos atuais obtidos no banco. A proposta identifica retorno da oferta, início da compensação e coberturas propostas de todas as mensalidades vigentes. Impede direitos repetidos/utilizados, vínculos cruzados, omissão de períodos e sobreposição entre cobertura cobrada e dias compensados. Preserva valor, vencimento e duração dos períodos reprogramados, com correspondência entre cada direito e seu dia de compensação proposto. Não altera histórico anterior ao retorno; casos que exigem rever período já iniciado continuam em conferência específica.

Validação: 4 testes unitários e 3 de integração passaram; TypeScript e ESLint passaram. Ação usa transação de leitura consistente, não confia em valores/direitos enviados pelo cliente e não efetiva alterações. Persistência da proposta, aprovação, aplicação, interface e tratamento da referência contratual para geração dos períodos posteriores ainda precisam ser implementados. Esta prévia não comprova que Q70 está concluída.

## Incremento 80 — Rascunhos persistidos de recomposição, 11/09/2026

Financeiro/Administração pode salvar e consultar versões do rascunho por matrícula. O servidor recalcula com direitos e cobranças bloqueados, conserva entrada/origem/resultado e usa chave idempotente por preparador. Exige a versão anterior atual para criar revisão. O banco impede editar ou excluir o histórico; uma revisão cria novo registro. Nenhum direito é consumido e nenhuma cobertura é alterada no salvamento.

Validação: migration aplicada somente no banco local de testes, cliente Prisma regenerado, TypeScript e ESLint passaram. Os 3 testes de integração incluem envio concorrente com a mesma chave, rejeição de conteúdo diferente na mesma chave, versão desatualizada, revisão preservando snapshot anterior e proibição de atualização/exclusão. A autenticação é simulada no teste, com verificação dos papéis reais da fixture; a aplicação mantém sua autenticação normal. Faltam aprovação/execução, conferência de atualidade antes dessas etapas e interface do rascunho.

## Incremento 81 — Atualidade do rascunho de recomposição, 11/09/2026

A conferência compara a versão salva com contrato, cobranças e direitos atuais numa transação de leitura consistente. Detecta versão posterior e entrada incompatível; mudanças ou impedimentos retornam motivos de desatualização sem alterar o histórico. Novos snapshots incluem confirmação/documento e referência de cobertura do contrato. O salvamento bloqueia também o documento para leitura; contrato arquivado ou sem confirmação impede nova prévia. Snapshots antigos sem esses dados não são preenchidos retroativamente.

Validação: os 3 testes de integração passaram com casos de versão atual, contrato arquivado, vencimento alterado, aluno incompatível e versão superada. TypeScript e ESLint passaram. Este diagnóstico não autoriza aplicação futura: a decisão/aplicação ainda deverá repetir as verificações sob bloqueio. Interface e aprovação/execução permanecem pendentes.

## Incremento 82 — Decisão independente da recomposição, 11/09/2026

Ação registra aprovação/rejeição com pessoa, motivo e data, separada do rascunho imutável. Exige outra pessoa da Administração ou Financeiro com `financeiro.aprovar_acertos`. Aprovação revalida a última versão contra contrato, cobranças e direitos bloqueados; rejeição preserva o documento analisado sem aplicar sua cobertura. Repetição exata recupera a decisão existente; mudar uma decisão exige novo fluxo, não sobrescrita. A consulta do rascunho inclui a decisão e sua autoria.

Validação: migration aplicada no banco de testes; TypeScript, ESLint e 3 testes de integração passaram. Casos incluem autoaprovação, capacidade ausente, versão antiga, origem alterada, repetição e imutabilidade. Esta entrega registra a decisão, mas ainda não executa a recomposição. A aplicação com revalidação, geração posterior de cobertura e interface continuam pendentes; a aprovação não pode ser apresentada como cobertura já compensada.

## Incremento 83 — Aplicação da programação de cobertura, 11/09/2026

A ação aplica uma decisão aprovada após revalidar versão, origem e direitos sob bloqueio. Reprograma as coberturas explicitamente alteradas, preservando valores/vencimentos, e registra uma data de cobertura por direito em operação única. A repetição recupera a aplicação existente. Direitos programados ficam pendentes até cumprimento: programar data futura não equivale a compensação recebida pelo aluno. Novas propostas não podem reservar novamente direitos já programados; o contexto do encerramento inclui a programação para detectar mudança nas origens.

Validação: migration no banco de testes, TypeScript e ESLint passaram. Os 3 testes de integração incluem aplicação de decisão, repetição sem duplicidade, aluno incompatível e preservação dos direitos pendentes. Esse caso de integração programa dias sem deslocar cobrança futura; o deslocamento tem conferência unitária e ainda precisa de ensaio integrado específico. Continuam pendentes confirmação do cumprimento, cancelamento/revisão de programação, integração com pausa/encerramento e geração de períodos seguintes, além da interface. Não considerar Q70 concluída.

## Incremento 84 — Deslocamento de cobrança validado e programação visível, 11/09/2026

O teste integrado agora cobre o deslocamento de uma mensalidade futura após dois dias de compensação: 01/10–31/10 passa a 03/10–02/11, com incremento único da versão, valor e vencimento preservados. A cobrança do outro contrato fica integralmente preservada e nenhum recebimento é criado. Alterar o valor após aprovação recusa a aplicação antes de gravar programação ou deslocar cobertura; repetição após sucesso não desloca novamente.

Os 3 testes de integração passaram, além de TypeScript e ESLint. A apresentação das compensações agora mostra a data programada e distingue o cumprimento ainda pendente. Esta alteração visual não foi validada no navegador. Permanecem as pendências de cumprimento, revisão/cancelamento e integração com os demais fluxos registradas no incremento anterior.

## Incremento 85 — Interface da recomposição, 11/09/2026

O painel de compensações inclui seleção dos direitos ainda não programados, retorno da oferta, início da compensação e revisão das coberturas de todas as mensalidades vigentes. A equipe confere a prévia e salva uma versão; a consulta apresenta o resumo, autoria, decisão e aplicação. Outra pessoa autorizada pode decidir. O botão de aplicação revalida no servidor e a consulta identifica a programação já aplicada, sem confundi-la com cumprimento. Valores e vencimentos são exibidos para revisão, sem edição neste fluxo.

Validação: TypeScript e ESLint passaram; os 3 testes de integração das ações passaram. A nova interface ainda precisa de validação interativa no navegador. Permanecem pendentes cumprimento, revisão/cancelamento e integração com pausa, encerramento e geração posterior de cobranças.

## Incremento 86 — Regressão completa após recomposição, 11/09/2026

Suítes completas executadas sobre o estado posterior ao incremento 85: 642 testes unitários em 62 arquivos e 453 testes de integração em 41 arquivos passaram (integração: 142,56 segundos). `next build` concluiu compilação, TypeScript e geração das 34 páginas estáticas previstas. ESLint terminou com zero erros e três avisos preexistentes de estado em efeitos, nas telas Financeiro e Sidebar. Atualizado o relatório consolidado para distinguir implementação atual das notas históricas do início do B01.

Esta regressão não encerra o objetivo integral nem substitui validação dos fluxos ausentes. A interface de recomposição continua sem ensaio no navegador; cumprimento/cancelamento e integração com os demais ciclos contratuais estão pendentes, assim como os demais módulos previstos nas SPECs.

## Incremento 87 — Vínculo do contrato e erros de conferência, 11/09/2026

Corrigida lacuna na consulta de recomposição: o documento confirmado precisa pertencer à matrícula ou ao lead correspondente, além de ser contrato disponível. Não basta existir um documento de categoria CONTRATO, mesmo que seja de outro serviço da mesma pessoa. O vínculo passa a compor a origem preservada do snapshot. Erros de conferência da cobertura são retornados como regras de negócio, permitindo à interface explicar sobreposição em vez de apresentar falha inesperada.

Validação: 4 testes unitários, 3 de integração e ESLint passaram; TypeScript passou após a correção de vínculo. A integração tenta usar documento de outro contrato e verifica recusa da prévia/desatualização do rascunho; também verifica a mensagem de sobreposição pela ação pública. Não representa nova regressão completa ou validação interativa da tela.

## Incremento 88 — Conflito entre programações distintas, 11/09/2026

Corrigida lacuna na recomposição: a proposta passa a conferir também as datas de compensação já programadas para a matrícula, e não apenas seus próprios períodos. Recusa novo direito na mesma data e cobertura cobrada que passe a ocupar um dia previamente reservado para compensação. A validação integra a consulta reutilizada no salvamento, aprovação e aplicação, mantendo o bloqueio da matrícula nas mutações.

Validação: 3 testes de integração passaram com um direito adicional, recusa de programação duplicada, aceitação em data livre e recusa de mensalidade sobre programação existente. TypeScript e ESLint passaram. Não altera ou cancela programações anteriores; esses fluxos continuam pendentes.

## Incremento 89 — Histórico e correspondência da programação no banco, 11/09/2026

Migration impede edição/exclusão direta da aplicação e das datas programadas. A criação da aplicação exige decisão aprovada. Cada programação deve corresponder ao direito e à data exatos preservados na versão aprovada; não pode acrescentar um novo direito apenas por pertencer à mesma matrícula. Revisão/cancelamento deverão usar registros próprios, preservando esse histórico.

Validação: migration aplicada somente no banco de testes. Os 3 testes de integração passaram, incluindo alteração/exclusão, direito fora da decisão, data divergente e tentativa de aplicar decisão rejeitada. TypeScript e ESLint passaram. Os fluxos de correção/cancelamento e cumprimento ainda não estão implementados.

## Incremento 90 — Recomposição validada no navegador, 11/09/2026

Executados pela interface: seleção de dois direitos, conferência da cobertura, salvamento, consulta de atualidade, saída/entrada como outra pessoa, aprovação e aplicação. Fixture com contratos/compensações previamente preparados no banco local. A tela impediu autoaprovação e distinguiu decisão de aplicação. O verificador `scripts/validacao/recomposicao-navegador.mjs` confirmou oito condições: versão única, aprovação independente, aplicação, dois dias programados, cobertura deslocada para 03/10–02/11/2099, valor/vencimento/recebimento preservados, direitos ainda pendentes e ambos os contratos ativos. Evidência em `docs/validacao-recomposicao-navegador-2026-09-11.json`.

Identificada apresentação desatualizada após aplicar: adicionado recarregamento do contexto e reinicialização do formulário quando a cobertura muda. Esse ajuste posterior passou em TypeScript/ESLint, mas a sequência completa não foi repetida depois dele. O ensaio usa dois administradores fictícios; não comprova todos os perfis, rejeição, cancelamento, cumprimento ou integrações externas.

## Incremento 91 — Preparação da conferência de cumprimento, 11/09/2026

Adicionado registro de evidência/motivo por dia programado, preparado por Financeiro/Administração para decisão posterior independente. A ação confere aluno/matrícula, direito pendente, fuso institucional e término do dia civil de cobertura. Preserva a programação e versão do direito, recusa segunda conferência pendente e trata repetição da chave sem duplicação. Preparar não confirma cumprimento e não baixa direitos.

Validação: migration no banco de testes, TypeScript e ESLint passaram. Os 3 testes de integração incluem o limite da meia-noite no fuso da escola, repetição idempotente, conteúdo divergente e preservação dos direitos. Ainda faltam decisão, conferência da elegibilidade histórica/oferta e interface; evidência registrada não significa que a cobertura já foi validada.

## Incremento 92 — Decisão independente de cumprimento, 11/09/2026

Implementada ação de aprovação/rejeição por outra pessoa da Administração ou Financeiro com permissão `financeiro.aprovar_acertos`. Aprovar exige confirmação explícita da conferência da evidência de oferta, direito ainda pendente e na versão registrada, programação/origem compatíveis, fuso preservado e dia institucional encerrado. O histórico contratual deve comprovar matrícula ativa no início e no fim desse dia; histórico insuficiente permanece em conferência. A prova de oferta é conferida pelo decisor, não deduzida do calendário.

A aprovação registra decisão, evento e destinação RECOMPOSTO na mesma transação, incrementando a versão do direito sem movimentar dinheiro. Rejeitar conserva o direito pendente e permite nova preparação. Repetição da mesma decisão não duplica efeitos. Migration preserva evidência/origem e impede edição ou exclusão de decisões concluídas.

Validação: migration aplicada somente no banco local de testes; TypeScript e ESLint passaram; os 3 testes de integração do fluxo passaram, incluindo autoaprovação, permissão ausente, evidência não confirmada, outro aluno, histórico insuficiente, rejeição, nova preparação, alteração de fuso, aprovação idempotente e preservação dos recebimentos. Ainda faltam interface de cumprimento, tratamento de revisão/cancelamento e histórico de encerramentos suficiente para conferir esses casos. Este incremento não conclui B01 nem a SPEC completa.

## Incremento 93 — Interface e consulta de cumprimento, 11/09/2026

Adicionado painel de cumprimento na movimentação do aluno, dentro da matrícula selecionada. Consulta restrita ao Financeiro/Administração apresenta dias programados, origem, estado e histórico das conferências com evidência, autoria e decisão. É possível preparar conferência, aprovar com confirmação explícita da evidência ou rejeitar com justificativa. A tela não oferece autoaprovação nem decisão a quem não possui permissão; as mesmas restrições permanecem no servidor. Atualização após decisão recarrega direitos e contexto financeiro. Mensagens distinguem erro de operação de falha de recarregamento após gravação.

Validação: os 3 testes de integração passaram, agora incluindo projeção do histórico, isolamento entre matrículas e recusa de acesso docente. TypeScript, ESLint dos arquivos alterados e build de produção com 34 páginas passaram. O painel ainda precisa de ensaio no navegador; esses resultados não substituem validação visual e operacional. Revisão/cancelamento das compensações, integração completa com encerramento e demais módulos da SPEC continuam pendentes.

## Incremento 94 — Cumprimento validado pela interface, 11/09/2026

Executada preparação de evidência pelo primeiro usuário, verificado aviso de impedimento de autoaprovação, troca de sessão e aprovação pelo segundo usuário. A interface passou imediatamente a “Cobertura cumprida”, exibiu autoria/justificativa da decisão e atualizou o resumo para zero dias ainda devidos. O script `scripts/validacao/cumprimento-navegador.mjs verificar` confirmou conferência única, aprovação independente, direito RECOMPOSTO com versão incrementada e referência da conferência, sem recebimento financeiro. Evidência persistida em `docs/validacao-cumprimento-navegador-2026-09-11.json`.

Ensaio local com dados fictícios e programação prévia inserida pela fixture; não valida a criação dessa programação, produção ou todos os perfis pelo navegador. Rejeição e acesso docente foram cobertos pelos testes de integração do incremento 93. Servidor local encerrado após a validação.

## Incremento 95 — Conferência das demais cobranças no encerramento, 11/09/2026

Prévia e rascunho passam a aceitar conferência explícita de todas as cobranças emitidas que não sejam mensalidades: valor devido proposto, motivo e evidência contratual. O formulário coleta os campos e apresenta memória por cobrança e subtotal próprio no resultado e na versão salva. Cobranças sem conferência produzem pendência, nunca subtotal presumido. Validação recusa omissão, duplicação, versão desatualizada, moeda divergente e conciliação pendente. Recebimentos originais permanecem preservados; crédito é apurado separadamente do saldo devido, sem utilização ou devolução automática. A ordem das cobranças é normalizada no salvamento para idempotência.

Isso amplia os componentes conferidos, mas não autoriza aplicação ou aprovação final do acerto. Horas antecipadas ainda não utilizadas, crédito preexistente e demais efeitos não representados pelas cobranças emitidas continuam exigindo implementação própria. Valores propostos não mudam condições contratuais sem aprovação.

Validação: 12 testes unitários dirigidos (incluindo 5 novos), 4 testes de integração do pedido/rascunho, ESLint e build de produção passaram. TypeScript passou novamente após a normalização da ordem. Não foi realizado ensaio no navegador dos novos campos. Rascunhos anteriores permanecem preservados e exibem ausência da nova conferência.

## Incremento 96 — Integração das demais cobranças validada, 11/09/2026

Acrescentado cenário de integração com taxa paga e material pendente: omissão de cobrança é recusada; rascunho conserva crédito de 60 separado de dívida de 80; repetir a mesma chave com ordem inversa recupera a mesma versão. Pagamento posterior do material invalida a versão anterior mesmo sem incremento de versão da cobrança; reconferência permite nova versão; alteração posterior do valor/versão também a invalida. Taxa e recebimento original permanecem idênticos e matrícula continua ativa.

Os 5 testes de integração do arquivo passaram. TypeScript e ESLint passaram na primeira execução, e o cenário ampliado de pagamento posterior passou na execução seguinte. Esta validação não representa aprovação ou execução do acerto integral, nem ensaio dos novos campos no navegador.

## Incremento 97 — Cálculo de horas antecipadas no encerramento, 11/09/2026

Implementado núcleo de apuração Q97 por compra original: minutos adquiridos, valor/desconto originais, pagamento alocado, consumos documentados e liquidações anteriores. Preserva frações de hora de 60 minutos, desconta realização/falta/cancelamento tardio legitimamente cobrados e mantém multa separada. A apuração financeira acumulada é arredondada em duas casas, descontando créditos anteriores para preservar o valor total original. Matrícula/moeda incompatíveis, duplicatas, excesso de consumo, pagamento não conciliado e saldo incompatível impedem cálculo.

Validação: 6 testes unitários, TypeScript e ESLint passaram. Este é um núcleo de cálculo ainda não conectado à persistência de compras/consumos, à interface ou ao acerto completo. Referência/evidência recebidas pelo núcleo precisam vir de registros conferidos no futuro fluxo do servidor. Não cria crédito, não devolve dinheiro e não efetiva encerramento. Aquisições parcialmente pagas exigem conciliação própria; este núcleo trata saldo antecipado integralmente alocado à compra.

## Incremento 98 — Persistência de compra de horas já pagas, 11/09/2026

Adicionado registro imutável de compra de horas vinculado à matrícula, documento contratual confirmado e cobrança HORA_PARTICULAR. A ação financeira confere aluno, versão, moeda, pagamento integral, recebimentos detalhados, inexistência de informe pendente e vínculo único da cobrança. Valores e descontos são carregados do banco; a tela não fornece o valor pago. Snapshot preserva referências dos recebimentos e documento. Idempotência e bloqueios transacionais impedem duplicar a compra; registrar não cria outro pagamento. Evidência identifica a quantidade contratada.

Migration aplicada ao banco de testes e Prisma Client atualizado. Passaram 4 testes de integração (incluindo chamadas concorrentes, repetição, mutação proibida, origem incompatível, recebimento divergente e permissões), TypeScript e ESLint. Ainda faltam interface, registro de consumos/reservas/liquidações, validade/pausa e conexão ao encerramento. Este registro trata compra identificada integralmente paga; crédito sem destinação e distribuição de um recebimento entre serviços conservam seus próprios requisitos e continuam pendentes.

## Incremento 99 — Interface de compras de horas, 11/09/2026

Adicionados consulta financeira por matrícula e painel em movimentações. A equipe escolhe cobrança HORA_PARTICULAR paga ainda sem compra registrada, informa minutos contratados/evidência e registra pela ação do incremento 98. A consulta apresenta valores originais, desconto, pagamento alocado e autoria; a cobrança sai da seleção após o registro. Quantidade comprada é explicitamente distinta de saldo disponível; consumos/reservas ainda não estão implementados. Trocar matrícula reinicia o estado local do painel, preservando o isolamento da seleção.

Validação: 4 testes de integração passaram, incluindo projeção antes/depois da compra, aluno incompatível e bloqueio de consulta docente. TypeScript e ESLint passaram. Build de produção passou com 34 páginas. Falta ensaio operacional deste painel no navegador e implementação dos demais componentes do controle de horas e encerramento.

## Incremento 100 — Regressão integral e alinhamento do schema, 11/09/2026

Regressão completa: 653 testes unitários em 64 arquivos e 458 testes de integração em 42 arquivos passaram. ESLint terminou com zero erros e três avisos já existentes em FinanceiroPainel/Sidebar. TypeScript passou após regeneração bem-sucedida do Prisma Client. Último build de produção é o do incremento 99, também aprovado.

Comparação read-only entre banco de testes e schema identificou divergência de ON UPDATE em três referências de CompraHorasAntecipadas e default já existente de IntencaoMensagem.atualizadoEm. Schema alinhado às migrations existentes: referências NoAction preservadas e default(now()) declarado juntamente com @updatedAt. Nova comparação retornou migration vazia. Nenhum dado foi alterado por esse alinhamento. A primeira regeneração durante os testes encontrou bloqueio da DLL no Windows; repetida com sucesso depois que a suíte terminou.

Esses resultados comprovam a regressão do código existente, não o atendimento de toda a SPEC. Consumos/reservas/validade das horas, encerramento integral, calendário, avaliações e integrações ainda permanecem incompletos.

## Incremento 101 — Regras de reserva e consumo de horas compradas, 11/09/2026

Implementado núcleo de saldo por compra/matrícula: reserva compromete minutos sem consumir; realização, falta cobrável e cancelamento tardio consomem; cancelamento no prazo ou pela escola libera. Recusa excesso de saldo, reserva duplicada e segundo compromisso vigente do mesmo encontro. Desfecho concluído não pode ser trocado; repetição do mesmo desfecho é idempotente. Histórico de cancelamento permanece ao permitir nova reserva. O cálculo Q97 agora exige informação explícita de minutos reservados e bloqueia a apuração enquanto houver reservas pendentes.

Validação: 13 testes dirigidos, TypeScript e ESLint passaram. As regras ainda não persistem reservas nem conferem agenda, antecedência ou autorização por si sós. A integração deve carregar o encontro contratado e suas condições, aplicar a transição atomicamente e preservar a separação da cota de reposição. Nenhum agendamento, consumo ou crédito real foi criado por este incremento.

## Incremento 102 — Classificação da ocorrência de particular, 11/09/2026

Adicionada classificação financeira de ocorrência explícita: realizada/falta só após o fim do encontro; cancelamento do aluno usa comunicação e antecedência configurada, incluindo o instante exato do limite; cancelamento da escola libera a reserva. Datas exigem offset e são comparadas como instantes. O núcleo não presume prazo, não gera falta pelo relógio e não conclui diário. Integração com a regra de saldo exige matrícula e encontro correspondentes e preserva os minutos contratados da reserva.

Passaram 10 testes dirigidos, TypeScript após ajuste de tipagem do desfecho e ESLint. Ainda falta carregar as condições e ocorrências do banco, conferir as permissões e persistir a decisão/transição. Classificação financeira permanece separada de presença, gravação e conclusão acadêmica.

## Incremento 103 — Encontro de agenda em rascunho, 11/09/2026

Adicionada base persistente de encontro com vínculo exclusivo à turma coletiva ou matrícula de particular, início/fim como instantes e fuso de origem. Preparação pela Secretaria/Gestão Pedagógica/Administração é idempotente e registra evento na mesma transação. Professor é opcional no rascunho; se informado, precisa estar ativo com papel docente. O banco exige intervalo positivo, um único tipo de vínculo e professor para estados publicados. Um encontro cruzando meia-noite mantém as duas datas corretamente.

Migration aplicada somente ao banco de testes, Prisma Client regenerado. Passaram 2 testes de integração, ESLint e TypeScript após inclusão do novo agregado no catálogo tipado. Comparação banco/schema retornou migration vazia. Esta base ainda não publica encontros, confere conflitos/calendário, reserva horas, cria diário ou cobra. Esses fluxos e a interface permanecem em implementação; rascunho não confirma disponibilidade nem contratação da oferta particular.

## Incremento 104 — Consulta de sobreposição e intervalo letivo, 11/09/2026

Adicionada consulta de conflitos por encontro para Secretaria/Gestão Pedagógica/Administração. Considera intervalos reais dos encontros previstos/ministrados com mesmo professor, turma ou matrícula, excluindo o próprio encontro, rascunhos e cancelados. Horários consecutivos não conflitam. Professor ausente/inativo gera pendência. O resultado não autoriza publicação e identifica verificações ainda faltantes.

Núcleo de calendário identifica períodos não letivos que interceptam qualquer parte do encontro no fuso institucional, incluindo passagem de meia-noite. Fim exatamente à meia-noite não ocupa o dia seguinte. Ainda depende de carregar os períodos publicados do calendário único; não cria calendários por país.

Validação: 4 testes unitários e 3 de integração, TypeScript e ESLint passaram. Publicação transacional, calendário persistente/aprovações, indisponibilidade docente, interface e demais validações de ingresso permanecem pendentes.

## Incremento 105 — Versões preservadas do calendário escolar, 11/09/2026

Adicionada persistência de propostas do calendário único: feriados, recessos e férias com datas civis, identificador, nome e fuso institucional capturado da configuração. Secretaria/Gestão Pedagógica/Administração prepara; versão global é incrementada sob bloqueio transacional, com idempotência independente da ordem dos períodos. Recusa versão anterior desatualizada, identificador duplicado e período invertido. O banco impede editar/apagar versões. Salvar não publica, não remarca encontros e não modifica dias letivos vigentes.

Migration aplicada ao banco de testes e Prisma Client regenerado. Passaram 4 testes de integração da agenda, TypeScript e ESLint; comparação banco/schema sem divergências. Aprovação, apuração conjunta de impactos, publicação e interface do calendário ainda faltam. Uma proposta sem períodos pode representar calendário sem interrupções, mas também exige o futuro fluxo de aprovação.

## Incremento 106 — Decisão independente do calendário inicial, 11/09/2026

Adicionada decisão imutável por outra pessoa da Gestão Pedagógica/Administração e consulta da versão aprovada vigente. Aprovação exige versão mais recente e fuso institucional ainda correspondente à proposta; rejeição preserva a versão vigente. Repetição da decisão não duplica efeitos. Banco impede autoaprovação e alteração/exclusão da decisão. Repetir a preparação após aprovação informa o estado publicado atualizado.

Enquanto a revisão conjunta de impactos não estiver implementada, a ação bloqueia aprovação quando existe qualquer encontro PREVISTO; não é ainda o fluxo completo Q20/Q21. O calendário inicial sem encontros publicados pode ser aprovado e consultado. Publicação futura de encontros deverá usar o mesmo bloqueio transacional institucional antes de conferir/aplicar datas.

Migration aplicada no banco de testes, Prisma regenerado; 5 testes de integração, TypeScript e ESLint passaram. A revisão/aplicação de agendas afetadas e interface continuam pendentes.

## Incremento 107 — Prévia dos impactos do calendário, 11/09/2026

Consulta compara interseções dos encontros previstos/ministrados com a versão vigente e a proposta, usando o fuso de cada versão. Identifica períodos antes/depois, dias liberados pela proposta e encontros passados que devem ser preservados. Cancelados e rascunhos ficam fora do conjunto publicado. Retorna todas as agendas publicadas para revisão, pois remoção de recesso pode antecipar encontros mesmo sem colisão direta. Não remarca nem aprova; revisão completa permanece explicitamente pendente.

Os 6 testes de integração da agenda passaram, incluindo encontro que atravessa meia-noite, preservação de aula passada pendente e ausência de mutações na prévia. Corrigida a projeção dos períodos para o núcleo de interseção durante a validação. TypeScript e ESLint passaram. Faltam geração das datas sugeridas, ajustes da equipe e aplicação conjunta validada.

## Incremento 108 — Geração da grade com fuso e dias não letivos, 11/09/2026

Implementado núcleo que gera quantidade exata de encontros a partir de data mínima, dias semanais, horário local e duração. Pula interseções com períodos não letivos no fuso institucional; distingue data informada, primeira aula e previsão de término. Mantém horário local nas mudanças de offset e permite término no dia seguinte. Horários locais ambíguos/inexistentes exigem revisão em vez de escolha silenciosa. A geração é prévia e não publica encontros.

Passaram 5 testes unitários, TypeScript e ESLint, cobrindo próximo dia da grade, feriado/recesso, meia-noite, mudança de offset e lacuna/dobra de horário de verão. Ainda falta carregar quantidade/regras versionadas da modalidade e turma, persistir a grade, conferir recursos e integrar sugestões à revisão conjunta do calendário. Os limites técnicos do núcleo não substituem parâmetros contratuais.

## Incremento 109 — Prévia inicial ligada à turma e catálogo, 11/09/2026

Consulta autenticada gera grade inicial da turma PLANEJADA usando quantidade de aulas, duração e frequência da modalidade no banco, data/dias/horário da turma e calendário institucional aprovado. Fuso de origem é proposto explicitamente, pois a turma legada ainda não possui esse parâmetro persistido. Não estima quantidade por meses. Histórico de diário ou encontro publicado impede tratar a turma como planejamento inicial. Retorna origens para futura conferência da versão, sem persistir/publicar encontros.

Passaram 7 testes de integração da agenda, TypeScript e ESLint. O novo cenário comprova aplicação de feriado, quantidade/duração do catálogo, bloqueio sem calendário ou quantidade e recusa de turma em andamento. Faltam persistência/versionamento da grade, exceções por turma, conferência docente e publicação aprovada.


## Incremento 110 — Proposta persistida da grade inicial, 11/09/2026

A preparação grava versão imutável da grade, autor, motivo, fuso de origem e snapshot dos parâmetros da turma/modalidade e do calendário aprovado. Repetição da mesma chave não duplica a proposta; conteúdo diferente na mesma chave ou versão anterior desatualizada é recusado. O banco impede editar ou apagar a proposta. Preparar não publica encontros nem reserva professor ou vagas.

Consulta autenticada compara o snapshot preservado com a geração atual e identifica versão superada ou parâmetros alterados/incompletos. Mesmo uma proposta correspondente não recebe autorização de publicação: aprovação, conflitos e indisponibilidade docente continuam necessários. A futura ação de publicação deve repetir essas verificações dentro de sua transação; consultar não congela disponibilidade.

Validação: 7 testes de integração da agenda e 9 testes unitários de geração/interseção passaram. Cobertura inclui persistência, idempotência, imutabilidade, alteração de quantidade, proposta superada e acesso negado ao professor. TypeScript e ESLint da agenda passaram; comparação do banco de testes com o schema Prisma sem divergências. Interface, decisão/publicação da grade e revisão conjunta dos cronogramas permanecem pendentes. Nenhum ambiente de produção foi alterado.


## Incremento 111 — Conferência docente da grade completa, 11/09/2026

A consulta da proposta correspondente aos parâmetros atuais confere professor ativo com papel docente e sobreposições de todos os encontros gerados com encontros PREVISTOS/MINISTRADOS do professor ou da turma. Inclui particulares vinculadas a matrícula. Retorna os intervalos conflitantes e sua posição na grade; também identifica sobreposição interna. Cancelados e rascunhos não ocupam disponibilidade publicada. Intervalos consecutivos não conflitam, e compromissos anteriores ao início da turma não bloqueiam apenas por repetirem o dia da semana.

Proposta desatualizada não recebe conferência de disponibilidade baseada em uma grade diferente da salva. O resultado continua explicitamente sem confirmação completa: indisponibilidades docentes, reservas de contratação e aprovação/publicação transacional permanecem pendentes. A leitura não reserva recursos nem publica encontros.

Validação: 7 testes de integração da agenda passaram, com novos cenários de conflito no segundo encontro, particular concorrente, cancelamento/rascunho ignorados, horário consecutivo, compromisso de semana anterior e professor desativado. TypeScript e ESLint da agenda passaram. Sem alteração em produção.


## Incremento 112 — Indisponibilidade docente com decisão independente, 11/09/2026

Professor solicita sua indisponibilidade; Secretaria/Gestão/Administração também pode preparar. Período com início/fim explícitos, fuso e motivo é preservado com idempotência. Outra pessoa da Gestão Pedagógica/Administração aprova ou rejeita. Preparador e professor afetado não decidem a própria ausência, inclusive acumulando papéis. Banco preserva solicitações e decisões contra edição/exclusão e impede decisão pela mesma pessoa.

A decisão registra os encontros PREVISTOS afetados naquele momento, sem cancelar, remarcar ou trocar docente. Ausências aprovadas passam a aparecer na conferência de cada encontro e da grade completa; pendentes/rejeitadas não representam bloqueio aprovado. A futura publicação deve usar a mesma trava institucional e conferir essas ausências na transação. Ações públicas de publicação ainda não estão implementadas; este incremento não afirma que todos os agendamentos legados já usam o novo controle.

Migration aplicada somente ao banco de testes. Passaram 7 testes de integração da agenda, TypeScript e ESLint; banco/schema sem divergência. Cenários cobrem pedido próprio, recusa de outro professor, idempotência, autoaprovação com papéis acumulados, ausência pendente versus aprovada, preservação de encontro e imutabilidade. Ainda faltam interface, fila operacional para tratar os encontros afetados e integração transacional da publicação.


## Incremento 113 — Acompanhamento das indisponibilidades, 11/09/2026

Consulta paginada com filtros de situação/professor, escopo próprio para docentes e visão da equipe autorizada. Lista encontros ainda previstos que conflitam com ausências aprovadas, separando essa situação atual dos encontros preservados na decisão. Cancelamento/remarcação/substituição não são executados pela consulta. Permissão de decisão é calculada por pessoa e papéis atuais; a ação continua verificando novamente a autorização.

Tela /academico/indisponibilidades acessível pelo acadêmico apresenta períodos no fuso registrado, motivos, decisões e aulas pendentes. Gestão independente pode aprovar/rejeitar com motivo. Ainda falta o formulário de solicitação, tratamento aprovado das aulas afetadas e validação visual em navegador; a tela não conclui a entrega completa Q39.

Validação: 8 testes de integração da agenda passaram, incluindo isolamento entre professores, negação ao Financeiro, paginação sem repetição e pendência atual versus histórico preservado. TypeScript, ESLint dos arquivos desta frente e build de produção passaram (35 páginas estáticas; nova rota dinâmica incluída). Não houve deploy nem alteração em produção.


## Incremento 114 — Formulário de solicitação docente, 11/09/2026

Tela de indisponibilidades passa a oferecer solicitação com professor, início/fim, fuso e motivo. Professor vê somente a própria opção; equipe autorizada seleciona professores ativos. Servidor revalida escopo e resolve datas locais no fuso explícito, sem usar o fuso do navegador. Intervalos invertidos, datas inválidas e horários ambíguos/inexistentes são recusados. O formulário conserva a chave na repetição dos mesmos dados após resultado incerto e bloqueia edição durante envio.

Validação: 9 testes de integração da agenda passaram, incluindo conversão Costa Rica/UTC atravessando meia-noite, repetição sem duplicação e recusa de horário ambíguo/intervalo invertido. TypeScript e ESLint passaram. A validação visual/interativa no navegador e o fluxo aprovado de solução das aulas afetadas ainda estão pendentes.


## Incremento 115 — Impacto antes da decisão e contraste, 11/09/2026

Solicitações pendentes agora mostram encontros previstos afetados antes da decisão. A consulta distingue prévia para conferência, pendências de ausências aprovadas e histórico da decisão. Rejeição não cria pendências. Testes de integração ampliados comprovaram essas distinções: os 9 cenários da agenda passaram, além de TypeScript e ESLint.

Inspeção autenticada no navegador local confirmou navegação e estado sem professores ativos. Detectado e corrigido contraste do formulário/cartões no tema escuro, substituindo fundo branco pela superfície do tema; nova captura confirmou legibilidade. Envio e aprovação pelo navegador ainda não foram exercitados, assim como a resolução aprovada dos encontros. Somente banco descartável com dados fictícios foi usado.


## Incremento 116 — Fluxo de indisponibilidade validado no navegador, 11/09/2026

Executado envio pela conta fictícia do professor e aprovação por conta distinta de Gestão Pedagógica. Professor visualizou o pedido e a aula afetada sem ação de aprovação. Gestão conferiu impacto, informou motivo e aprovou; tela passou a mostrar ausência aprovada e aula ainda pendente de solução.

Verificação posterior no banco descartável confirmou seis invariantes: pedido único, autor correto, conversão de fuso, aprovação independente, aula preservada e impacto registrado. Evidência em docs/validacao-indisponibilidade-navegador-2026-09-11.json; fixture/verificador em scripts/validacao/indisponibilidade-navegador.mjs. Não houve remarcação, cancelamento ou troca de professor. A resolução aprovada das aulas afetadas e a publicação transacional de agendas continuam pendentes, assim como demais frentes da SPEC.


## Incremento 117 — Proposta de substituição temporária, 11/09/2026

Secretaria/Gestão Pedagógica/Administração prepara seleção explícita de encontros, substituto ativo e motivo. Cada item mantém snapshot do professor, vínculo, intervalo, fuso e situação originais. Banco preserva proposta/itens contra edição e exclusão. Chave idempotente normaliza a ordem da seleção, evita duplicação e recusa conteúdo divergente. Recusa encontro inexistente, repetido, cancelado, já iniciado e substituto já designado.

Preparar não altera professor do encontro, titular da turma, acesso docente ou agenda. Ainda faltam consulta de conflitos/indisponibilidades do substituto, decisão independente, aplicação transacional, atribuição de acesso limitada e interface. Não é a entrega completa Q56.

Migration aplicada no banco de testes. Os 10 testes de integração da agenda passaram, incluindo nova prova de preservação dos encontros e permissões. TypeScript e ESLint passaram; comparação banco/schema sem divergências. Nenhuma mudança em produção.


## Incremento 118 — Conferência da substituição docente, 11/09/2026

Consulta autenticada compara encontros atuais com os snapshots preservados, sinaliza alterações/início/cancelamento e verifica se o substituto continua professor ativo. Detecta sobreposição entre encontros selecionados, compromissos PREVISTOS/MINISTRADOS externos e indisponibilidades aprovadas. Cancelados externos não bloqueiam; consulta não aplica troca ou concede acesso. Retorna dados atuais e originais separadamente para revisão.

Os 10 testes de integração da agenda passaram, ampliados com conflito de particular, cancelamento do compromisso concorrente, ausência aprovada, alteração do encontro e negação ao professor. TypeScript e ESLint passaram após explicitar a tipagem da coleção do teste. Aprovação/aplicação transacional, reservas e atribuição de acesso permanecem pendentes; a futura decisão deve repetir a conferência sob bloqueios de escrita.


## Incremento 119 — Decisão e aplicação da substituição, 11/09/2026

Outra pessoa da Gestão Pedagógica/Administração aprova ou rejeita a proposta. Aprovação revalida snapshots, estado/início dos encontros, professor ativo, conflitos e indisponibilidades sob trava institucional e bloqueios das linhas selecionadas. Aplica o novo professor em todos os encontros na mesma transação da decisão/evento; não altera titular da turma, horário ou matrícula. Falha não aplica parcialmente. Decisão preservada no banco e repetição idempotente; repetição da preparação informa que a proposta já foi aplicada.

Os 11 testes de integração passaram: autoaprovação recusada, conflito posterior bloqueando o conjunto sem decisão parcial, aprovação após solução do conflito, troca integral, repetição sem duplicação e imutabilidade. TypeScript e ESLint passaram; banco/schema sem divergência. Migration aplicada somente ao banco de testes.

Ainda faltam reservas comerciais na conferência, acesso docente limitado integrado ao diário/encontro, interface e notificações. O novo modelo de encontros ainda não substitui toda a agenda legada; não declarar Q56 integralmente entregue ou pronta para produção com base somente neste incremento.


## Incremento 120 — Consulta docente por encontro atribuído, 11/09/2026

Adicionada consulta paginada de encontros publicados com acesso do professor limitado ao professorId vigente de cada encontro; Gestão Pedagógica/Administração acompanha o conjunto. Identificador direto e cursor fora do escopo são recusados. Projeção contém somente horário, fuso, situação, professor e identificação textual da turma, sem dados cadastrais/financeiros. A tela /diario/encontros está ligada ao diário e permite consultar os encontros atribuídos, inclusive substituições aprovadas.

Os 11 testes de integração da agenda passaram, com conferência de acesso negado ao substituto antes da aprovação, concedido depois, perda de acesso à agenda pelo professor anterior e campos restritos. TypeScript e ESLint passaram.

Esta etapa é consulta da agenda. O registro de presença/conteúdo/gravação ainda precisa do vínculo explícito entre AulaDiario e EncontroAgenda e da autorização de escrita por encontro; não foi ampliado o vínculo com a turma para contornar essa ausência. Histórico docente existente permanece separado. Interface da substituição, notificações e integração das reservas continuam pendentes; tela nova ainda sem validação visual no navegador.


## Incremento 121 — Diário vinculado ao encontro, 11/09/2026

AulaDiario recebe vínculo opcional e único com EncontroAgenda, preservando registros legados. Lançamento informado por encontro usa professor designado naquele encontro, turma correspondente, início exato e término já ocorrido; não concede vínculo docente com a turma. Encontro cancelado/ministrado ou de outro professor não permite esse lançamento. Diário existente não pode trocar de encontro. Aula publicada no mesmo início exige identificação do encontro, evitando usar o caminho legado para contornar a atribuição.

Gravar conteúdo/presenças mantém encontro PREVISTO, pois a conclusão ainda exige o fluxo de gravação/exceção. O caminho para particulares sem turma, chamada por encontro, interface de escrita e correções vinculadas ainda precisam de implementação. Registros antigos continuam pelo fluxo legado; não houve associação automática de histórico.

Validação: 23 testes de integração de diário/agenda passaram, TypeScript e ESLint passaram, banco/schema sem divergências. Corrigido cenário de teste de pausa que somava uma hora e podia atravessar para o dia da pausa em execuções próximas da meia-noite; agora a aula de teste fica inequivocamente antes da pausa. Migration aplicada somente ao banco de testes.


## Incremento 122 — Chamada e primeiro lançamento por encontro, 11/09/2026

Consulta da chamada autoriza somente o professor atualmente atribuído ao encontro de turma, previsto e já terminado. Reutiliza a reconstrução histórica existente de alocações/situação contratual e projeta apenas nome/identificação do aluno. Substituição não abre a chamada geral da turma. A tela /diario/encontros/[id], ligada aos encontros atribuídos, permite primeiro lançamento de conteúdo e presença, mantém não informado como nulo e informa que salvar não conclui a aula. Diário já existente impede oferecer novo formulário de criação; pendência de vínculo bloqueia o formulário.

Passaram 12 testes de integração do diário, TypeScript, ESLint e build de produção (novas rotas incluídas). Testes cobrem chamada do substituto e negação ao titular sem atribuição, ausência de dados privados e bloqueio de encontro ministrado. Ainda faltam validação da interface no navegador, edição/correção integrada por encontro, particulares sem turma, gravações e conclusão. A reconstrução histórica continua com as limitações já documentadas para encerramentos/histórico insuficiente.


## Incremento 123 — Complementação do diário pendente por encontro, 11/09/2026

Consulta recupera conteúdo, presenças, observações e nomes históricos do próprio diário vinculado ao encontro. Formulário permite completar lançamento enquanto o encontro continua PREVISTO e atribuído ao mesmo professor. Registros de alunos que saíram permanecem visíveis em leitura; campos desabilitados conservam os valores originais no envio e servidor revalida a proteção. Autoria diferente exige regularização pela gestão. Encontro ministrado continua fora desse caminho de edição.

Os 12 testes de integração do diário passaram, incluindo recuperação do lançamento, complementação, proteção do aluno desligado da turma e bloqueio de alteração. TypeScript e ESLint passaram. Ainda pendentes: validação interativa desse formulário, fluxo de correção/conclusão por encontro e particulares sem turma. Este incremento não permite corrigir livremente uma aula concluída.


## Incremento 124 — Edição pendente sem sobrescrita silenciosa, 11/09/2026

Diário vinculado ao encontro exige estado anterior na edição. O identificador deriva de conteúdo, atualização e registros ordenados, detectando mudanças de chamada mesmo com timestamp igual. Conferência ocorre sob os bloqueios existentes antes de gravar. Formulário envia o estado consultado e é reconstruído quando o servidor entrega outro estado, evitando reaproveitar campos antigos junto de uma versão nova.

Passaram os 12 testes de integração do diário, TypeScript e ESLint. O cenário do substituto confirma recusa sem estado, edição válida, recusa da sobrescrita por uma aba desatualizada e preservação do conteúdo vencedor. A proteção dos registros de aluno que saiu também foi conferida com estado válido, sem depender da rejeição por versão ausente. O caminho legado sem encontro permanece com suas limitações anteriores; conclusão/correção por encontro e validação interativa ainda pendentes.


## Incremento 125 — Conclusão excepcional sem gravação, 11/09/2026

Professor atribuído solicita exceção com justificativa após preencher o diário. Núcleo exige encontro de turma previsto já terminado, autoria correspondente, conteúdo e chamada completa compatível com os vínculos históricos conferidos. Captura estado do diário/encontro e alunos abrangidos. Outra pessoa da Gestão Pedagógica/Administração aprova ou rejeita; aprovação revalida esse estado e muda o encontro para MINISTRADO atomicamente com decisão/evento. Edição posterior à proposta exige nova solicitação. Não gera cobrança ou reposição automaticamente.

Solicitação e decisão são preservadas no banco; autoaprovação impedida mesmo com papéis acumulados e repetição não duplica decisão. Migration aplicada somente ao banco de testes. Os 13 testes de integração do diário passaram, incluindo chamada incompleta, autoaprovação, proposta desatualizada, rejeição, nova aprovação, imutabilidade e bloqueio de edição livre após conclusão. TypeScript/ESLint passaram e banco/schema sem divergências.

Ainda faltam interface/consulta da exceção, designação para regularização após saída do professor (Q24), particulares sem turma, conclusão normal com gravação e correções aprovadas por encontro. Q07 não está integralmente entregue enquanto faltar interface e validação do fluxo completo.


## Incremento 126 — Consulta de exceções de gravação, 11/09/2026

Consulta paginada apresenta solicitações pendentes ou histórico de decisões. Professor acessa apenas solicitações de sua autoria; Gestão Pedagógica/Administração acompanha o conjunto. Cursor fora do escopo é recusado. Resposta contém motivo, período, situação do encontro, decisão e possibilidade de decidir por outra pessoa, sem expor snapshot ou ficha de aluno. A ação de decisão mantém sua revalidação independente da consulta.

Passaram 13 testes de integração do diário, TypeScript e ESLint. Cenários incluem isolamento entre professores, recusa de cursor alheio, permissão de decisão da gestão, retirada de decididas da fila pendente e preservação de ambas as decisões no histórico. Interface de revisão/solicitação e validação interativa ainda faltam; esta consulta não fecha a entrega Q07.


## Incremento 127 — Interface da exceção de gravação, 11/09/2026

Professor pode justificar conclusão excepcional na tela do diário já registrado, com proteção contra repetição do mesmo envio. Fila /diario/excecoes-gravacao, ligada ao diário, mostra pendentes/histórico e permite à gestão conferir conteúdo/presenças atuais antes de decidir. Consulta não devolve o diário de revisão ao perfil exclusivamente professor. Divergência entre diário e proposta desabilita aprovação na tela; ação revalida todo o contexto no servidor. Rejeição e aprovação exigem motivo e pessoa diferente.

Passaram 13 testes de integração do diário, TypeScript, ESLint e build. Cenários verificam privacidade da revisão e indicação de diário alterado. Ainda falta validar o fluxo dessas telas no navegador. Conclusão normal com gravação, regularização designada e correções aprovadas por encontro permanecem pendentes.


## Incremento 128 — Histórico direciona ao editor correto, 11/09/2026

O histórico do diário não oferece mais edição pelo formulário legado para aulas vinculadas a encontros. Se o encontro está previsto, terminou e continua atribuído ao autor, apresenta link para completar o diário por encontro; concluídas permanecem em leitura. A ação de gravação já recusava a omissão do vínculo; agora a interface está alinhada com essa proteção.

Passaram 13 testes de integração e 12 unitários do diário, TypeScript e ESLint. Testes conferem link de complementação para pendente e sua ausência após MINISTRADO. Atualizados mocks unitários para representar o vínculo nulo dos registros legados e a consulta de encontro usada pelo servidor. Correção aprovada por encontro e validação interativa da conclusão excepcional ainda pendentes.


## Incremento 129 — Regressão integral e atualização do relatório, 11/09/2026

Passaram 673 testes unitários em 68 arquivos e 471 testes de integração em 43 arquivos. A integração usou exclusivamente o banco local descartável erp_genius_test. TypeScript terminou sem diagnósticos; ESLint apresentou zero erros e os três avisos existentes em FinanceiroPainel/Sidebar. A comparação Prisma entre esse banco e o schema retornou migration vazia. Último build aprovado: incremento 127.

Atualizado o topo do relatório consolidado, anteriormente no incremento 100, para distinguir as entregas atuais de agenda/indisponibilidade/substituição/diário das funcionalidades ainda pendentes. Esta regressão não acrescenta funcionalidades nem representa homologação da SPEC integral. Ainda falta ensaio no navegador da conclusão excepcional sem gravação, além dos demais fluxos explicitamente pendentes nos incrementos anteriores. Não houve alteração de produção ou importação de dados reais.


## Incremento 130 — Histórico encerrado não desaparece da conferência da chamada, 11/09/2026

Removido o filtro de status atual da matrícula das alocações candidatas à chamada histórica e à gravação do diário. O intervalo da alocação continua delimitando os candidatos; a reconstrução da situação contratual decide a elegibilidade. Matrícula encerrada sem histórico temporal suficiente agora sinaliza exigeConferencia, em vez de sumir antes da análise. Outro contrato ativo não supre essa evidência. O legado sem matrícula mantém a restrição existente.

Passaram 14 testes de integração do diário, 12 unitários, TypeScript e ESLint do diretório. Novo cenário confirma consulta de encontro e consulta tradicional com pendência, ausência de campos privados, recusa de primeira gravação sem criar diário e preservação do encontro previsto quando se tenta concluir um registro incompleto. Não houve alteração de schema.

Q53 ainda não está integralmente entregue: reconstrução do encerramento depende de sua data efetiva e do fluxo de acerto/efetivação, ainda incompleto. Esta correção impede tratar a ausência dessa evidência como chamada completa; não presume situação ativa nem inventa presença. A rotina de conferência dessas lacunas e a regularização designada continuam pendentes.


## Incremento 131 — Aprovação e publicação inicial da grade no servidor, 11/09/2026

Adicionada decisão independente da proposta de grade. Aprovação revalida versão mais recente, snapshot de turma/modalidade/calendário, professor ativo, conflitos de intervalos e indisponibilidades aprovadas. Exige grade inicial futura; histórico existente continua no fluxo de revisão. Sob bloqueio da agenda e dos parâmetros, cria todos os encontros PREVISTO vinculados à proposta e registra decisão/evento na mesma transação. Repetição exata devolve a decisão sem duplicar encontros. Rejeição não publica. Decisão imutável e autoaprovação proibida também no banco.

A consulta apresenta a decisão/publicação existente sem classificar os encontros gerados por ela como uma proposta desatualizada. Migration 20260911134000_decisao_grade_turma aplicada somente ao banco local de teste, totalizando 76 migrations. Passaram 12 testes de integração da agenda, TypeScript e ESLint do diretório; diff banco/schema vazio. Cenário acrescentado verifica autoaprovação, conflito posterior à proposta, ausência de publicação parcial, parâmetros alterados, professor inativo, publicação integral, repetição, rastreabilidade e imutabilidade.

Ainda faltam interface de revisão/publicação, validação interativa e integração das reservas comerciais de horários. Não foram implementados remanejamento global, atualização de modalidade, início automático da turma, notificações nem regularização de agendas antigas. Esta etapa não conclui F07/Q21 integralmente nem habilita produção.


## Incremento 132 — Interface de revisão e decisão da grade, 11/09/2026

Criadas lista paginada de propostas pendentes/histórico e página de revisão em /academico/grades. Apresenta versão, motivo, data inicial informada, primeira aula efetiva, previsão de término, duração, fuso e encontros. A revisão mostra conflitos e indisponibilidades e impede aprovação visual de proposta inválida ou com encontros passados. Outra pessoa da Gestão Pedagógica/Administração pode decidir com motivo; servidor mantém revalidação transacional. Secretaria consulta; professor sem papel administrativo não acessa esta revisão. Consulta relê papéis no contexto transacional e apresenta apenas os dados de grade necessários à tela, além do snapshot de revisão existente.

Passaram 12 testes de integração da agenda, com verificações de acesso docente negado, preparador sem decisão, gestão independente habilitada, decisão concluída sem novo comando e projeção dos parâmetros. Build passou com as duas rotas e 38 páginas estáticas; após mover a conferência temporal para o serviço, TypeScript e ESLint do trecho passaram sem avisos. Ainda falta ensaio no navegador, interface de preparação de novas propostas e integração com reservas comerciais. Não representa conclusão integral da agenda ou implantação em produção.


## Incremento 133 — Preparação da grade pela interface, 11/09/2026

Página /academico/grades/nova acessível pela lista de grades. Secretaria/Gestão/Administração buscam turmas planejadas sem diário nem encontros publicados, com paginação. Formulário apresenta parâmetros cadastrados, exige fuso de origem explícito e motivo e chama a preparação versionada existente; sucesso leva à revisão. Reenvio dos mesmos dados reutiliza a chave de idempotência, campos ficam bloqueados durante o envio e o serviço confere a versão anterior. Não publica automaticamente. Turmas sem professor podem ser preparadas, mas a publicação continua exigindo docente apto.

TypeScript, ESLint das telas e build passaram; build reconheceu a nova rota e gerou 39 páginas estáticas. Não houve mudança de schema ou das regras da ação. Ensaio interativo do fluxo preparação/revisão/publicação permanece pendente, assim como interface de publicação do calendário institucional, reservas comerciais e demais requisitos ainda abertos. Não houve operação em produção.


## Incremento 134 — Edição legada não desvia da revisão da agenda, 11/09/2026

A edição direta de turma agora confere, sob o lock da turma, se há encontros não rascunhos antes de alterar professor, nível, modalidade, dias, horários ou datas. Nessas condições, exige revisão/aprovação da agenda. Impede divergência entre o cadastro editado e os encontros já publicados. Comparação de dias independe da ordem e horários são comparados em minutos. Ajustes de nome/capacidade mantêm as validações de ocupação sem modificar os encontros.

Passaram 33 testes de integração (integridade de turmas e diário), TypeScript e ESLint dos arquivos alterados. Novo cenário cobre cada parâmetro protegido, preservação da turma/eventos após recusas e ajuste cadastral legítimo com encontros intactos. Não houve migration. Fluxo integral de remanejamento e mudança de titular, início/conclusão por agenda e proteção dos demais caminhos ainda precisam ser implementados; o bloqueio da edição legada não os substitui.


## Incremento 135 — Conferência da agenda antes de concluir turma, 11/09/2026

A ação de mudança de status exige, antes de concluir, uma meta de aulas da grade aprovada, quantidade suficiente de encontros MINISTRADO, ausência de PREVISTO e diários vinculados com conteúdo e presenças preenchidas. Encontros futuros marcados como ministrados também impedem o fechamento. A conferência ocorre sob a trava institucional da agenda e lock da turma. O evento guarda a proposta de origem, meta e encontros contados. Conclusão repetida mantém idempotência. Não aprova alunos nem encerra matrículas/cobranças.

Passaram 19 testes de integração de integridade de turmas, TypeScript e ESLint do diretório. Cenário confirma recusa sem meta, quantidade insuficiente, encontro previsto e diário ausente, seguida de fechamento válido com encerramento único do vínculo docente. Dados preparados diretamente no teste representam estados isolados; não substituem ensaio da cadeia completa no navegador. Sem migration.

Q48 ainda requer início automático e controles das demais transições. Revisão de metas/cronogramas e tratamento conferido de turmas legadas continuam pendentes. Turmas sem meta aprovada não podem mais ser concluídas livremente pela ação antiga; precisam da regularização do histórico. As validações de conclusão normal dos encontros e correções aprovadas permanecem em suas frentes.


## Incremento 136 — Início automático da turma pela agenda, 11/09/2026

Rotina interna iniciarTurmasDaAgenda passa turmas PLANEJADA/ABERTA para EM_ANDAMENTO quando o primeiro encontro PREVISTO/MINISTRADO chega ao horário inicial. Ignora RASCUNHO/CANCELADO, preserva o estado dos encontros, não cria diário/cobrança e registra evento de sistema com início efetivo e instante de processamento. Trava institucional e lock da turma protegem a transição; repetição não gera novo evento. Processa até 200 turmas por execução e informa se há mais.

Integrada ao cron autenticado existente, isolada dos enfileiradores e independente de WhatsApp ligado. Não houve ativação ou alteração do agendamento externo. A persistência ocorre no próximo tick; a data efetiva guardada é o início do encontro, não a hora tardia do processamento. Cadência operacional e atendimento imediato em todos os fluxos ainda precisam de validação para Q48 integral.

Passaram 25 testes de integração (agenda e controle de acesso/cron), TypeScript e ESLint dos arquivos. Novo cenário cobre instante anterior, limite exato, encontros ignorados, repetição, autoria de sistema e ausência de alterações de aula/cobrança. Ainda falta fechar desvios por mudanças manuais de status e proteger decisões acadêmicas antes de eventual tick atrasado. Não houve migration nem operação em produção.


## Incremento 137 — Transições manuais respeitam o início da agenda, 11/09/2026

Mudança direta de status não reabre turma concluída. Turma EM_ANDAMENTO, com diário ou cujo primeiro encontro válido já começou não retorna a PLANEJADA/ABERTA. A verificação independe de o cron já ter processado a turma. Entrada manual em EM_ANDAMENTO exige encontro válido iniciado e registra seu início efetivo, sem alterar o status da aula. Legado sem agenda precisa de conferência; não se presume início por escolher um status.

Passaram 20 testes de integração de integridade de turmas, TypeScript e ESLint dos arquivos. Novo cenário cobre ausência de agenda, encontro futuro, atraso do cron, avanço válido, recusa de retrocesso e reabertura, preservando evento único e encontro previsto. Não houve migration. Ainda faltam homologação interativa, regularização do legado e controles de admissão/alocação que dependem de agenda publicada; essas regras de transição não completam todo o escopo acadêmico.


## Incremento 138 — Regressão integral após publicação e ciclo de turmas, 11/09/2026

Passaram 673 testes unitários em 68 arquivos e 476 de integração em 43 arquivos. Integração executada exclusivamente no banco local descartável, em 177,88 segundos. TypeScript aprovado; ESLint src sem erros e com os três avisos existentes em FinanceiroPainel/Sidebar. Comparação Prisma banco/schema vazia. Último build aprovado permanece o incremento 133.

Atualizado o relatório consolidado com os resultados e com um resumo atual que substitui a sequência de notas intermediárias do topo, preservadas neste registro. Atualizada a referência de execução da SPEC principal para incluir agenda/diário e suas limitações. Esta regressão não acrescenta funcionalidades nem comprova cumprimento dos requisitos ausentes; goal integral permanece em andamento. Sem alterações em produção.


## Incremento 139 — Consulta e decisão do calendário institucional na interface, 11/09/2026

Criadas lista paginada de versões e revisão detalhada em /academico/calendario. Mostra vigente, versões anteriores, pendentes/rejeitadas, fuso institucional e intervalos inclusivos de feriados/recessos/férias. Gestão/Administração diferente do preparador pode aprovar/rejeitar com motivo pela ação existente; Secretaria consulta. Versão antiga, fuso divergente ou encontros previstos publicados impedem aprovação na tela, além da revalidação do servidor. Links a partir do acadêmico e da preparação de grade.

TypeScript, ESLint das telas e build passaram; duas rotas reconhecidas e 40 páginas estáticas geradas. Não houve alteração de schema/regras de decisão, nem novo ensaio no navegador. Preparação/edição de propostas de calendário pela interface e revisão conjunta de impactos/remarcações continuam pendentes. Esta tela não transforma o bloqueio conservador de agendas existentes em revisão conjunta concluída.


## Incremento 140 — Preparação do calendário pela interface, 11/09/2026

Formulário em /academico/calendario/novo prepara períodos de feriado, recesso e férias, com nome, tipo e datas inclusivas. Pode começar vazio, copiar o vigente ou escolher explicitamente outra versão como base a partir da revisão. Exibe versão de origem e fuso institucional. Permite adicionar/remover/editar períodos somente na proposta, exige motivo e encaminha ao detalhe após gravar. Reutiliza chave para reenvios iguais, bloqueia campos durante envio e passa a última versão para a proteção concorrente existente no servidor.

TypeScript, ESLint das telas e build passaram, com a nova rota e 41 páginas estáticas. Não houve mudança de schema ou das ações de preparação/decisão. Ainda falta ensaio completo de calendário/grade no navegador, revisão conjunta das remarcações e validação operacional. O formulário não publica automaticamente nem altera períodos históricos.


## Incremento 141 — Fuso conferido preservado na preparação do calendário, 11/09/2026

Preparação exige fusoConferido informado pelo formulário e compara com a configuração institucional dentro da transação, sob lock compartilhado da configuração. Se mudou, recusa sem criar versão. A aprovação também mantém esse lock durante a comparação/aplicação. Reenvio exato de uma preparação já concluída continua retornando a versão original, mesmo após mudança posterior; isso não libera a aprovação de um fuso desatualizado. Atualizados todos os chamadores tipados e fixtures da agenda.

Passaram 14 testes de integração da agenda, TypeScript e ESLint dos arquivos alterados. Novo cenário verifica divergência, ausência de gravação, criação correta, reenvio após mudança sem duplicação e recusa da aprovação com fuso antigo. Não houve migration. Ensaio interativo do calendário/grade e remanejamento conjunto continuam pendentes.


## Incremento 142 — Calendário e grade ensaiados no navegador; correção de navegação, 11/09/2026

Ensaio no navegador interno, aplicação local e banco descartável, com Secretaria e Gestão Pedagógica fictícias. Secretaria preparou calendário com feriado; sua tela não ofereceu aprovação. Gestor distinto publicou. Secretaria preparou grade de três encontros; revisão mostrou primeira aula efetiva, término, fuso e ausência de comando de autoaprovação. Gestor publicou a grade. Verificação no banco confirmou oito condições em docs/validacao-calendario-grade-navegador-2026-09-11.json, incluindo autores, aprovações independentes, unicidade da grade, três encontros previstos e feriado respeitado. Fixture reproduzível: scripts/validacao/calendario-grade-navegador.mjs, restrita ao banco local de testes.

Encontrada falha de navegação: após gravar calendário, combinação imediata de router.push e router.refresh mantinha o formulário em Preparando. Removido refresh concorrente nos dois formulários de preparação. Grade navegou corretamente após a correção. Reteste do calendário copiando a versão publicada também navegou à nova proposta, que permaneceu pendente e mostrou necessidade de revisão conjunta por haver aulas publicadas. Datas foram preenchidas por teclado no controle nativo após a tentativa de fill não alterar os campos; não foi presumido sucesso do envio.

TypeScript e ESLint dos formulários passaram. Servidor local encerrado após o ensaio. Validação cobre esse caminho de preparação/aprovação/publicação; não comprova remanejamento conjunto, reservas comerciais, todos os fusos, concorrência no navegador ou demais funcionalidades da SPEC. Exceção de gravação ainda aguarda seu ensaio interativo. Não houve alteração em produção nem envio a alunos reais.


## Incremento 143 — Cálculo de proposta de replanejamento da grade, 11/09/2026

Adicionado cálculo puro de novas datas para os encontros futuros previstos de uma grade. Conserva identidade e quantidade, ignora cancelados/rascunhos para redistribuição e preserva aulas passadas, inclusive previstas com diário atrasado. Calcula pela grade e calendário propostos, permitindo adiamento por feriado novo e antecipação por dia liberado, sem colocar aula antes do instante da revisão ou sobre o fim de encontro em andamento. Histórico inconsistente e identificadores duplicados são recusados. Não grava, publica ou confirma recursos.

Passaram cinco testes unitários, TypeScript e ESLint dos arquivos. Casos incluem adição/remoção de feriado, preservação de passado/cancelamento, limite temporal e inconsistência. Ainda falta integrar o cálculo à consulta de impactos, tratar atribuições/exceções específicas, conferir conflitos e reservas e persistir/aprovar o conjunto transacionalmente. Este cálculo é a base do replanejamento, não a entrega concluída de Q20/Q41.


## Incremento 144 — Prévia de replanejamento integrada ao banco, 11/09/2026

Consulta autenticada preverReplanejamentoCalendario usa a versão candidata mais recente, fuso institucional conferido e grades aprovadas das turmas com encontros futuros. Reconstitui novas datas pelos parâmetros aprovados, sem usar edições atuais do catálogo como substitutas. Mantém identidade dos encontros, expõe suas atribuições para conferência posterior e não grava alterações. Marca turma concluída inconsistente, grade ausente/incompleta e encontro futuro fora da grade de origem como pendências. Particulares ficam identificadas separadamente para revisão dos horários contratados. Releitura de papéis ocorre na transação RepeatableRead.

Passaram 14 testes de integração da agenda, TypeScript e ESLint dos arquivos. Cenário de grade publicada cria nova proposta de feriado, obtém três datas revistas, confirma primeira data alterada e agenda persistida intacta; professor sem papel de gestão tem acesso recusado. Ainda faltam conferência cruzada de recursos/exceções, interface, persistência e aprovação/aplicação conjunta. Esta prévia declara revisaoCompleta=false e aplicada=false.


## Incremento 145 — Conflitos cruzados na prévia de replanejamento, 11/09/2026

Prévia integrada passa a conferir horários propostos entre si, por professor/turma, e contra encontros PREVISTO/MINISTRADO que permanecem na agenda. Horários antigos dos encontros do conjunto são excluídos da consulta externa e substituídos pelos propostos, evitando conflito artificial com a própria posição anterior. Inclui indisponibilidades aprovadas e docente sem papel/estado apto. Mantém reservasConferidas=false; não aplica nem aprova.

Passaram três testes unitários, 14 testes de integração da agenda, TypeScript e ESLint dos arquivos. Unitários cobrem choque entre turmas com mesmo professor, horários consecutivos, ausência, docente inapto e entradas inválidas. Integração confirma prévia inicialmente sem conflito e detecção de particular inserida no horário proposto, preservando encontros originais. Ainda faltam exceções específicas, reservas comerciais, interface e persistência/aprovação conjunta.


## Incremento 146 — Interface da prévia de replanejamento, 11/09/2026

Criada revisão em /academico/calendario/[id]/replanejamento, acessível da versão pendente. Apresenta turma/fuso, datas atuais e propostas por encontro, previsão de término, registros preservados e pendências. Conflitos entre propostas identificam a outra turma/encontro; conflitos externos, indisponibilidades e falta de docente apto aparecem no encontro correspondente. Particulares são indicadas para revisão própria. Página mantém o caráter de prévia sem comando de aplicação e usa a consulta autenticada do servidor.

TypeScript, ESLint das telas e build passaram; rota dinâmica reconhecida e 41 páginas estáticas. Sem mudança de schema ou cálculo. Ensaio no navegador da nova revisão, detalhamento de conflitos externos, ajustes manuais justificados, persistência e aplicação conjunta ainda pendentes; reservas/exceções continuam explicitamente não conferidas.


## Incremento 147 — Registro versionado da revisão do calendário, 11/09/2026

Adicionado RascunhoReplanejamento com autoria, motivo, versão, estado conferido e snapshot imutável. A ação autenticada reconstitui a prévia em transação RepeatableRead e recusa estado desatualizado ou versão superada; reenvio idêntico devolve o mesmo registro. A migration 20260911143000_rascunho_replanejamento impede atualização e exclusão do histórico. A conferência compartilhada foi extraída para uso pela consulta e pelo registro, com ordenação estável dos encontros particulares. Rascunhos podem conservar conflitos para resolução posterior; registrar não aprova nem aplica alterações.

Passaram 14 testes de integração da agenda, TypeScript e ESLint dos arquivos alterados. Cenário verifica recusa de prévia desatualizada, gravação com conflito, reenvio sem duplicação, rejeição de versão superada e imutabilidade no banco. Migration aplicada somente no banco descartável; comparação Prisma sem diferenças. Ainda faltam interface de gravação/consulta das versões, ajustes propostos, conferência de reservas e aprovação/aplicação conjunta. Nenhuma agenda publicada foi remanejada por esse fluxo.


## Incremento 148 — Gravação pela interface e histórico das revisões, 11/09/2026

A prévia de replanejamento ganhou formulário para guardar o conjunto com motivo, estado e versão conferidos. O reenvio conserva sua chave para conferir resultados incertos; mudança no estado recebido remonta o formulário, evitando associar texto antigo a uma nova revisão sem conferência. Após sucesso, navega ao histórico, sem refresh concorrente. Erros permitem consultar novamente a agenda. O calendário oferece acesso ao histórico mesmo depois de decidido.

Criada consulta autenticada do histórico, com releitura de papéis em transação, filtro por calendário e paginação de 30 registros. A tela mostra versão, autoria, data no fuso institucional e motivo, deixando explícito que registro não aplica a agenda. A listagem não expõe snapshots nem chaves internas. A visualização detalhada das datas gravadas por versão ainda precisa ser acrescentada; a prévia atual não substitui esse histórico.

Passaram 14 testes de integração da agenda, TypeScript, ESLint do trecho e build com 41 páginas estáticas e a nova rota dinâmica. Cenário ampliado confere projeção dos campos, paginação vazia/inválida, isolamento entre calendários e recusa de professor sem papel de gestão. Sem alteração de schema. Ensaio interativo dessa gravação, detalhe das revisões, ajustes manuais, reservas e aprovação/aplicação conjunta continuam pendentes.


## Incremento 149 — Conteúdo histórico das revisões salvas, 11/09/2026

Histórico passa a abrir o conteúdo de cada revisão: datas anteriores/propostas, previsão de término, registros preservados, pendências e conflitos daquela conferência, além dos horários individuais registrados. Consulta lê exclusivamente o snapshot persistido, validando sua estrutura e calendário, sem recalcular a agenda atual. Mantém autorização com releitura de papéis e filtra conjuntamente calendário e revisão. Compartilhada a apresentação com a prévia; a tela histórica identifica o contexto temporal e permanece somente leitura, sem declarar publicação.

Passaram 14 testes de integração da agenda, TypeScript, ESLint e build com 41 páginas estáticas e a rota de detalhe. Integração altera um encontro depois da gravação e comprova retorno histórico idêntico; também recusa calendário diferente e professor sem papel de gestão. Ajustados os rótulos históricos após o build, com nova conferência de TypeScript/ESLint. Sem migration. Ainda faltam ensaio interativo das revisões, ajustes manuais justificados, reservas e aprovação/aplicação conjunta; o escopo integral permanece incompleto.


## Incremento 150 — Ajustes justificados das datas na revisão, 12/09/2026

Prévia e registro aceitam ajustes por encontro futuro elegível, com data/horário no fuso da turma e motivo. O servidor converte o horário sem escolher silenciosamente instantes ambíguos, conserva a duração original, recalcula o término e confere os conflitos sobre as datas ajustadas. Recusa duplicação, encontro fora do conjunto e início passado. Alterações que atingem dias não letivos ficam identificadas no encontro e nas pendências, exigindo decisão explícita da exceção; não são aplicadas nem autorizadas pelo ajuste.

Interface permite adicionar/remover ajustes e conferir novamente o conjunto. Enquanto há edição não conferida, identifica que a prévia ainda corresponde à consulta anterior e retira a ação de salvar. Gravação recebe os ajustes conferidos e refaz o cálculo, recusando omissão/divergência. Histórico preserva motivo do ajuste e períodos não letivos identificados, com leitura compatível com versões anteriores sem esses campos. Sem mudança de schema.

Passaram três testes unitários novos, 14 de integração da agenda, TypeScript, ESLint e build com 41 páginas estáticas. Casos incluem conversão de fuso, travessia de data, duração, dia não letivo institucional, entradas inválidas, conflito resolvido na prévia, recusa de particular fora do conjunto, gravação da revisão ajustada e preservação dos encontros publicados. Ensaio interativo permanece pendente. Aprovação/aplicação conjunta, autorização explícita das exceções e conferência de reservas ainda precisam ser implementadas; esse incremento prepara a decisão, sem efetivá-la.


## Incremento 151 — Conferência atual da revisão para decisão, 12/09/2026

Adicionada consulta separada do conteúdo histórico para reconstituir a revisão com seus ajustes e comparar o estado atual ao registrado. Identifica revisão superada, calendário não elegível, alteração da agenda, conflitos, indisponibilidade, docente inapto, turma sem proposta e pendências de particulares/reservas. Expõe as exceções de dias não letivos com encontro, período e motivo, sem autorizar sua realização. Confere papel de decisão e independência tanto em relação ao preparador do calendário como ao preparador da revisão. A aplicação conjunta continua indisponível; essa consulta não é uma ação de aprovação.

A tela de detalhe separa conferência atual do snapshot imutável. Passaram 14 testes de integração da agenda, TypeScript e ESLint. Cenários verificam estado correspondente e depois divergente, preparador impedido, gestor independente, revisão superada, exceção identificada, vínculo a outro calendário recusado e professor sem papel de gestão recusado. Último build continua o do incremento 150; nenhuma rota ou schema novo. Faltam decisão/aplicação transacional, tratamento das reservas e particulares e ensaio interativo. A consulta não elimina essas pendências nem concede autorização pela ausência de conflito.


## Incremento 152 — Ensaio da revisão ajustada no navegador, 12/09/2026

Ensaio local com Secretaria fictícia: abriu prévia, adicionou ajuste, verificou ausência da ação de salvar enquanto não conferido, informou data/horário/justificativa, reconferiu e viu término recalculado. Salvou com motivo, navegou ao histórico e reabriu o conteúdo. Detalhe exibiu horário ajustado, justificativa e impedimento de autoaprovação, separando a conferência atual do snapshot histórico. Nenhuma decisão conjunta foi oferecida. Datas e horário foram preenchidos pelo teclado do controle nativo após fill não alterar os campos; os valores foram conferidos visualmente antes do envio.

Fixture reproduzível scripts/validacao/replanejamento-navegador.mjs, com conexão fixa ao banco descartável. A base de calendário/grade/encontros foi semeada diretamente para isolar o ensaio da revisão; isso não constitui reteste da publicação inicial. Verificação posterior confirmou cinco condições em docs/validacao-replanejamento-navegador-2026-09-12.json: registro único, autoria, ajuste preservado, agenda original intacta e calendário candidato não aprovado. Servidor local encerrado intencionalmente. Não houve envio externo ou alteração de produção.

Este ensaio cobre ajuste/conferência/gravação/leitura com um perfil de Secretaria, não todos os conflitos, falhas de rede, papéis ou decisões. A aprovação/aplicação conjunta e a integração com reservas continuam pendentes. Últimos testes automatizados permanecem os do incremento 151; nenhuma mudança no código de produção neste incremento.


## Incremento 153 — Regressão completa após os fluxos de revisão, 12/09/2026

Executadas integralmente as suites existentes: 684 testes unitários em 71 arquivos e 477 testes de integração em 43 arquivos passaram, sem falhas ou testes pendentes. Integração executada em processo único e banco descartável, respeitando o truncamento entre suites. TypeScript e build passaram, com 41 páginas estáticas. ESLint de src terminou sem erros e com os três avisos anteriores em FinanceiroPainel/Sidebar. Comparação Prisma não encontrou divergência entre schema e banco local.

Evidência resumida por arquivo em docs/validacao-regressao-153-2026-09-12.json. A SPEC teve seu parágrafo de execução atualizado para reconhecer os ensaios interativos de calendário/grade e revisão, mantendo incompletos os requisitos ainda não implementados. Nenhuma contagem equivale a cobertura integral da SPEC: reservas, decisão/aplicação conjunta, demais fluxos financeiros, avaliações e integrações externas continuam pendentes. Nenhuma alteração de produção, importação real ou envio externo ocorreu. O banco de teste foi limpo pelas suites; fixtures dos ensaios anteriores devem ser recriadas antes de novos ensaios.


## Incremento 154 — Regra de elegibilidade para nova reserva em turma, 12/09/2026

Iniciada a base da admissão comercial que será necessária às reservas: regra pura recebe agenda publicada, aptidão/disponibilidade docente conferidas, limite de entrada e sua referência temporal, capacidade, ocupações e reservas que ocupam vagas. Admite turma em andamento dentro da janela, sem usar somente o status ABERTA como o caminho legado. Conserva PLANEJADA como estado temporal compatível com grade já publicada, mas nunca como substituto da publicação. Concluída é impedida. Limite não configurado ou reservas não conferidas impedem elegibilidade, sem presumir prazo ou saldo livre. O último dia civil é inclusivo na referência informada; nenhuma preferência de visualização participa do cálculo.

Sete testes unitários, TypeScript e ESLint passaram. Casos incluem entrada após início, virada exata de data no fuso, vaga já reservada, dados desconhecidos e inválidos, docente/publicação e estado concluído. Não houve migration nem alteração do fluxo legado: este módulo ainda precisa da consulta transacional, configuração persistida da janela, registro/ciclo das reservas e integração aos atos de contratação. Não confirma vaga, libera cobrança/assinatura ou atende sozinho Q107–Q110. A exceção para reserva anterior após fechamento da janela terá operação própria e não libera novas reservas.


## Incremento 155 — Janela de admissão versionada e decisão independente, 12/09/2026

Persistidas propostas de janela por turma com limite civil, referência de fuso institucional conferida, autoria, motivo e versão. Preparação por Secretaria/Gerência Pedagógica/Administração; decisão por outra pessoa da Gerência Pedagógica/Administração. Operações usam lock da turma, releitura de papéis, controle de versão e repetição sem duplicação. Publicação recusa turma concluída, proposta superada e alteração do fuso desde a preparação. A data/fuso da versão anterior não são reescritos. Consulta transacional da regra vigente seleciona a maior versão aprovada, sem substituir por proposta pendente ou rejeitada.

Migration 20260912010000_janela_admissao aplicada somente no banco descartável (78 migrations). Histórico imutável e autoaprovação bloqueados também no banco. Três testes de integração novos, TypeScript e ESLint passaram; schema sem diferenças. Testes cobrem vigência, repetição, preservação, papel não autorizado, versões/fuso/conclusão e ausência de criação de matrícula ou encontros.

Ainda faltam interface de configuração, consulta de disponibilidade com dados reais de ocupação e reservas, ciclo transacional das reservas e integração ao novo fluxo comercial. O caminho legado de matrícula não foi declarado adequado a Q103–Q123. Aprovar a janela não comprova vaga, publicação de agenda, reserva ou ativação; essas condições continuam separadas. A revisão de agenda ainda depende da implementação das reservas para sua aplicação conjunta.


## Incremento 156 — Interface da janela de admissão, 12/09/2026

Criadas /academico/admissoes e /academico/admissoes/[id], com busca/paginação de turmas, regra vigente, preparação de nova versão e histórico paginado com motivos/autoria. Consulta autenticada relê papéis em transação e fornece capacidades de decisão; preparador não recebe comando de decisão e aprovação fica indisponível para versão superada, turma concluída ou fuso divergente. Ações continuam revalidando independentemente da tela. Formulário mantém a chave de tentativa para reenvios incertos e remonta após mudança de versão/fuso. Janela vigente é apresentada separadamente das propostas.

Passaram três testes de integração da janela, TypeScript, ESLint e build com 42 páginas estáticas e as duas rotas dinâmicas. Testes ampliados verificam consulta sem janela aprovada, capacidade do preparador/gestor independente, paginação e recusa de professor. Ainda falta ensaio no navegador. Nenhuma mudança de schema. A interface não confirma vaga nem substitui o ciclo das reservas ou a integração ao fluxo de contratação, que continuam pendentes.


## Incremento 157 — Registro transacional de reserva de vaga por matrícula, 12/09/2026

Adicionada ReservaVagaMatricula, vinculando contrato, turma, janela aprovada, preparador, prazo e chave de repetição. Índice parcial impede duas reservas ocupantes para a mesma matrícula; histórico de origem não pode ser alterado ou excluído. Estados distinguem ativa, mantida por pendência, expirada, utilizada e liberada. Apenas criação foi implementada neste incremento; transições exigem os fluxos correspondentes.

Primitiva interna reservarVagaMatriculaTx usa lock global de agenda, matrícula e turma; confere preparação sem alocação, compatibilidade de produto, janela aprovada, grade/calendário aprovados, encontros futuros, professores/conflitos/ausências, ocupações e reservas ocupantes. Prazo vencido sozinho não deixa de ocupar vaga. Não cria cobrança, alocação ou ativação. Não é Server Action: o chamador comercial ainda precisa autorizar o acesso à contratação e resolver o prazo da configuração aplicável; não há prazo padrão presumido nem API pública para receber autor/prazo do navegador.

Três testes de integração novos, TypeScript, ESLint e schema sem divergências. Testes verificam disputa concorrente pela última vaga (um sucesso), repetição, origem protegida, prazo vencido sem liberação e ausência de cobrança/alocação/ativação. Migration 20260912020000_reserva_vaga aplicada somente no banco descartável (79 migrations). Ainda faltam configuração do prazo, integração comercial autorizada, conversão da reserva em alocação e expiração/manutenção/liberação conforme avanço formal. Os caminhos legados ainda não descontam reservas; por isso a primitiva não deve ser exposta como fluxo operacional concluído antes dessa integração.


## Incremento 158 — Capacidade protegida contra ocupação de vagas reservadas, 12/09/2026

Criação legada de matrícula passa a descontar reservas ATIVA/MANTIDA_PENDENCIA na conferência da turma. Edição de capacidade considera alocações e reservas e retorna mensagem específica. A migration 20260912030000_capacidade_com_reservas acrescenta proteção no banco para inserção/reativação/mudança de turma em alocações, inserção/reativação de reservas e redução de capacidade. Usa lock da turma e conta reservas ocupantes mesmo vencidas, até a transição válida. A proteção impede ultrapassar capacidade quando há reservas; regras legadas de capacidade sem reservas continuam com suas validações existentes. Conversão futura deve baixar a reserva e criar a alocação na mesma transação, sem dupla ocupação.

Passaram 691 testes unitários em 72 arquivos e 85 testes de integração das quatro suites de reservas, integridade de turma, ativação e fluxo acadêmico. TypeScript e ESLint do trecho passaram; schema sem divergências. Testes novos verificam tentativa direta de alocação sobre reserva, aumento/redução de capacidade, reativação e inserção direta de segunda reserva. Migration aplicada somente no banco descartável (80 migrations).

As listagens de disponibilidade e as consultas preliminares de movimentação ainda precisam exibir o saldo completo com reservas; a barreira transacional impede consumir a vaga mesmo nesses caminhos. Integração comercial pública, prazo configurado e ciclo de expiração/conversão continuam pendentes. Esse incremento não habilita a operação comercial completa nem a aplicação conjunta de calendário.


## Incremento 159 — Reservas nas consultas e na disponibilidade exibida, 12/09/2026

Consultas de turmas para matrícula, destinos de movimentação e configuração passaram a contar reservas ATIVA/MANTIDA_PENDENCIA separadamente das alocações ativas. Filtros e rótulos de vagas descontam ambas as contagens. Painel de turmas mostra matriculados, reservas e vagas; contexto de mudança acadêmica elimina destinos sem saldo e a regra de impedimento revalida esse saldo antes da decisão/execução. Reservas liberadas não entram; prazo vencido não libera saldo sem transição válida.

Passaram 692 testes unitários em 72 arquivos e 61 testes de integração das suites de reservas e fluxo acadêmico. TypeScript e ESLint do trecho passaram. Casos novos conferem a contagem nas consultas comercial/configuração e impedimento acadêmico causado por reserva. Não houve migration; último build permanece no incremento 156. O filtro comercial legado ainda usa ABERTA/início futuro: integrar janela e estados da nova contratação continua pendente. Este incremento corrige contagem/exibição e não conclui expiração, conversão ou disponibilização do fluxo comercial de reservas.


## Incremento 160 — Manutenção da reserva vencida com avanço conhecido, 12/09/2026

Adicionada conferência transacional interna do vencimento. Relê reserva e matrícula sob locks da agenda/matrícula/turma/reserva, respeita prazo vigente e não reprocessa estados já tratados. Ao encontrar informe em conferência/confirmado, recebimento, indicador financeiro legado, evidência contratual ou situação da matrícula que exige revisão, passa para MANTIDA_PENDENCIA e grava evento com as referências da conferência. A pendência não se desfaz apenas porque um informe foi rejeitado depois; sua resolução seguirá Q118.

Ausência de registros locais não foi tratada como prova de ausência de assinatura externa: nesse caso a primitiva retorna CONFERIR_ASSINATURA_EXTERNA e não libera vaga. Essa etapa permanece incompleta até integração/conferência do serviço de assinatura e encerramento da solicitação quando aplicável. Não há cron ou ação pública nova, nem cancelamento de contrato/cobrança ou devolução.

Oito testes de integração da suite de reservas passaram, além de TypeScript e ESLint. Novos cenários cobrem prazo vigente, comprovante pendente, repetição sem evento duplicado, manutenção após rejeição posterior e isolamento de pagamento de outro contrato. Sem migration. Ainda faltam liberação automática sem avanço confirmado, tratamento de corrida com assinatura/pagamento, painel de pendências e resolução independente conforme Q118. O ciclo completo das reservas não foi declarado entregue.


## Incremento 161 — Painel de reservas e conferência manual do vencimento, 12/09/2026

Criada /secretaria/reservas para Secretaria/Administração, com filtro por matrícula, ocupantes/histórico, paginação, estado, prazo no fuso da janela e acesso à contratação. Consulta relê papéis em transação e projeta somente os dados necessários, sem cobranças ou hashes internos. A ação de conferir vencimento revalida acesso e executa a conferência transacional. Quando mantém por pendência, registra o usuário que iniciou a conferência; processamento interno sem usuário continua identificado como sistema. Não oferece liberação, prorrogação ou cancelamento.

Nove testes de integração de reservas, TypeScript, ESLint e build passaram, com 43 páginas estáticas e nova rota dinâmica. Casos cobrem filtro, paginação, projeção, professor recusado e autoria da conferência manual. Sem migration. Ensaio interativo do painel ainda pendente. A resolução independente Q118, integração com assinatura e liberação sem avanço confirmado continuam incompletas. O painel não torna o ciclo comercial de reservas concluído.


## Incremento 162 — Resolução administrativa independente de reserva, 12/09/2026

Implementadas propostas versionadas e imutáveis para prorrogar ou liberar reservas MANTIDA_PENDENCIA. Secretaria/Administração prepara motivo, tratamento da contratação e novo prazo quando aplicável; outra pessoa da Administração decide. A aprovação revalida a versão e o estado local da reserva, matrícula, cobranças e informes. Mudança após a proposta exige nova conferência. Prorrogação exige prazo futuro e posterior ao anterior, contratação em preparação e turma não concluída. Papéis são relidos após adquirir os locks.

Decisão e transição são atômicas e auditadas; reenvio idêntico não duplica a operação. Banco impede edição/exclusão das propostas e decisões e autoaprovação. Liberação ou prorrogação não altera contrato, matrícula, cobrança ou recebimento e não executa devolução. O tratamento registrado orienta os fluxos próprios; integração de assinatura externa ainda não está disponível.

Passaram os 12 testes de integração de reservas, TypeScript e ESLint do trecho. Casos novos cobrem os dois resultados, autoaprovação, repetição, preservação da contratação e recusa após mudança contratual. Migration 20260912040000_resolucao_reserva aplicada somente ao banco descartável; schema sem divergências (81 migrations). Interface de preparação/revisão/decisão, ensaio no navegador e integração completa com contratação permanecem pendentes. Último build continua no incremento 161; não houve homologação em produção.


## Incremento 163 — Interface de resolução e histórico da reserva, 12/09/2026

Criada /secretaria/reservas/[id], acessível pelo painel. Secretaria/Administração prepara proposta de prorrogação ou liberação, informando motivo e tratamento da contratação. Data/horário são interpretados no fuso da reserva com a conversão estrita existente (sem escolha silenciosa em ambiguidade de horário). A interface apresenta histórico paginado, autoria, prazo, motivos e decisões; somente outra pessoa da Administração recebe comandos de aprovação/rejeição. Aprovação desatualizada ou com prazo inválido fica indisponível, mantendo a revalidação transacional do servidor.

Consulta autenticada relê papéis e projeta dados necessários, sem snapshot financeiro, identificador interno de preparador ou hash. Estado atual é comparado ao da proposta para habilitar a decisão. O fluxo financeiro/documental permanece separado; a tela não apresenta a resolução da reserva como cancelamento ou devolução.

Passaram 13 testes de integração de reservas, TypeScript, ESLint do trecho e build (43 páginas estáticas e nova rota dinâmica). Teste acrescentado verifica projeção, paginação, preparação pela Secretaria, decisão administrativa independente, recusa de professor, desatualização e histórico de rejeição. Sem migration. Ensaio interativo no navegador permanece pendente, assim como integração completa das reservas ao fluxo comercial e de assinatura. Nenhuma produção foi alterada.


## Incremento 164 — Preparação do ensaio de reservas e estado explícito, 12/09/2026

Criado scripts/validacao/reserva-resolucao-navegador.mjs para semear usuários e reserva fictícia no banco local descartável e verificar, após o ensaio, autoria, aprovação independente, liberação, preservação da matrícula e ausência de cobrança. A preparação foi executada. A base é semeada diretamente e não comprova a contratação inicial nem a criação operacional da reserva.

O ensaio no navegador NÃO foi executado: a revisão automática rejeitou a inicialização do servidor local (next start na porta 3662), indicando apenas blocked by policy. Não foi produzido relatório de sucesso nem tentado contornar a restrição. O verificador posterior permanece não executado até haver interação real. Essa limitação não bloqueia outras frentes de implementação.

A tela de resolução agora mostra explicitamente o estado atual, inclusive após liberar a vaga. TypeScript, ESLint do trecho e diff --check passaram. Último build e integração permanecem os do incremento 163. Não houve nova migration ou alteração de produção.


## Incremento 165 — Prazo configurado de reserva, 12/09/2026

ConfiguracaoOperacional ganhou prazoReservaMinutos nullable, sem valor padrão, com proteção de inteiro positivo no banco. Administração configura na tela operacional; omissão na ação preserva o valor, e null explícito retira a configuração para novas reservas. Auditoria guarda anterior/novo. Reservas existentes não são prorrogadas nem liberadas por essa edição.

A primitiva interna de criação deixou de receber prazo do chamador e lê a configuração sob lock compartilhado. Falta de configuração recusa nova reserva. A duração aplicada é auditada; criadaEm/expiraEm conservam o prazo aplicado. Reenvio idêntico retorna a reserva original mesmo depois de alteração/retirada do parâmetro. O chamador continua responsável pelo escopo da contratação; a integração comercial pública ainda não está pronta.

Migration 20260912050000_prazo_reserva aplicada somente ao banco descartável (82 migrations); schema sem divergências. Passaram 27 testes de integração das suites de reservas e configuração, TypeScript, ESLint e build com 43 páginas estáticas. Casos novos verificam ausência de padrão, limites técnicos de inteiro, omissão/null, proteção no banco, prazo efetivamente aplicado e repetição após remover a configuração. Valores nos testes são fixtures, não parâmetros aprovados para produção. Ensaio interativo permanece pendente conforme incremento 164.


## Incremento 166 — Ação de reserva autorizada por contratação, 12/09/2026

Adicionada reservarVagaContratacao, Server Action que recebe apenas contratação, turma, motivo e chave de repetição. Autor vem da sessão; duração vem da configuração. Sob locks de agenda/matrícula/lead, relê papéis e exige carteira atual do lead daquela matrícula para vendedor/gerente. Secretaria/Administração têm acesso operacional. Sem lead vinculado, a ação não infere acesso comercial pela comissão ou pelo cadastro global do aluno.

Após autorizar, chama a reserva transacional existente, mantendo conferência de turma, janela, agenda, disponibilidade e capacidade. Cobertura temporária e equipe gerenciada seguem escopoComercialAtual; não mudam o titular da negociação. Reenvio também revalida acesso, impedindo uso após transferência/revogação. Ação não cria matrícula, não emite cobrança e não aloca aluno.

Passaram 18 testes de integração de reservas, TypeScript e ESLint. Casos novos verificam outro vendedor, matrícula sem vínculo comercial, parâmetro de prazo indevido, transferência de titularidade, perda de papel, Secretaria, cobertura temporária e gerência com revogação. Sem migration. Último build permanece no incremento 165. Ainda faltam a interface comercial, criação da preparação com reaproveitamento de cadastro e reserva na mesma operação, cobrança após conferência e integração de assinatura/conversão. A existência da ação não conclui COM01.


## Incremento 167 — Consulta e interface de reserva da contratação, 12/09/2026

Criada /matriculas/[id]/reserva, acessível em cada cartão da Secretaria. Comercial e Secretaria consultam a contratação conforme escopo vigente. Consulta projeta somente identificação da matrícula, prazo, reserva ocupante e turmas compatíveis, em páginas de dez. Não usa o filtro legado de início futuro: a janela aprovada governa novas entradas, inclusive turmas em andamento, com conferência de encontros/professor/capacidade.

Extraída conferirTurmaParaReserva e reutilizada por consulta e confirmação, evitando regras divergentes para janela, publicação, aptidão docente, conflitos/ausências e vagas. A tela mostra impedimentos em linguagem operacional, permite escolher somente candidatas elegíveis e revalida tudo na confirmação. Reserva existente ou alocação ativa impede nova oferta de reserva para a matrícula; falta do prazo configurado é indicada. Confirmação não cobra nem ativa.

Passaram 19 testes de integração de reservas, TypeScript, ESLint do trecho e build com 43 páginas estáticas e nova rota dinâmica. Teste novo cobre outro vendedor recusado, projeção, paginação, elegibilidade, reserva ocupante e indisponibilidade para outra contratação após ocupar a vaga. Sem migration. Ensaio no navegador segue pendente. Criação inicial da matrícula em preparação com reaproveitamento de identidade/reserva atômica, conferência/cobrança e assinatura ainda não estão integradas; a tela atende contratação já existente e não conclui COM01.


## Incremento 168 — Preparação comercial e reserva atômicas, 12/09/2026

Adicionada PreparacaoComercialMatricula, vinculada à matrícula e à reserva, com autor, regime proposto mensal/por hora, valores propostos, moeda, referências de preço capturadas, responsável comercial, motivo e chave de repetição. Registro é histórico e imutável; banco verifica que a reserva pertence à mesma matrícula, valores não negativos e regimes admitidos. As condições ficam explicitamente não aprovadas e não são cobranças.

Primitiva interna prepararContratacaoTx relê papel/carteira da negociação, exige responsável, cadastro de aluno identificado e oferta/país/moeda coerentes. Reutiliza aluno sem alterar seus outros contratos, cria matrícula RASCUNHO e reserva pela conferência vigente, tudo na mesma transação. Falha de vaga desfaz a nova matrícula e preparação. Não cria cobrança, comissão ou alocação. Não é Server Action: o chamador ainda deve identificar/autorizar alunoId; a interface e o vínculo seguro de identidade comercial ainda faltam. A primitiva recebe cadastro existente e não implementa a coleta inicial de pessoa nova.

Passaram 22 testes de integração de reservas/preparação, TypeScript e ESLint; schema do banco descartável sem divergências. Migration 20260912060000_preparacao_comercial aplicada somente nesse banco (83 migrations). Testes novos cobrem ambos os regimes como condições propostas, repetição, histórico imutável, preservação da matrícula anterior e rollback integral sem vaga. Isso não comprova operação completa por hora: Q111/agenda flexível, condições da oferta, aprovação comercial, conferência documental, cobrança inicial e assinatura permanecem pendentes. Último build permanece no incremento 167.


## Incremento 169 — Candidatos de identidade e preparação autenticada, 12/09/2026

Consulta consultarCadastrosPreparacao exige acesso vigente à negociação e busca correspondência exata do telefone E.164 registrado nela. Projeta apenas id/nome/sobrenome, paginados, sem documentos, dados financeiros ou outros contratos. Correspondência é candidato, não identidade comprovada: contatos compartilhados exigem seleção explícita. Contato ausente/inválido não gera associação nem cadastro novo.

Ação prepararContratacao exige seleção confirmada e revalida, sob locks, que o aluno escolhido pertence aos candidatos do contato da negociação autorizada. Executa preparação/reserva atômica e registra autoria/método da seleção. Reenvio já aplicado revalida carteira e conteúdo original e retorna a preparação anterior, mesmo se o contato mudou depois, sem novo evento. Não permite escolher livremente outro aluno por id. Secretaria/Administração também usam esse caminho por contato; identificação alternativa/manual e coleta de pessoa nova continuam pendentes e não são simuladas com duplicação automática.

Passaram 24 testes de integração de reservas/preparação, TypeScript, ESLint e diff --check. Casos novos cobrem outra carteira, contato compartilhado, projeção mínima, paginação, confirmação obrigatória, candidato indevido, preservação dos outros contratos, ausência de contato e repetição após mudança do contato. Sem migration. Último build permanece no incremento 167. Ainda faltam formulário comercial completo, tratamento de identidade sem correspondência, conferência/aprovação das condições e integração financeira/documental; consulta/ação não comprovam COM01 completo.


## Incremento 170 — Formulário comercial de preparação com reserva, 12/09/2026

Criada /leads/[id]/contratacao e ligação a partir da ficha do lead para papéis autorizados. A tela reúne candidatos de cadastro pelo contato autorizado, seleção/confirmação explícita, ofertas por país/produto/moeda, turma elegível, regime e valores propostos e motivo. Cadastros/ofertas/turmas têm paginação. A operação usa prepararContratacao e navega para a reserva após sucesso, sem criar cobrança/assinatura. Negociação já preparada direciona à contratação existente.

Consulta de ofertas relê acesso, considera ofertas ativas em país ativo e usa a mesma conferência de disponibilidade da reserva. Divergência de moeda ou falta de prazo bloqueia o formulário. Não são presumidos preço, identidade ou turma. Cadastro de pessoa nova e identificação sem correspondência de contato não foram implementados por esse formulário; ausência de candidato continua pendente de tratamento. Regime e valores são propostas sujeitas à conferência/aprovação; fluxo completo de ofertas por hora/flexíveis e cobrança permanece pendente.

Passaram 25 testes de integração de reservas/preparação, TypeScript, ESLint do trecho, diff --check e build (43 páginas estáticas, nova rota dinâmica). Teste novo verifica acesso à consulta de ofertas, paginação, disponibilidade e recusa de oferta retirada. Ensaio interativo do formulário não foi executado e segue pendente. Sem migration. COM01 continua incompleto: faltam coleta inicial/identificação alternativa e integração das condições, conferência, cobrança, assinatura e conversão da reserva em alocação.


## Incremento 171 — Cadastro inicial na preparação comercial, 12/09/2026

Preparação passou a aceitar cadastro existente ou dados básicos de pessoa nova, nunca ambos. Ação específica exige confirmação explícita de cadastro novo; contato vem do lead autorizado. Pessoa nova informa nome, sobrenome opcional, e-mail opcional e país do cadastro (separado do país da oferta). O registro do aluno, matrícula, condições propostas e reserva são criados na mesma transação. Reenvio retorna a operação original sem duplicar pessoa/evento; falha de vaga desfaz todo o conjunto.

O formulário oferece pessoa nova somente quando não existe candidato em todo o contato, independentemente da página de candidatos aberta. Servidor revalida a ausência e também recusa e-mail já cadastrado (sem distinguir maiúsculas/minúsculas). Correspondência não é associação automática: casos de contato compartilhado, identidade alternativa ou cadastro existente com outro contato ainda precisam de fluxo de conferência próprio. A verificação não pretende resolver deduplicação global por semelhança de nomes ou importação.

Passaram 27 testes de integração, TypeScript, ESLint do trecho e build (43 páginas estáticas). Casos novos cobrem confirmação obrigatória, criação/repetição, telefone/e-mail existente, cadastro novo não oferecido por mera página vazia e rollback sem vaga. Sem migration. Ensaio no navegador permanece pendente; conferência das condições, documentos, emissão financeira e identificação alternativa continuam incompletos. A coleta básica não substitui a complementação pela Secretaria.


## Incremento 172 — Revisão das condições comerciais registradas, 12/09/2026

Criada /matriculas/[id]/preparacao, ligada à reserva e ao cartão da Secretaria. Mostra identificação da contratação, regime, valores propostos, motivo/autoria, referências de preço capturadas e estado/prazo da reserva originalmente vinculada. Não usa a tabela atual para reescrever o preço histórico. Matrículas legadas sem preparação têm indicação própria. O estado de conferência/aprovação permanece explicitamente pendente; não há comando que emita cobrança ou declare aceite por visualizar a proposta.

Consulta relê papéis/carteira e projeta os dados da própria contratação, sem hashes, JSON bruto, cobranças ou documentos de outras matrículas. Referências são interpretadas por schema e projetadas; formato incompatível aparece como pendência, sem aprovação presumida. Consulta não avalia nem aprova alçada de desconto: esse fluxo continua pendente.

Passaram 28 testes de integração, TypeScript, ESLint e build (43 páginas estáticas, nova rota dinâmica). Teste novo cobre referência histórica após alteração de preços, projeção, carteira alheia, professor recusado, contrato anterior não acessível ao vendedor da nova venda e matrícula legada. Sem migration. Ensaio interativo permanece pendente. Conferência/aprovação das condições, complementação cadastral, cobrança inicial e assinatura ainda precisam ser integradas.


## Incremento 173 — Regressão integral e alinhamento do escopo do portal, 12/09/2026

Executadas todas as suites existentes: 692 testes unitários em 72 arquivos e 509 de integração em 45 arquivos, sem falhas ou pendentes. Integração foi executada em um único processo contra o banco descartável; aguardado o processo original até sua conclusão, sem reiniciar por ausência de saída do reporter JSON. Evidência por arquivo em docs/validacao-regressao-173-2026-09-12.json. TypeScript passou; ESLint completo terminou com zero erros e os três avisos anteriores em FinanceiroPainel/Sidebar. Schema local sem divergências; 83 migrations aplicadas. Último build aprovado permanece no incremento 172.

Corrigido trecho de alcance na SPEC central (v1.3): o portal do aluno inclui o acompanhamento acadêmico oficial aprovado em Q143, além das reposições. Mantidos os limites de Q139 (provas fora do ERP) e Q145 (sem portal de responsáveis nesta entrega). A redação antiga era anterior à ampliação e não podia restringir a decisão aprovada.

Esta regressão comprova apenas as suites existentes, não todos os requisitos. Conferência/aprovação comercial, integração de cobrança/assinatura, identificação alternativa, aplicação conjunta do calendário, funcionalidades acadêmicas e demais pendências continuam abertas. Ensaio no navegador continua não executado para os novos fluxos de reserva/preparação; nenhuma homologação de produção ou envio externo foi realizado.


## Incremento 174 — Conferência histórica da alçada de desconto, 12/09/2026

Novas preparações registram análise separada de taxa e serviço, contra as referências capturadas e os limites atuais do preparador. Guarda limite, referência, valor proposto, desconto acumulado e resultado por componente: dentro da alçada, exige aprovação ou referência insuficiente. Referência ausente/duplicada ou moeda divergente não é tratada como desconto autorizado. Hora particular não herda o limite de mensalidade; desconto sem limite próprio exige aprovação conforme regra existente. Valores não são alterados nem cobranças criadas por essa análise.

A revisão da proposta exibe a análise histórica. Alterar preço/limites depois não reescreve o registro; preparações anteriores sem análise mostram pendência. Estar dentro da alçada de preço não comprova conferência do cadastro, aceite do contrato, pagamento ou ativação. Decisão de exceção comercial ainda precisa de fluxo próprio e não foi simulada como aprovação geral.

Passaram três testes unitários novos, 28 testes de integração de reservas/preparação, TypeScript, ESLint e build (43 páginas estáticas). Casos cobrem limites distintos, desconto acumulado, centavo acima do limite, particulares sem herança da alçada mensal, referências insuficientes e preservação da consulta após alterar limites/preços. Sem migration. Regressão integral mais recente permanece no incremento 173. Pendentes decisão comercial independente, conferência da Secretaria, emissão financeira, assinatura e ensaio no navegador.


## Incremento 175 — Decisão independente de exceção de preço, 12/09/2026

Adicionada DecisaoPrecoPreparacao imutável, vinculada à preparação, com aprovador, resultado e motivo. Banco impede autoaprovação e alteração/exclusão. A ação exige Gerência Comercial/Administração, carteira vigente da equipe para gerentes, outra pessoa, matrícula em preparação e análise de alçada registrada. Propostas originadas por gerente/admin exigem Administração; a exigência é registrada na preparação e registros antigos sem informação não dispensam direção por inferência.

Aprovação por gerente confere seus limites atuais contra as referências históricas, separando componentes; referência insuficiente ou alçada acima do permitido exige Administração. Mudança de alçada do gerente depois da preparação também encaminha à Administração, conforme regra existente. Reenvio idêntico não duplica decisão. Preparação sem exceção de preço não é submetida a aprovação adicional por esta ação. A decisão não cobra, ativa, altera preço proposto ou substitui conferência da Secretaria. A revisão mostra decisões registradas; controles interativos para decidir ainda pendentes.

Passaram 30 testes de integração de reservas/preparação, TypeScript e ESLint do trecho. Casos novos verificam autoaprovação, alçada insuficiente do gerente, decisão válida de gerente/Administração, repetição, imutabilidade e ausência de cobrança/ativação. Migration 20260912070000_decisao_preco_preparacao aplicada somente no banco descartável (84 migrations); schema sem divergências. Último build permanece no incremento 174. Ainda faltam interface da decisão, consumo da aprovação na conferência/emissão financeira, alternativas para referência antiga sem análise e validação interativa.


## Incremento 176 — Interface de decisão da exceção de preço, 12/09/2026

A revisão comercial passou a oferecer aprovação/rejeição de exceção com motivo. Consulta calcula capacidades por acesso da equipe, papel atual, independência do preparador, exigência de direção, estado da matrícula, decisão existente e análise de alçada. Gerente que pode rejeitar mas não aprovar recebe indicação de encaminhamento à Administração. Consulta operacional pela Secretaria não concede decisão fora da equipe mesmo quando a pessoa acumula papel de gerente. IDs usados internamente para conferir escopo/preparador não são projetados como dados da revisão.

Formulário chama a ação transacional já implementada, mantém motivo em tentativa incerta e atualiza o histórico após sucesso. Decisão concluída retira os comandos. Aprovar preço não é apresentado como aprovação geral, cobrança ou ativação.

Passaram 30 testes de integração (casos ampliados de capacidades antes/depois, alçada insuficiente, papel acumulado fora da equipe e histórico), TypeScript, ESLint do trecho, diff --check e build com 43 páginas estáticas. Sem migration. Ensaio interativo não executado. Ainda falta integrar preço permitido/decisão à conferência da Secretaria e emissão financeira, além dos demais fluxos documentais e acadêmicos pendentes.

## Incremento 177 — Preço autorizado na confirmação e ativação, 12/09/2026

Confirmação contratual pela Secretaria e validação do aceite na ativação agora consultam a preparação comercial. Exceção pendente, decisão rejeitada ou análise ausente/inválida bloqueiam o avanço. Preço dentro da alçada registrada dispensa decisão adicional; aprovação independente válida libera apenas esta conferência. Aceite, documento, pagamentos e demais requisitos continuam exigidos pelas respectivas etapas. Matrículas legadas sem preparação seguem suas validações existentes.

A conferência usa o registro histórico imutável e a decisão vinculada, dentro da transação do chamador com matrícula bloqueada. Não recalcula o desconto com tabela atual e não altera a proposta, cobranças ou estado da matrícula. Não substitui a futura conferência integral da Secretaria nem a emissão inicial aprovada em Q112/Q119.

Validação: 38 testes de integração nos arquivos de reservas/preparação e ativação, TypeScript e ESLint do trecho passaram. Casos novos cobrem preço pendente, rejeitado, aprovado sem aceite, preço dentro da alçada e caminho legado. Sem migration ou alteração em produção. Último build permanece no incremento 176; validação interativa deste incremento não realizada. Pendentes conferência completa, emissão inicial, revisão de preparação rejeitada/antiga e integração documental, além das demais frentes da SPEC.

## Incremento 178 — Regras de entrada por oferta (Q100/Q105), 12/09/2026

ProdutoPais passa a registrar taxa prévia à assinatura, exigência de adiantamento por hora e versão da configuração. Valores inicialmente nulos representam ausência de definição, nunca dispensa implícita. Administração configura pelo catálogo, com motivo, conferência do papel atual e versão esperada para impedir edição perdida. Auditoria preserva antes/depois. A configuração não informa nem presume valor/horas do adiantamento: esses dados ainda dependem da conferência contratual.

A preparação comercial captura a política vigente sob bloqueio da oferta e guarda-a em seu registro imutável. Consulta e página de revisão mostram a política histórica; alterar o catálogo não substitui as condições da preparação existente. Preparação antiga sem política mostra pendência. Ainda é possível preparar rascunho com regra indefinida; isso não autoriza emissão, assinatura ou ativação. O consumo dessas regras no futuro fluxo documental/financeiro, a revisão de preparações existentes e a conferência integral seguem pendentes.

Migration 20260912080000_politica_entrada_oferta aplicada somente ao banco descartável local (85 migrations), Prisma gerado e schema sem diferenças. Passaram 34 testes de integração de reservas/preparação, TypeScript e ESLint do trecho. Teste novo cobre acesso administrativo, revogação, versão desatualizada, configuração explícita, histórico preservado após alteração, auditoria e ausência de cobrança. A primeira execução revelou falta de mock de cache Next no teste; adicionada simulação apenas de revalidatePath e repetição passou. Ensaio interativo permanece pendente.

Build do incremento 178 concluído com sucesso: compilação, TypeScript e geração de 43 páginas estáticas. diff --check sem erros. Este resultado não substitui ensaio interativo nem comprova as etapas ainda pendentes.

## Incremento 179 — Regra mensal de entrada preservada na ativação, 12/09/2026

Preparações novas capturam também exigirPrimeiraMensalidade da configuração institucional, dentro da transação. A revisão mostra essa condição. A ativação mensal com preparação passa a usar a regra histórica, em vez da configuração atual: mudar de exigir para dispensar ou no sentido contrário não modifica a negociação já registrada. Snapshot incompleto exige revisão, sem preencher retroativamente por inferência. Fluxo legado sem preparação conserva a validação anterior.

Ativação antiga agora recusa explicitamente preparação por hora antes de procurar mensalidade; criar uma mensalidade não permite contornar o regime. Isto é uma proteção de transição, não implementação da ativação por hora. Ainda faltam a conferência completa, condições explícitas de adiantamento/horas, emissão inicial, atualização autorizada de preparações antigas e ativação própria do novo fluxo.

Passaram 43 testes de integração (reservas/preparação e ativação), TypeScript e ESLint do trecho. Quatro casos novos cobrem preservação da exigência mensal nos dois sentidos, regra ausente após edição da oferta e rejeição pública de ativação por hora no caminho mensal. Sem migration. Build anterior: incremento 178; ensaio interativo pendente.

## Incremento 180 — Adiantamento por tempo identificado na preparação (Q100/Q94), 12/09/2026

Preparação por hora aceita minutos de antecipação. Se a oferta exige adiantamento, omitir a quantidade impede a preparação, com rollback. Mensalidade fixa não aceita esse campo. O servidor calcula minutos × preço horário proposto ÷ 60 com Decimal, arredondando apenas o resultado monetário em duas casas (half-up), sem arredondar o tempo para cima. Valor nulo, negativo ou acima da capacidade monetária não gera proposta. O registro guarda minutos, unidade de 60 minutos, preço unitário, total e método de arredondamento na preparação imutável.

Formulário comercial oferece a quantidade somente no regime por hora; revisão mostra quantidade e total. Reenvio idêntico preserva o registro; alterar quantidade com a mesma chave é recusado. Não gera cobrança, compra/saldo de horas ou recebimento. Aprovação de preço unitário continua sujeita à alçada existente; conferência completa do serviço antecipado, vencimento, emissão, contrato e ativação ainda precisam ser integrados.

Passaram dois testes unitários e 39 testes de integração de reservas/preparação, TypeScript e ESLint do trecho. Cobertura inclui fração de hora, arredondamento somente monetário, limites, regime incompatível, adiantamento obrigatório, rollback, consulta e idempotência. Sem migration. Ensaio interativo pendente.

Build do incremento 180 passou, incluindo TypeScript e geração de 43 páginas estáticas. diff --check sem erros. Não realizado ensaio interativo.

## Incremento 181 — Regressão integral e correção dos testes, 12/09/2026

Executada a suíte unitária completa e a integração completa, esta em processo único contra o banco descartável. A primeira execução unitária apresentou 12 falhas porque a simulação de Prisma da conclusão ainda não incluía PreparacaoComercialMatricula. Corrigida a simulação de registro ausente para os casos legados, sem contornar a política, e acrescentados dois testes no caminho público de ativação para exigir/dispensar a mensalidade conforme snapshot mesmo com configuração oposta. Resultado final: 699 unitários aprovados em 74 arquivos, nenhum pendente.

Integração completa: 519 de 520 aprovados, uma falha na projeção docente. O teste buscava 84000/85000 em toda a serialização e um CUID continha 84000. Consulta inspecionada: financeiro null, matrículas financeiras vazias, campos privados removidos. Corrigida a checagem para comparar valores financeiros nas folhas, mantendo a busca dos marcadores privados; fixture agora possui ID com ambas as sequências para reproduzir o problema. Repetição isolada do arquivo passou 7/7. Não houve segunda execução integral, portanto não registrar como uma execução integral 520/520.

TypeScript passou; ESLint completo sem erros e três avisos já existentes (FinanceiroPainel/Sidebar). ESLint e TypeScript após a correção também passaram. Evidência compacta por arquivo, falha original e reteste em docs/validacao-regressao-181-2026-09-12.json. Build mais recente: incremento 180. A regressão automatizada não comprova execução interativa nem encerra as funcionalidades pendentes da SPEC.

## Incremento 182 — Pagador identificado por preparação/matrícula (Q88/Q113), 12/09/2026

Adicionado PagadorPreparacaoMatricula, com tipo ALUNO/RESPONSAVEL/EMPRESA, dados históricos, autoria, versão, motivo e chave de idempotência. Registro pertence a uma única matrícula, sem editar AlunoResponsavel ou cadastrar autorização acadêmica/portal. Para aluno pagador, a ação captura a identidade do próprio aluno da matrícula; responsável/empresa têm identificação explícita. Dados ainda incompletos não são declarados suficientes para emissão ou assinatura.

Secretaria/Administração registra após assumir uma matrícula com preparação comercial. Papel é conferido novamente na transação. Versão esperada impede edição perdida; histórico é imutável no banco, correção anterior à formalização cria nova versão. Contratação com cobrança ou aceite não aceita essa alteração simples. Consulta restrita à Secretaria/Financeiro/Administração retorna a versão atual, sem hashes internos. Não há inferência de responsável legal ou signatário a partir do pagador.

Passaram 40 testes de integração de reservas/preparação, TypeScript e ESLint. Caso novo cobre assunção, vendedor sem permissão, idempotência, versões, preservação do aluno e de outro contrato, imutabilidade e bloqueio após aceite. Migration 20260912090000_pagador_preparacao aplicada somente no banco descartável (86 migrations); schema conferido sem diferenças. Último build: 180. Ainda faltam interface de preenchimento/revisão, conferência suficiente para cobrança/documento, consumo financeiro, vínculo de signatários conforme modelo e alteração documental do pagador já formalizado.

## Incremento 183 — Interface de pagador por matrícula, 12/09/2026

Secretaria tem acesso à tela /matriculas/[id]/pagador pelo painel. A página apresenta registro atual, identificação, motivo e autoria, diferenciando campos pendentes. Formulário registra aluno (cópia do cadastro correspondente), responsável ou empresa com país e dados explícitos. Nova versão preserva a anterior; chave da tentativa é conservada em resultado incerto. Página é restrita à Secretaria/Financeiro/Administração; Financeiro somente consulta. Sem assunção, preparação ou condições para editar, a tela explica o impedimento e não apresenta formulário.

Consulta de contexto executa leitura consistente e calcula a capacidade de edição pelo estado/papel, sem expor chave/hash. O servidor de gravação mantém a revalidação própria, não depende da tela. Cadastro de pagador não define signatário, não dá acesso acadêmico e não comprova conferência documental suficiente.

Passaram 40 testes de integração de reservas/preparação, com casos ampliados para consulta negada ao vendedor, Secretaria habilitada, Financeiro em leitura e bloqueio após aceite; ESLint do trecho sem erros. Sem migration. Ensaio interativo não realizado. Ainda faltam histórico navegável das versões, conferência suficiente, emissão e vínculo dos participantes exigidos pelo modelo contratual.

Build do incremento 183 aprovado, incluindo TypeScript, rota de pagador e geração de 43 páginas estáticas. diff --check sem erros.

## Incremento 184 — Histórico navegável de pagadores, 12/09/2026

A tela de pagador permite consultar versões anteriores com identidade registrada, tipo, motivo, autoria e instante em UTC. Consulta restrita à Secretaria/Financeiro/Administração, filtrada pela matrícula, com 20 versões por página, ordenação decrescente e indicador de próxima página. Hashes e chaves de operação não são retornados. Navegar no histórico não restaura versão nem muda o pagador atual.

Passaram 41 testes de integração de reservas/preparação, TypeScript, ESLint e build (43 páginas estáticas). Casos verificam acesso negado ao vendedor, separação entre matrículas, ordenação, página inválida/vazia e limite de 21 versões dividido em duas páginas sem perdas/repetição. Sem migration; ensaio interativo pendente. Conferência suficiente, cobrança, participantes do contrato e alteração após formalização continuam em implementação.

## Incremento 185 — Pendências consolidadas da preparação, 12/09/2026

Revisão comercial passou a mostrar à Secretaria/Administração um diagnóstico consistente de estado/assunção, preparação, preço autorizado, regras históricas de entrada, presença de pagador e reserva/agenda. Conferência de disponibilidade considera a reserva da própria contratação como sua vaga, mantendo outras reservas e alocações na capacidade. Prazo vencido ou reserva mantida gera pendência; janela encerrada indica necessidade de decisão pedagógica específica, sem concedê-la.

Diagnóstico é leitura, não autorização de emissão ou confirmação contratual. Não declara identificação/documento completo apenas por existir registro do pagador. Mantém explícitas as etapas seguintes de conferência de documentos, cobrança e participantes. Ações futuras precisam revalidar o estado sob bloqueio; esta consulta não é utilizada como token de aprovação. Vendedor não acessa esse diagnóstico operacional pela ação ou página.

Passaram 42 testes de integração de reservas/preparação e ESLint do trecho. Caso novo cobre capacidade com a própria última vaga reservada, pendências reais, turma concluída, acesso negado e ausência de cobrança. Sem migration. Ensaio interativo e conferência/emissão completas ainda pendentes.

Build do incremento 185 aprovado, incluindo TypeScript e 43 páginas estáticas. diff --check sem erros. Último build validado: 185.

## Incremento 186 — Condições financeiras de entrada explícitas, 12/09/2026

Criado CondicoesEntradaPreparacao, imutável e versionado por matrícula, com autoria/motivo/idempotência. Secretaria/Administração registra após assunção, preço permitido e seleção da versão atual do pagador. Preserva proposta, pagador, valores/moeda e política histórica; não substitui valores pela tabela atual. Condições sem cobrança/aceite podem receber nova versão, com controle de edição concorrente; formalização prévia exige revisão própria.

Mensalidade registra cobertura civil/ciclo, primeiro vencimento e dia contratual de 1 a 31 separadamente; calcula período pelos dias reais. Hora registra vencimento apenas se há antecipação proposta, não cria mensalidade nem presume adiantamento. Regra histórica incompleta impede o registro. Trata-se de preparação das condições, não autorização de emissão ou comprovação de documento/assinatura. Ainda faltam interface, conferência conjunta válida, emissão inicial e consumo na ativação; a programação recorrente e o ajuste financeiro por dia não útil não são inferidos desta etapa.

Passaram 44 testes de integração de reservas/preparação, TypeScript e ESLint. Casos novos cobrem ambos os regimes, pagador divergente, repetição, alteração com mesma chave, preservação de referências, ciclo mensal iniciado em 31, imutabilidade, acesso e ausência de cobrança. Migration 20260912100000_condicoes_entrada_preparacao aplicada apenas no banco descartável (87 migrations); schema sem diferenças. Último build validado: 185; ensaio interativo pendente.

## Incremento 187 — Interface de condições de entrada, 12/09/2026

Painel da Secretaria oferece /matriculas/[id]/condicoes. Página apresenta última versão, autor/motivo, vencimento da taxa e, conforme regime, cobertura/primeiro vencimento/dia contratual ou vencimento do adiantamento. Formulário sem datas presumidas registra nova versão pela ação transacional existente. Financeiro consulta sem editar; Secretaria/Administração recebe formulário conforme estado, assunção, pagador e preço permitido. Validações completas permanecem no servidor.

Consulta tipada não projeta hashes/chaves. Mostra alerta quando a versão do pagador mudou depois de registrar condições; referência anterior permanece preservada. Campo de vencimento do adiantamento só aparece se existe antecipação proposta. Página informa que preparação das condições não emite cobrança nem confirma aceite. Extraído schema de entrada compartilhável sem alterar o contrato da ação.

Passaram 44 testes de integração de reservas/preparação com casos ampliados de consulta mensal/hora, Financeiro em leitura, vendedor negado e detecção de pagador alterado; ESLint do trecho aprovado. Sem migration. Ensaio interativo, conferência conjunta final, emissão e ativação integradas ainda pendentes.

Build do incremento 187 aprovado, incluindo TypeScript, rota de condições e 43 páginas estáticas. diff --check sem erros. Ensaio interativo não realizado.

## Incremento 188 — Plano das cobranças iniciais (Q112/Q119), 12/09/2026

Adicionado planejador tipado das cobranças a partir das condições históricas: taxa na conferência; primeira mensalidade nessa etapa quando pagamento prévio é exigido, ou na ativação quando dispensado. Particular por hora sem antecipação não gera mensalidade ou adiantamento; antecipação identificada conserva minutos/valor/vencimento e entra na conferência. Calcula cobertura sem derivá-la do vencimento e conserva mensalidade integral. Divergência de valor/tempo da antecipação ou regra incompleta impede a prévia.

Página de condições apresenta itens, valores, datas, cobertura/tempo e etapa prevista. Consulta não emite cobrança, não confirma recebimento e não dispensa conferir pagador, documentação, disponibilidade ou versões. Planejador será consumido pelo emissor transacional com revalidação/idempotência; essa emissão ainda está pendente.

Passaram cinco testes unitários novos e 44 testes de integração de reservas/preparação, além de ESLint. Cobertura unitária distingue ambos os gatilhos mensais, hora sem antecipação, fração horária, divergências e configuração incompleta. Sem migration; ensaio interativo pendente.

Build do incremento 188 aprovado, com TypeScript e geração de 43 páginas estáticas. diff --check sem erros.

## Incremento 189 — Executor transacional das cobranças iniciais, 12/09/2026

Criado EmissaoCobrancasEntrada, imutável e único por matrícula/etapa, ligado às condições, executor e memória dos itens. Banco confere pertencimento das condições à matrícula. Primitiva interna emitirEntradaTx executa o plano de Q112/Q119, conserva valores de referência/negociados e períodos, registra saldo devido sem recebimento, e preserva o fuso institucional usado no vencimento civil.

Revalida papel, condições/pagador atuais, preço autorizado e, na etapa da Secretaria, reserva/agenda. Reenvio da etapa com as mesmas condições retorna a emissão existente; outras condições ou cobranças fora do fluxo exigem conferência. Emissão e evento pertencem à transação do chamador, com rollback integral. Não ativa matrícula, marca pagamento ou envia mensagem. Etapa de ativação exige estado ATIVA e emissão anterior da conferência.

IMPORTANTE: executor interno ainda não é Server Action pública nem foi ligado ao botão de conferência. O chamador futuro precisa conferir cadastro/documentos e autorização da etapa na mesma transação. Esta primitiva não deve ser apresentada como conferência documental pronta. Integração pública, tela de confirmação final, ativação completa e fluxo de hora ainda pendentes.

Passaram 46 testes de integração de reservas/preparação, TypeScript e ESLint. Casos novos exercitam exigência mensal nos dois sentidos, falha após emissão com rollback, repetição sem duplicar, valor ainda não recebido, fuso do vencimento, vendedor negado e imutabilidade. Migration 20260912110000_emissao_cobrancas_entrada aplicada somente no banco descartável (88 migrations); schema sem diferenças. Não executado novo build (último: 188) ou ensaio interativo.

## Incremento 190 — Conferência explícita e emissão inicial, 12/09/2026

Criada ação autenticada conferirEEmitirEntrada, da Secretaria/Administração, exigindo revisão identificada por hash, confirmações explícitas de cadastro/documentos e condições, motivo e chave idempotente. Consulta carrega aluno, pagador, condições, proposta, documentos da matrícula e reserva em snapshot consistente. Identificação/contato do pagador são exigidos; documento ausente/inválido gera aviso de conferência, conservando a regra já existente de documento que avisa sem bloquear automaticamente. Não é validação jurídica ou assinatura de contrato.

Na confirmação, servidor bloqueia estado, revalida papel e hash, invoca executor de emissão e grava ConferenciaEmissaoInicial na mesma transação. Alteração desde a revisão exige nova consulta. Registro preserva snapshot/avisos/autoria e fica imutável; banco confere vínculo da emissão à matrícula e etapa. Reenvio idêntico não duplica cobranças nem conferência. Outra tentativa após emissão orienta consulta do registro existente. Não confirma pagamento nem ativa matrícula.

Passaram 47 testes de integração de reservas/preparação, TypeScript e ESLint. Caso novo verifica confirmação explícita, revisão desatualizada, vendedor negado, emissão de taxa sem mensalidade antecipada quando dispensada, repetição, imutabilidade e ausência de recebimento/ativação. Migration 20260912120000_conferencia_emissao_inicial aplicada apenas no banco descartável (89 migrations); schema sem diferenças. Interface da conferência pública ainda pendente, assim como assinatura, ativação completa e ensaio interativo. Último build: 188.

## Incremento 191 — Interface da conferência e emissão inicial, 12/09/2026

Secretaria acessa /matriculas/[id]/emissao pelo painel. Revisão apresenta aluno, pagador, documentos anexados à matrícula, avisos e plano das cobranças, distinguindo itens desta confirmação dos previstos na ativação. Exige duas confirmações explícitas e motivo; usa hash da revisão e chave da tentativa na ação transacional implementada. Resultado incerto conserva a chave. Anexos somente viram links quando usam rota de arquivo do ERP ou protocolo HTTP(S).

Após emissão, consulta apresenta registro da conferência, autor/motivo e valores originalmente emitidos, sem novo botão de confirmação. Pagamentos/ajustes continuam no Financeiro; interface não declara taxa recebida, assinatura concluída ou matrícula ativa. A página é restrita à Secretaria/Administração. Consulta de tela tem projeção específica e não envia o snapshot completo ao componente cliente.

Passaram 47 testes de integração de reservas/preparação, com casos ampliados para estado de revisão, dados visíveis, vendedor negado e resultado emitido; ESLint do trecho aprovado. Sem migration. Ensaio interativo não realizado. Ainda pendentes assinatura integrada, ativação completa, recorrência e demais frentes aprovadas da SPEC.

Build do incremento 191 aprovado com TypeScript e geração de 43 páginas estáticas, incluindo a rota de emissão. diff --check sem erros.


## Incremento 192 — Integridade dos itens de emissão inicial, 12/09/2026

Adicionado ItemEmissaoEntrada: cada cobrança emitida possui vínculo relacional imutável com a emissão e a mesma matrícula. Chaves estrangeiras compostas impedem excluir a cobrança ou movê-la para outra matrícula; trigger impede alterar/remover o vínculo e incluir cobrança ausente da memória da emissão. O executor grava os vínculos na mesma transação das cobranças, emissão e conferência.

Migration 20260912130000_itens_emissao_entrada reconstrói vínculos somente a partir dos IDs já presentes na memória; referências inválidas fazem a operação falhar, sem inventar histórico. A primeira tentativa local falhou porque faltava a restrição composta exigida pelo Prisma; schema e migration foram corrigidos, a tentativa falha marcada como revertida e a migration reaplicada exclusivamente no banco descartável. Banco local com 90 migrations; comparação Prisma sem diferenças. Nenhuma migração em produção.

Passaram 47 testes de integração de reservas/preparação, TypeScript, ESLint do trecho e diff --check. Casos mensais nos dois regimes de pagamento ampliados para conferir contagem dos vínculos, exclusão de cobrança recusada, troca de matrícula recusada e imutabilidade dos itens. Não foi repetida a regressão completa nem o ensaio interativo; último build aprovado continua sendo o incremento 191. Assinatura, ativação completa e demais frentes permanecem pendentes.


## Incremento 193 — Governança de modelos contratuais (Q104/Q114/Q115), 12/09/2026

Criadas versões imutáveis de modelo e decisão independente. Secretaria/Administração propõe família/código e nova versão com título, finalidade contrato/aditivo, regimes, descrição de aplicação, seções em texto simples, campos declarados e regras de papéis/condições de assinatura. Campos não declarados, expressões e duplicações são recusados. Não há cláusula jurídica ou percentuais preenchidos pelo sistema.

Outra pessoa da Administração aprova/publica ou rejeita o conteúdo identificado por hash. Acúmulo de papéis não permite autoaprovação; banco também protege essa separação e a imutabilidade. Nova versão não altera conteúdo nem decisão anteriores. Consulta paginada da família preserva todas as versões e decisões, sem chaves idempotentes. Preparação usa controle da versão esperada e bloqueios para serializar versões e reenvios. Proposta e decisão registram eventos na própria transação.

Migration 20260912140000_modelos_contratuais aplicada apenas no banco descartável (91 migrations). Seis testes de integração passaram: publicação independente, reenvio, concorrência, hash divergente, versões/rejeição preservadas, proibição de autoaprovação inclusive no banco, papéis/revogação e validação estrutural. A primeira execução da disputa por Server Actions esbarrou na resolução concorrente do mock de autenticação do ambiente; o teste passou a disputar a primitiva transacional com autor real no Postgres e conferir o reenvio pela ação autenticada.

Limites: interface dos modelos, resolução dos campos/participantes e condições de aplicação, seleção de versão para a matrícula, PDF, assinatura integrada, aditivos e ativação nova continuam pendentes. Descrição de aplicação não é motor automático de elegibilidade. A publicação desta base não gera documento nem libera assinatura. Conteúdo institucional real deverá ser inserido pela escola. Sem ensaio interativo ou novo build; último build: 191.

Validação complementar do incremento 193: TypeScript e ESLint aprovados; comparação Prisma sem diferenças no banco descartável; diff --check sem erros.


## Incremento 194 — Interface de modelos contratuais, 12/09/2026

Adicionadas /configuracao/contratos, /novo e /[codigo]: listagem paginada de famílias; formulário de seções, campos declarados, aplicação e regras de assinatura; histórico paginado com conteúdo integral e decisão/autoria; preparação de nova versão copiando a última. Código e versão esperada são conferidos no servidor. Formulário conserva tentativa quando há resultado incerto; reenvio não duplica proposta.

Administração distinta do preparador vê decisão de publicar/rejeitar com motivo e conferência explícita; servidor mantém os controles do incremento 193. Conteúdo é apresentado como texto escapado, sem HTML executável. Secretaria tem somente a nova aba de configuração nos seus papéis; página de configuração de turmas ganhou guard próprio com papéis frescos antes das consultas, preservando o acesso pedagógico/administrativo ao ampliar o layout para modelos. Outras páginas de configuração conservam seus guards.

Sete testes de integração aprovados, incluindo paginação de 21 famílias e 21 versões, projeção mínima da listagem e consulta negada para vendedor/professor. Build aprovado com TypeScript e geração de 45 páginas estáticas, incluindo as três rotas novas. ESLint dos trechos e diff --check aprovados. Sem migration. Sem ensaio interativo de navegador nesta entrega; build não substitui esse ensaio.

Ainda pendentes: resolução dos campos e participantes da matrícula, aplicação/seleção do modelo, geração de PDF protegido, assinatura integrada, aditivos, ativação completa e outras frentes da SPEC. Nenhum contrato real foi gerado ou enviado.


## Incremento 195 — Preenchimento controlado e prévia contratual preservada, 12/09/2026

Campos do modelo podem indicar origem tipada: identificação do aluno/pagador, moeda/regime e valores/datas/tempo das condições de entrada. Formulário e revisão mostram essa origem; versões históricas sem origem não são alteradas e bloqueiam a geração quando contêm campo não resolvido. Resolver substitui títulos e seções em uma única passagem, sem executar expressões nem reinterpretar dados cadastrais como modelo. Informação exigida ausente é erro, não valor presumido.

Consulta autenticada da Secretaria/Administração monta a prévia exclusivamente com dados do servidor: matrícula em preparação assumida, modelo publicado compatível com regime/finalidade, preço autorizado, pagador e condições atuais. Aditivos não usam essa entrada. Registro exige hash revisado, confirmação de aplicação e motivo; bloqueia mudanças entre consulta e confirmação, preserva origem, valores, texto, modelo/publicação e condições no snapshot imutável de PreviaDocumentoContratual. Reenvio idêntico retorna registro anterior. Consulta histórica não refaz o documento a partir do cadastro atual.

Migration 20260912150000_previas_contratuais aplicada somente ao banco descartável (92 migrations). Banco verifica modelo publicado, pertencimento das condições à matrícula e imutabilidade. Passaram três testes unitários e 55 testes de integração em duas suítes (48 reservas/preparação e sete modelos). Teste integrado novo cobre modelo não publicado, revisão desatualizada, texto/valor resolvidos, reenvio, preservação após alteração cadastral, vendedor negado e ausência de documento aceito/cobrança/ativação. TypeScript, ESLint e diff --check aprovados; schema local sem diferenças.

Limites: prévia é conteúdo estruturado preservado, ainda sem arquivo PDF, signatários individualmente resolvidos ou liberação para assinatura. Interface de geração/consulta da prévia por matrícula ainda pendente. Fontes adicionais (por exemplo, continuidade, multas, dados institucionais e participantes) precisam ser integradas aos registros correspondentes; não são inventadas nem inferidas de texto livre. Completar contrato, assinatura, aditivos, ativação e demais frentes continua obrigatório.

Build do incremento 195 aprovado com TypeScript e geração de 45 páginas estáticas. Ensaio interativo não realizado.


## Incremento 196 — Interface de prévias por matrícula, 12/09/2026

Adicionadas rotas /matriculas/[id]/contrato e /contrato/previas/[previaId], restritas à Secretaria/Administração. Painel lista versões publicadas compatíveis com finalidade e regime e histórico específico da matrícula, com paginações independentes. Consulta é consistente e devolve projeções mínimas das listas. Aplicação adicional do modelo continua exigindo conferência humana explícita, sem inferir elegibilidade completa apenas do regime.

Equipe escolhe modelo, lê texto e origem dos campos preenchidos e registra a prévia com motivo, confirmação e hash atual. Resultado conduz ao conteúdo histórico imutável. Tela não permite editar cláusulas durante o preenchimento, nem apresenta prévia como assinatura. Consulta histórica valida a matrícula da rota e usa o snapshot original. Formulário mantém chave no reenvio incerto. Painel comercial oculta os links de pagador/condições/emissão/prévia quando o usuário não atua como Secretaria; os guards de servidor permanecem.

Passaram 48 testes de integração da preparação/reservas, ampliados para lista sem modelo não publicado, modelo publicado disponível, histórico isolado por matrícula, projeções sem conteúdo/snapshot desnecessário e vendedor negado. ESLint dos trechos e build com TypeScript/45 páginas aprovados. Ajuste final de visibilidade do painel conferido separadamente por TypeScript. Sem migration. Ensaio interativo de navegador ainda pendente.

PDF protegido, fontes contratuais adicionais, signatários individualizados, assinatura integrada, aditivos e ativação completa seguem pendentes. Nenhum documento foi enviado ou contrato real assinado.


## Incremento 197 — Exigências condicionais de assinatura (Q115/Q122), 12/09/2026

Planejador interpreta cada regra do modelo como exigida, não aplicável ou pendente de conferência. Considera o tipo de pagador registrado; empresa pagadora não se torna representante legal. Maioridade é classificação explícita segundo regra aplicável, sem presumir idade legal universal a partir do nascimento. No fluxo atual essa conferência ainda não está registrada: maioridade permanece desconhecida e regras dependentes geram pendência.

Papéis exigidos são listados sem duplicação, mantendo memória de todas as regras; lado do cliente antecede escola quando esta é exigida. Modelo que não exige cliente no caso concreto gera pendência de revisão. Planejamento não identifica pessoas, não confere poderes de representação, não envia convites nem comprova assinaturas.

Plano e contexto passam a compor o snapshot da prévia. Interface mostra etapas e pendências; prévias históricas sem esse registro exibem ausência de planejamento sem recalculá-las ou sobrescrevê-las. O registro da prévia segue permitido como preparação, inclusive com pendências; liberação efetiva para assinatura ainda não implementada e não é autorizada por esta etapa.

Oito unitários (cinco novos de assinatura e três de preenchimento) aprovados; build com TypeScript/45 páginas e ESLint aprovados. Sem migration ou ensaio interativo. Conferência/identificação de participantes, PDF, integração de assinatura, aditivos e ativação completa continuam pendentes.

Integração do incremento 197: 48 testes de reservas/preparação aprovados, incluindo preservação do plano de signatários no snapshot e consulta histórica. diff --check sem erros.


## Incremento 198 — Conferência versionada de participantes, 12/09/2026

Ação conferirParticipantesContratuais exige Secretaria/Administração, prévia vigente, versão esperada, confirmação de identificação e motivo. Recalcula exigências com maioridade explicitamente conferida quando informada (critério e evidência documental obrigatórios) e tipo do pagador registrado. Regras pendentes ou ausência de participante do cliente bloqueiam a conferência completa. Exige exatamente os papéis do modelo aplicável.

Identidade do aluno e de responsável financeiro não empresarial deve coincidir com nome/documento/e-mail do cadastro ou snapshot do pagador; divergências e dados ausentes são recusados. Para os demais representantes identifica pessoa natural com descrição de representação e documento da contratação. Evidência deve estar disponível e pertencer diretamente à matrícula ou exclusivamente ao seu lead; documento vinculado a outra matrícula não é aceito por compartilhar lead. Trata-se de conferência humana registrada, não de validação jurídica automática nem verificação de identidade pelo provedor.

ConferenciaParticipantesContratuais preserva contexto, plano, pessoas, etapas, evidências, autor e motivo em versões imutáveis por prévia. Chave idempotente evita duplicação; versões concorrentes/desatualizadas são recusadas. Consulta paginada é restrita às mesmas funções e não retorna chaves/hashes internos de tentativa. Eventos mantêm referências e papéis sem repetir identificações completas.

Migration 20260912160000_participantes_contratuais aplicada somente no banco descartável (93 migrations), schema conferido. 48 testes de integração aprovados, com caso ampliado de papéis ausentes, representação sem prova, documento alheio, identidade divergente, registro/reenvio, versão desatualizada, histórico imutável e vendedor negado. Após ajuste final do vínculo documental, caso afetado repetido com sucesso. TypeScript, ESLint e diff --check aprovados. Último build: 197; sem novo ensaio interativo.

Interface de conferência e consumo na liberação documental ainda pendentes. Não gera PDF, abre processo externo, verifica propriedade do e-mail ou confere assinatura. Cadastro dos signatários não concede acesso ao portal ou dados acadêmicos. PDF, fontes adicionais, assinatura integrada, aditivos e ativação completa continuam pendentes.


## Incremento 199 — Interface de conferência dos signatários, 12/09/2026

Prévia possui rota /participantes com classificação explícita de maioridade, atualização dos papéis, identidade do aluno/pagador em leitura, identificação de representantes, evidências, motivo e confirmação. Pendência de regra ou identidade incompleta impede envio do formulário. Consulta consistente verifica prévia atual e oferece apenas documentos da contratação; lista de evidências não envia URLs ao formulário. Anexos usam o uploader e a vinculação já autorizados da matrícula, categoria COMPROVANTE, sem novo acesso concedido.

Histórico paginado apresenta versões, autor, motivo, pessoas, fundamento da maioridade quando informado e nomes das evidências preservadas. Permanece consultável mesmo quando a prévia antiga já não permite nova conferência. A rota confere pertencimento da prévia à matrícula; acesso exclusivo da Secretaria/Administração. Envio mantém chave idempotente e usa a versão esperada do servidor.

Build com TypeScript e geração de 45 páginas estáticas aprovado, incluindo a nova rota; ESLint e diff --check aprovados. Sem migration. Interface compilada, mas ainda sem ensaio interativo de navegador, inclusive o envio de anexos por esta nova tela. PDF, fontes adicionais, integração/liberação de assinatura, aditivos e ativação completa seguem pendentes. Conferir participantes não comprova assinatura nem concede acesso acadêmico.

Integração do incremento 199: 48 testes aprovados, incluindo dados do formulário, versão atual após confirmação, ausência de URLs desnecessárias, exclusão de documento de outro contrato e vendedor negado.


## Incremento 200 — PDF protegido da prévia contratual, 12/09/2026

Gerador Node produz PDF A4 do snapshot preservado, com título/seções, fontes incorporadas, paginação e identificação explícita de prévia sem assinatura. PDFKit 0.20.2 e fontkit 2.0.4 foram fixados no lockfile; fontes Noto Sans oficiais e licença incluídas. Geração interrompe caracteres sem suporte, em vez de emitir glifo vazio; limite técnico de 250 mil caracteres limita uso de memória. Metadados usam data da prévia, e a mesma entrada produz bytes idênticos nesta versão do gerador.

Rota GET /api/matriculas/[id]/previas/[previaId]/pdf exige Secretaria/Administração e pertencimento à matrícula, com cache private/no-store. Link disponível na prévia preservada. Não usa dados atuais do aluno para refazer o texto. Fontes incluídas no standalone e presença dos dois arquivos conferida após build.

Validação: dois unitários, 48 testes de integração (incluindo PDF real, matrícula alheia 404, vendedor 403, cabeçalhos privados e bytes preservados após mudança cadastral), ESLint e build/TypeScript com 45 páginas aprovados. Script scripts/validar-pdf-previa.ts gerou demonstração fictícia de três páginas; todas foram renderizadas com Poppler e inspecionadas visualmente sem cortes/sobreposições. pypdf confirmou acentos, último trecho e numeração. Evidência/hashes em docs/validacao-pdf-previa-2026-09-12.json; arquivo output/pdf/previa-contratual-demonstracao.pdf.

Limite importante: este endpoint renderiza PDF de PRÉVIA. O arquivo contratual definitivo, persistido com versão do gerador e vinculado à liberação/assinatura, ainda precisa ser implementado; determinismo atual não garante bytes iguais após futuras mudanças de renderizador/fontes. Não cria Documento aceito nem processo externo. Fontes contratuais adicionais, liberação, assinatura, aditivos e ativação completa seguem pendentes. Ensaio interativo da rota no navegador não realizado. Sem migration ou produção.

Consulta técnica: https://pdfkit.org/docs/getting_started.html e https://pdfkit.org/docs/text.html; fontes: https://github.com/notofonts/noto-fonts. Auditoria npm desta instalação não aponta pdfkit/fontkit, mas registra 14 ocorrências gerais do projeto (incluindo críticas) ainda pendentes de tratamento; resumo em docs/validacao-dependencias-pdf-2026-09-12.json. Nenhum audit fix automático executado.

## Incremento 201 — Dependências corrigidas e regressão, 12/09/2026

Next.js atualizado de 16.2.9 para 16.3.5 e Auth.js de 5.0.0-beta.31 para beta.32, com @auth/core 0.41.3 e eslint-config-next alinhado. Atualizadas dependências compatíveis no lockfile. ExcelJS conserva 4.4.0 com override restrito de uuid 11.1.1; teste real de escrita/leitura XLSX cobre texto acentuado, número, data e formatação estendida que utiliza UUID v4. Não foi aplicado audit fix --force nem o downgrade sugerido para ExcelJS.

Auditoria npm passou de 14 ocorrências (3 críticas, 6 altas, 5 moderadas) para zero ocorrências conhecidas. Evidência: docs/validacao-dependencias-201-2026-09-12.json. Isso não substitui revisão de segurança do código e das configurações. Referências oficiais: https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36, https://github.com/nextauthjs/next-auth/security/advisories/GHSA-8fpg-xm3f-6cx3 e https://github.com/advisories/GHSA-w5hq-g745-h8pq.

Corrigido texto da entrada contratual para indicar PDF na prévia preservada. Cabeçalho da SPEC documental atualizado para separar componentes implementados de assinatura integrada e documento definitivo ainda pendentes. Não houve migration, produção ou importação de dados reais.

Validação final do incremento 201: 715 testes unitários e 536 de integração passaram, sem falhas ou pendentes. Build Next.js 16.3.5 e TypeScript aprovados, 45 páginas estáticas; fontes Noto Sans presentes no standalone. ESLint: zero erros e três avisos preexistentes (FinanceiroPainel/Sidebar). Diff check aprovado. Evidência por arquivo em docs/validacao-regressao-201-2026-09-12.json. O teste novo teve ajuste de tipagem antes da repetição integral dos unitários e do build; a integração integral passou na execução única. Ensaio interativo de navegador e integrações externas continuam pendentes.

## Incremento 202 — Original contratual preservado, 12/09/2026

ArtefatoContratual armazena bytes PDF, hashes do arquivo e da base conferida, versão do gerador, hashes das fontes, páginas, autor e motivo, ligado à prévia e à conferência dos participantes. A migration 94 impede update/delete e vínculo entre conferência e prévia incompatíveis. Armazenamento bytea transacional, limitado a 10 MiB por original: bytes e metadados são confirmados juntos, sem arquivo órfão em disco. Esse custo integra o banco e seus backups; não é uma estratégia de armazenamento de gravações.

A ação da Secretaria/Administração revalida preparação, modelo/condições/preço, prévia atual, última conferência, identidade atual do aluno/pagador e disponibilidade/integridade das referências documentais. Matrícula, aluno e evidências são bloqueados durante a conferência. Uma conferência já preservada retorna o original; nova conferência do mesmo conteúdo na mesma prévia também reutiliza os bytes, sem nova versão por repetição. Falha do renderizador registra evento sem criar original parcial; nova tentativa pode prosseguir. Alteração real exige conferência válida, preservando originais anteriores.

PDF original contém o conteúdo do modelo aprovado, com identificação documental, distinto do PDF de prévia. Não acrescenta cláusulas ou assinaturas fictícias. Rota /api/matriculas/[id]/originais/[artefatoId]/pdf retorna somente bytes preservados após autorização, conferência da matrícula e hash; divergência bloqueia abertura, sem regenerar silenciosamente. Cabeçalhos privados/no-store. Tela da prévia inclui geração com confirmação/motivo e histórico paginado com abertura do original.

Validação: 3 unitários do PDF e 48 integrações de reservas/contratação aprovados. Caso documental repetido após os ajustes finais, incluindo leitura corrompida simulada, bloqueio de conferência antiga/identidade alterada/evidência arquivada, falha seguida de tentativa bem-sucedida, deduplicação, imutabilidade, vínculo inválido no banco, matrícula alheia, vendedor negado e bytes inalterados após mudança cadastral. Build/TypeScript e lint dos arquivos alterados aprovados; schema local sem diferenças. Alerta do empacotador sobre leitura dinâmica foi corrigido com caminhos explícitos das fontes; build final sem esse alerta. PDF fictício de três páginas renderizado e inspecionado visualmente, com acentos e conteúdo conferidos por pypdf. Evidências em docs/validacao-original-202-2026-09-12.json e docs/validacao-pdf-original-2026-09-12.json.

Limites: original preservado ainda não é documento assinado/aceito e não ativa matrícula. Liberação com taxa/reserva e regras de assinatura, integração com fornecedor, substituição de processo já enviado, aditivos e ativação mensal/por hora continuam pendentes. Esta geração não confirma validade jurídica de representação ou propriedade do e-mail. Ensaio interativo do formulário no navegador não executado. Nenhuma produção, envio externo ou importação real.

## Incremento 203 — Conferência anterior à assinatura, 12/09/2026

Implementada revisão e confirmação interna pela Secretaria/Administração do original a encaminhar. Revalida integridade dos bytes, prévia/condições/preço, participantes atuais (incluindo evidências), conferência da emissão inicial, taxa vinculada e reserva/agenda/admissão. A regra de taxa vem das condições preservadas da matrícula: exigir confirmação integral quando configurado; dispensar pagamento prévio somente quando assim contratado. Alteração posterior da oferta não substitui essa política. Taxa cancelada ou com moeda/valor divergente bloqueia; informe a conferir não satisfaz recebimento exigido.

Reserva própria é descontada do cálculo de ocupação; ATIVA com prazo vencido bloqueia, e reserva MANTIDA_PENDENCIA continua ocupando vaga e exige viabilidade atual. Calendário, matrícula, aluno, cobranças e turma são conferidos sob os bloqueios aplicáveis. A revisão preserva regra da taxa, estado financeiro, reserva, janela e encontros/participantes; mudança desde a tela exige nova revisão. Assinatura após o limite ainda depende da integração de Q110: esta etapa não presume a exceção.

ConferenciaAssinaturaContratual registra autor, motivo, snapshot e hash; migration 95 proíbe atualização/exclusão. Repetição devolve o registro existente, sem novo efeito. Tela em /matriculas/[id]/contrato/originais/[artefatoId] mostra requisitos, pendência atual e histórico paginado. Registro histórico permanece consultável após dados mudarem. Dados de revisão não incluem PDF, URLs de evidências ou contratos alheios. Revalidação do original foi extraída para helper compartilhado com a geração.

Limite explícito: esta é a conferência para futura liberação, não o envio ao fornecedor. Retorno identifica envioRealizado=false; tela informa que ainda não houve envio/assinatura/aceite. Um executor futuro deve revalidar imediatamente antes de encaminhar o documento, sem tratar o registro como autorização permanente. Fornecedor, envio/retornos, substituição, aditivos, exceção Q110, agenda própria de particulares e ativação completa continuam pendentes. Sem produção ou envios externos; ensaio interativo da tela ainda pendente.

Validação do incremento 203: 49 testes de integração de reservas/contratação passaram, sem falhas ou pendentes, após corrigir os fixtures de forma de pagamento e simular vencimento pelo relógio sem violar o prazo mínimo do banco. Build Next.js 16.3.5/TypeScript e lint dos arquivos alterados aprovados; 95 migrations aplicadas somente no banco descartável e schema sem diferenças. Evidência em docs/validacao-assinatura-203-2026-09-12.json. Última regressão integral permanece a 201.

## Incremento 204 — Exceção de admissão Q110, 12/09/2026

Proposta e decisão pedagógica independente de ingresso após o limite vinculadas à reserva. Secretaria/Gerência Pedagógica/Administração preparam motivo e parecer de viabilidade; outra pessoa da Gerência Pedagógica/Administração aprova ou rejeita. Acúmulo de papéis não permite autoaprovação. Migration 96 preserva propostas/decisões e impede autoaprovação/decisor sem papel também no banco.

Reserva deve ter sido criada dentro da janela então aprovada e continuar ATIVA válida ou MANTIDA_PENDENCIA. A janela atual precisa estar encerrada; demais requisitos de turma, vaga, professor e agenda devem estar atendidos para propor/aprovar. Snapshot identifica matrícula/aluno/turma, reserva, prazo, janelas, condições e encontros. Mudança do cenário exige nova revisão/aprovação. O consumo remove somente JANELA_ENCERRADA para a reserva identificada; não altera a janela global, concede nova reserva ou dispensa turma concluída, conflitos, falta de vaga ou docente inapto.

Conferência contratual e emissão inicial passaram a consumir o helper comum e registrar a referência da exceção. A própria reserva é descontada da ocupação; outra contratação não herda a autorização. Interface em /academico/admissoes/excecoes lista reservas e permite preparação, revisão, decisão e histórico paginado, identificando aluno/turma sem expor condições financeiras ao Pedagógico.

Validação: 49 integrações de reservas/contratação aprovadas, incluindo contratação com e sem taxa prévia, aprovação independente, autoaprovação negada pela ação e pelo banco, continuidade permitida, nova reserva negada, docente inativo, imutabilidade e necessidade de nova aprovação após mudança do prazo. Dois casos foram repetidos após incluir turma concluída e vendedor negado. Build/TypeScript (46 páginas estáticas), lint dos arquivos alterados e diff check aprovados; schema local sem diferenças, 96 migrations aplicadas no banco descartável. Evidência em docs/validacao-excecao-admissao-204-2026-09-12.json.

Limites: Q110 está conectado à emissão e à conferência anterior à assinatura; a ativação/alocação final ainda precisa consumir a mesma revalidação quando seu novo fluxo for implementado. Não confirma pagamentos, aceita contrato ou ativa matrícula. Assinatura integrada, agenda própria de particulares, aditivos e ativação completa permanecem pendentes. Sem ensaio interativo de navegador, produção, envios externos ou importação real.

## Incremento 205 — Intenção e tentativas de envio, 12/09/2026

Primitivas internas em envio-tx.ts preparam o processo do original/conferência, iniciam uma tentativa após revalidação e registram observações do adaptador. Migration 97 inclui processo, tentativas e observações; preserva base e referência externa, histórico imutável e um processo ativo por matrícula. Processo anterior exige o fluxo específico de substituição, ainda pendente; não abre envio paralelo por trocar fornecedor/original.

Concorrência permite iniciar somente uma tentativa. ENVIANDO e ENVIO_INCERTO bloqueiam repetição; timeout/erro de rede deve ser normalizado como INCERTO. Somente evidência positiva de NAO_CRIADO permite voltar a PREPARADO, com nova revalidação antes da próxima tentativa. REGISTRADO vincula a referência externa sem significar assinatura ou aceite. Retorno de tentativa antiga ou referência divergente é recusado para conferência, sem reescrever o processo atual. Mesmo estado inconsistente PREPARADO não permite repetir se a referência externa já estiver vinculada.

Essas funções não são Server Actions e não fazem HTTP, notificam signatários ou configuram fornecedor. O futuro adaptador autenticado deve interpretar respostas e manter evidências, usar a tentativa persistida fora da transação de rede, conciliar incerteza e tratar retornos divergentes. CANCELADO existe como estado de histórico, mas cancelamento/substituição ainda não possuem executor neste incremento. Não há botão de envio ou worker operacional; a tela atual continua distinguindo conferência de envio.

Validação: 49 integrações de reservas/contratação aprovadas, com dois casos repetidos após proteção adicional de estado/referência. Cobertura inclui criação idempotente, disputa por tentativa, incerteza, ausência confirmada simulada, segunda tentativa, retorno antigo, referência divergente, preservação de base/histórico e papel indevido. Build Next.js 16.3.5/TypeScript (46 páginas estáticas), lint e schema local sem diferenças. Evidência em docs/validacao-envio-205-2026-09-12.json. Última regressão integral permanece a 201.

Q155 foi enviada ao usuário para escolher ZapSign, Clicksign ou Docusign, sem resposta registrada nesta rodada. Comparação/fontes em docs/planejamento/fornecedor-assinatura-q155.md. O nome ZapSign usado no fixture é apenas dado de teste e não uma escolha/configuração operacional. Fornecedor/plano, adaptador, envio/retornos autenticados, ciclo de cancelamento/substituição, assinaturas completas, aceite, aditivos e ativação permanecem pendentes. Nenhuma chamada externa, contratação, produção ou dado real.


## Incremento 206 — Forma de agenda da oferta, 12/09/2026

Migration 98 acrescenta classificação explícita TURMA, PARTICULAR_GRADE_FIXA ou PARTICULAR_FLEXIVEL em ProdutoPais, sem valor presumido para dados antigos. A configuração administrativa mantém versão otimista, motivo e evento anterior/atual; a preparação captura a classificação no snapshot e a consulta a apresenta sem usar edições posteriores do catálogo.

O fluxo de reserva comum recusa ofertas classificadas como particulares, em ambos os regimes financeiros, e hora particular em oferta classificada como turma. A reserva individual de horários ainda não foi implementada; esta proteção impede declarar uma vaga comum como cumprimento de Q111. Dados antigos não classificados continuam exigindo revisão antes de produção; não foram migrados ou considerados conformes. A mudança não conclui Q111, emissão, assinatura ou ativação das particulares.

TypeScript, lint dos arquivos alterados, build (46 páginas estáticas), diff check e schema sem diferenças aprovados. 52 integrações de reservas/contratação aprovadas: preservação da forma de agenda após editar a oferta, recusa das duas formas de particular nos dois regimes financeiros, incompatibilidade de turma com hora particular e ausência de efeitos após recusa. Evidência em docs/validacao-agenda-oferta-206-2026-09-12.json. Última regressão integral permanece a 201. Sem produção, importação, envio externo ou ensaio interativo da interface. Q155 continua sem resposta; nenhuma escolha de fornecedor foi presumida.


## Incremento 207 — Conferência dos horários particulares, 12/09/2026

`agenda-particular-estado.ts` acrescenta a conferência interna de oferta/versão particular, professor, calendário aprovado e horários explícitos. Normaliza os instantes pelo fuso de origem, recusa ambiguidade/inexistência local e identifica intervalos passados, sobreposições com agenda publicada, sobreposição interna, ausência docente aprovada e necessidade de exceção para período não letivo. Intervalo final exclusivo evita falso conflito na adjacência e no término à meia-noite. Snapshot e hash registram as fontes e impedimentos da revisão.

Não reserva horários, publica encontros, cobra, libera assinatura ou ativa matrícula. É função interna sem interface pública; autenticação/escopo ficam no chamador futuro. Embora use o bloqueio comum da agenda, a concorrência da reserva individual ainda depende de sua persistência transacional. O resultado declara reservaEfetuada=false e as verificações restantes. Q111 permanece incompleta; bloqueio das ofertas particulares na preparação comum de turma continua até o fluxo próprio.

TypeScript, lint do trecho e diff check aprovados. Dois testes novos direcionados passaram, incluindo UTC/fuso de origem, adjacência, conflito publicado/interno, docente inativo, versão alterada, dia não letivo após meia-noite, ausência pendente versus aprovada e horário DST inexistente. Arquivo completo de reservas/contratação: 54 testes aprovados, zero falhas ou pendentes. Evidência em docs/validacao-agenda-particular-207-2026-09-12.json. Sem migration, produção, importação, chamadas externas ou ensaio de navegador. Último build permanece 206; última regressão integral permanece 201.


## Incremento 208 — Persistência e concorrência da reserva particular, 12/09/2026

Migration 99 adiciona ReservaAgendaParticular e seus horários, referências da matrícula/preparador/docente e proteções de integridade/histórico. Primitiva interna para Secretaria/Administração valida matrícula em preparação, oferta compatível, ausência de outra reserva/alocação, conferência/hash atuais, professor ativo e prazo configurado. Persiste o conjunto com evento; repetição é idempotente. Não há Server Action ou interface de contratação particular.

Conferência considera reservas ATIVA/MANTIDA_PENDENCIA, inclusive após o prazo até regularização. Bloqueio comum do calendário serializa concorrência. Grade de turma e substituição docente conferem reservas; tela de grade mostra períodos ocupados. Triggers também impedem encontro sobre reserva, alteração de professor para intervalo ocupado, coexistência de reserva de turma/particular na matrícula, modificação/apagamento dos intervalos e reativação de registro terminal. O prazo não libera horário automaticamente.

Teste novo cobre disputa entre duas matrículas, repetição/chave divergente, papel indevido, ausência de cobrança/alocação, proteção contra reserva de turma simultânea, histórico imutável, grade conflitante, mudança de horário/professor e reserva ainda ocupada após prazo. TypeScript, lint do trecho, diff check e schema sem diferenças aprovados. Reservas/agenda: 69 integrações aprovadas, zero falhas ou pendentes. Build Next.js 16.3.5 aprovado com 46 páginas estáticas. Evidência em docs/validacao-reserva-particular-208-2026-09-12.json.

Limites: preparação comercial particular, conjunto recorrente contratual, ciclo de expiração/decisão, tratamento de reservas afetadas por ausência aprovada e ativação/consumo ainda pendentes. Implementação não libera o bloqueio do caminho comum de turma, não chama fornecedores, não ativa assinatura ou cobranças e não opera em produção. Q111 segue incompleta; última regressão integral permanece 201.


## Incremento 209 — Reservas afetadas por ausência docente, 12/09/2026

Migration 100 acrescenta reservasAfetadas à decisão de indisponibilidade, com lista vazia nos registros antigos sem inferir histórico. Aprovação sob o bloqueio comum do calendário captura os horários de reservas ATIVA/MANTIDA_PENDENCIA que intersectam a ausência. O evento identifica as reservas pendentes. Histórico da decisão permanece protegido pelo trigger existente.

Consulta separa reservas para conferência antes da decisão das pendências atuais após aprovação; reavalia a ocupação sem apagar o impacto histórico. Interface mostra horários reservados e avisa que ausência não cancela reserva ou escolhe substituto. Escopo docente permanece limitado ao próprio professor; sem dados financeiros/cadastrais do contratante. Rejeição não cria pendência aprovada.

Teste direcionado aprovado: reserva anterior à ausência, prévia, aprovação independente, pendência sem liberar horário, bloqueio por ausência, escopo de outro professor negado, histórico preservado após saída da ocupação simulada em fixture e imutabilidade no banco. 70 integrações de reservas/agenda aprovadas, zero falhas ou pendentes. Build Next.js 16.3.5/TypeScript aprovado com 46 páginas estáticas; lint, diff check e schema sem diferenças aprovados. Evidência em docs/validacao-ausencia-reserva-209-2026-09-12.json.

Limites: não existe executor público de solução/liberação da reserva particular; alteração terminal no teste é fixture, não comprovação desse fluxo. Reagendamento, integração comercial, contrato, expiração/decisão e ativação/consumo continuam pendentes. Sem produção, importação, envio externo ou ensaio interativo. Última regressão integral permanece 201.


## Incremento 210 — Aprovação de ausência vinculada ao impacto revisado, 12/09/2026

Consulta produz hash canônico da solicitação, aulas previstas e reservas particulares afetadas. A interface envia o hash da revisão ao aprovar; servidor exige presença/correspondência sob o bloqueio do calendário. Mudança no conjunto desde a revisão impede aprovação e orienta nova conferência. Rejeição mantém seu caminho sem hash obrigatório. Evento de aprovação registra o hash; repetição confere o impacto histórico capturado na decisão, preservando idempotência após resolução das pendências.

Integração ampliada verifica falta de hash, inclusão de aula após revisão, decisão não criada com revisão antiga, nova revisão aprovada e repetição histórica depois de uma reserva sair da ocupação; hash divergente não é aceito como repetição. Testes existentes de ausência foram ajustados para consultar a revisão antes de aprovar, inclusive autoaprovação negada.

TypeScript, lint do trecho e diff check aprovados. Build Next.js 16.3.5 aprovado (46 páginas estáticas); 70 integrações de reservas/agenda aprovadas, zero falhas ou pendentes. Evidência em docs/validacao-impacto-ausencia-210-2026-09-12.json. Sem migration, produção, importação ou envio externo; ensaio interativo da interface ainda pendente. Ciclo de solução da reserva particular e demais frentes continuam incompletos; última regressão integral permanece 201.


## Incremento 211 — Preparação comercial vinculada à reserva particular, 12/09/2026

Migration 101 torna a reserva de turma opcional na preparação e acrescenta reserva particular, exigindo exatamente uma referência. Trigger preserva histórico e impede vínculo com reserva de outra matrícula. Preparação escolhe exclusivamente turma ou agenda particular, confere classificação/identidade da oferta e mantém matrícula/reserva/preparação na mesma transação. Retorno identifica o tipo de reserva. Particular pode ser mensal ou por hora; cadastro existente, responsável comercial e regras de preço/entrada permanecem separados por contratação.

Reserva particular interna passou a aceitar Comercial com escopo atual da negociação; papel por si só não dá acesso a outra carteira. Consulta e página de preparação exibem docente/horários/fuso/prazo sem vaga fictícia. Diagnóstico da Secretaria informa a integração ainda pendente. Ativação mensal legada e prévia contratual recusam essa preparação enquanto horários não forem integrados ao contrato/consumo de reserva.

Quatro testes direcionados aprovados: fixa/flexível × mensal/hora, carteira indevida negada, vínculo particular sem reserva de turma, repetição, consulta restrita, nenhuma cobrança/alocação, outro contrato preservado e ativação legada bloqueada. 74 integrações de reservas/agenda aprovadas, zero falhas ou pendentes. Build Next.js 16.3.5/TypeScript aprovado com 46 páginas estáticas, lint do trecho, diff check e schema sem diferenças aprovados. Evidência em docs/validacao-preparacao-particular-211-2026-09-12.json.

Limites: formulário de seleção/revisão dos horários ainda pendente; payload no servidor não comprova experiência comercial pronta. Condições documentais dos horários, emissão, assinatura, ciclo de reserva e ativação/consumo continuam pendentes. Sem produção, importação, envio externo ou ensaio interativo. Última regressão integral permanece 201.


## Incremento 212 — Formulário e revisão comercial particular, 12/09/2026

Consulta de ofertas fornece forma/versão e não busca turmas para particulares. Nova busca docente paginada e revisão da agenda usam negociação autorizada, conferindo o papel atual; revisão projeta somente os intervalos propostos e sinais de impedimento, sem ids dos compromissos concorrentes. Professores retornam id/nome.

Formulário distingue turma/particular, busca professor, recebe fuso e lista de encontros acordados sem presumir duração, confere disponibilidade e exige confirmação. Edição invalida a revisão; buscar outro docente retira a confirmação anterior. Envio bloqueia campos e usa a preparação existente, redirecionando à página da preparação. Oferta/versão fazem parte da chave de remontagem. Particular fixa usa encontros explícitos, sem gerador automático de recorrência nesta rodada.

Integrações ampliadas usam as ações públicas de busca/revisão/preparação nas quatro combinações particular fixa/flexível e mensal/hora: carteira indevida negada, projeção sem dados de compromissos alheios, cadastro com contato conferido e reserva sem cobrança/alocação. 74 integrações de reservas/agenda aprovadas, zero falhas ou pendentes. Build Next.js 16.3.5/TypeScript aprovado (46 páginas estáticas), repetido após ajuste final de bloqueio do formulário; lint e diff check aprovados. Evidência em docs/validacao-formulario-particular-212-2026-09-12.json. Sem migration, produção, importação ou envio externo. Ensaio interativo/homologação pendentes; contrato, emissão, assinatura e ativação particulares ainda incompletos. Última regressão integral permanece 201.


## Incremento 213 — Agenda particular no documento contratual, 12/09/2026

Campo AGENDA_PARTICULAR disponível no catálogo de origens do modelo. Prévia exige seu uso no texto de seção quando houver reserva particular; compõe forma histórica, fuso, professor, datas/horários e duração a partir dos intervalos preservados. Snapshot inclui reserva/status/prazo, calendário e docentes. Leitura confere vínculo, fidelidade dos horários, estado/prazo, futuro, professor ativo, ausência aprovada, conflito e período não letivo. Oferta editada depois não muda a forma de agenda histórica. Registro de prévia passa a obter o bloqueio comum da agenda antes da matrícula.

Quatro cenários particulares (fixa/flexível × mensal/hora) passaram no teste direcionado, incluindo condições/pagador, publicação independente de modelo, modelo sem uso do campo recusado, preenchimento da agenda, cadastro da prévia, regra preservada após alterar oferta e bloqueio por docente inativo. Fixtures por hora receberam referência de preço própria: a primeira execução recusou corretamente condições sem referência histórica suficiente, sem relaxar a regra comercial.

74 integrações de reservas/agenda aprovadas, zero falhas ou pendentes. Build Next.js 16.3.5/TypeScript aprovado com 46 páginas estáticas; lint e diff check aprovados. Evidência em docs/validacao-agenda-contratual-213-2026-09-12.json. Sem migration, produção, importação ou envio externo. Não houve artefato PDF específico novo ou validação visual da agenda nesta rodada. Emissão, conferência de envio, assinatura, ciclo de reserva e ativação particulares continuam pendentes; última regressão integral permanece 201.


## Incremento 214 — Validação visual do PDF com agenda particular, 12/09/2026

Formatador textual da agenda extraído para agenda-particular-texto.ts e compartilhado entre a fonte contratual e o script de demonstração. Usa hífen simples no intervalo. Gerador de PDF do ERP produziu output/pdf/agenda-particular-demonstracao.pdf com dados fictícios: grade com 24 encontros de 90 minutos que atravessam meia-noite, cenário flexível independente de 75 minutos, fusos de São Paulo/Costa Rica e nomes acentuados. A demonstração valida formatação, não uma contratação operacional com esses dados.

Duas páginas renderizadas pelo Poppler e inspecionadas visualmente: sem cortes, sobreposição ou glifos ausentes; margens, títulos, continuidade e rodapés preservados. Extração pypdf confirmou 24+1 encontros, fusos, acentos, mudança de data, último trecho e numeração. Duas gerações com as mesmas fontes produziram bytes idênticos. Evidência em docs/validacao-pdf-agenda-214-2026-09-12.json.

Três unitários do PDF e quatro integrações particulares passaram (56 casos não selecionados nesta rodada); lint e diff check aprovados. Build Next.js 16.3.5/TypeScript aprovado com 46 páginas estáticas. Sem migration, produção, importação ou envio externo. Emissão, assinatura, ciclo de reserva e ativação particulares continuam pendentes. Última regressão integral permanece 201; os 74 testes de reservas/agenda foram executados na rodada 213.


## Incremento 215 — Emissão inicial das particulares, 12/09/2026

Conferência da Secretaria e emissão inicial agora usam a reserva particular vinculada à preparação. A revisão mostra os horários e inclui sua configuração histórica e o calendário no hash. O executor revalida reserva, prazo, docente, conflitos e períodos não letivos na transação antes de emitir. Memória da emissão conserva a agenda conferida. Alterar a oferta depois da preparação não substitui suas condições históricas.

Mantido o planejador das cobranças: taxa após conferência; primeira mensalidade conforme exigência de entrada; por hora sem adiantamento não recebe mensalidade fictícia. Emissão não ativa matrícula nem consome a reserva. Repetição da confirmação retorna a emissão existente sem duplicar.

74 integrações de reservas/agenda aprovadas, incluindo quatro combinações particulares e bloqueios por docente inativo e revisão desatualizada. TypeScript, lint do trecho, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-emissao-particular-215-2026-09-12.json. Sem migration, produção, importação ou envio externo. Última regressão integral permanece 201. Conferência para assinatura, ciclo de reserva e ativação particulares continuam pendentes; ensaio interativo também pendente.


## Incremento 216 — Conferência para assinatura de particulares, 12/09/2026

A revisão anterior ao envio identifica a reserva particular da preparação e confere seus horários históricos, validade, professor, calendário e conflitos. Mantém a verificação do original preservado, participantes atuais, emissão inicial e pagamento prévio da taxa quando exigido. O caminho de turma conserva janela acadêmica e exceção Q110; a particular não recebe turma ou janela fictícias. A tela apresenta os horários particulares conferidos.

O registro interno não envia documentos, não cria aceite e não ativa matrícula. A futura tentativa de envio continuará revalidando a mesma revisão. Fornecedor Q155, adaptador externo, assinatura/aceite, ciclo de reserva e ativação particulares permanecem pendentes.


Validação do incremento 216: 74 integrações de reservas/agenda aprovadas, incluindo particulares fixa/flexível e mensal/hora até participantes, original preservado e conferência para assinatura. Docente inativo impede registro; repetição não duplica; nenhuma assinatura externa ou ativação é criada. TypeScript, lint do trecho e build Next.js 16.3.5 com 46 páginas estáticas aprovados. Evidência em docs/validacao-assinatura-particular-216-2026-09-12.json. Sem migration; última regressão integral permanece 201. Ensaio interativo pendente.


## Incremento 217 — Conferência do vencimento de reservas particulares, 12/09/2026

Executor transacional e ação autenticada da Secretaria/Administração conferem vencimento com bloqueio comum da agenda e da matrícula. Prazo vigente e estados já tratados não sofrem nova transição. Reserva vencida vinculada à preparação pode expirar sem avanço formal local: horários deixam de ocupar disponibilidade, mas os registros, cobranças e preparação permanecem preservados.

Comprovante a conferir/confirmado, recebimento, indício financeiro legado, contrato/documento contratual ou processo de assinatura impedem liberação automática. Processo mesmo cancelado exige conciliação; não presumir ausência de assinaturas parciais. Reserva sem preparação correspondente ou matrícula fora da preparação também fica mantida por pendência. Evento registra referências e motivo objetivo da transição. Nenhuma cobrança é cancelada, recebimento devolvido ou matrícula ativada.

A página da preparação mostra o botão de conferência para Secretaria/Administração quando a reserva particular ativa vence. Comercial não recebe esse controle e a ação recusa seu papel. A execução periódica automática, resolução independente da pendência e retomada com nova reserva continuam pendentes; esta rodada entrega executor e operação manual, sem declarar concluídos Q108/Q118/Q123.


Validação 217: 74 integrações aprovadas; cenários incluem prazo vigente, papel comercial recusado, expiração sem avanço, manutenção por indício financeiro/documento/processo de assinatura, repetição sem transição e preservação de horários/cobranças. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-vencimento-particular-217-2026-09-12.json. Sem migration; última regressão integral permanece 201. Ensaio interativo pendente.


## Incremento 218 — Rotina periódica de reservas particulares, 12/09/2026

A rota operacional existente POST /api/whatsapp/cron, protegida por CRON_SECRET no cabeçalho x-cron-secret, inclui agora a conferência de reservas particulares antes das rotinas de mensagens. Seleciona até 50 reservas ativas vencidas e revalida cada uma na própria transação. Retorna contagens de expiração, manutenção, ausência de transição e falhas; lote cheio sinaliza continuação em novas chamadas. Falha individual não libera a reserva nem impede as seguintes. A rotina de reservas não depende de WhatsApp habilitado e não envia mensagens.

Quatro integrações direcionadas passaram (56 casos não selecionados): os cenários particulares agora exercitam o lote e sua repetição. Quatro unitários passaram para falha isolada e autenticação da rota (sem segredo, segredo incorreto e chamada válida). TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-cron-particular-218-2026-09-12.json. A rodada de 74 integrações continua sendo a 217; última regressão integral é 201.

Sem agendador externo configurado ou validado nesta rodada; o código atende chamadas periódicas autenticadas, mas não comprova operação periódica em produção. Antes de operar, dimensionar lote/tempo limite do ambiente e tratamento de falhas persistentes que possam ocupar o começo dos lotes. Sem migration, produção, importação ou envio externo. Resolução aprovada e retomada com nova reserva permanecem pendentes.


## Incremento 219 — Continuidade dos lotes de vencimento, 12/09/2026

Cursor persistente no banco guarda a última reserva selecionada por vencimento/id. Seleção e avanço são serializados em transação própria. A posição avança antes do processamento, portanto falha ou queda não prende as reservas posteriores. Ao terminar a passagem, o cursor é zerado para revisitar as pendentes na chamada seguinte. Reserva permanece ocupante até a própria conferência transacional autorizar sua transição; cursor não libera horários.

A rotina inicia no máximo 50 conferências e para de selecionar ao atingir 15 segundos de trabalho. Transações individuais usam timeout de 5 segundos e espera de conexão de 1 segundo; uma operação em curso pode ultrapassar o orçamento do lote. Retorno identifica limite de tempo. São limites técnicos de processamento, sem alterar prazo de reserva ou condições contratuais.

Migration 102 aplicada somente no banco local de testes, com schema diff vazio. Cinco integrações direcionadas e cinco unitários passaram; teste de cursor confirma avanço por duas reservas ainda ativas e retorno à primeira em nova passagem. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-cursor-particular-219-2026-09-12.json. Demais 56 integrações do arquivo não foram selecionadas. Última regressão integral permanece 201.

Sem agendador externo configurado nesta rodada; capacidade, tempo limite total da rota e alertas operacionais ainda precisam ser homologados no ambiente de execução. Sem produção, importação ou envio externo. Resolução aprovada e retomada com nova reserva continuam pendentes.


## Incremento 220 — Painel de reservas particulares da Secretaria, 12/09/2026

Painel /secretaria/reservas distingue turmas e particulares. Consulta particular exige Secretaria/Administração com papel ativo revalidado no banco, pagina 30 registros, permite matrícula específica e inclusão do histórico. Apresenta estado, prazo/fuso, docente e quantidade de horários, com link à preparação. Não retorna snapshot, documentos financeiros ou contatos pessoais na projeção da lista. Vencidas ativas oferecem a conferência existente; mantidas ocupam horários e expiradas só aparecem ao incluir histórico.

Quatro integrações direcionadas passaram: consulta comercial negada, filtro por matrícula, projeção limitada, ocupantes e histórico após expiração/manutenção. Demais 57 casos do arquivo não selecionados. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-painel-particular-220-2026-09-12.json. Última regressão integral permanece 201. Sem migration, produção ou envio externo; ensaio interativo pendente. Resolução aprovada e retomada da preparação com nova reserva ainda não concluídas.


## Incremento 221 — Regressão integral após reservas particulares, 12/09/2026

721 testes unitários e 549 integrações aprovados, zero falhas e zero pendentes. Integração executada uma única vez, em série, no Postgres descartável localhost:54329/erp_genius_test. Evidência por arquivo em docs/validacao-regressao-221-2026-09-12.json. Esta é a nova referência de regressão integral, substituindo a 201; registros anteriores permanecem históricos.

TypeScript aprovado; schema local sem diferenças e 102 migrations aplicadas. Lint completo de src: zero erros, três avisos preexistentes em FinanceiroPainel.tsx (116/402) e Sidebar.tsx (38), relacionados a atualização de estado em efeitos. Sem alterações de código necessárias nesta rodada. Último build validado continua o 220. SPEC central atualizada para apontar explicitamente o estado comercial/documental até 220.

Resultado verde comprova os cenários existentes, não a conclusão das funcionalidades ausentes. Assinatura externa, resolução aprovada de particulares, retomada da mesma preparação, ativação e demais frentes aprovadas continuam pendentes. Sem nova homologação interativa, produção, importação ou envio externo.


## Incremento 222 — Resolução particular com aprovação independente, 12/09/2026

Servidor permite propor prorrogação/liberação de reserva particular mantida por pendência. Secretaria/Administração prepara com motivo, tratamento previsto da contratação e novo prazo quando aplicável. Outra pessoa da Administração decide; acúmulo de papéis não permite autoaprovação. Proposta e decisão permanecem imutáveis, com versões, idempotência e auditoria. Liberação da reserva não cancela contrato/cobrança nem devolve recebimentos.

Decisão revalida a versão mais recente e o contexto da reserva, matrícula, cobranças/informes/recebimentos, documentos e processos de assinatura. Mudança exige nova proposta. Prorrogação exige prazo futuro/posterior e disponibilidade da agenda particular; calendário, docente e horários compõem a revisão preservada. A transição válida muda somente estado/prazo da reserva.

Quatro integrações direcionadas aprovadas: liberação/prorrogação, autoaprovação recusada, Secretaria impedida de decidir, nova evidência invalidando proposta, nova versão aprovada, repetição e imutabilidade. Demais 57 casos não selecionados. TypeScript, lint e build Next.js 16.3.5 (46 páginas estáticas) aprovados; migration 103 somente no banco local de teste, schema diff vazio. Evidência: docs/validacao-resolucao-particular-222-2026-09-12.json. Última regressão integral permanece 221.

Esta rodada entrega ações de servidor e persistência. Consulta detalhada e interface de preparação/decisão particulares ainda pendentes; não declarar Q118 concluída na experiência operacional. Retomada com nova reserva, assinatura externa e ativação continuam incompletas. Sem produção ou envio externo.


## Incremento 223 — Interface de resolução particular, 12/09/2026

Painel de particulares abre /secretaria/reservas/particulares/[id], com horários, prazo, estado e histórico paginado de propostas. Formulários reutilizam a estrutura existente com ações particulares: Secretaria/Administração prepara; outra pessoa da Administração decide. Consulta revalida papel e projeta permissões de decisão/aprovação conforme autoria, versão, estado, prazo e hash. Uma indisponibilidade da agenda bloqueia prorrogação e aparece como pendência, sem impedir a consulta de histórico ou o tratamento de liberação.

Proposta/decisão exibem motivos e tratamento previsto; reavaliação transacional do servidor continua obrigatória. Histórico preserva também proposta superada, sem apresentá-la como aplicada. Não são expostos snapshots ou documentos internos na projeção de propostas.

Quatro integrações direcionadas passaram, incluindo consulta comercial negada, autoria independente, revisão desatualizada e histórico das duas versões após aprovação. Demais 57 casos não selecionados. TypeScript, lint e build Next.js 16.3.5 (46 páginas estáticas e nova rota dinâmica) aprovados. Evidência: docs/validacao-tela-resolucao-particular-223-2026-09-12.json. Sem migration; última regressão integral permanece 221. Ensaio interativo pendente, portanto não declarar homologação operacional. Retomada com nova reserva, assinatura externa e ativação continuam incompletas. Sem produção ou envio externo.


## Incremento 224 — Cadeia histórica de reservas particulares, 12/09/2026

Novo vínculo imutável RetomadaReservaParticular identifica reserva anterior, nova, autor, motivo e data. Origem/destino únicos impedem dois sucessores ou reutilização do destino. Banco exige mesma matrícula, origem expirada/liberada e destino ativo; preparação comercial mantém sua referência original. Resolver interno percorre a cadeia para encontrar a reserva atual, com detecção de ciclo.

Vinculação interna exige Secretaria/Administração ativa, matrícula em preparação e origem correspondente à ponta atual da cadeia. Repete somente o mesmo autor/conteúdo; outra proposta para a mesma origem é recusada. Não é Server Action e deve integrar a transação da criação da nova reserva após as conferências aplicáveis.

Quatro integrações direcionadas aprovadas; cenário flexível por hora cobre nova reserva, vinculação, repetição, papel comercial recusado, histórico original preservado e alteração do vínculo impedida. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Migration 104 aplicada somente no banco local de testes, schema diff vazio. Evidência: docs/validacao-cadeia-particular-224-2026-09-12.json. Demais 57 casos não selecionados; última regressão integral permanece 221.

A ação operacional de retomada, sua revisão de condições/documentos, interface e adaptação dos consumidores para a reserva atual ainda precisam ser implementadas. Esta base não habilita contratação, assinatura ou ativação por si só. Sem produção ou envio externo.


## Incremento 225 — Consumidores da reserva particular atual, 12/09/2026

Fonte da agenda contratual resolve a cadeia de reservas antes de conferir disponibilidade. Prévia, revisão de emissão e conferência para assinatura passam a receber os horários da reserva atual pelos consumidores existentes dessa fonte. Consulta da preparação mostra reserva atual e identifica a original preservada. Controle de vencimento também resolve a ponta da cadeia, evitando manter a nova reserva apenas por divergir da referência histórica inicial.

Quatro integrações direcionadas aprovadas. Cenário de nova reserva confirma consulta atual, snapshot documental com novo identificador, original anterior preservado mas conferência de assinatura desatualizada, e expiração normal da nova reserva sem avanço formal. Sem duplicação de cobrança. Demais 57 casos não selecionados. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-reserva-atual-225-2026-09-12.json. Sem migration; última regressão integral permanece 221.

Não há ação pública ou interface completa de retomada nesta rodada: a criação/vinculação usada no teste continua interna. Revalidação contratual, encerramento das solicitações externas quando necessário e demais requisitos da retomada ainda precisam ser conectados. Sem homologação interativa, produção ou envio externo.


## Incremento 226 — Revisão e executor interno de nova reserva, 12/09/2026

Revisão de retomada exige Secretaria/Administração, matrícula em preparação assumida, reserva atual expirada/liberada, pagador/condições vigentes e preço autorizado. Oferta precisa conservar produto, país, moeda e forma de agenda; alteração contratual não é presumida. Disponibilidade nova integra o hash junto às condições e ao pagador.

Executor confere o hash e cria nova reserva/vínculo na mesma transação. Registra confirmação com hash de entrada; repetição exata retorna o resultado anterior, enquanto conteúdo diferente com a mesma chave é recusado. Não emite cobrança, assina ou ativa matrícula. Documentos contratuais, aceite ou processos de assinatura exigem conciliação própria e permanecem bloqueados até integrar esse fluxo.

Quatro integrações direcionadas aprovadas, incluindo autorização, revisão divergente sem criar reserva, criação/vínculo conjunto, repetição e conflito de chave. Demais 57 casos não selecionados. TypeScript, lint e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-nova-reserva-226-2026-09-12.json. Sem migration; última regressão integral permanece 221.

Entrega ainda interna: ações públicas, interface, conferência completa de condições financeiras/documentais e conciliação de assinatura não estão concluídas. Sem produção ou envio externo.


## Incremento 227 — Ações autenticadas de nova reserva, 12/09/2026

Ações de revisão e confirmação de retomada exigem sessão da Secretaria/Administração e revalidação do papel no executor. Autor vem da sessão; entrada estrita não aceita autor fornecido pelo cliente. Consulta projeta cadastro, pagador, versão de condições, plano financeiro, cobranças existentes e novos horários. Valores monetários são serializados como texto; não retorna snapshot interno da disponibilidade.

Cadastro do aluno e estados/versões das cobranças, informes e recebimentos passam a integrar o hash da revisão. Cadastro é relido sob bloqueio compartilhado antes da confirmação. Alteração posterior exige nova consulta. A ação usa o executor atômico/idempotente existente e não emite cobranças.

Quatro integrações direcionadas aprovadas; cenário de retomada agora usa ações públicas, testa vendedor recusado, projeção da revisão, alteração cadastral invalidando confirmação, nova revisão e confirmação bem-sucedida. Demais 57 casos não selecionados. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas) aprovados. Evidência: docs/validacao-retomada-publica-227-2026-09-12.json. Sem migration; última regressão integral permanece 221.

Interface ainda pendente. Conciliação de documentos/processos de assinatura e alteração de condições/oferta não são liberadas por estas ações; dependem dos fluxos correspondentes ainda incompletos. Sem produção ou envio externo.


## Incremento 228 — Tela de retomada com nova reserva, 12/09/2026

Preparação particular expirada/liberada oferece à Secretaria/Administração a rota /matriculas/[id]/nova-reserva. Tela permite busca paginada de professores, fuso e encontros explícitos; fixa orienta informar todos os encontros acordados e flexível ao menos o primeiro. Revisão mostra cadastro, pagador, condições, cobranças existentes e agenda; exige conferência e motivo antes da confirmação. Mudança na agenda remove revisão/consentimento. Campos ficam bloqueados durante operações; confirmação bem-sucedida retorna à preparação.

Consulta de formulário revalida papel, matrícula, reserva atual e forma de oferta; devolve professores ativos somente com id/nome, em páginas de 30. Ações de confirmação mantêm validação transacional e idempotência já implementadas. Pagador possui projeção tipada de identificação/contato/endereço para a revisão.

Quatro integrações direcionadas aprovadas, incluindo consulta comercial negada, oferta/versão atual, busca docente e página inválida. Demais 57 casos não selecionados. TypeScript, lint, diff check e build Next.js 16.3.5 (46 páginas estáticas, nova rota dinâmica) aprovados. Evidência: docs/validacao-tela-retomada-228-2026-09-12.json. Sem migration; última regressão integral permanece 221.

Ensaio interativo ainda pendente. Conciliação de documentos/processos de assinatura e alteração contratual/oferta continuam bloqueadas até integrar seus fluxos próprios; a tela não declara esses casos resolvidos. Sem produção ou envio externo.


## Incremento 229 — Concorrência e repetição da retomada, 12/09/2026

Teste de integração executa duas transações concorrentes com chaves diferentes para retomar a mesma reserva de origem. Uma vence, a outra é recusada; banco conserva somente origem e nova reserva, um vínculo e um evento de confirmação. A ação pública repete a tentativa vencedora e retorna o mesmo resultado.

Depois de expirar a nova reserva, repetição conserva seu estado expirado e retorna o resultado histórico sem reativar horários. Desativar o executor impede nova consulta idempotente pela ação. Quatro integrações direcionadas passaram; demais 57 casos não selecionados. TypeScript, lint e diff check aprovados. Evidência: docs/validacao-concorrencia-retomada-229-2026-09-12.json. Não houve alteração de código de produção ou migration; build mais recente permanece 228 e regressão integral 221.

Validação de servidor não substitui ensaio interativo ou os fluxos contratuais pendentes. Sem produção ou envio externo.


## Incremento 230 — Núcleo de cálculo das avaliações, 12/09/2026

Implementado src/server/avaliacoes/calculo.ts como função interna pura, com contexto explícito de matrícula, nível e versão. Calcula média ponderada direta por avaliação/habilidade (Q128), média geral com pesos próprios (Q129) e mínimos geral/individuais (Q130). Notas ausentes ou não oficializadas mantêm resultado dependente pendente; habilidades não avaliadas em um instrumento não recebem zero. Final pode distribuir as quatro habilidades entre instrumentos.

Cálculo usa frações exatas de decimais textuais e retorna numerador/denominador serializáveis, evitando aprovação por arredondamento. Validação técnica exige pesos positivos, escala crescente, mínimos/notas na escala, identificadores únicos e cobertura final completa. Limite técnico de 100 caracteres por decimal não define escala pedagógica. Memória conserva avaliação, etapa e peso; rascunhos não são apresentados como notas oficiais.

Doze testes unitários direcionados passaram; TypeScript, lint dos arquivos e diff check aprovados. Evidência: docs/validacao-calculo-avaliacoes-230-2026-09-12.json. Sem migration. Não houve regressão integral ou build neste incremento (últimos: 221 e 228).

Implementação parcial: ainda não integrada à persistência, autorização por matrícula, publicação de regras, lançamento/oficialização, recuperação, equivalência, frequência, fechamento ou portal. O chamador futuro deverá carregar somente a versão e notas autorizadas do contexto. A função não constitui fechamento final nem autorização de progressão. Não houve produção ou envio externo.


## Incremento 231 — Efeito da recuperação no cálculo, 12/09/2026

Núcleo de cálculo recebe resultados de recuperações vinculadas ao contexto de matrícula/nível/versão e ao plano aprovado. Aplica máximo entre resultado vigente e nota oficial da tentativa (Q133), em ordem histórica explícita, preservando resultado original e memória de cada tentativa com antes/depois. Recalcula média geral e mínimos sem introduzir peso adicional de recuperação na média regular. Habilidades fora do plano são recusadas.

Notas de recuperação ausentes ou não oficializadas não alteram o resultado vigente e aparecem como pendências. Recuperação não substitui avaliação original ausente: mantém a habilidade pendente para regularização própria. Identificadores/ordens duplicados, colisão com avaliação regular, nota fora da escala e contexto diferente são recusados. Recalcular a mesma fonte produz o mesmo resultado; uma fonte corrigida pode diminuir o resultado antes calculado, sem perpetuar uma nota errada como melhor resultado histórico.

Vinte e sete testes unitários passaram (12 anteriores e 15 novos), além de TypeScript, lint direcionado e diff check. Evidência: docs/validacao-recuperacao-calculo-231-2026-09-12.json. Sem migration, build ou regressão integral neste incremento.

Limite: função interna não comprova aprovação pela existência de um ID. Integração futura deverá carregar planos, notas e ordem do histórico autorizado; nenhuma ação pública permite fornecer esses dados. Persistência, aprovação/oficialização, consumo de oportunidades, correções versionadas, frequência, fechamento e portal permanecem pendentes. O indicador completa descreve as notas regulares disponíveis; recuperacoesPendentes é separado e nenhum dos dois autoriza fechamento/progressão por conta própria.


## Incremento 232 — Regras de avaliação versionadas e conferência, 12/09/2026

Migration 105 (20260913030000_regras_avaliacao) cria VersaoRegraAvaliacao por nível/idioma e DecisaoRegraAvaliacao, com propostas e decisões imutáveis, relações restritas e autor/data/motivo. Gestão Pedagógica/Administração prepara; outra pessoa da Gestão Pedagógica/Administração decide. Autoaprovação, inclusive por acúmulo de papéis, é recusada no servidor e no banco. Bloqueio por nível serializa versões/publicações; chaves idempotentes impedem duplicação de proposta. Decisão exige hash da versão normalizada e publicação só aceita proposta mais recente. Rejeitar versão posterior mantém a última aprovada.

Conteúdo inclui escala, pesos e mínimos por habilidade/geral, frequência mínima, instrumentos intermediários/finais, habilidades por instrumento, limite de recuperações por habilidade e segundas chamadas por avaliação, prazos e antecedências independentes. Todos os valores pedagógicos são obrigatórios, sem padrões ocultos. Validação exige pesos positivos, quatro habilidades, escala coerente e cobertura final completa; permite instrumentos finais distribuídos. Durações armazenadas em minutos inteiros explícitos; limites podem ser zero, prazos de realização devem ser positivos. Limites técnicos de tamanho não constituem parâmetros pedagógicos.

Rotas /academico/regras e /academico/regras/[nivelId] oferecem busca paginada por idioma/nível, formulário com campos próprios, histórico e revisão integral antes da decisão. Formulário novo deixa valores pedagógicos em branco; nova versão pode partir do conteúdo anterior sem sobrescrevê-lo. Link aparece para gestão/Administração no acadêmico; ações e consultas revalidam papéis ativos. Histórico não expõe chave idempotente ou hash de entrada. Consulta serializa com mutações para apresentar versão publicada e histórico coerentes.

Validação local: 40 unitários (27 do cálculo e 13 da configuração), 10 integrações, TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 47 páginas estáticas e duas novas rotas dinâmicas. Integrações conferem persistência, imutabilidade, autorizações, autoaprovação direta no banco, reenvios concorrentes, decisões opostas concorrentes, hash divergente, versões superadas, revogação, paginação e separação por nível. Evidência: docs/validacao-regras-avaliacao-232-2026-09-12.json. Sem regressão integral neste incremento; última integral permanece 221.

Limitações abertas: publicação ainda não atribui versão às turmas novas ou migra turmas não iniciadas (Q141); não altera turmas existentes. Persistência de notas, oficialização, oportunidades, frequência, equivalência, fechamento e portal continuam pendentes. Sugestões docentes não possuem fluxo próprio nesta tela. Ensaio interativo não executado; build e testes de servidor não equivalem a homologação da interface. Migration aplicada somente ao banco local descartável de teste; nenhuma operação em produção ou envio externo.


## Incremento 233 — Versão de avaliação na criação da turma, 12/09/2026

Migration 106 (20260913040000_regra_inicial_turma) acrescenta referência à versão de avaliação na turma. Na criação de turma planejada/aberta com início futuro, banco seleciona a última versão publicada do respectivo nível, serializando com a publicação. Propostas pendentes/rejeitadas não substituem a publicada. A seleção comum cobre formulário e importação XLSX. Eventos TurmaCriada/TurmaImportada incluem a referência escolhida; painel de turmas mostra a versão ou pendência de vinculação.

Turmas existentes não são preenchidas retrospectivamente. Datas históricas/desconhecidas e turmas criadas em estado iniciado/concluído permanecem pendentes de conferência, sem presumir que usaram a regra atual. Ausência de publicação conserva referência nula; não cria regra padrão. Publicar nova versão não altera turmas anteriores, estejam planejadas, em andamento ou concluídas. Edição direta não pode substituir/remover vínculo nem trocar o nível de turma vinculada. Fluxo de revisão e aprovação para turma não iniciada continua pendente; bloqueio atual não é sua implementação.

Cadastro e cada linha importada conferem papel ativo após bloqueio de publicação e conservam leitura compartilhada do usuário durante a transação. Trigger rejeita seleção livre da regra inicial, troca direta e incompatibilidade de nível. Consulta de turmas retorna somente id/versão da regra para apresentação resumida.

Validação: 36 integrações aprovadas em três arquivos (6 vínculo, 10 regras, 20 integridade acadêmica); depois do reforço transacional de permissões, as 6 de vínculo foram repetidas e passaram. Casos cobrem formulário, importação real de XLSX fictício em memória, histórico, rascunho sem regra, outro nível, imutabilidade do vínculo e publicação concorrente. Schema diff vazio; TypeScript, lint direcionado e build Next.js 16.3.5 (47 páginas estáticas) aprovados. Evidência: docs/validacao-regra-turma-233-2026-09-12.json. Sem regressão integral; última permanece 221. Não houve produção ou uso de planilhas reais.

Pendente: migração aprovada das turmas não iniciadas, conferência do legado, bloqueios dos fluxos de avaliação quando falta regra, lançamento/oficialização, oportunidades, frequência, fechamento, portal e ensaio interativo. Atribuir uma regra não oficializa notas nem autoriza progressão.


## Incremento 234 — Migração aprovada de regra antes do início, 12/09/2026

Migration 107 (20260913050000_migracao_regra_turma) cria proposta e decisão imutáveis da migração da regra de avaliação da turma. Gestão Pedagógica/Administração revisa e propõe; outra pessoa autorizada decide. Aprovação aplica a nova referência na mesma transação da decisão, com evento. Rejeição preserva a regra anterior. Chave idempotente, versão de proposta e hash da revisão impedem repetição com outro conteúdo ou aprovação de impacto desatualizado.

Revisão conserva regra de origem/destino, dados da turma, agenda e alocações. Consulta oferece conteúdos anterior/novo, campos alterados, quantidades afetadas e versão/hash da revisão. Mudança de agenda/alocação/contexto ou nova publicação exige nova revisão/proposta. Destino deve ser a última publicação do mesmo nível, posterior à regra atual. Primeira vinculação de turma futura sem regra também exige aprovação. Histórico paginado preserva decisões e indica quando uma proposta pendente já não pode ser aplicada, sem expor chave idempotente ou snapshot de alocações.

Bloqueios do calendário, nível e turma coordenam proposta/decisão com a agenda; papel ativo é conferido após a espera. Início é verificado pelo estado, encontro previsto passado, qualquer encontro ministrado, diário legado ou evento de início. Sem agenda publicada, exige data inicial futura conhecida. Data inicial de referência passada pode ser aceita somente com agenda publicada que ainda não iniciou, conforme diferença entre data de referência e primeiro encontro. SQL protege imutabilidade, independência, destino, regra de origem e impedimento de início; atualização direta da referência continua proibida fora da decisão aprovada.

Validação: 28 integrações aprovadas em três arquivos (12 migração, 6 vínculo inicial, 10 regras), TypeScript, lint direcionado, schema diff vazio e diff check. Houve duas correções de fixtures durante o teste: professor obrigatório no encontro publicado e chave idempotente distinta por nível; a execução final passou integralmente. Evidência: docs/validacao-migracao-regra-234-2026-09-12.json. Sem build ou regressão integral neste incremento; últimos permanecem 233 e 221. Migration aplicada somente ao banco local descartável.

Limitações: ações/consultas de servidor prontas, tela específica de migração e ensaio interativo pendentes. Não regulariza histórico de turmas já iniciadas sem regra. Futuro registro de avaliações deverá participar da conferência de impactos e dos bloqueios; persistência de notas ainda não existe neste módulo. Frequência, oportunidades, equivalências, fechamento e portal permanecem incompletos. Não houve produção, importação de dados reais ou envio externo.


## Incremento 235 — Tela de migração e regressão consolidada, 12/09/2026

Rota /academico/regras/turmas/[turmaId], acessível pela indicação de regra no painel de turmas, permite revisar origem/destino, campos alterados, quantidades de encontros e alocações registradas, enviar proposta com motivo e decidir de forma independente. Histórico mostra conteúdos completos das duas regras, autoria/data/motivo e decisões. Proposta desatualizada não oferece aprovação; rejeição permanece disponível para outro gestor autorizado. Formulários bloqueiam campos durante operações e conservam a chave de tentativa quando o resultado da gravação é incerto.

Consulta de preparação seleciona a última publicação do nível e explica ausência de publicação, regra já atual ou impedimento pelo início/histórico. Consulta de histórico extrai contagens do snapshot original e omite o snapshot bruto, IDs das alocações e chaves de processamento. Assim, alocação posterior invalida a proposta sem reescrever o que foi revisado. Regras, papéis e contexto continuam revalidados no servidor ao confirmar.

Validação: 20 integrações direcionadas (14 migração, 6 vínculo), 761 unitários na execução integral, TypeScript e build Next.js 16.3.5 aprovados (47 páginas estáticas, nova rota dinâmica). Lint completo sem erros e com três avisos preexistentes: FinanceiroPainel.tsx 116/402 e Sidebar.tsx 38; lint direcionado aprovado. Banco local tem 107 migrations e schema diff vazio; nenhuma migration nova neste incremento.

Regressão de integração integral executou 579 testes: 578 passaram e um falhou por fixture dependente do horário em whatsapp/cron.int.test.ts. O teste fixava a mensagem às 23h01, podendo preceder a criação real da intenção. Corrigido para usar criação +/- 60 segundos e conferir inbound anterior e posterior; regra de produção do WhatsApp permaneceu preservada. Reexecução completa desse arquivo passou os 12 casos. A cobertura consolidada da última execução de cada arquivo é de 580 integrações aprovadas, sem falhas ou pendências; isso não representa uma segunda execução integral. Evidência detalhada por execução/arquivo: docs/validacao-regressao-235-2026-09-12.json.

Tela compilada e consultas/ações testadas; ensaio interativo ainda pendente. Registro/oficialização de notas, gestão de oportunidades, frequência, equivalências, fechamento e portal continuam incompletos. As contagens de teste não comprovam atendimento integral de Q124–Q154 ou do objetivo geral. SPEC central atualizada para discriminar o avanço acadêmico. Sem produção, dados reais ou envio externo.


## Incremento 236 — Lançamento e oficialização de avaliações, 12/09/2026

Migration 108 (20260913060000_lancamento_avaliacao), aplicada somente ao banco local descartável, cria registro por matrícula/turma/avaliação, versões imutáveis do lançamento e decisão independente. O professor titular com atribuição vigente registra notas e comentário destinado ao aluno; rascunho permite nota ausente, submissão exige todas as habilidades previstas e notas na escala da regra vinculada. A data deve corresponder ao vínculo histórico conferido do aluno e do professor e à situação contratual elegível. Ausência não vira zero.

Outra pessoa ativa da Gerência Pedagógica/Administração oficializa ou devolve a submissão. Aprovação exige a versão mais recente e o conteúdo conferido. Reenvio idêntico não duplica o lançamento; versão nova invalida aprovação da anterior. Nota já oficializada não pode ser sobrescrita pelo lançamento normal: exige o futuro fluxo de correção. Banco protege imutabilidade, contexto matrícula/alocação/turma, sequência e independência das decisões. Bloqueios coordenam gravação com matrícula e turma; permissões são revalidadas dentro da transação.

Consulta paginada limita o professor atual à turma atribuída; professor anterior pode consultar somente versões de sua autoria, sem recuperar edição. Gestão autorizada consulta os registros. A projeção omite dados financeiros, contatos e chaves de processamento. Registro segue a matrícula da alocação, sem alcançar outro contrato do mesmo aluno. Migração de regra passa a bloquear turmas com registros de avaliação, preservando o histórico até existir revisão específica desse impacto.

Validação: 11 integrações novas passaram isoladamente; execução conjunta de quatro arquivos acadêmicos passou 41 testes (11 lançamentos, 14 migração, 6 vínculo inicial, 10 regras). TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 (47 páginas estáticas) aprovados. Evidência: docs/validacao-lancamentos-236-2026-09-12.json. Última regressão integral/consolidada permanece a do incremento 235.

Limitações explícitas: esta entrega implementa persistência, ações e consulta de servidor, sem tela de lançamento ou portal de notas. Falta conectar notas oficiais ao consolidado, implementar correções, responsáveis designados, avaliações históricas de matrícula encerrada, autorizações específicas durante pausa/encerramento, oportunidades, equivalência, frequência e fechamento. Registros com histórico insuficiente ficam bloqueados para conferência; esse bloqueio não implementa os fluxos faltantes. Não houve homologação interativa, produção, importação real ou envio externo.


## Incremento 237 — Telas de lançamento e conferência, 12/09/2026

Rotas /academico/avaliacoes/[alocacaoId] e /academico/avaliacoes/[alocacaoId]/[codigo] oferecem seleção da avaliação, lançamento de notas por habilidade e comentário destinado ao aluno, rascunho/submissão, histórico paginado e conferência independente. A ficha acadêmica fornece acesso por vínculo de matrícula aos papéis professor e gestão; Secretaria não recebe esse acesso de notas.

Consulta prepara configuração, escala, versão esperada e ações disponíveis. Apenas a versão submetida mais recente permite aprovação; versões anteriores ainda podem ser devolvidas. Autoaprovação não é oferecida, inclusive com papéis acumulados. Resultado oficial impede lançamento normal e informa a necessidade de correção aprovada. Todas as operações mantêm as validações transacionais do incremento 236. Formulários bloqueiam campos durante envio, preservam chave de reenvio incerto e atualizam o histórico após confirmação.

Professor anterior consulta somente avaliações em que possui lançamento e somente suas próprias versões; essa leitura não permite novos lançamentos. A projeção não contém telefone, e-mail, responsável financeiro ou chaves de processamento. A avaliação em outra turma/contrato continua sujeita à autorização da consulta; links não concedem acesso.

Validação: 12 integrações do arquivo lancamentos.int.test.ts aprovadas, incluindo seleção restrita do ex-professor, bloqueio da Secretaria, ações por autoria/versão e omissão de campos privados. TypeScript, lint direcionado, build Next.js 16.3.5 (47 páginas estáticas e duas novas rotas dinâmicas) e diff check aprovados. Sem migration nova. Evidência: docs/validacao-telas-avaliacoes-237-2026-09-12.json. Última regressão ampliada acadêmica: 236; integral/consolidada: 235.

Limites: telas compiladas, ainda sem ensaio interativo. Data de realização e histórico usam UTC explicitamente identificado; preferência de fuso nessa tela ainda precisa ser integrada. Navegação pela ficha lista vínculos ativos; acesso navegável ao histórico de vínculos encerrados ainda precisa ser completado. Consolidação de notas oficiais, correção, designação limitada, recuperação/segunda chamada, equivalência, frequência, fechamento e portal do aluno permanecem incompletos. Não houve produção, dados reais ou envio externo.


## Incremento 238 — Consolidação das avaliações regulares, 12/09/2026

Consulta consultarConsolidadoAvaliacoes carrega regra publicada vinculada à turma e lançamentos da matrícula correspondente, sob os bloqueios de matrícula/turma e conferência do papel ativo. Professor titular atual e gestão acessam o conjunto; autoria histórica isolada não concede leitura do consolidado completo. Registros de outra alocação/regra impedem cálculo até conferência de aproveitamento.

Notas oficiais alimentam o cálculo exato por habilidade e a média geral, com os pesos da regra preservada. Notas ausentes ou aguardando conferência produzem pendências e não recebem zero. A consulta retorna referências das fontes e memória do cálculo, sem comentários privados ou dados financeiros. A regra atual impede novas versões normais após oficialização; a futura correção deverá atualizar a seleção de fontes de forma explícita.

Tela de avaliações do vínculo mostra resultados regulares, mínimos individuais/geral e composição por avaliação. Valores são apresentados com duas casas decimais; comparação de mínimos permanece exata, sem usar o arredondamento da tela. O título e os avisos distinguem acompanhamento regular de fechamento, recuperação, frequência e decisão de progressão.

Validação: 13 integrações do arquivo de lançamentos passaram após corrigir uma asserção do teste que comparava uma lista de quatro habilidades com lista de tamanho um. Teste de consolidação confere pendência antes da oficialização, pesos publicados, média exata e bloqueio de professor sem vínculo. TypeScript, lint direcionado e build Next.js 16.3.5 com 47 páginas estáticas aprovados. Sem migration nova. Evidência: docs/validacao-consolidado-238-2026-09-12.json.

Limites: acompanhamento consultado em tempo real, sem fechamento/versionamento do resultado final. Recuperações persistidas, correções, equivalências, frequência e oportunidades ainda precisam integrar o consolidado; nenhuma aprovação automática foi acrescentada. Portal do aluno e ensaio interativo permanecem pendentes. Sem produção ou dados reais. Regressão integral/consolidada de referência continua 235.


## Incremento 239 — Navegação de vínculos e histórico docente, 12/09/2026

Painel /academico/avaliacoes, ligado ao Diário e à área acadêmica, lista vínculos atuais e histórico com lançamentos. A seleção identifica aluno, matrícula, nível e turma; não inclui telefone, e-mail, financeiro ou notas na listagem. Consulta paginada de 20 itens revalida usuário ativo e papéis em transação. Gestão consulta os vínculos permitidos ao papel; professor consulta atuais sob sua atribuição ou históricos que contenham versões de sua autoria.

Histórico inclui alocações encerradas sem depender de abrir a ficha atual do aluno. Abrir o vínculo continua sujeito às consultas de avaliações e versões: professor anterior somente lê suas próprias versões. O painel não concede escrita, consolidado de outras pessoas, nova atribuição ou reativação da matrícula. A aba histórica pode incluir vínculo ainda ativo quando já possui registros; seu significado é histórico com lançamentos, não apenas vínculos encerrados.

Validação: 14 integrações do arquivo lancamentos.int.test.ts aprovadas. Caso novo cobre histórico vazio antes de lançar, saída do professor, encerramento da alocação, leitura própria, negação de consolidado amplo, ausência de histórico para outro docente, acesso da gestão e usuário desativado. TypeScript, lint direcionado, diff check e build Next.js 16.3.5 com 48 páginas estáticas aprovados; nova rota do painel é dinâmica. Sem migration nova.

Limites: acesso navegável ao histórico implementado; ensaio interativo ainda pendente. Não resolve atribuição específica a substitutos, correção, oportunidades, frequência, fechamento ou portal do aluno. Preferência de fuso das telas permanece pendente. Evidência: docs/validacao-painel-avaliacoes-239-2026-09-12.json. Regressão integral/consolidada de referência: 235. Sem produção, dados reais ou envio externo.


## Incremento 240 — Fuso no lançamento e histórico da avaliação, 12/09/2026

Detalhe da avaliação permite escolher um fuso regional válido, com sugestões Brasil, Costa Rica e UTC. Escolha afeta entrada e apresentação de horários, conservada nos links de paginação da tela. Datas registradas são convertidas para preencher o formulário e mostrar autoria/decisões; trocar visualização não grava alterações. A tela orienta salvar rascunho antes da troca.

Ação salvarLancamentoAvaliacaoLocal valida data local e fuso no servidor, converte para instante UTC e chama a mesma transação autorizada de lançamento. Preserva segundos e milissegundos. Não escolhe silenciosamente horários inexistentes/ambíguos em mudanças de horário de verão; exige revisão ou equivalente conferido em UTC. Não altera a regra do calendário institucional ou o fuso da turma.

Validação: 10 unitários de conversão aprovados, incluindo Brasil, Costa Rica, Nepal, virada de data, milissegundos, datas inválidas e horário de verão; 15 integrações de lançamentos aprovadas, com novo caso de conversão no servidor, reenvio idempotente e negação a outro professor. TypeScript, lint direcionado, build Next.js 16.3.5 com 48 páginas estáticas e diff check aprovados. Evidência: docs/validacao-fuso-avaliacoes-240-2026-09-12.json. Sem migration nova.

Limites: escolha nesta tela é parâmetro da navegação, não preferência global persistida do usuário. Painel de vínculos e outras telas ainda têm referências UTC explícitas. Integração global da preferência e ensaio interativo permanecem pendentes. Não conclui correções, recuperação, frequência, fechamento ou portal. Sem produção, dados reais ou envio externo. Última regressão integral/consolidada: 235.


## Incremento 241 — Propostas de correção de notas oficiais, 12/09/2026

Migration 109 (20260913070000_proposta_correcao_nota), aplicada somente ao banco local descartável, cria proposta imutável vinculada ao lançamento oficial. Registra versão, autoria, novos valores/comentários, hash da origem e motivo. Professor com atribuição vigente ou gestão pode preparar; professor que saiu conserva somente leitura. Proposta admite reduzir nota incorreta, distinguindo correção de recuperação.

Ação e transação validam origem oficial, hash, escala e conjunto completo das habilidades, rejeitando proposta sem mudança. Chave idempotente e versão esperada impedem duplicação ou reescrita de tentativa com outro conteúdo. Banco protege imutabilidade, sequência, origem oficial e papel/atribuição. Evento CorrecaoNotaProposta acompanha a gravação na mesma transação. Notas oficiais e consolidado permanecem preservados; nenhuma decisão/aplicação é criada por este incremento.

Validação: 17 integrações de lançamentos aprovadas, incluindo duas novas de correção. Concorrência diretamente entre transações cria uma proposta; ação autenticada também confere reenvio. Duas execuções iniciais falharam no carregamento concorrente da autenticação simulada (next/server importado pelo next-auth); teste foi separado entre transação concorrente e ação autenticada, sem remover verificação de concorrência ou permissões. TypeScript, lint direcionado, schema diff vazio, build Next.js 16.3.5 (48 páginas estáticas) e diff check aprovados. Evidência: docs/validacao-proposta-correcao-241-2026-09-12.json.

Limites: somente preparação no servidor. Consulta/tela da proposta, decisão independente, aplicação dos valores, revisão dos efeitos em recuperação/equivalência/progressão e fechamento ainda precisam ser implementadas. Não declarar Q144 completo. Também pendem demais fluxos acadêmicos e ensaio interativo. Sem produção, dados reais ou envio externo. Última regressão integral/consolidada: 235.


## Incremento 242 — Decisão da correção e notas vigentes, 12/09/2026

Migration 110 (20260913080000_decisao_correcao_nota), aplicada ao banco local descartável, cria decisão imutável com aprovador, motivo e impactos. Outra pessoa da Gestão Pedagógica/Administração aprova ou rejeita. Aprovação exige proposta mais recente e origem vigente; chave de origem acompanha a última correção aprovada, permitindo correções sucessivas sem sobrescrever o lançamento original.

Revisão no servidor apresenta notas vigentes/propostas e solicitações acadêmicas aprovadas/executadas do vínculo. Hash dos impactos precisa continuar válido ao aprovar. Decisão e evento são atômicos; repetição da mesma decisão é idempotente, decisões conflitantes concorrentes não produzem dois resultados. Banco protege independência, papel ativo, sequência/origem e imutabilidade.

Consolidado regular passa a usar a última correção aprovada, inclusive quando reduz uma nota incorreta. Fontes identificam a correção utilizada. Detalhe apresenta valores originais e, separadamente, valores vigentes corrigidos para gestão/professor atual. Professor anterior conserva sua leitura histórica sem receber os valores lançados por outros em correções posteriores. Propostas rejeitadas não alteram resultado.

Validação: 19 integrações de lançamentos aprovadas, com nova cobertura de duas correções sucessivas, origem desatualizada, recalculação, autoaprovação no servidor/banco, versão antiga e decisões concorrentes. Reexecução após ampliar a cadeia também passou os 19 casos. TypeScript, lint direcionado, schema diff vazio, build Next.js 16.3.5 (48 páginas estáticas) e diff check aprovados. Evidência: docs/validacao-decisao-correcao-242-2026-09-12.json.

Limites: consulta/decisão de servidor e apresentação do valor vigente prontas, mas formulários de proposta/decisão e histórico completo de correções ainda pendentes. Impactos em mudanças acadêmicas são preservados na decisão e sinalizados por evento; fila operacional e resolução da revisão ainda não implementadas/testadas. Recuperação, equivalência e fechamento precisam participar da revisão ao serem implementados. Não declarar Q144 integralmente concluído. Sem ensaio interativo, produção, dados reais ou envio externo. Regressão integral/consolidada de referência: 235.


## Incremento 243 — Telas e histórico de correções, 12/09/2026

Rotas /academico/correcoes/[lancamentoId] e /academico/correcoes/[lancamentoId]/[propostaId] permitem preparar proposta, consultar histórico paginado e revisar notas/impactos antes de decidir. Acesso pelo detalhe da avaliação oficial; professor atual/gestão prepara e outra pessoa da gestão decide. Formulários mantêm chave de reenvio incerto, bloqueiam edição durante envio e atualizam consultas após confirmação.

Consulta do histórico recupera os valores da origem específica de cada proposta. Duas correções sucessivas mostram, por exemplo, 7 para 5 e depois 5 para 6, preservando a referência histórica. Notas vigentes alimentam a nova proposta. Proposta antiga não oferece aprovação na revisão, mas pode ser rejeitada quando ainda pendente e com outro decisor. Motivos, comentários e autoria ficam visíveis no contexto autorizado; chaves de processamento e dados financeiros/contatos são omitidos.

Validação: 19 integrações do arquivo de lançamentos aprovadas, ampliadas com comparação histórica em cadeia, paginação, ausência de campos privados e revogação do acesso de correção após saída docente. TypeScript, lint direcionado, diff check e build Next.js 16.3.5 com 48 páginas estáticas e duas rotas dinâmicas novas aprovados. Evidência: docs/validacao-telas-correcao-243-2026-09-12.json. Sem migration nova.

Limites: telas compiladas e consultas/ações testadas; ensaio interativo ainda pendente. Fila e resolução da revisão de impactos acadêmicos continuam pendentes; referências técnicas de solicitações nessa revisão ainda precisam de apresentação operacional. Datas das correções usam UTC explícito, sem preferência global integrada. Recuperação, equivalência, frequência, fechamento e portal permanecem incompletos. Q144 ainda não está integralmente concluído. Sem produção, dados reais ou envio externo. Regressão integral/consolidada de referência: 235.


## Incremento 244 — Fila de revisões após correção, 13/09/2026

Rota /academico/correcoes, ligada à área acadêmica, lista correções aplicadas com impactos em solicitações aprovadas/executadas. Consulta paginada revalida gestão ativa em transação e apresenta aluno/matrícula, correção, autoria/motivo, turma de destino e situação da solicitação no momento da correção e atualmente. Links conduzem ao histórico de correções e às mudanças acadêmicas da matrícula.

Fila deriva das decisões imutáveis com impactos, sem depender de localizar eventos. Não desfaz movimentações e não registra resolução automaticamente. Fonte atual da solicitação é conferida pelo vínculo de origem; referência ausente/incompatível aparece como pendência de conferência. Professor e Secretaria não recebem acesso à fila de gestão.

Validação: 20 integrações do arquivo de lançamentos aprovadas. Caso novo simula estado preexistente de mudança aprovada, identifica aprovação posterior à prévia, bloqueia hash antigo, aplica após nova revisão e verifica fila, evento e preservação da solicitação. O caso não valida o fluxo de aprovação da transferência. Primeira execução falhou por fixture sem motivo de decisão obrigatório; corrigida e reexecutada com sucesso. TypeScript, lint direcionado, diff check e build Next.js 16.3.5 (49 páginas estáticas e nova rota dinâmica) aprovados. Após o build, houve somente ajuste textual de orientação na página. Evidência: docs/validacao-fila-correcao-244-2026-09-13.json.

Limites: identificação e acompanhamento dos casos entregues; resolução/versionamento da revisão pedagógica e bloqueios correspondentes ainda pendentes. Fila ainda não diferencia casos resolvidos porque essa resolução não foi implementada. Integrações com recuperação, equivalência e fechamento permanecem pendentes, assim como ensaio interativo e preferência global de fuso. Q144 continua incompleto. Sem produção, dados reais ou envio externo. Regressão integral/consolidada de referência: 235.


## Incremento 245 — Regressão integral após avaliações e correções, 13/09/2026

Executadas as suítes completas contra o estado atual do código: 771 testes unitários e 600 integrações aprovados, sem falhas ou testes pendentes. Integrações rodaram em um único processo sequencial contra PostgreSQL local descartável; não se trata de soma de reexecuções parciais. Evidência por arquivo: docs/validacao-regressao-245-2026-09-13.json.

Lint completo terminou sem erros, com os três avisos preexistentes de react-hooks/set-state-in-effect: FinanceiroPainel.tsx linhas 116/402 e Sidebar.tsx linha 38. Build Next.js 16.3.5 aprovado com 49 páginas estáticas; TypeScript passou no build. Schema diff vazio em relação às 110 migrations aplicadas. Nenhuma alteração funcional neste incremento; relatórios temporários foram consolidados no artefato versionável.

Esta regressão substitui 235 como referência mais recente de verificação integral. Não prova requisitos ainda não implementados, homologação interativa das telas, integrações externas em operação ou migração de dados reais. Resolução das revisões por correção, oportunidades de avaliação, frequência, equivalência, fechamento, portal e demais frentes da SPEC continuam incompletos. Objetivo integral permanece ativo. Sem produção, dados reais ou envio externo.


## Incremento 246 — Integridade do conteúdo de notas no banco, 13/09/2026

Migrations 111/112 (20260913090000_integridade_notas e 20260913100000_corrigir_integridade_notas), aplicadas somente ao banco local descartável, conferem notas contra a regra do registro acadêmico também em gravações diretas. Validam conjunto e unicidade de habilidades, estrutura dos campos, comentário textual limitado, formato decimal e limites da escala. Rascunho permite nota ausente; submissão, correção e aprovação exigem conteúdo completo.

Triggers executam a conferência em lançamento/proposta e novamente na aprovação. A regra é carregada da versão vinculada ao registro, não da publicação mais recente do nível. Histórico existente não é reescrito. As restrições de papel, autoria, independência e imutabilidade anteriores permanecem.

Validação: primeira execução acadêmica teve 35 aprovações/20 falhas devido a alias SQL ambíguo na função nova, corrigido pela migration 112. Reexecução dos quatro arquivos acadêmicos passou 55 testes (25 lançamentos, 14 migração de regra, 6 vínculo e 10 regras). Cinco casos novos tentam inserir diretamente nota fora da escala, habilidade diferente, número JSON em vez de decimal textual, comentário em objeto e campo extra; cada caso verifica lançamento e correção, além de confirmar que os registros válidos continuam funcionando. TypeScript, lint direcionado, schema diff vazio e diff check aprovados.

Evidência: docs/validacao-integridade-notas-246-2026-09-13.json. Sem build novo por ser alteração SQL/testes; último build e regressão integral permanecem 245. Banco local agora tem 112 migrations. Não houve produção, dados reais ou envio externo. A integridade adicional não conclui resolução das revisões acadêmicas, oportunidades, frequência, equivalência, fechamento, portal ou homologação interativa.


## Incremento 247 — Identificação da matrícula nas avaliações, 13/09/2026

Detalhe da avaliação, proposta/histórico e revisão da correção exibem identificação consistente de aluno, matrícula, oferta, turma e nível antes da operação. Consulta mínima é executada somente após autorização do vínculo; não inclui contatos ou financeiro. Quando falta código de matrícula, a tela conserva referência única pelo identificador do registro, evitando identificação apenas pelo nome do aluno.

Validação: 25 integrações de lançamentos aprovadas, com asserções adicionais da matrícula correta no histórico de correção e ausência do identificador de outro contrato do mesmo aluno. TypeScript, lint direcionado, diff check e build Next.js 16.3.5 (49 páginas estáticas) aprovados. Após o build, o fallback para matrícula sem código recebeu somente ajuste de apresentação/tipagem, verificado novamente por TypeScript e lint. Evidência: docs/validacao-identificacao-avaliacao-247-2026-09-13.json.

Sem migration nova; banco permanece com 112 migrations. Última regressão integral: 245. Não altera autorização, regras de nota ou situação dos contratos. Pendem resolução das revisões, oportunidades, frequência, equivalência, fechamento, portal e homologação interativa. Sem produção, dados reais ou envio externo.

## Incremento 248 — Registro da designação de avaliador, 13/09/2026

Primeira parte de Q152: Gestão Pedagógica/Administração pode registrar um professor ativo para uma avaliação pendente identificada por matrícula, alocação e código da avaliação. A designação é versionada, com motivo, autoria, chave de idempotência e controle de versão esperada. Revogar cria uma nova versão com destinatário vazio; não apaga a designação anterior. Não troca o professor titular da turma nem a autoria dos lançamentos anteriores.

Migration 113 (20260913110000_designacao_avaliacao) protege registros contra atualização/exclusão e confere gestão ativa, professor ativo, sequência de versões e ausência de nota oficial. A ação também confere regra, avaliação e vínculo correspondente. Registro criado somente para designação já impede a migração da regra da turma pelo bloqueio conservador existente; revisar esse caso antes de oferecer migração de regra com designações pendentes.

Validação: 27 integrações de lançamentos aprovadas, incluindo designação/revogação, repetição idempotente, preservação de titular/autoria, imutabilidade e rejeição de solicitante sem papel, destinatário sem papel docente, avaliação inexistente e avaliação oficializada. TypeScript, lint direcionado e schema diff vazio aprovados. Evidência: docs/validacao-designacao-avaliacao-248-2026-09-13.json. Migration aplicada somente ao banco local descartável; último build permanece 247 e última regressão integral 245.

Limite explícito: a designação ainda NÃO concede acesso nas consultas, lançamentos ou telas. Falta conectar o avaliador vigente às permissões limitadas da avaliação, preservar a distinção entre responsável pela realização e pelo lançamento histórico e oferecer operação pela interface. Q152 permanece parcialmente implementada. Também permanecem pendentes oportunidades, frequência, equivalência, fechamento, portal e homologação interativa. Sem produção, importação de dados reais ou envio externo.

## Incremento 249 — Consulta limitada do avaliador designado, 13/09/2026

Q152 avança da persistência para a consulta: professor ativo com a designação mais recente consulta as versões da avaliação pendente atribuída, com autoria original e contexto mínimo da matrícula. A lista do vínculo mostra somente códigos designados ou histórico próprio, salvo acesso já concedido por outro papel/vínculo. Troca ou revogação posterior invalida a designação anterior; conclusão por oficialização encerra esse acesso delegado à pendência. Histórico próprio continua seguindo sua regra de leitura.

Painel de avaliações oferece “Avaliações designadas a mim”, com paginação no banco e conferência da última designação. A consulta não abre avaliações não designadas, outro contrato do mesmo aluno, consolidado do nível ou permissões de gestão. Conferência do usuário/papel atual e das designações ocorre na transação coordenada com as alterações do vínculo.

Validação final: 29 integrações de lançamentos aprovadas, incluindo consulta, identidade/autoria, isolamento de código e matrícula, negativa do consolidado, painel/paginação, troca/revogação, retirada de papel, inativação e encerramento do acesso delegado após oficialização. Primeiro ensaio encontrou enum incorreto no fixture do teste (SECRETARIA); corrigido para SECRETARIA_ACADEMICA antes das reexecuções. TypeScript, lint direcionado e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-acesso-avaliador-249-2026-09-13.json.

Não há migration nova. Última regressão integral permanece 245. Falta liberar escrita pelo substituto com distinção entre quem realizou a avaliação e quem registra a regularização histórica, bem como a interface de gestão das designações. Q152 segue parcial. Demais fluxos acadêmicos e frentes da SPEC permanecem em implementação; não houve homologação interativa, produção, dados reais ou envio externo.

## Incremento 250 — Gestão de designações pela interface, 13/09/2026

Detalhe da avaliação oferece à Gestão Pedagógica/Administração a tela de designações, identificando matrícula, aluno, oferta, turma e avaliação. A consulta própria exige papel de gestão atualizado e valida a regra/vínculo. Exibe última designação e histórico paginado com professor, gestor, motivo e data; não retorna chaves de idempotência, hashes, contatos ou credenciais.

Equipe busca professores ativos por nome (até 50 resultados, com indicação para refinar a busca), seleciona novo responsável ou revogação explícita e informa motivo. A ação existente revalida papel, versão esperada e estado da avaliação. Formulário conserva chave de idempotência ao repetir tentativa de resultado incerto; mudar os dados gera nova tentativa. Oficialização deixa a tela somente para histórico e retira opções de alteração.

Validação: 30 integrações de lançamentos aprovadas. Novo caso verifica negativa ao professor, seleção apenas de docentes ativos, contexto da matrícula, histórico/autoria, paginação, ausência de campos internos e bloqueio após oficialização. TypeScript, lint direcionado e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-tela-designacoes-250-2026-09-13.json.

Sem migration nova; última regressão integral permanece 245. Q152 continua parcial: falta lançamento pelo substituto com autoria da realização separada da autoria da regularização histórica; a tela e consulta não habilitam escrita por consequência. Demais fluxos acadêmicos e frentes da SPEC seguem pendentes. Build não substitui homologação interativa, ainda não realizada. Sem produção, dados reais ou envio externo.

## Incremento 251 — Lançamento pelo substituto e autoria histórica, 13/09/2026

Avaliador com designação vigente pode lançar a avaliação atribuída. Servidor e banco conferem a atribuição atual do registrador e a atribuição do realizador na data informada (vínculo docente ou designação histórica válida). Regularizar trabalho de outro professor exige designação vigente, identificação do realizador, motivo e evidências textuais. Autoria da realização e do lançamento ficam separadas na versão imutável e no hash do conteúdo conferido. Registros antigos e seus hashes permanecem intactos, com campos novos opcionais para o histórico anterior.

Tela permite escolher o realizador entre os docentes vinculados/designados à avaliação e informar motivo/evidências quando outra pessoa a realizou. Histórico apresenta ambas as autorias e os dados da regularização. Revogação bloqueia novos lançamentos do substituto sem outro vínculo vigente; nota oficial continua exigindo correção independente. Conferência não pode ser feita nem pelo registrador nem pelo realizador, mesmo acumulando papel de gestão. Eventos de rascunho/submissão acrescentam realizadaPorId e indicador regularizacao, mantendo os textos na versão protegida.

Migrations 114/115 (20260913120000_autoria_avaliacao e 20260913130000_utc_autoria_avaliacao) aplicadas somente ao PostgreSQL local descartável. O teste com realização atual encontrou comparação incorreta entre timestamp UTC e clock_timestamp no fuso da sessão America/Sao_Paulo; migration 115 torna explícita a referência UTC nessas funções. Não houve alteração global de fuso do banco.

Validação final: 62 integrações acadêmicas aprovadas em execução única dos quatro arquivos (32 lançamentos, 14 migração de regra, 6 vínculo e 10 regras). Novos casos cobrem realização pelo designado, regularização de titular anterior, exigência de motivo/evidência, repetição idempotente, autoria preservada, bloqueio de conferência pelos dois participantes e rejeição de gravação direta após revogação. Primeiro ensaio de lançamentos teve 31 aprovações e uma falha de fuso, depois corrigida. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-autoria-avaliacao-251-2026-09-13.json.

Q152 avançou para avaliações regulares identificadas; ainda não comprova os fluxos completos de recuperação/segunda chamada ou autorização específica de Q151. Regularização histórica com matrícula encerrada ainda depende da situação contratual conferida; não há liberação automática. Equivalência, frequência, oportunidades, fechamento, portal e demais frentes da SPEC seguem pendentes. Última regressão integral permanece 245. Homologação interativa ainda não realizada. Sem produção, dados reais ou envio externo.

## Incremento 252 — Histórico do realizador anterior, 13/09/2026

Consulta e painel histórico reconhecem tanto autoria do lançamento quanto autoria da realização. Professor sem atribuição atual pode ler as versões que registrou ou efetivamente realizou, inclusive quando outro avaliador designado regularizou as notas. O filtro é aplicado em cada versão: uma versão posterior realizada e registrada pelo substituto não entra nesse histórico apenas por compartilhar a avaliação.

O acesso continua exigindo professor ativo e não concede edição, conferência, consolidado do nível, outras avaliações ou versões de terceiros. Gestão/titular/designado vigente conservam seus escopos próprios. Histórico anterior sem realizadaPorId segue reconhecendo autorId.

Validação: 33 integrações de lançamentos aprovadas. Novo caso encerra o vínculo do titular, registra sua avaliação por substituto e depois cria uma versão própria do substituto; confere leitura apenas da primeira, autoria de ambos, descoberta na lista/painel e negativas de edição, consolidado e outro código. TypeScript e lint direcionado aprovados; ajustada a tipagem do helper de teste para aceitar a entrada completa da ação. Evidência: docs/validacao-historico-realizador-252-2026-09-13.json. Sem alteração de tela ou migration; último build 251, última regressão integral 245.

Dependência verificada: encerramento contratual ainda tem solicitação e rascunho de acerto, sem registro final aplicado que comprove a data efetiva. Por isso, o leitor de situação contratual continua exigindo conferência para matrículas encerradas; esta etapa não presume uma data a partir do pedido. Q151 completo depende desse fluxo e das autorizações específicas. Recuperação, segunda chamada, equivalência, frequência, fechamento, portal e demais frentes continuam pendentes. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 253 — Proposta de plano de recuperação no servidor, 13/09/2026

Professor titular com atribuição vigente ou Gestão Pedagógica/Administração pode preparar proposta para matrícula/alocação ativa. O consolidado regular foi extraído para uma função transacional compartilhada, conservando autorização e cálculo; a proposta obtém esse resultado dentro da mesma transação bloqueada. Registra matrícula, nível, regra, preparador, versão, estratégias e avaliações propostas por habilidade, motivo e snapshot das notas oficiais e fontes usadas.

Recusa notas obrigatórias pendentes (segunda chamada não é recuperação), resultados suficientes, habilidades repetidas e omissão de habilidade abaixo do mínimo. Se faltar somente atingir a média geral, a proposta identifica quais habilidades serão trabalhadas. Com média geral suficiente, limita o plano às habilidades individualmente insuficientes. Chave idempotente e versão esperada impedem repetição acidental e gravação sobre versão mais recente.

Migration 116 (20260913140000_proposta_recuperacao) aplicada somente ao banco local descartável. Preserva propostas contra alteração/exclusão, confere papel/atribuição e vínculo de matrícula, nível e regra, com sequência de versões por matrícula/nível. Evento PlanoRecuperacaoProposto pertence à matrícula e identifica proposta, regra, nível, versão e habilidades.

Validação: 36 integrações de lançamentos aprovadas. Três casos novos verificam cobertura das habilidades insuficientes, snapshot/autoria, idempotência, versão, imutabilidade, negativa a professor sem atribuição, pendência de nota, notas suficientes e recuperação direcionada quando só a média geral é insuficiente. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-proposta-recuperacao-253-2026-09-13.json.

Limite: proposta ainda não tem decisão independente, reserva/consumo de tentativas, prazo de disponibilização, realização/resultado ou tela. Não autoriza recuperação, altera notas ou inicia prazo. O snapshot atual cobre resultados regulares; integrar recuperações oficiais e revalidar fontes antes da futura aprovação. Q132/Q135 e demais regras de recuperação permanecem parciais. Segunda chamada, autorizações Q151, equivalência, frequência, fechamento, portal e demais frentes seguem pendentes. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 254 — Decisão independente do plano de recuperação, 13/09/2026

Ação de decisão permite a outra pessoa da Gestão Pedagógica/Administração aprovar ou rejeitar a proposta identificada por versão/hash. Aprovação reconfere vínculo ativo, matrícula, regra, versão mais recente e snapshot de notas/fontes dentro da transação coordenada com os lançamentos. Correção de nota posterior à proposta exige nova preparação. Confere também que a regra prevê tentativas positivas nas habilidades propostas; oportunidades extras continuam exigindo fluxo próprio.

Migration 117 (20260913150000_decisao_plano_recuperacao), aplicada somente ao banco local descartável, cria decisão única e imutável por proposta. Banco confere gestão ativa, independência em relação ao preparador, versão e vínculo. Repetir a mesma decisão confirmada retorna o resultado anterior; tentar outra decisão não o substitui. Eventos PlanoRecuperacaoAprovado/PlanoRecuperacaoRejeitado ficam vinculados à matrícula, com proposta, decisão, versão e motivo.

Validação: 38 integrações de lançamentos aprovadas. Casos novos cobrem autoaprovação na ação e no SQL, hash incorreto, aprovação independente, idempotência, imutabilidade, versão superada e invalidação por correção oficial de nota, com rejeição ainda possível. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-decisao-recuperacao-254-2026-09-13.json.

Limite explícito: decisão aprova o plano pedagógico, mas não libera nem reserva uma tentativa, inicia prazo ou publica resultado. Saldo disponível, reservas/consumos, oportunidades extras, disponibilização, aplicação, notas e telas ainda precisam ser implementados. Antes da liberação, reconferir condições e saldo; limite positivo configurado não comprova saldo disponível. Aprovação com base no consolidado regular também não substitui futura integração de recuperações anteriores. Q135 e o fluxo completo permanecem parciais. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 255 — Reserva de tentativas por habilidade, 13/09/2026

Gestão Pedagógica/Administração pode reservar uma tentativa para habilidades identificadas de um plano aprovado. A ação reconfere hash, aprovação, vínculo ativo, matrícula, regra e notas/fontes atuais; restringe a reserva às habilidades do plano. Reserva agrupa itens por habilidade, com autoria, motivo e idempotência. Contagem pertence à matrícula e ao nível e atravessa versões do plano, sem reiniciar a cota ao editar uma proposta.

Migration 118 (20260913160000_reserva_tentativa_recuperacao), aplicada somente ao banco local descartável, preserva reservas/itens contra edição ou exclusão, exige plano aprovado e gestão ativa na reserva e confere habilidade/limite também no banco. Trava da matrícula serializa concorrência para a cota. Evento TentativaRecuperacaoReservada identifica reserva, proposta, nível e habilidades na matrícula.

Validação: 40 integrações de lançamentos aprovadas. Casos novos verificam papel, aprovação, habilidade fora do plano, idempotência, evento e imutabilidade, além de duas reservas concorrentes disputando a última oportunidade: apenas uma é aceita. Nova versão do plano não libera outra tentativa de fala esgotada, enquanto escrita mantém sua própria disponibilidade; tentativa direta no SQL também é rejeitada ao exceder o limite. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-reserva-recuperacao-255-2026-09-13.json.

Limite: reservas ainda não têm realização, consumo definitivo, liberação por cancelamento, falta, extras aprovados ou prazo de disponibilização. Neste estágio, todos os itens reservados permanecem ocupando a cota; implementar movimentos de consumo/liberação preservando esse registro antes de operar o ciclo completo. Reserva não cria nota, presença, cobrança ou agendamento. Telas e integração de resultados de recuperação permanecem pendentes. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 256 — Cancelamento da tentativa pela escola, 13/09/2026

Gestão Pedagógica/Administração pode cancelar a tentativa reservada por iniciativa da escola, com motivo e evidência. Cancelamento é único e imutável, separado da reserva e de seus itens; libera todas as habilidades daquele agrupamento na contagem da cota, sem apagar histórico ou criar consumo. Repetição exata confirma a decisão existente; conteúdo diferente não a substitui. Repetir a criação original da reserva também não reabre a reserva cancelada.

Migration 119 (20260913170000_cancelamento_reserva_recuperacao), aplicada somente ao banco local descartável, registra o cancelamento e altera a contagem de itens ocupados no trigger de limite. Nova reserva usa apenas itens não cancelados; a reserva cancelada não recebe outros itens, inclusive por gravação direta. Liberação e nova reserva são serializadas pela matrícula. Evento TentativaRecuperacaoCanceladaPelaEscola preserva reserva, proposta, cancelamento, habilidades, motivo e autoria.

Validação: 41 integrações de lançamentos aprovadas. Caso novo esgota fala/escrita, cancela uma reserva, confere devolução única e aceita uma substituta, voltando a impedir excesso. Verifica negativa ao professor, idempotência, preservação dos itens, evento único, imutabilidade e bloqueio de novos itens na reserva cancelada. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-cancelamento-recuperacao-256-2026-09-13.json.

Limite: cancelamento institucional da tentativa reservada ainda não altera agenda externa ou encontros da turma; quando houver agendamento vinculado, integrar suas aprovações e efeitos. Não trata cancelamento do aluno, falta ou realização, que ainda precisam de consumo/liberação e conferência temporal próprios. Antes de adicionar consumo/resultado, impedir este cancelamento em tentativa já realizada/consumida; esses registros ainda não existem nesta etapa. Prazos, extras, resultados e telas continuam pendentes. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 257 — Disponibilização e prazo do plano, 13/09/2026

Gestão registra quando o plano aprovado foi disponibilizado ao aluno, as condições oferecidas e a evidência da comunicação. A data não pode anteceder a aprovação nem ser futura. A ação reconfere vínculo, matrícula e fontes de notas; prazo em minutos vem da regra vinculada e gera data-limite explícita. Registro único/imutável impede reiniciar a contagem por edição; repetição exata confirma o mesmo registro.

Nova reserva exige disponibilização registrada e instante atual anterior ao limite, na ação e no banco. No instante limite, novas reservas ficam bloqueadas. Isso não consome uma reserva anterior nem cria falta, nota zero ou conclusão. Migração 120 (20260913180000_disponibilizacao_recuperacao), aplicada somente ao PostgreSQL local descartável, valida papel, aprovação, datas, cálculo do prazo e os textos de condições/comunicação. Comparações SQL usam UTC explicitamente.

Validação: 42 integrações de lançamentos aprovadas. Caso novo confere reserva bloqueada antes da disponibilização, datas anterior à aprovação/futura rejeitadas, cálculo pelo parâmetro fictício da regra de teste, idempotência, negativa à edição, bloqueio no instante limite com relógio da aplicação controlado, evento único e imutabilidade. Fixtures dos fluxos de reserva agora registram a disponibilização explicitamente. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-disponibilizacao-recuperacao-257-2026-09-13.json.

Limite: registra comunicação realizada pela escola e sua evidência; não envia mensagem ou disponibiliza portal automaticamente. Ainda faltam prorrogação independente, tratamento de indisponibilidade posterior, agendamento/aplicação, consumo e resultado, cancelamento do aluno/falta e telas. Reservas anteriores ao vencimento permanecem no histórico/cota até movimento próprio. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 258 — Prorrogação independente do prazo, 13/09/2026

Professor com atribuição vigente ou Gestão Pedagógica/Administração propõe extensão do prazo de uma disponibilização, identificando prazo anterior, novo limite futuro, versão esperada e motivo. Outra pessoa da gestão aprova ou rejeita. Aprovação exige proposta mais recente e base ainda igual ao prazo vigente; preserva proposta/decisão e não edita a disponibilização original. Repetições idempotentes não criam outra extensão.

Prazo efetivo é a última extensão aprovada, com fallback para o limite original. Consulta transacional e função SQL usam essa referência ao conferir novas reservas. Rejeição, proposta pendente ou superada não altera prazo. Extensão não reinicia cota, consome tentativa, concede oportunidade extra ou libera matrícula pausada/encerrada.

Migration 121 (20260913190000_prorrogacao_recuperacao), aplicada somente ao PostgreSQL local descartável, protege propostas/decisões e confere papel, atribuição, independência, versão e datas em UTC. Eventos ProrrogacaoRecuperacaoProposta/Aprovada/Rejeitada preservam referências e motivo no alcance da matrícula.

Validação: 44 integrações de lançamentos aprovadas. Casos novos cobrem repetição, autoaprovação na ação e no SQL, aprovação independente, prazo efetivo igual na aplicação e no banco, original preservado, reserva dentro do intervalo estendido com relógio da aplicação controlado, imutabilidade, proposta superada e rejeição sem mudança do limite. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-prorrogacao-recuperacao-258-2026-09-13.json.

Limite: ainda não comunica automaticamente o novo prazo ao aluno, não resolve indisponibilidade posterior por conta própria e não oferece tela. Agendamento/aplicação, resultados, consumo, faltas/cancelamentos do aluno, oportunidades extras e demais fluxos seguem pendentes. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 259 — Realização e consumo por habilidade, 13/09/2026

Professor titular com atribuição vigente registra a realização de cada habilidade reservada, com data e evidência. Confere reserva não cancelada, período após reserva/disponibilização e antes do prazo autorizado na data da realização, vínculo histórico do aluno/docente e situação contratual nessa data. Prorrogação aprovada depois do fato não é usada para autorizar retroativamente a realização. Repetição exata confirma o mesmo registro; alteração exige futuro fluxo de correção.

Realização imutável consome apenas o item/habilidade correspondente. Itens realizados continuam ocupando a cota mesmo quando a escola cancela o restante da reserva; cancelamento libera somente habilidades pendentes. Reserva inteiramente realizada não pode ser liberada, inclusive por SQL. A mesma reserva pode agrupar habilidades realizadas em momentos distintos, sem antecipar consumo das demais.

Migration 122 (20260913200000_realizacao_recuperacao), aplicada somente ao banco local descartável, cria o registro de realização e adapta limite/cancelamento. Função de prazo na data considera somente extensões aprovadas até o instante da avaliação. Servidor mantém a conferência contratual histórica; matrícula encerrada sem histórico suficiente continua exigindo conferência própria.

Validação: 46 integrações de lançamentos aprovadas. Casos novos verificam professor/gestão, datas anterior à reserva e futura, realização idempotente, evidência preservada, consumo individual, cancelamento parcial sem devolução de consumo, limites separados, bloqueio da realização de item cancelado, ausência de alteração automática da nota, evento e imutabilidade. Caso de realização integral confirma negativa de cancelamento na ação e no SQL. TypeScript, lint direcionado, schema diff vazio e build Next.js 16.3.5 com 49 páginas estáticas aprovados. Evidência: docs/validacao-realizacao-recuperacao-259-2026-09-13.json.

Limite: ainda não registra nota de recuperação nem sua conferência independente. Ao implementar notas, a habilidade já realizada deve continuar recebendo seu resultado mesmo se outras habilidades da reserva foram canceladas; não usar o cancelamento do agrupamento para apagar a realização. Substituição/designação do avaliador de recuperação, correção da ocorrência, falta/cancelamento do aluno, extras, agenda e telas permanecem pendentes. Não altera frequência, mensalidade ou progressão. Última regressão integral 245. Sem homologação interativa, produção, dados reais ou envio externo.

## Incremento 260 — Notas de recuperação e consolidação, 13/09/2026

Cada realização por habilidade recebe versões imutáveis de nota e comentário destinado ao aluno: rascunho pode não ter nota; submissão exige valor na escala da regra vinculada ao plano. Professor que realizou, com atribuição vigente, registra. Outra pessoa da Gestão Pedagógica/Administração confere a versão e seu hash; acúmulo de papéis não autoriza autoaprovação. Reenvio exato confirma o registro anterior. Nota já oficializada não recebe edição comum; correção própria permanece pendente.

A habilidade realizada recebe nota mesmo quando a escola cancelou os demais itens da reserva. O consolidado carrega notas do vínculo, matrícula, nível e regra corretos, vinculadas a planos aprovados. Notas não oficializadas não melhoram resultado; após conferência, aplica o maior entre resultado vigente e nota de recuperação. Preserva notas regulares, todas as tentativas e fontes das versões/decisões. Novas propostas de recuperação passam a considerar o consolidado com recuperações; mudanças nas fontes invalidam a revisão anterior. A tela de acompanhamento apresenta resultado regular, notas de recuperação, pendências e resultado vigente. Continua sem fechamento, frequência ou progressão automática.

Migration 123 (20260913210000_notas_recuperacao), aplicada somente ao banco local descartável: NotaRecuperacao e DecisaoNotaRecuperacao, autoria, versões, idempotência, imutabilidade, escala e aprovação independente também protegidas por triggers.

Validação: 47 integrações de lançamentos e 27 testes do cálculo aprovados; TypeScript, lint direcionado e schema diff vazio. Build Next.js 16.3.5 aprovado com 49 páginas estáticas; verificação final de tipos cobre o acréscimo posterior dos identificadores das fontes. Casos novos incluem cancelamento parcial, rascunho/submissão, escala inválida na ação e SQL, professor não atribuído, gestão sem lançamento docente, autoaprovação negada também em SQL, hash incorreto, idempotência, nota inferior preservada sem redução, proibição de edição da oficial e imutabilidade. Evidência: docs/validacao-notas-recuperacao-260-2026-09-13.json. Última regressão integral: 245.

Limites: ainda faltam consultas/telas próprias para preparar e conferir notas de recuperação, designação do substituto para esse fluxo, correções de nota de recuperação, autorização específica após pausa/encerramento, faltas/cancelamentos do aluno, oportunidades extras e ligação com agenda. Realização sem versão de nota ainda deve entrar na futura conferência de pendências de fechamento; não é prova de resultado final. Sem homologação interativa, produção ou envios externos. O objetivo completo permanece em implementação.

## Incremento 261 — Consulta e telas de notas de recuperação, 13/09/2026

Entrega consultas autorizadas e duas rotas: /academico/recuperacoes?alocacaoId=... lista realizações do vínculo, inclusive sem nota; /academico/recuperacoes/[realizacaoId] apresenta identificação mínima da matrícula, habilidade, evidência, escala, histórico e formulários de lançamento/conferência. Navegação a partir das avaliações da matrícula. Listagem paginada em 50 e histórico em 20, com continuação explícita. Datas identificadas em UTC nesta tela; preferência de visualização ainda não integrada.

Servidor revalida usuário ativo e papéis sob bloqueio do vínculo. Gestão e professor atual consultam o vínculo; ex-professor ativo consulta somente realizações próprias e suas versões, sem escrita. Professor não atribuído e usuário inativo não consultam. Campos de contato e financeiro não são projetados. Hash da versão só é entregue quando há permissão de decisão; chave de idempotência não é exposta. Formulários usam as ações do incremento 260, com nova conferência no servidor. Aprovação exige seleção explícita e motivo; versão antiga não oferece aprovação. Rascunhos aceitam nota ausente; submissão exige nota na escala. Reenvio após resultado incerto conserva chave enquanto o conteúdo não muda.

Validação: 47 integrações de lançamentos aprovadas; cenário de saída repetido após remover o papel de gestão do professor. Cobertura inclui realização sem nota na lista, autoria, gestão sem lançamento docente, visibilidade das ações/hash, campos privados ausentes, ex-professor em leitura e bloqueio de inativo. TypeScript e lint direcionado aprovados; build Next.js aprovado. Evidência: docs/validacao-telas-recuperacao-261-2026-09-13.json.

Limites: não houve homologação interativa em navegador. A criação/decisão de planos, reserva e realização ainda precisam das próprias telas; este incremento permite trabalhar nas realizações já registradas. Designação de substituto, correções e exceções continuam pendentes. Descoberta de vínculos exclusivamente por histórico de recuperação ainda deve ser integrada ao painel geral. Nenhuma migration adicional, produção, envio externo ou conclusão do objetivo total.

## Incremento 262 — Preparação e revisão de planos pela equipe, 13/09/2026

Rota /academico/recuperacoes/planos?alocacaoId=... permite consultar o consolidado, preparar estratégia/avaliação proposta por habilidade e decidir planos. Navegação a partir da matrícula acadêmica. As habilidades insuficientes são obrigatórias; quando só falta a média geral, a equipe escolhe quais trabalhar. Quantidades, pesos, mínimos e prazos não recebem valores presumidos. Proposta usa a ação e idempotência existentes, com versão esperada e chave conservada em reenvio de resultado incerto.

Consulta autoriza primeiro o consolidado, depois projeta identificação mínima e planos do vínculo. Não concede leitura dos planos ao professor sem atribuição atual; histórico próprio de notas continua nas telas específicas. Lista 20 propostas por página, preservando base numérica e atividades de cada versão. Gestão independente recebe hash apenas para decisão; preparador não recebe ação para autoaprovar. Tela sinaliza mudança das fontes, limita aprovação à versão atual com vínculo/regra válidos, notas insuficientes e limite configurado positivo. A ação de decisão revalida essas condições. Aprovação de plano não reserva tentativa nem disponibiliza prazo automaticamente.

Validação: 48 integrações de lançamentos aprovadas. Novo cenário verifica ausência de nota impedindo proposta, insuficiência permitindo, base preservada, autoaprovação indisponível com papéis acumulados, versão antiga sem aprovação, paginação por versão, decisão pelo hash consultado, professor não atribuído/inativo negados e ausência de contato/financeiro/chave de idempotência. TypeScript, lint direcionado e build Next.js aprovados. Sem migration adicional. Evidência: docs/validacao-planos-recuperacao-262-2026-09-13.json.

Pendências: telas de disponibilização, reserva e realização ainda precisam ser conectadas ao plano aprovado; também permanecem designação específica, correção, oportunidades extras, faltas/cancelamentos do aluno e autorização de exceções. Sem homologação interativa, produção ou envio externo. Última regressão integral 245. Escopo completo ainda em implementação.

## Incremento 263 — Operação do plano aprovado pela interface, 13/09/2026

Rota /academico/recuperacoes/planos/[propostaId] conecta o plano aprovado às ações existentes de disponibilização, reserva de tentativas, realização por habilidade e cancelamento pela escola. Exibe identificação mínima, aprovação, condições/evidência de comunicação, prazo original e vigente, limite/consumo/reserva/disponibilidade por habilidade e reservas paginadas em 20. Realização possui link para nota/conferência. A reserva de oportunidade não agenda um encontro; a ligação à agenda permanece pendente.

Gestão registra disponibilização e reserva; professor atual registra realização; gestão cancela pendências da escola. Autorizações e requisitos são novamente conferidos pelas ações. As notas/fontes e o vínculo são conferidos antes de apresentar avanço. O saldo inclui todas as versões do plano na matrícula/nível, preserva consumo realizado após cancelamento parcial e libera apenas itens pendentes. Nenhum valor de cota ou prazo foi presumido. Realização e disponibilização aceitam data/hora e fuso informado, convertidos no servidor com rejeição de horário inválido/ambíguo. Leitura de datas segue UTC explicitamente nesta tela; preferência global ainda não integrada. Comunicação é evidência registrada pela equipe, sem envio automático.

Validação: 49 integrações de lançamentos aprovadas, incluindo plano ainda não aprovado, disponibilidade e flags por papel, conversão de America/Sao_Paulo para o instante persistido, fuso inválido, reserva/realização/cancelamento parcial e saldo exato por habilidade, dados privados ausentes e professor não atribuído negado. TypeScript, lint direcionado e build Next.js aprovados. Sem migration adicional. Evidência: docs/validacao-operacao-recuperacao-263-2026-09-13.json.

Pendências: telas de prorrogação, designação de substituto, correções, oportunidades extras, faltas/cancelamentos do aluno e exceções de matrícula; integração com agenda e comunicação/portal. Sem homologação interativa, produção ou envio externo. Última regressão integral 245. O fluxo implementado não prova entrega integral do módulo nem do projeto.

## Incremento 264 — Prorrogação pela interface, 13/09/2026

Rota /academico/recuperacoes/planos/[propostaId]/prorrogacoes conecta proposta e decisão de extensão do prazo, com navegação pela operação do plano. Exibe prazo original, vigente e histórico paginado em 20 propostas, autoria, justificativa e decisão. Professor atual/gestão propõe; outra pessoa da gestão decide. Autoaprovação não aparece mesmo com papéis acumulados. Aprovação exige versão mais recente, base igual ao prazo vigente, novo prazo posterior e futuro e matrícula ativa; ação revalida sob bloqueio.

Novo prazo é informado em data/hora e fuso explícito, convertido no servidor. A interface conserva chave em reenvios incertos e registra uma nova proposta somente conforme a versão esperada. Prazo original não é sobrescrito, rejeição conserva o vigente e proposta sozinha não muda o prazo nem concede tentativas. Matrícula não ativa não recebe nova proposta por esta tela; autorização específica permanece fluxo próprio. Consulta autoriza o vínculo antes de projetar os dados; hash só aparece para decisão permitida e dados de contato/financeiro não são consultados.

Validação: 49 integrações de lançamentos aprovadas. Cenários de prorrogação agora verificam a consulta sem disponibilização, proposta pela conversão de America/Costa_Rica, reenvio coerente com a ação original, visibilidade de autoaprovação, versão superada/paginação, hash de decisão, prazo vigente após aprovação, preservação do original e professor não atribuído negado. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-interface-prorrogacao-264-2026-09-13.json. Sem migration adicional. Última regressão integral 245.

Limites: comunicação da nova data ao aluno ainda não automatizada; exibição usa UTC explícito, sem preferência global integrada. Designação, correções, oportunidades extras, faltas/cancelamentos do aluno, exceções e integração com agenda permanecem pendentes. Sem homologação interativa, produção ou envios externos. Objetivo completo ainda em implementação.

## Incremento 265 — Regressão completa após os fluxos de recuperação, 13/09/2026

Executada regressão integral do código atual: 771 testes unitários e 629 integrações aprovados, sem falhas ou testes pendentes. A integração foi executada em processo único no PostgreSQL local descartável. Tipos aprovados e schema diff vazio, com 123 migrations aplicadas. Lint completo sem erros e três avisos preexistentes de react-hooks/set-state-in-effect em FinanceiroPainel/Sidebar. Build do mesmo código validado no incremento 264, Next.js 16.3.5, 51 páginas estáticas. Evidência por arquivo: docs/validacao-regressao-265-2026-09-13.json.

Esta regressão substitui 245 como referência integral mais recente. A suíte abrange somente o comportamento coberto pelos testes existentes; não demonstra conclusão dos requisitos ainda pendentes, homologação interativa, operação dos provedores externos ou migração real. A leitura atual de src/server/matricula/entrada-ativacao.ts confirma bloqueio explícito da ativação de particulares no fluxo legado; src/server/matricula/encerramento-rascunho.ts preserva uma versão de trabalho, sem constituir execução final do encerramento. Essas pendências continuam abertas. Nenhum código de produto foi alterado neste incremento e nenhum envio externo foi realizado. A execução do objetivo completo continua aberta.

## Incremento 266 — Designação docente limitada à tentativa de recuperação, 13/09/2026

Gestão designa/revoga professor ativo para item/habilidade de uma reserva, com motivo, versão e idempotência. Designações são imutáveis; troca e revogação preservam o histórico. Item cancelado sem realização ou com nota já oficializada não recebe nova designação. Não reinicia prazo, reserva ou cota e não transfere titularidade da turma. Migration 124 (20260913220000_designacao_recuperacao), aplicada ao banco local descartável, acrescenta DesignacaoRecuperacao e guardas equivalentes no banco.

Professor designado registra realização somente com autorização vigente e válida no instante informado, mantendo a elegibilidade histórica/contratual e o prazo. Também pode registrar nota de realização feita por outro professor, preservando o professor realizador e o autor de cada versão da nota. Oficialização exige pessoa distinta de ambos. Consulta e lista de notas incluem apenas realizações designadas ou histórico próprio, sem abrir consolidado, plano inteiro ou outra habilidade. Revogação retira escrita; realizações/notas próprias permanecem em leitura. A tela da nota identifica separadamente o professor realizador. Designação deixa de conceder acesso a pendência ao oficializar, preservando apenas os demais acessos legítimos.

Validação: 51 integrações de lançamentos aprovadas, incluindo professor sem poder de designação, idempotência, nota por substituto com autoria preservada, negação de acesso ao plano/consolidado e habilidade não atribuída, revogação, impedimento de ambos os autores na oficialização, bloqueio após oficialização, imutabilidade, realização antes da designação negada, realização após designação aceita e usuário inativo bloqueado. TypeScript, lint direcionado e schema diff vazio aprovados; build Next.js aprovado. Evidência: docs/validacao-designacao-recuperacao-266-2026-09-13.json. Última regressão integral 265.

Limites: ainda faltam consulta/tela administrativa de designação e fila de tentativas designadas para permitir descobrir e operar a atribuição antes da realização. Acesso direto à nota já realizada está integrado. Regularização de realização antiga atribuída a terceiro, correções, oportunidades extras, ocorrências do aluno, exceções e agenda permanecem pendentes. Sem homologação interativa, produção ou envio externo. Objetivo total permanece aberto.

## Incremento 267 — Gestão da designação de recuperação pela interface, 13/09/2026

Rota /academico/recuperacoes/tentativas/[itemReservaId]/designacao permite à Gestão Pedagógica/Administração consultar e alterar o avaliador de um item, a partir da operação do plano. Consulta transacional revalida o papel antes de projetar identificação mínima, professor realizador, designação atual e histórico paginado em 20. Busca de professores ativos por nome, limitada a 50 com indicação para refinar; sem contatos ou credenciais. Atual professor inativo/sem papel docente é sinalizado, preservando o histórico.

Formulário exige escolha explícita e motivo; permite revogação, usa versão esperada e conserva a chave em reenvio incerto do mesmo conteúdo. Ação e trigger existentes continuam conferindo pendência/versão/alvo. Item sem pendência fica em leitura, inclusive depois de oficialização; não oferece busca/alteração. Link administrativo aparece somente para gestão na operação do plano. Não altera autoria, turma, prazo ou saldo.

Validação: 51 integrações de lançamentos aprovadas; cenário de designação ampliado para consultar candidatos, busca sem resultado, leitura negada ao professor, versão atual/revogação/histórico anterior e bloqueio de edição após oficialização, sem campos privados. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-tela-designacao-recuperacao-267-2026-09-13.json. Sem migration adicional; última regressão integral 265.

Pendências: fila própria e acesso da tentativa para o professor designado antes da realização; regularização de realização antiga por terceiro, correções, extras, ocorrências do aluno, exceções e agenda. Sem homologação interativa, produção ou envio externo. Objetivo completo permanece em implementação.

## Incremento 268 — Fila e detalhe da tentativa designada, 13/09/2026

Fila /academico/recuperacoes/designadas, ligada ao painel de avaliações para professores, lista até 20 tentativas pendentes com atribuição vigente, identificação mínima e continuidade por cursor. Consulta exige professor ativo mesmo quando há papel administrativo. Usa o estado atual da designação, exclui itens cancelados sem realização e itens com nota oficializada. Não inclui outras habilidades do mesmo plano por consequência de uma atribuição.

Detalhe /academico/recuperacoes/tentativas/[itemReservaId] revalida a atribuição sob bloqueio do vínculo e apresenta somente a estratégia/avaliação da habilidade selecionada, datas da reserva/disponibilização, prazo vigente e eventual realização. Antes de realizada, permite registrar o fato usando as ações com autorização histórica já implementadas; depois, abre a nota/conferência com autoria preservada. Não abre o consolidado nem o plano inteiro. Revogação ou oficialização retiram a tarefa da fila e encerram o acesso por designação; histórico próprio continua na consulta de notas.

Validação: 51 integrações de lançamentos aprovadas. Cenários de designação agora verificam fila antes/depois da realização, detalhe da habilidade atribuída, negação de outra habilidade, ausência de campos privados, remoção após revogação e oficialização e bloqueio de gestão sem papel docente/usuário inativo. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-fila-recuperacao-268-2026-09-13.json. Sem migration adicional; última regressão integral 265.

Pendências: regularização de realização antiga por terceiro, correções, oportunidades extras, faltas/cancelamentos do aluno, exceções contratuais, integração com agenda e comunicação/portal. Preferência global de fuso ainda não integrada às novas telas. Sem homologação interativa, produção ou envio externo. Escopo completo permanece em implementação.

## Incremento 269 — Descoberta do histórico próprio de recuperação, 13/09/2026

A área Minhas recuperações distingue atribuições pendentes e Meu histórico. O histórico encontra realizações do professor ou registros de nota de sua autoria, mesmo após revogação/oficialização, com link direto à consulta de notas. Designação sem realização/lançamento não concede histórico por si só. Consulta continua exigindo professor ativo e conserva projeção mínima e paginação por cursor; uma realização aparece uma vez mesmo que possua várias versões de nota. Não abre o histórico de outras habilidades/alunos por associação ao plano.

Links históricos seguem as permissões da consulta de notas existente: autoria preservada, acesso em leitura sem atribuição vigente e sem reabrir o plano. A navegação resolve a descoberta de recuperações que deixaram a fila de pendências, sem conceder escrita por escolher o filtro histórico.

Validação: 51 integrações de lançamentos aprovadas; cenários de designação ampliados para histórico vazio antes do trabalho, presença por autoria da nota ou realização, persistência após revogação, cursor sem repetição, campos privados ausentes e inativo negado. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-historico-recuperacao-269-2026-09-13.json. Sem migration adicional; última regressão integral 265.

Pendências: regularização de realização antiga por terceiro, correções, oportunidades extras, ocorrências do aluno, exceções, integração com agenda/portal e preferência global de fuso. Sem homologação interativa, produção ou envio externo. O objetivo completo permanece em implementação.


## Incremento 270 — Regularização da realização de recuperação, 13/09/2026

O professor com designação vigente para a tentativa pode registrar uma avaliação realizada por outro professor, informando realizador, data efetiva, motivo e evidência. A consulta oferece somente nomes de professores com vínculo histórico na turma ou designação no item; o servidor confere a atribuição na data exata. O realizador pode estar atualmente inativo. O registrador precisa continuar ativo, com papel docente e designação específica; ser titular da turma não basta para registrar em nome de terceiro.

RealizacaoRecuperacao preserva separadamente professorId (realizador), registradaPorId e motivoRegularizacao. A migration 125 acrescenta campos sem reescrever históricos anteriores e reforça a proteção de inserção/imutabilidade no banco. Reenvio idêntico conserva o registro; alteração exige fluxo próprio. Mantêm-se prazo autorizado na data, reserva, vínculo histórico do aluno e situação contratual aplicável. Não cria nota, presença, progressão ou novo saldo.

A tela da tentativa designada permite escolher o realizador e exige motivo quando for outra pessoa. A consulta de notas exibe as duas autorias. Após revogação, o registrador encontra sua realização em Meu histórico, em leitura; isso não abre notas de outros autores nem o plano inteiro. Oficialização da nota continua independente do autor da nota e do realizador.

Validação: 52 integrações de lançamentos aprovadas, incluindo ausência de designação/motivo, realizador sem vínculo, item não atribuído, realizador atualmente inativo, replay, imutabilidade SQL e leitura própria após revogação. TypeScript, lint direcionado, build Next.js e comparação do schema aprovados. Evidência: docs/validacao-regularizacao-recuperacao-270-2026-09-13.json. Migration aplicada somente ao banco descartável local.

Pendências: correções de recuperações, oportunidades extras, ocorrências do aluno, exceções contratuais, segunda chamada, frequência, equivalências, fechamento final e integração com agenda/portal. Sem homologação interativa, produção ou envio externo. A entrega integral permanece em implementação.


## Incremento 271 — Correções de notas de recuperação, 13/09/2026

Notas de recuperação oficializadas agora possuem propostas de correção versionadas, preparadas pelo professor atualmente responsável pela turma ou pela Gestão Pedagógica/Administração. Cada proposta identifica a nota original, a origem vigente, o novo valor/comentário e o motivo. Outra pessoa da gestão revisa e decide. Acúmulo de papéis não permite autoaprovação. A proposta mantém o resultado anterior até aprovação válida; rejeição não altera o consolidado. Reenvio do mesmo conteúdo é idempotente e origem/versão superadas são recusadas.

Modelos PropostaCorrecaoRecuperacao e DecisaoCorrecaoRecuperacao preservam histórico, autoria e impactos. Migration 126 protege imutabilidade, nota oficial de origem, papel/vínculo docente, versão sequencial, escala e decisão independente no banco. O servidor também confere hash da proposta e da revisão de impactos antes de aplicar. Inclui mudanças acadêmicas aprovadas/executadas e planos de recuperação aprovados do vínculo; registra evento de revisão necessária para progressões afetadas, sem transferir o aluno nem desfazer decisões automaticamente.

O consolidado usa a última correção aprovada de cada nota de recuperação e conserva a nota original no histórico. Corrigir uma recuperação indevidamente alta pode reduzir o resultado vigente: o melhor resultado é recalculado com as notas válidas, sem tratar a correção como nova tentativa e sem consumir oportunidade. As fontes da consolidação incluem a correção aprovada, invalidando propostas dependentes cuja base tenha mudado.

A tela /academico/recuperacoes/correcoes/[notaId], acessível pela nota oficial aos perfis autorizados, identifica matrícula e habilidade, mostra original/vigente, permite propor, conferir impactos e decidir, com histórico paginado. Não expõe chaves ou hashes no histórico docente; a revisão para decisão exige gestão. A consulta da recuperação mostra o valor corrigido e preserva a nota anterior. Não devolve escrita a professor desligado ou sem atribuição vigente.

Validação: 53 integrações de lançamentos aprovadas, incluindo redução de recuperação 8 para 4 restaurando resultado original 5, preservação da nota 8 no histórico, rejeição, replay, escala, origem superada, acesso indevido, autoaprovação no servidor/banco, imutabilidade, histórico e paginação. TypeScript, lint direcionado, build Next.js e comparação do schema aprovados. Evidência: docs/validacao-correcao-recuperacao-271-2026-09-13.json. Migration aplicada somente ao banco descartável local.

Limites: esta entrega corrige nota/comentário, não a realização, habilidade ou consumo da tentativa. A resolução operacional das revisões de progressão, fila consolidada dessas pendências de recuperação, oportunidades extras, ocorrências do aluno, segunda chamada, frequência, equivalências, fechamento final e integração com portal continuam pendentes. Sem homologação interativa, produção ou envio externo. O escopo integral permanece em implementação.


## Incremento 272 — Fila conjunta de impactos das correções, 13/09/2026

A fila /academico/correcoes passa a consultar correções regulares e de recuperação que foram aprovadas com mudanças acadêmicas afetadas. A paginação é aplicada ao conjunto das duas fontes antes de carregar os detalhes, em ordem de decisão e identificador; cada página contém no máximo 20 casos, com indicação da próxima. Isso evita que uma fonte esconda ou duplique a outra na navegação.

Cada item informa matrícula/aluno, origem da correção, avaliação ou habilidade, responsável/data da aplicação e as mudanças acadêmicas afetadas. Preserva a situação registrada na correção e confere a situação atual pelo vínculo de origem. Links levam às correções correspondentes e às movimentações da matrícula. Acesso exige Gestão Pedagógica/Administração ativa, revalidada no servidor; não projeta contatos, credenciais ou chaves de operação.

Validação: 53 integrações de lançamentos aprovadas. O cenário de recuperação agora cria uma mudança aprovada depois da revisão, confirma que a aprovação fica desatualizada e exige nova conferência. Após aplicação, o caso aparece na fila sem desfazer a mudança. Cobertura adicional verifica fila mista com 21 correções em duas páginas, sem repetição/perda, acesso negado a professor e ausência de campos privados. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-fila-correcoes-272-2026-09-13.json.

Não há nova migration. A fila torna as pendências encontráveis; não afirma que foram resolvidas. Resolução operacional da revisão de progressão continua pendente, assim como correções da realização/consumo, oportunidades extras, ocorrências do aluno, segunda chamada, frequência, equivalências, fechamento final e portal. Sem homologação interativa, produção ou envio externo. Última regressão integral: incremento 265; entrega completa permanece em implementação.


## Incremento 273 — Regressão integral e conferência das pendências, 13/09/2026

Regressão executada após os incrementos 266–272: 771 testes unitários e 633 integrações aprovados, sem falhas ou casos pendentes. Integração em processo único, somente no banco descartável local. Lint completo sem erros e com três avisos preexistentes react-hooks/set-state-in-effect (FinanceiroPainel.tsx:116/402 e Sidebar.tsx:38). TypeScript aprovado, schema diff vazio com 126 migrations. Build do mesmo código executável foi aprovado no incremento 272 (52 páginas estáticas). Evidência por arquivo: docs/validacao-regressao-273-2026-09-13.json.

A regressão confirma os comportamentos cobertos pelos testes existentes, não a conclusão do escopo. A conferência direta do código mantém pendências importantes: entrada-ativacao.ts bloqueia corretamente o caminho mensal legado para particulares; acoes.ts ainda exige taxa e primeira mensalidade nesse caminho; a conversão dos horários reservados em encontros da contratação não está integrada à ativação. Contratos por hora precisam conferir adiantamento exigido/dispensado conforme contrato, sem inventar mensalidade. O rascunho de acerto em encerramento-rascunho.ts não equivale a aprovação ou efetivação final.

Próxima implementação da ativação particular deve integrar, na mesma operação, condições aceitas e pagamentos exigidos, disponibilidade/reserva atual, encontros vinculados à matrícula, consumo da reserva e mudança de estado. Assinatura externa e a comprovação de todas as assinaturas exigidas continuam com dependências próprias. Não remover as recusas existentes antes de implementar esses efeitos e seus testes.

Sem mudanças de produto nesta rodada, homologação interativa, produção, importação ou envio externo. O objetivo integral permanece ativo; a lista de pendências das SPECs continua válida.


## Incremento 274 — Conferência dos pagamentos de entrada das particulares, 13/09/2026

Consulta e tela /matriculas/[id]/entrada-particular conferem os pagamentos da preparação particular, com acesso de Secretaria/Financeiro/Administração e papel ativo revalidado. A tela de emissão inicial oferece o acesso para particulares. Projeta identificação mínima da matrícula/aluno, versão das condições, cobranças de entrada e recebimentos confirmados; não retorna contatos, documentos ou snapshots.

A conferência exige preparação particular assumida, condições/pagador atuais e emissão inicial conferida vinculada à mesma versão. Compara o plano de cobrança das condições à memória de emissão, vínculos ItemEmissaoEntrada e cobranças existentes. Divergências de valor, moeda, vencimento, cobertura, minutos ou vínculo exigem regularização. Usa o fuso da emissão preservada para conferir o vencimento, sem substituí-lo pela configuração atual da escola.

Por hora sem adiantamento contratado confere somente a taxa; não cria nem exige mensalidade. Adiantamento obrigatório precisa estar integralmente recebido com confirmação/data; antecipação opcional não se transforma em requisito de ativação. Particular mensal respeita a exigência da primeira mensalidade: se dispensada antes da ativação, apresenta a emissão prevista nessa etapa. Cobrança cancelada é pendência. A consulta não registra recebimento, ativa matrícula, libera contrato ou consome a reserva; horários e aceite ainda precisam de validação própria.

Validação: 10 testes unitários do conferidor e 61 integrações de reserva/preparação aprovados. As quatro combinações particulares existentes agora conferem emissão, acesso comercial negado, ausência de campos privados, leitura pelo Financeiro, quitação real via ledger e usuário inativo recusado. Pagamentos preservados não são repetidos e a matrícula continua sem ativação por efeito da consulta. TypeScript, lint direcionado e build Next.js aprovados. Evidência: docs/validacao-entrada-particular-274-2026-09-13.json.

Sem migration adicional. Última regressão integral: 273. Permanecem pendentes a ativação transacional particular, aceites/assinaturas aplicáveis, conversão dos horários reservados em encontros e consumo da reserva, além dos demais requisitos da SPEC. Esta conferência financeira é uma etapa preparatória; não declara Q100/Q111 ou a ativação concluídas. Sem homologação interativa, produção, importação ou envio externo.


## Incremento 275 — Preservação da conclusão das assinaturas, 13/09/2026

ConclusaoAssinaturaContratual separa o envio confirmado da conclusão das assinaturas exigidas. Vincula processo, referência externa e hash do original; preserva PDF assinado, auditoria, hashes, participantes, datas e hash do conteúdo normalizado. Registro é único por processo e imutável. Repetição idêntica retorna o mesmo registro; conteúdo divergente exige conferência. Original e registros do envio não são substituídos.

A primitiva interna preservarConclusaoAssinaturaTx exige envio confirmado e original íntegro, confere todos os papéis/identidades do snapshot institucional, recusa papéis repetidos ou assinatura parcial, valida o intervalo temporal e a ordem clientes antes da escola. Arquivos possuem limite técnico de 20 MiB cada; PDF exige cabeçalho e auditoria não vazia. Migration 127 acrescenta o registro e proteções de vínculo, hashes dos arquivos, papéis, datas, ordem e imutabilidade no banco.

Essa primitiva não é Server Action nem endpoint público. Somente o futuro adaptador autenticado, após conferir o documento e a auditoria no fornecedor, deve chamá-la. Hash de arquivo não autentica por si só a assinatura de uma pessoa; a validação da proveniência e da resposta do serviço continua responsabilidade dessa integração. Ambiente sandbox permanece identificado no processo e no evento; os testes não simulam autorização de uso em produção.

Validação: 9 unitários e 61 integrações de reserva/preparação aprovados. Cobertura de conclusão parcial, identidade divergente, ordem incorreta, datas incompatíveis, arquivos inválidos, envio/original incorretos, repetição, divergência de evidência, imutabilidade e preservação sem contratoOk automático. TypeScript, lint direcionado, build Next.js e schema diff aprovados; 127 migrations no banco descartável. Evidência: docs/validacao-conclusao-assinatura-275-2026-09-13.json.

Limites: não houve assinatura externa, consulta/download do documento assinado pela equipe, conferência final da Secretaria ou ativação. Continuam pendentes adaptador/configuração do fornecedor, tratamento de retornos tardios/divergentes, aceite do original aplicável, substituição, aditivos e ativação particular com consumo dos horários. Nenhuma matrícula foi ativada por registrar esta evidência. Última regressão integral 273; sem homologação interativa, produção ou envio externo.


## Incremento 276 — Consulta protegida das evidências de assinatura, 13/09/2026

Secretaria/Administração pode consultar o processo de assinatura vinculado ao original da matrícula, com identificação do serviço, ambiente de teste/produção, participantes e datas de conclusão. A projeção de metadados não entrega bytes, documentos pessoais, e-mails, hashes de identidade ou referências externas das assinaturas. O ambiente de teste aparece explicitamente; consultar evidências não confirma aceite nem ativa matrícula.

A rota privada /api/matriculas/[id]/assinaturas/[conclusaoId]/[tipo] entrega o PDF assinado ou a auditoria preservada. Revalida sessão, papel e usuário ativo, exige vínculo exato entre conclusão e matrícula e confere o hash dos bytes antes da resposta. PDF assinado pode ser aberto no navegador; auditoria é entregue como anexo. Respostas usam Cache-Control private, no-store e nosniff. A consulta mantém acesso ao histórico sem exigir que a reserva continue vigente.

Validação: 61 integrações de reserva/preparação aprovadas, incluindo conteúdo dos dois arquivos, ausência de campos privados na projeção, tipo inválido, vínculo de outra matrícula, ausência de sessão, papel comercial e usuário desativado. A primeira execução apontou expectativa incorreta de 403 para usuário desativado; o guard invalida a sessão com 401, e a expectativa foi corrigida. TypeScript, lint direcionado e build Next.js aprovados, com 52 páginas estáticas. Sem nova migration. Evidência: docs/validacao-consulta-assinatura-276-2026-09-13.json.

Limites: adaptador do fornecedor, retorno operacional autenticado, conferência final do aceite, substituição e aditivos continuam pendentes. Os testes utilizam evidências locais de teste; não houve assinatura ou envio externo, homologação interativa ou produção. Última regressão integral: incremento 273.



## Incremento 277 — Impedir aceite manual na preparação comercial, 13/09/2026

A conferência manual de Documento ainda podia marcar contratoOk em contratações da nova preparação comercial sem exigir conclusão de assinatura integrada do original. exigirAceiteManualPermitido agora restringe esse caminho às matrículas sem PreparacaoComercialMatricula. confirmarContratoMatricula aplica a restrição antes de vincular o anexo; exigirContratoAceito também a aplica antes de aceitar flags/documento legados para ativação. A aprovação do preço continua sendo exigida separadamente.

No painel da Secretaria, contratações preparadas exibem orientação e acesso aos documentos/assinaturas em lugar do formulário de aceite por anexo. Contratos sem preparação comercial conservam o caminho manual existente. Nenhum registro, recebimento ou contrato histórico foi apagado ou alterado retroativamente.

Validação: 77 integrações aprovadas nos arquivos reserva-vaga (61), politica da Secretaria e ativacao (16 em conjunto). O cenário novo mantém conclusão sandbox e um anexo explicitamente criado no teste, verifica rejeição da confirmação manual e de flags legadas de aceite na ativação, e preserva contratoOk falso. A primeira execução exigiu corrigir a contagem esperada de documentos para incluir esse anexo de teste; a nova execução dos 61 casos passou. Os 16 casos dos outros dois arquivos já haviam passado, sem alteração posterior do código executável. TypeScript, lint direcionado e build Next.js aprovados, com 52 páginas estáticas; sem nova migration. Evidência: docs/validacao-aceite-manual-277-2026-09-13.json.

Limite explícito: este incremento fecha uma forma de contornar Q104/Q106/Q115; não implementa a conferência final integrada. A nova preparação permanece impedida de usar o aceite legado, inclusive se já houver evidência preservada. O próximo fluxo deve registrar a conferência vinculada ao original e às condições corretas, exigir evidência de produção autenticada e integrar sua validação à ativação. Adaptador externo, aceite integrado, substituição e aditivos continuam pendentes. Última regressão integral 273; sem homologação interativa, produção ou envios externos.



## Incremento 278 — Aceite integrado do original pela Secretaria, 13/09/2026

AceiteOriginalContratual registra a conferência final com matrícula, conclusão de assinaturas, documento protegido, autor/data, motivo, revisão e memória das condições. É único por matrícula, conclusão e documento; registros são imutáveis. A migration 128 exige conclusão de produção pertencente à matrícula, Secretaria/Administração ativa, preparação ainda disponível para aceite e documento correspondente à conclusão. Também impede alterar vínculo, URL, categoria ou arquivamento do documento aceito.

A consulta e o formulário na página do original mostram pendências ou oferecem a confirmação explícita de original, PDF assinado, auditoria, assinaturas exigidas e condições. carregarRevisaoAceite revalida integridade dos arquivos, identidades/papéis, ordem e datas das assinaturas, vínculo ao envio confirmado, original e participantes atuais, condições/pagador, emissão inicial e consistência das cobranças. Reaplica as regras de reserva, admissão e taxa prévia. Pagamentos exigidos apenas para ativar não se tornam exigência adicional de aceite. Mudança entre consulta e confirmação exige nova revisão.

confirmarAceiteOriginal delega à primitiva interna confirmarAceiteOriginalTx. A transação revalida o autor e serializa confirmações, cria um único Documento apontando à rota privada de PDF já preservado, registra o aceite, atualiza a referência contratual da matrícula e emite ContratoConfirmado com aceiteOriginalId/conclusaoId/artefatoId e condições mensais. Repetição idêntica retorna o registro; reutilização divergente da chave é recusada. Aceite não ativa a matrícula, não confirma recebimento e não emite nova cobrança.

O guard de ativação agora reconhece esse aceite integrado: exige vínculo/autor/data/documento corretos, integridade da conclusão de produção e condições/pagador ainda correspondentes. A preparação comercial continua recusando o caminho manual e flags legadas sem aceite integrado. Matrículas sem preparação conservam a conferência manual existente. O histórico permanece consultável depois do aceite; alterações posteriores do contrato dependem dos fluxos próprios.

Validação: 79 integrações aprovadas (63 de reserva/preparação; 16 de Secretaria/ativação), TypeScript, lint direcionado, build Next.js com 52 páginas estáticas e schema diff vazio; 128 migrations no banco descartável. Cobertura inclui sandbox recusado, conferência positiva com taxa prévia exigida/dispensada, revisão desatualizada, versão financeira alterada, matrícula incorreta, papel comercial recusado, duas transações concorrentes idempotentes, repetição pela ação, imutabilidade e guard de documento divergente. Na primeira execução, a simulação de autenticação do runner falhou ao carregar NextAuth em duas ações concorrentes. A concorrência passou a ser testada na primitiva transacional real, mantendo testes de sessão/permissão e repetição pela ação; a extração não removeu a revalidação do autor. Evidência: docs/validacao-aceite-integrado-278-2026-09-13.json.

Limites: as evidências classificadas como PRODUCAO nos testes são fixtures locais, não assinaturas reais. Adaptador/proveniência autenticada do fornecedor, envios operacionais, substituição, aditivos e ativação particular com consumo de horários continuam pendentes. Reconhecer o requisito contratual não comprova a ativação completa de todos os regimes nem habilita operar a integração externa. Não houve homologação interativa, produção ou envios externos. Última regressão integral: incremento 273.



## Incremento 279 — Regressão integral e auditoria da ativação, 13/09/2026

Regressão completa aprovada: 791 testes unitários em 86 arquivos e 635 integrações em 50 arquivos, sem falhas ou pendências. A integração rodou em um único processo contra o banco descartável local. TypeScript passou, lint completo teve zero erros e três avisos preexistentes (FinanceiroPainel.tsx e Sidebar.tsx), schema diff vazio e 128 migrations. O build do incremento 278 permanece correspondente ao código executável; este incremento alterou testes e documentação. Evidência por arquivo: docs/validacao-regressao-279-2026-09-13.json.

A primeira execução unitária identificou 11 falhas em conclusao.test.ts: o mock não incluía a consulta ao novo aceite integrado. As fixtures passaram a distinguir contratos legados de preparação comercial com conclusão/aceite válidos, preservando a validação real do guard. Acrescentado caso explícito que recusa a ativação de preparação com flags antigas e sem aceite integrado. A execução unitária integral foi repetida e passou; nenhuma regra de assinatura foi relaxada para fazer os testes passarem.

A auditoria do caminho público de ativação identificou pendências registradas na SPEC da matrícula: emissão da primeira mensalidade na própria ativação quando dispensada na entrada; uso da reserva e criação da alocação por matrícula; conversão de horários particulares em encontros; entrada por hora com adiantamento conforme contrato; preservação dos demais contratos do aluno e remoção coordenada da restrição global de alocação. O registro integrado de aceite entregue no incremento 278 não completa esses efeitos acadêmicos e financeiros.

Esta regressão comprova os comportamentos cobertos pela suíte, não a conclusão integral da SPEC. Permanecem pendentes funcionalidades e validações operacionais descritas nos documentos. Não houve homologação interativa, importação de produção, assinatura real nem envio externo.


## Incremento 280 — Ativação da preparação em turma, 13/09/2026

O caminho público de conclusão agora encaminha preparações comerciais em turma para ativarPreparacaoTurmaTx. Na mesma transação, revalida o usuário, aceite integrado de produção, condições aceitas, emissão inicial e pagamentos confirmados; confere reserva, capacidade, professor, calendário, produto e janela de entrada ou exceção aprovada. Converte a reserva em UTILIZADA, cria a alocação vinculada à matrícula e registra ativação, movimentação, comissão e eventos. Recebimentos exigidos são confirmados pelo Financeiro antes da conclusão.

A emissão da etapa ATIVACAO utiliza a versão contratada: cria a primeira mensalidade quando dispensada como pagamento prévio; não duplica a mensalidade já emitida nem os recebimentos. A comissão utiliza o responsável capturado na preparação e a política com vigência na data da contratação; ausência de política exige conferência. Repetição retorna o resultado existente. Falha após os efeitos reverte todo o ingresso e duas ativações concorrentes não duplicam reserva, alocação, cobrança, comissão ou evento.

Validação: 791 testes unitários e 79 integrações direcionadas aprovados, incluindo os dois regimes de exigência da primeira mensalidade, reversão e concorrência reais. TypeScript, lint direcionado e build Next.js com 52 páginas estáticas passaram. As duas expectativas antigas de mensagem foram ajustadas para os bloqueios anteriores do novo fluxo, preservando a verificação direta da política de entrada. Evidência: docs/validacao-ativacao-preparacao-280-2026-09-13.json. Última regressão integral de integração: 279; nenhuma migration adicional.

Limites: particulares mensais/por hora continuam exigindo ativação própria e conversão de horários reservados. O índice legado de uma alocação ativa por aluno e a conferência da situação global do cadastro permanecem; esta entrega não libera contratos simultâneos nem conclui Q102/B01. A ativação não presume doze mensalidades futuras; continuidade contratada mantém seu escopo próprio. Assinatura real com fornecedor, homologação interativa e demais requisitos da SPEC permanecem pendentes. Sem produção, importação ou envios externos.

## Incremento 281 — Ativação de particulares mensais e por hora, 13/09/2026

ativarPreparacaoTx agora atende turma e particular no caminho público concluirMatricula. Para particulares, resolve a cadeia atual da reserva e revalida horários preservados, professor ativo, calendário e conflitos sob bloqueio da agenda. Depois de conferir aceite integrado, condições, pagamentos e comissão, utiliza a reserva e cria EncontroAgenda com matriculaId, sem turma ou alocação fictícia. Preserva professor, instantes e fuso; o evento da ativação relaciona cada horarioReservaId ao encontroId criado. Conversão, emissão aplicável, ativação e eventos pertencem à mesma transação.

Mensalidade particular respeita a exigência registrada: pagamento inicial obrigatório precisa estar confirmado; quando dispensado antes da entrada, a primeira mensalidade é emitida na ativação. Por hora confere a taxa e eventual adiantamento obrigatório; sem adiantamento não cria mensalidade ou cobrança de horas fictícia. Recebimentos existentes permanecem preservados. O novo ingresso particular não altera outro contrato ou sua alocação ativa. Professor inativo, encontros já registrados nesta preparação ou alocação de turma na própria preparação exigem regularização.

Validação: 83 integrações aprovadas em reserva/preparação, ativação e Secretaria, com quatro novos cenários de particulares. Cobrem grade fixa/flexível, mensal/hora, pagamento inicial exigido/dispensado, reversão após criação dos encontros, concorrência real, repetição pública e preservação de outro contrato. Trinta testes unitários direcionados, TypeScript, lint direcionado sem avisos e build Next.js com 52 páginas estáticas aprovados. Evidência: docs/validacao-ativacao-particular-281-2026-09-13.json. Sem migration adicional; última regressão integral 279.

Limites atuais: src/server/diario/chamada-encontro.ts ainda recusa encontro sem turma e exige o fluxo individual. A entrega de ativação não conclui diário particular, apuração de ocorrências cobráveis, saldo persistente de horas antecipadas, próximos agendamentos flexíveis nem todo Q111. A exceção em dia não letivo ainda precisa alcançar a reserva particular. Permanecem a migração da situação global do aluno e das múltiplas alocações em turmas, além de fornecedor real de assinatura e demais requisitos da SPEC. Os processos de assinatura dos testes usam protocolo simulado, sem envio externo. Sem homologação interativa, produção ou importação.

## Incremento 282 — Diário de encontros particulares, 13/09/2026

AulaDiario admite turma nula somente quando identifica um encontro. A migration 20260914010000_diario_particular preserva contexto, autoria e data depois do registro e confere a correspondência entre diário e encontro. Não cria turma fictícia nem altera os diários existentes. A aplicação ocorreu somente no banco descartável local.

O professor atribuído acessa a chamada existente em /diario/encontros/[id] e salva por salvarDiarioParticular. O servidor deriva a matrícula do encontro, revalida o docente, o horário já terminado, o estado PREVISTO e o histórico daquele contrato. Aceita somente o aluno correspondente, sem dados financeiros ou contatos pessoais. Histórico insuficiente exige conferência. Conteúdo e presença podem ficar pendentes; salvar não conclui o encontro nem emite cobrança. Edição exige o estado atual do diário; autoria diferente exige regularização. O histórico geral apresenta Particular e encaminha edição pendente ao encontro, preservando o nome capturado na chamada.

A conclusão por exceção de gravação usa o fluxo independente existente, agora com matrícula no contexto revisado. Exige conteúdo, presença confirmada e outra pessoa da gestão para aprovação. Falta na particular não comprova aula ministrada: permanece ocorrência a conferir no fluxo próprio, sem gerar nota, presença ou cobrança automaticamente. Depois da conclusão, a edição direta fica bloqueada.

Validação: 83 integrações aprovadas (16 diário e 67 reserva/preparação), 12 testes unitários, TypeScript, lint direcionado sem avisos e build Next.js com 52 páginas estáticas. Schema diff vazio após 129 migrations. Uma fixture antiga passou a cadastrar o encontro antes de criar o diário, respeitando a preservação do vínculo. Evidência: docs/validacao-diario-particular-282-2026-09-13.json. Última regressão integral: 279.

Limites: conclusão regular com gravação integrada, responsável designado para regularização de autoria, correção aprovada da particular e apuração financeira de ocorrências/horas permanecem pendentes. O reconstrutor de situação contratual ainda exige conferência para encerramento sem histórico suficiente. Não houve homologação interativa, produção, importação ou envios externos; este incremento não conclui toda a operação particular nem toda a SPEC.

## Incremento 283 — Regressão integral após diário particular, 13/09/2026

A regressão completa aprovou 791 testes unitários em 86 arquivos e 641 integrações em 50 arquivos, sem falhas ou pendências. As integrações rodaram em um único processo no banco descartável local. Lint completo: zero erros e três avisos preexistentes em FinanceiroPainel.tsx e Sidebar.tsx. O código executável permanece o do incremento 282, cujo TypeScript, build com 52 páginas estáticas e schema diff vazio foram aprovados após 129 migrations. Este incremento alterou documentação e evidências, sem mudanças de código de produção. Relatório por arquivo: docs/validacao-regressao-283-2026-09-13.json.

O resumo da SPEC central foi atualizado para refletir ativação em turma/particular e diário individual, retirando descrições antigas dessas entregas. A auditoria da próxima etapa preservou as pendências de gravação integrada, correção/regularização de autoria, ocorrências cobráveis, histórico de encerramento e ciclo persistente de horas. CompraHorasAntecipadas já existe e registra compra quitada com seus recebimentos; deve ser aproveitada, integrando condições/minutos do adiantamento preparado e o ciclo de reservas, consumo e validade. Não recriar esse cadastro nem confundir cálculo puro com saldo operacional completo.

A regressão comprova somente os cenários cobertos pelas suítes. Ainda não há comprovação integral de todos os requisitos da SPEC, homologação interativa das últimas telas ou operação real dos fornecedores. Sem produção, importação ou envios externos.

## Incremento 284 — Compra de horas da preparação aceita, 13/09/2026

registrarCompraHorasAntecipadas agora distingue preparação comercial de compra legada. Nas preparações exige aceite integrado vigente, regime HORA_PARTICULAR e cobrança vinculada à emissão inicial conferida da mesma versão das condições. Minutos, valor e moeda devem corresponder ao adiantamento contratado. Uma quantidade informada diferente não cria compra. Registra na memória preparação, condições, versão e emissão; conserva os recebimentos existentes e a idempotência da compra.

Quando o preço negociado aceito excede a referência da cobrança, a base da compra é o valor negociado, com desconto zero; o valor de referência permanece na memória. Quando existe desconto, preserva a diferença entre base original e valor pago. Isso evita desconto negativo sem alterar cobrança, preço contratado ou recebimento. Compras legadas mantêm seu fluxo de conferência próprio.

Validação: 71 integrações aprovadas em compra-horas e reserva/preparação, incluindo adiantamento aceito e pago, recusa de quantidade indevida, repetição e preservação de recebimentos. TypeScript, lint direcionado e build com 52 páginas estáticas aprovados. Sem migration adicional. Evidência: docs/validacao-compra-preparada-284-2026-09-13.json. Última regressão integral: 283.

Ainda faltam a persistência do ciclo de reservas/consumos, validade, pausa e acerto de saldo. Compra posterior fora do adiantamento inicial precisa de condições próprias; não pode reutilizar sua emissão ou inventar quantidade. O formulário existente continua exigindo conferência da quantidade; a validação autoritativa é do servidor. Sem homologação interativa, produção ou envios externos.

## Incremento 285 — Reserva persistente de horas compradas, 13/09/2026

ReservaHorasCompradas vincula compra, encontro, autor, minutos e intervalo preservado. O Financeiro pode reservar pelo painel de compras horas para encontro particular futuro já publicado da mesma matrícula ativa. O servidor deriva a duração do encontro; não aceita quantidade livre nesse passo. Travas da agenda, matrícula, compra e encontro serializam a operação. O banco impede ultrapassar a quantidade comprada, duplicar o encontro e alterar/apagar a reserva diretamente. Repetição idempotente não cria outra reserva nem recebimento.

O painel mostra minutos reservados e ainda não reservados, além dos vínculos por encontro, e oferece seleção de até 100 encontros futuros. A operação não cria agenda, não transfere saldo entre matrículas, não conclui aula nem registra consumo. Reserva não equivale a serviço prestado. No estado atual, a quantidade permanece comprometida até a implementação do fluxo de desfecho.

Validação: seis integrações aprovadas de compras/reservas, incluindo concorrência por saldo, idempotência, tentativa SQL acima do limite, outro contrato, pausa e recebimentos preservados. TypeScript, lint direcionado e build com 52 páginas estáticas aprovados. Migration 20260914013000_reserva_horas_compradas aplicada ao banco descartável; 130 migrations e schema diff vazio. Evidência: docs/validacao-reserva-horas-285-2026-09-13.json. Última regressão integral: 283.

Pendências: consumo por ocorrência conferida, devolução de disponibilidade por cancelamento, revisão de reservas afetadas por alteração de agenda, validade e pausa. A imutabilidade atual exige implementar eventos/decisões de desfecho, sem substituir o histórico. Ainda não se declara o ciclo completo de horas nem a SPEC concluídos. Sem homologação interativa, produção ou envios externos.

## Incremento 286 — Consumo por realização conferida, 13/09/2026

ConsumoHorasCompradas registra uma conferência imutável por reserva, com autor, motivo, estado do diário e data. Pelo painel financeiro, a equipe consulta a realização e confirma o consumo da quantidade reservada. O servidor confere matrícula/encontro da compra, intervalo preservado, horário terminado, autoria docente, conteúdo e presença do aluno. Uma revisão anterior perde validade quando o diário muda. Concorrência e repetição preservam um único consumo.

A realização pode estar registrada enquanto EncontroAgenda ainda está PREVISTO por pendência de gravação; essa pendência não bloqueia a conferência financeira. A operação não altera o status acadêmico, registra presença, cria cobrança ou recebimento. Falta/cancelamento não são classificados como realização. Reservados, consumidos e saldo ainda não reservado aparecem separados; consumir não devolve disponibilidade. O diário com horas consumidas deixa de aceitar edição direta pelo professor e exige correção com revisão dos efeitos financeiros.

Validação: 23 integrações aprovadas (compras e diário); os sete testes de compras foram repetidos após acrescentar a verificação da edição bloqueada. TypeScript, lint direcionado e build com 52 páginas estáticas aprovados. Migration 20260914020000_consumo_horas_realizadas aplicada somente no banco descartável; 131 migrations e schema diff vazio. Evidência: docs/validacao-consumo-horas-286-2026-09-13.json. Última regressão integral: 283.

Continuam pendentes os desfechos de falta/cancelamento cobrável, liberação de reserva, correção aprovada do consumo, validade, pausa e acerto de saldo. A conferência de realização não substitui esses fluxos e não conclui o ciclo completo de horas. Sem homologação interativa, produção ou envios externos.

## Incremento 287 — Integridade do consumo no banco, 13/09/2026

A inserção de ConsumoHorasCompradas agora também confere no PostgreSQL o autor ativo com papel financeiro/administrativo, reserva e compra, matrícula do encontro, intervalo preservado, diário com autoria compatível, conteúdo e presença única do aluno contratado. A correspondência exata do hash e a exigência de horário terminado permanecem verificadas pelo serviço; o trigger acrescenta integridade estrutural, sem substituir essas verificações.

Diário, presença e encontro vinculados a consumo ficam protegidos contra alterações diretas que mudem sua base. A conclusão acadêmica posterior de PREVISTO para MINISTRADO permanece permitida quando nenhum outro dado do encontro muda, preservando a separação entre conferência financeira e pendência de gravação. Correções que afetem a base financeira precisam do fluxo próprio ainda pendente. O guard de registros verifica também mudança para uma aula de destino já consumida.

Foram aplicadas, somente no banco descartável, as migrations 20260914023000_integridade_consumo_horas e 20260914024000_contexto_trigger_consumo. A segunda refina o acesso aos campos do trigger compartilhado entre tabelas e a verificação do destino; a primeira migration aplicada foi preservada. Total: 133 migrations; schema diff vazio.

Validação: 23 integrações de compras/diário aprovadas, com tentativas diretas no banco de consumo sem presença/papel, alteração de conteúdo/presença e cancelamento do encontro, além da conclusão acadêmica posterior permitida. TypeScript e lint direcionado aprovados. O código executável da aplicação não mudou; o build aprovado no incremento 286 permanece correspondente. Evidência: docs/validacao-integridade-consumo-287-2026-09-13.json. Última regressão integral: 283.

Continuam pendentes correção aprovada com ajuste financeiro, cancelamentos, liberação de horas, validade e acerto do saldo. Esta proteção impede reescrita silenciosa, mas não implementa essas operações. Sem homologação interativa, produção ou envios externos.

## Incremento 288 — Cancelamento acadêmico de particular pela escola, 13/09/2026

Professor atribuído ao encontro, Secretaria, Gerência Pedagógica ou Administração podem propor o cancelamento de uma particular contratada. Outra pessoa da Gerência Pedagógica/Administração decide; acúmulo de papéis não permite autoaprovação. Até aprovar, o encontro permanece previsto. A decisão válida aplica CANCELADO na mesma transação, com motivo e eventos vinculados à matrícula correspondente.

O serviço serializa com agenda e matrícula, confere papel ativo, autoria, estado do encontro e reservas atuais. Mudança de horário/professor/reserva exige rejeitar a proposta desatualizada e preparar outra. Solicitação e decisão repetidas não duplicam efeitos. Encontro com diário ou consumo registrado é bloqueado e exige correção própria, ainda incompleta. Proposta e decisão são imutáveis no banco; o banco também exige decisor ativo, autorizado e diferente do preparador. A comparação completa do estado e aplicação da agenda são garantias do serviço, não de um trigger universal de agenda.

Interface disponível em /diario/encontros/[id]/cancelamento, com entrada pela lista de encontros e pela página acadêmica. Secretaria consulta somente a projeção operacional da lista, sem ampliar acesso ao diário, cadastro ou financeiro. Professor continua limitado aos encontros atribuídos. A projeção acrescenta somente o indicador booleano de particular.

Este incremento entrega a decisão acadêmica, não Q95 inteiro: escolha do aluno entre remarcação/crédito, proposta financeira, liberação/reassociação de horas reservadas e acerto ainda precisam ser integrados. Cancelar não apaga recebimentos, não cria presença, não consome horas, não libera saldo nem devolve dinheiro. A interface avisa explicitamente que o acerto continua pendente. Avisos externos de Q38 ainda não são disparados por este fluxo.

Migration 20260914030000_cancelamento_particular aplicada somente no banco descartável. Total de 134 migrations, schema diff vazio. Evidências e resultados: docs/validacao-cancelamento-particular-288-2026-09-13.json. Última regressão integral permanece 283. Sem homologação interativa, produção ou envios externos.

## Incremento 289 — Liberação de horas para remarcação escolhida pelo aluno, 13/09/2026

Após o cancelamento da particular pela escola aprovado no incremento 288, o Financeiro pode propor a liberação da reserva de horas compradas. A proposta identifica a reserva, a decisão acadêmica, motivo e evidência da escolha do aluno por remarcação. Outra pessoa do Financeiro com financeiro.aprovar_acertos, ou Administração, aprova/rejeita. Autoaprovação é recusada mesmo com vários papéis.

A aprovação devolve os minutos à disponibilidade da compra por um registro de decisão imutável. A reserva original permanece no histórico. Consulta, nova reserva e trigger de saldo desconsideram somente reservas com liberação aprovada; propostas pendentes ou rejeitadas não liberam saldo. Aprovação repetida não amplia saldo. O banco impede duas liberações aprovadas para a mesma reserva, consumo de reserva liberada e alteração/remoção das propostas/decisões. Confere também papel, permissão, outro aprovador, correspondência da reserva, cancelamento acadêmico aprovado e ausência de consumo.

Serviços usam bloqueio de calendário, matrícula e autor vigente. Uma nova reserva continua exigindo matrícula ativa, encontro futuro da mesma contratação e saldo suficiente. A liberação é possível sem reativar uma matrícula pausada; não agenda aula nem muda validade por si só. Nenhuma cobrança ou recebimento é criado/alterado. O painel de compras apresenta a reserva liberada, histórico das propostas, evidência e decisão; esconde conferência de consumo de encontros cancelados/liberados. A consulta financeira reconfere o papel ativo.

Q95 continua parcial: a alternativa de crédito financeiro e a criação/remarcação do encontro com aprovação de agenda ainda precisam ser integradas. O ciclo aqui permite reservar o saldo liberado para outro encontro já autorizado/publicado da mesma matrícula; não publica uma nova aula implicitamente. Falta/cancelamento pelo aluno, correção de consumo, validade e acerto de encerramento continuam pendentes no ciclo persistente das horas.

Migration 20260914033000_liberacao_horas_remarcacao aplicada somente no banco descartável: 135 migrations, schema diff vazio. 29 integrações de compras, cancelamento acadêmico e diário aprovadas, incluindo liberação independente, idempotência, uso concorrente do saldo liberado, preservação dos recebimentos, rejeição, falta de cancelamento aprovado e revogação de acesso. TypeScript e lint direcionado aprovados. Evidência completa: docs/validacao-liberacao-horas-289-2026-09-13.json. Última regressão integral permanece 283; sem homologação interativa, produção ou envios externos.

## Incremento 290 — Remarcação vinculada à particular cancelada, 13/09/2026

Secretaria/Gerência Pedagógica/Administração preparam novo horário e professor para particular cancelada pela escola, com escolha do aluno documentada. Outra pessoa da Gerência Pedagógica/Administração aprova e publica o novo encontro na mesma transação. O original permanece cancelado e vinculado ao sucessor pela decisão. Proposta/decisão imutáveis, idempotência por operação e unicidade da remarcação aprovada impedem publicar duas aulas para a mesma origem.

Preservar a matrícula e a duração do encontro original. Data/hora são resolvidas no fuso informado, sem escolher silenciosamente horário ambíguo/inexistente. Conferir todo o intervalo no calendário/fuso institucional, encontros do professor ou matrícula, indisponibilidades aprovadas e reservas comerciais ativas/mantidas. Professor precisa estar ativo; matrícula, ativa. Calendário ou contexto diferente daquele conferido exige nova proposta. A consulta mostra a conferência atual e pendências; a aprovação reconfere dentro dos bloqueios de calendário/matrícula/autor/configuração/professor. Rejeição continua possível para proposta inviável.

Exceção em dia não letivo exige justificativa específica na proposta, apresentada na tela e incluída na aprovação independente. Não dispensa conflitos ou indisponibilidade. Atravessar meia-noite é permitido preservando duração. Este fluxo não altera duração/preço contratados; mudanças desses termos seguem ajuste próprio.

Quando o original tem reserva de horas compradas, exigir liberação financeira aprovada conforme incremento 289 antes de submeter a remarcação. Publicar não cria cobrança/recebimento nem reserva horas automaticamente: o painel financeiro permite vincular o saldo liberado ao novo encontro da mesma contratação. O teste de ciclo pago cobre cancelamento, liberação independente, remarcação aprovada e reutilização de horas sem novo recebimento/cobrança.

Interface: /diario/encontros/[id]/remarcacao, acessível à equipe organizadora pelo cancelamento. Professor não recebe autorização para preparar remarcações por esta entrega. Propostas e decisões preservam evidência da escolha, exceção, origem e novo encontro. SQL reforça origem correspondente, aprovador independente/ativo/autorizado, matrícula/duração/estado do par de encontros e unicidade; a conferência completa de conflitos/calendário permanece no serviço.

Migration 20260914040000_remarcacao_particular aplicada somente no banco descartável: 136 migrations, schema diff vazio. Evidência: docs/validacao-remarcacao-particular-290-2026-09-13.json. Última regressão integral permanece 283. Q95 continua parcial pela alternativa de crédito financeiro; notificações Q38 ainda não integradas ao fluxo. Não há promessa de conclusão de validade/encerramento/correções financeiras das horas. Sem homologação interativa, produção ou envios externos.

## Incremento 291 — Crédito por horas canceladas pela escola, 13/09/2026

O destino da reserva cancelada passa a ser REMARCACAO ou CREDITO, com escolha documentada do aluno, proposta do Financeiro e aprovação de outra pessoa do Financeiro com financeiro.aprovar_acertos ou Administração. A decisão aprovada é única por reserva, tornando os destinos mutuamente exclusivos. Propostas antigas preservam destino REMARCACAO e a idempotência dos pedidos sem destino explícito. O campo interno evidenciaEscolhaRemarcacao é conservado por compatibilidade, mas representa a evidência da escolha em ambos os destinos.

Para crédito, calcular pela proporção dos minutos sobre o valor efetivamente pago na compra original, já com o desconto original, sem reprecificar pela tabela atual. A memória guarda compra, moeda, minutos, valor pago, descontos, conversões anteriores e valor proposto. Arredondar o valor acumulado proporcional em duas casas, HALF_UP, e subtrair créditos anteriores, evitando criação/perda de centavos por fragmentação. Valor zero após arredondamento é preservado com seus minutos; não representa dinheiro disponível adicional. Mudança nas conversões anteriores exige rejeitar/repreparar a proposta antes de aprovar.

A aprovação cria CreditoMatricula na mesma transação da decisão. SQL confere origem, matrícula, moeda, decisão aprovada de crédito, valor original/arredondamento acumulado e exige o registro monetário antes do commit. Crédito é imutável; recebimento/cobrança originais não são alterados. Minutos convertidos saem da disponibilidade, mas não aparecem como aula realizada/consumo. Consulta, reserva, SQL de saldo e remarcação distinguem a conversão de uma liberação para novo encontro. Consumo e nova liberação das mesmas horas permanecem bloqueados.

O painel financeiro oferece as duas escolhas e apresenta memória de cálculo e crédito apurado. Não aplica o crédito automaticamente a cobranças e não afirma que houve devolução. Q68 mantém proposta e aprovação independente; Q69 registra pedido/evidência/destino, proposta versionada, reserva aprovada, execução manual evidenciada e conciliação append-only para resposta incerta. Cancelamento evidenciado libera somente a reserva ainda aguardando. Nenhuma dessas etapas cria recebimento ou aciona provedor externo. A origem implementada exige compra paga e reserva identificadas; outros tipos de crédito precisam de origem própria, sem reutilizar este registro indevidamente. Q95 avança na alternativa monetária, mas notificações externas ainda não estão completas.

Migration 20260914043000_credito_horas_canceladas aplicada apenas no banco descartável: 137 migrations, schema diff vazio. 35 integrações de compras, cancelamento/remarcação e diário aprovadas. Validado bloqueio de dupla destinação, cálculo original, saldo indisponível para nova reserva inclusive por SQL, decisão monetária atômica, crédito imutável, revisão de proposta desatualizada e soma exata de créditos parciais. Corrigida durante os testes a comparação da memória JSON para independência da ordem das propriedades após persistência em JSONB. TypeScript/lint direcionado/build aprovados; evidência em docs/validacao-credito-horas-291-2026-09-13.json. Última regressão integral: 283. Sem homologação interativa, produção ou envios externos.

## Incremento 292 — Proposta de utilização de crédito, 13/09/2026

PropostaUsoCredito identifica crédito, cobrança, valor, concordância do aluno, motivo, preparador, versão e snapshot de conferência. Financeiro/Administração com papel ativo prepara. Versões e valores anteriores são imutáveis; repetir a chave com os mesmos dados normalizados não duplica a proposta. Guardar a proposta não reserva crédito, não aprova uso, não altera cobrança, não aumenta valorRecebido e não cria Recebimento.

O recorte disponível prepara destinação a cobrança da mesma matrícula e moeda, pendente/atrasada, sem suspensão por pausa, cancelamento ou comprovante em conferência. Confere recebimentos tipados e saldo armazenado contra o valor devido. Valor proposto precisa ser positivo, com até duas casas e dentro do crédito e saldo devedor. SQL reforça autor ativo/financeiro, matrícula, moeda, estado e limites de valor. A conferência completa dos recebimentos/informes permanece no serviço. Propostas não comprometem o saldo; seu somatório não representa utilização aprovada.

Tela /alunos/[id]/creditos/[creditoId] acessível pelo crédito no painel de compras. Mostra crédito apurado, cobranças candidatas e versões não aplicadas. A interface explicita que aprovação/aplicação ainda não estão disponíveis. Consulta restringe aluno e papel financeiro; professor não acessa os dados.

Este incremento NÃO conclui Q68: faltam aprovação independente, movimento de utilização, disputa de saldo com devolução, revalidação do destino e contabilização efetiva. Destinação explícita entre contratos do mesmo aluno também permanece pendente; limitar esta preparação à mesma matrícula não define proibição definitiva nem autoriza redistribuição automática. Outros alunos não podem receber esse crédito.

### Dependência encontrada para aplicação correta

O código atual ainda usa valorNegociado menos valorRecebido em financeiro/regras.ts (saldoAtual/pagamentoConfirmado), financeiro/recebimentos.ts (saldo/excedente da nova baixa), financeiro/consultas.ts (indicadores), ajustes/acoes.ts e ajustes/consultas.ts, retomada/regras.ts e matricula/recebimento-preservavel.ts. Há também cálculos numéricos compartilhados em _shared/regras.ts. Aplicar crédito como se fosse Recebimento criaria dinheiro fictício; alterar apenas Cobranca.saldo deixaria esses consumidores contraditórios.

Antes de habilitar aprovação/aplicação, implementar movimento de liquidação por crédito separado de caixa, adaptar leituras/recalculos e critérios de quitação, preservar valor negociado/recebido original, conferir efeitos em ativação, retomada, ajustes, emissão/encerramento e cobrança automática. Esta lista é uma dependência técnica apurada, não uma alegação de implementação concluída. A proposta guarda a base para revalidação, sem liberar uma aplicação incompleta.

Migration 20260914050000_proposta_uso_credito aplicada somente no banco descartável: 138 migrations, schema diff vazio. 14 integrações de compras/horas/crédito aprovadas; novos casos verificam proposta idempotente/versionada sem efeitos financeiros, valores e estados inválidos, vínculo/moeda, imutabilidade e escopo de acesso. TypeScript/lint direcionado aprovados. Evidência: docs/validacao-proposta-uso-credito-292-2026-09-13.json. Última regressão integral permanece 283. Sem homologação interativa, produção ou envios externos.

## Incremento 293 — Aprovação e aplicação de crédito, 13/09/2026

DecisaoUsoCredito registra aprovação ou rejeição imutável. Outro Financeiro com financeiro.aprovar_acertos ou Administração decide; acúmulo de papéis não permite autoaprovação. A aprovação revalida versão, concordância registrada, cobrança, moeda e saldo disponível dentro da transação. Repetição da mesma decisão é idempotente. Alterações na cobrança invalidam a proposta anterior para aplicação e exigem nova conferência.

A utilização aprovada liquida a cobrança por valorLiquidadoCredito, separado de valorRecebido e de Recebimento. Não cria entrada de caixa. O saldo disponível do crédito é o valor inicial menos utilizações aprovadas. Bloqueios transacionais e validação SQL impedem utilização excedente e alteração incoerente do saldo derivado. A interface permite aprovar/rejeitar e consultar decisões; a preparação continua sem reservar saldo.

Cálculo de saldo, confirmação de quitação, recebimento posterior em dinheiro, indicadores financeiros, ajustes e retomada passam a considerar a liquidação por crédito. A conferência aritmética de pausa/retomada reconhece crédito integral mesmo com valorRecebido nulo. Pagamento misto preserva apenas o dinheiro efetivamente recebido no caixa. Alterar valor negociado para menos que o total já liquidado exige revisão.

Este recorte atende utilização na mesma matrícula e moeda. Destinação explícita entre contratos do mesmo aluno, devolução de dinheiro e concorrência com devoluções permanecem pendentes. Compras antecipadas ainda exigem conciliação integral dos recebimentos; encerramento com crédito aplicado ainda pode exigir conferência por seus validadores anteriores. Esses caminhos não estão declarados concluídos. Falta ampliar a validação integrada de todos os consumidores financeiros e homologar a interface. Q68 e o objetivo geral permanecem incompletos.

Migration 20260914053000_liquidacao_credito aplicada somente no banco descartável, totalizando 139 migrations e schema diff vazio. Evidência detalhada em docs/validacao-liquidacao-credito-293-2026-09-13.json. A última regressão integral permanece no incremento 283. Sem produção ou envios externos. As descrições dos incrementos anteriores são registros históricos; este incremento substitui a indicação de que aprovação/aplicação de crédito não estavam disponíveis.

## Incremento 294 — Compra de horas com quitação por crédito, 13/09/2026

RegistrarCompraHorasAntecipadas aceita cobrança integralmente liquidada com dinheiro, crédito aprovado ou ambos. Confere os Recebimentos detalhados contra valorRecebido e as utilizações aprovadas contra valorLiquidadoCredito; a soma precisa corresponder ao valor negociado. Moeda e matrícula das origens são conferidas. Crédito apenas proposto não compõe quitação. Versão da cobrança, contrato, autor financeiro, impedimentos e idempotência permanecem exigidos.

ValorPagoAlocado representa o valor total liquidado alocado à compra, não uma nova entrada de caixa. Snapshot imutável discrimina valorEmDinheiro, valorEmCredito, valorTotal e cada proposta/decisão/crédito utilizado. Preserva preço original e desconto. Nenhum Recebimento é criado ou alterado ao identificar a compra. Isso permite converter novamente horas canceladas em crédito pela regra já existente, conservando a cadeia de origem e sem devolver disponibilidade ao crédito anteriormente utilizado.

O painel de compras mostra a composição da quitação. Compras antigas sem essa memória não recebem uma composição inventada; a tela orienta consultar os registros de origem. A consulta fornece somente o resumo necessário, sem expor o snapshot integral.

Validação direcionada: 19 integrações de compra/horas/crédito; casos novos cobrem quitação integral por crédito com valorRecebido nulo e quitação mista, desconto, idempotência, fontes preservadas e resumo da consulta. Evidência: docs/validacao-compra-credito-294-2026-09-13.json. Sem nova migration (139 existentes); sem produção ou envios externos. Última regressão integral permanece 283.

Pendências: encerramento com crédito aplicado ainda necessita adaptação conjunta do contexto, cálculo proporcional, outras cobranças e compensações. A integração de devoluções e utilização entre contratos continua pendente. Este incremento não declara esses fluxos concluídos nem altera suas regras aprovadas. Falta homologação interativa.

## Incremento 295 — Crédito utilizado na apuração de encerramento, 13/09/2026

O contexto de encerramento confere as utilizações de crédito aprovadas contra o saldo liquidado da cobrança, com referências de proposta, decisão e origem. Confere moeda e matrícula; dinheiro continua conciliado somente contra Recebimentos. Quitação integral por crédito com valorRecebido nulo não gera pendência fictícia de recebimento.

Proporcional mensal, demais cobranças e compensações de cobertura passam a deduzir do valor devido a soma de dinheiro e crédito já aplicado. O excedente compõe apenas a apuração do acerto. As origens permanecem separadas: recebido/valorRecebido conserva dinheiro, creditoLiquidado/valorLiquidadoCredito identifica crédito anterior. Crédito disponível ainda não utilizado não é automaticamente abatido. Campos novos são opcionais para preservar leitura de memórias anteriores sem crédito.

A tela do acerto distingue recebido em dinheiro e liquidado por crédito. Nenhum crédito de origem é reaberto; a apuração não cria um novo saldo utilizável, não altera cobranças, não cria Recebimento nem executa devolução. A efetivação financeira do acerto e a proteção contra destinação duplicada ainda precisam ser concluídas antes de declarar o encerramento integralmente funcional.

Validação: 24 testes unitários em quatro arquivos e 28 integrações em três arquivos. Incluem proporcional com crédito parcial/integral, combinação com compensações sem duplicar dias, demais cobranças com quitação mista, e contexto carregado de utilizações reais aprovadas no banco. Evidência: docs/validacao-encerramento-credito-295-2026-09-13.json. Sem nova migration. Última regressão integral permanece 283; sem homologação interativa, produção ou envios externos.

## Incremento 296 — Horas antecipadas na prévia de encerramento, 13/09/2026

A prévia e o rascunho de encerramento carregam automaticamente as compras de horas da matrícula, seus consumos registrados, reservas ainda não resolvidas e créditos anteriormente emitidos. A apuração usa preço/desconto originais; a referência financeira é a cobrança de origem, que pode estar liquidada por dinheiro, crédito ou ambos. Reservas liberadas para remarcação deixam de comprometer horas; reservas convertidas em crédito são liquidações anteriores e não geram novo crédito pela mesma quantidade.

Reservas não resolvidas geram pendência e impedem o cálculo de horas. O componente aparece na tela e no snapshot quando há compras; alterações posteriores nas origens invalidam a conferência por comparação do snapshot. Sem compras, a forma anterior é preservada. O componente não é somado automaticamente ao subtotal das demais cobranças: a consolidação deve evitar apurar novamente a cobrança que originou uma compra.

26 integrações aprovadas em compra-horas e encerramento-solicitacao, incluindo leitura de liquidações reais, reserva pendente, saldo remanescente sem repetir crédito e recusa de outro aluno. Sem nova migration, produção ou envio externo. Ainda pendentes: consolidação sem sobreposição de componentes, aprovação e efetivação financeira integral, devoluções e homologação interativa. Este incremento integra uma dependência real da efetivação, mas não declara o encerramento concluído. Última regressão integral: 283.

## Incremento 297 — Consolidação da prévia de encerramento, 13/09/2026

A prévia agrega mensalidades após compensações, multa proposta, outras cobranças independentes e saldo de horas antecipadas por matrícula/moeda. Mantém saldo devido e crédito apurado separados, sem compensação automática. A multa proposta substitui a contratual no total apresentado, sem autorizar a exceção; ambas ficam identificadas.

Cobranças que originaram compras de horas são identificadas e excluídas da soma de outras cobranças. Sua conferência deve preservar a quitação original, sem propor ajuste duplicado; o direito restante é apurado pelo componente de horas. Reservas pendentes, componentes incompletos e sobreposição de ajustes impedem apresentar um total consolidado disponível para revisão. A tela mostra os totais e pendências, que também integram o snapshot do rascunho. Rascunhos anteriores sem consolidação precisam de nova conferência.

Validação: 10 unitários e 5 integrações, lint e build com 52 páginas estáticas aprovados. Cobertura inclui multa proposta uma única vez, separação entre crédito e dívida, compra de horas excluída do subtotal independente e bloqueio de ajuste duplicado/reserva pendente. Sem nova migration. Última regressão integral permanece 283. Ainda faltam aprovação e efetivação financeira integral; prévia não emite crédito, utiliza saldo ou devolve dinheiro. Sem homologação interativa, produção ou envios externos.

## Incremento 298 — Regressão completa após créditos e encerramento, 13/09/2026

Suítes completas executadas: 804 testes unitários em 87 arquivos e 665 testes de integração em 51 arquivos, todos aprovados. A integração rodou uma única vez, serialmente, em localhost:54329/erp_genius_test, terminou com exit code 0 e levou 640,60 segundos. TypeScript, lint direcionado e comparação schema/banco aprovados (diff vazio). Último build aprovado: incremento 297, sem mudança posterior no código de produção.

A primeira execução unitária encontrou quatro falhas em duas fixtures que não continham valorLiquidadoCredito, campo obrigatório com default zero no schema. Fixtures atualizadas sem enfraquecer as expectativas. Dois casos adicionais cobrem ajuste abaixo da quitação mista recusado e ajuste válido que preserva dinheiro/crédito separados. A suíte unitária completa foi repetida após as alterações e passou.

Esta é a nova referência de regressão integral, substituindo 283. Evidência: docs/validacao-regressao-298-2026-09-13.json. Os resultados comprovam somente a cobertura automatizada existente; não declaram todas as funcionalidades implementadas. Permanecem as pendências de aprovação/efetivação do acerto, devoluções, destinação entre contratos e demais itens do plano. Sem homologação interativa, produção ou envios externos.

## Incremento 299 — Decisão independente do acerto, 13/09/2026

DecisaoAcertoEncerramento registra decisão imutável por versão do rascunho, decisor, motivo e autorizações explícitas de retroatividade/exceção de multa. Outro Financeiro com financeiro.aprovar_acertos ou Administração decide; o preparador não aprova mesmo acumulando papéis. A ação serializa pelo pedido e revalida a versão mais recente, origens atuais e consolidação sem pendências antes de aprovar. Mudança de origens exige nova conferência. Rejeição pode resolver uma versão desatualizada sem aplicar valores. Repetição idêntica é idempotente.

A interface oferece decisão aos usuários elegíveis e exibe o resultado registrado. Aprovação não encerra matrícula, altera cobrança, emite crédito ou devolve dinheiro. Efetivação permanece pendente e deverá revalidar novamente versão, origens e decisão. Uma aprovação anterior não torna válida uma nova versão nem autoriza executar origens modificadas.

Migration 20260914060000_decisao_acerto_encerramento: 140 migrations no banco descartável, schema diff vazio. SQL reforça imutabilidade, independência, papel/permissão, versão e autorizações explícitas; conferência integral das origens e consolidação está no serviço. Integração cobre decisão concorrente idempotente, autoaprovação recusada, escopo de aluno, decisão imutável, cobrança/matrícula preservadas, origem modificada recusada e rejeição. As cinco integrações do arquivo encerramento-solicitacao passaram; TypeScript, lint e build aprovados. Última regressão completa permanece 298. Sem homologação interativa, produção ou envios externos. Efetivação financeira integral ainda não implementada.

### Complemento de validação do incremento 299

Sete integrações de encerramento-solicitacao aprovadas após acrescentar cenários independentes de retroatividade e dispensa de multa. O Financeiro sem financeiro.aprovar_acertos é recusado; com permissão, continua impedido de aprovar sem a autorização específica. Inserção direta da decisão no banco também recusa cada exceção não autorizada. Com a autorização explícita, registra a decisão e preserva matrícula ativa. TypeScript e lint do teste aprovados; nenhum código de produção alterado neste complemento. Efetivação financeira continua pendente.

## Incremento 300 — Plano de lançamentos do acerto, 13/09/2026

A prévia/snapshot passa a conter lançamentos previstos por origem: ajustes das cobranças, valor devido após acerto, saldo restante, crédito apurado, valor recebido preservado, crédito anteriormente liquidado e vencimento preservado. Multa mantém condição original e valor proposto. Compras de horas são preservadas como origem; horas restantes e compensações mantêm as referências necessárias para posterior liquidação.

O plano confere a soma dos saldos e créditos contra a consolidação, rejeita cobrança repetida/origem incompatível e fica indisponível com componentes pendentes. Crédito por cobrança e crédito por compra de horas têm tipos de origem diferentes. A tela apresenta detalhamento dos lançamentos do rascunho sem expor o snapshot bruto nem somar os detalhes novamente ao total.

Onze unitários e sete integrações aprovados; lint e build aprovados. Testes adicionais conferem quitação mista preservada, vencimento original, crédito por origem, ausência de mutação, bloqueio com reserva pendente e divergência entre lançamentos e total. A inclusão no snapshot exige nova conferência de rascunhos anteriores antes de nova aprovação. Não houve migration. Última regressão integral: 298. Persistência/aplicação dos lançamentos e encerramento efetivo continuam pendentes; nenhum movimento financeiro foi executado neste incremento. Sem homologação interativa, produção ou envio externo.

## Incremento 301 — Origem persistente dos créditos de encerramento, 13/09/2026

OrigemCreditoAcerto identifica decisão aprovada, matrícula, moeda, tipo de origem (cobrança ou compra de horas), identificador e valor. SQL exige correspondência com o plano de lançamentos preservado na decisão e impede duplicar a mesma origem. Registro imutável. CreditoMatricula passa a exigir exatamente uma origem: liberação de horas canceladas ou origem de acerto. O crédito deve corresponder ao valor, matrícula e moeda da origem. Créditos antigos conservam sua cadeia de cancelamento.

A memória de utilização inclui origemAcertoId quando aplicável. O cálculo de créditos por cancelamento continua restrito às origens de cancelamento, com conferência explícita da relação. Migration 20260914063000_origem_credito_acerto aplicada somente ao banco descartável: 141 migrations, schema diff vazio.

28 integrações em encerramento-solicitacao e compra-horas aprovadas. Casos novos exercitam a persistência diretamente no banco de teste: origem com valor/matrícula divergentes recusada, crédito sem origem ou duplicado recusado, correspondência do crédito com o plano aprovado e preservação de origens anteriores. TypeScript/build e lint aprovados.

Este incremento fornece a estrutura de persistência; não oferece uma ação pública para emitir crédito de encerramento isoladamente. A aplicação final deverá revalidar decisão/versão/origens e gravar créditos, ajustes, liquidação de horas e encerramento na mesma transação. Os testes de estrutura não comprovam essa execução completa. Última regressão integral: 298; sem homologação interativa, produção ou envios externos.

## Incremento 302 — Vencimento da multa no acerto, 13/09/2026

Conferência da multa permite informar vencimento civil explícito. Se o valor proposto for positivo, a consolidação permanece pendente até registrar data válida. Dispensa integral/valor zero não exige vencimento nem implica emitir cobrança. Não se presume prazo ou vencimento a partir da data de execução.

O vencimento integra entrada, snapshot e plano de lançamentos, sendo mostrado ao revisor. Alterá-lo exige nova conferência da versão e aprovação correspondente, seguindo a revalidação existente. A futura aplicação usará a data aprovada, mantendo a multa separada dos recebimentos e dos ajustes originais.

12 unitários e 7 integrações aprovados; lint, TypeScript e build com 52 páginas aprovados. Casos novos: multa positiva sem data bloqueada, data conferida preservada, data civil inexistente recusada e dispensa sem cobrança programada. Sem migration. Última regressão integral: 298. Efetivação financeira ainda pendente; sem homologação interativa, produção ou envios externos.

## Incremento 303 — Revalidação transacional da efetivação, 13/09/2026

carregarAcertoAprovadoParaEfetivacaoTx fornece a guarda interna de aplicação. Confere decisão e aluno, trava agenda/pedido/matrículas/cobranças/documentos, verifica executor financeiro vigente e aprovador ativo/autorizado, versão mais recente, igualdade das origens com o snapshot aprovado, autorizações de exceção e plano sem pendências. Data efetiva precisa ter chegado no fuso institucional. Vínculo legado ativo sem matrícula exige conciliação.

A guarda recebe a transação do chamador: futura gravação dos efeitos deve ocorrer nela, antes de liberar os locks. Não é uma autorização reutilizável fora da transação e não aplica lançamentos isoladamente. Também não existe nova ação pública que alegue efetivação concluída.

Sete integrações de encerramento-solicitacao aprovadas, com casos adicionais: execução antecipada recusada, seleção contratual preservada, aprovador desativado recusado, mudança no pedido invalidando aprovação e nova versão impedindo aplicação da anterior. TypeScript e lint aprovados. Sem alteração de schema ou UI; último build 302. Última regressão integral 298. Persistência dos efeitos e encerramento efetivo ainda pendentes; sem produção ou envios externos.

## Incremento 304 — Aplicação interna dos ajustes por cobrança, 13/09/2026

AjusteCobrancaAcerto preserva decisão, executor, cobrança, versão e valor anteriores, novo valor, crédito apurado, moeda e snapshot da origem. A cobrança admite um registro de acerto; o histórico é imutável. SQL exige decisão aprovada, executor financeiro ativo, correspondência do valor ao plano e conferência do crédito apurado. A inserção atualiza valor negociado, saldo, versão e situação na mesma transação, mantendo recebimentos, valorRecebido, crédito já liquidado e vencimento.

aplicarAjustesCobrancaAcertoTx é uma etapa interna que recebe a mesma transação da guarda de efetivação e dos demais efeitos. Não abre transação própria nem constitui ação pública de encerramento. Não emite crédito ou multa e não encerra matrícula isoladamente. Essas etapas ainda devem ser integradas antes da disponibilização pública.

Migration 20260914070000_ajuste_cobranca_acerto aplicada no banco descartável: 142 migrations, schema diff vazio. Sete integrações de encerramento-solicitacao aprovadas, incluindo ajuste de valor/saldo com origem preservada e falha posterior simulada que desfaz integralmente o histórico e a alteração. TypeScript e lint aprovados. Sem alteração de UI; último build 302. Última regressão integral 298. Sem homologação interativa, produção ou envios externos; objetivo geral não concluído.

## Incremento 305 — Créditos na transação dos ajustes, 13/09/2026

aplicarCreditosAcertoTx grava a origem aprovada e o crédito da matrícula usando a transação recebida. Crédito de cobrança exige que o ajuste da mesma decisão já tenha sido aplicado e que seu valor corresponda ao crédito apurado. Não cria recebimento nem modifica dinheiro recebido. Não oferece ação pública isolada.

Sete testes de integração aprovados no banco descartável, incluindo recusa de crédito antes do ajuste e falha simulada após a emissão: ajuste, origem e crédito são revertidos juntos, preservando a cobrança e o recebimento originais. TypeScript e lint direcionado aprovados. Sem alteração de schema ou UI. Última regressão integral: 298; último build: 302.

A execução completa do encerramento permanece pendente: integrar liquidação de horas e compensações, multa, encerramento dos vínculos selecionados e controle de repetição na mesma operação antes da exposição pública. O helper de créditos, por si só, não comprova esses efeitos. Sem homologação interativa, produção ou envios externos.

## Incremento 306 — Liquidação de horas no acerto, 13/09/2026

LiquidacaoHorasAcerto registra uma única destinação final por compra, com decisão aprovada, minutos e valor preservados. A conferência SQL compara o plano aprovado com consumos, créditos anteriores e reservas reais; reservas pendentes impedem a liquidação. Valor zero é permitido para registrar minutos cujo direito monetário já tenha sido absorvido pelo arredondamento acumulado.

Crédito positivo de compra exige liquidação correspondente na mesma transação, e liquidação positiva exige crédito. A consulta de compras desconta os minutos liquidados; a apuração posterior de encerramento considera essa destinação anterior. Novas reservas são recusadas no serviço e no banco, inclusive quando a matrícula ainda consta ativa. Não se criam recebimentos e não se alteram compras originais.

aplicarLiquidacaoHorasAcertoTx é etapa interna, sem ação pública isolada. A execução final ainda precisa integrar os demais efeitos e verificar SET CONSTRAINTS ALL IMMEDIATE antes de retornar sucesso: no ensaio, uma falha de constraint diferida no commit foi registrada pelo Prisma sem rejeitar a Promise; a conferência explícita dentro da transação detectou o erro corretamente. O banco reverte a operação inválida. Esse comportamento exige atenção na futura ação de efetivação.

Validação: 22 integrações de compra de horas aprovadas na execução final; outras 7 de encerramento aprovadas na execução anterior deste incremento. Sete unitários de apuração de horas aprovados. Casos novos: dependência bidirecional entre crédito e liquidação, rollback após falha, preservação do recebimento, histórico imutável, recusa de repetição, saldo zerado e bloqueio de reserva por serviço/SQL. O caso monetário zero ainda não teve novo cenário integrado específico neste incremento. TypeScript, lint, build com 52 páginas e diff sem erros aprovados; migration 20260914073000_liquidacao_horas_acerto aplicada apenas no banco descartável, 143 migrations e schema diff vazio.

Última regressão integral: 298. Efetivação completa, homologação interativa e objetivo geral continuam pendentes. Sem produção ou envios externos.

## Incremento 307 — Emissão interna da multa do acerto, 13/09/2026

MULTA_ENCERRAMENTO identifica a cobrança gerada pelo acerto, vinculada à decisão e à matrícula. Uma decisão admite uma multa por matrícula. O banco confere moeda, valor contratual original, valor proposto positivo e vencimento contra o plano aprovado; a emissão não registra dinheiro ou crédito recebido. Origem e vínculo são preservados, e a cobrança não pode ser apagada. Dispensa integral não gera cobrança.

aplicarMultasAcertoTx recebe a transação revalidada do acerto. Não fornece ação pública de emissão isolada; integrar todos os efeitos do encerramento continua obrigatório. Valor/vencimento posteriores seguem os fluxos financeiros aplicáveis. O novo tipo tem rótulo financeiro, mas não é ofertado nem aceito como preço de catálogo: sua origem é o contrato e o acerto aprovado.

Validação: 806 testes unitários em 87 arquivos; 10 integrações de encerramento e catálogo; TypeScript, lint sem avisos, build com 52 páginas e schema diff vazio aprovados. Casos adicionais cobrem multa de 80 com vencimento aprovado, dispensa sem cobrança, falha posterior desfazendo emissão, recusa de repetição, valor divergente, falta de origem e alteração/remoção da origem. Migration 20260914080000_multa_acerto aplicada somente no banco descartável; 144 migrations. Última regressão integral de integrações: 298. Sem homologação interativa, produção ou envios externos. Objetivo geral ainda incompleto.

## Incremento 308 — Destinação dos dias de compensação no acerto, 13/09/2026

DestinacaoDiaAcerto registra a decisão e o tratamento de cada dia: COMPENSACAO para o ajuste pelos dias ainda devidos, PROPORCIONAL para os já descontados pelo encerramento. O vínculo é único e imutável. A inserção exige dia pendente, compensação aprovada, correspondência ao plano da decisão e ajuste da cobrança aplicado; atualiza o estado para LIQUIDADO_FINANCEIRAMENTE com referência ao registro, data e incremento de versão.

aplicarCompensacoesAcertoTx é etapa interna da transação de efetivação. Não emite crédito adicional: o efeito monetário já pertence ao ajuste de cobrança. Dias anteriormente recompostos ou liquidados não são selecionados. O fluxo completo de encerramento e o tratamento dos vínculos/agenda ainda precisam ser integrados antes da disponibilização pública.

Sete integrações aprovadas, incluindo distinção entre dia anterior e posterior ao último dia coberto, recusa de tratamento divergente, exigência de ajuste, recusa de repetição/apagamento e rollback de dias e cobrança após falha. No cenário de mensalidade de 400 e encerramento no dia 15 de um período de 30 dias, um dia de compensação reduz os 200 para 186,67; o dia 20 já descontado pelo proporcional não gera novo abatimento. Quatro unitários de compensação aprovados. TypeScript, lint e schema diff vazio aprovados. Migration 20260914083000_destinacao_compensacao_acerto aplicada somente no banco descartável, 145 migrations. Último build e suíte unitária integral: 307; última regressão integral de integração: 298. Sem alteração de interface neste incremento, homologação interativa, produção ou envios externos. Objetivo geral ainda incompleto.

## Incremento 309 — Origens acadêmicas na conferência do acerto, 13/09/2026

A prévia agora registra situação/ativação/versão de acesso da matrícula, vínculos de turma com datas e situação, encontros particulares com horário, professor, fuso e reservas de horas. Apenas a matrícula correspondente é consultada; o cadastro de outro aluno não pode ser usado para obter esses dados. A aprovação adquire a trava da agenda antes das demais travas, compatível com a execução e operações de particulares.

A comparação da versão aprovada passa a detectar alteração dos vínculos e encontros, além das origens financeiras. Versões antigas sem essas informações exigem nova conferência. A interface mostra os vínculos e a agenda revisados e informa que não houve cancelamento de aulas ou encerramento de vínculo. Essa conferência não equivale a autorizar alterações pedagógicas isoladas.

29 integrações de encerramento e compra de horas aprovadas, com casos novos: encontro em contrato excluído preserva a validade da aprovação; novo encontro ou alocação no contrato selecionado invalida a efetivação; consulta de outro aluno é recusada. TypeScript, lint, build com 52 páginas e diff sem erros aprovados. Sem migration. Última suíte unitária integral: 307; última regressão integral de integração: 298.

Ainda faltam o registro temporal do encerramento, a aplicação dos efeitos nos vínculos/acessos/agenda e a ação completa e repetível que reúna os componentes. O índice global legado de alocação e os consumidores que dele dependem também seguem pendentes de migração coordenada; este incremento não removeu essa proteção. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 310 — Núcleo financeiro integrado do encerramento, 13/09/2026

aplicarFinanceiroEncerramentoTx reúne revalidação da decisão/origens, ajustes de cobranças, liquidação de horas, créditos, multas e destinação de compensações na transação recebida. A ordem respeita as dependências entre ajustes e crédito e entre liquidação de horas e crédito. SET CONSTRAINTS ALL IMMEDIATE confere ainda dentro da função as restrições diferidas, antes de retornar os identificadores dos componentes aplicados.

Não há ação pública para aplicar somente este núcleo. O chamador da efetivação completa deverá aplicar os efeitos acadêmicos, registrar o encerramento e concluir o pedido na mesma transação, incluindo controle de repetição. Não tratar o retorno financeiro como matrícula encerrada. Esta integração não executa devoluções, consome créditos disponíveis nem cria recebimentos.

29 integrações aprovadas nos arquivos de compra de horas e encerramento; após ajuste adicional do cenário de crédito de cobrança, as 7 integrações de encerramento foram repetidas e aprovadas. Os cenários de horas/crédito, multa, dispensa, compensação/proporcional e crédito de cobrança agora exercitam o núcleo integrado, com rollback simulado após a aplicação e preservação dos recebimentos. TypeScript, lint sem avisos e diff sem erros aprovados. Sem schema ou UI alterados; último build 309, última suíte unitária integral 307 e última regressão integral de integração 298.

Permanecem pendentes os efeitos acadêmicos e temporais do encerramento e a ação completa com controle de repetição. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 311 — Registro temporal do encerramento e histórico contratual, 13/09/2026

RegistroEncerramentoMatricula preserva matrícula, decisão, situação anterior, data efetiva, fuso, inclusão/exclusão do dia, limite exclusivo do vínculo e data da aplicação. O banco confere as condições aprovadas e a conversão temporal e impede alteração/apagamento. registrarLimitesEncerramentoTx prepara esses registros na transação recebida, sem alterar sozinho o estado da matrícula ou os vínculos.

O leitor do histórico contratual passa a carregar esse registro. situacaoMatriculaNaAula reconhece ENCERRADA a partir do limite e reconstrói ATIVA/PAUSADA para aulas anteriores, quando há ativação e movimentos consistentes. Encerramento sem evidência temporal continua A_CONFERIR; o registro não inventa ativação nem libera uma matrícula encerrada para novas aulas.

807 unitários em 87 arquivos aprovados, incluindo 5 de histórico temporal. Integração: 8 testes de encerramento na execução final e 16 de diário na execução anterior. As duas regras de último dia foram testadas no banco em America/Sao_Paulo; o registro pertence apenas à matrícula escolhida, preserva os demais contratos e é desfeito com a transação. TypeScript, lint, build com 52 páginas e schema diff vazio aprovados. Migration 20260914090000_registro_temporal_encerramento aplicada apenas no banco descartável; 146 migrations.

Ainda integrar à efetivação final: fixar o fuso revisado na prévia, aplicar situação/vínculos/acesso, conferir agenda futura e concluir o pedido com controle de repetição. O núcleo de histórico não comprova todos os consumidores acadêmicos e filtros de listagem. Última regressão integral de integração: 298. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 312 — Fuso institucional na versão aprovada do acerto, 13/09/2026

A prévia carrega e registra o fuso institucional com carregarFusoInstitucionalTx, mantendo a linha de configuração protegida por FOR SHARE durante a transação. Fuso ausente/inválido impede a conferência. A guarda de efetivação usa o mesmo leitor, e a comparação integral do snapshot detecta mudança de fuso após aprovação. Versões antigas sem a referência temporal precisam de nova conferência.

A interface apresenta o fuso da versão revisada, sem confundi-lo com a preferência de visualização ou com o fuso originalmente registrado no pedido. A data civil do pedido permanece preservada. O cálculo do limite temporal usa a referência revalidada e estável na transação.

30 integrações aprovadas em encerramento e compra de horas; novos casos verificam fuso capturado, mudança após aprovação recusada e ausência de configuração bloqueada. TypeScript, lint, build com 52 páginas e diff sem erros aprovados. Sem migration. Última suíte unitária integral: 311; última regressão integral de integração: 298. Efeitos acadêmicos e ação completa de encerramento ainda pendentes. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 313 — Estado e vínculos das matrículas encerradas, 13/09/2026

aplicarEstadoEncerramentoTx registra os limites contratuais, muda somente as matrículas selecionadas para ENCERRADA e incrementa acessoVersao. Fecha os vínculos ativos capturados na conferência, preservando criadoEm, turma e matrícula. Vínculo cadastrado após o limite fica com intervalo vazio, sem fabricar uma data anterior à criação. Vínculos históricos e outros contratos permanecem preservados; vínculo ativo com data de encerramento contraditória exige conciliação.

A etapa registra uma MovimentacaoAluno de ENCERRAMENTO vinculada à matrícula e evento MatriculaEncerrada com decisão, registro temporal e vínculos fechados. Não altera o status global do aluno. O executor é o mesmo usuário validado pela guarda, agora incluído no resultado interno da revalidação.

Oito integrações de encerramento aprovadas, cobrindo inclusão/exclusão do último dia, fechamento do vínculo, preservação do histórico de outro contrato, incremento de acesso apenas na matrícula selecionada, movimentação e rollback conjunto de cadastro/vínculo/registro/financeiro. TypeScript, lint e diff sem erros aprovados. Sem migration ou UI neste incremento; último build 312, última suíte unitária integral 311, última regressão integral de integração 298.

Ainda integrar a conferência/destinação da agenda futura e a conclusão repetível do pedido antes de oferecer uma ação pública completa. Não há homologação interativa ou comprovação de todos os consumidores de acesso. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 314 — Conferência da agenda no limite contratual, 13/09/2026

A prévia apura o limite exclusivo no fuso institucional conforme inclusão/exclusão do dia. Encontros particulares PREVISTOS ou MINISTRADOS cujo fim ultrapasse esse limite são identificados em agendaEncerramento. A aprovação e a guarda de efetivação exigem regularização. Encontro que termina exatamente no limite não ultrapassa a cobertura; encontro que atravessa o limite exige conferência.

O acerto não substitui aprovação pedagógica de cancelamento. Usar o fluxo existente para os encontros canceláveis; diário/consumo e aula já ministrada exigem conferência da data efetiva ou correção aplicável, preservando evidências. Cancelados e rascunhos não ocupam esta pendência; rascunho não é aula publicada. A interface apresenta as pendências da versão revisada. Regularização muda a origem e requer nova versão do acerto.

32 integrações de encerramento/compra de horas aprovadas, incluindo os dois critérios de dia, término exato, cruzamento do limite, aula ministrada, cancelada e rascunho. TypeScript, lint, build com 52 páginas e diff sem erros aprovados. Sem migration; última suíte unitária integral 311 e última regressão integral de integração 298.

Ainda concluir a operação pública repetível e verificar sua composição com reservas, apurações por hora e demais consumidores. Este incremento não comprova todo o encerramento nem gera cancelamento/ajuste automático. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 315 — Executor transacional e conclusão única do acerto, 13/09/2026

EfetivacaoAcertoEncerramento preserva pedido, decisão, executor, data e identificadores dos efeitos em registro único por pedido/decisão. A inserção confere aprovação, executor vigente, matrículas encerradas com registros temporais, ajustes, créditos, horas, multa e dias de compensação previstos; conclui o pedido na mesma transação. Registro de efetivação é imutável.

efetivarAcertoEncerramentoTx serializa agenda/pedido, confere o aluno e a permissão atual, aplica financeiro e estado/vínculos e registra a conclusão. A repetição da mesma decisão retorna o resultado preservado; outra decisão ou outro aluno é recusado. Repetição não dispensa a permissão atual do executor. As constraints são conferidas antes de retornar. O transporte público autenticado e a interface ainda não foram adicionados; o relógio não poderá vir do cliente.

32 integrações de encerramento e compra de horas aprovadas, agora com executor completo nos cenários de horas/crédito e compensação/proporcional, concorrência/repetição sem duplicidade, pedido CONCLUIDA, matrícula ENCERRADA, histórico imutável, revogação de acesso e rollback posterior à conclusão. TypeScript, lint, build com 52 páginas e schema diff vazio aprovados. Migrations 20260914093000_efetivacao_acerto_encerramento e 20260914094000_conferencia_dias_efetivacao aplicadas apenas no banco descartável; 148 migrations. Última suíte unitária integral 311; última regressão integral de integração 298.

Ainda verificar a exposição pública, consumidores acadêmicos/acesso e composição com apurações por hora e reservas. Este executor não comprova a implementação integral dos demais fluxos. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 316 — Ação autenticada e interface de efetivação, 13/09/2026

A ação efetivarAcertoEncerramento recebe somente aluno e decisão, obtém executor da sessão e usa o relógio do servidor. Exige Financeiro/Administração vigente e delega ao executor transacional, preservando revalidação, isolamento por matrícula e repetição sem duplicidade. Revalida as páginas do aluno e do Financeiro após a operação.

A conferência mostra a ação de efetivação para uma decisão aprovada ainda não aplicada. Após a conclusão, apresenta executor, data e resumo dos valores aprovados, mantendo o histórico acessível em pedidos concluídos e retirando as ações de decisão/efetivação. O crédito exibido não comprova devolução de dinheiro. A consulta de um encerramento concluído não depende de recarregar o contexto de uma matrícula ativa.

A origem acadêmica inclui o regime de cobrança da preparação comercial. Para HORA_PARTICULAR, encontro não cancelado/não rascunho até o limite contratual e sem reserva de horas gera pendência de destinação financeira. É uma proteção provisória: o fechamento posterior por hora ainda não tem destinação persistida integrada. Regime legado ausente, cancelamentos cobráveis e conferência completa das ocorrências permanecem pendentes; esta proteção não comprova a apuração integral.

Validação desta versão: 32 testes de integração em encerramento-solicitacao e compra-horas aprovados, incluindo chamadas públicas concorrentes, rejeição de executor fornecido pelo cliente, data efetiva futura, consulta concluída e a pendência por hora. Lint aprovado nos nove arquivos alterados; build aprovado com TypeScript e 52 páginas. Sem migration; 148 migrations até o incremento 315. Última suíte unitária integral: 311; última regressão integral de integração: 298. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 317 — Apuração detalhada do fechamento por hora, 13/09/2026

apurarFechamentoHoras reúne ocorrências conferidas por matrícula, período e moeda. Usa os minutos contratados divididos por 60, preço da versão aplicável a cada encontro e dinheiro decimal: arredondar uma vez por item e somar os itens. Preserva evidência, horários, comunicação, antecedência contratada e classificação financeira. Falta/cancelamento tardio cobra integral; cancelamento no prazo ou pela escola não compõe valor. Não altera presença nem conclusão do diário.

O período possui referência e limites explícitos, separados do vencimento. A inclusão técnica usa início do encontro no intervalo inclusivo/exclusivo informado; a montagem dos limites pela condição contratual ainda deve ser integrada ao serviço. Não presume mês/fuso ou calendário financeiro. Duplicação de encontro, mistura de matrícula/moeda, ocorrência de outra versão/horário, duração não inteira em minutos e total acima da precisão monetária são recusados.

Destinação faturada ou antecipação conferida fica preservada, fora dos novos itens. Reserva antecipada pendente exige conferência, sem ser tratada como quitação ou nova obrigação. Ocorrência ausente permanece pendente. O Financeiro pode apurar com a escolha de aguardar ou propor parcial: parcial identifica aprovação independente obrigatória, mas não emite. Uma complementar inclui apenas itens sem destinação anterior; a proteção transacional contra concorrência depende da persistência ainda por implementar.

Validação: 14 novos unitários; 18 aprovados junto ao classificador existente. Suíte unitária integral: 821 testes em 88 arquivos, zero falhas. TypeScript e lint dos dois arquivos aprovados. Sem schema, migration ou interface alterados; último build e integração direcionada no incremento 316, última regressão integral de integração no 298.

Limite: núcleo interno de cálculo, ainda sem ação pública, leitor de origens persistidas, registro/conferência de ocorrências posteriores, proposta/aprovação parcial ou emissão transacional. Não remover a pendência provisória do encerramento de Q93/Q101 antes dessa integração. Não há nova cobrança, recebimento ou produção. O objetivo integral permanece incompleto.

## Incremento 318 — Informe docente persistido por encontro particular, 13/09/2026

OcorrenciaParticular registra matrícula, encontro, professor autor, versão, tipo, horários, comunicação de cancelamento, evidência e chave de repetição. O registro é imutável; nova informação gera versão sequencial preservando a anterior. registrarOcorrenciaParticular exige professor ativo atribuído ao encontro, revalida a atribuição dentro da transação e devolve apenas identificação/versão, sem preços ou dados financeiros.

Realização/falta só podem ser informadas após o término em encontro previsto/ministrado. Cancelamento exige encontro cancelado com decisão pedagógica aprovada, sem transformar o informe em decisão financeira. Não cria diário, presença, cobrança, recebimento ou consumo de horas. O banco verifica vínculos, autoria, horários e sequência; a operação registra evento na mesma transação. Agenda e matrícula são bloqueadas na ordem compartilhada pelos fluxos existentes.

A primeira validação encontrou incompatibilidade entre timestamp sem fuso e o fuso da sessão PostgreSQL. Migration adicional fixa criadoEm pelo relógio do banco convertido explicitamente a UTC; o cliente não escolhe o instante do registro. Comunicação futura é recusada. As migrations aplicadas anteriormente não foram reescritas.

Validação final: 13 integrações aprovadas em informe docente (6 novas) e cancelamento particular (7 existentes), incluindo concorrência/repetição, versões, imutabilidade, acesso revogado, atribuição, origem divergente, rollback, cancelamento aprovado e ausência de efeitos financeiros/acadêmicos. TypeScript, lint e build com 52 páginas aprovados; schema diff vazio. Migrations 20260914100000_ocorrencia_particular e 20260914101000_relogio_ocorrencia_particular aplicadas somente no banco descartável; 150 migrations. Última suíte unitária integral: 317 (821 testes); última regressão integral de integração: 298.

Ainda falta interface docente, conferência financeira vinculada à versão informada e às condições contratuais, aprovação parcial, emissão persistida e integração à apuração/encerramento. Informar ocorrência não satisfaz Q93/Q101 por si só. Quando a conferência financeira for adicionada, alteração posterior do informe deverá exigir revisão dos efeitos, sem substituir silenciosamente a versão faturada. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 319 — Interface docente e histórico dos informes, 13/09/2026

A página do encontro particular apresenta formulário de ocorrência e histórico por versão, com autor, instante do registro, comunicação e evidência. Realização/falta são oferecidas depois do término; cancelamentos são oferecidos quando há decisão pedagógica aprovada. A navegação de encontros próprios inclui particulares futuras, ministradas e canceladas, mantendo as condições de registro no servidor. A chamada permanece uma operação distinta.

consultarOcorrenciasParticular revalida professor ativo e atribuição em leitura consistente. Projeta apenas dados necessários do encontro e informes, sem valores ou dados pessoais/financeiros do aluno. Turmas não recebem este formulário. A comunicação usa data/hora no fuso identificado do encontro; o conversor recusa horários inexistentes ou ambíguos. Repetição de envio conserva a chave enquanto a entrada não mudar, e nova versão preserva os informes anteriores.

Validação: seis integrações de ocorrência aprovadas, ampliadas para histórico ordenado, formato temporal, acesso indevido/revogado, permissões de registro e projeção dos campos. Lint aprovado nos cinco arquivos alterados; build com TypeScript e 52 páginas aprovado; diff sem erros. Sem migration; último schema diff vazio no incremento 318. Última suíte unitária integral: 317; última regressão integral de integração: 298.

Sem homologação interativa desta interface. Conferência financeira vinculada à versão e às condições contratuais, emissão parcial, apuração persistida e integração ao encerramento permanecem pendentes. Informes ainda não confirmam cobrança nem alteram diário/presença. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 320 — Origem aprovada do cancelamento particular, 13/09/2026

A integração dos informes expôs incompatibilidade: a liberação de horas tratava qualquer cancelamento aprovado como cancelamento da escola. PropostaCancelamentoParticular passa a registrar origem ESCOLA/ALUNO, preservada com a proposta imutável e apresentada ao aprovador. A interface exige escolha explícita. Chamadores anteriores sem origem mantêm ESCOLA, que era o alcance declarado da tela/fluxo anterior, sem alterar sua chave/hash de repetição. Migração de base real requer conferir se o histórico foi usado fora desse alcance.

O informe docente só aceita a mesma origem do cancelamento aprovado, validada na ação e no banco. A consulta fornece a origem e o formulário oferece apenas a opção correspondente. O fluxo de liberação/remarcação ou crédito próprio de Q95 exige origem ESCOLA; proposta financeira com cancelamento do aluno é recusada no serviço e no banco. Cancelamento do aluno não consome nem devolve horas automaticamente: sua conferência contratual de antecedência continua pendente.

Validação: 36 integrações aprovadas em compra de horas, ocorrências e cancelamento, incluindo novo caso de recusa de liberação/crédito para origem ALUNO e divergência do informe por serviço/SQL. Build final com TypeScript e 52 páginas aprovado; lint e diff sem erros; schema diff vazio. Migration 20260914102000_origem_cancelamento_particular aplicada somente ao banco descartável; 151 migrations. Última suíte unitária integral: 317; última regressão integral de integração: 298.

Ainda implementar condições de antecedência versionadas/aceitas, conferência financeira, emissão parcial e integração ao encerramento. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 321 — Condições contratuais estruturadas de cobrança por hora, 13/09/2026

CondicoesHorasMatricula preserva matrícula, documento confirmado, versão, regras, preparador e decisão. As regras identificam preço/hora, moeda, unidade fixa de 60 minutos, início de vigência com fuso explícito, antecedência de cancelamento e referências das cláusulas de preço/cancelamento. Não há prazo numérico padrão. A transcrição não altera o contrato original nem autoriza mudança comercial sem formalização.

Secretaria/Administração prepara; outra pessoa da Administração aprova ou rejeita. Só uma versão pendente é permitida por matrícula, com sequência serializada. O banco revalida autor, decisão independente, fonte confirmada/vinculada, moeda e dados obrigatórios; não aceita criação diretamente aprovada ou alteração/apagamento de versões decididas. Fonte arquivada impede aprovação, mas permite rejeitar a proposta pendente. Oferta preparada em regime mensal não aceita condições de hora. Matrículas legadas ainda exigem transcrição e conferência explícitas do documento.

Quatro integrações aprovadas: preparação/decisão, autoaprovação recusada por serviço e SQL, preservação, parâmetros incompletos, moeda incompatível, contrato não confirmado, concorrência, fonte arquivada e usuário revogado. Lint e build com TypeScript/52 páginas aprovados; schema diff vazio; migration 20260914103000_condicoes_horas aplicada apenas no banco descartável, total de 152 migrations. Última suíte unitária integral: 317; última regressão integral de integração: 298.

Ainda falta interface e seleção explícita/revalidação da versão aplicável na conferência da ocorrência, incluindo vigência e conflitos entre transcrições. Não usar simplesmente a última configuração para faturar aulas antigas. Este incremento não emite cobrança, não registra recebimento e não modifica PDF/assinaturas; geração dessas condições em novos documentos e aditivos permanece pendente. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 322 — Interface e consulta das condições por hora, 13/09/2026

A rota /matriculas/[id]/condicoes-horas apresenta preparação, cláusulas, vigência, histórico de versões e decisão independente. A página de condições de entrada das ofertas por hora oferece o acesso. Secretaria/Administração prepara após contrato confirmado e sem versão pendente; Administração distinta do preparador decide. Financeiro consulta em leitura. Professor não consulta condições financeiras.

A consulta revalida usuário e projeta as condições da matrícula em leitura consistente. O formulário não preenche antecedência ou preço automaticamente; mantém unidade 60 e moeda da matrícula. Vigência é informada como data/hora no fuso institucional identificado e convertida sem escolha silenciosa em horário ambíguo/inexistente. O servidor permanece responsável pela validação final, incluindo documento vigente/disponível e regime compatível.

Cinco integrações aprovadas, incluindo consulta das versões, permissão independente, leitura financeira, recusa ao professor e usuário revogado. TypeScript, lint e build com 52 páginas aprovados; diff sem erros. Sem migration; último schema diff vazio 321, última suíte unitária integral 317 e última regressão integral de integração 298.

Sem homologação interativa. Ainda falta conectar a versão aplicável à ocorrência e à conferência financeira, resolver vigências conflitantes e emitir/aprovar parciais com proteção transacional. A interface transcreve contrato confirmado; não altera documento nem emite cobrança. Matrículas legadas ainda precisam de entrada de navegação e conferência na migração. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 323 — Prévia financeira com ocorrência e condições persistidas, 13/09/2026

preverConferenciaOcorrenciaHoras exige Financeiro/Administração vigente, aluno/matrícula correspondentes e versões explícitas do informe e das condições. O leitor interno mantém as travas de agenda/matrícula do chamador e confere contrato confirmado, documento disponível, moeda, regime preparado, horários e último informe. Condições ainda não vigentes, versão mais nova aplicável, transcrição pendente aplicável ou mudança dentro do encontro exigem conferência. Versão futura posterior ao encontro não reprecifica a aula antiga.

A classificação usa a antecedência transcrita do contrato e a origem aprovada do cancelamento, sem preço/prazo fornecidos pelo cliente. Calcula minutos contratados e valor decimal por hora de 60 minutos. Devolve referências, condições, classificação e memória, sem registrar conferência ou emitir cobrança. Reservas antecipadas são identificadas como pendência de destinação; não constituem automaticamente nova dívida.

Oito integrações aprovadas nas condições por hora (três cenários novos): preço aplicável em 75 minutos, condição futura, documento arquivado, isolamento por aluno, professor sem acesso financeiro, informe superado, cancelamento tardio com limite contratual e vigência conflitante. TypeScript, lint e build com 52 páginas aprovados; diff sem erros. Sem migration; último schema diff vazio no 321. Última suíte unitária integral 317; última regressão integral de integração 298.

Ainda persistir a conferência financeira com suas origens e proteger alterações posteriores; criar interface, fechamento parcial aprovado e emissão sem duplicidade. Histórico com aditivos/documentos anteriores necessita sua cadeia contratual, não está comprovado pelo leitor do contrato atualmente confirmado. A prévia não conclui Q93/Q101 nem remove a pendência de encerramento. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 324 — Conferência financeira persistida da ocorrência, 13/09/2026

ConferenciaOcorrenciaHoras preserva encontro, informe, condições aprovadas, conferente, minutos, valor, moeda, desfecho e memória da prévia. A ação exige Financeiro/Administração vigente, correspondência aluno/matrícula e hash da prévia revalidada. Chave de repetição e unicidade por encontro/informe impedem duplicação; repetição continua exigindo acesso atual. A gravação e o evento são atômicos, sem emissão de cobrança ou recebimento.

O banco confere autoria financeira, origem, contrato, moeda, vigência, cancelamento e cálculo de minutos/valor. Conferência de encontro com reserva antecipada é recusada neste fluxo, exigindo destinação própria. Conferências são imutáveis; novos informes e novas reservas de horas sobre encontro conferido são bloqueados, assim como alterações financeiras relevantes da agenda. A passagem PREVISTO para MINISTRADO permanece permitida para conclusão acadêmica. A interface docente identifica a conferência e orienta revisão dos efeitos antes de alterar.

Quinze integrações aprovadas nos arquivos de condições e ocorrências, incluindo novo cenário de gravação concorrente, repetição, hash divergente, cálculo SQL divergente, revogação, preservação e bloqueio da agenda/informe. O ensaio de concorrência precisou do adaptador de sessão já usado em outras suítes para evitar importação concorrente do NextAuth no Vitest; a ação e o banco continuam revalidando usuário/papéis. TypeScript, lint e build com 52 páginas aprovados; schema diff vazio; migration 20260914104000_conferencia_ocorrencia_horas aplicada somente ao banco descartável, total de 153 migrations.

Ainda criar interface financeira e consulta específica da conferência registrada; a prévia continua sendo cálculo, não histórico de conferência. Implementar revisão aprovada dos efeitos antes de permitir alteração de registro conferido, além de emissão parcial/fechamento e integração com antecipações/encerramento. O bloqueio preserva os dados enquanto essa revisão não está disponível; não equivale ao fluxo de correção concluído. Última suíte unitária integral 317; última regressão integral de integração 298. Sem homologação interativa, produção ou envios externos. Objetivo geral incompleto.

## Incremento 325 — Interface financeira da ocorrência e memória registrada, 13/09/2026

A ficha financeira oferece navegação por matrícula para /matriculas/[id]/ocorrencias-financeiras, incluindo acesso às condições por hora de contratos legados. A consulta exige Financeiro/Administração vigente, pagina encontros particulares em grupos de 30 e valida o cursor dentro da matrícula. Apresenta informe vigente, versões contratuais aprovadas e conferência persistida com valores serializados, autor, motivo e memória histórica.

A tela separa prévia de conferência registrada. Selecionar outra versão invalida a prévia; registrar exige justificativa e usa o hash revalidado no servidor. Repetição mantém a chave para a mesma entrada. Condições, vigência, desfecho, preço, minutos, comunicação/limite e pendências de antecipação são apresentados. Conferência salva mostra a memória preservada com cláusulas e versões, sem recalcular o histórico pela configuração atual. Emissão da cobrança continua uma etapa separada.

Nove integrações de condições por hora aprovadas, ampliadas para consulta histórica do valor/origens, cursor fora da matrícula, professor sem acesso e usuário revogado. Lint aprovado nos cinco arquivos alterados; build com TypeScript e 52 páginas aprovado; diff sem erros. Sem migration. Último schema diff vazio no incremento 324; última suíte unitária integral 317 e última regressão integral de integração 298.

Sem homologação interativa desta interface. Ainda implementar fechamento mensal, proposta/decisão parcial, emissão transacional, destinação de antecipações e revisão dos efeitos da conferência. A navegação não comprova operação integral desses fluxos nem a migração de dados reais. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 326 — Leitura da apuração por período com conferências persistidas, 13/09/2026

carregarApuracaoHorasTx lê os encontros particulares publicados do período informado, incluindo cancelados e encontros sem informe/conferência. Somente a conferência financeira preservada fornece preço, condições e ocorrência ao cálculo. Informe docente isolado permanece pendência; condições/preço ausentes são representados por null, sem fabricar valor zero ou versão fictícia. A apuração conserva identificadores do encontro, informe e conferência.

O leitor confronta memória, condições imutáveis, minutos, moeda, valor, desfecho e vínculo com a conferência gravada. Reserva de horas antecipadas com consumo/liberação conferidos é preservada fora da nova obrigação; reserva sem destinação continua pendente. Não reprecifica encontros conferidos pelo catálogo atual. Rascunho não integra a apuração. O chamador deve fornecer período/vencimento contratuais e manter travas de agenda/matrícula; este leitor é interno, sem nova ação pública.

Dez integrações de condições por hora aprovadas, incluindo novo cenário com informe ainda não conferido, conferência completa, encontro adicional pendente, proposta parcial e isolamento do aluno. Quatorze unitários do cálculo aprovados; suíte unitária integral também executada: 821 testes em 88 arquivos, zero falhas. TypeScript e lint aprovados. Sem schema/migration/UI alterados; último build 325, último schema diff vazio 324, última regressão integral de integração 298.

Ainda persistir período contratual/fechamento, aprovar emissão parcial, registrar itens faturados e impedir repetição sob concorrência na emissão. O estado de apuração completa não comprova faturamento; o leitor ainda não consome origem persistida de item faturado porque esse registro não existe. Integrar antecipações liberadas e revisão financeira aos cenários completos antes de habilitar produção. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 327 — Rascunho persistido do fechamento mensal por hora, 14/09/2026

O Financeiro/Administração pode preparar uma versão imutável da apuração por matrícula, vinculada ao contrato confirmado. O registro conserva a referência civil ou ciclo mensal proposto, fuso, limites do período, vencimento, cláusula informada, escolha de aguardar/propor parcial, motivo e origens da apuração. A referência transcrita ainda precisa de conferência contratual antes da emissão; salvar o rascunho não aprova suas condições nem gera cobrança.

A ação verifica permissões vigentes e vínculo do aluno, trava agenda/matrícula e preserva a chave de repetição. Solicitações concorrentes iguais retornam a mesma versão; entrada divergente com a mesma chave e versão anterior desatualizada são rejeitadas. A migration protege autoria autorizada, documento disponível, sequência de versões, coerência de matrícula/período e imutabilidade. O banco não certifica sozinho toda a memória financeira: a futura aprovação deve revalidar as origens e a apuração.

Validação: 11 testes de integração de condições por hora aprovados; 17 unitários de período/apuração aprovados, incluindo fevereiro bissexto, ciclo no dia 31 e mudança de horário de verão. TypeScript e lint aprovados. As 154 migrations estão aplicadas somente na base descartável; schema diff vazio. Último build: incremento 325; última suíte unitária integral: 326 (821 testes); última regressão integral de integração: 298. Nenhuma homologação de interface realizada neste incremento.

Pendências: consulta/interface do fechamento, aprovação independente da proposta parcial, conferência da referência contratual, itens faturados e emissão transacional sem duplicação. Sobreposição de propostas não é autorização de faturamento. Não habilitar produção usando apenas este rascunho. Sem produção, importação real ou envios externos. Objetivo geral incompleto.

## Incremento 328 — Consulta autorizada das versões de fechamento por hora, 14/09/2026

consultarFechamentosHoras oferece listagem paginada e leitura individual das versões preservadas. Exige Financeiro/Administração vigente e matrícula pertencente ao aluno informado; cursor e identificador da versão são validados na mesma matrícula. A leitura usa transação RepeatableRead. A listagem traz até 30 versões, autor, motivo, documento e intervalos, sem carregar a memória completa dos encontros. A consulta individual retorna o snapshot preservado, sem recalcular a apuração pelo estado atual. Chave de repetição e hash da entrada não são expostos. Toda versão é identificada como rascunho e não comprova emissão.

Validação: 12 integrações de condições por hora aprovadas, incluindo resumo/detalhe, navegação por cursor, consulta de versão anterior, isolamento aluno/matrícula, Financeiro autorizado, professor/Secretaria sem acesso e usuário desativado. TypeScript e lint aprovados. Nenhuma migration ou interface alterada. Último build 325, schema diff vazio 327, suíte unitária integral 326 e regressão integral de integração 298.

Ainda faltam interface, aprovação independente, revalidação da referência contratual e emissão com itens faturados persistidos. A consulta histórica não atesta validade atual da proposta nem autoriza cobrança. Sem produção, importação real ou envios externos. Objetivo geral incompleto.

## Incremento 329 — Interface de consulta dos fechamentos por hora, 14/09/2026

A conferência das particulares oferece acesso ao histórico em /matriculas/[id]/fechamentos-horas. A página exige sessão financeira e utiliza a consulta autorizada do incremento 328. Lista versões com autor, motivo e intervalo, navega por cursor e abre a apuração preservada individualmente. O detalhe apresenta período civil/fuso, vencimento, estado, total, minutos, encontros incluídos com data e preço, pendências e quantidades preservadas/sem cobrança. Memória incompatível apresenta erro de conferência, sem inventar valores. Rascunho não é apresentado como aprovação, emissão ou recebimento.

Validação: build Next.js aprovado após a última alteração, incluindo TypeScript e geração de 52 páginas estáticas; a nova rota dinâmica consta no resultado. Lint e TypeScript independente aprovados. Testes de autorização/histórico continuam os 12 aprovados no incremento 328; não foram repetidos para esta alteração de apresentação. Sem migration; último schema diff vazio 327. Sem homologação visual interativa.

Ainda completar preparação pela interface, detalhes de destinações/pendências identificáveis por encontro, aprovação independente, revalidação contratual e emissão transacional. Esta tela consulta rascunhos já persistidos; não conclui o fluxo operacional. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 330 — Preparação do fechamento por hora pela interface, 14/09/2026

O histórico de fechamentos agora inclui formulário de preparação. Financeiro/Administração informa referência civil/ciclo, âncora quando aplicável, data no período, fuso, vencimento, cláusula, motivo e escolha de aguardar/propor parcial. A consulta calcula os limites e busca a última versão do período exato, sem depender da página do histórico. A tela apresenta período e versão antes de salvar; alteração de campo invalida a conferência. O servidor continua revalidando contrato, escopo, permissões, versão e apuração na transação de gravação.

A entrada conserva a mesma chave de repetição enquanto for idêntica. Resultado de transporte incerto orienta consultar o histórico; erro explícito permite conferir novamente. Salvar abre a versão persistida, sem emitir cobrança. Não foram presumidos fuso, prazo ou condições contratuais. O documento utilizado é o atual da matrícula, sujeito à conferência do serviço no momento da gravação.

Validação: 12 integrações aprovadas, ampliadas para versão corrente do período e ausência de versões em outro mês. Lint aprovado nos quatro arquivos. Build com TypeScript e 52 páginas aprovado; após ajuste final de recuperação do formulário e ampliação dos testes, TypeScript independente aprovado. Sem migration e sem homologação visual interativa.

Pendências: detalhamento identificável dos encontros pendentes e destinações, aprovação independente, revalidação contratual e emissão transacional com origens faturadas. O formulário prepara rascunho; não conclui o fechamento financeiro. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 331 — Revalidação transacional do fechamento por hora, 14/09/2026

revalidarFechamentoHorasTx confere matrícula/aluno, entrada preservada, contrato atual confirmado, documento disponível, limites do período e versão mais recente. Recompõe a apuração sob as travas de agenda/matrícula e confronta integralmente com o snapshot, sem atualizar o rascunho. É um componente interno para integração à decisão/execução na mesma transação; o chamador deve autenticar e autorizar o responsável. Não existe ainda aprovação ou emissão por este componente.

As origens passaram a preservar início, fim e estado dos encontros, além de identificadores do informe/conferência. Isso detecta remarcação dentro do próprio período mesmo quando o total permanece igual. Versões antigas sem essas informações continuam no histórico, mas exigem nova preparação antes de aprovação; nenhum histórico foi preenchido artificialmente.

Validação: 13 integrações aprovadas. O novo cenário verifica versão atual, aluno incorreto, remarcação de encontro pendente com rollback, conferência financeira posterior, versão superada e documento arquivado, sem emissão. TypeScript e lint aprovados. Sem migration/interface alterada; último build 330. A validação é técnica das origens e não substitui a conferência humana da referência contratual.

Pendentes: integrar aprovação independente e emissão transacional, resolver sobreposição entre períodos propostos e persistir os itens faturados. Revalidação isolada não certifica a operação completa. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 332 — Decisão independente do fechamento por hora, 14/09/2026

DecisaoFechamentoHoras preserva decisão única por versão, responsável, motivo, data e confirmação explícita da referência contratual. decidirFechamentoHoras exige Administração ou Financeiro com financeiro.aprovar_acertos vigente e pessoa distinta do preparador. Aprovação revalida contrato, período, versão e todas as origens na mesma transação. Rejeição preserva o histórico sem exigir que a apuração continue atual. Repetição exata retorna a decisão; tentativa divergente não a substitui. A escolha de aguardar também pode receber decisão, sem autorizar emissão dos encontros pendentes.

A migration protege autoria autorizada, independência, versão/documento na aprovação e imutabilidade. A recomposição integral das origens é responsabilidade do serviço e deve ocorrer novamente na emissão; uma linha de decisão isolada não certifica faturamento. A consulta e a tela mostram a decisão separada do estado histórico da apuração.

Validação: 14 integrações aprovadas, incluindo autoaprovação, Financeiro sem permissão, referência não confirmada, concorrência/repetição, histórico da decisão, tentativa de alteração/exclusão e revogação de permissão. Build com TypeScript e 52 páginas aprovado; lint aprovado. Migration aplicada somente na base descartável: 155 migrations, schema diff vazio. Sem homologação visual interativa.

Pendentes: formulário para decidir pela interface, cenários adicionais de aprovação/rejeição após mudanças de origem, emissão transacional com revalidação e itens faturados, tratamento de períodos sobrepostos e integração ao encerramento. A decisão não emite cobrança. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 333 — Decisão do fechamento pela interface, 14/09/2026

A consulta expõe elegibilidade de decisão calculada com permissões vigentes, autoria e ausência de decisão. O detalhe apresenta a cláusula/período transcritos e a escolha de aguardar ou propor parcial sem expor chave/hash da entrada. O formulário exige decisão e justificativa; aprovação também exige confirmação explícita da referência contratual. Ao salvar, o serviço revalida independência, permissões e origens. A rejeição continua disponível para uma versão desatualizada, sem alterá-la. A elegibilidade da tela não certifica validade atual para aprovação.

Validação: 15 integrações aprovadas, ampliadas para visibilidade do decisor, cláusula apresentada, bloqueio após nova conferência financeira e documento arquivado, rejeição preservada e retirada do formulário após decisão. Build com TypeScript e 52 páginas aprovado; TypeScript final e lint aprovados. Sem migration. Sem homologação visual interativa.

Pendentes: acesso direto ao documento contratual de origem nesta tela, detalhamento das destinações e encontros pendentes, emissão transacional, proteção contra faturamento duplicado e integração ao encerramento. Aprovação não comprova emissão. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 334 — Emissão interna do fechamento e origens faturadas, 14/09/2026

EmissaoFechamentoHoras vincula decisão, cobrança, executor e memória; ItemFechamentoHoras vincula cada conferência faturada uma única vez. emitirFechamentoHorasTx exige executor Financeiro/Administração vigente, decisão aprovada da matrícula/aluno e revalidação das origens. Apuração completa ou proposta parcial com itens pode emitir; aguardar pendências e ausência de itens não geram cobrança. A cobrança HORA_PARTICULAR conserva valor apurado, moeda e vencimento no fuso proposto, sem criar recebimento. Registro, itens e evento são gravados na mesma transação. Repetir a decisão retorna a emissão existente.

O leitor da apuração reconhece itens faturados e os preserva fora do novo valor, inclusive em nova versão do período. A migration impede repetir a conferência em outro item, protege a imutabilidade da origem e confere o vínculo/valor do item com a decisão aprovada. Esta primeira proteção não substitui as verificações integrais de emissão no serviço; ainda faltam restrições de fechamento do conjunto e proteção contra alterações incompatíveis da cobrança por outros fluxos.

Validação: 16 integrações aprovadas. O novo cenário cobre conferência, preparação, decisão independente, duas emissões simultâneas, uma cobrança de 156,25 CRC, um item, imutabilidade, apuração posterior zerada com origem faturada e ausência de recebimento. TypeScript e lint aprovados. Base descartável com 156 migrations e schema diff vazio. Último build 333. Sem interface de emissão ou homologação visual.

Pendentes: endurecer integridade do conjunto cobrança/emissão/itens, testar emissão parcial e mudanças concorrentes entre decisões/períodos, proteger alterações da cobrança, expor ação autenticada/interface e integrar o encerramento. Executor é interno; o chamador deve fornecer identidade autenticada. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 335 — Integridade do conjunto de emissão por hora, 14/09/2026

A nova migration confere executor vigente, decisão independente, memória igual à versão aprovada e compatibilidade inicial de matrícula, tipo, moeda, valores e vencimento da cobrança. Uma constraint diferida exige que a transação termine com a quantidade, soma e encontros dos itens correspondentes à apuração. Origem da cobrança (matrícula, tipo, moeda e valor original) passa a ser preservada após emissão. Pagamentos e ajustes não são inferidos desta origem.

O executor força a verificação da constraint antes de retornar sucesso. O teste inicial expôs rejeição no commit sem propagação esperada pelo Prisma; a verificação explícita na transação corrigiu o caminho de erro observável. Transação sem itens reverte também a cobrança. Não foi removida ou afrouxada a constraint.

Validação final: 16 integrações aprovadas, incluindo transação incompleta, rollback, origem alterada, emissão concorrente e apuração posterior. TypeScript e lint aprovados. Base descartável com 157 migrations; schema diff vazio. Último build 333. Sem interface alterada.

Pendentes: cenários adicionais de emissão parcial e concorrência entre períodos/decisões, ajustes autorizados de valor/vencimento e efeitos em outros fluxos, ação pública/interface e encerramento. Banco confere consistência do conjunto; revalidação completa da agenda/contrato permanece no serviço antes de emitir. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 336 — Emissão parcial, complementar e ação autenticada, 14/09/2026

emitirFechamentoHoras recebe apenas aluno, matrícula e decisão; obtém o executor da sessão Financeiro/Administração e delega à transação protegida. Após sucesso, invalida as páginas do fechamento e Financeiro. O cliente não escolhe a identidade executora. Esta ação ainda não possui botão na interface.

O novo cenário integrado cobre dois encontros, um conferido e outro pendente: a decisão de aguardar impede emissão; uma nova versão parcial aprovada gera 156,25 CRC; após conferência do segundo encontro, uma versão complementar gera somente 125,00 CRC. A primeira origem fica preservada fora da nova cobrança. Repetir ambas as decisões retorna suas emissões anteriores. Não há recebimento criado. A ação pública foi exercitada com repetição autorizada, aluno incorreto e professor sem permissão.

Validação: 17 integrações aprovadas, TypeScript e lint aprovados, build com 52 páginas aprovado. Sem migration; último schema diff vazio 335. Nenhuma homologação visual interativa.

Pendentes: navegação/identificação explícita das cobranças parcial e complementar, botão de emissão e memória no Financeiro, testes de decisões concorrentes sobre períodos sobrepostos, integração ao encerramento e ajustes posteriores. Não considerar o fluxo inteiro concluído por este cenário. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 337 — Emissão pela interface e consulta da cobrança, 14/09/2026

O detalhe da versão aprovada com itens e estado apto oferece Emitir cobrança aprovada, exibindo o valor antes da ação. O servidor continua revalidando as origens e a decisão. Após registro, a tela apresenta emissão, executor/data, identificação da cobrança, valor original, valor atual e saldo, com acesso à ficha financeira. Emissão existente retira a ação de emitir. Estado histórico da apuração permanece separado do registro da emissão.

A consulta serializa valores e datas da cobrança, mantendo emissão nula para decisões ainda não executadas. O histórico mostra separadamente a cobrança parcial e a complementar vinculadas às respectivas versões. Não transforma emissão em pagamento; recebimentos continuam na ficha financeira. O botão é uma possibilidade de execução, não uma garantia de que origens ainda estejam válidas.

Validação: 17 integrações aprovadas, ampliadas para ambas as cobranças no histórico, valores/saldos e versão sem emissão. Build com TypeScript e 52 páginas aprovado após correção de sintaxe na consulta; lint aprovado. Sem migration. Sem homologação visual interativa.

Pendentes: apresentação explícita do vínculo entre cobranças complementares, acesso ao contrato de origem, identificação dos encontros pendentes/destinações, concorrência entre períodos sobrepostos e integração ao encerramento/ajustes. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 338 — Concorrência de períodos sobrepostos e regressão unitária, 14/09/2026

Foi exercitado o cenário de dois rascunhos aprovados com referências distintas (mês civil e ciclo da matrícula) que incluem a mesma conferência. As emissões públicas são disparadas simultaneamente. A trava serializa a revalidação: uma cria a cobrança/item e a outra identifica mudança das origens, exigindo nova versão. Repetir a vencedora retorna sua emissão; repetir a outra continua sem emitir. A existência de duas propostas não autoriza cobrar o mesmo encontro duas vezes nem decide qual referência contratual deveria ter sido escolhida pela equipe.

Validação: 18 integrações de condições por hora aprovadas; uma única cobrança, emissão e item no cenário de sobreposição, sem recebimentos. Suíte unitária integral executada: 824 testes em 89 arquivos, zero falhas. TypeScript e lint aprovados. Sem alteração de produção ou migration neste incremento. Último build 337, último schema diff vazio 335. A última regressão integral de integração permanece 298; os testes atuais são direcionados.

Pendentes: revisão da usabilidade das referências concorrentes, vínculo visível entre cobranças complementares, detalhes de origens, integração ao encerramento/ajustes e homologação visual. Não inferir conclusão geral a partir destas verificações. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 339 — Identificação dos encontros e cobranças anteriores, 14/09/2026

O detalhe identifica pendências e destinações preservadas pelo horário guardado na origem, no fuso da apuração. Memórias antigas sem horário permanecem identificadas como incompletas; não são reconstruídas pela agenda atual. Encontros sem cobrança exibem data e motivo de classificação. Para encontros já faturados, a consulta resolve o fechamento anterior dentro da mesma matrícula e oferece navegação até a cobrança de origem, permitindo acompanhar a complementar sem repetir seus itens.

A resolução usa somente as referências preservadas no snapshot individual e filtra tanto cobrança quanto rascunho pela matrícula autorizada. A lista paginada não carrega essas origens. Destinações de antecipações continuam indicadas como conferidas, sem afirmar recebimento novo.

Validação: 18 integrações aprovadas, ampliadas para vínculo da cobrança complementar com a versão parcial e horários preservados das origens. Build com TypeScript e 52 páginas aprovado após correção de estreitamento de tipo no componente; lint aprovado. Sem migration. Última suíte unitária integral 338 (824 testes). Sem homologação visual interativa.

Pendentes: acesso ao documento contratual nesta tela, detalhes próprios das destinações de antecipação, integração ao encerramento/ajustes e homologação visual. A navegação não substitui a conferência contratual nem autoriza correções financeiras. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 340 — Contrato do fechamento e autorização financeira do arquivo, 14/09/2026

A tela oferece abertura do contrato de origem quando ele é o documento atual confirmado da matrícula, não arquivado e usa a rota privada de uploads. Links externos ou referências indisponíveis não são publicados. A abertura passa novamente pela autorização da rota privada, com sessão e papéis atuais.

Foi corrigida a divergência que permitia ao Financeiro conferir condições mas negava o próprio contrato: podeLerArquivo permite CONTRATO somente quando o documento exato está registrado como contrato confirmado de uma matrícula coerente com seu vínculo direto ou lead. Os demais documentos administrativos continuam restritos. Arquivado, finalidade de upload incompatível e contrato não confirmado não recebem essa concessão. A mudança concede leitura, não edição ou upload administrativo.

Validação: 19 integrações de condições por hora e 23 unitários de autorização aprovados. O mock unitário foi ampliado para a nova consulta de vínculo; o teste anterior de contrato sem confirmação continua negando Financeiro. Build com TypeScript e 52 páginas aprovado; após ajuste final de visibilidade conforme confirmação, TypeScript aprovado. Lint aprovado antes desse ajuste simples. Sem migration. Sem homologação visual interativa ou comprovação de existência física dos arquivos legados.

Pendentes: versões contratuais substituídas/aditivos e sua leitura histórica, detalhes de antecipações, integração ao encerramento/ajustes e homologação visual. Acesso permitido não comprova que o arquivo legado exista no armazenamento. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 341 — Destinação financeira por hora na conferência de encerramento, 14/09/2026

A conferência da agenda de encerramento reconhece conferências faturadas e preserva cobrança/item como origem. Encontros por hora sem destinação continuam pendentes até emitir ou comprovar não cobrança. Cancelamentos deixam de ser ignorados: sem conferência continuam pendentes; cancelamento da escola ou do aluno no prazo, conferido sem valor, é identificado como SEM_COBRANCA. Cancelamento tardio cobrável permanece pendente até destinação. Matrículas legadas sem preparação comercial são reconhecidas como por hora quando têm condições aprovadas.

O acerto conserva destinacoesHoras na memória; alterações futuras dessa origem invalidam propostas anteriores pela revalidação existente. Não cria quitação, não cancela dívidas e não dispensa a consolidação das cobranças no acerto. Encontros com reservas antecipadas continuam sujeitos ao fluxo próprio de liquidação, ainda a revisar em conjunto.

Validação: 29 integrações de condições por hora e solicitação de encerramento aprovadas inicialmente; após acrescentar os cenários de cancelamento, 21 testes do arquivo de condições por hora aprovados (incluindo os 19 anteriores). TypeScript e lint aprovados. Cenários cobrem bloqueio antes de faturar, liberação após emissão com origem preservada, cancelamento sem conferência, no prazo sem cobrança e tardio ainda pendente. Sem migration/interface alterada; último build 340.

Pendentes: consolidação financeira completa das cobranças por hora no acerto, reservas antecipadas e cancelamentos pela escola no encerramento, execução integral do encerramento com esses casos, ajustes e homologação visual. Esta integração trata a conferência da agenda, não comprova encerramento completo de todas as ofertas. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 342 — Origem do faturamento por hora na memória do acerto, 14/09/2026

O contexto de encerramento passa a carregar emissão, decisão, memória e itens das cobranças originadas de fechamento por hora. A conferência de outras cobranças preserva essa origem na proposta do acerto. O valor permanece separado das mensalidades: não recebe cobertura fictícia nem proporcional mensal. Alteração proposta continua explícita e sujeita à aprovação do acerto, sem modificar o valor original de emissão.

O teste integrado confirma que a cobrança HORA_PARTICULAR de 156,25 CRC não tem cobertura mensal, conserva os itens e entra na conferência como saldo integral, crédito zero e sem alteração proposta quando a equipe mantém o valor. As origens passam a participar da memória revalidada do acerto.

Validação: 31 integrações de condições por hora e solicitação de encerramento aprovadas; suíte unitária integral com 825 testes em 89 arquivos aprovada. Build com TypeScript e 52 páginas aprovado; lint aprovado. Sem migration/interface alterada. Última regressão integral de integração permanece 298.

Pendentes: execução integral do encerramento com fechamento por hora, ajustes posteriores e suas autorizações, apresentação da origem na revisão do acerto, reservas antecipadas e homologação visual. Este incremento confirma a conferência das cobranças; não comprova todos os casos de encerramento. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 343 — Execução do encerramento com horas faturadas, 14/09/2026

O cenário integrado de faturamento foi estendido até a efetivação do encerramento: condições contratuais preparadas e aprovadas, pedido da Secretaria, acerto preparado pelo Financeiro/Administração, aprovação independente e executor de encerramento. Uma cobrança por hora de 156,25 CRC é preservada integralmente, sem proporcional mensal, recebimento, crédito ou apagamento do item faturado. A repetição da efetivação retorna o mesmo resultado.

O mesmo aluno tem um segundo contrato ativo fora do pedido. A execução encerra somente a matrícula selecionada e preserva situação e versão de acesso do contrato excluído. As datas futuras usadas no teste são fornecidas ao executor interno de validação; nenhuma data ou operação real foi alterada.

Validação: 21 integrações de condições por hora aprovadas com o cenário ampliado; TypeScript e lint aprovados. Sem alteração de código de produção ou migration neste incremento. Último build e suíte unitária integral no incremento 342. Esta evidência cobre encerramento sem desconto/ajuste do saldo faturado; não generalizar para todos os tipos de acerto.

Pendentes: ajustes autorizados sobre cobranças por hora, coexistência com antecipações e compensações, apresentação das origens na revisão, contratos históricos/aditivos e homologação visual. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 344 — Ajuste aprovado de horas faturadas no encerramento, 14/09/2026

O cenário de encerramento agora cobre manutenção do saldo de 156,25 CRC e redução aprovada para 100,00 CRC. Em ambos, o valor original da cobrança e do item faturado permanece em 156,25 CRC. O registro de ajuste identifica decisão do acerto, valor anterior e novo valor. A efetivação atualiza valor negociado/saldo conforme a aprovação, sem gerar pagamento ou crédito inexistente, e conserva o outro contrato ativo.

A preparação do acerto identifica particulares por hora e informa a origem em fechamento aprovado com quantidade de encontros. Cobertura mensal pendente é apresentada apenas nas mensalidades; cobranças por hora não exigem período de serviço fictício para serem revisadas. A redução continua proposta sujeita à aprovação independente.

Validação: 22 integrações de condições por hora aprovadas, com a execução completa nos dois valores finais; TypeScript e lint aprovados. Build com 52 páginas aprovado após ajuste de apresentação. Sem migration. Sem homologação visual interativa.

Pendentes: combinação com recebimentos/antecipações/compensações, crédito por valor já pago, apresentação detalhada na decisão e homologação visual. Não generalizar o cenário sem recebimentos para todos os acertos financeiros. Sem produção ou envios externos. Objetivo geral incompleto.

## Incremento 345 — Crédito de horas já pagas no encerramento, 14/09/2026

Validação integrada adicional: cobrança por hora de 156,25 CRC recebe pagamento pelo serviço financeiro; acerto com aprovação independente reduz o devido para 100,00 CRC e encerra somente a matrícula selecionada. O recebimento completo permanece idêntico, o valor original da cobrança e do item faturado é preservado, o saldo devido fica zerado e um crédito de 56,25 CRC é criado na matrícula, com origem no acerto. Repetir a efetivação mantém um único crédito e um único recebimento. O segundo contrato continua ativo.

Esta entrega amplia a verificação do comportamento existente; não altera regras de produção nem implementa execução de devolução. Crédito apurado permanece distinto de devolução efetiva. Permanecem pendentes a homologação visual, os cenários combinados com antecipações e a conclusão integral do escopo.

Validação: 23 testes de integração no arquivo de condições por hora aprovados; TypeScript e lint aprovados. Sem migration, sem novo build por se tratar de teste e documentação, sem envios externos ou alteração de produção.

## Incremento 346 — Memória financeira visível na revisão do acerto, 14/09/2026

O resumo das demais cobranças na prévia e no rascunho do encerramento agora apresenta separadamente valor negociado anterior, recebimentos, crédito já utilizado, valor devido proposto, saldo e crédito apurado. O aprovador pode expandir a origem das particulares por hora e conferir os valores dos itens faturados preservados, os recebimentos individuais e as utilizações anteriores de crédito com suas referências de aprovação. Os dados vêm da memória da proposta, sem consultar ou misturar outros contratos.

A apresentação esclarece que crédito apurado acompanha a efetivação aprovada e que uso/devolução seguem os fluxos próprios. Os campos adicionais são opcionais para leitura de versões anteriores. Não houve alteração dos cálculos, permissões ou movimentações financeiras.

Validação: lint aprovado; build Next.js com TypeScript e geração de 52 páginas aprovado; diff sem erros. Sem novo teste de integração porque a alteração se limita à apresentação de dados já produzidos e verificados no incremento 345. Homologação visual interativa permanece pendente. Sem migration, produção ou envio externo.

## Incremento 347 — Regressão completa e pendências estruturais, 14/09/2026

Concluída a regressão completa do estado atual: 825 testes unitários em 89 arquivos e 701 integrações em 53 arquivos, todos aprovados. A integração levou 812,07 segundos no PostgreSQL descartável localhost:54329, com execução sequencial. Relatórios por teste: validacao-regressao-unitarios-347-2026-09-14.json e validacao-regressao-integracao-347-2026-09-14.json. O build/TypeScript/lint mais recente é o incremento 346, sem alteração de código desde então.

Esta regressão comprova os cenários existentes, não os requisitos ainda sem implementação. A revisão confirmou que contratos simultâneos em turmas continuam limitados pelo índice global de alocação e pela ativação. O fluxo global antigo e o índice de solicitações acadêmicas abertas por aluno também exigem revisão antes de liberar múltiplos vínculos. A tela já seleciona matrícula e alguns serviços já restringem pelo contrato; isso não conclui a migração estrutural. Detalhes em validacao-regressao-347-em-andamento.md, agora encerrado como registro histórico.

Não houve alteração de produção, execução de migration nova nem envio externo. Os drivers externos de WhatsApp são simulados nos testes, inclusive nos cenários denominados live. Homologação visual e operação de serviços reais continuam pendentes. O objetivo integral permanece incompleto.

## Incremento 348 — Proteção contra movimentação global de contratos independentes, 14/09/2026

O limite do fluxo legado agora recusa pausa, encerramento e solicitação/decisão de retomada globais quando o aluno tem mais de uma matrícula, mesmo sem movimentação contratual anterior. Também recusa um contrato único já estruturado por preparação comercial, vínculo acadêmico (inclusive histórico), condições por hora ou compra de horas. Mantém as proteções anteriores para pausa e movimentações contratuais. A conferência ocorre sob os bloqueios já usados pelos serviços; a resposta orienta selecionar contratos no fluxo contratual.

Três novos testes de integração exercitam as ações públicas com Secretaria e Administração, dois contratos ativos sem movimentação anterior e contrato único com alocação vinculada. Cada recusa preserva integralmente cadastro, matrículas, cobranças, vínculos, movimentos, propostas e eventos. Um teste acadêmico antigo passou a representar explicitamente alocação legada sem matrícula: continua provando que pausa/retomada reais invalidam aprovação anterior, sem exigir que o caminho global alcance vínculo já migrado.

Validação: 825 unitários aprovados; 36 integrações de retomada aprovadas na primeira execução; após adequação do cenário, 58 integrações (55 acadêmicas e 3 novas) aprovadas. TypeScript, lint e diff aprovados. Não houve migration nem novo build. A regressão completa 347 é anterior a esta alteração; não afirmar que todos os arquivos foram novamente executados.

Esta proteção não libera múltiplas alocações. Permanecem a migração do índice global, do limite de solicitações acadêmicas abertas e dos demais consumidores de situação global, além da homologação e do restante do escopo. O legado não estruturado ainda precisa ser migrado; não é autorização para operar produção pelo caminho antigo.

## Incremento 349 — Fila acadêmica filtrada pela matrícula, 14/09/2026

A consulta de solicitações acadêmicas aceita matrícula e aplica esse filtro pela alocação de origem, conjuntamente com aluno, estado e escopo docente. A página acadêmica passa a matrícula selecionada à listagem e preserva o filtro nos links de paginação. O cursor precisa pertencer ao mesmo escopo; cursor de outro contrato é recusado. A consulta sem matrícula continua sendo a visão consolidada autorizada do aluno/equipe.

Teste integrado com dois contratos e solicitações históricas distintas comprova separação do histórico, filtro de abertas, cursor válido e cursor de outro contrato, combinação de aluno divergente e matrícula, rejeição de matrícula vazia e restrição docente. O professor atual só recebe o pedido de seu vínculo vigente; conhecer a matrícula ou o cursor não amplia a autorização. O cenário usa vínculos sequenciais porque a liberação de múltiplas alocações simultâneas permanece pendente.

Validação: 56 integrações acadêmicas aprovadas; lint e build Next.js com TypeScript e 52 páginas aprovados. Sem migration. Não houve homologação visual interativa nem nova regressão completa. Permanecem os índices globais de alocação e de solicitação aberta e as demais pendências de migração por contrato.

## Incremento 350 — Elegibilidade acadêmica pela matrícula vinculada, 14/09/2026

Mudanças acadêmicas de uma alocação vinculada passam a exigir a situação ativa e a compatibilidade do contrato correspondente, sem depender do status global legado do aluno. O vínculo sem matrícula continua exigindo aluno globalmente ativo. A tela usa as permissões e impedimentos calculados no servidor para oferecer a ação, removendo a condição global redundante.

Novas propostas usam memória versão 2: statusAluno fica nulo para alocação contratual, porque a situação vinculante está na matrícula preservada na memória. Isso não altera o cadastro do aluno. A versão 1 continua sendo lida e comparada segundo sua condição global original; uma mudança global não amplia uma aprovação antiga automaticamente. Alterações de matrícula, vínculo, currículo e demais condições continuam sujeitas à revalidação.

Validação: 828 unitários aprovados, incluindo conservação da versão antiga, independência de status global e recusa de matrícula pausada; 58 integrações acadêmicas aprovadas. Novos cenários solicitam, emitem parecer, aprovam e executam mudança de contrato ativo com cadastro global PAUSADO/ENCERRADO, preservando cadastro e dados financeiros. Build com TypeScript e 52 páginas e lint aprovados. Sem migration, homologação visual ou alteração de produção.

Pendências: ativação e índices ainda limitam múltiplas alocações; migração completa e homologação operacional permanecem incompletas. A regressão integral 347 é histórica; somente os escopos acima foram novamente executados.

## Incremento 351 — Alocações ativas em contratos independentes, 14/09/2026

A migration 20260914140000 substitui a unicidade global por aluno. Mantém uma alocação ativa por matrícula, uma alocação legada ativa sem matrícula por aluno e impede duplicação ativa do mesmo aluno na mesma turma. O banco serializa a conferência pelo aluno e recusa coexistência de vínculo legado sem matrícula com outro vínculo ativo até a conciliação. Nenhum vínculo histórico é inferido ou apagado. Migration aplicada exclusivamente ao PostgreSQL descartável: 158 migrations aplicadas; comparação com o schema sem divergência representável pelo Prisma.

A ativação da preparação passa a conferir o vínculo da matrícula alvo e a pendência de vínculo legado, sem bloquear apenas pela existência de outro contrato ou pela situação global legada. Os requisitos de aceite, pagamentos, reserva, ingresso e comissão permanecem. Consulta acadêmica sem seleção diante de múltiplos vínculos retorna origem ausente, em vez de escolher a primeira alocação.

Validação: 828 unitários aprovados; 150 integrações de reserva/ativação, acadêmico, diário e alocação aprovadas. Após ampliar as asserções de contratos simultâneos, 67 integrações acadêmicas/alocação novamente aprovadas. Os testes comprovam ativação concorrente/repetida preservando contrato e alocação anteriores, mudança acadêmica com outra alocação ativa preservada, recusa sem seleção, unicidade por matrícula em turma livre e bloqueio da mistura com legado nas duas ordens. Build com TypeScript/52 páginas e lint aprovados. Sem homologação visual ou produção.

Pendências: o índice global de solicitação acadêmica aberta ainda impede pedidos simultâneos de contratos diferentes. A revisão completa de consumidores, cenários de concorrência entre fluxos distintos e homologação operacional continua necessária. A liberação estrutural e os testes deste incremento não significam conclusão do objetivo integral.

## Incremento 352 — Solicitações acadêmicas simultâneas por contrato, 14/09/2026

A solicitação acadêmica agora possui matrícula de origem tipada com FK composta ao aluno. A migration 20260914143000 preenche os registros antigos somente pela identidade já preservada na memória da proposta; memória sem vínculo permanece legada. Substitui o índice global de pedido aberto por uma unicidade por matrícula e outra para pedidos legados por aluno. O banco confere correspondência entre alocação, matrícula e memória e impede trocar a identidade da solicitação. Aplicação realizada apenas no banco descartável: 159 migrations; schema diff vazio.

O serviço registra a matrícula exata ao criar o pedido. Teste integrado cria simultaneamente pedidos de dois contratos do mesmo aluno, conserva os dois abertos, repete o mesmo pedido sem duplicar, recusa outra proposta no mesmo contrato e cancelamento de um mantém o outro intacto. Inserção duplicada e alteração de identidade também são recusadas pelo banco.

Validação: 828 unitários aprovados; 59 integrações acadêmicas aprovadas; 53 integrações de avaliações aprovadas após estabilizar os instantes das fixtures. As primeiras execuções de avaliações falharam em limites temporais imediatamente posteriores a aprovação/reserva/designação. Os testes agora conferem o instante do banco antes de registrar eventos seguintes, sem flexibilizar validações de produção. Fixtures de mudanças preexistentes nas avaliações também passaram a identificar a matrícula na coluna e memória. TypeScript, lint e build/52 páginas aprovados. Mudanças posteriores ao build limitaram-se às fixtures, novamente verificadas por TypeScript/lint/integração.

Não houve homologação visual, produção ou envios reais. Permanecem a revisão integral dos consumidores de múltiplos contratos, concorrência entre fluxos distintos, regressão integral posterior às migrations e demais requisitos ainda incompletos.

## Incremento 353 — Pausa e encerramento preservam outra turma ativa, 14/09/2026

Ampliada a integração dos fluxos contratuais com duas alocações ativas reais em turmas distintas. Na pausa, o vínculo é preservado, a chamada da turma pausada exclui o aluno durante a pausa e a chamada do outro contrato continua incluindo-o. O contrato excluído permanece idêntico; o período financeiro iniciado e os recebimentos conservam as verificações anteriores.

No encerramento, os cenários INCLUIR/EXCLUIR o dia efetivo agora mantêm outro contrato alocado em turma própria: a execução encerra somente o vínculo selecionado e preserva integralmente o outro vínculo e contrato. A chamada posterior ao encerramento exclui o vínculo encerrado e mantém o aluno na outra turma. Continuam os testes de crédito, preservação de recebimento e rollback após falha financeira.

As fixtures identificam explicitamente a ativação necessária à elegibilidade histórica; a aplicação não presume essa data. Foi atualizada uma asserção da mensagem do bloqueio global para o texto contratual introduzido em 348. Sem mudança nas regras de produção neste incremento.

Validação: 36 integrações em dois arquivos aprovadas, TypeScript e lint aprovados. Sem migration ou novo build, pois as alterações são de testes/documentação. Homologação visual, regressão completa posterior às migrations e revisão dos demais consumidores seguem pendentes.

## Incremento 354 — Regressão completa após contratos independentes, 14/09/2026

Regressão integral concluída após as migrations 158/159 e as alterações dos incrementos 348–353: 828 testes unitários em 89 arquivos e 710 integrações em 54 arquivos aprovados, sem falhas ou testes pendentes. A integração executou sequencialmente no PostgreSQL descartável e levou aproximadamente 680 segundos. Evidências em docs/validacao-regressao-unitarios-354-2026-09-14.json e docs/validacao-regressao-integracao-354-2026-09-14.json.

A revisão estática dos consumidores encontrou pendências concretas: ação acadêmica pública aceita preparação sem escopo de matrícula mesmo com origem contratual; ficha oferece ações globais que o servidor já recusa para contratos estruturados; consultas de solicitações ainda usam a matrícula da alocação em vez da identidade tipada do pedido. O formulário acadêmico já envia a matrícula quando identificada; a primeira lacuna não foi atribuída a esse formulário. Evidências, limites e critérios de correção em docs/planejamento/revisao-consumidores-contratuais-354.md.

Nenhum código de produção ou teste foi alterado durante a regressão. Este incremento acrescenta evidência e revisão documental; não corrige ainda os consumidores identificados. Diff check aprovado. Sem novo build, migration, homologação visual, produção ou envios externos. Testes aprovados não comprovam funcionalidades ainda ausentes da SPEC, migração real ou operação integral.

## Incremento 355 — Escopo contratual nas novas preparações acadêmicas, 14/09/2026

A ação de solicitar mudança acadêmica agora resolve a matrícula da única origem válida sob os locks existentes e recarrega somente esse contrato antes de capturar a memória. Isso também vale quando o chamador omite matriculaId; múltiplas origens continuam exigindo seleção. A busca de pedido aberto nessa ação usa a identidade tipada da solicitação. Repetir uma proposta existente revalida o escopo preservado em sua própria memória, sem convertê-la silenciosamente para outro regime.

Integração comprova solicitação com e sem matrícula explícita, seguida de outra alocação ativa e pausa de outro contrato, preservando parecer/aprovação/execução do contrato original. Recusa solicitação ambígua sem criar pedido adicional. Memórias anteriores v1/v2 sem escopo conservam seus requisitos e conteúdo; alterar outro contrato ainda invalida essas propostas antigas. Nova contratação posterior à solicitação já vinculada não impede sua execução e permanece integralmente preservada.

Validação: 828 unitários, 62 integrações acadêmicas, TypeScript, lint e build de produção com 52 páginas aprovados. A primeira integração teve 61 aprovações e uma falha em expectativa antiga que exigia invalidar proposta por nova contratação independente; o teste foi substituído por aprovação/execução com preservação do novo contrato, conforme INV-01/INV-04, e a suíte completa acadêmica passou. Relatório: docs/validacao-integracao-academica-355-2026-09-14.json. Sem migration, produção ou envios. A regressão integral de todas as integrações permanece a do incremento 354, anterior a esta correção; homologação visual e os demais consumidores identificados em 354 ainda pendentes.

## Incremento 356 — Identidade histórica das consultas e ações da ficha, 14/09/2026

Lista acadêmica, paginação e consulta de pedido aberto por matrícula agora filtram SolicitacaoMudancaAcademica.matriculaId. Regularização posterior da referência de uma alocação não transfere seu pedido histórico a outro contrato. Pedidos legados sem identidade contratual preservada permanecem na consulta consolidada autorizada, sem atribuição automática à matrícula posteriormente identificada. Escopo docente e validação dos cursores continuam aplicáveis.

A proteção das ações globais e a ficha passam a compartilhar impedimentoFluxoGlobal. A página consulta a elegibilidade após autorizar a ficha e somente para quem pode movimentar. Contratos estruturados/múltiplos não recebem botões globais de pausa/encerramento/retomada nessa ficha; o link identifica o fluxo por matrícula, incluindo encerramento. O estado global foi rotulado como Cadastro. A leitura de elegibilidade não substitui a revalidação sob locks nas ações; edição cadastral e ações acadêmicas preservam suas capacidades anteriores.

Validação: 63 integrações acadêmicas aprovadas, incluindo histórico realocado, pedido legado e cursor fora do contrato; três integrações de proteção legada aprovadas, com consulta antes/depois do vínculo e recusa de chamadas diretas preservando os dados. Lint, TypeScript pelo build e build de produção com 52 páginas aprovados. Diff check aprovado. Relatório acadêmico em docs/validacao-integracao-academica-356-2026-09-14.json. Sem nova migration ou homologação visual. A revisão de outros caminhos legados, inclusive apresentação da retomada na ficha financeira, e as demais funcionalidades incompletas seguem pendentes. A última regressão integral continua sendo 354; esta rodada verificou os escopos alterados.

## Incremento 357 — Retomada financeira respeita limite contratual, 14/09/2026

O contexto da retomada global consulta a mesma regra de impedimento das ações. Contratos estruturados ou múltiplos bloqueiam a preparação global e não recebem uma grade de parcelas para esse fluxo. Na lista individual e global, propostas pendentes informam impedimento de aprovação; a interface omite a aprovação incompatível, conserva consulta/rejeição independente e oferece acesso ao fluxo por matrícula. A ficha financeira passa a oferecer esse acesso diretamente. A consulta compartilha o resultado por aluno para não repeti-la em cada proposta da mesma pessoa.

Rejeitar continua sendo uma decisão distinta de retomar: não altera situação, parcelas ou recebimentos. O teste cria uma proposta antiga, adiciona outro contrato, verifica impedimento no contexto/lista, recusa aprovação direta e permite rejeição independente, preservando o aluno, calendário, recebimentos e outro contrato.

Validação: 37 integrações de retomada aprovadas, lint e build com TypeScript/52 páginas aprovados. Relatório docs/validacao-retomada-357-2026-09-14.json. Após o build, somente o texto do aviso de rejeição foi ajustado para não afirmar que o aluno necessariamente continua pausado. Sem migration, produção, envio externo ou homologação visual. Última regressão integral permanece 354; demais funcionalidades da SPEC seguem incompletas.

## Incremento 358 — Lacuna entre avaliações e progressão, 14/09/2026

Revisão direta confirmou que decidirMudancaAcademica/executarMudancaAcademica ainda não consultam notas, frequência ou fechamento acadêmico. O consolidado calcula os mínimos, mas permanece acompanhamento; a fila de impactos de correções não resolve nem bloqueia operacionalmente a progressão. Portanto, aprovação manual e testes do fluxo atual não comprovam Q130/Q131/Q138/Q154.

Plano vinculante à implementação em docs/planejamento/integracao-progressao-academica-358.md: frequência histórica por contrato, fechamento versionado, exceção independente somente de frequência, integração da decisão/execução às fontes atuais e resolução das correções/equivalências. Inclui os caminhos válidos de regularização, segunda chamada e oportunidades, sem reduzir o escopo a um bloqueio. Critérios exigem preservar notas reais, financeiro e outros contratos.

Nesta rodada houve revisão de código e atualização documental; não houve mudança executável nem novos testes. A lacuna permanece aberta e impede declarar conformidade integral da progressão. O objetivo completo segue ativo.

## Incremento 359 — Apuração de frequência por encontros, 14/09/2026

Implementado src/server/avaliacoes/frequencia.ts como cálculo interno determinístico por matrícula/nível e instante de apuração. Entradas explicitam aula original, estado da conclusão, participação e reposições validadas. Recusa mistura de contratos/níveis, aula duplicada, reposição de outra origem, validação futura e realização futura. Não consulta dados externos nem concede autorização à existência de um identificador: o carregador ainda deverá verificar fontes, vínculo histórico e equivalência.

Presenças e regularizações compõem o numerador; uma aula original entra uma única vez, mesmo com mais de uma reposição validada. Memória conserva falta/impedimento original e apresenta a data de validação da regularização. Impedimento sem reposição permanece na base sem crédito. Canceladas e previstas futuras ficam fora da base; prevista passada gera pendência de conclusão; chamada ausente deixa resultado inconclusivo. Sem aulas não há frequência suficiente presumida. O percentual é preservado como fração e o mínimo é comparado sem arredondamento; 2/3 não satisfaz 66,67%.

Validação: oito testes unitários aprovados, TypeScript e lint direcionado aprovados; diff check aprovado. Não houve integração com banco, migration, build novo, exposição em tela, produção ou envio. Os tipos da função não representam novos estados persistidos no schema. Carregamento histórico, vínculo das reposições aprovadas, frequência consolidada do nível após transferências, fechamento, exceção de frequência e validação da progressão seguem pendentes conforme plano 358. Este incremento é uma base de cálculo, não a entrega integral de Q131/Q154.

## Incremento 360 — Frequência consultada nos registros do vínculo, 14/09/2026

A consulta autorizada do consolidado carrega encontros publicados do vínculo, chamadas do próprio aluno e situação contratual histórica no início da aula. Usa a regra de frequência vinculada à turma, sem padrão presumido. Datas fora da alocação e contratos não ativos na aula não fornecem presença. Diários sem encontro associado, situação contratual não conferida e outros vínculos do mesmo nível geram pendências; múltiplos vínculos exigirão o aproveitamento aprovado.

O booleano legado de presença não distingue impedimento e regularização. Ausência registrada gera conferência específica e não permite concluir atendimento do mínimo automaticamente. A tela mostra presenças/base e pendências como acompanhamento parcial deste vínculo. Não apresenta essa consulta como fechamento final. A apuração temporal fica fora da memória interna estável dos planos de recuperação, preservando sua revisão/idempotência.

Validação: suíte de lançamentos com 54 integrações aprovada; acrescentado cenário de presença ministrada e ausência não classificada, seguido de execução direcionada dos dois testes de frequência (dois aprovados, 53 não selecionados). Total atual do arquivo: 55 testes, sem nova execução integral após a adição do segundo cenário. TypeScript, lint e build/52 páginas aprovados; somente teste foi alterado após o build. Evidência da suíte: docs/validacao-frequencia-360-2026-09-14.json. Diff check aprovado. Nenhuma migration, produção, envio externo ou homologação visual.

Ainda faltam classificação persistida da ausência/impedimento, reposições com decisões verificáveis, agregação e equivalência entre vínculos, fechamento versionado, exceção de frequência e integração na aprovação/execução da progressão. Não afirmar conclusão de Q131/Q154 a partir desta consulta parcial.

## Incremento 361 — Participação contratual na chamada, 14/09/2026

Migration 160 (20260914150000) adiciona matrícula e participação opcional ao registro da aula: PRESENTE, FALTA e IMPEDIDO_POR_RESTRICAO. A FK composta exige o mesmo aluno do contrato; check SQL impede classificação incompatível com o booleano; identidade contratual já preenchida não pode ser removida/trocada. Registros antigos permanecem nulos, sem backfill presumido. Aplicada somente ao PostgreSQL descartável; Prisma regenerado e schema diff vazio.

Chamada coletiva e particular capturam o contrato conferido no servidor para registros novos. Classificação explícita requer matrícula identificada, presença coerente e, para impedimento, observação da ocorrência sem dados financeiros. Entrada antiga sem classificação preserva a anterior se a presença não mudar; edição legada não atribui contrato silenciosamente. Reclassificação explícita de registro pendente utiliza o vínculo histórico validado. Registros de quem saiu continuam em leitura; encontro ministrado conserva os bloqueios de edição existentes.

A tela do encontro oferece classificação quando a matrícula histórica foi identificada. Histórico e revisão da exceção de gravação distinguem impedimento de falta. Matrícula/classificação entram na comparação do estado do diário, preservando a forma anterior para registros sem identidade; consultas de revisão carregam os mesmos campos. A frequência usa a classificação confirmada e recusa usar registro tipado de outro contrato; impedimento permanece na base sem crédito.

Validação: 839 unitários em 91 arquivos aprovados; 55 integrações de avaliações aprovadas e 17 de diário aprovadas na execução final. A rodada combinada anterior teve duas falhas de fixtures: objeto esperado sem o novo campo nulo e sessão da gestão não restaurada após nova consulta. Ambas corrigidas sem flexibilizar regra e repetida a suíte de diário. Evidências docs/validacao-participacao-361-2026-09-14.json (rodada intermediária) e docs/validacao-diario-361-final-2026-09-14.json (17 aprovados). TypeScript, lint, build/52 páginas e diff check aprovados. Após build, apenas fixtures e nome de mapeamento da FK no schema foram alinhados; cliente regenerado.

Sem homologação visual, produção ou envios. Registrar impedimento não cria/revoga restrição nem executa cobrança. Correções aprovadas de chamadas concluídas, regularização formal do legado, reposições com evidências, frequência entre vínculos, fechamento e integração da progressão continuam pendentes. A classificação não comprova conclusão integral de Q59/Q131/Q154.

## Incremento 362 — Validação e chamada histórica, 14/09/2026

Conferência obrigatória de vínculos históricos sobrepostos implementada na consulta e no lançamento, preservando o diário existente e impedindo conclusão com origem ambígua. Corrigidas fixtures identificadas pela regressão. Evidências, contagens e limites em [validação do incremento 362](validacao-incremento-362.md). Regularização formal, correções de aulas concluídas e integração da progressão permanecem pendentes.


## Incremento 363 — Recuperações sem nota, 14/09/2026

Corrigida omissão no acompanhamento, com finalidade explícita separada da base comparada do plano. 55 integrações finais e 839 unitários aprovados; build e lint aprovados. [Evidências e limites](validacao-incremento-363.md). Fechamento acadêmico e integração da progressão continuam pendentes.


## Incremento 364 — Pendências operacionais, 14/09/2026

Consulta e tela do consolidado apresentam pendências de correções, aprovação/disponibilização de planos e reservas não realizadas. 57 integrações e quatro cenários complementares aprovados; 839 unitários e build aprovados. [Detalhes e limitações](validacao-incremento-364.md). Fechamento e integração da progressão permanecem pendentes.


## Incremento 365 — Habilidades sem tentativa, 14/09/2026

Acompanhamento identifica atividades de planos aprovados que ainda exigem tentativa. Validação: 58 integrações de avaliações e 839 unitários aprovados; build/TypeScript e lint aprovados. [Evidências e limites](validacao-incremento-365.md). Fechamento acadêmico e integração da progressão seguem pendentes.


## Incremento 366 — Oportunidades extras de recuperação, 14/09/2026

Atualização 376: prévia de substituição do avaliador com disponibilidade compartilhada e distinção da designação sem agenda. 79 integrações acadêmicas, lint/TypeScript e build aprovados. [Evidências e próxima integração](validacao-incremento-376.md). Ainda sem proposta persistida ou aplicação da substituição.

Atualização 375: consulta de agenda publicada no plano e nas tentativas docentes autorizadas, com fuso local de exibição e indicação de realização disponível. 77 integrações acadêmicas, lint/TypeScript e build aprovados. [Evidências e limites](validacao-incremento-375.md). Sem migration; não inclui agenda semanal ou portal do aluno.

Atualização 374: cancelamento da recuperação agendada pela escola com proposta, aprovação independente e aplicação atômica. 80 integrações aprovadas, três cenários finais repetidos, lint/build e schema aprovados. Migrations 168–169 somente no banco descartável. [Evidências e limites](validacao-incremento-374.md). Remarcação, substituição, cancelamento/falta do aluno e notificações continuam pendentes.

Atualização 373: aprovação independente/publicação atômica de recuperação e realização vinculada ao horário aprovado. 101 integrações direcionadas e quatro casos finais repetidos aprovados; dois unitários, lint e build aprovados. Migrations 165–167 no banco descartável. [Evidências e limites](validacao-incremento-373.md). Remarcação, cancelamento e notificações ainda estavam pendentes naquela etapa.

Atualização 372: separação de recuperações nos impactos de calendário e encerramento, preservando memórias existentes. 28 integrações direcionadas e dois unitários aprovados, além de lint, TypeScript e build. [Evidências e limites](validacao-incremento-372.md). Ainda sem publicação de recuperação naquela etapa.

Atualização 371: finalidade explícita de encontros e proteção dos consumidores de diário, particular e horas compradas; migration 164 no banco descartável. [Evidências e limites](validacao-incremento-371.md). A publicação da recuperação permanece bloqueada até a integração de sua aprovação.

Regressão completa 371: 839 unitários e 738 integrações aprovados, sem falhas/pendências; build com TypeScript, lint e schema aprovados. Não equivale a entrega integral ou homologação operacional.

Atualização 370: persistência e tela de propostas de horário com versões, idempotência e revisão histórica/atual. Migration 163 somente no banco descartável. [Evidências e dependência para publicação](validacao-incremento-370.md). Não há aprovação nem agendamento confirmado.

Atualização 369: prévia da agenda de recuperação implementada no servidor e na tela do plano. [Conferências, evidências e limites](validacao-incremento-369.md). Não publica encontro nem reserva disponibilidade.

Atualização 368: SQL de autoria alinhado ao servidor quanto ao início do vínculo, titularidade e turma não concluída. Três falhas reproduzidas antes da correção; 65 integrações de avaliações aprovadas depois da migration 162 no banco descartável. [Evidências e dependência da agenda](validacao-incremento-368.md).

Atualização 367: concorrência e limite original zero validados; saldo na tela discrimina regra/extras/total. 62 integrações de avaliações, TypeScript, lint e build aprovados. [Evidências](validacao-incremento-367.md). As pendências de segunda chamada e progressão permanecem.

Proposta, decisão independente, consulta/tela e aplicação de extras à reserva por contrato/nível/habilidade. Migration 161 aplicada somente ao banco de testes. 60 integrações de avaliações e 839 unitários aprovados, além de build/TypeScript/lint/schema. [Evidências e pendências](validacao-incremento-366.md). Segunda chamada e homologação ainda não concluídas.
