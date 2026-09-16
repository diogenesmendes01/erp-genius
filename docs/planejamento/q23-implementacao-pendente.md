# Q23 — correção aprovada de aula ministrada

Auditoria original em 14/09/2026, após incremento 444. Atualização 454: preparação, snapshots, proposta imutável, comparação/simulação de impactos, interface, proteção dos originais, rejeição independente e histórico paginado em leitura implementados. Aprovação/publicação, fonte normal de material e tratamento efetivo dos impactos continuam pendentes. [Validação e limites atuais](validacao-incremento-454.md). [Mapa da projeção pendente](q23-projecao-efetiva.md). A evidência abaixo descreve as lacunas originais, não o estado integral atual.

## Requisito

`f07-agenda-aulas.md` exige proposta, valores anteriores/novos, motivo, autoria e aprovação por outra pessoa da Gerência Pedagógica/Administração. Professor desvinculado permanece em leitura. Impactos em frequência e reposição precisam ser conferidos.

## Evidência atual

- `src/server/diario/acoes.ts` e `particular.ts` restringem a chamada de encontro a PREVISTO. Suas atualizações diretas não oferecem o fluxo Q23.
- `chamada-encontro.ts` não abre chamada de encontro MINISTRADO para correção.
- Os guards de contexto do diário preservam identidade/autoria, mas ainda não proíbem genericamente atualização de conteúdo/registros de AULA MINISTRADO sem decisão independente. Proteções de consumo de horas têm escopo específico.
- A frequência usa o diário atual; não existe fonte efetiva versionada de correção da aula, nem quarta origem de caso de revisão de progressão.
- A gravação oficial da aula precisa ser integrada ao modelo de material: material de reposição não substitui essa fonte.

## Sequência de implementação

1. Fonte versionada de gravação e proposta/decisão imutáveis de correção, com snapshots antes/depois, matrícula por registro, versão, hash e idempotência.
2. Proposta e aprovação com autorização atual, independência por pessoa, locks compatíveis e revalidação de estado. Preservar originais; publicar estado efetivo somente após aprovação válida.
3. Guards contra alterações diretas de diário, registros e estado de AULA concluída. Preservar Q07 e os fluxos separados de REPOSICAO e consumo de horas.
4. Projeção efetiva comum para frequência, leitura de diário e reposições. Alterar falta não apaga reposição; abrir conferência explícita dos registros dependentes. Incluir nova fonte nos hashes de fechamento e casos de revisão.
5. Interface para propor/conferir/histórico, com professor desvinculado em leitura e nenhuma ampliação financeira.
6. Testes de autorização, concorrência, SQL direto, integridade por matrícula, materiais, reposição dependente e fechamento/progressão reais.

Esta sequência não reduz a regra aprovada a um bloqueio de edição. A entrega exige que a correção autorizada possa ser concluída, consultada e rastreada com seus impactos.
