# Incremento 437 — formulários e concorrência da resolução

Data: 14/09/2026. Meta integral ativa.

## Implementação

O detalhe do caso oferece prévia, proposta com motivo e decisão independente. A prévia mostra quantidade de casos e efeito; trocar a ação ou o contexto invalida a prévia, e o envio conserva sua chave em repetição da mesma tentativa. A decisão usa o hash da proposta persistida, nunca substituído pelo hash de uma consulta posterior. Propostas superadas são identificadas como substituídas; somente a última versão pode receber decisão. A rejeição dessa versão pode registrar a recusa após mudança da base, sem resolver casos ou atestar a base atual.

O histórico é paginado e inclui versões, autores, motivos e decisões. Caso resolvido não oferece nova preparação. Cancelamento não é apresentado como nova conferência de notas; reconfirmação exige novo fechamento suficiente. A interface exige escolha explícita de aprovação/rejeição e o servidor mantém as validações de acesso e estado.

A decisão transacional foi extraída para helper interno, mantendo no wrapper público sessão e Zod. O helper conserva os locks e a revalidação do papel ativo. A migração 199 alinha o limite de motivo da decisão no banco a 3.000 caracteres, como já definido no formulário e na action; a migração 198 permanece preservada.

## Evidências

- Fluxo público de resolução por cancelamento passou após a extração: `docs/validacao-resolucao-publica-437-2026-09-14.json` (1 aprovado, 84 fora do filtro).
- Cadeia e resolução: `docs/validacao-resolucao-concorrencia-437-final-2026-09-14.json` (3 aprovados). Inclui segunda correção abrindo novo caso, aprovação da proposta antiga recusada, rejeição histórica da versão atual, nova proposta cobrindo os dois casos, listagem por papel/autoria e reconfirmação final.
- Decisões idênticas concorrentes produzem uma decisão; opostas produzem um único vencedor com autoria e resultado conferidos. O motivo de 3.000 caracteres foi aceito. Essas concorrências exercitam o helper em transações reais, com os guards internos ativos. Chamadas públicas paralelas encontraram erro no mock de importação dinâmica de NextAuth no runner; os testes públicos de acesso permanecem separados, sem substituir os guards por mocks.
- Build completo, TypeScript, lint direcionado e diff check aprovados. Migração 199 aplicada só ao banco local; schema sem diferenças.

## Limites

Não houve validação visual/interativa no navegador. A paginação foi implementada, mas o cenário com mais de 20 propostas ainda não tem teste específico. Preenchimento auditado dos casos históricos e demais frentes da SPEC continuam pendentes. Os hashes canônicos e a recomputação acadêmica continuam sendo conferidos no serviço, conforme o limite registrado no incremento 436. Não houve implantação em produção.
