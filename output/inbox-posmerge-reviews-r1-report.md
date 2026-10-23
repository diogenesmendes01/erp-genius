# Inbox — composição final das correções pós-merge

Em 23/10/2026, a rodada anterior terminou com 31 PRs mergeadas (297 e 380–409) e 26 issues funcionais originais encerradas (298–323, de 81). Esta composição resolve comentários retroativos dessas entregas. Não encerra outra issue funcional nem afirma publicação ou merge desta nova PR.

Base: main `710fe56803369dc2e37d428934f2ef4954d056e5`, squash da #409. Fonte executável final: `29c2bf199988455fba123887de6429af6ac606e7`, branch `codex/inbox-posmerge-reviews-r1`. Foram reaplicados somente nove patches selecionados, sem publicar a história agregada de `272a2b33`.

| Correção | Original | Composição |
|---|---|---|
| #384: descrições acessíveis dos anexos, IDs estáveis por instância e mapa Task 6 | 50a4a649 | e9e19b86 |
| #385: quatro links dos manifestos | 652d43a4 | 9aaa4986 |
| #395: respeitar Escape consumido pelo editor filho | 86203539 | 8f39b11a |
| Arquivar 97 PNG históricos #299/#302/#303 | 8d8281a3 | d290167a |
| #380: colisões Git sem distinção de caixa e LF delimitado | 6b039a61 | 1b909ed5 |
| #381: rejeitar classe `ring-offset` sem valor | 7007aa73 | 2fb05e48 |
| #396: remover helper órfão e usar contagem pessoal canônica nos testes | 4a77171b | 3ed0f3fa |
| #396: testes ReactDOM do hook compartilhado de eventos | 6dfa809d | 4d9596d3 |
| Curadoria de mapas, referências e registros históricos | 272a2b33 | 29c2bf19 |

Os trailers `cherry picked from` registram os SHAs completos. O único conflito foi no quadro de entregas: a resolução do primeiro patch preservou os bytes de main e acrescentou a seção #384. Os patches seguintes mantêm suas próprias mudanças documentais de curadoria, inclusive espaços e reposicionamento de metadado; o quadro final não é byte a byte idêntico à base.

## Validação da fonte final

- Unitário completo: Node 22.23.2, `vitest run --maxWorkers=2`, heap 8192; sessão 55132, terminal 096015, saída 0: **910 arquivos/7.159 testes**, 214,04 s. Sem filtro por nome, sem testes ignorados; configuração padrão exclui integração. Windows, fuso local America/Sao_Paulo, sem TZ definido. Executado fora do sandbox devido ao EPERM de cache Vite já diagnosticado na tentativa histórica; não houve mudança de fonte para contornar teste.
- Next typegen + TypeScript global: sessão 92277, terminal d91229, saída 0.
- Lint global: sessão 16623, terminal cb7c17, saída 0; zero erros e 40 avisos herdados.
- Revisão independente do TESTER no SHA exato 29c2bf19: 5 arquivos/159 testes, executor bc59c1, saída 0. Comparação com 272a mostrou somente três JSDocs, duas linhas vazias de teste e a retirada de uma seção duplicada do README. Transpilação independente dos três arquivos, com comentários removidos, gerou JavaScript idêntico (b47df1, saída 0). `git diff --check` terminou 0.
- Pareceres originais de UI #384 (2/64), Escape #395 (4/31), guardas/hook (8/65 e arquivo INT de linha comercial 1/24), capturas e curadoria estão copiados e indexados por SHA em [inbox-posmerge-qa/README.md](inbox-posmerge-qa/README.md). Cada prova mantém sua fonte e seu escopo. Não há alegação de suíte INT global ou novo roundtrip de ZIP na fonte final.

Os 97 PNG históricos foram retirados do índice, com cópias locais e ZIP privado preservados e auditados; catálogo versionado em `output/inbox-posmerge-arquivo-capturas.json`. ZIP: 4.484.568 bytes, SHA-256 `fc84c7c070c10e5bfc478594894d7f4bb2ca40c9d8c8f9d9ed5ffb2b6e56b76a`. A troca de checkout preservou também os 98 arquivos locais que colidiriam com main, mediante manifesto, hashes e movimentação individual para backup privado dentro do worktree; nenhum arquivo foi descartado. Os PNG/ZIP/backups e scripts administrativos não integram esta publicação.

Os cinco manifestos antigos #307 preservam seus campos originais e ganham aviso de curadoria. O ZIP legado #307 permanece privado; o índice histórico mantém o pacote sanitizado já publicado. Nenhuma captura antiga foi apresentada como nova execução.

Esta composição não altera schema, migrações, dependências, provedor, regras de envio ou permissões. Não houve envio real, ativação externa nem deploy. Após esta fonte, o commit de publicação deve acrescentar somente este relatório, os pareceres e o estado do quadro. Os cinco checks remotos e a revisão dos novos comentários continuam obrigatórios antes do merge.
