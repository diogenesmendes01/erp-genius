# PR #401 — cabeçalho e comentários da revisão

Fonte composta266b180e1fae7c9f5edfb93438e7347d2cb45168: patch documental474 sobre0fca aplicado como7e988310, merge da candidata3999785433e. Preserva estado-visual.ts com ItemEstadoCabecalho/Pick ee565ffc, cabeçalho68, menu e useAcoesAtendimento da feature315; nenhuma busca316 ou estado319 antecipado. Patch de dias/autoria398, alias400, B2/QA280/planejamento297 incorporados.

Três conflitos: quadro com um bloco preserva ambos os lados; Conversa mantém useAcoesAtendimento/Cabecalho315 e remove o import/props de triagem órfãos conforme399; teste remove o único casoSSR que passava prop ignorado e mantém o novo caso de cabeçalho315. Nenhum JSX/hook da315 foi substituído pelo componente antigo. O JavaScript de Conversa emitido sem comentários é igual7e, após remover somente tipos/import type. Provas6e2d6c e comparação de emit, terminais0.

C1 HIGH: código/pais conciliados; publicação aguarda399main e CI final nos dois fusos. C2 LOW: busca desabilitada/Em breve e contrato preparado, ativação somente316. C3 LOW: Voltar até960 pertence à casca308, apresentação700 e painel1400 são limites distintos. C4 LOW: sucesso de marcar não lida reconta o selo uma vez; falha não reconta como sucesso; outras abas dependem dos gatilhos atuais, sem garantia imediata ou novo canal. C5 LOW: artefatos inventariados com fonte/hash e ZIP315 histórico, sem apagar evidências arbitrariamente. Detalhes na SPEC e relatórioDEV inbox-pr401-review-todos.md.

## Gates próprios e QA

- Recorte837b4b:10arquivos/201testes, America/Sao_Paulo, maxWorkers2, terminal0. Comando também citava estado-visual-cabecalho.test.ts, inexistente e não contado. Os dez existentes abrangem cabeçalho, menu, ações, conversa, interaçãoInbox, painéis, estado visual e guardas.
- Complementoceba6d:useAcoesAtendimento.test.ts e estado-visual.servidor.test.ts,2arquivos/5testes, terminal0. Não é global ou DB; sem filtro de caso/skips novos nos dois recortes.
- Typegen/TypeScript40454/5b1118 e lint global85407/521e25 terminais0, zero erros/40avisos herdados.
- QA do patch documental474 favorável estática, original SHA256 17259a048575a8316579823250ad4d7857600b18499b6ad15e19a1bc1185afb2, cópia tester-patch-474.md com apenas EOF normalizado. Não executou testes/DB/browser nessa extensão; 7/53 do DEV permanecem nominais474.

QA composta266 é favorável, estática: cabeçalho/menu/useAcoes/estado iguais7e; painel/backend/schema/thread/alias/deps/planejamento297 iguais978; composição da Conversa e triagem real preservadas. Parecer original corrigido somente na atribuição dos gates externos: SHA256 47f69e9929e3af6f73f5481e513119885d2caa711399cab88171d991d3a6adb2, em tester-composicao-266.md com apenas EOF normalizado. O hash anterior5d6 não foi versionado nem usado como parecer final; citava9/187 da399 em vez dos10/201+2/5 desta401. Nenhuma nova execução resultou dessa correção documental.

Incorporação posterior de399efa, já contendo main4000c, adiciona somente registros/ancestralidade sem alterar a fontexecutável266. Um bloco do quadro preserva ambos os lados.

#399 integrou por squash8c079d49 após CI40016922055 success5/5, QA e12INT do painel favoráveis; issue318 fechada. O squash tem árvore inteira igualefa. Sua incorporação à401 gerou dez conflitos de ancestralidade; mantive as versões já compostas e provei o índice inteiro igual2252 antes de confirmar o merge. Nenhum executável, teste ou documento distinto mudou; a fonte266 e seus gates permanecem preservados, sem repetição por esse merge. CI final401 em dois fusos continua gate antes do merge.

Global887/6.950 e imagens315 pertencem às suas fontes históricas. Nenhuma nova captura, banco, instalação, migração, seed, mensagem real ou deploy.
