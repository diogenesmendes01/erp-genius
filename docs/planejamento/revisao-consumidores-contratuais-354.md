# Revisão dos consumidores de contratos independentes — 14/09/2026

Revisão estática durante a regressão 354, após as migrations dos incrementos 351/352. Não é homologação visual nem comprovação de todos os requisitos da SPEC.

## Pendências encontradas

1. **Preparação acadêmica sem matrícula selecionada.** `src/server/academico/estado.ts`, função `carregarEstadoAcademico`, carrega todas as matrículas e movimentações quando o argumento `matriculaId` está ausente. Se houver uma única alocação ativa vinculada, `solicitarMudancaAcademica` permite gerar uma proposta v2 cujo `matriculaOrigemId` está identificado, mas `escopoMatriculaId` permanece nulo. Alterar outro contrato ou adicionar uma segunda alocação pode invalidar essa proposta. O formulário atual envia a matrícula da origem quando ela existe; a lacuna está na ação pública, que ainda aceita omitir esse campo, e nas propostas assim produzidas. Preparações novas devem identificar o escopo do contrato antes de capturar as condições; propostas antigas precisam conservar a memória e os requisitos sob os quais foram submetidas/aprovadas. Não escolher arbitrariamente entre várias alocações.

2. **Ações globais ainda oferecidas na ficha.** `src/app/(app)/alunos/[id]/FichaAluno.tsx` apresenta Pausar/Encerrar conforme `aluno.status`. O servidor protege esses caminhos com `exigirFluxoGlobalSemMovimentacaoContratual`; contratos estruturados/múltiplos são recusados. Existe link para propostas contratuais na página, mas a ficha ainda oferece um caminho incompatível com esses registros. Expor a elegibilidade calculada no servidor e encaminhar os contratos ao fluxo correto, preservando as autorizações de cadastro e a compatibilidade legada necessária.

3. **Filtro acadêmico ainda indireto.** `src/server/academico/consultas.ts` e a busca de pedido aberto em `acoes.ts` filtram pela matrícula da alocação, embora `SolicitacaoMudancaAcademica.matriculaId` agora registre a identidade histórica da solicitação. Revisar a utilização da identidade tipada, sem atribuir automaticamente a um contrato pedidos legados cuja memória não permite essa identificação.

## Comportamentos observados e limites

- As consultas de alunos projetam campos explicitamente; professor recebe somente alocações de suas turmas e não recebe a coleção financeira de matrículas. As coleções autorizadas podem conter mais de uma turma.
- O contexto acadêmico sem contrato não escolhe a primeira alocação quando há várias. A página permite escolher entre vínculos de matrículas autorizados.
- Ações globais de pausa/encerramento/retomada possuem proteção no servidor, independentemente dos botões apresentados.
- A chamada contratual calcula elegibilidade por vínculo e situação histórica da matrícula. Os cenários de pausa e encerramento com outra turma ativa receberam testes no incremento 353.
- A ficha e algumas listas ainda exibem `Aluno.status`; esse valor não representa sozinho a situação de cada serviço contratado. A apresentação precisa distinguir cadastro de situações contratuais.

Os pontos acima não autorizam reduzir requisitos nem declarar concluída a migração de todos os consumidores. Corrigir em incremento próprio, com testes de isolamento entre contratos, compatibilidade das propostas existentes e revisão de acesso.

## Critérios para os próximos ajustes

- Uma preparação nova com origem contratual inequívoca precisa conservar a identidade dessa matrícula. Pausar outro contrato ou alocá-lo em outra turma não deve invalidar a aprovação do primeiro apenas por pertencerem à mesma pessoa.
- Diante de múltiplas origens possíveis, exigir seleção e não gravar uma solicitação em nome de uma origem arbitrária.
- Proposta existente sem escopo contratual suficiente não ganha independência por reinterpretação silenciosa. Sua versão e condições de revisão precisam permanecer verificáveis.
- Lista, pedido aberto e paginação devem manter a mesma identidade contratual; o cursor de outro contrato continua recusado e o professor conserva somente suas atribuições autorizadas.
- A ficha deve apresentar o caminho operacional aplicável. Ocultar ações globais incompatíveis não substitui os bloqueios das ações no servidor; chamadas diretas continuam sendo verificadas.
- Validar os caminhos com contratos distintos ativos, pausados e encerrados, incluindo dados legados sem vínculo suficiente. Não preencher vínculo histórico por suposição para fazer um teste passar.

## Atualização 355

A preparação de novas solicitações foi corrigida: origem contratual inequívoca define o escopo antes da captura da memória; propostas existentes conservam seu escopo original. A busca de pedido aberto na ação de criação agora usa a identidade tipada. Integração acadêmica: 62 testes aprovados. Permanecem pendentes os filtros das consultas e a apresentação das ações globais na ficha.

## Atualização 356

Filtros de listagem, cursores e pedido aberto por matrícula agora usam a identidade tipada. A ficha compartilha a consulta de elegibilidade com os bloqueios das ações e não oferece movimentação global incompatível. Foram aprovadas 63 integrações acadêmicas, três de proteção legada e o build. Sem homologação visual; outros consumidores, inclusive a retomada na ficha financeira, permanecem sujeitos à revisão.

## Atualização 357

A retomada na ficha financeira agora impede preparação/aprovação global incompatível, conserva a rejeição independente e consulta das propostas anteriores e encaminha ao fluxo por matrícula. Testes: 37 integrações de retomada aprovadas. A alteração não comprova revisão integral de todos os consumidores nem homologação visual.
