# PR #405 — estados do Inbox e comentários

Fonte101c66181e8fa50f2cbb3aab29d1d225420fbfaf, pais c3ee1b83 (cherry-pick73c7 documental sobre4af) e4033e40baa6. Um bloco do quadro preserva ambos os lados; nenhuma featureE2 foi antecipada. Preserva os estados319, transições de foco, montagem única, compositor/rascunho403, busca/atalho402, thread398, Pick401, B2 e QA280/planejamento297.

C1 MEDIUM: main e pais conciliados localmente; publicação aguarda403main e CI global final nos dois fusos. C2 LOW: inventário21saídas/4863linhas, vínculo com o pacote319 e limites históricos preservados. Os oito JSON guardam allowlists/medidas que não são individualmente duplicadas no ZIP; remover por tamanho perderia a trilha verificável. Nenhum artefato foi regravado nem captura antiga atribuída à composição atual.

## Gates próprios

- c5f75a terminal0:15arquivos/237testes, America/Sao_Paulo, maxWorkers2, todos os15caminhos conferidos existentes. Inclui Inbox/foco/interação, Conversa/busca, PainelSetor, Esqueleto e guardas dos estados/cabeçalho/coluna/conclusão/falha/painel/dependências. Sem filtro de caso/skips novos; não é global, DB ou browser.
- Typegen/TypeScript26774/a8d1a3 e lint global79756/0ea74b terminais0, zero erros/40avisos herdados.
- Asserção42ba9e inicialmente exigia backend inteiramente igual ao pai, mas dbe15d confirmou que o único delta é o JSDoc legado de preferencias400. A asserção corrigida7c61c9 confirmou esse objeto igual ao pai403, schema/migrações iguais ao pai405 e os demais produtores iguais ao pai403. Nenhum código foi restaurado para contornar a prova.

QA documental73c7 favorável, original SHA256 0b45d18e778c65a8d828adfc4427b4d9f19812266ceff53d7c4eca56de5406f1. QA composta101 favorável estática: estados e harness319 iguaisc3; compositor/menu/Shift402/thread398/Pick401/schema/QA297 preservados, Conversa só remove tipos órfãos e InboxNovo só recebe JSDoc. Nenhum novo teste/DB/browser no parecer. Original SHA256 cb91772b44a9d783ffe126d97fb32a644fe9a065d4117bee83988bb1950ef126, em tester-composicao-101.md com apenas EOF normalizado.

Os registros finais402/403 foram incorporados sem delta além de Markdown, preservando a fonte101. #403 integrou por squash713dca8d após CI40024011516 success5/5 e QA favorável; issue317 fechada. O squash tem árvore inteira igual7a7a6818. Sua incorporação à405 gerou oito conflitos de ancestralidade, mantidos na candidata já composta; o índice inteiro foi conferido igual89f8dcdc antes do commit. Nenhuma fonte, teste ou documento distinto mudou, sem repetir gates por esse merge.

Global903/7.101 e capturas319 pertencem às suas fontes históricas. CI final405 em dois fusos ainda é gate. Nenhuma nova captura, instalação, banco, migração, seed, envio real ou deploy.
